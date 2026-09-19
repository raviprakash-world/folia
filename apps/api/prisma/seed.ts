/* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument */
// See src/users/users.service.ts's top-of-file comment for why this
// exemption exists — same root cause (PrismaClient typed `any`
// pre-generation), applies here too since this file also can't run until
// `prisma generate` has succeeded (see the root README's Known Issues).
import { PrismaClient } from '@prisma/client';
import { randomBytes } from 'crypto';
import { readFileSync } from 'fs';
import { join } from 'path';
import { hashPassword } from '../src/auth/password.util';

const prisma = new PrismaClient();

// A minimal, real permission set — enough to prove RBAC actually works
// end-to-end. Phase 9's admin RBAC work extends this list; extending it
// later is new rows, not a schema change.
const PERMISSIONS = [
  { key: 'orders:read', description: 'View own orders' },
  { key: 'orders:write', description: 'Create/modify orders' },
  { key: 'products:read', description: 'View products' },
  { key: 'products:write', description: 'Create/edit/delete products' },
  { key: 'customers:read', description: 'View customer accounts' },
  { key: 'customers:write', description: 'Edit customer accounts' },
  { key: 'analytics:read', description: 'View the admin analytics dashboard' },
  // Marketplace Phase 1 — a real, additive permission set for the new
  // 'seller' role. Not yet gated behind @RequirePermissions() anywhere
  // (Marketplace Phase 1's one endpoint, GET /sellers/me, is gated by
  // @RequireSeller() — ownership, not permission — alone); real
  // infrastructure ahead of the write endpoints that will consume these,
  // same status as this seed's own existing permission set was before
  // Phase 9 wired admin RBAC up to it.
  { key: 'seller_profile:read', description: 'View own seller profile' },
  { key: 'seller_profile:write', description: 'Edit own seller profile' },
  { key: 'seller_products:read', description: 'View own seller products' },
  {
    key: 'seller_products:write',
    description: 'Create/edit own seller products',
  },
  {
    key: 'seller_orders:read',
    description: 'View own seller order fulfillments',
  },
  {
    key: 'seller_returns:read',
    description: 'View own seller return claims',
  },
  {
    key: 'seller_earnings:read',
    description: 'View own seller ledger/earnings',
  },
  { key: 'seller_payouts:read', description: 'View own seller payouts' },
];

const CUSTOMER_PERMISSIONS = ['orders:read', 'products:read'];
const ADMIN_PERMISSIONS = PERMISSIONS.map((p) => p.key); // admins get everything
// A seller-role account only gets seller_* permissions — it does NOT need
// orders:read/products:read granted this way, since every customer-facing
// endpoint (orders, cart, wishlist, ...) already carries no @Roles()/
// @RequirePermissions() gate at all (see
// docs/MARKETPLACE_PHASE0_ARCHITECTURE_ASSESSMENT.md §10) — a seller
// keeps shopping as an ordinary customer unchanged, with no extra grant
// needed for that.
const SELLER_PERMISSIONS = PERMISSIONS.filter((p) =>
  p.key.startsWith('seller_'),
).map((p) => p.key);

// The catalog (categories, collections, demo sellers, products, reviews) is
// one JSON file, prisma/demo/catalog.json — also what apps/web's static
// mock data reads, so the storefront looks the same whether it's served by
// this database or by the frontend's offline fixtures. Everything in it is
// FICTIONAL demo content (invented sellers, products, reviews); product
// photos are openly-licensed images credited in apps/web/public/demo/CREDITS.md.
interface CatalogProduct {
  id: string;
  slug: string;
  name: string;
  price: number;
  compareAtPrice: number | null;
  description: string;
  categorySlug: string;
  sellerSlug: string | null;
  badge: string | null;
  careLevel: string | null;
  rating: number | null;
  reviewCount: number | null;
  inStock: boolean;
  stockCount: number;
  createdAt: string;
  variants: { label: string; swatch: string | null; inStock: boolean }[];
  specs: { label: string; value: string }[];
  image: { file: string; alt: string } | null;
}

interface CatalogFile {
  categories: { slug: string; name: string; description: string }[];
  collections: { slug: string; name: string; description: string }[];
  sellers: {
    slug: string;
    displayName: string;
    description: string;
    city: string;
    state: string;
    postalCode: string;
    addressLine1: string;
    phone: string;
  }[];
  products: CatalogProduct[];
  reviews: {
    productId: string;
    author: string;
    rating: number;
    title: string;
    body: string;
    date: string;
    verified: boolean;
  }[];
}

