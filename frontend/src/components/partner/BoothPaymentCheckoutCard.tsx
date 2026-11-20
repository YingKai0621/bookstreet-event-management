import {
  AlertCircle,
  ArrowRight,
  Clock,
  CreditCard,
  Loader2,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import { ApiError } from '../../services/apiClient';
import {
  getOrCreatePaymentIdempotencyKey,
  getRetryPaymentIdempotencyKey,
} from '../../services/idempotency';
import { paymentApi } from '../../services/paymentApi';
import type { BoothRequest } from '../../types/booth';
import type { BoothPayment } from '../../types/payment';
import { usePartnerOrganizationLocked } from '../../pages/partner/PartnerOrganizationStatusContext';
import './BoothPaymentCheckoutCard.css';

interface Props {
  request: BoothRequest;
  now: number;
  boothName?: string;
  onPaymentCreated?: () => void;
  compact?: boolean;
}

function money(value: number | null): string {
  if (value === null) return '0 ₫';
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value);
}

function dateTime(value: string | null): string {
  if (!value) return '—';
  return new Date(value).toLocaleString('vi-VN', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
    timeZone: 'Asia/Ho_Chi_Minh',
  });
}

function formatRemainingTime(expiresAt: string, now: number): string {
  const milliseconds = Math.max(0, new Date(expiresAt).getTime() - now);
  if (milliseconds <= 0) return 'Đã hết hạn';
  const totalSeconds = Math.floor(milliseconds / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (days > 0) {
    return `${days} ngày ${hours} giờ ${minutes} phút`;
  }
  return `${hours} giờ ${minutes} phút ${seconds} giây`;
}

function mapErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    switch (error.code) {
      case 'PARTNER_ORGANIZATION_INACTIVE':
        return 'Tổ chức đang bị khóa; không thể khởi tạo khoản thanh toán mới.';
      case 'BOOTH_HOLD_EXPIRING_SOON':
        return 'Thời gian giữ chỗ còn dưới 5 phút, không thể tạo phiên thanh toán mới.';
      case 'BOOTH_HOLD_EXPIRED':
        return 'Thời gian giữ chỗ đã hết hạn. Vui lòng liên hệ ban tổ chức để được hỗ trợ.';
      case 'BOOTH_REQUEST_NOT_SELECTED':
        return 'Yêu cầu gian hàng chưa được ban tổ chức chọn để thanh toán.';
      case 'BOOTH_HOLD_NOT_ACTIVE':
        return 'Phiên giữ chỗ không còn hiệu lực.';
      case 'PAYMENT_ALREADY_COMPLETED':
        return 'Gian hàng này đã được thanh toán thành công.';
      case 'PAYMENT_ATTEMPT_ALREADY_PENDING':
        return 'Đang có một phiên thanh toán đang chờ xử lý. Vui lòng hoàn tất hoặc thử lại sau.';
      case 'PAYMENT_RESULT_UNKNOWN':
        return 'Kết quả thanh toán trước đó đang được đối soát, vui lòng thử lại sau ít phút.';
      case 'PAYMENT_GATEWAY_UNAVAILABLE':
        return 'Cổng thanh toán VNPay hiện đang bảo trì hoặc chưa sẵn sàng. Vui lòng thử lại sau.';
      case 'EVENT_NOT_ACCEPTING_PAYMENTS':
        return 'Sự kiện hiện không còn nhận thanh toán mới.';
      case 'INVALID_IDEMPOTENCY_KEY':
        return 'Mã định danh giao dịch không hợp lệ. Vui lòng làm mới trang và thử lại.';
      default:
        return error.message || 'Không thể tạo phiên thanh toán. Vui lòng thử lại.';
    }
  }
  return error instanceof Error ? error.message : 'Lỗi kết nối đến máy chủ thanh toán.';
}

