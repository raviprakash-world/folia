import { Link } from 'react-router-dom';
import { Container } from '@/components/ui/Container';
import { SectionHeading } from '@/components/common/SectionHeading';
import { SectionLink } from '@/components/common/SectionLink';
import { ProductImage } from '@/components/product/ProductImage';
import { collectionImages, productPhoto } from '@/data/collectionImages';

/** Only collections that hold real products (see catalog.json). */
const needs = [
  { slug: 'low-light-plants', label: 'Low-light friendly' },
  { slug: 'pet-friendly', label: 'Pet-friendly plants' },
  { slug: 'new-home', label: 'For beginners' },
  { slug: 'office', label: 'Desk & office plants' },
  { slug: 'gifting', label: 'Plants for gifting' },
  { slug: 'flowering', label: 'Flowering plants' },
];

export function ShopByNeed() {
  return (
    <div className="bg-stone-dark/40">
      <Container className="py-8 sm:py-12">
        <SectionHeading title="Shop by need" action={<SectionLink to="/collections">All collections</SectionLink>} />
        <ul className="-mx-4 flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:grid sm:grid-cols-3 sm:overflow-visible sm:px-0 lg:grid-cols-6 [&::-webkit-scrollbar]:hidden">
          {needs.map((n) => (
            <li key={n.slug} className="w-36 shrink-0 snap-start sm:w-auto">
              <Link
                to={`/collections/${n.slug}`}
                className="group relative block aspect-[4/5] overflow-hidden rounded-[var(--radius-card)] bg-fern/25"
              >
                <ProductImage src={productPhoto(collectionImages[n.slug])} alt="" className="transition-transform duration-500 group-hover:scale-105" />
                <span aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent" />
                <span className="absolute inset-x-0 bottom-0 p-3 text-[15px] font-semibold leading-tight text-white">{n.label}</span>
              </Link>
            </li>
          ))}
        </ul>
      </Container>
    </div>
  );
}
