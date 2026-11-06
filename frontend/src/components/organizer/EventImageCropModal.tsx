import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, Move, RotateCcw, X, ZoomIn, ZoomOut } from 'lucide-react';
import { useBackdropClick } from '../../hooks/useBackdropClick';
import './EventImageCropModal.css';

interface EventImageCropModalProps {
  isOpen: boolean;
  imageSrc: string;
  fileName?: string;
  fileType?: string;
  onClose: () => void;
  onConfirm: (croppedFile: File, previewUrl: string, dataUrl: string) => void;
}

const CROP_WIDTH = 1280;
const CROP_HEIGHT = 720;
const VIEWPORT_ASPECT = 16 / 9;

export const EventImageCropModal: React.FC<EventImageCropModalProps> = ({
  isOpen,
  imageSrc,
  fileName = 'event-banner.jpg',
  fileType = 'image/jpeg',
  onClose,
  onConfirm,
}) => {
  const viewportRef = useRef<HTMLDivElement>(null);
  const imageElementRef = useRef<HTMLImageElement | null>(null);

  const [imgDimensions, setImgDimensions] = useState<{ width: number; height: number } | null>(null);
  const [viewportSize, setViewportSize] = useState<{ width: number; height: number }>({ width: 540, height: 303.75 });
  const [zoom, setZoom] = useState<number>(1);
  const [offset, setOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number; startOffsetX: number; startOffsetY: number }>({
    x: 0,
    y: 0,
    startOffsetX: 0,
    startOffsetY: 0,
  });
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [isImageLoading, setIsImageLoading] = useState<boolean>(true);
  const [cropError, setCropError] = useState('');
  const backdropHandlers = useBackdropClick(() => { if (!isProcessing) onClose(); });

  // Measure viewport
  useEffect(() => {
    if (!isOpen) return;
    const updateViewportSize = () => {
      if (viewportRef.current) {
        const rect = viewportRef.current.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          setViewportSize({ width: rect.width, height: rect.height });
        }
      }
    };
    updateViewportSize();
    window.addEventListener('resize', updateViewportSize);
    return () => window.removeEventListener('resize', updateViewportSize);
  }, [isOpen]);

  // Load natural image dimensions
  useEffect(() => {
    if (!isOpen || !imageSrc) return;
    let cancelled = false;
    imageElementRef.current = null;
    // Reset the view while synchronizing with the newly requested external image resource.
    // oxlint-disable-next-line react/set-state-in-effect
    setImgDimensions(null);
    setIsImageLoading(true);
    setCropError('');
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      if (cancelled) return;
      imageElementRef.current = img;
      setImgDimensions({ width: img.naturalWidth || 800, height: img.naturalHeight || 450 });
      setZoom(1);
      setOffset({ x: 0, y: 0 });
      setIsImageLoading(false);
    };
    img.onerror = () => {
      if (cancelled) return;
      imageElementRef.current = null;
      setImgDimensions(null);
      setIsImageLoading(false);
      setCropError('Không thể tải ảnh để căn chỉnh. Ảnh từ website khác có thể không cho phép chỉnh sửa tại đây. Bạn vẫn có thể hủy và giữ ảnh gốc.');
    };
    img.src = imageSrc;
    return () => {
      cancelled = true;
      img.onload = null;
      img.onerror = null;
    };
  }, [isOpen, imageSrc]);

  if (!isOpen || !imageSrc) return null;

  // Compute base scale so image covers the viewport at zoom = 1
  const getBaseScale = () => {
    if (!imgDimensions) return 1;
    const scaleX = viewportSize.width / imgDimensions.width;
    const scaleY = viewportSize.height / imgDimensions.height;
    return Math.max(scaleX, scaleY);
  };

  const baseScale = getBaseScale();
  const renderedWidth = imgDimensions ? imgDimensions.width * baseScale * zoom : viewportSize.width;
  const renderedHeight = imgDimensions ? imgDimensions.height * baseScale * zoom : viewportSize.height;

  const maxOffsetX = Math.max(0, (renderedWidth - viewportSize.width) / 2);
  const maxOffsetY = Math.max(0, (renderedHeight - viewportSize.height) / 2);

  const clampOffset = (nextX: number, nextY: number, currentZoom = zoom) => {
    if (!imgDimensions) return { x: 0, y: 0 };
    const rW = imgDimensions.width * baseScale * currentZoom;
    const rH = imgDimensions.height * baseScale * currentZoom;
    const maxX = Math.max(0, (rW - viewportSize.width) / 2);
    const maxY = Math.max(0, (rH - viewportSize.height) / 2);
    return {
      x: Math.min(maxX, Math.max(-maxX, nextX)),
      y: Math.min(maxY, Math.max(-maxY, nextY)),
    };
  };

  const clampedOffset = clampOffset(offset.x, offset.y, zoom);

  const handleZoomChange = (nextZoom: number) => {
    const validZoom = Math.min(3, Math.max(1, Number(nextZoom.toFixed(2))));
    setZoom(validZoom);
    setOffset(prev => clampOffset(prev.x, prev.y, validZoom));
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    setIsDragging(true);
    setDragStart({
      x: e.clientX,
      y: e.clientY,
      startOffsetX: clampedOffset.x,
      startOffsetY: clampedOffset.y,
    });
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    const dx = e.clientX - dragStart.x;
    const dy = e.clientY - dragStart.y;
    setOffset(clampOffset(dragStart.startOffsetX + dx, dragStart.startOffsetY + dy, zoom));
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    setIsDragging(false);
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // Ignore if not captured
    }
  };

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    const delta = e.deltaY < 0 ? 0.08 : -0.08;
    handleZoomChange(zoom + delta);
  };

  const handleReset = () => {
    setZoom(1);
    setOffset({ x: 0, y: 0 });
  };

  const handleApplyCrop = async () => {
    if (!imageElementRef.current || !imgDimensions || isProcessing) return;
    setIsProcessing(true);
    setCropError('');
    try {
      const canvas = document.createElement('canvas');
      canvas.width = CROP_WIDTH;
      canvas.height = CROP_HEIGHT;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Could not initialize canvas');

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';

      // Map viewport coordinates to natural image coordinates
      // In viewport: image center is at (viewportSize.width/2 + clampedOffset.x, viewportSize.height/2 + clampedOffset.y)
      // Top-left of image in viewport:
      const imgLeftInViewport = (viewportSize.width - renderedWidth) / 2 + clampedOffset.x;
      const imgTopInViewport = (viewportSize.height - renderedHeight) / 2 + clampedOffset.y;

      // The viewport's (0, 0) corresponds to (-imgLeftInViewport, -imgTopInViewport) in rendered image pixels
      const totalScale = baseScale * zoom;
      const sx = Math.max(0, -imgLeftInViewport / totalScale);
      const sy = Math.max(0, -imgTopInViewport / totalScale);
      const sWidth = Math.min(imgDimensions.width - sx, viewportSize.width / totalScale);
      const sHeight = Math.min(imgDimensions.height - sy, viewportSize.height / totalScale);

      ctx.drawImage(
        imageElementRef.current,
        sx,
        sy,
        sWidth,
        sHeight,
        0,
        0,
        CROP_WIDTH,
        CROP_HEIGHT
      );

      const outputMime = ['image/jpeg', 'image/png', 'image/webp'].includes(fileType) ? fileType : 'image/jpeg';
      const dataUrl = canvas.toDataURL(outputMime, 0.92);
      const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, outputMime, 0.92));
      if (!blob) throw new Error('Failed to generate cropped image');

      const ext = outputMime === 'image/png' ? 'png' : outputMime === 'image/webp' ? 'webp' : 'jpg';
      const baseName = fileName.replace(/\.[^/.]+$/, '') || 'event-banner';
      const croppedFile = new File([blob], `${baseName}-cropped.${ext}`, { type: outputMime });
      const previewUrl = URL.createObjectURL(croppedFile);

      onConfirm(croppedFile, previewUrl, dataUrl);
    } catch {
      setCropError('Không thể tạo ảnh đã căn chỉnh. Liên kết ảnh có thể chặn xử lý CORS; vui lòng hủy để giữ ảnh gốc hoặc chọn ảnh từ máy.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Compute CSS percentage positions for live mini-card previews so user sees exact framing
  const focusPercentX = maxOffsetX > 0 ? 50 - (clampedOffset.x / maxOffsetX) * 50 : 50;
  const focusPercentY = maxOffsetY > 0 ? 50 - (clampedOffset.y / maxOffsetY) * 50 : 50;

  return createPortal(
    <div className="org-crop-modal-backdrop" {...backdropHandlers}>
      <div
        className="org-crop-modal-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="org-crop-modal-title"
        onClick={e => e.stopPropagation()}
      >
        <div className="org-crop-modal-header">
          <div>
            <h3 id="org-crop-modal-title">Căn chỉnh ảnh sự kiện</h3>
            <p>Kéo để di chuyển và phóng to ảnh sao cho hiển thị đẹp nhất trên các thẻ sự kiện & modal</p>
          </div>
          <button type="button" className="org-crop-close-btn" onClick={onClose} aria-label="Đóng">
            <X size={20} />
          </button>
        </div>

        <div className="org-crop-modal-body">
          {cropError && <div className="org-crop-error" role="alert">{cropError}</div>}
          {isImageLoading && <div className="org-crop-loading" role="status">Đang tải ảnh để căn chỉnh…</div>}
          {/* Interactive Facebook-style Reposition Viewport */}
          <div
            ref={viewportRef}
            className={`org-crop-viewport ${isDragging ? 'is-dragging' : ''}`}
            style={{ aspectRatio: `${VIEWPORT_ASPECT}` }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            onWheel={handleWheel}
          >
            {imgDimensions && !cropError && (
              <img
                src={imageSrc}
                alt="Khung căn chỉnh"
                className="org-crop-source-image"
                draggable={false}
                style={{
                  width: `${renderedWidth}px`,
                  height: `${renderedHeight}px`,
                  transform: `translate3d(${clampedOffset.x}px, ${clampedOffset.y}px, 0)`,
                }}
              />
            )}

            {/* Rule of thirds grid & safe zone guide */}
            <div className="org-crop-grid-overlay" aria-hidden="true">
              <div className="org-crop-grid-line is-v1" />
              <div className="org-crop-grid-line is-v2" />
              <div className="org-crop-grid-line is-h1" />
              <div className="org-crop-grid-line is-h2" />
            </div>

            <div className="org-crop-drag-pill" aria-hidden="true">
              <Move size={14} />
              <span>Kéo để đặt lại vị trí ảnh</span>
            </div>
          </div>

          {/* Facebook-style Zoom Slider Bar */}
          <div className="org-crop-controls-bar" aria-disabled={!imgDimensions || Boolean(cropError)}>
            <button
              type="button"
              className="org-crop-zoom-btn"
              onClick={() => handleZoomChange(zoom - 0.1)}
              disabled={!imgDimensions || Boolean(cropError) || zoom <= 1}
              aria-label="Thu nhỏ"
            >
              <ZoomOut size={18} />
            </button>
            <input
              type="range"
              min="1"
              max="3"
              step="0.02"
              value={zoom}
              onChange={e => handleZoomChange( parseFloat(e.target.value) )}
              className="org-crop-zoom-slider"
              aria-label="Mức phóng đại ảnh"
              disabled={!imgDimensions || Boolean(cropError)}
            />
            <button
              type="button"
              className="org-crop-zoom-btn"
              onClick={() => handleZoomChange(zoom + 0.1)}
              disabled={!imgDimensions || Boolean(cropError) || zoom >= 3}
              aria-label="Phóng to"
            >
              <ZoomIn size={18} />
            </button>
            <span className="org-crop-zoom-value">{Math.round(zoom * 100)}%</span>
            <button
              type="button"
              className="org-crop-reset-btn"
              onClick={handleReset}
              title="Đặt lại vị trí ban đầu"
              disabled={!imgDimensions || Boolean(cropError)}
            >
              <RotateCcw size={14} /> Đặt lại
            </button>
          </div>

          {/* Live Multi-Card Preview Strip */}
          {imgDimensions && !cropError && <div className="org-crop-live-previews">
            <span className="org-crop-preview-label">Xem trước hiển thị trên các thẻ & modal (không bị mất góc quan trọng):</span>
            <div className="org-crop-preview-cards">
              <div className="org-crop-preview-item">
                <div className="org-crop-preview-frame is-banner">
                  <img
                    src={imageSrc}
                    alt="Preview thẻ sự kiện"
                    style={{
                      objectPosition: `${focusPercentX}% ${focusPercentY}%`,
                      transform: `scale(${zoom})`,
                    }}
                  />
                  <div className="org-crop-preview-shade" />
                  <strong>Thẻ khám phá & Banner Modal</strong>
                </div>
              </div>
              <div className="org-crop-preview-item">
                <div className="org-crop-preview-frame is-thumb">
                  <img
                    src={imageSrc}
                    alt="Preview danh sách"
                    style={{
                      objectPosition: `${focusPercentX}% ${focusPercentY}%`,
                      transform: `scale(${zoom})`,
                    }}
                  />
                </div>
                <small>Ảnh thu nhỏ</small>
              </div>
            </div>
          </div>}
        </div>

        <div className="org-crop-modal-footer">
          <button type="button" className="btn-org-secondary" onClick={onClose} disabled={isProcessing}>
            Hủy
          </button>
          <button
            type="button"
            className="btn-org-primary org-crop-save-btn"
            onClick={() => void handleApplyCrop()}
            disabled={isProcessing || isImageLoading || !imgDimensions || Boolean(cropError)}
          >
            <Check size={16} />
            {isProcessing ? 'Đang xử lý...' : 'Lưu vị trí ảnh'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
