import { Image as ImageIcon, Upload } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import './ImageUrlField.css';

interface ImageUrlFieldProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  disabled?: boolean;
  onBusyChange?: (busy: boolean) => void;
  language?: 'vi' | 'en';
  uploadFile: (file: File) => Promise<string>;
}

export function ImageUrlField({ value, onChange, label, disabled = false, onBusyChange, language = 'vi', uploadFile }: ImageUrlFieldProps) {
  const id = useId();
  const fileInput = useRef<HTMLInputElement>(null);
  const generation = useRef(0);
  const busyCallback = useRef(onBusyChange);
  useEffect(() => { busyCallback.current = onBusyChange; }, [onBusyChange]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [failedUrl, setFailedUrl] = useState('');
  const vi = language === 'vi';
  useEffect(() => () => { generation.current += 1; busyCallback.current?.(false); }, []);

  async function upload(file?: File) {
    if (!file) return;
    setError('');
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size === 0 || file.size > 5 * 1024 * 1024) {
      setError(vi ? 'Chọn ảnh JPG, PNG hoặc WebP, tối đa 5 MB.' : 'Choose a JPG, PNG or WebP image, up to 5 MB.');
      return;
    }
    const request = ++generation.current;
    setUploading(true);
    onBusyChange?.(true);
    try {
      const imageUrl = await uploadFile(file);
      if (generation.current !== request) return;
      onChange(imageUrl);
      setFailedUrl('');
    } catch {
      if (generation.current === request) setError(vi ? 'Không tải được ảnh. Vui lòng thử lại.' : 'Image upload failed. Please try again.');
    } finally {
      if (generation.current === request) {
        setUploading(false);
        onBusyChange?.(false);
      }
    }
  }

  return <div className="image-url-field">
    <label htmlFor={id}>{label || (vi ? 'Đường dẫn ảnh' : 'Image URL')}</label>
    <div className="image-url-field-controls">
      <input id={id} type="text" inputMode="url" maxLength={2048} value={value} placeholder="https://..." disabled={disabled || uploading} onChange={event => { setError(''); setFailedUrl(''); onChange(event.target.value); }} />
      <button type="button" disabled={disabled || uploading} onClick={() => fileInput.current?.click()}><Upload size={16} aria-hidden="true" />{uploading ? (vi ? 'Đang tải…' : 'Uploading…') : (vi ? 'Chọn ảnh từ máy' : 'Choose from device')}</button>
      <input ref={fileInput} className="image-url-file-input" type="file" accept="image/jpeg,image/png,image/webp" tabIndex={-1} aria-label={vi ? 'Chọn ảnh từ thiết bị' : 'Choose an image'} disabled={disabled || uploading} onChange={event => { void upload(event.target.files?.[0]); event.target.value = ''; }} />
    </div>
    <small>{vi ? 'JPG, PNG hoặc WebP · Tối đa 5 MB' : 'JPG, PNG or WebP · Up to 5 MB'}</small>
    <div className="image-url-field-preview" aria-label={vi ? 'Xem trước ảnh' : 'Image preview'} aria-busy={uploading}>
      {value.trim() && failedUrl !== value ? <img key={value} src={value.trim()} alt={vi ? 'Ảnh xem trước' : 'Preview'} onError={() => setFailedUrl(value)} /> : <><ImageIcon size={28} aria-hidden="true" /><span>{value.trim() ? (vi ? 'Không tải được ảnh từ liên kết này' : 'Unable to load this image') : (vi ? 'Ảnh xem trước sẽ xuất hiện tại đây' : 'Your image preview will appear here')}</span></>}
    </div>
    {error && <p className="image-url-field-error" role="alert">{error}</p>}
  </div>;
}
