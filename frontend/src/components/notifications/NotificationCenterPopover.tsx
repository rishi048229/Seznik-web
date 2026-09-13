import { useState, useRef, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { 
  Bell, 
  CreditCard, 
  Building2, 
  AlertTriangle, 
  Package, 
  CheckCheck, 
  RefreshCw, 
  ArrowUpRight, 
  PhoneCall, 
  MessageSquare, 
  TrendingUp, 
  Sparkles,
  ExternalLink,
  X
} from 'lucide-react'
import { useNotificationFeed } from '@/hooks/useNotifications'
import { formatINR } from '@/utils/currency'
import { ROUTES } from '@/constants/routes'
import type { StoreNotification } from '@/services/notificationService'

export const NotificationCenterPopover = () => {
  const navigate = useNavigate()
  const [isOpen, setIsOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<'all' | 'dues' | 'stock' | 'sales'>('all')
  const [readIds, setReadIds] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem('seznik_read_notifications')
      return saved ? new Set(JSON.parse(saved)) : new Set()
    } catch {
      return new Set()
    }
  })

  const popoverRef = useRef<HTMLDivElement>(null)
  const { data, isLoading, refetch, isRefetching } = useNotificationFeed()

  const notifications = data?.notifications ?? []

  // Persist read IDs
  const markAsRead = (id: string) => {
    setReadIds(prev => {
      const updated = new Set(prev)
      updated.add(id)
      try {
        localStorage.setItem('seznik_read_notifications', JSON.stringify(Array.from(updated)))
      } catch {}
      return updated
    })
  }

  const markAllAsRead = () => {
    const allIds = notifications.map(n => n.id)
    const updated = new Set([...Array.from(readIds), ...allIds])
    setReadIds(updated)
    try {
      localStorage.setItem('seznik_read_notifications', JSON.stringify(Array.from(updated)))
    } catch {}
  }

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen])

  // Count unread
  const unreadCount = useMemo(() => {
    return notifications.filter(n => !readIds.has(n.id)).length
  }, [notifications, readIds])

  // Filtered notifications
  const filteredNotifications = useMemo(() => {
    if (activeTab === 'dues') {
      return notifications.filter(n => n.type === 'credit_due' || n.type === 'purchase_due')
    }
    if (activeTab === 'stock') {
      return notifications.filter(n => n.type === 'out_of_stock' || n.type === 'low_stock')
    }
    if (activeTab === 'sales') {
      return notifications.filter(n => n.type === 'daily_sales_summary' || n.type === 'weekly_summary')
    }
    return notifications
  }, [notifications, activeTab])

  const openWhatsApp = (phone?: string, name?: string, amount?: number) => {
    if (!phone) return
    const cleanPhone = phone.replace(/[^0-9]/g, '')
    const fullPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone
    const text = encodeURIComponent(
      `Hello ${name || 'Customer'},\nThis is a friendly reminder regarding your pending balance of ${formatINR(amount || 0)} at our store.\nKindly clear your dues at your earliest convenience. Thank you!`
    )
    window.open(`https://wa.me/${fullPhone}?text=${text}`, '_blank')
  }

  return (
    <div className="relative inline-flex items-center justify-center" ref={popoverRef}>
      {/* Bell Button */}
      <button
        type="button"
        onClick={() => setIsOpen(prev => !prev)}
        className="relative w-9 h-9 flex items-center justify-center rounded-lg text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-dark-elevated transition-colors focus:outline-none cursor-pointer"
        title="Store Notifications"
        aria-label="Notifications"
      >
        <Bell size={18} className="text-gray-600 dark:text-gray-300 shrink-0" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 min-w-[16px] px-1 items-center justify-center rounded-full bg-red-600 text-[10px] font-bold text-white shadow-sm ring-2 ring-white dark:ring-dark-card pointer-events-none z-10">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>


      {/* Dropdown Popover */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-card shadow-2xl z-50 overflow-hidden flex flex-col max-h-[85vh] animate-in fade-in-50 zoom-in-95 duration-150">
          {/* Header */}
          <div className="p-3.5 border-b border-gray-100 dark:border-dark-border bg-slate-50/80 dark:bg-slate-900/50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold">
                <Bell size={16} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100 leading-tight">
                  Store Alerts & Reminders
                </h3>
                <p className="text-[11px] text-gray-500 dark:text-gray-400">
                  {unreadCount > 0 ? `${unreadCount} unread alert${unreadCount > 1 ? 's' : ''}` : 'All caught up'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => refetch()}
                disabled={isRefetching}
                title="Refresh Notifications"
                className="p-1.5 text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 rounded-lg hover:bg-gray-200/60 dark:hover:bg-dark-elevated transition-colors"
              >
                <RefreshCw size={14} className={isRefetching ? 'animate-spin' : ''} />
              </button>
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={markAllAsRead}
                  title="Mark all as read"
                  className="p-1.5 text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 rounded-lg hover:bg-gray-200/60 dark:hover:bg-dark-elevated transition-colors"
                >
                  <CheckCheck size={16} />
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-1.5 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 rounded-lg hover:bg-gray-200/60 dark:hover:bg-dark-elevated transition-colors sm:hidden"
              >
                <X size={15} />
              </button>
            </div>
          </div>

          {/* Filter Tabs */}
          <div className="flex items-center gap-1 px-3 py-2 border-b border-gray-100 dark:border-dark-border bg-white dark:bg-dark-card overflow-x-auto text-[11px] font-semibold">
            <button
              type="button"
              onClick={() => setActiveTab('all')}
              className={`px-2.5 py-1 rounded-lg transition-colors shrink-0 ${activeTab === 'all' ? 'bg-blue-600 text-white font-bold' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-dark-elevated'}`}
            >
              All ({notifications.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('dues')}
              className={`px-2.5 py-1 rounded-lg transition-colors shrink-0 ${activeTab === 'dues' ? 'bg-blue-600 text-white font-bold' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-dark-elevated'}`}
            >
              Payment Dues
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('stock')}
              className={`px-2.5 py-1 rounded-lg transition-colors shrink-0 ${activeTab === 'stock' ? 'bg-blue-600 text-white font-bold' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-dark-elevated'}`}
            >
              Stock Alerts
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('sales')}
              className={`px-2.5 py-1 rounded-lg transition-colors shrink-0 ${activeTab === 'sales' ? 'bg-blue-600 text-white font-bold' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-dark-elevated'}`}
            >
              Reports
            </button>
          </div>

          {/* Notifications Feed List */}
          <div className="overflow-y-auto divide-y divide-gray-100 dark:divide-dark-border flex-1 max-h-[55vh]">
            {isLoading ? (
              <div className="p-8 text-center text-xs text-gray-400 space-y-2">
                <RefreshCw size={20} className="animate-spin mx-auto text-blue-600" />
                <p>Loading notifications...</p>
              </div>
            ) : filteredNotifications.length === 0 ? (
              <div className="p-8 text-center space-y-2">
                <div className="w-10 h-10 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto">
                  <Sparkles size={20} />
                </div>
                <p className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                  No alerts right now!
                </p>
                <p className="text-[11px] text-gray-400">
                  Everything is up to date and running smoothly.
                </p>
              </div>
            ) : (
              filteredNotifications.map(item => {
                const isRead = readIds.has(item.id)
                return (
                  <div
                    key={item.id}
                    onClick={() => markAsRead(item.id)}
                    className={`p-3.5 transition-colors relative flex gap-3 text-xs ${isRead ? 'bg-white dark:bg-dark-card opacity-80' : 'bg-blue-50/40 dark:bg-blue-950/20'}`}
                  >
                    {/* Unread indicator dot */}
                    {!isRead && (
                      <span className="absolute left-1.5 top-4 w-1.5 h-1.5 rounded-full bg-blue-600 dark:bg-blue-400" />
                    )}

                    {/* Icon */}
                    <div className="shrink-0 mt-0.5">
                      {item.type === 'credit_due' && (
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${item.isOverdue ? 'bg-red-100 text-red-600 dark:bg-red-950/60 dark:text-red-400' : 'bg-amber-100 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400'}`}>
                          <CreditCard size={16} />
                        </div>
                      )}
                      {item.type === 'purchase_due' && (
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${item.isOverdue ? 'bg-red-100 text-red-600 dark:bg-red-950/60 dark:text-red-400' : 'bg-blue-100 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400'}`}>
                          <Building2 size={16} />
                        </div>
                      )}
                      {(item.type === 'out_of_stock' || item.type === 'low_stock') && (
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${item.type === 'out_of_stock' ? 'bg-red-100 text-red-600 dark:bg-red-950/60 dark:text-red-400' : 'bg-amber-100 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400'}`}>
                          <AlertTriangle size={16} />
                        </div>
                      )}
                      {(item.type === 'daily_sales_summary' || item.type === 'weekly_summary') && (
                        <div className="w-8 h-8 rounded-xl bg-purple-100 text-purple-600 dark:bg-purple-950/60 dark:text-purple-400 flex items-center justify-center">
                          <TrendingUp size={16} />
                        </div>
                      )}
                      {item.type === 'announcement' && (
                        <div className="w-8 h-8 rounded-xl bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 flex items-center justify-center">
                          <Sparkles size={16} />
                        </div>
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-start justify-between gap-1">
                        <p className={`font-semibold text-gray-900 dark:text-gray-100 leading-tight ${!isRead ? 'font-bold' : ''}`}>
                          {item.title}
                        </p>
                      </div>

                      <p className="text-gray-600 dark:text-gray-300 leading-relaxed text-[11px]">
                        {item.message}
                      </p>

                      {/* Action buttons */}
                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        {item.type === 'credit_due' && (
                          <>
                            {item.customerPhone && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  openWhatsApp(item.customerPhone, item.customerName, item.amount)
                                }}
                                className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800 transition-colors"
                              >
                                <MessageSquare size={11} /> WhatsApp
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                setIsOpen(false)
                                navigate(ROUTES.CUSTOMERS)
                              }}
                              className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-600 dark:text-blue-400 hover:underline"
                            >
                              <span>Customer Khaata</span>
                              <ArrowUpRight size={11} />
                            </button>
                          </>
                        )}

                        {item.type === 'purchase_due' && (
                          <>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                setIsOpen(false)
                                if (item.supplierId) {
                                  navigate(ROUTES.SUPPLIER_DETAIL(item.supplierId))
                                } else {
                                  navigate(ROUTES.PURCHASES)
                                }
                              }}
                              className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/50 hover:bg-blue-100 px-2 py-0.5 rounded border border-blue-200 dark:border-blue-800 transition-colors"
                            >
                              <span>Vendor Ledger</span>
                              <ArrowUpRight size={11} />
                            </button>
                          </>
                        )}

                        {(item.type === 'out_of_stock' || item.type === 'low_stock') && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              setIsOpen(false)
                              navigate(ROUTES.PURCHASES)
                            }}
                            className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-600 dark:text-blue-400 hover:underline"
                          >
                            <Package size={11} />
                            <span>Create Purchase / Restock</span>
                          </button>
                        )}

                        {(item.type === 'daily_sales_summary' || item.type === 'weekly_summary') && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              setIsOpen(false)
                              navigate(ROUTES.REPORTS)
                            }}
                            className="inline-flex items-center gap-1 text-[10px] font-bold text-purple-600 dark:text-purple-400 hover:underline"
                          >
                            <span>View Full Analytics</span>
                            <ArrowUpRight size={11} />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>

          {/* Footer */}
          <div className="p-2.5 border-t border-gray-100 dark:border-dark-border bg-slate-50/80 dark:bg-slate-900/50 text-center">
            <button
              type="button"
              onClick={() => {
                setIsOpen(false)
                navigate(ROUTES.SETTINGS)
              }}
              className="text-[11px] font-semibold text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 transition-colors inline-flex items-center gap-1"
            >
              <span>Notification Preferences & Settings</span>
              <ExternalLink size={11} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
