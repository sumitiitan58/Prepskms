import { db } from '../firebase';
import {
  collection,
  doc,
  setDoc,
  getDoc,
  onSnapshot,
  query,
  orderBy,
  limit,
} from 'firebase/firestore';

export const DEFAULT_VERIFIED_MENTORS = [
  {
    id: 'mentor-sumit',
    fullName: 'Sumit (@unfiltereddsumit)',
    handle: '@unfiltereddsumit',
    roleTitle: 'Lead Mentor • JEE & NEET Strategy',
    email: 'unfiltereddsumit@gmail.com',
    telegram: '@unfiltereddsumit',
    categories: ['JEE', 'NEET', 'Class 11-12'],
    subjects: ['Physics', 'Exam Strategy', 'Backlog Clearance'],
    bio: 'Lead Mentor at Prepskm, mentoring 100k+ students with high-yield Physics, rotational mechanics, and exam temperament frameworks.',
    experience: '5+ Years Mentoring • 1,500+ Top Rank Selections',
    achievements: 'Lead Mentor • 100k+ Aspirant Community',
    avatar: '/assets/aistudio/IMG_1422_c0b1f775.png',
  },
  {
    id: 'mentor-neha',
    fullName: 'Dr. Neha Sharma',
    handle: '@neha_prep',
    roleTitle: 'Senior NEET Mentor • AIIMS Gold Medalist',
    email: 'neha.neet@prepskm.com',
    telegram: '@neha_prep',
    categories: ['NEET', 'Class 11-12'],
    subjects: ['Biology', 'Chemistry', 'NCERT Decode'],
    bio: 'AIIMS Gold Medalist & Biology strategist. Expert in 360/360 NCERT line-by-line active recall systems.',
    experience: '4+ Years NEET UG Coaching',
    achievements: 'Mentored 20+ AIR Top 500 Ranks',
    avatar:
      'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=200&auto=format&fit=crop&q=80',
  },
  {
    id: 'mentor-arjun',
    fullName: 'Arjun IITB (AIR 142)',
    handle: '@arjun_iitb',
    roleTitle: 'JEE Advanced Mentor • Mathematics & Physics',
    email: 'arjun.jee@prepskm.com',
    telegram: '@arjun_iitb',
    categories: ['JEE', 'Class 11-12'],
    subjects: ['Mathematics', 'Physics', 'Calculus & Mechanics'],
    bio: 'IIT Bombay CSE Undergrad. Specializes in multi-concept JEE Advanced problem-solving and speed accuracy drills.',
    experience: '3+ Years JEE Main & Advanced Mentoring',
    achievements: 'JEE Advanced AIR 142 • Olympiad Scholar',
    avatar:
      'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80',
  },
];

/**
 * Parses a timestamp string such as "04:15" or "01:02:30" into seconds.
 */
export function parseTimestampToSeconds(timeStr) {
  if (!timeStr) return 0;
  const parts = String(timeStr)
    .trim()
    .split(':')
    .map((n) => parseInt(n, 10) || 0);
  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }
  if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  }
  return parts[0] || 0;
}

/**
 * Parses multiline or array timestamp input like:
 * "04:15 - Derivation of Kinematics Formula\n12:30 - JEE Advanced Problem 1"
 */
export function parseTimestampsInput(rawInput) {
  if (Array.isArray(rawInput)) {
    return rawInput
      .map((item) => ({
        time: item.time || '00:00',
        seconds:
          typeof item.seconds === 'number'
            ? item.seconds
            : parseTimestampToSeconds(item.time || '00:00'),
        label: item.label || item.title || 'Chapter Marker',
      }))
      .sort((a, b) => a.seconds - b.seconds);
  }
  if (!rawInput || typeof rawInput !== 'string') return [];
  return rawInput
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const match = line.match(/^(\d{1,2}:\d{2}(?::\d{2})?)\s*[-–—:]?\s*(.+)$/);
      if (match) {
        return {
          time: match[1],
          seconds: parseTimestampToSeconds(match[1]),
          label: match[2].trim(),
        };
      }
      return null;
    })
    .filter(Boolean)
    .sort((a, b) => a.seconds - b.seconds);
}

