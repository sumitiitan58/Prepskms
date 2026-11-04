import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { resolvePlatformRoute } from '../utils/testEngine';
import {
  subscribeMentors,
  subscribeAdminSumitAvatar,
  DEFAULT_SUMIT_AVATAR,
} from '../services/firebase';
import MobileLayout from '../layouts/MobileLayout';
import VideoLectures from '../pages/VideoLectures';
import StudyMaterials from '../pages/StudyMaterials';
import MockTests from '../pages/MockTests';
import AdminDashboard from '../pages/admin/AdminDashboard';
import StudentViewer from '../components/StudentViewer';
import TeacherHost from '../components/TeacherHost';

export const VIEW_TO_PATH = {
  home: '/',
  lectures: '/videos',
  materials: '/notes',
  'mock-test': '/tests',
  analytics: '/analytics',
  live: '/live',
  mentorship: '/mentors',
  admin: '/admin',
  forum: '/forum',
  chat: '/chat',
  profile: '/profile',
};

export default function AppRoutes({
  liveEmbedState,
  onCloseLiveEmbed,
}) {
  const [activeRoute, setActiveRoute] = useState(() =>
    resolvePlatformRoute(window.location.pathname)
  );
  const [mountNodes, setMountNodes] = useState({
    mobileShellEl: null,
    videosEl: null,
    materialsEl: null,
    mockTestsEl: null,
    adminEl: null,
    liveEl: null,
  });

  // 1. Setup HTML5 Browser History Router (`pushState` + `popstate`)
  useEffect(() => {
    const originalNavigateView = window.navigateView;

    const syncHistoryNavigation = (viewId, subTab = null, fromPopState = false) => {
      let resolvedView = viewId;
      let resolvedSubTab = subTab;

      if (viewId === 'analytics') {
        resolvedView = 'mock-test';
        resolvedSubTab = 'analytics';
      }

      if (typeof originalNavigateView === 'function') {
        originalNavigateView(resolvedView, false);
      }

      if (resolvedView === 'mock-test') {
        const analyticsMount = document.getElementById('testAnalyticsMount');
        if (resolvedSubTab === 'analytics' && analyticsMount) {
          setTimeout(() => {
            analyticsMount.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }, 80);
        }
      }

      const targetPath =
        resolvedView === 'mock-test' && resolvedSubTab === 'analytics'
          ? '/analytics'
          : VIEW_TO_PATH[resolvedView] || '/';

      setActiveRoute({
        viewId: resolvedView,
        subTab: resolvedSubTab,
        canonicalPath: targetPath,
      });

      if (!fromPopState) {
        if (window.location.pathname !== targetPath) {
          window.history.pushState(
            { viewId: resolvedView, subTab: resolvedSubTab },
            '',
            targetPath
          );
        }
      }
    };

    window.navigateView = (viewId, subTabOrSkip = null) => {
      const subTab = typeof subTabOrSkip === 'string' ? subTabOrSkip : null;
      syncHistoryNavigation(viewId, subTab, false);
    };

    if (!window.history.state || !window.history.state.viewId) {
      const initial = resolvePlatformRoute(window.location.pathname);
      window.history.replaceState(
        { viewId: initial.viewId, subTab: initial.subTab },
        '',
        initial.canonicalPath
      );
      if (initial.viewId !== 'home') {
        syncHistoryNavigation(initial.viewId, initial.subTab, true);
      }
    }

    const handlePopState = (event) => {
      const state = event.state;
      if (state && state.viewId) {
        syncHistoryNavigation(state.viewId, state.subTab || null, true);
      } else {
        const resolved = resolvePlatformRoute(window.location.pathname);
        syncHistoryNavigation(resolved.viewId, resolved.subTab, true);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);

  // 2. Discover or create dedicated DOM containers inside each view section
  useEffect(() => {
    const ensureMountContainers = () => {
      // MobileLayout Shell Mount
      let mobileShellEl = document.getElementById('mobileLayoutShellMount');
      if (!mobileShellEl) {
        mobileShellEl = document.createElement('div');
        mobileShellEl.id = 'mobileLayoutShellMount';
        document.body.prepend(mobileShellEl);
      }

      // Videos Mount
      const viewLectures = document.getElementById('view-lectures');
      let videosEl = document.getElementById('reactVideoLecturesMount');
      if (viewLectures && !videosEl) {
        videosEl = document.createElement('div');
        videosEl.id = 'reactVideoLecturesMount';
        videosEl.className = 'mb-6';
        viewLectures.insertBefore(videosEl, viewLectures.firstChild);
      }

      // Notes & Study Materials Mount
      const viewMaterials = document.getElementById('view-materials');
      let materialsEl = document.getElementById('reactStudyMaterialsMount');
      if (viewMaterials && !materialsEl) {
        materialsEl = document.createElement('div');
        materialsEl.id = 'reactStudyMaterialsMount';
        materialsEl.className = 'mb-6';
        viewMaterials.insertBefore(materialsEl, viewMaterials.firstChild);
      }

      // Mock Tests Portal Mount
      let mockTestsEl = document.getElementById('reactMockTestsMount');
      const viewMockTest = document.getElementById('view-mock-test');
      if (viewMockTest && !mockTestsEl) {
        mockTestsEl = document.createElement('div');
        mockTestsEl.id = 'reactMockTestsMount';
        mockTestsEl.className = 'max-w-4xl mx-auto mb-6';
        viewMockTest.insertBefore(mockTestsEl, viewMockTest.firstChild);
      }

      // Hide legacy duplicate test analytics mount if MockTests already embeds TestAnalytics
      const legacyAnalyticsEl = document.getElementById('testAnalyticsMount');
      if (legacyAnalyticsEl) {
        legacyAnalyticsEl.style.display = 'none';
      }

      // Admin Dashboard Mount
      const viewAdmin = document.getElementById('view-admin');
      let adminEl = document.getElementById('reactAdminDashboardMount');
      if (viewAdmin && !adminEl) {
        adminEl = document.createElement('div');
        adminEl.id = 'reactAdminDashboardMount';
        adminEl.className = 'mb-6';
        viewAdmin.insertBefore(adminEl, viewAdmin.firstChild);
      }

      // Live Classroom Mount
      const liveEl = document.getElementById('liveJitsiEmbedRoot');

      setMountNodes({
        mobileShellEl,
        videosEl,
        materialsEl,
        mockTestsEl,
        adminEl,
        liveEl,
      });
    };

    ensureMountContainers();
    const timer = setTimeout(ensureMountContainers, 500);
    return () => clearTimeout(timer);
  }, [activeRoute.viewId]);

  // 3. Real-time Mentor Sumit Avatar & Multi-Mentor Sync into DOM
  useEffect(() => {
    const unsubAvatar = subscribeAdminSumitAvatar((avatarUrl) => {
      const cleanAvatar = avatarUrl || DEFAULT_SUMIT_AVATAR;
      document
        .querySelectorAll(
          '#dailyQuoteMentorAvatar, #homeLiveMentorAvatar, .mentor-dynamic-avatar'
        )
        .forEach((img) => {
          if (img instanceof HTMLImageElement) {
            img.src = cleanAvatar;
          }
        });
    });

    const unsubMentors = subscribeMentors((mentorsList) => {
      window.prepskmMentorsList = mentorsList;
      window.dispatchEvent(
        new CustomEvent('prepskm-mentors-updated', { detail: mentorsList })
      );
    });

    return () => {
      unsubAvatar();
      unsubMentors();
    };
  }, []);

  return (
    <>
      {mountNodes.mobileShellEl &&
        createPortal(
          <MobileLayout
            activeRoute={activeRoute.viewId}
            onNavigate={(viewId) => {
              if (typeof window.navigateView === 'function') {
                window.navigateView(viewId);
              }
            }}
          />,
          mountNodes.mobileShellEl
        )}

      {mountNodes.videosEl && createPortal(<VideoLectures />, mountNodes.videosEl)}

      {mountNodes.materialsEl &&
        createPortal(<StudyMaterials />, mountNodes.materialsEl)}

      {mountNodes.mockTestsEl &&
        createPortal(<MockTests />, mountNodes.mockTestsEl)}

      {mountNodes.adminEl && createPortal(<AdminDashboard />, mountNodes.adminEl)}

      {mountNodes.liveEl &&
        liveEmbedState?.active &&
        createPortal(
          liveEmbedState.isHost ? (
            <TeacherHost
              roomName={liveEmbedState.roomName}
              sessionTitle={liveEmbedState.sessionTitle}
              mentorName={liveEmbedState.displayName}
              onClose={onCloseLiveEmbed}
            />
          ) : (
            <StudentViewer
              roomName={liveEmbedState.roomName}
              sessionTitle={liveEmbedState.sessionTitle}
              studentName={liveEmbedState.displayName}
              studentEmail={liveEmbedState.email}
              hasStagePermission={Boolean(liveEmbedState.hasStagePermission)}
              onClose={onCloseLiveEmbed}
            />
          ),
          mountNodes.liveEl
        )}
    </>
  );
}
