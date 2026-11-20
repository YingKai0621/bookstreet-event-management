import { PaginatedList } from '../../components/ui/PaginatedList';
import { useModalDismiss } from '../../hooks/useModalDismiss';
import { useBackdropClick } from '../../hooks/useBackdropClick';
import {
  AlertCircle,
  Calendar,
  Check,
  CheckCircle2,
  ChevronRight,
  CreditCard,
  DollarSign,
  Info,
  Loader2,
  MessageSquare,
  RefreshCw,
  Store,
  Tag,
  Users,
  X,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import '../../components/organizer/Sprint2Booth.css';
import { ApiError } from '../../services/apiClient';
import { boothApi } from '../../services/boothApi';
import type { Language, PartnerEventApplication } from '../../types';
import type { BoothRequest, EventBooth } from '../../types/booth';
import { BoothMapCanvas } from '../../components/booth-map/BoothMapCanvas';
import { eventBoothToMarker } from '../../components/booth-map/boothMapModel';
import { BoothPaymentCheckoutCard } from '../../components/partner/BoothPaymentCheckoutCard';
import { PartnerDialog } from '../../components/partner/PartnerDialog';
import { usePartnerOrganizationLocked } from './PartnerOrganizationStatusContext';
import './PartnerPages.css';

interface Props {
  language: Language;
  applications: PartnerEventApplication[];
  allRequests: BoothRequest[] | null;
  onRefreshData: () => void;
}

interface WithdrawConflict {
  title: string;
  message: string;
  requestId: number;
  showPaymentLink: boolean;
}

const CATEGORY_LABEL: Record<string, string> = {
  MANGA_COMICS: 'Truyện tranh & Manga',
  LITERATURE: 'Văn học & Nghệ thuật',
  TECHNOLOGY_SCIENCE: 'Công nghệ & Khởi nghiệp',
  CHILDREN: 'Sách Thiếu nhi',
  ART_CULTURE: 'Nghệ thuật & Văn hóa',
  HISTORY_SOCIETY: 'Lịch sử & Xã hội',
  LIFESTYLE_EDUCATION: 'Đời sống & Giáo dục',
};

const availabilityLabel: Record<EventBooth['availability'], string> = {
  AVAILABLE: 'Còn trống',
  ON_HOLD: 'Đang giữ chỗ',
  ASSIGNED: 'Đã thuê',
  UNAVAILABLE: 'Không mở bán',
};

const requestStatusLabel: Record<BoothRequest['status'], string> = {
  PENDING: 'Chờ duyệt',
  SELECTED: 'Đã được chọn',
  COMPLETED: 'Hoàn tất',
  PAYMENT_EXPIRED: 'Hết hạn giữ chỗ',
  NOT_SELECTED: 'Không được chọn',
  REJECTED: 'Đã từ chối',
  WITHDRAWN: 'Đã rút',
  CANCELLED: 'Sự kiện đã hủy',
};

function apiMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.code === 'PARTNER_ORGANIZATION_INACTIVE') {
      return 'Tổ chức đang bị khóa; hiện không thể gửi yêu cầu mới.';
    }
    if (error.code === 'BOOTH_REQUEST_DEADLINE_PASSED') {
      return 'Đã hết hạn gửi yêu cầu thuê gian hàng cho sự kiện này.';
    }
    return error.fieldErrors.map(item => item.message).filter(Boolean).join(' ') || error.message;
  }
  return error instanceof Error ? error.message : 'Không thể hoàn tất thao tác.';
}

function withdrawConflict(error: ApiError, requestId: number): WithdrawConflict | null {
  switch (error.code) {
    case 'PAYMENT_ATTEMPT_ALREADY_PENDING':
      return {
        title: 'Phiên thanh toán vẫn đang mở',
        message: 'Gian hàng chưa thể được giải phóng vì bạn đang có một phiên thanh toán còn hiệu lực. Hãy tiếp tục thanh toán hoặc chờ hệ thống xác minh kết quả.',
        requestId,
        showPaymentLink: true,
      };
    case 'PAYMENT_RESULT_UNKNOWN':
      return {
        title: 'Thanh toán đang được xác minh',
        message: 'Hệ thống chưa thể xác định chắc chắn kết quả thanh toán. Giữ chỗ sẽ được bảo toàn để tránh mất tiền hoặc cấp gian hàng sai. Vui lòng kiểm tra lại chi tiết thanh toán sau.',
        requestId,
        showPaymentLink: true,
      };
    case 'PAYMENT_ALREADY_COMPLETED':
    case 'BOOTH_ALREADY_ASSIGNED':
      return {
        title: 'Gian hàng đã được cấp',
        message: 'Yêu cầu này đã hoàn tất thanh toán hoặc đã được cấp gian hàng nên không còn thuộc luồng giải phóng trước thanh toán.',
        requestId,
        showPaymentLink: true,
      };
    case 'BOOTH_HOLD_NOT_ACTIVE':
      return {
        title: 'Giữ chỗ không còn hiệu lực',
        message: 'Trạng thái giữ chỗ vừa thay đổi. Hãy đóng thông báo và làm mới dữ liệu trước khi tiếp tục.',
        requestId,
        showPaymentLink: false,
      };
    case 'BOOTH_REQUEST_NOT_WITHDRAWABLE':
      return {
        title: 'Không thể rút yêu cầu',
        message: 'Yêu cầu không còn ở trạng thái chờ duyệt hoặc chờ thanh toán nên không thể rút tại thời điểm này.',
        requestId,
        showPaymentLink: false,
      };
    default:
      return null;
  }
}

function money(value: number | null): string {
  if (value === null) return 'Chưa cấu hình';
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value);
}

