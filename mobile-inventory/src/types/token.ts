export interface TokenType {
  id: string;
  name: string;
  price?: number | null;
  defaultPrice?: number;
  isVariablePrice?: boolean;
  taxRate?: number | null;
  color?: string | null;
  icon?: string | null;
  isActive: boolean;
}

export interface Token {
  id: string;
  dailyNumber: number;
  dailySequence?: number;
  saleId?: string | null;
  tokenTypeId?: string | null;
  tokenType?: TokenType | null;
  quantity?: number;
  price?: number;
  sale?: any;
  createdAt: string;
}

export interface CreateTokenPayload {
  tokenTypeId?: string;
  name?: string;
  amount: number;
  quantity?: number;
  paymentMethod: string;
  note?: string;
}
