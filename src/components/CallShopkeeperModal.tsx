import React, { useState } from 'react';
import { useKiosk } from '../context/KioskContext';

export const CallShopkeeperModal: React.FC = () => {
  const { isCallShopkeeperOpen, setIsCallShopkeeperOpen, terminalId } = useKiosk();
  const [alertSent, setAlertSent] = useState(false);

  if (!isCallShopkeeperOpen) return null;

  const handleCallAttendant = () => {
    setAlertSent(true);
    setTimeout(() => {
      setAlertSent(false);
      setIsCallShopkeeperOpen(false);
    }, 2500);
  };

  return (
    <div className="fixed inset-0 z-50 bg-inverse-surface/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-surface-container-lowest rounded-3xl p-8 max-w-xl w-full shadow-2xl border-2 border-outline-variant flex flex-col gap-6 animate-in fade-in zoom-in duration-200">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-surface-container-high">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-error-container text-error flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-[32px]">support_agent</span>
            </div>
            <div>
              <span className="font-label-md text-xs uppercase tracking-wider text-error font-bold">
                Operator Escalation Protocol
              </span>
              <h2 className="font-headline-lg text-headline-lg text-on-surface font-bold">
                Call Shop Attendant
              </h2>
            </div>
          </div>
          <button
            onClick={() => setIsCallShopkeeperOpen(false)}
            className="w-10 h-10 rounded-full bg-surface-container hover:bg-surface-container-high flex items-center justify-center text-on-surface-variant cursor-pointer transition-colors"
          >
            <span className="material-symbols-outlined text-[24px]">close</span>
          </button>
        </div>

        {/* Content */}
        {alertSent ? (
          <div className="p-6 rounded-2xl bg-tertiary-container text-on-tertiary flex flex-col items-center text-center gap-3">
            <span className="material-symbols-outlined text-[48px] animate-bounce">
              notifications_active
            </span>
            <h3 className="font-headline-md text-headline-md font-bold">
              Shop Attendant Notified!
            </h3>
            <p className="font-body-md text-body-md opacity-90">
              A beacon has been triggered at Terminal {terminalId}. Staff is arriving at your terminal right now.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <p className="font-body-md text-body-md text-on-surface-variant">
              Need assistance with document alignment, custom paper sizes, cash payment, or paper jams? Our retail counter staff is ready to help.
            </p>

            {/* Diagnostic Details Grid */}
            <div className="grid grid-cols-2 gap-3 p-4 rounded-2xl bg-surface-container-low text-left">
              <div className="flex flex-col">
                <span className="text-xs text-on-surface-variant uppercase font-semibold">
                  Terminal ID
                </span>
                <span className="font-headline-md text-base text-on-surface font-bold">
                  {terminalId} (Laser Unit 02)
                </span>
              </div>
              <div className="flex flex-col">
                <span className="text-xs text-on-surface-variant uppercase font-semibold">
                  Attendant Counter
                </span>
                <span className="font-headline-md text-base text-tertiary font-bold">
                  Counter 1 (Stationed)
                </span>
              </div>
              <div className="flex flex-col">
                <span className="text-xs text-on-surface-variant uppercase font-semibold">
                  Paper Sensor
                </span>
                <span className="font-body-md text-sm text-on-surface">Tray 1 A4 • Ready</span>
              </div>
              <div className="flex flex-col">
                <span className="text-xs text-on-surface-variant uppercase font-semibold">
                  Toner Cartridge
                </span>
                <span className="font-body-md text-sm text-on-surface">94% Healthy</span>
              </div>
            </div>

            {/* Step-by-step guidance */}
            <div className="flex items-center gap-3 p-3 rounded-xl bg-surface-container text-xs text-on-surface-variant">
              <span className="material-symbols-outlined text-primary text-[22px]">info</span>
              <span>
                Tapping "Ring Attendant Beacon" will flash the top overhead light above Terminal {terminalId} and ring the shopkeeper's desk.
              </span>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        {!alertSent && (
          <div className="flex items-center gap-4">
            <button
              onClick={() => setIsCallShopkeeperOpen(false)}
              className="flex-1 h-14 rounded-2xl bg-surface-container hover:bg-surface-container-high text-on-surface font-label-lg text-label-lg font-semibold transition-all active:scale-95 cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleCallAttendant}
              className="flex-1 h-14 rounded-2xl bg-error text-on-error font-label-lg text-label-lg font-bold flex items-center justify-center gap-2 shadow-lg hover:bg-red-700 transition-all active:scale-95 cursor-pointer"
            >
              <span className="material-symbols-outlined text-[24px]">notifications_active</span>
              <span>Ring Attendant Beacon</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
