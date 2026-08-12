import React, { useState } from 'react';
import { Globe, MapPin, Radio, Search, Users, Building, ShieldCheck } from 'lucide-react';
import type { LocationMetric } from '../types/admin';
import { EmptyState } from './EmptyState';

interface LocationDistributionProps {
  locations?: LocationMetric[];
  showProtocol?: boolean;
}

export const LocationDistribution: React.FC<LocationDistributionProps> = ({ locations = [] }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [viewTab, setViewTab] = useState<'all' | 'city' | 'state' | 'country' | 'active'>('all');

  const totalRegisteredUsers = locations.reduce((sum, l) => sum + l.userCount, 0);
  const totalActiveUsers = locations.reduce((sum, l) => sum + l.activeSessions, 0);

  // Filtered & grouped locations based on viewTab & search
  const filteredLocations = locations.filter((loc) => {
    const term = searchTerm.toLowerCase().trim();
    const matchesSearch =
      !term ||
      loc.city.toLowerCase().includes(term) ||
      (loc.state || '').toLowerCase().includes(term) ||
      loc.country.toLowerCase().includes(term) ||
      loc.countryCode.toLowerCase().includes(term);

    if (viewTab === 'active') {
      return matchesSearch && loc.activeSessions > 0;
    }
    return matchesSearch;
  });

  return (
    <div className="glass-card" style={{ padding: '24px', marginBottom: '24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px', marginBottom: '20px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Globe size={20} color="#06B6D4" />
            <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#F9FAFB' }}>
              Geolocation & IP Regional Telemetry
            </h2>
          </div>
          <p style={{ margin: '4px 0 0 0', fontSize: '0.8rem', color: '#9CA3AF' }}>
            City-wise, State-wise, and Country-wise analysis of registered merchants & currently active users.
          </p>
        </div>

        {/* Top Summary Stats Badges */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <div style={{ background: '#111827', padding: '6px 12px', borderRadius: '8px', border: '1px solid #1F2937', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: '#9CA3AF' }}>
            <Users size={14} color="#60A5FA" />
            <span>Total Registered Users: <strong style={{ color: '#F9FAFB' }}>{totalRegisteredUsers}</strong></span>
          </div>

          <div style={{ background: 'rgba(16, 185, 129, 0.1)', padding: '6px 12px', borderRadius: '8px', border: '1px solid rgba(16, 185, 129, 0.3)', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: '#34D399', fontWeight: 600 }}>
            <span className="pulse-dot" style={{ width: '6px', height: '6px' }}></span>
            <span>Currently Active Now: <strong style={{ color: '#34D399' }}>{totalActiveUsers} Users</strong></span>
          </div>
        </div>
      </div>

      {/* Toolbar & Filter Options */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
        {/* View Grouping Tabs */}
        <div style={{ display: 'flex', alignItems: 'center', background: '#111827', padding: '3px', borderRadius: '8px', border: '1px solid #374151' }}>
          <button
            onClick={() => setViewTab('all')}
            style={{
              padding: '5px 12px',
              borderRadius: '6px',
              border: 'none',
              background: viewTab === 'all' ? '#06B6D4' : 'transparent',
              color: viewTab === 'all' ? '#FFFFFF' : '#9CA3AF',
              fontSize: '0.75rem',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            All Locations
          </button>

          <button
            onClick={() => setViewTab('city')}
            style={{
              padding: '5px 12px',
              borderRadius: '6px',
              border: 'none',
              background: viewTab === 'city' ? '#06B6D4' : 'transparent',
              color: viewTab === 'city' ? '#FFFFFF' : '#9CA3AF',
              fontSize: '0.75rem',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            City-Wise
          </button>

          <button
            onClick={() => setViewTab('state')}
            style={{
              padding: '5px 12px',
              borderRadius: '6px',
              border: 'none',
              background: viewTab === 'state' ? '#06B6D4' : 'transparent',
              color: viewTab === 'state' ? '#FFFFFF' : '#9CA3AF',
              fontSize: '0.75rem',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            State-Wise
          </button>

          <button
            onClick={() => setViewTab('country')}
            style={{
              padding: '5px 12px',
              borderRadius: '6px',
              border: 'none',
              background: viewTab === 'country' ? '#06B6D4' : 'transparent',
              color: viewTab === 'country' ? '#FFFFFF' : '#9CA3AF',
              fontSize: '0.75rem',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            Country-Wise
          </button>

          <button
            onClick={() => setViewTab('active')}
            style={{
              padding: '5px 12px',
              borderRadius: '6px',
              border: 'none',
              background: viewTab === 'active' ? '#10B981' : 'transparent',
              color: viewTab === 'active' ? '#FFFFFF' : '#9CA3AF',
              fontSize: '0.75rem',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            Active Users Only ({totalActiveUsers})
          </button>
        </div>

        {/* Search Input */}
        <div style={{ position: 'relative', width: '240px', maxWidth: '100%' }}>
          <Search size={16} color="#9CA3AF" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
          <input
            type="text"
            placeholder="Search city, state, country..."
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
      </div>

      {/* Regional Column Table */}
      {filteredLocations.length === 0 ? (
        <EmptyState
          icon={Globe}
          title="No Location Telemetry"
          message="No regional location records match your search or view filter."
        />
      ) : (
        <div style={{ width: '100%' }}>
          <table className="custom-table" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th>Country / Region</th>
                <th>State / Province</th>
                <th>City Location</th>
                <th>Registered Users</th>
                <th>Currently Active Users</th>
                <th>Traffic Share</th>
              </tr>
            </thead>
            <tbody>
              {filteredLocations.map((loc, idx) => (
                <tr key={idx}>
                  <td>
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
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          color: '#60A5FA',
                        }}
                      >
                        {loc.countryCode}
                      </div>
                      <span style={{ fontWeight: 600, color: '#F9FAFB' }}>{loc.country}</span>
                    </div>
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', color: '#E5E7EB' }}>
                      <Building size={14} color="#8B5CF6" />
                      <span>{loc.state || 'Primary Region'}</span>
                    </div>
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', color: '#F9FAFB', fontWeight: 600 }}>
                      <MapPin size={14} color="#EF4444" />
                      <span>{loc.city}</span>
                    </div>
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#E5E7EB' }}>
                      <Users size={14} color="#60A5FA" />
                      <span><strong style={{ color: '#F9FAFB' }}>{loc.userCount}</strong> Registered Users</span>
                    </div>
                  </td>
                  <td>
                    {loc.activeSessions > 0 ? (
                      <span className="badge badge-active">
                        <span className="pulse-dot" style={{ width: '6px', height: '6px' }}></span> {loc.activeSessions} Active Now
                      </span>
                    ) : (
                      <span style={{ fontSize: '0.75rem', color: '#9CA3AF' }}>
                        0 Active
                      </span>
                    )}
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: '140px' }}>
                      <div style={{ flex: 1, height: '8px', background: '#1F2937', borderRadius: '4px', overflow: 'hidden' }}>
                        <div style={{ width: `${loc.percentageShare}%`, height: '100%', background: 'linear-gradient(90deg, #06B6D4 0%, #3B82F6 100%)', borderRadius: '4px' }} />
                      </div>
                      <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#D1D5DB', minWidth: '36px', textAlign: 'right' }}>
                        {loc.percentageShare}%
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
