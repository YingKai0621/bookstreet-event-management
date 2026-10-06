import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { 
  Store, 
  MapPin, 
  Layers, 
  CheckCircle2, 
  AlertCircle, 
  Map, 
  RefreshCw, 
  XCircle, 
  FileText, 
  Image as ImageIcon, 
  X,
  Send,
  Edit3,
  Check,
  Plus,
  Trash2,
  Upload,
  UploadCloud,
  Paperclip
} from 'lucide-react';
import { Language, PartnerBooth } from '../../types';
import { partnerApi } from '../../services/partnerApi';
import './PartnerPages.css';

interface BoothImageItem {
  id: string;
  url: string;
  caption: string;
}

interface BoothDocItem {
  id: string;
  name: string;
  size: string;
  dataUrl?: string;
}

export interface BoothManagementPageProps {
  language: Language;
  booth?: PartnerBooth | null;
  onOpenAttendanceModal?: () => void;
  onRequestChange?: (reason?: string) => void | Promise<unknown>;
  onRequestCancel?: (reason?: string) => void | Promise<unknown>;
}

export const BoothManagementPage: React.FC<BoothManagementPageProps> = ({
  language,
  booth: initialBooth,
  onOpenAttendanceModal,
  onRequestChange,
  onRequestCancel,
}) => {
  const navigate = useNavigate();
  const [booth, setBooth] = useState<PartnerBooth | null>(initialBooth || null);
  const [activeTab, setActiveTab] = useState<'info' | 'images' | 'documents'>('info');
  const [isEditing, setIsEditing] = useState(false);
  const [modalType, setModalType] = useState<'none' | 'change' | 'cancel'>('none');
  const [requestReason, setRequestReason] = useState('');
  const [requestSubmitted, setRequestSubmitted] = useState(false);

  // Tab 1: Info State
  const [editName, setEditName] = useState(initialBooth?.name || '');
  const [editDescription, setEditDescription] = useState(initialBooth?.description || '');
  const [editDimensions, setEditDimensions] = useState(initialBooth?.dimensions || '');
  const [editAreaName, setEditAreaName] = useState(initialBooth?.areaName || '');
  const [editCategories, setEditCategories] = useState<string[]>(initialBooth?.categories || []);
  const [newCatInput, setNewCatInput] = useState('');

  // Tab 2: Images State
  const [boothImages, setBoothImages] = useState<BoothImageItem[]>(initialBooth?.imageUrl ? [
    { id: `booth:${initialBooth.id}`, url: initialBooth.imageUrl, caption: initialBooth.name }
  ] : []);
  const [newImageUrl, setNewImageUrl] = useState('');
  const [newImageCaption, setNewImageCaption] = useState('');

  // Tab 4: Documents State
  const [boothDocs, setBoothDocs] = useState<BoothDocItem[]>([]);
  const [newDocName, setNewDocName] = useState('');
  const [newDocSize, setNewDocSize] = useState('1.5 MB');

  // Toast notification state
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  useEffect(() => {
    if (!initialBooth) return;
    setBooth(initialBooth);
    partnerApi.getBoothContent(initialBooth.id).then(content => {
      setBooth(current => current ? ({
        ...current,
        name: content.name || current.name,
        description: content.description || '',
        dimensions: content.dimensions || current.dimensions,
        areaName: content.areaName || current.areaName,
        categories: content.categories || [],
        imageUrl: content.images?.[0]?.url || current.imageUrl,
      }) : null);
      setBoothImages(content.images || []);
      setBoothDocs(content.documents || []);
    }).catch(error => showToast(error instanceof Error ? error.message : 'Không tải được nội dung gian hàng'));
  }, [initialBooth?.id]);

  if (!booth) {
    return (
      <div className="partner-page">
        <div className="partner-page-header">
          <h1 className="partner-page-title">
            {language === 'vi' ? 'Quản lý gian hàng' : 'Booth Management'}
          </h1>
          <p className="partner-page-sub">
            {language === 'vi'
              ? 'Theo dõi thông tin gian hàng được phân bổ, trưng bày ấn phẩm và gửi yêu cầu đến Ban Quản Lý.'
              : 'Manage assigned booth information, exhibition materials, and requests to Organizer.'}
          </p>
        </div>

        <div className="partner-card" style={{ padding: '3rem 2rem', textAlign: 'center', maxWidth: '780px', margin: '0 auto' }}>
          <div style={{
            width: '76px',
            height: '76px',
            borderRadius: '50%',
            background: 'rgba(212, 163, 89, 0.14)',
            border: '2px dashed #D4A359',
            display: 'grid',
            placeItems: 'center',
            margin: '0 auto 1.25rem',
            color: '#B3862A'
          }}>
            <Store size={36} />
          </div>

          <div style={{
            fontSize: '0.78rem',
            fontWeight: 800,
            letterSpacing: '1.5px',
            color: '#8C6519',
            textTransform: 'uppercase',
            marginBottom: '0.4rem'
          }}>
            {language === 'vi' ? 'TRẠNG THÁI PHÂN BỔ GIAN HÀNG' : 'ALLOCATION STATUS'}
          </div>

          <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.45rem', color: '#172421', margin: '0 0 0.65rem 0' }}>
            {language === 'vi' ? 'Chưa có gian hàng được phân bổ' : 'No Booth Assigned Yet'}
          </h2>

          <p style={{ fontSize: '0.92rem', color: '#556B65', maxWidth: '580px', margin: '0 auto 2rem', lineHeight: 1.6 }}>
            {language === 'vi'
              ? 'Tổ chức của bạn hiện chưa được phân bổ gian hàng chính thức. Sau khi hồ sơ tham gia sự kiện được Ban Quản Lý xét duyệt, vị trí gian hàng sẽ được cập nhật tự động tại đây.'
              : 'Your organization does not have an assigned booth for this event yet. Once your event application is approved, booth details will appear here.'}
          </p>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '1rem',
            textAlign: 'left',
            marginBottom: '2rem'
          }}>
            <div style={{ background: '#FAF8F5', border: '1px solid #EAE5DC', borderRadius: '10px', padding: '1rem' }}>
              <div style={{ fontSize: '0.74rem', fontWeight: 800, color: '#8C6519', marginBottom: '0.25rem' }}>BƯỚC 1</div>
              <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#172421', marginBottom: '0.25rem' }}>Nộp hồ sơ sự kiện</div>
              <div style={{ fontSize: '0.8rem', color: '#637771' }}>Đăng ký tham gia sự kiện văn hóa đang mở.</div>
            </div>

            <div style={{ background: '#FAF8F5', border: '1px solid #EAE5DC', borderRadius: '10px', padding: '1rem' }}>
              <div style={{ fontSize: '0.74rem', fontWeight: 800, color: '#8C6519', marginBottom: '0.25rem' }}>BƯỚC 2</div>
              <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#172421', marginBottom: '0.25rem' }}>Phê duyệt & Phân bổ</div>
              <div style={{ fontSize: '0.8rem', color: '#637771' }}>Ban Quản Lý xét duyệt và chỉ định vị trí.</div>
            </div>

            <div style={{ background: '#FAF8F5', border: '1px solid #EAE5DC', borderRadius: '10px', padding: '1rem' }}>
              <div style={{ fontSize: '0.74rem', fontWeight: 800, color: '#8C6519', marginBottom: '0.25rem' }}>BƯỚC 3</div>
              <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#172421', marginBottom: '0.25rem' }}>Quản lý gian hàng</div>
              <div style={{ fontSize: '0.8rem', color: '#637771' }}>Cập nhật hình ảnh, tài liệu và ấn phẩm.</div>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', flexWrap: 'wrap' }}>
            <Link to="/partner/booths/select" className="btn-part-primary" style={{ textDecoration: 'none' }}>
              <Map size={16} />
              <span>{language === 'vi' ? 'Xem sơ đồ & chọn gian hàng' : 'View Map & Select Booth'}</span>
            </Link>
            <Link to="/partner/events" className="btn-part-secondary" style={{ textDecoration: 'none' }}>
              <FileText size={16} />
              <span>{language === 'vi' ? 'Theo dõi hồ sơ sự kiện' : 'Track Event Applications'}</span>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const handleStartEdit = () => {
    setEditName(booth.name);
    setEditDescription(booth.description);
    setEditDimensions(booth.dimensions);
    setEditAreaName(booth.areaName);
    setEditCategories([...booth.categories]);
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setEditName(booth.name);
    setEditDescription(booth.description);
    setEditDimensions(booth.dimensions);
    setEditAreaName(booth.areaName);
    setEditCategories([...booth.categories]);
    setIsEditing(false);
  };

  const handleAddCategory = () => {
    if (newCatInput.trim() && !editCategories.includes(newCatInput.trim())) {
      setEditCategories(prev => [...prev, newCatInput.trim()]);
      setNewCatInput('');
    }
  };

  const handleRemoveCategory = (catToRemove: string) => {
    setEditCategories(prev => prev.filter(c => c !== catToRemove));
  };

  const handleSaveInfo = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const saved = await partnerApi.updateBoothContent(booth.id, {
      name: editName.trim() || booth.name,
      description: editDescription.trim() || booth.description,
      dimensions: editDimensions.trim() || booth.dimensions,
      areaName: editAreaName.trim() || booth.areaName,
      categories: editCategories.length > 0 ? editCategories : booth.categories
      });
      setBooth(prev => prev ? ({ ...prev, name: saved.name, description: saved.description, dimensions: saved.dimensions, areaName: saved.areaName, categories: saved.categories }) : null);
      setIsEditing(false);
      showToast(language === 'vi' ? 'Đã lưu thay đổi thông tin gian hàng thành công!' : 'Booth info updated successfully!');
      window.dispatchEvent(new Event('duongsach:data-changed'));
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Không thể lưu thông tin gian hàng');
    }
  };

  // Image actions
  const handleAddImage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newImageUrl.trim()) return;
    const next = [...boothImages, { id: `img-${Date.now()}`, url: newImageUrl.trim(), caption: newImageCaption.trim() || 'Hình ảnh gian hàng' }];
    try {
      await partnerApi.updateBoothContent(booth.id, { images: next });
      setBoothImages(next); setNewImageUrl(''); setNewImageCaption('');
      showToast(language === 'vi' ? 'Đã thêm hình ảnh mới!' : 'New photo added!');
    } catch (error) { showToast(error instanceof Error ? error.message : 'Không thể thêm hình ảnh'); }
  };

  const handleImageFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const additions = await Promise.all(Array.from(files).map((file, index) => new Promise<BoothImageItem>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = event => resolve({ id: `img-${Date.now()}-${index}`, url: String(event.target?.result || ''), caption: file.name.replace(/\.[^/.]+$/, '') || 'Ảnh tải từ thiết bị' });
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    })));
    try {
      const next = [...boothImages, ...additions];
      await partnerApi.updateBoothContent(booth.id, { images: next });
      setBoothImages(next);
      showToast(language === 'vi' ? `Đã tải lên ${files.length} hình ảnh từ máy!` : `Uploaded ${files.length} images!`);
    } catch (error) { showToast(error instanceof Error ? error.message : 'Không thể tải hình ảnh'); }
    e.target.value = '';
  };

  const handleRemoveImage = async (id: string) => {
    const next = boothImages.filter(img => img.id !== id);
    try { await partnerApi.updateBoothContent(booth.id, { images: next }); setBoothImages(next); }
    catch (error) { showToast(error instanceof Error ? error.message : 'Không thể xóa hình ảnh'); }
  };

  // Document actions
  const handleAddDoc = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDocName.trim()) return;
    const next = [...boothDocs, {
        id: `doc-${Date.now()}`,
        name: newDocName.trim().endsWith('.pdf') ? newDocName.trim() : `${newDocName.trim()}.pdf`,
        size: newDocSize || '1.0 MB'
      }];
    try { await partnerApi.updateBoothContent(booth.id, { documents: next }); setBoothDocs(next); setNewDocName(''); showToast(language === 'vi' ? 'Đã lưu tài liệu mới!' : 'Document added!'); }
    catch (error) { showToast(error instanceof Error ? error.message : 'Không thể lưu tài liệu'); }
  };

  const handleDocFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const additions = await Promise.all(Array.from(files).map((file, index) => new Promise<BoothDocItem>((resolve, reject) => {
      const sizeInMB = (file.size / (1024 * 1024)).toFixed(1);
      const sizeStr = parseFloat(sizeInMB) >= 0.1 ? `${sizeInMB} MB` : `${Math.round(file.size / 1024)} KB`;
      const reader = new FileReader();
      reader.onload = event => resolve({ id: `doc-${Date.now()}-${index}`, name: file.name, size: sizeStr, dataUrl: String(event.target?.result || '') });
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    })));
    try { const next = [...boothDocs, ...additions]; await partnerApi.updateBoothContent(booth.id, { documents: next }); setBoothDocs(next); showToast(language === 'vi' ? `Đã lưu ${files.length} tài liệu!` : `Uploaded ${files.length} files!`); }
    catch (error) { showToast(error instanceof Error ? error.message : 'Không thể lưu tài liệu'); }
    e.target.value = '';
  };

  const handleRemoveDoc = async (id: string) => {
    const next = boothDocs.filter(d => d.id !== id);
    try { await partnerApi.updateBoothContent(booth.id, { documents: next }); setBoothDocs(next); }
    catch (error) { showToast(error instanceof Error ? error.message : 'Không thể xóa tài liệu'); }
  };

  const handleSubmitRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (modalType === 'change' && onRequestChange) {
        await onRequestChange(requestReason);
      } else if (modalType === 'cancel' && onRequestCancel) {
        await onRequestCancel(requestReason);
      }
      setRequestSubmitted(true);
      setTimeout(() => {
        setRequestSubmitted(false);
        setModalType('none');
        setRequestReason('');
      }, 2000);
      window.dispatchEvent(new Event('duongsach:data-changed'));
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Không thể gửi yêu cầu');
    }
  };

  return (
    <div className="booth-management-page">
      {/* Toast Notification */}
      {toastMessage && (
        <div style={{
          position: 'fixed',
          top: '24px',
          right: '24px',
          background: '#17382E',
          color: '#FFFFFF',
          padding: '0.85rem 1.35rem',
          borderRadius: '12px',
          boxShadow: '0 12px 36px rgba(0,0,0,0.3)',
          zIndex: 99999,
          fontSize: '0.92rem',
          fontWeight: 650,
          display: 'flex',
          alignItems: 'center',
          gap: '0.65rem',
          border: '1.5px solid #E9BC63',
          animation: 'fadeIn 0.2s ease'
        }}>
          <CheckCircle2 size={20} color="#E9BC63" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* 1. Header matching Sketch Screen 4 */}
      <div className="partner-page-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.35rem' }}>
            <h1 className="partner-page-title" style={{ margin: 0 }}>
              {language === 'vi' ? 'Thông tin gian hàng' : 'Booth Details'}
            </h1>
          </div>
          <p className="partner-page-sub">
            {language === 'vi' 
              ? 'Quản lý thông tin gian hàng chính thức của tổ chức tại sự kiện.' 
              : 'Manage assigned booth information and operational resources.'}
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn-part-secondary"
            onClick={() => navigate('/partner/booths/select')}
          >
            <Map size={15} />
            <span>{language === 'vi' ? 'Xem trên bản đồ' : 'View on Map'}</span>
          </button>
          
          <button
            type="button"
            className="btn-part-primary"
            onClick={() => {
              if (isEditing) {
                handleCancelEdit();
              } else {
                handleStartEdit();
              }
            }}
          >
            <Edit3 size={15} />
            <span>{isEditing ? (language === 'vi' ? 'Hủy chỉnh sửa' : 'Cancel') : (language === 'vi' ? 'Chỉnh sửa' : 'Edit Booth')}</span>
          </button>
        </div>
      </div>

      {/* 2. Booth Detail Card matching Sketch Screen 4 */}
      <div className="booth-detail-card">
        <div>
          <img 
            src={booth.imageUrl} 
            alt={booth.name} 
            className="booth-photo-preview"
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
              <span style={{ fontFamily: 'var(--font-serif)', fontSize: '2rem', fontWeight: 800, color: '#172421' }}>
                {booth.code}
              </span>
              <span style={{ fontSize: '1.1rem', fontWeight: 700, color: '#495D57' }}>
                • {booth.name}
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', fontSize: '0.88rem', color: '#556B65' }}>
              <div>
                <strong>{language === 'vi' ? 'Diện tích:' : 'Size:'}</strong> {booth.dimensions}
              </div>
              <div>
                <strong>{language === 'vi' ? 'Khu vực:' : 'Area:'}</strong> {booth.areaName} ({booth.zone})
              </div>
              <div>
                <strong>{language === 'vi' ? 'Sự kiện:' : 'Event:'}</strong> {booth.relatedEventTitle}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '1.5rem', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn-part-secondary"
              onClick={() => navigate('/partner/booths/select')}
            >
              <Map size={15} />
              <span>{language === 'vi' ? 'Xem trên bản đồ' : 'View on Map'}</span>
            </button>
            <button
              type="button"
              className="btn-part-secondary"
              onClick={() => setModalType('change')}
            >
              <RefreshCw size={15} />
              <span>{language === 'vi' ? 'Yêu cầu đổi gian hàng' : 'Request Change'}</span>
            </button>
            <button
              type="button"
              className="btn-part-danger"
              onClick={() => setModalType('cancel')}
            >
              <XCircle size={15} />
              <span>{language === 'vi' ? 'Yêu cầu hủy gian hàng' : 'Request Cancellation'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* 3. Tabs Navigation matching Sketch Screen 4 */}
      <div style={{ background: '#FFFFFF', border: '1px solid #E2EAE5', borderRadius: '14px', padding: '1.75rem' }}>
        <div className="partner-tabs-bar">
          <button
            type="button"
            className={`partner-tab-btn ${activeTab === 'info' ? 'is-active' : ''}`}
            onClick={() => setActiveTab('info')}
          >
            {language === 'vi' ? 'Thông tin chung' : 'General Info'}
          </button>
          <button
            type="button"
            className={`partner-tab-btn ${activeTab === 'images' ? 'is-active' : ''}`}
            onClick={() => setActiveTab('images')}
          >
            {language === 'vi' ? 'Hình ảnh' : 'Images'}
          </button>
          <button
            type="button"
            className={`partner-tab-btn ${activeTab === 'documents' ? 'is-active' : ''}`}
            onClick={() => setActiveTab('documents')}
          >
            {language === 'vi' ? 'Tài liệu' : 'Documents'}
          </button>
        </div>

        {/* Tab 1: General Info */}
        {activeTab === 'info' && (
          isEditing ? (
            <form onSubmit={handleSaveInfo} style={{ maxWidth: '780px' }}>
              <div className="form-field-group">
                <label>{language === 'vi' ? 'Tên gian hàng *' : 'Booth Name *'}</label>
                <input 
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="Ví dụ: Gian B03 - Không gian nghệ thuật"
                />
              </div>

              <div className="form-row-2col">
                <div className="form-field-group">
                  <label>{language === 'vi' ? 'Kích thước / Diện tích *' : 'Dimensions *'}</label>
                  <input 
                    type="text"
                    required
                    value={editDimensions}
                    onChange={(e) => setEditDimensions(e.target.value)}
                    placeholder="3m x 3m"
                  />
                </div>
                <div className="form-field-group">
                  <label>{language === 'vi' ? 'Khu vực trưng bày *' : 'Area Name *'}</label>
                  <input 
                    type="text"
                    required
                    value={editAreaName}
                    onChange={(e) => setEditAreaName(e.target.value)}
                    placeholder="Ấn phẩm nghệ thuật"
                  />
                </div>
              </div>

              <div className="form-field-group">
                <label>{language === 'vi' ? 'Mô tả gian hàng *' : 'Booth Description *'}</label>
                <textarea 
                  rows={3}
                  required
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  placeholder="Mô tả nội dung, sách hoặc ấn phẩm trưng bày tại gian hàng..."
                />
              </div>

              {/* Danh mục ngành hàng trưng bày */}
              <div className="form-field-group">
                <label>{language === 'vi' ? 'Danh mục ngành hàng trưng bày' : 'Display Categories'}</label>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.65rem' }}>
                  {editCategories.map((cat, idx) => (
                    <span
                      key={idx}
                      style={{
                        backgroundColor: '#FAF8F3',
                        border: '1px solid #EFE8D8',
                        color: '#8C6519',
                        fontSize: '0.82rem',
                        fontWeight: 600,
                        padding: '0.35rem 0.75rem',
                        borderRadius: '20px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.35rem'
                      }}
                    >
                      <span>{cat}</span>
                      <X 
                        size={13} 
                        style={{ cursor: 'pointer', opacity: 0.7 }}
                        onClick={() => handleRemoveCategory(cat)}
                      />
                    </span>
                  ))}
                </div>

                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <input 
                    type="text"
                    value={newCatInput}
                    onChange={(e) => setNewCatInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddCategory();
                      }
                    }}
                    placeholder="Thêm danh mục mới (Enter hoặc bấm +)..."
                    style={{ flex: 1 }}
                  />
                  <button
                    type="button"
                    className="btn-part-secondary"
                    onClick={handleAddCategory}
                    style={{ padding: '0 0.85rem' }}
                  >
                    <Plus size={15} />
                    <span>Thêm</span>
                  </button>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem', borderTop: '1px solid #EEF2F0', paddingTop: '1.25rem' }}>
                <button 
                  type="button" 
                  className="btn-part-secondary"
                  onClick={handleCancelEdit}
                >
                  {language === 'vi' ? 'Hủy' : 'Cancel'}
                </button>
                <button type="submit" className="btn-part-primary">
                  <Check size={16} />
                  <span>{language === 'vi' ? 'Lưu thay đổi' : 'Save Changes'}</span>
                </button>
              </div>
            </form>
          ) : (
            <div>
              <div style={{ marginBottom: '1.5rem' }}>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#172421', marginBottom: '0.65rem' }}>
                  {language === 'vi' ? 'Mô tả gian hàng' : 'Booth Description'}
                </h3>
                <p style={{ color: '#495D57', lineHeight: 1.6, fontSize: '0.9rem', margin: 0, maxWidth: '800px' }}>
                  {booth.description}
                </p>
              </div>

              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#172421', marginBottom: '0.65rem' }}>
                {language === 'vi' ? 'Danh mục ngành hàng trưng bày' : 'Display Categories'}
              </h3>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                {booth.categories.map((cat, idx) => (
                  <span
                    key={idx}
                    style={{
                      backgroundColor: '#FAF8F3',
                      border: '1px solid #EFE8D8',
                      color: '#8C6519',
                      fontSize: '0.82rem',
                      fontWeight: 600,
                      padding: '0.35rem 0.85rem',
                      borderRadius: '20px'
                    }}
                  >
                    {cat}
                  </span>
                ))}
              </div>
            </div>
          )
        )}

        {/* Tab 2: Images */}
        {activeTab === 'images' && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.5rem' }}>
              <p style={{ color: '#556B65', fontSize: '0.88rem', margin: 0 }}>
                {language === 'vi' ? `Hình ảnh phối cảnh và hình thực tế của gian hàng (${boothImages.length} ảnh).` : 'Booth rendering and setup photos.'}
              </p>
            </div>

            {/* List of images */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '1.25rem', marginBottom: '1.5rem' }}>
              {boothImages.map(img => (
                <div 
                  key={img.id} 
                  style={{
                    position: 'relative',
                    borderRadius: '12px',
                    overflow: 'hidden',
                    border: '1px solid #E2EAE5',
                    background: '#FAF8F3',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.03)'
                  }}
                >
                  <img 
                    src={img.url} 
                    alt={img.caption} 
                    style={{ width: '100%', height: '170px', objectFit: 'cover' }} 
                  />
                  <div style={{ padding: '0.75rem', fontSize: '0.84rem', fontWeight: 650, color: '#172421' }}>
                    {img.caption}
                  </div>

                  {isEditing && (
                    <button
                      type="button"
                      onClick={() => handleRemoveImage(img.id)}
                      title="Xóa hình ảnh này"
                      style={{
                        position: 'absolute',
                        top: '8px',
                        right: '8px',
                        background: 'rgba(220, 38, 38, 0.9)',
                        color: '#FFFFFF',
                        border: 'none',
                        borderRadius: '50%',
                        width: '28px',
                        height: '28px',
                        display: 'grid',
                        placeItems: 'center',
                        cursor: 'pointer',
                        boxShadow: '0 2px 6px rgba(0,0,0,0.2)'
                      }}
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              ))}
            </div>

            {/* Form & Upload hình ảnh khi đang ở chế độ chỉnh sửa */}
            {isEditing && (
              <div style={{ background: '#FAF8F3', border: '1px solid #EAE0CE', borderRadius: '12px', padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 750, color: '#172421', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <ImageIcon size={16} color="#B3862A" />
                    <span>{language === 'vi' ? 'Thêm hình ảnh gian hàng mới' : 'Add New Booth Image'}</span>
                  </h4>
                </div>

                {/* Upload từ máy tính / thiết bị */}
                <label 
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.5rem',
                    padding: '1.5rem 1rem',
                    border: '2px dashed #B3862A',
                    borderRadius: '10px',
                    background: '#FFFFFF',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    textAlign: 'center'
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#FBF8F1')}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#FFFFFF')}
                >
                  <input 
                    type="file" 
                    accept="image/*" 
                    multiple
                    style={{ display: 'none' }}
                    onChange={handleImageFileUpload}
                  />
                  <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#FAF8F3', border: '1px solid #EAE0CE', display: 'grid', placeItems: 'center' }}>
                    <UploadCloud size={20} color="#B3862A" />
                  </div>
                  <div>
                    <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#17382E' }}>
                      {language === 'vi' ? 'Bấm vào đây để chọn ảnh từ máy tính' : 'Click to browse images from your device'}
                    </span>
                    <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.78rem', color: '#7E928B' }}>
                      {language === 'vi' ? 'Hỗ trợ PNG, JPG, JPEG, WEBP (Có thể chọn nhiều ảnh cùng lúc)' : 'Supports PNG, JPG, JPEG, WEBP'}
                    </p>
                  </div>
                </label>

                {/* Hoặc nhập URL */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div style={{ flex: 1, height: '1px', background: '#EAE0CE' }} />
                  <span style={{ fontSize: '0.78rem', fontWeight: 650, color: '#8C6519', textTransform: 'uppercase' }}>
                    {language === 'vi' ? 'Hoặc thêm bằng đường dẫn (URL)' : 'Or add via URL'}
                  </span>
                  <div style={{ flex: 1, height: '1px', background: '#EAE0CE' }} />
                </div>

                <form onSubmit={handleAddImage}>
                  <div className="form-row-2col">
                    <div className="form-field-group">
                      <label>{language === 'vi' ? 'Đường dẫn ảnh (URL) *' : 'Image URL *'}</label>
                      <input 
                        type="url" 
                        required 
                        value={newImageUrl} 
                        onChange={(e) => setNewImageUrl(e.target.value)} 
                        placeholder="https://images.unsplash.com/..." 
                      />
                    </div>
                    <div className="form-field-group">
                      <label>{language === 'vi' ? 'Chú thích ảnh' : 'Caption'}</label>
                      <input 
                        type="text" 
                        value={newImageCaption} 
                        onChange={(e) => setNewImageCaption(e.target.value)} 
                        placeholder="Ví dụ: Góc trưng bày sản phẩm chủ đạo" 
                      />
                    </div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.75rem' }}>
                    <button type="submit" className="btn-part-primary" style={{ padding: '0.55rem 1.15rem' }}>
                      <Plus size={15} />
                      <span>{language === 'vi' ? 'Thêm ảnh URL' : 'Add URL Photo'}</span>
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Documents */}
        {activeTab === 'documents' && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
              <p style={{ color: '#556B65', fontSize: '0.88rem', margin: 0 }}>
                {language === 'vi' ? 'Biên bản bàn giao mặt bằng, cam kết PCCC và hồ sơ pháp lý.' : 'Signed booth agreements and fire safety protocols.'}
              </p>
            </div>

            {/* Docs list */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', marginBottom: '1.5rem' }}>
              {boothDocs.map(doc => (
                <div 
                  key={doc.id}
                  style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'space-between',
                    padding: '0.85rem 1rem', 
                    background: '#F8FAF9', 
                    borderRadius: '10px',
                    border: '1px solid #E2EAE5'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                    <FileText size={20} color="#17382E" />
                    <div>
                      <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#172421' }}>{doc.name}</div>
                      <span style={{ fontSize: '0.78rem', color: '#7E928B' }}>Dung lượng: {doc.size}</span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                    <button
                      type="button"
                      className="btn-part-secondary"
                      style={{ padding: '0.35rem 0.75rem', fontSize: '0.78rem' }}
                      onClick={() => showToast(language === 'vi' ? `Đang tải xuống ${doc.name}...` : `Downloading ${doc.name}...`)}
                    >
                      Tải về
                    </button>
                    {isEditing && (
                      <button
                        type="button"
                        onClick={() => handleRemoveDoc(doc.id)}
                        title="Xóa tài liệu này"
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#DC2626',
                          cursor: 'pointer',
                          padding: '4px'
                        }}
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Form & Upload tài liệu khi ở chế độ chỉnh sửa */}
            {isEditing && (
              <div style={{ background: '#FAF8F3', border: '1px solid #EAE0CE', borderRadius: '12px', padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 750, color: '#172421', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <FileText size={16} color="#B3862A" />
                    <span>{language === 'vi' ? 'Đính kèm thêm tài liệu / Biên bản' : 'Attach Document'}</span>
                  </h4>
                </div>

                {/* Upload tập tin từ máy */}
                <label 
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.5rem',
                    padding: '1.5rem 1rem',
                    border: '2px dashed #B3862A',
                    borderRadius: '10px',
                    background: '#FFFFFF',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    textAlign: 'center'
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#FBF8F1')}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#FFFFFF')}
                >
                  <input 
                    type="file" 
                    accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg" 
                    multiple
                    style={{ display: 'none' }}
                    onChange={handleDocFileUpload}
                  />
                  <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#FAF8F3', border: '1px solid #EAE0CE', display: 'grid', placeItems: 'center' }}>
                    <UploadCloud size={20} color="#B3862A" />
                  </div>
                  <div>
                    <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#17382E' }}>
                      {language === 'vi' ? 'Bấm vào đây để tải tập tin tài liệu từ máy tính' : 'Click to browse document files from your device'}
                    </span>
                    <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.78rem', color: '#7E928B' }}>
                      {language === 'vi' ? 'Hỗ trợ PDF, DOC, DOCX, XLSX (Tự động nhận diện tên và dung lượng file)' : 'Supports PDF, DOC, DOCX, XLSX'}
                    </p>
                  </div>
                </label>

                {/* Hoặc nhập thủ công */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div style={{ flex: 1, height: '1px', background: '#EAE0CE' }} />
                  <span style={{ fontSize: '0.78rem', fontWeight: 650, color: '#8C6519', textTransform: 'uppercase' }}>
                    {language === 'vi' ? 'Hoặc nhập thông tin tập tin thủ công' : 'Or enter manually'}
                  </span>
                  <div style={{ flex: 1, height: '1px', background: '#EAE0CE' }} />
                </div>

                <form onSubmit={handleAddDoc}>
                  <div className="form-row-2col">
                    <div className="form-field-group">
                      <label>{language === 'vi' ? 'Tên tập tin tài liệu *' : 'Document Name *'}</label>
                      <input 
                        type="text" 
                        required 
                        value={newDocName} 
                        onChange={(e) => setNewDocName(e.target.value)} 
                        placeholder="Ví dụ: Hop-dong-thue-gian-hang-2026.pdf" 
                      />
                    </div>
                    <div className="form-field-group">
                      <label>{language === 'vi' ? 'Dung lượng ước tính' : 'File Size'}</label>
                      <input 
                        type="text" 
                        value={newDocSize} 
                        onChange={(e) => setNewDocSize(e.target.value)} 
                        placeholder="1.5 MB" 
                      />
                    </div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.75rem' }}>
                    <button type="submit" className="btn-part-primary" style={{ padding: '0.55rem 1.15rem' }}>
                      <Plus size={15} />
                      <span>{language === 'vi' ? 'Thêm tài liệu' : 'Add Document'}</span>
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        )}
      </div>

      {/* MODAL: Request Change or Cancellation */}
      {(modalType === 'change' || modalType === 'cancel') && (
        <div className="attendance-modal-overlay" onClick={() => setModalType('none')}>
          <div className="attendance-modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '520px' }}>
            <div className="attendance-modal-header">
              <h3 style={{ margin: 0, fontSize: '1.15rem', color: '#172421', fontFamily: 'var(--font-serif)' }}>
                {modalType === 'change' 
                  ? (language === 'vi' ? 'Yêu cầu đổi gian hàng' : 'Request Booth Change')
                  : (language === 'vi' ? 'Yêu cầu hủy gian hàng' : 'Request Booth Cancellation')}
              </h3>
              <button 
                type="button" 
                onClick={() => setModalType('none')}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#637771' }}
              >
                <X size={20} />
              </button>
            </div>

            <div className="attendance-modal-body">
              {requestSubmitted ? (
                <div style={{ textAlign: 'center', padding: '1.5rem 0' }}>
                  <CheckCircle2 size={46} color="#059669" style={{ margin: '0 auto 0.75rem' }} />
                  <h4 style={{ margin: '0 0 0.4rem 0', color: '#172421' }}>
                    {language === 'vi' ? 'Yêu cầu đã được gửi thành công!' : 'Request submitted!'}
                  </h4>
                  <p style={{ fontSize: '0.86rem', color: '#556B65' }}>
                    {language === 'vi' 
                      ? 'Ban Quản Lý sẽ xem xét và phản hồi qua mục Thông báo trong vòng 24 giờ.'
                      : 'Management will review and respond within 24 hours.'}
                  </p>
                </div>
              ) : (
                <form onSubmit={handleSubmitRequest}>
                  <p style={{ fontSize: '0.86rem', color: '#556B65', marginBottom: '1rem', lineHeight: 1.5 }}>
                    {modalType === 'change'
                      ? (language === 'vi' 
                          ? 'Vui lòng nêu rõ lý do và vị trí gian hàng bạn mong muốn thay đổi (Ví dụ: Chuyển sang dãy B gần lối đi trung tâm).'
                          : 'Please specify the reason and your preferred alternative zone/booth.')
                      : (language === 'vi'
                          ? 'Lưu ý: Việc hủy gian hàng cần được gửi trước 10 ngày trước lễ hội theo quy chế của Ban Quản Lý.'
                          : 'Please note cancellation policies apply.')}
                  </p>

                  <div className="form-field-group">
                    <label>{language === 'vi' ? 'Lý do yêu cầu *' : 'Reason *'}</label>
                    <textarea 
                      rows={4}
                      required 
                      value={requestReason}
                      onChange={(e) => setRequestReason(e.target.value)}
                      placeholder={language === 'vi' ? 'Nhập lý do chi tiết...' : 'Enter your detailed reason...'}
                    />
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.25rem' }}>
                    <button 
                      type="button" 
                      className="btn-part-secondary"
                      onClick={() => setModalType('none')}
                    >
                      {language === 'vi' ? 'Đóng' : 'Close'}
                    </button>
                    <button type="submit" className="btn-part-primary">
                      <Send size={15} />
                      <span>{language === 'vi' ? 'Gửi yêu cầu' : 'Submit Request'}</span>
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

