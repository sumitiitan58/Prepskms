import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateNtaScore,
  validateMockTestConstraints,
  assembleTestComposition,
  calculateMentorshipPrice,
  generateMentorshipToken,
  verifyMentorshipToken,
  validateUserProfile,
  calculateNetVoteScore,
  toggleVote,
  sortForumTopics,
  calculateStudyStreak,
  TestQuestion,
  UserAnswerRecord,
  MentorshipTokenRecord,
} from './testEngine';

test('NTA Score calculation: +4 for correct, -1 for incorrect, 0 for unattempted', () => {
  const sampleQuestions: TestQuestion[] = [
    {
      id: 'q1',
      type: 'MCQ_SINGLE',
      subject: 'Physics',
      chapter: 'Kinematics',
      exam: 'JEE',
      difficulty: 'Easy',
      correctAnswer: 'B',
    },
    {
      id: 'q2',
      type: 'MCQ_SINGLE',
      subject: 'Physics',
      chapter: 'Thermodynamics',
      exam: 'JEE',
      difficulty: 'Medium',
      correctAnswer: 'A',
    },
    {
      id: 'q3',
      type: 'NAT',
      subject: 'Chemistry',
      chapter: 'Mole Concept',
      exam: 'JEE',
      difficulty: 'Medium',
      correctAnswer: '25.0',
    },
    {
      id: 'q4',
      type: 'MCQ_SINGLE',
      subject: 'Mathematics',
      chapter: 'Calculus',
      exam: 'JEE',
      difficulty: 'Hard',
      correctAnswer: 'D',
    },
  ];

  const answers: Record<string, UserAnswerRecord> = {
    q1: { questionId: 'q1', selectedAnswer: 'B', status: 'answered', timeSpentSeconds: 45 }, // Correct (+4)
    q2: { questionId: 'q2', selectedAnswer: 'C', status: 'answered', timeSpentSeconds: 60 }, // Incorrect (-1)
    q3: { questionId: 'q3', selectedAnswer: '25.02', status: 'answered', timeSpentSeconds: 90 }, // Correct NAT within tolerance (+4)
    // q4 unattempted (0)
  };

  const result = calculateNtaScore(sampleQuestions, answers);

  assert.equal(result.attemptedCount, 3);
  assert.equal(result.unattemptedCount, 1);
  assert.equal(result.correctCount, 2);
  assert.equal(result.incorrectCount, 1);
  // Score: +4 -1 +4 = 7 out of 16
  assert.equal(result.totalScore, 7);
  assert.equal(result.maxScore, 16);
  assert.equal(result.accuracyPercentage, Math.round((2 / 3) * 100)); // 67%
});

test('Mock test constraints: minimum questions based on chapter counts', () => {
  // 5 chapters -> min 10
  const c1 = validateMockTestConstraints('JEE', 5, 8);
  assert.equal(c1.valid, false);
  assert.equal(c1.minRequired, 10);

  const c2 = validateMockTestConstraints('JEE', 10, 15);
  assert.equal(c2.valid, true);

  // 25 chapters -> min 20
  const c3 = validateMockTestConstraints('JEE', 25, 15);
  assert.equal(c3.valid, false);
  assert.equal(c3.minRequired, 20);

  // Full syllabus (0 or 60+ chapters) -> min 75 for JEE
  const c4 = validateMockTestConstraints('JEE', 0, 75);
  assert.equal(c4.valid, true);
  assert.equal(c4.minRequired, 75);
});

test('Test composition: 80% MCQ, 20% NAT and subject ordering', () => {
  const pool: TestQuestion[] = [
    { id: 'm1', type: 'MCQ_SINGLE', subject: 'Mathematics', chapter: 'Algebra', exam: 'JEE', difficulty: 'Easy', correctAnswer: 'A' },
    { id: 'p1', type: 'MCQ_SINGLE', subject: 'Physics', chapter: 'Mechanics', exam: 'JEE', difficulty: 'Easy', correctAnswer: 'A' },
    { id: 'c1', type: 'MCQ_SINGLE', subject: 'Chemistry', chapter: 'Organic', exam: 'JEE', difficulty: 'Easy', correctAnswer: 'A' },
    { id: 'p_nat', type: 'NAT', subject: 'Physics', chapter: 'Optics', exam: 'JEE', difficulty: 'Hard', correctAnswer: '4' },
    { id: 'c_nat', type: 'NAT', subject: 'Chemistry', chapter: 'Physical', exam: 'JEE', difficulty: 'Medium', correctAnswer: '10' },
  ];

  const assembled = assembleTestComposition(pool, 'JEE', 5);
  assert.equal(assembled.length, 5);

  // Check subject order: Physics must come before Chemistry, Chemistry before Mathematics
  const physicsIdx = assembled.findIndex((q) => q.subject === 'Physics');
  const chemIdx = assembled.findIndex((q) => q.subject === 'Chemistry');
  const mathIdx = assembled.findIndex((q) => q.subject === 'Mathematics');

  assert.ok(physicsIdx < chemIdx, 'Physics should precede Chemistry');
  assert.ok(chemIdx < mathIdx, 'Chemistry should precede Mathematics');
});

