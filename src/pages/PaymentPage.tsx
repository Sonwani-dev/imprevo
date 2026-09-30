import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useKiosk } from '../context/KioskContext';
import { launchRazorpayCheckout } from '../services/razorpay';

export const PaymentPage: React.FC = () => {
  const navigate = useNavigate();
  const {
    fileName,
    totalPages,
    colorMode,
    totalPrice,
    orderId,
    copies,
    isDuplex,
    ratePerPage,
    simulatePaymentSuccess,
  } = useKiosk();

  const [sessionSeconds, setSessionSeconds] = useState<number>(600); // 10:00
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const hasAutoLaunchedRef = useRef<boolean>(false);

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

  const handleOpenRazorpay = async () => {
    if (isProcessing) return;
    setIsProcessing(true);
    setCheckoutError(null);

    const launched = await launchRazorpayCheckout({
      amount: totalPrice,
      orderId,
      fileName: fileName || 'Document.pdf',
      totalPages: totalPages || 1,
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
      setCheckoutError('Could not open payment dialog. Tap below to retry.');
    } else {
      setIsProcessing(false);
    }
  };

  // Auto-launch official Razorpay popup once when landing on payment page
  useEffect(() => {
    if (!hasAutoLaunchedRef.current) {
      hasAutoLaunchedRef.current = true;
      const timer = setTimeout(() => {
        handleOpenRazorpay();
      }, 450);
      return () => clearTimeout(timer);
    }
  }, []);

  return (
    <div className="w-full min-h-[calc(100dvh-3.5rem)] md:min-h-screen pt-14 sm:pt-16 pb-4 md:pb-8 bg-surface flex flex-col justify-center items-center px-4 select-none">
      <div className="w-full max-w-md flex flex-col items-center my-auto py-2">
        {/* Step Indicator & Timer Header */}
        <div className="w-full flex items-center justify-between mb-3 px-1">
          <span className="px-2.5 py-0.5 rounded-full bg-primary/10 text-primary text-[11px] font-bold uppercase tracking-wider">
            Step 3 of 4 • Checkout
          </span>
          <div className="flex items-center gap-1.5 text-xs text-on-surface-variant font-mono font-bold bg-surface-container-lowest px-2.5 py-1 rounded-full border border-surface-container-high shadow-xs">
            <span className="material-symbols-outlined text-[14px] text-tertiary">lock</span>
            <span>{formatTimer(sessionSeconds)}</span>
          </div>
        </div>

        {/* PAYMENT SUMMARY BOX ONLY (Zero scrolling, fits all screens!) */}
        <div className="w-full bg-surface-container-lowest rounded-3xl p-5 sm:p-6 shadow-xl border border-surface-container-high flex flex-col gap-4 text-left">
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
                <span className="font-bold text-on-surface truncate max-w-[200px]" title={fileName}>
                  {fileName || 'Document.pdf'}
                </span>
              </div>
              <span className="font-bold text-on-surface shrink-0">
                {totalPages} {totalPages === 1 ? 'pg' : 'pgs'} × {copies}
              </span>
            </div>

            <div className="flex items-center justify-between text-on-surface-variant">
              <span>Print Specification</span>
              <span className="font-semibold text-on-surface">
                {colorMode === 'bw' ? 'B&W' : 'Color'} (₹{ratePerPage}/pg) • {isDuplex ? '2-Sided' : '1-Sided'}
              </span>
            </div>

            <div className="flex items-center justify-between text-on-surface-variant">
              <span>GST &amp; Service Charge</span>
              <span className="font-semibold text-tertiary">Included</span>
            </div>
          </div>

          {/* High-Contrast Total Payable Highlight Box */}
          <div className="p-3.5 rounded-2xl bg-surface-container flex items-center justify-between border border-surface-container-high">
            <div className="flex flex-col">
              <span className="text-[10px] uppercase font-bold tracking-wider text-on-surface-variant">
                Total Amount Due
              </span>
              <span className="text-[11px] text-tertiary font-semibold">
                Instant Automatic Print
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
                  <span>Opening Gateway...</span>
                </span>
              ) : (
                <>
                  <span className="material-symbols-outlined text-[20px]">lock</span>
                  <span>Pay ₹{totalPrice}.00 with Razorpay</span>
                  <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                </>
              )}
            </button>

            <div className="flex items-center justify-center gap-1.5 text-[11px] text-on-surface-variant">
              <span className="material-symbols-outlined text-[14px] text-emerald-600">verified</span>
              <span>256-bit Encrypted • Automatic Rollback Protection</span>
            </div>
          </div>
        </div>

        {/* Back Button */}
        <button
          type="button"
          onClick={() => navigate('/confirm')}
          className="mt-3 text-xs font-semibold text-on-surface-variant hover:text-primary flex items-center gap-1 transition-colors py-1 cursor-pointer"
        >
          <span className="material-symbols-outlined text-[16px]">arrow_back</span>
          <span>Back to Document Options</span>
        </button>
      </div>
    </div>
  );
};
