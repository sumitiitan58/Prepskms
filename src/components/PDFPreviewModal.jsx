import React, { useState, useEffect } from 'react';
import {
  FileText,
  Download,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Minimize2,
  X,
  CheckCircle2,
  Loader2,
  ShieldCheck,
} from 'lucide-react';
import { resolveCloudFileUrl, downloadPdfToDevice } from '../services/firebase';

export default function PDFPreviewModal({ isOpen, onClose, material }) {
  const [resolvedUrl, setResolvedUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);
  const [downloadError, setDownloadError] = useState('');
  const [zoom, setZoom] = useState(100);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    let active = true;
    setDownloadSuccess(false);
    setDownloadError('');
    if (!isOpen || !material) {
      setResolvedUrl('');
      return;
    }

    const rawUrl = material.pdf_url || material.pdfUrl || '';
    if (!rawUrl) {
      setResolvedUrl('');
      return;
    }

    setLoading(true);
    resolveCloudFileUrl(rawUrl)
      .then((url) => {
        if (active) {
          setResolvedUrl(url || '');
          setLoading(false);
        }
      })
      .catch(() => {
        if (active) {
          setResolvedUrl('');
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [isOpen, material]);

  if (!isOpen || !material) return null;

  const handleDownloadToDevice = async () => {
    setDownloading(true);
    setDownloadError('');
    try {
      await downloadPdfToDevice(material);
      setDownloadSuccess(true);
      setTimeout(() => setDownloadSuccess(false), 3500);
    } catch (err) {
      setDownloadError(err?.message || 'Unable to download PDF right now.');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={material.title || 'In-App PDF Preview'}
    >
      <div
        className={`bg-[#FFFFFF] border border-[#E2E8F0] rounded-2xl shadow-2xl flex flex-col overflow-hidden transition-all ${
          isFullscreen ? 'w-full h-full rounded-none' : 'w-full max-w-5xl h-[88vh]'
        }`}
      >
        {/* Top Control Bar */}
        <div className="px-4 py-3 bg-[#F8FAFC] border-b border-[#E2E8F0] flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-600 flex items-center justify-center shrink-0">
              <FileText className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-extrabold text-[#1E293B] truncate">
                {material.title || 'Prepskm Study Material'}
              </h3>
              <div className="flex items-center gap-2 text-[11px] text-slate-500">
                <span className="font-bold text-indigo-600">{material.subject || 'Physics'}</span>
                <span>•</span>
                <span className="truncate">{material.chapter || 'Revision Formula Sheet'}</span>
              </div>
            </div>
          </div>

          {/* Reader Toolbar + Explicit "Download to Device" Button */}
          <div className="flex items-center gap-2">
            <div className="hidden sm:flex items-center gap-1 bg-[#FFFFFF] border border-[#E2E8F0] rounded-lg px-2 py-1">
              <button
                type="button"
                onClick={() => setZoom((z) => Math.max(75, z - 15))}
                className="p-1 text-slate-600 hover:text-indigo-600 rounded"
                title="Zoom Out"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <span className="text-[11px] font-bold text-[#1E293B] px-1.5">{zoom}%</span>
              <button
                type="button"
                onClick={() => setZoom((z) => Math.min(200, z + 15))}
                className="p-1 text-slate-600 hover:text-indigo-600 rounded"
                title="Zoom In"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
            </div>

            <button
              type="button"
              onClick={handleDownloadToDevice}
              disabled={downloading}
              className="px-3.5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-xs font-extrabold flex items-center gap-1.5 shadow-xs transition-colors"
            >
              {downloading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : downloadSuccess ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Saved to Device</span>
                </>
              ) : (
                <>
                  <Download className="w-3.5 h-3.5" />
                  <span>Download to Device</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => setIsFullscreen((f) => !f)}
              className="p-2 rounded-lg bg-[#FFFFFF] border border-[#E2E8F0] text-slate-600 hover:text-[#1E293B]"
              title="Toggle Fullscreen"
            >
              {isFullscreen ? (
                <Minimize2 className="w-4 h-4" />
              ) : (
                <Maximize2 className="w-4 h-4" />
              )}
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-lg bg-[#FFFFFF] border border-[#E2E8F0] text-slate-600 hover:text-red-600 hover:border-red-200"
              aria-label="Close PDF Preview"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {downloadError && (
          <div className="px-4 py-2 bg-red-50 border-b border-red-200 text-xs font-semibold text-red-700">
            {downloadError}
          </div>
        )}

        {/* Embedded In-App PDF Viewport */}
        <div className="flex-1 bg-slate-100 overflow-auto flex items-center justify-center p-2 sm:p-4">
          {loading ? (
            <div className="flex flex-col items-center gap-2 text-slate-600">
              <Loader2 className="w-7 h-7 animate-spin text-indigo-600" />
              <p className="text-xs font-bold">Loading high-resolution PDF inside Prepskm...</p>
            </div>
          ) : resolvedUrl ? (
            <div
              className="w-full h-full bg-[#FFFFFF] rounded-xl border border-[#E2E8F0] shadow-sm overflow-hidden"
              style={{
                transform: `scale(${zoom / 100})`,
                transformOrigin: 'top center',
              }}
            >
              <iframe
                src={`${resolvedUrl}#toolbar=0&navpanes=0&scrollbar=1`}
                title={material.title || 'Prepskm Embedded PDF Reader'}
                className="w-full h-full border-0"
              />
            </div>
          ) : (
            <div className="max-w-xl w-full bg-[#FFFFFF] border border-[#E2E8F0] rounded-2xl p-6 text-center shadow-xs">
              <FileText className="w-10 h-10 text-indigo-600 mx-auto mb-3" />
              <h4 className="text-base font-extrabold text-[#1E293B] mb-1">
                {material.title}
              </h4>
              <p className="text-xs text-slate-500 mb-4">
                Subject: {material.subject || 'Physics'} • Chapter: {material.chapter || 'Core Revision'}
              </p>
              <div className="p-4 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-left text-xs text-slate-700 space-y-2 mb-4">
                <p className="font-bold text-[#1E293B]">
                  Official Prepskm Formula & Revision Summary:
                </p>
                <p>
                  This study sheet is synced with the Prepskm Cloud Library. If an admin uploads a new PDF binary in the Admin Panel, it renders directly in this embedded viewer.
                </p>
              </div>
              {material.pdf_url && (
                <button
                  type="button"
                  onClick={handleDownloadToDevice}
                  className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-extrabold inline-flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" /> Download to Device
                </button>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2.5 bg-[#F8FAFC] border-t border-[#E2E8F0] flex items-center justify-between text-[11px] text-slate-500">
          <span className="inline-flex items-center gap-1.5 font-semibold text-slate-600">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" /> Verified by Mentor Sumit (@unfiltereddsumit)
          </span>
          <span>In-App Reader • Offline Device Download Supported</span>
        </div>
      </div>
    </div>
  );
}
