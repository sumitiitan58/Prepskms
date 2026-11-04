import React, { useState, useRef, useEffect } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  RotateCw,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  Gauge,
  Settings,
  Clock,
  Tv,
  X,
  CheckCircle2,
} from 'lucide-react';
import { resolveCloudFileUrl } from '../services/firebase';
import { calculateVideoSkipTime } from '../utils/testEngine';

function parseTimeStrToSeconds(timeStr) {
  if (!timeStr) return 0;
  const parts = String(timeStr)
    .trim()
    .split(':')
    .map((n) => parseInt(n, 10) || 0);
  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }
  if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  }
  return parts[0] || 0;
}

function formatSeconds(sec) {
  const s = Math.max(0, Math.floor(Number(sec) || 0));
  const hrs = Math.floor(s / 3600);
  const mins = Math.floor((s % 3600) / 60);
  const rem = s % 60;
  if (hrs > 0) {
    return `${hrs}:${String(mins).padStart(2, '0')}:${String(rem).padStart(2, '0')}`;
  }
  return `${String(mins).padStart(2, '0')}:${String(rem).padStart(2, '0')}`;
}

function extractYouTubeEmbedId(url) {
  if (!url || typeof url !== 'string') return null;
  const reg = /(?:youtube\.com\/(?:watch\?v=|embed\/|live\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
  const match = url.match(reg);
  return match ? match[1] : null;
}

const SPEED_OPTIONS = [0.75, 1, 1.25, 1.5, 2];
const QUALITY_OPTIONS = ['1080p HD', '720p', '480p', 'Auto'];

export default function AdvancedVideoPlayer({
  lecture,
  videoUrl: propVideoUrl,
  title: propTitle,
  subject: propSubject,
  chapter: propChapter,
  timestamps: propTimestamps,
  onClose,
}) {
  const rawUrl = lecture?.video_url || lecture?.videoUrl || propVideoUrl || '';
  const title = lecture?.title || propTitle || 'Prepskm HD Lecture';
  const subject = lecture?.subject || propSubject || 'Physics';
  const chapter = lecture?.chapter || propChapter || 'Masterclass';
  const timestamps = Array.isArray(lecture?.timestamps)
    ? lecture.timestamps
    : Array.isArray(propTimestamps)
    ? propTimestamps
    : [];

  const videoRef = useRef(null);
  const containerRef = useRef(null);
  const singleTapTimerRef = useRef(null);
  const lastTapRef = useRef({ time: 0, side: null });

  const [resolvedUrl, setResolvedUrl] = useState('');
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [quality, setQuality] = useState('1080p HD');
  const [isMuted, setIsMuted] = useState(false);
  const [isTheaterMode, setIsTheaterMode] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [skipFeedback, setSkipFeedback] = useState(null); // 'left' | 'right' | null
  const [ytStartSeconds, setYtStartSeconds] = useState(0);

  useEffect(() => {
    let active = true;
    resolveCloudFileUrl(rawUrl).then((url) => {
      if (active) setResolvedUrl(url || rawUrl);
    });
    return () => {
      active = false;
    };
  }, [rawUrl]);

  const ytId = extractYouTubeEmbedId(resolvedUrl);

  const togglePlayPause = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      v.play().catch(() => {});
      setIsPlaying(true);
    } else {
      v.pause();
      setIsPlaying(false);
    }
  };

  const handleSkip = (direction) => {
    setSkipFeedback(direction);
    setTimeout(() => setSkipFeedback(null), 650);

    if (ytId) {
      const next = calculateVideoSkipTime(ytStartSeconds || currentTime, duration || 3600, direction, 10);
      setYtStartSeconds(next);
      setCurrentTime(next);
      return;
    }

    const v = videoRef.current;
    if (!v) return;
    const nextTime = calculateVideoSkipTime(v.currentTime, v.duration, direction, 10);
    v.currentTime = nextTime;
    setCurrentTime(nextTime);
  };

  /**
   * Supports:
   * - One-tap anywhere: Play / Pause
   * - Double-tap left/right: -10s / +10s skip
   */
  const handleSurfaceInteraction = (e) => {
    if (ytId) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const side = clickX < rect.width / 2 ? 'left' : 'right';
    const now = Date.now();

    if (now - lastTapRef.current.time < 280 && lastTapRef.current.side === side) {
      if (singleTapTimerRef.current) {
        clearTimeout(singleTapTimerRef.current);
        singleTapTimerRef.current = null;
      }
      handleSkip(side);
      lastTapRef.current = { time: 0, side: null };
    } else {
      lastTapRef.current = { time: now, side };
      singleTapTimerRef.current = setTimeout(() => {
        togglePlayPause();
        singleTapTimerRef.current = null;
      }, 250);
    }
  };

  const handleSpeedChange = (speed) => {
    setPlaybackRate(speed);
    if (videoRef.current) {
      videoRef.current.playbackRate = speed;
    }
  };

  const jumpToTimestamp = (timeStr) => {
    const targetSec = parseTimeStrToSeconds(timeStr);
    if (ytId) {
      setYtStartSeconds(targetSec);
      setCurrentTime(targetSec);
      return;
    }
    if (videoRef.current) {
      videoRef.current.currentTime = targetSec;
      videoRef.current.play().catch(() => {});
      setIsPlaying(true);
      setCurrentTime(targetSec);
    }
  };

  const toggleFullscreen = async () => {
    const el = containerRef.current;
    if (!el) return;
    try {
      if (!document.fullscreenElement) {
        await el.requestFullscreen();
        setIsFullscreen(true);
        if (window.screen?.orientation?.lock) {
          window.screen.orientation.lock('landscape').catch(() => {});
        }
      } else {
        await document.exitFullscreen();
        setIsFullscreen(false);
      }
    } catch {
      setIsFullscreen((prev) => !prev);
    }
  };

  return (
    <div
      ref={containerRef}
      className={`bg-[#FFFFFF] border border-[#E2E8F0] rounded-2xl shadow-lg overflow-hidden transition-all ${
        isTheaterMode ? 'w-full max-w-6xl mx-auto' : 'w-full max-w-4xl mx-auto'
      }`}
    >
      {/* Top Lecture Header */}
      <div className="px-4 py-3 bg-[#F8FAFC] border-b border-[#E2E8F0] flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded bg-indigo-50 border border-indigo-200 text-indigo-700 text-[10px] font-extrabold uppercase">
              {subject}
            </span>
            <span className="text-xs font-semibold text-slate-500 truncate">{chapter}</span>
          </div>
          <h3 className="text-sm sm:text-base font-extrabold text-[#1E293B] truncate mt-0.5">
            {title}
          </h3>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setIsTheaterMode((t) => !t)}
            className={`hidden md:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-bold transition-colors ${
              isTheaterMode
                ? 'bg-indigo-600 text-white border-indigo-600'
                : 'bg-[#FFFFFF] text-[#1E293B] border-[#E2E8F0] hover:border-indigo-300'
            }`}
            title="Toggle Desktop Theater Mode"
          >
            <Tv className="w-3.5 h-3.5" />
            <span>Theater</span>
          </button>

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg bg-[#FFFFFF] border border-[#E2E8F0] text-slate-600 hover:text-red-600"
              aria-label="Close Video Player"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Main Responsive Video Surface (16:9 / Edge-to-Edge Landscape on Mobile Rotation) */}
      <div
        onClick={handleSurfaceInteraction}
        className="relative aspect-video w-full bg-slate-950 select-none overflow-hidden cursor-pointer"
      >
        {ytId ? (
          <iframe
            key={`${ytId}_${ytStartSeconds}`}
            src={`https://www.youtube.com/embed/${ytId}?autoplay=1&rel=0&modestbranding=1&playsinline=1&start=${ytStartSeconds}`}
            title={title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
            allowFullScreen
            className="w-full h-full border-0"
          />
        ) : (
          <video
            ref={videoRef}
            src={resolvedUrl}
            playsInline
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
            onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
            onLoadedMetadata={(e) => setDuration(e.currentTarget.duration || 0)}
            className="w-full h-full object-contain"
          />
        )}

        {/* Double-Tap -10s / +10s Visual Feedback Overlay */}
        {skipFeedback === 'left' && (
          <div className="absolute inset-y-0 left-0 w-1/3 bg-white/15 backdrop-blur-xs flex flex-col items-center justify-center text-white pointer-events-none animate-fade-in">
            <RotateCcw className="w-8 h-8 mb-1" />
            <span className="text-xs font-extrabold">-10s Rewind</span>
          </div>
        )}
        {skipFeedback === 'right' && (
          <div className="absolute inset-y-0 right-0 w-1/3 bg-white/15 backdrop-blur-xs flex flex-col items-center justify-center text-white pointer-events-none animate-fade-in">
            <RotateCw className="w-8 h-8 mb-1" />
            <span className="text-xs font-extrabold">+10s Forward</span>
          </div>
        )}
      </div>

      {/* Interactive Timeline Seek Bar with Chapter Timestamp Markers */}
      <div className="px-4 pt-3 pb-2 bg-[#FFFFFF] border-t border-[#E2E8F0]">
        <div className="relative flex items-center">
          <input
            type="range"
            min={0}
            max={Math.max(1, duration || 3600)}
            value={currentTime}
            onChange={(e) => {
              const val = Number(e.target.value);
              setCurrentTime(val);
              if (videoRef.current) videoRef.current.currentTime = val;
            }}
            aria-label="Lecture Timeline Seekbar"
            className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
          />
          {/* Chapter Markers on Seekbar */}
          {duration > 0 &&
            timestamps.map((ts, idx) => {
              const sec = parseTimeStrToSeconds(ts.time);
              const pct = Math.min(99, Math.max(1, (sec / duration) * 100));
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => jumpToTimestamp(ts.time)}
                  style={{ left: `${pct}%` }}
                  title={`${ts.time} — ${ts.title || ts.label}`}
                  className="absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-indigo-600 border-2 border-white shadow-xs hover:scale-125 transition-transform"
                />
              );
            })}
        </div>

        {/* Player Controls Bar: Play/Pause, -10s/+10s, Speed (0.75x-2x), Quality, Fullscreen */}
        <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            {!ytId && (
              <button
                type="button"
                onClick={togglePlayPause}
                className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-extrabold inline-flex items-center gap-1.5"
              >
                {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                <span>{isPlaying ? 'Pause' : 'Play'}</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => handleSkip('left')}
              className="px-2.5 py-1.5 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0] hover:border-indigo-300 text-[#1E293B] text-xs font-bold inline-flex items-center gap-1"
              title="Double-tap left or click to rewind 10 seconds"
            >
              <RotateCcw className="w-3.5 h-3.5 text-indigo-600" />
              <span>-10s</span>
            </button>

            <button
              type="button"
              onClick={() => handleSkip('right')}
              className="px-2.5 py-1.5 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0] hover:border-indigo-300 text-[#1E293B] text-xs font-bold inline-flex items-center gap-1"
              title="Double-tap right or click to skip 10 seconds"
            >
              <RotateCw className="w-3.5 h-3.5 text-indigo-600" />
              <span>+10s</span>
            </button>

            {!ytId && (
              <button
                type="button"
                onClick={() => {
                  const nextMute = !isMuted;
                  setIsMuted(nextMute);
                  if (videoRef.current) videoRef.current.muted = nextMute;
                }}
                className="p-1.5 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0] text-slate-700 hover:text-indigo-600"
                aria-label="Toggle Mute"
              >
                {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              </button>
            )}

            <span className="text-xs font-bold text-slate-600 ml-1">
              {formatSeconds(currentTime)}
              {duration > 0 ? ` / ${formatSeconds(duration)}` : ''}
            </span>
          </div>

          {/* Playback Speed Controller (0.75x, 1x, 1.25x, 1.5x, 2x) + Quality Selector + Fullscreen */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg px-2 py-1">
              <Gauge className="w-3.5 h-3.5 text-indigo-600" />
              <span className="text-[11px] font-bold text-slate-500 hidden sm:inline">Speed:</span>
              {SPEED_OPTIONS.map((spd) => (
                <button
                  key={spd}
                  type="button"
                  onClick={() => handleSpeedChange(spd)}
                  className={`px-1.5 py-0.5 rounded text-[11px] font-extrabold transition-colors ${
                    playbackRate === spd
                      ? 'bg-indigo-600 text-white'
                      : 'text-slate-600 hover:text-indigo-600'
                  }`}
                >
                  {spd}x
                </button>
              ))}
            </div>

            <div className="flex items-center gap-1 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg px-2 py-1">
              <Settings className="w-3.5 h-3.5 text-indigo-600" />
              <select
                value={quality}
                onChange={(e) => setQuality(e.target.value)}
                aria-label="Video Quality Selector"
                className="bg-transparent text-xs font-bold text-[#1E293B] focus:outline-none cursor-pointer"
              >
                {QUALITY_OPTIONS.map((q) => (
                  <option key={q} value={q}>
                    {q}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={toggleFullscreen}
              className="p-1.5 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0] text-[#1E293B] hover:border-indigo-300"
              title="Landscape Fullscreen"
            >
              {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>

      {/* Interactive Chapter Timestamps List */}
      {timestamps.length > 0 && (
        <div className="p-4 bg-[#F8FAFC] border-t border-[#E2E8F0]">
          <div className="flex items-center justify-between mb-2.5">
            <h4 className="text-xs font-extrabold text-[#1E293B] uppercase tracking-wider flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-indigo-600" />
              Interactive Chapter Timestamps ({timestamps.length})
            </h4>
            <span className="text-[11px] text-slate-500">
              Tap any marker to jump directly to topic/derivation
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
            {timestamps.map((ts, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => jumpToTimestamp(ts.time)}
                className="flex items-center gap-2.5 p-2 rounded-xl bg-[#FFFFFF] border border-[#E2E8F0] hover:border-indigo-400 hover:bg-indigo-50/40 text-left transition-all"
              >
                <span className="px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 font-mono text-xs font-extrabold shrink-0">
                  {ts.time || '00:00'}
                </span>
                <span className="text-xs font-bold text-[#1E293B] truncate">
                  {ts.title || ts.label || `Topic ${idx + 1}`}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
