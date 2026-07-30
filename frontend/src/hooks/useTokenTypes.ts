import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/contexts/AuthContext'
import { QUERY_KEYS } from '@/constants/queryKeys'
import * as tokenTypeService from '@/services/tokenTypeService'

export const useTokenTypes = () => {
  const { user } = useAuth()
  return useQuery({
    queryKey: [QUERY_KEYS.TOKEN_TYPES, user?.uid],
    queryFn: () => tokenTypeService.getTokenTypes(),
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  })
}

export const useCreateTokenType = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: tokenTypeService.createTokenType,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QUERY_KEYS.TOKEN_TYPES] })
    },
  })
}

export const useUpdateTokenType = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ tokenTypeId, data }: { tokenTypeId: string; data: Parameters<typeof tokenTypeService.updateTokenType>[1] }) =>
      tokenTypeService.updateTokenType(tokenTypeId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QUERY_KEYS.TOKEN_TYPES] })
    },
  })
}

export const useDeleteTokenType = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (tokenTypeId: string) => tokenTypeService.deleteTokenType(tokenTypeId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QUERY_KEYS.TOKEN_TYPES] })
    },
  })
}
