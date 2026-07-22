import http from 'k6/http';
import { check, sleep, group } from 'k6';

// ---------------------------------------------------------------------------
// K6 STRESS TEST CONFIGURATION
// ---------------------------------------------------------------------------
export const options = {
  stages: [
    { duration: '10s', target: 10 },  // Ramp-up to 10 Virtual Users (VUs)
    { duration: '30s', target: 50 },  // Spike up to 50 concurrent VUs (heavy load)
    { duration: '20s', target: 100 }, // Peak stress test at 100 concurrent VUs
    { duration: '10s', target: 0 },   // Cool-down back to 0 VUs
  ],
  thresholds: {
    // 95% of requests must complete in under 500ms
    http_req_duration: ['p(95)<500', 'p(99)<1000'],
    // Error rate must be under 1%
    http_req_failed: ['rate<0.01'],
  },
};

const BASE_URL = __ENV.API_URL || 'http://localhost:5000/api';

// Test User Credentials
const TEST_USER = {
  email: 'admin@seznik.com',
  password: 'password123',
};

// ---------------------------------------------------------------------------
// TEST SETUP (Runs once before VUs start)
// ---------------------------------------------------------------------------
export function setup() {
  const loginRes = http.post(`${BASE_URL}/auth/login`, JSON.stringify(TEST_USER), {
    headers: { 'Content-Type': 'application/json' },
  });

  if (loginRes.status === 200) {
    const body = JSON.parse(loginRes.body);
    return { token: body.token };
  }

  console.warn('Setup login failed, running in unauthenticated mode or registering test user');
  return { token: null };
}

// ---------------------------------------------------------------------------
// VIRTUAL USER SCENARIO EXECUTION
// ---------------------------------------------------------------------------
export default function (data) {
  const params = {
    headers: {
      'Content-Type': 'application/json',
      ...(data.token ? { Authorization: `Bearer ${data.token}` } : {}),
    },
  };

  group('Health Check', function () {
    const res = http.get('http://localhost:5000/health');
    check(res, { 'Health 200 OK': (r) => r.status === 200 });
  });

  group('Inventory Catalog APIs', function () {
    const productsRes = http.get(`${BASE_URL}/products`, params);
    check(productsRes, { 'Products status 200': (r) => r.status === 200 });

    const categoriesRes = http.get(`${BASE_URL}/categories`, params);
    check(categoriesRes, { 'Categories status 200': (r) => r.status === 200 });
  });

  group('Sales & Expenses APIs', function () {
    const salesRes = http.get(`${BASE_URL}/sales`, params);
    check(salesRes, { 'Sales status 200': (r) => r.status === 200 });

    const expensesRes = http.get(`${BASE_URL}/expenses`, params);
    check(expensesRes, { 'Expenses status 200': (r) => r.status === 200 });
  });

  group('Reports & Analytics APIs', function () {
    const dashboardRes = http.get(`${BASE_URL}/reports/dashboard`, params);
    check(dashboardRes, { 'Dashboard Stats status 200': (r) => r.status === 200 });

    const plRes = http.get(`${BASE_URL}/reports/pl?start=2026-01-01&end=2026-12-31`, params);
    check(plRes, { 'P&L Report status 200': (r) => r.status === 200 });
  });

  sleep(0.5 + Math.random());
}
