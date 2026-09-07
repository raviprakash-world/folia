import { LayoutDashboard, Store, Package, ShoppingBag, Wallet } from 'lucide-react';

export const sellerNavItems = [
  { to: '/seller', label: 'Overview', Icon: LayoutDashboard, end: true },
  { to: '/seller/profile', label: 'Profile', Icon: Store },
  { to: '/seller/products', label: 'Products', Icon: Package },
  { to: '/seller/orders', label: 'Orders', Icon: ShoppingBag },
  { to: '/seller/earnings', label: 'Earnings', Icon: Wallet },
];
