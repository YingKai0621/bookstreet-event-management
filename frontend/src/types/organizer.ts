export type OrganizerTab = 
  | 'venues'
  | 'overview'
  | 'events'
  | 'event_detail'
  | 'booth_requests'
  | 'payments'
  | 'booths'
  | 'activities'
  | 'participants'
  | 'reports'
  | 'feedback'
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
}

export type OrganizerEventStatus =
  | 'DRAFT'
  | 'PUBLISHED'
  | 'ONGOING'
  | 'COMPLETED'
  | 'CANCELLED';

export interface OrganizerEventRequest {
  name: string;
  description: string | null;
  startAt: string;
  endAt: string;
  partnerApplicationDeadlineAt: string | null;
  boothRequestDeadlineAt: string | null;
  activityProposalDeadlineAt: string | null;
  participantRegistrationDeadlineAt: string | null;
  partnerWithdrawalCutoffAt: string | null;
  boothCancellationCutoffAt: string | null;
  activityCancellationCutoffAt: string | null;
  boothPaymentWindowMinutes: number;
  maxBoothsPerPartner: number;
  maxActivitiesPerPartner: number;
  bannerUrl: string | null;
}

/** PATCH payload: only changed fields are sent, preserving lifecycle-locked settings. */
export type OrganizerEventUpdateRequest = Partial<OrganizerEventRequest>;

export interface OrganizerEventResponse extends OrganizerEventRequest {
  eventId: number;
  organizerUserId: number;
  status: OrganizerEventStatus;
  cancelledAt?: string | null;
  cancellationReason?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface OrganizerEventPageResponse {
  content: OrganizerEventResponse[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

export interface OrganizerEvent {
  id: string;
  organizerUserId: number;
  title: string;
  titleEn?: string;
  theme?: string;
  dateRange: string;
  startDate: string;
  endDate: string;
  location: string | null;
  status: 'happening' | 'upcoming' | 'draft' | 'completed' | 'cancelled';
  apiStatus: OrganizerEventStatus;
  statusLabelVi: string;
  imageUrl: string;
  coverImage?: string;
  description: string;
  boothOccupancy: string | null;
  boothsCount: number | null;
  maxBooths: number;
  totalBooths?: number;
  activitiesCount: number | null;
  registrationsCount: number | null;
  registeredBooths?: number;
  registeredActivities?: number;
  registeredParticipants?: number;
  attendanceRate: number | null;
  averageRating: number | null;
  // Configurable Settings
  boothDeadline?: string;
  activityDeadline?: string;
  participantDeadline?: string;
  cancellationCutoff?: string;
  maxCapacity?: number;
  isPublished?: boolean;
  partnerApplicationDeadlineAt: string | null;
  boothRequestDeadlineAt: string | null;
  activityProposalDeadlineAt: string | null;
  participantRegistrationDeadlineAt: string | null;
  partnerWithdrawalCutoffAt: string | null;
  boothCancellationCutoffAt: string | null;
  activityCancellationCutoffAt: string | null;
  boothPaymentWindowMinutes: number;
  maxBoothsPerPartner: number;
  maxActivitiesPerPartner: number;
  bannerUrl: string | null;
  cancelledAt?: string | null;
  cancellationReason?: string | null;
  createdAt: string;
  updatedAt: string;
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

export interface OrganizerReport {
  eventId: string;
  eventName: string;
  totalParticipants: number;
  attended: number;
  pending: number;
  cancelled: number;
  totalBooths: number;
  totalActivities: number;
  attendanceRate: number;
  averageRating: number;
  ratingCount: number;
  activityStats: Array<{ name: string; count: number }>;
  ratingDistribution: Array<{ stars: number; count: number }>;
}
