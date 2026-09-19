import { useState } from 'react';
import { Crosshair, Loader2, MapPin } from 'lucide-react';
import { Modal } from '@/components/common/Modal';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/common/Alert';
import { FormField } from '@/components/common/FormField';
import { useLocationStore } from '@/store/locationStore';
import { detectPlace, lookupPincode, GeoError } from '@/utils/geo';
import { isValidPostalCode } from '@/utils/region';

/** Navbar chip: shows the current delivery PIN, or invites the visitor to set one. */
export function LocationButton() {
  const location = useLocationStore((s) => s.location);
  const openPicker = useLocationStore((s) => s.openPicker);
  return (
    <>
      <button
        type="button"
        onClick={openPicker}
        aria-label={location ? `Delivering to ${location.pincode}. Change location` : 'Set your delivery location'}
        className="flex items-center gap-1.5 p-2.5 rounded-[var(--radius-control)] text-ink-soft hover:text-heading hover:bg-stone-dark transition-colors"
      >
        <MapPin size={20} />
        <span className="hidden xl:inline text-xs font-medium whitespace-nowrap">
          {location ? `Deliver to ${location.pincode}` : 'Set location'}
        </span>
      </button>
      <LocationDialog />
    </>
  );
}

function LocationDialog() {
  const open = useLocationStore((s) => s.pickerOpen);
  const close = useLocationStore((s) => s.closePicker);
  const location = useLocationStore((s) => s.location);
  const setLocation = useLocationStore((s) => s.setLocation);
  const clearLocation = useLocationStore((s) => s.clearLocation);

  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState<'detect' | 'pin' | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleDetect() {
    setBusy('detect');
    setError(null);
    try {
      const place = await detectPlace();
      if (!place.postalCode) {
        setError("We found your area but not its PIN code. Please enter your PIN code below.");
        return;
      }
      setLocation({ pincode: place.postalCode, city: place.city, state: place.state, source: 'detected' });
    } catch (e) {
      setError(e instanceof GeoError ? e.message : "Couldn't detect your location. Enter your PIN code instead.");
    } finally {
      setBusy(null);
    }
  }

  async function handlePin() {
    const value = pin.trim();
    if (!isValidPostalCode(value)) {
      setError('Enter a valid 6-digit PIN code.');
      return;
    }
    setBusy('pin');
    setError(null);
    const found = await lookupPincode(value);
    setLocation({ pincode: value, city: found?.city ?? '', state: found?.state ?? '', source: 'manual' });
    setBusy(null);
    setPin('');
  }

  return (
    <Modal open={open} onClose={close} title="Delivery location">
      <div className="flex flex-col gap-4">
        {location && (
          <p className="text-sm text-ink-soft">
            Now delivering to <span className="text-ink font-medium">{location.pincode}</span>
            {location.city && `, ${location.city}`}
            {location.state && `, ${location.state}`}.
          </p>
        )}

        <Button
          type="button"
          variant="primary"
          icon={busy === 'detect' ? <Loader2 size={16} className="animate-spin" /> : <Crosshair size={16} />}
          disabled={busy !== null}
          onClick={() => void handleDetect()}
        >
          {busy === 'detect' ? 'Finding your location…' : 'Use my current location'}
        </Button>

        <div className="flex items-center gap-3 text-xs text-ink-soft" aria-hidden="true">
          <span className="h-px flex-1 bg-stone-dark" />
          or
          <span className="h-px flex-1 bg-stone-dark" />
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void handlePin();
          }}
          className="flex items-end gap-2"
        >
          <div className="flex-1">
            <FormField
              label="PIN code"
              inputMode="numeric"
              maxLength={6}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
              placeholder="e.g. 560038"
            />
          </div>
          <Button type="submit" variant="outline" disabled={busy !== null || pin.length !== 6}>
            {busy === 'pin' ? 'Checking…' : 'Apply'}
          </Button>
        </form>

        {error && <Alert tone="error">{error}</Alert>}

        <p className="text-xs text-ink-soft">
          Your PIN code, city and state are saved on this device only. “Use my current location” sends your coordinates
          once to OpenStreetMap to find the address — nothing is sent to Folia.
        </p>

        {location && (
          <button
            type="button"
            onClick={() => {
              clearLocation();
              setError(null);
            }}
            className="self-start text-xs text-fern hover:text-heading underline"
          >
            Clear my location
          </button>
        )}
      </div>
    </Modal>
  );
}
