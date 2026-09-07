import { Outlet, useLocation, Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useState } from 'react';
import { Container } from '@/components/ui/Container';
import { Breadcrumb } from '@/components/common/Breadcrumb';
import { Modal } from '@/components/common/Modal';
import { Button } from '@/components/ui/Button';
import { SellerSidebar } from './SellerSidebar';
import { sellerNavItems } from './sellerNavItems';
import { SellerMobileNav } from './SellerMobileNav';
import { useAuthStore } from '@/store/authStore';
import { useToastStore } from '@/store/toastStore';

function currentSectionLabel(pathname: string): string {
  const match = [...sellerNavItems]
    .sort((a, b) => b.to.length - a.to.length)
    .find((item) => (item.end ? pathname === item.to : pathname.startsWith(item.to)));
  return match?.label ?? 'Seller';
}

export function SellerLayout() {
  const location = useLocation();
  const logout = useAuthStore((s) => s.logout);
  const showToast = useToastStore((s) => s.showToast);
  const [confirmOpen, setConfirmOpen] = useState(false);

  async function handleConfirmLogout() {
    await logout();
    setConfirmOpen(false);
    showToast('info', "You've been signed out of the seller dashboard.");
  }

  return (
    <Container className="py-12">
      <Breadcrumb
        items={[
          { label: 'Home', to: '/' },
          { label: 'Seller', to: '/seller' },
          { label: currentSectionLabel(location.pathname) },
        ]}
      />

      <SellerMobileNav />

      <div className="flex gap-10 items-start">
        <SellerSidebar onLogoutClick={() => setConfirmOpen(true)} />

        <div className="flex-1 min-w-0">
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      <Modal open={confirmOpen} onClose={() => setConfirmOpen(false)} title="Log out of the seller dashboard?">
        <p className="text-sm text-ink-soft mb-5">You'll need to sign in again to access your seller account.</p>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setConfirmOpen(false)}>
            Cancel
          </Button>
          <Button variant="primary" onClick={() => void handleConfirmLogout()}>
            Log out
          </Button>
        </div>
      </Modal>

      <p className="text-center mt-12">
        <Link to="/" className="text-xs text-ink-soft hover:text-fern transition-colors">
          ← Back to the storefront
        </Link>
      </p>
    </Container>
  );
}
