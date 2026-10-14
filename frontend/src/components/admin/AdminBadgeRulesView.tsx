import {
  Award,
  BookOpen,
  CheckCircle2,
  Crown,
  Edit2,
  Gift,
  Plus,
  Sprout,
  X
} from 'lucide-react';
import React, { useState } from 'react';
import { AdminBadgeRule } from '../../types/admin';
import { useModalDismiss } from '../../hooks/useModalDismiss';
import { useViewportPagination } from '../../hooks/useViewportPagination';
import { CompactPagination } from '../ui/CompactPagination';

interface AdminBadgeRulesViewProps {
  badgeRules: AdminBadgeRule[];
  onAddBadgeRule: (rule: Omit<AdminBadgeRule, 'id'>) => void;
  onUpdateBadgeRule: (id: string, updates: Partial<AdminBadgeRule>) => void;
  onToggleBadgeStatus: (id: string) => void;
}

export const AdminBadgeRulesView: React.FC<AdminBadgeRulesViewProps> = ({
  badgeRules,
  onAddBadgeRule,
  onUpdateBadgeRule,
  onToggleBadgeStatus
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<AdminBadgeRule | null>(null);
  useModalDismiss(isModalOpen, () => setIsModalOpen(false));
  const pagination = useViewportPagination(badgeRules, 300, 400, 3);

  // Form states
  const [formCode, setFormCode] = useState('');
  const [formName, setFormName] = useState('');
  const [formNameEn, setFormNameEn] = useState('');
  const [formIconType, setFormIconType] = useState<'seedling' | 'book' | 'award' | 'crown'>('seedling');
  const [formThreshold, setFormThreshold] = useState<number>(100);
  const [formStatus, setFormStatus] = useState<'active' | 'inactive'>('active');
  const [formDesc, setFormDesc] = useState('');
  const [formPerksText, setFormPerksText] = useState('');

  const handleOpenAdd = () => {
    setEditingRule(null);
    setFormCode('NEW_TIER');
    setFormName('');
    setFormNameEn('');
    setFormIconType('seedling');
    setFormThreshold(150);
    setFormStatus('active');
    setFormDesc('');
    setFormPerksText('Ưu tiên đặt chỗ sự kiện\nQuà lưu niệm đặc biệt');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (rule: AdminBadgeRule) => {
    setEditingRule(rule);
    setFormCode(rule.code);
    setFormName(rule.name);
    setFormNameEn(rule.nameEn);
    setFormIconType(rule.iconType);
    setFormThreshold(rule.pointsThreshold);
    setFormStatus(rule.status);
    setFormDesc(rule.description);
    setFormPerksText(rule.perks.join('\n'));
    setIsModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) return;

    const perksArray = formPerksText
      .split('\n')
      .map(p => p.trim())
      .filter(p => p.length > 0);

    if (editingRule) {
      onUpdateBadgeRule(editingRule.id, {
        code: formCode.trim().toUpperCase(),
        name: formName.trim(),
        nameEn: formNameEn.trim(),
        iconType: formIconType,
        pointsThreshold: formThreshold,
        status: formStatus,
        statusLabelVi: formStatus === 'active' ? 'Đang áp dụng' : 'Tạm dừng',
        description: formDesc.trim(),
        perks: perksArray
      });
    } else {
      onAddBadgeRule({
        code: formCode.trim().toUpperCase(),
        name: formName.trim(),
        nameEn: formNameEn.trim(),
        iconType: formIconType,
        pointsThreshold: formThreshold,
        status: formStatus,
        statusLabelVi: formStatus === 'active' ? 'Đang áp dụng' : 'Tạm dừng',
        description: formDesc.trim(),
        descriptionEn: formNameEn.trim(),
        perks: perksArray
      });
    }

    setIsModalOpen(false);
  };

  const renderBadgeEmblem = (type: string) => {
    switch (type) {
      case 'seedling':
        return <Sprout size={28} className="adm-emblem-icon emblem-green" />;
      case 'book':
        return <BookOpen size={28} className="adm-emblem-icon emblem-blue" />;
      case 'award':
        return <Award size={28} className="adm-emblem-icon emblem-gold" />;
      case 'crown':
        return <Crown size={28} className="adm-emblem-icon emblem-purple" />;
      default:
        return <Award size={28} className="adm-emblem-icon emblem-gold" />;
    }
  };

  return (
    <div className="adm-badges-view">
      {/* Header */}
      <div className="adm-page-header">
        <div>
          <span className="admin-page-eyebrow">CỘNG ĐỒNG ĐỘC GIẢ</span><h1 className="adm-page-title">Quy tắc Điểm & Huy hiệu</h1>
          <p className="adm-page-subtitle">
            Cấu hình tiêu chí xét danh hiệu, điểm sàn tích lũy và đặc quyền độc giả tại Đường Sách TP.HCM.
          </p>
        </div>
        <div className="adm-page-header-actions">
          <button className="adm-btn adm-btn-primary" onClick={handleOpenAdd}>
            <Plus size={16} />
            <span>Thêm quy tắc mới</span>
          </button>
        </div>
      </div>

      <div className="admin-insight-strip" aria-label="Tổng quan quy tắc">
        <div><span className="admin-insight-icon"><Award size={20} /></span><div><span>Tổng số quy tắc</span><strong>{badgeRules.length}</strong></div></div>
        <div><span className="admin-insight-icon mint"><CheckCircle2 size={20} /></span><div><span>Đang áp dụng</span><strong>{badgeRules.filter(rule => rule.status === 'active').length}</strong></div></div>
        <div><span className="admin-insight-icon amber"><BookOpen size={20} /></span><div><span>Ngưỡng điểm thấp nhất</span><strong>{badgeRules.length ? Math.min(...badgeRules.map(rule => rule.pointsThreshold)).toLocaleString('vi-VN') : '—'} <small>điểm</small></strong></div></div>
      </div>
      <div className="admin-section-caption"><div><h2>Danh sách huy hiệu</h2><p>Điều chỉnh ngưỡng điểm và trạng thái áp dụng của từng huy hiệu.</p></div><span>{badgeRules.length} quy tắc</span></div>
      {/* Badges Grid */}
      <div className="adm-badge-cards-grid">
        {pagination.items.map((rule) => {
          const isActive = rule.status === 'active';
          return (
            <div key={rule.id} className={`adm-card adm-badge-item-card ${!isActive ? 'card-inactive' : ''}`}>
              <div className="adm-badge-item-header">
                <div className="adm-badge-emblem-wrap">
                  {renderBadgeEmblem(rule.iconType)}
                </div>
                <div className="adm-badge-header-actions">
                  <span className={`adm-badge-status ${isActive ? 'badge-status-active' : 'badge-status-pending'}`}>
                    <span className="adm-status-dot"></span>
                    {rule.statusLabelVi}
                  </span>
                  <button 
                    className="adm-icon-btn" 
                    title="Chỉnh sửa quy tắc"
                    onClick={() => handleOpenEdit(rule)}
                  >
                    <Edit2 size={15} />
                  </button>
                </div>
              </div>

              <div className="adm-badge-item-body">
                <div className="adm-badge-name-row">
                  <h3 className="adm-badge-item-name">{rule.name}</h3>
                </div>
                {rule.nameEn !== rule.name && <div className="adm-badge-name-en">{rule.nameEn}</div>}
                <p className="adm-badge-desc">{rule.description}</p>

                <div className="adm-badge-threshold-box">
                  <span className="adm-threshold-label">Mức điểm yêu cầu:</span>
                  <span className="adm-threshold-val">{rule.pointsThreshold.toLocaleString('vi-VN')} điểm</span>
                </div>

                {rule.perks.length > 0 && <div className="adm-badge-perks-section">
                  <div className="adm-perks-title">
                    <Gift size={14} />
                    <span>Đặc quyền độc quyền:</span>
                  </div>
                  <ul className="adm-perks-list">
                    {rule.perks.map((perk, i) => (
                      <li key={i}>
                        <CheckCircle2 size={13} className="adm-perk-check" />
                        <span>{perk}</span>
                      </li>
                    ))}
                  </ul>
                </div>}
              </div>

              <div className="adm-badge-item-footer">
                <span className="adm-footer-toggle-label">
                  {isActive ? 'Đang kích hoạt' : 'Đang tạm dừng'}
                </span>
                <label className="adm-toggle-label">
                  <input 
                    type="checkbox"
                    className="adm-toggle-checkbox"
                    checked={isActive}
                    onChange={() => onToggleBadgeStatus(rule.id)}
                  />
                  <span className="adm-toggle-slider"></span>
                </label>
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal: Add or Edit Badge Rule */}
      <CompactPagination page={pagination.page} pages={pagination.pages} total={pagination.total} onPage={pagination.setPage} />
      {isModalOpen && (
        <div className="adm-modal-overlay">
          <div className="adm-modal-content">
            <div className="adm-modal-header">
              <h3 className="adm-modal-title">
                {editingRule ? `Chỉnh sửa huy hiệu: ${editingRule.name}` : 'Thêm quy tắc huy hiệu mới'}
              </h3>
              <button className="adm-modal-close" onClick={() => setIsModalOpen(false)}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="adm-modal-body">
                <div className="adm-form-row">
                  <div className="adm-form-group">
                    <label className="adm-form-label">Mã định danh (Code) *</label>
                    <input 
                      type="text"
                      required
                      placeholder="VD: BAN_DOC_XUAT_SAC"
                      className="adm-form-input"
                      value={formCode}
                      onChange={(e) => setFormCode(e.target.value)}
                    />
                  </div>
                  <div className="adm-form-group">
                    <label className="adm-form-label">Biểu tượng</label>
                    <select 
                      className="adm-form-select"
                      value={formIconType}
                      onChange={(e) => setFormIconType(e.target.value as any)}
                    >
                      <option value="seedling">Mầm đọc (Sprout)</option>
                      <option value="book">Sách tri thức (Book)</option>
                      <option value="award">Huy chương danh dự (Award)</option>
                      <option value="crown">Vương miện tinh hoa (Crown)</option>
                    </select>
                  </div>
                </div>

                <div className="adm-form-row">
                  <div className="adm-form-group">
                    <label className="adm-form-label">Tên huy hiệu (Tiếng Việt) *</label>
                    <input 
                      type="text"
                      required
                      placeholder="Ví dụ: Bạn Đọc Tích Cực"
                      className="adm-form-input"
                      value={formName}
                      onChange={(e) => setFormName(e.target.value)}
                    />
                  </div>
                  <div className="adm-form-group">
                    <label className="adm-form-label">Tên tiếng Anh</label>
                    <input 
                      type="text"
                      placeholder="e.g. Active Reader"
                      className="adm-form-input"
                      value={formNameEn}
                      onChange={(e) => setFormNameEn(e.target.value)}
                    />
                  </div>
                </div>

                <div className="adm-form-row">
                  <div className="adm-form-group">
                    <label className="adm-form-label">Điểm tích lũy sàn (Points Threshold) *</label>
                    <input 
                      type="number"
                      required
                      min={0}
                      step={50}
                      className="adm-form-input"
                      value={formThreshold}
                      onChange={(e) => setFormThreshold(parseInt(e.target.value) || 0)}
                    />
                  </div>
                  <div className="adm-form-group">
                    <label className="adm-form-label">Trạng thái</label>
                    <select 
                      className="adm-form-select"
                      value={formStatus}
                      onChange={(e) => setFormStatus(e.target.value as any)}
                    >
                      <option value="active">Đang áp dụng</option>
                      <option value="inactive">Tạm dừng</option>
                    </select>
                  </div>
                </div>

                <div className="adm-form-group">
                  <label className="adm-form-label">Mô tả tiêu chí đạt được</label>
                  <textarea 
                    rows={2}
                    className="adm-form-textarea"
                    placeholder="Mô tả ngắn gọn điều kiện để độc giả nhận được danh hiệu này..."
                    value={formDesc}
                    onChange={(e) => setFormDesc(e.target.value)}
                  />
                </div>

                <div className="adm-form-group">
                  <label className="adm-form-label">Danh sách đặc quyền (Mỗi dòng một đặc quyền)</label>
                  <textarea 
                    rows={3}
                    className="adm-form-textarea"
                    placeholder="Ưu tiên tham gia workshop&#10;Tặng voucher sách 10%"
                    value={formPerksText}
                    onChange={(e) => setFormPerksText(e.target.value)}
                  />
                </div>
              </div>

              <div className="adm-modal-footer">
                <button 
                  type="button" 
                  className="adm-btn adm-btn-secondary"
                  onClick={() => setIsModalOpen(false)}
                >
                  Hủy
                </button>
                <button type="submit" className="adm-btn adm-btn-primary">
                  {editingRule ? 'Lưu cập nhật' : 'Thêm huy hiệu'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
