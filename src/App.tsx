import React, { useEffect, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { JitsiMeeting } from '@jitsi/react-sdk';
import LiveClassroom from './components/LiveClassroom.jsx';
import AdminControls from './components/AdminControls.jsx';
import SubscriptionModal from './components/SubscriptionModal.jsx';
import VideoPlayer from './components/VideoPlayer.jsx';
import PDFViewerModal from './components/PDFViewerModal.jsx';
import TestAnalytics from './components/TestAnalytics.jsx';
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
  const [adminMountTarget, setAdminMountTarget] = useState<HTMLElement | null>(
    null
  );
  const [analyticsMountTarget, setAnalyticsMountTarget] =
    useState<HTMLElement | null>(null);

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
      // Remove broken script tag before retrying
      const existing = document.querySelector(`script[src="${JITSI_SCRIPT_URL}"]`);
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
    const locateMounts = () => {
      const adminEl = document.getElementById('adminReactControlMount');
      if (adminEl && adminEl !== adminMountTarget) {
        setAdminMountTarget(adminEl);
      }
      const analyticsEl = document.getElementById('testAnalyticsMount');
      if (analyticsEl && analyticsEl !== analyticsMountTarget) {
        setAnalyticsMountTarget(analyticsEl);
      }
    };
    locateMounts();
    const timer = setInterval(locateMounts, 1000);

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
      clearInterval(timer);
      delete window.mountJitsiSession;
      delete window.unmountJitsiSession;
      delete window.triggerJitsiRaiseHand;
    };
  }, [adminMountTarget, analyticsMountTarget, verifyOrLoadJitsi]);

  return (
    <>
      {createPortal(<LiveClassroom />, document.body)}
      {createPortal(<SubscriptionModal />, document.body)}
      {createPortal(<VideoPlayer />, document.body)}
      {createPortal(<PDFViewerModal />, document.body)}
      {adminMountTarget && createPortal(<AdminControls />, adminMountTarget)}
      {analyticsMountTarget &&
        createPortal(<TestAnalytics />, analyticsMountTarget)}
      {session &&
        portalTarget &&
        createPortal(
          <div className="w-full h-full min-h-[340px] bg-gray-950 relative overflow-hidden flex flex-col items-center justify-center">
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

            {jitsiScriptStatus === 'ready' && (
              <JitsiMeeting
                domain="meet.jit.si"
                roomName={session.roomName}
                configOverwrite={{
                  startWithAudioMuted: Boolean(session.isStudent),
                  startWithVideoMuted: Boolean(session.isAudioOnly),
                  prejoinPageEnabled: false,
                  disableDeepLinking: true,
                  hideConferenceSubject: Boolean(session.isStudent),
                  subject: session.subject || 'Prepskm Live Mentorship',
                  toolbarButtons: session.isStudent
                    ? ['microphone', 'camera', 'raisehand', 'tileview', 'hangup']
                    : [
                        'microphone',
                        'camera',
                        'desktop',
                        'chat',
                        'raisehand',
                        'tileview',
                        'hangup',
                      ],
                }}
                interfaceConfigOverwrite={{
                  MOBILE_APP_PROMO: false,
                  SHOW_JITSI_WATERMARK: false,
                  SHOW_BRAND_WATERMARK: false,
                  SHOW_WATERMARK_FOR_GUESTS: false,
                  SHOW_CHROME_EXTENSION_BANNER: false,
                  TOOLBAR_ALWAYS_VISIBLE: true,
                }}
                userInfo={{
                  displayName: session.displayName || 'Prepskm Aspirant',
                  email: session.email || 'aspirant@prepskm.in',
                }}
                onApiReady={(externalApi) => {
                  window.activeJitsiApi = externalApi;
                  externalApi.addEventListener('readyToClose', () => {
                    if (session.onEnd) session.onEnd();
                  });
                }}
                getIFrameRef={(iframeRef) => {
                  iframeRef.style.height = '100%';
                  iframeRef.style.width = '100%';
                  iframeRef.style.minHeight = '340px';
                  iframeRef.style.border = '0';
                }}
              />
            )}
          </div>,
          portalTarget
        )}
    </>
  );
}

