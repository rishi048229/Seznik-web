import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// Custom Metrics
const errorRate = new Rate('error_rate');
const loginTrend = new Trend('login_duration_ms');
const productsTrend = new Trend('products_duration_ms');
const salesTrend = new Trend('sales_duration_ms');
const reportsTrend = new Trend('reports_duration_ms');

// Configuration: Target AWS Dev Server or local backend via CLI flag:
// e.g. k6 run -e BASE_URL=http://54.175.133.69:5000/api backend/k6-load-test.js
const BASE_URL = __ENV.BASE_URL || 'http://localhost:5001/api';
const TEST_EMAIL = __ENV.TEST_EMAIL || 'admin@seznik.com';
const TEST_PASSWORD = __ENV.TEST_PASSWORD || 'Admin@123456';

export const options = {
  stages: [
    { duration: '30s', target: 10 },  // Ramp-up to 10 VUs
    { duration: '1m', target: 50 },   // Scale to 50 concurrent users
    { duration: '30s', target: 100 }, // Peak load 100 concurrent users
    { duration: '30s', target: 0 },   // Cool-down to 0
  ],
  thresholds: {
    http_req_duration: ['p(95)<600', 'p(99)<1200'], // 95% requests under 600ms
    error_rate: ['rate<0.02'],                       // Error rate below 2%
    http_req_failed: ['rate<0.02'],                  // Failed HTTP requests below 2%
  },
};

export default function () {
  const defaultHeaders = {
    'Content-Type': 'application/json',
    'x-client-platform': 'k6-load-tester',
  };

  // 1. Health & Server Ping
  group('01. Health Check', function () {
    const res = http.get(`${BASE_URL}/health`, { headers: defaultHeaders });
    const success = check(res, {
      'Health check status is 200': (r) => r.status === 200,
    });
    errorRate.add(!success);
  });

  sleep(0.5);

  let authToken = null;

  // 2. Authentication Flow
  group('02. Authentication Login', function () {
    const loginPayload = JSON.stringify({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
    });

    const start = Date.now();
    const res = http.post(`${BASE_URL}/auth/login`, loginPayload, { headers: defaultHeaders });
    loginTrend.add(Date.now() - start);

    const success = check(res, {
      'Login status is 200 or 401': (r) => r.status === 200 || r.status === 401,
    });
    errorRate.add(!success);

    if (res.status === 200) {
      try {
        const body = JSON.parse(res.body);
        authToken = body.token || (body.data && body.data.token);
      } catch (e) {}
    }
  });

  const authHeaders = {
    ...defaultHeaders,
    ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
  };

  sleep(0.5);

  // 3. Product Catalog & Inventory
  group('03. Products & Stock', function () {
    const start = Date.now();
    const resCatalog = http.get(`${BASE_URL}/products`, { headers: authHeaders });
    productsTrend.add(Date.now() - start);

    const catalogSuccess = check(resCatalog, {
      'Products catalog status is 200': (r) => r.status === 200,
    });
    errorRate.add(!catalogSuccess);

    const resLowStock = http.get(`${BASE_URL}/products/low-stock`, { headers: authHeaders });
    const lowStockSuccess = check(resLowStock, {
      'Low stock status is 200': (r) => r.status === 200,
    });
    errorRate.add(!lowStockSuccess);
  });

  sleep(0.5);

  // 4. Sales & Invoices
  group('04. Sales & Orders History', function () {
    const start = Date.now();
    const resSales = http.get(`${BASE_URL}/sales?page=1&limit=20`, { headers: authHeaders });
    salesTrend.add(Date.now() - start);

    const salesSuccess = check(resSales, {
      'Sales history status is 200': (r) => r.status === 200,
    });
    errorRate.add(!salesSuccess);
  });

  sleep(0.5);

  // 5. Day Book & Financial Analytics
  group('05. Reports & Day Book', function () {
    const start = Date.now();
    const resReports = http.get(`${BASE_URL}/reports/dashboard`, { headers: authHeaders });
    reportsTrend.add(Date.now() - start);

    const reportSuccess = check(resReports, {
      'Reports dashboard status is 200': (r) => r.status === 200,
    });
    errorRate.add(!reportSuccess);
  });

  sleep(0.5);

  // 6. Customers & Credit Ledger
  group('06. Customers & Credit Ledger', function () {
    const resCustomers = http.get(`${BASE_URL}/customers`, { headers: authHeaders });
    const custSuccess = check(resCustomers, {
      'Customers list status is 200': (r) => r.status === 200,
    });
    errorRate.add(!custSuccess);

    const resCredits = http.get(`${BASE_URL}/credit`, { headers: authHeaders });
    const creditSuccess = check(resCredits, {
      'Credits list status is 200': (r) => r.status === 200,
    });
    errorRate.add(!creditSuccess);
  });

  sleep(1);
}
