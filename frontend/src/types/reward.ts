export type EventRegistrationAction = 'CREATED' | 'REACTIVATED' | 'REUSED';

export interface ParticipantBadgeResponse {
  badgeId: number;
  name: string;
  description: string | null;
  iconUrl: string | null;
  requiredPoints: number;
  isActive: boolean;
  state: 'EARNED' | 'IN_PROGRESS';
  earned: boolean;
  earnedAt: string | null;
  remainingPoints: number;
  progressPercent: number;
}

export interface BoothScanResponse {
  boothVisit: {
    boothVisitId: number;
    eventRegistrationId: number;
    boothAssignmentId: number;
    event: {
      eventId: number;
      name: string;
    };
    booth: {
      boothId: number;
      code: string;
      name: string;
    };
    visitedAt: string;
  };
  eventRegistrationAction: EventRegistrationAction;
  visitPoints: number;
  newlyAwardedPoints: number;
  totalPoints: number;
  alreadyVisited: boolean;
  newlyUnlockedBadges: ParticipantBadgeResponse[];
}

export interface RewardSummaryResponse {
  totalPoints: number;
  totalVisits: number;
  earnedBadgeCount: number;
  activeBadgeCount: number;
  nextBadge: ParticipantBadgeResponse | null;
}

export interface RewardBadgePageResponse {
  content: ParticipantBadgeResponse[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

export interface PointTransactionResponse {
  pointTransactionId: number;
  boothVisitId: number;
  boothAssignmentId: number;
  points: number;
  createdAt: string;
  visitedAt: string;
  event: {
    eventId: number;
    name: string;
  };
  booth: {
    boothId: number;
    code: string;
    name: string;
  };
}

export interface RewardPointPageResponse {
  content: PointTransactionResponse[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}
