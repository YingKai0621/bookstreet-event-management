import { CheckCircle2, CircleAlert, Clock3, QrCode, RotateCcw } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  clearAttendanceScanToken,
  hasInvalidAttendanceScanToken,
  readAttendanceScanToken,
} from '../../security/attendanceScanToken';
import { ApiError } from '../../services/apiClient';
import { participantApi } from '../../services/participantApi';
import type { AttendanceScanResponse } from '../../types/attendance';
import type { Language } from '../../types';
import './AttendanceScanPage.css';

interface AttendanceScanPageProps {
  language: Language;
}

type ScanState =
  | { kind: 'submitting' }
  | { kind: 'success'; result: AttendanceScanResponse }
  | { kind: 'error'; title: string; message: string; retryable: boolean };

interface ScanErrorCopy {
  title: string;
  message: string;
  retryable: boolean;
  definitive: boolean;
}

function errorCopy(error: unknown, language: Language): ScanErrorCopy {
  const vi = language === 'vi';

  if (error instanceof ApiError) {
    switch (error.code) {
      case 'ATTENDANCE_QR_NOT_FOUND':
        return {
          title: vi ? 'Mã QR không khả dụng' : 'QR code unavailable',
          message: vi ? 'Mã QR không hợp lệ hoặc không còn khả dụng. Vui lòng quét lại mã do Ban tổ chức cung cấp.' : 'This QR code is invalid or unavailable. Please scan the code provided by the Organizer again.',
          retryable: false,
          definitive: true,
        };
      case 'ATTENDANCE_WINDOW_NOT_OPEN':
        return {
          title: vi ? 'Chưa đến giờ điểm danh' : 'Check-in has not opened',
          message: vi ? 'Hoạt động chưa mở điểm danh. Vui lòng quét lại mã khi Ban tổ chức thông báo.' : 'Attendance is not open yet. Please scan again when the Organizer announces check-in.',
          retryable: false,
          definitive: true,
        };
      case 'ATTENDANCE_WINDOW_CLOSED':
        return {
          title: vi ? 'Đã hết thời gian điểm danh' : 'Check-in has closed',
          message: vi ? 'Thời gian điểm danh cho hoạt động này đã kết thúc.' : 'The attendance window for this activity has ended.',
          retryable: false,
          definitive: true,
        };
      case 'ATTENDANCE_ACTIVITY_INELIGIBLE':
        return {
          title: vi ? 'Hoạt động không thể điểm danh' : 'Activity is not eligible',
          message: vi ? 'Hoạt động hiện không ở trạng thái cho phép điểm danh.' : 'This activity is not currently eligible for attendance.',
          retryable: false,
          definitive: true,
        };
      case 'ATTENDANCE_REGISTRATION_INELIGIBLE':
        return {
          title: vi ? 'Không tìm thấy đăng ký hợp lệ' : 'No eligible registration',
          message: vi ? 'Bạn cần có đăng ký hoạt động đang còn hiệu lực để điểm danh.' : 'You need an active activity registration to check in.',
          retryable: false,
          definitive: true,
        };
      default:
        if (error.status === 0 || error.status >= 500) {
          return {
            title: vi ? 'Chưa thể kết nối' : 'Unable to connect',
            message: vi ? 'Hệ thống chưa thể ghi nhận điểm danh. Hãy kiểm tra kết nối và thử lại.' : 'Attendance could not be recorded. Check your connection and try again.',
            retryable: true,
            definitive: false,
          };
        }
    }
  }

  return {
    title: vi ? 'Không thể điểm danh' : 'Unable to check in',
    message: vi ? 'Yêu cầu điểm danh không thể hoàn tất. Vui lòng quét lại mã hoặc liên hệ Ban tổ chức.' : 'The attendance request could not be completed. Scan again or contact the Organizer.',
    retryable: false,
    definitive: true,
  };
}

