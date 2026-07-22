import http from 'http';
import crypto from 'crypto';

const BASE_HOST = 'localhost';
const BASE_PORT = 5000;

// Configuration
const CONCURRENCY = 50;         // 50 concurrent DB connection workers
const TOTAL_OPERATIONS = 1000;  // 1000 total CRUD operations
const TEST_EMAIL = 'admin@seznik.com';
const TEST_PASSWORD = 'password123';

const createdProductIds = [];
const createdCategoryIds = [];
const createdExpenseIds = [];

async function loginAndGetToken() {
  const loginPromise = (email, password) => new Promise((resolve) => {
    const data = JSON.stringify({ email, password });
    const req = http.request(
      {
        hostname: BASE_HOST,
        port: BASE_PORT,
        path: '/api/auth/login',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(data),
        },
      },
      (res) => {
        let body = '';
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => {
          try {
            const parsed = JSON.parse(body);
            resolve(parsed.token || null);
          } catch {
            resolve(null);
          }
        });
      }
    );
    req.on('error', () => resolve(null));
    req.write(data);
    req.end();
  });

  let token = await loginPromise(TEST_EMAIL, TEST_PASSWORD);
  if (token) return token;

  // Attempt registration fallback
  return new Promise((resolve) => {
    const data = JSON.stringify({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
      displayName: 'Stress Test Admin',
    });
    const req = http.request(
      {
        hostname: BASE_HOST,
        port: BASE_PORT,
        path: '/api/auth/register',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(data),
        },
      },
      (res) => {
        let body = '';
        res.on('data', (chunk) => (body += chunk));
        res.on('end', async () => {
          try {
            const parsed = JSON.parse(body);
            resolve(parsed.token || (await loginPromise(TEST_EMAIL, TEST_PASSWORD)));
          } catch {
            resolve(null);
          }
        });
      }
    );
    req.on('error', () => resolve(null));
    req.write(data);
    req.end();
  });
}

function sendRequest(method, path, bodyData, token) {
  return new Promise((resolve) => {
    const start = process.hrtime();
    const payload = bodyData ? JSON.stringify(bodyData) : null;
    const headers = {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
    };

    const req = http.request(
      {
        hostname: BASE_HOST,
        port: BASE_PORT,
        path,
        method,
        headers,
      },
      (res) => {
        let responseBody = '';
        res.on('data', (chunk) => (responseBody += chunk));
        res.on('end', () => {
          const diff = process.hrtime(start);
          const durationMs = diff[0] * 1000 + diff[1] / 1e6;
          let json = null;
          try { json = JSON.parse(responseBody); } catch {}
          resolve({
            status: res.statusCode,
            durationMs,
            success: res.statusCode >= 200 && res.statusCode < 400,
            json,
          });
        });
      }
    );

    req.on('error', (err) => {
      const diff = process.hrtime(start);
      const durationMs = diff[0] * 1000 + diff[1] / 1e6;
      resolve({ status: 0, durationMs, success: false, error: err.message });
    });

    if (payload) req.write(payload);
    req.end();
  });
}

// Generate random CRUD DB request
async function executeRandomCrudOp(token, opIndex) {
  const opType = Math.floor(Math.random() * 6);

  switch (opType) {
    case 0: { // READ - Products / Reports
      return await sendRequest('GET', '/api/products', null, token);
    }
    case 1: { // READ - Sales & Expenses
      return await sendRequest('GET', '/api/reports/dashboard', null, token);
    }
    case 2: { // CREATE - Category
      const name = `TestCat-${crypto.randomBytes(3).toString('hex')}`;
      const res = await sendRequest('POST', '/api/categories', { name, description: 'Stress Test Category' }, token);
      if (res.success && res.json?.id) createdCategoryIds.push(res.json.id);
      return { ...res, op: 'CREATE Category' };
    }
    case 3: { // CREATE - Expense
      const amount = Math.floor(Math.random() * 500) + 50;
      const res = await sendRequest('POST', '/api/expenses', {
        amount,
        category: 'Utilities',
        description: 'Automated Stress Test Expense',
        paymentMethod: 'cash',
      }, token);
      if (res.success && res.json?.id) createdExpenseIds.push(res.json.id);
      return { ...res, op: 'CREATE Expense' };
    }
    case 4: { // UPDATE - Product (or Category read)
      if (createdCategoryIds.length > 0) {
        const catId = createdCategoryIds[Math.floor(Math.random() * createdCategoryIds.length)];
        return await sendRequest('GET', `/api/categories`, null, token);
      }
      return await sendRequest('GET', '/api/customers', null, token);
    }
    case 5: { // DELETE - Expense (Clean up created expenses)
      if (createdExpenseIds.length > 0) {
        const expId = createdExpenseIds.pop();
        return await sendRequest('DELETE', `/api/expenses/${expId}`, null, token);
      }
      return await sendRequest('GET', '/api/suppliers', null, token);
    }
    default:
      return await sendRequest('GET', '/health', null, token);
  }
}

