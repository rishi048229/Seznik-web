import { useEffect, useMemo, useState } from 'react'
import { X, Printer, CreditCard } from 'lucide-react'
import toast from 'react-hot-toast'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { LocationSelector } from '@/components/common/LocationSelector'
import { useProducts } from '@/hooks/useProducts'
import { useCategories } from '@/hooks/useCategories'
import { useLocationStock } from '@/hooks/useLocations'
import { useSettings } from '@/hooks/useSettings'
import { useBlePrinter } from '@/hooks/useBlePrinter'
import {
  useAddKotItems,
  useCreateKotOrder,
  useGenerateKotBill,
  useKotOrder,
  useSendKotToKitchen,
} from '@/hooks/useKotOrders'
import { getChildCategories } from '@/utils/categoryTree'
import { generateReceiptHTML, generateReceiptEscPos, printReceipt, resolveEffectiveReceiptConfig } from '@/utils/receipt'
import { generateKotSlipEscPos, printKotSlip } from '@/utils/kotPrint'
import { MenuPicker } from './MenuPicker'
import { ItemNotesDialog } from './ItemNotesDialog'
import { OrderTicketPanel } from './OrderTicketPanel'
import { KOTBillModal } from './KOTBillModal'
import type { Product } from '@/types/product.types'
import type { Sale } from '@/types/sale.types'
import type { KOTBillResult, KOTDraftItem, KOTOrderItem, KOTOrderType, RestaurantTable } from '@/types/kot.types'
import { mergeKotConfig, orderTypeLabel, ticketTitle } from '../kotConfig'

interface KOTWorkspaceProps {
  table?: RestaurantTable | null
  existingOrderId?: string | null
  initialOrderType?: KOTOrderType
  onClose: () => void
}

const toPayloadItems = (items: KOTDraftItem[]) =>
  items.map((it) => ({
    productId: it.productId,
    productName: it.productName,
    quantity: it.quantity,
    unitPrice: it.unitPrice,
    taxRate: it.taxRate,
    notes: it.notes,
    modifiers: it.modifiers,
  }))

