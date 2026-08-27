import { useState } from 'react';
import { Link } from 'react-router-dom';
import { LogOut, Package, User as UserIcon } from 'lucide-react';
import { Container } from '@/components/ui/Container';
import { Button } from '@/components/ui/Button';
import { PageHeader } from '@/components/common/PageHeader';
import { EmptyState } from '@/components/common/EmptyState';
import { Modal } from '@/components/common/Modal';
import { useAuthStore } from '@/store/authStore';
import { useToastStore } from '@/store/toastStore';

export default function Account() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const showToast = useToastStore((s) => s.showToast);
  const [confirmOpen, setConfirmOpen] = useState(false);

  async function handleConfirmLogout() {
    await logout();
    setConfirmOpen(false);
    showToast('info', "You've been signed out.");
  }

  if (!user) return null; // ProtectedRoute guarantees this never renders without a user

  return (
    <Container className="py-16">
      <PageHeader
        eyebrow="Account"
        title={`Welcome back, ${user.firstName}`}
        action={
          <Button variant="outline" icon={<LogOut size={15} />} onClick={() => setConfirmOpen(true)}>
            Log out
          </Button>
        }
      />

      <div className="grid md:grid-cols-2 gap-6 mb-12">
        <div className="p-5 rounded-[var(--radius-card)] bg-stone-light border border-stone-dark">
          <div className="flex items-center gap-2 mb-3">
            <UserIcon size={16} className="text-fern" />
            <h2 className="text-sm font-medium text-ink">Account details</h2>
          </div>
          <dl className="flex flex-col gap-1.5 text-sm">
            <div className="flex justify-between">
              <dt className="text-ink-soft">Name</dt>
              <dd className="text-ink">{user.firstName} {user.lastName}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ink-soft">Email</dt>
              <dd className="text-ink font-mono">{user.email}</dd>
            </div>
          </dl>
        </div>
      </div>

      <div className="flex items-center gap-2 mb-4">
        <Package size={16} className="text-fern" />
        <h2 className="text-sm font-medium text-ink">Order history</h2>
      </div>
      <EmptyState
        title="No orders yet"
        description="Once you place an order, it'll show up here."
        action={
          <Button variant="primary">
            <Link to="/shop">Browse the shop</Link>
          </Button>
        }
      />

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
