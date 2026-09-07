import { toAdminSellerRecord, toSellerProfile } from './seller.types';
import type { Seller, SellerAddress, SellerVerification } from '@prisma/client';

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
    rejectedAt: null,
    rejectionNote: null,
    suspendedAt: null,
    deactivatedAt: null,
    statusNote: null,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    ...overrides,
  };
}

function makeAddress(overrides: Partial<SellerAddress> = {}): SellerAddress {
  return {
    id: 'addr-1',
    sellerId: 'seller-1',
    addressLine1: '12 MG Road',
    addressLine2: null,
    city: 'Pune',
    state: 'Maharashtra',
    country: 'India',
    postalCode: '411001',
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    ...overrides,
  };
}

function makeVerification(
  overrides: Partial<SellerVerification> = {},
): SellerVerification {
  return {
    id: 'ver-1',
    sellerId: 'seller-1',
    documentType: 'business-registration',
    documentUrl: '/uploads/seller-verifications/abc.pdf',
    status: 'PENDING',
    reviewedBy: null,
    reviewedAt: null,
    note: null,
    createdAt: new Date('2026-01-01'),
    ...overrides,
  };
}

describe('toSellerProfile', () => {
  it('maps every public-safe field through unchanged, including the address', () => {
    const seller = {
      ...makeSeller({ status: 'ACTIVE' }),
      address: makeAddress(),
    };
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
      address: {
        addressLine1: '12 MG Road',
        addressLine2: null,
        city: 'Pune',
        state: 'Maharashtra',
        country: 'India',
        postalCode: '411001',
      },
      appliedAt: seller.appliedAt,
      approvedAt: seller.approvedAt,
      rejectedAt: seller.rejectedAt,
      rejectionNote: seller.rejectionNote,
      suspendedAt: seller.suspendedAt,
      deactivatedAt: seller.deactivatedAt,
      createdAt: seller.createdAt,
      updatedAt: seller.updatedAt,
    });
  });

  it('maps a missing address to null rather than throwing', () => {
    const profile = toSellerProfile({ ...makeSeller(), address: null });
    expect(profile.address).toBeNull();
  });

  it('never includes userId — an internal linkage, not a field this response exposes', () => {
    const profile = toSellerProfile({ ...makeSeller(), address: null });
    expect(profile).not.toHaveProperty('userId');
  });
});

describe('toAdminSellerRecord', () => {
  it('includes everything toSellerProfile has, plus userId, statusNote, and mapped verifications', () => {
    const seller = {
      ...makeSeller({
        status: 'REJECTED',
        rejectionNote: 'Incomplete address',
      }),
      address: makeAddress(),
      verifications: [makeVerification()],
    };
    const record = toAdminSellerRecord(seller);

    expect(record.userId).toBe('user-1');
    expect(record.status).toBe('REJECTED');
    expect(record.rejectionNote).toBe('Incomplete address');
    expect(record.verifications).toEqual([
      {
        id: 'ver-1',
        documentType: 'business-registration',
        documentUrl: '/uploads/seller-verifications/abc.pdf',
        status: 'PENDING',
        reviewedBy: null,
        reviewedAt: null,
        note: null,
        createdAt: seller.verifications[0].createdAt,
      },
    ]);
  });
});
