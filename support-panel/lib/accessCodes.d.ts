export function clampGenerateCount(raw: unknown): number | null;

export function ensureAccessCodeTable(pool: unknown): Promise<void>;

export type AccessCodeRow = {
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
  isUsed: boolean;
  usedAt: string | null;
  usedByUserId: string | null;
  customerEmail: string | null;
};

export function generateAccessCodes(
  pool: unknown,
  options: { count: unknown; note?: unknown; createdBy?: unknown }
): Promise<{
  batchId: string;
  count: number;
  note: string | null;
  createdBy: string | null;
  createdAt: string;
  codes: AccessCodeRow[];
}>;

export function issueCustomerAccessCode(
  pool: unknown,
  options: {
    customerName?: unknown;
    customerId?: unknown;
    invoiceNumber?: unknown;
    phone?: unknown;
    printer?: unknown;
    createdBy?: unknown;
  }
): Promise<AccessCodeRow>;

export function listAccessCodes(
  pool: unknown,
  options?: {
    page?: unknown;
    limit?: unknown;
    batchId?: unknown;
    search?: unknown;
    createdBy?: unknown;
    customerOnly?: unknown;
  }
): Promise<{
  items: AccessCodeRow[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}>;

export function listAccessCodeIssuers(pool: unknown): Promise<{
  items: Array<{ createdBy: string; count: number; lastGeneratedAt: string }>;
  totalCodes: number;
}>;

export function listAccessCodeBatches(
  pool: unknown,
  options?: { page?: unknown; limit?: unknown }
): Promise<{
  items: Array<{
    batchId: string;
    count: number;
    note: string | null;
    createdBy: string | null;
    createdAt: string;
  }>;
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}>;

export function getAccessCodesByBatch(
  pool: unknown,
  batchId: unknown
): Promise<{
  batchId: string;
  count: number;
  codes: AccessCodeRow[];
}>;
