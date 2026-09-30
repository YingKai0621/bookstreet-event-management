import { MapLocationPoint } from '../types/map';
import { apiClient } from './apiClient';

export type { MapLocationPoint };

export const DEFAULT_MAP_IMAGE = '/assets/maps/duong-sach-nguyen-van-binh.png';

// Kept only as empty synchronous values for components while their API request
// is loading. Map content is never persisted in browser storage.
export const getSharedMapPoints = (): MapLocationPoint[] => [];
export const getSharedMapImage = (): string => DEFAULT_MAP_IMAGE;
export const saveSharedMapPoints = (_points: MapLocationPoint[]): void => {
  throw new Error('Lưu bản đồ cần được thực hiện qua API quản trị.');
};
export const saveSharedMapImage = (_imageUrl: string): void => {
  throw new Error('Lưu ảnh bản đồ cần được thực hiện qua API quản trị.');
};

export async function fetchMapHotspotsFromApi(): Promise<MapLocationPoint[]> {
  const hotspots = await apiClient.get<Array<Record<string, unknown>>>('/public/map-hotspots');
  return hotspots.map(hotspot => ({
    id: String(hotspot.id), code: String(hotspot.code), name: String(hotspot.title),
    nameEn: String(hotspot.titleEn || hotspot.title), category: hotspot.category as MapLocationPoint['category'],
    x: Number(hotspot.x), y: Number(hotspot.y), shortDesc: String(hotspot.shortDesc || ''),
    shortDescEn: String(hotspot.shortDescEn || ''), status: hotspot.status === 'unavailable' ? 'unavailable' : 'available',
    statusLabelVi: hotspot.status === 'unavailable' ? 'Tạm ngưng' : 'Sẵn sàng',
    imageUrl: hotspot.imageUrl ? String(hotspot.imageUrl) : undefined,
    openHours: hotspot.openHours ? String(hotspot.openHours) : undefined,
    zone: hotspot.area ? String(hotspot.area) : undefined,
    dimensions: hotspot.dimensions ? String(hotspot.dimensions) : undefined,
  }));
}
