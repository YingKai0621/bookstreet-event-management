import { DayFirstDateInput } from '../ui/DayFirstDateInput';
import { getPageCount, toPageIndex, LIST_PAGE_SIZE } from '../../constants/pagination';
import { ListPagination } from '../ui/ListPagination';
import { SearchFieldLabel } from '../ui/SearchFieldLabel';
import { WorkspaceFieldLabel } from '../ui/WorkspaceFieldLabel';
import { PaginatedList } from '../ui/PaginatedList';
import React, { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Ban,
  Building2,
  CalendarDays,
  Clock3,
  Download,
  Eye,
  FilePenLine,
  Layers3,
  MapPin,
  Plus,
  QrCode,
  RefreshCw,
  Search,
  Users,
  X,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { organizerApi } from '../../services/organizerApi';
import type {
  ActivityProposalStatus,
  ActivityRequestStatus,
  ActivityStatus,
  OrganizerActivityCancellationRequestResponse,
  OrganizerActivityChangeRequestResponse,
  OrganizerActivityProposalResponse,
  OrganizerActivityResponse,
  OrganizerActivityRevisionResponse,
  OrganizerLocationResponse,
  UpdateOrganizerActivityRequest,
} from '../../types/activity';
import type { Language } from '../../types';
import type { OrganizerEvent } from '../../types/organizer';
import {
  activityStatusLabel,
  activityStatusTone,
  cancellationSourceLabel,
  type ActivityRecordKind,
} from '../../utils/activityPresentation';
import './OrganizerActivityWorkspace.css';

type WorkspaceView = 'activities' | 'proposals' | 'changes' | 'cancellations';
type WorkspaceRecord =
  | OrganizerActivityResponse
  | OrganizerActivityProposalResponse
  | OrganizerActivityChangeRequestResponse
  | OrganizerActivityCancellationRequestResponse;

interface OrganizerActivityWorkspaceProps {
  language: Language;
  events: OrganizerEvent[];
  selectedEventId?: string | null;
}

interface PageMeta {
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

const PAGE_SIZE = LIST_PAGE_SIZE;

const VIEW_CONFIG: Array<{
  id: WorkspaceView;
  label: string;
  description: string;
  icon: React.ComponentType<{ size?: number }>;
}> = [
  { id: 'activities', label: 'Hoạt động', description: 'Lịch chính thức', icon: CalendarDays },
  { id: 'proposals', label: 'Đề xuất từ đối tác', description: 'Tiếp nhận và xét duyệt hồ sơ', icon: Layers3 },
  { id: 'changes', label: 'Yêu cầu thay đổi', description: 'So sánh nội dung', icon: FilePenLine },
  { id: 'cancellations', label: 'Yêu cầu hủy', description: 'Kiểm tra ảnh hưởng', icon: Ban },
];

const ACTIVITY_STATUS_OPTIONS: Array<ActivityStatus | ''> = [
  '', 'DRAFT', 'PUBLISHED', 'ONGOING', 'COMPLETED', 'CANCELLED',
];

const PROPOSAL_STATUS_OPTIONS: Array<ActivityProposalStatus | ''> = [
  '', 'PENDING', 'NEED_CHANGES', 'APPROVED', 'REJECTED', 'WITHDRAWN', 'CANCELLED',
];

const REQUEST_STATUS_OPTIONS: Array<ActivityRequestStatus | ''> = [
  '', 'PENDING', 'APPROVED', 'REJECTED', 'WITHDRAWN', 'CANCELLED',
];

function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—';
  return new Date(value).toLocaleString('vi-VN', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
    timeZone: 'Asia/Ho_Chi_Minh',
  });
}

function formatRange(startAt: string, endAt: string): string {
  return `${formatDateTime(startAt)} – ${formatDateTime(endAt)}`;
}

function userFacingError(cause: unknown, fallback: string): string {
  const message = cause instanceof Error ? cause.message : '';
  if (!message || /JDBC|executing SQL|lower\(bytea\)|Hibernate|SQLException/i.test(message)) {
    return fallback;
  }
  return message;
}

function isProposal(record: WorkspaceRecord): record is OrganizerActivityProposalResponse {
  return 'activityProposalId' in record;
}

function isChangeRequest(record: WorkspaceRecord): record is OrganizerActivityChangeRequestResponse {
  return 'activityChangeRequestId' in record;
}

function isCancellationRequest(record: WorkspaceRecord): record is OrganizerActivityCancellationRequestResponse {
  return 'activityCancellationRequestId' in record;
}

function isOrganizationLocked(record: WorkspaceRecord): boolean {
  if (isProposal(record)) return record.partnerOrganizationStatus === 'INACTIVE';
  if (isChangeRequest(record) || isCancellationRequest(record)) {
    return record.activity.partnerOrganizationStatus === 'INACTIVE';
  }
  return false;
}

function isActivity(record: WorkspaceRecord): record is OrganizerActivityResponse {
  return !isProposal(record) && !isChangeRequest(record) && !isCancellationRequest(record);
}

function recordKind(record: WorkspaceRecord): ActivityRecordKind {
  if (isActivity(record)) return 'activity';
  if (isProposal(record)) return 'proposal';
  return isChangeRequest(record) ? 'changeRequest' : 'cancellationRequest';
}

function viewKind(view: WorkspaceView): ActivityRecordKind {
  if (view === 'activities') return 'activity';
  if (view === 'proposals') return 'proposal';
  return view === 'changes' ? 'changeRequest' : 'cancellationRequest';
}

function StatusBadge({ kind, status }: { kind: ActivityRecordKind; status: string }) {
  return (
    <span className={`oaw-status oaw-status--${activityStatusTone(kind, status)}`}>
      <span aria-hidden="true" />
      {activityStatusLabel(kind, status)}
    </span>
  );
}

function RecordTitle({ record }: { record: WorkspaceRecord }) {
  if (isActivity(record)) {
    return (
      <>
        <strong>{record.title}</strong>
        <span>{record.activityType || 'Hoạt động'} · #{record.activityId}</span>
      </>
    );
  }
  if (isProposal(record)) {
    return (
      <>
        <strong>{record.title}</strong>
        <span>Hồ sơ đề xuất #{record.activityProposalId}</span>
      </>
    );
  }
  return (
    <>
      <strong>{record.activity.title}</strong>
      <span>
        {isChangeRequest(record) ? 'Yêu cầu thay đổi' : 'Yêu cầu hủy'} #{isChangeRequest(record)
          ? record.activityChangeRequestId
          : record.activityCancellationRequestId}
      </span>
    </>
  );
}

function RelatedActivityNotice({
  activityId,
  activity,
  onOpen,
}: {
  activityId: number;
  activity?: OrganizerActivityResponse;
  onOpen: () => void;
}) {
  const cancelled = activity?.status === 'CANCELLED';
  return (
    <div className={`oaw-related-record${cancelled ? ' is-cancelled' : ''}`}>
      <CalendarDays size={18} />
      <span>
        <small>HOẠT ĐỘNG LIÊN KẾT</small>
        <strong>{activity
          ? `Activity #${activity.activityId} · ${activityStatusLabel('activity', activity.status)}`
          : `Activity #${activityId}`}</strong>
      </span>
      <button type="button" onClick={onOpen}>Xem hoạt động</button>
    </div>
  );
}

function SourceProposalNotice({
  proposalId,
  proposal,
  onOpen,
}: {
  proposalId: number;
  proposal?: OrganizerActivityProposalResponse;
  onOpen: () => void;
}) {
  return (
    <div className="oaw-related-record">
      <Layers3 size={18} />
      <span>
        <small>NGUỒN HOẠT ĐỘNG</small>
        <strong>Đề xuất #{proposalId}{proposal ? ` · ${proposal.partnerOrganizationName}` : ''}</strong>
      </span>
      <button type="button" onClick={onOpen}>Xem đề xuất</button>
    </div>
  );
}

function ActivityCancellationNotice({ activity }: { activity: OrganizerActivityResponse }) {
  if (activity.status !== 'CANCELLED') return null;
  return (
    <div className="oaw-cancellation-summary">
      <strong>Hủy bởi: {cancellationSourceLabel(activity.cancellationSource)}</strong>
      {activity.cancellationReason && <p>{activity.cancellationReason}</p>}
      {activity.cancelledAt && <small>Hủy lúc {formatDateTime(activity.cancelledAt)}</small>}
    </div>
  );
}

