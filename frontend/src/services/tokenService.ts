import { fetchApi } from './api'
import type { Token, IssueTokenPayload } from '@/types/token.types'

export const getTokens = async (date?: string): Promise<Token[]> => {
  const query = date ? `?date=${encodeURIComponent(date)}` : ''
  return await fetchApi(`/tokens${query}`)
}

export const createToken = async (data: IssueTokenPayload): Promise<Token> => {
  return await fetchApi('/tokens', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export const deleteToken = async (tokenId: string): Promise<void> => {
  await fetchApi(`/tokens/${tokenId}`, {
    method: 'DELETE',
  })
}
