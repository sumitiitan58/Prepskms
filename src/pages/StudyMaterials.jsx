import React, { useState, useEffect } from 'react';
import { FileText, Download, Eye, Filter } from 'lucide-react';
import {
  subscribeStudyMaterials,
  downloadPdfToDevice,
} from '../services/firebase';
import PDFPreviewModal from '../components/PDFPreviewModal';

const SUBJECT_FILTERS = ['All', 'Physics', 'Chemistry', 'Mathematics', 'Biology'];

export default function StudyMaterials() {
  const [materials, setMaterials] = useState([]);
  const [selectedSubject, setSelectedSubject] = useState('All');
  const [previewItem, setPreviewItem] = useState(null);
  const [downloadingId, setDownloadingId] = useState(null);

  useEffect(() => {
    const unsub = subscribeStudyMaterials((list) => {
      setMaterials(list || []);
    });
    return () => unsub();
  }, []);

  const filtered = materials.filter((m) => {
    if (selectedSubject === 'All') return true;
    return String(m.subject || '').toLowerCase() === selectedSubject.toLowerCase();
  });

  const handleDirectDownload = async (e, mat) => {
    e.stopPropagation();
    setDownloadingId(mat.id);
    try {
      await downloadPdfToDevice(mat);
    } catch {
      setPreviewItem(mat);
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Filter Header (Light Theme) */}
      <div className="flex flex-wrap items-center justify-between gap-2 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-3">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-indigo-600" />
          <span className="text-xs font-extrabold text-[#1E293B] uppercase tracking-wider">
            Cloud Study Materials & Formula PDFs ({filtered.length})
          </span>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          <Filter className="w-3.5 h-3.5 text-slate-400 mr-1" />
          {SUBJECT_FILTERS.map((subj) => (
            <button
              key={subj}
              type="button"
              onClick={() => setSelectedSubject(subj)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${
                selectedSubject === subj
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-[#FFFFFF] text-[#1E293B] hover:bg-indigo-50 border border-[#E2E8F0]'
              }`}
            >
              {subj}
            </button>
          ))}
        </div>
      </div>

      {/* Space-Efficient 2-per-Row Compact Grid (Light Theme) */}
      {filtered.length === 0 ? (
        <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-6 text-center text-xs text-slate-500">
          No PDF study notes published for <span className="text-[#1E293B] font-bold">{selectedSubject}</span> yet. Upload PDFs from the Admin Panel to sync across all devices in real time.
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
          {filtered.map((mat) => (
            <div
              key={mat.id}
              onClick={() => setPreviewItem(mat)}
              className="group bg-[#F8FAFC] hover:bg-[#FFFFFF] border border-[#E2E8F0] hover:border-indigo-400 rounded-xl p-2 sm:p-2.5 flex items-center gap-2.5 transition-all cursor-pointer shadow-2xs"
            >
              {/* Left Compact 16:9 Thumbnail (~70px to 90px width) */}
              <div className="w-[72px] sm:w-[86px] aspect-video rounded-lg bg-indigo-50 border border-indigo-100 shrink-0 flex flex-col items-center justify-center text-center p-1">
                <FileText className="w-4 h-4 text-indigo-600 mb-0.5" />
                <span className="text-[8px] font-extrabold uppercase tracking-wider text-indigo-700">
                  PDF NOTE
                </span>
              </div>

              {/* Right Details: Title, Subject Tag, and Preview/Download Actions */}
              <div className="min-w-0 flex-1 flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className="px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200 text-[9px] font-extrabold uppercase tracking-wider">
                      {mat.subject || 'Physics'}
                    </span>
                  </div>
                  <h4 className="text-[11px] sm:text-xs font-extrabold text-[#1E293B] line-clamp-1 group-hover:text-indigo-600">
                    {mat.title}
                  </h4>
                </div>

                <div className="mt-1.5 flex items-center justify-between gap-1">
                  <span className="text-[10px] text-slate-500 truncate">
                    {mat.chapter || 'Formula Sheet'}
                  </span>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setPreviewItem(mat);
                      }}
                      className="px-2 py-0.5 rounded bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-extrabold inline-flex items-center gap-1"
                    >
                      <Eye className="w-2.5 h-2.5" /> Preview
                    </button>
                    <button
                      type="button"
                      onClick={(e) => handleDirectDownload(e, mat)}
                      disabled={downloadingId === mat.id}
                      title="Download PDF to Device"
                      className="p-1 rounded bg-[#FFFFFF] hover:bg-indigo-50 text-indigo-700 border border-[#E2E8F0]"
                    >
                      <Download className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Embedded In-App PDF Preview Modal with Explicit Download to Device Button */}
      <PDFPreviewModal
        isOpen={Boolean(previewItem)}
        onClose={() => setPreviewItem(null)}
        material={previewItem}
      />
    </div>
  );
}
