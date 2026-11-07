import { PaginatedList } from '../../components/ui/PaginatedList';
import { useModalDismiss } from '../../hooks/useModalDismiss';
import { useBackdropClick } from '../../hooks/useBackdropClick';
import {
  ArrowLeft,
  ArrowRight,
  MapPin,
  Search,
  X
} from 'lucide-react';
import React, { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate } from 'react-router-dom';
import { Booth, EventItem, Language } from '../../types';
import { PublicEventContext } from '../../components/landing/PublicEventContext';
import './HeritageExperience.css';
import './BoothsExperience.css';

interface BoothsExperienceProps {
  language: Language;
  open: boolean;
  booths: Booth[];
  events: EventItem[];
  selectedEventId: string;
  isLoading?: boolean;
  error?: string;
  onSelectBoothOnMap?: (boothId: string) => void;
}

function decodePathIdentifier(value: string | undefined): string | null {
  if (!value) return null;
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
}

export const BoothsExperience: React.FC<BoothsExperienceProps> = ({
  language,
  open,
  booths,
  events,
  selectedEventId,
  isLoading = false,
  error,
  onSelectBoothOnMap,
}) => {
  const vi = language === 'vi';
  const navigate = useNavigate();
  const location = useLocation();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const selectedEvent = events.find(event => event.id === selectedEventId);
  const boothPathMatch = location.pathname.match(/^\/gian-hang\/([^/]+)\/?$/);
  const hasBoothDetailPath = boothPathMatch !== null;
  const routeBoothId = decodePathIdentifier(boothPathMatch?.[1]);
  const activeModalBooth = boothPathMatch
    ? booths.find(booth => booth.id === routeBoothId) || null
    : null;
  const boothCatalogUrl = selectedEventId
    ? `/gian-hang?eventId=${encodeURIComponent(selectedEventId)}`
    : '/gian-hang';
  const publicHomeUrl = selectedEventId
    ? `/?eventId=${encodeURIComponent(selectedEventId)}`
    : '/';
  useModalDismiss(open && !activeModalBooth, () => navigate(publicHomeUrl));
  useModalDismiss(Boolean(activeModalBooth), () => navigate(boothCatalogUrl));
  const boothBackdropHandlers = useBackdropClick(() => navigate(boothCatalogUrl));

  const categories = [
    { id: 'all', labelVi: 'Tất cả gian hàng', labelEn: 'All Stalls', count: booths.length },
    { id: 'literature', labelVi: 'Văn học & Nghệ thuật', labelEn: 'Literature & Arts', count: booths.filter(b => b.category === 'literature').length },
    { id: 'children', labelVi: 'Thiếu nhi & Tranh truyện', labelEn: 'Children & Comics', count: booths.filter(b => b.category === 'children').length },
    { id: 'history', labelVi: 'Lịch sử & Kỹ năng sống', labelEn: 'History & Mindset', count: booths.filter(b => b.category === 'history').length },
    { id: 'cafe', labelVi: 'Cà phê & Quà lưu niệm', labelEn: 'Cafe & Souvenirs', count: booths.filter(b => b.category === 'cafe').length },
  ];

  const featuredBooth = booths[0];

  const filteredBooths = useMemo(() => {
    return booths.filter((booth) => {
      const matchCat = selectedCategory === 'all' || booth.category === selectedCategory;
      const q = searchQuery.toLowerCase().trim();
      const matchSearch =
        !q ||
        booth.name.toLowerCase().includes(q) ||
        booth.nameEn.toLowerCase().includes(q) ||
        booth.publisher.toLowerCase().includes(q) ||
        booth.description.toLowerCase().includes(q) ||
        booth.featuredBooks.some((b) => b.toLowerCase().includes(q));

      return matchCat && matchSearch;
    });
  }, [booths, searchQuery, selectedCategory]);

  const handleClose = () => {
    navigate(publicHomeUrl);
  };

  const handleLocateOnMap = (boothId: string) => {
    navigate(selectedEventId
      ? `/?eventId=${encodeURIComponent(selectedEventId)}#ban-do`
      : '/#ban-do');
    if (onSelectBoothOnMap) {
      onSelectBoothOnMap(boothId);
    }
  };

  return (
    <div
      id="booths-page-panel"
      className={`heritage-sheet ${open ? 'is-open' : ''}`}
      inert={!open}
      aria-hidden={!open || undefined}
    >
      <main className="heritage-document">
        {/* Editorial Collection Hero */}
        <section className="heritage-collection-hero">
          <div className="heritage-inner heritage-hero-grid">
            <div className="heritage-introduction">
              <button
                type="button"
                className="exp-btn-return-frameless"
                onClick={handleClose}
                aria-label={vi ? 'Trở về trang chủ Đường Sách' : 'Return to Book Street home'}
              >
                <ArrowLeft size={16} />
                <span>{vi ? 'Trở về trang chủ' : 'Back to Home'}</span>
              </button>

              <span className="heritage-kicker">
                <span />
                {vi ? 'Gian hàng & Nhà xuất bản' : 'Bookstalls & Publishers Directory'}
              </span>
              <h1 tabIndex={-1}>
                {vi ? (
                  <>
                    Dạo bước phố sách.
                    <br />
                    Tìm tri thức vàng.
                  </>
                ) : (
                  <>
                    Stroll the book street.
                    <br />
                    Discover knowledge.
                  </>
                )}
              </h1>
              <p>
                {vi
                  ? `${booths.length} gian hàng đang được công bố từ dữ liệu hệ thống.`
                  : `${booths.length} booths are currently published by the system.`}
              </p>

              <div className="heritage-hero-footnote">
                <strong>{booths.length}</strong>
                <span>{vi ? 'gian hàng tuyển chọn' : 'featured kiosks'}</span>
              </div>
            </div>

            {/* Featured Showcase Card on the right */}
            {isLoading ? (
              <div className="heritage-featured skeleton-card" aria-hidden="true">
                <div className="skeleton-dark" style={{ width: '100%', height: '100%', borderRadius: 0 }} />
                <div style={{ width: '75%' }}>
                  <div className="skeleton-dark" style={{ width: '130px', height: '12px', marginBottom: '10px' }} />
                  <div className="skeleton-dark" style={{ width: '85%', height: '28px', marginBottom: '10px' }} />
                  <div className="skeleton-dark" style={{ width: '65%', height: '14px' }} />
                </div>
              </div>
            ) : featuredBooth ? (
              <div
                className="heritage-featured"
                style={{ cursor: 'pointer' }}
                onClick={() => navigate(`/gian-hang/${encodeURIComponent(featuredBooth.id)}?eventId=${encodeURIComponent(selectedEventId)}`)}
                role="button"
                tabIndex={0}
                aria-label={`Khám phá ${featuredBooth.name}`}
              >
                {featuredBooth.image.url && <img
                  src={featuredBooth.image.url}
                  alt={featuredBooth.image.alt}
                  fetchPriority="high"
                />}
                <span className="heritage-image-ribbon">{featuredBooth.code}</span>
                <div>
                  <span>{vi ? 'Gian hàng đầu danh sách' : 'First pavilion in the list'}</span>
                  <h2>{vi ? featuredBooth.name : featuredBooth.nameEn}</h2>
                  <span>{vi ? featuredBooth.tagline : featuredBooth.taglineEn}</span>
                </div>
                <ArrowRight className="heritage-featured-arrow" size={24} />
              </div>
            ) : (
              <div className="heritage-featured" role="status">
                <div>
                  <span>{vi ? 'Dữ liệu gian hàng' : 'Bookstall data'}</span>
                  <h2>{vi ? 'Chưa có gian hàng được công bố' : 'No published bookstalls yet'}</h2>
                  <span>{vi ? 'Vui lòng quay lại sau.' : 'Please check back later.'}</span>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Collection Section */}
        <section className="heritage-inner heritage-collection" id="booths-collection">

          {error && <p role="alert">{error}</p>}
          {hasBoothDetailPath && !isLoading && !activeModalBooth && !error && (
            <p role="alert">{vi ? 'Không tìm thấy gian hàng được yêu cầu.' : 'The requested booth was not found.'}</p>
          )}
          <div className="heritage-collection-title">
            <div>
              <span className="heritage-section-marker">
                {vi ? 'Khám phá không gian đọc' : 'Explore the pavilions'}
              </span>
              <h2>{vi ? 'Danh mục các gian hàng' : 'All Bookstalls & Publishers'}</h2>
            </div>
            <div className="booths-experience-controls">
              <PublicEventContext language={language} event={selectedEvent} />
              <div className="heritage-search">
                <Search size={16} />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={vi ? 'Tìm tên gian hàng, sách, NXB...' : 'Search stall, books, publisher...'}
                  aria-label={vi ? 'Tìm kiếm gian hàng' : 'Search bookstalls'}
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#66735e' }}
                  >
                    <X size={15} />
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="heritage-filter-row">
            <div className="heritage-filters">
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  aria-pressed={selectedCategory === cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                >
                  {vi ? cat.labelVi : cat.labelEn} ({cat.count})
                </button>
              ))}
            </div>
            <span>{vi ? `${filteredBooths.length} gian hàng` : `${filteredBooths.length} pavilions`}</span>
          </div>

          {isLoading ? (
            <div className="heritage-collection-grid" aria-busy="true">
              {[1, 2, 3, 4, 5, 6].map((item) => (
                <article
                  key={item}
                  className="heritage-collection-card skeleton-card"
                  aria-hidden="true"
                >
                  <div className="heritage-card-image skeleton-box" style={{ borderRadius: 0 }} />
                  <div className="heritage-card-body">
                    <div className="skeleton-box" style={{ width: '45%', height: '12px', marginBottom: '10px' }} />
                    <div className="skeleton-box" style={{ width: '80%', height: '22px', marginBottom: '10px' }} />
                    <div className="skeleton-box" style={{ width: '100%', height: '14px', marginBottom: '6px' }} />
                    <div className="skeleton-box" style={{ width: '70%', height: '14px', marginBottom: '16px' }} />
                    <div className="heritage-card-footer">
                      <div className="skeleton-box" style={{ width: '85px', height: '16px' }} />
                      <div className="skeleton-box" style={{ width: '16px', height: '16px', borderRadius: '50%' }} />
                    </div>
                  </div>
                </article>
              ))}
            </div>
          ) : booths.length === 0 ? (
            error ? null : (
              <div className="heritage-empty-result" role="status">
                <p>{vi ? 'Sự kiện này chưa có gian hàng được công bố.' : 'This event has no published bookstalls yet.'}</p>
              </div>
            )
          ) : filteredBooths.length === 0 ? (
            <div className="heritage-empty-result">
              <p>{vi ? 'Không tìm thấy gian hàng phù hợp với từ khóa.' : 'No kiosks matched your query.'}</p>
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setSelectedCategory('all');
                }}
              >
                {vi ? 'Xem lại tất cả gian hàng' : 'Reset search & filters'}
              </button>
            </div>
          ) : (
            <PaginatedList items={filteredBooths}>{pageItems => (<div className="heritage-collection-grid">
              {pageItems.map((booth) => (
                <article
                  key={booth.id}
                  className="heritage-collection-card"
                  onClick={() => navigate(`/gian-hang/${encodeURIComponent(booth.id)}?eventId=${encodeURIComponent(selectedEventId)}`)}
                  tabIndex={0}
                  role="button"
                  style={{ cursor: 'pointer' }}
                >
                  <div className="heritage-card-image">
                    {booth.image.url && <img src={booth.image.url} alt={booth.image.alt} loading="lazy" />}
                    <span className="heritage-card-code">{booth.code}</span>
                  </div>
                  <div className="heritage-card-body">
                    <span className="heritage-card-cat">
                      {vi ? booth.categoryLabelVi : booth.categoryLabelEn}
                    </span>
                    <h3>{vi ? booth.name : booth.nameEn}</h3>
                    <p>{vi ? booth.tagline : booth.taglineEn}</p>
                    <div className="heritage-card-footer">
                      <span className="heritage-card-arrow-text">
                        {vi ? 'Xem chi tiết' : 'View details'}
                      </span>
                      <ArrowRight size={16} className="heritage-card-arrow-icon" />
                    </div>
                  </div>
                </article>
              ))}
            </div>)}</PaginatedList>
          )}
        </section>

        {/* Footer */}
        <footer className="heritage-sheet-footer">
          <span>
            ĐƯỜNG SÁCH <span> / </span>
            {vi ? 'Danh mục gian hàng' : 'Bookstalls Directory'}
          </span>
        </footer>

        {/* Detail Modal — rendered via Portal to escape fixed-panel stacking context */}
        {activeModalBooth && createPortal(
          <div className="modal-overlay" {...boothBackdropHandlers} role="dialog" aria-modal="true">
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <button className="modal-close" onClick={() => navigate(boothCatalogUrl)} aria-label="Đóng">
                <X size={20} />
              </button>
              <div className="modal-booth-header-img">
                {activeModalBooth.image.url && <img src={activeModalBooth.image.url} alt={activeModalBooth.image.alt} className="modal-top-img" />}
                <div className="modal-img-caption">
                  <span className="kiosk-number-badge">{activeModalBooth.code}</span>
                  {activeModalBooth.image.source && <span className="photo-source-cite">Nguồn: {activeModalBooth.image.source}</span>}
                </div>
              </div>
              <h3 className="modal-heading-title">
                {vi ? activeModalBooth.name : activeModalBooth.nameEn}
              </h3>
              <p className="modal-body-desc">
                {vi ? activeModalBooth.description : activeModalBooth.descriptionEn}
              </p>
              <div className="modal-meta-box">
                <p><strong>{vi ? 'Danh mục:' : 'Category:'}</strong> {activeModalBooth.categoryLabelVi}</p>
                {activeModalBooth.maxCapacity !== undefined && <p><strong>{vi ? 'Sức chứa:' : 'Capacity:'}</strong> {activeModalBooth.maxCapacity}</p>}
              </div>
              <button
                type="button"
                className="btn-figma-primary"
                style={{ width: '100%' }}
                onClick={() => {
                  const bId = activeModalBooth.id;
                  navigate(boothCatalogUrl);
                  handleLocateOnMap(bId);
                }}
              >
                <MapPin size={16} />
                <span>{vi ? 'Định vị trên bản đồ tương tác' : 'Locate on Interactive Map'}</span>
              </button>
            </div>
          </div>,
          document.body
        )}
      </main>
    </div>
  );
};
