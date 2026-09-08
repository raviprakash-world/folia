import {
  BadRequestException,
  Controller,
  ForbiddenException,
  Get,
  Inject,
  NotFoundException,
  Param,
  StreamableFile,
} from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { Public } from '../auth/decorators/public.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { STORAGE_SERVICE } from './storage.interface';
import type { StorageService } from './storage.interface';
import { mimeFromExtension } from './mime-from-extension.util';
import type { AuthenticatedUser } from '../users/user.types';

/**
 * P0-D — the retrieval half of the storage security boundary P0-C
 * audited and flagged as a critical blocker: LocalStorageService wrote
 * files and returned URLs, but nothing served them back. This is the
 * one HTTP-layer difference between this file's two directory pairs:
 * avatars/product-media are meant to be public storefront content
 * (@Public(), no ownership check — matches the P0-C security
 * assessment of these two directories exactly); return-evidence and
 * seller-verifications are private (real KYC-type business documents
 * and dispute evidence) and require the requester to be the owning
 * customer/seller or an admin — never a bare static file mount, which
 * P0-C's own audit explicitly warned against for these two.
 *
 * URL shape mounted at `/api/uploads/:directory/:filename` — matches
 * LocalStorageService.upload()'s own returned URL exactly, and rides
 * the frontend's existing `/api/*` proxy (apps/web/vite.config.ts,
 * vercel.json) rather than needing a new one.
 */
@ApiExcludeController()
@Controller({ path: 'uploads', version: '1' })
export class FilesController {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(STORAGE_SERVICE) private readonly storage: StorageService,
  ) {}

  private assertSafeFilename(filename: string) {
    // Defense in depth's first layer — see local-storage.service.ts's
    // createReadStream for the second (path-containment) layer, which
    // is the one that actually matters if this one is ever bypassed.
    if (
      filename.includes('..') ||
      filename.includes('/') ||
      filename.includes('\\')
    ) {
      throw new BadRequestException('Invalid filename.');
    }
  }

  private async stream(key: string, filename: string): Promise<StreamableFile> {
    const readable = await this.storage.createReadStream(key);
    return new StreamableFile(readable, { type: mimeFromExtension(filename) });
  }

  @Public()
  @Get('avatars/:filename')
  async getAvatar(
    @Param('filename') filename: string,
  ): Promise<StreamableFile> {
    this.assertSafeFilename(filename);
    return this.stream(`avatars/${filename}`, filename);
  }

  @Public()
  @Get('product-media/:filename')
  async getProductMedia(
    @Param('filename') filename: string,
  ): Promise<StreamableFile> {
    this.assertSafeFilename(filename);
    return this.stream(`product-media/${filename}`, filename);
  }

  @Get('return-evidence/:filename')
  async getReturnEvidence(
    @CurrentUser() user: AuthenticatedUser,
    @Param('filename') filename: string,
  ): Promise<StreamableFile> {
    this.assertSafeFilename(filename);
    const url = `/api/uploads/return-evidence/${filename}`;
    const evidence = await this.prisma.returnEvidence.findFirst({
      where: { url },
      select: {
        returnRequest: { select: { order: { select: { userId: true } } } },
      },
    });
    if (!evidence) throw new NotFoundException('File not found.');
    const isOwner = evidence.returnRequest.order.userId === user.id;
    if (!isOwner && user.role !== 'admin') {
      throw new ForbiddenException('You do not have access to this file.');
    }
    return this.stream(`return-evidence/${filename}`, filename);
  }

  @Get('seller-verifications/:filename')
  async getSellerVerification(
    @CurrentUser() user: AuthenticatedUser,
    @Param('filename') filename: string,
  ): Promise<StreamableFile> {
    this.assertSafeFilename(filename);
    const url = `/api/uploads/seller-verifications/${filename}`;
    const verification = await this.prisma.sellerVerification.findFirst({
      where: { documentUrl: url },
      select: { seller: { select: { userId: true } } },
    });
    if (!verification) throw new NotFoundException('File not found.');
    const isOwner = verification.seller.userId === user.id;
    if (!isOwner && user.role !== 'admin') {
      throw new ForbiddenException('You do not have access to this file.');
    }
    return this.stream(`seller-verifications/${filename}`, filename);
  }
}
