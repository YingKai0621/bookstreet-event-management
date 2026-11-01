import {
  Archive,
  Check,
  ExternalLink,
  FilePenLine,
  Image as ImageIcon,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Send,
  Trash2,
  X,
} from 'lucide-react';
import React, { useDeferredValue, useEffect, useRef, useState } from 'react';
import { LIST_PAGE_SIZE, getPageCount, getPageOffset, toPageIndex } from '../../constants/pagination';
import { useModalDismiss } from '../../hooks/useModalDismiss';
import { ApiError } from '../../services/apiClient';
import { organizerApi } from '../../services/organizerApi';
import type { Language } from '../../types';
import type {
  CreateHeritageRequest,
  HeritageStatus,
  OrganizerHeritageDetail,
  OrganizerHeritageListItem,
  UpdateHeritageRequest,
} from '../../types/heritage';
import { ListPagination } from '../ui/ListPagination';
import './OrganizerPublicContentView.css';

interface OrganizerPublicContentViewProps {
  language: Language;
}

interface HeritageForm {
  publicCode: string;
  title: string;
  summary: string;
  content: string;
  imageUrl: string;
  locationText: string;
}

type EditorState =
  | { kind: 'new' }
  | { kind: 'edit'; heritageContentId: number; detail: OrganizerHeritageDetail | null };

type HeritageSort = 'updatedAt,desc' | 'updatedAt,asc' | 'title,asc' | 'title,desc';
type HeritageAction = 'publish' | 'archive' | 'republish' | 'delete';

const EMPTY_FORM: HeritageForm = {
  publicCode: '',
  title: '',
  summary: '',
  content: '',
  imageUrl: '',
  locationText: '',
};

const STATUS_LABELS: Record<HeritageStatus, string> = {
  DRAFT: 'Bản nháp',
  PUBLISHED: 'Đã công bố',
  ARCHIVED: 'Đã lưu trữ',
};

function normalizeOptional(value: string): string | null {
  return value.trim() || null;
}

function friendlyError(cause: unknown, fallback: string): string {
  if (!(cause instanceof ApiError)) {
    return cause instanceof Error && cause.message ? cause.message : fallback;
  }

  const messages: Record<string, string> = {
    HERITAGE_PUBLIC_CODE_CONFLICT: 'Mã công khai đã được sử dụng. Vui lòng chọn mã khác.',
    HERITAGE_STALE_WRITE: 'Nội dung vừa được Organizer khác cập nhật.',
    HERITAGE_TRANSITION_CONFLICT: 'Trạng thái hiện tại không cho phép thao tác này.',
    HERITAGE_DELETE_CONFLICT: 'Chỉ có thể xóa nội dung đang ở trạng thái bản nháp.',
    HERITAGE_NOT_FOUND: 'Không tìm thấy nội dung di sản này.',
    ACCESS_DENIED: 'Tài khoản hiện tại không có quyền quản lý nội dung di sản.',
  };
  if (messages[cause.code]) return messages[cause.code];
  if (cause.fieldErrors.length) return cause.fieldErrors.map(error => error.message).join(' ');
  if (!cause.message || /JDBC|executing SQL|Hibernate|SQLException/i.test(cause.message)) return fallback;
  return cause.message;
}

function validateForm(form: HeritageForm, creating: boolean): string {
  const code = form.publicCode.trim().toUpperCase();
  const title = form.title.trim().replace(/\s+/g, ' ');
  const content = form.content.replace(/\r\n?/g, '\n').trim();
  if (creating && (code.length < 3 || code.length > 100 || !/^[A-Z][A-Z0-9]*(-[A-Z0-9]+)*$/.test(code))) {
    return 'Mã công khai phải có 3–100 ký tự, bắt đầu bằng chữ cái và chỉ dùng A–Z, 0–9 hoặc dấu gạch ngang.';
  }
  if (title.length < 2 || title.length > 200) return 'Tiêu đề phải có từ 2 đến 200 ký tự.';
  if (form.summary.trim().length > 1000) return 'Tóm tắt không được vượt quá 1.000 ký tự.';
  if (content.length < 20 || content.length > 20000) return 'Nội dung phải có từ 20 đến 20.000 ký tự.';
  if (form.locationText.trim().length > 255) return 'Địa điểm hiển thị không được vượt quá 255 ký tự.';
  if (form.imageUrl.trim().length > 2048) return 'Đường dẫn ảnh không được vượt quá 2.048 ký tự.';
  return '';
}

