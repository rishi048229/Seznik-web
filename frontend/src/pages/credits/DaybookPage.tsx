import { useMemo, useState } from 'react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { Spinner } from '@/components/ui/Spinner'
import { useCreditTransactions } from '@/hooks/useCredits'
import { useSales } from '@/hooks/useSales'
import { useExpenses } from '@/hooks/useExpenses'
import { useCustomers } from '@/hooks/useCustomers'
import {
  BookOpen, Receipt, Wallet, ChevronLeft, ChevronRight,
  Search, Download, Share2, Banknote, CreditCard as CardIcon, Smartphone,
} from 'lucide-react'
import { formatINR } from '@/utils/currency'
import { useLanguage } from '@/contexts/LanguageContext'
import { clsx } from 'clsx'
import * as XLSX from 'xlsx'
import toast from 'react-hot-toast'

import type { Customer } from '@/types/customer.types'

type EntryType = 'sale' | 'expense' | 'credit-payment'
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
}

const toTs = (val: unknown, fallback: number): number => {
  const raw = val as { toDate?: () => Date } | string | number | undefined
  if (typeof raw === 'object' && raw?.toDate) return raw.toDate().getTime()
  if (typeof raw === 'string' || typeof raw === 'number') return new Date(raw).getTime()
  return fallback
}

const toDateInputValue = (d: Date) => d.toISOString().split('T')[0]

