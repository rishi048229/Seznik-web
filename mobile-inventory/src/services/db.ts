import { Product, Vendor, Bill, BillItem, StockHistoryItem, ShopProfile, BusinessMode, RateTile, Customer, Expense, Category } from '../types';

// Fallback in-memory / localStorage cache
const fallbackStorage = {
  get: (key: string) => {
    if (typeof window === 'undefined') return null;
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : null;
  },
  set: (key: string, val: any) => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(key, JSON.stringify(val));
  },
};

export async function initDatabase() {
  if (!fallbackStorage.get('products')) fallbackStorage.set('products', []);
  if (!fallbackStorage.get('vendors')) fallbackStorage.set('vendors', []);
  if (!fallbackStorage.get('bills')) fallbackStorage.set('bills', []);
  if (!fallbackStorage.get('bill_items')) fallbackStorage.set('bill_items', []);
  if (!fallbackStorage.get('stock_history')) fallbackStorage.set('stock_history', []);
  if (!fallbackStorage.get('rate_tiles')) fallbackStorage.set('rate_tiles', []);
  if (!fallbackStorage.get('customers')) fallbackStorage.set('customers', []);
  if (!fallbackStorage.get('expenses')) fallbackStorage.set('expenses', []);
  if (!fallbackStorage.get('categories')) fallbackStorage.set('categories', []);
  if (!fallbackStorage.get('shop_profile')) {
    fallbackStorage.set('shop_profile', {
      name: '',
      logoUri: '',
      address: '',
      phone: '',
      taxId: '',
    });
  }
}

// ─── Business Mode & Onboarding ─────────────────────────────────────────────

export async function getBusinessMode(): Promise<BusinessMode> {
  return fallbackStorage.get('business_mode') || 'product';
}

export async function saveBusinessMode(mode: BusinessMode): Promise<void> {
  fallbackStorage.set('business_mode', mode);
}

export async function getOnboarded(): Promise<boolean> {
  return fallbackStorage.get('onboarded') === true;
}

export async function saveOnboarded(val: boolean): Promise<void> {
  fallbackStorage.set('onboarded', val);
}

// ─── Shop Profile ───────────────────────────────────────────────────────────

export async function getShopProfile(): Promise<ShopProfile> {
  return fallbackStorage.get('shop_profile') || { name: '' };
}

export async function saveShopProfile(profile: ShopProfile): Promise<void> {
  fallbackStorage.set('shop_profile', profile);
}

// ─── Rate Tiles ─────────────────────────────────────────────────────────────

export async function getRateTiles(): Promise<RateTile[]> {
  return fallbackStorage.get('rate_tiles') || [];
}

export async function saveRateTile(tile: RateTile): Promise<void> {
  const list = await getRateTiles();
  const idx = list.findIndex((t) => t.id === tile.id);
  if (idx >= 0) list[idx] = tile;
  else list.push(tile);
  fallbackStorage.set('rate_tiles', list);
}

export async function deleteRateTile(id: string): Promise<void> {
  const list = await getRateTiles();
  fallbackStorage.set('rate_tiles', list.filter((t) => t.id !== id));
}

export async function saveAllRateTiles(tiles: RateTile[]): Promise<void> {
  fallbackStorage.set('rate_tiles', tiles);
}

// ─── Categories ─────────────────────────────────────────────────────────────

export async function getCategories(): Promise<Category[]> {
  return fallbackStorage.get('categories') || [];
}

export async function saveCategory(category: Category): Promise<void> {
  const list = await getCategories();
  const idx = list.findIndex((c) => c.id === category.id);
  if (idx >= 0) list[idx] = category;
  else list.push(category);
  fallbackStorage.set('categories', list);
}

export async function deleteCategory(id: string): Promise<void> {
  const list = await getCategories();
  fallbackStorage.set('categories', list.filter((c) => c.id !== id));
}

export async function saveAllCategories(categories: Category[]): Promise<void> {
  fallbackStorage.set('categories', categories);
}

// ─── Customers ──────────────────────────────────────────────────────────────

export async function getCustomers(): Promise<Customer[]> {
  return fallbackStorage.get('customers') || [];
}

export async function saveCustomer(customer: Customer): Promise<void> {
  const list = await getCustomers();
  const idx = list.findIndex((c) => c.id === customer.id);
  if (idx >= 0) list[idx] = customer;
  else list.push(customer);
  fallbackStorage.set('customers', list);
}

