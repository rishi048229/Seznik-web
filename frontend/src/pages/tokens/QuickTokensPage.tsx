import { useMemo, useState } from 'react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { Spinner } from '@/components/ui/Spinner'
import { FieldInfo } from '@/components/ui/FieldInfo'
import { useTokenTypes, useCreateTokenType, useUpdateTokenType, useDeleteTokenType } from '@/hooks/useTokenTypes'
import { useTokens, useIssueToken, useDeleteToken } from '@/hooks/useTokens'
import { useSettings } from '@/hooks/useSettings'
import { generateReceiptHTML, printReceipt } from '@/utils/receipt'
import { formatINR } from '@/utils/currency'
import { useLanguage } from '@/contexts/LanguageContext'
import { clsx } from 'clsx'
import {
  Ticket, Coffee, UtensilsCrossed, Cookie, ParkingCircle, QrCode, Bike, Wallet,
  Plus, Pencil, Trash2, Settings2, Printer, X, Minus, ChevronLeft, ChevronRight,
  Search, Download, ArrowUp, ArrowDown, Receipt as ReceiptIcon, TrendingUp, Award,
} from 'lucide-react'
import * as XLSX from 'xlsx'
import toast from 'react-hot-toast'
import type { TokenType, Token } from '@/types/token.types'
import type { Sale } from '@/types/sale.types'

const TOKEN_ICONS: Record<string, typeof Ticket> = {
  ticket: Ticket,
  coffee: Coffee,
  food: UtensilsCrossed,
  snack: Cookie,
  parking: ParkingCircle,
  qrcode: QrCode,
  bike: Bike,
  wallet: Wallet,
}
const ICON_KEYS = Object.keys(TOKEN_ICONS)

const TOKEN_COLORS: Record<string, string> = {
  blue: 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400',
  sky: 'bg-sky-100 text-sky-600 dark:bg-sky-900/30 dark:text-sky-400',
  amber: 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400',
  emerald: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400',
  purple: 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400',
  rose: 'bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400',
}
const COLOR_KEYS = Object.keys(TOKEN_COLORS)

const toDateInputValue = (d: Date) => d.toISOString().split('T')[0]
const todayStr = () => toDateInputValue(new Date())

const PAYMENT_OPTIONS = [
  { value: 'cash', label: 'Cash' },
  { value: 'upi', label: 'UPI' },
  { value: 'card', label: 'Card' },
]

