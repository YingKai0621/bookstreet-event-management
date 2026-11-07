import { useModalDismiss } from '../../hooks/useModalDismiss';
import { useBackdropClick } from '../../hooks/useBackdropClick';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, ChevronsRight, MapPin, Search, X } from 'lucide-react';
import React, { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { Booth, EventItem, Language } from '../../types';
import { IconBookSpine, IconBookmark } from './CustomIcons';
import { PublicEventContext } from './PublicEventContext';
import './BoothsSection.css';

const DEFAULT_BOOTH_IMAGE = '/images/booths/default-bookstall.png';

function useDefaultBoothImage(event: React.SyntheticEvent<HTMLImageElement>): void {
  const image = event.currentTarget;
  if (!image.src.endsWith(DEFAULT_BOOTH_IMAGE)) image.src = DEFAULT_BOOTH_IMAGE;
}

interface BoothsSectionProps {
  language: Language;
  booths?: Booth[];
  isLoading?: boolean;
  error?: string;
  events?: EventItem[];
  selectedEventId?: string;
  onSelectBoothOnMap: (boothId: string) => void;
  searchQuery?: string;
  onSearchQueryChange?: (q: string) => void;
  focusedBoothId?: string | null;
}

const EMPTY_BOOTHS: Booth[] = [];

export const BoothsSection: React.FC<BoothsSectionProps> = ({
  language,
  booths: initialBooths,
  isLoading = false,
  error = '',
  events = [],
  selectedEventId = '',
  onSelectBoothOnMap,
  searchQuery: externalSearchQuery,
  onSearchQueryChange,
  focusedBoothId,
}) => {
  const booths = initialBooths || EMPTY_BOOTHS;
  const selectedEvent = events.find(event => event.id === selectedEventId);
  const boothsCatalogUrl = selectedEventId
    ? `/gian-hang?eventId=${encodeURIComponent(selectedEventId)}`
    : '/gian-hang';
  const [internalSearchQuery, setInternalSearchQuery] = useState('');
  const searchQuery = externalSearchQuery !== undefined ? externalSearchQuery : internalSearchQuery;
  const setSearchQuery = onSearchQueryChange || setInternalSearchQuery;
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [activeModalBooth, setActiveModalBooth] = useState<Booth | null>(null);
  const [isBoothSheetClosing, setIsBoothSheetClosing] = useState(false);
  const [carouselPage, setCarouselPage] = useState(0);
  const [carouselDirection, setCarouselDirection] = useState<1 | -1>(1);
  const sheetDragStartY = React.useRef<number | null>(null);
  const didSheetDrag = React.useRef(false);
  const [sheetDragOffset, setSheetDragOffset] = useState(0);
  const [isSheetDragging, setIsSheetDragging] = useState(false);
  const [isMobileCarousel, setIsMobileCarousel] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia('(max-width: 768px)').matches,
  );
  const stallsTrackRef = React.useRef<HTMLDivElement | null>(null);

  const closeBoothModal = React.useCallback(() => {
    if (!activeModalBooth || isBoothSheetClosing) return;
    if (!window.matchMedia('(max-width: 540px)').matches) {
      setActiveModalBooth(null);
      return;
    }
    setIsBoothSheetClosing(true);
    window.setTimeout(() => {
      setActiveModalBooth(null);
      setSheetDragOffset(0);
      setIsBoothSheetClosing(false);
    }, 260);
  }, [activeModalBooth, isBoothSheetClosing]);
  const boothBackdropHandlers = useBackdropClick(closeBoothModal);

  React.useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 768px)');
    const updateCarouselMode = () => setIsMobileCarousel(mediaQuery.matches);
    mediaQuery.addEventListener('change', updateCarouselMode);
    return () => mediaQuery.removeEventListener('change', updateCarouselMode);
  }, []);

  useModalDismiss(Boolean(activeModalBooth), closeBoothModal);

  // Khi người dùng bấm "Xem trong danh mục gian hàng" từ bản đồ hoặc mở chi tiết gian hàng
  React.useEffect(() => {
    if (focusedBoothId) {
      const found = booths.find((b) => b.id === focusedBoothId);
      if (found) {
        // eslint-disable-next-line react/set-state-in-effect
        setActiveModalBooth(found);
      }
    }
  }, [focusedBoothId, booths]);

  const handleOpenBoothModal = (booth: Booth, e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    setIsBoothSheetClosing(false);
    setSheetDragOffset(0);
    setActiveModalBooth(booth);
  };


  const categories = [
    { id: 'all', labelVi: 'Tất cả', labelEn: 'All Stalls' },
    { id: 'literature', labelVi: 'Văn học', labelEn: 'Literature' },
    { id: 'children', labelVi: 'Thiếu nhi', labelEn: 'Children' },
    { id: 'history', labelVi: 'Lịch sử & Tri thức', labelEn: 'History & Wisdom' },
    { id: 'cafe', labelVi: 'Cà phê sách', labelEn: 'Book Cafe' },
  ];

  const filteredBooths = useMemo(() => {
    const matchingBooths = booths.filter((booth) => {
      const matchCat = activeCategory === 'all' || booth.category === activeCategory;
      const q = searchQuery.toLowerCase().trim();
      const matchSearch =
        !q ||
        booth.name.toLowerCase().includes(q) ||
        booth.nameEn.toLowerCase().includes(q) ||
        booth.publisher.toLowerCase().includes(q) ||
        booth.featuredBooks.some((b) => b.toLowerCase().includes(q));

      return matchCat && matchSearch;
    });

    return matchingBooths;
  }, [searchQuery, activeCategory, booths]);

  React.useEffect(() => {
    if (!isMobileCarousel) return;

    // Defer until after browser scroll restoration and the horizontal track's layout.
    const frameId = requestAnimationFrame(() => {
      stallsTrackRef.current?.scrollTo({ left: 0, behavior: 'auto' });
    });
    return () => cancelAnimationFrame(frameId);
  }, [isMobileCarousel, activeCategory, searchQuery, filteredBooths]);
  const carouselPages = [
    filteredBooths.slice(0, 4),
    filteredBooths.slice(4, 8),
    filteredBooths.slice(8, 11),
  ].filter((page) => page.length > 0);
  const activeCarouselPage = Math.min(carouselPage, Math.max(carouselPages.length - 1, 0));
  const visibleBooths = carouselPages[activeCarouselPage] || [];
  const displayedBooths = isMobileCarousel ? filteredBooths : visibleBooths;
  const showExploreCard = isMobileCarousel || (activeCarouselPage === carouselPages.length - 1 && carouselPages.length > 0);
  const carouselMotion = {
    enter: (direction: number) => ({ opacity: 0, x: `${direction * 105}%` }),
    center: { opacity: 1, x: '0%' },
    exit: (direction: number) => ({ opacity: 0, x: `${direction * -105}%` }),
  };

  return (
    <section className="figma-bookstalls-section" id="gian-hang">
      <div className="container">
        {/* Figma Eyebrow & Title */}
        <div className="figma-section-header">
          <span className="figma-eyebrow">
            <IconBookSpine size={16} color="var(--figma-gold)" style={{ verticalAlign: 'middle', marginRight: '6px' }} />
            {language === 'vi' ? 'DANH MỤC GIAN HÀNG' : 'BOOKSTALL DIRECTORY'}
          </span>
          <h2 className="figma-section-title">
            {language === 'vi' ? (
              <>Các gian hàng tại <span className="serif-italic-accent">Đường Sách</span></>
            ) : (
              'Explore Stalls & Pavilions'
            )}
          </h2>
          <p className="figma-section-subtitle">
            {language === 'vi'
              ? `${booths.length} gian hàng đang mở tại Đường Sách.`
              : `${booths.length} booths are open at Book Street.`}
          </p>
        </div>


        {error && <p role="alert">{error}</p>}

        {/* Search & Category Filter Bar */}
        <div className="figma-stalls-controls">
          <PublicEventContext language={language} event={selectedEvent} />
          <div className="figma-search-bar">
            <Search size={18} className="search-ico" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={
                language === 'vi'
                  ? 'Tìm ki-ốt, NXB, tựa sách...'
                  : 'Search stalls, publishers, titles...'
              }
              className="figma-search-input"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="search-clear">
                <X size={16} />
              </button>
            )}
          </div>

          <div className="figma-category-pills">
            {categories.map((cat) => (
              <button
                key={cat.id}
                type="button"
                className={`category-pill-btn ${activeCategory === cat.id ? 'active' : ''}`}
                onClick={() => setActiveCategory(cat.id)}
              >
                {language === 'vi' ? cat.labelVi : cat.labelEn}
              </button>
            ))}
          </div>
        </div>

        <div className="booths-carousel-nav-btns" aria-label={language === 'vi' ? 'Điều hướng danh sách gian hàng' : 'Bookstall carousel navigation'}>
          <button
            type="button"
            className="booths-carousel-nav-btn"
            onClick={() => {
              setCarouselDirection(-1);
              setCarouselPage((page) => Math.max(page - 1, 0));
            }}
            hidden={activeCarouselPage === 0}
            aria-label={language === 'vi' ? 'Xem gian hàng trước' : 'Previous bookstalls'}
            title={language === 'vi' ? 'Gian hàng trước' : 'Previous'}
          >
            <ChevronLeft size={19} aria-hidden="true" />
          </button>
          <button
            type="button"
            className="booths-carousel-nav-btn"
            onClick={() => {
              setCarouselDirection(1);
              setCarouselPage((page) => Math.min(page + 1, carouselPages.length - 1));
            }}
            hidden={activeCarouselPage >= carouselPages.length - 1}
            aria-label={language === 'vi' ? 'Xem gian hàng tiếp theo' : 'Next bookstalls'}
            title={language === 'vi' ? 'Gian hàng tiếp theo' : 'Next'}
          >
            <ChevronRight size={19} aria-hidden="true" />
          </button>
        </div>

        {/* Horizontal Scrolling Carousel / Slider */}
        <div 
          className="figma-stalls-slider-track"
          ref={stallsTrackRef}
          tabIndex={0}
          role="region"
          aria-label="Danh sách gian hàng lướt ngang"
          aria-busy={isLoading || undefined}
        >
          {isLoading && booths.length === 0 ? (
            <div className="booths-carousel-page" style={{ opacity: 1 }} aria-busy="true">
              {[1, 2, 3, 4].map((item) => (
                <div key={item} className="figma-kiosk-card skeleton-card" aria-hidden="true">
                  <div className="kiosk-card-photo-wrapper skeleton-box" style={{ minHeight: '160px', width: '100%' }} />
                  <div className="kiosk-card-body">
                    <div className="skeleton-box" style={{ width: '75%', height: '22px', marginBottom: '10px' }} />
                    <div className="skeleton-box" style={{ width: '100%', height: '14px', marginBottom: '6px' }} />
                    <div className="skeleton-box" style={{ width: '85%', height: '14px', marginBottom: '14px' }} />
                    <div className="kiosk-highlights">
                      <div className="skeleton-box" style={{ width: '45%', height: '12px', marginBottom: '8px' }} />
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <div className="skeleton-box" style={{ width: '70px', height: '22px', borderRadius: '4px' }} />
                        <div className="skeleton-box" style={{ width: '85px', height: '22px', borderRadius: '4px' }} />
                      </div>
                    </div>
                    <div className="kiosk-card-footer" style={{ marginTop: 'auto', paddingTop: '12px' }}>
                      <div className="skeleton-box" style={{ width: '95px', height: '32px', borderRadius: '6px' }} />
                      <div className="skeleton-box" style={{ width: '110px', height: '32px', borderRadius: '6px' }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : booths.length === 0 ? (
            error ? null : (
              <div className="booths-carousel-page booths-empty-state" role="status">
                <p>{language === 'vi' ? 'Sự kiện này chưa có gian hàng được công bố.' : 'This event has no published bookstalls yet.'}</p>
              </div>
            )
          ) : displayedBooths.length === 0 ? (
            <div className="booths-carousel-page booths-empty-state" role="status">
              <p>{language === 'vi' ? 'Không tìm thấy gian hàng phù hợp với từ khóa.' : 'No bookstalls matched your criteria.'}</p>
            </div>
          ) : (
            <AnimatePresence mode="popLayout" initial={false} custom={carouselDirection}>
            <motion.div
              key={`${selectedEventId || 'default'}-${activeCarouselPage}`}
              className={`booths-carousel-page ${isLoading ? 'is-updating' : ''}`}
              custom={carouselDirection}
              variants={carouselMotion}
              initial={isMobileCarousel ? false : 'enter'}
              animate={isMobileCarousel ? false : 'center'}
              exit={isMobileCarousel ? undefined : 'exit'}
              transition={{ duration: 0.36, ease: [0.22, 1, 0.36, 1] }}
            >
            {displayedBooths.map((booth, idx) => {
              const isFocused = focusedBoothId === booth.id;
              return (
                <div 
                  key={booth.id}
                  id={`booth-card-${booth.id}`}
                  className={`figma-kiosk-card ${isFocused ? 'kiosk-card-focus-once' : ''}`}
                  style={{ animationDelay: `${idx * 60}ms` }}
                >
                  {/* Real Photography Header with Label */}
                  <div className="kiosk-card-photo-wrapper">
                    {booth.image.url && <img
                      src={booth.image.url}
                      alt={booth.image.alt}
                      loading="lazy"
                      className="kiosk-photo-img"
                      onError={useDefaultBoothImage}
                    />}
                    <div className="kiosk-photo-overlay"></div>
                    <div className="kiosk-banner-tags">
                      <span className="kiosk-cat-label">
                        {language === 'vi' ? booth.categoryLabelVi : booth.categoryLabelEn}
                      </span>
                    </div>
                  </div>

                  <div className="kiosk-card-body">
                    <h3 className="kiosk-title">
                      {language === 'vi' ? booth.name : booth.nameEn}
                    </h3>
                    <p className="kiosk-desc">
                      {language === 'vi' ? booth.tagline : booth.taglineEn}
                    </p>

                    {booth.featuredBooks.length > 0 && <div className="kiosk-highlights">
                      <span className="kiosk-hl-label">
                        <IconBookmark size={13} style={{ verticalAlign: 'middle', marginRight: '4px' }} />
                        {language === 'vi' ? 'Đầu sách đặc trưng:' : 'Notable reads:'}
                      </span>
                      <div className="kiosk-books-row">
                        {booth.featuredBooks.slice(0, 2).map((bk, i) => (
                          <span key={i} className="kiosk-book-tag">{bk}</span>
                        ))}
                      </div>
                    </div>}

                    <div className="kiosk-card-footer">
                      <button
                        type="button"
                        className="btn-kiosk-detail"
                        onClick={(e) => handleOpenBoothModal(booth, e)}
                      >
                        <span>{language === 'vi' ? 'Xem chi tiết' : 'View details'}</span>
                        <ChevronRight size={15} />
                      </button>

                      <button
                        type="button"
                        className="btn-kiosk-map"
                        onClick={() => onSelectBoothOnMap(booth.id)}
                      >
                        <MapPin size={15} />
                        <span>{language === 'vi' ? 'Xem trên bản đồ' : 'Map Pin'}</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
            {showExploreCard && (
              <Link to={boothsCatalogUrl} className="booths-explore-card">
                <span>{language === 'vi' ? 'Khám phá thêm gian hàng' : 'Explore more bookstalls'}</span>
                <ChevronsRight size={30} aria-hidden="true" />
              </Link>
            )}
            </motion.div>
            </AnimatePresence>
          )}
        </div>

        {/* Nút Xem thêm nhỏ không có khung viền đặt dưới danh sách */}
        <div className="section-bottom-see-more-row">
          <Link
            to={boothsCatalogUrl}
            className="btn-section-see-more-borderless"
            aria-label="Xem thêm toàn bộ gian hàng tại Đường Sách"
          >
            <span>{language === 'vi' ? 'Xem thêm toàn bộ các gian hàng tại Đường Sách' : 'View all bookstalls & pavilions at Book Street'}</span>
            <ChevronRight size={17} className="see-more-arrow-icon" />
          </Link>
        </div>
      </div>

      {/* Detail Modal with 30% Logic Preservation */}
      {activeModalBooth && createPortal(
        <div
          className="modal-overlay booth-detail-modal-overlay"
          {...boothBackdropHandlers}
          role="dialog"
          aria-modal="true"
          aria-labelledby="booth-detail-modal-title"
        >
          <div
            className={`modal-content booth-detail-modal-content ${isBoothSheetClosing ? 'is-closing' : ''}`}
            style={!isBoothSheetClosing && (isSheetDragging || sheetDragOffset !== 0) ? { transform: `translateY(${sheetDragOffset}px)`, transition: isSheetDragging ? 'none' : 'transform 220ms cubic-bezier(0.22, 1, 0.36, 1)' } : undefined}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="booth-sheet-handle"
              aria-label={language === 'vi' ? 'Kéo xuống để đóng chi tiết gian hàng' : 'Drag down to close booth details'}
              onClick={() => { if (!didSheetDrag.current) closeBoothModal(); }}
              onPointerDown={(event) => {
                sheetDragStartY.current = event.clientY;
                didSheetDrag.current = false;
                setIsSheetDragging(true);
                event.preventDefault();
                event.currentTarget.setPointerCapture(event.pointerId);
              }}
              onPointerMove={(event) => {
                if (sheetDragStartY.current === null) return;
                const distance = event.clientY - sheetDragStartY.current;
                if (Math.abs(distance) > 3) didSheetDrag.current = true;
                setSheetDragOffset(Math.max(-72, Math.min(distance, window.innerHeight * 0.82)));
              }}
              onPointerUp={(event) => {
                if (sheetDragStartY.current === null) return;
                const distance = event.clientY - sheetDragStartY.current;
                sheetDragStartY.current = null;
                setIsSheetDragging(false);
                if (distance > 120) closeBoothModal();
                else setSheetDragOffset(0);
                window.setTimeout(() => { didSheetDrag.current = false; }, 0);
              }}
              onPointerCancel={() => { sheetDragStartY.current = null; setIsSheetDragging(false); setSheetDragOffset(0); }}
            >
              <span aria-hidden="true" />
            </button>
            <button
              type="button"
              className="modal-close"
              onClick={closeBoothModal}
              aria-label={language === 'vi' ? 'Đóng chi tiết gian hàng' : 'Close booth details'}
            >
              <X size={20} />
            </button>
            <div className="modal-booth-header-img">
              {activeModalBooth.image.url && <img src={activeModalBooth.image.url} alt={activeModalBooth.image.alt} className="modal-top-img" onError={useDefaultBoothImage} />}
              <div className="modal-img-caption">
                <span className="kiosk-number-badge">{activeModalBooth.code}</span>
              </div>
            </div>
            <h3 className="modal-heading-title" id="booth-detail-modal-title">
              {language === 'vi' ? activeModalBooth.name : activeModalBooth.nameEn}
            </h3>
            <p className="modal-body-desc">
              {language === 'vi' ? activeModalBooth.description : activeModalBooth.descriptionEn}
            </p>
              <div className="modal-meta-box">
                <p><strong>{language === 'vi' ? 'Danh mục:' : 'Category:'}</strong> {activeModalBooth.categoryLabelVi}</p>
                {activeModalBooth.maxCapacity !== undefined && <p><strong>{language === 'vi' ? 'Sức chứa:' : 'Capacity:'}</strong> {activeModalBooth.maxCapacity}</p>}
              </div>
            <button
              type="button"
              className="btn-figma-primary"
              onClick={() => {
                const b = activeModalBooth;
                setActiveModalBooth(null);
                onSelectBoothOnMap(b.id);
              }}
            >
              <MapPin size={16} />
              <span>{language === 'vi' ? 'Định vị trên bản đồ tương tác' : 'Locate on Map'}</span>
            </button>
          </div>
        </div>,
        document.body,
      )}
    </section>
  );
};
