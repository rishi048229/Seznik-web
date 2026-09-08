import { useMemo, useState } from 'react'
import { Card } from '@/components/ui/Card'
import { Select } from '@/components/ui/Select'
import { useLanguage } from '@/contexts/LanguageContext'
import { formatINR } from '@/utils/currency'
import { buildGstLedger, formatGstRate, type GstLedger } from '@/utils/gstLedger'
import type { Product } from '@/types/product.types'
import type { Purchase } from '@/types/purchase.types'
import type { Sale } from '@/types/sale.types'
import { ArrowDownLeft, ArrowUpRight, Scale } from 'lucide-react'

export function useGstLedger(args: {
  sales: Sale[] | undefined
  purchases: Purchase[] | undefined
  products: Product[] | undefined
  startTs: number
  endTs: number
}): GstLedger {
  const { sales, purchases, products, startTs, endTs } = args
  return useMemo(
    () => buildGstLedger({
      sales,
      purchases,
      products,
      startTs,
      endTs,
      inRange: (ts) => ts >= startTs && ts < endTs,
    }),
    [sales, purchases, products, startTs, endTs],
  )
}

export const GstLedgerPanel = ({
  ledger,
  compact = false,
  onView,
  viewLabel,
}: {
  ledger: GstLedger
  compact?: boolean
  onView?: () => void
  viewLabel?: string
}) => {
  const { t } = useLanguage()
  const [rateFilter, setRateFilter] = useState('all')

  const rateOptions = [
    { value: 'all', label: t('gst.allRates') },
    ...ledger.rates.map(r => ({
      value: String(r.rate),
      label: `${formatGstRate(r.rate)} · ${formatINR(r.tax)}`,
    })),
  ]

  const selectedRate = rateFilter === 'all' ? null : Number(rateFilter)
  const productRows = selectedRate === null
    ? ledger.products
    : ledger.rates.find(r => r.rate === selectedRate)?.products ?? []
  const productTax = productRows.reduce((s, r) => s + r.tax, 0)
  const productTaxable = productRows.reduce((s, r) => s + r.taxable, 0)

  return (
    <Card className="p-4 sm:p-5 border border-gray-100 shadow-sm rounded-2xl">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{compact ? t('gst.todayTitle') : t('gst.title')}</h2>
          <p className="text-xs text-gray-400 mt-0.5">{t('gst.notAReturn')}</p>
        </div>
        {onView && (
          <button type="button" onClick={onView} className="text-xs font-medium text-blue-600 hover:text-blue-700 shrink-0">
            {viewLabel ?? t('gst.viewDaybook')}
          </button>
        )}
      </div>

      <div className={`grid gap-3 mb-4 ${compact ? 'grid-cols-3' : 'grid-cols-1 sm:grid-cols-3'}`}>
        <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/30 p-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300 flex items-center gap-1">
            <ArrowDownLeft size={12} /> {t('gst.collected')}
          </p>
          <p className="text-lg sm:text-xl font-bold text-emerald-700 dark:text-emerald-300 mt-1">{formatINR(ledger.collected)}</p>
          <p className="text-[11px] text-emerald-800/70 dark:text-emerald-200/70">{t('gst.fromCustomers')}</p>
        </div>
        <div className="rounded-xl bg-amber-50 dark:bg-amber-950/30 p-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300 flex items-center gap-1">
            <ArrowUpRight size={12} /> {t('gst.paid')}
          </p>
          <p className="text-lg sm:text-xl font-bold text-amber-700 dark:text-amber-300 mt-1">{formatINR(ledger.paid)}</p>
          <p className="text-[11px] text-amber-800/70 dark:text-amber-200/70">{t('gst.onPurchases')}</p>
        </div>
        <div className="rounded-xl bg-blue-50 dark:bg-blue-950/30 p-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-blue-700 dark:text-blue-300 flex items-center gap-1">
            <Scale size={12} /> {t('gst.net')}
          </p>
          <p className="text-lg sm:text-xl font-bold text-blue-700 dark:text-blue-300 mt-1">{formatINR(ledger.net)}</p>
          <p className="text-[11px] text-blue-800/70 dark:text-blue-200/70">
            {ledger.net >= 0 ? t('gst.netPayable') : t('gst.netCredit')}
          </p>
        </div>
      </div>

      {!compact && (
        <>
          <div className="flex flex-col sm:flex-row sm:items-end gap-3 mb-3">
            <div className="sm:w-72">
              <Select
                label={t('gst.rateDropdown')}
                value={rateFilter}
                onChange={e => setRateFilter(e.target.value)}
                options={rateOptions}
              />
            </div>
            <p className="text-xs text-gray-400 pb-2">
              {t('gst.taxable')}: {formatINR(selectedRate === null ? ledger.taxableSales : productTaxable)}
            </p>
          </div>

          {productRows.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">{t('gst.noLines')}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-[11px] uppercase tracking-wide text-gray-400 text-left">
                    <th className="pb-2 font-semibold">{t('gst.product')}</th>
                    <th className="pb-2 font-semibold">{t('gst.rate')}</th>
                    <th className="pb-2 font-semibold text-right">{t('gst.qty')}</th>
                    <th className="pb-2 font-semibold text-right">{t('gst.taxable')}</th>
                    <th className="pb-2 font-semibold text-right">{t('gst.collected')}</th>
                  </tr>
                </thead>
                <tbody>
                  {productRows.map(row => (
                    <tr key={row.key} className="border-t border-gray-100 dark:border-gray-800">
                      <td className="py-2 pr-3 text-gray-900 dark:text-gray-100">{row.productName}</td>
                      <td className="py-2 text-gray-500">{formatGstRate(row.rate)}</td>
                      <td className="py-2 text-right text-gray-500">{row.quantity}</td>
                      <td className="py-2 text-right text-gray-700 dark:text-gray-300">{formatINR(row.taxable)}</td>
                      <td className="py-2 text-right font-semibold text-emerald-700 dark:text-emerald-300">{formatINR(row.tax)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-gray-200 dark:border-gray-700">
                    <td className="pt-2 font-semibold" colSpan={3}>{t('common.total')}</td>
                    <td className="pt-2 text-right font-semibold">{formatINR(productTaxable)}</td>
                    <td className="pt-2 text-right font-bold text-emerald-700">{formatINR(productTax)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </>
      )}
    </Card>
  )
}
