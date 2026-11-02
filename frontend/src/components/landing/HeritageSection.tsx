import gsap from 'gsap';
import { ArrowRight, ChevronLeft, ChevronRight, Image as ImageIcon, MapPin } from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Language } from '../../types';
import { HeritageProfile } from '../../types/heritage';
import { IconHeritageSeal } from './CustomIcons';
import './HeritageSection.css';

interface HeritageSectionProps {
  language: Language;
  heritageList?: HeritageProfile[];
  isLoading?: boolean;
  error?: string;
}

const VISIBLE_LANDMARKS = 3;
const HALF_FAN = 1;
const FAN_SLOTS = [
  { rotation: -7, scale: 0.94, y: 0.9, zIndex: 8 },
  { rotation: 0, scale: 1, y: 0, zIndex: 10 },
  { rotation: 7, scale: 0.94, y: 0.9, zIndex: 8 },
];

const imageAlt = (item: HeritageProfile) => `Ảnh minh họa: ${item.title}`;
const EMPTY_HERITAGE_LIST: HeritageProfile[] = [];

function FanImage({ item, vi }: { item: HeritageProfile; vi: boolean }) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  if (!item.imageUrl || failedSrc === item.imageUrl) {
    return <span className="heritage-fan-image-fallback"><ImageIcon size={34} />{vi ? 'Chưa có ảnh' : 'No image yet'}</span>;
  }
  return <img src={item.imageUrl} alt={imageAlt(item)} loading="eager" decoding="async" onError={() => setFailedSrc(item.imageUrl)} />;
}

