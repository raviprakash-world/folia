import { useEffect, useRef, useState } from 'react';
import { ChevronRight, Crosshair, Loader2, MapPin } from 'lucide-react';
import { Modal } from '@/components/common/Modal';
import { Button } from '@/components/ui/Button';
import { Container } from '@/components/ui/Container';
import { Alert } from '@/components/common/Alert';
import { FormField } from '@/components/common/FormField';
import { useLocationStore } from '@/store/locationStore';
import { detectPlace, lookupPincode, GeoError } from '@/utils/geo';
import { isValidPostalCode } from '@/utils/region';

/**
 * Always-visible strip under the navbar (every screen width) — the primary,
 * unmissable entry point. The navbar pin icon is only a shortcut: its text
 * label can't fit on smaller screens, so nothing important depends on it.
 */
export function LocationBar() {
  const location = useLocationStore((s) => s.location);
  const openPicker = useLocationStore((s) => s.openPicker);
  const openPickerAndDetect = useLocationStore((s) => s.openPickerAndDetect);
  return (
    <div className="border-b border-stone-dark bg-stone-dark/40">
      <Container>
        <button
          type="button"
          onClick={openPicker}
          className="flex min-h-11 w-full items-center gap-2 text-left text-sm lg:hidden"
        >
          <MapPin size={16} className="shrink-0 text-fern-dark" aria-hidden="true" />
          {location ? (
            <span className="truncate text-ink-soft">
              Delivering to <span className="font-medium text-ink">{location.pincode}</span>
              {location.city && `, ${location.city}`}
            </span>
          ) : (
            <span className="truncate text-ink">Enter PIN code to check delivery</span>
          )}
          <span className="ml-auto flex shrink-0 items-center gap-0.5 font-medium text-fern-dark">
            {location ? 'Change' : 'Set'}
            <ChevronRight size={16} aria-hidden="true" />
          </span>
        </button>

        <div className="hidden flex-wrap items-center gap-x-3 gap-y-1 py-1.5 text-xs lg:flex">
          <MapPin size={14} className="shrink-0 text-fern-dark" aria-hidden="true" />
          {location ? (
            <>
              <span className="text-ink-soft">
                Delivering to <span className="font-medium text-ink">{location.pincode}</span>
                {location.city && `, ${location.city}`}
              </span>
              <button type="button" onClick={openPicker} className="font-medium text-fern-dark underline hover:text-heading">
                Change
              </button>
            </>
          ) : (
            <>
              <span className="text-ink-soft">See what ships to your area.</span>
              <button
                type="button"
                onClick={openPickerAndDetect}
                className="flex items-center gap-1 font-medium text-fern-dark underline hover:text-heading"
              >
                <Crosshair size={12} aria-hidden="true" />
                Use my current location
              </button>
              <span className="text-ink-soft" aria-hidden="true">
                or
              </span>
              <button type="button" onClick={openPicker} className="font-medium text-fern-dark underline hover:text-heading">
                enter PIN code
              </button>
            </>
          )}
        </div>
      </Container>
      <LocationDialog />
    </div>
  );
}

function LocationDialog() {
  const open = useLocationStore((s) => s.pickerOpen);
  const close = useLocationStore((s) => s.closePicker);
  const location = useLocationStore((s) => s.location);
  const setLocation = useLocationStore((s) => s.setLocation);
  const clearLocation = useLocationStore((s) => s.clearLocation);

  const autoDetect = useLocationStore((s) => s.autoDetect);
  const clearAutoDetect = useLocationStore((s) => s.clearAutoDetect);
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

  // Opened from a "Use my current location" button: start right away (once).
  const startedRef = useRef(false);
  useEffect(() => {
    if (open && autoDetect && !startedRef.current) {
      startedRef.current = true;
      clearAutoDetect();
      void handleDetect();
    }
    if (!open) startedRef.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- handleDetect is recreated every render; only open/autoDetect should trigger this
  }, [open, autoDetect]);

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
