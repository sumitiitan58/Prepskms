import React, { useState, useEffect } from 'react';
import {
  db,
  uploadDataUrlInChunks,
  resolveCloudFileUrl,
} from '../firebase';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import {
  uploadStudyMaterialPdf,
  readFileAsDataUrl,
} from '../services/cloudStorage';

const DEFAULT_MENTOR_AVATAR = '/assets/aistudio/IMG_1422_c0b1f775.png';

export default function AdminControls() {
  // Mentor Profile State
  const [mentorName, setMentorName] = useState('Sumit');
  const [mentorHandle, setMentorHandle] = useState('@unfiltereddsumit');
  const [mentorAvatarPreview, setMentorAvatarPreview] = useState(
    DEFAULT_MENTOR_AVATAR
  );
  const [avatarUploading, setAvatarUploading] = useState(false);

  // Live Classroom Scheduling & Broadcast State
  const [liveTitle, setLiveTitle] = useState(
    'JEE/NEET Strategy & Rank Booster Live Session'
  );
  const [liveRoomName, setLiveRoomName] = useState(
    'PrepskmLiveMentorshipSumit'
  );
  const [scheduledDateTime, setScheduledDateTime] = useState('');
  const [alertBannerText, setAlertBannerText] = useState('');
  const [thumbnailPreview, setThumbnailPreview] = useState('');
  const [thumbnailPointer, setThumbnailPointer] = useState('');
  const [sessionState, setSessionState] = useState({
    isLive: false,
    status: 'idle',
    raiseHandLocked: false,
    chatMuted: false,
    raisedHands: [],
    onStageStudents: [],
  });

  // Cloud Study Material Upload State
  const [pdfTitle, setPdfTitle] = useState('');
  const [pdfSubject, setPdfSubject] = useState('Physics');
  const [pdfChapter, setPdfChapter] = useState('');
  const [pdfFile, setPdfFile] = useState(null);
  const [pdfUploadProgress, setPdfUploadProgress] = useState('');
  const [isUploadingPdf, setIsUploadingPdf] = useState(false);

  useEffect(() => {
    const unsubProfile = onSnapshot(
      doc(db, 'mentor_settings', 'profile'),
      async (snap) => {
        if (snap.exists()) {
          const d = snap.data();
          setMentorName(d.name || 'Sumit');
          setMentorHandle(d.handle || '@unfiltereddsumit');
          if (d.avatarUrl) {
            const resolved = await resolveCloudFileUrl(d.avatarUrl);
            setMentorAvatarPreview(resolved || DEFAULT_MENTOR_AVATAR);
          }
        }
      }
    );

    const unsubLive = onSnapshot(
      doc(db, 'live_sessions', 'current'),
      async (snap) => {
        if (snap.exists()) {
          const d = snap.data();
          setSessionState({
            isLive: Boolean(d.isLive),
            status: d.status || (d.isLive ? 'live' : 'idle'),
            raiseHandLocked: Boolean(d.raiseHandLocked),
            chatMuted: Boolean(d.chatMuted),
            raisedHands: Array.isArray(d.raisedHands) ? d.raisedHands : [],
            onStageStudents: Array.isArray(d.onStageStudents)
              ? d.onStageStudents
              : [],
          });
          if (d.title) setLiveTitle(d.title);
          if (d.roomName) setLiveRoomName(d.roomName);
          if (d.scheduledAt) setScheduledDateTime(d.scheduledAt);
          if (d.alertMessage !== undefined) setAlertBannerText(d.alertMessage);
          if (d.thumbnailUrl) {
            setThumbnailPointer(d.thumbnailUrl);
            const resolved = await resolveCloudFileUrl(d.thumbnailUrl);
            setThumbnailPreview(resolved);
          }
        }
      }
    );

    return () => {
      unsubProfile();
      unsubLive();
    };
  }, []);

  // 1. Mentor Profile Image Upload Handler
  const handleAvatarFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarUploading(true);
    try {
      const dataUrl = await readFileAsDataUrl(file);
      const pointer = await uploadDataUrlInChunks(
        `mentor_avatar_${Date.now()}`,
        dataUrl,
        file.name
      );
      await setDoc(
        doc(db, 'mentor_settings', 'profile'),
        {
          name: 'Sumit',
          handle: '@unfiltereddsumit',
          avatarUrl: pointer,
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );
      setMentorAvatarPreview(dataUrl);
      if (typeof window.showToast === 'function') {
        window.showToast(
          '✅ Mentor Sumit profile picture updated across all student devices!'
        );
      }
    } catch (err) {
      console.error('Avatar upload error:', err);
      if (typeof window.showToast === 'function') {
        window.showToast('Failed to upload profile image.');
      }
    } finally {
      setAvatarUploading(false);
    }
  };

  // 2. Live Session Thumbnail Upload Handler
  const handleThumbnailUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await readFileAsDataUrl(file);
      setThumbnailPreview(dataUrl);
      const pointer = await uploadDataUrlInChunks(
        `live_thumb_${Date.now()}`,
        dataUrl,
        file.name
      );
      setThumbnailPointer(pointer);
      if (typeof window.showToast === 'function') {
        window.showToast('🖼️ Live thumbnail uploaded!');
      }
    } catch (err) {
      console.warn('Thumbnail upload error:', err);
    }
  };

  // 3. Schedule Live Session in Advance (Countdown Mode)
  const handleScheduleLiveSession = async () => {
    if (!scheduledDateTime) {
      if (typeof window.showToast === 'function') {
        window.showToast('Please select a Schedule Date & Time first.');
      }
      return;
    }
    const formattedTime = new Date(scheduledDateTime).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
    const autoAlert =
      alertBannerText.trim() ||
      `Mentor Sumit is going live at ${formattedTime} — Get ready!`;

    try {
      await setDoc(
        doc(db, 'live_sessions', 'current'),
        {
          isLive: false,
          status: 'scheduled',
          title: liveTitle.trim() || 'JEE/NEET Live Mentorship by Sumit',
          roomName: liveRoomName.trim() || 'PrepskmLiveMentorshipSumit',
          mentorName: 'Sumit (@unfiltereddsumit)',
          scheduledAt: scheduledDateTime,
          alertMessage: autoAlert,
          thumbnailUrl: thumbnailPointer || thumbnailPreview || '',
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );
      setAlertBannerText(autoAlert);
      if (typeof window.showToast === 'function') {
        window.showToast(
          '⏰ Live Session Scheduled! Countdown timer & alert banner are now active on student homepages.'
        );
      }
    } catch (err) {
      console.error('Schedule live error:', err);
    }
  };

  // 4. Start Live Classroom Immediately & Open Full-Screen Host Studio
  const handleGoLiveNow = async () => {
    try {
      await setDoc(
        doc(db, 'live_sessions', 'current'),
        {
          isLive: true,
          status: 'live',
          title: liveTitle.trim() || 'JEE/NEET Live Mentorship by Sumit',
          roomName: liveRoomName.trim() || 'PrepskmLiveMentorshipSumit',
          mentorName: 'Sumit (@unfiltereddsumit)',
          scheduledAt: '',
          alertMessage:
            alertBannerText.trim() ||
            '🔴 Mentor Sumit is LIVE right now — Join the classroom!',
          thumbnailUrl: thumbnailPointer || thumbnailPreview || '',
          startedAt: new Date().toISOString(),
        },
        { merge: true }
      );
      if (typeof window.showToast === 'function') {
        window.showToast('🔴 You are now LIVE! Opening Host Classroom...');
      }
      if (typeof window.openLiveClassroomModal === 'function') {
        window.openLiveClassroomModal({ asHost: true });
      }
    } catch (err) {
      console.error('Go live error:', err);
    }
  };

  // 5. Broadcast Push/In-App Alert Banner
  const handleSendBroadcastAlert = async () => {
    const timeStr = scheduledDateTime
      ? new Date(scheduledDateTime).toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        })
      : '8:00 PM';
    const msg =
      alertBannerText.trim() ||
      `Mentor Sumit is going live at ${timeStr} — Get ready!`;
    try {
      await setDoc(
        doc(db, 'live_sessions', 'current'),
        { alertMessage: msg, updatedAt: new Date().toISOString() },
        { merge: true }
      );
      setAlertBannerText(msg);
      if (typeof window.showToast === 'function') {
        window.showToast(`📢 Alert broadcasted to all students: "${msg}"`);
      }
    } catch (err) {
      console.warn('Broadcast alert error:', err);
    }
  };

  const handleClearBroadcastAlert = async () => {
    try {
      await setDoc(
        doc(db, 'live_sessions', 'current'),
        { alertMessage: '' },
        { merge: true }
      );
      setAlertBannerText('');
      if (typeof window.showToast === 'function') {
        window.showToast('Alert banner cleared.');
      }
    } catch (err) {
      console.warn(err);
    }
  };

  // 6. Direct Cloud Study Material Upload via cloudStorage.js
  const handleCloudPdfSubmit = async (e) => {
    e.preventDefault();
    if (!pdfTitle.trim() || !pdfChapter.trim()) {
      if (typeof window.showToast === 'function') {
        window.showToast('Please enter PDF Title and Chapter name.');
      }
      return;
    }
    if (!pdfFile) {
      if (typeof window.showToast === 'function') {
        window.showToast('Please select a PDF file to upload.');
      }
      return;
    }

    setIsUploadingPdf(true);
    setPdfUploadProgress('Preparing cloud chunks...');
    try {
      const sizeMb = `${(pdfFile.size / (1024 * 1024)).toFixed(2)} MB`;
      const savedRecord = await uploadStudyMaterialPdf(
        pdfFile,
        {
          title: pdfTitle.trim(),
          subject: pdfSubject,
          chapter: pdfChapter.trim(),
          size: sizeMb,
          author: 'Sumit (@unfiltereddsumit)',
        },
        (done, total) => {
          setPdfUploadProgress(
            `Uploading chunk ${done} of ${total} (${Math.round(
              (done / total) * 100
            )}%)...`
          );
        }
      );

      setPdfTitle('');
      setPdfChapter('');
      setPdfFile(null);
      setPdfUploadProgress('');

      if (typeof window.showToast === 'function') {
        window.showToast(
          `✅ "${savedRecord.title}" uploaded & synced to all student devices!`
        );
      }
    } catch (err) {
      console.error('Cloud PDF upload failed:', err);
      if (typeof window.showToast === 'function') {
        window.showToast('Upload failed. Please try again.');
      }
    } finally {
      setIsUploadingPdf(false);
    }
  };

  return (
    <div className="space-y-4 mb-6">
      {/* 1. Mentor Sumit (@unfiltereddsumit) Identity & Profile Picture Upload Card */}
      <div className="bg-white rounded-3xl p-5 border border-indigo-100 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="relative shrink-0">
              <img
                src={mentorAvatarPreview || DEFAULT_MENTOR_AVATAR}
                alt="Mentor Sumit"
                className="w-16 h-16 rounded-2xl object-cover border-2 border-indigo-500 shadow-md"
              />
              <span className="absolute -bottom-1 -right-1 px-1.5 py-0.5 rounded-md bg-indigo-600 text-white text-[9px] font-black uppercase">
                Mentor
              </span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-extrabold text-slate-900">
                  {mentorName} ({mentorHandle})
                </h3>
                <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-extrabold border border-emerald-200">
                  Verified Host
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Uploading a new photo updates the Header, Daily Fuel Quote Card, and Live Stream Host Avatar across all student devices in real time.
              </p>
            </div>
          </div>

          <div className="shrink-0">
            <label className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-extrabold shadow-sm transition cursor-pointer">
              <span>📷</span>
              <span>
                {avatarUploading
                  ? 'Uploading...'
                  : 'Upload Mentor Profile Photo'}
              </span>
              <input
                type="file"
                accept="image/*"
                onChange={handleAvatarFileChange}
                disabled={avatarUploading}
                className="hidden"
              />
            </label>
          </div>
        </div>
      </div>

      {/* 2. EdTech Live Classroom Scheduler, Countdown & Moderator Studio */}
      <div className="bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white rounded-3xl p-5 border border-indigo-500/30 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
          <div>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-rose-500/20 text-rose-300 border border-rose-500/30">
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
              EdTech Live Mentorship Studio
            </span>
            <h3 className="text-base sm:text-lg font-black mt-1">
              Schedule Stream, Countdown &amp; Stage Moderation
            </h3>
          </div>
          {sessionState.isLive && (
            <button
              onClick={() =>
                typeof window.openLiveClassroomModal === 'function' &&
                window.openLiveClassroomModal({ asHost: true })
              }
              className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-extrabold shadow-lg cursor-pointer"
            >
              Open Full-Screen Host Classroom ↗
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
          <div>
            <label className="block text-[11px] font-bold text-indigo-200 mb-1">
              Live Session Title
            </label>
            <input
              type="text"
              value={liveTitle}
              onChange={(e) => setLiveTitle(e.target.value)}
              placeholder="e.g., Final 30-Day JEE Physics High-Weightage Revision"
              className="w-full px-3.5 py-2 rounded-xl bg-slate-800/90 border border-slate-700 text-xs text-white focus:outline-none focus:border-indigo-400"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-indigo-200 mb-1">
              Schedule Date &amp; Time (Enables Homepage Countdown Timer)
            </label>
            <input
              type="datetime-local"
              value={scheduledDateTime}
              onChange={(e) => setScheduledDateTime(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl bg-slate-800/90 border border-slate-700 text-xs text-white focus:outline-none focus:border-indigo-400"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
          <div>
            <label className="block text-[11px] font-bold text-indigo-200 mb-1">
              Session Thumbnail Upload (Shown on Compact Homepage Card)
            </label>
            <div className="flex items-center gap-2">
              <label className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 text-xs font-bold text-indigo-200 cursor-pointer shrink-0">
                🖼️ Upload Thumbnail
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleThumbnailUpload}
                  className="hidden"
                />
              </label>
              {thumbnailPreview && (
                <img
                  src={thumbnailPreview}
                  alt="Thumbnail preview"
                  className="w-14 h-9 rounded-lg object-cover border border-indigo-400/40"
                />
              )}
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-indigo-200 mb-1">
              Push / In-App Alert Banner Message
            </label>
            <div className="flex items-center gap-1.5">
              <input
                type="text"
                value={alertBannerText}
                onChange={(e) => setAlertBannerText(e.target.value)}
                placeholder="Mentor Sumit is going live at 8:00 PM — Get ready!"
                className="flex-1 px-3 py-2 rounded-xl bg-slate-800/90 border border-slate-700 text-xs text-white focus:outline-none focus:border-indigo-400"
              />
              <button
                type="button"
                onClick={handleSendBroadcastAlert}
                className="px-3 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-extrabold shrink-0 cursor-pointer"
              >
                📢 Notify
              </button>
              {alertBannerText && (
                <button
                  type="button"
                  onClick={handleClearBroadcastAlert}
                  className="px-2.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold shrink-0 cursor-pointer"
                  title="Clear alert"
                >
                  ✕
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Action Buttons: Go Live Now vs Schedule with Countdown */}
        <div className="flex flex-wrap items-center gap-2.5 pt-2 border-t border-white/10">
          <button
            type="button"
            onClick={handleGoLiveNow}
            className="px-4 py-2.5 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-extrabold shadow-lg shadow-rose-600/30 transition cursor-pointer"
          >
            🔴 Go Live Now (Open Full-Screen Studio)
          </button>

          <button
            type="button"
            onClick={handleScheduleLiveSession}
            className="px-4 py-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-extrabold shadow-lg transition cursor-pointer"
          >
            ⏰ Schedule Session (Start Countdown)
          </button>
        </div>
      </div>

      {/* 3. Cloud PDF Study Material Uploader (Chunked >18MB Safe Storage) */}
      <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <div>
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-indigo-600 bg-indigo-50 px-2.5 py-0.5 rounded-full">
              Cloud Storage Sync
            </span>
            <h3 className="text-base font-extrabold text-slate-900 mt-1">
              Quick Cloud PDF Uploader (Large File Safe)
            </h3>
          </div>
        </div>

        <form
          onSubmit={handleCloudPdfSubmit}
          className="grid grid-cols-1 sm:grid-cols-4 gap-2.5 items-end"
        >
          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1">
              PDF Title
            </label>
            <input
              type="text"
              value={pdfTitle}
              onChange={(e) => setPdfTitle(e.target.value)}
              placeholder="e.g., Rotational Motion Notes"
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1">
              Subject &amp; Chapter
            </label>
            <div className="flex gap-1.5">
              <select
                value={pdfSubject}
                onChange={(e) => setPdfSubject(e.target.value)}
                className="px-2.5 py-2 rounded-xl border border-slate-200 text-xs font-bold bg-slate-50"
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
                placeholder="Chapter name"
                className="w-full px-2.5 py-2 rounded-xl border border-slate-200 text-xs font-semibold"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1">
              Select PDF File
            </label>
            <input
              type="file"
              accept=".pdf,application/pdf"
              onChange={(e) => setPdfFile(e.target.files?.[0] || null)}
              className="w-full text-xs text-slate-600 file:mr-2 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
            />
          </div>

          <div>
            <button
              type="submit"
              disabled={isUploadingPdf}
              className="w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-extrabold shadow-sm transition cursor-pointer"
            >
              {isUploadingPdf ? 'Uploading to Cloud...' : '☁️ Upload & Sync PDF'}
            </button>
          </div>
        </form>

        {pdfUploadProgress && (
          <p className="text-xs font-bold text-indigo-600 mt-2">
            {pdfUploadProgress}
          </p>
        )}
      </div>
    </div>
  );
}
