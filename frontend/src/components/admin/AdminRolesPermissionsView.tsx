import {
  Briefcase,
  Calendar,
  Check,
  Info,
  Lock,
  RotateCcw,
  Save,
  Shield,
  Users
} from 'lucide-react';
import React, { useMemo, useState } from 'react';
import {
  AdminPermissionItem,
  AdminRolePermissionConfig,
  AdminRoleType
} from '../../types/admin';

interface AdminRolesPermissionsViewProps {
  roleConfigs: Record<AdminRoleType, AdminRolePermissionConfig>;
  permissions: AdminPermissionItem[];
  onSaveRolePermissions: (roleId: AdminRoleType, permissionCodes: string[]) => void | Promise<void>;
  onResetDefaults: (roleId: AdminRoleType) => void | Promise<void>;
}

const DEFAULT_ROLE_CONFIGS: Record<AdminRoleType, AdminRolePermissionConfig> = {
  participant: { 
    roleId: 'participant', 
    roleName: 'Độc giả', 
    description: 'Tài khoản người dùng tham gia các sự kiện và trải nghiệm Đường Sách', 
    assignedPermissionCodes: [] 
  },
  partner: { 
    roleId: 'partner', 
    roleName: 'Đối tác', 
    description: 'Đơn vị xuất bản, phát hành hoặc đối tác đăng ký gian hàng và hoạt động', 
    assignedPermissionCodes: [] 
  },
  organizer: { 
    roleId: 'organizer', 
    roleName: 'Ban tổ chức', 
    description: 'Đội ngũ điều hành, phê duyệt và giám sát hoạt động tại Đường Sách', 
    assignedPermissionCodes: [] 
  },
  admin: { 
    roleId: 'admin', 
    roleName: 'Quản trị viên', 
    description: 'Toàn quyền cấu hình hệ thống, quản lý tài khoản và phân quyền', 
    assignedPermissionCodes: [] 
  },
};

const ALL_ROLES: AdminRoleType[] = ['participant', 'partner', 'organizer', 'admin'];
const EMPTY_ROLE_CONFIGS = {} as Record<AdminRoleType, AdminRolePermissionConfig>;

