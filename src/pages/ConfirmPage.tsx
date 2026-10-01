import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useKiosk } from '../context/KioskContext';
import { DocumentViewer } from '../components/DocumentViewer';

export const ConfirmPage: React.FC = () => {
  const navigate = useNavigate();
  const {
    file,
    fileUrl,
    fileBlobUrl,
    fileName,
    fileSize,
    totalPages,
    setTotalPages,
    orientation,
    setOrientation,
    pageSelectionMode,
    setPageSelectionMode,
    customPageRange,
    setCustomPageRange,
    effectivePages,
    selectedPagesList,
    colorMode,
    setColorMode,
    copies,
    setCopies,
    isDuplex,
    setIsDuplex,
    ratePerPage,
    totalPrice,
  } = useKiosk();

  // Redirect to upload if user navigates here without a document
  useEffect(() => {
    if (!fileName || totalPages === 0) {
      navigate('/upload', { replace: true });
    }
  }, [fileName, totalPages, navigate]);

  // Safeguard: single-page documents must always be 'all' pages and single-sided
  useEffect(() => {
    if (totalPages <= 1) {
      if (pageSelectionMode !== 'all') {
        setPageSelectionMode('all');
      }
      if (isDuplex) {
        setIsDuplex(false);
      }
    }
  }, [totalPages, pageSelectionMode, isDuplex, setPageSelectionMode, setIsDuplex]);

  // 0-based index within selectedPagesList
  const [selectedPageIndex, setSelectedPageIndex] = useState<number>(0);
  const [zoomLevel] = useState<number>(100);

  const previewTotalPages = Math.max(1, selectedPagesList.length);
  const safePageIndex = Math.min(
    Math.max(0, selectedPageIndex),
    previewTotalPages - 1
  );
  const currentDocPage = selectedPagesList[safePageIndex] || 1;

  const isImage = Boolean(file?.type?.startsWith('image/') || fileName.match(/\.(jpg|jpeg|png|webp)$/i));
  const isPdf = Boolean(file?.type?.includes('pdf') || fileName.toLowerCase().endsWith('.pdf'));

  const handlePagesDetected = useCallback((detected: number) => {
    if (detected > 0 && detected !== totalPages) {
      setTotalPages(detected);
    }
  }, [totalPages, setTotalPages]);

  const handlePrevPage = () => {
    setSelectedPageIndex((i) => Math.max(0, Math.min(i, previewTotalPages - 1) - 1));
  };

  const handleNextPage = () => {
    setSelectedPageIndex((i) => Math.min(previewTotalPages - 1, Math.min(i, previewTotalPages - 1) + 1));
  };

  const handleProceed = () => {
    navigate('/payment');
  };

  return (
    <div className="w-full min-h-[calc(100dvh-3.5rem)] pt-14 sm:pt-16 pb-28 sm:pb-32 bg-surface flex flex-col select-none">
      <div className="w-full max-w-7xl mx-auto px-3 sm:px-6 lg:px-margin-kiosk py-2 sm:py-space-sm flex flex-col flex-1">
        {/* Top Header Bar (Compact on mobile) */}
        <div className="flex items-center justify-between gap-2 mb-2 sm:mb-space-sm">
          <div className="flex items-center gap-2 text-left min-w-0">
            <span className="material-symbols-outlined text-primary text-[20px] shrink-0">
              {isPdf ? 'picture_as_pdf' : isImage ? 'image' : 'description'}
            </span>
            <div className="flex flex-col min-w-0">
              <span className="text-xs sm:text-sm font-bold text-on-surface truncate max-w-[180px] sm:max-w-xs" title={fileName}>
                {fileName || 'Document'}
              </span>
              <span className="text-[10px] sm:text-xs text-on-surface-variant leading-tight">
                {totalPages} {totalPages === 1 ? 'Page' : 'Pages'} • {fileSize}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => navigate('/upload')}
            className="px-2.5 sm:px-3 py-1.5 rounded-xl bg-surface-container hover:bg-surface-container-high text-on-surface text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer shrink-0 shadow-sm"
          >
            <span className="material-symbols-outlined text-[16px]">sync</span>
            <span>Change File</span>
          </button>
        </div>

        {/* Main Workspace: Preview + Customization Controls */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 lg:gap-gutter-kiosk items-start flex-1">
          {/* PREVIEW CONTAINER (Sized to cover more screen with genuine portrait proportions) */}
          <div className="lg:col-span-6 xl:col-span-7 flex flex-col items-center">
            <div className="relative w-full bg-surface-container-low rounded-2xl p-2 sm:p-4 shadow-sm border border-surface-container-high flex flex-col items-center">
              {/* Central Canvas Preview */}
              <div className="w-full flex items-center justify-center py-1">
                <DocumentViewer
                  file={file}
                  fileBlobUrl={fileBlobUrl}
                  fileUrl={fileUrl}
                  fileName={fileName}
                  fileSize={fileSize}
                  currentPage={currentDocPage}
                  totalPages={totalPages}
                  displayPageNumber={safePageIndex + 1}
                  displayTotalPages={previewTotalPages}
                  orientation={orientation}
                  zoomLevel={zoomLevel}
                  colorMode={colorMode}
                  onPagesDetected={handlePagesDetected}
                />
              </div>

              {/* Compact Inline Pagination Bar */}
              <div className="w-full max-w-sm flex items-center justify-between gap-2 px-3 py-1.5 mt-2 bg-surface-container-lowest rounded-xl shadow-xs border border-surface-container-high text-xs font-semibold">
                <button
                  type="button"
                  disabled={safePageIndex <= 0}
                  onClick={handlePrevPage}
                  className="px-2.5 py-1 rounded-lg hover:bg-surface-container disabled:opacity-30 disabled:pointer-events-none flex items-center gap-0.5 cursor-pointer text-on-surface"
                >
                  <span className="material-symbols-outlined text-[16px]">chevron_left</span>
                  <span>Prev</span>
                </button>

                <div className="flex items-center gap-1 font-mono font-bold text-on-surface text-xs">
                  <span>Page {safePageIndex + 1} of {previewTotalPages}</span>
                  {pageSelectionMode === 'custom' && (
                    <span className="text-[10px] text-primary font-normal">
                      (Doc P{currentDocPage})
                    </span>
                  )}
                </div>

                <button
                  type="button"
                  disabled={safePageIndex >= previewTotalPages - 1}
                  onClick={handleNextPage}
                  className="px-2.5 py-1 rounded-lg hover:bg-surface-container disabled:opacity-30 disabled:pointer-events-none flex items-center gap-0.5 cursor-pointer text-on-surface"
                >
                  <span>Next</span>
                  <span className="material-symbols-outlined text-[16px]">chevron_right</span>
                </button>
              </div>
            </div>
          </div>

          {/* CUSTOMIZE OPTIONS PANEL (Scrollable below preview on mobile) */}
          <div className="lg:col-span-6 xl:col-span-5 flex flex-col gap-2.5 sm:gap-3 text-left">
            <div className="w-full bg-surface-container-lowest p-3.5 sm:p-5 rounded-2xl shadow-sm border border-surface-container-high flex flex-col gap-3">
              {/* Section Header */}
              <div className="flex items-center justify-between pb-2 border-b border-surface-container-high">
                <div className="flex items-center gap-1.5 text-primary font-bold text-xs uppercase tracking-wider">
                  <span className="material-symbols-outlined text-[16px]">tune</span>
                  <span>Print Customization</span>
                </div>
                <span className="text-[11px] text-on-surface-variant font-medium">
                  Scroll for options
                </span>
              </div>
              {/* Row 1: Color Mode & Orientation (Aligned side-by-side) */}
              <div className="grid grid-cols-2 gap-2">
                {/* Color Mode */}
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-on-surface-variant flex items-center gap-1">
                    <span className="material-symbols-outlined text-[14px] text-primary">palette</span>
                    <span>Color Mode</span>
                  </span>
                  <div className="grid grid-cols-2 gap-1.5 bg-surface-container-low p-1 rounded-xl">
                    <button
                      type="button"
                      onClick={() => setColorMode('bw')}
                      className={`py-1.5 px-2 rounded-lg text-xs font-bold transition-all cursor-pointer text-center ${
                        colorMode === 'bw'
                          ? 'bg-primary text-on-primary shadow-xs'
                          : 'text-on-surface hover:bg-surface-container'
                      }`}
                    >
                      B&amp;W ₹2
                    </button>
                    <button
                      type="button"
                      onClick={() => setColorMode('color')}
                      className={`py-1.5 px-2 rounded-lg text-xs font-bold transition-all cursor-pointer text-center ${
                        colorMode === 'color'
                          ? 'bg-primary text-on-primary shadow-xs'
                          : 'text-on-surface hover:bg-surface-container'
                      }`}
                    >
                      Color ₹10
                    </button>
                  </div>
                </div>

                {/* Orientation */}
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-on-surface-variant flex items-center gap-1">
                    <span className="material-symbols-outlined text-[14px] text-primary">screen_rotation</span>
                    <span>Orientation</span>
                  </span>
                  <div className="grid grid-cols-2 gap-1.5 bg-surface-container-low p-1 rounded-xl">
                    <button
                      type="button"
                      onClick={() => setOrientation('portrait')}
                      className={`py-1.5 px-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1 ${
                        orientation === 'portrait'
                          ? 'bg-primary text-on-primary shadow-xs'
                          : 'text-on-surface hover:bg-surface-container'
                      }`}
                    >
                      <span className="material-symbols-outlined text-[14px]">crop_portrait</span>
                      <span>Portrait</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setOrientation('landscape')}
                      className={`py-1.5 px-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1 ${
                        orientation === 'landscape'
                          ? 'bg-primary text-on-primary shadow-xs'
                          : 'text-on-surface hover:bg-surface-container'
                      }`}
                    >
                      <span className="material-symbols-outlined text-[14px]">crop_landscape</span>
                      <span>Land</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Row 2: Copies & Print Sides (Aligned side-by-side) */}
              <div className="grid grid-cols-2 gap-2">
                {/* Copies Stepper */}
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-on-surface-variant flex items-center gap-1">
                    <span className="material-symbols-outlined text-[14px] text-primary">content_copy</span>
                    <span>Copies</span>
                  </span>
                  <div className="flex items-center justify-between bg-surface-container-low p-1 rounded-xl">
                    <button
                      type="button"
                      onClick={() => setCopies(Math.max(1, copies - 1))}
                      disabled={copies <= 1}
                      className="w-8 h-8 rounded-lg bg-surface-container hover:bg-surface-container-high disabled:opacity-30 disabled:pointer-events-none flex items-center justify-center font-bold text-on-surface cursor-pointer active:scale-95"
                    >
                      -
                    </button>
                    <span className="font-mono font-bold text-sm text-on-surface">
                      {copies}
                    </span>
                    <button
                      type="button"
                      onClick={() => setCopies(Math.min(50, copies + 1))}
                      className="w-8 h-8 rounded-lg bg-surface-container hover:bg-surface-container-high flex items-center justify-center font-bold text-on-surface cursor-pointer active:scale-95"
                    >
                      +
                    </button>
                  </div>
                </div>

                {/* Print Sides (Duplex) */}
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-on-surface-variant flex items-center gap-1">
                    <span className="material-symbols-outlined text-[14px] text-primary">auto_stories</span>
                    <span>Sides</span>
                  </span>
                  <div className="grid grid-cols-2 gap-1.5 bg-surface-container-low p-1 rounded-xl">
                    <button
                      type="button"
                      onClick={() => setIsDuplex(false)}
                      className={`py-1.5 px-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer text-center ${
                        !isDuplex
                          ? 'bg-primary text-on-primary shadow-xs'
                          : 'text-on-surface hover:bg-surface-container'
                      }`}
                    >
                      1-Sided
                    </button>
                    <button
                      type="button"
                      disabled={totalPages <= 1}
                      onClick={() => setIsDuplex(true)}
                      className={`py-1.5 px-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer text-center ${
                        isDuplex
                          ? 'bg-primary text-on-primary shadow-xs'
                          : totalPages <= 1
                          ? 'opacity-40 cursor-not-allowed text-outline'
                          : 'text-on-surface hover:bg-surface-container'
                      }`}
                      title={totalPages <= 1 ? 'Disabled for 1 page document' : 'Print double sided'}
                    >
                      2-Sided
                    </button>
                  </div>
                </div>
              </div>

              {/* Row 3: Pages to Print (All vs Custom) */}
              <div className="flex flex-col gap-1.5 pt-1 border-t border-surface-container-high">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-on-surface-variant flex items-center gap-1">
                    <span className="material-symbols-outlined text-[14px] text-primary">filter_frames</span>
                    <span>Pages to Print</span>
                  </span>
                  <span className="text-[11px] font-bold text-primary">
                    {effectivePages} of {totalPages} Pages Selected
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setPageSelectionMode('all')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 border ${
                      pageSelectionMode === 'all'
                        ? 'border-primary bg-primary text-on-primary shadow-xs'
                        : 'border-surface-container-high bg-surface-container-low text-on-surface hover:bg-surface-container'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[16px]">select_all</span>
                    <span>All ({totalPages})</span>
                  </button>

                  <button
                    type="button"
                    disabled={totalPages <= 1}
                    onClick={() => {
                      if (totalPages > 1) {
                        setPageSelectionMode('custom');
                        if (!customPageRange) {
                          setCustomPageRange(`1-${Math.min(3, totalPages)}`);
                        }
                      }
                    }}
                    className={`py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 border ${
                      totalPages <= 1
                        ? 'border-surface-container-high opacity-40 cursor-not-allowed text-outline'
                        : pageSelectionMode === 'custom'
                        ? 'border-primary bg-primary text-on-primary shadow-xs'
                        : 'border-surface-container-high bg-surface-container-low text-on-surface hover:bg-surface-container'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[16px]">edit_note</span>
                    <span>Custom Range</span>
                  </button>
                </div>

                {/* Inline Custom Range Input (when custom mode active) */}
                {pageSelectionMode === 'custom' && totalPages > 1 && (
                  <div className="flex flex-col gap-1.5 p-2 rounded-xl bg-surface-container-low border border-primary/20 animate-in fade-in duration-150">
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={customPageRange}
                        onChange={(e) => setCustomPageRange(e.target.value)}
                        placeholder="e.g. 1-3, 5"
                        className="h-9 flex-1 px-3 rounded-lg bg-surface-container-lowest border border-outline-variant text-on-surface font-mono text-xs font-bold focus:outline-none focus:border-primary"
                      />
                      <span className="text-[11px] font-bold text-primary shrink-0 px-2 py-1 rounded bg-primary/10">
                        {effectivePages} pgs
                      </span>
                    </div>

                    {/* Quick Presets */}
                    <div className="flex items-center gap-1.5 overflow-x-auto text-[10px]">
                      <span className="text-on-surface-variant font-medium">Quick:</span>
                      {totalPages >= 3 && (
                        <button
                          type="button"
                          onClick={() => setCustomPageRange('1-3')}
                          className="px-2 py-0.5 rounded bg-surface-container hover:bg-primary/20 font-mono font-bold cursor-pointer"
                        >
                          1-3
                        </button>
                      )}
                      {totalPages >= 3 && (
                        <button
                          type="button"
                          onClick={() => setCustomPageRange('3')}
                          className="px-2 py-0.5 rounded bg-surface-container hover:bg-primary/20 font-mono font-bold cursor-pointer"
                        >
                          Page 3
                        </button>
                      )}
                      {totalPages >= 5 && (
                        <button
                          type="button"
                          onClick={() => setCustomPageRange('1,3,5')}
                          className="px-2 py-0.5 rounded bg-surface-container hover:bg-primary/20 font-mono font-bold cursor-pointer"
                        >
                          1,3,5
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Direct In-Panel Pay & Proceed Action (Guaranteed visible in laptop & desktop mode) */}
              <div className="pt-3 border-t border-surface-container-high flex flex-col gap-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex flex-col">
                    <span className="text-[10px] sm:text-xs font-bold text-on-surface-variant uppercase tracking-wider">
                      Total Payable
                    </span>
                    <span className="text-xs text-on-surface-variant">
                      {effectivePages} pgs × {copies} {copies === 1 ? 'copy' : 'copies'} @ ₹{ratePerPage}
                    </span>
                  </div>
                  <span className="text-2xl font-black text-primary font-mono tracking-tight">
                    ₹{totalPrice}.00
                  </span>
                </div>

                <button
                  type="button"
                  id="confirm-panel-proceed-btn"
                  onClick={handleProceed}
                  className="w-full h-12 sm:h-13 rounded-xl sm:rounded-2xl bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-700 hover:from-blue-500 hover:to-indigo-600 text-white font-bold text-sm sm:text-base flex items-center justify-center gap-2 shadow-lg shadow-blue-500/25 active:scale-95 transition-all cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[20px]">lock</span>
                  <span>Proceed to Pay ₹{totalPrice}.00</span>
                  <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                </button>

                <div className="flex items-center justify-center gap-1.5 text-[11px] text-on-surface-variant">
                  <span className="material-symbols-outlined text-[14px] text-emerald-600">verified</span>
                  <span>Direct-to-Printer Spooling • Canon LBP2900</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* STICKY BOTTOM ACTION & PRICE BAR (Always fully visible on all screen sizes, z-50 above everything) */}
      <div className="fixed bottom-0 inset-x-0 z-50 bg-surface-container-lowest border-t border-surface-container-high shadow-2xl px-3 sm:px-6 py-2.5 sm:py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
          {/* Price Breakdown */}
          <div className="flex flex-col text-left">
            <span className="text-[10px] sm:text-xs font-bold text-on-surface-variant uppercase tracking-wider">
              Total Payable
            </span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-xl sm:text-2xl font-black text-primary font-mono tracking-tight">
                ₹{totalPrice}.00
              </span>
              <span className="hidden sm:inline text-[11px] text-on-surface-variant">
                ({effectivePages} pgs × {copies} {copies === 1 ? 'copy' : 'copies'} @ ₹{ratePerPage})
              </span>
            </div>
          </div>

          {/* Primary Action Button */}
          <button
            type="button"
            id="confirm-bottom-proceed-btn"
            onClick={handleProceed}
            className="h-12 sm:h-13 px-5 sm:px-8 rounded-xl sm:rounded-2xl bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-700 hover:from-blue-500 hover:to-indigo-600 text-white font-bold text-sm sm:text-base flex items-center gap-2 shadow-lg shadow-blue-500/25 active:scale-95 transition-all cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">lock</span>
            <span>Proceed to Pay ₹{totalPrice}.00</span>
            <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
          </button>
        </div>
      </div>
    </div>
  );
};
