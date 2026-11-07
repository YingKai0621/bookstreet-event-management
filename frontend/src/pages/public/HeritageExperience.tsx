import { ArrowLeft, ArrowRight, Image as ImageIcon, MapPin } from 'lucide-react';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { PaginatedList } from '../../components/ui/PaginatedList';
import { useModalDismiss } from '../../hooks/useModalDismiss';
import { ApiError } from '../../services/apiClient';
import { publicApi } from '../../services/publicApi';
import { Language } from '../../types';
import {
  HeritageProfile,
  PublicHeritageDetail,
} from '../../types/heritage';
import './HeritageExperience.css';

interface HeritageExperienceProps {
  language: Language;
  open: boolean;
  heritageList?: HeritageProfile[];
  isLoading?: boolean;
  listError?: string;
}

function HeritageImage({ src, alt, vi, eager = false }: { src: string | null; alt: string; vi: boolean; eager?: boolean }) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  if (!src || failedSrc === src) return <span className="heritage-image-fallback"><ImageIcon size={38} />{vi ? 'Chưa có ảnh' : 'No image yet'}</span>;
  return <img src={src} alt={alt} loading={eager ? 'eager' : 'lazy'} fetchPriority={eager ? 'high' : undefined} onError={() => setFailedSrc(src)} />;
}

type DetailState = 'idle' | 'loading' | 'ready' | 'not-found' | 'error';

