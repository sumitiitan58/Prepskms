import React, { useEffect, useState, useRef } from 'react';
import {
  subscribeToActiveSession,
  subscribeToChatMessages,
  subscribeToRaiseHands,
  sendLiveChatMessage,
  submitRaiseHandRequest,
  respondToRaiseHand,
  updateLiveSessionState,
  subscribeToMentorProfile,
  DEFAULT_MENTOR_PROFILE
} from '../services/db';

const DEFAULT_POLL = {
  id: 'poll-default-1',
  question: 'A projectile is fired at 60° with initial velocity 40 m/s. What is its speed at the highest point? (g = 10 m/s²)',
  options: [
    'A) 0 m/s',
    'B) 20 m/s',
    'C) 20√3 m/s',
    'D) 40 m/s'
  ],
  correctIndex: 1,
  durationSec: 45,
  votes: { 0: 8, 1: 65, 2: 19, 3: 8 },
  active: true
};

export default function LiveClassroom() {
  const [isOpen, setIsOpen] = useState(false);
  const [session, setSession] = useState(null);
  const [messages, setMessages] = useState([]);
  const [hands, setHands] = useState([]);
  const [chatText, setChatText] = useState('');
  const [mentor, setMentor] = useState(DEFAULT_MENTOR_PROFILE);
  const [isAdmin, setIsAdmin] = useState(false);
  const [currentUser, setCurrentUser] = useState({
    id: 'student-local',
    name: 'Aspirant',
    email: ''
  });

  // Orientation & Tab State
  const [orientationMode, setOrientationMode] = useState('portrait'); // 'portrait' | 'landscape'
  const [activeBottomTab, setActiveBottomTab] = useState('chat'); // 'chat' | 'polls' | 'info'
  const [showLandscapeOverlay, setShowLandscapeOverlay] = useState(true);
  const [isWebRtcStageMounted, setIsWebRtcStageMounted] = useState(false);

  // Live Polls State
  const [activePoll, setActivePoll] = useState(DEFAULT_POLL);
  const [selectedPollOption, setSelectedPollOption] = useState(null);
  const [pollTimeLeft, setPollTimeLeft] = useState(45);
  const [showCreatePollModal, setShowCreatePollModal] = useState(false);
  const [newPollQuestion, setNewPollQuestion] = useState('');
  const [newPollOptA, setNewPollOptA] = useState('');
  const [newPollOptB, setNewPollOptB] = useState('');
  const [newPollOptC, setNewPollOptC] = useState('');
  const [newPollOptD, setNewPollOptD] = useState('');
  const [newPollCorrect, setNewPollCorrect] = useState(0);
  const [newPollDuration, setNewPollDuration] = useState(30);

  // Floating Reactions & Live Counters
  const [floatingReactions, setFloatingReactions] = useState([]);
  const [reactionCounts, setReactionCounts] = useState({
    '🔥': 142,
    '👏': 89,
    '💡': 64,
    '❤️': 210
  });

  const chatScrollRef = useRef(null);

  useEffect(() => {
    const syncIdentity = () => {
      const w = window;
      const adminFlag = Boolean(w.isAdminAuthenticated);
      setIsAdmin(adminFlag);
      const userObj = w.currentUser || {};
      const savedName =
        userObj.name ||
        localStorage.getItem('prepskm_user_name') ||
        (adminFlag ? 'Sumit (@unfiltereddsumit)' : 'Aspirant');
      const savedId =
        userObj.uid ||
        userObj.email ||
        localStorage.getItem('prepskm_student_uid') ||
        'student-' + Math.floor(1000 + Math.random() * 9000);
      if (!localStorage.getItem('prepskm_student_uid')) {
        localStorage.setItem('prepskm_student_uid', savedId);
      }
      setCurrentUser({
        id: savedId,
        name: adminFlag ? 'Sumit (@unfiltereddsumit)' : savedName,
        email: userObj.email || ''
      });
    };

    syncIdentity();
    const interval = setInterval(syncIdentity, 1200);

    wOpenSetup();
    const unsubSession = subscribeToActiveSession((data) => {
      setSession(data);
      if (data?.activePoll) {
        setActivePoll(data.activePoll);
      }
      if (data?.reactionCounts) {
        setReactionCounts(data.reactionCounts);
      }
      const w = window;
      if (typeof w.syncHomepageLiveBanner === 'function') {
        w.syncHomepageLiveBanner(data);
      }
    });
    const unsubChat = subscribeToChatMessages('current', (list) => {
      setMessages(list);
    });
    const unsubHands = subscribeToRaiseHands('current', (list) => {
      setHands(list);
    });
    const unsubMentor = subscribeToMentorProfile((profile) => {
      setMentor(profile);
    });

    return () => {
      clearInterval(interval);
      unsubSession();
      unsubChat();
      unsubHands();
      unsubMentor();
    };
  }, []);

  // Poll countdown timer
  useEffect(() => {
    if (!activePoll?.active) return;
    setPollTimeLeft(activePoll.durationSec || 30);
    const timer = setInterval(() => {
      setPollTimeLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [activePoll?.id, activePoll?.active]);

  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [messages, isOpen]);

  function wOpenSetup() {
    const w = window;
    const openFn = () => {
      setIsOpen(true);
    };
    const closeFn = () => {
      setIsOpen(false);
    };
    w.openReactLiveClassroom = openFn;
    w.closeReactLiveClassroom = closeFn;
    w.openLiveClassroomModal = openFn;
    w.closeLiveClassroomModal = closeFn;
    w.openFullScreenLiveClassroom = openFn;
    w.closeFullScreenLiveClassroom = closeFn;
  }

  if (!isOpen) return null;

  const activeSession = session || {
    title: 'JEE/NEET Strategy, Rank Booster & Live Doubt Solving',
    topic: 'High-Weightage Physics & Organic Chemistry Masterclass',
    status: 'live',
    roomName: 'PrepskmLiveMentorshipSumit',
    hostName: mentor.name || 'Sumit',
    hostHandle: mentor.handle || '@unfiltereddsumit',
    hostAvatar: mentor.avatarUrl || '/assets/aistudio/IMG_1422_c0b1f775.png',
    isChatMuted: false,
    isRaiseHandBlocked: false,
    acceptedStudents: []
  };

  const isConcluded = activeSession.status === 'ended';
  const myHandRequest = hands.find((h) => h.studentId === currentUser.id);
  const isAcceptedOnStage =
    isAdmin ||
    myHandRequest?.status === 'accepted' ||
    (Array.isArray(activeSession.acceptedStudents) &&
      activeSession.acceptedStudents.includes(currentUser.id));

  const pendingHands = hands.filter((h) => h.status === 'pending');

  const handleSendChat = async (e) => {
    e.preventDefault();
    if (!chatText.trim()) return;
    if (activeSession.isChatMuted && !isAdmin) return;
    const textToSend = chatText.trim();
    setChatText('');
    await sendLiveChatMessage('current', {
      senderName: isAdmin ? 'Sumit (@unfiltereddsumit)' : currentUser.name,
      senderRole: isAdmin ? 'host' : 'student',
      senderAvatar: isAdmin ? mentor.avatarUrl : '',
      text: textToSend
    });
  };

  const handleRaiseHandClick = async () => {
    if (activeSession.isRaiseHandBlocked) return;
    await submitRaiseHandRequest('current', {
      id: currentUser.id,
      name: currentUser.name
    });
  };

  const handleHostHandDecision = async (studentId, decision) => {
    await respondToRaiseHand('current', studentId, decision);
    if (decision === 'accepted') {
      const currentAccepted = Array.isArray(activeSession.acceptedStudents)
        ? activeSession.acceptedStudents
        : [];
      if (!currentAccepted.includes(studentId)) {
        await updateLiveSessionState({
          acceptedStudents: [...currentAccepted, studentId]
        });
      }
    } else {
      const currentAccepted = Array.isArray(activeSession.acceptedStudents)
        ? activeSession.acceptedStudents
        : [];
      await updateLiveSessionState({
        acceptedStudents: currentAccepted.filter((id) => id !== studentId)
      });
    }
  };

  const handleToggleMuteChat = async () => {
    if (!isAdmin) return;
    await updateLiveSessionState({
      isChatMuted: !activeSession.isChatMuted
    });
  };

  const handleToggleBlockHands = async () => {
    if (!isAdmin) return;
    await updateLiveSessionState({
      isRaiseHandBlocked: !activeSession.isRaiseHandBlocked
    });
  };

  const handleEndOrRestartBroadcast = async () => {
    if (!isAdmin) return;
    const nextStatus = isConcluded ? 'live' : 'ended';
    await updateLiveSessionState({
      status: nextStatus,
      acceptedStudents: []
    });
  };

  const handleTriggerReaction = async (emoji) => {
    const id = Date.now() + '-' + Math.random();
    const leftOffset = 15 + Math.floor(Math.random() * 70);
    setFloatingReactions((prev) => [...prev, { id, emoji, leftOffset }]);
    setTimeout(() => {
      setFloatingReactions((prev) => prev.filter((item) => item.id !== id));
    }, 2200);

    const updatedCounts = {
      ...reactionCounts,
      [emoji]: (reactionCounts[emoji] || 0) + 1
    };
    setReactionCounts(updatedCounts);
    try {
      await updateLiveSessionState({ reactionCounts: updatedCounts });
    } catch {
      // Local fallback state already updated
    }
  };

  const handleVotePoll = async (optionIdx) => {
    if (selectedPollOption !== null) return;
    setSelectedPollOption(optionIdx);
    const currentVotes = { ...(activePoll.votes || { 0: 0, 1: 0, 2: 0, 3: 0 }) };
    currentVotes[optionIdx] = (currentVotes[optionIdx] || 0) + 1;
    const updatedPoll = {
      ...activePoll,
      votes: currentVotes
    };
    setActivePoll(updatedPoll);
    try {
      await updateLiveSessionState({ activePoll: updatedPoll });
    } catch {
      // Local fallback state already updated
    }
  };

  const handleLaunchNewPoll = async (e) => {
    e.preventDefault();
    if (!isAdmin || !newPollQuestion.trim()) return;
    const createdPoll = {
      id: 'poll-' + Date.now(),
      question: newPollQuestion.trim(),
      options: [
        `A) ${newPollOptA.trim() || 'Option A'}`,
        `B) ${newPollOptB.trim() || 'Option B'}`,
        `C) ${newPollOptC.trim() || 'Option C'}`,
        `D) ${newPollOptD.trim() || 'Option D'}`
      ],
      correctIndex: Number(newPollCorrect) || 0,
      durationSec: Number(newPollDuration) || 30,
      votes: { 0: 1, 1: 0, 2: 0, 3: 0 },
      active: true
    };
    setActivePoll(createdPoll);
    setSelectedPollOption(null);
    setPollTimeLeft(createdPoll.durationSec);
    setShowCreatePollModal(false);
    setActiveBottomTab('polls');
    try {
      await updateLiveSessionState({ activePoll: createdPoll });
    } catch {
      // Fallback already applied
    }
  };

  const totalPollVotes = Object.values(activePoll?.votes || {}).reduce(
    (acc, v) => acc + (Number(v) || 0),
    0
  );

  // Seamless Player UI: Students NEVER see raw Jitsi branding/links by default.
  // Only mount the WebRTC stage iframe if a student's Raise Hand is accepted onto stage AND they click join audio/video, or if Host explicitly toggles WebRTC camera.
  const jitsiRoom = (activeSession.roomName || 'PrepskmLiveMentorshipSumit').replace(
    /[^a-zA-Z0-9]/g,
    ''
  );
  const jitsiConfigParams = [
    'config.prejoinPageEnabled=false',
    'config.prejoinConfig.enabled=false',
    'config.disableDeepLinking=true',
    'config.startWithAudioMuted=false',
    'config.startWithVideoMuted=false',
    'interfaceConfig.SHOW_JITSI_WATERMARK=false',
    'interfaceConfig.SHOW_BRAND_WATERMARK=false',
    'interfaceConfig.MOBILE_APP_PROMO=false',
    `userInfo.displayName="${encodeURIComponent(currentUser.name)}"`
  ].join('&');
  const jitsiEmbedUrl = `https://meet.jit.si/${jitsiRoom}#${jitsiConfigParams}`;

  return (
    <div className="fixed inset-0 z-[9999] bg-slate-950/95 backdrop-blur-xl flex flex-col overflow-hidden text-white">
      {/* Top Classroom Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 sm:px-5 py-2.5 bg-slate-900/95 border-b border-slate-800 shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="relative shrink-0">
            <img
              src={mentor.avatarUrl || '/assets/aistudio/IMG_1422_c0b1f775.png'}
              alt="Sumit"
              className="w-9 h-9 rounded-full object-cover border-2 border-rose-500"
            />
            {!isConcluded && (
              <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-red-500 ring-2 ring-slate-900 animate-ping" />
            )}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span
                className={`inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${
                  isConcluded
                    ? 'bg-slate-700 text-slate-300'
                    : 'bg-red-600 text-white shadow-sm shadow-red-500/40'
                }`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    isConcluded ? 'bg-slate-400' : 'bg-white animate-pulse'
                  }`}
                />
                {isConcluded ? 'SESSION ENDED' : 'LIVE CLASSROOM'}
              </span>
              <span className="text-[11px] font-bold text-indigo-300 truncate">
                Lead Mentor: {mentor.name || 'Sumit'} ({mentor.handle || '@unfiltereddsumit'})
              </span>
            </div>
            <h2 className="text-xs sm:text-sm font-extrabold text-white truncate">
              {activeSession.title}
            </h2>
          </div>
        </div>

        {/* Orientation Switcher & Host Controls */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {/* Orientation Mode Toggle (Portrait vs Landscape Fullscreen) */}
          <div className="inline-flex items-center bg-slate-800/90 p-0.5 rounded-lg border border-slate-700">
            <button
              type="button"
              onClick={() => setOrientationMode('portrait')}
              className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition ${
                orientationMode === 'portrait'
                  ? 'bg-indigo-600 text-white shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Portrait Split View (Video Top + Tabs Bottom)"
            >
              📱 Portrait
            </button>
            <button
              type="button"
              onClick={() => setOrientationMode('landscape')}
              className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition ${
                orientationMode === 'landscape'
                  ? 'bg-indigo-600 text-white shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Landscape Fullscreen View with Translucent Overlay"
            >
              🖥️ Landscape
            </button>
          </div>

          {/* Mentor God-Mode Controls */}
          {isAdmin && (
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                type="button"
                onClick={() => setShowCreatePollModal(true)}
                className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-indigo-600 hover:bg-indigo-500 text-white border border-indigo-400/30 transition"
              >
                📊 Launch Poll
              </button>
              <button
                type="button"
                onClick={handleToggleBlockHands}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition ${
                  activeSession.isRaiseHandBlocked
                    ? 'bg-amber-500/20 border-amber-500/50 text-amber-300'
                    : 'bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700'
                }`}
              >
                {activeSession.isRaiseHandBlocked ? '✋ Hands Blocked' : '✋ Block Raise Hand'}
              </button>
              <button
                type="button"
                onClick={handleToggleMuteChat}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition ${
                  activeSession.isChatMuted
                    ? 'bg-rose-500/20 border-rose-500/50 text-rose-300'
                    : 'bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700'
                }`}
              >
                {activeSession.isChatMuted ? '🔇 Chat Locked' : '💬 Mute Chat'}
              </button>
              <button
                type="button"
                onClick={handleEndOrRestartBroadcast}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-black transition ${
                  isConcluded
                    ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                    : 'bg-red-600 hover:bg-red-500 text-white'
                }`}
              >
                {isConcluded ? '▶ Resume Broadcast' : '⏹ End Broadcast'}
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={() => setIsOpen(false)}
            className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-slate-700"
          >
            ✕ Leave
          </button>
        </div>
      </div>

      {/* Host On-Screen Toast for Pending Raise Hand Requests */}
      {isAdmin && pendingHands.length > 0 && (
        <div className="bg-indigo-950/95 border-b border-indigo-500/40 px-4 py-2 flex flex-wrap items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2 text-xs font-bold text-indigo-200">
            <span className="text-base animate-bounce">✋</span>
            <span>
              Student Raise Hand Request ({pendingHands.length}):{' '}
              <strong className="text-white">{pendingHands[0].studentName}</strong> wants to join
              stage with audio/video!
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleHostHandDecision(pendingHands[0].studentId, 'accepted')}
              className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black shadow"
            >
              ✓ Accept to Stage
            </button>
            <button
              type="button"
              onClick={() => handleHostHandDecision(pendingHands[0].studentId, 'declined')}
              className="px-3 py-1 rounded-lg bg-rose-600/80 hover:bg-rose-600 text-white text-xs font-bold"
            >
              ✕ Decline
            </button>
          </div>
        </div>
      )}

      {/* Main Classroom Stage + Interactive Panel */}
      <div
        className={`flex-1 flex overflow-hidden relative ${
          orientationMode === 'landscape' ? 'flex-row' : 'flex-col lg:flex-row'
        }`}
      >
        {/* Video Stage Area (Native PW / YouTube Live Style Wrapper) */}
        <div
          className={`relative bg-black flex flex-col justify-between overflow-hidden ${
            orientationMode === 'landscape'
              ? 'w-full h-full'
              : 'w-full h-[44vh] sm:h-[50vh] lg:h-full lg:flex-1 shrink-0'
          }`}
        >
          {isConcluded ? (
            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center bg-gradient-to-b from-slate-900 to-slate-950">
              <img
                src={mentor.avatarUrl || '/assets/aistudio/IMG_1422_c0b1f775.png'}
                alt="Sumit"
                className="w-20 h-20 rounded-full object-cover border-4 border-slate-700 mb-3 opacity-80"
              />
              <span className="px-3 py-1 rounded-full bg-slate-800 text-slate-400 text-xs font-black uppercase tracking-widest mb-2">
                Broadcast Ended
              </span>
              <h3 className="text-xl font-black text-white mb-1">Live Session Concluded</h3>
              <p className="text-xs text-slate-400 max-w-md mb-4">
                Lead Mentor {mentor.name || 'Sumit'} ({mentor.handle || '@unfiltereddsumit'}) has
                concluded this live mentorship broadcast. Check the Weekly Schedule Hub for the next
                session!
              </p>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black"
              >
                Return to Dashboard
              </button>
            </div>
          ) : isWebRtcStageMounted && isAcceptedOnStage ? (
            <div className="relative w-full h-full">
              <iframe
                title="Prepskm Interactive Stage"
                src={jitsiEmbedUrl}
                allow="camera; microphone; fullscreen; display-capture; autoplay"
                className="w-full h-full border-0"
              />
              <button
                type="button"
                onClick={() => setIsWebRtcStageMounted(false)}
                className="absolute top-3 right-3 z-20 px-3 py-1.5 rounded-lg bg-slate-900/90 hover:bg-slate-800 text-white text-xs font-bold border border-slate-700"
              >
                Return to Smartboard View
              </button>
            </div>
          ) : (
            /* Native PhysicsWallah / YouTube Live Classroom Smartboard Stream */
            <div className="relative w-full h-full flex flex-col justify-between bg-gradient-to-br from-slate-950 via-[#0b132b] to-indigo-950 p-4 sm:p-6 select-none overflow-hidden">
              {/* Top Overlay Inside Video Player */}
              <div className="flex items-center justify-between gap-2 z-10">
                <div className="flex items-center gap-2 bg-slate-900/80 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10">
                  <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
                  <span className="text-[11px] font-black tracking-wider uppercase text-white">
                    LIVE SMARTBOARD
                  </span>
                  <span className="text-[11px] text-slate-300 font-semibold">• 1080p60 HD</span>
                </div>

                {/* Live Reaction Counter Pill */}
                <div className="flex items-center gap-2 bg-slate-900/80 backdrop-blur-md px-3 py-1 rounded-full border border-white/10 text-[11px] font-bold text-slate-200">
                  <span>🔥 {reactionCounts['🔥']}</span>
                  <span>•</span>
                  <span>👏 {reactionCounts['👏']}</span>
                  <span>•</span>
                  <span>💡 {reactionCounts['💡']}</span>
                  <span>•</span>
                  <span>❤️ {reactionCounts['❤️']}</span>
                </div>
              </div>

              {/* Center Smartboard Chalkboard / Formula Presentation */}
              <div className="my-auto max-w-2xl mx-auto w-full bg-slate-900/75 border border-indigo-500/30 rounded-2xl p-4 sm:p-6 shadow-2xl backdrop-blur-md relative z-10">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-black uppercase tracking-widest text-indigo-400 bg-indigo-500/10 px-2.5 py-0.5 rounded-md border border-indigo-500/20">
                    {activeSession.topic || 'JEE / NEET Concept Breakdown'}
                  </span>
                  <span className="text-[11px] font-mono text-emerald-400 font-bold">
                    Mentor: {mentor.handle || '@unfiltereddsumit'}
                  </span>
                </div>
                <h3 className="text-sm sm:text-lg font-black text-white mb-2">
                  {activeSession.title}
                </h3>
                <div className="bg-slate-950/90 rounded-xl p-3 border border-slate-800 font-mono text-xs sm:text-sm text-amber-300 space-y-1">
                  <div>
                    1. Projectile Speed at Max Height: v_top = u · cos(θ) = 40 · cos(60°) = 20 m/s
                  </div>
                  <div className="text-emerald-300">
                    2. Time of Flight: T = (2u · sinθ) / g = (2 × 40 × √3/2) / 10 = 4√3 s
                  </div>
                </div>

                {/* Picture-in-Picture Lead Mentor Sumit Camera Feed */}
                <div className="mt-3 flex items-center justify-between gap-3 pt-2 border-t border-slate-800/80">
                  <div className="flex items-center gap-2.5">
                    <img
                      src={mentor.avatarUrl || '/assets/aistudio/IMG_1422_c0b1f775.png'}
                      alt="Lead Mentor Sumit"
                      className="w-10 h-10 rounded-xl object-cover border-2 border-indigo-400"
                    />
                    <div>
                      <div className="text-xs font-extrabold text-white flex items-center gap-1.5">
                        {mentor.name || 'Sumit'}
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-600 text-white font-black">
                          Lead Mentor
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400">
                        Audio & Smartboard Stream Active
                      </div>
                    </div>
                  </div>

                  {isAcceptedOnStage && (
                    <button
                      type="button"
                      onClick={() => setIsWebRtcStageMounted(true)}
                      className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black shadow-lg"
                    >
                      🎙️ Join Interactive Stage Cam/Mic
                    </button>
                  )}
                </div>
              </div>

              {/* Floating Emojis Animation Layer */}
              <div className="pointer-events-none absolute inset-0 overflow-hidden z-20">
                {floatingReactions.map((item) => (
                  <div
                    key={item.id}
                    style={{ left: `${item.leftOffset}%` }}
                    className="absolute bottom-14 text-2xl sm:text-3xl animate-bounce transition-all duration-1000 opacity-95"
                  >
                    {item.emoji}
                  </div>
                ))}
              </div>

              {/* Bottom Player Controls: Reactions + Student Raise Hand + Landscape Overlay Toggle */}
              <div className="flex flex-wrap items-center justify-between gap-2 z-10 pt-2">
                {/* Quick Reaction Bar */}
                <div className="flex items-center gap-1.5 bg-slate-900/85 backdrop-blur-md px-2.5 py-1.5 rounded-xl border border-white/10">
                  {['🔥', '👏', '💡', '❤️'].map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => handleTriggerReaction(emoji)}
                      className="px-2.5 py-1 rounded-lg bg-slate-800/90 hover:bg-slate-700 active:scale-110 transition text-xs font-bold flex items-center gap-1"
                    >
                      <span>{emoji}</span>
                      <span className="text-[10px] text-slate-300">{reactionCounts[emoji]}</span>
                    </button>
                  ))}
                </div>

                {/* Student Raise Hand / Stage Control */}
                <div className="flex items-center gap-2">
                  {!isAdmin && (
                    <button
                      type="button"
                      disabled={
                        activeSession.isRaiseHandBlocked ||
                        myHandRequest?.status === 'pending' ||
                        isAcceptedOnStage
                      }
                      onClick={handleRaiseHandClick}
                      className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition shadow-lg ${
                        isAcceptedOnStage
                          ? 'bg-emerald-600 text-white'
                          : myHandRequest?.status === 'pending'
                          ? 'bg-amber-500/30 border border-amber-400/50 text-amber-200'
                          : activeSession.isRaiseHandBlocked
                          ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                          : 'bg-indigo-600 hover:bg-indigo-500 text-white'
                      }`}
                    >
                      {isAcceptedOnStage
                        ? '🎙️ Stage Mic Unlocked'
                        : myHandRequest?.status === 'pending'
                        ? '✋ Request Sent (Waiting for Sumit...)'
                        : activeSession.isRaiseHandBlocked
                        ? '✋ Join Requests Blocked'
                        : 'Request to Join ✋'}
                    </button>
                  )}

                  {orientationMode === 'landscape' && (
                    <button
                      type="button"
                      onClick={() => setShowLandscapeOverlay((prev) => !prev)}
                      className="px-3 py-1.5 rounded-xl bg-slate-900/90 border border-white/15 text-xs font-bold text-white"
                    >
                      {showLandscapeOverlay ? 'Hide Chat/Polls' : 'Show Chat/Polls'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Interactive Tabbed Panel (Bottom in Portrait Mode, Translucent Overlay in Landscape Mode) */}
        {(orientationMode === 'portrait' || showLandscapeOverlay) && (
          <div
            className={`flex flex-col bg-slate-900/95 border-t lg:border-t-0 lg:border-l border-slate-800 ${
              orientationMode === 'landscape'
                ? 'absolute right-3 top-3 bottom-3 w-80 sm:w-96 rounded-2xl bg-slate-900/80 backdrop-blur-xl border border-white/15 z-30 shadow-2xl'
                : 'flex-1 lg:w-96 lg:flex-none overflow-hidden'
            }`}
          >
            {/* Tabs Header: Chat | Live Polls | Session Info */}
            <div className="grid grid-cols-3 border-b border-slate-800 bg-slate-950/60 shrink-0">
              <button
                type="button"
                onClick={() => setActiveBottomTab('chat')}
                className={`py-2.5 text-xs font-black border-b-2 transition ${
                  activeBottomTab === 'chat'
                    ? 'border-indigo-500 text-white bg-indigo-500/10'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                💬 Chat ({messages.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveBottomTab('polls')}
                className={`py-2.5 text-xs font-black border-b-2 transition flex items-center justify-center gap-1 ${
                  activeBottomTab === 'polls'
                    ? 'border-indigo-500 text-white bg-indigo-500/10'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <span>📊 Live Polls</span>
                {activePoll?.active && (
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                )}
              </button>
              <button
                type="button"
                onClick={() => setActiveBottomTab('info')}
                className={`py-2.5 text-xs font-black border-b-2 transition ${
                  activeBottomTab === 'info'
                    ? 'border-indigo-500 text-white bg-indigo-500/10'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                ℹ️ Session Info
              </button>
            </div>

            {/* TAB 1: LIVE CHAT */}
            {activeBottomTab === 'chat' && (
              <div className="flex-1 flex flex-col overflow-hidden">
                <div
                  ref={chatScrollRef}
                  className="flex-1 overflow-y-auto p-3 space-y-2 text-xs"
                >
                  {messages.length === 0 ? (
                    <div className="text-center py-8 text-slate-500">
                      Welcome to the Live Classroom! Ask your doubts in real time.
                    </div>
                  ) : (
                    messages.map((msg) => (
                      <div
                        key={msg.id}
                        className={`p-2.5 rounded-xl border ${
                          msg.senderRole === 'host'
                            ? 'bg-indigo-950/70 border-indigo-500/40'
                            : 'bg-slate-800/70 border-slate-700/60'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2 mb-0.5">
                          <span
                            className={`font-black text-[11px] ${
                              msg.senderRole === 'host' ? 'text-indigo-300' : 'text-slate-300'
                            }`}
                          >
                            {msg.senderName}
                            {msg.senderRole === 'host' && (
                              <span className="ml-1.5 px-1.5 py-0.5 text-[9px] rounded bg-indigo-600 text-white uppercase">
                                Lead Mentor
                              </span>
                            )}
                          </span>
                        </div>
                        <p className="text-slate-100 leading-relaxed break-words">{msg.text}</p>
                      </div>
                    ))
                  )}
                </div>

                {/* Chat Input */}
                <form
                  onSubmit={handleSendChat}
                  className="p-2.5 bg-slate-950 border-t border-slate-800 flex items-center gap-2 shrink-0"
                >
                  <input
                    type="text"
                    value={chatText}
                    onChange={(e) => setChatText(e.target.value)}
                    disabled={activeSession.isChatMuted && !isAdmin}
                    placeholder={
                      activeSession.isChatMuted && !isAdmin
                        ? 'Live Chat is muted by Lead Mentor Sumit'
                        : 'Ask a doubt or reply to poll...'
                    }
                    className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                  />
                  <button
                    type="submit"
                    disabled={activeSession.isChatMuted && !isAdmin}
                    className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-xs font-black"
                  >
                    Send
                  </button>
                </form>
              </div>
            )}

            {/* TAB 2: LIVE POLLS & QUIZ SYSTEM */}
            {activeBottomTab === 'polls' && (
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-black uppercase tracking-wider text-indigo-400">
                    ⚡ Real-Time Classroom Poll
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 text-[11px] font-black">
                    ⏱ {pollTimeLeft}s left
                  </span>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-800/90 border border-slate-700 space-y-3">
                  <p className="text-xs sm:text-sm font-extrabold text-white leading-snug">
                    {activePoll.question}
                  </p>

                  <div className="space-y-2">
                    {activePoll.options.map((opt, idx) => {
                      const count = Number(activePoll.votes?.[idx] || 0);
                      const pct =
                        totalPollVotes > 0 ? Math.round((count / totalPollVotes) * 100) : 0;
                      const isSelected = selectedPollOption === idx;

                      return (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => handleVotePoll(idx)}
                          className={`w-full text-left p-2.5 rounded-xl border transition relative overflow-hidden ${
                            isSelected
                              ? 'border-indigo-400 bg-indigo-950/80'
                              : 'border-slate-700 bg-slate-900/70 hover:border-slate-600'
                          }`}
                        >
                          <div
                            style={{ width: `${pct}%` }}
                            className="absolute inset-y-0 left-0 bg-indigo-600/25 pointer-events-none transition-all duration-500"
                          />
                          <div className="relative flex items-center justify-between text-xs font-bold">
                            <span className="text-white">{opt}</span>
                            <span className="text-indigo-300 font-black">{pct}%</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
                    <span>Total Votes: {totalPollVotes} students</span>
                    {selectedPollOption !== null && (
                      <span className="text-emerald-400 font-bold">
                        ✓ Vote Recorded! Correct: Option{' '}
                        {['A', 'B', 'C', 'D'][activePoll.correctIndex || 0]}
                      </span>
                    )}
                  </div>
                </div>

                {isAdmin && (
                  <button
                    type="button"
                    onClick={() => setShowCreatePollModal(true)}
                    className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black"
                  >
                    + Create & Launch New Live Poll
                  </button>
                )}
              </div>
            )}

            {/* TAB 3: SESSION INFO */}
            {activeBottomTab === 'info' && (
              <div className="flex-1 overflow-y-auto p-4 space-y-3 text-xs">
                <div className="p-3.5 rounded-2xl bg-slate-800/80 border border-slate-700 space-y-2">
                  <div className="text-[10px] font-black uppercase tracking-wider text-indigo-400">
                    Session Details
                  </div>
                  <h4 className="text-sm font-black text-white">{activeSession.title}</h4>
                  <p className="text-slate-300">{activeSession.topic}</p>
                  <div className="pt-2 border-t border-slate-700 flex items-center justify-between text-[11px] text-slate-400">
                    <span>Host: {mentor.name || 'Sumit'}</span>
                    <span>Handle: {mentor.handle || '@unfiltereddsumit'}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Host Create Poll Modal */}
      {showCreatePollModal && (
        <div className="fixed inset-0 z-[10000] bg-black/80 flex items-center justify-center p-4">
          <form
            onSubmit={handleLaunchNewPoll}
            className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-5 space-y-3"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black text-white">📊 Launch Live Classroom Poll</h3>
              <button
                type="button"
                onClick={() => setShowCreatePollModal(false)}
                className="text-slate-400 hover:text-white text-xs font-bold"
              >
                ✕
              </button>
            </div>
            <input
              type="text"
              required
              value={newPollQuestion}
              onChange={(e) => setNewPollQuestion(e.target.value)}
              placeholder="Enter MCQ question for live students..."
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                value={newPollOptA}
                onChange={(e) => setNewPollOptA(e.target.value)}
                placeholder="Option A"
                className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
              />
              <input
                type="text"
                value={newPollOptB}
                onChange={(e) => setNewPollOptB(e.target.value)}
                placeholder="Option B"
                className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
              />
              <input
                type="text"
                value={newPollOptC}
                onChange={(e) => setNewPollOptC(e.target.value)}
                placeholder="Option C"
                className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
              />
              <input
                type="text"
                value={newPollOptD}
                onChange={(e) => setNewPollOptD(e.target.value)}
                placeholder="Option D"
                className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <select
                value={newPollCorrect}
                onChange={(e) => setNewPollCorrect(Number(e.target.value))}
                className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
              >
                <option value={0}>Correct: Option A</option>
                <option value={1}>Correct: Option B</option>
                <option value={2}>Correct: Option C</option>
                <option value={3}>Correct: Option D</option>
              </select>
              <select
                value={newPollDuration}
                onChange={(e) => setNewPollDuration(Number(e.target.value))}
                className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
              >
                <option value={30}>Timer: 30 Seconds</option>
                <option value={60}>Timer: 60 Seconds</option>
              </select>
            </div>
            <button
              type="submit"
              className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black"
            >
              🚀 Broadcast Poll Now
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
