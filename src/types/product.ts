export interface Product {
  id: string;
  slug: string;
  name: string;
  price: number;
  compareAtPrice?: number;
  category: string;
  badge?: 'New' | 'Sale' | 'Bestseller' | 'Low stock';
  rating?: number;
  reviewCount?: number;
}
