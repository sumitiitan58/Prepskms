import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { JitsiMeeting } from '@jitsi/react-sdk';

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

  useEffect(() => {
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
      delete window.mountJitsiSession;
      delete window.unmountJitsiSession;
      delete window.triggerJitsiRaiseHand;
    };
  }, []);

  if (!session || !portalTarget) {
    return null;
  }

  return createPortal(
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
  );
}
