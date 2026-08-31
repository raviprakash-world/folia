import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CategoriesService } from './categories.service';
import { toPublicCategory } from '../products/product.types';
import { Public } from '../auth/decorators/public.decorator';

@ApiTags('categories')
@Public()
@Controller()
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Get('categories')
  async findAllCategories() {
    const categories = await this.categoriesService.findAllByType('CATEGORY');
    return categories.map(toPublicCategory);
  }

  @Get('collections/:slug')
  async findCollectionBySlug(@Param('slug') slug: string) {
    const collection = await this.categoriesService.findBySlugAndTypeOrThrow(
      slug,
      'COLLECTION',
    );
    return toPublicCategory(collection);
  }
}