export function AttendanceScanPage({ language }: AttendanceScanPageProps) {
  const vi = language === 'vi';
  const requestStarted = useRef(false);
  const [state, setState] = useState<ScanState>(() => {
    if (readAttendanceScanToken()) return { kind: 'submitting' };
    return {
      kind: 'error',
      title: hasInvalidAttendanceScanToken()
        ? (vi ? 'Liên kết QR không hợp lệ' : 'Invalid QR link')
        : (vi ? 'Không có mã điểm danh' : 'No attendance code'),
      message: vi
        ? 'Vui lòng quét lại mã QR hoạt động do Ban tổ chức cung cấp.'
        : 'Please scan the Activity QR code provided by the Organizer again.',
      retryable: false,
    };
  });

  const submitScan = useCallback(async () => {
    const token = readAttendanceScanToken();
    if (!token) return;

    setState({ kind: 'submitting' });
    try {
      const result = await participantApi.scanAttendance(token);
      clearAttendanceScanToken();
      setState({ kind: 'success', result });
    } catch (error) {
      const copy = errorCopy(error, language);
      if (copy.definitive) clearAttendanceScanToken();
      setState({ kind: 'error', title: copy.title, message: copy.message, retryable: copy.retryable });
    }
  }, [language]);

  useEffect(() => {
    if (requestStarted.current || !readAttendanceScanToken()) return;
    requestStarted.current = true;
    void submitScan();
  }, [submitScan]);

  const retry = () => {
    if (state.kind === 'submitting') return;
    void submitScan();
  };

  return (
    <section className="attendance-scan-page" aria-labelledby="attendance-scan-title">
      <div className={`attendance-scan-card is-${state.kind}`}>
        {state.kind === 'submitting' && (
          <>
            <div className="attendance-scan-icon is-loading" aria-hidden="true"><QrCode size={30} /></div>
            <p className="attendance-scan-eyebrow">{vi ? 'Điểm danh hoạt động' : 'Activity attendance'}</p>
            <h1 id="attendance-scan-title">{vi ? 'Đang xác nhận điểm danh' : 'Confirming attendance'}</h1>
            <p role="status" aria-live="polite">
              {vi ? 'Vui lòng chờ trong giây lát và không đóng trang.' : 'Please wait a moment and keep this page open.'}
            </p>
            <span className="attendance-scan-progress" aria-hidden="true" />
          </>
        )}

        {state.kind === 'success' && (
          <>
            <div className="attendance-scan-icon is-success" aria-hidden="true"><CheckCircle2 size={32} /></div>
            <p className="attendance-scan-eyebrow">{vi ? 'Điểm danh hoạt động' : 'Activity attendance'}</p>
            <h1 id="attendance-scan-title">
              {state.result.alreadyRecorded
                ? (vi ? 'Bạn đã điểm danh trước đó' : 'Attendance already recorded')
                : (vi ? 'Điểm danh thành công' : 'Attendance recorded')}
            </h1>
            <p className="attendance-scan-activity">{state.result.activityTitle}</p>
            <p role="status" aria-live="polite">
              {state.result.alreadyRecorded
                ? (vi ? 'Lượt tham dự của bạn đã được hệ thống ghi nhận. Không cần quét lại.' : 'Your attendance was already recorded. You do not need to scan again.')
                : (vi ? 'Lượt tham dự của bạn đã được ghi nhận vào hệ thống.' : 'Your attendance has been recorded successfully.')}
            </p>
          </>
        )}

        {state.kind === 'error' && (
          <>
            <div className="attendance-scan-icon is-error" aria-hidden="true">
              {state.retryable ? <Clock3 size={30} /> : <CircleAlert size={30} />}
            </div>
            <p className="attendance-scan-eyebrow">{vi ? 'Điểm danh hoạt động' : 'Activity attendance'}</p>
            <h1 id="attendance-scan-title">{state.title}</h1>
            <p role="alert">{state.message}</p>
            {state.retryable && (
              <button type="button" className="attendance-scan-retry" onClick={retry}>
                <RotateCcw size={17} />
                {vi ? 'Thử lại' : 'Try again'}
              </button>
            )}
          </>
        )}

        {state.kind !== 'submitting' && (
          <Link className="attendance-scan-back" to="/participant/activities">
            {vi ? 'Về hoạt động của tôi' : 'Back to my activities'}
          </Link>
        )}
      </div>
    </section>
  );
}
