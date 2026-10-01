import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import type { ReactNode } from 'react';
import { api } from '../services/api';

export type KioskStateMode = 'ready' | 'empty' | 'error';
export type PaymentMethod = 'upi' | 'card' | 'nb';
export type ColorMode = 'bw' | 'color';
export type Language = 'en' | 'hi' | 'kn' | 'mr';
export type Orientation = 'portrait' | 'landscape';
export type PageSelectionMode = 'all' | 'custom';

export function parsePageRange(rangeStr: string, maxPages: number): number[] {
  if (maxPages <= 0) return [1];
  const trimmed = (rangeStr || '').trim();
  if (!trimmed || trimmed.toLowerCase() === 'all') {
    return Array.from({ length: maxPages }, (_, i) => i + 1);
  }
  const pages = new Set<number>();
  // Split by comma, semicolon, or whitespace (handles "2,3,10", "2, 3, 10", "1-3, 5")
  const parts = trimmed.split(/[,;\s]+/);
  for (const part of parts) {
    const p = part.trim();
    if (!p) continue;
    if (p.includes('-')) {
      const [startStr, endStr] = p.split('-');
      const start = parseInt(startStr, 10);
      const end = parseInt(endStr, 10);
      if (!isNaN(start) && !isNaN(end)) {
        const low = Math.max(1, Math.min(start, end));
        const high = Math.min(maxPages, Math.max(start, end));
        for (let i = low; i <= high; i++) {
          pages.add(i);
        }
      } else if (!isNaN(start) && isNaN(end)) {
        if (start >= 1 && start <= maxPages) {
          pages.add(start);
        }
      }
    } else {
      const num = parseInt(p, 10);
      if (!isNaN(num) && num >= 1 && num <= maxPages) {
        pages.add(num);
      }
    }
  }
  const result = Array.from(pages).sort((a, b) => a - b);
  return result.length > 0 ? result : [1];
}

export interface KioskContextType {
  // Document State
  file: File | null;
  fileName: string;
  fileSize: string;
  fileFormat: string;
  fileUrl: string;
  fileBlobUrl: string;
  totalPages: number;
  setTotalPages: (pages: number) => void;

  // Print Configuration Options
  orientation: Orientation;
  setOrientation: (o: Orientation) => void;
  contentRotation: number;
  setContentRotation: (deg: number) => void;
  rotateContent90: () => void;
  pageSelectionMode: PageSelectionMode;
  setPageSelectionMode: (m: PageSelectionMode) => void;
  customPageRange: string;
  setCustomPageRange: (r: string) => void;
  effectivePages: number;
  selectedPagesList: number[];

  colorMode: ColorMode;
  setColorMode: (mode: ColorMode) => void;
  copies: number;
  setCopies: (copies: number) => void;
  isDuplex: boolean;
  setIsDuplex: (duplex: boolean) => void;

  paperSize: string;
  paperGsm: string;
  ratePerPage: number;
  totalPrice: number;
  estPrintTimeSeconds: number;
  isUploading: boolean;
  uploadError: string | null;

  // Kiosk Telemetry
  terminalId: string;
  kioskMode: KioskStateMode;
  printerStatus: 'Online' | 'Printing' | 'Ready';
  paperCount: number;
  tonerLevel: number;
  language: Language;
  isDbConnected: boolean;

  // Order & Payment
  orderId: string;
  paymentMethod: PaymentMethod;
  paymentStatus: 'idle' | 'processing' | 'success';
  txnId: string;

  // Printing Execution
  currentPagePrinting: number;
  printProgress: number;
  remainingSeconds: number;
  isPrinting: boolean;
  isPrintComplete: boolean;

  // UI Modals
  isCallShopkeeperOpen: boolean;
  isWhatsAppModalOpen: boolean;
  isUsbModalOpen: boolean;
  isCloudPinModalOpen: boolean;

  // Setters & Actions
  setKioskMode: (mode: KioskStateMode) => void;
  setLanguage: (lang: Language) => void;
  setPaymentMethod: (method: PaymentMethod) => void;
  handleFileUpload: (file: File) => Promise<boolean>;
  removeFile: () => void;
  loadSampleDocument: (name: string, pages: number, size: string) => void;
  simulatePaymentSuccess: (details?: {
    razorpay_payment_id?: string;
    payment_method?: string;
    txn_id?: string;
  }) => Promise<void>;
  simulateNextPrintingPage: () => void;
  simulateFinishPrinting: () => void;
  resetSession: () => void;
  syncOrderWithDb: () => Promise<void>;

