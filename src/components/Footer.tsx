import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useKiosk } from '../context/KioskContext';

export const Footer: React.FC = () => {
  const navigate = useNavigate();
  const { resetSession } = useKiosk();
  const [showConfirmRestart, setShowConfirmRestart] = useState(false);

  const handleRestart = () => {
    resetSession();
    setShowConfirmRestart(false);
    navigate('/');
  };

  return (
    <>
      <footer className="hidden md:block fixed bottom-0 w-full z-40 bg-surface-container-lowest shadow-[0_-1px_8px_rgba(0,0,0,0.04)] border-t border-surface-container-high">
        <div className="h-14 sm:h-16 w-full px-4 sm:px-8 lg:px-margin-kiosk flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-space-md font-body-md text-xs sm:text-body-md text-on-surface-variant truncate">
            <span className="flex items-center gap-1.5 text-tertiary font-label-md text-label-md">
              <span className="material-symbols-outlined text-[18px]">verified_user</span>
              <span className="hidden sm:inline">Self-Clearing Protection</span>
            </span>
            <span>•</span>
            <span className="truncate">
              Powered by Imprevo v1.0 • Fast &amp; Secure Local Printing
            </span>
          </div>

          <div className="flex items-center gap-space-md shrink-0">
            <button
              onClick={() => setShowConfirmRestart(true)}
              className="flex items-center gap-space-xs px-space-md py-2 rounded-xl bg-surface-container hover:bg-surface-container-high text-error font-label-md text-label-md active:scale-95 transition-all cursor-pointer shadow-sm"
              type="button"
            >
              <span className="material-symbols-outlined text-[18px]">close</span>
              <span className="hidden sm:inline">Cancel &amp; Restart</span>
            </button>
          </div>
        </div>
      </footer>

      {/* Restart Confirmation Dialog */}
      {showConfirmRestart && (
        <div className="fixed inset-0 z-50 bg-inverse-surface/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface-container-lowest rounded-3xl p-8 max-w-md w-full shadow-2xl border border-outline-variant flex flex-col items-center text-center animate-in fade-in zoom-in duration-200">
            <div className="w-16 h-16 rounded-full bg-error-container text-error flex items-center justify-center mb-4">
              <span className="material-symbols-outlined text-[36px]">restart_alt</span>
            </div>
            <h3 className="font-headline-lg text-headline-lg text-on-surface font-bold mb-2">
              Cancel &amp; Restart Session?
            </h3>
            <p className="font-body-md text-body-md text-on-surface-variant mb-6">
              This will clear your uploaded document and all active print configurations. Are you sure you want to return to the welcome screen?
            </p>
            <div className="flex items-center gap-4 w-full">
              <button
                onClick={() => setShowConfirmRestart(false)}
                className="flex-1 h-14 rounded-xl bg-surface-container hover:bg-surface-container-high text-on-surface font-label-lg text-label-lg font-semibold transition-all active:scale-95 cursor-pointer"
              >
                No, Keep Going
              </button>
              <button
                onClick={handleRestart}
                className="flex-1 h-14 rounded-xl bg-error text-on-error font-label-lg text-label-lg font-bold transition-all active:scale-95 shadow-md cursor-pointer"
              >
                Yes, Restart
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
