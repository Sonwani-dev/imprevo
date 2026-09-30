// Polyfills for browser compatibility with pdfjs-dist
if (typeof Map !== 'undefined' && !('getOrInsertComputed' in Map.prototype)) {
  // @ts-ignore
  Map.prototype.getOrInsertComputed = function (key: any, callbackfn: (k: any) => any) {
    if (this.has(key)) {
      return this.get(key);
    }
    const value = callbackfn(key);
    this.set(key, value);
    return value;
  };
}

if (typeof WeakMap !== 'undefined' && !('getOrInsertComputed' in WeakMap.prototype)) {
  // @ts-ignore
  WeakMap.prototype.getOrInsertComputed = function (key: any, callbackfn: (k: any) => any) {
    if (this.has(key)) {
      return this.get(key);
    }
    const value = callbackfn(key);
    this.set(key, value);
    return value;
  };
}

if (typeof Promise !== 'undefined' && !('withResolvers' in Promise)) {
  // @ts-ignore
  Promise.withResolvers = function <T>() {
    let resolve!: (value: T | PromiseLike<T>) => void;
    let reject!: (reason?: any) => void;
    const promise = new Promise<T>((res, rej) => {
      resolve = res;
      reject = rej;
    });
    return { promise, resolve, reject };
  };
}

if (typeof Math !== 'undefined' && !('sumPrecise' in Math)) {
  // @ts-ignore
  Math.sumPrecise = function (items: Iterable<number>) {
    let sum = 0;
    for (const item of items) {
      sum += Number(item) || 0;
    }
    return sum;
  };
}