  // Modal Controls
  setIsCallShopkeeperOpen: (open: boolean) => void;
  setIsWhatsAppModalOpen: (open: boolean) => void;
  setIsUsbModalOpen: (open: boolean) => void;
  setIsCloudPinModalOpen: (open: boolean) => void;
}

const KioskContext = createContext<KioskContextType | undefined>(undefined);

export const KioskProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // Document State
  const [file, setFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState<string>('');
  const [fileSize, setFileSize] = useState<string>('');
  const [fileFormat, setFileFormat] = useState<string>('');
  const [fileUrl, setFileUrl] = useState<string>('');
  const [fileBlobUrl, setFileBlobUrl] = useState<string>('');
  const [totalPages, setTotalPages] = useState<number>(0);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Print Configuration States
  const [orientation, setOrientation] = useState<Orientation>('portrait');
  const [contentRotation, setContentRotation] = useState<number>(0);

  const rotateContent90 = useCallback(() => {
    setContentRotation((prev) => (prev + 90) % 360);
  }, []);
  const [pageSelectionMode, setPageSelectionMode] = useState<PageSelectionMode>('all');
  const [customPageRange, setCustomPageRange] = useState<string>('');
  const [colorMode, setColorMode] = useState<ColorMode>('bw');
  const [copies, setCopies] = useState<number>(1);
  const [isDuplex, setIsDuplex] = useState<boolean>(false); // Default to single sided
  const paperSize = 'A4';
  const paperGsm = '75 GSM High White';

  // Dynamic rates (defaults to 2 for B&W and 10 for Color)
  const [bwRate, setBwRate] = useState<number>(2);
  const [colorRate, setColorRate] = useState<number>(10);
  const ratePerPage = colorMode === 'bw' ? bwRate : colorRate;

  // Selected pages calculation
  const selectedPagesList = useMemo(() => {
    if (pageSelectionMode === 'all') {
      return Array.from({ length: Math.max(1, totalPages) }, (_, i) => i + 1);
    }
    return parsePageRange(customPageRange, totalPages);
  }, [pageSelectionMode, customPageRange, totalPages]);

  const effectivePages = totalPages > 0 ? selectedPagesList.length : 0;
  const totalPrice = effectivePages * copies * ratePerPage;
  const estPrintTimeSeconds = Math.max(5, Math.round(effectivePages * 1.5));

  // Telemetry
  const terminalId = '#04';
  const [kioskMode, setKioskModeState] = useState<KioskStateMode>('ready');
  const [printerStatus, setPrinterStatus] = useState<'Online' | 'Printing' | 'Ready'>('Online');
  const [paperCount, setPaperCount] = useState<number>(450);
  const [tonerLevel, setTonerLevel] = useState<number>(94);
  const [language, setLanguageState] = useState<Language>('en');
  const [isDbConnected, setIsDbConnected] = useState<boolean>(false);

  // Order
  const [orderId, setOrderId] = useState<string>(() => `#ORD-${Math.floor(10000 + Math.random() * 90000)}`);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('upi');
  const [paymentStatus, setPaymentStatus] = useState<'idle' | 'processing' | 'success'>('idle');
  const [txnId, setTxnId] = useState<string>('');

  // Printing
  const [currentPagePrinting, setCurrentPagePrinting] = useState<number>(0);
  const [printProgress, setPrintProgress] = useState<number>(0);
  const [remainingSeconds, setRemainingSeconds] = useState<number>(0);
  const [isPrinting, setIsPrinting] = useState<boolean>(false);
  const [isPrintComplete, setIsPrintComplete] = useState<boolean>(false);

  // Modals
  const [isCallShopkeeperOpen, setIsCallShopkeeperOpenState] = useState<boolean>(false);
  const [isWhatsAppModalOpen, setIsWhatsAppModalOpen] = useState<boolean>(false);
  const [isUsbModalOpen, setIsUsbModalOpen] = useState<boolean>(false);
  const [isCloudPinModalOpen, setIsCloudPinModalOpen] = useState<boolean>(false);

  // Sync initial state from MySQL backend
  useEffect(() => {
    async function initTelemetry() {
      try {
        const data = await api.getTerminalStatus();
        if (data.success && data.terminal) {
          setIsDbConnected(true);
          setPaperCount(data.terminal.paper_count);
          setTonerLevel(data.terminal.toner_level);
          setPrinterStatus(data.terminal.status as any);
          setKioskModeState(data.terminal.mode);
          if (data.terminal.language) {
            setLanguageState(data.terminal.language as Language);
          }
        }
        if (data.pricing) {
          const bw = data.pricing.find((p) => p.color_mode === 'bw');
          const col = data.pricing.find((p) => p.color_mode === 'color');
          if (bw) setBwRate(Number(bw.rate_per_page));
          if (col) setColorRate(Number(col.rate_per_page));
        }
      } catch (err) {
        console.warn('Could not sync terminal from database, using offline fallback', err);
        setIsDbConnected(false);
      }
    }

    initTelemetry();
  }, []);

  const setKioskMode = useCallback(async (mode: KioskStateMode) => {
    setKioskModeState(mode);
    try {
      await api.updateTerminal({ mode });
    } catch {
      // offline fallback
    }
  }, []);

  const setLanguage = useCallback(async (lang: Language) => {
    setLanguageState(lang);
    try {
      await api.updateTerminal({ language: lang });
    } catch {
      // offline fallback
    }
  }, []);

  const syncOrderWithDb = useCallback(async () => {
    // Only persist orders to database once payment is completed
    const docPagesCount = effectivePages || totalPages || 1;
    const totalPrintSheets = docPagesCount * (copies || 1);
    try {
      await api.createOrder({
        id: orderId,
        fileName,
        fileSize,
        fileFormat,
        docPages: docPagesCount,
        totalPages: totalPrintSheets,
        colorMode,
        copies,
        isDuplex,
        ratePerPage,
        totalPrice,
        paymentMethod,
        paymentStatus,
        orientation,
        pageRange: pageSelectionMode === 'all' ? 'all' : customPageRange,
      });
    } catch (err) {
      console.warn('Error syncing order to DB:', err);
    }
  }, [orderId, fileName, fileSize, fileFormat, effectivePages, totalPages, colorMode, copies, isDuplex, ratePerPage, totalPrice, paymentMethod, paymentStatus, orientation, pageSelectionMode, customPageRange]);

  // Real file ingestion & immediate Object URL creation
  const handleFileUpload = async (uploadedFile: File): Promise<boolean> => {
    setIsUploading(true);
    setUploadError(null);

    try {
      setFile(uploadedFile);
      setFileName(uploadedFile.name);

      // Create instantaneous local object URL for previewing
      const localBlob = URL.createObjectURL(uploadedFile);
      setFileBlobUrl(localBlob);
      setFileUrl(localBlob);

      // Real size calculation
      const sizeFormatted =
        uploadedFile.size < 1024 * 1024
          ? `${(uploadedFile.size / 1024).toFixed(1)} KB`
          : `${(uploadedFile.size / (1024 * 1024)).toFixed(2)} MB`;
      setFileSize(sizeFormatted);

      // Format inspection
      let format = 'Document';
      const isPdf = uploadedFile.type === 'application/pdf' || uploadedFile.name.toLowerCase().endsWith('.pdf');
      const isImage = uploadedFile.type.startsWith('image/') || Boolean(uploadedFile.name.toLowerCase().match(/\.(jpg|jpeg|png|webp|gif|bmp|tiff|svg)$/i));
      if (isPdf) {
        format = 'PDF Document';
      } else if (isImage) {
        format = `${uploadedFile.type.split('/')[1]?.toUpperCase() || 'Image'} Photo`;
      }
      setFileFormat(format);

      // Default selections: All documents and photos default to portrait
      setOrientation('portrait');
      setContentRotation(0);

      // - Color will be B&W
      setColorMode('bw');

      // - Default number of copies is 1
      setCopies(1);

      // - Side will be default to single sided
      setIsDuplex(false);

      // - Page selection mode default to all
      setPageSelectionMode('all');

      // Extract real page count from PDF binary stream
      let detectedPages = 1;
      if (isPdf) {
        try {
          const buffer = await uploadedFile.arrayBuffer();
          const text = new TextDecoder('latin1').decode(new Uint8Array(buffer));
          const matches = text.match(/\/Type\s*\/Page\b(?!\s*s)/g);
          if (matches && matches.length > 0) {
            detectedPages = matches.length;
          } else {
            const countMatch = text.match(/\/Type\s*\/Pages[\s\S]*?\/Count\s+(\d+)/);
            if (countMatch && countMatch[1]) {
              detectedPages = parseInt(countMatch[1], 10);
            }
          }
        } catch (e) {
          console.warn('Failed to parse PDF pages client-side:', e);
        }
      }
      setTotalPages(detectedPages);
      setCustomPageRange(`1-${detectedPages}`);

      // Upload file to Express API & MySQL database
      try {
        const uploadRes = await api.uploadFile(uploadedFile, detectedPages, orderId);
        if (uploadRes.success && uploadRes.document) {
          // If server returns URL, keep local blob as preferred or fallback
          if (uploadRes.document.page_count) {
            setTotalPages(Number(uploadRes.document.page_count));
          }
        }
      } catch (err) {
        console.warn('Backend file upload fallback:', err);
      }

      setKioskModeState('ready');
      setIsUploading(false);
      return true;
    } catch (err: any) {
      console.error('File upload error:', err);
      setUploadError(err.message || 'Failed to upload document');
      setIsUploading(false);
      return false;
    }
  };

  const removeFile = () => {
    if (fileBlobUrl) {
      URL.revokeObjectURL(fileBlobUrl);
    }
    setFile(null);
    setFileName('');
    setFileSize('');
    setFileFormat('');
    setFileUrl('');
    setFileBlobUrl('');
    setTotalPages(0);
    setCustomPageRange('');
    setUploadError(null);
  };

  const loadSampleDocument = (name: string, pages: number, size: string) => {
    setFileName(name);
    setTotalPages(pages);
    setFileSize(size);
    setFileFormat('PDF Document');
    setCustomPageRange(`1-${pages}`);
    setOrientation('portrait');
    setContentRotation(0);
    setColorMode('bw');
    setCopies(1);
    setIsDuplex(false);
    setPageSelectionMode('all');
    setKioskModeState('ready');
  };

  const simulatePaymentSuccess = async (details?: {
    razorpay_payment_id?: string;
    payment_method?: string;
    txn_id?: string;
  }) => {
    setPaymentStatus('processing');
    const generatedTxn =
      details?.txn_id ||
      details?.razorpay_payment_id ||
      `TXN-${Math.floor(100000000 + Math.random() * 900000000)}`;

    const chosenMethod: PaymentMethod =
      details?.payment_method === 'card'
        ? 'card'
        : details?.payment_method === 'netbanking'
        ? 'nb'
        : 'upi';
    setPaymentMethod(chosenMethod);

    return new Promise<void>((resolve) => {
      setTimeout(async () => {
        const docPagesCount = effectivePages || totalPages || 1;
        const totalPrintSheets = docPagesCount * (copies || 1);

        setPaymentStatus('success');
        setTxnId(generatedTxn);
        setPrinterStatus('Printing');
        setIsPrinting(true);
        setCurrentPagePrinting(1);
        setPrintProgress(Math.round((1 / Math.max(1, totalPrintSheets)) * 100));
        setRemainingSeconds(Math.max(8, totalPrintSheets * 3));

        try {
          await api.createOrder({
            id: orderId,
            fileName,
            fileSize,
            fileFormat,
            docPages: docPagesCount,
            totalPages: totalPrintSheets,
            colorMode,
            copies,
            isDuplex,
            ratePerPage,
            totalPrice,
            paymentMethod: chosenMethod,
            paymentStatus: 'success',
            orientation,
            rotation: contentRotation,
            pageRange: pageSelectionMode === 'all' ? 'all' : customPageRange,
          });
          await api.updatePayment(orderId, {
            paymentStatus: 'success',
            paymentMethod: chosenMethod,
            txnId: generatedTxn,
          });
        } catch (err) {
          console.warn('Error updating payment in DB:', err);
        }

        resolve();
      }, 1000);
    });
  };

  const simulateNextPrintingPage = async () => {
    const targetPages = effectivePages || totalPages || 1;
    if (currentPagePrinting < targetPages) {
      const nextPg = currentPagePrinting + 1;
      setCurrentPagePrinting(nextPg);
      const pct = Math.round((nextPg / targetPages) * 100);
      setPrintProgress(pct);
      setRemainingSeconds(Math.max(2, (targetPages - nextPg) * 2));
      if (nextPg === targetPages) {
        setIsPrintComplete(true);
        setPrinterStatus('Ready');
        try {
          await api.updatePrintProgress(orderId, {
            printStatus: 'completed',
            currentPagePrinting: nextPg,
            printProgress: 100,
          });
        } catch {
          // offline fallback
        }
      }
    } else {
      setIsPrintComplete(true);
      setPrinterStatus('Ready');
      try {
        await api.updatePrintProgress(orderId, {
          printStatus: 'completed',
          currentPagePrinting: targetPages,
          printProgress: 100,
        });
      } catch {
        // offline fallback
      }
    }
  };

  const simulateFinishPrinting = async () => {
    const targetPages = effectivePages || totalPages || 1;
    setCurrentPagePrinting(targetPages);
    setPrintProgress(100);
    setRemainingSeconds(0);
    setIsPrinting(false);
    setIsPrintComplete(true);
    setPrinterStatus('Ready');

    try {
      await api.updatePrintProgress(orderId, {
        printStatus: 'completed',
        currentPagePrinting: targetPages,
        printProgress: 100,
      });
      const updated = await api.getTerminalStatus();
      if (updated.success) {
        setPaperCount(updated.terminal.paper_count);
      }
    } catch {
      // offline fallback
    }
  };

  const resetSession = () => {
    const nextOrderId = `#ORD-${Math.floor(10000 + Math.random() * 90000)}`;
    if (fileBlobUrl) {
      URL.revokeObjectURL(fileBlobUrl);
    }
    setFile(null);
    setFileName('');
    setFileSize('');
    setFileFormat('');
    setFileUrl('');
    setFileBlobUrl('');
    setTotalPages(0);
    setOrientation('portrait');
    setPageSelectionMode('all');
    setCustomPageRange('');
    setColorMode('bw');
    setCopies(1);
    setIsDuplex(false);
    setKioskModeState('ready');
    setPaymentStatus('idle');
    setOrderId(nextOrderId);
    setCurrentPagePrinting(0);
    setPrintProgress(0);
    setRemainingSeconds(0);
    setIsPrinting(false);
    setIsPrintComplete(false);
    setPrinterStatus('Online');
    setUploadError(null);
  };

  const setIsCallShopkeeperOpen = useCallback(async (open: boolean) => {
    setIsCallShopkeeperOpenState(open);
    if (open) {
      try {
        await api.callShopkeeper('Kiosk user requested shopkeeper assistance');
      } catch {
        // offline fallback
      }
    }
  }, []);

  return (
    <KioskContext.Provider
      value={{
        file,
        fileName,
        fileSize,
        fileFormat,
        fileUrl,
        fileBlobUrl,
        totalPages,
        setTotalPages,
        orientation,
        setOrientation,
        contentRotation,
        setContentRotation,
        rotateContent90,
        pageSelectionMode,
        setPageSelectionMode,
        customPageRange,
        setCustomPageRange,
        effectivePages,
        selectedPagesList,
        colorMode,
        copies,
        isDuplex,
        paperSize,
        paperGsm,
        ratePerPage,
        totalPrice,
        estPrintTimeSeconds,
        isUploading,
        uploadError,
        terminalId,
        kioskMode,
        printerStatus,
        paperCount,
        tonerLevel,
        language,
        isDbConnected,
        orderId,
        paymentMethod,
        paymentStatus,
        txnId,
        currentPagePrinting,
        printProgress,
        remainingSeconds,
        isPrinting,
        isPrintComplete,
        isCallShopkeeperOpen,
        isWhatsAppModalOpen,
        isUsbModalOpen,
        isCloudPinModalOpen,
        setKioskMode,
        setLanguage,
        setColorMode,
        setCopies,
        setIsDuplex,
        setPaymentMethod,
        handleFileUpload,
        removeFile,
        loadSampleDocument,
        simulatePaymentSuccess,
        simulateNextPrintingPage,
        simulateFinishPrinting,
        resetSession,
        syncOrderWithDb,
        setIsCallShopkeeperOpen,
        setIsWhatsAppModalOpen,
        setIsUsbModalOpen,
        setIsCloudPinModalOpen,
      }}
    >
      {children}
    </KioskContext.Provider>
  );
};

export const useKiosk = () => {
  const context = useContext(KioskContext);
  if (!context) {
    throw new Error('useKiosk must be used within a KioskProvider');
  }
  return context;
};
