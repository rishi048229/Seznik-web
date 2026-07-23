import type { Category } from '@/services/categoryService'

export interface CategoryOption {
  value: string
  label: string
}

export const isTopLevel = (category: Pick<Category, 'parentId'>) => !category.parentId

export const getTopLevelCategories = (categories: Category[] | undefined): Category[] =>
  (categories ?? []).filter(isTopLevel)

export const getChildCategories = (categories: Category[] | undefined, parentId: string): Category[] =>
  (categories ?? []).filter(c => c.parentId === parentId)

/**
 * Flattens categories into dropdown/pill options with subcategories immediately
 * following their parent and visually indented — every place that lists categories
 * (product filters, forms, POS pills) should build its options through this so the
 * hierarchy reads the same everywhere.
 */
export const buildCategoryOptions = (categories: Category[] | undefined): CategoryOption[] => {
  const list = categories ?? []
  const options: CategoryOption[] = []

  for (const parent of getTopLevelCategories(list)) {
    options.push({ value: parent.id, label: parent.name })
    for (const child of getChildCategories(list, parent.id)) {
      options.push({ value: child.id, label: `↳ ${child.name}` })
    }
  }

  // Orphaned rows (parentId pointing at something no longer top-level, e.g. mid-edit
  // races) — keep them visible instead of silently hiding a product's category.
  const seen = new Set(options.map(o => o.value))
  for (const c of list) {
    if (!seen.has(c.id)) options.push({ value: c.id, label: c.name })
  }

  return options
}
