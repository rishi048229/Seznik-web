import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/contexts/AuthContext'
import { QUERY_KEYS } from '@/constants/queryKeys'
import * as categoryService from '@/services/categoryService'
import type { Category } from '@/services/categoryService'

export const useCategories = () => {
  const { user } = useAuth()
  return useQuery({
    queryKey: [QUERY_KEYS.CATEGORIES, user?.uid],
    queryFn: () => categoryService.getCategories(user!.uid),
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  })
}

export const useCreateCategory = () => {
  const { user } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (name: string) => categoryService.createCategory(user!.uid, name),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QUERY_KEYS.CATEGORIES] })
    },
  })
}

export const useUpdateCategory = () => {
  const { user } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ categoryId, name }: { categoryId: string; name: string }) =>
      categoryService.updateCategory(user!.uid, categoryId, name),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QUERY_KEYS.CATEGORIES] })
    },
  })
}

export const useDeleteCategory = () => {
  const { user } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (categoryId: string) => categoryService.deleteCategory(user!.uid, categoryId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QUERY_KEYS.CATEGORIES] })
    },
  })
}

export const useToggleCategoryActive = () => {
  const { user } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ categoryId, isActive }: { categoryId: string; isActive: boolean }) =>
      categoryService.toggleCategoryActive(user!.uid, categoryId, isActive),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QUERY_KEYS.CATEGORIES] })
    },
  })
}
