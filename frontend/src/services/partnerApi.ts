import { PartnerEventApplication, PartnerOrganization, PartnerReportStats } from '../types';
import type {
  ActivityCancellationRequestListQuery,
  ActivityListQuery,
  ActivityPageResponse,
  ActivityProposalListQuery,
  ActivityRequestListQuery,
  CreatePartnerActivityChangeRequest,
  CreatePartnerActivityProposalRequest,
  OrganizerLocationResponse,
  PartnerActivityCancellationRequestResponse,
  PartnerActivityChangeRequestResponse,
  PartnerActivityProposalResponse,
  PartnerActivityResponse,
  PartnerActivityRevisionResponse,
  UpdatePartnerActivityProposalRequest,
} from '../types/activity';
import { ApiError, apiClient } from './apiClient';

interface PageResponse<T> {
  content: T[];
  page?: number;
  number?: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

interface PartnerOrganizationResponse {
  partnerOrganizationId: number;
  name: string;
  description: string | null;
  categoryCode: string;
  logoUrl: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  address: string | null;
  status: 'ACTIVE' | 'INACTIVE';
}

interface PartnerApplicationResponse {
  applicationId: number;
  eventId: number;
  partnerOrganizationId: number;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'WITHDRAWN';
  applicationNote: string | null;
  reviewNote: string | null;
  submittedAt: string;
  reviewedAt: string | null;
  withdrawnAt: string | null;
}

interface PublicEventResponse {
  eventId: number;
  name: string;
  description: string | null;
  startAt: string;
  endAt: string;
  partnerApplicationDeadlineAt: string | null;
  bannerUrl: string | null;
  status: 'PUBLISHED' | 'ONGOING' | 'COMPLETED' | 'CANCELLED';
}

export interface PartnerAvailableEvent {
  id: string;
  name: string;
  description: string;
  startAt: string;
  endAt: string;
  partnerApplicationDeadlineAt: string | null;
  bannerUrl: string;
  status: PublicEventResponse['status'];
  acceptingApplications: boolean;
}

const formatDateTime = (value: unknown) => value ? new Date(String(value)).toLocaleString('vi-VN', {
  day: '2-digit', month: '2-digit', year: 'numeric',
  hour: '2-digit', minute: '2-digit',
  timeZone: 'Asia/Ho_Chi_Minh',
}) : '';

function normalizeOptionalText(value: string | null): string {
  if (value === null) return '';

  const normalizedValue = value.trim();
  if (normalizedValue.toLowerCase() === 'null') return '';
  if (normalizedValue.toLowerCase() === 'undefined') return '';
  return normalizedValue;
}

function toPartnerOrganization(organization: PartnerOrganizationResponse): PartnerOrganization {
  return {
    id: String(organization.partnerOrganizationId),
    name: organization.name,
    shortDesc: normalizeOptionalText(organization.description),
    categoryCode: organization.categoryCode,
    logoUrl: normalizeOptionalText(organization.logoUrl) || undefined,
    representativeName: '',
    email: normalizeOptionalText(organization.contactEmail),
    phone: normalizeOptionalText(organization.contactPhone),
    address: normalizeOptionalText(organization.address),
    website: '',
    categories: [organization.categoryCode],
    status: organization.status,
    isVerified: organization.status === 'ACTIVE',
  };
}

function toAvailableEvent(event: PublicEventResponse): PartnerAvailableEvent {
  const deadline = event.partnerApplicationDeadlineAt
    ? new Date(event.partnerApplicationDeadlineAt).getTime()
    : null;

  return {
    id: String(event.eventId),
    name: event.name,
    description: event.description || '',
    startAt: event.startAt,
    endAt: event.endAt,
    partnerApplicationDeadlineAt: event.partnerApplicationDeadlineAt,
    bannerUrl: event.bannerUrl || '',
    status: event.status,
    acceptingApplications: deadline !== null && deadline > Date.now(),
  };
}

function activityQuery(query: object): string {
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]: [string, unknown]) => {
    if (value !== undefined && value !== '') params.set(key, String(value));
  });
  const serialized = params.toString();
  return serialized ? `?${serialized}` : '';
}

async function loadPublishedEvents(): Promise<PartnerAvailableEvent[]> {
  const query = new URLSearchParams({ page: '0', size: '100', sort: 'startAt,asc' });
  const first = await apiClient.get<PageResponse<PublicEventResponse>>(`/events?${query.toString()}`);
  const remaining = first.totalPages > 1
    ? await Promise.all(Array.from({ length: first.totalPages - 1 }, (_, index) => {
      const nextQuery = new URLSearchParams({ page: String(index + 1), size: '100', sort: 'startAt,asc' });
      return apiClient.get<PageResponse<PublicEventResponse>>(`/events?${nextQuery.toString()}`);
    }))
    : [];
  return [first, ...remaining].flatMap(page => page.content).map(toAvailableEvent);
}

