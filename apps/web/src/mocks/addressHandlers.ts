import { http, HttpResponse, delay } from 'msw';
import type { Address, AddressInput } from '@/types/address';

const ADDRESS_DELAY_MS = 400;

// Session-scoped mutable "database" — seeded with one address so the
// dashboard isn't empty on first look, resets on reload like every other
// MSW mock in this project.
let addresses: Address[] = [
  {
    id: 'addr1',
    fullName: 'Sam Rivera',
    phone: '(555) 019-2043',
    email: 'demo@folia.example',
    addressLine1: '412 Alder Street',
    addressLine2: 'Apt 3B',
    landmark: 'Near Alder Park',
    deliveryInstructions: 'Leave with the front desk if no answer.',
    city: 'Portland',
    state: 'OR',
    country: 'US',
    postalCode: '97205',
    type: 'home',
    label: 'Home',
    preferredTimeSlot: 'evening',
    isDefaultShipping: true,
    isDefaultBilling: true,
  },
];

function applyDefaultExclusivity(list: Address[], changedId: string, field: 'isDefaultShipping' | 'isDefaultBilling') {
  return list.map((a) => (a.id === changedId ? a : { ...a, [field]: false }));
}

export const addressHandlers = [
  http.get('/api/addresses', async () => {
    await delay(ADDRESS_DELAY_MS);
    return HttpResponse.json(addresses);
  }),

  http.post('/api/addresses', async ({ request }) => {
    await delay(ADDRESS_DELAY_MS);
    const body = (await request.json()) as AddressInput;
    const newAddress: Address = { ...body, id: `addr${Date.now()}` };

    let next = [...addresses, newAddress];
    if (newAddress.isDefaultShipping) next = applyDefaultExclusivity(next, newAddress.id, 'isDefaultShipping');
    if (newAddress.isDefaultBilling) next = applyDefaultExclusivity(next, newAddress.id, 'isDefaultBilling');
    addresses = next;

    return HttpResponse.json(newAddress, { status: 201 });
  }),

  http.put('/api/addresses/:id', async ({ request, params }) => {
    await delay(ADDRESS_DELAY_MS);
    const body = (await request.json()) as AddressInput;
    const id = params.id as string;

    if (!addresses.some((a) => a.id === id)) {
      return HttpResponse.json({ message: 'Address not found.' }, { status: 404 });
    }

    let next = addresses.map((a) => (a.id === id ? { ...body, id } : a));
    if (body.isDefaultShipping) next = applyDefaultExclusivity(next, id, 'isDefaultShipping');
    if (body.isDefaultBilling) next = applyDefaultExclusivity(next, id, 'isDefaultBilling');
    addresses = next;

    const updated = addresses.find((a) => a.id === id)!;
    return HttpResponse.json(updated);
  }),

  http.delete('/api/addresses/:id', async ({ params }) => {
    await delay(ADDRESS_DELAY_MS);
    const id = params.id as string;
    const target = addresses.find((a) => a.id === id);

    if (!target) {
      return HttpResponse.json({ message: 'Address not found.' }, { status: 404 });
    }

    addresses = addresses.filter((a) => a.id !== id);

    // If the deleted address was a default, auto-promote the first remaining
    // address so there's never a silently-defaultless address book.
    if ((target.isDefaultShipping || target.isDefaultBilling) && addresses.length > 0) {
      addresses = addresses.map((a, i) =>
        i === 0
          ? {
              ...a,
              isDefaultShipping: target.isDefaultShipping ? true : a.isDefaultShipping,
              isDefaultBilling: target.isDefaultBilling ? true : a.isDefaultBilling,
            }
          : a
      );
    }

    return HttpResponse.json({ ok: true });
  }),
];
