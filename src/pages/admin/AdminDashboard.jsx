import React, { useState, useEffect } from 'react';
import {
  Radio,
  Video,
  FileText,
  ClipboardCheck,
  MessageSquare,
  Bell,
  Users,
  Upload,
  Plus,
  Trash2,
  Pin,
  VolumeX,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Camera,
  Lock,
  Unlock,
  Hand,
  Send,
} from 'lucide-react';
import {
  scheduleOrStartLiveBroadcast,
  subscribeLiveSession,
  approveStudentRaiseHand,
  createVideoLecture,
  subscribeVideoLectures,
  deleteVideoLecture,
  uploadStudyMaterial,
  subscribeStudyMaterials,
  deleteStudyMaterial,
  saveMockTest,
  subscribeMockTests,
  deleteMockTest,
  subscribeCommunityMessages,
  postCommunityMessage,
  deleteCommunityMessage,
  pinCommunityMessage,
  muteCommunityUser,
  broadcastLiveNotification,
  subscribeLiveNotifications,
  deleteNotification,
  updateAdminSumitAvatar,
  subscribeAdminSumitAvatar,
  saveMentorProfile,
  subscribeMentors,
  deleteMentorProfile,
  DEFAULT_SUMIT_AVATAR,
} from '../../services/firebase';
import TeacherHost from '../../components/TeacherHost';

