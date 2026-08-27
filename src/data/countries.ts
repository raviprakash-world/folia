export interface Country {
  code: string;
  name: string;
  postalLabel: string;
}

export const countries: Country[] = [
  { code: 'US', name: 'United States', postalLabel: 'ZIP code' },
  { code: 'CA', name: 'Canada', postalLabel: 'Postal code' },
  { code: 'GB', name: 'United Kingdom', postalLabel: 'Postcode' },
  { code: 'IN', name: 'India', postalLabel: 'PIN code' },
  { code: 'AU', name: 'Australia', postalLabel: 'Postcode' },
];
