import { DayFirstDateInput } from '../ui/DayFirstDateInput';
import { AlertCircle, CheckCircle2, ChevronRight, ClipboardCheck, History, RefreshCw, Search, UserRound, X } from 'lucide-react';
import React, { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useModalDismiss } from '../../hooks/useModalDismiss';
import { useParticipationRefresh } from '../../hooks/useParticipationRefresh';
import {
  organizerApi,
  type OrganizerAttendanceAdjustmentResponse,
  type OrganizerEventRegistrationResponse,
  type OrganizerParticipationOutcome,
  type OrganizerParticipationResponse,
  type OrganizerRegistrationPage,
} from '../../services/organizerApi';
import { Language } from '../../types';
import type { OrganizerActivityResponse } from '../../types/activity';
import { OrganizerEvent } from '../../types/organizer';
import { ListPagination } from '../ui/ListPagination';
import { SearchFieldLabel } from '../ui/SearchFieldLabel';
import { WorkspaceFieldLabel } from '../ui/WorkspaceFieldLabel';
import { BoothVisitMonitoringPanel } from './BoothVisitMonitoringPanel';
import './ParticipantManagementView.css';

interface ParticipantManagementViewProps {
  language: Language;
  events: OrganizerEvent[];
  selectedEventId: string;
  onSelectEventId: (id: string) => void;
}

type ParticipantView = 'event' | 'activity' | 'booth';
type EventRegistrationStatus = 'all' | 'ACTIVE' | 'LEFT';
type ActivityOutcomeFilter = 'all' | OrganizerParticipationOutcome;
type AttendanceTarget = 'VALID' | 'VOIDED';

const PAGE_SIZE = 20;
const VI_TIME_ZONE = 'Asia/Ho_Chi_Minh';
const EMPTY_EVENT_PAGE: OrganizerRegistrationPage<OrganizerEventRegistrationResponse> = { content: [], page: 0, size: PAGE_SIZE, totalElements: 0, totalPages: 0 };
const EMPTY_ACTIVITY_PAGE: OrganizerRegistrationPage<OrganizerParticipationResponse> = { content: [], page: 0, size: PAGE_SIZE, totalElements: 0, totalPages: 0 };

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

