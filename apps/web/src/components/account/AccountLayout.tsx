import { Outlet, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useState } from 'react';
import { Container } from '@/components/ui/Container';
import { Breadcrumb } from '@/components/common/Breadcrumb';
import { Modal } from '@/components/common/Modal';
import { Button } from '@/components/ui/Button';
import { AccountSidebar } from './AccountSidebar';
import { accountNavItems } from './accountNavItems';
import { AccountMobileNav } from './AccountMobileNav';
import { useAuthStore } from '@/store/authStore';
import { useToastStore } from '@/store/toastStore';

function currentSectionLabel(pathname: string): string {
  // Longest-matching path wins, so /account/orders/:id still resolves to "Orders".
  const match = [...accountNavItems]
    .filter((item) => item.to.startsWith('/account'))
    .sort((a, b) => b.to.length - a.to.length)
    .find((item) => (item.end ? pathname === item.to : pathname.startsWith(item.to)));
  return match?.label ?? 'Account';
}

export function AccountLayout() {
  const location = useLocation();
  const logout = useAuthStore((s) => s.logout);
  const showToast = useToastStore((s) => s.showToast);
  const [confirmOpen, setConfirmOpen] = useState(false);

  async function handleConfirmLogout() {
    await logout();
    setConfirmOpen(false);
    showToast('info', "You've been signed out.");
  }

  return (
    <Container className="py-12">
      <Breadcrumb
        items={[
          { label: 'Home', to: '/' },
          { label: 'Account', to: '/account' },
          { label: currentSectionLabel(location.pathname) },
        ]}
      />

      <AccountMobileNav />

      <div className="flex gap-10 items-start">
        <AccountSidebar onLogoutClick={() => setConfirmOpen(true)} />

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

      <Modal open={confirmOpen} onClose={() => setConfirmOpen(false)} title="Log out?">
        <p className="text-sm text-ink-soft mb-5">
          You'll need to sign in again to see your account. Your cart and wishlist stay saved either way.
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setConfirmOpen(false)}>
            Cancel
          </Button>
          <Button variant="primary" onClick={() => void handleConfirmLogout()}>
            Log out
          </Button>
        </div>
      </Modal>
    </Container>
  );
}
