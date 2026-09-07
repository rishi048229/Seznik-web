import type { ComponentType } from 'react';
import { Home, Users, Truck, Coffee, Wrench, Megaphone, MoreHorizontal, Package, Boxes, Building2, ShoppingBag } from 'lucide-react-native';

export interface ExpenseCategoryDef {
  id: string;
  /** Also the exact string stored on Expense.category — kept human-readable since the backend
   * column is a free-text string, not an enum. */
  label: string;
  icon: ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
  color: string;
  isPurchase?: boolean;
}

/** Single source of truth for expense and purchase categories */
export const EXPENSE_CATEGORIES: ExpenseCategoryDef[] = [
  { id: 'stock_purchase', label: 'Stock & Inventory Purchase', icon: ShoppingBag, color: '#10B981', isPurchase: true },
  { id: 'raw_materials', label: 'Raw Materials & Supplies', icon: Boxes, color: '#06B6D4', isPurchase: true },
  { id: 'supplier_payment', label: 'Supplier / Vendor Payment', icon: Building2, color: '#6366F1', isPurchase: true },
  { id: 'packaging', label: 'Packaging & Bags', icon: Package, color: '#D97706', isPurchase: true },
  { id: 'rent', label: 'Rent & Utilities', icon: Home, color: '#2563EB' },
  { id: 'salaries', label: 'Salaries & Staff', icon: Users, color: '#F59E0B' },
  { id: 'transport', label: 'Transport & Freight', icon: Truck, color: '#14B8A6' },
  { id: 'refreshments', label: 'Tea & Refreshments', icon: Coffee, color: '#A16207' },
  { id: 'maintenance', label: 'Maintenance & Repairs', icon: Wrench, color: '#EF4444' },
  { id: 'marketing', label: 'Marketing & Ads', icon: Megaphone, color: '#8B5CF6' },
  { id: 'misc', label: 'Miscellaneous', icon: MoreHorizontal, color: '#64748B' },
];

const FALLBACK_CATEGORY: ExpenseCategoryDef = {
  id: 'other',
  label: 'Other',
  icon: MoreHorizontal,
  color: '#64748B',
};

/** Looks up a category def by its stored label — falls back to a generic "Other" definition
 * for any legacy/unrecognized category string already sitting in the database. */
export function getCategoryDef(label: string | undefined | null): ExpenseCategoryDef {
  return EXPENSE_CATEGORIES.find((c) => c.label === label) || { ...FALLBACK_CATEGORY, label: label || 'Other' };
}
