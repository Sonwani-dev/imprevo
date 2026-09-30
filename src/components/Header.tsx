import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useKiosk } from '../context/KioskContext';
import { ImprevoLogo } from './ImprevoLogo';

export const Header: React.FC = () => {
  const location = useLocation();
  const { setIsCallShopkeeperOpen, language, setLanguage } = useKiosk();
  const [timeStr, setTimeStr] = useState<string>('04:32 PM');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTimeStr(
        now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })
      );
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  const steps = [
    { num: '1', name: 'Upload', path: '/upload' },
    { num: '2', name: 'Confirm', path: '/confirm' },
    { num: '3', name: 'Payment', path: '/payment' },
    { num: '4', name: 'Printing', path: '/printing' },
  ];

  const getCurrentStepIndex = () => {
    const p = location.pathname;
    if (p.includes('upload')) return 0;
    if (p.includes('confirm')) return 1;
    if (p.includes('summary') || p.includes('payment')) return 2;
    if (p.includes('printing') || p.includes('complete')) return 3;
    return -1;
  };

  const currentStep = getCurrentStepIndex();

  return (
    <header className="fixed top-0 w-full z-50 bg-surface-container-lowest shadow-[0_1px_6px_rgba(0,0,0,0.04)] border-b border-surface-container-high">
      <div className="h-14 sm:h-16 w-full px-3 sm:px-6 lg:px-margin-kiosk flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center gap-2 sm:gap-3">
          <Link to="/" className="flex items-center gap-2 group">
            <ImprevoLogo showText={false} size="sm" className="group-hover:scale-105 transition-transform w-8 h-8 sm:w-9 sm:h-9" />
            <span className="font-headline-sm sm:font-headline-md text-base sm:text-headline-md text-primary font-bold tracking-tight">
              Imprevo
            </span>
          </Link>

          {/* Mobile Current Step Pill */}
          {currentStep >= 0 && (
            <span className="lg:hidden ml-1 px-2 py-0.5 rounded-full bg-primary-container text-on-primary-container text-[11px] font-bold">
              Step {currentStep + 1}/4
            </span>
          )}
        </div>

        {/* Central 4-Step Stepper (Desktop) */}
        {currentStep >= 0 && (
          <div className="hidden lg:flex items-center gap-space-md">
            <nav className="flex items-center gap-space-sm bg-surface-container-low px-space-sm py-1 rounded-xl">
              {steps.map((step, idx) => {
                const isActive = idx === currentStep;
                const isCompleted = idx < currentStep;

                let stateClasses =
                  'px-3 py-1.5 rounded-lg font-label-md text-xs text-on-surface-variant hover:text-on-surface transition-colors flex items-center gap-1.5';

                if (isActive) {
                  stateClasses =
                    'px-3 py-1.5 transition-colors bg-primary-container text-on-primary-container font-bold rounded-lg flex items-center gap-1.5 shadow-sm text-xs';
                } else if (isCompleted) {
                  stateClasses =
                    'px-3 py-1.5 rounded-lg font-label-md text-xs text-tertiary font-medium transition-colors flex items-center gap-1.5';
                }

                return (
                  <React.Fragment key={step.path}>
                    <Link to={step.path} className={stateClasses}>
                      {isCompleted ? (
                        <span className="material-symbols-outlined text-[16px]">check_circle</span>
                      ) : null}
                      <span>
                        {step.num}. {step.name}
                      </span>
                    </Link>
                    {idx < steps.length - 1 && (
                      <span className="material-symbols-outlined text-outline text-[14px]">
                        chevron_right
                      </span>
                    )}
                  </React.Fragment>
                );
              })}
            </nav>
          </div>
        )}

        {/* Right Side Utility Controls */}
        <div className="flex items-center gap-1.5 sm:gap-3">
          <button
            onClick={() => setIsCallShopkeeperOpen(true)}
            className="flex items-center gap-1 px-2.5 sm:px-3 py-1.5 rounded-xl bg-error-container text-on-error-container text-xs font-bold hover:opacity-90 active:scale-95 transition-all shadow-sm cursor-pointer"
            type="button"
            title="Call Shopkeeper Assistance"
          >
            <span className="material-symbols-outlined text-[18px]">support_agent</span>
            <span className="hidden sm:inline">Help</span>
          </button>

          <div className="hidden md:flex items-center gap-1 px-2 py-1 rounded-lg bg-surface-container-low text-on-surface text-xs font-mono">
            <span className="material-symbols-outlined text-primary text-[16px]">schedule</span>
            <span>{timeStr}</span>
          </div>

          <button
            onClick={() => setLanguage(language === 'en' ? 'hi' : 'en')}
            className="px-2 py-1 rounded-lg bg-surface-container-high hover:bg-surface-container-highest text-on-surface text-xs font-bold transition-colors cursor-pointer"
            type="button"
          >
            {language === 'en' ? 'HI' : 'EN'}
          </button>
        </div>
      </div>
    </header>
  );
};
