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
