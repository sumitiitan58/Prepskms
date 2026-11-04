import React, { useState, useEffect } from 'react';
import {
  TrendingUp,
  Target,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  BarChart3,
  Clock,
  Award,
} from 'lucide-react';
import {
  subscribeStudentTestResults,
  auth,
} from '../services/firebase';
import { identifyWeakChaptersFromMistakes } from '../utils/testEngine';

export default function TestAnalytics() {
  const [results, setResults] = useState([]);

  useEffect(() => {
    const email = auth?.currentUser?.email || '';
    const unsub = subscribeStudentTestResults(email, (list) => {
      setResults(Array.isArray(list) ? list : []);
    });
    return () => unsub();
  }, []);

  if (results.length === 0) {
    return (
      <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-2xl p-6 text-center space-y-2">
        <BarChart3 className="w-8 h-8 text-indigo-600 mx-auto" />
        <h4 className="text-sm font-extrabold text-[#1E293B]">
          No CBT Mock Test Attempts Recorded Yet
        </h4>
        <p className="text-xs text-slate-500 max-w-md mx-auto">
          Start any active CBT Mock Test above to automatically generate your NTA score trend, accuracy breakdown, and chapter-level weakness diagnostics.
        </p>
      </div>
    );
  }

  const latest = results[results.length - 1];
  const avgAccuracy = Math.round(
    results.reduce((acc, r) => acc + (Number(r.accuracy) || 0), 0) / results.length
  );
  const bestScore = Math.max(...results.map((r) => Number(r.totalScore) || 0));
  const weakChapters = identifyWeakChaptersFromMistakes(results);

  const subjBreakdown = latest?.subjectScores || {
    Physics: { score: 0, maxScore: 100, correct: 0, incorrect: 0 },
    Chemistry: { score: 0, maxScore: 100, correct: 0, incorrect: 0 },
    Mathematics: { score: 0, maxScore: 100, correct: 0, incorrect: 0 },
  };

  return (
    <div className="bg-[#FFFFFF] border border-[#E2E8F0] rounded-2xl p-4 sm:p-5 space-y-5 shadow-xs">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E2E8F0] pb-3.5">
        <div>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-indigo-50 border border-indigo-200 text-indigo-700 text-[10px] font-extrabold uppercase tracking-wider">
            <BarChart3 className="w-3 h-3" /> Real-Time Cloud CBT Analytics
          </span>
          <h3 className="text-base sm:text-lg font-extrabold text-[#1E293B] mt-1">
            Student Test Performance & Weakness Diagnostics
          </h3>
        </div>
        <span className="text-xs font-bold text-slate-500">
          Total Attempts Synced: <strong className="text-indigo-600">{results.length}</strong>
        </span>
      </div>

      {/* Top KPI Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-3">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
            <span>Latest CBT Score</span>
            <Award className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="text-xl font-extrabold text-[#1E293B]">
            {latest.totalScore}{' '}
            <span className="text-xs font-normal text-slate-500">/ {latest.maxScore || 300}</span>
          </div>
          <div className="text-[11px] text-emerald-600 font-bold mt-1">
            Best Score: {bestScore}
          </div>
        </div>

        <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-3">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
            <span>Overall Accuracy</span>
            <Target className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-xl font-extrabold text-[#1E293B]">{avgAccuracy}%</div>
          <div className="text-[11px] text-slate-500 mt-1">
            Latest: {latest.correctCount || 0} Correct • {latest.incorrectCount || 0} Wrong
          </div>
        </div>

        <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-3">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
            <span>Estimated Percentile</span>
            <TrendingUp className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-xl font-extrabold text-[#1E293B]">
            {Number(latest.percentile || 96.4).toFixed(1)}%ile
          </div>
          <div className="text-[11px] text-indigo-600 font-semibold mt-1">
            Target: 99.5+ Percentile
          </div>
        </div>

        <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-3">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
            <span>Avg Time / Question</span>
            <Clock className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-xl font-extrabold text-[#1E293B]">
            {Math.max(
              1,
              Math.round(
                (Number(latest.timeSpentSeconds || 5400) /
                  Math.max(1, (latest.correctCount || 0) + (latest.incorrectCount || 0) || 45)) /
                  60
              )
            )}{' '}
            min
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Unattempted: {latest.unattemptedCount || 0} Qs
          </div>
        </div>
      </div>

      {/* Score Trend Across Last 5 Tests + Subject Accuracy Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-4">
          <h4 className="text-xs font-extrabold text-[#1E293B] uppercase tracking-wider mb-3 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-indigo-600" /> Score Trend Across Recent Mock Tests
          </h4>
          <div className="h-40 flex items-end justify-between gap-2.5 pt-4 px-2 border-b border-[#E2E8F0]">
            {results.slice(-5).map((r, idx) => {
              const max = Number(r.maxScore) || 300;
              const score = Math.max(0, Number(r.totalScore) || 0);
              const pct = Math.min(100, Math.max(12, Math.round((score / max) * 100)));
              return (
                <div key={r.id || idx} className="flex-1 flex flex-col items-center gap-1.5">
                  <span className="text-[10px] font-extrabold text-indigo-700">{score}</span>
                  <div className="w-full max-w-[42px] bg-slate-200 rounded-t-lg h-28 flex items-end overflow-hidden">
                    <div
                      style={{ height: `${pct}%` }}
                      className="w-full bg-gradient-to-t from-indigo-600 to-blue-500 rounded-t-lg transition-all duration-500"
                    />
                  </div>
                  <span className="text-[10px] text-slate-600 font-semibold truncate max-w-[68px]">
                    {r.testTitle ? r.testTitle.replace(/JEE Main|Mock/gi, '').trim() || `T${idx + 1}` : `Test ${idx + 1}`}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-4">
          <h4 className="text-xs font-extrabold text-[#1E293B] uppercase tracking-wider mb-3 flex items-center gap-2">
            <Target className="w-4 h-4 text-emerald-600" /> Subject-Wise Breakdown (Correct vs Wrong)
          </h4>
          <div className="space-y-3">
            {Object.entries(subjBreakdown).map(([subj, data]) => {
              const totalAttempted = (data.correct || 0) + (data.incorrect || 0);
              const acc = totalAttempted > 0 ? Math.round(((data.correct || 0) / totalAttempted) * 100) : 0;
              return (
                <div key={subj} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-[#1E293B]">{subj}</span>
                    <div className="flex items-center gap-3 text-[11px]">
                      <span className="text-emerald-600 flex items-center gap-1 font-bold">
                        <CheckCircle2 className="w-3 h-3" /> {data.correct || 0} Correct
                      </span>
                      <span className="text-red-600 flex items-center gap-1 font-bold">
                        <XCircle className="w-3 h-3" /> {data.incorrect || 0} Wrong
                      </span>
                      <span className="font-extrabold text-indigo-700">
                        {data.score || 0}/{data.maxScore || 100} ({acc}%)
                      </span>
                    </div>
                  </div>
                  <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                    <div
                      style={{ width: `${Math.min(100, Math.max(5, acc))}%` }}
                      className={`h-full rounded-full ${
                        acc >= 75
                          ? 'bg-emerald-500'
                          : acc >= 50
                          ? 'bg-indigo-600'
                          : 'bg-red-500'
                      }`}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Weak Chapter Tags Based on Negative Marks Lost */}
      {weakChapters.length > 0 && (
        <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-4">
          <div className="flex items-center justify-between mb-2.5">
            <h4 className="text-xs font-extrabold text-[#1E293B] uppercase tracking-wider flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-500" />
              Weak Chapter Diagnostics (Ranked by Negative Marks Lost)
            </h4>
            <span className="text-[11px] text-slate-500">
              Prioritize these chapters in your next revision block
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {weakChapters.map((item) => (
              <div
                key={item.chapter}
                className={`px-3 py-1.5 rounded-lg border text-xs flex items-center gap-2 ${
                  item.severity === 'CRITICAL'
                    ? 'bg-red-50 border-red-200 text-red-700'
                    : 'bg-amber-50 border-amber-200 text-amber-800'
                }`}
              >
                <span className="font-extrabold">{item.chapter}</span>
                <span className="px-1.5 py-0.5 rounded bg-white/80 text-[10px] font-extrabold">
                  -{item.negativeMarksLost} Marks Lost ({item.mistakes} Wrong)
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
