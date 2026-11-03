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

