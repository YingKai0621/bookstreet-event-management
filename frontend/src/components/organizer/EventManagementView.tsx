import { clampPage, getPageCount, getPageOffset, LIST_PAGE_SIZE } from '../../constants/pagination';
import { ListPagination } from '../ui/ListPagination';
import { WorkspaceFieldLabel } from '../ui/WorkspaceFieldLabel';
import {
  CalendarDays,
  Ban,
  Edit3,
  Eye,
  ImageOff,
  Plus,
  Search,
  Send,
  SlidersHorizontal,
  Trash2,
} from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Language } from '../../types';
import { OrganizerEvent, OrganizerEventStatus } from '../../types/organizer';
import { OrganizerEventStatusChip } from './OrganizerEventStatusChip';

interface EventManagementViewProps {
  language: Language;
  events: OrganizerEvent[];
  isLoading?: boolean;
  loadError?: string;
  actionError?: string;
  onRetry?: () => void;
  onSelectEvent: (eventId: string) => void;
  onOpenCreateEvent: () => void;
  onEditEvent: (event: OrganizerEvent) => void;
  onPublishEvent: (event: OrganizerEvent) => void;
  onCancelEvent: (event: OrganizerEvent) => void;
  onDeleteEvent: (event: OrganizerEvent) => void;
}

type StatusFilter = 'ALL' | OrganizerEventStatus;
type EventSort = 'updated_desc' | 'start_asc' | 'title_asc';

const PAGE_SIZE = LIST_PAGE_SIZE;

const STATUS_FILTERS: Array<{ value: StatusFilter; vi: string; en: string }> = [
  { value: 'ALL', vi: 'Tất cả', en: 'All' },
  { value: 'DRAFT', vi: 'Bản nháp', en: 'Draft' },
  { value: 'PUBLISHED', vi: 'Đã công bố', en: 'Published' },
  { value: 'ONGOING', vi: 'Đang diễn ra', en: 'Ongoing' },
  { value: 'COMPLETED', vi: 'Đã kết thúc', en: 'Completed' },
  { value: 'CANCELLED', vi: 'Đã hủy', en: 'Cancelled' },
];

function dateValue(value: string): number {
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}


function EventArtwork({ event }: { event: OrganizerEvent }) {
  const [failedImageUrl, setFailedImageUrl] = useState<string | null>(null);

  if (event.imageUrl && failedImageUrl !== event.imageUrl) {
    return <img className="org-event-row-image" src={event.imageUrl} alt="" onError={() => setFailedImageUrl(event.imageUrl)} />;
  }

  const startDate = new Date(event.startDate);
  const hasValidDate = Number.isFinite(startDate.getTime());
  return (
    <div className="org-event-date-tile" aria-hidden="true">
      {hasValidDate ? (
        <>
          <strong>{new Intl.DateTimeFormat('vi-VN', { day: '2-digit', timeZone: 'Asia/Ho_Chi_Minh' }).format(startDate)}</strong>
          <span>THG {new Intl.DateTimeFormat('vi-VN', { month: '2-digit', timeZone: 'Asia/Ho_Chi_Minh' }).format(startDate)}</span>
        </>
      ) : <ImageOff size={20} />}
    </div>
  );
}

