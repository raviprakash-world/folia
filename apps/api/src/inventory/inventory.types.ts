// See users/user.types.ts's top-of-file comment for why these are hand-written.
export type ReservationStatus = 'ACTIVE' | 'COMMITTED' | 'RELEASED' | 'EXPIRED';
export type ReservationReferenceType = 'CART' | 'ORDER' | 'PAYMENT';

export interface InventoryItemRecord {
  id: string;
  sku: string;
  productId: string;
  variantId: string | null;
  warehouseId: string;
  quantityOnHand: number;
  quantityReserved: number;
  reorderPoint: number;
}

export interface StockReservationRecord {
  id: string;
  inventoryItemId: string;
  quantity: number;
  referenceType: ReservationReferenceType;
  referenceId: string;
  status: ReservationStatus;
  expiresAt: Date;
}

export interface WarehouseRecord {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
  isDefault: boolean;
}
