import { lazy, Suspense } from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { PageLoader } from '@/components/common/PageLoader';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { AccountLayout } from '@/components/account/AccountLayout';
import { CheckoutLayout } from '@/components/checkout/CheckoutLayout';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { SellerLayout } from '@/components/seller/SellerLayout';

// Every route component is lazy-loaded so the initial bundle only pays for
// the layout shell + whichever page was requested (route-level code splitting).
const Home = lazy(() => import('@/pages/Home'));
const Shop = lazy(() => import('@/pages/Shop'));
const Category = lazy(() => import('@/pages/Category'));
const ProductDetail = lazy(() => import('@/pages/ProductDetail'));
const Search = lazy(() => import('@/pages/Search'));
const Sellers = lazy(() => import('@/pages/Sellers'));
const SellerStorefront = lazy(() => import('@/pages/SellerStorefront'));
const Cart = lazy(() => import('@/pages/Cart'));
const Wishlist = lazy(() => import('@/pages/Wishlist'));
const About = lazy(() => import('@/pages/About'));
const Contact = lazy(() => import('@/pages/Contact'));
const BlogList = lazy(() => import('@/pages/BlogList'));
const BlogDetail = lazy(() => import('@/pages/BlogDetail'));
const FAQ = lazy(() => import('@/pages/FAQ'));
const Policy = lazy(() => import('@/pages/Policy'));
const Login = lazy(() => import('@/pages/Login'));
const Register = lazy(() => import('@/pages/Register'));
const ForgotPassword = lazy(() => import('@/pages/ForgotPassword'));
const ResetPassword = lazy(() => import('@/pages/ResetPassword'));
const VerifyEmail = lazy(() => import('@/pages/VerifyEmail'));
const NotFound = lazy(() => import('@/pages/NotFound'));

// Account dashboard
const AccountOverview = lazy(() => import('@/pages/AccountOverview'));
const AccountProfile = lazy(() => import('@/pages/AccountProfile'));
const AccountAddresses = lazy(() => import('@/pages/AccountAddresses'));
const AccountOrders = lazy(() => import('@/pages/AccountOrders'));
const AccountOrderDetail = lazy(() => import('@/pages/AccountOrderDetail'));
const AccountSettings = lazy(() => import('@/pages/AccountSettings'));
const AccountSecurity = lazy(() => import('@/pages/AccountSecurity'));
const AccountNotifications = lazy(() => import('@/pages/AccountNotifications'));

// Checkout
const CheckoutShipping = lazy(() => import('@/pages/CheckoutShipping'));
const CheckoutDelivery = lazy(() => import('@/pages/CheckoutDelivery'));
const CheckoutPayment = lazy(() => import('@/pages/CheckoutPayment'));
const CheckoutReview = lazy(() => import('@/pages/CheckoutReview'));
const OrderConfirmation = lazy(() => import('@/pages/OrderConfirmation'));

// Seller dashboard
const SellerLogin = lazy(() => import('@/pages/SellerLogin'));
const SellerApply = lazy(() => import('@/pages/SellerApply'));
const SellerOverview = lazy(() => import('@/pages/SellerOverview'));
const SellerProfile = lazy(() => import('@/pages/SellerProfile'));
const SellerProducts = lazy(() => import('@/pages/SellerProducts'));
const SellerProductEditor = lazy(() => import('@/pages/SellerProductEditor'));
const SellerOrders = lazy(() => import('@/pages/SellerOrders'));
const SellerOrderDetail = lazy(() => import('@/pages/SellerOrderDetail'));
const SellerEarnings = lazy(() => import('@/pages/SellerEarnings'));

// Admin
const AdminLogin = lazy(() => import('@/pages/AdminLogin'));
const AdminOverview = lazy(() => import('@/pages/AdminOverview'));
const AdminRevenue = lazy(() => import('@/pages/AdminRevenue'));
const AdminOrders = lazy(() => import('@/pages/AdminOrders'));
const AdminReturns = lazy(() => import('@/pages/AdminReturns'));
const AdminReturnDetail = lazy(() => import('@/pages/AdminReturnDetail'));
const AdminProducts = lazy(() => import('@/pages/AdminProducts'));
const AdminCustomers = lazy(() => import('@/pages/AdminCustomers'));
const AdminSearch = lazy(() => import('@/pages/AdminSearch'));

function withSuspense(node: React.ReactNode) {
  return <Suspense fallback={<PageLoader />}>{node}</Suspense>;
}

