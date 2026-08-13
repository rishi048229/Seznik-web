import React from 'react';
import { ShieldAlert, AlertTriangle, ArrowRight, Lock, MapPin, Globe } from 'lucide-react';
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
        padding: '24px',
        background: 'var(--bg-card)',
        border: '1px solid rgba(239, 68, 68, 0.25)',
        borderRadius: '16px',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.05)',
      }}
    >
      {/* Top Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px', marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '10px',
              background: 'rgba(239, 68, 68, 0.12)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <ShieldAlert size={22} color="#EF4444" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-main)' }}>
                Security &amp; Anomaly Telemetry
              </h3>
              <span className="badge badge-failed" style={{ fontSize: '0.72rem', padding: '3px 9px' }}>
                {d.recentFlaggedEvents.length} Flagged Event
              </span>
            </div>
            <p style={{ margin: '4px 0 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Real-time monitoring of authentication failures, anomalous geographic access, and security risks.
            </p>
          </div>
        </div>

        {onViewSecurityLogs && (
          <button
            onClick={onViewSecurityLogs}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              background: 'rgba(59, 130, 246, 0.08)',
              border: '1px solid rgba(59, 130, 246, 0.2)',
              color: 'var(--accent-blue)',
              borderRadius: '8px',
              fontSize: '0.8rem',
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

      {/* Structured Content Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px', alignItems: 'stretch' }}>
        {/* KPI 1: Failed Logins */}
        <div
          style={{
            padding: '16px',
            borderRadius: '12px',
            background: 'var(--bg-main)',
            border: '1px solid var(--border-color)',
            display: 'flex',
            alignItems: 'center',
            gap: '14px',
          }}
        >
          <div
            style={{
              width: '38px',
              height: '38px',
              borderRadius: '10px',
              background: 'rgba(239, 68, 68, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#EF4444',
              flexShrink: 0,
            }}
          >
            <Lock size={18} />
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Failed Logins
            </div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-main)', margin: '2px 0 0 0' }}>
              {d.failedLoginCount} <span style={{ fontSize: '0.75rem', color: '#10B981', fontWeight: 600 }}>(↓50%)</span>
            </div>
          </div>
        </div>

        {/* KPI 2: Anomalous Logins */}
        <div
          style={{
            padding: '16px',
            borderRadius: '12px',
            background: 'var(--bg-main)',
            border: '1px solid var(--border-color)',
            display: 'flex',
            alignItems: 'center',
            gap: '14px',
          }}
        >
          <div
            style={{
              width: '38px',
              height: '38px',
              borderRadius: '10px',
              background: 'rgba(245, 158, 11, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#F59E0B',
              flexShrink: 0,
            }}
          >
            <AlertTriangle size={18} />
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Anomalous Logins
            </div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-main)', margin: '2px 0 0 0' }}>
              {d.anomalousLoginCount} <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 500 }}>(0%)</span>
            </div>
          </div>
        </div>

        {/* Recent Flagged Event Banner */}
        {flagged && (
          <div
            style={{
              gridColumn: '1 / -1',
              padding: '14px 18px',
              borderRadius: '12px',
              background: 'rgba(245, 158, 11, 0.08)',
              border: '1px solid rgba(245, 158, 11, 0.25)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '12px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <AlertTriangle size={18} color="#F59E0B" style={{ flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-main)' }}>
                  {flagged.reason}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <MapPin size={12} /> {flagged.location}
                  </span>
                  <span>•</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Globe size={12} /> IP: <code style={{ color: 'var(--accent-blue)', fontWeight: 600 }}>{flagged.ipAddress}</code>
                  </span>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span className="badge badge-free" style={{ fontSize: '0.7rem', color: '#F59E0B', borderColor: 'rgba(245,158,11,0.3)', background: 'rgba(245,158,11,0.1)' }}>
                Warning Severity
              </span>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 500 }}>
                12h ago
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
