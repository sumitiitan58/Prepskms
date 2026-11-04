import React, { useEffect, useState, useMemo } from 'react';
import {
  subscribeMockTests,
  subscribeStudentResults,
} from '../services/firebase.js';

const FALLBACK_CBT_MOCKS = [
  {
    id: 'mock-jee-full-1',
    title: 'JEE Main 2027 All India CBT Full Test #1',
    exam: 'JEE',
    duration_minutes: 180,
    total_questions: 75,
    syllabus:
      'Rotational Dynamics, Electrostatics, Chemical Bonding, GOC, Definite Integration & Conic Sections',
    is_live_today: true,
  },
  {
    id: 'mock-neet-full-1',
    title: 'NEET UG 2027 NCERT Line-by-Line Mock #1',
    exam: 'NEET',
    duration_minutes: 200,
    total_questions: 180,
    syllabus:
      'Human Physiology, Genetics & Evolution, Optics, Thermodynamics & Coordination Compounds',
    is_live_today: true,
  },
  {
    id: 'mock-jee-adv-2',
    title: 'JEE Advanced High-Yield Mechanics & Calculus Booster',
    exam: 'JEE',
    duration_minutes: 120,
    total_questions: 45,
    syllabus:
      'Rigid Body Mechanics, Fluid Dynamics, Differential Equations & Complex Numbers',
    is_live_today: false,
  },
];

const FALLBACK_HISTORY = [
  {
    id: 'res-hist-1',
    seriesTitle: 'JEE Main CBT Mock #1 (Foundation)',
    exam: 'JEE',
    totalScore: 164,
    maxScore: 300,
    accuracy: 74,
    percentile: 94.8,
    allIndiaRank: 962,
    submittedAt: '2026-10-18T14:20:00.000Z',
    subjectScores: {
      Physics: { score: 62, maxScore: 100, correct: 16, incorrect: 2 },
      Chemistry: { score: 56, maxScore: 100, correct: 15, incorrect: 4 },
      Mathematics: { score: 46, maxScore: 100, correct: 13, incorrect: 6 },
    },
    chapterMistakes: {
      'Rotational Dynamics': 3,
      'Definite Integration': 4,
      'Ionic Equilibrium': 2,
    },
  },
  {
    id: 'res-hist-2',
    seriesTitle: 'JEE Main CBT Mock #2 (Rank Booster)',
    exam: 'JEE',
    totalScore: 188,
    maxScore: 300,
    accuracy: 80,
    percentile: 97.4,
    allIndiaRank: 481,
    submittedAt: '2026-10-25T15:00:00.000Z',
    subjectScores: {
      Physics: { score: 71, maxScore: 100, correct: 18, incorrect: 1 },
      Chemistry: { score: 64, maxScore: 100, correct: 17, incorrect: 4 },
      Mathematics: { score: 53, maxScore: 100, correct: 14, incorrect: 3 },
    },
    chapterMistakes: {
      'Rotational Dynamics': 2,
      'Complex Numbers': 2,
      'Electrochemistry': 2,
    },
  },
  {
    id: 'res-hist-3',
    seriesTitle: 'JEE Main All India Full Syllabus CBT #3',
    exam: 'JEE',
    totalScore: 214,
    maxScore: 300,
    accuracy: 86,
    percentile: 99.1,
    allIndiaRank: 168,
    submittedAt: '2026-11-02T16:30:00.000Z',
    subjectScores: {
      Physics: { score: 82, maxScore: 100, correct: 21, incorrect: 2 },
      Chemistry: { score: 72, maxScore: 100, correct: 18, incorrect: 0 },
      Mathematics: { score: 60, maxScore: 100, correct: 16, incorrect: 4 },
    },
    chapterMistakes: {
      'Definite Integration': 2,
      'Ray & Wave Optics': 1,
    },
  },
];

