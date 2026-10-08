import { Building2, MapPin, Package, Pencil, Plus, RefreshCw, Search, Store, Trash2, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { boothStatusLabels, notifyBoothsChanged } from '../../services/booths';
import { facilityRequest, type Facility, type FacilityInput, type FacilityKind } from '../../services/facilities';
import '../BoothBookingView.css';
import './FacilityManagementView.css';

const labels = { venues: 'địa điểm', assets: 'thiết bị', booths: 'gian hàng' };
const titles = { venues: 'Địa điểm tổ chức', assets: 'Quản lý thiết bị', booths: 'Danh mục gian hàng' };

export function FacilityManagementView({ kind }: { kind: FacilityKind }) {
  const [rows, setRows] = useState<Facility[]>([]);
  const [campuses, setCampuses] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [campus, setCampus] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [revision, setRevision] = useState(0);
  const [editing, setEditing] = useState<Facility | 'new' | null>(null);
  const [deleting, setDeleting] = useState<Facility | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [form, setForm] = useState({ name: '', campus: '', amount: '' });
  const dialog = useRef<HTMLDialogElement>(null);
  const asset = kind === 'assets';
  const Icon = asset ? Package : kind === 'venues' ? Building2 : Store;

  useEffect(() => {
    if (kind !== 'booths') return;
    const refresh = () => setRevision(value => value + 1);
    const interval = setInterval(() => { if (document.visibilityState === 'visible') refresh(); }, 5000);
    window.addEventListener('focus', refresh);
    window.addEventListener('booths-changed', refresh);
    return () => { clearInterval(interval); window.removeEventListener('focus', refresh); window.removeEventListener('booths-changed', refresh); };
  }, [kind]);

  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      setLoading(true);
      setError('');
      const query = new URLSearchParams({ search, campus });
      facilityRequest<{ data: Facility[]; campuses: string[] }>(`${kind}?${query}`, { signal: controller.signal })
        .then(result => { setRows(result.data); setCampuses(result.campuses); })
        .catch(err => { if (!controller.signal.aborted) setError(err.message); })
        .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    }, 250);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [kind, search, campus, revision]);

  useEffect(() => {
    if (editing || deleting) dialog.current?.showModal();
    else dialog.current?.close();
  }, [editing, deleting]);

  function close() {
    if (saving) return;
    setEditing(null); setDeleting(null); setFormError('');
  }

  function open(item: Facility | 'new') {
    setForm(item === 'new' ? { name: '', campus: '', amount: '' } : {
      name: item.name, campus: item.campus, amount: String(asset ? item.totalQuantity : item.capacity),
    });
    setFormError(''); setNotice(''); setEditing(item);
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (saving) return;
    setSaving(true); setFormError(''); setNotice('');
    try {
      if (deleting) {
        await facilityRequest(`${kind}/${deleting.id}`, { method: 'DELETE' });
      } else {
        const input: FacilityInput = { name: form.name.trim() };
        if (asset) input.totalQuantity = Number(form.amount);
        else {
          input.campus = form.campus.trim();
          if (kind === 'venues') input.capacity = Number(form.amount);
        }
        await facilityRequest(editing === 'new' ? kind : `${kind}/${(editing as Facility).id}`, {
          method: editing === 'new' ? 'POST' : 'PUT', body: JSON.stringify(input),
        });
      }
      setNotice(deleting ? `Đã xóa ${labels[kind]}.` : `Đã lưu ${labels[kind]} thành công.`);
      setEditing(null); setDeleting(null); setRevision(value => value + 1);
      if (kind === 'booths') notifyBoothsChanged();
    } catch (err) { setFormError(err instanceof Error ? err.message : 'Không thể lưu dữ liệu.'); }
    finally { setSaving(false); }
  }

  return <section className="facility-page">
    <header className="facility-heading">
      <div><span className="facility-eyebrow">GIAN HÀNG & CƠ SỞ VẬT CHẤT</span><h1>{titles[kind]}</h1>
        <p>{asset ? 'Theo dõi danh mục và tổng số lượng thiết bị phục vụ hoạt động.' : kind === 'booths' ? 'Gian hàng mới ở trạng thái còn trống để đối tác đăng ký. Organizer duyệt yêu cầu trước khi phân bổ.' : 'Quản lý không gian và cơ sở phục vụ các hoạt động tại Đường Sách.'}</p></div>
      <button className="facility-button primary" onClick={() => open('new')}><Plus size={18} />Thêm {labels[kind]}</button>
    </header>
    <div className="facility-summary">
      <div className="facility-stat"><span className="facility-stat-icon"><Icon size={24} /></span><div><span>{search || campus ? 'Kết quả phù hợp' : 'Trong danh mục'}</span><strong>{loading || error ? '—' : rows.length}<small>{labels[kind]}</small></strong></div></div>
      {kind !== 'booths' && <div className="facility-stat"><span className="facility-stat-icon gold"><Package size={24} /></span><div><span>{asset ? 'Tổng số lượng trong danh sách' : 'Tổng sức chứa trong danh sách'}</span><strong>{loading || error ? '—' : rows.reduce((total, row) => total + (asset ? row.totalQuantity : row.capacity), 0).toLocaleString('vi-VN')}<small>{asset ? 'thiết bị' : 'người'}</small></strong></div></div>}
    </div>
    {notice && <div className="facility-notice" role="status">{notice}</div>}
    <div className="facility-panel">
      <div className="facility-toolbar">
        <label className="facility-search"><Search size={18} /><input aria-label={`Tìm tên ${labels[kind]}`} placeholder={`Tìm theo tên ${labels[kind]}…`} value={search} onChange={e => setSearch(e.target.value)} /></label>
        {!asset && <label className="facility-filter"><MapPin size={17} /><select aria-label="Lọc theo cơ sở" value={campus} onChange={e => setCampus(e.target.value)}><option value="">Tất cả cơ sở</option>{campuses.map(value => <option key={value}>{value}</option>)}</select></label>}
        <button className="facility-button" disabled={loading} onClick={() => setRevision(value => value + 1)} aria-label="Tải lại danh sách"><RefreshCw size={17} /></button>
      </div>
      {error ? <div className="facility-empty" role="alert"><p>{error}</p><button className="facility-button" onClick={() => setRevision(value => value + 1)}>Thử lại</button></div> : loading ? <div className="facility-empty" role="status">Đang tải danh sách…</div> : rows.length === 0 ?
        <div className="facility-empty"><Icon size={38} /><h3>{search || campus ? 'Không tìm thấy kết quả' : `Chưa có ${labels[kind]}`}</h3><p>{search || campus ? 'Thử thay đổi từ khóa hoặc cơ sở đã chọn.' : `Thêm ${labels[kind]} đầu tiên để bắt đầu quản lý.`}</p><button className="facility-button" onClick={() => { if (search || campus) { setSearch(''); setCampus(''); } else open('new'); }}>{search || campus ? 'Xóa bộ lọc' : `Thêm ${labels[kind]}`}</button></div> :
        <div className="facility-table-scroll"><table><caption className="facility-sr-only">Danh sách {labels[kind]}</caption><thead><tr><th scope="col">Tên {labels[kind]}</th>{!asset && <th scope="col">Cơ sở</th>}{kind === 'booths' ? <th scope="col">Trạng thái</th> : <th scope="col">{asset ? 'Tổng số lượng' : 'Sức chứa'}</th>}<th scope="col" className="facility-actions">Thao tác</th></tr></thead><tbody>{rows.map(row => <tr key={row.id}><td><div className="facility-name"><span className="facility-row-icon"><Icon size={19} /></span><strong>{row.name}</strong></div></td>{!asset && <td>{row.campus}</td>}{kind === 'booths' ? <td><span className={`booth-status ${row.status}`}>{row.status ? boothStatusLabels[row.status] : 'Chưa xác định'}</span></td> : <td><span className="facility-quantity">{(asset ? row.totalQuantity : row.capacity).toLocaleString('vi-VN')}</span> <span className="facility-muted">{asset ? 'thiết bị' : 'người'}</span></td>}<td><div className="facility-row-actions"><button disabled={kind === 'booths' && row.status !== 'available'} onClick={() => open(row)} aria-label={`Sửa ${row.name}`} title={kind === 'booths' && row.status !== 'available' ? 'Chỉ sửa gian hàng còn trống' : 'Chỉnh sửa'}><Pencil size={17} /></button><button disabled={kind === 'booths' && row.status !== 'available'} className="danger" onClick={() => { setFormError(''); setDeleting(row); }} aria-label={`Xóa ${row.name}`} title={kind === 'booths' && row.status !== 'available' ? 'Chỉ xóa gian hàng còn trống' : 'Xóa'}><Trash2 size={17} /></button></div></td></tr>)}</tbody></table></div>}
      {!loading && !error && <footer className="facility-table-footer">Hiển thị {rows.length} {labels[kind]}{campus ? ` · ${campus}` : ''}</footer>}
    </div>
    <dialog ref={dialog} className="facility-dialog" aria-labelledby="facility-dialog-title" onCancel={event => { event.preventDefault(); close(); }}>
      <form onSubmit={save}>
        <div className="facility-dialog-heading"><div><span className="facility-eyebrow">CƠ SỞ VẬT CHẤT</span><h2 id="facility-dialog-title">{deleting ? 'Xóa' : editing === 'new' ? 'Thêm' : 'Chỉnh sửa'} {labels[kind]}</h2></div><button type="button" disabled={saving} className="facility-close" onClick={close} aria-label="Đóng"><X size={20} /></button></div>
        {deleting ? <p className="facility-delete-copy">Bạn muốn xóa <strong>{deleting.name}</strong>? Mục này sẽ được ẩn khỏi danh sách; dữ liệu vẫn được lưu trong hệ thống.</p> : <div className="facility-fields">
          <label>Tên {labels[kind]} <span>*</span><input autoFocus required maxLength={120} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder={asset ? 'Ví dụ: Micro không dây' : 'Nhập tên'} /></label>
          {!asset && <label>Cơ sở <span>*</span><input required maxLength={120} list="facility-campuses" value={form.campus} onChange={e => setForm({ ...form, campus: e.target.value })} placeholder="Chọn hoặc nhập tên cơ sở" /><datalist id="facility-campuses">{campuses.map(value => <option key={value} value={value} />)}</datalist></label>}
          {kind !== 'booths' && <label>{asset ? 'Tổng số lượng' : 'Sức chứa (người)'} <span>*</span><input type="number" required min={asset ? 0 : 1} max={1000000} step={1} value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} placeholder={asset ? 'Ví dụ: 20' : 'Ví dụ: 100'} /><small>{asset ? 'Nhập tổng số thiết bị hiện có, bao gồm cả thiết bị đang sử dụng.' : 'Số người tối đa địa điểm có thể phục vụ.'}</small></label>}
        </div>}
        {formError && <p className="facility-error" role="alert">{formError}</p>}
        <div className="facility-dialog-footer"><button type="button" className="facility-button" disabled={saving} onClick={close}>Hủy</button><button className={`facility-button ${deleting ? 'delete' : 'primary'}`} disabled={saving}>{saving ? 'Đang lưu…' : deleting ? 'Xác nhận xóa' : 'Lưu thông tin'}</button></div>
      </form>
    </dialog>
  </section>;
}
