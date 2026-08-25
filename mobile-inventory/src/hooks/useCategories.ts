import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { productsApi } from '@/api/products';
import { useAuthStore } from '@/store/useAuthStore';
import { CreateCategoryPayload } from '@/types/category';

export function useCategories() {
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const userId = user?.id;

  const categoriesQuery = useQuery({
    queryKey: ['categories', userId],
    queryFn: productsApi.getCategories,
    enabled: !!userId,
    staleTime: 1000 * 60 * 5,
  });

  const createCategoryMutation = useMutation({
    mutationFn: (payload: CreateCategoryPayload) =>
      productsApi.createCategory(payload.name, payload.parentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
    },
  });

  const updateCategoryMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<CreateCategoryPayload> }) =>
      productsApi.updateCategory(id, payload.name || '', payload.parentId || undefined),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
    },
  });

  const deleteCategoryMutation = useMutation({
    mutationFn: (id: string) => productsApi.deleteCategory(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
    },
  });

  return {
    categories: categoriesQuery.data || [],
    isLoading: !categoriesQuery.data && categoriesQuery.isLoading,
    refetch: categoriesQuery.refetch,
    createCategory: createCategoryMutation.mutateAsync,
    updateCategory: updateCategoryMutation.mutateAsync,
    deleteCategory: deleteCategoryMutation.mutateAsync,
  };
}
