import { Product, Vendor, Bill, StockHistoryItem, ShopProfile, BusinessMode, RateTile, Customer, Expense, Category } from '../types';

// Web LocalStorage cache
const webStorage = {
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
  if (!webStorage.get('products')) webStorage.set('products', []);
  if (!webStorage.get('vendors')) webStorage.set('vendors', []);
  if (!webStorage.get('bills')) webStorage.set('bills', []);
  if (!webStorage.get('bill_items')) webStorage.set('bill_items', []);
  if (!webStorage.get('stock_history')) webStorage.set('stock_history', []);
  if (!webStorage.get('rate_tiles')) webStorage.set('rate_tiles', []);
  if (!webStorage.get('customers')) webStorage.set('customers', []);
  if (!webStorage.get('expenses')) webStorage.set('expenses', []);
  if (!webStorage.get('categories')) webStorage.set('categories', []);
  if (!webStorage.get('shop_profile')) {
    webStorage.set('shop_profile', {
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
  return webStorage.get('business_mode') || 'product';
}

export async function saveBusinessMode(mode: BusinessMode): Promise<void> {
  webStorage.set('business_mode', mode);
}

export async function getOnboarded(): Promise<boolean> {
  return webStorage.get('onboarded') === true;
}

export async function saveOnboarded(val: boolean): Promise<void> {
  webStorage.set('onboarded', val);
}

// ─── Shop Profile ───────────────────────────────────────────────────────────

export async function getShopProfile(): Promise<ShopProfile> {
  return webStorage.get('shop_profile') || { name: '' };
}

export async function saveShopProfile(profile: ShopProfile): Promise<void> {
  webStorage.set('shop_profile', profile);
}

// ─── Rate Tiles ─────────────────────────────────────────────────────────────

export async function getRateTiles(): Promise<RateTile[]> {
  return webStorage.get('rate_tiles') || [];
}

export async function saveRateTile(tile: RateTile): Promise<void> {
  const list = await getRateTiles();
  const idx = list.findIndex((t) => t.id === tile.id);
  if (idx >= 0) list[idx] = tile;
  else list.push(tile);
  webStorage.set('rate_tiles', list);
}

export async function deleteRateTile(id: string): Promise<void> {
  const list = await getRateTiles();
  webStorage.set('rate_tiles', list.filter((t) => t.id !== id));
}

export async function saveAllRateTiles(tiles: RateTile[]): Promise<void> {
  webStorage.set('rate_tiles', tiles);
}

// ─── Categories ─────────────────────────────────────────────────────────────

export async function getCategories(): Promise<Category[]> {
  return webStorage.get('categories') || [];
}

export async function saveCategory(category: Category): Promise<void> {
  const list = await getCategories();
  const idx = list.findIndex((c) => c.id === category.id);
  if (idx >= 0) list[idx] = category;
  else list.push(category);
  webStorage.set('categories', list);
}

export async function deleteCategory(id: string): Promise<void> {
  const list = await getCategories();
  webStorage.set('categories', list.filter((c) => c.id !== id));
}

export async function saveAllCategories(categories: Category[]): Promise<void> {
  webStorage.set('categories', categories);
}

// ─── Customers ──────────────────────────────────────────────────────────────

export async function getCustomers(): Promise<Customer[]> {
  return webStorage.get('customers') || [];
}

export async function saveCustomer(customer: Customer): Promise<void> {
  const list = await getCustomers();
  const idx = list.findIndex((c) => c.id === customer.id);
  if (idx >= 0) list[idx] = customer;
  else list.push(customer);
  webStorage.set('customers', list);
}

export async function deleteCustomer(id: string): Promise<void> {
  const list = await getCustomers();
  webStorage.set('customers', list.filter((c) => c.id !== id));
}

// ─── Expenses ───────────────────────────────────────────────────────────────

export async function getExpenses(): Promise<Expense[]> {
  return webStorage.get('expenses') || [];
}

export async function saveExpense(expense: Expense): Promise<void> {
  const list = await getExpenses();
  const idx = list.findIndex((e) => e.id === expense.id);
  if (idx >= 0) list[idx] = expense;
  else list.push(expense);
  webStorage.set('expenses', list);
}

export async function deleteExpense(id: string): Promise<void> {
  const list = await getExpenses();
  webStorage.set('expenses', list.filter((e) => e.id !== id));
}

// ─── Vendors ────────────────────────────────────────────────────────────────

export async function getVendors(): Promise<Vendor[]> {
  return webStorage.get('vendors') || [];
}

export async function saveVendor(vendor: Vendor): Promise<void> {
  const list = await getVendors();
  const idx = list.findIndex((v) => v.id === vendor.id);
  if (idx >= 0) list[idx] = vendor;
  else list.push(vendor);
  webStorage.set('vendors', list);
}

export async function deleteVendor(id: string): Promise<void> {
  const list = await getVendors();
  webStorage.set('vendors', list.filter((v) => v.id !== id));
}

// ─── Products ───────────────────────────────────────────────────────────────

export async function getProducts(): Promise<Product[]> {
  return webStorage.get('products') || [];
}

export async function saveProduct(product: Product): Promise<void> {
  const list = await getProducts();
  const idx = list.findIndex((p) => p.id === product.id);
  if (idx >= 0) list[idx] = product;
  else list.push(product);
  webStorage.set('products', list);
}

export async function deleteProduct(id: string): Promise<void> {
  const list = await getProducts();
  webStorage.set('products', list.filter((p) => p.id !== id));
}

// ─── Bills ──────────────────────────────────────────────────────────────────

export async function getBills(): Promise<Bill[]> {
  const bills: any[] = webStorage.get('bills') || [];
  const items: any[] = webStorage.get('bill_items') || [];
  return bills.map((b) => ({
    ...b,
    items: items.filter((i) => i.billId === b.id),
  }));
}

export async function saveBill(bill: Bill): Promise<void> {
  const bills = webStorage.get('bills') || [];
  const items = webStorage.get('bill_items') || [];

  bills.push({
    id: bill.id,
    type: bill.type,
    subtotal: bill.subtotal,
    taxPercent: bill.taxPercent,
    discount: bill.discount,
    total: bill.total,
    customerId: bill.customerId,
    customerName: bill.customerName,
    customerPhone: bill.customerPhone,
    paymentMethod: bill.paymentMethod,
    customField: bill.customField,
    printStatus: bill.printStatus,
    createdAt: bill.createdAt,
  });

  bill.items.forEach((i: any) => {
    items.push({ billId: bill.id, ...i });
  });

  webStorage.set('bills', bills);
  webStorage.set('bill_items', items);
}

export async function updateBillPrintStatus(id: string, status: 'not_printed' | 'printed' | 'failed'): Promise<void> {
  const bills: any[] = webStorage.get('bills') || [];
  const idx = bills.findIndex((b) => b.id === id);
  if (idx >= 0) {
    bills[idx].printStatus = status;
    webStorage.set('bills', bills);
  }
}

// ─── Stock History ──────────────────────────────────────────────────────────

export async function getStockHistory(productId?: string): Promise<StockHistoryItem[]> {
  const list: StockHistoryItem[] = webStorage.get('stock_history') || [];
  if (productId) return list.filter((h) => h.productId === productId);
  return list;
}

export async function addStockHistory(item: StockHistoryItem): Promise<void> {
  const list = webStorage.get('stock_history') || [];
  list.unshift(item);
  webStorage.set('stock_history', list);
}
