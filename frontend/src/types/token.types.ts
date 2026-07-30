import type { Sale } from './sale.types'

export interface TokenType {
  id: string
  name: string
  /** null = variable amount, entered at issue time (e.g. parking, QR bill). */
  price: number | null
  taxRate: number
  /** Key into the frontend TOKEN_ICONS palette (see QuickTokensPage.tsx). */
  icon: string
  /** Key into the frontend TOKEN_COLORS palette. */
  color: string
  sortOrder: number
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface Token {
  id: string
  tokenNumber: number
  note?: string | null
  tokenTypeId?: string | null
  tokenType?: TokenType | null
  saleId: string
  sale?: Sale
  createdAt: Date | string
}

export interface IssueTokenPayload {
  tokenTypeId?: string
  name?: string
  amount: number
  quantity?: number
  paymentMethod: 'cash' | 'card' | 'upi'
  note?: string
}
