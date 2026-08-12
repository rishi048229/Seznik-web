import type { AdminProductRedirect, RedirectClickEvent } from '../types/redirect';

const ADMIN_REDIRECTS_STORAGE_KEY = 'seznik_admin_redirects_telemetry_v1';

const generateClicks = (count: number, now: Date): RedirectClickEvent[] => {
  const clicks: RedirectClickEvent[] = [];
  const sources = ['Google Organic', 'Instagram Ads', 'Direct Website', 'Facebook', 'Email Newsletter', 'Affiliate Link'];
  const devices: ('Desktop' | 'Mobile' | 'Tablet')[] = ['Desktop', 'Mobile', 'Mobile', 'Desktop', 'Tablet'];
  const cities = ['Mumbai', 'Delhi', 'Bengaluru', 'Hyderabad', 'Chennai', 'Kolkata', 'Pune', 'Ahmedabad'];

  for (let i = 0; i < count; i++) {
    const hoursAgo = Math.floor(Math.random() * (30 * 24));
    const timestamp = new Date(now.getTime() - hoursAgo * 3600 * 1000).toISOString();
    clicks.push({
      id: `clk_adm_${i}_${Math.random().toString(36).substring(2, 7)}`,
      timestamp,
      source: sources[i % sources.length],
      device: devices[i % devices.length],
      city: cities[i % cities.length],
      ipAddress: `103.${Math.floor(Math.random() * 200)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`,
    });
  }

  return clicks.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
};

export const getInitialAdminRedirects = (): AdminProductRedirect[] => {
  const now = new Date();
  const domain = 'https://seznik.com';

  const defaultProducts = [
    { name: 'Classic Banarasi Silk Sari', sku: 'SAR-001', price: 4999, category: 'Apparel & Fashion' },
    { name: 'Leather Bifold Slim Wallet', sku: 'WAL-004', price: 1299, category: 'Fashion Accessories' },
    { name: 'Wireless Noise Cancelling Earbuds', sku: 'EAR-102', price: 2499, category: 'Electronics' },
    { name: 'Organic Assam Green Tea (250g)', sku: 'TEA-088', price: 450, category: 'Food & Beverage' },
    { name: 'Ergonomic Mesh Office Chair', sku: 'CHR-501', price: 8999, category: 'Office Furniture' },
    { name: 'Smart Fitness Tracker Band', sku: 'FT-900', price: 1999, category: 'Electronics' },
    { name: 'Stainless Steel Water Bottle (1L)', sku: 'BOT-330', price: 699, category: 'Home & Kitchen' },
    { name: 'Handcrafted Brass Puja Diya', sku: 'DIY-108', price: 850, category: 'Home Decor' },
  ];

  return defaultProducts.map((p, idx) => {
    const clickCount = Math.max(12, 140 - idx * 15);
    const clicks = generateClicks(clickCount, now);
    return {
      id: `red_adm_${idx + 1}`,
      productId: `prod_${idx + 1}`,
      productName: p.name,
      productSku: p.sku,
      sellingPrice: p.price,
      categoryName: p.category,
      targetUrl: `${domain}/products/${p.sku.toLowerCase()}`,
      clicks,
      totalRedirects: clicks.length,
      lastRedirectAt: clicks[0]?.timestamp,
      status: 'active',
      createdAt: new Date(now.getTime() - 40 * 24 * 3600 * 1000).toISOString(),
    };
  });
};

export const fetchAdminRedirects = (): AdminProductRedirect[] => {
  if (typeof localStorage === 'undefined') return getInitialAdminRedirects();

  const raw = localStorage.getItem(ADMIN_REDIRECTS_STORAGE_KEY);
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    } catch {
      // fallback
    }
  }

  const initial = getInitialAdminRedirects();
  localStorage.setItem(ADMIN_REDIRECTS_STORAGE_KEY, JSON.stringify(initial));
  return initial;
};

export const saveAdminRedirects = (data: AdminProductRedirect[]): void => {
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(ADMIN_REDIRECTS_STORAGE_KEY, JSON.stringify(data));
  }
};

export const simulateAdminRedirectClick = (
  redirectId: string,
  source: string = 'Direct Website'
): AdminProductRedirect[] => {
  const redirects = fetchAdminRedirects();
  const now = new Date().toISOString();

  const updated = redirects.map((r) => {
    if (r.id === redirectId) {
      const newClick: RedirectClickEvent = {
        id: `clk_sim_${Date.now()}`,
        timestamp: now,
        source,
        device: 'Desktop',
        city: 'Mumbai',
        ipAddress: '103.22.140.12',
      };
      const clicks = [newClick, ...r.clicks];
      return {
        ...r,
        clicks,
        totalRedirects: clicks.length,
        lastRedirectAt: now,
      };
    }
    return r;
  });

  saveAdminRedirects(updated);
  return updated;
};

export const updateAdminRedirectUrl = (
  redirectId: string,
  targetUrl: string
): AdminProductRedirect[] => {
  const redirects = fetchAdminRedirects();
  const updated = redirects.map((r) => (r.id === redirectId ? { ...r, targetUrl } : r));
  saveAdminRedirects(updated);
  return updated;
};

export const toggleAdminRedirectStatus = (redirectId: string): AdminProductRedirect[] => {
  const redirects = fetchAdminRedirects();
  const updated = redirects.map((r) => {
    if (r.id === redirectId) {
      const status: 'active' | 'paused' = r.status === 'active' ? 'paused' : 'active';
      return { ...r, status };
    }
    return r;
  });
  saveAdminRedirects(updated);
  return updated;
};

export const addAdminProductRedirect = (
  productName: string,
  sku: string,
  price: number,
  category: string,
  customUrl?: string
): AdminProductRedirect[] => {
  const redirects = fetchAdminRedirects();
  const domain = 'https://seznik.com';
  const newRedirect: AdminProductRedirect = {
    id: `red_adm_custom_${Date.now()}`,
    productId: `prod_custom_${Date.now()}`,
    productName,
    productSku: sku,
    sellingPrice: price,
    categoryName: category,
    targetUrl: customUrl || `${domain}/products/${sku.toLowerCase()}`,
    clicks: [],
    totalRedirects: 0,
    status: 'active',
    createdAt: new Date().toISOString(),
  };

  const updated = [newRedirect, ...redirects];
  saveAdminRedirects(updated);
  return updated;
};
