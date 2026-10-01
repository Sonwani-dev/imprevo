import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useKiosk } from '../context/KioskContext';
import { launchRazorpayCheckout } from '../services/razorpay';
import { DocumentViewer } from '../components/DocumentViewer';

export const PaymentPage: React.FC = () => {
  const navigate = useNavigate();
  const {
    file,
    fileBlobUrl,
    fileUrl,
    fileName,
    fileSize,
    totalPages,
    colorMode,
    totalPrice,
    orderId,
    copies,
    isDuplex,
    ratePerPage,
    orientation,
    effectivePages,
    selectedPagesList,
    contentRotation,
    rotateContent90,
    simulatePaymentSuccess,
  } = useKiosk();

  const [previewPageIndex, setPreviewPageIndex] = useState<number>(0);
  const [sessionSeconds, setSessionSeconds] = useState<number>(600); // 10:00
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  // Redirect to upload if user arrived without document
  useEffect(() => {
    if (!fileName || totalPages === 0) {
      navigate('/upload', { replace: true });
    }
  }, [fileName, totalPages, navigate]);

  // Session timer countdown
  useEffect(() => {
    const timer = setInterval(() => {
      setSessionSeconds((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTimer = (totalSec: number) => {
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const previewTotalPages = Math.max(1, selectedPagesList?.length || totalPages || 1);
  const safePageIndex = Math.min(Math.max(0, previewPageIndex), previewTotalPages - 1);
  const currentDocPage = (selectedPagesList && selectedPagesList[safePageIndex]) || safePageIndex + 1;

  const handleOpenRazorpay = async () => {
    if (isProcessing) return;
    setIsProcessing(true);
    setCheckoutError(null);

    const launched = await launchRazorpayCheckout({
      amount: totalPrice,
      orderId,
      fileName: fileName || 'Document.pdf',
      totalPages: effectivePages || totalPages || 1,
      onSuccess: async (details) => {
        setIsProcessing(true);
        await simulatePaymentSuccess({
          razorpay_payment_id: details.razorpay_payment_id,
          payment_method: 'razorpay',
          txn_id: details.txn_id,
        });
        setIsProcessing(false);
        navigate('/printing');
      },
      onDismiss: () => {
        setIsProcessing(false);
      },
      onError: (err) => {
        console.warn('Razorpay checkout error:', err);
        setIsProcessing(false);
        setCheckoutError(err?.description || err?.message || 'Payment cancelled or declined.');
      },
    });

    if (!launched) {
      setIsProcessing(false);
      setCheckoutError('Could not open payment dialog. Tap button below to retry.');
    } else {
      setIsProcessing(false);
    }
  };

  return (
    <div className="w-full min-h-[calc(100dvh-3.5rem)] pt-14 sm:pt-16 pb-8 bg-surface flex flex-col items-center px-3 sm:px-6 select-none">
      <div className="w-full max-w-5xl flex flex-col gap-3 sm:gap-4 my-auto py-2">
        {/* Step Indicator & Timer Header */}
        <div className="w-full flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full bg-primary/10 text-primary text-[11px] font-bold uppercase tracking-wider">
              Step 3 of 4 • Final Review &amp; Checkout
            </span>
            <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
              <span className="material-symbols-outlined text-[13px]">check_circle</span>
              WYSIWYG Verified
            </span>
          </div>

          <div className="flex items-center gap-1.5 text-xs text-on-surface-variant font-mono font-bold bg-surface-container-lowest px-2.5 py-1 rounded-full border border-surface-container-high shadow-xs">
            <span className="material-symbols-outlined text-[14px] text-tertiary">lock</span>
            <span>{formatTimer(sessionSeconds)}</span>
          </div>
        </div>

        {/* Main 2-Column Responsive Workspace */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-6 items-start">
          {/* COLUMN 1: EXACT FINAL PRINTOUT PREVIEW (WYSIWYG) */}
          <div className="lg:col-span-6 xl:col-span-7 flex flex-col bg-surface-container-lowest rounded-3xl p-3 sm:p-5 shadow-lg border border-surface-container-high text-left">
            {/* Section Header */}
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-surface-container-high">
              <div className="flex flex-col">
                <span className="text-xs sm:text-sm font-bold text-on-surface flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[18px] text-primary">visibility</span>
                  <span>Exact Final Printout Preview</span>
                </span>
                <span className="text-[10px] sm:text-[11px] text-on-surface-variant font-medium">
                  What you see below is exactly what prints out on Canon LBP2900
                </span>
              </div>

              <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold uppercase tracking-wider bg-primary/10 text-primary">
                A4 • {orientation}
              </span>
            </div>

            {/* Central Document Canvas / Paper Sheet */}
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
                zoomLevel={100}
                colorMode={colorMode}
                manualRotation={contentRotation}
                onRotate={rotateContent90}
                isCompact={false}
                showRotateButton={true}
              />
            </div>

            {/* Pagination Controls (if multi-page document) */}
            {previewTotalPages > 1 && (
              <div className="w-full max-w-xs mx-auto flex items-center justify-between gap-2 px-3 py-1 mt-2 bg-surface-container-low rounded-xl shadow-xs border border-surface-container-high text-xs font-semibold">
                <button
                  type="button"
                  disabled={safePageIndex <= 0}
                  onClick={() => setPreviewPageIndex((i) => Math.max(0, i - 1))}
                  className="px-2 py-0.5 rounded hover:bg-surface-container disabled:opacity-30 disabled:pointer-events-none flex items-center gap-0.5 cursor-pointer text-on-surface text-[11px]"
                >
                  <span className="material-symbols-outlined text-[14px]">chevron_left</span>
                  <span>Prev</span>
                </button>

                <div className="flex items-center gap-1 font-mono font-bold text-on-surface text-[11px]">
                  <span>Page {safePageIndex + 1} of {previewTotalPages}</span>
                </div>

                <button
                  type="button"
                  disabled={safePageIndex >= previewTotalPages - 1}
                  onClick={() => setPreviewPageIndex((i) => Math.min(previewTotalPages - 1, i + 1))}
                  className="px-2 py-0.5 rounded hover:bg-surface-container disabled:opacity-30 disabled:pointer-events-none flex items-center gap-0.5 cursor-pointer text-on-surface text-[11px]"
                >
                  <span>Next</span>
                  <span className="material-symbols-outlined text-[14px]">chevron_right</span>
                </button>
              </div>
            )}

            {/* Print Confirmation Tags */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 mt-3 pt-2.5 border-t border-surface-container-high text-[11px]">
              <div className="flex flex-col bg-surface-container-low p-2 rounded-xl">
                <span className="text-on-surface-variant text-[10px]">Orientation</span>
                <span className="font-bold text-on-surface capitalize">{orientation}</span>
              </div>
              <div className="flex flex-col bg-surface-container-low p-2 rounded-xl">
                <span className="text-on-surface-variant text-[10px]">Color Mode</span>
                <span className="font-bold text-on-surface">{colorMode === 'bw' ? 'B&W Laser' : 'Color'}</span>
              </div>
              <div className="flex flex-col bg-surface-container-low p-2 rounded-xl">
                <span className="text-on-surface-variant text-[10px]">Pages</span>
                <span className="font-bold text-on-surface">{effectivePages || totalPages} pg</span>
              </div>
              <div className="flex flex-col bg-surface-container-low p-2 rounded-xl">
                <span className="text-on-surface-variant text-[10px]">Copies</span>
                <span className="font-bold text-on-surface">{copies} {copies > 1 ? 'copies' : 'copy'}</span>
              </div>
            </div>

            {/* Back to Edit Options Link */}
            <div className="mt-3 flex items-center justify-between">
              <button
                type="button"
                onClick={() => navigate('/confirm')}
                className="text-xs font-semibold text-primary hover:underline flex items-center gap-1 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[15px]">edit</span>
                <span>Change orientation or options</span>
              </button>

              <span className="text-[10px] font-mono text-on-surface-variant">
                Canon LBP2900 • Ready
              </span>
            </div>
          </div>

          {/* COLUMN 2: PAYMENT SUMMARY & DIRECT RAZORPAY ACTION */}
          <div className="lg:col-span-6 xl:col-span-5 flex flex-col gap-3 text-left">
            <div className="w-full bg-surface-container-lowest rounded-3xl p-4 sm:p-6 shadow-xl border border-surface-container-high flex flex-col gap-3 sm:gap-4">
              {/* Order Header */}
              <div className="flex items-center justify-between pb-3 border-b border-surface-container-high">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                    <span className="material-symbols-outlined text-[20px]">receipt_long</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-sm font-bold text-on-surface">Payment Summary</span>
                    <span className="text-[11px] text-on-surface-variant font-medium">Terminal Station #04</span>
                  </div>
                </div>
                <span className="font-mono text-xs font-bold text-primary bg-primary/10 px-2.5 py-0.5 rounded-full">
                  {orderId}
                </span>
              </div>

              {/* Job Item Breakdown */}
              <div className="flex flex-col gap-2 py-1 text-xs">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="material-symbols-outlined text-[16px] text-primary shrink-0">description</span>
                    <span className="font-bold text-on-surface truncate max-w-[190px]" title={fileName}>
                      {fileName || 'Document.pdf'}
                    </span>
                  </div>
                  <span className="font-bold text-on-surface shrink-0">
                    {effectivePages || totalPages} {((effectivePages || totalPages) === 1) ? 'pg' : 'pgs'} × {copies}
                  </span>
                </div>

                <div className="flex items-center justify-between text-on-surface-variant">
                  <span>Print Specification</span>
                  <span className="font-semibold text-on-surface">
                    {colorMode === 'bw' ? 'B&W Mono' : 'Color'} (₹{ratePerPage}/pg) • {orientation.toUpperCase()}
                  </span>
                </div>

                <div className="flex items-center justify-between text-on-surface-variant">
                  <span>Sides &amp; Paper</span>
                  <span className="font-semibold text-on-surface">
                    {isDuplex ? '2-Sided' : '1-Sided'} • A4 Plain Paper
                  </span>
                </div>

                <div className="flex items-center justify-between text-on-surface-variant">
                  <span>GST &amp; Service Charge</span>
                  <span className="font-semibold text-tertiary">Included (₹0.00)</span>
                </div>
              </div>

              {/* Total Payable Highlight Box */}
              <div className="p-3.5 rounded-2xl bg-surface-container flex items-center justify-between border border-surface-container-high">
                <div className="flex flex-col">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-on-surface-variant">
                    Total Amount Due
                  </span>
                  <span className="text-[11px] text-emerald-700 font-semibold flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                    Instant Hardware Spooling
                  </span>
                </div>
                <span className="text-2xl sm:text-3xl font-black text-primary font-mono tracking-tight">
                  ₹{totalPrice}.00
                </span>
              </div>

              {/* Error Notice (if payment failed or was closed) */}
              {checkoutError && (
                <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 text-xs font-medium flex items-center gap-2">
                  <span className="material-symbols-outlined text-[16px]">error</span>
                  <span>{checkoutError}</span>
                </div>
              )}

              {/* Primary Pay with Razorpay Action Button */}
              <div className="flex flex-col gap-2 pt-1">
                <button
                  type="button"
                  disabled={isProcessing}
                  onClick={handleOpenRazorpay}
                  className="w-full h-14 rounded-2xl bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-700 hover:from-blue-500 hover:to-indigo-600 text-white font-bold text-base flex items-center justify-center gap-2 shadow-lg shadow-blue-500/25 active:scale-95 transition-all cursor-pointer disabled:opacity-50"
                >
                  {isProcessing ? (
                    <span className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-[22px] animate-spin">
                        progress_activity
                      </span>
                      <span>Opening Payment Gateway...</span>
                    </span>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-[20px]">lock</span>
                      <span>Pay ₹{totalPrice}.00 &amp; Print</span>
                      <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                    </>
                  )}
                </button>

                <div className="flex items-center justify-center gap-1.5 text-[11px] text-on-surface-variant">
                  <span className="material-symbols-outlined text-[14px] text-emerald-600">verified</span>
                  <span>Direct-to-Printer Spooling • Auto-Rollback Guarantee</span>
                </div>
              </div>
            </div>

            {/* Back Button */}
            <button
              type="button"
              onClick={() => navigate('/confirm')}
              className="text-xs font-semibold text-on-surface-variant hover:text-primary flex items-center justify-center gap-1 transition-colors py-1 cursor-pointer"
            >
              <span className="material-symbols-outlined text-[16px]">arrow_back</span>
              <span>Back to Document Options</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
