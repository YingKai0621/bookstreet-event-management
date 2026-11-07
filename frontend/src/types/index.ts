export type Language = 'vi' | 'en';

export interface ImageAsset {
  url: string;
  alt: string;
  source: string;
  license: string;
  isIllustrationOnly: boolean;
}

export interface Booth {
  id: string;
  code: string;
  name: string;
  nameEn: string;
  publisher: string;
  category: 'literature' | 'history' | 'children' | 'lifestyle' | 'cafe' | 'other';
  categoryLabelVi: string;
  categoryLabelEn: string;
  tagline: string;
  taglineEn: string;
  description: string;
  descriptionEn: string;
  featuredBooks: string[];
  featuredBooksEn: string[];
  mapLocationId: string;
  openHours: string;
  image: ImageAsset;
  eventId?: string;
  rentalPrice?: number | null;
  availability?: 'AVAILABLE' | 'ON_HOLD' | 'ASSIGNED' | 'UNAVAILABLE';
  maxCapacity?: number;
  isModelData?: boolean;
}

export type EventPriority = 'high' | 'medium' | 'regular';
export type ProposalStatus = 'pending' | 'approved' | 'need_revision' | 'rejected';

export interface DeviceRequirement {
  name: string;
  quantity: number;
}

export interface EventProposal {
  id: string;
  boothId: string;
  boothName: string;
  title: string;
  titleEn?: string;
  dateStr: string; // e.g. "2026-09-22" or "22/09/2026"
  dayOfWeek?: string; // e.g. "Thứ 3", "Thứ 5", "Thứ 7"
  timeStr: string; // e.g. "09:00 - 11:30"
  location: string;
  priorityLevel: EventPriority;
  devices: DeviceRequirement[];
  description: string;
  speaker: string;
  contactPerson?: string;
  contactPhone?: string;
  status: ProposalStatus;
  submittedAt: string;
  managementNotes?: string;
  publishedEventId?: string;
}

export interface EventItem {
  id: string;
  title: string;
  titleEn: string;
  startAt?: string;
  endAt?: string;
  type: 'talkshow' | 'launch' | 'workshop' | 'exhibition';
  typeLabelVi: string;
  typeLabelEn: string;
  dateStr: string;
  dayOfWeek?: string;
  timeStr: string;
  scheduleStr?: string;
  registrationDeadlineAt?: string | null;
  location: string;
  locationEn: string;
  priorityLevel: EventPriority;
  summary: string;
  summaryEn: string;
  speaker: string;
  image: ImageAsset;
  boothId?: string;
  boothName?: string;
  devices?: DeviceRequirement[];
  status?: 'approved' | 'happening' | 'upcoming';
  proposalId?: string;
  isModelData?: boolean;
}

export interface MapHotspot {
  id: string;
  code: string;
  title: string;
  titleEn: string;
  category: 'booth' | 'stage' | 'facility' | 'heritage';
  x: number;
  y: number;
  shortDesc: string;
  shortDescEn: string;
  boothId?: string;
  iconType: string;
  area?: string;
  dimensions?: string;
  phone?: string;
  hours?: string;
  features?: string[];
  featuresEn?: string[];
  isModelData?: boolean;
}

export interface HeritageItem {
  id: string;
  code: string;
  index: number;
  title: string;
  titleEn: string;
  location: string;
  locationEn: string;
  historicalPeriod: string;
  historicalPeriodEn: string;
  description: string;
  descriptionEn: string;
  highlights: string[];
  highlightsEn: string[];
  image: ImageAsset;
  isSampleModel?: boolean;
}

export type HeritagePublishStatus = 'published' | 'draft' | 'hidden';

export interface ExtendedHeritageProfile {
  id: string; // 'ds-01'
  code: string; // 'DS-01'
  name: string;
  nameEn: string;
  province: string;
  provinceEn: string;
  unescoRecognition?: string;
  category: string;
  categoryEn: string;
  period: string;
  periodEn: string;
  address: string;
  addressEn: string;
  briefDesc: string;
  briefDescEn: string;
  highlights: string[];
  highlightsEn: string[];
  story: string;
  storyEn: string;
  referenceSource: string;
  updatedDate: string;
  status: HeritagePublishStatus;
  qrStatus: 'active' | 'generating' | 'inactive';
  viewCount?: number;
  qrScanCount?: number;
  image: {
    url: string;
    alt: string;
    source: string;
    license: string;
  };
  mapCoordinates: {
    x: number;
    y: number;
    areaName: string;
  };
}

export interface ActivityAuditItem {
  id: string;
  actor: string;
  actorRole: string;
  action: 'create_event' | 'approve_proposal' | 'reject_proposal' | 'request_revision' | 'create_heritage' | 'update_heritage' | 'delete_heritage' | 'create_booth' | 'update_booth' | 'delete_booth' | 'resolve_feedback' | 'generate_qr';
  targetType: 'proposal' | 'event' | 'heritage' | 'booth' | 'feedback';
  targetTitle: string;
  timestamp: string;
  details?: string;
}

