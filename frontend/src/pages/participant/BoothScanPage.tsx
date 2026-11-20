import {
  Award,
  CheckCircle2,
  CircleAlert,
  Clock3,
  MapPin,
  QrCode,
  RotateCcw,
  Sparkles,
  Store,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  clearBoothScanToken,
  hasInvalidBoothScanToken,
  readBoothScanToken,
} from '../../security/boothScanToken';
import { ApiError } from '../../services/apiClient';
import { participantApi } from '../../services/participantApi';
import type { Language } from '../../types';
import type { BoothScanResponse, EventRegistrationAction } from '../../types/reward';
import './BoothScanPage.css';

interface BoothScanPageProps {
  language: Language;
}

type ScanState =
  | { kind: 'submitting' }
  | { kind: 'success'; result: BoothScanResponse }
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
      case 'BOOTH_QR_NOT_FOUND':
      case 'VALIDATION_FAILED':
      case 'MALFORMED_REQUEST':
        return {
          title: vi ? 'Mã QR gian hàng không hợp lệ' : 'Invalid booth QR code',
          message: vi
            ? 'Liên kết này không còn khả dụng. Vui lòng quét lại mã QR đang được trưng bày tại gian hàng.'
            : 'This link is unavailable. Please scan the QR code currently displayed at the booth.',
          retryable: false,
          definitive: true,
        };
      case 'BOOTH_VISIT_WINDOW_NOT_OPEN':
        return {
          title: vi ? 'Sự kiện chưa mở lượt ghé' : 'Booth visits have not opened',
          message: vi
            ? 'Sự kiện chưa bắt đầu hoặc chưa ở trạng thái cho phép ghi nhận lượt ghé. Hãy quét lại khi sự kiện đang diễn ra.'
            : 'The event has not started or is not accepting booth visits yet. Scan again while the event is ongoing.',
          retryable: false,
          definitive: true,
        };
      case 'BOOTH_VISIT_WINDOW_CLOSED':
        return {
          title: vi ? 'Sự kiện đã kết thúc' : 'The event has ended',
          message: vi
            ? 'Thời gian ghi nhận lượt ghé gian hàng đã đóng. Lịch sử hợp lệ trước đó của bạn vẫn được giữ nguyên.'
            : 'The booth visit window has closed. Any earlier valid visit remains in your history.',
          retryable: false,
          definitive: true,
        };
      case 'BOOTH_ASSIGNMENT_INELIGIBLE':
        return {
          title: vi ? 'Gian hàng không còn nhận lượt ghé' : 'Booth is no longer eligible',
          message: vi
            ? 'Gian hàng này hiện không còn Assignment đang hoạt động. Vui lòng hỏi nhân viên tại gian hàng.'
            : 'This booth no longer has an active assignment. Please ask the booth staff for help.',
          retryable: false,
          definitive: true,
        };
      case 'BOOTH_VISIT_RELATIONSHIP_INVALID':
        return {
          title: vi ? 'Không thể xác minh gian hàng' : 'Unable to verify booth',
          message: vi
            ? 'Dữ liệu sự kiện và gian hàng chưa nhất quán. Vui lòng liên hệ Ban tổ chức để được hỗ trợ.'
            : 'The event and booth data could not be verified. Please contact the Organizer for assistance.',
          retryable: false,
          definitive: true,
        };
      case 'ACCESS_DENIED':
      case 'CSRF_INVALID':
        return {
          title: vi ? 'Bạn không thể thực hiện lượt quét này' : 'Scan permission denied',
          message: vi
            ? 'Phiên hiện tại không có quyền hoặc không đáp ứng yêu cầu bảo mật để ghi nhận lượt ghé.'
            : 'The current session does not have permission or meet the security requirements for this scan.',
          retryable: false,
          definitive: true,
        };
      case 'AUTHENTICATION_REQUIRED':
        return {
          title: vi ? 'Cần đăng nhập lại' : 'Sign in required',
          message: vi
            ? 'Phiên đăng nhập đã hết hạn. Hãy đăng nhập để tiếp tục lượt quét đang chờ.'
            : 'Your session has expired. Sign in to resume the pending scan.',
          retryable: false,
          definitive: false,
        };
      default:
        if (error.status === 0 || error.status >= 500) {
          return {
            title: vi ? 'Chưa thể kết nối' : 'Unable to connect',
            message: vi
              ? 'Hệ thống chưa thể ghi nhận lượt ghé. Hãy kiểm tra kết nối rồi thử lại; mã đang chờ vẫn được giữ trên thiết bị này.'
              : 'The visit could not be recorded. Check your connection and try again; the pending code remains on this device.',
            retryable: true,
            definitive: false,
          };
        }
    }
  }

  return {
    title: vi ? 'Không thể ghi nhận lượt ghé' : 'Unable to record visit',
    message: vi
      ? 'Yêu cầu chưa thể hoàn tất. Vui lòng quét lại mã tại gian hàng hoặc liên hệ Ban tổ chức.'
      : 'The request could not be completed. Scan the code at the booth again or contact the Organizer.',
    retryable: false,
    definitive: true,
  };
}

