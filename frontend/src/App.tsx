import { useEffect, useMemo, useRef, useState } from 'react';
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import './App.css';
import './RoleWorkspace.css';
import { useAuth } from './auth/useAuth';
import { useParticipationRefresh } from './hooks/useParticipationRefresh';
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
import { AttendanceScanPage } from './pages/participant/AttendanceScanPage';
import { BoothScanPage } from './pages/participant/BoothScanPage';
import { EventDetailPage } from './pages/participant/EventDetailPage';
import { MyActivitiesPage } from './pages/participant/MyActivitiesPage';
import { MyEventsPage } from './pages/participant/MyEventsPage';
import { MyCertificatesPage } from './pages/participant/MyCertificatesPage';
import { ParticipantDashboard } from './pages/participant/ParticipantDashboard';
import { ActivityRatingsPage } from './pages/participant/ActivityRatingsPage';
import { ParticipantNotificationsPage } from './pages/participant/ParticipantNotificationsPage';
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
import { PartnerProfilePage } from './pages/partner/PartnerProfilePage';
import { Sprint2PartnerBoothsPage } from './pages/partner/Sprint2PartnerBoothsPage';
import { BoothPaymentPage } from './pages/partner/BoothPaymentPage';
import { VnPayReturnPage } from './pages/partner/VnPayReturnPage';
import { migrateLegacyOrganizerUrl } from './routing/organizerRoutes';
import {
  clearAttendanceScanToken,
  PARTICIPANT_ATTENDANCE_SCAN_PATH,
} from './security/attendanceScanToken';
import {
  clearBoothScanToken,
  PARTICIPANT_BOOTH_SCAN_PATH,
} from './security/boothScanToken';
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
  ParticipantCertificate,
  ParticipantEvent,
  ParticipantProfile,
  PartnerEventApplication,
  PartnerNotification,
  PartnerOrganization,
  PartnerTodoItem
} from './types';

import './WorkspacePageHeading.css';

const EMPTY_PARTICIPANT_PROFILE: ParticipantProfile = {
  id: '', name: '', email: '', role: 'Participant', emailNotifications: false, points: 0,
};

const LANDING_EVENT_WINDOW_DAYS = 90;
const LANDING_EVENT_LIMIT = 8;

