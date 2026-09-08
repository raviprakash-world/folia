import { toPublicSellerOrderGroup } from './seller-order.types';

function rawGroup(overrides: Record<string, unknown> = {}) {
  return {
    id: 'group-1',
    orderId: 'FOL-1',
    status: 'PROCESSING',
    subtotal: 100,
    commissionTotal: 10,
    sellerNote: null,
    createdAt: new Date('2026-01-01'),
    items: [
      {
        id: 'item-1',
        productId: 'prod-1',
        slug: 'monstera',
        name: 'Monstera',
        variantId: null,
        variantLabel: null,
        price: 100,
        quantity: 1,
      },
    ],
    order: {
      deliveryMethod: 'STANDARD' as const,
      shippingAddressSnapshot: {
        id: 'addr-1',
        fullName: 'Jane Buyer',
        phone: '+911234567890',
        email: 'jane@example.com',
        addressLine1: '1 Buyer St',
        city: 'Pune',
        state: 'Maharashtra',
        country: 'India',
        postalCode: '411001',
      },
    },
    ...overrides,
  };
}

describe('toPublicSellerOrderGroup', () => {
  it('computes netProceeds as subtotal - commissionTotal', () => {
    const result = toPublicSellerOrderGroup(rawGroup());
    expect(result.subtotal).toBe(100);
    expect(result.commissionTotal).toBe(10);
    expect(result.netProceeds).toBe(90);
  });

  it('strips the customer email from the shipping address — a seller ships packages, it does not need an off-platform contact channel', () => {
    const result = toPublicSellerOrderGroup(rawGroup());
    expect(result.shippingAddress).not.toHaveProperty('email');
    expect(result.shippingAddress.fullName).toBe('Jane Buyer');
    expect(result.shippingAddress.phone).toBe('+911234567890');
  });

  it("only ever includes items belonging to this group — never another seller's or Folia's lines in the same order", () => {
    const result = toPublicSellerOrderGroup(
      rawGroup({
        items: [
          {
            id: 'item-a',
            productId: 'prod-a',
            slug: 'seller-a-plant',
            name: 'Seller A Plant',
            variantId: null,
            variantLabel: null,
            price: 30,
            quantity: 1,
          },
        ],
      }),
    );
    expect(result.items).toHaveLength(1);
    expect(result.items[0].productId).toBe('prod-a');
  });

  it('passes the private sellerNote through as-is', () => {
    const result = toPublicSellerOrderGroup(
      rawGroup({ sellerNote: 'Packed, ready Tuesday' }),
    );
    expect(result.sellerNote).toBe('Packed, ready Tuesday');
  });
});
