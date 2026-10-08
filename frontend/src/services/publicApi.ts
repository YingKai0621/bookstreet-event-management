import { apiClient } from './apiClient';
import { Booth, EventItem } from '../types';
import { HeritageProfile } from '../types/heritage';

interface PublicEventResponse {
  eventId: number;
  name: string;
  description: string;
  startAt: string;
  endAt: string;
  bannerUrl: string | null;
  status: string;
}

interface PublicEventPage {
  content: PublicEventResponse[];
  page: number;
  totalPages: number;
}

function toEventItem(event: PublicEventResponse): EventItem {
  const start = new Date(event.startAt);
  const end = new Date(event.endAt);
  const now = Date.now();
  return {
    id: String(event.eventId),
    title: event.name,
    titleEn: event.name,
    type: 'exhibition',
    typeLabelVi: 'Sự kiện',
    typeLabelEn: 'Event',
    dateStr: start.toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }),
    timeStr: `${start.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Ho_Chi_Minh' })} - ${end.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Ho_Chi_Minh' })}`,
    location: 'Đường Sách Nguyễn Văn Bình',
    locationEn: 'Nguyen Van Binh Book Street',
    priorityLevel: 'regular',
    summary: event.description || '',
    summaryEn: event.description || '',
    speaker: '',
    image: {
      url: event.bannerUrl || '',
      alt: event.name,
      source: '',
      license: '',
      isIllustrationOnly: false,
    },
    status: now >= start.getTime() && now <= end.getTime() ? 'happening' : 'upcoming',
  };
}

async function getPublishedEvents(): Promise<EventItem[]> {
  const first = await apiClient.get<PublicEventPage>('/events?page=0&size=100&sort=startAt,asc');
  const remaining = first.totalPages > 1
    ? await Promise.all(Array.from({ length: first.totalPages - 1 }, (_, index) =>
      apiClient.get<PublicEventPage>(`/events?page=${index + 1}&size=100&sort=startAt,asc`)))
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
  getBooths: () => apiClient.get<Booth[]>('/public/booths'),
  async getHeritages(): Promise<HeritageProfile[]> {
    const heritages = await apiClient.get<Record<string, unknown>[]>('/public/heritages');
    return heritages.map(toHeritageProfile);
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
