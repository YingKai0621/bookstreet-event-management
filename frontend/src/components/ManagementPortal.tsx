import React, { useEffect, useState } from 'react';
import {
  Language, 
  ExtendedHeritageProfile 
} from '../types';
import { 
  OrganizerTab, 
  OrganizerSidebar 
} from './portal/OrganizerSidebar';
import { OrganizerTopBar } from './portal/OrganizerTopBar';
import { OrganizerDashboard } from './portal/OrganizerDashboard';
import { FacilityManagementView } from './admin/FacilityManagementView';
import { EventManagementView } from './portal/EventManagementView';
import { EventDetailView } from './portal/EventDetailView';

import { BoothMapView } from './portal/BoothMapView';
import { Sprint2BoothWorkspace } from './portal/Sprint2BoothWorkspace';
import { ActivityManagementView } from './portal/ActivityManagementView';
import { ParticipantManagementView } from './portal/ParticipantManagementView';
import { OrganizerAttendanceModal } from './portal/OrganizerAttendanceModal';
import { OrganizerReportsView } from './portal/OrganizerReportsView';
import { OrganizerNotificationsView } from './portal/OrganizerNotificationsView';
import { OrganizerProfileView } from './portal/OrganizerProfileView';
import { OrganizerPublicContentView } from './portal/OrganizerPublicContentView';
import { OrganizerCreateEventModal } from './portal/OrganizerCreateEventModal';
import { OrganizerCreateActivityModal } from './portal/OrganizerCreateActivityModal';
import { OrganizerFeedbackView } from './portal/OrganizerFeedbackView';

import {
  OrganizerEvent,
  OrganizerEventRequest,
  OrganizerBoothItem,
  OrganizerActivityItem,
  OrganizerParticipantItem,
  OrganizerNotificationItem,
  OrganizerProfile
} from '../types/organizer';
import { organizerApi, OrganizerPartnerApplication } from '../services/organizerApi';
import { useAuth } from '../auth/useAuth';

import './portal/OrganizerPortal.css';

export interface ManagementPortalProps {
  language: Language;
  onLogout?: () => void;
}