export const AdminRolesPermissionsView: React.FC<AdminRolesPermissionsViewProps> = ({
  roleConfigs = EMPTY_ROLE_CONFIGS,
  permissions = [],
  onSaveRolePermissions,
  onResetDefaults
}) => {
  const [selectedRoleId, setSelectedRoleId] = useState<AdminRoleType>('organizer');
  const [currentPermissions, setCurrentPermissions] = useState<Record<AdminRoleType, string[]>>({
    participant: roleConfigs?.participant?.assignedPermissionCodes || [],
    partner: roleConfigs?.partner?.assignedPermissionCodes || [],
    organizer: roleConfigs?.organizer?.assignedPermissionCodes || [],
    admin: roleConfigs?.admin?.assignedPermissionCodes || []
  });

  const [hasChanges, setHasChanges] = useState<boolean>(false);
  const [saveSuccessNotice, setSaveSuccessNotice] = useState<string | null>(null);
  const [roleConfigsSource, setRoleConfigsSource] = useState(roleConfigs);

  if (roleConfigsSource !== roleConfigs && Object.keys(roleConfigs).length > 0) {
    setRoleConfigsSource(roleConfigs);
    setCurrentPermissions({
      participant: roleConfigs.participant?.assignedPermissionCodes || [],
      partner: roleConfigs.partner?.assignedPermissionCodes || [],
      organizer: roleConfigs.organizer?.assignedPermissionCodes || [],
      admin: roleConfigs.admin?.assignedPermissionCodes || []
    });
  }

  const activeRoleConfig = roleConfigs?.[selectedRoleId] || DEFAULT_ROLE_CONFIGS[selectedRoleId];
  const activeAssignedCodes = currentPermissions[selectedRoleId] || [];

  // Group permissions by module
  const groupedPermissions = useMemo(() => {
    const groups: Record<string, { label: string; items: AdminPermissionItem[] }> = {};
    (permissions || []).forEach((item: AdminPermissionItem) => {
      if (!item || !item.module) return;
      if (!groups[item.module]) {
        groups[item.module] = {
          label: item.moduleLabelVi || item.module,
          items: []
        };
      }
      groups[item.module].items.push(item);
    });
    return groups;
  }, [permissions]);

  const handleTogglePermission = (code: string) => {
    if (selectedRoleId === 'admin' && code === 'system.roles.manage') {
      // Prevent locking oneself out of role management
      return;
    }

    const isAssigned = activeAssignedCodes.includes(code);
    let updated: string[];
    if (isAssigned) {
      updated = activeAssignedCodes.filter(c => c !== code);
    } else {
      updated = [...activeAssignedCodes, code];
    }

    setCurrentPermissions(prev => ({
      ...prev,
      [selectedRoleId]: updated
    }));
    setHasChanges(true);
    setSaveSuccessNotice(null);
  };

  const handleSave = async () => {
    try {
      await onSaveRolePermissions(selectedRoleId, activeAssignedCodes);
      setHasChanges(false);
      setSaveSuccessNotice(`Đã lưu thành công cấu hình phân quyền cho vai trò "${activeRoleConfig.roleName}".`);
      setTimeout(() => setSaveSuccessNotice(null), 4000);
    } catch (error) {
      setSaveSuccessNotice(error instanceof Error ? error.message : 'Không thể lưu cấu hình phân quyền.');
    }
  };

  const handleReset = async () => {
    await onResetDefaults(selectedRoleId);
    const defaults = roleConfigs?.[selectedRoleId]?.assignedPermissionCodes || DEFAULT_ROLE_CONFIGS[selectedRoleId].assignedPermissionCodes;
    setCurrentPermissions(prev => ({
      ...prev,
      [selectedRoleId]: [...defaults]
    }));
    setHasChanges(false);
  };

  const getRoleIcon = (roleId: AdminRoleType) => {
    switch (roleId) {
      case 'participant': return <Users size={16} />;
      case 'partner': return <Briefcase size={16} />;
      case 'organizer': return <Calendar size={16} />;
      case 'admin': return <Lock size={16} />;
    }
  };

  return (
    <div className="adm-roles-view">
      {/* Header */}
      <div className="adm-page-header">
        <div>
          <h1 className="adm-page-title workspace-page-title">Vai trò & Phân quyền</h1>
          <p className="adm-page-subtitle workspace-page-subtitle">
            Cấu hình ma trận quyền hạn cho từng nhóm đối tượng trên cổng vận hành Đường Sách.
          </p>
        </div>
        <div className="adm-page-header-actions">
          {hasChanges && (
            <button 
              type="button"
              className="adm-btn adm-btn-secondary"
              onClick={handleReset}
            >
              <RotateCcw size={16} />
              <span>Khôi phục ban đầu</span>
            </button>
          )}
          <button 
            type="button"
            className="adm-btn adm-btn-primary"
            onClick={handleSave}
            disabled={!hasChanges}
          >
            <Save size={16} />
            <span>Lưu thay đổi</span>
          </button>
        </div>
      </div>

      {saveSuccessNotice && (
        <div className="adm-toast-banner" style={{ marginTop: '1rem' }}>
          <Check size={16} />
          <span>{saveSuccessNotice}</span>
        </div>
      )}

      {/* Role Selection Tabs */}
      <div className="adm-card adm-role-selector-card" style={{ marginTop: '1.25rem' }}>
        <div className="adm-role-tabs-row">
          {ALL_ROLES.map((rId) => {
            const cfg = roleConfigs?.[rId] || DEFAULT_ROLE_CONFIGS[rId];
            const isSelected = selectedRoleId === rId;
            const count = (currentPermissions[rId] || []).length;
            return (
              <button
                type="button"
                key={rId}
                className={`adm-role-tab-btn ${isSelected ? 'active' : ''}`}
                onClick={() => {
                  setSelectedRoleId(rId);
                  setSaveSuccessNotice(null);
                }}
              >
                <div className="adm-role-tab-icon">
                  {getRoleIcon(rId)}
                </div>
                <div className="adm-role-tab-text">
                  <span className="adm-role-tab-name">{cfg.roleName}</span>
                  <span className="adm-role-tab-count">{count} quyền được cấp</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Role Overview Description Card */}
      <div className="adm-card adm-role-meta-card" style={{ marginTop: '1.25rem' }}>
        <div className="adm-role-meta-header">
          <div className="adm-role-meta-icon">
            <Shield size={20} />
          </div>
          <div>
            <h3 className="adm-role-meta-title">{activeRoleConfig.roleName}</h3>
            <p className="adm-role-meta-desc">{activeRoleConfig.description}</p>
          </div>
        </div>
        <div className="adm-role-meta-stat">
          Đang kích hoạt <strong>{activeAssignedCodes.length}</strong> trên tổng số <strong>{permissions.length}</strong> quyền của nền tảng.
        </div>
      </div>

      {/* Permission Groups */}
      <div className="adm-permissions-container" style={{ marginTop: '1.25rem' }}>
        {Object.keys(groupedPermissions).length === 0 && (
          <div className="adm-card" style={{ padding: '2.5rem 1.5rem', textAlign: 'center' }}>
            <p style={{ color: '#64748B', margin: 0 }}>Đang tải danh sách quyền từ hệ thống...</p>
          </div>
        )}

        {Object.entries(groupedPermissions).map(([moduleKey, group]) => {
          const groupCodes = group.items.map(i => i.code);
          const enabledInGroupCount = groupCodes.filter(c => activeAssignedCodes.includes(c)).length;

          return (
            <div key={moduleKey} className="adm-card adm-perm-module-card" style={{ marginBottom: '1rem' }}>
              <div className="adm-perm-module-header">
                <div>
                  <h4 className="adm-perm-module-title">{group.label}</h4>
                  <span className="adm-perm-module-count">
                    {enabledInGroupCount}/{group.items.length} quyền bật
                  </span>
                </div>
              </div>

              <div className="adm-perm-list">
                {group.items.map((perm) => {
                  const isChecked = activeAssignedCodes.includes(perm.code);
                  const isLockedAdminRule = selectedRoleId === 'admin' && perm.code === 'system.roles.manage';

                  return (
                    <div key={perm.id} className="adm-perm-row">
                      <div className="adm-perm-info">
                        <div className="adm-perm-name-row">
                          <span className="adm-perm-name">{perm.name}</span>
                        </div>
                        <p className="adm-perm-desc">{perm.description}</p>
                      </div>

                      <div className="adm-perm-action">
                        <label className="adm-toggle-label">
                          <input 
                            type="checkbox"
                            className="adm-toggle-checkbox"
                            checked={isChecked}
                            disabled={isLockedAdminRule}
                            onChange={() => handleTogglePermission(perm.code)}
                          />
                          <span className="adm-toggle-slider"></span>
                        </label>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Floating Save bar if dirty */}
      {hasChanges && (
        <div className="adm-floating-save-bar">
          <div className="adm-floating-text">
            <Info size={16} />
            <span>Bạn có thay đổi chưa lưu cho vai trò này.</span>
          </div>
          <div className="adm-floating-actions">
            <button 
              type="button"
              className="adm-btn adm-btn-secondary"
              onClick={handleReset}
            >
              Hủy
            </button>
            <button 
              type="button"
              className="adm-btn adm-btn-primary"
              onClick={handleSave}
            >
              Lưu thay đổi ngay
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
