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
}

export interface AccessCodeListResponse {
  items: AccessCodeRecord[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}
