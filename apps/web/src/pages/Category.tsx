import { useParams } from 'react-router-dom';
import { ProductListing } from '@/components/product/ProductListing';
import { categories } from '@/data/categories';
import { useCollection } from '@/hooks/useCollection';

export default function Category() {
  const { slug } = useParams<{ slug: string }>();
  const category = categories.find((c) => c.slug === slug);

  // Real categories (plants/vessels/tools) resolve instantly from local data.
  // Curated collections (e.g. "gifting", spanning multiple categories) fetch
  // their framing copy from the mock /api/collections/:slug endpoint —
  // skipped entirely when it's a real category, so no unnecessary request.
  const { data: collection, isLoading: collectionLoading } = useCollection(category ? undefined : slug);
  const meta = category ?? collection;

  // A curated collection spans categories, so it filters by collection
  // membership instead of categorySlug.
  const fixedCategory = category ? category.slug : undefined;
  const fixedCollection = category ? undefined : slug;

  const title = meta?.name ?? (collectionLoading ? 'Loading…' : (slug ?? 'Collection'));

  return <ProductListing title={title} description={meta?.description} fixedCategory={fixedCategory}
      fixedCollection={fixedCollection}
    />;
}
