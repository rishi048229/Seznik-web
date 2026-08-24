import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { authApi } from '@/api/auth';
import { useAuth } from './useAuth';
import { CreateManagedUserPayload, ManagedUser } from '@/types/auth';

/**
 * Staff sub-accounts under the current admin — createManagedUser for adding a new one; edit/remove
 * both go through syncManagedUsers (the backend's only update/delete path for a single record is
 * sending back the full desired roster), so updateStaff/removeStaff rebuild that list client-side.
 */
export function useManagedUsers() {
  const { user } = useAuth();
  const adminUid = user?.id || '';
  const queryClient = useQueryClient();
  const queryKey = ['managed-users', adminUid];

  const listQuery = useQuery({
    queryKey,
    queryFn: () => authApi.getManagedUsers(adminUid),
    enabled: !!adminUid,
  });

  const createMutation = useMutation({
    mutationFn: (payload: CreateManagedUserPayload) => authApi.createManagedUser(adminUid, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  const syncMutation = useMutation({
    mutationFn: (users: (ManagedUser | CreateManagedUserPayload)[]) => authApi.syncManagedUsers(adminUid, users),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  const updateStaff = (uid: string, changes: Partial<ManagedUser>) => {
    const current = listQuery.data || [];
    const next = current.map((u) => (u.uid === uid ? { ...u, ...changes } : u));
    return syncMutation.mutateAsync(next);
  };

  const removeStaff = (uid: string) => {
    const current = listQuery.data || [];
    const next = current.filter((u) => u.uid !== uid);
    return syncMutation.mutateAsync(next);
  };

  return {
    staff: listQuery.data || [],
    isLoading: !listQuery.data && listQuery.isLoading,
    isRefetching: listQuery.isRefetching,
    isError: listQuery.isError && !listQuery.data,
    refetch: listQuery.refetch,
    createStaff: createMutation.mutateAsync,
    isCreating: createMutation.isPending,
    updateStaff,
    removeStaff,
    isSyncing: syncMutation.isPending,
  };
}
