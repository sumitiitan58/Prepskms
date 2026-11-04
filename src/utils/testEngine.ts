/**
 * Pure business logic utilities for Prepskm:
 * - NTA Scoring & Analytics
 * - Dynamic Mock Test Assembly (80% MCQ, 20% NAT, strict subject sequencing)
 * - Mentorship Pricing & Cryptographic Token Generation / Verification
 */

export interface TestQuestion {
  id: string;
  type: 'MCQ_SINGLE' | 'MCQ_MULTI' | 'NAT';
  subject: 'Physics' | 'Chemistry' | 'Mathematics' | 'Biology';
  chapter: string;
  exam: 'JEE' | 'NEET';
  difficulty: 'Easy' | 'Medium' | 'Hard';
  correctAnswer: string | string[];
  userAnswer?: string | string[];
  timeSpentSeconds?: number;
}

export interface UserAnswerRecord {
  questionId: string;
  selectedAnswer: string | string[] | null;
  status: 'answered' | 'marked_review' | 'answered_marked' | 'unanswered' | 'unvisited';
  timeSpentSeconds: number;
}

export interface ScoreSummary {
  totalScore: number;
  maxScore: number;
  attemptedCount: number;
  correctCount: number;
  incorrectCount: number;
  unattemptedCount: number;
  accuracyPercentage: number;
  totalTimeSeconds: number;
  subjectScores: Record<string, { score: number; maxScore: number; correct: number; incorrect: number }>;
  aiRecommendations: string[];
}

/**
 * Calculates NTA CBT Score:
 * Correct MCQ: +4, Incorrect: -1, Unattempted: 0
 * Correct NAT: +4, Incorrect: -1 (or 0 for legacy), Unattempted: 0 (default: +4 / -1 as per latest NTA JEE Main pattern)
 */
export function calculateNtaScore(
  questions: TestQuestion[],
  answers: Record<string, UserAnswerRecord>
): ScoreSummary {
  let totalScore = 0;
  let correctCount = 0;
  let incorrectCount = 0;
  let attemptedCount = 0;
  let unattemptedCount = 0;
  let totalTimeSeconds = 0;

  const subjectScores: Record<string, { score: number; maxScore: number; correct: number; incorrect: number }> = {};

  questions.forEach((q) => {
    if (!subjectScores[q.subject]) {
      subjectScores[q.subject] = { score: 0, maxScore: 0, correct: 0, incorrect: 0 };
    }
    subjectScores[q.subject].maxScore += 4;

    const record = answers[q.id];
    const userAns = record?.selectedAnswer;
    const timeSpent = record?.timeSpentSeconds || 0;
    totalTimeSeconds += timeSpent;

    const isAttempted =
      userAns !== undefined &&
      userAns !== null &&
      (Array.isArray(userAns) ? userAns.length > 0 : String(userAns).trim() !== '');

    if (!isAttempted) {
      unattemptedCount++;
      return;
    }

    attemptedCount++;
    let isCorrect = false;

    if (q.type === 'MCQ_SINGLE') {
      isCorrect = String(userAns).trim().toUpperCase() === String(q.correctAnswer).trim().toUpperCase();
    } else if (q.type === 'MCQ_MULTI') {
      const userArr = Array.isArray(userAns) ? [...userAns].sort() : [String(userAns)];
      const corrArr = Array.isArray(q.correctAnswer) ? [...q.correctAnswer].sort() : [String(q.correctAnswer)];
      isCorrect =
        userArr.length === corrArr.length &&
        userArr.every((val, idx) => String(val).toUpperCase() === String(corrArr[idx]).toUpperCase());
    } else if (q.type === 'NAT') {
      // Numerical: allow tolerance or exact float
      const userNum = parseFloat(String(userAns).trim());
      const corrNum = parseFloat(String(q.correctAnswer).trim());
      if (!isNaN(userNum) && !isNaN(corrNum)) {
        isCorrect = Math.abs(userNum - corrNum) < 0.05;
      } else {
        isCorrect = String(userAns).trim() === String(q.correctAnswer).trim();
      }
    }

    if (isCorrect) {
      totalScore += 4;
      correctCount++;
      subjectScores[q.subject].score += 4;
      subjectScores[q.subject].correct += 1;
    } else {
      totalScore -= 1;
      incorrectCount++;
      subjectScores[q.subject].score -= 1;
      subjectScores[q.subject].incorrect += 1;
    }
  });

  const maxScore = questions.length * 4;
  const accuracyPercentage =
    attemptedCount > 0 ? Math.round((correctCount / attemptedCount) * 100) : 0;

  // Generate strategic AI recommendations based on performance
  const aiRecommendations: string[] = [];
  if (accuracyPercentage >= 85) {
    aiRecommendations.push(
      'Outstanding precision (>85%). Focus next on reducing average solve time to under 1.5 min per question.'
    );
  } else if (accuracyPercentage < 60) {
    aiRecommendations.push(
      'High negative marking detected. Reinforce option-elimination tactics and avoid speculative guesses in NAT questions.'
    );
  }

  // Check subject gaps
  for (const [subj, data] of Object.entries(subjectScores)) {
    const subjAcc = data.correct + data.incorrect > 0 ? (data.correct / (data.correct + data.incorrect)) * 100 : 0;
    if (subjAcc < 50) {
      aiRecommendations.push(`Priority revision required in ${subj}: Accuracy was ${Math.round(subjAcc)}%. Review high-yield formula sheets.`);
    }
  }

  if (aiRecommendations.length === 0) {
    aiRecommendations.push('Solid foundational performance. Practice mixed multi-concept problems to solidify 99+ percentile ranks.');
  }

  return {
    totalScore,
    maxScore,
    attemptedCount,
    correctCount,
    incorrectCount,
    unattemptedCount,
    accuracyPercentage,
    totalTimeSeconds,
    subjectScores,
    aiRecommendations,
  };
}

