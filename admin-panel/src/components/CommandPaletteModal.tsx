import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Search,
  Activity,
  Users,
  LayoutGrid,
  ExternalLink,
  RefreshCw,
  Sun,
  Moon,
  Smartphone,
  Command,
  ArrowRight,
  UserCheck,
  Package,
  ShoppingBag,
  Layers,
  Ticket,
  Truck,
  Receipt,
  Settings,
  CreditCard,
  Building,
  BookOpen,
  BarChart3,
  ShieldCheck,
  Palette,
  Calendar,
  Clock,
  Zap,
} from 'lucide-react';
import type { UserRecord } from '../types/admin';

interface CommandPaletteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectTab: (tab: string, userEmail?: string) => void;
  users?: UserRecord[];
  onRefresh?: () => void;
  onSelectTimeRange?: (range: string) => void;
  onSelectAutoRefresh?: (interval: number) => void;
}

interface PaletteItem {
  id: string;
  category: 'Pages' | 'Features & Routes' | 'Merchants' | 'Heatmap Themes' | 'Time Range' | 'Actions';
  title: string;
  subtitle?: string;
  icon: React.ElementType;
  iconColor?: string;
  action: () => void;
  badge?: string;
}

export const CommandPaletteModal: React.FC<CommandPaletteModalProps> = ({
  isOpen,
  onClose,
  onSelectTab,
  users = [],
  onRefresh,
  onSelectTimeRange,
  onSelectAutoRefresh,
}) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-focus input when opened
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    }
  }, [isOpen]);

  // Handle ESC key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Build searchable items list reflecting current admin panel state
  const allItems = useMemo<PaletteItem[]>(() => {
    // 1. Navigation Pages
    const pageItems: PaletteItem[] = [
      {
        id: 'nav-overview',
        category: 'Pages',
        title: 'Overview & Metrics',
        subtitle: 'Key KPI metrics, 24h Peak Usage Heatmap, Device breakdown, and Top 5 Features',
        icon: Activity,
        iconColor: '#3B82F6',
        action: () => {
          onSelectTab('overview');
          onClose();
        },
        badge: 'Dashboard',
      },
      {
        id: 'nav-sections',
        category: 'Pages',
        title: 'Section Analytics',
        subtitle: 'All 14 tracked app modules, traffic distribution shares, session durations, and growth trends',
        icon: LayoutGrid,
        iconColor: '#8B5CF6',
        action: () => {
          onSelectTab('sections');
          onClose();
        },
        badge: 'Analytics',
      },
      {
        id: 'nav-users',
        category: 'Pages',
        title: 'Registered Users',
        subtitle: 'Merchant roster, account verification status, subscription plan tiers, and session audits',
        icon: Users,
        iconColor: '#10B981',
        action: () => {
          onSelectTab('users');
          onClose();
        },
        badge: 'Roster',
      },
      {
        id: 'nav-traffic',
        category: 'Pages',
        title: 'Traffic Analytics',
        subtitle: 'Mobile POS App vs Web App telemetry, invoice velocity timeline, and device ratios',
        icon: Smartphone,
        iconColor: '#06B6D4',
        action: () => {
          onSelectTab('traffic');
          onClose();
        },
        badge: 'Telemetry',
      },
      {
        id: 'nav-redirects',
        category: 'Pages',
        title: 'Website Redirects',
        subtitle: 'External product links, landing clicks, and store redirection counters',
        icon: ExternalLink,
        iconColor: '#F59E0B',
        action: () => {
          onSelectTab('redirects');
          onClose();
        },
        badge: 'Traffic',
      },
    ];

    // 2. 14 Feature Modules & Routes
    const featureItems: PaletteItem[] = [
      {
        id: 'feat-products',
        category: 'Features & Routes',
        title: 'Products & Inventory Catalog (/products)',
        subtitle: 'Barcode scanning, stock levels, variants, and bulk imports',
        icon: Package,
        iconColor: '#3B82F6',
        action: () => {
          onSelectTab('sections');
          onClose();
        },
        badge: '#1 Leader',
      },
      {
        id: 'feat-daybook',
        category: 'Features & Routes',
        title: 'Daily Cash Register & Daybook (/daybook)',
        subtitle: 'Opening/closing balance, cash in/out drawer records, and daily stock audit',
        icon: BookOpen,
        iconColor: '#10B981',
        action: () => {
          onSelectTab('sections');
          onClose();
        },
        badge: 'Module',
      },
      {
        id: 'feat-pos',
        category: 'Features & Routes',
        title: 'POS Lite Billing & Invoicing (/pos-lite)',
        subtitle: 'Fast touchscreen billing, discount calculations, and thermal receipts',
        icon: ShoppingBag,
        iconColor: '#06B6D4',
        action: () => {
          onSelectTab('sections');
          onClose();
        },
        badge: 'Module',
      },
      {
        id: 'feat-categories',
        category: 'Features & Routes',
        title: 'Categories & Tax Classification (/categories)',
        subtitle: 'HSN code tags, GST tax slabs, and product classification trees',
        icon: Layers,
        iconColor: '#8B5CF6',
        action: () => {
          onSelectTab('sections');
          onClose();
        },
        badge: 'Module',
      },
      {
        id: 'feat-customers',
        category: 'Features & Routes',
        title: 'Customer CRM & Loyalty Records (/customers)',
        subtitle: 'Customer contact records, purchase history, and loyalty profiles',
        icon: Users,
        iconColor: '#EC4899',
        action: () => {
          onSelectTab('sections');
          onClose();
        },
        badge: 'Module',
      },
      {
        id: 'feat-credits',
        category: 'Features & Routes',
        title: 'Customer Udhar & Credit Ledger (/credits)',
        subtitle: 'Khata ledger, outstanding customer dues, and payment collections',
        icon: CreditCard,
        iconColor: '#F59E0B',
        action: () => {
          onSelectTab('sections');
          onClose();
        },
        badge: 'Module',
      },
      {
        id: 'feat-tokens',
        category: 'Features & Routes',
        title: 'Quick Token Generator & Kiosk (/tokens)',
        subtitle: 'Order queuing numbers, kitchen display tokens, and customer pickup alerts',
        icon: Ticket,
        iconColor: '#06B6D4',
        action: () => {
          onSelectTab('sections');
          onClose();
        },
        badge: 'Module',
      },
      {
        id: 'feat-reports',
        category: 'Features & Routes',
        title: 'Sales & Profit Analytics Reports (/reports)',
        subtitle: 'P&L breakdowns, GST tax reports, and top-selling product analytics',
        icon: BarChart3,
        iconColor: '#3B82F6',
        action: () => {
          onSelectTab('sections');
          onClose();
        },
        badge: 'Module',
      },
      {
        id: 'feat-purchases',
        category: 'Features & Routes',
        title: 'Purchase Orders & Stock In (/purchases)',
        subtitle: 'Vendor stock receiving, inward invoices, and supplier billing',
        icon: Truck,
        iconColor: '#F59E0B',
        action: () => {
          onSelectTab('sections');
          onClose();
        },
        badge: 'Module',
      },
      {
        id: 'feat-suppliers',
        category: 'Features & Routes',
        title: 'Supplier & Vendor Directory (/suppliers)',
        subtitle: 'Vendor contact directory, GSTIN records, and pending payables',
        icon: Building,
        iconColor: '#8B5CF6',
        action: () => {
          onSelectTab('sections');
          onClose();
        },
        badge: 'Module',
      },
      {
        id: 'feat-expenses',
        category: 'Features & Routes',
        title: 'Expense Tracker & Daily P&L (/expenses)',
        subtitle: 'Operational overheads, utility bills, staff wages, and expense logs',
        icon: Receipt,
        iconColor: '#EF4444',
        action: () => {
          onSelectTab('sections');
          onClose();
        },
        badge: 'Module',
      },
      {
        id: 'feat-settings',
        category: 'Features & Routes',
        title: 'Store Profile & Tax Settings (/settings)',
        subtitle: 'Store business info, currency formatting, and ESC/POS printer settings',
        icon: Settings,
        iconColor: '#64748B',
        action: () => {
          onSelectTab('sections');
          onClose();
        },
        badge: 'Module',
      },
      {
        id: 'feat-onboarding',
        category: 'Features & Routes',
        title: 'Merchant Auth & Onboarding Flow (/onboarding)',
        subtitle: 'OTP email verification, password security, and store creation wizard',
        icon: ShieldCheck,
        iconColor: '#10B981',
        action: () => {
          onSelectTab('sections');
          onClose();
        },
        badge: 'Module',
      },
    ];

    // 3. Heatmap Color Palettes
    const paletteItems: PaletteItem[] = [
      {
        id: 'pal-traffic',
        category: 'Heatmap Themes',
        title: 'Traffic Light Palette (Green → Red)',
        subtitle: 'Quiet glass to emerald green, amber yellow, orange, and peak red',
        icon: Palette,
        iconColor: '#10B981',
        action: () => {
          localStorage.setItem('seznik_heatmap_palette', 'traffic');
          window.dispatchEvent(new Event('storage'));
          onSelectTab('overview');
          onClose();
        },
        badge: 'Default',
      },
      {
        id: 'pal-cyber',
        category: 'Heatmap Themes',
        title: 'Cyber Neon Palette (Cyan → Purple)',
        subtitle: 'Futuristic cyan, electric violet, fuchsia, and solar amber highlights',
        icon: Palette,
        iconColor: '#06B6D4',
        action: () => {
          localStorage.setItem('seznik_heatmap_palette', 'cyber');
          window.dispatchEvent(new Event('storage'));
          onSelectTab('overview');
          onClose();
        },
        badge: 'Theme',
      },
      {
        id: 'pal-ocean',
        category: 'Heatmap Themes',
        title: 'Ocean Cobalt Palette (Blue → Indigo)',
        subtitle: 'Ice blue, sky blue, deep cobalt, and royal indigo gradients',
        icon: Palette,
        iconColor: '#3B82F6',
        action: () => {
          localStorage.setItem('seznik_heatmap_palette', 'ocean');
          window.dispatchEvent(new Event('storage'));
          onSelectTab('overview');
          onClose();
        },
        badge: 'Theme',
      },
      {
        id: 'pal-github',
        category: 'Heatmap Themes',
        title: 'GitHub Matrix Palette (Monochrome Green)',
        subtitle: 'Classic developer activity greens from subtle mint to bright emerald',
        icon: Palette,
        iconColor: '#22C55E',
        action: () => {
          localStorage.setItem('seznik_heatmap_palette', 'github');
          window.dispatchEvent(new Event('storage'));
          onSelectTab('overview');
          onClose();
        },
        badge: 'Theme',
      },
      {
        id: 'pal-inferno',
        category: 'Heatmap Themes',
        title: 'Solar Inferno Palette (Gold → Crimson)',
        subtitle: 'High-contrast solar gold, tangerine, ruby coral, and dark crimson',
        icon: Palette,
        iconColor: '#EF4444',
        action: () => {
          localStorage.setItem('seznik_heatmap_palette', 'inferno');
          window.dispatchEvent(new Event('storage'));
          onSelectTab('overview');
          onClose();
        },
        badge: 'Theme',
      },
    ];

    // 4. Time Range Filter Options
    const timeRangeItems: PaletteItem[] = [
      {
        id: 'time-24h',
        category: 'Time Range',
        title: 'Filter: Last 24 Hours',
        subtitle: 'Show API calls and activity logged within the past 24 hours',
        icon: Clock,
        iconColor: '#3B82F6',
        action: () => {
          if (onSelectTimeRange) onSelectTimeRange('24h');
          onClose();
        },
        badge: '24h',
      },
      {
        id: 'time-7d',
        category: 'Time Range',
        title: 'Filter: Last 7 Days',
        subtitle: 'Show telemetry and invoice traffic over the current week',
        icon: Calendar,
        iconColor: '#10B981',
        action: () => {
          if (onSelectTimeRange) onSelectTimeRange('7d');
          onClose();
        },
        badge: '7d',
      },
      {
        id: 'time-30d',
        category: 'Time Range',
        title: 'Filter: Last 30 Days',
        subtitle: 'Show monthly aggregate analytics across all registered merchants',
        icon: Calendar,
        iconColor: '#8B5CF6',
        action: () => {
          if (onSelectTimeRange) onSelectTimeRange('30d');
          onClose();
        },
        badge: '30d',
      },
      {
        id: 'time-all',
        category: 'Time Range',
        title: 'Filter: All Time Telemetry',
        subtitle: 'View complete all-time historical database telemetry records',
        icon: Zap,
        iconColor: '#F59E0B',
        action: () => {
          if (onSelectTimeRange) onSelectTimeRange('All');
          onClose();
        },
        badge: 'All',
      },
    ];

    // 5. Merchant Users
    const merchantItems: PaletteItem[] = users.map((u) => ({
      id: `merchant-${u.id}`,
      category: 'Merchants',
      title: u.displayName || u.email || `Merchant #${u.id}`,
      subtitle: `${u.email || 'No email'} • ${u.businessName || 'Independent Merchant'} • Plan: ${u.plan.toUpperCase()}`,
      icon: UserCheck,
      iconColor: '#3B82F6',
      action: () => {
        onSelectTab('users', u.email || String(u.id));
        onClose();
      },
      badge: `#${u.id}`,
    }));

    // 6. System Actions
    const actionItems: PaletteItem[] = [
      {
        id: 'act-refresh',
        category: 'Actions',
        title: 'Refresh Telemetry Data Now',
        subtitle: 'Re-fetch all real-time metrics, users, heatmap, and telemetry from AWS RDS Postgres',
        icon: RefreshCw,
        iconColor: '#10B981',
        action: () => {
          if (onRefresh) onRefresh();
          onClose();
        },
        badge: 'Live Sync',
      },
    ];

    return [
      ...pageItems,
      ...featureItems,
      ...paletteItems,
      ...timeRangeItems,
      ...merchantItems,
      ...actionItems,
    ];
  }, [users, onSelectTab, onClose, onRefresh, onSelectTimeRange]);

  // Filter items by search query
  const filteredItems = useMemo(() => {
    if (!query.trim()) return allItems;
    const q = query.toLowerCase().trim();
    return allItems.filter(
      (item) =>
        item.title.toLowerCase().includes(q) ||
        (item.subtitle && item.subtitle.toLowerCase().includes(q)) ||
        item.category.toLowerCase().includes(q)
    );
  }, [allItems, query]);

  // Keyboard Navigation: Up, Down, Enter
  useEffect(() => {
    const handleKeyNavigation = (e: KeyboardEvent) => {
      if (!isOpen || filteredItems.length === 0) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % filteredItems.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + filteredItems.length) % filteredItems.length);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const selected = filteredItems[selectedIndex];
        if (selected) {
          selected.action();
        }
      }
    };

    window.addEventListener('keydown', handleKeyNavigation);
    return () => window.removeEventListener('keydown', handleKeyNavigation);
  }, [isOpen, filteredItems, selectedIndex]);

  if (!isOpen) return null;

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 200,
        background: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        paddingTop: '8vh',
        paddingLeft: '16px',
        paddingRight: '16px',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="glass-card"
        style={{
          width: '100%',
          maxWidth: '680px',
          background: 'var(--bg-card)',
          border: '1px solid var(--border-color)',
          borderRadius: '16px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '80vh',
        }}
      >
        {/* Search Header */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid var(--border-color)',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            background: 'var(--bg-main)',
          }}
        >
          <Search size={18} color="var(--accent-blue)" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Search pages, 14 app modules, heatmap themes, time ranges, or merchants... (⌘K)"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              color: 'var(--text-main)',
              fontSize: '0.95rem',
              fontWeight: 500,
              outline: 'none',
            }}
          />
          <kbd
            style={{
              fontSize: '0.7rem',
              fontWeight: 700,
              padding: '2px 8px',
              borderRadius: '6px',
              background: 'var(--tab-bg)',
              color: 'var(--text-muted)',
              border: '1px solid var(--border-color)',
            }}
          >
            ESC
          </kbd>
        </div>

        {/* Results List Container */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px' }}>
          {filteredItems.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
              <Command size={24} style={{ marginBottom: '8px', opacity: 0.6 }} />
              <p style={{ margin: 0, fontSize: '0.85rem' }}>No command or merchant results matching &quot;{query}&quot;</p>
            </div>
          ) : (
            filteredItems.map((item, index) => {
              const Icon = item.icon;
              const isSelected = index === selectedIndex;
              const iconColor = item.iconColor || 'var(--accent-blue)';

              // Category Header logic
              const showCategoryHeader =
                index === 0 || filteredItems[index - 1].category !== item.category;

              return (
                <React.Fragment key={item.id}>
                  {showCategoryHeader && (
                    <div
                      style={{
                        fontSize: '0.68rem',
                        fontWeight: 700,
                        color: 'var(--text-muted)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.06em',
                        padding: '10px 14px 4px 14px',
                      }}
                    >
                      {item.category}
                    </div>
                  )}

                  <div
                    onClick={item.action}
                    onMouseEnter={() => setSelectedIndex(index)}
                    style={{
                      padding: '10px 14px',
                      borderRadius: '10px',
                      marginBottom: '4px',
                      background: isSelected ? 'rgba(59, 130, 246, 0.12)' : 'transparent',
                      border: `1px solid ${isSelected ? 'rgba(59, 130, 246, 0.3)' : 'transparent'}`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      cursor: 'pointer',
                      transition: 'all 0.1s ease',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
                      <div
                        style={{
                          width: '34px',
                          height: '34px',
                          borderRadius: '8px',
                          background: isSelected ? 'var(--accent-blue)' : 'var(--bg-main)',
                          color: isSelected ? '#FFFFFF' : iconColor,
                          border: `1px solid ${isSelected ? 'transparent' : 'var(--border-color)'}`,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                        }}
                      >
                        <Icon size={16} color={isSelected ? '#FFFFFF' : iconColor} />
                      </div>

                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span>{item.title}</span>
                          {item.badge && (() => {
                            const badgeStyle = getBadgeStyle(item.category, item.badge, isSelected);
                            return (
                              <span
                                style={{
                                  fontSize: '0.68rem',
                                  fontWeight: 800,
                                  padding: '2px 8px',
                                  borderRadius: '6px',
                                  letterSpacing: '0.02em',
                                  flexShrink: 0,
                                  ...badgeStyle,
                                }}
                              >
                                {item.badge}
                              </span>
                            );
                          })()}
                        </div>
                        {item.subtitle && (
                          <div
                            style={{
                              fontSize: '0.75rem',
                              color: 'var(--text-muted)',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              marginTop: '2px',
                            }}
                          >
                            {item.subtitle}
                          </div>
                        )}
                      </div>
                    </div>

                    <ArrowRight size={14} color={isSelected ? 'var(--accent-blue)' : 'var(--text-muted)'} opacity={isSelected ? 1 : 0.4} />
                  </div>
                </React.Fragment>
              );
            })
          )}
        </div>

        {/* Footer Shortcut Legend */}
        <div
          style={{
            padding: '10px 20px',
            borderTop: '1px solid var(--border-color)',
            background: 'var(--bg-main)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '0.72rem',
            color: 'var(--text-muted)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span><kbd style={{ background: 'var(--tab-bg)', padding: '1px 5px', borderRadius: '4px', border: '1px solid var(--border-color)' }}>↑</kbd> <kbd style={{ background: 'var(--tab-bg)', padding: '1px 5px', borderRadius: '4px', border: '1px solid var(--border-color)' }}>↓</kbd> Navigate</span>
            <span><kbd style={{ background: 'var(--tab-bg)', padding: '1px 5px', borderRadius: '4px', border: '1px solid var(--border-color)' }}>↵</kbd> Select</span>
          </div>

          <div>
            Press <kbd style={{ background: 'var(--tab-bg)', padding: '1px 5px', borderRadius: '4px', border: '1px solid var(--border-color)' }}>ESC</kbd> to exit
          </div>
        </div>
      </div>
    </div>
  );
};
