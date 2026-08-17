import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { tokensApi } from '@/api/tokens';
import { CreateTokenPayload } from '@/types/token';

export function useTokens(date?: string) {
  const queryClient = useQueryClient();

  const tokenTypesQuery = useQuery({
    queryKey: ['token-types'],
    queryFn: tokensApi.getTokenTypes,
  });

  const tokensQuery = useQuery({
    queryKey: ['tokens', date],
    queryFn: () => tokensApi.getTokens(date),
  });

  const createTokenTypeMutation = useMutation({
    mutationFn: (payload: { name: string; price?: number; taxRate?: number; color?: string }) =>
      tokensApi.createTokenType(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['token-types'] });
    },
  });

  const updateTokenTypeMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: { name?: string; price?: number; taxRate?: number; color?: string; isActive?: boolean } }) =>
      tokensApi.updateTokenType(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['token-types'] });
    },
  });

  const deleteTokenTypeMutation = useMutation({
    mutationFn: (id: string) => tokensApi.deleteTokenType(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['token-types'] });
    },
  });

  const createTokenMutation = useMutation({
    mutationFn: (payload: CreateTokenPayload) => tokensApi.createToken(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tokens'] });
      queryClient.invalidateQueries({ queryKey: ['sales'] });
      queryClient.invalidateQueries({ queryKey: ['reports', 'dashboard'] });
    },
  });

  const deleteTokenMutation = useMutation({
    mutationFn: (id: string) => tokensApi.deleteToken(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tokens'] });
    },
  });

  return {
    tokenTypes: tokenTypesQuery.data || [],
    isLoadingTokenTypes: tokenTypesQuery.isLoading,
    tokens: tokensQuery.data || [],
    isLoadingTokens: tokensQuery.isLoading,
    refetchTokens: tokensQuery.refetch,
    createTokenType: createTokenTypeMutation.mutateAsync,
    updateTokenType: updateTokenTypeMutation.mutateAsync,
    deleteTokenType: deleteTokenTypeMutation.mutateAsync,
    createToken: createTokenMutation.mutateAsync,
    isIssuingToken: createTokenMutation.isPending,
    deleteToken: deleteTokenMutation.mutateAsync,
  };
}
