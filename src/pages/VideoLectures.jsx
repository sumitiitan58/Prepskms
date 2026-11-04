import React, { useEffect, useState } from 'react';
import {
  subscribeVideoLectures,
  normalizeVideoTimestamps,
} from '../services/firebase.js';

const SUBJECT_FILTERS = ['ALL', 'Physics', 'Chemistry', 'Mathematics', 'Biology'];

export default function VideoLectures() {
  const [lectures, setLectures] = useState([]);
  const [selectedSubject, setSelectedSubject] = useState('ALL');
  const [selectedChapter, setSelectedChapter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    // Seed from window.state.videos initially while real-time listener connects
    if (typeof window !== 'undefined' && Array.isArray(window.state?.videos)) {
      setLectures(
        window.state.videos.map((v) => ({
          ...v,
          timestamps: normalizeVideoTimestamps(v.timestamps),
        }))
      );
    }

    const unsub = subscribeVideoLectures((cloudVideos) => {
      const localList =
        typeof window !== 'undefined' && Array.isArray(window.state?.videos)
          ? window.state.videos
          : [];
      const mergedMap = new Map();
      [...localList, ...cloudVideos].forEach((item) => {
        if (item && item.id) {
          mergedMap.set(item.id, {
            ...item,
            timestamps: normalizeVideoTimestamps(item.timestamps),
          });
        }
      });
      setLectures(Array.from(mergedMap.values()));
    });

    return () => unsub();
  }, []);

  const chapters = Array.from(
    new Set(
      lectures
        .filter(
          (v) =>
            selectedSubject === 'ALL' ||
            (v.subject || 'Physics').toLowerCase() ===
              selectedSubject.toLowerCase()
        )
        .map((v) => v.chapter || 'Core Concepts')
        .filter(Boolean)
    )
  );

  const filteredLectures = lectures.filter((v) => {
    const subjMatch =
      selectedSubject === 'ALL' ||
      (v.subject || 'Physics').toLowerCase() === selectedSubject.toLowerCase();
    const chapMatch =
      selectedChapter === 'ALL' ||
      (v.chapter || '').toLowerCase() === selectedChapter.toLowerCase();
    const q = searchQuery.trim().toLowerCase();
    const searchMatch =
      !q ||
      (v.title || '').toLowerCase().includes(q) ||
      (v.chapter || '').toLowerCase().includes(q) ||
      (v.subject || '').toLowerCase().includes(q);
    return subjMatch && chapMatch && searchMatch;
  });

  const handleOpenVideo = (video) => {
    if (typeof window !== 'undefined') {
      if (typeof window.openAdvancedVideoPlayer === 'function') {
        window.openAdvancedVideoPlayer(video);
        return;
      }
      if (typeof window.openBigVideoPlayer === 'function') {
        window.openBigVideoPlayer(video.id);
      }
    }
  };

  const getSubjectBadgeStyle = (subject) => {
    switch (subject) {
      case 'Chemistry':
        return 'bg-[#10B981]/15 text-[#10B981] border-[#10B981]/30';
      case 'Mathematics':
        return 'bg-[#4F46E5]/20 text-indigo-300 border-[#4F46E5]/40';
      case 'Biology':
        return 'bg-amber-500/15 text-amber-300 border-amber-500/30';
      default:
        return 'bg-[#3B82F6]/20 text-blue-300 border-[#3B82F6]/40';
    }
  };

  return (
    <div className="space-y-4 text-slate-100">
      {/* Compact Header & Filter Bar */}
      <div className="bg-[#151D2F] border border-[#1E293B] rounded-2xl p-4 sm:p-5 shadow-lg space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded bg-[#4F46E5] text-white text-[10px] font-black uppercase tracking-wider">
                HD Video Lectures
              </span>
              <span className="px-2 py-0.5 rounded bg-[#10B981]/15 text-[#10B981] border border-[#10B981]/30 text-[10px] font-bold">
                Firebase Real-Time Sync
              </span>
            </div>
            <h2 className="text-base sm:text-lg font-black text-white mt-1">
              Chapter-Wise Video Lectures &amp; Timestamped One-Shots
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search lecture or chapter..."
              className="px-3 py-1.5 rounded-xl bg-[#0B0F19] border border-[#1E293B] text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#4F46E5]"
            />
            <select
              value={selectedChapter}
              onChange={(e) => setSelectedChapter(e.target.value)}
              className="px-3 py-1.5 rounded-xl bg-[#0B0F19] border border-[#1E293B] text-xs font-bold text-slate-200 focus:outline-none focus:border-[#4F46E5]"
            >
              <option value="ALL">All Chapters ({chapters.length})</option>
              {chapters.map((ch) => (
                <option key={ch} value={ch}>
                  {ch}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Subject Filter Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
          {SUBJECT_FILTERS.map((subj) => {
            const active = selectedSubject === subj;
            return (
              <button
                key={subj}
                type="button"
                onClick={() => {
                  setSelectedSubject(subj);
                  setSelectedChapter('ALL');
                }}
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

      {/* Space-Efficient 2-per-Row Compact Grid (Mobile, Tablet & Desktop) */}
      {filteredLectures.length === 0 ? (
        <div className="bg-[#151D2F] border border-[#1E293B] rounded-2xl p-8 text-center space-y-2">
          <div className="text-sm font-black text-white">
            No video lectures match the selected filter
          </div>
          <p className="text-xs text-slate-400">
            Select &ldquo;All Subjects&rdquo; or upload a new lecture with chapter markers in the Admin Panel.
          </p>
        </div>
      ) : (
        <div
          className="grid grid-cols-2 gap-2.5 sm:gap-3.5"
          data-testid="compact-video-grid"
        >
          {filteredLectures.map((video) => {
            const thumb =
              video.thumbnail_url ||
              video.thumbnailUrl ||
              'https://images.unsplash.com/photo-1635070041078-e363dbe005cb?w=320&auto=format&fit=crop&q=80';
            const markers = normalizeVideoTimestamps(video.timestamps);

            return (
              <div
                key={video.id}
                onClick={() => handleOpenVideo(video)}
                className="group bg-[#151D2F] hover:bg-[#192339] border border-[#1E293B] hover:border-[#4F46E5] rounded-xl p-2.5 sm:p-3 transition-all cursor-pointer flex items-center gap-2.5 sm:gap-3.5 shadow-sm"
              >
                {/* Compact Left 16:9 Thumbnail (~70px to 90px width) */}
                <div className="w-[74px] sm:w-[90px] aspect-video rounded-lg overflow-hidden bg-[#0B0F19] border border-[#1E293B] relative shrink-0">
                  <img
                    src={thumb}
                    alt={video.title}
                    className="w-full h-full object-cover opacity-80 group-hover:opacity-100 group-hover:scale-105 transition-all"
                  />
                  <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                    <span className="w-6 h-6 rounded-full bg-[#4F46E5] text-white flex items-center justify-center text-[10px] font-black shadow">
                      ▶
                    </span>
                  </div>
                </div>

                {/* Compact Right Metadata & Action */}
                <div className="flex-1 min-w-0 flex flex-col justify-between gap-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span
                      className={`px-1.5 py-0.5 rounded text-[9px] font-black uppercase border ${getSubjectBadgeStyle(
                        video.subject
                      )}`}
                    >
                      {video.subject || 'Physics'}
                    </span>
                    <span className="text-[10px] text-slate-400 truncate max-w-[120px] sm:max-w-[180px]">
                      {video.chapter || 'Core Concepts'}
                    </span>
                  </div>

                  <h3 className="text-xs sm:text-sm font-extrabold text-white leading-snug line-clamp-1 group-hover:text-[#3B82F6] transition-colors">
                    {video.title}
                  </h3>

                  <div className="flex items-center justify-between gap-2 pt-0.5">
                    <span className="text-[10px] text-slate-400 font-mono truncate">
                      {markers.length > 0
                        ? `⏱ ${markers.length} Markers (${markers[0].time})`
                        : 'By @unfiltereddsumit'}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenVideo(video);
                      }}
                      className="px-2.5 py-1 rounded-lg bg-[#4F46E5] hover:bg-[#3B82F6] text-white text-[10px] font-black shrink-0 transition cursor-pointer"
                    >
                      Watch
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
