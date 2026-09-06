-- Phase 6D-1: returns/DOA/replacement/store-credit schema.
--
-- Hand-adjusted from Prisma's raw `migrate diff` output in two places,
-- both because the raw diff adds a NOT NULL column with no default to an
-- existing table — safe against an empty table (true of this dev DB
-- today) but not safe in general (a staging/prod return_requests table
-- with real rows would fail this ALTER outright). Both columns are
-- instead added nullable, backfilled, then constrained NOT NULL:
--   * "claimType" — backfilled by checking whether the parent order has
--     any 'plants'-category line item (the same signal the rest of this
--     phase's design uses to distinguish DOA_CLAIM from STANDARD_RETURN),
--     not an arbitrary default — a plant-claim row must never be silently
--     mis-backfilled as STANDARD_RETURN.
--   * "updatedAt" — backfilled to now(); purely bookkeeping, no business
--     meaning is lost by using the migration's own run time for
--     pre-existing rows.
-- Everything else below matches the reviewed schema diff verbatim.

-- CreateEnum
CREATE TYPE "ReturnClaimType" AS ENUM ('STANDARD_RETURN', 'DOA_CLAIM');

-- CreateEnum
CREATE TYPE "ReturnRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'REFUND_ISSUED', 'STORE_CREDIT_ISSUED', 'REPLACEMENT_ISSUED');

-- CreateEnum
CREATE TYPE "ReturnResolutionType" AS ENUM ('REFUND', 'REPLACEMENT', 'FOLIA_STORE_CREDIT');

-- AlterEnum
ALTER TYPE "PaymentMethodType" ADD VALUE 'REPLACEMENT';

-- AlterEnum
ALTER TYPE "PaymentStatus" ADD VALUE 'NO_CHARGE';

-- AlterEnum
ALTER TYPE "ReturnReason" ADD VALUE 'DOA';

-- AlterTable: Order.deliveredAt (nullable — no backfill issue, every
-- existing row simply starts as NULL, which is the honest "unknown"
-- state until the one-time backfill statement further below).
ALTER TABLE "orders" ADD COLUMN "deliveredAt" TIMESTAMP(3);

-- AlterTable: return_requests — new columns, mostly nullable by nature
-- (undecided until an admin acts). claimType/updatedAt are the two
-- exceptions requiring the nullable -> backfill -> NOT NULL sequence
-- described above.
ALTER TABLE "return_requests" ADD COLUMN     "claimType" "ReturnClaimType",
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "decidedAt" TIMESTAMP(3),
ADD COLUMN     "decidedBy" TEXT,
ADD COLUMN     "decisionNote" TEXT,
ADD COLUMN     "itemReceivedAt" TIMESTAMP(3),
ADD COLUMN     "refundAmount" DECIMAL(10,2),
ADD COLUMN     "refundId" TEXT,
ADD COLUMN     "replacementOrderId" TEXT,
ADD COLUMN     "requiresReverseLogistics" BOOLEAN,
ADD COLUMN     "resolutionType" "ReturnResolutionType",
ADD COLUMN     "status" "ReturnRequestStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "updatedAt" TIMESTAMP(3);

-- Backfill claimType for any pre-existing (Phase 6-era, whole-order,
-- always-simulated) return request: DOA_CLAIM if the parent order has any
-- 'plants'-category line item, STANDARD_RETURN otherwise. No pre-6D
-- return request ever recorded which specific items were involved (that
-- concept didn't exist yet), so "the order contains a plant" is the most
-- accurate signal available after the fact.
UPDATE "return_requests" rr
SET "claimType" = CASE
  WHEN EXISTS (
    SELECT 1 FROM "order_items" oi
    WHERE oi."orderId" = rr."orderId" AND oi."categorySlug" = 'plants'
  ) THEN 'DOA_CLAIM'::"ReturnClaimType"
  ELSE 'STANDARD_RETURN'::"ReturnClaimType"
END
WHERE "claimType" IS NULL;

-- Backfill updatedAt for any pre-existing row to the migration's own run
-- time — bookkeeping only, no business meaning attached to the exact value.
UPDATE "return_requests" SET "updatedAt" = CURRENT_TIMESTAMP WHERE "updatedAt" IS NULL;

ALTER TABLE "return_requests" ALTER COLUMN "claimType" SET NOT NULL;
ALTER TABLE "return_requests" ALTER COLUMN "updatedAt" SET NOT NULL;

-- One-time backfill for Order.deliveredAt: prefer the real audit-log
-- timestamp of the admin action that actually moved the order to
-- DELIVERED (AdminOrdersController.updateStatus already writes an
-- ORDER_STATUS_UPDATE audit row with metadata.newStatus for every such
-- transition — a materially more accurate source than `updatedAt`, which
-- any later unrelated write, e.g. a customerNotes edit, would have
-- silently bumped). Falls back to `updatedAt` only for a DELIVERED order
-- with no matching audit row at all (e.g. seeded directly, bypassing the
-- real endpoint).
UPDATE "orders" o
SET "deliveredAt" = COALESCE(
  (
    SELECT MIN(al."createdAt")
    FROM "audit_logs" al
    WHERE al."resource" = 'order'
      AND al."resourceId" = o.id
      AND al."action" = 'ORDER_STATUS_UPDATE'
      AND al."metadata"->>'newStatus' = 'DELIVERED'
  ),
  o."updatedAt"
)
WHERE o."status" = 'DELIVERED' AND o."deliveredAt" IS NULL;

-- CreateTable
CREATE TABLE "return_request_items" (
    "id" TEXT NOT NULL,
    "returnRequestId" TEXT NOT NULL,
    "orderItemId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "return_request_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "return_evidence" (
    "id" TEXT NOT NULL,
    "returnRequestId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "return_evidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "store_credit_entries" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "reason" TEXT NOT NULL,
    "returnRequestId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "store_credit_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "return_request_items_orderItemId_idx" ON "return_request_items"("orderItemId");

-- CreateIndex
CREATE UNIQUE INDEX "return_request_items_returnRequestId_orderItemId_key" ON "return_request_items"("returnRequestId", "orderItemId");

-- CreateIndex
CREATE INDEX "return_evidence_returnRequestId_idx" ON "return_evidence"("returnRequestId");

-- CreateIndex
CREATE UNIQUE INDEX "store_credit_entries_returnRequestId_key" ON "store_credit_entries"("returnRequestId");

-- CreateIndex
CREATE INDEX "store_credit_entries_userId_idx" ON "store_credit_entries"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "return_requests_refundId_key" ON "return_requests"("refundId");

-- CreateIndex
CREATE UNIQUE INDEX "return_requests_replacementOrderId_key" ON "return_requests"("replacementOrderId");

-- CreateIndex
CREATE INDEX "return_requests_status_idx" ON "return_requests"("status");

-- AddForeignKey
ALTER TABLE "return_requests" ADD CONSTRAINT "return_requests_refundId_fkey" FOREIGN KEY ("refundId") REFERENCES "refunds"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "return_requests" ADD CONSTRAINT "return_requests_replacementOrderId_fkey" FOREIGN KEY ("replacementOrderId") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "return_request_items" ADD CONSTRAINT "return_request_items_returnRequestId_fkey" FOREIGN KEY ("returnRequestId") REFERENCES "return_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "return_request_items" ADD CONSTRAINT "return_request_items_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "order_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "return_evidence" ADD CONSTRAINT "return_evidence_returnRequestId_fkey" FOREIGN KEY ("returnRequestId") REFERENCES "return_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "store_credit_entries" ADD CONSTRAINT "store_credit_entries_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "store_credit_entries" ADD CONSTRAINT "store_credit_entries_returnRequestId_fkey" FOREIGN KEY ("returnRequestId") REFERENCES "return_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
