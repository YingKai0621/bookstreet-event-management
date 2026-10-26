import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { CheckCircle2 } from 'lucide-react';
import {
  ExtendedHeritageProfile,
  Language
} from '../../types';
import { EventDetailView } from './EventDetailView';
import { EventManagementView } from './EventManagementView';
import { OrganizerDashboard } from './OrganizerDashboard';
import {
  OrganizerSidebar
} from './OrganizerSidebar';
import { OrganizerTopBar } from './OrganizerTopBar';

import { OrganizerBoothManagementView } from './OrganizerBoothManagementView';
import { OrganizerBoothRequestsView } from './OrganizerBoothRequestsView';
import { OrganizerActivityWorkspace } from './OrganizerActivityWorkspace';
import { OrganizerAttendanceModal } from './OrganizerAttendanceModal';
import { OrganizerCreateEventModal } from './OrganizerCreateEventModal';
import { OrganizerPublishEventModal } from './OrganizerPublishEventModal';
import type { EventPublishFailure } from './OrganizerPublishEventModal';
import { OrganizerFeedbackView } from './OrganizerFeedbackView';
import { OrganizerNotificationsView } from './OrganizerNotificationsView';
import { OrganizerLocationManagementView } from './OrganizerLocationManagementView';
import { OrganizerProfileView } from './OrganizerProfileView';
import { OrganizerPublicContentView } from './OrganizerPublicContentView';
import { OrganizerReportsView } from './OrganizerReportsView';
import { ParticipantManagementView } from './ParticipantManagementView';
import {
  ORGANIZER_ROOT,
  normalizeOrganizerSearch,
  organizerTabPath,
  organizerTabUrl,
  resolveOrganizerRoute,
} from '../../routing/organizerRoutes';

import { useAuth } from '../../auth/useAuth';
import {
  organizerApi,
  type OrganizerDashboardSummary,
  OrganizerPartnerApplication,
} from '../../services/organizerApi';
import { ApiError } from '../../services/apiClient';
import { boothApi } from '../../services/boothApi';
import type { BoothRequest } from '../../types/booth';
import {
  OrganizerActivityItem,
  OrganizerBoothItem,
  OrganizerEvent,
  OrganizerEventRequest,
  OrganizerNotificationItem,
  OrganizerParticipantItem,
  OrganizerProfile,
  OrganizerTab,
} from '../../types/organizer';

import './OrganizerPortal.css';

export interface ManagementPortalProps {
  language: Language;
  onLogout?: () => void;
}

