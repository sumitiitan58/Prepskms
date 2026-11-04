import React, { useEffect, useState } from 'react';
import {
  subscribeStudyMaterials,
  resolveCloudFileUrl,
} from '../services/firebase.js';

const SUBJECT_FILTERS = ['ALL', 'Physics', 'Chemistry', 'Mathematics', 'Biology'];

export default function StudyMaterials() {
  const [materials, setMaterials] = useState([]);
  const [selectedSubject, setSelectedSubject] = useState('ALL');
  const [selectedExam, setSelectedExam] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (
      typeof window !== 'undefined' &&
      Array.isArray(window.state?.materials)
    ) {
      setMaterials(window.state.materials);
    }

    const unsub = subscribeStudyMaterials((cloudMaterials) => {
      const localList =
        typeof window !== 'undefined' && Array.isArray(window.state?.materials)
          ? window.state.materials
          : [];
      const mergedMap = new Map();
      [...localList, ...cloudMaterials].forEach((item) => {
        if (item && item.id) {
          mergedMap.set(item.id, item);
        }
      });
      setMaterials(Array.from(mergedMap.values()));
    });

    return () => unsub();
  }, []);

  const filteredMaterials = materials.filter((m) => {
    const subjMatch =
      selectedSubject === 'ALL' ||
      (m.subject || 'Physics').toLowerCase() === selectedSubject.toLowerCase();
    const examMatch =
      selectedExam === 'ALL' ||
      (m.exam || 'JEE').toUpperCase() === selectedExam.toUpperCase();
    const q = searchQuery.trim().toLowerCase();
    const searchMatch =
      !q ||
      (m.title || '').toLowerCase().includes(q) ||
      (m.chapter || '').toLowerCase().includes(q) ||
      (m.subject || '').toLowerCase().includes(q);
    return subjMatch && examMatch && searchMatch;
  });

  const handlePreviewPdf = (item) => {
    if (typeof window !== 'undefined') {
      if (typeof window.openInAppPdfModal === 'function') {
        window.openInAppPdfModal(item);
        return;
      }
      if (typeof window.openPrepskmCloudPdf === 'function') {
        window.openPrepskmCloudPdf(item.id);
      }
    }
  };

  const handleDirectDownload = async (e, item) => {
    e.stopPropagation();
    const rawUrl = item.pdf_url || item.downloadUrl || '';
    if (!rawUrl || rawUrl === '#' || rawUrl.startsWith('#prepskm-local-file:')) {
      handlePreviewPdf(item);
      return;
    }
    try {
      const resolved = await resolveCloudFileUrl(rawUrl);
      const a = document.createElement('a');
      a.href = resolved;
      a.download =
        item.fileName ||
        `${(item.title || 'Prepskm_Notes').replace(/\s+/g, '_')}.pdf`;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (_err) {
      handlePreviewPdf(item);
    }
  };

  const getSubjectAccent = (subject) => {
    switch (subject) {
      case 'Chemistry':
        return {
          badge: 'bg-[#10B981]/15 text-[#10B981] border-[#10B981]/30',
          thumbBg: 'from-emerald-950 to-slate-900 border-emerald-500/30',
          code: 'CHEM',
        };
      case 'Mathematics':
        return {
          badge: 'bg-[#4F46E5]/20 text-indigo-300 border-[#4F46E5]/40',
          thumbBg: 'from-indigo-950 to-slate-900 border-indigo-500/30',
          code: 'MATH',
        };
      case 'Biology':
        return {
          badge: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
          thumbBg: 'from-amber-950 to-slate-900 border-amber-500/30',
          code: 'BIO',
        };
      default:
        return {
          badge: 'bg-[#3B82F6]/20 text-blue-300 border-[#3B82F6]/40',
          thumbBg: 'from-blue-950 to-slate-900 border-blue-500/30',
          code: 'PHYS',
        };
    }
  };

  return (
    <div className="space-y-4 text-slate-100">
      {/* Compact Header & Filter Controls */}
      <div className="bg-[#151D2F] border border-[#1E293B] rounded-2xl p-4 sm:p-5 shadow-lg space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded bg-[#3B82F6] text-white text-[10px] font-black uppercase tracking-wider">
                Cloud PDF Vault
              </span>
              <span className="px-2 py-0.5 rounded bg-[#10B981]/15 text-[#10B981] border border-[#10B981]/30 text-[10px] font-bold">
                In-App Reader + Device Download
              </span>
            </div>
            <h2 className="text-base sm:text-lg font-black text-white mt-1">
              Formula Sheets, PYQ Banks &amp; Handwritten Notes
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search notes or PYQs..."
              className="px-3 py-1.5 rounded-xl bg-[#0B0F19] border border-[#1E293B] text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#4F46E5]"
            />
            <select
              value={selectedExam}
              onChange={(e) => setSelectedExam(e.target.value)}
              className="px-3 py-1.5 rounded-xl bg-[#0B0F19] border border-[#1E293B] text-xs font-bold text-slate-200 focus:outline-none focus:border-[#4F46E5]"
            >
              <option value="ALL">All Exams</option>
              <option value="JEE">JEE Main &amp; Adv</option>
              <option value="NEET">NEET UG</option>
            </select>
          </div>
        </div>

        {/* Subject Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
          {SUBJECT_FILTERS.map((subj) => {
            const active = selectedSubject === subj;
            return (
              <button
                key={subj}
                type="button"
                onClick={() => setSelectedSubject(subj)}
                className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition shrink-0 cursor-pointer ${
                  active
                    ? 'bg-[#4F46E5] text-white shadow-sm shadow-indigo-500/30'
                    : 'bg-[#0B0F19] text-slate-300 border border-[#1E293B] hover:border-[#3B82F6]/50'
                }`}
              >
                {subj === 'ALL' ? 'All Subjects' : subj}
              </button>
            );
          })}
        </div>
      </div>

      {/* Space-Efficient 2-per-Row Compact Grid */}
      {filteredMaterials.length === 0 ? (
        <div className="bg-[#151D2F] border border-[#1E293B] rounded-2xl p-8 text-center space-y-2">
          <div className="text-sm font-black text-white">
            No study materials found for this filter
          </div>
          <p className="text-xs text-slate-400">
            Switch to &ldquo;All Subjects&rdquo; or upload a new PDF in the Admin Dashboard.
          </p>
        </div>
      ) : (
        <div
          className="grid grid-cols-2 gap-2.5 sm:gap-3.5"
          data-testid="compact-pdf-grid"
        >
          {filteredMaterials.map((item) => {
            const accent = getSubjectAccent(item.subject);
            return (
              <div
                key={item.id}
                onClick={() => handlePreviewPdf(item)}
                className="group bg-[#151D2F] hover:bg-[#192339] border border-[#1E293B] hover:border-[#3B82F6] rounded-xl p-2.5 sm:p-3 transition-all cursor-pointer flex items-center gap-2.5 sm:gap-3.5 shadow-sm"
              >
                {/* Compact Left 16:9 Thumbnail (~74px to 90px width) */}
                <div
                  className={`w-[74px] sm:w-[90px] aspect-video rounded-lg bg-gradient-to-br ${accent.thumbBg} border flex flex-col items-center justify-center shrink-0 relative overflow-hidden`}
                >
                  <span className="text-[10px] font-black tracking-widest text-white/90">
                    {accent.code}
                  </span>
                  <span className="text-[8px] font-mono uppercase px-1.5 py-0.2 rounded bg-black/40 text-emerald-300 mt-0.5">
                    PDF
                  </span>
                </div>

                {/* Compact Right Details & Action */}
                <div className="flex-1 min-w-0 flex flex-col justify-between gap-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span
                      className={`px-1.5 py-0.5 rounded text-[9px] font-black uppercase border ${accent.badge}`}
                    >
                      {item.subject || 'Physics'}
                    </span>
                    <span className="text-[10px] text-slate-400 truncate">
                      {item.sectionName || item.chapter || 'Notes'}
                    </span>
                  </div>

                  <h3 className="text-xs sm:text-sm font-extrabold text-white leading-snug line-clamp-1 group-hover:text-[#3B82F6] transition-colors">
                    {item.title}
                  </h3>

                  <div className="flex items-center justify-between gap-1.5 pt-0.5">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handlePreviewPdf(item);
                      }}
                      className="px-2.5 py-1 rounded-lg bg-[#4F46E5] hover:bg-[#3B82F6] text-white text-[10px] font-black transition cursor-pointer"
                    >
                      Read PDF
                    </button>
                    <button
                      type="button"
                      onClick={(e) => handleDirectDownload(e, item)}
                      className="px-2 py-1 rounded-lg bg-[#0B0F19] hover:bg-slate-800 text-slate-300 border border-[#1E293B] text-[10px] font-bold transition cursor-pointer hidden sm:inline-flex items-center gap-1"
                      title="Download PDF to Device"
                    >
                      <span>⬇</span>
                      <span>Save</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
