import http from 'http';

const TARGET_URL = 'http://localhost:5173';
const HOST = 'localhost';
const PORT = 5173;

const CONCURRENCY = 50;        // 50 parallel browser traffic clients
const TOTAL_REQUESTS = 1000;   // 1,000 total page & asset loads

const routes = [
  '/',
  '/login',
  '/access-selection',
  '/dashboard',
  '/pos',
  '/products',
  '/sales',
  '/expenses',
  '/customers',
  '/suppliers',
  '/reports',
];

function fetchPage(route) {
  return new Promise((resolve) => {
    const start = process.hrtime();
    const req = http.request(
      {
        hostname: HOST,
        port: PORT,
        path: route,
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Seznik-Frontend-Stress-Test/1.0',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          const diff = process.hrtime(start);
          const durationMs = diff[0] * 1000 + diff[1] / 1e6;
          resolve({
            route,
            status: res.statusCode,
            durationMs,
            bytes: Buffer.byteLength(data),
            success: res.statusCode >= 200 && res.statusCode < 400,
          });
        });
      }
    );

    req.on('error', (err) => {
      const diff = process.hrtime(start);
      const durationMs = diff[0] * 1000 + diff[1] / 1e6;
      resolve({ route, status: 0, durationMs, bytes: 0, success: false, error: err.message });
    });

    req.end();
  });
}

async function runFrontendStressTest() {
  console.log('====================================================');
  console.log('💻 SEZNIK FRONTEND WEB APP STRESS & BENCHMARK TEST');
  console.log('====================================================');
  console.log(`Target Frontend URL : ${TARGET_URL}`);
  console.log(`Parallel Clients   : ${CONCURRENCY} Simulated User Sessions`);
  console.log(`Total Requests     : ${TOTAL_REQUESTS} Page Navigations & Bundles`);
  console.log('====================================================\n');

  console.log('🚀 Starting high-concurrency frontend rendering & route stress test...');
  const startTime = Date.now();
  const results = [];
  let completed = 0;

  async function worker() {
    while (completed < TOTAL_REQUESTS) {
      completed++;
      const route = routes[Math.floor(Math.random() * routes.length)];
      const res = await fetchPage(route);
      results.push(res);
    }
  }

  const workers = Array.from({ length: CONCURRENCY }).map(() => worker());
  await Promise.all(workers);

  const totalTimeMs = Date.now() - startTime;
  const totalSeconds = totalTimeMs / 1000;
  const reqPerSec = (results.length / totalSeconds).toFixed(2);
  const totalMB = (results.reduce((a, b) => a + b.bytes, 0) / (1024 * 1024)).toFixed(2);

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
  console.log('📊 FRONTEND STRESS & BENCHMARK REPORT');
  console.log('====================================================');
  console.log(`Total Page Loads Completed : ${results.length}`);
  console.log(`Total Time Taken           : ${totalSeconds.toFixed(2)} seconds`);
  console.log(`Frontend Throughput        : 🔥 ${reqPerSec} requests/sec`);
  console.log(`Total Data Transferred     : 📦 ${totalMB} MB`);
  console.log(`Success Rate               : ${successRate === '100.00' ? '✅' : '⚠️'} ${successRate}%`);
  console.log('----------------------------------------------------');
  console.log('⏱️ FRONTEND LATENCY BREAKDOWN (TTFB / HTML Render):');
  console.log(`  Min Load Time            : ${minLatency} ms`);
  console.log(`  Average Load Time        : ${avgLatency} ms`);
  console.log(`  p95 (95th percentile)    : ${p95} ms`);
  console.log(`  p99 (99th percentile)    : ${p99} ms`);
  console.log(`  Max Load Time            : ${maxLatency} ms`);
  console.log('----------------------------------------------------');
  console.log('HTTP STATUS CODES:');
  for (const [code, count] of Object.entries(statusMap)) {
    console.log(`  HTTP ${code}                    : ${count} requests`);
  }
  console.log('====================================================\n');
}

runFrontendStressTest().catch(console.error);