/**
 * Validates mock test generation constraints:
 * - Min 10 questions for 10 chapters, min 20 for 20 chapters, min 75 for full syllabus
 * - Subject order: Physics -> Chemistry -> Math (JEE) or Physics -> Chemistry -> Bio (NEET)
 * - Composition: Exactly 20% NAT and 80% MCQ
 */
export function validateMockTestConstraints(
  exam: 'JEE' | 'NEET',
  chapterCount: number,
  requestedQuestionCount: number
): { valid: boolean; minRequired: number; error?: string } {
  let minRequired = 10;
  if (chapterCount >= 20) {
    minRequired = 20;
  }
  if (chapterCount >= 60 || chapterCount === 0) {
    // Full syllabus
    minRequired = exam === 'JEE' ? 75 : 180;
  }

  if (requestedQuestionCount < minRequired) {
    return {
      valid: false,
      minRequired,
      error: `For ${chapterCount} selected chapters, minimum question count is ${minRequired}. You selected ${requestedQuestionCount}.`,
    };
  }

  return { valid: true, minRequired };
}

/**
 * Assembles question distribution:
 * Orders subjects: Physics -> Chemistry -> Mathematics (JEE) or Physics -> Chemistry -> Biology (NEET)
 * Ensures 80% MCQ, 20% NAT
 */
export function assembleTestComposition(
  questionsPool: TestQuestion[],
  exam: 'JEE' | 'NEET',
  totalCount: number
): TestQuestion[] {
  const subjectOrder: ('Physics' | 'Chemistry' | 'Mathematics' | 'Biology')[] =
    exam === 'JEE' ? ['Physics', 'Chemistry', 'Mathematics'] : ['Physics', 'Chemistry', 'Biology'];

  const natCount = Math.round(totalCount * 0.2);
  const mcqCount = totalCount - natCount;

  const mcqs = questionsPool.filter((q) => q.type === 'MCQ_SINGLE' || q.type === 'MCQ_MULTI');
  const nats = questionsPool.filter((q) => q.type === 'NAT');

  const selectedMcqs = mcqs.slice(0, mcqCount);
  const selectedNats = nats.slice(0, natCount);

  // If pool has fewer NATs or MCQs, fill remaining from available pool
  const selected = [...selectedMcqs, ...selectedNats];
  if (selected.length < totalCount) {
    const remaining = questionsPool.filter((q) => !selected.includes(q)).slice(0, totalCount - selected.length);
    selected.push(...remaining);
  }

  // Sort by defined NTA subject order
  selected.sort((a, b) => {
    const orderA = subjectOrder.indexOf(a.subject);
    const orderB = subjectOrder.indexOf(b.subject);
    if (orderA !== orderB) return orderA - orderB;
    // Keep MCQs first, NATs last in each subject
    if (a.type === 'NAT' && b.type !== 'NAT') return 1;
    if (a.type !== 'NAT' && b.type === 'NAT') return -1;
    return 0;
  });

  return selected.slice(0, totalCount);
}

