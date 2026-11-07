import { getPageCount, toPageIndex, LIST_PAGE_SIZE } from '../../constants/pagination';
import { ListPagination } from '../../components/ui/ListPagination';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Clock3,
  HelpCircle,
  Loader2,
  MapPin,
  QrCode,
  RefreshCw,
  Store,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ApiError } from '../../services/apiClient';
import { boothApi } from '../../services/boothApi';
import { paymentApi } from '../../services/paymentApi';
import { boothScanUrl } from '../../security/boothScanToken';
import { paymentMoney, paymentStatusLabel, paymentTime, positiveId } from '../../services/paymentPresentation';
import type { Language, PartnerEventApplication } from '../../types';
import type { BoothRequest, PageResponse } from '../../types/booth';
import type { BoothAssignment, BoothPayment } from '../../types/payment';
import './PartnerBoothDetailPage.css';

interface Props {
  language: Language;
  applications: PartnerEventApplication[];
}

function messageFrom(error: unknown): string {
  if (error instanceof ApiError) {
    return error.fieldErrors.map(item => item.message).filter(Boolean).join(' ') || error.message;
  }
  return error instanceof Error ? error.message : 'Không thể tải chi tiết gian hàng.';
}

function validDate(value: string | null | undefined): boolean {
  return Boolean(value && Number.isFinite(new Date(value).getTime()));
}

function eventSchedule(application: PartnerEventApplication | undefined): string {
  if (validDate(application?.startAt) && validDate(application?.endAt)) {
    return `${paymentTime(application!.startAt!)} – ${paymentTime(application!.endAt!)}`;
  }
  if (validDate(application?.startAt)) return `Bắt đầu ${paymentTime(application!.startAt!)}`;
  if (validDate(application?.endAt)) return `Kết thúc ${paymentTime(application!.endAt!)}`;
  return application?.dateRange?.trim() || 'Lịch sự kiện đang cập nhật';
}

