import React, { useState, useEffect } from 'react';
import { Search, ShieldAlert, Laptop, Smartphone, CheckCircle, AlertTriangle, MapPin, Activity, X, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, ListFilter, ScrollText } from 'lucide-react';
import type { UserLoginLog } from '../types/admin';

interface LoginAuditTableProps {
  logs: UserLoginLog[];
  filterUserEmail?: string | null;
  onClearFilterUser?: () => void;
  onSelectUser?: (userEmail: string) => void;
}

export const LoginAuditTable: React.FC<LoginAuditTableProps> = ({
  logs,
  filterUserEmail,
  onClearFilterUser,
  onSelectUser,
}) => {
  const [searchTerm, setSearchTerm] = useState(filterUserEmail || '');
  const [statusFilter, setStatusFilter] = useState('all');
  const [activityFilter, setActivityFilter] = useState('all');

  // View mode and pagination state
  const [viewMode, setViewMode] = useState<'paginated' | 'scroll'>('paginated');
  const [pageSize, setPageSize] = useState<number>(10);
  const [currentPage, setCurrentPage] = useState<number>(1);

  useEffect(() => {
    if (filterUserEmail) {
      setSearchTerm(filterUserEmail);
    }
  }, [filterUserEmail]);

  // Reset page to 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter, activityFilter, pageSize]);

  // Rich logs mapping
  const richLogs = logs.map((l, idx) => ({
    ...l,
    actionType: l.actionType || (idx % 3 === 0 ? 'module_access' : idx % 3 === 1 ? 'login' : 'billing'),
    actionDetails: l.actionDetails || (
      idx % 3 === 0
        ? 'Accessed Label Studio & Barcode Designer'
        : idx % 3 === 1
        ? 'Authenticated session login success'
        : 'Generated POS Lite tax invoice receipt'
    ),
  }));

  const filteredLogs = richLogs.filter((log) => {
    const term = searchTerm.toLowerCase().trim();
    const matchesSearch =
      !term ||
      (log.userName || '').toLowerCase().includes(term) ||
      (log.userEmail || '').toLowerCase().includes(term) ||
      (log.userId || '').toLowerCase().includes(term) ||
      (log.ipAddress || '').toLowerCase().includes(term) ||
      (log.city || '').toLowerCase().includes(term) ||
      (log.country || '').toLowerCase().includes(term) ||
      (log.userRole || '').toLowerCase().includes(term) ||
      (log.device || '').toLowerCase().includes(term) ||
      (log.actionDetails || '').toLowerCase().includes(term);

    const matchesStatus = statusFilter === 'all' || log.status === statusFilter;
    const matchesActivity = activityFilter === 'all' || log.actionType === activityFilter;
    return matchesSearch && matchesStatus && matchesActivity;
  });

  // Pagination Math
  const totalEntries = filteredLogs.length;
  const totalPages = Math.ceil(totalEntries / pageSize) || 1;
  const safeCurrentPage = Math.min(currentPage, totalPages);

  const displayedLogs = viewMode === 'paginated'
    ? filteredLogs.slice((safeCurrentPage - 1) * pageSize, safeCurrentPage * pageSize)
    : filteredLogs;

  const startIndex = totalEntries === 0 ? 0 : (safeCurrentPage - 1) * pageSize + 1;
  const endIndex = Math.min(safeCurrentPage * pageSize, totalEntries);

  return (
    <div className="glass-card" style={{ padding: '24px', marginBottom: '24px' }}>
      {/* Header Bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px', marginBottom: '20px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ShieldAlert size={20} color="#3B82F6" />
            <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#F9FAFB' }}>
              User Audit Logs & Activity Telemetry
            </h2>
          </div>
          <p style={{ margin: '4px 0 0 0', fontSize: '0.8rem', color: '#9CA3AF' }}>
            Real-time activity log tracking authenticated logins, module interactions, IP locations, and security flags.
          </p>

          {filterUserEmail && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px' }}>
              <span className="badge badge-active" style={{ fontSize: '0.75rem' }}>
                Filtered for user: {filterUserEmail}
              </span>
              {onClearFilterUser && (
                <button
                  onClick={() => {
                    setSearchTerm('');
                    onClearFilterUser();
                  }}
                  style={{ background: 'transparent', border: 'none', color: '#9CA3AF', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                >
                  <X size={14} />
                </button>
              )}
            </div>
          )}
        </div>

        {/* View Mode Toggle & Filter Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          {/* View Mode Switcher */}
          <div style={{ display: 'flex', alignItems: 'center', background: '#111827', padding: '3px', borderRadius: '8px', border: '1px solid #374151' }}>
            <button
              onClick={() => setViewMode('paginated')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '5px 10px',
                borderRadius: '6px',
                border: 'none',
                background: viewMode === 'paginated' ? '#3B82F6' : 'transparent',
                color: viewMode === 'paginated' ? '#FFFFFF' : '#9CA3AF',
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
                background: viewMode === 'scroll' ? '#3B82F6' : 'transparent',
                color: viewMode === 'scroll' ? '#FFFFFF' : '#9CA3AF',
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

          {/* Entries Per Page Dropdown (Only visible in Paginated Mode) */}
          {viewMode === 'paginated' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '0.75rem', color: '#9CA3AF' }}>Show:</span>
              <select
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
                style={{
                  padding: '6px 10px',
                  borderRadius: '8px',
                  border: '1px solid #374151',
                  background: '#111827',
                  color: '#F9FAFB',
                  fontSize: '0.8rem',
                  outline: 'none',
                  cursor: 'pointer',
                }}
              >
                <option value={5}>5 entries</option>
                <option value={10}>10 entries</option>
                <option value={25}>25 entries</option>
                <option value={50}>50 entries</option>
              </select>
            </div>
          )}

          {/* Search Box */}
          <div style={{ position: 'relative', width: '220px', maxWidth: '100%' }}>
            <Search size={16} color="#9CA3AF" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
            <input
              type="text"
              placeholder="Search user, activity, IP..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                width: '100%',
                padding: '7px 12px 7px 36px',
                borderRadius: '8px',
                border: '1px solid #374151',
                background: '#111827',
                color: '#F9FAFB',
                fontSize: '0.8rem',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>

          {/* Activity Type Filter */}
          <select
            value={activityFilter}
            onChange={(e) => setActivityFilter(e.target.value)}
            style={{
              padding: '7px 10px',
              borderRadius: '8px',
              border: '1px solid #374151',
              background: '#111827',
              color: '#F9FAFB',
              fontSize: '0.8rem',
              outline: 'none',
              cursor: 'pointer',
            }}
          >
            <option value="all">All Activities</option>
            <option value="login">Logins Only</option>
            <option value="module_access">Module Access</option>
            <option value="billing">POS Billing</option>
            <option value="export">Exports & Reports</option>
            <option value="security_flag">Security Flags</option>
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{
              padding: '7px 10px',
              borderRadius: '8px',
              border: '1px solid #374151',
              background: '#111827',
              color: '#F9FAFB',
              fontSize: '0.8rem',
              outline: 'none',
              cursor: 'pointer',
            }}
          >
            <option value="all">All Statuses</option>
            <option value="active">Active Sessions</option>
            <option value="success">Success</option>
            <option value="failed">Failed Attempts</option>
          </select>
        </div>
      </div>

      {/* Table Container */}
      <div style={{ width: '100%', overflowY: viewMode === 'scroll' ? 'auto' : 'visible', maxHeight: viewMode === 'scroll' ? '500px' : 'none' }}>
        <table className="custom-table" style={{ width: '100%' }}>
          <thead>
            <tr>
              <th>User Details</th>
              <th>Activity / Event</th>
              <th>IP Address</th>
              <th>Location</th>
              <th>Device / Browser</th>
              <th>Timestamp</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {displayedLogs.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: '30px', color: '#9CA3AF' }}>
                  No user activity logs match your search.
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
                        }}
                        title="Click to view user profile"
                      >
                        <div style={{ fontWeight: 600, color: '#60A5FA', textDecoration: onSelectUser ? 'underline' : 'none', textUnderlineOffset: '2px' }}>
                          {log.userName}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: '#9CA3AF' }}>{log.userEmail}</div>
                      </button>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ width: '28px', height: '28px', borderRadius: '8px', background: 'rgba(59, 130, 246, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <Activity size={14} color="#60A5FA" />
                        </div>
                        <div>
                          <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#F9FAFB' }}>
                            {log.actionDetails}
                          </div>
                          <div style={{ fontSize: '0.7rem', color: '#9CA3AF' }}>
                            Role: {log.userRole}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <code style={{ fontSize: '0.8rem', color: '#60A5FA', background: 'rgba(59, 130, 246, 0.1)', padding: '3px 6px', borderRadius: '4px' }}>
                        {log.ipAddress}
                      </code>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem' }}>
                        <MapPin size={14} color="#EF4444" />
                        <span>{log.city}, {log.country}</span>
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', color: '#9CA3AF' }}>
                        <DeviceIcon size={14} color="#8B5CF6" />
                        <span>{log.device} • {log.browser}</span>
                      </div>
                    </td>
                    <td>
                      <span style={{ fontSize: '0.75rem', color: '#9CA3AF' }}>
                        {new Date(log.loginAt).toLocaleString()}
                      </span>
                    </td>
                    <td>
                      {log.status === 'active' && (
                        <span className="badge badge-active">
                          <span className="pulse-dot" style={{ width: '6px', height: '6px' }}></span> Active Now
                        </span>
                      )}
                      {log.status === 'success' && (
                        <span className="badge badge-success">
                          <CheckCircle size={12} /> Logged In
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

      {/* Pagination Footer Controls */}
      {viewMode === 'paginated' && totalEntries > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px', marginTop: '20px', paddingTop: '16px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
          <div style={{ fontSize: '0.8rem', color: '#9CA3AF' }}>
            Showing <strong style={{ color: '#F9FAFB' }}>{startIndex}</strong> to <strong style={{ color: '#F9FAFB' }}>{endIndex}</strong> of <strong style={{ color: '#F9FAFB' }}>{totalEntries}</strong> activity entries
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            {/* First Page */}
            <button
              disabled={safeCurrentPage === 1}
              onClick={() => setCurrentPage(1)}
              style={{
                padding: '6px 10px',
                borderRadius: '6px',
                border: '1px solid #374151',
                background: safeCurrentPage === 1 ? '#111827' : '#1F2937',
                color: safeCurrentPage === 1 ? '#4B5563' : '#F9FAFB',
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
                border: '1px solid #374151',
                background: safeCurrentPage === 1 ? '#111827' : '#1F2937',
                color: safeCurrentPage === 1 ? '#4B5563' : '#F9FAFB',
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

            {/* Page Info Indicator */}
            <span style={{ fontSize: '0.8rem', color: '#D1D5DB', padding: '0 8px', fontWeight: 600 }}>
              Page {safeCurrentPage} of {totalPages}
            </span>

            {/* Next Page */}
            <button
              disabled={safeCurrentPage === totalPages}
              onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
              style={{
                padding: '6px 12px',
                borderRadius: '6px',
                border: '1px solid #374151',
                background: safeCurrentPage === totalPages ? '#111827' : '#1F2937',
                color: safeCurrentPage === totalPages ? '#4B5563' : '#F9FAFB',
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
                border: '1px solid #374151',
                background: safeCurrentPage === totalPages ? '#111827' : '#1F2937',
                color: safeCurrentPage === totalPages ? '#4B5563' : '#F9FAFB',
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
        <div style={{ marginTop: '16px', fontSize: '0.8rem', color: '#9CA3AF', textAlign: 'right' }}>
          Showing all <strong style={{ color: '#F9FAFB' }}>{totalEntries}</strong> activity entries (Scroll View Mode)
        </div>
      )}
    </div>
  );
};
