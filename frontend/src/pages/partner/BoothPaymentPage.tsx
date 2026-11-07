import { getPageCount, toPageIndex, LIST_PAGE_SIZE } from '../../constants/pagination';
import { ListPagination } from '../../components/ui/ListPagination';
import { useCallback, useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Clock,
  HelpCircle,
  Loader2,
  RefreshCw,
  ShieldAlert,
  Store,
} from 'lucide-react';
import { BoothPaymentCheckoutCard } from '../../components/partner/BoothPaymentCheckoutCard';
import { boothApi } from '../../services/boothApi';
import { ApiError } from '../../services/apiClient';
import { paymentApi } from '../../services/paymentApi';
import { boothScanUrl } from '../../security/boothScanToken';
import { paymentMoney, paymentStatusLabel, paymentTime, positiveId } from '../../services/paymentPresentation';
import type { BoothRequest, PageResponse } from '../../types/booth';
import type { BoothAssignment, BoothPayment } from '../../types/payment';
import './BoothPaymentPage.css';

export function BoothPaymentPage() {
  const { requestId: rawRequestId } = useParams();
  const [search] = useSearchParams();
  const requestId = positiveId(rawRequestId);
  const selectedPaymentId = positiveId(search.get('paymentId'));
  const [request, setRequest] = useState<BoothRequest | null>(null);
  const [history, setHistory] = useState<PageResponse<BoothPayment> | null>(null);
  const [selectedPayment, setSelectedPayment] = useState<BoothPayment | null>(null);
  const [assignment, setAssignment] = useState<BoothAssignment | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(() => requestId !== null);
  const [page, setPage] = useState(0);
  const [revision, setRevision] = useState(0);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (requestId === null) return;
    let active = true;
    let timer: number | undefined;
    async function load() {
      try {
        const [nextRequest, nextHistory, focused] = await Promise.all([
          boothApi.getPartnerRequest(requestId!),
          paymentApi.listPayments(requestId!, { page, size: LIST_PAGE_SIZE }),
          selectedPaymentId === null ? Promise.resolve(null) : paymentApi.getPayment(selectedPaymentId),
        ]);
        if (!active) return;
        if (focused && focused.boothRequestId !== requestId) {
          setRequest(null);
          setHistory(null);
          setAssignment(null);
          setSelectedPayment(null);
          throw new Error('Giao dịch không thuộc yêu cầu gian hàng này.');
        }
        const nextAssignment = nextRequest.status === 'COMPLETED'
          ? await paymentApi.getAssignment(requestId!) : null;
        if (!active) return;
        setRequest(nextRequest);
        setHistory(nextHistory);
        const lastPage = getPageCount(nextHistory.totalElements, LIST_PAGE_SIZE);
        if (page >= lastPage) { setPage(toPageIndex(lastPage)); return; }
        setSelectedPayment(focused);
        setAssignment(nextAssignment);
        setError('');
        if (nextRequest.status === 'SELECTED' || nextHistory.content.some(item => item.status === 'PENDING')) {
          timer = window.setTimeout(() => void load(), 5000);
        }
      } catch (caught) {
        if (active) {
          setError(caught instanceof Error ? caught.message : 'Không thể tải thông tin thanh toán.');
          if (caught instanceof ApiError && ![401, 403, 404].includes(caught.status)) {
            timer = window.setTimeout(() => void load(), 10_000);
          }
        }
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => { active = false; window.clearTimeout(timer); };
  }, [requestId, selectedPaymentId, page, revision]);

  const refresh = useCallback(() => { setLoading(true); setRevision(value => value + 1); }, []);
  const focused = selectedPayment ?? history?.content[0];

  return (
    <section className="partner-page s3-payment-page">
      <Link to="/partner/booth-requests" className="s3-back-link">
        <ArrowLeft size={16} />
        <span>Quay lại Chọn và thuê gian hàng</span>
      </Link>

      <header className="s3-payment-heading">
        <div className="s3-heading-left">
          <div className="s3-heading-badge">
            <Store size={14} />
            <span>Thanh toán & Cấp gian hàng</span>
          </div>
          <h1 className="workspace-page-title">Gian hàng {request?.boothCode || ''}</h1>
          <p className="workspace-page-subtitle">Theo dõi kết quả xác thực thanh toán thời gian thực, lịch sử đối soát và thông tin gian hàng đã được cấp.</p>
        </div>
        <button
          type="button"
          className="s3-btn-refresh"
          onClick={refresh}
          disabled={loading || requestId === null}
        >
          <RefreshCw size={15} className={loading ? 's3-spin' : ''} />
          <span>{loading ? 'Đang cập nhật…' : 'Làm mới'}</span>
        </button>
      </header>

      {requestId === null && (
        <div className="s3-alert-banner is-error" role="alert">
          <AlertCircle size={18} />
          <span>Mã yêu cầu gian hàng không hợp lệ.</span>
        </div>
      )}

      {error && (
        <div className="s3-payment-error" role="alert">
          <AlertCircle size={18} />
          <span>{error} Thông tin hiển thị trước đó chưa được cập nhật.</span>
        </div>
      )}

      {loading && !focused && !request && (
        <div className="s3-loading-state" role="status">
          <Loader2 size={24} className="s3-spin" />
          <span>Đang cập nhật thông tin thanh toán…</span>
        </div>
      )}

      {request && (
        <>
          {focused && (
            <div
              className={`s3-payment-result s3-result-${focused.status.toLowerCase()} ${focused.reconciliationRequired ? 'is-reconciliation' : ''}`}
              role="status"
              data-testid="payment-result"
            >
              <div className="s3-result-icon-col">
                {focused.reconciliationRequired ? (
                  <ShieldAlert size={28} />
                ) : focused.status === 'SUCCESS' ? (
                  <CheckCircle2 size={28} />
                ) : focused.status === 'PENDING' ? (
                  <Clock size={28} className="s3-spin-slow" />
                ) : (
                  <AlertCircle size={28} />
                )}
              </div>
              <div className="s3-result-content">
                <div className="s3-result-header-row">
                  <h2>{focused.reconciliationRequired ? 'Giao dịch cần đối soát' : paymentStatusLabel[focused.status]}</h2>
                  <span className="s3-result-amount">{paymentMoney(focused.amount)}</span>
                </div>
                <div className="s3-result-meta-chip">
                  <span>Giao dịch #{focused.boothPaymentId}</span>
                  {focused.gatewayTransactionRef && (
                    <span>· Mã VNPay: {focused.gatewayTransactionRef}</span>
                  )}
                </div>
                <div className="s3-result-message">
                  {focused.status === 'PENDING' || focused.reconciliationRequired ? (
                    <p>Đang xác minh kết quả với VNPay, tự cập nhật mỗi 5 giây. Chưa có thời điểm chắc chắn để thử lại. Bạn có thể thanh toán lại khi hệ thống xác nhận lần trước đã thất bại hoặc hết hạn, và thời gian giữ chỗ vẫn còn.</p>
                  ) : focused.status === 'SUCCESS' ? (
                    <p>Hệ thống đã xác nhận thanh toán thành công. Thông tin gian hàng được cấp hiển thị bên dưới.</p>
                  ) : (
                    <p>{focused.failureMessage || 'Lần thanh toán này chưa hoàn tất.'} Bạn có thể thử lại nếu thời gian giữ chỗ còn hiệu lực và không có giao dịch cần đối soát.</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {!assignment && request.status === 'SELECTED' && (
            <BoothPaymentCheckoutCard key={requestId} request={request} now={now} onPaymentCreated={refresh} />
          )}

          {request.status === 'PAYMENT_EXPIRED' && (
            <div className="s3-alert-banner is-expired" role="status">
              <Clock size={18} />
              <span>Thời gian giữ chỗ đã hết hạn theo xác nhận của hệ thống. Không thể tạo phiên thanh toán mới.</span>
            </div>
          )}

          {assignment && (
            <section className="s3-assignment-card" data-testid="booth-assignment">
              <div className="s3-assignment-info">
                <div className="s3-assignment-badge">
                  <span>Cấp phép thành công</span>
                </div>
                <h2>Gian hàng đã được cấp: {assignment.boothCode}</h2>
                <dl className="s3-assignment-grid">
                  <dt>Mã phân bổ</dt>
                  <dd>#{assignment.boothAssignmentId}</dd>

                  <dt>Đơn vị</dt>
                  <dd>{assignment.partnerOrganizationName}</dd>

                  <dt>Giá thuê đã khóa</dt>
                  <dd className="s3-highlight-price">{paymentMoney(assignment.lockedRentalPrice)}</dd>

                  <dt>Thời điểm cấp</dt>
                  <dd>{paymentTime(assignment.assignedAt)}</dd>

                  <dt>Trạng thái</dt>
                  <dd>
                    <span className="s3-badge-status-active">
                      {assignment.status === 'ACTIVE' ? 'Đang được cấp' : assignment.status}
                    </span>
                  </dd>
                </dl>
                {assignment.lockedRentalPrice === 0 && (
                  <p className="s3-free-note">Gian hàng miễn phí, không phát sinh thanh toán VNPay.</p>
                )}
              </div>

              {assignment.coverImageUrl && (
                <div className="s3-assignment-cover-wrapper">
                  <img
                    src={assignment.coverImageUrl}
                    alt={`Gian hàng ${assignment.boothCode}`}
                    className="s3-assignment-cover"
                  />
                </div>
              )}

              <figure className="s3-assignment-qr">
                <div className="s3-qr-box">
                  <QRCodeSVG value={boothScanUrl(assignment.qrToken)} size={150} title={`Mã QR gian hàng ${assignment.boothCode}`} />
                </div>
                <figcaption>QR lượt ghé dành cho độc giả</figcaption>
              </figure>
            </section>
          )}

          <section className="s3-payment-history">
            <div className="s3-history-header">
              <h2>Lịch sử thanh toán</h2>
              {history?.content && history.content.length > 0 && (
                <span className="s3-history-count">{history.content.length} giao dịch</span>
              )}
            </div>

            {history?.content.length ? (
              <div className="s3-table-scroll">
                <table className="s3-history-table">
                  <thead>
                    <tr>
                      <th>Giao dịch</th>
                      <th>Số tiền</th>
                      <th>Trạng thái</th>
                      <th>Tạo lúc</th>
                      <th>Hoàn tất lúc</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.content.map(item => {
                      const isPendingItem = item.status === 'PENDING';
                      const isSuccessItem = item.status === 'SUCCESS';
                      return (
                        <tr key={item.boothPaymentId} className={focused?.boothPaymentId === item.boothPaymentId ? 'is-focused' : ''}>
                          <td>
                            <Link to={`?paymentId=${item.boothPaymentId}`} className="s3-payment-id-link">
                              #{item.boothPaymentId}
                            </Link>
                            {item.gatewayTransactionRef && (
                              <small className="s3-vnpay-ref">Mã VNPay: {item.gatewayTransactionRef}</small>
                            )}
                          </td>
                          <td className="s3-table-amount">{paymentMoney(item.amount)}</td>
                          <td>
                            <span className={`s3-table-status-pill ${isSuccessItem ? 'success' : isPendingItem ? 'pending' : 'failed'}`}>
                              {paymentStatusLabel[item.status]}
                            </span>
                            {item.reconciliationRequired && (
                              <span className="s3-recon-pill">Cần đối soát</span>
                            )}
                            {item.failureMessage && (
                              <small className="s3-table-fail-msg">{item.failureMessage}</small>
                            )}
                          </td>
                          <td className="s3-table-time">{paymentTime(item.createdAt)}</td>
                          <td className="s3-table-time">{paymentTime(item.completedAt)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="s3-history-empty">
                <HelpCircle size={28} />
                <p>{assignment?.lockedRentalPrice === 0 ? 'Không có giao dịch: gian hàng miễn phí.' : 'Chưa có giao dịch thanh toán.'}</p>
              </div>
            )}

            {history && getPageCount(history.totalElements, LIST_PAGE_SIZE) > 1 && (
              <ListPagination page={page + 1} pages={getPageCount(history.totalElements, LIST_PAGE_SIZE)} disabled={loading} onPage={value => { setLoading(true); setPage(toPageIndex(value)); }} />
            )}
          </section>
        </>
      )}
    </section>
  );
}
