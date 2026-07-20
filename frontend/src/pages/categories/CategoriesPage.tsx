import { useState } from 'react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { Badge } from '@/components/ui/Badge'
import { Spinner } from '@/components/ui/Spinner'
import { useCategories, useCreateCategory, useUpdateCategory, useDeleteCategory, useToggleCategoryActive } from '@/hooks/useCategories'
import { useProducts } from '@/hooks/useProducts'
import { Plus, Pencil, Trash2, Search, Filter, Download, ChevronLeft, ChevronRight, Info, TrendingUp, Package, Tag, Watch, Headphones } from 'lucide-react'
import toast from 'react-hot-toast'

interface CategoryRow {
  id: string
  name: string
  createdAt: Date
}

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  apparel: <Tag size={20} />,
  footwear: <Package size={20} />,
  electronics: <Watch size={20} />,
  accessories: <Headphones size={20} />,
}

const ICON_COLORS = [
  'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400',
  'bg-sky-100 text-sky-600 dark:bg-sky-900/30 dark:text-sky-400',
  'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400',
  'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400',
  'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400',
  'bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400',
]

const PAGE_SIZE = 6

export const CategoriesPage = () => {
  const { data: categories, isLoading } = useCategories()
  const { data: products } = useProducts()
  const { mutate: createCategory, isPending: isCreating } = useCreateCategory()
  const { mutate: updateCategory } = useUpdateCategory()
  const { mutate: deleteCategory } = useDeleteCategory()
  const { mutate: toggleActive } = useToggleCategoryActive()
  const [search, setSearch] = useState('')
  const [editId, setEditId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [quickAddName, setQuickAddName] = useState('')
  const [currentPage, setCurrentPage] = useState(1)

  const activeCategories = categories ?? []
  const filtered = activeCategories.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase())
  )
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const paginated = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

  const handleSave = () => {
    if (!editName.trim()) return
    if (editId) {
      updateCategory({ categoryId: editId, name: editName.trim() }, {
        onSuccess: () => toast.success('Category updated'),
        onError: () => toast.error('Failed to update category'),
      })
    } else {
      createCategory(editName.trim(), {
        onSuccess: () => toast.success('Category created'),
        onError: () => toast.error('Failed to create category'),
      })
    }
    setEditName('')
    setEditId(null)
  }

  const handleQuickAdd = () => {
    if (!quickAddName.trim()) return
    createCategory(quickAddName.trim(), {
      onSuccess: () => {
        toast.success('Category created')
        setQuickAddName('')
      },
      onError: () => toast.error('Failed to create category'),
    })
  }

  const handleDelete = (id: string, name: string) => {
    if (!confirm(`Delete category "${name}"?`)) return
    deleteCategory(id, {
      onSuccess: () => toast.success('Category deleted'),
      onError: () => toast.error('Failed to delete category'),
    })
  }

  const handleStartEdit = (category: CategoryRow) => {
    setEditName(category.name)
    setEditId(category.id)
  }

  const handleCancelEdit = () => {
    setEditName('')
    setEditId(null)
  }

  // Stats
  const getCategoryProductCount = (categoryId: string) =>
    products?.filter(p => p.categoryId === categoryId && p.isActive !== false).length ?? 0

  const totalProducts = products?.filter(p => p.isActive !== false).length ?? 0
  const categoryDistribution = activeCategories.map(cat => ({
    id: cat.id,
    name: cat.name,
    count: getCategoryProductCount(cat.id),
    percent: totalProducts > 0 ? Math.round((getCategoryProductCount(cat.id) / totalProducts) * 100) : 0,
  })).sort((a, b) => b.count - a.count)

  const topCategory = categoryDistribution[0]

  return (
    <div>
      <PageHeader
        title="Product Categories"
        action={
          <div className="flex items-center gap-4">
            <Badge variant="info" className="flex items-center gap-1">
              <Info size={12} />
              {activeCategories.length} Active Categories
            </Badge>
            {/* <Button leftIcon={<Plus size={16} />} onClick={() => { setEditName(''); setEditId(null); }}>
              New Category
            </Button> */}
          </div>
        }
      />

      {/* Search Bar */}
      <div className="mb-4">
        <div className="relative max-w-xs sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <Input
            placeholder="Search categories..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Main Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Category Management Table - Left */}
        <div className="lg:col-span-8">
          <Card className="overflow-hidden">
            <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Category Management</h3>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" leftIcon={<Filter size={14} />}>
                  Filter
                </Button>
                <Button variant="outline" size="sm" leftIcon={<Download size={14} />}>
                  Export
                </Button>
              </div>
            </div>

            {/* Table Header */}
            <div className="hidden sm:flex items-center px-4 py-3 text-[10px] uppercase tracking-widest font-bold text-gray-400 bg-gray-50 dark:bg-gray-800 gap-3">
              <div className="w-10 flex-shrink-0" />
              <div className="flex-1 min-w-0">Category Name</div>
              <div className="w-20 text-center flex-shrink-0">Products</div>
              <div className="w-28 flex-shrink-0">Status</div>
              <div className="w-16 text-right flex-shrink-0">Actions</div>
            </div>

            {isLoading ? (
              <div className="flex justify-center py-12"><Spinner size="lg" /></div>
            ) : (
              <>
                <div className="divide-y divide-gray-100 dark:divide-gray-700">
                  {paginated.map((category, index) => {
                    const productCount = getCategoryProductCount(category.id)
                    const iconIndex = index % ICON_COLORS.length
                    const iconKey = Object.keys(CATEGORY_ICONS)[index % Object.keys(CATEGORY_ICONS).length]

                    return (
                      <div
                        key={category.id}
                        className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-all"
                      >
                        {/* Icon */}
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${ICON_COLORS[iconIndex]}`}>
                          {CATEGORY_ICONS[iconKey] || <Tag size={20} />}
                        </div>

                        {/* Name */}
                        <div className="flex-1 min-w-0">
                          {editId === category.id ? (
                            <Input
                              value={editName}
                              onChange={e => setEditName(e.target.value)}
                              onBlur={() => handleSave()}
                              onKeyDown={e => {
                                if (e.key === 'Enter') handleSave()
                                if (e.key === 'Escape') handleCancelEdit()
                              }}
                              autoFocus
                              className="text-sm font-semibold"
                            />
                          ) : (
                            <span className="font-semibold text-sm text-gray-900 dark:text-gray-100 truncate block">{category.name}</span>
                          )}
                          <span className="text-xs text-gray-400 sm:hidden">{productCount} items</span>
                        </div>

                        {/* Products count — desktop only */}
                        <div className="hidden sm:block w-20 text-center text-sm text-gray-500 dark:text-gray-400 font-medium flex-shrink-0">
                          {productCount} items
                        </div>

                        {/* Toggle */}
                        <div className="flex items-center gap-1.5 w-28 flex-shrink-0">
                          <button
                            type="button"
                            onClick={() => toggleActive(
                              { categoryId: category.id, isActive: !(category.isActive !== false) },
                              { onSuccess: () => toast.success(`Category ${category.isActive !== false ? 'deactivated' : 'activated'}`) }
                            )}
                            className={`relative inline-flex h-5 w-10 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${
                              category.isActive !== false ? 'bg-indigo-600' : 'bg-gray-300 dark:bg-gray-600'
                            }`}
                          >
                            <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow transition duration-200 ${
                              category.isActive !== false ? 'translate-x-5' : 'translate-x-0'
                            }`} />
                          </button>
                          <span className={`text-xs font-medium ${category.isActive !== false ? 'text-indigo-600' : 'text-gray-400'}`}>
                            {category.isActive !== false ? 'Active' : 'Inactive'}
                          </span>
                        </div>

                        {/* Actions — always visible */}
                        <div className="flex items-center gap-1 w-16 justify-end flex-shrink-0">
                          {editId !== category.id ? (
                            <>
                              <button
                                onClick={() => handleStartEdit(category)}
                                className="p-1.5 rounded-lg text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors"
                              >
                                <Pencil size={15} />
                              </button>
                              <button
                                onClick={() => handleDelete(category.id, category.name)}
                                className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                              >
                                <Trash2 size={15} />
                              </button>
                            </>
                          ) : (
                            <button
                              onClick={handleCancelEdit}
                              className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 transition-colors"
                            >
                              ✕
                            </button>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* Pagination */}
                {filtered.length > 0 && (
                  <div className="p-4 bg-gray-50 dark:bg-gray-800 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between">
                    <span className="text-xs text-gray-400">
                      Showing {(currentPage - 1) * PAGE_SIZE + 1} to {Math.min(currentPage * PAGE_SIZE, filtered.length)} of {filtered.length} categories
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

                {!isLoading && filtered.length === 0 && (
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
          <Card className="p-6 bg-gradient-to-br from-indigo-600 to-indigo-800 text-white overflow-hidden relative">
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
                    <div className="h-full bg-indigo-500 rounded-full transition-all" style={{ width: `${cat.percent}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>

      {/* New/Edit Category Modal */}
      {editId === null && editName === '' ? null : (
        <Modal
          isOpen={editId === null || editName !== ''}
          onClose={() => { setEditName(''); setEditId(null) }}
          title={editId ? 'Edit Category' : 'New Category'}
          size="sm"
          footer={
            <div className="flex justify-end gap-3">
              <Button variant="ghost" onClick={() => { setEditName(''); setEditId(null) }}>
                Cancel
              </Button>
              <Button onClick={handleSave} loading={isCreating} disabled={!editName.trim()}>
                {editId ? 'Update' : 'Create'}
              </Button>
            </div>
          }
        >
          <Input
            label="Category Name"
            value={editName}
            onChange={e => setEditName(e.target.value)}
            placeholder="Enter category name"
            autoFocus
            onKeyDown={e => {
              if (e.key === 'Enter') handleSave()
            }}
          />
        </Modal>
      )}
    </div>
  )
}
