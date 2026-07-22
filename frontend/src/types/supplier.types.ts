export interface Supplier {
  id: string
  name: string
  contactPerson?: string | null
  email?: string | null
  phone?: string | null
  address?: string | null
  gstin?: string | null
  createdAt?: string | Date
}
