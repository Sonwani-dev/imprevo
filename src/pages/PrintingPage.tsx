import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useKiosk } from '../context/KioskContext';
import { api } from '../services/api';

export const PrintingPage: React.FC = () => {
  const navigate = useNavigate();
  const {
    fileName,
    totalPages,
    effectivePages,
    selectedPagesList,
    pageSelectionMode,
    totalPrice,
    orderId,
    colorMode,
    orientation,
    copies,
    isDuplex,
    simulateFinishPrinting,
  } = useKiosk();

  // Number of pages = finalize number of pages * number of copies
  const docPages = effectivePages || totalPages || 1;
  const initialTargetPages = docPages * Math.max(1, copies || 1);

  // Real-time backend print execution states
  const [livePrintStatus, setLivePrintStatus] = useState<'queued' | 'printing' | 'completed'>('queued');
  const [targetPages, setTargetPages] = useState<number>(initialTargetPages);
  const [liveCurrentPage, setLiveCurrentPage] = useState<number>(1);
  const [liveProgress, setLiveProgress] = useState<number>(0);
  const [isFinishing, setIsFinishing] = useState<boolean>(false);
  const redirectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Poll backend for real-time printer connection & page progress
  useEffect(() => {
    let isMounted = true;

    const pollStatus = async () => {
      if (!orderId) return;

      try {
        const res = await api.getOrder(orderId);
        if (!isMounted || !res.success || !res.order) return;

        const order = res.order;
        const status = order.print_status;
        const total = Math.max(1, Number(order.total_pages) || initialTargetPages);
        const page = Math.max(1, Number(order.current_page_printing) || 1);
        const progress = Math.max(0, Math.min(100, Number(order.print_progress) || 0));

        setTargetPages(total);

        if (status === 'queued') {
          setLivePrintStatus('queued');
          setLiveCurrentPage(page);
          setLiveProgress(progress > 0 ? progress : 5);
        } else if (status === 'printing') {
          setLivePrintStatus('printing');
          setLiveCurrentPage(page);
          setLiveProgress(progress);
        } else if (status === 'completed') {
          setLivePrintStatus('completed');
          setLiveCurrentPage(total);
          setLiveProgress(100);

          if (!redirectTimerRef.current) {
            redirectTimerRef.current = setTimeout(() => {
              navigate('/complete');
            }, 1200);
          }
        }
      } catch (err) {
        console.warn('Real-time printer poll warning:', err);
      }
    };

    // Initial check immediately
    pollStatus();

    // Poll every 1000ms for responsive real-time feedback
    const interval = setInterval(pollStatus, 1000);

    return () => {
      isMounted = false;
      clearInterval(interval);
      if (redirectTimerRef.current) {
        clearTimeout(redirectTimerRef.current);
      }
    };
  }, [orderId, targetPages, navigate]);

  const handleManualFinish = async () => {
    setIsFinishing(true);
    simulateFinishPrinting();
    try {
      if (orderId) {
        await api.updatePrintProgress(orderId, {
          printStatus: 'completed',
          currentPagePrinting: targetPages,
          printProgress: 100,
        });
      }
    } catch {}

    setTimeout(() => {
      navigate('/complete');
    }, 400);
  };

  const estRemainingSec = Math.max(0, (targetPages - liveCurrentPage + 1) * 3);

  return (
    <div className="w-full min-h-[calc(100dvh-3.5rem)] md:min-h-screen pt-14 sm:pt-16 pb-4 bg-surface flex flex-col justify-center items-center px-4 select-none">
      <div className="w-full max-w-md flex flex-col items-center my-auto py-2 gap-3">
        {/* Top Status Strip */}
        <div className="w-full flex items-center justify-between px-1">
          <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 text-[11px] font-bold">
            ✓ Payment Confirmed (₹{totalPrice})
          </span>
          <span className="text-xs text-on-surface-variant font-mono font-bold">
            {orderId}
          </span>
        </div>

        {/* HERO PRINTING EXECUTION CARD */}
        <div className="w-full bg-surface-container-lowest rounded-3xl p-5 sm:p-6 shadow-xl border border-surface-container-high flex flex-col items-center text-center gap-4">
          {/* Real-Time Status Header */}
          <div className="flex flex-col items-center">
            {livePrintStatus === 'queued' ? (
              <div className="flex items-center gap-1.5 text-amber-500 text-xs uppercase font-bold tracking-wider mb-1 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20">
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping"></span>
                <span>Printer Queue • Checking Hardware</span>
              </div>
            ) : livePrintStatus === 'completed' ? (
              <div className="flex items-center gap-1.5 text-emerald-500 text-xs uppercase font-bold tracking-wider mb-1 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                <span className="material-symbols-outlined text-[14px]">check_circle</span>
                <span>Printing Complete • Dispensing Sheets</span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 text-primary text-xs uppercase font-bold tracking-wider mb-1 px-3 py-1 rounded-full bg-primary/10 border border-primary/20">
                <span className="w-2 h-2 rounded-full bg-primary animate-ping"></span>
                <span>Step 4 of 4 • Real-Time Printing</span>
              </div>
            )}

            <h1 className="text-xl sm:text-2xl font-black text-on-surface tracking-tight mt-1">
              {livePrintStatus === 'queued'
                ? 'Preparing Print Command...'
                : livePrintStatus === 'completed'
                ? 'All Sheets Ready!'
                : `Printing Page ${liveCurrentPage} of ${targetPages}`}
            </h1>

            <p className="text-xs text-on-surface-variant truncate max-w-[280px] mt-0.5" title={fileName}>
              {fileName || 'Document.pdf'} •{' '}
              <span className="font-semibold text-on-surface">
                {colorMode === 'color' ? 'Color' : 'B&W'} • {orientation.toUpperCase()} • {copies} {copies > 1 ? 'copies' : 'copy'}
              </span>
            </p>
          </div>

          {/* Interactive Mechanical Printer Animation Frame */}
          <div className="w-full bg-surface-container-low rounded-2xl p-4 flex flex-col items-center justify-center relative overflow-hidden border border-surface-container-high">
            {/* Feed Slot */}
            <div className="w-48 h-2.5 bg-inverse-surface rounded-full flex items-center justify-center relative shadow-inner">
              <span
                className={`w-16 h-1 rounded-full ${
                  livePrintStatus === 'queued'
                    ? 'bg-amber-400 animate-pulse'
                    : livePrintStatus === 'completed'
                    ? 'bg-emerald-400'
                    : 'bg-primary animate-pulse'
                }`}
              ></span>
            </div>

            {/* Paper Sheet in Motion */}
            <div className="relative my-2.5 w-40 h-32 bg-surface-container-lowest rounded-lg shadow-lg p-2.5 flex flex-col justify-between overflow-hidden border border-slate-200">
              {/* Document Preview Placeholder Lines */}
              <div className="space-y-1.5 opacity-60">
                <div
                  className={`h-1.5 rounded w-1/3 ${
                    colorMode === 'color' ? 'bg-primary/80' : 'bg-inverse-surface/80'
                  }`}
                ></div>
                <div className="h-1.5 bg-on-surface-variant/40 rounded w-full"></div>
                <div className="h-1.5 bg-on-surface-variant/40 rounded w-5/6"></div>
                <div className="h-1.5 bg-on-surface-variant/30 rounded w-4/6"></div>
              </div>

              {/* Dynamic Laser Line Effect */}
              {livePrintStatus === 'printing' && (
                <div
                  className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-transparent ${
                    colorMode === 'color' ? 'via-cyan-400' : 'via-error'
                  } to-transparent opacity-90 animate-[bounce_1.4s_infinite]`}
                ></div>
              )}

              {/* Page Number Stamp */}
              <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-[10px] font-mono">
                <span className="font-bold text-primary">
                  {livePrintStatus === 'queued'
                    ? 'STANDBY'
                    : `PAGE ${liveCurrentPage} / ${targetPages}`}
                </span>
                <span
                  className={`material-symbols-outlined text-[14px] ${
                    livePrintStatus === 'completed' ? 'text-emerald-500' : 'text-tertiary'
                  }`}
                >
                  {livePrintStatus === 'completed' ? 'done_all' : 'print'}
                </span>
              </div>
            </div>

            {/* Dispenser Tray */}
            <div className="w-56 bg-inverse-surface text-inverse-on-surface rounded-xl px-3 py-1.5 flex items-center justify-between shadow-md text-xs">
              <div className="flex items-center gap-1.5">
                <span
                  className={`w-2 h-2 rounded-full ${
                    livePrintStatus === 'completed'
                      ? 'bg-emerald-400'
                      : livePrintStatus === 'queued'
                      ? 'bg-amber-400'
                      : 'bg-tertiary animate-ping'
                  }`}
                ></span>
                <span className="text-[11px] font-semibold text-tertiary-fixed">
                  {livePrintStatus === 'queued'
                    ? 'Queue Check: 3s Polling'
                    : livePrintStatus === 'completed'
                    ? 'Sheets in Output Tray'
                    : 'Active Output Tray'}
                </span>
              </div>
              <span className="text-[10px] text-on-surface-variant font-mono">
                {colorMode === 'color' ? 'Color Laser' : 'B&W Laser'}
              </span>
            </div>
          </div>

          {/* Progress & Page Statistics */}
          <div className="w-full flex flex-col gap-2 text-left">
            <div className="flex items-baseline justify-between">
              <div>
                <span className="text-sm sm:text-base font-extrabold text-on-surface">
                  {livePrintStatus === 'queued' ? (
                    'Waiting in Queue...'
                  ) : (
                    <>
                      Page {liveCurrentPage} of {targetPages}
                      {pageSelectionMode === 'custom' && selectedPagesList[Math.max(0, liveCurrentPage - 1)] && (
                        <span className="text-xs text-primary font-semibold ml-1.5">
                          (Doc P{selectedPagesList[Math.max(0, liveCurrentPage - 1)]})
                        </span>
                      )}
                    </>
                  )}
                </span>
              </div>
              <span className="text-xl sm:text-2xl font-black text-primary font-mono tracking-tight">
                {liveProgress}%
              </span>
            </div>

            {/* High-Contrast Animated Progress Bar */}
            <div className="w-full h-3.5 bg-surface-container-highest rounded-full overflow-hidden p-0.5 shadow-inner">
              <div
                className={`h-full rounded-full transition-all duration-700 ease-out ${
                  livePrintStatus === 'completed'
                    ? 'bg-emerald-500'
                    : livePrintStatus === 'queued'
                    ? 'bg-amber-400 animate-pulse'
                    : 'bg-tertiary-container'
                }`}
                style={{ width: `${Math.max(livePrintStatus === 'queued' ? 8 : 0, liveProgress)}%` }}
              ></div>
            </div>

            <div className="flex items-center justify-between text-xs text-on-surface-variant">
              <span>
                {livePrintStatus === 'queued'
                  ? 'Checking CUPS print spooler...'
                  : livePrintStatus === 'completed'
                  ? `${targetPages} of ${targetPages} pages completed`
                  : `${Math.max(0, liveCurrentPage - 1)} pages printed`}
              </span>
              <span className="font-bold text-primary">
                {livePrintStatus === 'completed'
                  ? 'Ready to collect'
                  : livePrintStatus === 'queued'
                  ? 'Dispatching...'
                  : `~${estRemainingSec}s remaining`}
              </span>
            </div>
          </div>

          {/* Print Preferences Summary Pill */}
          <div className="w-full grid grid-cols-3 gap-1.5 text-center text-[11px] py-1.5 px-2 bg-surface-container-low rounded-xl border border-surface-container-high text-on-surface-variant font-medium">
            <div>
              <span className="block text-[9px] uppercase tracking-wider text-slate-400">Mode</span>
              <span className="font-bold text-on-surface">{colorMode === 'color' ? '🎨 Color' : '⬛ B&W'}</span>
            </div>
            <div>
              <span className="block text-[9px] uppercase tracking-wider text-slate-400">Layout</span>
              <span className="font-bold text-on-surface">{orientation === 'landscape' ? 'Landscape' : 'Portrait'}</span>
            </div>
            <div>
              <span className="block text-[9px] uppercase tracking-wider text-slate-400">Sides</span>
              <span className="font-bold text-on-surface">{isDuplex ? '2-Sided' : '1-Sided'}</span>
            </div>
          </div>

          {/* Safety Collection Note */}
          <div className="w-full p-2.5 rounded-xl bg-surface-container flex items-center gap-2 text-xs text-on-surface-variant text-left">
            <span className="material-symbols-outlined text-[18px] text-tertiary shrink-0">info</span>
            <span>
              {livePrintStatus === 'completed'
                ? 'All sheets have dispensed into the illuminated tray below. Thank you!'
                : 'Sheets will dispense into the illuminated green tray directly below.'}
            </span>
          </div>

          {/* Fast Simulator / Manual Skip Button */}
          <button
            type="button"
            onClick={handleManualFinish}
            disabled={isFinishing}
            className="w-full h-10 rounded-xl bg-surface-container hover:bg-surface-container-high text-on-surface font-semibold text-xs flex items-center justify-center gap-1.5 active:scale-95 transition-all cursor-pointer border border-surface-container-high opacity-80 hover:opacity-100"
          >
            <span className="material-symbols-outlined text-[16px] text-primary">skip_next</span>
            <span>{isFinishing ? 'Finishing...' : 'Simulate Finish Printing'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
