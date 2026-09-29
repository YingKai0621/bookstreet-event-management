export type OrganizerTab = 
  | 'overview'
  | 'events'
  | 'event_detail'
  | 'booths'
  | 'activities'
  | 'participants'
  | 'reports'
  | 'public_content'
  | 'notifications'
  | 'profile';

export interface OrganizerProfile {
  id: string;
  name: string;
  role: string;
  department: string;
  organization?: string;
  email: string;
  phone: string;
  avatarInitials: string;
  avatarUrl?: string;
  notificationPreferences?: {
    newBooth: boolean;
    newActivity: boolean;
    dailyEmail: boolean;
  };
}

export interface OrganizerEvent {
  id: string;
  title: string;
  titleEn?: string;
  theme?: string;
  dateRange: string;
  startDate: string;
  endDate: string;
  location: string;
  status: 'happening' | 'upcoming' | 'draft' | 'completed';
  statusLabelVi: string;
  imageUrl: string;
  coverImage?: string;
  description: string;
  boothOccupancy: string;
  boothsCount: number;
  maxBooths: number;
  totalBooths?: number;
  activitiesCount: number;
  registrationsCount: number;
  registeredBooths?: number;
  registeredActivities?: number;
  registeredParticipants?: number;
  attendanceRate: number;
  averageRating: number;
  // Configurable Settings
  boothDeadline?: string;
  activityDeadline?: string;
  participantDeadline?: string;
  cancellationCutoff?: string;
  maxCapacity?: number;
  isPublished?: boolean;
}

export interface OrganizerBoothItem {
  id: string;
  requestId?: string | null;
  code: string;
  name: string;
  nameEn?: string;
  orgName?: string;
  zone: string;
  areaType: string;
  dimensions: string;
  status: 'assigned' | 'pending' | 'available' | 'unavailable';
  statusLabelVi: string;
  statusLabelEn?: string;
  priceEstimate?: string;
  registeredDate?: string;
  notes?: string;
  x?: number | null;
  y?: number | null;
}

export interface OrganizerActivityItem {
  id: string;
  eventId: string;
  title: string;
  type: string;
  dateStr: string;
  timeStr: string;
  location: string;
  capacity: number;
  registeredCount: number;
  attendedCount: number;
  partnerName: string;
  speaker: string;
  status: 'approved' | 'pending' | 'need_revision' | 'rejected' | 'cancelled';
  statusLabelVi: string;
  isPublished: boolean;
  thumbnail: string;
  description: string;
  hasConflict?: boolean;
  conflictNotes?: string;
}

export interface OrganizerParticipantItem {
  id: string;
  eventId: string;
  fullName: string;
  email: string;
  phone: string;
  registeredActivitiesCount: number;
  status: 'attended' | 'not_attended' | 'cancelled';
  statusLabelVi: string;
  checkInTime?: string;
  registeredDate: string;
  ticketCode: string;
  manualOverrideReason?: string;
}

export interface OrganizerNotificationItem {
  id: string;
  title: string;
  content: string;
  category: 'booth' | 'activity' | 'participant' | 'feedback' | 'system';
  timeAgo: string;
  isRead: boolean;
  isImportant?: boolean;
  targetTab?: string;
  relatedId?: string;
}
