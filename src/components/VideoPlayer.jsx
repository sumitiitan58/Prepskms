import React, { useState, useEffect, useRef } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  RotateCw,
  Maximize2,
  Minimize2,
  X,
  Clock,
  Sparkles,
  Volume2,
  VolumeX,
  Gauge,
  CheckCircle2,
} from 'lucide-react';
import { parseTimestampsInput } from '../services/db';
import { resolveCloudFileUrl } from '../firebase';

const DEFAULT_TIMESTAMPS = [
  { time: '00:00', seconds: 0, label: 'Introduction & Chapter Weightage' },
  { time: '04:15', seconds: 255, label: 'Derivation of Kinematics & Conservation Formula' },
  { time: '12:30', seconds: 750, label: 'JEE Advanced Multi-Concept Problem #1' },
  { time: '21:45', seconds: 1305, label: 'NEET / JEE Main High-Speed Shortcut & PYQ Traps' },
];

function normalizeEmbedStreamUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') return '';
  const trimmed = rawUrl.trim();
  // Convert standard watch or short URLs into clean embed endpoints with JS API enabled
  let videoId = '';
  const watchMatch = trimmed.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
  const shortMatch = trimmed.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/);
  const embedMatch = trimmed.match(/embed\/([a-zA-Z0-9_-]{11})/);
  if (watchMatch) videoId = watchMatch[1];
  else if (shortMatch) videoId = shortMatch[1];
  else if (embedMatch) videoId = embedMatch[1];

  if (videoId) {
    const origin =
      typeof window !== 'undefined' && window.location?.origin
        ? encodeURIComponent(window.location.origin)
        : '';
    return `https://www.youtube-nocookie.com/embed/${videoId}?enablejsapi=1&autoplay=1&controls=0&rel=0&modestbranding=1&iv_load_policy=3&playsinline=1${
      origin ? `&origin=${origin}` : ''
    }`;
  }
  return trimmed;
}

