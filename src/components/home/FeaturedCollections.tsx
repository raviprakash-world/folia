import { Link } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';
import { Container } from '@/components/ui/Container';
import { SectionHeading } from '@/components/common/SectionHeading';
import { featuredCollections } from '@/data/homepage';

export function FeaturedCollections() {
  return (
    <Container className="py-20">
      <SectionHeading eyebrow="Curated" title="Shop by collection" />
      <div className="grid sm:grid-cols-3 gap-6">
        {featuredCollections.map((collection) => (
          <Link
            key={collection.slug}
            to={`/collections/${collection.slug}`}
            className="group relative aspect-[4/5] rounded-[var(--radius-card)] bg-fern/25 border border-stone-dark overflow-hidden flex flex-col justify-end p-6"
          >
            <ArrowUpRight
              size={20}
              className="absolute top-5 right-5 text-pine opacity-0 group-hover:opacity-100 transition-opacity"
            />
            <h3 className="font-display text-xl font-semibold text-pine">{collection.name}</h3>
            <p className="text-sm text-ink-soft mt-1">{collection.description}</p>
          </Link>
        ))}
      </div>
    </Container>
  );
}
