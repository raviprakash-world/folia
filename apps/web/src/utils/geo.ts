import { isValidPostalCode } from '@/utils/region';

export interface DetectedPlace {
  postalCode: string;
  city: string;
  state: string;
  addressLine1: string;
}

export type GeoErrorCode = 'unsupported' | 'insecure' | 'denied' | 'unavailable' | 'timeout' | 'lookup' | 'outside-india';

export class GeoError extends Error {
  readonly code: GeoErrorCode;
  constructor(code: GeoErrorCode, message: string) {
    super(message);
    this.code = code;
  }
}

const NOMINATIM_REVERSE = 'https://nominatim.openstreetmap.org/reverse';
const INDIA_POST_PINCODE = 'https://api.postalpincode.in/pincode';

export const INDIAN_STATES = [
  'Andaman and Nicobar Islands', 'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chandigarh', 'Chhattisgarh',
  'Dadra and Nagar Haveli and Daman and Diu', 'Delhi', 'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jammu and Kashmir',
  'Jharkhand', 'Karnataka', 'Kerala', 'Ladakh', 'Lakshadweep', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya',
  'Mizoram', 'Nagaland', 'Odisha', 'Puducherry', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura',
  'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
];

// Only what the app's own data uses; anything else passes through untouched.
const STATE_ALIASES: Record<string, string> = {
  'nct of delhi': 'Delhi',
  'national capital territory of delhi': 'Delhi',
  'new delhi': 'Delhi',
  'orissa': 'Odisha',
  'pondicherry': 'Puducherry',
};

export function normalizeState(raw: string): string {
  const key = raw.trim().toLowerCase();
  return STATE_ALIASES[key] ?? raw.trim();
}

/**
 * Asks the browser for the device's position. Only ever called from a button
 * click (browsers require a user gesture-ish context and it is the user's
 * explicit request); the coordinates are used for one lookup and never stored.
 */
export function getCurrentPosition(): Promise<{ lat: number; lng: number }> {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) {
      reject(new GeoError('unsupported', "This browser can't share its location."));
      return;
    }
    if (!window.isSecureContext) {
      reject(new GeoError('insecure', 'Location needs a secure (https) connection.'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          reject(new GeoError('denied', 'Location permission was blocked. Allow it in your browser, or enter your PIN code instead.'));
        } else if (err.code === err.TIMEOUT) {
          reject(new GeoError('timeout', 'Finding your location took too long. Try again, or enter your PIN code.'));
        } else {
          reject(new GeoError('unavailable', "Your device couldn't tell us where it is. Check that Location Services and Wi-Fi are on (a laptop needs Wi-Fi to find itself), or just enter your PIN code."));
        }
      },
      { enableHighAccuracy: false, timeout: 12_000, maximumAge: 5 * 60_000 },
    );
  });
}

interface NominatimResponse {
  address?: Record<string, string>;
}

/** Turns coordinates into an Indian postal address via OpenStreetMap's Nominatim (user-initiated, low volume). */
export async function reverseGeocode(lat: number, lng: number): Promise<DetectedPlace> {
  const url = `${NOMINATIM_REVERSE}?format=jsonv2&addressdetails=1&accept-language=en&zoom=18&lat=${lat}&lon=${lng}`;
  let data: NominatimResponse;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(String(res.status));
    data = (await res.json()) as NominatimResponse;
  } catch {
    throw new GeoError('lookup', "Couldn't look up an address for your location. Enter your PIN code instead.");
  }
  const a = data.address;
  if (!a) throw new GeoError('lookup', "Couldn't look up an address for your location. Enter your PIN code instead.");
  if (a.country_code !== 'in') {
    throw new GeoError('outside-india', 'Folia delivers within India only, and your location is outside India.');
  }
  const postalCode = (a.postcode ?? '').replace(/\s+/g, '');
  const city = a.city ?? a.town ?? a.village ?? a.county ?? a.state_district ?? '';
  const state = normalizeState(a.state ?? '');
  const addressLine1 = [a.house_number, a.road, a.suburb ?? a.neighbourhood].filter(Boolean).join(', ');
  return { postalCode: isValidPostalCode(postalCode) ? postalCode : '', city, state, addressLine1 };
}

export async function detectPlace(): Promise<DetectedPlace> {
  const { lat, lng } = await getCurrentPosition();
  return reverseGeocode(lat, lng);
}

interface PincodeResponse {
  Status: string;
  PostOffice: { District: string; State: string }[] | null;
}

/** Best-effort PIN → city/state via India Post data. Returns null when unknown or the service is unreachable — callers must cope. */
export async function lookupPincode(pin: string): Promise<{ city: string; state: string } | null> {
  if (!isValidPostalCode(pin)) return null;
  try {
    const res = await fetch(`${INDIA_POST_PINCODE}/${pin}`);
    if (!res.ok) return null;
    const body = (await res.json()) as PincodeResponse[];
    const office = body[0]?.Status === 'Success' ? body[0].PostOffice?.[0] : undefined;
    return office ? { city: office.District, state: normalizeState(office.State) } : null;
  } catch {
    return null;
  }
}
