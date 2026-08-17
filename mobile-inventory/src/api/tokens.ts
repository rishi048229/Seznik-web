import { fetchApi } from './client';
import { CreateTokenPayload, Token, TokenType } from '@/types/token';

export const tokensApi = {
  getTokenTypes: async (): Promise<TokenType[]> => {
    return fetchApi<TokenType[]>('/token-types');
  },

  createTokenType: async (payload: { name: string; price?: number; taxRate?: number; color?: string }): Promise<TokenType> => {
    return fetchApi<TokenType>('/token-types', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  updateTokenType: async (id: string, payload: { name?: string; price?: number; taxRate?: number; color?: string; isActive?: boolean }): Promise<TokenType> => {
    return fetchApi<TokenType>(`/token-types/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  },

  deleteTokenType: async (id: string): Promise<{ success: boolean }> => {
    return fetchApi<{ success: boolean }>(`/token-types/${id}`, {
      method: 'DELETE',
    });
  },

  getTokens: async (date?: string): Promise<Token[]> => {
    const params = date ? `?date=${encodeURIComponent(date)}` : '';
    return fetchApi<Token[]>(`/tokens${params}`);
  },

  createToken: async (payload: CreateTokenPayload): Promise<Token> => {
    return fetchApi<Token>('/tokens', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  deleteToken: async (id: string): Promise<{ success: boolean }> => {
    return fetchApi<{ success: boolean }>(`/tokens/${id}`, {
      method: 'DELETE',
    });
  },
};
