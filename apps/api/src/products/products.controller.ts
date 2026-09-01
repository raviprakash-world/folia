import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ProductsService } from './products.service';
import { ProductQueryDto } from './dto/product-query.dto';
import { toPublicProduct } from './product.types';
import { Public } from '../auth/decorators/public.decorator';
import { ANALYTICS_EVENTS } from '../analytics/analytics.events';

@ApiTags('products')
@Public()
@Controller('products')
export class ProductsController {
  constructor(
    private readonly productsService: ProductsService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  @Get()
  async findMany(@Query() query: ProductQueryDto) {
    const result = await this.productsService.findMany(query);
    return { ...result, items: result.items.map(toPublicProduct) };
  }

  @Get(':slug')
  async findBySlug(@Param('slug') slug: string) {
    const product = await this.productsService.findBySlugOrThrow(slug);

    // KNOWN THIRD-PARTY PACKAGE QUIRK, not unsafe code — tsc itself has
    // zero complaints about this call anywhere in the codebase (verified
    // directly, not assumed). eventemitter2's package.json has no
    // "types" or "exports" field, only a bare "main" pointing at
    // lib/eventemitter2.js, with a root-level eventemitter2.d.ts found
    // via legacy convention. tsc's resolver finds it; typescript-eslint's
    // parser apparently does not, losing the type entirely rather than
    // falling back to `any` (which is why this is "could not be
    // resolved" rather than the usual any-propagation pattern documented
    // throughout this codebase's Prisma-touching files — a different
    // root cause, deliberately not conflated with that one).
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    this.eventEmitter.emit(ANALYTICS_EVENTS.PRODUCT_VIEWED, {
      productId: product.id,
    });
    return toPublicProduct(product);
  }
}