const catalog = JSON.parse(
  readFileSync(join(__dirname, 'demo', 'catalog.json'), 'utf8'),
) as CatalogFile;
const CATEGORIES = catalog.categories;
const COLLECTIONS = catalog.collections;
const PRODUCTS = catalog.products;
const REVIEWS = catalog.reviews;

const BADGE_TO_ENUM: Record<string, string> = {
  New: 'NEW',
  Sale: 'SALE',
  Bestseller: 'BESTSELLER',
  'Low stock': 'LOW_STOCK',
};
const CARE_TO_ENUM: Record<string, string> = {
  Easy: 'EASY',
  Moderate: 'MODERATE',
  Advanced: 'ADVANCED',
};

// Demo accounts carry publicly known passwords (they're printed in the
// README and on the login pages in dev). Fine on a laptop; a real
// vulnerability on a public API. Outside production they behave as always.
// In production they're created with an unguessable random password
// (still usable as catalog owners/notification targets, but nobody can log
// in as them) unless SEED_DEMO_ACCOUNTS=true is set explicitly, and the
// admin account is only created when SEED_ADMIN_EMAIL + SEED_ADMIN_PASSWORD
// are supplied — see docs/MANUAL_SETUP_GUIDE.md.
const knownPasswordsAllowed =
  process.env.NODE_ENV !== 'production' ||
  process.env.SEED_DEMO_ACCOUNTS === 'true';

function demoPasswordHash(knownPassword: string): Promise<string> {
  return hashPassword(
    knownPasswordsAllowed ? knownPassword : randomBytes(32).toString('hex'),
  );
}