export const OrganizerActivityWorkspace: React.FC<OrganizerActivityWorkspaceProps> = ({
  events,
  selectedEventId,
}) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const viewCandidate = searchParams.get('view') || searchParams.get('activityView');
  const activeView: WorkspaceView = VIEW_CONFIG.some(view => view.id === viewCandidate)
    ? viewCandidate as WorkspaceView
    : 'activities';
  const search = searchParams.get('search') || '';
  const debouncedSearch = useDeferredValue(search.trim());
  const status = searchParams.get('status') || '';
  const lateOnly = searchParams.get('late') === 'true';
  const requestedPage = Number.parseInt(searchParams.get('page') || '1', 10);
  const page = Number.isFinite(requestedPage) && requestedPage > 0 ? toPageIndex(requestedPage) : 0;
  const [records, setRecords] = useState<WorkspaceRecord[]>([]);
  const [activitiesById, setActivitiesById] = useState<Record<number, OrganizerActivityResponse>>({});
  const [proposalsById, setProposalsById] = useState<Record<number, OrganizerActivityProposalResponse>>({});
  const [meta, setMeta] = useState<PageMeta>({ page: 0, size: PAGE_SIZE, totalElements: 0, totalPages: 0 });
  const [pendingCounts, setPendingCounts] = useState({ proposals: 0, changes: 0, cancellations: 0 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [selectedRecord, setSelectedRecord] = useState<WorkspaceRecord | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [notice, setNotice] = useState('');
  const requestSequence = useRef(0);

  const updateWorkspaceParams = (
    updates: Record<string, string | number | boolean | null | undefined>,
    replace = false,
  ) => {
    const next = new URLSearchParams(searchParams);
    next.delete('activityView');
    for (const [key, value] of Object.entries(updates)) {
      if (value === null || value === undefined || value === '' || value === false) next.delete(key);
      else next.set(key, String(value));
    }
    setSearchParams(next, { replace });
  };

  const effectiveEventId = events.some(event => event.id === selectedEventId)
    ? selectedEventId as string
    : events[0]?.id;
  const currentEvent = events.find(event => event.id === effectiveEventId);
  const canCreateActivity = Boolean(currentEvent && ['DRAFT', 'PUBLISHED', 'ONGOING'].includes(currentEvent.apiStatus));

  useEffect(() => {
    if (!effectiveEventId) return;

    const sequence = ++requestSequence.current;
    // Loading/error are synchronized with this remote request lifecycle.
    // oxlint-disable-next-line react/set-state-in-effect
    setLoading(true);
    setError('');
    const common = {
      eventId: effectiveEventId,
      page,
      size: PAGE_SIZE,
      search: debouncedSearch || undefined,
    };

    const request = activeView === 'activities'
      ? organizerApi.listActivities({ ...common, status: status as ActivityStatus || undefined, sort: 'startAt,asc' })
      : activeView === 'proposals'
        ? organizerApi.listActivityProposals({ ...common, status: status as ActivityProposalStatus || undefined, sort: 'submittedAt,desc' })
        : activeView === 'changes'
          ? organizerApi.listActivityChangeRequests({ ...common, status: status as ActivityRequestStatus || undefined, sort: 'submittedAt,desc' })
          : organizerApi.listActivityCancellationRequests({
            ...common,
            status: status as ActivityRequestStatus || undefined,
            late: lateOnly || undefined,
            sort: 'submittedAt,desc',
          });

    void request
      .then(response => {
        if (sequence !== requestSequence.current) return;
        const lastPage = getPageCount(response.totalElements, PAGE_SIZE);
        if (page >= lastPage) {
          const next = new URLSearchParams(window.location.search);
          next.set('page', String(lastPage));
          setSearchParams(next, { replace: true });
          return;
        }
        setRecords(response.content);
        setMeta({
          page: response.page,
          size: response.size,
          totalElements: response.totalElements,
          totalPages: response.totalPages,
        });
      })
      .catch(cause => {
        if (sequence !== requestSequence.current) return;
        setRecords([]);
        setError(userFacingError(cause, 'Không tải được dữ liệu hoạt động. Vui lòng thử lại.'));
      })
      .finally(() => {
        if (sequence === requestSequence.current) setLoading(false);
      });
  }, [activeView, debouncedSearch, effectiveEventId, lateOnly, page, reloadKey, setSearchParams, status]);

  useEffect(() => {
    if (activeView === 'activities') return;
    let active = true;
    const activityIds = [...new Set(records.flatMap(record => {
      if (isActivity(record)) return [];
      if (isProposal(record)) return record.activityId ? [record.activityId] : [];
      return [record.activityId];
    }))];
    void Promise.allSettled(activityIds.map(activityId => organizerApi.getActivity(activityId)))
      .then(results => {
        if (!active) return;
        setActivitiesById(Object.fromEntries(results.flatMap(result =>
          result.status === 'fulfilled' ? [[result.value.activityId, result.value] as const] : [])));
      });
    return () => { active = false; };
  }, [activeView, records, reloadKey]);

  useEffect(() => {
    if (activeView !== 'activities') return;
    let active = true;
    const proposalIds = [...new Set(records.flatMap(record =>
      isActivity(record) && record.sourceProposalId ? [record.sourceProposalId] : []))];
    void Promise.allSettled(proposalIds.map(proposalId => organizerApi.getActivityProposal(proposalId)))
      .then(results => {
        if (!active) return;
        setProposalsById(Object.fromEntries(results.flatMap(result =>
          result.status === 'fulfilled' ? [[result.value.activityProposalId, result.value] as const] : [])));
      });
    return () => { active = false; };
  }, [activeView, records, reloadKey]);

  useEffect(() => {
    if (!effectiveEventId) return;
    let active = true;
    void Promise.all([
      organizerApi.listActivityProposals({ eventId: effectiveEventId, status: 'PENDING', page: 0, size: 1 }),
      organizerApi.listActivityChangeRequests({ eventId: effectiveEventId, status: 'PENDING', page: 0, size: 1 }),
      organizerApi.listActivityCancellationRequests({ eventId: effectiveEventId, status: 'PENDING', page: 0, size: 1 }),
    ]).then(([proposals, changes, cancellations]) => {
      if (!active) return;
      setPendingCounts({
        proposals: proposals.totalElements,
        changes: changes.totalElements,
        cancellations: cancellations.totalElements,
      });
    }).catch(() => {
      if (active) setPendingCounts({ proposals: 0, changes: 0, cancellations: 0 });
    });
    return () => { active = false; };
  }, [effectiveEventId, reloadKey]);

  const statusOptions = activeView === 'activities'
    ? ACTIVITY_STATUS_OPTIONS
    : activeView === 'proposals'
      ? PROPOSAL_STATUS_OPTIONS
      : REQUEST_STATUS_OPTIONS;

  const selectView = (view: WorkspaceView) => {
    updateWorkspaceParams({ view, status: null, late: null, page: null });
    setSelectedRecord(null);
  };

  const selectEvent = (eventId: string) => {
    updateWorkspaceParams({ eventId, status: null, search: null, late: null, page: null });
    setSelectedRecord(null);
  };

  const openActivity = async (activityId: number) => {
    try {
      const activity = activitiesById[activityId] || await organizerApi.getActivity(activityId);
      updateWorkspaceParams({ view: 'activities', status: null, late: null, page: null });
      setSelectedRecord(activity);
    } catch (cause) {
      setNotice(userFacingError(cause, 'Không tải được hoạt động liên kết. Vui lòng thử lại.'));
    }
  };

  const openProposal = async (proposalId: number) => {
    try {
      const proposal = proposalsById[proposalId]
        || await organizerApi.getActivityProposal(proposalId);
      updateWorkspaceParams({ view: 'proposals', status: null, late: null, page: null });
      setSelectedRecord(proposal);
    } catch (cause) {
      setNotice(userFacingError(cause, 'Không tải được đề xuất nguồn. Vui lòng thử lại.'));
    }
  };

  const pendingCount = (view: WorkspaceView): number | null => {
    if (view === 'proposals') return pendingCounts.proposals;
    if (view === 'changes') return pendingCounts.changes;
    if (view === 'cancellations') return pendingCounts.cancellations;
    return null;
  };

  return (
    <section className="oaw-shell">
      <header className="oaw-header">
        <div>
          <h1 className="workspace-page-title">Quản lý hoạt động</h1>
          <p className="workspace-page-subtitle">Theo dõi lịch chính thức và xử lý hồ sơ từ đối tác theo từng sự kiện.</p>
        </div>
        <div className="oaw-header-actions">
          <button className="oaw-refresh" type="button" onClick={() => setReloadKey(value => value + 1)} disabled={loading}>
            <RefreshCw size={18} className={loading ? 'is-spinning' : ''} />
            Làm mới dữ liệu
          </button>
          <button className="oaw-create" type="button" onClick={() => setCreateOpen(true)} disabled={!canCreateActivity} title={canCreateActivity ? '' : 'Sự kiện đã kết thúc hoặc đã hủy'}>
            <Plus size={19} /> Tạo hoạt động
          </button>
        </div>
      </header>

      {notice && <div className="oaw-notice" role="status">{notice}</div>}

      <div className="oaw-event-bar">
        <div className="oaw-event-summary">
          <span className="oaw-event-icon"><CalendarDays size={22} /></span>
          <div>
            <span>SỰ KIỆN ĐANG XEM</span>
            <strong>{currentEvent?.title || 'Chưa có sự kiện'}</strong>
            {currentEvent && <small>{currentEvent.dateRange}</small>}
          </div>
        </div>
        <label className="oaw-event-select">
          <span>Đổi sự kiện</span>
          <select
            value={effectiveEventId || ''}
            onChange={event => selectEvent(event.target.value)}
            disabled={events.length === 0}
          >
            {events.length === 0 && <option value="">Chưa có sự kiện</option>}
            {events.map(event => <option key={event.id} value={event.id}>{event.title}</option>)}
          </select>
        </label>
      </div>

      <nav className="oaw-tabs" aria-label="Nhóm quản lý hoạt động">
        {VIEW_CONFIG.map(view => {
          const Icon = view.icon;
          const count = pendingCount(view.id);
          return (
            <button
              key={view.id}
              type="button"
              className={activeView === view.id ? 'is-active' : ''}
              onClick={() => selectView(view.id)}
            >
              <Icon size={20} />
              <span><strong>{view.label}</strong><small>{view.description}</small></span>
              {count !== null && count > 0 && <b>{count > 99 ? '99+' : count}</b>}
            </button>
          );
        })}
      </nav>

      <section className="oaw-results-panel" aria-label="Bộ lọc và kết quả hoạt động">
      <div className="oaw-toolbar">
        <SearchFieldLabel className="oaw-search-group"><label className="oaw-search">
          <Search size={19} />
          <input
            value={search}
            onChange={event => updateWorkspaceParams({ search: event.target.value, page: null }, true)}
            placeholder={activeView === 'activities' ? 'Tìm theo tên hoạt động...' : 'Tìm hoạt động hoặc đối tác...'}
          />
          {search && <button type="button" onClick={() => updateWorkspaceParams({ search: null, page: null })} aria-label="Xóa từ khóa"><X size={16} /></button>}
        </label></SearchFieldLabel>
        <WorkspaceFieldLabel className="oaw-status-field" label="Trạng thái"><label className="oaw-filter">
          <select value={status} onChange={event => updateWorkspaceParams({ status: event.target.value, page: null })}>
            {statusOptions.map(value => <option key={value || 'all'} value={value}>{value ? activityStatusLabel(viewKind(activeView), value) : 'Tất cả trạng thái'}</option>)}
          </select>
        </label></WorkspaceFieldLabel>
        {activeView === 'cancellations' && (
          <label className="oaw-late-filter">
            <input type="checkbox" checked={lateOnly} onChange={event => updateWorkspaceParams({ late: event.target.checked, page: null })} />
            Chỉ yêu cầu trễ hạn
          </label>
        )}
        <span className="oaw-result-count">{meta.totalElements} kết quả</span>
      </div>

      <div className="oaw-list" aria-busy={loading}>
        {loading && records.length === 0 && Array.from({ length: 4 }, (_, index) => (
          <div className="oaw-skeleton" key={index}><span /><span /><span /></div>
        ))}

        {!loading && error && (
          <div className="oaw-state oaw-state--error">
            <strong>Chưa tải được dữ liệu</strong>
            <p>{error}</p>
            <button type="button" onClick={() => setReloadKey(value => value + 1)}>Thử lại</button>
          </div>
        )}

        {!loading && !error && records.length === 0 && (
          <div className="oaw-state">
            <span><CalendarDays size={28} /></span>
            <strong>Không có dữ liệu phù hợp</strong>
            <p>Thử đổi bộ lọc, từ khóa hoặc chọn một sự kiện khác.</p>
          </div>
        )}

        {records.map(record => {
          const statusValue = record.status;
          const activity = isChangeRequest(record) || isCancellationRequest(record) ? record.activity : null;
          const relatedActivity = isProposal(record) && record.activityId
            ? activitiesById[record.activityId]
            : (activity ? activitiesById[activity.activityId] : undefined);
          const sourceProposal = isActivity(record) && record.sourceProposalId
            ? proposalsById[record.sourceProposalId]
            : undefined;
          const partnerName = isProposal(record)
            ? record.partnerOrganizationName
            : activity?.partnerOrganizationName;
          const locationName = isActivity(record) || isProposal(record)
            ? record.location.name
            : activity?.location.name;
          const startAt = isActivity(record)
            ? record.startAt
            : isProposal(record)
              ? record.proposedStartAt
              : activity?.startAt;
          const endAt = isActivity(record)
            ? record.endAt
            : isProposal(record)
              ? record.proposedEndAt
              : activity?.endAt;
          const key = isActivity(record)
            ? `activity-${record.activityId}`
            : isProposal(record)
              ? `proposal-${record.activityProposalId}`
              : isChangeRequest(record)
                ? `change-${record.activityChangeRequestId}`
                : `cancellation-${record.activityCancellationRequestId}`;

          return (
            <article className={`oaw-card oaw-card--${activityStatusTone(recordKind(record), statusValue)}`} key={key}>
              <div className="oaw-card-main">
                <div className="oaw-card-title"><RecordTitle record={record} /></div>
                <div className="oaw-card-meta">
                  {partnerName && <span><Building2 size={16} />{partnerName}{isOrganizationLocked(record) && <b className="oaw-organization-locked">Tổ chức bị khóa</b>}</span>}
                  {startAt && endAt && <span><Clock3 size={16} />{formatRange(startAt, endAt)}</span>}
                  {locationName && <span><MapPin size={16} />{locationName}</span>}
                  {(isActivity(record) || isProposal(record)) && <span><Users size={16} />{record.capacity} người</span>}
                </div>
                {(isChangeRequest(record) || isCancellationRequest(record)) && (
                  <p className="oaw-reason"><strong>Lý do:</strong> {record.reason}</p>
                )}
                {isProposal(record) && record.status === 'APPROVED' && record.activityId && (
                  <RelatedActivityNotice activityId={record.activityId} activity={relatedActivity} onOpen={() => void openActivity(record.activityId as number)} />
                )}
                {isActivity(record) && record.sourceProposalId && (
                  <SourceProposalNotice proposalId={record.sourceProposalId} proposal={sourceProposal} onOpen={() => void openProposal(record.sourceProposalId as number)} />
                )}
                {isActivity(record) && <ActivityCancellationNotice activity={record} />}
                {(isChangeRequest(record) || isCancellationRequest(record)) && (
                  <RelatedActivityNotice activityId={record.activityId} activity={relatedActivity} onOpen={() => void openActivity(record.activityId)} />
                )}
              </div>
              <div className="oaw-card-actions">
                <StatusBadge kind={recordKind(record)} status={statusValue} />
                {isCancellationRequest(record) && record.late && <span className="oaw-late-badge">Trễ hạn</span>}
                <button type="button" onClick={() => setSelectedRecord(record)}>
                  <Eye size={17} /> Xem chi tiết
                </button>
              </div>
            </article>
          );
        })}
      </div>

      {getPageCount(meta.totalElements, PAGE_SIZE) > 1 && (
        <ListPagination page={page + 1} pages={getPageCount(meta.totalElements, PAGE_SIZE)} disabled={loading} onPage={value => updateWorkspaceParams({ page: value })} />
      )}
      </section>

      {selectedRecord && (
        <RecordDetailModal
          key={isActivity(selectedRecord)
            ? `activity-${selectedRecord.activityId}`
            : isProposal(selectedRecord)
              ? `proposal-${selectedRecord.activityProposalId}`
              : isChangeRequest(selectedRecord)
                ? `change-${selectedRecord.activityChangeRequestId}`
                : `cancellation-${selectedRecord.activityCancellationRequestId}`}
          record={selectedRecord}
          event={currentEvent}
          relatedActivity={!isActivity(selectedRecord)
            ? activitiesById[isProposal(selectedRecord) ? selectedRecord.activityId || -1 : selectedRecord.activityId]
            : undefined}
          sourceProposal={isActivity(selectedRecord) && selectedRecord.sourceProposalId
            ? proposalsById[selectedRecord.sourceProposalId]
            : undefined}
          onClose={() => setSelectedRecord(null)}
          onOpenActivity={!isActivity(selectedRecord)
            && (isProposal(selectedRecord) ? selectedRecord.activityId !== null : true)
            ? () => void openActivity(isProposal(selectedRecord) ? selectedRecord.activityId as number : selectedRecord.activityId)
            : undefined}
          onOpenProposal={isActivity(selectedRecord) && selectedRecord.sourceProposalId
            ? () => void openProposal(selectedRecord.sourceProposalId as number)
            : undefined}
          onCompleted={message => {
            setSelectedRecord(null);
            setNotice(message);
            setReloadKey(value => value + 1);
            window.dispatchEvent(new Event('duongsach:data-changed'));
            window.setTimeout(() => setNotice(''), 4500);
          }}
        />
      )}
      {createOpen && currentEvent && (
        <CreateActivityModal
          event={currentEvent}
          onClose={() => setCreateOpen(false)}
          onCreated={activity => {
            setCreateOpen(false);
            updateWorkspaceParams({ view: 'activities', status: null, late: null, page: null });
            setNotice(`Đã tạo bản nháp hoạt động “${activity.title}”.`);
            setReloadKey(value => value + 1);
            window.dispatchEvent(new Event('duongsach:data-changed'));
            window.setTimeout(() => setNotice(''), 4500);
          }}
        />
      )}
    </section>
  );
};

interface CreateActivityForm {
  title: string;
  description: string;
  activityType: string;
  locationId: string;
  startAt: string;
  endAt: string;
  capacity: string;
  registrationRequired: boolean;
  registrationDeadlineAt: string;
  certificateEnabled: boolean;
  attendanceEarlyScanMinutes: string;
}

const EMPTY_ACTIVITY_FORM: CreateActivityForm = {
  title: '',
  description: '',
  activityType: '',
  locationId: '',
  startAt: '',
  endAt: '',
  capacity: '',
  registrationRequired: false,
  registrationDeadlineAt: '',
  certificateEnabled: false,
  attendanceEarlyScanMinutes: '',
};

function vietnamLocalToIso(value: string): string {
  return new Date(`${value}:00+07:00`).toISOString();
}

function isoToVietnamLocal(value: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date(value));
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find(item => item.type === type)?.value || '';
  return `${part('year')}-${part('month')}-${part('day')}T${part('hour')}:${part('minute')}`;
}

