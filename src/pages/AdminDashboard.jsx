import React, { useEffect, useState } from 'react';
import {
  updateAdminSumitAvatar,
  saveMentorProfile,
  subscribeMentors,
  deleteMentorProfile,
  createVideoLecture,
  uploadStudyMaterial,
} from '../services/firebase.js';
import {
  subscribeToMentorProfile,
  updateLiveSessionState,
  syncEventToWeeklySchedule,
  sendBroadcastNotification,
  DEFAULT_MENTOR_PROFILE,
} from '../services/db.js';

export default function AdminDashboard() {
  const [mentorProfile, setMentorProfile] = useState(DEFAULT_MENTOR_PROFILE);
  const [mentorsList, setMentorsList] = useState([]);
  const [statusBanner, setStatusBanner] = useState('');
  const [activeAdminSection, setActiveAdminSection] = useState('profile_mentors');

  // 1. Admin Sumit Profile Image Upload State
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  // 2. Add / Manage Mentors State
  const [newMentorName, setNewMentorName] = useState('');
  const [newMentorHandle, setNewMentorHandle] = useState('');
  const [newMentorSubject, setNewMentorSubject] = useState(
    'Physics & Exam Strategy'
  );
  const [newMentorBio, setNewMentorBio] = useState('');
  const [newMentorPhotoFile, setNewMentorPhotoFile] = useState(null);
  const [savingMentor, setSavingMentor] = useState(false);

  // 3. Video Lecture + Dynamic Chapter Markers State
  const [videoTitle, setVideoTitle] = useState('');
  const [videoSubject, setVideoSubject] = useState('Physics');
  const [videoChapter, setVideoChapter] = useState('Rotational Dynamics');
  const [videoUrl, setVideoUrl] = useState('');
  const [videoThumbUrl, setVideoThumbUrl] = useState('');
  const [chapterMarkers, setChapterMarkers] = useState([
    { time: '00:00', title: 'Introduction & Core Concept' },
    { time: '04:15', title: 'Formula Derivation & Proof' },
    { time: '12:30', title: 'JEE Advanced PYQ Walkthrough' },
  ]);
  const [markerTimeInput, setMarkerTimeInput] = useState('');
  const [markerTitleInput, setMarkerTitleInput] = useState('');
  const [savingVideo, setSavingVideo] = useState(false);

  // 4. Direct Cloud PDF Uploader State
  const [pdfTitle, setPdfTitle] = useState('');
  const [pdfSubject, setPdfSubject] = useState('Physics');
  const [pdfChapter, setPdfChapter] = useState('Complete Syllabus');
  const [pdfExam, setPdfExam] = useState('JEE');
  const [pdfFile, setPdfFile] = useState(null);
  const [pdfExternalUrl, setPdfExternalUrl] = useState('');
  const [pdfProgress, setPdfProgress] = useState('');
  const [savingPdf, setSavingPdf] = useState(false);

  // 5. Live Classroom Broadcast State
  const [liveTitle, setLiveTitle] = useState(
    'JEE/NEET Rank Booster & Live Doubt Solving'
  );
  const [liveTopic, setLiveTopic] = useState(
    'High-Weightage Physics & Organic Chemistry'
  );

  useEffect(() => {
    const unsubProfile = subscribeToMentorProfile((profile) => {
      setMentorProfile(profile);
    });
    const unsubMentors = subscribeMentors((docs) => {
      if (docs && docs.length > 0) {
        setMentorsList(docs);
      } else if (
        typeof window !== 'undefined' &&
        Array.isArray(window.state?.mentors)
      ) {
        setMentorsList(window.state.mentors);
      }
    });
    return () => {
      unsubProfile();
      unsubMentors();
    };
  }, []);

  const flashBanner = (msg) => {
    setStatusBanner(msg);
    setTimeout(() => setStatusBanner(''), 4000);
  };

  // Handler 1: Admin Sumit Profile Picture Upload
  const handleSumitAvatarUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingAvatar(true);
    try {
      const url = await updateAdminSumitAvatar(file);
      setMentorProfile((prev) => ({ ...prev, avatarUrl: url }));
      flashBanner(
        '✓ Admin Sumit (@unfiltereddsumit) profile image updated across Firebase!'
      );
    } catch (_err) {
      flashBanner('Could not upload profile photo. Please try again.');
    } finally {
      setUploadingAvatar(false);
    }
  };

  // Handler 2: Onboard New Mentor
  const handleCreateMentor = async (e) => {
    e.preventDefault();
    if (!newMentorName.trim()) return;
    setSavingMentor(true);
    try {
      await saveMentorProfile(
        {
          name: newMentorName.trim(),
          handle:
            newMentorHandle.trim() ||
            `@${newMentorName.trim().split(' ')[0].toLowerCase()}_prep`,
          subject_specialization: newMentorSubject.trim(),
          bio:
            newMentorBio.trim() ||
            `Verified Prepskm Educator specializing in ${newMentorSubject.trim()}.`,
          is_lead_mentor: false,
        },
        newMentorPhotoFile
      );
      setNewMentorName('');
      setNewMentorHandle('');
      setNewMentorBio('');
      setNewMentorPhotoFile(null);
      flashBanner(
        `✓ Mentor "${newMentorName.trim()}" onboarded and synced to Firebase!`
      );
    } catch (_err) {
      flashBanner('Failed to onboard mentor.');
    } finally {
      setSavingMentor(false);
    }
  };

  // Handler 3: Add Chapter Marker Row
  const handleAddMarkerRow = () => {
    if (!markerTimeInput.trim() || !markerTitleInput.trim()) return;
    setChapterMarkers((prev) => [
      ...prev,
      { time: markerTimeInput.trim(), title: markerTitleInput.trim() },
    ]);
    setMarkerTimeInput('');
    setMarkerTitleInput('');
  };

  const handleRemoveMarkerRow = (idx) => {
    setChapterMarkers((prev) => prev.filter((_, i) => i !== idx));
  };

  // Handler 4: Publish Video Lecture with Chapter Markers
  const handlePublishVideoLecture = async (e) => {
    e.preventDefault();
    if (!videoTitle.trim() || !videoUrl.trim()) return;
    setSavingVideo(true);
    try {
      await createVideoLecture({
        title: videoTitle.trim(),
        subject: videoSubject,
        chapter: videoChapter.trim() || 'Core Concepts',
        video_url: videoUrl.trim(),
        thumbnail_url: videoThumbUrl.trim(),
        timestamps: chapterMarkers,
        mentorName: 'Sumit (@unfiltereddsumit)',
      });
      setVideoTitle('');
      setVideoUrl('');
      setVideoThumbUrl('');
      flashBanner(
        `✓ Video Lecture "${videoTitle.trim()}" published with ${
          chapterMarkers.length
        } chapter markers!`
      );
    } catch (_err) {
      flashBanner('Failed to publish video lecture.');
    } finally {
      setSavingVideo(false);
    }
  };

  // Handler 5: Upload PDF Study Material to Firebase
  const handleUploadPdfMaterial = async (e) => {
    e.preventDefault();
    if (!pdfTitle.trim() || (!pdfFile && !pdfExternalUrl.trim())) return;
    setSavingPdf(true);
    setPdfProgress('Uploading to Firebase Cloud...');
    try {
      await uploadStudyMaterial(
        pdfFile || pdfExternalUrl.trim(),
        {
          title: pdfTitle.trim(),
          subject: pdfSubject,
          chapter: pdfChapter.trim() || 'Complete Syllabus',
          exam: pdfExam,
        },
        (done, total) => {
          setPdfProgress(
            `Syncing cloud chunk ${done}/${total} (${Math.round(
              (done / total) * 100
            )}%)...`
          );
        }
      );
      setPdfTitle('');
      setPdfFile(null);
      setPdfExternalUrl('');
      setPdfProgress('');
      flashBanner(
        `✓ PDF "${pdfTitle.trim()}" uploaded to Firebase study_materials!`
      );
    } catch (_err) {
      flashBanner('Error uploading PDF study material.');
    } finally {
      setSavingPdf(false);
    }
  };

  // Handler 6: Start Live Classroom Session
  const handleGoLiveNow = async () => {
    await updateLiveSessionState({
      title: liveTitle,
      topic: liveTopic,
      status: 'live',
      roomName: 'PrepskmLiveMentorshipSumit',
      hostName: mentorProfile.name || 'Sumit',
      hostHandle: '@unfiltereddsumit',
      hostAvatar: mentorProfile.avatarUrl,
    });
    await syncEventToWeeklySchedule({
      id: `live-${Date.now()}`,
      title: liveTitle,
      subject: 'Physics',
      eventType: 'live',
    });
    await sendBroadcastNotification({
      title: `🔴 LIVE NOW: ${liveTitle}`,
      body: `Lead Mentor Sumit (@unfiltereddsumit) is live now! Join the classroom.`,
      category: 'live',
      targetView: 'live',
    });
    if (typeof window.openReactLiveClassroom === 'function') {
      window.openReactLiveClassroom();
    }
  };

  return (
    <div
      className="bg-[#151D2F] border border-[#1E293B] rounded-2xl p-4 sm:p-6 text-slate-100 shadow-2xl space-y-5"
      data-testid="admin-firebase-dashboard"
    >
      {/* Top Identity & Navigation Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-[#1E293B] pb-4">
        <div className="flex items-center gap-3.5">
          <div className="relative">
            <img
              src={
                mentorProfile.avatarUrl ||
                '/assets/aistudio/IMG_1422_c0b1f775.png'
              }
              alt="Admin Sumit"
              className="mentor-dynamic-avatar w-14 h-14 rounded-2xl object-cover border-2 border-[#4F46E5] shadow-lg"
            />
            <span className="absolute -bottom-1 -right-1 px-1.5 py-0.2 rounded bg-[#10B981] text-slate-950 font-black text-[9px] uppercase">
              Lead
            </span>
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base sm:text-lg font-black text-white">
                Mentor Sumit (@unfiltereddsumit) • Cloud Admin Studio
              </h2>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-[#4F46E5]/20 text-indigo-300 border border-[#4F46E5]/40">
                Firebase Real-Time Sync
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Update profile photo, onboard mentors, publish timestamped lectures, upload PDFs, and launch live broadcasts.
            </p>
          </div>
        </div>

        {/* Section Switcher Pills */}
        <div className="flex flex-wrap items-center gap-1.5 bg-[#0B0F19] p-1 rounded-xl border border-[#1E293B]">
          {[
            { id: 'profile_mentors', label: '👤 Sumit Profile & Mentors' },
            { id: 'video_markers', label: '🎬 Video + Chapter Markers' },
            { id: 'pdf_vault', label: '📄 Upload Cloud PDF' },
            { id: 'live_studio', label: '🔴 Live Broadcast Studio' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveAdminSection(tab.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition cursor-pointer ${
                activeAdminSection === tab.id
                  ? 'bg-[#4F46E5] text-white shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {statusBanner && (
        <div className="p-3 rounded-xl bg-[#10B981]/15 border border-[#10B981]/40 text-xs font-bold text-[#10B981] flex items-center justify-between">
          <span>{statusBanner}</span>
          <button
            type="button"
            onClick={() => setStatusBanner('')}
            className="text-slate-400 hover:text-white"
          >
            ✕
          </button>
        </div>
      )}

      {/* TAB 1: ADMIN SUMIT PROFILE UPLOAD & MULTI-MENTOR MANAGEMENT */}
      {activeAdminSection === 'profile_mentors' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Left 5 cols: Admin Sumit Profile Picture Upload + Add Mentor Form */}
          <div className="lg:col-span-5 space-y-4">
            {/* Admin Sumit Profile Image Upload Card */}
            <div className="bg-[#0B0F19] border border-[#1E293B] rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-black uppercase tracking-wider text-indigo-300">
                    Admin Identity (@unfiltereddsumit)
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Update Lead Mentor Sumit&apos;s photo across all screens
                  </p>
                </div>
                <label className="px-3 py-1.5 rounded-xl bg-[#4F46E5] hover:bg-[#3B82F6] text-white text-xs font-black cursor-pointer transition shadow">
                  {uploadingAvatar ? 'Uploading...' : '📷 Upload New Photo'}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleSumitAvatarUpload}
                    className="hidden"
                  />
                </label>
              </div>
            </div>

            {/* Onboard New Mentor Form */}
            <form
              onSubmit={handleCreateMentor}
              className="bg-[#0B0F19] border border-[#1E293B] rounded-xl p-4 space-y-3"
            >
              <h3 className="text-sm font-extrabold text-white">
                + Onboard New Verified Mentor (`mentors`)
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">
                    Mentor Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={newMentorName}
                    onChange={(e) => setNewMentorName(e.target.value)}
                    placeholder="e.g. Dr. Ritu Verma"
                    className="w-full px-3 py-2 rounded-lg bg-[#151D2F] border border-[#1E293B] text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">
                    Handle (@) *
                  </label>
                  <input
                    type="text"
                    value={newMentorHandle}
                    onChange={(e) => setNewMentorHandle(e.target.value)}
                    placeholder="e.g. @ritu_neet"
                    className="w-full px-3 py-2 rounded-lg bg-[#151D2F] border border-[#1E293B] text-white"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-slate-400 font-semibold mb-1">
                    Subject Specialization *
                  </label>
                  <input
                    type="text"
                    value={newMentorSubject}
                    onChange={(e) => setNewMentorSubject(e.target.value)}
                    placeholder="e.g. Organic Chemistry & NCERT Biology"
                    className="w-full px-3 py-2 rounded-lg bg-[#151D2F] border border-[#1E293B] text-white"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-slate-400 font-semibold mb-1">
                    Mentor Bio &amp; Rank Credentials
                  </label>
                  <textarea
                    rows={2}
                    value={newMentorBio}
                    onChange={(e) => setNewMentorBio(e.target.value)}
                    placeholder="Brief bio, AIR rank, and mentoring track record..."
                    className="w-full px-3 py-2 rounded-lg bg-[#151D2F] border border-[#1E293B] text-white"
                  />
                </div>
                <div className="sm:col-span-2 flex items-center justify-between gap-2 pt-1">
                  <label className="px-3 py-1.5 rounded-lg bg-[#151D2F] hover:bg-slate-800 border border-[#1E293B] text-xs font-bold text-slate-200 cursor-pointer">
                    {newMentorPhotoFile
                      ? `Selected: ${newMentorPhotoFile.name.slice(0, 18)}`
                      : '🖼️ Choose Profile Picture'}
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) =>
                        setNewMentorPhotoFile(e.target.files?.[0] || null)
                      }
                      className="hidden"
                    />
                  </label>
                  <button
                    type="submit"
                    disabled={savingMentor}
                    className="px-4 py-2 rounded-xl bg-[#10B981] hover:bg-emerald-500 text-slate-950 text-xs font-black cursor-pointer"
                  >
                    {savingMentor ? 'Saving...' : 'Onboard Mentor'}
                  </button>
                </div>
              </div>
            </form>
          </div>

          {/* Right 7 cols: Active Mentors Directory */}
          <div className="lg:col-span-7 bg-[#0B0F19] border border-[#1E293B] rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-extrabold text-white">
                Active Mentors Roster ({mentorsList.length})
              </h3>
              <span className="text-[11px] font-mono text-slate-400">
                Firestore `mentors` collection
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {mentorsList.map((m) => (
                <div
                  key={m.id}
                  className="p-3 rounded-xl bg-[#151D2F] border border-[#1E293B] flex items-start justify-between gap-2.5"
                >
                  <div className="flex items-start gap-2.5 min-w-0">
                    <img
                      src={
                        m.photo_url ||
                        m.avatar ||
                        '/assets/aistudio/IMG_1422_c0b1f775.png'
                      }
                      alt={m.name || m.fullName}
                      className="w-10 h-10 rounded-xl object-cover border border-[#4F46E5] shrink-0"
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-extrabold text-white truncate">
                          {m.name || m.fullName}
                        </span>
                        {m.is_lead_mentor && (
                          <span className="px-1.5 py-0.2 rounded bg-[#4F46E5] text-white text-[9px] font-black uppercase">
                            Lead
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] font-mono text-indigo-300">
                        {m.handle || m.telegram}
                      </div>
                      <div className="text-[10px] text-slate-400 truncate mt-0.5">
                        {m.subject_specialization}
                      </div>
                    </div>
                  </div>
                  {!m.is_lead_mentor && m.id !== 'mentor-sumit' && (
                    <button
                      type="button"
                      onClick={() => deleteMentorProfile(m.id)}
                      className="text-slate-500 hover:text-[#EF4444] text-xs font-bold px-1.5 py-0.5 cursor-pointer"
                      title="Remove Mentor"
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: VIDEO LECTURE UPLOADER WITH MULTIPLE CHAPTER MARKERS */}
      {activeAdminSection === 'video_markers' && (
        <form
          onSubmit={handlePublishVideoLecture}
          className="bg-[#0B0F19] border border-[#1E293B] rounded-xl p-4 sm:p-5 space-y-4"
        >
          <div className="flex items-center justify-between border-b border-[#1E293B] pb-3">
            <div>
              <h3 className="text-sm font-extrabold text-white">
                Publish Video Lecture with Chapter Timestamps (`video_lectures`)
              </h3>
              <p className="text-xs text-slate-400">
                Add interactive timestamps (e.g., 04:15 - Formula Derivation) so students can jump directly to key derivations.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div className="sm:col-span-2">
              <label className="block text-slate-400 font-semibold mb-1">
                Lecture Title *
              </label>
              <input
                type="text"
                required
                value={videoTitle}
                onChange={(e) => setVideoTitle(e.target.value)}
                placeholder="e.g. Rotational Mechanics One-Shot: Moment of Inertia & Rolling"
                className="w-full px-3 py-2 rounded-lg bg-[#151D2F] border border-[#1E293B] text-white"
              />
            </div>
            <div>
              <label className="block text-slate-400 font-semibold mb-1">
                Subject *
              </label>
              <select
                value={videoSubject}
                onChange={(e) => setVideoSubject(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-[#151D2F] border border-[#1E293B] text-white"
              >
                <option value="Physics">Physics</option>
                <option value="Chemistry">Chemistry</option>
                <option value="Mathematics">Mathematics</option>
                <option value="Biology">Biology</option>
              </select>
            </div>
            <div>
              <label className="block text-slate-400 font-semibold mb-1">
                Chapter Name *
              </label>
              <input
                type="text"
                value={videoChapter}
                onChange={(e) => setVideoChapter(e.target.value)}
                placeholder="e.g. Rotational Dynamics"
                className="w-full px-3 py-2 rounded-lg bg-[#151D2F] border border-[#1E293B] text-white"
              />
            </div>
            <div>
              <label className="block text-slate-400 font-semibold mb-1">
                Video Stream / YouTube URL *
              </label>
              <input
                type="url"
                required
                value={videoUrl}
                onChange={(e) => setVideoUrl(e.target.value)}
                placeholder="https://www.youtube.com/watch?v=..."
                className="w-full px-3 py-2 rounded-lg bg-[#151D2F] border border-[#1E293B] text-white"
              />
            </div>
            <div>
              <label className="block text-slate-400 font-semibold mb-1">
                Thumbnail URL (Optional)
              </label>
              <input
                type="url"
                value={videoThumbUrl}
                onChange={(e) => setVideoThumbUrl(e.target.value)}
                placeholder="Auto-extracted if left blank"
                className="w-full px-3 py-2 rounded-lg bg-[#151D2F] border border-[#1E293B] text-white"
              />
            </div>
          </div>

          {/* Interactive Chapter Markers Builder */}
          <div className="p-3.5 rounded-xl bg-[#151D2F] border border-[#1E293B] space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold text-indigo-300">
                ⏱ Video Chapter Markers ({chapterMarkers.length})
              </span>
              <span className="text-[10px] font-mono text-slate-400">
                Format: MM:SS + Topic Title
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs">
              <input
                type="text"
                value={markerTimeInput}
                onChange={(e) => setMarkerTimeInput(e.target.value)}
                placeholder="04:15"
                className="w-24 px-2.5 py-1.5 rounded-lg bg-[#0B0F19] border border-[#1E293B] font-mono text-white"
              />
              <input
                type="text"
                value={markerTitleInput}
                onChange={(e) => setMarkerTitleInput(e.target.value)}
                placeholder="Marker Title (e.g. Parallel Axis Theorem Proof)"
                className="flex-1 min-w-[180px] px-3 py-1.5 rounded-lg bg-[#0B0F19] border border-[#1E293B] text-white"
              />
              <button
                type="button"
                onClick={handleAddMarkerRow}
                className="px-3 py-1.5 rounded-lg bg-[#4F46E5] hover:bg-[#3B82F6] text-white font-black cursor-pointer"
              >
                + Add Marker
              </button>
            </div>

            <div className="flex flex-wrap gap-2">
              {chapterMarkers.map((m, idx) => (
                <span
                  key={idx}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#0B0F19] border border-[#1E293B] text-xs"
                >
                  <strong className="font-mono text-[#3B82F6]">{m.time}</strong>
                  <span className="text-slate-200">{m.title}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveMarkerRow(idx)}
                    className="text-slate-500 hover:text-[#EF4444] ml-1 cursor-pointer"
                  >
                    ✕
                  </button>
                </span>
              ))}
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={savingVideo}
              className="px-5 py-2.5 rounded-xl bg-[#4F46E5] hover:bg-[#3B82F6] text-white text-xs font-black shadow-lg cursor-pointer"
            >
              {savingVideo
                ? 'Publishing to Firebase...'
                : '🚀 Publish Lecture with Timestamps'}
            </button>
          </div>
        </form>
      )}

      {/* TAB 3: DIRECT CLOUD PDF UPLOADER */}
      {activeAdminSection === 'pdf_vault' && (
        <form
          onSubmit={handleUploadPdfMaterial}
          className="bg-[#0B0F19] border border-[#1E293B] rounded-xl p-4 sm:p-5 space-y-4"
        >
          <div>
            <h3 className="text-sm font-extrabold text-white">
              Upload Study Material PDF to Firebase (`study_materials`)
            </h3>
            <p className="text-xs text-slate-400">
              Uploads PDF to Firebase Storage / Cloud Chunks and syncs immediately across all student devices.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
            <div className="sm:col-span-2">
              <label className="block text-slate-400 font-semibold mb-1">
                PDF Document Title *
              </label>
              <input
                type="text"
                required
                value={pdfTitle}
                onChange={(e) => setPdfTitle(e.target.value)}
                placeholder="e.g. Modern Physics & Semiconductors Formula Sheet"
                className="w-full px-3 py-2 rounded-lg bg-[#151D2F] border border-[#1E293B] text-white"
              />
            </div>
            <div>
              <label className="block text-slate-400 font-semibold mb-1">
                Subject *
              </label>
              <select
                value={pdfSubject}
                onChange={(e) => setPdfSubject(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-[#151D2F] border border-[#1E293B] text-white"
              >
                <option value="Physics">Physics</option>
                <option value="Chemistry">Chemistry</option>
                <option value="Mathematics">Mathematics</option>
                <option value="Biology">Biology</option>
              </select>
            </div>
            <div>
              <label className="block text-slate-400 font-semibold mb-1">
                Target Exam
              </label>
              <select
                value={pdfExam}
                onChange={(e) => setPdfExam(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-[#151D2F] border border-[#1E293B] text-white"
              >
                <option value="JEE">JEE Main &amp; Adv</option>
                <option value="NEET">NEET UG</option>
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-slate-400 font-semibold mb-1">
                Chapter Name
              </label>
              <input
                type="text"
                value={pdfChapter}
                onChange={(e) => setPdfChapter(e.target.value)}
                placeholder="e.g. Electrostatics & Capacitance"
                className="w-full px-3 py-2 rounded-lg bg-[#151D2F] border border-[#1E293B] text-white"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-slate-400 font-semibold mb-1">
                Direct PDF URL (or select file below)
              </label>
              <input
                type="url"
                value={pdfExternalUrl}
                onChange={(e) => setPdfExternalUrl(e.target.value)}
                placeholder="https://..."
                className="w-full px-3 py-2 rounded-lg bg-[#151D2F] border border-[#1E293B] text-white"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <label className="px-4 py-2 rounded-xl bg-[#151D2F] hover:bg-slate-800 border border-[#1E293B] text-xs font-bold text-indigo-300 cursor-pointer">
              {pdfFile
                ? `📄 Selected: ${pdfFile.name}`
                : '📤 Choose .PDF File from Device'}
              <input
                type="file"
                accept=".pdf,application/pdf"
                onChange={(e) => setPdfFile(e.target.files?.[0] || null)}
                className="hidden"
              />
            </label>

            {pdfProgress && (
              <span className="text-xs font-mono text-[#10B981]">
                {pdfProgress}
              </span>
            )}

            <button
              type="submit"
              disabled={savingPdf}
              className="px-5 py-2.5 rounded-xl bg-[#10B981] hover:bg-emerald-500 text-slate-950 text-xs font-black shadow-lg cursor-pointer"
            >
              {savingPdf ? 'Uploading...' : '☁️ Upload PDF to Firebase'}
            </button>
          </div>
        </form>
      )}

      {/* TAB 4: LIVE CLASSROOM HOST BROADCAST LAUNCHER */}
      {activeAdminSection === 'live_studio' && (
        <div className="bg-[#0B0F19] border border-[#1E293B] rounded-xl p-4 sm:p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-extrabold text-white">
                Launch Live Classroom Broadcast (Host Privileges)
              </h3>
              <p className="text-xs text-slate-400">
                Students join in strict read-only viewer mode (`StudentViewer.jsx`) while Mentor Sumit gets full Digital Whiteboard, Screen Share, and Mute-All controls (`TeacherHost.jsx`).
              </p>
            </div>
            <span className="px-2.5 py-1 rounded-full bg-[#EF4444]/20 text-[#EF4444] border border-[#EF4444]/40 text-[10px] font-black uppercase">
              Jitsi Host Engine
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div>
              <label className="block text-slate-400 font-semibold mb-1">
                Live Session Title
              </label>
              <input
                type="text"
                value={liveTitle}
                onChange={(e) => setLiveTitle(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-[#151D2F] border border-[#1E293B] text-white"
              />
            </div>
            <div>
              <label className="block text-slate-400 font-semibold mb-1">
                Topic / Target Batch
              </label>
              <input
                type="text"
                value={liveTopic}
                onChange={(e) => setLiveTopic(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-[#151D2F] border border-[#1E293B] text-white"
              />
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleGoLiveNow}
              className="px-5 py-2.5 rounded-xl bg-[#EF4444] hover:bg-red-500 text-white text-xs font-black shadow-lg flex items-center gap-2 cursor-pointer"
            >
              <span className="w-2 h-2 rounded-full bg-white animate-ping" />
              <span>Go Live Now as Host (@unfiltereddsumit)</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
