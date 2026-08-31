import { apiClient } from './apiClient';
import type { Address, AddressInput } from '@/types/address';

export async function fetchAddresses(): Promise<Address[]> {
  const { data } = await apiClient.get<Address[]>('/addresses');
  return data;
}

/**
 * geo is stripped before every write — it's a read-only field the
 * server computes from geoLat/geoLng when reading an address, never
 * something the client should send. The real backend's DTO validation
 * genuinely rejects it (property geo should not exist — a real 400,
 * caught live rather than assumed away); the mock backend doesn't
 * enforce this distinction, but the fix is correct regardless of which
 * backend is in use, not a workaround specific to the real one.
 */
function stripGeoForWrite(input: AddressInput): Omit<AddressInput, 'geo'> {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- destructuring-to-omit is the idiomatic way to drop one field; the unused binding is the point, not an oversight.
  const { geo: _geo, ...rest } = input;
  return rest;
}

export async function createAddress(input: AddressInput): Promise<Address> {
  const { data } = await apiClient.post<Address>('/addresses', stripGeoForWrite(input));
  return data;
}

export async function updateAddress(id: string, input: AddressInput): Promise<Address> {
  const { data } = await apiClient.put<Address>(`/addresses/${id}`, stripGeoForWrite(input));
  return data;
}

export async function deleteAddress(id: string): Promise<void> {
  await apiClient.delete(`/addresses/${id}`);
}
