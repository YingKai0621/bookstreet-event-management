import { useEffect, useRef, useState } from 'react';
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import './App.css';
import './RoleWorkspace.css';
import { useAuth } from './auth/useAuth';
import { AboutSection } from './components/landing/AboutSection';
import { BoothsSection } from './components/landing/BoothsSection';
import { EventsSection } from './components/landing/EventsSection';
import { FeedbackSection } from './components/landing/FeedbackSection';
import { Footer } from './components/landing/Footer';
import { Header } from './components/landing/Header';
import { HeritageSection } from './components/landing/HeritageSection';
import { Hero } from './components/landing/Hero';
import { InteractiveMap } from './components/landing/InteractiveMap';
import { AdminPortal } from './components/admin/AdminPortal';
import { ManagementPortal } from './components/organizer/ManagementPortal';
import { BoothsExperience } from './pages/public/BoothsExperience';
import { EventsExperience } from './pages/public/EventsExperience';
import { HeritageExperience } from './pages/public/HeritageExperience';
import { LoginPage } from './pages/public/LoginPage';
import { RegisterPage } from './pages/public/RegisterPage';
import { VerifyEmailPage } from './pages/public/VerifyEmailPage';
import { PortalLoginPage } from './pages/organizer/PortalLoginPage';
import { AdminLoginPage } from './pages/admin/AdminLoginPage';
import { ActivityDetailPage } from './pages/participant/ActivityDetailPage';
import { ActivityQrPage } from './pages/participant/ActivityQrPage';
import { EventDetailPage } from './pages/participant/EventDetailPage';
import { MyActivitiesPage } from './pages/participant/MyActivitiesPage';
import { MyCertificatesPage } from './pages/participant/MyCertificatesPage';
import { ParticipantDashboard } from './pages/participant/ParticipantDashboard';
import { ParticipantFeedbackPage } from './pages/participant/ParticipantFeedbackPage';
import { ParticipantLayout } from './pages/participant/ParticipantLayout';
import { ProfileSettingsPage } from './pages/participant/ProfileSettingsPage';
import { RewardsPage } from './pages/participant/RewardsPage';
import { PartnerActivityWorkspacePage } from './pages/partner/PartnerActivityWorkspacePage';
import { PartnerEventApplicationsPage } from './pages/partner/PartnerEventApplicationsPage';
import { PartnerEventDiscoveryPage } from './pages/partner/PartnerEventDiscoveryPage';
import { PartnerAssignedBoothsPage } from './pages/partner/PartnerAssignedBoothsPage';
import { PartnerBoothDetailPage } from './pages/partner/PartnerBoothDetailPage';
import { PartnerDashboard } from './pages/partner/PartnerDashboard';
import { PartnerLayout } from './pages/partner/PartnerLayout';
import { PartnerLoginPage } from './pages/partner/PartnerLoginPage';
import { PartnerNotificationsPage } from './pages/partner/PartnerNotificationsPage';
import { PartnerProfilePage } from './pages/partner/PartnerProfilePage';
import { PartnerReportsPage } from './pages/partner/PartnerReportsPage';
import { Sprint2PartnerBoothsPage } from './pages/partner/Sprint2PartnerBoothsPage';
import { BoothPaymentPage } from './pages/partner/BoothPaymentPage';
import { VnPayReturnPage } from './pages/partner/VnPayReturnPage';
import { migrateLegacyOrganizerUrl } from './routing/organizerRoutes';
import { participantApi } from './services/participantApi';
import { partnerApi } from './services/partnerApi';
import { publicApi } from './services/publicApi';
import { boothApi } from './services/boothApi';
import type { BoothRequest } from './types/booth';
import {
  Booth,
  EventItem,
  ExtendedHeritageProfile,
  Language,
  ParticipantActivity,
  ParticipantBadge,
  ParticipantCertificate,
  ParticipantEvent,
  ParticipantProfile,
  PartnerEventApplication,
  PartnerNotification,
  PartnerOrganization,
  PartnerReportStats,
  PartnerTodoItem
} from './types';

import './WorkspacePageHeading.css';

const EMPTY_PARTICIPANT_PROFILE: ParticipantProfile = {
  id: '', name: '', email: '', role: 'Participant', emailNotifications: false, points: 0,
};

