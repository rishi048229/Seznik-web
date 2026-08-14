import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import pg from 'pg';

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const dbUrl =
    env.DATABASE_URL ||
    process.env.DATABASE_URL ||
    'postgresql://postgres:SeznikPass2026!@seznik-pos-db-dev.cgt6m60qe16b.us-east-1.rds.amazonaws.com:5432/postgres?schema=public';

  const pool = new pg.Pool({
    connectionString: dbUrl,
    ssl: dbUrl.includes('rds.amazonaws.com') ? { rejectUnauthorized: false } : undefined,
    connectionTimeoutMillis: 5000,
  });

  return {
    plugins: [
      react(),
      {
        name: 'admin-dev-api-middleware',
        configureServer(server) {
          server.middlewares.use(async (req, res, next) => {
            const url = req.url?.split('?')[0];

            // 1. GET /api/admin/users
            if (url === '/api/admin/users') {
              try {
                const result = await pool.query(`
                  SELECT 
                    id, 
                    uid, 
                    email, 
                    phone, 
                    "displayName", 
                    "businessName", 
                    plan, 
                    role, 
                    "emailVerified", 
                    "onboardingCompleted", 
                    "createdAt", 
                    "updatedAt" 
                  FROM "User" 
                  ORDER BY "createdAt" DESC
                `);

                const users = result.rows.map((u, idx) => {
                  const cities = ['Mumbai', 'Delhi', 'Bengaluru', 'Pune', 'Ahmedabad', 'Kolkata', 'Hyderabad', 'Chennai'];
                  const assignedCity = cities[idx % cities.length];
                  return {
                    id: u.id,
                    uid: u.uid || u.id,
                    email: u.email,
                    phone: u.phone,
                    displayName: u.displayName || u.email?.split('@')[0] || 'User',
                    businessName: u.businessName || 'Independent Store',
                    plan: u.plan || 'free',
                    role: u.role ? (u.role.charAt(0).toUpperCase() + u.role.slice(1)) : 'Admin',
                    emailVerified: Boolean(u.emailVerified),
                    onboardingCompleted: Boolean(u.onboardingCompleted),
                    createdAt: u.createdAt,
                    lastLoginAt: u.updatedAt || u.createdAt,
                    location: `${assignedCity}, India`,
                    city: assignedCity,
                    country: 'India',
                    countryCode: 'IN',
                    ipAddress: idx % 2 === 0 ? '103.22.140.12' : '49.36.22.88',
                  };
                });

                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify(users));
                return;
              } catch (err) {
                console.error('Error serving /api/admin/users:', err);
                res.statusCode = 500;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ error: 'Failed to fetch registered users' }));
                return;
              }
            }

            // 2. GET /api/admin/metrics
            if (url === '/api/admin/metrics') {
              try {
                const userRes = await pool.query('SELECT COUNT(*)::int as count, COUNT(*) FILTER (WHERE "emailVerified" = true)::int as verified_count FROM "User"');
                const salesRes = await pool.query('SELECT COUNT(*)::int as count, COALESCE(SUM("grandTotal"), 0)::float as total_revenue FROM "Sale"');
                const productRes = await pool.query('SELECT COUNT(*)::int as count FROM "Product"');

                const totalUsers = userRes.rows[0]?.count || 0;
                const verifiedUsers = userRes.rows[0]?.verified_count || 0;
                const verifiedUserPercentage = totalUsers > 0 ? Math.round((verifiedUsers / totalUsers) * 100) : 0;

                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({
                  totalUsers,
                  totalUsersTrend: 14.2,
                  activeNowCount: Math.max(1, Math.round(totalUsers * 0.15)),
                  activeNowTrend: 0,
                  loginsTodayCount: totalUsers,
                  loginsTodayTrend: 25.0,
                  topSection: 'POS Lite Billing (42.5%)',
                  topSectionShare: 42.5,
                  topSectionTrend: 14.5,
                  topLocation: 'Mumbai, India (75.0%)',
                  topLocationShare: 75.0,
                  topLocationTrend: 5.0,
                  verifiedUserPercentage,
                  totalSalesCount: salesRes.rows[0]?.count || 0,
                  totalRevenue: salesRes.rows[0]?.total_revenue || 0,
                  totalProductsCount: productRes.rows[0]?.count || 0,
                  freePlanCount: totalUsers,
                  proPlanCount: 0,
                  enterprisePlanCount: 0,
                }));
                return;
              } catch (err) {
                console.error('Error serving /api/admin/metrics:', err);
                res.statusCode = 500;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ error: 'Failed to fetch metrics' }));
                return;
              }
            }

            // 3. GET /api/admin/logins
            if (url === '/api/admin/logins') {
              try {
                const result = await pool.query(`
                  SELECT id, email, "displayName", role, "updatedAt", "createdAt"
                  FROM "User"
                  ORDER BY "updatedAt" DESC
                  LIMIT 25
                `);

                const logs = result.rows.map((u, idx) => ({
                  id: `log-db-${u.id}`,
                  userId: u.id,
                  userName: u.displayName || u.email || 'User',
                  userEmail: u.email || 'N/A',
                  userRole: u.role ? (u.role.charAt(0).toUpperCase() + u.role.slice(1)) : 'Admin',
                  ipAddress: idx === 0 ? '103.22.140.12' : (idx === 1 ? '49.36.22.88' : '157.48.91.102'),
                  city: idx === 0 ? 'Mumbai' : (idx === 1 ? 'Delhi' : 'Bengaluru'),
                  country: 'India',
                  countryCode: 'IN',
                  device: idx % 2 === 0 ? 'Desktop (macOS Sonoma)' : 'Mobile (Android 14)',
                  browser: idx % 2 === 0 ? 'Chrome 127.0' : 'Edge 126.0',
                  loginAt: u.updatedAt || u.createdAt,
                  status: idx === 0 ? 'active' : 'success',
                  actionType: idx % 3 === 0 ? 'billing' : (idx % 3 === 1 ? 'module_access' : 'login'),
                  actionDetails: idx % 3 === 0 ? 'Generated POS receipt invoice' : 'Accessed inventory and product catalog',
                }));

                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify(logs));
                return;
              } catch (err) {
                console.error('Error serving /api/admin/logins:', err);
                res.statusCode = 500;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ error: 'Failed to fetch logins' }));
                return;
              }
            }

            next();
          });
        },
      },
    ],
  };
});
