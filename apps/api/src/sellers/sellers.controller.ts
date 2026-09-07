import {
  Body,
  Controller,
  Get,
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
import { SellersService } from './sellers.service';
import { RequireSeller } from './decorators/require-seller.decorator';
import { CurrentSeller } from './decorators/current-seller.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ApplySellerDto } from './dto/apply-seller.dto';
import { UpdateSellerDto } from './dto/update-seller.dto';
import { UploadVerificationDto } from './dto/upload-verification.dto';
import { MAX_VERIFICATION_FILES } from './seller-verification-file.util';
import type { AuthenticatedUser } from '../users/user.types';
import type { Seller } from '@prisma/client';

/**
 * Marketplace Phase 2 — the customer-facing seller-onboarding surface.
 * Admin moderation (approve/reject/suspend/reactivate/deactivate) lives in
 * AdminSellersController, mirroring how AdminReturnsController is kept
 * separate from OrdersController's own customer-facing return endpoints.
 */
@ApiTags('sellers')
@ApiBearerAuth()
@Controller('sellers')
export class SellersController {
  constructor(private readonly sellersService: SellersService) {}

  @Post('apply')
  @ApiOperation({ summary: 'Apply to become a marketplace seller.' })
  apply(@CurrentUser() user: AuthenticatedUser, @Body() dto: ApplySellerDto) {
    return this.sellersService.apply(user.id, dto);
  }

  @Get('me')
  @RequireSeller()
  @ApiOperation({
    summary: "Get the authenticated user's own seller profile.",
  })
  getMyProfile(@CurrentSeller() seller: Seller) {
    return this.sellersService.getMyProfile(seller.id);
  }

  @Patch('me')
  @RequireSeller()
  @ApiOperation({
    summary:
      "Update the authenticated user's own seller profile. Editing while REJECTED re-enters the review queue.",
  })
  updateMyProfile(
    @CurrentSeller() seller: Seller,
    @Body() dto: UpdateSellerDto,
  ) {
    return this.sellersService.updateProfile(seller.id, dto);
  }

  @Get('me/verifications')
  @RequireSeller()
  @ApiOperation({
    summary: "List the authenticated user's own verification documents.",
  })
  listMyVerifications(@CurrentSeller() seller: Seller) {
    return this.sellersService.listMyVerifications(seller.id);
  }

  @Post('me/verifications')
  @RequireSeller()
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary:
      'Upload one or more verification documents (images or PDFs) for the authenticated seller.',
  })
  @UseInterceptors(FilesInterceptor('files', MAX_VERIFICATION_FILES))
  uploadVerification(
    @CurrentSeller() seller: Seller,
    @Body() dto: UploadVerificationDto,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    return this.sellersService.uploadVerification(
      seller.id,
      dto.documentType,
      files ?? [],
    );
  }
}
