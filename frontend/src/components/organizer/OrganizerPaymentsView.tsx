import { DayFirstDateInput } from '../ui/DayFirstDateInput';
import { CreditCard, LoaderCircle, RefreshCw, Search, Wallet, X } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { ApiError } from '../../services/apiClient';
import { organizerApi } from '../../services/organizerApi';
import {
  ORGANIZER_PAYMENT_STATUS_LABELS,
  organizerPaymentsApi,
  type OrganizerBoothPayment,
  type OrganizerPaymentSort,
} from '../../services/organizerPaymentsApi';
import { paymentMoney, paymentTime } from '../../services/paymentPresentation';
import type { BoothPaymentStatus } from '../../types/payment';
import './OrganizerPayments.css';

const PAGE_SIZE = 20;

const SORT_LABELS: Record<OrganizerPaymentSort, string> = {
  'createdAt,desc': 'Mới nhất trước',
  'createdAt,asc': 'Cũ nhất trước',
  'amount,desc': 'Số tiền giảm dần',
  'amount,asc': 'Số tiền tăng dần',
};

interface Filters {
  search: string;
  status: BoothPaymentStatus | '';
  eventId: string;
  from: string;
  to: string;
  sort: OrganizerPaymentSort;
}

const NO_FILTERS: Filters = { search: '', status: '', eventId: '', from: '', to: '', sort: 'createdAt,desc' };

function loadErrorMessage(error: unknown): string {
  if (error instanceof ApiError && error.status === 401) return 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.';
  if (error instanceof ApiError && error.status === 403) return 'Bạn không có quyền xem lịch sử thanh toán.';
  if (error instanceof ApiError && error.status === 400) return 'Bộ lọc chưa hợp lệ. Vui lòng kiểm tra lại.';
  return 'Không tải được lịch sử thanh toán. Vui lòng thử lại.';
}

/**
 * AC-ORG-PAY-S11-01 and 02: the Booth Payments of the Organizer's own Events with the money collected.
 * The screen only reads; Payments are settled by the gateway flow, never by the Organizer.
 */
