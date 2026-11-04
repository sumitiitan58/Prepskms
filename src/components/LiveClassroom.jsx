import React, { useState, useEffect, useRef } from 'react';
import { db, resolveCloudFileUrl } from '../firebase';
import {
  doc,
  onSnapshot,
  setDoc,
  collection,
  addDoc,
  query,
  orderBy,
  limit,
} from 'firebase/firestore';

const DEFAULT_MENTOR_AVATAR = '/assets/aistudio/IMG_1422_c0b1f775.png';
const REACTION_EMOJIS = [
  { emoji: '🔥', label: 'Fire' },
  { emoji: '👏', label: 'Clap' },
  { emoji: '❤️', label: 'Love' },
  { emoji: '💡', label: 'Got It' },
];

export default function LiveClassroom() {
  const [isOpen, setIsOpen] = useState(false);
  const [isHostMode, setIsHostMode] = useState(false);
  const [sessionData, setSessionData] = useState({
    isLive: false,
    status: 'idle', // 'idle' | 'scheduled' | 'live' | 'ended'
    title: 'JEE/NEET Master Strategy & Paper Attempting Session',
    roomName: 'PrepskmLiveMentorshipSumit',
    mentorName: 'Sumit (@unfiltereddsumit)',
    thumbnailUrl: '',
    scheduledAt: '',
    alertMessage: '',
    raiseHandLocked: false,
    chatMuted: false,
    raisedHands: [],
    onStageStudents: [],
    lastReaction: null,
  });

  const [mentorProfile, setMentorProfile] = useState({
    name: 'Sumit',
    handle: '@unfiltereddsumit',
    avatarUrl: DEFAULT_MENTOR_AVATAR,
  });

  const [messages, setMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [showChatPanel, setShowChatPanel] = useState(true);
  const [floatingReactions, setFloatingReactions] = useState([]);
  const [adminToastQueue, setAdminToastQueue] = useState([]);

  // Student stage local toggles (ONLY unlocked when student is in onStageStudents or isHostMode)
  const [studentMicActive, setStudentMicActive] = useState(false);
  const [studentCamActive, setStudentCamActive] = useState(false);
  const [studentScreenActive, setStudentScreenActive] = useState(false);

  const lastReactionIdRef = useRef('');
  const knownRaisedHandsRef = useRef(new Set());
  const chatScrollRef = useRef(null);

  // Helper to get current student/user info from global window.state
  const getCurrentUser = () => {
    const st = typeof window !== 'undefined' && window.state ? window.state : {};
    const isAdm = Boolean(st.isAdminUnlocked);
    const name = isAdm
      ? 'Sumit (@unfiltereddsumit)'
      : st.user?.name || 'Aspirant';
    const uid =
      st.user?.email ||
      st.user?.uid ||
      `student-${(st.user?.name || 'aspirant').replace(/\s+/g, '_').toLowerCase()}`;
    return { name, uid, isAdmin: isAdm };
  };

  // Subscribe to Mentor Profile (`mentor_settings/profile`)
  useEffect(() => {
    const unsub = onSnapshot(
      doc(db, 'mentor_settings', 'profile'),
      async (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          let avatar = data.avatarUrl || DEFAULT_MENTOR_AVATAR;
          if (avatar.startsWith('#prepskm-cloud-file:')) {
            try {
              avatar = await resolveCloudFileUrl(avatar);
            } catch {
              avatar = DEFAULT_MENTOR_AVATAR;
            }
          }
          const updated = {
            name: data.name || 'Sumit',
            handle: data.handle || '@unfiltereddsumit',
            avatarUrl: avatar,
          };
          setMentorProfile(updated);
          if (typeof window !== 'undefined') {
            window.prepskmMentorProfile = updated;
            if (typeof window.applyMentorProfileToDOM === 'function') {
              window.applyMentorProfileToDOM(updated);
            }
          }
        }
      },
      (err) => console.warn('mentor_settings listener error:', err)
    );
    return () => unsub();
  }, []);

  // Subscribe to Live Session (`live_sessions/current`)
  useEffect(() => {
    const unsub = onSnapshot(
      doc(db, 'live_sessions', 'current'),
      async (snap) => {
        if (!snap.exists()) return;
        const data = snap.data() || {};
        let resolvedThumb = data.thumbnailUrl || '';
        if (resolvedThumb && resolvedThumb.startsWith('#prepskm-cloud-file:')) {
          try {
            resolvedThumb = await resolveCloudFileUrl(resolvedThumb);
          } catch {
            resolvedThumb = '';
          }
        }

        const raisedHands = Array.isArray(data.raisedHands) ? data.raisedHands : [];
        const onStageStudents = Array.isArray(data.onStageStudents)
          ? data.onStageStudents
          : [];

        // Detect newly raised hands to trigger Admin Sumit toast notification
        const currentUser = getCurrentUser();
        if (currentUser.isAdmin) {
          raisedHands.forEach((rh) => {
            const key = `${rh.uid || rh.name}_${rh.time || ''}`;
            if (!knownRaisedHandsRef.current.has(key)) {
              knownRaisedHandsRef.current.add(key);
              setAdminToastQueue((prev) => [
                ...prev.filter((item) => item.uid !== (rh.uid || rh.name)),
                {
                  id: key,
                  uid: rh.uid || rh.name,
                  name: rh.name || 'Student',
                  time: rh.time || 'Just now',
                },
              ]);
            }
          });
        }

        // Trigger floating emoji reaction if new reaction arrived
        if (
          data.lastReaction &&
          data.lastReaction.id &&
          data.lastReaction.id !== lastReactionIdRef.current
        ) {
          lastReactionIdRef.current = data.lastReaction.id;
          spawnFloatingEmoji(
            data.lastReaction.emoji || '🔥',
            data.lastReaction.sender || 'Aspirant'
          );
        }

        const nextSession = {
          isLive: Boolean(data.isLive),
          status: data.status || (data.isLive ? 'live' : 'idle'),
          title:
            data.title || 'JEE/NEET Master Strategy & Paper Attempting Session',
          roomName: data.roomName || 'PrepskmLiveMentorshipSumit',
          mentorName: 'Sumit (@unfiltereddsumit)',
          thumbnailUrl: resolvedThumb,
          scheduledAt: data.scheduledAt || '',
          alertMessage: data.alertMessage || '',
          raiseHandLocked: Boolean(data.raiseHandLocked),
          chatMuted: Boolean(data.chatMuted),
          raisedHands,
          onStageStudents,
          lastReaction: data.lastReaction || null,
        };

        setSessionData(nextSession);

        if (typeof window !== 'undefined') {
          window.prepskmLiveSession = nextSession;
          if (typeof window.syncHomepageLiveCardFromReact === 'function') {
            window.syncHomepageLiveCardFromReact(nextSession);
          }
        }
      },
      (err) => console.warn('live_sessions listener error:', err)
    );
    return () => unsub();
  }, []);

  // Subscribe to Live Classroom Chat (`live_classroom_messages`)
  useEffect(() => {
    const q = query(
      collection(db, 'live_classroom_messages'),
      orderBy('createdAt', 'asc'),
      limit(120)
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setMessages(list);
        setTimeout(() => {
          if (chatScrollRef.current) {
            chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
          }
        }, 60);
      },
      (err) => console.warn('live_classroom_messages error:', err)
    );
    return () => unsub();
  }, []);

  // Expose global open/close helpers for index.html buttons
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.openLiveClassroomModal = (options = {}) => {
        const user = getCurrentUser();
        setIsHostMode(Boolean(options.asHost || user.isAdmin));
        setIsOpen(true);
      };
      window.closeLiveClassroomModal = () => {
        setIsOpen(false);
      };
      window.triggerFloatingReaction = (emoji) => {
        handleSendReaction(emoji);
      };
    }
  }, [sessionData]);

  const spawnFloatingEmoji = (emoji, senderName) => {
    const id = `react-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const leftPercent = 15 + Math.floor(Math.random() * 65);
    setFloatingReactions((prev) => [
      ...prev.slice(-24),
      { id, emoji, senderName, leftPercent },
    ]);
    setTimeout(() => {
      setFloatingReactions((prev) => prev.filter((r) => r.id !== id));
    }, 3200);
  };

  const handleSendReaction = async (emoji) => {
    const user = getCurrentUser();
    // Immediately animate locally for zero-latency feel
    spawnFloatingEmoji(emoji, user.name);
    const reactionPayload = {
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      emoji,
      sender: user.name,
      timestamp: Date.now(),
    };
    try {
      await setDoc(
        doc(db, 'live_sessions', 'current'),
        { lastReaction: reactionPayload },
        { merge: true }
      );
    } catch (err) {
      console.warn('Reaction sync error:', err);
    }
  };

  const handleRaiseHand = async () => {
    const user = getCurrentUser();
    if (sessionData.raiseHandLocked && !user.isAdmin) {
      if (typeof window.showToast === 'function') {
        window.showToast('Raise Hand is currently locked by Mentor Sumit 🔒');
      }
      return;
    }

    const existing = sessionData.raisedHands || [];
    const alreadyRaised = existing.some(
      (h) => h.uid === user.uid || h.name === user.name
    );

    let nextHands;
    if (alreadyRaised) {
      nextHands = existing.filter(
        (h) => h.uid !== user.uid && h.name !== user.name
      );
    } else {
      nextHands = [
        ...existing,
        {
          uid: user.uid,
          name: user.name,
          time: new Date().toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          }),
        },
      ];
    }

    try {
      await setDoc(
        doc(db, 'live_sessions', 'current'),
        { raisedHands: nextHands },
        { merge: true }
      );
      if (typeof window.showToast === 'function') {
        window.showToast(
          alreadyRaised
            ? 'Hand lowered.'
            : '✋ Hand Raised! Mentor Sumit has been notified.'
        );
      }
    } catch (err) {
      console.warn('Raise hand error:', err);
    }
  };

  const handleBringToStage = async (studentItem) => {
    const currentStage = sessionData.onStageStudents || [];
    const currentHands = sessionData.raisedHands || [];
    const alreadyOnStage = currentStage.some(
      (s) => s.uid === studentItem.uid || s.name === studentItem.name
    );

    const nextStage = alreadyOnStage
      ? currentStage
      : [
          ...currentStage,
          {
            uid: studentItem.uid || studentItem.name,
            name: studentItem.name,
            promotedAt: Date.now(),
          },
        ];

    const nextHands = currentHands.filter(
      (h) => h.uid !== studentItem.uid && h.name !== studentItem.name
    );

    setAdminToastQueue((prev) =>
      prev.filter((t) => t.uid !== studentItem.uid && t.name !== studentItem.name)
    );

    try {
      await setDoc(
        doc(db, 'live_sessions', 'current'),
        {
          onStageStudents: nextStage,
          raisedHands: nextHands,
        },
        { merge: true }
      );
      if (typeof window.showToast === 'function') {
        window.showToast(
          `🎙️ Brought ${studentItem.name} to Stage! Mic, Camera & Screen unlocked.`
        );
      }
    } catch (err) {
      console.warn('Bring to stage error:', err);
    }
  };

  const handleRemoveFromStage = async (studentItem) => {
    const nextStage = (sessionData.onStageStudents || []).filter(
      (s) => s.uid !== studentItem.uid && s.name !== studentItem.name
    );
    try {
      await setDoc(
        doc(db, 'live_sessions', 'current'),
        { onStageStudents: nextStage },
        { merge: true }
      );
      if (typeof window.showToast === 'function') {
        window.showToast(`${studentItem.name} moved back to audience (viewer mode).`);
      }
    } catch (err) {
      console.warn('Remove from stage error:', err);
    }
  };

  const handleToggleRaiseHandLock = async () => {
    const nextLocked = !sessionData.raiseHandLocked;
    try {
      await setDoc(
        doc(db, 'live_sessions', 'current'),
        { raiseHandLocked: nextLocked },
        { merge: true }
      );
      if (typeof window.showToast === 'function') {
        window.showToast(
          nextLocked
            ? '🔒 Raise Hand Disabled for high-focus teaching'
            : '✋ Raise Hand Unlocked for students'
        );
      }
    } catch (err) {
      console.warn('Toggle raise hand lock error:', err);
    }
  };

  const handleToggleChatMute = async () => {
    const nextMuted = !sessionData.chatMuted;
    try {
      await setDoc(
        doc(db, 'live_sessions', 'current'),
        { chatMuted: nextMuted },
        { merge: true }
      );
      if (typeof window.showToast === 'function') {
        window.showToast(
          nextMuted
            ? '🔇 Student Live Chat Muted'
            : '💬 Student Live Chat Unmuted'
        );
      }
    } catch (err) {
      console.warn('Toggle chat mute error:', err);
    }
  };

  const handleEndSession = async () => {
    try {
      await setDoc(
        doc(db, 'live_sessions', 'current'),
        {
          isLive: false,
          status: 'ended',
          raisedHands: [],
          onStageStudents: [],
          endedAt: new Date().toISOString(),
        },
        { merge: true }
      );
      if (typeof window.showToast === 'function') {
        window.showToast('🛑 Live Mentorship Session Ended for all students.');
      }
    } catch (err) {
      console.warn('End session error:', err);
    }
  };

  const handleSendChatMessage = async (e) => {
    e.preventDefault();
    const text = chatInput.trim();
    if (!text) return;

    const user = getCurrentUser();
    if (sessionData.chatMuted && !user.isAdmin) {
      if (typeof window.showToast === 'function') {
        window.showToast('Chat is currently muted by Mentor Sumit.');
      }
      return;
    }

    setChatInput('');
    try {
      await addDoc(collection(db, 'live_classroom_messages'), {
        sender: user.name,
        uid: user.uid,
        isMentor: user.isAdmin,
        text,
        time: new Date().toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        }),
        createdAt: Date.now(),
      });
    } catch (err) {
      console.warn('Send classroom chat error:', err);
    }
  };

  const currentUser = getCurrentUser();
  const isAdmin = currentUser.isAdmin || isHostMode;
  const isStudentOnStage =
    isAdmin ||
    (sessionData.onStageStudents || []).some(
      (s) => s.uid === currentUser.uid || s.name === currentUser.name
    );
  const hasRaisedHand = (sessionData.raisedHands || []).some(
    (h) => h.uid === currentUser.uid || h.name === currentUser.name
  );

  // Build Jitsi URL:
  // - If Mentor Sumit (Admin) OR Student brought to Stage -> interactive mic/cam/screen unlocked
  // - If regular Viewer Student -> strictly muted audio & video by default so they only see/hear Mentor Sumit
  const jitsiConfigHash = isAdmin
    ? '#config.prejoinPageEnabled=false&config.startWithAudioMuted=false&config.startWithVideoMuted=false'
    : isStudentOnStage
    ? `#config.prejoinPageEnabled=false&config.startWithAudioMuted=${!studentMicActive}&config.startWithVideoMuted=${!studentCamActive}`
    : '#config.prejoinPageEnabled=false&config.startWithAudioMuted=true&config.startWithVideoMuted=true&config.disableAudioLevels=true&interfaceConfig.TOOLBAR_BUTTONS=%5B%22fullscreen%22%2C%22tileview%22%5D';

  const jitsiRoomUrl = `https://meet.jit.si/${encodeURIComponent(
    sessionData.roomName || 'PrepskmLiveMentorshipSumit'
  )}${jitsiConfigHash}`;

  return (
    <>
      {/* Global Admin Toast Notification when any student raises hand */}
      {currentUser.isAdmin && adminToastQueue.length > 0 && (
        <div className="fixed top-4 right-4 z-[110] flex flex-col gap-2 max-w-sm w-full pointer-events-auto">
          {adminToastQueue.map((toast) => (
            <div
              key={toast.id}
              className="bg-slate-900/95 backdrop-blur-md border border-amber-500/50 text-white px-4 py-3 rounded-2xl shadow-2xl flex items-center justify-between gap-3 animate-bounce"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-lg shrink-0">
                  ✋
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-extrabold text-amber-300 truncate">
                    Student {toast.name} raised hand
                  </p>
                  <p className="text-[10px] text-slate-400">
                    Wants to speak on stage • {toast.time}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  onClick={() => handleBringToStage(toast)}
                  className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-extrabold shadow-sm transition cursor-pointer"
                >
                  Bring to Stage
                </button>
                <button
                  onClick={() =>
                    setAdminToastQueue((prev) =>
                      prev.filter((t) => t.id !== toast.id)
                    )
                  }
                  className="w-7 h-7 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 text-xs flex items-center justify-center"
                  title="Dismiss"
                >
                  ✕
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Full-Screen Immersive EdTech Live Classroom Player */}
      {isOpen && (
        <div className="fixed inset-0 z-[95] w-screen h-screen bg-slate-950 text-white flex flex-col overflow-hidden select-none">
          {/* Floating Emoji Reactions Overlay */}
          <div className="pointer-events-none fixed inset-0 z-[105] overflow-hidden">
            <style>{`
              @keyframes prepskmFloatUp {
                0% { transform: translateY(0) scale(0.8); opacity: 0; }
                15% { transform: translateY(-40px) scale(1.15); opacity: 1; }
                80% { opacity: 0.95; }
                100% { transform: translateY(-420px) scale(1.35); opacity: 0; }
              }
              .prepskm-floating-reaction {
                animation: prepskmFloatUp 3.1s cubic-bezier(0.22, 1, 0.36, 1) forwards;
              }
            `}</style>
            {floatingReactions.map((r) => (
              <div
                key={r.id}
                style={{ left: `${r.leftPercent}%`, bottom: '92px' }}
                className="prepskm-floating-reaction absolute flex flex-col items-center"
              >
                <span className="text-3xl sm:text-4xl drop-shadow-lg">
                  {r.emoji}
                </span>
                <span className="text-[9px] font-bold bg-slate-900/80 text-slate-200 px-1.5 py-0.5 rounded-full mt-0.5 border border-white/10">
                  {r.senderName}
                </span>
              </div>
            ))}
          </div>

          {/* Top Classroom Header Bar */}
          <div className="h-14 sm:h-16 px-3 sm:px-6 bg-slate-900/95 border-b border-slate-800 flex items-center justify-between gap-2 shrink-0 z-20">
            <div className="flex items-center gap-3 min-w-0">
              <div className="relative shrink-0">
                <img
                  src={mentorProfile.avatarUrl || DEFAULT_MENTOR_AVATAR}
                  alt="Mentor Sumit"
                  className="w-9 h-9 sm:w-10 sm:h-10 rounded-full object-cover border-2 border-rose-500"
                />
                {sessionData.isLive && (
                  <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-rose-500 ring-2 ring-slate-900 animate-ping" />
                )}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-rose-500/20 text-rose-400 border border-rose-500/30">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                    {sessionData.status === 'ended'
                      ? 'SESSION ENDED'
                      : 'LIVE CLASSROOM'}
                  </span>
                  <span className="text-xs font-bold text-indigo-300 truncate hidden sm:inline">
                    Host: Sumit (@unfiltereddsumit)
                  </span>
                </div>
                <h2 className="text-xs sm:text-sm font-extrabold text-white truncate mt-0.5">
                  {sessionData.title}
                </h2>
              </div>
            </div>

            {/* Admin Moderator Quick Controls in Header */}
            <div className="flex items-center gap-2 shrink-0">
              {isAdmin && (
                <div className="hidden md:flex items-center gap-1.5 bg-slate-800/90 border border-slate-700 rounded-xl p-1">
                  <button
                    onClick={handleToggleRaiseHandLock}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                      sessionData.raiseHandLocked
                        ? 'bg-amber-600 text-white'
                        : 'text-slate-300 hover:bg-slate-700'
                    }`}
                    title="Lock or Unlock Student Raise Hand"
                  >
                    {sessionData.raiseHandLocked
                      ? '🔒 Hands Locked'
                      : '✋ Hands Open'}
                  </button>
                  <button
                    onClick={handleToggleChatMute}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                      sessionData.chatMuted
                        ? 'bg-rose-600 text-white'
                        : 'text-slate-300 hover:bg-slate-700'
                    }`}
                    title="Mute or Unmute Student Chat"
                  >
                    {sessionData.chatMuted ? '🔇 Chat Muted' : '💬 Chat Open'}
                  </button>
                  <button
                    onClick={handleEndSession}
                    className="px-2.5 py-1 rounded-lg bg-red-600 hover:bg-red-500 text-white text-[11px] font-extrabold transition cursor-pointer"
                  >
                    End Session
                  </button>
                </div>
              )}

              <button
                onClick={() => setShowChatPanel((p) => !p)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition cursor-pointer flex items-center gap-1.5 ${
                  showChatPanel
                    ? 'bg-indigo-600 border-indigo-500 text-white'
                    : 'bg-slate-800 border-slate-700 text-slate-300'
                }`}
              >
                <span>💬</span>
                <span className="hidden sm:inline">Live Chat</span>
                <span className="px-1.5 py-0.2 bg-black/30 rounded-full text-[10px]">
                  {messages.length}
                </span>
              </button>

              <button
                onClick={() => setIsOpen(false)}
                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-slate-700 cursor-pointer"
              >
                Minimize ✕
              </button>
            </div>
          </div>

          {/* Main Full-Screen Classroom Body */}
          {sessionData.status === 'ended' && !sessionData.isLive ? (
            /* Clean "Live Session Ended" Screen for all connected students */
            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950">
              <div className="w-20 h-20 rounded-full p-1 bg-gradient-to-tr from-indigo-500 to-rose-500 mb-4 shadow-xl">
                <img
                  src={mentorProfile.avatarUrl || DEFAULT_MENTOR_AVATAR}
                  alt="Mentor Sumit"
                  className="w-full h-full rounded-full object-cover border-2 border-slate-950"
                />
              </div>
              <span className="px-3 py-1 rounded-full bg-slate-800 text-slate-300 text-xs font-bold uppercase tracking-wider border border-slate-700 mb-3">
                Live Session Ended
              </span>
              <h3 className="text-2xl sm:text-3xl font-black text-white max-w-md">
                {sessionData.title}
              </h3>
              <p className="text-sm text-slate-400 mt-2 max-w-md">
                Hosted by <strong className="text-white">Sumit (@unfiltereddsumit)</strong>. Thank you for attending! Revise today&apos;s notes in the Study Material section.
              </p>
              <button
                onClick={() => {
                  setIsOpen(false);
                  if (typeof window.switchTab === 'function') {
                    window.switchTab('home');
                  }
                }}
                className="mt-6 px-6 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-sm shadow-lg shadow-indigo-600/30 transition cursor-pointer"
              >
                Return to Home
              </button>
            </div>
          ) : (
            <div className="flex-1 flex flex-col lg:flex-row min-h-0 relative">
              {/* Primary Stream Video Stage */}
              <div className="flex-1 flex flex-col bg-black relative min-h-0">
                {/* Viewer Mode Security Banner (when student is NOT on stage) */}
                {!isStudentOnStage && (
                  <div className="bg-slate-900/90 border-b border-slate-800 px-4 py-1.5 flex items-center justify-between text-[11px] text-slate-300">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-400" />
                      <span>
                        <strong>Viewer Mode:</strong> You are watching Mentor Sumit (@unfiltereddsumit). Your camera &amp; mic are strictly disabled.
                      </span>
                    </div>
                    <span className="text-indigo-300 font-bold hidden sm:inline">
                      Want to ask a doubt on mic? Click &quot;Raise Hand ✋&quot; below
                    </span>
                  </div>
                )}

                {/* Stage Active Banner (when Admin Sumit brings student to stage!) */}
                {!isAdmin && isStudentOnStage && (
                  <div className="bg-emerald-950/90 border-b border-emerald-500/40 px-4 py-2 flex flex-wrap items-center justify-between gap-2 text-xs text-emerald-200">
                    <div className="flex items-center gap-2 font-bold">
                      <span className="px-2 py-0.5 rounded bg-emerald-600 text-white text-[10px] font-black uppercase">
                        ON STAGE
                      </span>
                      <span>
                        Mentor Sumit invited you to the stage! Your Mic, Camera &amp; Screen Share are now unlocked.
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => setStudentMicActive((v) => !v)}
                        className={`px-2.5 py-1 rounded-lg font-bold text-[11px] cursor-pointer ${
                          studentMicActive
                            ? 'bg-emerald-600 text-white'
                            : 'bg-slate-800 text-slate-300'
                        }`}
                      >
                        {studentMicActive ? '🎙️ Mic ON' : '🔇 Mic Muted'}
                      </button>
                      <button
                        onClick={() => setStudentCamActive((v) => !v)}
                        className={`px-2.5 py-1 rounded-lg font-bold text-[11px] cursor-pointer ${
                          studentCamActive
                            ? 'bg-emerald-600 text-white'
                            : 'bg-slate-800 text-slate-300'
                        }`}
                      >
                        {studentCamActive ? '📷 Cam ON' : '📷 Cam Off'}
                      </button>
                      <button
                        onClick={() => setStudentScreenActive((v) => !v)}
                        className={`px-2.5 py-1 rounded-lg font-bold text-[11px] cursor-pointer ${
                          studentScreenActive
                            ? 'bg-indigo-600 text-white'
                            : 'bg-slate-800 text-slate-300'
                        }`}
                      >
                        🖥️ Share Screen
                      </button>
                    </div>
                  </div>
                )}

                {/* Embedded Live Video Stream */}
                <div className="flex-1 relative w-full h-full">
                  <iframe
                    key={`${sessionData.roomName}_${isAdmin}_${isStudentOnStage}_${studentMicActive}_${studentCamActive}`}
                    src={jitsiRoomUrl}
                    allow="camera; microphone; fullscreen; display-capture; autoplay"
                    className="w-full h-full border-0"
                    title="Prepskm Live Mentorship Stream"
                  />
                </div>

                {/* Bottom Interactive Control Bar (Reactions + Raise Hand + Stage Roster) */}
                <div className="h-16 px-3 sm:px-6 bg-slate-900/95 border-t border-slate-800 flex items-center justify-between gap-2 shrink-0 z-20">
                  {/* Floating Reaction Buttons */}
                  <div className="flex items-center gap-1.5 sm:gap-2">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 hidden sm:inline mr-1">
                      React:
                    </span>
                    {REACTION_EMOJIS.map((item) => (
                      <button
                        key={item.emoji}
                        onClick={() => handleSendReaction(item.emoji)}
                        className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-slate-800/90 hover:bg-slate-700 active:scale-125 border border-slate-700 flex items-center justify-center text-lg sm:text-xl transition transform cursor-pointer shadow-sm"
                        title={`Send ${item.label} reaction`}
                      >
                        {item.emoji}
                      </button>
                    ))}
                  </div>

                  {/* Active On-Stage Student Pills */}
                  {sessionData.onStageStudents &&
                    sessionData.onStageStudents.length > 0 && (
                      <div className="hidden xl:flex items-center gap-1.5 overflow-x-auto max-w-md">
                        <span className="text-[10px] font-bold text-emerald-400 uppercase">
                          On Stage:
                        </span>
                        {sessionData.onStageStudents.map((st) => (
                          <span
                            key={st.uid || st.name}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-bold"
                          >
                            🎙️ {st.name}
                            {isAdmin && (
                              <button
                                onClick={() => handleRemoveFromStage(st)}
                                className="ml-1 text-rose-300 hover:text-white text-[10px] font-black cursor-pointer"
                                title="Remove from stage"
                              >
                                ✕
                              </button>
                            )}
                          </span>
                        ))}
                      </div>
                    )}

                  {/* Student Raise Hand Button OR Admin Mobile Moderator Controls */}
                  <div className="flex items-center gap-2">
                    {!isAdmin ? (
                      <button
                        onClick={handleRaiseHand}
                        disabled={sessionData.raiseHandLocked && !hasRaisedHand}
                        className={`px-4 py-2.5 rounded-2xl font-extrabold text-xs sm:text-sm flex items-center gap-2 transition shadow-md cursor-pointer ${
                          hasRaisedHand
                            ? 'bg-amber-500 text-slate-950 hover:bg-amber-400'
                            : sessionData.raiseHandLocked
                            ? 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed'
                            : 'bg-indigo-600 hover:bg-indigo-500 text-white'
                        }`}
                      >
                        <span>{sessionData.raiseHandLocked ? '🔒' : '✋'}</span>
                        <span>
                          {hasRaisedHand
                            ? 'Hand Raised (Lower)'
                            : sessionData.raiseHandLocked
                            ? 'Raise Hand Locked'
                            : 'Raise Hand ✋'}
                        </span>
                      </button>
                    ) : (
                      <div className="flex items-center gap-1.5">
                        <span className="px-3 py-1.5 rounded-xl bg-amber-500/20 border border-amber-500/30 text-amber-300 text-xs font-extrabold">
                          ✋ {sessionData.raisedHands?.length || 0} Raised
                        </span>
                        <button
                          onClick={handleEndSession}
                          className="md:hidden px-3 py-2 rounded-xl bg-red-600 text-white text-xs font-extrabold"
                        >
                          End
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Right Side Panel: Live Chat + Admin Raise Hand Queue */}
              {showChatPanel && (
                <div className="w-full lg:w-80 xl:w-96 h-72 lg:h-auto bg-slate-900 border-t lg:border-t-0 lg:border-l border-slate-800 flex flex-col shrink-0 z-20">
                  {/* Admin Raise Hand Queue inside Sidebar */}
                  {isAdmin &&
                    sessionData.raisedHands &&
                    sessionData.raisedHands.length > 0 && (
                      <div className="p-3 bg-amber-950/40 border-b border-amber-500/30">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[11px] font-extrabold uppercase tracking-wider text-amber-300">
                            ✋ Raised Hands ({sessionData.raisedHands.length})
                          </span>
                        </div>
                        <div className="space-y-1.5 max-h-28 overflow-y-auto">
                          {sessionData.raisedHands.map((rh) => (
                            <div
                              key={rh.uid || rh.name}
                              className="flex items-center justify-between bg-slate-900/90 px-2.5 py-1.5 rounded-xl border border-amber-500/30"
                            >
                              <div className="min-w-0">
                                <p className="text-xs font-bold text-white truncate">
                                  {rh.name}
                                </p>
                                <p className="text-[10px] text-slate-400">
                                  {rh.time}
                                </p>
                              </div>
                              <button
                                onClick={() => handleBringToStage(rh)}
                                className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-extrabold shrink-0 cursor-pointer"
                              >
                                Bring to Stage
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                  {/* Chat Header */}
                  <div className="px-4 py-2.5 border-b border-slate-800 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-400" />
                      <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-200">
                        Live Classroom Chat
                      </h4>
                    </div>
                    {sessionData.chatMuted && (
                      <span className="px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 text-[10px] font-bold">
                        Muted by Host
                      </span>
                    )}
                  </div>

                  {/* Chat Messages Stream */}
                  <div
                    ref={chatScrollRef}
                    className="flex-1 p-3 overflow-y-auto space-y-2.5 text-xs"
                  >
                    {messages.length === 0 ? (
                      <div className="text-center py-8 text-slate-500">
                        <p className="font-bold">Welcome to Live Mentorship!</p>
                        <p className="text-[11px] mt-1">
                          Ask doubts here or tap 🔥 👏 ❤️ 💡 below.
                        </p>
                      </div>
                    ) : (
                      messages.map((m) => (
                        <div
                          key={m.id}
                          className={`p-2.5 rounded-xl border ${
                            m.isMentor
                              ? 'bg-indigo-950/60 border-indigo-500/40'
                              : 'bg-slate-800/70 border-slate-700/60'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <span
                              className={`font-extrabold ${
                                m.isMentor ? 'text-indigo-300' : 'text-slate-200'
                              }`}
                            >
                              {m.sender}
                              {m.isMentor && (
                                <span className="ml-1.5 px-1.5 py-0.5 rounded bg-indigo-600 text-white text-[9px] uppercase">
                                  HOST
                                </span>
                              )}
                            </span>
                            <span className="text-[10px] text-slate-500">
                              {m.time}
                            </span>
                          </div>
                          <p className="text-slate-100 leading-relaxed break-words">
                            {m.text}
                          </p>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Chat Input Box */}
                  <form
                    onSubmit={handleSendChatMessage}
                    className="p-2.5 border-t border-slate-800 bg-slate-900 flex items-center gap-2"
                  >
                    <input
                      type="text"
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      disabled={sessionData.chatMuted && !isAdmin}
                      placeholder={
                        sessionData.chatMuted && !isAdmin
                          ? 'Chat is muted by Mentor Sumit...'
                          : 'Ask a live doubt or comment...'
                      }
                      className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 disabled:opacity-50"
                    />
                    <button
                      type="submit"
                      disabled={sessionData.chatMuted && !isAdmin}
                      className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-xs font-extrabold transition cursor-pointer"
                    >
                      Send
                    </button>
                  </form>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </>
  );
}
