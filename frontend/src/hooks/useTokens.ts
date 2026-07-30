import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/contexts/AuthContext'
import { QUERY_KEYS } from '@/constants/queryKeys'
import * as tokenService from '@/services/tokenService'

export const useTokens = (date?: string) => {
  const { user } = useAuth()
  return useQuery({
    queryKey: [QUERY_KEYS.TOKENS, user?.uid, date],
    queryFn: () => tokenService.getTokens(date),
    enabled: !!user,
    staleTime: 0,
  })
}

export const useIssueToken = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: tokenService.createToken,
    onSuccess: async () => {
      await Promise.all([
        qc.refetchQueries({ queryKey: [QUERY_KEYS.TOKENS] }),
        qc.refetchQueries({ queryKey: [QUERY_KEYS.SALES] }),
        qc.refetchQueries({ queryKey: [QUERY_KEYS.PRODUCTS] }),
      ])
    },
  })
}

export const useDeleteToken = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (tokenId: string) => tokenService.deleteToken(tokenId),
    onSuccess: async () => {
      await Promise.all([
        qc.refetchQueries({ queryKey: [QUERY_KEYS.TOKENS] }),
        qc.refetchQueries({ queryKey: [QUERY_KEYS.SALES] }),
      ])
    },
  })
}
