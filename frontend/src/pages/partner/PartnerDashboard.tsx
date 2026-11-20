import {
  AlertCircle,
  ArrowRight,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  CreditCard,
  FileClock,
  FileText,
  MapPin,
  PlusCircle,
  Store,
} from 'lucide-react';
import React from 'react';
import { Link } from 'react-router-dom';
import {
  Language,
  PartnerEventApplication,
  PartnerOrganization,
  PartnerTodoItem,
} from '../../types';
import type { BoothRequest } from '../../types/booth';
import './PartnerPages.css';

interface PartnerDashboardProps {
  language: Language;
  organization: PartnerOrganization;
  applications: PartnerEventApplication[];
  boothRequests: BoothRequest[] | null;
  todos: PartnerTodoItem[];
  isLoading?: boolean;
  dataError?: string;
  boothRequestsError?: string;
}

type DashboardTone = 'success' | 'warning' | 'danger' | 'neutral';

interface DashboardTask {
  id: string;
  title: string;
  description: string;
  deadline?: string;
  link: string;
  action: string;
  tone: DashboardTone;
  icon: React.ReactNode;
}

interface RecentRecord {
  id: string;
  timestamp: number;
  time: string;
  activity: string;
  content: string;
  status: string;
  tone: DashboardTone;
  link: string;
}

const APPLICATION_STATUS_LABELS: Record<PartnerEventApplication['status'], string> = {
  pending: 'Chờ duyệt',
  approved: 'Đã duyệt',
  rejected: 'Từ chối',
  withdrawn: 'Đã rút',
};

const BOOTH_STATUS_LABELS: Record<BoothRequest['status'], string> = {
  PENDING: 'Chờ duyệt',
  SELECTED: 'Chờ thanh toán',
  COMPLETED: 'Hoàn tất',
  PAYMENT_EXPIRED: 'Hết hạn thanh toán',
  NOT_SELECTED: 'Không được chọn',
  REJECTED: 'Từ chối',
  WITHDRAWN: 'Đã rút',
  CANCELLED: 'Sự kiện đã hủy',
};

function timestamp(value: string | null | undefined): number {
  if (!value) return 0;
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) return 'Đang cập nhật';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString('vi-VN', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
    timeZone: 'Asia/Ho_Chi_Minh',
  });
}

function applicationTone(status: PartnerEventApplication['status']): DashboardTone {
  if (status === 'approved') return 'success';
  if (status === 'pending') return 'warning';
  if (status === 'rejected') return 'danger';
  return 'neutral';
}

function boothTone(status: BoothRequest['status']): DashboardTone {
  if (status === 'COMPLETED') return 'success';
  if (status === 'PENDING' || status === 'SELECTED') return 'warning';
  if (status === 'REJECTED' || status === 'PAYMENT_EXPIRED') return 'danger';
  return 'neutral';
}

function recentApplicationRecord(application: PartnerEventApplication): RecentRecord | null {
  if (application.status === 'withdrawn' && timestamp(application.withdrawnAt)) {
    return {
      id: `application-withdrawn-${application.id}`,
      timestamp: timestamp(application.withdrawnAt),
      time: formatDateTime(application.withdrawnAt),
      activity: 'Đã rút hồ sơ sự kiện',
      content: application.eventTitle,
      status: APPLICATION_STATUS_LABELS[application.status],
      tone: 'neutral',
      link: `/partner/events?application=${encodeURIComponent(application.id)}`,
    };
  }

  if ((application.status === 'approved' || application.status === 'rejected') && timestamp(application.reviewedAt)) {
    return {
      id: `application-reviewed-${application.id}`,
      timestamp: timestamp(application.reviewedAt),
      time: formatDateTime(application.reviewedAt),
      activity: application.status === 'approved' ? 'Hồ sơ sự kiện được duyệt' : 'Hồ sơ sự kiện bị từ chối',
      content: application.eventTitle,
      status: APPLICATION_STATUS_LABELS[application.status],
      tone: applicationTone(application.status),
      link: `/partner/events?application=${encodeURIComponent(application.id)}`,
    };
  }

  if (!timestamp(application.submittedAt)) return null;
  return {
    id: `application-submitted-${application.id}`,
    timestamp: timestamp(application.submittedAt),
    time: formatDateTime(application.submittedAt),
    activity: 'Đã gửi hồ sơ sự kiện',
    content: application.eventTitle,
    status: APPLICATION_STATUS_LABELS[application.status],
    tone: applicationTone(application.status),
    link: `/partner/events?application=${encodeURIComponent(application.id)}`,
  };
}

