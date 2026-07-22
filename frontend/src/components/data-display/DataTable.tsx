import { useState, useMemo } from 'react'
import { Input } from '@/components/ui/Input'
import { EmptyState } from '@/components/ui/EmptyState'
import { TableSkeleton } from '@/components/ui/TableSkeleton'
import { ChevronLeft, ChevronRight, Search } from 'lucide-react'
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
  pageSize: initialPageSize = 10,
}: DataTableProps<T>) {
  const [search, setSearch] = useState('')
  const [sortColumn, setSortColumn] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(initialPageSize)

  const filtered = useMemo(() => {
    let result = data
    if (search) {
      const lower = search.toLowerCase()
      result = result.filter(row =>
        Object.values(row as Record<string, unknown>).some(val =>
          val !== null && val !== undefined && String(val).toLowerCase().includes(lower)
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

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const currentPage = Math.min(page, totalPages - 1)
  const paginated = pagination ? filtered.slice(currentPage * pageSize, (currentPage + 1) * pageSize) : filtered

  const handleSort = (key: string) => {
    if (sortColumn === key) {
      setSortDir(d => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortColumn(key)
      setSortDir('asc')
    }
  }

  // Generate page numbers array for pagination buttons
  const getPageNumbers = () => {
    const pages: (number | string)[] = []
    if (totalPages <= 7) {
      for (let i = 0; i < totalPages; i++) pages.push(i)
    } else {
      pages.push(0)
      if (currentPage > 2) pages.push('...')
      
      const start = Math.max(1, currentPage - 1)
      const end = Math.min(totalPages - 2, currentPage + 1)
      for (let i = start; i <= end; i++) pages.push(i)
      
      if (currentPage < totalPages - 3) pages.push('...')
      pages.push(totalPages - 1)
    }
    return pages
  }

  if (loading) {
    return <TableSkeleton rows={pageSize} columns={columns.length} />
  }

  return (
    <div className="w-full space-y-4">
      {searchable && data.length > 0 && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <Input
              placeholder="Search..."
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(0) }}
              className="pl-10"
            />
          </div>
          {pagination && filtered.length > 10 && (
            <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 self-end sm:self-auto">
              <span>Show</span>
              <select
                value={pageSize}
                onChange={e => { setPageSize(Number(e.target.value)); setPage(0) }}
                className="px-2 py-1.5 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              >
                <option value={5}>5</option>
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
              <span>per page</span>
            </div>
          )}
        </div>
      )}

      {filtered.length === 0 ? (
        <EmptyState title={emptyMessage} />
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden sm:block overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700/80 shadow-sm">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50/80 dark:bg-gray-800/80 backdrop-blur">
                <tr>
                  {columns.map(col => (
                    <th
                      key={col.key}
                      onClick={() => col.sortable && handleSort(col.key)}
                      className={clsx(
                        'px-4 py-3.5 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider select-none',
                        col.sortable && 'cursor-pointer hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors'
                      )}
                    >
                      <div className="flex items-center gap-1.5">
                        <span>{typeof col.header === 'function' ? col.header() : col.header}</span>
                        {sortColumn === col.key && (
                          <span className="text-indigo-600 dark:text-indigo-400 font-bold">
                            {sortDir === 'asc' ? '↑' : '↓'}
                          </span>
                        )}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-100 dark:divide-gray-800">
                {paginated.map((row, i) => (
                  <tr
                    key={i}
                    onClick={() => onRowClick?.(row)}
                    className={clsx(
                      'transition-colors duration-150',
                      onRowClick ? 'cursor-pointer hover:bg-indigo-50/40 dark:hover:bg-indigo-900/10' : 'hover:bg-gray-50/60 dark:hover:bg-gray-800/40'
                    )}
                  >
                    {columns.map(col => (
                      <td key={col.key} className="px-4 py-3.5 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                        {col.render(row)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile card layout */}
          <div className="sm:hidden space-y-2.5">
            {paginated.map((row, i) => (
              <div
                key={i}
                onClick={() => onRowClick?.(row)}
                className={clsx(
                  'bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700/80 p-3.5 shadow-sm transition-all',
                  onRowClick && 'cursor-pointer active:scale-[0.99] active:bg-gray-50 dark:active:bg-gray-700/60'
                )}
              >
                {columns.map(col => {
                  const label = typeof col.header === 'function' ? null : col.header
                  return (
                    <div key={col.key} className="flex items-start justify-between py-1.5 gap-2 border-b border-gray-50 dark:border-gray-700/40 last:border-none">
                      {label && (
                        <span className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide flex-shrink-0 pt-0.5 min-w-[80px]">
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

          {/* Pagination Controls */}
          {pagination && totalPages > 1 && (
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-3 px-1">
              <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 text-center sm:text-left font-medium">
                Showing <span className="font-semibold text-gray-900 dark:text-gray-100">{currentPage * pageSize + 1}</span> to{' '}
                <span className="font-semibold text-gray-900 dark:text-gray-100">{Math.min((currentPage + 1) * pageSize, filtered.length)}</span> of{' '}
                <span className="font-semibold text-gray-900 dark:text-gray-100">{filtered.length}</span> results
              </p>

              <div className="flex items-center justify-center gap-1.5">
                <button
                  disabled={currentPage === 0}
                  onClick={() => setPage(p => Math.max(0, p - 1))}
                  className="p-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition-all text-gray-600 dark:text-gray-300"
                  aria-label="Previous page"
                >
                  <ChevronLeft size={16} />
                </button>

                {getPageNumbers().map((pNum, index) => (
                  typeof pNum === 'number' ? (
                    <button
                      key={index}
                      onClick={() => setPage(pNum)}
                      className={clsx(
                        'w-8 h-8 rounded-lg text-xs font-semibold transition-all',
                        currentPage === pNum
                          ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-500/30'
                          : 'border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                      )}
                    >
                      {pNum + 1}
                    </button>
                  ) : (
                    <span key={index} className="px-1 text-xs text-gray-400 font-bold select-none">
                      ...
                    </span>
                  )
                ))}

                <button
                  disabled={currentPage >= totalPages - 1}
                  onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                  className="p-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition-all text-gray-600 dark:text-gray-300"
                  aria-label="Next page"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
