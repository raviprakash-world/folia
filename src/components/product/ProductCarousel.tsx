import { Swiper, SwiperSlide } from 'swiper/react';
import { Navigation, A11y } from 'swiper/modules';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useId } from 'react';
import { ProductCard } from './ProductCard';
import type { Product } from '@/types/product';
import 'swiper/css';
import 'swiper/css/navigation';

interface ProductCarouselProps {
  products: Product[];
}

export function ProductCarousel({ products }: ProductCarouselProps) {
  const rawId = useId().replace(/:/g, '');
  const prevClass = `carousel-prev-${rawId}`;
  const nextClass = `carousel-next-${rawId}`;

  return (
    <div className="relative">
      <Swiper
        modules={[Navigation, A11y]}
        navigation={{ prevEl: `.${prevClass}`, nextEl: `.${nextClass}` }}
        spaceBetween={20}
        slidesPerView={1.3}
        breakpoints={{
          480: { slidesPerView: 2.2 },
          768: { slidesPerView: 3.2 },
          1024: { slidesPerView: 4 },
        }}
        a11y={{ enabled: true }}
        className="!pb-2"
      >
        {products.map((product) => (
          <SwiperSlide key={product.id}>
            <ProductCard product={product} />
          </SwiperSlide>
        ))}
      </Swiper>

      <button
        type="button"
        aria-label="Previous products"
        className={`${prevClass} hidden md:flex absolute top-1/2 -left-4 -translate-y-1/2 z-10 items-center justify-center w-10 h-10 rounded-full bg-stone-light shadow-[var(--shadow-lifted)] text-heading disabled:opacity-30`}
      >
        <ChevronLeft size={18} />
      </button>
      <button
        type="button"
        aria-label="Next products"
        className={`${nextClass} hidden md:flex absolute top-1/2 -right-4 -translate-y-1/2 z-10 items-center justify-center w-10 h-10 rounded-full bg-stone-light shadow-[var(--shadow-lifted)] text-heading disabled:opacity-30`}
      >
        <ChevronRight size={18} />
      </button>
    </div>
  );
}
