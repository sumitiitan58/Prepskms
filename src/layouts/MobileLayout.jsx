import React, { useState, useEffect } from 'react';
import {
  GraduationCap,
  Search,
  Bell,
  Home,
  PlayCircle,
  ClipboardCheck,
  User,
  Sparkles,
  X,
  Radio,
  ArrowRight,
  Send,
  BookOpen,
} from 'lucide-react';
import {
  subscribeLiveNotifications,
  subscribeLiveSession,
} from '../services/firebase';

export default function MobileLayout({ activeRoute = 'home', onNavigate }) {
  const [searchExpanded, setSearchExpanded] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [liveSession, setLiveSession] = useState(null);
  const [dismissedBannerId, setDismissedBannerId] = useState('');

  // Floating Prep AI Tutor Modal state
  const [aiOpen, setAiOpen] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiMessages, setAiMessages] = useState([
    {
      role: 'assistant',
      text: 'Hi! I am Prep AI by Mentor Sumit (@unfiltereddsumit). Ask me any Physics, Chemistry, Maths, or Biology doubt, formula derivation, or CBT rank strategy!',
    },
  ]);
  const [aiLoading, setAiLoading] = useState(false);

  useEffect(() => {
    const unsubNotifs = subscribeLiveNotifications((list) => {
      setNotifications(list || []);
    });
    const unsubLive = subscribeLiveSession((cfg) => {
      setLiveSession(cfg || null);
    });
    return () => {
      unsubNotifs();
      unsubLive();
    };
  }, []);

  const triggerNav = (viewId) => {
    if (onNavigate) {
      onNavigate(viewId);
    } else if (typeof window !== 'undefined' && typeof window.navigateView === 'function') {
      window.navigateView(viewId);
    }
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    const q = searchQuery.trim().toLowerCase();
    if (!q) return;
    const globalInput = document.getElementById('globalSearchInput');
    if (globalInput) {
      globalInput.value = searchQuery;
      globalInput.dispatchEvent(new Event('input', { bubbles: true }));
    }
    if (q.includes('test') || q.includes('mock') || q.includes('cbt')) {
      triggerNav('mock-test');
    } else if (q.includes('pdf') || q.includes('note') || q.includes('formula')) {
      triggerNav('materials');
    } else if (q.includes('live')) {
      triggerNav('live');
    } else {
      triggerNav('lectures');
    }
  };

  const handleAskPrepAi = async (e) => {
    e.preventDefault();
    const trimmed = aiPrompt.trim();
    if (!trimmed || aiLoading) return;

    const nextHistory = [...aiMessages, { role: 'user', text: trimmed }];
    setAiMessages(nextHistory);
    setAiPrompt('');
    setAiLoading(true);

    try {
      const res = await fetch('/.netlify/functions/gemini', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: trimmed,
          systemInstruction:
            'You are Prep AI, the official JEE & NEET doubt-solving assistant on Prepskm (prepskm.in) led by Mentor Sumit (@unfiltereddsumit). Provide crisp, step-by-step derivations, formula shortcuts, and NTA CBT exam strategy.',
        }),
      });
      const data = await res.json().catch(() => ({}));
      const reply =
        data?.text ||
        'Key Concept: Apply dimensional analysis and conservation laws first, then eliminate boundary-case options to avoid -1 negative marking.';
      setAiMessages((prev) => [...prev, { role: 'assistant', text: reply }]);
    } catch {
      setAiMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          text: 'Tip from Mentor Sumit: Focus on NCERT + last 5 years NTA PYQs for this topic, and verify units before locking your CBT option.',
        },
      ]);
    } finally {
      setAiLoading(false);
    }
  };

  const showLivePushBanner =
    liveSession?.isActive &&
    dismissedBannerId !== `${liveSession.title}_${liveSession.updatedAt || ''}`;

  return (
    <>
      {/* Instant In-App Push Banner when Mentor Sumit is LIVE */}
      {showLivePushBanner && (
        <div className="bg-indigo-600 text-white px-4 py-2.5 shadow-sm border-b border-indigo-700 flex items-center justify-between gap-3 z-50">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-red-500 text-white text-[10px] font-extrabold uppercase tracking-wider shrink-0">
              <Radio className="w-3 h-3 animate-pulse" /> LIVE NOW
            </span>
            <p className="text-xs sm:text-sm font-bold truncate">
              Mentor Sumit is now LIVE: {liveSession.title || 'Live Doubt & Rank Booster Session'}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => triggerNav('live')}
              className="px-3 py-1 rounded-lg bg-white text-indigo-700 hover:bg-indigo-50 text-xs font-extrabold flex items-center gap-1 transition-colors"
            >
              Join Stream <ArrowRight className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() =>
                setDismissedBannerId(`${liveSession.title}_${liveSession.updatedAt || ''}`)
              }
              className="p-1 text-indigo-200 hover:text-white rounded"
              aria-label="Dismiss live banner"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Minimalist Mobile Top Bar: Brand "Prepskm" with Graduation Cap + ONLY (1) Search Bar & (2) Notification Bell */}
      <div
        id="prepskmMobileMinimalHeader"
        className="md:hidden sticky top-0 z-40 bg-[#FFFFFF] border-b border-[#E2E8F0] px-3.5 py-2.5 flex items-center justify-between gap-2 shadow-xs"
      >
        {/* Official Brand Name "Prepskm" with Graduation Cap */}
        {!searchExpanded && (
          <button
            type="button"
            onClick={() => triggerNav('home')}
            className="flex items-center gap-2 text-left shrink-0"
          >
            <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center shadow-xs">
              <GraduationCap className="w-5 h-5" />
            </div>
            <div>
              <span className="text-base font-extrabold tracking-tight text-[#1E293B] block leading-none">
                Prepskm
              </span>
              <span className="text-[10px] font-semibold text-indigo-600 block mt-0.5">
                JEE • NEET Portal
              </span>
            </div>
          </button>
        )}

        {/* 1. Expandable Search Bar + 2. Notification Bell Icon */}
        <div className={`flex items-center gap-2 ${searchExpanded ? 'w-full' : 'ml-auto flex-1 justify-end'}`}>
          <form
            onSubmit={handleSearchSubmit}
            className={`flex items-center bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg px-2.5 py-1.5 transition-all ${
              searchExpanded ? 'w-full' : 'w-40 sm:w-52'
            }`}
          >
            <Search className="w-3.5 h-3.5 text-slate-400 shrink-0 mr-1.5" />
            <input
              type="text"
              value={searchQuery}
              onFocus={() => setSearchExpanded(true)}
              onBlur={() => {
                if (!searchQuery) setSearchExpanded(false);
              }}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search lectures, PDFs, tests..."
              aria-label="Search Prepskm"
              className="w-full bg-transparent text-xs text-[#1E293B] placeholder-slate-400 focus:outline-none"
            />
            {searchExpanded && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setSearchExpanded(false);
                }}
                className="text-slate-400 hover:text-slate-600 ml-1"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </form>

          {/* 2. Notification Bell Icon */}
          <button
            type="button"
            onClick={() => setNotifOpen((prev) => !prev)}
            aria-label="Notifications"
            className="relative p-2 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0] text-[#1E293B] hover:border-indigo-300 transition-colors shrink-0"
          >
            <Bell className="w-4 h-4 text-slate-700" />
            {(notifications.length > 0 || liveSession?.isActive) && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-white text-[9px] font-extrabold flex items-center justify-center">
                {Math.min(9, notifications.length + (liveSession?.isActive ? 1 : 0))}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Notification Dropdown Drawer */}
      {notifOpen && (
        <div className="fixed inset-x-3 top-14 sm:left-auto sm:right-6 sm:w-96 z-50 bg-[#FFFFFF] border border-[#E2E8F0] rounded-xl shadow-xl p-4">
          <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-[#E2E8F0]">
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-indigo-600" />
              <h4 className="text-xs font-extrabold text-[#1E293B] uppercase tracking-wider">
                Live Announcements & Alerts
              </h4>
            </div>
            <button
              type="button"
              onClick={() => setNotifOpen(false)}
              className="p-1 text-slate-400 hover:text-slate-700 rounded"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="space-y-2 max-h-72 overflow-y-auto">
            {liveSession?.isActive && (
              <div
                onClick={() => {
                  setNotifOpen(false);
                  triggerNav('live');
                }}
                className="p-2.5 rounded-lg bg-red-50 border border-red-200 cursor-pointer hover:bg-red-100/70 transition-colors"
              >
                <div className="flex items-center gap-1.5 text-[10px] font-extrabold text-red-600 uppercase">
                  <Radio className="w-3 h-3 animate-pulse" /> LIVE CLASSROOM ACTIVE
                </div>
                <p className="text-xs font-bold text-[#1E293B] mt-0.5">
                  Mentor Sumit is now LIVE: {liveSession.title}
                </p>
              </div>
            )}
            {notifications.length === 0 && !liveSession?.isActive ? (
              <p className="text-xs text-slate-500 py-6 text-center">
                No new notifications right now. Stay consistent with your daily targets!
              </p>
            ) : (
              notifications.slice(0, 8).map((item) => (
                <div
                  key={item.id}
                  onClick={() => {
                    setNotifOpen(false);
                    if (item.targetRoute === '/live') triggerNav('live');
                    else if (item.targetRoute === '/tests') triggerNav('mock-test');
                    else if (item.targetRoute === '/videos') triggerNav('lectures');
                  }}
                  className="p-2.5 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0] hover:border-indigo-300 cursor-pointer transition-colors"
                >
                  <p className="text-xs font-bold text-[#1E293B]">{item.title}</p>
                  {item.message && (
                    <p className="text-[11px] text-slate-600 mt-0.5">{item.message}</p>
                  )}
                  <span className="text-[10px] text-slate-400 block mt-1">
                    {item.author || 'Sumit (@unfiltereddsumit)'}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Floating Action Button (FAB): "Prep AI" Assistant pinned to bottom-right */}
      <button
        type="button"
        id="prepAiFloatingFab"
        onClick={() => setAiOpen(true)}
        className="fixed bottom-20 md:bottom-6 right-4 md:right-6 z-40 flex items-center gap-2 px-4 py-2.5 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs shadow-lg border border-indigo-500 transition-transform active:scale-95"
      >
        <Sparkles className="w-4 h-4" />
        <span>Prep AI</span>
      </button>

      {/* Prep AI Doubt Solver Modal (Light Theme) */}
      {aiOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-[#FFFFFF] border border-[#E2E8F0] w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col max-h-[82vh] overflow-hidden">
            <div className="px-4 py-3 bg-[#F8FAFC] border-b border-[#E2E8F0] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-[#1E293B]">
                    Prep AI • 24×7 JEE/NEET Doubt Tutor
                  </h3>
                  <p className="text-[10px] text-slate-500">
                    Powered by @unfiltereddsumit Strategy Engine
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setAiOpen(false)}
                className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-200/60"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 space-y-3 overflow-y-auto flex-1 bg-[#FFFFFF]">
              {aiMessages.map((msg, i) => (
                <div
                  key={i}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[85%] rounded-xl px-3.5 py-2.5 text-xs leading-relaxed ${
                      msg.role === 'user'
                        ? 'bg-indigo-600 text-white font-medium'
                        : 'bg-[#F8FAFC] border border-[#E2E8F0] text-[#1E293B]'
                    }`}
                  >
                    {msg.text}
                  </div>
                </div>
              ))}
              {aiLoading && (
                <div className="text-xs text-indigo-600 font-semibold animate-pulse">
                  Prep AI is solving your doubt...
                </div>
              )}
            </div>

            <form
              onSubmit={handleAskPrepAi}
              className="p-3 bg-[#F8FAFC] border-t border-[#E2E8F0] flex items-center gap-2"
            >
              <input
                type="text"
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                placeholder="Ask any Physics, Chemistry, Maths or Biology question..."
                className="flex-1 bg-[#FFFFFF] border border-[#E2E8F0] rounded-lg px-3 py-2 text-xs text-[#1E293B] placeholder-slate-400 focus:outline-none focus:border-indigo-500"
              />
              <button
                type="submit"
                disabled={aiLoading}
                className="px-3.5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-1"
              >
                <Send className="w-3.5 h-3.5" /> Ask
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Mobile Bottom Navigation Bar: Strictly 4 Core Tabs (1. Home, 2. Videos, 3. Mock Tests, 4. Profile) */}
      <nav
        id="prepskmFourTabBottomNav"
        aria-label="Mobile Primary Navigation"
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#FFFFFF] border-t border-[#E2E8F0] px-2 py-1.5 grid grid-cols-4 gap-1 shadow-sm"
      >
        <button
          type="button"
          onClick={() => triggerNav('home')}
          className={`flex flex-col items-center justify-center py-1 rounded-lg transition-colors ${
            activeRoute === 'home'
              ? 'text-indigo-600 font-extrabold bg-indigo-50/70'
              : 'text-slate-600 hover:text-[#1E293B] font-semibold'
          }`}
        >
          <Home className="w-4 h-4 mb-0.5" />
          <span className="text-[11px]">Home</span>
        </button>

        <button
          type="button"
          onClick={() => triggerNav('lectures')}
          className={`flex flex-col items-center justify-center py-1 rounded-lg transition-colors ${
            activeRoute === 'lectures'
              ? 'text-indigo-600 font-extrabold bg-indigo-50/70'
              : 'text-slate-600 hover:text-[#1E293B] font-semibold'
          }`}
        >
          <PlayCircle className="w-4 h-4 mb-0.5" />
          <span className="text-[11px]">Videos</span>
        </button>

        <button
          type="button"
          onClick={() => triggerNav('mock-test')}
          className={`flex flex-col items-center justify-center py-1 rounded-lg transition-colors ${
            activeRoute === 'mock-test'
              ? 'text-indigo-600 font-extrabold bg-indigo-50/70'
              : 'text-slate-600 hover:text-[#1E293B] font-semibold'
          }`}
        >
          <ClipboardCheck className="w-4 h-4 mb-0.5" />
          <span className="text-[11px]">Mock Tests</span>
        </button>

        <button
          type="button"
          onClick={() => triggerNav('profile')}
          className={`flex flex-col items-center justify-center py-1 rounded-lg transition-colors ${
            activeRoute === 'profile'
              ? 'text-indigo-600 font-extrabold bg-indigo-50/70'
              : 'text-slate-600 hover:text-[#1E293B] font-semibold'
          }`}
        >
          <User className="w-4 h-4 mb-0.5" />
          <span className="text-[11px]">Profile</span>
        </button>
      </nav>
    </>
  );
}
