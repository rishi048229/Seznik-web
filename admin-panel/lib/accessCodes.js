import crypto from 'crypto';

const CODE_LENGTH = 7;
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const ALPHABET_LEN = ALPHABET.length;
const MAX_GENERATE = 5000;
const MIN_GENERATE = 1;

export function clampGenerateCount(raw) {
  const n = Number(raw);
  if (!Number.isFinite(n)) return null;
  const rounded = Math.floor(n);
  if (rounded < MIN_GENERATE || rounded > MAX_GENERATE) return null;
  return rounded;
}

function randomCode() {
  let code = '';
  while (code.length < CODE_LENGTH) {
    const bytes = crypto.randomBytes(CODE_LENGTH * 2);
    for (let i = 0; i < bytes.length && code.length < CODE_LENGTH; i++) {
      // Rejection sampling avoids modulo bias
      if (bytes[i] >= 252) continue; // largest multiple of 36 below 256
      code += ALPHABET[bytes[i] % ALPHABET_LEN];
    }
  }
  return code;
}

function generateUniqueCandidates(count, existingSet) {
  const codes = new Set();
  let guard = 0;
  const maxAttempts = count * 40 + 200;
  while (codes.size < count && guard < maxAttempts) {
    guard += 1;
    const next = randomCode();
    if (existingSet.has(next) || codes.has(next)) continue;
    codes.add(next);
  }
  if (codes.size < count) {
    throw new Error('Could not generate enough unique codes. Try a smaller batch.');
  }
  return [...codes];
}

