import React, { useState, useEffect } from 'react';
import { Play, Clock, Video, Filter } from 'lucide-react';
import { subscribeVideoLectures, resolveCloudFileUrl } from '../services/firebase';
import AdvancedVideoPlayer from '../components/AdvancedVideoPlayer';

const SUBJECT_FILTERS = ['All', 'Physics', 'Chemistry', 'Mathematics', 'Biology'];

export default function VideoLectures() {
  const [lectures, setLectures] = useState([]);
  const [selectedSubject, setSelectedSubject] = useState('All');
  const [activeLecture, setActiveLecture] = useState(null);
  const [resolvedThumbMap, setResolvedThumbMap] = useState({});

  useEffect(() => {
    const unsub = subscribeVideoLectures((list) => {
      setLectures(list || []);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    lectures.forEach((lec) => {
      const thumb = lec.thumbnail_url || lec.thumbnailUrl;
      if (thumb && thumb.startsWith('#prepskm-cloud-file:') && !resolvedThumbMap[lec.id]) {
        resolveCloudFileUrl(thumb).then((blobUrl) => {
          if (blobUrl) {
            setResolvedThumbMap((prev) => ({ ...prev, [lec.id]: blobUrl }));
          }
        });
      }
    });
  }, [lectures, resolvedThumbMap]);

  const filtered = lectures.filter((l) => {
    if (selectedSubject === 'All') return true;
    return String(l.subject || '').toLowerCase() === selectedSubject.toLowerCase();
  });

  return (
    <div className="space-y-4">
      {/* Header & Subject Filter Bar (Clean Light Theme) */}
      <div className="flex flex-wrap items-center justify-between gap-2 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-3">
        <div className="flex items-center gap-2">
          <Video className="w-4 h-4 text-indigo-600" />
          <span className="text-xs font-extrabold text-[#1E293B] uppercase tracking-wider">
            Cloud Video Library ({filtered.length})
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

      {/* Active Embedded High-Performance Video Player */}
      {activeLecture && (
        <div className="mb-4">
          <AdvancedVideoPlayer
            lecture={activeLecture}
            onClose={() => setActiveLecture(null)}
          />
        </div>
      )}

      {/* Space-Efficient 2-per-Row Compact Grid (Light Theme) */}
      {filtered.length === 0 ? (
        <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-6 text-center text-xs text-slate-500">
          No video lectures published for <span className="text-[#1E293B] font-bold">{selectedSubject}</span> yet. Upload new lectures from the Admin Panel to sync across all devices in real time.
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
          {filtered.map((lec) => {
            const rawThumb = resolvedThumbMap[lec.id] || lec.thumbnail_url || lec.thumbnailUrl || '';
            const tsCount = Array.isArray(lec.timestamps) ? lec.timestamps.length : 0;

            return (
              <div
                key={lec.id}
                onClick={() => setActiveLecture(lec)}
                className="group bg-[#F8FAFC] hover:bg-[#FFFFFF] border border-[#E2E8F0] hover:border-indigo-400 rounded-xl p-2 sm:p-2.5 flex items-center gap-2.5 transition-all cursor-pointer shadow-2xs"
              >
                {/* Left Compact 16:9 Thumbnail (~70px to 90px width) */}
                <div className="relative w-[74px] sm:w-[90px] aspect-video rounded-lg overflow-hidden bg-indigo-50 border border-indigo-100 shrink-0 flex items-center justify-center">
                  {rawThumb ? (
                    <img
                      src={rawThumb}
                      alt={lec.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-indigo-100 to-blue-50 flex items-center justify-center">
                      <Play className="w-4 h-4 text-indigo-600" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-indigo-900/10 group-hover:bg-indigo-900/5 flex items-center justify-center transition-colors">
                    <div className="w-6 h-6 rounded-full bg-indigo-600/95 flex items-center justify-center shadow-xs">
                      <Play className="w-3 h-3 text-white fill-white ml-0.5" />
                    </div>
                  </div>
                </div>

                {/* Right Details: Title, Subject Tag, and Watch Action Button */}
                <div className="min-w-0 flex-1 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                      <span className="px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200 text-[9px] font-extrabold uppercase tracking-wider">
                        {lec.subject || 'Physics'}
                      </span>
                      {tsCount > 0 && (
                        <span className="text-[9px] text-slate-500 flex items-center gap-0.5">
                          <Clock className="w-2.5 h-2.5 text-indigo-600" /> {tsCount} markers
                        </span>
                      )}
                    </div>
                    <h4 className="text-[11px] sm:text-xs font-extrabold text-[#1E293B] line-clamp-1 group-hover:text-indigo-600">
                      {lec.title}
                    </h4>
                  </div>

                  <div className="mt-1.5 flex items-center justify-between gap-1">
                    <span className="text-[10px] text-slate-500 truncate">
                      {lec.chapter || 'Masterclass'}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveLecture(lec);
                      }}
                      className="px-2 py-0.5 rounded bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-extrabold shrink-0"
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
