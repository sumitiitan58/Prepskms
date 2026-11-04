import React, { useState, useEffect } from 'react';
import {
  ClipboardCheck,
  Clock,
  Play,
  CheckCircle2,
  Flag,
  HelpCircle,
  ArrowLeft,
  ArrowRight,
  Award,
  RotateCcw,
  Sparkles,
  BookOpen,
} from 'lucide-react';
import {
  subscribeMockTests,
  saveStudentTestResult,
  auth,
} from '../services/firebase';
import {
  calculateNtaScore,
  computeCbtPaletteCounts,
} from '../utils/testEngine';
import TestAnalytics from './TestAnalytics';

function formatCountdown(seconds) {
  const s = Math.max(0, Math.floor(Number(seconds) || 0));
  const hrs = Math.floor(s / 3600);
  const mins = Math.floor((s % 3600) / 60);
  const rem = s % 60;
  return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(rem).padStart(2, '0')}`;
}

export default function MockTests() {
  const [tests, setTests] = useState([]);
  const [activeTest, setActiveTest] = useState(null);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answersMap, setAnswersMap] = useState({});
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [submittedResult, setSubmittedResult] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const unsub = subscribeMockTests((list) => {
      setTests(Array.isArray(list) ? list : []);
    });
    return () => unsub();
  }, []);

  // Countdown Timer when a CBT test is active
  useEffect(() => {
    if (!activeTest || submittedResult) return;
    const timer = setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [activeTest, submittedResult]);

  const startCbtSession = (testItem) => {
    setActiveTest(testItem);
    setCurrentIdx(0);
    setAnswersMap({});
    setSubmittedResult(null);
    const mins = Number(testItem.durationMinutes) || 180;
    setRemainingSeconds(mins * 60);
  };

  const handleSelectOption = (questionId, value) => {
    setAnswersMap((prev) => ({
      ...prev,
      [questionId]: {
        ...(prev[questionId] || {}),
        selectedAnswer: value,
      },
    }));
  };

  const handleToggleMarkReview = (questionId) => {
    setAnswersMap((prev) => ({
      ...prev,
      [questionId]: {
        ...(prev[questionId] || {}),
        markedForReview: !prev[questionId]?.markedForReview,
      },
    }));
  };

  const handleClearResponse = (questionId) => {
    setAnswersMap((prev) => ({
      ...prev,
      [questionId]: {
        ...(prev[questionId] || {}),
        selectedAnswer: '',
      },
    }));
  };

  const handleSubmitCbt = async () => {
    if (!activeTest || submitting) return;
    setSubmitting(true);

    const questions = Array.isArray(activeTest.questions) ? activeTest.questions : [];
    const formattedAnswers = {};
    const chapterMistakes = {};

    questions.forEach((q) => {
      const entry = answersMap[q.id];
      const sel = entry?.selectedAnswer;
      formattedAnswers[q.id] = {
        questionId: q.id,
        selectedAnswer: sel ?? null,
        status: entry?.markedForReview
          ? 'marked_review'
          : sel
          ? 'answered'
          : 'unanswered',
        timeSpentSeconds: 60,
      };

      if (sel && String(sel).trim().toUpperCase() !== String(q.correctAnswer).trim().toUpperCase()) {
        const ch = q.chapter || q.subject || 'Core Concept';
        chapterMistakes[ch] = (chapterMistakes[ch] || 0) + 1;
      }
    });

    const summary = calculateNtaScore(questions, formattedAnswers);
    const totalDurationSec = (Number(activeTest.durationMinutes) || 180) * 60;
    const elapsedSec = Math.max(30, totalDurationSec - remainingSeconds);

    const payload = {
      id: `res_${Date.now()}`,
      testId: activeTest.id,
      testTitle: activeTest.title,
      userEmail: auth?.currentUser?.email || 'student@prepskm.in',
      userName: auth?.currentUser?.displayName || 'Prepskm Student',
      totalScore: summary.totalScore,
      maxScore: summary.maxScore,
      accuracy: summary.accuracyPercentage,
      percentile: Math.min(99.9, Math.max(65, 75 + (summary.accuracyPercentage || 0) * 0.24)),
      correctCount: summary.correctCount,
      incorrectCount: summary.incorrectCount,
      unattemptedCount: summary.unattemptedCount,
      timeSpentSeconds: elapsedSec,
      subjectScores: summary.subjectScores,
      chapterMistakes,
      aiRecommendations: summary.aiRecommendations,
      date: new Date().toISOString(),
    };

    try {
      await saveStudentTestResult(payload);
    } catch {
      // Non-fatal if offline
    }
    setSubmittedResult(payload);
    setSubmitting(false);
  };

  // ============================================================================
  // ACTIVE COMPUTER-BASED TEST (CBT) INTERFACE
  // ============================================================================
  if (activeTest) {
    const questions = Array.isArray(activeTest.questions) ? activeTest.questions : [];
    const currentQ = questions[currentIdx] || questions[0];
    const questionIds = questions.map((q) => q.id);
    const paletteCounts = computeCbtPaletteCounts(questionIds, answersMap);
    const currentEntry = currentQ ? answersMap[currentQ.id] || {} : {};

    return (
      <div className="bg-[#FFFFFF] border border-[#E2E8F0] rounded-2xl shadow-sm overflow-hidden">
        {/* Top NTA CBT Header Bar with Live Timer */}
        <div className="px-4 py-3 bg-[#F8FAFC] border-b border-[#E2E8F0] flex flex-wrap items-center justify-between gap-3">
          <div>
            <span className="px-2 py-0.5 rounded bg-indigo-50 border border-indigo-200 text-indigo-700 text-[10px] font-extrabold uppercase">
              NTA CBT Mode • +4 / -1 Marking
            </span>
            <h3 className="text-sm sm:text-base font-extrabold text-[#1E293B] mt-0.5">
              {activeTest.title}
            </h3>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-800 font-mono text-xs sm:text-sm font-extrabold">
              <Clock className="w-4 h-4 text-indigo-600" />
              <span>{formatCountdown(remainingSeconds)}</span>
            </div>

            {!submittedResult && (
              <button
                type="button"
                onClick={handleSubmitCbt}
                disabled={submitting}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold shadow-xs transition-colors"
              >
                {submitting ? 'Submitting...' : 'Submit Test'}
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                setActiveTest(null);
                setSubmittedResult(null);
              }}
              className="px-3 py-1.5 rounded-xl bg-[#FFFFFF] border border-[#E2E8F0] text-slate-600 hover:text-[#1E293B] text-xs font-bold"
            >
              Exit CBT
            </button>
          </div>
        </div>

        {/* Instant Score Summary Screen after Submission */}
        {submittedResult ? (
          <div className="p-6 space-y-6 bg-[#FFFFFF]">
            <div className="bg-indigo-50/70 border border-indigo-200 rounded-2xl p-5 flex flex-wrap items-center justify-between gap-4">
              <div className="space-y-1">
                <span className="inline-flex items-center gap-1 text-xs font-extrabold text-indigo-700 uppercase">
                  <Award className="w-4 h-4" /> Official NTA CBT Scorecard Generated
                </span>
                <h4 className="text-xl font-extrabold text-[#1E293B]">
                  Score: {submittedResult.totalScore} / {submittedResult.maxScore}
                </h4>
                <p className="text-xs text-slate-600">
                  Accuracy: <strong>{submittedResult.accuracy}%</strong> • Correct:{' '}
                  <strong className="text-emerald-700">{submittedResult.correctCount}</strong> •
                  Incorrect: <strong className="text-red-600">{submittedResult.incorrectCount}</strong> •
                  Unattempted: <strong>{submittedResult.unattemptedCount}</strong>
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => startCbtSession(activeTest)}
                  className="px-4 py-2 rounded-xl bg-[#FFFFFF] border border-[#E2E8F0] hover:border-indigo-300 text-[#1E293B] text-xs font-extrabold inline-flex items-center gap-1.5"
                >
                  <RotateCcw className="w-3.5 h-3.5" /> Retake Test
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setActiveTest(null);
                    setSubmittedResult(null);
                  }}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-extrabold"
                >
                  Back to All Mock Tests
                </button>
              </div>
            </div>

            {/* Question-by-Question Answer Key Review */}
            <div className="space-y-3">
              <h5 className="text-xs font-extrabold text-[#1E293B] uppercase tracking-wider">
                Answer Key & Solution Verification
              </h5>
              {questions.map((q, idx) => {
                const userAns = answersMap[q.id]?.selectedAnswer || 'Unattempted';
                const isCorrect =
                  String(userAns).trim().toUpperCase() ===
                  String(q.correctAnswer).trim().toUpperCase();
                return (
                  <div
                    key={q.id}
                    className="p-4 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-1.5"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-extrabold text-[#1E293B]">
                        Q{idx + 1}. {q.subject} • {q.chapter}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded font-extrabold text-[10px] ${
                          userAns === 'Unattempted'
                            ? 'bg-slate-200 text-slate-700'
                            : isCorrect
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-red-100 text-red-700'
                        }`}
                      >
                        {userAns === 'Unattempted'
                          ? '0 Marks (Unattempted)'
                          : isCorrect
                          ? '+4 Marks (Correct)'
                          : '-1 Mark (Incorrect)'}
                      </span>
                    </div>
                    <p className="text-xs text-[#1E293B] font-medium">{q.text}</p>
                    <div className="text-[11px] text-slate-600 flex flex-wrap gap-4 pt-1">
                      <span>
                        Your Answer: <strong>{userAns}</strong>
                      </span>
                      <span>
                        Correct Answer Key:{' '}
                        <strong className="text-emerald-700">{q.correctAnswer}</strong>
                      </span>
                    </div>
                    {q.explanation && (
                      <p className="text-[11px] text-indigo-700 bg-indigo-50/70 border border-indigo-100 rounded-lg p-2 mt-1">
                        <strong>Solution:</strong> {q.explanation}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          /* Active CBT Question Workspace + Right Question Palette */
          <div className="grid grid-cols-1 lg:grid-cols-3 divide-y lg:divide-y-0 lg:divide-x divide-[#E2E8F0]">
            {/* Left 2 Columns: Active Question & Options */}
            <div className="lg:col-span-2 p-4 sm:p-6 flex flex-col justify-between space-y-6">
              {currentQ ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-3">
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-1 rounded-lg bg-indigo-600 text-white text-xs font-extrabold">
                        Question {currentIdx + 1} of {questions.length}
                      </span>
                      <span className="px-2 py-0.5 rounded bg-[#F8FAFC] border border-[#E2E8F0] text-xs font-bold text-[#1E293B]">
                        {currentQ.subject} • {currentQ.chapter}
                      </span>
                    </div>
                    <span className="text-xs font-bold text-emerald-700">
                      +4 Correct, -1 Wrong
                    </span>
                  </div>

                  <p className="text-sm sm:text-base font-bold text-[#1E293B] leading-relaxed">
                    {currentQ.text}
                  </p>

                  {currentQ.type === 'NAT' ? (
                    <div className="space-y-2 max-w-sm">
                      <label className="block text-xs font-extrabold text-slate-600 uppercase">
                        Enter Numerical Value Answer:
                      </label>
                      <input
                        type="number"
                        step="any"
                        value={currentEntry.selectedAnswer || ''}
                        onChange={(e) => handleSelectOption(currentQ.id, e.target.value)}
                        placeholder="e.g. 25.5"
                        className="w-full px-3.5 py-2.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-sm font-bold text-[#1E293B] focus:outline-none focus:border-indigo-600"
                      />
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {(currentQ.options || ['Option A', 'Option B', 'Option C', 'Option D']).map(
                        (optText, optIdx) => {
                          const letter = ['A', 'B', 'C', 'D'][optIdx] || 'A';
                          const isSelected = currentEntry.selectedAnswer === letter;
                          return (
                            <button
                              key={letter}
                              type="button"
                              onClick={() => handleSelectOption(currentQ.id, letter)}
                              className={`w-full p-3.5 rounded-xl border text-left flex items-center gap-3 transition-all ${
                                isSelected
                                  ? 'bg-indigo-50 border-indigo-600 text-[#1E293B] shadow-2xs'
                                  : 'bg-[#F8FAFC] border-[#E2E8F0] hover:border-indigo-300 text-[#1E293B]'
                              }`}
                            >
                              <span
                                className={`w-7 h-7 rounded-lg text-xs font-extrabold flex items-center justify-center shrink-0 ${
                                  isSelected
                                    ? 'bg-indigo-600 text-white'
                                    : 'bg-[#FFFFFF] border border-[#E2E8F0] text-slate-700'
                                }`}
                              >
                                {letter}
                              </span>
                              <span className="text-xs sm:text-sm font-semibold">{optText}</span>
                            </button>
                          );
                        }
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-xs text-slate-500">No questions found in this test.</p>
              )}

              {/* Bottom CBT Action Controls */}
              {currentQ && (
                <div className="pt-4 border-t border-[#E2E8F0] flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleToggleMarkReview(currentQ.id)}
                      className={`px-3 py-2 rounded-xl border text-xs font-extrabold inline-flex items-center gap-1.5 ${
                        currentEntry.markedForReview
                          ? 'bg-amber-100 border-amber-400 text-amber-900'
                          : 'bg-[#F8FAFC] border-[#E2E8F0] text-slate-700 hover:border-amber-300'
                      }`}
                    >
                      <Flag className="w-3.5 h-3.5" />
                      <span>
                        {currentEntry.markedForReview ? 'Marked for Review' : 'Mark for Review'}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleClearResponse(currentQ.id)}
                      className="px-3 py-2 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] hover:border-red-300 text-slate-600 hover:text-red-600 text-xs font-bold"
                    >
                      Clear Response
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={currentIdx === 0}
                      onClick={() => setCurrentIdx((i) => Math.max(0, i - 1))}
                      className="px-3 py-2 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] disabled:opacity-40 text-xs font-bold text-[#1E293B] inline-flex items-center gap-1"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" /> Prev
                    </button>

                    {currentIdx < questions.length - 1 ? (
                      <button
                        type="button"
                        onClick={() => setCurrentIdx((i) => Math.min(questions.length - 1, i + 1))}
                        className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-extrabold inline-flex items-center gap-1"
                      >
                        Save & Next <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={handleSubmitCbt}
                        className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold"
                      >
                        Submit Final CBT
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Right Column: NTA Question Palette (Answered, Unanswered, Marked for Review) */}
            <div className="p-4 bg-[#F8FAFC] space-y-4">
              <h4 className="text-xs font-extrabold text-[#1E293B] uppercase tracking-wider">
                Question Palette
              </h4>

              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="p-2 rounded-xl bg-emerald-50 border border-emerald-200">
                  <span className="block text-sm font-extrabold text-emerald-700">
                    {paletteCounts.answeredCount}
                  </span>
                  <span className="text-[10px] font-bold text-emerald-800">Answered</span>
                </div>
                <div className="p-2 rounded-xl bg-amber-50 border border-amber-200">
                  <span className="block text-sm font-extrabold text-amber-700">
                    {paletteCounts.markedReviewCount}
                  </span>
                  <span className="text-[10px] font-bold text-amber-800">Marked</span>
                </div>
                <div className="p-2 rounded-xl bg-[#FFFFFF] border border-[#E2E8F0]">
                  <span className="block text-sm font-extrabold text-slate-700">
                    {paletteCounts.unansweredCount}
                  </span>
                  <span className="text-[10px] font-bold text-slate-500">Unanswered</span>
                </div>
              </div>

              <div className="grid grid-cols-5 gap-2 pt-2">
                {questions.map((q, idx) => {
                  const st = answersMap[q.id];
                  const hasAns =
                    st?.selectedAnswer !== undefined &&
                    st?.selectedAnswer !== null &&
                    String(st.selectedAnswer).trim() !== '';
                  const isMarked = Boolean(st?.markedForReview);
                  const isCurrent = idx === currentIdx;

                  let btnClass = 'bg-[#FFFFFF] border-[#E2E8F0] text-[#1E293B]';
                  if (isMarked) {
                    btnClass = 'bg-amber-500 border-amber-600 text-white';
                  } else if (hasAns) {
                    btnClass = 'bg-emerald-600 border-emerald-700 text-white';
                  }

                  return (
                    <button
                      key={q.id}
                      type="button"
                      onClick={() => setCurrentIdx(idx)}
                      className={`h-9 rounded-lg border text-xs font-extrabold transition-all ${btnClass} ${
                        isCurrent ? 'ring-2 ring-indigo-600 ring-offset-1' : ''
                      }`}
                    >
                      {idx + 1}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ============================================================================
  // DEFAULT VIEW: ACTIVE MOCK TESTS PORTAL + REAL-TIME CBT ANALYTICS
  // ============================================================================
  return (
    <div className="space-y-6">
      {/* Section Header */}
      <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-2xl p-4 sm:p-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-indigo-50 border border-indigo-200 text-indigo-700 text-[10px] font-extrabold uppercase tracking-wider">
            <ClipboardCheck className="w-3.5 h-3.5" /> Official NTA Computer-Based Test (CBT) Portal
          </span>
          <h2 className="text-lg sm:text-xl font-extrabold text-[#1E293B] mt-1">
            Active Mock Tests & Instant Rank Evaluation
          </h2>
          <p className="text-xs text-slate-600">
            Full-length and chapter-wise JEE & NEET CBT mock tests with live timer, question palette, and instant score calculation.
          </p>
        </div>
      </div>

      {/* Active Mock Test Cards */}
      {tests.length === 0 ? (
        <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-2xl p-6 text-center space-y-2">
          <ClipboardCheck className="w-8 h-8 text-indigo-600 mx-auto" />
          <h4 className="text-sm font-extrabold text-[#1E293B]">
            No Published Cloud Mock Tests Yet
          </h4>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            Admin (Mentor Sumit) can publish custom JEE & NEET CBT Mock Tests from the Admin Panel &rarr; Mock Tests Builder, and they will appear here across all student devices immediately.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {tests.map((testItem) => {
            const qCount = Array.isArray(testItem.questions)
              ? testItem.questions.length
              : Number(testItem.totalQuestions) || 0;
            const duration = Number(testItem.durationMinutes) || 180;

            return (
              <div
                key={testItem.id}
                className="bg-[#F8FAFC] hover:bg-[#FFFFFF] border border-[#E2E8F0] hover:border-indigo-400 rounded-2xl p-4 flex flex-col justify-between gap-3 transition-all shadow-2xs"
              >
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="px-2 py-0.5 rounded bg-indigo-50 border border-indigo-200 text-indigo-700 text-[10px] font-extrabold uppercase">
                      {testItem.exam || 'JEE / NEET CBT'}
                    </span>
                    <span className="text-[11px] font-bold text-slate-500 flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-indigo-600" /> {duration} mins
                    </span>
                  </div>

                  <h3 className="text-sm sm:text-base font-extrabold text-[#1E293B]">
                    {testItem.title}
                  </h3>

                  <p className="text-xs text-slate-600">
                    Syllabus: <strong className="text-[#1E293B]">{testItem.syllabus || testItem.subject || 'Full Syllabus'}</strong>
                  </p>
                </div>

                <div className="pt-3 border-t border-[#E2E8F0] flex items-center justify-between gap-2">
                  <div className="text-[11px] text-slate-600 font-semibold">
                    <span>{qCount} Questions</span>
                    <span className="mx-1.5">•</span>
                    <span>Max Marks: {qCount * 4}</span>
                  </div>

                  <button
                    type="button"
                    onClick={() => startCbtSession(testItem)}
                    className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-extrabold inline-flex items-center gap-1.5 shadow-xs transition-colors"
                  >
                    <Play className="w-3.5 h-3.5 fill-white" />
                    <span>Start Test</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Embedded Real-Time Student Test Analytics */}
      <TestAnalytics />
    </div>
  );
}
