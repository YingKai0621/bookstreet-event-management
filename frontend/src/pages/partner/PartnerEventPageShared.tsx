import { BookOpen, CalendarDays, Clock3, RefreshCw } from 'lucide-react';
import React, { useState } from 'react';
import { formatPartnerEventDateTime } from './PartnerEventPageUtils';

interface PartnerEventHeroProps {
  title: string;
  description: string;
  breadcrumb: string;
  isLoading: boolean;
  onRefresh: () => void;
}

export function PartnerEventHero({ title, description, isLoading, onRefresh }: PartnerEventHeroProps) {
  return (
    <header className="event-hub-hero">
      <div className="event-hub-hero-copy">

        <h1 className="workspace-page-title">{title}</h1>
        <p className="workspace-page-subtitle">{description}</p>
      </div>
      <div className="event-hub-hero-visual" aria-hidden="true" />
      <button type="button" className="event-hub-refresh" onClick={onRefresh} disabled={isLoading}>
        <RefreshCw size={16} className={isLoading ? 'event-hub-spin' : ''} />
        {isLoading ? 'Đang cập nhật…' : 'Làm mới dữ liệu'}
      </button>
    </header>
  );
}

export function PartnerEventLoading({ label }: { label: string }) {
  return (
    <div className="event-hub-loading" role="status">
      <RefreshCw size={26} className="event-hub-spin" />
      <strong>{label}</strong>
    </div>
  );
}

export function PartnerApplicationThumbnail({ imageUrl, title }: { imageUrl: string; title: string }) {
  const [imageFailed, setImageFailed] = useState(false);
  const hasImage = Boolean(imageUrl) && !imageFailed;

  return (
    <div className={`event-application-thumbnail ${hasImage ? 'has-image' : 'is-fallback'}`}>
      {hasImage ? (
        <img src={imageUrl} alt={`Ảnh sự kiện ${title}`} onError={() => setImageFailed(true)} />
      ) : (
        <div className="event-application-placeholder" aria-label="Sự kiện Đường Sách chưa có ảnh">
          <BookOpen size={30} />
        </div>
      )}
    </div>
  );
}

export function PartnerEventMeta({ startAt, endAt, deadline }: { startAt?: string; endAt?: string; deadline?: string | null }) {
  return (
    <div className="event-discovery-meta">
      <span><CalendarDays size={15} /><strong>{formatPartnerEventDateTime(startAt)}</strong> – {formatPartnerEventDateTime(endAt)}</span>
      {deadline && <span><Clock3 size={15} />Hạn đăng ký: <strong>{formatPartnerEventDateTime(deadline)}</strong></span>}
    </div>
  );
}
