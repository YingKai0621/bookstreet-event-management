import {
  AlertTriangle,
  CheckCircle,
  Clock,
  Download,
  Filter,
  Search,
  Shield,
  X,
  XCircle
} from 'lucide-react';
import React, { useMemo, useState } from 'react';
import { AdminAuditLogItem } from '../../types/admin';
import { useListPagination } from '../../hooks/useListPagination';
import { CompactPagination } from '../ui/CompactPagination';
import { useModalDismiss } from '../../hooks/useModalDismiss';

interface AdminAuditLogsViewProps {
  logs: AdminAuditLogItem[];
}

export const AdminAuditLogsView: React.FC<AdminAuditLogsViewProps> = ({ logs }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterAction, setFilterAction] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [selectedLog, setSelectedLog] = useState<AdminAuditLogItem | null>(null);
  useModalDismiss(selectedLog !== null, () => setSelectedLog(null));

  const filteredLogs = useMemo(() => {
    return logs.filter(item => {
      const matchQuery = 
        item.actorName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.targetObject.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.details.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.ipAddress.includes(searchTerm);

      const matchAction = filterAction === 'all' || item.actionType === filterAction;
      const matchStatus = filterStatus === 'all' || item.status === filterStatus;

      return matchQuery && matchAction && matchStatus;
    });
  }, [logs, searchTerm, filterAction, filterStatus]);
  const pagination = useListPagination(filteredLogs);

  const handleExportCSV = () => {
    const headers = ['Mã log', 'Thời gian', 'Người thực hiện', 'Vai trò', 'Hành động', 'Đối tượng', 'Chi tiết', 'Trạng thái', 'IP'];
    const rows = filteredLogs.map(l => [
      l.id,
      `"${l.timestamp}"`,
      `"${l.actorName}"`,
      `"${l.actorRole}"`,
      `"${l.actionLabelVi}"`,
      `"${l.targetObject}"`,
      `"${l.details.replace(/"/g, '""')}"`,
      `"${l.status}"`,
      `"${l.ipAddress}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Audit_Logs_DuongSach_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getStatusBadge = (status: 'success' | 'warning' | 'failed') => {
    switch (status) {
      case 'success':
        return (
          <span className="adm-badge-status badge-status-active">
            <CheckCircle size={12} />
            <span>Thành công</span>
          </span>
        );
      case 'warning':
        return (
          <span className="adm-badge-status badge-status-pending">
            <AlertTriangle size={12} />
            <span>Cảnh báo</span>
          </span>
        );
      case 'failed':
        return (
          <span className="adm-badge-status badge-status-locked">
            <XCircle size={12} />
            <span>Thất bại</span>
          </span>
        );
    }
  };

  return (
    <div className="adm-audit-view">
      {/* Header */}
      <div className="adm-page-header">
        <div>

          <h1 className="adm-page-title workspace-page-title">Nhật ký Hoạt động (Audit Logs)</h1>
          <p className="adm-page-subtitle workspace-page-subtitle">
            Truy vết các thao tác quản trị, cấp quyền, cấu hình hệ thống và sự kiện an ninh.
          </p>
        </div>
        <div className="adm-page-header-actions">
          <button className="adm-btn adm-btn-secondary" onClick={handleExportCSV}>
            <Download size={16} />
            <span>Xuất file CSV</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="admin-insight-strip" aria-label="Tổng quan nhật ký">
        <div><span className="admin-insight-icon"><Clock size={20} /></span><div><span>Tổng số bản ghi</span><strong>{logs.length}</strong></div></div>
        <div><span className="admin-insight-icon mint"><CheckCircle size={20} /></span><div><span>Thao tác thành công</span><strong>{logs.filter(log => log.status === 'success').length}</strong></div></div>
        <div><span className="admin-insight-icon amber"><AlertTriangle size={20} /></span><div><span>Cần chú ý</span><strong>{logs.filter(log => log.status === 'warning' || log.status === 'failed').length}</strong></div></div>
      </div>
      <div className="adm-card adm-filter-card">
        <div className="adm-filter-bar">
          <div className="adm-search-input-wrap">
            <Search size={16} className="adm-search-icon" />
            <input 
              type="text"
              placeholder="Tìm theo người thực hiện, đối tượng, chi tiết hoặc IP..."
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); pagination.reset(); }}
              className="adm-filter-search"
            />
            {searchTerm && (
              <button 
                className="adm-search-clear"
                onClick={() => setSearchTerm('')}
              >
                <X size={14} />
              </button>
            )}
          </div>

          <div className="adm-select-wrap">
            <Filter size={14} />
            <select 
              value={filterAction}
              onChange={(e) => { setFilterAction(e.target.value); pagination.reset(); }}
              className="adm-filter-select"
            >
              <option value="all">Tất cả hành động</option>
              <option value="create">Tạo tài khoản</option>
              <option value="update">Cập nhật thông tin</option>
              <option value="permission">Phân quyền</option>
              <option value="lock">Khóa tài khoản</option>
              <option value="config">Cấu hình quy tắc</option>
            </select>
          </div>

          <div className="adm-select-wrap">
            <Shield size={14} />
            <select 
              value={filterStatus}
              onChange={(e) => { setFilterStatus(e.target.value); pagination.reset(); }}
              className="adm-filter-select"
            >
              <option value="all">Tất cả trạng thái</option>
              <option value="success">Thành công</option>
              <option value="warning">Cảnh báo</option>
              <option value="failed">Thất bại</option>
            </select>
          </div>
        </div>
      </div>

      {/* Table Card */}
      <div className="adm-card adm-table-card">
        <div className="adm-table-summary">
          <span>Hiển thị <strong>{filteredLogs.length}</strong> bản ghi nhật ký</span>
        </div>

        <div className="adm-table-responsive">
          <table className="adm-table">
            <thead>
              <tr>
                <th>THỜI GIAN</th>
                <th>NGƯỜI THỰC HIỆN</th>
                <th>HÀNH ĐỘNG</th>
                <th>ĐỐI TƯỢNG TÁC ĐỘNG</th>
                <th>CHI TIẾT THAY ĐỔI</th>
                <th>TRẠNG THÁI & IP</th>
              </tr>
            </thead>
            <tbody>
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="adm-table-empty">
                    <Clock size={32} />
                    <p>Không có bản ghi nhật ký nào khớp với tiêu chí tìm kiếm.</p>
                  </td>
                </tr>
              ) : (
                pagination.items.map((log) => (
                  <tr key={log.id}>
                    {/* Timestamp */}
                    <td>
                      <div className="adm-time-cell">
                        <Clock size={13} />
                        <span>{log.timestamp}</span>
                      </div>
                    </td>

                    {/* Actor */}
                    <td>
                      <div className="adm-log-actor">
                        <span className="adm-actor-name">{log.actorName}</span>
                        <span className="adm-actor-role">{log.actorRole}</span>
                      </div>
                    </td>

                    {/* Action */}
                    <td>
                      <span className="adm-badge-role badge-role-admin">
                        {log.actionLabelVi}
                      </span>
                    </td>

                    {/* Target Object */}
                    <td>
                      <span className="adm-log-target">{log.targetObject}</span>
                    </td>

                    {/* Details */}
                    <td>
                      <button type="button" className="adm-log-detail-button" onClick={() => setSelectedLog(log)} aria-label={`Xem chi tiết nhật ký ${log.id}`}>
                        <span className="adm-log-details">{log.details}</span><small>Xem chi tiết</small>
                      </button>
                    </td>

                    {/* Status & IP */}
                    <td>
                      <div className="adm-log-status-col">
                        {getStatusBadge(log.status)}
                        <span className="adm-ip-text">IP: {log.ipAddress}</span>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      <CompactPagination page={pagination.page} pages={pagination.pages} total={pagination.total} onPage={pagination.setPage} />
      {selectedLog && <div className="adm-modal-overlay" onClick={() => setSelectedLog(null)}>
        <section className="adm-modal-content" role="dialog" aria-modal="true" aria-labelledby="audit-log-detail-title" onClick={event => event.stopPropagation()}>
          <div className="adm-modal-header"><h3 id="audit-log-detail-title">Chi tiết nhật ký #{selectedLog.id}</h3><button className="adm-modal-close" type="button" aria-label="Đóng chi tiết nhật ký" onClick={() => setSelectedLog(null)}><X size={20} /></button></div>
          <div className="adm-modal-body"><dl className="audit-detail-fields"><dt>Thời gian</dt><dd>{selectedLog.timestamp}</dd><dt>Người thực hiện</dt><dd>{selectedLog.actorName} · {selectedLog.actorRole}</dd><dt>Hành động</dt><dd>{selectedLog.actionLabelVi}</dd><dt>Đối tượng</dt><dd>{selectedLog.targetObject}</dd><dt>IP</dt><dd>{selectedLog.ipAddress}</dd></dl><h4>Chi tiết thay đổi</h4><p className="audit-detail-text">{selectedLog.details}</p></div>
          <div className="adm-modal-footer"><button className="adm-btn adm-btn-secondary" type="button" onClick={() => setSelectedLog(null)}>Đóng</button></div>
        </section>
      </div>}
    </div>
  );
};