function dateTime(value: string | null | undefined): string {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'Đang cập nhật';
  return parsed.toLocaleString('vi-VN', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
    timeZone: 'Asia/Ho_Chi_Minh',
  });
}

function eventSchedule(application: PartnerEventApplication | undefined): string {
  const validStart = application?.startAt && Number.isFinite(new Date(application.startAt).getTime());
  const validEnd = application?.endAt && Number.isFinite(new Date(application.endAt).getTime());
  if (validStart && validEnd) return `${dateTime(application?.startAt)} – ${dateTime(application?.endAt)}`;
  if (validStart) return `Bắt đầu ${dateTime(application?.startAt)}`;
  if (validEnd) return `Kết thúc ${dateTime(application?.endAt)}`;
  return application?.dateRange?.trim() || 'Lịch sự kiện đang cập nhật';
}

function normalizeEventSearch(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLocaleLowerCase('vi-VN');
}

type RequestProgressState = 'complete' | 'current' | 'future' | 'terminal-danger' | 'terminal-neutral';

interface RequestProgressStep {
  key: string;
  label: string;
  state: RequestProgressState;
  occurredAt?: string | null;
}

function requestProgress(request: BoothRequest): RequestProgressStep[] {
  const submitted: RequestProgressStep = {
    key: 'submitted',
    label: 'Đã gửi',
    state: 'complete',
    occurredAt: request.submittedAt,
  };
  const selected: RequestProgressStep = {
    key: 'selected',
    label: 'Đã được chọn',
    state: 'complete',
    occurredAt: request.selectedAt || request.reviewedAt,
  };

  switch (request.status) {
    case 'PENDING':
      return [
        submitted,
        { key: 'review', label: 'Chờ xét duyệt', state: 'current' },
        { key: 'payment', label: 'Thanh toán', state: 'future' },
        { key: 'allocation', label: 'Cấp gian hàng', state: 'future' },
      ];
    case 'SELECTED':
      return [
        submitted,
        selected,
        { key: 'payment', label: 'Chờ thanh toán', state: 'current' },
        { key: 'allocation', label: 'Cấp gian hàng', state: 'future' },
      ];
    case 'COMPLETED':
      return [
        submitted,
        selected,
        {
          key: 'settlement',
          label: request.hold?.lockedRentalPrice === 0
            ? 'Đã xác nhận miễn phí'
            : request.hold ? 'Đã thanh toán' : 'Đã hoàn tất thủ tục',
          state: 'complete',
          occurredAt: request.completedAt,
        },
        { key: 'allocation', label: 'Đã cấp gian', state: 'complete', occurredAt: request.completedAt },
      ];
    case 'PAYMENT_EXPIRED':
      return [
        submitted,
        selected,
        { key: 'expired', label: 'Hết hạn thanh toán', state: 'terminal-danger', occurredAt: request.paymentExpiredAt },
      ];
    case 'REJECTED':
      return [submitted, { key: 'rejected', label: 'Đã từ chối', state: 'terminal-danger', occurredAt: request.reviewedAt }];
    case 'NOT_SELECTED':
      return [submitted, { key: 'not-selected', label: 'Không được chọn', state: 'terminal-neutral', occurredAt: request.completedAt }];
    case 'WITHDRAWN':
      return [
        submitted,
        ...(request.selectedAt ? [selected] : []),
        { key: 'withdrawn', label: request.selectedAt ? 'Đã rút & giải phóng' : 'Đã rút yêu cầu', state: 'terminal-neutral' as const, occurredAt: request.withdrawnAt },
      ];
    case 'CANCELLED':
      return [
        submitted,
        ...(request.selectedAt ? [selected] : []),
        { key: 'cancelled', label: 'Dừng do sự kiện hủy', state: 'terminal-neutral' as const, occurredAt: request.cancelledAt },
      ];
  }
}

const progressStateLabel: Record<RequestProgressState, string> = {
  complete: 'Đã hoàn thành',
  current: 'Bước hiện tại',
  future: 'Chưa diễn ra',
  'terminal-danger': 'Đã kết thúc',
  'terminal-neutral': 'Đã kết thúc',
};

function holdStatusLabel(status: NonNullable<BoothRequest['hold']>['status']): string {
  if (status === 'CONSUMED') return 'Đã cấp gian hàng';
  if (status === 'EXPIRED') return 'Đã hết hạn giữ chỗ';
  if (status === 'RELEASED') return 'Đã giải phóng';
  return 'Đang giữ chỗ';
}

