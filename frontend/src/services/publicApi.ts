import { Booth, EventItem } from '../types';
import {
  HeritagePageResponse,
  PublicHeritageDetail,
  PublicHeritageListItem,
} from '../types/heritage';
import { apiClient } from './apiClient';
import { boothApi, getCachedPublicEventBooths } from './boothApi';

const DEFAULT_BOOTH_IMAGE = '/images/booths/default-bookstall.png';

function assertHeritagePage(
  value: unknown,
): asserts value is HeritagePageResponse<PublicHeritageListItem> {
  if (
    !value
    || typeof value !== 'object'
    || !Array.isArray((value as Partial<HeritagePageResponse<PublicHeritageListItem>>).content)
    || !Number.isInteger((value as Partial<HeritagePageResponse<PublicHeritageListItem>>).page)
    || !Number.isInteger((value as Partial<HeritagePageResponse<PublicHeritageListItem>>).totalPages)
  ) {
    throw new Error('Dữ liệu di sản trả về không đúng định dạng.');
  }
}

async function getPublishedEvents(): Promise<EventItem[]> {
  const first = await apiClient.get<PageResponse<PublicEventResponse>>('/events?page=0&size=100&sort=startAt,asc');
  const remaining = first.totalPages > 1
    ? await Promise.all(Array.from({ length: first.totalPages - 1 }, (_, index) =>
      apiClient.get<PageResponse<PublicEventResponse>>(`/events?page=${index + 1}&size=100&sort=startAt,asc`)))
    : [];
  return [first, ...remaining]
    .sort((left, right) => left.page - right.page)
    .flatMap(page => page.content)
    .map(toEventItem);
}

export interface PublicActivity {
  id: string;
  eventId: string;
  eventTitle: string;
  title: string;
  titleEn: string;
  kind: string;
  description: string;
  startAt: string;
  endAt: string;
  capacity: number;
  registeredCount: number | null;
  availableSeats: number | null;
  registrationRequired: boolean;
  registrationOpen: boolean;
  certificateEnabled: boolean;
  status: string;
  imageUrl: string | null;
  location: string;
  locationDetail: PublicActivityLocation;
}

export interface PublicActivityLocation {
  locationId: number;
  code: string;
  name: string;
  locationType: 'BOOTH' | 'STAGE' | 'WORKSHOP' | 'AREA';
  description: string | null;
  maxCapacity: number | null;
  mapX: number | null;
  mapY: number | null;
}

export interface CreatePublicFeedbackRequest {
  targetType: 'BOOK_STREET' | 'EVENT';
  eventId?: number;
  guestName?: string;
  contactEmail?: string;
  message: string;
}

export interface PublicFeedbackReceipt {
  feedbackId: number;
  receivedAt: string;
}

interface PublicActivityResponse {
  activityId: number;
  eventId: number;
  eventName: string;
  location: PublicActivityLocation;
  title: string;
  description: string | null;
  activityType: string;
  startAt: string;
  endAt: string;
  capacity: number;
  imageUrl: string | null;
  registrationRequired: boolean;
  registrationOpen: boolean;
  registeredCount: number | null;
  availableSeats: number | null;
  certificateEnabled: boolean;
  status: string;
}

interface PublicEventResponse {
  eventId: number;
  name: string;
  description: string | null;
  startAt: string;
  endAt: string;
  partnerApplicationDeadlineAt: string | null;
  participantRegistrationDeadlineAt: string | null;
  bannerUrl: string | null;
  status: 'PUBLISHED' | 'ONGOING';
}

