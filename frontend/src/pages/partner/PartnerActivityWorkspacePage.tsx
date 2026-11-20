import { DayFirstDateInput } from '../../components/ui/DayFirstDateInput';
import { getPageCount, toPageIndex, LIST_PAGE_SIZE } from '../../constants/pagination';
import { ListPagination } from '../../components/ui/ListPagination';
import { ImageUrlField } from '../../components/ui/ImageUrlField';
import { contentImageApi } from '../../services/contentImageApi';
import { PaginatedList } from '../../components/ui/PaginatedList';
import {
  AlertCircle,
  Ban,
  CalendarDays,
  Clock3,
  Eye,
  FilePenLine,
  History,
  Layers3,
  MapPin,
  Plus,
  RefreshCw,
  Search,
  Users,
} from 'lucide-react';
import React, { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { PartnerDialog } from '../../components/partner/PartnerDialog';
import { usePartnerOrganizationLocked } from './PartnerOrganizationStatusContext';
import { SearchFieldLabel } from '../../components/ui/SearchFieldLabel';
import { WorkspaceFieldLabel } from '../../components/ui/WorkspaceFieldLabel';
import { partnerApi } from '../../services/partnerApi';
import type { Language, PartnerEventApplication } from '../../types';
import type {
  ActivityProposalStatus,
  ActivityRequestStatus,
  ActivityStatus,
  CreatePartnerActivityChangeRequest,
  OrganizerLocationResponse,
  PartnerActivityCancellationRequestResponse,
  PartnerActivityChangeRequestResponse,
  PartnerActivityProposalResponse,
  PartnerActivityResponse,
  PartnerActivityRevisionResponse,
} from '../../types/activity';
import {
  activityStatusLabel,
  activityStatusTone,
  cancellationSourceLabel,
  type ActivityRecordKind,
} from '../../utils/activityPresentation';
import './PartnerActivityWorkspacePage.css';

type WorkspaceView = 'proposals' | 'activities' | 'changes' | 'cancellations';
type WorkspaceRecord = PartnerActivityProposalResponse | PartnerActivityResponse
  | PartnerActivityChangeRequestResponse | PartnerActivityCancellationRequestResponse;

interface Props {
  language: Language;
  applications: PartnerEventApplication[];
}

interface PageMeta {
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

const PAGE_SIZE = LIST_PAGE_SIZE;
const EMPTY_META: PageMeta = { page: 0, size: PAGE_SIZE, totalElements: 0, totalPages: 0 };
const VIEW_CONFIG: Array<{ id: WorkspaceView; label: string; hint: string; icon: React.ComponentType<{ size?: number }> }> = [
  { id: 'proposals', label: 'Đề xuất của tôi', hint: 'Gửi và theo dõi xét duyệt', icon: Layers3 },
  { id: 'activities', label: 'Hoạt động chính thức', hint: 'Lịch đã được Ban quản lý duyệt', icon: CalendarDays },
  { id: 'changes', label: 'Yêu cầu thay đổi', hint: 'Theo dõi nội dung điều chỉnh', icon: FilePenLine },
  { id: 'cancellations', label: 'Yêu cầu hủy', hint: 'Theo dõi đề nghị hủy', icon: Ban },
];

const VIEW_STATUS_OPTIONS: Record<WorkspaceView, string[]> = {
  proposals: ['', 'PENDING', 'NEED_CHANGES', 'APPROVED', 'REJECTED', 'WITHDRAWN', 'CANCELLED'],
  activities: ['', 'DRAFT', 'PUBLISHED', 'ONGOING', 'COMPLETED', 'CANCELLED'],
  changes: ['', 'PENDING', 'APPROVED', 'REJECTED', 'WITHDRAWN', 'CANCELLED'],
  cancellations: ['', 'PENDING', 'APPROVED', 'REJECTED', 'WITHDRAWN', 'CANCELLED'],
};

const REVISION_SOURCE_LABELS: Record<string, string> = {
  ORGANIZER_DIRECT: 'Ban tổ chức chỉnh sửa',
  PARTNER_REQUEST: 'Duyệt yêu cầu của đối tác',
  EVENT_CANCELLATION: 'Sự kiện bị hủy',
  SYSTEM: 'Hệ thống cập nhật',
};

function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—';
  return new Date(value).toLocaleString('vi-VN', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Ho_Chi_Minh',
  });
}

function formatRange(start: string, end: string): string {
  return `${formatDateTime(start)} – ${formatDateTime(end)}`;
}