import React, { useEffect, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';

// Configure the worker from public static directory for maximum stability
pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';

interface DocumentViewerProps {
  file: File | null;
  fileBlobUrl: string;
  fileUrl: string;
  fileName: string;
  fileSize: string;
  currentPage: number;
  totalPages: number;
  displayPageNumber?: number;
  displayTotalPages?: number;
  orientation: 'portrait' | 'landscape';
  zoomLevel: number;
  colorMode: 'bw' | 'color';
  onPagesDetected?: (pages: number) => void;
}

export const DocumentViewer: React.FC<DocumentViewerProps> = ({
  file,
  fileBlobUrl,
  fileUrl,
  fileName,
  fileSize,
  currentPage,
  totalPages,
  displayPageNumber,
  displayTotalPages,
  orientation,
  zoomLevel,
  colorMode,
  onPagesDetected,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [pdfLoading, setPdfLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [textContent, setTextContent] = useState<string | null>(null);
  const [docxHtml, setDocxHtml] = useState<string | null>(null);
  const renderTaskRef = useRef<any>(null);
  const onPagesDetectedRef = useRef(onPagesDetected);
  useEffect(() => {
    onPagesDetectedRef.current = onPagesDetected;
  }, [onPagesDetected]);

  const activeUrl = fileBlobUrl || fileUrl;
  const lowerName = (fileName || '').toLowerCase();
  const isImage = Boolean(
    file?.type?.startsWith('image/') ||
    lowerName.match(/\.(jpg|jpeg|png|webp|gif|svg|bmp)$/i)
  );
  const isPdf = Boolean(
    file?.type === 'application/pdf' ||
    lowerName.endsWith('.pdf')
  );
  const isTextDoc = Boolean(
    file?.type?.startsWith('text/') ||
    lowerName.match(/\.(txt|csv|md|json|log)$/i)
  );
  const isDocx = Boolean(
    file?.type?.includes('wordprocessingml') ||
    lowerName.endsWith('.docx')
  );

  // 1. Load PDF document (runs once per file)
  useEffect(() => {
    if (!isPdf) return;

    let isCancelled = false;
    setPdfLoading(true);
    setError(null);

    const loadPdf = async () => {
      try {
        const options: any = {
          cMapUrl: '/cmaps/',
          cMapPacked: true,
          standardFontDataUrl: '/standard_fonts/',
        };

        if (file) {
          const arrayBuffer = await file.arrayBuffer();
          if (isCancelled) return;
          options.data = new Uint8Array(arrayBuffer);
        } else if (activeUrl) {
          options.url = activeUrl;
        } else {
          setPdfLoading(false);
          return;
        }

        const loadingTask = pdfjsLib.getDocument(options);
        const doc = await loadingTask.promise;
        if (isCancelled) return;

        setPdfDoc(doc);
        setPdfLoading(false);
        if (onPagesDetectedRef.current && doc.numPages) {
          onPagesDetectedRef.current(doc.numPages);
        }
      } catch (err: any) {
        if (isCancelled) return;
        console.warn('PDF.js parse error, will use fallback:', err);
        setError(err.message || 'Failed to parse PDF document');
        setPdfLoading(false);
      }
    };

    loadPdf();

    return () => {
      isCancelled = true;
    };
  }, [file, activeUrl, isPdf]);

  // 2. Render PDF page to canvas
  useEffect(() => {
    if (!pdfDoc || !canvasRef.current) return;

    let isCancelled = false;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const renderPage = async () => {
      try {
        // Cancel any pending render task
        if (renderTaskRef.current) {
          try {
            renderTaskRef.current.cancel();
          } catch {
            // ignore
          }
          renderTaskRef.current = null;
        }

        const safePage = Math.min(Math.max(1, currentPage), pdfDoc.numPages);
        const page = await pdfDoc.getPage(safePage);
        if (isCancelled) return;

        // Calculate scale to fit comfortably in viewer card
        const unscaledViewport = page.getViewport({ scale: 1.0 });
        const isMobile = typeof window !== 'undefined' && window.innerWidth < 640;
        const isPortrait = orientation === 'portrait';

        // Target dimensions: Portrait mode should be wide and tall to look like a genuine A4 sheet
        const targetWidth = isPortrait
          ? (isMobile ? Math.min(340, Math.max(280, window.innerWidth - 48)) : 440)
          : (isMobile ? Math.min(360, Math.max(280, window.innerWidth - 32)) : 560);

        const baseScale = targetWidth / unscaledViewport.width;
        const cssScale = baseScale * (zoomLevel / 100);

        // Account for high-DPI displays
        const dpr = window.devicePixelRatio || 1;
        const viewport = page.getViewport({ scale: cssScale * dpr });

        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);
        canvas.style.width = `${Math.floor(viewport.width / dpr)}px`;
        canvas.style.height = `${Math.floor(viewport.height / dpr)}px`;

        if (typeof ctx.resetTransform === 'function') {
          ctx.resetTransform();
        } else {
          ctx.setTransform(1, 0, 0, 1, 0, 0);
        }

        // Fill background white
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        const renderContext = {
          canvasContext: ctx,
          viewport: viewport,
        };

        const renderTask = page.render(renderContext as any);
        renderTaskRef.current = renderTask;

        await renderTask.promise;
        renderTaskRef.current = null;
      } catch (err: any) {
        if (err?.name === 'RenderingCancelledException') {
          // Expected on rapid page flips
          return;
        }
        console.warn('Canvas render page error:', err);
        setError(err?.message || 'Failed to render PDF page on canvas');
      }
    };

    renderPage();

    return () => {
      isCancelled = true;
      if (renderTaskRef.current) {
        try {
          renderTaskRef.current.cancel();
        } catch {
          // ignore
        }
        renderTaskRef.current = null;
      }
    };
  }, [pdfDoc, currentPage, zoomLevel, orientation]);

  // 3. Handle Text Documents (.txt, .md, .csv)
  useEffect(() => {
    if (!isTextDoc || !file) return;

    let isCancelled = false;
    file.text().then((text) => {
      if (!isCancelled) {
        setTextContent(text.slice(0, 5000)); // preview up to 5000 chars
      }
    }).catch((err) => {
      console.warn('Text preview error:', err);
    });

    return () => {
      isCancelled = true;
    };
  }, [file, isTextDoc]);

  // 4. Handle Word Documents (.docx)
  useEffect(() => {
    if (!isDocx || !file) return;

    let isCancelled = false;
    const loadDocx = async () => {
      try {
        const mammoth = await import('mammoth');
        const buffer = await file.arrayBuffer();
        const result = await mammoth.convertToHtml({ arrayBuffer: buffer });
        if (!isCancelled) {
          setDocxHtml(result.value);
        }
      } catch (err) {
        console.warn('DOCX preview conversion fallback:', err);
      }
    };

    loadDocx();

    return () => {
      isCancelled = true;
    };
  }, [file, isDocx]);

  // Container dimensions: In portrait, provide ample vertical height so full A4 sheet fits naturally without clipping
  const containerClass =
    orientation === 'portrait'
      ? 'w-full max-w-[360px] sm:max-w-[480px] min-h-[460px] sm:min-h-[620px] h-auto'
      : 'w-full max-w-[380px] sm:max-w-[620px] min-h-[260px] sm:min-h-[400px] h-auto';

  return (
    <div
      className={`relative bg-surface-container-lowest rounded-2xl shadow-xl overflow-hidden border border-outline-variant/50 flex flex-col items-center justify-center transition-all duration-300 ${containerClass}`}
      style={{
        filter: colorMode === 'bw' ? 'grayscale(100%)' : 'none',
      }}
    >
      {/* 1. PDF Canvas View */}
      {isPdf && !error && (
        <div className="w-full h-full flex items-center justify-center p-2 sm:p-3 bg-slate-100/80 rounded-2xl">
          <canvas
            ref={canvasRef}
            className="rounded-lg shadow-md bg-white max-w-full block"
          />
        </div>
      )}

      {/* 2. Image View */}
      {isImage && activeUrl && (
        <div className="w-full h-full min-h-[420px] sm:min-h-[560px] p-2 flex items-center justify-center bg-surface-container-lowest overflow-hidden">
          <img
            src={activeUrl}
            alt={fileName}
            className="max-w-full max-h-full object-contain rounded-lg shadow-sm select-none"
          />
        </div>
      )}

      {/* 3. Word Document (.docx) Render */}
      {isDocx && docxHtml && (
        <div className="w-full h-full p-6 sm:p-8 bg-white overflow-auto text-left prose prose-sm max-w-none text-slate-800 font-serif leading-relaxed">
          <div
            dangerouslySetInnerHTML={{ __html: docxHtml }}
            className="document-docx-body"
          />
        </div>
      )}

      {/* 4. Text File Preview */}
      {isTextDoc && textContent && (
        <div className="w-full h-full p-6 bg-white overflow-auto text-left font-mono text-xs text-slate-800 leading-relaxed whitespace-pre-wrap">
          {textContent}
        </div>
      )}

      {/* 5. PDF Native Object Fallback (if canvas error occurred) */}
      {isPdf && error && activeUrl && (
        <div className="w-full h-full relative bg-white">
          <object
            data={activeUrl}
            type="application/pdf"
            className="w-full h-full border-0"
            title={fileName}
          >
            <div className="w-full h-full p-6 flex flex-col items-center justify-center text-center gap-2">
              <span className="material-symbols-outlined text-primary text-[40px]">picture_as_pdf</span>
              <span className="font-bold text-sm text-on-surface">{fileName}</span>
              <span className="text-xs text-on-surface-variant">Pre-Flight Verified • Ready to Print</span>
            </div>
          </object>
        </div>
      )}

      {/* 6. Pre-flight Document Card (Fallback or for binary doc types without direct HTML) */}
      {(!isImage && (!isPdf || (error && !activeUrl)) && (!isDocx || !docxHtml) && (!isTextDoc || !textContent)) && (
        <div className="w-full h-full p-6 sm:p-8 flex flex-col justify-between text-left bg-gradient-to-b from-white to-surface-container-lowest">
          <div className="flex items-center justify-between pb-3 border-b border-surface-container-high">
            <div className="flex flex-col">
              <span className="text-[11px] font-bold text-primary uppercase tracking-wider flex items-center gap-1">
                <span className="material-symbols-outlined text-[16px]">verified</span>
                Pre-Flight Verified
              </span>
              <span className="font-bold text-base text-on-surface truncate max-w-[260px]" title={fileName}>
                {fileName}
              </span>
            </div>
            <span className="text-xs font-mono text-on-surface-variant font-bold bg-surface-container px-2.5 py-1 rounded-lg">
              {fileSize}
            </span>
          </div>

          <div className="p-4 rounded-2xl bg-surface-container-low border border-surface-container flex flex-col gap-2.5 my-auto shadow-sm">
            <div className="flex items-center gap-2 text-primary font-bold text-sm">
              <span className="material-symbols-outlined text-[20px]">description</span>
              <span>Document Specifications</span>
            </div>
            <div className="flex justify-between text-xs text-on-surface-variant pt-1 border-t border-surface-container-high">
              <span>Layout Orientation:</span>
              <span className="font-bold text-on-surface capitalize">{orientation}</span>
            </div>
            <div className="flex justify-between text-xs text-on-surface-variant">
              <span>Print Page:</span>
              <span className="font-bold text-primary">
                Page {displayPageNumber || currentPage} of {displayTotalPages || totalPages}
                {displayTotalPages && displayTotalPages !== totalPages ? ` (Doc Page ${currentPage})` : ''}
              </span>
            </div>
            <div className="flex justify-between text-xs text-on-surface-variant">
              <span>Color Profile:</span>
              <span className="font-semibold text-on-surface">{colorMode === 'bw' ? 'B&W Mono Laser' : 'Full CMYK Color'}</span>
            </div>
            <div className="flex justify-between text-xs text-on-surface-variant">
              <span>Raster Mode:</span>
              <span className="font-mono text-[11px] font-bold text-emerald-700">600 DPI Direct-to-Engine</span>
            </div>
          </div>

          <div className="pt-3 flex items-center justify-between border-t border-surface-container-high text-xs text-on-surface-variant">
            <span className="flex items-center gap-1 font-semibold text-emerald-700">
              <span className="material-symbols-outlined text-[16px]">check_circle</span> Ready to Print
            </span>
            <span className="font-mono text-[11px]">A4 Standard</span>
          </div>
        </div>
      )}

      {/* Brief Loading State Only When PDF Is Initially Parsing and Canvas Not Yet Mounted */}
      {isPdf && pdfLoading && !pdfDoc && !error && (
        <div className="absolute inset-0 bg-surface-container-lowest/80 backdrop-blur-xs flex flex-col items-center justify-center gap-2 z-20">
          <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin"></div>
          <span className="text-xs font-semibold text-on-surface-variant">
            Loading document...
          </span>
        </div>
      )}
    </div>
  );
};
