-- Indexes supporting the POS catalog delta sync and the low-stock scan. Purely additive.
--
-- CONCURRENTLY is deliberately omitted: Prisma wraps each migration in a transaction, which
-- Postgres forbids for concurrent index builds. These tables are small enough per tenant that the
-- brief write lock is acceptable; on a large deployment, build them out of band instead.

-- Serves `where: { userId, updatedAt: { gt: cursor } }` in getProductCatalog's delta path.
CREATE INDEX IF NOT EXISTS "Product_userId_updatedAt_idx" ON "Product" ("userId", "updatedAt");

-- Serves getLowStockProducts, which orders by currentStock within a tenant.
CREATE INDEX IF NOT EXISTS "Product_userId_currentStock_idx" ON "Product" ("userId", "currentStock");

-- Category reads are always tenant-scoped and ordered by name; previously only parentId was indexed.
CREATE INDEX IF NOT EXISTS "Category_userId_name_idx" ON "Category" ("userId", "name");
