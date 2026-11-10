import type { OrganizerTab } from '../types/organizer';

export const ORGANIZER_ROOT = '/organizer';

const TAB_PATHS: Record<Exclude<OrganizerTab, 'event_detail'>, string> = {
  overview: ORGANIZER_ROOT,
  events: `${ORGANIZER_ROOT}/events`,
  booth_requests: `${ORGANIZER_ROOT}/booth-requests`,
  payments: `${ORGANIZER_ROOT}/payments`,
  booths: `${ORGANIZER_ROOT}/booths`,
  venues: `${ORGANIZER_ROOT}/venues`,
  activities: `${ORGANIZER_ROOT}/activities`,
  participants: `${ORGANIZER_ROOT}/participants`,
  reports: `${ORGANIZER_ROOT}/reports`,
  feedback: `${ORGANIZER_ROOT}/feedback`,
  public_content: `${ORGANIZER_ROOT}/public-content`,
  notifications: `${ORGANIZER_ROOT}/notifications`,
  profile: `${ORGANIZER_ROOT}/profile`,
};

const PATH_TABS = new Map(Object.entries(TAB_PATHS).map(([tab, path]) => [path, tab as OrganizerTab]));
const SUPPORTED_TABS = new Set<OrganizerTab>([
  'overview',
  'events',
  'event_detail',
  'booth_requests',
  'payments',
  'booths',
  'venues',
  'activities',
  'participants',
  'feedback',
  'public_content',
  'notifications',
  'profile',
]);
const EVENT_SCOPED_TABS: OrganizerTab[] = ['booth_requests', 'booths', 'activities', 'participants', 'reports'];
const EVENT_LIST_STATUSES = new Set(['DRAFT', 'PUBLISHED', 'ONGOING', 'COMPLETED', 'CANCELLED']);
const EVENT_LIST_SORTS = new Set(['updated_desc', 'start_asc', 'title_asc']);
const ACTIVITY_VIEWS = new Set(['activities', 'proposals', 'changes', 'cancellations']);
const PARTICIPANT_VIEWS = new Set(['event', 'activity', 'booth']);
const EVENT_REGISTRATION_STATUSES = new Set(['ACTIVE', 'LEFT']);
const PARTICIPATION_OUTCOMES = new Set(['ACTIVE', 'CANCELLED', 'ATTENDED', 'NO_SHOW']);
const EVENT_DETAIL_SECTIONS = new Set(['overview', 'partners', 'booths', 'activities', 'participants', 'schedule', 'settings']);

export interface OrganizerRouteState {
  tab: OrganizerTab;
  eventId: string | null;
}
function normalizePathname(pathname: string): string {
  if (pathname.length > 1 && pathname.endsWith('/')) return pathname.slice(0, -1);
  return pathname;
}

export function resolveOrganizerRoute(pathname: string, search: string): OrganizerRouteState | null {
  const normalizedPath = normalizePathname(pathname);
  const eventDetailMatch = normalizedPath.match(/^\/organizer\/events\/([^/]+)$/);
  if (eventDetailMatch) {
    try {
      return { tab: 'event_detail', eventId: decodeURIComponent(eventDetailMatch[1]) };
    } catch {
      return null;
    }
  }

  const tab = PATH_TABS.get(normalizedPath);
  if (!tab || !SUPPORTED_TABS.has(tab)) return null;

  const params = new URLSearchParams(search);
  const eventId = EVENT_SCOPED_TABS.includes(tab) ? params.get('eventId')?.trim() || null : null;
  return { tab, eventId };
}