/**
 * 1:1 Mentorship Pricing Calculator
 * Flat ₹5 per minute
 */
export function calculateMentorshipPrice(minutes: number): number {
  if (minutes < 0) return 0;
  return minutes * 5;
}

/**
 * Generates official Prepskm Token Code (e.g., PSKM-JEE-84920)
 */
export function generateMentorshipToken(exam: 'JEE' | 'NEET' | 'CLASS', studentName: string): string {
  const cleanName = studentName.replace(/[^A-Za-z]/g, '').substring(0, 3).toUpperCase() || 'STD';
  const randomNum = Math.floor(10000 + Math.random() * 90000);
  const examTag = exam === 'JEE' ? 'JEE' : exam === 'NEET' ? 'NEET' : 'GEN';
  return `PSKM-${examTag}-${cleanName}${randomNum}`;
}

export interface MentorshipTokenRecord {
  tokenCode: string;
  studentName: string;
  studentEmail: string;
  studentTelegram?: string;
  mentorName: string;
  durationMinutes: number;
  amountPaid: number;
  targetExam: string;
  status: 'AUTHENTIC' | 'REVOKED';
  createdAt: string;
}

/**
 * Validates a mentorship token against the database
 */
export function verifyMentorshipToken(
  tokenCode: string,
  records: MentorshipTokenRecord[]
): { isAuthentic: boolean; record?: MentorshipTokenRecord; reason?: string } {
  const trimmed = tokenCode.trim().toUpperCase();
  if (!trimmed.startsWith('PSKM-')) {
    return { isAuthentic: false, reason: 'Invalid token format. Must start with PSKM-' };
  }

  const match = records.find((r) => r.tokenCode.toUpperCase() === trimmed);
  if (!match) {
    return { isAuthentic: false, reason: 'Token not found in official Prepskm registry.' };
  }

  if (match.status !== 'AUTHENTIC') {
    return { isAuthentic: false, record: match, reason: 'Token has been revoked or expired.' };
  }

  return { isAuthentic: true, record: match };
}

export interface UserProfileData {
  uid: string;
  name: string;
  email: string;
  gradeLevel: 'Class 9' | 'Class 10' | 'Class 11' | 'Class 12' | 'Dropper';
  targetExams: ('JEE Main' | 'JEE Advanced' | 'NEET UG' | 'Foundation Olympiad')[];
  targetYear?: string;
  telegram?: string;
  dailyGoalHours?: number;
  bio?: string;
  updatedAt?: string;
}

export function validateUserProfile(data: Partial<UserProfileData>): { valid: boolean; error?: string } {
  if (!data.name || data.name.trim().length < 2) {
    return { valid: false, error: 'Name must be at least 2 characters.' };
  }
  if (!data.gradeLevel) {
    return { valid: false, error: 'Please select a valid grade level.' };
  }
  if (!data.targetExams || data.targetExams.length === 0) {
    return { valid: false, error: 'Please select at least one target exam.' };
  }
  return { valid: true };
}

export interface ForumTopic {
  id: string;
  title: string;
  content: string;
  category: 'General Discussion' | 'Physics Doubts' | 'Chemistry Concepts' | 'Maths Tricks' | 'NEET Biology' | 'Strategy & Mentorship';
  authorName: string;
  authorUid: string;
  upvotedBy: string[];
  downvotedBy: string[];
  replyCount: number;
  createdAt: string;
}

