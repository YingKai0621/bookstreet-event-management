import {
  AlertCircle,
  ArrowRight,
  CalendarDays,
  Check,
  ClipboardList,
  RefreshCw,
  Store,
} from 'lucide-react';
import React, { useId, useMemo, useState } from 'react';
import type {
  OrganizerDashboardSummary,
  OrganizerDashboardTask,
} from '../../services/organizerApi';
import type { Language } from '../../types';
import type { OrganizerEvent, OrganizerEventStatus, OrganizerTab } from '../../types/organizer';
import { OrganizerEventStatusChip } from './OrganizerEventStatusChip';
import { buildDashboardEventSummary } from './organizerDashboardModel';

export interface OrganizerDashboardProps {
  language: Language;
  events: OrganizerEvent[];
  summary: OrganizerDashboardSummary | null;
  isLoadingEvents?: boolean;
  eventsError?: string | null;
  isLoadingSummary?: boolean;
  summaryError?: string | null;
  onRetryEvents?: () => void;
  onRetrySummary?: () => void;
  onNavigateTab: (tab: OrganizerTab, extraState?: { eventId?: string; section?: string }) => void;
}

function buildChartScale(maxValue: number): { maximum: number; ticks: number[] } {
  if (maxValue <= 4) return { maximum: 4, ticks: [0, 1, 2, 3, 4] };
  const roughStep = maxValue / 4;
  const magnitude = 10 ** Math.floor(Math.log10(roughStep));
  const normalizedStep = roughStep / magnitude;
  const niceStep = normalizedStep <= 1
    ? magnitude
    : normalizedStep <= 2
      ? 2 * magnitude
      : normalizedStep <= 5
        ? 5 * magnitude
        : 10 * magnitude;
  const maximum = Math.ceil(maxValue / niceStep) * niceStep;
  return {
    maximum,
    ticks: Array.from(
      { length: Math.round(maximum / niceStep) + 1 },
      (_, index) => index * niceStep,
    ),
  };
}

