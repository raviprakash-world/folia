export function formatCurrency(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

/** Formats a stored ISO timestamp for human display — order.createdAt is a full timestamp (needed for tracking math), not just a date. */
export function formatDate(isoString: string): string {
  return new Date(isoString).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}
