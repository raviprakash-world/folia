import type { CourierId } from '@/types/order';

export interface Courier {
  id: CourierId;
  name: string;
  monogram: string;
  color: string;
  supportPhone: string;
  supportEmail: string;
}

/**
 * Fictional couriers, standing in for real logistics companies the brief
 * named (Blue Dart, Delhivery, DTDC, Ekart, XpressBees) — those are real,
 * currently-operating companies with real trademarks, and this project has
 * consistently avoided reproducing real brand assets throughout (see
 * ARCHITECTURE.md). Same functional role, invented names — including the
 * support contact details below, which are fictional.
 */
export const couriers: Courier[] = [
  { id: 'swiftpost', name: 'SwiftPost', monogram: 'SP', color: '#2B4638', supportPhone: '(800) 555-0142', supportEmail: 'support@swiftpost.example' },
  { id: 'cascade-express', name: 'Cascade Express', monogram: 'CE', color: '#4B7259', supportPhone: '(800) 555-0198', supportEmail: 'help@cascadeexpress.example' },
  { id: 'trailrunner', name: 'TrailRunner Logistics', monogram: 'TR', color: '#C08A34', supportPhone: '(800) 555-0176', supportEmail: 'support@trailrunnerlog.example' },
  { id: 'northline', name: 'Northline Courier', monogram: 'NL', color: '#A6553C', supportPhone: '(800) 555-0123', supportEmail: 'care@northlinecourier.example' },
  { id: 'quickhatch', name: 'QuickHatch Delivery', monogram: 'QH', color: '#395A44', supportPhone: '(800) 555-0165', supportEmail: 'support@quickhatch.example' },
];

export function getCourier(id: CourierId): Courier {
  return couriers.find((c) => c.id === id) ?? couriers[0]!;
}
