import React, { useRef, useState } from 'react';
import { JitsiMeeting } from '@jitsi/react-sdk';

export const TEACHER_HOST_TOOLBAR_BUTTONS = [
  'microphone',
  'camera',
  'desktop',
  'whiteboard',
  'chat',
  'raisehand',
  'polls',
  'participants-pane',
  'tileview',
  'mute-everyone',
  'fullscreen',
  'hangup',
];

export function buildTeacherHostJitsiConfig({
  subject = 'Prepskm Live Mentorship — Mentor Sumit (@unfiltereddsumit)',
} = {}) {
  return {
    startWithAudioMuted: false,
    startWithVideoMuted: false,
    prejoinPageEnabled: false,
    prejoinConfig: {
      enabled: false,
    },
    disableDeepLinking: true,
    subject,
    whiteboard: {
      enabled: true,
      collabServerBaseUrl: 'https://excalidraw-backend.jit.si',
    },
    toolbarButtons: TEACHER_HOST_TOOLBAR_BUTTONS,
  };
}

if (typeof window !== 'undefined') {
  window.buildTeacherHostJitsiConfig = buildTeacherHostJitsiConfig;
}

export default function TeacherHost({
  roomName = 'PrepskmLive_MainStage',
  mentorName = 'Sumit (@unfiltereddsumit)',
  mentorEmail = 'sumitk31207@gmail.com',
  subject = 'Prepskm Live Classroom',
  onToggleSmartboard,
  onMuteAllStudents,
  onEndSession,
}) {
  const apiRef = useRef(null);
  const [statusMessage, setStatusMessage] = useState('');

  const configOverwrite = buildTeacherHostJitsiConfig({ subject });

  const triggerCommand = (cmd, arg, feedback) => {
    if (apiRef.current) {
      try {
        if (arg !== undefined) {
          apiRef.current.executeCommand(cmd, arg);
        } else {
          apiRef.current.executeCommand(cmd);
        }
      } catch (_e) {}
    }
    if (feedback) {
      setStatusMessage(feedback);
      setTimeout(() => setStatusMessage(''), 2500);
    }
  };

  return (
    <div className="w-full h-full flex flex-col bg-[#0B0F19] relative overflow-hidden">
      {/* Host Broadcast Control Bar */}
      <div className="px-3.5 py-2 bg-[#151D2F] border-b border-[#1E293B] flex flex-wrap items-center justify-between gap-2 text-[11px] shrink-0">
        <div className="flex items-center gap-2">
          <span className="px-2 py-0.5 rounded bg-[#10B981]/20 text-[#10B981] border border-[#10B981]/40 font-black uppercase tracking-wider">
            👑 Host Broadcast Studio • @unfiltereddsumit
          </span>
          {statusMessage && (
            <span className="text-indigo-300 font-bold animate-pulse">
              {statusMessage}
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => {
              triggerCommand(
                'toggleWhiteboard',
                undefined,
                'Interactive Digital Whiteboard Toggled'
              );
              if (onToggleSmartboard) onToggleSmartboard();
            }}
            className="px-2.5 py-1 rounded-lg bg-[#4F46E5] hover:bg-indigo-500 text-white font-extrabold flex items-center gap-1 cursor-pointer shadow-xs"
          >
            <span>✏️ Digital Whiteboard</span>
          </button>

          <button
            type="button"
            onClick={() =>
              triggerCommand(
                'toggleShareScreen',
                undefined,
                'Screen Share Toggled'
              )
            }
            className="px-2.5 py-1 rounded-lg bg-[#3B82F6]/20 hover:bg-[#3B82F6]/30 text-blue-300 border border-[#3B82F6]/40 font-extrabold flex items-center gap-1 cursor-pointer"
          >
            <span>🖥️ Share Screen</span>
          </button>

          <button
            type="button"
            onClick={() => {
              triggerCommand(
                'muteEveryone',
                'audio',
                'All Student Microphones Muted'
              );
              if (onMuteAllStudents) onMuteAllStudents();
            }}
            className="px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-400/40 font-extrabold flex items-center gap-1 cursor-pointer"
          >
            <span>🔇 Mute All</span>
          </button>

          {onEndSession && (
            <button
              type="button"
              onClick={onEndSession}
              className="px-2.5 py-1 rounded-lg bg-[#EF4444] hover:bg-red-500 text-white font-black flex items-center gap-1 cursor-pointer"
            >
              <span>End Broadcast</span>
            </button>
          )}
        </div>
      </div>

      {/* Host Jitsi Stage */}
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
            TOOLBAR_ALWAYS_VISIBLE: true,
            TOOLBAR_BUTTONS: TEACHER_HOST_TOOLBAR_BUTTONS,
          }}
          userInfo={{
            displayName: mentorName,
            email: mentorEmail,
          }}
          onApiReady={(externalApi) => {
            apiRef.current = externalApi;
            window.activeJitsiApi = externalApi;
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
