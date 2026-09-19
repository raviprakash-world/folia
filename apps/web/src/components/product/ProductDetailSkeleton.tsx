/** Same footprint as the loaded page (square photo, then title, price and blocks), so nothing jumps when data arrives. */
export function ProductDetailSkeleton() {
  return (
    <div role="status" aria-label="Loading product" className="mx-auto w-full max-w-[var(--container-content)] px-4 pb-28 pt-4 md:px-6 md:py-12">
      <div className="mb-4 h-4 w-48 animate-pulse rounded bg-stone-dark" />
      <div className="grid gap-6 md:grid-cols-2 md:gap-12">
        <div className="-mx-4 aspect-square animate-pulse bg-stone-dark md:mx-0 md:rounded-[var(--radius-card)]" />
        <div className="flex flex-col gap-4">
          <div className="h-8 w-3/4 animate-pulse rounded bg-stone-dark" />
          <div className="h-4 w-1/3 animate-pulse rounded bg-stone-dark" />
          <div className="h-8 w-1/2 animate-pulse rounded bg-stone-dark" />
          <div className="h-28 animate-pulse rounded-[var(--radius-card)] bg-stone-dark" />
          <div className="grid grid-cols-2 gap-2.5">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-16 animate-pulse rounded-[var(--radius-control)] bg-stone-dark" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
