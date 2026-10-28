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
