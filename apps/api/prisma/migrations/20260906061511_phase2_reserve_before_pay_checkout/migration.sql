-- Phase 2: reserve-before-pay checkout, row-locked inventory.
--
-- Data cleanup (must run BEFORE the schema changes below): any Order still
-- in PENDING_PAYMENT is, by definition, a checkout that was never actually
-- paid for — Phase 2 removes this status entirely because that state no
-- longer exists (an Order row is only ever created once payment has
-- already resolved; an unpaid checkout is a Payment with no Order at all,
-- not an Order in a pending state). Without this delete, the ALTER COLUMN
-- ... SET NOT NULL and enum-shrink below would fail outright against any
-- such row (paymentDisplayLabel/paymentTransactionId are NULL on a
-- PENDING_PAYMENT order by construction, and PENDING_PAYMENT itself has no
-- equivalent in the new, smaller OrderStatus enum). Cascades to
-- order_items/cancellation_requests/return_requests/payments via their
-- existing ON DELETE CASCADE foreign keys.
DELETE FROM "orders" WHERE "status" = 'PENDING_PAYMENT';

-- AlterEnum
BEGIN;
CREATE TYPE "OrderStatus_new" AS ENUM ('PROCESSING', 'CONFIRMED', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'RETURNED', 'REFUNDED');
ALTER TABLE "public"."orders" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "orders" ALTER COLUMN "status" TYPE "OrderStatus_new" USING ("status"::text::"OrderStatus_new");
ALTER TYPE "OrderStatus" RENAME TO "OrderStatus_old";
ALTER TYPE "OrderStatus_new" RENAME TO "OrderStatus";
DROP TYPE "public"."OrderStatus_old";
ALTER TABLE "orders" ALTER COLUMN "status" SET DEFAULT 'PROCESSING';
COMMIT;

-- AlterEnum
ALTER TYPE "ReservationReferenceType" ADD VALUE 'PAYMENT';

-- DropIndex
DROP INDEX "orders_userId_idempotencyKey_key";

-- AlterTable
-- idempotencyKey moves from Order to Payment (see below) — every
-- remaining order at this point is already PROCESSING+ (paid, or COD),
-- so paymentDisplayLabel/paymentTransactionId are genuinely always known
-- and the NOT NULL constraints hold with no further cleanup needed.
ALTER TABLE "orders" DROP COLUMN "idempotencyKey",
ALTER COLUMN "paymentDisplayLabel" SET NOT NULL,
ALTER COLUMN "paymentTransactionId" SET NOT NULL;

-- AlterTable
ALTER TABLE "payments" ADD COLUMN     "checkoutSnapshot" JSONB,
ADD COLUMN     "idempotencyKey" TEXT,
ALTER COLUMN "orderId" DROP NOT NULL;

-- CreateIndex
-- Every existing payment gets idempotencyKey = NULL (a new column with no
-- data to backfill), and Postgres unique constraints never treat two NULLs
-- as conflicting, so this is safe against existing rows regardless of how
-- many share a userId.
CREATE UNIQUE INDEX "payments_userId_idempotencyKey_key" ON "payments"("userId", "idempotencyKey");
