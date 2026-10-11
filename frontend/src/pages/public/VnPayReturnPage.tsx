import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Clock,
  Loader2,
  QrCode,
  RefreshCw,
  ShieldCheck,
  Store,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { paymentApi } from '../../services/paymentApi';
import type { Language } from '../../types';
import type { BoothAssignment, BoothPayment } from '../../types/payment';
import './VnPayReturnPage.css';

interface Props {
  language?: Language;
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

export const VnPayReturnPage: React.FC<Props> = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [payment, setPayment] = useState<BoothPayment | null>(null);
  const [assignment, setAssignment] = useState<BoothAssignment | null>(null);
  const [isVerifying, setIsVerifying] = useState(true);
  const [pollCount, setPollCount] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // VNPay trả về vnp_TxnRef dạng 'BSP81'
  const rawTxnRef = searchParams.get('vnp_TxnRef');
  const paymentId = rawTxnRef ? Number(rawTxnRef.replace(/\D/g, '')) : null;

  useEffect(() => {
    if (!paymentId || Number.isNaN(paymentId)) {
      setIsVerifying(false);
      setErrorMessage('Không tìm thấy mã tham chiếu giao dịch hợp lệ từ cổng thanh toán.');
      return;
    }

    let isMounted = true;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const checkPaymentStatus = async () => {
      try {
        const paymentData = await paymentApi.getPayment(paymentId);
        if (!isMounted) return;

        setPayment(paymentData);

        // Quy tắc vàng:
        // - Không coi VNPay Return URL là bằng chứng thành công.
        // - Chỉ khi backend xác nhận payment.status === 'SUCCESS' mới coi là thành công.
        if (paymentData.status === 'SUCCESS') {
          setIsVerifying(false);
          // Tải thêm thông tin Booth Assignment nếu có
          try {
            const assignmentData = await paymentApi.getAssignment(paymentData.boothRequestId);
            if (isMounted) setAssignment(assignmentData);
          } catch {
            // Assignment có thể đang được tạo
          }
          return;
        }

        // Nếu trạng thái là FAILED hoặc TIMEOUT: dừng polling
        if (paymentData.status === 'FAILED' || paymentData.status === 'TIMEOUT') {
          setIsVerifying(false);
          return;
        }

        // Nếu trạng thái là PENDING: tiếp tục polling kiểm tra trạng thái từ backend (IPN/QueryDR)
        // Lưu ý: Tuyệt đối không tự chuyển PENDING thành FAILED
        if (paymentData.status === 'PENDING') {
          // Poll tối đa 10 lần (mỗi lần cách nhau 2.5s)
          if (pollCount < 10) {
            timer = setTimeout(() => {
              if (isMounted) setPollCount(prev => prev + 1);
            }, 2500);
          } else {
            // Hết lượt poll ban đầu: vẫn giữ PENDING để hiển thị "đang xác minh"
            setIsVerifying(false);
          }
        }
      } catch (error) {
        if (!isMounted) return;
        setIsVerifying(false);
        setErrorMessage(
          error instanceof Error ? error.message : 'Không thể lấy thông tin trạng thái từ máy chủ.',
        );
      }
    };

    void checkPaymentStatus();

    return () => {
      isMounted = false;
      if (timer) clearTimeout(timer);
    };
  }, [paymentId, pollCount]);

  const handleManualRefresh = () => {
    setIsVerifying(true);
    setPollCount(0);
  };

  const handleBackToRequests = () => {
    navigate('/partner/booth-requests');
  };

