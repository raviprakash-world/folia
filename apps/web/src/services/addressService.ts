import { apiClient } from './apiClient';
import type { Address, AddressInput } from '@/types/address';

export async function fetchAddresses(): Promise<Address[]> {
  const { data } = await apiClient.get<Address[]>('/addresses');
  return data;
}

export async function createAddress(input: AddressInput): Promise<Address> {
  const { data } = await apiClient.post<Address>('/addresses', input);
  return data;
}

export async function updateAddress(id: string, input: AddressInput): Promise<Address> {
  const { data } = await apiClient.put<Address>(`/addresses/${id}`, input);
  return data;
}

export async function deleteAddress(id: string): Promise<void> {
  await apiClient.delete(`/addresses/${id}`);
}
