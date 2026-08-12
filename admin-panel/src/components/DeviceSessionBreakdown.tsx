import React from 'react';
import { Laptop, Smartphone, Tablet, UserCheck, UserPlus } from 'lucide-react';
import type { DeviceSessionBreakdownData } from '../types/admin';

interface DeviceSessionBreakdownProps {
  data?: DeviceSessionBreakdownData;
}

export const DeviceSessionBreakdown: React.FC<DeviceSessionBreakdownProps> = ({ data }) => {
  const defaultData: DeviceSessionBreakdownData = {
    desktopCount: 3,
    desktopPercent: 75,
    mobileCount: 1,
    mobilePercent: 25,
    tabletCount: 0,
    tabletPercent: 0,
    newUsersCount: 1,
    newUsersPercent: 25,
    returningUsersCount: 3,
    returningUsersPercent: 75,
  };

  const d = data || defaultData;

  return (
    <div className="glass-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Laptop size={18} color="#8B5CF6" />
          <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--text-main)' }}>
            Device &amp; Session Breakdown
          </h2>
        </div>
        <p style={{ margin: '2px 0 0 0', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          Platform hardware distribution &amp; user return rate.
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {/* Device Types */}
        <div>
          <h4 style={{ margin: '0 0 10px 0', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)' }}>
            Device Types
          </h4>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '8px', height: '8px', borderRadius: '4px', overflow: 'hidden', background: 'var(--border-color)' }}>
            {d.desktopPercent > 0 && <div style={{ width: `${d.desktopPercent}%`, background: '#3B82F6', borderRadius: '2px' }} />}
            {d.mobilePercent > 0 && <div style={{ width: `${d.mobilePercent}%`, background: '#10B981', borderRadius: '2px' }} />}
            {d.tabletPercent > 0 && <div style={{ width: `${d.tabletPercent}%`, background: '#F59E0B', borderRadius: '2px' }} />}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginTop: '12px' }}>
            <div style={{ background: 'var(--bg-card-hover)', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                <Laptop size={14} color="#3B82F6" /> Desktop
              </div>
              <div style={{ fontWeight: 700, color: 'var(--text-main)', fontSize: '1rem' }}>
                {d.desktopPercent}% <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 400 }}>({d.desktopCount})</span>
              </div>
            </div>

            <div style={{ background: 'var(--bg-card-hover)', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                <Smartphone size={14} color="#10B981" /> Mobile
              </div>
              <div style={{ fontWeight: 700, color: 'var(--text-main)', fontSize: '1rem' }}>
                {d.mobilePercent}% <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 400 }}>({d.mobileCount})</span>
              </div>
            </div>

            <div style={{ background: 'var(--bg-card-hover)', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                <Tablet size={14} color="#F59E0B" /> Tablet
              </div>
              <div style={{ fontWeight: 700, color: 'var(--text-main)', fontSize: '1rem' }}>
                {d.tabletPercent}% <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 400 }}>({d.tabletCount})</span>
              </div>
            </div>
          </div>
        </div>

        {/* User Retention & Acquisition Split */}
        <div>
          <h4 style={{ margin: '0 0 10px 0', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)' }}>
            User Retention &amp; Acquisition
          </h4>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div style={{ background: 'var(--bg-card-hover)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(59, 130, 246, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <UserPlus size={16} color="#3B82F6" />
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>New Users</div>
                <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-main)' }}>
                  {d.newUsersPercent}% <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 400 }}>({d.newUsersCount})</span>
                </div>
              </div>
            </div>

            <div style={{ background: 'var(--bg-card-hover)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(139, 92, 246, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <UserCheck size={16} color="#8B5CF6" />
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Returning Users</div>
                <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-main)' }}>
                  {d.returningUsersPercent}% <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 400 }}>({d.returningUsersCount})</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
