import React from 'react';
import { BrowserRouter, Routes, Route, useLocation, Navigate } from 'react-router-dom';
import { KioskProvider } from './context/KioskContext';
import { Header } from './components/Header';
import { Footer } from './components/Footer';
import { CallShopkeeperModal } from './components/CallShopkeeperModal';

// Pages
import { WelcomePage } from './pages/WelcomePage';
import { UploadPage } from './pages/UploadPage';
import { ConfirmPage } from './pages/ConfirmPage';
import { OrderSummaryPage } from './pages/OrderSummaryPage';
import { PaymentPage } from './pages/PaymentPage';
import { PrintingPage } from './pages/PrintingPage';
import { CompletePage } from './pages/CompletePage';
import { DashboardPage } from './pages/DashboardPage';

const AppLayout: React.FC = () => {
  const location = useLocation();

  // Welcome ('/') and Complete ('/complete') have integrated full-screen layouts
  const isKioskStepPage =
    location.pathname.startsWith('/upload') ||
    location.pathname.startsWith('/confirm') ||
    location.pathname.startsWith('/summary') ||
    location.pathname.startsWith('/payment') ||
    location.pathname.startsWith('/printing');

  const showFooter =
    isKioskStepPage &&
    !location.pathname.startsWith('/confirm') &&
    !location.pathname.startsWith('/payment');

  return (
    <div className="min-h-screen bg-surface font-body-md text-on-surface flex flex-col justify-between">
      {isKioskStepPage && <Header />}

      <main className="flex-1 w-full">
        <Routes>
          <Route path="/" element={<WelcomePage />} />
          <Route path="/upload" element={<UploadPage />} />
          <Route path="/confirm" element={<ConfirmPage />} />
          <Route path="/summary" element={<OrderSummaryPage />} />
          <Route path="/payment" element={<PaymentPage />} />
          <Route path="/printing" element={<PrintingPage />} />
          <Route path="/complete" element={<CompletePage />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>

      {showFooter && <Footer />}

      {/* Global Modals */}
      <CallShopkeeperModal />
    </div>
  );
};

export function App() {
  return (
    <KioskProvider>
      <BrowserRouter>
        <AppLayout />
      </BrowserRouter>
    </KioskProvider>
  );
}

export default App;