export const OrganizerPaymentsView: React.FC = () => {
  const [events, setEvents] = useState<{ id: string; title: string }[]>([]);
  const [searchInput, setSearchInput] = useState('');
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  const [page, setPage] = useState(0);
  const [revision, setRevision] = useState(0);
  const [items, setItems] = useState<OrganizerBoothPayment[]>([]);
  const [pages, setPages] = useState(0);
  const [total, setTotal] = useState(0);
  const [collected, setCollected] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const dateRangeInvalid = Boolean(filters.from && filters.to && filters.from > filters.to);

  useEffect(() => {
    let active = true;
    // The Event filter is a convenience: if it cannot load, the history still works without it.
    organizerApi.getEvents().then(list => {
      if (active) setEvents(list.map(event => ({ id: event.id, title: event.title })));
    }).catch(() => undefined);
    return () => { active = false; };
  }, []);

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
    if (dateRangeInvalid) return undefined;
    let active = true;
    // oxlint-disable-next-line react/set-state-in-effect -- Filter and page changes intentionally start a server refresh.
    setLoading(true);
    // oxlint-disable-next-line react/set-state-in-effect -- A new request replaces any earlier failure.
    setError('');
    organizerPaymentsApi.list({
      page,
      size: PAGE_SIZE,
      search: filters.search || undefined,
      status: filters.status || undefined,
      eventId: filters.eventId ? Number(filters.eventId) : undefined,
      from: filters.from || undefined,
      to: filters.to || undefined,
      sort: filters.sort,
    }).then(result => {
      if (!active) return;
      if (!Array.isArray(result.content)) throw new Error('Invalid payment response');
      setItems(result.content);
      setPages(result.totalPages);
      setTotal(result.totalElements);
      setCollected(result.collectedAmount);
    }).catch(cause => {
      if (!active) return;
      setItems([]);
      setPages(0);
      setTotal(0);
      // A failed load must not read as zero money collected.
      setCollected(null);
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
  const hasFilters = Boolean(filters.search || filters.status || filters.eventId || filters.from || filters.to);
  const selectedEvent = events.find(event => event.id === filters.eventId);

  return (
    <section className="organizer-content organizer-payments-page">
      <header className="organizer-payments-heading">
        <div>
          <h1 className="organizer-view-title workspace-page-title">Lịch sử thanh toán</h1>
          <p className="organizer-view-sub workspace-page-subtitle">
            Giao dịch thuê gian hàng trong các sự kiện của bạn. Trang này chỉ để xem; thanh toán được xử lý tự động qua cổng thanh toán.
          </p>
        </div>
        <div className="organizer-payments-total" aria-live="polite">
          <Wallet size={20} aria-hidden="true" />
          <div>
            <span>{selectedEvent ? `Đã thu · ${selectedEvent.title}` : 'Đã thu · tất cả sự kiện'}</span>
            <strong>{collected === null ? '—' : paymentMoney(collected)}</strong>
          </div>
        </div>
      </header>

      <div className="organizer-payments-toolbar">
        <label className="organizer-payments-field organizer-payments-search">
          <span>Tìm kiếm</span>
          <span className="organizer-payments-search-control">
            <Search size={16} aria-hidden="true" />
            <input
              type="text"
              aria-label="Tìm giao dịch"
              placeholder="Đối tác, sự kiện hoặc mã gian hàng"
              maxLength={100}
              value={searchInput}
              onChange={event => setSearchInput(event.target.value)}
            />
            {searchInput && (
              <button type="button" aria-label="Xóa từ khóa" onClick={() => setSearchInput('')}><X size={14} /></button>
            )}
          </span>
        </label>
        <label className="organizer-payments-field">
          <span>Sự kiện</span>
          <select aria-label="Lọc theo sự kiện" value={filters.eventId} onChange={event => changeFilter({ eventId: event.target.value })}>
            <option value="">Tất cả sự kiện của tôi</option>
            {events.map(event => <option key={event.id} value={event.id}>{event.title}</option>)}
          </select>
        </label>
        <label className="organizer-payments-field">
          <span>Trạng thái</span>
          <select
            aria-label="Lọc theo trạng thái thanh toán"
            value={filters.status}
            onChange={event => changeFilter({ status: event.target.value as Filters['status'] })}
          >
            <option value="">Tất cả trạng thái</option>
            {Object.entries(ORGANIZER_PAYMENT_STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </label>
        <label className="organizer-payments-field">
          <span>Từ ngày</span>
          <DayFirstDateInput
            type="date"
            aria-label="Lọc từ ngày"
            value={filters.from}
            aria-invalid={dateRangeInvalid || undefined}
            onChange={event => changeFilter({ from: event.target.value })}
          />
        </label>
        <label className="organizer-payments-field">
          <span>Đến ngày</span>
          <DayFirstDateInput
            type="date"
            aria-label="Lọc đến ngày"
            value={filters.to}
            aria-invalid={dateRangeInvalid || undefined}
            onChange={event => changeFilter({ to: event.target.value })}
          />
        </label>
        <label className="organizer-payments-field">
          <span>Sắp xếp</span>
          <select aria-label="Sắp xếp giao dịch" value={filters.sort} onChange={event => changeFilter({ sort: event.target.value as OrganizerPaymentSort })}>
            {Object.entries(SORT_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        {hasFilters && (
          <button
            type="button"
            className="btn-org-secondary"
            onClick={() => {
              setSearchInput('');
              changeFilter({ search: '', status: '', eventId: '', from: '', to: '' });
            }}
          >
            Xóa bộ lọc
          </button>
        )}
      </div>
      {dateRangeInvalid && (
        <p className="organizer-payments-filter-error" role="alert">"Từ ngày" phải trước hoặc trùng "Đến ngày".</p>
      )}

      {!dateRangeInvalid && loading && (
        <div className="organizer-payments-state" role="status"><LoaderCircle className="is-spinning" /><p>Đang tải lịch sử thanh toán...</p></div>
      )}
      {!dateRangeInvalid && !loading && error && (
        <div className="organizer-payments-state is-error" role="alert">
          <p>{error}</p>
          <button type="button" className="btn-org-secondary" onClick={() => setRevision(value => value + 1)}>
            <RefreshCw size={16} /> Thử lại
          </button>
        </div>
      )}
      {!dateRangeInvalid && !loading && !error && items.length === 0 && (
        <div className="organizer-payments-state">
          <CreditCard size={28} aria-hidden="true" />
          <p>{hasFilters ? 'Không có giao dịch nào khớp với bộ lọc.' : 'Sự kiện của bạn chưa có giao dịch thanh toán nào.'}</p>
        </div>
      )}
      {!dateRangeInvalid && !loading && !error && items.length > 0 && (
        <>
          <p className="organizer-payments-count">Có <strong>{total}</strong> giao dịch phù hợp</p>
          <div className="organizer-payments-table-wrap">
            <table className="organizer-payments-table">
              <thead>
                <tr>
                  <th>Thời gian</th>
                  <th>Sự kiện</th>
                  <th>Đối tác</th>
                  <th>Gian hàng</th>
                  <th className="is-amount">Số tiền</th>
                  <th>Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                {items.map(payment => (
                  <tr key={payment.boothPaymentId}>
                    <td>{paymentTime(payment.createdAt)}</td>
                    <td>{payment.event.name}</td>
                    <td>{payment.partnerOrganization.name}</td>
                    <td>
                      <strong>{payment.booth.code}</strong>
                      <small>{payment.booth.name}</small>
                    </td>
                    <td className="is-amount">{payment.transactionType === 'REFUND' ? '−' : ''}{paymentMoney(payment.amount)}</td>
                    <td>
                      <span className={`organizer-payment-status is-${payment.status.toLowerCase()}`}>
                        {ORGANIZER_PAYMENT_STATUS_LABELS[payment.status]}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {pages > 1 && (
            <nav className="organizer-payments-pagination" aria-label="Phân trang thanh toán">
              <button type="button" className="btn-org-secondary" disabled={page === 0} onClick={() => setPage(current => current - 1)}>
                Trang trước
              </button>
              <span>Trang {page + 1}/{pages}</span>
              <button type="button" className="btn-org-secondary" disabled={page + 1 >= pages} onClick={() => setPage(current => current + 1)}>
                Trang sau
              </button>
            </nav>
          )}
        </>
      )}
    </section>
  );
};
