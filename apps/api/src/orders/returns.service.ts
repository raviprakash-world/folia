import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { STORAGE_SERVICE } from '../storage/storage.interface';
import type { StorageService } from '../storage/storage.interface';
import {
  validateEvidenceFile,
  type EvidenceFileLike,
} from './evidence-file.util';
import {
  deriveClaimType,
  isReasonEligibleForClaimType,
  isWithinReturnWindow,
  requiresEvidence,
  type ReturnClaimType,
} from './return-policy.util';
import { RETURN_REASON_TO_DB } from './order.types';
import type { CreateReturnClaimDto } from './dto/create-return-claim.dto';

/**
 * Phase 6D-3 — customer-facing claim CREATION only. Everything downstream
 * of a claim actually existing (admin approval/rejection, refund
 * execution, store-credit issuance, replacement-order creation, reverse
 * logistics) is explicitly out of scope here — see
 * docs/PHASE_6D_MIGRATION_DESIGN.md. A newly created claim always starts
 * PENDING and touches nothing else: no Order.status change, no refund, no
 * store credit, no replacement order. Those are the admin-resolution
 * phase's job.
 */
@Injectable()
export class ReturnsService {
  private readonly logger = new Logger(ReturnsService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(STORAGE_SERVICE) private readonly storageService: StorageService,
  ) {}

