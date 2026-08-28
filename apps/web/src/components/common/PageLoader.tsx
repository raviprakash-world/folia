export function PageLoader() {
  return (
    <div className="flex items-center justify-center py-32" role="status" aria-label="Loading page">
      <div className="w-6 h-6 border-2 border-stone-dark border-t-fern rounded-full animate-spin" />
    </div>
  );
}
