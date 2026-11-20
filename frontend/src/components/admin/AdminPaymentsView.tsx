import { DayFirstDateInput } from '../ui/DayFirstDateInput';
import { AlertTriangle, Clock, CreditCard, Filter, RefreshCw, Search, X } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useModalDismiss } from '../../hooks/useModalDismiss';
import {
  ADMIN_PAYMENT_STATUS_LABELS,
  ADMIN_PAYMENT_TYPE_LABELS,
  adminPaymentsApi,
  type AdminBoothPayment,
  type AdminPaymentSort,
} from '../../services/adminPaymentsApi';
import { ApiError } from '../../services/apiClient';
import { paymentMoney, paymentTime } from '../../services/paymentPresentation';
import type { BoothPaymentStatus } from '../../types/payment';
import { CompactPagination } from '../ui/CompactPagination';
import { SearchFieldLabel } from '../ui/SearchFieldLabel';
import { WorkspaceFieldLabel } from '../ui/WorkspaceFieldLabel';
import './AdminPayments.css';

const PAGE_SIZE = 20;

const SORT_LABELS: Record<AdminPaymentSort, string> = {
  'createdAt,desc': 'Mới nhất trước',
  'createdAt,asc': 'Cũ nhất trước',
  'amount,desc': 'Số tiền giảm dần',
  'amount,asc': 'Số tiền tăng dần',
};

const STATUS_BADGE: Record<BoothPaymentStatus, string> = {
  SUCCESS: 'badge-status-active',
  PENDING: 'badge-status-pending',
  FAILED: 'badge-status-locked',
  TIMEOUT: 'adm-payment-status-muted',
};

interface Filters {
  search: string;
  status: BoothPaymentStatus | '';
  reconciliationOnly: boolean;
  event: { eventId: number; name: string } | null;
  from: string;
  to: string;
  sort: AdminPaymentSort;
}

const NO_FILTERS: Filters = {
  search: '', status: '', reconciliationOnly: false, event: null, from: '', to: '', sort: 'createdAt,desc',
};

function loadErrorMessage(error: unknown): string {
  if (error instanceof ApiError && error.status === 401) return 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.';
  if (error instanceof ApiError && error.status === 403) return 'Bạn không có quyền xem lịch sử thanh toán.';
  if (error instanceof ApiError && error.status === 400) return 'Bộ lọc chưa hợp lệ. Vui lòng kiểm tra lại.';
  return 'Không tải được lịch sử thanh toán. Vui lòng thử lại.';
}

/**
 * AC-OPT-S11-01: Booth Payments of every Event, including pending ones, for Admin oversight. The screen
 * offers no action that changes a Payment, because Admin does not operate payments (BR-119).
 */
