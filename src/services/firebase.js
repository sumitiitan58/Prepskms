import {
  app,
  db,
  auth,
  uploadDataUrlInChunks,
  resolveCloudFileUrl,
} from '../firebase';
import {
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
  parseTimestampsInput,
  parseTimestampToSeconds,
  syncEventToWeeklySchedule,
} from './db.js';

export const storage = getStorage(app);

export { app, db, auth, uploadDataUrlInChunks, resolveCloudFileUrl };

/**
 * Converts a File or Blob to a Data URL string.
 */
export function fileToDataUrl(fileOrBlob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(fileOrBlob);
  });
}

/**
 * Uploads a File/Blob or DataURL to Firebase Storage first, with automatic
 * fallback to Firestore chunked storage (`file_chunks`) so uploads succeed
 * across every browser and network environment.
 */
export async function uploadFileToFirebaseStorage(
  fileOrDataUrl,
  pathPrefix = 'uploads',
  onProgress = null
) {
  if (!fileOrDataUrl) return '';
  if (
    typeof fileOrDataUrl === 'string' &&
    !fileOrDataUrl.startsWith('data:')
  ) {
    return fileOrDataUrl.trim();
  }

  const fileId = `${pathPrefix.replace(/[^a-zA-Z0-9_-]/g, '_')}-${Date.now()}`;
  const fileName =
    typeof fileOrDataUrl === 'object' && fileOrDataUrl.name
      ? fileOrDataUrl.name
      : `${fileId}.bin`;

  // Attempt native Firebase Storage upload first if a File/Blob is provided
  if (typeof fileOrDataUrl === 'object' && fileOrDataUrl instanceof Blob) {
    try {
      const cleanName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
      const sRef = storageRef(storage, `${pathPrefix}/${Date.now()}_${cleanName}`);
      const uploadTask = Promise.race([
        uploadBytes(sRef, fileOrDataUrl),
        new Promise((_, rej) =>
          setTimeout(() => rej(new Error('Storage upload timeout')), 4500)
        ),
      ]);
      const snap = await uploadTask;
      const downloadUrl = await getDownloadURL(snap.ref);
      if (downloadUrl) {
        if (onProgress) onProgress(1, 1);
        return downloadUrl;
      }
    } catch (_storageErr) {
      // Fall back to chunked Firestore storage below
    }
  }

  const dataUrl =
    typeof fileOrDataUrl === 'string'
      ? fileOrDataUrl
      : await fileToDataUrl(fileOrDataUrl);

  return uploadDataUrlInChunks(fileId, dataUrl, fileName, onProgress || undefined);
}

// ============================================================================
// 1. STUDY MATERIALS (`study_materials`)
// Document schema: id, title, subject, chapter, pdf_url, created_at
// ============================================================================

export async function uploadStudyMaterial(
  fileOrUrl,
  metadata = {},
  onProgress = null
) {
  const id = metadata.id || `mat-${Date.now()}`;
  const pdfUrl = await uploadFileToFirebaseStorage(
    fileOrUrl,
    'study_materials',
    onProgress
  );
  const nowIso = new Date().toISOString();

  const record = {
    id,
    title: (metadata.title || 'Untitled Study Material').trim(),
    subject: metadata.subject || 'Physics',
    chapter: (metadata.chapter || 'Complete Syllabus').trim(),
    exam: metadata.exam || 'JEE',
    sectionId: metadata.sectionId || 'sec-notes',
    sectionName: metadata.sectionName || 'Revision Notes',
    pdf_url: pdfUrl,
    downloadUrl: pdfUrl,
    fileName:
      metadata.fileName ||
      (typeof fileOrUrl === 'object' && fileOrUrl?.name) ||
      `${(metadata.title || 'material').replace(/\s+/g, '_')}.pdf`,
    size:
      metadata.size ||
      (typeof fileOrUrl === 'object' && fileOrUrl?.size
        ? `${(fileOrUrl.size / (1024 * 1024)).toFixed(2)} MB`
        : '1.4 MB'),
    author: metadata.author || 'Sumit (@unfiltereddsumit)',
    created_at: metadata.created_at || nowIso,
    createdAt: metadata.createdAt || nowIso,
  };

  await setDoc(doc(db, 'study_materials', id), record, { merge: true });
  await setDoc(doc(db, 'materials', id), record, { merge: true });

  if (typeof window !== 'undefined' && window.state) {
    const existing = Array.isArray(window.state.materials)
      ? window.state.materials
      : [];
    window.state.materials = [
      record,
      ...existing.filter((m) => m.id !== record.id),
    ];
    try {
      localStorage.setItem('prepskm_state', JSON.stringify(window.state));
    } catch (_e) {}
    if (typeof window.renderMaterialsList === 'function') {
      window.renderMaterialsList();
    }
  }

  return record;
}

