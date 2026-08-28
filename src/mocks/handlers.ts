import { http, HttpResponse, delay } from 'msw';
import { products } from '@/data/products';
import { categories, collections } from '@/data/categories';
import { reviews } from '@/data/reviews';
import { authHandlers } from './authHandlers';
import { contactHandlers } from './contactHandlers';
import { addressHandlers } from './addressHandlers';
import { trackingHandlers } from './trackingHandlers';
import type { ProductQueryResult, SortKey } from '@/types/product';

const API_DELAY_MS = 350;

function sortProducts(list: typeof products, sort: SortKey | null) {
  const sorted = [...list];
  switch (sort) {
    case 'price-asc':
      return sorted.sort((a, b) => a.price - b.price);
    case 'price-desc':
      return sorted.sort((a, b) => b.price - a.price);
    case 'newest':
      return sorted.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    case 'rating':
      return sorted.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
    default:
      // "featured": bestsellers first, then original catalog order
      return sorted.sort((a, b) => (b.badge === 'Bestseller' ? 1 : 0) - (a.badge === 'Bestseller' ? 1 : 0));
  }
}

export const handlers = [
  // GET /api/products?category=&minPrice=&maxPrice=&inStockOnly=&sort=&page=&pageSize=&search=
  http.get('/api/products', async ({ request }) => {
    await delay(API_DELAY_MS);
    const url = new URL(request.url);
    const category = url.searchParams.get('category');
    const minPrice = url.searchParams.get('minPrice');
    const maxPrice = url.searchParams.get('maxPrice');
    const inStockOnly = url.searchParams.get('inStockOnly') === 'true';
    const sort = url.searchParams.get('sort') as SortKey | null;
    const search = url.searchParams.get('search')?.toLowerCase().trim();
    const page = Number(url.searchParams.get('page') ?? '1');
    const pageSize = Number(url.searchParams.get('pageSize') ?? '12');

    let filtered = products;
    if (category) filtered = filtered.filter((p) => p.categorySlug === category);
    if (minPrice) filtered = filtered.filter((p) => p.price >= Number(minPrice));
    if (maxPrice) filtered = filtered.filter((p) => p.price <= Number(maxPrice));
    if (inStockOnly) filtered = filtered.filter((p) => p.inStock);
    if (search) filtered = filtered.filter((p) => p.name.toLowerCase().includes(search));

    const sorted = sortProducts(filtered, sort);
    const total = sorted.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const start = (page - 1) * pageSize;
    const items = sorted.slice(start, start + pageSize);

    const result: ProductQueryResult = { items, total, page, pageSize, totalPages };
    return HttpResponse.json(result);
  }),

  // GET /api/products/:slug
  http.get('/api/products/:slug', async ({ params }) => {
    await delay(API_DELAY_MS);
    const product = products.find((p) => p.slug === params.slug);
    if (!product) {
      return HttpResponse.json({ message: 'Product not found' }, { status: 404 });
    }
    return HttpResponse.json(product);
  }),

  // GET /api/categories
  http.get('/api/categories', async () => {
    await delay(API_DELAY_MS);
    return HttpResponse.json(categories);
  }),

  // GET /api/collections/:slug
  http.get('/api/collections/:slug', async ({ params }) => {
    await delay(API_DELAY_MS);
    const collection = collections.find((c) => c.slug === params.slug);
    if (!collection) {
      return HttpResponse.json({ message: 'Collection not found' }, { status: 404 });
    }
    return HttpResponse.json(collection);
  }),

  // GET /api/reviews?productId=
  http.get('/api/reviews', async ({ request }) => {
    await delay(API_DELAY_MS);
    const url = new URL(request.url);
    const productId = url.searchParams.get('productId');
    const filtered = productId ? reviews.filter((r) => r.productId === productId) : reviews;
    return HttpResponse.json(filtered);
  }),

  ...authHandlers,
  ...contactHandlers,
  ...addressHandlers,
  ...trackingHandlers,
];
