import { z } from 'zod'

export const productSchema = z.object({
  name: z.string().min(1, 'Product name is required'),
  barcode: z.string().optional(),
  categoryId: z.string().min(1, 'Category is required'),
  supplierId: z.string().optional(),
  costPrice: z.coerce.number().min(0, 'Cost price must be >= 0'),
  sellingPrice: z.coerce.number().min(0, 'Selling price must be >= 0'),
  taxRate: z.coerce.number().min(0).max(100).default(0),
  currentStock: z.coerce.number().min(0, 'Stock must be >= 0'),
  lowStockThreshold: z.coerce.number().min(0).default(10),
  unit: z.enum(['piece', 'kg', 'gram', 'liter', 'meter', 'dozen', 'box']).default('piece'),
})

export const categorySchema = z.object({
  name: z.string().min(1, 'Category name is required'),
})

export const customerSchema = z.object({
  name: z.string().min(1, 'Customer name is required'),
  phone: z.string().min(10, 'Valid phone number is required'),
  email: z.string().email().optional().or(z.literal('')),
  address: z.string().optional(),
  creditLimit: z.coerce.number().min(0).default(0),
})

export const expenseSchema = z.object({
  category: z.enum(['rent', 'utilities', 'salaries', 'inventory', 'marketing', 'maintenance', 'other']),
  amount: z.coerce.number().min(0.01, 'Amount must be > 0'),
  description: z.string().min(1, 'Description is required'),
  paymentMethod: z.enum(['cash', 'bank', 'upi', 'card']),
})

export type ProductFormData = z.infer<typeof productSchema>
export type CategoryFormData = z.infer<typeof categorySchema>
export type CustomerFormData = z.infer<typeof customerSchema>
export type ExpenseFormData = z.infer<typeof expenseSchema>