/* ==========================================================================
   PARTICIPANT FLOW TYPES (SKETCH-ALIGNED)
   ========================================================================== */

export interface ParticipantProfile {
  emailVerified?: boolean;
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: string;
  avatar?: string;
  dob?: string;
  interests?: string;
  emailNotifications: boolean;
  points: number;
  certificatesCount?: number;
  badgesCount?: number;
}

export interface ParticipantEvent {
  registrationDeadlineAt?: string | null;
  id: string;
  title: string;
  dateRange: string;
  location: string;
  imageUrl: string;
  status: 'ongoing' | 'ended' | 'left';
  shortDesc: string;
  activitiesCount: number;
  isJoined: boolean;
  canLeave?: boolean;
  booths?: Array<{ id: string; code: string; name: string; organizationName: string; imageUrl?: string }>;
}

export interface ParticipantActivity {
  id: string;
  activityId?: string;
  registrationId?: string;
  eventId: string;
  eventName: string;
  title: string;
  category: 'Talkshow' | 'Workshop' | 'Game' | 'Exhibition' | string;
  venue: string;
  date: string;
  time: string;
  imageUrl: string;
  capacity: number;
  registeredCount: number;
  status: 'available' | 'full' | 'registered' | 'attended' | 'cancelled' | 'no_show';
  registrationStatus?: 'ACTIVE' | 'CANCELLED' | 'NO_SHOW';
  outcome?: string;
  attendanceStatus?: string | null;
  activityStatus?: string;
  startAt?: string;
  endAt?: string;
  description?: string;
  speaker?: {
    name: string;
    title: string;
    avatar?: string;
  };
  extraNotes?: string[];
  registeredAt?: string;
  rating?: ParticipantActivityRating | null;
}

export interface ParticipantActivityRating {
  id: string;
  activityId: string;
  score: number;
  comment: string;
  status: 'ACTIVE' | 'INVALIDATED';
  createdAt: string;
  updatedAt: string;
  invalidatedAt?: string;
}

export interface ParticipantBadge {
  id: string;
  code?: string;
  title: string;
  iconName: string;
  earnedDate: string;
  isLocked?: boolean;
}

export interface ParticipantCertificate {
  id: string;
  title: string;
  recipientName: string;
  status: 'ISSUED' | 'REVOKED';
  downloadAvailable: boolean;
  activityId?: string;
  activityTitle?: string;
  activityStartAt?: string;
  activityEndAt?: string;
  eventId?: string;
  eventTitle?: string;
  issueDate: string;
  revokedDate?: string;
  certificateCode: string;
}

/* ==========================================================================
   PARTNER / EXHIBITOR FLOW TYPES (SKETCH-ALIGNED)
   ========================================================================== */

export interface PartnerOrganization {
  id: string;
  name: string;
  shortDesc: string;
  categoryCode: string;
  logoUrl?: string;
  representativeName: string;
  email: string;
  phone: string;
  address: string;
  website: string;
  categories: string[];
  status: 'ACTIVE' | 'INACTIVE' | '';
  isVerified?: boolean;
}

export interface PartnerEventApplication {
  id: string;
  eventId: string;
  eventTitle: string;
  dateRange: string;
  startAt?: string;
  endAt?: string;
  eventStatus?: 'PUBLISHED' | 'ONGOING' | 'COMPLETED' | 'CANCELLED';
  eventAvailable?: boolean;
  location: string;
  imageUrl: string;
  status: 'pending' | 'approved' | 'rejected' | 'withdrawn';
  applicationNote: string;
  reviewNote: string;
  submittedAt: string;
  reviewedAt: string;
  withdrawnAt: string;
  organizationName: string;
  shortDesc: string;
  logoUrl?: string;
  representativeName: string;
  email: string;
  phone: string;
}

export interface PartnerBooth {
  id: string;
  code: string; // 'A05'
  name: string;
  zone: 'Khu A' | 'Khu B' | 'Khu C';
  areaName: string; // 'Sách thiếu nhi'
  dimensions: string; // '3m x 3m'
  status: 'available' | 'selected' | 'assigned' | 'on_hold' | 'unavailable';
  assignedOrgId?: string;
  assignedOrgName?: string;
  imageUrl: string;
  description: string;
  categories: string[];
  relatedEventId: string;
  relatedEventTitle: string;
}

export interface PartnerTodoItem {
  id: string;
  title: string;
  deadline: string;
  status: 'need_action' | 'pending_review' | 'not_due';
  statusLabelVi: string;
  link: string;
}

export interface PartnerNotification {
  id: string;
  title: string;
  time: string;
  type: 'activity' | 'booth' | 'event' | 'reminder' | 'system';
  isRead: boolean;
  link?: string;
}

export interface PartnerReportStats {
  eventId: string;
  eventName: string;
  totalParticipants: number;
  totalActivities: number;
  attendanceRate: number; // e.g. 92%
  averageRating: number; // e.g. 4.8
  activityStats: { name: string; count: number }[];
  ratingDistribution: { stars: string; percent: number }[];
}

export * from './admin';
export * from './booth';
export * from './heritage';
export * from './map';
export * from './organizer';
export * from './payment';


