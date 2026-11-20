import {
  OrganizerActivityItem,
  OrganizerBoothItem,
  OrganizerEvent,
  OrganizerEventPageResponse,
  OrganizerEventRequest,
  OrganizerEventUpdateRequest,
  OrganizerEventResponse,
  OrganizerEventStatus,
  OrganizerProfile,
  OrganizerReport,
} from '../types/organizer';
import { apiClient } from './apiClient';
import { boothApi } from './boothApi';
import type { EventBooth, PhysicalBooth } from '../types/booth';
import type {
  ActivityCancellationRequestListQuery,
  ActivityListQuery,
  ActivityPageResponse,
  ActivityProposalListQuery,
  ActivityRequestListQuery,
  ApproveActivityProposalResponse,
  CreateOrganizerActivityRequest,
  CreateOrganizerLocationRequest,
  OrganizerActivityCancellationRequestResponse,
  OrganizerActivityChangeRequestResponse,
  OrganizerActivityProposalResponse,
  OrganizerActivityResponse,
  OrganizerActivityRevisionResponse,
  OrganizerLocationResponse,
  UpdateOrganizerActivityRequest,
  UpdateOrganizerLocationRequest,
} from '../types/activity';
import type {
  CreateHeritageRequest,
  HeritagePageResponse,
  HeritageImageUploadResponse,
  OrganizerHeritageDetail,
  OrganizerHeritageListItem,
  OrganizerHeritageQuery,
  UpdateHeritageRequest,
} from '../types/heritage';

export type OrganizerFeedbackStatus = 'NEW' | 'IN_PROGRESS' | 'RESOLVED';
export type OrganizerFeedbackTargetType = 'BOOK_STREET' | 'EVENT';

export interface FeedbackEventBrief {
  eventId: number;
  name: string;
}

export interface FeedbackUserBrief {
  userId: number;
  fullName: string;
}

export interface OrganizerFeedbackListItem {
  feedbackId: number;
  targetType: OrganizerFeedbackTargetType;
  event: FeedbackEventBrief | null;
  messagePreview: string;
  status: OrganizerFeedbackStatus;
  submittedAt: string;
  updatedAt: string;
}

export interface OrganizerFeedbackDetail {
  feedbackId: number;
  targetType: OrganizerFeedbackTargetType;
  event: FeedbackEventBrief | null;
  submitter: FeedbackUserBrief | null;
  guestName: string | null;
  contactEmail: string | null;
  message: string;
  status: OrganizerFeedbackStatus;
  internalNote: string | null;
  lastHandledBy: FeedbackUserBrief | null;
  submittedAt: string;
  updatedAt: string;
  handlingStartedAt: string | null;
  resolvedAt: string | null;
}

