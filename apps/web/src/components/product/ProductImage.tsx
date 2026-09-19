import { useState } from 'react';
import { cn } from '@/utils/cn';

interface ProductImageProps {
  src?: string | null;
  alt: string;
  className?: string;
}

/**
 * Fills its (positioned) parent with the photo, or leaves the parent's own
 * bg-stone-dark block visible when there's no image or it fails to load —
 * a missing/broken photo degrades to the old placeholder, never a broken-
 * image icon. The parent must be `relative` with a fixed size/aspect.
 */
export function ProductImage({ src, alt, className }: ProductImageProps) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  if (!src || failedSrc === src) return null;
  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      decoding="async"
      onError={() => setFailedSrc(src)}
      className={cn('absolute inset-0 w-full h-full object-cover', className)}
    />
  );
}
