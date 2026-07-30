import { fetchApi } from './api'
import type { TokenType } from '@/types/token.types'

export const getTokenTypes = async (): Promise<TokenType[]> => {
  return await fetchApi('/token-types')
}

export const createTokenType = async (
  data: { name: string; price: number | null; taxRate?: number; icon?: string; color?: string; sortOrder?: number }
): Promise<TokenType> => {
  return await fetchApi('/token-types', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export const updateTokenType = async (
  tokenTypeId: string,
  data: Partial<{ name: string; price: number | null; taxRate: number; icon: string; color: string; sortOrder: number; isActive: boolean }>
): Promise<void> => {
  await fetchApi(`/token-types/${tokenTypeId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  })
}

export const deleteTokenType = async (tokenTypeId: string): Promise<void> => {
  await fetchApi(`/token-types/${tokenTypeId}`, {
    method: 'DELETE',
  })
}