function formFromDetail(detail: OrganizerHeritageDetail): HeritageForm {
  return {
    publicCode: detail.publicCode,
    title: detail.title,
    summary: detail.summary || '',
    content: detail.content,
    imageUrl: detail.imageUrl || '',
    locationText: detail.locationText || '',
  };
}

export const OrganizerPublicContentView: React.FC<OrganizerPublicContentViewProps> = ({ language }) => {
  const vi = language === 'vi';
  const [rows, setRows] = useState<OrganizerHeritageListItem[]>([]);
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search.trim());
  const [status, setStatus] = useState<HeritageStatus | ''>('');
  const [sort, setSort] = useState<HeritageSort>('updatedAt,desc');
  const [page, setPage] = useState(0);
  const [totalElements, setTotalElements] = useState(0);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState('');
  const [notice, setNotice] = useState('');
  const [actionError, setActionError] = useState('');
  const [revision, setRevision] = useState(0);
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [form, setForm] = useState<HeritageForm>(EMPTY_FORM);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [mutatingId, setMutatingId] = useState<number | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const detailRequest = useRef(0);

  useModalDismiss(Boolean(editor), () => {
    if (!saving) {
      detailRequest.current += 1;
      setEditor(null);
    }
  });

  useEffect(() => {
    let active = true;
    // The loading state follows the current server-owned filters.
    // oxlint-disable-next-line react/set-state-in-effect
    setLoading(true);
    setListError('');
    void organizerApi.listHeritages({
      page,
      size: LIST_PAGE_SIZE,
      sort,
      search: deferredSearch || undefined,
      status: status || undefined,
    }).then(response => {
      if (!active) return;
      setRows(response.content);
      setTotalElements(response.totalElements);
      const pageCount = getPageCount(response.totalElements, LIST_PAGE_SIZE);
      if (page >= pageCount) setPage(toPageIndex(pageCount));
    }).catch(cause => {
      if (!active) return;
      setRows([]);
      setTotalElements(0);
      setListError(friendlyError(cause, 'Không tải được danh sách di sản. Vui lòng thử lại.'));
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [deferredSearch, page, revision, sort, status]);

  useEffect(() => {
    if (editor) dialog.current?.showModal();
    else dialog.current?.close();
  }, [editor]);

  const setField = <K extends keyof HeritageForm>(field: K, value: HeritageForm[K]) => {
    setForm(current => ({ ...current, [field]: value }));
    setFormError('');
  };

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setFormError('');
    setActionError('');
    setNotice('');
    setEditor({ kind: 'new' });
  };

  const openEdit = async (item: OrganizerHeritageListItem) => {
    const requestId = detailRequest.current + 1;
    detailRequest.current = requestId;
    setEditor({ kind: 'edit', heritageContentId: item.heritageContentId, detail: null });
    setForm(EMPTY_FORM);
    setFormError('');
    setActionError('');
    setLoadingDetail(true);
    try {
      const detail = await organizerApi.getHeritage(item.heritageContentId);
      if (detailRequest.current !== requestId) return;
      setEditor({ kind: 'edit', heritageContentId: item.heritageContentId, detail });
      setForm(formFromDetail(detail));
    } catch (cause) {
      if (detailRequest.current !== requestId) return;
      setFormError(friendlyError(cause, 'Không tải được chi tiết di sản.'));
    } finally {
      if (detailRequest.current === requestId) setLoadingDetail(false);
    }
  };

  const closeEditor = () => {
    if (saving) return;
    detailRequest.current += 1;
    setEditor(null);
    setFormError('');
    setLoadingDetail(false);
  };

  const reloadLatestToken = async (heritageContentId: number) => {
    try {
      const detail = await organizerApi.getHeritage(heritageContentId);
      setEditor(current => current?.kind === 'edit' && current.heritageContentId === heritageContentId
        ? { ...current, detail }
        : current);
      return true;
    } catch {
      return false;
    }
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!editor || saving || loadingDetail) return;
    const validationError = validateForm(form, editor.kind === 'new');
    if (validationError) {
      setFormError(validationError);
      return;
    }

    setSaving(true);
    setFormError('');
    try {
      if (editor.kind === 'new') {
        const request: CreateHeritageRequest = {
          publicCode: form.publicCode.trim().toUpperCase(),
          title: form.title.trim().replace(/\s+/g, ' '),
          summary: normalizeOptional(form.summary),
          content: form.content.replace(/\r\n?/g, '\n').trim(),
          imageUrl: normalizeOptional(form.imageUrl),
          locationText: normalizeOptional(form.locationText),
        };
        await organizerApi.createHeritage(request);
        setNotice('Đã tạo nội dung di sản ở trạng thái bản nháp.');
      } else {
        if (!editor.detail) return;
        const request: UpdateHeritageRequest = {
          title: form.title.trim().replace(/\s+/g, ' '),
          summary: normalizeOptional(form.summary),
          content: form.content.replace(/\r\n?/g, '\n').trim(),
          imageUrl: normalizeOptional(form.imageUrl),
          locationText: normalizeOptional(form.locationText),
          expectedUpdatedAt: editor.detail.updatedAt,
        };
        await organizerApi.updateHeritage(editor.heritageContentId, request);
        setNotice('Đã cập nhật nội dung di sản.');
      }
      setEditor(null);
      setRevision(value => value + 1);
    } catch (cause) {
      if (cause instanceof ApiError && cause.code === 'HERITAGE_STALE_WRITE' && editor.kind === 'edit') {
        const refreshed = await reloadLatestToken(editor.heritageContentId);
        setFormError(refreshed
          ? 'Nội dung vừa được Organizer khác cập nhật. Phiên bản dữ liệu mới nhất đã được tải và phần bạn đang nhập vẫn được giữ lại. Hãy kiểm tra rồi lưu lại.'
          : 'Nội dung vừa được Organizer khác cập nhật. Không thể tải lại dữ liệu mới nhất. Vui lòng đóng biểu mẫu và thử lại.');
      } else {
        setFormError(friendlyError(cause, 'Không thể lưu nội dung di sản. Vui lòng thử lại.'));
      }
    } finally {
      setSaving(false);
    }
  };

  const runAction = async (item: OrganizerHeritageListItem, action: HeritageAction) => {
    if (mutatingId !== null) return;
    const confirmations: Record<HeritageAction, string> = {
      publish: `Công bố “${item.title}” trên trang công khai?`,
      archive: `Lưu trữ “${item.title}” và gỡ khỏi trang công khai?`,
      republish: `Công bố lại “${item.title}” trên trang công khai?`,
      delete: `Xóa vĩnh viễn bản nháp “${item.title}”?`,
    };
    if (!window.confirm(confirmations[action])) return;

    setMutatingId(item.heritageContentId);
    setActionError('');
    setNotice('');
    try {
      if (action === 'publish') await organizerApi.publishHeritage(item.heritageContentId, item.updatedAt);
      if (action === 'archive') await organizerApi.archiveHeritage(item.heritageContentId, item.updatedAt);
      if (action === 'republish') await organizerApi.republishHeritage(item.heritageContentId, item.updatedAt);
      if (action === 'delete') await organizerApi.deleteHeritage(item.heritageContentId, item.updatedAt);
      const messages: Record<HeritageAction, string> = {
        publish: 'Đã công bố nội dung di sản.',
        archive: 'Đã lưu trữ nội dung di sản.',
        republish: 'Đã công bố lại nội dung di sản.',
        delete: 'Đã xóa bản nháp di sản.',
      };
      setNotice(messages[action]);
      setRevision(value => value + 1);
    } catch (cause) {
      setActionError(friendlyError(cause, 'Không thể thực hiện thao tác. Vui lòng thử lại.'));
      if (cause instanceof ApiError && [
        'HERITAGE_STALE_WRITE',
        'HERITAGE_TRANSITION_CONFLICT',
        'HERITAGE_DELETE_CONFLICT',
      ].includes(cause.code)) {
        setRevision(value => value + 1);
      }
    } finally {
      setMutatingId(null);
    }
  };

  const hasFilters = Boolean(search.trim() || status || sort !== 'updatedAt,desc');
  const clearFilters = () => {
    setSearch('');
    setStatus('');
    setSort('updatedAt,desc');
    setPage(0);
  };

  return (
    <section className="org-dashboard organizer-heritage-page">
      <header className="org-dashboard-header heritage-management-heading">
        <div>
          <h1 className="org-dashboard-title workspace-page-title">{vi ? 'Nội dung di sản' : 'Heritage content'}</h1>
          <p className="org-dashboard-subtitle workspace-page-subtitle">
            {vi ? 'Quản lý các câu chuyện di sản hiển thị trên trang công khai.' : 'Manage heritage stories shown on the public website.'}
          </p>
        </div>
        <button type="button" className="btn-org-primary" onClick={openCreate}><Plus size={18} />{vi ? 'Thêm nội dung' : 'Add content'}</button>
      </header>

      {notice && <div className="heritage-management-notice" role="status"><Check size={18} />{notice}</div>}
      {actionError && <div className="heritage-management-error" role="alert">{actionError}</div>}

      <div className="org-dashboard-panel heritage-management-panel" aria-busy={loading}>
        <div className="org-dashboard-panel-heading heritage-management-list-heading">
          <div><h2>Danh sách nội dung</h2><p>Tìm kiếm, cập nhật và kiểm soát trạng thái công bố.</p></div>
          {hasFilters && <button type="button" className="org-dashboard-text-action" onClick={clearFilters}><X size={15} />Xóa bộ lọc</button>}
        </div>

        <div className="heritage-management-toolbar">
          <label className="heritage-management-search"><Search size={18} /><input aria-label="Tìm nội dung di sản" maxLength={100} placeholder="Tìm theo mã, tiêu đề hoặc địa điểm…" value={search} onChange={event => { setSearch(event.target.value); setPage(0); }} /></label>
          <label className="heritage-management-filter"><span>Trạng thái</span><select aria-label="Lọc trạng thái di sản" value={status} onChange={event => { setStatus(event.target.value as HeritageStatus | ''); setPage(0); }}><option value="">Tất cả trạng thái</option><option value="DRAFT">Bản nháp</option><option value="PUBLISHED">Đã công bố</option><option value="ARCHIVED">Đã lưu trữ</option></select></label>
          <label className="heritage-management-filter"><span>Sắp xếp</span><select aria-label="Sắp xếp di sản" value={sort} onChange={event => { setSort(event.target.value as HeritageSort); setPage(0); }}><option value="updatedAt,desc">Mới cập nhật</option><option value="updatedAt,asc">Cũ cập nhật</option><option value="title,asc">Tiêu đề A–Z</option><option value="title,desc">Tiêu đề Z–A</option></select></label>
          <button type="button" className="btn-org-secondary" disabled={loading} onClick={() => setRevision(value => value + 1)} aria-label="Tải lại danh sách"><RefreshCw size={17} /></button>
        </div>

        {listError ? (
          <div className="heritage-management-empty" role="alert"><p>{listError}</p><button type="button" className="btn-org-secondary" onClick={() => setRevision(value => value + 1)}>Thử lại</button></div>
        ) : loading ? (
          <div className="heritage-management-empty" role="status">Đang tải nội dung di sản…</div>
        ) : rows.length === 0 ? (
          <div className="heritage-management-empty"><ImageIcon size={34} /><h3>{hasFilters ? 'Không tìm thấy nội dung phù hợp' : 'Chưa có nội dung di sản'}</h3><p>{hasFilters ? 'Thử từ khóa khác hoặc xóa bộ lọc để xem lại danh sách.' : 'Tạo bản nháp đầu tiên để bắt đầu xây dựng không gian di sản.'}</p><button type="button" className="btn-org-secondary" onClick={hasFilters ? clearFilters : openCreate}>{hasFilters ? 'Xóa bộ lọc' : 'Thêm nội dung'}</button></div>
        ) : (
          <div className="heritage-management-grid">
            {rows.map(item => (
              <article key={item.heritageContentId} className="heritage-management-card">
                <div className="heritage-management-image">
                  {item.imageUrl ? <img src={item.imageUrl} alt={`Ảnh minh họa: ${item.title}`} /> : <ImageIcon size={34} aria-hidden="true" />}
                  <span className={`heritage-management-status is-${item.status.toLowerCase()}`}>{STATUS_LABELS[item.status]}</span>
                </div>
                <div className="heritage-management-card-body">
                  <div className="heritage-management-card-title"><h3>{item.title}</h3><code>{item.publicCode}</code></div>
                  {item.locationText && <p className="heritage-management-location">{item.locationText}</p>}
                  <p className="heritage-management-summary">{item.summary || 'Chưa có phần tóm tắt.'}</p>
                  <small>Cập nhật {new Date(item.updatedAt).toLocaleString('vi-VN')}</small>
                  <div className="heritage-management-actions">
                    <button type="button" className="org-dashboard-text-action" disabled={mutatingId !== null} onClick={() => void openEdit(item)}><FilePenLine size={15} />Xem và chỉnh sửa</button>
                    {item.status === 'DRAFT' && <button type="button" className="org-dashboard-text-action is-positive" disabled={mutatingId !== null} onClick={() => void runAction(item, 'publish')}><Send size={15} />Công bố</button>}
                    {item.status === 'PUBLISHED' && <><a className="org-dashboard-text-action" href={`/di-san/${encodeURIComponent(item.publicCode)}`} target="_blank" rel="noreferrer"><ExternalLink size={15} />Trang công khai</a><button type="button" className="org-dashboard-text-action" disabled={mutatingId !== null} onClick={() => void runAction(item, 'archive')}><Archive size={15} />Lưu trữ</button></>}
                    {item.status === 'ARCHIVED' && <button type="button" className="org-dashboard-text-action is-positive" disabled={mutatingId !== null} onClick={() => void runAction(item, 'republish')}><RotateCcw size={15} />Công bố lại</button>}
                    {item.status === 'DRAFT' && <button type="button" className="org-dashboard-text-action is-danger" disabled={mutatingId !== null} onClick={() => void runAction(item, 'delete')}><Trash2 size={15} />Xóa</button>}
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}

        {!loading && !listError && <footer className="heritage-management-footer"><span>{totalElements === 0 ? '0 nội dung' : `${getPageOffset(page + 1, LIST_PAGE_SIZE) + 1}–${getPageOffset(page + 1, LIST_PAGE_SIZE) + rows.length} trong ${totalElements} nội dung`}</span><ListPagination page={page + 1} pages={getPageCount(totalElements, LIST_PAGE_SIZE)} onPage={value => setPage(toPageIndex(value))} /></footer>}
      </div>

      <dialog ref={dialog} className="heritage-management-dialog" aria-labelledby="heritage-dialog-title" onCancel={event => { event.preventDefault(); closeEditor(); }}>
        <form noValidate onSubmit={save}>
          <div className="org-dashboard-panel-heading heritage-management-dialog-heading"><div><h2 id="heritage-dialog-title">{editor?.kind === 'new' ? 'Thêm nội dung di sản' : 'Chi tiết nội dung di sản'}</h2><p>{editor?.kind === 'new' ? 'Nội dung mới luôn được tạo ở trạng thái bản nháp.' : 'Mã công khai và trạng thái được hệ thống quản lý.'}</p></div><button type="button" className="heritage-management-close" disabled={saving} onClick={closeEditor} aria-label="Đóng"><X size={20} /></button></div>
          {loadingDetail ? <div className="heritage-management-dialog-loading" role="status">Đang tải chi tiết…</div> : (
            <div className="heritage-management-fields">
              <label>Mã công khai <span>*</span><input autoFocus={editor?.kind === 'new'} required disabled={editor?.kind === 'edit'} maxLength={100} value={form.publicCode} onChange={event => setField('publicCode', event.target.value.toUpperCase())} placeholder="Ví dụ: BUU-DIEN-TP-HCM" /><small>Dùng cho đường dẫn công khai và không thể đổi sau khi tạo.</small></label>
              <label>Địa điểm hiển thị<input maxLength={255} value={form.locationText} onChange={event => setField('locationText', event.target.value)} placeholder="Ví dụ: Công xã Paris, Quận 1" /></label>
              <label className="heritage-management-wide">Tiêu đề <span>*</span><input required minLength={2} maxLength={200} value={form.title} onChange={event => setField('title', event.target.value)} /></label>
              <label className="heritage-management-wide">Tóm tắt<textarea maxLength={1000} rows={3} value={form.summary} onChange={event => setField('summary', event.target.value)} /><small>{form.summary.length}/1000</small></label>
              <label className="heritage-management-wide">Nội dung <span>*</span><textarea required minLength={20} maxLength={20000} rows={10} value={form.content} onChange={event => setField('content', event.target.value)} placeholder="Viết câu chuyện di sản bằng văn bản thuần…" /><small>{form.content.length}/20000</small></label>
              <label className="heritage-management-wide">Đường dẫn ảnh<input maxLength={2048} value={form.imageUrl} onChange={event => setField('imageUrl', event.target.value)} placeholder="https://… hoặc /assets/heritage/…" /><small>Chấp nhận HTTP, HTTPS hoặc đường dẫn bắt đầu bằng /assets/heritage/.</small></label>
            </div>
          )}
          {formError && <p className="heritage-management-form-error" role="alert">{formError}</p>}
          <div className="heritage-management-dialog-footer"><button type="button" className="btn-org-secondary" disabled={saving} onClick={closeEditor}>Hủy</button><button type="submit" className="btn-org-primary" disabled={saving || loadingDetail || Boolean(editor?.kind === 'edit' && !editor.detail)}>{saving ? 'Đang lưu…' : editor?.kind === 'new' ? 'Tạo bản nháp' : 'Lưu cập nhật'}</button></div>
        </form>
      </dialog>
    </section>
  );
};
