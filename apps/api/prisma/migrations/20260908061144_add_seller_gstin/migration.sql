-- P0-F — India-commerce correctness. Nullable, unique GSTIN on sellers.
-- Safe against existing data the same way reviews.userId's migration
-- was: Postgres treats every NULL as distinct under a unique index, so
-- every pre-existing seller row (all NULL gstin) is unaffected — this
-- only ever constrains "at most one seller per real GSTIN" going
-- forward, once a seller actually provides one.
ALTER TABLE "sellers" ADD COLUMN "gstin" TEXT;

CREATE UNIQUE INDEX "sellers_gstin_key" ON "sellers"("gstin");
