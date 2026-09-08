import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { Badge } from '@/components/ui/Badge'
import { TablePageSkeleton } from '@/components/ui/PageSkeleton'
import { useCreditTransactions } from '@/hooks/useCredits'
import { useSales } from '@/hooks/useSales'
import { useExpenses, useCreateExpense } from '@/hooks/useExpenses'
import { useCustomers } from '@/hooks/useCustomers'
import { useTokens } from '@/hooks/useTokens'
import { useProducts } from '@/hooks/useProducts'
import { usePurchases } from '@/hooks/usePurchases'
import { useSettings } from '@/hooks/useSettings'
import { useAuth } from '@/contexts/AuthContext'
import { useBlePrinter } from '@/hooks/useBlePrinter'
import {
  BookOpen, Receipt, Wallet, ChevronLeft, ChevronRight,
  Search, Download, Share2, Banknote, CreditCard as CardIcon, Smartphone,
  Printer, Eye, Plus, ArrowDownLeft, ArrowUpRight, Landmark, AlertTriangle,
  TrendingUp,
} from 'lucide-react'
import { formatINR } from '@/utils/currency'
import { useLanguage } from '@/contexts/LanguageContext'
import { clsx } from 'clsx'
import * as XLSX from 'xlsx'
import toast from 'react-hot-toast'
import { toastError } from '@/utils/userMessage'
import { ROUTES } from '@/constants/routes'
import { printCompletedSale } from '@/utils/printCompletedSale'
import { GstLedgerPanel, useGstLedger } from '@/components/common/GstLedgerPanel'
import {
  CASH_IN_TAG, CASH_OPENING_TAG, CASH_OUT_TAG,
  dayBounds, isCashInDesc, isCashOutDesc, isOpeningCashDesc,
  shiftDateValue, stripCashTags, toDateInputValue, toTs,
} from '@/utils/daybook'
import type { Customer } from '@/types/customer.types'
import type { Sale } from '@/types/sale.types'

type EntryType = 'sale' | 'expense' | 'credit-payment' | 'cash-in' | 'cash-out'
type EntryFilter = 'all' | EntryType

interface DaybookEntry {
  id: string
  entryType: EntryType
  entryDate: number
  description: string
  amount: number
  customerName?: string
  referenceId?: string
  paymentMethod?: string
  creditPortion?: number
  context?: string
  isOpening?: boolean
  sale?: Sale
}

const LIVE_MS = 8000

const fillTpl = (template: string, vars: Record<string, string | number>) =>
  Object.entries(vars).reduce((s, [k, v]) => s.split(`{${k}}`).join(String(v)), template)

