export function generateOrderId(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const suffix = Math.floor(1000 + Math.random() * 9000); // 4-digit
  return `FOL-${y}${m}${d}-${suffix}`;
}

export function generateTransactionId(): string {
  return `txn_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

export function generateInvoiceNumber(orderId: string): string {
  // Deterministic from the order id — same order always gets the same invoice number.
  let hash = 0;
  for (let i = 0; i < orderId.length; i++) {
    hash = (hash << 5) - hash + orderId.charCodeAt(i);
    hash |= 0;
  }
  const digits = String(Math.abs(hash)).slice(0, 6).padStart(6, '0');
  return `INV-${digits}`;
}