interface PageResponse<T> {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

const EVENT_TIME_ZONE = 'Asia/Ho_Chi_Minh';

function formatEventDate(value: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: EVENT_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(value));
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function formatEventTime(value: string): string {
  return new Intl.DateTimeFormat('vi-VN', {
    timeZone: EVENT_TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(new Date(value));
}

function formatEventSchedule(startAt: string, endAt: string): string {
  const startDate = formatEventDate(startAt).split('-').reverse().join('/');
  const endDate = formatEventDate(endAt).split('-').reverse().join('/');
  const startTime = formatEventTime(startAt);
  const endTime = formatEventTime(endAt);
  return startDate === endDate
    ? `${startDate}, ${startTime} – ${endTime}`
    : `${startDate}, ${startTime} – ${endDate}, ${endTime}`;
}

function toEventItem(event: PublicEventResponse): EventItem {
  const now = Date.now();
  const startAt = new Date(event.startAt).getTime();
  const endAt = new Date(event.endAt).getTime();

  return {
    id: String(event.eventId),
    title: event.name,
    titleEn: event.name,
    startAt: event.startAt,
    endAt: event.endAt,
    type: 'exhibition',
    typeLabelVi: 'Sự kiện',
    typeLabelEn: 'Event',
    dateStr: formatEventDate(event.startAt),
    dayOfWeek: new Intl.DateTimeFormat('vi-VN', {
      timeZone: EVENT_TIME_ZONE,
      weekday: 'long',
    }).format(new Date(event.startAt)),
    timeStr: `${formatEventTime(event.startAt)} - ${formatEventTime(event.endAt)}`,
    scheduleStr: formatEventSchedule(event.startAt, event.endAt),
    registrationDeadlineAt: event.participantRegistrationDeadlineAt,
    location: '',
    locationEn: '',
    priorityLevel: 'regular',
    summary: event.description || '',
    summaryEn: event.description || '',
    speaker: '',
    image: {
      url: event.bannerUrl || '',
      alt: event.name,
      source: '',
      license: '',
      isIllustrationOnly: !event.bannerUrl,
    },
    status: now < startAt ? 'upcoming' : now <= endAt ? 'happening' : 'approved',
  };
}

function toPublicActivity(activity: PublicActivityResponse): PublicActivity {
  return {
    id: String(activity.activityId),
    eventId: String(activity.eventId),
    eventTitle: activity.eventName,
    title: activity.title,
    titleEn: activity.title,
    kind: activity.activityType || 'Hoạt động',
    description: activity.description || '',
    startAt: activity.startAt,
    endAt: activity.endAt,
    capacity: activity.capacity,
    registeredCount: activity.registeredCount,
    availableSeats: activity.availableSeats,
    registrationRequired: activity.registrationRequired,
    registrationOpen: activity.registrationOpen,
    certificateEnabled: activity.certificateEnabled,
    status: activity.status,
    imageUrl: activity.imageUrl,
    location: activity.location?.name || activity.location?.code || '',
    locationDetail: activity.location,
  };
}

function toPublicBooth(row: Awaited<ReturnType<typeof boothApi.listAllPublicEventBooths>>[number]): Booth {
  const categoryCode = row.booth.categoryCode?.toLowerCase() || '';
  const category: Booth['category'] = categoryCode.includes('child') || categoryCode.includes('manga') || categoryCode.includes('comic') ? 'children'
    : categoryCode.includes('history') ? 'history'
      : categoryCode.includes('cafe') ? 'cafe'
        : categoryCode.includes('life') ? 'lifestyle'
          : categoryCode.includes('literature') ? 'literature' : 'other';
  const description = row.booth.description || row.booth.note || '';
  const labelByCode: Record<string, { vi: string; en: string }> = {
    LITERATURE: { vi: 'Văn học & Nghệ thuật', en: 'Literature & Arts' },
    CHILDREN: { vi: 'Sách Thiếu nhi', en: "Children's Books" },
    MANGA_COMICS: { vi: 'Truyện tranh & Manga', en: 'Manga & Comics' },
    HISTORY_SOCIETY: { vi: 'Lịch sử & Xã hội', en: 'History & Society' },
    ART_CULTURE: { vi: 'Nghệ thuật & Văn hóa', en: 'Arts & Culture' },
    EDUCATION: { vi: 'Giáo dục & Kỹ năng', en: 'Education & Skills' },
    TECHNOLOGY_SCIENCE: { vi: 'STEM & Công nghệ', en: 'STEM & Technology' },
    LIFESTYLE: { vi: 'Phong cách sống', en: 'Lifestyle' },
    CAFE: { vi: 'Cà phê sách', en: 'Book Cafe' },
  };
  const categoryLabel = labelByCode[row.booth.categoryCode || ''];

  return {
    id: String(row.booth.boothId),
    code: row.booth.code,
    name: row.booth.name,
    nameEn: row.booth.name,
    publisher: '',
    category,
    categoryLabelVi: categoryLabel?.vi || 'Gian hàng',
    categoryLabelEn: categoryLabel?.en || 'Booth',
    tagline: description,
    taglineEn: description,
    description,
    descriptionEn: description,
    featuredBooks: [],
    featuredBooksEn: [],
    mapLocationId: `booth-${row.booth.boothId}`,
    eventId: String(row.eventId),
    rentalPrice: row.rentalPrice,
    availability: row.availability,
    maxCapacity: row.booth.maxCapacity,
    openHours: '',
    image: {
      url: row.booth.imageUrl || DEFAULT_BOOTH_IMAGE,
      alt: row.booth.name,
      source: '',
      license: '',
      isIllustrationOnly: false,
    },
  };
}

const publicActivitiesCache = new Map<string, { rows?: PublicActivity[]; inflight?: Promise<PublicActivity[]> }>();

export const publicApi = {
  getEvents: getPublishedEvents,
  getCachedBooths(eventId: string): Booth[] | undefined {
    if (!eventId) return [];
    const rows = getCachedPublicEventBooths(eventId);
    return rows ? rows.filter(row => row.enabled).map(toPublicBooth) : undefined;
  },
  getCachedActivities(eventId?: string): PublicActivity[] | undefined {
    return publicActivitiesCache.get(eventId ?? '__all__')?.rows;
  },
  async getBooths(eventId: string): Promise<Booth[]> {
    if (!eventId) return [];
    const rows = await boothApi.listAllPublicEventBooths(eventId);
    return rows.filter(row => row.enabled).map(toPublicBooth);
  },
  async getHeritages(): Promise<PublicHeritageListItem[]> {
    const first = await apiClient.get<HeritagePageResponse<PublicHeritageListItem>>(
      '/heritages?page=0&size=100',
    );
    assertHeritagePage(first);
    const remaining = first.totalPages > 1
      ? await Promise.all(Array.from({ length: first.totalPages - 1 }, (_, index) =>
        apiClient.get<HeritagePageResponse<PublicHeritageListItem>>(
          `/heritages?page=${index + 1}&size=100`,
        )))
      : [];
    remaining.forEach(assertHeritagePage);
    return [first, ...remaining]
      .sort((left, right) => (left.page ?? 0) - (right.page ?? 0))
      .flatMap(page => Array.isArray(page?.content) ? page.content : Array.isArray(page) ? page : []);
  },
  async getActivities(eventId?: string): Promise<PublicActivity[]> {
    const cacheKey = eventId ?? '__all__';
    const cached = publicActivitiesCache.get(cacheKey);
    if (cached?.rows) return cached.rows;
    if (cached?.inflight) return cached.inflight;

    const endpoint = (page: number) => {
      const params = new URLSearchParams({ page: String(page), size: '100', sort: 'startAt,asc' });
      if (eventId) params.set('eventId', eventId);
      return `/activities?${params.toString()}`;
    };
    const inflight = (async () => {
      const first = await apiClient.get<PageResponse<PublicActivityResponse>>(endpoint(0));
      const remaining = (first.totalPages ?? 0) > 1
        ? await Promise.all(Array.from({ length: first.totalPages - 1 }, (_, index) =>
          apiClient.get<PageResponse<PublicActivityResponse>>(endpoint(index + 1))))
        : [];
      const rows = [first, ...remaining]
        .sort((left, right) => (left.page ?? 0) - (right.page ?? 0))
        .flatMap(page => Array.isArray(page?.content) ? page.content : Array.isArray(page) ? page : [])
        .map(toPublicActivity);
      publicActivitiesCache.set(cacheKey, { rows });
      return rows;
    })().catch(error => {
      publicActivitiesCache.delete(cacheKey);
      throw error;
    });
    publicActivitiesCache.set(cacheKey, { inflight });
    return inflight;
  },
  getHeritage: (publicCode: string) =>
    apiClient.get<PublicHeritageDetail>(`/heritages/${encodeURIComponent(publicCode)}`),
  submitFeedback: (payload: CreatePublicFeedbackRequest) =>
    apiClient.post<PublicFeedbackReceipt>('/public/feedbacks', payload),
};