async function main() {
  console.log('Seeding permissions...');
  for (const permission of PERMISSIONS) {
    await prisma.permission.upsert({
      where: { key: permission.key },
      update: { description: permission.description },
      create: permission,
    });
  }

  console.log('Seeding roles...');
  const customerRole = await prisma.role.upsert({
    where: { name: 'customer' },
    update: {},
    create: {
      name: 'customer',
      description: 'Default role for storefront customers',
      permissions: { connect: CUSTOMER_PERMISSIONS.map((key) => ({ key })) },
    },
  });

  const adminRole = await prisma.role.upsert({
    where: { name: 'admin' },
    update: {},
    create: {
      name: 'admin',
      description: 'Full administrative access',
      permissions: { connect: ADMIN_PERMISSIONS.map((key) => ({ key })) },
    },
  });

  // Marketplace Phase 1 — additive, matching the customer/admin upserts'
  // own shape exactly. A seller-role account is layered on top of being a
  // regular user, not a replacement for 'customer' — see
  // docs/MARKETPLACE_PHASE0_ARCHITECTURE_ASSESSMENT.md §10.
  const sellerRole = await prisma.role.upsert({
    where: { name: 'seller' },
    update: {},
    create: {
      name: 'seller',
      description: 'Marketplace seller — scoped to their own seller account',
      permissions: { connect: SELLER_PERMISSIONS.map((key) => ({ key })) },
    },
  });

  // Matches apps/web's existing documented demo accounts exactly
  // (apps/web/src/data/users.ts, apps/web/README.md) — once the frontend
  // is switched from MSW to this real API, the same demo credentials
  // continue to work unchanged.
  console.log('Seeding demo accounts...');
  const demoUser = await prisma.user.upsert({
    where: { email: 'demo@folia.example' },
    update: {},
    create: {
      email: 'demo@folia.example',
      passwordHash: await demoPasswordHash('folia-demo'),
      firstName: 'Sam',
      lastName: 'Rivera',
      emailVerified: true,
      emailVerifiedAt: new Date(),
      roleId: customerRole.id,
    },
  });

  const adminEmail = knownPasswordsAllowed
    ? 'admin@folia.example'
    : process.env.SEED_ADMIN_EMAIL;
  const adminPassword = knownPasswordsAllowed
    ? 'folia-admin'
    : process.env.SEED_ADMIN_PASSWORD;
  if (adminEmail && adminPassword) {
    if (!knownPasswordsAllowed && adminPassword.length < 12) {
      throw new Error('SEED_ADMIN_PASSWORD must be at least 12 characters.');
    }
    await prisma.user.upsert({
      where: { email: adminEmail },
      update: {},
      create: {
        email: adminEmail,
        passwordHash: await hashPassword(adminPassword),
        firstName: 'Admin',
        lastName: 'User',
        emailVerified: true,
        emailVerifiedAt: new Date(),
        roleId: adminRole.id,
      },
    });
  } else {
    console.log(
      'Production seed: no admin created (set SEED_ADMIN_EMAIL + SEED_ADMIN_PASSWORD to create one).',
    );
  }

  // An earlier version of this seed created these accounts with their
  // publicly-known passwords in whatever database it ran against. Setting
  // SEED_LOCK_DEMO_ACCOUNTS=true (production only) replaces those passwords
  // with random ones and revokes their sessions — a one-off cleanup for a
  // database that was already seeded that way.
  if (!knownPasswordsAllowed && process.env.SEED_LOCK_DEMO_ACCOUNTS === 'true') {
    const knownEmails = [
      'demo@folia.example',
      'admin@folia.example',
      'seller@folia.example',
    ];
    const locked = await prisma.user.updateMany({
      where: { email: { in: knownEmails } },
      data: { passwordHash: await hashPassword(randomBytes(32).toString('hex')) },
    });
    await prisma.session.deleteMany({
      where: { user: { email: { in: knownEmails } } },
    });
    // The old demo seller carried a plausible-looking (but invented) GSTIN.
    await prisma.seller.updateMany({
      where: { slug: 'terracotta-and-fern', gstin: '27ABCDE1234F1Z0' },
      data: { gstin: null },
    });
    console.log(`Locked ${locked.count} demo account(s): random password set, sessions revoked.`);
  }

  // Marketplace Phase 1 — a demo seller account, seeded directly with an
  // ACTIVE Seller row (rather than left mid-application) so every later
  // marketplace phase can immediately exercise seller-dashboard
  // functionality against a real account, matching how admin@folia.example
  // is already a fully-privileged demo account rather than one stuck
  // mid-setup. The application flow itself (Marketplace Phase 2) still
  // gets its own real, separately-testable path — this doesn't shortcut
  // that, it just means this ONE demo account skips needing to be run
  // through it manually every time.
  const demoSellerUser = await prisma.user.upsert({
    where: { email: 'seller@folia.example' },
    update: {},
    create: {
      email: 'seller@folia.example',
      passwordHash: await demoPasswordHash('folia-seller'),
      firstName: 'Priya',
      lastName: 'Menon',
      emailVerified: true,
      emailVerifiedAt: new Date(),
      roleId: sellerRole.id,
    },
  });
  await prisma.seller.upsert({
    where: { userId: demoSellerUser.id },
    update: {},
    create: {
      userId: demoSellerUser.id,
      slug: 'terracotta-and-fern',
      displayName: 'Terracotta & Fern',
      description:
        'Small-batch hand-thrown planters and easy-care houseplants, based in Pune.',
      contactEmail: 'hello@terracottaandfern.example',
      contactPhone: '+91 98765 43210',
      status: 'ACTIVE',
      approvedAt: new Date(),
    },
  });

  // Marketplace Phase 8 — the marketplace-default commission rate. No
  // natural unique key to upsert() against (versioned by effectiveFrom,
  // like a rate change), so idempotency is a plain existence check, same
  // pattern as the notifications block below.
  const existingDefaultCommission = await prisma.sellerCommission.count({
    where: { sellerId: null },
  });
  if (existingDefaultCommission === 0) {
    await prisma.sellerCommission.create({
      data: { sellerId: null, ratePercent: 10 },
    });
  }

  console.log(`Seeding ${catalog.sellers.length} demo sellers...`);
  const sellerIdBySlug = new Map<string, string>();
  for (const s of catalog.sellers) {
    const owner =
      s.slug === 'terracotta-and-fern'
        ? demoSellerUser
        : await prisma.user.upsert({
            where: { email: `${s.slug}@folia.example` },
            update: {},
            create: {
              email: `${s.slug}@folia.example`,
              // Catalog owners only — nobody is meant to log in as them.
              passwordHash: await hashPassword(randomBytes(32).toString('hex')),
              firstName: s.displayName,
              lastName: '(demo seller)',
              emailVerified: true,
              emailVerifiedAt: new Date(),
              roleId: sellerRole.id,
            },
          });
    const seller = await prisma.seller.upsert({
      where: { userId: owner.id },
      update: {},
      create: {
        userId: owner.id,
        slug: s.slug,
        displayName: s.displayName,
        description: s.description,
        contactEmail: `hello@${s.slug}.example`,
        contactPhone: s.phone,
        status: 'ACTIVE',
        approvedAt: new Date(),
      },
    });
    await prisma.sellerAddress.upsert({
      where: { sellerId: seller.id },
      update: {},
      create: {
        sellerId: seller.id,
        addressLine1: s.addressLine1,
        city: s.city,
        state: s.state,
        country: 'IN',
        postalCode: s.postalCode,
      },
    });
    sellerIdBySlug.set(s.slug, seller.id);
  }

  console.log('Seeding categories and collections...');
  const categoryBySlug = new Map<string, string>();
  for (const category of CATEGORIES) {
    const record = await prisma.category.upsert({
      where: { slug: category.slug },
      update: { name: category.name, description: category.description },
      create: { ...category, type: 'CATEGORY' },
    });
    categoryBySlug.set(category.slug, record.id);
  }
  for (const collection of COLLECTIONS) {
    await prisma.category.upsert({
      where: { slug: collection.slug },
      update: { name: collection.name, description: collection.description },
      create: { ...collection, type: 'COLLECTION' },
    });
  }

  console.log(
    `Seeding ${PRODUCTS.length} products (prisma/demo/catalog.json)...`,
  );
  for (const p of PRODUCTS) {
    const categoryId = categoryBySlug.get(p.categorySlug);
    if (!categoryId) {
      throw new Error(
        `Product ${p.slug} references unknown category slug "${p.categorySlug}" — check CATEGORIES above.`,
      );
    }

    const sellerId = p.sellerSlug ? sellerIdBySlug.get(p.sellerSlug) : undefined;
    if (p.sellerSlug && !sellerId) {
      throw new Error(`Product ${p.slug} references unknown seller "${p.sellerSlug}".`);
    }

    // Price/description are refreshed on re-seed (they're demo-catalog
    // copy, e.g. the old USD-scale prices); stock, badge, ratings and any
    // other admin/seller edits are left alone.
    const product = await prisma.product.upsert({
      where: { slug: p.slug },
      update: {
        price: p.price,
        compareAtPrice: p.compareAtPrice,
        description: p.description,
      },
      create: {
        id: p.id,
        slug: p.slug,
        name: p.name,
        price: p.price,
        compareAtPrice: p.compareAtPrice,
        description: p.description,
        categoryId,
        ...(sellerId && { sellerId, ownerType: 'SELLER_OWNED' as never }),
        badge: (p.badge ? BADGE_TO_ENUM[p.badge] : undefined) as never,
        careLevel: (p.careLevel ? CARE_TO_ENUM[p.careLevel] : undefined) as never,
        rating: p.rating ?? undefined,
        reviewCount: p.reviewCount ?? 0,
        inStock: p.inStock,
        stockCount: p.stockCount,
        createdAt: new Date(p.createdAt),
        variants: {
          create: p.variants.map((v) => ({
            label: v.label,
            swatch: v.swatch,
            inStock: v.inStock,
          })),
        },
        specs: { create: p.specs },
      },
    });

    if (p.image && (await prisma.productImage.count({ where: { productId: product.id } })) === 0) {
      await prisma.productImage.create({
        data: {
          productId: product.id,
          url: `/demo/products/${p.image.file}`,
          altText: p.image.alt,
          position: 0,
        },
      });
    }
  }

  console.log(`Seeding ${REVIEWS.length} reviews...`);
  // Reviews have no natural unique key, so re-seeding replaces the demo
  // reviews wholesale: a seeded review is exactly one with userId = null
  // (every real review carries the author's userId — ReviewsService), so
  // real customer reviews are never touched. This also refreshes reviews
  // seeded by older versions of this file.
  await prisma.review.deleteMany({
    where: {
      userId: null,
      productId: { in: PRODUCTS.map((p) => p.id) },
    },
  });
  await prisma.review.createMany({
    data: REVIEWS.map((r) => ({
      productId: r.productId,
      author: r.author,
      rating: r.rating,
      title: r.title,
      body: r.body,
      date: new Date(r.date),
      verified: r.verified,
    })),
  });

  console.log('Seeding warehouse and inventory...');
  const mainWarehouse = await prisma.warehouse.upsert({
    where: { code: 'MAIN' },
    update: {},
    create: { code: 'MAIN', name: 'Main Warehouse', isDefault: true },
  });

  // Distributes each product's original mock stockCount across its
  // in-stock variants (splitting fairly, never assigning stock to a
  // variant already marked out-of-stock) rather than giving every variant
  // the full amount — that would inflate total availability when summed
  // across variants, which InventoryService.getAvailability() does for
  // real once this data exists. Products with no variants get one
  // InventoryItem carrying the full stockCount.
  for (const p of PRODUCTS) {
    const dbProduct = await prisma.product.findUnique({
      where: { slug: p.slug },
      include: { variants: true },
    });
    if (!dbProduct) continue; // shouldn't happen — product was just upserted above

    const existingItem = await prisma.inventoryItem.findFirst({
      where: { productId: dbProduct.id },
    });
    if (existingItem) continue; // already seeded on a previous run

    if (dbProduct.variants.length === 0) {
      await prisma.inventoryItem.create({
        data: {
          sku: `${p.slug.toUpperCase()}-MAIN`,
          productId: dbProduct.id,
          warehouseId: mainWarehouse.id,
          quantityOnHand: p.stockCount,
        },
      });
      continue;
    }

    const inStockVariants = dbProduct.variants.filter(
      (v: { inStock: boolean }) => v.inStock,
    );
    const perVariantStock =
      inStockVariants.length > 0
        ? Math.max(1, Math.floor(p.stockCount / inStockVariants.length))
        : 0;

    for (const [index, variant] of dbProduct.variants.entries()) {
      await prisma.inventoryItem.create({
        data: {
          sku: `${p.slug.toUpperCase()}-V${index + 1}-MAIN`,
          productId: dbProduct.id,
          variantId: variant.id,
          warehouseId: mainWarehouse.id,
          quantityOnHand: variant.inStock ? perVariantStock : 0,
        },
      });
    }
  }

  console.log('Seeding coupons...');
  // Matches apps/web/src/data/coupons.ts exactly.
  await prisma.coupon.upsert({
    where: { code: 'FOLIA10' },
    update: {},
    create: {
      code: 'FOLIA10',
      type: 'PERCENT',
      value: 10,
      description: '10% off your order',
    },
  });
  await prisma.coupon.upsert({
    where: { code: 'WELCOME5' },
    update: {},
    create: {
      code: 'WELCOME5',
      type: 'FIXED',
      value: 200,
      description: '₹200 off orders over ₹1,000',
      minSubtotal: 1000,
    },
  });

  console.log('Seeding notifications...');
  // No natural unique key on Notification (unlike coupon.code/user.email
  // above) to upsert() against, so idempotency is a plain existence
  // check instead — running this seed again after notifications already
  // exist for the demo user is a no-op, not a duplicate-adding operation.
  const existingNotificationCount = await prisma.notification.count({
    where: { userId: demoUser.id },
  });
  if (existingNotificationCount === 0) {
    const now = Date.now();
    const DAY_MS = 24 * 60 * 60 * 1000;
    await prisma.notification.createMany({
      data: [
        {
          userId: demoUser.id,
          type: 'ORDER',
          title: 'Order Placed',
          message: 'Your order was placed successfully.',
          read: true,
          createdAt: new Date(now - 6 * DAY_MS),
        },
        {
          userId: demoUser.id,
          type: 'ACCOUNT',
          title: 'Profile Updated',
          message: 'Your profile details were saved.',
          read: true,
          createdAt: new Date(now - 4 * DAY_MS),
        },
        {
          userId: demoUser.id,
          type: 'PROMOTION',
          title: 'Free shipping this week',
          message: 'Orders over ₹75 ship free — no code needed.',
          href: '/shop',
          read: false,
          createdAt: new Date(now - 2 * DAY_MS),
        },
        {
          userId: demoUser.id,
          type: 'WISHLIST',
          title: 'Price drop on your wishlist',
          message: 'An item on your wishlist is now on sale.',
          href: '/wishlist',
          read: false,
          createdAt: new Date(now - 1 * DAY_MS),
        },
      ],
    });
  }

  console.log('Seed complete.');
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
