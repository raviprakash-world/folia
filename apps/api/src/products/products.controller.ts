import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ProductsService } from './products.service';
import { ProductQueryDto } from './dto/product-query.dto';
import { toPublicProduct } from './product.types';
import { Public } from '../auth/decorators/public.decorator';

@ApiTags('products')
@Public()
@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  async findMany(@Query() query: ProductQueryDto) {
    const result = await this.productsService.findMany(query);
    return { ...result, items: result.items.map(toPublicProduct) };
  }

  @Get(':slug')
  async findBySlug(@Param('slug') slug: string) {
    const product = await this.productsService.findBySlugOrThrow(slug);
    return toPublicProduct(product);
  }
}
