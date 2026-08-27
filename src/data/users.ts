export interface SeedUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  /** Plain text on purpose — this is a mock backend, not a real credential store. */
  password: string;
}

export const seedUsers: SeedUser[] = [
  { id: 'u1', firstName: 'Sam', lastName: 'Rivera', email: 'demo@folia.example', password: 'folia-demo' },
];
