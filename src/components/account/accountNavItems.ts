import { LayoutDashboard, User, MapPin, Package, Heart, Settings, ShieldCheck, Bell } from 'lucide-react';

export const accountNavItems = [
  { to: '/account', label: 'Overview', Icon: LayoutDashboard, end: true },
  { to: '/account/profile', label: 'My Profile', Icon: User },
  { to: '/account/addresses', label: 'Address Book', Icon: MapPin },
  { to: '/account/orders', label: 'Orders', Icon: Package },
  { to: '/wishlist', label: 'Wishlist', Icon: Heart },
  { to: '/account/settings', label: 'Account Settings', Icon: Settings },
  { to: '/account/security', label: 'Security', Icon: ShieldCheck },
  { to: '/account/notifications', label: 'Notifications', Icon: Bell },
];