/**
 * Automatically adds a scheduled Live Session or Video Lecture to the Weekly Schedule Hub.
 */
export async function syncEventToWeeklySchedule({
  id,
  title,
  subject = 'Physics',
  dateStr,
  timeLabel = '07:00 PM',
  eventType = 'live', // 'live' | 'lecture'
  targetId = null,
}) {
  const resolvedDate =
    dateStr ||
    (window.currentCalendarSelectedDate
      ? window.currentCalendarSelectedDate
      : '2026-11-03');
  const badgePrefix = eventType === 'live' ? '🔴 LIVE' : '🎥 NEW LECTURE';
  const scheduleItem = {
    id: id || `sched-${Date.now()}`,
    date: resolvedDate,
    title: `${badgePrefix}: ${title} (${subject})`,
    rawTitle: title,
    subject,
    timeLabel,
    eventType,
    badgeType: eventType === 'live' ? 'LIVE' : 'NEW_LECTURE',
    targetId: targetId || id,
    isBacklog: false,
    status: 'pending',
    createdAt: new Date().toISOString(),
  };

  try {
    await setDoc(doc(db, 'weekly_schedule', scheduleItem.id), scheduleItem, {
      merge: true,
    });
  } catch (err) {
    console.warn('Weekly schedule cloud sync warning:', err);
  }

  if (window.state) {
    window.state.todos = window.state.todos || [];
    const existingIdx = window.state.todos.findIndex(
      (t) => t.id === scheduleItem.id
    );
    if (existingIdx >= 0) {
      window.state.todos[existingIdx] = scheduleItem;
    } else {
      window.state.todos.unshift(scheduleItem);
    }
    try {
      localStorage.setItem('prepskm_state', JSON.stringify(window.state));
    } catch (_e) {}
    if (typeof window.initWeeklySchedule === 'function') {
      window.initWeeklySchedule();
    }
  }

  return scheduleItem;
}

/**
 * Saves or updates a Student's ₹149/month 1:1 Mentorship Subscription & Permanent Mentor Allocation.
 */