export function calculateNetVoteScore(upvotedBy: string[] = [], downvotedBy: string[] = []): number {
  return (upvotedBy?.length || 0) - (downvotedBy?.length || 0);
}

export function toggleVote(
  userId: string,
  type: 'up' | 'down',
  upvotedBy: string[] = [],
  downvotedBy: string[] = []
): { upvotedBy: string[]; downvotedBy: string[]; netScore: number } {
  let newUp = [...upvotedBy];
  let newDown = [...downvotedBy];

  if (type === 'up') {
    if (newUp.includes(userId)) {
      // Toggle off
      newUp = newUp.filter((id) => id !== userId);
    } else {
      newUp.push(userId);
      newDown = newDown.filter((id) => id !== userId);
    }
  } else if (type === 'down') {
    if (newDown.includes(userId)) {
      // Toggle off
      newDown = newDown.filter((id) => id !== userId);
    } else {
      newDown.push(userId);
      newUp = newUp.filter((id) => id !== userId);
    }
  }

  return {
    upvotedBy: newUp,
    downvotedBy: newDown,
    netScore: newUp.length - newDown.length,
  };
}

export function sortForumTopics(topics: ForumTopic[], sortBy: 'recent' | 'top' | 'replies'): ForumTopic[] {
  const sorted = [...topics];
  if (sortBy === 'recent') {
    return sorted.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }
  if (sortBy === 'top') {
    return sorted.sort((a, b) => {
      const scoreA = calculateNetVoteScore(a.upvotedBy, a.downvotedBy);
      const scoreB = calculateNetVoteScore(b.upvotedBy, b.downvotedBy);
      return scoreB - scoreA;
    });
  }
  if (sortBy === 'replies') {
    return sorted.sort((a, b) => b.replyCount - a.replyCount);
  }
  return sorted;
}

export interface StudyTask {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD
  isBacklog: boolean;
  status: 'pending' | 'in_progress' | 'completed';
}

export interface StreakMilestone {
  tierName: string;
  badgeIcon: string;
  minDays: number;
  nextMilestoneDays: number;
  description: string;
  flameLevel: 'low' | 'medium' | 'high' | 'ultra';
}

export interface StudyStreakResult {
  currentStreak: number;
  isTodayCompleted: boolean;
  activeTier: StreakMilestone;
  nextTier?: StreakMilestone;
  progressToNextTier: number; // 0 to 100
  totalCompletedTasks: number;
  consecutiveDates: string[];
  motivationalQuote: string;
}

export const STREAK_TIERS: StreakMilestone[] = [
  { tierName: 'Aspirant Starter', badgeIcon: '🌱', minDays: 0, nextMilestoneDays: 1, description: 'Complete a task today to ignite your streak!', flameLevel: 'low' },
  { tierName: 'Seedling Focus', badgeIcon: '🌿', minDays: 1, nextMilestoneDays: 3, description: 'Consistency is building. Keep the fire burning!', flameLevel: 'low' },
  { tierName: 'Iron Will', badgeIcon: '⚡', minDays: 3, nextMilestoneDays: 7, description: 'Unstoppable momentum. Daily discipline beats talent!', flameLevel: 'medium' },
  { tierName: 'Relentless Ranker', badgeIcon: '🔥', minDays: 7, nextMilestoneDays: 14, description: 'Top 1% discipline! Your JEE/NEET rank is forged here.', flameLevel: 'high' },
  { tierName: 'AIR 1 Contender', badgeIcon: '🏆', minDays: 14, nextMilestoneDays: 30, description: 'Elite mastery. Two straight weeks of zero excuses!', flameLevel: 'ultra' },
  { tierName: 'Legend of Prepskm', badgeIcon: '👑', minDays: 30, nextMilestoneDays: 30, description: 'God-tier discipline. You are the benchmark.', flameLevel: 'ultra' },
];

