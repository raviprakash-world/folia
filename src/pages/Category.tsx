import { useParams } from 'react-router-dom';
import { ProductListing } from '@/components/product/ProductListing';
import { collections, categories } from '@/data/categories';

export default function Category() {
  const { slug } = useParams<{ slug: string }>();
  const collection = collections.find((c) => c.slug === slug);
  const category = categories.find((c) => c.slug === slug);
  const meta = collection ?? category;

  // Collections are curated groupings without a matching product.categorySlug filter
  // (e.g. "gifting" spans multiple real categories) — for now we filter by category
  // slug directly where one exists, and fall back to showing the full catalog with
  // the collection's framing copy. A real backend would resolve this server-side.
  const fixedCategory = category ? category.slug : undefined;

  return (
    <ProductListing
      title={meta?.name ?? slug ?? 'Collection'}
      description={meta?.description}
      fixedCategory={fixedCategory}
    />
  );
}
