import { Outlet, useLocation } from 'react-router-dom';
import { AnnouncementBar } from './AnnouncementBar';
import { BottomNav } from './BottomNav';
import { shouldShowBottomNav } from '@/utils/bottomNav';
import { Navbar } from './Navbar';
import { Footer } from './Footer';
import { SearchOverlay } from './SearchOverlay';
import { SlideCart } from '@/components/cart/SlideCart';
import { ToastViewport } from '@/components/common/Toast';

export function Layout() {
  const { pathname } = useLocation();
  const isHome = pathname === '/';
  const showBottomNav = shouldShowBottomNav(pathname);
  return (
    <div className={`min-h-screen flex flex-col ${showBottomNav ? 'pb-[calc(3.5rem+env(safe-area-inset-bottom,0px))] lg:pb-0' : ''}`}>
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
      {showBottomNav && <BottomNav />}
      <ToastViewport />
      <SearchOverlay />
    </div>
  );
}