export default function VideoPlayer() {
  const [isOpen, setIsOpen] = useState(false);
  const [lecture, setLecture] = useState(null);
  const [resolvedUrl, setResolvedUrl] = useState('');
  const [isResolvingCloud, setIsResolvingCloud] = useState(false);
  const [isPlaying, setIsPlaying] = useState(true);
  const [currentSec, setCurrentSec] = useState(0);
  const [durationSec, setDurationSec] = useState(1800); // 30:00 default
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [quality, setQuality] = useState('1080p HD');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isTheater, setIsTheater] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [skipFeedback, setSkipFeedback] = useState(null); // 'left' | 'right' | null

  const containerRef = useRef(null);
  const videoRef = useRef(null);
  const iframeRef = useRef(null);
  const lastTapRef = useRef({ time: 0, side: null });

  const sendStreamCommand = (func, args = []) => {
    if (iframeRef.current && iframeRef.current.contentWindow) {
      try {
        iframeRef.current.contentWindow.postMessage(
          JSON.stringify({ event: 'command', func, args }),
          '*'
        );
      } catch (_e) {}
    }
  };

  useEffect(() => {
    window.openAdvancedVideoPlayer = async (videoObjOrId) => {
      let target = videoObjOrId;
      if (typeof videoObjOrId === 'string') {
        const list = window.state?.videos || [];
        target =
          list.find((v) => String(v.id) === String(videoObjOrId)) || list[0];
      }
      if (!target) {
        if (typeof window.showToast === 'function') {
          window.showToast('Please select or upload a video lecture first.');
        }
        return;
      }
      const parsedTs =
        Array.isArray(target.timestamps) && target.timestamps.length > 0
          ? target.timestamps
          : target.timestampsText
          ? parseTimestampsInput(target.timestampsText)
          : DEFAULT_TIMESTAMPS;

      setLecture({ ...target, timestamps: parsedTs });
      setCurrentSec(0);
      setIsPlaying(true);
      setIsOpen(true);
      window.__isVideoModalOpen = true;
      try {
        window.history.pushState(
          { modal: 'video', path: window.location.pathname },
          '',
          window.location.pathname
        );
      } catch (_e) {}

      const raw = target.videoUrl || target.video_url || '';
      if (raw.startsWith('#prepskm-cloud-file:')) {
        setIsResolvingCloud(true);
        try {
          const dataUrl = await resolveCloudFileUrl(raw);
          setResolvedUrl(dataUrl || '');
        } catch (_e) {
          setResolvedUrl('');
        } finally {
          setIsResolvingCloud(false);
        }
      } else {
        setResolvedUrl(raw);
        setIsResolvingCloud(false);
      }
    };

    window.closeAdvancedVideoPlayer = () => {
      window.__isVideoModalOpen = false;
      setIsOpen(false);
      setIsPlaying(false);
    };
  }, []);

  // Sync play/pause with HTML5 <video> or embedded stream player
  useEffect(() => {
    if (!isOpen) return;
    if (videoRef.current) {
      try {
        if (isPlaying) {
          videoRef.current.play().catch(() => {});
        } else {
          videoRef.current.pause();
        }
      } catch (_e) {}
    } else {
      sendStreamCommand(isPlaying ? 'playVideo' : 'pauseVideo');
    }
  }, [isPlaying, isOpen]);

  // Sync mute state
  useEffect(() => {
    if (!isOpen) return;
    if (videoRef.current) {
      videoRef.current.muted = isMuted;
    } else {
      sendStreamCommand(isMuted ? 'mute' : 'unMute');
    }
  }, [isMuted, isOpen]);

  // Sync playback speed
  useEffect(() => {
    if (!isOpen) return;
    if (videoRef.current) {
      videoRef.current.playbackRate = playbackSpeed;
    } else {
      sendStreamCommand('setPlaybackRate', [playbackSpeed]);
    }
  }, [playbackSpeed, isOpen]);

  // Progress ticker for stream lectures
  useEffect(() => {
    if (!isOpen || !isPlaying) return;
    const interval = setInterval(() => {
      if (videoRef.current && !Number.isNaN(videoRef.current.currentTime)) {
        setCurrentSec(videoRef.current.currentTime);
        if (
          videoRef.current.duration &&
          !Number.isNaN(videoRef.current.duration) &&
          videoRef.current.duration > 0
        ) {
          setDurationSec(videoRef.current.duration);
        }
        return;
      }
      setCurrentSec((prev) => {
        const next = prev + playbackSpeed;
        return next >= durationSec ? 0 : next;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [isOpen, isPlaying, playbackSpeed, durationSec]);

  if (!isOpen || !lecture) return null;

  const formatTime = (sec) => {
    const s = Math.max(0, Math.floor(sec));
    const mins = Math.floor(s / 60);
    const rem = s % 60;
    return `${String(mins).padStart(2, '0')}:${String(rem).padStart(2, '0')}`;
  };

  const skipSeconds = (delta) => {
    setCurrentSec((prev) => {
      const next = Math.max(0, Math.min(durationSec, prev + delta));
      if (videoRef.current) {
        try {
          videoRef.current.currentTime = next;
        } catch (_e) {}
      } else {
        sendStreamCommand('seekTo', [Math.floor(next), true]);
      }
      return next;
    });
    setSkipFeedback(delta < 0 ? 'left' : 'right');
    setTimeout(() => setSkipFeedback(null), 550);
  };

  const jumpToTimestamp = (tsSeconds) => {
    setCurrentSec(tsSeconds);
    setIsPlaying(true);
    if (videoRef.current) {
      try {
        videoRef.current.currentTime = tsSeconds;
        videoRef.current.play().catch(() => {});
      } catch (_e) {}
    } else {
      sendStreamCommand('seekTo', [Math.floor(tsSeconds), true]);
      sendStreamCommand('playVideo');
    }
  };

  // One-tap play/pause & Double-tap left/right 10s skip
  const handleStageTap = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const side = clickX < rect.width / 2 ? 'left' : 'right';
    const now = Date.now();

    if (
      now - lastTapRef.current.time < 320 &&
      lastTapRef.current.side === side
    ) {
      // Double tap detected
      skipSeconds(side === 'left' ? -10 : 10);
      lastTapRef.current = { time: 0, side: null };
    } else {
      // Single tap toggles play/pause
      setIsPlaying((p) => !p);
      lastTapRef.current = { time: now, side };
    }
  };

  const toggleTrueFullscreen = async () => {
    try {
      if (!document.fullscreenElement && containerRef.current) {
        await containerRef.current.requestFullscreen();
        setIsFullscreen(true);
      } else if (document.fullscreenElement) {
        await document.exitFullscreen();
        setIsFullscreen(false);
      } else {
        setIsFullscreen((f) => !f);
      }
    } catch (_e) {
      setIsFullscreen((f) => !f);
    }
  };

  const activeUrl = resolvedUrl || lecture.videoUrl || lecture.video_url || '';
  const isDirectVideo =
    activeUrl.endsWith('.mp4') ||
    activeUrl.endsWith('.webm') ||
    activeUrl.endsWith('.ogg') ||
    activeUrl.startsWith('data:video') ||
    activeUrl.startsWith('blob:');

  const streamEmbedUrl = normalizeEmbedStreamUrl(activeUrl);

  const timestamps = lecture.timestamps || DEFAULT_TIMESTAMPS;
  const activeChapter =
    [...timestamps].reverse().find((t) => currentSec >= t.seconds) ||
    timestamps[0];

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99997,
        background: 'rgba(2, 6, 23, 0.92)',
        backdropFilter: 'blur(12px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: isFullscreen ? 0 : '14px',
        fontFamily: "'Plus Jakarta Sans', sans-serif",
      }}
    >
      <div
        ref={containerRef}
        style={{
          width: '100%',
          maxWidth: isFullscreen || isTheater ? '100%' : '1080px',
          height: isFullscreen ? '100vh' : 'auto',
          maxHeight: isFullscreen ? '100vh' : '94vh',
          background: '#090d16',
          borderRadius: isFullscreen ? 0 : '24px',
          border: '1px solid rgba(99, 102, 241, 0.3)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          color: '#f8fafc',
          boxShadow: '0 25px 70px -15px rgba(0, 0, 0, 0.85)',
        }}
      >
        {/* Top Lecture Header (Zero YouTube/YT Branding) */}
        <div
          style={{
            padding: '12px 18px',
            background: '#0f172a',
            borderBottom: '1px solid rgba(255,255,255,0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <span
              style={{
                background: 'linear-gradient(135deg, #4f46e5, #7c3aed)',
                color: '#fff',
                fontSize: '10px',
                fontWeight: 900,
                padding: '4px 10px',
                borderRadius: '999px',
                textTransform: 'uppercase',
              }}
            >
              {lecture.subject || 'Physics'} • {lecture.chapter || 'Core Concept'} • Prepskm HD Player
            </span>
            <h3
              style={{
                margin: 0,
                fontSize: '14px',
                fontWeight: 800,
                color: '#fff',
              }}
            >
              {lecture.title}
            </h3>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              onClick={() => setIsTheater((t) => !t)}
              style={{
                background: isTheater
                  ? 'rgba(99,102,241,0.25)'
                  : 'rgba(255,255,255,0.08)',
                border: '1px solid rgba(255,255,255,0.15)',
                color: '#e2e8f0',
                padding: '6px 10px',
                borderRadius: '10px',
                fontSize: '11px',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              {isTheater ? 'Standard View' : 'Theater Mode'}
            </button>
            <button
              onClick={() => setIsOpen(false)}
              style={{
                background: 'rgba(239, 68, 68, 0.2)',
                border: '1px solid rgba(239, 68, 68, 0.4)',
                color: '#fca5a5',
                width: '34px',
                height: '34px',
                borderRadius: '10px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Main Video Stage + Interactive Chapter Sidebar */}
        <div
          style={{
            display: 'flex',
            flexDirection: isTheater || isFullscreen ? 'column' : 'row',
            flex: 1,
            overflow: 'hidden',
          }}
        >
          {/* Video Canvas Area */}
          <div
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              background: '#000',
              position: 'relative',
            }}
          >
            <div
              onClick={handleStageTap}
              style={{
                position: 'relative',
                width: '100%',
                aspectRatio: '16 / 9',
                maxHeight: isFullscreen ? 'calc(100vh - 125px)' : '500px',
                background: '#020617',
                cursor: 'pointer',
                overflow: 'hidden',
                userSelect: 'none',
              }}
            >
              {isResolvingCloud ? (
                <div
                  style={{
                    width: '100%',
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '10px',
                    color: '#c7d2fe',
                    fontSize: '13px',
                    fontWeight: 700,
                  }}
                >
                  <span>Loading Cloud HD Lecture Stream...</span>
                </div>
              ) : isDirectVideo ? (
                <video
                  ref={videoRef}
                  src={activeUrl}
                  autoPlay
                  playsInline
                  muted={isMuted}
                  onLoadedMetadata={(e) => {
                    if (e.currentTarget.duration && !Number.isNaN(e.currentTarget.duration)) {
                      setDurationSec(Math.round(e.currentTarget.duration));
                    }
                  }}
                  style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                />
              ) : (
                /* Whitelabeled Stream Container: scaled slightly to crop out any third-party top/bottom branding bars */
                <div
                  style={{
                    position: 'absolute',
                    inset: '-52px 0 -52px 0',
                    pointerEvents: 'none',
                  }}
                >
                  <iframe
                    ref={iframeRef}
                    src={streamEmbedUrl}
                    title={lecture.title}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    onLoad={() => {
                      if (isPlaying) sendStreamCommand('playVideo');
                    }}
                    style={{
                      width: '100%',
                      height: '100%',
                      border: 'none',
                      pointerEvents: 'none',
                    }}
                  />
                </div>
              )}

              {/* Double-Tap 10s Skip Ripple Feedback */}
              {skipFeedback && (
                <div
                  style={{
                    position: 'absolute',
                    top: '50%',
                    [skipFeedback === 'left' ? 'left' : 'right']: '12%',
                    transform: 'translateY(-50%)',
                    background: 'rgba(15, 23, 42, 0.85)',
                    border: '1px solid rgba(129, 140, 248, 0.5)',
                    padding: '14px 22px',
                    borderRadius: '999px',
                    color: '#fff',
                    fontWeight: 900,
                    fontSize: '15px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                >
                  {skipFeedback === 'left' ? '⏪ -10s' : '⏩ +10s'}
                </div>
              )}

              {/* Active Chapter Pill Overlay */}
              <div
                style={{
                  position: 'absolute',
                  top: '12px',
                  left: '12px',
                  background: 'rgba(15, 23, 42, 0.88)',
                  backdropFilter: 'blur(8px)',
                  border: '1px solid rgba(255,255,255,0.15)',
                  padding: '5px 12px',
                  borderRadius: '999px',
                  fontSize: '11px',
                  fontWeight: 700,
                  color: '#c7d2fe',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <Sparkles size={12} />
                <span>Now Playing: {activeChapter?.label}</span>
              </div>

              {/* Center Play/Pause Indicator when Paused */}
              {!isPlaying && (
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    background: 'rgba(2, 6, 23, 0.65)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                  }}
                >
                  <div
                    style={{
                      width: '64px',
                      height: '64px',
                      borderRadius: '50%',
                      background: 'rgba(79, 70, 229, 0.95)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: '0 12px 30px rgba(79, 70, 229, 0.6)',
                    }}
                  >
                    <Play size={28} fill="#fff" />
                  </div>
                  <span
                    style={{
                      fontSize: '11px',
                      fontWeight: 800,
                      background: 'rgba(0,0,0,0.75)',
                      padding: '4px 10px',
                      borderRadius: '999px',
                    }}
                  >
                    Tap anywhere to resume • Double-tap left/right to skip 10s
                  </span>
                </div>
              )}
            </div>

            {/* Interactive Timeline Bar with Highlighted Chapter Markers */}
            <div
              style={{
                padding: '12px 18px',
                background: '#0f172a',
                borderTop: '1px solid rgba(255,255,255,0.08)',
              }}
            >
              {/* Scrubber Track */}
              <div
                onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const ratio = Math.max(
                    0,
                    Math.min(1, (e.clientX - rect.left) / rect.width)
                  );
                  jumpToTimestamp(Math.round(ratio * durationSec));
                }}
                style={{
                  position: 'relative',
                  height: '8px',
                  background: '#334155',
                  borderRadius: '999px',
                  cursor: 'pointer',
                  marginBottom: '12px',
                }}
              >
                <div
                  style={{
                    width: `${Math.min(
                      100,
                      (currentSec / durationSec) * 100
                    )}%`,
                    height: '100%',
                    background: 'linear-gradient(90deg, #6366f1, #ec4899)',
                    borderRadius: '999px',
                  }}
                />
                {/* Chapter Marker Dots on Progress Bar */}
                {timestamps.map((ts, idx) => {
                  const leftPct = Math.min(
                    98,
                    Math.max(1, (ts.seconds / durationSec) * 100)
                  );
                  return (
                    <div
                      key={idx}
                      title={`${ts.time} - ${ts.label}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        jumpToTimestamp(ts.seconds);
                      }}
                      style={{
                        position: 'absolute',
                        left: `${leftPct}%`,
                        top: '-3px',
                        width: '14px',
                        height: '14px',
                        borderRadius: '50%',
                        background:
                          currentSec >= ts.seconds ? '#f59e0b' : '#94a3b8',
                        border: '2px solid #0f172a',
                        transform: 'translateX(-50%)',
                        cursor: 'pointer',
                      }}
                    />
                  );
                })}
              </div>

              {/* Player Controls Row */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '10px',
                }}
              >
                <div
                  style={{ display: 'flex', alignItems: 'center', gap: '10px' }}
                >
                  <button
                    onClick={() => setIsPlaying((p) => !p)}
                    style={{
                      background: '#4f46e5',
                      border: 'none',
                      color: '#fff',
                      width: '36px',
                      height: '36px',
                      borderRadius: '10px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {isPlaying ? <Pause size={17} /> : <Play size={17} />}
                  </button>

                  <button
                    onClick={() => skipSeconds(-10)}
                    style={{
                      background: 'rgba(255,255,255,0.08)',
                      border: '1px solid rgba(255,255,255,0.12)',
                      color: '#e2e8f0',
                      padding: '6px 10px',
                      borderRadius: '10px',
                      fontSize: '11px',
                      fontWeight: 800,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    <RotateCcw size={13} /> -10s
                  </button>

                  <button
                    onClick={() => skipSeconds(10)}
                    style={{
                      background: 'rgba(255,255,255,0.08)',
                      border: '1px solid rgba(255,255,255,0.12)',
                      color: '#e2e8f0',
                      padding: '6px 10px',
                      borderRadius: '10px',
                      fontSize: '11px',
                      fontWeight: 800,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    <RotateCw size={13} /> +10s
                  </button>

                  <button
                    onClick={() => setIsMuted((m) => !m)}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: '#cbd5e1',
                      cursor: 'pointer',
                    }}
                  >
                    {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
                  </button>

                  <span
                    style={{
                      fontSize: '12px',
                      fontFamily: 'monospace',
                      fontWeight: 700,
                      color: '#cbd5e1',
                    }}
                  >
                    {formatTime(currentSec)} / {formatTime(durationSec)}
                  </span>
                </div>

                <div
                  style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                >
                  {/* Speed Selector (1x - 2x) */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      background: 'rgba(255,255,255,0.07)',
                      padding: '4px 8px',
                      borderRadius: '10px',
                    }}
                  >
                    <Gauge size={13} style={{ color: '#818cf8' }} />
                    {[1, 1.25, 1.5, 1.75, 2].map((spd) => (
                      <button
                        key={spd}
                        onClick={() => setPlaybackSpeed(spd)}
                        style={{
                          background:
                            playbackSpeed === spd ? '#4f46e5' : 'transparent',
                          color: playbackSpeed === spd ? '#fff' : '#94a3b8',
                          border: 'none',
                          borderRadius: '6px',
                          padding: '3px 6px',
                          fontSize: '10.5px',
                          fontWeight: 800,
                          cursor: 'pointer',
                        }}
                      >
                        {spd}x
                      </button>
                    ))}
                  </div>

                  {/* Quality Selector */}
                  <select
                    value={quality}
                    onChange={(e) => setQuality(e.target.value)}
                    style={{
                      background: 'rgba(255,255,255,0.08)',
                      color: '#e2e8f0',
                      border: '1px solid rgba(255,255,255,0.15)',
                      borderRadius: '10px',
                      padding: '5px 8px',
                      fontSize: '11px',
                      fontWeight: 700,
                    }}
                  >
                    <option value="1080p HD" style={{ background: '#0f172a' }}>
                      1080p HD
                    </option>
                    <option value="720p" style={{ background: '#0f172a' }}>
                      720p
                    </option>
                    <option value="480p" style={{ background: '#0f172a' }}>
                      480p Data Saver
                    </option>
                  </select>

                  {/* Fullscreen Toggle */}
                  <button
                    onClick={toggleTrueFullscreen}
                    style={{
                      background: 'rgba(255,255,255,0.1)',
                      border: '1px solid rgba(255,255,255,0.18)',
                      color: '#fff',
                      padding: '6px 10px',
                      borderRadius: '10px',
                      fontSize: '11px',
                      fontWeight: 800,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px',
                    }}
                  >
                    {isFullscreen ? (
                      <Minimize2 size={14} />
                    ) : (
                      <Maximize2 size={14} />
                    )}
                    {isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Right / Bottom Interactive Timestamps & Chapter Markers Panel */}
          <div
            style={{
              width: isTheater || isFullscreen ? '100%' : '320px',
              background: '#0f172a',
              borderLeft:
                isTheater || isFullscreen
                  ? 'none'
                  : '1px solid rgba(255,255,255,0.08)',
              padding: '16px',
              overflowY: 'auto',
              maxHeight: isTheater || isFullscreen ? '210px' : '560px',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '11px',
                fontWeight: 900,
                textTransform: 'uppercase',
                color: '#818cf8',
                marginBottom: '12px',
              }}
            >
              <Clock size={14} /> INTERACTIVE CHAPTER TIMESTAMPS
            </div>

            <div
              style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}
            >
              {timestamps.map((ts, index) => {
                const isCurrent = activeChapter?.seconds === ts.seconds;
                return (
                  <button
                    key={index}
                    onClick={() => jumpToTimestamp(ts.seconds)}
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      padding: '10px 12px',
                      borderRadius: '14px',
                      border: isCurrent
                        ? '1.5px solid #6366f1'
                        : '1px solid rgba(255,255,255,0.07)',
                      background: isCurrent
                        ? 'rgba(79, 70, 229, 0.22)'
                        : 'rgba(15, 23, 42, 0.6)',
                      color: '#f8fafc',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '10px',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                      }}
                    >
                      <span
                        style={{
                          fontFamily: 'monospace',
                          fontSize: '11.5px',
                          fontWeight: 900,
                          padding: '3px 8px',
                          borderRadius: '8px',
                          background: isCurrent ? '#4f46e5' : '#1e293b',
                          color: isCurrent ? '#fff' : '#93c5fd',
                        }}
                      >
                        {ts.time}
                      </span>
                      <span
                        style={{
                          fontSize: '12px',
                          fontWeight: isCurrent ? 800 : 600,
                          color: isCurrent ? '#fff' : '#cbd5e1',
                          lineHeight: 1.35,
                        }}
                      >
                        {ts.label}
                      </span>
                    </div>
                    {isCurrent && (
                      <CheckCircle2
                        size={15}
                        style={{ color: '#34d399', flexShrink: 0 }}
                      />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
