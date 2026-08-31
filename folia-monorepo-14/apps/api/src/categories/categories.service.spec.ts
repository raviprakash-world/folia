import { CategoriesService } from './categories.service';

describe('CategoriesService', () => {
  it('findAllByType filters by the given type', async () => {
    const prisma = { category: { findMany: jest.fn().mockResolvedValue([]) } };
    const service = new CategoriesService(prisma as never);
    await service.findAllByType('CATEGORY');
    expect(prisma.category.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { type: 'CATEGORY' } }),
    );
  });

  it('findBySlugAndTypeOrThrow gives a distinct 404 message for categories vs collections', async () => {
    const prisma = {
      category: { findFirst: jest.fn().mockResolvedValue(null) },
    };
    const service = new CategoriesService(prisma as never);

    await expect(
      service.findBySlugAndTypeOrThrow('x', 'CATEGORY'),
    ).rejects.toThrow(/Category not found/);
    await expect(
      service.findBySlugAndTypeOrThrow('x', 'COLLECTION'),
    ).rejects.toThrow(/Collection not found/);
  });

  it('findBySlugAndTypeOrThrow returns the record when found', async () => {
    const record = {
      id: '1',
      slug: 'plants',
      name: 'Plants',
      description: 'x',
      type: 'CATEGORY',
    };
    const prisma = {
      category: { findFirst: jest.fn().mockResolvedValue(record) },
    };
    const service = new CategoriesService(prisma as never);
    await expect(
      service.findBySlugAndTypeOrThrow('plants', 'CATEGORY'),
    ).resolves.toEqual(record);
  });
});
