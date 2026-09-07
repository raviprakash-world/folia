import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { PaymentsService } from '../payments/payments.service';
import { InventoryService } from '../inventory/inventory.service';
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
  calculateRefundAmount,
  defaultRequiresReverseLogistics,
  type ReturnClaimType,
} from './return-policy.util';
import { RETURN_REASON_TO_DB, returnReasonToPublic } from './order.types';
import { generateOrderId } from './order-id.util';
import type { CreateReturnClaimDto } from './dto/create-return-claim.dto';
import type { ApproveReturnDto } from './dto/approve-return.dto';
import type { RejectReturnDto } from './dto/reject-return.dto';
import type { AdminReturnsQueryDto } from './dto/admin-returns-query.dto';
import { NOTIFICATION_EVENTS } from '../notifications/notification.events';
import type {
  ReturnApprovedPayload,
  ReturnRejectedPayload,
  StoreCreditIssuedPayload,
  ReplacementIssuedPayload,
} from '../notifications/notification.events';

/** DB enum -> public API string, both directions — covers every ReturnRequestStatus value, even the ones no code can reach yet (REFUND_ISSUED/STORE_CREDIT_ISSUED/REPLACEMENT_ISSUED are Phase 6D-4B+'s job), so the admin list/detail responses stay honest if a caller ever filters on one. */
const RETURN_STATUS_TO_PUBLIC: Record<string, string> = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  REFUND_ISSUED: 'refund-issued',
  STORE_CREDIT_ISSUED: 'store-credit-issued',
  REPLACEMENT_ISSUED: 'replacement-issued',
};
const RETURN_STATUS_FROM_PUBLIC: Record<string, string> = Object.fromEntries(
  Object.entries(RETURN_STATUS_TO_PUBLIC).map(([db, pub]) => [pub, db]),
);

const ADMIN_RETURN_INCLUDE = {
  items: {
    include: {
      orderItem: {
        select: { name: true, price: true, quantity: true },
      },
    },
  },
  evidence: { select: { url: true, createdAt: true } },
  order: {
    select: {
      id: true,
      total: true,
      deliveredAt: true,
      user: {
        select: { id: true, firstName: true, lastName: true, email: true },
      },
    },
  },
  storeCreditEntry: { select: { id: true } },
} satisfies Prisma.ReturnRequestInclude;

type AdminReturnRequestRow = Prisma.ReturnRequestGetPayload<{
  include: typeof ADMIN_RETURN_INCLUDE;
}>;

/**
 * Phase 6D-4B — a separate, narrower include for the resolution methods'
 * own internal calculation/branching needs (order pricing snapshot,
 * payment method, the real Payment row to refund). Kept distinct from
 * ADMIN_RETURN_INCLUDE deliberately: the admin list/detail response has
 * no reason to expose raw subtotal/discount/tax or the linked Payment's
 * internals, and this include has no reason to fetch the customer's
 * name/email.
 */
const RESOLUTION_INCLUDE = {
  items: {
    include: {
      orderItem: {
        select: {
          price: true,
          quantity: true,
          // Phase 6D-4C additions — a replacement order's own OrderItem
          // rows need this product snapshot; the refund/credit paths never
          // read these fields, so their presence is harmless there.
          productId: true,
          slug: true,
          name: true,
          categorySlug: true,
          variantId: true,
          variantLabel: true,
        },
      },
    },
  },
  order: {
    select: {
      id: true,
      userId: true,
      subtotal: true,
      discount: true,
      tax: true,
      paymentMethod: true,
      payment: { select: { id: true } },
      // Phase 6D-4C additions — a replacement order ships to the same
      // place on the same terms as the original; refund/credit never read
      // these.
      shippingAddressSnapshot: true,
      billingAddressSnapshot: true,
      deliveryMethod: true,
      estimatedDelivery: true,
    },
  },
} satisfies Prisma.ReturnRequestInclude;

type ResolutionRow = Prisma.ReturnRequestGetPayload<{
  include: typeof RESOLUTION_INCLUDE;
}>;

/**
 * Phase 6D-4C — thrown (and caught) purely internally by
 * resolveReplacement() to force its transaction to roll back when the
 * final conditional ReturnRequest update loses the replacement-creation
 * race, distinguishing that from a genuine failure worth an audit log.
 */
