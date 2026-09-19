import { Outlet, useLocation } from 'react-router-dom';
import { AnnouncementBar } from './AnnouncementBar';
import { Navbar } from './Navbar';
import { Footer } from './Footer';
import { SearchOverlay } from './SearchOverlay';
import { SlideCart } from '@/components/cart/SlideCart';
import { ToastViewport } from '@/components/common/Toast';

export function Layout() {
  const isHome = useLocation().pathname === '/';
  return (
    <div className="min-h-screen flex flex-col">
      <a href="#main-content" className="skip-link">
        Skip to content
      </a>
      {isHome && <AnnouncementBar />}
      <Navbar />
      <main id="main-content" className="flex-1">
        <Outlet />
      </main>
      <Footer />
      <SlideCart />
      <ToastViewport />
      <SearchOverlay />
    </div>
  );
}