export function calculateStudyStreak(
  tasks: StudyTask[],
  referenceDateStr: string = '2026-11-03'
): StudyStreakResult {
  const completedTasks = (tasks || []).filter((t) => t.status === 'completed');
  const completedDatesSet = new Set<string>();
  completedTasks.forEach((t) => {
    if (t.date) completedDatesSet.add(t.date);
  });

  const refDate = new Date(referenceDateStr + 'T00:00:00Z');
  const isTodayCompleted = completedDatesSet.has(referenceDateStr);

  let currentStreak = 0;
  const consecutiveDates: string[] = [];

  // Start from today if today has a completed task; otherwise check from yesterday so active streak is preserved during today's study session
  let checkDate = new Date(refDate);
  if (!isTodayCompleted) {
    checkDate.setUTCDate(checkDate.getUTCDate() - 1);
  }

  while (true) {
    const dateStr = checkDate.toISOString().split('T')[0];
    if (completedDatesSet.has(dateStr)) {
      currentStreak++;
      consecutiveDates.push(dateStr);
      checkDate.setUTCDate(checkDate.getUTCDate() - 1);
    } else {
      break;
    }
  }

  // Find active tier
  let activeTier = STREAK_TIERS[0];
  let nextTier = STREAK_TIERS[1];

  for (let i = STREAK_TIERS.length - 1; i >= 0; i--) {
    if (currentStreak >= STREAK_TIERS[i].minDays) {
      activeTier = STREAK_TIERS[i];
      nextTier = STREAK_TIERS[i + 1] || undefined;
      break;
    }
  }

  let progressToNextTier = 100;
  if (nextTier) {
    const range = nextTier.minDays - activeTier.minDays;
    const currentProgress = currentStreak - activeTier.minDays;
    progressToNextTier = Math.min(100, Math.max(0, Math.round((currentProgress / range) * 100)));
  }

  const quotes = [
    'One day or day one — you decide.',
    'Consistency creates rankers. Excuses create dropouts.',
    'Every completed problem brings you 1 rank closer to your dream IIT/AIIMS.',
    'Small daily disciplines repeated consistently lead to monumental results.',
  ];
  const motivationalQuote = quotes[currentStreak % quotes.length];

  return {
    currentStreak,
    isTodayCompleted,
    activeTier,
    nextTier,
    progressToNextTier,
    totalCompletedTasks: completedTasks.length,
    consecutiveDates,
    motivationalQuote,
  };
}

/**
 * 9. Formula Blitz (60s CBT Rush) Score & Streak Multiplier Engine
 */
export interface BlitzScoreState {
  score: number;
  streak: number;
  maxStreak: number;
  pointsEarned: number;
  streakBadgeText: string;
}

export function calculateBlitzScoreUpdate(
  currentScore: number,
  currentStreak: number,
  currentMaxStreak: number,
  isCorrect: boolean
): BlitzScoreState {
  if (!isCorrect) {
    return {
      score: currentScore,
      streak: 0,
      maxStreak: currentMaxStreak,
      pointsEarned: 0,
      streakBadgeText: '',
    };
  }

  const nextStreak = currentStreak + 1;
  const pointsEarned = nextStreak >= 3 ? 25 : 10;
  const nextScore = currentScore + pointsEarned;
  const nextMaxStreak = Math.max(currentMaxStreak, nextStreak);
  const streakBadgeText = nextStreak >= 2 ? `🔥 ${nextStreak}x Streak!` : '';

  return {
    score: nextScore,
    streak: nextStreak,
    maxStreak: nextMaxStreak,
    pointsEarned,
    streakBadgeText,
  };
}

/**
 * 10. Role-Based Access Control (Admin vs Student) Verification
 */
export function isAuthorizedAdmin(
  email: string | null | undefined,
  isPinUnlocked: boolean,
  superAdminEmails: string[]
): boolean {
  if (isPinUnlocked) return true;
  if (!email) return false;
  const normalized = email.trim().toLowerCase();
  return superAdminEmails.some((adminEmail) => adminEmail.trim().toLowerCase() === normalized);
}

