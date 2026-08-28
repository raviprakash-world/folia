import { useState } from 'react';
import { Download, AlertTriangle } from 'lucide-react';
import { PageHeader } from '@/components/common/PageHeader';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/common/Modal';
import { useAuthStore } from '@/store/authStore';
import { useAddressStore } from '@/store/addressStore';
import { useOrderStore } from '@/store/orderStore';
import { useToastStore } from '@/store/toastStore';
import { ThemeToggle } from '@/components/common/ThemeToggle';

function exportAccountData(data: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export default function AccountSettings() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const addresses = useAddressStore((s) => s.addresses);
  const orders = useOrderStore((s) => s.orders);
  const showToast = useToastStore((s) => s.showToast);
  const [deleteOpen, setDeleteOpen] = useState(false);

  function handleExport() {
    exportAccountData({ user, addresses, orders }, `folia-account-data-${user?.id ?? 'demo'}.json`);
    showToast('success', 'Your data export has started downloading.');
  }

  async function handleDeleteAccount() {
    // Honest mock: there's no real account-deletion endpoint. Signs out and
    // says so plainly, rather than pretending to delete anything.
    await logout();
    setDeleteOpen(false);
    showToast('info', "Account deletion isn't wired to a real backend in this demo — you've been signed out.");
  }

  return (
    <div className="max-w-md">
      <PageHeader title="Account Settings" />

      <div className="flex flex-col gap-6">
        <div className="p-4 rounded-[var(--radius-card)] bg-stone-light border border-stone-dark">
          <h2 className="text-sm font-medium text-ink mb-1">Appearance</h2>
          <p className="text-xs text-ink-soft mb-3">
            "System" follows your device's setting automatically, including if it changes while you're here.
          </p>
          <ThemeToggle />
        </div>

        <div className="p-4 rounded-[var(--radius-card)] bg-stone-light border border-stone-dark">
          <h2 className="text-sm font-medium text-ink mb-1">Export your data</h2>
          <p className="text-xs text-ink-soft mb-3">
            Download your profile, addresses, and order history as a JSON file.
          </p>
          <Button variant="outline" size="sm" icon={<Download size={14} />} onClick={handleExport}>
            Export data
          </Button>
        </div>

        <div className="p-4 rounded-[var(--radius-card)] border border-rust/30 bg-rust-light">
          <h2 className="text-sm font-medium text-rust mb-1 flex items-center gap-1.5">
            <AlertTriangle size={14} />
            Danger zone
          </h2>
          <p className="text-xs text-ink-soft mb-3">
            Permanently delete your account. This demo doesn't have a real deletion backend — see
            what actually happens before you confirm.
          </p>
          <Button variant="outline" size="sm" className="!border-rust !text-rust" onClick={() => setDeleteOpen(true)}>
            Delete account
          </Button>
        </div>
      </div>

      <Modal open={deleteOpen} onClose={() => setDeleteOpen(false)} title="Delete account?">
        <p className="text-sm text-ink-soft mb-5">
          This is a portfolio project — there's no real account-deletion endpoint behind this
          button. Confirming will simply sign you out, honestly, rather than pretend to delete
          anything.
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setDeleteOpen(false)}>
            Cancel
          </Button>
          <Button variant="primary" onClick={() => void handleDeleteAccount()}>
            Sign out
          </Button>
        </div>
      </Modal>
    </div>
  );
}
