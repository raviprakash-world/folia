/* eslint-disable @typescript-eslint/no-unsafe-assignment */
// Same reasoning as auth.service.spec.ts's top-of-file comment.
import { ConflictException, NotFoundException } from '@nestjs/common';
import { WarehousesService } from './warehouses.service';

function createMockPrisma() {
  const tx = { warehouse: { updateMany: jest.fn(), create: jest.fn() } };
  const prisma = {
    $transaction: jest.fn((callback: (t: typeof tx) => unknown) =>
      callback(tx),
    ),
    warehouse: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
    },
  };
  return { prisma, tx };
}

describe('WarehousesService', () => {
  it('findByCodeOrThrow throws NotFoundException for an unknown code', async () => {
    const { prisma } = createMockPrisma();
    prisma.warehouse.findUnique.mockResolvedValue(null);
    const service = new WarehousesService(prisma as never);
    await expect(service.findByCodeOrThrow('UNKNOWN')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('rejects creating a warehouse with a code that already exists', async () => {
    const { prisma } = createMockPrisma();
    prisma.warehouse.findUnique.mockResolvedValue({ id: 'wh-1', code: 'MAIN' });
    const service = new WarehousesService(prisma as never);
    await expect(
      service.create({ code: 'MAIN', name: 'Duplicate' }),
    ).rejects.toThrow(ConflictException);
  });

  it('creating a non-default warehouse does not touch other warehouses default flags', async () => {
    const { prisma, tx } = createMockPrisma();
    prisma.warehouse.findUnique.mockResolvedValue(null);
    prisma.warehouse.create.mockResolvedValue({
      id: 'wh-2',
      code: 'SECOND',
      name: 'Second',
      isDefault: false,
    });
    const service = new WarehousesService(prisma as never);

    await service.create({ code: 'SECOND', name: 'Second' });

    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(tx.warehouse.updateMany).not.toHaveBeenCalled();
  });

  it('creating a new default warehouse clears the flag on every other warehouse first, in one transaction', async () => {
    const { prisma, tx } = createMockPrisma();
    prisma.warehouse.findUnique.mockResolvedValue(null);
    tx.warehouse.create.mockResolvedValue({
      id: 'wh-2',
      code: 'SECOND',
      name: 'Second',
      isDefault: true,
    });
    const service = new WarehousesService(prisma as never);

    await service.create({ code: 'SECOND', name: 'Second', isDefault: true });

    expect(tx.warehouse.updateMany).toHaveBeenCalledWith({
      where: { isDefault: true },
      data: { isDefault: false },
    });
    expect(tx.warehouse.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ code: 'SECOND', isDefault: true }),
    });
  });
});
