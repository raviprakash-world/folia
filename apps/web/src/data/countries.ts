export interface Country {
  code: string;
  name: string;
  postalLabel: string;
}

// P0-F — India-commerce correctness. This used to list 5 countries, but
// nothing downstream ever supported the other 4: ShiprocketProvider is
// India-domestic only, the GST/tax model assumes India, and the backend's
// AddressInputDto now rejects any country other than 'IN' outright — a
// customer picking "United States" here would always fail at checkout.
// One entry, not a hardcoded string, so the address form's existing
// postalLabel lookup (`countries.find(...)`) keeps working unchanged.
export const countries: Country[] = [
  { code: 'IN', name: 'India', postalLabel: 'PIN code' },
];