export const HeritageSection: React.FC<HeritageSectionProps> = ({
  language,
  heritageList,
  isLoading = false,
  error = '',
}) => {
  const vi = language === 'vi';
  const navigate = useNavigate();
  const landmarks = heritageList || EMPTY_HERITAGE_LIST;
  const [centerIndex, setCenterIndex] = useState(Math.min(HALF_FAN, Math.max(0, landmarks.length - 1)));
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const cardRefs = useRef<Array<HTMLAnchorElement | null>>([]);
  const hasEntered = useRef(false);
  const previousVisible = useRef<Set<number>>(new Set());
  const travelDirection = useRef<-1 | 1>(1);
  const swipeStartX = useRef<number | null>(null);
  const didSwipe = useRef(false);
  const activeIndex = landmarks.length ? centerIndex % landmarks.length : 0;

  const getVisibleMap = useCallback(() => {
    const visible = new Map<number, number>();
    const total = landmarks.length;
    if (!total) return visible;

    if (total <= VISIBLE_LANDMARKS) {
      visible.set(activeIndex, HALF_FAN);
      if (total === 2) {
        const otherIndex = (activeIndex + 1) % total;
        visible.set(otherIndex, activeIndex === 0 ? 2 : 0);
      } else if (total === 3) {
        visible.set((activeIndex - 1 + total) % total, 0);
        visible.set((activeIndex + 1) % total, 2);
      }
      return visible;
    }

    for (let slot = 0; slot < VISIBLE_LANDMARKS; slot += 1) {
      const cardIndex = (activeIndex + slot - HALF_FAN + total) % total;
      visible.set(cardIndex, slot);
    }
    return visible;
  }, [activeIndex, landmarks]);

  const previousHoveredSlot = useRef<number | undefined>(undefined);

  const animateLayout = useCallback((entrance = false) => {
    const visibleMap = getVisibleMap();
    const wasVisible = previousVisible.current;
    const isMobile = window.innerWidth <= 760;
    // Spacing between cards
    const spacing = Math.min(window.innerWidth * 0.16, isMobile ? 72 : 230);
    const verticalUnit = isMobile ? 8 : 16;
    const hoveredSlot = hoveredIndex === null ? undefined : visibleMap.get(hoveredIndex);
    const offsetFor = (slotIndex: number) => (slotIndex - HALF_FAN) * spacing;

    cardRefs.current.forEach((card, cardIndex) => {
      if (!card) return;
      const slotIndex = visibleMap.get(cardIndex);

      if (slotIndex === undefined) {
        if (wasVisible.has(cardIndex)) {
          gsap.to(card, {
            x: `+=${travelDirection.current * -spacing * 0.55}`,
            y: '-=8',
            rotation: `+=${travelDirection.current * -4}`,
            scale: 0.66,
            opacity: 0,
            duration: 0.35,
            ease: 'power2.inOut',
            overwrite: 'auto',
            onComplete: () => {
              if (card) {
                gsap.set(card, { pointerEvents: 'none', zIndex: 0 });
              }
            },
          });
        } else {
          gsap.set(card, { opacity: 0, scale: 0.55, pointerEvents: 'none', zIndex: 0 });
        }
        return;
      }

      const slot = FAN_SLOTS[slotIndex];
      const isHovered = hoveredSlot === slotIndex;

      // Thuật toán vật lý tản cánh quạt mượt mà tự nhiên:
      // Khi chọn 1 thẻ, các thẻ lân cận tản ra một khoảng cách tỷ lệ nghịch với khoảng cách vị trí
      let targetX = offsetFor(slotIndex);
      let targetY = slot.y * verticalUnit;
      let targetRot = slot.rotation;
      let targetScale = slot.scale;
      let animDelay = 0;

      if (hoveredSlot !== undefined) {
        const distance = Math.abs(slotIndex - hoveredSlot);
        animDelay = distance * 0.015; // Phân tầng thời gian micro-stagger tự nhiên

        if (isHovered) {
          targetY -= verticalUnit * 2.8; // Thẻ được chọn nâng cao lên
          targetScale = slot.scale * 1.08; // Phóng lớn nhẹ
        } else {
          // Lực đẩy dạt sang hai bên: các thẻ kề bên dạt nhiều nhất, các thẻ xa hơn dạt đều
          const pushStrength = spacing * (0.68 / (distance * 0.85 + 0.15));
          if (slotIndex < hoveredSlot) {
            targetX -= pushStrength;
            targetRot -= 2.5 / (distance + 0.5);
          } else {
            targetX += pushStrength;
            targetRot += 2.5 / (distance + 0.5);
          }
          targetScale = slot.scale * 0.98;
        }
      } else {
        animDelay = Math.abs(slotIndex - HALF_FAN) * 0.015;
      }

      // Đảm bảo zIndex: Thẻ được hover luôn cao nhất (70), các thẻ còn lại giữ đúng tầng cấu trúc
      const targetZIndex = isHovered ? 70 : slot.zIndex;

      const target = {
        xPercent: -50,
        x: targetX,
        y: targetY,
        rotation: targetRot,
        scale: targetScale,
        opacity: 1,
        zIndex: targetZIndex,
        pointerEvents: 'auto',
      };

      if (entrance) {
        gsap.fromTo(card, { xPercent: -50, x: 0, y: verticalUnit * 10, rotation: 0, scale: 0.5, opacity: 0, zIndex: targetZIndex }, {
          ...target,
          duration: 1.1,
          delay: 0.08 + slotIndex * 0.04,
          ease: 'elastic.out(1, 0.8)',
          overwrite: 'auto',
        });
      } else if (!wasVisible.has(cardIndex)) {
        const enterFromRight = travelDirection.current === 1;
        gsap.fromTo(card, {
          xPercent: -50,
          x: offsetFor(slotIndex) + (enterFromRight ? spacing * 0.85 : -spacing * 0.85),
          y: slot.y * verticalUnit + verticalUnit * 0.9,
          rotation: slot.rotation + (enterFromRight ? 9 : -9),
          scale: slot.scale * 0.64,
          opacity: 0,
          zIndex: targetZIndex,
        }, {
          ...target,
          duration: 0.45,
          ease: 'power3.out',
          overwrite: 'auto',
        });
      } else {
        // Cập nhật ngay lập tức zIndex khi bắt đầu chuyển động để không bao giờ bị đè ảnh
        gsap.set(card, { zIndex: targetZIndex });
        gsap.to(card, {
          ...target,
          duration: hoveredSlot === undefined ? 0.48 : 0.42,
          delay: animDelay,
          ease: 'elastic.out(1, 0.85)',
          overwrite: 'auto',
        });
      }
    });

    previousHoveredSlot.current = hoveredSlot;
    previousVisible.current = new Set(visibleMap.keys());
  }, [getVisibleMap, hoveredIndex]);

  useEffect(() => {
    if (!landmarks.length) return;
    animateLayout(!hasEntered.current);
    hasEntered.current = true;
    const onResize = () => animateLayout();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [animateLayout, landmarks.length]);

  const cycle = (direction: -1 | 1) => {
    if (!landmarks.length) return;
    travelDirection.current = direction;
    setHoveredIndex(null);
    setCenterIndex(current => (current + direction + landmarks.length) % landmarks.length);
  };

  const focusCard = (event: React.MouseEvent<HTMLAnchorElement>, index: number) => {
    event.preventDefault();
    if (didSwipe.current) {
      didSwipe.current = false;
      return;
    }
    if (event.currentTarget.getAttribute('aria-current') === 'true') {
      navigate(event.currentTarget.getAttribute('href') || '/di-san');
      return;
    }
    const selectedSlot = getVisibleMap().get(index);
    travelDirection.current = selectedSlot !== undefined && selectedSlot < HALF_FAN ? -1 : 1;
    setHoveredIndex(null);
    setCenterIndex(index);
  };

  const visibleCards = getVisibleMap();

  if (isLoading) {
    return (
      <section className="figma-heritage-section" id="di-san" aria-busy="true">
        <div className="container">
          <div className="figma-section-header heritage-fan-header">
            <span className="figma-eyebrow">
              <IconHeritageSeal size={16} color="var(--figma-gold)" style={{ verticalAlign: 'middle', marginRight: '6px' }} />
              {vi ? 'HÀNH TRÌNH DI SẢN' : 'HERITAGE TRAIL'}
            </span>
            <h2 className="figma-section-title">{vi ? 'Khám phá di sản qua từng trang ảnh' : 'Discover heritage through every card'}</h2>
            <p className="figma-section-subtitle">
              {vi ? 'Khám phá các điểm di sản quanh Đường Sách.' : 'Discover heritage landmarks around Book Street.'}
            </p>
          </div>

          <div className="heritage-fan-shell" aria-hidden="true">
            <div className="heritage-fan-stage" style={{ pointerEvents: 'none' }}>
              {FAN_SLOTS.map((slot, index) => {
                const isCenter = index === HALF_FAN;
                const isMobile = typeof window !== 'undefined' && window.innerWidth <= 760;
                const spacing = isMobile ? 60 : 205;
                const xOffset = (index - HALF_FAN) * spacing;
                return (
                  <div
                    key={index}
                    className="heritage-fan-card skeleton-card"
                    style={{
                      position: 'absolute',
                      left: '50%',
                      top: '50%',
                      transform: `translate(-50%, -50%) translate3d(${xOffset}px, ${slot.y * 8}px, 0px) rotate(${slot.rotation}deg) scale(${slot.scale})`,
                      zIndex: slot.zIndex,
                      opacity: 1,
                      pointerEvents: 'none',
                    }}
                  >
                    <div className="skeleton-box" style={{ width: '100%', height: '100%' }} />
                    <span className="heritage-fan-shade" aria-hidden="true" />
                    {isCenter && (
                      <span className="heritage-fan-copy" style={{ zIndex: 12 }}>
                        <div className="skeleton-box" style={{ width: '90px', height: '14px', marginBottom: '6px' }} />
                        <div className="skeleton-box" style={{ width: '140px', height: '18px', marginBottom: '8px' }} />
                        <div className="skeleton-box" style={{ width: '100px', height: '14px' }} />
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>
    );
  }

  if (landmarks.length === 0) {
    return (
      <section className="figma-heritage-section" id="di-san">
        <div className="container">
          <div className="figma-section-header heritage-fan-header">
            <span className="figma-eyebrow">
              <IconHeritageSeal size={16} color="var(--figma-gold)" style={{ verticalAlign: 'middle', marginRight: '6px' }} />
              {vi ? 'HÀNH TRÌNH DI SẢN' : 'HERITAGE TRAIL'}
            </span>
            <h2 className="figma-section-title">
              {vi ? 'Khám phá di sản qua từng trang ảnh' : 'Discover heritage through every card'}
            </h2>
            <p className="figma-section-subtitle" role={error ? 'alert' : undefined}>
              {error
                ? (vi ? 'Chưa thể tải nội dung di sản. Vui lòng thử lại sau.' : 'Heritage content is unavailable. Please try again later.')
                : (vi ? 'Hiện chưa có nội dung di sản được công bố.' : 'There is no published heritage content yet.')}
            </p>
          </div>
          <div className="section-bottom-see-more-row heritage-section-more-row">
            <Link
              to="/di-san"
              className="btn-section-see-more-borderless heritage-btn-see-more-borderless"
              aria-label={vi ? 'Mở không gian di sản' : 'Open heritage collection'}
            >
              <span>{vi ? 'Mở không gian di sản' : 'Open heritage collection'}</span>
              <ChevronRight size={17} className="see-more-arrow-icon heritage-more-icon" />
            </Link>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="figma-heritage-section" id="di-san">
      <div className="container">
        <div className="figma-section-header heritage-fan-header">
          <span className="figma-eyebrow">
            <IconHeritageSeal size={16} color="var(--figma-gold)" style={{ verticalAlign: 'middle', marginRight: '6px' }} />
            {vi ? 'HÀNH TRÌNH DI SẢN' : 'HERITAGE TRAIL'}
          </span>
          <h2 className="figma-section-title">{vi ? 'Khám phá di sản qua từng trang ảnh' : 'Discover heritage through every card'}</h2>
          <p className="figma-section-subtitle">
            {vi ? 'Khám phá các điểm di sản quanh Đường Sách.' : 'Discover heritage landmarks around Book Street.'}
          </p>
        </div>

        <div className="heritage-fan-shell" aria-label={vi ? 'Các điểm di sản' : 'Heritage landmarks'} onMouseLeave={() => setHoveredIndex(null)}>
          <div
            className="heritage-fan-stage"
            onPointerDown={(event) => {
              if (event.pointerType === 'mouse') return;
              swipeStartX.current = event.clientX;
              didSwipe.current = false;
            }}
            onPointerUp={(event) => {
              if (swipeStartX.current === null) return;
              const distance = event.clientX - swipeStartX.current;
              swipeStartX.current = null;
              if (Math.abs(distance) < 35) return;
              didSwipe.current = true;
              cycle(distance < 0 ? 1 : -1);
            }}
            onPointerCancel={() => { swipeStartX.current = null; }}
          >
            {landmarks.map((heritage, index) => (
              <Link
                to={`/di-san/${encodeURIComponent(heritage.publicCode)}`}
                key={heritage.publicCode}
                ref={element => { cardRefs.current[index] = element; }}
                className="heritage-fan-card"
                aria-label={`${vi ? 'Khám phá' : 'Explore'} ${heritage.title}`}
                aria-current={index === activeIndex ? 'true' : undefined}
                tabIndex={visibleCards.has(index) ? 0 : -1}
                onClick={event => focusCard(event, index)}
                onMouseEnter={() => setHoveredIndex(index)}
                onFocus={() => setHoveredIndex(index)}
                onBlur={() => setHoveredIndex(null)}
              >
                <FanImage item={heritage} vi={vi} />
                <span className="heritage-fan-shade" aria-hidden="true" />
                <span className="heritage-fan-copy">
                  {heritage.locationText && (
                    <span className="heritage-fan-place"><MapPin size={13} /> {heritage.locationText}</span>
                  )}
                  <strong>{heritage.title}</strong>
                  <span className="heritage-fan-open">{vi ? 'Mở câu chuyện' : 'Open story'} <ArrowRight size={15} /></span>
                </span>
              </Link>
            ))}
          </div>
        </div>

        {landmarks.length > 1 && (
          <div className="heritage-fan-controls" aria-label={vi ? 'Điều hướng di tích' : 'Heritage navigation'}>
            <button type="button" className="heritage-fan-control" onClick={() => cycle(-1)} aria-label={vi ? 'Di tích trước' : 'Previous landmark'}><ChevronLeft size={20} /></button>
            <div className="heritage-fan-progress" aria-live="polite" aria-atomic="true">
              {landmarks.length <= 8 && (
                <div className="heritage-fan-dots" aria-hidden="true">
                  {landmarks.map((heritage, index) => <span key={heritage.publicCode} className={index === activeIndex ? 'is-active' : ''} />)}
                </div>
              )}
              <span className="heritage-fan-counter"><strong>{activeIndex + 1}</strong> / {landmarks.length} {vi ? 'di sản' : 'stories'}</span>
            </div>
            <button type="button" className="heritage-fan-control" onClick={() => cycle(1)} aria-label={vi ? 'Di tích tiếp theo' : 'Next landmark'}><ChevronRight size={20} /></button>
          </div>
        )}

        <div className="section-bottom-see-more-row heritage-section-more-row">
          <Link
            to="/di-san"
            className="btn-section-see-more-borderless heritage-btn-see-more-borderless"
            aria-label={vi ? `Xem đầy đủ ${landmarks.length} điểm di sản` : `View all ${landmarks.length} landmarks`}
          >
            <span>{vi ? `Xem đầy đủ ${landmarks.length} điểm di sản` : `View all ${landmarks.length} landmarks`}</span>
            <ChevronRight size={17} className="see-more-arrow-icon heritage-more-icon" />
          </Link>
        </div>
      </div>
    </section>
  );
};