export default function TestAnalytics({ defaultTab = 'analytics' }) {
  const [activeTab, setActiveTab] = useState(defaultTab);
  const [availableMocks, setAvailableMocks] = useState(FALLBACK_CBT_MOCKS);
  const [results, setResults] = useState(FALLBACK_HISTORY);

  useEffect(() => {
    const syncRouteTab = () => {
      if (typeof window !== 'undefined') {
        const path = window.location.pathname;
        if (path === '/analytics') {
          setActiveTab('analytics');
        }
      }
    };
    syncRouteTab();
    window.addEventListener('popstate', syncRouteTab);
    window.setTestAnalyticsTab = (tabName) => {
      if (tabName) setActiveTab(tabName);
    };
    return () => {
      window.removeEventListener('popstate', syncRouteTab);
    };
  }, []);

  useEffect(() => {
    const unsubMocks = subscribeMockTests((cloudMocks) => {
      if (cloudMocks && cloudMocks.length > 0) {
        setAvailableMocks(cloudMocks);
      } else if (
        typeof window !== 'undefined' &&
        Array.isArray(window.state?.mockTests) &&
        window.state.mockTests.length > 0
      ) {
        setAvailableMocks(window.state.mockTests);
      }
    });

    const unsubResults = subscribeStudentResults((cloudResults) => {
      const localResults =
        typeof window !== 'undefined' &&
        Array.isArray(window.state?.mockResults)
          ? window.state.mockResults
          : [];
      const mergedMap = new Map();
      [...FALLBACK_HISTORY, ...localResults, ...cloudResults].forEach((r) => {
        if (r && r.id) {
          mergedMap.set(r.id, r);
        }
      });
      const sorted = Array.from(mergedMap.values()).sort(
        (a, b) =>
          new Date(b.submittedAt || b.created_at || 0).getTime() -
          new Date(a.submittedAt || a.created_at || 0).getTime()
      );
      setResults(sorted);
    });

    return () => {
      unsubMocks();
      unsubResults();
    };
  }, []);

  // Chronological order for Trend Line Graph
  const chronological = useMemo(() => {
    return [...results]
      .sort(
        (a, b) =>
          new Date(a.submittedAt || a.created_at || 0).getTime() -
          new Date(b.submittedAt || b.created_at || 0).getTime()
      )
      .slice(-8);
  }, [results]);

  // Subject-wise accuracy & Chapter-level weakness identifier
  const analyticsData = useMemo(() => {
    const subjectTotals = {
      Physics: { correct: 0, attempted: 0, score: 0, maxScore: 0 },
      Chemistry: { correct: 0, attempted: 0, score: 0, maxScore: 0 },
      Mathematics: { correct: 0, attempted: 0, score: 0, maxScore: 0 },
      Biology: { correct: 0, attempted: 0, score: 0, maxScore: 0 },
    };

    const chapterNegativeMarks = {};

    results.forEach((r) => {
      const subjScores = r.subjectScores || {};
      Object.entries(subjScores).forEach(([subj, data]) => {
        if (!subjectTotals[subj]) {
          subjectTotals[subj] = {
            correct: 0,
            attempted: 0,
            score: 0,
            maxScore: 0,
          };
        }
        const c = Number(data.correct || 0);
        const inc = Number(data.incorrect || 0);
        subjectTotals[subj].correct += c;
        subjectTotals[subj].attempted += c + inc;
        subjectTotals[subj].score += Number(data.score || 0);
        subjectTotals[subj].maxScore += Number(data.maxScore || 100);
      });

      const mistakes = r.chapterMistakes || {};
      Object.entries(mistakes).forEach(([chap, negCount]) => {
        chapterNegativeMarks[chap] =
          (chapterNegativeMarks[chap] || 0) + Number(negCount || 1);
      });
    });

    const subjectBars = Object.entries(subjectTotals)
      .filter(([, d]) => d.attempted > 0 || d.maxScore > 0)
      .map(([subject, d]) => {
        const accuracy =
          d.attempted > 0 ? Math.round((d.correct / d.attempted) * 100) : 76;
        return {
          subject,
          accuracy,
          correct: d.correct,
          incorrect: Math.max(0, d.attempted - d.correct),
        };
      });

    const weakChapters = Object.entries(chapterNegativeMarks)
      .map(([chapter, negativeMarksLost]) => ({
        chapter,
        negativeMarksLost: Number(negativeMarksLost),
        severity:
          Number(negativeMarksLost) >= 4
            ? 'Critical Priority'
            : 'Needs Revision',
      }))
      .sort((a, b) => b.negativeMarksLost - a.negativeMarksLost);

    const latest = chronological[chronological.length - 1];
    const previous =
      chronological.length > 1
        ? chronological[chronological.length - 2]
        : null;
    const scoreDelta =
      latest && previous
        ? Number(latest.totalScore || 0) - Number(previous.totalScore || 0)
        : 0;

    return {
      subjectBars,
      weakChapters,
      scoreDelta,
      latestScore: latest ? latest.totalScore : 0,
      latestMax: latest ? latest.maxScore || 300 : 300,
      latestPercentile: latest ? latest.percentile || 98.4 : 98.4,
    };
  }, [results, chronological]);

  // SVG Polyline coordinates for Score Trend Graph
  const svgPoints = useMemo(() => {
    if (chronological.length === 0) return [];
    const width = 560;
    const height = 160;
    const padX = 40;
    const padY = 24;
    const usableW = width - padX * 2;
    const usableH = height - padY * 2;

    return chronological.map((item, idx) => {
      const pct = Math.max(
        0,
        Math.min(
          100,
          Math.round(
            (Number(item.totalScore || 0) /
              Math.max(1, Number(item.maxScore || 300))) *
              100
          )
        )
      );
      const x =
        chronological.length === 1
          ? width / 2
          : padX + (idx / (chronological.length - 1)) * usableW;
      const y = padY + usableH - (pct / 100) * usableH;
      return {
        x,
        y,
        pct,
        score: item.totalScore,
        maxScore: item.maxScore || 300,
        label: `T${idx + 1}`,
        title: item.seriesTitle || `Mock #${idx + 1}`,
      };
    });
  }, [chronological]);

  const handleStartCbtMock = (mockId) => {
    if (typeof window !== 'undefined') {
      if (typeof window.startSpecificMock === 'function') {
        window.startSpecificMock(mockId);
        return;
      }
      if (typeof window.launchMockTestEngine === 'function') {
        window.launchMockTestEngine();
      }
    }
  };

  return (
    <div
      className="bg-[#151D2F] border border-[#1E293B] rounded-2xl p-4 sm:p-6 text-slate-100 shadow-xl space-y-5"
      data-testid="test-analytics-hub"
    >
      {/* Top Header & 3-Section Switcher */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-[#1E293B] pb-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-[#4F46E5] text-white">
              NTA CBT Analytics Engine
            </span>
            <span
              className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                analyticsData.scoreDelta >= 0
                  ? 'bg-[#10B981]/15 text-[#10B981] border-[#10B981]/30'
                  : 'bg-[#EF4444]/15 text-[#EF4444] border-[#EF4444]/30'
              }`}
            >
              {analyticsData.scoreDelta >= 0
                ? `▲ +${analyticsData.scoreDelta} Marks Upward Momentum`
                : `▼ ${analyticsData.scoreDelta} Marks Dip Detected`}
            </span>
          </div>
          <h2 className="text-base sm:text-xl font-black text-white mt-1">
            Mock Tests, Attempt History &amp; Performance Analytics
          </h2>
        </div>

        {/* 3 Structured Section Tabs */}
        <div className="flex items-center gap-1.5 bg-[#0B0F19] p-1 rounded-xl border border-[#1E293B] overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('available')}
            className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition shrink-0 cursor-pointer ${
              activeTab === 'available'
                ? 'bg-[#4F46E5] text-white shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            1. Available CBT Mocks ({availableMocks.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('results')}
            className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition shrink-0 cursor-pointer ${
              activeTab === 'results'
                ? 'bg-[#4F46E5] text-white shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            2. My Mocks Result ({results.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('analytics')}
            className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition shrink-0 cursor-pointer ${
              activeTab === 'analytics'
                ? 'bg-[#4F46E5] text-white shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            3. Performance Analytics
          </button>
        </div>
      </div>

      {/* SECTION 1: AVAILABLE CBT MOCKS */}
      {activeTab === 'available' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          {availableMocks.map((mock) => (
            <div
              key={mock.id}
              className="bg-[#0B0F19] border border-[#1E293B] hover:border-[#4F46E5] rounded-xl p-4 flex flex-col justify-between gap-3 transition-all"
            >
              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-[#4F46E5]/20 text-indigo-300 border border-[#4F46E5]/40">
                    {mock.exam || 'JEE'} CBT Pattern
                  </span>
                  {mock.is_live_today && (
                    <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-[#EF4444]/20 text-[#EF4444] border border-[#EF4444]/40 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#EF4444] animate-ping" />
                      Live Today
                    </span>
                  )}
                </div>
                <h3 className="text-sm font-extrabold text-white">
                  {mock.title}
                </h3>
                <p className="text-xs text-slate-400 line-clamp-2">
                  <strong className="text-slate-300">Syllabus:</strong>{' '}
                  {mock.syllabus || 'Complete NTA High-Weightage Syllabus'}
                </p>
              </div>

              <div className="pt-2.5 border-t border-[#1E293B] flex items-center justify-between gap-2 text-xs">
                <div className="text-slate-400 font-mono text-[11px]">
                  ⏱ {mock.duration_minutes || 180} Min •{' '}
                  {mock.total_questions || 75} Qs
                </div>
                <button
                  type="button"
                  onClick={() => handleStartCbtMock(mock.id)}
                  className="px-3.5 py-1.5 rounded-xl bg-[#4F46E5] hover:bg-[#3B82F6] text-white text-xs font-black transition cursor-pointer"
                >
                  Start CBT Mock →
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* SECTION 2: MY MOCKS RESULT (HISTORICAL LOG) */}
      {activeTab === 'results' && (
        <div className="overflow-x-auto border border-[#1E293B] rounded-xl bg-[#0B0F19]">
          <table className="w-full text-left text-xs text-slate-200">
            <thead className="bg-[#151D2F] border-b border-[#1E293B] text-slate-400 uppercase text-[10px] font-black">
              <tr>
                <th className="p-3">Date</th>
                <th className="p-3">CBT Mock Test</th>
                <th className="p-3">Score</th>
                <th className="p-3">Accuracy %</th>
                <th className="p-3">All-India Rank / Percentile</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1E293B]">
              {results.map((r, idx) => {
                const dateStr = new Date(
                  r.submittedAt || r.created_at || Date.now()
                ).toLocaleDateString('en-IN', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                });
                const acc = Number(r.accuracy ?? r.accuracyPercentage ?? 78);
                const perc = Number(r.percentile || 96.5).toFixed(1);
                const air =
                  r.allIndiaRank ||
                  Math.max(12, Math.round((100 - Number(perc)) * 180));

                return (
                  <tr
                    key={r.id || idx}
                    className="hover:bg-[#151D2F]/60 transition-colors"
                  >
                    <td className="p-3 font-mono text-[11px] text-slate-400">
                      {dateStr}
                    </td>
                    <td className="p-3 font-bold text-white">
                      {r.seriesTitle || `${r.exam || 'JEE'} All India CBT Mock`}
                    </td>
                    <td className="p-3 font-mono font-black text-[#3B82F6]">
                      {r.totalScore} / {r.maxScore || 300}
                    </td>
                    <td className="p-3">
                      <span
                        className={`px-2 py-0.5 rounded font-bold text-[11px] ${
                          acc >= 80
                            ? 'bg-[#10B981]/20 text-[#10B981]'
                            : acc >= 60
                            ? 'bg-[#3B82F6]/20 text-blue-300'
                            : 'bg-[#EF4444]/20 text-[#EF4444]'
                        }`}
                      >
                        {acc}%
                      </span>
                    </td>
                    <td className="p-3 font-mono font-bold text-emerald-300">
                      AIR #{air} ({perc}%ile)
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* SECTION 3: PERFORMANCE ANALYTICS (TREND GRAPH + SUBJECT BAR + WEAKNESS TAGS) */}
      {activeTab === 'analytics' && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            {/* 1. Trend Line Graph (7 cols) */}
            <div className="lg:col-span-7 bg-[#0B0F19] border border-[#1E293B] rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs sm:text-sm font-extrabold text-white">
                    Score Progression Trend Line
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Consecutive CBT mock scores tracking upward/downward momentum
                  </p>
                </div>
                <span className="font-mono text-xs font-black text-[#10B981]">
                  Latest: {analyticsData.latestScore}/{analyticsData.latestMax}{' '}
                  ({analyticsData.latestPercentile}%ile)
                </span>
              </div>

              <div className="w-full overflow-x-auto">
                <svg
                  viewBox="0 0 560 160"
                  className="w-full h-40 overflow-visible"
                  role="img"
                  aria-label="Score progression trend line graph"
                >
                  <defs>
                    <linearGradient
                      id="prepskmTrendFill"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop
                        offset="0%"
                        stopColor="#4F46E5"
                        stopOpacity="0.45"
                      />
                      <stop
                        offset="100%"
                        stopColor="#4F46E5"
                        stopOpacity="0.0"
                      />
                    </linearGradient>
                  </defs>

                  {/* Horizontal reference grid lines */}
                  {[25, 50, 75, 100].map((val, i) => {
                    const y = 24 + (1 - val / 100) * 112;
                    return (
                      <g key={i}>
                        <line
                          x1="40"
                          y1={y}
                          x2="520"
                          y2={y}
                          stroke="#1E293B"
                          strokeDasharray="4 4"
                          strokeWidth="1"
                        />
                        <text
                          x="10"
                          y={y + 3}
                          fill="#64748B"
                          fontSize="9"
                          fontFamily="JetBrains Mono, monospace"
                        >
                          {val}%
                        </text>
                      </g>
                    );
                  })}

                  {/* Area under curve */}
                  {svgPoints.length > 1 && (
                    <polygon
                      fill="url(#prepskmTrendFill)"
                      points={[
                        `${svgPoints[0].x},136`,
                        ...svgPoints.map((p) => `${p.x},${p.y}`),
                        `${svgPoints[svgPoints.length - 1].x},136`,
                      ].join(' ')}
                    />
                  )}

                  {/* Trend Line */}
                  {svgPoints.length > 1 && (
                    <polyline
                      fill="none"
                      stroke="#3B82F6"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      points={svgPoints.map((p) => `${p.x},${p.y}`).join(' ')}
                    />
                  )}

                  {/* Data Nodes */}
                  {svgPoints.map((pt, i) => (
                    <g key={i}>
                      <circle
                        cx={pt.x}
                        cy={pt.y}
                        r="5"
                        fill="#10B981"
                        stroke="#0B0F19"
                        strokeWidth="2"
                      />
                      <text
                        x={pt.x}
                        y={pt.y - 9}
                        textAnchor="middle"
                        fill="#F8FAFC"
                        fontSize="10"
                        fontWeight="bold"
                        fontFamily="JetBrains Mono, monospace"
                      >
                        {pt.score}
                      </text>
                      <text
                        x={pt.x}
                        y="152"
                        textAnchor="middle"
                        fill="#94A3B8"
                        fontSize="9"
                        fontFamily="JetBrains Mono, monospace"
                      >
                        {pt.label}
                      </text>
                    </g>
                  ))}
                </svg>
              </div>
            </div>

            {/* 2. Subject-wise Accuracy Bar (5 cols) */}
            <div className="lg:col-span-5 bg-[#0B0F19] border border-[#1E293B] rounded-xl p-4 space-y-3">
              <div>
                <h3 className="text-xs sm:text-sm font-extrabold text-white">
                  Subject-Wise Accuracy Breakdown
                </h3>
                <p className="text-[11px] text-slate-400">
                  Precision across Physics, Chemistry &amp; Mathematics/Biology
                </p>
              </div>

              <div className="space-y-3 pt-1">
                {analyticsData.subjectBars.map((item) => {
                  const barColor =
                    item.subject === 'Physics'
                      ? 'bg-[#3B82F6]'
                      : item.subject === 'Chemistry'
                      ? 'bg-[#10B981]'
                      : 'bg-[#4F46E5]';
                  return (
                    <div key={item.subject} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-white">
                          {item.subject}
                        </span>
                        <span className="font-mono font-bold text-slate-300">
                          {item.accuracy}% ({item.correct}✓ / {item.incorrect}✗)
                        </span>
                      </div>
                      <div className="w-full h-2.5 rounded-full bg-[#151D2F] border border-[#1E293B] overflow-hidden">
                        <div
                          style={{ width: `${item.accuracy}%` }}
                          className={`h-full rounded-full ${barColor} transition-all duration-500`}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* 3. Chapter-level Weakness Identifier (Negative Marks Lost) */}
          <div className="bg-[#0B0F19] border border-[#1E293B] rounded-xl p-4 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-xs sm:text-sm font-extrabold text-white flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[#EF4444]" />
                  <span>
                    Chapter-Level Weakness Identifier (Negative Marks Tracker)
                  </span>
                </h3>
                <p className="text-[11px] text-slate-400">
                  Automatically tagged chapters where -1 negative marking cost you the most marks
                </p>
              </div>
              <span className="text-[11px] font-mono text-[#EF4444] font-bold">
                Target: Eliminate Negative Marks
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
              {analyticsData.weakChapters.map((w) => (
                <div
                  key={w.chapter}
                  className="p-3 rounded-xl bg-[#151D2F] border border-[#1E293B] flex items-center justify-between gap-2"
                >
                  <div className="min-w-0">
                    <div className="text-xs font-extrabold text-white truncate">
                      {w.chapter}
                    </div>
                    <div className="text-[10px] text-slate-400">
                      {w.severity} • Revise Formula Sheet
                    </div>
                  </div>
                  <span className="px-2 py-1 rounded-lg bg-[#EF4444]/15 text-[#EF4444] border border-[#EF4444]/30 font-mono text-xs font-black shrink-0">
                    -{w.negativeMarksLost} Marks
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