export const DaybookPage = () => {
  const { t } = useLanguage()
  const { data: transactions, isLoading: txLoading } = useCreditTransactions()
  const { data: sales, isLoading: salesLoading } = useSales()
  const { data: expenses, isLoading: expensesLoading } = useExpenses()
  const { data: customers } = useCustomers()

  const [date, setDate] = useState(toDateInputValue(new Date()))
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<EntryFilter>('all')
  const [isShareOpen, setIsShareOpen] = useState(false)
  const [sharePhone, setSharePhone] = useState('')

  const shiftDate = (deltaDays: number) => {
    const d = new Date(date)
    d.setDate(d.getDate() + deltaDays)
    setDate(toDateInputValue(d))
  }

  const isToday = date === toDateInputValue(new Date())

  const { entries, moneyIn, moneyOut, creditGiven, cashTotal, cardTotal, upiTotal, creditCollected } = useMemo(() => {
    const selected = new Date(date)
    selected.setHours(0, 0, 0, 0)
    const startVal = selected.getTime()
    const endVal = startVal + 86400000

    const allCustomers = (customers as Customer[] | undefined) ?? []
    const list: DaybookEntry[] = []

    ;(sales ?? []).forEach(sale => {
      const ts = toTs(sale.createdAt, startVal)
      if (ts < startVal || ts >= endVal) return
      const customer = allCustomers.find(c => c.id === sale.customerId)
      const isCredit = sale.paymentMethod === 'credit'
      const paidNow = isCredit ? sale.amountPaid : sale.grandTotal
      const creditPortion = isCredit ? Math.max(0, sale.grandTotal - sale.amountPaid) : 0
      list.push({
        id: sale.id,
        entryType: 'sale',
        entryDate: ts,
        description: `${t('daybook.invoice')} ${sale.invoiceNumber}`,
        amount: paidNow,
        customerName: customer?.name,
        referenceId: sale.invoiceNumber,
        paymentMethod: sale.paymentMethod,
        creditPortion,
      })
    })

    ;(expenses ?? []).forEach(exp => {
      const ts = toTs(exp.expenseDate, startVal)
      if (ts < startVal || ts >= endVal) return
      list.push({
        id: exp.id,
        entryType: 'expense',
        entryDate: ts,
        description: exp.description || exp.category,
        amount: exp.amount,
        paymentMethod: exp.paymentMethod,
      })
    })

    ;(transactions ?? []).forEach(txn => {
      if (txn.type !== 'payment') return
      const ts = toTs(txn.createdAt, startVal)
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
      })
    })

    list.sort((a, b) => b.entryDate - a.entryDate)

    const moneyIn = list
      .filter(e => e.entryType === 'sale' || e.entryType === 'credit-payment')
      .reduce((s, e) => s + e.amount, 0)
    const moneyOut = list
      .filter(e => e.entryType === 'expense')
      .reduce((s, e) => s + e.amount, 0)
    const creditGiven = list.reduce((s, e) => s + (e.creditPortion ?? 0), 0)
    const cashTotal = list.filter(e => e.entryType === 'sale' && e.paymentMethod === 'cash').reduce((s, e) => s + e.amount, 0)
    const cardTotal = list.filter(e => e.entryType === 'sale' && e.paymentMethod === 'card').reduce((s, e) => s + e.amount, 0)
    const upiTotal = list.filter(e => e.entryType === 'sale' && e.paymentMethod === 'upi').reduce((s, e) => s + e.amount, 0)
    const creditCollected = list.filter(e => e.entryType === 'credit-payment').reduce((s, e) => s + e.amount, 0)

    return { entries: list, moneyIn, moneyOut, creditGiven, cashTotal, cardTotal, upiTotal, creditCollected }
  }, [date, sales, expenses, transactions, customers, t])

  const visibleEntries = useMemo(() => {
    const q = search.trim().toLowerCase()
    return entries.filter(e => {
      if (filter !== 'all' && e.entryType !== filter) return false
      if (!q) return true
      return (
        e.description.toLowerCase().includes(q) ||
        (e.customerName?.toLowerCase().includes(q) ?? false) ||
        (e.referenceId?.toLowerCase().includes(q) ?? false)
      )
    })
  }, [entries, search, filter])

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
      ['Money In', '', '', '', '', moneyIn],
      ['Money Out', '', '', '', '', moneyOut],
      ['Net', '', '', '', '', moneyIn - moneyOut],
      ['Credit Given', '', '', '', '', creditGiven],
    ])
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Daybook')
    XLSX.writeFile(wb, `daybook-${date}.xlsx`)
    toast.success(t('daybook.exportExcel'))
  }

  const handleWhatsAppShare = () => {
    const raw = sharePhone.replace(/\D/g, '')
    const phone = raw.startsWith('0') ? '91' + raw.slice(1) : raw.length === 10 ? '91' + raw : raw
    if (phone.length < 10) { toast.error('Enter a valid phone number'); return }

    const msg = [
      `📒 *${t('page.daybook')}*`,
      `${date}`,
      ``,
      `${t('daybook.moneyIn')}: ${formatINR(moneyIn)}`,
      `${t('daybook.moneyOut')}: ${formatINR(moneyOut)}`,
      `${t('daybook.net')}: ${formatINR(moneyIn - moneyOut)}`,
      `${t('daybook.creditGiven')}: ${formatINR(creditGiven)}`,
      ``,
      `${t('daybook.cash')}: ${formatINR(cashTotal)}`,
      `${t('daybook.card')}: ${formatINR(cardTotal)}`,
      `${t('daybook.upi')}: ${formatINR(upiTotal)}`,
      `${t('daybook.creditCollected')}: ${formatINR(creditCollected)}`,
    ].join('\n')

    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank', 'noopener,noreferrer')
    setIsShareOpen(false)
    setSharePhone('')
  }

  const filterChips: { key: EntryFilter; label: string }[] = [
    { key: 'all', label: t('common.all') },
    { key: 'sale', label: t('daybook.filterSales') },
    { key: 'expense', label: t('daybook.filterExpenses') },
    { key: 'credit-payment', label: t('daybook.filterPayments') },
  ]

  const isLoading = salesLoading || expensesLoading || txLoading

  return (
    <div>
      <PageHeader
        title={t('page.daybook')}
        action={
          <div className="flex gap-2">
            <Button variant="outline" leftIcon={<Share2 size={16} />} onClick={() => setIsShareOpen(true)} className="text-green-600 border-green-300 hover:bg-green-50">
              {t('daybook.shareWhatsApp')}
            </Button>
            <Button variant="outline" leftIcon={<Download size={16} />} onClick={handleExport}>
              {t('daybook.exportExcel')}
            </Button>
          </div>
        }
      />

      {/* Date navigation */}
      <Card className="p-3 mb-4">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => shiftDate(-1)}
            className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700"
          >
            <ChevronLeft size={18} />
          </button>
          <input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
          <button
            type="button"
            onClick={() => shiftDate(1)}
            className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700"
          >
            <ChevronRight size={18} />
          </button>
          {!isToday && (
            <Button size="sm" variant="ghost" onClick={() => setDate(toDateInputValue(new Date()))}>
              {t('daybook.today')}
            </Button>
          )}

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

        <div className="flex flex-wrap gap-1.5 mt-3">
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
              {chip.label}
            </button>
          ))}
        </div>
      </Card>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
        <Card className="p-4 text-center">
          <p className="text-xs text-gray-500 dark:text-gray-400">{t('daybook.moneyIn')}</p>
          <p className="text-xl font-bold text-emerald-600">{formatINR(moneyIn)}</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-xs text-gray-500 dark:text-gray-400">{t('daybook.moneyOut')}</p>
          <p className="text-xl font-bold text-red-600">{formatINR(moneyOut)}</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-xs text-gray-500 dark:text-gray-400">{t('daybook.net')}</p>
          <p className={`text-xl font-bold ${moneyIn - moneyOut >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
            {formatINR(moneyIn - moneyOut)}
          </p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-xs text-gray-500 dark:text-gray-400">{t('daybook.creditGiven')}</p>
          <p className="text-xl font-bold text-amber-600">{formatINR(creditGiven)}</p>
        </Card>
      </div>

      {/* Payment method breakdown */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card className="p-3 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600 flex-shrink-0">
            <Banknote size={16} />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{t('daybook.cash')}</p>
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{formatINR(cashTotal)}</p>
          </div>
        </Card>
        <Card className="p-3 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 flex-shrink-0">
            <CardIcon size={16} />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{t('daybook.card')}</p>
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{formatINR(cardTotal)}</p>
          </div>
        </Card>
        <Card className="p-3 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center text-purple-600 flex-shrink-0">
            <Smartphone size={16} />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{t('daybook.upi')}</p>
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{formatINR(upiTotal)}</p>
          </div>
        </Card>
        <Card className="p-3 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center text-amber-600 flex-shrink-0">
            <Wallet size={16} />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{t('daybook.creditCollected')}</p>
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{formatINR(creditCollected)}</p>
          </div>
        </Card>
      </div>

      {/* Entries */}
      <Card className="p-4">
        {isLoading ? (
          <div className="flex justify-center py-8"><Spinner size="lg" /></div>
        ) : visibleEntries.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <BookOpen size={48} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">{t('daybook.noTransactions')}</p>
          </div>
        ) : (
          <div className="space-y-2">
            {visibleEntries.map(entry => (
              <div key={entry.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <div className="flex items-center gap-3 min-w-0">
                  <div className={clsx(
                    'w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0',
                    entry.entryType === 'sale' || entry.entryType === 'credit-payment'
                      ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600'
                      : 'bg-red-100 dark:bg-red-900/30 text-red-600'
                  )}>
                    {entry.entryType === 'sale' ? <Receipt size={14} /> :
                     entry.entryType === 'credit-payment' ? <Wallet size={14} /> :
                     <Receipt size={14} />}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{entry.description}</p>
                    <p className="text-xs text-gray-400 truncate">
                      {entry.entryType === 'sale'
                        ? (entry.paymentMethod === 'credit' ? t('daybook.creditSale') : entry.paymentMethod?.toUpperCase())
                        : entry.entryType === 'credit-payment' ? t('daybook.paymentReceived')
                        : t('daybook.expense')}
                      {entry.customerName ? ` — ${entry.customerName}` : ''}
                      {entry.creditPortion ? ` (${t('daybook.creditPortion')}: ${formatINR(entry.creditPortion)})` : ''}
                    </p>
                  </div>
                </div>
                <span className={clsx(
                  'text-sm font-semibold flex-shrink-0 ml-2',
                  entry.entryType === 'sale' || entry.entryType === 'credit-payment' ? 'text-emerald-600' : 'text-red-600'
                )}>
                  {entry.entryType === 'sale' || entry.entryType === 'credit-payment' ? '+' : '-'}{formatINR(entry.amount)}
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* WhatsApp Share Modal */}
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
    </div>
  )
}
