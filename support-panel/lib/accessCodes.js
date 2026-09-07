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

function trimField(value, max) {
  if (value == null) return '';
  return String(value).trim().slice(0, max);
}

function requireField(value, label, max) {
  const trimmed = trimField(value, max);
  if (!trimmed) {
    const err = new Error(`${label} is required`);
    err.statusCode = 400;
    throw err;
  }
  return trimmed;
}

let accessCodeSchemaReady = false;

export async function ensureAccessCodeTable(pool) {
  if (accessCodeSchemaReady) return;

  await pool.query(`
    CREATE TABLE IF NOT EXISTS "AccessCode" (
      id TEXT PRIMARY KEY,
      code VARCHAR(7) NOT NULL UNIQUE,
      "batchId" TEXT NOT NULL,
      note TEXT,
      "createdBy" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "customerName" TEXT,
      "customerId" TEXT,
      "invoiceNumber" TEXT,
      phone TEXT,
      printer TEXT
    )
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS "AccessCode_batchId_idx" ON "AccessCode" ("batchId")
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS "AccessCode_createdAt_idx" ON "AccessCode" ("createdAt" DESC)
  `);
  await pool.query(`ALTER TABLE "AccessCode" ADD COLUMN IF NOT EXISTS "customerName" TEXT`);
  await pool.query(`ALTER TABLE "AccessCode" ADD COLUMN IF NOT EXISTS "customerId" TEXT`);
  await pool.query(`ALTER TABLE "AccessCode" ADD COLUMN IF NOT EXISTS "invoiceNumber" TEXT`);
  await pool.query(`ALTER TABLE "AccessCode" ADD COLUMN IF NOT EXISTS phone TEXT`);
  await pool.query(`ALTER TABLE "AccessCode" ADD COLUMN IF NOT EXISTS printer TEXT`);
  await pool.query(`ALTER TABLE "AccessCode" ADD COLUMN IF NOT EXISTS "isUsed" BOOLEAN NOT NULL DEFAULT FALSE`);
  await pool.query(`ALTER TABLE "AccessCode" ADD COLUMN IF NOT EXISTS "usedAt" TIMESTAMP(3)`);
  await pool.query(`ALTER TABLE "AccessCode" ADD COLUMN IF NOT EXISTS "usedByUserId" TEXT`);
  await pool.query(`ALTER TABLE "AccessCode" ADD COLUMN IF NOT EXISTS "customerEmail" TEXT`);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS "AccessCode_createdBy_idx" ON "AccessCode" ("createdBy")
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS "AccessCode_isUsed_idx" ON "AccessCode" ("isUsed")
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS "AccessCode_usedByUserId_idx" ON "AccessCode" ("usedByUserId")
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS "AccessCode_invoiceNumber_idx" ON "AccessCode" ("invoiceNumber")
  `);

  accessCodeSchemaReady = true;
}

function mapCodeRow(row) {
  return {
    id: row.id,
    code: row.code,
    batchId: row.batchId,
    note: row.note || null,
    createdBy: row.createdBy || null,
    createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : row.createdAt,
    customerName: row.customerName || null,
    customerId: row.customerId || null,
    invoiceNumber: row.invoiceNumber || null,
    phone: row.phone || null,
    printer: row.printer || null,
    isUsed: Boolean(row.isUsed),
    usedAt: row.usedAt instanceof Date ? row.usedAt.toISOString() : row.usedAt || null,
    usedByUserId: row.usedByUserId || null,
    customerEmail: row.customerEmail || null,
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

const CODE_SELECT = `id, code, "batchId", note, "createdBy", "createdAt",
  "customerName", "customerId", "invoiceNumber", phone, printer,
  "isUsed", "usedAt", "usedByUserId", "customerEmail"`;

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
      values.push(
        `($${p++}, $${p++}, $${p++}, $${p++}, $${p++}, CURRENT_TIMESTAMP, NULL, NULL, NULL, NULL, NULL)`
      );
      params.push(crypto.randomUUID(), code, batchId, noteValue, createdByValue);
    }

    const insertRes = await pool.query(
      `INSERT INTO "AccessCode" (
         id, code, "batchId", note, "createdBy", "createdAt",
         "customerName", "customerId", "invoiceNumber", phone, printer
       )
       VALUES ${values.join(', ')}
       ON CONFLICT (code) DO NOTHING
       RETURNING ${CODE_SELECT}`,
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

/** Issue a single access code for a customer sale (support portal). */
export async function issueCustomerAccessCode(pool, payload = {}) {
  await ensureAccessCodeTable(pool);

  const customerName = requireField(payload.customerName, 'Customer name', 160);
  const customerId = trimField(payload.customerId, 120) || null;
  const invoiceNumber = requireField(payload.invoiceNumber, 'Invoice number', 120);
  const phone = requireField(payload.phone, 'Phone number', 40);
  const printer = requireField(payload.printer, 'Printer', 240);
  const createdBy = requireField(payload.createdBy, 'Generated by', 120);

  const phoneDigits = phone.replace(/\D/g, '');
  if (phoneDigits.length < 10) {
    const err = new Error('Phone number must be at least 10 digits');
    err.statusCode = 400;
    throw err;
  }

  // Check if this invoice number is already linked to an access code
  const existingInvoiceRes = await pool.query(
    `SELECT code, "invoiceNumber", "customerName", "createdAt"
     FROM "AccessCode"
     WHERE "invoiceNumber" IS NOT NULL AND LOWER(TRIM("invoiceNumber")) = LOWER(TRIM($1))
     LIMIT 1`,
    [invoiceNumber]
  );

  if (existingInvoiceRes.rows.length > 0) {
    const existing = existingInvoiceRes.rows[0];
    const err = new Error(
      `This invoice number (${existing.invoiceNumber}) is already linked to access code ${existing.code}. One invoice can only be linked to one access code. Please enter a different invoice number.`
    );
    err.statusCode = 400;
    throw err;
  }

  const allowedPrinters = { veer: 'Veer', dev: 'Dev', josh: 'Josh', tej: 'Tej' };
  const printerLabel = allowedPrinters[String(printer).trim().toLowerCase()];
  if (!printerLabel) {
    const err = new Error('Select a valid printer (Veer, Dev, Josh, or Tej)');
    err.statusCode = 400;
    throw err;
  }

  const batchId = crypto.randomUUID();
  const noteValue = `Invoice ${invoiceNumber}`;

  // Avoid loading every existing code — rely on UNIQUE + ON CONFLICT retries.
  let inserted = null;
  for (let attempt = 0; attempt < 12; attempt++) {
    const code = randomCode();
    const insertRes = await pool.query(
      `INSERT INTO "AccessCode" (
         id, code, "batchId", note, "createdBy", "createdAt",
         "customerName", "customerId", "invoiceNumber", phone, printer
       )
       VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP, $6, $7, $8, $9, $10)
       ON CONFLICT (code) DO NOTHING
       RETURNING ${CODE_SELECT}`,
      [
        crypto.randomUUID(),
        code,
        batchId,
        noteValue,
        createdBy,
        customerName,
        customerId,
        invoiceNumber,
        phoneDigits,
        printerLabel,
      ]
    );

    if (insertRes.rows[0]) {
      inserted = mapCodeRow(insertRes.rows[0]);
      break;
    }
  }

  if (!inserted) {
    const err = new Error('Could not generate a unique access code. Please retry.');
    err.statusCode = 500;
    throw err;
  }

  return inserted;
}

export async function listAccessCodes(
  pool,
  { page = 1, limit = 50, batchId, search, createdBy, customerOnly } = {}
) {
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
  if (createdBy && String(createdBy).trim()) {
    where.push(`"createdBy" = $${p++}`);
    params.push(String(createdBy).trim());
  }
  if (customerOnly) {
    where.push(`"customerName" IS NOT NULL`);
  }
  if (search && String(search).trim()) {
    const q = `%${String(search).trim()}%`;
    where.push(
      `(code ILIKE $${p} OR "customerName" ILIKE $${p} OR "customerId" ILIKE $${p}
        OR "invoiceNumber" ILIKE $${p} OR phone ILIKE $${p} OR printer ILIKE $${p}
        OR "createdBy" ILIKE $${p} OR COALESCE(note, '') ILIKE $${p})`
    );
    params.push(q);
    p += 1;
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const countRes = await pool.query(
    `SELECT COUNT(*)::int AS total FROM "AccessCode" ${whereSql}`,
    params
  );
  const total = countRes.rows[0]?.total || 0;

  const dataRes = await pool.query(
    `SELECT ${CODE_SELECT}
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