export function subscribeStudyMaterials(callback) {
  try {
    const q = query(collection(db, 'study_materials'));
    return onSnapshot(
      q,
      (snap) => {
        const docs = snap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .sort((a, b) =>
            String(b.created_at || b.createdAt || '').localeCompare(
              String(a.created_at || a.createdAt || '')
            )
          );
        callback(docs);
      },
      () => {
        if (typeof window !== 'undefined' && window.state?.materials) {
          callback(window.state.materials);
        }
      }
    );
  } catch (_e) {
    return () => {};
  }
}

export async function deleteStudyMaterial(materialId) {
  if (!materialId) return;
  try {
    await deleteDoc(doc(db, 'study_materials', materialId));
  } catch (_e) {}
  try {
    await deleteDoc(doc(db, 'materials', materialId));
  } catch (_e) {}
}

// ============================================================================
// 2. VIDEO LECTURES (`video_lectures`)
// Document schema: id, title, subject, chapter, thumbnail_url, video_url,
// timestamps: [{ time: "04:15", title: "Formula Derivation", seconds: 255 }]
// ============================================================================

export function normalizeVideoTimestamps(rawTimestamps) {
  if (!rawTimestamps) return [];
  if (Array.isArray(rawTimestamps)) {
    return rawTimestamps
      .filter((t) => t && (t.time || t.title || t.label))
      .map((t) => {
        const timeStr = String(t.time || '00:00').trim();
        const titleStr = String(t.title || t.label || 'Chapter Marker').trim();
        const seconds =
          typeof t.seconds === 'number'
            ? t.seconds
            : parseTimestampToSeconds(timeStr);
        return {
          time: timeStr,
          title: titleStr,
          label: titleStr,
          seconds,
        };
      })
      .sort((a, b) => a.seconds - b.seconds);
  }
  if (typeof rawTimestamps === 'string') {
    return parseTimestampsInput(rawTimestamps).map((t) => ({
      time: t.time,
      title: t.label || t.title || 'Chapter Marker',
      label: t.label || t.title || 'Chapter Marker',
      seconds: t.seconds,
    }));
  }
  return [];
}