export const partnerApi = {
  async getProfile(): Promise<PartnerOrganization | null> {
    try {
      const organization = await apiClient.get<PartnerOrganizationResponse>('/partner/organization');
      return toPartnerOrganization(organization);
    } catch (error) {
      if (error instanceof ApiError && error.code === 'PARTNER_ORGANIZATION_NOT_FOUND') {
        return null;
      }
      throw error;
    }
  },
  async updateProfile(data: Partial<PartnerOrganization>): Promise<PartnerOrganization> {
    const organization = await apiClient.put<PartnerOrganizationResponse>('/partner/organization', {
      name: data.name,
      description: data.shortDesc || null,
      categoryCode: data.categoryCode || data.categories?.[0] || 'OTHER',
      logoUrl: data.logoUrl || null,
      contactEmail: data.email || null,
      contactPhone: data.phone || null,
      address: data.address || null,
    });
    return toPartnerOrganization(organization);
  },
  async getPublishedEvents(): Promise<PartnerAvailableEvent[]> {
    return loadPublishedEvents();
  },
  async getApplications(options: { organization?: Promise<PartnerOrganization | null> } = {}): Promise<PartnerEventApplication[]> {
    const query = new URLSearchParams({ page: '0', size: '100', sort: 'submittedAt,desc' });
    const first = await apiClient.get<PageResponse<PartnerApplicationResponse>>(`/partner/applications?${query.toString()}`);
    const remaining = first.totalPages > 1
      ? await Promise.all(Array.from({ length: first.totalPages - 1 }, (_, index) => {
        const nextQuery = new URLSearchParams({ page: String(index + 1), size: '100', sort: 'submittedAt,desc' });
        return apiClient.get<PageResponse<PartnerApplicationResponse>>(`/partner/applications?${nextQuery.toString()}`);
      }))
      : [];
    const applications = [first, ...remaining].flatMap(page => page.content);
    const eventIds = [...new Set(applications.map(application => application.eventId))];
    const [metadataResults, eventDetailResults] = await Promise.all([
      Promise.allSettled([
        loadPublishedEvents(),
        options.organization ?? partnerApi.getProfile(),
      ]),
      Promise.allSettled(eventIds.map(eventId =>
        apiClient.get<PublicEventResponse>(`/events/${encodeURIComponent(eventId)}`),
      )),
    ]);
    const [eventsResult, organizationResult] = metadataResults;
    const events = eventsResult.status === 'fulfilled' ? eventsResult.value : [];
    const organization = organizationResult.status === 'fulfilled' ? organizationResult.value : null;
    const eventById = new Map(events.map(event => [event.id, event]));

    eventDetailResults.forEach(result => {
      if (result.status !== 'fulfilled') return;
      const event = toAvailableEvent(result.value);
      eventById.set(event.id, event);
    });

    return applications.map(application => {
      const event = eventById.get(String(application.eventId));
      return {
        id: String(application.applicationId),
        eventId: String(application.eventId),
        eventTitle: event?.name || `Sự kiện #${application.eventId}`,
        dateRange: event ? `${formatDateTime(event.startAt)} - ${formatDateTime(event.endAt)}` : '',
        startAt: event?.startAt,
        endAt: event?.endAt,
        eventStatus: event?.status,
        eventAvailable: Boolean(event),
        location: '',
        imageUrl: event?.bannerUrl || '',
        status: application.status.toLowerCase() as PartnerEventApplication['status'],
        applicationNote: application.applicationNote || '',
        reviewNote: application.reviewNote || '',
        submittedAt: application.submittedAt,
        reviewedAt: application.reviewedAt || '',
        withdrawnAt: application.withdrawnAt || '',
        organizationName: organization?.name || '',
        shortDesc: organization?.shortDesc || '',
        representativeName: organization?.representativeName || '',
        email: organization?.email || '',
        phone: organization?.phone || '',
      };
    });
  },
  getActivityLocations: (eventId: string | number, startAt?: string, endAt?: string) =>
    apiClient.get<OrganizerLocationResponse[]>(
      `/partner/events/${encodeURIComponent(eventId)}/activity-locations${activityQuery({ startAt, endAt })}`,
    ),
  getActivityProposals: (query: ActivityProposalListQuery = {}) =>
    apiClient.get<ActivityPageResponse<PartnerActivityProposalResponse>>(
      `/partner/activity-proposals${activityQuery(query)}`,
    ),
  getActivityProposal: (proposalId: string | number) =>
    apiClient.get<PartnerActivityProposalResponse>(
      `/partner/activity-proposals/${encodeURIComponent(proposalId)}`,
    ),
  submitApplication: (eventId: string, applicationNote: string) =>
    apiClient.post<PartnerApplicationResponse>(`/events/${encodeURIComponent(eventId)}/applications`, { applicationNote }),
  withdrawApplication: (applicationId: string) =>
    apiClient.post<PartnerApplicationResponse>(`/partner/applications/${encodeURIComponent(applicationId)}/withdraw`, {}),
  submitActivityProposal: (data: CreatePartnerActivityProposalRequest) =>
    apiClient.post<PartnerActivityProposalResponse>('/partner/activity-proposals', data),
  updateActivityProposal: (proposalId: string | number, data: UpdatePartnerActivityProposalRequest) =>
    apiClient.patch<PartnerActivityProposalResponse>(
      `/partner/activity-proposals/${encodeURIComponent(proposalId)}`,
      data,
    ),
  resubmitActivityProposal: (proposalId: string | number) =>
    apiClient.post<PartnerActivityProposalResponse>(
      `/partner/activity-proposals/${encodeURIComponent(proposalId)}/resubmit`,
    ),
  withdrawActivityProposal: (proposalId: string | number) =>
    apiClient.post<PartnerActivityProposalResponse>(
      `/partner/activity-proposals/${encodeURIComponent(proposalId)}/withdraw`,
    ),
  getActivities: (query: ActivityListQuery = {}) =>
    apiClient.get<ActivityPageResponse<PartnerActivityResponse>>(
      `/partner/activities${activityQuery(query)}`,
    ),
  getActivity: (activityId: string | number) =>
    apiClient.get<PartnerActivityResponse>(`/partner/activities/${encodeURIComponent(activityId)}`),
  getActivityRevisions: (activityId: string | number, page = 0, size = 20) =>
    apiClient.get<ActivityPageResponse<PartnerActivityRevisionResponse>>(
      `/partner/activities/${encodeURIComponent(activityId)}/revisions${activityQuery({ page, size, sort: 'changedAt,desc' })}`,
    ),
  submitActivityChangeRequest: (activityId: string | number, data: CreatePartnerActivityChangeRequest) =>
    apiClient.post<PartnerActivityChangeRequestResponse>(
      `/partner/activities/${encodeURIComponent(activityId)}/change-requests`,
      data,
    ),
  getActivityChangeRequests: (query: ActivityRequestListQuery = {}) =>
    apiClient.get<ActivityPageResponse<PartnerActivityChangeRequestResponse>>(
      `/partner/activity-change-requests${activityQuery(query)}`,
    ),
  getActivityChangeRequest: (requestId: string | number) =>
    apiClient.get<PartnerActivityChangeRequestResponse>(
      `/partner/activity-change-requests/${encodeURIComponent(requestId)}`,
    ),
  withdrawActivityChangeRequest: (requestId: string | number) =>
    apiClient.post<PartnerActivityChangeRequestResponse>(
      `/partner/activity-change-requests/${encodeURIComponent(requestId)}/withdraw`,
    ),
  submitActivityCancellationRequest: (activityId: string | number, reason: string) =>
    apiClient.post<PartnerActivityCancellationRequestResponse>(
      `/partner/activities/${encodeURIComponent(activityId)}/cancellation-requests`,
      { reason },
    ),
  getActivityCancellationRequests: (query: ActivityCancellationRequestListQuery = {}) =>
    apiClient.get<ActivityPageResponse<PartnerActivityCancellationRequestResponse>>(
      `/partner/activity-cancellation-requests${activityQuery(query)}`,
    ),
  getActivityCancellationRequest: (requestId: string | number) =>
    apiClient.get<PartnerActivityCancellationRequestResponse>(
      `/partner/activity-cancellation-requests/${encodeURIComponent(requestId)}`,
    ),
  withdrawActivityCancellationRequest: (requestId: string | number) =>
    apiClient.post<PartnerActivityCancellationRequestResponse>(
      `/partner/activity-cancellation-requests/${encodeURIComponent(requestId)}/withdraw`,
    ),
  getReports: async (_eventId?: string): Promise<PartnerReportStats> =>
    Promise.reject(new Error('Báo cáo đối tác chưa có API backend trong phạm vi hiện tại.')),
  changePassword: async (_currentPassword: string, _newPassword: string): Promise<void> =>
    Promise.reject(new Error('Đổi mật khẩu chưa có API backend trong phạm vi hiện tại.')),
};
