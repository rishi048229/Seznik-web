import React, { useState, useEffect, useMemo } from 'react';
import { Calendar, Search, AlertTriangle, RefreshCw } from 'lucide-react';
import { fetchProducts } from '../services/api';
import type { AdminProduct } from '../types/admin';

type TimeFrame = '24h' | '7d' | '30d' | 'all' | 'custom';

interface ProductRedirectItem {
  id: string;
  name: string;
  sku: string;
  category: string;
  redirects: {
    '24h': number;
    '7d': number;
    '30d': number;
    all: number;
    custom: number;
  };
}

const TIMEFRAMES: { id: TimeFrame; label: string }[] = [
  { id: '24h', label: 'Today / 24 Hours' },
  { id: '7d', label: '7 Days' },
  { id: '30d', label: '30 Days' },
  { id: 'all', label: 'All Time' },
  { id: 'custom', label: 'Custom Range' },
];

export const RedirectsView: React.FC = () => {
  const [timeFrame, setTimeFrame] = useState<TimeFrame>('7d');
  const [searchQuery, setSearchQuery] = useState('');
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);
  const fourteenDaysAgoStr = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 14);
    return d.toISOString().split('T')[0];
  }, []);

  const [customStartDate, setCustomStartDate] = useState<string>(fourteenDaysAgoStr);
  const [customEndDate, setCustomEndDate] = useState<string>(todayStr);

  const loadProducts = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchProducts(100);
      setProducts(data);
      setError(null);
    } catch (err: any) {
      console.error('Failed to load products for redirects:', err);
      setError(err?.message || 'Failed to fetch products from database');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProducts();
  }, []);

  const redirectItems: ProductRedirectItem[] = useMemo(() => {
    return products.map((p) => ({
      id: p.id,
      name: p.name,
      sku: p.sku || 'N/A',
      category: p.categoryName || 'General',
      redirects: {
        '24h': 0,
        '7d': 0,
        '30d': 0,
        all: 0,
        custom: 0,
      },
    }));
  }, [products]);

  const filteredData = useMemo(() => {
    let result = redirectItems;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (item) =>
          item.name.toLowerCase().includes(q) ||
          item.sku.toLowerCase().includes(q) ||
          item.category.toLowerCase().includes(q)
      );
    }
    return [...result];
  }, [redirectItems, searchQuery]);

  const totalRedirects = useMemo(() => {
    return filteredData.reduce((sum, item) => sum + (item.redirects[timeFrame] || 0), 0);
  }, [filteredData, timeFrame]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', width: '100%' }}>
      <div
        style={{
          padding: '10px 16px',
          background: 'rgba(245, 158, 11, 0.1)',
          border: '1px solid rgba(245, 158, 11, 0.35)',
          borderRadius: '10px',
          fontSize: '0.78rem',
          color: 'var(--text-muted)',
        }}
      >
        <strong style={{ color: '#F59E0B' }}>Demo data:</strong> Redirect counts are not tracked in the database yet. Product names come from the catalog; redirect numbers are placeholders until analytics are wired up.
      </div>

      {/* Error Banner */}
      {error && (
        <div
          className="admin-error-banner"
          style={{
            padding: '12px 18px',
            background: 'rgba(239, 68, 68, 0.12)',
            border: '1px solid rgba(239, 68, 68, 0.35)',
            borderRadius: '10px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <AlertTriangle size={20} color="#EF4444" />
            <div>
              <div style={{ fontSize: '0.86rem', fontWeight: 700, color: '#EF4444' }}>
                Catalog / Redirects Database Error
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                {error}
              </div>
            </div>
          </div>
          <button
            onClick={loadProducts}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 14px',
              fontSize: '0.78rem',
              fontWeight: 600,
              color: '#fff',
              background: '#EF4444',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
            }}
          >
            <RefreshCw size={13} /> Retry
          </button>
        </div>
      )}

      {/* Header & Timeframe Bar */}
      <div className="glass-card" style={{ padding: '20px 24px' }}>
        <div className="page-header-row" style={{ alignItems: 'center' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-main)' }}>
              Website Redirects
            </h2>
            <p style={{ margin: '4px 0 0 0', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              Track the number of website redirects per product across different timeframes.
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              {/* Total Badge */}
              <div style={{ padding: '6px 14px', borderRadius: '8px', background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginRight: '6px' }}>Total Redirects:</span>
                <strong style={{ fontSize: '0.95rem', color: 'var(--accent-blue)', fontWeight: 700 }}>
                  {totalRedirects.toLocaleString()}
                </strong>
              </div>

              {/* Timeframe Selector Buttons */}
              <div className="timeframe-pills" style={{ background: 'var(--tab-bg)', padding: '3px', borderRadius: '8px', border: '1px solid var(--tab-border)' }}>
                {TIMEFRAMES.map((tf) => (
                  <button
                    key={tf.id}
                    onClick={() => setTimeFrame(tf.id)}
                    style={{
                      padding: '6px 12px',
                      borderRadius: '6px',
                      border: 'none',
                      background: timeFrame === tf.id ? 'var(--accent-blue)' : 'transparent',
                      color: timeFrame === tf.id ? '#FFFFFF' : 'var(--text-muted)',
                      fontSize: '0.78rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    {tf.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Custom Date Range Picker */}
            {timeFrame === 'custom' && (
              <div
                className="custom-date-range"
                style={{
                  background: 'var(--bg-main)',
                  padding: '6px 12px',
                  borderRadius: '8px',
                  border: '1px solid var(--accent-blue)',
                  fontSize: '0.78rem',
                }}
              >
                <Calendar size={13} color="var(--accent-blue)" />
                <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>From:</span>
                <input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  style={{
                    padding: '4px 8px',
                    borderRadius: '6px',
                    border: '1px solid var(--border-color)',
                    background: 'var(--bg-card)',
                    color: 'var(--text-main)',
                    fontSize: '0.75rem',
                    outline: 'none',
                  }}
                />
                <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>To:</span>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  style={{
                    padding: '4px 8px',
                    borderRadius: '6px',
                    border: '1px solid var(--border-color)',
                    background: 'var(--bg-card)',
                    color: 'var(--text-main)',
                    fontSize: '0.75rem',
                    outline: 'none',
                  }}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Content Card */}
      <div className="glass-card" style={{ padding: '24px' }}>
        {/* Search Bar */}
        <div style={{ marginBottom: '20px', position: 'relative', width: '100%', maxWidth: '400px' }}>
          <Search size={15} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            type="text"
            placeholder="Search product name, SKU, or category..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '9px 12px 9px 36px',
              borderRadius: '8px',
              border: '1px solid var(--border-color)',
              background: 'var(--bg-main)',
              color: 'var(--text-main)',
              fontSize: '0.82rem',
              outline: 'none',
            }}
          />
        </div>

        {/* Redirects Table */}
        <div style={{ overflowX: 'auto' }}>
          <table className="custom-table" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th>Product Name</th>
                <th>SKU</th>
                <th>Category</th>
                <th style={{ textAlign: 'right' }}>Number of Redirects</th>
              </tr>
            </thead>
            <tbody>
              {filteredData.length === 0 ? (
                <tr>
                  <td colSpan={4} style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>
                    No product redirects found.
                  </td>
                </tr>
              ) : (
                filteredData.map((item) => (
                  <tr key={item.id}>
                    <td style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '0.86rem' }}>
                      {item.name}
                    </td>
                    <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                      {item.sku}
                    </td>
                    <td>
                      <span className="badge badge-pro" style={{ fontSize: '0.72rem' }}>
                        {item.category}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 800, color: 'var(--accent-blue)', fontSize: '0.95rem' }}>
                      {item.redirects[timeFrame].toLocaleString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
