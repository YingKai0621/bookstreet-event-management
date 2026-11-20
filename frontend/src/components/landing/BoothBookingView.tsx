import { RefreshCw, Search, Store, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useModalDismiss } from '../../hooks/useModalDismiss';
import { bookingStatusLabels, boothStatusLabels, notifyBoothsChanged, type useBoothData } from '../../services/booths';
import { apiRequest } from '../../services/facilities';
import '../admin/FacilityManagementView.css';
import './BoothBookingView.css';

type Action = { id: string; name: string; action: 'book' | 'approve' | 'reject' | 'cancel' };
const actionLabels = { book: 'Đăng ký gian hàng', approve: 'Duyệt đăng ký', reject: 'Từ chối đăng ký', cancel: 'Hủy đăng ký' };
export function BoothBookingView({ data, organization }: {
  data: ReturnType<typeof useBoothData>;
  organization?: { id: string; name: string };
}) {
  const { booths, bookings, loading, error, refresh } = data;
  const [search, setSearch] = useState('');
  const [campus, setCampus] = useState('');
  const [status, setStatus] = useState('');
  const [action, setAction] = useState<Action | null>(null);
  const [saving, setSaving] = useState(false);
  useModalDismiss(Boolean(action), () => { if (!saving) setAction(null); });
  const [actionError, setActionError] = useState('');
  const [notice, setNotice] = useState('');
  const dialog = useRef<HTMLDialogElement>(null);
  const activeBooking = organization ? bookings.find(b => b.status === 'pending' || b.status === 'approved') : undefined;
  const key = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/gi, 'd').toLowerCase();
  const filtered = booths.filter(b => key(b.name).includes(key(search.trim())) && (!campus || campus === b.campus) && (!status || status === b.status));
  useEffect(() => { if (action) dialog.current?.showModal(); else dialog.current?.close(); }, [action]);
  function open(next: Action) { setActionError(''); setNotice(''); setAction(next); }
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!action || saving) return;
    setSaving(true); setActionError('');
    try {
      if (action.action === 'book' && organization) {
        await apiRequest('/partner/booth-bookings', { method: 'POST', body: JSON.stringify({ boothId: action.id, organizationId: organization.id, organizationName: organization.name }) });
      } else {
        await apiRequest(`/${organization ? 'partner' : 'admin'}/booth-bookings/${action.id}/${action.action}`, { method: 'POST', body: JSON.stringify(organization ? { organizationId: organization.id } : {}) });
      }
      setNotice(action.action === 'book' ? 'Đã gửi đăng ký. Gian hàng được giữ chỗ trong lúc chờ Organizer duyệt.' : 'Đã cập nhật đăng ký thành công.');
      setAction(null); notifyBoothsChanged(); refresh();
    } catch (err) { setActionError(err instanceof Error ? err.message : 'Không thể xử lý yêu cầu.'); refresh(); }
    finally { setSaving(false); }
  }
  return <section className="facility-page">
    <header className="facility-heading"><div><span className="facility-eyebrow">GIAN HÀNG & ĐĂNG KÝ</span><h1>{organization ? 'Đăng ký gian hàng' : 'Quản lý đăng ký gian hàng'}</h1><p>{organization ? 'Chọn gian hàng còn trống và gửi yêu cầu đến Ban quản lý. Mỗi tổ chức có một gian hàng đang đăng ký hoặc sử dụng.' : 'Gian hàng mới được mở trống. Duyệt đăng ký của đối tác để phân bổ gian hàng.'}</p></div><button className="facility-button" onClick={refresh}><RefreshCw size={17} />Tải lại</button></header>
    <div className="booth-workflow" aria-label="Quy trình đăng ký"><span>1. Còn trống</span><span>→</span><span>2. Chờ duyệt</span><span>→</span><span>3. Đã phân bổ</span></div>
    {notice && <div className="facility-notice" role="status">{notice}</div>}
    {error ? <div className="facility-error" role="alert">{error} <button className="facility-button" onClick={refresh}>Thử lại</button></div> : loading ? <div className="facility-empty" role="status">Đang tải gian hàng…</div> : <>
      {activeBooking && <div className="booth-current"><Store size={24} /><div><strong>{activeBooking.boothName}</strong><p>{activeBooking.campus} · {bookingStatusLabels[activeBooking.status]}</p></div><button className="facility-button" onClick={() => open({ id: activeBooking.id, name: activeBooking.boothName, action: 'cancel' })}>Hủy đăng ký</button></div>}
      <div className="facility-summary booth-summary">{(['available', 'pending', 'assigned'] as const).map(value => <div className="facility-stat" key={value}><span className="facility-stat-icon"><Store size={22} /></span><div><span>{boothStatusLabels[value]}</span><strong>{booths.filter(b => b.status === value).length}<small>gian hàng</small></strong></div></div>)}</div>
      <div className="facility-panel">
        <div className="facility-toolbar"><label className="facility-search"><Search size={18} /><input aria-label="Tìm gian hàng" placeholder="Tìm theo tên gian hàng…" value={search} onChange={e => setSearch(e.target.value)} /></label><label className="facility-filter"><select aria-label="Lọc cơ sở" value={campus} onChange={e => setCampus(e.target.value)}><option value="">Tất cả cơ sở</option>{[...new Set(booths.map(b => b.campus))].map(c => <option key={c}>{c}</option>)}</select></label><label className="facility-filter"><select aria-label="Lọc trạng thái" value={status} onChange={e => setStatus(e.target.value)}><option value="">Tất cả trạng thái</option>{Object.entries(boothStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label></div>
        <div className="facility-table-scroll"><table><thead><tr><th>Tên gian hàng</th><th>Cơ sở</th><th>Trạng thái</th><th>{organization ? 'Đăng ký' : 'Đơn vị đăng ký'}</th></tr></thead><tbody>{filtered.map(booth => {
          const booking = bookings.find(b => b.boothId === booth.id && (b.status === 'pending' || b.status === 'approved'));
          return <tr key={booth.id}><td><strong>{booth.name}</strong></td><td>{booth.campus}</td><td><span className={`booth-status ${booth.status}`}>{boothStatusLabels[booth.status]}</span></td><td>{organization ? <button className="facility-button primary" disabled={booth.status !== 'available' || !!activeBooking} onClick={() => open({ id: booth.id, name: booth.name, action: 'book' })}>{booking ? 'Đã đăng ký' : 'Đăng ký'}</button> : booking?.organizationName || 'Chưa có'}</td></tr>;
        })}</tbody></table></div>
        {filtered.length === 0 && <div className="facility-empty">{booths.length ? 'Không tìm thấy gian hàng phù hợp.' : 'Chưa có gian hàng. Gian hàng do Admin tạo sẽ xuất hiện tại đây.'}</div>}
        <footer className="facility-table-footer">{filtered.length} gian hàng · Tự cập nhật mỗi 5 giây</footer>
      </div>
      <h2 className="booth-history-title">{organization ? 'Lịch sử đăng ký của bạn' : 'Yêu cầu đăng ký và lịch sử xử lý'}</h2>
      <div className="facility-panel"><div className="facility-table-scroll"><table><thead><tr><th>Gian hàng</th>{!organization && <th>Tổ chức</th>}<th>Ngày đăng ký</th><th>Trạng thái</th><th>Thao tác</th></tr></thead><tbody>{bookings.map(booking => <tr key={booking.id}><td><strong>{booking.boothName}</strong><div className="facility-muted">{booking.campus}</div></td>{!organization && <td>{booking.organizationName}</td>}<td>{new Date(booking.createdAt).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' })}</td><td>{bookingStatusLabels[booking.status]}</td><td><div className="booth-booking-actions">{!organization && booking.status === 'pending' ? <><button className="facility-button primary" onClick={() => open({ id: booking.id, name: booking.boothName, action: 'approve' })}>Duyệt</button><button className="facility-button" onClick={() => open({ id: booking.id, name: booking.boothName, action: 'reject' })}>Từ chối</button></> : organization && ['pending', 'approved'].includes(booking.status) ? <button className="facility-button" onClick={() => open({ id: booking.id, name: booking.boothName, action: 'cancel' })}>Hủy</button> : '—'}</div></td></tr>)}</tbody></table></div>{bookings.length === 0 && <div className="facility-empty">Chưa có yêu cầu đăng ký.</div>}</div>
    </>}
    <dialog ref={dialog} className="facility-dialog" aria-labelledby="booking-dialog-title" onCancel={event => { event.preventDefault(); if (!saving) setAction(null); }}><form onSubmit={submit}><div className="facility-dialog-heading"><h2 id="booking-dialog-title">{action && actionLabels[action.action]}</h2><button type="button" className="facility-close" aria-label="Đóng" disabled={saving} onClick={() => setAction(null)}><X size={20} /></button></div><p className="facility-delete-copy"><strong>{action?.name}</strong><br />{action?.action === 'book' ? `Đăng ký cho ${organization?.name}. Gian hàng sẽ chuyển sang chờ duyệt và chưa được phân bổ cho đến khi Organizer chấp thuận.` : action?.action === 'approve' ? 'Phân bổ gian hàng cho tổ chức đã đăng ký?' : 'Gian hàng sẽ trở về trạng thái còn trống. Lịch sử đăng ký vẫn được giữ lại.'}</p>{actionError && <p className="facility-error" role="alert">{actionError}</p>}<div className="facility-dialog-footer"><button type="button" className="facility-button" disabled={saving} onClick={() => setAction(null)}>Quay lại</button><button className="facility-button primary" disabled={saving}>{saving ? 'Đang xử lý…' : 'Xác nhận'}</button></div></form></dialog>
  </section>;
}
