export interface Customer {
  id: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  creditBalance: number;
  creditLimit: number;
  // Start of the customer's current unpaid streak — null once fully settled. Powers ageing
  // badges on the Credit Ledger screen.
  oldestUnpaidSince?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateCustomerPayload {
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  creditLimit?: number;
}
