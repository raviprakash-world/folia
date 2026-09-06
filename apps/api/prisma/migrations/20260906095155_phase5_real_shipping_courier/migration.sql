-- Phase 5 (real shipping/courier integration): the fixed 5-fictional-
-- courier enum can't represent a real courier aggregator's actual
-- courier names (Delhivery, Bluedart, Ecom Express, ...), so courierId
-- becomes free text. courierId/trackingNumber are also no longer known
-- at order-creation time — an Order is created the moment payment
-- resolves, genuinely before any courier has been chosen or an AWB
-- assigned (that now happens later, via the admin "ship this order"
-- action) — so both become nullable. trackingUrl is new: a real,
-- direct link to the shipment's tracking page, when the provider
-- returns one.
--
-- No data is deleted: existing orders' enum values (e.g. 'SWIFTPOST')
-- are preserved verbatim as text via the explicit cast below.

ALTER TABLE "orders" ALTER COLUMN "courierId" TYPE TEXT USING "courierId"::TEXT;
ALTER TABLE "orders" ALTER COLUMN "courierId" DROP NOT NULL;
ALTER TABLE "orders" ALTER COLUMN "trackingNumber" DROP NOT NULL;
ALTER TABLE "orders" ADD COLUMN "trackingUrl" TEXT;
ALTER TABLE "orders" ADD COLUMN "shippedAt" TIMESTAMP(3);

DROP TYPE "CourierId";