  return (
    <div className="vnpay-return-page-root" data-testid="vnpay-return-page">
      <div className="vnpay-return-container">
        {/* Header */}
        <div className="vnpay-return-header">
          <div className="vnpay-brand-badge">
            <ShieldCheck size={20} />
            <span>Cổng thanh toán VNPay · Kết quả giao dịch</span>
          </div>
          <h1>Xác thực thanh toán gian hàng</h1>
          <p>
            Mọi kết quả thanh toán đều được đối soát và xác thực trực tiếp từ máy chủ BookStreet.
          </p>
        </div>

        {/* Lỗi không tìm thấy paymentId */}
        {errorMessage && (
          <div className="vnpay-return-card vnpay-state-error" data-testid="return-state-error">
            <div className="vnpay-status-icon-wrap error">
              <AlertCircle size={40} />
            </div>
            <h2>Không thể xác minh giao dịch</h2>
            <p className="vnpay-status-desc">{errorMessage}</p>
            <button
              type="button"
              className="vnpay-btn vnpay-btn-secondary"
              onClick={handleBackToRequests}
            >
              <ArrowLeft size={16} />
              <span>Quay lại danh sách gian hàng</span>
            </button>
          </div>
        )}

        {/* Trạng thái 1: Đang xác minh / Polling */}
        {!errorMessage && isVerifying && (
          <div className="vnpay-return-card vnpay-state-verifying" data-testid="return-state-verifying">
            <div className="vnpay-status-icon-wrap verifying">
              <Loader2 size={44} className="vnpay-spin" />
            </div>
            <h2>Đang xác minh giao dịch với ngân hàng...</h2>
            <p className="vnpay-status-desc">
              Hệ thống đang kiểm tra chữ ký số và dữ liệu thanh toán từ VNPay. Vui lòng không đóng
              trình duyệt.
            </p>
            <div className="vnpay-poll-counter">
              <span>Đang kiểm tra kết quả (lần {pollCount + 1})...</span>
            </div>
          </div>
        )}

        {/* Trạng thái 2: Xác minh xong - SUCCESS */}
        {!errorMessage && !isVerifying && payment?.status === 'SUCCESS' && (
          <div className="vnpay-return-card vnpay-state-success" data-testid="return-state-success">
            <div className="vnpay-status-icon-wrap success">
              <CheckCircle2 size={44} />
            </div>
            <h2>Thanh toán gian hàng thành công!</h2>
            <p className="vnpay-status-desc">
              Giao dịch của bạn đã được xác nhận thành công. Gian hàng chính thức được phân bổ cho đối
              tác.
            </p>

            <div className="vnpay-details-grid">
              <div className="vnpay-detail-item">
                <span className="vnpay-label">Mã giao dịch (TxnRef)</span>
                <strong className="vnpay-val">{rawTxnRef || `BSP${payment.boothPaymentId}`}</strong>
              </div>
              <div className="vnpay-detail-item">
                <span className="vnpay-label">Số tiền thanh toán</span>
                <strong className="vnpay-val highlight">{money(payment.amount)}</strong>
              </div>
              <div className="vnpay-detail-item">
                <span className="vnpay-label">Mã giao dịch VNPay</span>
                <strong className="vnpay-val">{payment.gatewayTransactionRef || '—'}</strong>
              </div>
              <div className="vnpay-detail-item">
                <span className="vnpay-label">Thời gian hoàn tất</span>
                <strong className="vnpay-val">{dateTime(payment.completedAt)}</strong>
              </div>
            </div>

            {/* Thông tin Phân bổ Gian Hàng (Assignment) */}
            {assignment && (
              <div className="vnpay-assignment-box" data-testid="booth-assignment-info">
                <div className="vnpay-assignment-header">
                  <Store size={20} />
                  <span>Gian hàng được phân bổ: <strong>{assignment.boothCode}</strong></span>
                </div>
                {assignment.qrToken && (
                  <div className="vnpay-qr-token-wrap">
                    <QrCode size={18} />
                    <span>Mã xác thực gian hàng (QR Token): <code>{assignment.qrToken}</code></span>
                  </div>
                )}
              </div>
            )}

            <div className="vnpay-actions-row">
              <button
                type="button"
                className="vnpay-btn vnpay-btn-primary"
                onClick={handleBackToRequests}
              >
                <span>Xem gian hàng của bạn</span>
              </button>
            </div>
          </div>
        )}

        {/* Trạng thái 3: Xác minh xong - PENDING / RECONCILING */}
        {!errorMessage && !isVerifying && payment?.status === 'PENDING' && (
          <div className="vnpay-return-card vnpay-state-pending" data-testid="return-state-pending">
            <div className="vnpay-status-icon-wrap pending">
              <Clock size={44} />
            </div>
            <h2>Giao dịch đang chờ xác nhận</h2>
            <p className="vnpay-status-desc">
              {payment.reconciliationRequired
                ? 'Giao dịch đang được đối soát tự động với ngân hàng. Trạng thái sẽ được cập nhật sớm nhất.'
                : 'Ngân hàng đang xử lý khoản thanh toán. Hệ thống sẽ tự động cập nhật khi nhận được xác nhận từ cổng VNPay.'}
            </p>

            <div className="vnpay-details-grid">
              <div className="vnpay-detail-item">
                <span className="vnpay-label">Mã giao dịch</span>
                <strong className="vnpay-val">{rawTxnRef || `BSP${payment.boothPaymentId}`}</strong>
              </div>
              <div className="vnpay-detail-item">
                <span className="vnpay-label">Số tiền</span>
                <strong className="vnpay-val">{money(payment.amount)}</strong>
              </div>
            </div>

            <div className="vnpay-actions-row">
              <button
                type="button"
                className="vnpay-btn vnpay-btn-secondary"
                onClick={handleManualRefresh}
              >
                <RefreshCw size={16} />
                <span>Kiểm tra lại trạng thái</span>
              </button>
              <button
                type="button"
                className="vnpay-btn vnpay-btn-primary"
                onClick={handleBackToRequests}
              >
                <span>Về danh sách yêu cầu gian hàng</span>
              </button>
            </div>
          </div>
        )}

        {/* Trạng thái 4: FAILED hoặc TIMEOUT */}
        {!errorMessage && !isVerifying && (payment?.status === 'FAILED' || payment?.status === 'TIMEOUT') && (
          <div className="vnpay-return-card vnpay-state-failed" data-testid="return-state-failed">
            <div className="vnpay-status-icon-wrap failed">
              <AlertCircle size={44} />
            </div>
            <h2>
              {payment.status === 'TIMEOUT' ? 'Phiên thanh toán đã hết hạn' : 'Thanh toán không thành công'}
            </h2>
            <p className="vnpay-status-desc">
              {payment.failureMessage ||
                (payment.status === 'TIMEOUT'
                  ? 'Quá thời gian hoàn tất giao dịch trên cổng thanh toán VNPay.'
                  : 'Giao dịch bị từ chối hoặc người dùng hủy thao tác trên cổng VNPay.')}
            </p>

            <div className="vnpay-details-grid">
              <div className="vnpay-detail-item">
                <span className="vnpay-label">Mã lỗi</span>
                <strong className="vnpay-val">{payment.failureCode || payment.status}</strong>
              </div>
              <div className="vnpay-detail-item">
                <span className="vnpay-label">Số tiền</span>
                <strong className="vnpay-val">{money(payment.amount)}</strong>
              </div>
            </div>

            <div className="vnpay-actions-row">
              <button
                type="button"
                className="vnpay-btn vnpay-btn-primary"
                onClick={handleBackToRequests}
              >
                <ArrowLeft size={16} />
                <span>Quay lại để thử lại thanh toán</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

