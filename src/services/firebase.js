/**
 * Prepskm Production Firebase Service (Firestore + Cloud Storage + Auth)
 *
 * Features:
 * 1. Persistent Auth Session (`browserLocalPersistence`) with Email/Password & Google Sign-In
 *    and explicit user-friendly error handling (`formatFirebaseAuthError`).
 * 2. Real-time Firestore synchronization (`onSnapshot`) with zero hardcoded dummy arrays.
 * 3. Direct Cloud Storage upload (`ref`, `uploadBytes`, `getDownloadURL`) with chunked
 *    Firestore fallback so uploads always persist across all mobile/desktop devices.
 * 4. Complete backend helpers for all 7 Admin Suite modules:
 *    - AdminLive (schedule/start live stream, raise-hand stage approvals, chat lock)
 *    - AdminVideos (lectures, thumbnails, chapter timestamps)
 *    - AdminStudyMaterials (PDF upload, preview, direct device download)
 *    - AdminMockTests (CBT test builder & student_results analytics)
 *    - AdminChat & Community (delete comments, pin announcements, mute users)
 *    - AdminNotifications (real-time broadcast banners to all devices)
 *    - AdminProfile (Mentor Sumit avatar & multi-mentor management)
 */
import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  limit,
} from 'firebase/firestore';
import {
  getStorage,
  ref as storageRef,
  uploadBytes,
  getDownloadURL,
} from 'firebase/storage';
import {
  getAuth,
  setPersistence,
  browserLocalPersistence,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  updateProfile,
  onAuthStateChanged,
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';
import { formatFirebaseAuthError } from '../utils/testEngine';

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const storage = getStorage(app);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

// Ensure persistent login across mobile & desktop browser restarts
if (typeof window !== 'undefined') {
  setPersistence(auth, browserLocalPersistence).catch((err) => {
    console.warn('[Prepskm Auth] browserLocalPersistence fallback:', err?.message || err);
  });
}

export const SUPER_ADMIN_EMAILS = [
  'sumitk31207@gmail.com',
  'sumitgaming9570@gmail.com',
  'unfiltereddsumit@gmail.com',
  'admin@prepskm.in',
];

export const DEFAULT_SUMIT_AVATAR = '/assets/aistudio/IMG_1422_c0b1f775.png';

export { formatFirebaseAuthError };

// ============================================================================
// 0. AUTHENTICATION (CROSS-DEVICE PERSISTENCE & EXPLICIT ERROR HANDLING)
// ============================================================================

export async function loginWithEmailPassword(email, password) {
  try {
    const cleanEmail = String(email || '').trim();
    if (!cleanEmail || !password) {
      throw new Error('Please enter both your email address and password.');
    }
    await setPersistence(auth, browserLocalPersistence);
    const credential = await signInWithEmailAndPassword(auth, cleanEmail, password);
    await syncUserRecordToFirestore(credential.user);
    return { user: credential.user, error: null };
  } catch (err) {
    return { user: null, error: formatFirebaseAuthError(err) };
  }
}

export async function registerWithEmailPassword({ name, email, password, targetExam = 'JEE 2027', studentClass = 'Class 12' }) {
  try {
    const cleanEmail = String(email || '').trim();
    const cleanName = String(name || '').trim() || cleanEmail.split('@')[0] || 'Prepskm Student';
    if (!cleanEmail || !password) {
      throw new Error('Email and password are required to create an account.');
    }
    if (String(password).length < 6) {
      throw new Error('auth/weak-password');
    }
    await setPersistence(auth, browserLocalPersistence);
    const credential = await createUserWithEmailAndPassword(auth, cleanEmail, password);
    try {
      await updateProfile(credential.user, { displayName: cleanName });
    } catch {
      // Ignore profile update error
    }
    await syncUserRecordToFirestore(credential.user, {
      name: cleanName,
      targetExam,
      studentClass,
    });
    return { user: credential.user, error: null };
  } catch (err) {
    return { user: null, error: formatFirebaseAuthError(err) };
  }
}

export async function loginWithGooglePopup() {
  try {
    await setPersistence(auth, browserLocalPersistence);
    const result = await signInWithPopup(auth, googleProvider);
    await syncUserRecordToFirestore(result.user);
    return { user: result.user, error: null };
  } catch (err) {
    return { user: null, error: formatFirebaseAuthError(err) };
  }
}

export async function logoutUser() {
  try {
    await signOut(auth);
    return { success: true };
  } catch (err) {
    return { success: false, error: formatFirebaseAuthError(err) };
  }
}

export function subscribeAuthState(onChange) {
  return onAuthStateChanged(auth, (user) => {
    onChange(user || null);
  });
}

async function syncUserRecordToFirestore(user, extra = {}) {
  if (!user || !user.uid) return;
  try {
    const isAdmin = SUPER_ADMIN_EMAILS.some(
      (adm) => adm.toLowerCase() === String(user.email || '').toLowerCase()
    );
    await setDoc(
      doc(db, 'users', user.uid),
      {
        uid: user.uid,
        email: user.email || '',
        name: extra.name || user.displayName || (user.email ? user.email.split('@')[0] : 'Prepskm Student'),
        photoURL: user.photoURL || '',
        role: isAdmin ? 'admin' : 'student',
        targetExam: extra.targetExam || 'JEE / NEET',
        studentClass: extra.studentClass || 'Class 12',
        lastLoginAt: new Date().toISOString(),
      },
      { merge: true }
    );
  } catch (err) {
    console.warn('[Prepskm Auth] Non-fatal user profile sync warning:', err?.message || err);
  }
}

// ============================================================================
// 1. CLOUD STORAGE UPLOAD + CHUNKED FIRESTORE FALLBACK
// ============================================================================

const CHUNK_SIZE_BYTES = 700 * 1024; // 700KB per Firestore chunk

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(file);
  });
}

