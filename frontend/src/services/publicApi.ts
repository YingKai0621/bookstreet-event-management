import { Booth, EventItem } from '../types';
import { HeritageProfile } from '../types/heritage';
import { apiClient } from './apiClient';
import { boothApi } from './boothApi';

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
  speaker: string;
  startAt: string;
  endAt: string;
  capacity: number;
  registeredCount: number;
  imageUrl: string | null;
  location: string;
  venue: string | null;
}

interface PublicEventResponse {
  eventId: number;
  name: string;
  description: string | null;
  startAt: string;
  endAt: string;
  partnerApplicationDeadlineAt: string | null;
  bannerUrl: string | null;
  status: 'PUBLISHED';
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

function toEventItem(event: PublicEventResponse): EventItem {
  const now = Date.now();
  const startAt = new Date(event.startAt).getTime();
  const endAt = new Date(event.endAt).getTime();

  return {
    id: String(event.eventId),
    title: event.name,
    titleEn: event.name,
    type: 'exhibition',
    typeLabelVi: 'Sự kiện',
    typeLabelEn: 'Event',
    dateStr: formatEventDate(event.startAt),
    dayOfWeek: new Intl.DateTimeFormat('vi-VN', {
      timeZone: EVENT_TIME_ZONE,
      weekday: 'long',
    }).format(new Date(event.startAt)),
    timeStr: `${formatEventTime(event.startAt)} - ${formatEventTime(event.endAt)}`,
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

function toPublicBooth(row: Awaited<ReturnType<typeof boothApi.listAllPublicEventBooths>>[number]): Booth {
  const categoryCode = row.booth.categoryCode?.toLowerCase() || '';
  const category: Booth['category'] = categoryCode.includes('child') || categoryCode.includes('manga') || categoryCode.includes('comic') ? 'children'
    : categoryCode.includes('history') ? 'history'
      : categoryCode.includes('cafe') ? 'cafe'
        : categoryCode.includes('life') ? 'lifestyle'
          : categoryCode.includes('literature') ? 'literature' : 'other';
  const description = row.booth.description || row.booth.note || '';

  return {
    id: String(row.booth.boothId),
    code: row.booth.code,
    name: row.booth.name,
    nameEn: row.booth.name,
    publisher: '',
    category,
    categoryLabelVi: row.booth.categoryCode || 'Gian hàng',
    categoryLabelEn: row.booth.categoryCode || 'Booth',
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
      url: '',
      alt: row.booth.name,
      source: '',
      license: '',
      isIllustrationOnly: false,
    },
  };
}

export function toHeritageProfile(heritage: Record<string, unknown>): HeritageProfile {
  return {
    id: String(heritage.slug || heritage.id),
    code: String(heritage.code || ''),
    name: String(heritage.name || ''),
    nameEn: String(heritage.nameEn || heritage.name || ''),
    province: String(heritage.province || ''),
    provinceEn: String(heritage.provinceEn || heritage.province || ''),
    category: String(heritage.category || ''),
    categoryEn: String(heritage.categoryEn || heritage.category || ''),
    period: String(heritage.period || ''),
    periodEn: String(heritage.periodEn || heritage.period || ''),
    address: String(heritage.address || ''),
    addressEn: String(heritage.addressEn || heritage.address || ''),
    briefDesc: String(heritage.briefDesc || ''),
    briefDescEn: String(heritage.briefDescEn || heritage.briefDesc || ''),
    highlights: Array.isArray(heritage.highlights) ? heritage.highlights.map(String) : [],
    highlightsEn: Array.isArray(heritage.highlightsEn) ? heritage.highlightsEn.map(String) : [],
    story: String(heritage.story || ''),
    storyEn: String(heritage.storyEn || heritage.story || ''),
    referenceSource: String(heritage.referenceSource || ''),
    updatedDate: heritage.updatedAt ? new Date(String(heritage.updatedAt)).toLocaleDateString('vi-VN') : '',
    image: {
      url: String(heritage.imageUrl || ''),
      alt: String(heritage.imageAlt || heritage.name || ''),
      source: String(heritage.imageSource || ''),
      license: String(heritage.imageLicense || ''),
    },
    mapCoordinates: {
      x: Number(heritage.mapX || 0),
      y: Number(heritage.mapY || 0),
      areaName: String(heritage.mapAreaName || ''),
    },
  };
}

export const publicApi = {
  getEvents: getPublishedEvents,
  async getBooths(eventId: string): Promise<Booth[]> {
    if (!eventId) return [];
    const rows = await boothApi.listAllPublicEventBooths(eventId);
    return rows.map(toPublicBooth);
  },
  async getHeritages(): Promise<HeritageProfile[]> {
    // Heritage persistence/API belongs to a future module and is not part of the
    // active backend schema. Keep current public screens empty instead of issuing
    // a request that is guaranteed to return 401/404.
    return [];
  },
  getActivities: () => apiClient.get<PublicActivity[]>('/public/activities'),
  getHeritageBySlug: (slug: string) => apiClient.get(`/public/heritages/${slug}`),
  submitFeedback: (payload: {
    rating: number;
    comments?: string;
    contactEmail?: string;
    targetScope?: string;
    heritageId?: string;
    boothId?: string;
    targetName?: string;
    source?: string;
  }) => apiClient.post('/public/feedbacks', payload),
};