export function App() {
  const location = useLocation();
  const navigate = useNavigate();
  const { status: authenticationStatus, user: authenticatedUser, logout } = useAuth();
  const isHeritage = /^\/di-san(?:\/|$)/.test(location.pathname);
  const isBooths = /^\/gian-hang(?:\/|$)/.test(location.pathname);
  const isEvents = /^\/su-kien(?:\/|$)/.test(location.pathname);
  const isLoginRoute = location.pathname === '/login';
  const isRegisterRoute = location.pathname === '/register';
  const isParticipantRoute = location.pathname.startsWith('/participant');
  const isVnPayReturn = location.pathname === '/payment/vnpay/return';
  const isPartnerRoute = location.pathname.startsWith('/partner') || isVnPayReturn;
  const isAdminRoute = location.pathname.startsWith('/admin');
  const isSlidePageOpen = isHeritage || isBooths || isEvents;
  const isPortalRoute = /^\/(?:portal|organizer)(?:\/|$)/.test(location.pathname);
  const isAuthenticated = authenticationStatus === 'authenticated';
  const isPortalAuthenticated = isAuthenticated && Boolean(authenticatedUser?.roles.includes('ORGANIZER'));
  const isParticipantAuthenticated = isAuthenticated && Boolean(authenticatedUser?.roles.includes('PARTICIPANT'));
  const isPartnerAuthenticated = isAuthenticated && Boolean(authenticatedUser?.roles.includes('PARTNER'));
  const isAdminAuthenticated = isAuthenticated && Boolean(authenticatedUser?.roles.includes('ADMIN'));
  const currentParticipantId = useRef<number | undefined>(undefined);
  const participantUserId = isParticipantAuthenticated ? authenticatedUser?.userId : undefined;
  useEffect(() => { currentParticipantId.current = participantUserId; }, [participantUserId]);

  // Partner State
  const [partnerOrg, setPartnerOrg] = useState<PartnerOrganization | null>(null);
  const [partnerApplications, setPartnerApplications] = useState<PartnerEventApplication[]>([]);
  const [partnerTodos, _setPartnerTodos] = useState<PartnerTodoItem[]>([]);
  const [partnerNotifications, setPartnerNotifications] = useState<PartnerNotification[]>([]);
  const [partnerReports, _setPartnerReports] = useState<PartnerReportStats | null>(null);
  const [partnerBoothRequests, setPartnerBoothRequests] = useState<BoothRequest[] | null>(null);
  const [partnerOverviewLoading, setPartnerOverviewLoading] = useState(true);
  const [partnerOverviewError, setPartnerOverviewError] = useState('');
  const [partnerBoothRequestsError, setPartnerBoothRequestsError] = useState('');

  const [language, setLanguage] = useState<Language>('vi');
  const [dataRevision, setDataRevision] = useState(0);
  const [highlightedBoothId, setHighlightedBoothId] = useState<string | null>(null);
  const [focusedBoothId, setFocusedBoothId] = useState<string | null>(null);
  const [boothSearchQuery, setBoothSearchQuery] = useState<string>('');

  useEffect(() => {
    const refresh = () => setDataRevision(value => value + 1);
    const intervalId = window.setInterval(refresh, 15000);
    window.addEventListener('focus', refresh);
    window.addEventListener('duongsach:data-changed', refresh);
    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('focus', refresh);
      window.removeEventListener('duongsach:data-changed', refresh);
    };
  }, []);

  useEffect(() => {
    if (!('scrollRestoration' in window.history)) return;

    const previousMode = window.history.scrollRestoration;
    window.history.scrollRestoration = 'manual';
    return () => {
      window.history.scrollRestoration = previousMode;
    };
  }, []);

  useEffect(() => {
    if (isSlidePageOpen || isPortalRoute || location.pathname !== '/' || location.hash) return;

    // Browsers may restore the previous scroll position after React mounts.
    // Reset once immediately and once after that restoration has completed.
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    const frameId = requestAnimationFrame(() => window.scrollTo({ top: 0, left: 0, behavior: 'auto' }));
    const timeoutId = window.setTimeout(() => window.scrollTo({ top: 0, left: 0, behavior: 'auto' }), 80);

    return () => {
      cancelAnimationFrame(frameId);
      window.clearTimeout(timeoutId);
    };
  }, [location.key, location.hash, location.pathname, isSlidePageOpen, isPortalRoute]);

  useEffect(() => {
    if (isSlidePageOpen || isPortalRoute || !location.hash) return;
    const frame = requestAnimationFrame(() => {
      document.getElementById(location.hash.slice(1))?.scrollIntoView({ behavior: 'instant' });
    });
    return () => cancelAnimationFrame(frame);
  }, [location.key, location.hash, isSlidePageOpen, isPortalRoute]);

  const [heritageList, setHeritageList] = useState<ExtendedHeritageProfile[]>([]);
  const [booths, setBooths] = useState<Booth[]>([]);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [isPublicDataLoading, setIsPublicDataLoading] = useState(true);
  const [isPublicBoothsLoading, setIsPublicBoothsLoading] = useState(false);
  const [publicBoothsError, setPublicBoothsError] = useState('');
  const [selectedPublicEventId, setSelectedPublicEventId] = useState('');
  const publicEventIdFromUrl = isBooths ? new URLSearchParams(location.search).get('eventId') : null;
  const publicEventId = events.some(event => event.id === publicEventIdFromUrl)
    ? publicEventIdFromUrl as string
    : events.some(event => event.id === selectedPublicEventId)
      ? selectedPublicEventId
      : events[0]?.id || '';

  const selectPublicEvent = (eventId: string) => {
    setSelectedPublicEventId(eventId);
    if (isBooths) navigate(`/gian-hang?eventId=${encodeURIComponent(eventId)}`);
  };

  // Load real data from Backend REST API
  useEffect(() => {
    let isMounted = true;
    const refreshPublicData = async () => {
      setIsPublicDataLoading(true);
      const [eventsRes, heritagesRes] = await Promise.allSettled([
        publicApi.getEvents(),
        publicApi.getHeritages(),
      ]);
      if (!isMounted) return;

      if (eventsRes.status === 'fulfilled') {
        setEvents(eventsRes.value);
      } else {
        console.warn('Could not fetch public events', eventsRes.reason);
        setEvents([]);
        setBooths([]);
      }

      if (heritagesRes.status === 'fulfilled') {
        setHeritageList(heritagesRes.value.map(h => ({
          ...h,
          status: 'published' as const,
          qrStatus: 'active' as const,
        })));
      } else {
        console.warn('Could not fetch public heritages', heritagesRes.reason);
      }
      setIsPublicDataLoading(false);
    };
    const handleRefresh = () => { void refreshPublicData(); };
    handleRefresh();
    window.addEventListener('focus', handleRefresh);
    window.addEventListener('duongsach:data-changed', handleRefresh);
    return () => {
      isMounted = false;
      window.removeEventListener('focus', handleRefresh);
      window.removeEventListener('duongsach:data-changed', handleRefresh);
    };
  }, []);

  useEffect(() => {
    let active = true;
    if (!publicEventId) {
      setBooths([]);
      return () => { active = false; };
    }
    setIsPublicBoothsLoading(true);
    setPublicBoothsError('');
    publicApi.getBooths(publicEventId)
      .then(rows => { if (active) setBooths(rows); })
      .catch(error => {
        if (!active) return;
        setBooths([]);
        setPublicBoothsError(error instanceof Error ? error.message : 'Không tải được gian hàng.');
      })
      .finally(() => { if (active) setIsPublicBoothsLoading(false); });
    return () => { active = false; };
  }, [publicEventId, dataRevision]);

  const [storedParticipantProfile, setParticipantProfile] = useState<ParticipantProfile>(EMPTY_PARTICIPANT_PROFILE);
  const [participantProfileError, setParticipantProfileError] = useState('');
  const [participantEvents, setParticipantEvents] = useState<ParticipantEvent[]>([]);
  const [participantActivities, setParticipantActivities] = useState<ParticipantActivity[]>([]);
  const [participantBadges, setParticipantBadges] = useState<ParticipantBadge[]>([]);
  const [participantCertificates, setParticipantCertificates] = useState<ParticipantCertificate[]>([]);

  // Never display a profile belonging to a previous session/account.
  const participantProfile: ParticipantProfile = isParticipantAuthenticated && authenticatedUser
    ? {
      ...(storedParticipantProfile.id === String(authenticatedUser.userId)
        ? storedParticipantProfile : EMPTY_PARTICIPANT_PROFILE),
      id: String(authenticatedUser.userId),
      name: storedParticipantProfile.id === String(authenticatedUser.userId)
        ? storedParticipantProfile.name : authenticatedUser.fullName,
      email: authenticatedUser.email || '',
      role: 'Participant',
    }
    : EMPTY_PARTICIPANT_PROFILE;

  useEffect(() => {
    let active = true;
    setParticipantProfile(EMPTY_PARTICIPANT_PROFILE);
    setParticipantProfileError('');
    setParticipantEvents([]);
    setParticipantActivities([]);
    setParticipantBadges([]);
    setParticipantCertificates([]);
    const refreshProfile = () => {
      if (participantUserId === undefined) return;
      const userId = String(participantUserId);
      participantApi.getProfile().then(profile => {
        if (!active) return;
        if (profile.id !== userId) throw new Error('Hồ sơ không khớp tài khoản đang đăng nhập.');
        setParticipantProfile(profile);
        setParticipantProfileError('');
      }).catch(error => {
        if (active) setParticipantProfileError(error instanceof Error ? error.message : 'Không tải được hồ sơ.');
      });
    };
    refreshProfile();
    window.addEventListener('focus', refreshProfile);
    window.addEventListener('email:verified', refreshProfile);
    return () => {
      active = false;
      window.removeEventListener('focus', refreshProfile);
      window.removeEventListener('email:verified', refreshProfile);
    };
  }, [participantUserId]);

  useEffect(() => {
    if (!isPartnerAuthenticated) return;
    // This effect synchronizes authenticated Partner data from external APIs.
    // oxlint-disable-next-line react/set-state-in-effect
    setPartnerOverviewError('');
    setPartnerBoothRequestsError('');
    setPartnerNotifications([]);
    _setPartnerReports(null);
    void Promise.allSettled([
      partnerApi.getProfile(),
      partnerApi.getApplications(),
      boothApi.listAllPartnerRequests(),
    ]).then(([profileResult, applicationsResult, boothResult]) => {
      const partnerErrors: string[] = [];
      if (profileResult.status === 'fulfilled') {
        setPartnerOrg(profileResult.value ? { ...profileResult.value, representativeName: authenticatedUser?.fullName || '' } : null);
      } else {
        console.warn('Could not fetch partner profile', profileResult.reason);
        setPartnerOrg(null);
        partnerErrors.push(profileResult.reason instanceof Error ? profileResult.reason.message : 'Không thể tải hồ sơ tổ chức.');
      }

      if (applicationsResult.status === 'fulfilled') {
        setPartnerApplications(applicationsResult.value);
      } else {
        console.warn('Could not fetch partner applications', applicationsResult.reason);
        setPartnerApplications([]);
        partnerErrors.push(applicationsResult.reason instanceof Error ? applicationsResult.reason.message : 'Không thể tải hồ sơ sự kiện.');
      }
      setPartnerOverviewError(partnerErrors.join(' '));

      if (boothResult.status === 'fulfilled') {
        setPartnerBoothRequests(boothResult.value);
      } else {
        console.warn('Could not fetch partner booth requests', boothResult.reason);
        setPartnerBoothRequests(null);
        setPartnerBoothRequestsError(boothResult.reason instanceof Error ? boothResult.reason.message : 'Không thể tải dữ liệu gian hàng.');
      }
    }).finally(() => setPartnerOverviewLoading(false));
  }, [authenticatedUser?.fullName, isPartnerAuthenticated, dataRevision]);

  // Participant Action Handlers
  const handleRegisterActivity = async (activityId: string) => {
    await participantApi.registerActivity(activityId);
    const [profile, acts, certs, badges, eventList] = await Promise.all([
      participantApi.getProfile(), participantApi.getMyActivities(),
      participantApi.getCertificates(), participantApi.getBadges(), participantApi.getEvents(),
    ]);
    if (profile) setParticipantProfile(profile);
    setParticipantActivities(acts);
    setParticipantCertificates(certs);
    setParticipantBadges(badges);
    setParticipantEvents(eventList);
    window.dispatchEvent(new Event('participant:data-changed'));
  };

  const handleCancelActivity = async (registrationId: string) => {
    await participantApi.cancelActivity(registrationId);
    const [activities, events] = await Promise.all([participantApi.getMyActivities(), participantApi.getEvents()]);
    setParticipantActivities(activities);
    setParticipantEvents(events);
    window.dispatchEvent(new Event('participant:data-changed'));
  };

  const handleOpenEventActivities = (eventId: string) => {
    navigate(`/participant/events/${eventId}?section=activities`);
  };

  const handleJoinParticipantEvent = async (eventId: string) => {
    await participantApi.joinEvent(eventId);
    setParticipantEvents(await participantApi.getEvents());
    window.dispatchEvent(new Event('participant:data-changed'));
  };

  const handleLeaveParticipantEvent = async (eventId: string) => {
    await participantApi.leaveEvent(eventId);
    setParticipantEvents(await participantApi.getEvents());
    window.dispatchEvent(new Event('participant:data-changed'));
    navigate('/participant');
  };

  const handleUpdateProfile = async (updated: Partial<ParticipantProfile>) => {
    const newProfile: ParticipantProfile = {
      ...participantProfile,
      ...updated,
      name: updated.name !== undefined ? updated.name : participantProfile.name,
      phone: updated.phone !== undefined ? updated.phone : participantProfile.phone,
      emailNotifications: updated.emailNotifications !== undefined ? updated.emailNotifications : participantProfile.emailNotifications,
    };
    if (!isParticipantAuthenticated || !authenticatedUser) throw new Error('Vui lòng đăng nhập.');
    const userId = authenticatedUser.userId;
    const saved = await participantApi.updateProfile({
        fullName: newProfile.name,
        phone: newProfile.phone,
        avatarUrl: newProfile.avatar,
    });
    if (currentParticipantId.current !== userId) return;
    if (String(saved.id) !== String(userId)) throw new Error('Hồ sơ không khớp tài khoản đang đăng nhập.');
    setParticipantProfile({ ...newProfile, id: String(saved.id), name: String(saved.fullName),
      emailVerified: Boolean(saved.emailVerified),
      phone: saved.phone ? String(saved.phone) : '', avatar: saved.avatarUrl ? String(saved.avatarUrl) : undefined });
    window.dispatchEvent(new Event('participant:data-changed'));
  };

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const handleParticipantLogout = () => {
    void handleLogout();
  };

  const scrollToSection = (sectionId: string) => {
    const el = document.getElementById(sectionId);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleHeroSearch = (query: string) => {
    setBoothSearchQuery(query);
    scrollToSection('gian-hang');
  };

  const handleSelectBoothOnMap = (boothId: string) => {
    setHighlightedBoothId(boothId);
    scrollToSection('ban-do');
  };

  const handleNavigateToBoothDetail = (boothId: string) => {
    setFocusedBoothId(boothId);
    const targetEl = document.getElementById(`booth-card-${boothId}`) || document.getElementById('gian-hang');
    if (targetEl) {
      targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    setTimeout(() => {
      setFocusedBoothId(null);
    }, 1200);
  };

  const handlePortalLogout = () => {
    void handleLogout();
  };

  // NẾU ĐANG TRUY CẬP ROUTE /portal DÀNH RIÊNG CHO BAN QUẢN LÝ
  if (isPortalRoute) {
    if (authenticationStatus === 'loading') {
      return <p className="app-loading-state">Đang kiểm tra phiên đăng nhập...</p>;
    }

    if (!isPortalAuthenticated) {
      return (
        <PortalLoginPage 
          language={language}
          onLoginSuccess={() => navigate(
            migrateLegacyOrganizerUrl(location.pathname, location.search)
              || `${location.pathname}${location.search}`,
            { replace: true },
          )}
        />
      );
    }

    const migratedOrganizerUrl = migrateLegacyOrganizerUrl(location.pathname, location.search);
    if (migratedOrganizerUrl) return <Navigate to={migratedOrganizerUrl} replace />;

    return (
      <div className="duongsach-app-root portal-mode-active">
        <ManagementPortal
          language={language}
          onLogout={handlePortalLogout}
        />
      </div>
    );
  }

  // NẾU ĐANG TRUY CẬP ROUTE /login (TRANG ĐĂNG NHẬP ĐỘC GIẢ)
  if (location.pathname === '/verify-email') return <VerifyEmailPage language={language} key={location.key} />;

  if (isLoginRoute) {
    return (
      <LoginPage 
        language={language}
        onLoginSuccess={(targetUrl?: string) => {
          navigate(targetUrl || '/');
        }}
      />
    );
  }

  // NẾU ĐANG TRUY CẬP ROUTE /register (TRANG ĐĂNG KÝ THÀNH VIÊN ĐỘC GIẢ)
  if (isRegisterRoute) {
    return (
      <RegisterPage 
        language={language}
        onRegisterSuccess={() => navigate('/login')}
      />
    );
  }

  // NẾU ĐANG TRUY CẬP KHU VỰC ĐỘC GIẢ / PARTICIPANT PORTAL (THEO BẢN PHÁC THẢO 9 MÀN HÌNH)
  if (isParticipantRoute) {
    if (authenticationStatus === 'loading') {
      return <p className="app-loading-state">Đang kiểm tra phiên đăng nhập...</p>;
    }

    if (!isParticipantAuthenticated) {
      return <Navigate to="/login" state={{ from: `${location.pathname}${location.search}` }} replace />;
    }

    if (participantProfileError) return <p role="alert">Không tải được hồ sơ: {participantProfileError}</p>;
    if (storedParticipantProfile.id !== String(authenticatedUser?.userId)) {
      return <p className="app-loading-state">Đang tải hồ sơ...</p>;
    }

    return (
      <ParticipantLayout
        language={language}
        profile={participantProfile}
        onLogout={handleParticipantLogout}
      >
        <Routes>
          <Route path="/participant" element={
            <ParticipantDashboard
              language={language}
              profile={participantProfile}
              events={participantEvents}
              activities={participantActivities}
              totalCertificatesCount={participantCertificates.length}
              onJoinEvent={handleJoinParticipantEvent}
              onRegisterActivity={handleRegisterActivity}
            />
          } />
          <Route path="/participant/events" element={
            <MyActivitiesPage
              language={language}
              activities={participantActivities}
              onCancelActivity={(activityId) => {
                const registrationId = participantActivities.find(activity => activity.id === activityId)?.registrationId;
                if (registrationId) void handleCancelActivity(registrationId);
              }}
            />
          } />
          <Route path="/participant/events/:eventId" element={<EventDetailPage language={language} events={participantEvents} activities={participantActivities}
            onRegisterActivity={handleRegisterActivity} onLeaveEvent={handleLeaveParticipantEvent} />} />
          <Route path="/participant/activities" element={<Navigate to="/participant/events" replace />} />
          <Route path="/participant/activities/detail/:activityId" element={
            <ActivityDetailPage language={language} activities={participantActivities} onRegisterActivity={handleRegisterActivity}
              onCancelActivity={(activityId) => {
                const registrationId = participantActivities.find(activity => activity.id === activityId)?.registrationId;
                if (registrationId) void handleCancelActivity(registrationId);
              }} />
          } />
          <Route path="/participant/activities/qr/:activityId" element={
            <ActivityQrPage language={language} activities={participantActivities} />
          } />
          <Route path="/participant/rewards" element={
            <RewardsPage
              language={language}
              profile={participantProfile}
              badges={participantBadges}
            />
          } />
          <Route path="/participant/certificates" element={
            <MyCertificatesPage
              language={language}
              certificates={participantCertificates}
              participantName={participantProfile.name}
            />
          } />
          <Route path="/participant/profile" element={
            <ProfileSettingsPage
              language={language}
              profile={participantProfile}
              onUpdateProfile={handleUpdateProfile}
            />
          } />
          <Route path="/participant/feedback" element={
            <ParticipantFeedbackPage
              language={language}
              userName={participantProfile.name}
              userEmail={participantProfile.email}
            />
          } />
          <Route path="/participant/*" element={<Navigate to="/participant" replace />} />
        </Routes>
      </ParticipantLayout>
    );
  }

  const handleMarkAllPartnerNotifsRead = async () => {
    await partnerApi.markAllNotificationsRead();
    setPartnerNotifications(prev => prev.map(notification => ({ ...notification, isRead: true })));
  };

  const handleMarkPartnerNotifRead = async (id: string) => {
    await partnerApi.markNotificationRead(id);
    setPartnerNotifications(prev => prev.map(notification => notification.id === id ? { ...notification, isRead: true } : notification));
  };

  const handlePartnerLogout = () => {
    void handleLogout();
  };

  // NẾU ĐANG TRUY CẬP KHU VỰC ĐỐI TÁC / PARTNER EXHIBITOR PORTAL (THEO BẢN PHÁC THẢO 10 MÀN HÌNH)
  if (isPartnerRoute) {
    if (authenticationStatus === 'loading') {
      return <p className="app-loading-state">Đang kiểm tra phiên đăng nhập...</p>;
    }

    if (!isPartnerAuthenticated) {
      return (
        <PartnerLoginPage
          language={language}
          onLoginSuccess={() => navigate(location.pathname + location.search, { replace: true })}
        />
      );
    }

    const visiblePartnerOrg: PartnerOrganization = partnerOrg || {
      id: '',
      name: authenticatedUser?.fullName || 'Đối tác', shortDesc: '',
      categoryCode: 'OTHER',
      representativeName: authenticatedUser?.fullName || '', email: authenticatedUser?.email || '',
      phone: '', address: '', website: '', categories: [], status: '',
    };

    return (
      <PartnerLayout
        language={language}
        organization={visiblePartnerOrg}
        unreadNotificationsCount={partnerNotifications.filter(n => !n.isRead).length}
        notifications={partnerNotifications}
        onMarkAllAsRead={handleMarkAllPartnerNotifsRead}
        onMarkItemAsRead={handleMarkPartnerNotifRead}
        onLogout={handlePartnerLogout}
      >
        <Routes>
          <Route path="/payment/vnpay/return" element={<VnPayReturnPage key={location.search} />} />
          <Route path="/partner/booth-requests/:requestId/payment" element={<BoothPaymentPage key={location.pathname} />} />
          <Route path="/partner" element={
            <PartnerDashboard
              language={language}
              organization={visiblePartnerOrg}
              applications={partnerApplications}
              boothRequests={partnerBoothRequests}
              todos={partnerTodos}
              isLoading={partnerOverviewLoading}
              dataError={partnerOverviewError}
              boothRequestsError={partnerBoothRequestsError}
            />
          } />
          <Route path="/partner/events" element={
            <PartnerEventApplicationsPage
              language={language}
            />
          } />
          <Route path="/partner/events/apply" element={
            <PartnerEventDiscoveryPage
              language={language}
              organization={partnerOrg}
            />
          } />
          <Route path="/partner/booths" element={
            <PartnerAssignedBoothsPage
              language={language}
              applications={partnerApplications}
            />
          } />
          <Route path="/partner/booths/:requestId" element={
            <PartnerBoothDetailPage
              language={language}
              applications={partnerApplications}
            />
          } />
          <Route path="/partner/booths/select" element={<Navigate to="/partner/booth-requests" replace />} />
          <Route path="/partner/booth-requests" element={
            <Sprint2PartnerBoothsPage
              language={language}
              applications={partnerApplications}
              allRequests={partnerBoothRequests}
            />
          } />
          <Route path="/partner/activities" element={
            <PartnerActivityWorkspacePage
              language={language}
              applications={partnerApplications}
            />
          } />
          <Route path="/partner/activities/:activityId" element={
            <PartnerActivityWorkspacePage
              language={language}
              applications={partnerApplications}
            />
          } />
          <Route path="/partner/reports" element={
            partnerReports
              ? <PartnerReportsPage language={language} reportStats={partnerReports} />
              : <p className="app-loading-state">Chưa có API báo cáo để tải dữ liệu từ hệ thống.</p>
          } />
          <Route path="/partner/notifications" element={
            <PartnerNotificationsPage
              language={language}
              notifications={partnerNotifications}
              onMarkAllAsRead={handleMarkAllPartnerNotifsRead}
              onMarkItemAsRead={handleMarkPartnerNotifRead}
            />
          } />
          <Route path="/partner/organization" element={<Navigate to="/partner/profile" replace />} />
          <Route path="/partner/profile" element={
            <PartnerProfilePage
              language={language}
              organization={visiblePartnerOrg}
              onUpdateOrg={async (updated) => {
                const savedOrganization = await partnerApi.updateProfile({
                  ...visiblePartnerOrg,
                  ...updated,
                });
                setPartnerOrg({
                  ...savedOrganization,
                  representativeName: authenticatedUser?.fullName || '',
                });
              }}
            />
          } />
          <Route path="/partner/*" element={<Navigate to="/partner" replace />} />
        </Routes>
      </PartnerLayout>
    );
  }

  // --- Admin Portal Handlers & Routing ---
  const handleAdminLogout = () => {
    void handleLogout();
  };

  // NẾU ĐANG TRUY CẬP KHU VỰC QUẢN TRỊ VIÊN HỆ THỐNG / ADMIN PORTAL (/admin)
  if (isAdminRoute) {
    if (authenticationStatus === 'loading') {
      return <p className="app-loading-state">Đang kiểm tra phiên đăng nhập...</p>;
    }

    if (!isAdminAuthenticated) {
      return (
        <AdminLoginPage
          language={language}
          onLoginSuccess={() => navigate(`${location.pathname}${location.search}`, { replace: true })}
        />
      );
    }

    return (
      <div className="duongsach-app-root admin-mode-active">
        <AdminPortal
          language={language}
          onLogout={handleAdminLogout}
        />
      </div>
    );
  }

  // GIAO DIỆN CÔNG KHAI / ĐỘC GIẢ & GIAN HÀNG
  return (
    <div className="duongsach-app-root">
      {/* 1. Header công khai */}
      <Header 
        isHeritage={isHeritage}
        onToggleHeritage={() => navigate(isHeritage ? '/' : '/di-san')}
        language={language} 
        onLanguageChange={(lang) => setLanguage(lang)}
        isManagementPortal={false}
        isParticipantAuthenticated={isParticipantAuthenticated}
        participantProfile={participantProfile}
        onParticipantLogout={handleParticipantLogout}
      />

      <div className={`main-app-container ${isSlidePageOpen ? 'heritage-active-bg' : ''}`} inert={isSlidePageOpen} aria-hidden={isSlidePageOpen || undefined}>
        <main id="main-content">
          {/* 2. Hero Section: "Mở sách, bước vào phố" tích hợp Ô tìm kiếm gian hàng, sách */}
          <Hero 
            language={language}
            onExploreClick={() => scrollToSection('gioi-thieu')}
            onMapClick={() => scrollToSection('ban-do')}
            onSearch={handleHeroSearch}
            isLoggedIn={isParticipantAuthenticated || isPartnerAuthenticated || isPortalAuthenticated || isAdminAuthenticated}
            booths={booths}
          />

          {/* 3. Core Values: "Vì sao nên ghé Đường Sách?" */}
          <AboutSection language={language} />

          {/* 4. Experience Stroll: "Dạo một vòng Đường Sách" */}
          {/* 5. Bookstalls with Real Photography & Staggered Reveal */}
          <BoothsSection 
            language={language}
            booths={booths}
            isLoading={isPublicDataLoading || isPublicBoothsLoading}
            error={publicBoothsError}
            events={events}
            selectedEventId={publicEventId}
            onSelectEventId={selectPublicEvent}
            onSelectBoothOnMap={handleSelectBoothOnMap}
            searchQuery={boothSearchQuery}
            onSearchQueryChange={setBoothSearchQuery}
            focusedBoothId={focusedBoothId}
          />

          {/* 6. Events Schedule with Real Photography & Bookstall Proposal Flow */}
          <EventsSection 
            language={language} 
            events={events}
            isLoading={isPublicDataLoading}
            isParticipantAuthenticated={isParticipantAuthenticated}
            participantProfile={participantProfile}
            onRegisterActivity={handleRegisterActivity}
            onJoinEvent={handleOpenEventActivities}
          />

          {/* 6.5 Heritage Trail Section - Di sản văn hóa */}
          <HeritageSection
            language={language}
            heritageList={heritageList}
            isLoading={isPublicDataLoading}
          />

          {/* 7. Interactive Map (Paper Unfolding Effect) */}
          <InteractiveMap 
            language={language}
            events={events}
            selectedEventId={publicEventId}
            onSelectEventId={selectPublicEvent}
            booths={booths}
            isLoading={isPublicDataLoading}
            highlightedBoothId={highlightedBoothId}
            onNavigateToBoothDetail={handleNavigateToBoothDetail}
          />

          {/* 9. Feedback Section in Figma Dark Teal Container */}
          <FeedbackSection 
            language={language} 
            onScrollToTop={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          />
        </main>

        {/* 10. Footer */}
        <Footer language={language} />
      </div>

      {/* Full Dedicated Sliding Experience Pages (Right to Left Transition) */}
      <HeritageExperience language={language} open={isHeritage} heritageList={heritageList} />
      <BoothsExperience 
        language={language} 
        open={isBooths} 
        booths={booths} 
        events={events}
        isLoading={isPublicDataLoading || isPublicBoothsLoading}
        selectedEventId={publicEventId}
        onSelectEventId={selectPublicEvent}
        error={publicBoothsError}
        onSelectBoothOnMap={handleSelectBoothOnMap} 
      />
      <EventsExperience 
        language={language} 
        open={isEvents} 
        events={events} 
        isLoading={isPublicDataLoading}
        isParticipantAuthenticated={isParticipantAuthenticated}
        participantProfile={participantProfile}
        onJoinEvent={handleOpenEventActivities}
      />

    </div>
  );
}

export default App;