/**
 * 11. Jitsi Meet Room Name Sanitizer for Group Mentorship & 1-on-1 Calling
 */
export function buildJitsiRoomName(
  mode: 'group' | 'direct',
  identifier: string
): string {
  const cleanId = (identifier || 'Session')
    .replace(/[^a-zA-Z0-9]/g, '')
    .slice(0, 32) || 'DefaultRoom';
  return mode === 'group'
    ? `PrepskmLiveMentorship_${cleanId}`
    : `Prepskm1on1Call_${cleanId}`;
}

/**
 * 12. Study Material PDF URL Sanitizer (prevents custom File/Blob objects from reaching Firestore)
 */
export function normalizeStudyMaterialUrl(
  rawUrlOrFile: unknown,
  fallbackId = 'material'
): string {
  if (typeof rawUrlOrFile === 'string') {
    const trimmed = rawUrlOrFile.trim();
    if (
      trimmed === '[object Object]' ||
      trimmed === '[object File]' ||
      trimmed === '[object Blob]'
    ) {
      return `#prepskm-local-file:${fallbackId}`;
    }
    return trimmed;
  }
  return `#prepskm-local-file:${fallbackId}`;
}

/**
 * 13. Swipeable Solution Navigator for Mock Test Results
 */
export function stepSolutionIndex(
  currentIndex: number,
  totalQuestions: number,
  direction: 'next' | 'prev' | number
): number {
  if (totalQuestions <= 0) return 0;
  if (typeof direction === 'number') {
    return Math.max(0, Math.min(totalQuestions - 1, Math.floor(direction)));
  }
  if (direction === 'next') {
    return (currentIndex + 1) % totalQuestions;
  }
  return (currentIndex - 1 + totalQuestions) % totalQuestions;
}

/**
 * 14. E-Certificate Metadata Builder for Completed Mock Tests
 */
export interface MockCertificateMetadata {
  certificateId: string;
  studentName: string;
  studentEmail: string;
  testTitle: string;
  scoreLabel: string;
  accuracyLabel: string;
  percentileLabel: string;
  gradeBadge: string;
  issuedDate: string;
  signedBy: string;
}

export function buildMockCertificateMetadata(params: {
  studentName?: string;
  studentEmail?: string;
  testTitle?: string;
  totalScore: number;
  maxScore: number;
  accuracy: number;
  percentile: number;
  dateStr?: string;
}): MockCertificateMetadata {
  const safeMax = Math.max(1, params.maxScore || 300);
  const ratio = Math.max(0, Math.min(1, params.totalScore / safeMax));
  let gradeBadge = 'Distinguished Aspirant';
  if (ratio >= 0.85 || params.percentile >= 98) {
    gradeBadge = 'All India Topper Distinction';
  } else if (ratio >= 0.65 || params.percentile >= 90) {
    gradeBadge = 'Merit Scholar Excellence';
  }
  const cleanDate = params.dateStr || new Date().toISOString().slice(0, 10);
  const hashSeed = Math.abs(
    Math.round((params.totalScore + 17) * 137 + safeMax * 19 + (params.accuracy || 0) * 11)
  );
  return {
    certificateId: `PREPSKM-CERT-${cleanDate.replace(/-/g, '')}-${hashSeed}`,
    studentName: (params.studentName || 'Prepskm Aspirant').trim(),
    studentEmail: (params.studentEmail || '').trim(),
    testTitle: (params.testTitle || 'Official Prepskm CBT Mock Test').trim(),
    scoreLabel: `${params.totalScore} / ${safeMax}`,
    accuracyLabel: `${Math.round(params.accuracy || 0)}%`,
    percentileLabel: `${Number(params.percentile || 0).toFixed(1)}%ile`,
    gradeBadge,
    issuedDate: cleanDate,
    signedBy: 'Sumit (@unfiltereddsumit) • Lead Mentor, Prepskm',
  };
}

/**
 * 15. Whitelabel Provider Sanitizer (hides Jitsi / YouTube provider names from non-admin students)
 */
