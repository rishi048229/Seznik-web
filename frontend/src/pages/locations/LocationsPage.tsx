import { useState } from 'react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { Switch } from '@/components/ui/Switch'
import { EmptyState } from '@/components/ui/EmptyState'
import { TableSkeleton } from '@/components/ui/TableSkeleton'
import {
  useLocations, useCreateLocation, useUpdateLocation, useDeleteLocation, useToggleLocationActive,
  useLocationStock, useUpsertProductLocationStock, useCreateStockTransfer, useStockTransfers,
} from '@/hooks/useLocations'
import { useSettings, useUpdateSettings, useCreateSettings } from '@/hooks/useSettings'
import { useProducts } from '@/hooks/useProducts'
import { formatINR } from '@/utils/currency'
import { useLanguage } from '@/contexts/LanguageContext'
import { Warehouse, Plus, Pencil, Trash2, ArrowRightLeft, Package, Search } from 'lucide-react'
import toast from 'react-hot-toast'
import type { Location } from '@/types/location.types'

export const LocationsPage = () => {
  const { t } = useLanguage()
  const { data: settings } = useSettings()
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

  const [activeLocationId, setActiveLocationId] = useState<string | null>(null)
  const [stockSearch, setStockSearch] = useState('')
  const [transferOpen, setTransferOpen] = useState(false)
  const [transferProductId, setTransferProductId] = useState('')
  const [transferFromId, setTransferFromId] = useState('')
  const [transferToId, setTransferToId] = useState('')
  const [transferQty, setTransferQty] = useState('')

  const { data: locationStock = [], isLoading: isStockLoading } = useLocationStock(activeLocationId)
  const { mutate: upsertStock } = useUpsertProductLocationStock()
  const { mutate: createTransfer, isPending: isTransferring } = useCreateStockTransfer()
  const { data: transfers = [] } = useStockTransfers()

  const enabled = settings?.locationConfig?.enabled ?? false

  const toggleFeature = (v: boolean) => {
    if (settings?.id) {
      updateSettings(
        { settingsId: settings.id, data: { locationConfig: { enabled: v } } },
        { onError: () => toast.error('Failed to save setting') }
      )
    } else {
      createSettings(
        { ...(settings as any), locationConfig: { enabled: v } },
        { onError: () => toast.error('Failed to save setting') }
      )
    }
  }

  const openCreate = () => {
    setEditId(null)
    setFormName('')
    setModalOpen(true)
  }

  const openEdit = (loc: Location) => {
    setEditId(loc.id)
    setFormName(loc.name)
    setModalOpen(true)
  }

  const handleSave = () => {
    if (!formName.trim()) {
      toast.error('Location name is required')
      return
    }
    if (editId) {
      updateLocation({ locationId: editId, name: formName.trim() }, {
        onSuccess: () => { toast.success('Location updated'); setModalOpen(false) },
        onError: () => toast.error('Failed to update location'),
      })
    } else {
      createLocation({ name: formName.trim(), sortOrder: locations.length }, {
        onSuccess: () => { toast.success('Location added'); setModalOpen(false) },
        onError: () => toast.error('Failed to add location'),
      })
    }
  }

  const handleDelete = (loc: Location) => {
    if (!confirm(`Delete "${loc.name}"? Its stock records will be removed too.`)) return
    deleteLocation(loc.id, {
      onSuccess: () => {
        toast.success('Location deleted')
        if (activeLocationId === loc.id) setActiveLocationId(null)
      },
      onError: () => toast.error('Failed to delete location — it may still have stock or sales history'),
    })
  }

  const activeLocation = locations.find(l => l.id === activeLocationId)
  const stockByProductId = new Map(locationStock.map(s => [s.productId, s]))
  const filteredProducts = (products ?? []).filter(p =>
    p.isActive !== false && p.name.toLowerCase().includes(stockSearch.toLowerCase())
  )

  const handleStockChange = (productId: string, field: 'stock' | 'priceOverride', value: string) => {
    if (!activeLocationId) return
    const numValue = value === '' ? (field === 'priceOverride' ? null : 0) : Number(value)
    upsertStock({ productId, locationId: activeLocationId, data: { [field]: numValue } })
  }

  const handleTransfer = () => {
    const qty = Number(transferQty)
    if (!transferProductId || !transferFromId || !transferToId || !qty || qty <= 0) {
      toast.error('Fill in product, both locations, and a positive quantity')
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
          setTransferProductId(''); setTransferQty('')
        },
        onError: (err: any) => toast.error(err?.message || 'Transfer failed'),
      }
    )
  }

  return (
    <div>
      <PageHeader
        title={t('page.locations') || 'Locations'}
        action={
          <Button onClick={openCreate} className="flex items-center gap-2">
            <Plus size={16} /> {t('locations.addLocation') || 'Add Location'}
          </Button>
        }
      />

      {/* Feature toggle */}
      <Card className="p-5 mb-6">
        <Switch
          checked={enabled}
          onChange={toggleFeature}
          label={t('locations.enableFeature') || 'Enable Multi-Location Inventory'}
          description={
            t('locations.enableFeatureDesc') ||
            'Track separate stock and (optionally) separate prices per warehouse/shop. When off, billing behaves exactly as a single-location install.'
          }
        />
      </Card>

      {!enabled ? (
        <EmptyState
          icon={<Warehouse size={40} />}
          title={t('locations.disabledTitle') || 'Multi-location inventory is off'}
          description={t('locations.disabledDesc') || 'Turn it on above to start adding locations like "Warehouse" and "Shop".'}
        />
      ) : isLoading ? (
        <TableSkeleton rows={3} columns={3} />
      ) : locations.length === 0 ? (
        <EmptyState
          icon={<Warehouse size={40} />}
          title={t('locations.emptyTitle') || 'No locations yet'}
          description={t('locations.emptyDesc') || 'Add your first two locations, e.g. "Warehouse" and "Shop".'}
          action={<Button onClick={openCreate}><Plus size={16} className="mr-1.5" />{t('locations.addLocation') || 'Add Location'}</Button>}
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Location list */}
          <Card className="p-4 lg:col-span-1 h-fit">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-sm text-gray-900 dark:text-gray-100">{t('locations.allLocations') || 'Locations'}</h3>
              <Button size="sm" variant="secondary" onClick={() => setTransferOpen(true)}>
                <ArrowRightLeft size={14} className="mr-1" /> {t('locations.transfer') || 'Transfer'}
              </Button>
            </div>
            <div className="space-y-2">
              {locations.map(loc => (
                <div
                  key={loc.id}
                  onClick={() => setActiveLocationId(loc.id)}
                  className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-colors ${
                    activeLocationId === loc.id
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                      : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                  } ${!loc.isActive ? 'opacity-50' : ''}`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Warehouse size={16} className="text-gray-400 shrink-0" />
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

          {/* Stock table for the selected location */}
          <Card className="p-4 lg:col-span-2">
            {!activeLocation ? (
              <EmptyState icon={<Package size={32} />} title={t('locations.selectPrompt') || 'Select a location to view/edit its stock'} description="" />
            ) : (
              <>
                <div className="flex items-center justify-between mb-3 gap-3">
                  <h3 className="font-semibold text-sm text-gray-900 dark:text-gray-100">{activeLocation.name} — {t('locations.stock') || 'Stock'}</h3>
                  <div className="relative w-48">
                    <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      value={stockSearch}
                      onChange={e => setStockSearch(e.target.value)}
                      placeholder={t('common.search') || 'Search...'}
                      className="w-full pl-8 pr-2 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
                    />
                  </div>
                </div>
                {isStockLoading ? (
                  <TableSkeleton rows={4} columns={3} />
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="text-[10px] uppercase tracking-wider text-gray-400 border-b border-gray-100 dark:border-gray-700">
                          <th className="py-2 pr-2">{t('common.product') || 'Product'}</th>
                          <th className="py-2 px-2">{t('locations.stockAtLocation') || 'Stock here'}</th>
                          <th className="py-2 px-2">{t('locations.priceOverride') || 'Price override'}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                        {filteredProducts.map(p => {
                          const stockRow = stockByProductId.get(p.id)
                          return (
                            <tr key={p.id}>
                              <td className="py-2 pr-2">
                                <p className="font-medium text-gray-900 dark:text-gray-100">{p.name}</p>
                                <p className="text-[10px] text-gray-400">Base: {formatINR(p.sellingPrice)}</p>
                              </td>
                              <td className="py-2 px-2">
                                <input
                                  type="number"
                                  defaultValue={stockRow?.stock ?? 0}
                                  onBlur={e => handleStockChange(p.id, 'stock', e.target.value)}
                                  className="w-20 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
                                />
                              </td>
                              <td className="py-2 px-2">
                                <input
                                  type="number"
                                  placeholder={String(p.sellingPrice)}
                                  defaultValue={stockRow?.priceOverride ?? ''}
                                  onBlur={e => handleStockChange(p.id, 'priceOverride', e.target.value)}
                                  className="w-24 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
                                />
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
          </Card>
        </div>
      )}

      {/* Add/Edit location modal */}
      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editId ? 'Edit Location' : 'Add Location'}>
        <div className="space-y-4">
          <Input
            label="Location name"
            value={formName}
            onChange={e => setFormName(e.target.value)}
            placeholder="e.g. Main Warehouse"
          />
          <Button onClick={handleSave} disabled={isCreating} className="w-full">
            {t('action.save') || 'Save'}
          </Button>
        </div>
      </Modal>

      {/* Stock transfer modal */}
      <Modal isOpen={transferOpen} onClose={() => setTransferOpen(false)} title={t('locations.transfer') || 'Transfer Stock'}>
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">{t('common.product') || 'Product'}</label>
            <select
              value={transferProductId}
              onChange={e => setTransferProductId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-sm"
            >
              <option value="">Select product</option>
              {(products ?? []).filter(p => p.isActive !== false).map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">From</label>
              <select value={transferFromId} onChange={e => setTransferFromId(e.target.value)} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-sm">
                <option value="">Select</option>
                {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">To</label>
              <select value={transferToId} onChange={e => setTransferToId(e.target.value)} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-sm">
                <option value="">Select</option>
                {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            </div>
          </div>
          <Input label="Quantity" type="number" value={transferQty} onChange={e => setTransferQty(e.target.value)} />
          <Button onClick={handleTransfer} disabled={isTransferring} className="w-full">
            {t('locations.transfer') || 'Transfer'}
          </Button>
        </div>
      </Modal>
    </div>
  )
}
