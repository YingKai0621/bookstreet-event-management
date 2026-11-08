export type ActivityStatus =
  | 'DRAFT'
  | 'PUBLISHED'
  | 'ONGOING'
  | 'COMPLETED'
  | 'CANCELLED';

export type ActivityProposalStatus =
  | 'PENDING'
  | 'NEED_CHANGES'
  | 'APPROVED'
  | 'REJECTED'
  | 'WITHDRAWN'
  | 'CANCELLED';

export type ActivityRequestStatus =
  | 'PENDING'
  | 'APPROVED'
  | 'REJECTED'
  | 'WITHDRAWN'
  | 'CANCELLED';

export type ActivityLocationType = 'BOOTH' | 'STAGE' | 'WORKSHOP' | 'AREA';

export interface ActivityPageResponse<T> {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

export interface ActivityLocationResponse {
  locationId: number;
  code: string;
  name: string;
  locationType: ActivityLocationType;
  maxCapacity: number;
  active: boolean;
}

export interface OrganizerLocationResponse extends ActivityLocationResponse {
  description: string | null;
  mapX: number | null;
  mapY: number | null;
  boothAssignmentId: number | null;
  eligible: boolean;
  ineligibleReason: string | null;
}

export interface CreateOrganizerLocationRequest {
  code: string;
  name: string;
  locationType: Exclude<ActivityLocationType, 'BOOTH'>;
  description: string | null;
  maxCapacity: number;
  mapX: number | null;
  mapY: number | null;
}

export interface UpdateOrganizerLocationRequest {
  code?: string;
  name?: string;
  description?: string | null;
  maxCapacity?: number;
  mapX?: number | null;
  mapY?: number | null;
  active?: boolean;
}

export interface CreateOrganizerActivityRequest {
  eventId: number;
  locationId: number;
  title: string;
  description: string | null;
  activityType: string;
  startAt: string;
  endAt: string;
  capacity: number;
  imageUrl: string | null;
  registrationRequired: boolean;
  registrationDeadlineAt: string | null;
  certificateEnabled: boolean;
  attendanceEarlyScanMinutes?: number;
}

export interface UpdateOrganizerActivityRequest {
  title?: string;
  description?: string | null;
  activityType?: string;
  locationId?: number;
  startAt?: string;
  endAt?: string;
  capacity?: number;
  imageUrl?: string | null;
  registrationRequired?: boolean;
  registrationDeadlineAt?: string | null;
  certificateEnabled?: boolean;
  attendanceEarlyScanMinutes?: number;
  changeReason?: string;
}

export interface OrganizerActivityResponse {
  activityId: number;
  eventId: number;
  sourceProposalId: number | null;
  partnerOrganizationId: number | null;
  location: ActivityLocationResponse;
  title: string;
  description: string | null;
  activityType: string;
  startAt: string;
  endAt: string;
  capacity: number;
  imageUrl: string | null;
  registrationRequired: boolean;
  registrationDeadlineAt: string | null;
  certificateEnabled: boolean;
  attendanceEarlyScanMinutes: number;
  attendanceQrAvailable: boolean;
  attendanceQrToken: string | null;
  status: ActivityStatus;
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  cancellationReason: string | null;
  cancellationSource: 'ORGANIZER' | 'PARTNER_REQUEST' | 'EVENT_CANCELLATION' | 'SYSTEM' | null;
}

export interface OrganizerActivityRevisionResponse {
  activityRevisionId: number;
  activityId: number;
  actorUserId: number;
  sourceRequestId: number | null;
  revisionSource: 'ORGANIZER_DIRECT' | 'PARTNER_REQUEST' | 'EVENT_CANCELLATION' | 'SYSTEM';
  changeReason: string | null;
  oldSnapshot: Record<string, unknown>;
  newSnapshot: Record<string, unknown>;
  changedAt: string;
}

export interface OrganizerActivityProposalResponse {
  activityProposalId: number;
  eventId: number;
  eventName: string;
  partnerOrganizationId: number;
  partnerOrganizationName: string;
  partnerOrganizationStatus: 'ACTIVE' | 'INACTIVE';
  location: ActivityLocationResponse;
  title: string;
  description: string | null;
  activityType: string;
  proposedStartAt: string;
  proposedEndAt: string;
  capacity: number;
  status: ActivityProposalStatus;
  reviewNote: string | null;
  submittedAt: string;
  updatedAt: string;
  reviewedAt: string | null;
  withdrawnAt: string | null;
  cancelledAt: string | null;
  activityId: number | null;
}

export type PartnerActivityProposalResponse = OrganizerActivityProposalResponse;
export type PartnerActivityResponse = OrganizerActivityResponse;

export interface PartnerActivityRevisionResponse {
  activityRevisionId: number;
  activityId: number;
  sourceRequestId: number | null;
  revisionSource: 'ORGANIZER_DIRECT' | 'PARTNER_REQUEST' | 'EVENT_CANCELLATION' | 'SYSTEM';
  changeReason: string | null;
  oldSnapshot: Record<string, unknown>;
  newSnapshot: Record<string, unknown>;
  changedAt: string;
}

export interface PartnerActivityChangeRequestResponse {
  activityChangeRequestId: number;
  activityId: number;
  status: ActivityRequestStatus;
  reason: string;
  requestedTitle: string | null;
  requestedDescriptionIncluded: boolean;
  requestedDescription: string | null;
  requestedActivityType: string | null;
  requestedLocationId: number | null;
  requestedStartAt: string | null;
  requestedEndAt: string | null;
  requestedCapacity: number | null;
  requestedImageUrlIncluded: boolean;
  requestedImageUrl: string | null;
  reviewNote: string | null;
  submittedAt: string;
  handledAt: string | null;
  withdrawnAt: string | null;
  cancelledAt: string | null;
}

export interface PartnerActivityCancellationRequestResponse {
  activityCancellationRequestId: number;
  activityId: number;
  status: ActivityRequestStatus;
  reason: string;
  late: boolean;
  reviewNote: string | null;
  submittedAt: string;
  handledAt: string | null;
  withdrawnAt: string | null;
  cancelledAt: string | null;
}

export interface CreatePartnerActivityProposalRequest {
  eventId: number;
  locationId: number;
  title: string;
  description: string | null;
  activityType: string;
  proposedStartAt: string;
  proposedEndAt: string;
  capacity: number;
}

export type UpdatePartnerActivityProposalRequest = Partial<
  Omit<CreatePartnerActivityProposalRequest, 'eventId'>
>;

export interface CreatePartnerActivityChangeRequest {
  reason: string;
  requestedLocationId?: number;
  requestedTitle?: string;
  requestedDescription?: string | null;
  requestedActivityType?: string;
  requestedStartAt?: string;
  requestedEndAt?: string;
  requestedCapacity?: number;
  requestedImageUrl?: string | null;
}

export interface ApproveActivityProposalResponse {
  proposal: OrganizerActivityProposalResponse;
  activity: OrganizerActivityResponse;
}

export interface OrganizerActivityRequestActivityResponse {
  activityId: number;
  eventId: number;
  eventName: string;
  partnerOrganizationId: number;
  partnerOrganizationName: string;
  partnerOrganizationStatus: 'ACTIVE' | 'INACTIVE';
  location: ActivityLocationResponse;
  title: string;
  description: string | null;
  activityType: string;
  startAt: string;
  endAt: string;
  capacity: number;
  imageUrl: string | null;
  status: ActivityStatus;
}

interface OrganizerActivityRequestBase {
  activityId: number;
  status: ActivityRequestStatus;
  reason: string;
  reviewNote: string | null;
  submittedAt: string;
  handledAt: string | null;
  withdrawnAt: string | null;
  cancelledAt: string | null;
  activity: OrganizerActivityRequestActivityResponse;
}

export interface OrganizerActivityChangeRequestResponse
  extends OrganizerActivityRequestBase {
  activityChangeRequestId: number;
  requestedTitle: string | null;
  requestedDescriptionIncluded: boolean;
  requestedDescription: string | null;
  requestedActivityType: string | null;
  requestedLocationId: number | null;
  requestedLocation: ActivityLocationResponse | null;
  requestedStartAt: string | null;
  requestedEndAt: string | null;
  requestedCapacity: number | null;
  requestedImageUrlIncluded: boolean;
  requestedImageUrl: string | null;
}

export interface OrganizerActivityCancellationRequestResponse
  extends OrganizerActivityRequestBase {
  activityCancellationRequestId: number;
  late: boolean;
}

export interface ActivityListQuery {
  page?: number;
  size?: number;
  sort?: string;
  eventId?: number | string;
  status?: ActivityStatus;
  search?: string;
}

export interface ActivityProposalListQuery {
  page?: number;
  size?: number;
  sort?: string;
  eventId?: number | string;
  status?: ActivityProposalStatus;
  locationId?: number | string;
  search?: string;
}

export interface ActivityRequestListQuery {
  page?: number;
  size?: number;
  sort?: string;
  eventId?: number | string;
  status?: ActivityRequestStatus;
  search?: string;
}

export interface ActivityCancellationRequestListQuery extends ActivityRequestListQuery {
  late?: boolean;
}