function registrationCopy(action: EventRegistrationAction, vi: boolean): string {
  switch (action) {
    case 'CREATED':
      return vi ? 'Bạn đã được ghi danh vào sự kiện này.' : 'You were joined to this event.';
    case 'REACTIVATED':
      return vi ? 'Đăng ký sự kiện của bạn đã được kích hoạt lại.' : 'Your event registration was reactivated.';
    default:
      return vi ? 'Đăng ký sự kiện hiện tại đã được sử dụng.' : 'Your existing event registration was used.';
  }
}

function visitTime(value: string, language: Language): string {
  return new Intl.DateTimeFormat(language === 'vi' ? 'vi-VN' : 'en-GB', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
    timeZone: 'Asia/Ho_Chi_Minh',
  }).format(new Date(value));
}

export function BoothScanPage({ language }: BoothScanPageProps) {
  const vi = language === 'vi';
  const requestStarted = useRef(false);
  const [state, setState] = useState<ScanState>(() => {
    if (readBoothScanToken()) return { kind: 'submitting' };
    return {
      kind: 'error',
      title: hasInvalidBoothScanToken()
        ? (vi ? 'Liên kết QR không hợp lệ' : 'Invalid QR link')
        : (vi ? 'Không có mã gian hàng' : 'No booth code'),
      message: vi
        ? 'Vui lòng quét mã QR đang được trưng bày tại gian hàng.'
        : 'Please scan the QR code displayed at the booth.',
      retryable: false,
    };
  });

  const submitScan = useCallback(async () => {
    const token = readBoothScanToken();
    if (!token) return;

    setState({ kind: 'submitting' });
    try {
      const result = await participantApi.scanBooth(token);
      clearBoothScanToken();
      window.dispatchEvent(new Event('participant:rewards-changed'));
      window.dispatchEvent(new Event('participant:notifications-changed'));
      setState({ kind: 'success', result });
    } catch (error) {
      const copy = errorCopy(error, language);
      if (copy.definitive) clearBoothScanToken();
      setState({ kind: 'error', title: copy.title, message: copy.message, retryable: copy.retryable });
    }
  }, [language]);

  useEffect(() => {
    if (requestStarted.current || !readBoothScanToken()) return;
    requestStarted.current = true;
    void submitScan();
  }, [submitScan]);

  const retry = () => {
    if (state.kind === 'submitting') return;
    void submitScan();
  };

  return (
    <section className="booth-scan-page" aria-labelledby="booth-scan-title">
      <div className={`booth-scan-card is-${state.kind}`}>
        {state.kind === 'submitting' && (
          <div className="booth-scan-centered">
            <div className="booth-scan-icon is-loading" aria-hidden="true"><QrCode size={32} /></div>
            <p className="booth-scan-eyebrow">{vi ? 'Lượt ghé gian hàng' : 'Booth visit'}</p>
            <h1 id="booth-scan-title">{vi ? 'Đang xác nhận mã QR' : 'Confirming QR code'}</h1>
            <p role="status" aria-live="polite">
              {vi ? 'Vui lòng chờ trong giây lát. Điểm chỉ được cộng một lần cho mỗi gian hàng.' : 'Please wait. Points are awarded only once per booth.'}
            </p>
            <span className="booth-scan-progress" aria-hidden="true" />
          </div>
        )}

        {state.kind === 'success' && (
          <>
            <div className="booth-scan-centered">
              <div className="booth-scan-icon is-success" aria-hidden="true"><CheckCircle2 size={34} /></div>
              <p className="booth-scan-eyebrow">{vi ? 'Lượt ghé gian hàng' : 'Booth visit'}</p>
              <h1 id="booth-scan-title">
                {state.result.alreadyVisited
                  ? (vi ? 'Bạn đã ghé gian hàng này' : 'Booth already visited')
                  : (vi ? 'Ghi nhận lượt ghé thành công' : 'Booth visit recorded')}
              </h1>
              <p role="status" aria-live="polite">
                {state.result.alreadyVisited
                  ? (vi ? 'Lượt ghé trước đó đã được giữ nguyên; hệ thống không cộng điểm trùng.' : 'Your earlier visit remains recorded; no duplicate points were added.')
                  : (vi ? 'Lượt ghé và điểm thưởng đã được lưu an toàn.' : 'Your visit and reward points were saved.')}
              </p>
            </div>

            <div className="booth-scan-visit-card">
              <div className="booth-scan-booth-icon" aria-hidden="true"><Store size={25} /></div>
              <div>
                <span>{state.result.boothVisit.booth.code}</span>
                <strong>{state.result.boothVisit.booth.name}</strong>
                <p>{state.result.boothVisit.event.name}</p>
              </div>
              <time dateTime={state.result.boothVisit.visitedAt}>
                <MapPin size={15} /> {visitTime(state.result.boothVisit.visitedAt, language)}
              </time>
            </div>

            <div className="booth-scan-reward-grid">
              <div>
                <span>{vi ? 'Điểm vừa nhận' : 'Points awarded'}</span>
                <strong>{state.result.newlyAwardedPoints > 0 ? `+${state.result.newlyAwardedPoints}` : '0'}</strong>
              </div>
              <div>
                <span>{vi ? 'Tổng điểm hiện tại' : 'Current total'}</span>
                <strong>{state.result.totalPoints}</strong>
              </div>
            </div>

            <p className="booth-scan-registration-note">
              <CheckCircle2 size={16} /> {registrationCopy(state.result.eventRegistrationAction, vi)}
            </p>

            {state.result.newlyUnlockedBadges.length > 0 && (
              <section className="booth-scan-unlocks" aria-labelledby="booth-scan-unlocks-title">
                <div>
                  <Sparkles size={20} aria-hidden="true" />
                  <h2 id="booth-scan-unlocks-title">{vi ? 'Huy hiệu mới mở khóa' : 'New badges unlocked'}</h2>
                </div>
                <ul>
                  {state.result.newlyUnlockedBadges.map(badge => (
                    <li key={badge.badgeId}>
                      {badge.iconUrl
                        ? <img src={badge.iconUrl} alt="" />
                        : <span aria-hidden="true"><Award size={22} /></span>}
                      <strong>{badge.name}</strong>
                      <small>{badge.requiredPoints} {vi ? 'điểm' : 'points'}</small>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <div className="booth-scan-actions">
              <Link className="is-primary" to="/participant/rewards">
                <Award size={17} /> {vi ? 'Xem điểm & huy hiệu' : 'View points & badges'}
              </Link>
              <Link to="/participant/events">{vi ? 'Về sự kiện của tôi' : 'Back to my events'}</Link>
            </div>
          </>
        )}

        {state.kind === 'error' && (
          <div className="booth-scan-centered">
            <div className="booth-scan-icon is-error" aria-hidden="true">
              {state.retryable ? <Clock3 size={31} /> : <CircleAlert size={31} />}
            </div>
            <p className="booth-scan-eyebrow">{vi ? 'Lượt ghé gian hàng' : 'Booth visit'}</p>
            <h1 id="booth-scan-title">{state.title}</h1>
            <p role="alert">{state.message}</p>
            {state.retryable && (
              <button type="button" className="booth-scan-retry" onClick={retry}>
                <RotateCcw size={17} /> {vi ? 'Thử lại' : 'Try again'}
              </button>
            )}
            <Link className="booth-scan-back" to="/participant/events">
              {vi ? 'Về sự kiện của tôi' : 'Back to my events'}
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}
