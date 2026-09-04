export interface ApiFeatureDef {
  id: string;
  sectionName: string;
  routePrefix: string;
  path: string;
  iconName: string;
}

/** Stable catalog of trackable API feature groups (prefix → admin analytics row). */
export const API_FEATURE_CATALOG: readonly ApiFeatureDef[] = [
  {
    id: 'auth',
    sectionName: 'Auth & Onboarding',
    routePrefix: '/api/auth',
    path: '/onboarding',
    iconName: 'ShieldCheck',
  },
  {
    id: 'products',
    sectionName: 'Products & Inventory',
    routePrefix: '/api/products',
    path: '/products',
    iconName: 'Package',
  },
  {
    id: 'categories',
    sectionName: 'Categories & Tax',
    routePrefix: '/api/categories',
    path: '/categories',
    iconName: 'Layers',
  },
  {
    id: 'sales',
    sectionName: 'POS Billing & Invoices',
    routePrefix: '/api/sales',
    path: '/pos-lite',
    iconName: 'ShoppingBag',
  },
  {
    id: 'customers',
    sectionName: 'Customer CRM',
    routePrefix: '/api/customers',
    path: '/customers',
    iconName: 'Users',
  },
  {
    id: 'credits',
    sectionName: 'Credit Ledger',
    routePrefix: '/api/credits',
    path: '/credits',
    iconName: 'CreditCard',
  },
  {
    id: 'purchases',
    sectionName: 'Purchases & Stock In',
    routePrefix: '/api/purchases',
    path: '/purchases',
    iconName: 'Truck',
  },
  {
    id: 'suppliers',
    sectionName: 'Suppliers',
    routePrefix: '/api/suppliers',
    path: '/suppliers',
    iconName: 'Building',
  },
  {
    id: 'expenses',
    sectionName: 'Expenses',
    routePrefix: '/api/expenses',
    path: '/expenses',
    iconName: 'Receipt',
  },
  {
    id: 'reports',
    sectionName: 'Sales & Tax Reports',
    routePrefix: '/api/reports',
    path: '/reports',
    iconName: 'BarChart3',
  },
  {
    id: 'tokens',
    sectionName: 'Counter Tokens',
    routePrefix: '/api/tokens',
    path: '/tokens',
    iconName: 'Ticket',
  },
  {
    id: 'token-types',
    sectionName: 'Token Types',
    routePrefix: '/api/token-types',
    path: '/tokens',
    iconName: 'Tags',
  },
  {
    id: 'settings',
    sectionName: 'Store Settings',
    routePrefix: '/api/settings',
    path: '/settings',
    iconName: 'Settings',
  },
  {
    id: 'feedback',
    sectionName: 'In-app Feedback',
    routePrefix: '/api/feedback',
    path: '/feedback',
    iconName: 'MessageSquare',
  },
  {
    id: 'restaurant-tables',
    sectionName: 'Table Floor Plan',
    routePrefix: '/api/restaurant-tables',
    path: '/tables',
    iconName: 'LayoutGrid',
  },
  {
    id: 'kot-orders',
    sectionName: 'Kitchen Order Tickets',
    routePrefix: '/api/kot-orders',
    path: '/kot',
    iconName: 'ChefHat',
  },
  {
    id: 'locations',
    sectionName: 'Multi-store Locations',
    routePrefix: '/api/locations',
    path: '/stores',
    iconName: 'Store',
  },
  {
    id: 'notifications',
    sectionName: 'Push Notifications',
    routePrefix: '/api/notifications',
    path: '/settings',
    iconName: 'Bell',
  },
  {
    id: 'public-receipts',
    sectionName: 'Public Invoice Links',
    routePrefix: '/api/public/receipt',
    path: '/invoice',
    iconName: 'FileText',
  },
] as const;

/** Longest-prefix match so /api/token-types wins over /api/tokens when ordered carefully. */
const SORTED_BY_PREFIX_LENGTH = [...API_FEATURE_CATALOG].sort(
  (a, b) => b.routePrefix.length - a.routePrefix.length
);

const SKIP_PATH_PREFIXES = ['/health', '/api/health'];

export function shouldSkipApiUsageTracking(pathname: string): boolean {
  const path = pathname.split('?')[0] || '';
  return SKIP_PATH_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`));
}

export function resolveApiFeature(pathname: string): ApiFeatureDef | null {
  const path = pathname.split('?')[0] || '';

  // Public HTML receipt views share the same feature bucket as the JSON API.
  if (path.startsWith('/receipt/') || path.startsWith('/bill/')) {
    return API_FEATURE_CATALOG.find((f) => f.id === 'public-receipts') ?? null;
  }

  for (const feature of SORTED_BY_PREFIX_LENGTH) {
    if (path === feature.routePrefix || path.startsWith(`${feature.routePrefix}/`)) {
      return feature;
    }
  }
  return null;
}