class LostReplacementRaceError extends Error {}

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
    private readonly eventEmitter: EventEmitter2,
    private readonly auditService: AuditService,
    private readonly paymentsService: PaymentsService,
    private readonly inventoryService: InventoryService,
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

  // --- Phase 6D-4A: admin queue, detail, approve/reject ---
  //
  // Deliberately does NOT execute any resolution here — approve/reject
  // only record the administrative decision (who, when, and — for a
  // rejection — why). Refund execution, store-credit issuance,
  // replacement-order creation, and reverse logistics are explicitly a
  // later phase's job (see docs/PHASE_6D_MIGRATION_DESIGN.md); nothing
  // below ever calls PaymentsService, StoreCreditEntry, or creates an
  // Order.

  /**
   * Defaults to the PENDING queue (see AdminReturnsQueryDto) — an admin
   * can pass another status to review already-decided claims, but "the
   * queue" itself is what needs action. Ordered oldest-first: unlike
   * every other list in this codebase (which shows newest-first), a work
   * queue's whole point is surfacing what's been waiting longest.
   */
  async adminListClaims(
    query: AdminReturnsQueryDto,
  ): Promise<{ items: unknown[]; total: number }> {
    const dbStatus = RETURN_STATUS_FROM_PUBLIC[query.status];
    const clampedPageSize = Math.min(query.pageSize, 50);
    const where = {
      status: dbStatus as Prisma.ReturnRequestWhereInput['status'],
    };

    const [rows, total] = await Promise.all([
      this.prisma.returnRequest.findMany({
        where,
        include: ADMIN_RETURN_INCLUDE,
        orderBy: { requestedAt: 'asc' },
        skip: (query.page - 1) * clampedPageSize,
        take: clampedPageSize,
      }),
      this.prisma.returnRequest.count({ where }),
    ]);

    return { items: rows.map((row) => this.toAdminRecord(row)), total };
  }

  async adminGetClaim(id: string) {
    const row = await this.prisma.returnRequest.findUnique({
      where: { id },
      include: ADMIN_RETURN_INCLUDE,
    });
    if (!row) throw new NotFoundException('Return request not found.');
    return this.toAdminRecord(row);
  }

  /**
   * PENDING -> APPROVED. The `updateMany` with a `status: 'PENDING'`
   * precondition is the same atomic-conditional-transition idiom this
   * codebase already established for PaymentsService.confirmCapture's
   * CREATED -> CAPTURED move and PaymentsService.expireStalePayments'
   * CREATED -> EXPIRED sweep: Postgres serializes concurrent UPDATEs to
   * the same row, so of two simultaneous approve/reject calls for the
   * same claim, exactly one's WHERE clause still matches (count: 1) and
   * commits; the other's matches nothing (count: 0) and is rejected
   * cleanly below — no explicit row lock needed, the same reasoning as
   * those two existing methods.
   */
  async adminApprove(
    adminId: string,
    id: string,
    dto: ApproveReturnDto,
    ipAddress?: string,
  ) {
    // claimType is immutable once a claim is created, so reading it here
    // ahead of the atomic transition below is safe — it cannot change
    // concurrently underneath either check that uses it.
    const existing = await this.prisma.returnRequest.findUnique({
      where: { id },
      select: { claimType: true },
    });
    if (!existing) throw new NotFoundException('Return request not found.');

    // Phase 6D-4C — REPLACEMENT is the one resolution type an admin picks
    // explicitly, and only for a DOA/damage claim (a "changed my mind"
    // standard return has nothing wrong with the item to replace).
    if (
      dto.resolutionType === 'REPLACEMENT' &&
      existing.claimType !== 'DOA_CLAIM'
    ) {
      throw new BadRequestException(
        'Replacement resolution is only available for DOA/damage claims.',
      );
    }

    // Phase 6D-4D — an explicit admin choice always wins; otherwise fall
    // back to the schema's own documented default per claimType (see
    // return-policy.util.defaultRequiresReverseLogistics's own comment).
    const requiresReverseLogistics =
      dto.requiresReverseLogistics ??
      defaultRequiresReverseLogistics(existing.claimType);

    const { count } = await this.prisma.returnRequest.updateMany({
      where: { id, status: 'PENDING' },
      data: {
        status: 'APPROVED',
        decidedBy: adminId,
        decidedAt: new Date(),
        decisionNote: dto.note,
        resolutionType: dto.resolutionType ?? null,
        requiresReverseLogistics,
      },
    });
    if (count === 0) await this.rejectStaleDecision(id);

    const updated = await this.prisma.returnRequest.findUniqueOrThrow({
      where: { id },
      include: ADMIN_RETURN_INCLUDE,
    });

    await this.auditService.log({
      actorId: adminId,
      action: 'RETURN_APPROVED',
      resource: 'return_request',
      resourceId: id,
      metadata: { orderId: updated.orderId, note: dto.note ?? null },
      ipAddress,
    });

    const payload: ReturnApprovedPayload = {
      returnRequestId: id,
      orderId: updated.orderId,
      userId: updated.order.user.id,
    };
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access -- same eventemitter2 type-resolution quirk noted throughout this codebase's other controllers/services.
    this.eventEmitter.emit(NOTIFICATION_EVENTS.RETURN_APPROVED, payload);

    return this.toAdminRecord(updated);
  }

  /** PENDING -> REJECTED. Same atomic-transition/race-handling as adminApprove above. */
  async adminReject(
    adminId: string,
    id: string,
    dto: RejectReturnDto,
    ipAddress?: string,
  ) {
    const { count } = await this.prisma.returnRequest.updateMany({
      where: { id, status: 'PENDING' },
      data: {
        status: 'REJECTED',
        decidedBy: adminId,
        decidedAt: new Date(),
        decisionNote: dto.reason,
      },
    });
    if (count === 0) await this.rejectStaleDecision(id);

    const updated = await this.prisma.returnRequest.findUniqueOrThrow({
      where: { id },
      include: ADMIN_RETURN_INCLUDE,
    });

    await this.auditService.log({
      actorId: adminId,
      action: 'RETURN_REJECTED',
      resource: 'return_request',
      resourceId: id,
      metadata: { orderId: updated.orderId, reason: dto.reason },
      ipAddress,
    });

    const payload: ReturnRejectedPayload = {
      returnRequestId: id,
      orderId: updated.orderId,
      userId: updated.order.user.id,
      reason: dto.reason,
    };
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access -- same eventemitter2 type-resolution quirk noted throughout this codebase's other controllers/services.
    this.eventEmitter.emit(NOTIFICATION_EVENTS.RETURN_REJECTED, payload);

    return this.toAdminRecord(updated);
  }

  /**
   * Shared by adminApprove/adminReject when their conditional update
   * matched zero rows — distinguishes "doesn't exist at all" (404) from
   * "exists, but already decided / not pending" (409, a genuine state
   * conflict — ConflictException, matching this codebase's existing
   * convention for that, e.g. AuthService's duplicate-email check).
   */
  private async rejectStaleDecision(id: string): Promise<never> {
    const existing = await this.prisma.returnRequest.findUnique({
      where: { id },
      select: { status: true },
    });
    if (!existing) throw new NotFoundException('Return request not found.');
    const currentPublic =
      RETURN_STATUS_TO_PUBLIC[existing.status] ?? existing.status.toLowerCase();
    throw new ConflictException(
      `This claim is already ${currentPublic} — only a pending claim can be approved or rejected.`,
    );
  }

  /**
   * Phase 6D-4D — records that the returned item physically arrived back
   * at the warehouse. Only meaningful for a claim whose
   * requiresReverseLogistics is true; this is the one thing
   * ReturnsService.resolveClaim's own gate checks before it will execute
   * any resolution (refund, store credit, or replacement) for such a
   * claim. The atomic `updateMany` precondition
   * (`status: 'APPROVED', requiresReverseLogistics: true, itemReceivedAt: null`)
   * is the same conditional-transition idiom used throughout this class —
   * of two concurrent calls, exactly one sets itemReceivedAt; the other's
   * updateMany matches zero rows and is disambiguated below.
   */
  async markItemReceived(adminId: string, id: string, ipAddress?: string) {
    const { count } = await this.prisma.returnRequest.updateMany({
      where: {
        id,
        status: 'APPROVED',
        requiresReverseLogistics: true,
        itemReceivedAt: null,
      },
      data: { itemReceivedAt: new Date() },
    });

    if (count === 0) {
      const existing = await this.prisma.returnRequest.findUnique({
        where: { id },
        select: {
          status: true,
          requiresReverseLogistics: true,
          itemReceivedAt: true,
        },
      });
      if (!existing) throw new NotFoundException('Return request not found.');
      if (existing.itemReceivedAt) {
        // Already recorded — a duplicate/retried call (e.g. a double
        // click), not an error. This isn't a financial operation, so
        // idempotent-return is safe with no further guard needed.
        return this.adminGetClaim(id);
      }
      if (!existing.requiresReverseLogistics) {
        throw new BadRequestException(
          'This claim does not require reverse logistics.',
        );
      }
      const currentPublic =
        RETURN_STATUS_TO_PUBLIC[existing.status] ??
        existing.status.toLowerCase();
      throw new ConflictException(
        `This claim is ${currentPublic} and cannot be marked received.`,
      );
    }

    const updated = await this.prisma.returnRequest.findUniqueOrThrow({
      where: { id },
      include: ADMIN_RETURN_INCLUDE,
    });

    await this.auditService.log({
      actorId: adminId,
      action: 'RETURN_ITEM_RECEIVED',
      resource: 'return_request',
      resourceId: id,
      metadata: { orderId: updated.orderId },
      ipAddress,
    });

    return this.toAdminRecord(updated);
  }

  private toAdminRecord(row: AdminReturnRequestRow) {
    const claimType = row.claimType;
    const evidenceRequired = requiresEvidence(claimType);
    const reasonEligible = isReasonEligibleForClaimType(claimType, row.reason);

    return {
      id: row.id,
      orderId: row.orderId,
      status: RETURN_STATUS_TO_PUBLIC[row.status] ?? row.status.toLowerCase(),
      claimType: claimType === 'DOA_CLAIM' ? 'doa-claim' : 'standard-return',
      reason: returnReasonToPublic[row.reason],
      note: row.note,
      requestedAt: row.requestedAt.toISOString(),
      order: {
        id: row.order.id,
        total: Number(row.order.total),
        deliveredAt: row.order.deliveredAt
          ? row.order.deliveredAt.toISOString()
          : null,
      },
      customer: {
        id: row.order.user.id,
        firstName: row.order.user.firstName,
        lastName: row.order.user.lastName,
        email: row.order.user.email,
      },
      items: row.items.map((item) => ({
        orderItemId: item.orderItemId,
        quantity: item.quantity,
        productName: item.orderItem.name,
        unitPrice: Number(item.orderItem.price),
        purchasedQuantity: item.orderItem.quantity,
        claimedLineValue: Number(item.orderItem.price) * item.quantity,
      })),
      evidence: row.evidence.map((e) => ({
        url: e.url,
        uploadedAt: e.createdAt.toISOString(),
      })),
      policy: {
        evidenceRequired,
        evidenceProvided: row.evidence.length > 0,
        reasonEligible,
      },
      decision: {
        decidedBy: row.decidedBy,
        decidedAt: row.decidedAt ? row.decidedAt.toISOString() : null,
        decisionNote: row.decisionNote,
      },
      // Null until Phase 6D-4B's resolveClaim() actually populates them —
      // surfaced from the start (Phase 6D-4A) so the admin UI can see at
      // a glance whether a resolution has executed yet, with no response
      // shape change needed once it does.
      resolution: {
        resolutionType: row.resolutionType,
        requiresReverseLogistics: row.requiresReverseLogistics,
        // Phase 6D-4D — surfaced alongside requiresReverseLogistics since
        // an admin now needs to see whether the item has actually been
        // received back, not just whether it's required: resolveClaim
        // blocks on exactly this field once requiresReverseLogistics is
        // true.
        itemReceivedAt: row.itemReceivedAt
          ? row.itemReceivedAt.toISOString()
          : null,
        refundAmount: row.refundAmount ? Number(row.refundAmount) : null,
        refundId: row.refundId,
        replacementOrderId: row.replacementOrderId,
        storeCreditEntryId: row.storeCreditEntry?.id ?? null,
      },
    };
  }

  // --- Phase 6D-4B: financial resolution for an already-APPROVED claim ---
  //
  // Resolution type is never accepted from the client — it is derived
  // entirely from the order's real, persisted paymentMethod: COD ->
  // FOLIA_STORE_CREDIT, anything else -> REFUND via the existing
  // PaymentsService.refund(). Replacement is out of scope until a later
  // phase. Nothing here calls the Razorpay SDK directly — the only
  // gateway path is PaymentsService.refund() itself.
  //
  // Phase 6D-4E closed the KNOWN GAP originally documented here (still
  // preserved in docs/PHASE_6D_MIGRATION_DESIGN.md's history): the
  // ReturnRequestStatus enum alone cannot distinguish "a prepaid refund
  // attempt is currently in flight" from "a previous attempt failed and
  // this is a safe retry" — both look identical (status still APPROVED,
  // refundAmount already frozen). PaymentsService.refund()'s own
  // aggregate guard protects the PAYMENT's total from being over-
  // refunded, but does NOT protect this ONE LOGICAL CLAIM from being
  // refunded twice if the payment has enough remaining headroom to absorb
  // a second, independently-valid-looking refund() call. The added
  // ReturnRequest.refundAttemptState column (NONE / IN_PROGRESS /
  // FAILED_RETRYABLE — see its own schema comment) is exactly that
  // missing state: the atomic gate below claims the right to attempt (or
  // retry) a prepaid refund via a single conditional update whose WHERE
  // clause requires `refundAttemptState != IN_PROGRESS`, so a genuinely
  // in-flight attempt still blocks a second caller, while a FAILED_
  // RETRYABLE (or legacy pre-migration NONE) claim can now be safely
  // retried with the SAME frozen amount, never recomputed.
  // COD has no such gap: StoreCreditEntry.returnRequestId's own unique
  // constraint is a single, instantaneous, airtight guard (no external
  // gateway call sits between "decide to create" and "actually create"),
  // so COD resolution has always been safe to retry.

  async resolveClaim(adminId: string, id: string, ipAddress?: string) {
    const row = await this.prisma.returnRequest.findUnique({
      where: { id },
      include: RESOLUTION_INCLUDE,
    });
    if (!row) throw new NotFoundException('Return request not found.');

    if (row.status === 'PENDING' || row.status === 'REJECTED') {
      throw new ConflictException(
        `This claim is ${RETURN_STATUS_TO_PUBLIC[row.status] ?? row.status.toLowerCase()} and must be approved before it can be financially resolved.`,
      );
    }
    if (row.status !== 'APPROVED') {
      // Already resolved (REFUND_ISSUED / STORE_CREDIT_ISSUED /
      // REPLACEMENT_ISSUED) — idempotent: return the persisted result,
      // never re-execute a financial operation.
      return this.adminGetClaim(id);
    }

    // Phase 6D-4D — applies uniformly to every resolution type (refund,
    // store credit, and replacement alike): requiresReverseLogistics is a
    // property of the CLAIM's own return-shipping flow, not of how it's
    // ultimately paid out, so gating only some resolution types would be
    // an arbitrary carve-out. Most DOA_CLAIM+REPLACEMENT claims never hit
    // this at all (defaultRequiresReverseLogistics is false for DOA_CLAIM)
    // unless an admin explicitly opted a specific claim into it.
    if (row.requiresReverseLogistics && !row.itemReceivedAt) {
      throw new ConflictException(
        'This claim requires the returned item to be received back before it can be resolved — see ReturnsService.markItemReceived.',
      );
    }

    // Phase 6D-4C — REPLACEMENT was chosen explicitly at approval time
    // (ReturnsService.adminApprove, DOA_CLAIM only) and takes a completely
    // separate path: no refundAmount, no PaymentsService, no
    // StoreCreditEntry. Dispatched before the refund/credit freeze-gate
    // below, which has no meaning for a replacement.
    if (row.resolutionType === 'REPLACEMENT') {
      return this.resolveReplacement(adminId, row, ipAddress);
    }

    const isCod = row.order.paymentMethod === 'COD';

    // The refund amount is deterministic given immutable order/item data —
    // computing it once here (whether this is truly the first time, or a
    // retry re-deriving the SAME value the earlier attempt already froze)
    // means the atomic gates below never need to branch on which case
    // they're in; writing this value is always either a genuine freeze or
    // a harmless no-op re-write of the value already there.
    let frozenAmount: number;
    if (row.refundAmount != null) {
      frozenAmount = Number(row.refundAmount);
    } else {
      const eligibleItemSubtotal = row.items.reduce(
        (sum, item) => sum + Number(item.orderItem.price) * item.quantity,
        0,
      );
      frozenAmount = calculateRefundAmount({
        claimType: row.claimType,
        reason: row.reason,
        orderSubtotal: Number(row.order.subtotal),
        orderDiscount: Number(row.order.discount),
        orderTax: Number(row.order.tax),
        eligibleItemSubtotal,
      });
      if (frozenAmount <= 0) {
        throw new BadRequestException(
          'The computed refund amount for this claim is zero — there is nothing to resolve.',
        );
      }
    }

    if (isCod) {
      // COD has always been safe to retry (see the block comment above) —
      // a plain conditional freeze-if-null is sufficient; no attempt-state
      // tracking needed.
      if (row.refundAmount == null) {
        // Exactly one of two concurrent first-time callers wins this
        // conditional update (Postgres serializes concurrent UPDATEs to
        // the same row), the same idiom this codebase already uses for
        // PaymentsService.confirmCapture and Phase 6D-4A's own
        // approve/reject transitions.
        const { count } = await this.prisma.returnRequest.updateMany({
          where: { id, status: 'APPROVED', refundAmount: null },
          data: { refundAmount: frozenAmount },
        });
        if (count === 0) {
          const fresh = await this.prisma.returnRequest.findUniqueOrThrow({
            where: { id },
            select: { status: true, refundAmount: true },
          });
          if (fresh.status !== 'APPROVED') return this.adminGetClaim(id);
          frozenAmount = Number(fresh.refundAmount);
        }
      }
      return this.resolveCodStoreCredit(adminId, row, frozenAmount, ipAddress);
    }

    // Prepaid — Phase 6D-4E's attempt-state gate. One atomic conditional
    // update covers BOTH a true first attempt and a safe retry: the WHERE
    // clause requires refundAttemptState isn't currently IN_PROGRESS
    // (blocking a genuinely in-flight attempt, whether this is anyone's
    // first try or a retry), and the write both freezes/re-writes
    // refundAmount and claims IN_PROGRESS in the same statement. Of two
    // concurrent callers (first-time or retry), Postgres serializes the
    // UPDATEs to this row, so exactly one sees count===1.
    const { count } = await this.prisma.returnRequest.updateMany({
      where: {
        id,
        status: 'APPROVED',
        refundAttemptState: { not: 'IN_PROGRESS' },
      },
      data: { refundAttemptState: 'IN_PROGRESS', refundAmount: frozenAmount },
    });

    if (count === 0) {
      // Lost the race — re-read fresh state rather than assume why.
      // Someone else may have already finished (idempotent return) or may
      // have just claimed IN_PROGRESS a moment ago.
      const fresh = await this.prisma.returnRequest.findUniqueOrThrow({
        where: { id },
        select: { status: true },
      });
      if (fresh.status !== 'APPROVED') return this.adminGetClaim(id);
      throw new ConflictException(
        'A financial resolution attempt for this claim is already in progress.',
      );
    }

    return this.resolvePrepaidRefund(adminId, row, frozenAmount, ipAddress);
  }

  private async resolveCodStoreCredit(
    adminId: string,
    row: ResolutionRow,
    amount: number,
    ipAddress?: string,
  ) {
    let entry: { id: string };
    try {
      entry = await this.prisma.storeCreditEntry.create({
        data: {
          userId: row.order.userId,
          amount,
          reason: `Return resolution for order ${row.orderId}`,
          returnRequestId: row.id,
        },
      });
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        // A concurrent resolveClaim() call already issued the credit —
        // the real, race-proof guarantee (this codebase's established
        // "unique constraint as the atomic gate" idiom, same as
        // ReturnRequest.orderId in Phase 6D-3). Idempotent, not an error.
        entry = await this.prisma.storeCreditEntry.findUniqueOrThrow({
          where: { returnRequestId: row.id },
        });
      } else {
        await this.auditService.log({
          actorId: adminId,
          action: 'RETURN_STORE_CREDIT_FAILED',
          resource: 'return_request',
          resourceId: row.id,
          metadata: {
            orderId: row.orderId,
            amount,
            error: err instanceof Error ? err.message : 'unknown error',
          },
          ipAddress,
        });
        throw err;
      }
    }

    // Safe even if this call lost the create() race above: the entry (the
    // real financial fact) is confirmed to exist either way by this
    // point, so marking ISSUED here is never a lie — and if a concurrent
    // call already flipped status, this update is a harmless no-op
    // (count: 0), not an error.
    await this.prisma.returnRequest.updateMany({
      where: { id: row.id, status: 'APPROVED' },
      data: {
        status: 'STORE_CREDIT_ISSUED',
        resolutionType: 'FOLIA_STORE_CREDIT',
      },
    });

    await this.auditService.log({
      actorId: adminId,
      action: 'RETURN_STORE_CREDIT_ISSUED',
      resource: 'return_request',
      resourceId: row.id,
      metadata: {
        orderId: row.orderId,
        amount,
        storeCreditEntryId: entry.id,
      },
      ipAddress,
    });

    const payload: StoreCreditIssuedPayload = {
      returnRequestId: row.id,
      orderId: row.orderId,
      userId: row.order.userId,
      amount,
    };
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access -- same eventemitter2 type-resolution quirk noted throughout this codebase's other controllers/services.
    this.eventEmitter.emit(NOTIFICATION_EVENTS.STORE_CREDIT_ISSUED, payload);

    return this.adminGetClaim(row.id);
  }

  private async resolvePrepaidRefund(
    adminId: string,
    row: ResolutionRow,
    amount: number,
    ipAddress?: string,
  ) {
    if (!row.order.payment) {
      throw new BadRequestException(
        'This order has no payment record to refund.',
      );
    }

    try {
      // The single financial gateway path — PaymentsService.refund()
      // already handles the real two-phase reserve/confirm-or-release
      // flow, its own concurrency-safe row locking, the PAYMENT_REFUND /
      // PAYMENT_REFUND_FAILED audit trail, and PAYMENT_EVENTS.REFUNDED —
      // none of that is reimplemented here.
      const result = await this.paymentsService.refund(
        row.order.payment.id,
        { amount, reason: `Return resolution for order ${row.orderId}` },
        { actorId: adminId, actorType: 'admin', ipAddress },
      );

      await this.prisma.returnRequest.updateMany({
        where: { id: row.id, status: 'APPROVED' },
        data: {
          status: 'REFUND_ISSUED',
          resolutionType: 'REFUND',
          refundId: result.id,
          // Phase 6D-4E — tidiness, not correctness: once status is
          // REFUND_ISSUED, resolveClaim's own idempotent-return check
          // short-circuits before ever reading this field again, but a
          // reviewer inspecting a successful row shouldn't see a stale
          // IN_PROGRESS sitting there.
          refundAttemptState: 'NONE',
        },
      });

      // Return-scoped audit entry — PaymentsService.refund()'s own audit
      // is keyed by paymentId and has no way to know this ReturnRequest's
      // id; this is the complementary record for return-side
      // traceability, not a duplicate of that logic.
      await this.auditService.log({
        actorId: adminId,
        action: 'RETURN_REFUND_ISSUED',
        resource: 'return_request',
        resourceId: row.id,
        metadata: { orderId: row.orderId, amount, refundId: result.id },
        ipAddress,
      });

      return this.adminGetClaim(row.id);
    } catch (err) {
      // ReturnRequest.status deliberately stays APPROVED here — never a
      // fake success — and refundAmount stays frozen. Phase 6D-4E: unlike
      // before, this is no longer a permanent dead end — flipping
      // refundAttemptState to FAILED_RETRYABLE is what lets a future
      // resolveClaim() call safely retry with this SAME frozen amount.
      // The `where: { refundAttemptState: 'IN_PROGRESS' }` guard means
      // this write is a no-op if a concurrent caller somehow already
      // moved this claim on (e.g. to REFUND_ISSUED) — never overwrites a
      // real success.
      await this.prisma.returnRequest.updateMany({
        where: { id: row.id, refundAttemptState: 'IN_PROGRESS' },
        data: { refundAttemptState: 'FAILED_RETRYABLE' },
      });

      await this.auditService.log({
        actorId: adminId,
        action: 'RETURN_REFUND_FAILED',
        resource: 'return_request',
        resourceId: row.id,
        metadata: {
          orderId: row.orderId,
          amount,
          error: err instanceof Error ? err.message : 'unknown error',
        },
        ipAddress,
      });
      throw err;
    }
  }

  /**
   * Phase 6D-4C — a DOA/damage claim resolved by shipping a free
   * replacement instead of a refund/store-credit. Reuses the same
   * reserve -> commit-inside-order-creation-transaction pipeline
   * PaymentsService.confirmAndCreateOrder already established for real
   * checkouts (InventoryService.reserveForProduct, then
   * InventoryService.commitReservation with the order-creation
   * transaction's own `tx`) — no new inventory primitive was written for
   * this.
   *
   * Idempotency/concurrency: ReturnRequest.replacementOrderId is @unique,
   * but it can't be the atomic pre-claim gate 6D-4B used for refundAmount
   * (an Order id can't be written there before that Order row exists —
   * the column has a real FK to orders(id)). Instead, the Order/OrderItem/
   * Payment rows are created SPECULATIVELY inside one transaction whose
   * FINAL write is the conditional
   * `updateMany({ status: 'APPROVED', replacementOrderId: null })`; if that
   * matches zero rows (a concurrent racer already won), this method throws
   * to roll the ENTIRE transaction back — the speculative order/payment
   * rows and the just-committed inventory decrement all revert together,
   * so a losing racer never leaves an orphaned $0 order or double-decremented
   * stock behind. The reservation itself (made before the transaction, so
   * it can be released on any failure path) is explicitly released after a
   * lost race, since its COMMITTED write was rolled back with everything
   * else and it would otherwise sit ACTIVE forever.
   */
  private async resolveReplacement(
    adminId: string,
    row: ResolutionRow,
    ipAddress?: string,
  ) {
    if (row.claimType !== 'DOA_CLAIM') {
      // Defense in depth — adminApprove already enforces this, but this is
      // the method that actually creates a real order, so it re-verifies
      // rather than trusting that upstream check alone.
      throw new BadRequestException(
        'Replacement resolution is only available for DOA/damage claims.',
      );
    }
    if (row.items.length === 0) {
      throw new BadRequestException('This claim has no items to replace.');
    }

    const newOrderId = generateOrderId();
    const reservations: string[] = [];
    try {
      for (const claimItem of row.items) {
        const reservation = await this.inventoryService.reserveForProduct(
          claimItem.orderItem.productId,
          claimItem.orderItem.variantId,
          claimItem.quantity,
          'ORDER',
          newOrderId,
        );
        reservations.push(reservation.id);
      }
    } catch (err) {
      for (const reservationId of reservations) {
        await this.inventoryService.releaseReservation(reservationId);
      }
      await this.auditService.log({
        actorId: adminId,
        action: 'RETURN_REPLACEMENT_FAILED',
        resource: 'return_request',
        resourceId: row.id,
        metadata: {
          orderId: row.orderId,
          error: err instanceof Error ? err.message : 'unknown error',
        },
        ipAddress,
      });
      throw err;
    }

    try {
      await this.prisma.$transaction(async (tx) => {
        for (const reservationId of reservations) {
          await this.inventoryService.commitReservation(reservationId, tx);
        }

        await tx.order.create({
          data: {
            id: newOrderId,
            userId: row.order.userId,
            subtotal: 0,
            discount: 0,
            shippingCost: 0,
            tax: 0,
            total: 0,
            shippingAddressSnapshot: row.order
              .shippingAddressSnapshot as unknown as Prisma.InputJsonValue,
            billingAddressSnapshot: row.order
              .billingAddressSnapshot as unknown as Prisma.InputJsonValue,
            deliveryMethod: row.order.deliveryMethod,
            estimatedDelivery: row.order.estimatedDelivery,
            status: 'PROCESSING',
            paymentMethod: 'REPLACEMENT',
            paymentDisplayLabel: 'Free replacement',
            paymentTransactionId: `replacement-${row.id}`,
            customerNotes: `Free replacement for order ${row.orderId} (return/DOA claim ${row.id}).`,
            items: {
              create: row.items.map((claimItem) => ({
                productId: claimItem.orderItem.productId,
                slug: claimItem.orderItem.slug,
                name: claimItem.orderItem.name,
                categorySlug: claimItem.orderItem.categorySlug,
                variantId: claimItem.orderItem.variantId,
                variantLabel: claimItem.orderItem.variantLabel,
                // Zero, not the original line's price — see
                // docs/PHASE_6D_MIGRATION_DESIGN.md's replacement-order
                // notes: a future return claim against THIS order must
                // never compute a non-zero refund over money never
                // charged.
                price: 0,
                quantity: claimItem.quantity,
              })),
            },
            payment: {
              create: {
                userId: row.order.userId,
                provider: 'COD',
                method: 'REPLACEMENT',
                status: 'NO_CHARGE',
                amount: 0,
                currency: 'INR',
                displayLabel: 'Free replacement',
              },
            },
          },
        });

        const { count } = await tx.returnRequest.updateMany({
          where: { id: row.id, status: 'APPROVED', replacementOrderId: null },
          data: {
            status: 'REPLACEMENT_ISSUED',
            replacementOrderId: newOrderId,
          },
        });
        if (count === 0) throw new LostReplacementRaceError();
      });
    } catch (err) {
      // Whatever this transaction wrote (the order/items/payment, the
      // committed reservations) has already been rolled back by Postgres
      // at this point — the reservations are back to ACTIVE, not
      // COMMITTED, so they must be explicitly released rather than left
      // to sit forever.
      for (const reservationId of reservations) {
        await this.inventoryService.releaseReservation(reservationId);
      }

      if (err instanceof LostReplacementRaceError) {
        // A concurrent resolveClaim() call already created the
        // replacement — idempotent, not an error.
        return this.adminGetClaim(row.id);
      }

      await this.auditService.log({
        actorId: adminId,
        action: 'RETURN_REPLACEMENT_FAILED',
        resource: 'return_request',
        resourceId: row.id,
        metadata: {
          orderId: row.orderId,
          error: err instanceof Error ? err.message : 'unknown error',
        },
        ipAddress,
      });
      throw err;
    }

    await this.auditService.log({
      actorId: adminId,
      action: 'RETURN_REPLACEMENT_ISSUED',
      resource: 'return_request',
      resourceId: row.id,
      metadata: { orderId: row.orderId, replacementOrderId: newOrderId },
      ipAddress,
    });

    const payload: ReplacementIssuedPayload = {
      returnRequestId: row.id,
      orderId: row.orderId,
      replacementOrderId: newOrderId,
      userId: row.order.userId,
    };
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access -- same eventemitter2 type-resolution quirk noted throughout this codebase's other controllers/services.
    this.eventEmitter.emit(NOTIFICATION_EVENTS.REPLACEMENT_ISSUED, payload);

    return this.adminGetClaim(row.id);
  }
}
