import { useCallback, useEffect, useState } from 'react';
import { apiRequest, type Facility } from './facilities';

export interface LiveBooth extends Facility { status: 'available' | 'pending' | 'assigned' }
export interface BoothBooking {
  id: string;
  boothId: string;
  boothName: string;
  campus: string;
  organizationId: string;
  organizationName: string;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  createdAt: string;
}
export const boothStatusLabels = { available: 'Còn trống', pending: 'Chờ duyệt', assigned: 'Đã phân bổ' };
export const bookingStatusLabels = { pending: 'Chờ duyệt', approved: 'Đã duyệt', rejected: 'Đã từ chối', cancelled: 'Đã hủy' };
export function notifyBoothsChanged() { window.dispatchEvent(new Event('booths-changed')); }

export function useBoothData(organizationId?: string, enabled = true) {
  const [booths, setBooths] = useState<LiveBooth[]>([]);
  const [bookings, setBookings] = useState<BoothBooking[]>([]);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const refresh = useCallback(() => setRevision(value => value + 1), []);
  useEffect(() => {
    if (!enabled) return;
    let disposed = false;
    let running = false;
    const controller = new AbortController();
    const portal = organizationId ? 'partner' : 'admin';
    const query = organizationId ? `?organizationId=${encodeURIComponent(organizationId)}` : '';
    async function load() {
      if (running || disposed) return;
      running = true;
      try {
        const [boothResult, bookingResult] = await Promise.all([
          apiRequest<{ data: LiveBooth[] }>(`/${portal}/booths`, { signal: controller.signal }),
          apiRequest<{ data: BoothBooking[] }>(`/${portal}/booth-bookings${query}`, { signal: controller.signal }),
        ]);
        if (!disposed) { setBooths(boothResult.data); setBookings(bookingResult.data); setError(''); }
      } catch (err) {
        if (!disposed) setError(err instanceof Error ? err.message : 'Không thể tải gian hàng.');
      } finally { running = false; if (!disposed) setLoading(false); }
    }
    void load();
    window.addEventListener('booths-changed', load);
    return () => { disposed = true; controller.abort(); window.removeEventListener('booths-changed', load); };
  }, [organizationId, enabled, revision]);
  return { booths, bookings, loading, error, refresh };
}
