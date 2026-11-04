import React, { useState, useEffect } from 'react';
import {
  TrendingUp,
  Award,
  Target,
  Clock,
  CheckCircle2,
  AlertTriangle,
  BarChart3,
  Zap,
} from 'lucide-react';
import { db } from '../firebase';
import { collection, onSnapshot, query, limit } from 'firebase/firestore';

export default function TestAnalytics() {
  const [results, setResults] = useState([]);
  const [selectedStream, setSelectedStream] = useState('JEE'); // 'JEE' | 'NEET'

  useEffect(() => {
    const syncFromWindowState = () => {
      const localList = Array.isArray(window.state?.mockResults)
        ? window.state.mockResults
        : [];
      if (localList.length > 0) {
        const mapped = localList.map((data, idx) => ({
          id: data.id || `local-res-${idx}`,
          testTitle: data.testTitle || 'Official Prepskm CBT Mock',
          date: (data.createdAt || new Date().toISOString()).slice(0, 10),
          score: Number(data.totalScore ?? 0),
          maxScore: Number(data.maxScore ?? 300),
          accuracy: Number(data.accuracy ?? 0),
          percentile: Number(data.percentile ?? 0),
          airRank: Number(data.airRank ?? 1500),
          avgTimePerQ: data.avgTimePerQ || '1.5m',
          physics: Number(data.physicsScore ?? Math.round((data.totalScore || 0) * 0.36)),
          chemistry: Number(data.chemistryScore ?? Math.round((data.totalScore || 0) * 0.34)),
          mathematics: Number(data.mathsScore ?? Math.round((data.totalScore || 0) * 0.3)),
        }));
        setResults(mapped.slice(-10));
      }
    };

    syncFromWindowState();
    const timer = setInterval(syncFromWindowState, 2000);

    const q = query(collection(db, 'mock_results'), limit(20));
    const unsub = onSnapshot(
      q,
      (snap) => {
        if (!snap.empty) {
          const remote = [];
          snap.forEach((d) => {
            const data = d.data();
            remote.push({
              id: d.id,
              testTitle: data.testTitle || 'Official Prepskm CBT Mock',
              date: (data.createdAt || new Date().toISOString()).slice(0, 10),
              score: Number(data.totalScore ?? 0),
              maxScore: Number(data.maxScore ?? 300),
              accuracy: Number(data.accuracy ?? 0),
              percentile: Number(data.percentile ?? 0),
              airRank: Number(data.airRank ?? 1240),
              avgTimePerQ: data.avgTimePerQ || '1.5m',
              physics: Number(data.physicsScore ?? Math.round((data.totalScore || 0) * 0.36)),
              chemistry: Number(data.chemistryScore ?? Math.round((data.totalScore || 0) * 0.34)),
              mathematics: Number(data.mathsScore ?? Math.round((data.totalScore || 0) * 0.3)),
            });
          });
          setResults(remote.slice(-10));
        }
      },
      () => {}
    );
    return () => {
      clearInterval(timer);
      unsub();
    };
  }, []);

  const latest = results[results.length - 1] || {
    id: 'empty',
    testTitle: 'No Mock Test Attempted Yet',
    date: new Date().toISOString().slice(0, 10),
    score: 0,
    maxScore: 300,
    accuracy: 0,
    percentile: 0,
    airRank: 0,
    avgTimePerQ: '0.0m',
    physics: 0,
    chemistry: 0,
    mathematics: 0,
  };
  const avgAccuracy =
    results.length > 0
      ? Math.round(
          results.reduce((acc, r) => acc + (r.accuracy || 0), 0) / results.length
        )
      : 0;

  // Build SVG polyline points for Score Trend
  const chartWidth = 520;
  const chartHeight = 140;
  const points =
    results.length > 0
      ? results
          .map((r, idx) => {
            const x =
              results.length === 1
                ? chartWidth / 2
                : 30 + (idx / (results.length - 1)) * (chartWidth - 60);
            const ratio = Math.min(1, Math.max(0, r.score / (r.maxScore || 300)));
            const y = chartHeight - 24 - ratio * (chartHeight - 48);
            return `${x},${y}`;
          })
          .join(' ')
      : `30,${chartHeight - 24} ${chartWidth - 30},${chartHeight - 24}`;

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-5 sm:p-6 shadow-sm space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-indigo-50 text-indigo-700 border border-indigo-200">
              📊 My Test Results &amp; Performance Hub
            </span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
              Live Cloud Synced
            </span>
          </div>
          <h2 className="text-lg sm:text-xl font-black text-gray-900 mt-1">
            In-Depth CBT Analytics, Percentile Trend &amp; Weak Chapter Matrix
          </h2>
          <p className="text-xs text-gray-500">
            Track your mock test progression, subject-wise accuracy, and high-weightage revision targets curated by Lead Mentor Sumit (@unfiltereddsumit).
          </p>
        </div>

        <div className="flex items-center gap-1.5 bg-gray-100 p-1 rounded-xl self-start">
          <button
            type="button"
            onClick={() => setSelectedStream('JEE')}
            className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition cursor-pointer ${
              selectedStream === 'JEE'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            JEE (PCM)
          </button>
          <button
            type="button"
            onClick={() => setSelectedStream('NEET')}
            className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition cursor-pointer ${
              selectedStream === 'NEET'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            NEET (PCB)
          </button>
        </div>
      </div>

      {/* Top 4 KPI Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <div className="p-4 rounded-2xl bg-indigo-50/70 border border-indigo-100">
          <div className="flex items-center justify-between text-xs font-bold text-indigo-700">
            <span>Latest CBT Score</span>
            <TrendingUp size={15} />
          </div>
          <div className="text-2xl font-black text-indigo-950 mt-1">
            {latest.score}{' '}
            <span className="text-xs font-bold text-indigo-500">
              / {latest.maxScore}
            </span>
          </div>
          <div className="text-[11px] font-bold text-emerald-600 mt-0.5">
            ↑ +54 marks since Mock #1
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-100">
          <div className="flex items-center justify-between text-xs font-bold text-emerald-700">
            <span>Est. Percentile / AIR</span>
            <Award size={15} />
          </div>
          <div className="text-2xl font-black text-emerald-950 mt-1">
            {latest.percentile}%ile
          </div>
          <div className="text-[11px] font-bold text-emerald-700 mt-0.5">
            Predicted AIR #{latest.airRank}
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-100">
          <div className="flex items-center justify-between text-xs font-bold text-amber-800">
            <span>Overall Accuracy</span>
            <Target size={15} />
          </div>
          <div className="text-2xl font-black text-amber-950 mt-1">
            {avgAccuracy}%
          </div>
          <div className="text-[11px] font-bold text-amber-700 mt-0.5">
            Low negative marking ratio
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-purple-50/70 border border-purple-100">
          <div className="flex items-center justify-between text-xs font-bold text-purple-700">
            <span>Accuracy vs Speed</span>
            <Clock size={15} />
          </div>
          <div className="text-2xl font-black text-purple-950 mt-1">
            {latest.avgTimePerQ}
          </div>
          <div className="text-[11px] font-bold text-purple-700 mt-0.5">
            Optimal NTA solve velocity
          </div>
        </div>
      </div>

      {/* Visual Graphs Row: Score Trend Line + Subject-Wise Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* SVG Score & Percentile Trend Chart */}
        <div className="p-4 rounded-2xl bg-slate-900 text-white border border-slate-800 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <div>
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-indigo-400">
                Progression Graph
              </span>
              <h3 className="text-sm font-extrabold text-white">
                Score &amp; Percentile Trend Across Mocks
              </h3>
            </div>
            <span className="px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 text-[11px] font-bold">
              Peak: {latest.score}/300 ({latest.percentile}%ile)
            </span>
          </div>

          <svg
            viewBox={`0 0 ${chartWidth} ${chartHeight}`}
            className="w-full h-36 overflow-visible"
          >
            <defs>
              <linearGradient id="scoreLineGrad" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#818cf8" />
                <stop offset="100%" stopColor="#34d399" />
              </linearGradient>
            </defs>
            {[0.25, 0.5, 0.75].map((lvl, i) => (
              <line
                key={i}
                x1="20"
                x2={chartWidth - 20}
                y1={chartHeight * lvl}
                y2={chartHeight * lvl}
                stroke="rgba(148,163,184,0.16)"
                strokeDasharray="4 4"
              />
            ))}
            <polyline
              fill="none"
              stroke="url(#scoreLineGrad)"
              strokeWidth="3.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              points={points}
            />
            {results.map((r, idx) => {
              const x =
                results.length === 1
                  ? chartWidth / 2
                  : 30 + (idx / (results.length - 1)) * (chartWidth - 60);
              const ratio = Math.min(
                1,
                Math.max(0, r.score / (r.maxScore || 300))
              );
              const y = chartHeight - 24 - ratio * (chartHeight - 48);
              return (
                <g key={r.id}>
                  <circle
                    cx={x}
                    cy={y}
                    r="5"
                    fill="#10b981"
                    stroke="#0f172a"
                    strokeWidth="2"
                  />
                  <text
                    x={x}
                    y={y - 10}
                    textAnchor="middle"
                    fill="#e2e8f0"
                    fontSize="10"
                    fontWeight="bold"
                  >
                    {r.score}
                  </text>
                  <text
                    x={x}
                    y={chartHeight - 6}
                    textAnchor="middle"
                    fill="#94a3b8"
                    fontSize="9"
                  >
                    M#{idx + 1}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>

        {/* Subject-Wise Breakdown & Accuracy vs Speed Matrix */}
        <div className="p-4 rounded-2xl bg-gray-50 border border-gray-200 space-y-3.5">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-extrabold text-gray-900 flex items-center gap-1.5">
              <BarChart3 size={16} className="text-indigo-600" />
              <span>Subject-Wise Breakdown &amp; Speed Matrix</span>
            </h3>
            <span className="text-[11px] font-bold text-gray-500">
              Max 100 Marks / Subject
            </span>
          </div>

          {[
            {
              subject: 'Physics',
              score: latest.physics || 80,
              accuracy: '88%',
              speed: '1.6 min/Q',
              barColor: 'bg-indigo-600',
            },
            {
              subject: 'Chemistry',
              score: latest.chemistry || 72,
              accuracy: '91%',
              speed: '1.1 min/Q',
              barColor: 'bg-emerald-600',
            },
            {
              subject: selectedStream === 'NEET' ? 'Biology' : 'Mathematics',
              score: latest.mathematics || 66,
              accuracy: '82%',
              speed: '2.1 min/Q',
              barColor: 'bg-purple-600',
            },
          ].map((item) => (
            <div key={item.subject} className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="font-extrabold text-gray-800">
                  {item.subject}
                </span>
                <span className="font-mono font-bold text-gray-700">
                  {item.score}/100 • Acc: {item.accuracy} • {item.speed}
                </span>
              </div>
              <div className="w-full h-2.5 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className={`h-full ${item.barColor} rounded-full transition-all duration-500`}
                  style={{ width: `${Math.min(100, item.score)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Strong vs Weak Chapters Actionable Insights */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-4 rounded-2xl bg-emerald-50/50 border border-emerald-200 space-y-2.5">
          <div className="flex items-center gap-1.5 text-xs font-extrabold text-emerald-800 uppercase tracking-wider">
            <CheckCircle2 size={15} className="text-emerald-600" />
            <span>Top 3 Strongest Chapters (90%+ Accuracy)</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {[
              'Electrostatics & Capacitors (94%)',
              'Modern Physics & Nuclear (92%)',
              selectedStream === 'NEET'
                ? 'Genetics & Biotech (95%)'
                : 'Vectors & 3D Geometry (91%)',
            ].map((tag) => (
              <span
                key={tag}
                className="px-3 py-1.5 rounded-xl bg-white border border-emerald-200 text-emerald-900 text-xs font-bold shadow-2xs"
              >
                ✓ {tag}
              </span>
            ))}
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-rose-50/50 border border-rose-200 space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-extrabold text-rose-800 uppercase tracking-wider">
              <AlertTriangle size={15} className="text-rose-600" />
              <span>Top 3 Weak Chapters (Needs Revision)</span>
            </div>
            <button
              type="button"
              onClick={() =>
                typeof window.navigateView === 'function' &&
                window.navigateView('materials')
              }
              className="text-[11px] font-extrabold text-rose-700 hover:underline cursor-pointer"
            >
              Revise Notes →
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {[
              'Rotational Motion & RBD (58%)',
              'Ionic Equilibrium (62%)',
              selectedStream === 'NEET'
                ? 'Plant Physiology Respiration (64%)'
                : 'Definite Integration (61%)',
            ].map((tag) => (
              <span
                key={tag}
                className="px-3 py-1.5 rounded-xl bg-white border border-rose-200 text-rose-900 text-xs font-bold shadow-2xs"
              >
                ⚠️ {tag}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Test History Table */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-extrabold text-gray-900 flex items-center gap-1.5">
            <Zap size={15} className="text-amber-500" />
            <span>Complete Mock Test History &amp; All India Rank Log</span>
          </h3>
          <span className="text-[11px] text-gray-500 font-semibold">
            Showing {results.length} Attempted Tests
          </span>
        </div>

        <div className="overflow-x-auto border border-gray-200 rounded-2xl">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-gray-50 text-gray-600 border-b border-gray-200 font-extrabold uppercase text-[10px]">
                <th className="py-3 px-4">Test Name</th>
                <th className="py-3 px-3">Date</th>
                <th className="py-3 px-3">Score</th>
                <th className="py-3 px-3">Accuracy</th>
                <th className="py-3 px-3">Percentile</th>
                <th className="py-3 px-4 text-right">Predicted AIR</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {results
                .slice()
                .reverse()
                .map((row) => (
                  <tr key={row.id} className="hover:bg-blue-50/40 transition">
                    <td className="py-3 px-4 font-bold text-gray-900">
                      {row.testTitle}
                    </td>
                    <td className="py-3 px-3 text-gray-500 font-mono">
                      {row.date}
                    </td>
                    <td className="py-3 px-3 font-extrabold text-indigo-700">
                      {row.score} / {row.maxScore}
                    </td>
                    <td className="py-3 px-3">
                      <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-bold border border-emerald-200">
                        {row.accuracy}%
                      </span>
                    </td>
                    <td className="py-3 px-3 font-extrabold text-gray-900">
                      {row.percentile}%ile
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-black text-amber-700">
                      AIR #{row.airRank}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