export function sanitizeLiveProviderLabel(
  rawText: string,
  isAdmin: boolean
): string {
  if (!rawText) return '';
  if (isAdmin) return rawText;
  return rawText
    .replace(/jitsi\s*meet/gi, 'Prepskm Live Stream')
    .replace(/jitsi/gi, 'Prepskm Live')
    .replace(/meet\.jit\.si/gi, 'live.prepskm.in')
    .replace(/youtube/gi, 'Prepskm HD Video')
    .replace(/\bYT\b/g, 'Prepskm HD');
}

/**
 * 16. HTML5 Browser History Route Resolver for Multi-Page Navigation
 */
export interface PlatformRouteResolution {
  viewId: string;
  subTab: string | null;
  canonicalPath: string;
}

export function resolvePlatformRoute(pathname: string): PlatformRouteResolution {
  const clean = (pathname || '/').replace(/\/+$/, '') || '/';
  const lower = clean.toLowerCase();

  const map: Record<string, PlatformRouteResolution> = {
    '/': { viewId: 'home', subTab: null, canonicalPath: '/' },
    '/home': { viewId: 'home', subTab: null, canonicalPath: '/' },
    '/videos': { viewId: 'lectures', subTab: null, canonicalPath: '/videos' },
    '/lectures': { viewId: 'lectures', subTab: null, canonicalPath: '/videos' },
    '/notes': { viewId: 'materials', subTab: null, canonicalPath: '/notes' },
    '/materials': { viewId: 'materials', subTab: null, canonicalPath: '/notes' },
    '/tests': { viewId: 'mock-test', subTab: 'cbt', canonicalPath: '/tests' },
    '/mock-test': { viewId: 'mock-test', subTab: 'cbt', canonicalPath: '/tests' },
    '/analytics': { viewId: 'mock-test', subTab: 'analytics', canonicalPath: '/analytics' },
    '/live': { viewId: 'live', subTab: null, canonicalPath: '/live' },
    '/mentors': { viewId: 'mentorship', subTab: null, canonicalPath: '/mentors' },
    '/mentorship': { viewId: 'mentorship', subTab: null, canonicalPath: '/mentors' },
    '/admin': { viewId: 'admin', subTab: null, canonicalPath: '/admin' },
    '/forum': { viewId: 'forum', subTab: null, canonicalPath: '/forum' },
    '/chat': { viewId: 'chat', subTab: null, canonicalPath: '/chat' },
    '/profile': { viewId: 'profile', subTab: null, canonicalPath: '/profile' },
  };

  return map[lower] || { viewId: 'home', subTab: null, canonicalPath: '/' };
}

/**
 * 17. Strict Student Viewer Jitsi Meet Config Builder
 */
export interface StrictStudentJitsiConfig {
  startWithAudioMuted: boolean;
  startWithVideoMuted: boolean;
  prejoinPageEnabled: boolean;
  whiteboard: { enabled: boolean };
  toolbarButtons: string[];
}

export function getStrictStudentJitsiConfig(
  hasStagePermission: boolean = false
): StrictStudentJitsiConfig {
  return {
    startWithAudioMuted: true,
    startWithVideoMuted: true,
    prejoinPageEnabled: false,
    whiteboard: { enabled: false },
    toolbarButtons: hasStagePermission
      ? ['microphone', 'camera', 'chat', 'raisehand', 'fullscreen']
      : ['chat', 'raisehand', 'fullscreen'],
  };
}

/**
 * 18. Chapter-Level Weakness Identifier from Negative Marks Lost
 */
export interface WeakChapterTag {
  chapter: string;
  mistakes: number;
  negativeMarksLost: number;
  severity: 'CRITICAL' | 'MODERATE';
}

