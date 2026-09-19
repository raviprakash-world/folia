-- Curated collections: which collections each product is listed in.
ALTER TABLE "products" ADD COLUMN "collectionSlugs" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- Backfill the demo catalog (same lists as apps/api/prisma/demo/catalog.json).
UPDATE "products" SET "collectionSlugs" = ARRAY['low-light-plants','gifting','new-home','office'] WHERE "slug" = 'snake-plant-laurentii';
UPDATE "products" SET "collectionSlugs" = ARRAY['low-light-plants','new-home','office'] WHERE "slug" = 'pothos-marble-queen';
UPDATE "products" SET "collectionSlugs" = ARRAY['low-light-plants','pet-friendly'] WHERE "slug" = 'bird-s-nest-fern';
UPDATE "products" SET "collectionSlugs" = ARRAY['pet-friendly'] WHERE "slug" = 'calathea-orbifolia';
UPDATE "products" SET "collectionSlugs" = ARRAY['low-light-plants','new-home','office'] WHERE "slug" = 'zz-plant';
UPDATE "products" SET "collectionSlugs" = ARRAY['office'] WHERE "slug" = 'rubber-plant-burgundy';
UPDATE "products" SET "collectionSlugs" = ARRAY['low-light-plants','flowering','gifting','office'] WHERE "slug" = 'peace-lily';
UPDATE "products" SET "collectionSlugs" = ARRAY['low-light-plants','pet-friendly'] WHERE "slug" = 'boston-fern';
UPDATE "products" SET "collectionSlugs" = ARRAY['pet-friendly','office'] WHERE "slug" = 'areca-palm';
UPDATE "products" SET "collectionSlugs" = ARRAY['statement-vessels','gifting'] WHERE "slug" = 'ceramic-vessel-ash';
UPDATE "products" SET "collectionSlugs" = ARRAY['statement-vessels'] WHERE "slug" = 'stone-planter-round';
UPDATE "products" SET "collectionSlugs" = ARRAY['baskets'] WHERE "slug" = 'woven-plant-basket';
UPDATE "products" SET "collectionSlugs" = ARRAY['statement-vessels'] WHERE "slug" = 'matte-black-cylinder-pot';
UPDATE "products" SET "collectionSlugs" = ARRAY['statement-vessels'] WHERE "slug" = 'fluted-ceramic-planter';
UPDATE "products" SET "collectionSlugs" = ARRAY['gifting'] WHERE "slug" = 'brass-plant-mister';
UPDATE "products" SET "collectionSlugs" = ARRAY['office'] WHERE "slug" = 'soil-moisture-meter';
UPDATE "products" SET "collectionSlugs" = ARRAY['new-home'] WHERE "slug" = 'watering-can-1-5l';
UPDATE "products" SET "collectionSlugs" = ARRAY['low-light-plants','gifting','new-home'] WHERE "slug" = 'money-plant-golden-pothos';
UPDATE "products" SET "collectionSlugs" = ARRAY['pet-friendly','new-home'] WHERE "slug" = 'spider-plant';
UPDATE "products" SET "collectionSlugs" = ARRAY['low-light-plants','office'] WHERE "slug" = 'philodendron-heartleaf';
UPDATE "products" SET "collectionSlugs" = ARRAY['low-light-plants','gifting'] WHERE "slug" = 'lucky-bamboo';
UPDATE "products" SET "collectionSlugs" = ARRAY['flowering'] WHERE "slug" = 'bougainvillea';
UPDATE "products" SET "collectionSlugs" = ARRAY['flowering'] WHERE "slug" = 'hibiscus';
UPDATE "products" SET "collectionSlugs" = ARRAY['pet-friendly','flowering'] WHERE "slug" = 'jasmine-mogra';
UPDATE "products" SET "collectionSlugs" = ARRAY['pet-friendly','flowering'] WHERE "slug" = 'rose-desi-gulab';
UPDATE "products" SET "collectionSlugs" = ARRAY['flowering'] WHERE "slug" = 'marigold-genda';
UPDATE "products" SET "collectionSlugs" = ARRAY['flowering'] WHERE "slug" = 'ixora';
UPDATE "products" SET "collectionSlugs" = ARRAY['gifting','new-home'] WHERE "slug" = 'aloe-vera';
UPDATE "products" SET "collectionSlugs" = ARRAY['gifting','new-home'] WHERE "slug" = 'classic-terracotta-planter';
UPDATE "products" SET "collectionSlugs" = ARRAY['statement-vessels'] WHERE "slug" = 'ribbed-cement-pot';
UPDATE "products" SET "collectionSlugs" = ARRAY['baskets'] WHERE "slug" = 'hanging-macrame-planter';
UPDATE "products" SET "collectionSlugs" = ARRAY['office'] WHERE "slug" = 'self-watering-planter';
UPDATE "products" SET "collectionSlugs" = ARRAY['new-home'] WHERE "slug" = 'organic-potting-mix';
UPDATE "products" SET "collectionSlugs" = ARRAY['baskets'] WHERE "slug" = 'macrame-plant-hanger';
UPDATE "products" SET "collectionSlugs" = ARRAY['baskets'] WHERE "slug" = 'bamboo-planter-stand';

-- Correct pet-safety facts in already-seeded databases (the seed only writes specs on create).
UPDATE "product_specs" SET "value" = 'No — toxic if ingested' WHERE "label" = 'Pet safe' AND "productId" IN (SELECT "id" FROM "products" WHERE "slug" = 'monstera-deliciosa');
UPDATE "product_specs" SET "value" = 'No — toxic if ingested' WHERE "label" = 'Pet safe' AND "productId" IN (SELECT "id" FROM "products" WHERE "slug" = 'zz-plant');
UPDATE "product_specs" SET "value" = 'No — toxic if ingested' WHERE "label" = 'Pet safe' AND "productId" IN (SELECT "id" FROM "products" WHERE "slug" = 'peace-lily');
UPDATE "product_specs" SET "value" = 'No — toxic if ingested' WHERE "label" = 'Pet safe' AND "productId" IN (SELECT "id" FROM "products" WHERE "slug" = 'string-of-pearls');
UPDATE "product_specs" SET "value" = 'Yes' WHERE "label" = 'Pet safe' AND "productId" IN (SELECT "id" FROM "products" WHERE "slug" = 'boston-fern');
