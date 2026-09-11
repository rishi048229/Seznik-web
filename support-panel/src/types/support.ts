export interface SupportAgentRecord {
  id: string;
  name: string;
  phone: string;
  email: string;
  username: string;
  isDisabled: boolean;
  createdBy: string | null;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RedeemedUserDetails {
  id?: string | null;
  email?: string | null;
  displayName?: string | null;
  businessName?: string | null;
  phone?: string | null;
  businessType?: string | null;
  usedAt?: string | null;
}

export interface AccessCodeRecord {
  id: string;
  code: string;
  batchId: string;
  note: string | null;
  createdBy: string | null;
  createdAt: string;
  customerName: string | null;
  customerId: string | null;
  invoiceNumber: string | null;
  phone: string | null;
  printer: string | null;
  isUsed?: boolean;
  usedAt?: string | null;
  usedByUserId?: string | null;
  customerEmail?: string | null;
  redeemedUser?: RedeemedUserDetails | null;
}

export interface AccessCodeLookupResult {
  found: boolean;
  code: string;
  status: 'redeemed' | 'available' | 'not_found';
  isRedeemed: boolean;
  record: AccessCodeRecord | null;
  message?: string;
}

export interface AccessCodeListResponse {
  items: AccessCodeRecord[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}
