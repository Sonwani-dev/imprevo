import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useKiosk } from '../context/KioskContext';

export const OrderSummaryPage: React.FC = () => {
  const navigate = useNavigate();
  const {
    fileName,
    totalPages,
    effectivePages,
    selectedPagesList,
    pageSelectionMode,
    orientation,
    isDuplex,
    copies,
    colorMode,
    paperSize,
    paperGsm,
    ratePerPage,
    totalPrice,
    estPrintTimeSeconds,
  } = useKiosk();

  return (
    <div className="w-full pt-24 pb-24 min-h-screen bg-surface">
      <div className="flex flex-col w-full">
        <div className="max-w-6xl mx-auto w-full px-4 sm:px-8 lg:px-margin-kiosk py-space-lg flex flex-col gap-space-lg">
          {/* Top Header */}
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-space-md">
            <div className="flex flex-col gap-space-xs text-left">
              <div className="flex items-center gap-space-xs">
                <span className="px-space-sm py-1 rounded-full bg-surface-container-high text-primary font-label-md text-label-md font-bold">
                  Step 3 of 4: Payment (Preparing)
                </span>
                <span className="w-2 h-2 rounded-full bg-tertiary animate-ping"></span>
              </div>
              <h1 className="font-headline-xl text-headline-xl text-on-surface tracking-tight font-bold">
                Order Summary
              </h1>
              <p className="font-body-lg text-body-lg text-on-surface-variant">
                Review your print details and transparent cost breakdown before making a payment.
              </p>
            </div>

            <div className="flex items-center gap-space-md self-start md:self-auto bg-surface-container-low px-space-md py-space-sm rounded-xl shadow-sm border border-surface-container-high">
              <span className="material-symbols-outlined text-primary text-[28px]">lock</span>
              <div className="flex flex-col text-left">
                <span className="font-label-md text-label-md text-on-surface font-bold">
                  Zero Hidden Charges
                </span>
                <span className="font-body-md text-xs text-on-surface-variant">
                  Instant GST-Compliant Invoicing
                </span>
              </div>
            </div>
          </div>

          {/* Main Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-space-lg items-start">
            {/* Left 8 Cols */}
            <div className="lg:col-span-8 flex flex-col gap-space-lg">
              {/* Document Overview Card */}
              <div className="bg-surface-container-lowest rounded-2xl p-space-lg shadow-sm flex flex-col gap-space-md border border-surface-container-high text-left">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-space-sm">
                    <div className="w-12 h-12 rounded-xl bg-surface-container-high flex items-center justify-center text-primary">
                      <span className="material-symbols-outlined text-[30px]">picture_as_pdf</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="font-headline-md text-headline-md text-on-surface font-bold truncate max-w-[300px]">
                        {fileName}
                      </span>
                      <span className="font-body-md text-xs sm:text-body-md text-on-surface-variant">
                        Uploaded via Kiosk Secure Portal • {totalPages} Pages Total
                      </span>
                    </div>
                  </div>
                  <div className="px-space-sm py-1.5 rounded-lg bg-surface-container text-primary font-label-md text-label-md font-bold">
                    {copies} {copies === 1 ? 'Copy' : 'Copies'}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-space-sm pt-space-xs">
                  <div className="bg-surface-container-low p-space-md rounded-xl flex items-center gap-space-sm">
                    <div className="w-10 h-10 rounded-lg bg-surface-container-high flex items-center justify-center text-primary">
                      <span className="material-symbols-outlined text-[24px]">description</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="font-body-md text-xs text-on-surface-variant">
                        Paper Specification
                      </span>
                      <span className="font-label-md text-label-md text-on-surface font-bold">
                        Standard {paperSize} • {paperGsm}
                      </span>
                    </div>
                  </div>

                  <div className="bg-surface-container-low p-space-md rounded-xl flex items-center gap-space-sm">
                    <div className="w-10 h-10 rounded-lg bg-surface-container-high flex items-center justify-center text-primary">
                      <span className="material-symbols-outlined text-[24px]">contrast</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="font-body-md text-xs text-on-surface-variant">
                        Print Technology
                      </span>
                      <span className="font-label-md text-label-md text-on-surface font-bold">
                        Standard Laser Printing ({colorMode === 'bw' ? 'B&W' : 'Color'})
                      </span>
                    </div>
                  </div>

                  <div className="bg-surface-container-low p-space-md rounded-xl flex items-center gap-space-sm">
                    <div className="w-10 h-10 rounded-lg bg-surface-container-high flex items-center justify-center text-primary">
                      <span className="material-symbols-outlined text-[24px]">screen_rotation</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="font-body-md text-xs text-on-surface-variant">
                        Layout &amp; Sides
                      </span>
                      <span className="font-label-md text-label-md text-on-surface font-bold capitalize">
                        {orientation} • {isDuplex ? 'Double Sided' : 'Single Sided'}
                      </span>
                    </div>
                  </div>

                  <div className="bg-surface-container-low p-space-md rounded-xl flex items-center gap-space-sm">
                    <div className="w-10 h-10 rounded-lg bg-surface-container-high flex items-center justify-center text-primary">
                      <span className="material-symbols-outlined text-[24px]">auto_stories</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="font-body-md text-xs text-on-surface-variant">
                        Selected Print Pages
                      </span>
                      <span className="font-label-md text-label-md text-on-surface font-bold">
                        {effectivePages || totalPages} of {totalPages} Pages ({pageSelectionMode === 'all' ? 'All' : `Custom: ${selectedPagesList.join(', ')}`})
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Itemized Cost Breakdown */}
              <div className="bg-surface-container-lowest rounded-2xl p-space-lg shadow-sm flex flex-col gap-space-md border border-surface-container-high text-left">
                <div className="flex items-center justify-between pb-space-xs">
                  <h2 className="font-headline-md text-headline-md text-on-surface font-bold">
                    Itemized Cost Breakdown
                  </h2>
                  <span className="font-label-md text-label-md text-tertiary flex items-center gap-1 font-bold">
                    <span className="material-symbols-outlined text-[18px]">verified</span>
                    Automated Kiosk Pricing
                  </span>
                </div>

                <div className="flex flex-col gap-space-xs">
                  <div className="flex items-center justify-between p-space-md rounded-xl bg-surface-container-low">
                    <div className="flex items-center gap-space-sm">
                      <span className="material-symbols-outlined text-primary text-[22px]">print</span>
                      <div className="flex flex-col">
                        <span className="font-label-md text-label-md text-on-surface font-bold">
                          Laser Print Rate
                        </span>
                        <span className="font-body-md text-xs text-on-surface-variant">
                          ₹{ratePerPage}.00 per page × {effectivePages || totalPages} { (effectivePages || totalPages) === 1 ? 'page' : 'pages' } {copies > 1 ? `× ${copies} copies` : ''}
                        </span>
                      </div>
                    </div>
                    <span className="font-label-lg text-label-lg text-on-surface font-extrabold">
                      ₹{totalPrice}.00
                    </span>
                  </div>

                  <div className="flex items-center justify-between p-space-md rounded-xl bg-surface-container-low">
                    <div className="flex items-center gap-space-sm">
                      <span className="material-symbols-outlined text-tertiary text-[22px]">savings</span>
                      <div className="flex flex-col">
                        <span className="font-label-md text-label-md text-on-surface font-bold">
                          Machine &amp; Processing Fee
                        </span>
                        <span className="font-body-md text-xs text-on-surface-variant">
                          Automated terminal operational charge waived
                        </span>
                      </div>
                    </div>
                    <span className="font-label-lg text-label-lg text-tertiary font-extrabold">
                      ₹0.00 (Free)
                    </span>
                  </div>

                  <div className="flex items-center justify-between p-space-md rounded-xl bg-surface-container-low">
                    <div className="flex items-center gap-space-sm">
                      <span className="material-symbols-outlined text-secondary text-[22px]">receipt_long</span>
                      <div className="flex flex-col">
                        <span className="font-label-md text-label-md text-on-surface font-bold">
                          Taxes &amp; Statutory Levies (GST)
                        </span>
                        <span className="font-body-md text-xs text-on-surface-variant">
                          CGST 9% + SGST 9% included in base rate
                        </span>
                      </div>
                    </div>
                    <span className="font-label-lg text-label-lg text-on-surface-variant font-semibold">
                      Included
                    </span>
                  </div>
                </div>

                <div className="p-space-md rounded-xl bg-surface-container flex items-center gap-space-sm">
                  <span className="material-symbols-outlined text-primary text-[24px]">info</span>
                  <p className="font-body-md text-body-md text-on-surface">
                    Your document will be securely sent to the laser printer immediately upon payment verification.
                  </p>
                </div>
              </div>
            </div>

            {/* Right 4 Cols */}
            <div className="lg:col-span-4 flex flex-col gap-space-md">
              <div className="bg-surface-container-lowest rounded-2xl p-space-lg shadow-md flex flex-col gap-space-md border border-surface-container-high text-left">
                <span className="font-label-md text-label-md tracking-wider uppercase text-on-surface-variant font-bold">
                  Payment Summary
                </span>

                <div className="bg-surface-container-high rounded-2xl p-space-lg flex flex-col items-center text-center gap-space-xs">
                  <span className="font-label-lg text-label-lg text-primary uppercase font-bold tracking-wider">
                    TOTAL PAYABLE
                  </span>
                  <div className="font-display-kiosk text-display-kiosk text-primary tracking-tight font-extrabold flex items-center">
                    <span>₹{totalPrice}</span>
                  </div>
                  <span className="font-body-md text-body-md text-on-surface-variant">
                    All taxes &amp; handling included
                  </span>
                </div>

                <div className="flex flex-col gap-space-xs pt-space-xs">
                  <span className="font-label-md text-label-md text-on-surface font-bold">
                    Accepted Payment Modes:
                  </span>
                  <div className="grid grid-cols-3 gap-space-xs">
                    <div className="flex flex-col items-center justify-center p-space-sm rounded-xl bg-surface-container-low text-center gap-1 border border-surface-container-high">
                      <span className="material-symbols-outlined text-primary text-[22px]">
                        qr_code_scanner
                      </span>
                      <span className="font-label-md text-xs text-on-surface font-semibold">
                        UPI / QR
                      </span>
                    </div>
                    <div className="flex flex-col items-center justify-center p-space-sm rounded-xl bg-surface-container-low text-center gap-1 border border-surface-container-high">
                      <span className="material-symbols-outlined text-primary text-[22px]">credit_card</span>
                      <span className="font-label-md text-xs text-on-surface font-semibold">
                        Debit/Credit
                      </span>
                    </div>
                    <div className="flex flex-col items-center justify-center p-space-sm rounded-xl bg-surface-container-low text-center gap-1 border border-surface-container-high">
                      <span className="material-symbols-outlined text-primary text-[22px]">contactless</span>
                      <span className="font-label-md text-xs text-on-surface font-semibold">
                        Tap &amp; Pay
                      </span>
                    </div>
                  </div>
                </div>

                <div className="p-space-sm rounded-xl bg-surface-container-low flex items-center gap-space-xs text-on-surface-variant text-xs">
                  <span className="material-symbols-outlined text-tertiary text-[20px]">
                    format_image_left
                  </span>
                  <span>256-bit encrypted point-of-sale transaction</span>
                </div>
              </div>

              {/* Fast Output Guaranteed Card */}
              <div className="rounded-2xl overflow-hidden shadow-sm relative h-48 bg-gradient-to-tr from-slate-900 via-primary-container to-blue-900 flex flex-col justify-end p-space-md text-inverse-on-surface text-left border border-surface-container-high">
                <div className="absolute top-4 right-4 text-white/30">
                  <span className="material-symbols-outlined text-[64px]">print</span>
                </div>
                <span className="font-label-md text-label-md text-tertiary-fixed font-bold">
                  Fast Output Guaranteed
                </span>
                <span className="font-body-md text-body-md text-white/90">
                  {totalPages} pages will print in approximately {estPrintTimeSeconds} seconds
                </span>
              </div>
            </div>
          </div>

          {/* Bottom Execution Dock */}
          <div className="w-full bg-surface-container-lowest rounded-2xl p-space-md shadow-md flex flex-col sm:flex-row items-center justify-between gap-space-md border border-surface-container-high">
            <button
              type="button"
              onClick={() => navigate('/confirm')}
              className="w-full sm:w-auto min-w-[220px] h-14 px-space-lg rounded-xl bg-surface-container hover:bg-surface-container-high text-on-surface font-label-lg text-label-lg flex items-center justify-center gap-space-xs transition-all active:scale-95 cursor-pointer font-semibold"
            >
              <span className="material-symbols-outlined text-[24px]">arrow_back</span>
              <span>Back to Confirm</span>
            </button>

            <div className="flex items-center gap-space-md w-full sm:w-auto justify-end">
              <div className="hidden md:flex flex-col text-right">
                <span className="font-body-md text-xs text-on-surface-variant">Final Payable</span>
                <span className="font-headline-md text-headline-md text-primary font-bold">
                  ₹{totalPrice}.00
                </span>
              </div>

              <button
                type="button"
                onClick={() => navigate('/payment')}
                className="w-full sm:w-auto min-w-[280px] sm:min-w-[320px] h-16 px-space-xl rounded-full bg-primary-container hover:bg-primary text-on-primary font-label-lg text-label-lg flex items-center justify-center gap-space-sm shadow-lg transition-all active:scale-95 cursor-pointer font-bold"
              >
                <span>Proceed to Payment (₹{totalPrice})</span>
                <span className="material-symbols-outlined text-[24px]">arrow_forward</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