export const BoothPaymentCheckoutCard: React.FC<Props> = ({ request, now, boothName, onPaymentCreated, compact = false }) => {
  const organizationLocked = usePartnerOrganizationLocked();
  const [latestPayment, setLatestPayment] = useState<BoothPayment | null>(null);
  const [isLoadingPayments, setIsLoadingPayments] = useState(true);
  const [historyError, setHistoryError] = useState(false);
  const [historyBlocked, setHistoryBlocked] = useState(false);
  const attemptedKey = useRef<{ source: string; key: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [reconcilingNotice, setReconcilingNotice] = useState<string | null>(null);

  const hold = request.hold;
  const isSelected = request.status === 'SELECTED' && hold?.status === 'ACTIVE';

  // Tính thời gian giữ chỗ còn lại
  const remainingMillis = hold ? Math.max(0, new Date(hold.expiresAt).getTime() - now) : 0;
  // Quy định backend: nếu còn dưới 5 phút (300.000 ms) thì không cho tạo payment mới
  const isExpiringSoon = remainingMillis > 0 && remainingMillis < 5 * 60 * 1000;
  const isExpired = remainingMillis <= 0;

  // Tải thông tin lần thanh toán gần nhất
  useEffect(() => {
    let active = true;
    let timer: number | undefined;
    if (!isSelected) return;
    function load() {
      let shouldPoll = false;
      paymentApi
      .listAllPayments(request.boothRequestId)
      .then(payments => {
        if (!active) return;
        setLatestPayment(payments[0] ?? null);
        setHistoryBlocked(payments.some(payment => payment.reconciliationRequired || payment.status === 'SUCCESS'));
        setHistoryError(false);
        shouldPoll = payments.some(payment => payment.status === 'PENDING' || payment.reconciliationRequired);
      })
      .catch(() => {
        if (active) setHistoryError(true);
      })
      .finally(() => {
        if (active) {
          setIsLoadingPayments(false);
          if (shouldPoll) timer = window.setTimeout(load, 5000);
        }
      });
    }
    load();
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [request.boothRequestId, isSelected]);

  // Xác định xem đây là lần thanh toán đầu hay retry
  const isRetry =
    latestPayment?.status === 'FAILED' || latestPayment?.status === 'TIMEOUT';
  const blocked = historyBlocked || latestPayment?.reconciliationRequired || latestPayment?.status === 'SUCCESS';
  const cannotStart = isLoadingPayments || historyError || blocked || isExpired
    || (organizationLocked && latestPayment?.status !== 'PENDING')
    || (isExpiringSoon && latestPayment?.status !== 'PENDING');

  const handleCheckout = async () => {
    if (isSubmitting || cannotStart) return;
    if (isExpiringSoon && latestPayment?.status !== 'PENDING') {
      setErrorMessage('Thời gian giữ chỗ còn dưới 5 phút, không thể tạo phiên thanh toán mới.');
      return;
    }
    if (isExpired) {
      setErrorMessage('Thời gian giữ chỗ đã hết hạn.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);
    setReconcilingNotice(null);

    try {
      // Idempotency: Retry sau FAILED/TIMEOUT sinh key mới; lần đầu / replay tái sử dụng key
      const source = `${request.boothRequestId}:${latestPayment?.boothPaymentId ?? 'new'}`;
      if (attemptedKey.current?.source !== source) {
        attemptedKey.current = { source, key: latestPayment?.status === 'PENDING'
          ? latestPayment.idempotencyKey
          : isRetry && latestPayment
            ? getRetryPaymentIdempotencyKey(request.boothRequestId, latestPayment.boothPaymentId)
            : getOrCreatePaymentIdempotencyKey(request.boothRequestId) };
      }
      const idempotencyKey = attemptedKey.current.key;

      const response = await paymentApi.initiatePayment(request.boothRequestId, idempotencyKey);
      setLatestPayment(response.payment);

      // Nếu có checkoutUrl: chuyển hướng trình duyệt trực tiếp sang cổng VNPay
      if (response.checkoutUrl) {
        window.location.assign(response.checkoutUrl);
        return;
      }

      // Trường hợp 202 Accepted: backend đang đối soát (resolution = RECONCILING)
      if (response.payment.status === 'PENDING' && !response.checkoutUrl) {
        setReconcilingNotice(
          'Giao dịch trước đó đang được đối soát với cổng thanh toán VNPay. Vui lòng kiểm tra lại sau ít phút.',
        );
        if (response.payment) {
          setLatestPayment(response.payment);
        }
      }
      onPaymentCreated?.();
    } catch (error) {
      setErrorMessage(mapErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isSelected || !hold) {
    return null;
  }

  const remainingText = formatRemainingTime(hold.expiresAt, now);
  const pending = latestPayment?.status === 'PENDING';
  const needsReview = historyBlocked && latestPayment?.status !== 'SUCCESS';
  const statusLabel = isLoadingPayments ? 'Đang kiểm tra' : needsReview ? 'Đang đối soát'
    : latestPayment?.status === 'SUCCESS' ? 'Đã thanh toán' : pending ? 'Chờ xác nhận'
      : latestPayment?.status === 'FAILED' ? 'Thanh toán thất bại'
        : latestPayment?.status === 'TIMEOUT' ? 'Phiên đã hết hạn' : 'Chưa thanh toán';

  return (
    <div className={`s3-checkout-card ${compact ? 'is-request-compact' : ''}`} data-testid="booth-payment-checkout-card">
      {/* Header thanh toán */}
      <div className="s3-checkout-header">
        <div className="s3-checkout-title-group">
          <div>
            <h3 className="s3-checkout-title">Thanh toán gian hàng</h3>
            {!compact && <p className="s3-checkout-subtitle">{request.boothCode}{boothName ? ` · ${boothName}` : ''}</p>}
          </div>
        </div>
        <div className="s3-checkout-status-pill">
          <span>{statusLabel}</span>
        </div>
      </div>

      {/* Chi tiết đơn thanh toán */}
      <div className="s3-checkout-invoice">
        <div className="s3-invoice-row">
          <span className="s3-invoice-label">Hạn chót thanh toán</span>
          <span className="s3-invoice-value">{dateTime(hold.expiresAt)}</span>
        </div>

        <div className="s3-invoice-row s3-countdown-row">
          <span className="s3-invoice-label">Thời gian còn lại</span>
          <div className={`s3-countdown-pill ${isExpiringSoon ? 'is-warning' : ''}`}>
            <Clock size={14} />
            <span>{now === 0 ? 'Đang đồng bộ…' : remainingText}</span>
          </div>
        </div>

        <div className="s3-invoice-row">
          <span className="s3-invoice-label">Phương thức thanh toán</span>
          <div className="s3-invoice-methods">
            <span className="s3-method-main">Cổng thanh toán VNPay</span>
          </div>
        </div>

        <div className="s3-invoice-divider" />

        <div className="s3-invoice-row s3-total-row">
          <div className="s3-total-label-wrap">
            <span className="s3-total-title">Tổng tiền thanh toán</span>
            <span className="s3-total-subtitle">Giá thuê được giữ nguyên theo thời điểm duyệt</span>
          </div>
          <div className="s3-total-price">
            {money(hold.lockedRentalPrice)}
          </div>
        </div>
      </div>

      {/* Thông báo thanh toán trước đó nếu bị lỗi / gián đoạn */}
      {latestPayment && !isLoadingPayments && latestPayment.status !== 'SUCCESS' && !needsReview && !reconcilingNotice && (
        <div className={`s3-checkout-alert ${isRetry ? 's3-alert-error' : 's3-alert-warning'}`} role="status">
          <AlertCircle size={16} />
          <span>
            {latestPayment.status === 'PENDING'
              ? 'Đang có một phiên thanh toán đang chờ xử lý. Nếu bạn đã hoàn tất, vui lòng đợi hệ thống cập nhật.'
              : latestPayment.status === 'TIMEOUT'
                ? 'Phiên thanh toán trước đã hết hạn. Bạn có thể thử lại nếu thời gian giữ chỗ còn hiệu lực.'
                : 'Thanh toán trước không thành công. Bạn có thể thử lại nếu thời gian giữ chỗ còn hiệu lực.'}
            {pending && <small className="s3-pending-help">Tự cập nhật mỗi 5 giây. Chưa thể xác định còn bao nhiêu phút để thử lại; chỉ tạo lần thanh toán mới sau khi hệ thống xác nhận kết quả.</small>}
            {isRetry && latestPayment.failureMessage && <small className="s3-pending-help">{latestPayment.failureMessage}</small>}
          </span>
        </div>
      )}

      {/* Cảnh báo khi thời gian còn dưới 5 phút */}
      {isExpiringSoon && !pending && !needsReview && (
        <div className="s3-checkout-alert s3-alert-warning" role="alert">
          <AlertCircle size={16} />
          <span>
              <strong>Chú ý:</strong> Thời gian giữ chỗ còn dưới 5 phút. Chỉ có thể tiếp tục một phiên thanh toán đang còn hiệu lực; không thể tạo phiên mới.
          </span>
        </div>
      )}

      {/* Thông báo đối soát */}
      {historyError && <div className="s3-checkout-alert s3-alert-error" role="alert">Không thể kiểm tra giao dịch trước đó. Hệ thống sẽ thử lại trước khi cho phép thanh toán.</div>}
      {historyBlocked && latestPayment?.status !== 'SUCCESS' && <div className="s3-checkout-alert s3-alert-warning" role="status">Giao dịch cần đối soát. Không thể thanh toán lại cho đến khi hệ thống xác định kết quả.</div>}
      {reconcilingNotice && (
        <div className="s3-checkout-alert s3-alert-info" role="status">
          <ShieldCheck size={16} />
          <span>{reconcilingNotice}</span>
        </div>
      )}

      {/* Thông báo lỗi khi thực hiện thao tác */}
      {errorMessage && (
        <div
          className="s3-checkout-alert s3-alert-error"
          role="alert"
          data-testid="payment-error"
        >
          <AlertCircle size={16} />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Khối nút bấm và cam kết bảo mật */}
      <div className="s3-checkout-actions">
        {isRetry ? (
          <button
            type="button"
            className="s3-btn-checkout s3-btn-retry"
            onClick={handleCheckout}
            disabled={isSubmitting || cannotStart}
            data-testid="retry-payment-button"
            data-testid-request={request.boothRequestId}
          >
            {isSubmitting ? (
              <>
                <Loader2 size={18} className="s3-spin" data-testid="payment-loading" />
                <span>Đang kết nối lại VNPay...</span>
              </>
            ) : (
              <>
                <RefreshCw size={17} />
                <span>Thanh toán lại qua VNPay</span>
              </>
            )}
          </button>
        ) : (
          <button
            type="button"
            className="s3-btn-checkout s3-btn-primary"
            onClick={handleCheckout}
            disabled={isSubmitting || cannotStart}
            data-testid="pay-booth-button"
            data-testid-request={request.boothRequestId}
          >
            {isSubmitting ? (
              <>
                <Loader2 size={18} className="s3-spin" data-testid="payment-loading" />
                <span>Đang chuyển hướng sang VNPay...</span>
              </>
            ) : (
              <>
                <CreditCard size={18} />
                <span>{latestPayment?.status === 'PENDING' ? 'Tiếp tục phiên thanh toán' : 'Thanh toán ngay qua VNPay'}</span>
                <ArrowRight size={16} />
              </>
            )}
          </button>
        )}

      </div>
    </div>
  );
};


