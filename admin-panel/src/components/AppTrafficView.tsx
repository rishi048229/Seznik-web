import React, { useState, useMemo } from 'react';
import {
  Smartphone,
  Globe,
  FileText,
  Search,
  Calendar,
  Zap,
  ChevronLeft,
  ChevronRight,
  List,
  SlidersHorizontal,
} from 'lucide-react';
import type { TrafficTimeFrame, TrafficPlatform } from '../types/appTraffic';
import { fetchInvoiceTrafficLogs } from '../services/appTrafficService';

const TIMEFRAMES: { id: TrafficTimeFrame; label: string }[] = [
  { id: '24h', label: 'Today / 24 Hours' },
  { id: '7d', label: '7 Days' },
  { id: '30d', label: '30 Days' },
  { id: 'all', label: 'All Time' },
];

interface AppTrafficViewProps {
  defaultPlatform?: TrafficPlatform;
}

export const AppTrafficView: React.FC<AppTrafficViewProps> = ({ defaultPlatform = 'mobile' }) => {
  const [timeFrame, setTimeFrame] = useState<TrafficTimeFrame>('7d');
  const [searchQuery, setSearchQuery] = useState('');

  // View Options State: Paginated vs Scroll View
  const [viewMode, setViewMode] = useState<'paginated' | 'scroll'>('paginated');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);

  const rawLogs = useMemo(() => fetchInvoiceTrafficLogs(), []);

  const isMobileOnly = defaultPlatform === 'mobile';

  // Timeframe limit calculation
  const timeframeFilteredLogs = useMemo(() => {
    const now = Date.now();
    let hoursLimit = 7 * 24;

    if (timeFrame === '24h') hoursLimit = 24;
    if (timeFrame === '7d') hoursLimit = 7 * 24;
    if (timeFrame === '30d') hoursLimit = 30 * 24;
    if (timeFrame === 'all') hoursLimit = 365 * 24 * 10;

    return rawLogs.filter((log) => {
      const diffHours = (now - new Date(log.timestamp).getTime()) / (3600 * 1000);
      const isTimeMatch = diffHours <= hoursLimit;
      const isPlatformMatch = log.platform === defaultPlatform;
      return isTimeMatch && isPlatformMatch;
    });
  }, [rawLogs, timeFrame, defaultPlatform]);

  // Compute total numbers
  const totalInvoices = timeframeFilteredLogs.length;

  // Filter logs by search query
  const displayedLogs = useMemo(() => {
    if (!searchQuery.trim()) return timeframeFilteredLogs;
    const q = searchQuery.toLowerCase().trim();
    return timeframeFilteredLogs.filter(
      (l) =>
        l.invoiceNumber.toLowerCase().includes(q) ||
        l.userName.toLowerCase().includes(q) ||
        l.userEmail.toLowerCase().includes(q) ||
        l.deviceInfo.toLowerCase().includes(q)
    );
  }, [timeframeFilteredLogs, searchQuery]);

  // Pagination calculation
  const totalPages = Math.ceil(displayedLogs.length / pageSize) || 1;
  const safeCurrentPage = Math.min(Math.max(1, currentPage), totalPages);

  const visibleLogs = useMemo(() => {
    if (viewMode === 'scroll') return displayedLogs;
    const startIdx = (safeCurrentPage - 1) * pageSize;
    return displayedLogs.slice(startIdx, startIdx + pageSize);
  }, [displayedLogs, viewMode, safeCurrentPage, pageSize]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', width: '100%' }}>
      {/* Header & Page Description */}
      <div className="glass-card" style={{ padding: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              {isMobileOnly ? (
                <Smartphone size={22} color="var(--accent-emerald)" />
              ) : (
                <Globe size={22} color="var(--accent-blue)" />
              )}
              <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-main)' }}>
                {isMobileOnly ? 'App Traffic Telemetry' : 'Web Traffic Telemetry'}
              </h2>
            </div>
            <p style={{ margin: '6px 0 0 0', fontSize: '0.84rem', color: 'var(--text-muted)', lineHeight: 1.45 }}>
              {isMobileOnly
                ? 'Track invoices generated, numbers, and activity logs created using the Mobile App across different timeframes.'
                : 'Track invoices generated, numbers, and activity logs created using the Web Application across different timeframes.'}
            </p>
          </div>

          {/* Timeframe Selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--tab-bg)', padding: '4px', borderRadius: '8px', border: '1px solid var(--tab-border)' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', padding: '0 8px', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Calendar size={13} color="var(--accent-blue)" />
              Timeframe:
            </span>
            {TIMEFRAMES.map((tf) => (
              <button
                key={tf.id}
                onClick={() => {
                  setTimeFrame(tf.id);
                  setCurrentPage(1);
                }}
                style={{
                  padding: '6px 12px',
                  borderRadius: '6px',
                  border: 'none',
                  background: timeFrame === tf.id ? (isMobileOnly ? 'var(--accent-emerald)' : 'var(--accent-blue)') : 'transparent',
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

      {/* Primary Telemetry Card: Total Invoices Created */}
      <div className="glass-card" style={{ padding: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '10px',
                background: isMobileOnly ? 'rgba(16,185,129,0.12)' : 'rgba(59,130,246,0.12)',
                color: isMobileOnly ? 'var(--accent-emerald)' : 'var(--accent-blue)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {isMobileOnly ? <Smartphone size={22} /> : <Globe size={22} />}
            </div>
            <div>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>
                {isMobileOnly ? 'Total App Invoices Created' : 'Total Web Invoices Created'}
              </span>
              <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--text-main)', margin: '2px 0 0 0' }}>
                {totalInvoices.toLocaleString()} <span style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-muted)' }}>invoices</span>
              </div>
            </div>
          </div>

          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', background: 'var(--bg-main)', padding: '6px 12px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
            Timeframe: <strong>{TIMEFRAMES.find((t) => t.id === timeFrame)?.label}</strong>
          </div>
        </div>
      </div>

      {/* Invoice Activity Logs Card */}
      <div className="glass-card" style={{ padding: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <FileText size={18} color={isMobileOnly ? 'var(--accent-emerald)' : 'var(--accent-blue)'} />
              {isMobileOnly ? 'Mobile App Invoice Creation Logs' : 'Web Application Invoice Creation Logs'}
            </h3>
            <p style={{ margin: '4px 0 0 0', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              Creation logs for invoices generated via {isMobileOnly ? 'Mobile App' : 'Web Traffic'}.
            </p>
          </div>

          {/* View Mode Toggle Switch (Paginated vs Scroll View) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--bg-main)', padding: '4px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)', paddingLeft: '4px' }}>View Mode:</span>
            <button
              onClick={() => setViewMode('paginated')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                padding: '4px 10px',
                borderRadius: '6px',
                border: 'none',
                background: viewMode === 'paginated' ? 'var(--accent-blue)' : 'transparent',
                color: viewMode === 'paginated' ? '#FFFFFF' : 'var(--text-muted)',
                fontSize: '0.75rem',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <SlidersHorizontal size={12} />
              Paginated View
            </button>
            <button
              onClick={() => setViewMode('scroll')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                padding: '4px 10px',
                borderRadius: '6px',
                border: 'none',
                background: viewMode === 'scroll' ? 'var(--accent-blue)' : 'transparent',
                color: viewMode === 'scroll' ? '#FFFFFF' : 'var(--text-muted)',
                fontSize: '0.75rem',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <List size={12} />
              Scroll View
            </button>
          </div>
        </div>

        {/* Search & Controls Bar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
          {/* Search Box */}
          <div style={{ position: 'relative', width: '100%', maxWidth: '360px' }}>
            <Search size={14} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              placeholder="Search invoice number, cashier, or device..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
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

          {/* Page size selector if paginated */}
          {viewMode === 'paginated' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              <span>Show</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                style={{ padding: '4px 8px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-main)', color: 'var(--text-main)', fontSize: '0.78rem', outline: 'none' }}
              >
                <option value={5}>5 logs</option>
                <option value={10}>10 logs</option>
                <option value={20}>20 logs</option>
                <option value={50}>50 logs</option>
              </select>
              <span>per page</span>
            </div>
          )}
        </div>

        {/* Logs Table Container */}
        <div style={{ overflowX: 'auto', maxHeight: viewMode === 'scroll' ? '450px' : 'auto', overflowY: viewMode === 'scroll' ? 'auto' : 'visible' }}>
          <table className="custom-table" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th>Invoice #</th>
                <th>Cashier / User</th>
                <th>Device / Platform</th>
                <th style={{ textAlign: 'right' }}>Amount</th>
                <th>Creation Time</th>
              </tr>
            </thead>
            <tbody>
              {visibleLogs.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>
                    No {isMobileOnly ? 'Mobile App' : 'Web'} invoice creation logs found for this timeframe.
                  </td>
                </tr>
              ) : (
                visibleLogs.map((log) => (
                  <tr key={log.id}>
                    <td style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '0.85rem' }}>
                      {log.invoiceNumber}
                    </td>
                    <td style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-main)' }}>
                      {log.userName}
                    </td>
                    <td style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                      {log.deviceInfo}
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--text-main)', fontSize: '0.88rem' }}>
                      ₹{log.amount.toLocaleString()}
                    </td>
                    <td style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                      {new Date(log.timestamp).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar Footer (Visible when viewMode === 'paginated') */}
        {viewMode === 'paginated' && displayedLogs.length > 0 && (
          <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              Showing <strong>{(safeCurrentPage - 1) * pageSize + 1}</strong> to{' '}
              <strong>{Math.min(safeCurrentPage * pageSize, displayedLogs.length)}</strong> of{' '}
              <strong>{displayedLogs.length}</strong> logs
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={safeCurrentPage === 1}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '6px 12px',
                  borderRadius: '6px',
                  border: '1px solid var(--border-color)',
                  background: 'var(--bg-main)',
                  color: safeCurrentPage === 1 ? 'var(--text-muted)' : 'var(--text-main)',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  cursor: safeCurrentPage === 1 ? 'not-allowed' : 'pointer',
                  opacity: safeCurrentPage === 1 ? 0.5 : 1,
                }}
              >
                <ChevronLeft size={14} />
                Previous
              </button>

              <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-main)', padding: '0 4px' }}>
                Page {safeCurrentPage} of {totalPages}
              </span>

              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={safeCurrentPage === totalPages}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '6px 12px',
                  borderRadius: '6px',
                  border: '1px solid var(--border-color)',
                  background: 'var(--bg-main)',
                  color: safeCurrentPage === totalPages ? 'var(--text-muted)' : 'var(--text-main)',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  cursor: safeCurrentPage === totalPages ? 'not-allowed' : 'pointer',
                  opacity: safeCurrentPage === totalPages ? 0.5 : 1,
                }}
              >
                Next
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
