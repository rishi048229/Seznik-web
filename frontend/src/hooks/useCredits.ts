import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/contexts/AuthContext'
import { QUERY_KEYS } from '@/constants/queryKeys'
import * as creditService from '@/services/creditService'

export const useCredits = () => {
  const { user } = useAuth()
  return useQuery({
    queryKey: [QUERY_KEYS.CREDITS, user?.uid],
    queryFn: () => creditService.getCustomersWithCredit(user!.uid),
    enabled: !!user,
    staleTime: 1 * 60 * 1000,
  })
}

export const useCreditTransactions = () => {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['credit-transactions', user?.uid],
    queryFn: () => creditService.getCreditTransactions(user!.uid),
    enabled: !!user,
  })
}