export const DaybookPage = () => {
  const { t } = useLanguage()
  const navigate = useNavigate()
  const { userProfile, permissions } = useAuth()
  const { data: settings } = useSettings()
  const blePrinter = useBlePrinter()
  const todayValue = toDateInputValue(new Date())

  const [date, setDate] = useState(todayValue)
  const [endDate, setEndDate] = useState(todayValue)
  const [rangeOpen, setRangeOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<EntryFilter>('all')
  const [isShareOpen, setIsShareOpen] = useState(false)
  const [sharePhone, setSharePhone] = useState('')
  const [isCashOpen, setIsCashOpen] = useState(false)
  const [cashDir, setCashDir] = useState<'in' | 'out'>('in')
  const [cashAmount, setCashAmount] = useState('')
  const [cashRemark, setCashRemark] = useState('')
  const [cashOpening, setCashOpening] = useState(false)
  const [isCountOpen, setIsCountOpen] = useState(false)
  const [countedCash, setCountedCash] = useState('')
  const [isCloseOpen, setIsCloseOpen] = useState(false)
  const [printingId, setPrintingId] = useState<string | null>(null)
  const [drawerCount, setDrawerCount] = useState<number | null>(null)

  const effectiveEnd = rangeOpen ? endDate : date
  const isLiveDay = date <= todayValue && effectiveEnd >= todayValue
  const liveOpts = { refetchInterval: isLiveDay ? LIVE_MS : false as const }

  const { data: transactions, isLoading: txLoading, isFetching: txFetching, dataUpdatedAt: txAt } = useCreditTransactions(liveOpts)
  const { data: sales, isLoading: salesLoading, isFetching: salesFetching, dataUpdatedAt: salesAt } = useSales(liveOpts)
  const { data: expenses, isLoading: expensesLoading, isFetching: expFetching, dataUpdatedAt: expAt } = useExpenses(liveOpts)
  const { data: customers } = useCustomers()
  const { data: tokens } = useTokens(date, liveOpts)
  const { data: products } = useProducts()
  const { data: purchases } = usePurchases(liveOpts)
  const { mutate: createExpense, isPending: isSavingCash } = useCreateExpense()
  const gstStart = dayBounds(date).startVal
  const gstEnd = dayBounds(effectiveEnd).endVal
  const gstLedger = useGstLedger({
    sales,
    purchases,
    products,
    startTs: gstStart,
    endTs: gstEnd,
  })

  const canEditCash = userProfile?.role === 'admin' || permissions?.canAccessExpenses !== false
  const lastUpdated = Math.max(salesAt || 0, expAt || 0, txAt || 0)
  const isFetchingLive = isLiveDay && (salesFetching || expFetching || txFetching)

  const goDate = (next: string) => {
    setDate(next)
    if (!rangeOpen || next > endDate) setEndDate(next)
  }

  const countKey = `daybook-count:${userProfile?.uid || 'local'}:${date}`

  useEffect(() => {
    const raw = localStorage.getItem(countKey)
    setDrawerCount(raw === null ? null : Number(raw))
  }, [countKey])

  const {
    entries, moneyIn, moneyOut, creditGiven, cashTotal, cardTotal, upiTotal, creditCollected,
    invoiceCount, expenseCount, paymentCount, cashInCount, cashOutCount,
    openingCash, netCashCollected, expectedDrawer, yesterdayMoneyIn, hourly,
  } = useMemo(() => {
    const { startVal } = dayBounds(date)
    const { endVal } = dayBounds(effectiveEnd)
    const yDay = shiftDateValue(date, -1)
    const yBounds = dayBounds(yDay)

    const allCustomers = (customers as Customer[] | undefined) ?? []
    const allTokens = tokens ?? []
    const list: DaybookEntry[] = []
    const hourBuckets = Array.from({ length: 24 }, () => 0)
    let yesterdayMoneyIn = 0

    const pushHour = (ts: number, amount: number) => {
      if (!rangeOpen) {
        const hour = new Date(ts).getHours()
        hourBuckets[hour] += amount
      }
    }

    ;(sales ?? []).forEach(sale => {
      const ts = toTs(sale.createdAt, startVal)
      const paidNow = Math.min(sale.grandTotal, Math.max(0, sale.amountPaid ?? (sale.paymentMethod === 'credit' ? 0 : sale.grandTotal)))
      if (ts >= yBounds.startVal && ts < yBounds.endVal) yesterdayMoneyIn += paidNow
      if (ts < startVal || ts >= endVal) return
      const customer = allCustomers.find(c => c.id === sale.customerId)
      const creditPortion = Math.max(0, sale.grandTotal - paidNow)
      const token = allTokens.find(tok => tok.saleId === sale.id)
      const description = token
        ? `Token #${token.tokenNumber} · ${token.tokenType?.name ?? sale.items?.[0]?.productName ?? t('daybook.invoice')}`
        : `${t('daybook.invoice')} ${sale.invoiceNumber}`
      const context = token
        ? token.tokenType?.name
        : sale.isQuickBill
          ? t('nav.posLite')
          : customer?.name
            ? customer.name
            : t('daybook.walkIn')
      list.push({
        id: sale.id,
        entryType: 'sale',
        entryDate: ts,
        description,
        amount: paidNow,
        customerName: customer?.name,
        referenceId: sale.invoiceNumber,
        paymentMethod: sale.paymentMethod,
        creditPortion,
        context: context || t('daybook.counterSale'),
        sale,
      })
      pushHour(ts, paidNow)
    })

    ;(expenses ?? []).forEach(exp => {
      const ts = toTs(exp.expenseDate, startVal)
      const desc = exp.description || exp.category
      if (ts < startVal || ts >= endVal) return
      if (isCashInDesc(desc)) {
        list.push({
          id: exp.id,
          entryType: 'cash-in',
          entryDate: ts,
          description: stripCashTags(desc) || t('daybook.cashIn'),
          amount: exp.amount,
          paymentMethod: exp.paymentMethod,
          isOpening: isOpeningCashDesc(desc),
        })
        return
      }
      if (isCashOutDesc(desc)) {
        list.push({
          id: exp.id,
          entryType: 'cash-out',
          entryDate: ts,
          description: stripCashTags(desc) || t('daybook.cashOut'),
          amount: exp.amount,
          paymentMethod: exp.paymentMethod,
        })
        return
      }
      list.push({
        id: exp.id,
        entryType: 'expense',
        entryDate: ts,
        description: desc,
        amount: exp.amount,
        paymentMethod: exp.paymentMethod,
      })
    })

    ;(transactions ?? []).forEach(txn => {
      if (txn.type !== 'payment') return
      const ts = toTs(txn.createdAt, startVal)
      if (ts >= yBounds.startVal && ts < yBounds.endVal) yesterdayMoneyIn += txn.amount
      if (ts < startVal || ts >= endVal) return
      const customer = allCustomers.find(c => c.id === txn.customerId)
      list.push({
        id: txn.id,
        entryType: 'credit-payment',
        entryDate: ts,
        description: txn.notes || `${t('daybook.paymentReceived')} — ${customer?.name ?? ''}`,
        amount: txn.amount,
        customerName: customer?.name,
        referenceId: txn.referenceId,
        context: customer?.name,
      })
    })

    list.sort((a, b) => b.entryDate - a.entryDate)

    const moneyIn = list
      .filter(e => e.entryType === 'sale' || e.entryType === 'credit-payment' || e.entryType === 'cash-in')
      .reduce((s, e) => s + e.amount, 0)
    const moneyOut = list
      .filter(e => e.entryType === 'expense' || e.entryType === 'cash-out')
      .reduce((s, e) => s + e.amount, 0)
    const creditGiven = list.reduce((s, e) => s + (e.creditPortion ?? 0), 0)
    const cashTotal = list.filter(e => e.entryType === 'sale' && e.paymentMethod === 'cash').reduce((s, e) => s + e.amount, 0)
    const cardTotal = list.filter(e => e.entryType === 'sale' && e.paymentMethod === 'card').reduce((s, e) => s + e.amount, 0)
    const upiTotal = list.filter(e => e.entryType === 'sale' && e.paymentMethod === 'upi').reduce((s, e) => s + e.amount, 0)
    const creditCollected = list.filter(e => e.entryType === 'credit-payment').reduce((s, e) => s + e.amount, 0)
    const openingCash = list.filter(e => e.isOpening).reduce((s, e) => s + e.amount, 0)
    const otherCashIn = list.filter(e => e.entryType === 'cash-in').reduce((s, e) => s + e.amount, 0) - openingCash
    const cashExpenses = list
      .filter(e => (e.entryType === 'expense' || e.entryType === 'cash-out') && (e.paymentMethod === 'cash' || !e.paymentMethod))
      .reduce((s, e) => s + e.amount, 0)
    const cashPayments = list
      .filter(e => e.entryType === 'credit-payment')
      .reduce((s, e) => s + e.amount, 0)
    const netCashCollected = cashTotal + cashPayments + otherCashIn - cashExpenses
    const expectedDrawer = openingCash + netCashCollected

    return {
      entries: list,
      moneyIn,
      moneyOut,
      creditGiven,
      cashTotal,
      cardTotal,
      upiTotal,
      creditCollected,
      invoiceCount: list.filter(e => e.entryType === 'sale').length,
      expenseCount: list.filter(e => e.entryType === 'expense').length,
      paymentCount: list.filter(e => e.entryType === 'credit-payment').length,
      cashInCount: list.filter(e => e.entryType === 'cash-in').length,
      cashOutCount: list.filter(e => e.entryType === 'cash-out').length,
      openingCash,
      netCashCollected,
      expectedDrawer,
      yesterdayMoneyIn,
      hourly: hourBuckets,
    }
  }, [date, effectiveEnd, rangeOpen, sales, expenses, transactions, customers, tokens, t])

  const visibleEntries = useMemo(() => {
    const q = search.trim().toLowerCase()
    return entries.filter(e => {
      if (filter === 'cash-in' || filter === 'cash-out') {
        if (e.entryType !== 'cash-in' && e.entryType !== 'cash-out') return false
      } else if (filter !== 'all' && e.entryType !== filter) return false
      if (!q) return true
      return (
        e.description.toLowerCase().includes(q) ||
        (e.customerName?.toLowerCase().includes(q) ?? false) ||
        (e.referenceId?.toLowerCase().includes(q) ?? false) ||
        (e.context?.toLowerCase().includes(q) ?? false)
      )
    })
  }, [entries, search, filter])

  const remarks = useMemo(() => {
    const lines: string[] = []
    if (invoiceCount === 0 && paymentCount === 0 && expenseCount === 0 && cashInCount === 0 && cashOutCount === 0) {
      return [isLiveDay ? t('daybook.remarkEmptyToday') : t('daybook.remarkEmptyPast')]
    }
    if (yesterdayMoneyIn > 0 && !rangeOpen) {
      const delta = ((moneyIn - yesterdayMoneyIn) / yesterdayMoneyIn) * 100
      if (Math.abs(delta) < 1) {
        lines.push(fillTpl(t('daybook.remarkFlat'), { amount: formatINR(yesterdayMoneyIn) }))
      } else if (delta > 0) {
        lines.push(fillTpl(t('daybook.remarkUp'), { pct: Math.round(delta), amount: formatINR(yesterdayMoneyIn) }))
      } else {
        lines.push(fillTpl(t('daybook.remarkDown'), { pct: Math.round(Math.abs(delta)), amount: formatINR(yesterdayMoneyIn) }))
      }
    } else if (isLiveDay && invoiceCount > 0) {
      lines.push(fillTpl(t('daybook.remarkLive'), { count: invoiceCount }))
    }
    if (creditGiven > 0) {
      lines.push(fillTpl(t('daybook.remarkCredit'), { amount: formatINR(creditGiven) }))
    } else if (invoiceCount > 0) {
      lines.push(t('daybook.remarkAllSettled'))
    }
    if (moneyIn > 0 && cashTotal / moneyIn >= 0.7) {
      lines.push(fillTpl(t('daybook.remarkMostlyCash'), { pct: Math.round((cashTotal / moneyIn) * 100) }))
    }
    if (expenseCount === 0 && moneyIn > 0) {
      lines.push(t('daybook.remarkNoExpenses'))
    }
    return lines.slice(0, 3)
  }, [invoiceCount, paymentCount, expenseCount, cashInCount, cashOutCount, isLiveDay, yesterdayMoneyIn, rangeOpen, moneyIn, creditGiven, cashTotal, t])

  const hasCount = drawerCount !== null && Number.isFinite(drawerCount)
  const countDiff = hasCount ? (drawerCount as number) - expectedDrawer : 0
  const matched = hasCount && Math.abs(countDiff) < 1

  const net = moneyIn - moneyOut
  const billed = moneyIn + creditGiven
  const maxHour = Math.max(1, ...hourly)

  const handleExport = () => {
    if (entries.length === 0) {
      toast.error(t('common.noResults'))
      return
    }
    const ws = XLSX.utils.aoa_to_sheet([
      ['Date', 'Type', 'Description', 'Customer', 'Payment Method', 'Amount'],
      ...entries.map(e => [
        new Date(e.entryDate).toLocaleString(),
        e.entryType,
        e.description,
        e.customerName ?? '',
        e.paymentMethod ?? '',
        e.amount,
      ]),
      [],
      [t('daybook.moneyIn'), '', '', '', '', moneyIn],
      [t('daybook.moneyOut'), '', '', '', '', moneyOut],
      [t('daybook.net'), '', '', '', '', net],
      [t('daybook.creditGiven'), '', '', '', '', creditGiven],
      [t('daybook.expectedDrawer'), '', '', '', '', expectedDrawer],
      [t('gst.collected'), '', '', '', '', gstLedger.collected],
      [t('gst.paid'), '', '', '', '', gstLedger.paid],
      [t('gst.net'), '', '', '', '', gstLedger.net],
      ...gstLedger.products.map(p => [p.productName, `${p.rate}%`, '', '', '', p.tax]),
      ...remarks.map(r => ['Remark', r]),
    ])
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Daybook')
    XLSX.writeFile(wb, `daybook-${date}${rangeOpen ? `_to_${effectiveEnd}` : ''}.xlsx`)
    toast.success(t('daybook.exportExcel'))
  }

  const summaryLines = () => [
    `📒 *${t('page.daybook')}*`,
    rangeOpen ? `${date} → ${effectiveEnd}` : date,
    '',
    ...remarks,
    '',
    `${t('daybook.moneyIn')}: ${formatINR(moneyIn)}`,
    `${t('daybook.moneyOut')}: ${formatINR(moneyOut)}`,
    `${t('daybook.net')}: ${formatINR(net)}`,
    `${t('daybook.creditGiven')}: ${formatINR(creditGiven)}`,
    '',
    `${t('daybook.cash')}: ${formatINR(cashTotal)}`,
    `${t('daybook.card')}: ${formatINR(cardTotal)}`,
    `${t('daybook.upi')}: ${formatINR(upiTotal)}`,
    `${t('daybook.creditCollected')}: ${formatINR(creditCollected)}`,
    `${t('daybook.expectedDrawer')}: ${formatINR(expectedDrawer)}`,
    '',
    `${t('gst.collected')}: ${formatINR(gstLedger.collected)}`,
    `${t('gst.paid')}: ${formatINR(gstLedger.paid)}`,
    `${t('gst.net')}: ${formatINR(gstLedger.net)}`,
  ]

  const handleWhatsAppShare = () => {
    const raw = sharePhone.replace(/\D/g, '')
    const phone = raw.startsWith('0') ? '91' + raw.slice(1) : raw.length === 10 ? '91' + raw : raw
    if (phone.length < 10) { toast.error('Enter a valid phone number'); return }
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(summaryLines().join('\n'))}`, '_blank', 'noopener,noreferrer')
    setIsShareOpen(false)
    setSharePhone('')
  }

  const handlePrintSummary = () => {
    const rows = entries.map(e => `
      <tr>
        <td>${new Date(e.entryDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
        <td>${e.description}</td>
        <td>${e.paymentMethod?.toUpperCase() || e.entryType}</td>
        <td style="text-align:right">${e.entryType === 'expense' || e.entryType === 'cash-out' ? '-' : '+'}${formatINR(e.amount)}</td>
      </tr>`).join('')
    const html = `<!doctype html><html><head><title>Daybook ${date}</title>
      <style>
        body { font-family: sans-serif; padding: 24px; color: #111; }
        h1 { font-size: 20px; margin: 0 0 4px; }
        .muted { color: #666; font-size: 12px; }
        .remark { background: #eff6ff; padding: 10px 12px; border-radius: 8px; margin: 12px 0; font-size: 13px; }
        table { width: 100%; border-collapse: collapse; margin-top: 16px; font-size: 12px; }
        th, td { border-bottom: 1px solid #e5e7eb; padding: 6px 4px; text-align: left; }
        .totals td { font-weight: 700; }
      </style></head><body>
      <h1>${settings?.businessName || 'Seznik'} — ${t('page.daybook')}</h1>
      <p class="muted">${rangeOpen ? `${date} → ${effectiveEnd}` : date}</p>
      ${remarks.map(r => `<div class="remark">${r}</div>`).join('')}
      <p><b>${t('daybook.moneyIn')}</b> ${formatINR(moneyIn)} &nbsp; <b>${t('daybook.moneyOut')}</b> ${formatINR(moneyOut)} &nbsp; <b>${t('daybook.net')}</b> ${formatINR(net)}</p>
      <p><b>${t('daybook.cash')}</b> ${formatINR(cashTotal)} &nbsp; <b>${t('daybook.card')}</b> ${formatINR(cardTotal)} &nbsp; <b>${t('daybook.upi')}</b> ${formatINR(upiTotal)} &nbsp; <b>${t('daybook.creditCollected')}</b> ${formatINR(creditCollected)}</p>
      <p><b>${t('daybook.expectedDrawer')}</b> ${formatINR(expectedDrawer)}</p>
      <p><b>${t('gst.collected')}</b> ${formatINR(gstLedger.collected)} &nbsp; <b>${t('gst.paid')}</b> ${formatINR(gstLedger.paid)} &nbsp; <b>${t('gst.net')}</b> ${formatINR(gstLedger.net)}</p>
      <table><thead><tr><th>Time</th><th>Description</th><th>Mode</th><th>Amount</th></tr></thead>
      <tbody>${rows}</tbody></table>
      </body></html>`
    const w = window.open('', '_blank', 'noopener,noreferrer')
    if (!w) { toast.error('Allow pop-ups to print'); return }
    w.document.write(html)
    w.document.close()
    w.focus()
    w.print()
  }

  const saveCashMovement = () => {
    const amount = parseFloat(cashAmount)
    if (!amount || amount <= 0) {
      toast.error(t('expenses.errValidAmount'))
      return
    }
    const remark = cashRemark.trim() || (cashDir === 'in' ? t('daybook.cashIn') : t('daybook.cashOut'))
    const tag = cashDir === 'in' ? CASH_IN_TAG : CASH_OUT_TAG
    const opening = cashDir === 'in' && cashOpening ? ` ${CASH_OPENING_TAG}` : ''
    createExpense({
      category: 'other',
      amount,
      description: `${tag}${opening} ${remark}`.trim(),
      paymentMethod: 'cash',
      expenseDate: new Date(`${date}T12:00:00`),
    }, {
      onSuccess: () => {
        toast.success(cashDir === 'in' ? t('daybook.cashIn') : t('daybook.cashOut'))
        setIsCashOpen(false)
        setCashAmount('')
        setCashRemark('')
        setCashOpening(false)
      },
      onError: (err) => toastError(err, t('expenses.errValidAmount')),
    })
  }

  const printSale = async (sale: Sale) => {
    setPrintingId(sale.id)
    try {
      const customerName = sale.customerId
        ? customers?.find(c => c.id === sale.customerId)?.name
        : undefined
      await printCompletedSale({ sale, settings, customerName, ble: blePrinter })
    } catch (error) {
      toastError(error, t('pos.errFailedPrintBluetooth'))
    } finally {
      setPrintingId(null)
    }
  }

  const filterChips: { key: EntryFilter; label: string; count: number }[] = [
    { key: 'all', label: t('common.all'), count: entries.length },
    { key: 'sale', label: t('daybook.filterSales'), count: invoiceCount },
    { key: 'expense', label: t('daybook.filterExpenses'), count: expenseCount },
    { key: 'credit-payment', label: t('daybook.filterPayments'), count: paymentCount },
    { key: 'cash-in', label: t('daybook.filterCashDrawer'), count: cashInCount + cashOutCount },
  ]

  const isLoading = salesLoading || expensesLoading || txLoading
  const inflowPct = billed > 0 ? Math.round((moneyIn / billed) * 100) : 100
  const payShare = (n: number) => moneyIn > 0 ? Math.round((n / moneyIn) * 100) : 0

  const statusBadge = (entry: DaybookEntry) => {
    if (entry.entryType === 'sale') {
      if ((entry.creditPortion || 0) > 0.01) {
        return <Badge variant="warning">{t('daybook.partial')} · {(entry.paymentMethod || 'credit').toUpperCase()}</Badge>
      }
      return <Badge variant="success">{t('daybook.paid')} · {(entry.paymentMethod || 'cash').toUpperCase()}</Badge>
    }
    if (entry.entryType === 'credit-payment') return <Badge variant="success">{t('daybook.paymentReceived')}</Badge>
    if (entry.entryType === 'cash-in') return <Badge variant="info">{t('daybook.cashIn')}</Badge>
    if (entry.entryType === 'cash-out') return <Badge variant="danger">{t('daybook.cashOut')}</Badge>
    return <Badge variant="danger">{t('daybook.expense')}</Badge>
  }

  return (
    <div className="pb-28">
      <PageHeader
        title={t('page.daybook')}
        action={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" leftIcon={<Share2 size={16} />} onClick={() => setIsShareOpen(true)} className="text-green-600 border-green-300 hover:bg-green-50">
              {t('daybook.shareWhatsApp')}
            </Button>
            <Button variant="outline" leftIcon={<Download size={16} />} onClick={handleExport}>
              {t('daybook.exportExcel')}
            </Button>
            <Button variant="outline" leftIcon={<Printer size={16} />} onClick={handlePrintSummary}>
              {t('daybook.printSummary')}
            </Button>
            {canEditCash && (
              <Button leftIcon={<Plus size={16} />} onClick={() => setIsCashOpen(true)}>
                {t('daybook.addCash')}
              </Button>
            )}
          </div>
        }
      />

      <div className="flex flex-wrap items-center gap-2 -mt-3 mb-4">
        {isLiveDay ? (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800">
            <span className={clsx('w-1.5 h-1.5 rounded-full bg-emerald-500', isFetchingLive && 'animate-pulse')} />
            {t('daybook.liveOpen')}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300">
            {date === shiftDateValue(todayValue, -1) ? t('daybook.yesterday') : date}
          </span>
        )}
        <p className="text-xs text-gray-500 dark:text-gray-400">{t('daybook.subtitle')}</p>
        {lastUpdated > 0 && isLiveDay && (
          <span className="text-[11px] text-gray-400 ml-auto">{t('daybook.updatedAgo')}</span>
        )}
      </div>

      <Card className="p-3 mb-4">
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => goDate(shiftDateValue(date, -1))} className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700">
            <ChevronLeft size={18} />
          </button>
          <input
            type="date"
            value={date}
            max={todayValue}
            onChange={e => goDate(e.target.value)}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
          {rangeOpen && (
            <>
              <span className="text-xs text-gray-400">{t('pos.to')}</span>
              <input
                type="date"
                value={endDate}
                min={date}
                max={todayValue}
                onChange={e => setEndDate(e.target.value)}
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </>
          )}
          <button type="button" onClick={() => goDate(shiftDateValue(date, 1))} disabled={date >= todayValue} className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 disabled:opacity-30 dark:text-gray-400 dark:hover:bg-gray-700">
            <ChevronRight size={18} />
          </button>
          <Button size="sm" variant={date === todayValue && !rangeOpen ? 'primary' : 'ghost'} onClick={() => { setRangeOpen(false); goDate(todayValue) }}>
            {t('daybook.today')}
          </Button>
          <Button size="sm" variant={date === shiftDateValue(todayValue, -1) && !rangeOpen ? 'primary' : 'ghost'} onClick={() => { setRangeOpen(false); goDate(shiftDateValue(todayValue, -1)) }}>
            {t('daybook.yesterday')}
          </Button>
          <Button size="sm" variant={rangeOpen ? 'primary' : 'ghost'} onClick={() => { setRangeOpen(v => !v); setEndDate(date) }}>
            {t('daybook.dateRange')}
          </Button>
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={15} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={t('daybook.searchPlaceholder')}
              className="w-full pl-9 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 mt-3">
          {filterChips.map(chip => (
            <button
              key={chip.key}
              type="button"
              onClick={() => setFilter(chip.key)}
              className={clsx(
                'px-3 py-1 rounded-full text-xs font-medium transition-colors',
                filter === chip.key
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300'
              )}
            >
              {chip.label} ({chip.count})
            </button>
          ))}
          <span className="ml-auto text-[11px] text-gray-400 hidden sm:inline">
            {t('daybook.registerLabel')}: {settings?.businessName || 'POS'}
          </span>
        </div>
      </Card>

      {remarks.length > 0 && (
        <Card className="p-4 mb-4 border-blue-100 dark:border-blue-900/40 bg-blue-50/60 dark:bg-blue-950/20">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-blue-600 dark:text-blue-400 mb-1.5">{t('daybook.dailyRemark')}</p>
          <ul className="space-y-1">
            {remarks.map(line => (
              <li key={line} className="text-sm text-gray-800 dark:text-gray-200 leading-relaxed">• {line}</li>
            ))}
          </ul>
        </Card>
      )}

      {!rangeOpen && invoiceCount > 0 && (
        <Card className="p-3 mb-4">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 mb-2">{t('daybook.hourlyActivity')}</p>
          <div className="flex items-end gap-0.5 h-12">
            {hourly.map((v, hour) => (
              <div
                key={hour}
                title={`${hour}:00 · ${formatINR(v)}`}
                className="flex-1 rounded-sm bg-blue-500/80 min-w-0"
                style={{ height: `${Math.max(6, (v / maxHour) * 100)}%`, opacity: v === 0 ? 0.15 : 1 }}
              />
            ))}
          </div>
        </Card>
      )}

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 mb-4">
        <Card className="p-4">
          <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wide text-gray-400">
            {t('daybook.moneyIn')}
            <ArrowDownLeft size={14} className="text-emerald-500" />
          </div>
          <p className="text-2xl font-bold text-emerald-600 mt-1">{formatINR(moneyIn)}</p>
          <p className="text-[11px] text-gray-500 mt-1">{inflowPct}% {t('daybook.inflowShare')} · {invoiceCount} {t('daybook.invoicesTotal')}</p>
          {!rangeOpen && yesterdayMoneyIn > 0 && (
            <p className="text-[11px] text-gray-400 mt-0.5">{t('daybook.vsYesterday')} {formatINR(yesterdayMoneyIn)}</p>
          )}
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wide text-gray-400">
            {t('daybook.moneyOut')}
            <ArrowUpRight size={14} className="text-red-500" />
          </div>
          <p className="text-2xl font-bold text-red-600 mt-1">{formatINR(moneyOut)}</p>
          <p className="text-[11px] text-gray-500 mt-1">{expenseCount + cashOutCount} {t('daybook.disbursements')}</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wide text-gray-400">
            {t('daybook.net')}
            <Landmark size={14} className="text-blue-500" />
          </div>
          <p className={`text-2xl font-bold mt-1 ${net >= 0 ? 'text-blue-700 dark:text-blue-400' : 'text-red-600'}`}>{formatINR(net)}</p>
          <p className="text-[11px] text-gray-500 mt-1">{net >= 0 ? t('daybook.positiveBalance') : t('daybook.negativeBalance')}</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wide text-gray-400">
            {t('daybook.creditGiven')}
            <AlertTriangle size={14} className="text-amber-500" />
          </div>
          <p className="text-2xl font-bold text-amber-600 mt-1">{formatINR(creditGiven)}</p>
          <p className="text-[11px] text-gray-500 mt-1">
            {creditGiven <= 0.01 ? `100% ${t('daybook.settled')}` : `${formatINR(creditGiven)} ${t('daybook.pendingCredit')}`}
          </p>
        </Card>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 mb-6">
        {[
          { label: t('daybook.cash'), value: cashTotal, icon: Banknote, color: 'emerald', count: entries.filter(e => e.entryType === 'sale' && e.paymentMethod === 'cash').length },
          { label: t('daybook.card'), value: cardTotal, icon: CardIcon, color: 'blue', count: entries.filter(e => e.entryType === 'sale' && e.paymentMethod === 'card').length },
          { label: t('daybook.upiQr'), value: upiTotal, icon: Smartphone, color: 'violet', count: entries.filter(e => e.entryType === 'sale' && e.paymentMethod === 'upi').length },
          { label: t('daybook.creditCollected'), value: creditCollected, icon: Wallet, color: 'amber', count: paymentCount },
        ].map(item => (
          <Card key={item.label} className="p-3 flex items-center gap-3">
            <div className={clsx(
              'w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0',
              item.color === 'emerald' && 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30',
              item.color === 'blue' && 'bg-blue-100 text-blue-600 dark:bg-blue-900/30',
              item.color === 'violet' && 'bg-violet-100 text-violet-600 dark:bg-violet-900/30',
              item.color === 'amber' && 'bg-amber-100 text-amber-600 dark:bg-amber-900/30',
            )}>
              <item.icon size={18} />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] uppercase tracking-wide text-gray-400 truncate">{item.label}</p>
              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{formatINR(item.value)}</p>
              <p className="text-[11px] text-gray-400">{payShare(item.value)}% · {item.count} {t('daybook.transactions')}</p>
            </div>
          </Card>
        ))}
      </div>

      <div className="mb-6">
        <GstLedgerPanel ledger={gstLedger} />
      </div>

      <Card className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{t('daybook.ledgerTitle')}</h2>
          <span className="text-xs text-gray-400">{visibleEntries.length}</span>
        </div>
        {isLoading ? (
          <TablePageSkeleton cards={4} rows={6} columns={5} showCards={false} />
        ) : visibleEntries.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <BookOpen size={48} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">{t('daybook.noTransactions')}</p>
          </div>
        ) : (
          <div className="space-y-2">
            {visibleEntries.map(entry => (
              <div key={entry.id} className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800/60 rounded-xl">
                <div className={clsx(
                  'w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0',
                  entry.entryType === 'expense' || entry.entryType === 'cash-out'
                    ? 'bg-red-100 dark:bg-red-900/30 text-red-600'
                    : 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600'
                )}>
                  {entry.entryType === 'sale' ? <Receipt size={15} /> :
                   entry.entryType === 'credit-payment' ? <Wallet size={15} /> :
                   entry.entryType === 'cash-in' ? <ArrowDownLeft size={15} /> :
                   <ArrowUpRight size={15} />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">{entry.description}</p>
                    {statusBadge(entry)}
                  </div>
                  <p className="text-[11px] text-gray-400 mt-0.5 truncate">
                    {new Date(entry.entryDate).toLocaleString([], { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    {entry.context ? ` · ${entry.context}` : ''}
                    {entry.creditPortion ? ` · ${t('daybook.creditPortion')} ${formatINR(entry.creditPortion)}` : ''}
                  </p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className={clsx(
                    'text-sm font-bold',
                    entry.entryType === 'expense' || entry.entryType === 'cash-out' ? 'text-red-600' : 'text-emerald-600'
                  )}>
                    {entry.entryType === 'expense' || entry.entryType === 'cash-out' ? '-' : '+'}{formatINR(entry.amount)}
                  </p>
                  {entry.entryType === 'sale' && entry.paymentMethod === 'cash' && (
                    <p className="text-[10px] text-gray-400">{t('daybook.cashReceived')}</p>
                  )}
                </div>
                {entry.entryType === 'sale' && entry.sale && (
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      type="button"
                      title={t('pos.print')}
                      disabled={printingId === entry.sale.id}
                      onClick={() => void printSale(entry.sale!)}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-white dark:hover:bg-gray-700"
                    >
                      <Printer size={15} />
                    </button>
                    <button
                      type="button"
                      title={t('daybook.view')}
                      onClick={() => navigate(ROUTES.SALE_DETAIL(entry.sale!.id))}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-white dark:hover:bg-gray-700"
                    >
                      <Eye size={15} />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      {!rangeOpen && (
        <div className="fixed bottom-16 lg:bottom-0 left-0 right-0 lg:left-64 z-20 border-t border-gray-200 dark:border-gray-700 bg-white/95 dark:bg-gray-900/95 backdrop-blur px-3 sm:px-6 py-3">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-gray-600 dark:text-gray-300">
            <span>{t('daybook.openingDrawer')}: <strong>{formatINR(openingCash)}</strong></span>
            <span>{t('daybook.netCashCollected')}: <strong className="text-emerald-600">+{formatINR(netCashCollected)}</strong></span>
            <span>{t('daybook.expectedDrawer')}: <strong>{formatINR(expectedDrawer)}</strong></span>
            {matched ? (
              <Badge variant="success">{t('daybook.matched')} 100%</Badge>
            ) : hasCount ? (
              <Badge variant="warning">{t('daybook.difference')} {formatINR(countDiff)}</Badge>
            ) : (
              <Badge variant="info">{t('daybook.countToMatch')}</Badge>
            )}
            <div className="ml-auto flex gap-2">
              <Button size="sm" variant="outline" onClick={() => { setCountedCash(hasCount ? String(drawerCount) : ''); setIsCountOpen(true) }}>
                {t('daybook.drawerCount')}
              </Button>
              <Button size="sm" onClick={() => setIsCloseOpen(true)} className="bg-[#0a0a2e] hover:bg-[#1a1555]">
                <TrendingUp size={14} className="mr-1.5" />
                {t('daybook.closeRegister')}
              </Button>
            </div>
          </div>
        </div>
      )}

      <Modal isOpen={isShareOpen} onClose={() => { setIsShareOpen(false); setSharePhone('') }} title={t('daybook.shareModalTitle')} size="sm">
        <div className="space-y-4">
          <Input
            label={t('daybook.whatsappNumber')}
            value={sharePhone}
            onChange={e => setSharePhone(e.target.value)}
            placeholder="9876543210"
            autoFocus
            onKeyDown={e => e.key === 'Enter' && handleWhatsAppShare()}
          />
          <div className="flex gap-3">
            <Button variant="ghost" className="flex-1" onClick={() => { setIsShareOpen(false); setSharePhone('') }}>
              {t('action.cancel')}
            </Button>
            <Button className="flex-1 bg-green-600 hover:bg-green-700 text-white" leftIcon={<Share2 size={16} />} onClick={handleWhatsAppShare}>
              {t('daybook.openWhatsApp')}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={isCashOpen} onClose={() => setIsCashOpen(false)} title={t('daybook.addCash')} size="sm">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => { setCashDir('in'); setCashOpening(false) }} className={clsx('py-2 rounded-lg text-sm font-semibold border-2', cashDir === 'in' ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-gray-200 dark:border-gray-600')}>
              {t('daybook.cashIn')}
            </button>
            <button type="button" onClick={() => { setCashDir('out'); setCashOpening(false) }} className={clsx('py-2 rounded-lg text-sm font-semibold border-2', cashDir === 'out' ? 'border-red-500 bg-red-50 text-red-700' : 'border-gray-200 dark:border-gray-600')}>
              {t('daybook.cashOut')}
            </button>
          </div>
          <Input type="number" step="0.01" label={t('common.amount')} value={cashAmount} onChange={e => setCashAmount(e.target.value)} placeholder="0.00" />
          <Input label={t('common.description')} value={cashRemark} onChange={e => setCashRemark(e.target.value)} placeholder={t('daybook.remarkPlaceholder')} />
          {cashDir === 'in' && (
            <label className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300">
              <input type="checkbox" checked={cashOpening} onChange={e => setCashOpening(e.target.checked)} />
              {t('daybook.openingFloat')}
            </label>
          )}
          <Button className="w-full" loading={isSavingCash} onClick={saveCashMovement}>
            {cashDir === 'in' ? t('daybook.cashIn') : t('daybook.cashOut')}
          </Button>
        </div>
      </Modal>

      <Modal isOpen={isCountOpen} onClose={() => setIsCountOpen(false)} title={t('daybook.drawerCount')} size="sm">
        <div className="space-y-4">
          <p className="text-sm text-gray-500">{t('daybook.expectedDrawer')}: <strong>{formatINR(expectedDrawer)}</strong></p>
          <Input type="number" step="0.01" label={t('daybook.countedCash')} value={countedCash} onChange={e => setCountedCash(e.target.value)} />
          {countedCash !== '' && (
            <p className="text-sm">{t('daybook.difference')}: <strong className={Math.abs(parseFloat(countedCash) - expectedDrawer) < 1 ? 'text-emerald-600' : 'text-amber-600'}>{formatINR(parseFloat(countedCash) - expectedDrawer)}</strong></p>
          )}
          <Button className="w-full" onClick={() => {
            const value = parseFloat(countedCash) || 0
            localStorage.setItem(countKey, String(value))
            setDrawerCount(value)
            setIsCountOpen(false)
            toast.success(t('daybook.saveCount'))
          }}>
            {t('daybook.saveCount')}
          </Button>
        </div>
      </Modal>

      <Modal isOpen={isCloseOpen} onClose={() => setIsCloseOpen(false)} title={t('daybook.closeTitle')} size="md">
        <div className="space-y-3">
          <p className="text-sm text-gray-500">{t('daybook.closeHint')}</p>
          {remarks.map(line => (
            <p key={line} className="text-sm bg-blue-50 dark:bg-blue-950/30 rounded-lg px-3 py-2">{line}</p>
          ))}
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-800">{t('daybook.moneyIn')}<p className="font-bold text-emerald-600">{formatINR(moneyIn)}</p></div>
            <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-800">{t('daybook.moneyOut')}<p className="font-bold text-red-600">{formatINR(moneyOut)}</p></div>
            <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-800">{t('daybook.net')}<p className="font-bold">{formatINR(net)}</p></div>
            <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-800">{t('daybook.expectedDrawer')}<p className="font-bold">{formatINR(expectedDrawer)}</p></div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" leftIcon={<Printer size={16} />} onClick={handlePrintSummary}>{t('daybook.printSummary')}</Button>
            <Button className="flex-1" leftIcon={<Share2 size={16} />} onClick={() => { setIsCloseOpen(false); setIsShareOpen(true) }}>{t('daybook.shareWhatsApp')}</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