export const ManagementPortal: React.FC<ManagementPortalProps> = ({
  language,
  onLogout
}) => {
  const { user } = useAuth();
  // Navigation State
  const [activeTab, setActiveTab] = useState<OrganizerTab>('overview');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);



  // Modal State
  const [isAttendanceModalOpen, setIsAttendanceModalOpen] = useState(false);
  const [isCreateEventOpen, setIsCreateEventOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<OrganizerEvent | null>(null);
  const [isCreateActivityOpen, setIsCreateActivityOpen] = useState(false);

  // Core Datasets State
  const [eventsList, setEventsList] = useState<OrganizerEvent[]>([]);
  const [boothsList, setBoothsList] = useState<OrganizerBoothItem[]>([]);
  const [activitiesList, setActivitiesList] = useState<OrganizerActivityItem[]>([]);
  const [participantsList, setParticipantsList] = useState<OrganizerParticipantItem[]>([]);
  const [notificationsList, setNotificationsList] = useState<OrganizerNotificationItem[]>([]);
  const [profile, setProfile] = useState<OrganizerProfile>(() => {
    const fullName = user?.fullName || '';
    const initials = fullName.split(' ').filter(Boolean).map(part => part[0]).join('').slice(-2).toUpperCase();
    return { id: String(user?.userId || ''), name: fullName, role: 'ORGANIZER', department: 'Ban Tổ Chức Sự Kiện', organization: 'Đường Sách TP.HCM', email: user?.email || '', phone: '', avatarInitials: initials };
  });
  const [partnerApplications, setPartnerApplications] = useState<OrganizerPartnerApplication[]>([]);
  const [proposalList] = useState<any[]>([]);
  const [eventLocations] = useState<Array<{ id: string; name: string; capacity: number }>>([]);
  const [managedHeritageList, setManagedHeritageList] = useState<ExtendedHeritageProfile[]>([]);
  const [loadError, setLoadError] = useState('');
  const [actionError, setActionError] = useState('');
  const [isLoadingEvents, setIsLoadingEvents] = useState(true);

  const refreshOrganizerData = async (preferredEventId?: string | null) => {
    try {
      const [events, activities] = await Promise.all([
        organizerApi.getEvents(),
        organizerApi.getActivities(preferredEventId || undefined),
      ]);
      setEventsList(events);
      setActivitiesList(activities);
      if (preferredEventId && !events.some(event => event.id === preferredEventId)) {
        setSelectedEventId(null);
      }
      setLoadError('');
    } catch (error) {
      console.warn('Could not load organizer data', error);
      setLoadError(error instanceof Error ? error.message : 'Không tải được dữ liệu điều hành');
    } finally {
      setIsLoadingEvents(false);
    }
  };

  useEffect(() => {
    void refreshOrganizerData().catch(error => { console.warn('Could not load organizer data', error); setLoadError(error instanceof Error ? error.message : 'Không tải được dữ liệu điều hành'); setIsLoadingEvents(false); });
    const refresh = () => void refreshOrganizerData().catch(error => console.warn('Could not refresh organizer data', error));
    const intervalId = window.setInterval(refresh, 15000);
    window.addEventListener('focus', refresh);
    window.addEventListener('duongsach:data-changed', refresh);
    return () => { window.clearInterval(intervalId); window.removeEventListener('focus', refresh); window.removeEventListener('duongsach:data-changed', refresh); };
  }, []);

  useEffect(() => {
    const targetEventId = selectedEventId || eventsList[0]?.id;
    organizerApi.getActivities(targetEventId).then(setActivitiesList).catch(() => setActivitiesList([]));
    organizerApi.getBooths(targetEventId).then(setBoothsList).catch(() => setBoothsList([]));
    organizerApi.getParticipants(targetEventId).then(setParticipantsList).catch(() => setParticipantsList([]));

    if (selectedEventId) {
      organizerApi.getEvent(selectedEventId).then(event => {
        setEventsList(current => current.map(item => item.id === event.id ? event : item));
      }).catch(error => setActionError(error instanceof Error ? error.message : 'Không tải được chi tiết sự kiện.'));
    }
  }, [selectedEventId, eventsList.length]);

  useEffect(() => {
    if (!selectedEventId) {
      setPartnerApplications([]);
      return;
    }

    const refreshApplications = () => {
      void organizerApi.getPartnerApplications(selectedEventId)
        .then(setPartnerApplications)
        .catch(error => setActionError(
          error instanceof Error ? error.message : 'Không tải được hồ sơ đối tác.',
        ));
    };

    refreshApplications();
    const intervalId = window.setInterval(refreshApplications, 15000);
    window.addEventListener('focus', refreshApplications);
    window.addEventListener('duongsach:data-changed', refreshApplications);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('focus', refreshApplications);
      window.removeEventListener('duongsach:data-changed', refreshApplications);
    };
  }, [selectedEventId]);

  // Unread notifications count
  const unreadCount = notificationsList.filter(n => !n.isRead).length;

  // Handlers for Booth Approval
  const handleApproveBooth = async (boothId: string) => {
    const booth = boothsList.find(item => item.id === boothId);
    if (!booth?.requestId) return;
    await organizerApi.approveBoothRequest(booth.requestId);
    await refreshOrganizerData(selectedEventId);
    window.dispatchEvent(new Event('duongsach:data-changed'));
  };

  const handleRejectBooth = async (boothId: string) => {
    const booth = boothsList.find(item => item.id === boothId);
    if (!booth?.requestId) return;
    await organizerApi.rejectBoothRequest(booth.requestId);
    await refreshOrganizerData(selectedEventId);
    window.dispatchEvent(new Event('duongsach:data-changed'));
  };

  // Handlers for Activity Approval
  const handleApproveActivity = async (actId: string) => {
    await organizerApi.updateActivity(actId, { status: 'approved' });
    await refreshOrganizerData(selectedEventId);
  };

  const handleRejectActivity = async (actId: string) => {
    await organizerApi.updateActivity(actId, { status: 'cancelled', reason: 'Hủy bởi Ban Quản Lý' });
    await refreshOrganizerData(selectedEventId);
  };

  const handlePublishActivity = async (actId: string) => {
    await organizerApi.publishActivity(actId);
    await refreshOrganizerData(selectedEventId);
    window.dispatchEvent(new Event('duongsach:data-changed'));
  };

  const handleUpdateActivity = async (updatedAct: OrganizerActivityItem) => {
    await organizerApi.updateActivity(updatedAct.id, { title: updatedAct.title, description: updatedAct.description, speaker: updatedAct.speaker, capacity: updatedAct.capacity });
    await refreshOrganizerData(selectedEventId);
  };

  const handleDeleteActivity = async (actId: string) => {
    await organizerApi.updateActivity(actId, { status: 'cancelled', reason: 'Hủy bởi Ban Quản Lý' });
    await refreshOrganizerData(selectedEventId);
  };

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
    if (!selectedEventId) return;
    setActionError('');
    try {
      await organizerApi.approvePartnerApplication(applicationId, reviewNote);
      setPartnerApplications(await organizerApi.getPartnerApplications(selectedEventId));
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Không thể duyệt hồ sơ đối tác.');
    }
  };

  const handleRejectPartnerApplication = async (
    applicationId: string,
    reviewNote: string,
  ) => {
    if (!selectedEventId) return;
    setActionError('');
    try {
      await organizerApi.rejectPartnerApplication(applicationId, reviewNote);
      setPartnerApplications(await organizerApi.getPartnerApplications(selectedEventId));
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Không thể từ chối hồ sơ đối tác.');
    }
  };

  const handleApproveProposal = async (proposalId: string) => {
    await organizerApi.approveProposal(proposalId);
    await refreshOrganizerData(selectedEventId);
    window.dispatchEvent(new Event('duongsach:data-changed'));
  };

  const handleRejectProposal = async (proposalId: string) => {
    await organizerApi.rejectProposal(proposalId, 'Đề xuất chưa đáp ứng đầy đủ yêu cầu tổ chức hoạt động.');
    await refreshOrganizerData(selectedEventId);
    window.dispatchEvent(new Event('duongsach:data-changed'));
  };

  const handleUpdateProfile = async (updates: Partial<OrganizerProfile>) => {
    await organizerApi.updateProfile(updates);
    setProfile(await organizerApi.getProfile());
    window.dispatchEvent(new Event('duongsach:data-changed'));
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
    window.dispatchEvent(new Event('duongsach:data-changed'));
  };

  const handleUpdateHeritage = async (item: ExtendedHeritageProfile) => {
    await organizerApi.updateHeritage(item.id, heritagePayload(item));
    await refreshHeritages();
    window.dispatchEvent(new Event('duongsach:data-changed'));
  };

  const handleDeleteHeritage = async (heritageId: string) => {
    await organizerApi.deleteHeritage(heritageId);
    await refreshHeritages();
    window.dispatchEvent(new Event('duongsach:data-changed'));
  };

  const handleSaveEvent = async (request: OrganizerEventRequest, eventId?: string) => {
    setActionError('');
    const savedEvent = eventId
      ? await organizerApi.updateEvent(eventId, request)
      : await organizerApi.createEvent(request);
    setEventsList(current => {
      const alreadyExists = current.some(event => event.id === savedEvent.id);
      if (alreadyExists) return current.map(event => event.id === savedEvent.id ? savedEvent : event);
      return [savedEvent, ...current];
    });
    setEditingEvent(null);
    setSelectedEventId(savedEvent.id);
    setActiveTab('events');
  };

  const handlePublishEvent = async (eventId: string) => {
    setActionError('');
    try {
      const publishedEvent = await organizerApi.publishEvent(eventId);
      setEventsList(current => current.map(event => event.id === publishedEvent.id ? publishedEvent : event));
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Không thể công bố sự kiện.');
    }
  };

  // Create Activity Handler
  const handleCreateNewActivity = async (newActivity: OrganizerActivityItem) => {
    const [day, month, year] = newActivity.dateStr.split('/');
    const isoDate = year ? `${year}-${month}-${day}` : newActivity.dateStr;
    const [startTime, endTime] = newActivity.timeStr.split('–').map(value => value.trim());
    await organizerApi.createActivity({
      eventId: newActivity.eventId, title: newActivity.title, kind: newActivity.type,
      startAt: `${isoDate}T${startTime}:00+07:00`, endAt: `${isoDate}T${endTime}:00+07:00`,
      location: newActivity.location, capacity: newActivity.capacity, speaker: newActivity.speaker,
      description: newActivity.description, imageUrl: newActivity.thumbnail, isPublished: newActivity.isPublished,
    });
    await refreshOrganizerData(newActivity.eventId);
    window.dispatchEvent(new Event('duongsach:data-changed'));
  };

  // Notification Mark All as Read
  const handleMarkAllNotificationsRead = async () => {
    await organizerApi.markAllNotificationsRead();
    setNotificationsList(await organizerApi.getNotifications());
  };

  // Find currently selected event
  const currentSelectedEvent = eventsList.find(e => e.id === selectedEventId) || eventsList[0];

  return (
    <div className="organizer-app-shell">
      {/* 1. Full-Width Top Header matching Partner portal */}
      <OrganizerTopBar 
        language={language}
        profile={profile}
        unreadCount={unreadCount}
        notifications={notificationsList}
        onOpenNotifications={() => setActiveTab('notifications')}
        onOpenProfile={() => setActiveTab('profile')}
        onLogout={onLogout}
        onOpenMobileMenu={() => setIsMobileMenuOpen(true)}
        onNavigateTab={(tab) => {
          setActiveTab(tab);
          if (tab !== 'events' && tab !== 'booth_requests' && tab !== 'booths' && tab !== 'participants' && tab !== 'reports') {
            setSelectedEventId(null);
          }
        }}
        onMarkNotificationRead={(id) => { void organizerApi.markNotificationRead(id).then(() => organizerApi.getNotifications()).then(setNotificationsList); }}
        onMarkAllNotificationsRead={handleMarkAllNotificationsRead}
      />

      {/* 2. Body Container: Sidebar + Main Viewport */}
      <div className="organizer-body-container">
        {/* Sidebar Navigation */}
        <OrganizerSidebar 
          language={language}
          activeTab={activeTab}
          onSelectTab={(tab: OrganizerTab) => {
            setActiveTab(tab);
            if (tab !== 'events' && tab !== 'booth_requests' && tab !== 'booths' && tab !== 'participants' && tab !== 'reports') {
              setSelectedEventId(null);
            }
          }}
          unreadNotificationsCount={unreadCount}
          isOpenMobile={isMobileMenuOpen}
          onCloseMobile={() => setIsMobileMenuOpen(false)}
          onLogout={onLogout}
        />

        {/* Main Viewport */}
        <main className="organizer-main-viewport">

        {loadError && <p className="app-loading-state" role="alert">{loadError}</p>}
        {isLoadingEvents && <p className="app-loading-state" role="status">Đang tải danh sách sự kiện...</p>}
        {actionError && activeTab === 'events' && selectedEventId && <p className="app-loading-state" role="alert">{actionError}</p>}

        {/* Dynamic Views Rendering based on activeTab */}
        {activeTab === 'venues' && <FacilityManagementView key="venues" kind="venues" />}
        {activeTab === 'assets' && <FacilityManagementView key="assets" kind="assets" />}
        {activeTab === 'overview' && currentSelectedEvent && (
          <OrganizerDashboard 
            language={language}
            profile={profile}
            activeEvent={currentSelectedEvent}
            events={eventsList}
            booths={boothsList}
            activities={activitiesList}
            onNavigateTab={(tab: OrganizerTab) => {
              setActiveTab(tab);
              if (tab !== 'events') setSelectedEventId(null);
            }}
            onOpenCreateEvent={() => { setEditingEvent(null); setIsCreateEventOpen(true); }}
            onOpenAttendanceModal={() => setIsAttendanceModalOpen(true)}
          />
        )}

        {activeTab === 'overview' && !currentSelectedEvent && (
          <div className="organizer-content"><div className="organizer-card"><h2>Chưa có sự kiện</h2><p>Hãy tạo sự kiện đầu tiên để bắt đầu điều hành.</p><button type="button" className="btn-org-primary" onClick={() => { setEditingEvent(null); setIsCreateEventOpen(true); }}>Tạo sự kiện</button></div></div>
        )}

        {activeTab === 'events' && !selectedEventId && (
          <EventManagementView 
            language={language}
            events={eventsList}
            actionError={actionError}
            onSelectEvent={(eventId: string) => { setActionError(''); setSelectedEventId(eventId); }}
            onOpenCreateEvent={() => { setEditingEvent(null); setIsCreateEventOpen(true); }}
            onEditEvent={(event) => { setEditingEvent(event); setIsCreateEventOpen(true); }}
            onPublishEvent={handlePublishEvent}
          />
        )}

        {activeTab === 'events' && selectedEventId && currentSelectedEvent && (
          <EventDetailView 
            language={language}
            event={currentSelectedEvent}
            booths={boothsList}
            activities={activitiesList}
            participants={participantsList}
            partnerApplications={partnerApplications}
            activityProposals={proposalList}
            onApprovePartnerApplication={handleApprovePartnerApplication}
            onRejectPartnerApplication={handleRejectPartnerApplication}
            onApproveProposal={handleApproveProposal}
            onRejectProposal={handleRejectProposal}
            onBack={() => setSelectedEventId(null)}
            onNavigateToBoothsMap={() => {
              setActiveTab('booths');
            }}
            onNavigateToReports={() => setActiveTab('reports')}
            onEditEvent={(event) => { setEditingEvent(event); setIsCreateEventOpen(true); }}
            onPublishEvent={handlePublishEvent}
          />
        )}

        {activeTab === 'booth_requests' && (
          <Sprint2BoothWorkspace
            language={language}
            events={eventsList}
            selectedEventId={currentSelectedEvent?.id || 'all'}
            onSelectEventId={(id: string) => setSelectedEventId(id)}
          />
        )}

        {activeTab === 'booths' && (
          <BoothMapView
            language={language}
            events={eventsList}
            selectedEventId={currentSelectedEvent?.id || 'all'}
            onSelectEventId={(id: string) => setSelectedEventId(id)}
            booths={boothsList}
            onApproveBooth={handleApproveBooth}
            onRejectBooth={handleRejectBooth}
          />
        )}

        {activeTab === 'activities' && (
          <ActivityManagementView 
            language={language}
            activities={activitiesList}
            onOpenCreateActivity={() => setIsCreateActivityOpen(true)}
            onApproveActivity={handleApproveActivity}
            onRejectActivity={handleRejectActivity}
            onPublishActivity={handlePublishActivity}
            onUpdateActivity={handleUpdateActivity}
            onDeleteActivity={handleDeleteActivity}
          />
        )}

        {activeTab === 'participants' && (
          <ParticipantManagementView 
            language={language}
            events={eventsList}
            selectedEventId={currentSelectedEvent?.id || 'all'}
            onSelectEventId={(id: string) => setSelectedEventId(id)}
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
            onSelectEventId={(id: string) => setSelectedEventId(id)}
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
            onNavigateTab={(tab: OrganizerTab) => setActiveTab(tab)}
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

      {/* Global Create Event Modal */}
      <OrganizerCreateEventModal 
        key={`${editingEvent?.id || 'new'}-${isCreateEventOpen ? 'open' : 'closed'}`}
        language={language}
        isOpen={isCreateEventOpen}
        event={editingEvent}
        onClose={() => { setIsCreateEventOpen(false); setEditingEvent(null); }}
        onSave={handleSaveEvent}
      />

      {/* Global Create Activity Modal */}
      <OrganizerCreateActivityModal 
        language={language}
        isOpen={isCreateActivityOpen}
        onClose={() => setIsCreateActivityOpen(false)}
        events={currentSelectedEvent ? [currentSelectedEvent] : []}
        locations={eventLocations}
        onCreateActivity={handleCreateNewActivity}
      />
    </div>
  );
};

export default ManagementPortal;
