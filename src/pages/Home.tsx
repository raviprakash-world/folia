import { Link } from 'react-router-dom';
import { Container } from '@/components/ui/Container';
import { Button } from '@/components/ui/Button';
import { Tag } from '@/components/ui/Tag';
import { ArrowRight } from 'lucide-react';
import { FeaturedCollections } from '@/components/home/FeaturedCollections';
import { BestSellers } from '@/components/home/BestSellers';
import { RecommendedForYou } from '@/components/home/RecommendedForYou';
import { TrendingProducts } from '@/components/home/TrendingProducts';
import { Benefits } from '@/components/home/Benefits';
import { Testimonials } from '@/components/home/Testimonials';
import { PromoBanners } from '@/components/home/PromoBanners';
import { BlogPreview } from '@/components/home/BlogPreview';

export default function Home() {
  return (
    <>
      <section className="bg-pine text-stone-light">
        <Container className="py-24 md:py-32 grid md:grid-cols-2 gap-12 items-center">
          <div>
            <Tag tone="ochre" tilted>New season</Tag>
            <h1 className="font-display text-5xl md:text-6xl font-semibold leading-[1.05] mt-5">
              Living design for the home.
            </h1>
            <p className="mt-5 text-stone/75 text-lg max-w-[42ch]">
              Considered plants and vessels, chosen for how they hold light in a room —
              not just how they photograph.
            </p>
            <div className="mt-8 flex gap-3">
              <Button variant="secondary" size="lg" icon={<ArrowRight size={18} />} iconPosition="right">
                <Link to="/shop">Shop the collection</Link>
              </Button>
              <Button
                variant="outline"
                size="lg"
                className="!text-stone-light !border-stone-light hover:!bg-stone-light hover:!text-heading"
              >
                <Link to="/about">Our approach</Link>
              </Button>
            </div>
          </div>
          <div className="aspect-[4/5] rounded-[var(--radius-card)] bg-fern/30 border border-stone-light/10 flex items-center justify-center">
            <span className="font-mono text-xs text-stone-light/50 uppercase tracking-wider">
              Hero image placeholder
            </span>
          </div>
        </Container>
      </section>

      <FeaturedCollections />
      <BestSellers />
      <RecommendedForYou />
      <TrendingProducts />
      <Benefits />
      <Testimonials />
      <PromoBanners />
      <BlogPreview />
    </>
  );
}
