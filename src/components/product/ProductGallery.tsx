import { useState, useRef } from 'react';
import type { MouseEvent } from 'react';
import { cn } from '@/utils/cn';

interface ProductGalleryProps {
  productName: string;
  /** Placeholder count — real image URLs arrive once product photography exists. */
  imageCount?: number;
}

/**
 * Zoom is a CSS transform-origin trick driven by mouse position, not a separate
 * lightbox component — simpler, no extra dependency, and it's the interaction
 * pattern most premium product pages actually use for the primary image.
 */
export function ProductGallery({ productName, imageCount = 4 }: ProductGalleryProps) {
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
          <span className="font-mono text-xs text-ink-soft/50 uppercase tracking-wider">
            {productName} — image {activeIndex + 1}
          </span>
        </div>
      </div>

      <div className="flex gap-3 mt-4">
        {Array.from({ length: imageCount }).map((_, i) => (
          <button
            key={i}
            type="button"
            onClick={() => setActiveIndex(i)}
            aria-label={`View image ${i + 1}`}
            aria-current={activeIndex === i}
            className={cn(
              'w-16 h-16 rounded-[var(--radius-control)] bg-stone-dark shrink-0 transition-all',
              activeIndex === i ? 'ring-2 ring-fern ring-offset-2 ring-offset-stone' : 'opacity-60 hover:opacity-100'
            )}
          />
        ))}
      </div>
    </div>
  );
}
