import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Plus, Loader2 } from 'lucide-react';
import { AddressCard } from '@/components/account/AddressCard';
import { AddressForm } from '@/components/account/AddressForm';
import { Modal } from '@/components/common/Modal';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/common/EmptyState';
import { useAddressStore } from '@/store/addressStore';
import { useAddressBootstrap, useDefaultShippingAddress, useDefaultBillingAddress } from '@/hooks/useAddresses';
import { useCheckoutStore } from '@/store/checkoutStore';
import type { AddressFormValues } from '@/utils/validation';

export default function CheckoutShipping() {
  useAddressBootstrap();
  const navigate = useNavigate();
  const addresses = useAddressStore((s) => s.addresses);
  const status = useAddressStore((s) => s.status);
  const addAddress = useAddressStore((s) => s.addAddress);
  const defaultShippingAddress = useDefaultShippingAddress();
  const defaultBillingAddress = useDefaultBillingAddress();

  const shippingAddressId = useCheckoutStore((s) => s.shippingAddressId);
  const setShippingAddressId = useCheckoutStore((s) => s.setShippingAddressId);
  const billingSameAsShipping = useCheckoutStore((s) => s.billingSameAsShipping);
  const setBillingSameAsShipping = useCheckoutStore((s) => s.setBillingSameAsShipping);
  const billingAddressId = useCheckoutStore((s) => s.billingAddressId);
  const setBillingAddressId = useCheckoutStore((s) => s.setBillingAddressId);

  const [formOpen, setFormOpen] = useState(false);

  // Pre-select the default shipping address the first time addresses load.
  useEffect(() => {
    if (!shippingAddressId && addresses.length > 0) {
      const def = defaultShippingAddress ?? addresses[0];
      if (def) setShippingAddressId(def.id);
    }
  }, [addresses, shippingAddressId, defaultShippingAddress, setShippingAddressId]);

  // Pre-select the default billing address the first time someone unchecks
  // "same as shipping", so they aren't left with nothing selected.
  useEffect(() => {
    if (!billingSameAsShipping && !billingAddressId && addresses.length > 0) {
      const def = defaultBillingAddress ?? addresses[0];
      if (def) setBillingAddressId(def.id);
    }
  }, [billingSameAsShipping, billingAddressId, addresses, defaultBillingAddress, setBillingAddressId]);

  async function handleAddAddress(values: AddressFormValues): Promise<boolean> {
    const input = {
      ...values,
      email: values.email || undefined,
      addressLine2: values.addressLine2 || undefined,
      landmark: values.landmark || undefined,
      label: values.label || undefined,
    };
    const created = await addAddress(input);
    if (created) {
      setShippingAddressId(created.id);
      setFormOpen(false);
      return true;
    }
    return false;
  }

  const canContinue = !!shippingAddressId && (billingSameAsShipping || !!billingAddressId);

  return (
    <div>
      <h1 className="font-display text-2xl font-semibold text-pine mb-1">Shipping address</h1>
      <p className="text-sm text-ink-soft mb-6">Choose where your order should ship.</p>

      {status === 'pending' && addresses.length === 0 && (
        <div className="flex items-center gap-2 text-sm text-ink-soft py-8">
          <Loader2 size={16} className="animate-spin" />
          Loading your addresses…
        </div>
      )}

      {status !== 'pending' && addresses.length === 0 && (
        <EmptyState
          title="No addresses saved"
          description="Add an address to continue."
          action={
            <Button variant="primary" onClick={() => setFormOpen(true)}>
              Add an address
            </Button>
          }
        />
      )}

      {addresses.length > 0 && (
        <>
          <div className="grid sm:grid-cols-2 gap-3 mb-4">
            {addresses.map((address) => (
              <AddressCard
                key={address.id}
                address={address}
                selectable
                selected={shippingAddressId === address.id}
                onSelect={() => setShippingAddressId(address.id)}
              />
            ))}
          </div>
          <button
            type="button"
            onClick={() => setFormOpen(true)}
            className="flex items-center gap-1.5 text-sm text-fern hover:text-pine transition-colors mb-10"
          >
            <Plus size={14} />
            Add a new address
          </button>

          <div className="mb-6">
            <label className="flex items-center gap-2.5 text-sm cursor-pointer mb-4">
              <input
                type="checkbox"
                checked={billingSameAsShipping}
                onChange={(e) => setBillingSameAsShipping(e.target.checked)}
                className="w-4 h-4 accent-fern"
              />
              <span className="text-ink">Billing address same as shipping</span>
            </label>

            {!billingSameAsShipping && (
              <div className="grid sm:grid-cols-2 gap-3">
                {addresses.map((address) => (
                  <AddressCard
                    key={address.id}
                    address={address}
                    selectable
                    selected={billingAddressId === address.id}
                    onSelect={() => setBillingAddressId(address.id)}
                  />
                ))}
              </div>
            )}
          </div>
        </>
      )}

      <div className="flex justify-between pt-4 border-t border-stone-dark">
        <Button variant="ghost" icon={<ArrowLeft size={15} />}>
          <Link to="/cart">Back to cart</Link>
        </Button>
        <Button
          variant="primary"
          icon={<ArrowRight size={15} />}
          iconPosition="right"
          disabled={!canContinue}
          onClick={() => void navigate('/checkout/delivery')}
        >
          Continue
        </Button>
      </div>

      <Modal open={formOpen} onClose={() => setFormOpen(false)} title="Add a new address">
        <AddressForm onSubmit={handleAddAddress} onCancel={() => setFormOpen(false)} submitLabel="Add address" />
      </Modal>
    </div>
  );
}
