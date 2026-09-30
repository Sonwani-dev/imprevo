import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useKiosk } from '../context/KioskContext';
import type { Language } from '../context/KioskContext';
import { ImprevoLogo } from '../components/ImprevoLogo';

export const WelcomePage: React.FC = () => {
  const navigate = useNavigate();
  const { language, setLanguage, setIsCallShopkeeperOpen } = useKiosk();

  const handleStart = () => {
    navigate('/upload');
  };

  const languages: { code: Language; label: string }[] = [
    { code: 'en', label: 'English' },
    { code: 'hi', label: 'हिंदी' },
    { code: 'kn', label: 'ಕನ್ನಡ' },
    { code: 'mr', label: 'मराठी' },
  ];

  return (
    <div className="w-full min-h-screen bg-surface flex items-center justify-center relative overflow-hidden select-none">
      {/* Ambient Decorative Atmospheric Blurs */}
      <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-primary-fixed blur-3xl opacity-40 pointer-events-none"></div>
      <div className="absolute top-1/2 -right-40 w-[30rem] h-[30rem] rounded-full bg-surface-container-high blur-3xl opacity-50 pointer-events-none"></div>
      <div className="absolute -bottom-24 left-1/3 w-80 h-80 rounded-full bg-tertiary-fixed blur-3xl opacity-20 pointer-events-none"></div>

      <div className="flex flex-col w-full min-h-screen justify-between z-10">
        {/* Top System & Status Header (Upper 15% Zone) */}
        <header className="w-full px-6 sm:px-8 py-5 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center space-x-4 bg-surface-container-lowest px-5 py-2.5 rounded-full shadow-sm">
            <div className="flex items-center space-x-2">
              <span className="relative flex h-3.5 w-3.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-tertiary opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-tertiary"></span>
              </span>
              <span className="font-label-md text-label-md text-on-surface tracking-wide uppercase font-bold">
                Terminal #04 Active
              </span>
            </div>
            <span className="w-1.5 h-1.5 rounded-full bg-outline-variant"></span>
            <span className="font-body-md text-body-md text-on-surface-variant font-medium">
              Auto-Service Kiosk
            </span>
          </div>

          {/* Multi-Language Pill Switcher for Indian Retail Context */}
          <div className="flex items-center bg-surface-container-lowest p-1.5 rounded-full shadow-sm space-x-1">
            {languages.map((l) => (
              <button
                key={l.code}
                onClick={() => setLanguage(l.code)}
                className={`px-4 py-2 rounded-full font-label-md text-label-md transition-all cursor-pointer ${
                  language === l.code
                    ? 'bg-primary text-on-primary shadow-sm font-bold'
                    : 'text-on-surface-variant hover:bg-surface-container'
                }`}
              >
                {l.label}
              </button>
            ))}
          </div>
        </header>

        {/* Main Welcoming Center Stage (Middle Canvas) */}
        <main className="flex-1 w-full max-w-6xl mx-auto px-6 py-4 flex flex-col items-center justify-center">
          {/* Hero Kiosk Card */}
          <div className="w-full bg-surface-container-lowest rounded-3xl p-6 sm:p-10 md:p-12 shadow-xl flex flex-col items-center text-center relative border border-surface-container-high/60">
            {/* Top Trust Strip */}
            <div className="inline-flex flex-wrap items-center justify-center gap-3 bg-surface-container-low px-6 py-2.5 rounded-full mb-6 text-on-surface-variant shadow-inner">
              <span className="flex items-center font-label-md text-label-md">
                <span className="text-primary mr-1.5 font-bold">⚡</span> Ultra-Fast Laser Print
              </span>
              <span className="text-outline-variant hidden sm:inline">•</span>
              <span className="flex items-center font-label-md text-label-md">
                <span className="material-symbols-outlined text-[18px] text-tertiary mr-1.5 fill-1">
                  lock
                </span>{' '}
                100% Private &amp; Auto-Deleted
              </span>
              <span className="text-outline-variant hidden sm:inline">•</span>
              <span className="flex items-center font-label-md text-label-md">
                <span className="material-symbols-outlined text-[18px] text-primary-container mr-1.5 fill-1">
                  qr_code_scanner
                </span>{' '}
                Instant UPI / Card
              </span>
            </div>

            {/* Imprevo Brand Identity */}
            <div className="flex items-center justify-center mb-4">
              <div className="w-20 h-20 bg-surface-container-low rounded-2xl p-2.5 flex items-center justify-center shadow-md">
                <ImprevoLogo showText={false} size="md" />
              </div>
            </div>

            <h1 className="font-display-kiosk text-display-kiosk text-on-surface tracking-tight uppercase mb-1 font-extrabold">
              IMPREVO
            </h1>
            <p className="font-headline-md text-headline-md text-primary font-bold tracking-tight mb-2">
              Smart Printing. Simplified.
            </p>
            <p className="font-body-xl text-body-xl text-on-surface-variant max-w-xl mx-auto mb-8">
              Print your documents quickly and easily in 3 simple steps. No app download or account needed.
            </p>

            {/* Giant Primary Touch Trigger CTA */}
            <div className="w-full max-w-md mb-10">
              <button
                onClick={handleStart}
                className="w-full h-[76px] px-10 rounded-2xl bg-primary-container text-on-primary flex items-center justify-center space-x-4 shadow-xl hover:shadow-2xl hover:bg-primary active:scale-[0.98] transition-all duration-150 cursor-pointer group"
                id="getStartedBtn"
              >
                <span className="font-headline-lg text-headline-lg font-bold tracking-wide">
                  Get Started
                </span>
                <span className="material-symbols-outlined text-[36px] transition-transform group-hover:translate-x-2">
                  arrow_forward
                </span>
              </button>
              <p className="font-body-md text-body-md text-on-surface-variant mt-3 text-center">
                Touch anywhere or tap <span className="font-bold text-on-surface">Get Started</span> to begin
              </p>
            </div>

            {/* Quick 3-Step Touch Pictorial Guide */}
            <div className="w-full grid grid-cols-1 md:grid-cols-3 gap-5 text-left">
              {/* Step 1 */}
              <div
                onClick={handleStart}
                className="bg-surface-container-low p-5 rounded-2xl flex items-start space-x-4 cursor-pointer hover:bg-surface-container transition-colors"
              >
                <div className="w-12 h-12 rounded-xl bg-primary text-on-primary flex items-center justify-center shrink-0 shadow-sm">
                  <span className="material-symbols-outlined text-[26px]">upload_file</span>
                </div>
                <div>
                  <div className="flex items-center space-x-2 mb-0.5">
                    <span className="font-label-md text-label-md text-primary font-bold">
                      STEP 01
                    </span>
                  </div>
                  <h2 className="font-headline-md text-headline-md text-on-surface mb-1 font-bold">
                    Upload File
                  </h2>
                  <p className="font-body-md text-body-md text-on-surface-variant">
                    WhatsApp QR, USB flash drive, or cloud document drop.
                  </p>
                </div>
              </div>

              {/* Step 2 */}
              <div
                onClick={handleStart}
                className="bg-surface-container-low p-5 rounded-2xl flex items-start space-x-4 cursor-pointer hover:bg-surface-container transition-colors"
              >
                <div className="w-12 h-12 rounded-xl bg-primary-fixed text-on-primary-fixed flex items-center justify-center shrink-0 shadow-sm">
                  <span className="material-symbols-outlined text-[26px]">credit_card</span>
                </div>
                <div>
                  <div className="flex items-center space-x-2 mb-0.5">
                    <span className="font-label-md text-label-md text-primary font-bold">
                      STEP 02
                    </span>
                  </div>
                  <h2 className="font-headline-md text-headline-md text-on-surface mb-1 font-bold">
                    Review &amp; Pay
                  </h2>
                  <p className="font-body-md text-body-md text-on-surface-variant">
                    Verify page preview and pay seamlessly via GPay, PhonePe, or Card.
                  </p>
                </div>
              </div>

              {/* Step 3 */}
              <div
                onClick={handleStart}
                className="bg-surface-container-low p-5 rounded-2xl flex items-start space-x-4 cursor-pointer hover:bg-surface-container transition-colors"
              >
                <div className="w-12 h-12 rounded-xl bg-tertiary text-on-tertiary flex items-center justify-center shrink-0 shadow-sm">
                  <span className="material-symbols-outlined text-[26px]">print</span>
                </div>
                <div>
                  <div className="flex items-center space-x-2 mb-0.5">
                    <span className="font-label-md text-label-md text-tertiary font-bold">
                      STEP 03
                    </span>
                  </div>
                  <h2 className="font-headline-md text-headline-md text-on-surface mb-1 font-bold">
                    Collect Prints
                  </h2>
                  <p className="font-body-md text-body-md text-on-surface-variant">
                    Laser sheets dispense directly into the illuminated tray below.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </main>

        {/* Lower Hardware Indicator Bar (Lower Dock Zone) */}
        <footer className="w-full bg-surface-container px-6 sm:px-8 py-4 mt-auto">
          <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
            {/* Live Hardware Diagnostics Chips */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center space-x-2 bg-surface-container-lowest px-4 py-2 rounded-xl shadow-sm">
                <span className="w-2.5 h-2.5 rounded-full bg-tertiary"></span>
                <span className="font-label-md text-label-md text-on-surface">Printer Status:</span>
                <span className="font-label-md text-label-md text-tertiary font-bold">Online</span>
              </div>
              <div className="flex items-center space-x-2 bg-surface-container-lowest px-4 py-2 rounded-xl shadow-sm">
                <span className="material-symbols-outlined text-[18px] text-primary">
                  description
                </span>
                <span className="font-label-md text-label-md text-on-surface">Tray A4:</span>
                <span className="font-label-md text-label-md text-on-surface-variant font-bold">
                  Ready (450 sheets)
                </span>
              </div>
              <div className="flex items-center space-x-2 bg-surface-container-lowest px-4 py-2 rounded-xl shadow-sm">
                <span className="material-symbols-outlined text-[18px] text-primary">
                  high_quality
                </span>
                <span className="font-label-md text-label-md text-on-surface">Precision:</span>
                <span className="font-label-md text-label-md text-primary font-bold">
                  1200 DPI Laser
                </span>
              </div>
            </div>

            {/* Kiosk Attribution and Attendant Assist Trigger */}
            <div className="flex items-center space-x-4">
              <span className="font-body-md text-body-md text-on-surface-variant">
                Powered by Imprevo v3.4
              </span>
              <button
                onClick={() => setIsCallShopkeeperOpen(true)}
                className="bg-surface-container-high hover:bg-surface-container-highest text-primary px-4 py-2 rounded-xl font-label-md text-label-md flex items-center space-x-1.5 active:scale-95 transition-transform cursor-pointer shadow-sm"
              >
                <span className="material-symbols-outlined text-[18px]">support_agent</span>
                <span>Help</span>
              </button>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
};