export const KOTWorkspace = ({ table = null, existingOrderId = null, initialOrderType, onClose }: KOTWorkspaceProps) => {
  const { data: products = [], isLoading: productsLoading } = useProducts()
  const { data: categories = [] } = useCategories()
  const { data: settings } = useSettings()
  const blePrinter = useBlePrinter()
  const kotCfg = mergeKotConfig(settings?.kotConfig)

  const [orderId, setOrderId] = useState<string | null>(existingOrderId ?? table?.activeOrder?.id ?? null)
  const [orderType, setOrderType] = useState<KOTOrderType>(
    initialOrderType || (table ? 'dine_in' : kotCfg.defaultOrderType)
  )
  const [locationId, setLocationId] = useState<string | null>(null)
  const [waiterName, setWaiterName] = useState('')
  const [pendingItems, setPendingItems] = useState<KOTDraftItem[]>([])
  const [search, setSearch] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [pickedProduct, setPickedProduct] = useState<Product | null>(null)
  const [itemNotes, setItemNotes] = useState('')
  const [itemMods, setItemMods] = useState<string[]>([])
  const [billOpen, setBillOpen] = useState(false)
  const [customerId, setCustomerId] = useState('')
  const [mobileTab, setMobileTab] = useState<'menu' | 'ticket'>('menu')

  const { data: order, isLoading: orderLoading } = useKotOrder(orderId)
  const { data: locationStockRows = [] } = useLocationStock(locationId)
  const { mutateAsync: createOrder, isPending: isCreating } = useCreateKotOrder()
  const { mutateAsync: addItems, isPending: isAdding } = useAddKotItems()
  const { mutateAsync: sendKitchen, isPending: isSending } = useSendKotToKitchen()
  const { mutate: generateBill, isPending: isBilling } = useGenerateKotBill()

  useEffect(() => {
    if (order?.waiterName && !waiterName) setWaiterName(order.waiterName)
    if (order?.customerId && !customerId) setCustomerId(order.customerId)
    if (order?.orderType === 'dine_in' || order?.orderType === 'takeaway' || order?.orderType === 'delivery') {
      setOrderType(order.orderType)
    }
  }, [order, waiterName, customerId])

  const locationStockMap = useMemo(() => {
    const map = new Map<string, { stock: number; priceOverride?: number | null }>()
    for (const row of locationStockRows) {
      map.set(row.productId, { stock: row.stock, priceOverride: row.priceOverride })
    }
    return map
  }, [locationStockRows])

  const stockFor = (product: Product) => {
    if (!locationId) return product.currentStock
    return locationStockMap.get(product.id)?.stock ?? 0
  }

  const priceFor = (product: Product) => {
    if (!locationId) return product.sellingPrice
    return locationStockMap.get(product.id)?.priceOverride ?? product.sellingPrice
  }

  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase()
    const childIds = categoryId ? getChildCategories(categories, categoryId).map((c) => c.id) : []
    return products.filter((p) => {
      if (!p.isActive) return false
      if (locationId && !locationStockMap.has(p.id)) return false
      const matchesCategory = !categoryId || p.categoryId === categoryId || childIds.includes(p.categoryId)
      const matchesSearch = !q || p.name.toLowerCase().includes(q) || (p.barcode ?? '').toLowerCase().includes(q)
      return matchesCategory && matchesSearch
    })
  }, [products, search, categoryId, categories, locationId, locationStockMap])

  const sentItems = (order?.items ?? []).filter((it) => !!it.sentToKitchenAt)
  const unprintedServerItems = (order?.items ?? []).filter((it) => !it.sentToKitchenAt)

  const totals = useMemo(() => {
    const all = [
      ...(order?.items ?? []).map((it) => ({ qty: it.quantity, price: it.unitPrice, tax: it.taxRate })),
      ...pendingItems.map((it) => ({ qty: it.quantity, price: it.unitPrice, tax: it.taxRate })),
    ]
    const subtotal = all.reduce((s, it) => s + it.price * it.qty, 0)
    const tax = all.reduce((s, it) => s + (it.price * it.qty * (it.tax || 0)) / 100, 0)
    return { subtotal, tax, grandTotal: subtotal + tax }
  }, [order?.items, pendingItems])

  const busy = isCreating || isAdding || isSending
  const displayName = ticketTitle(table?.name, orderType)

  const startOrderPayload = (items: KOTDraftItem[]) => ({
    orderType,
    tableId: table?.id,
    partyLabel: table?.name || orderTypeLabel(orderType),
    waiterName: waiterName.trim() || undefined,
    locationId: locationId || undefined,
    status: 'open' as const,
    items: toPayloadItems(items),
  })

  const confirmAddItem = async () => {
    if (!pickedProduct) return
    const draft: KOTDraftItem = {
      tempId: crypto.randomUUID(),
      productId: pickedProduct.id,
      productName: pickedProduct.name,
      quantity: 1,
      unitPrice: priceFor(pickedProduct),
      taxRate: pickedProduct.taxRate || 0,
      notes: itemNotes.trim() || undefined,
      modifiers: [...itemMods],
      imageURL: pickedProduct.imageURL,
    }

    setPickedProduct(null)
    setItemNotes('')
    setItemMods([])
    setMobileTab('ticket')

    if (!orderId) {
      try {
        const created = await createOrder(startOrderPayload([draft]))
        setOrderId(created.id)
        toast.success('Order started')
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to start order')
      }
      return
    }

    setPendingItems((prev) => {
      const match = prev.find(
        (it) =>
          it.productId === draft.productId &&
          (it.notes || '') === (draft.notes || '') &&
          it.modifiers.join('|') === draft.modifiers.join('|')
      )
      if (!match) return [...prev, draft]
      return prev.map((it) => (it.tempId === match.tempId ? { ...it, quantity: it.quantity + 1 } : it))
    })
  }

  const persistPending = async (currentOrderId: string) => {
    if (pendingItems.length === 0) return
    await addItems({ id: currentOrderId, items: toPayloadItems(pendingItems) })
    setPendingItems([])
  }

  const printKitchen = async (items: KOTOrderItem[], orderNumber: number, waiter: string | null | undefined) => {
    if (items.length === 0) return
    const slip = {
      orderNumber,
      tableName: displayName,
      orderType,
      waiterName: waiter || waiterName,
      showWaiter: kotCfg.showWaiterOnSlip,
      slipTitle: kotCfg.kotSlipTitle,
      orderTime: new Date(),
      notes: order?.notes,
      priority: order?.priority,
      items: items.map((it) => ({
        productName: it.productName,
        quantity: it.quantity,
        notes: it.notes,
        modifiers: it.modifiers,
      })),
    }
    const paperSize = settings?.printerConfig?.paperSize || '58mm'
    const htmlWidth: '50mm' | '80mm' = paperSize === '80mm' ? '80mm' : '50mm'
    const useBle = settings?.printerConfig?.connectionType === 'bluetooth'

    if (useBle) {
      try {
        if (blePrinter.status !== 'connected') await blePrinter.connect()
        await blePrinter.print(generateKotSlipEscPos(slip, paperSize))
        toast.success('KOT sent to printer')
        return
      } catch (err) {
        console.error(err)
        toast.error('Bluetooth print failed — opening browser print')
      }
    }
    printKotSlip(slip, htmlWidth)
  }

  const handleSendToKitchen = async () => {
    try {
      let id = orderId
      if (!id) {
        if (pendingItems.length === 0) {
          toast.error('Add items first')
          return
        }
        const created = await createOrder(startOrderPayload(pendingItems))
        id = created.id
        setOrderId(id)
        setPendingItems([])
      } else if (pendingItems.length > 0) {
        await persistPending(id)
      }

      const result = await sendKitchen({
        id,
        waiterName: waiterName.trim() || undefined,
        locationId: locationId || undefined,
      })
      const toPrint = result.newlySentItems?.length ? result.newlySentItems : result.items.filter((it) => !it.sentToKitchenAt)
      await printKitchen(toPrint.length ? toPrint : result.items, result.orderNumber, result.waiterName)
      toast.success('Sent to kitchen')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to send to kitchen')
    }
  }

  const printCustomerReceipt = async (saleRaw: KOTBillResult['sale']) => {
    const items = Array.isArray(saleRaw.items)
      ? (saleRaw.items as Array<Record<string, number | string>>).map((it) => ({
          productId: typeof it.productId === 'string' ? it.productId : undefined,
          productName: String(it.productName ?? 'Item'),
          quantity: Number(it.quantity) || 0,
          sellingPrice: Number(it.sellingPrice ?? it.unitPrice) || 0,
          discount: Number(it.discount) || 0,
          taxRate: Number(it.taxRate) || 0,
          taxAmount: Number(it.taxAmount) || 0,
          total: Number(it.total) || 0,
        }))
      : []

    const sale: Sale = {
      id: String(saleRaw.id ?? ''),
      invoiceNumber: String(saleRaw.invoiceNumber ?? ''),
      customerId: saleRaw.customerId ? String(saleRaw.customerId) : undefined,
      items,
      subtotal: Number(saleRaw.subtotal) || 0,
      totalDiscount: Number(saleRaw.totalDiscount) || 0,
      totalTax: Number(saleRaw.totalTax) || 0,
      grandTotal: Number(saleRaw.grandTotal) || 0,
      paymentMethod: (saleRaw.paymentMethod as Sale['paymentMethod']) || 'cash',
      amountPaid: Number(saleRaw.amountPaid) || 0,
      changeReturned: Number(saleRaw.changeReturned) || 0,
      isQuickBill: false,
      createdAt: String(saleRaw.createdAt ?? new Date().toISOString()),
    }

    const receiptConfig = resolveEffectiveReceiptConfig(settings)
    const paperSize = settings?.printerConfig?.paperSize || '58mm'
    const htmlWidth: '50mm' | '80mm' = paperSize === '80mm' ? '80mm' : '50mm'
    const useBle = settings?.printerConfig?.connectionType === 'bluetooth'

    if (useBle) {
      try {
        if (blePrinter.status !== 'connected') await blePrinter.connect()
        const bytes = await generateReceiptEscPos({
          sale,
          receiptConfig,
          paperSize,
          businessName: settings?.businessName,
          businessAddress: settings?.businessAddress,
        })
        await blePrinter.print(bytes)
        toast.success('Receipt printed')
        return
      } catch (err) {
        console.error(err)
        toast.error('Bluetooth print failed — opening browser print')
      }
    }

    const html = generateReceiptHTML({
      sale,
      receiptConfig,
      businessName: settings?.businessName,
      businessAddress: settings?.businessAddress,
      width: htmlWidth,
      logoURL: settings?.businessLogoURL || receiptConfig.logoURL,
    })
    printReceipt(html, htmlWidth, sale.invoiceNumber)
  }

  const handleSettle = async () => {
    try {
      let id = orderId
      if (!id) {
        if (pendingItems.length === 0) {
          toast.error('Add items first')
          return
        }
        const created = await createOrder(startOrderPayload(pendingItems))
        id = created.id
        setOrderId(id)
        setPendingItems([])
      } else if (pendingItems.length > 0) {
        await persistPending(id)
      }
      setBillOpen(true)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to prepare bill')
    }
  }

  const hasNewItems = pendingItems.length > 0 || unprintedServerItems.length > 0
  const hasAnyItems = hasNewItems || sentItems.length > 0

  return (
    <div className="fixed inset-0 z-50 bg-gray-50 dark:bg-gray-900 flex flex-col">
      <header className="shrink-0 flex items-center justify-between gap-2 sm:gap-3 px-3 sm:px-5 py-2.5 sm:py-3 border-b border-gray-200 dark:border-gray-700 bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl">
        <div className="min-w-0">
          <p className="text-xs text-gray-500 dark:text-gray-400">{orderTypeLabel(orderType)} bill</p>
          <h1 className="text-base sm:text-lg font-bold text-gray-900 dark:text-gray-100 truncate">{displayName}</h1>
        </div>
        <div className="flex-1 flex justify-end min-w-0 overflow-x-auto no-scrollbar">
          <LocationSelector onChange={setLocationId} />
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
          aria-label="Close"
        >
          <X size={20} />
        </button>
      </header>

      <div className="sm:hidden flex border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <button
          type="button"
          onClick={() => setMobileTab('menu')}
          className={`flex-1 py-2.5 text-sm font-semibold ${mobileTab === 'menu' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500'}`}
        >
          Menu
        </button>
        <button
          type="button"
          onClick={() => setMobileTab('ticket')}
          className={`flex-1 py-2.5 text-sm font-semibold ${mobileTab === 'ticket' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500'}`}
        >
          Ticket{hasAnyItems ? ` (${sentItems.length + unprintedServerItems.length + pendingItems.length})` : ''}
        </button>
      </div>

      <div className="flex-1 min-h-0 flex">
        <div className={`flex-1 min-w-0 min-h-0 ${mobileTab === 'ticket' ? 'hidden sm:flex sm:flex-col' : 'flex flex-col'}`}>
          {productsLoading ? (
            <div className="flex justify-center py-16">
              <Spinner size="lg" />
            </div>
          ) : (
            <MenuPicker
              products={filteredProducts}
              categories={categories}
              search={search}
              onSearchChange={setSearch}
              categoryId={categoryId}
              onCategoryChange={setCategoryId}
              stockFor={stockFor}
              onPick={(p) => {
                setPickedProduct(p)
                setItemNotes('')
                setItemMods([])
              }}
            />
          )}
        </div>

        <div
          className={`w-full sm:w-[380px] lg:w-[420px] shrink-0 border-l border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex flex-col min-h-0 ${
            mobileTab === 'menu' ? 'hidden sm:flex' : 'flex'
          }`}
        >
          {orderLoading && orderId ? (
            <div className="flex justify-center py-16">
              <Spinner />
            </div>
          ) : (
            <OrderTicketPanel
              tableName={displayName}
              orderNumber={order?.orderNumber}
              orderType={orderType}
              onOrderTypeChange={setOrderType}
              waiterName={waiterName}
              onWaiterChange={setWaiterName}
              sentItems={sentItems}
              unprintedServerItems={unprintedServerItems}
              pendingItems={pendingItems}
              onPendingQty={(tempId, qty) => {
                if (qty <= 0) {
                  setPendingItems((prev) => prev.filter((it) => it.tempId !== tempId))
                  return
                }
                setPendingItems((prev) => prev.map((it) => (it.tempId === tempId ? { ...it, quantity: qty } : it)))
              }}
              onRemovePending={(tempId) => setPendingItems((prev) => prev.filter((it) => it.tempId !== tempId))}
              subtotal={totals.subtotal}
              tax={totals.tax}
              grandTotal={totals.grandTotal}
            />
          )}

          <div className="shrink-0 p-3 border-t border-gray-200 dark:border-gray-700 space-y-2 pb-16 sm:pb-3">
            <Button
              onClick={handleSendToKitchen}
              disabled={!hasNewItems || busy}
              loading={isSending || isAdding || isCreating}
              className="w-full"
              variant="secondary"
            >
              <Printer size={16} className="mr-2" />
              Send to Kitchen / Print KOT
            </Button>
            <Button
              onClick={handleSettle}
              disabled={!hasAnyItems || busy}
              className="w-full bg-[#0a0a2e] hover:bg-[#1a1555]"
            >
              <CreditCard size={16} className="mr-2" />
              Settle Bill
            </Button>
          </div>
        </div>
      </div>

      <ItemNotesDialog
        isOpen={!!pickedProduct}
        product={pickedProduct}
        notes={itemNotes}
        modifiers={itemMods}
        onNotesChange={setItemNotes}
        onToggleModifier={(mod) =>
          setItemMods((prev) => (prev.includes(mod) ? prev.filter((m) => m !== mod) : [...prev, mod]))
        }
        onCancel={() => setPickedProduct(null)}
        onConfirm={confirmAddItem}
      />

      <KOTBillModal
        isOpen={billOpen}
        onClose={() => setBillOpen(false)}
        subtotal={totals.subtotal}
        itemTax={totals.tax}
        orderType={orderType}
        onOrderTypeChange={setOrderType}
        customerId={customerId}
        onCustomerChange={setCustomerId}
        loading={isBilling}
        onSettle={(payload) => {
          if (!orderId) return
          generateBill(
            { id: orderId, data: payload },
            {
              onSuccess: async (result) => {
                toast.success('Bill settled')
                setBillOpen(false)
                try {
                  await printCustomerReceipt(result.sale)
                } catch (err) {
                  console.error(err)
                }
                onClose()
              },
              onError: (err) => toast.error(err instanceof Error ? err.message : 'Failed to settle bill'),
            }
          )
        }}
      />
    </div>
  )
}