test('Mentorship pricing: flat ₹5 per minute', () => {
  assert.equal(calculateMentorshipPrice(15), 75);
  assert.equal(calculateMentorshipPrice(30), 150);
  assert.equal(calculateMentorshipPrice(45), 225);
  assert.equal(calculateMentorshipPrice(60), 300);
});

test('Mentorship token generation and authentication', () => {
  const token = generateMentorshipToken('JEE', 'Sumit');
  assert.ok(token.startsWith('PSKM-JEE-SUM'));

  const registry: MentorshipTokenRecord[] = [
    {
      tokenCode: 'PSKM-JEE-84920',
      studentName: 'Aman Verma',
      studentEmail: 'aman@example.com',
      studentTelegram: '@aman_jee',
      mentorName: 'Sumit Sir',
      durationMinutes: 30,
      amountPaid: 150,
      targetExam: 'JEE 2027',
      status: 'AUTHENTIC',
      createdAt: '2026-11-03T10:00:00Z',
    },
  ];

  const verifyValid = verifyMentorshipToken('pskm-jee-84920', registry);
  assert.equal(verifyValid.isAuthentic, true);
  assert.equal(verifyValid.record?.studentName, 'Aman Verma');

  const verifyFake = verifyMentorshipToken('PSKM-JEE-00000', registry);
  assert.equal(verifyFake.isAuthentic, false);
});

test('User Profile Validation: name, grade level, and target exams are required', () => {
  const valid = validateUserProfile({
    name: 'Saurav Kumar',
    gradeLevel: 'Class 12',
    targetExams: ['JEE Main', 'JEE Advanced'],
  });
  assert.equal(valid.valid, true);

  const missingExams = validateUserProfile({
    name: 'Saurav Kumar',
    gradeLevel: 'Class 12',
    targetExams: [],
  });
  assert.equal(missingExams.valid, false);

  const shortName = validateUserProfile({
    name: 'S',
    gradeLevel: 'Class 11',
    targetExams: ['NEET UG'],
  });
  assert.equal(shortName.valid, false);
});

test('Discussion Forum: Upvote/Downvote toggle and net score calculation', () => {
  assert.equal(calculateNetVoteScore(['u1', 'u2'], ['u3']), 1);
  assert.equal(calculateNetVoteScore(['u1'], ['u2', 'u3', 'u4']), -2);

  // User 1 upvotes
  const step1 = toggleVote('u1', 'up', [], []);
  assert.deepEqual(step1.upvotedBy, ['u1']);
  assert.equal(step1.netScore, 1);

  // User 1 toggles upvote off
  const step2 = toggleVote('u1', 'up', step1.upvotedBy, step1.downvotedBy);
  assert.deepEqual(step2.upvotedBy, []);
  assert.equal(step2.netScore, 0);

  // User 1 switches from downvote to upvote
  const step3 = toggleVote('u1', 'down', [], []);
  assert.deepEqual(step3.downvotedBy, ['u1']);
  const step4 = toggleVote('u1', 'up', step3.upvotedBy, step3.downvotedBy);
  assert.deepEqual(step4.upvotedBy, ['u1']);
  assert.deepEqual(step4.downvotedBy, []);
  assert.equal(step4.netScore, 1);
});