export const ManagementPortal: React.FC<ManagementPortalProps> = ({
  language,
  onLogout
}) => {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const routeState = useMemo(
    () => resolveOrganizerRoute(location.pathname, location.search),
    [location.pathname, location.search],
  );
  const activeTab = routeState?.tab ?? 'overview';
  const selectedEventId = routeState?.eventId ?? null;
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    if (!routeState) navigate(ORGANIZER_ROOT, { replace: true });
  }, [navigate, routeState]);

  useEffect(() => {
    if (!routeState) return;
    const normalized = normalizeOrganizerSearch(routeState.tab, location.search);
    const normalizedSearch = normalized.toString();
    const currentSearch = new URLSearchParams(location.search).toString();
    if (normalizedSearch === currentSearch) return;
    navigate(`${location.pathname}${normalizedSearch ? `?${normalizedSearch}` : ''}`, { replace: true });
  }, [location.pathname, location.search, navigate, routeState]);

  const navigateToTab = useCallback((tab: OrganizerTab, eventId?: string | null) => {
    navigate(organizerTabUrl(tab, { eventId }));
  }, [navigate]);

  const selectEventForCurrentScreen = useCallback((eventId: string | null) => {
    const params = new URLSearchParams(location.search);
    params.delete('activityView');
    const nextEventId = eventId && eventId !== 'all' ? eventId : null;
    if (nextEventId) params.set('eventId', nextEventId);
    else params.delete('eventId');
    navigate(organizerTabUrl(activeTab === 'event_detail' ? 'events' : activeTab, {
      eventId: nextEventId,
      search: params,
    }));
  }, [activeTab, location.search, navigate]);



  // Modal State
  const [isAttendanceModalOpen, setIsAttendanceModalOpen] = useState(false);
  const [isCreateEventOpen, setIsCreateEventOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<OrganizerEvent | null>(null);
  const [eventPendingPublish, setEventPendingPublish] = useState<OrganizerEvent | null>(null);
  const [isPublishingEvent, setIsPublishingEvent] = useState(false);
  const [publishFailure, setPublishFailure] = useState<EventPublishFailure | null>(null);
  const [publishSuccess, setPublishSuccess] = useState('');

  // Core Datasets State
  const [eventsList, setEventsList] = useState<OrganizerEvent[]>([]);
  const [boothsList, setBoothsList] = useState<OrganizerBoothItem[]>([]);
  const activitiesList: OrganizerActivityItem[] = [];
  const participantsList: OrganizerParticipantItem[] = [];
  const [notificationsList, setNotificationsList] = useState<OrganizerNotificationItem[]>([]);
  const [profile, setProfile] = useState<OrganizerProfile>(() => {
    const fullName = user?.fullName || '';
    const initials = fullName.split(' ').filter(Boolean).map(part => part[0]).join('').slice(-2).toUpperCase();
    return { id: String(user?.userId || ''), name: fullName, role: 'ORGANIZER', department: '', organization: '', email: user?.email || '', phone: '', avatarInitials: initials };
  });
  const [partnerApplications, setPartnerApplications] = useState<OrganizerPartnerApplication[]>([]);
  const [boothRequests, setBoothRequests] = useState<BoothRequest[]>([]);
  const [activePhysicalBoothCount, setActivePhysicalBoothCount] = useState(0);
  const [isLoadingEventOperations, setIsLoadingEventOperations] = useState(false);
  const [eventOperationsError, setEventOperationsError] = useState('');
  const [eventOperationsReloadKey, setEventOperationsReloadKey] = useState(0);
  const [managedHeritageList, setManagedHeritageList] = useState<ExtendedHeritageProfile[]>([]);
  const [loadError, setLoadError] = useState('');
  const [actionError, setActionError] = useState('');
  const [isLoadingEvents, setIsLoadingEvents] = useState(true);
  const [dashboardSummary, setDashboardSummary] = useState<OrganizerDashboardSummary | null>(null);
  const [isLoadingDashboardSummary, setIsLoadingDashboardSummary] = useState(false);
  const [dashboardSummaryError, setDashboardSummaryError] = useState('');

  const refreshOrganizerData = useCallback(async (preferredEventId?: string | null) => {
    try {
      const events = await organizerApi.getEvents();
      setEventsList(events);
      if (preferredEventId && !events.some(event => event.id === preferredEventId)) navigateToTab('events');
      setLoadError('');
    } catch (error) {
      console.warn('Could not load organizer data', error);
      setLoadError(error instanceof Error ? error.message : 'Không tải được dữ liệu điều hành');
    } finally {
      setIsLoadingEvents(false);
    }
  }, [navigateToTab]);

  useEffect(() => {
    void refreshOrganizerData().catch(error => { console.warn('Could not load organizer data', error); setLoadError(error instanceof Error ? error.message : 'Không tải được dữ liệu điều hành'); setIsLoadingEvents(false); });
  }, [refreshOrganizerData]);

  useEffect(() => {
    if (activeTab !== 'event_detail' || !selectedEventId) return;
    let active = true;
    const requestedEventId = selectedEventId;

    setIsLoadingEventOperations(true);
    setEventOperationsError('');
    setBoothsList([]);
    setPartnerApplications([]);
    setBoothRequests([]);
    setActivePhysicalBoothCount(0);

    const refreshEventOperations = async (showLoading: boolean) => {
      if (showLoading) setIsLoadingEventOperations(true);
      try {
        const [booths, applications, requests, physicalBooths] = await Promise.all([
          organizerApi.getBooths(requestedEventId),
          organizerApi.getPartnerApplications(requestedEventId),
          boothApi.listAllOrganizerRequests(requestedEventId),
          boothApi.listAllPhysicalBooths(true),
        ]);
        if (!active || requestedEventId !== selectedEventId) return;
        setBoothsList(booths);
        setPartnerApplications(applications);
        setBoothRequests(requests);
        setActivePhysicalBoothCount(physicalBooths.length);
        setEventOperationsError('');
      } catch (error) {
        if (!active || requestedEventId !== selectedEventId) return;
        setEventOperationsError(error instanceof Error
          ? error.message
          : 'Không tải được tình hình vận hành của sự kiện.');
      } finally {
        if (active && requestedEventId === selectedEventId && showLoading) {
          setIsLoadingEventOperations(false);
        }
      }
    };

    void refreshEventOperations(true);

    return () => {
      active = false;
    };
  }, [activeTab, eventOperationsReloadKey, selectedEventId]);

  useEffect(() => {
    if (activeTab !== 'overview') return;
    let active = true;

    const refreshSummary = async (showLoading: boolean) => {
      if (showLoading) setIsLoadingDashboardSummary(true);
      try {
        const summary = await organizerApi.getDashboardSummary();
        if (!active) return;
        setDashboardSummary(summary);
        setDashboardSummaryError('');
      } catch (error) {
        if (!active) return;
        setDashboardSummaryError(error instanceof Error ? error.message : 'Không tải được dữ liệu Dashboard.');
      } finally {
        if (active && showLoading) setIsLoadingDashboardSummary(false);
      }
    };

    void refreshSummary(true);

    return () => {
      active = false;
    };
  }, [activeTab]);

  useEffect(() => {
    let active = true;
    if (selectedEventId) {
      organizerApi.getEvent(selectedEventId).then(event => {
        if (active) setEventsList(current => current.map(item => item.id === event.id ? event : item));
      }).catch(error => {
        if (active) setActionError(error instanceof Error ? error.message : 'Không tải được chi tiết sự kiện.');
      });
    }
    return () => {
      active = false;
    };
  }, [selectedEventId]);

  // Unread notifications count
  const unreadCount = notificationsList.filter(n => !n.isRead).length;

  // Handlers for Participant Manual Override
  const handleManualOverrideStatus = (
    participantId: string, 
    newStatus: OrganizerParticipantItem['status'], 
    reason: string
  ) => {
    void organizerApi.overrideAttendance(participantId, newStatus === 'not_attended' ? 'cancelled' : newStatus, reason)
      .then(() => refreshOrganizerData(selectedEventId)).catch(console.warn);
  };

  // Handlers for Attendance Check-in Scanner
  const handleRecordScan = async (ticketCode: string) => {
    const result = await organizerApi.scanAttendance(ticketCode);
    await refreshOrganizerData(selectedEventId);
    return result;
  };

  const handleApprovePartnerApplication = async (
    applicationId: string,
    reviewNote = '',
  ) => {
    if (!selectedEventId) throw new Error('Không xác định được sự kiện đang xét duyệt.');
    await organizerApi.approvePartnerApplication(applicationId, reviewNote);
    setPartnerApplications(await organizerApi.getPartnerApplications(selectedEventId));
  };

  const handleRejectPartnerApplication = async (
    applicationId: string,
    reviewNote: string,
  ) => {
    if (!selectedEventId) throw new Error('Không xác định được sự kiện đang xét duyệt.');
    await organizerApi.rejectPartnerApplication(applicationId, reviewNote);
    setPartnerApplications(await organizerApi.getPartnerApplications(selectedEventId));
  };

  const handleUpdateProfile = async (updates: Partial<OrganizerProfile>) => {
    await organizerApi.updateProfile(updates);
    setProfile(await organizerApi.getProfile());
  };

  const heritagePayload = (item: ExtendedHeritageProfile) => ({
    code: item.code,
    name: item.name,
    nameEn: item.nameEn,
    province: item.province,
    provinceEn: item.provinceEn,
    category: item.category,
    categoryEn: item.categoryEn,
    period: item.period,
    periodEn: item.periodEn,
    address: item.address,
    addressEn: item.addressEn,
    briefDesc: item.briefDesc,
    briefDescEn: item.briefDescEn,
    story: item.story,
    storyEn: item.storyEn,
    highlights: item.highlights,
    highlightsEn: item.highlightsEn,
    referenceSource: item.referenceSource,
    status: item.status,
    qrStatus: item.qrStatus,
    imageUrl: item.image.url || null,
    imageAlt: item.image.alt || null,
    imageSource: item.image.source || null,
    imageLicense: item.image.license || null,
    mapX: item.mapCoordinates.x,
    mapY: item.mapCoordinates.y,
    mapAreaName: item.mapCoordinates.areaName || null,
  });

  const refreshHeritages = async () => setManagedHeritageList(await organizerApi.getHeritages());

  const handleCreateHeritage = async (item: ExtendedHeritageProfile) => {
    await organizerApi.createHeritage(heritagePayload(item));
    await refreshHeritages();
  };

  const handleUpdateHeritage = async (item: ExtendedHeritageProfile) => {
    await organizerApi.updateHeritage(item.id, heritagePayload(item));
    await refreshHeritages();
  };

  const handleDeleteHeritage = async (heritageId: string) => {
    await organizerApi.deleteHeritage(heritageId);
    await refreshHeritages();
  };

  const handleSaveEvent = async (request: OrganizerEventRequest, eventId?: string) => {
    const savedEvent = eventId
      ? await organizerApi.updateEvent(eventId, request)
      : await organizerApi.createEvent(request);
    setEventsList(current => {
      const alreadyExists = current.some(event => event.id === savedEvent.id);
      if (alreadyExists) return current.map(event => event.id === savedEvent.id ? savedEvent : event);
      return [savedEvent, ...current];
    });
    setEditingEvent(null);
    navigateToTab('event_detail', savedEvent.id);
  };

  const requestPublishEvent = (event: OrganizerEvent) => {
    setPublishFailure(null);
    setEventPendingPublish(event);
  };

  const handlePublishEvent = async () => {
    if (!eventPendingPublish || isPublishingEvent) return;
    setPublishFailure(null);
    setIsPublishingEvent(true);
    try {
      const publishedEvent = await organizerApi.publishEvent(eventPendingPublish.id);
      setEventsList(current => current.map(event => event.id === publishedEvent.id ? publishedEvent : event));
      setEventPendingPublish(null);
      setPublishSuccess(language === 'vi' ? 'Đã công bố sự kiện thành công.' : 'Event published successfully.');
    } catch (error) {
      setPublishFailure({
        message: error instanceof ApiError
          ? (language === 'vi' ? 'Máy chủ chưa chấp nhận công bố. Vui lòng kiểm tra lại thông tin bên dưới.' : 'The server did not accept publication. Review the details below.')
          : (error instanceof Error ? error.message : (language === 'vi' ? 'Không thể công bố sự kiện.' : 'Unable to publish event.')),
        fieldErrors: error instanceof ApiError ? error.fieldErrors : [],
      });
    } finally {
      setIsPublishingEvent(false);
    }
  };

  useEffect(() => {
    if (!publishSuccess) return;
    const timeoutId = window.setTimeout(() => setPublishSuccess(''), 4000);
    return () => window.clearTimeout(timeoutId);
  }, [publishSuccess]);

  // Notification Mark All as Read
  const handleMarkAllNotificationsRead = async () => {
    await organizerApi.markAllNotificationsRead();
    setNotificationsList(await organizerApi.getNotifications());
  };

  // Find currently selected event
  const matchingSelectedEvent = eventsList.find(event => event.id === selectedEventId);
  const currentSelectedEvent = activeTab === 'event_detail'
    ? matchingSelectedEvent
    : matchingSelectedEvent || eventsList[0];

  useEffect(() => {
    if (activeTab !== 'event_detail' || isLoadingEvents || !selectedEventId || matchingSelectedEvent) return;
    navigateToTab('events');
  }, [activeTab, isLoadingEvents, matchingSelectedEvent, navigateToTab, selectedEventId]);

  const handleRetryDashboardSummary = useCallback(async () => {
    setIsLoadingDashboardSummary(true);
    setDashboardSummaryError('');
    try {
      setDashboardSummary(await organizerApi.getDashboardSummary());
    } catch (error) {
      setDashboardSummaryError(error instanceof Error ? error.message : 'Không tải được dữ liệu Dashboard.');
    } finally {
      setIsLoadingDashboardSummary(false);
    }
  }, []);


  return (
    <div className="organizer-app-shell">
      {/* 1. Full-Width Top Header matching Partner portal */}
      <OrganizerTopBar 
        language={language}
        profile={profile}
        unreadCount={unreadCount}
        notifications={notificationsList}
        onOpenNotifications={() => navigateToTab('notifications')}
        onOpenProfile={() => navigateToTab('profile')}
        onLogout={onLogout}
        onOpenMobileMenu={() => setIsMobileMenuOpen(true)}
        onNavigateTab={(tab) => navigateToTab(tab)}
        onMarkNotificationRead={(id) => { void organizerApi.markNotificationRead(id).then(() => organizerApi.getNotifications()).then(setNotificationsList); }}
        onMarkAllNotificationsRead={handleMarkAllNotificationsRead}
      />

      {/* 2. Body Container: Sidebar + Main Viewport */}
      <div className="organizer-body-container">
        {/* Sidebar Navigation */}
        <OrganizerSidebar 
          language={language}
          activeTab={activeTab}
          onSelectTab={(tab: OrganizerTab) => navigateToTab(tab)}
          unreadNotificationsCount={unreadCount}
          isOpenMobile={isMobileMenuOpen}
          onCloseMobile={() => setIsMobileMenuOpen(false)}
          onLogout={onLogout}
        />

        {/* Main Viewport */}
        <main className="organizer-main-viewport">

        {loadError && (activeTab !== 'events' || selectedEventId) && activeTab !== 'overview' && <p className="app-loading-state" role="alert">{loadError}</p>}
        {isLoadingEvents && activeTab !== 'events' && activeTab !== 'overview' && <p className="app-loading-state" role="status">Đang tải danh sách sự kiện...</p>}
        {actionError && activeTab !== 'events' && activeTab !== 'overview' && <p className="app-loading-state" role="alert">{actionError}</p>}

        {/* Dynamic Views Rendering based on activeTab */}
        {activeTab === 'venues' && <OrganizerLocationManagementView />}
        {activeTab === 'overview' && (
          <OrganizerDashboard 
            language={language}
            events={eventsList}
            summary={dashboardSummary}
            isLoadingEvents={isLoadingEvents}
            eventsError={loadError}
            isLoadingSummary={isLoadingDashboardSummary}
            summaryError={dashboardSummaryError}
            onRetryEvents={() => {
              setIsLoadingEvents(true);
              void refreshOrganizerData();
            }}
            onRetrySummary={handleRetryDashboardSummary}
            onNavigateTab={(tab: OrganizerTab, extraState?: { eventId?: string; section?: string }) => {
              if (tab === 'event_detail' && extraState?.eventId) {
                const search = extraState.section ? `?section=${encodeURIComponent(extraState.section)}` : '';
                navigate(`${organizerTabPath('event_detail', extraState.eventId)}${search}`);
                return;
              }
              navigateToTab(tab, extraState?.eventId);
            }}
          />
        )}

        {activeTab === 'events' && !selectedEventId && (
          <EventManagementView 
            language={language}
            events={eventsList}
            isLoading={isLoadingEvents}
            loadError={loadError}
            onRetry={() => {
              setIsLoadingEvents(true);
              void refreshOrganizerData();
            }}
            onSelectEvent={(eventId: string) => navigateToTab('event_detail', eventId)}
            onOpenCreateEvent={() => { setEditingEvent(null); setIsCreateEventOpen(true); }}
            onEditEvent={(event) => { setEditingEvent(event); setIsCreateEventOpen(true); }}
            onPublishEvent={requestPublishEvent}
          />
        )}

        {activeTab === 'event_detail' && currentSelectedEvent && (
          <EventDetailView 
            language={language}
            event={currentSelectedEvent}
            booths={boothsList}
            boothRequests={boothRequests}
            activePhysicalBoothCount={activePhysicalBoothCount}
            isLoadingOperations={isLoadingEventOperations}
            operationsError={eventOperationsError}
            activities={activitiesList}
            participants={participantsList}
            partnerApplications={partnerApplications}
            onApprovePartnerApplication={handleApprovePartnerApplication}
            onRejectPartnerApplication={handleRejectPartnerApplication}
            onBack={() => navigateToTab('events')}
            onRetryOperations={() => setEventOperationsReloadKey(current => current + 1)}
            onNavigateToBoothRequests={() => navigateToTab('booth_requests', currentSelectedEvent.id)}
            onNavigateToBoothsMap={() => {
              navigateToTab('booths', currentSelectedEvent.id);
            }}
            onBoothConfigurationChanged={async () => {
              try {
                setBoothsList(await organizerApi.getBooths(currentSelectedEvent.id));
              } catch (error) {
                setActionError(error instanceof Error ? error.message : 'Không tải lại được cấu hình gian hàng.');
              }
            }}
            onEditEvent={(event) => { setEditingEvent(event); setIsCreateEventOpen(true); }}
            onPublishEvent={requestPublishEvent}
          />
        )}

        {activeTab === 'booth_requests' && (
          <OrganizerBoothRequestsView
            language={language}
            events={eventsList}
            selectedEventId={currentSelectedEvent?.id || 'all'}
            onSelectEventId={selectEventForCurrentScreen}
          />
        )}

        {activeTab === 'booths' && (
          <OrganizerBoothManagementView
            language={language}
            onOpenRequests={() => navigateToTab('booth_requests', selectedEventId)}
          />
        )}

        {activeTab === 'activities' && (
          <OrganizerActivityWorkspace
            language={language}
            events={eventsList}
            selectedEventId={selectedEventId}
          />
        )}

        {activeTab === 'participants' && (
          <ParticipantManagementView 
            language={language}
            events={eventsList}
            selectedEventId={currentSelectedEvent?.id || 'all'}
            onSelectEventId={selectEventForCurrentScreen}
            participants={participantsList}
            onOpenAttendanceModal={() => setIsAttendanceModalOpen(true)}
            onManualOverrideStatus={handleManualOverrideStatus}
          />
        )}

        {activeTab === 'reports' && (
          <OrganizerReportsView 
            language={language}
            events={eventsList}
            selectedEventId={currentSelectedEvent?.id || 'all'}
            onSelectEventId={selectEventForCurrentScreen}
          />
        )}

        {activeTab === 'feedback' && <OrganizerFeedbackView language={language} />}

        {activeTab === 'public_content' && (
          <OrganizerPublicContentView 
            language={language}
            heritageList={managedHeritageList}
            onAddHeritage={handleCreateHeritage}
            onUpdateHeritage={handleUpdateHeritage}
            onDeleteHeritage={handleDeleteHeritage}
          />
        )}

        {activeTab === 'notifications' && (
          <OrganizerNotificationsView 
            language={language}
            notifications={notificationsList}
            onMarkAllRead={handleMarkAllNotificationsRead}
            onNavigateTab={(tab: OrganizerTab) => navigateToTab(tab)}
          />
        )}

        {activeTab === 'profile' && (
          <OrganizerProfileView 
            language={language}
            profile={profile}
            onUpdateProfile={handleUpdateProfile}
            onLogout={onLogout}
          />
        )}
        </main>
      </div>

      {/* Global Attendance Scanner Modal */}
      <OrganizerAttendanceModal 
        language={language}
        isOpen={isAttendanceModalOpen}
        onClose={() => setIsAttendanceModalOpen(false)}
        onRecordScan={handleRecordScan}
      />

      {publishSuccess && <div className="org-toast-banner" role="status"><CheckCircle2 size={18} />{publishSuccess}</div>}

      <OrganizerPublishEventModal
        language={language}
        event={eventPendingPublish}
        isPublishing={isPublishingEvent}
        failure={publishFailure}
        onClose={() => {
          if (isPublishingEvent) return;
          setEventPendingPublish(null);
          setPublishFailure(null);
        }}
        onConfirm={handlePublishEvent}
        onEdit={(event) => {
          setEventPendingPublish(null);
          setPublishFailure(null);
          setEditingEvent(event);
          setIsCreateEventOpen(true);
        }}
      />

      {/* Global Create Event Modal */}
      <OrganizerCreateEventModal 
        key={`${editingEvent?.id || 'new'}-${isCreateEventOpen ? 'open' : 'closed'}`}
        language={language}
        isOpen={isCreateEventOpen}
        event={editingEvent}
        onClose={() => { setIsCreateEventOpen(false); setEditingEvent(null); }}
        onSave={handleSaveEvent}
      />

    </div>
  );
};

export default ManagementPortal;
