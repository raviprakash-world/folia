import { toSellerProfile } from './seller.types';
import type { Seller } from '@prisma/client';

function makeSeller(overrides: Partial<Seller> = {}): Seller {
  return {
    id: 'seller-1',
    userId: 'user-1',
    slug: 'test-seller',
    displayName: 'Test Seller',
    description: 'desc',
    logoUrl: null,
    contactEmail: 'seller@example.com',
    contactPhone: '+91 90000 00000',
    status: 'APPLIED',
    appliedAt: new Date('2026-01-01'),
    approvedAt: null,
    suspendedAt: null,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    ...overrides,
  };
}

describe('toSellerProfile', () => {
  it('maps every public-safe field through unchanged', () => {
    const seller = makeSeller({ status: 'ACTIVE' });
    const profile = toSellerProfile(seller);

    expect(profile).toEqual({
      id: seller.id,
      slug: seller.slug,
      displayName: seller.displayName,
      description: seller.description,
      logoUrl: seller.logoUrl,
      contactEmail: seller.contactEmail,
      contactPhone: seller.contactPhone,
      status: 'ACTIVE',
      appliedAt: seller.appliedAt,
      approvedAt: seller.approvedAt,
      suspendedAt: seller.suspendedAt,
      createdAt: seller.createdAt,
      updatedAt: seller.updatedAt,
    });
  });

  it('never includes userId — an internal linkage, not a field this response exposes', () => {
    const profile = toSellerProfile(makeSeller());
    expect(profile).not.toHaveProperty('userId');
  });
});
