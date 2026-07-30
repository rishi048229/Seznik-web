import { useState } from 'react'
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
import { Ticket, Plus, Pencil, Trash2, Settings2, Printer, X, Minus } from 'lucide-react'
import toast from 'react-hot-toast'
import type { TokenType, Token } from '@/types/token.types'
import type { Sale } from '@/types/sale.types'

const ICON_COLORS = [
  'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400',
  'bg-sky-100 text-sky-600 dark:bg-sky-900/30 dark:text-sky-400',
  'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400',
  'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400',
  'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400',
  'bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400',
]

const todayStr = () => new Date().toISOString().split('T')[0]

const PAYMENT_OPTIONS = [
  { value: 'cash', label: 'Cash' },
  { value: 'upi', label: 'UPI' },
  { value: 'card', label: 'Card' },
]

export const QuickTokensPage = () => {
  const { t } = useLanguage()
  const { data: tokenTypes, isLoading: typesLoading } = useTokenTypes()
  const { data: tokens, isLoading: tokensLoading } = useTokens(todayStr())
  const { data: settings } = useSettings()
  const { mutate: createTokenType, isPending: isCreatingType } = useCreateTokenType()
  const { mutate: updateTokenType, isPending: isUpdatingType } = useUpdateTokenType()
  const { mutate: deleteTokenType } = useDeleteTokenType()
  const { mutate: issueToken, isPending: isIssuing } = useIssueToken()
  const { mutate: deleteToken } = useDeleteToken()

  const activeTypes = (tokenTypes ?? []).filter(tt => tt.isActive)

  // Manage token types modal
  const [manageOpen, setManageOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [typeForm, setTypeForm] = useState({ name: '', price: '', taxRate: '0' })

  const resetTypeForm = () => {
    setEditingId(null)
    setTypeForm({ name: '', price: '', taxRate: '0' })
  }

  const openEditType = (tt: TokenType) => {
    setEditingId(tt.id)
    setTypeForm({ name: tt.name, price: tt.price === null ? '' : String(tt.price), taxRate: String(tt.taxRate) })
  }

  const handleSaveType = () => {
    if (!typeForm.name.trim()) return
    const payload = {
      name: typeForm.name.trim(),
      price: typeForm.price.trim() === '' ? null : parseFloat(typeForm.price),
      taxRate: typeForm.taxRate ? parseFloat(typeForm.taxRate) : 0,
    }
    if (editingId) {
      updateTokenType({ tokenTypeId: editingId, data: payload }, {
        onSuccess: () => { toast.success('Token type updated'); resetTypeForm() },
        onError: (err) => toast.error(err instanceof Error ? err.message : 'Failed to update token type'),
      })
    } else {
      createTokenType(payload, {
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
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {activeTypes.map((tt, index) => (
              <button
                key={tt.id}
                type="button"
                onClick={() => openIssue(tt)}
                className="flex flex-col items-center justify-center gap-2 p-5 rounded-xl border border-gray-100 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-600 hover:shadow-md transition-all active:scale-[0.97] bg-white dark:bg-gray-800"
              >
                <div className={clsx('w-12 h-12 rounded-full flex items-center justify-center', ICON_COLORS[index % ICON_COLORS.length])}>
                  <Ticket size={22} />
                </div>
                <span className="text-sm font-semibold text-gray-900 dark:text-gray-100 text-center">{tt.name}</span>
                <span className="text-xs text-gray-400">
                  {tt.price !== null ? formatINR(tt.price) : t('token.variableAmount')}
                </span>
              </button>
            ))}
          </div>
        )}
      </Card>

      {/* Today's tokens */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">{t('token.todaysTokens')}</h3>
        {tokensLoading ? (
          <div className="flex justify-center py-8"><Spinner size="lg" /></div>
        ) : !tokens || tokens.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <Ticket size={48} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">{t('token.noneToday')}</p>
          </div>
        ) : (
          <div className="space-y-2">
            {tokens.map(token => (
              <div key={token.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold text-sm flex-shrink-0">
                    #{token.tokenNumber}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                      {token.tokenType?.name ?? token.sale?.items?.[0]?.productName ?? 'Token'}
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
            ))}
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
            {(tokenTypes ?? []).map(tt => (
              <div key={tt.id} className="flex items-center justify-between p-2.5 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <div className="min-w-0">
                  <p className={clsx('text-sm font-medium truncate', tt.isActive ? 'text-gray-900 dark:text-gray-100' : 'text-gray-400 line-through')}>
                    {tt.name}
                  </p>
                  <p className="text-xs text-gray-400">
                    {tt.price !== null ? formatINR(tt.price) : t('token.variableAmount')}
                  </p>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
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
            ))}
          </div>
        </div>
      </Modal>
    </div>
  )
}
