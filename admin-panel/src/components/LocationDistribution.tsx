import React from 'react';
import { Globe, MapPin, Radio } from 'lucide-react';
import type { LocationMetric } from '../types/admin';
import { EmptyState } from './EmptyState';

interface LocationDistributionProps {
  locations?: LocationMetric[];
  showProtocol?: boolean;
}

export const LocationDistribution: React.FC<LocationDistributionProps> = ({ locations = [] }) => {
  return (
    <div className="glass-card" style={{ padding: '24px', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Globe size={20} color="#06B6D4" />
            <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#F9FAFB' }}>
              User Geolocation & IP Regional Traffic
            </h2>
          </div>
          <p style={{ margin: '4px 0 0 0', fontSize: '0.8rem', color: '#9CA3AF' }}>
            Regional distribution of user login traffic and active sessions.
          </p>
        </div>
      </div>

      {locations.length === 0 ? (
        <EmptyState
          icon={Globe}
          title="No Regional Telemetry"
          message="No active location logs available for the selected timeframe."
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', flex: 1, justifyContent: 'flex-start' }}>
          {locations.map((loc, idx) => (
            <div
              key={idx}
              style={{
                background: '#111827',
                padding: '12px 14px',
                borderRadius: '10px',
                border: '1px solid #1F2937',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '12px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div
                  style={{
                    width: '32px',
                    height: '24px',
                    borderRadius: '4px',
                    background: '#1F2937',
                    border: '1px solid #374151',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    color: '#60A5FA',
                  }}
                >
                  {loc.countryCode || 'IN'}
                </div>
                <div>
                  <div style={{ fontWeight: 600, color: '#F9FAFB', fontSize: '0.85rem' }}>
                    {loc.city}, {loc.country}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: '#9CA3AF' }}>
                    <MapPin size={12} color="#EF4444" />
                    <span>{loc.userCount} Registered Users</span>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: '#34D399', fontWeight: 600 }}>
                  <Radio size={12} className="pulse-dot" />
                  <span>{loc.activeSessions} active</span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: '90px' }}>
                  <div style={{ flex: 1, height: '6px', background: '#1F2937', borderRadius: '3px', overflow: 'hidden' }}>
                    <div style={{ width: `${loc.percentageShare}%`, height: '100%', background: '#06B6D4', borderRadius: '3px' }} />
                  </div>
                  <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#9CA3AF', minWidth: '32px', textAlign: 'right' }}>
                    {loc.percentageShare}%
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