export const QuickTokensPage = () => {
  const { t } = useLanguage()
  const { data: tokenTypes, isLoading: typesLoading } = useTokenTypes()
  const [historyDate, setHistoryDate] = useState(todayStr())
  const { data: tokens, isLoading: tokensLoading } = useTokens(historyDate)
  const { data: settings } = useSettings()
  const { mutate: createTokenType, isPending: isCreatingType } = useCreateTokenType()
  const { mutate: updateTokenType, isPending: isUpdatingType } = useUpdateTokenType()
  const { mutate: deleteTokenType } = useDeleteTokenType()
  const { mutate: issueToken, isPending: isIssuing } = useIssueToken()
  const { mutate: deleteToken } = useDeleteToken()

  const sortedTypes = useMemo(
    () => [...(tokenTypes ?? [])].sort((a, b) => a.sortOrder - b.sortOrder || a.createdAt.localeCompare(b.createdAt)),
    [tokenTypes]
  )
  const activeTypes = sortedTypes.filter(tt => tt.isActive)

  const isHistoryToday = historyDate === todayStr()
  const shiftHistoryDate = (delta: number) => {
    const d = new Date(historyDate)
    d.setDate(d.getDate() + delta)
    setHistoryDate(toDateInputValue(d))
  }

  const [historySearch, setHistorySearch] = useState('')
  const visibleTokens = useMemo(() => {
    const q = historySearch.trim().toLowerCase()
    const list = tokens ?? []
    if (!q) return list
    return list.filter(tok =>
      (tok.tokenType?.name ?? tok.sale?.items?.[0]?.productName ?? '').toLowerCase().includes(q) ||
      String(tok.tokenNumber).includes(q)
    )
  }, [tokens, historySearch])

  const stats = useMemo(() => {
    const list = tokens ?? []
    const revenue = list.reduce((s, tok) => s + (tok.sale?.grandTotal ?? 0), 0)
    const counts = new Map<string, number>()
    list.forEach(tok => {
      const name = tok.tokenType?.name ?? tok.sale?.items?.[0]?.productName ?? 'Other'
      counts.set(name, (counts.get(name) ?? 0) + 1)
    })
    let topType = '—'
    let topCount = 0
    counts.forEach((count, name) => { if (count > topCount) { topCount = count; topType = name } })
    return { issued: list.length, revenue, topType, topCount }
  }, [tokens])

  // Manage token types modal
  const [manageOpen, setManageOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [typeForm, setTypeForm] = useState({ name: '', price: '', taxRate: '0', icon: 'ticket', color: 'blue' })

  const resetTypeForm = () => {
    setEditingId(null)
    setTypeForm({ name: '', price: '', taxRate: '0', icon: 'ticket', color: 'blue' })
  }

  const openEditType = (tt: TokenType) => {
    setEditingId(tt.id)
    setTypeForm({
      name: tt.name,
      price: tt.price === null ? '' : String(tt.price),
      taxRate: String(tt.taxRate),
      icon: tt.icon,
      color: tt.color,
    })
  }

  const handleSaveType = () => {
    if (!typeForm.name.trim()) return
    const payload = {
      name: typeForm.name.trim(),
      price: typeForm.price.trim() === '' ? null : parseFloat(typeForm.price),
      taxRate: typeForm.taxRate ? parseFloat(typeForm.taxRate) : 0,
      icon: typeForm.icon,
      color: typeForm.color,
    }
    if (editingId) {
      updateTokenType({ tokenTypeId: editingId, data: payload }, {
        onSuccess: () => { toast.success('Token type updated'); resetTypeForm() },
        onError: (err) => toast.error(err instanceof Error ? err.message : 'Failed to update token type'),
      })
    } else {
      createTokenType({ ...payload, sortOrder: sortedTypes.length }, {
        onSuccess: () => { toast.success('Token type created'); resetTypeForm() },
        onError: (err) => toast.error(err instanceof Error ? err.message : 'Failed to create token type'),
      })
    }
  }

  const handleDeleteType = (tt: TokenType) => {
    if (!confirm(`Delete token type "${tt.name}"?`)) return
    deleteTokenType(tt.id, {
      onSuccess: () => toast.success('Token type deleted'),
      onError: () => toast.error('Failed to delete token type'),
    })
  }

  const moveType = (index: number, direction: -1 | 1) => {
    const target = sortedTypes[index + direction]
    const current = sortedTypes[index]
    if (!target) return
    updateTokenType({ tokenTypeId: current.id, data: { sortOrder: target.sortOrder } })
    updateTokenType({ tokenTypeId: target.id, data: { sortOrder: current.sortOrder } })
  }

  // Issue-token confirm step
  const [issuingType, setIssuingType] = useState<TokenType | null>(null)
  const [issueQty, setIssueQty] = useState(1)
  const [issueAmount, setIssueAmount] = useState('')
  const [issuePayment, setIssuePayment] = useState<'cash' | 'upi' | 'card'>('cash')

  const openIssue = (tt: TokenType) => {
    setIssuingType(tt)
    setIssueQty(1)
    setIssueAmount(tt.price !== null ? String(tt.price) : '')
    setIssuePayment('cash')
  }

  const closeIssue = () => setIssuingType(null)

  const printToken = (token: Token) => {
    if (!token.sale) return
    const receiptConfig = settings?.receiptConfig
    const paperSize = settings?.printerConfig?.paperSize || '58mm'
    const width: '50mm' | '80mm' = paperSize === '80mm' ? '80mm' : '50mm'
    const label = token.tokenType?.name ?? token.sale.items?.[0]?.productName ?? 'Token'
    const receiptHTML = generateReceiptHTML({
      sale: token.sale as Sale,
      receiptConfig,
      businessName: settings?.businessName,
      businessAddress: settings?.businessAddress,
      customerName: `Token #${token.tokenNumber} · ${label}`,
      width,
      logoURL: settings?.businessLogoURL || receiptConfig?.logoURL,
      settingsTaxName: 'GST',
    })
    printReceipt(receiptHTML, width, `Token #${token.tokenNumber}`)
  }

  const handleIssue = () => {
    if (!issuingType) return
    const amount = parseFloat(issueAmount)
    if (!amount || amount <= 0) {
      toast.error('Enter a valid amount')
      return
    }
    issueToken(
      {
        tokenTypeId: issuingType.id,
        amount,
        quantity: issueQty,
        paymentMethod: issuePayment,
      },
      {
        onSuccess: (token) => {
          toast.success(`Token #${token.tokenNumber} issued`)
          printToken(token)
          closeIssue()
        },
        onError: (err) => toast.error(err instanceof Error ? err.message : 'Failed to issue token'),
      }
    )
  }

  const handleCancelToken = (token: Token) => {
    if (!confirm(`Cancel Token #${token.tokenNumber}? This removes it from Sales and the Daybook.`)) return
    deleteToken(token.id, {
      onSuccess: () => toast.success('Token cancelled'),
      onError: () => toast.error('Failed to cancel token'),
    })
  }

  const handleExport = () => {
    if (!tokens || tokens.length === 0) {
      toast.error('No tokens to export')
      return
    }
    const ws = XLSX.utils.aoa_to_sheet([
      ['Token #', 'Type', 'Amount', 'Payment Method', 'Time'],
      ...tokens.map(tok => [
        tok.tokenNumber,
        tok.tokenType?.name ?? tok.sale?.items?.[0]?.productName ?? 'Token',
        tok.sale?.grandTotal ?? 0,
        tok.sale?.paymentMethod ?? '',
        new Date(tok.createdAt).toLocaleString(),
      ]),
      [],
      ['Total Issued', tokens.length],
      ['Total Revenue', stats.revenue],
    ])
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Tokens')
    XLSX.writeFile(wb, `tokens-${historyDate}.xlsx`)
    toast.success('Tokens exported')
  }

  return (
    <div>
      <PageHeader
        title={t('page.tokens')}
        action={
          <Button variant="outline" leftIcon={<Settings2 size={16} />} onClick={() => { resetTypeForm(); setManageOpen(true) }}>
            {t('token.manageTypes')}
          </Button>
        }
      />

      {/* Issue grid */}
      <Card className="p-6 mb-6">
        {typesLoading ? (
          <div className="flex justify-center py-8"><Spinner size="lg" /></div>
        ) : activeTypes.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <Ticket size={48} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">{t('token.noTypes')}</p>
            <Button className="mt-4" leftIcon={<Plus size={16} />} onClick={() => { resetTypeForm(); setManageOpen(true) }}>
              {t('token.addTokenType')}
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {activeTypes.map((tt) => {
              const Icon = TOKEN_ICONS[tt.icon] ?? Ticket
              return (
                <button
                  key={tt.id}
                  type="button"
                  onClick={() => openIssue(tt)}
                  className="flex flex-col items-center justify-center gap-2 p-5 rounded-xl border border-gray-100 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-600 hover:shadow-md transition-all active:scale-[0.97] bg-white dark:bg-gray-800"
                >
                  <div className={clsx('w-12 h-12 rounded-full flex items-center justify-center', TOKEN_COLORS[tt.color] ?? TOKEN_COLORS.blue)}>
                    <Icon size={22} />
                  </div>
                  <span className="text-sm font-semibold text-gray-900 dark:text-gray-100 text-center">{tt.name}</span>
                  <span className="text-xs text-gray-400">
                    {tt.price !== null ? formatINR(tt.price) : t('token.variableAmount')}
                  </span>
                </button>
              )
            })}
          </div>
        )}
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <Card className="p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center flex-shrink-0">
            <ReceiptIcon size={18} />
          </div>
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400">{t('token.issuedCount')}</p>
            <p className="text-xl font-bold text-gray-900 dark:text-gray-100">{stats.issued}</p>
          </div>
        </Card>
        <Card className="p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center flex-shrink-0">
            <TrendingUp size={18} />
          </div>
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400">{t('token.revenue')}</p>
            <p className="text-xl font-bold text-gray-900 dark:text-gray-100">{formatINR(stats.revenue)}</p>
          </div>
        </Card>
        <Card className="p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 flex items-center justify-center flex-shrink-0">
            <Award size={18} />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-gray-500 dark:text-gray-400">{t('token.topType')}</p>
            <p className="text-sm font-bold text-gray-900 dark:text-gray-100 truncate">
              {stats.topType}{stats.topCount > 0 ? ` (${stats.topCount})` : ''}
            </p>
          </div>
        </Card>
      </div>

      {/* Token history */}
      <Card className="p-4 mb-4">
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => shiftHistoryDate(-1)} className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700">
            <ChevronLeft size={18} />
          </button>
          <input
            type="date"
            value={historyDate}
            onChange={e => setHistoryDate(e.target.value)}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
          <button type="button" onClick={() => shiftHistoryDate(1)} className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700">
            <ChevronRight size={18} />
          </button>
          {!isHistoryToday && (
            <Button size="sm" variant="ghost" onClick={() => setHistoryDate(todayStr())}>
              {t('daybook.today')}
            </Button>
          )}
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={15} />
            <input
              value={historySearch}
              onChange={e => setHistorySearch(e.target.value)}
              placeholder={t('token.searchPlaceholder')}
              className="w-full pl-9 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <Button variant="outline" size="sm" leftIcon={<Download size={14} />} onClick={handleExport}>
            {t('daybook.exportExcel')}
          </Button>
        </div>
      </Card>

      <Card className="p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">{t('token.todaysTokens')}</h3>
        {tokensLoading ? (
          <div className="flex justify-center py-8"><Spinner size="lg" /></div>
        ) : visibleTokens.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <Ticket size={48} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">{t('token.noneToday')}</p>
          </div>
        ) : (
          <div className="space-y-2">
            {visibleTokens.map(token => {
              const Icon = TOKEN_ICONS[token.tokenType?.icon ?? 'ticket'] ?? Ticket
              return (
                <div key={token.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={clsx('w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0', TOKEN_COLORS[token.tokenType?.color ?? 'blue'] ?? TOKEN_COLORS.blue)}>
                      <Icon size={16} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                        #{token.tokenNumber} · {token.tokenType?.name ?? token.sale?.items?.[0]?.productName ?? 'Token'}
                      </p>
                      <p className="text-xs text-gray-400">
                        {token.sale?.paymentMethod?.toUpperCase()} · {new Date(token.createdAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <span className="text-sm font-semibold text-emerald-600">
                      {formatINR(token.sale?.grandTotal ?? 0)}
                    </span>
                    <button
                      onClick={() => printToken(token)}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                      title={t('token.reprint')}
                    >
                      <Printer size={15} />
                    </button>
                    <button
                      onClick={() => handleCancelToken(token)}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                      title={t('token.cancel')}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </Card>

      {/* Issue confirm modal */}
      <Modal isOpen={!!issuingType} onClose={closeIssue} title={issuingType?.name ?? ''} size="sm">
        {issuingType && (
          <div className="space-y-4">
            {issuingType.price === null && (
              <Input
                label={t('token.amount')}
                type="number"
                step="0.01"
                value={issueAmount}
                onChange={e => setIssueAmount(e.target.value)}
                placeholder="0.00"
                autoFocus
              />
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('token.quantity')}
              </label>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setIssueQty(q => Math.max(1, q - 1))}
                  className="w-9 h-9 rounded-lg border border-gray-300 dark:border-gray-600 flex items-center justify-center text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  <Minus size={14} />
                </button>
                <span className="w-10 text-center font-semibold text-gray-900 dark:text-gray-100">{issueQty}</span>
                <button
                  type="button"
                  onClick={() => setIssueQty(q => q + 1)}
                  className="w-9 h-9 rounded-lg border border-gray-300 dark:border-gray-600 flex items-center justify-center text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  <Plus size={14} />
                </button>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('token.paymentMethod')}
              </label>
              <div className="flex gap-2">
                {PAYMENT_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setIssuePayment(opt.value as 'cash' | 'upi' | 'card')}
                    className={clsx(
                      'flex-1 py-2 rounded-lg text-sm font-medium border transition-colors',
                      issuePayment === opt.value
                        ? 'bg-blue-600 border-blue-600 text-white'
                        : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex justify-between items-center pt-2 border-t border-gray-100 dark:border-gray-700">
              <span className="text-sm text-gray-500">{t('daybook.net')}</span>
              <span className="text-lg font-bold text-gray-900 dark:text-gray-100">
                {formatINR((parseFloat(issueAmount) || 0) * issueQty)}
              </span>
            </div>
            <Button className="w-full" leftIcon={<Printer size={16} />} loading={isIssuing} onClick={handleIssue}>
              {t('token.issueAndPrint')}
            </Button>
          </div>
        )}
      </Modal>

      {/* Manage token types modal */}
      <Modal isOpen={manageOpen} onClose={() => setManageOpen(false)} title={t('token.manageTypes')} size="md">
        <div className="space-y-6">
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('token.typeName')}
                <FieldInfo textKey="tip.tokenType.name" />
              </label>
              <Input
                value={typeForm.name}
                onChange={e => setTypeForm(prev => ({ ...prev, name: e.target.value }))}
                placeholder="e.g. Chai Token"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('token.fixedPrice')}
                  <FieldInfo textKey="tip.tokenType.price" />
                </label>
                <Input
                  type="number"
                  step="0.01"
                  value={typeForm.price}
                  onChange={e => setTypeForm(prev => ({ ...prev, price: e.target.value }))}
                  placeholder={t('token.variableAmount')}
                />
              </div>
              <Input
                label={t('token.taxRate')}
                type="number"
                step="0.01"
                value={typeForm.taxRate}
                onChange={e => setTypeForm(prev => ({ ...prev, taxRate: e.target.value }))}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                {t('token.icon')}
              </label>
              <div className="flex flex-wrap gap-2">
                {ICON_KEYS.map(key => {
                  const Icon = TOKEN_ICONS[key]
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setTypeForm(prev => ({ ...prev, icon: key }))}
                      className={clsx(
                        'w-10 h-10 rounded-lg flex items-center justify-center border-2 transition-colors',
                        TOKEN_COLORS[typeForm.color] ?? TOKEN_COLORS.blue,
                        typeForm.icon === key ? 'border-blue-500' : 'border-transparent opacity-60 hover:opacity-100'
                      )}
                    >
                      <Icon size={18} />
                    </button>
                  )
                })}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                {t('token.color')}
              </label>
              <div className="flex flex-wrap gap-2">
                {COLOR_KEYS.map(key => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setTypeForm(prev => ({ ...prev, color: key }))}
                    className={clsx(
                      'w-8 h-8 rounded-full border-2 transition-transform',
                      TOKEN_COLORS[key],
                      typeForm.color === key ? 'border-gray-900 dark:border-white scale-110' : 'border-transparent'
                    )}
                  />
                ))}
              </div>
            </div>

            <div className="flex gap-2 justify-end">
              {editingId && (
                <Button variant="ghost" onClick={resetTypeForm} leftIcon={<X size={14} />}>
                  {t('action.cancel')}
                </Button>
              )}
              <Button
                onClick={handleSaveType}
                loading={isCreatingType || isUpdatingType}
                disabled={!typeForm.name.trim()}
                leftIcon={editingId ? <Pencil size={14} /> : <Plus size={14} />}
              >
                {editingId ? t('action.update') : t('token.addTokenType')}
              </Button>
            </div>
          </div>

          <div className="border-t border-gray-100 dark:border-gray-700 pt-4 space-y-2 max-h-64 overflow-y-auto">
            {sortedTypes.map((tt, index) => {
              const Icon = TOKEN_ICONS[tt.icon] ?? Ticket
              return (
                <div key={tt.id} className="flex items-center justify-between p-2.5 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className={clsx('w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0', TOKEN_COLORS[tt.color] ?? TOKEN_COLORS.blue)}>
                      <Icon size={14} />
                    </div>
                    <div className="min-w-0">
                      <p className={clsx('text-sm font-medium truncate', tt.isActive ? 'text-gray-900 dark:text-gray-100' : 'text-gray-400 line-through')}>
                        {tt.name}
                      </p>
                      <p className="text-xs text-gray-400">
                        {tt.price !== null ? formatINR(tt.price) : t('token.variableAmount')}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-0.5 flex-shrink-0">
                    <button type="button" disabled={index === 0} onClick={() => moveType(index, -1)} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-30 disabled:hover:bg-transparent">
                      <ArrowUp size={13} />
                    </button>
                    <button type="button" disabled={index === sortedTypes.length - 1} onClick={() => moveType(index, 1)} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-30 disabled:hover:bg-transparent">
                      <ArrowDown size={13} />
                    </button>
                    <button
                      type="button"
                      onClick={() => updateTokenType({ tokenTypeId: tt.id, data: { isActive: !tt.isActive } })}
                      className="px-2 py-1 text-xs rounded-lg text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-600"
                    >
                      {tt.isActive ? t('common.active') : t('common.inactive')}
                    </button>
                    <button onClick={() => openEditType(tt)} className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20">
                      <Pencil size={14} />
                    </button>
                    <button onClick={() => handleDeleteType(tt)} className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </Modal>
    </div>
  )
}
