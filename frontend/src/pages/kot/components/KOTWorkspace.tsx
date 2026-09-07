import { useEffect, useMemo, useState, useDeferredValue } from 'react'
import { X, Printer, CreditCard, Plus } from 'lucide-react'
import toast from 'react-hot-toast'
import { toastError } from '@/utils/userMessage'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Spinner } from '@/components/ui/Spinner'
import { LocationSelector } from '@/components/common/LocationSelector'
import { BleConnectButton } from '@/components/common/BleConnectButton'
import { useProducts, useUpdateProduct } from '@/hooks/useProducts'
import { useCategories } from '@/hooks/useCategories'
import { useLocationStock } from '@/hooks/useLocations'
import { useSettings, useUpdateSettings, useCreateSettings } from '@/hooks/useSettings'
import { useBlePrinter } from '@/hooks/useBlePrinter'
import {
  useAddKotItems,
  useCreateKotOrder,
  useEditKotOrder,
  useGenerateKotBill,
  useKotOrder,
  useKotOrders,
  useSendKotToKitchen,
  useUpdateKotStatus,
} from '@/hooks/useKotOrders'
import { getChildCategories } from '@/utils/categoryTree'
import { isProductAvailable } from '@/utils/businessFeatures'
import { roundCurrency } from '@/utils/currency'
import { resolveEffectiveReceiptConfig } from '@/utils/receipt'
import { printKotDeltaSlipSmart, printKotSlipSmart } from '@/utils/kotPrint'
import { generateRestaurantBillEscPos, printRestaurantBill } from '@/utils/restaurantBill'
import { shouldPrintThermalOverBle } from '@/utils/printTarget'
import { MenuPicker } from './MenuPicker'
import { ItemNotesDialog } from './ItemNotesDialog'
import { OrderTicketPanel } from './OrderTicketPanel'
import { KOTBillModal } from './KOTBillModal'
import { AddFoodItemModal } from './AddFoodItemModal'
import type { Product } from '@/types/product.types'
import type { Sale } from '@/types/sale.types'
import type {
  KOTBillResult,
  KOTDeltaChange,
  KOTDraftItem,
  KOTOrderItem,
  KOTOrderStatus,
  KOTOrderType,
  RestaurantTable,
} from '@/types/kot.types'
import { mergeKotConfig, orderTypeLabel, ticketTitle } from '../kotConfig'
import { ticketLaneLabel } from '../kotUtils'

const LAST_WAITER_KEY = 'kot_last_waiter'

const VOID_REASONS = [
  'Guest cancelled',
  'Kitchen mistake / duplicate',
  'Item out of stock',
  'Preparation delay',
  'Wrong item entered',
  'Other / Guest request',
] as const

