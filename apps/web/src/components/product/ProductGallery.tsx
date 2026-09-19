import { useState, useRef } from 'react';
import type { MouseEvent } from 'react';
import { cn } from '@/utils/cn';
import { ProductImage } from '@/components/product/ProductImage';
import type { ProductImage as ProductImageData } from '@/types/product';

interface ProductGalleryProps {
  productName: string;
  /** Real photos, primary first. With none, the gallery shows placeholder blocks (imageCount of them). */
  images?: ProductImageData[];
  imageCount?: number;
}

/**
 * Zoom is a CSS transform-origin trick driven by mouse position, not a separate
 * lightbox component — simpler, no extra dependency, and it's the interaction
 * pattern most premium product pages actually use for the primary image.
 */
export function ProductGallery({ productName, images = [], imageCount = 4 }: ProductGalleryProps) {
  const hasPhotos = images.length > 0;
  const thumbCount = hasPhotos ? images.length : imageCount;
  const [activeIndex, setActiveIndex] = useState(0);
  const [zoomActive, setZoomActive] = useState(false);
  const [zoomOrigin, setZoomOrigin] = useState('50% 50%');
  const imageRef = useRef<HTMLDivElement>(null);

  function handleMouseMove(e: MouseEvent<HTMLDivElement>) {
    const bounds = imageRef.current?.getBoundingClientRect();
    if (!bounds) return;
    const x = ((e.clientX - bounds.left) / bounds.width) * 100;
    const y = ((e.clientY - bounds.top) / bounds.height) * 100;
    setZoomOrigin(`${x}% ${y}%`);
  }

  return (
    <div>
      <div
        ref={imageRef}
        onMouseEnter={() => setZoomActive(true)}
        onMouseLeave={() => setZoomActive(false)}
        onMouseMove={handleMouseMove}
        className="relative aspect-square rounded-[var(--radius-card)] bg-stone-dark overflow-hidden cursor-zoom-in"
      >
        <div
          className="absolute inset-0 bg-stone-dark transition-transform duration-200 ease-out flex items-center justify-center"
          style={{
            transform: zoomActive ? 'scale(1.8)' : 'scale(1)',
            transformOrigin: zoomOrigin,
          }}
        >
          {hasPhotos ? (
            <ProductImage
              key={images[activeIndex]?.url}
              src={images[activeIndex]?.url}
              alt={images[activeIndex]?.altText ?? `${productName} — photo ${activeIndex + 1}`}
            />
          ) : (
            <span className="font-mono text-xs text-ink-soft uppercase tracking-wider">
              {productName} — image {activeIndex + 1}
            </span>
          )}
        </div>
      </div>

      <div className={cn('flex gap-3 mt-4', hasPhotos && thumbCount < 2 && 'hidden')}>
        {Array.from({ length: thumbCount }).map((_, i) => (
          <button
            key={i}
            type="button"
            onClick={() => setActiveIndex(i)}
            aria-label={`View image ${i + 1}`}
            aria-current={activeIndex === i}
            className={cn(
              'relative w-16 h-16 rounded-[var(--radius-control)] bg-stone-dark shrink-0 overflow-hidden transition-all',
              activeIndex === i ? 'ring-2 ring-fern ring-offset-2 ring-offset-stone' : 'opacity-60 hover:opacity-100'
            )}
          >
            {hasPhotos && <ProductImage src={images[i]?.url} alt="" />}
          </button>
        ))}
      </div>
    </div>
  );
}
