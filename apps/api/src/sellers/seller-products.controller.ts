import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { SellerProductsService } from './seller-products.service';
import { RequireSeller } from './decorators/require-seller.decorator';
import { CurrentSeller } from './decorators/current-seller.decorator';
import { SellerProductInputDto } from './dto/seller-product-input.dto';
import { UpdateSellerProductDto } from './dto/update-seller-product.dto';
import {
  MAX_PRODUCT_MEDIA_FILE_BYTES,
  MAX_PRODUCT_MEDIA_FILES,
} from './seller-product-media-file.util';
import type { Seller } from '@prisma/client';

/**
 * Marketplace Phase 3 — a seller's own product catalog. Every method
 * requires @RequireSeller() (SellerGuard resolves the caller's own Seller
 * row server-side — never a client-supplied sellerId) and every write in
 * SellerProductsService additionally scopes by that seller's id in the
 * query itself, so a product id belonging to another seller (or a
 * Folia-owned product) 404s exactly like a nonexistent one.
 */
@ApiTags('sellers')
@ApiBearerAuth()
@RequireSeller()
@Controller('sellers/me/products')
export class SellerProductsController {
  constructor(private readonly sellerProductsService: SellerProductsService) {}

  @Get()
  @ApiOperation({ summary: "List the authenticated seller's own products." })
  list(@CurrentSeller() seller: Seller) {
    return this.sellerProductsService.listMy(seller);
  }

  @Get(':id')
  @ApiOperation({
    summary: "Get one of the authenticated seller's own products.",
  })
  get(@CurrentSeller() seller: Seller, @Param('id') id: string) {
    return this.sellerProductsService.getMy(seller, id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new DRAFT product.' })
  create(@CurrentSeller() seller: Seller, @Body() dto: SellerProductInputDto) {
    return this.sellerProductsService.createDraft(seller, dto);
  }

  @Patch(':id')
  @ApiOperation({
    summary:
      'Edit a DRAFT (or REJECTED — re-enters DRAFT) product. Not usable once submitted/active/archived.',
  })
  update(
    @CurrentSeller() seller: Seller,
    @Param('id') id: string,
    @Body() dto: UpdateSellerProductDto,
  ) {
    return this.sellerProductsService.updateDraft(seller, id, dto);
  }

  @Post(':id/submit')
  @ApiOperation({ summary: 'Submit a DRAFT product for admin moderation.' })
  submit(@CurrentSeller() seller: Seller, @Param('id') id: string) {
    return this.sellerProductsService.submitForModeration(seller, id);
  }

  @Post(':id/archive')
  @ApiOperation({ summary: 'Archive a live (ACTIVE) product.' })
  archive(@CurrentSeller() seller: Seller, @Param('id') id: string) {
    return this.sellerProductsService.archive(seller, id);
  }

  @Post(':id/media')
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload one or more product photos.' })
  @UseInterceptors(
    FilesInterceptor('files', MAX_PRODUCT_MEDIA_FILES, {
      limits: { fileSize: MAX_PRODUCT_MEDIA_FILE_BYTES },
    }),
  )
  uploadMedia(
    @CurrentSeller() seller: Seller,
    @Param('id') id: string,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    return this.sellerProductsService.uploadMedia(seller, id, files ?? []);
  }

  @Delete(':id/media/:imageId')
  @ApiOperation({ summary: 'Remove one product photo.' })
  deleteMedia(
    @CurrentSeller() seller: Seller,
    @Param('id') id: string,
    @Param('imageId') imageId: string,
  ) {
    return this.sellerProductsService.deleteMedia(seller, id, imageId);
  }
}
