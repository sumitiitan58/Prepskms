import React, { useEffect, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import VideoLectures from '../pages/VideoLectures.jsx';
import StudyMaterials from '../pages/StudyMaterials.jsx';
import TestAnalytics from '../pages/TestAnalytics.jsx';
import AdminDashboard from '../pages/AdminDashboard.jsx';

export const VIEW_TO_PATH_MAP = {
  home: '/',
  lectures: '/videos',
  videos: '/videos',
  materials: '/notes',
  notes: '/notes',
  'mock-test': '/tests',
  tests: '/tests',
  analytics: '/analytics',
  live: '/live',
  mentorship: '/mentors',
  mentors: '/mentors',
  admin: '/admin',
  forum: '/forum',
  chat: '/chat',
  profile: '/profile',
  'mentor-studio': '/mentor-studio',
};

export const PATH_TO_VIEW_MAP = {
  '/': 'home',
  '/home': 'home',
  '/videos': 'lectures',
  '/lectures': 'lectures',
  '/notes': 'materials',
  '/materials': 'materials',
  '/tests': 'mock-test',
  '/mock-test': 'mock-test',
  '/analytics': 'mock-test',
  '/live': 'live',
  '/mentors': 'mentorship',
  '/mentorship': 'mentorship',
  '/admin': 'admin',
  '/forum': 'forum',
  '/chat': 'chat',
  '/profile': 'profile',
  '/mentor-studio': 'mentor-studio',
};

export function resolveRouteFromPathname(pathname = '/') {
  const clean =
    '/' +
    String(pathname || '/')
      .trim()
      .replace(/^\/+|\/+$/g, '')
      .toLowerCase();
  const normalized = clean === '//' ? '/' : clean;
  const view = PATH_TO_VIEW_MAP[normalized] || 'home';
  const canonicalPath = VIEW_TO_PATH_MAP[
    normalized === '/analytics' ? 'analytics' : view
  ] || '/';
  return {
    pathname: normalized,
    canonicalPath,
    viewName: view,
    isAnalyticsRoute: normalized === '/analytics',
    isLiveRoute: normalized === '/live',
  };
}

/**
 * Checks if any overlay modal is currently open and closes it cleanly.
 * Returns true if a modal was closed, false otherwise.
 */
export function closeAnyOpenPlatformModal() {
  if (typeof document === 'undefined' || typeof window === 'undefined') {
    return false;
  }

  // 1. Check DOM modals in index.html
  const modalIds = [
    { id: 'aiCopilotModal', closeFn: 'closeAiCopilotModal' },
    { id: 'bigVideoPlayerModal', closeFn: 'closeBigVideoPlayer' },
    { id: 'formulaBlitzModal', closeFn: 'closeFormulaBlitzModal' },
    { id: 'callInterfaceModal', closeFn: 'endActiveCall' },
    { id: 'universalSearchModal', closeFn: 'closeUniversalSearchModal' },
    { id: 'profileAuthModal', closeFn: 'closeProfileAuthModal' },
    { id: 'curriculumManagerModal', closeFn: 'closeCurriculumManagerModal' },
    { id: 'fullCalendarModal', closeFn: 'closeFullCalendarModal' },
  ];

  for (const m of modalIds) {
    const el = document.getElementById(m.id);
    if (el && !el.classList.contains('hidden')) {
      if (typeof window[m.closeFn] === 'function') {
        window[m.closeFn]();
      } else {
        el.classList.add('hidden');
      }
      return true;
    }
  }

  // 2. Check React portals (PDFViewerModal, VideoPlayer, LiveClassroom, SubscriptionModal)
  if (typeof window.closeInAppPdfModal === 'function' && window.__isPdfModalOpen) {
    window.closeInAppPdfModal();
    return true;
  }
  if (
    typeof window.closeAdvancedVideoPlayer === 'function' &&
    window.__isVideoModalOpen
  ) {
    window.closeAdvancedVideoPlayer();
    return true;
  }
  if (
    typeof window.closeReactLiveClassroom === 'function' &&
    window.__isLiveClassroomOpen
  ) {
    window.closeReactLiveClassroom();
    return true;
  }

  return false;
}

export default function AppRoutes() {
  const [currentPath, setCurrentPath] = useState(() =>
    typeof window !== 'undefined' ? window.location.pathname || '/' : '/'
  );
  const [mounts, setMounts] = useState({
    videos: null,
    materials: null,
    analytics: null,
    admin: null,
  });

  const applyRouteToDom = useCallback((pathname, fromPopState = false) => {
    if (typeof window === 'undefined') return;
    const resolved = resolveRouteFromPathname(pathname);
    setCurrentPath(resolved.canonicalPath);

    if (resolved.isLiveRoute) {
      if (typeof window.__rawNavigateView === 'function') {
        window.__rawNavigateView('home', null, true);
      }
      if (typeof window.openReactLiveClassroom === 'function') {
        window.openReactLiveClassroom();
      }
      return;
    }

    if (typeof window.__rawNavigateView === 'function') {
      window.__rawNavigateView(resolved.viewName, null, true);
    }

    if (resolved.isAnalyticsRoute) {
      if (typeof window.setTestAnalyticsTab === 'function') {
        window.setTestAnalyticsTab('analytics');
      }
      setTimeout(() => {
        const el = document.getElementById('testAnalyticsMount');
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 80);
    } else if (resolved.viewName === 'mock-test') {
      if (typeof window.setTestAnalyticsTab === 'function') {
        window.setTestAnalyticsTab('available');
      }
    }

    if (!fromPopState && window.location.pathname !== resolved.canonicalPath) {
      try {
        window.history.pushState(
          { path: resolved.canonicalPath, view: resolved.viewName },
          '',
          resolved.canonicalPath
        );
      } catch (_e) {}
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Locate React mount containers in index.html
    const locateContainers = () => {
      const vEl = document.getElementById('reactVideoLecturesMount');
      const mEl = document.getElementById('reactStudyMaterialsMount');
      const aEl = document.getElementById('testAnalyticsMount');
      const admEl = document.getElementById('adminReactControlMount');
      setMounts((prev) => {
        if (
          prev.videos === vEl &&
          prev.materials === mEl &&
          prev.analytics === aEl &&
          prev.admin === admEl
        ) {
          return prev;
        }
        return {
          videos: vEl,
          materials: mEl,
          analytics: aEl,
          admin: admEl,
        };
      });
    };

    locateContainers();
    const mountInterval = setInterval(locateContainers, 800);

    // Wrap window.navigateView so all existing buttons in index.html push clean HTML5 History URLs
    if (
      typeof window.navigateView === 'function' &&
      !window.__rawNavigateView
    ) {
      window.__rawNavigateView = window.navigateView;
    }

    window.navigateToRoute = (targetPath) => {
      applyRouteToDom(targetPath, false);
    };

    window.navigateView = (viewName, subTab = null, skipPush = false) => {
      if (typeof window.__rawNavigateView === 'function') {
        window.__rawNavigateView(viewName, subTab);
      }
      if (!skipPush) {
        const targetPath =
          subTab === 'analytics'
            ? '/analytics'
            : VIEW_TO_PATH_MAP[viewName] || '/';
        setCurrentPath(targetPath);
        if (window.location.pathname !== targetPath) {
          try {
            window.history.pushState(
              { path: targetPath, view: viewName, subTab },
              '',
              targetPath
            );
          } catch (_e) {}
        }
      }
    };

    // Ensure initial history entry is set so Back button never exits the website prematurely
    const initialResolved = resolveRouteFromPathname(window.location.pathname);
    try {
      window.history.replaceState(
        {
          path: initialResolved.canonicalPath,
          view: initialResolved.viewName,
          rootGuard: true,
        },
        '',
        initialResolved.canonicalPath
      );
    } catch (_e) {}

    if (initialResolved.canonicalPath !== '/') {
      applyRouteToDom(initialResolved.canonicalPath, true);
    }

    const handlePopState = (event) => {
      // First: if any modal is open, close the modal and stay on the page
      if (closeAnyOpenPlatformModal()) {
        return;
      }
      const nextPath =
        event.state?.path || window.location.pathname || '/';
      applyRouteToDom(nextPath, true);
    };

    window.addEventListener('popstate', handlePopState);

    return () => {
      clearInterval(mountInterval);
      window.removeEventListener('popstate', handlePopState);
    };
  }, [applyRouteToDom]);

  return (
    <>
      {mounts.videos && createPortal(<VideoLectures />, mounts.videos)}
      {mounts.materials && createPortal(<StudyMaterials />, mounts.materials)}
      {mounts.analytics &&
        createPortal(
          <TestAnalytics
            defaultTab={currentPath === '/analytics' ? 'analytics' : 'analytics'}
          />,
          mounts.analytics
        )}
      {mounts.admin && createPortal(<AdminDashboard />, mounts.admin)}
    </>
  );
}