export async function listAccessCodeIssuers(pool) {
  await ensureAccessCodeTable(pool);

  const dataRes = await pool.query(`
    SELECT
      COALESCE("createdBy", 'unknown') AS "createdBy",
      COUNT(*)::int AS count,
      MAX("createdAt") AS "lastGeneratedAt"
    FROM "AccessCode"
    WHERE "customerName" IS NOT NULL
    GROUP BY COALESCE("createdBy", 'unknown')
    ORDER BY COUNT(*) DESC, MAX("createdAt") DESC
  `);

  return {
    items: dataRes.rows.map((row) => ({
      createdBy: row.createdBy,
      count: Number(row.count) || 0,
      lastGeneratedAt:
        row.lastGeneratedAt instanceof Date
          ? row.lastGeneratedAt.toISOString()
          : row.lastGeneratedAt,
    })),
    totalCodes: dataRes.rows.reduce((sum, row) => sum + (Number(row.count) || 0), 0),
  };
}

export async function listAccessCodeBatches(pool, { page = 1, limit = 50 } = {}) {
  await ensureAccessCodeTable(pool);

  const safePage = Math.max(1, parseInt(String(page), 10) || 1);
  const safeLimit = Math.min(200, Math.max(1, parseInt(String(limit), 10) || 50));
  const offset = (safePage - 1) * safeLimit;

  const countRes = await pool.query(`
    SELECT COUNT(*)::int AS total FROM (
      SELECT "batchId" FROM "AccessCode" WHERE "customerName" IS NULL GROUP BY "batchId"
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
     WHERE "customerName" IS NULL
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
    `SELECT ${CODE_SELECT}
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
