import React, { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useKiosk } from '../context/KioskContext';

export const UploadPage: React.FC = () => {
  const navigate = useNavigate();
  const {
    fileName,
    fileSize,
    fileFormat,
    totalPages,
    isUploading,
    uploadError,
    handleFileUpload,
    removeFile,
  } = useKiosk();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      await handleFileUpload(e.target.files[0]);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      await handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleContinue = async () => {
    if (!fileName || totalPages === 0 || isUploading) return;
    navigate('/confirm');
  };

  const isFileReady = Boolean(fileName && totalPages > 0 && !isUploading);

  return (
    <div className="w-full min-h-[calc(100dvh-3.5rem)] md:min-h-screen pt-16 md:pt-20 pb-4 md:pb-16 bg-surface flex flex-col justify-center items-center px-4 select-none">
      <div className="w-full max-w-lg flex flex-col items-center text-center my-auto py-2">
        {/* Compact Header */}
        <div className="flex flex-col items-center mb-4">
          <span className="px-3 py-0.5 rounded-full bg-primary/10 text-primary text-[11px] uppercase tracking-wider font-bold mb-1">
            Step 1 of 4 • Document Ingestion
          </span>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-on-surface tracking-tight">
            Upload Your Document
          </h1>
          <p className="text-xs sm:text-sm text-on-surface-variant mt-1 max-w-xs">
            Choose a file from your phone or computer to preview and print.
          </p>
        </div>

        {/* Hidden Native File Input */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.png,.jpg,.jpeg,.webp"
          onChange={handleFileChange}
          className="hidden"
          id="kiosk-file-input"
        />

        {/* HERO DROP BOX (Contains everything inside - zero scrolling!) */}
        <div
          id="touch-dropzone"
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => {
            if (!isFileReady && !isUploading) {
              fileInputRef.current?.click();
            }
          }}
          className={`w-full bg-surface-container-lowest rounded-3xl p-5 sm:p-7 shadow-lg border-2 transition-all duration-200 flex flex-col items-center justify-center text-center ${
            isDragOver
              ? 'border-primary bg-primary/5 scale-[1.01] shadow-primary/20'
              : isFileReady
              ? 'border-emerald-500/40 bg-surface-container-lowest'
              : 'border-dashed border-outline-variant hover:border-primary/60 cursor-pointer'
          }`}
        >
          {/* 1. UPLOADING SPINNER STATE */}
          {isUploading && (
            <div className="py-8 flex flex-col items-center justify-center gap-3">
              <div className="w-14 h-14 rounded-full border-4 border-primary/20 border-t-primary animate-spin"></div>
              <h3 className="text-base font-bold text-on-surface">Ingesting Document...</h3>
              <p className="text-xs text-on-surface-variant max-w-xs">
                Scanning pages and verifying print dimensions...
              </p>
            </div>
          )}

          {/* 2. FILE READY STATE (Shown INSIDE the drop box!) */}
          {!isUploading && isFileReady && (
            <div className="w-full flex flex-col items-center gap-4 animate-in fade-in duration-200">
              {/* File Pill / Card Inside Box */}
              <div className="w-full bg-surface-container-low rounded-2xl p-4 border border-surface-container-high flex items-center gap-3 text-left">
                <div className="w-12 h-14 rounded-xl bg-primary-container text-on-primary-container flex flex-col items-center justify-center shrink-0 shadow-sm">
                  <span className="material-symbols-outlined text-[26px]">
                    {fileFormat.includes('PDF') ? 'picture_as_pdf' : 'image'}
                  </span>
                  <span className="text-[9px] uppercase font-black tracking-wider leading-none mt-0.5">
                    {fileFormat.includes('PDF') ? 'PDF' : 'IMG'}
                  </span>
                </div>

                <div className="flex flex-col min-w-0 flex-1">
                  <span className="text-sm sm:text-base font-bold text-on-surface truncate" title={fileName}>
                    {fileName}
                  </span>
                  <div className="flex items-center gap-2 mt-0.5 text-xs text-on-surface-variant">
                    <span>{totalPages} {totalPages === 1 ? 'Page' : 'Pages'}</span>
                    <span>•</span>
                    <span>{fileSize}</span>
                  </div>
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 mt-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                    Ready to Configure
                  </span>
                </div>
              </div>

              {/* Action Buttons Inside Box */}
              <div className="grid grid-cols-2 gap-2.5 w-full">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    fileInputRef.current?.click();
                  }}
                  className="h-11 rounded-xl bg-surface-container hover:bg-surface-container-high text-on-surface text-xs font-bold flex items-center justify-center gap-1.5 active:scale-95 transition-all cursor-pointer shadow-sm"
                >
                  <span className="material-symbols-outlined text-[16px] text-primary">sync</span>
                  <span>Change File</span>
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeFile();
                  }}
                  className="h-11 rounded-xl bg-error-container/40 hover:bg-error-container text-error text-xs font-bold flex items-center justify-center gap-1.5 active:scale-95 transition-all cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[16px]">delete</span>
                  <span>Remove</span>
                </button>
              </div>

              {/* Primary Continue Button Inside Box */}
              <button
                type="button"
                onClick={handleContinue}
                className="w-full h-14 rounded-2xl bg-primary hover:bg-primary/90 text-on-primary font-bold text-base flex items-center justify-center gap-2 shadow-lg shadow-primary/25 active:scale-95 transition-all cursor-pointer mt-1"
              >
                <span>Continue to Preview &amp; Configure</span>
                <span className="material-symbols-outlined text-[20px]">arrow_forward</span>
              </button>
            </div>
          )}

          {/* 3. EMPTY STATE (When no file uploaded yet) */}
          {!isUploading && !isFileReady && (
            <div className="flex flex-col items-center gap-3 py-4 w-full">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shadow-inner">
                <span className="material-symbols-outlined text-[36px]">cloud_upload</span>
              </div>

              <div>
                <h3 className="text-base sm:text-lg font-bold text-on-surface">
                  Drop your document here
                </h3>
                <p className="text-xs text-on-surface-variant mt-0.5 max-w-xs">
                  Tap to browse files from your device or camera
                </p>
              </div>

              <div className="flex items-center gap-3 w-full max-w-xs my-1">
                <div className="h-px flex-1 bg-outline-variant/40"></div>
                <span className="text-[10px] uppercase font-bold text-outline">or</span>
                <div className="h-px flex-1 bg-outline-variant/40"></div>
              </div>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  fileInputRef.current?.click();
                }}
                className="w-full max-w-xs h-12 rounded-xl bg-primary text-on-primary font-bold text-sm flex items-center justify-center gap-2 shadow-md hover:bg-primary/90 active:scale-95 cursor-pointer transition-all"
              >
                <span className="material-symbols-outlined text-[20px]">folder_open</span>
                <span>Choose File</span>
              </button>

              <span className="text-[11px] text-on-surface-variant/80 font-medium mt-1">
                Supports PDF, JPG, PNG • Max 50MB
              </span>
            </div>
          )}
        </div>

        {/* Upload Error Alert */}
        {uploadError && (
          <div className="mt-3 w-full p-3 rounded-xl bg-error-container text-on-error-container flex items-center gap-2 text-xs font-semibold animate-in fade-in">
            <span className="material-symbols-outlined text-[18px] text-error">error</span>
            <span>{uploadError}</span>
          </div>
        )}

        {/* Back to Home Button */}
        <button
          type="button"
          onClick={() => navigate('/')}
          className="mt-4 text-xs font-semibold text-on-surface-variant hover:text-primary flex items-center gap-1 transition-colors py-1 cursor-pointer"
        >
          <span className="material-symbols-outlined text-[16px]">arrow_back</span>
          <span>Return to Welcome Screen</span>
        </button>
      </div>
    </div>
  );
};
