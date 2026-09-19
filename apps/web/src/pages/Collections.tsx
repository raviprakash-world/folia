import { Link } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';
import { Container } from '@/components/ui/Container';
import { PageHeader } from '@/components/common/PageHeader';
import { ProductImage } from '@/components/product/ProductImage';
import { collections } from '@/data/categories';

const images: Record<string, string> = {
  'low-light-plants': 'snake-plant-laurentii',
  'statement-vessels': 'fluted-ceramic-planter',
  gifting: 'peace-lily',
  'pet-friendly': 'spider-plant',
  flowering: 'hibiscus',
  baskets: 'woven-plant-basket',
  'new-home': 'money-plant-golden-pothos',
  office: 'zz-plant',
};

export default function Collections() {
  return (
    <Container className="py-16">
      <PageHeader
        eyebrow="Curated"
        title="Shop by collection"
        description="Hand-picked groupings for a particular light, room or occasion."
      />
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {collections.map((c) => (
          <Link
            key={c.slug}
            to={`/collections/${c.slug}`}
            className="group relative aspect-[4/5] rounded-[var(--radius-card)] bg-fern/25 border border-stone-dark overflow-hidden flex flex-col justify-end p-6"
          >
            {images[c.slug] && (
              <ProductImage
                src={`/demo/products/${images[c.slug]}.jpg`}
                alt=""
                className="transition-transform duration-500 group-hover:scale-105"
              />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" aria-hidden="true" />
            <ArrowUpRight
              size={20}
              className="absolute top-5 right-5 text-white opacity-0 group-hover:opacity-100 transition-opacity"
            />
            <h2 className="relative font-display text-xl font-semibold text-white">{c.name}</h2>
            <p className="relative text-sm text-white/85 mt-1">{c.description}</p>
          </Link>
        ))}
      </div>
    </Container>
  );
}
