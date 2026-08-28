import { useMemo, useState } from 'react';
import { Search, Plus, Loader2 } from 'lucide-react';
import { PageHeader } from '@/components/common/PageHeader';
import { AddressCard } from '@/components/account/AddressCard';
import { AddressForm } from '@/components/account/AddressForm';
import { Modal } from '@/components/common/Modal';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/common/Alert';
import { EmptyState } from '@/components/common/EmptyState';
import { useAddressStore } from '@/store/addressStore';
import { useAddressBootstrap } from '@/hooks/useAddresses';
import type { Address, GeoPlaceholder } from '@/types/address';
import type { AddressFormValues } from '@/utils/validation';

export default function AccountAddresses() {
  useAddressBootstrap();
  const addresses = useAddressStore((s) => s.addresses);
  const status = useAddressStore((s) => s.status);
  const error = useAddressStore((s) => s.error);
  const addAddress = useAddressStore((s) => s.addAddress);
  const editAddress = useAddressStore((s) => s.editAddress);
  const removeAddress = useAddressStore((s) => s.removeAddress);

  const [search, setSearch] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editingAddress, setEditingAddress] = useState<Address | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Address | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return addresses;
    return addresses.filter((a) =>
      [a.label, a.fullName, a.addressLine1, a.city, a.postalCode].some((field) =>
        field?.toLowerCase().includes(q)
      )
    );
  }, [addresses, search]);

  function openAddForm() {
    setEditingAddress(null);
    setFormOpen(true);
  }

  function openEditForm(address: Address) {
    setEditingAddress(address);
    setFormOpen(true);
  }

  async function handleFormSubmit(values: AddressFormValues, geo: GeoPlaceholder | null): Promise<boolean> {
    const input = {
      ...values,
      email: values.email || undefined,
      alternatePhone: values.alternatePhone || undefined,
      companyName: values.companyName || undefined,
      addressLine2: values.addressLine2 || undefined,
      landmark: values.landmark || undefined,
      deliveryInstructions: values.deliveryInstructions || undefined,
      label: values.label || undefined,
      geo: geo ?? undefined,
    };
    const result = editingAddress ? await editAddress(editingAddress.id, input) : await addAddress(input);
    if (result) {
      setFormOpen(false);
      return true;
    }
    return false;
  }

  async function handleConfirmDelete() {
    if (!deleteTarget) return;
    const ok = await removeAddress(deleteTarget.id);
    if (ok) setDeleteTarget(null);
  }

  const initialLoading = status === 'pending' && addresses.length === 0;

  return (
    <div>
      <PageHeader
        title="Address Book"
        description="Manage your shipping and billing addresses."
        action={
          <Button variant="primary" icon={<Plus size={15} />} onClick={openAddForm}>
            Add address
          </Button>
        }
      />

      {addresses.length > 0 && (
        <div className="relative mb-6 max-w-xs">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-soft" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search addresses…"
            aria-label="Search addresses"
            className="w-full rounded-[var(--radius-control)] border border-stone-dark bg-stone-light pl-9 pr-3 py-2 text-sm focus:border-fern transition-colors"
          />
        </div>
      )}

      {error && (
        <Alert tone="error" className="mb-6">
          {error}
        </Alert>
      )}

      {initialLoading && (
        <div className="flex items-center gap-2 text-sm text-ink-soft py-12">
          <Loader2 size={16} className="animate-spin" />
          Loading your addresses…
        </div>
      )}

      {!initialLoading && addresses.length === 0 && (
        <EmptyState
          title="No addresses yet"
          description="Add an address to speed up checkout next time."
          action={
            <Button variant="primary" onClick={openAddForm}>
              Add your first address
            </Button>
          }
        />
      )}

      {!initialLoading && addresses.length > 0 && filtered.length === 0 && (
        <EmptyState title="No matches" description="Try a different search term." />
      )}

      {filtered.length > 0 && (
        <div className="grid sm:grid-cols-2 gap-4">
          {filtered.map((address) => (
            <AddressCard
              key={address.id}
              address={address}
              onEdit={() => openEditForm(address)}
              onDelete={() => setDeleteTarget(address)}
            />
          ))}
        </div>
      )}

      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editingAddress ? 'Edit address' : 'Add a new address'}
      >
        <AddressForm
          initialValues={editingAddress ?? undefined}
          onSubmit={handleFormSubmit}
          onCancel={() => setFormOpen(false)}
          submitLabel={editingAddress ? 'Save changes' : 'Add address'}
        />
      </Modal>

      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Remove this address?">
        <p className="text-sm text-ink-soft mb-5">
          {deleteTarget?.label || deleteTarget?.fullName} will be removed from your address book. This can't be undone.
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setDeleteTarget(null)}>
            Cancel
          </Button>
          <Button variant="primary" onClick={() => void handleConfirmDelete()}>
            Remove
          </Button>
        </div>
      </Modal>
    </div>
  );
}