export interface OrganizerFeedbackPage {
  content: OrganizerFeedbackListItem[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

export interface OrganizerFeedbackQuery {
  page?: number;
  size?: number;
  sort?: 'submittedAt,desc' | 'submittedAt,asc';
  search?: string;
  senderSearch?: string;
  eventNameSearch?: string;
  targetType?: OrganizerFeedbackTargetType;
  eventId?: number;
  status?: OrganizerFeedbackStatus;
}

export interface OrganizerPartnerApplication {
  id: string;
  eventId: string;
  partnerOrganizationId: string;
  orgName: string;
  partnerOrganizationStatus: 'ACTIVE' | 'INACTIVE';
  categoryCode: string;
  date: string;
  applicationNote: string;
  status: 'pending' | 'approved' | 'rejected' | 'withdrawn';
  reviewNote: string;
  reviewedAt: string;
  withdrawnAt: string;
}

export type OrganizerDashboardTaskType = 'PARTNER_APPLICATION' | 'BOOTH_REQUEST';

export interface OrganizerDashboardTask {
  type: OrganizerDashboardTaskType;
  id: number;
  eventId: number;
  eventName: string;
  subjectName: string;
  submittedAt: string;
}

export interface OrganizerDashboardSummary {
  activeEventCount: number;
  pendingPartnerApplicationCount: number;
  pendingBoothRequestCount: number;
  eventStatusCounts: Record<OrganizerEventStatus, number>;
  partnerApplicationStatusCounts: Record<'PENDING' | 'APPROVED' | 'REJECTED' | 'WITHDRAWN', number>;
  priorityTasks: OrganizerDashboardTask[];
}

export interface OrganizerRegistrationPage<T> {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

export interface OrganizerParticipationPerson {
  userId: number;
  displayName: string;
}

export interface OrganizerEventRegistrationResponse {
  eventRegistrationId: number;
  eventId: number;
  participant: OrganizerParticipationPerson;
  status: 'ACTIVE' | 'LEFT';
  registeredAt: string;
  activatedAt: string;
  leftAt: string | null;
  updatedAt: string;
  seatActiveActivityCount: number;
  activityRegistrationCount: number;
  attendedActivityCount: number;
  noShowActivityCount: number;
}

export interface OrganizerAttendanceSummary {
  attendanceId: number;
  status: 'VALID' | 'VOIDED';
  recordedSource: 'SELF_SCAN' | 'ORGANIZER_CORRECTION';
  attendedAt: string;
  createdAt: string;
  updatedAt: string;
  voidedAt: string | null;
}

export interface OrganizerCertificateSummary {
  certificateId: number;
  certificateCode: string;
  recipientName: string;
  status: 'ISSUED' | 'REVOKED';
  issuedAt: string;
  revokedAt: string | null;
  downloadAvailable: boolean;
}

export type OrganizerParticipationOutcome = 'ACTIVE' | 'CANCELLED' | 'ATTENDED' | 'NO_SHOW';

export interface OrganizerParticipationResponse {
  activityRegistrationId: number;
  eventRegistrationId: number;
  eventId: number;
  activityId: number;
  participant: OrganizerParticipationPerson;
  registrationStatus: 'ACTIVE' | 'CANCELLED' | 'NO_SHOW';
  cancellationSource: 'PARTICIPANT' | 'ACTIVITY' | 'EVENT' | null;
  outcome: OrganizerParticipationOutcome;
  registeredAt: string;
  activatedAt: string;
  cancelledAt: string | null;
  noShowAt: string | null;
  attendance: OrganizerAttendanceSummary | null;
  certificate: OrganizerCertificateSummary | null;
  ratingStatus: 'ACTIVE' | 'INVALIDATED' | null;
  latestAdjustmentAt: string | null;
}

export interface OrganizerAttendanceState {
  registrationStatus: 'ACTIVE' | 'CANCELLED' | 'NO_SHOW';
  cancellationSource: 'PARTICIPANT' | 'ACTIVITY' | 'EVENT' | null;
  attendanceStatus: 'VALID' | 'VOIDED' | null;
  attendedAt: string | null;
  derivedDisplayOutcome: OrganizerParticipationOutcome;
}

export interface OrganizerAttendanceAdjustmentResponse {
  attendanceAdjustmentId: number;
  activityRegistrationId: number;
  actor: OrganizerParticipationPerson;
  idempotencyKey: string;
  previousState: OrganizerAttendanceState;
  newState: OrganizerAttendanceState;
  effectiveAttendedAt: string | null;
  reason: string;
  adjustedAt: string;
}

export interface OrganizerAttendanceCorrectionRequest {
  targetAttendanceStatus: 'VALID' | 'VOIDED';
  effectiveAttendedAt: string | null;
  reason: string;
}

export interface OrganizerAttendanceCorrectionResponse {
  participation: {
    activityRegistrationId: number;
    registrationStatus: 'ACTIVE' | 'CANCELLED' | 'NO_SHOW';
    cancellationSource: 'PARTICIPANT' | 'ACTIVITY' | 'EVENT' | null;
    outcome: OrganizerParticipationOutcome;
  };
  attendance: OrganizerAttendanceSummary;
  adjustment: OrganizerAttendanceAdjustmentResponse;
  certificate: { certificateId: number; status: 'ISSUED' | 'REVOKED' } | null;
  ratingStatus: 'ACTIVE' | 'INVALIDATED' | null;
  idempotentReplay: boolean;
}

interface ProfileResponse {
  id: number;
  fullName: string;
  email: string;
  phone: string | null;
  avatarUrl: string | null;
  emailVerified: boolean;
}

export interface OrganizerProfileUpdateRequest {
  fullName: string;
  phone: string | null;
  avatarUrl: string | null;
}

export interface OrganizerEventRegistrationQuery {
  page?: number;
  size?: number;
  sort?: string;
  status?: 'ACTIVE' | 'LEFT';
  search?: string;
}

export interface OrganizerActivityRegistrationQuery {
  page?: number;
  size?: number;
  sort?: string;
  registrationStatus?: 'ACTIVE' | 'CANCELLED' | 'NO_SHOW';
  outcome?: OrganizerParticipationOutcome;
  attendanceStatus?: 'VALID' | 'VOIDED';
  search?: string;
}

interface OrganizerPartnerApplicationResponse {
  applicationId: number;
  eventId: number;
  partnerOrganizationId: number;
  partnerOrganizationName: string;
  partnerOrganizationStatus: 'ACTIVE' | 'INACTIVE';
  partnerCategoryCode: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'WITHDRAWN';
  applicationNote: string | null;
  reviewNote: string | null;
  submittedAt: string;
  reviewedAt: string | null;
  withdrawnAt: string | null;
}

interface PartnerApplicationPageResponse {
  content: OrganizerPartnerApplicationResponse[];
  number: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

function toOrganizerPartnerApplication(
  application: OrganizerPartnerApplicationResponse,
): OrganizerPartnerApplication {
  const formatDateTime = (value: string | null): string => {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    const datePart = date.toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      timeZone: 'Asia/Ho_Chi_Minh',
    });
    const timePart = date.toLocaleTimeString('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: 'Asia/Ho_Chi_Minh',
    });
    return `${datePart} · ${timePart}`;
  };

  return {
    id: String(application.applicationId),
    eventId: String(application.eventId),
    partnerOrganizationId: String(application.partnerOrganizationId),
    orgName: application.partnerOrganizationName,
    partnerOrganizationStatus: application.partnerOrganizationStatus,
    categoryCode: application.partnerCategoryCode,
    date: formatDateTime(application.submittedAt),
    applicationNote: application.applicationNote || '',
    status: application.status.toLowerCase() as OrganizerPartnerApplication['status'],
    reviewNote: application.reviewNote || '',
    reviewedAt: formatDateTime(application.reviewedAt),
    withdrawnAt: formatDateTime(application.withdrawnAt),
  };
}

function mapEventStatus(status: OrganizerEventStatus): OrganizerEvent['status'] {
  switch (status) {
    case 'DRAFT':
      return 'draft';
    case 'PUBLISHED':
      return 'upcoming';
    case 'ONGOING':
      return 'happening';
    case 'COMPLETED':
      return 'completed';
    case 'CANCELLED':
      return 'cancelled';
  }
}

function getEventStatusLabel(status: OrganizerEventStatus): string {
  switch (status) {
    case 'DRAFT':
      return 'Bản nháp';
    case 'PUBLISHED':
      return 'Đã công bố';
    case 'ONGOING':
      return 'Đang diễn ra';
    case 'COMPLETED':
      return 'Đã kết thúc';
    case 'CANCELLED':
      return 'Đã hủy';
  }
}

function formatEventDateRange(startAt: string, endAt: string): string {
  const options: Intl.DateTimeFormatOptions = {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
    timeZone: 'Asia/Ho_Chi_Minh',
  };

  const start = new Date(startAt).toLocaleString('vi-VN', options);
  const end = new Date(endAt).toLocaleString('vi-VN', options);
  return `${start} - ${end}`;
}

function activityQuery<T extends object>(parameters: T): string {
  const query = new URLSearchParams();
  Object.entries(parameters).forEach(([key, value]) => {
    if (value !== undefined && value !== '') query.set(key, String(value));
  });
  const serialized = query.toString();
  return serialized ? `?${serialized}` : '';
}

function unsupportedOrganizerFeature<T = never>(feature: string): Promise<T> {
  return Promise.reject(new Error(`${feature} chưa có API backend trong phạm vi hiện tại.`));
}

function toOrganizerBoothItem(booth: PhysicalBooth, eventBooth?: EventBooth): OrganizerBoothItem {
  const availability = eventBooth?.availability
    ?? (booth.active ? 'AVAILABLE' : 'UNAVAILABLE');
  const statusByAvailability: Record<EventBooth['availability'], OrganizerBoothItem['status']> = {
    AVAILABLE: 'available',
    ON_HOLD: 'pending',
    ASSIGNED: 'assigned',
    UNAVAILABLE: 'unavailable',
  };
  const labelByAvailability: Record<EventBooth['availability'], string> = {
    AVAILABLE: 'Còn trống',
    ON_HOLD: 'Đang giữ chỗ',
    ASSIGNED: 'Đã phân bổ',
    UNAVAILABLE: 'Chưa mở',
  };

  return {
    id: String(booth.boothId),
    code: booth.code,
    name: booth.name,
    zone: booth.categoryCode || 'Chưa phân khu',
    areaType: booth.categoryCode || 'Chưa phân loại',
    dimensions: `Sức chứa ${booth.maxCapacity}`,
    status: statusByAvailability[availability],
    statusLabelVi: labelByAvailability[availability],
    priceEstimate: eventBooth?.rentalPrice === null || eventBooth?.rentalPrice === undefined
      ? 'Chưa cấu hình'
      : `${eventBooth.rentalPrice.toLocaleString('vi-VN')} đ`,
    notes: booth.description || booth.note || '',
    x: booth.mapX,
    y: booth.mapY,
  };
}

export function toOrganizerEvent(event: OrganizerEventResponse): OrganizerEvent {
  return {
    id: String(event.eventId),
    organizerUserId: event.organizerUserId,
    title: event.name,
    dateRange: formatEventDateRange(event.startAt, event.endAt),
    startDate: event.startAt,
    endDate: event.endAt,
    location: null,
    status: mapEventStatus(event.status),
    apiStatus: event.status,
    statusLabelVi: getEventStatusLabel(event.status),
    imageUrl: event.bannerUrl || '',
    coverImage: event.bannerUrl || undefined,
    description: event.description || '',
    boothOccupancy: null,
    boothsCount: null,
    maxBooths: event.maxBoothsPerPartner,
    activitiesCount: null,
    registrationsCount: null,
    attendanceRate: null,
    averageRating: null,
    boothDeadline: event.boothRequestDeadlineAt || undefined,
    activityDeadline: event.activityProposalDeadlineAt || undefined,
    participantDeadline: event.participantRegistrationDeadlineAt || undefined,
    cancellationCutoff: event.partnerWithdrawalCutoffAt || undefined,
    isPublished: event.status !== 'DRAFT',
    partnerApplicationDeadlineAt: event.partnerApplicationDeadlineAt,
    boothRequestDeadlineAt: event.boothRequestDeadlineAt,
    activityProposalDeadlineAt: event.activityProposalDeadlineAt,
    participantRegistrationDeadlineAt: event.participantRegistrationDeadlineAt,
    partnerWithdrawalCutoffAt: event.partnerWithdrawalCutoffAt,
    boothCancellationCutoffAt: event.boothCancellationCutoffAt,
    activityCancellationCutoffAt: event.activityCancellationCutoffAt,
    boothPaymentWindowMinutes: event.boothPaymentWindowMinutes,
    maxBoothsPerPartner: event.maxBoothsPerPartner,
    maxActivitiesPerPartner: event.maxActivitiesPerPartner,
    bannerUrl: event.bannerUrl,
    cancelledAt: event.cancelledAt ?? null,
    cancellationReason: event.cancellationReason ?? null,
    createdAt: event.createdAt,
    updatedAt: event.updatedAt,
  };
}

export const organizerApi = {
  getDashboardSummary: () => apiClient.get<OrganizerDashboardSummary>('/organizer/dashboard'),
  async getProfile(): Promise<OrganizerProfile> {
    const user = await apiClient.get<ProfileResponse>('/auth/profile');
    return {
      id: String(user.id),
      name: user.fullName,
      role: 'ORGANIZER',
      department: '',
      organization: '',
      email: user.email,
      phone: user.phone || '',
      avatarInitials: user.fullName.split(' ').filter(Boolean).map(part => part[0]).join('').slice(-2).toUpperCase(),
      avatarUrl: user.avatarUrl || undefined,
    };
  },
  async updateProfile(data: OrganizerProfileUpdateRequest): Promise<OrganizerProfile> {
    const user = await apiClient.put<ProfileResponse>('/auth/profile', data);
    return {
      id: String(user.id),
      name: user.fullName,
      role: 'ORGANIZER',
      department: '',
      organization: '',
      email: user.email,
      phone: user.phone || '',
      avatarInitials: user.fullName.split(' ').filter(Boolean).map(part => part[0]).join('').slice(-2).toUpperCase(),
      avatarUrl: user.avatarUrl || undefined,
    };
  },
  async getEvents(page = 0, size = 100, sort = 'createdAt,desc'): Promise<OrganizerEvent[]> {
    const query = new URLSearchParams({
      page: String(page),
      size: String(size),
      sort,
    });
    const response = await apiClient.get<OrganizerEventPageResponse>(`/organizer/events?${query.toString()}`);
    const remaining = response.totalPages > page + 1
      ? await Promise.all(Array.from({ length: response.totalPages - page - 1 }, (_, index) => {
        const nextQuery = new URLSearchParams({ page: String(page + index + 1), size: String(size), sort });
        return apiClient.get<OrganizerEventPageResponse>(`/organizer/events?${nextQuery.toString()}`);
      }))
      : [];
    return [response, ...remaining].flatMap(result => result.content).map(toOrganizerEvent);
  },

  async getEvent(id: string): Promise<OrganizerEvent> {
    const event = await apiClient.get<OrganizerEventResponse>(`/organizer/events/${encodeURIComponent(id)}`);
    return toOrganizerEvent(event);
  },
  async createEvent(data: OrganizerEventRequest): Promise<OrganizerEvent> {
    const event = await apiClient.post<OrganizerEventResponse>('/organizer/events', data);
    return toOrganizerEvent(event);
  },
  async uploadEventBanner(file: File): Promise<string> {
    const formData = new FormData();
    formData.append('file', file);
    const response = await apiClient.postForm<{ url: string }>(
      '/organizer/event-banners',
      formData,
    );
    return response.url;
  },
  async updateEvent(id: string, data: OrganizerEventUpdateRequest): Promise<OrganizerEvent> {
    const event = await apiClient.patch<OrganizerEventResponse>(`/organizer/events/${encodeURIComponent(id)}`, data);
    return toOrganizerEvent(event);
  },
  async publishEvent(id: string): Promise<OrganizerEvent> {
    const event = await apiClient.post<OrganizerEventResponse>(`/organizer/events/${encodeURIComponent(id)}/publish`, {});
    return toOrganizerEvent(event);
  },
  async cancelEvent(id: string, reason: string): Promise<OrganizerEvent> {
    const event = await apiClient.post<OrganizerEventResponse>(
      `/organizer/events/${encodeURIComponent(id)}/cancel`,
      { reason },
    );
    return toOrganizerEvent(event);
  },
  deleteDraftEvent: (id: string) =>
    apiClient.delete<void>(`/organizer/events/${encodeURIComponent(id)}`),
  async getBooths(eventId?: string): Promise<OrganizerBoothItem[]> {
    if (!eventId) {
      const physicalBooths = await boothApi.listAllPhysicalBooths();
      return physicalBooths.map(booth => toOrganizerBoothItem(booth));
    }

    const eventBooths = await boothApi.listEventBoothConfigurations(eventId);
    return eventBooths.map(row => toOrganizerBoothItem(row.booth, row));
  },
  createBooth: (_data: unknown) => unsupportedOrganizerFeature('Quản trị gian hàng kiểu cũ'),
  updateBooth: (_id: string, _data: unknown) => unsupportedOrganizerFeature('Quản trị gian hàng kiểu cũ'),
  deleteBooth: (_id: string) => unsupportedOrganizerFeature('Quản trị gian hàng kiểu cũ'),
  listHeritages(query: OrganizerHeritageQuery = {}) {
    const params = new URLSearchParams({
      page: String(query.page ?? 0),
      size: String(query.size ?? 10),
      sort: query.sort ?? 'updatedAt,desc',
    });
    if (query.search?.trim()) params.set('search', query.search.trim());
    if (query.status) params.set('status', query.status);
    return apiClient.get<HeritagePageResponse<OrganizerHeritageListItem>>(
      `/organizer/heritages?${params.toString()}`,
    );
  },
  getHeritage: (heritageContentId: number) =>
    apiClient.get<OrganizerHeritageDetail>(
      `/organizer/heritages/${encodeURIComponent(heritageContentId)}`,
    ),
  createHeritage: (request: CreateHeritageRequest) =>
    apiClient.post<OrganizerHeritageDetail>('/organizer/heritages', request),
  uploadHeritageImage(file: File) {
    const form = new FormData();
    form.append('file', file);
    return apiClient.postForm<HeritageImageUploadResponse>('/organizer/heritage-images', form);
  },
  deleteUploadedHeritageImage(imageUrl: string) {
    const prefix = '/assets/heritage/uploads/';
    if (!imageUrl.startsWith(prefix)) return Promise.resolve();
    return apiClient.delete<void>(
      `/organizer/heritage-images/${encodeURIComponent(imageUrl.slice(prefix.length))}`,
    );
  },
  updateHeritage: (heritageContentId: number, request: UpdateHeritageRequest) =>
    apiClient.patch<OrganizerHeritageDetail>(
      `/organizer/heritages/${encodeURIComponent(heritageContentId)}`,
      request,
    ),
  publishHeritage: (heritageContentId: number, expectedUpdatedAt: string) =>
    apiClient.post<OrganizerHeritageDetail>(
      `/organizer/heritages/${encodeURIComponent(heritageContentId)}/publish`,
      { expectedUpdatedAt },
    ),
  archiveHeritage: (heritageContentId: number, expectedUpdatedAt: string) =>
    apiClient.post<OrganizerHeritageDetail>(
      `/organizer/heritages/${encodeURIComponent(heritageContentId)}/archive`,
      { expectedUpdatedAt },
    ),
  republishHeritage: (heritageContentId: number, expectedUpdatedAt: string) =>
    apiClient.post<OrganizerHeritageDetail>(
      `/organizer/heritages/${encodeURIComponent(heritageContentId)}/republish`,
      { expectedUpdatedAt },
    ),
  deleteHeritage: (heritageContentId: number, expectedUpdatedAt: string) =>
    apiClient.delete<void>(
      `/organizer/heritages/${encodeURIComponent(heritageContentId)}?expectedUpdatedAt=${encodeURIComponent(expectedUpdatedAt)}`,
    ),
  async getActivities(eventId?: string): Promise<OrganizerActivityItem[]> {
    const response = await apiClient.get<ActivityPageResponse<OrganizerActivityResponse>>(
      `/organizer/activities${activityQuery({ eventId, page: 0, size: 100, sort: 'startAt,asc' })}`,
    );
    return response.content.map(activity => ({
        id: String(activity.activityId),
        eventId: String(activity.eventId),
        title: activity.title || '',
        type: activity.activityType || 'Hoạt động',
        dateStr: activity.startAt ? new Date(activity.startAt).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Asia/Ho_Chi_Minh' }) : '',
        timeStr: activity.startAt && activity.endAt
          ? `${new Date(activity.startAt).toLocaleTimeString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit' })} – ${new Date(activity.endAt).toLocaleTimeString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit' })}`
          : '',
        location: activity.location?.name || '',
        capacity: Number(activity.capacity || 0),
        registeredCount: 0,
        attendedCount: 0,
        partnerName: activity.partnerOrganizationId ? `Đối tác #${activity.partnerOrganizationId}` : 'Đường Sách TP.HCM',
        speaker: '',
        status: activity.status === 'CANCELLED'
          ? 'cancelled'
          : activity.status === 'DRAFT'
            ? 'pending'
            : 'approved',
        statusLabelVi: activity.status === 'DRAFT'
          ? 'Bản nháp'
          : activity.status === 'PUBLISHED'
            ? 'Đã công bố'
            : activity.status === 'ONGOING'
              ? 'Đang diễn ra'
              : activity.status === 'COMPLETED'
                ? 'Đã hoàn thành'
                : 'Đã hủy',
        isPublished: ['PUBLISHED', 'ONGOING', 'COMPLETED'].includes(activity.status),
        thumbnail: activity.imageUrl || '',
        description: activity.description || '',
    }));
  },
  listActivities: (query: ActivityListQuery = {}) =>
    apiClient.get<ActivityPageResponse<OrganizerActivityResponse>>(
      `/organizer/activities${activityQuery(query)}`,
    ),
  getActivity: (activityId: number | string) =>
    apiClient.get<OrganizerActivityResponse>(
      `/organizer/activities/${encodeURIComponent(activityId)}`,
    ),
  publishActivity: (id: number | string) =>
    apiClient.post<OrganizerActivityResponse>(`/organizer/activities/${encodeURIComponent(id)}/publish`),
  createActivity: (data: CreateOrganizerActivityRequest) =>
    apiClient.post<OrganizerActivityResponse>('/organizer/activities', data),
  updateActivity: (id: number | string, data: UpdateOrganizerActivityRequest) =>
    apiClient.patch<OrganizerActivityResponse>(
      `/organizer/activities/${encodeURIComponent(id)}`,
      data,
    ),
  getActivityRevisions: (id: number | string, page = 0, size = 20) =>
    apiClient.get<ActivityPageResponse<OrganizerActivityRevisionResponse>>(
      `/organizer/activities/${encodeURIComponent(id)}/revisions${activityQuery({
        page,
        size,
        sort: 'changedAt,desc',
      })}`,
    ),
  cancelActivity: (id: number | string, reason: string) =>
    apiClient.post<OrganizerActivityResponse>(
      `/organizer/activities/${encodeURIComponent(id)}/cancel`,
      { reason },
    ),
  listEventRegistrations: (eventId: number | string, query: OrganizerEventRegistrationQuery = {}) =>
    apiClient.get<OrganizerRegistrationPage<OrganizerEventRegistrationResponse>>(
      `/organizer/events/${encodeURIComponent(eventId)}/event-registrations${activityQuery({
        page: query.page ?? 0,
        size: query.size ?? 20,
        sort: query.sort ?? 'activatedAt,desc',
        status: query.status,
        search: query.search,
      })}`,
    ),
  listActivityRegistrations: (activityId: number | string, query: OrganizerActivityRegistrationQuery = {}) =>
    apiClient.get<OrganizerRegistrationPage<OrganizerParticipationResponse>>(
      `/organizer/activities/${encodeURIComponent(activityId)}/registrations${activityQuery({
        page: query.page ?? 0,
        size: query.size ?? 20,
        sort: query.sort ?? 'registeredAt,asc',
        registrationStatus: query.registrationStatus,
        outcome: query.outcome,
        attendanceStatus: query.attendanceStatus,
        search: query.search,
      })}`,
    ),
  getActivityRegistration: (registrationId: number | string) =>
    apiClient.get<OrganizerParticipationResponse>(
      `/organizer/activity-registrations/${encodeURIComponent(registrationId)}`,
    ),
  listAttendanceAdjustments: (registrationId: number | string, page = 0, size = 20) =>
    apiClient.get<OrganizerRegistrationPage<OrganizerAttendanceAdjustmentResponse>>(
      `/organizer/activity-registrations/${encodeURIComponent(registrationId)}/attendance-adjustments${activityQuery({
        page,
        size,
        sort: 'adjustedAt,desc',
      })}`,
    ),
  correctAttendance: (
    registrationId: number | string,
    request: OrganizerAttendanceCorrectionRequest,
    idempotencyKey: string,
  ) => apiClient.post<OrganizerAttendanceCorrectionResponse>(
    `/organizer/activity-registrations/${encodeURIComponent(registrationId)}/attendance-adjustments`,
    request,
    { 'Idempotency-Key': idempotencyKey },
  ),
  listActivityLocations: (query: {
    page?: number;
    size?: number;
    sort?: string;
    type?: 'STAGE' | 'WORKSHOP' | 'AREA';
    active?: boolean;
    search?: string;
  } = {}) =>
    apiClient.get<ActivityPageResponse<OrganizerLocationResponse>>(
      `/organizer/locations${activityQuery({ page: 0, size: 100, ...query })}`,
    ),
  createActivityLocation: (data: CreateOrganizerLocationRequest) =>
    apiClient.post<OrganizerLocationResponse>('/organizer/locations', data),
  updateActivityLocation: (locationId: number | string, data: UpdateOrganizerLocationRequest) =>
    apiClient.patch<OrganizerLocationResponse>(
      `/organizer/locations/${encodeURIComponent(locationId)}`,
      data,
    ),
  async getPartnerApplications(eventId: string): Promise<OrganizerPartnerApplication[]> {
    const query = new URLSearchParams({
      page: '0',
      size: '100',
      sort: 'submittedAt,desc',
    });
    const first = await apiClient.get<PartnerApplicationPageResponse>(
      `/organizer/events/${encodeURIComponent(eventId)}/applications?${query.toString()}`,
    );
    const remaining = first.totalPages > 1
      ? await Promise.all(Array.from({ length: first.totalPages - 1 }, (_, index) => {
        const nextQuery = new URLSearchParams({ page: String(index + 1), size: '100', sort: 'submittedAt,desc' });
        return apiClient.get<PartnerApplicationPageResponse>(
          `/organizer/events/${encodeURIComponent(eventId)}/applications?${nextQuery.toString()}`,
        );
      }))
      : [];
    return [first, ...remaining].flatMap(page => page.content).map(toOrganizerPartnerApplication);
  },
  approvePartnerApplication: (id: string, reviewNote = '') =>
    apiClient.post<OrganizerPartnerApplicationResponse>(
      `/organizer/applications/${encodeURIComponent(id)}/approve`,
      { reviewNote },
    ),
  rejectPartnerApplication: (id: string, reviewNote: string) =>
    apiClient.post<OrganizerPartnerApplicationResponse>(
      `/organizer/applications/${encodeURIComponent(id)}/reject`,
      { reviewNote },
    ),
  listActivityProposals: (query: ActivityProposalListQuery = {}) =>
    apiClient.get<ActivityPageResponse<OrganizerActivityProposalResponse>>(
      `/organizer/activity-proposals${activityQuery(query)}`,
    ),
  getActivityProposal: (proposalId: number | string) =>
    apiClient.get<OrganizerActivityProposalResponse>(
      `/organizer/activity-proposals/${encodeURIComponent(proposalId)}`,
    ),
  approveActivityProposal: (proposalId: number | string) =>
    apiClient.post<ApproveActivityProposalResponse>(
      `/organizer/activity-proposals/${encodeURIComponent(proposalId)}/approve`,
    ),
  rejectActivityProposal: (proposalId: number | string, reviewNote: string) =>
    apiClient.post<OrganizerActivityProposalResponse>(
      `/organizer/activity-proposals/${encodeURIComponent(proposalId)}/reject`,
      { reviewNote },
    ),
  requestActivityProposalChanges: (proposalId: number | string, reviewNote: string) =>
    apiClient.post<OrganizerActivityProposalResponse>(
      `/organizer/activity-proposals/${encodeURIComponent(proposalId)}/request-changes`,
      { reviewNote },
    ),
  listActivityChangeRequests: (query: ActivityRequestListQuery = {}) =>
    apiClient.get<ActivityPageResponse<OrganizerActivityChangeRequestResponse>>(
      `/organizer/activity-change-requests${activityQuery(query)}`,
    ),
  getActivityChangeRequest: (requestId: number | string) =>
    apiClient.get<OrganizerActivityChangeRequestResponse>(
      `/organizer/activity-change-requests/${encodeURIComponent(requestId)}`,
    ),
  approveActivityChangeRequest: (requestId: number | string) =>
    apiClient.post<OrganizerActivityChangeRequestResponse>(
      `/organizer/activity-change-requests/${encodeURIComponent(requestId)}/approve`,
    ),
  rejectActivityChangeRequest: (requestId: number | string, reviewNote: string) =>
    apiClient.post<OrganizerActivityChangeRequestResponse>(
      `/organizer/activity-change-requests/${encodeURIComponent(requestId)}/reject`,
      { reviewNote },
    ),
  listActivityCancellationRequests: (query: ActivityCancellationRequestListQuery = {}) =>
    apiClient.get<ActivityPageResponse<OrganizerActivityCancellationRequestResponse>>(
      `/organizer/activity-cancellation-requests${activityQuery(query)}`,
    ),
  getActivityCancellationRequest: (requestId: number | string) =>
    apiClient.get<OrganizerActivityCancellationRequestResponse>(
      `/organizer/activity-cancellation-requests/${encodeURIComponent(requestId)}`,
    ),
  approveActivityCancellationRequest: (requestId: number | string) =>
    apiClient.post<OrganizerActivityCancellationRequestResponse>(
      `/organizer/activity-cancellation-requests/${encodeURIComponent(requestId)}/approve`,
    ),
  rejectActivityCancellationRequest: (requestId: number | string, reviewNote: string) =>
    apiClient.post<OrganizerActivityCancellationRequestResponse>(
      `/organizer/activity-cancellation-requests/${encodeURIComponent(requestId)}/reject`,
      { reviewNote },
    ),
  async getReport(eventId: string): Promise<OrganizerReport> {
    return unsupportedOrganizerFeature(`Báo cáo sự kiện ${eventId}`);
  },

  listFeedbacks: (query: OrganizerFeedbackQuery = {}) =>
    apiClient.get<OrganizerFeedbackPage>(
      `/organizer/feedbacks${activityQuery({
        page: query.page ?? 0,
        size: query.size ?? 20,
        sort: query.sort ?? 'submittedAt,desc',
        search: query.search,
        senderSearch: query.senderSearch,
        eventNameSearch: query.eventNameSearch,
        targetType: query.targetType,
        eventId: query.eventId,
        status: query.status,
      })}`,
    ),
  getFeedback: (feedbackId: number | string) =>
    apiClient.get<OrganizerFeedbackDetail>(
      `/organizer/feedbacks/${encodeURIComponent(feedbackId)}`,
    ),
  startHandlingFeedback: (feedbackId: number | string) =>
    apiClient.post<OrganizerFeedbackDetail>(
      `/organizer/feedbacks/${encodeURIComponent(feedbackId)}/start-handling`,
    ),
  resolveFeedback: (feedbackId: number | string, internalNote: string) =>
    apiClient.post<OrganizerFeedbackDetail>(
      `/organizer/feedbacks/${encodeURIComponent(feedbackId)}/resolve`,
      { internalNote },
    ),
  reopenFeedback: (feedbackId: number | string) =>
    apiClient.post<OrganizerFeedbackDetail>(
      `/organizer/feedbacks/${encodeURIComponent(feedbackId)}/reopen`,
    ),
};