function formatDateTime(value: string | null | undefined, language: Language): string {
  if (!value) return language === 'vi' ? 'Chưa có' : 'Not available';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return language === 'vi' ? 'Không hợp lệ' : 'Invalid date';
  return new Intl.DateTimeFormat(language === 'vi' ? 'vi-VN' : 'en-GB', {
    timeZone: VI_TIME_ZONE, day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(date);
}

function toDateTimeLocal(value: string | null | undefined): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: VI_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find(part => part.type === type)?.value || '';
  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}`;
}

function toIsoFromVietnamLocal(value: string): string | null {
  if (!value) return null;
  const date = new Date(`${value}:00+07:00`);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function createIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map(value => value.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function outcomeLabel(outcome: OrganizerParticipationOutcome, language: Language): string {
  const labels = language === 'vi'
    ? { ACTIVE: 'Đang hiệu lực', CANCELLED: 'Đã hủy', ATTENDED: 'Đã tham gia', NO_SHOW: 'Vắng mặt' }
    : { ACTIVE: 'Active', CANCELLED: 'Cancelled', ATTENDED: 'Attended', NO_SHOW: 'No-show' };
  return labels[outcome];
}

function eventStatusLabel(status: OrganizerEventRegistrationResponse['status'], language: Language): string {
  if (status === 'ACTIVE') return language === 'vi' ? 'Đang tham gia' : 'Active';
  return language === 'vi' ? 'Đã rời sự kiện' : 'Left event';
}

function outcomeClass(outcome: OrganizerParticipationOutcome): string {
  return outcome.toLowerCase().replace('_', '-');
}

export const ParticipantManagementView: React.FC<ParticipantManagementViewProps> = ({ language, events, selectedEventId, onSelectEventId }) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const view: ParticipantView = searchParams.get('view') === 'booth' ? 'booth' : searchParams.get('view') === 'activity' ? 'activity' : 'event';
  const eventStatus = (['ACTIVE', 'LEFT'].includes(searchParams.get('status') || '') ? searchParams.get('status') : 'all') as EventRegistrationStatus;
  const outcome = (['ACTIVE', 'CANCELLED', 'ATTENDED', 'NO_SHOW'].includes(searchParams.get('outcome') || '') ? searchParams.get('outcome') : 'all') as ActivityOutcomeFilter;
  const page = Math.max(1, Number.parseInt(searchParams.get('page') || '1', 10) || 1);
  const search = searchParams.get('search') || '';
  const activityId = searchParams.get('activityId') || '';
  const [searchInput, setSearchInput] = useState(search);
  const [searchSource, setSearchSource] = useState(search);
  const [activities, setActivities] = useState<OrganizerActivityResponse[]>([]);
  const [eventPage, setEventPage] = useState(EMPTY_EVENT_PAGE);
  const [activityPage, setActivityPage] = useState(EMPTY_ACTIVITY_PAGE);
  const [isLoadingActivities, setIsLoadingActivities] = useState(false);
  const [isLoadingRows, setIsLoadingRows] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const participationRefresh = useParticipationRefresh(Boolean(selectedEventId && selectedEventId !== 'all'));
  const [selectedRegistrationId, setSelectedRegistrationId] = useState<number | null>(null);
  const [detail, setDetail] = useState<OrganizerParticipationResponse | null>(null);
  const [history, setHistory] = useState<OrganizerAttendanceAdjustmentResponse[]>([]);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [detailError, setDetailError] = useState('');
  const [detailReloadKey, setDetailReloadKey] = useState(0);
  const [isCorrectionOpen, setIsCorrectionOpen] = useState(false);
  const [targetStatus, setTargetStatus] = useState<AttendanceTarget>('VALID');
  const [effectiveAttendedAt, setEffectiveAttendedAt] = useState('');
  const [reason, setReason] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [correctionError, setCorrectionError] = useState('');
  const [isSavingCorrection, setIsSavingCorrection] = useState(false);
  const [idempotencyKey, setIdempotencyKey] = useState(createIdempotencyKey);
  const [successMessage, setSuccessMessage] = useState('');

  const selectedActivity = useMemo(() => activities.find(activity => String(activity.activityId) === activityId) || null, [activities, activityId]);
  const currentPage = view === 'event' ? eventPage : activityPage;
  if (searchSource !== search) {
    setSearchSource(search);
    setSearchInput(search);
  }
  useModalDismiss(selectedRegistrationId !== null, () => { if (!isSavingCorrection) setSelectedRegistrationId(null); });

  const updateQuery = useCallback((updates: Record<string, string | null>, replace = false) => {
    const next = new URLSearchParams(searchParams);
    Object.entries(updates).forEach(([key, value]) => value ? next.set(key, value) : next.delete(key));
    setSearchParams(next, { replace });
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect -- Leaving activity view clears its scoped options; otherwise this effect owns the remote load.
    if (view !== 'activity' || !selectedEventId || selectedEventId === 'all') { setActivities([]); return; }
    let active = true;
    setIsLoadingActivities(true);
    organizerApi.listActivities({ eventId: Number(selectedEventId), page: 0, size: 100, sort: 'startAt,asc' })
      .then(response => { if (active) setActivities(response.content); })
      .catch(error => { if (active) { setActivities([]); setLoadError(errorMessage(error, 'Không tải được danh sách hoạt động.')); } })
      .finally(() => { if (active) setIsLoadingActivities(false); });
    return () => { active = false; };
  }, [selectedEventId, reloadKey, view]);

  useEffect(() => {
    if (view !== 'activity' || activities.length === 0) return;
    if (activities.some(activity => String(activity.activityId) === activityId)) return;
    const firstEligible = activities.find(activity => activity.registrationRequired) || activities[0];
    updateQuery({ activityId: String(firstEligible.activityId), page: null }, true);
  }, [activities, activityId, updateQuery, view]);

  useEffect(() => {
    if (view === 'booth' || !selectedEventId || selectedEventId === 'all' || (view === 'activity' && !activityId)) return;
    let active = true;
    // oxlint-disable-next-line react/set-state-in-effect -- Query changes intentionally enter loading state before the remote page request.
    setIsLoadingRows(true);
    setLoadError('');
    const request = view === 'event'
      ? organizerApi.listEventRegistrations(selectedEventId, { page: page - 1, size: PAGE_SIZE, status: eventStatus === 'all' ? undefined : eventStatus, search: search || undefined })
        .then(response => { if (active) setEventPage(response); })
      : organizerApi.listActivityRegistrations(activityId, { page: page - 1, size: PAGE_SIZE, outcome: outcome === 'all' ? undefined : outcome, search: search || undefined })
        .then(response => { if (active) setActivityPage(response); });
    request.catch(error => { if (active) setLoadError(errorMessage(error, 'Không tải được danh sách người tham gia.')); })
      .finally(() => { if (active) setIsLoadingRows(false); });
    return () => { active = false; };
  }, [activityId, eventStatus, outcome, page, reloadKey, participationRefresh, search, selectedEventId, view]);

  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect -- Closing the drawer clears private detail state; an open drawer starts its guarded request.
    if (selectedRegistrationId === null) { setDetail(null); setHistory([]); setDetailError(''); return; }
    let active = true;
    setIsLoadingDetail(true);
    setDetailError('');
    Promise.all([
      organizerApi.getActivityRegistration(selectedRegistrationId),
      organizerApi.listAttendanceAdjustments(selectedRegistrationId, 0, 50),
    ]).then(([registration, adjustments]) => {
      if (active) { setDetail(registration); setHistory(adjustments.content); }
    }).catch(error => { if (active) setDetailError(errorMessage(error, 'Không tải được chi tiết đăng ký.')); })
      .finally(() => { if (active) setIsLoadingDetail(false); });
    return () => { active = false; };
  }, [detailReloadKey, participationRefresh, selectedRegistrationId]);

  useEffect(() => {
    if (!successMessage) return;
    const timeout = window.setTimeout(() => setSuccessMessage(''), 4000);
    return () => window.clearTimeout(timeout);
  }, [successMessage]);

  const switchView = (nextView: ParticipantView) => {
    updateQuery({ view: nextView === 'event' ? null : nextView, activityId: nextView === 'activity' ? activityId || null : null, status: null, outcome: null, search: null, page: null });
    setSearchInput('');
  };

  const submitSearch = (event: FormEvent) => {
    event.preventDefault();
    updateQuery({ search: searchInput.trim() || null, page: null });
  };

  const openCorrection = () => {
    if (!detail) return;
    const nextTarget: AttendanceTarget = detail.attendance?.status === 'VALID' ? 'VOIDED' : 'VALID';
    setTargetStatus(nextTarget);
    setEffectiveAttendedAt(nextTarget === 'VALID' ? toDateTimeLocal(detail.attendance?.attendedAt) : '');
    setReason(''); setConfirmed(false); setCorrectionError(''); setIdempotencyKey(createIdempotencyKey()); setIsCorrectionOpen(true);
  };

  const submitCorrection = async (event: FormEvent) => {
    event.preventDefault();
    if (!detail) return;
    const normalizedReason = reason.trim();
    if (normalizedReason.length < 10 || normalizedReason.length > 500) { setCorrectionError('Lý do phải có từ 10 đến 500 ký tự.'); return; }
    const attendedAt = targetStatus === 'VALID' ? toIsoFromVietnamLocal(effectiveAttendedAt) : null;
    if (targetStatus === 'VALID' && !attendedAt) { setCorrectionError('Vui lòng chọn thời điểm tham gia hợp lệ.'); return; }
    if (targetStatus === 'VALID' && selectedActivity && attendedAt) {
      const earliest = new Date(selectedActivity.startAt).getTime() - selectedActivity.attendanceEarlyScanMinutes * 60_000;
      const latest = new Date(selectedActivity.endAt).getTime();
      const selected = new Date(attendedAt).getTime();
      if (selected < earliest || selected >= latest) {
        setCorrectionError(`Thời điểm tham gia phải nằm trong khung ${formatDateTime(new Date(earliest).toISOString(), language)} đến trước ${formatDateTime(selectedActivity.endAt, language)}.`);
        return;
      }
    }
    if (!confirmed) { setCorrectionError('Bạn cần xác nhận thay đổi sẽ được ghi vào lịch sử kiểm toán.'); return; }
    setIsSavingCorrection(true); setCorrectionError('');
    try {
      const response = await organizerApi.correctAttendance(detail.activityRegistrationId, { targetAttendanceStatus: targetStatus, effectiveAttendedAt: attendedAt, reason: normalizedReason }, idempotencyKey);
      setSuccessMessage(response.idempotentReplay ? 'Yêu cầu đã được xử lý trước đó; dữ liệu hiện tại đã được đồng bộ.' : 'Đã lưu điều chỉnh điểm danh và lịch sử kiểm toán.');
      setIsCorrectionOpen(false); setReloadKey(value => value + 1); setDetailReloadKey(value => value + 1);
    } catch (error) {
      setCorrectionError(errorMessage(error, 'Không thể lưu điều chỉnh điểm danh. Bạn có thể thử lại an toàn.'));
    } finally { setIsSavingCorrection(false); }
  };

  if (events.length === 0) {
    return <div className='organizer-content participant-management'><div className='participant-state-card'><UserRound size={28} /><h2>Chưa có sự kiện</h2><p>Hãy tạo sự kiện trước khi quản lý người tham gia.</p></div></div>;
  }
  return (
    <div className='organizer-content participant-management'>
      <header className='participant-page-header'>
        <div>
          <h1 className='organizer-view-title workspace-page-title'>{language === 'vi' ? 'Người tham gia' : 'Participants'}</h1>
          <p className='organizer-view-sub workspace-page-subtitle'>{language === 'vi' ? 'Theo dõi đăng ký sự kiện, hoạt động, điểm danh và lượt ghé gian hàng.' : 'Track event and activity registrations, attendance, and Booth visits.'}</p>
        </div>
        <label className='participant-event-select'>
          <span>{language === 'vi' ? 'Sự kiện' : 'Event'}</span>
          <select value={selectedEventId} onChange={event => onSelectEventId(event.target.value)}>
            {events.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}
          </select>
        </label>
      </header>
      <div className='participant-view-tabs' role='tablist' aria-label='Phạm vi người tham gia'>
        <button type='button' role='tab' aria-selected={view === 'event'} className={view === 'event' ? 'is-active' : ''} onClick={() => switchView('event')}>Đăng ký sự kiện</button>
        <button type='button' role='tab' aria-selected={view === 'activity'} className={view === 'activity' ? 'is-active' : ''} onClick={() => switchView('activity')}>Đăng ký hoạt động</button>
        <button type='button' role='tab' aria-selected={view === 'booth'} className={view === 'booth' ? 'is-active' : ''} onClick={() => switchView('booth')}>Lượt ghé gian hàng</button>
      </div>
      {view === 'booth' ? <BoothVisitMonitoringPanel key={selectedEventId} eventId={selectedEventId} /> : <section className='participant-list-card'>
        <div className='participant-list-heading'>
          <div><h2>{view === 'event' ? 'Danh sách tham gia sự kiện' : 'Danh sách tham gia hoạt động'}</h2><p>{currentPage.totalElements.toLocaleString('vi-VN')} bản ghi theo bộ lọc hiện tại</p></div>
          <button type='button' className='participant-refresh-button' onClick={() => setReloadKey(value => value + 1)} disabled={isLoadingRows}><RefreshCw size={16} /> Làm mới</button>
        </div>
        {view === 'activity' && (
          <label className='participant-activity-select'>
            <span>Hoạt động</span>
            <select value={activityId} onChange={event => updateQuery({ activityId: event.target.value || null, outcome: null, search: null, page: null })} disabled={isLoadingActivities}>
              <option value=''>{isLoadingActivities ? 'Đang tải hoạt động...' : 'Chọn hoạt động'}</option>
              {activities.map(activity => <option key={activity.activityId} value={activity.activityId}>{activity.title}{activity.registrationRequired ? '' : ' · Không yêu cầu đăng ký'}</option>)}
            </select>
            {selectedActivity && !selectedActivity.registrationRequired && <small>Hoạt động này không yêu cầu độc giả đăng ký nên thường sẽ không có bản ghi.</small>}
          </label>
        )}
        <div className='participant-filters'>
          <SearchFieldLabel className='participant-search-group'><form className='participant-search' onSubmit={submitSearch}>
            <Search size={17} aria-hidden='true' />
            <input value={searchInput} onChange={event => setSearchInput(event.target.value)} placeholder='Tìm theo tên người tham gia...' />
          </form></SearchFieldLabel>
          {view === 'event' ? (
            <WorkspaceFieldLabel className='participant-status-field' label='Trạng thái'><select aria-label='Lọc trạng thái đăng ký sự kiện' value={eventStatus} onChange={event => updateQuery({ status: event.target.value === 'all' ? null : event.target.value, page: null })}>
              <option value='all'>Tất cả trạng thái</option><option value='ACTIVE'>Đang tham gia</option><option value='LEFT'>Đã rời sự kiện</option>
            </select></WorkspaceFieldLabel>
          ) : (
            <WorkspaceFieldLabel className='participant-status-field' label='Kết quả'><select aria-label='Lọc kết quả tham gia' value={outcome} onChange={event => updateQuery({ outcome: event.target.value === 'all' ? null : event.target.value, page: null })}>
              <option value='all'>Tất cả kết quả</option><option value='ACTIVE'>Đang hiệu lực</option><option value='ATTENDED'>Đã tham gia</option><option value='NO_SHOW'>Vắng mặt</option><option value='CANCELLED'>Đã hủy</option>
            </select></WorkspaceFieldLabel>
          )}
        </div>
        {loadError && <div className='participant-inline-state is-error' role='alert'><AlertCircle size={20} /><div><strong>Không tải được dữ liệu</strong><p>{loadError}</p></div><button type='button' onClick={() => setReloadKey(value => value + 1)}>Thử lại</button></div>}
        {!loadError && isLoadingRows && <div className='participant-inline-state' role='status'>Đang tải danh sách người tham gia...</div>}
        {!loadError && !isLoadingRows && view === 'activity' && activities.length === 0 && <div className='participant-empty-state'><ClipboardCheck size={30} /><strong>Chưa có hoạt động trong sự kiện</strong><p>Hoạt động được công bố sẽ xuất hiện tại đây để bạn xem danh sách đăng ký.</p></div>}
        {!loadError && !isLoadingRows && currentPage.content.length === 0 && (view === 'event' || activities.length > 0) && (
          <div className='participant-empty-state'><UserRound size={30} /><strong>{search || eventStatus !== 'all' || outcome !== 'all' ? 'Không có kết quả phù hợp' : 'Chưa có người tham gia'}</strong><p>{search || eventStatus !== 'all' || outcome !== 'all' ? 'Hãy thử thay đổi từ khóa hoặc bộ lọc.' : 'Bản ghi thực tế sẽ xuất hiện khi độc giả hoàn tất đăng ký.'}</p></div>
        )}
        {!loadError && !isLoadingRows && currentPage.content.length > 0 && view === 'event' && (
          <div className='participant-table-wrap'><table className='participant-table'><thead><tr><th>Người tham gia</th><th>Trạng thái</th><th>Hoạt động</th><th>Đã tham gia</th><th>Vắng mặt</th><th>Ngày đăng ký</th></tr></thead><tbody>
            {eventPage.content.map(item => <tr key={item.eventRegistrationId}><td><strong>{item.participant.displayName}</strong><small>ID người dùng #{item.participant.userId}</small></td><td><span className={`participant-status ${item.status.toLowerCase()}`}>{eventStatusLabel(item.status, language)}</span></td><td>{item.activityRegistrationCount}</td><td>{item.attendedActivityCount}</td><td>{item.noShowActivityCount}</td><td>{formatDateTime(item.registeredAt, language)}</td></tr>)}
          </tbody></table></div>
        )}
        {!loadError && !isLoadingRows && currentPage.content.length > 0 && view === 'activity' && (
          <div className='participant-table-wrap'><table className='participant-table'><thead><tr><th>Người tham gia</th><th>Kết quả</th><th>Điểm danh</th><th>Ngày đăng ký</th><th aria-label='Thao tác' /></tr></thead><tbody>
            {activityPage.content.map(item => (
              <tr key={item.activityRegistrationId}>
                <td><strong>{item.participant.displayName}</strong><small>ID đăng ký #{item.activityRegistrationId}</small></td>
                <td><span className={`participant-status ${outcomeClass(item.outcome)}`}>{outcomeLabel(item.outcome, language)}</span></td>
                <td>{item.attendance?.status === 'VALID' ? formatDateTime(item.attendance.attendedAt, language) : item.attendance?.status === 'VOIDED' ? 'Đã vô hiệu' : 'Chưa có'}</td>
                <td>{formatDateTime(item.registeredAt, language)}</td>
                <td><button type='button' className='participant-row-action' onClick={() => setSelectedRegistrationId(item.activityRegistrationId)}>Xem chi tiết <ChevronRight size={15} /></button></td>
              </tr>
            ))}
          </tbody></table></div>
        )}
        {!loadError && !isLoadingRows && currentPage.totalPages > 1 && (
          <div className='participant-pagination'><span>{currentPage.totalElements.toLocaleString('vi-VN')} bản ghi</span><ListPagination page={page} pages={currentPage.totalPages} onPage={next => updateQuery({ page: next > 1 ? String(next) : null })} /></div>
        )}
      </section>}
      {selectedRegistrationId !== null && (
        <div className='participant-drawer-backdrop' onMouseDown={() => { if (!isSavingCorrection) setSelectedRegistrationId(null); }}>
          <aside className='participant-drawer' role='dialog' aria-modal='true' aria-labelledby='participant-detail-title' onMouseDown={event => event.stopPropagation()}>
            <header>
              <div><span>Hồ sơ tham gia hoạt động</span><h2 id='participant-detail-title'>{detail?.participant.displayName || 'Chi tiết đăng ký'}</h2></div>
              <button type='button' aria-label='Đóng' onClick={() => setSelectedRegistrationId(null)} disabled={isSavingCorrection}><X size={21} /></button>
            </header>
            <div className='participant-drawer-body'>
              {isLoadingDetail && <div className='participant-inline-state' role='status'>Đang tải chi tiết đăng ký...</div>}
              {detailError && <div className='participant-inline-state is-error' role='alert'><AlertCircle size={20} /><div><strong>Không tải được chi tiết</strong><p>{detailError}</p></div><button type='button' onClick={() => setDetailReloadKey(value => value + 1)}>Thử lại</button></div>}
              {!isLoadingDetail && !detailError && detail && <>
                <section className='participant-detail-summary'>
                  <div><span>Kết quả hiện tại</span><strong><span className={`participant-status ${outcomeClass(detail.outcome)}`}>{outcomeLabel(detail.outcome, language)}</span></strong></div>
                  <div><span>Ngày đăng ký</span><strong>{formatDateTime(detail.registeredAt, language)}</strong></div>
                  <div><span>Điểm danh</span><strong>{detail.attendance?.status === 'VALID' ? formatDateTime(detail.attendance.attendedAt, language) : detail.attendance?.status === 'VOIDED' ? 'Đã vô hiệu' : 'Chưa có bản ghi'}</strong></div>
                  <div><span>Nguồn ghi nhận</span><strong>{detail.attendance?.recordedSource === 'SELF_SCAN' ? 'Độc giả quét QR' : detail.attendance?.recordedSource === 'ORGANIZER_CORRECTION' ? 'Ban tổ chức điều chỉnh' : 'Chưa có'}</strong></div>
                  <div><span>Chứng nhận</span><strong>{detail.certificate ? `${detail.certificate.status === 'ISSUED' ? 'Đã cấp' : 'Đã thu hồi'} · ${detail.certificate.certificateCode}` : 'Chưa cấp'}</strong></div>
                  <div><span>Đánh giá</span><strong>{detail.ratingStatus === 'ACTIVE' ? 'Có hiệu lực' : detail.ratingStatus === 'INVALIDATED' ? 'Đã vô hiệu' : 'Chưa có'}</strong></div>
                </section>
                {!isCorrectionOpen && <button type='button' className='participant-primary-action' onClick={openCorrection}>Điều chỉnh điểm danh</button>}
                {isCorrectionOpen && (
                  <form className='participant-correction-form' onSubmit={submitCorrection}>
                    <div className='participant-section-title'><div><ClipboardCheck size={18} /><h3>Điều chỉnh điểm danh</h3></div><button type='button' onClick={() => setIsCorrectionOpen(false)} disabled={isSavingCorrection}>Đóng</button></div>
                    <label>Trạng thái sau điều chỉnh
                      <select value={targetStatus} onChange={event => { const value = event.target.value as AttendanceTarget; setTargetStatus(value); if (value === 'VOIDED') setEffectiveAttendedAt(''); setCorrectionError(''); }}>
                        <option value='VALID'>Ghi nhận đã tham gia</option><option value='VOIDED'>Vô hiệu điểm danh</option>
                      </select>
                    </label>
                    {targetStatus === 'VALID' && <label>Thời điểm tham gia<DayFirstDateInput type='datetime-local' value={effectiveAttendedAt} onChange={event => setEffectiveAttendedAt(event.target.value)} required /></label>}
                    <label>Lý do điều chỉnh
                      <textarea value={reason} onChange={event => setReason(event.target.value)} minLength={10} maxLength={500} rows={4} placeholder='Nhập lý do cụ thể để phục vụ kiểm toán...' required />
                      <small>{reason.trim().length}/500 ký tự · tối thiểu 10 ký tự</small>
                    </label>
                    <label className='participant-confirm'><input type='checkbox' checked={confirmed} onChange={event => setConfirmed(event.target.checked)} />Tôi xác nhận thay đổi này là chính xác và sẽ được lưu vĩnh viễn trong lịch sử kiểm toán.</label>
                    {correctionError && <p className='participant-form-error' role='alert'>{correctionError}</p>}
                    <div className='participant-form-actions'><button type='button' onClick={() => setIsCorrectionOpen(false)} disabled={isSavingCorrection}>Hủy</button><button type='submit' disabled={isSavingCorrection}>{isSavingCorrection ? 'Đang lưu...' : 'Xác nhận điều chỉnh'}</button></div>
                  </form>
                )}
                <section className='participant-history'>
                  <div className='participant-section-title'><div><History size={18} /><h3>Lịch sử điều chỉnh</h3></div><span>{history.length}</span></div>
                  {history.length === 0 ? <p className='participant-history-empty'>Chưa có điều chỉnh thủ công nào.</p> : (
                    <ol>{history.map(item => <li key={item.attendanceAdjustmentId}>
                      <div><strong>{item.newState.attendanceStatus === 'VALID' ? 'Ghi nhận tham gia' : 'Vô hiệu điểm danh'}</strong><span>{formatDateTime(item.adjustedAt, language)}</span></div>
                      <p>{item.reason}</p>
                      <small>Thực hiện bởi {item.actor.displayName}{item.effectiveAttendedAt ? ` · Thời điểm hiệu lực ${formatDateTime(item.effectiveAttendedAt, language)}` : ''}</small>
                    </li>)}</ol>
                  )}
                </section>
              </>}
            </div>
          </aside>
        </div>
      )}
      {successMessage && <div className='participant-toast' role='status'><CheckCircle2 size={18} />{successMessage}</div>}
    </div>
  );
};
