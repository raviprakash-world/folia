// Prisma seed script — run via `npm run prisma:seed`.
//
// Empty at Phase 0: there are no models yet to seed (see schema.prisma's
// header comment — User/Session/Role/Permission are Phase 1's
// deliverable). This file exists now so the `prisma:seed` script and the
// `package.json#prisma.seed` wiring are both in place and correct before
// there's real data to seed, rather than bolting seeding on retroactively.

async function main() {
  console.log('No models to seed yet — this will populate real data starting in Phase 1.');
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