test('Discussion Forum: Topic sorting by top votes, recent, and replies', () => {
  const topics = [
    {
      id: 't1',
      title: 'Topic 1',
      content: '',
      category: 'General Discussion' as const,
      authorName: 'A',
      authorUid: 'u1',
      upvotedBy: ['u1', 'u2'],
      downvotedBy: [],
      replyCount: 5,
      createdAt: '2026-11-01T10:00:00Z',
    },
    {
      id: 't2',
      title: 'Topic 2',
      content: '',
      category: 'Physics Doubts' as const,
      authorName: 'B',
      authorUid: 'u2',
      upvotedBy: ['u1', 'u2', 'u3', 'u4'],
      downvotedBy: [],
      replyCount: 1,
      createdAt: '2026-11-02T10:00:00Z',
    },
    {
      id: 't3',
      title: 'Topic 3',
      content: '',
      category: 'Chemistry Concepts' as const,
      authorName: 'C',
      authorUid: 'u3',
      upvotedBy: [],
      downvotedBy: [],
      replyCount: 12,
      createdAt: '2026-11-03T10:00:00Z',
    },
  ];

  const sortedTop = sortForumTopics(topics, 'top');
  assert.equal(sortedTop[0].id, 't2'); // 4 net votes

  const sortedRecent = sortForumTopics(topics, 'recent');
  assert.equal(sortedRecent[0].id, 't3'); // Nov 3

  const sortedReplies = sortForumTopics(topics, 'replies');
  assert.equal(sortedReplies[0].id, 't3'); // 12 replies
});

test('Daily Study Streak: tracks consecutive days and upgrades motivational tiers', () => {
  // Test case 1: 0 completed tasks
  const emptyTasks = [
    { id: '1', title: 'Task 1', date: '2026-11-03', isBacklog: false, status: 'pending' as const },
  ];
  const s0 = calculateStudyStreak(emptyTasks, '2026-11-03');
  assert.equal(s0.currentStreak, 0);
  assert.equal(s0.isTodayCompleted, false);
  assert.equal(s0.activeTier.tierName, 'Aspirant Starter');

  // Test case 2: Task completed today (Nov 3) + yesterday (Nov 2) + day before (Nov 1) -> 3 day streak (Iron Will)
  const threeDayTasks = [
    { id: '1', title: 'Task 1', date: '2026-11-03', isBacklog: false, status: 'completed' as const },
    { id: '2', title: 'Task 2', date: '2026-11-02', isBacklog: false, status: 'completed' as const },
    { id: '3', title: 'Task 3', date: '2026-11-01', isBacklog: false, status: 'completed' as const },
  ];
  const s3 = calculateStudyStreak(threeDayTasks, '2026-11-03');
  assert.equal(s3.currentStreak, 3);
  assert.equal(s3.isTodayCompleted, true);
  assert.equal(s3.activeTier.tierName, 'Iron Will');
  assert.equal(s3.activeTier.badgeIcon, '⚡');
  assert.equal(s3.nextTier?.tierName, 'Relentless Ranker');

  // Test case 3: 7 consecutive days completed -> Relentless Ranker tier
  const sevenDayTasks = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date('2026-11-03T00:00:00Z');
    d.setUTCDate(d.getUTCDate() - i);
    sevenDayTasks.push({
      id: `task-${i}`,
      title: `Day ${i} task`,
      date: d.toISOString().split('T')[0],
      isBacklog: false,
      status: 'completed' as const,
    });
  }
  const s7 = calculateStudyStreak(sevenDayTasks, '2026-11-03');
  assert.equal(s7.currentStreak, 7);
  assert.equal(s7.activeTier.tierName, 'Relentless Ranker');
  assert.equal(s7.activeTier.badgeIcon, '🔥');

  // Test case 4: Active streak preserved when today is not completed yet, but yesterday and day before were completed
  const ongoingTodayTasks = [
    { id: 't1', title: 'Today pending task', date: '2026-11-03', isBacklog: false, status: 'in_progress' as const },
    { id: 't2', title: 'Yesterday completed', date: '2026-11-02', isBacklog: false, status: 'completed' as const },
    { id: 't3', title: 'Day before completed', date: '2026-11-01', isBacklog: false, status: 'completed' as const },
  ];
  const sOngoing = calculateStudyStreak(ongoingTodayTasks, '2026-11-03');
  assert.equal(sOngoing.currentStreak, 2);
  assert.equal(sOngoing.isTodayCompleted, false);
});

import {
  calculateBlitzScoreUpdate,
  isAuthorizedAdmin,
  buildJitsiRoomName,
  normalizeStudyMaterialUrl,
  stepSolutionIndex,
  buildMockCertificateMetadata,
  sanitizeLiveProviderLabel,
} from './testEngine';