const STATUS_PIPELINE: Array<{ id: KOTOrderStatus; label: string }> = [
  { id: 'open', label: 'Open' },
  { id: 'sent_to_kitchen', label: 'Sent' },
  { id: 'preparing', label: 'Preparing' },
  { id: 'ready', label: 'Ready' },
  { id: 'served', label: 'Served' },
]

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
  const { mutateAsync: updateProduct } = useUpdateProduct()
  const { data: categories = [] } = useCategories()
  const { data: settings } = useSettings()
  const { mutate: updateSettings } = useUpdateSettings()
  const { mutate: createSettings } = useCreateSettings()
  const blePrinter = useBlePrinter()
  const kotCfg = mergeKotConfig(settings?.kotConfig)

  const [orderId, setOrderId] = useState<string | null>(existingOrderId ?? table?.activeOrder?.id ?? null)
  const [orderType, setOrderType] = useState<KOTOrderType>(
    initialOrderType || (table && kotCfg.allowedOrderTypes.includes('dine_in') ? 'dine_in' : kotCfg.defaultOrderType)
  )
  const [locationId, setLocationId] = useState<string | null>(null)
  const [waiterName, setWaiterName] = useState(() => {
    try {
      return localStorage.getItem(LAST_WAITER_KEY) || ''
    } catch {
      return ''
    }
  })
  const [pendingItems, setPendingItems] = useState<KOTDraftItem[]>([])
  const [search, setSearch] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [showUnavailable, setShowUnavailable] = useState(false)
  const [pickedProduct, setPickedProduct] = useState<Product | null>(null)
  const [itemNotes, setItemNotes] = useState('')
  const [itemMods, setItemMods] = useState<string[]>([])
  const [billOpen, setBillOpen] = useState(false)
  const [customerId, setCustomerId] = useState('')
  const [mobileTab, setMobileTab] = useState<'menu' | 'ticket'>('menu')
  const [itemQuantities, setItemQuantities] = useState<Record<string, number>>({})
  const [itemNotesDraft, setItemNotesDraft] = useState<Record<string, string>>({})
  const [voidedItems, setVoidedItems] = useState<Record<string, string>>({})
  const [voidingItemId, setVoidingItemId] = useState<string | null>(null)
  const [selectedVoidReason, setSelectedVoidReason] = useState<string>(VOID_REASONS[0])
  const [customVoidReason, setCustomVoidReason] = useState('')
  const [addFoodOpen, setAddFoodOpen] = useState(false)

  const { data: order, isLoading: orderLoading } = useKotOrder(orderId)
  const { data: runningOrders = [] } = useKotOrders({
    status: 'running',
    refetchInterval: 30_000,
    staleTime: 15_000,
  })
  const { data: locationStockRows = [] } = useLocationStock(locationId)
  const { mutateAsync: createOrder, isPending: isCreating } = useCreateKotOrder()
  const { mutateAsync: addItems, isPending: isAdding } = useAddKotItems()
  const { mutateAsync: sendKitchen, isPending: isSending } = useSendKotToKitchen()
  const { mutateAsync: editOrder, isPending: isEditing } = useEditKotOrder()
  const { mutateAsync: updateStatus, isPending: isUpdatingStatus } = useUpdateKotStatus()
  const { mutate: generateBill, isPending: isBilling } = useGenerateKotBill()
  const deferredSearch = useDeferredValue(search)

  const persistKotConfig = (next: typeof kotCfg, ok?: string) => {
    const data = { kotConfig: next }
    const onSuccess = () => {
      if (ok) toast.success(ok)
    }
    const onError = (err: unknown) => toastError(err, 'Could not save. Please try again.')
    if (settings?.id) {
      updateSettings({ settingsId: settings.id, data }, { onSuccess, onError })
      return
    }
    createSettings(data as Parameters<typeof createSettings>[0], { onSuccess, onError })
  }

  useEffect(() => {
    if (order?.waiterName) setWaiterName(order.waiterName)
    if (order?.customerId) setCustomerId(order.customerId)
    if (order?.orderType === 'dine_in' || order?.orderType === 'takeaway' || order?.orderType === 'delivery') {
      setOrderType(order.orderType)
    }
  }, [order?.id, order?.waiterName, order?.customerId, order?.orderType])

  useEffect(() => {
    if (!order) {
      setItemQuantities({})
      setItemNotesDraft({})
      setVoidedItems({})
      return
    }
    const qMap: Record<string, number> = {}
    const nMap: Record<string, string> = {}
    const vMap: Record<string, string> = {}
    order.items.forEach((it) => {
      qMap[it.id] = it.quantity
      nMap[it.id] = it.notes || ''
      if (it.status === 'voided') {
        vMap[it.id] = it.notes?.replace(/^\[VOID:?\s*|\]/gi, '') || 'Voided'
      }
    })
    setItemQuantities(qMap)
    setItemNotesDraft(nMap)
    setVoidedItems(vMap)
    setPendingItems([])
  }, [order?.id, order?.updatedAt])

  useEffect(() => {
    const trimmed = waiterName.trim()
    if (!trimmed) return
    try {
      localStorage.setItem(LAST_WAITER_KEY, trimmed)
    } catch {
      /* ignore */
    }
  }, [waiterName])

  useEffect(() => {
    if (orderId) return
    if (!kotCfg.allowedOrderTypes.includes(orderType)) {
      setOrderType(kotCfg.defaultOrderType)
    }
  }, [orderId, kotCfg.allowedOrderTypes, kotCfg.defaultOrderType, orderType])

  const locationStockMap = useMemo(() => {
    const map = new Map<string, { stock: number; priceOverride?: number | null }>()
    for (const row of locationStockRows) {
      map.set(row.productId, { stock: row.stock, priceOverride: row.priceOverride })
    }
    return map
  }, [locationStockRows])

  const priceFor = (product: Product) => {
    if (!locationId) return product.sellingPrice
    return locationStockMap.get(product.id)?.priceOverride ?? product.sellingPrice
  }

  const filteredProducts = useMemo(() => {
    const q = deferredSearch.trim().toLowerCase()
    const childIds = categoryId ? getChildCategories(categories, categoryId).map((c) => c.id) : []
    return products.filter((p) => {
      // Soft-deleted stay off the menu; availability is isAvailable (legacy isActive fallback)
      if (p.isActive === false) return false
      const matchesAvailability = showUnavailable ? !isProductAvailable(p) : isProductAvailable(p)
      const matchesCategory = !categoryId || p.categoryId === categoryId || childIds.includes(p.categoryId)
      const matchesSearch = !q || p.name.toLowerCase().includes(q) || (p.barcode ?? '').toLowerCase().includes(q)
      return matchesAvailability && matchesCategory && matchesSearch
    })
  }, [products, deferredSearch, categoryId, categories, showUnavailable])

  const handleToggleAvailability = async (product: Product, nextActive: boolean) => {
    try {
      await updateProduct({ productId: product.id, data: { isAvailable: nextActive } })
      toast.success(nextActive ? `"${product.name}" is available again` : `"${product.name}" marked not available`)
      if (!nextActive) {
        setPendingItems((prev) => prev.filter((it) => it.productId !== product.id))
      }
    } catch (err) {
      toastError(err, 'Could not update menu item')
    }
  }

  const kitchenSentItems = (order?.items ?? []).filter((it) => !!it.sentToKitchenAt)
  const unprintedServerItems = (order?.items ?? []).filter(
    (it) => !it.sentToKitchenAt && it.status !== 'voided'
  )

  const deltaChanges = useMemo((): KOTDeltaChange[] => {
    if (!order) {
      return pendingItems.map((it) => ({
        type: 'new' as const,
        productName: it.productName,
        quantity: it.quantity,
        notes: it.notes,
      }))
    }
    const changes: KOTDeltaChange[] = []
    pendingItems.forEach((newItem) => {
      changes.push({
        type: 'new',
        productName: newItem.productName,
        quantity: newItem.quantity,
        notes: newItem.notes,
      })
    })
    order.items.forEach((orig) => {
      if (orig.status !== 'voided' && voidedItems[orig.id]) {
        changes.push({
          type: 'void',
          productName: orig.productName,
          quantity: itemQuantities[orig.id] ?? orig.quantity,
          reason: voidedItems[orig.id],
        })
      }
    })
    order.items.forEach((orig) => {
      if (orig.status !== 'voided' && !voidedItems[orig.id]) {
        const currentQty = itemQuantities[orig.id] ?? orig.quantity
        const currentNote = itemNotesDraft[orig.id] ?? (orig.notes || '')
        if (currentQty !== orig.quantity || currentNote !== (orig.notes || '')) {
          changes.push({
            type: 'qty_change',
            productName: orig.productName,
            quantity: currentQty,
            oldQuantity: orig.quantity,
            notes: currentNote,
          })
        }
      }
    })
    return changes
  }, [order, pendingItems, voidedItems, itemQuantities, itemNotesDraft])

  const totals = useMemo(() => {
    const billableExisting = (order?.items ?? [])
      .filter((it) => it.status !== 'voided' && !voidedItems[it.id])
      .map((it) => ({
        qty: itemQuantities[it.id] ?? it.quantity,
        price: it.unitPrice,
        tax: it.taxRate,
      }))
    const all = [
      ...billableExisting,
      ...pendingItems.map((it) => ({ qty: it.quantity, price: it.unitPrice, tax: it.taxRate })),
    ]
    const rawSubtotal = all.reduce((s, it) => s + it.price * it.qty, 0)
    const rawTax = all.reduce((s, it) => s + (it.price * it.qty * (it.tax || 0)) / 100, 0)
    const subtotal = roundCurrency(rawSubtotal)
    const tax = roundCurrency(rawTax)
    return { subtotal, tax, grandTotal: roundCurrency(subtotal + tax) }
  }, [order?.items, pendingItems, voidedItems, itemQuantities])

  const busy = isCreating || isAdding || isSending || isEditing || isUpdatingStatus
  const displayName = ticketTitle(order?.table?.name || order?.partyLabel || table?.name, orderType)

  const openTickets = useMemo(() => {
    const list = [...runningOrders]
    if (order && !list.some((t) => t.id === order.id) && order.status !== 'billed' && order.status !== 'cancelled') {
      list.unshift(order)
    }
    return list
  }, [runningOrders, order])

  const startFreshBill = () => {
    setPendingItems([])
    setBillOpen(false)
    setCustomerId('')
    setOrderId(null)
    setMobileTab('menu')
    setItemQuantities({})
    setItemNotesDraft({})
    setVoidedItems({})
    setVoidingItemId(null)
    if (!kotCfg.allowedOrderTypes.includes(orderType)) {
      setOrderType(kotCfg.defaultOrderType)
    }
  }

  const switchTicket = async (id: string | null) => {
    if (id === orderId) return
    try {
      if (pendingItems.length > 0) {
        if (orderId) {
          await persistPending(orderId)
        } else {
          const created = await createOrder(startOrderPayload(pendingItems))
          setPendingItems([])
          if (!id) {
            setOrderId(created.id)
            toast.success('Bill kept in the bar')
            return
          }
        }
      }
      if (!id) {
        startFreshBill()
        return
      }
      setPendingItems([])
      setBillOpen(false)
      setOrderId(id)
      setMobileTab('ticket')
    } catch (err) {
      toastError(err, 'Could not switch bills')
    }
  }

  const handleAddWaiter = () => {
    const name = waiterName.trim()
    if (!name) {
      toast.error('Type a waiter name first')
      return
    }
    if (kotCfg.waiterNames.some((n) => n.toLowerCase() === name.toLowerCase())) {
      toast.success(`${name} is already saved`)
      return
    }
    persistKotConfig({ ...kotCfg, waiterNames: [...kotCfg.waiterNames, name] }, `${name} saved`)
  }

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
        toastError(err, 'Could not start the order')
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
    try {
      const via = await printKotSlipSmart(slip, {
        paperSize,
        useBluetooth: shouldPrintThermalOverBle(settings, blePrinter),
        ble: blePrinter,
      })
      if (via === 'ble') toast.success('KOT sent to printer')
    } catch (err) {
      console.error(err)
        toast.error('Could not print KOT. Tap Connect printer on this page and try again.')
    }
  }

  const confirmVoid = () => {
    if (!voidingItemId) return
    const reason =
      selectedVoidReason === 'Other / Guest request' && customVoidReason.trim()
        ? customVoidReason.trim()
        : selectedVoidReason
    setVoidedItems((prev) => ({ ...prev, [voidingItemId]: reason }))
    setVoidingItemId(null)
    setCustomVoidReason('')
    setSelectedVoidReason(VOID_REASONS[0])
  }

  const handleFireDelta = async (autoPrint = true) => {
    if (!orderId || !order) return
    // For new bills without an order yet, pending-only changes go through Send to Kitchen
    const hasExistingEdits = deltaChanges.some((c) => c.type !== 'new') || (order && pendingItems.length > 0)
    if (!hasExistingEdits && pendingItems.length === 0) return
    if (deltaChanges.length === 0) return

    try {
      const itemsToAdd = pendingItems.map((it) => ({
        productId: it.productId,
        productName: it.productName,
        quantity: it.quantity,
        unitPrice: it.unitPrice,
        taxRate: it.taxRate,
        notes: it.notes,
        modifiers: it.modifiers,
      }))

      const itemsToUpdate = order.items
        .filter((orig) => orig.status !== 'voided' && !voidedItems[orig.id])
        .filter(
          (orig) =>
            (itemQuantities[orig.id] !== undefined && itemQuantities[orig.id] !== orig.quantity) ||
            (itemNotesDraft[orig.id] ?? '') !== (orig.notes || '')
        )
        .map((orig) => ({
          id: orig.id,
          quantity: itemQuantities[orig.id] ?? orig.quantity,
          notes: itemNotesDraft[orig.id] ?? orig.notes ?? undefined,
        }))

      const itemsToVoid = Object.entries(voidedItems)
        .filter(([id]) => order.items.some((it) => it.id === id && it.status !== 'voided'))
        .map(([id, reason]) => ({ id, reason }))

      await editOrder({
        id: order.id,
        data: {
          itemsToAdd,
          itemsToUpdate,
          itemsToVoid,
        },
      })

      if (autoPrint && deltaChanges.length > 0) {
        try {
          const paperSize = settings?.printerConfig?.paperSize || '58mm'
          await printKotDeltaSlipSmart(
            {
              orderNumber: order.orderNumber,
              tableName: order.table?.name || table?.name,
              partyLabel: order.partyLabel,
              waiterName: waiterName || order.waiterName,
              time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              changes: deltaChanges,
            },
            {
              paperSize,
              useBluetooth: shouldPrintThermalOverBle(settings, blePrinter),
              ble: blePrinter,
            }
          )
        } catch (printErr) {
          console.warn('Delta KOT print failed:', printErr)
        }
      }

      setPendingItems([])
      toast.success(autoPrint ? 'Changes fired — delta KOT printed' : 'Order items saved')
    } catch (err) {
      toastError(err, 'Could not fire changes')
    }
  }

  const handleStatusStep = async (status: KOTOrderStatus) => {
    if (!orderId) return
    try {
      await updateStatus({ id: orderId, status })
      toast.success(`Status → ${STATUS_PIPELINE.find((s) => s.id === status)?.label || status}`)
    } catch (err) {
      toastError(err, 'Could not update status')
    }
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
      toastError(err, 'Could not send to kitchen')
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
    const billCtx = {
      sale,
      receiptConfig,
      businessName: settings?.businessName,
      businessAddress: settings?.businessAddress,
      tableName: displayName,
      waiterName: waiterName || order?.waiterName,
      orderType,
      kotNumber: order?.orderNumber,
      paperSize: paperSize as '58mm' | '80mm',
    }
    const useBle = shouldPrintThermalOverBle(settings, blePrinter)

    if (useBle) {
      try {
        if (blePrinter.status !== 'connected') await blePrinter.connect()
        await blePrinter.print(generateRestaurantBillEscPos(billCtx))
        toast.success('Guest bill printed')
        return
      } catch (err) {
        console.error(err)
        toast.error('Bluetooth print failed. Tap Connect printer on this page and try again.')
        return
      }
    }

    printRestaurantBill(billCtx)
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
      } else if (deltaChanges.length > 0) {
        await handleFireDelta(false)
      } else if (pendingItems.length > 0) {
        await persistPending(id)
      }
      setBillOpen(true)
    } catch (err) {
      toastError(err, 'Could not prepare the bill')
    }
  }

  const hasNewItems = pendingItems.length > 0 || unprintedServerItems.length > 0
  const hasAnyItems = hasNewItems || kitchenSentItems.some((it) => it.status !== 'voided' && !voidedItems[it.id])
  const currentStatus = (order?.status || 'open') as KOTOrderStatus
  const showStatusPipeline = !!orderId && order && order.status !== 'billed' && order.status !== 'cancelled'

  return (
    <div className="fixed inset-0 z-50 bg-gray-50 dark:bg-gray-900 flex flex-col">
      <header className="shrink-0 flex items-center justify-between gap-2 sm:gap-3 px-3 sm:px-5 py-2.5 sm:py-3 border-b border-gray-200 dark:border-gray-700 bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl">
        <div className="min-w-0">
          <p className="text-xs text-gray-500 dark:text-gray-400">{orderTypeLabel(orderType)} bill</p>
          <h1 className="text-base sm:text-lg font-bold text-gray-900 dark:text-gray-100 truncate">{displayName}</h1>
        </div>
        {showStatusPipeline && (
          <div className="hidden md:flex items-center gap-1 min-w-0 overflow-x-auto no-scrollbar">
            {STATUS_PIPELINE.map((step, idx) => {
              const currentIdx = STATUS_PIPELINE.findIndex((s) => s.id === currentStatus)
              const active = step.id === currentStatus
              const reached = currentIdx >= idx
              const nextStep = STATUS_PIPELINE[idx]
              const canAdvance =
                idx === currentIdx + 1 || (currentStatus === 'open' && step.id === 'sent_to_kitchen')
              return (
                <button
                  key={step.id}
                  type="button"
                  disabled={isUpdatingStatus || (!canAdvance && !active)}
                  onClick={() => {
                    if (canAdvance) void handleStatusStep(nextStep.id)
                  }}
                  className={`shrink-0 px-2.5 py-1 rounded-full text-[10px] font-bold border transition-colors ${
                    active
                      ? 'bg-blue-600 text-white border-blue-600'
                      : reached
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
                        : canAdvance
                          ? 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 border-gray-300 dark:border-gray-600 hover:border-blue-400'
                          : 'bg-gray-50 dark:bg-gray-900 text-gray-400 border-gray-200 dark:border-gray-800 opacity-60'
                  }`}
                >
                  {step.label}
                </button>
              )
            })}
          </div>
        )}
        <div className="flex-1 flex justify-end min-w-0 overflow-x-auto no-scrollbar items-center gap-2">
          <LocationSelector onChange={setLocationId} />
          <BleConnectButton />
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

      <div className="shrink-0 flex items-center gap-2 px-3 sm:px-5 py-2 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 overflow-x-auto no-scrollbar">
        <button
          type="button"
          onClick={() => void switchTicket(null)}
          className={`shrink-0 inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
            !orderId
              ? 'bg-[#0a0a2e] text-white border-[#0a0a2e]'
              : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 border-gray-200 dark:border-gray-700'
          }`}
        >
          <Plus size={12} />
          New
        </button>
        {openTickets.map((ticket) => {
          const active = ticket.id === orderId
          return (
            <button
              key={ticket.id}
              type="button"
              onClick={() => void switchTicket(ticket.id)}
              className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold border text-left transition-colors ${
                active
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 border-gray-200 dark:border-gray-700'
              }`}
            >
              <span className="block leading-tight">#{ticket.orderNumber}</span>
              <span className={`block text-[10px] font-medium ${active ? 'text-blue-100' : 'text-amber-600 dark:text-amber-400'}`}>
                {ticketLaneLabel(ticket.status)}
                {ticket.partyLabel || ticket.table?.name ? ` · ${ticket.partyLabel || ticket.table?.name}` : ''}
              </span>
            </button>
          )
        })}
      </div>

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
          Ticket{hasAnyItems ? ` (${kitchenSentItems.length + unprintedServerItems.length + pendingItems.length})` : ''}
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
              showUnavailable={showUnavailable}
              onShowUnavailableChange={setShowUnavailable}
              onToggleAvailability={handleToggleAvailability}
              onAddFoodItem={() => setAddFoodOpen(true)}
              onPick={(p) => {
                if (!isProductAvailable(p)) return
                setPickedProduct(p)
                setItemNotes('')
                setItemMods([])
              }}
            />
          )}
        </div>

        <div
          className={`w-full sm:w-[380px] lg:w-[420px] shrink-0 border-l border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex flex-col min-h-0 overflow-hidden ${
            mobileTab === 'menu' ? 'hidden sm:flex' : 'flex'
          }`}
        >
          {orderLoading && orderId ? (
            <div className="flex flex-1 justify-center py-16">
              <Spinner />
            </div>
          ) : (
            <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
              <OrderTicketPanel
                tableName={displayName}
                orderNumber={order?.orderNumber}
                orderType={orderType}
                onOrderTypeChange={setOrderType}
                waiterName={waiterName}
                onWaiterChange={setWaiterName}
                showWaiter={kotCfg.showWaiterField}
                waiterNames={kotCfg.waiterNames}
                onAddWaiter={handleAddWaiter}
                allowedOrderTypes={kotCfg.allowedOrderTypes}
                sentItems={kitchenSentItems}
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
                itemQuantities={itemQuantities}
                itemNotesDraft={itemNotesDraft}
                voidedItems={voidedItems}
                onExistingQty={(itemId, qty) =>
                  setItemQuantities((prev) => ({ ...prev, [itemId]: Math.max(1, qty) }))
                }
                onExistingNotes={(itemId, notes) =>
                  setItemNotesDraft((prev) => ({ ...prev, [itemId]: notes }))
                }
                onRequestVoid={(itemId) => {
                  setVoidingItemId(itemId)
                  setSelectedVoidReason(VOID_REASONS[0])
                  setCustomVoidReason('')
                }}
                onUndoVoid={(itemId) =>
                  setVoidedItems((prev) => {
                    const next = { ...prev }
                    delete next[itemId]
                    return next
                  })
                }
                deltaChanges={orderId ? deltaChanges : []}
                onFireDelta={orderId ? () => void handleFireDelta(true) : undefined}
                firingDelta={isEditing}
                subtotal={totals.subtotal}
                tax={totals.tax}
                grandTotal={totals.grandTotal}
              />
            </div>
          )}

          <div className="shrink-0 z-10 p-3 border-t border-gray-200 dark:border-gray-700 space-y-2 bg-white dark:bg-gray-800 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            {kotCfg.kitchenTicketsEnabled && (
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
            )}
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

      {billOpen ? (
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
                  toast.success('Bill settled — start the next one')
                  setBillOpen(false)
                  try {
                    await printCustomerReceipt(result.sale)
                  } catch (err) {
                    console.error(err)
                  }
                  startFreshBill()
                },
                onError: (err) => toastError(err, 'Could not settle the bill'),
              }
            )
          }}
        />
      ) : null}

      {voidingItemId ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 shadow-xl p-5 space-y-4">
            <div>
              <h3 className="text-base font-bold text-gray-900 dark:text-gray-100">Void item</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Select a mandatory void reason for kitchen waste audit.
              </p>
            </div>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {VOID_REASONS.map((reason) => (
                <button
                  key={reason}
                  type="button"
                  onClick={() => setSelectedVoidReason(reason)}
                  className={`w-full text-left px-3 py-2.5 rounded-xl text-sm font-semibold border transition-colors ${
                    selectedVoidReason === reason
                      ? 'bg-[#0a0a2e] text-white border-[#0a0a2e]'
                      : 'bg-gray-50 dark:bg-gray-800 text-gray-800 dark:text-gray-100 border-gray-200 dark:border-gray-700'
                  }`}
                >
                  {reason}
                </button>
              ))}
            </div>
            {selectedVoidReason === 'Other / Guest request' && (
              <Input
                placeholder="Custom reason"
                value={customVoidReason}
                onChange={(e) => setCustomVoidReason(e.target.value)}
                className="h-10"
              />
            )}
            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                onClick={() => {
                  setVoidingItemId(null)
                  setCustomVoidReason('')
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={confirmVoid}
                disabled={selectedVoidReason === 'Other / Guest request' && !customVoidReason.trim()}
                className="bg-red-600 hover:bg-red-700"
              >
                Confirm void
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      <AddFoodItemModal isOpen={addFoodOpen} onClose={() => setAddFoodOpen(false)} />
    </div>
  )
}
