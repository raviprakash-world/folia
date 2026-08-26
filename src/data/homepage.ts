import type { Product } from '@/types/product';

/**
 * Placeholder content for Phase 2. Shapes here (Product, category slugs, etc.)
 * are deliberately the same shapes Phase 3's MSW handlers will return, so
 * swapping this file for a TanStack Query hook later is a drop-in change,
 * not a rewrite.
 */

export const bestSellers: Product[] = [
  { id: 'p1', slug: 'monstera-deliciosa', name: 'Monstera Deliciosa', price: 68, category: 'Plants', badge: 'Bestseller', rating: 4.8, reviewCount: 214 },
  { id: 'p2', slug: 'fiddle-leaf-fig', name: 'Fiddle Leaf Fig', price: 95, category: 'Plants', rating: 4.6, reviewCount: 168 },
  { id: 'p3', slug: 'ceramic-vessel-ash', name: 'Ceramic Vessel — Ash', price: 42, compareAtPrice: 54, category: 'Vessels', badge: 'Sale', rating: 4.9, reviewCount: 92 },
  { id: 'p4', slug: 'snake-plant-laurentii', name: 'Snake Plant Laurentii', price: 38, category: 'Plants', rating: 4.7, reviewCount: 301 },
  { id: 'p5', slug: 'woven-plant-basket', name: 'Woven Plant Basket', price: 56, category: 'Vessels', rating: 4.5, reviewCount: 74 },
  { id: 'p6', slug: 'pothos-marble-queen', name: 'Pothos Marble Queen', price: 32, category: 'Plants', badge: 'New', rating: 4.8, reviewCount: 41 },
];

export const trending: Product[] = [
  { id: 'p7', slug: 'birds-nest-fern', name: "Bird's Nest Fern", price: 44, category: 'Plants', badge: 'New', rating: 4.6, reviewCount: 28 },
  { id: 'p8', slug: 'stone-planter-round', name: 'Stone Planter — Round', price: 64, category: 'Vessels', rating: 4.7, reviewCount: 53 },
  { id: 'p9', slug: 'calathea-orbifolia', name: 'Calathea Orbifolia', price: 58, category: 'Plants', rating: 4.4, reviewCount: 89, badge: 'Low stock' },
  { id: 'p10', slug: 'brass-plant-mister', name: 'Brass Plant Mister', price: 28, category: 'Tools', rating: 4.9, reviewCount: 112 },
  { id: 'p11', slug: 'zz-plant', name: 'ZZ Plant', price: 46, category: 'Plants', rating: 4.8, reviewCount: 176 },
  { id: 'p12', slug: 'terracotta-pot-set', name: 'Terracotta Pot Set of 3', price: 36, category: 'Vessels', rating: 4.6, reviewCount: 64 },
];

export const featuredCollections = [
  { slug: 'low-light-plants', name: 'Low-light Plants', description: 'For north-facing rooms and shadier corners.' },
  { slug: 'statement-vessels', name: 'Statement Vessels', description: 'Ceramics and stoneware built to be seen.' },
  { slug: 'gifting', name: 'Gifting', description: 'Ready to arrive boxed, no assembly required.' },
];

export const benefits = [
  { title: 'Grown, not shipped from a warehouse', description: 'Every plant comes from a partner nursery, not cold storage.' },
  { title: '30-day health guarantee', description: 'Arrives unwell or dies within 30 days — we replace it, no questions.' },
  { title: 'Packed to survive transit', description: 'Custom internal bracing keeps soil and stems intact in the box.' },
];

export const testimonials = [
  { id: 't1', quote: 'The moss pole came pre-installed and the plant was bigger than the photos suggested. Rare for online plant orders.', author: 'Priya M.', location: 'Austin, TX' },
  { id: 't2', quote: "I've killed three fiddle leaf figs from big-box stores. This one came with actual care instructions for my light conditions.", author: 'Daniel K.', location: 'Portland, OR' },
  { id: 't3', quote: 'Ordered a vessel and plant together and they were sized to match — small detail, but it meant I didn\u2019t have to guess.', author: 'Amara O.', location: 'Chicago, IL' },
];

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

export const recentSearchesSeed = ['fiddle leaf fig', 'ceramic planter', 'low light'];