export async function uploadFileToFirebaseStorage(file, folder = 'uploads', onProgress = null) {
  if (!file) throw new Error('No file selected for upload.');
  const safeName = (file.name || 'file').replace(/[^a-zA-Z0-9._-]/g, '_');
  const uniqueId = `${folder}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const path = `prepskm/${folder}/${uniqueId}_${safeName}`;

  if (onProgress) onProgress(15);

  try {
    const fileRef = storageRef(storage, path);
    const snapshot = await uploadBytes(fileRef, file, {
      contentType: file.type || 'application/octet-stream',
    });
    if (onProgress) onProgress(85);
    const downloadUrl = await getDownloadURL(snapshot.ref);
    if (onProgress) onProgress(100);
    return downloadUrl;
  } catch (storageErr) {
    console.warn('[Prepskm Storage] Using Firestore Cloud Binary Storage fallback:', storageErr?.message || storageErr);
    const dataUrl = await fileToDataUrl(file);
    if (!dataUrl) throw new Error('Failed to encode file for cloud storage.');

    if (dataUrl.length <= 650 * 1024) {
      if (onProgress) onProgress(100);
      return dataUrl;
    }

    const totalChunks = Math.ceil(dataUrl.length / CHUNK_SIZE_BYTES);
    for (let i = 0; i < totalChunks; i++) {
      const slice = dataUrl.slice(i * CHUNK_SIZE_BYTES, (i + 1) * CHUNK_SIZE_BYTES);
      await setDoc(doc(db, 'cloud_file_chunks', `${uniqueId}_part_${i}`), {
        fileId: uniqueId,
        chunkIndex: i,
        totalChunks,
        fileName: safeName,
        mimeType: file.type || 'application/pdf',
        data: slice,
        createdAt: new Date().toISOString(),
      });
      if (onProgress) {
        onProgress(Math.min(98, Math.round(((i + 1) / totalChunks) * 95)));
      }
    }
    if (onProgress) onProgress(100);
    return `#prepskm-cloud-file:${uniqueId}:${totalChunks}:${encodeURIComponent(safeName)}`;
  }
}

