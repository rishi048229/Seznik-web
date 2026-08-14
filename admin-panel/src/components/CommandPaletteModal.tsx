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
  Building2,
  X,
} from 'lucide-react';
import type { UserRecord } from '../types/admin';

interface CommandPaletteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectTab: (tab: string, userEmail?: string) => void;
  users?: UserRecord[];
  onRefresh?: () => void;
}

interface PaletteItem {
  id: string;
  category: 'Navigation' | 'Merchants' | 'Actions';
  title: string;
  subtitle?: string;
  icon: React.ElementType;
  action: () => void;
  badge?: string;
}

export const CommandPaletteModal: React.FC<CommandPaletteModalProps> = ({
  isOpen,
  onClose,
  onSelectTab,
  users = [],
  onRefresh,
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

  // Handle ESC key or backdrop click
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Build searchable items list
  const allItems = useMemo<PaletteItem[]>(() => {
    const navItems: PaletteItem[] = [
      {
        id: 'nav-overview',
        category: 'Navigation',
        title: 'Overview & Metrics',
        subtitle: 'Dashboard overview, top features, heatmaps, and POS device breakdown',
        icon: Activity,
        action: () => {
          onSelectTab('overview');
          onClose();
        },
        badge: 'Page',
      },
      {
        id: 'nav-traffic',
        category: 'Navigation',
        title: 'Traffic Analytics',
        subtitle: 'Unified Mobile POS App & Web App invoice creation numbers and timelines',
        icon: Smartphone,
        action: () => {
          onSelectTab('traffic');
          onClose();
        },
        badge: 'Page',
      },
      {
        id: 'nav-redirects',
        category: 'Navigation',
        title: 'Website Redirects',
        subtitle: 'Product redirect numbers and website traffic tracking',
        icon: ExternalLink,
        action: () => {
          onSelectTab('redirects');
          onClose();
        },
        badge: 'Page',
      },
      {
        id: 'nav-users',
        category: 'Navigation',
        title: 'Registered Users Roster',
        subtitle: 'Merchant user management, profile details, and Ban/Unban controls',
        icon: Users,
        action: () => {
          onSelectTab('users');
          onClose();
        },
        badge: 'Page',
      },
      {
        id: 'nav-sections',
        category: 'Navigation',
        title: 'Section Analytics',
        subtitle: 'Feature usage trends, unique session counts, and section drilldowns',
        icon: LayoutGrid,
        action: () => {
          onSelectTab('sections');
          onClose();
        },
        badge: 'Page',
      },
    ];

    const merchantItems: PaletteItem[] = users.map((u) => ({
      id: `merchant-${u.id}`,
      category: 'Merchants',
      title: u.displayName || u.email || `Merchant #${u.id}`,
      subtitle: `${u.email || 'No email'} • ${u.businessName || 'Independent'} • ${u.plan.toUpperCase()} Plan`,
      icon: UserCheck,
      action: () => {
        onSelectTab('users', u.email || String(u.id));
        onClose();
      },
      badge: `#${u.id}`,
    }));

    const actionItems: PaletteItem[] = [
      {
        id: 'act-refresh',
        category: 'Actions',
        title: 'Refresh Telemetry Data',
        subtitle: 'Re-fetch all real-time metrics, users, and telemetry data',
        icon: RefreshCw,
        action: () => {
          if (onRefresh) onRefresh();
          onClose();
        },
        badge: 'Action',
      },
    ];

    return [...navItems, ...merchantItems, ...actionItems];
  }, [users, onSelectTab, onClose, onRefresh]);

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
        paddingTop: '10vh',
        paddingLeft: '16px',
        paddingRight: '16px',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="glass-card"
        style={{
          width: '100%',
          maxWidth: '640px',
          background: 'var(--bg-card)',
          border: '1px solid var(--border-color)',
          borderRadius: '16px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.4)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '75vh',
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
            placeholder="Type a command, search pages, or merchant users... (⌘K)"
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

              return (
                <div
                  key={item.id}
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
                        color: isSelected ? '#FFFFFF' : 'var(--text-muted)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      <Icon size={16} />
                    </div>

                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span>{item.title}</span>
                        {item.badge && (
                          <span
                            style={{
                              fontSize: '0.68rem',
                              fontWeight: 700,
                              padding: '1px 6px',
                              borderRadius: '4px',
                              background: isSelected ? 'rgba(255,255,255,0.2)' : 'var(--bg-main)',
                              color: isSelected ? '#FFFFFF' : 'var(--text-muted)',
                              border: '1px solid var(--border-color)',
                            }}
                          >
                            {item.badge}
                          </span>
                        )}
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
