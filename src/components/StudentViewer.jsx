import React, { useRef } from 'react';
import { JitsiMeeting } from '@jitsi/react-sdk';

export const STRICT_STUDENT_TOOLBAR_BUTTONS = [
  'chat',
  'raisehand',
  'fullscreen',
];

export function buildStudentJitsiConfig({
  subject = 'Prepskm Live Mentorship',
  hasStagePermission = false,
} = {}) {
  return {
    startWithAudioMuted: true,
    startWithVideoMuted: true,
    prejoinPageEnabled: false,
    prejoinConfig: {
      enabled: false,
    },
    disableDeepLinking: true,
    hideConferenceSubject: true,
    hideConferenceTimer: false,
    disableInviteFunctions: true,
    disableRemoteMute: true,
    readOnlyName: true,
    subject,
    whiteboard: {
      enabled: false,
    },
    toolbarButtons: hasStagePermission
      ? ['microphone', 'camera', 'chat', 'raisehand', 'fullscreen']
      : STRICT_STUDENT_TOOLBAR_BUTTONS,
  };
}

if (typeof window !== 'undefined') {
  window.buildStudentJitsiConfig = buildStudentJitsiConfig;
}

export default function StudentViewer({
  roomName = 'PrepskmLive_MainStage',
  studentName = 'Prepskm Aspirant',
  studentEmail = 'aspirant@prepskm.in',
  subject = 'Prepskm Live Classroom',
  hasStagePermission = false,
  isHandRaised = false,
  onRaiseHand,
  onLeave,
}) {
  const apiRef = useRef(null);

  const configOverwrite = buildStudentJitsiConfig({
    subject,
    hasStagePermission,
  });

  const handleToggleStageMic = () => {
    if (!hasStagePermission || !apiRef.current) return;
    try {
      apiRef.current.executeCommand('toggleAudio');
    } catch (_e) {}
  };

  return (
    <div className="w-full h-full flex flex-col bg-[#0B0F19] relative overflow-hidden select-none">
      {/* Strict Viewer Status Banner */}
      <div className="px-3.5 py-2 bg-[#151D2F] border-b border-[#1E293B] flex flex-wrap items-center justify-between gap-2 text-[11px] shrink-0">
        <div className="flex items-center gap-2">
          <span className="px-2 py-0.5 rounded bg-[#EF4444]/20 text-[#EF4444] border border-[#EF4444]/40 font-black uppercase tracking-wider flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-[#EF4444] animate-ping" />
            Student Viewer Mode
          </span>
          <span className="text-slate-300 font-semibold hidden sm:inline">
            Read-Only Broadcast • Whiteboard, Camera &amp; Screen Share Disabled
          </span>
        </div>

        <div className="flex items-center gap-2">
          {hasStagePermission ? (
            <button
              type="button"
              onClick={handleToggleStageMic}
              className="px-3 py-1 rounded-lg bg-[#10B981] hover:bg-emerald-500 text-slate-950 font-black text-[11px] flex items-center gap-1.5 shadow-sm cursor-pointer"
            >
              <span>🎙️ Stage Mic Granted by Mentor Sumit (Toggle Mic)</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                if (onRaiseHand) onRaiseHand();
                if (apiRef.current) {
                  try {
                    apiRef.current.executeCommand('toggleRaiseHand');
                  } catch (_e) {}
                }
              }}
              className={`px-3 py-1 rounded-lg font-extrabold text-[11px] flex items-center gap-1.5 transition-all cursor-pointer ${
                isHandRaised
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-400/40'
                  : 'bg-[#4F46E5] hover:bg-indigo-500 text-white shadow-sm'
              }`}
            >
              <span>✋</span>
              <span>
                {isHandRaised
                  ? 'Hand Raised (Awaiting Mentor Approval)'
                  : 'Raise Hand to Request Audio'}
              </span>
            </button>
          )}
        </div>
      </div>

      {/* Jitsi Embed Container */}
      <div className="flex-1 w-full min-h-[340px] relative bg-[#0B0F19]">
        <JitsiMeeting
          domain="meet.jit.si"
          roomName={roomName}
          configOverwrite={configOverwrite}
          interfaceConfigOverwrite={{
            MOBILE_APP_PROMO: false,
            SHOW_JITSI_WATERMARK: false,
            SHOW_BRAND_WATERMARK: false,
            SHOW_WATERMARK_FOR_GUESTS: false,
            SHOW_CHROME_EXTENSION_BANNER: false,
            DISABLE_JOIN_LEAVE_NOTIFICATIONS: true,
            TOOLBAR_ALWAYS_VISIBLE: true,
            TOOLBAR_BUTTONS: configOverwrite.toolbarButtons,
            SETTINGS_SECTIONS: ['devices'],
          }}
          userInfo={{
            displayName: studentName,
            email: studentEmail,
          }}
          onApiReady={(externalApi) => {
            apiRef.current = externalApi;
            window.activeJitsiApi = externalApi;

            // Enforce muted audio/video for students unless approved by Mentor Sumit
            try {
              externalApi.isAudioMuted().then((muted) => {
                if (!muted && !hasStagePermission) {
                  externalApi.executeCommand('toggleAudio');
                }
              });
              externalApi.isVideoMuted().then((muted) => {
                if (!muted && !hasStagePermission) {
                  externalApi.executeCommand('toggleVideo');
                }
              });
            } catch (_e) {}

            externalApi.addEventListener('audioMuteStatusChanged', ({ muted }) => {
              if (!muted && !hasStagePermission) {
                try {
                  externalApi.executeCommand('toggleAudio');
                } catch (_e) {}
              }
            });

            externalApi.addEventListener('videoMuteStatusChanged', ({ muted }) => {
              if (!muted && !hasStagePermission) {
                try {
                  externalApi.executeCommand('toggleVideo');
                } catch (_e) {}
              }
            });

            externalApi.addEventListener('readyToClose', () => {
              if (onLeave) onLeave();
            });
          }}
          getIFrameRef={(iframeRef) => {
            iframeRef.style.height = '100%';
            iframeRef.style.width = '100%';
            iframeRef.style.minHeight = '340px';
            iframeRef.style.border = '0';
          }}
        />
      </div>
    </div>
  );
}
