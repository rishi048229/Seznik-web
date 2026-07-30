import { useState } from 'react'
import { TableSkeleton } from '@/components/ui/TableSkeleton'
import { PageHeader } from '@/components/layout/PageHeader'
import { PageVideoTutorialModal } from '@/components/common/PageVideoTutorialModal'
import { InteractivePageTour } from '@/components/common/InteractivePageTour'
import { usePageTutorial } from '@/hooks/usePageTutorial'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Modal } from '@/components/ui/Modal'
import { Badge } from '@/components/ui/Badge'
import { FieldInfo } from '@/components/ui/FieldInfo'
import {
  useCategories, useCreateCategory, useUpdateCategory, useDeleteCategory, useToggleCategoryActive,
} from '@/hooks/useCategories'
import { useProducts } from '@/hooks/useProducts'
import { getTopLevelCategories, getChildCategories } from '@/utils/categoryTree'
import type { Category } from '@/services/categoryService'
import {
  Plus, Pencil, Trash2, Search, Download, ChevronLeft, ChevronRight, ChevronDown,
  Info, TrendingUp, Package, Tag, Watch, Headphones, FolderTree, CornerDownRight,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { useLanguage } from '@/contexts/LanguageContext'

const CATEGORY_ICONS: React.ReactNode[] = [
  <Tag size={18} />, <Package size={18} />, <Watch size={18} />, <Headphones size={18} />,
]

const ICON_COLORS = [
  'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400',
  'bg-sky-100 text-sky-600 dark:bg-sky-900/30 dark:text-sky-400',
  'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400',
  'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400',
  'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400',
  'bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400',
]

const PAGE_SIZE = 6

export const CategoriesPage = () => {
  const { t } = useLanguage()
  const pageTutorial = usePageTutorial('categories')
  const { data: categories = [], isLoading } = useCategories()
  const { data: products } = useProducts()
  const { mutate: createCategory, isPending: isCreating } = useCreateCategory()
  const { mutate: updateCategory, isPending: isUpdating } = useUpdateCategory()
  const { mutate: deleteCategory } = useDeleteCategory()
  const { mutate: toggleActive } = useToggleCategoryActive()

  const [search, setSearch] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())

  // Create/edit modal state — one modal handles both top-level categories and subcategories.
  const [modalOpen, setModalOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [formName, setFormName] = useState('')
  const [formParentId, setFormParentId] = useState<string>('')

  const [quickAddName, setQuickAddName] = useState('')

  const all = categories ?? []
  const matchesSearch = (name: string) => name.toLowerCase().includes(search.toLowerCase())

  const topLevel = getTopLevelCategories(all)
  const childrenOf = (parentId: string) => getChildCategories(all, parentId)
  const hasChildren = (id: string) => childrenOf(id).length > 0

  const filteredTopLevel = topLevel.filter(parent =>
    matchesSearch(parent.name) || childrenOf(parent.id).some(child => matchesSearch(child.name))
  )
  const totalPages = Math.max(1, Math.ceil(filteredTopLevel.length / PAGE_SIZE))
  const paginated = filteredTopLevel.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

  const isExpanded = (id: string) =>
    expandedIds.has(id) || (search.trim() !== '' && childrenOf(id).some(child => matchesSearch(child.name)))

  const toggleExpanded = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // Only top-level categories can be a parent — keeps the hierarchy at a single subcategory depth.
  // The explicit "none" option lets an existing subcategory be promoted back to top-level.
  const parentOptions = [
    { value: '', label: '— None — top-level category —' },
    ...topLevel.filter(c => c.id !== editId).map(c => ({ value: c.id, label: c.name })),
  ]

  const openCreateModal = (parentId?: string) => {
    setEditId(null)
    setFormName('')
    setFormParentId(parentId ?? '')
    setModalOpen(true)
  }

  const openEditModal = (category: Category) => {
    setEditId(category.id)
    setFormName(category.name)
    setFormParentId(category.parentId ?? '')
    setModalOpen(true)
  }

  const closeModal = () => {
    setModalOpen(false)
    setEditId(null)
    setFormName('')
    setFormParentId('')
  }

  const editingHasChildren = editId ? hasChildren(editId) : false

  const handleSave = () => {
    if (!formName.trim()) return
    if (editId) {
      updateCategory(
        { categoryId: editId, name: formName.trim(), parentId: editingHasChildren ? null : (formParentId || null) },
        {
          onSuccess: () => { toast.success('Category updated'); closeModal() },
          onError: (err) => toast.error(err instanceof Error ? err.message : 'Failed to update category'),
        }
      )
    } else {
      createCategory(
        { name: formName.trim(), parentId: formParentId || undefined },
        {
          onSuccess: () => { toast.success(formParentId ? 'Subcategory created' : 'Category created'); closeModal() },
          onError: (err) => toast.error(err instanceof Error ? err.message : 'Failed to create category'),
        }
      )
    }
  }

  const handleQuickAdd = () => {
    if (!quickAddName.trim()) return
    createCategory({ name: quickAddName.trim() }, {
      onSuccess: () => {
        toast.success('Category created')
        setQuickAddName('')
      },
      onError: (err) => toast.error(err instanceof Error ? err.message : 'Failed to create category'),
    })
  }

  const handleDelete = (category: Category) => {
    const childCount = childrenOf(category.id).length
    const warning = childCount > 0
      ? `Delete "${category.name}" and its ${childCount} subcategor${childCount === 1 ? 'y' : 'ies'}?`
      : `Delete category "${category.name}"?`
    if (!confirm(warning)) return
    deleteCategory(category.id, {
      onSuccess: () => toast.success('Category deleted'),
      onError: () => toast.error('Failed to delete — move or remove its products first'),
    })
  }

  // Stats
  const getCategoryProductCount = (categoryId: string) =>
    products?.filter(p => p.categoryId === categoryId && p.isActive !== false).length ?? 0

  const totalProducts = products?.filter(p => p.isActive !== false).length ?? 0
  const categoryDistribution = all.map(cat => ({
    id: cat.id,
    name: cat.name,
    count: getCategoryProductCount(cat.id),
    percent: totalProducts > 0 ? Math.round((getCategoryProductCount(cat.id) / totalProducts) * 100) : 0,
  })).sort((a, b) => b.count - a.count)

  const topCategory = categoryDistribution[0]

  const renderToggle = (category: Category) => (
    <button
      type="button"
      onClick={() => toggleActive(
        { categoryId: category.id, isActive: !(category.isActive !== false) },
        { onSuccess: () => toast.success(`Category ${category.isActive !== false ? 'deactivated' : 'activated'}`) }
      )}
      className={`relative inline-flex h-5 w-10 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${
        category.isActive !== false ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'
      }`}
    >
      <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow transition duration-200 ${
        category.isActive !== false ? 'translate-x-5' : 'translate-x-0'
      }`} />
    </button>
  )

  return (
    <div>
      <div data-tour="categories-header">
        <PageHeader
          title={t('page.categories')}
          onWatchTutorial={pageTutorial.openTutorial}
          action={
            <div className="flex items-center gap-3">
              <Badge variant="info" className="flex items-center gap-1">
                <Info size={12} />
                {topLevel.length} Categories · {all.length - topLevel.length} Subcategories
              </Badge>
              <Button data-tour="new-category-btn" leftIcon={<Plus size={16} />} onClick={() => openCreateModal()}>
                New Category
              </Button>
            </div>
          }
        />
      </div>

      {/* Search Bar */}
      <div className="mb-4">
        <div data-tour="category-search-input" className="relative max-w-xs sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <Input
            placeholder="Search categories & subcategories..."
            value={search}
            onChange={e => { setSearch(e.target.value); setCurrentPage(1) }}
            className="pl-10"
          />
        </div>
      </div>

      {/* Main Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Category Management Table - Left */}
        <div data-tour="categories-table" className="lg:col-span-8">
          <Card className="overflow-hidden">
            <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Category Management</h3>
              <Button variant="outline" size="sm" leftIcon={<Download size={14} />}>
                Export
              </Button>
            </div>

            {/* Table Header */}
            <div className="hidden sm:flex items-center px-4 py-3 text-[10px] uppercase tracking-widest font-bold text-gray-400 bg-gray-50 dark:bg-gray-800 gap-3">
              <div className="w-14 flex-shrink-0" />
              <div className="flex-1 min-w-0">Category Name</div>
              <div className="w-20 text-center flex-shrink-0">Products</div>
              <div className="w-28 flex-shrink-0">Status</div>
              <div className="w-24 text-right flex-shrink-0">Actions</div>
            </div>

            {isLoading ? (
              <div className="p-4"><TableSkeleton rows={5} columns={5} /></div>
            ) : (
              <>
                <div className="divide-y divide-gray-100 dark:divide-gray-700">
                  {paginated.map((category, index) => {
                    const productCount = getCategoryProductCount(category.id)
                    const children = childrenOf(category.id)
                    const expanded = isExpanded(category.id)
                    const iconIndex = index % ICON_COLORS.length

                    return (
                      <div key={category.id}>
                        {/* Parent row */}
                        <div className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-all">
                          {/* Expand toggle + icon */}
                          <div className="w-14 flex items-center gap-1 flex-shrink-0">
                            <button
                              type="button"
                              onClick={() => children.length > 0 && toggleExpanded(category.id)}
                              className={`w-5 h-5 flex items-center justify-center text-gray-400 ${children.length === 0 ? 'invisible' : 'hover:text-gray-600'}`}
                            >
                              <ChevronDown size={16} className={`transition-transform ${expanded ? 'rotate-0' : '-rotate-90'}`} />
                            </button>
                            <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${ICON_COLORS[iconIndex]}`}>
                              {CATEGORY_ICONS[iconIndex % CATEGORY_ICONS.length]}
                            </div>
                          </div>

                          {/* Name */}
                          <div className="flex-1 min-w-0">
                            <span className="font-semibold text-sm text-gray-900 dark:text-gray-100 truncate block">
                              {category.name}
                            </span>
                            <span className="text-xs text-gray-400">
                              {productCount} items{children.length > 0 ? ` · ${children.length} subcategor${children.length === 1 ? 'y' : 'ies'}` : ''}
                            </span>
                          </div>

                          {/* Products count — desktop only */}
                          <div className="hidden sm:block w-20 text-center text-sm text-gray-500 dark:text-gray-400 font-medium flex-shrink-0">
                            {productCount} items
                          </div>

                          {/* Toggle */}
                          <div className="flex items-center gap-1.5 w-28 flex-shrink-0">
                            {renderToggle(category)}
                            <span className={`text-xs font-medium ${category.isActive !== false ? 'text-blue-600' : 'text-gray-400'}`}>
                              {category.isActive !== false ? 'Active' : 'Inactive'}
                            </span>
                          </div>

                          {/* Actions */}
                          <div className="flex items-center gap-1 w-24 justify-end flex-shrink-0">
                            <button
                              onClick={() => openCreateModal(category.id)}
                              title="Add subcategory"
                              className="p-1.5 rounded-lg text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors"
                            >
                              <FolderTree size={15} />
                            </button>
                            <button
                              onClick={() => openEditModal(category)}
                              className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                            >
                              <Pencil size={15} />
                            </button>
                            <button
                              onClick={() => handleDelete(category)}
                              className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </div>

                        {/* Subcategory rows */}
                        {expanded && children
                          .filter(child => !search.trim() || matchesSearch(child.name))
                          .map(child => {
                            const childCount = getCategoryProductCount(child.id)
                            return (
                              <div
                                key={child.id}
                                className="flex items-center gap-3 pl-14 pr-4 py-2.5 bg-gray-50/70 dark:bg-gray-800/30 hover:bg-gray-100 dark:hover:bg-gray-800/60 transition-all border-t border-gray-100/70 dark:border-gray-800"
                              >
                                <CornerDownRight size={14} className="text-gray-300 dark:text-gray-600 flex-shrink-0" />
                                <div className="flex-1 min-w-0">
                                  <span className="text-sm text-gray-700 dark:text-gray-300 truncate block">{child.name}</span>
                                  <span className="text-xs text-gray-400 sm:hidden">{childCount} items</span>
                                </div>
                                <div className="hidden sm:block w-20 text-center text-xs text-gray-500 dark:text-gray-400 flex-shrink-0">
                                  {childCount} items
                                </div>
                                <div className="flex items-center gap-1.5 w-28 flex-shrink-0">
                                  {renderToggle(child)}
                                  <span className={`text-xs font-medium ${child.isActive !== false ? 'text-blue-600' : 'text-gray-400'}`}>
                                    {child.isActive !== false ? 'Active' : 'Inactive'}
                                  </span>
                                </div>
                                <div className="flex items-center gap-1 w-24 justify-end flex-shrink-0">
                                  <button
                                    onClick={() => openEditModal(child)}
                                    className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                                  >
                                    <Pencil size={14} />
                                  </button>
                                  <button
                                    onClick={() => handleDelete(child)}
                                    className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </div>
                              </div>
                            )
                          })}
                      </div>
                    )
                  })}
                </div>

                {/* Pagination */}
                {filteredTopLevel.length > 0 && (
                  <div className="p-4 bg-gray-50 dark:bg-gray-800 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between">
                    <span className="text-xs text-gray-400">
                      Showing {(currentPage - 1) * PAGE_SIZE + 1} to {Math.min(currentPage * PAGE_SIZE, filteredTopLevel.length)} of {filteredTopLevel.length} categories
                    </span>
                    <div className="flex gap-1">
                      <button
                        disabled={currentPage === 1}
                        onClick={() => setCurrentPage(p => p - 1)}
                        className="w-8 h-8 rounded-lg flex items-center justify-center bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-400 disabled:opacity-50"
                      >
                        <ChevronLeft size={14} />
                      </button>
                      {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => i + 1).map(page => (
                        <button
                          key={page}
                          onClick={() => setCurrentPage(page)}
                          className={`w-8 h-8 rounded-lg text-xs font-bold ${
                            currentPage === page
                              ? 'bg-[#0a0a2e] text-white'
                              : 'bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300'
                          }`}
                        >
                          {page}
                        </button>
                      ))}
                      <button
                        disabled={currentPage >= totalPages}
                        onClick={() => setCurrentPage(p => p + 1)}
                        className="w-8 h-8 rounded-lg flex items-center justify-center bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-400 disabled:opacity-50"
                      >
                        <ChevronRight size={14} />
                      </button>
                    </div>
                  </div>
                )}

                {!isLoading && filteredTopLevel.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                    <Tag size={48} className="mb-4 opacity-30" />
                    <p className="text-sm">No categories found</p>
                  </div>
                )}
              </>
            )}
          </Card>
        </div>

        {/* Right Sidebar */}
        <div className="lg:col-span-4 space-y-6">
          {/* Category Overview */}
          <Card className="p-6 bg-gradient-to-br from-blue-600 to-sky-400 text-white overflow-hidden relative">
            <div className="relative z-10">
              <h3 className="font-bold text-lg mb-4">Category Overview</h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-white/70 text-sm">Most Products</span>
                  <span className="font-bold">{topCategory?.name ?? '—'}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-white/70 text-sm">Total Products</span>
                  <span className="font-bold">{totalProducts}</span>
                </div>
                <div className="w-full bg-white/20 h-2 rounded-full mt-4">
                  <div
                    className="bg-white h-full rounded-full transition-all"
                    style={{ width: `${topCategory?.percent ?? 0}%` }}
                  />
                </div>
                <p className="text-[10px] text-white/60">
                  {topCategory?.percent ?? 0}% of products in top category
                </p>
              </div>
            </div>
            <div className="absolute -right-8 -bottom-8 opacity-10">
              <TrendingUp size={96} />
            </div>
          </Card>

          {/* Quick Add */}
          <Card className="p-6">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-4">Quick Add</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-[10px] uppercase tracking-wider font-bold text-gray-500 mb-1.5 ml-1">
                  Category Name
                </label>
                <Input
                  value={quickAddName}
                  onChange={e => setQuickAddName(e.target.value)}
                  placeholder="e.g. Home Decor"
                  onKeyDown={e => { if (e.key === 'Enter') handleQuickAdd() }}
                />
                <p className="text-[11px] text-gray-400 mt-1.5 ml-1">
                  Creates a top-level category. Use the tree list to add subcategories.
                </p>
              </div>
              <Button
                onClick={handleQuickAdd}
                loading={isCreating}
                disabled={!quickAddName.trim()}
                className="w-full"
              >
                Create Category
              </Button>
            </div>
          </Card>

          {/* Category Distribution */}
          <Card className="p-6">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100 text-sm mb-4">Category Distribution</h3>
            <div className="space-y-4">
              {categoryDistribution.slice(0, 5).map(cat => (
                <div key={cat.id}>
                  <div className="flex justify-between text-[11px] font-bold mb-1">
                    <span className="text-gray-600 dark:text-gray-300">{cat.name}</span>
                    <span className="text-gray-900 dark:text-gray-100">{cat.percent}%</span>
                  </div>
                  <div className="w-full h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full">
                    <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${cat.percent}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>

      {/* New/Edit Category Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={closeModal}
        title={editId ? 'Edit Category' : formParentId ? 'New Subcategory' : 'New Category'}
        size="sm"
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={closeModal}>
              Cancel
            </Button>
            <Button onClick={handleSave} loading={isCreating || isUpdating} disabled={!formName.trim()}>
              {editId ? 'Update' : 'Create'}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Category Name
              <FieldInfo textKey="tip.category.name" />
            </label>
            <Input
              value={formName}
              onChange={e => setFormName(e.target.value)}
              placeholder="e.g. Shirts, or Checks for a subcategory"
              autoFocus
              onKeyDown={e => { if (e.key === 'Enter') handleSave() }}
            />
          </div>

          {editingHasChildren ? (
            <p className="text-xs text-gray-400 bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
              This category has its own subcategories, so it can't be moved under another category.
            </p>
          ) : (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Parent Category (optional)
                <FieldInfo textKey="tip.category.parent" />
              </label>
              <Select
                options={parentOptions}
                placeholder="— None — top-level category —"
                value={formParentId}
                onChange={e => setFormParentId(e.target.value)}
              />
            </div>
          )}
        </div>
      </Modal>

      {/* Tutorial Video Modal & Guided Onboarding Tour */}
      <PageVideoTutorialModal
        isOpen={pageTutorial.isTutorialOpen}
        onClose={pageTutorial.closeTutorial}
        tutorial={pageTutorial.tutorialData}
        onStartTour={pageTutorial.startTour}
      />
      <InteractivePageTour
        pageKey="categories"
        steps={pageTutorial.tutorialData.tourSteps}
        isOpen={pageTutorial.isTourOpen}
        onClose={pageTutorial.closeTour}
      />
    </div>
  )
}