export function HeritageExperience({
  language,
  open,
  heritageList = [],
  isLoading = false,
  listError = '',
}: HeritageExperienceProps) {
  const vi = language === 'vi';
  const location = useLocation();
  const navigate = useNavigate();
  const panel = useRef<HTMLDivElement>(null);
  const catalogScroll = useRef(0);
  const path = open ? location.pathname : '/di-san';
  const rawPublicCode = path.replace(/\/$/, '').split('/')[2];
  const publicCode = rawPublicCode ? decodePathSegment(rawPublicCode) : '';
  const [detailResult, setDetailResult] = useState<{
    publicCode: string;
    state: Exclude<DetailState, 'idle' | 'loading'>;
    detail: PublicHeritageDetail | null;
  } | null>(null);
  const detailState: DetailState = !publicCode
    ? 'idle'
    : detailResult?.publicCode === publicCode ? detailResult.state : 'loading';
  const detail = detailResult?.publicCode === publicCode ? detailResult.detail : null;

  useEffect(() => {
    if (!open || !publicCode) return;

    let active = true;
    void publicApi.getHeritage(publicCode)
      .then(response => {
        if (!active) return;
        setDetailResult({ publicCode, state: 'ready', detail: response });
      })
      .catch(error => {
        if (!active) return;
        setDetailResult({
          publicCode,
          state: error instanceof ApiError && error.status === 404 ? 'not-found' : 'error',
          detail: null,
        });
      });
    return () => {
      active = false;
    };
  }, [open, publicCode]);

  useModalDismiss(open, () => navigate('/'));

  useLayoutEffect(() => {
    if (!open || !panel.current) return;
    panel.current.scrollTop = publicCode ? 0 : catalogScroll.current;
    panel.current.querySelector<HTMLElement>('h1')?.focus({ preventScroll: true });
  }, [open, publicCode, detailState]);

  useEffect(() => {
    if (!open) return;
    const oldTitle = document.title;
    document.title = `${detail?.title || (vi ? 'Không gian di sản' : 'Heritage collection')} — Đường Sách`;
    return () => {
      document.title = oldTitle;
    };
  }, [detail?.title, open, vi]);

  const close = () => {
    navigate('/');
    requestAnimationFrame(() =>
      document.querySelector<HTMLButtonElement>('.heritage-bookmark')
        ?.focus({ preventScroll: true }));
  };

  return (
    <div
      id="heritage-page-panel"
      ref={panel}
      className={`heritage-sheet ${open ? 'is-open' : ''}`}
      inert={!open}
      aria-hidden={!open || undefined}
      onScroll={() => {
        if (open && !publicCode && panel.current) {
          catalogScroll.current = panel.current.scrollTop;
        }
      }}
    >
      <main className="heritage-document">
        {publicCode
          ? renderDetail(detailState, detail, heritageList, vi)
          : renderCollection(heritageList, isLoading, listError, vi, close)}
        <footer className="heritage-sheet-footer">
          <span>
            ĐƯỜNG SÁCH <span> / </span>
            {vi ? 'Không gian di sản' : 'Heritage collection'}
          </span>
        </footer>
      </main>
    </div>
  );
}
function decodePathSegment(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function renderCollection(
  heritageList: HeritageProfile[],
  isLoading: boolean,
  listError: string,
  vi: boolean,
  close: () => void,
) {
  if (isLoading) {
    return <StatusPanel busy title={vi ? 'Đang tải nội dung di sản…' : 'Loading heritage content…'} />;
  }
  if (listError) {
    return (
      <StatusPanel
        title={vi ? 'Chưa thể tải nội dung di sản' : 'Heritage content is unavailable'}
        description={vi ? 'Vui lòng kiểm tra kết nối và thử lại sau.' : 'Please check your connection and try again later.'}
      />
    );
  }
  if (heritageList.length === 0) {
    return (
      <StatusPanel
        title={vi ? 'Chưa có nội dung di sản được công bố' : 'No heritage content has been published yet'}
        description={vi ? 'Các câu chuyện mới sẽ xuất hiện tại đây sau khi được công bố.' : 'New stories will appear here after publication.'}
      />
    );
  }

  const featured = heritageList[0];
  return (
    <>
      <section className="heritage-collection-hero">
        <div className="heritage-inner heritage-hero-grid">
          <div className="heritage-introduction">
            <button type="button" className="exp-btn-return-frameless" onClick={close}>
              <ArrowLeft size={16} />
              <span>{vi ? 'Trở về trang chủ' : 'Back to Home'}</span>
            </button>
            <span className="heritage-kicker"><span />{vi ? 'Không gian di sản Đường Sách' : 'Book Street heritage'}</span>
            <h1 tabIndex={-1}>{vi ? 'Mỗi địa danh là một câu chuyện' : 'Every place tells a story'}</h1>
            <p>
              {vi
                ? 'Khám phá những địa danh và ký ức văn hóa gắn với không gian Đường Sách.'
                : 'Explore the places and cultural memories connected to Book Street.'}
            </p>
            <div className="heritage-hero-footnote">
              <strong>{heritageList.length}</strong>
              <span>{vi ? 'nội dung đang công bố' : 'published stories'}</span>
            </div>
          </div>
          <Link className="heritage-featured" to={`/di-san/${encodeURIComponent(featured.publicCode)}`}>
            <HeritageImage src={featured.imageUrl} alt={`Ảnh minh họa: ${featured.title}`} vi={vi} eager />
            <span className="heritage-image-ribbon">01</span>
            <div>
              <span>{vi ? 'Câu chuyện nổi bật' : 'Featured story'}</span>
              <h2>{featured.title}</h2>
              <span>{featured.summary || featured.locationText || (vi ? 'Mở để đọc câu chuyện di sản' : 'Open the heritage story')}</span>
            </div>
            <ArrowRight className="heritage-featured-arrow" size={24} />
          </Link>
        </div>
      </section>
      <section className="heritage-inner heritage-collection" id="heritage-collection">
        <div className="heritage-collection-title">
          <div>
            <span className="heritage-section-marker">{vi ? 'CÁC CÂU CHUYỆN ĐANG CÔNG BỐ' : 'PUBLISHED STORIES'}</span>
            <h2>{vi ? 'Chọn một điểm di sản' : 'Choose a heritage place'}</h2>
          </div>
        </div>
        <div className="heritage-filter-row">
          <span aria-live="polite">{heritageList.length} {vi ? 'nội dung' : 'stories'}</span>
        </div>
        <PaginatedList items={heritageList}>
          {pageItems => (
            <div className="heritage-collection-grid">
              {pageItems.map(item => (
                <Link
                  to={`/di-san/${encodeURIComponent(item.publicCode)}`}
                  key={item.publicCode}
                  className="heritage-collection-card"
                >
                  <div className="heritage-card-image">
                    <HeritageImage src={item.imageUrl} alt={`Ảnh minh họa: ${item.title}`} vi={vi} />
                  </div>
                  <div className="heritage-card-copy">
                    {item.locationText && (
                      <span className="heritage-card-place"><MapPin size={13} />{item.locationText}</span>
                    )}
                    <h3>{item.title}</h3>
                    {item.summary && <p>{item.summary}</p>}
                    <div className="heritage-card-bottom">
                      <span>{vi ? 'Đọc câu chuyện' : 'Read the story'}</span>
                      <ArrowRight size={18} />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </PaginatedList>
      </section>
    </>
  );
}

function renderDetail(
  state: DetailState,
  item: PublicHeritageDetail | null,
  heritageList: HeritageProfile[],
  vi: boolean,
) {
  if (state === 'loading' || state === 'idle') {
    return <StatusPanel busy title={vi ? 'Đang tải câu chuyện di sản…' : 'Loading heritage story…'} />;
  }
  if (state === 'not-found') {
    return (
      <StatusPanel
        title={vi ? 'Không tìm thấy nội dung di sản' : 'Heritage content not found'}
        description={vi ? 'Nội dung có thể chưa được công bố hoặc đã được lưu trữ.' : 'This story may be unpublished or archived.'}
        backLabel={vi ? 'Về danh mục di sản' : 'Back to collection'}
      />
    );
  }
  if (state === 'error' || !item) {
    return (
      <StatusPanel
        title={vi ? 'Chưa thể tải câu chuyện di sản' : 'Unable to load this heritage story'}
        description={vi ? 'Vui lòng kiểm tra kết nối và thử lại sau.' : 'Please check your connection and try again later.'}
        backLabel={vi ? 'Về danh mục di sản' : 'Back to collection'}
      />
    );
  }

  const currentIndex = heritageList.findIndex(candidate => candidate.publicCode === item.publicCode);
  const next = currentIndex >= 0 && heritageList.length > 1
    ? heritageList[(currentIndex + 1) % heritageList.length]
    : null;

  return (
    <>
      <section className="heritage-detail-hero">
        {item.imageUrl && (
          <img
            src={item.imageUrl}
            alt={`Ảnh minh họa: ${item.title}`}
            className="heritage-detail-cover"
            fetchPriority="high"
          />
        )}
        <div className="heritage-detail-shade" />
        <div className="heritage-inner">
          <Link to="/di-san" className="heritage-back"><ArrowLeft size={17} />{vi ? 'Tất cả di sản' : 'All heritage stories'}</Link>
          <div className="heritage-detail-heading">
            <span className="heritage-kicker">{vi ? 'CÂU CHUYỆN DI SẢN' : 'HERITAGE STORY'}</span>
            <h1 tabIndex={-1}>{item.title}</h1>
            {item.locationText && <p><MapPin size={17} />{item.locationText}</p>}
          </div>
        </div>
      </section>
      <div className="heritage-inner heritage-reading-layout">
        <article className="heritage-reading">
          {item.summary && <p className="heritage-lead">{item.summary}</p>}
          <section>
            <span className="heritage-section-marker">{vi ? 'CÂU CHUYỆN DI SẢN' : 'HERITAGE STORY'}</span>
            <h2>{vi ? 'Nội dung' : 'The story'}</h2>
            <p className="heritage-content-text">{item.content}</p>
          </section>
          <Link to="/di-san" className="heritage-return"><ArrowLeft size={18} />{vi ? 'Quay về danh mục di sản' : 'Back to the heritage collection'}</Link>
        </article>
      </div>
      {next && (
        <section className="heritage-next heritage-inner">
          <span>{vi ? 'Tiếp tục hành trình' : 'Continue the journey'}</span>
          <Link to={`/di-san/${encodeURIComponent(next.publicCode)}`}><span>{next.title}</span><ArrowRight size={26} /></Link>
        </section>
      )}
    </>
  );
}

function StatusPanel({
  title,
  description,
  backLabel,
  busy = false,
}: {
  title: string;
  description?: string;
  backLabel?: string;
  busy?: boolean;
}) {
  return (
    <section className="heritage-not-found" aria-busy={busy || undefined}>
      <h1 tabIndex={-1}>{title}</h1>
      {description && <p>{description}</p>}
      {backLabel && <Link to="/di-san"><ArrowLeft size={18} />{backLabel}</Link>}
    </section>
  );
}
