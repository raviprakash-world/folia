# Database

PostgreSQL 16 + Prisma 6. Schema: `prisma/schema.prisma`. 29 models, 15
enums, built incrementally across Phases 0–12 — see `CHANGELOG.md` for
the reasoning behind each addition, not repeated here. This document
covers the schema's overall shape and the handful of deliberate,
cross-cutting design decisions worth knowing before changing it.

## Migration status — read this before anything else

**No migration has ever actually been run against a real database in
this project's history.** `binaries.prisma.sh` is unreachable in the
sandbox this was built in (see the root README's "Known Issues"), which
blocks `prisma generate` and therefore `prisma migrate dev`. Every
schema change across all 12 phases was instead **hand-verified**:
translated to raw SQL by hand and run directly against a real, running
PostgreSQL instance (`psql`), with real inserted data proving the
actual behavior — constraints, cascades, index usage, JSON
aggregation — not just that the SQL parses. Each phase's `CHANGELOG.md`
entry for a schema change includes what was specifically proven this
way (e.g. Phase 11's idempotency constraint: real NULL-vs-duplicate-key
behavior, checked with real `INSERT`s).

This means: the schema is real and has been checked carefully, but
**no `migration/` directory of generated migration files exists**, and
`npx prisma migrate dev` has never actually been run to create one. The
first real environment with working internet access needs to run
`npx prisma generate && npx prisma migrate dev --name init` to produce
the actual migration history — this is expected, not an oversight.

## Domains

| Domain | Models | Phase |
|---|---|---|
| Auth & users | `User`, `Role`, `Permission`, `Session`, `PasswordResetToken`, `EmailVerificationToken` | 1 |
| Catalog | `Category`, `Brand`, `Product`, `ProductVariant`, `ProductSpec`, `ProductImage`, `Tag`, `Review` | 2 |
| Inventory | `Warehouse`, `InventoryItem`, `StockReservation` | 3 |
| Cart & wishlist | `Cart`, `CartItem`, `WishlistItem`, `Coupon` | 4 |
| Checkout | `Address`, `Order`, `OrderItem` | 5 |
| Order management | `CancellationRequest`, `ReturnRequest` | 6 |
| Search | `SearchQuery` | 7 |
| Recommendations & analytics | `AnalyticsEvent` | 8 |
| Admin | `AuditLog` | 9 |

## Deliberate design decisions worth knowing

### Soft deletes, not hard deletes, for anything with order history

`User`, `Product` both use `deletedAt: DateTime?` rather than actual
row deletion. `Order.user` is `onDelete: Restrict` specifically —
proven with real inserted data (Phase 5) that Postgres genuinely
refuses to delete a user with order history, not just that the schema
declares the intent.

### Two tables deliberately have NO foreign keys — `AnalyticsEvent` and `AuditLog`

Every other table in this schema uses real foreign keys. These two
don't, on purpose: an analytics or audit trail should stay valid and
queryable after the entity it references is deleted (you still want to
know "this product was viewed 40 times" after the product is gone), and
a logging write should never be able to fail because of a
transactional-entity constraint. Documented directly in the schema
comments for each model, not just here.

### JSON snapshot columns instead of duplicated flat columns

`Order.shippingAddressSnapshot`/`billingAddressSnapshot` store the full
`Address` shape as JSON, not ~24 duplicated flat columns (12 address
fields × shipping/billing). This was a real mid-build reversal (Phase
5): the first version used flat columns, and was replaced before any
service was built on top of it once it became clear that design
couldn't even fully capture the `Address` type. The right general
pattern for "preserve this whole object as it was at a point in time,"
not something you'd ever filter or sort on a single field of.

### Compound unique constraints doing real work, not just uniqueness

- `Order.@@unique([userId, idempotencyKey])` — the actual mechanism
  preventing a double-submitted checkout from creating two orders
  (Phase 11). `idempotencyKey` is nullable; Postgres's standard
  NULL-never-equals-NULL semantics mean orders with no key never
  collide with each other, only a genuine repeated key for the same
  user does — proven with real `INSERT`s, not assumed from the SQL
  standard.
- `WishlistItem.@@unique([userId, productId])` — the same
  compound-unique-as-natural-index pattern used instead of a separate
  index, since every real query already filters by both fields
  together.

### Fields that exist but aren't fully wired up yet

`InventoryItem.reorderPoint` has existed since Phase 3 but had nothing
reading it until Phase 9's `getLowStockItems()`. If you're auditing the
schema for dead columns, check the relevant phase's service code before
assuming a field is unused — several were added ahead of the feature
that would consume them, with that intent stated in the schema comment.

## Seed data

`prisma/seed.ts` — real catalog data (24 products, 72 reviews) parsed
programmatically from the frontend's own `apps/web/src/data/` files
(Phase 2), not hand-typed, so it can't drift from what the frontend
actually displays. Demo accounts:
`demo@folia.example` / `folia-demo` (customer),
`admin@folia.example` / `folia-admin` (admin).

## Indexes

Every index added has a stated reason in its model's schema comment or
the relevant `CHANGELOG.md` entry — none were added speculatively.
`OrderItem.productId` (Phase 11) is the one index added specifically
*because* a query pattern introduced in the same phase needed it,
verified with a real `EXPLAIN` against 20,000 rows showing the planner
actually chooses the new index over a sequential scan.
