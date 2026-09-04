export function clampGenerateCount(raw: unknown): number | null;

export function ensureAccessCodeTable(pool: unknown): Promise<void>;

export function generateAccessCodes(
  pool: unknown,
  options: { count: unknown; note?: unknown; createdBy?: unknown }
): Promise<{
  batchId: string;
  count: number;
  note: string | null;
  createdBy: string | null;
  createdAt: string;
  codes: Array<{
    id: string;
    code: string;
    batchId: string;
    note: string | null;
    createdBy: string | null;
    createdAt: string;
  }>;
}>;

export function listAccessCodes(
  pool: unknown,
  options?: { page?: unknown; limit?: unknown; batchId?: unknown; search?: unknown }
): Promise<{
  items: Array<{
    id: string;
    code: string;
    batchId: string;
    note: string | null;
    createdBy: string | null;
    createdAt: string;
  }>;
  page: number;
  limit: number;
  total: number;
  totalPages: number;
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
  codes: Array<{
    id: string;
    code: string;
    batchId: string;
    note: string | null;
    createdBy: string | null;
    createdAt: string;
  }>;
}>;
