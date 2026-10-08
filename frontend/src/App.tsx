import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { Hero } from './components/Hero';
import { AboutSection } from './components/AboutSection';
import { BoothsSection } from './components/BoothsSection';
import { EventsSection } from './components/EventsSection';
import { HeritageSection } from './components/HeritageSection';
import { InteractiveMap } from './components/InteractiveMap';
import { useLocation, useNavigate, Routes, Route, Navigate } from 'react-router-dom';
import { HeritageExperience } from './pages/HeritageExperience';
import { BoothsExperience } from './pages/BoothsExperience';
import { EventsExperience } from './pages/EventsExperience';
import { FeedbackSection } from './components/FeedbackSection';
import { Footer } from './components/Footer';
import { ManagementPortal } from './components/ManagementPortal';
import { PortalLoginPage } from './pages/PortalLoginPage';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { ParticipantLayout } from './pages/participant/ParticipantLayout';
import { ParticipantDashboard } from './pages/participant/ParticipantDashboard';
import { EventDetailPage } from './pages/participant/EventDetailPage';
import { ActivityDetailPage } from './pages/participant/ActivityDetailPage';
import { MyActivitiesPage } from './pages/participant/MyActivitiesPage';
import { ActivityQrPage } from './pages/participant/ActivityQrPage';
import { RewardsPage } from './pages/participant/RewardsPage';
import { MyCertificatesPage } from './pages/participant/MyCertificatesPage';
import { ProfileSettingsPage } from './pages/participant/ProfileSettingsPage';
import { ParticipantFeedbackPage } from './pages/participant/ParticipantFeedbackPage';
import { PartnerLayout } from './pages/partner/PartnerLayout';
import { PartnerLoginPage } from './pages/partner/PartnerLoginPage';
import { PartnerDashboard } from './pages/partner/PartnerDashboard';
import { EventApplicationPage } from './pages/partner/EventApplicationPage';
import { BoothSelectionPage } from './pages/partner/BoothSelectionPage';
import { BoothManagementPage } from './pages/partner/BoothManagementPage';
import { Sprint2PartnerBoothsPage } from './pages/partner/Sprint2PartnerBoothsPage';
import { ActivityProposalPage } from './pages/partner/ActivityProposalPage';
import { PartnerActivityDetailPage } from './pages/partner/PartnerActivityDetailPage';
import { PartnerReportsPage } from './pages/partner/PartnerReportsPage';
import { PartnerNotificationsPage } from './pages/partner/PartnerNotificationsPage';
import { PartnerProfilePage } from './pages/partner/PartnerProfilePage';
import { ActivityAttendanceModal } from './pages/partner/ActivityAttendanceModal';
import { AdminPortal } from './components/AdminPortal';
import { AdminLoginPage } from './pages/admin/AdminLoginPage';
import { 
  Language, 
  EventItem, 
  Booth, 
  ExtendedHeritageProfile,
  ParticipantProfile,
  ParticipantEvent,
  ParticipantActivity,
  ParticipantBadge,
  ParticipantCertificate,
  PartnerOrganization,
  PartnerEventApplication,
  PartnerBooth,
  PartnerActivityProposal,
  PartnerTodoItem,
  PartnerNotification,
  PartnerReportStats,
  AttendanceScanRecord
} from './types';
import { participantApi } from './services/participantApi';
import { partnerApi } from './services/partnerApi';
import { publicApi } from './services/publicApi';
import { useAuth } from './auth/useAuth';
import './App.css';

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
  const isPartnerRoute = location.pathname.startsWith('/partner');
  const isAdminRoute = location.pathname.startsWith('/admin');
  const isSlidePageOpen = isHeritage || isBooths || isEvents;
  const isPortalRoute = location.pathname === '/portal' || location.pathname === '/organizer';
  const isAuthenticated = authenticationStatus === 'authenticated';
  const isPortalAuthenticated = isAuthenticated && Boolean(authenticatedUser?.roles.includes('ORGANIZER'));
  const isParticipantAuthenticated = isAuthenticated && Boolean(authenticatedUser?.roles.includes('PARTICIPANT'));
  const isPartnerAuthenticated = isAuthenticated && Boolean(authenticatedUser?.roles.includes('PARTNER'));
  const isAdminAuthenticated = isAuthenticated && Boolean(authenticatedUser?.roles.includes('ADMIN'));

  // Partner State
  const [partnerOrg, setPartnerOrg] = useState<PartnerOrganization | null>(null);
  const [partnerApp, setPartnerApp] = useState<PartnerEventApplication | null>(null);
  const [partnerBooths, setPartnerBooths] = useState<PartnerBooth[]>([]);
  const [partnerApplications, setPartnerApplications] = useState<PartnerEventApplication[]>([]);
  const [partnerEventLocations, setPartnerEventLocations] = useState<Array<{ id: string; name: string; capacity: number }>>([]);
  const [partnerAssets, setPartnerAssets] = useState<Array<{ id: string; name: string; totalQuantity: number }>>([]);
  const [partnerActivities, setPartnerActivities] = useState<PartnerActivityProposal[]>([]);
  const [partnerTodos, _setPartnerTodos] = useState<PartnerTodoItem[]>([]);
  const [partnerNotifications, setPartnerNotifications] = useState<PartnerNotification[]>([]);
  const [partnerReports, _setPartnerReports] = useState<PartnerReportStats | null>(null);
  const [attendanceScans, setAttendanceScans] = useState<AttendanceScanRecord[]>([]);
  const [activeAttendanceActivityId, setActiveAttendanceActivityId] = useState<string | null>(null);

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

  // Load real data from Backend REST API
  useEffect(() => {
    let isMounted = true;
    const refreshPublicData = () => {
      setIsPublicDataLoading(true);
      Promise.allSettled([
        publicApi.getEvents(),
        publicApi.getBooths(),
        publicApi.getHeritages(),
        new Promise(resolve => setTimeout(resolve, 600)),
      ]).then(([eventsRes, boothsRes, heritagesRes]) => {
        if (!isMounted) return;
        if (eventsRes.status === 'fulfilled') {
          setEvents(eventsRes.value);
        } else {
          console.warn('Could not fetch public events', eventsRes.reason);
        }
        if (boothsRes.status === 'fulfilled') {
          setBooths(boothsRes.value);
        } else {
          console.warn('Could not fetch public booths', boothsRes.reason);
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
      });
    };
    refreshPublicData();
    window.addEventListener('focus', refreshPublicData);
    window.addEventListener('duongsach:data-changed', refreshPublicData);
    return () => {
      isMounted = false;
      window.removeEventListener('focus', refreshPublicData);
      window.removeEventListener('duongsach:data-changed', refreshPublicData);
    };
  }, []);

  const [storedParticipantProfile, setParticipantProfile] = useState<ParticipantProfile>(() => {
    try {
      const saved = localStorage.getItem('duongsach_participant_profile');
      return saved ? JSON.parse(saved) : EMPTY_PARTICIPANT_PROFILE;
    } catch {
      return EMPTY_PARTICIPANT_PROFILE;
    }
  });
  const [participantEvents, setParticipantEvents] = useState<ParticipantEvent[]>([]);
  const [participantActivities, setParticipantActivities] = useState<ParticipantActivity[]>([]);
  const [participantBadges, setParticipantBadges] = useState<ParticipantBadge[]>([]);
  const [participantCertificates, setParticipantCertificates] = useState<ParticipantCertificate[]>([]);

  // Sprint 1 exposes the authenticated account, combined with locally saved participant preferences.
  const participantProfile: ParticipantProfile = isParticipantAuthenticated && authenticatedUser
    ? {
      ...storedParticipantProfile,
      id: String(authenticatedUser.userId),
      name: storedParticipantProfile.name || authenticatedUser.fullName,
      email: authenticatedUser.email || storedParticipantProfile.email || '',
      phone: storedParticipantProfile.phone || '',
      emailNotifications: storedParticipantProfile.emailNotifications ?? true,
      role: 'Participant',
    }
    : storedParticipantProfile;

  useEffect(() => {
    if (!isPartnerAuthenticated) return;
    Promise.all([
      partnerApi.getProfile(),
      partnerApi.getApplications(),
    ])
      .then(([organization, applications]) => {
        setPartnerOrg(organization ? {
          ...organization,
          representativeName: authenticatedUser?.fullName || '',
        } : null);
        setPartnerApplications(applications);
        setPartnerApp(applications[0] || null);
        setPartnerActivities([]); setPartnerNotifications([]); setPartnerAssets([]);
        setPartnerBooths([]); _setPartnerReports(null); setPartnerEventLocations([]);
      })
      .catch(error => console.warn('Could not fetch partner data', error));
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
    navigate(`/participant/events/${eventId}`);
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
    setParticipantProfile(newProfile);
    try {
      localStorage.setItem('duongsach_participant_profile', JSON.stringify(newProfile));
      await participantApi.updateProfile({
        fullName: newProfile.name,
        phone: newProfile.phone,
        emailNotifications: newProfile.emailNotifications,
      });
    } catch (e) {
      console.warn('Backend sync not available in Sprint 1, saved profile locally', e);
    }
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
          onLoginSuccess={() => navigate('/portal')}
        />
      );
    }

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
      return <Navigate to="/login" state={{ from: location.pathname }} replace />;
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
        </Routes>
      </ParticipantLayout>
    );
  }

  // --- Partner Handlers ---
  const handleSelectPartnerBooth = async (boothId: string) => {
    if (!partnerOrg || !partnerApp) return;
    await partnerApi.requestBooth({ eventId: partnerApp.eventId, boothId });
    setPartnerBooths(await partnerApi.getBooths(partnerApp.eventId));
  };

  const handleAddPartnerActivity = async (newAct: Omit<PartnerActivityProposal, 'id'>) => {
    if (!partnerApp) throw new Error('Chưa có sự kiện đối tác đang tham gia');
    const [day, month, year] = newAct.date.split('/');
    const [startTime, endTime] = newAct.time.split('–').map(value => value.trim());
    const kindByCategory: Record<PartnerActivityProposal['category'], string> = {
      Workshop: 'workshop', Talkshow: 'talkshow', Minigame: 'minigame', Signings: 'signing', Exhibition: 'exhibition',
    };
    await partnerApi.submitActivityProposal({
      eventId: partnerApp.eventId,
      title: newAct.title,
      kind: kindByCategory[newAct.category],
      locationName: newAct.location,
      startAt: `${year}-${month}-${day}T${startTime}:00+07:00`,
      endAt: `${year}-${month}-${day}T${endTime}:00+07:00`,
      capacity: newAct.capacity,
      targetAudience: newAct.targetAudience,
      description: newAct.description,
      devices: newAct.requiredEquipments.map(name => ({ name, quantity: 1 })),
    });
    const [activities, reports] = await Promise.all([
      partnerApi.getActivityProposals(), partnerApi.getReports(partnerApp.eventId),
    ]);
    setPartnerActivities(activities);
    _setPartnerReports(reports);
  };

  const handleUpdatePartnerActivity = async (id: string, updated: Partial<PartnerActivityProposal>) => {
    const saved = await partnerApi.updateActivityProposal(id, updated);
    setPartnerActivities(prev => prev.map(activity => activity.id === id ? saved : activity));
  };

  const handleRecordAttendanceScan = (rec: Omit<AttendanceScanRecord, 'id'>) => {
    const scanRecord: AttendanceScanRecord = {
      ...rec,
      id: `scn-${Date.now()}`
    };
    setAttendanceScans(prev => [scanRecord, ...prev]);
  };

  const handleMarkAllPartnerNotifsRead = async () => {
    await partnerApi.markAllNotificationsRead();
    setPartnerNotifications(prev => prev.map(notification => ({ ...notification, isRead: true })));
  };

  const handlePartnerAttendanceScan = async (qrToken: string): Promise<Omit<AttendanceScanRecord, 'id'>> => {
    const result = await partnerApi.scanAttendance(qrToken) as {
      status: string; activityId: string; activityTitle: string; participantName: string; ticketCode: string;
    };
    return {
      activityId: result.activityId,
      activityTitle: result.activityTitle,
      participantName: result.participantName,
      ticketCode: result.ticketCode,
      scanTime: new Date().toLocaleTimeString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }),
      status: result.status === 'already_completed' ? 'already_scanned' : 'success',
    };
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
          onLoginSuccess={() => navigate('/partner')}
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

    const assignedBooth = partnerBooths.find(b => b.assignedOrgId === visiblePartnerOrg.id);
    const attendanceModalActivity = partnerActivities.find(a => a.id === activeAttendanceActivityId) || partnerActivities[0];

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
          <Route path="/partner" element={
            <PartnerDashboard
              language={language}
              organization={visiblePartnerOrg}
              activeEvent={partnerApp}
              assignedBooth={assignedBooth}
              activities={partnerActivities}
              todos={partnerTodos}
              totalEngagementCount={partnerReports?.totalParticipants || 0}
              onOpenAttendanceModal={() => setActiveAttendanceActivityId(partnerActivities[0]?.id || '')}
            />
          } />
          <Route path="/partner/events" element={
            <EventApplicationPage
              language={language}
              organization={partnerOrg}
            />
          } />
          <Route path="/partner/events/apply" element={
            <EventApplicationPage
              language={language}
              organization={partnerOrg}
            />
          } />
          <Route path="/partner/booths" element={
            <BoothManagementPage
              language={language}
              booth={assignedBooth}
              onOpenAttendanceModal={() => setActiveAttendanceActivityId(partnerActivities[0]?.id || '')}
              onRequestChange={(reason) => assignedBooth && partnerApi.requestBoothChange(assignedBooth.id, reason || '')}
              onRequestCancel={(reason) => assignedBooth && partnerApi.requestBoothCancellation(assignedBooth.id, reason || '')}
            />
          } />
          <Route path="/partner/booths/select" element={
            <BoothSelectionPage
              language={language}
              booths={partnerBooths}
              currentAssignedBoothId={assignedBooth?.id}
              onSelectBooth={handleSelectPartnerBooth}
            />
          } />
          <Route path="/partner/booth-requests" element={
            <Sprint2PartnerBoothsPage
              language={language}
              applications={partnerApplications}
            />
          } />
          <Route path="/partner/activities" element={
            <ActivityProposalPage
              language={language}
              activities={partnerActivities}
              locations={partnerEventLocations}
              assets={partnerAssets}
              onAddActivity={handleAddPartnerActivity}
              onOpenAttendanceModal={(id) => setActiveAttendanceActivityId(id)}
            />
          } />
          <Route path="/partner/activities/:activityId" element={
            <PartnerActivityDetailPage
              language={language}
              activities={partnerActivities}
              onOpenAttendanceModal={(id) => setActiveAttendanceActivityId(id)}
              onUpdateActivity={handleUpdatePartnerActivity}
            />
          } />
          <Route path="/partner/reports" element={
            <PartnerReportsPage
              language={language}
              reportStats={partnerReports || { eventId: partnerApp?.eventId || '', eventName: partnerApp?.eventTitle || '', totalParticipants: 0, totalActivities: 0, attendanceRate: 0, averageRating: 0, activityStats: [], ratingDistribution: [] }}
            />
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
        </Routes>

        {/* Modal Quét Điểm danh QR Hoạt động (Screen 10) */}
        {activeAttendanceActivityId && attendanceModalActivity && (
          <ActivityAttendanceModal
            language={language}
            activity={attendanceModalActivity}
            scans={attendanceScans}
            onClose={() => setActiveAttendanceActivityId(null)}
            onRecordScan={handleRecordAttendanceScan}
            onScanQr={handlePartnerAttendanceScan}
          />
        )}
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
          onLoginSuccess={() => navigate('/admin')}
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
            isLoading={isPublicDataLoading}
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
        onSelectBoothOnMap={handleSelectBoothOnMap} 
      />
      <EventsExperience 
        language={language} 
        open={isEvents} 
        events={events} 
        isParticipantAuthenticated={isParticipantAuthenticated}
        participantProfile={participantProfile}
        onJoinEvent={handleOpenEventActivities}
      />

    </div>
  );
}

export default App;
