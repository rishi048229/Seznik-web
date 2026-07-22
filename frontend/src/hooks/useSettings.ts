import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/contexts/AuthContext'
import { QUERY_KEYS } from '@/constants/queryKeys'
import * as settingsService from '@/services/settingsService'

export const useSettings = () => {
  const { user } = useAuth()
  const uid = user?.id || user?.uid
  return useQuery({
    queryKey: [QUERY_KEYS.SETTINGS, uid],
    queryFn: () => settingsService.getSettings(uid || ''),
    enabled: !!user,
  })
}

export const useCreateSettings = () => {
  const { user } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Parameters<typeof settingsService.createSettings>[1]) =>
      settingsService.createSettings(user?.id || user?.uid || '', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QUERY_KEYS.SETTINGS] })
    },
  })
}

export const useUpdateSettings = () => {
  const { user } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ settingsId, data }: { settingsId: string; data: Record<string, unknown> }) =>
      settingsService.updateSettings(user?.id || user?.uid || '', settingsId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QUERY_KEYS.SETTINGS] })
    },
  })
}
