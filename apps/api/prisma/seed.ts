/* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument */
// See src/users/users.service.ts's top-of-file comment for why this
// exemption exists — same root cause (PrismaClient typed `any`
// pre-generation), applies here too since this file also can't run until
// `prisma generate` has succeeded (see the root README's Known Issues).
import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../src/auth/password.util';

const prisma = new PrismaClient();

// A minimal, real permission set — enough to prove RBAC actually works
// end-to-end. Phase 9's admin RBAC work extends this list; extending it
// later is new rows, not a schema change.
const PERMISSIONS = [
  { key: 'orders:read', description: 'View own orders' },
  { key: 'orders:write', description: 'Create/modify orders' },
  { key: 'products:read', description: 'View products' },
  { key: 'products:write', description: 'Create/edit/delete products' },
  { key: 'customers:read', description: 'View customer accounts' },
  { key: 'customers:write', description: 'Edit customer accounts' },
  { key: 'analytics:read', description: 'View the admin analytics dashboard' },
];

const CUSTOMER_PERMISSIONS = ['orders:read', 'products:read'];
const ADMIN_PERMISSIONS = PERMISSIONS.map((p) => p.key); // admins get everything

// Categories and collections, matching apps/web/src/data/categories.ts exactly.
const CATEGORIES = [
  {
    slug: 'plants',
    name: 'Plants',
    description: 'Living plants, shipped established in their nursery pot.',
  },
  {
    slug: 'vessels',
    name: 'Vessels',
    description: 'Pots, planters, and baskets sized to match.',
  },
  {
    slug: 'tools',
    name: 'Tools',
    description: 'The unglamorous things that keep plants alive.',
  },
];

const COLLECTIONS = [
  {
    slug: 'low-light-plants',
    name: 'Low-light Plants',
    description: 'For north-facing rooms and shadier corners.',
  },
  {
    slug: 'statement-vessels',
    name: 'Statement Vessels',
    description: 'Ceramics and stoneware built to be seen.',
  },
  {
    slug: 'gifting',
    name: 'Gifting',
    description: 'Ready to arrive boxed, no assembly required.',
  },
  {
    slug: 'pet-friendly',
    name: 'Pet-friendly',
    description: 'Non-toxic picks, verified against the ASPCA list.',
  },
  {
    slug: 'flowering',
    name: 'Flowering',
    description: 'Plants that bloom indoors, not just green ones.',
  },
  {
    slug: 'baskets',
    name: 'Baskets',
    description: 'Woven vessels for a softer look.',
  },
  {
    slug: 'new-home',
    name: 'New Home',
    description: 'Easy-care starter plants for a fresh space.',
  },
  {
    slug: 'office',
    name: 'Office Plants',
    description: 'Tolerant of fluorescent light and Monday neglect.',
  },
];

interface SeedProductInput {
  id: string;
  slug: string;
  name: string;
  price: number;
  compareAtPrice?: number;
  description: string;
  categorySlug: string;
  badge?: string;
  careLevel?: string;
  rating?: number;
  reviewCount: number;
  inStock: boolean;
  stockCount: number;
  createdAt: string;
  variants: { label: string; swatch: string | null; inStock: boolean }[];
  specs: { label: string; value: string }[];
}

interface SeedReviewInput {
  productId: string;
  author: string;
  rating: number;
  title: string;
  body: string;
  date: string;
  verified: boolean;
}

// The 24 products and 72 reviews below are transcribed programmatically
// from apps/web's real catalog (src/data/products.ts, src/data/reviews.ts)
// via a one-off parsing script, not hand-typed — the frontend's actual
// mock catalog IS the seed data, kept in sync at generation time rather
// than risking manual transcription drift. createdAt values are preserved
// exactly from the source data, which matters: ProductsService's
// "featured" sort tiebreaker relies on createdAt reflecting the original
// catalog's relative order (see products.service.ts's buildOrderBy comment).

