-- Phase 6D-4E: closes the prepaid-refund retry gap documented in Phase
-- 6D-4B's own design notes (docs/PHASE_6D_MIGRATION_DESIGN.md). Once a
-- prepaid claim's refundAmount is frozen, ReturnRequestStatus alone
-- cannot tell "a refund attempt is currently calling Razorpay" apart from
-- "a previous attempt failed and this is a safe retry" — both look
-- identical (status still APPROVED, refundAmount already frozen). This
-- new column/enum is that missing state, meaningful only for the prepaid
-- REFUND path; COD/REPLACEMENT resolutions never touch it. Purely
-- additive: a new enum type and a new NOT NULL column with a default, on
-- a table that already has rows — safe without a separate
-- nullable-then-backfill-then-constrain step, since every existing row
-- gets the same correct default (NONE — no prepaid refund attempt has
-- ever been made against it under this new field, which is true for
-- every row that predates this migration).

-- CreateEnum
CREATE TYPE "ReturnRefundAttemptState" AS ENUM ('NONE', 'IN_PROGRESS', 'FAILED_RETRYABLE');

-- AlterTable
ALTER TABLE "return_requests" ADD COLUMN     "refundAttemptState" "ReturnRefundAttemptState" NOT NULL DEFAULT 'NONE';