export function identifyWeakChaptersFromMistakes(
  results: Array<{ chapterMistakes?: Record<string, number> }>
): WeakChapterTag[] {
  const aggregate: Record<string, number> = {};
  (results || []).forEach((r) => {
    if (r && r.chapterMistakes && typeof r.chapterMistakes === 'object') {
      Object.entries(r.chapterMistakes).forEach(([ch, count]) => {
        const num = Number(count) || 0;
        if (num > 0) {
          aggregate[ch] = (aggregate[ch] || 0) + num;
        }
      });
    }
  });

  return Object.entries(aggregate)
    .map(([chapter, mistakes]) => ({
      chapter,
      mistakes,
      negativeMarksLost: mistakes,
      severity: (mistakes >= 4 ? 'CRITICAL' : 'MODERATE') as 'CRITICAL' | 'MODERATE',
    }))
    .sort((a, b) => b.mistakes - a.mistakes);
}

/**
 * 19. Firebase Authentication Error Formatter (explicit cross-device user-friendly messages)
 */
export function formatFirebaseAuthError(rawError: unknown): string {
  const text =
    typeof rawError === 'string'
      ? rawError
      : (rawError as { code?: string; message?: string })?.code ||
        (rawError as { message?: string })?.message ||
        '';
  const lower = String(text).toLowerCase();

  if (
    lower.includes('auth/invalid-credential') ||
    lower.includes('auth/wrong-password') ||
    lower.includes('auth/user-not-found') ||
    lower.includes('invalid-login-credentials')
  ) {
    return 'Invalid email or password. Please verify your credentials or reset your password.';
  }
  if (lower.includes('auth/email-already-in-use')) {
    return 'This email is already registered on Prepskm. Please switch to Login instead.';
  }
  if (lower.includes('auth/weak-password')) {
    return 'Password is too weak. Please enter at least 6 characters.';
  }
  if (lower.includes('auth/popup-blocked')) {
    return 'Sign-in popup was blocked by your browser. Please allow popups for prepskm.in or use Email/Password login.';
  }
  if (lower.includes('auth/popup-closed-by-user')) {
    return 'Google sign-in window was closed before completing authentication.';
  }
  if (lower.includes('auth/network-request-failed')) {
    return 'Network connection error. Please check your internet connection and try again.';
  }
  if (lower.includes('auth/too-many-requests')) {
    return 'Too many failed attempts. Please wait a minute before trying again.';
  }
  return text ? `Authentication error: ${String(text).replace(/^Firebase:\s*/i, '')}` : 'Authentication failed. Please try again.';
}

/**
 * 20. Advanced Video Player 10-Second Double-Tap Skip Calculator
 */
export function calculateVideoSkipTime(
  currentTimeSeconds: number,
  durationSeconds: number,
  direction: 'left' | 'right',
  skipStepSeconds: number = 10
): number {
  const safeCurrent = Math.max(0, Number(currentTimeSeconds) || 0);
  const safeDuration = Math.max(0, Number(durationSeconds) || 0);
  const delta = direction === 'left' ? -Math.abs(skipStepSeconds) : Math.abs(skipStepSeconds);
  const target = safeCurrent + delta;
  if (safeDuration > 0) {
    return Math.max(0, Math.min(safeDuration, target));
  }
  return Math.max(0, target);
}

/**
 * 21. CBT Question Palette Status Counter (Answered, Marked for Review, Unanswered)
 */
export interface CbtPaletteSummary {
  answeredCount: number;
  markedReviewCount: number;
  unansweredCount: number;
}

export function computeCbtPaletteCounts(
  questionIds: string[],
  answersMap: Record<string, { selectedAnswer?: string | string[] | null; markedForReview?: boolean }>
): CbtPaletteSummary {
  let answeredCount = 0;
  let markedReviewCount = 0;
  let unansweredCount = 0;

  (questionIds || []).forEach((qId) => {
    const entry = answersMap?.[qId];
    const hasAnswer =
      entry?.selectedAnswer !== undefined &&
      entry?.selectedAnswer !== null &&
      String(entry.selectedAnswer).trim() !== '';
    const isMarked = Boolean(entry?.markedForReview);

    if (isMarked) {
      markedReviewCount++;
    }
    if (hasAnswer) {
      answeredCount++;
    } else if (!isMarked) {
      unansweredCount++;
    }
  });

  return {
    answeredCount,
    markedReviewCount,
    unansweredCount,
  };
}
