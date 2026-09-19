import { products } from '@/data/products';

/**
 * bestSellers/trending are now derived slices of the real catalog (src/data/products.ts)
 * rather than hand-duplicated data — one source of truth, no drift between the
 * homepage and the shop listing.
 */

export const bestSellers = products.filter((p) => p.badge === 'Bestseller').slice(0, 4);

export const newArrivals = [...products]
  .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  .slice(0, 8);

export const planters = products.filter((p) => p.categorySlug === 'vessels' || p.categorySlug === 'home-decor').slice(0, 8);

export const blogPreview = [
  { slug: 'winter-light-guide', title: 'A realistic guide to winter light', excerpt: 'Most plants don\u2019t die in winter from cold — they die from a light budget nobody accounted for.' },
  { slug: 'repotting-without-shock', title: 'Repotting without shocking the plant', excerpt: 'The three signs a plant is ready to move up a pot size, and the two it isn\u2019t.' },
  { slug: 'vessel-drainage-explained', title: 'Drainage holes are not optional', excerpt: 'Why a beautiful pot with no drainage is a slow-motion problem, and what to do about it.' },
];

export const megaMenuCategories = [
  {
    heading: 'Shop by type',
    links: [
      { label: 'All plants', to: '/collections/plants' },
      { label: 'Low-light plants', to: '/collections/low-light-plants' },
      { label: 'Pet-friendly', to: '/collections/pet-friendly' },
      { label: 'Flowering', to: '/collections/flowering' },
    ],
  },
  {
    heading: 'Vessels & tools',
    links: [
      { label: 'Ceramic vessels', to: '/collections/statement-vessels' },
      { label: 'Baskets', to: '/collections/baskets' },
      { label: 'Care tools', to: '/collections/tools' },
    ],
  },
  {
    heading: 'Occasion',
    links: [
      { label: 'Gifting', to: '/collections/gifting' },
      { label: 'New home', to: '/collections/new-home' },
      { label: 'Office plants', to: '/collections/office' },
    ],
  },
];


