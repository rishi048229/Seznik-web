/**
 * High-Concurrency OTP Benchmark Tool
 * Simulates 1000 concurrent users hitting /api/auth/send-otp simultaneously
 */
const http = require('http');

const TOTAL_USERS = 1000;
const TARGET_URL = 'http://localhost:5000/api/auth/send-otp';

// Use an HTTP Agent with maxSockets set to 1000 for maximum concurrency
const agent = new http.Agent({
  keepAlive: true,
  maxSockets: 1000,
  maxFreeSockets: 1000,
});

async function runBenchmark() {
  console.log(`=======================================================`);
  console.log(`🔥 STRESS TEST: 1000 CONCURRENT USERS GENERATING OTP 🔥`);
  console.log(`=======================================================\n`);
  console.log(`Target Endpoint: ${TARGET_URL}`);
  console.log(`Simultaneous Requests: ${TOTAL_USERS}`);
  console.log(`Starting spike test now...\n`);

  const startTime = Date.now();
  const results = {
    total: TOTAL_USERS,
    success200: 0,
    rateLimited429: 0,
    serverError500: 0,
    networkError: 0,
    otherStatus: 0,
    latencies: [],
    errors: {},
  };

  const requests = Array.from({ length: TOTAL_USERS }, (_, i) => {
    const userEmail = `user_stress_${i}_${Date.now()}@example.com`;
    const reqBody = JSON.stringify({ email: userEmail });

    const reqStart = Date.now();

    return fetch(TARGET_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: reqBody,
    })
      .then(async (res) => {
        const latency = Date.now() - reqStart;
        results.latencies.push(latency);

        let data = {};
        try {
          data = await res.json();
        } catch (e) {}

        if (res.status === 200) {
          results.success200++;
        } else if (res.status === 429) {
          results.rateLimited429++;
        } else if (res.status === 500) {
          results.serverError500++;
          const errText = data.error || '500 Server Error';
          results.errors[errText] = (results.errors[errText] || 0) + 1;
        } else {
          results.otherStatus++;
        }
      })
      .catch((err) => {
        const latency = Date.now() - reqStart;
        results.latencies.push(latency);
        results.networkError++;
        const errMsg = err.message || 'Network/Connection Error';
        results.errors[errMsg] = (results.errors[errMsg] || 0) + 1;
      });
  });

  await Promise.all(requests);
  const totalDuration = Date.now() - startTime;

  // Calculate stats
  results.latencies.sort((a, b) => a - b);
  const avgLatency = (results.latencies.reduce((a, b) => a + b, 0) / results.latencies.length).toFixed(2);
  const minLatency = results.latencies[0] || 0;
  const maxLatency = results.latencies[results.latencies.length - 1] || 0;
  const p50 = results.latencies[Math.floor(results.latencies.length * 0.50)] || 0;
  const p95 = results.latencies[Math.floor(results.latencies.length * 0.95)] || 0;
  const p99 = results.latencies[Math.floor(results.latencies.length * 0.99)] || 0;
  const rps = ((TOTAL_USERS / totalDuration) * 1000).toFixed(2);

  console.log(`=======================================================`);
  console.log(`📊 BENCHMARK RESULTS & TELEMETRY REPORT`);
  console.log(`=======================================================`);
  console.log(`⏱️ Total Test Duration: ${totalDuration} ms (${(totalDuration / 1000).toFixed(2)} seconds)`);
  console.log(`🚀 Requests per Second (RPS): ${rps} req/sec`);
  console.log(`-------------------------------------------------------`);
  console.log(`✅ Successful Requests (200 OK): ${results.success200} / ${TOTAL_USERS} (${((results.success200/TOTAL_USERS)*100).toFixed(1)}%)`);
  console.log(`⚠️ Rate Limited (429):          ${results.rateLimited429}`);
  console.log(`❌ Server Errors (500):         ${results.serverError500}`);
  console.log(`🔌 Network/Connection Failures: ${results.networkError}`);
  console.log(`-------------------------------------------------------`);
  console.log(`📈 LATENCY METRICS:`);
  console.log(`   • Min Latency: ${minLatency} ms`);
  console.log(`   • Avg Latency: ${avgLatency} ms`);
  console.log(`   • Max Latency: ${maxLatency} ms`);
  console.log(`   • p50 (Median): ${p50} ms`);
  console.log(`   • p95:          ${p95} ms`);
  console.log(`   • p99:          ${p99} ms`);
  console.log(`-------------------------------------------------------`);
  if (Object.keys(results.errors).length > 0) {
    console.log(`❗ ERROR BREAKDOWN:`);
    for (const [err, count] of Object.entries(results.errors)) {
      console.log(`   - "${err}": ${count} times`);
    }
  } else {
    console.log(`🎉 No server or network errors observed during peak burst!`);
  }
  console.log(`=======================================================\n`);
}

runBenchmark();