function formatRelativeTime(value: string, language: Language): string {
  const submittedAt = new Date(value).getTime();
  if (!Number.isFinite(submittedAt)) return '';
  const elapsedMinutes = Math.max(0, Math.floor((Date.now() - submittedAt) / 60_000));
  if (elapsedMinutes < 60) return language === 'vi' ? `${elapsedMinutes} phút trước` : `${elapsedMinutes}m ago`;
  const hours = Math.floor(elapsedMinutes / 60);
  if (hours < 24) return language === 'vi' ? `${hours} giờ trước` : `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return language === 'vi' ? `${days} ngày trước` : `${days}d ago`;
}

function DashboardEventArtwork({ event }: { event: OrganizerEvent }) {
  const [failedImageUrl, setFailedImageUrl] = useState<string | null>(null);
  const startDate = new Date(event.startDate);
  const hasValidDate = Number.isFinite(startDate.getTime());

  if (event.imageUrl && failedImageUrl !== event.imageUrl) {
    return (
      <img
        src={event.imageUrl}
        alt=""
        className="org-dashboard-event-thumb"
        onError={() => setFailedImageUrl(event.imageUrl)}
      />
    );
  }

  return (
    <span className="org-dashboard-event-date" aria-hidden="true">
      {hasValidDate ? (
        <>
          <strong>{new Intl.DateTimeFormat('vi-VN', { day: '2-digit', timeZone: 'Asia/Ho_Chi_Minh' }).format(startDate)}</strong>
          <span>THG {new Intl.DateTimeFormat('vi-VN', { month: '2-digit', timeZone: 'Asia/Ho_Chi_Minh' }).format(startDate)}</span>
        </>
      ) : <CalendarDays size={19} />}
    </span>
  );
}

export const OrganizerDashboard: React.FC<OrganizerDashboardProps> = ({
  language,
  events,
  summary,
  isLoadingEvents = false,
  eventsError = null,
  isLoadingSummary = false,
  summaryError = null,
  onRetryEvents,
  onRetrySummary,
  onNavigateTab,
}) => {
  const eventSummary = useMemo(() => buildDashboardEventSummary(events), [events]);
  const upcomingEvents = eventSummary.upcomingEvents.slice(0, 4);
  const hasCachedEvents = events.length > 0;
  const hasEventsBlockingError = Boolean(eventsError && !hasCachedEvents && !isLoadingEvents);

  const copy = language === 'vi'
    ? {
      title: 'Tổng quan',
      subtitle: 'Sự kiện, công việc và tình hình hoạt động',
      activeKpi: 'Sự kiện đang hoạt động',
      partnerKpi: 'Hồ sơ đối tác chờ duyệt',
      boothKpi: 'Yêu cầu gian hàng chờ xử lý',
      globalScope: 'Tổng hợp tất cả sự kiện',
      upcomingTitle: 'Sự kiện sắp diễn ra',
      upcomingDescription: 'Sự kiện đang diễn ra và đã công bố, theo thời gian gần nhất.',
      tasksTitle: 'Việc cần xử lý',
      tasksDescription: 'Hồ sơ và yêu cầu chờ xử lý từ tất cả sự kiện.',
      partnerTask: 'Hồ sơ đối tác chờ duyệt',
      boothTask: 'Yêu cầu gian hàng chờ xử lý',
      eventPrefix: 'Sự kiện:',
      noTasks: 'Không có việc cần xử lý',
      noTasksHint: 'Các hồ sơ và yêu cầu gian hàng đã được xử lý.',
      moreTasks: 'Việc khác đang chờ xử lý',
      analyticsTitle: 'Thống kê hoạt động',
      analyticsDescription: 'Tổng quan trạng thái sự kiện và hồ sơ đối tác từ tất cả sự kiện.',
      eventStatusChart: 'Sự kiện theo trạng thái',
      partnerStatusChart: 'Hồ sơ đối tác theo kết quả',
      detailedReport: 'Xem báo cáo chi tiết',
      totalEvents: 'sự kiện',
      noEventStats: 'Chưa có dữ liệu sự kiện.',
      noPartnerStats: 'Chưa có hồ sơ đối tác.',
      summaryLoading: 'Đang tải dữ liệu tổng hợp...',
      summaryError: 'Không thể tải dữ liệu tổng hợp',
      eventStatuses: { DRAFT: 'Bản nháp', PUBLISHED: 'Đã công bố', ONGOING: 'Đang diễn ra', COMPLETED: 'Đã kết thúc', CANCELLED: 'Đã hủy' },
      partnerStatuses: { PENDING: 'Chờ duyệt', APPROVED: 'Đã duyệt', REJECTED: 'Từ chối' },
      viewAll: 'Xem tất cả',
      viewDetails: 'Xem chi tiết',
      noUpcoming: 'Chưa có sự kiện đang diễn ra hoặc sắp tới.',
      noUpcomingHint: 'Bản nháp, sự kiện đã kết thúc và đã hủy không xuất hiện tại đây.',
      eventsLoadError: 'Không thể tải dữ liệu sự kiện',
      retry: 'Thử lại',
      loading: 'Đang tải dữ liệu tổng quan...',
    }
    : {
      title: 'Overview',
      subtitle: 'Events, work queue and operational activity',
      activeKpi: 'Active events',
      partnerKpi: 'Partner applications pending',
      boothKpi: 'Booth requests pending',
      globalScope: 'Across all events',
      upcomingTitle: 'Upcoming events',
      upcomingDescription: 'Ongoing and published events ordered by nearest start time.',
      tasksTitle: 'Work queue',
      tasksDescription: 'Pending applications and booth requests across all events.',
      partnerTask: 'Partner application pending',
      boothTask: 'Booth request pending',
      eventPrefix: 'Event:',
      noTasks: 'No work pending',
      noTasksHint: 'Partner applications and booth requests are up to date.',
      moreTasks: 'More tasks pending',
      analyticsTitle: 'Activity statistics',
      analyticsDescription: 'Event and partner application status across all events.',
      eventStatusChart: 'Events by status',
      partnerStatusChart: 'Partner applications by outcome',
      detailedReport: 'View detailed reports',
      totalEvents: 'events',
      noEventStats: 'No event data available.',
      noPartnerStats: 'No partner applications available.',
      summaryLoading: 'Loading aggregate data...',
      summaryError: 'Unable to load aggregate data',
      eventStatuses: { DRAFT: 'Draft', PUBLISHED: 'Published', ONGOING: 'Ongoing', COMPLETED: 'Completed', CANCELLED: 'Cancelled' },
      partnerStatuses: { PENDING: 'Pending', APPROVED: 'Approved', REJECTED: 'Rejected' },
      viewAll: 'View all',
      viewDetails: 'View details',
      noUpcoming: 'No ongoing or upcoming events.',
      noUpcomingHint: 'Draft, completed and cancelled events are excluded.',
      eventsLoadError: 'Unable to load event data',
      retry: 'Try again',
      loading: 'Loading overview...',
    };

  const eventStatusCounts: Record<OrganizerEventStatus, number> = summary?.eventStatusCounts ?? {
    DRAFT: 0,
    PUBLISHED: 0,
    ONGOING: 0,
    COMPLETED: 0,
    CANCELLED: 0,
  };
  const applicationCounts = summary?.partnerApplicationStatusCounts ?? {
    PENDING: 0,
    APPROVED: 0,
    REJECTED: 0,
    WITHDRAWN: 0,
  };
  const priorityTasks = summary?.priorityTasks ?? [];
  const pendingTaskTotal = (summary?.pendingPartnerApplicationCount ?? 0)
    + (summary?.pendingBoothRequestCount ?? 0);
  const remainingTaskCount = Math.max(0, pendingTaskTotal - priorityTasks.length);
  const summaryValue = (value?: number) => isLoadingSummary || summaryError || !summary ? '—' : value ?? 0;

  const firstTask = (type: OrganizerDashboardTask['type']) => priorityTasks.find(task => task.type === type);
  const openTask = (task: OrganizerDashboardTask) => {
    if (task.type === 'PARTNER_APPLICATION') {
      onNavigateTab('event_detail', { eventId: String(task.eventId), section: 'partners' });
      return;
    }
    onNavigateTab('booth_requests', { eventId: String(task.eventId) });
  };
  const openPartnerApplications = () => {
    const task = firstTask('PARTNER_APPLICATION');
    if (task) openTask(task);
    else onNavigateTab('events');
  };
  const openBoothRequests = () => {
    const task = firstTask('BOOTH_REQUEST');
    onNavigateTab('booth_requests', task ? { eventId: String(task.eventId) } : undefined);
  };

  const eventChartSeries = [
    { key: 'DRAFT' as const, label: copy.eventStatuses.DRAFT, count: eventStatusCounts.DRAFT, color: '#6bbf7b' },
    { key: 'PUBLISHED' as const, label: copy.eventStatuses.PUBLISHED, count: eventStatusCounts.PUBLISHED, color: '#d9a22e' },
    { key: 'ONGOING' as const, label: copy.eventStatuses.ONGOING, count: eventStatusCounts.ONGOING, color: '#258563' },
    { key: 'COMPLETED' as const, label: copy.eventStatuses.COMPLETED, count: eventStatusCounts.COMPLETED, color: '#315f53' },
    { key: 'CANCELLED' as const, label: copy.eventStatuses.CANCELLED, count: eventStatusCounts.CANCELLED, color: '#e0443e' },
  ];
  const eventTotal = eventChartSeries.reduce((sum, item) => sum + item.count, 0);
  const donutMaskId = useId();
  const donutRadius = 43;
  const donutCircumference = 2 * Math.PI * donutRadius;
  let donutOffset = 0;
  const partnerChartSeries = [
    { key: 'PENDING' as const, label: copy.partnerStatuses.PENDING, count: applicationCounts.PENDING, color: '#d9a22e' },
    { key: 'APPROVED' as const, label: copy.partnerStatuses.APPROVED, count: applicationCounts.APPROVED, color: '#258563' },
    { key: 'REJECTED' as const, label: copy.partnerStatuses.REJECTED, count: applicationCounts.REJECTED, color: '#e0443e' },
  ];
  const partnerChartTotal = partnerChartSeries.reduce((sum, item) => sum + item.count, 0);
  const partnerChartScale = buildChartScale(Math.max(...partnerChartSeries.map(item => item.count), 0));
  const partnerChartLabel = partnerChartSeries.map(item => `${item.label}: ${item.count}`).join(', ');

  return (
    <div className="organizer-content org-dashboard">
      <header className="org-dashboard-header">
        <div><h1 className="org-dashboard-title workspace-page-title">{copy.title}</h1><p className="org-dashboard-subtitle workspace-page-subtitle">{copy.subtitle}</p></div>
      </header>

      {eventsError && (
        <div className={`org-dashboard-notice ${hasCachedEvents ? 'is-warning' : 'is-error'}`} role="alert">
          <AlertCircle size={19} aria-hidden="true" />
          <div><strong>{copy.eventsLoadError}</strong><span>{eventsError}</span></div>
          {onRetryEvents && <button type="button" className="org-dashboard-text-action" onClick={onRetryEvents}><RefreshCw size={15} />{copy.retry}</button>}
        </div>
      )}

      {summaryError && (
        <div className="org-dashboard-notice is-error" role="alert">
          <AlertCircle size={19} aria-hidden="true" />
          <div><strong>{copy.summaryError}</strong><span>{summaryError}</span></div>
          {onRetrySummary && <button type="button" className="org-dashboard-text-action" onClick={onRetrySummary}><RefreshCw size={15} />{copy.retry}</button>}
        </div>
      )}

      {isLoadingEvents && !hasCachedEvents ? (
        <div className="org-dashboard-loading" role="status"><span className="org-dashboard-spinner" />{copy.loading}</div>
      ) : !hasEventsBlockingError && (
        <>
          <section className="org-dashboard-kpi-section" aria-label={language === 'vi' ? 'Chỉ số vận hành' : 'Operational metrics'}>
            <div className="org-dashboard-kpis">
              <button type="button" className="org-dashboard-kpi is-events" onClick={() => onNavigateTab('events')}>
                <span className="org-dashboard-kpi-icon"><CalendarDays size={21} /></span>
                <span className="org-dashboard-kpi-copy"><span>{copy.activeKpi}</span><strong>{summaryValue(summary?.activeEventCount)}</strong><small>{copy.globalScope}</small></span>
                <ArrowRight size={17} className="org-dashboard-kpi-arrow" />
              </button>
              <button type="button" className="org-dashboard-kpi is-partners" onClick={openPartnerApplications}>
                <span className="org-dashboard-kpi-icon"><ClipboardList size={21} /></span>
                <span className="org-dashboard-kpi-copy"><span>{copy.partnerKpi}</span><strong>{summaryValue(summary?.pendingPartnerApplicationCount)}</strong><small>{copy.globalScope}</small></span>
                <ArrowRight size={17} className="org-dashboard-kpi-arrow" />
              </button>
              <button type="button" className="org-dashboard-kpi is-booths" onClick={openBoothRequests}>
                <span className="org-dashboard-kpi-icon"><Store size={21} /></span>
                <span className="org-dashboard-kpi-copy"><span>{copy.boothKpi}</span><strong>{summaryValue(summary?.pendingBoothRequestCount)}</strong><small>{copy.globalScope}</small></span>
                <ArrowRight size={17} className="org-dashboard-kpi-arrow" />
              </button>
            </div>
          </section>

          <div className="org-dashboard-columns">
            <section className="org-dashboard-panel org-dashboard-events" aria-labelledby="org-dashboard-upcoming-title">
              <div className="org-dashboard-panel-heading">
                <div><h2 id="org-dashboard-upcoming-title">{copy.upcomingTitle}</h2><p>{copy.upcomingDescription}</p></div>
                <button type="button" className="org-dashboard-text-action" onClick={() => onNavigateTab('events')}>{copy.viewAll}<ArrowRight size={15} /></button>
              </div>
              {upcomingEvents.length > 0 ? (
                <div className="org-dashboard-event-list">
                  {upcomingEvents.map(event => (
                    <button type="button" key={event.id} className="org-dashboard-event-row" onClick={() => onNavigateTab('event_detail', { eventId: event.id })} aria-label={`${copy.viewDetails}: ${event.title}`}>
                      <DashboardEventArtwork event={event} />
                      <span className="org-dashboard-event-copy">
                        <span className="org-dashboard-event-title-line"><h3 title={event.title}>{event.title}</h3><OrganizerEventStatusChip language={language} status={event.apiStatus} /></span>
                        <span className="org-dashboard-event-time"><CalendarDays size={14} />{event.dateRange}</span>
                      </span>
                      <span className="org-dashboard-row-action">{copy.viewDetails}<ArrowRight size={15} /></span>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="org-dashboard-inline-empty"><CalendarDays size={21} /><div><strong>{copy.noUpcoming}</strong><span>{copy.noUpcomingHint}</span></div></div>
              )}
            </section>

            <section className="org-dashboard-panel org-dashboard-tasks" aria-labelledby="org-dashboard-tasks-title">
              <div className="org-dashboard-panel-heading">
                <div><h2 id="org-dashboard-tasks-title">{copy.tasksTitle}</h2><p>{copy.tasksDescription}</p></div>
              </div>
              {isLoadingSummary ? (
                <div className="org-dashboard-compact-state" role="status"><span className="org-dashboard-spinner" /><span>{copy.summaryLoading}</span></div>
              ) : summaryError ? (
                <div className="org-dashboard-compact-state is-error" role="status"><AlertCircle size={20} /><div><strong>{copy.summaryError}</strong></div></div>
              ) : priorityTasks.length === 0 ? (
                <div className="org-dashboard-compact-state is-clear"><span className="org-dashboard-clear-icon"><Check size={18} /></span><div><strong>{copy.noTasks}</strong><span>{copy.noTasksHint}</span></div></div>
              ) : (
                <div className="org-dashboard-task-list">
                  {priorityTasks.map(task => (
                    <button type="button" key={`${task.type}-${task.id}`} className={`org-dashboard-task-row is-${task.type.toLowerCase()}`} onClick={() => openTask(task)}>
                      <span className="org-dashboard-task-icon">{task.type === 'PARTNER_APPLICATION' ? <ClipboardList size={18} /> : <Store size={18} />}</span>
                      <span className="org-dashboard-task-copy">
                        <strong>{task.type === 'PARTNER_APPLICATION' ? copy.partnerTask : copy.boothTask}</strong>
                        <span title={task.subjectName}>{task.subjectName}</span>
                        <small title={task.eventName}>{copy.eventPrefix} {task.eventName}</small>
                      </span>
                      <span className="org-dashboard-task-time">{formatRelativeTime(task.submittedAt, language)}</span>
                      <ArrowRight size={15} className="org-dashboard-task-chevron" />
                    </button>
                  ))}
                  {remainingTaskCount > 0 && <div className="org-dashboard-task-more"><span>+{remainingTaskCount}</span>{copy.moreTasks}</div>}
                </div>
              )}
            </section>
          </div>

          <section className="org-dashboard-analytics" aria-labelledby="org-dashboard-analytics-title">
            <div className="org-dashboard-analytics-heading">
              <div><h2 id="org-dashboard-analytics-title">{copy.analyticsTitle}</h2><p>{copy.analyticsDescription}</p></div>
              <button type="button" className="org-dashboard-text-action" onClick={() => onNavigateTab('reports')}>{copy.detailedReport}<ArrowRight size={15} /></button>
            </div>
            <div className="org-dashboard-chart-grid">
              <article className="org-dashboard-chart-card" aria-labelledby="org-dashboard-event-chart-title">
                <header><h3 id="org-dashboard-event-chart-title">{copy.eventStatusChart}</h3></header>
                {isLoadingSummary ? <div className="org-dashboard-chart-empty"><span className="org-dashboard-spinner" />{copy.summaryLoading}</div> : summaryError ? (
                  <div className="org-dashboard-chart-empty is-error">{copy.summaryError}</div>
                ) : eventTotal === 0 ? (
                  <div className="org-dashboard-chart-empty">{copy.noEventStats}</div>
                ) : (
                  <div className="org-dashboard-donut-layout">
                    <div className="org-dashboard-donut">
                      <svg viewBox="0 0 120 120" role="img" aria-label={`${copy.eventStatusChart}: ${eventTotal} ${copy.totalEvents}`}>
                        <defs><mask id={donutMaskId} maskUnits="userSpaceOnUse" x="0" y="0" width="120" height="120">
                          <circle className="org-dashboard-donut-reveal" cx="60" cy="60" r={donutRadius} fill="none" stroke="white" strokeWidth="24" pathLength="1" strokeDasharray="1" transform="rotate(-90 60 60)" />
                        </mask></defs>
                        <circle cx="60" cy="60" r={donutRadius} fill="none" stroke="#e8eeeb" strokeWidth="22" />
                        <g mask={`url(#${donutMaskId})`}>
                        {eventChartSeries.map(item => {
                          const segmentLength = (item.count / eventTotal) * donutCircumference;
                          const segmentOffset = donutOffset;
                          donutOffset += segmentLength;
                          if (item.count === 0) return null;
                          const segmentGap = Math.min(1.4, segmentLength * 0.25);
                          return <circle key={item.key} cx="60" cy="60" r={donutRadius} fill="none" stroke={item.color} strokeWidth="22" strokeDasharray={`${segmentLength - segmentGap} ${donutCircumference - segmentLength + segmentGap}`} strokeDashoffset={-segmentOffset} transform="rotate(-90 60 60)"><title>{item.label}: {item.count}</title></circle>;
                        })}
                        </g>
                      </svg>
                      <span><strong>{eventTotal}</strong><small>{copy.totalEvents}</small></span>
                    </div>
                    <div className="org-dashboard-chart-legend">
                      {eventChartSeries.map(item => <div key={item.key}><span className="org-dashboard-legend-dot" style={{ backgroundColor: item.color }} /><span>{item.label}</span><strong>{item.count}</strong></div>)}
                    </div>
                  </div>
                )}
              </article>

              <article className="org-dashboard-chart-card" aria-labelledby="org-dashboard-partner-chart-title">
                <header><h3 id="org-dashboard-partner-chart-title">{copy.partnerStatusChart}</h3></header>
                {isLoadingSummary ? <div className="org-dashboard-chart-empty"><span className="org-dashboard-spinner" />{copy.summaryLoading}</div> : summaryError ? (
                  <div className="org-dashboard-chart-empty is-error">{copy.summaryError}</div>
                ) : partnerChartTotal === 0 ? (
                  <div className="org-dashboard-chart-empty">{copy.noPartnerStats}</div>
                ) : (
                  <div className="org-dashboard-column-chart" role="img" aria-label={`${copy.partnerStatusChart}: ${partnerChartLabel}`}>
                    <div className="org-dashboard-column-axis" aria-hidden="true">{partnerChartScale.ticks.map(tick => <span key={tick} style={{ bottom: `${(tick / partnerChartScale.maximum) * 100}%` }}>{tick}</span>)}</div>
                    <div className="org-dashboard-column-plot">
                      <div className="org-dashboard-column-grid" aria-hidden="true">{partnerChartScale.ticks.map(tick => <span key={tick} style={{ bottom: `${(tick / partnerChartScale.maximum) * 100}%` }} />)}</div>
                      <div className="org-dashboard-columns-bars">
                        {partnerChartSeries.map(item => (
                          <div className="org-dashboard-column" key={item.key} title={`${item.label}: ${item.count}`}>
                            <div className="org-dashboard-column-track"><span className="org-dashboard-column-value" style={{ bottom: `calc(${(item.count / partnerChartScale.maximum) * 100}% + 0.35rem)` }}>{item.count}</span><span className="org-dashboard-column-bar" style={{ height: `${(item.count / partnerChartScale.maximum) * 100}%`, backgroundColor: item.color }} /></div>
                            <span className="org-dashboard-column-label">{item.label}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </article>
            </div>
          </section>
        </>
      )}
    </div>
  );
};
