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
  OrganizerBoothItem,
  OrganizerActivityItem,
  OrganizerParticipantItem,
  OrganizerNotificationItem,
  OrganizerProfile
} from '../types/organizer';
import { organizerApi, OrganizerPartnerApplication } from '../services/organizerApi';

import './portal/OrganizerPortal.css';

export interface ManagementPortalProps {
  language: Language;
  onLogout?: () => void;
}

export const ManagementPortal: React.FC<ManagementPortalProps> = ({
  language,
  onLogout
}) => {
  // Navigation State
  const [activeTab, setActiveTab] = useState<OrganizerTab>('overview');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);



  // Modal State
  const [isAttendanceModalOpen, setIsAttendanceModalOpen] = useState(false);
  const [isCreateEventOpen, setIsCreateEventOpen] = useState(false);
  const [isCreateActivityOpen, setIsCreateActivityOpen] = useState(false);

  // Core Datasets State
  const [eventsList, setEventsList] = useState<OrganizerEvent[]>([]);
  const [boothsList, setBoothsList] = useState<OrganizerBoothItem[]>([]);
  const [activitiesList, setActivitiesList] = useState<OrganizerActivityItem[]>([]);
  const [participantsList, setParticipantsList] = useState<OrganizerParticipantItem[]>([]);
  const [notificationsList, setNotificationsList] = useState<OrganizerNotificationItem[]>([]);
  const [profile, setProfile] = useState<OrganizerProfile>({ id: '', name: '', role: '', department: '', email: '', phone: '', avatarInitials: '' });
  const [partnerApplications, setPartnerApplications] = useState<OrganizerPartnerApplication[]>([]);
  const [proposalList, setProposalList] = useState<any[]>([]);
  const [eventLocations, setEventLocations] = useState<Array<{ id: string; name: string; capacity: number }>>([]);
  const [managedHeritageList, setManagedHeritageList] = useState<ExtendedHeritageProfile[]>([]);
  const [loadError, setLoadError] = useState('');

  // Only the organizer profile is available in the reduced API. Clear stale data
  // from legacy screens so they render their existing empty states consistently.
  const refreshOrganizerData = async (_preferredEventId?: string | null) => {
    const organizerProfile = await organizerApi.getProfile();
    setProfile(organizerProfile);
    setEventsList([]); setBoothsList([]); setActivitiesList([]); setParticipantsList([]);
    setPartnerApplications([]); setProposalList([]); setEventLocations([]); setManagedHeritageList([]); setNotificationsList([]);
    setLoadError('');
  };

  useEffect(() => {
    void refreshOrganizerData().catch(error => { console.warn('Could not load organizer data', error); setLoadError(error instanceof Error ? error.message : 'Không tải được dữ liệu điều hành'); });
    const refresh = () => void refreshOrganizerData().catch(error => console.warn('Could not refresh organizer data', error));
    const intervalId = window.setInterval(refresh, 15000);
    window.addEventListener('focus', refresh);
    window.addEventListener('duongsach:data-changed', refresh);
    return () => { window.clearInterval(intervalId); window.removeEventListener('focus', refresh); window.removeEventListener('duongsach:data-changed', refresh); };
  }, [selectedEventId]);

  useEffect(() => {
    if (!selectedEventId) return;
    Promise.all([
      organizerApi.getBooths(selectedEventId), organizerApi.getActivities(selectedEventId), organizerApi.getParticipants(selectedEventId),
      organizerApi.getPartnerApplications(selectedEventId), organizerApi.getProposals(selectedEventId), organizerApi.getEventLocations(selectedEventId),
    ]).then(([booths, activities, participants, applications, activityProposals, locations]) => {
      setBoothsList(booths); setActivitiesList(activities); setParticipantsList(participants);
      setPartnerApplications(applications); setProposalList(activityProposals); setEventLocations(locations);
    }).catch(error => console.warn('Could not load selected event data', error));
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

  const handleApprovePartnerApplication = async (applicationId: string) => {
    await organizerApi.approvePartnerApplication(applicationId);
    await refreshOrganizerData(selectedEventId);
    window.dispatchEvent(new Event('duongsach:data-changed'));
  };

  const handleRejectPartnerApplication = async (applicationId: string) => {
    await organizerApi.rejectPartnerApplication(applicationId, 'Hồ sơ chưa đáp ứng đầy đủ yêu cầu tham gia sự kiện.');
    await refreshOrganizerData(selectedEventId);
    window.dispatchEvent(new Event('duongsach:data-changed'));
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

  // Event Settings Update
  const handleUpdateEventSettings = async (eventId: string, updatedSettings: Partial<OrganizerEvent>) => {
    await organizerApi.updateEvent(eventId, {
      title: updatedSettings.title,
      theme: updatedSettings.theme,
      description: updatedSettings.description,
      startAt: updatedSettings.startDate,
      endAt: updatedSettings.endDate,
      boothRequestDeadline: updatedSettings.boothDeadline,
      proposalDeadline: updatedSettings.activityDeadline,
      participantRegDeadline: updatedSettings.participantDeadline,
    });
    await refreshOrganizerData(eventId);
    window.dispatchEvent(new Event('duongsach:data-changed'));
  };

  // Toggle Publish / Hide Event on Landing Page
  const handleTogglePublishEvent = async (eventId: string) => {
    const event = eventsList.find(item => item.id === eventId);
    if (!event) return;
    if (event.isPublished) await organizerApi.unpublishEvent(eventId);
    else await organizerApi.publishEvent(eventId);
    await refreshOrganizerData(eventId);
    window.dispatchEvent(new Event('duongsach:data-changed'));
  };

  // Create Event Handler
  const handleCreateNewEvent = async (newEventData: Partial<OrganizerEvent> & { title: string; startDate: string; endDate: string; location: string }) => {
    const created: any = await organizerApi.createEvent({
      title: newEventData.title, theme: newEventData.theme, location: newEventData.location,
      startAt: `${newEventData.startDate}T00:00:00+07:00`, endAt: `${newEventData.endDate}T23:59:59+07:00`,
      description: newEventData.description, coverImageUrl: newEventData.coverImage,
      boothRequestDeadline: newEventData.boothDeadline ? `${newEventData.boothDeadline}T23:59:59+07:00` : null,
      proposalDeadline: newEventData.activityDeadline ? `${newEventData.activityDeadline}T23:59:59+07:00` : null,
      participantRegDeadline: newEventData.participantDeadline ? `${newEventData.participantDeadline}T23:59:59+07:00` : null,
    });
    if (newEventData.isPublished) await organizerApi.publishEvent(created.id);
    setSelectedEventId(created.id);
    await refreshOrganizerData(created.id);
    window.dispatchEvent(new Event('duongsach:data-changed'));
    setActiveTab('events');
  };

  const handleBroadcastEvent = async (eventId: string) => {
    await organizerApi.broadcastEvent(eventId);
    await refreshOrganizerData(selectedEventId);
  };

  const handleDuplicateEvent = async (eventId: string) => {
    const created: any = await organizerApi.duplicateEvent(eventId);
    await refreshOrganizerData(created.id);
    setSelectedEventId(created.id);
  };

  const handleCancelEvent = async (eventId: string) => {
    await organizerApi.cancelEvent(eventId, 'Hủy sự kiện theo quyết định điều hành của Ban Quản Lý.');
    await refreshOrganizerData(selectedEventId === eventId ? null : selectedEventId);
    if (selectedEventId === eventId) setSelectedEventId(null);
    window.dispatchEvent(new Event('duongsach:data-changed'));
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
          if (tab !== 'events') setSelectedEventId(null);
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
            if (tab !== 'events') {
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

        {loadError && <p className="app-loading-state" role="status">Dữ liệu nghiệp vụ điều hành đang chờ triển khai.</p>}
        {!currentSelectedEvent && !loadError && <p className="app-loading-state" role="status">Chưa có dữ liệu sự kiện để hiển thị.</p>}

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
            onOpenCreateEvent={() => setIsCreateEventOpen(true)}
            onOpenAttendanceModal={() => setIsAttendanceModalOpen(true)}
          />
        )}

        {activeTab === 'overview' && !currentSelectedEvent && (
          <div className="organizer-content"><div className="organizer-card"><h2>Chưa có sự kiện</h2><p>Hãy tạo sự kiện đầu tiên để bắt đầu điều hành.</p><button type="button" className="btn-org-primary" onClick={() => setIsCreateEventOpen(true)}>Tạo sự kiện</button></div></div>
        )}

        {activeTab === 'events' && !selectedEventId && (
          <EventManagementView 
            language={language}
            events={eventsList}
            onSelectEvent={(eventId: string) => setSelectedEventId(eventId)}
            onOpenCreateEvent={() => setIsCreateEventOpen(true)}
            onTogglePublishEvent={handleTogglePublishEvent}
            onBroadcastEvent={handleBroadcastEvent}
            onDuplicateEvent={handleDuplicateEvent}
            onCancelEvent={handleCancelEvent}
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
            onUpdateEventSettings={handleUpdateEventSettings}
            onTogglePublishEvent={handleTogglePublishEvent}
            onBroadcastEvent={handleBroadcastEvent}
          />
        )}

        {activeTab === 'booths' && currentSelectedEvent && (
          <BoothMapView 
            language={language}
            events={eventsList}
            selectedEventId={currentSelectedEvent.id}
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

        {activeTab === 'participants' && currentSelectedEvent && (
          <ParticipantManagementView 
            language={language}
            events={eventsList}
            selectedEventId={currentSelectedEvent.id}
            onSelectEventId={(id: string) => setSelectedEventId(id)}
            participants={participantsList}
            onOpenAttendanceModal={() => setIsAttendanceModalOpen(true)}
            onManualOverrideStatus={handleManualOverrideStatus}
          />
        )}

        {activeTab === 'reports' && currentSelectedEvent && (
          <OrganizerReportsView 
            language={language}
            events={eventsList}
            selectedEventId={currentSelectedEvent.id}
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
        language={language}
        isOpen={isCreateEventOpen}
        onClose={() => setIsCreateEventOpen(false)}
        onCreateEvent={handleCreateNewEvent}
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
