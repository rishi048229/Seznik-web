import React, { useState, useMemo } from 'react';
import { Calendar, Search } from 'lucide-react';

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

const INITIAL_DATA: ProductRedirectItem[] = [
  {
    id: '1',
    name: 'Classic Banarasi Silk Sari',
    sku: 'SAR-001',
    category: 'Apparel',
    redirects: { '24h': 18, '7d': 124, '30d': 480, all: 1850, custom: 290 },
  },
  {
    id: '2',
    name: 'Leather Bifold Slim Wallet',
    sku: 'WAL-004',
    category: 'Accessories',
    redirects: { '24h': 12, '7d': 89, '30d': 320, all: 1240, custom: 195 },
  },
  {
    id: '3',
    name: 'Wireless Noise Cancelling Earbuds',
    sku: 'EAR-102',
    category: 'Electronics',
    redirects: { '24h': 24, '7d': 165, '30d': 610, all: 2410, custom: 380 },
  },
  {
    id: '4',
    name: 'Organic Assam Green Tea (250g)',
    sku: 'TEA-088',
    category: 'Grocery',
    redirects: { '24h': 8, '7d': 45, '30d': 190, all: 780, custom: 110 },
  },
  {
    id: '5',
    name: 'Ergonomic Mesh Office Chair',
    sku: 'CHR-501',
    category: 'Furniture',
    redirects: { '24h': 15, '7d': 98, '30d': 410, all: 1620, custom: 240 },
  },
  {
    id: '6',
    name: 'Handcrafted Terracotta Clay Pot',
    sku: 'POT-012',
    category: 'Home & Decor',
    redirects: { '24h': 6, '7d': 38, '30d': 145, all: 590, custom: 85 },
  },
  {
    id: '7',
    name: 'Stainless Steel Insulated Flask (1L)',
    sku: 'FLK-009',
    category: 'Kitchenware',
    redirects: { '24h': 21, '7d': 142, '30d': 530, all: 2100, custom: 310 },
  },
  {
    id: '8',
    name: 'Smart Fitness Tracker Band V2',
    sku: 'FIT-204',
    category: 'Electronics',
    redirects: { '24h': 31, '7d': 210, '30d': 840, all: 3150, custom: 490 },
  },
];

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

  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);
  const fourteenDaysAgoStr = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 14);
    return d.toISOString().split('T')[0];
  }, []);

  const [customStartDate, setCustomStartDate] = useState<string>(fourteenDaysAgoStr);
  const [customEndDate, setCustomEndDate] = useState<string>(todayStr);

  const filteredData = useMemo(() => {
    let result = INITIAL_DATA;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (item) =>
          item.name.toLowerCase().includes(q) ||
          item.sku.toLowerCase().includes(q) ||
          item.category.toLowerCase().includes(q)
      );
    }
    return [...result].sort((a, b) => b.redirects[timeFrame] - a.redirects[timeFrame]);
  }, [searchQuery, timeFrame]);

  const totalRedirects = useMemo(() => {
    return filteredData.reduce((sum, item) => sum + item.redirects[timeFrame], 0);
  }, [filteredData, timeFrame]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', width: '100%' }}>
      {/* Header & Timeframe Bar */}
      <div className="glass-card" style={{ padding: '20px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
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
              <div style={{ display: 'flex', background: 'var(--tab-bg)', padding: '3px', borderRadius: '8px', border: '1px solid var(--tab-border)' }}>
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
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
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
