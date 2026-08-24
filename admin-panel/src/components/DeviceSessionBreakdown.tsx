import React from 'react';
import { Laptop, Smartphone, UserCheck, UserPlus } from 'lucide-react';
import type { DeviceSessionBreakdownData } from '../types/admin';
import { EmptyState } from './EmptyState';

interface DeviceSessionBreakdownProps {
  data?: DeviceSessionBreakdownData;
}

export const DeviceSessionBreakdown: React.FC<DeviceSessionBreakdownProps> = ({ data }) => {
  if (!data) {
    return (
      <div className="glass-card" style={{ padding: '18px 22px', height: '100%', minHeight: 0, boxSizing: 'border-box', flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
          <Laptop size={17} color="#8B5CF6" />
          <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-main)' }}>
            Device &amp; Session Breakdown
          </h3>
        </div>
        <EmptyState
          title="No Platform Data"
          message="No invoice or user activity recorded in this time window."
        />
      </div>
    );
  }

  const d = data;

  return (
    <div 
      className="glass-card" 
      style={{ 
        padding: '18px 22px', 
        display: 'flex', 
        flexDirection: 'column', 
        justifyContent: 'space-between', 
        height: '100%', 
        minHeight: 0,
        boxSizing: 'border-box',
        flex: 1,
      }}
    >
      <div style={{ flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Laptop size={17} color="#8B5CF6" />
          <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-main)' }}>
            Device &amp; Session Breakdown
          </h3>
        </div>
        <p style={{ margin: '3px 0 0 0', fontSize: '0.74rem', color: 'var(--text-muted)' }}>
          Platform hardware distribution &amp; user return rate.
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', flex: 1, justifyContent: 'space-around', margin: '6px 0' }}>
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <h4 style={{ margin: 0, fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-main)' }}>
              Invoices by Platform Channel
            </h4>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
              {d.totalInvoices !== undefined ? `${d.totalInvoices} total` : ''}
            </span>
          </div>
          <div style={{ display: 'flex', gap: '4px', marginBottom: '10px', height: '8px', borderRadius: '4px', overflow: 'hidden', background: 'var(--border-color)' }}>
            {d.desktopPercent > 0 && <div style={{ width: `${d.desktopPercent}%`, background: '#3B82F6', borderRadius: '2px', transition: 'width 0.3s ease' }} title={`Web: ${d.desktopPercent}%`} />}
            {d.mobilePercent > 0 && <div style={{ width: `${d.mobilePercent}%`, background: '#10B981', borderRadius: '2px', transition: 'width 0.3s ease' }} title={`Mobile: ${d.mobilePercent}%`} />}
            {d.tabletPercent > 0 && <div style={{ width: `${d.tabletPercent}%`, background: '#F59E0B', borderRadius: '2px', transition: 'width 0.3s ease' }} title={`Tablet: ${d.tabletPercent}%`} />}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
            <div style={{ background: 'var(--bg-card-hover)', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                <Laptop size={14} color="#3B82F6" /> Web (Browser POS)
              </div>
              <div style={{ fontWeight: 700, color: 'var(--text-main)', fontSize: '1.05rem', display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                {d.desktopPercent}% <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 500 }}>({d.desktopCount} invoices)</span>
              </div>
            </div>

            <div style={{ background: 'var(--bg-card-hover)', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                <Smartphone size={14} color="#10B981" /> Mobile App
              </div>
              <div style={{ fontWeight: 700, color: 'var(--text-main)', fontSize: '1.05rem', display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                {d.mobilePercent}% <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 500 }}>({d.mobileCount} invoices)</span>
              </div>
            </div>
          </div>
        </div>

        <div>
          <h4 style={{ margin: '0 0 8px 0', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-main)' }}>
            User Retention &amp; Acquisition
          </h4>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div style={{ background: 'var(--bg-card-hover)', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: '30px', height: '30px', borderRadius: '8px', background: 'rgba(59, 130, 246, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <UserPlus size={15} color="#3B82F6" />
              </div>
              <div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>New Users</div>
                <div style={{ fontSize: '0.92rem', fontWeight: 700, color: 'var(--text-main)' }}>
                  {d.newUsersPercent}% <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 400 }}>({d.newUsersCount})</span>
                </div>
              </div>
            </div>

            <div style={{ background: 'var(--bg-card-hover)', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: '30px', height: '30px', borderRadius: '8px', background: 'rgba(139, 92, 246, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <UserCheck size={15} color="#8B5CF6" />
              </div>
              <div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Returning Users</div>
                <div style={{ fontSize: '0.92rem', fontWeight: 700, color: 'var(--text-main)' }}>
                  {d.returningUsersPercent}% <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 400 }}>({d.returningUsersCount})</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