function getLandingEvents(events: EventItem[], now = Date.now()): EventItem[] {
  const horizon = now + LANDING_EVENT_WINDOW_DAYS * 24 * 60 * 60 * 1000;
  const activeOrNear = events.filter(event => {
    const startAt = event.startAt ? new Date(event.startAt).getTime() : Number.NaN;
    const endAt = event.endAt ? new Date(event.endAt).getTime() : Number.NaN;
    if (!Number.isFinite(startAt) || !Number.isFinite(endAt)) {
      return event.status === 'happening' || event.status === 'upcoming';
    }
    return endAt >= now && startAt <= horizon;
  });
  const nearest = activeOrNear.length > 0
    ? activeOrNear
    : events.filter(event => !event.endAt || new Date(event.endAt).getTime() >= now);

  return nearest.slice(0, LANDING_EVENT_LIMIT);
}

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
  const isParticipantAttendanceScanRoute = location.pathname === PARTICIPANT_ATTENDANCE_SCAN_PATH;
  const isParticipantBoothScanRoute = location.pathname === PARTICIPANT_BOOTH_SCAN_PATH;
  const isParticipantCertificatesRoute = location.pathname === '/participant/certificates';
  const isVnPayReturn = location.pathname === '/payment/vnpay/return';
  const isPartnerRoute = location.pathname.startsWith('/partner') || isVnPayReturn;
  const isAdminRoute = location.pathname.startsWith('/admin');
  const isSlidePageOpen = isHeritage || isBooths || isEvents;
  const isPortalRoute = /^\/(?:portal|organizer)(?:\/|$)/.test(location.pathname);
  const isPublicRoute = !isPortalRoute
    && !isParticipantRoute
    && !isPartnerRoute
    && !isAdminRoute
    && !isLoginRoute
    && !isRegisterRoute
    && location.pathname !== '/verify-email';
  const isAuthenticated = authenticationStatus === 'authenticated';
  const isPortalAuthenticated = isAuthenticated && Boolean(authenticatedUser?.roles.includes('ORGANIZER'));
  const isParticipantAuthenticated = isAuthenticated && Boolean(authenticatedUser?.roles.includes('PARTICIPANT'));
  const isPartnerAuthenticated = isAuthenticated && Boolean(authenticatedUser?.roles.includes('PARTNER'));
  const isAdminAuthenticated = isAuthenticated && Boolean(authenticatedUser?.roles.includes('ADMIN'));
  const currentParticipantId = useRef<number | undefined>(undefined);
  const participantActivityMutations = useRef(new Map<string, Promise<void>>());
  const participantUserId = isParticipantAuthenticated ? authenticatedUser?.userId : undefined;
  useEffect(() => { currentParticipantId.current = participantUserId; }, [participantUserId]);

  useEffect(() => {
    if (isParticipantAttendanceScanRoute || isLoginRoute) return;
    clearAttendanceScanToken();
  }, [isLoginRoute, isParticipantAttendanceScanRoute]);

  useEffect(() => {
    if (isParticipantBoothScanRoute || isLoginRoute) return;
    clearBoothScanToken();
  }, [isLoginRoute, isParticipantBoothScanRoute]);

  // Partner State
  const [partnerOrg, setPartnerOrg] = useState<PartnerOrganization | null>(null);
  const [partnerApplications, setPartnerApplications] = useState<PartnerEventApplication[]>([]);
  const [partnerTodos, _setPartnerTodos] = useState<PartnerTodoItem[]>([]);
  const [partnerNotifications, setPartnerNotifications] = useState<PartnerNotification[]>([]);
  const [partnerBoothRequests, setPartnerBoothRequests] = useState<BoothRequest[] | null>(null);
  const [partnerOverviewLoading, setPartnerOverviewLoading] = useState(true);
  const [partnerOverviewError, setPartnerOverviewError] = useState('');
  const [partnerBoothRequestsError, setPartnerBoothRequestsError] = useState('');

  const [language, setLanguage] = useState<Language>('vi');
  const [highlightedBoothId, setHighlightedBoothId] = useState<string | null>(null);
  const [focusedBoothId, setFocusedBoothId] = useState<string | null>(null);
  const [boothSearchQuery, setBoothSearchQuery] = useState<string>('');

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
  }, [location.hash, location.pathname, isSlidePageOpen, isPortalRoute]);

  useEffect(() => {
    if (isSlidePageOpen || isPortalRoute || !location.hash) return;
    const frame = requestAnimationFrame(() => {
      document.getElementById(location.hash.slice(1))?.scrollIntoView({ behavior: 'instant' });
    });
    return () => cancelAnimationFrame(frame);
  }, [location.hash, isSlidePageOpen, isPortalRoute]);

  const [heritageList, setHeritageList] = useState<ExtendedHeritageProfile[]>([]);
  const [booths, setBooths] = useState<Booth[]>([]);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [isPublicDataLoading, setIsPublicDataLoading] = useState(true);
  const [isPublicBoothsLoading, setIsPublicBoothsLoading] = useState(false);
  const [publicBoothsError, setPublicBoothsError] = useState('');
  const [selectedPublicEventId, setSelectedPublicEventId] = useState('');
  const featuredPublicEvents = useMemo(() => getLandingEvents(events), [events]);
  const publicContextEvents = isSlidePageOpen ? events : featuredPublicEvents;
  const publicEventIdFromUrl = new URLSearchParams(location.search).get('eventId');
  const defaultPublicEventId = publicContextEvents.find(event => event.status === 'happening')?.id
    || publicContextEvents.find(event => event.status === 'upcoming')?.id
    || publicContextEvents[0]?.id
    || '';
  const publicEventId = publicContextEvents.some(event => event.id === publicEventIdFromUrl)
    ? publicEventIdFromUrl as string
    : publicContextEvents.some(event => event.id === selectedPublicEventId)
      ? selectedPublicEventId
      : defaultPublicEventId;

  const selectPublicEvent = (eventId: string) => {
    if (!publicContextEvents.some(event => event.id === eventId)) return;
    setSelectedPublicEventId(eventId);
    const params = new URLSearchParams(location.search);
    params.set('eventId', eventId);
    navigate({
      pathname: location.pathname,
      search: `?${params.toString()}`,
      hash: location.hash,
    }, { replace: true, preventScrollReset: true });
  };

  useEffect(() => {
    if (!isPublicRoute || isPublicDataLoading || !publicEventIdFromUrl || !publicEventId) return;
    if (publicEventIdFromUrl === publicEventId) return;
    const params = new URLSearchParams(location.search);
    params.set('eventId', publicEventId);
    navigate({
      pathname: location.pathname,
      search: `?${params.toString()}`,
      hash: location.hash,
    }, { replace: true, preventScrollReset: true });
  }, [isPublicDataLoading, isPublicRoute, location.hash, location.pathname, location.search, navigate, publicEventId, publicEventIdFromUrl]);

  // Load real data from Backend REST API
  useEffect(() => {
    if (!isPublicRoute) return;
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
    void refreshPublicData();
    return () => {
      isMounted = false;
    };
  }, [isPublicRoute]);

  useEffect(() => {
    let active = true;
    if (!isPublicRoute || !publicEventId) {
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
  }, [isPublicRoute, publicEventId]);

  const [storedParticipantProfile, setParticipantProfile] = useState<ParticipantProfile>(EMPTY_PARTICIPANT_PROFILE);
  const [participantProfileError, setParticipantProfileError] = useState('');
  const [participantEvents, setParticipantEvents] = useState<ParticipantEvent[]>([]);
  const [landingRegistrations, setLandingRegistrations] = useState<{ userId: number; eventIds: string[] } | null>(null);
  const [participantActivities, setParticipantActivities] = useState<ParticipantActivity[]>([]);
  const [participantParticipationLoading, setParticipantParticipationLoading] = useState(true);
  const [participantParticipationError, setParticipantParticipationError] = useState('');
  const [participantParticipationRevision, setParticipantParticipationRevision] = useState(0);
  const participationRefresh = useParticipationRefresh((isParticipantRoute || isPublicRoute) && isParticipantAuthenticated && !isParticipantAttendanceScanRoute);
  const [participantCertificates, setParticipantCertificates] = useState<ParticipantCertificate[]>([]);
  const [participantCertificatesLoading, setParticipantCertificatesLoading] = useState(false);
  const [participantCertificatesError, setParticipantCertificatesError] = useState('');
  const [participantCertificatesRevision, setParticipantCertificatesRevision] = useState(0);

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
    setParticipantProfile(EMPTY_PARTICIPANT_PROFILE);
    setParticipantProfileError('');
    setParticipantEvents([]);
    setParticipantActivities([]);
    setParticipantParticipationLoading(true);
    setParticipantParticipationError('');
    setParticipantCertificates([]);
    setParticipantCertificatesLoading(false);
    setParticipantCertificatesError('');
  }, [participantUserId]);

  useEffect(() => {
    if (participantUserId === undefined || (!isParticipantRoute && !isPublicRoute)) return;
    let active = true;
    const refreshProfile = () => {
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
    window.addEventListener('email:verified', refreshProfile);
    return () => {
      active = false;
      window.removeEventListener('email:verified', refreshProfile);
    };
  }, [isParticipantRoute, isPublicRoute, participantUserId]);

  useEffect(() => {
    if (participantUserId === undefined || !isParticipantRoute
        || isParticipantAttendanceScanRoute || isParticipantBoothScanRoute) return;
    let active = true;
    const refreshParticipation = async () => {
      setParticipantParticipationLoading(true);
      setParticipantParticipationError('');
      try {
        const eventList = await participantApi.getEvents();
        const activityList = await participantApi.getMyActivities(eventList);
        if (!active) return;
        setParticipantEvents(eventList);
        setParticipantActivities(activityList);
      } catch (error) {
        if (active) {
          console.warn('Không thể tải dữ liệu tham gia của độc giả', error);
          setParticipantParticipationError(error instanceof Error
            ? error.message
            : 'Không thể tải dữ liệu tham gia.');
        }
      } finally {
        if (active) setParticipantParticipationLoading(false);
      }
    };
    void refreshParticipation();
    return () => {
      active = false;
    };
  }, [isParticipantAttendanceScanRoute, isParticipantBoothScanRoute, isParticipantRoute,
    participantParticipationRevision, participationRefresh, participantUserId]);

  useEffect(() => {
    if (!isPublicRoute || participantUserId === undefined) return;
    let active = true;
    participantApi.getEventRegistrations().then(registrations => {
      if (active) setLandingRegistrations({ userId: participantUserId, eventIds: registrations.filter(event => event.isJoined).map(event => event.id) });
    }).catch(error => console.warn('Không tải được trạng thái đăng ký sự kiện', error));
    return () => { active = false; };
  }, [isPublicRoute, participantUserId, participationRefresh, participantEvents]);

  useEffect(() => {
    if (participantUserId === undefined || !isParticipantCertificatesRoute) return;
    let active = true;
    // This effect synchronizes the route-scoped Certificate list from the Participant API.
    // oxlint-disable-next-line react/set-state-in-effect
    setParticipantCertificatesLoading(true);
    setParticipantCertificatesError('');
    participantApi.getCertificates()
      .then(certificates => {
        if (active) setParticipantCertificates(certificates);
      })
      .catch(error => {
        if (!active) return;
        setParticipantCertificates([]);
        setParticipantCertificatesError(error instanceof Error
          ? error.message
          : 'Không thể tải danh sách chứng nhận.');
      })
      .finally(() => {
        if (active) setParticipantCertificatesLoading(false);
      });
    return () => { active = false; };
  }, [isParticipantCertificatesRoute, participantCertificatesRevision, participantUserId]);

  useEffect(() => {
    if (!isPartnerRoute || !isPartnerAuthenticated) return;
    let active = true;
    // This effect synchronizes authenticated Partner data from external APIs.
    // oxlint-disable-next-line react/set-state-in-effect
    setPartnerOverviewLoading(true);
    setPartnerOverviewError('');
    setPartnerBoothRequestsError('');
    setPartnerNotifications([]);
    const refreshPartnerData = () => {
      const profileRequest = partnerApi.getProfile();
      void Promise.allSettled([
        profileRequest,
        partnerApi.getApplications({ organization: profileRequest }),
        boothApi.listAllPartnerRequests(),
      ]).then(([profileResult, applicationsResult, boothResult]) => {
        if (!active) return;
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
      }).finally(() => {
        if (active) setPartnerOverviewLoading(false);
      });
    };
    refreshPartnerData();
    window.addEventListener('duongsach:data-changed', refreshPartnerData);
    return () => {
      active = false;
      window.removeEventListener('duongsach:data-changed', refreshPartnerData);
    };
  }, [authenticatedUser?.fullName, isPartnerAuthenticated, isPartnerRoute]);

  // Participant Action Handlers
  const applyParticipantActivityRegistration = (
    registration: Awaited<ReturnType<typeof participantApi.registerActivity>>,
    events: ParticipantEvent[],
  ) => {
    const activity = participantApi.mapActivityRegistration(registration, events);
    setParticipantActivities(current => {
      const existingIndex = current.findIndex(item =>
        item.registrationId === activity.registrationId || item.id === activity.id);
      if (existingIndex < 0) return [activity, ...current];
      return current.map((item, index) => index === existingIndex ? activity : item);
    });
  };

  const refreshParticipantEventsAfterActivityMutation = async () => {
    try {
      const events = await participantApi.getEvents();
      setParticipantEvents(events);
      return events;
    } catch (error) {
      console.warn('Hoạt động đã được cập nhật nhưng chưa thể làm mới danh sách sự kiện', error);
      return participantEvents;
    }
  };

  const runParticipantActivityMutation = (activityId: string, mutation: () => Promise<void>) => {
    const inFlight = participantActivityMutations.current.get(activityId);
    if (inFlight) return inFlight;

    const request = Promise.resolve()
      .then(mutation)
      .finally(() => participantActivityMutations.current.delete(activityId));
    participantActivityMutations.current.set(activityId, request);
    return request;
  };

  const handleRegisterActivity = (activityId: string) =>
    runParticipantActivityMutation(activityId, async () => {
      const registration = await participantApi.registerActivity(activityId);
      const events = await refreshParticipantEventsAfterActivityMutation();
      applyParticipantActivityRegistration(registration, events);
    });

  const handleCancelActivity = (activityId: string) =>
    runParticipantActivityMutation(activityId, async () => {
      const registration = await participantApi.cancelActivity(activityId);
      const events = await refreshParticipantEventsAfterActivityMutation();
      applyParticipantActivityRegistration(registration, events);
    });

  const handleRateParticipantActivity = async (
    activityId: string,
    data: { score: number; comment: string },
  ) => {
    const rating = await participantApi.rateActivity(activityId, data);
    setParticipantActivities(current => current.map(activity => activity.id === activityId
      ? { ...activity, rating }
      : activity));
    return rating;
  };

  const handleJoinParticipantEvent = async (eventId: string) => {
    const userId = currentParticipantId.current;
    const registration = await participantApi.joinEvent(eventId);
    if (currentParticipantId.current !== userId) return;
    const event = participantApi.mapEventRegistration(registration);
    if (userId !== undefined) setLandingRegistrations(current => ({
      userId,
      eventIds: [...new Set([...(current?.userId === userId ? current.eventIds : []), event.id])],
    }));
    setParticipantEvents(current => {
      const existing = current.find(item => item.id === event.id);
      return existing
        ? current.map(item => item.id === event.id ? { ...existing, ...event } : item)
        : [event, ...current];
    });
    try {
      const events = await participantApi.getEvents();
      if (currentParticipantId.current === userId) setParticipantEvents(events);
    } catch {
      // The command has committed; keep its authoritative response if refresh fails.
    }
  };

  const handleLeaveParticipantEvent = async (eventId: string) => {
    const userId = currentParticipantId.current;
    const registration = await participantApi.leaveEvent(eventId);
    if (currentParticipantId.current !== userId) return;
    const event = participantApi.mapEventRegistration(registration);
    if (userId !== undefined) setLandingRegistrations(current => current?.userId === userId
      ? { userId, eventIds: current.eventIds.filter(id => id !== event.id) }
      : current);
    setParticipantEvents(current => current.map(item => item.id === event.id ? { ...item, ...event } : item));
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
  };

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const handleParticipantLogout = () => {
    clearAttendanceScanToken();
    clearBoothScanToken();
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

    if (isParticipantAttendanceScanRoute) {
      return (
        <ParticipantLayout
          language={language}
          profile={participantProfile}
          onLogout={handleParticipantLogout}
        >
          <AttendanceScanPage language={language} />
        </ParticipantLayout>
      );
    }

    if (isParticipantBoothScanRoute) {
      return (
        <ParticipantLayout
          language={language}
          profile={participantProfile}
          onLogout={handleParticipantLogout}
        >
          <BoothScanPage language={language} />
        </ParticipantLayout>
      );
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
              totalCertificatesCount={participantProfile.certificatesCount ?? participantCertificates.length}
              onJoinEvent={handleJoinParticipantEvent}
              onRegisterActivity={handleRegisterActivity}
            />
          } />
          <Route path="/participant/events" element={
            <MyEventsPage
              language={language}
              events={participantEvents}
              isLoading={participantParticipationLoading}
              loadError={participantParticipationError}
              onRetry={() => setParticipantParticipationRevision(value => value + 1)}
              onLeaveEvent={handleLeaveParticipantEvent}
              onJoinEvent={handleJoinParticipantEvent}
            />
          } />
          <Route path="/participant/events/:eventId" element={<EventDetailPage language={language} events={participantEvents} activities={participantActivities}
            isLoading={participantParticipationLoading} loadError={participantParticipationError}
            onRetry={() => setParticipantParticipationRevision(value => value + 1)}
            onRegisterActivity={handleRegisterActivity} onCancelActivity={handleCancelActivity}
            onLeaveEvent={handleLeaveParticipantEvent} />} />
          <Route path="/participant/activities" element={
            <MyActivitiesPage
              language={language}
              activities={participantActivities}
              isLoading={participantParticipationLoading}
              loadError={participantParticipationError}
              onRetry={() => setParticipantParticipationRevision(value => value + 1)}
              onCancelActivity={handleCancelActivity}
            />
          } />
          <Route path="/participant/activities/detail/:activityId" element={
            <ActivityDetailPage language={language} activities={participantActivities}
              isLoading={participantParticipationLoading} loadError={participantParticipationError}
              onRetry={() => setParticipantParticipationRevision(value => value + 1)}
              onCancelActivity={handleCancelActivity} />
          } />
          <Route path="/participant/activities/qr/:activityId" element={<Navigate to="/participant/activities" replace />} />
          <Route path="/participant/rewards" element={
            <RewardsPage
              language={language}
            />
          } />
          <Route path="/participant/certificates" element={
            <MyCertificatesPage
              language={language}
              certificates={participantCertificates}
              participantName={participantProfile.name}
              isLoading={participantCertificatesLoading}
              loadError={participantCertificatesError}
              onRetry={() => setParticipantCertificatesRevision(value => value + 1)}
              onLoadDetail={participantApi.getCertificateDetail}
              onDownload={participantApi.downloadCertificate}
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
            <ActivityRatingsPage
              language={language}
              activities={participantActivities}
              isLoading={participantParticipationLoading}
              loadError={participantParticipationError}
              onRetry={() => setParticipantParticipationRevision(value => value + 1)}
              onLoadRating={participantApi.getActivityRating}
              onRateActivity={handleRateParticipantActivity}
            />
          } />
          <Route path="/participant/notifications" element={
            <ParticipantNotificationsPage language={language} />
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
          <Route path="/partner/reports" element={<Navigate to="/partner" replace />} />
          <Route path="/partner/notifications" element={<Navigate to="/partner" replace />} />
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
        selectedPublicEventId={publicEventId}
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
            events={publicContextEvents}
            selectedEventId={publicEventId}
            onSelectBoothOnMap={handleSelectBoothOnMap}
            searchQuery={boothSearchQuery}
            onSearchQueryChange={setBoothSearchQuery}
            focusedBoothId={focusedBoothId}
          />

          {/* 6. Events Schedule with Real Photography & Bookstall Proposal Flow */}
          <EventsSection 
            language={language} 
            registeredEventIds={new Set(landingRegistrations?.userId === participantUserId ? landingRegistrations?.eventIds : [])}
            events={publicContextEvents}
            isLoading={isPublicDataLoading}
            isParticipantAuthenticated={isParticipantAuthenticated}
            participantProfile={participantProfile}
            onRegisterActivity={handleRegisterActivity}
            onJoinEvent={handleJoinParticipantEvent}
            selectedEventId={publicEventId}
            onSelectEventId={selectPublicEvent}
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
            events={publicContextEvents}
            selectedEventId={publicEventId}
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
        onJoinEvent={handleJoinParticipantEvent}
        selectedEventId={publicEventId}
      />

    </div>
  );
}

export default App;
