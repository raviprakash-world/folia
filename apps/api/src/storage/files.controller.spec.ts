import {
  ForbiddenException,
  NotFoundException,
  StreamableFile,
} from '@nestjs/common';
import { Readable } from 'stream';
import { FilesController } from './files.controller';
import type { PrismaService } from '../prisma/prisma.service';
import type { AuthenticatedUser } from '../users/user.types';

/**
 * P0-D — the retrieval half of the P0-C-flagged critical storage gap.
 * Covers exactly what makes return-evidence/seller-verifications
 * different from a bare static mount: ownership must be checked
 * per-request against the real DB relation, not inferred from the URL
 * alone.
 */
describe('FilesController', () => {
  function makeUser(
    overrides: Partial<AuthenticatedUser> = {},
  ): AuthenticatedUser {
    return {
      id: 'user-1',
      firstName: 'Sam',
      lastName: 'Rivera',
      email: 'sam@example.com',
      role: 'customer',
      permissions: [],
      ...overrides,
    };
  }

  function createController() {
    const prisma = {
      returnEvidence: { findFirst: jest.fn() },
      sellerVerification: { findFirst: jest.fn() },
    };
    const storage = {
      upload: jest.fn(),
      delete: jest.fn(),
      createReadStream: jest.fn().mockResolvedValue(Readable.from(['x'])),
    };
    const controller = new FilesController(
      prisma as unknown as PrismaService,
      storage,
    );
    return { controller, prisma, storage };
  }

  describe('getAvatar / getProductMedia', () => {
    it('streams a public avatar with no ownership check', async () => {
      const { controller, storage } = createController();
      const result = await controller.getAvatar('photo.png');
      expect(result).toBeInstanceOf(StreamableFile);
      expect(storage.createReadStream).toHaveBeenCalledWith(
        'avatars/photo.png',
      );
    });

    it('rejects a filename containing a path-traversal segment', async () => {
      const { controller, storage } = createController();
      await expect(controller.getAvatar('../../etc/passwd')).rejects.toThrow(
        'Invalid filename.',
      );
      expect(storage.createReadStream).not.toHaveBeenCalled();
    });

    it('streams public product media with no ownership check', async () => {
      const { controller, storage } = createController();
      const result = await controller.getProductMedia('shot.jpg');
      expect(result).toBeInstanceOf(StreamableFile);
      expect(storage.createReadStream).toHaveBeenCalledWith(
        'product-media/shot.jpg',
      );
    });
  });

  describe('getReturnEvidence', () => {
    it('404s when no ReturnEvidence row matches the URL', async () => {
      const { controller, prisma } = createController();
      prisma.returnEvidence.findFirst.mockResolvedValue(null);
      await expect(
        controller.getReturnEvidence(makeUser(), 'missing.jpg'),
      ).rejects.toThrow(NotFoundException);
    });

    it('serves the file to the claim-owning customer', async () => {
      const { controller, prisma, storage } = createController();
      prisma.returnEvidence.findFirst.mockResolvedValue({
        returnRequest: { order: { userId: 'user-1' } },
      });
      const result = await controller.getReturnEvidence(
        makeUser({ id: 'user-1' }),
        'evidence.jpg',
      );
      expect(result).toBeInstanceOf(StreamableFile);
      expect(storage.createReadStream).toHaveBeenCalledWith(
        'return-evidence/evidence.jpg',
      );
    });

    it('serves the file to an admin who is not the claim owner', async () => {
      const { controller, prisma } = createController();
      prisma.returnEvidence.findFirst.mockResolvedValue({
        returnRequest: { order: { userId: 'someone-else' } },
      });
      await expect(
        controller.getReturnEvidence(
          makeUser({ id: 'admin-1', role: 'admin' }),
          'evidence.jpg',
        ),
      ).resolves.toBeInstanceOf(StreamableFile);
    });

    it('rejects a different customer with 403, not 404 — confirms this is a real ownership check, not just existence', async () => {
      const { controller, prisma, storage } = createController();
      prisma.returnEvidence.findFirst.mockResolvedValue({
        returnRequest: { order: { userId: 'the-actual-owner' } },
      });
      await expect(
        controller.getReturnEvidence(
          makeUser({ id: 'a-different-customer' }),
          'evidence.jpg',
        ),
      ).rejects.toThrow(ForbiddenException);
      expect(storage.createReadStream).not.toHaveBeenCalled();
    });
  });

  describe('getSellerVerification', () => {
    it('404s when no SellerVerification row matches the URL', async () => {
      const { controller, prisma } = createController();
      prisma.sellerVerification.findFirst.mockResolvedValue(null);
      await expect(
        controller.getSellerVerification(makeUser(), 'missing.pdf'),
      ).rejects.toThrow(NotFoundException);
    });

    it('serves the file to the owning seller', async () => {
      const { controller, prisma, storage } = createController();
      prisma.sellerVerification.findFirst.mockResolvedValue({
        seller: { userId: 'user-1' },
      });
      const result = await controller.getSellerVerification(
        makeUser({ id: 'user-1', role: 'seller' }),
        'doc.pdf',
      );
      expect(result).toBeInstanceOf(StreamableFile);
      expect(storage.createReadStream).toHaveBeenCalledWith(
        'seller-verifications/doc.pdf',
      );
    });

    it('rejects a different seller with 403 — the most sensitive of the four upload types', async () => {
      const { controller, prisma, storage } = createController();
      prisma.sellerVerification.findFirst.mockResolvedValue({
        seller: { userId: 'seller-a-user' },
      });
      await expect(
        controller.getSellerVerification(
          makeUser({ id: 'seller-b-user', role: 'seller' }),
          'doc.pdf',
        ),
      ).rejects.toThrow(ForbiddenException);
      expect(storage.createReadStream).not.toHaveBeenCalled();
    });

    it('serves the file to an admin who is not the owning seller', async () => {
      const { controller, prisma } = createController();
      prisma.sellerVerification.findFirst.mockResolvedValue({
        seller: { userId: 'seller-a-user' },
      });
      await expect(
        controller.getSellerVerification(
          makeUser({ id: 'admin-1', role: 'admin' }),
          'doc.pdf',
        ),
      ).resolves.toBeInstanceOf(StreamableFile);
    });
  });
});