const PRODUCTS: SeedProductInput[] = [
  {
    id: 'p1',
    slug: 'monstera-deliciosa',
    name: 'Monstera Deliciosa',
    price: 68,
    description:
      'Monstera Deliciosa brings Cheese plant, iconic split leaves to a room without asking much in return. We ship it established in its nursery pot, roots settled, ready to move into your own vessel or stay put.',
    categorySlug: 'plants',
    badge: 'BESTSELLER',
    careLevel: 'EASY',
    rating: 4.4,
    reviewCount: 18,
    inStock: true,
    stockCount: 10,
    createdAt: '2026-07-29',
    variants: [
      { label: 'Small (4in pot)', swatch: null, inStock: true },
      { label: 'Medium (6in pot)', swatch: null, inStock: true },
      { label: 'Large (10in pot)', swatch: null, inStock: false },
    ],
    specs: [
      { label: 'Light', value: 'Bright indirect' },
      { label: 'Water', value: 'Weekly' },
      { label: 'Pet safe', value: 'Yes' },
      { label: 'Mature height', value: '36in' },
    ],
  },
  {
    id: 'p2',
    slug: 'fiddle-leaf-fig',
    name: 'Fiddle Leaf Fig',
    price: 95,
    description:
      'Fiddle Leaf Fig brings dramatic violin-shaped leaves, fussy about drafts to a room without asking much in return. We ship it established in its nursery pot, roots settled, ready to move into your own vessel or stay put.',
    categorySlug: 'plants',
    careLevel: 'ADVANCED',
    rating: 4.5,
    reviewCount: 31,
    inStock: true,
    stockCount: 13,
    createdAt: '2026-07-20',
    variants: [
      { label: 'Small (4in pot)', swatch: null, inStock: true },
      { label: 'Medium (6in pot)', swatch: null, inStock: true },
      { label: 'Large (10in pot)', swatch: null, inStock: true },
    ],
    specs: [
      { label: 'Light', value: 'Bright indirect' },
      { label: 'Water', value: 'Weekly' },
      { label: 'Pet safe', value: 'No — toxic if ingested' },
      { label: 'Mature height', value: '18in' },
    ],
  },
  {
    id: 'p3',
    slug: 'snake-plant-laurentii',
    name: 'Snake Plant Laurentii',
    price: 38,
    description:
      'Snake Plant Laurentii brings upright striped leaves, tolerates neglect to a room without asking much in return. We ship it established in its nursery pot, roots settled, ready to move into your own vessel or stay put.',
    categorySlug: 'plants',
    badge: 'NEW',
    careLevel: 'EASY',
    rating: 4.3,
    reviewCount: 44,
    inStock: true,
    stockCount: 16,
    createdAt: '2026-07-11',
    variants: [
      { label: 'Small (4in pot)', swatch: null, inStock: true },
      { label: 'Medium (6in pot)', swatch: null, inStock: true },
      { label: 'Large (10in pot)', swatch: null, inStock: true },
    ],
    specs: [
      { label: 'Light', value: 'Bright indirect' },
      { label: 'Water', value: 'Weekly' },
      { label: 'Pet safe', value: 'No — toxic if ingested' },
      { label: 'Mature height', value: '24in' },
    ],
  },
  {
    id: 'p4',
    slug: 'pothos-marble-queen',
    name: 'Pothos Marble Queen',
    price: 32,
    description:
      'Pothos Marble Queen brings trailing variegated vine, grows in low light to a room without asking much in return. We ship it established in its nursery pot, roots settled, ready to move into your own vessel or stay put.',
    categorySlug: 'plants',
    careLevel: 'EASY',
    rating: 4,
    reviewCount: 57,
    inStock: true,
    stockCount: 19,
    createdAt: '2026-07-02',
    variants: [
      { label: 'Small (4in pot)', swatch: null, inStock: true },
      { label: 'Medium (6in pot)', swatch: null, inStock: true },
      { label: 'Large (10in pot)', swatch: null, inStock: false },
    ],
    specs: [
      { label: 'Light', value: 'Medium indirect' },
      { label: 'Water', value: 'Every 10–14 days' },
      { label: 'Pet safe', value: 'No — toxic if ingested' },
      { label: 'Mature height', value: '42in' },
    ],
  },
  {
    id: 'p5',
    slug: 'bird-s-nest-fern',
    name: "Bird's Nest Fern",
    price: 44,
    compareAtPrice: 55,
    description:
      "Bird's Nest Fern brings ruffled fronds, likes humidity to a room without asking much in return. We ship it established in its nursery pot, roots settled, ready to move into your own vessel or stay put.",
    categorySlug: 'plants',
    badge: 'SALE',
    careLevel: 'MODERATE',
    rating: 4.1,
    reviewCount: 70,
    inStock: true,
    stockCount: 22,
    createdAt: '2026-06-23',
    variants: [
      { label: 'Small (4in pot)', swatch: null, inStock: true },
      { label: 'Medium (6in pot)', swatch: null, inStock: true },
      { label: 'Large (10in pot)', swatch: null, inStock: true },
    ],
    specs: [
      { label: 'Light', value: 'Medium indirect' },
      { label: 'Water', value: 'Every 10–14 days' },
      { label: 'Pet safe', value: 'Yes' },
      { label: 'Mature height', value: '24in' },
    ],
  },
  {
    id: 'p6',
    slug: 'calathea-orbifolia',
    name: 'Calathea Orbifolia',
    price: 58,
    description:
      'Calathea Orbifolia brings striped round leaves, prayer-plant family to a room without asking much in return. We ship it established in its nursery pot, roots settled, ready to move into your own vessel or stay put.',
    categorySlug: 'plants',
    badge: 'LOW_STOCK',
    careLevel: 'MODERATE',
    rating: 4.4,
    reviewCount: 83,
    inStock: true,
    stockCount: 2,
    createdAt: '2026-06-14',
    variants: [
      { label: 'Small (4in pot)', swatch: null, inStock: true },
      { label: 'Medium (6in pot)', swatch: null, inStock: true },
      { label: 'Large (10in pot)', swatch: null, inStock: true },
    ],
    specs: [
      { label: 'Light', value: 'Bright indirect' },
      { label: 'Water', value: 'Weekly' },
      { label: 'Pet safe', value: 'Yes' },
      { label: 'Mature height', value: '36in' },
    ],
  },
  {
    id: 'p7',
    slug: 'zz-plant',
    name: 'ZZ Plant',
    price: 46,
    description:
      'ZZ Plant brings glossy dark leaves, drought tolerant to a room without asking much in return. We ship it established in its nursery pot, roots settled, ready to move into your own vessel or stay put.',
    categorySlug: 'plants',
    badge: 'BESTSELLER',
    careLevel: 'EASY',
    rating: 4,
    reviewCount: 96,
    inStock: true,
    stockCount: 28,
    createdAt: '2026-06-05',
    variants: [
      { label: 'Small (4in pot)', swatch: null, inStock: true },
      { label: 'Medium (6in pot)', swatch: null, inStock: true },
      { label: 'Large (10in pot)', swatch: null, inStock: false },
    ],
    specs: [
      { label: 'Light', value: 'Low light tolerant' },
      { label: 'Water', value: 'When top 2in dry' },
      { label: 'Pet safe', value: 'Yes' },
      { label: 'Mature height', value: '36in' },
    ],
  },
  {
    id: 'p8',
    slug: 'rubber-plant-burgundy',
    name: 'Rubber Plant Burgundy',
    price: 62,
    description:
      'Rubber Plant Burgundy brings deep maroon leaves, fast growing to a room without asking much in return. We ship it established in its nursery pot, roots settled, ready to move into your own vessel or stay put.',
    categorySlug: 'plants',
    careLevel: 'EASY',
    rating: 4.3,
    reviewCount: 109,
    inStock: true,
    stockCount: 31,
    createdAt: '2026-05-27',
    variants: [
      { label: 'Small (4in pot)', swatch: null, inStock: true },
      { label: 'Medium (6in pot)', swatch: null, inStock: true },
      { label: 'Large (10in pot)', swatch: null, inStock: true },
    ],
    specs: [
      { label: 'Light', value: 'Bright indirect' },
      { label: 'Water', value: 'Weekly' },
      { label: 'Pet safe', value: 'No — toxic if ingested' },
      { label: 'Mature height', value: '24in' },
    ],
  },
  {
    id: 'p9',
    slug: 'string-of-pearls',
    name: 'String of Pearls',
    price: 26,
    description:
      'String of Pearls brings trailing bead-like leaves, needs bright light to a room without asking much in return. We ship it established in its nursery pot, roots settled, ready to move into your own vessel or stay put.',
    categorySlug: 'plants',
    badge: 'NEW',
    careLevel: 'MODERATE',
    rating: 4.1,
    reviewCount: 122,
    inStock: true,
    stockCount: 34,
    createdAt: '2026-05-18',
    variants: [
      { label: 'Small (4in pot)', swatch: null, inStock: true },
      { label: 'Medium (6in pot)', swatch: null, inStock: true },
      { label: 'Large (10in pot)', swatch: null, inStock: true },
    ],
    specs: [
      { label: 'Light', value: 'Medium indirect' },
      { label: 'Water', value: 'Every 10–14 days' },
      { label: 'Pet safe', value: 'Yes' },
      { label: 'Mature height', value: '24in' },
    ],
  },
  {
    id: 'p10',
    slug: 'peace-lily',
    name: 'Peace Lily',
    price: 34,
    description:
      'Peace Lily brings white blooms, signals thirst by drooping to a room without asking much in return. We ship it established in its nursery pot, roots settled, ready to move into your own vessel or stay put.',
    categorySlug: 'plants',
    careLevel: 'EASY',
    rating: 4.3,
    reviewCount: 135,
    inStock: true,
    stockCount: 37,
    createdAt: '2026-05-09',
    variants: [
      { label: 'Small (4in pot)', swatch: null, inStock: true },
      { label: 'Medium (6in pot)', swatch: null, inStock: true },
      { label: 'Large (10in pot)', swatch: null, inStock: false },
    ],
    specs: [
      { label: 'Light', value: 'Medium indirect' },
      { label: 'Water', value: 'Every 10–14 days' },
      { label: 'Pet safe', value: 'Yes' },
      { label: 'Mature height', value: '18in' },
    ],
  },
  {
    id: 'p11',
    slug: 'boston-fern',
    name: 'Boston Fern',
    price: 29,
    compareAtPrice: 36,
    description:
      'Boston Fern brings classic feathery fronds, humidity lover to a room without asking much in return. We ship it established in its nursery pot, roots settled, ready to move into your own vessel or stay put.',
    categorySlug: 'plants',
    badge: 'SALE',
    careLevel: 'MODERATE',
    rating: 3.9,
    reviewCount: 148,
    inStock: true,
    stockCount: 40,
    createdAt: '2026-04-30',
    variants: [
      { label: 'Small (4in pot)', swatch: null, inStock: true },
      { label: 'Medium (6in pot)', swatch: null, inStock: true },
      { label: 'Large (10in pot)', swatch: null, inStock: true },
    ],
    specs: [
      { label: 'Light', value: 'Low light tolerant' },
      { label: 'Water', value: 'When top 2in dry' },
      { label: 'Pet safe', value: 'No — toxic if ingested' },
      { label: 'Mature height', value: '24in' },
    ],
  },
  {
    id: 'p12',
    slug: 'areca-palm',
    name: 'Areca Palm',
    price: 88,
    description:
      'Areca Palm brings airy fronds, good for filtering air to a room without asking much in return. We ship it established in its nursery pot, roots settled, ready to move into your own vessel or stay put.',
    categorySlug: 'plants',
    badge: 'LOW_STOCK',
    careLevel: 'EASY',
    rating: 4.3,
    reviewCount: 161,
    inStock: true,
    stockCount: 2,
    createdAt: '2026-04-21',
    variants: [
      { label: 'Small (4in pot)', swatch: null, inStock: true },
      { label: 'Medium (6in pot)', swatch: null, inStock: true },
      { label: 'Large (10in pot)', swatch: null, inStock: true },
    ],
    specs: [
      { label: 'Light', value: 'Medium indirect' },
      { label: 'Water', value: 'Every 10–14 days' },
      { label: 'Pet safe', value: 'Yes' },
      { label: 'Mature height', value: '18in' },
    ],
  },
  {
    id: 'p13',
    slug: 'ceramic-vessel-ash',
    name: 'Ceramic Vessel — Ash',
    price: 42,
    description:
      'Ceramic Vessel — Ash is made for plants that outgrew their nursery pot. Features hand-glazed stoneware, drainage hole + saucer, sized to work with our most popular plant varieties.',
    categorySlug: 'vessels',
    badge: 'BESTSELLER',
    rating: 4.7,
    reviewCount: 18,
    inStock: true,
    stockCount: 10,
    createdAt: '2026-07-29',
    variants: [
      { label: 'Ash', swatch: '#8b8378', inStock: true },
      { label: 'Slate', swatch: '#4a5a5f', inStock: true },
      { label: 'Sand', swatch: '#d9c9a8', inStock: false },
    ],
    specs: [
      { label: 'Material', value: 'Glazed ceramic' },
      { label: 'Drainage', value: 'Yes, includes saucer' },
      { label: 'Diameter', value: '8in' },
    ],
  },
  {
    id: 'p14',
    slug: 'stone-planter-round',
    name: 'Stone Planter — Round',
    price: 64,
    description:
      'Stone Planter — Round is made for plants that outgrew their nursery pot. Features cast concrete finish, weatherproof for patios, sized to work with our most popular plant varieties.',
    categorySlug: 'vessels',
    rating: 4.3,
    reviewCount: 31,
    inStock: true,
    stockCount: 13,
    createdAt: '2026-07-20',
    variants: [
      { label: 'Ash', swatch: '#8b8378', inStock: true },
      { label: 'Slate', swatch: '#4a5a5f', inStock: true },
      { label: 'Sand', swatch: '#d9c9a8', inStock: true },
    ],
    specs: [
      { label: 'Material', value: 'Cast concrete' },
      { label: 'Drainage', value: 'Yes, includes saucer' },
      { label: 'Diameter', value: '9in' },
    ],
  },
  {
    id: 'p15',
    slug: 'terracotta-pot-set-of-3',
    name: 'Terracotta Pot Set of 3',
    price: 36,
    description:
      'Terracotta Pot Set of 3 is made for plants that outgrew their nursery pot. Features unglazed clay, breathable for root health, sized to work with our most popular plant varieties.',
    categorySlug: 'vessels',
    badge: 'NEW',
    rating: 4.6,
    reviewCount: 44,
    inStock: true,
    stockCount: 16,
    createdAt: '2026-07-11',
    variants: [
      { label: 'Ash', swatch: '#8b8378', inStock: true },
      { label: 'Slate', swatch: '#4a5a5f', inStock: true },
      { label: 'Sand', swatch: '#d9c9a8', inStock: true },
    ],
    specs: [
      { label: 'Material', value: 'Unglazed clay' },
      { label: 'Drainage', value: 'Yes, includes saucer' },
      { label: 'Diameter', value: '11in' },
    ],
  },
  {
    id: 'p16',
    slug: 'woven-plant-basket',
    name: 'Woven Plant Basket',
    price: 56,
    description:
      'Woven Plant Basket is made for plants that outgrew their nursery pot. Features natural seagrass weave, fits standard nursery pots, sized to work with our most popular plant varieties.',
    categorySlug: 'vessels',
    rating: 4.4,
    reviewCount: 57,
    inStock: true,
    stockCount: 19,
    createdAt: '2026-07-02',
    variants: [
      { label: 'Ash', swatch: '#8b8378', inStock: true },
      { label: 'Slate', swatch: '#4a5a5f', inStock: true },
      { label: 'Sand', swatch: '#d9c9a8', inStock: true },
    ],
    specs: [
      { label: 'Material', value: 'Glazed ceramic' },
      { label: 'Drainage', value: 'Yes, includes saucer' },
      { label: 'Diameter', value: '6in' },
    ],
  },
  {
    id: 'p17',
    slug: 'matte-black-cylinder-pot',
    name: 'Matte Black Cylinder Pot',
    price: 48,
    compareAtPrice: 60,
    description:
      'Matte Black Cylinder Pot is made for plants that outgrew their nursery pot. Features powder-coated steel, modern minimalist profile, sized to work with our most popular plant varieties.',
    categorySlug: 'vessels',
    badge: 'SALE',
    rating: 4.2,
    reviewCount: 70,
    inStock: true,
    stockCount: 22,
    createdAt: '2026-06-23',
    variants: [
      { label: 'Ash', swatch: '#8b8378', inStock: true },
      { label: 'Slate', swatch: '#4a5a5f', inStock: true },
      { label: 'Sand', swatch: '#d9c9a8', inStock: false },
    ],
    specs: [
      { label: 'Material', value: 'Glazed ceramic' },
      { label: 'Drainage', value: 'Yes, includes saucer' },
      { label: 'Diameter', value: '6in' },
    ],
  },
  {
    id: 'p18',
    slug: 'fluted-ceramic-planter',
    name: 'Fluted Ceramic Planter',
    price: 52,
    description:
      'Fluted Ceramic Planter is made for plants that outgrew their nursery pot. Features ridged texture, available in three sizes, sized to work with our most popular plant varieties.',
    categorySlug: 'vessels',
    badge: 'LOW_STOCK',
    rating: 3.9,
    reviewCount: 83,
    inStock: true,
    stockCount: 2,
    createdAt: '2026-06-14',
    variants: [
      { label: 'Ash', swatch: '#8b8378', inStock: true },
      { label: 'Slate', swatch: '#4a5a5f', inStock: true },
      { label: 'Sand', swatch: '#d9c9a8', inStock: true },
    ],
    specs: [
      { label: 'Material', value: 'Glazed ceramic' },
      { label: 'Drainage', value: 'Yes, includes saucer' },
      { label: 'Diameter', value: '10in' },
    ],
  },
  {
    id: 'p19',
    slug: 'brass-plant-mister',
    name: 'Brass Plant Mister',
    price: 28,
    description:
      'Brass Plant Mister: fine mist nozzle, solid brass, ages naturally. Built to last a few plant-parenting eras, not one season.',
    categorySlug: 'tools',
    badge: 'BESTSELLER',
    rating: 4.4,
    reviewCount: 18,
    inStock: true,
    stockCount: 10,
    createdAt: '2026-07-29',
    variants: [],
    specs: [
      { label: 'Material', value: 'Solid brass / carbon steel' },
      { label: 'Care', value: 'Hand wash, dry before storing' },
    ],
  },
  {
    id: 'p20',
    slug: 'precision-pruning-shears',
    name: 'Precision Pruning Shears',
    price: 24,
    description:
      'Precision Pruning Shears: carbon steel blade, for clean cuts that heal fast. Built to last a few plant-parenting eras, not one season.',
    categorySlug: 'tools',
    rating: 4.2,
    reviewCount: 31,
    inStock: true,
    stockCount: 13,
    createdAt: '2026-07-20',
    variants: [],
    specs: [
      { label: 'Material', value: 'Solid brass / carbon steel' },
      { label: 'Care', value: 'Hand wash, dry before storing' },
    ],
  },
  {
    id: 'p21',
    slug: 'soil-moisture-meter',
    name: 'Soil Moisture Meter',
    price: 18,
    description:
      'Soil Moisture Meter: no batteries required, reads 3 depths. Built to last a few plant-parenting eras, not one season.',
    categorySlug: 'tools',
    badge: 'NEW',
    rating: 4,
    reviewCount: 44,
    inStock: true,
    stockCount: 16,
    createdAt: '2026-07-11',
    variants: [],
    specs: [
      { label: 'Material', value: 'Solid brass / carbon steel' },
      { label: 'Care', value: 'Hand wash, dry before storing' },
    ],
  },
  {
    id: 'p22',
    slug: 'watering-can-1-5l',
    name: 'Watering Can — 1.5L',
    price: 32,
    description:
      'Watering Can — 1.5L: long spout for tight spaces, powder-coated finish. Built to last a few plant-parenting eras, not one season.',
    categorySlug: 'tools',
    rating: 4,
    reviewCount: 57,
    inStock: true,
    stockCount: 19,
    createdAt: '2026-07-02',
    variants: [],
    specs: [
      { label: 'Material', value: 'Solid brass / carbon steel' },
      { label: 'Care', value: 'Hand wash, dry before storing' },
    ],
  },
  {
    id: 'p23',
    slug: 'bamboo-plant-stakes-set-of-6',
    name: 'Bamboo Plant Stakes (Set of 6)',
    price: 14,
    compareAtPrice: 18,
    description:
      'Bamboo Plant Stakes (Set of 6): for climbing and top-heavy stems. Built to last a few plant-parenting eras, not one season.',
    categorySlug: 'tools',
    badge: 'SALE',
    rating: 4,
    reviewCount: 70,
    inStock: true,
    stockCount: 22,
    createdAt: '2026-06-23',
    variants: [],
    specs: [
      { label: 'Material', value: 'Solid brass / carbon steel' },
      { label: 'Care', value: 'Hand wash, dry before storing' },
    ],
  },
  {
    id: 'p24',
    slug: 'grow-light-full-spectrum',
    name: 'Grow Light — Full Spectrum',
    price: 74,
    description:
      'Grow Light — Full Spectrum: clips onto shelving, timer built in. Built to last a few plant-parenting eras, not one season.',
    categorySlug: 'tools',
    badge: 'LOW_STOCK',
    rating: 4.5,
    reviewCount: 83,
    inStock: true,
    stockCount: 2,
    createdAt: '2026-06-14',
    variants: [],
    specs: [
      { label: 'Material', value: 'Solid brass / carbon steel' },
      { label: 'Care', value: 'Hand wash, dry before storing' },
    ],
  },
];
const REVIEWS: SeedReviewInput[] = [
  {
    productId: 'p1',
    author: 'Priya M.',
    rating: 5,
    title: 'Exceeded expectations',
    body: 'Arrived healthy and bigger than I expected. No shock, no drooping — settled in within a week.',
    date: '2026-07-27',
    verified: false,
  },
  {
    productId: 'p1',
    author: 'Daniel K.',
    rating: 5,
    title: 'Exactly as described',
    body: 'Packaging was impressive, nothing shifted in transit. Been thriving on my windowsill since.',
    date: '2026-07-16',
    verified: true,
  },
  {
    productId: 'p2',
    author: 'Daniel K.',
    rating: 4,
    title: 'Good, minor issue',
    body: 'One small leaf had a nick from shipping but otherwise in great shape. Would still recommend.',
    date: '2026-07-23',
    verified: true,
  },
  {
    productId: 'p2',
    author: 'Amara O.',
    rating: 5,
    title: 'Exactly as described',
    body: 'Packaging was impressive, nothing shifted in transit. Been thriving on my windowsill since.',
    date: '2026-07-12',
    verified: true,
  },
  {
    productId: 'p2',
    author: 'Wei L.',
    rating: 5,
    title: 'Would buy again',
    body: 'Arrived healthy and bigger than I expected. No shock, no drooping — settled in within a week.',
    date: '2026-07-01',
    verified: true,
  },
  {
    productId: 'p3',
    author: 'Amara O.',
    rating: 5,
    title: 'Exceeded expectations',
    body: 'Arrived healthy and bigger than I expected. No shock, no drooping — settled in within a week.',
    date: '2026-07-19',
    verified: true,
  },
  {
    productId: 'p3',
    author: 'Wei L.',
    rating: 4,
    title: 'Solid pick',
    body: 'Good quality, just took a little longer to arrive than the estimate suggested.',
    date: '2026-07-08',
    verified: true,
  },
  {
    productId: 'p3',
    author: 'Sofia R.',
    rating: 5,
    title: 'Would buy again',
    body: 'Arrived healthy and bigger than I expected. No shock, no drooping — settled in within a week.',
    date: '2026-06-27',
    verified: false,
  },
  {
    productId: 'p3',
    author: 'Marcus T.',
    rating: 5,
    title: 'Arrived in great shape',
    body: 'Packaging was impressive, nothing shifted in transit. Been thriving on my windowsill since.',
    date: '2026-06-16',
    verified: true,
  },
  {
    productId: 'p4',
    author: 'Wei L.',
    rating: 5,
    title: 'Exceeded expectations',
    body: 'Arrived healthy and bigger than I expected. No shock, no drooping — settled in within a week.',
    date: '2026-07-15',
    verified: true,
  },
  {
    productId: 'p4',
    author: 'Sofia R.',
    rating: 5,
    title: 'Exactly as described',
    body: 'Packaging was impressive, nothing shifted in transit. Been thriving on my windowsill since.',
    date: '2026-07-04',
    verified: false,
  },
  {
    productId: 'p5',
    author: 'Sofia R.',
    rating: 4,
    title: 'Good, minor issue',
    body: 'One small leaf had a nick from shipping but otherwise in great shape. Would still recommend.',
    date: '2026-07-11',
    verified: false,
  },
  {
    productId: 'p5',
    author: 'Marcus T.',
    rating: 5,
    title: 'Exactly as described',
    body: 'Packaging was impressive, nothing shifted in transit. Been thriving on my windowsill since.',
    date: '2026-06-30',
    verified: true,
  },
  {
    productId: 'p5',
    author: 'Ingrid B.',
    rating: 5,
    title: 'Would buy again',
    body: 'Arrived healthy and bigger than I expected. No shock, no drooping — settled in within a week.',
    date: '2026-06-19',
    verified: true,
  },
  {
    productId: 'p6',
    author: 'Marcus T.',
    rating: 5,
    title: 'Exceeded expectations',
    body: 'Arrived healthy and bigger than I expected. No shock, no drooping — settled in within a week.',
    date: '2026-07-07',
    verified: true,
  },
  {
    productId: 'p6',
    author: 'Ingrid B.',
    rating: 4,
    title: 'Solid pick',
    body: 'Good quality, just took a little longer to arrive than the estimate suggested.',
    date: '2026-06-26',
    verified: true,
  },
  {
    productId: 'p6',
    author: 'Tomas V.',
    rating: 5,
    title: 'Would buy again',
    body: 'Arrived healthy and bigger than I expected. No shock, no drooping — settled in within a week.',
    date: '2026-06-15',
    verified: true,
  },
  {
    productId: 'p6',
    author: 'Nadia F.',
    rating: 5,
    title: 'Arrived in great shape',
    body: 'Packaging was impressive, nothing shifted in transit. Been thriving on my windowsill since.',
    date: '2026-06-04',
    verified: false,
  },
  {
    productId: 'p7',
    author: 'Ingrid B.',
    rating: 5,
    title: 'Exceeded expectations',
    body: 'Arrived healthy and bigger than I expected. No shock, no drooping — settled in within a week.',
    date: '2026-07-03',
    verified: true,
  },
  {
    productId: 'p7',
    author: 'Tomas V.',
    rating: 5,
    title: 'Exactly as described',
    body: 'Packaging was impressive, nothing shifted in transit. Been thriving on my windowsill since.',
    date: '2026-06-22',
    verified: true,
  },
  {
    productId: 'p8',
    author: 'Tomas V.',
    rating: 3,
    title: 'It’s fine',
    body: 'It’s okay — smaller than the photos implied but healthy enough.',
    date: '2026-06-29',
    verified: true,
  },
  {
    productId: 'p8',
    author: 'Nadia F.',
    rating: 5,
    title: 'Exactly as described',
    body: 'Packaging was impressive, nothing shifted in transit. Been thriving on my windowsill since.',
    date: '2026-06-18',
    verified: false,
  },
  {
    productId: 'p8',
    author: 'Owen P.',
    rating: 5,
    title: 'Would buy again',
    body: 'Arrived healthy and bigger than I expected. No shock, no drooping — settled in within a week.',
    date: '2026-06-07',
    verified: true,
  },
  {
    productId: 'p9',
    author: 'Nadia F.',
    rating: 4,
    title: 'Good, minor issue',
    body: 'One small leaf had a nick from shipping but otherwise in great shape. Would still recommend.',
    date: '2026-06-25',
    verified: false,
  },
  {
    productId: 'p9',
    author: 'Owen P.',
    rating: 3,
    title: 'Does the job',
    body: 'Fine overall, care instructions could have been more specific to my climate.',
    date: '2026-06-14',
    verified: true,
  },
  {
    productId: 'p9',
    author: 'Priya M.',
    rating: 5,
    title: 'Would buy again',
    body: 'Arrived healthy and bigger than I expected. No shock, no drooping — settled in within a week.',
    date: '2026-06-03',
    verified: true,
  },
  {
    productId: 'p9',
    author: 'Daniel K.',
    rating: 5,
    title: 'Arrived in great shape',
    body: 'Packaging was impressive, nothing shifted in transit. Been thriving on my windowsill since.',
    date: '2026-05-23',
    verified: true,
  },
  {
    productId: 'p10',
    author: 'Owen P.',
    rating: 5,
    title: 'Exceeded expectations',
    body: 'Arrived healthy and bigger than I expected. No shock, no drooping — settled in within a week.',
    date: '2026-06-21',
    verified: true,
  },
  {
    productId: 'p10',
    author: 'Priya M.',
    rating: 4,
    title: 'Solid pick',
    body: 'Good quality, just took a little longer to arrive than the estimate suggested.',
    date: '2026-06-10',
    verified: true,
  },
  {
    productId: 'p11',
    author: 'Priya M.',
    rating: 5,
    title: 'Exceeded expectations',
    body: 'Arrived healthy and bigger than I expected. No shock, no drooping — settled in within a week.',
    date: '2026-06-17',
    verified: true,
  },
  {
    productId: 'p11',
    author: 'Daniel K.',
    rating: 5,
    title: 'Exactly as described',
    body: 'Packaging was impressive, nothing shifted in transit. Been thriving on my windowsill since.',
    date: '2026-06-06',
    verified: true,
  },
  {
    productId: 'p11',
    author: 'Amara O.',
    rating: 4,
    title: 'Happy with it',
    body: 'One small leaf had a nick from shipping but otherwise in great shape. Would still recommend.',
    date: '2026-05-26',
    verified: false,
  },
  {
    productId: 'p12',
    author: 'Daniel K.',
    rating: 4,
    title: 'Good, minor issue',
    body: 'One small leaf had a nick from shipping but otherwise in great shape. Would still recommend.',
    date: '2026-06-13',
    verified: true,
  },
  {
    productId: 'p12',
    author: 'Amara O.',
    rating: 5,
    title: 'Exactly as described',
    body: 'Packaging was impressive, nothing shifted in transit. Been thriving on my windowsill since.',
    date: '2026-06-02',
    verified: false,
  },
  {
    productId: 'p12',
    author: 'Wei L.',
    rating: 5,
    title: 'Would buy again',
    body: 'Arrived healthy and bigger than I expected. No shock, no drooping — settled in within a week.',
    date: '2026-05-22',
    verified: true,
  },
  {
    productId: 'p12',
    author: 'Sofia R.',
    rating: 4,
    title: 'Good, minor issue',
    body: 'Good quality, just took a little longer to arrive than the estimate suggested.',
    date: '2026-05-11',
    verified: true,
  },
  {
    productId: 'p13',
    author: 'Amara O.',
    rating: 5,
    title: 'Exceeded expectations',
    body: 'Arrived healthy and bigger than I expected. No shock, no drooping — settled in within a week.',
    date: '2026-06-09',
    verified: false,
  },
  {
    productId: 'p13',
    author: 'Wei L.',
    rating: 4,
    title: 'Solid pick',
    body: 'Good quality, just took a little longer to arrive than the estimate suggested.',
    date: '2026-05-29',
    verified: true,
  },
  {
    productId: 'p14',
    author: 'Wei L.',
    rating: 5,
    title: 'Exceeded expectations',
    body: 'Arrived healthy and bigger than I expected. No shock, no drooping — settled in within a week.',
    date: '2026-06-05',
    verified: true,
  },
  {
    productId: 'p14',
    author: 'Sofia R.',
    rating: 5,
    title: 'Exactly as described',
    body: 'Packaging was impressive, nothing shifted in transit. Been thriving on my windowsill since.',
    date: '2026-05-25',
    verified: true,
  },
  {
    productId: 'p14',
    author: 'Marcus T.',
    rating: 4,
    title: 'Happy with it',
    body: 'One small leaf had a nick from shipping but otherwise in great shape. Would still recommend.',
    date: '2026-05-14',
    verified: true,
  },
  {
    productId: 'p15',
    author: 'Sofia R.',
    rating: 4,
    title: 'Good, minor issue',
    body: 'One small leaf had a nick from shipping but otherwise in great shape. Would still recommend.',
    date: '2026-06-01',
    verified: true,
  },
  {
    productId: 'p15',
    author: 'Marcus T.',
    rating: 5,
    title: 'Exactly as described',
    body: 'Packaging was impressive, nothing shifted in transit. Been thriving on my windowsill since.',
    date: '2026-05-21',
    verified: true,
  },
  {
    productId: 'p15',
    author: 'Ingrid B.',
    rating: 5,
    title: 'Would buy again',
    body: 'Arrived healthy and bigger than I expected. No shock, no drooping — settled in within a week.',
    date: '2026-05-10',
    verified: false,
  },
  {
    productId: 'p15',
    author: 'Tomas V.',
    rating: 4,
    title: 'Good, minor issue',
    body: 'Good quality, just took a little longer to arrive than the estimate suggested.',
    date: '2026-04-29',
    verified: true,
  },
  {
    productId: 'p16',
    author: 'Marcus T.',
    rating: 5,
    title: 'Exceeded expectations',
    body: 'Arrived healthy and bigger than I expected. No shock, no drooping — settled in within a week.',
    date: '2026-05-28',
    verified: true,
  },
  {
    productId: 'p16',
    author: 'Ingrid B.',
    rating: 4,
    title: 'Solid pick',
    body: 'Good quality, just took a little longer to arrive than the estimate suggested.',
    date: '2026-05-17',
    verified: false,
  },
  {
    productId: 'p17',
    author: 'Ingrid B.',
    rating: 5,
    title: 'Exceeded expectations',
    body: 'Arrived healthy and bigger than I expected. No shock, no drooping — settled in within a week.',
    date: '2026-05-24',
    verified: false,
  },
  {
    productId: 'p17',
    author: 'Tomas V.',
    rating: 5,
    title: 'Exactly as described',
    body: 'Packaging was impressive, nothing shifted in transit. Been thriving on my windowsill since.',
    date: '2026-05-13',
    verified: true,
  },
  {
    productId: 'p17',
    author: 'Nadia F.',
    rating: 4,
    title: 'Happy with it',
    body: 'One small leaf had a nick from shipping but otherwise in great shape. Would still recommend.',
    date: '2026-05-02',
    verified: true,
  },
  {
    productId: 'p18',
    author: 'Tomas V.',
    rating: 3,
    title: 'It’s fine',
    body: 'It’s okay — smaller than the photos implied but healthy enough.',
    date: '2026-05-20',
    verified: true,
  },
  {
    productId: 'p18',
    author: 'Nadia F.',
    rating: 5,
    title: 'Exactly as described',
    body: 'Packaging was impressive, nothing shifted in transit. Been thriving on my windowsill since.',
    date: '2026-05-09',
    verified: true,
  },
  {
    productId: 'p18',
    author: 'Owen P.',
    rating: 5,
    title: 'Would buy again',
    body: 'Arrived healthy and bigger than I expected. No shock, no drooping — settled in within a week.',
    date: '2026-04-28',
    verified: true,
  },
  {
    productId: 'p18',
    author: 'Priya M.',
    rating: 4,
    title: 'Good, minor issue',
    body: 'Good quality, just took a little longer to arrive than the estimate suggested.',
    date: '2026-04-17',
    verified: false,
  },
  {
    productId: 'p19',
    author: 'Nadia F.',
    rating: 4,
    title: 'Good, minor issue',
    body: 'One small leaf had a nick from shipping but otherwise in great shape. Would still recommend.',
    date: '2026-05-16',
    verified: true,
  },
  {
    productId: 'p19',
    author: 'Owen P.',
    rating: 3,
    title: 'Does the job',
    body: 'Fine overall, care instructions could have been more specific to my climate.',
    date: '2026-05-05',
    verified: true,
  },
  {
    productId: 'p20',
    author: 'Owen P.',
    rating: 5,
    title: 'Exceeded expectations',
    body: 'Arrived healthy and bigger than I expected. No shock, no drooping — settled in within a week.',
    date: '2026-05-12',
    verified: true,
  },
  {
    productId: 'p20',
    author: 'Priya M.',
    rating: 4,
    title: 'Solid pick',
    body: 'Good quality, just took a little longer to arrive than the estimate suggested.',
    date: '2026-05-01',
    verified: false,
  },
  {
    productId: 'p20',
    author: 'Daniel K.',
    rating: 3,
    title: 'It’s fine',
    body: 'It’s okay — smaller than the photos implied but healthy enough.',
    date: '2026-04-20',
    verified: true,
  },
  {
    productId: 'p21',
    author: 'Priya M.',
    rating: 5,
    title: 'Exceeded expectations',
    body: 'Arrived healthy and bigger than I expected. No shock, no drooping — settled in within a week.',
    date: '2026-05-08',
    verified: false,
  },
  {
    productId: 'p21',
    author: 'Daniel K.',
    rating: 5,
    title: 'Exactly as described',
    body: 'Packaging was impressive, nothing shifted in transit. Been thriving on my windowsill since.',
    date: '2026-04-27',
    verified: true,
  },
  {
    productId: 'p21',
    author: 'Amara O.',
    rating: 4,
    title: 'Happy with it',
    body: 'One small leaf had a nick from shipping but otherwise in great shape. Would still recommend.',
    date: '2026-04-16',
    verified: true,
  },
  {
    productId: 'p21',
    author: 'Wei L.',
    rating: 3,
    title: 'Does the job',
    body: 'Fine overall, care instructions could have been more specific to my climate.',
    date: '2026-04-05',
    verified: true,
  },
  {
    productId: 'p22',
    author: 'Daniel K.',
    rating: 4,
    title: 'Good, minor issue',
    body: 'One small leaf had a nick from shipping but otherwise in great shape. Would still recommend.',
    date: '2026-05-04',
    verified: true,
  },
  {
    productId: 'p22',
    author: 'Amara O.',
    rating: 5,
    title: 'Exactly as described',
    body: 'Packaging was impressive, nothing shifted in transit. Been thriving on my windowsill since.',
    date: '2026-04-23',
    verified: true,
  },
  {
    productId: 'p23',
    author: 'Amara O.',
    rating: 5,
    title: 'Exceeded expectations',
    body: 'Arrived healthy and bigger than I expected. No shock, no drooping — settled in within a week.',
    date: '2026-04-30',
    verified: true,
  },
  {
    productId: 'p23',
    author: 'Wei L.',
    rating: 4,
    title: 'Solid pick',
    body: 'Good quality, just took a little longer to arrive than the estimate suggested.',
    date: '2026-04-19',
    verified: true,
  },
  {
    productId: 'p23',
    author: 'Sofia R.',
    rating: 5,
    title: 'Would buy again',
    body: 'Arrived healthy and bigger than I expected. No shock, no drooping — settled in within a week.',
    date: '2026-04-08',
    verified: false,
  },
  {
    productId: 'p24',
    author: 'Wei L.',
    rating: 5,
    title: 'Exceeded expectations',
    body: 'Arrived healthy and bigger than I expected. No shock, no drooping — settled in within a week.',
    date: '2026-04-26',
    verified: true,
  },
  {
    productId: 'p24',
    author: 'Sofia R.',
    rating: 5,
    title: 'Exactly as described',
    body: 'Packaging was impressive, nothing shifted in transit. Been thriving on my windowsill since.',
    date: '2026-04-15',
    verified: false,
  },
  {
    productId: 'p24',
    author: 'Marcus T.',
    rating: 4,
    title: 'Happy with it',
    body: 'One small leaf had a nick from shipping but otherwise in great shape. Would still recommend.',
    date: '2026-04-04',
    verified: true,
  },
  {
    productId: 'p24',
    author: 'Ingrid B.',
    rating: 5,
    title: 'Arrived in great shape',
    body: 'Packaging was impressive, nothing shifted in transit. Been thriving on my windowsill since.',
    date: '2026-03-24',
    verified: true,
  },
];
async function main() {
  console.log('Seeding permissions...');
  for (const permission of PERMISSIONS) {
    await prisma.permission.upsert({
      where: { key: permission.key },
      update: { description: permission.description },
      create: permission,
    });
  }

  console.log('Seeding roles...');
  const customerRole = await prisma.role.upsert({
    where: { name: 'customer' },
    update: {},
    create: {
      name: 'customer',
      description: 'Default role for storefront customers',
      permissions: { connect: CUSTOMER_PERMISSIONS.map((key) => ({ key })) },
    },
  });

  const adminRole = await prisma.role.upsert({
    where: { name: 'admin' },
    update: {},
    create: {
      name: 'admin',
      description: 'Full administrative access',
      permissions: { connect: ADMIN_PERMISSIONS.map((key) => ({ key })) },
    },
  });

  // Matches apps/web's existing documented demo accounts exactly
  // (apps/web/src/data/users.ts, apps/web/README.md) — once the frontend
  // is switched from MSW to this real API, the same demo credentials
  // continue to work unchanged.
  console.log('Seeding demo accounts...');
  await prisma.user.upsert({
    where: { email: 'demo@folia.example' },
    update: {},
    create: {
      email: 'demo@folia.example',
      passwordHash: await hashPassword('folia-demo'),
      firstName: 'Sam',
      lastName: 'Rivera',
      emailVerified: true,
      emailVerifiedAt: new Date(),
      roleId: customerRole.id,
    },
  });

  await prisma.user.upsert({
    where: { email: 'admin@folia.example' },
    update: {},
    create: {
      email: 'admin@folia.example',
      passwordHash: await hashPassword('folia-admin'),
      firstName: 'Admin',
      lastName: 'User',
      emailVerified: true,
      emailVerifiedAt: new Date(),
      roleId: adminRole.id,
    },
  });

  console.log('Seeding categories and collections...');
  const categoryBySlug = new Map<string, string>();
  for (const category of CATEGORIES) {
    const record = await prisma.category.upsert({
      where: { slug: category.slug },
      update: { name: category.name, description: category.description },
      create: { ...category, type: 'CATEGORY' },
    });
    categoryBySlug.set(category.slug, record.id);
  }
  for (const collection of COLLECTIONS) {
    await prisma.category.upsert({
      where: { slug: collection.slug },
      update: { name: collection.name, description: collection.description },
      create: { ...collection, type: 'COLLECTION' },
    });
  }

  console.log(
    `Seeding ${PRODUCTS.length} products (from apps/web's real catalog)...`,
  );
  for (const p of PRODUCTS) {
    const categoryId = categoryBySlug.get(p.categorySlug);
    if (!categoryId) {
      throw new Error(
        `Product ${p.slug} references unknown category slug "${p.categorySlug}" — check CATEGORIES above.`,
      );
    }

    await prisma.product.upsert({
      where: { slug: p.slug },
      update: {},
      create: {
        id: p.id,
        slug: p.slug,
        name: p.name,
        price: p.price,
        compareAtPrice: p.compareAtPrice,
        description: p.description,
        categoryId,
        badge: p.badge as never,
        careLevel: p.careLevel as never,
        rating: p.rating,
        reviewCount: p.reviewCount,
        inStock: p.inStock,
        stockCount: p.stockCount,
        createdAt: new Date(p.createdAt),
        variants: { create: p.variants },
        specs: { create: p.specs },
      },
    });
  }

  console.log(`Seeding ${REVIEWS.length} reviews...`);
  // Reviews have no natural unique key in the source data, so upsert isn't
  // meaningful here — idempotency instead means "skip products that
  // already have any reviews seeded" (one query, not one per review).
  const productsWithReviews = await prisma.review.groupBy({
    by: ['productId'],
  });
  const alreadySeeded = new Set(
    productsWithReviews.map((r: { productId: string }) => r.productId),
  );

  for (const r of REVIEWS) {
    if (alreadySeeded.has(r.productId)) continue;
    await prisma.review.create({
      data: {
        productId: r.productId,
        author: r.author,
        rating: r.rating,
        title: r.title,
        body: r.body,
        date: new Date(r.date),
        verified: r.verified,
      },
    });
  }

  console.log('Seed complete.');
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