export const Sprint2PartnerBoothsPage: React.FC<Props> = ({ applications, allRequests, onRefreshData }) => {
  const organizationLocked = usePartnerOrganizationLocked();
  const [searchParams, setSearchParams] = useSearchParams();
  const approvedApplications = useMemo(
    () => applications.filter(application => application.status === 'approved'),
    [applications],
  );
  const boothEligibleApplications = useMemo(
    () => approvedApplications.filter(application =>
      application.eventAvailable !== false
      && application.eventStatus !== 'COMPLETED'
      && application.eventStatus !== 'CANCELLED'),
    [approvedApplications],
  );
  const requestCountsByEvent = useMemo(() => {
    const counts = new Map<string, number>();
    for (const request of allRequests || []) {
      const requestEventId = String(request.eventId);
      counts.set(requestEventId, (counts.get(requestEventId) || 0) + 1);
    }
    return counts;
  }, [allRequests]);
  const requestedEventId = searchParams.get('eventId') || '';
  const tab: 'browse' | 'requests' = searchParams.get('view') === 'requests' ? 'requests' : 'browse';
  const setTab = useCallback((nextTab: 'browse' | 'requests', replace = false) => {
    const next = new URLSearchParams(searchParams);
    if (nextTab === 'browse') next.delete('view');
    else next.set('view', 'requests');
    setSearchParams(next, { replace });
  }, [searchParams, setSearchParams]);
  const [booths, setBooths] = useState<EventBooth[]>([]);
  const [requests, setRequests] = useState<BoothRequest[]>([]);
  const [selectedBooth, setSelectedBooth] = useState<EventBooth | null>(null);
  const [withdrawTarget, setWithdrawTarget] = useState<BoothRequest | null>(null);
  const [withdrawBlocked, setWithdrawBlocked] = useState<WithdrawConflict | null>(null);
  const [quotaExceeded, setQuotaExceeded] = useState<{ boothCode: string; eventTitle: string } | null>(null);
  const [requestNote, setRequestNote] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [eventSearch, setEventSearch] = useState('');
  const requestScope: 'event' | 'all' = searchParams.get('scope') === 'all' ? 'all' : 'event';
  const setRequestScope = useCallback((scope: 'event' | 'all') => {
    const next = new URLSearchParams(searchParams);
    if (scope === 'all') next.set('scope', 'all');
    else next.delete('scope');
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);
  const [now, setNow] = useState(0);
  useModalDismiss(Boolean(selectedBooth), () => { if (busy !== 'submit') setSelectedBooth(null); });
  const boothBackdropHandlers = useBackdropClick(() => { if (busy !== 'submit') setSelectedBooth(null); });

  const eventId = boothEligibleApplications.some(application => application.eventId === requestedEventId)
    ? requestedEventId
    : boothEligibleApplications[0]?.eventId || '';
  const selectedApplication = boothEligibleApplications.find(application => application.eventId === eventId);
  const alternativeRequestApplication = boothEligibleApplications.find(application =>
    application.eventId !== eventId && (requestCountsByEvent.get(application.eventId) || 0) > 0,
  );
  const filteredApplications = useMemo(() => {
    const normalizedSearch = normalizeEventSearch(eventSearch);
    if (!normalizedSearch) return boothEligibleApplications;
    return boothEligibleApplications.filter(application =>
      normalizeEventSearch(application.eventTitle).includes(normalizedSearch));
  }, [boothEligibleApplications, eventSearch]);
  const enabledBoothCount = useMemo(
    () => booths.filter(booth => booth.enabled).length,
    [booths],
  );
  const loadGenerationRef = useRef(0);
  const currentEventIdRef = useRef(eventId);
  const handledDeepLinkRef = useRef('');

  useEffect(() => {
    currentEventIdRef.current = eventId;
  }, [eventId]);

  useEffect(() => {
    const normalized = new URLSearchParams();
    if (eventId) normalized.set('eventId', eventId);
    if (tab === 'requests') normalized.set('view', 'requests');
    if (searchParams.get('scope') === 'all') normalized.set('scope', 'all');
    const boothId = Number.parseInt(searchParams.get('boothId') || '', 10);
    if (Number.isInteger(boothId) && boothId > 0) normalized.set('boothId', String(boothId));
    if (normalized.toString() !== new URLSearchParams(searchParams).toString()) {
      setSearchParams(normalized, { replace: true });
    }
  }, [eventId, searchParams, setSearchParams, tab]);

  const loadData = useCallback(async (clearCurrent = false) => {
    const requestedEventId = eventId;
    if (currentEventIdRef.current !== requestedEventId) return;
    const generation = ++loadGenerationRef.current;

    if (clearCurrent) {
      setBooths([]);
      setRequests([]);
      setSelectedBooth(null);
      setWithdrawTarget(null);
      setWithdrawBlocked(null);
      setRequestNote('');
      setSuccess('');
    }
    setError('');

    if (!requestedEventId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [eventBooths, ownRequests] = await Promise.all([
        boothApi.listAllPublicEventBooths(requestedEventId),
        boothApi.listAllPartnerRequests(requestedEventId),
      ]);
      if (generation !== loadGenerationRef.current || currentEventIdRef.current !== requestedEventId) return;
      setBooths(eventBooths);
      setRequests(ownRequests);
      setSelectedBooth(current => current
        ? eventBooths.find(item => item.booth.boothId === current.booth.boothId) || null
        : null);
    } catch (caughtError) {
      if (generation !== loadGenerationRef.current || currentEventIdRef.current !== requestedEventId) return;
      setBooths([]);
      setRequests([]);
      setError(apiMessage(caughtError));
    } finally {
      if (generation === loadGenerationRef.current && currentEventIdRef.current === requestedEventId) {
        setLoading(false);
      }
    }
  }, [eventId]);

  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect -- The generation-guarded loader resets and fetches data for the selected event.
    void loadData(true);
    return () => {
      loadGenerationRef.current += 1;
    };
  }, [loadData]);

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    const activeExpiries = requests
      .filter(request => request.hold?.status === 'ACTIVE')
      .map(request => new Date(request.hold!.expiresAt).getTime())
      .filter(expiresAt => expiresAt > Date.now());
    if (!activeExpiries.length) return;
    const delay = Math.min(...activeExpiries) - Date.now() + 1500;
    const timeout = window.setTimeout(() => void loadData(), Math.max(1000, delay));
    return () => window.clearTimeout(timeout);
  }, [loadData, requests]);

  const ownedBoothIds = useMemo(
    () => new Set(requests.filter(request => request.status === 'COMPLETED').map(request => request.boothId)),
    [requests],
  );

  const mapMarkers = useMemo(
    () => booths.flatMap(row => {
      const marker = eventBoothToMarker(row);
      return marker ? [{ ...marker, status: ownedBoothIds.has(row.booth.boothId) ? 'OWNED' as const : marker.status }] : [];
    }),
    [booths, ownedBoothIds],
  );

  const requestByBooth = useMemo(() => {
    const map = new Map<number, BoothRequest[]>();
    requests.forEach(request => map.set(request.boothId, [...(map.get(request.boothId) || []), request]));
    return map;
  }, [requests]);

  const requestBlockedReason = (row: EventBooth): string | null => {
    if (organizationLocked) return 'Tổ chức đang bị khóa; hiện không thể gửi yêu cầu gian hàng mới.';
    const history = requestByBooth.get(row.booth.boothId) || [];
    if (history.some(request => request.status === 'COMPLETED')) {
      return 'Đây là gian hàng đã được cấp cho bạn trong sự kiện này.';
    }
    if (row.availability !== 'AVAILABLE') {
      return `Gian hàng hiện ${availabilityLabel[row.availability].toLowerCase()}.`;
    }
    if (history.some(request => request.status === 'PENDING' || request.status === 'SELECTED')) {
      return 'Bạn đã có một yêu cầu đang mở cho gian hàng này.';
    }
    if (history.some(request => request.status === 'REJECTED')) {
      return 'Yêu cầu trước cho gian này đã bị từ chối và không thể gửi lại cho cùng gian hàng.';
    }
    return null;
  };

  useEffect(() => {
    const boothId = Number(searchParams.get('boothId'));
    if (!Number.isInteger(boothId) || boothId <= 0 || loading) return;
    const deepLinkKey = `${eventId}:${boothId}`;
    if (handledDeepLinkRef.current === deepLinkKey) return;
    const row = booths.find(item => item.booth.boothId === boothId);
    if (!row) return;
    handledDeepLinkRef.current = deepLinkKey;
    setTab('browse');
    // oxlint-disable-next-line react/set-state-in-effect -- A validated URL deep link selects its booth exactly once after data arrives.
    setSelectedBooth(row);
    setRequestNote('');
  }, [booths, eventId, loading, searchParams, setTab]);

  const submitRequest = async (submitEvent: React.FormEvent) => {
    submitEvent.preventDefault();
    if (organizationLocked) return;
    if (!selectedBooth || !eventId || requestBlockedReason(selectedBooth)) return;
    const requestedEventId = eventId;
    setBusy('submit');
    setError('');
    try {
      await boothApi.submitRequest(requestedEventId, selectedBooth.booth.boothId, requestNote.trim() || null);
      if (currentEventIdRef.current !== requestedEventId) return;
      setSelectedBooth(null);
      setRequestNote('');
      setSuccess(`Đã gửi yêu cầu đăng ký gian hàng ${selectedBooth.booth.code} thành công.`);
      setTab('requests');
      await loadData();
    } catch (caughtError) {
      if (caughtError instanceof ApiError && caughtError.code === 'BOOTH_QUOTA_EXCEEDED') {
        setSelectedBooth(null);
        setRequestNote('');
        setQuotaExceeded({
          boothCode: selectedBooth.booth.code,
          eventTitle: selectedApplication?.eventTitle || 'Sự kiện đang chọn',
        });
        return;
      }
      setError(apiMessage(caughtError));
    } finally {
      setBusy('');
    }
  };

  const withdraw = async (request: BoothRequest) => {
    const requestedEventId = eventId;
    setBusy(`withdraw-${request.boothRequestId}`);
    setError('');
    setSuccess('');
    try {
      await boothApi.withdrawRequest(request.boothRequestId);
      if (currentEventIdRef.current !== requestedEventId) return;
      setSuccess(request.status === 'SELECTED'
        ? 'Đã rút yêu cầu và giải phóng giữ chỗ gian hàng.'
        : 'Đã rút yêu cầu gian hàng.');
      setWithdrawTarget(null);
      onRefreshData();
      await loadData();
    } catch (caughtError) {
      if (caughtError instanceof ApiError) {
        const conflict = withdrawConflict(caughtError, request.boothRequestId);
        if (conflict) {
          setWithdrawTarget(null);
          setWithdrawBlocked(conflict);
          return;
        }
      }
      setWithdrawTarget(null);
      setError(apiMessage(caughtError));
    } finally {
      setBusy('');
    }
  };

  const eventTitleById = new Map(applications.map(application => [application.eventId, application.eventTitle]));
  const allScopeRequests = [...(allRequests || [])]
    .sort((left, right) => new Date(right.submittedAt).getTime() - new Date(left.submittedAt).getTime());
  const visibleRequests = requestScope === 'all' ? allScopeRequests : requests;

  if (!boothEligibleApplications.length) {
    return (
      <section className="partner-page">
        <div className="partner-page-header">
          <h1 className="partner-page-title workspace-page-title">Chọn gian hàng</h1>
          <p className="partner-page-sub workspace-page-subtitle">Bạn cần một hồ sơ tham gia sự kiện đã được duyệt trước khi gửi yêu cầu gian hàng.</p>
        </div>
        <div className="s2-empty s2-panel">
          <Store size={34} />
          <strong>Chưa có sự kiện đang mở gian hàng</strong>
          <span>Hồ sơ cần được duyệt và sự kiện phải đang công bố hoặc đang diễn ra.</span>
        </div>
      </section>
    );
  }

  return (
    <section className="partner-page s2-booth-page" aria-labelledby="partner-booth-title">
      <header className="s2-booth-header">
        <div>

          <h1 id="partner-booth-title" className="workspace-page-title">Chọn và thuê gian hàng</h1>
          <p className="workspace-page-subtitle">Khám phá sơ đồ, chọn vị trí phù hợp và theo dõi yêu cầu thuê gian hàng theo từng sự kiện.</p>
        </div>
        <button
          className="s2-booth-refresh"
          type="button"
          onClick={() => {
            onRefreshData();
            void loadData();
          }}
          disabled={loading}
        >
          <RefreshCw size={15} className={loading ? 's2-spin' : ''} />
          {loading ? 'Đang cập nhật…' : 'Làm mới'}
        </button>
      </header>

      <section className="s2-event-context" aria-label="Ngữ cảnh sự kiện đang chọn">
        <div className="s2-event-context-copy">
          <span>Sự kiện đang xem</span>
          <strong>{selectedApplication?.eventTitle || 'Chọn sự kiện'}</strong>
          <div className="s2-event-context-meta">
            <span className="s2-event-approved"><CheckCircle2 size={14} /> Hồ sơ đã duyệt</span>
            {selectedApplication && (
              <span className="s2-event-context-date"><Calendar size={14} />{eventSchedule(selectedApplication)}</span>
            )}
          </div>
        </div>
        <div className="s2-event-context-control">
          <label htmlFor="partner-booth-event-search">Tìm sự kiện</label>
          <input
            id="partner-booth-event-search"
            type="search"
            value={eventSearch}
            placeholder="Nhập tên sự kiện..."
            autoComplete="off"
            onChange={event => setEventSearch(event.target.value)}
          />
          <label htmlFor="partner-booth-event">Đổi sự kiện</label>
          <select
            id="partner-booth-event"
            aria-label="Sự kiện tham gia"
            value={filteredApplications.some(application => application.eventId === eventId) ? eventId : ''}
            onChange={event => {
              currentEventIdRef.current = event.target.value;
              const next = new URLSearchParams(searchParams);
              next.set('eventId', event.target.value);
              next.delete('boothId');
              setSearchParams(next);
            }}
          >
            {filteredApplications.length === 0 && (
              <option value="" disabled>Không tìm thấy sự kiện phù hợp</option>
            )}
            {filteredApplications.map(application => (
              <option key={application.id} value={application.eventId}>{application.eventTitle}</option>
            ))}
          </select>
          <small>{filteredApplications.length}/{boothEligibleApplications.length} sự kiện có thể chọn</small>
        </div>
      </section>

      <section className="s2-booth-summary" aria-label="Thống kê gian hàng của sự kiện">
        <article>
          <strong>{enabledBoothCount}</strong>
          <div>
            <span>Gian hàng được mở</span>
            <small>Đã cấu hình cho thuê trong sự kiện</small>
          </div>
        </article>
        <article>
          <strong>{booths.filter(booth => booth.availability === 'AVAILABLE').length}</strong>
          <div>
            <span>Gian hàng còn trống</span>
            <small>Có thể xem và gửi yêu cầu thuê</small>
          </div>
        </article>
        <article>
          <strong>{requests.length}</strong>
          <div>
            <span>Yêu cầu đã gửi</span>
            <small>Tất cả hồ sơ yêu cầu trong sự kiện</small>
          </div>
        </article>
      </section>

      {error && <div className="s2-alert s2-alert-error" role="alert"><AlertCircle size={18} />{error}</div>}
      {success && <div className="s2-alert s2-alert-success" role="status"><Check size={18} />{success}</div>}

      <nav className="s2-tabs" aria-label="Gian hàng đối tác" role="tablist">
        <button
          id="partner-booth-map-tab"
          type="button"
          role="tab"
          className={tab === 'browse' ? 'is-active' : ''}
          aria-selected={tab === 'browse'}
          aria-controls="partner-booth-map-panel"
          onClick={() => setTab('browse')}
        >
          Sơ đồ gian hàng <span className="tab-count">{booths.length}</span>
        </button>
        <button
          id="partner-booth-requests-tab"
          type="button"
          role="tab"
          className={tab === 'requests' ? 'is-active' : ''}
          aria-selected={tab === 'requests'}
          aria-controls="partner-booth-requests-panel"
          onClick={() => setTab('requests')}
        >
          Yêu cầu của tôi <span className="tab-count">{requests.length}</span>
        </button>
      </nav>

      {tab === 'browse' && !loading && (
        <p className="s2-map-guidance">
          <Info size={16} /> Chọn một gian hàng còn trống trên sơ đồ để xem thông tin và gửi yêu cầu thuê.
        </p>
      )}

      {loading ? (
        <div className="s2-loading">
          <Loader2 className="s2-spin" size={22} />
          Đang tải gian hàng...
        </div>
      ) : tab === 'browse' ? (
        <div
          id="partner-booth-map-panel"
          className="s2-panel s2-partner-map-panel"
          role="tabpanel"
          aria-labelledby="partner-booth-map-tab"
          style={{ padding: 0, overflow: 'hidden' }}
        >
          <div className="s2-partner-map">
            <BoothMapCanvas
              className="s2-partner-booth-map-canvas"
              markers={mapMarkers}
              selectedMarkerId={selectedBooth ? `booth-${selectedBooth.booth.boothId}` : null}
              onSelectMarker={marker => {
                const row = booths.find(item => item.booth.boothId === marker.boothId);
                if (row) {
                  setSelectedBooth(row);
                  setRequestNote('');
                }
              }}
              editable={false}
              ariaLabel="Bản đồ chọn gian hàng dành cho Partner"
              emptyMessage="Chưa có gian hàng nào được định vị trên bản đồ."
            />
          </div>
        </div>
      ) : (
        <div
          id="partner-booth-requests-panel"
          className="s2-panel"
          role="tabpanel"
          aria-labelledby="partner-booth-requests-tab"
        >
          <div className="s2-partner-request-intro">
            <div>

              <h2>Yêu cầu thuê gian hàng</h2>
              <p>Kiểm tra tiến trình xét duyệt, thời hạn giữ chỗ và các thao tác cần hoàn tất cho từng gian hàng.</p>
            </div>
            <div className="s2-request-scope">
              <div className="s2-request-scope-toggle" role="group" aria-label="Phạm vi yêu cầu">
                <button type="button" aria-pressed={requestScope === 'event'} className={requestScope === 'event' ? 'is-active' : ''} onClick={() => setRequestScope('event')}>
                  Sự kiện đang chọn
                </button>
                <button type="button" aria-pressed={requestScope === 'all'} className={requestScope === 'all' ? 'is-active' : ''} onClick={() => setRequestScope('all')}>
                  Tất cả sự kiện
                </button>
              </div>
              <strong>{visibleRequests.length} yêu cầu</strong>
            </div>
          </div>
          {requestScope === 'all' && allRequests === null && (
            <p className="s2-map-guidance"><Info size={16} /> Chưa tải được danh sách yêu cầu của tất cả sự kiện. Hãy bấm Làm mới.</p>
          )}
          <PaginatedList items={visibleRequests}>{pageItems => (<div className="s2-request-list">
            {pageItems.map(request => {
              const isHoldActive = request.hold?.status === 'ACTIVE';
              const boothInfo = booths.find(b => b.booth.boothId === request.boothId);
              const boothName = boothInfo?.booth.name;
              const progressSteps = requestProgress(request);
              const canWithdraw = request.status === 'PENDING' || (request.status === 'SELECTED' && isHoldActive);

              return (
                <article
                  className={`s2-request-card s2-partner-request-card status-${request.status.toLowerCase()} ${isHoldActive ? 'has-active-hold' : ''}`}
                  key={request.boothRequestId}
                >
                  <header className="s2-partner-request-header">
                    <div className="s2-partner-request-identity">
                      <span className="s2-partner-request-eyebrow">YÊU CẦU THUÊ GIAN HÀNG · #{request.boothRequestId}</span>
                      {requestScope === 'all' && (
                        <span className="s2-partner-request-event">
                          {eventTitleById.get(String(request.eventId)) || `Sự kiện #${request.eventId}`}
                        </span>
                      )}
                      <h3>Gian {request.boothCode}</h3>
                      {boothName && <p><b>Tên gian</b>{boothName}</p>}
                      <span className="s2-partner-request-submitted">
                        <Calendar size={14} /> Gửi lúc {dateTime(request.submittedAt)}
                      </span>
                    </div>
                    <div className="s2-partner-request-header-actions">
                      <span className={`s2-partner-request-status is-${request.status.toLowerCase()}`}>
                        <i aria-hidden="true" />{requestStatusLabel[request.status]}
                      </span>
                      {canWithdraw && (
                        <button
                          type="button"
                          className="btn-request-reject"
                          disabled={busy === `withdraw-${request.boothRequestId}`}
                          onClick={() => setWithdrawTarget(request)}
                        >
                          <X size={14} />
                          {busy === `withdraw-${request.boothRequestId}`
                            ? 'Đang xử lý…'
                            : request.status === 'SELECTED' ? 'Rút & giải phóng' : 'Rút yêu cầu'}
                        </button>
                      )}
                    </div>
                  </header>

                  <section className="s2-partner-request-progress" aria-label="Tiến trình xử lý yêu cầu">
                    <span className="s2-partner-request-section-label">Tiến trình xử lý</span>
                    <ol style={{ '--step-count': progressSteps.length } as React.CSSProperties}>
                      {progressSteps.map((step, index) => {
                        const nextState = progressSteps[index + 1]?.state;
                        const connectorState = nextState === 'terminal-danger'
                          ? 'danger'
                          : nextState === 'terminal-neutral'
                            ? 'neutral'
                            : step.state === 'complete' ? 'complete' : 'future';

                        return (
                          <li
                            className={`is-${step.state} connector-${connectorState}`}
                            key={step.key}
                            aria-label={`${step.label}: ${progressStateLabel[step.state]}`}
                          >
                            <span className="s2-partner-request-step-marker" aria-hidden="true">
                              {step.state === 'complete' && <Check size={12} strokeWidth={3} />}
                              {step.state.startsWith('terminal') && <X size={12} strokeWidth={3} />}
                              {step.state === 'current' && <i />}
                            </span>
                            <div>
                              <strong>{step.label}</strong>
                              {step.state !== 'complete' && <small>{progressStateLabel[step.state]}</small>}
                              {step.occurredAt && <time dateTime={step.occurredAt}>{dateTime(step.occurredAt)}</time>}
                            </div>
                          </li>
                        );
                      })}
                    </ol>
                  </section>

                  {(request.requestNote || request.reviewNote) && (
                    <div className="s2-partner-request-notes">
                      {request.requestNote && (
                        <p><span><MessageSquare size={14} />Ghi chú của bạn</span><b>{request.requestNote}</b></p>
                      )}
                      {request.reviewNote && (
                        <p className="is-review"><span><CheckCircle2 size={14} />Phản hồi từ Ban tổ chức</span><b>{request.reviewNote}</b></p>
                      )}
                    </div>
                  )}

                  {request.status === 'SELECTED' && isHoldActive ? (
                    <BoothPaymentCheckoutCard request={request} now={now} boothName={boothName} compact />
                  ) : request.hold ? (
                    <section className="s2-partner-request-finance" aria-label="Thông tin giữ chỗ và thanh toán">
                      <div className="is-price">
                        <span>Giá thuê đã khóa</span>
                        <strong>{money(request.hold.lockedRentalPrice)}</strong>
                      </div>
                      <div>
                        <span>{isHoldActive ? 'Hạn thanh toán' : 'Hạn thanh toán ban đầu'}</span>
                        <strong>{dateTime(request.hold.expiresAt)}</strong>
                      </div>
                      <div>
                        <span>Trạng thái giữ chỗ</span>
                        <strong className={`is-hold-${request.hold.status.toLowerCase()}`}><i aria-hidden="true" />{holdStatusLabel(request.hold.status)}</strong>
                      </div>
                      {request.hold.releasedAt && (
                        <div>
                          <span>Thời điểm giải phóng</span>
                          <strong>{dateTime(request.hold.releasedAt)}</strong>
                        </div>
                      )}
                    </section>
                  ) : null}

                  {request.hold && (
                    <footer className="s2-partner-request-footer">
                      <Link to={`/partner/booth-requests/${request.boothRequestId}/payment`} className="s3-payment-details-link">
                        <CreditCard size={16} />
                        <span>Xem chi tiết thanh toán và gian hàng</span>
                        <ChevronRight size={15} />
                      </Link>
                    </footer>
                  )}
                </article>
              );
            })}
            {requestScope === 'all' && !visibleRequests.length && (
              <div className="s2-empty s2-partner-request-empty">
                <span><Store size={30} /></span>
                <strong>Bạn chưa có yêu cầu thuê gian hàng nào</strong>
                <p>Chọn một gian còn trống trên sơ đồ để gửi yêu cầu đầu tiên đến Ban tổ chức.</p>
                <button type="button" onClick={() => setTab('browse')}>Xem sơ đồ gian hàng <ChevronRight size={15} /></button>
              </div>
            )}
            {requestScope === 'event' && !requests.length && (
              <div className="s2-empty s2-partner-request-empty">
                <span><Store size={30} /></span>
                <strong>Sự kiện này chưa có yêu cầu thuê gian hàng</strong>
                {alternativeRequestApplication ? (
                  <>
                    <p>
                      Bạn có {requestCountsByEvent.get(alternativeRequestApplication.eventId)} yêu cầu tại sự kiện
                      {' '}<b>{alternativeRequestApplication.eventTitle}</b>.
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        currentEventIdRef.current = alternativeRequestApplication.eventId;
                        const next = new URLSearchParams(searchParams);
                        next.set('eventId', alternativeRequestApplication.eventId);
                        next.delete('boothId');
                        setSearchParams(next);
                      }}
                    >
                      Xem yêu cầu ở sự kiện đó <ChevronRight size={15} />
                    </button>
                  </>
                ) : (
                  <>
                    <p>Chọn một gian còn trống trên sơ đồ để xem thông tin và gửi yêu cầu đến Ban tổ chức.</p>
                    <button type="button" onClick={() => setTab('browse')}>Xem sơ đồ gian hàng <ChevronRight size={15} /></button>
                  </>
                )}
              </div>
            )}
          </div>)}</PaginatedList>
        </div>
      )}

      {withdrawTarget && (
        <PartnerDialog
          title={withdrawTarget.status === 'SELECTED'
            ? 'Xác nhận giải phóng gian hàng'
            : 'Xác nhận rút yêu cầu gian hàng'}
          onClose={() => !busy.startsWith('withdraw-') && setWithdrawTarget(null)}
        >
          <div className="partner-dialog-body s2-withdraw-dialog">
            <span className="s2-withdraw-dialog-icon"><AlertCircle size={25} /></span>
            <h3>Gian {withdrawTarget.boothCode}</h3>
            {withdrawTarget.status === 'SELECTED' ? (
              <p>
                Gian hàng đang được giữ cho bạn. Nếu chưa có kết quả thanh toán cần bảo toàn,
                hệ thống sẽ rút yêu cầu và giải phóng giữ chỗ ngay để đối tác khác có thể đăng ký.
                Thao tác này không thể hoàn tác.
              </p>
            ) : (
              <p>
                Yêu cầu đang chờ Ban tổ chức xem xét. Sau khi rút, trạng thái này không thể hoàn tác.
                Bạn có chắc muốn tiếp tục?
              </p>
            )}
            <div className="partner-dialog-actions">
              <button type="button" className="btn-part-secondary" onClick={() => setWithdrawTarget(null)} disabled={busy.startsWith('withdraw-')}>
                Giữ yêu cầu
              </button>
              <button type="button" className="btn-part-danger" onClick={() => void withdraw(withdrawTarget)} disabled={busy.startsWith('withdraw-')}>
                <X size={15} />{busy.startsWith('withdraw-')
                  ? 'Đang xử lý…'
                  : withdrawTarget.status === 'SELECTED' ? 'Rút và giải phóng' : 'Xác nhận rút yêu cầu'}
              </button>
            </div>
          </div>
        </PartnerDialog>
      )}

      {withdrawBlocked && (
        <PartnerDialog title={withdrawBlocked.title} onClose={() => setWithdrawBlocked(null)}>
          <div className="partner-dialog-body s2-withdraw-dialog">
            <span className="s2-withdraw-dialog-icon is-warning"><Info size={25} /></span>
            <h3>Chưa thể giải phóng gian hàng</h3>
            <p>{withdrawBlocked.message}</p>
            <div className="partner-dialog-actions">
              <button type="button" className="btn-part-secondary" onClick={() => setWithdrawBlocked(null)}>
                Đóng
              </button>
              {withdrawBlocked.showPaymentLink && (
                <Link
                  className="btn-part-primary"
                  to={`/partner/booth-requests/${withdrawBlocked.requestId}/payment`}
                  onClick={() => setWithdrawBlocked(null)}
                >
                  <CreditCard size={16} /> Xem chi tiết thanh toán
                </Link>
              )}
            </div>
          </div>
        </PartnerDialog>
      )}

      {quotaExceeded && (
        <PartnerDialog
          title="Đã đạt giới hạn gian hàng"
          onClose={() => setQuotaExceeded(null)}
        >
          <div className="partner-dialog-body s2-quota-dialog">
            <span className="s2-quota-dialog-icon"><AlertCircle size={26} /></span>
            <div className="s2-quota-dialog-copy">
              <span className="s2-quota-dialog-eyebrow">Không thể đăng ký gian {quotaExceeded.boothCode}</span>
              <h3>Sự kiện : {quotaExceeded.eventTitle}</h3>
              <p>
                Bạn đã đạt số gian hàng tối đa cho phép trong sự kiện này
              </p>
            </div>
            <div className="s2-quota-dialog-note">
              Hạn mức được tính theo các gian đang giữ chỗ hoặc đã được cấp. Bạn có thể kiểm tra lại
              các yêu cầu hiện có, hoặc liên hệ Ban tổ chức nếu cần hỗ trợ.
            </div>
            <div className="partner-dialog-actions">
              <button type="button" className="btn-part-secondary" onClick={() => setQuotaExceeded(null)}>
                Đã hiểu
              </button>
              <button
                type="button"
                className="btn-part-primary"
                onClick={() => {
                  setQuotaExceeded(null);
                  setTab('requests');
                }}
              >
                Xem yêu cầu của tôi
              </button>
            </div>
          </div>
        </PartnerDialog>
      )}

      {/* POPUP XEM CHI TIẾT & GỬI YÊU CẦU GIAN HÀNG */}
      {selectedBooth && (
        <div
          className="booth-modal-backdrop"
          {...boothBackdropHandlers}
        >
          <div className="booth-modal-box s2-booth-request-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '560px' }}>
            {/* Header */}
            <div className="booth-modal-header">
              <div>
                <div className="s2-booth-modal-badge-row">
                  <span className="s2-booth-tag">
                    <Store size={14} />
                    {selectedBooth.booth.code}
                  </span>
                  <span className={`s2-status ${selectedBooth.availability.toLowerCase()}`}>
                    {(requestByBooth.get(selectedBooth.booth.boothId) || []).some(request => request.status === 'COMPLETED')
                      ? 'Gian của bạn'
                      : availabilityLabel[selectedBooth.availability]}
                  </span>
                </div>
                <h2 className="s2-booth-modal-title">{selectedBooth.booth.name}</h2>
              </div>
              <button
                type="button"
                className="booth-modal-close-btn"
                onClick={() => busy !== 'submit' && setSelectedBooth(null)}
                title="Đóng"
              >
                <X size={20} />
              </button>
            </div>

            {/* Description */}
            {(selectedBooth.booth.description || selectedBooth.booth.note) && (
              <div className="s2-booth-desc-box">
                <Info size={16} className="s2-desc-icon" />
                <p>{selectedBooth.booth.description || selectedBooth.booth.note}</p>
              </div>
            )}

            {/* Specifications Grid */}
            <div className="s2-booth-specs-grid">
              <div className="s2-booth-spec-card">
                <div className="s2-spec-header">
                  <Tag size={13} />
                  <span>Chuyên mục</span>
                </div>
                <strong className="s2-spec-value">
                  {CATEGORY_LABEL[selectedBooth.booth.categoryCode || ''] || selectedBooth.booth.categoryCode || 'Chưa phân loại'}
                </strong>
              </div>

              <div className="s2-booth-spec-card">
                <div className="s2-spec-header">
                  <Users size={13} />
                  <span>Sức chứa</span>
                </div>
                <strong className="s2-spec-value">
                  {selectedBooth.booth.maxCapacity ? `${selectedBooth.booth.maxCapacity} đơn vị` : 'Tiêu chuẩn'}
                </strong>
              </div>

              <div className="s2-booth-spec-card s2-spec-price-card">
                <div className="s2-spec-header">
                  <DollarSign size={13} />
                  <span>Giá thuê</span>
                </div>
                <strong className="s2-spec-value s2-price-highlight">
                  {money(selectedBooth.rentalPrice)}
                </strong>
              </div>
            </div>

            {/* Form / Blocked Notice */}
            {requestBlockedReason(selectedBooth) ? (
              <div className="s2-alert s2-alert-error" style={{ margin: 0 }}>
                <AlertCircle size={18} />
                <span>{requestBlockedReason(selectedBooth)}</span>
              </div>
            ) : (
              <form onSubmit={submitRequest} className="s2-modal-request-form">
                <div className="s2-form-field">
                  <label htmlFor="partner-request-note" className="s2-form-label">
                    <MessageSquare size={14} />
                    <span>Ghi chú gửi Ban tổ chức</span>
                    <small>(không bắt buộc)</small>
                  </label>
                  <textarea
                    id="partner-request-note"
                    className="s2-request-textarea"
                    rows={3}
                    maxLength={1000}
                    value={requestNote}
                    onChange={event => setRequestNote(event.target.value)}
                    placeholder="Mô tả nhu cầu trưng bày, diện tích hoặc yêu cầu dành cho gian hàng..."
                  />
                </div>

                <div className="booth-modal-footer">
                  <button
                    type="button"
                    className="btn-part-secondary"
                    onClick={() => setSelectedBooth(null)}
                    disabled={busy === 'submit'}
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    className="btn-part-primary"
                    disabled={busy === 'submit' || organizationLocked}
                  >
                    {busy === 'submit' ? (
                      <>
                        <Loader2 size={16} className="s2-spin" />
                        <span>Đang gửi...</span>
                      </>
                    ) : (
                      <>
                        <Check size={16} />
                        <span>Gửi yêu cầu thuê gian</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </section>
  );
};
