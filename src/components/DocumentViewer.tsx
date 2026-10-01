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
import { useKiosk } from '../context/KioskContext';

// Configure worker from public static directory for maximum stability
pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';

export interface DocumentViewerProps {
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
  zoomLevel?: number;
  colorMode: 'bw' | 'color';
  onPagesDetected?: (pages: number) => void;
  manualRotation?: number;
  onRotate?: () => void;
  isCompact?: boolean;
  showRotateButton?: boolean;
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
  zoomLevel = 100,
  colorMode,
  onPagesDetected,
  manualRotation,
  onRotate,
  isCompact = false,
  showRotateButton = true,
}) => {
  const kiosk = useKiosk();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [pdfLoading, setPdfLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [textContent, setTextContent] = useState<string | null>(null);
  const [docxHtml, setDocxHtml] = useState<string | null>(null);
  const renderTaskRef = useRef<any>(null);
  const onPagesDetectedRef = useRef(onPagesDetected);

  // Rotation resolution: either from props or from KioskContext
  const activeRotation = manualRotation !== undefined ? manualRotation : (kiosk?.contentRotation || 0);
  const handleRotate = onRotate || kiosk?.rotateContent90;

  useEffect(() => {
    onPagesDetectedRef.current = onPagesDetected;
  }, [onPagesDetected]);

  const activeUrl = fileBlobUrl || fileUrl;
  const lowerName = (fileName || '').toLowerCase();
  const isImage = Boolean(
    file?.type?.startsWith('image/') ||
    lowerName.match(/\.(jpg|jpeg|png|webp|gif|svg|bmp|tiff)$/i)
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

  // 1. Load PDF document
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
        console.warn('PDF.js parse error:', err);
        setError(err.message || 'Failed to parse PDF document');
        setPdfLoading(false);
      }
    };

    loadPdf();

    return () => {
      isCancelled = true;
    };
  }, [file, activeUrl, isPdf]);

  // 2. Render PDF page to canvas with exact orientation and rotation
  useEffect(() => {
    if (!pdfDoc || !canvasRef.current) return;

    let isCancelled = false;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const renderPage = async () => {
      try {
        if (renderTaskRef.current) {
          try {
            renderTaskRef.current.cancel();
          } catch {}
          renderTaskRef.current = null;
        }

        const safePage = Math.min(Math.max(1, currentPage), pdfDoc.numPages);
        const page = await pdfDoc.getPage(safePage);
        if (isCancelled) return;

        // Determine natural PDF rotation
        const nativeRotate = page.rotate || 0;
        const nativeViewport = page.getViewport({ scale: 1.0, rotation: nativeRotate });
        const isNaturallyPortrait = nativeViewport.width <= nativeViewport.height;

        // Auto-rotation to match paper orientation
        let autoRotate = nativeRotate;
        if (orientation === 'landscape' && isNaturallyPortrait) {
          autoRotate = (nativeRotate + 90) % 360;
        } else if (orientation === 'portrait' && !isNaturallyPortrait) {
          autoRotate = (nativeRotate + 90) % 360;
        }

        // Combine with manual rotation (if user tapped rotate 90°)
        const effectiveRotation = (autoRotate + (activeRotation || 0)) % 360;
        const unscaled = page.getViewport({ scale: 1.0, rotation: effectiveRotation });

        const isMobile = typeof window !== 'undefined' && window.innerWidth < 640;
        const isPortrait = orientation === 'portrait';

        // Target sheet printable bounds
        let printableW: number;
        let printableH: number;

        if (isPortrait) {
          const sheetW = isCompact
            ? (isMobile ? 200 : 230)
            : (isMobile ? Math.min(270, window.innerWidth - 64) : 360);
          const sheetH = sheetW * (297 / 210);
          printableW = sheetW * 0.90;
          printableH = sheetH * 0.90;
        } else {
          const sheetW = isCompact
            ? (isMobile ? 260 : 290)
            : (isMobile ? Math.min(330, window.innerWidth - 48) : 500);
          const sheetH = sheetW * (210 / 297);
          printableW = sheetW * 0.90;
          printableH = sheetH * 0.90;
        }

        const scale = Math.min(printableW / unscaled.width, printableH / unscaled.height) * ((zoomLevel || 100) / 100);
        const dpr = window.devicePixelRatio || 1;
        const viewport = page.getViewport({ scale: scale * dpr, rotation: effectiveRotation });

        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);
        canvas.style.width = `${Math.floor(viewport.width / dpr)}px`;
        canvas.style.height = `${Math.floor(viewport.height / dpr)}px`;

        if (typeof ctx.resetTransform === 'function') {
          ctx.resetTransform();
        } else {
          ctx.setTransform(1, 0, 0, 1, 0, 0);
        }

        // Clean white paper background
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        const renderTask = page.render({
          canvasContext: ctx,
          viewport,
        } as any);
        renderTaskRef.current = renderTask;

        await renderTask.promise;
        renderTaskRef.current = null;
      } catch (err: any) {
        if (err?.name === 'RenderingCancelledException') return;
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
        } catch {}
        renderTaskRef.current = null;
      }
    };
  }, [pdfDoc, currentPage, zoomLevel, orientation, activeRotation, isCompact]);

  // 3. Handle Text Documents (.txt, .md, .csv)
  useEffect(() => {
    if (!isTextDoc || !file) return;

    let isCancelled = false;
    file.text().then((text) => {
      if (!isCancelled) {
        setTextContent(text.slice(0, 5000));
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

  // Responsive Paper Sheet Dimensions (Strictly A4 210mm x 297mm aspect ratio)
  // Portrait: 210/297 (0.707)
  // Landscape: 297/210 (1.414)
  const isPortrait = orientation === 'portrait';
  const paperSheetClasses = isPortrait
    ? isCompact
      ? 'w-full max-w-[210px] sm:max-w-[240px] aspect-[210/297]'
      : 'w-full max-w-[280px] sm:max-w-[340px] md:max-w-[380px] aspect-[210/297]'
    : isCompact
      ? 'w-full max-w-[270px] sm:max-w-[300px] aspect-[297/210]'
      : 'w-full max-w-[340px] sm:max-w-[460px] md:max-w-[520px] aspect-[297/210]';

  return (
    <div className="w-full flex flex-col items-center">
      {/* 1. Header Toolbar with Sheet Info and Quick Rotate */}
      <div className="w-full flex items-center justify-between gap-2 px-2 py-1 mb-2 text-xs">
        <div className="flex items-center gap-1.5 font-bold text-on-surface">
          <span className="material-symbols-outlined text-[16px] text-primary">
            {isPortrait ? 'crop_portrait' : 'crop_landscape'}
          </span>
          <span className="font-mono text-[11px] sm:text-xs">
            A4 • {orientation.toUpperCase()} {isPortrait ? '(210 × 297mm)' : '(297 × 210mm)'}
          </span>
          <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-surface-container text-on-surface-variant">
            {colorMode === 'bw' ? 'B&W Mono' : 'Full Color'}
          </span>
        </div>

        {showRotateButton && handleRotate && (
          <button
            type="button"
            onClick={handleRotate}
            className="px-2 py-1 rounded-lg bg-surface-container hover:bg-surface-container-high text-primary hover:text-primary/90 text-xs font-semibold flex items-center gap-1 cursor-pointer transition-all shadow-xs shrink-0"
            title="Rotate Page / Photo by 90°"
          >
            <span className="material-symbols-outlined text-[16px]">rotate_right</span>
            <span className="hidden sm:inline">Rotate 90°</span>
            {activeRotation > 0 && (
              <span className="text-[10px] font-mono font-bold text-tertiary">
                ({activeRotation}°)
              </span>
            )}
          </button>
        )}
      </div>

      {/* 2. Physical A4 Sheet Container with Paper Shadow and Margins */}
      <div className="relative w-full flex items-center justify-center p-2 sm:p-4 bg-slate-200/60 dark:bg-slate-800/40 rounded-2xl border border-slate-300/60">
        <div
          className={`relative bg-white text-slate-900 rounded-xs shadow-[0_12px_36px_rgba(0,0,0,0.18),0_2px_8px_rgba(0,0,0,0.08)] border border-slate-200 overflow-hidden flex items-center justify-center transition-all duration-300 ease-out select-none ${paperSheetClasses}`}
        >
          {/* Subtle Printable Margin Guidelines (Representing 0.5 inch / 12.7mm laser margin) */}
          <div className="absolute inset-[4%] sm:inset-[5%] border border-dashed border-slate-300/70 pointer-events-none rounded-xs flex items-end justify-end p-1 z-10">
            <span className="text-[8px] font-mono text-slate-400 select-none uppercase tracking-wider hidden sm:inline">
              Print Margin (Canon LBP2900)
            </span>
          </div>

          {/* 1. PDF Canvas View */}
          {isPdf && !error && (
            <div
              className="w-full h-full flex items-center justify-center overflow-hidden"
              style={{
                filter: colorMode === 'bw' ? 'grayscale(100%) contrast(105%)' : 'none',
              }}
            >
              <canvas
                ref={canvasRef}
                className="max-w-full max-h-full block shadow-xs transition-transform duration-300"
              />
            </div>
          )}

          {/* 2. Image / Photo View (Rotates with A4 Sheet & Scales Proportionally) */}
          {isImage && activeUrl && (
            <div className="w-full h-full p-2.5 sm:p-4 flex items-center justify-center relative overflow-hidden">
              <img
                src={activeUrl}
                alt={fileName}
                style={{
                  transform: `rotate(${activeRotation || 0}deg)`,
                  filter: colorMode === 'bw' ? 'grayscale(100%) contrast(105%)' : 'none',
                  maxWidth: '92%',
                  maxHeight: '92%',
                }}
                className="object-contain select-none transition-transform duration-300 drop-shadow-xs"
              />
            </div>
          )}

          {/* 3. Word Document (.docx) Render */}
          {isDocx && docxHtml && (
            <div
              className="w-full h-full p-4 sm:p-6 bg-white overflow-auto text-left prose prose-xs max-w-none text-slate-800 font-serif leading-relaxed"
              style={{
                filter: colorMode === 'bw' ? 'grayscale(100%) contrast(105%)' : 'none',
              }}
            >
              <div
                dangerouslySetInnerHTML={{ __html: docxHtml }}
                className="document-docx-body"
              />
            </div>
          )}

          {/* 4. Text File Preview */}
          {isTextDoc && textContent && (
            <div
              className="w-full h-full p-4 sm:p-6 bg-white overflow-auto text-left font-mono text-[10px] sm:text-xs text-slate-800 leading-relaxed whitespace-pre-wrap"
              style={{
                filter: colorMode === 'bw' ? 'grayscale(100%) contrast(105%)' : 'none',
              }}
            >
              {textContent}
            </div>
          )}

          {/* 5. PDF Native Object Fallback (if canvas render encountered error) */}
          {isPdf && error && activeUrl && (
            <div className="w-full h-full relative bg-white">
              <object
                data={activeUrl}
                type="application/pdf"
                className="w-full h-full border-0"
                title={fileName}
              >
                <div className="w-full h-full p-4 flex flex-col items-center justify-center text-center gap-2">
                  <span className="material-symbols-outlined text-primary text-[36px]">picture_as_pdf</span>
                  <span className="font-bold text-xs text-slate-800">{fileName}</span>
                  <span className="text-[10px] text-slate-500">A4 PDF Preview Ready</span>
                </div>
              </object>
            </div>
          )}

          {/* 6. Pre-flight Fallback Card (for rare unsupported binary doc types) */}
          {(!isImage && (!isPdf || (error && !activeUrl)) && (!isDocx || !docxHtml) && (!isTextDoc || !textContent)) && (
            <div className="w-full h-full p-4 sm:p-6 flex flex-col justify-between text-left bg-gradient-to-b from-white to-slate-50">
              <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                <span className="text-[10px] font-bold text-primary uppercase tracking-wider flex items-center gap-1">
                  <span className="material-symbols-outlined text-[14px]">verified</span>
                  Verified Print Job
                </span>
                <span className="text-[10px] font-mono text-slate-600 font-bold bg-slate-100 px-2 py-0.5 rounded">
                  {fileSize}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-slate-100/80 border border-slate-200 flex flex-col gap-1.5 my-auto text-xs">
                <span className="font-bold text-slate-900 truncate">{fileName}</span>
                <div className="flex justify-between text-slate-600 text-[11px] pt-1 border-t border-slate-200">
                  <span>Layout Orientation:</span>
                  <span className="font-bold text-slate-900 capitalize">{orientation}</span>
                </div>
                <div className="flex justify-between text-slate-600 text-[11px]">
                  <span>Page:</span>
                  <span className="font-bold text-primary">
                    {displayPageNumber || currentPage} of {displayTotalPages || totalPages}
                  </span>
                </div>
                <div className="flex justify-between text-slate-600 text-[11px]">
                  <span>Color Profile:</span>
                  <span className="font-semibold text-slate-900">{colorMode === 'bw' ? 'B&W 600 DPI' : 'Full Color'}</span>
                </div>
              </div>

              <div className="pt-2 flex items-center justify-between border-t border-slate-200 text-[11px] text-slate-500">
                <span className="flex items-center gap-1 font-semibold text-emerald-700">
                  <span className="material-symbols-outlined text-[14px]">check_circle</span> Ready to Print
                </span>
                <span className="font-mono text-[10px]">A4 Standard</span>
              </div>
            </div>
          )}

          {/* Loading Overlay */}
          {isPdf && pdfLoading && !pdfDoc && !error && (
            <div className="absolute inset-0 bg-white/80 backdrop-blur-xs flex flex-col items-center justify-center gap-2 z-20">
              <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin"></div>
              <span className="text-xs font-semibold text-slate-600">
                Rendering A4 preview...
              </span>
            </div>
          )}
        </div>
      </div>

      {/* 3. WYSIWYG Printout Guarantee Stamp */}
      <div className="w-full flex items-center justify-center gap-1.5 mt-2 text-[11px] text-on-surface-variant font-medium">
        <span className="material-symbols-outlined text-[14px] text-emerald-600">verified</span>
        <span>Physical Print Simulation • Exactly as it emerges from Canon LBP2900</span>
      </div>
    </div>
  );
};
