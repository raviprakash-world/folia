import type { SellerLedgerEntry, SellerPayout } from '@prisma/client';

export interface PublicLedgerEntry {
  id: string;
  type: string;
  amount: number;
  referenceType: string | null;
  referenceId: string | null;
  note: string | null;
  createdAt: Date;
}

export function toPublicLedgerEntry(
  entry: SellerLedgerEntry,
): PublicLedgerEntry {
  return {
    id: entry.id,
    type: entry.type,
    amount: Number(entry.amount),
    referenceType: entry.referenceType,
    referenceId: entry.referenceId,
    note: entry.note,
    createdAt: entry.createdAt,
  };
}

export interface PublicPayout {
  id: string;
  status: string;
  amount: number;
  failureReason: string | null;
  processedAt: Date | null;
  createdAt: Date;
}

export function toPublicPayout(payout: SellerPayout): PublicPayout {
  return {
    id: payout.id,
    status: payout.status,
    amount: Number(payout.amount),
    failureReason: payout.failureReason,
    processedAt: payout.processedAt,
    createdAt: payout.createdAt,
  };
}
