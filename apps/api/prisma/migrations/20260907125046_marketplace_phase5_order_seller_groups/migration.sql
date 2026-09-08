-- Marketplace Phase 5 — order-seller-group backfill.
--
-- Order matters here: create the new table first, add the new OrderItem
-- column as NULLABLE, backfill every existing row, THEN enforce NOT NULL
-- and add the foreign key — the exact nullable -> backfill -> NOT NULL
-- sequence this codebase already used for ReturnRequest.claimType/
-- updatedAt (see the phase6d_returns_doa_replacement_storecredit
-- migration for the precedent).

-- CreateTable
CREATE TABLE "order_seller_groups" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "sellerId" TEXT,
    "status" "OrderStatus" NOT NULL DEFAULT 'PROCESSING',
    "subtotal" DECIMAL(10,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "order_seller_groups_pkey" PRIMARY KEY ("id")
);

-- AlterTable: order_items.orderSellerGroupId — nullable for now, no
-- backfill issue yet (every existing row simply starts NULL until the
-- backfill statements below run).
ALTER TABLE "order_items" ADD COLUMN "orderSellerGroupId" TEXT;

-- One-time backfill: every existing Order gets exactly one
-- OrderSellerGroup with sellerId: NULL (Folia-fulfilled) — the only
-- possibility for an order placed before Marketplace Phase 3 ever let a
-- SELLER_OWNED product become orderable, so this is unambiguously
-- correct, not a guess. Mirrors the order's own status/subtotal/
-- createdAt/updatedAt at backfill time, matching the frozen-at-creation
-- philosophy every other pricing/status field on Order already follows.
INSERT INTO "order_seller_groups" ("id", "orderId", "sellerId", "status", "subtotal", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, o."id", NULL, o."status", o."subtotal", o."createdAt", o."updatedAt"
FROM "orders" o;

-- Point every existing OrderItem at the group just created for its own order.
UPDATE "order_items" oi
SET "orderSellerGroupId" = osg."id"
FROM "order_seller_groups" osg
WHERE osg."orderId" = oi."orderId";

-- Now safe: every row has a real value.
ALTER TABLE "order_items" ALTER COLUMN "orderSellerGroupId" SET NOT NULL;

-- CreateIndex
CREATE INDEX "order_seller_groups_orderId_idx" ON "order_seller_groups"("orderId");

-- CreateIndex
CREATE INDEX "order_seller_groups_sellerId_idx" ON "order_seller_groups"("sellerId");

-- CreateIndex
CREATE INDEX "order_items_orderSellerGroupId_idx" ON "order_items"("orderSellerGroupId");

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_orderSellerGroupId_fkey" FOREIGN KEY ("orderSellerGroupId") REFERENCES "order_seller_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_seller_groups" ADD CONSTRAINT "order_seller_groups_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_seller_groups" ADD CONSTRAINT "order_seller_groups_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "sellers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
