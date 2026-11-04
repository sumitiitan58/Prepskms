import React, { useEffect, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import LiveClassroom from './components/LiveClassroom.jsx';
import SubscriptionModal from './components/SubscriptionModal.jsx';
import VideoPlayer from './components/VideoPlayer.jsx';
import PDFViewerModal from './components/PDFViewerModal.jsx';
import StudentViewer from './components/StudentViewer.jsx';
import TeacherHost from './components/TeacherHost.jsx';
import AppRoutes from './router/AppRoutes.jsx';
import './services/firebase.js';
import './services/cloudStorage.js';
import './services/db.js';
import './services/razorpay.js';

export interface JitsiSessionConfig {
  roomName: string;
  displayName: string;
  email?: string;
  isStudent?: boolean;
  isAudioOnly?: boolean;
  subject?: string;
  onEnd?: () => void;
}

declare global {
  interface Window {
    mountJitsiSession?: (config: JitsiSessionConfig) => void;
    unmountJitsiSession?: () => void;
    triggerJitsiRaiseHand?: () => void;
    ensureJitsiScriptLoaded?: () => Promise<boolean>;
    activeJitsiApi?: any;
    JitsiMeetExternalAPI?: any;
  }
}

const JITSI_SCRIPT_URL = 'https://meet.jit.si/external_api.js';

export function loadJitsiExternalScript(timeoutMs = 10000): Promise<boolean> {
  if (typeof window === 'undefined') return Promise.resolve(false);
  if (typeof window.JitsiMeetExternalAPI === 'function') {
    return Promise.resolve(true);
  }

  return new Promise((resolve) => {
    let settled = false;
    const finish = (ok: boolean) => {
      if (!settled) {
        settled = true;
        resolve(ok);
      }
    };

    const pollInterval = setInterval(() => {
      if (typeof window.JitsiMeetExternalAPI === 'function') {
        clearInterval(pollInterval);
        finish(true);
      }
    }, 150);

    const timer = setTimeout(() => {
      clearInterval(pollInterval);
      finish(typeof window.JitsiMeetExternalAPI === 'function');
    }, timeoutMs);

    let scriptEl = document.querySelector(
      `script[src="${JITSI_SCRIPT_URL}"]`
    ) as HTMLScriptElement | null;

    if (!scriptEl) {
      scriptEl = document.createElement('script');
      scriptEl.src = JITSI_SCRIPT_URL;
      scriptEl.async = true;
      document.head.appendChild(scriptEl);
    }

    scriptEl.addEventListener('load', () => {
      clearInterval(pollInterval);
      clearTimeout(timer);
      finish(typeof window.JitsiMeetExternalAPI === 'function');
    });

    scriptEl.addEventListener('error', () => {
      clearInterval(pollInterval);
      clearTimeout(timer);
      finish(false);
    });
  });
}

export default function App() {
  const [session, setSession] = useState<JitsiSessionConfig | null>(null);
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);
  const [jitsiScriptStatus, setJitsiScriptStatus] = useState<
    'idle' | 'loading' | 'ready' | 'error'
  >('idle');
  const [jitsiRetryCount, setJitsiRetryCount] = useState(0);

  const verifyOrLoadJitsi = useCallback(async () => {
    if (typeof window.JitsiMeetExternalAPI === 'function') {
      setJitsiScriptStatus('ready');
      return true;
    }
    setJitsiScriptStatus('loading');
    for (let attempt = 1; attempt <= 3; attempt++) {
      const loaded = await loadJitsiExternalScript(7000);
      if (loaded) {
        setJitsiScriptStatus('ready');
        return true;
      }
      const existing = document.querySelector(
        `script[src="${JITSI_SCRIPT_URL}"]`
      );
      if (existing && existing.parentNode) {
        existing.parentNode.removeChild(existing);
      }
    }
    setJitsiScriptStatus('error');
    return false;
  }, []);

  useEffect(() => {
    window.ensureJitsiScriptLoaded = verifyOrLoadJitsi;
    verifyOrLoadJitsi();
  }, [verifyOrLoadJitsi, jitsiRetryCount]);

  useEffect(() => {
    window.mountJitsiSession = async (config: JitsiSessionConfig) => {
      const target = document.getElementById('jitsiMeetStageContainer');
      setPortalTarget(target);
      setSession(config);
      await verifyOrLoadJitsi();
    };

    window.unmountJitsiSession = () => {
      if (window.activeJitsiApi) {
        try {
          window.activeJitsiApi.dispose();
        } catch (_e) {}
        window.activeJitsiApi = null;
      }
      setSession(null);
    };

    window.triggerJitsiRaiseHand = () => {
      if (window.activeJitsiApi) {
        try {
          window.activeJitsiApi.executeCommand('toggleRaiseHand');
        } catch (_e) {}
      }
    };

    return () => {
      delete window.mountJitsiSession;
      delete window.unmountJitsiSession;
      delete window.triggerJitsiRaiseHand;
    };
  }, [verifyOrLoadJitsi]);

  return (
    <>
      <AppRoutes />
      {createPortal(<LiveClassroom />, document.body)}
      {createPortal(<SubscriptionModal />, document.body)}
      {createPortal(<VideoPlayer />, document.body)}
      {createPortal(<PDFViewerModal />, document.body)}

      {session &&
        portalTarget &&
        createPortal(
          <div className="w-full h-full min-h-[340px] bg-[#0B0F19] relative overflow-hidden flex flex-col items-center justify-center">
            {jitsiScriptStatus === 'loading' && (
              <div className="flex flex-col items-center justify-center p-6 text-center space-y-3">
                <div className="w-10 h-10 rounded-full border-3 border-indigo-500 border-t-transparent animate-spin" />
                <p className="text-xs font-extrabold text-white">
                  Connecting to Prepskm Encrypted HD Classroom...
                </p>
                <p className="text-[11px] text-slate-400">
                  Initializing low-latency audio &amp; smartboard stream
                </p>
              </div>
            )}

            {jitsiScriptStatus === 'error' && (
              <div className="flex flex-col items-center justify-center p-6 text-center space-y-3 max-w-sm">
                <span className="px-3 py-1 rounded-full bg-rose-500/20 text-rose-300 text-[11px] font-black">
                  Stream Connection Timeout
                </span>
                <p className="text-xs font-bold text-slate-200">
                  Could not establish the live stream bridge automatically. Please check your connection and retry.
                </p>
                <button
                  type="button"
                  onClick={() => setJitsiRetryCount((c) => c + 1)}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black shadow-lg cursor-pointer"
                >
                  🔄 Retry Live Connection
                </button>
              </div>
            )}

            {jitsiScriptStatus === 'ready' &&
              (session.isStudent ? (
                <StudentViewer
                  roomName={session.roomName}
                  studentName={session.displayName || 'Prepskm Aspirant'}
                  studentEmail={session.email || 'aspirant@prepskm.in'}
                  subject={session.subject || 'Prepskm Live Mentorship'}
                  hasStagePermission={false}
                  onLeave={session.onEnd}
                />
              ) : (
                <TeacherHost
                  roomName={session.roomName}
                  mentorName={session.displayName || 'Sumit (@unfiltereddsumit)'}
                  mentorEmail={session.email || 'sumitk31207@gmail.com'}
                  subject={session.subject || 'Prepskm Live Mentorship'}
                  onEndSession={session.onEnd}
                />
              ))}
          </div>,
          portalTarget
        )}
    </>
  );
}