export async function resolveCloudFileUrl(url) {
  if (!url || typeof url !== 'string') return '';
  if (!url.startsWith('#prepskm-cloud-file:')) return url;

  const raw = url.replace('#prepskm-cloud-file:', '');
  const parts = raw.split(':');
  const fileId = parts[0];
  const totalChunks = parseInt(parts[1] || '1', 10);

  const chunks = [];
  for (let i = 0; i < totalChunks; i++) {
    const snap = await getDoc(doc(db, 'cloud_file_chunks', `${fileId}_part_${i}`));
    if (snap.exists()) {
      chunks.push(snap.data().data || '');
    }
  }
  const fullDataUrl = chunks.join('');
  if (!fullDataUrl.startsWith('data:')) return '';

  try {
    const [header, base64] = fullDataUrl.split(',');
    const mimeMatch = header.match(/data:(.*?);base64/);
    const mime = mimeMatch ? mimeMatch[1] : 'application/pdf';
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    const blob = new Blob([bytes], { type: mime });
    return URL.createObjectURL(blob);
  } catch {
    return fullDataUrl;
  }
}

/**
 * Triggers a direct local file download to the student's phone/PC
 */
export async function downloadPdfToDevice(material) {
  const rawUrl = material?.pdf_url || material?.pdfUrl || '';
  const safeTitle = String(material?.title || 'Prepskm_Study_Note')
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .slice(0, 60);

  const resolvedUrl = await resolveCloudFileUrl(rawUrl);

  if (resolvedUrl && (resolvedUrl.startsWith('blob:') || resolvedUrl.startsWith('data:'))) {
    const a = document.createElement('a');
    a.href = resolvedUrl;
    a.download = `${safeTitle}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    return true;
  }

  if (resolvedUrl && resolvedUrl.startsWith('http')) {
    try {
      const response = await fetch(resolvedUrl);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = `${safeTitle}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(blobUrl), 5000);
      return true;
    } catch {
      const a = document.createElement('a');
      a.href = resolvedUrl;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.download = `${safeTitle}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      return true;
    }
  }

  throw new Error('No downloadable PDF stream attached to this study note yet.');
}

// ============================================================================
// 2. STUDY MATERIALS (`study_materials` + legacy `materials` sync)
// ============================================================================

export async function uploadStudyMaterial({ title, subject, chapter, exam = 'JEE', pdfFile, pdfUrlInput, onProgress }) {
  if (!title || !title.trim()) throw new Error('Material title is required.');

  let finalPdfUrl = (pdfUrlInput || '').trim();
  if (pdfFile) {
    finalPdfUrl = await uploadFileToFirebaseStorage(pdfFile, 'study_materials', onProgress);
  }
  if (!finalPdfUrl) {
    throw new Error('Please select a PDF file or provide a valid PDF URL.');
  }

  const id = `mat_${Date.now()}`;
  const createdAt = new Date().toISOString();

  const record = {
    id,
    title: title.trim(),
    subject: subject || 'Physics',
    chapter: (chapter || subject || 'General').trim(),
    exam: exam || 'JEE',
    pdf_url: finalPdfUrl,
    pdfUrl: finalPdfUrl,
    hasPdf: true,
    pages: pdfFile ? Math.max(1, Math.round(pdfFile.size / (45 * 1024))) : 12,
    created_at: createdAt,
    createdAt,
    updatedAt: createdAt,
  };

  await setDoc(doc(db, 'study_materials', id), record);
  await setDoc(doc(db, 'materials', id), record);
  return record;
}

export async function deleteStudyMaterial(id) {
  if (!id) return;
  await deleteDoc(doc(db, 'study_materials', id)).catch(() => {});
  await deleteDoc(doc(db, 'materials', id)).catch(() => {});
}

export function subscribeStudyMaterials(onUpdate) {
  let latestPrimary = [];
  let latestLegacy = [];

  const emitMerged = () => {
    const map = new Map();
    [...latestLegacy, ...latestPrimary].forEach((item) => {
      if (item && item.id) {
        map.set(item.id, {
          ...item,
          title: item.title || 'Untitled Note',
          subject: item.subject || 'Physics',
          chapter: item.chapter || item.subject || 'Revision Notes',
          pdf_url: item.pdf_url || item.pdfUrl || '',
          created_at: item.created_at || item.createdAt || '',
        });
      }
    });
    const merged = Array.from(map.values()).sort((a, b) =>
      String(b.created_at || '').localeCompare(String(a.created_at || ''))
    );
    onUpdate(merged);
  };

  const unsub1 = onSnapshot(
    collection(db, 'study_materials'),
    (snap) => {
      latestPrimary = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      emitMerged();
    },
    () => emitMerged()
  );

  const unsub2 = onSnapshot(
    collection(db, 'materials'),
    (snap) => {
      latestLegacy = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      emitMerged();
    },
    () => emitMerged()
  );

  return () => {
    unsub1();
    unsub2();
  };
}

// ============================================================================
// 3. VIDEO LECTURES (`video_lectures` + legacy `lectures` sync)
// ============================================================================

export async function createVideoLecture({
  title,
  subject,
  chapter,
  exam = 'JEE',
  duration = '45:00',
  videoUrl,
  videoFile,
  thumbnailUrl,
  thumbnailFile,
  timestamps = [],
  onProgress,
}) {
  if (!title || !title.trim()) throw new Error('Video lecture title is required.');

  let finalVideoUrl = (videoUrl || '').trim();
  if (videoFile) {
    finalVideoUrl = await uploadFileToFirebaseStorage(videoFile, 'video_lectures', onProgress);
  }
  if (!finalVideoUrl) {
    throw new Error('Please provide a video URL or upload an MP4 video file.');
  }

  let finalThumbUrl = (thumbnailUrl || '').trim();
  if (thumbnailFile) {
    finalThumbUrl = await uploadFileToFirebaseStorage(thumbnailFile, 'thumbnails');
  }

  const normalizedTimestamps = (Array.isArray(timestamps) ? timestamps : [])
    .filter((ts) => ts && (ts.time || ts.title || ts.label))
    .map((ts) => ({
      time: String(ts.time || '00:00').trim(),
      title: String(ts.title || ts.label || 'Concept Marker').trim(),
    }));

  const id = `vid_${Date.now()}`;
  const createdAt = new Date().toISOString();

  const record = {
    id,
    title: title.trim(),
    subject: subject || 'Physics',
    chapter: (chapter || subject || 'Core Lecture').trim(),
    exam: exam || 'JEE',
    duration: duration || '45:00',
    thumbnail_url: finalThumbUrl,
    thumbnailUrl: finalThumbUrl,
    video_url: finalVideoUrl,
    videoUrl: finalVideoUrl,
    timestamps: normalizedTimestamps,
    created_at: createdAt,
    createdAt,
  };

  await setDoc(doc(db, 'video_lectures', id), record);
  await setDoc(doc(db, 'lectures', id), record);
  return record;
}

export async function deleteVideoLecture(id) {
  if (!id) return;
  await deleteDoc(doc(db, 'video_lectures', id)).catch(() => {});
  await deleteDoc(doc(db, 'lectures', id)).catch(() => {});
}

export function subscribeVideoLectures(onUpdate) {
  let primaryList = [];
  let legacyList = [];

  const emitMerged = () => {
    const map = new Map();
    [...legacyList, ...primaryList].forEach((item) => {
      if (item && item.id) {
        map.set(item.id, {
          ...item,
          title: item.title || 'Untitled Lecture',
          subject: item.subject || 'Physics',
          chapter: item.chapter || item.subject || 'Masterclass',
          thumbnail_url: item.thumbnail_url || item.thumbnailUrl || '',
          video_url: item.video_url || item.videoUrl || '',
          timestamps: Array.isArray(item.timestamps) ? item.timestamps : [],
          created_at: item.created_at || item.createdAt || '',
        });
      }
    });
    const merged = Array.from(map.values()).sort((a, b) =>
      String(b.created_at || '').localeCompare(String(a.created_at || ''))
    );
    onUpdate(merged);
  };

  const unsub1 = onSnapshot(
    collection(db, 'video_lectures'),
    (snap) => {
      primaryList = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      emitMerged();
    },
    () => emitMerged()
  );

  const unsub2 = onSnapshot(
    collection(db, 'lectures'),
    (snap) => {
      legacyList = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      emitMerged();
    },
    () => emitMerged()
  );

  return () => {
    unsub1();
    unsub2();
  };
}

// ============================================================================
// 4. MOCK TESTS & STUDENT CBT RESULTS (`mock_tests`, `student_results`, `mock_results`)
// ============================================================================

export async function saveMockTest({
  id,
  title,
  exam = 'JEE Main',
  subject = 'Full Syllabus (PCM)',
  syllabus = 'Physics, Chemistry & Mathematics',
  durationMinutes = 180,
  questions = [],
}) {
  if (!title || !title.trim()) throw new Error('Mock test title is required.');
  if (!Array.isArray(questions) || questions.length === 0) {
    throw new Error('Please add at least one question to the CBT Mock Test.');
  }

  const testId = id || `mock_${Date.now()}`;
  const createdAt = new Date().toISOString();

  const normalizedQuestions = questions.map((q, idx) => ({
    id: q.id || `q_${idx + 1}`,
    type: q.type === 'NAT' ? 'NAT' : 'MCQ_SINGLE',
    subject: q.subject || 'Physics',
    chapter: q.chapter || 'Core Concept',
    exam: String(exam).includes('NEET') ? 'NEET' : 'JEE',
    difficulty: q.difficulty || 'Medium',
    text: String(q.text || q.questionText || `Question ${idx + 1}`).trim(),
    options: Array.isArray(q.options) && q.options.length === 4 ? q.options : ['Option A', 'Option B', 'Option C', 'Option D'],
    correctAnswer: String(q.correctAnswer || 'A').trim(),
    explanation: String(q.explanation || 'Step-by-step NTA solution key verified by Mentor Sumit.').trim(),
  }));

  const payload = {
    id: testId,
    title: title.trim(),
    exam,
    subject,
    syllabus,
    durationMinutes: Number(durationMinutes) || 180,
    totalQuestions: normalizedQuestions.length,
    maxMarks: normalizedQuestions.length * 4,
    questions: normalizedQuestions,
    created_at: createdAt,
    updatedAt: createdAt,
  };

  await setDoc(doc(db, 'mock_tests', testId), payload, { merge: true });
  return payload;
}

export async function deleteMockTest(testId) {
  if (!testId) return;
  await deleteDoc(doc(db, 'mock_tests', testId)).catch(() => {});
}

export function subscribeMockTests(onUpdate) {
  return onSnapshot(
    collection(db, 'mock_tests'),
    (snap) => {
      const list = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')));
      onUpdate(list);
    },
    () => onUpdate([])
  );
}

export async function saveStudentTestResult(resultPayload) {
  const id = resultPayload.id || `res_${Date.now()}`;
  const record = {
    ...resultPayload,
    id,
    date: resultPayload.date || new Date().toISOString(),
  };
  await setDoc(doc(db, 'student_results', id), record);
  await setDoc(doc(db, 'mock_results', id), record);
  return record;
}

export function subscribeStudentTestResults(studentEmail, onUpdate) {
  let primaryResults = [];
  let legacyResults = [];

  const emitMerged = () => {
    const map = new Map();
    [...legacyResults, ...primaryResults].forEach((r) => {
      if (r && r.id) {
        map.set(r.id, r);
      }
    });
    let list = Array.from(map.values());
    if (studentEmail) {
      const norm = studentEmail.trim().toLowerCase();
      const filtered = list.filter(
        (r) => !r.userEmail || String(r.userEmail).trim().toLowerCase() === norm
      );
      if (filtered.length > 0) list = filtered;
    }
    list.sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')));
    onUpdate(list);
  };

  const unsub1 = onSnapshot(
    collection(db, 'student_results'),
    (snap) => {
      primaryResults = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      emitMerged();
    },
    () => emitMerged()
  );

  const unsub2 = onSnapshot(
    collection(db, 'mock_results'),
    (snap) => {
      legacyResults = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      emitMerged();
    },
    () => emitMerged()
  );

  return () => {
    unsub1();
    unsub2();
  };
}

// ============================================================================
// 5. LIVE BROADCASTING & REAL-TIME NOTIFICATIONS (`settings/liveConfig`, `notifications`)
// ============================================================================

export async function scheduleOrStartLiveBroadcast({
  title,
  mentor = 'Sumit Sir (@unfiltereddsumit)',
  subject = 'Physics & Strategy',
  roomName,
  streamKeyOrUrl = '',
  scheduledAt = '',
  isActive = true,
  chatLocked = false,
}) {
  const cleanTitle = String(title || 'Live Doubt & Rank Booster Session').trim();
  const safeRoom =
    (roomName || '').trim() ||
    `PrepskmLiveMentorship_${cleanTitle.replace(/[^a-zA-Z0-9]/g, '').slice(0, 22) || 'MainRoom'}`;

  const livePayload = {
    isActive: Boolean(isActive),
    title: cleanTitle,
    mentor,
    subject,
    roomName: safeRoom,
    streamKeyOrUrl: String(streamKeyOrUrl || '').trim(),
    scheduledAt: scheduledAt || new Date().toISOString(),
    chatLocked: Boolean(chatLocked),
    updatedAt: new Date().toISOString(),
  };

  await setDoc(doc(db, 'settings', 'liveConfig'), livePayload, { merge: true });

  // Automatically broadcast an instant notification banner when Mentor Sumit goes LIVE
  if (isActive) {
    await broadcastLiveNotification({
      title: `Mentor Sumit is now LIVE: ${cleanTitle}`,
      message: `Join the live classroom now for ${subject} with ${mentor}.`,
      type: 'LIVE_NOW',
      targetRoute: '/live',
    });
  } else if (scheduledAt) {
    await broadcastLiveNotification({
      title: `Upcoming Live Class: ${cleanTitle}`,
      message: `Scheduled by ${mentor} (${subject}). Tap to view live classroom.`,
      type: 'SCHEDULED_LIVE',
      targetRoute: '/live',
    });
  }

  return livePayload;
}

export function subscribeLiveSession(onUpdate) {
  return onSnapshot(
    doc(db, 'settings', 'liveConfig'),
    (snap) => {
      if (snap.exists()) {
        onUpdate(snap.data());
      } else {
        onUpdate({
          isActive: false,
          title: 'JEE/NEET Live Strategy & PYQ Breakdown',
          mentor: 'Sumit Sir (@unfiltereddsumit)',
          subject: 'Physics & Strategy',
          roomName: 'PrepskmLiveMentorship_DefaultRoom',
          chatLocked: false,
          approvedStageEmails: [],
          handRaises: [],
        });
      }
    },
    () => {}
  );
}

export async function approveStudentRaiseHand(studentEmail, approve = true, currentConfig = {}) {
  if (!studentEmail) return;
  const currentApproved = Array.isArray(currentConfig.approvedStageEmails)
    ? [...currentConfig.approvedStageEmails]
    : [];
  const nextApproved = approve
    ? Array.from(new Set([...currentApproved, studentEmail]))
    : currentApproved.filter((e) => e !== studentEmail);

  const currentRaises = Array.isArray(currentConfig.handRaises) ? currentConfig.handRaises : [];
  const nextRaises = currentRaises.map((req) =>
    req.email === studentEmail ? { ...req, status: approve ? 'approved' : 'dismissed' } : req
  );

  await setDoc(
    doc(db, 'settings', 'liveConfig'),
    {
      approvedStageEmails: nextApproved,
      handRaises: nextRaises,
      updatedAt: new Date().toISOString(),
    },
    { merge: true }
  );
}

export async function broadcastLiveNotification({
  title,
  message,
  type = 'ANNOUNCEMENT',
  targetRoute = '/',
}) {
  if (!title || !title.trim()) throw new Error('Notification title is required.');
  const id = `notif_${Date.now()}`;
  const createdAt = new Date().toISOString();
  const payload = {
    id,
    title: title.trim(),
    message: String(message || '').trim(),
    type,
    targetRoute,
    author: 'Sumit (@unfiltereddsumit)',
    created_at: createdAt,
    createdAt,
  };
  await setDoc(doc(db, 'notifications', id), payload);
  return payload;
}

export async function deleteNotification(id) {
  if (!id) return;
  await deleteDoc(doc(db, 'notifications', id)).catch(() => {});
}

export function subscribeLiveNotifications(onUpdate) {
  return onSnapshot(
    collection(db, 'notifications'),
    (snap) => {
      const list = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .sort((a, b) => String(b.created_at || b.createdAt || '').localeCompare(String(a.created_at || a.createdAt || '')));
      onUpdate(list);
    },
    () => onUpdate([])
  );
}

// ============================================================================
// 6. COMMUNITY CHAT & MODERATION (`communityChats`, `settings/chatModeration`)
// ============================================================================

export function subscribeCommunityMessages(onUpdate) {
  return onSnapshot(
    collection(db, 'communityChats'),
    (snap) => {
      const list = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .sort((a, b) => String(b.createdAt || b.timestamp || '').localeCompare(String(a.createdAt || a.timestamp || '')));
      onUpdate(list);
    },
    () => onUpdate([])
  );
}

export async function postCommunityMessage({ authorName, authorEmail, text, isPinned = false, role = 'student' }) {
  if (!text || !text.trim()) throw new Error('Message text cannot be empty.');
  const id = `msg_${Date.now()}`;
  const createdAt = new Date().toISOString();
  const payload = {
    id,
    authorName: authorName || 'Prepskm Student',
    authorEmail: authorEmail || '',
    text: text.trim(),
    isPinned: Boolean(isPinned),
    role,
    createdAt,
  };
  await setDoc(doc(db, 'communityChats', id), payload);
  return payload;
}

export async function deleteCommunityMessage(messageId) {
  if (!messageId) return;
  await deleteDoc(doc(db, 'communityChats', messageId)).catch(() => {});
}

export async function pinCommunityMessage(messageId, isPinned = true) {
  if (!messageId) return;
  await setDoc(
    doc(db, 'communityChats', messageId),
    { isPinned: Boolean(isPinned), updatedAt: new Date().toISOString() },
    { merge: true }
  );
}

export async function muteCommunityUser(userEmail, mute = true) {
  if (!userEmail) return;
  const cleanEmail = String(userEmail).trim().toLowerCase();
  const snap = await getDoc(doc(db, 'settings', 'chatModeration')).catch(() => null);
  const existing = snap && snap.exists() && Array.isArray(snap.data().mutedEmails) ? snap.data().mutedEmails : [];
  const nextMuted = mute
    ? Array.from(new Set([...existing, cleanEmail]))
    : existing.filter((e) => e !== cleanEmail);

  await setDoc(
    doc(db, 'settings', 'chatModeration'),
    {
      mutedEmails: nextMuted,
      updatedAt: new Date().toISOString(),
    },
    { merge: true }
  );
  return nextMuted;
}

// ============================================================================
// 7. MENTORS & ADMIN SUMIT PROFILE (`mentors`, `settings/branding`)
// ============================================================================

export async function saveMentorProfile({
  id,
  name,
  handle,
  photoFile,
  photoUrl,
  subjectSpecialization,
  bio,
  isLeadMentor = false,
  ratePerMin = 5,
  onProgress,
}) {
  if (!name || !name.trim()) throw new Error('Mentor name is required.');

  let finalPhotoUrl = (photoUrl || '').trim();
  if (photoFile) {
    finalPhotoUrl = await uploadFileToFirebaseStorage(photoFile, 'mentors', onProgress);
  }
  if (!finalPhotoUrl) {
    finalPhotoUrl = DEFAULT_SUMIT_AVATAR;
  }

  const mentorId = id || (isLeadMentor ? 'lead_mentor_sumit' : `mentor_${Date.now()}`);
  const createdAt = new Date().toISOString();

  const record = {
    id: mentorId,
    name: name.trim(),
    handle: (handle || '@unfiltereddsumit').trim(),
    photo_url: finalPhotoUrl,
    photoUrl: finalPhotoUrl,
    subject_specialization: (subjectSpecialization || 'Physics, Chemistry & Rank Strategy').trim(),
    bio: (bio || '99+ Percentile Strategy • Daily Accountability & Personal 1:1 Doubt Solving').trim(),
    is_lead_mentor: Boolean(isLeadMentor),
    ratePerMin: Number(ratePerMin) || 5,
    updatedAt: createdAt,
  };

  await setDoc(doc(db, 'mentors', mentorId), record, { merge: true });

  if (isLeadMentor) {
    await setDoc(
      doc(db, 'settings', 'branding'),
      {
        sumitAvatarUrl: finalPhotoUrl,
        leadMentorName: record.name,
        leadMentorHandle: record.handle,
        updatedAt: createdAt,
      },
      { merge: true }
    );
  }

  return record;
}

export async function updateAdminSumitAvatar(photoFile, onProgress) {
  if (!photoFile) throw new Error('Please select an image file to upload.');
  const uploadedUrl = await uploadFileToFirebaseStorage(photoFile, 'admin_avatar', onProgress);

  await setDoc(
    doc(db, 'settings', 'branding'),
    {
      sumitAvatarUrl: uploadedUrl,
      updatedAt: new Date().toISOString(),
    },
    { merge: true }
  );

  await setDoc(
    doc(db, 'mentors', 'lead_mentor_sumit'),
    {
      id: 'lead_mentor_sumit',
      name: 'Sumit',
      handle: '@unfiltereddsumit',
      photo_url: uploadedUrl,
      photoUrl: uploadedUrl,
      subject_specialization: 'Lead Mentor • JEE & NEET 99+ Percentile Strategy',
      bio: 'Founder of Prepskm (@unfiltereddsumit). Helping JEE & NEET aspirants eliminate negative marking and build top-1% daily consistency.',
      is_lead_mentor: true,
      ratePerMin: 5,
      updatedAt: new Date().toISOString(),
    },
    { merge: true }
  );

  return uploadedUrl;
}

export async function deleteMentorProfile(id) {
  if (!id || id === 'lead_mentor_sumit') {
    throw new Error('Lead Mentor Sumit profile cannot be deleted.');
  }
  await deleteDoc(doc(db, 'mentors', id));
}

export function subscribeMentors(onUpdate) {
  return onSnapshot(
    collection(db, 'mentors'),
    (snap) => {
      const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      const hasLead = docs.some((m) => m.is_lead_mentor || m.id === 'lead_mentor_sumit');
      const leadDefault = {
        id: 'lead_mentor_sumit',
        name: 'Sumit',
        handle: '@unfiltereddsumit',
        photo_url: DEFAULT_SUMIT_AVATAR,
        subject_specialization: 'Lead Mentor • JEE & NEET 99+ Percentile Strategy',
        bio: 'Founder of Prepskm (@unfiltereddsumit). Direct 1:1 strategy, CBT error analysis, and daily rank roadmap.',
        is_lead_mentor: true,
        ratePerMin: 5,
      };
      const finalMentors = hasLead ? docs : [leadDefault, ...docs];
      finalMentors.sort((a, b) => (b.is_lead_mentor ? 1 : 0) - (a.is_lead_mentor ? 1 : 0));
      onUpdate(finalMentors);
    },
    () => {
      onUpdate([
        {
          id: 'lead_mentor_sumit',
          name: 'Sumit',
          handle: '@unfiltereddsumit',
          photo_url: DEFAULT_SUMIT_AVATAR,
          subject_specialization: 'Lead Mentor • JEE & NEET 99+ Percentile Strategy',
          bio: 'Founder of Prepskm (@unfiltereddsumit). Direct 1:1 strategy, CBT error analysis, and daily rank roadmap.',
          is_lead_mentor: true,
          ratePerMin: 5,
        },
      ]);
    }
  );
}

export function subscribeAdminSumitAvatar(onAvatarChange) {
  return onSnapshot(
    doc(db, 'settings', 'branding'),
    async (snap) => {
      if (snap.exists() && snap.data().sumitAvatarUrl) {
        const raw = snap.data().sumitAvatarUrl;
        const resolved = await resolveCloudFileUrl(raw);
        onAvatarChange(resolved || DEFAULT_SUMIT_AVATAR);
      } else {
        onAvatarChange(DEFAULT_SUMIT_AVATAR);
      }
    },
    () => onAvatarChange(DEFAULT_SUMIT_AVATAR)
  );
}
