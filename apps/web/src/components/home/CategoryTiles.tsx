import { Link } from 'react-router-dom';
import { Container } from '@/components/ui/Container';
import { SectionHeading } from '@/components/common/SectionHeading';
import { ProductImage } from '@/components/product/ProductImage';
import { categories } from '@/data/categories';
import { categoryImages, productPhoto } from '@/data/collectionImages';

export function CategoryTiles() {
  return (
    <Container className="py-8 sm:py-12">
      <SectionHeading title="Shop by category" />
      <ul className="grid grid-cols-3 gap-x-3 gap-y-5 sm:grid-cols-6 sm:gap-x-5">
        {categories.map((c) => (
          <li key={c.slug}>
            <Link to={`/collections/${c.slug}`} className="group flex flex-col items-center gap-2 text-center">
              <span className="relative block aspect-square w-full overflow-hidden rounded-full bg-stone-dark ring-1 ring-stone-dark">
                <ProductImage
                  src={categoryImages[c.slug] ? productPhoto(categoryImages[c.slug]) : undefined}
                  alt=""
                  className="transition-transform duration-300 group-hover:scale-105"
                />
              </span>
              <span className="text-[13px] font-medium leading-tight text-ink sm:text-sm">{c.name}</span>
            </Link>
          </li>
        ))}
      </ul>
    </Container>
  );
}
