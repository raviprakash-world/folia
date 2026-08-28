import { Swiper, SwiperSlide } from 'swiper/react';
import { Pagination } from 'swiper/modules';
import { Container } from '@/components/ui/Container';
import { SectionHeading } from '@/components/common/SectionHeading';
import { testimonials } from '@/data/homepage';
import 'swiper/css';
import 'swiper/css/pagination';

export function Testimonials() {
  return (
    <Container className="py-20">
      <SectionHeading eyebrow="From customers" title="What people say" />
      <Swiper
        modules={[Pagination]}
        pagination={{ clickable: true }}
        spaceBetween={24}
        slidesPerView={1}
        breakpoints={{ 768: { slidesPerView: 2 }, 1024: { slidesPerView: 3 } }}
        className="!pb-12"
      >
        {testimonials.map((t) => (
          <SwiperSlide key={t.id}>
            <blockquote className="h-full flex flex-col justify-between bg-stone-light border border-stone-dark rounded-[var(--radius-card)] p-6">
              <p className="text-ink text-[15px] leading-relaxed">&ldquo;{t.quote}&rdquo;</p>
              <footer className="mt-6 font-mono text-xs text-ink-soft">
                {t.author} — {t.location}
              </footer>
            </blockquote>
          </SwiperSlide>
        ))}
      </Swiper>
    </Container>
  );
}
