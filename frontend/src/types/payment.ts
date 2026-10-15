export type BoothPaymentStatus = 'PENDING' | 'SUCCESS' | 'FAILED' | 'TIMEOUT';

export type BoothPaymentPurpose = 'INITIAL_BOOTH_RENTAL';

export type BoothPaymentTransactionType = 'PAYMENT';

export interface BoothPayment {
  boothPaymentId: number;
  boothRequestId: number;
  boothHoldId: number;
  transactionType: BoothPaymentTransactionType;
  purpose: BoothPaymentPurpose | string;
  amount: number;
  status: BoothPaymentStatus;
  idempotencyKey: string;
  gatewayProvider: string | null;
  gatewayTransactionRef: string | null;
  failureCode: string | null;
  failureMessage: string | null;
  reconciliationRequired: boolean;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}

export interface PaymentInitiationResponse {
  payment: BoothPayment;
  checkoutUrl: string | null;
  sessionExpiresAt: string | null;
  resolution?: string | null;
}

export type BoothAssignmentStatus = 'ACTIVE' | 'RELEASED';

export interface BoothAssignment {
  boothAssignmentId: number;
  boothHoldId: number;
  boothRequestId: number;
  eventId: number;
  boothId: number;
  boothCode: string;
  partnerOrganizationId: number;
  partnerOrganizationName: string;
  lockedRentalPrice: number;
  qrToken: string;
  coverImageUrl: string | null;
  status: BoothAssignmentStatus;
  assignedAt: string;
  releasedAt: string | null;
  releaseReason: string | null;
}

