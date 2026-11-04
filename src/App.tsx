import React, { useEffect, useState } from 'react';
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
    activeJitsiApi?: any;
  }
}

export default function App() {
  const [session, setSession] = useState<JitsiSessionConfig | null>(null);
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);
  const [adminMountTarget, setAdminMountTarget] = useState<HTMLElement | null>(
    null
  );
  const [analyticsMountTarget, setAnalyticsMountTarget] =
    useState<HTMLElement | null>(null);

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

    window.mountJitsiSession = (config: JitsiSessionConfig) => {
      const target = document.getElementById('jitsiMeetStageContainer');
      setPortalTarget(target);
      setSession(config);
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
  }, [adminMountTarget, analyticsMountTarget]);

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
          <div className="w-full h-full min-h-[340px] bg-gray-950 relative overflow-hidden">
            <JitsiMeeting
              domain="meet.jit.si"
              roomName={session.roomName}
              configOverwrite={{
                startWithAudioMuted: Boolean(session.isStudent),
                startWithVideoMuted: Boolean(session.isAudioOnly),
                prejoinPageEnabled: false,
                disableDeepLinking: true,
                subject: session.subject || 'Prepskm Live Mentorship',
                toolbarButtons: [
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
          </div>,
          portalTarget
        )}
    </>
  );
}
