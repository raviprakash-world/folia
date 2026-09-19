function ProductCardSkeleton() {
  return (
    <div aria-hidden="true">
      <div className="aspect-square animate-pulse rounded-[var(--radius-card)] bg-stone-dark" />
      <div className="mt-3 h-3 w-1/3 animate-pulse rounded bg-stone-dark" />
      <div className="mt-2 h-4 w-11/12 animate-pulse rounded bg-stone-dark" />
      <div className="mt-1.5 h-4 w-2/3 animate-pulse rounded bg-stone-dark" />
      <div className="mt-2.5 h-5 w-1/2 animate-pulse rounded bg-stone-dark" />
    </div>
  );
}

export function ProductGridSkeleton({ count = 12 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-x-3 gap-y-7 sm:grid-cols-3 sm:gap-x-5 lg:gap-x-6" role="status" aria-label="Loading products">
      {Array.from({ length: count }).map((_, i) => (
        <ProductCardSkeleton key={i} />
      ))}
    </div>
  );
}
