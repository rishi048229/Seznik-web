import { useCallback, useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { QUERY_KEYS } from '@/constants/queryKeys'
import { generateQrLoginSession, getQrLoginStatus } from '@/services/qrLoginService'

const remainingMs = (expiresAt: string | undefined) => {
  if (!expiresAt) return 0
  return Math.max(0, new Date(expiresAt).getTime() - Date.now())
}

export const useQrLogin = () => {
  const queryClient = useQueryClient()
  const [now, setNow] = useState(() => Date.now())

  const sessionQuery = useQuery({
    queryKey: [QUERY_KEYS.QR_LOGIN, 'session'],
    queryFn: generateQrLoginSession,
    staleTime: Infinity,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: 1,
  })

  const sessionId = sessionQuery.data?.sessionId
  const statusQuery = useQuery({
    queryKey: [QUERY_KEYS.QR_LOGIN, 'status', sessionId],
    queryFn: () => getQrLoginStatus(sessionId!),
    enabled: !!sessionId,
    refetchInterval: query => (query.state.data?.status === 'pending' ? 2000 : false),
    refetchOnWindowFocus: false,
    retry: 1,
  })

  const status = statusQuery.data?.status ?? 'pending'
  const msLeft = remainingMs(sessionQuery.data?.expiresAt)

  useEffect(() => {
    if (status !== 'pending' || !sessionQuery.data?.expiresAt) return
    const id = window.setInterval(() => setNow(Date.now()), 250)
    return () => window.clearInterval(id)
  }, [status, sessionQuery.data?.expiresAt])

  const regenerate = useCallback(async () => {
    await queryClient.resetQueries({ queryKey: [QUERY_KEYS.QR_LOGIN] })
  }, [queryClient])

  useEffect(() => {
    if (!sessionQuery.data || status !== 'pending' || sessionQuery.isFetching) return
    if (msLeft > 0) return
    void regenerate()
  }, [msLeft, regenerate, sessionQuery.data, sessionQuery.isFetching, status, now])

  return {
    session: sessionQuery.data,
    isLoading: sessionQuery.isLoading,
    isError: sessionQuery.isError,
    error: sessionQuery.error,
    status,
    secondsLeft: Math.ceil(msLeft / 1000),
    regenerate,
    isRegenerating: sessionQuery.isFetching,
  }
}
