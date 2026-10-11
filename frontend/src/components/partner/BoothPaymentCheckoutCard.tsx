import {
  AlertCircle,
  ArrowRight,
  Clock,
  CreditCard,
  Loader2,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { ApiError } from '../../services/apiClient';
import {
  getOrCreatePaymentIdempotencyKey,
  regeneratePaymentIdempotencyKey,
} from '../../services/idempotency';
import { paymentApi } from '../../services/paymentApi';
import type { BoothRequest } from '../../types/booth';
import type { BoothPayment } from '../../types/payment';
import './BoothPaymentCheckoutCard.css';

interface Props {
  request: BoothRequest;
  now: number;
  boothName?: string;
}

function money(value: number | null): string {
  if (value === null) return '0 ₫';
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value);
}

function dateTime(value: string | null): string {
  if (!value) return '—';
  return new Date(value).toLocaleString('vi-VN', {
    dateStyle: 'short',
    timeStyle: 'short',
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

export const BoothPaymentCheckoutCard: React.FC<Props> = ({ request, now, boothName }) => {
  const [latestPayment, setLatestPayment] = useState<BoothPayment | null>(null);
  const [isLoadingPayments, setIsLoadingPayments] = useState(false);
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
    if (!isSelected) return;

    setIsLoadingPayments(true);
    paymentApi
      .listPayments(request.boothRequestId, { page: 0, size: 1, sort: 'createdAt,desc' })
      .then(res => {
        if (!active) return;
        if (res.content.length > 0) {
          setLatestPayment(res.content[0]);
        }
      })
      .catch(() => {
        // Bỏ qua lỗi danh sách nếu chưa có payment nào
      })
      .finally(() => {
        if (active) setIsLoadingPayments(false);
      });

    return () => {
      active = false;
    };
  }, [request.boothRequestId, isSelected]);

  // Xác định xem đây là lần thanh toán đầu hay retry
  const isRetry =
    latestPayment?.status === 'FAILED' || latestPayment?.status === 'TIMEOUT';

  const handleCheckout = async () => {
    if (isSubmitting) return;
    if (isExpiringSoon) {
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
      const idempotencyKey = isRetry
        ? regeneratePaymentIdempotencyKey(request.boothRequestId)
        : getOrCreatePaymentIdempotencyKey(request.boothRequestId);

      const response = await paymentApi.initiatePayment(request.boothRequestId, idempotencyKey);

      // Nếu có checkoutUrl: chuyển hướng trình duyệt trực tiếp sang cổng VNPay
      if (response.checkoutUrl) {
        window.location.assign(response.checkoutUrl);
        return;
      }

      // Trường hợp 202 Accepted: backend đang đối soát (resolution = RECONCILING)
      if (response.resolution === 'RECONCILING' || !response.checkoutUrl) {
        setReconcilingNotice(
          'Giao dịch trước đó đang được đối soát với cổng thanh toán VNPay. Vui lòng kiểm tra lại sau ít phút.',
        );
        if (response.payment) {
          setLatestPayment(response.payment);
        }
      }
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

  return (
    <div className="s3-checkout-card s2-hold-card" data-testid="booth-payment-checkout-card">
      {/* Header thanh toán */}
      <div className="s3-checkout-header">
        <div className="s3-checkout-title-group">
          <div className="s3-checkout-icon-badge">
            <CreditCard size={20} />
          </div>
          <div>
            <h3 className="s3-checkout-title">Thanh toán giữ chỗ gian hàng</h3>
            <p className="s3-checkout-subtitle">Cổng thanh toán điện tử VNPay</p>
          </div>
        </div>
        <div className="s3-checkout-status-pill">
          <span className="s3-status-dot" />
          <span>Chờ thanh toán</span>
        </div>
      </div>

      {/* Chi tiết đơn thanh toán */}
      <div className="s3-checkout-invoice">
        <div className="s3-invoice-row">
          <span className="s3-invoice-label">Gian hàng đăng ký</span>
          <span className="s3-invoice-value">
            <strong>Gian {request.boothCode}</strong>
            {boothName ? <span className="s3-booth-subname"> — {boothName}</span> : null}
          </span>
        </div>

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
            <div className="s3-method-tags">
              <span className="s3-method-tag">VNPAY-QR</span>
              <span className="s3-method-tag">Thẻ ATM / Banking</span>
              <span className="s3-method-tag">Visa / Mastercard</span>
            </div>
          </div>
        </div>

        <div className="s3-invoice-divider" />

        <div className="s3-invoice-row s3-total-row">
          <div className="s3-total-label-wrap">
            <span className="s3-total-title">Tổng tiền thanh toán</span>
            <span className="s3-total-subtitle">Giá giữ chỗ đã khóa</span>
          </div>
          <div className="s3-total-price">
            {money(hold.lockedRentalPrice)}
          </div>
        </div>
      </div>

      {/* Thông báo thanh toán trước đó nếu bị lỗi / gián đoạn */}
      {latestPayment && !isLoadingPayments && latestPayment.status !== 'SUCCESS' && (
        <div className="s3-checkout-alert s3-alert-warning" role="status">
          <AlertCircle size={16} />
          <span>
            {latestPayment.status === 'PENDING'
              ? 'Đang có một phiên thanh toán đang chờ xử lý. Nếu bạn đã hoàn tất, vui lòng đợi hệ thống cập nhật.'
              : 'Giao dịch trước đó chưa hoàn tất hoặc bị gián đoạn. Bạn có thể nhấn "Thanh toán lại qua VNPay" bên dưới để tiếp tục.'}
          </span>
        </div>
      )}

      {/* Cảnh báo khi thời gian còn dưới 5 phút */}
      {isExpiringSoon && (
        <div className="s3-checkout-alert s3-alert-warning" role="alert">
          <AlertCircle size={16} />
          <span>
            <strong>Chú ý:</strong> Thời gian giữ chỗ còn dưới 5 phút. Vui lòng thanh toán ngay để tránh mất vị trí gian hàng.
          </span>
        </div>
      )}

      {/* Thông báo đối soát */}
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
            disabled={isSubmitting || isExpiringSoon || isExpired}
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
            disabled={isSubmitting || isExpiringSoon || isExpired}
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
                <span>Thanh toán ngay qua VNPay</span>
                <ArrowRight size={16} />
              </>
            )}
          </button>
        )}

        <div className="s3-checkout-security">
          <ShieldCheck size={15} />
          <span>Giao dịch được bảo mật an toàn qua Cổng thanh toán VNPay (Tiêu chuẩn PCI-DSS)</span>
        </div>
      </div>
    </div>
  );
};


