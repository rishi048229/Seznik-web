import { fetchApi } from './api'

export interface QrLoginSession {
  sessionId: string
  qrPayload: string
  expiresAt: string
  expiresInSeconds: number
}

export type QrLoginStatus = 'pending' | 'consumed' | 'expired'

export const generateQrLoginSession = async (): Promise<QrLoginSession> => {
  return fetchApi('/auth/qr-login/session', { method: 'POST' })
}

export const getQrLoginStatus = async (sessionId: string): Promise<{ status: QrLoginStatus }> => {
  return fetchApi(`/auth/qr-login/session/${sessionId}`)
}
