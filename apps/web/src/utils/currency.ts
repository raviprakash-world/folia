export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(amount);
}

/** Shopper-facing price: whole rupees drop the ".00" (₹899, not ₹899.00). Order totals still use formatCurrency so paise stay visible where money is settled. */
export function formatPrice(amount: number): string {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(amount);
}

/** Whole-number percent off, or 0 when there is no real discount. */
export function discountPercent(price: number, compareAtPrice?: number): number {
  if (!compareAtPrice || compareAtPrice <= price) return 0;
  return Math.round((1 - price / compareAtPrice) * 100);
}

/**
 * jsPDF's built-in standard fonts (Helvetica/Times/Courier) only support
 * WinAnsi-encoded glyphs and have no ₹ (U+20B9) — using formatCurrency's
 * real rupee sign there renders as a blank box. Invoice PDF generation
 * uses this ASCII-safe form instead; every other real display uses ₹.
 */
export function formatCurrencyForPdf(amount: number): string {
  return `Rs. ${amount.toFixed(2)}`;
}

/** Formats a stored ISO timestamp for human display — order.createdAt is a full timestamp (needed for tracking math), not just a date. */
export function formatDate(isoString: string): string {
  return new Date(isoString).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' });
}
