export function pgConnectionString(dbUrl?: string): string;
export function pgSslConfig(dbUrl?: string): { rejectUnauthorized: boolean; ca?: string } | undefined;
