export type BoothAvailability = 'AVAILABLE' | 'ON_HOLD' | 'ASSIGNED' | 'UNAVAILABLE';

export type BoothRequestStatus =
  | 'PENDING'
  | 'SELECTED'
  | 'COMPLETED'
  | 'PAYMENT_EXPIRED'
  | 'NOT_SELECTED'
  | 'REJECTED'
  | 'WITHDRAWN'
  | 'CANCELLED';

export type BoothHoldStatus = 'ACTIVE' | 'CONSUMED' | 'EXPIRED' | 'RELEASED';

export interface PageResponse<T> {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

export interface PhysicalBooth {
  boothId: number;
  code: string;
  name: string;
  description: string | null;
  maxCapacity: number;
  mapX: number | null;
  mapY: number | null;
  active: boolean;
  categoryCode: string | null;
  note: string | null;
  imageUrl: string | null;
}

export interface EventBooth {
  eventBoothConfigId: number | null;
  eventId: number;
  booth: PhysicalBooth;
  rentalPrice: number | null;
  enabled: boolean;
  availability: BoothAvailability;
}

export interface BoothHold {
  boothHoldId: number;
  status: BoothHoldStatus;
  lockedRentalPrice: number;
  createdAt: string;
  expiresAt: string;
  releasedAt: string | null;
}

export interface BoothRequest {
  boothRequestId: number;
  eventId: number;
  boothId: number;
  boothCode: string;
  partnerOrganizationId: number;
  partnerOrganizationName: string;
  partnerOrganizationStatus: 'ACTIVE' | 'INACTIVE';
  status: BoothRequestStatus;
  requestNote: string | null;
  reviewNote: string | null;
  submittedAt: string;
  reviewedAt: string | null;
  selectedAt: string | null;
  completedAt: string | null;
  paymentExpiredAt: string | null;
  withdrawnAt: string | null;
  cancelledAt: string | null;
  hold: BoothHold | null;
}

export interface CreatePhysicalBoothInput {
  code: string;
  name: string;
  description: string | null;
  maxCapacity: number;
  mapX: number | null;
  mapY: number | null;
  categoryCode: string | null;
  note: string | null;
  imageUrl: string | null;
}

export type UpdatePhysicalBoothInput = Partial<CreatePhysicalBoothInput> & {
  active?: boolean;
};
