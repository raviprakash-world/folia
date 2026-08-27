import type { Category } from '@/types/product';

export const categories: Category[] = [
  { slug: 'plants', name: 'Plants', description: 'Living plants, shipped established in their nursery pot.' },
  { slug: 'vessels', name: 'Vessels', description: 'Pots, planters, and baskets sized to match.' },
  { slug: 'tools', name: 'Tools', description: 'The unglamorous things that keep plants alive.' },
];

export const collections: Category[] = [
  { slug: 'low-light-plants', name: 'Low-light Plants', description: 'For north-facing rooms and shadier corners.' },
  { slug: 'statement-vessels', name: 'Statement Vessels', description: 'Ceramics and stoneware built to be seen.' },
  { slug: 'gifting', name: 'Gifting', description: 'Ready to arrive boxed, no assembly required.' },
  { slug: 'pet-friendly', name: 'Pet-friendly', description: 'Non-toxic picks, verified against the ASPCA list.' },
  { slug: 'flowering', name: 'Flowering', description: 'Plants that bloom indoors, not just green ones.' },
  { slug: 'baskets', name: 'Baskets', description: 'Woven vessels for a softer look.' },
  { slug: 'new-home', name: 'New Home', description: 'Easy-care starter plants for a fresh space.' },
  { slug: 'office', name: 'Office Plants', description: 'Tolerant of fluorescent light and Monday neglect.' },
];
