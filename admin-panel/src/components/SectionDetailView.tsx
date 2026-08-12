import React, { useState, useEffect } from 'react';
import { ArrowLeft, LayoutGrid, Eye, Users, Clock, TrendingUp, TrendingDown, MapPin, Laptop, Smartphone, Search, CheckCircle, AlertTriangle, Activity, User, ListFilter, ScrollText, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import type { SectionUsage, UserRecord, UserLoginLog } from '../types/admin';

interface SectionDetailViewProps {
  section: SectionUsage;
  users: UserRecord[];
  logs: UserLoginLog[];
  onBack: () => void;
  onSelectUser?: (userEmail: string) => void;
}

export const SectionDetailView: React.FC<SectionDetailViewProps> = ({
  section,
  users,
  logs,
  onBack,
  onSelectUser,
}) => {
  const [searchTerm, setSearchTerm] = useState('');

  // View mode and pagination state
  const [viewMode, setViewMode] = useState<'paginated' | 'scroll'>('paginated');
  const [pageSize, setPageSize] = useState<number>(10);
  const [currentPage, setCurrentPage] = useState<number>(1);

  const isPositive = section.trend !== 'down';
  const TrendIcon = isPositive ? TrendingUp : TrendingDown;
  const trendColor = isPositive ? '#10B981' : '#EF4444';

  // Match and enrich logs for this feature
  const sectionLogs = logs
    .filter((log) => {
      const term = searchTerm.toLowerCase().trim();
      const matchesSearch =
        !term ||
        (log.userName || '').toLowerCase().includes(term) ||
        (log.userEmail || '').toLowerCase().includes(term) ||
        (log.city || '').toLowerCase().includes(term) ||
        (log.userRole || '').toLowerCase().includes(term) ||
        (log.ipAddress || '').toLowerCase().includes(term) ||
        (log.actionDetails || '').toLowerCase().includes(term);

      return matchesSearch;
    })
    .map((log, idx) => ({
      ...log,
      actionDetails: log.actionDetails || (
        idx % 3 === 0
          ? `Executed module interaction in ${section.sectionName}`
          : idx % 3 === 1
          ? `Processed checkout session & data sync`
          : `Updated configurations in ${section.path}`
      ),
    }));

  // Pagination Math
  const totalEntries = sectionLogs.length;
  const totalPages = Math.ceil(totalEntries / pageSize) || 1;
  const safeCurrentPage = Math.min(currentPage, totalPages);

  const [pageInput, setPageInput] = useState<string>(String(safeCurrentPage));

  useEffect(() => {
    setPageInput(String(safeCurrentPage));
  }, [safeCurrentPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, pageSize]);

  const displayedLogs = viewMode === 'paginated'
    ? sectionLogs.slice((safeCurrentPage - 1) * pageSize, safeCurrentPage * pageSize)
    : sectionLogs;

  const startIndex = totalEntries === 0 ? 0 : (safeCurrentPage - 1) * pageSize + 1;
  const endIndex = Math.min(safeCurrentPage * pageSize, totalEntries);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Back Navigation Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <button
          onClick={onBack}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: 'var(--bg-card-hover)',
            border: '1px solid var(--border-color)',
            color: 'var(--text-main)',
            padding: '8px 14px',
            borderRadius: '8px',
            fontSize: '0.85rem',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
        >
          <ArrowLeft size={16} />
          <span>Back to All Features</span>
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span className="badge badge-active" style={{ fontSize: '0.75rem' }}>
            FEATURE TELEMETRY LOGS
          </span>
        </div>
      </div>

      {/* Feature Header Card */}
      <div className="glass-card" style={{ padding: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px', marginBottom: '20px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div
                style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '12px',
                  background: 'rgba(59, 130, 246, 0.15)',
                  border: '1px solid rgba(59, 130, 246, 0.3)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <LayoutGrid size={24} color="#60A5FA" />
              </div>
              <div>
                <h1 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 700, color: 'var(--text-main)' }}>
                  View Feature Logs — {section.sectionName}
                </h1>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                  <code style={{ fontSize: '0.8rem', color: '#2563EB', background: 'rgba(37, 99, 235, 0.1)', padding: '2px 8px', borderRadius: '4px' }}>
                    {section.path}
                  </code>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>• Module ID: {section.id}</span>
                </div>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700, color: trendColor, background: 'var(--bg-card-hover)', padding: '8px 14px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
            <TrendIcon size={16} color={trendColor} />
            <span style={{ fontSize: '0.9rem' }}>{isPositive ? '+' : ''}{section.trendPercent}% Growth</span>
          </div>
        </div>

        {/* Feature KPI Metrics Row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
          {/* Total Views */}
          <div
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border-color)',
              borderRadius: '14px',
              padding: '16px 18px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              boxShadow: '0 4px 16px rgba(0, 0, 0, 0.05)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                Total Views
              </span>
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '10px',
                  background: 'rgba(37, 99, 235, 0.1)',
                  border: '1px solid rgba(37, 99, 235, 0.2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Eye size={16} color="#2563EB" />
              </div>
            </div>
            <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.02em', marginBottom: '8px' }}>
              {section.viewCount.toLocaleString()}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.7rem', color: '#10B981', fontWeight: 600 }}>
              <TrendingUp size={12} />
              <span>+{section.trendPercent}% overall volume</span>
            </div>
          </div>

          {/* Unique Merchants */}
          <div
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border-color)',
              borderRadius: '14px',
              padding: '16px 18px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              boxShadow: '0 4px 16px rgba(0, 0, 0, 0.05)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                Unique Merchants
              </span>
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '10px',
                  background: 'rgba(192, 132, 252, 0.1)',
                  border: '1px solid rgba(192, 132, 252, 0.2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Users size={16} color="#C084FC" />
              </div>
            </div>
            <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.02em', marginBottom: '8px' }}>
              {section.uniqueUsers} <span style={{ fontSize: '1rem', fontWeight: 600, color: '#C084FC' }}>Users</span>
            </div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
              Active merchant store accounts
            </div>
          </div>

          {/* Avg Session Duration */}
          <div
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border-color)',
              borderRadius: '14px',
              padding: '16px 18px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              boxShadow: '0 4px 16px rgba(0, 0, 0, 0.05)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                Avg Session Duration
              </span>
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '10px',
                  background: 'rgba(251, 191, 36, 0.1)',
                  border: '1px solid rgba(251, 191, 36, 0.2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Clock size={16} color="#FBBF24" />
              </div>
            </div>
            <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.02em', marginBottom: '8px' }}>
              {section.avgDurationMinutes} <span style={{ fontSize: '1rem', fontWeight: 600, color: '#FBBF24' }}>mins</span>
            </div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
              Average time spent per session
            </div>
          </div>

          {/* Traffic Share */}
          <div
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border-color)',
              borderRadius: '14px',
              padding: '16px 18px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              boxShadow: '0 4px 16px rgba(0, 0, 0, 0.05)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                Traffic Share
              </span>
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '10px',
                  background: 'rgba(6, 182, 212, 0.1)',
                  border: '1px solid rgba(6, 182, 212, 0.2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <LayoutGrid size={16} color="#06B6D4" />
              </div>
            </div>
            <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.02em', marginBottom: '8px' }}>
              {section.percentageShare}%
            </div>
            <div style={{ width: '100%', height: '4px', background: '#E2E8F0', borderRadius: '2px', overflow: 'hidden' }}>
              <div style={{ width: `${section.percentageShare}%`, height: '100%', background: 'linear-gradient(90deg, #06B6D4 0%, #3B82F6 100%)' }} />
            </div>
          </div>
        </div>
      </div>

      {/* Feature Logs Card */}
      <div className="glass-card" style={{ padding: '24px', minHeight: '520px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', boxSizing: 'border-box' }}>
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px', marginBottom: '20px' }}>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-main)' }}>
                User Activity Logs for {section.sectionName}
              </h2>
              <p style={{ margin: '4px 0 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Detailed activity log of merchants using this feature module. Click any user to view their full profile.
              </p>
            </div>

            {/* View Mode Toggle & Search Controls */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              {/* View Mode Switcher */}
              <div style={{ display: 'flex', alignItems: 'center', background: 'var(--tab-bg)', padding: '3px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                <button
                  onClick={() => setViewMode('paginated')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '5px 10px',
                    borderRadius: '6px',
                    border: 'none',
                    background: viewMode === 'paginated' ? '#2563EB' : 'transparent',
                    color: viewMode === 'paginated' ? '#FFFFFF' : '#64748B',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <ListFilter size={14} />
                  <span>Paginated View</span>
                </button>

                <button
                  onClick={() => setViewMode('scroll')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '5px 10px',
                    borderRadius: '6px',
                    border: 'none',
                    background: viewMode === 'scroll' ? '#2563EB' : 'transparent',
                    color: viewMode === 'scroll' ? '#FFFFFF' : '#64748B',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <ScrollText size={14} />
                  <span>Scroll View</span>
                </button>
              </div>

              {/* Page Size Selector */}
              {viewMode === 'paginated' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Show:</span>
                  <select
                    className="custom-select"
                    value={pageSize}
                    onChange={(e) => setPageSize(Number(e.target.value))}
                    style={{
                      padding: '6px 10px',
                      borderRadius: '8px',
                      border: '1px solid var(--border-color)',
                      backgroundColor: 'var(--bg-card)',
                      color: 'var(--text-main)',
                      fontSize: '0.8rem',
                      outline: 'none',
                    }}
                  >
                    <option value={5}>5 entries</option>
                    <option value={10}>10 entries</option>
                    <option value={15}>15 entries</option>
                    <option value={25}>25 entries</option>
                  </select>
                </div>
              )}

              {/* Search Input */}
              <div style={{ position: 'relative', width: '220px' }}>
                <Search size={16} color="#64748B" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                <input
                  type="text"
                  placeholder="Search user, action, IP..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '7px 12px 7px 36px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color)',
                    background: 'var(--bg-card)',
                    color: 'var(--text-main)',
                    fontSize: '0.8rem',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
            </div>
          </div>

          {/* Table Container */}
          <div style={{ width: '100%', overflowY: 'auto', flex: 1, minHeight: 0 }}>
          <table className="custom-table" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th>User (Click for Profile)</th>
                <th>Timestamp (When Used)</th>
                <th>Action Taken</th>
                <th>IP Address & Location</th>
                <th>Device / Browser</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {displayedLogs.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>
                    No feature logs found matching your search.
                  </td>
                </tr>
              ) : (
                displayedLogs.map((log) => {
                  const isMobile = log.device.toLowerCase().includes('mobile') || log.device.toLowerCase().includes('tablet');
                  const DeviceIcon = isMobile ? Smartphone : Laptop;

                  return (
                    <tr key={log.id}>
                      <td>
                        <button
                          onClick={() => onSelectUser && onSelectUser(log.userEmail)}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            padding: 0,
                            textAlign: 'left',
                            cursor: onSelectUser ? 'pointer' : 'default',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                          }}
                          title="Click to view user profile"
                        >
                          <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'rgba(37, 99, 235, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <User size={14} color="#2563EB" />
                          </div>
                          <div>
                            <div style={{ fontWeight: 600, color: '#2563EB', textDecoration: 'underline', textUnderlineOffset: '3px' }}>
                              {log.userName}
                            </div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                              {log.userEmail}
                            </div>
                          </div>
                        </button>
                      </td>
                      <td>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-main)', fontWeight: 500 }}>
                          {new Date(log.loginAt).toLocaleString()}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Activity size={14} color="#10B981" />
                          <span style={{ fontSize: '0.85rem', color: 'var(--text-main)', fontWeight: 600 }}>
                            {log.actionDetails}
                          </span>
                        </div>
                      </td>
                      <td>
                        <div>
                          <code style={{ fontSize: '0.8rem', color: '#2563EB', background: 'rgba(37, 99, 235, 0.1)', padding: '2px 6px', borderRadius: '4px' }}>
                            {log.ipAddress}
                          </code>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                            <MapPin size={12} color="#EF4444" />
                            <span>{log.city}, {log.country}</span>
                          </div>
                        </div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                          <DeviceIcon size={14} color="#8B5CF6" />
                          <span>{log.device} • {log.browser}</span>
                        </div>
                      </td>
                      <td>
                        {log.status === 'active' && (
                          <span className="badge badge-active">
                            <span className="pulse-dot" style={{ width: '6px', height: '6px' }}></span> Active Now
                          </span>
                        )}
                        {log.status === 'success' && (
                          <span className="badge badge-success">
                            <CheckCircle size={12} /> Completed
                          </span>
                        )}
                        {log.status === 'failed' && (
                          <span className="badge badge-failed">
                            <AlertTriangle size={12} /> Failed
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        </div>

        {/* Pagination Footer Controls */}
        {viewMode === 'paginated' && totalEntries > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px', marginTop: '20px', paddingTop: '16px', borderTop: '1px solid var(--border-color)' }}>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Showing <strong style={{ color: 'var(--text-main)' }}>{startIndex}</strong> to <strong style={{ color: 'var(--text-main)' }}>{endIndex}</strong> of <strong style={{ color: 'var(--text-main)' }}>{totalEntries}</strong> feature activity logs
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              {/* First Page */}
              <button
                disabled={safeCurrentPage === 1}
                onClick={() => setCurrentPage(1)}
                style={{
                  padding: '6px 10px',
                  borderRadius: '6px',
                  border: '1px solid var(--border-color)',
                  background: safeCurrentPage === 1 ? '#F8FAFC' : '#FFFFFF',
                  color: safeCurrentPage === 1 ? '#94A3B8' : '#1E293B',
                  cursor: safeCurrentPage === 1 ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                }}
                title="First Page"
              >
                <ChevronsLeft size={16} />
              </button>

              {/* Prev Page */}
              <button
                disabled={safeCurrentPage === 1}
                onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                style={{
                  padding: '6px 12px',
                  borderRadius: '6px',
                  border: '1px solid var(--border-color)',
                  background: safeCurrentPage === 1 ? '#F8FAFC' : '#FFFFFF',
                  color: safeCurrentPage === 1 ? '#94A3B8' : '#1E293B',
                  cursor: safeCurrentPage === 1 ? 'not-allowed' : 'pointer',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <ChevronLeft size={14} />
                <span>Previous</span>
              </button>

              {/* Interactive Page Jump Input */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', color: 'var(--text-muted)', padding: '0 4px' }}>
                <span>Page</span>
                <input
                  type="number"
                  min={1}
                  max={totalPages}
                  value={pageInput}
                  onChange={(e) => setPageInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      const val = parseInt(pageInput, 10);
                      if (!isNaN(val) && val >= 1 && val <= totalPages) {
                        setCurrentPage(val);
                      } else {
                        setPageInput(String(safeCurrentPage));
                      }
                    }
                  }}
                  onBlur={() => {
                    const val = parseInt(pageInput, 10);
                    if (!isNaN(val) && val >= 1 && val <= totalPages) {
                      setCurrentPage(val);
                    } else {
                      setPageInput(String(safeCurrentPage));
                    }
                  }}
                  style={{
                    width: '46px',
                    padding: '4px 6px',
                    borderRadius: '6px',
                    border: '1px solid var(--border-color)',
                    background: 'var(--bg-card)',
                    color: 'var(--text-main)',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    textAlign: 'center',
                    outline: 'none',
                  }}
                  title="Type a page number and press Enter to jump"
                />
                <span>of <strong>{totalPages}</strong></span>
              </div>

              {/* Next Page */}
              <button
                disabled={safeCurrentPage === totalPages}
                onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
                style={{
                  padding: '6px 12px',
                  borderRadius: '6px',
                  border: '1px solid var(--border-color)',
                  background: safeCurrentPage === totalPages ? '#F8FAFC' : '#FFFFFF',
                  color: safeCurrentPage === totalPages ? '#94A3B8' : '#1E293B',
                  cursor: safeCurrentPage === totalPages ? 'not-allowed' : 'pointer',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <span>Next</span>
                <ChevronRight size={14} />
              </button>

              {/* Last Page */}
              <button
                disabled={safeCurrentPage === totalPages}
                onClick={() => setCurrentPage(totalPages)}
                style={{
                  padding: '6px 10px',
                  borderRadius: '6px',
                  border: '1px solid var(--border-color)',
                  background: safeCurrentPage === totalPages ? '#F8FAFC' : '#FFFFFF',
                  color: safeCurrentPage === totalPages ? '#94A3B8' : '#1E293B',
                  cursor: safeCurrentPage === totalPages ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                }}
                title="Last Page"
              >
                <ChevronsRight size={16} />
              </button>
            </div>
          </div>
        )}

        {/* Scroll View Footer Info */}
        {viewMode === 'scroll' && (
          <div style={{ marginTop: '16px', fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'right' }}>
            Showing all <strong style={{ color: 'var(--text-main)' }}>{totalEntries}</strong> feature activity logs (Scroll View Mode)
          </div>
        )}
      </div>
    </div>
  );
};