export async function saveUserMentorshipSubscription(userId, subscriptionData) {
  const uid = userId || 'guest-aspirant';
  const payload = {
    uid,
    planPriceInr: 149,
    planInterval: 'monthly',
    status: 'ACTIVE',
    updatedAt: new Date().toISOString(),
    ...subscriptionData,
  };
  try {
    await setDoc(doc(db, 'subscriptions', uid), payload, { merge: true });
    await setDoc(
      doc(db, 'users', uid),
      {
        mentorshipSubscription: payload,
        permanentMentorId: payload.permanentMentorId || null,
        permanentMentorName: payload.permanentMentorName || null,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
  } catch (err) {
    console.warn('Firestore subscription save fallback:', err);
  }
  try {
    localStorage.setItem('prepskm_mentorship_sub', JSON.stringify(payload));
  } catch (_e) {}
  return payload;
}

export function getLocalMentorshipSubscription() {
  try {
    const raw = localStorage.getItem('prepskm_mentorship_sub');
    return raw ? JSON.parse(raw) : null;
  } catch (_e) {
    return null;
  }
}

export function subscribeToUserMentorshipPass(userId, callback) {
  const uid = userId || 'guest-aspirant';
  const local = getLocalMentorshipSubscription();
  if (local) callback(local);

  try {
    return onSnapshot(
      doc(db, 'subscriptions', uid),
      (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          try {
            localStorage.setItem(
              'prepskm_mentorship_sub',
              JSON.stringify(data)
            );
          } catch (_e) {}
          callback(data);
        }
      },
      () => {}
    );
  } catch (_e) {
    return () => {};
  }
}

export const DEFAULT_MENTOR_PROFILE = {
  name: 'Sumit',
  handle: '@unfiltereddsumit',
  avatarUrl: '/assets/aistudio/IMG_1422_c0b1f775.png',
};

export function subscribeToMentorProfile(callback) {
  callback(DEFAULT_MENTOR_PROFILE);
  try {
    return onSnapshot(
      doc(db, 'mentor_settings', 'profile'),
      (snap) => {
        if (snap.exists()) {
          const d = snap.data();
          callback({
            name: d.name || 'Sumit',
            handle: d.handle || '@unfiltereddsumit',
            avatarUrl: d.avatarUrl || '/assets/aistudio/IMG_1422_c0b1f775.png',
          });
        }
      },
      () => {}
    );
  } catch (_e) {
    return () => {};
  }
}

export function subscribeToActiveSession(callback) {
  try {
    return onSnapshot(
      doc(db, 'live_sessions', 'current'),
      (snap) => {
        if (snap.exists()) {
          callback({ id: snap.id, ...snap.data() });
        } else {
          callback(null);
        }
      },
      () => {}
    );
  } catch (_e) {
    return () => {};
  }
}

export async function updateLiveSessionState(partialState) {
  try {
    await setDoc(
      doc(db, 'live_sessions', 'current'),
      {
        ...partialState,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
  } catch (err) {
    console.warn('updateLiveSessionState fallback:', err);
  }
}

export function subscribeToChatMessages(sessionId = 'current', callback) {
  try {
    const q = query(
      collection(db, `live_sessions/${sessionId}/chat`),
      orderBy('createdAt', 'asc'),
      limit(100)
    );
    return onSnapshot(
      q,
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        callback(list);
      },
      () => {}
    );
  } catch (_e) {
    return () => {};
  }
}

export async function sendLiveChatMessage(sessionId = 'current', msgPayload) {
  const id = `msg-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const record = {
    id,
    senderName: msgPayload.senderName || 'Aspirant',
    senderRole: msgPayload.senderRole || 'student',
    senderAvatar: msgPayload.senderAvatar || '',
    text: msgPayload.text || '',
    createdAt: new Date().toISOString(),
  };
  try {
    await setDoc(doc(db, `live_sessions/${sessionId}/chat`, id), record);
  } catch (err) {
    console.warn('sendLiveChatMessage fallback:', err);
  }
  return record;
}

export function subscribeToRaiseHands(sessionId = 'current', callback) {
  try {
    const q = query(collection(db, `live_sessions/${sessionId}/raise_hands`));
    return onSnapshot(
      q,
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        callback(list);
      },
      () => {}
    );
  } catch (_e) {
    return () => {};
  }
}

export async function submitRaiseHandRequest(sessionId = 'current', student) {
  const studentId = student.id || `student-${Date.now()}`;
  const payload = {
    studentId,
    studentName: student.name || 'Aspirant',
    status: 'pending',
    createdAt: new Date().toISOString(),
  };
  try {
    await setDoc(
      doc(db, `live_sessions/${sessionId}/raise_hands`, studentId),
      payload,
      { merge: true }
    );
  } catch (err) {
    console.warn('submitRaiseHandRequest fallback:', err);
  }
  return payload;
}

export async function respondToRaiseHand(
  sessionId = 'current',
  studentId,
  decision
) {
  try {
    await setDoc(
      doc(db, `live_sessions/${sessionId}/raise_hands`, studentId),
      {
        status: decision,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
  } catch (err) {
    console.warn('respondToRaiseHand fallback:', err);
  }
}

if (typeof window !== 'undefined') {
  window.prepskmDb = {
    DEFAULT_VERIFIED_MENTORS,
    DEFAULT_MENTOR_PROFILE,
    parseTimestampToSeconds,
    parseTimestampsInput,
    syncEventToWeeklySchedule,
    saveUserMentorshipSubscription,
    getLocalMentorshipSubscription,
    subscribeToUserMentorshipPass,
    subscribeToMentorProfile,
    subscribeToActiveSession,
    updateLiveSessionState,
    subscribeToChatMessages,
    sendLiveChatMessage,
    subscribeToRaiseHands,
    submitRaiseHandRequest,
    respondToRaiseHand,
  };
}

