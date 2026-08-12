import React from 'react';
import { Globe, MapPin, Radio, ShieldCheck } from 'lucide-react';
import type { LocationMetric } from '../types/admin';

interface LocationDistributionProps {
  locations: LocationMetric[];
  showProtocol?: boolean;
}

export const LocationDistribution: React.FC<LocationDistributionProps> = ({ locations, showProtocol = true }) => {
  return (
    <div style={{ 
      display: 'grid', 
      gridTemplateColumns: showProtocol ? 'repeat(auto-fit, minmax(320px, 1fr))' : '1fr', 
      gap: '20px', 
      marginBottom: '24px' 
    }}>
      {/* City & Country Geolocation Table */}
      <div className="glass-card" style={{ padding: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Globe size={20} color="#06B6D4" />
              <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#F9FAFB' }}>
                User Geolocation & IP Regional Traffic
              </h2>
            </div>
            <p style={{ margin: '4px 0 0 0', fontSize: '0.8rem', color: '#9CA3AF' }}>
              Cities and countries from where users are logging in and accessing the system.
            </p>
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table className="custom-table">
            <thead>
              <tr>
                <th>Country / Flag</th>
                <th>City</th>
                <th>Users Count</th>
                <th>Active Sessions</th>
                <th>Share</th>
              </tr>
            </thead>
            <tbody>
              {locations.map((loc, i) => (
                <tr key={i}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600 }}>
                      <span style={{ fontSize: '1.25rem' }}>{loc.flagEmoji}</span>
                      <span>{loc.country}</span>
                    </div>
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#60A5FA' }}>
                      <MapPin size={14} />
                      <span>{loc.city}</span>
                    </div>
                  </td>
                  <td>
                    <span style={{ fontWeight: 700, color: '#F9FAFB' }}>{loc.userCount}</span>
                  </td>
                  <td>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#34D399', fontSize: '0.8rem' }}>
                      <Radio size={12} className="pulse-dot" /> {loc.activeSessions} online
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ width: '60px', height: '6px', background: '#1F2937', borderRadius: '3px', overflow: 'hidden' }}>
                        <div style={{ width: `${loc.percentageShare}%`, height: '100%', background: '#06B6D4' }} />
                      </div>
                      <span style={{ fontSize: '0.8rem', color: '#9CA3AF' }}>{loc.percentageShare}%</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Geolocation Protection & IP Security Info */}
      {showProtocol && (
        <div className="glass-card" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <ShieldCheck size={20} color="#10B981" />
            <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#F9FAFB' }}>
              IP Geo-Lookup & Privacy Protocol
            </h2>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '0.85rem', color: '#D1D5DB' }}>
            <div style={{ background: '#111827', padding: '14px', borderRadius: '12px', border: '1px solid #1F2937' }}>
              <h4 style={{ margin: '0 0 4px 0', color: '#60A5FA', fontSize: '0.9rem' }}>
                📍 Real-Time GeoIP Resolution
              </h4>
              <p style={{ margin: 0, fontSize: '0.8rem', color: '#9CA3AF' }}>
                Every login request extracts HTTP headers (`x-forwarded-for`, `cf-connecting-ip`) to query city and country coordinates without storing raw PII.
              </p>
            </div>

            <div style={{ background: '#111827', padding: '14px', borderRadius: '12px', border: '1px solid #1F2937' }}>
              <h4 style={{ margin: '0 0 4px 0', color: '#34D399', fontSize: '0.9rem' }}>
                🛡️ Anomaly & Suspicious Login Shield
              </h4>
              <p style={{ margin: 0, fontSize: '0.8rem', color: '#9CA3AF' }}>
                Logins originating from unexpected international countries trigger a warning badge on the admin audit log automatically.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