const ADMIN_TABS = [
  { id: 'AdminLive', label: '1. AdminLive', icon: Radio },
  { id: 'AdminVideos', label: '2. AdminVideos', icon: Video },
  { id: 'AdminStudyMaterials', label: '3. AdminStudyMaterials', icon: FileText },
  { id: 'AdminMockTests', label: '4. AdminMockTests', icon: ClipboardCheck },
  { id: 'AdminChat', label: '5. AdminChat & Community', icon: MessageSquare },
  { id: 'AdminNotifications', label: '6. AdminNotifications', icon: Bell },
  { id: 'AdminProfile', label: '7. AdminProfile & Mentors', icon: Users },
];

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState('AdminLive');
  const [statusBanner, setStatusBanner] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [busy, setBusy] = useState(false);

  // 1. AdminLive state
  const [liveSession, setLiveSession] = useState(null);
  const [liveTitle, setLiveTitle] = useState('Rotational Dynamics & PYQ Rank Booster');
  const [liveSubject, setLiveSubject] = useState('Physics & Strategy');
  const [liveRoomName, setLiveRoomName] = useState('PrepskmLiveMentorship_SumitRoom');
  const [liveStreamKey, setLiveStreamKey] = useState('');
  const [liveScheduledAt, setLiveScheduledAt] = useState('');
  const [liveChatLocked, setLiveChatLocked] = useState(false);
  const [showHostConsole, setShowHostConsole] = useState(false);

  // 2. AdminVideos state
  const [videos, setVideos] = useState([]);
  const [vidTitle, setVidTitle] = useState('');
  const [vidSubject, setVidSubject] = useState('Physics');
  const [vidChapter, setVidChapter] = useState('');
  const [vidDuration, setVidDuration] = useState('45:00');
  const [vidUrl, setVidUrl] = useState('');
  const [vidFile, setVidFile] = useState(null);
  const [thumbUrl, setThumbUrl] = useState('');
  const [thumbFile, setThumbFile] = useState(null);
  const [timestamps, setTimestamps] = useState([
    { time: '00:00', title: 'Introduction & Weightage' },
    { time: '04:15', title: 'Core Formula Derivation' },
  ]);

  // 3. AdminStudyMaterials state
  const [materials, setMaterials] = useState([]);
  const [pdfTitle, setPdfTitle] = useState('');
  const [pdfSubject, setPdfSubject] = useState('Physics');
  const [pdfChapter, setPdfChapter] = useState('');
  const [pdfFile, setPdfFile] = useState(null);
  const [pdfUrlInput, setPdfUrlInput] = useState('');

  // 4. AdminMockTests (Visual CBT Builder) state
  const [mockTests, setMockTests] = useState([]);
  const [testTitle, setTestTitle] = useState('');
  const [testExam, setTestExam] = useState('JEE Main');
  const [testSyllabus, setTestSyllabus] = useState('Physics, Chemistry & Mathematics');
  const [testDuration, setTestDuration] = useState(180);
  const [cbtQuestions, setCbtQuestions] = useState([
    {
      id: 'q_1',
      type: 'MCQ_SINGLE',
      subject: 'Physics',
      chapter: 'Rotational Motion',
      difficulty: 'Medium',
      text: 'A solid sphere rolls without slipping on an inclined plane of inclination θ. The ratio of its translational kinetic energy to total kinetic energy is:',
      options: ['5 : 7', '2 : 7', '2 : 5', '3 : 5'],
      correctAnswer: 'A',
      explanation: 'K_trans / K_total = 1 / (1 + k²/R²) = 1 / (1 + 2/5) = 5/7.',
    },
  ]);

  // 5. AdminChat & Community state
  const [chatMessages, setChatMessages] = useState([]);
  const [adminAnnouncementText, setAdminAnnouncementText] = useState('');

  // 6. AdminNotifications state
  const [notifications, setNotifications] = useState([]);
  const [notifTitle, setNotifTitle] = useState('');
  const [notifMessage, setNotifMessage] = useState('');
  const [notifRoute, setNotifRoute] = useState('/live');

  // 7. AdminProfile & Mentors state
  const [sumitAvatar, setSumitAvatar] = useState(DEFAULT_SUMIT_AVATAR);
  const [mentors, setMentors] = useState([]);
  const [mentorName, setMentorName] = useState('');
  const [mentorHandle, setMentorHandle] = useState('');
  const [mentorSpec, setMentorSpec] = useState('');
  const [mentorBio, setMentorBio] = useState('');
  const [mentorPhotoFile, setMentorPhotoFile] = useState(null);
  const [mentorPhotoUrl, setMentorPhotoUrl] = useState('');

  useEffect(() => {
    const u1 = subscribeLiveSession((cfg) => {
      setLiveSession(cfg);
      if (cfg?.title) setLiveTitle(cfg.title);
      if (cfg?.roomName) setLiveRoomName(cfg.roomName);
      setLiveChatLocked(Boolean(cfg?.chatLocked));
    });
    const u2 = subscribeVideoLectures(setVideos);
    const u3 = subscribeStudyMaterials(setMaterials);
    const u4 = subscribeMockTests(setMockTests);
    const u5 = subscribeCommunityMessages(setChatMessages);
    const u6 = subscribeLiveNotifications(setNotifications);
    const u7 = subscribeAdminSumitAvatar(setSumitAvatar);
    const u8 = subscribeMentors(setMentors);

    return () => {
      u1();
      u2();
      u3();
      u4();
      u5();
      u6();
      u7();
      u8();
    };
  }, []);

  const notify = (type, message) => {
    setStatusBanner({ type, message });
    setTimeout(() => setStatusBanner(null), 5000);
  };

  // --- 1. AdminLive Handlers ---
  const handleTriggerGoLive = async (goActive = true) => {
    setBusy(true);
    try {
      await scheduleOrStartLiveBroadcast({
        title: liveTitle,
        subject: liveSubject,
        roomName: liveRoomName,
        streamKeyOrUrl: liveStreamKey,
        scheduledAt: liveScheduledAt,
        isActive: goActive,
        chatLocked: liveChatLocked,
      });
      notify(
        'success',
        goActive
          ? `LIVE Broadcast Started! Push banner sent to all students: "Mentor Sumit is now LIVE: ${liveTitle}"`
          : 'Live broadcast scheduled and updated in Firestore.'
      );
      if (goActive) setShowHostConsole(true);
    } catch (err) {
      notify('error', err?.message || 'Failed to update live stream.');
    } finally {
      setBusy(false);
    }
  };

  // --- 2. AdminVideos Handlers ---
  const handleAddTimestamp = () => {
    setTimestamps((prev) => [...prev, { time: '10:00', title: '' }]);
  };

  const handleUpdateTimestamp = (idx, field, val) => {
    setTimestamps((prev) =>
      prev.map((row, i) => (i === idx ? { ...row, [field]: val } : row))
    );
  };

  const handleRemoveTimestamp = (idx) => {
    setTimestamps((prev) => prev.filter((_, i) => i !== idx));
  };

  const handlePublishVideo = async (e) => {
    e.preventDefault();
    setBusy(true);
    setUploadProgress(10);
    try {
      await createVideoLecture({
        title: vidTitle,
        subject: vidSubject,
        chapter: vidChapter,
        duration: vidDuration,
        videoUrl: vidUrl,
        videoFile: vidFile,
        thumbnailUrl: thumbUrl,
        thumbnailFile: thumbFile,
        timestamps,
        onProgress: setUploadProgress,
      });
      setVidTitle('');
      setVidChapter('');
      setVidUrl('');
      setVidFile(null);
      setThumbUrl('');
      setThumbFile(null);
      notify('success', 'Video Lecture & Chapter Timestamps synced to Firebase!');
    } catch (err) {
      notify('error', err?.message || 'Failed to upload video lecture.');
    } finally {
      setBusy(false);
      setUploadProgress(0);
    }
  };

  // --- 3. AdminStudyMaterials Handlers ---
  const handlePublishPdf = async (e) => {
    e.preventDefault();
    setBusy(true);
    setUploadProgress(10);
    try {
      await uploadStudyMaterial({
        title: pdfTitle,
        subject: pdfSubject,
        chapter: pdfChapter,
        pdfFile,
        pdfUrlInput,
        onProgress: setUploadProgress,
      });
      setPdfTitle('');
      setPdfChapter('');
      setPdfFile(null);
      setPdfUrlInput('');
      notify('success', 'PDF Study Material uploaded to Cloud Storage & synced!');
    } catch (err) {
      notify('error', err?.message || 'Failed to upload PDF study material.');
    } finally {
      setBusy(false);
      setUploadProgress(0);
    }
  };

  // --- 4. AdminMockTests (Visual CBT Builder) Handlers ---
  const handleAddCbtQuestion = () => {
    setCbtQuestions((prev) => [
      ...prev,
      {
        id: `q_${prev.length + 1}`,
        type: 'MCQ_SINGLE',
        subject: 'Physics',
        chapter: 'Electrostatics',
        difficulty: 'Medium',
        text: '',
        options: ['', '', '', ''],
        correctAnswer: 'A',
        explanation: '',
      },
    ]);
  };

  const handleUpdateQuestion = (idx, field, value) => {
    setCbtQuestions((prev) =>
      prev.map((q, i) => (i === idx ? { ...q, [field]: value } : q))
    );
  };

  const handleUpdateQuestionOption = (qIdx, optIdx, value) => {
    setCbtQuestions((prev) =>
      prev.map((q, i) => {
        if (i !== qIdx) return q;
        const nextOpts = [...(q.options || ['', '', '', ''])];
        nextOpts[optIdx] = value;
        return { ...q, options: nextOpts };
      })
    );
  };

  const handleRemoveCbtQuestion = (idx) => {
    setCbtQuestions((prev) => prev.filter((_, i) => i !== idx));
  };

  const handlePublishMockTest = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await saveMockTest({
        title: testTitle,
        exam: testExam,
        syllabus: testSyllabus,
        durationMinutes: Number(testDuration) || 180,
        questions: cbtQuestions,
      });
      setTestTitle('');
      notify('success', 'CBT Mock Test published to Firebase! Now live in Mock Tests portal.');
    } catch (err) {
      notify('error', err?.message || 'Failed to publish CBT Mock Test.');
    } finally {
      setBusy(false);
    }
  };

  // --- 5. AdminChat & Community Handlers ---
  const handlePostPinnedAnnouncement = async (e) => {
    e.preventDefault();
    if (!adminAnnouncementText.trim()) return;
    setBusy(true);
    try {
      await postCommunityMessage({
        authorName: 'Mentor Sumit (@unfiltereddsumit)',
        authorEmail: 'sumitk31207@gmail.com',
        text: adminAnnouncementText,
        isPinned: true,
        role: 'admin',
      });
      setAdminAnnouncementText('');
      notify('success', 'Pinned community announcement published.');
    } catch (err) {
      notify('error', err?.message || 'Failed to post announcement.');
    } finally {
      setBusy(false);
    }
  };

  // --- 6. AdminNotifications Handlers ---
  const handlePushBroadcastNotification = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await broadcastLiveNotification({
        title: notifTitle,
        message: notifMessage,
        type: 'ADMIN_BROADCAST',
        targetRoute: notifRoute,
      });
      setNotifTitle('');
      setNotifMessage('');
      notify('success', 'Live notification banner broadcast to all connected student devices!');
    } catch (err) {
      notify('error', err?.message || 'Failed to push notification.');
    } finally {
      setBusy(false);
    }
  };

  // --- 7. AdminProfile & Mentors Handlers ---
  const handleSumitAvatarUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setUploadProgress(15);
    try {
      const url = await updateAdminSumitAvatar(file, setUploadProgress);
      setSumitAvatar(url);
      notify('success', "Mentor Sumit's profile photo updated across the entire platform!");
    } catch (err) {
      notify('error', err?.message || 'Failed to update Mentor Sumit photo.');
    } finally {
      setBusy(false);
      setUploadProgress(0);
    }
  };

  const handleCreateMentor = async (e) => {
    e.preventDefault();
    setBusy(true);
    setUploadProgress(15);
    try {
      await saveMentorProfile({
        name: mentorName,
        handle: mentorHandle,
        subjectSpecialization: mentorSpec,
        bio: mentorBio,
        photoFile: mentorPhotoFile,
        photoUrl: mentorPhotoUrl,
        isLeadMentor: false,
        onProgress: setUploadProgress,
      });
      setMentorName('');
      setMentorHandle('');
      setMentorSpec('');
      setMentorBio('');
      setMentorPhotoFile(null);
      setMentorPhotoUrl('');
      notify('success', 'New mentor onboarded to 1:1 Mentorship directory!');
    } catch (err) {
      notify('error', err?.message || 'Failed to save mentor profile.');
    } finally {
      setBusy(false);
      setUploadProgress(0);
    }
  };

  return (
    <div className="bg-[#FFFFFF] border border-[#E2E8F0] rounded-2xl p-4 sm:p-6 space-y-5 shadow-xs">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#E2E8F0] pb-4">
        <div className="flex items-center gap-3">
          <img
            src={sumitAvatar || DEFAULT_SUMIT_AVATAR}
            alt="Mentor Sumit"
            className="w-12 h-12 rounded-full object-cover border-2 border-indigo-600 shadow-xs"
          />
          <div>
            <span className="px-2 py-0.5 rounded bg-indigo-50 border border-indigo-200 text-indigo-700 text-[10px] font-extrabold uppercase tracking-wider">
              7-Module Cloud Admin Suite • Firebase Real-Time Sync
            </span>
            <h3 className="text-base sm:text-lg font-extrabold text-[#1E293B] mt-0.5">
              Mentor Sumit (@unfiltereddsumit) Command Center
            </h3>
          </div>
        </div>
      </div>

      {/* Status Alert Banner */}
      {statusBanner && (
        <div
          className={`p-3 rounded-xl border flex items-center gap-2 text-xs font-bold ${
            statusBanner.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-red-50 border-red-200 text-red-700'
          }`}
        >
          {statusBanner.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
          )}
          <span>{statusBanner.message}</span>
        </div>
      )}

      {busy && uploadProgress > 0 && (
        <div className="space-y-1">
          <div className="flex justify-between text-[11px] text-indigo-700 font-bold">
            <span>Uploading to Firebase Cloud Storage...</span>
            <span>{uploadProgress}%</span>
          </div>
          <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
            <div
              style={{ width: `${uploadProgress}%` }}
              className="h-full bg-indigo-600 transition-all"
            />
          </div>
        </div>
      )}

      {/* 7-Tab Navigation Bar */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {ADMIN_TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`px-3.5 py-2 rounded-xl text-xs font-extrabold flex items-center gap-1.5 whitespace-nowrap transition-all ${
                isActive
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-[#F8FAFC] text-[#1E293B] hover:bg-indigo-50 border border-[#E2E8F0]'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* ==================================================================== */}
      {/* TAB 1: AdminLive (Broadcast, RTMP/WebRTC Keys, Chat Lock, Stage Approvals) */}
      {/* ==================================================================== */}
      {activeTab === 'AdminLive' && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-4 space-y-3">
              <h4 className="text-xs font-extrabold text-[#1E293B] uppercase tracking-wider flex items-center gap-2">
                <Radio className="w-4 h-4 text-red-600" /> Schedule or Broadcast Live Class
              </h4>

              <div className="space-y-2.5">
                <input
                  type="text"
                  value={liveTitle}
                  onChange={(e) => setLiveTitle(e.target.value)}
                  placeholder="Live Session Title (e.g. Rotational Motion Marathon)"
                  className="w-full px-3 py-2 rounded-lg bg-[#FFFFFF] border border-[#E2E8F0] text-xs text-[#1E293B]"
                />
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={liveSubject}
                    onChange={(e) => setLiveSubject(e.target.value)}
                    placeholder="Subject (e.g. Physics)"
                    className="w-full px-3 py-2 rounded-lg bg-[#FFFFFF] border border-[#E2E8F0] text-xs text-[#1E293B]"
                  />
                  <input
                    type="text"
                    value={liveRoomName}
                    onChange={(e) => setLiveRoomName(e.target.value)}
                    placeholder="WebRTC / Jitsi Room ID"
                    className="w-full px-3 py-2 rounded-lg bg-[#FFFFFF] border border-[#E2E8F0] text-xs text-[#1E293B]"
                  />
                </div>
                <input
                  type="text"
                  value={liveStreamKey}
                  onChange={(e) => setLiveStreamKey(e.target.value)}
                  placeholder="Optional RTMP / WebRTC Stream Key or Custom HLS URL"
                  className="w-full px-3 py-2 rounded-lg bg-[#FFFFFF] border border-[#E2E8F0] text-xs text-[#1E293B]"
                />
                <div className="flex items-center justify-between pt-1">
                  <button
                    type="button"
                    onClick={() => setLiveChatLocked((prev) => !prev)}
                    className={`px-3 py-1.5 rounded-lg border text-xs font-bold inline-flex items-center gap-1.5 ${
                      liveChatLocked
                        ? 'bg-amber-100 border-amber-300 text-amber-900'
                        : 'bg-[#FFFFFF] border-[#E2E8F0] text-slate-700'
                    }`}
                  >
                    {liveChatLocked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
                    <span>{liveChatLocked ? 'Student Chat Locked' : 'Student Chat Unlocked'}</span>
                  </button>
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => handleTriggerGoLive(true)}
                    className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-extrabold inline-flex items-center gap-1.5 shadow-xs"
                  >
                    <Radio className="w-3.5 h-3.5" /> Go LIVE Now & Push Alert Banner
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => handleTriggerGoLive(false)}
                    className="px-3.5 py-2 rounded-xl bg-[#FFFFFF] border border-[#E2E8F0] hover:border-indigo-300 text-[#1E293B] text-xs font-bold"
                  >
                    End / Schedule Stream
                  </button>
                </div>
              </div>
            </div>

            {/* Student Raise Hand Stage Requests Queue */}
            <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-4 space-y-3">
              <h4 className="text-xs font-extrabold text-[#1E293B] uppercase tracking-wider flex items-center gap-2">
                <Hand className="w-4 h-4 text-indigo-600" /> Student Stage Requests ("Raise Hand")
              </h4>
              <p className="text-[11px] text-slate-500">
                Students are locked in read-only viewer mode by default. Approve a student below to unlock their microphone/camera for live doubt interaction.
              </p>

              {Array.isArray(liveSession?.handRaises) && liveSession.handRaises.length > 0 ? (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {liveSession.handRaises.map((req, idx) => (
                    <div
                      key={idx}
                      className="p-2.5 rounded-lg bg-[#FFFFFF] border border-[#E2E8F0] flex items-center justify-between gap-2"
                    >
                      <div>
                        <p className="text-xs font-extrabold text-[#1E293B]">{req.name}</p>
                        <span className="text-[10px] text-slate-500">{req.email}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => approveStudentRaiseHand(req.email, true, liveSession)}
                          className="px-2.5 py-1 rounded bg-emerald-600 text-white text-[10px] font-extrabold"
                        >
                          Approve Mic
                        </button>
                        <button
                          type="button"
                          onClick={() => approveStudentRaiseHand(req.email, false, liveSession)}
                          className="px-2 py-1 rounded bg-slate-200 text-slate-700 text-[10px] font-bold"
                        >
                          Revoke
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-4 rounded-lg bg-[#FFFFFF] border border-[#E2E8F0] text-center text-xs text-slate-500">
                  No active student hand-raise requests right now.
                </div>
              )}
            </div>
          </div>

          {showHostConsole && (
            <div className="pt-2">
              <TeacherHost
                roomName={liveRoomName}
                sessionTitle={liveTitle}
                mentorName="Sumit Sir (@unfiltereddsumit)"
                onClose={() => setShowHostConsole(false)}
              />
            </div>
          )}
        </div>
      )}

      {/* ==================================================================== */}
      {/* TAB 2: AdminVideos (Upload Lectures, Custom Thumbnails & Timestamps) */}
      {/* ==================================================================== */}
      {activeTab === 'AdminVideos' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <form
            onSubmit={handlePublishVideo}
            className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-4 space-y-3"
          >
            <h4 className="text-xs font-extrabold text-[#1E293B] uppercase tracking-wider flex items-center gap-2">
              <Video className="w-4 h-4 text-indigo-600" /> Publish Cloud Video Lecture
            </h4>

            <input
              type="text"
              required
              value={vidTitle}
              onChange={(e) => setVidTitle(e.target.value)}
              placeholder="Lecture Title (e.g. Rotational Dynamics One-Shot)"
              className="w-full px-3 py-2 rounded-lg bg-[#FFFFFF] border border-[#E2E8F0] text-xs text-[#1E293B]"
            />

            <div className="grid grid-cols-3 gap-2">
              <select
                value={vidSubject}
                onChange={(e) => setVidSubject(e.target.value)}
                className="px-3 py-2 rounded-lg bg-[#FFFFFF] border border-[#E2E8F0] text-xs text-[#1E293B]"
              >
                <option value="Physics">Physics</option>
                <option value="Chemistry">Chemistry</option>
                <option value="Mathematics">Mathematics</option>
                <option value="Biology">Biology</option>
              </select>
              <input
                type="text"
                value={vidChapter}
                onChange={(e) => setVidChapter(e.target.value)}
                placeholder="Chapter Name"
                className="px-3 py-2 rounded-lg bg-[#FFFFFF] border border-[#E2E8F0] text-xs text-[#1E293B]"
              />
              <input
                type="text"
                value={vidDuration}
                onChange={(e) => setVidDuration(e.target.value)}
                placeholder="Duration (45:00)"
                className="px-3 py-2 rounded-lg bg-[#FFFFFF] border border-[#E2E8F0] text-xs text-[#1E293B]"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div className="p-2.5 rounded-lg bg-[#FFFFFF] border border-[#E2E8F0]">
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                  Video URL or Upload MP4
                </label>
                <input
                  type="text"
                  value={vidUrl}
                  onChange={(e) => setVidUrl(e.target.value)}
                  placeholder="https://... or YouTube URL"
                  className="w-full px-2 py-1.5 rounded bg-[#F8FAFC] border border-[#E2E8F0] text-xs text-[#1E293B] mb-1.5"
                />
                <input
                  type="file"
                  accept="video/*"
                  onChange={(e) => setVidFile(e.target.files?.[0] || null)}
                  className="text-[10px] text-slate-600 w-full"
                />
              </div>

              <div className="p-2.5 rounded-lg bg-[#FFFFFF] border border-[#E2E8F0]">
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                  Custom Thumbnail Image
                </label>
                <input
                  type="text"
                  value={thumbUrl}
                  onChange={(e) => setThumbUrl(e.target.value)}
                  placeholder="https://... thumbnail URL"
                  className="w-full px-2 py-1.5 rounded bg-[#F8FAFC] border border-[#E2E8F0] text-xs text-[#1E293B] mb-1.5"
                />
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setThumbFile(e.target.files?.[0] || null)}
                  className="text-[10px] text-slate-600 w-full"
                />
              </div>
            </div>

            {/* Dynamic Chapter Timestamps */}
            <div className="p-3 rounded-lg bg-[#FFFFFF] border border-[#E2E8F0] space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-extrabold text-[#1E293B]">
                  Interactive Chapter Timestamps
                </span>
                <button
                  type="button"
                  onClick={handleAddTimestamp}
                  className="px-2 py-1 rounded bg-indigo-50 text-indigo-700 border border-indigo-200 text-[10px] font-extrabold inline-flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" /> Add Marker
                </button>
              </div>
              {timestamps.map((ts, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={ts.time}
                    onChange={(e) => handleUpdateTimestamp(idx, 'time', e.target.value)}
                    placeholder="04:15"
                    className="w-20 px-2 py-1 rounded bg-[#F8FAFC] border border-[#E2E8F0] text-xs font-mono text-[#1E293B]"
                  />
                  <input
                    type="text"
                    value={ts.title}
                    onChange={(e) => handleUpdateTimestamp(idx, 'title', e.target.value)}
                    placeholder="Topic / Formula Derivation"
                    className="flex-1 px-2 py-1 rounded bg-[#F8FAFC] border border-[#E2E8F0] text-xs text-[#1E293B]"
                  />
                  <button
                    type="button"
                    onClick={() => handleRemoveTimestamp(idx)}
                    className="p-1 text-slate-400 hover:text-red-600"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>

            <button
              type="submit"
              disabled={busy}
              className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-extrabold flex items-center justify-center gap-2"
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              <span>Publish Video Lecture to Cloud</span>
            </button>
          </form>

          {/* Existing Video Lectures */}
          <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-4 space-y-2.5 max-h-[520px] overflow-y-auto">
            <h4 className="text-xs font-extrabold text-[#1E293B] uppercase tracking-wider">
              Synced Cloud Video Lectures ({videos.length})
            </h4>
            {videos.map((v) => (
              <div
                key={v.id}
                className="p-2.5 rounded-lg bg-[#FFFFFF] border border-[#E2E8F0] flex items-center justify-between gap-2"
              >
                <div className="min-w-0">
                  <span className="text-[10px] font-extrabold text-indigo-600 uppercase">
                    {v.subject} • {v.chapter}
                  </span>
                  <p className="text-xs font-bold text-[#1E293B] truncate">{v.title}</p>
                </div>
                <button
                  type="button"
                  onClick={() => deleteVideoLecture(v.id)}
                  className="p-1.5 text-slate-400 hover:text-red-600 rounded"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* TAB 3: AdminStudyMaterials (Drag-and-Drop PDF Upload to Cloud Storage) */}
      {/* ==================================================================== */}
      {activeTab === 'AdminStudyMaterials' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <form
            onSubmit={handlePublishPdf}
            className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-4 space-y-3"
          >
            <h4 className="text-xs font-extrabold text-[#1E293B] uppercase tracking-wider flex items-center gap-2">
              <FileText className="w-4 h-4 text-indigo-600" /> Upload Study Material PDF
            </h4>

            <input
              type="text"
              required
              value={pdfTitle}
              onChange={(e) => setPdfTitle(e.target.value)}
              placeholder="PDF Title (e.g. Complete Electrostatics Formula Sheet)"
              className="w-full px-3 py-2 rounded-lg bg-[#FFFFFF] border border-[#E2E8F0] text-xs text-[#1E293B]"
            />

            <div className="grid grid-cols-2 gap-2">
              <select
                value={pdfSubject}
                onChange={(e) => setPdfSubject(e.target.value)}
                className="px-3 py-2 rounded-lg bg-[#FFFFFF] border border-[#E2E8F0] text-xs text-[#1E293B]"
              >
                <option value="Physics">Physics</option>
                <option value="Chemistry">Chemistry</option>
                <option value="Mathematics">Mathematics</option>
                <option value="Biology">Biology</option>
              </select>
              <input
                type="text"
                value={pdfChapter}
                onChange={(e) => setPdfChapter(e.target.value)}
                placeholder="Chapter Name"
                className="px-3 py-2 rounded-lg bg-[#FFFFFF] border border-[#E2E8F0] text-xs text-[#1E293B]"
              />
            </div>

            <div className="p-4 rounded-xl bg-[#FFFFFF] border-2 border-dashed border-indigo-200 text-center space-y-2">
              <Upload className="w-6 h-6 text-indigo-600 mx-auto" />
              <p className="text-xs font-bold text-[#1E293B]">
                Drag & Drop PDF File or Select from Device
              </p>
              <input
                type="file"
                accept="application/pdf,.pdf"
                onChange={(e) => setPdfFile(e.target.files?.[0] || null)}
                className="text-xs text-slate-600 mx-auto block"
              />
            </div>

            <input
              type="text"
              value={pdfUrlInput}
              onChange={(e) => setPdfUrlInput(e.target.value)}
              placeholder="Or paste direct Cloud PDF URL (https://...)"
              className="w-full px-3 py-2 rounded-lg bg-[#FFFFFF] border border-[#E2E8F0] text-xs text-[#1E293B]"
            />

            <button
              type="submit"
              disabled={busy}
              className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-extrabold flex items-center justify-center gap-2"
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              <span>Upload PDF to Firebase Cloud Storage</span>
            </button>
          </form>

          {/* Synced Study Materials */}
          <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-4 space-y-2.5 max-h-[460px] overflow-y-auto">
            <h4 className="text-xs font-extrabold text-[#1E293B] uppercase tracking-wider">
              Synced Cloud PDFs ({materials.length})
            </h4>
            {materials.map((m) => (
              <div
                key={m.id}
                className="p-2.5 rounded-lg bg-[#FFFFFF] border border-[#E2E8F0] flex items-center justify-between gap-2"
              >
                <div className="min-w-0">
                  <span className="text-[10px] font-extrabold text-indigo-600 uppercase">
                    {m.subject} • {m.chapter}
                  </span>
                  <p className="text-xs font-bold text-[#1E293B] truncate">{m.title}</p>
                </div>
                <button
                  type="button"
                  onClick={() => deleteStudyMaterial(m.id)}
                  className="p-1.5 text-slate-400 hover:text-red-600 rounded"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* TAB 4: AdminMockTests (Visual CBT Test Builder) */}
      {/* ==================================================================== */}
      {activeTab === 'AdminMockTests' && (
        <div className="space-y-6">
          <form
            onSubmit={handlePublishMockTest}
            className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-4 space-y-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h4 className="text-xs font-extrabold text-[#1E293B] uppercase tracking-wider flex items-center gap-2">
                <ClipboardCheck className="w-4 h-4 text-indigo-600" /> Visual CBT Mock Test Builder
              </h4>
              <button
                type="button"
                onClick={handleAddCbtQuestion}
                className="px-3 py-1.5 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-extrabold inline-flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" /> Add Question
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
              <input
                type="text"
                required
                value={testTitle}
                onChange={(e) => setTestTitle(e.target.value)}
                placeholder="Mock Test Title (e.g. JEE Main Full Mock #1)"
                className="sm:col-span-2 px-3 py-2 rounded-lg bg-[#FFFFFF] border border-[#E2E8F0] text-xs text-[#1E293B]"
              />
              <select
                value={testExam}
                onChange={(e) => setTestExam(e.target.value)}
                className="px-3 py-2 rounded-lg bg-[#FFFFFF] border border-[#E2E8F0] text-xs text-[#1E293B]"
              >
                <option value="JEE Main">JEE Main</option>
                <option value="JEE Advanced">JEE Advanced</option>
                <option value="NEET UG">NEET UG</option>
              </select>
              <input
                type="number"
                value={testDuration}
                onChange={(e) => setTestDuration(e.target.value)}
                placeholder="Duration (mins)"
                className="px-3 py-2 rounded-lg bg-[#FFFFFF] border border-[#E2E8F0] text-xs text-[#1E293B]"
              />
            </div>

            <input
              type="text"
              value={testSyllabus}
              onChange={(e) => setTestSyllabus(e.target.value)}
              placeholder="Syllabus / Chapters Covered"
              className="w-full px-3 py-2 rounded-lg bg-[#FFFFFF] border border-[#E2E8F0] text-xs text-[#1E293B]"
            />

            {/* Questions List */}
            <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
              {cbtQuestions.map((q, qIdx) => (
                <div
                  key={q.id || qIdx}
                  className="p-3.5 rounded-xl bg-[#FFFFFF] border border-[#E2E8F0] space-y-2.5"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-extrabold text-indigo-700">
                      Question #{qIdx + 1}
                    </span>
                    <div className="flex items-center gap-2">
                      <select
                        value={q.type}
                        onChange={(e) => handleUpdateQuestion(qIdx, 'type', e.target.value)}
                        className="px-2 py-1 rounded bg-[#F8FAFC] border border-[#E2E8F0] text-[11px] font-bold text-[#1E293B]"
                      >
                        <option value="MCQ_SINGLE">MCQ (A/B/C/D)</option>
                        <option value="NAT">Numerical Value (NAT)</option>
                      </select>
                      <select
                        value={q.subject}
                        onChange={(e) => handleUpdateQuestion(qIdx, 'subject', e.target.value)}
                        className="px-2 py-1 rounded bg-[#F8FAFC] border border-[#E2E8F0] text-[11px] font-bold text-[#1E293B]"
                      >
                        <option value="Physics">Physics</option>
                        <option value="Chemistry">Chemistry</option>
                        <option value="Mathematics">Mathematics</option>
                        <option value="Biology">Biology</option>
                      </select>
                      <input
                        type="text"
                        value={q.chapter}
                        onChange={(e) => handleUpdateQuestion(qIdx, 'chapter', e.target.value)}
                        placeholder="Chapter"
                        className="px-2 py-1 rounded bg-[#F8FAFC] border border-[#E2E8F0] text-[11px] text-[#1E293B] w-32"
                      />
                      <button
                        type="button"
                        onClick={() => handleRemoveCbtQuestion(qIdx)}
                        className="p-1 text-slate-400 hover:text-red-600"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <textarea
                    rows={2}
                    required
                    value={q.text}
                    onChange={(e) => handleUpdateQuestion(qIdx, 'text', e.target.value)}
                    placeholder="Enter question statement..."
                    className="w-full px-3 py-2 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0] text-xs text-[#1E293B]"
                  />

                  {q.type === 'MCQ_SINGLE' && (
                    <div className="grid grid-cols-2 gap-2">
                      {['A', 'B', 'C', 'D'].map((letter, optIdx) => (
                        <input
                          key={letter}
                          type="text"
                          value={q.options?.[optIdx] || ''}
                          onChange={(e) =>
                            handleUpdateQuestionOption(qIdx, optIdx, e.target.value)
                          }
                          placeholder={`Option ${letter}`}
                          className="px-2.5 py-1.5 rounded bg-[#F8FAFC] border border-[#E2E8F0] text-xs text-[#1E293B]"
                        />
                      ))}
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <input
                      type="text"
                      value={q.correctAnswer}
                      onChange={(e) =>
                        handleUpdateQuestion(qIdx, 'correctAnswer', e.target.value)
                      }
                      placeholder={
                        q.type === 'NAT'
                          ? 'Correct Numerical Value (e.g. 25)'
                          : 'Correct Option (A, B, C, or D)'
                      }
                      className="px-2.5 py-1.5 rounded bg-emerald-50 border border-emerald-200 text-xs font-extrabold text-emerald-900"
                    />
                    <input
                      type="text"
                      value={q.explanation || ''}
                      onChange={(e) =>
                        handleUpdateQuestion(qIdx, 'explanation', e.target.value)
                      }
                      placeholder="Step-by-step solution explanation"
                      className="sm:col-span-2 px-2.5 py-1.5 rounded bg-[#F8FAFC] border border-[#E2E8F0] text-xs text-[#1E293B]"
                    />
                  </div>
                </div>
              ))}
            </div>

            <button
              type="submit"
              disabled={busy}
              className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-extrabold"
            >
              Publish CBT Mock Test to Student Portal
            </button>
          </form>

          {/* Existing Mock Tests */}
          <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-4 space-y-2">
            <h4 className="text-xs font-extrabold text-[#1E293B] uppercase tracking-wider">
              Published Cloud Mock Tests ({mockTests.length})
            </h4>
            {mockTests.map((t) => (
              <div
                key={t.id}
                className="p-2.5 rounded-lg bg-[#FFFFFF] border border-[#E2E8F0] flex items-center justify-between gap-2"
              >
                <div>
                  <p className="text-xs font-bold text-[#1E293B]">{t.title}</p>
                  <span className="text-[10px] text-slate-500">
                    {t.exam} • {t.durationMinutes} mins • {t.totalQuestions} Questions
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => deleteMockTest(t.id)}
                  className="p-1.5 text-slate-400 hover:text-red-600"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* TAB 5: AdminChat & Community (Delete Comments, Pin Announcements, Mute Users) */}
      {/* ==================================================================== */}
      {activeTab === 'AdminChat' && (
        <div className="space-y-4">
          <form
            onSubmit={handlePostPinnedAnnouncement}
            className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-4 flex flex-wrap items-center gap-2"
          >
            <input
              type="text"
              value={adminAnnouncementText}
              onChange={(e) => setAdminAnnouncementText(e.target.value)}
              placeholder="Post a pinned community announcement as Mentor Sumit..."
              className="flex-1 px-3 py-2 rounded-lg bg-[#FFFFFF] border border-[#E2E8F0] text-xs text-[#1E293B]"
            />
            <button
              type="submit"
              disabled={busy}
              className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-extrabold inline-flex items-center gap-1.5"
            >
              <Pin className="w-3.5 h-3.5" /> Pin Announcement
            </button>
          </form>

          <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-4 space-y-2.5 max-h-96 overflow-y-auto">
            <h4 className="text-xs font-extrabold text-[#1E293B] uppercase tracking-wider">
              Community Chat Moderation Queue ({chatMessages.length})
            </h4>
            {chatMessages.length === 0 ? (
              <p className="text-xs text-slate-500 py-4 text-center">
                No community messages to moderate right now.
              </p>
            ) : (
              chatMessages.map((msg) => (
                <div
                  key={msg.id}
                  className="p-3 rounded-lg bg-[#FFFFFF] border border-[#E2E8F0] flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-extrabold text-[#1E293B]">
                        {msg.authorName || 'Student'}
                      </span>
                      {msg.isPinned && (
                        <span className="px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 text-[9px] font-extrabold uppercase">
                          Pinned
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-600 mt-0.5">{msg.text}</p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => pinCommunityMessage(msg.id, !msg.isPinned)}
                      className="p-1.5 rounded bg-[#F8FAFC] border border-[#E2E8F0] text-indigo-600 hover:bg-indigo-50"
                      title="Pin / Unpin Message"
                    >
                      <Pin className="w-3.5 h-3.5" />
                    </button>
                    {msg.authorEmail && (
                      <button
                        type="button"
                        onClick={() => {
                          muteCommunityUser(msg.authorEmail, true);
                          notify('success', `Muted user ${msg.authorEmail}`);
                        }}
                        className="p-1.5 rounded bg-[#F8FAFC] border border-[#E2E8F0] text-amber-600 hover:bg-amber-50"
                        title="Mute User"
                      >
                        <VolumeX className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => deleteCommunityMessage(msg.id)}
                      className="p-1.5 rounded bg-[#F8FAFC] border border-[#E2E8F0] text-red-600 hover:bg-red-50"
                      title="Delete Comment"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* TAB 6: AdminNotifications (Push Real-Time Announcements & Alert Banners) */}
      {/* ==================================================================== */}
      {activeTab === 'AdminNotifications' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <form
            onSubmit={handlePushBroadcastNotification}
            className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-4 space-y-3"
          >
            <h4 className="text-xs font-extrabold text-[#1E293B] uppercase tracking-wider flex items-center gap-2">
              <Bell className="w-4 h-4 text-indigo-600" /> Broadcast Real-Time Student Alert
            </h4>
            <input
              type="text"
              required
              value={notifTitle}
              onChange={(e) => setNotifTitle(e.target.value)}
              placeholder="Headline (e.g. Mentor Sumit is now LIVE: Electrostatics Rapid Fire)"
              className="w-full px-3 py-2 rounded-lg bg-[#FFFFFF] border border-[#E2E8F0] text-xs text-[#1E293B]"
            />
            <textarea
              rows={3}
              value={notifMessage}
              onChange={(e) => setNotifMessage(e.target.value)}
              placeholder="Notification details for all students..."
              className="w-full px-3 py-2 rounded-lg bg-[#FFFFFF] border border-[#E2E8F0] text-xs text-[#1E293B]"
            />
            <select
              value={notifRoute}
              onChange={(e) => setNotifRoute(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-[#FFFFFF] border border-[#E2E8F0] text-xs text-[#1E293B]"
            >
              <option value="/live">Redirect on Tap: Live Classroom (/live)</option>
              <option value="/tests">Redirect on Tap: Mock Tests Portal (/tests)</option>
              <option value="/videos">Redirect on Tap: Video Lectures (/videos)</option>
              <option value="/notes">Redirect on Tap: Study Materials (/notes)</option>
            </select>
            <button
              type="submit"
              disabled={busy}
              className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-extrabold flex items-center justify-center gap-2"
            >
              <Send className="w-3.5 h-3.5" /> Push Instant Banner to All Student Devices
            </button>
          </form>

          <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-4 space-y-2 max-h-80 overflow-y-auto">
            <h4 className="text-xs font-extrabold text-[#1E293B] uppercase tracking-wider">
              Active Broadcast Notifications ({notifications.length})
            </h4>
            {notifications.map((n) => (
              <div
                key={n.id}
                className="p-2.5 rounded-lg bg-[#FFFFFF] border border-[#E2E8F0] flex items-center justify-between gap-2"
              >
                <div>
                  <p className="text-xs font-bold text-[#1E293B]">{n.title}</p>
                  <p className="text-[11px] text-slate-500">{n.message}</p>
                </div>
                <button
                  type="button"
                  onClick={() => deleteNotification(n.id)}
                  className="p-1 text-slate-400 hover:text-red-600"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* TAB 7: AdminProfile (Mentor Sumit Avatar & Multi-Mentor Onboarding) */}
      {/* ==================================================================== */}
      {activeTab === 'AdminProfile' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-4">
            {/* Lead Mentor Sumit Profile Picture Uploader */}
            <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-4 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <img
                  src={sumitAvatar || DEFAULT_SUMIT_AVATAR}
                  alt="Mentor Sumit"
                  className="w-14 h-14 rounded-full object-cover border-2 border-indigo-600"
                />
                <div>
                  <h4 className="text-sm font-extrabold text-[#1E293B]">
                    Sumit (@unfiltereddsumit)
                  </h4>
                  <p className="text-xs text-slate-500">
                    Lead Mentor • Syncs across Header, Home & Mentorship Cards
                  </p>
                </div>
              </div>
              <label className="cursor-pointer px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-extrabold inline-flex items-center gap-1.5 shrink-0">
                <Camera className="w-3.5 h-3.5" />
                <span>Update Photo</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleSumitAvatarUpload}
                  className="hidden"
                />
              </label>
            </div>

            {/* Add Additional 1:1 Mentor Form */}
            <form
              onSubmit={handleCreateMentor}
              className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-4 space-y-3"
            >
              <h4 className="text-xs font-extrabold text-[#1E293B] uppercase tracking-wider">
                Onboard Additional 1:1 Mentor
              </h4>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  required
                  value={mentorName}
                  onChange={(e) => setMentorName(e.target.value)}
                  placeholder="Mentor Name"
                  className="px-3 py-2 rounded-lg bg-[#FFFFFF] border border-[#E2E8F0] text-xs text-[#1E293B]"
                />
                <input
                  type="text"
                  value={mentorHandle}
                  onChange={(e) => setMentorHandle(e.target.value)}
                  placeholder="Handle (@mentor)"
                  className="px-3 py-2 rounded-lg bg-[#FFFFFF] border border-[#E2E8F0] text-xs text-[#1E293B]"
                />
              </div>
              <input
                type="text"
                required
                value={mentorSpec}
                onChange={(e) => setMentorSpec(e.target.value)}
                placeholder="Subject Specialization (e.g. IIT Bombay • Physics)"
                className="w-full px-3 py-2 rounded-lg bg-[#FFFFFF] border border-[#E2E8F0] text-xs text-[#1E293B]"
              />
              <textarea
                rows={2}
                value={mentorBio}
                onChange={(e) => setMentorBio(e.target.value)}
                placeholder="Short Mentor Bio & Credentials..."
                className="w-full px-3 py-2 rounded-lg bg-[#FFFFFF] border border-[#E2E8F0] text-xs text-[#1E293B]"
              />
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setMentorPhotoFile(e.target.files?.[0] || null)}
                className="text-xs text-slate-600"
              />
              <button
                type="submit"
                disabled={busy}
                className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-extrabold"
              >
                Save Mentor to Directory
              </button>
            </form>
          </div>

          {/* Active Mentors Directory */}
          <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-4 space-y-2.5">
            <h4 className="text-xs font-extrabold text-[#1E293B] uppercase tracking-wider">
              Active 1:1 Mentors ({mentors.length})
            </h4>
            {mentors.map((m) => (
              <div
                key={m.id}
                className="p-3 rounded-xl bg-[#FFFFFF] border border-[#E2E8F0] flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <img
                    src={m.photo_url || m.photoUrl || DEFAULT_SUMIT_AVATAR}
                    alt={m.name}
                    className="w-10 h-10 rounded-full object-cover border border-indigo-200"
                  />
                  <div className="min-w-0">
                    <p className="text-xs font-extrabold text-[#1E293B] truncate">
                      {m.name} ({m.handle})
                    </p>
                    <p className="text-[11px] text-indigo-600 font-semibold truncate">
                      {m.subject_specialization}
                    </p>
                  </div>
                </div>
                {!m.is_lead_mentor && m.id !== 'lead_mentor_sumit' && (
                  <button
                    type="button"
                    onClick={() => deleteMentorProfile(m.id)}
                    className="p-1.5 text-slate-400 hover:text-red-600"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
