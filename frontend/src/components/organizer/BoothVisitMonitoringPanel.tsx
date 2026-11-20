import { useEffect, useState, type FormEvent } from 'react';
import { RefreshCw, Search, Store, Users, Footprints } from 'lucide-react';
import { boothVisitApi } from '../../services/boothVisitApi';
import { ApiError } from '../../services/apiError';
import type { OrganizerBoothVisit, OrganizerBoothVisitGroup, OrganizerBoothVisitSummary, RewardManagementPage } from '../../types/rewardManagement';
import { ListPagination } from '../ui/ListPagination';
import { SearchFieldLabel } from '../ui/SearchFieldLabel';
import './BoothVisitMonitoringPanel.css';

const PAGE_SIZE = 20;
const dateTime = (value: string) => new Intl.DateTimeFormat('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(value));
const statuses = { ACTIVE: 'Đang hoạt động', RELEASED: 'Đã giải phóng', CANCELLED: 'Đã hủy', ENDED: 'Đã kết thúc' };
function failure(error: unknown): string {
  if (error instanceof ApiError && error.code === 'EVENT_NOT_FOUND') return 'Không tìm thấy sự kiện thuộc quyền quản lý của bạn.';
  if (error instanceof ApiError && error.status === 403) return 'Bạn không có quyền xem lượt ghé của sự kiện này.';
  return error instanceof Error ? error.message : 'Không tải được lượt ghé gian hàng. Vui lòng thử lại.';
}

export function BoothVisitMonitoringPanel({ eventId }: { eventId: string }) {
  const hasSelectedEvent = /^[1-9]\d*$/.test(eventId);
  const [summaryResult, setSummaryResult] = useState<{ key: string; summary: OrganizerBoothVisitSummary | null; error: string } | null>(null);
  const [mode, setMode] = useState<'groups' | 'visits'>('groups');
  const [pageResult, setPageResult] = useState<{ key: string; data: RewardManagementPage<OrganizerBoothVisitGroup | OrganizerBoothVisit> | null; error: string } | null>(null);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [booth, setBooth] = useState<OrganizerBoothVisitGroup['booth'] | null>(null);
  const [sort, setSort] = useState('visitCount,desc');
  const [page, setPage] = useState(0);
  const [reload, setReload] = useState(0);
  const summaryKey = `${eventId}|${reload}`;
  const requestKey = `${eventId}|${mode}|${page}|${sort}|${search}|${booth?.boothId ?? ''}|${reload}`;
  const summary = summaryResult?.key === summaryKey ? summaryResult.summary : null;
  const summaryError = summaryResult?.key === summaryKey ? summaryResult.error : '';
  const loading = pageResult?.key !== requestKey;
  const data = loading ? null : pageResult.data;
  const error = loading ? '' : pageResult.error;

  useEffect(() => {
    if (!hasSelectedEvent) return;
    let active = true;
    boothVisitApi.summary(eventId).then(value => { if (active) setSummaryResult({ key: summaryKey, summary: value, error: '' }); })
      .catch(cause => { if (active) setSummaryResult({ key: summaryKey, summary: null, error: failure(cause) }); });
    return () => { active = false; };
  }, [eventId, hasSelectedEvent, reload, summaryKey]);

  useEffect(() => {
    if (!hasSelectedEvent) return;
    let active = true;
    const query = { page, size: PAGE_SIZE, sort, search: search || undefined, boothId: booth?.boothId };
    const request = mode === 'groups' ? boothVisitApi.groups(eventId, query) : boothVisitApi.visits(eventId, query);
    request.then(value => { if (active) setPageResult({ key: requestKey, data: value, error: '' }); })
      .catch(cause => { if (active) setPageResult({ key: requestKey, data: null, error: failure(cause) }); });
    return () => { active = false; };
  }, [eventId, hasSelectedEvent, mode, page, sort, search, booth, reload, requestKey]);

  function switchMode(next: 'groups' | 'visits') {
    setMode(next); setPage(0); setSearch(''); setSearchInput('');
    setSort(next === 'groups' ? 'visitCount,desc' : 'visitedAt,desc');
  }
  function submitSearch(event: FormEvent) { event.preventDefault(); setSearch(searchInput.trim()); setPage(0); }

  if (!hasSelectedEvent) {
    return <section className="booth-visit-panel" aria-label="Theo dõi lượt ghé gian hàng">
      <div className="participant-inline-state"><Store size={28} /><div><strong>Chưa có sự kiện được chọn</strong><p>Hãy chọn hoặc tạo một sự kiện trước khi xem lượt ghé gian hàng.</p></div></div>
    </section>;
  }

  return <section className="booth-visit-panel" aria-label="Theo dõi lượt ghé gian hàng">
    <div className="booth-visit-summary" aria-busy={!summary && !summaryError}>
      <div><Footprints size={22} /><span>Tổng lượt ghé<strong>{summary?.totalVisits.toLocaleString('vi-VN') ?? '—'}</strong></span></div>
      <div><Users size={22} /><span>Người tham gia duy nhất<strong>{summary?.uniqueParticipants.toLocaleString('vi-VN') ?? '—'}</strong></span></div>
      <div><Store size={22} /><span>Gian hàng có lượt ghé<strong>{summary?.visitedBoothAssignments.toLocaleString('vi-VN') ?? '—'}</strong></span></div>
    </div>
    {summaryError && <p role="alert" className="participant-form-error">{summaryError}</p>}
    <section className="participant-list-card">
      <div className="participant-list-heading"><div><h2>Lượt ghé gian hàng</h2><p>Lịch sử đã ghi nhận được giữ lại khi gian hàng ngừng hoạt động.</p></div>
        <button type="button" className="participant-refresh-button" onClick={() => setReload(value => value + 1)} disabled={loading}><RefreshCw size={16} /> Làm mới lượt ghé</button></div>
      <div className="booth-visit-modes" role="group" aria-label="Cách xem lượt ghé">
        <button type="button" aria-pressed={mode === 'groups'} onClick={() => switchMode('groups')}>Theo gian hàng</button>
        <button type="button" aria-pressed={mode === 'visits'} onClick={() => switchMode('visits')}>Lịch sử lượt ghé</button>
      </div>
      {booth && <p className="booth-visit-filter">Gian hàng: <strong>{booth.code} · {booth.name}</strong><button type="button" onClick={() => { setBooth(null); setPage(0); }}>Bỏ lọc gian hàng</button></p>}
      <div className="participant-filters">
        <SearchFieldLabel className="booth-visit-search-group"><form className="participant-search" onSubmit={submitSearch}><Search size={17} /><input aria-label="Tìm lượt ghé" value={searchInput} onChange={event => setSearchInput(event.target.value)} maxLength={100} placeholder={mode === 'groups' ? 'Mã hoặc tên gian hàng' : 'Tên người tham gia, mã hoặc tên gian hàng'} /><button type="submit">Tìm kiếm</button></form></SearchFieldLabel>
        <label>Sắp xếp<select aria-label="Sắp xếp lượt ghé" value={sort} onChange={event => { setSort(event.target.value); setPage(0); }}>
          {mode === 'groups' ? <><option value="visitCount,desc">Nhiều lượt ghé nhất</option><option value="lastVisitedAt,desc">Ghé gần nhất</option></> : <><option value="visitedAt,desc">Mới nhất</option><option value="visitedAt,asc">Cũ nhất</option><option value="participantDisplayName,asc">Tên người tham gia</option></>}
          <option value="boothCode,asc">Mã gian hàng</option></select></label>
      </div>
      {loading && <p className="participant-inline-state" role="status">Đang tải lượt ghé...</p>}
      {error && <div className="participant-inline-state is-error" role="alert"><p>{error}</p><button type="button" onClick={() => setReload(value => value + 1)}>Thử lại</button></div>}
      {!loading && !error && data && <>
        {data.content.length === 0 ? <div className="participant-inline-state"><Store size={28} /><div><strong>Chưa có lượt ghé phù hợp</strong><p>Thử đổi bộ lọc hoặc làm mới sau khi người tham gia quét mã gian hàng.</p></div></div> :
          <div className="booth-visit-table-wrap"><table className="booth-visit-table"><thead><tr>{mode === 'visits' && <th>Người tham gia</th>}<th>Gian hàng</th><th>Trạng thái hiện tại</th><th>{mode === 'groups' ? 'Số lượt ghé' : 'Thời điểm ghé'}</th>{mode === 'groups' && <><th>Ghé gần nhất</th><th>Chi tiết</th></>}</tr></thead>
            <tbody>{data.content.map(row => <tr key={'boothVisitId' in row ? row.boothVisitId : row.boothAssignmentId}>
              {'participant' in row && <td>{row.participant.displayName}</td>}
              <td><strong>{row.booth.code}</strong><span>{row.booth.name}</span><small>Lượt phân gian #{row.boothAssignmentId}</small></td>
              <td><span className={`participant-status ${row.assignmentStatus === 'ACTIVE' ? 'active' : 'cancelled'}`}>{statuses[row.assignmentStatus]}</span></td>
              {'visitCount' in row ? <><td>{row.visitCount.toLocaleString('vi-VN')}</td><td>{dateTime(row.lastVisitedAt)}</td><td><button type="button" onClick={() => { setBooth(row.booth); switchMode('visits'); }}>Xem lượt ghé {row.booth.code}</button></td></> : <td>{dateTime(row.visitedAt)}</td>}
            </tr>)}</tbody></table></div>}
        <div className="booth-visit-pagination"><span>{data.totalElements.toLocaleString('vi-VN')} bản ghi</span><ListPagination page={page + 1} pages={data.totalPages} onPage={value => setPage(value - 1)} disabled={loading} /></div>
      </>}
    </section>
  </section>;
}
