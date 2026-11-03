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

