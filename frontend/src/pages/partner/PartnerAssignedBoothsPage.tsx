import { PaginatedList } from '../../components/ui/PaginatedList';
import { PartnerFilterSelect } from '../../components/partner/PartnerFilterSelect';
import { SearchFieldLabel } from '../../components/ui/SearchFieldLabel';
import {
  AlertCircle,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Clock3,
  ExternalLink,
  Loader2,
  MapPin,
  QrCode,
  RefreshCw,
  Search,
  Store,
  X,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useModalDismiss } from '../../hooks/useModalDismiss';
import { useBackdropClick } from '../../hooks/useBackdropClick';
import { ApiError } from '../../services/apiClient';
import { boothApi } from '../../services/boothApi';
import { paymentApi } from '../../services/paymentApi';
import { boothScanUrl } from '../../security/boothScanToken';
import type { Language, PartnerEventApplication } from '../../types';
import type { BoothRequest } from '../../types/booth';
import type { BoothAssignment } from '../../types/payment';
import './PartnerAssignedBoothsPage.css';

interface Props {
  language: Language;
  applications: PartnerEventApplication[];
}

type TimedEventPhase = 'upcoming' | 'ongoing' | 'past';
type EventPhase = TimedEventPhase | 'unknown';
type PhaseFilter = 'all' | TimedEventPhase;

interface AssignedBoothItem {
  request: BoothRequest;
  assignment: BoothAssignment;
}

const timedPhases: TimedEventPhase[] = ['upcoming', 'ongoing', 'past'];

const phaseMeta: Record<EventPhase, { label: string; description: string }> = {
  upcoming: { label: 'Sắp diễn ra', description: 'Gian hàng thuộc các sự kiện sắp tổ chức' },
  ongoing: { label: 'Đang diễn ra', description: 'Gian hàng thuộc các sự kiện đang diễn ra' },
  past: { label: 'Đã kết thúc', description: 'Lịch sử gian hàng tại các sự kiện đã kết thúc' },
  unknown: { label: 'Chưa xác định', description: 'Lịch sự kiện đang được cập nhật' },
};

function messageFrom(error: unknown): string {
  if (error instanceof ApiError) {
    return error.fieldErrors.map(item => item.message).filter(Boolean).join(' ') || error.message;
  }
  return error instanceof Error ? error.message : 'Không thể tải danh sách gian hàng đã được cấp.';
}

function money(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return 'Chưa có thông tin';
  if (value === 0) return 'Miễn phí';
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value);
}

function dateTime(value: string | null | undefined): string {
  if (!value) return 'Đang cập nhật';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'Đang cập nhật';
  return parsed.toLocaleString('vi-VN', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
    timeZone: 'Asia/Ho_Chi_Minh',
  });
}

function phaseFor(application: PartnerEventApplication | undefined, now: number): EventPhase {
  const startAt = application?.startAt ? new Date(application.startAt).getTime() : Number.NaN;
  const endAt = application?.endAt ? new Date(application.endAt).getTime() : Number.NaN;

  if (Number.isFinite(endAt) && endAt < now) return 'past';
  if (Number.isFinite(startAt) && startAt > now) return 'upcoming';
  if (Number.isFinite(startAt) && Number.isFinite(endAt) && startAt <= now && endAt >= now) return 'ongoing';
  return 'unknown';
}

function eventDate(application: PartnerEventApplication | undefined): string {
  const hasValidStart = application?.startAt && Number.isFinite(new Date(application.startAt).getTime());
  const hasValidEnd = application?.endAt && Number.isFinite(new Date(application.endAt).getTime());
  if (hasValidStart && hasValidEnd) {
    return `${dateTime(application.startAt)} – ${dateTime(application.endAt)}`;
  }
  if (hasValidStart) return `Bắt đầu ${dateTime(application?.startAt)}`;
  if (hasValidEnd) return `Kết thúc ${dateTime(application?.endAt)}`;
  return application?.dateRange?.trim() || 'Lịch sự kiện đang cập nhật';
}