test('Formula Blitz 60s CBT Rush: streak multiplier and high-score calculation', () => {
  // 1st correct -> +10, streak 1
  const r1 = calculateBlitzScoreUpdate(0, 0, 0, true);
  assert.equal(r1.score, 10);
  assert.equal(r1.streak, 1);
  assert.equal(r1.streakBadgeText, '');

  // 2nd correct -> +10, streak 2 ("🔥 2x Streak!")
  const r2 = calculateBlitzScoreUpdate(r1.score, r1.streak, r1.maxStreak, true);
  assert.equal(r2.score, 20);
  assert.equal(r2.streak, 2);
  assert.equal(r2.streakBadgeText, '🔥 2x Streak!');

  // 3rd correct -> +25 (3+ streak bonus), streak 3 ("🔥 3x Streak!")
  const r3 = calculateBlitzScoreUpdate(r2.score, r2.streak, r2.maxStreak, true);
  assert.equal(r3.score, 45);
  assert.equal(r3.streak, 3);
  assert.equal(r3.streakBadgeText, '🔥 3x Streak!');

  // Wrong answer -> resets streak to 0, preserves score and maxStreak
  const r4 = calculateBlitzScoreUpdate(r3.score, r3.streak, r3.maxStreak, false);
  assert.equal(r4.score, 45);
  assert.equal(r4.streak, 0);
  assert.equal(r4.maxStreak, 3);
  assert.equal(r4.streakBadgeText, '');
});

test('Role-Based Access Control (Admin vs Student) and Jitsi room naming', () => {
  const admins = ['sumitgaming9570@gmail.com', 'unfiltereddsumit@gmail.com'];
  assert.equal(isAuthorizedAdmin('student@gmail.com', false, admins), false);
  assert.equal(isAuthorizedAdmin('student@gmail.com', true, admins), true);
  assert.equal(isAuthorizedAdmin('SUMITGAMING9570@GMAIL.COM', false, admins), true);

  assert.equal(
    buildJitsiRoomName('group', 'Rotational Motion Live'),
    'PrepskmLiveMentorship_RotationalMotionLive'
  );
  assert.equal(
    buildJitsiRoomName('direct', 'Arjun Sharma'),
    'Prepskm1on1Call_ArjunSharma'
  );
});

test('Study Material PDF URL sanitizer rejects custom File/Object instances', () => {
  assert.equal(
    normalizeStudyMaterialUrl('#prepskm-cloud-file:pdf-123:2:notes.pdf', 'pdf-123'),
    '#prepskm-cloud-file:pdf-123:2:notes.pdf'
  );
  assert.equal(
    normalizeStudyMaterialUrl({ name: 'test.pdf', size: 1024 }, 'pdf-999'),
    '#prepskm-local-file:pdf-999'
  );
  assert.equal(
    normalizeStudyMaterialUrl('[object File]', 'pdf-999'),
    '#prepskm-local-file:pdf-999'
  );
});

test('Swipeable solution navigation, E-certificate metadata, and whitelabel sanitizer', () => {
  assert.equal(stepSolutionIndex(0, 5, 'next'), 1);
  assert.equal(stepSolutionIndex(4, 5, 'next'), 0);
  assert.equal(stepSolutionIndex(0, 5, 'prev'), 4);
  assert.equal(stepSolutionIndex(2, 5, 3), 3);

  const cert = buildMockCertificateMetadata({
    studentName: 'Aarav Verma',
    studentEmail: 'aarav@gmail.com',
    testTitle: 'JEE Main Full Syllabus Mock #1',
    totalScore: 265,
    maxScore: 300,
    accuracy: 92,
    percentile: 99.4,
    dateStr: '2026-11-04',
  });
  assert.equal(cert.gradeBadge, 'All India Topper Distinction');
  assert.equal(cert.studentEmail, 'aarav@gmail.com');
  assert.ok(cert.certificateId.startsWith('PREPSKM-CERT-20261104-'));

  assert.equal(
    sanitizeLiveProviderLabel('Connected via Jitsi Meet & YouTube', false),
    'Connected via Prepskm Live Stream & Prepskm HD Video'
  );
  assert.equal(
    sanitizeLiveProviderLabel('Connected via Jitsi Meet', true),
    'Connected via Jitsi Meet'
  );
});