export const EventManagementView: React.FC<EventManagementViewProps> = ({
  language,
  events,
  isLoading = false,
  loadError,
  actionError,
  onRetry,
  onSelectEvent,
  onOpenCreateEvent,
  onEditEvent,
  onPublishEvent,
  onCancelEvent,
  onDeleteEvent,
}) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const statusCandidate = searchParams.get('status');
  const activeStatusFilter: StatusFilter = STATUS_FILTERS.some(filter => filter.value === statusCandidate)
    ? statusCandidate as StatusFilter
    : 'ALL';
  const searchQuery = searchParams.get('search') || '';
  const sortCandidate = searchParams.get('sort');
  const sortBy: EventSort = ['updated_desc', 'start_asc', 'title_asc'].includes(sortCandidate || '')
    ? sortCandidate as EventSort
    : 'updated_desc';
  const pageCandidate = Number.parseInt(searchParams.get('page') || '1', 10);
  const currentPage = Number.isFinite(pageCandidate) && pageCandidate > 0 ? pageCandidate : 1;

  const updateListParams = (
    updates: Record<string, string | number | null | undefined>,
    replace = false,
  ) => {
    const next = new URLSearchParams(searchParams);
    for (const [key, value] of Object.entries(updates)) {
      if (value === null || value === undefined || value === '') next.delete(key);
      else next.set(key, String(value));
    }
    setSearchParams(next, { replace });
  };

  const statusCounts = useMemo(() => {
    const counts: Record<StatusFilter, number> = {
      ALL: events.length,
      DRAFT: 0,
      PUBLISHED: 0,
      ONGOING: 0,
      COMPLETED: 0,
      CANCELLED: 0,
    };
    events.forEach(event => { counts[event.apiStatus] += 1; });
    return counts;
  }, [events]);

  const processedEvents = useMemo(() => {
    const locale = language === 'vi' ? 'vi-VN' : 'en-US';
    const normalizedQuery = searchQuery.trim().toLocaleLowerCase(locale);
    const filtered = events.filter(event => {
      if (activeStatusFilter !== 'ALL' && event.apiStatus !== activeStatusFilter) return false;
      return !normalizedQuery || event.title.toLocaleLowerCase(locale).includes(normalizedQuery);
    });

    return [...filtered].sort((left, right) => {
      if (sortBy === 'start_asc') {
        const leftStart = dateValue(left.startDate);
        const rightStart = dateValue(right.startDate);
        const startingSoonGroup = (event: OrganizerEvent) => {
          if (event.apiStatus === 'ONGOING') return 0;
          if (event.apiStatus === 'PUBLISHED') return 1;
          if (event.apiStatus === 'DRAFT') return 2;
          return 3;
        };
        const leftGroup = startingSoonGroup(left);
        const rightGroup = startingSoonGroup(right);
        if (leftGroup !== rightGroup) return leftGroup - rightGroup;
        if (leftGroup === 2) return dateValue(right.updatedAt) - dateValue(left.updatedAt);
        if (leftGroup === 3) return rightStart - leftStart;
        return leftStart - rightStart;
      }
      if (sortBy === 'title_asc') return left.title.localeCompare(right.title, language === 'vi' ? 'vi' : 'en', { sensitivity: 'base', numeric: true });
      return dateValue(right.updatedAt) - dateValue(left.updatedAt);
    });
  }, [activeStatusFilter, events, language, searchQuery, sortBy]);

  const totalPages = getPageCount(processedEvents.length, PAGE_SIZE);
  const safeCurrentPage = clampPage(currentPage, totalPages);
  useEffect(() => {
    if (isLoading || loadError || events.length === 0 || currentPage === safeCurrentPage) return;
    const next = new URLSearchParams(searchParams);
    next.set('page', String(safeCurrentPage));
    setSearchParams(next, { replace: true });
  }, [currentPage, events.length, isLoading, loadError, safeCurrentPage, searchParams, setSearchParams]);
  const pageStartIndex = getPageOffset(safeCurrentPage, PAGE_SIZE);
  const visibleEvents = processedEvents.slice(pageStartIndex, pageStartIndex + PAGE_SIZE);

  const selectStatus = (status: StatusFilter) => {
    updateListParams({ status: status === 'ALL' ? null : status, page: null });
  };

  const updateSearch = (value: string) => {
    updateListParams({ search: value, page: null }, true);
  };

  const updateSort = (value: EventSort) => {
    updateListParams({ sort: value === 'updated_desc' ? null : value, page: null });
  };

  const clearFilters = () => {
    updateListParams({ status: null, search: null, sort: null, page: null });
  };

  const resultStart = processedEvents.length === 0 ? 0 : pageStartIndex + 1;
  const resultEnd = Math.min(pageStartIndex + PAGE_SIZE, processedEvents.length);

  return (
    <div className="organizer-content org-event-management">
      <div className="org-event-page-header">
        <div>
          <h1 className="organizer-view-title workspace-page-title">{language === 'vi' ? 'Danh sách sự kiện' : 'Event Management'}</h1>
          <p className="organizer-view-sub workspace-page-subtitle">{language === 'vi' ? 'Tạo bản nháp, cập nhật thông tin và công bố sự kiện' : 'Create drafts, update details, and publish events'}</p>
        </div>
        <button type="button" className="btn-org-primary" onClick={onOpenCreateEvent}>
          <Plus size={16} />{language === 'vi' ? 'Tạo sự kiện mới' : 'Create Event'}
        </button>
      </div>

      {actionError && <div className="org-event-inline-alert" role="alert">{actionError}</div>}
      {loadError && events.length > 0 && <div className="org-event-inline-alert" role="alert">{loadError}</div>}

      <section className="org-event-toolbar" aria-label={language === 'vi' ? 'Bộ lọc sự kiện' : 'Event filters'}>
        <div className="org-event-status-tabs" role="group" aria-label={language === 'vi' ? 'Lọc theo trạng thái' : 'Filter by status'}>
          {STATUS_FILTERS.map(filter => (
            <button
              key={filter.value}
              type="button"
              aria-pressed={activeStatusFilter === filter.value}
              className={`org-event-status-tab ${activeStatusFilter === filter.value ? 'is-active' : ''}`}
              onClick={() => selectStatus(filter.value)}
            >
              <span>{language === 'vi' ? filter.vi : filter.en}</span>
              <span className="org-event-status-count">{statusCounts[filter.value]}</span>
            </button>
          ))}
        </div>

        <div className="org-event-toolbar-controls">
          <WorkspaceFieldLabel className="org-event-search-field" label={language === 'vi' ? 'Tìm kiếm' : 'Search'}><div className="organizer-search-box org-event-search-box">
            <Search size={16} />
            <input value={searchQuery} onChange={event => updateSearch(event.target.value)} placeholder={language === 'vi' ? 'Tìm tên sự kiện...' : 'Search event name...'} />
          </div></WorkspaceFieldLabel>
          <WorkspaceFieldLabel className="org-event-sort-field" label={language === 'vi' ? 'Sắp xếp' : 'Sort'}><label className="org-event-sort-control">
            <SlidersHorizontal size={16} aria-hidden="true" />
            <select value={sortBy} onChange={event => updateSort(event.target.value as EventSort)}>
              <option value="updated_desc">{language === 'vi' ? 'Cập nhật gần nhất' : 'Recently updated'}</option>
              <option value="start_asc">{language === 'vi' ? 'Sắp diễn ra' : 'Starting soon'}</option>
              <option value="title_asc">{language === 'vi' ? 'Tên A–Z' : 'Name A–Z'}</option>
            </select>
          </label></WorkspaceFieldLabel>
          <span className="org-event-result-count" aria-live="polite">{processedEvents.length} {language === 'vi' ? 'kết quả' : 'results'}</span>
        </div>
      </section>

      {isLoading && events.length === 0 && (
        <div className="org-event-list" role="status" aria-label={language === 'vi' ? 'Đang tải danh sách sự kiện' : 'Loading events'}>
          {Array.from({ length: 5 }, (_, index) => <div key={index} className="org-event-row-skeleton" />)}
        </div>
      )}

      {!isLoading && loadError && events.length === 0 && (
        <div className="org-event-state org-event-state-error" role="alert">
          <CalendarDays size={28} aria-hidden="true" />
          <h2>{language === 'vi' ? 'Không thể tải danh sách sự kiện' : 'Unable to load events'}</h2>
          <p>{loadError}</p>
          {onRetry && <button type="button" className="btn-org-secondary" onClick={onRetry}>{language === 'vi' ? 'Thử lại' : 'Try again'}</button>}
        </div>
      )}

      {!isLoading && !loadError && events.length === 0 && (
        <div className="org-event-state">
          <CalendarDays size={28} aria-hidden="true" />
          <h2>{language === 'vi' ? 'Chưa có sự kiện nào' : 'No events yet'}</h2>
          <p>{language === 'vi' ? 'Tạo bản nháp đầu tiên để bắt đầu thiết lập lịch và vận hành sự kiện.' : 'Create the first draft to start planning your event.'}</p>
          <button type="button" className="btn-org-primary" onClick={onOpenCreateEvent}><Plus size={16} />{language === 'vi' ? 'Tạo sự kiện mới' : 'Create Event'}</button>
        </div>
      )}

      {events.length > 0 && processedEvents.length === 0 && (
        <div className="org-event-state">
          <Search size={28} aria-hidden="true" />
          <h2>{language === 'vi' ? 'Không tìm thấy sự kiện phù hợp' : 'No matching events'}</h2>
          <p>{language === 'vi' ? 'Thử từ khóa khác hoặc xóa các bộ lọc đang áp dụng.' : 'Try another keyword or clear the current filters.'}</p>
          <button type="button" className="btn-org-secondary" onClick={clearFilters}>{language === 'vi' ? 'Xóa bộ lọc' : 'Clear filters'}</button>
        </div>
      )}

      {visibleEvents.length > 0 && (
        <>
          <div className="org-event-list">
            {visibleEvents.map(event => (
              <article key={event.id} className={`org-event-row ${event.apiStatus === 'CANCELLED' ? 'is-cancelled' : ''}`.trim()}>
                <EventArtwork event={event} />
                <div className="org-event-row-content">
                  <div className="org-event-row-heading">
                    <button type="button" className="org-event-row-title" onClick={() => onSelectEvent(event.id)}>{event.title}</button>
                    <OrganizerEventStatusChip
                      language={language}
                      status={event.apiStatus}
                      className="org-event-status-chip-row"
                    />
                  </div>
                  <span className="org-event-row-date"><CalendarDays size={15} aria-hidden="true" />{event.dateRange}</span>
                  {event.apiStatus === 'CANCELLED' && event.cancellationReason?.trim() && (
                    <span className="org-event-cancellation-reason">
                      <strong>{language === 'vi' ? 'Lý do hủy:' : 'Cancellation reason:'}</strong> {event.cancellationReason.trim()}
                    </span>
                  )}
                </div>
                <div className="org-event-row-actions">
                  {event.apiStatus === 'DRAFT' ? (
                    <>
                      <button type="button" className="btn-org-primary org-event-action-primary" onClick={() => onEditEvent(event)}><Edit3 size={15} />{language === 'vi' ? 'Chỉnh sửa' : 'Edit'}</button>
                      <button
                        type="button"
                        className="btn-org-gold org-event-action-secondary"
                        onClick={() => onPublishEvent(event)}
                      >
                        <Send size={15} />{language === 'vi' ? 'Công bố' : 'Publish'}
                      </button>
                      <button type="button" className="btn-org-primary org-event-action-primary" onClick={() => onSelectEvent(event.id)}><Eye size={15} />{language === 'vi' ? 'Xem chi tiết' : 'View details'}</button>
                      <button type="button" className="btn-org-danger" onClick={() => onDeleteEvent(event)}><Trash2 size={15} />{language === 'vi' ? 'Xóa' : 'Delete'}</button>
                    </>
                  ) : (
                    <>
                      <button type="button" className="btn-org-primary org-event-action-primary" onClick={() => onSelectEvent(event.id)}><Eye size={15} />{language === 'vi' ? 'Xem chi tiết' : 'View details'}</button>
                      {event.apiStatus === 'PUBLISHED' && <button type="button" className="btn-org-danger" onClick={() => onCancelEvent(event)}><Ban size={15} />{language === 'vi' ? 'Hủy sự kiện' : 'Cancel event'}</button>}
                    </>
                  )}
                </div>
              </article>
            ))}
          </div>

          <div className="org-event-pagination">
            <span>{language === 'vi' ? `Hiển thị ${resultStart}–${resultEnd} trên ${processedEvents.length} sự kiện` : `Showing ${resultStart}–${resultEnd} of ${processedEvents.length} events`}</span>
            <ListPagination page={safeCurrentPage} pages={totalPages} onPage={value => updateListParams({ page: value })} />
          </div>
        </>
      )}
    </div>
  );
};
