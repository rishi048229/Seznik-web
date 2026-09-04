import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const pemName = 'rds-global-bundle.pem';
const here = dirname(fileURLToPath(import.meta.url));
const pemCandidates = [
  join(here, '..', 'certs', pemName),
  join(process.cwd(), 'certs', pemName),
];

function readRdsCa() {
  for (const pemPath of pemCandidates) {
    try {
      return readFileSync(pemPath, 'utf8');
    } catch {
      // try next
    }
  }
  return null;
}

/** Drop sslmode from the URL so node-pg uses the CA bundle instead of failing verify-full. */
export function pgConnectionString(dbUrl = '') {
  try {
    const parsed = new URL(dbUrl);
    parsed.searchParams.delete('sslmode');
    parsed.searchParams.delete('sslrootcert');
    return parsed.toString();
  } catch {
    return dbUrl;
  }
}

/** RDS requires TLS. Use Amazon's CA bundle so verify-full works (AWS console connect flow). */
export function pgSslConfig(dbUrl = '') {
  if (!dbUrl.includes('rds.amazonaws.com')) return undefined;
  const ca = readRdsCa();
  if (ca) return { rejectUnauthorized: true, ca };
  return { rejectUnauthorized: false };
}
