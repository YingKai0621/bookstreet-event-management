import { displayDateText } from '../../utils/dateDisplay';
import { ArrowRight, Award, Calendar, Download, Eye, RefreshCw, X } from 'lucide-react';
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { PaginatedList } from '../../components/ui/PaginatedList';
import { useModalDismiss } from '../../hooks/useModalDismiss';
import type { BinaryDownload } from '../../services/apiClient';
import type { Language, ParticipantCertificate } from '../../types';
import './ParticipantPages.css';

interface MyCertificatesPageProps {
  language: Language;
  certificates: ParticipantCertificate[];
  participantName: string;
  isLoading: boolean;
  loadError: string;
  onRetry: () => void;
  onLoadDetail: (certificateId: string) => Promise<ParticipantCertificate>;
  onDownload: (certificateId: string) => Promise<BinaryDownload>;
}

export const MyCertificatesPage: React.FC<MyCertificatesPageProps> = ({
  language,
  certificates,
  participantName,
  isLoading,
  loadError,
  onRetry,
  onLoadDetail,
  onDownload,
}) => {
  const vi = language === 'vi';
  const [selectedCertificate, setSelectedCertificate] = useState<ParticipantCertificate | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');
  const [downloadingId, setDownloadingId] = useState('');
  const [downloadError, setDownloadError] = useState('');
  useModalDismiss(Boolean(selectedCertificate), () => setSelectedCertificate(null));

  const openCertificate = async (certificate: ParticipantCertificate) => {
    setSelectedCertificate(certificate);
    setDetailLoading(true);
    setDetailError('');
    try {
      setSelectedCertificate(await onLoadDetail(certificate.id));
    } catch (error) {
      setDetailError(error instanceof Error
        ? error.message
        : (vi ? 'Không thể tải chi tiết chứng nhận.' : 'Unable to load certificate details.'));
    } finally {
      setDetailLoading(false);
    }
  };

  const downloadCertificate = async (certificate: ParticipantCertificate) => {
    if (!certificate.downloadAvailable || certificate.status === 'REVOKED') return;
    setDownloadingId(certificate.id);
    setDownloadError('');
    try {
      const result = await onDownload(certificate.id);
      const downloadUrl = URL.createObjectURL(result.blob);
      const anchor = document.createElement('a');
      anchor.href = downloadUrl;
      anchor.download = result.filename || `certificate-${certificate.certificateCode}.pdf`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(downloadUrl);
    } catch (error) {
      setDownloadError(error instanceof Error
        ? error.message
        : (vi ? 'Không thể tải chứng nhận.' : 'Unable to download the certificate.'));
    } finally {
      setDownloadingId('');
    }
  };

  return (
    <div className="certificates-page">
      <div className="participant-page-header">
        <h1 className="participant-page-title workspace-page-title">
          {vi ? 'Chứng nhận của tôi' : 'My Certificates'}
        </h1>
        <p className="participant-page-sub workspace-page-subtitle">
          {vi
            ? 'Theo dõi chứng nhận đã cấp, trạng thái hiệu lực và tải bản PDF chính thức.'
            : 'Track issued certificates, validity, and official PDF downloads.'}
        </p>
      </div>

      {downloadError && <p className="participant-inline-error" role="alert">{downloadError}</p>}

      {isLoading ? (
        <div className="participant-data-state" role="status">
          <span className="participant-state-spinner" aria-hidden="true" />
          <strong>{vi ? 'Đang tải chứng nhận' : 'Loading certificates'}</strong>
          <p>{vi ? 'Hệ thống đang đồng bộ các chứng nhận thuộc tài khoản của bạn.' : 'Synchronizing certificates owned by your account.'}</p>
        </div>
      ) : loadError ? (
        <div className="participant-data-state is-error" role="alert">
          <strong>{vi ? 'Chưa tải được chứng nhận' : 'Unable to load certificates'}</strong>
          <p>{loadError}</p>
          <button type="button" className="btn-part-secondary" onClick={onRetry}>
            <RefreshCw size={16} />{vi ? 'Thử lại' : 'Try again'}
          </button>
        </div>
      ) : certificates.length === 0 ? (
        <div className="certificate-empty-card">
          <div className="cert-empty-icon-wrap" aria-hidden="true"><Award size={44} /></div>
          <h2 className="cert-empty-title">{vi ? 'Bạn chưa có chứng nhận nào' : 'No certificates yet'}</h2>
          <p className="cert-empty-desc">
            {vi
              ? 'Chứng nhận được cấp sau khi hoạt động đủ điều kiện hoàn tất và điểm danh của bạn được ghi nhận hợp lệ.'
              : 'Certificates are issued after an eligible activity completes and your attendance is valid.'}
          </p>
          <div className="cert-empty-actions-row">
            <Link to="/participant/events" className="btn-part-primary">
              <Calendar size={16} />{vi ? 'Xem sự kiện của tôi' : 'View my events'}<ArrowRight size={15} />
            </Link>
          </div>
        </div>
      ) : (
        <PaginatedList items={certificates}>{pageItems => (
          <div className="certificates-list-container">
            {pageItems.map(certificate => {
              const revoked = certificate.status === 'REVOKED';
              return (
                <article className="certificate-card-row" key={certificate.id}>
                  <div className="certificate-mini-preview" aria-hidden="true"><Award size={26} /></div>
                  <div className="certificate-info-col">
                    <div className="certificate-heading-line">
                      <h2 className="certificate-title">{certificate.title}</h2>
                      <span className={`certificate-status-pill ${revoked ? 'is-revoked' : 'is-issued'}`}>
                        {revoked ? (vi ? 'Đã thu hồi' : 'Revoked') : (vi ? 'Có hiệu lực' : 'Issued')}
                      </span>
                    </div>
                    <div className="certificate-activity-name">
                      {vi ? 'Người nhận: ' : 'Recipient: '}{certificate.recipientName || participantName}
                    </div>
                    <div className="certificate-meta-line">
                      <span className="cert-meta-item">{vi ? 'Cấp ngày' : 'Issued'}: {displayDateText(certificate.issueDate)}</span>
                      {certificate.revokedDate && <span className="cert-meta-item">{vi ? 'Thu hồi ngày' : 'Revoked'}: {displayDateText(certificate.revokedDate)}</span>}
                      <span className="cert-meta-code">{certificate.certificateCode}</span>
                    </div>
                  </div>
                  <div className="certificate-actions">
                    <button type="button" className="btn-part-secondary" onClick={() => void openCertificate(certificate)}>
                      <Eye size={15} />{vi ? 'Chi tiết' : 'Details'}
                    </button>
                    <button
                      type="button"
                      className="btn-part-primary"
                      disabled={!certificate.downloadAvailable || downloadingId === certificate.id}
                      title={revoked ? (vi ? 'Chứng nhận đã thu hồi không thể tải xuống.' : 'Revoked certificates cannot be downloaded.') : undefined}
                      onClick={() => void downloadCertificate(certificate)}
                    >
                      <Download size={15} />
                      {downloadingId === certificate.id
                        ? (vi ? 'Đang tải...' : 'Downloading...')
                        : (vi ? 'Tải PDF' : 'Download PDF')}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}</PaginatedList>
      )}

      {selectedCertificate && (
        <div className="certificate-detail-overlay" role="dialog" aria-modal="true" aria-labelledby="certificate-detail-title">
          <section className="certificate-detail-modal">
            <button
              type="button"
              className="certificate-detail-close"
              aria-label={vi ? 'Đóng chi tiết chứng nhận' : 'Close certificate details'}
              onClick={() => setSelectedCertificate(null)}
            ><X size={20} /></button>

            <span className={`certificate-status-pill ${selectedCertificate.status === 'REVOKED' ? 'is-revoked' : 'is-issued'}`}>
              {selectedCertificate.status === 'REVOKED' ? (vi ? 'Đã thu hồi' : 'Revoked') : (vi ? 'Có hiệu lực' : 'Issued')}
            </span>
            <h2 id="certificate-detail-title">{selectedCertificate.title}</h2>
            <p className="certificate-detail-recipient">{vi ? 'Trao cho' : 'Awarded to'} <strong>{selectedCertificate.recipientName || participantName}</strong></p>

            {detailLoading ? (
              <div className="participant-data-state compact" role="status">
                <span className="participant-state-spinner" aria-hidden="true" />
                <strong>{vi ? 'Đang tải chi tiết' : 'Loading details'}</strong>
              </div>
            ) : detailError ? (
              <p className="participant-inline-error" role="alert">{detailError}</p>
            ) : (
              <div className="certificate-detail-fields">
                <div><span>{vi ? 'Hoạt động' : 'Activity'}</span><strong>{selectedCertificate.activityTitle || '—'}</strong></div>
                <div><span>{vi ? 'Sự kiện' : 'Event'}</span><strong>{selectedCertificate.eventTitle || '—'}</strong></div>
                <div><span>{vi ? 'Ngày cấp' : 'Issued date'}</span><strong>{displayDateText(selectedCertificate.issueDate)}</strong></div>
                <div><span>{vi ? 'Mã chứng nhận' : 'Certificate code'}</span><strong className="cert-meta-code">{selectedCertificate.certificateCode}</strong></div>
                {selectedCertificate.revokedDate && <div><span>{vi ? 'Ngày thu hồi' : 'Revoked date'}</span><strong>{displayDateText(selectedCertificate.revokedDate)}</strong></div>}
              </div>
            )}

            {selectedCertificate.status === 'REVOKED' && (
              <p className="certificate-revoked-note">
                {vi ? 'Chứng nhận này được giữ lại như lịch sử nhưng không còn hiệu lực và không thể tải xuống.' : 'This certificate remains as history but is no longer valid or downloadable.'}
              </p>
            )}

            <footer className="certificate-detail-actions">
              <button type="button" className="btn-part-secondary" onClick={() => setSelectedCertificate(null)}>{vi ? 'Đóng' : 'Close'}</button>
              <button
                type="button"
                className="btn-part-primary"
                disabled={!selectedCertificate.downloadAvailable || downloadingId === selectedCertificate.id}
                onClick={() => void downloadCertificate(selectedCertificate)}
              ><Download size={15} />{vi ? 'Tải PDF' : 'Download PDF'}</button>
            </footer>
          </section>
        </div>
      )}
    </div>
  );
};
