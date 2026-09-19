import { Hero } from '@/components/home/Hero';
import { CategoryTiles } from '@/components/home/CategoryTiles';
import { NewArrivals } from '@/components/home/NewArrivals';
import { ShopByNeed } from '@/components/home/ShopByNeed';
import { BestSellers } from '@/components/home/BestSellers';
import { Planters } from '@/components/home/Planters';
import { WhyFolia } from '@/components/home/WhyFolia';
import { ServicesSegment } from '@/components/home/ServicesSegment';
import { BlogPreview } from '@/components/home/BlogPreview';

export default function Home() {
  return (
    <>
      <Hero />
      <CategoryTiles />
      <NewArrivals />
      <ShopByNeed />
      <BestSellers />
      <Planters />
      <WhyFolia />
      <ServicesSegment />
      <BlogPreview />
    </>
  );
}