export async function createVideoLecture(payload = {}, onProgress = null) {
  const id = payload.id || `vid-${Date.now()}`;
  let videoUrl = (payload.video_url || payload.videoUrl || '').trim();

  if (payload.videoFile) {
    videoUrl = await uploadFileToFirebaseStorage(
      payload.videoFile,
      'video_lectures',
      onProgress
    );
  }

  let thumbnailUrl = (payload.thumbnail_url || payload.thumbnailUrl || '').trim();
  if (payload.thumbnailFile) {
    thumbnailUrl = await uploadFileToFirebaseStorage(
      payload.thumbnailFile,
      'video_thumbnails'
    );
  }
  if (!thumbnailUrl) {
    // Derive YouTube thumbnail if applicable, else sleek physics/chemistry artwork
    const ytMatch = videoUrl.match(
      /(?:youtube\.com\/(?:watch\?v=|embed\/|live\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/
    );
    if (ytMatch) {
      thumbnailUrl = `https://img.youtube.com/vi/${ytMatch[1]}/mqdefault.jpg`;
    } else {
      thumbnailUrl =
        'https://images.unsplash.com/photo-1635070041078-e363dbe005cb?w=400&auto=format&fit=crop&q=80';
    }
  }

  const timestamps = normalizeVideoTimestamps(payload.timestamps);
  const nowIso = new Date().toISOString();

  const record = {
    id,
    title: (payload.title || 'Untitled Lecture').trim(),
    subject: payload.subject || 'Physics',
    chapter: (payload.chapter || 'Core Concepts').trim(),
    exam: payload.exam || (payload.subject === 'Biology' ? 'NEET' : 'JEE'),
    thumbnail_url: thumbnailUrl,
    thumbnailUrl,
    video_url: videoUrl,
    videoUrl,
    timestamps,
    mentorId: payload.mentorId || 'mentor-sumit',
    mentorName: payload.mentorName || 'Sumit (@unfiltereddsumit)',
    companionPdfs: Array.isArray(payload.companionPdfs)
      ? payload.companionPdfs
      : [],
    created_at: payload.created_at || nowIso,
    createdAt: payload.createdAt || nowIso,
  };

  await setDoc(doc(db, 'video_lectures', id), record, { merge: true });
  await setDoc(doc(db, 'videos', id), record, { merge: true });

  await syncEventToWeeklySchedule({
    id: `sched-vid-${id}`,
    title: record.title,
    subject: record.subject,
    eventType: 'lecture',
    targetId: id,
  });

  if (typeof window !== 'undefined' && window.state) {
    const existing = Array.isArray(window.state.videos)
      ? window.state.videos
      : [];
    window.state.videos = [
      record,
      ...existing.filter((v) => v.id !== record.id),
    ];
    try {
      localStorage.setItem('prepskm_state', JSON.stringify(window.state));
    } catch (_e) {}
    if (typeof window.renderDedicatedLecturesView === 'function') {
      window.renderDedicatedLecturesView();
    }
    if (typeof window.renderFeaturedVideos === 'function') {
      window.renderFeaturedVideos();
    }
  }

  return record;
}

export function subscribeVideoLectures(callback) {
  try {
    const q = query(collection(db, 'video_lectures'));
    return onSnapshot(
      q,
      (snap) => {
        const docs = snap.docs
          .map((d) => {
            const data = d.data();
            return {
              id: d.id,
              ...data,
              video_url: data.video_url || data.videoUrl || '',
              videoUrl: data.videoUrl || data.video_url || '',
              thumbnail_url:
                data.thumbnail_url ||
                data.thumbnailUrl ||
                'https://images.unsplash.com/photo-1635070041078-e363dbe005cb?w=400&auto=format&fit=crop&q=80',
              timestamps: normalizeVideoTimestamps(data.timestamps),
            };
          })
          .sort((a, b) =>
            String(b.created_at || b.createdAt || '').localeCompare(
              String(a.created_at || a.createdAt || '')
            )
          );
        callback(docs);
      },
      () => {
        if (typeof window !== 'undefined' && window.state?.videos) {
          callback(window.state.videos);
        }
      }
    );
  } catch (_e) {
    return () => {};
  }
}

export async function deleteVideoLecture(videoId) {
  if (!videoId) return;
  try {
    await deleteDoc(doc(db, 'video_lectures', videoId));
  } catch (_e) {}
  try {
    await deleteDoc(doc(db, 'videos', videoId));
  } catch (_e) {}
}

// ============================================================================
// 3. MENTORS (`mentors`) & ADMIN PROFILE PHOTO
// Document schema: id, name, handle, photo_url, subject_specialization, bio, is_lead_mentor
// ============================================================================

export async function saveMentorProfile(mentorData = {}, photoFile = null) {
  const id =
    mentorData.id ||
    `mentor-${String(mentorData.handle || mentorData.name || Date.now())
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '')}`;

  let photoUrl =
    mentorData.photo_url ||
    mentorData.avatar ||
    '/assets/aistudio/IMG_1422_c0b1f775.png';

  if (photoFile) {
    photoUrl = await uploadFileToFirebaseStorage(photoFile, 'mentor_avatars');
  }

  const name = (mentorData.name || mentorData.fullName || 'Verified Mentor').trim();
  const handle = (
    mentorData.handle ||
    mentorData.telegram ||
    `@${name.split(' ')[0].toLowerCase()}_prep`
  ).trim();
  const subjectSpecialization = (
    mentorData.subject_specialization ||
    (Array.isArray(mentorData.subjects)
      ? mentorData.subjects.join(', ')
      : mentorData.subjects) ||
    'Physics & Exam Strategy'
  ).trim();

  const record = {
    id,
    name,
    fullName: name,
    handle,
    telegram: handle,
    email: mentorData.email || `${handle.replace('@', '')}@prepskm.in`,
    photo_url: photoUrl,
    avatar: photoUrl,
    subject_specialization: subjectSpecialization,
    subjects: subjectSpecialization.split(',').map((s) => s.trim()),
    categories: Array.isArray(mentorData.categories)
      ? mentorData.categories
      : ['JEE', 'NEET'],
    bio: (
      mentorData.bio ||
      `Verified Prepskm Mentor specializing in ${subjectSpecialization}.`
    ).trim(),
    experience:
      mentorData.experience || 'Verified Prepskm Faculty • Top Rank Strategist',
    achievements:
      mentorData.achievements || 'Prepskm Academic Directorate Mentor',
    is_lead_mentor: Boolean(
      mentorData.is_lead_mentor || id === 'mentor-sumit' || handle === '@unfiltereddsumit'
    ),
    updated_at: new Date().toISOString(),
  };

  await setDoc(doc(db, 'mentors', id), record, { merge: true });

  if (typeof window !== 'undefined' && window.state) {
    const existing = Array.isArray(window.state.mentors)
      ? window.state.mentors
      : [];
    const idx = existing.findIndex((m) => m.id === id);
    if (idx >= 0) {
      existing[idx] = { ...existing[idx], ...record };
    } else {
      existing.push(record);
    }
    window.state.mentors = [...existing];
    try {
      localStorage.setItem('prepskm_state', JSON.stringify(window.state));
    } catch (_e) {}
    if (typeof window.renderMentorsDirectory === 'function') {
      window.renderMentorsDirectory();
    }
    if (typeof window.renderAdminMentorsTable === 'function') {
      window.renderAdminMentorsTable();
    }
  }

  return record;
}

export async function updateAdminSumitAvatar(fileOrDataUrl) {
  const uploadedUrl = await uploadFileToFirebaseStorage(
    fileOrDataUrl,
    'admin_profile'
  );
  const resolvedUrl = await resolveCloudFileUrl(uploadedUrl);
  const nowIso = new Date().toISOString();

  await setDoc(
    doc(db, 'mentor_settings', 'profile'),
    {
      name: 'Sumit (@unfiltereddsumit)',
      handle: '@unfiltereddsumit',
      avatarUrl: resolvedUrl,
      rawPointer: uploadedUrl,
      updatedAt: nowIso,
    },
    { merge: true }
  );

  await setDoc(
    doc(db, 'mentors', 'mentor-sumit'),
    {
      id: 'mentor-sumit',
      name: 'Sumit (@unfiltereddsumit)',
      fullName: 'Sumit (@unfiltereddsumit)',
      handle: '@unfiltereddsumit',
      telegram: '@unfiltereddsumit',
      photo_url: resolvedUrl,
      avatar: resolvedUrl,
      subject_specialization: 'Physics, Exam Strategy & Backlog Clearance',
      bio: 'Lead Mentor at Prepskm, mentoring 100k+ JEE & NEET aspirants with high-yield Physics and exam temperament frameworks.',
      is_lead_mentor: true,
      updated_at: nowIso,
    },
    { merge: true }
  );

  if (typeof window !== 'undefined') {
    document.querySelectorAll('.mentor-dynamic-avatar').forEach((img) => {
      img.src = resolvedUrl;
    });
  }

  return resolvedUrl;
}

export function subscribeMentors(callback) {
  try {
    const q = query(collection(db, 'mentors'));
    return onSnapshot(
      q,
      (snap) => {
        const docs = snap.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            ...data,
            name: data.name || data.fullName || 'Mentor',
            fullName: data.fullName || data.name || 'Mentor',
            handle: data.handle || data.telegram || '@prepskm_mentor',
            photo_url:
              data.photo_url ||
              data.avatar ||
              '/assets/aistudio/IMG_1422_c0b1f775.png',
            avatar:
              data.avatar ||
              data.photo_url ||
              '/assets/aistudio/IMG_1422_c0b1f775.png',
            subject_specialization:
              data.subject_specialization ||
              (Array.isArray(data.subjects) ? data.subjects.join(', ') : 'Physics'),
            is_lead_mentor: Boolean(
              data.is_lead_mentor || d.id === 'mentor-sumit'
            ),
          };
        });
        // Sort so lead mentor Sumit is always first
        docs.sort((a, b) => (b.is_lead_mentor ? 1 : 0) - (a.is_lead_mentor ? 1 : 0));
        callback(docs);
      },
      () => {
        if (typeof window !== 'undefined' && window.state?.mentors) {
          callback(window.state.mentors);
        }
      }
    );
  } catch (_e) {
    return () => {};
  }
}

