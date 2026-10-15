import { useModalDismiss } from '../../hooks/useModalDismiss';
import { CheckCircle2, Mail, MessageSquare, Search, Star } from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import { OrganizerFeedback, OrganizerFeedbackStatus, organizerApi } from '../../services/organizerApi';
import { Language } from '../../types';

const STATUS_OPTIONS: Array<{ value: OrganizerFeedbackStatus | 'all'; label: string }> = [
  { value: 'all', label: 'Tất cả' },
  { value: 'new', label: 'Mới tiếp nhận' },
  { value: 'in_progress', label: 'Đang xử lý' },
  { value: 'responded', label: 'Đã phản hồi' },
  { value: 'closed', label: 'Đã đóng' },
];

const statusLabel = (status: OrganizerFeedbackStatus) => ({
  new: 'Mới tiếp nhận', in_progress: 'Đang xử lý', responded: 'Đã phản hồi', closed: 'Đã đóng',
}[status]);

const targetLabel = (feedback: OrganizerFeedback) =>
  feedback.targetName || feedback.heritage?.name || feedback.booth?.name || 'Đường Sách TP.HCM';

export const OrganizerFeedbackView: React.FC<{ language: Language }> = ({ language }) => {
  const [feedbacks, setFeedbacks] = useState<OrganizerFeedback[]>([]);
  const [filter, setFilter] = useState<OrganizerFeedbackStatus | 'all'>('all');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<OrganizerFeedback | null>(null);
  const [note, setNote] = useState('');
  const [status, setStatus] = useState<OrganizerFeedbackStatus>('new');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  useModalDismiss(Boolean(selected), () => { if (!saving) setSelected(null); });

  const loadFeedbacks = async () => {
    setLoading(true);
    try {
      setFeedbacks(await organizerApi.getFeedbacks());
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không tải được góp ý.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void loadFeedbacks(); }, []);

  const visibleFeedbacks = useMemo(() => feedbacks.filter(feedback => {
    const keyword = search.trim().toLocaleLowerCase('vi-VN');
    return (filter === 'all' || feedback.status === filter)
      && (!keyword || [targetLabel(feedback), feedback.comments, feedback.contactEmail]
        .filter(Boolean).some(value => String(value).toLocaleLowerCase('vi-VN').includes(keyword)));
  }), [feedbacks, filter, search]);

  const openFeedback = (feedback: OrganizerFeedback) => {
    setSelected(feedback);
    setNote(feedback.internalNote || '');
    setStatus(feedback.status);
  };

  const saveFeedback = async () => {
    if (!selected) return;
    if (status === 'responded' && !note.trim()) {
      setError('Vui lòng nhập nội dung phản hồi trước khi đánh dấu đã phản hồi.');
      return;
    }
    setSaving(true);
    try {
      const updated = await organizerApi.updateFeedback(selected.id, { status, internalNote: note.trim() || undefined });
      setFeedbacks(items => items.map(item => item.id === updated.id ? { ...item, ...updated } : item));
      setSelected(null);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể cập nhật góp ý.');
    } finally {
      setSaving(false);
    }
  };

  return <section className="organizer-content">
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', marginBottom: '1.25rem' }}>
      <div>
        <h1 className="organizer-view-title">{language === 'vi' ? 'Góp ý độc giả' : 'Reader feedback'}</h1>
        <p className="organizer-view-sub">{language === 'vi' ? 'Tiếp nhận, xử lý và phản hồi các đánh giá được gửi từ độc giả.' : 'Review, process, and reply to reader feedback.'}</p>
      </div>
      <div style={{ display: 'flex', gap: '1.25rem', alignItems: 'center', background: '#fff', border: '1px solid #E2EAE5', borderRadius: 10, padding: '0.75rem 1rem' }}>
        <span><strong style={{ fontSize: '1.2rem' }}>{feedbacks.length}</strong><small style={{ display: 'block', color: '#637771' }}>Tổng góp ý</small></span>
        <span><strong style={{ fontSize: '1.2rem', color: '#B45309' }}>{feedbacks.filter(item => item.status === 'new').length}</strong><small style={{ display: 'block', color: '#637771' }}>Chờ xử lý</small></span>
      </div>
    </div>

    {error && <div style={{ marginBottom: '1rem', padding: '0.8rem 1rem', color: '#991B1B', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8 }}>{error}</div>}
    <div className="org-toolbar">
      <div className="org-tabs-bar">{STATUS_OPTIONS.map(option => <button key={option.value} type="button" className={`org-tab-btn ${filter === option.value ? 'is-active' : ''}`} onClick={() => setFilter(option.value)}>{option.label}</button>)}</div>
      <div className="organizer-search-box" style={{ maxWidth: 340 }}><Search size={16} /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Tìm nội dung, người gửi..." /></div>
    </div>

    {loading ? <p className="organizer-view-sub">Đang tải góp ý…</p> : visibleFeedbacks.length === 0 ? <div style={{ background: '#fff', border: '1px solid #E2EAE5', borderRadius: 12, padding: '3rem', textAlign: 'center', color: '#637771' }}><MessageSquare size={32} style={{ opacity: .4 }} /><p>Chưa có góp ý phù hợp.</p></div> :
      <div style={{ display: 'grid', gap: '0.85rem' }}>{visibleFeedbacks.map(feedback => <article key={feedback.id} style={{ background: '#fff', border: '1px solid #E2EAE5', borderRadius: 12, padding: '1rem 1.25rem', display: 'flex', gap: '1rem', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ minWidth: 260, flex: 1 }}>
          <div style={{ display: 'flex', gap: '.5rem', alignItems: 'center', flexWrap: 'wrap' }}><strong>{targetLabel(feedback)}</strong><span style={{ fontSize: '.75rem', borderRadius: 999, padding: '.2rem .55rem', background: feedback.status === 'responded' ? '#E8F5EF' : '#FEF3C7', color: feedback.status === 'responded' ? '#185E48' : '#92400E' }}>{statusLabel(feedback.status)}</span></div>
          <div style={{ display: 'flex', gap: '.15rem', margin: '.45rem 0' }}>{[1, 2, 3, 4, 5].map(star => <Star key={star} size={14} fill={star <= feedback.rating ? '#E9BC63' : 'none'} color={star <= feedback.rating ? '#E9BC63' : '#CBD5E1'} />)}</div>
          <p style={{ margin: 0, color: '#40564D', fontSize: '.88rem' }}>{feedback.comments || 'Không có nội dung chi tiết.'}</p>
          <small style={{ color: '#7A918A', display: 'block', marginTop: '.5rem' }}>{feedback.contactEmail || 'Ẩn danh'} · {new Date(feedback.createdAt).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}</small>
        </div>
        <button type="button" className="btn-org-secondary" onClick={() => openFeedback(feedback)}>{feedback.status === 'responded' ? 'Xem phản hồi' : 'Xử lý góp ý'}</button>
      </article>)}</div>}

    {selected && <div className="org-modal-overlay"><div className="org-modal-box"><div className="org-modal-header"><div><h3>Phản hồi góp ý</h3><small>{targetLabel(selected)}</small></div><button type="button" className="btn-org-secondary" onClick={() => setSelected(null)}>Đóng</button></div><div className="org-modal-body"><p style={{ marginTop: 0, color: '#40564D' }}>{selected.comments || 'Không có nội dung chi tiết.'}</p><p style={{ display: 'flex', alignItems: 'center', gap: '.35rem', color: '#637771', fontSize: '.85rem' }}><Mail size={15} />{selected.contactEmail || 'Ẩn danh'}</p><label style={{ display: 'block', fontWeight: 700, marginBottom: '.4rem' }}>Trạng thái</label><select value={status} onChange={event => setStatus(event.target.value as OrganizerFeedbackStatus)} style={{ width: '100%', padding: '.65rem', border: '1px solid #CFDAD5', borderRadius: 8, marginBottom: '1rem' }}>{STATUS_OPTIONS.filter(option => option.value !== 'all').map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select><label style={{ display: 'block', fontWeight: 700, marginBottom: '.4rem' }}>Nội dung phản hồi gửi độc giả</label><textarea value={note} onChange={event => setNote(event.target.value)} rows={5} placeholder="Nhập phản hồi hoặc hướng xử lý..." style={{ width: '100%', boxSizing: 'border-box', padding: '.75rem', border: '1px solid #CFDAD5', borderRadius: 8, fontFamily: 'inherit' }} /></div><div className="org-modal-footer"><button type="button" className="btn-org-secondary" onClick={() => setSelected(null)}>Hủy</button><button type="button" className="btn-org-primary" disabled={saving} onClick={() => void saveFeedback()}><CheckCircle2 size={16} />{saving ? 'Đang lưu...' : 'Lưu xử lý'}</button></div></div></div>}
  </section>;
};
