import { useEffect, useState } from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { paymentApi } from '../../services/paymentApi';
import { positiveId } from '../../services/paymentPresentation';

export function VnPayReturnPage() {
  const { search } = useLocation();
  const references = new URLSearchParams(search).getAll('vnp_TxnRef');
  const reference = references.length === 1 ? references[0] : '';
  const id = reference.startsWith('BSP') ? positiveId(reference.slice(3)) : null;
  const [requestId, setRequestId] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    if (id === null) return;
    let active = true;
    paymentApi.getPayment(id).then(payment => {
      if (active) setRequestId(payment.boothRequestId);
    }).catch(caught => {
      if (active) setError(caught instanceof Error ? caught.message : 'Không thể tải giao dịch.');
    });
    return () => { active = false; };
  }, [id, revision]);

  if (requestId !== null) {
    return <Navigate replace to={`/partner/booth-requests/${requestId}/payment?paymentId=${id}`} />;
  }
  return <section className="partner-page s3-payment-page">
    <h1>Kết quả thanh toán VNPay</h1>
    {id === null ? <p role="alert">Đường dẫn giao dịch không hợp lệ. Vui lòng mở lịch sử thanh toán của bạn.</p>
      : error ? <><p role="alert">{error}</p><button type="button" onClick={() => { setError(''); setRevision(value => value + 1); }}>Thử lại</button></>
        : <p role="status">Đang lấy kết quả thanh toán từ hệ thống…</p>}
    <Link to="/partner/booth-requests">Về yêu cầu gian hàng</Link>
  </section>;
}
