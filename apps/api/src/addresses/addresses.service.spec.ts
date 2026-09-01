// Same reasoning as auth.service.spec.ts's top-of-file comment.
import { NotFoundException } from '@nestjs/common';
import { AddressesService } from './addresses.service';
import type { AddressInputDto } from './dto/address-input.dto';

function makeAddress(overrides: Record<string, unknown> = {}) {
  return {
    id: 'addr-1',
    userId: 'user-1',
    fullName: 'Sam Rivera',
    phone: '555-0100',
    addressLine1: '123 Main St',
    city: 'Portland',
    state: 'OR',
    country: 'US',
    postalCode: '97201',
    type: 'HOME',
    isDefaultShipping: false,
    isDefaultBilling: false,
    createdAt: new Date(),
    ...overrides,
  };
}

function createDeps() {
  const tx = {
    address: {
      updateMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
  };
  const prisma = {
    $transaction: jest.fn((callback: (t: typeof tx) => unknown) =>
      callback(tx),
    ),
    address: { findMany: jest.fn(), findUnique: jest.fn() },
  };
  const service = new AddressesService(prisma as never);
  return { prisma, tx, service };
}

const VALID_INPUT: AddressInputDto = {
  fullName: 'Sam Rivera',
  phone: '555-0100',
  addressLine1: '123 Main St',
  city: 'Portland',
  state: 'OR',
  country: 'US',
  postalCode: '97201',
  type: 'home',
};

describe('AddressesService — ownership security (the real bug caught and fixed)', () => {
  it("update() throws NotFoundException rather than modifying another user's address, even with a valid address id", async () => {
    const { tx, service } = createDeps();
    tx.address.findUnique.mockResolvedValue(
      makeAddress({ userId: 'someone-else' }),
    );

    await expect(
      service.update('user-1', 'addr-1', VALID_INPUT),
    ).rejects.toThrow(NotFoundException);
    expect(tx.address.update).not.toHaveBeenCalled();
  });

  it("remove() throws NotFoundException rather than deleting another user's address, even with a valid address id", async () => {
    const { tx, service } = createDeps();
    tx.address.findUnique.mockResolvedValue(
      makeAddress({ userId: 'someone-else' }),
    );

    await expect(service.remove('user-1', 'addr-1')).rejects.toThrow(
      NotFoundException,
    );
    expect(tx.address.delete).not.toHaveBeenCalled();
  });

  it("update() succeeds for the address's real owner", async () => {
    const { tx, service } = createDeps();
    tx.address.findUnique.mockResolvedValue(makeAddress({ userId: 'user-1' }));
    tx.address.update.mockResolvedValue(makeAddress({ userId: 'user-1' }));

    await expect(
      service.update('user-1', 'addr-1', VALID_INPUT),
    ).resolves.toBeDefined();
    expect(tx.address.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'addr-1' } }),
    );
  });
});

describe('AddressesService — default exclusivity, matching the mock handler exactly', () => {
  it('creating a new default-shipping address clears the flag on every OTHER address for that user', async () => {
    const { tx, service } = createDeps();
    tx.address.create.mockResolvedValue(
      makeAddress({ isDefaultShipping: true }),
    );

    await service.create('user-1', { ...VALID_INPUT, isDefaultShipping: true });

    expect(tx.address.updateMany).toHaveBeenCalledWith({
      where: {
        userId: 'user-1',
        id: { not: 'addr-1' },
        isDefaultShipping: true,
      },
      data: { isDefaultShipping: false },
    });
  });

  it('does not touch other addresses when the new one is not a default', async () => {
    const { tx, service } = createDeps();
    tx.address.create.mockResolvedValue(makeAddress());

    await service.create('user-1', VALID_INPUT);

    expect(tx.address.updateMany).not.toHaveBeenCalled();
  });
});

describe('AddressesService — delete auto-promotion, matching the mock handler exactly', () => {
  it('promotes the first remaining address when the deleted one was a default', async () => {
    const { tx, service } = createDeps();
    tx.address.findUnique.mockResolvedValue(
      makeAddress({ userId: 'user-1', isDefaultShipping: true }),
    );
    tx.address.delete.mockResolvedValue(
      makeAddress({ isDefaultShipping: true }),
    );
    tx.address.findMany.mockResolvedValue([
      makeAddress({
        id: 'addr-2',
        isDefaultShipping: false,
        isDefaultBilling: false,
      }),
    ]);

    await service.remove('user-1', 'addr-1');

    expect(tx.address.update).toHaveBeenCalledWith({
      where: { id: 'addr-2' },
      data: { isDefaultShipping: true, isDefaultBilling: false },
    });
  });

  it('does nothing extra when the deleted address was not a default', async () => {
    const { tx, service } = createDeps();
    tx.address.findUnique.mockResolvedValue(makeAddress({ userId: 'user-1' })); // not default
    tx.address.delete.mockResolvedValue(makeAddress());

    await service.remove('user-1', 'addr-1');

    expect(tx.address.findMany).not.toHaveBeenCalled();
    expect(tx.address.update).not.toHaveBeenCalled();
  });

  it('does not throw when deleting the last remaining address, even if it was a default', async () => {
    const { tx, service } = createDeps();
    tx.address.findUnique.mockResolvedValue(
      makeAddress({ userId: 'user-1', isDefaultShipping: true }),
    );
    tx.address.delete.mockResolvedValue(
      makeAddress({ isDefaultShipping: true }),
    );
    tx.address.findMany.mockResolvedValue([]); // nothing left to promote

    await expect(service.remove('user-1', 'addr-1')).resolves.toBeUndefined();
    expect(tx.address.update).not.toHaveBeenCalled();
  });
});

describe('AddressesService.findOwnedOrThrow', () => {
  it('throws NotFoundException for an address belonging to another user', async () => {
    const { prisma, service } = createDeps();
    prisma.address.findUnique.mockResolvedValue(
      makeAddress({ userId: 'someone-else' }),
    );

    await expect(service.findOwnedOrThrow('user-1', 'addr-1')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('throws NotFoundException for an id that does not exist at all', async () => {
    const { prisma, service } = createDeps();
    prisma.address.findUnique.mockResolvedValue(null);

    await expect(
      service.findOwnedOrThrow('user-1', 'unknown-id'),
    ).rejects.toThrow(NotFoundException);
  });

  it('returns the address for its real owner', async () => {
    const { prisma, service } = createDeps();
    prisma.address.findUnique.mockResolvedValue(
      makeAddress({ userId: 'user-1' }),
    );

    const result = await service.findOwnedOrThrow('user-1', 'addr-1');
    expect(result.userId).toBe('user-1');
  });
});
