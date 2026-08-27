import { lazy, Suspense } from 'react';
import { createBrowserRouter } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { PageLoader } from '@/components/common/PageLoader';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';

// Every route component is lazy-loaded so the initial bundle only pays for
// the layout shell + whichever page was requested (route-level code splitting).
const Home = lazy(() => import('@/pages/Home'));
const Shop = lazy(() => import('@/pages/Shop'));
const Category = lazy(() => import('@/pages/Category'));
const ProductDetail = lazy(() => import('@/pages/ProductDetail'));
const Search = lazy(() => import('@/pages/Search'));
const Cart = lazy(() => import('@/pages/Cart'));
const Wishlist = lazy(() => import('@/pages/Wishlist'));
const About = lazy(() => import('@/pages/About'));
const Contact = lazy(() => import('@/pages/Contact'));
const BlogList = lazy(() => import('@/pages/BlogList'));
const BlogDetail = lazy(() => import('@/pages/BlogDetail'));
const FAQ = lazy(() => import('@/pages/FAQ'));
const Policy = lazy(() => import('@/pages/Policy'));
const Account = lazy(() => import('@/pages/Account'));
const Login = lazy(() => import('@/pages/Login'));
const Register = lazy(() => import('@/pages/Register'));
const ForgotPassword = lazy(() => import('@/pages/ForgotPassword'));
const ResetPassword = lazy(() => import('@/pages/ResetPassword'));
const NotFound = lazy(() => import('@/pages/NotFound'));

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
      {
        element: <ProtectedRoute />,
        children: [{ path: 'account', element: withSuspense(<Account />) }],
      },
      { path: '*', element: withSuspense(<NotFound />) },
    ],
  },
]);