export async function deleteMentorProfile(mentorId) {
  if (!mentorId || mentorId === 'mentor-sumit') return;
  try {
    await deleteDoc(doc(db, 'mentors', mentorId));
  } catch (_e) {}
}

// ============================================================================
// 4. MOCK TESTS (`mock_tests`) & STUDENT RESULTS (`student_results` & `mock_results`)
// ============================================================================

export function subscribeMockTests(callback) {
  try {
    const q = query(collection(db, 'mock_tests'));
    return onSnapshot(
      q,
      (snap) => {
        const list = snap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .sort((a, b) =>
            String(b.created_at || b.createdAt || '').localeCompare(
              String(a.created_at || a.createdAt || '')
            )
          );
        callback(list);
      },
      () => {
        if (typeof window !== 'undefined' && window.state?.mockTests) {
          callback(window.state.mockTests);
        }
      }
    );
  } catch (_e) {
    return () => {};
  }
}

export async function saveStudentTestResult(resultPayload = {}) {
  const id = resultPayload.id || `res-${Date.now()}`;
  const nowIso = new Date().toISOString();
  const record = {
    id,
    totalScore: Number(resultPayload.totalScore || 0),
    maxScore: Number(resultPayload.maxScore || 300),
    accuracy: Number(resultPayload.accuracy ?? resultPayload.accuracyPercentage ?? 0),
    percentile: Number(resultPayload.percentile || 92.5),
    allIndiaRank: Number(
      resultPayload.allIndiaRank ||
        Math.max(1, Math.round((100 - Number(resultPayload.percentile || 92.5)) * 185))
    ),
    exam: resultPayload.exam || 'JEE',
    seriesTitle:
      resultPayload.seriesTitle ||
      resultPayload.testTitle ||
      'Prepskm All India CBT Mock',
    studentName: resultPayload.studentName || 'Prepskm Aspirant',
    studentEmail: resultPayload.studentEmail || '',
    subjectScores: resultPayload.subjectScores || {},
    chapterMistakes: resultPayload.chapterMistakes || {},
    submittedAt: resultPayload.submittedAt || nowIso,
    created_at: nowIso,
  };

  try {
    await setDoc(doc(db, 'student_results', id), record, { merge: true });
    await setDoc(doc(db, 'mock_results', id), record, { merge: true });
  } catch (err) {
    console.warn('Firestore student_results save warning:', err);
  }

  return record;
}