export const AdminPaymentsView: React.FC = () => {
  const [searchInput, setSearchInput] = useState('');
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  const [page, setPage] = useState(0);
  const [revision, setRevision] = useState(0);
  const [items, setItems] = useState<AdminBoothPayment[]>([]);
  const [pages, setPages] = useState(0);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<AdminBoothPayment | null>(null);
  useModalDismiss(selected !== null, () => setSelected(null));

  const dateRangeInvalid = Boolean(filters.from && filters.to && filters.from > filters.to);

  useEffect(() => {
    const next = searchInput.trim();
    if (next === filters.search) return undefined;
    const timer = window.setTimeout(() => {
      setFilters(current => ({ ...current, search: next }));
      setPage(0);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [searchInput, filters.search]);

  useEffect(() => {
    // An impossible date range is explained beside the fields instead of being sent to the server.
    if (dateRangeInvalid) return undefined;
    let active = true;
    // oxlint-disable-next-line react/set-state-in-effect -- Filter and page changes intentionally start a server refresh.
    setLoading(true);
    // oxlint-disable-next-line react/set-state-in-effect -- A new request replaces any earlier failure.
    setError('');
    adminPaymentsApi.list({
      page,
      size: PAGE_SIZE,
      search: filters.search || undefined,
      status: filters.status || undefined,
      reconciliationRequired: filters.reconciliationOnly ? true : undefined,
      eventId: filters.event?.eventId,
      from: filters.from || undefined,
      to: filters.to || undefined,
      sort: filters.sort,
    }).then(result => {
      if (!active) return;
      if (!Array.isArray(result.content)) throw new Error('Invalid payment response');
      setItems(result.content);
      setPages(result.totalPages);
      setTotal(result.totalElements);
    }).catch(cause => {
      if (!active) return;
      setItems([]);
      setPages(0);
      setTotal(0);
      setError(loadErrorMessage(cause));
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [filters, page, revision, dateRangeInvalid]);

  const changeFilter = (changes: Partial<Filters>) => {
    setFilters(current => ({ ...current, ...changes }));
    setPage(0);
  };
  const hasFilters = Boolean(filters.search || filters.status || filters.reconciliationOnly
    || filters.event || filters.from || filters.to);
  const clearFilters = () => {
    setSearchInput('');
    changeFilter({ search: '', status: '', reconciliationOnly: false, event: null, from: '', to: '' });
  };

  return (
    <div className="adm-users-view adm-payments-view">
      <div className="adm-page-header">
        <div>
          <h1 className="adm-page-title workspace-page-title">Lịch sử thanh toán</h1>
          <p className="adm-page-subtitle workspace-page-subtitle">
            Theo dõi mọi giao dịch thuê gian hàng của tất cả sự kiện, kể cả giao dịch đang chờ. Trang này chỉ để xem; Admin không thay đổi giao dịch.
          </p>
        </div>
      </div>

      <div className="adm-card adm-filter-card">
        <div className="adm-filter-bar">
          <SearchFieldLabel className="adm-search-group">
            <div className="adm-search-input-wrap">
              <Search size={16} className="adm-search-icon" />
              <input
                type="text"
                aria-label="Tìm giao dịch"
                placeholder="Tìm theo đối tác, sự kiện, mã gian hàng hoặc mã giao dịch..."
                maxLength={100}
                value={searchInput}
                onChange={event => setSearchInput(event.target.value)}
                className="adm-filter-search"
              />
              {searchInput && (
                <button type="button" className="adm-search-clear" aria-label="Xóa từ khóa" onClick={() => setSearchInput('')}>
                  <X size={14} />
                </button>
              )}
            </div>
          </SearchFieldLabel>

          <WorkspaceFieldLabel className="adm-status-field" label="Trạng thái">
            <div className="adm-select-wrap">
              <Filter size={14} />
              <select
                aria-label="Lọc theo trạng thái thanh toán"
                className="adm-filter-select"
                value={filters.status}
                onChange={event => changeFilter({ status: event.target.value as Filters['status'] })}
              >
                <option value="">Tất cả trạng thái</option>
                {Object.entries(ADMIN_PAYMENT_STATUS_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
          </WorkspaceFieldLabel>

          <WorkspaceFieldLabel className="adm-status-field" label="Từ ngày">
            <DayFirstDateInput
              aria-label="Lọc từ ngày"
              className="adm-filter-select"
              type="date"
              value={filters.from}
              aria-invalid={dateRangeInvalid || undefined}
              aria-describedby={dateRangeInvalid ? 'admin-payment-date-error' : undefined}
              onChange={event => changeFilter({ from: event.target.value })}
            />
          </WorkspaceFieldLabel>
          <WorkspaceFieldLabel className="adm-status-field" label="Đến ngày">
            <DayFirstDateInput
              aria-label="Lọc đến ngày"
              className="adm-filter-select"
              type="date"
              value={filters.to}
              aria-invalid={dateRangeInvalid || undefined}
              aria-describedby={dateRangeInvalid ? 'admin-payment-date-error' : undefined}
              onChange={event => changeFilter({ to: event.target.value })}
            />
          </WorkspaceFieldLabel>

          <WorkspaceFieldLabel className="adm-status-field" label="Sắp xếp">
            <div className="adm-select-wrap">
              <select
                aria-label="Sắp xếp giao dịch"
                className="adm-filter-select"
                value={filters.sort}
                onChange={event => changeFilter({ sort: event.target.value as AdminPaymentSort })}
              >
                {Object.entries(SORT_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </div>
          </WorkspaceFieldLabel>

          <label className="adm-payment-toggle">
            <input
              type="checkbox"
              checked={filters.reconciliationOnly}
              onChange={event => changeFilter({ reconciliationOnly: event.target.checked })}
            />
            <span>Chỉ giao dịch cần đối soát</span>
          </label>

          {hasFilters && (
            <button type="button" className="adm-btn adm-btn-secondary" onClick={clearFilters}>Xóa bộ lọc</button>
          )}
        </div>
        {dateRangeInvalid && (
          <p id="admin-payment-date-error" className="adm-payment-filter-error" role="alert">
            "Từ ngày" phải trước hoặc trùng "Đến ngày".
          </p>
        )}
        {filters.event && (
          <div className="adm-payment-event-chip">
            <span>Đang xem sự kiện: <strong>{filters.event.name}</strong></span>
            <button type="button" aria-label="Bỏ lọc theo sự kiện" onClick={() => changeFilter({ event: null })}>
              <X size={14} />
            </button>
          </div>
        )}
      </div>

      <div className="adm-card adm-table-card">
        {dateRangeInvalid ? (
          <div className="adm-table-empty">
            <Clock size={32} />
            <p>Hãy chọn lại khoảng ngày để xem giao dịch.</p>
          </div>
        ) : (
          <>
            {loading && <p className="app-loading-state" role="status">Đang tải lịch sử thanh toán...</p>}
            {!loading && error && (
              <div className="adm-table-empty" role="alert">
                <p>{error}</p>
                <button type="button" className="adm-btn adm-btn-secondary" onClick={() => setRevision(value => value + 1)}>
                  <RefreshCw size={14} />
                  <span>Thử lại</span>
                </button>
              </div>
            )}
            {!loading && !error && items.length === 0 && (
              <div className="adm-table-empty">
                <CreditCard size={32} />
                <p>{hasFilters ? 'Không có giao dịch nào khớp với bộ lọc.' : 'Chưa có giao dịch thanh toán nào.'}</p>
              </div>
            )}
            {!loading && !error && items.length > 0 && (
              <>
                <div className="adm-table-summary">
                  <span>Có <strong>{total}</strong> giao dịch phù hợp</span>
                </div>
                <div className="adm-table-responsive">
                  <table className="adm-table adm-payments-table">
                    <thead>
                      <tr>
                        <th>THỜI GIAN</th>
                        <th>SỰ KIỆN</th>
                        <th>ĐỐI TÁC</th>
                        <th>GIAN HÀNG</th>
                        <th className="adm-payment-amount">SỐ TIỀN</th>
                        <th>TRẠNG THÁI</th>
                        <th>CHI TIẾT</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map(payment => (
                        <tr key={payment.boothPaymentId}>
                          <td>
                            <div className="adm-time-cell">
                              <Clock size={13} />
                              <span>{paymentTime(payment.createdAt)}</span>
                            </div>
                          </td>
                          <td>
                            <button
                              type="button"
                              className="adm-payment-link"
                              title="Xem các giao dịch của sự kiện này"
                              onClick={() => changeFilter({ event: payment.event })}
                            >
                              {payment.event.name}
                            </button>
                          </td>
                          <td>{payment.partnerOrganization.name}</td>
                          <td>
                            <span className="adm-payment-booth">{payment.booth.code}</span>
                            <small className="adm-payment-subtle">{payment.booth.name}</small>
                          </td>
                          <td className="adm-payment-amount">
                            {payment.transactionType === 'REFUND' ? '−' : ''}{paymentMoney(payment.amount)}
                          </td>
                          <td>
                            <span className={`adm-badge-status ${STATUS_BADGE[payment.status]}`}>
                              <span className="adm-status-dot"></span>
                              {ADMIN_PAYMENT_STATUS_LABELS[payment.status]}
                            </span>
                            {payment.reconciliationRequired && (
                              <span className="adm-payment-reconcile">
                                <AlertTriangle size={12} /> Cần đối soát
                              </span>
                            )}
                          </td>
                          <td>
                            <button
                              type="button"
                              className="adm-btn adm-btn-secondary adm-btn-sm"
                              aria-label={`Xem chi tiết giao dịch ${payment.boothPaymentId}`}
                              onClick={() => setSelected(payment)}
                            >
                              Xem
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </>
        )}
      </div>

      {!dateRangeInvalid && !loading && !error && pages > 1 && (
        <CompactPagination page={page + 1} pages={pages} total={total} onPage={next => setPage(next - 1)} />
      )}

      {selected && (
        <div className="adm-modal-overlay" onClick={() => setSelected(null)}>
          <section
            className="adm-modal-content"
            role="dialog"
            aria-modal="true"
            aria-labelledby="admin-payment-detail-title"
            onClick={event => event.stopPropagation()}
          >
            <div className="adm-modal-header">
              <h3 id="admin-payment-detail-title" className="adm-modal-title">Giao dịch #{selected.boothPaymentId}</h3>
              <button type="button" className="adm-modal-close" aria-label="Đóng chi tiết giao dịch" onClick={() => setSelected(null)}>
                <X size={20} />
              </button>
            </div>
            <div className="adm-modal-body">
              {selected.reconciliationRequired && (
                <p className="adm-payment-reconcile-note" role="note">
                  <AlertTriangle size={14} /> Giao dịch này cần đối soát với cổng thanh toán. Hệ thống tự kiểm tra lại; Admin không xử lý thay.
                </p>
              )}
              <dl className="audit-detail-fields">
                <dt>Sự kiện</dt><dd>{selected.event.name}</dd>
                <dt>Đối tác</dt><dd>{selected.partnerOrganization.name}</dd>
                <dt>Gian hàng</dt><dd>{selected.booth.code} · {selected.booth.name}</dd>
                <dt>Loại giao dịch</dt><dd>{ADMIN_PAYMENT_TYPE_LABELS[selected.transactionType] ?? selected.transactionType}</dd>
                <dt>Số tiền</dt><dd>{paymentMoney(selected.amount)}</dd>
                <dt>Trạng thái</dt><dd>{ADMIN_PAYMENT_STATUS_LABELS[selected.status]}</dd>
                <dt>Cổng thanh toán</dt><dd>{selected.gatewayProvider}</dd>
                <dt>Mã giao dịch</dt><dd>{selected.gatewayTransactionRef || '—'}</dd>
                <dt>Tạo lúc</dt><dd>{paymentTime(selected.createdAt)}</dd>
                <dt>Kết thúc lúc</dt><dd>{selected.completedAt ? paymentTime(selected.completedAt) : 'Chưa kết thúc'}</dd>
                {selected.failureCode && <><dt>Mã lỗi</dt><dd>{selected.failureCode}</dd></>}
              </dl>
            </div>
            <div className="adm-modal-footer">
              <button type="button" className="adm-btn adm-btn-secondary" onClick={() => setSelected(null)}>Đóng</button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
};
