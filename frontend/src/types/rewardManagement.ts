import type { BoothScanResponse } from './reward';

export interface RewardManagementPage<T> {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

export interface OrganizerBoothVisitSummary {
  eventId: number;
  totalVisits: number;
  uniqueParticipants: number;
  visitedBoothAssignments: number;
}

export interface OrganizerBoothVisitGroup {
  boothAssignmentId: number;
  booth: BoothScanResponse['boothVisit']['booth'];
  assignmentStatus: 'ACTIVE' | 'RELEASED' | 'CANCELLED' | 'ENDED';
  visitCount: number;
  lastVisitedAt: string;
}

export interface OrganizerBoothVisit {
  boothVisitId: number;
  eventRegistrationId: number;
  visitedAt: string;
  participant: { userId: number; displayName: string };
  boothAssignmentId: number;
  booth: OrganizerBoothVisitGroup['booth'];
  assignmentStatus: OrganizerBoothVisitGroup['assignmentStatus'];
}

export interface AdminBadgeInput {
  name: string;
  description: string | null;
  requiredPoints: number;
  iconUrl: string | null;
  isActive: boolean;
}

export interface AdminBadge extends AdminBadgeInput {
  badgeId: number;
  awardedUserCount: number;
  remainingEligibleCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface BadgeMutationResult {
  badge: AdminBadge;
  synchronizationTriggered: boolean;
}

export interface BadgeSynchronizationResult {
  badgeId: number;
  processedCount: number;
  awardedCount: number;
  remainingEligibleCount: number;
  completed: boolean;
}
