-- Marketplace Phase 13 — adds a real, nullable userId to reviews (every
-- pre-existing seeded row backfills to NULL, left untouched) plus the
-- unique(productId, userId) constraint that makes ReviewsService's
-- verified-purchase duplicate guard possible. Safe against existing data:
-- Postgres treats every NULL as distinct under a unique index, so the
-- many pre-existing reviews sharing a productId (all NULL userId) are
-- completely unaffected — this only ever constrains "one review per
-- (product, real userId)" going forward.
ALTER TABLE "reviews" ADD COLUMN "userId" TEXT;

CREATE UNIQUE INDEX "reviews_productId_userId_key" ON "reviews"("productId", "userId");
