import type { BoothAvailability, EventBooth, PhysicalBooth } from '../../types/booth';

export type BoothMapMarkerStatus = BoothAvailability | 'OWNED' | 'PHYSICAL' | 'PHYSICAL_INACTIVE';
export type BoothMapMarkerKind = 'BOOTH' | 'STAGE' | 'WORKSHOP' | 'AREA';

export interface BoothMapMarker {
  id: string;
  boothId: number;
  code: string;
  name: string;
  x: number;
  y: number;
  status: BoothMapMarkerStatus;
  kind?: BoothMapMarkerKind;
  locationId?: number;
}

export const BOOTH_MAP_COORDINATE_HELP =
  'Tọa độ dùng phần trăm trên ảnh: X từ trái sang phải, Y từ trên xuống dưới (0–100).';

export function isValidMapCoordinate(value: number | null | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 100;
}

export function hasValidMapCoordinates(
  booth: Pick<PhysicalBooth, 'mapX' | 'mapY'>,
): booth is Pick<PhysicalBooth, 'mapX' | 'mapY'> & { mapX: number; mapY: number } {
  return isValidMapCoordinate(booth.mapX) && isValidMapCoordinate(booth.mapY);
}

export function physicalBoothToMarker(booth: PhysicalBooth): BoothMapMarker | null {
  if (!hasValidMapCoordinates(booth)) return null;
  return {
    id: `booth-${booth.boothId}`,
    boothId: booth.boothId,
    code: booth.code,
    name: booth.name,
    x: booth.mapX,
    y: booth.mapY,
    status: booth.active ? 'PHYSICAL' : 'PHYSICAL_INACTIVE',
    kind: 'BOOTH',
  };
}

export function eventBoothToMarker(row: EventBooth): BoothMapMarker | null {
  const marker = physicalBoothToMarker(row.booth);
  return marker ? { ...marker, status: row.availability } : null;
}

export function markerStatusLabel(status: BoothMapMarkerStatus): string {
  switch (status) {
    case 'AVAILABLE': return 'Còn trống';
    case 'ASSIGNED': return 'Đã thuê';
    case 'ON_HOLD': return 'Đang giữ chỗ';
    case 'UNAVAILABLE': return 'Không mở bán';
    case 'OWNED': return 'Gian của bạn';
    case 'PHYSICAL_INACTIVE': return 'Tạm ngưng';
    default: return 'Đang hoạt động';
  }
}
