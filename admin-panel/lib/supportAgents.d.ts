export function ensureSupportAgentTable(pool: unknown): Promise<void>;

export function mapSupportAgentRow(row: Record<string, unknown>): {
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
};

export function hashPassword(password: string): Promise<string>;
export function verifyPassword(password: string, storedHash: string): Promise<boolean>;
export function generateSupportPassword(length?: number): string;

export function validateCreatePayload(body?: Record<string, unknown>): {
  name: string;
  phone: string;
  email: string;
  username: string;
  password: string;
};

export function listSupportAgents(pool: unknown): Promise<ReturnType<typeof mapSupportAgentRow>[]>;

export function createSupportAgent(
  pool: unknown,
  body: Record<string, unknown>,
  createdBy?: string | null
): Promise<{ agent: ReturnType<typeof mapSupportAgentRow>; password: string }>;

export function setSupportAgentDisabled(
  pool: unknown,
  id: string,
  isDisabled: boolean
): Promise<ReturnType<typeof mapSupportAgentRow>>;

export function revokeSupportAgent(pool: unknown, id: string): Promise<{ success: boolean; id: string }>;

export function authenticateSupportAgent(
  pool: unknown,
  username: string,
  password: string
): Promise<ReturnType<typeof mapSupportAgentRow>>;

export function getSupportAgentById(
  pool: unknown,
  id: string
): Promise<ReturnType<typeof mapSupportAgentRow> | null>;
