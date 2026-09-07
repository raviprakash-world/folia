import { LayoutDashboard, DollarSign, Package, ShoppingBag, Users, Search, Undo2 } from 'lucide-react';

export const adminNavItems = [
  { to: '/admin', label: 'Overview', Icon: LayoutDashboard, end: true },
  { to: '/admin/revenue', label: 'Revenue', Icon: DollarSign },
  { to: '/admin/orders', label: 'Orders', Icon: ShoppingBag },
  { to: '/admin/returns', label: 'Returns', Icon: Undo2 },
  { to: '/admin/products', label: 'Products', Icon: Package },
  { to: '/admin/customers', label: 'Customers', Icon: Users },
  { to: '/admin/search', label: 'Search', Icon: Search },
];
