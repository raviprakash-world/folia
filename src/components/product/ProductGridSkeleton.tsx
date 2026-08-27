import { Card } from '@/components/ui/Card';

export function ProductCardSkeleton() {
  return (
    <Card variant="flat" className="p-4" aria-hidden="true">
      <div className="aspect-square rounded-[var(--radius-control)] bg-stone-dark animate-pulse mb-4" />
      <div className="h-4 w-3/4 bg-stone-dark animate-pulse rounded mb-2" />
      <div className="h-4 w-1/3 bg-stone-dark animate-pulse rounded" />
    </Card>
  );
}

export function ProductGridSkeleton({ count = 12 }: { count?: number }) {
  return (
    <div
      className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6"
      role="status"
      aria-label="Loading products"
    >
      {Array.from({ length: count }).map((_, i) => (
        <ProductCardSkeleton key={i} />
      ))}
    </div>
  );
}