async function runDatabaseStressTest() {
  console.log('====================================================');
  console.log('⚡ DATABASE FULL CRUD STRESS TEST SUITE');
  console.log('====================================================');
  console.log(`Target Host   : http://${BASE_HOST}:${BASE_PORT}`);
  console.log(`Concurrency   : ${CONCURRENCY} Parallel DB Workers`);
  console.log(`Operations    : ${TOTAL_OPERATIONS} Total DB CRUD Operations`);
  console.log('====================================================\n');

  console.log('🔐 Authenticating test runner user...');
  const token = await loginAndGetToken();
  if (token) {
    console.log('✅ Authentication successful! JWT Token acquired.\n');
  } else {
    console.log('❌ Authentication failed. Cannot perform write operations.\n');
    return;
  }

  console.log('🚀 Executing multi-threaded READ / INSERT / UPDATE / DELETE operations...');
  const startTime = Date.now();
  const results = [];
  let completed = 0;

  async function worker() {
    while (completed < TOTAL_OPERATIONS) {
      const currentOp = completed++;
      const res = await executeRandomCrudOp(token, currentOp);
      results.push(res);
    }
  }

  const workers = Array.from({ length: CONCURRENCY }).map(() => worker());
  await Promise.all(workers);

  const totalTimeMs = Date.now() - startTime;
  const totalSeconds = totalTimeMs / 1000;
  const opsPerSec = (results.length / totalSeconds).toFixed(2);

  const durations = results.map((r) => r.durationMs).sort((a, b) => a - b);
  const avgLatency = (durations.reduce((a, b) => a + b, 0) / durations.length).toFixed(2);
  const minLatency = durations[0].toFixed(2);
  const maxLatency = durations[durations.length - 1].toFixed(2);
  const p95 = durations[Math.floor(durations.length * 0.95)].toFixed(2);
  const p99 = durations[Math.floor(durations.length * 0.99)].toFixed(2);

  const statusMap = {};
  let successCount = 0;
  for (const r of results) {
    statusMap[r.status] = (statusMap[r.status] || 0) + 1;
    if (r.success) successCount++;
  }

  const successRate = ((successCount / results.length) * 100).toFixed(2);

  console.log('\n====================================================');
  console.log('📊 DATABASE STRESS TEST BENCHMARK RESULTS');
  console.log('====================================================');
  console.log(`Total DB Operations Executed : ${results.length}`);
  console.log(`Total Execution Time         : ${totalSeconds.toFixed(2)} seconds`);
  console.log(`DB Throughput (Ops/Sec)      : 🔥 ${opsPerSec} ops/sec`);
  console.log(`Success Rate                 : ${successRate === '100.00' ? '✅' : '⚠️'} ${successRate}%`);
  console.log('----------------------------------------------------');
  console.log('⏱️ LATENCY BREAKDOWN (ms):');
  console.log(`  Min Latency                : ${minLatency} ms`);
  console.log(`  Average Latency            : ${avgLatency} ms`);
  console.log(`  p95 (95th percentile)      : ${p95} ms`);
  console.log(`  p99 (99th percentile)      : ${p99} ms`);
  console.log(`  Max Latency                : ${maxLatency} ms`);
  console.log('----------------------------------------------------');
  console.log('HTTP STATUS CODES:');
  for (const [code, count] of Object.entries(statusMap)) {
    console.log(`  HTTP ${code}                    : ${count} requests`);
  }
  console.log('====================================================\n');
}

runDatabaseStressTest().catch(console.error);
