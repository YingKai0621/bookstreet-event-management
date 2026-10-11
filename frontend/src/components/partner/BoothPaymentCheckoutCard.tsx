import {
  AlertCircle,
  CreditCard,
  ExternalLink,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Timer,
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
}

function money(value: number | null): string {
  if (value === null) return '0 ₫';
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value);
}

function mapErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    switch (error.code) {
      case 'BOOTH_HOLD_EXPIRING_SOON':
        return 'Thời gian giữ chỗ còn dưới 5 phút, không thể tạo phiên thanh toán mới.';
      case 'BOOTH_HOLD_EXPIRED':
        return 'Thời gian giữ chỗ đã hết hạn.';
      case 'BOOTH_REQUEST_NOT_SELECTED':
        return 'Yêu cầu gian hàng chưa được ban tổ chức chọn để thanh toán.';
      case 'BOOTH_HOLD_NOT_ACTIVE':
        return 'Phiên giữ chỗ không còn ở trạng thái hiệu lực.';
      case 'PAYMENT_ALREADY_COMPLETED':
        return 'Gian hàng này đã được thanh toán thành công.';
      case 'PAYMENT_ATTEMPT_ALREADY_PENDING':
        return 'Đang có một phiên thanh toán đang chờ xử lý. Vui lòng hoàn tất hoặc thử lại sau.';
      case 'PAYMENT_RESULT_UNKNOWN':
        return 'Kết quả thanh toán trước đó đang được đối soát, vui lòng thử lại sau ít phút.';
      case 'PAYMENT_GATEWAY_UNAVAILABLE':
        return 'Cổng thanh toán VNPay hiện không khả dụng. Vui lòng thử lại sau.';
      case 'EVENT_NOT_ACCEPTING_PAYMENTS':
        return 'Sự kiện hiện không còn nhận thanh toán mới.';
      case 'INVALID_IDEMPOTENCY_KEY':
        return 'Mã định danh giao dịch (Idempotency-Key) không hợp lệ.';
      default:
        return error.message || 'Không thể tạo phiên thanh toán. Vui lòng thử lại.';
    }
  }
  return error instanceof Error ? error.message : 'Lỗi kết nối đến máy chủ thanh toán.';
}

export const BoothPaymentCheckoutCard: React.FC<Props> = ({ request, now }) => {
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
      // FE 1 Idempotency-Key handling:
      // Nếu là retry sau FAILED/TIMEOUT: sinh key mới để tránh trùng lặp
      // Nếu là lần đầu hoặc replay: lấy hoặc sinh key và lưu vào storage
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
          'Giao dịch trước đó đang được đối soát với cổng thanh toán VNPay. Vui lòng kiểm tra lại trạng thái sau ít phút.',
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

  if (!isSelected) {
    return null;
  }

  return (
    <div className="s3-checkout-card" data-testid="booth-payment-checkout-card">
      <div className="s3-checkout-header">
        <div className="s3-checkout-icon-wrap">
          <CreditCard size={20} />
        </div>
        <div className="s3-checkout-title-wrap">
          <h3 className="s3-checkout-title">Thanh toán giữ chỗ gian hàng</h3>
          <p className="s3-checkout-subtitle">
            Cổng thanh toán chính thức: <strong>VNPay</strong> (Thẻ ATM, QR VNPAY-QR, Thẻ quốc tế)
          </p>
        </div>
        <div className="s3-checkout-price-badge">
          <span className="s3-checkout-price-label">Số tiền cần thanh toán</span>
          <span className="s3-checkout-price-value">{money(hold.lockedRentalPrice)}</span>
        </div>
      </div>

      {/* Hiển thị trạng thái giao dịch trước đó nếu có */}
      {latestPayment && !isLoadingPayments && (
        <div className={`s3-payment-status-badge ${latestPayment.status.toLowerCase()}`}>
          <div className="s3-status-indicator" />
          <span>
            Trạng thái thanh toán gần nhất: <strong>{latestPayment.status}</strong>
            {latestPayment.failureMessage ? ` (${latestPayment.failureMessage})` : ''}
          </span>
        </div>
      )}

      {/* Cảnh báo khi còn dưới 5 phút */}
      {isExpiringSoon && (
        <div className="s3-checkout-alert s3-alert-warning" role="alert">
          <Timer size={18} />
          <span>
            <strong>Chú ý:</strong> Thời gian giữ chỗ còn dưới 5 phút. Quy định hệ thống không cho
            phép tạo phiên thanh toán mới khi thời gian còn lại quá ít.
          </span>
        </div>
      )}

      {/* Thông báo đối soát */}
      {reconcilingNotice && (
        <div className="s3-checkout-alert s3-alert-info" role="status">
          <ShieldCheck size={18} />
          <span>{reconcilingNotice}</span>
        </div>
      )}

      {/* Thông báo lỗi */}
      {errorMessage && (
        <div
          className="s3-checkout-alert s3-alert-error"
          role="alert"
          data-testid="payment-error"
        >
          <AlertCircle size={18} />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Nút hành động thanh toán */}
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
                <RefreshCw size={18} />
                <span>Thử lại thanh toán qua VNPay</span>
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
                <span>Đang kết nối VNPay...</span>
              </>
            ) : (
              <>
                <CreditCard size={18} />
                <span>Thanh toán ngay qua VNPay</span>
                <ExternalLink size={16} />
              </>
            )}
          </button>
        )}

        <div className="s3-checkout-security-hint">
          <ShieldCheck size={14} />
          <span>Bảo mật qua Idempotency-Key & Chữ ký số HMAC-SHA512 của VNPay.</span>
        </div>
      </div>
    </div>
  );
};