export const PartnerAssignedBoothsPage: React.FC<Props> = ({ language, applications }) => {
  const [items, setItems] = useState<AssignedBoothItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [filter, setFilter] = useState<PhaseFilter>('all');
  const [search, setSearch] = useState('');
  const [selectedItem, setSelectedItem] = useState<AssignedBoothItem | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const loadGenerationRef = useRef(0);

  useModalDismiss(Boolean(selectedItem), () => setSelectedItem(null));
  const detailBackdropHandlers = useBackdropClick(() => setSelectedItem(null));

  const applicationByEvent = useMemo(
    () => new Map(applications.map(application => [Number(application.eventId), application])),
    [applications],
  );

  const loadAssignments = useCallback(async () => {
    const generation = ++loadGenerationRef.current;
    try {
      const requests = await boothApi.listAllPartnerRequests(undefined, 'COMPLETED');
      const results = await Promise.allSettled(
        requests.map(async request => ({
          request,
          assignment: await paymentApi.getAssignment(request.boothRequestId),
        })),
      );
      if (generation !== loadGenerationRef.current) return;

      const loaded = results.flatMap(result => result.status === 'fulfilled' ? [result.value] : []);
      const failedCount = results.length - loaded.length;
      setItems(loaded.sort((left, right) =>
        new Date(right.assignment.assignedAt).getTime() - new Date(left.assignment.assignedAt).getTime(),
      ));
      if (failedCount > 0) {
        setNotice(`${failedCount} gian hàng chưa thể tải chi tiết. Hãy thử làm mới sau ít phút.`);
      }
    } catch (caughtError) {
      if (generation !== loadGenerationRef.current) return;
      setItems([]);
      setError(messageFrom(caughtError));
    } finally {
      if (generation === loadGenerationRef.current) setLoading(false);
    }
  }, []);

  const refreshAssignments = () => {
    setLoading(true);
    setError('');
    setNotice('');
    void loadAssignments();
  };

  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect -- The guarded async loader owns this initial remote-data request.
    void loadAssignments();
    return () => { loadGenerationRef.current += 1; };
  }, [loadAssignments]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const enrichedItems = useMemo(() => items.map(item => {
    const application = applicationByEvent.get(item.assignment.eventId);
    return { ...item, application, phase: phaseFor(application, now) };
  }), [applicationByEvent, items, now]);

  const counts = useMemo(() => ({
    upcoming: enrichedItems.filter(item => item.phase === 'upcoming').length,
    ongoing: enrichedItems.filter(item => item.phase === 'ongoing').length,
    past: enrichedItems.filter(item => item.phase === 'past').length,
  }), [enrichedItems]);

  const visibleItems = useMemo(() => {
    const keyword = search.trim().toLocaleLowerCase('vi');
    return enrichedItems.filter(item => {
      if (filter !== 'all' && item.phase !== filter) return false;
      if (!keyword) return true;
      const eventTitle = item.application?.eventTitle || `Sự kiện #${item.assignment.eventId}`;
      return [item.assignment.boothCode, eventTitle, item.assignment.partnerOrganizationName]
        .some(value => value.toLocaleLowerCase('vi').includes(keyword));
    });
  }, [enrichedItems, filter, search]);

  const selectedApplication = selectedItem
    ? applicationByEvent.get(selectedItem.assignment.eventId)
    : undefined;

  return (
    <section className="partner-page my-booths-page" aria-labelledby="my-booths-title">
      <header className="my-booths-hero">
        <div className="my-booths-hero-copy">

          <h1 id="my-booths-title" className="workspace-page-title">{language === 'vi' ? 'Gian hàng của tôi' : 'My booths'}</h1>
          <p className="workspace-page-subtitle">Quản lý gian hàng đã được cấp, xem mã QR và theo dõi hoạt động tại từng sự kiện.</p>
        </div>
        <button type="button" className="my-booths-refresh" onClick={refreshAssignments} disabled={loading}>
          <RefreshCw size={16} className={loading ? 'my-booths-spin' : ''} />
          {loading ? 'Đang cập nhật…' : 'Làm mới'}
        </button>
      </header>

      <div className="my-booths-summary" aria-label="Tổng quan gian hàng theo thời gian sự kiện">
        {timedPhases.map(phase => (
          <button
            type="button"
            key={phase}
            className={`my-booths-summary-card is-${phase} ${filter === phase ? 'is-active' : ''}`}
            onClick={() => setFilter(current => current === phase ? 'all' : phase)}
            aria-pressed={filter === phase}
          >
            <span className="my-booths-summary-icon">
              {phase === 'upcoming' ? <CalendarDays size={20} /> : phase === 'ongoing' ? <Clock3 size={20} /> : <CheckCircle2 size={20} />}
            </span>
            <span className="my-booths-summary-copy">
              <strong>{counts[phase]}</strong>
              <span>{phaseMeta[phase].label}</span>
              <small>{phaseMeta[phase].description}</small>
            </span>
          </button>
        ))}
      </div>

      {error && (
        <div className="my-booths-alert is-error" role="alert">
          <AlertCircle size={18} />
          <span>{error}</span>
          <button type="button" onClick={refreshAssignments}>Thử lại</button>
        </div>
      )}
      {notice && <div className="my-booths-alert" role="status"><AlertCircle size={18} />{notice}</div>}

      <div className="my-booths-toolbar">
        <SearchFieldLabel className="my-booths-search-group"><div className="my-booths-search">
          <Search size={17} />
          <input
            type="search"
            value={search}
            onChange={event => setSearch(event.target.value)}
            placeholder="Tìm theo mã gian hàng hoặc tên sự kiện..."
            aria-label="Tìm gian hàng đã được cấp"
          />
          {search && <button type="button" onClick={() => setSearch('')} aria-label="Xóa từ khóa tìm kiếm"><X size={15} /></button>}
        </div></SearchFieldLabel>
        <PartnerFilterSelect label="Thời gian sự kiện" ariaLabel="Lọc theo thời gian sự kiện" icon={CalendarDays} value={filter} options={[{ value: 'all', label: 'Tất cả thời gian' }, ...timedPhases.map(phase => ({ value: phase, label: phaseMeta[phase].label }))]} onChange={setFilter} />
      </div>

      <div className="my-booths-list-heading">
        <div>

          <h2>Gian hàng đã được cấp</h2>
        </div>
        <p><strong>{visibleItems.length}</strong> / {items.length} gian hàng</p>
      </div>

      {loading && !items.length ? (
        <div className="my-booths-loading" role="status">
          <Loader2 size={28} className="my-booths-spin" />
          <strong>Đang tải gian hàng của bạn…</strong>
          <span>Hệ thống đang đối chiếu các yêu cầu đã hoàn tất với thông tin cấp gian.</span>
        </div>
      ) : !items.length && !error ? (
        <div className="my-booths-empty">
          <span className="my-booths-empty-icon"><Store size={32} /></span>
          <h2>Bạn chưa có gian hàng được cấp</h2>
          <p>Khi yêu cầu được chọn và hoàn tất thanh toán, gian hàng cùng mã QR sẽ xuất hiện tại đây.</p>
          <Link to="/partner/booth-requests" className="my-booths-primary-link">
            Xem sơ đồ và yêu cầu gian hàng <ArrowRight size={16} />
          </Link>
        </div>
      ) : visibleItems.length === 0 ? (
        <div className="my-booths-empty is-compact">
          <Search size={28} />
          <h2>Không tìm thấy gian hàng phù hợp</h2>
          <p>Hãy thử từ khóa khác hoặc hiển thị lại tất cả thời gian sự kiện.</p>
          <button type="button" onClick={() => { setSearch(''); setFilter('all'); }}>Xóa bộ lọc</button>
        </div>
      ) : (
        <PaginatedList items={visibleItems} pageSize={6}>{pageItems => (<div className="my-booths-grid">
          {pageItems.map(item => {
            const application = item.application;
            const eventTitle = application?.eventTitle || `Sự kiện #${item.assignment.eventId}`;
            const mapLink = `/partner/booth-requests?eventId=${item.assignment.eventId}&boothId=${item.assignment.boothId}`;
            return (
              <article className={`my-booth-card is-${item.phase}`} key={item.assignment.boothAssignmentId}>
                <div className="my-booth-content">
                  <div className="my-booth-title-row">
                    <div>
                      <span className="my-booth-kicker">Mã gian hàng</span>
                      <h2>Gian {item.assignment.boothCode}</h2>
                    </div>
                    <div className="my-booth-statuses">
                      <span className={`my-booth-active-status is-${item.assignment.status.toLocaleLowerCase('vi')}`}>
                        {item.assignment.status === 'ACTIVE' ? <CheckCircle2 size={14} /> : <Clock3 size={14} />}
                        {item.assignment.status === 'ACTIVE' ? 'Đã cấp' : 'Đã giải phóng'}
                      </span>
                      <span className={`my-booth-phase is-${item.phase}`}>{phaseMeta[item.phase].label}</span>
                    </div>
                  </div>

                  <div className="my-booth-event">
                    <span className="my-booth-event-label">Sự kiện</span>
                    <strong>{eventTitle}</strong>
                    <span><CalendarDays size={14} />{eventDate(application)}</span>
                  </div>

                  <dl className="my-booth-details">
                    <div><dt>Giá thuê đã khóa</dt><dd>{money(item.assignment.lockedRentalPrice)}</dd></div>
                    <div><dt>Ngày được cấp gian hàng</dt><dd>{dateTime(item.assignment.assignedAt)}</dd></div>
                  </dl>

                  <div className="my-booth-actions">
                    <button type="button" className="my-booth-qr-button" onClick={() => setSelectedItem(item)}>
                      <QrCode size={16} /> Xem QR
                    </button>
                    <Link
                      className={item.phase === 'past' || item.phase === 'unknown' ? 'is-primary' : ''}
                      to={`/partner/booths/${item.request.boothRequestId}`}
                    >
                      Chi tiết <ExternalLink size={14} />
                    </Link>
                    <Link className={item.phase === 'upcoming' ? 'is-primary' : ''} to={mapLink}>
                      <MapPin size={14} /> Bản đồ
                    </Link>
                    {item.phase !== 'past' && (
                      <Link
                        to={`/partner/activities?eventId=${item.assignment.eventId}`}
                        className={`my-booth-activity-link ${item.phase === 'ongoing' ? 'is-primary' : ''}`}
                      >
                        Quản lý hoạt động <ArrowRight size={15} />
                      </Link>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>)}</PaginatedList>
      )}

      {selectedItem && (
        <div className="my-booths-modal-backdrop" {...detailBackdropHandlers}>
          <section
            className="my-booths-qr-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="my-booth-qr-title"
            onClick={event => event.stopPropagation()}
          >
            <button type="button" className="my-booths-modal-close" onClick={() => setSelectedItem(null)} aria-label="Đóng mã QR">
              <X size={20} />
            </button>
            <span className="my-booths-modal-icon"><QrCode size={22} /></span>

            <h2 id="my-booth-qr-title">Gian {selectedItem.assignment.boothCode}</h2>
            <p>{selectedApplication?.eventTitle || `Sự kiện #${selectedItem.assignment.eventId}`}</p>
            <div className="my-booths-qr-frame">
              <QRCodeSVG
                value={boothScanUrl(selectedItem.assignment.qrToken)}
                size={190}
                title={`Mã QR gian hàng ${selectedItem.assignment.boothCode}`}
              />
            </div>
            <div className="my-booths-qr-note">
              <CheckCircle2 size={17} />
              <span>Mã QR dành cho độc giả quét tại gian hàng để ghi nhận lượt ghé và nhận điểm.</span>
            </div>
            <Link to={`/partner/booths/${selectedItem.request.boothRequestId}`} className="my-booths-modal-detail">
              Xem đầy đủ thông tin cấp gian <ArrowRight size={16} />
            </Link>
          </section>
        </div>
      )}
    </section>
  );
};
