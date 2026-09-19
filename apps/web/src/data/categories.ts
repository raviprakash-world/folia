import catalog from '../../../api/prisma/demo/catalog.json';
import type { Category } from '@/types/product';

// From apps/api/prisma/demo/catalog.json — the same rows the API seed writes.
export const categories: Category[] = catalog.categories;

export const collections: Category[] = catalog.collections;