export const router = createBrowserRouter([
  {
    path: '/',
    element: <Layout />,
    children: [
      { index: true, element: withSuspense(<Home />) },
      { path: 'shop', element: withSuspense(<Shop />) },
      { path: 'collections/:slug', element: withSuspense(<Category />) },
      { path: 'product/:slug', element: withSuspense(<ProductDetail />) },
      { path: 'search', element: withSuspense(<Search />) },
      { path: 'sellers', element: withSuspense(<Sellers />) },
      { path: 'sellers/:slug', element: withSuspense(<SellerStorefront />) },
      { path: 'cart', element: withSuspense(<Cart />) },
      { path: 'wishlist', element: withSuspense(<Wishlist />) },
      { path: 'about', element: withSuspense(<About />) },
      { path: 'contact', element: withSuspense(<Contact />) },
      { path: 'blog', element: withSuspense(<BlogList />) },
      { path: 'blog/:slug', element: withSuspense(<BlogDetail />) },
      { path: 'faq', element: withSuspense(<FAQ />) },
      { path: 'policies/:slug', element: withSuspense(<Policy />) },
      { path: 'account/login', element: withSuspense(<Login />) },
      { path: 'account/register', element: withSuspense(<Register />) },
      { path: 'account/forgot-password', element: withSuspense(<ForgotPassword />) },
      { path: 'account/reset-password', element: withSuspense(<ResetPassword />) },
      { path: 'account/verify-email', element: withSuspense(<VerifyEmail />) },
      {
        element: <ProtectedRoute />,
        children: [
          {
            path: 'account',
            element: <AccountLayout />,
            children: [
              { index: true, element: withSuspense(<AccountOverview />) },
              { path: 'profile', element: withSuspense(<AccountProfile />) },
              { path: 'addresses', element: withSuspense(<AccountAddresses />) },
              { path: 'orders', element: withSuspense(<AccountOrders />) },
              { path: 'orders/:id', element: withSuspense(<AccountOrderDetail />) },
              { path: 'settings', element: withSuspense(<AccountSettings />) },
              { path: 'security', element: withSuspense(<AccountSecurity />) },
              { path: 'notifications', element: withSuspense(<AccountNotifications />) },
            ],
          },
          {
            path: 'checkout',
            element: <CheckoutLayout />,
            children: [
              { index: true, element: <Navigate to="/checkout/shipping" replace /> },
              { path: 'shipping', element: withSuspense(<CheckoutShipping />) },
              { path: 'delivery', element: withSuspense(<CheckoutDelivery />) },
              { path: 'payment', element: withSuspense(<CheckoutPayment />) },
              { path: 'review', element: withSuspense(<CheckoutReview />) },
            ],
          },
          { path: 'checkout/confirmation/:orderId', element: withSuspense(<OrderConfirmation />) },
          // Marketplace Phase 15 — any logged-in customer can apply; this
          // is deliberately NOT inside the requireRole="seller" block
          // below, since applying is what assigns that role in the first
          // place (see SellerApply.tsx's own doc comment).
          { path: 'seller/apply', element: withSuspense(<SellerApply />) },
        ],
      },
      { path: 'seller/login', element: withSuspense(<SellerLogin />) },
      {
        element: <ProtectedRoute requireRole="seller" redirectTo="/seller/login" />,
        children: [
          {
            path: 'seller',
            element: <SellerLayout />,
            children: [
              { index: true, element: withSuspense(<SellerOverview />) },
              { path: 'profile', element: withSuspense(<SellerProfile />) },
              { path: 'products', element: withSuspense(<SellerProducts />) },
              { path: 'products/new', element: withSuspense(<SellerProductEditor />) },
              { path: 'products/:id', element: withSuspense(<SellerProductEditor />) },
              { path: 'orders', element: withSuspense(<SellerOrders />) },
              { path: 'orders/:id', element: withSuspense(<SellerOrderDetail />) },
              { path: 'earnings', element: withSuspense(<SellerEarnings />) },
            ],
          },
        ],
      },
      { path: 'admin/login', element: withSuspense(<AdminLogin />) },
      {
        element: <ProtectedRoute requireRole="admin" redirectTo="/admin/login" />,
        children: [
          {
            path: 'admin',
            element: <AdminLayout />,
            children: [
              { index: true, element: withSuspense(<AdminOverview />) },
              { path: 'revenue', element: withSuspense(<AdminRevenue />) },
              { path: 'orders', element: withSuspense(<AdminOrders />) },
              { path: 'returns', element: withSuspense(<AdminReturns />) },
              { path: 'returns/:id', element: withSuspense(<AdminReturnDetail />) },
              { path: 'products', element: withSuspense(<AdminProducts />) },
              { path: 'customers', element: withSuspense(<AdminCustomers />) },
              { path: 'search', element: withSuspense(<AdminSearch />) },
            ],
          },
        ],
      },
      { path: '*', element: withSuspense(<NotFound />) },
    ],
  },
]);
