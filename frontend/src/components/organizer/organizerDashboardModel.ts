import type { OrganizerEvent } from '../../types/organizer';

function timestamp(value: string): number | null {
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : null;
}
export function selectOperationalEvents(
  events: OrganizerEvent[],
  now = Date.now(),
): OrganizerEvent[] {
  const ongoing = events
    .filter(event => event.apiStatus === 'ONGOING')
    .sort((left, right) => {
      const leftEnd = timestamp(left.endDate) ?? Number.MAX_SAFE_INTEGER;
      const rightEnd = timestamp(right.endDate) ?? Number.MAX_SAFE_INTEGER;
      return leftEnd - rightEnd;
    });

  const upcoming = events
    .filter(event => {
      if (event.apiStatus !== 'PUBLISHED') return false;
      const start = timestamp(event.startDate);
      return start !== null && start > now;
    })
    .sort((left, right) => {
      const leftStart = timestamp(left.startDate) ?? Number.MAX_SAFE_INTEGER;
      const rightStart = timestamp(right.startDate) ?? Number.MAX_SAFE_INTEGER;
      return leftStart - rightStart;
    });

  return [...ongoing, ...upcoming];
}

export function selectDashboardScopeEvents(
  events: OrganizerEvent[],
  now = Date.now(),
): OrganizerEvent[] {
  const operational = selectOperationalEvents(events, now);
  const operationalIds = new Set(operational.map(event => event.id));
  const fallback = events
    .filter(event => !operationalIds.has(event.id))
    .sort((left, right) => {
      const updatedDifference = (timestamp(right.updatedAt) ?? 0) - (timestamp(left.updatedAt) ?? 0);
      if (updatedDifference !== 0) return updatedDifference;

      const startDifference = (timestamp(right.startDate) ?? 0) - (timestamp(left.startDate) ?? 0);
      if (startDifference !== 0) return startDifference;

      return left.id.localeCompare(right.id, undefined, { numeric: true });
    });

  return [...operational, ...fallback];
}

export function resolveDashboardEvent(
  events: OrganizerEvent[],
  now = Date.now(),
): OrganizerEvent | null {
  return selectDashboardScopeEvents(events, now)[0] ?? null;
}

export interface DashboardEventSummary {
  scopeEvents: OrganizerEvent[];
  upcomingEvents: OrganizerEvent[];
}

export function buildDashboardEventSummary(
  events: OrganizerEvent[],
  now = Date.now(),
): DashboardEventSummary {
  const operationalEvents = selectOperationalEvents(events, now);
  const scopeEvents = selectDashboardScopeEvents(events, now);
  const upcomingEvents = operationalEvents.filter(event => event.apiStatus === 'PUBLISHED');

  return {
    scopeEvents,
    upcomingEvents,
  };
}