export async function ensureAccessCodeTable(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS "AccessCode" (
      id TEXT PRIMARY KEY,
      code VARCHAR(7) NOT NULL UNIQUE,
      "batchId" TEXT NOT NULL,
      note TEXT,
      "createdBy" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS "AccessCode_batchId_idx" ON "AccessCode" ("batchId")
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS "AccessCode_createdAt_idx" ON "AccessCode" ("createdAt" DESC)
  `);
}

function mapCodeRow(row) {
  return {
    id: row.id,
    code: row.code,
    batchId: row.batchId,
    note: row.note || null,
    createdBy: row.createdBy || null,
    createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : row.createdAt,
  };
}

function mapBatchRow(row) {
  return {
    batchId: row.batchId,
    count: Number(row.count) || 0,
    note: row.note || null,
    createdBy: row.createdBy || null,
    createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : row.createdAt,
  };
}

export async function generateAccessCodes(pool, { count, note, createdBy }) {
  const safeCount = clampGenerateCount(count);
  if (safeCount == null) {
    const err = new Error(`Count must be an integer between ${MIN_GENERATE} and ${MAX_GENERATE}`);
    err.statusCode = 400;
    throw err;
  }

  await ensureAccessCodeTable(pool);

  const batchId = crypto.randomUUID();
  const trimmedNote = typeof note === 'string' ? note.trim().slice(0, 200) : '';
  if (!trimmedNote) {
    const err = new Error('Shipment name is required');
    err.statusCode = 400;
    throw err;
  }
  const noteValue = trimmedNote;
  const createdByValue = createdBy ? String(createdBy).slice(0, 120) : null;

  const existingRes = await pool.query(`SELECT code FROM "AccessCode"`);
  const existingSet = new Set(existingRes.rows.map((r) => r.code));

  let inserted = [];
  let remaining = safeCount;
  let attempts = 0;

  while (remaining > 0 && attempts < 8) {
    attempts += 1;
    const candidates = generateUniqueCandidates(remaining, existingSet);
    for (const c of candidates) existingSet.add(c);

    const values = [];
    const params = [];
    let p = 1;
    for (const code of candidates) {
      values.push(`($${p++}, $${p++}, $${p++}, $${p++}, $${p++}, CURRENT_TIMESTAMP)`);
      params.push(crypto.randomUUID(), code, batchId, noteValue, createdByValue);
    }

    const insertRes = await pool.query(
      `INSERT INTO "AccessCode" (id, code, "batchId", note, "createdBy", "createdAt")
       VALUES ${values.join(', ')}
       ON CONFLICT (code) DO NOTHING
       RETURNING id, code, "batchId", note, "createdBy", "createdAt"`,
      params
    );

    inserted = inserted.concat(insertRes.rows.map(mapCodeRow));
    remaining = safeCount - inserted.length;
  }

  if (inserted.length < safeCount) {
    const err = new Error(`Only generated ${inserted.length} of ${safeCount} unique codes. Please retry.`);
    err.statusCode = 500;
    throw err;
  }

  return {
    batchId,
    count: inserted.length,
    note: noteValue,
    createdBy: createdByValue,
    createdAt: inserted[0]?.createdAt || new Date().toISOString(),
    codes: inserted,
  };
}

export async function listAccessCodes(pool, { page = 1, limit = 50, batchId, search } = {}) {
  await ensureAccessCodeTable(pool);

  const safePage = Math.max(1, parseInt(String(page), 10) || 1);
  const safeLimit = Math.min(500, Math.max(1, parseInt(String(limit), 10) || 50));
  const offset = (safePage - 1) * safeLimit;

  const where = [];
  const params = [];
  let p = 1;

  if (batchId) {
    where.push(`"batchId" = $${p++}`);
    params.push(String(batchId));
  }
  if (search && String(search).trim()) {
    where.push(`code ILIKE $${p++}`);
    params.push(`%${String(search).trim().toUpperCase()}%`);
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const countRes = await pool.query(
    `SELECT COUNT(*)::int AS total FROM "AccessCode" ${whereSql}`,
    params
  );
  const total = countRes.rows[0]?.total || 0;

  const dataRes = await pool.query(
    `SELECT id, code, "batchId", note, "createdBy", "createdAt"
     FROM "AccessCode"
     ${whereSql}
     ORDER BY "createdAt" DESC, code ASC
     LIMIT $${p++} OFFSET $${p++}`,
    [...params, safeLimit, offset]
  );

  return {
    items: dataRes.rows.map(mapCodeRow),
    page: safePage,
    limit: safeLimit,
    total,
    totalPages: Math.max(1, Math.ceil(total / safeLimit)),
  };
}

export async function listAccessCodeBatches(pool, { page = 1, limit = 50 } = {}) {
  await ensureAccessCodeTable(pool);

  const safePage = Math.max(1, parseInt(String(page), 10) || 1);
  const safeLimit = Math.min(200, Math.max(1, parseInt(String(limit), 10) || 50));
  const offset = (safePage - 1) * safeLimit;

  const countRes = await pool.query(`
    SELECT COUNT(*)::int AS total FROM (
      SELECT "batchId" FROM "AccessCode" GROUP BY "batchId"
    ) b
  `);
  const total = countRes.rows[0]?.total || 0;

  const dataRes = await pool.query(
    `SELECT
       "batchId",
       COUNT(*)::int AS count,
       MAX(note) AS note,
       MAX("createdBy") AS "createdBy",
       MIN("createdAt") AS "createdAt"
     FROM "AccessCode"
     GROUP BY "batchId"
     ORDER BY MIN("createdAt") DESC
     LIMIT $1 OFFSET $2`,
    [safeLimit, offset]
  );

  return {
    items: dataRes.rows.map(mapBatchRow),
    page: safePage,
    limit: safeLimit,
    total,
    totalPages: Math.max(1, Math.ceil(total / safeLimit)),
  };
}

export async function getAccessCodesByBatch(pool, batchId) {
  await ensureAccessCodeTable(pool);
  if (!batchId) {
    const err = new Error('batchId is required');
    err.statusCode = 400;
    throw err;
  }

  const dataRes = await pool.query(
    `SELECT id, code, "batchId", note, "createdBy", "createdAt"
     FROM "AccessCode"
     WHERE "batchId" = $1
     ORDER BY code ASC`,
    [String(batchId)]
  );

  return {
    batchId: String(batchId),
    count: dataRes.rows.length,
    codes: dataRes.rows.map(mapCodeRow),
  };
}
