import { Product, Vendor, Bill, BillItem, StockHistoryItem, ShopProfile, BusinessMode, RateTile, Customer, Expense, Category } from '../types';

let sqliteDb: any = null;

async function getSQLiteDb() {
  if (sqliteDb) return sqliteDb;

  try {
    const SQLite = require('expo-sqlite');
    sqliteDb = await SQLite.openDatabaseAsync('seznik_inventory.db');
    return sqliteDb;
  } catch (error) {
    console.error('Failed to open SQLite database:', error);
    return null;
  }
}

export async function initDatabase() {
  const db = await getSQLiteDb();
  if (db) {
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS vendors (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        contact TEXT NOT NULL,
        email TEXT,
        address TEXT,
        taxId TEXT
      );

      CREATE TABLE IF NOT EXISTS products (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        barcode TEXT NOT NULL,
        sku TEXT,
        category TEXT,
        categoryId TEXT,
        unit TEXT,
        price REAL NOT NULL,
        costPrice REAL,
        stockQty INTEGER NOT NULL,
        reorderThreshold INTEGER NOT NULL,
        vendorId TEXT,
        imageUri TEXT,
        archived INTEGER DEFAULT 0,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL,
        FOREIGN KEY(vendorId) REFERENCES vendors(id)
      );

      CREATE TABLE IF NOT EXISTS bills (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL DEFAULT 'product',
        subtotal REAL NOT NULL,
        gstMode TEXT,
        taxPercent REAL NOT NULL,
        discount TEXT NOT NULL,
        total REAL NOT NULL,
        customerId TEXT,
        customerName TEXT,
        customerPhone TEXT,
        paymentMethod TEXT DEFAULT 'cash',
        amountReceived REAL,
        customField TEXT,
        notes TEXT,
        printStatus TEXT NOT NULL,
        createdAt TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS bill_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        billId TEXT NOT NULL,
        productId TEXT,
        tileId TEXT,
        name TEXT,
        categoryId TEXT,
        unit TEXT,
        label TEXT,
        qty INTEGER,
        unitPrice REAL,
        costPrice REAL,
        price REAL,
        lineTotal REAL,
        FOREIGN KEY(billId) REFERENCES bills(id)
      );

      CREATE TABLE IF NOT EXISTS stock_history (
        id TEXT PRIMARY KEY,
        productId TEXT NOT NULL,
        type TEXT NOT NULL,
        qty INTEGER NOT NULL,
        date TEXT NOT NULL,
        description TEXT NOT NULL,
        reasonCode TEXT,
        FOREIGN KEY(productId) REFERENCES products(id)
      );

      CREATE TABLE IF NOT EXISTS shop_profile (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        logoUri TEXT,
        address TEXT,
        phone TEXT,
        taxId TEXT
      );

      CREATE TABLE IF NOT EXISTS rate_tiles (
        id TEXT PRIMARY KEY,
        label TEXT NOT NULL,
        price REAL NOT NULL,
        sortOrder INTEGER NOT NULL,
        color TEXT
      );

      CREATE TABLE IF NOT EXISTS customers (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        phone TEXT NOT NULL,
        totalSpend REAL DEFAULT 0,
        visitCount INTEGER DEFAULT 0,
        lastVisitAt TEXT,
        isMonthlyPass INTEGER DEFAULT 0,
        passExpiryDate TEXT,
        creditBalance REAL DEFAULT 0,
        notes TEXT,
        createdAt TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS expenses (
        id TEXT PRIMARY KEY,
        category TEXT NOT NULL,
        amount REAL NOT NULL,
        note TEXT,
        date TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS categories (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        sortOrder INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS app_settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
    `);

    // Seed shop profile if empty (clean empty strings, no dummy data)
    const profile = await db.getAllAsync('SELECT * FROM shop_profile LIMIT 1');
    if (profile.length === 0) {
      await db.runAsync(
        'INSERT INTO shop_profile (id, name, logoUri, address, phone, taxId) VALUES (?, ?, ?, ?, ?, ?)',
        ['profile', '', '', '', '', '']
      );
    }

    // Run migrations for existing databases (add columns if missing)
    try {
      await db.execAsync(`ALTER TABLE products ADD COLUMN costPrice REAL;`);
    } catch (_e) { /* Column exists */ }
    try {
      await db.execAsync(`ALTER TABLE products ADD COLUMN categoryId TEXT;`);
    } catch (_e) { /* Column exists */ }
    try {
      await db.execAsync(`ALTER TABLE products ADD COLUMN archived INTEGER DEFAULT 0;`);
    } catch (_e) { /* Column exists */ }
    try {
      await db.execAsync(`ALTER TABLE bills ADD COLUMN type TEXT DEFAULT 'product';`);
    } catch (_e) { /* Column exists */ }
    try {
      await db.execAsync(`ALTER TABLE bills ADD COLUMN customerId TEXT;`);
    } catch (_e) { /* Column exists */ }
    try {
      await db.execAsync(`ALTER TABLE bills ADD COLUMN paymentMethod TEXT DEFAULT 'cash';`);
    } catch (_e) { /* Column exists */ }
    try {
      await db.execAsync(`ALTER TABLE bills ADD COLUMN customField TEXT;`);
    } catch (_e) { /* Column exists */ }
    try {
      await db.execAsync(`ALTER TABLE stock_history ADD COLUMN reasonCode TEXT;`);
    } catch (_e) { /* Column exists */ }
    try {
      await db.execAsync(`ALTER TABLE bill_items ADD COLUMN costPrice REAL;`);
    } catch (_e) { /* Column exists */ }
    try {
      await db.execAsync(`ALTER TABLE bill_items ADD COLUMN tileId TEXT;`);
    } catch (_e) { /* Column exists */ }
    try {
      await db.execAsync(`ALTER TABLE bill_items ADD COLUMN label TEXT;`);
    } catch (_e) { /* Column exists */ }
    try {
      await db.execAsync(`ALTER TABLE bill_items ADD COLUMN price REAL;`);
    } catch (_e) { /* Column exists */ }
    try {
      await db.execAsync(`ALTER TABLE products ADD COLUMN unit TEXT;`);
    } catch (_e) { /* Column exists */ }
    try {
      await db.execAsync(`ALTER TABLE bill_items ADD COLUMN unit TEXT;`);
    } catch (_e) { /* Column exists */ }
    try {
      await db.execAsync(`ALTER TABLE bill_items ADD COLUMN categoryId TEXT;`);
    } catch (_e) { /* Column exists */ }
  }
}

// ─── Business Mode & Onboarding ─────────────────────────────────────────────

export async function getBusinessMode(): Promise<BusinessMode> {
  const db = await getSQLiteDb();
  if (!db) return 'product';
  const rows: any[] = await db.getAllAsync(`SELECT value FROM app_settings WHERE key = 'business_mode'`);
  if (rows.length > 0) return rows[0].value as BusinessMode;
  return 'product';
}

export async function saveBusinessMode(mode: BusinessMode): Promise<void> {
  const db = await getSQLiteDb();
  if (!db) return;
  await db.runAsync(
    `INSERT INTO app_settings (key, value) VALUES ('business_mode', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    [mode]
  );
}

export async function getOnboarded(): Promise<boolean> {
  const db = await getSQLiteDb();
  if (!db) return false;
  const rows: any[] = await db.getAllAsync(`SELECT value FROM app_settings WHERE key = 'onboarded'`);
  return rows.length > 0 && rows[0].value === 'true';
}

export async function saveOnboarded(val: boolean): Promise<void> {
  const db = await getSQLiteDb();
  if (!db) return;
  await db.runAsync(
    `INSERT INTO app_settings (key, value) VALUES ('onboarded', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    [val ? 'true' : 'false']
  );
}

// ─── Shop Profile ───────────────────────────────────────────────────────────

export async function getShopProfile(): Promise<ShopProfile> {
  const db = await getSQLiteDb();
  if (!db) return { name: '' };
  const profile: any[] = await db.getAllAsync('SELECT * FROM shop_profile LIMIT 1');
  if (profile.length > 0) {
    return {
      name: profile[0].name || '',
      logoUri: profile[0].logoUri || undefined,
      address: profile[0].address || undefined,
      phone: profile[0].phone || undefined,
      taxId: profile[0].taxId || undefined,
    };
  }
  return { name: '' };
}

export async function saveShopProfile(profile: ShopProfile): Promise<void> {
  const db = await getSQLiteDb();
  if (!db) return;
  await db.runAsync(
    `INSERT INTO shop_profile (id, name, logoUri, address, phone, taxId)
     VALUES ('profile', ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       name = excluded.name,
       logoUri = excluded.logoUri,
       address = excluded.address,
       phone = excluded.phone,
       taxId = excluded.taxId`,
    [profile.name || '', profile.logoUri || '', profile.address || '', profile.phone || '', profile.taxId || '']
  );
}

// ─── Rate Tiles ─────────────────────────────────────────────────────────────

export async function getRateTiles(): Promise<RateTile[]> {
  const db = await getSQLiteDb();
  if (!db) return [];
  const rows: any[] = await db.getAllAsync('SELECT * FROM rate_tiles ORDER BY sortOrder ASC');
  return rows.map((r) => ({ id: r.id, label: r.label, price: r.price, order: r.sortOrder, color: r.color || undefined }));
}

export async function saveRateTile(tile: RateTile): Promise<void> {
  const db = await getSQLiteDb();
  if (!db) return;
  await db.runAsync(
    `INSERT INTO rate_tiles (id, label, price, sortOrder, color) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET label=excluded.label, price=excluded.price, sortOrder=excluded.sortOrder, color=excluded.color`,
    [tile.id, tile.label, tile.price, tile.order, tile.color || '']
  );
}

export async function deleteRateTile(id: string): Promise<void> {
  const db = await getSQLiteDb();
  if (!db) return;
  await db.runAsync('DELETE FROM rate_tiles WHERE id = ?', [id]);
}

export async function saveAllRateTiles(tiles: RateTile[]): Promise<void> {
  const db = await getSQLiteDb();
  if (!db) return;
  await db.runAsync('DELETE FROM rate_tiles');
  for (const tile of tiles) {
    await saveRateTile(tile);
  }
}

// ─── Categories ─────────────────────────────────────────────────────────────

export async function getCategories(): Promise<Category[]> {
  const db = await getSQLiteDb();
  if (!db) return [];
  const rows: any[] = await db.getAllAsync('SELECT * FROM categories ORDER BY sortOrder ASC');
  return rows.map((r) => ({ id: r.id, name: r.name, order: r.sortOrder }));
}

export async function saveCategory(category: Category): Promise<void> {
  const db = await getSQLiteDb();
  if (!db) return;
  await db.runAsync(
    `INSERT INTO categories (id, name, sortOrder) VALUES (?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET name=excluded.name, sortOrder=excluded.sortOrder`,
    [category.id, category.name, category.order]
  );
}

export async function deleteCategory(id: string): Promise<void> {
  const db = await getSQLiteDb();
  if (!db) return;
  await db.runAsync('DELETE FROM categories WHERE id = ?', [id]);
}

export async function saveAllCategories(categories: Category[]): Promise<void> {
  const db = await getSQLiteDb();
  if (!db) return;
  await db.runAsync('DELETE FROM categories');
  for (const cat of categories) {
    await saveCategory(cat);
  }
}

// ─── Customers ──────────────────────────────────────────────────────────────

export async function getCustomers(): Promise<Customer[]> {
  const db = await getSQLiteDb();
  if (!db) return [];
  const rows: any[] = await db.getAllAsync('SELECT * FROM customers ORDER BY lastVisitAt DESC');
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    phone: r.phone,
    totalSpend: r.totalSpend || 0,
    visitCount: r.visitCount || 0,
    lastVisitAt: r.lastVisitAt || r.createdAt,
    isMonthlyPass: r.isMonthlyPass === 1,
    passExpiryDate: r.passExpiryDate || undefined,
    creditBalance: r.creditBalance || 0,
    notes: r.notes || undefined,
    createdAt: r.createdAt,
  }));
}

export async function saveCustomer(customer: Customer): Promise<void> {
  const db = await getSQLiteDb();
  if (!db) return;
  await db.runAsync(
    `INSERT INTO customers (id, name, phone, totalSpend, visitCount, lastVisitAt, isMonthlyPass, passExpiryDate, creditBalance, notes, createdAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
     name=excluded.name, phone=excluded.phone, totalSpend=excluded.totalSpend, visitCount=excluded.visitCount,
     lastVisitAt=excluded.lastVisitAt, isMonthlyPass=excluded.isMonthlyPass, passExpiryDate=excluded.passExpiryDate,
     creditBalance=excluded.creditBalance, notes=excluded.notes`,
    [
      customer.id, customer.name, customer.phone, customer.totalSpend, customer.visitCount,
      customer.lastVisitAt, customer.isMonthlyPass ? 1 : 0, customer.passExpiryDate || '',
      customer.creditBalance || 0, customer.notes || '', customer.createdAt,
    ]
  );
}

export async function deleteCustomer(id: string): Promise<void> {
  const db = await getSQLiteDb();
  if (!db) return;
  await db.runAsync('DELETE FROM customers WHERE id = ?', [id]);
}

// ─── Expenses ───────────────────────────────────────────────────────────────

export async function getExpenses(): Promise<Expense[]> {
  const db = await getSQLiteDb();
  if (!db) return [];
  return await db.getAllAsync('SELECT * FROM expenses ORDER BY date DESC');
}

export async function saveExpense(expense: Expense): Promise<void> {
  const db = await getSQLiteDb();
  if (!db) return;
  await db.runAsync(
    `INSERT INTO expenses (id, category, amount, note, date) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET category=excluded.category, amount=excluded.amount, note=excluded.note, date=excluded.date`,
    [expense.id, expense.category, expense.amount, expense.note || '', expense.date]
  );
}

export async function deleteExpense(id: string): Promise<void> {
  const db = await getSQLiteDb();
  if (!db) return;
  await db.runAsync('DELETE FROM expenses WHERE id = ?', [id]);
}

// ─── Vendors ────────────────────────────────────────────────────────────────

export async function getVendors(): Promise<Vendor[]> {
  const db = await getSQLiteDb();
  if (!db) return [];
  return await db.getAllAsync('SELECT * FROM vendors');
}

export async function saveVendor(vendor: Vendor): Promise<void> {
  const db = await getSQLiteDb();
  if (!db) return;
  await db.runAsync(
    `INSERT INTO vendors (id, name, contact, email, address, taxId) 
     VALUES (?, ?, ?, ?, ?, ?) 
     ON CONFLICT(id) DO UPDATE SET 
     name=excluded.name, contact=excluded.contact, email=excluded.email, address=excluded.address, taxId=excluded.taxId`,
    [vendor.id, vendor.name, vendor.contact, vendor.email || '', vendor.address || '', vendor.taxId || '']
  );
}

export async function deleteVendor(id: string): Promise<void> {
  const db = await getSQLiteDb();
  if (!db) return;
  await db.runAsync('DELETE FROM vendors WHERE id = ?', [id]);
}

// ─── Products ───────────────────────────────────────────────────────────────

export async function getProducts(): Promise<Product[]> {
  const db = await getSQLiteDb();
  if (!db) return [];
  const rows: any[] = await db.getAllAsync('SELECT * FROM products');
  return rows.map((r) => ({
    ...r,
    archived: r.archived === 1,
    costPrice: r.costPrice || undefined,
    categoryId: r.categoryId || undefined,
    unit: r.unit || undefined,
  }));
}

export async function saveProduct(product: Product): Promise<void> {
  const db = await getSQLiteDb();
  if (!db) return;
  await db.runAsync(
    `INSERT INTO products (id, name, barcode, sku, category, categoryId, unit, price, costPrice, stockQty, reorderThreshold, vendorId, imageUri, archived, createdAt, updatedAt) 
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) 
     ON CONFLICT(id) DO UPDATE SET 
     name=excluded.name, barcode=excluded.barcode, sku=excluded.sku, category=excluded.category, categoryId=excluded.categoryId, unit=excluded.unit,
     price=excluded.price, costPrice=excluded.costPrice, stockQty=excluded.stockQty, reorderThreshold=excluded.reorderThreshold, 
     vendorId=excluded.vendorId, imageUri=excluded.imageUri, archived=excluded.archived, updatedAt=excluded.updatedAt`,
    [
      product.id, product.name, product.barcode, product.sku || '', product.category || '',
      product.categoryId || '', product.unit || '', product.price, product.costPrice ?? null,
      product.stockQty, product.reorderThreshold, product.vendorId || '',
      product.imageUri || '', product.archived ? 1 : 0, product.createdAt, product.updatedAt,
    ]
  );
}

export async function deleteProduct(id: string): Promise<void> {
  const db = await getSQLiteDb();
  if (!db) return;
  await db.runAsync('DELETE FROM products WHERE id = ?', [id]);
}

// ─── Bills ──────────────────────────────────────────────────────────────────

export async function getBills(): Promise<Bill[]> {
  const db = await getSQLiteDb();
  if (!db) return [];
  const bills: any[] = await db.getAllAsync('SELECT * FROM bills ORDER BY createdAt DESC');
  const allItems: any[] = await db.getAllAsync('SELECT * FROM bill_items');

  return bills.map((b) => {
    let discountObj = { type: 'flat' as const, value: 0 };
    try {
      if (b.discount) {
        if (typeof b.discount === 'number') {
          discountObj = { type: 'flat' as const, value: b.discount };
        } else {
          discountObj = JSON.parse(b.discount);
        }
      }
    } catch (e) {}

    return {
      id: b.id,
      type: b.type || 'product',
      subtotal: b.subtotal,
      gstMode: b.gstMode || 'exclusive',
      taxPercent: b.taxPercent,
      discount: discountObj,
      total: b.total,
      customerId: b.customerId || undefined,
      customerName: b.customerName || undefined,
      customerPhone: b.customerPhone || undefined,
      paymentMethod: b.paymentMethod || 'cash',
      amountReceived: b.amountReceived || undefined,
      customField: b.customField || undefined,
      notes: b.notes || undefined,
      printStatus: b.printStatus,
      createdAt: b.createdAt,
      items: allItems
        .filter((i) => i.billId === b.id)
      .map((i) => {
        // Fixed-price quick bill items
        if (i.tileId) {
          return { tileId: i.tileId, label: i.label, price: i.price };
        }
        // Product-based bill items
        return {
          productId: i.productId,
          name: i.name,
          categoryId: i.categoryId || undefined,
          unit: i.unit || undefined,
          qty: i.qty,
          unitPrice: i.unitPrice,
          costPrice: i.costPrice || undefined,
          lineTotal: i.lineTotal,
        };
      }) as BillItem[],
    };
  });
}

export async function saveBill(bill: Bill): Promise<void> {
  const db = await getSQLiteDb();
  if (!db) return;
  await db.runAsync(
    `INSERT INTO bills (id, type, subtotal, gstMode, taxPercent, discount, total, customerId, customerName, customerPhone, paymentMethod, amountReceived, customField, notes, printStatus, createdAt) 
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      bill.id, bill.type, bill.subtotal, bill.gstMode || 'exclusive', bill.taxPercent, JSON.stringify(bill.discount), bill.total,
      bill.customerId || '', bill.customerName || '', bill.customerPhone || '',
      bill.paymentMethod || 'cash', bill.amountReceived || null, bill.customField || '', bill.notes || '', bill.printStatus, bill.createdAt,
    ]
  );

  for (const item of bill.items) {
    if ('tileId' in item) {
      // QuickBillItem
      await db.runAsync(
        `INSERT INTO bill_items (billId, tileId, label, price) VALUES (?, ?, ?, ?)`,
        [bill.id, item.tileId, item.label, item.price]
      );
    } else {
      // BillItem
      await db.runAsync(
        `INSERT INTO bill_items (billId, productId, name, categoryId, unit, qty, unitPrice, costPrice, lineTotal) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [bill.id, item.productId, item.name, item.categoryId || null, item.unit || null, item.qty, item.unitPrice, item.costPrice ?? null, item.lineTotal]
      );
    }
  }
}

export async function updateBillPrintStatus(id: string, status: 'not_printed' | 'printed' | 'failed'): Promise<void> {
  const db = await getSQLiteDb();
  if (!db) return;
  await db.runAsync('UPDATE bills SET printStatus = ? WHERE id = ?', [status, id]);
}

// ─── Stock History ──────────────────────────────────────────────────────────

export async function getStockHistory(productId?: string): Promise<StockHistoryItem[]> {
  const db = await getSQLiteDb();
  if (!db) return [];
  if (productId) {
    return await db.getAllAsync('SELECT * FROM stock_history WHERE productId = ? ORDER BY date DESC', [productId]);
  }
  return await db.getAllAsync('SELECT * FROM stock_history ORDER BY date DESC');
}

export async function addStockHistory(item: StockHistoryItem): Promise<void> {
  const db = await getSQLiteDb();
  if (!db) return;
  await db.runAsync(
    `INSERT INTO stock_history (id, productId, type, qty, date, description, reasonCode) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [item.id, item.productId, item.type, item.qty, item.date, item.description, item.reasonCode || '']
  );
}