export async function deleteCustomer(id: string): Promise<void> {
  const list = await getCustomers();
  fallbackStorage.set('customers', list.filter((c) => c.id !== id));
}

// ─── Expenses ───────────────────────────────────────────────────────────────

export async function getExpenses(): Promise<Expense[]> {
  return fallbackStorage.get('expenses') || [];
}

export async function saveExpense(expense: Expense): Promise<void> {
  const list = await getExpenses();
  const idx = list.findIndex((e) => e.id === expense.id);
  if (idx >= 0) list[idx] = expense;
  else list.push(expense);
  fallbackStorage.set('expenses', list);
}

export async function deleteExpense(id: string): Promise<void> {
  const list = await getExpenses();
  fallbackStorage.set('expenses', list.filter((e) => e.id !== id));
}

// ─── Vendors ────────────────────────────────────────────────────────────────

export async function getVendors(): Promise<Vendor[]> {
  return fallbackStorage.get('vendors') || [];
}

export async function saveVendor(vendor: Vendor): Promise<void> {
  const list = await getVendors();
  const idx = list.findIndex((v) => v.id === vendor.id);
  if (idx >= 0) list[idx] = vendor;
  else list.push(vendor);
  fallbackStorage.set('vendors', list);
}

export async function deleteVendor(id: string): Promise<void> {
  const list = await getVendors();
  fallbackStorage.set('vendors', list.filter((v) => v.id !== id));
}

// ─── Products ───────────────────────────────────────────────────────────────

export async function getProducts(): Promise<Product[]> {
  return fallbackStorage.get('products') || [];
}

export async function saveProduct(product: Product): Promise<void> {
  const list = await getProducts();
  const idx = list.findIndex((p) => p.id === product.id);
  if (idx >= 0) list[idx] = product;
  else list.push(product);
  fallbackStorage.set('products', list);
}

export async function deleteProduct(id: string): Promise<void> {
  const list = await getProducts();
  fallbackStorage.set('products', list.filter((p) => p.id !== id));
}

// ─── Bills ──────────────────────────────────────────────────────────────────

export async function getBills(): Promise<Bill[]> {
  const bills: any[] = fallbackStorage.get('bills') || [];
  const items: any[] = fallbackStorage.get('bill_items') || [];
  return bills.map((b) => {
    // Backward compatibility for discount
    const discountObj = typeof b.discount === 'number' 
      ? { type: 'flat' as const, value: b.discount }
      : (b.discount || { type: 'flat' as const, value: 0 });

    return {
      ...b,
      discount: discountObj,
      items: items.filter((i) => i.billId === b.id),
    };
  });
}

export async function saveBill(bill: Bill): Promise<void> {
  const bills = fallbackStorage.get('bills') || [];
  const items = fallbackStorage.get('bill_items') || [];

  bills.push({
    id: bill.id,
    type: bill.type,
    subtotal: bill.subtotal,
    gstMode: bill.gstMode,
    taxPercent: bill.taxPercent,
    discount: bill.discount,
    total: bill.total,
    customerId: bill.customerId,
    customerName: bill.customerName,
    customerPhone: bill.customerPhone,
    paymentMethod: bill.paymentMethod,
    amountReceived: bill.amountReceived,
    customField: bill.customField,
    notes: bill.notes,
    printStatus: bill.printStatus,
    createdAt: bill.createdAt,
  });

  bill.items.forEach((i: any) => {
    items.push({
      billId: bill.id,
      ...i,
    });
  });

  fallbackStorage.set('bills', bills);
  fallbackStorage.set('bill_items', items);
}

export async function updateBillPrintStatus(id: string, status: 'not_printed' | 'printed' | 'failed'): Promise<void> {
  const bills: any[] = fallbackStorage.get('bills') || [];
  const idx = bills.findIndex((b) => b.id === id);
  if (idx >= 0) {
    bills[idx].printStatus = status;
    fallbackStorage.set('bills', bills);
  }
}

// ─── Stock History ──────────────────────────────────────────────────────────

export async function getStockHistory(productId?: string): Promise<StockHistoryItem[]> {
  const list: StockHistoryItem[] = fallbackStorage.get('stock_history') || [];
  if (productId) return list.filter((h) => h.productId === productId);
  return list;
}

export async function addStockHistory(item: StockHistoryItem): Promise<void> {
  const list = fallbackStorage.get('stock_history') || [];
  list.unshift(item);
  fallbackStorage.set('stock_history', list);
}