function recentBoothRecord(request: BoothRequest): RecentRecord | null {
  const relevantDate = request.completedAt
    || request.withdrawnAt
    || request.paymentExpiredAt
    || request.selectedAt
    || request.reviewedAt
    || request.submittedAt;
  if (!timestamp(relevantDate)) return null;

  const activity = request.completedAt
    ? 'Đã hoàn tất thuê gian hàng'
    : request.withdrawnAt
      ? 'Đã rút yêu cầu gian hàng'
      : request.paymentExpiredAt
        ? 'Yêu cầu gian hàng hết hạn'
        : request.selectedAt
          ? 'Gian hàng đã được chọn'
          : request.reviewedAt
            ? 'Yêu cầu gian hàng đã được xử lý'
            : 'Đã gửi yêu cầu gian hàng';

  return {
    id: `booth-${request.boothRequestId}`,
    timestamp: timestamp(relevantDate),
    time: formatDateTime(relevantDate),
    activity,
    content: `Gian ${request.boothCode}`,
    status: BOOTH_STATUS_LABELS[request.status],
    tone: boothTone(request.status),
    link: request.status === 'SELECTED'
      ? `/partner/booth-requests/${request.boothRequestId}/payment`
      : '/partner/booth-requests',
  };
}

export const PartnerDashboard: React.FC<PartnerDashboardProps> = ({
  language,
  organization,
  applications,
  boothRequests,
  todos,
  isLoading = false,
  dataError = '',
  boothRequestsError = '',
}) => {
  const [referenceTime] = React.useState(() => Date.now());
  const now = referenceTime;
  const requests = boothRequests || [];
  const approvedCount = applications.filter(application => application.status === 'approved').length;
  const pendingApplicationCount = applications.filter(application => application.status === 'pending').length;
  const rejectedCount = applications.filter(application => application.status === 'rejected').length;
  const withdrawnCount = applications.filter(application => application.status === 'withdrawn').length;
  const completedBooths = requests.filter(request => request.status === 'COMPLETED');
  const pendingRequests = requests.filter(request => request.status === 'PENDING');
  const activeHolds = requests.filter(request => request.hold?.status === 'ACTIVE' && timestamp(request.hold.expiresAt) > now);

  const upcomingApplications = applications
    .filter(application => application.status === 'approved'
      && timestamp(application.startAt) > 0
      && timestamp(application.endAt) >= now)
    .sort((left, right) => timestamp(left.startAt) - timestamp(right.startAt));
  const nextEvent = upcomingApplications[0] || null;
  const nextEventIsOngoing = nextEvent ? timestamp(nextEvent.startAt) <= now : false;

  const tasks: DashboardTask[] = [];
  activeHolds
    .filter(request => request.status === 'SELECTED')
    .sort((left, right) => timestamp(left.hold?.expiresAt) - timestamp(right.hold?.expiresAt))
    .forEach(request => tasks.push({
      id: `payment-${request.boothRequestId}`,
      title: `Hoàn tất thanh toán gian ${request.boothCode}`,
      description: 'Gian hàng đang được giữ cho tổ chức của bạn.',
      deadline: request.hold?.expiresAt ? `Giữ chỗ đến ${formatDateTime(request.hold.expiresAt)}` : undefined,
      link: `/partner/booth-requests/${request.boothRequestId}/payment`,
      action: 'Thanh toán ngay',
      tone: 'danger',
      icon: <CreditCard size={19} />,
    }));

  if (!organization.id) {
    tasks.push({
      id: 'complete-profile',
      title: 'Hoàn thiện hồ sơ tổ chức',
      description: 'Thông tin tổ chức đang thiếu và cần được hoàn thiện trước khi đăng ký sự kiện.',
      link: '/partner/profile',
      action: 'Hoàn thiện hồ sơ',
      tone: 'warning',
      icon: <FileText size={19} />,
    });
  }

  if (boothRequests !== null) {
    const applicationWithoutBooth = upcomingApplications.find(application => !requests.some(request => (
      String(request.eventId) === application.eventId
      && ['PENDING', 'SELECTED', 'COMPLETED'].includes(request.status)
    )));
    if (applicationWithoutBooth) {
      tasks.push({
        id: `select-booth-${applicationWithoutBooth.id}`,
        title: 'Chọn gian hàng cho sự kiện đã duyệt',
        description: applicationWithoutBooth.eventTitle,
        link: '/partner/booth-requests',
        action: 'Tìm gian hàng',
        tone: 'neutral',
        icon: <Store size={19} />,
      });
    }
  }

  todos
    .filter(todo => todo.status === 'need_action')
    .forEach(todo => tasks.push({
      id: `todo-${todo.id}`,
      title: todo.title,
      description: 'Yêu cầu đang chờ thao tác từ tổ chức của bạn.',
      deadline: todo.deadline ? `Hạn: ${todo.deadline}` : undefined,
      link: todo.link,
      action: 'Xử lý ngay',
      tone: 'danger',
      icon: <AlertCircle size={19} />,
    }));

  const recentRecords = [
    ...applications.map(recentApplicationRecord),
    ...requests.map(recentBoothRecord),
  ]
    .filter((record): record is RecentRecord => Boolean(record))
    .sort((left, right) => right.timestamp - left.timestamp)
    .slice(0, 6);

  const applicationBreakdown = `${approvedCount} đã duyệt · ${pendingApplicationCount} chờ duyệt${rejectedCount ? ` · ${rejectedCount} từ chối` : ''}${withdrawnCount ? ` · ${withdrawnCount} đã rút` : ''}`;

  return (
    <div className="partner-dashboard-page partner-workspace">
      <header className="partner-workspace-hero">
        <div className="partner-workspace-hero-copy">

          <h1 className="workspace-page-title">{language === 'vi' ? `Xin chào, ${organization.name}!` : `Welcome, ${organization.name}!`}</h1>
          <p className="workspace-page-subtitle">{language === 'vi' ? 'Cùng quản lý gian hàng và tham gia các sự kiện tại Đường Sách TP.HCM.' : 'Manage booths and take part in events at Ho Chi Minh City Book Street.'}</p>
          <div className="partner-workspace-actions">
            <Link to="/partner/events/apply" className="partner-workspace-primary-action"><PlusCircle size={17} />Đăng ký sự kiện mới<ArrowRight size={16} /></Link>
            <Link to="/partner/booth-requests" className="partner-workspace-secondary-action"><MapPin size={17} />Tìm gian hàng trên bản đồ</Link>
          </div>
        </div>
        <div className="partner-workspace-hero-image" aria-hidden="true"><span>ĐƯỜNG SÁCH<br />TP.HCM</span></div>
      </header>

      {dataError && <div className="partner-workspace-alert" role="alert"><AlertCircle size={18} /><div><strong>Chưa thể tải đầy đủ dữ liệu tổng quan</strong><p>{dataError}</p></div></div>}

      <section className="partner-workspace-section" aria-labelledby="quick-overview-title">
        <div className="partner-workspace-section-heading"><div><h2 id="quick-overview-title">Tổng quan nhanh</h2></div><p>Dữ liệu nghiệp vụ hiện tại của tổ chức</p></div>
        <div className="partner-workspace-stats" aria-busy={isLoading}>
          <Link to="/partner/events" className="partner-workspace-stat"><span className="partner-workspace-stat-icon"><FileClock size={21} /></span><div><strong>{isLoading ? '—' : applications.length}</strong><span>Hồ sơ sự kiện</span><small>{isLoading ? 'Đang tải dữ liệu…' : applicationBreakdown}</small></div><ArrowRight size={17} /></Link>
          <Link to="/partner/booths" className="partner-workspace-stat"><span className="partner-workspace-stat-icon is-success"><Store size={21} /></span><div><strong>{boothRequests === null ? '—' : completedBooths.length}</strong><span>Gian hàng đã được cấp</span><small>{boothRequestsError || (boothRequests === null ? 'Đang cập nhật dữ liệu' : 'Đã hoàn tất thuê gian hàng')}</small></div><ArrowRight size={17} /></Link>
          <Link to="/partner/booth-requests" className="partner-workspace-stat"><span className="partner-workspace-stat-icon is-warning"><ClipboardCheck size={21} /></span><div><strong>{boothRequests === null ? '—' : pendingRequests.length}</strong><span>Yêu cầu chờ duyệt</span><small>{boothRequests === null ? 'Đang cập nhật dữ liệu' : 'Đang chờ Ban Quản Lý xử lý'}</small></div><ArrowRight size={17} /></Link>
          <Link to="/partner/booth-requests" className="partner-workspace-stat"><span className="partner-workspace-stat-icon is-gold"><Clock3 size={21} /></span><div><strong>{boothRequests === null ? '—' : activeHolds.length}</strong><span>Giữ chỗ còn hiệu lực</span><small>{activeHolds[0]?.hold?.expiresAt ? `Gần nhất: ${formatDateTime(activeHolds[0].hold.expiresAt)}` : boothRequests === null ? 'Đang cập nhật dữ liệu' : 'Không có giữ chỗ đang hoạt động'}</small></div><ArrowRight size={17} /></Link>
        </div>
      </section>

      <div className="partner-workspace-operations">
        <section className="partner-workspace-panel" aria-labelledby="upcoming-event-title">
          <div className="partner-workspace-panel-heading"><div><h2 id="upcoming-event-title">Sự kiện sắp diễn ra của bạn</h2></div><Link to="/partner/events">Xem tất cả <ArrowRight size={14} /></Link></div>
          {nextEvent ? (
            <article className="partner-workspace-event">
              <div className={`partner-workspace-event-image ${nextEvent.imageUrl ? 'has-image' : ''}`}>{nextEvent.imageUrl ? <img src={nextEvent.imageUrl} alt={`Ảnh sự kiện ${nextEvent.eventTitle}`} /> : <BookOpen size={30} />}<span>{nextEventIsOngoing ? 'Đang diễn ra' : 'Sắp diễn ra'}</span></div>
              <div className="partner-workspace-event-body"><h3>{nextEvent.eventTitle}</h3><div className="partner-workspace-event-meta"><span><CalendarDays size={15} />{nextEvent.dateRange || `${formatDateTime(nextEvent.startAt)} – ${formatDateTime(nextEvent.endAt)}`}</span>{nextEvent.location && <span><MapPin size={15} />{nextEvent.location}</span>}</div><div className="partner-workspace-event-footer"><span className="partner-workspace-status is-success"><i />Hồ sơ đã duyệt</span><Link to={`/partner/events?application=${encodeURIComponent(nextEvent.id)}`}>Xem hồ sơ <ArrowRight size={14} /></Link></div></div>
            </article>
          ) : (
            <div className="partner-workspace-empty"><CalendarDays size={25} /><div><strong>Bạn chưa có sự kiện sắp diễn ra.</strong><p>Khám phá sự kiện đang mở để gửi hồ sơ tham gia.</p></div><Link to="/partner/events/apply">Khám phá sự kiện</Link></div>
          )}
        </section>

        <section className="partner-workspace-panel" aria-labelledby="attention-title">
          <div className="partner-workspace-panel-heading"><div><h2 id="attention-title">Công việc cần xử lý</h2></div>{tasks.length > 0 && <strong>{tasks.length} việc</strong>}</div>
          {tasks.length > 0 ? (
            <div className="partner-workspace-task-list">
              {tasks.slice(0, 4).map(task => (
                <article className={`partner-workspace-task is-${task.tone}`} key={task.id}><span className="partner-workspace-task-icon">{task.icon}</span><div><h3>{task.title}</h3><p>{task.description}</p>{task.deadline && <small><Clock3 size={13} />{task.deadline}</small>}</div><Link to={task.link}>{task.action}<ArrowRight size={14} /></Link></article>
              ))}
            </div>
          ) : (
            <div className="partner-workspace-empty is-compact"><CheckCircle2 size={25} /><div><strong>Hiện tại bạn không có công việc cần xử lý.</strong><p>Các hồ sơ đang chờ Ban Quản Lý sẽ được cập nhật khi có kết quả.</p></div></div>
          )}
        </section>
      </div>

      <section className="partner-workspace-section partner-workspace-activity" aria-labelledby="recent-activity-title">
        <div className="partner-workspace-section-heading"><div><h2 id="recent-activity-title">Hoạt động gần đây</h2></div><p>Các mốc cập nhật có thời gian xác định</p></div>
        {recentRecords.length > 0 ? (
          <div className="partner-workspace-table-wrap"><table className="partner-workspace-table"><thead><tr><th>Thời gian</th><th>Hoạt động</th><th>Nội dung</th><th>Trạng thái</th><th><span className="sr-only">Thao tác</span></th></tr></thead><tbody>{recentRecords.map(record => <tr key={record.id}><td data-label="Thời gian">{record.time}</td><td data-label="Hoạt động">{record.activity}</td><td data-label="Nội dung"><strong>{record.content}</strong></td><td data-label="Trạng thái"><span className={`partner-workspace-status is-${record.tone}`}><i />{record.status}</span></td><td><Link to={record.link} aria-label={`Xem ${record.content}`}>Xem <ArrowRight size={14} /></Link></td></tr>)}</tbody></table></div>
        ) : (
          <div className="partner-workspace-empty is-activity"><FileText size={25} /><div><strong>Chưa có hoạt động gần đây.</strong><p>Các lần gửi hoặc cập nhật hồ sơ sẽ xuất hiện tại đây.</p></div></div>
        )}
      </section>
    </div>
  );
};