export function normalizeOrganizerSearch(tab: OrganizerTab, search: string): URLSearchParams {
  const source = new URLSearchParams(search);
  const normalized = new URLSearchParams();
  const copyNonEmpty = (key: string) => {
    const value = source.get(key)?.trim();
    if (value) normalized.set(key, value);
  };
  const copyPositivePage = () => {
    const page = Number.parseInt(source.get('page') || '', 10);
    if (Number.isFinite(page) && page > 1) normalized.set('page', String(page));
  };

  if (tab === 'events') {
    copyNonEmpty('search');
    const status = source.get('status');
    if (status && EVENT_LIST_STATUSES.has(status)) normalized.set('status', status);
    const sort = source.get('sort');
    if (sort && EVENT_LIST_SORTS.has(sort) && sort !== 'updated_desc') normalized.set('sort', sort);
    copyPositivePage();
    return normalized;
  }

  if (tab === 'event_detail') {
    const section = source.get('section');
    if (section && EVENT_DETAIL_SECTIONS.has(section) && section !== 'overview') normalized.set('section', section);
    return normalized;
  }

  if (EVENT_SCOPED_TABS.includes(tab)) copyNonEmpty('eventId');
  if (tab === 'booths') {
    if (source.get('view') === 'map') normalized.set('view', 'map');
    const locationId = source.get('locationId');
    if (locationId && /^[1-9]\d*$/.test(locationId)) normalized.set('locationId', locationId);
  }
  if (tab === 'activities') {
    const view = source.get('view') || source.get('activityView');
    if (view && ACTIVITY_VIEWS.has(view) && view !== 'activities') normalized.set('view', view);
    copyNonEmpty('search');
    copyNonEmpty('status');
    if (source.get('late') === 'true') normalized.set('late', 'true');
    copyPositivePage();
  }
  if (tab === 'participants') {
    const view = source.get('view');
    if (view && PARTICIPANT_VIEWS.has(view) && view !== 'event') normalized.set('view', view);
    if (view === 'activity') copyNonEmpty('activityId');
    copyNonEmpty('search');
    const status = source.get('status');
    if (status && EVENT_REGISTRATION_STATUSES.has(status) && view !== 'activity') normalized.set('status', status);
    const outcome = source.get('outcome');
    if (outcome && PARTICIPATION_OUTCOMES.has(outcome) && view === 'activity') normalized.set('outcome', outcome);
    copyPositivePage();
  }
  return normalized;
}

export function organizerTabPath(tab: OrganizerTab, eventId?: string | null): string {
  if (tab === 'event_detail') {
    return eventId ? `${TAB_PATHS.events}/${encodeURIComponent(eventId)}` : TAB_PATHS.events;
  }
  return TAB_PATHS[tab];
}

export function organizerTabUrl(
  tab: OrganizerTab,
  options: { eventId?: string | null; search?: URLSearchParams } = {},
): string {
  const pathname = organizerTabPath(tab, options.eventId);
  if (tab === 'event_detail') return pathname;

  const params = options.search ? new URLSearchParams(options.search) : new URLSearchParams();
  if (options.eventId) params.set('eventId', options.eventId);
  else params.delete('eventId');
  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
}

export function migrateLegacyOrganizerUrl(pathname: string, search: string): string | null {
  const normalizedPath = normalizePathname(pathname);
  if (normalizedPath !== '/portal' && !normalizedPath.startsWith('/portal/')) return null;

  const migratedPath = normalizedPath === '/portal'
    ? ORGANIZER_ROOT
    : `${ORGANIZER_ROOT}${normalizedPath.slice('/portal'.length)}`;
  const params = new URLSearchParams(search);
  const legacyView = params.get('activityView');
  if (legacyView && !params.has('view')) params.set('view', legacyView);
  params.delete('activityView');

  // Old Activity workspace links used /portal plus activity-specific query parameters.
  if (normalizedPath === '/portal' && (legacyView || params.has('view'))) {
    const query = params.toString();
    return `${TAB_PATHS.activities}${query ? `?${query}` : ''}`;
  }

  const query = params.toString();
  return `${migratedPath}${query ? `?${query}` : ''}`;
}

export function organizerRouteForNotificationTarget(tab: OrganizerTab): string {
  return organizerTabPath(tab === 'event_detail' ? 'events' : tab);
}

