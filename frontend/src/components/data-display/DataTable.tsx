import { useState, useMemo } from 'react'
import { Input } from '@/components/ui/Input'
import { EmptyState } from '@/components/ui/EmptyState'
import { Spinner } from '@/components/ui/Spinner'
import { clsx } from 'clsx'

export interface ColumnDef<T> {
  key: string
  header: string | (() => React.ReactNode)
  render: (row: T) => React.ReactNode
  sortable?: boolean
}

interface DataTableProps<T> {
  data: T[]
  columns: ColumnDef<T>[]
  loading?: boolean
  searchable?: boolean
  pagination?: boolean
  onRowClick?: (row: T) => void
  emptyMessage?: string
  pageSize?: number
}

export function DataTable<T>({
  data,
  columns,
  loading,
  searchable = true,
  pagination = true,
  onRowClick,
  emptyMessage = 'No data found',
  pageSize = 10,
}: DataTableProps<T>) {
  const [search, setSearch] = useState('')
  const [sortColumn, setSortColumn] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [page, setPage] = useState(0)

  const filtered = useMemo(() => {
    let result = data
    if (search) {
      const lower = search.toLowerCase()
      result = result.filter(row =>
        Object.values(row as Record<string, unknown>).some(val =>
          String(val).toLowerCase().includes(lower)
        )
      )
    }
    if (sortColumn) {
      result = [...result].sort((a, b) => {
        const aVal = String((a as Record<string, unknown>)[sortColumn] ?? '')
        const bVal = String((b as Record<string, unknown>)[sortColumn] ?? '')
        return sortDir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal)
      })
    }
    return result
  }, [data, search, sortColumn, sortDir])

  const totalPages = Math.ceil(filtered.length / pageSize)
  const paginated = pagination ? filtered.slice(page * pageSize, (page + 1) * pageSize) : filtered

  const handleSort = (key: string) => {
    if (sortColumn === key) {
      setSortDir(d => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortColumn(key)
      setSortDir('asc')
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Spinner size="lg" />
      </div>
    )
  }

  return (
    <div>
      {searchable && data.length > 0 && (
        <div className="mb-3">
          <Input
            placeholder="Search..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(0) }}
          />
        </div>
      )}

      {filtered.length === 0 ? (
        <EmptyState title={emptyMessage} />
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-800">
                <tr>
                  {columns.map(col => (
                    <th
                      key={col.key}
                      onClick={() => col.sortable && handleSort(col.key)}
                      className={clsx(
                        'px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider',
                        col.sortable && 'cursor-pointer hover:text-gray-700 dark:hover:text-gray-200'
                      )}
                    >
                      {typeof col.header === 'function' ? col.header() : col.header}
                      {sortColumn === col.key && <span className="ml-1">{sortDir === 'asc' ? '↑' : '↓'}</span>}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
                {paginated.map((row, i) => (
                  <tr
                    key={i}
                    onClick={() => onRowClick?.(row)}
                    className={clsx(onRowClick && 'cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800')}
                  >
                    {columns.map(col => (
                      <td key={col.key} className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                        {col.render(row)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile card layout */}
          <div className="sm:hidden space-y-2">
            {paginated.map((row, i) => (
              <div
                key={i}
                onClick={() => onRowClick?.(row)}
                className={clsx(
                  'bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-3',
                  onRowClick && 'cursor-pointer active:bg-gray-50 dark:active:bg-gray-700'
                )}
              >
                {columns.map(col => {
                  const label = typeof col.header === 'function' ? null : col.header
                  return (
                    <div key={col.key} className="flex items-start justify-between py-1 gap-2">
                      {label && (
                        <span className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wide flex-shrink-0 pt-0.5 min-w-[80px]">
                          {label}
                        </span>
                      )}
                      <div className={clsx('text-sm text-gray-900 dark:text-gray-100', label ? 'text-right' : 'w-full')}>
                        {col.render(row)}
                      </div>
                    </div>
                  )
                })}
              </div>
            ))}
          </div>

          {pagination && totalPages > 1 && (
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mt-4">
              <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 text-center sm:text-left">
                Showing {page * pageSize + 1}–{Math.min((page + 1) * pageSize, filtered.length)} of {filtered.length}
              </p>
              <div className="flex gap-2 justify-center">
                <button
                  disabled={page === 0}
                  onClick={() => setPage(p => p - 1)}
                  className="flex-1 sm:flex-none px-4 py-2 text-sm border rounded-lg disabled:opacity-50 dark:border-gray-600 dark:text-gray-300 min-w-[80px]"
                >
                  ← Prev
                </button>
                <button
                  disabled={page >= totalPages - 1}
                  onClick={() => setPage(p => p + 1)}
                  className="flex-1 sm:flex-none px-4 py-2 text-sm border rounded-lg disabled:opacity-50 dark:border-gray-600 dark:text-gray-300 min-w-[80px]"
                >
                  Next →
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
