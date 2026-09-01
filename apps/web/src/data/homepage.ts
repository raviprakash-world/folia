import { products } from '@/data/products';

/**
 * bestSellers/trending are now derived slices of the real catalog (src/data/products.ts)
 * rather than hand-duplicated data — one source of truth, no drift between the
 * homepage and the shop listing.
 */

export const bestSellers = products.filter((p) => p.badge === 'Bestseller').slice(0, 6);

export const trending = [...products]
  .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  .slice(0, 6);

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


