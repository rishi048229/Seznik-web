import type { ComponentType } from 'react';
import { Home, Users, Truck, Coffee, Wrench, Megaphone, MoreHorizontal } from 'lucide-react-native';

export interface ExpenseCategoryDef {
  id: string;
  /** Also the exact string stored on Expense.category — kept human-readable since the backend
   * column is a free-text string, not an enum. */
  label: string;
  icon: ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
  color: string;
}

/** Single source of truth for expense categories — used by the picker chips, the breakdown
 * bars, and category icons throughout the Expense Tracker, replacing the old hardcoded array
 * that didn't match the (now-removed) unused ExpenseCategory type. */
export const EXPENSE_CATEGORIES: ExpenseCategoryDef[] = [
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
