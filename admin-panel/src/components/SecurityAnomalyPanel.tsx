import React from 'react';
import { ShieldAlert, AlertTriangle, ArrowRight } from 'lucide-react';
import type { SecurityAnomalyData } from '../types/admin';

interface SecurityAnomalyPanelProps {
  data?: SecurityAnomalyData;
  summaryOnly?: boolean;
  onViewSecurityLogs?: () => void;
}

export const SecurityAnomalyPanel: React.FC<SecurityAnomalyPanelProps> = ({
  data,
  onViewSecurityLogs,
}) => {
  const defaultData: SecurityAnomalyData = {
    failedLoginCount: 1,
    failedLoginTrend: -50,
    anomalousLoginCount: 1,
    anomalousLoginTrend: 0,
    recentFlaggedEvents: [
      {
        id: 'sec-evt-1',
        timestamp: new Date(Date.now() - 12 * 3600 * 1000).toISOString(),
        location: 'Frankfurt, Germany',
        ipAddress: '185.220.101.5',
        reason: 'Failed credentials from unexpected country',
        severity: 'warning',
      },
    ],
  };

  const d = data || defaultData;
  const flagged = d.recentFlaggedEvents[0];

  return (
    <div
      className="glass-card"
      style={{
        padding: '16px 20px',
        background: 'var(--bg-card)',
        border: '1px solid rgba(239, 68, 68, 0.2)',
        borderRadius: '14px',
        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.05)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
        {/* Left Title & Status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div
            style={{
              width: '38px',
              height: '38px',
              borderRadius: '10px',
              background: 'rgba(248, 113, 113, 0.15)',
              border: '1px solid rgba(248, 113, 113, 0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <ShieldAlert size={20} color="#F87171" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-main)' }}>
                Security &amp; Anomaly Telemetry
              </h3>
              <span className="badge badge-failed" style={{ fontSize: '0.7rem', padding: '2px 8px' }}>
                1 Flagged Event
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
              <span>Failed Logins: <strong style={{ color: '#DC2626' }}>{d.failedLoginCount} (↓50%)</strong></span>
              <span>•</span>
              <span>Anomalous Logins: <strong style={{ color: '#D97706' }}>{d.anomalousLoginCount} (0%)</strong></span>
            </div>
          </div>
        </div>

        {/* Center Banner for Recent Flagged Event */}
        {flagged && (
          <div
            style={{
              flex: 1,
              minWidth: '280px',
              background: 'var(--bg-card-hover)',
              border: '1px solid rgba(217, 119, 6, 0.25)',
              borderRadius: '10px',
              padding: '8px 14px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AlertTriangle size={16} color="#D97706" />
              <div>
                <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-main)' }}>
                  {flagged.reason}
                </div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                  {flagged.location} • <code style={{ color: 'var(--accent-blue)' }}>{flagged.ipAddress}</code>
                </div>
              </div>
            </div>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
              12h ago
            </span>
          </div>
        )}

        {/* Right Action Button */}
        {onViewSecurityLogs && (
          <button
            onClick={onViewSecurityLogs}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              background: 'rgba(79, 142, 247, 0.08)',
              border: '1px solid rgba(79, 142, 247, 0.2)',
              color: 'var(--accent-blue)',
              borderRadius: '8px',
              fontSize: '0.75rem',
              fontWeight: 600,
              cursor: 'pointer',
              padding: '8px 14px',
              transition: 'all 0.15s ease',
            }}
          >
            <span>View Audit Logs</span>
            <ArrowRight size={14} />
          </button>
        )}
      </div>
    </div>
  );
};
