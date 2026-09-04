import crypto from 'crypto';
import { promisify } from 'util';

const scryptAsync = promisify(crypto.scrypt);
const MIN_PASSWORD_LENGTH = 10;

export async function ensureSupportAgentTable(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS "SupportAgent" (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      phone TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      username TEXT NOT NULL UNIQUE,
      "passwordHash" TEXT NOT NULL,
      "isDisabled" BOOLEAN NOT NULL DEFAULT false,
      "createdBy" TEXT,
      "lastLoginAt" TIMESTAMP(3),
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS "SupportAgent_isDisabled_idx" ON "SupportAgent" ("isDisabled")
  `);
}

export function mapSupportAgentRow(row) {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    email: row.email,
    username: row.username,
    isDisabled: Boolean(row.isDisabled),
    createdBy: row.createdBy || null,
    lastLoginAt: row.lastLoginAt
      ? (row.lastLoginAt instanceof Date ? row.lastLoginAt.toISOString() : row.lastLoginAt)
      : null,
    createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : row.createdAt,
    updatedAt: row.updatedAt instanceof Date ? row.updatedAt.toISOString() : row.updatedAt,
  };
}

export async function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = await scryptAsync(String(password), salt, 64);
  return `scrypt$${salt}$${Buffer.from(derived).toString('hex')}`;
}

export async function verifyPassword(password, storedHash) {
  if (!storedHash || typeof storedHash !== 'string') return false;
  const parts = storedHash.split('$');
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false;
  const [, salt, hashHex] = parts;
  const derived = await scryptAsync(String(password), salt, 64);
  const left = Buffer.from(derived);
  const right = Buffer.from(hashHex, 'hex');
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

export function generateSupportPassword(length = 14) {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%';
  const bytes = crypto.randomBytes(length);
  let out = '';
  for (let i = 0; i < length; i++) {
    out += alphabet[bytes[i] % alphabet.length];
  }
  return out;
}

function requireField(value, label) {
  const trimmed = typeof value === 'string' ? value.trim() : '';
  if (!trimmed) {
    const err = new Error(`${label} is required`);
    err.statusCode = 400;
    throw err;
  }
  return trimmed;
}

export function validateCreatePayload(body = {}) {
  const name = requireField(body.name, 'Name');
  const phone = requireField(body.phone, 'Phone number').replace(/\D/g, '');
  const email = requireField(body.email, 'Email').toLowerCase();
  const username = requireField(body.username, 'Username').toLowerCase();
  const password = typeof body.password === 'string' ? body.password : '';

  if (!/^\d{10}$/.test(phone)) {
    const err = new Error('Phone number must be exactly 10 digits');
    err.statusCode = 400;
    throw err;
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    const err = new Error('Enter a valid email address');
    err.statusCode = 400;
    throw err;
  }
  if (!/^[a-z0-9._-]{3,40}$/i.test(username)) {
    const err = new Error('Username must be 3–40 characters (letters, numbers, . _ -)');
    err.statusCode = 400;
    throw err;
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    const err = new Error(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
    err.statusCode = 400;
    throw err;
  }

  return { name, phone, email, username, password };
}

export async function listSupportAgents(pool) {
  await ensureSupportAgentTable(pool);
  const res = await pool.query(`
    SELECT id, name, phone, email, username, "isDisabled", "createdBy", "lastLoginAt", "createdAt", "updatedAt"
    FROM "SupportAgent"
    ORDER BY "createdAt" DESC
  `);
  return res.rows.map(mapSupportAgentRow);
}

export async function createSupportAgent(pool, body, createdBy) {
  await ensureSupportAgentTable(pool);
  const payload = validateCreatePayload(body);
  const passwordHash = await hashPassword(payload.password);
  const id = crypto.randomUUID();

  try {
    const res = await pool.query(
      `INSERT INTO "SupportAgent"
        (id, name, phone, email, username, "passwordHash", "isDisabled", "createdBy", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6, false, $7, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       RETURNING id, name, phone, email, username, "isDisabled", "createdBy", "lastLoginAt", "createdAt", "updatedAt"`,
      [id, payload.name, payload.phone, payload.email, payload.username, passwordHash, createdBy || null]
    );
    return {
      agent: mapSupportAgentRow(res.rows[0]),
      password: payload.password,
    };
  } catch (err) {
    if (err?.code === '23505') {
      const conflict = new Error('Username or email already exists');
      conflict.statusCode = 409;
      throw conflict;
    }
    throw err;
  }
}

export async function setSupportAgentDisabled(pool, id, isDisabled) {
  await ensureSupportAgentTable(pool);
  const res = await pool.query(
    `UPDATE "SupportAgent"
     SET "isDisabled" = $1, "updatedAt" = CURRENT_TIMESTAMP
     WHERE id = $2
     RETURNING id, name, phone, email, username, "isDisabled", "createdBy", "lastLoginAt", "createdAt", "updatedAt"`,
    [Boolean(isDisabled), String(id)]
  );
  if (!res.rowCount) {
    const err = new Error('Support agent not found');
    err.statusCode = 404;
    throw err;
  }
  return mapSupportAgentRow(res.rows[0]);
}

export async function revokeSupportAgent(pool, id) {
  await ensureSupportAgentTable(pool);
  const res = await pool.query(
    `DELETE FROM "SupportAgent" WHERE id = $1 RETURNING id`,
    [String(id)]
  );
  if (!res.rowCount) {
    const err = new Error('Support agent not found');
    err.statusCode = 404;
    throw err;
  }
  return { success: true, id: res.rows[0].id };
}

export async function authenticateSupportAgent(pool, username, password) {
  await ensureSupportAgentTable(pool);
  const user = String(username || '').trim().toLowerCase();
  const pass = String(password || '');
  if (!user || !pass) {
    const err = new Error('Username and password are required');
    err.statusCode = 400;
    throw err;
  }

  const res = await pool.query(
    `SELECT id, name, phone, email, username, "passwordHash", "isDisabled", "createdBy", "lastLoginAt", "createdAt", "updatedAt"
     FROM "SupportAgent"
     WHERE lower(username) = $1
     LIMIT 1`,
    [user]
  );
  const row = res.rows[0];
  if (!row || !(await verifyPassword(pass, row.passwordHash))) {
    const err = new Error('Invalid username or password');
    err.statusCode = 401;
    throw err;
  }
  if (row.isDisabled) {
    const err = new Error('Access disabled. Contact an administrator.');
    err.statusCode = 403;
    throw err;
  }

  await pool.query(
    `UPDATE "SupportAgent" SET "lastLoginAt" = CURRENT_TIMESTAMP, "updatedAt" = CURRENT_TIMESTAMP WHERE id = $1`,
    [row.id]
  );

  return mapSupportAgentRow({ ...row, lastLoginAt: new Date(), isDisabled: false });
}

export async function getSupportAgentById(pool, id) {
  await ensureSupportAgentTable(pool);
  const res = await pool.query(
    `SELECT id, name, phone, email, username, "isDisabled", "createdBy", "lastLoginAt", "createdAt", "updatedAt"
     FROM "SupportAgent"
     WHERE id = $1
     LIMIT 1`,
    [String(id)]
  );
  if (!res.rows[0]) return null;
  return mapSupportAgentRow(res.rows[0]);
}