function toLocalInput(value: string | null | undefined): string {
  if (!value) return '';
  const parts = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(new Date(value)).reduce<Record<string, string>>((all, part) => {
    all[part.type] = part.value;
    return all;
  }, {});
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

function nextLocalMinuteInput(): string {
  const value = new Date();
  value.setSeconds(0, 0);
  value.setMinutes(value.getMinutes() + 1);
  return toLocalInput(value.toISOString());
}

function laterLocalInput(first: string, second: string): string {
  return first > second ? first : second;
}

function localInputToIso(value: string): string {
  return new Date(`${value}:00+07:00`).toISOString();
}

function friendlyError(error: unknown, fallback: string): string {
  const message = error instanceof Error ? error.message : '';
  if (!message || /JDBC|executing SQL|Hibernate|SQLException|lower\(bytea\)/i.test(message)) return fallback;
  return message;
}

function isProposal(record: WorkspaceRecord): record is PartnerActivityProposalResponse {
  return 'activityProposalId' in record;
}

function isActivity(record: WorkspaceRecord): record is PartnerActivityResponse {
  return 'location' in record && 'startAt' in record;
}

function isChange(record: WorkspaceRecord): record is PartnerActivityChangeRequestResponse {
  return 'activityChangeRequestId' in record;
}

function recordKind(record: WorkspaceRecord): ActivityRecordKind {
  if (isProposal(record)) return 'proposal';
  if (isActivity(record)) return 'activity';
  return isChange(record) ? 'changeRequest' : 'cancellationRequest';
}

function viewKind(view: WorkspaceView): ActivityRecordKind {
  if (view === 'proposals') return 'proposal';
  if (view === 'activities') return 'activity';
  return view === 'changes' ? 'changeRequest' : 'cancellationRequest';
}

function StatusBadge({ kind, status }: { kind: ActivityRecordKind; status: string }) {
  return <span className={`paw-status paw-status--${activityStatusTone(kind, status)}`}><i />{activityStatusLabel(kind, status)}</span>;
}

function LinkedActivityNotice({
  activityId,
  activity,
  onOpen,
}: {
  activityId: number;
  activity?: PartnerActivityResponse;
  onOpen: () => void;
}) {
  const isCancelled = activity?.status === 'CANCELLED';
  const currentState = activity
    ? isCancelled
      ? 'Hoạt động liên kết hiện đã bị hủy'
      : `Trạng thái hiện tại: ${activityStatusLabel('activity', activity.status)}`
    : `Đã tạo hoạt động chính thức #${activityId}`;

  return (
    <div className={`paw-linked-activity${isCancelled ? ' is-cancelled' : ''}`}>
      <AlertCircle size={18} />
      <span><small>HOẠT ĐỘNG LIÊN KẾT</small><strong>{currentState}</strong></span>
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
  proposal?: PartnerActivityProposalResponse;
  onOpen: () => void;
}) {
  return (
    <div className="paw-source-proposal">
      <Layers3 size={18} />
      <span>
        <small>NGUỒN HOẠT ĐỘNG</small>
        <strong>Đề xuất #{proposalId}{proposal ? ` · ${proposal.partnerOrganizationName}` : ''}</strong>
      </span>
      <button type="button" onClick={onOpen}>Xem đề xuất</button>
    </div>
  );
}

function ActivityCancellationNotice({ activity }: { activity: PartnerActivityResponse }) {
  if (activity.status !== 'CANCELLED') return null;
  return (
    <div className="paw-cancellation-note">
      <strong>Hoạt động đã bị hủy · {cancellationSourceLabel(activity.cancellationSource)}</strong>
      {activity.cancellationReason && <p>{activity.cancellationReason}</p>}
      {activity.cancelledAt && <small>Hủy lúc {formatDateTime(activity.cancelledAt)}</small>}
    </div>
  );
}

export const PartnerActivityWorkspacePage: React.FC<Props> = ({ applications }) => {
  const organizationLocked = usePartnerOrganizationLocked();
  const navigate = useNavigate();
  const { activityId: routeActivityId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const approvedApplications = useMemo(
    () => applications.filter(application => application.status === 'approved'),
    [applications],
  );
  const requestedEventId = searchParams.get('eventId');
  const selectedEventId = approvedApplications.some(application => application.eventId === requestedEventId)
    ? requestedEventId || ''
    : approvedApplications[0]?.eventId || '';
  const viewCandidate = searchParams.get('view') || searchParams.get('activityView');
  const view: WorkspaceView = VIEW_CONFIG.some(item => item.id === viewCandidate)
    ? viewCandidate as WorkspaceView
    : 'proposals';
  const search = searchParams.get('search') || '';
  const deferredSearch = useDeferredValue(search.trim());
  const statusCandidate = searchParams.get('status') || '';
  const status = VIEW_STATUS_OPTIONS[view].includes(statusCandidate) ? statusCandidate : '';
  const lateOnly = searchParams.get('late') === 'true';
  const pageCandidate = Number.parseInt(searchParams.get('page') || '1', 10);
  const page = Number.isFinite(pageCandidate) && pageCandidate > 0 ? toPageIndex(pageCandidate) : 0;
  const [records, setRecords] = useState<WorkspaceRecord[]>([]);
  const [activitiesById, setActivitiesById] = useState<Record<number, PartnerActivityResponse>>({});
  const [proposalsById, setProposalsById] = useState<Record<number, PartnerActivityProposalResponse>>({});
  const [meta, setMeta] = useState<PageMeta>(EMPTY_META);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [reload, setReload] = useState(0);
  const [selected, setSelected] = useState<WorkspaceRecord | null>(null);
  const [proposalForm, setProposalForm] = useState<PartnerActivityProposalResponse | 'create' | null>(null);
  const requestSequence = useRef(0);

  const updateWorkspaceParams = useCallback((
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
  }, [searchParams, setSearchParams]);

  const selectedApplication = approvedApplications.find(item => item.eventId === selectedEventId);

  useEffect(() => {
    const normalized = new URLSearchParams();
    if (selectedEventId) normalized.set('eventId', selectedEventId);
    if (view !== 'proposals') normalized.set('view', view);
    if (search.trim()) normalized.set('search', search.trim());
    if (status) normalized.set('status', status);
    if (view === 'cancellations' && lateOnly) normalized.set('late', 'true');
    if (page > 0) normalized.set('page', String(page + 1));
    if (normalized.toString() !== new URLSearchParams(searchParams).toString()) {
      setSearchParams(normalized, { replace: true });
    }
  }, [lateOnly, page, search, searchParams, selectedEventId, setSearchParams, status, view]);

  useEffect(() => {
    if (!selectedEventId) {
      // Clear stale remote results when no eligible Event exists.
      // oxlint-disable-next-line react/set-state-in-effect
      setRecords([]);
      setMeta(EMPTY_META);
      return;
    }
    const sequence = ++requestSequence.current;
    // Loading mirrors the lifecycle of this remote request.
    // oxlint-disable-next-line react/set-state-in-effect
    setLoading(true);
    setError('');
    const common = { eventId: selectedEventId, page, size: PAGE_SIZE, search: deferredSearch || undefined };
    const request = view === 'proposals'
      ? partnerApi.getActivityProposals({ ...common, status: status as ActivityProposalStatus || undefined, sort: 'submittedAt,desc' })
      : view === 'activities'
        ? partnerApi.getActivities({ ...common, status: status as ActivityStatus || undefined, sort: 'startAt,asc' })
        : view === 'changes'
          ? partnerApi.getActivityChangeRequests({ ...common, status: status as ActivityRequestStatus || undefined, sort: 'submittedAt,desc' })
          : partnerApi.getActivityCancellationRequests({ ...common, status: status as ActivityRequestStatus || undefined, late: lateOnly || undefined, sort: 'submittedAt,desc' });
    void request.then(response => {
      if (sequence !== requestSequence.current) return;
      const lastPage = getPageCount(response.totalElements, PAGE_SIZE);
      if (page >= lastPage) {
        const next = new URLSearchParams(window.location.search);
        next.set('page', String(lastPage));
        setSearchParams(next, { replace: true });
        return;
      }
      setRecords(response.content);
      setMeta({ page: response.page, size: response.size, totalElements: response.totalElements, totalPages: response.totalPages });
    }).catch(cause => {
      if (sequence !== requestSequence.current) return;
      setRecords([]);
      setMeta(EMPTY_META);
      setError(friendlyError(cause, 'Không tải được dữ liệu hoạt động. Vui lòng thử lại.'));
    }).finally(() => {
      if (sequence === requestSequence.current) setLoading(false);
    });
  }, [deferredSearch, lateOnly, page, reload, selectedEventId, setSearchParams, status, view]);

  useEffect(() => {
    if (!selectedEventId || view === 'activities') return;
    let active = true;
    const activityIds = [...new Set(records.flatMap(record => {
      if (isActivity(record)) return [];
      if (isProposal(record)) return record.activityId ? [record.activityId] : [];
      return [record.activityId];
    }))];
    void Promise.allSettled(activityIds.map(activityId => partnerApi.getActivity(activityId)))
      .then(results => {
        if (!active) return;
        setActivitiesById(Object.fromEntries(results.flatMap(result =>
          result.status === 'fulfilled' ? [[result.value.activityId, result.value] as const] : [])));
      });
    return () => { active = false; };
  }, [records, reload, selectedEventId, view]);

  useEffect(() => {
    if (view !== 'activities') return;
    let active = true;
    const proposalIds = [...new Set(records.flatMap(record =>
      isActivity(record) && record.sourceProposalId ? [record.sourceProposalId] : []))];
    void Promise.allSettled(proposalIds.map(proposalId => partnerApi.getActivityProposal(proposalId)))
      .then(results => {
        if (!active) return;
        setProposalsById(Object.fromEntries(results.flatMap(result =>
          result.status === 'fulfilled' ? [[result.value.activityProposalId, result.value] as const] : [])));
      });
    return () => { active = false; };
  }, [records, reload, view]);

  useEffect(() => {
    if (!routeActivityId) return;
    // A direct detail route opens the official-activity workspace and dialog.
    // oxlint-disable-next-line react/set-state-in-effect
    updateWorkspaceParams({ view: 'activities', status: null, late: null, page: null }, true);
    void partnerApi.getActivity(routeActivityId).then(activity => {
      setSelected(activity);
      if (activity.eventId) updateWorkspaceParams({ eventId: String(activity.eventId), view: 'activities' }, true);
    }).catch(cause => setError(friendlyError(cause, 'Không tìm thấy hoạt động này.')));
  }, [routeActivityId, updateWorkspaceParams]);

  const changeView = (next: WorkspaceView) => {
    updateWorkspaceParams({ view: next === 'proposals' ? null : next, status: null, late: null, page: null });
    setSelected(null);
  };
  const refresh = (message?: string) => {
    if (message) setNotice(message);
    setSelected(null); setProposalForm(null); setReload(value => value + 1);
  };

  const openActivity = async (activityId: number) => {
    try {
      const activity = activitiesById[activityId] || await partnerApi.getActivity(activityId);
      updateWorkspaceParams({ view: 'activities', status: null, late: null, page: null });
      setSelected(activity);
    } catch (cause) {
      setNotice(friendlyError(cause, 'Không tải được hoạt động liên kết. Vui lòng thử lại.'));
    }
  };

  const openLinkedActivity = (proposal: PartnerActivityProposalResponse) => {
    if (proposal.activityId) void openActivity(proposal.activityId);
  };

  const openSourceProposal = async (activity: PartnerActivityResponse) => {
    if (!activity.sourceProposalId) return;
    try {
      const proposal = proposalsById[activity.sourceProposalId]
        || await partnerApi.getActivityProposal(activity.sourceProposalId);
      updateWorkspaceParams({ view: null, status: null, late: null, page: null });
      setSelected(proposal);
    } catch (cause) {
      setNotice(friendlyError(cause, 'Không tải được đề xuất nguồn. Vui lòng thử lại.'));
    }
  };

  const renderTitle = (record: WorkspaceRecord) => {
    if (isProposal(record) || isActivity(record)) return record.title;
    return activitiesById[record.activityId]?.title || `Hoạt động #${record.activityId}`;
  };

  return (
    <section className="paw-shell">
      <header className="paw-header">
        <div><h1 className="workspace-page-title">Quản lý hoạt động</h1><p className="workspace-page-subtitle">Đề xuất chương trình và theo dõi toàn bộ quá trình xét duyệt theo từng sự kiện.</p></div>
        <div className="paw-header-actions">
          <button type="button" className="paw-button paw-button--secondary" onClick={() => setReload(value => value + 1)} disabled={loading}><RefreshCw size={18} /> Làm mới</button>
          <button type="button" className="paw-button paw-button--primary" onClick={() => setProposalForm('create')} disabled={!selectedApplication || organizationLocked}><Plus size={18} /> Đề xuất hoạt động</button>
        </div>
      </header>

      {notice && <div className="paw-notice" role="status">{notice}<button type="button" onClick={() => setNotice('')}>×</button></div>}

      {approvedApplications.length === 0 ? (
        <div className="paw-empty paw-empty--large"><AlertCircle size={34} /><strong>Chưa có sự kiện đủ điều kiện</strong><p>Bạn cần một hồ sơ tham gia sự kiện đã được duyệt trước khi đề xuất hoạt động.</p><button type="button" onClick={() => navigate('/partner/events/apply')}>Khám phá sự kiện</button></div>
      ) : (
        <>
          <div className="paw-event-bar">
            <div><CalendarDays size={23} /><span><small>SỰ KIỆN ĐANG XEM</small><strong>{selectedApplication?.eventTitle}</strong><em>{selectedApplication?.dateRange}</em></span></div>
            <label><span>Đổi sự kiện</span><select value={selectedEventId} onChange={event => { updateWorkspaceParams({ eventId: event.target.value, page: null }); setSelected(null); }}>{approvedApplications.map(application => <option key={application.id} value={application.eventId}>{application.eventTitle}</option>)}</select></label>
          </div>

          <nav className="paw-tabs" aria-label="Nhóm dữ liệu hoạt động">
            {VIEW_CONFIG.map(item => { const Icon = item.icon; return <button type="button" key={item.id} className={view === item.id ? 'is-active' : ''} onClick={() => changeView(item.id)}><Icon size={20} /><span><strong>{item.label}</strong><small>{item.hint}</small></span></button>; })}
          </nav>

          <section className="paw-records-panel" aria-label="Tìm kiếm và danh sách hoạt động">
            <div className="paw-toolbar">
              <SearchFieldLabel className="paw-search-group"><label className="paw-search"><Search size={18} /><input value={search} onChange={event => updateWorkspaceParams({ search: event.target.value, page: null }, true)} placeholder="Tìm theo tên hoạt động..." /></label></SearchFieldLabel>
              <WorkspaceFieldLabel className="paw-status-field" label="Trạng thái"><select aria-label="Lọc trạng thái" value={status} onChange={event => updateWorkspaceParams({ status: event.target.value, page: null })}>{VIEW_STATUS_OPTIONS[view].map(value => <option value={value} key={value || 'all'}>{value ? activityStatusLabel(viewKind(view), value) : 'Tất cả trạng thái'}</option>)}</select></WorkspaceFieldLabel>
              {view === 'cancellations' && <label className="paw-check"><input type="checkbox" checked={lateOnly} onChange={event => updateWorkspaceParams({ late: event.target.checked, page: null })} /> Chỉ yêu cầu trễ hạn</label>}
              <span>{meta.totalElements} kết quả</span>
            </div>

            <div className="paw-list" aria-busy={loading}>
            {loading && records.length === 0 && Array.from({ length: 4 }, (_, index) => <div className="paw-skeleton" key={index}><i /><i /><i /></div>)}
            {!loading && error && <div className="paw-empty paw-empty--error"><AlertCircle size={30} /><strong>Chưa tải được dữ liệu</strong><p>{error}</p><button type="button" onClick={() => setReload(value => value + 1)}>Thử lại</button></div>}
            {!loading && !error && records.length === 0 && <div className="paw-empty"><CalendarDays size={30} /><strong>Chưa có dữ liệu phù hợp</strong><p>Thử đổi trạng thái, từ khóa hoặc chọn một sự kiện khác.</p></div>}
            {records.map(record => {
              const activity = !isProposal(record) && !isActivity(record) ? activitiesById[record.activityId] : null;
              const linkedActivity = isProposal(record) && record.activityId
                ? activitiesById[record.activityId]
                : undefined;
              const requestActivity = !isProposal(record) && !isActivity(record)
                ? activitiesById[record.activityId]
                : undefined;
              const sourceProposal = isActivity(record) && record.sourceProposalId
                ? proposalsById[record.sourceProposalId]
                : undefined;
              const location = isProposal(record) || isActivity(record) ? record.location : activity?.location;
              const start = isProposal(record) ? record.proposedStartAt : isActivity(record) ? record.startAt : activity?.startAt;
              const end = isProposal(record) ? record.proposedEndAt : isActivity(record) ? record.endAt : activity?.endAt;
              const key = isProposal(record) ? `p-${record.activityProposalId}` : isActivity(record) ? `a-${record.activityId}` : isChange(record) ? `ch-${record.activityChangeRequestId}` : `ca-${record.activityCancellationRequestId}`;
              return <article className={`paw-card paw-card--${activityStatusTone(recordKind(record), record.status)}`} key={key}>
                <div className="paw-card-accent" />
                <div className="paw-card-main"><span className="paw-card-kicker">{isProposal(record) ? `ĐỀ XUẤT #${record.activityProposalId}` : isActivity(record) ? `HOẠT ĐỘNG #${record.activityId}` : isChange(record) ? `YÊU CẦU THAY ĐỔI #${record.activityChangeRequestId}` : `YÊU CẦU HỦY #${record.activityCancellationRequestId}`}</span><h2>{renderTitle(record)}</h2><div className="paw-card-meta">{start && end && <span><Clock3 size={16} />{formatRange(start, end)}</span>}{location && <span><MapPin size={16} />{location.code} · {location.name}</span>}{(isProposal(record) || isActivity(record)) && <span><Users size={16} />{record.capacity} người</span>}</div>{!isProposal(record) && !isActivity(record) && <p>{record.reason}</p>}{isProposal(record) && record.status === 'APPROVED' && record.activityId && <LinkedActivityNotice activityId={record.activityId} activity={linkedActivity} onOpen={() => openLinkedActivity(record)} />}{isActivity(record) && record.sourceProposalId && <SourceProposalNotice proposalId={record.sourceProposalId} proposal={sourceProposal} onOpen={() => void openSourceProposal(record)} />}{isActivity(record) && <ActivityCancellationNotice activity={record} />}{!isProposal(record) && !isActivity(record) && <LinkedActivityNotice activityId={record.activityId} activity={requestActivity} onOpen={() => void openActivity(record.activityId)} />}</div>
                <div className="paw-card-actions"><StatusBadge kind={recordKind(record)} status={record.status} />{!isProposal(record) && !isActivity(record) && 'late' in record && record.late && <span className="paw-late">Trễ hạn</span>}<button type="button" onClick={() => setSelected(record)}><Eye size={16} /> Xem chi tiết</button></div>
              </article>;
            })}
            </div>

            {getPageCount(meta.totalElements, PAGE_SIZE) > 1 && <div className="paw-records-pagination"><ListPagination page={page + 1} pages={getPageCount(meta.totalElements, PAGE_SIZE)} disabled={loading} onPage={value => updateWorkspaceParams({ page: value })} /></div>}
          </section>
        </>
      )}

      {proposalForm && selectedApplication && <ProposalDialog application={selectedApplication} proposal={proposalForm === 'create' ? null : proposalForm} onClose={() => setProposalForm(null)} onSaved={message => refresh(message)} />}
      {selected && <RecordDialog
        record={selected}
        activity={isProposal(selected) ? (selected.activityId ? activitiesById[selected.activityId] || null : null) : (!isActivity(selected) ? activitiesById[selected.activityId] : null)}
        sourceProposal={isActivity(selected) && selected.sourceProposalId ? proposalsById[selected.sourceProposalId] || null : null}
        onClose={() => setSelected(null)}
        onEditProposal={proposal => { setSelected(null); setProposalForm(proposal); }}
        onOpenLinkedActivity={isProposal(selected)
          ? (selected.activityId ? () => void openActivity(selected.activityId as number) : undefined)
          : (!isActivity(selected) ? () => void openActivity(selected.activityId) : undefined)}
        onOpenSourceProposal={isActivity(selected) && selected.sourceProposalId ? () => void openSourceProposal(selected) : undefined}
        onCompleted={message => refresh(message)}
      />}
    </section>
  );
};

interface ProposalFormState { title: string; activityType: string; description: string; startAt: string; endAt: string; locationId: string; capacity: string }

function ProposalDialog({ application, proposal, onClose, onSaved }: { application: PartnerEventApplication; proposal: PartnerActivityProposalResponse | null; onClose: () => void; onSaved: (message: string) => void }) {
  const organizationLocked = usePartnerOrganizationLocked();
  const [minimumFutureAt] = useState(nextLocalMinuteInput);
  const [form, setForm] = useState<ProposalFormState>({
    title: proposal?.title || '', activityType: proposal?.activityType || '', description: proposal?.description || '',
    startAt: proposal ? toLocalInput(proposal.proposedStartAt) : laterLocalInput(toLocalInput(application.startAt), minimumFutureAt),
    endAt: toLocalInput(proposal?.proposedEndAt || application.endAt),
    locationId: proposal ? String(proposal.location.locationId) : '', capacity: proposal ? String(proposal.capacity) : '',
  });
  const [locations, setLocations] = useState<OrganizerLocationResponse[]>([]);
  const [loadingLocations, setLoadingLocations] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const selectedLocation = locations.find(location => String(location.locationId) === form.locationId);

  useEffect(() => {
    let active = true;
    // Loading mirrors the eligible-location request for the chosen interval.
    // oxlint-disable-next-line react/set-state-in-effect
    setLoadingLocations(true);
    const hasRange = Boolean(form.startAt && form.endAt && form.startAt < form.endAt);
    void partnerApi.getActivityLocations(application.eventId, hasRange ? localInputToIso(form.startAt) : undefined, hasRange ? localInputToIso(form.endAt) : undefined)
      .then(items => { if (active) setLocations(items); })
      .catch(cause => { if (active) { setLocations([]); setError(friendlyError(cause, 'Không tải được địa điểm của sự kiện.')); } })
      .finally(() => { if (active) setLoadingLocations(false); });
    return () => { active = false; };
  }, [application.eventId, form.startAt, form.endAt]);

  const setField = (field: keyof ProposalFormState, value: string) => setForm(current => ({ ...current, [field]: value }));
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (organizationLocked && !proposal) return;
    const title = form.title.trim().replace(/\s+/g, ' ');
    const activityType = form.activityType.trim().replace(/\s+/g, ' ');
    const capacity = Number(form.capacity);
    if (!title || title.length > 200) return setError('Tên hoạt động phải từ 1 đến 200 ký tự.');
    if (!activityType || activityType.length > 50) return setError('Loại hoạt động phải từ 1 đến 50 ký tự.');
    if (!form.startAt || !form.endAt || form.startAt >= form.endAt) return setError('Thời gian bắt đầu phải trước thời gian kết thúc.');
    if (new Date(localInputToIso(form.startAt)).getTime() <= Date.now()) return setError('Thời gian bắt đầu phải ở tương lai.');
    if (form.startAt < toLocalInput(application.startAt) || form.endAt > toLocalInput(application.endAt)) return setError('Thời gian hoạt động phải nằm hoàn toàn trong thời gian sự kiện.');
    if (!selectedLocation || !selectedLocation.eligible) return setError(selectedLocation?.ineligibleReason || 'Vui lòng chọn một địa điểm đủ điều kiện.');
    if (!Number.isInteger(capacity) || capacity < 1 || capacity > selectedLocation.maxCapacity) return setError(`Sức chứa phải từ 1 đến ${selectedLocation.maxCapacity} người.`);
    if (form.description.trim().length > 5000) return setError('Mô tả không được vượt quá 5.000 ký tự.');
    setSubmitting(true); setError('');
    try {
      const payload = { locationId: Number(form.locationId), title, description: form.description.trim() || null, activityType, proposedStartAt: localInputToIso(form.startAt), proposedEndAt: localInputToIso(form.endAt), capacity };
      if (proposal) await partnerApi.updateActivityProposal(proposal.activityProposalId, payload);
      else await partnerApi.submitActivityProposal({ eventId: Number(application.eventId), ...payload });
      onSaved(proposal ? 'Đã cập nhật đề xuất hoạt động.' : 'Đã gửi đề xuất hoạt động đến Ban quản lý.');
    } catch (cause) { setError(friendlyError(cause, 'Không thể lưu đề xuất. Vui lòng kiểm tra dữ liệu và thử lại.')); }
    finally { setSubmitting(false); }
  };

  return (
    <PartnerDialog title={proposal ? 'Chỉnh sửa đề xuất hoạt động' : 'Đề xuất hoạt động mới'} onClose={onClose}>
      <form className="paw-dialog-form" onSubmit={submit}>
        <div className="paw-dialog-context"><CalendarDays size={18} /><span><small>Sự kiện</small><strong>{application.eventTitle}</strong></span></div>
        <div className="paw-form-grid">
          <label className="is-wide"><span>Tên hoạt động *</span><input value={form.title} maxLength={200} onChange={event => setField('title', event.target.value)} /></label>
          <label><span>Loại hoạt động *</span><input value={form.activityType} maxLength={50} placeholder="Workshop, tọa đàm..." onChange={event => setField('activityType', event.target.value)} /></label>
          <label><span>Địa điểm *</span><select value={form.locationId} onChange={event => setField('locationId', event.target.value)} disabled={loadingLocations}><option value="">{loadingLocations ? 'Đang tải địa điểm...' : 'Chọn địa điểm'}</option>{locations.map(location => <option key={location.locationId} value={location.locationId} disabled={!location.eligible}>{location.code} · {location.name} · tối đa {location.maxCapacity}{location.eligible ? '' : ` — ${location.ineligibleReason || 'Không khả dụng'}`}</option>)}</select></label>
          <label><span>Bắt đầu *</span><DayFirstDateInput type="datetime-local" value={form.startAt} min={laterLocalInput(toLocalInput(application.startAt), minimumFutureAt)} max={toLocalInput(application.endAt)} onChange={event => setField('startAt', event.target.value)} /></label>
          <label><span>Kết thúc *</span><DayFirstDateInput type="datetime-local" value={form.endAt} min={laterLocalInput(form.startAt || toLocalInput(application.startAt), minimumFutureAt)} max={toLocalInput(application.endAt)} onChange={event => setField('endAt', event.target.value)} /></label>
          <label><span>Sức chứa *</span><input type="number" min="1" max={selectedLocation?.maxCapacity} value={form.capacity} onChange={event => setField('capacity', event.target.value)} /></label>
          <label className="is-wide"><span>Mô tả</span><textarea rows={4} maxLength={5000} value={form.description} onChange={event => setField('description', event.target.value)} /><small>{form.description.length}/5000</small></label>
        </div>
        {locations.length === 0 && !loadingLocations && !error && <p className="paw-form-hint">Ban quản lý chưa cấu hình địa điểm phù hợp cho sự kiện này.</p>}
        {error && <p className="paw-form-error" role="alert">{error}</p>}
        <footer>
          <button type="button" className="paw-button paw-button--secondary" onClick={onClose} disabled={submitting}>Đóng</button>
          <button type="submit" className="paw-button paw-button--primary" disabled={submitting || loadingLocations || (organizationLocked && !proposal)}>{submitting ? 'Đang lưu...' : proposal ? 'Lưu thay đổi' : 'Gửi đề xuất'}</button>
        </footer>
      </form>
    </PartnerDialog>
  );
}

function RecordDialog({ record, activity, sourceProposal, onClose, onEditProposal, onOpenLinkedActivity, onOpenSourceProposal, onCompleted }: { record: WorkspaceRecord; activity: PartnerActivityResponse | null; sourceProposal: PartnerActivityProposalResponse | null; onClose: () => void; onEditProposal: (proposal: PartnerActivityProposalResponse) => void; onOpenLinkedActivity?: () => void; onOpenSourceProposal?: () => void; onCompleted: (message: string) => void }) {
  const organizationLocked = usePartnerOrganizationLocked();
  const [minimumFutureAt] = useState(nextLocalMinuteInput);
  const [action, setAction] = useState<'change' | 'cancel' | null>(null);
  const [reason, setReason] = useState('');
  const [changeField, setChangeField] = useState<'title' | 'description' | 'type' | 'location' | 'schedule' | 'capacity' | 'image'>('title');
  const [changeValue, setChangeValue] = useState('');
  const [changeEndValue, setChangeEndValue] = useState('');
  const [imageUploading, setImageUploading] = useState(false);
  const [requestLocations, setRequestLocations] = useState<OrganizerLocationResponse[]>([]);
  const [revisions, setRevisions] = useState<PartnerActivityRevisionResponse[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const currentActivity = isActivity(record) ? record : activity;
  const title = isProposal(record) || isActivity(record) ? record.title : currentActivity?.title || `Hoạt động #${record.activityId}`;
  const dialogTitle = isProposal(record)
    ? `Đề xuất #${record.activityProposalId} · ${title}`
    : isActivity(record)
      ? `Hoạt động #${record.activityId} · ${title}`
      : isChange(record)
        ? `Yêu cầu thay đổi #${record.activityChangeRequestId} · ${title}`
        : `Yêu cầu hủy #${record.activityCancellationRequestId} · ${title}`;

  useEffect(() => {
    if (!isActivity(record)) return;
    void partnerApi.getActivityRevisions(record.activityId).then(response => setRevisions(response.content)).catch(() => setRevisions([]));
  }, [record]);

  useEffect(() => {
    if (action !== 'change' || !currentActivity || !['location', 'schedule'].includes(changeField)) return;
    let active = true;
    const requestedStart = changeField === 'schedule' && changeValue ? localInputToIso(changeValue) : currentActivity.startAt;
    const requestedEnd = changeField === 'schedule' && changeEndValue ? localInputToIso(changeEndValue) : currentActivity.endAt;
    void partnerApi.getActivityLocations(currentActivity.eventId, requestedStart, requestedEnd)
      .then(items => { if (active) setRequestLocations(items); })
      .catch(() => { if (active) setRequestLocations([]); });
    return () => { active = false; };
  }, [action, changeEndValue, changeField, changeValue, currentActivity]);

  const withdraw = async () => {
    setSubmitting(true); setError('');
    try {
      if (isProposal(record)) await partnerApi.withdrawActivityProposal(record.activityProposalId);
      else if (isChange(record)) await partnerApi.withdrawActivityChangeRequest(record.activityChangeRequestId);
      else if (!isActivity(record)) await partnerApi.withdrawActivityCancellationRequest(record.activityCancellationRequestId);
      onCompleted('Đã rút hồ sơ thành công.');
    } catch (cause) { setError(friendlyError(cause, 'Không thể rút hồ sơ.')); }
    finally { setSubmitting(false); }
  };
  const resubmit = async () => {
    if (!isProposal(record) || organizationLocked) return;
    setSubmitting(true); setError('');
    try { await partnerApi.resubmitActivityProposal(record.activityProposalId); onCompleted('Đã gửi lại đề xuất để Ban quản lý xét duyệt.'); }
    catch (cause) { setError(friendlyError(cause, 'Không thể gửi lại đề xuất.')); }
    finally { setSubmitting(false); }
  };
  const submitRequest = async () => {
    if (!currentActivity || !action || organizationLocked || imageUploading) return;
    const normalizedReason = reason.trim().replace(/\s+/g, ' ');
    if (normalizedReason.length < 10 || normalizedReason.length > 500) return setError('Lý do phải từ 10 đến 500 ký tự.');
    setSubmitting(true); setError('');
    try {
      if (action === 'cancel') await partnerApi.submitActivityCancellationRequest(currentActivity.activityId, normalizedReason);
      else {
        const payload: CreatePartnerActivityChangeRequest = { reason: normalizedReason };
        if (changeField === 'title') payload.requestedTitle = changeValue.trim();
        if (changeField === 'description') payload.requestedDescription = changeValue.trim() || null;
        if (changeField === 'type') payload.requestedActivityType = changeValue.trim();
        if (changeField === 'location') payload.requestedLocationId = Number(changeValue);
        if (changeField === 'schedule') {
          if (!changeValue || !changeEndValue || changeValue >= changeEndValue) return setError('Thời gian bắt đầu mới phải trước thời gian kết thúc mới.');
          if (new Date(localInputToIso(changeValue)).getTime() <= Date.now()) return setError('Thời gian bắt đầu mới phải ở tương lai.');
          payload.requestedStartAt = localInputToIso(changeValue);
          payload.requestedEndAt = localInputToIso(changeEndValue);
        }
        if (changeField === 'capacity') payload.requestedCapacity = Number(changeValue);
        if (changeField === 'image') payload.requestedImageUrl = changeValue.trim() || null;
        if ((changeField === 'title' || changeField === 'type') && !changeValue.trim()) return setError('Nội dung thay đổi không được để trống.');
        if (changeField === 'location' && !requestLocations.some(location => location.eligible && String(location.locationId) === changeValue)) return setError('Vui lòng chọn một địa điểm đủ điều kiện.');
        if (changeField === 'capacity' && (!Number.isInteger(Number(changeValue)) || Number(changeValue) < 1)) return setError('Sức chứa mới phải là số nguyên dương.');
        if (changeField === 'image' && changeValue.trim()) {
          try {
            const url = new URL(changeValue.trim());
            if (!['http:', 'https:'].includes(url.protocol)) return setError('URL ảnh phải dùng HTTP hoặc HTTPS.');
          } catch { return setError('URL ảnh không hợp lệ.'); }
        }
        await partnerApi.submitActivityChangeRequest(currentActivity.activityId, payload);
      }
      onCompleted(action === 'cancel' ? 'Đã gửi yêu cầu hủy hoạt động.' : 'Đã gửi yêu cầu thay đổi hoạt động.');
    } catch (cause) { setError(friendlyError(cause, 'Không thể gửi yêu cầu.')); }
    finally { setSubmitting(false); }
  };

  return <PartnerDialog title={dialogTitle} onClose={onClose}><div className="paw-detail"><StatusBadge kind={recordKind(record)} status={record.status} />{(isProposal(record) || isActivity(record)) && <dl><div><dt>{isProposal(record) ? 'Thời gian đề xuất' : 'Lịch chính thức hiện tại'}</dt><dd>{formatRange(isProposal(record) ? record.proposedStartAt : record.startAt, isProposal(record) ? record.proposedEndAt : record.endAt)}</dd></div><div><dt>{isProposal(record) ? 'Địa điểm đề xuất' : 'Địa điểm hiện tại'}</dt><dd>{record.location.code} · {record.location.name}</dd></div><div><dt>Sức chứa</dt><dd>{record.capacity} người</dd></div><div><dt>Loại hoạt động</dt><dd>{record.activityType}</dd></div></dl>}{isProposal(record) && <><p>{record.description || 'Không có mô tả.'}</p>{record.reviewNote && <div className="paw-review-note"><strong>Phản hồi Ban quản lý</strong><p>{record.reviewNote}</p></div>}{record.status === 'APPROVED' && record.activityId && onOpenLinkedActivity && <LinkedActivityNotice activityId={record.activityId} activity={activity || undefined} onOpen={onOpenLinkedActivity} />}</>}{isActivity(record) && <><p>{record.description || 'Không có mô tả.'}</p>{record.sourceProposalId && onOpenSourceProposal && <SourceProposalNotice proposalId={record.sourceProposalId} proposal={sourceProposal || undefined} onOpen={onOpenSourceProposal} />}<ActivityCancellationNotice activity={record} /><PaginatedList items={revisions}>{pageItems => (<div className="paw-revisions"><h3><History size={17} /> Lịch sử điều chỉnh</h3>{revisions.length === 0 ? <p>Chưa có lần điều chỉnh nào.</p> : pageItems.map(revision => <div key={revision.activityRevisionId}><strong>{formatDateTime(revision.changedAt)}</strong><span>{revision.changeReason || REVISION_SOURCE_LABELS[revision.revisionSource] || revision.revisionSource}</span></div>)}</div>)}</PaginatedList></>}{!isProposal(record) && !isActivity(record) && <><div className="paw-review-note"><strong>Lý do yêu cầu</strong><p>{record.reason}</p>{record.reviewNote && <p><b>Phản hồi Ban quản lý:</b> {record.reviewNote}</p>}</div>{isChange(record) && <ChangeRequestSummary request={record} activity={currentActivity} />}{'late' in record && record.late && <p className="paw-late-note">Yêu cầu này được gửi sau mốc hủy thông thường.</p>}{onOpenLinkedActivity && <LinkedActivityNotice activityId={record.activityId} activity={activity || undefined} onOpen={onOpenLinkedActivity} />}</>}
    {action && <div className="paw-request-panel"><h3>{action === 'change' ? 'Yêu cầu thay đổi hoạt động' : 'Yêu cầu hủy hoạt động'}</h3>{action === 'change' && <><label><span>Trường cần đổi</span><select disabled={imageUploading} value={changeField} onChange={event => { setChangeField(event.target.value as typeof changeField); setChangeValue(''); setChangeEndValue(''); }}><option value="title">Tên hoạt động</option><option value="description">Mô tả</option><option value="type">Loại hoạt động</option><option value="location">Địa điểm</option><option value="schedule">Thời gian bắt đầu và kết thúc</option><option value="capacity">Sức chứa</option><option value="image">URL hình ảnh</option></select></label>{changeField === 'schedule' ? <div className="paw-request-range"><label><span>Bắt đầu mới</span><DayFirstDateInput aria-label="Bắt đầu mới" type="datetime-local" value={changeValue} min={minimumFutureAt} onChange={event => setChangeValue(event.target.value)} /></label><label><span>Kết thúc mới</span><DayFirstDateInput aria-label="Kết thúc mới" type="datetime-local" value={changeEndValue} min={laterLocalInput(changeValue || minimumFutureAt, minimumFutureAt)} onChange={event => setChangeEndValue(event.target.value)} /></label></div> : changeField === 'image' ? <ImageUrlField value={changeValue} onChange={setChangeValue} uploadFile={file => contentImageApi.uploadPartnerActivity(currentActivity!.activityId, file)} disabled={submitting} onBusyChange={setImageUploading} /> : <label><span>Nội dung mới</span>{changeField === 'description' ? <textarea rows={3} value={changeValue} onChange={event => setChangeValue(event.target.value)} /> : changeField === 'location' ? <select value={changeValue} onChange={event => setChangeValue(event.target.value)}><option value="">Chọn địa điểm mới</option>{requestLocations.map(location => <option key={location.locationId} value={location.locationId} disabled={!location.eligible}>{location.code} · {location.name}{location.eligible ? '' : ` — ${location.ineligibleReason || 'Không khả dụng'}`}</option>)}</select> : <input type={changeField === 'capacity' ? 'number' : 'text'} value={changeValue} onChange={event => setChangeValue(event.target.value)} />}</label>}</>}<label><span>Lý do *</span><textarea rows={3} maxLength={500} value={reason} onChange={event => setReason(event.target.value)} /></label></div>}
    {error && <p className="paw-form-error" role="alert">{error}</p>}
    <footer><button type="button" className="paw-button paw-button--secondary" onClick={onClose}>Đóng</button><div>{isProposal(record) && ['PENDING', 'NEED_CHANGES'].includes(record.status) && <><button type="button" className="paw-button paw-button--danger" disabled={submitting} onClick={() => void withdraw()}>Rút đề xuất</button><button type="button" className="paw-button paw-button--secondary" onClick={() => onEditProposal(record)}>Chỉnh sửa</button>{record.status === 'NEED_CHANGES' && <button type="button" className="paw-button paw-button--primary" disabled={submitting || imageUploading || organizationLocked} onClick={() => void resubmit()}>Gửi lại xét duyệt</button>}</>}{isActivity(record) && !action && <>{['DRAFT', 'PUBLISHED'].includes(record.status) && <button type="button" className="paw-button paw-button--secondary" onClick={() => setAction('change')} disabled={organizationLocked}>Yêu cầu thay đổi</button>}{['DRAFT', 'PUBLISHED', 'ONGOING'].includes(record.status) && <button type="button" className="paw-button paw-button--danger" onClick={() => setAction('cancel')} disabled={organizationLocked}>Yêu cầu hủy</button>}</>}{!isProposal(record) && !isActivity(record) && record.status === 'PENDING' && <button type="button" className="paw-button paw-button--danger" disabled={submitting} onClick={() => void withdraw()}>Rút yêu cầu</button>}{action && <><button type="button" className="paw-button paw-button--secondary" onClick={() => { setAction(null); setError(''); }}>Quay lại</button><button type="button" className="paw-button paw-button--primary" disabled={submitting || imageUploading || organizationLocked} onClick={() => void submitRequest()}>{submitting ? 'Đang gửi...' : 'Gửi yêu cầu'}</button></>}</div></footer></div></PartnerDialog>;
}

function ChangeRequestSummary({ request, activity }: { request: PartnerActivityChangeRequestResponse; activity: PartnerActivityResponse | null }) {
  const rows: Array<[string, string]> = [];
  if (request.requestedTitle !== null) rows.push(['Tên mới', request.requestedTitle]);
  if (request.requestedActivityType !== null) rows.push(['Loại mới', request.requestedActivityType]);
  if (request.requestedCapacity !== null) rows.push(['Sức chứa mới', `${request.requestedCapacity} người`]);
  if (request.requestedLocationId !== null) rows.push(['Địa điểm mới', `Địa điểm #${request.requestedLocationId}`]);
  if (request.requestedStartAt && request.requestedEndAt) rows.push(['Thời gian mới', formatRange(request.requestedStartAt, request.requestedEndAt)]);
  if (request.requestedDescriptionIncluded) rows.push(['Mô tả mới', request.requestedDescription || 'Để trống']);
  if (request.requestedImageUrlIncluded) rows.push(['Ảnh mới', request.requestedImageUrl || 'Gỡ ảnh']);
  return <div className="paw-change-summary"><h3>Nội dung đề nghị thay đổi</h3>{rows.map(([label, value]) => <div key={label}><strong>{label}</strong><span>{value}</span></div>)}{activity && rows.length === 0 && <p>Không có trường thay đổi.</p>}</div>;
}