function nextMinuteIso(): string {
  const value = new Date();
  value.setSeconds(0, 0);
  value.setMinutes(value.getMinutes() + 1);
  return value.toISOString();
}

function localDateOptions(startAt: string, endAt: string): Array<{ value: string; label: string }> {
  const startDate = isoToVietnamLocal(startAt).slice(0, 10);
  const endDate = isoToVietnamLocal(endAt).slice(0, 10);
  const cursor = new Date(`${startDate}T00:00:00+07:00`);
  const last = new Date(`${endDate}T00:00:00+07:00`);
  const result: Array<{ value: string; label: string }> = [];
  while (cursor <= last && result.length < 370) {
    const value = isoToVietnamLocal(cursor.toISOString()).slice(0, 10);
    result.push({
      value,
      label: cursor.toLocaleDateString('vi-VN', {
        weekday: 'short',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        timeZone: 'Asia/Ho_Chi_Minh',
      }),
    });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return result;
}

function EventDateTimeField({
  label,
  value,
  eventStartAt,
  eventEndAt,
  minimumAt,
  allowExistingPastValue,
  onChange,
}: {
  label: string;
  value: string;
  eventStartAt: string;
  eventEndAt: string;
  minimumAt?: string;
  allowExistingPastValue?: string;
  onChange: (value: string) => void;
}) {
  const allOptions = useMemo(
    () => localDateOptions(eventStartAt, eventEndAt),
    [eventEndAt, eventStartAt],
  );
  const [date = '', time = ''] = value.split('T');
  const eventStartLocal = isoToVietnamLocal(eventStartAt);
  const eventEndLocal = isoToVietnamLocal(eventEndAt);
  const minimumLocal = minimumAt ? isoToVietnamLocal(minimumAt) : '';
  const minimumDate = minimumLocal.slice(0, 10);
  const preservingExistingPastValue = Boolean(
    minimumLocal
    && value === allowExistingPastValue
    && value < minimumLocal,
  );
  const options = allOptions.filter(option => (
    !minimumDate
    || option.value >= minimumDate
    || (preservingExistingPastValue && option.value === date)
  ));
  const startDate = eventStartLocal.slice(0, 10);
  const endDate = eventEndLocal.slice(0, 10);
  const minimumTime = preservingExistingPastValue
    ? undefined
    : date === minimumDate ? minimumLocal.slice(11, 16) : undefined;
  const eventStartTime = date === startDate ? eventStartLocal.slice(11, 16) : undefined;
  const effectiveMinimumTime = minimumTime && eventStartTime
    ? (minimumTime > eventStartTime ? minimumTime : eventStartTime)
    : minimumTime || eventStartTime;
  const chooseDate = (nextDate: string) => {
    if (!nextDate) { onChange(''); return; }
    const defaultTime = nextDate === startDate ? eventStartLocal.slice(11, 16) : '09:00';
    onChange(`${nextDate}T${time || defaultTime}`);
  };
  const chooseTime = (nextTime: string) => {
    if (!nextTime) { onChange(date ? `${date}T` : ''); return; }
    onChange(`${date || options[0]?.value || ''}T${nextTime}`);
  };

  return (
    <fieldset className="oaw-field oaw-datetime-field">
      <legend>{label} <b>*</b></legend>
      <div>
        <label>
          <span>Ngày trong sự kiện</span>
          <select aria-label={`${label} - ngày`} value={date} onChange={event => chooseDate(event.target.value)} required>
            <option value="">Chọn ngày</option>
            {options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </label>
        <label>
          <span>Giờ</span>
          <input
            aria-label={`${label} - giờ`}
            type="time"
            value={time}
            min={effectiveMinimumTime}
            max={date === endDate ? eventEndLocal.slice(11, 16) : undefined}
            step="300"
            onChange={event => chooseTime(event.target.value)}
            required
          />
        </label>
      </div>
    </fieldset>
  );
}

function DateTimePartsField({
  label,
  value,
  min,
  max,
  allowExistingPastValue,
  onChange,
}: {
  label: string;
  value: string;
  min?: string;
  max?: string;
  allowExistingPastValue?: string;
  onChange: (value: string) => void;
}) {
  const [date = '', time = ''] = value.split('T');
  const [minDate = '', minTime = ''] = (min || '').split('T');
  const [maxDate = '', maxTime = ''] = (max || '').split('T');
  const preservingExistingPastValue = Boolean(min && value === allowExistingPastValue && value < min);
  const effectiveMinDate = preservingExistingPastValue ? undefined : minDate || undefined;
  const effectiveMinTime = preservingExistingPastValue
    ? undefined
    : date && date === minDate ? minTime || undefined : undefined;
  return (
    <fieldset className="oaw-field oaw-datetime-field">
      <legend>{label} <b>*</b></legend>
      <div>
        <label>
          <span>Ngày</span>
          <DayFirstDateInput
            aria-label={`${label} - ngày`}
            type="date"
            value={date}
            min={effectiveMinDate}
            max={maxDate || undefined}
            onChange={event => onChange(event.target.value
              ? `${event.target.value}T${time || '17:00'}`
              : '')}
            required
          />
        </label>
        <label>
          <span>Giờ</span>
          <input
            aria-label={`${label} - giờ`}
            type="time"
            value={time}
            min={effectiveMinTime}
            max={date && date === maxDate ? maxTime || undefined : undefined}
            step="300"
            onChange={event => onChange(event.target.value
              ? `${date || maxDate}T${event.target.value}`
              : date ? `${date}T` : '')}
            required
          />
        </label>
      </div>
    </fieldset>
  );
}

function CreateActivityModal({
  event,
  onClose,
  onCreated,
}: {
  event: OrganizerEvent;
  onClose: () => void;
  onCreated: (activity: OrganizerActivityResponse) => void;
}) {
  const [form, setForm] = useState<CreateActivityForm>(EMPTY_ACTIVITY_FORM);
  const [locations, setLocations] = useState<OrganizerLocationResponse[]>([]);
  const [loadingLocations, setLoadingLocations] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [minimumFutureAt] = useState(nextMinuteIso);

  useEffect(() => {
    let active = true;
    void organizerApi.listActivityLocations({ active: true })
      .then(response => {
        if (!active) return;
        setLocations(response.content.filter(location => location.active && location.locationType !== 'BOOTH'));
      })
      .catch(cause => {
        if (active) setError(userFacingError(cause, 'Không tải được danh sách địa điểm.'));
      })
      .finally(() => { if (active) setLoadingLocations(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const closeOnEscape = (keyboardEvent: KeyboardEvent) => {
      if (keyboardEvent.key === 'Escape' && !submitting) onClose();
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [onClose, submitting]);

  const selectedLocation = locations.find(location => String(location.locationId) === form.locationId);
  const setField = <K extends keyof CreateActivityForm>(field: K, value: CreateActivityForm[K]) => {
    setForm(current => ({ ...current, [field]: value }));
    setError('');
  };

  const validate = (): string => {
    const title = form.title.trim().replace(/\s+/g, ' ');
    const activityType = form.activityType.trim().replace(/\s+/g, ' ');
    const capacity = Number(form.capacity);
    if (!title || title.length > 200) return 'Tên hoạt động phải có từ 1 đến 200 ký tự.';
    if (!activityType || activityType.length > 50) return 'Loại hoạt động phải có từ 1 đến 50 ký tự.';
    if (!selectedLocation) return 'Vui lòng chọn một địa điểm đang hoạt động.';
    if (!Number.isInteger(capacity) || capacity < 1) return 'Sức chứa phải là số nguyên dương.';
    if (capacity > selectedLocation.maxCapacity) return `Sức chứa không được vượt quá ${selectedLocation.maxCapacity} người của địa điểm.`;
    if (!form.startAt || !form.endAt) return 'Vui lòng nhập đầy đủ thời gian bắt đầu và kết thúc.';
    const startAt = new Date(vietnamLocalToIso(form.startAt));
    const endAt = new Date(vietnamLocalToIso(form.endAt));
    if (startAt >= endAt) return 'Thời gian kết thúc phải sau thời gian bắt đầu.';
    if (startAt <= new Date()) return 'Thời gian bắt đầu phải ở tương lai.';
    if (startAt < new Date(event.startDate) || endAt > new Date(event.endDate)) return 'Thời gian hoạt động phải nằm hoàn toàn trong thời gian sự kiện.';
    if (form.description.trim().length > 5000) return 'Mô tả không được vượt quá 5.000 ký tự.';
    if (form.registrationRequired) {
      if (form.attendanceEarlyScanMinutes !== '' && (!Number.isInteger(Number(form.attendanceEarlyScanMinutes)) || Number(form.attendanceEarlyScanMinutes) < 0 || Number(form.attendanceEarlyScanMinutes) > 1440)) return 'Thời gian mở QR phải là số phút từ 0 đến 1440.';
      if (!form.registrationDeadlineAt) return 'Hoạt động yêu cầu đăng ký phải có hạn đăng ký.';
      const deadline = new Date(vietnamLocalToIso(form.registrationDeadlineAt));
      if (deadline < new Date() || deadline > startAt) return 'Hạn đăng ký phải từ thời điểm hiện tại đến trước hoặc đúng lúc hoạt động bắt đầu.';
    }
    return '';
  };

  const submit = async (submitEvent: React.FormEvent) => {
    submitEvent.preventDefault();
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const activity = await organizerApi.createActivity({
        eventId: Number(event.id),
        locationId: Number(form.locationId),
        title: form.title.trim().replace(/\s+/g, ' '),
        description: form.description.trim() || null,
        activityType: form.activityType.trim().replace(/\s+/g, ' '),
        startAt: vietnamLocalToIso(form.startAt),
        endAt: vietnamLocalToIso(form.endAt),
        capacity: Number(form.capacity),
        imageUrl: null,
        registrationRequired: form.registrationRequired,
        registrationDeadlineAt: form.registrationRequired ? vietnamLocalToIso(form.registrationDeadlineAt) : null,
        certificateEnabled: form.registrationRequired && form.certificateEnabled,
        attendanceEarlyScanMinutes: form.registrationRequired && form.attendanceEarlyScanMinutes !== ''
          ? Number(form.attendanceEarlyScanMinutes) : undefined,
      });
      onCreated(activity);
    } catch (cause) {
      setError(userFacingError(cause, 'Không thể tạo hoạt động. Vui lòng kiểm tra dữ liệu và thử lại.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="oaw-modal-backdrop" role="presentation" onMouseDown={mouseEvent => { if (mouseEvent.target === mouseEvent.currentTarget && !submitting) onClose(); }}>
      <section className="oaw-modal oaw-create-modal" role="dialog" aria-modal="true" aria-labelledby="oaw-create-title">
        <header>
          <div><h2 id="oaw-create-title">Hoạt động mới</h2></div>
          <button type="button" onClick={onClose} disabled={submitting} aria-label="Đóng"><X size={21} /></button>
        </header>
        <form onSubmit={submit}>
          <div className="oaw-modal-body">
            <div className="oaw-create-event"><CalendarDays size={18} /><span><small>Sự kiện</small><strong>{event.title}</strong></span></div>
            <div className="oaw-form-grid">
              <label className="oaw-field oaw-field--wide"><span>Tên hoạt động <b>*</b></span><input value={form.title} onChange={e => setField('title', e.target.value)} maxLength={200} placeholder="Ví dụ: Lễ khai mạc" /></label>
              <label className="oaw-field"><span>Loại hoạt động <b>*</b></span><input value={form.activityType} onChange={e => setField('activityType', e.target.value)} maxLength={50} placeholder="Ví dụ: Khai mạc, tọa đàm..." /></label>
              <label className="oaw-field"><span>Địa điểm <b>*</b></span><select value={form.locationId} onChange={e => setField('locationId', e.target.value)} disabled={loadingLocations}><option value="">{loadingLocations ? 'Đang tải địa điểm...' : 'Chọn địa điểm'}</option>{locations.map(location => <option key={location.locationId} value={location.locationId}>{location.code} · {location.name} (tối đa {location.maxCapacity})</option>)}</select></label>
              <EventDateTimeField label="Bắt đầu" value={form.startAt} eventStartAt={event.startDate} eventEndAt={event.endDate} minimumAt={minimumFutureAt} onChange={value => setField('startAt', value)} />
              <EventDateTimeField label="Kết thúc" value={form.endAt} eventStartAt={event.startDate} eventEndAt={event.endDate} minimumAt={form.startAt ? (vietnamLocalToIso(form.startAt) > minimumFutureAt ? vietnamLocalToIso(form.startAt) : minimumFutureAt) : minimumFutureAt} onChange={value => setField('endAt', value)} />
              <label className="oaw-field"><span>Sức chứa <b>*</b></span><input type="number" min="1" max={selectedLocation?.maxCapacity} value={form.capacity} onChange={e => setField('capacity', e.target.value)} placeholder={selectedLocation ? `Tối đa ${selectedLocation.maxCapacity}` : 'Số người'} /></label>
              <label className="oaw-field oaw-field--wide"><span>Mô tả</span><textarea value={form.description} onChange={e => setField('description', e.target.value)} maxLength={5000} rows={4} placeholder="Mô tả nội dung hoạt động..." /><small>{form.description.length}/5000</small></label>
            </div>
            <div className="oaw-registration-box">
              <label><input type="checkbox" checked={form.registrationRequired} onChange={e => setField('registrationRequired', e.target.checked)} /><span><strong>Yêu cầu người tham gia đăng ký</strong><small>Bật cấu hình hạn đăng ký và QR điểm danh.</small></span></label>
              {form.registrationRequired && <div>
                <DateTimePartsField label="Hạn đăng ký" value={form.registrationDeadlineAt} min={isoToVietnamLocal(minimumFutureAt)} max={form.startAt || undefined} onChange={value => setField('registrationDeadlineAt', value)} />
                <label className="oaw-field"><span>Mở quét QR trước giờ bắt đầu (phút)</span><input type="number" min="0" max="1440" step="1" value={form.attendanceEarlyScanMinutes} onChange={e => setField('attendanceEarlyScanMinutes', e.target.value)} placeholder="Để trống: 15 phút" /></label>
                <label className="oaw-check"><input type="checkbox" checked={form.certificateEnabled} onChange={e => setField('certificateEnabled', e.target.checked)} /> Cấp chứng nhận tham gia</label>
              </div>}
            </div>
            {locations.length === 0 && !loadingLocations && !error && <p className="oaw-form-hint">Chưa có địa điểm dùng chung đang hoạt động. Hãy tạo Sân khấu, Khu vực hoặc Phòng workshop trước.</p>}
            {error && <p className="oaw-action-error" role="alert">{error}</p>}
          </div>
          <footer>
            <p>Hoạt động được tạo ở trạng thái Bản nháp và chưa hiển thị công khai.</p>
            <div className="oaw-modal-actions">
              <button type="button" className="oaw-btn-secondary" onClick={onClose} disabled={submitting}>Hủy</button>
              <button type="submit" className="oaw-btn-approve" disabled={submitting || loadingLocations || locations.length === 0}>{submitting ? 'Đang tạo...' : 'Tạo bản nháp'}</button>
            </div>
          </footer>
        </form>
      </section>
    </div>
  );
}

type ReviewAction = 'approve' | 'reject' | 'requestChanges' | 'publish' | 'cancel';

function AttendanceQrPanel({ activity, expanded, onToggle }: {
  activity: OrganizerActivityResponse;
  expanded: boolean;
  onToggle: () => void;
}) {
  const qrRef = useRef<SVGSVGElement | null>(null);
  const token = activity.attendanceQrToken;
  const scanUrl = token
    ? `${window.location.origin}/participant/attendance/scan?token=${encodeURIComponent(token)}`
    : '';

  const downloadQr = () => {
    const svg = qrRef.current;
    if (!svg) return;
    const serialized = new XMLSerializer().serializeToString(svg);
    const blob = new Blob([serialized], { type: 'image/svg+xml;charset=utf-8' });
    const downloadUrl = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = downloadUrl;
    anchor.download = `activity-${activity.activityId}-attendance-qr.svg`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(downloadUrl);
  };

  return (
    <section className="oaw-attendance-qr" aria-labelledby={`attendance-qr-${activity.activityId}`}>
      <div>
        <span className="oaw-attendance-qr-icon" aria-hidden="true"><QrCode size={20} /></span>
        <div>
          <strong id={`attendance-qr-${activity.activityId}`}>QR điểm danh của hoạt động</strong>
          <p>Một mã dùng chung tại địa điểm. Độc giả đăng nhập và tự quét bằng tài khoản đã đăng ký.</p>
        </div>
      </div>
      {!token ? (
        <p className="oaw-attendance-qr-unavailable">
          {activity.status === 'DRAFT'
            ? 'QR được tạo khi hoạt động yêu cầu đăng ký được công bố.'
            : 'QR chưa khả dụng. Hãy đóng và mở lại chi tiết để tải dữ liệu mới nhất.'}
        </p>
      ) : (
        <>
          <button type="button" className="oaw-btn-secondary" onClick={onToggle} aria-expanded={expanded}>
            <QrCode size={16} />{expanded ? 'Ẩn mã QR' : 'Hiển thị mã QR'}
          </button>
          {expanded && (
            <div className="oaw-attendance-qr-content">
              <div className="oaw-attendance-qr-code">
                <QRCodeSVG
                  ref={qrRef}
                  value={scanUrl}
                  size={232}
                  level="M"
                  marginSize={2}
                  title={`QR điểm danh hoạt động ${activity.title}`}
                />
              </div>
              <div className="oaw-attendance-qr-instructions">
                <strong>Hướng dẫn tại địa điểm</strong>
                <ol>
                  <li>Hiển thị mã này trên màn hình hoặc bản in của Ban tổ chức.</li>
                  <li>Độc giả quét bằng camera điện thoại và đăng nhập tài khoản của chính mình.</li>
                  <li>Hệ thống xác nhận thời gian và đăng ký; không nhập mã người dùng thủ công.</li>
                </ol>
                <button type="button" className="oaw-btn-secondary" onClick={downloadQr}><Download size={16} />Tải QR dạng SVG</button>
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}

function RecordDetailModal({
  record: initialRecord,
  event: currentEvent,
  relatedActivity,
  sourceProposal,
  onClose,
  onOpenActivity,
  onOpenProposal,
  onCompleted,
}: {
  record: WorkspaceRecord;
  event?: OrganizerEvent;
  relatedActivity?: OrganizerActivityResponse;
  sourceProposal?: OrganizerActivityProposalResponse;
  onClose: () => void;
  onOpenActivity?: () => void;
  onOpenProposal?: () => void;
  onCompleted: (message: string) => void;
}) {
  const [record, setRecord] = useState<WorkspaceRecord>(initialRecord);
  const organizationLocked = isOrganizationLocked(record);
  const [revisions, setRevisions] = useState<OrganizerActivityRevisionResponse[]>([]);
  const [detailLoading, setDetailLoading] = useState(true);
  const [detailError, setDetailError] = useState('');
  const [editing, setEditing] = useState(false);
  const [reviewAction, setReviewAction] = useState<ReviewAction | null>(null);
  const [reviewNote, setReviewNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [actionError, setActionError] = useState('');
  const [qrExpanded, setQrExpanded] = useState(false);
  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [onClose]);

  useEffect(() => {
    let active = true;
    const detailRequest = isActivity(initialRecord)
      ? organizerApi.getActivity(initialRecord.activityId)
      : isProposal(initialRecord)
        ? organizerApi.getActivityProposal(initialRecord.activityProposalId)
        : isChangeRequest(initialRecord)
          ? organizerApi.getActivityChangeRequest(initialRecord.activityChangeRequestId)
          : organizerApi.getActivityCancellationRequest(initialRecord.activityCancellationRequestId);
    const revisionRequest = isActivity(initialRecord)
      ? organizerApi.getActivityRevisions(initialRecord.activityId)
      : Promise.resolve(null);

    // Detail state follows this remote request lifecycle.
    // oxlint-disable-next-line react/set-state-in-effect
    setDetailLoading(true);
    setDetailError('');
    void Promise.all([detailRequest, revisionRequest])
      .then(([detail, revisionPage]) => {
        if (!active) return;
        setRecord(detail);
        setRevisions(revisionPage?.content || []);
      })
      .catch(cause => {
        if (active) setDetailError(userFacingError(cause, 'Không tải được chi tiết mới nhất. Vui lòng thử lại.'));
      })
      .finally(() => { if (active) setDetailLoading(false); });
    return () => { active = false; };
  }, [initialRecord]);

  const title = isActivity(record) || isProposal(record) ? record.title : record.activity.title;
  const location = isActivity(record) || isProposal(record) ? record.location : record.activity.location;
  const startAt = isActivity(record) ? record.startAt : isProposal(record) ? record.proposedStartAt : record.activity.startAt;
  const endAt = isActivity(record) ? record.endAt : isProposal(record) ? record.proposedEndAt : record.activity.endAt;
  const isReviewable = !isActivity(record) && record.status === 'PENDING';
  const needsNote = reviewAction === 'reject' || reviewAction === 'requestChanges' || reviewAction === 'cancel';
  const canPublish = isActivity(record) && record.status === 'DRAFT';
  const canCancel = isActivity(record) && ['DRAFT', 'PUBLISHED', 'ONGOING'].includes(record.status);
  const canEdit = isActivity(record)
    && (record.sourceProposalId === null
      ? ['DRAFT', 'PUBLISHED'].includes(record.status)
      : record.status === 'DRAFT');
  const approveActionLabel = isProposal(record)
    ? 'Duyệt và tạo Activity'
    : isChangeRequest(record)
      ? 'Chấp nhận thay đổi'
      : 'Chấp nhận hủy hoạt động';
  const rejectActionLabel = isProposal(record)
    ? 'Từ chối đề xuất'
    : isChangeRequest(record)
      ? 'Từ chối thay đổi'
      : 'Từ chối hủy';

  const startAction = (action: ReviewAction) => {
    setReviewAction(action);
    setReviewNote('');
    setActionError('');
  };

  const submitReview = async () => {
    if (!reviewAction) return;
    if (organizationLocked && (reviewAction === 'approve' || reviewAction === 'requestChanges')) return;
    const note = reviewNote.trim();
    if (needsNote && note.length < 10) {
      setActionError(`Vui lòng nhập lý do rõ ràng, từ 10 đến ${reviewAction === 'cancel' ? '500' : '1.000'} ký tự.`);
      return;
    }
    if (reviewAction === 'cancel' && note.length > 500) {
      setActionError('Lý do hủy không được vượt quá 500 ký tự.');
      return;
    }
    setSubmitting(true);
    setActionError('');
    try {
      let message = '';
      if (isActivity(record)) {
        if (reviewAction === 'publish') {
          await organizerApi.publishActivity(record.activityId);
          message = `Đã công bố hoạt động “${record.title}”.`;
        } else if (reviewAction === 'cancel') {
          await organizerApi.cancelActivity(record.activityId, note);
          message = `Đã hủy hoạt động “${record.title}”.`;
        } else {
          return;
        }
      } else if (isProposal(record)) {
        if (reviewAction === 'approve') {
          await organizerApi.approveActivityProposal(record.activityProposalId);
          message = `Đã duyệt đề xuất “${record.title}” và tạo hoạt động chính thức.`;
        } else if (reviewAction === 'requestChanges') {
          await organizerApi.requestActivityProposalChanges(record.activityProposalId, note);
          message = `Đã gửi yêu cầu bổ sung cho đề xuất “${record.title}”.`;
        } else {
          await organizerApi.rejectActivityProposal(record.activityProposalId, note);
          message = `Đã từ chối đề xuất “${record.title}”.`;
        }
      } else if (isChangeRequest(record)) {
        if (reviewAction === 'approve') {
          await organizerApi.approveActivityChangeRequest(record.activityChangeRequestId);
          message = `Đã duyệt thay đổi cho “${record.activity.title}”.`;
        } else {
          await organizerApi.rejectActivityChangeRequest(record.activityChangeRequestId, note);
          message = `Đã từ chối yêu cầu thay đổi “${record.activity.title}”.`;
        }
      } else {
        if (reviewAction === 'approve') {
          await organizerApi.approveActivityCancellationRequest(record.activityCancellationRequestId);
          message = `Đã duyệt hủy hoạt động “${record.activity.title}”.`;
        } else {
          await organizerApi.rejectActivityCancellationRequest(record.activityCancellationRequestId, note);
          message = `Đã từ chối yêu cầu hủy “${record.activity.title}”.`;
        }
      }
      onCompleted(message);
    } catch (cause) {
      setActionError(userFacingError(cause, 'Không thể hoàn tất thao tác xét duyệt. Vui lòng thử lại.'));
    } finally {
      setSubmitting(false);
    }
  };

  if (editing && isActivity(record) && currentEvent) {
    return (
      <EditActivityModal
        activity={record}
        event={currentEvent}
        onBack={() => setEditing(false)}
        onSaved={activity => onCompleted(`Đã cập nhật hoạt động “${activity.title}”.`)}
      />
    );
  }

  return (
    <div className="oaw-modal-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="oaw-modal" role="dialog" aria-modal="true" aria-labelledby="oaw-modal-title">
        <header>
          <div><h2 id="oaw-modal-title">{title}</h2></div>
          <button type="button" onClick={onClose} aria-label="Đóng"><X size={21} /></button>
        </header>
        <div className="oaw-modal-body">
          {detailLoading && <p className="oaw-detail-loading" role="status">Đang tải chi tiết mới nhất...</p>}
          {detailError && <p className="oaw-action-error" role="alert">{detailError}</p>}
          <div className="oaw-detail-status"><StatusBadge kind={recordKind(record)} status={record.status} /></div>
          <dl className="oaw-detail-grid">
            <div><dt>{isProposal(record) ? 'Thời gian đề xuất' : 'Lịch hiện tại'}</dt><dd>{formatRange(startAt, endAt)}</dd></div>
            <div><dt>{isProposal(record) ? 'Địa điểm đề xuất' : 'Địa điểm hiện tại'}</dt><dd>{location.code} · {location.name}</dd></div>
            {(isProposal(record) || isChangeRequest(record) || isCancellationRequest(record)) && (
              <div><dt>Đối tác</dt><dd>{isProposal(record) ? record.partnerOrganizationName : record.activity.partnerOrganizationName}{organizationLocked && <span className="oaw-organization-locked">Tổ chức bị khóa</span>}</dd></div>
            )}
            {(isProposal(record) || isChangeRequest(record) || isCancellationRequest(record)) && (
              <div><dt>Gửi lúc</dt><dd>{formatDateTime(record.submittedAt)}</dd></div>
            )}
          </dl>

          {isActivity(record) && (
            <>
              <p className="oaw-detail-copy">{record.description || 'Không có mô tả.'}</p>
              <dl className="oaw-config-grid">
                <div><dt>Nguồn hoạt động</dt><dd>{record.sourceProposalId ? `Đề xuất #${record.sourceProposalId}` : 'Ban tổ chức tạo trực tiếp'}</dd></div>
                <div><dt>Đăng ký tham gia</dt><dd>{record.registrationRequired ? 'Có yêu cầu đăng ký' : 'Không yêu cầu đăng ký'}</dd></div>
                <div><dt>Hạn đăng ký</dt><dd>{record.registrationRequired ? formatDateTime(record.registrationDeadlineAt) : 'Không áp dụng'}</dd></div>
                <div><dt>Chứng nhận</dt><dd>{record.certificateEnabled ? 'Có cấp chứng nhận' : 'Không cấp chứng nhận'}</dd></div>
              </dl>
              {record.registrationRequired && (
                <AttendanceQrPanel activity={record} expanded={qrExpanded} onToggle={() => setQrExpanded(value => !value)} />
              )}
              {record.sourceProposalId && onOpenProposal && (
                <SourceProposalNotice proposalId={record.sourceProposalId} proposal={sourceProposal} onOpen={onOpenProposal} />
              )}
              <ActivityCancellationNotice activity={record} />
              <ActivityRevisionHistory revisions={revisions} loading={detailLoading} />
            </>
          )}
          {isProposal(record) && (
            <>
              <p className="oaw-detail-copy">{record.description || 'Đối tác không cung cấp mô tả.'}</p>
              {record.reviewNote && <div className="oaw-note"><strong>Ghi chú xét duyệt</strong><p>{record.reviewNote}</p></div>}
              {record.activityId && onOpenActivity && (
                <RelatedActivityNotice activityId={record.activityId} activity={relatedActivity} onOpen={onOpenActivity} />
              )}
            </>
          )}
          {isChangeRequest(record) && (
            <>
              <ChangeComparison request={record} />
              {onOpenActivity && (
                <RelatedActivityNotice activityId={record.activity.activityId} activity={relatedActivity} onOpen={onOpenActivity} />
              )}
            </>
          )}
          {isCancellationRequest(record) && (
            <>
              <div className="oaw-note oaw-note--danger">
                <strong>Lý do đề nghị hủy {record.late ? '· Yêu cầu trễ hạn' : ''}</strong>
                <p>{record.reason}</p>
                {record.reviewNote && <p><b>Phản hồi Ban tổ chức:</b> {record.reviewNote}</p>}
              </div>
              {onOpenActivity && (
                <RelatedActivityNotice activityId={record.activity.activityId} activity={relatedActivity} onOpen={onOpenActivity} />
              )}
            </>
          )}
        </div>
        <footer>
          {reviewAction ? (
            <div className="oaw-review-panel">
              <div>
                <strong>{reviewAction === 'approve'
                  ? approveActionLabel
                  : reviewAction === 'requestChanges'
                    ? 'Yêu cầu đối tác bổ sung'
                    : reviewAction === 'publish'
                      ? 'Công bố hoạt động'
                      : reviewAction === 'cancel'
                        ? 'Xác nhận hủy hoạt động'
                        : 'Xác nhận từ chối'}</strong>
                <p>{reviewAction === 'publish'
                  ? 'Sau khi công bố, hoạt động đủ điều kiện sẽ xuất hiện trên trang công khai.'
                  : reviewAction === 'cancel'
                    ? 'Hoạt động sẽ ngừng hiệu lực và lý do hủy được lưu công khai.'
                    : reviewAction === 'approve'
                  ? (isCancellationRequest(record)
                    ? 'Hoạt động sẽ bị hủy sau khi xác nhận.'
                    : 'Hệ thống sẽ áp dụng nội dung được duyệt ngay sau khi xác nhận.')
                  : 'Nội dung này sẽ được gửi đến đối tác.'}</p>
              </div>
              {needsNote && (
                <label>
                  <span>Lý do <b>*</b></span>
                  <textarea
                    value={reviewNote}
                    onChange={event => setReviewNote(event.target.value)}
                    maxLength={reviewAction === 'cancel' ? 500 : 1000}
                    rows={3}
                    placeholder={reviewAction === 'requestChanges'
                      ? 'Nêu rõ nội dung đối tác cần bổ sung...'
                      : reviewAction === 'cancel'
                        ? 'Nêu rõ lý do hủy hoạt động...'
                        : 'Nêu rõ lý do từ chối...'}
                    autoFocus
                  />
                  <small>{reviewNote.length}/{reviewAction === 'cancel' ? 500 : 1000}</small>
                </label>
              )}
              {actionError && <p className="oaw-action-error" role="alert">{actionError}</p>}
              <div className="oaw-review-buttons">
                <button type="button" className="oaw-btn-secondary" onClick={() => setReviewAction(null)} disabled={submitting}>Quay lại</button>
                <button type="button" className={reviewAction === 'approve' ? 'oaw-btn-approve' : 'oaw-btn-danger'} onClick={() => void submitReview()} disabled={submitting || (organizationLocked && (reviewAction === 'approve' || reviewAction === 'requestChanges'))}>
                  {submitting ? 'Đang xử lý...' : 'Xác nhận'}
                </button>
              </div>
            </div>
          ) : (
            <>
              <button type="button" className="oaw-btn-secondary" onClick={onClose}>Đóng</button>
              {isReviewable && (
                <div className="oaw-modal-actions">
                  {isProposal(record) && <button type="button" className="oaw-btn-warning" onClick={() => startAction('requestChanges')} disabled={organizationLocked}>Yêu cầu bổ sung</button>}
                  <button type="button" className="oaw-btn-danger" onClick={() => startAction('reject')}>{rejectActionLabel}</button>
                  <button type="button" className="oaw-btn-approve" onClick={() => startAction('approve')} disabled={organizationLocked}>{approveActionLabel}</button>
                </div>
              )}
              {isActivity(record) && (canPublish || canCancel) && (
                <div className="oaw-modal-actions">
                  {canEdit && <button type="button" className="oaw-btn-secondary" onClick={() => setEditing(true)} disabled={detailLoading || Boolean(detailError)}>Chỉnh sửa</button>}
                  {canCancel && <button type="button" className="oaw-btn-danger" onClick={() => startAction('cancel')}>Hủy hoạt động</button>}
                  {canPublish && <button type="button" className="oaw-btn-approve" onClick={() => startAction('publish')}>Công bố</button>}
                </div>
              )}
            </>
          )}
        </footer>
      </section>
    </div>
  );
}

function ActivityRevisionHistory({
  revisions,
  loading,
}: {
  revisions: OrganizerActivityRevisionResponse[];
  loading: boolean;
}) {
  const sourceLabel: Record<OrganizerActivityRevisionResponse['revisionSource'], string> = {
    ORGANIZER_DIRECT: 'Ban tổ chức chỉnh sửa',
    PARTNER_REQUEST: 'Duyệt yêu cầu đối tác',
    EVENT_CANCELLATION: 'Hủy theo sự kiện',
    SYSTEM: 'Hệ thống',
  };
  const fieldLabels: Record<string, string> = {
    title: 'Tên', description: 'Mô tả', activityType: 'Loại', locationId: 'Địa điểm',
    startAt: 'Bắt đầu', endAt: 'Kết thúc', capacity: 'Sức chứa', imageUrl: 'Hình ảnh',
    registrationRequired: 'Yêu cầu đăng ký', registrationDeadlineAt: 'Hạn đăng ký',
    certificateEnabled: 'Chứng nhận',
  };

  return (
    <section className="oaw-revisions" aria-label="Lịch sử chỉnh sửa">
      <div className="oaw-section-heading"><div><h3>Revision đã lưu</h3></div><b>{revisions.length}</b></div>
      {loading ? <p>Đang tải lịch sử...</p> : revisions.length === 0 ? (
        <p>Hoạt động chưa có bản chỉnh sửa nào.</p>
      ) : <PaginatedList items={revisions}>{pageItems => pageItems.map(revision => {
        const changedFields = Object.keys(revision.newSnapshot).filter(key =>
          JSON.stringify(revision.oldSnapshot[key]) !== JSON.stringify(revision.newSnapshot[key]));
        return (
          <article key={revision.activityRevisionId}>
            <div><strong>{sourceLabel[revision.revisionSource]}</strong><time>{formatDateTime(revision.changedAt)}</time></div>
            <p>{revision.changeReason || 'Cập nhật cấu hình khi hoạt động còn ở bản nháp.'}</p>
            <small>{changedFields.length > 0
              ? `Trường thay đổi: ${changedFields.map(field => fieldLabels[field] || field).join(', ')}`
              : 'Đã lưu snapshot kiểm toán.'}</small>
          </article>
        );
      })}</PaginatedList>}
    </section>
  );
}

function editFormFromActivity(activity: OrganizerActivityResponse): CreateActivityForm {
  return {
    title: activity.title,
    description: activity.description || '',
    activityType: activity.activityType,
    locationId: String(activity.location.locationId),
    startAt: isoToVietnamLocal(activity.startAt),
    endAt: isoToVietnamLocal(activity.endAt),
    capacity: String(activity.capacity),
    registrationRequired: activity.registrationRequired,
    registrationDeadlineAt: activity.registrationDeadlineAt
      ? isoToVietnamLocal(activity.registrationDeadlineAt)
      : '',
    certificateEnabled: activity.certificateEnabled,
    attendanceEarlyScanMinutes: String(activity.attendanceEarlyScanMinutes ?? 15),
  };
}

function EditActivityModal({
  activity,
  event,
  onBack,
  onSaved,
}: {
  activity: OrganizerActivityResponse;
  event: OrganizerEvent;
  onBack: () => void;
  onSaved: (activity: OrganizerActivityResponse) => void;
}) {
  const initialForm = useMemo(() => editFormFromActivity(activity), [activity]);
  const [form, setForm] = useState<CreateActivityForm>(initialForm);
  const [locations, setLocations] = useState<OrganizerLocationResponse[]>([]);
  const [changeReason, setChangeReason] = useState('');
  const [loadingLocations, setLoadingLocations] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [minimumFutureAt] = useState(nextMinuteIso);
  const coreEditable = activity.sourceProposalId === null;

  useEffect(() => {
    let active = true;
    void organizerApi.listActivityLocations({ active: true })
      .then(response => {
        if (!active) return;
        const shared = response.content.filter(location => location.locationType !== 'BOOTH');
        if (!shared.some(location => location.locationId === activity.location.locationId)
          && activity.location.locationType !== 'BOOTH') {
          shared.unshift({
            ...activity.location,
            description: null,
            mapX: null,
            mapY: null,
            boothAssignmentId: null,
            eligible: false,
            ineligibleReason: 'Địa điểm hiện không hoạt động',
          });
        }
        setLocations(shared);
      })
      .catch(cause => setError(userFacingError(cause, 'Không tải được danh sách địa điểm.')))
      .finally(() => { if (active) setLoadingLocations(false); });
    return () => { active = false; };
  }, [activity.location]);

  const selectedLocation = locations.find(location => String(location.locationId) === form.locationId);
  const setField = <K extends keyof CreateActivityForm>(field: K, value: CreateActivityForm[K]) => {
    setForm(current => ({ ...current, [field]: value }));
    setError('');
  };

  const buildPayload = (): UpdateOrganizerActivityRequest => {
    const payload: UpdateOrganizerActivityRequest = {};
    const normalizedTitle = form.title.trim().replace(/\s+/g, ' ');
    const normalizedType = form.activityType.trim().replace(/\s+/g, ' ');
    const description = form.description.trim() || null;
    if (coreEditable && normalizedTitle !== activity.title) payload.title = normalizedTitle;
    if (coreEditable && description !== activity.description) payload.description = description;
    if (coreEditable && normalizedType !== activity.activityType) payload.activityType = normalizedType;
    if (coreEditable && Number(form.locationId) !== activity.location.locationId) payload.locationId = Number(form.locationId);
    if (coreEditable && (form.startAt !== initialForm.startAt || form.endAt !== initialForm.endAt)) {
      payload.startAt = vietnamLocalToIso(form.startAt);
      payload.endAt = vietnamLocalToIso(form.endAt);
    }
    if (coreEditable && Number(form.capacity) !== activity.capacity) payload.capacity = Number(form.capacity);
    if (form.registrationRequired !== activity.registrationRequired) payload.registrationRequired = form.registrationRequired;
    const deadline = form.registrationRequired && form.registrationDeadlineAt
      ? vietnamLocalToIso(form.registrationDeadlineAt)
      : null;
    const deadlineChanged = deadline === null || activity.registrationDeadlineAt === null
      ? deadline !== activity.registrationDeadlineAt
      : new Date(deadline).getTime() !== new Date(activity.registrationDeadlineAt).getTime();
    if (deadlineChanged) payload.registrationDeadlineAt = deadline;
    const certificateEnabled = form.registrationRequired && form.certificateEnabled;
    if (certificateEnabled !== activity.certificateEnabled) payload.certificateEnabled = certificateEnabled;
    const earlyScanMinutes = form.attendanceEarlyScanMinutes === '' ? 15 : Number(form.attendanceEarlyScanMinutes);
    if (earlyScanMinutes !== activity.attendanceEarlyScanMinutes) payload.attendanceEarlyScanMinutes = earlyScanMinutes;
    return payload;
  };

  const validate = (payload: UpdateOrganizerActivityRequest): string => {
    if (form.attendanceEarlyScanMinutes !== '' && (!Number.isInteger(Number(form.attendanceEarlyScanMinutes)) || Number(form.attendanceEarlyScanMinutes) < 0 || Number(form.attendanceEarlyScanMinutes) > 1440)) return 'Thời gian mở QR phải là số phút từ 0 đến 1440.';
    const capacity = Number(form.capacity);
    if (coreEditable && (!form.title.trim() || form.title.trim().length > 200)) return 'Tên hoạt động phải có từ 1 đến 200 ký tự.';
    if (coreEditable && (!form.activityType.trim() || form.activityType.trim().length > 50)) return 'Loại hoạt động phải có từ 1 đến 50 ký tự.';
    if (coreEditable && !selectedLocation) return 'Vui lòng chọn địa điểm dùng chung đang hợp lệ.';
    if (coreEditable && (!Number.isInteger(capacity) || capacity < 1 || (selectedLocation && capacity > selectedLocation.maxCapacity))) return 'Sức chứa phải là số nguyên dương và không vượt sức chứa địa điểm.';
    if (coreEditable && (!form.startAt || !form.endAt || new Date(vietnamLocalToIso(form.startAt)) >= new Date(vietnamLocalToIso(form.endAt)))) return 'Thời gian kết thúc phải sau thời gian bắt đầu.';
    if (payload.startAt && new Date(payload.startAt).getTime() <= Date.now()) return 'Thời gian bắt đầu mới phải ở tương lai.';
    if (coreEditable && (new Date(vietnamLocalToIso(form.startAt)) < new Date(event.startDate) || new Date(vietnamLocalToIso(form.endAt)) > new Date(event.endDate))) return 'Thời gian hoạt động phải nằm hoàn toàn trong sự kiện.';
    if (form.registrationRequired) {
      if (!form.registrationDeadlineAt) return 'Hoạt động yêu cầu đăng ký phải có hạn đăng ký.';
      const deadline = new Date(vietnamLocalToIso(form.registrationDeadlineAt));
      const start = new Date(vietnamLocalToIso(form.startAt));
      if (payload.registrationDeadlineAt && deadline.getTime() < Date.now()) return 'Hạn đăng ký mới không được ở trong quá khứ.';
      if (deadline > start) return 'Hạn đăng ký không được sau thời điểm bắt đầu.';
    }
    if (Object.keys(payload).length === 0) return 'Bạn chưa thay đổi nội dung nào.';
    if (activity.status === 'PUBLISHED') {
      const reason = changeReason.trim().replace(/\s+/g, ' ');
      if (reason.length < 10 || reason.length > 500) return 'Hoạt động đã công bố cần lý do thay đổi từ 10 đến 500 ký tự.';
    }
    return '';
  };

  const submit = async (submitEvent: React.FormEvent) => {
    submitEvent.preventDefault();
    const payload = buildPayload();
    const validationError = validate(payload);
    if (validationError) { setError(validationError); return; }
    if (activity.status === 'PUBLISHED') payload.changeReason = changeReason.trim().replace(/\s+/g, ' ');
    setSubmitting(true);
    setError('');
    try {
      onSaved(await organizerApi.updateActivity(activity.activityId, payload));
    } catch (cause) {
      setError(userFacingError(cause, 'Không thể cập nhật hoạt động. Vui lòng kiểm tra dữ liệu và thử lại.'));
    } finally { setSubmitting(false); }
  };

  return (
    <div className="oaw-modal-backdrop" role="presentation">
      <section className="oaw-modal oaw-create-modal" role="dialog" aria-modal="true" aria-labelledby="oaw-edit-title">
        <header><div><h2 id="oaw-edit-title">Chỉnh sửa “{activity.title}”</h2></div><button type="button" onClick={onBack} disabled={submitting} aria-label="Quay lại"><X size={21} /></button></header>
        <form onSubmit={submit}>
          <div className="oaw-modal-body">
            {!coreEditable && <p className="oaw-form-hint">Hoạt động bắt nguồn từ đề xuất đã duyệt. Ban tổ chức chỉ cấu hình hình ảnh, đăng ký và chứng nhận; nội dung cốt lõi phải đi qua yêu cầu thay đổi của đối tác.</p>}
            <div className="oaw-form-grid">
              <label className="oaw-field oaw-field--wide"><span>Tên hoạt động</span><input disabled={!coreEditable} value={form.title} onChange={e => setField('title', e.target.value)} maxLength={200} /></label>
              <label className="oaw-field"><span>Loại hoạt động</span><input disabled={!coreEditable} value={form.activityType} onChange={e => setField('activityType', e.target.value)} maxLength={50} /></label>
              <label className="oaw-field"><span>Địa điểm</span><select disabled={!coreEditable || loadingLocations} value={form.locationId} onChange={e => setField('locationId', e.target.value)}>{activity.location.locationType === 'BOOTH' && <option value={activity.location.locationId}>{activity.location.code} · {activity.location.name}</option>}{locations.map(location => <option key={location.locationId} value={location.locationId}>{location.code} · {location.name}</option>)}</select></label>
              {coreEditable ? <EventDateTimeField label="Bắt đầu" value={form.startAt} eventStartAt={event.startDate} eventEndAt={event.endDate} minimumAt={minimumFutureAt} allowExistingPastValue={initialForm.startAt} onChange={value => setField('startAt', value)} /> : <label className="oaw-field"><span>Bắt đầu</span><input disabled value={formatDateTime(activity.startAt)} /></label>}
              {coreEditable ? <EventDateTimeField label="Kết thúc" value={form.endAt} eventStartAt={event.startDate} eventEndAt={event.endDate} minimumAt={form.startAt ? (vietnamLocalToIso(form.startAt) > minimumFutureAt ? vietnamLocalToIso(form.startAt) : minimumFutureAt) : minimumFutureAt} allowExistingPastValue={initialForm.endAt} onChange={value => setField('endAt', value)} /> : <label className="oaw-field"><span>Kết thúc</span><input disabled value={formatDateTime(activity.endAt)} /></label>}
              <label className="oaw-field"><span>Sức chứa</span><input disabled={!coreEditable} type="number" min="1" max={selectedLocation?.maxCapacity} value={form.capacity} onChange={e => setField('capacity', e.target.value)} /></label>
              <label className="oaw-field oaw-field--wide"><span>Mô tả</span><textarea disabled={!coreEditable} rows={4} maxLength={5000} value={form.description} onChange={e => setField('description', e.target.value)} /></label>
            </div>
            <div className="oaw-registration-box">
              <label><input type="checkbox" checked={form.registrationRequired} onChange={e => setField('registrationRequired', e.target.checked)} /><span><strong>Yêu cầu người tham gia đăng ký</strong><small>Cấu hình trước khi công bố hoạt động.</small></span></label>
              {form.registrationRequired && <div><DateTimePartsField label="Hạn đăng ký" value={form.registrationDeadlineAt} min={isoToVietnamLocal(minimumFutureAt)} max={form.startAt} allowExistingPastValue={initialForm.registrationDeadlineAt} onChange={value => setField('registrationDeadlineAt', value)} /><label className="oaw-field"><span>Mở quét QR trước giờ bắt đầu (phút)</span><input type="number" min="0" max="1440" step="1" value={form.attendanceEarlyScanMinutes} onChange={e => setField('attendanceEarlyScanMinutes', e.target.value)} placeholder="Để trống: 15 phút" /></label><label className="oaw-check"><input type="checkbox" checked={form.certificateEnabled} onChange={e => setField('certificateEnabled', e.target.checked)} /> Cấp chứng nhận tham gia</label></div>}
            </div>
            {activity.status === 'PUBLISHED' && <label className="oaw-field oaw-change-reason"><span>Lý do thay đổi <b>*</b></span><textarea rows={3} minLength={10} maxLength={500} value={changeReason} onChange={e => { setChangeReason(e.target.value); setError(''); }} placeholder="Giải thích rõ lý do cập nhật hoạt động đã công bố..." /><small>{changeReason.length}/500</small></label>}
            {error && <p className="oaw-action-error" role="alert">{error}</p>}
          </div>
          <footer><p>Mỗi thay đổi hợp lệ được lưu vào revision để kiểm toán.</p><div className="oaw-modal-actions"><button type="button" className="oaw-btn-secondary" onClick={onBack} disabled={submitting}>Quay lại</button><button type="submit" className="oaw-btn-approve" disabled={submitting || loadingLocations}>{submitting ? 'Đang lưu...' : 'Lưu thay đổi'}</button></div></footer>
        </form>
      </section>
    </div>
  );
}

function ChangeComparison({ request }: { request: OrganizerActivityChangeRequestResponse }) {
  const rows = [
    ['Tên hoạt động', request.activity.title, request.requestedTitle],
    ['Loại hoạt động', request.activity.activityType, request.requestedActivityType],
    ['Địa điểm', request.activity.location.name, request.requestedLocation?.name],
    ['Bắt đầu', formatDateTime(request.activity.startAt), request.requestedStartAt ? formatDateTime(request.requestedStartAt) : null],
    ['Kết thúc', formatDateTime(request.activity.endAt), request.requestedEndAt ? formatDateTime(request.requestedEndAt) : null],
    ['Sức chứa', `${request.activity.capacity} người`, request.requestedCapacity !== null ? `${request.requestedCapacity} người` : null],
    ['Hình ảnh', request.activity.imageUrl || 'Trống', request.requestedImageUrlIncluded ? request.requestedImageUrl || 'Trống' : null],
  ].filter(row => row[2] !== null && row[2] !== undefined);

  return (
    <div className="oaw-comparison">
      <div className="oaw-note"><strong>Lý do thay đổi</strong><p>{request.reason}</p></div>
      <h3>Nội dung đề nghị thay đổi</h3>
      {rows.length === 0 && !request.requestedDescriptionIncluded && !request.requestedImageUrlIncluded
        ? <p>Không có trường thay đổi.</p>
        : rows.map(([label, current, requested]) => (
          <div className="oaw-comparison-row" key={label}>
            <strong>{label}</strong><span>{current}</span><span>{requested}</span>
          </div>
        ))}
      {request.requestedDescriptionIncluded && (
        <div className="oaw-comparison-row"><strong>Mô tả</strong><span>{request.activity.description || 'Trống'}</span><span>{request.requestedDescription || 'Trống'}</span></div>
      )}
      {request.reviewNote && <div className="oaw-note"><strong>Phản hồi Ban tổ chức</strong><p>{request.reviewNote}</p></div>}
    </div>
  );
}
