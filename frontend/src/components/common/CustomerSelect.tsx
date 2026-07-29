import { useState, useRef, useEffect, useMemo } from 'react'
import { Search, ChevronDown, UserPlus, Check, X, User } from 'lucide-react'
import { useCustomers } from '@/hooks/useCustomers'
import { useLanguage } from '@/contexts/LanguageContext'
import { QuickAddCustomerModal } from './QuickAddCustomerModal'

interface CustomerSelectProps {
  value: string
  onChange: (customerId: string) => void
  /** 'compact' matches the slim POS checkout row; 'default' is the taller POS-Lite field. */
  size?: 'compact' | 'default'
  className?: string
}

// Searchable customer picker for the checkout panel: filter by name or phone,
// and create a brand-new customer inline without leaving the sale.
export const CustomerSelect = ({ value, onChange, size = 'compact', className }: CustomerSelectProps) => {
  const { t } = useLanguage()
  const { data: customers } = useCustomers()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [isAddOpen, setIsAddOpen] = useState(false)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  const selected = customers?.find(c => c.id === value) ?? null

  useEffect(() => {
    if (!open) return
    const handleClickOutside = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false)
        setQuery('')
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  // Focus the search box as soon as the list opens so staff can just start typing.
  useEffect(() => {
    if (open) setTimeout(() => searchRef.current?.focus(), 30)
  }, [open])

  const filtered = useMemo(() => {
    const list = customers ?? []
    const q = query.trim().toLowerCase()
    if (!q) return list
    return list.filter(c =>
      c.name.toLowerCase().includes(q) ||
      (c.phone ?? '').toLowerCase().includes(q)
    )
  }, [customers, query])

  const heightClass = size === 'compact' ? 'h-9 text-sm' : 'py-3 text-sm'
  const iconSize = size === 'compact' ? 16 : 18

  const handleSelect = (id: string) => {
    onChange(id)
    setOpen(false)
    setQuery('')
  }

  return (
    <>
      <div ref={wrapperRef} className={`relative ${className ?? ''}`}>
        {/* Trigger */}
        <button
          type="button"
          onClick={() => setOpen(v => !v)}
          className={`w-full ${heightClass} pl-9 pr-9 rounded-lg flex items-center text-left transition-colors ${
            size === 'compact'
              ? 'bg-gray-50 dark:bg-gray-700/40 border-0 hover:bg-gray-100 dark:hover:bg-gray-700/60'
              : 'bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-xl hover:border-gray-400 dark:hover:border-gray-500'
          } dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500/20`}
        >
          <span className={`truncate ${selected ? '' : 'text-gray-500 dark:text-gray-400'}`}>
            {selected ? selected.name : t('pos.walkInCustomer')}
          </span>
          {selected?.phone && (
            <span className="ml-2 text-xs text-gray-400 truncate hidden sm:inline">{selected.phone}</span>
          )}
        </button>

        {/* Left icon — also the quick "add customer" shortcut */}
        <button
          type="button"
          onClick={() => setIsAddOpen(true)}
          title="Add new customer"
          aria-label="Add new customer"
          className={`absolute left-2 top-1/2 -translate-y-1/2 z-10 ${
            size === 'compact' ? 'w-6 h-6' : 'w-7 h-7'
          } flex items-center justify-center rounded-md text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors`}
        >
          <UserPlus size={iconSize} />
        </button>

        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
          <ChevronDown size={iconSize} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
        </div>

        {/* Dropdown */}
        {open && (
          <div className="absolute left-0 right-0 top-full mt-1.5 z-40 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-2xl overflow-hidden">
            {/* Search */}
            <div className="p-2 border-b border-gray-100 dark:border-gray-700">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                <input
                  ref={searchRef}
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder={t('customers.searchPlaceholder')}
                  className="w-full h-9 pl-8 pr-8 rounded-lg bg-gray-50 dark:bg-gray-700/50 border-0 text-sm dark:text-gray-100 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
                {query && (
                  <button
                    type="button"
                    onClick={() => { setQuery(''); searchRef.current?.focus() }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    <X size={13} />
                  </button>
                )}
              </div>
            </div>

            {/* Add new customer */}
            <button
              type="button"
              onClick={() => { setIsAddOpen(true); setOpen(false); setQuery('') }}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left text-sm font-semibold text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors border-b border-gray-100 dark:border-gray-700"
            >
              <span className="w-7 h-7 rounded-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center flex-shrink-0">
                <UserPlus size={14} />
              </span>
              {t('customers.addCustomer')}
            </button>

            {/* Options */}
            <div className="max-h-56 overflow-y-auto">
              {/* Walk-in */}
              <button
                type="button"
                onClick={() => handleSelect('')}
                className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 text-left text-sm transition-colors ${
                  !value
                    ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                    : 'text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                }`}
              >
                <span className="flex items-center gap-2.5 min-w-0">
                  <span className="w-7 h-7 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center flex-shrink-0 text-gray-400">
                    <User size={14} />
                  </span>
                  <span className="truncate">{t('pos.walkInCustomer')}</span>
                </span>
                {!value && <Check size={15} className="flex-shrink-0" />}
              </button>

              {filtered.map(customer => {
                const isSelected = customer.id === value
                const initials = customer.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
                return (
                  <button
                    key={customer.id}
                    type="button"
                    onClick={() => handleSelect(customer.id)}
                    className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 text-left text-sm transition-colors ${
                      isSelected
                        ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                        : 'text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                    }`}
                  >
                    <span className="flex items-center gap-2.5 min-w-0">
                      <span className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-600 to-sky-400 text-white text-[10px] font-bold flex items-center justify-center flex-shrink-0">
                        {initials}
                      </span>
                      <span className="min-w-0">
                        <span className="block font-medium truncate">{customer.name}</span>
                        {customer.phone && (
                          <span className="block text-[11px] text-gray-400 truncate">{customer.phone}</span>
                        )}
                      </span>
                    </span>
                    {isSelected && <Check size={15} className="flex-shrink-0" />}
                  </button>
                )
              })}

              {filtered.length === 0 && (
                <div className="px-3 py-6 text-center">
                  <p className="text-xs text-gray-400">No customer matches "{query}"</p>
                  <button
                    type="button"
                    onClick={() => { setIsAddOpen(true); setOpen(false) }}
                    className="mt-2 text-xs font-semibold text-blue-600 hover:underline"
                  >
                    Add "{query.trim()}" as a new customer
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <QuickAddCustomerModal
        isOpen={isAddOpen}
        onClose={() => setIsAddOpen(false)}
        initialName={filtered.length === 0 ? query.trim() : ''}
        onCreated={(customerId) => {
          onChange(customerId)
          setIsAddOpen(false)
          setOpen(false)
          setQuery('')
        }}
      />
    </>
  )
}
