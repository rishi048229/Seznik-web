import { useEffect, useState } from 'react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { Switch } from '@/components/ui/Switch'
import { EmptyState } from '@/components/ui/EmptyState'
import { TableSkeleton } from '@/components/ui/TableSkeleton'
import { QuickAddProductModal } from '@/components/common/QuickAddProductModal'
import {
  useLocations, useCreateLocation, useUpdateLocation, useDeleteLocation, useToggleLocationActive,
  useLocationStock, useUpsertProductLocationStock, useCreateStockTransfer, useStockTransfers,
} from '@/hooks/useLocations'
import { useSettings, useUpdateSettings, useCreateSettings } from '@/hooks/useSettings'
import { useProducts } from '@/hooks/useProducts'
import { formatINR } from '@/utils/currency'
import { useLanguage } from '@/contexts/LanguageContext'
import { Store, Plus, Pencil, Trash2, ArrowRightLeft, Package, Search, ChevronLeft, ChevronRight, Check } from 'lucide-react'
import toast from 'react-hot-toast'
import type { Location } from '@/types/location.types'

// "Store" is the user-facing word throughout this page — internally this is
// still the Location model/API (see hooks/useLocations, types/location.types),
// but "Location" read as a GPS/geo concept to shop owners testing this; "Store"
// (or "Warehouse") is what they actually mean, so the UI text was renamed
// without touching the underlying model/route names.
export const LocationsPage = () => {
  const { t } = useLanguage()
  const { data: settings, isError: settingsLoadError } = useSettings()
  const { mutate: updateSettings } = useUpdateSettings()
  const { mutate: createSettings } = useCreateSettings()
  const { data: locations = [], isLoading } = useLocations()
  const { data: products } = useProducts()

  const { mutate: createLocation, isPending: isCreating } = useCreateLocation()
  const { mutate: updateLocation } = useUpdateLocation()
  const { mutate: deleteLocation } = useDeleteLocation()
  const { mutate: toggleActive } = useToggleLocationActive()

  const [modalOpen, setModalOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [formName, setFormName] = useState('')
  const [seedFromCurrentStock, setSeedFromCurrentStock] = useState(true)

  const [activeLocationId, setActiveLocationId] = useState<string | null>(() => {
    try {
      return localStorage.getItem('pos_selected_location_id')
    } catch {
      return null
    }
  })

  const selectStore = (id: string | null) => {
    setActiveLocationId(id)
    try {
      if (id) localStorage.setItem('pos_selected_location_id', id)
      else localStorage.removeItem('pos_selected_location_id')
    } catch {
      /* ignore quota / private mode */
    }
  }
  const [stockSearch, setStockSearch] = useState('')
  const [showAllProducts, setShowAllProducts] = useState(true)
  const [stockPage, setStockPage] = useState(1)
  const [stockPageSize, setStockPageSize] = useState(15)

  const [transferOpen, setTransferOpen] = useState(false)
  const [transferSearch, setTransferSearch] = useState('')
  const [transferProductId, setTransferProductId] = useState('')
  const [transferFromId, setTransferFromId] = useState('')
  const [transferToId, setTransferToId] = useState('')
  const [transferQty, setTransferQty] = useState('')
  const [addProductOpen, setAddProductOpen] = useState(false)

  const { data: locationStock = [], isLoading: isStockLoading } = useLocationStock(activeLocationId)
  const { mutate: upsertStock } = useUpsertProductLocationStock()
  const { mutate: createTransfer, isPending: isTransferring } = useCreateStockTransfer()
  const { data: transfers = [] } = useStockTransfers()

  useEffect(() => {
    if (!activeLocationId || locations.length === 0) return
    if (!locations.some((loc) => loc.id === activeLocationId && loc.isActive)) {
      selectStore(null)
    }
  }, [locations, activeLocationId])

  const enabled = settings?.locationConfig?.enabled ?? false

  const toggleFeature = (v: boolean) => {
    if (settingsLoadError) {
      toast.error('Could not load settings. Refresh and try again.')
      return
    }
    const onError = (err: unknown) => {
      const msg = err instanceof Error ? err.message : ''
      toast.error(msg ? `Failed to save setting: ${msg}` : 'Failed to save setting')
      console.error('locationConfig save failed:', err)
    }
    if (settings?.id) {
      updateSettings({ settingsId: settings.id, data: { locationConfig: { enabled: v } } }, { onError })
    } else {
      createSettings({ locationConfig: { enabled: v } } as Parameters<typeof createSettings>[0], { onError })
    }
  }

  const openCreate = () => {
    setEditId(null)
    setFormName('')
    // Defaults on for the very first store — this is exactly the "I already
    // added products before ever creating a store" scenario: without this,
    // that existing stock has no store attached to it at all and can never
    // be picked in the switcher or transferred from. Off by default for a
    // 2nd/3rd store, since duplicating the same numbers into every new
    // store isn't usually what's wanted once a real first store exists.
    setSeedFromCurrentStock(locations.length === 0)
    setModalOpen(true)
  }

  const openEdit = (loc: Location) => {
    setEditId(loc.id)
    setFormName(loc.name)
    setModalOpen(true)
  }

  const handleSave = () => {
    if (!formName.trim()) {
      toast.error('Store name is required')
      return
    }
    if (editId) {
      updateLocation({ locationId: editId, name: formName.trim() }, {
        onSuccess: () => { toast.success('Store updated'); setModalOpen(false) },
        onError: () => toast.error('Failed to update store'),
      })
    } else {
      createLocation({ name: formName.trim(), sortOrder: locations.length, seedFromCurrentStock }, {
        onSuccess: (created) => {
          toast.success(seedFromCurrentStock ? 'Store added with your existing product stock' : 'Store added')
          setModalOpen(false)
          selectStore(created.id)
        },
        onError: () => toast.error('Failed to add store'),
      })
    }
  }

  const handleDelete = (loc: Location) => {
    if (!confirm(`Delete "${loc.name}"? Its stock records will be removed too.`)) return
    deleteLocation(loc.id, {
      onSuccess: () => {
        toast.success('Store deleted')
        if (activeLocationId === loc.id) selectStore(null)
      },
      onError: () => toast.error('Failed to delete store — it may still have stock or sales history'),
    })
  }

  const activeLocation = locations.find(l => l.id === activeLocationId)
  const stockByProductId = new Map(locationStock.map(s => [s.productId, s]))
  const filteredProducts = (products ?? [])
    .filter(p => p.isActive !== false && (
      p.name.toLowerCase().includes(stockSearch.toLowerCase()) ||
      p.sku?.toLowerCase().includes(stockSearch.toLowerCase()) ||
      p.barcode?.toLowerCase().includes(stockSearch.toLowerCase())
    ))
    .filter(p => showAllProducts || (stockByProductId.get(p.id)?.stock ?? 0) > 0)

  const totalStockPages = Math.max(1, Math.ceil(filteredProducts.length / stockPageSize))
  const paginatedProducts = filteredProducts.slice((stockPage - 1) * stockPageSize, stockPage * stockPageSize)

  const openTransferForProduct = (prodId: string) => {
    setTransferProductId(prodId)
    setTransferFromId(activeLocationId || '')
    const otherLoc = locations.find(l => l.id !== activeLocationId && l.isActive)
    setTransferToId(otherLoc?.id || '')
    setTransferQty('')
    setTransferSearch('')
    setTransferOpen(true)
  }

  const handleStockChange = (productId: string, field: 'stock' | 'priceOverride', value: string) => {
    if (!activeLocationId) return
    const numValue = value === '' ? (field === 'priceOverride' ? null : 0) : Number(value)
    upsertStock({ productId, locationId: activeLocationId, data: { [field]: numValue } })
  }

  const handleTransfer = () => {
    const qty = Number(transferQty)
    if (!transferProductId || !transferFromId || !transferToId || !qty || qty <= 0) {
      toast.error('Fill in product, both stores, and a positive quantity')
      return
    }
    if (transferFromId === transferToId) {
      toast.error('Source and destination must be different')
      return
    }
    createTransfer(
      { productId: transferProductId, fromLocationId: transferFromId, toLocationId: transferToId, quantity: qty },
      {
        onSuccess: () => {
          toast.success('Stock transferred')
          setTransferOpen(false)
          setTransferProductId('')
          setTransferQty('')
          setTransferSearch('')
        },
        onError: (err: any) => toast.error(err?.message || 'Transfer failed'),
      }
    )
  }

  return (
    <div>
      <PageHeader
        title={t('page.locations') || 'Stores'}
        action={
          <Button onClick={openCreate} className="flex items-center gap-2">
            <Plus size={16} /> {t('locations.addLocation') || 'Add Store'}
          </Button>
        }
      />

      {/* Feature toggle */}
      <Card className="p-5 mb-6">
        <Switch
          checked={enabled}
          onChange={toggleFeature}
          label={t('locations.enableFeature') || 'Enable Multi-Store Inventory'}
          description={
            t('locations.enableFeatureDesc') ||
            'Track separate stock and (optionally) separate prices per store/warehouse. When off, billing behaves exactly as a single-store install.'
          }
        />
      </Card>

      {!enabled ? (
        <EmptyState
          icon={<Store size={40} />}
          title={t('locations.disabledTitle') || 'Multi-store inventory is off'}
          description={t('locations.disabledDesc') || 'Turn it on above to start adding stores like "Main Store" and "Baner Store".'}
        />
      ) : isLoading ? (
        <TableSkeleton rows={3} columns={3} />
      ) : locations.length === 0 ? (
        <EmptyState
          icon={<Store size={40} />}
          title={t('locations.emptyTitle') || 'No stores yet'}
          description={
            (products?.some(p => p.currentStock > 0)
              ? 'You already have products with stock — creating your first store below can adopt that existing stock automatically, so it has a real store to belong to and you can transfer it out from there.'
              : t('locations.emptyDesc')) || 'Add your first two stores, e.g. "Main Store" and "Baner Store".'
          }
          action={<Button onClick={openCreate}><Plus size={16} className="mr-1.5" />{t('locations.addLocation') || 'Add Store'}</Button>}
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Store list */}
          <Card className="p-4 lg:col-span-1 h-fit">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-sm text-gray-900 dark:text-gray-100">{t('locations.allLocations') || 'Stores'}</h3>
              <Button size="sm" variant="secondary" onClick={() => setTransferOpen(true)}>
                <ArrowRightLeft size={14} className="mr-1" /> {t('locations.transfer') || 'Transfer'}
              </Button>
            </div>
            <div className="space-y-2">
              {locations.map(loc => (
                <div
                  key={loc.id}
                  onClick={() => selectStore(loc.id)}
                  className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-colors ${
                    activeLocationId === loc.id
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                      : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                  } ${!loc.isActive ? 'opacity-50' : ''}`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Store size={16} className="text-gray-400 shrink-0" />
                    <span className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{loc.name}</span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
                    <button onClick={() => toggleActive({ locationId: loc.id, isActive: !loc.isActive })} title={loc.isActive ? 'Deactivate' : 'Activate'}>
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${loc.isActive ? 'bg-emerald-100 text-emerald-600' : 'bg-gray-100 text-gray-500'}`}>
                        {loc.isActive ? 'Active' : 'Off'}
                      </span>
                    </button>
                    <button onClick={() => openEdit(loc)} className="text-gray-400 hover:text-blue-600 p-1"><Pencil size={14} /></button>
                    <button onClick={() => handleDelete(loc)} className="text-gray-400 hover:text-red-600 p-1"><Trash2 size={14} /></button>
                  </div>
                </div>
              ))}
            </div>

            {transfers.length > 0 && (
              <div className="mt-5 pt-4 border-t border-gray-100 dark:border-gray-700">
                <h4 className="text-xs font-semibold text-gray-500 mb-2">{t('locations.recentTransfers') || 'Recent Transfers'}</h4>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {transfers.slice(0, 10).map(tr => (
                    <div key={tr.id} className="text-[11px] text-gray-500 dark:text-gray-400">
                      <span className="font-medium text-gray-700 dark:text-gray-300">{tr.product?.name}</span>{' '}
                      {tr.quantity} · {tr.fromLocation?.name} → {tr.toLocation?.name}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Card>

          {/* Stock table for the selected store */}
          <Card className="p-4 lg:col-span-2">
            {!activeLocation ? (
              <EmptyState icon={<Package size={32} />} title={t('locations.selectPrompt') || 'Select a store to view/edit its stock'} description="" />
            ) : (
              <>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-3 gap-3">
                  <h3 className="font-semibold text-sm text-gray-900 dark:text-gray-100">{activeLocation.name} — {t('locations.stock') || 'Stock'}</h3>
                  <div className="flex items-center gap-2">
                    <div className="relative w-40 sm:w-48">
                      <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input
                        value={stockSearch}
                        onChange={e => setStockSearch(e.target.value)}
                        placeholder={t('common.search') || 'Search products...'}
                        className="w-full pl-8 pr-2 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
                      />
                    </div>
                    <Button size="sm" variant="secondary" onClick={() => setAddProductOpen(true)} className="whitespace-nowrap">
                      <Plus size={14} className="mr-1" /> New Product
                    </Button>
                  </div>
                </div>

                <label className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 mb-3 cursor-pointer w-fit">
                  <input
                    type="checkbox"
                    checked={showAllProducts}
                    onChange={e => setShowAllProducts(e.target.checked)}
                    className="rounded"
                  />
                  Show all products (uncheck to see only what this store actually carries)
                </label>

                {isStockLoading ? (
                  <TableSkeleton rows={4} columns={3} />
                ) : (
                  <>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="text-[10px] uppercase tracking-wider text-gray-400 border-b border-gray-100 dark:border-gray-700">
                            <th className="py-2.5 pr-2">{t('common.product') || 'Product'}</th>
                            <th className="py-2.5 px-2">{t('locations.stockAtLocation') || 'Stock here'}</th>
                            <th className="py-2.5 px-2">{t('locations.priceOverride') || 'Price override'}</th>
                            <th className="py-2.5 px-2 text-right">Transfer</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                          {paginatedProducts.map(p => {
                            const stockRow = stockByProductId.get(p.id)
                            return (
                              <tr key={p.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/30 transition-colors">
                                <td className="py-2.5 pr-2">
                                  <p className="font-medium text-gray-900 dark:text-gray-100">{p.name}</p>
                                  <div className="flex items-center gap-2 text-[10px] text-gray-400 mt-0.5">
                                    <span>Base: {formatINR(p.sellingPrice)}</span>
                                    {p.sku && <span>• SKU: {p.sku}</span>}
                                    {p.barcode && <span>• {p.barcode}</span>}
                                  </div>
                                </td>
                                <td className="py-2.5 px-2">
                                  <input
                                    type="number"
                                    key={`${p.id}-stock-${stockRow?.stock ?? 0}`}
                                    defaultValue={stockRow?.stock ?? 0}
                                    onBlur={e => handleStockChange(p.id, 'stock', e.target.value)}
                                    className="w-20 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 font-semibold"
                                  />
                                </td>
                                <td className="py-2.5 px-2">
                                  <input
                                    type="number"
                                    key={`${p.id}-price-${stockRow?.priceOverride ?? 'base'}`}
                                    placeholder={String(p.sellingPrice)}
                                    defaultValue={stockRow?.priceOverride ?? ''}
                                    onBlur={e => handleStockChange(p.id, 'priceOverride', e.target.value)}
                                    className="w-24 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
                                  />
                                </td>
                                <td className="py-2.5 px-2 text-right">
                                  <button
                                    type="button"
                                    onClick={() => openTransferForProduct(p.id)}
                                    className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-900/60 rounded-lg transition-colors"
                                    title="Transfer stock of this product to another store"
                                  >
                                    <ArrowRightLeft size={12} />
                                    Transfer
                                  </button>
                                </td>
                              </tr>
                            )
                          })}
                          {filteredProducts.length === 0 && (
                            <tr>
                              <td colSpan={4} className="py-8 text-center text-gray-400">
                                {showAllProducts ? 'No products match your search.' : "This store doesn't carry any products yet — add stock above, or check \"Show all products\"."}
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>

                    {/* Pagination Controls */}
                    {filteredProducts.length > 0 && (
                      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 mt-2 border-t border-gray-100 dark:border-gray-700 text-xs text-gray-500">
                        <div className="flex items-center gap-2">
                          <span>
                            Showing {(stockPage - 1) * stockPageSize + 1}–{Math.min(stockPage * stockPageSize, filteredProducts.length)} of {filteredProducts.length} items
                          </span>
                          <select
                            value={stockPageSize}
                            onChange={e => {
                              setStockPageSize(Number(e.target.value))
                              setStockPage(1)
                            }}
                            className="px-2 py-1 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-xs"
                          >
                            <option value={15}>15 per page</option>
                            <option value={30}>30 per page</option>
                            <option value={50}>50 per page</option>
                            <option value={100}>100 per page</option>
                          </select>
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            disabled={stockPage <= 1}
                            onClick={() => setStockPage(p => Math.max(1, p - 1))}
                            className="p-1.5 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40"
                          >
                            <ChevronLeft size={14} />
                          </button>
                          <span className="px-2 font-medium">
                            Page {stockPage} of {totalStockPages}
                          </span>
                          <button
                            type="button"
                            disabled={stockPage >= totalStockPages}
                            onClick={() => setStockPage(p => Math.min(totalStockPages, p + 1))}
                            className="p-1.5 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40"
                          >
                            <ChevronRight size={14} />
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </>
            )}
          </Card>
        </div>
      )}

      {/* Add/Edit store modal */}
      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editId ? 'Edit Store' : 'Add Store'}>
        <div className="space-y-4">
          <Input
            label="Store name"
            value={formName}
            onChange={e => setFormName(e.target.value)}
            placeholder={locations.length === 0 ? 'e.g. Main Store' : 'e.g. Baner Store'}
          />
          {!editId && (
            <label className="flex items-start gap-2.5 p-3 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-900 cursor-pointer">
              <input
                type="checkbox"
                checked={seedFromCurrentStock}
                onChange={e => setSeedFromCurrentStock(e.target.checked)}
                className="mt-0.5 rounded"
              />
              <span className="text-xs text-gray-700 dark:text-gray-300">
                <span className="font-semibold">Copy my current product stock into this store</span>
                <br />
                {locations.length === 0
                  ? "Recommended — if you added products before creating a store, their existing stock isn't attached to any store yet. Checking this makes this store their real home, so you can switch to it and transfer stock out of it like any other store."
                  : "Starts this store off with the same stock numbers each product currently shows, as a snapshot."}
              </span>
            </label>
          )}
          <Button onClick={handleSave} disabled={isCreating} className="w-full">
            {t('action.save') || 'Save'}
          </Button>
        </div>
      </Modal>

      {/* Stock transfer modal */}
      <Modal isOpen={transferOpen} onClose={() => setTransferOpen(false)} title={t('locations.transfer') || 'Transfer Stock'} size="md">
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
              Select Product *
            </label>
            <div className="relative mb-2">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={transferSearch}
                onChange={e => setTransferSearch(e.target.value)}
                placeholder="Search by name, SKU or barcode..."
                className="w-full pl-8 pr-3 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700"
              />
            </div>
            <div className="max-h-40 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-xl divide-y divide-gray-100 dark:divide-gray-800 bg-gray-50/50 dark:bg-gray-800/50">
              {(products ?? [])
                .filter(p => p.isActive !== false && (
                  !transferSearch.trim() ||
                  p.name.toLowerCase().includes(transferSearch.toLowerCase()) ||
                  p.sku?.toLowerCase().includes(transferSearch.toLowerCase()) ||
                  p.barcode?.toLowerCase().includes(transferSearch.toLowerCase())
                ))
                .slice(0, 25)
                .map(p => {
                  const isSelected = transferProductId === p.id
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setTransferProductId(p.id)}
                      className={`w-full px-3 py-2 text-left flex items-center justify-between transition-colors ${
                        isSelected
                          ? 'bg-blue-600 text-white'
                          : 'hover:bg-blue-50 dark:hover:bg-blue-900/20 text-gray-800 dark:text-gray-200'
                      }`}
                    >
                      <div className="min-w-0 flex-1 pr-2">
                        <p className="text-xs font-semibold truncate">{p.name}</p>
                        <p className={`text-[10px] ${isSelected ? 'text-blue-100' : 'text-gray-400'}`}>
                          {p.sku ? `SKU: ${p.sku}` : ''} {p.barcode ? `• ${p.barcode}` : ''}
                        </p>
                      </div>
                      {isSelected && <Check size={14} className="shrink-0 text-white" />}
                    </button>
                  )
                })}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Source Store (From) *</label>
              <select
                value={transferFromId}
                onChange={e => setTransferFromId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-xs font-semibold"
              >
                <option value="">Select source store</option>
                {locations.filter(l => l.isActive).map(l => (
                  <option key={l.id} value={l.id}>{l.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Destination Store (To) *</label>
              <select
                value={transferToId}
                onChange={e => setTransferToId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-xs font-semibold"
              >
                <option value="">Select destination</option>
                {locations.filter(l => l.isActive).map(l => (
                  <option key={l.id} value={l.id}>{l.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Transfer Quantity *</label>
            <Input
              type="number"
              min="1"
              value={transferQty}
              onChange={e => setTransferQty(e.target.value)}
              placeholder="e.g. 10"
              className="w-full"
            />
          </div>

          <Button
            onClick={handleTransfer}
            disabled={isTransferring || !transferProductId || !transferFromId || !transferToId || !transferQty}
            className="w-full py-2.5 font-bold"
          >
            {isTransferring ? 'Transferring...' : (t('locations.transfer') || 'Transfer Stock')}
          </Button>
        </div>
      </Modal>

      {/* Quick-add a brand-new product, then immediately give it stock at the active store */}
      <QuickAddProductModal
        isOpen={addProductOpen}
        onClose={() => setAddProductOpen(false)}
        onProductCreated={(product) => {
          if (activeLocationId) {
            upsertStock({ productId: product.id, locationId: activeLocationId, data: { stock: 0 } })
          }
          toast.success(`${product.name} added — set its stock here below`)
        }}
      />
    </div>
  )
}