export function subscribeStudentResults(callback) {
  let studentResultsDocs = [];
  let mockResultsDocs = [];

  const emitMerged = () => {
    const map = new Map();
    [...mockResultsDocs, ...studentResultsDocs].forEach((item) => {
      if (item && item.id) {
        map.set(item.id, item);
      }
    });
    const combined = Array.from(map.values()).sort((a, b) =>
      String(b.submittedAt || b.created_at || '').localeCompare(
        String(a.submittedAt || a.created_at || '')
      )
    );
    callback(combined);
  };

  let unsub1 = () => {};
  let unsub2 = () => {};

  try {
    unsub1 = onSnapshot(
      query(collection(db, 'student_results'), limit(50)),
      (snap) => {
        studentResultsDocs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        emitMerged();
      },
      () => emitMerged()
    );
  } catch (_e) {}

  try {
    unsub2 = onSnapshot(
      query(collection(db, 'mock_results'), limit(50)),
      (snap) => {
        mockResultsDocs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        emitMerged();
      },
      () => emitMerged()
    );
  } catch (_e) {}

  return () => {
    unsub1();
    unsub2();
  };
}

if (typeof window !== 'undefined') {
  window.prepskmFirebase = {
    app,
    db,
    auth,
    storage,
    uploadFileToFirebaseStorage,
    uploadStudyMaterial,
    subscribeStudyMaterials,
    deleteStudyMaterial,
    createVideoLecture,
    subscribeVideoLectures,
    deleteVideoLecture,
    normalizeVideoTimestamps,
    saveMentorProfile,
    updateAdminSumitAvatar,
    subscribeMentors,
    deleteMentorProfile,
    subscribeMockTests,
    saveStudentTestResult,
    subscribeStudentResults,
  };
}