export function PartnerBoothDetailPage({ language, applications }: Props) {
  const { requestId: rawRequestId } = useParams();
  const requestId = positiveId(rawRequestId);
  const [request, setRequest] = useState<BoothRequest | null>(null);
  const [assignment, setAssignment] = useState<BoothAssignment | null>(null);
  const [history, setHistory] = useState<PageResponse<BoothPayment> | null>(null);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(() => requestId !== null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [revision, setRevision] = useState(0);

  const applicationByEvent = useMemo(
    () => new Map(applications.map(application => [Number(application.eventId), application])),
    [applications],
  );

  useEffect(() => {
    if (requestId === null) return;
    let active = true;

    async function load() {
      const [requestResult, assignmentResult, historyResult] = await Promise.allSettled([
        boothApi.getPartnerRequest(requestId!),
        paymentApi.getAssignment(requestId!),
        paymentApi.listPayments(requestId!, { page, size: LIST_PAGE_SIZE }),
      ]);
      if (!active) return;

      if (requestResult.status === 'rejected') {
        setError(messageFrom(requestResult.reason));
        setLoading(false);
        return;
      }
      if (assignmentResult.status === 'rejected') {
        setRequest(requestResult.value);
        setAssignment(null);
        setHistory(historyResult.status === 'fulfilled' ? historyResult.value : null);
        setError(messageFrom(assignmentResult.reason));
        setLoading(false);
        return;
      }

      setRequest(requestResult.value);
      setAssignment(assignmentResult.value);
      setError('');
      if (historyResult.status === 'fulfilled') {
        setHistory(historyResult.value);
        const lastPage = getPageCount(historyResult.value.totalElements, LIST_PAGE_SIZE);
        if (page >= lastPage) { setPage(toPageIndex(lastPage)); return; }
        setNotice('');
      } else {
        setHistory(null);
        setNotice('Lịch sử thanh toán chưa thể tải. Thông tin cấp gian hàng vẫn được giữ nguyên.');
      }
      setLoading(false);
    }

    void load();
    return () => { active = false; };
  }, [page, requestId, revision]);

  const application = assignment ? applicationByEvent.get(assignment.eventId) : undefined;
  const eventTitle = application?.eventTitle || (assignment ? `Sự kiện #${assignment.eventId}` : 'Sự kiện đang cập nhật');
  const mapLink = assignment
    ? `/partner/booth-requests?eventId=${assignment.eventId}&boothId=${assignment.boothId}`
    : '/partner/booth-requests';

  return (
    <section className="partner-page partner-booth-detail" aria-labelledby="partner-booth-detail-title">
      <Link to="/partner/booths" className="partner-booth-detail-back">
        <ArrowLeft size={16} />
        <span>Quay lại Gian hàng của tôi</span>
      </Link>

      <header className="partner-booth-detail-header">
        <div>

          <h1 id="partner-booth-detail-title" className="workspace-page-title">
            {language === 'vi' ? `Gian ${assignment?.boothCode || request?.boothCode || ''}` : `Booth ${assignment?.boothCode || request?.boothCode || ''}`}
          </h1>
          <p className="workspace-page-subtitle">Thông tin cấp gian, mã nhận diện và lịch sử thanh toán của gian hàng.</p>
        </div>
        <button
          type="button"
          className="partner-booth-detail-refresh"
          onClick={() => { setLoading(true); setRevision(value => value + 1); }}
          disabled={loading || requestId === null}
        >
          <RefreshCw size={16} className={loading ? 'partner-booth-detail-spin' : ''} />
          {loading ? 'Đang cập nhật…' : 'Làm mới'}
        </button>
      </header>

      {requestId === null && (
        <div className="partner-booth-detail-alert is-error" role="alert">
          <AlertCircle size={18} /> Mã gian hàng không hợp lệ.
        </div>
      )}
      {error && (
        <div className="partner-booth-detail-alert is-error" role="alert">
          <AlertCircle size={18} />
          <span>{error}</span>
          <button type="button" onClick={() => { setLoading(true); setRevision(value => value + 1); }}>Thử lại</button>
        </div>
      )}
      {notice && <div className="partner-booth-detail-alert" role="status"><AlertCircle size={18} />{notice}</div>}

      {loading && !assignment ? (
        <div className="partner-booth-detail-loading" role="status">
          <Loader2 size={28} className="partner-booth-detail-spin" />
          <strong>Đang tải chi tiết gian hàng…</strong>
        </div>
      ) : assignment ? (
        <>
          <section className="partner-booth-detail-overview" aria-label="Thông tin gian hàng được cấp">
            <div className="partner-booth-detail-main">
              <div className="partner-booth-detail-title-row">
                <span className="partner-booth-detail-icon"><Store size={22} /></span>
                <div>
                  <span className="partner-booth-detail-label">Mã gian hàng</span>
                  <h2>Gian {assignment.boothCode}</h2>
                </div>
                <span className={`partner-booth-detail-status is-${assignment.status.toLocaleLowerCase('vi')}`}>
                  {assignment.status === 'ACTIVE' ? <CheckCircle2 size={15} /> : <Clock3 size={15} />}
                  {assignment.status === 'ACTIVE' ? 'Đã cấp' : 'Đã giải phóng'}
                </span>
              </div>

              <div className="partner-booth-detail-event">
                <span>Sự kiện</span>
                <strong>{eventTitle}</strong>
                <p><CalendarDays size={15} />{eventSchedule(application)}</p>
              </div>

              <dl className="partner-booth-detail-facts">
                <div><dt>Mã phân bổ</dt><dd>#{assignment.boothAssignmentId}</dd></div>
                <div><dt>Đơn vị được cấp</dt><dd>{assignment.partnerOrganizationName}</dd></div>
                <div><dt>Giá thuê đã khóa</dt><dd>{paymentMoney(assignment.lockedRentalPrice)}</dd></div>
                <div><dt>Ngày được cấp gian hàng</dt><dd>{paymentTime(assignment.assignedAt)}</dd></div>
              </dl>

              <div className="partner-booth-detail-actions">
                <Link to={mapLink}><MapPin size={16} /> Xem trên bản đồ</Link>
                <Link className="is-primary" to={`/partner/activities?eventId=${assignment.eventId}`}>
                  Quản lý hoạt động <ArrowRight size={16} />
                </Link>
              </div>
            </div>

            <figure className="partner-booth-detail-qr">
              <span><QrCode size={17} /> Mã nhận diện gian hàng</span>
              <div>
                <QRCodeSVG
                  value={boothScanUrl(assignment.qrToken)}
                  size={180}
                  title={`Mã QR gian hàng ${assignment.boothCode}`}
                />
              </div>
              <figcaption>Trưng bày tại gian hàng để độc giả quét, ghi nhận lượt ghé và nhận điểm.</figcaption>
            </figure>
          </section>

          <section className="partner-booth-detail-history" aria-labelledby="partner-booth-payment-history-title">
            <div className="partner-booth-detail-section-heading">
              <div>

                <h2 id="partner-booth-payment-history-title">Lịch sử thanh toán</h2>
              </div>
              {history && <strong>{history.totalElements} giao dịch</strong>}
            </div>

            {history?.content.length ? (
              <div className="partner-booth-detail-table-scroll">
                <table>
                  <thead>
                    <tr><th>Giao dịch</th><th>Số tiền</th><th>Trạng thái</th><th>Tạo lúc</th><th>Hoàn tất lúc</th></tr>
                  </thead>
                  <tbody>
                    {history.content.map(item => (
                      <tr key={item.boothPaymentId}>
                        <td>
                          <strong>#{item.boothPaymentId}</strong>
                          {item.gatewayTransactionRef && <small>Mã VNPay: {item.gatewayTransactionRef}</small>}
                        </td>
                        <td>{paymentMoney(item.amount)}</td>
                        <td>
                          <span className={`partner-booth-payment-status is-${item.status.toLocaleLowerCase('vi')}`}>
                            {paymentStatusLabel[item.status]}
                          </span>
                          {item.reconciliationRequired && <small className="is-warning">Cần đối soát</small>}
                        </td>
                        <td>{paymentTime(item.createdAt)}</td>
                        <td>{paymentTime(item.completedAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="partner-booth-detail-history-empty">
                <HelpCircle size={24} />
                <p>{assignment.lockedRentalPrice === 0 ? 'Gian hàng miễn phí, không phát sinh giao dịch VNPay.' : 'Chưa có giao dịch thanh toán.'}</p>
              </div>
            )}

            {history && getPageCount(history.totalElements, LIST_PAGE_SIZE) > 1 && (
              <ListPagination page={page + 1} pages={getPageCount(history.totalElements, LIST_PAGE_SIZE)} disabled={loading} onPage={value => { setLoading(true); setPage(toPageIndex(value)); }} />
            )}
          </section>
        </>
      ) : !error && requestId !== null ? (
        <div className="partner-booth-detail-loading">
          <Store size={28} />
          <strong>Chưa có thông tin cấp gian hàng</strong>
          <Link to="/partner/booths">Quay lại danh sách gian hàng</Link>
        </div>
      ) : null}
    </section>
  );
}
