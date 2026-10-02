import React, { useState } from 'react';
import { 
  Globe2, 
  Plus, 
  Search, 
  MapPin, 
  Eye, 
  Trash2, 
  Edit3, 
  CheckCircle2,
  ExternalLink,
  X,
  Check,
  Calendar,
  Layers,
  Sparkles,
  QrCode,
  Image as ImageIcon,
  Upload
} from 'lucide-react';
import { Language, ExtendedHeritageProfile, HeritagePublishStatus } from '../../types';

interface OrganizerPublicContentViewProps {
  language: Language;
  heritageList?: ExtendedHeritageProfile[];
  onAddHeritage?: (item: ExtendedHeritageProfile) => void | Promise<void>;
  onUpdateHeritage?: (item: ExtendedHeritageProfile) => void | Promise<void>;
  onDeleteHeritage?: (heritageId: string) => void | Promise<void>;
}

export const OrganizerPublicContentView: React.FC<OrganizerPublicContentViewProps> = ({
  language,
  heritageList = [],
  onAddHeritage,
  onUpdateHeritage,
  onDeleteHeritage
}) => {
  const [localList, setLocalList] = useState<ExtendedHeritageProfile[]>(heritageList);
  const [searchQuery, setSearchQuery] = useState('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Modal states
  const [previewItem, setPreviewItem] = useState<ExtendedHeritageProfile | null>(null);
  const [editingItem, setEditingItem] = useState<ExtendedHeritageProfile | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Form states for Editing / Creating
  const [formName, setFormName] = useState('');
  const [formNameEn, setFormNameEn] = useState('');
  const [formCode, setFormCode] = useState('');
  const [formAddress, setFormAddress] = useState('');
  const [formPeriod, setFormPeriod] = useState('');
  const [formCategory, setFormCategory] = useState('');
  const [formBrief, setFormBrief] = useState('');
  const [formStory, setFormStory] = useState('');
  const [formImageUrl, setFormImageUrl] = useState('');
  const [formStatus, setFormStatus] = useState<HeritagePublishStatus>('draft');

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3200);
  };

  // Keep localList in sync if heritageList prop changes externally
  React.useEffect(() => {
    setLocalList(heritageList || []);
  }, [heritageList]);

  const filteredHeritage = localList.filter(h => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const title = language === 'vi' ? h.name : (h.nameEn || h.name);
    const address = language === 'vi' ? h.address : (h.addressEn || h.address);
    const code = h.code || '';
    return title.toLowerCase().includes(q) || address.toLowerCase().includes(q) || code.toLowerCase().includes(q);
  });

  // Open Edit Modal
  const handleOpenEdit = (item: ExtendedHeritageProfile) => {
    setEditingItem(item);
    setFormName(item.name);
    setFormNameEn(item.nameEn || '');
    setFormCode(item.code);
    setFormAddress(item.address);
    setFormPeriod(item.period || '');
    setFormCategory(item.category || '');
    setFormBrief(item.briefDesc || '');
    setFormStory(item.story || '');
    setFormImageUrl(item.image?.url || '');
    setFormStatus(item.status || 'published');
  };

  // Open Create Modal
  const handleOpenCreate = () => {
    setIsCreating(true);
    setFormName('');
    setFormNameEn('');
    setFormCode('');
    setFormAddress('');
    setFormPeriod('');
    setFormCategory('');
    setFormBrief('');
    setFormStory('');
    setFormImageUrl('');
    setFormStatus('draft');
  };

  // Save Edit
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;

    const updated: ExtendedHeritageProfile = {
      ...editingItem,
      name: formName,
      nameEn: formNameEn || formName,
      code: formCode,
      address: formAddress,
      addressEn: formAddress,
      period: formPeriod,
      category: formCategory,
      briefDesc: formBrief,
      story: formStory,
      status: formStatus,
      image: {
        ...editingItem.image,
        url: formImageUrl.trim()
      }
    };
    try {
      await onUpdateHeritage?.(updated);
      setEditingItem(null);
      showToast(language === 'vi' ? 'Đã cập nhật nội dung di sản thành công!' : 'Heritage content updated successfully!');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Không thể cập nhật di sản');
    }
  };

  // Save Create
  const handleSaveCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const newItem: ExtendedHeritageProfile = {
      id: '',
      code: formCode.trim(),
      name: formName,
      nameEn: formNameEn || formName,
      province: '',
      provinceEn: '',
      category: formCategory,
      categoryEn: formCategory,
      period: formPeriod,
      periodEn: formPeriod,
      address: formAddress,
      addressEn: formAddress,
      briefDesc: formBrief,
      briefDescEn: formBrief,
      highlights: [],
      highlightsEn: [],
      story: formStory || formBrief,
      storyEn: formStory || formBrief,
      referenceSource: '',
      updatedDate: '',
      status: formStatus,
      qrStatus: 'inactive',
      viewCount: 0,
      qrScanCount: 0,
      image: {
        url: formImageUrl.trim(),
        alt: formName,
        source: '',
        license: ''
      },
      mapCoordinates: {
        x: 0,
        y: 0,
        areaName: ''
      }
    };
    try {
      await onAddHeritage?.(newItem);
      setIsCreating(false);
      showToast(language === 'vi' ? 'Đã thêm điểm di sản mới thành công!' : 'New heritage site added successfully!');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Không thể tạo điểm di sản');
    }
  };

  // Confirm Delete
  const handleConfirmDelete = async () => {
    if (!deletingId) return;
    try {
      await onDeleteHeritage?.(deletingId);
      setDeletingId(null);
      showToast(language === 'vi' ? 'Đã xóa điểm di sản khỏi hệ thống' : 'Heritage site removed');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Không thể xóa điểm di sản');
    }
  };

  return (
    <div className="organizer-content" style={{ padding: '1.75rem 2rem' }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '1rem',
        marginBottom: '1.5rem'
      }}>
        <div>
          <h1 className="organizer-view-title" style={{ margin: '0 0 0.35rem 0' }}>
            {language === 'vi' ? 'Nội dung công khai & Di sản văn hóa' : 'Public Content & Heritage'}
          </h1>
          <p className="organizer-view-sub" style={{ margin: 0 }}>
            {language === 'vi' 
              ? 'Quản lý thông tin các điểm di sản kiến trúc, câu chuyện văn hóa kết nối với Đường Sách' 
              : 'Manage architectural heritage sites and cultural stories for the public website'}
          </p>
        </div>

        <button
          type="button"
          className="btn-org-primary"
          onClick={handleOpenCreate}
          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '9px 18px', borderRadius: 8, fontSize: '0.86rem', fontWeight: 600 }}
        >
          <Plus size={16} />
          {language === 'vi' ? 'Thêm điểm di sản mới' : 'Add Heritage Site'}
        </button>
      </div>

      {/* Filter and Search */}
      <div className="organizer-card" style={{ marginBottom: '1.5rem', padding: '0.9rem 1.25rem' }}>
        <div style={{ position: 'relative', maxWidth: 420 }}>
          <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF' }} />
          <input
            type="text"
            className="organizer-search-input"
            style={{ 
              width: '100%', 
              paddingLeft: '2.4rem', 
              paddingRight: '1rem', 
              paddingTop: '8px', 
              paddingBottom: '8px',
              borderRadius: 7,
              border: '1px solid #E5E7EB',
              fontSize: '0.85rem'
            }}
            placeholder={language === 'vi' ? 'Tìm điểm di sản, mã DS, địa chỉ...' : 'Search heritage sites, code, locations...'}
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Heritage Cards Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
        gap: '1.25rem'
      }}>
        {filteredHeritage.map(item => (
          <div key={item.id} className="organizer-card" style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column', borderRadius: 10 }}>
            <div style={{ height: 165, position: 'relative', background: '#E2E8F0', overflow: 'hidden' }}>
              {item.image?.url ? <img src={item.image.url} alt={item.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <div style={{ height: '100%', display: 'grid', placeItems: 'center', color: '#94A3B8' }}><ImageIcon size={36} /></div>}
              <span 
                className={`organizer-status-chip ${item.status === 'published' ? 'chip-approved' : 'chip-pending'}`} 
                style={{ 
                  position: 'absolute', 
                  top: 12, 
                  right: 12,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  padding: '0.3rem 0.75rem',
                  borderRadius: '20px',
                  fontSize: '0.76rem',
                  fontWeight: 700,
                  backdropFilter: 'blur(8px)',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.18)',
                  background: item.status === 'published' ? '#DCFCE7' : '#FEF3C7',
                  color: item.status === 'published' ? '#166534' : '#92400E',
                  border: item.status === 'published' ? '1px solid #86EFAC' : '1px solid #FDE68A'
                }}
              >
                <span style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: item.status === 'published' ? '#16A34A' : '#D97706'
                }} />
                {item.status === 'published' ? (language === 'vi' ? 'Đã công bố' : 'Published') : (language === 'vi' ? 'Bản nháp' : 'Draft')}
              </span>
            </div>

            <div style={{ padding: '1.25rem', flex: 1, display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '0.5rem', marginBottom: '0.35rem' }}>
                <h3 style={{ fontSize: '1.02rem', fontWeight: 700, color: '#13241F', margin: 0 }}>
                  {language === 'vi' ? item.name : (item.nameEn || item.name)}
                </h3>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#B48A3C', background: 'rgba(180, 138, 60, 0.12)', padding: '2px 7px', borderRadius: 4 }}>
                  {item.code}
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', color: '#6B7280', marginBottom: '0.75rem' }}>
                <MapPin size={13} color="#9CA3AF" />
                <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {language === 'vi' ? item.address : (item.addressEn || item.address)}
                </span>
              </div>

              <p style={{ fontSize: '0.82rem', color: '#4B5563', lineHeight: 1.5, margin: '0 0 1rem 0', flex: 1 }}>
                {language === 'vi' 
                  ? ((item.briefDesc || item.story)?.slice(0, 105) + '...') 
                  : (((item.briefDescEn || item.storyEn || item.story))?.slice(0, 105) + '...')}
              </p>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid #F3F4F6', paddingTop: '0.85rem' }}>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  {/* Nút Xem chi tiết */}
                  <button
                    type="button"
                    className="organizer-icon-button"
                    title={language === 'vi' ? 'Xem chi tiết / xem trước' : 'Preview heritage'}
                    onClick={() => setPreviewItem(item)}
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 7,
                      border: '1px solid #86EFAC',
                      background: '#F0FDF4',
                      color: '#166534',
                      display: 'grid',
                      placeItems: 'center',
                      cursor: 'pointer',
                      transition: 'all 150ms ease'
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.background = '#166534';
                      e.currentTarget.style.color = '#FFFFFF';
                      e.currentTarget.style.borderColor = '#166534';
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.background = '#F0FDF4';
                      e.currentTarget.style.color = '#166534';
                      e.currentTarget.style.borderColor = '#86EFAC';
                    }}
                  >
                    <Eye size={15} />
                  </button>

                  {/* Nút Chỉnh sửa */}
                  <button
                    type="button"
                    className="organizer-icon-button"
                    title={language === 'vi' ? 'Chỉnh sửa nội dung' : 'Edit content'}
                    onClick={() => handleOpenEdit(item)}
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 7,
                      border: '1px solid #FDE047',
                      background: '#FEFCE8',
                      color: '#854D0E',
                      display: 'grid',
                      placeItems: 'center',
                      cursor: 'pointer',
                      transition: 'all 150ms ease'
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.background = '#B48A3C';
                      e.currentTarget.style.color = '#FFFFFF';
                      e.currentTarget.style.borderColor = '#B48A3C';
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.background = '#FEFCE8';
                      e.currentTarget.style.color = '#854D0E';
                      e.currentTarget.style.borderColor = '#FDE047';
                    }}
                  >
                    <Edit3 size={15} />
                  </button>

                  {/* Nút Xóa */}
                  <button
                    type="button"
                    className="organizer-icon-button"
                    title={language === 'vi' ? 'Xóa điểm di sản' : 'Delete heritage'}
                    onClick={() => setDeletingId(item.id)}
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 7,
                      border: '1px solid #FCA5A5',
                      background: '#FEF2F2',
                      color: '#DC2626',
                      display: 'grid',
                      placeItems: 'center',
                      cursor: 'pointer',
                      transition: 'all 150ms ease'
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.background = '#DC2626';
                      e.currentTarget.style.color = '#FFFFFF';
                      e.currentTarget.style.borderColor = '#DC2626';
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.background = '#FEF2F2';
                      e.currentTarget.style.color = '#DC2626';
                      e.currentTarget.style.borderColor = '#FCA5A5';
                    }}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>

                <a
                  href={`/di-san/${encodeURIComponent(item.id)}`}
                  target="_blank"
                  rel="noreferrer"
                  style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.78rem', color: '#13241F', textDecoration: 'none', fontWeight: 600 }}
                >
                  <span>{language === 'vi' ? 'Đến trang công khai' : 'View Public'}</span>
                  <ExternalLink size={12} />
                </a>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ======================================================== */}
      {/* 1. PREVIEW MODAL (Xem trước di sản) */}
      {/* ======================================================== */}
      {previewItem && (
        <div className="org-modal-backdrop" onClick={() => setPreviewItem(null)}>
          <div className="org-modal-box" style={{ maxWidth: 640 }} onClick={e => e.stopPropagation()}>
            <div style={{ position: 'relative', height: 220, background: '#E5E7EB', overflow: 'hidden' }}>
              <img 
                src={previewItem.image?.url} 
                alt={previewItem.name} 
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
              <button
                type="button"
                onClick={() => setPreviewItem(null)}
                style={{
                  position: 'absolute',
                  top: 14,
                  right: 14,
                  background: 'rgba(0, 0, 0, 0.55)',
                  border: 'none',
                  color: '#FFFFFF',
                  width: 32,
                  height: 32,
                  borderRadius: '50%',
                  display: 'grid',
                  placeItems: 'center',
                  cursor: 'pointer'
                }}
              >
                <X size={18} />
              </button>
              <span 
                className={`organizer-status-chip ${previewItem.status === 'published' ? 'chip-approved' : 'chip-pending'}`} 
                style={{ 
                  position: 'absolute', 
                  bottom: 14, 
                  left: 18,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  padding: '0.35rem 0.85rem',
                  borderRadius: '20px',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  backdropFilter: 'blur(8px)',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
                  background: previewItem.status === 'published' ? '#DCFCE7' : '#FEF3C7',
                  color: previewItem.status === 'published' ? '#166534' : '#92400E',
                  border: previewItem.status === 'published' ? '1px solid #86EFAC' : '1px solid #FDE68A'
                }}
              >
                <span style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: previewItem.status === 'published' ? '#16A34A' : '#D97706'
                }} />
                {previewItem.status === 'published' ? 'Đã công bố trên website' : 'Bản nháp'}
              </span>
            </div>

            <div className="org-modal-body" style={{ maxHeight: 'calc(75vh - 220px)' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem', marginBottom: '0.75rem' }}>
                <div>
                  <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#13241F', margin: '0 0 4px 0' }}>
                    {previewItem.name}
                  </h2>
                  <div style={{ fontSize: '0.84rem', color: '#6B7280', fontStyle: 'italic' }}>
                    {previewItem.nameEn}
                  </div>
                </div>
                <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#B48A3C', background: 'rgba(180, 138, 60, 0.12)', padding: '4px 10px', borderRadius: 6 }}>
                  {previewItem.code}
                </span>
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', padding: '0.75rem 0', borderTop: '1px solid #F3F4F6', borderBottom: '1px solid #F3F4F6', marginBottom: '1rem', fontSize: '0.82rem', color: '#4B5563' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <MapPin size={15} color="#13241F" />
                  <span>{previewItem.address}</span>
                </div>
                {previewItem.period && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Calendar size={15} color="#13241F" />
                    <span>Thời kỳ: <strong>{previewItem.period}</strong></span>
                  </div>
                )}
                {previewItem.category && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Layers size={15} color="#13241F" />
                    <span>Phân loại: <strong>{previewItem.category}</strong></span>
                  </div>
                )}
              </div>

              {previewItem.briefDesc && (
                <div style={{ marginBottom: '1rem' }}>
                  <h4 style={{ fontSize: '0.85rem', fontWeight: 700, color: '#13241F', margin: '0 0 4px 0' }}>
                    Tóm tắt điểm nhấn
                  </h4>
                  <p style={{ fontSize: '0.84rem', color: '#4B5563', lineHeight: 1.5, margin: 0 }}>
                    {previewItem.briefDesc}
                  </p>
                </div>
              )}

              <div>
                <h4 style={{ fontSize: '0.85rem', fontWeight: 700, color: '#13241F', margin: '0 0 6px 0' }}>
                  Câu chuyện lịch sử & văn hóa
                </h4>
                <p style={{ fontSize: '0.84rem', color: '#4B5563', lineHeight: 1.6, margin: 0, whiteSpace: 'pre-line' }}>
                  {previewItem.story}
                </p>
              </div>
            </div>

            <div className="org-modal-footer">
              <button
                type="button"
                className="btn-org-secondary"
                onClick={() => {
                  const itemToEdit = previewItem;
                  setPreviewItem(null);
                  handleOpenEdit(itemToEdit);
                }}
                style={{ display: 'flex', alignItems: 'center', gap: 6 }}
              >
                <Edit3 size={14} />
                <span>Chỉnh sửa</span>
              </button>

              <a
                href={`/di-san/${encodeURIComponent(previewItem.id)}`}
                target="_blank"
                rel="noreferrer"
                className="btn-org-primary"
                style={{ display: 'flex', alignItems: 'center', gap: 6, textDecoration: 'none' }}
              >
                <span>Xem trên trang công khai</span>
                <ExternalLink size={14} />
              </a>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 2. EDIT / CREATE MODAL (Chỉnh sửa / Thêm mới di sản) */}
      {/* ======================================================== */}
      {(editingItem || isCreating) && (
        <div className="org-modal-backdrop" onClick={() => { setEditingItem(null); setIsCreating(false); }}>
          <div className="org-modal-box" style={{ maxWidth: 680 }} onClick={e => e.stopPropagation()}>
            <div className="org-modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Edit3 size={18} color="#13241F" />
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#13241F' }}>
                  {isCreating ? 'Thêm điểm di sản văn hóa mới' : `Chỉnh sửa nội dung di sản: ${editingItem?.name}`}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => { setEditingItem(null); setIsCreating(false); }}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#9CA3AF' }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={isCreating ? handleSaveCreate : handleSaveEdit}>
              <div className="org-modal-body">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                  {/* Tên di sản */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: 5 }}>
                      Tên điểm di sản (Tiếng Việt) *
                    </label>
                    <input
                      type="text"
                      required
                      value={formName}
                      onChange={e => setFormName(e.target.value)}
                      placeholder="Ví dụ: Bưu điện Trung tâm Sài Gòn"
                      style={{ width: '100%', padding: '8px 12px', borderRadius: 7, border: '1px solid #D1D5DB', fontSize: '0.85rem' }}
                    />
                  </div>

                  {/* Mã di sản */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: 5 }}>
                      Mã định danh (Code) *
                    </label>
                    <input
                      type="text"
                      required
                      value={formCode}
                      onChange={e => setFormCode(e.target.value)}
                      placeholder="Ví dụ: DS-01"
                      style={{ width: '100%', padding: '8px 12px', borderRadius: 7, border: '1px solid #D1D5DB', fontSize: '0.85rem' }}
                    />
                  </div>

                  {/* Tên tiếng Anh */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: 5 }}>
                      Tên tiếng Anh (English Name)
                    </label>
                    <input
                      type="text"
                      value={formNameEn}
                      onChange={e => setFormNameEn(e.target.value)}
                      placeholder="e.g. Saigon Central Post Office"
                      style={{ width: '100%', padding: '8px 12px', borderRadius: 7, border: '1px solid #D1D5DB', fontSize: '0.85rem' }}
                    />
                  </div>

                  {/* Thời kỳ lịch sử */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: 5 }}>
                      Thời kỳ lịch sử
                    </label>
                    <input
                      type="text"
                      value={formPeriod}
                      onChange={e => setFormPeriod(e.target.value)}
                      placeholder="Ví dụ: Cuối thế kỷ XIX (1886 - 1891)"
                      style={{ width: '100%', padding: '8px 12px', borderRadius: 7, border: '1px solid #D1D5DB', fontSize: '0.85rem' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: 5 }}>
                      Phân loại di sản
                    </label>
                    <input
                      type="text"
                      value={formCategory}
                      onChange={e => setFormCategory(e.target.value)}
                      placeholder="Ví dụ: Kiến trúc, lịch sử"
                      style={{ width: '100%', padding: '8px 12px', borderRadius: 7, border: '1px solid #D1D5DB', fontSize: '0.85rem' }}
                    />
                  </div>
                </div>

                {/* Địa chỉ */}
                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: 5 }}>
                    Địa chỉ vị trí *
                  </label>
                  <input
                    type="text"
                    required
                    value={formAddress}
                    onChange={e => setFormAddress(e.target.value)}
                    placeholder="Ví dụ: 02 Công xã Paris, Bến Nghé, Quận 1, TP.HCM"
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 7, border: '1px solid #D1D5DB', fontSize: '0.85rem' }}
                  />
                </div>

                {/* URL hình ảnh & Tải ảnh lên */}
                <div style={{ marginBottom: '1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 }}>
                    <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#374151', margin: 0 }}>
                      Đường dẫn hình ảnh bìa (Image URL)
                    </label>
                    <label 
                      className="btn-org-secondary" 
                      style={{ 
                        padding: '0.25rem 0.6rem', 
                        fontSize: '0.75rem', 
                        cursor: 'pointer', 
                        display: 'inline-flex', 
                        alignItems: 'center', 
                        gap: '0.35rem',
                        background: '#FFFFFF',
                        border: '1px solid #D1D5DB',
                        borderRadius: '6px',
                        color: '#17382E',
                        fontWeight: 650
                      }}
                      title="Chọn ảnh từ máy tính"
                    >
                      <Upload size={12} />
                      <span>Tải ảnh lên</span>
                      <input
                        type="file"
                        accept="image/*"
                        style={{ display: 'none' }}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const reader = new FileReader();
                            reader.onload = (evt) => {
                              if (typeof evt.target?.result === 'string') {
                                setFormImageUrl(evt.target.result);
                              }
                            };
                            reader.readAsDataURL(file);
                          }
                        }}
                      />
                    </label>
                  </div>
                  <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                    <input
                      type="text"
                      value={formImageUrl}
                      onChange={e => setFormImageUrl(e.target.value)}
                      placeholder="https://... hoặc dán liên kết ảnh"
                      style={{ flex: 1, padding: '8px 12px', borderRadius: 7, border: '1px solid #D1D5DB', fontSize: '0.85rem' }}
                    />
                    {formImageUrl && (
                      <img 
                        src={formImageUrl} 
                        alt="Preview" 
                        style={{ width: 42, height: 42, borderRadius: 6, objectFit: 'cover', border: '1px solid #E5E7EB', flexShrink: 0 }} 
                        onError={(e) => { (e.currentTarget as HTMLElement).style.display = 'none'; }}
                      />
                    )}
                  </div>
                </div>

                {/* Tóm tắt ngắn */}
                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: 5 }}>
                    Tóm tắt ngắn (Brief Description)
                  </label>
                  <input
                    type="text"
                    value={formBrief}
                    onChange={e => setFormBrief(e.target.value)}
                    placeholder="Tóm tắt 1-2 câu về di sản..."
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 7, border: '1px solid #D1D5DB', fontSize: '0.85rem' }}
                  />
                </div>

                {/* Câu chuyện lịch sử chi tiết */}
                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: 5 }}>
                    Câu chuyện lịch sử chi tiết (Story) *
                  </label>
                  <textarea
                    required
                    rows={4}
                    value={formStory}
                    onChange={e => setFormStory(e.target.value)}
                    placeholder="Nội dung lịch sử, kiến trúc và giá trị văn hóa gắn liền với địa danh..."
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 7, border: '1px solid #D1D5DB', fontSize: '0.85rem', resize: 'vertical' }}
                  />
                </div>

                {/* Trạng thái xuất bản */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: 5 }}>
                    Trạng thái xuất bản
                  </label>
                  <div style={{ display: 'flex', gap: '1.25rem' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.85rem', cursor: 'pointer' }}>
                      <input
                        type="radio"
                        name="heritageStatus"
                        value="published"
                        checked={formStatus === 'published'}
                        onChange={() => setFormStatus('published')}
                      />
                      <span>Công bố hiển thị trên website</span>
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.85rem', cursor: 'pointer' }}>
                      <input
                        type="radio"
                        name="heritageStatus"
                        value="draft"
                        checked={formStatus === 'draft'}
                        onChange={() => setFormStatus('draft')}
                      />
                      <span>Lưu bản nháp nội bộ</span>
                    </label>
                  </div>
                </div>
              </div>

              <div className="org-modal-footer">
                <button
                  type="button"
                  onClick={() => { setEditingItem(null); setIsCreating(false); }}
                  style={{
                    padding: '7px 16px',
                    borderRadius: 6,
                    border: '1px solid #D1D5DB',
                    background: '#FFFFFF',
                    color: '#4B5563',
                    fontSize: '0.82rem',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="btn-org-primary"
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 18px', borderRadius: 6, fontSize: '0.82rem', fontWeight: 600 }}
                >
                  <Check size={14} />
                  <span>{isCreating ? 'Tạo điểm di sản' : 'Lưu cập nhật'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 3. DELETE CONFIRMATION MODAL */}
      {/* ======================================================== */}
      {deletingId && (
        <div className="org-modal-backdrop" onClick={() => setDeletingId(null)}>
          <div className="org-modal-box" style={{ maxWidth: 400 }} onClick={e => e.stopPropagation()}>
            <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #E5E7EB' }}>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#13241F', margin: 0 }}>
                Xác nhận xóa điểm di sản
              </h3>
            </div>
            <div style={{ padding: '1.25rem 1.5rem', fontSize: '0.86rem', color: '#4B5563', lineHeight: 1.5 }}>
              Bạn có chắc chắn muốn xóa điểm di sản này khỏi danh sách công khai của Đường Sách? Hành động này sẽ gỡ bỏ thẻ hiển thị trên website.
            </div>
            <div style={{ padding: '0.85rem 1.5rem', background: '#F9FAFB', borderTop: '1px solid #E5E7EB', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button
                type="button"
                onClick={() => setDeletingId(null)}
                style={{
                  padding: '7px 14px',
                  borderRadius: 6,
                  border: '1px solid #D1D5DB',
                  background: '#FFFFFF',
                  color: '#374151',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                style={{
                  padding: '7px 16px',
                  borderRadius: 6,
                  border: 'none',
                  background: '#EF4444',
                  color: '#FFFFFF',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Xác nhận xóa
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Banner */}
      {toastMessage && (
        <div className="org-toast-banner">
          <Check size={16} color="#E9BC63" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
};
