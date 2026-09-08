import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { CategoryRecord } from '../products/product.types';

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAllByType(
    type: 'CATEGORY' | 'COLLECTION',
  ): Promise<CategoryRecord[]> {
    return this.prisma.category.findMany({
      where: { type },
      orderBy: { name: 'asc' },
    });
  }

  async findBySlugAndTypeOrThrow(
    slug: string,
    type: 'CATEGORY' | 'COLLECTION',
  ): Promise<CategoryRecord> {
    const category = await this.prisma.category.findFirst({
      where: { slug, type },
    });
    if (!category) {
      throw new NotFoundException(
        type === 'CATEGORY' ? 'Category not found' : 'Collection not found',
      );
    }
    return category;
  }
}
