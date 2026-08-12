import React, { useState, useMemo } from 'react';
import { Calendar, Search } from 'lucide-react';

type TimeFrame = '24h' | '7d' | '30d' | 'all';

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
  };
}

const INITIAL_DATA: ProductRedirectItem[] = [
  {
    id: '1',
    name: 'Classic Banarasi Silk Sari',
    sku: 'SAR-001',
    category: 'Apparel',
    redirects: { '24h': 18, '7d': 124, '30d': 480, all: 1850 },
  },
  {
    id: '2',
    name: 'Leather Bifold Slim Wallet',
    sku: 'WAL-004',
    category: 'Accessories',
    redirects: { '24h': 12, '7d': 89, '30d': 320, all: 1240 },
  },
  {
    id: '3',
    name: 'Wireless Noise Cancelling Earbuds',
    sku: 'EAR-102',
    category: 'Electronics',
    redirects: { '24h': 24, '7d': 165, '30d': 610, all: 2410 },
  },
  {
    id: '4',
    name: 'Organic Assam Green Tea (250g)',
    sku: 'TEA-088',
    category: 'Grocery',
    redirects: { '24h': 8, '7d': 45, '30d': 190, all: 780 },
  },
  {
    id: '5',
    name: 'Ergonomic Mesh Office Chair',
    sku: 'CHR-501',
    category: 'Furniture',
    redirects: { '24h': 15, '7d': 98, '30d': 410, all: 1560 },
  },
  {
    id: '6',
    name: 'Smart Fitness Tracker Band',
    sku: 'FT-900',
    category: 'Electronics',
    redirects: { '24h': 21, '7d': 142, '30d': 530, all: 1980 },
  },
  {
    id: '7',
    name: 'Stainless Steel Water Bottle (1L)',
    sku: 'BOT-330',
    category: 'Home & Kitchen',
    redirects: { '24h': 6, '7d': 38, '30d': 145, all: 620 },
  },
  {
    id: '8',
    name: 'Handcrafted Brass Puja Diya',
    sku: 'DIY-108',
    category: 'Home Decor',
    redirects: { '24h': 4, '7d': 28, '30d': 110, all: 490 },
  },
];

const TIMEFRAMES: { id: TimeFrame; label: string }[] = [
  { id: '24h', label: '24 Hours' },
  { id: '7d', label: '7 Days' },
  { id: '30d', label: '30 Days' },
  { id: 'all', label: 'All Time' },
];

export const RedirectsView: React.FC = () => {
  const [timeFrame, setTimeFrame] = useState<TimeFrame>('7d');
  const [searchQuery, setSearchQuery] = useState('');

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
      {/* Simple Header & Timeframe Bar */}
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

          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
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
        </div>
      </div>

      {/* Simple Search & Table Card */}
      <div className="glass-card" style={{ padding: '24px' }}>
        {/* Search */}
        <div style={{ marginBottom: '16px', position: 'relative', maxWidth: '320px' }}>
          <Search size={14} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            type="text"
            placeholder="Search product or SKU..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '8px 12px 8px 34px',
              borderRadius: '8px',
              border: '1px solid var(--border-color)',
              background: 'var(--bg-main)',
              color: 'var(--text-main)',
              fontSize: '0.8rem',
              outline: 'none',
            }}
          />
        </div>

        {/* Clean Simple Table: Product & Redirects Count */}
        <div style={{ overflowX: 'auto' }}>
          <table className="custom-table" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th>Product</th>
                <th style={{ textAlign: 'right' }}>Number of Redirects</th>
              </tr>
            </thead>
            <tbody>
              {filteredData.length === 0 ? (
                <tr>
                  <td colSpan={2} style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>
                    No products found.
                  </td>
                </tr>
              ) : (
                filteredData.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <div style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '0.88rem' }}>
                        {item.name}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        SKU: {item.sku}
                      </div>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <span className="badge badge-active" style={{ fontSize: '0.85rem', fontWeight: 700, padding: '4px 12px' }}>
                        {item.redirects[timeFrame].toLocaleString()}
                      </span>
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
