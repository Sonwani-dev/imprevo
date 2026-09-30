import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import confetti from 'canvas-confetti';
import { useKiosk } from '../context/KioskContext';

export const CompletePage: React.FC = () => {
  const navigate = useNavigate();
  const {
    fileName,
    totalPages,
    colorMode,
    totalPrice,
    orderId,
    txnId,
    resetSession,
  } = useKiosk();

  const [secondsLeft, setSecondsLeft] = useState<number>(15);

  // Trigger celebration confetti on mount
  useEffect(() => {
    confetti({
      particleCount: 80,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#0037b0', '#1d4ed8', '#006948', '#85f8c4', '#dce1ff'],
    });
  }, []);

  const handleFinish = () => {
    resetSession();
    navigate('/');
  };

  const handlePrintAnother = () => {
    resetSession();
    navigate('/upload');
  };

  // 15-second auto return countdown
  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          handleFinish();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="w-full min-h-[calc(100dvh-3.5rem)] md:min-h-screen pt-14 sm:pt-16 pb-4 bg-surface flex flex-col justify-center items-center px-4 select-none">
      <div className="w-full max-w-md flex flex-col items-center text-center my-auto py-2 gap-3.5">
        {/* Animated Green Checkmark Badge */}
        <div className="relative">
          <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-emerald-500/15 text-emerald-600 flex items-center justify-center shadow-lg border-2 border-emerald-500/30">
            <span className="material-symbols-outlined text-[48px] sm:text-[56px] fill-1">
              check_circle
            </span>
          </div>
          <div className="absolute -inset-1.5 rounded-full border-2 border-emerald-400 opacity-40 animate-ping pointer-events-none"></div>
        </div>

        {/* Headings */}
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl sm:text-3xl font-black text-on-surface tracking-tight">
            Printing Complete!
          </h1>
          <p className="text-xs sm:text-sm text-on-surface-variant max-w-xs">
            Your document has been printed and dispensed to the collection tray.
          </p>
        </div>

        {/* Illuminated Collection Tray Alert Banner */}
        <div className="w-full bg-emerald-500/10 rounded-2xl p-3.5 flex items-center gap-3 border border-emerald-500/20 text-left shadow-xs">
          <div className="w-11 h-11 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-sm">
            <span className="material-symbols-outlined text-[24px] animate-bounce">
              move_to_inbox
            </span>
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider">
              Collect Printed Pages
            </span>
            <span className="text-xs sm:text-sm font-bold text-on-surface truncate">
              {totalPages} {totalPages === 1 ? 'Page' : 'Pages'} in Tray Below
            </span>
            <span className="text-[11px] text-on-surface-variant">
              Green LED Tray Indicator is illuminated
            </span>
          </div>
        </div>

        {/* Compact Job Receipt Box */}
        <div className="w-full bg-surface-container-lowest rounded-2xl p-3.5 sm:p-4 shadow-sm border border-surface-container-high text-xs flex flex-col gap-2 text-left">
          <div className="flex items-center justify-between pb-2 border-b border-surface-container-high">
            <span className="text-[10px] uppercase font-bold text-on-surface-variant tracking-wider">
              Print Receipt
            </span>
            <span className="font-mono font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-md text-[11px]">
              {orderId}
            </span>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-on-surface-variant flex items-center gap-1">
              <span className="material-symbols-outlined text-[15px]">description</span>
              <span>Document</span>
            </span>
            <span className="font-semibold text-on-surface truncate max-w-[180px]" title={fileName}>
              {fileName}
            </span>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-on-surface-variant flex items-center gap-1">
              <span className="material-symbols-outlined text-[15px]">layers</span>
              <span>Volume</span>
            </span>
            <span className="font-semibold text-on-surface">
              {totalPages} pgs • {colorMode === 'bw' ? 'B&W Mono' : 'Color'}
            </span>
          </div>

          <div className="flex justify-between items-center pt-1 border-t border-surface-container-high">
            <span className="text-on-surface-variant font-bold">Total Paid</span>
            <span className="font-mono font-extrabold text-sm text-emerald-600">
              ₹{totalPrice}.00
            </span>
          </div>

          {txnId && (
            <div className="text-[10px] text-on-surface-variant/80 font-mono text-center pt-0.5">
              Txn: {txnId}
            </div>
          )}
        </div>

        {/* Primary and Secondary Actions */}
        <div className="w-full flex flex-col gap-2 pt-1">
          <button
            type="button"
            onClick={handleFinish}
            className="w-full h-13 sm:h-14 bg-primary hover:bg-primary/90 text-on-primary rounded-2xl font-bold text-sm sm:text-base shadow-lg shadow-primary/25 active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <span>Done — Collect &amp; Finish</span>
            <span className="bg-primary-container text-on-primary-container px-2 py-0.5 rounded-full text-xs font-bold font-mono">
              {secondsLeft}s
            </span>
            <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
          </button>

          <button
            type="button"
            onClick={handlePrintAnother}
            className="w-full h-11 bg-surface-container hover:bg-surface-container-high text-on-surface rounded-xl font-semibold text-xs flex items-center justify-center gap-1.5 active:scale-95 transition-all cursor-pointer border border-surface-container-high"
          >
            <span className="material-symbols-outlined text-[16px]">print</span>
            <span>Print Another File</span>
          </button>
        </div>
      </div>
    </div>
  );
};
