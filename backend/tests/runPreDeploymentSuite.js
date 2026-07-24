const { PrismaClient } = require('@prisma/client');
const http = require('http');
const bcrypt = require('bcryptjs');

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:5000';
const prisma = new PrismaClient();

const results = [];

function recordResult(group, testName, passed, details = '', latencyMs = 0) {
  results.push({ group, testName, passed, details, latencyMs });
  const statusSymbol = passed ? '✅ PASS' : '❌ FAIL';
  console.log(`[${group}] ${statusSymbol} - ${testName} (${latencyMs}ms)${details ? ` | ${details}` : ''}`);
}

async function request(method, path, body = null, token = null) {
  const url = new URL(path, BASE_URL);
  const start = Date.now();

  return new Promise((resolve) => {
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    if (token) {
      options.headers['Authorization'] = `Bearer ${token}`;
    }

    const req = http.request(url, options, (res) => {
      let responseBody = '';
      res.on('data', (chunk) => (responseBody += chunk));
      res.on('end', () => {
        const latency = Date.now() - start;
        let parsed = null;
        try {
          parsed = JSON.parse(responseBody);
        } catch (e) {
          parsed = responseBody;
        }
        resolve({ status: res.statusCode, data: parsed, latency });
      });
    });

    req.on('error', (err) => {
      const latency = Date.now() - start;
      resolve({ status: 500, error: err.message, latency });
    });

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

async function runSuite() {
  console.log('\n======================================================');
  console.log('🚀 STARTING SEZNIK POS PRE-DEPLOYMENT TEST SUITE 🚀');
  console.log('======================================================\n');

  // 1. Health check
  {
    const res = await request('GET', '/health');
    const pass = res.status === 200 && res.data?.status === 'ok';
    recordResult('SYSTEM', 'Backend Server Health (/health)', pass, `Status ${res.status}`, res.latency);
  }

  // 2. Direct DB Operation Test
  {
    const start = Date.now();
    try {
      await prisma.$queryRaw`SELECT 1`;
      recordResult('DATABASE', 'Prisma Direct DB Connection & Query', true, 'Connected to PostgreSQL', Date.now() - start);
    } catch (err) {
      recordResult('DATABASE', 'Prisma Direct DB Connection & Query', false, err.message, Date.now() - start);
    }
  }

  // 3. Authentication Flow Setup
  let authToken = null;
  const testUserEmail = `predeploy_${Date.now()}@seznik.local`;
  const testPhone = '+19876543210';
  const testPassword = 'Password123!';

  // Pre-seed EmailOtp as verified in DB so registration succeeds
  {
    const codeHash = await bcrypt.hash('123456', 10);
    await prisma.emailOtp.upsert({
      where: { email: testUserEmail },
      create: {
        email: testUserEmail,
        codeHash: codeHash,
        expiresAt: new Date(Date.now() + 3600000),
        verifiedAt: new Date(),
      },
      update: {
        codeHash: codeHash,
        expiresAt: new Date(Date.now() + 3600000),
        verifiedAt: new Date(),
      },
    });
  }

  // Test registration
  {
    const res = await request('POST', '/api/auth/register', {
      email: testUserEmail,
      phone: testPhone,
      password: testPassword,
      displayName: 'PreDeploy Test Admin',
    });

    if (res.status === 201 || res.status === 200) {
      recordResult('AUTH', 'User Registration (/api/auth/register)', true, `Registered ${testUserEmail}`, res.latency);
      authToken = res.data?.token;
    } else {
      recordResult('AUTH', 'User Registration (/api/auth/register)', false, `Status ${res.status}: ${JSON.stringify(res.data)}`, res.latency);
    }
  }

  // Test login
  {
    const res = await request('POST', '/api/auth/login', {
      email: testUserEmail,
      password: testPassword,
    });

    if (res.status === 200 && res.data?.token) {
      authToken = res.data.token;
      recordResult('AUTH', 'User Login Authentication (/api/auth/login)', true, 'Token received', res.latency);
    } else {
      recordResult('AUTH', 'User Login Authentication (/api/auth/login)', false, `Status ${res.status}: ${JSON.stringify(res.data)}`, res.latency);
    }
  }

  // Test Protected Auth Profile
  {
    const res = await request('GET', '/api/auth/profile', null, authToken);
    const pass = res.status === 200 && (res.data?.email === testUserEmail || res.data?.user?.email === testUserEmail);
    recordResult('AUTH', 'Get Profile (/api/auth/profile)', pass, `Email: ${testUserEmail}`, res.latency);
  }

  if (!authToken) {
    console.error('❌ Cannot proceed with domain API tests: Authentication failed.');
    await prisma.$disconnect();
    return;
  }

  // Shared entity IDs for relational testing
  let categoryId = null;
  let productId = null;
  let customerId = null;
  let supplierId = null;
  let saleId = null;
  let expenseId = null;

  // 4. Categories API
  {
    const res = await request('POST', '/api/categories', { name: `TestCat_${Date.now()}` }, authToken);
    const pass = (res.status === 201 || res.status === 200) && res.data?.id;
    if (pass) categoryId = res.data.id;
    recordResult('CATEGORIES', 'Create Category (POST /api/categories)', pass, `ID: ${categoryId}`, res.latency);

    const getRes = await request('GET', '/api/categories', null, authToken);
    recordResult('CATEGORIES', 'List Categories (GET /api/categories)', getRes.status === 200, `Found ${Array.isArray(getRes.data) ? getRes.data.length : 0} items`, getRes.latency);
  }

  // 5. Suppliers API
  {
    const res = await request('POST', '/api/suppliers', {
      name: 'PreDeploy Supplier',
      phone: '9876543210',
      email: 'supplier@predeploy.test',
    }, authToken);

    const pass = (res.status === 201 || res.status === 200) && res.data?.id;
    if (pass) supplierId = res.data.id;
    recordResult('SUPPLIERS', 'Create Supplier (POST /api/suppliers)', pass, `ID: ${supplierId}`, res.latency);

    const getRes = await request('GET', '/api/suppliers', null, authToken);
    recordResult('SUPPLIERS', 'List Suppliers (GET /api/suppliers)', getRes.status === 200, `Found ${Array.isArray(getRes.data) ? getRes.data.length : 0}`, getRes.latency);
  }

  // 6. Customers API
  {
    const res = await request('POST', '/api/customers', {
      name: 'PreDeploy Customer',
      phone: '9123456789',
      email: 'customer@predeploy.test',
    }, authToken);

    const pass = (res.status === 201 || res.status === 200) && res.data?.id;
    if (pass) customerId = res.data.id;
    recordResult('CUSTOMERS', 'Create Customer (POST /api/customers)', pass, `ID: ${customerId}`, res.latency);

    const getRes = await request('GET', '/api/customers', null, authToken);
    recordResult('CUSTOMERS', 'List Customers (GET /api/customers)', getRes.status === 200, `Found ${Array.isArray(getRes.data) ? getRes.data.length : 0}`, getRes.latency);
  }

  // 7. Products API
  const testBarcode = `TESTBAR_${Date.now()}`;
  {
    const res = await request('POST', '/api/products', {
      name: 'PreDeploy Test Product',
      sku: `SKU_${Date.now()}`,
      barcode: testBarcode,
      categoryId: categoryId,
      supplierId: supplierId,
      sellingPrice: 150.00,
      costPrice: 100.00,
      currentStock: 50,
      lowStockThreshold: 5,
      unit: 'piece',
    }, authToken);

    const pass = (res.status === 201 || res.status === 200) && res.data?.id;
    if (pass) productId = res.data.id;
    recordResult('PRODUCTS', 'Create Product (POST /api/products)', pass, `ID: ${productId}`, res.latency);

    const getRes = await request('GET', '/api/products', null, authToken);
    recordResult('PRODUCTS', 'List Products (GET /api/products)', getRes.status === 200, `Retrieved products list`, getRes.latency);

    const lowStockRes = await request('GET', '/api/products/low-stock', null, authToken);
    recordResult('PRODUCTS', 'Get Low Stock (GET /api/products/low-stock)', lowStockRes.status === 200, `Low stock items retrieved`, lowStockRes.latency);

    if (testBarcode) {
      const barcodeRes = await request('GET', `/api/products/barcode/${testBarcode}`, null, authToken);
      recordResult('PRODUCTS', 'Lookup by Barcode (GET /api/products/barcode/:barcode)', barcodeRes.status === 200, `Barcode found`, barcodeRes.latency);
    }

    if (productId) {
      const adjustRes = await request('POST', `/api/products/${productId}/stock`, { qty: 10, reason: 'Pre-deploy test add' }, authToken);
      recordResult('PRODUCTS', 'Adjust Stock (POST /api/products/:id/stock)', adjustRes.status === 200 && adjustRes.data?.success, `Stock adjusted`, adjustRes.latency);
    }
  }

  // 8. Sales API
  {
    if (productId) {
      const res = await request('POST', '/api/sales', {
        customerId: customerId,
        items: [
          { productId: productId, name: 'PreDeploy Test Product', quantity: 2, price: 150.00, costPrice: 100.00 }
        ],
        subtotal: 300.00,
        totalDiscount: 0,
        totalTax: 0,
        grandTotal: 300.00,
        paymentMethod: 'CASH',
        amountPaid: 300.00,
        changeReturned: 0,
      }, authToken);

      const pass = (res.status === 201 || res.status === 200) && res.data?.id;
      if (pass) saleId = res.data.id;
      recordResult('SALES', 'Create Sale Transaction (POST /api/sales)', pass, `Sale ID: ${saleId}`, res.latency);
    }

    const getSalesRes = await request('GET', '/api/sales', null, authToken);
    recordResult('SALES', 'List Sales History (GET /api/sales)', getSalesRes.status === 200, `Sales listed`, getSalesRes.latency);
  }

  // 9. Purchases API
  {
    if (productId && supplierId) {
      const res = await request('POST', '/api/purchases', {
        supplierId: supplierId,
        items: [
          { productId: productId, quantity: 10, costPrice: 95.00 }
        ],
        subtotal: 950.00,
        totalTax: 0,
        grandTotal: 950.00,
        paymentMethod: 'BANK_TRANSFER',
        amountPaid: 950.00,
      }, authToken);

      const pass = (res.status === 201 || res.status === 200) && res.data?.id;
      recordResult('PURCHASES', 'Create Purchase Order (POST /api/purchases)', pass, `Purchase recorded (ID: ${res.data?.id})`, res.latency);
    }

    const getPurchasesRes = await request('GET', '/api/purchases', null, authToken);
    recordResult('PURCHASES', 'List Purchases (GET /api/purchases)', getPurchasesRes.status === 200, `Purchases listed`, getPurchasesRes.latency);
  }

  // 10. Expenses API
  {
    const res = await request('POST', '/api/expenses', {
      category: 'Utilities',
      amount: 45.50,
      description: 'PreDeploy Test Internet Bill',
      date: new Date().toISOString(),
    }, authToken);

    const pass = (res.status === 201 || res.status === 200) && res.data?.id;
    if (pass) expenseId = res.data.id;
    recordResult('EXPENSES', 'Create Expense (POST /api/expenses)', pass, `Expense ID: ${expenseId}`, res.latency);

    const getRes = await request('GET', '/api/expenses', null, authToken);
    recordResult('EXPENSES', 'List Expenses (GET /api/expenses)', getRes.status === 200, `Expenses listed`, getRes.latency);
  }

  // 11. Customer Credits API
  {
    const res = await request('GET', '/api/credits', null, authToken);
    recordResult('CREDITS', 'List Customer Credits (GET /api/credits)', res.status === 200, `Credits data retrieved`, res.latency);
  }

  // 12. Settings API
  {
    const getRes = await request('GET', '/api/settings', null, authToken);
    recordResult('SETTINGS', 'Get Store Settings (GET /api/settings)', getRes.status === 200, `Settings loaded`, getRes.latency);
  }

  // 13. Reports & Analytics API
  {
    const reportEndpoints = [
      { name: 'Dashboard Stats', path: '/api/reports/dashboard' },
      { name: 'Sales Report', path: '/api/reports/sales' },
      { name: 'P&L Report', path: '/api/reports/pl' },
      { name: 'Tax Report', path: '/api/reports/tax' },
      { name: 'Revenue Trend', path: '/api/reports/trend' },
      { name: 'Top Customers', path: '/api/reports/top-customers' },
      { name: 'Payment Modes Breakdown', path: '/api/reports/payment-modes' },
      { name: 'Profit Breakdown', path: '/api/reports/profit-breakdown' },
      { name: 'Top Products', path: '/api/reports/top-products' },
      { name: 'Top Categories', path: '/api/reports/top-categories' },
      { name: 'Expense Summary', path: '/api/reports/expense-summary' },
    ];

    for (const ep of reportEndpoints) {
      const res = await request('GET', ep.path, null, authToken);
      recordResult('REPORTS', `${ep.name} (${ep.path})`, res.status === 200, `Status ${res.status}`, res.latency);
    }
  }

  // 14. Concurrent Load Benchmark
  {
    const CONCURRENCY = 50;
    console.log(`\n⏳ Running Load Test: ${CONCURRENCY} concurrent requests to /api/reports/dashboard...`);
    const start = Date.now();
    const promises = Array.from({ length: CONCURRENCY }, () => request('GET', '/api/reports/dashboard', null, authToken));
    const loadResults = await Promise.all(promises);
    const totalTime = Date.now() - start;
    const successes = loadResults.filter(r => r.status === 200).length;
    const avgLatency = Math.round(loadResults.reduce((acc, r) => acc + r.latency, 0) / CONCURRENCY);

    const pass = successes === CONCURRENCY;
    recordResult('LOAD_TEST', `Concurrent Load Benchmark (${CONCURRENCY} Parallel Requests)`, pass, `${successes}/${CONCURRENCY} Succeeded | Avg Latency: ${avgLatency}ms | Total Duration: ${totalTime}ms`, totalTime);
  }

  // Cleanup Test User and Data
  {
    try {
      if (testUserEmail) {
        await prisma.user.deleteMany({
          where: { email: testUserEmail }
        });
        console.log(`\n🧹 Cleaned up temporary test user ${testUserEmail}`);
      }
    } catch (e) {
      console.warn('⚠️ Cleanup note:', e.message);
    }
  }

  await prisma.$disconnect();

  // Summary Report
  const total = results.length;
  const passedCount = results.filter(r => r.passed).length;
  const failedCount = total - passedCount;

  console.log('\n======================================================');
  console.log(`📊 TEST SUITE SUMMARY: ${passedCount}/${total} PASSED (${failedCount} FAILED)`);
  console.log('======================================================\n');

  if (failedCount > 0) {
    console.log('❌ FAILED TESTS:');
    results.filter(r => !r.passed).forEach(f => {
      console.log(`  - [${f.group}] ${f.testName}: ${f.details}`);
    });
    process.exit(1);
  } else {
    console.log('🎉 ALL PRE-DEPLOYMENT TESTS PASSED SUCCESSFULLY! Ready for deployment.');
  }
}

runSuite().catch(err => {
  console.error('Fatal Suite Execution Error:', err);
  process.exit(1);
});