  async createClaim(
    userId: string,
    orderId: string,
    dto: CreateReturnClaimDto,
    files: EvidenceFileLike[],
  ) {
    // Ownership is enforced by this WHERE clause itself, matching every
    // other OrdersService method's convention — never a separate
    // fetch-then-compare-userId check, which would be a real TOCTOU/
    // authorization gap (and the exact pattern that lets a customer only
    // ever see/act on their OWN orders, never another customer's).
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, userId },
      include: { items: true, returnRequest: true },
    });
    if (!order) throw new NotFoundException('Order not found.');

    const typedOrder = order as unknown as {
      status: string;
      deliveredAt: Date | null;
      returnRequest: unknown;
      items: { id: string; categorySlug: string; quantity: number }[];
    };

    if (typedOrder.status !== 'DELIVERED') {
      throw new BadRequestException(
        'This order is not eligible for a return — it has not been delivered yet.',
      );
    }
    // A friendly, fast pre-check — ReturnRequest.orderId's own @unique
    // constraint (see the P2002 catch below) is the real, race-proof
    // guarantee that at most one claim can ever exist per order; this
    // check just avoids doing unnecessary evidence-upload work for a
    // request that's certain to be rejected anyway.
    if (typedOrder.returnRequest) {
      throw new BadRequestException(
        'A return or DOA claim already exists for this order.',
      );
    }

    const orderItemsById = new Map(
      typedOrder.items.map((item) => [item.id, item]),
    );
    const seenItemIds = new Set<string>();
    for (const line of dto.items) {
      if (seenItemIds.has(line.orderItemId)) {
        throw new BadRequestException(
          `Order item ${line.orderItemId} was listed more than once in this claim.`,
        );
      }
      seenItemIds.add(line.orderItemId);

      const orderItem = orderItemsById.get(line.orderItemId);
      // Never trust a client-supplied orderItemId in isolation — it must
      // resolve to a real line item on THIS order (found via the map
      // built from `typedOrder.items`, which was itself scoped to this
      // order/user above), closing off both "an item that doesn't exist"
      // and "an item that belongs to someone else's order" the same way.
      if (!orderItem) {
        throw new BadRequestException(
          `Order item ${line.orderItemId} does not belong to this order.`,
        );
      }
      if (line.quantity <= 0) {
        throw new BadRequestException('Quantity must be greater than zero.');
      }
      if (line.quantity > orderItem.quantity) {
        throw new BadRequestException(
          `Cannot claim ${line.quantity} unit(s) of order item ${line.orderItemId} — only ${orderItem.quantity} were purchased on that line.`,
        );
      }
    }

    const selectedItems = dto.items.map((line) =>
      orderItemsById.get(line.orderItemId)!,
    );
    const claimType = deriveClaimType(
      selectedItems.map((item) => ({ categorySlug: item.categorySlug })),
    );
    if (claimType === 'MIXED') {
      throw new BadRequestException(
        'A single claim cannot mix plant and non-plant items — please file two separate claims.',
      );
    }

    const reasonDb = RETURN_REASON_TO_DB[dto.reason];
    if (!isReasonEligibleForClaimType(claimType, reasonDb)) {
      throw new BadRequestException(
        claimType === 'DOA_CLAIM'
          ? `Reason "${dto.reason}" is not valid for a plant DOA/damage claim.`
          : `Reason "${dto.reason}" is not valid for a standard return.`,
      );
    }

    if (!isWithinReturnWindow(claimType, typedOrder.deliveredAt)) {
      throw new BadRequestException(
        claimType === 'DOA_CLAIM'
          ? 'DOA/damage claims must be reported within 24 hours of delivery.'
          : 'This order is outside its 14-day return window.',
      );
    }

    if (requiresEvidence(claimType) && files.length === 0) {
      throw new BadRequestException(
        'Photo or video evidence is required for a DOA/damage claim.',
      );
    }

    // Validate every file BEFORE uploading any of them — fail fast rather
    // than storing files 1..k only to reject on file k+1.
    for (const file of files) {
      validateEvidenceFile(file);
    }

    // Uploads happen before the ReturnRequest row is created — Prisma's
    // nested `evidence: { create: [...] }` write needs the real stored
    // URLs ready at that point, and restructuring to create a bare
    // (evidence-less) row first, then attach evidence, then roll back on
    // upload failure would trade this gap for a worse one: a real window
    // where a PENDING DOA claim persists with no evidence at all,
    // visible to anything that reads ReturnRequest rows. Given that
    // trade-off, uploading first and cleaning up on any failure below is
    // the safer shape — see docs/PHASE_6D_MIGRATION_DESIGN.md.
    //
    // `uploaded` tracks exactly what THIS request's own upload calls
    // produced, so cleanup below can never touch a file belonging to a
    // different (successful) claim.
    const uploaded: { url: string; key: string }[] = [];
    try {
      for (const file of files) {
        const result = await this.storageService.upload({
          buffer: file.buffer,
          originalName: file.originalname,
          mimetype: file.mimetype,
          directory: 'return-evidence',
        });
        uploaded.push(result);
      }

      const created = await this.prisma.returnRequest.create({
        data: {
          orderId,
          claimType,
          reason: reasonDb,
          note: dto.note,
          status: 'PENDING',
          items: {
            create: dto.items.map((line) => ({
              orderItemId: line.orderItemId,
              quantity: line.quantity,
            })),
          },
          evidence: {
            create: uploaded.map((u) => ({ url: u.url })),
          },
        },
        include: { items: true, evidence: true },
      });

      return this.toPublicClaim(created, claimType, dto.reason);
    } catch (err) {
      // Anything that failed here — a storage error partway through the
      // upload loop, or the create() call itself — leaves behind
      // whatever this request DID successfully upload before failing,
      // with nothing in the database ever pointing at it. Best-effort:
      // failing to delete an orphan is logged and swallowed, never
      // allowed to replace or mask the real error below (a cleanup
      // failure must not turn a clean 400 concurrency rejection, or any
      // other real error, into an unrelated 500).
      await this.cleanupUploadedEvidence(uploaded.map((u) => u.key));

      // Two concurrent requests racing to create the ONE-AND-ONLY
      // ReturnRequest a given order can ever have (orderId is @unique —
      // a deliberate Phase 6D-1 design choice, see
      // docs/PHASE_6D_MIGRATION_DESIGN.md) collide here: Postgres commits
      // exactly one insert and rejects the other with a real constraint
      // violation. Caught and converted to the same clean 400 this
      // codebase already uses for the identical race on
      // CancellationRequest (OrdersService.requestCancellation) — never a
      // raw database error surfaced to the client.
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        throw new BadRequestException(
          'A return or DOA claim already exists for this order.',
        );
      }
      throw err;
    }
  }

  /**
   * Best-effort only — see the doc comment at its call site above for why
   * a cleanup failure here must never propagate. `keys` is always this
   * one request's own upload results, never shared/global state, so this
   * can never delete a file another (successful) claim now references.
   */
  private async cleanupUploadedEvidence(keys: string[]): Promise<void> {
    for (const key of keys) {
      try {
        await this.storageService.delete(key);
      } catch (err) {
        this.logger.warn(
          `Could not clean up orphaned evidence file ${key} after a lost/failed claim creation: ${err instanceof Error ? err.message : 'unknown error'}`,
        );
      }
    }
  }

  private toPublicClaim(
    created: {
      id: string;
      orderId: string;
      status: string;
      note: string | null;
      requestedAt: Date;
      items: { orderItemId: string; quantity: number }[];
      evidence: { url: string }[];
    },
    claimType: ReturnClaimType,
    reason: string,
  ) {
    return {
      id: created.id,
      orderId: created.orderId,
      claimType: claimType === 'DOA_CLAIM' ? 'doa-claim' : 'standard-return',
      status: created.status.toLowerCase(),
      reason,
      note: created.note,
      items: created.items.map((item) => ({
        orderItemId: item.orderItemId,
        quantity: item.quantity,
      })),
      evidence: created.evidence.map((e) => ({ url: e.url })),
      requestedAt: created.requestedAt.toISOString(),
    };
  }
}
