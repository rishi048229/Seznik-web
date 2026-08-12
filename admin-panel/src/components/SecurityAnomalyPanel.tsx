import React from 'react';
import { ShieldAlert, AlertTriangle, ShieldCheck, ArrowRight } from 'lucide-react';
import type { SecurityAnomalyData } from '../types/admin';
import { EmptyState } from './EmptyState';

interface SecurityAnomalyPanelProps {
  data?: SecurityAnomalyData;
  summaryOnly?: boolean;
  onViewSecurityLogs?: () => void;
}

export const SecurityAnomalyPanel: React.FC<SecurityAnomalyPanelProps> = ({
  data,
  summaryOnly = false,
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

  return (
    <div className="glass-card" style={{ padding: '20px', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <ShieldAlert size={20} color="#F87171" />
          <div>
            <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#F9FAFB' }}>
              Security & Anomaly Telemetry
            </h2>
            {!summaryOnly && (
              <p style={{ margin: '2px 0 0 0', fontSize: '0.75rem', color: '#9CA3AF' }}>
                Failed login attempts and suspicious international IP events.
              </p>
            )}
          </div>
        </div>

        {onViewSecurityLogs && (
          <button
            onClick={onViewSecurityLogs}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              background: 'transparent',
              border: 'none',
              color: '#3B82F6',
              fontSize: '0.75rem',
              fontWeight: 600,
              cursor: 'pointer',
              padding: '4px 8px',
            }}
          >
            <span>View audit logs</span>
            <ArrowRight size={12} />
          </button>
        )}
      </div>

      {/* Top Stat Counters */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: summaryOnly ? '0' : '16px' }}>
        <div style={{ background: '#111827', padding: '12px', borderRadius: '10px', border: '1px solid #1F2937' }}>
          <div style={{ fontSize: '0.75rem', color: '#9CA3AF', marginBottom: '2px' }}>Failed Logins</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '1.25rem', fontWeight: 700, color: d.failedLoginCount > 0 ? '#F87171' : '#34D399' }}>
              {d.failedLoginCount}
            </span>
            <span style={{ fontSize: '0.7rem', color: d.failedLoginTrend <= 0 ? '#34D399' : '#F87171', fontWeight: 600 }}>
              {d.failedLoginTrend <= 0 ? '↓' : '↑'} {Math.abs(d.failedLoginTrend)}%
            </span>
          </div>
        </div>

        <div style={{ background: '#111827', padding: '12px', borderRadius: '10px', border: '1px solid #1F2937' }}>
          <div style={{ fontSize: '0.75rem', color: '#9CA3AF', marginBottom: '2px' }}>Anomalous Logins</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '1.25rem', fontWeight: 700, color: d.anomalousLoginCount > 0 ? '#F59E0B' : '#34D399' }}>
              {d.anomalousLoginCount}
            </span>
            <span style={{ fontSize: '0.7rem', color: '#9CA3AF', fontWeight: 600 }}>
              {d.anomalousLoginTrend === 0 ? '0%' : `${d.anomalousLoginTrend > 0 ? '↑' : '↓'} ${Math.abs(d.anomalousLoginTrend)}%`}
            </span>
          </div>
        </div>
      </div>

      {/* Recent Flagged Events (Only shown when not summaryOnly) */}
      {!summaryOnly && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <h4 style={{ margin: '0 0 10px 0', fontSize: '0.8rem', fontWeight: 600, color: '#D1D5DB' }}>
            Recent Flagged Events
          </h4>

          {d.recentFlaggedEvents.length === 0 ? (
            <EmptyState
              icon={ShieldCheck}
              title="All Systems Secure"
              message="No security anomalies or failed login attempts recorded."
            />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '200px', overflowY: 'auto' }}>
              {d.recentFlaggedEvents.map((evt) => (
                <div
                  key={evt.id}
                  style={{
                    background: '#111827',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: `1px solid ${evt.severity === 'critical' ? 'rgba(248, 113, 113, 0.3)' : 'rgba(245, 158, 11, 0.3)'}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '10px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <AlertTriangle size={16} color={evt.severity === 'critical' ? '#F87171' : '#F59E0B'} />
                    <div>
                      <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#F9FAFB' }}>
                        {evt.reason}
                      </div>
                      <div style={{ fontSize: '0.7rem', color: '#9CA3AF' }}>
                        {evt.location} • <code style={{ color: '#60A5FA' }}>{evt.ipAddress}</code>
                      </div>
                    </div>
                  </div>

                  <div style={{ fontSize: '0.7rem', color: '#9CA3AF', textAlign: 'right', whiteSpace: 'nowrap' }}>
                    {new Date(evt.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

