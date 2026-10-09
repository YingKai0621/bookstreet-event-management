import {
  AlertCircle,
  ArrowRight,
  Camera,
  CheckCircle2,
  Keyboard,
  QrCode,
  RotateCcw,
  UserCheck,
  X
} from 'lucide-react';
import React, { useState } from 'react';
import { Language } from '../../types';

interface OrganizerAttendanceModalProps {
  language: Language;
  isOpen?: boolean;
  onClose: () => void;
  onRecordScan?: (ticketCode: string, mode: 'check_in' | 'check_out') => Promise<{
    status?: string;
    message?: string;
    participantName?: string;
    ticketCode?: string;
  }>;
}

export const OrganizerAttendanceModal: React.FC<OrganizerAttendanceModalProps> = ({
  language: _language,
  isOpen = true,
  onClose,
  onRecordScan
}) => {
  const [scanMode, setScanMode] = useState<'check_in' | 'check_out'>('check_in');
  const [manualCode, setManualCode] = useState('');
  const [scanFeedback, setScanFeedback] = useState<{
    status: 'success' | 'warning' | 'error';
    message: string;
    participantName?: string;
    ticketCode?: string;
  } | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleScan = async (codeToTest?: string) => {
    const code = codeToTest?.trim();
    if (!code) {
      setScanFeedback({
        status: 'warning',
        message: 'Vui lòng nhập hoặc quét mã vé trước khi xác nhận.'
      });
      return;
    }
    if (!onRecordScan) return;
    setIsSubmitting(true);
    try {
      const result = await onRecordScan(code, scanMode);
      const participantName = result.participantName || 'Độc giả';
      const ticketCode = result.ticketCode || code;
      setScanFeedback({ status: 'success', message: result.message || 'Điểm danh thành công!', participantName, ticketCode });
    } catch (error) {
      setScanFeedback({
        status: 'error',
        message: error instanceof Error ? error.message : 'Không thể ghi nhận điểm danh.',
        ticketCode: code
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualCode.trim()) return;
    await handleScan(manualCode);
  };

  return (
    <div className="org-modal-backdrop" onClick={onClose}>
      <div 
        className="org-modal-box" 
        style={{ maxWidth: '580px' }} 
        onClick={(e) => e.stopPropagation()}
      >
        <div className="org-modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#17382E', color: '#E9BC63', display: 'grid', placeItems: 'center' }}>
              <QrCode size={18} />
            </div>
            <h3 style={{ margin: 0 }}>Xử lý điểm danh hoạt động (Attendance Hub)</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#637771' }}
          >
            <X size={20} />
          </button>
        </div>

        <div className="org-modal-body">
          {/* Mode Switcher: Check-in vs Check-out */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '0.5rem',
            background: '#F1F5F3',
            padding: '0.35rem',
            borderRadius: '8px',
            marginBottom: '1.25rem'
          }}>
            <button
              type="button"
              onClick={() => setScanMode('check_in')}
              style={{
                padding: '0.55rem',
                borderRadius: '6px',
                border: 'none',
                background: scanMode === 'check_in' ? '#17382E' : 'transparent',
                color: scanMode === 'check_in' ? '#FFFFFF' : '#4B5563',
                fontWeight: 700,
                fontSize: '0.84rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.4rem'
              }}
            >
              <UserCheck size={16} />
              <span>Điểm danh VÀO (Check-in)</span>
            </button>

            <button
              type="button"
              onClick={() => setScanMode('check_out')}
              style={{
                padding: '0.55rem',
                borderRadius: '6px',
                border: 'none',
                background: scanMode === 'check_out' ? '#17382E' : 'transparent',
                color: scanMode === 'check_out' ? '#FFFFFF' : '#4B5563',
                fontWeight: 700,
                fontSize: '0.84rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.4rem'
              }}
            >
              <RotateCcw size={15} />
              <span>Xác nhận RA (Check-out)</span>
            </button>
          </div>

          {/* Camera/QR area */}
          <div style={{
            background: '#111D19',
            borderRadius: '12px',
            padding: '1.5rem',
            textAlign: 'center',
            color: '#FFFFFF',
            position: 'relative',
            overflow: 'hidden',
            marginBottom: '1.25rem'
          }}>
            <div style={{
              width: '180px',
              height: '180px',
              margin: '0 auto 1rem',
              border: '2px dashed #E9BC63',
              borderRadius: '12px',
              position: 'relative',
              display: 'grid',
              placeItems: 'center',
              background: 'rgba(23, 56, 46, 0.4)'
            }}>
              <Camera size={36} color="rgba(233,188,99,0.7)" />
              {/* Laser Scanning Beam */}
              <div style={{
                position: 'absolute',
                left: '6px',
                right: '6px',
                height: '2px',
                background: '#E9BC63',
                boxShadow: '0 0 8px #E9BC63',
                animation: 'orgLaser 2s infinite alternate ease-in-out'
              }}></div>
            </div>

            <style>{`
              @keyframes orgLaser {
                0% { top: 10px; }
                100% { top: 165px; }
              }
            `}</style>

            <div style={{ display: 'flex', justifyContent: 'center', gap: '0.65rem' }}>
              <button
                type="button"
                className="btn-org-gold"
                style={{ padding: '0.55rem 1rem', fontSize: '0.82rem' }}
                onClick={() => document.getElementById('organizer-ticket-code')?.focus()}
              >
                <Keyboard size={15} />
                <span>Nhập mã vé để xác nhận</span>
              </button>
            </div>
          </div>

          {/* Manual Code Input Form */}
          <form onSubmit={handleManualSubmit} style={{ display: 'flex', gap: '0.65rem', marginBottom: '1.25rem' }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <input
                id="organizer-ticket-code"
                type="text"
                placeholder="Nhập mã vé thủ công (ví dụ: DS-9281)..."
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.65rem 0.85rem',
                  borderRadius: '8px',
                  border: '1px solid #D6E0DB',
                  fontSize: '0.86rem'
                }}
              />
            </div>
            <button type="submit" className="btn-org-primary" disabled={isSubmitting} style={{ whiteSpace: 'nowrap' }}>
              <span>Xác nhận</span>
              <ArrowRight size={14} />
            </button>
          </form>

          {/* Scan Feedback Result Alert */}
          {scanFeedback && (
            <div style={{
              background: scanFeedback.status === 'success' ? '#DCFCE7' : '#FEE2E2',
              border: scanFeedback.status === 'success' ? '1px solid #86EFAC' : '1px solid #FCA5A5',
              borderRadius: '8px',
              padding: '0.85rem 1.25rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              marginBottom: '1.25rem'
            }}>
              {scanFeedback.status === 'success' ? (
                <CheckCircle2 size={22} color="#166534" />
              ) : (
                <AlertCircle size={22} color="#991B1B" />
              )}
              <div>
                <strong style={{ display: 'block', fontSize: '0.9rem', color: scanFeedback.status === 'success' ? '#166534' : '#991B1B' }}>
                  {scanFeedback.message}
                </strong>
                {scanFeedback.participantName && (
                  <span style={{ fontSize: '0.78rem', color: '#4B5563' }}>
                    Độc giả: {scanFeedback.participantName} • Mã: {scanFeedback.ticketCode}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Recent Scans Feed */}
          <div>
            <span style={{ fontSize: '0.76rem', color: '#637771', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Nhật ký quét vé gần nhất
            </span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem', marginTop: '0.45rem' }}>
              <p style={{ color: '#637771', fontSize: '0.8rem' }}>
                Lịch sử điểm danh chỉ hiển thị khi backend cung cấp API truy vấn dữ liệu.
              </p>
            </div>
          </div>
        </div>

        <div className="org-modal-footer">
          <button type="button" className="btn-org-secondary" onClick={onClose}>
            Đóng bảng điểm danh
          </button>
        </div>
      </div>
    </div>
  );
};
