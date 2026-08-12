import React, { useState, useMemo } from 'react';
import { Globe, MapPin, Search, Users, Building, Flag, Radio } from 'lucide-react';
import type { LocationMetric } from '../types/admin';
import { EmptyState } from './EmptyState';

interface LocationDistributionProps {
  locations?: LocationMetric[];
  showProtocol?: boolean;
}

export const LocationDistribution: React.FC<LocationDistributionProps> = ({ locations = [] }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [viewTab, setViewTab] = useState<'all' | 'state' | 'city' | 'active'>('all');

  const totalRegisteredUsers = locations.reduce((sum, l) => sum + l.userCount, 0);
  const totalActiveUsers = locations.reduce((sum, l) => sum + l.activeSessions, 0);

  // Aggregated State-Wise Demography (India)
  const stateDemographics = useMemo(() => {
    const map = new Map<string, { state: string; cities: Set<string>; userCount: number; activeSessions: number; percentageShare: number }>();
    locations.forEach((loc) => {
      const stateKey = loc.state || 'Primary Region';
      if (!map.has(stateKey)) {
        map.set(stateKey, {
          state: stateKey,
          cities: new Set([loc.city]),
          userCount: loc.userCount,
          activeSessions: loc.activeSessions,
          percentageShare: loc.percentageShare,
        });
      } else {
        const item = map.get(stateKey)!;
        item.cities.add(loc.city);
        item.userCount += loc.userCount;
        item.activeSessions += loc.activeSessions;
        item.percentageShare += loc.percentageShare;
      }
    });

    return Array.from(map.values()).map(item => ({
      ...item,
      citiesList: Array.from(item.cities).join(', ')
    }));
  }, [locations]);

  // Aggregated City-Wise Demography
  const cityDemographics = useMemo(() => {
    return [...locations].sort((a, b) => b.userCount - a.userCount);
  }, [locations]);

  // Filtered rows for State-Wise
  const filteredStateRows = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();
    return stateDemographics.filter(row =>
      !term ||
      row.state.toLowerCase().includes(term) ||
      row.citiesList.toLowerCase().includes(term)
    );
  }, [stateDemographics, searchTerm]);

  // Filtered rows for City-Wise / All / Active
  const filteredCityRows = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();
    return locations.filter((loc) => {
      const matchesSearch =
        !term ||
        loc.city.toLowerCase().includes(term) ||
        (loc.state || '').toLowerCase().includes(term) ||
        loc.country.toLowerCase().includes(term);

      if (viewTab === 'active') {
        return matchesSearch && loc.activeSessions > 0;
      }
      return matchesSearch;
    });
  }, [locations, searchTerm, viewTab]);

  return (
    <div className="glass-card" style={{ padding: '24px', minHeight: 'calc(100vh - 270px)', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px', marginBottom: '20px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Globe size={20} color="#06B6D4" />
            <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-main)' }}>
              India Geolocation & IP Telemetry Demography
            </h2>
          </div>
          <p style={{ margin: '4px 0 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            State-wise and City-wise breakdown of registered merchants & currently active users across India.
          </p>
        </div>

        {/* Top Summary Stats Badges */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <div style={{ background: 'var(--bg-card-hover)', padding: '6px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            <Users size={14} color="#2563EB" />
            <span>Total Registered Users: <strong style={{ color: 'var(--text-main)' }}>{totalRegisteredUsers}</strong></span>
          </div>

          <div style={{ background: 'rgba(16, 185, 129, 0.1)', padding: '6px 12px', borderRadius: '8px', border: '1px solid rgba(16, 185, 129, 0.3)', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: '#34D399', fontWeight: 600 }}>
            <span className="pulse-dot" style={{ width: '6px', height: '6px' }}></span>
            <span>Currently Active Now: <strong style={{ color: '#34D399' }}>{totalActiveUsers} Users</strong></span>
          </div>
        </div>
      </div>

      {/* Toolbar & View Tabs */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
        {/* View Grouping Tabs */}
        <div style={{ display: 'flex', alignItems: 'center', background: 'var(--tab-bg)', padding: '3px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
          <button
            onClick={() => setViewTab('all')}
            style={{
              padding: '5px 12px',
              borderRadius: '6px',
              border: 'none',
              background: viewTab === 'all' ? '#06B6D4' : 'transparent',
              color: viewTab === 'all' ? '#FFFFFF' : '#64748B',
              fontSize: '0.75rem',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            All Locations
          </button>

          <button
            onClick={() => setViewTab('state')}
            style={{
              padding: '5px 12px',
              borderRadius: '6px',
              border: 'none',
              background: viewTab === 'state' ? '#06B6D4' : 'transparent',
              color: viewTab === 'state' ? '#FFFFFF' : '#64748B',
              fontSize: '0.75rem',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            State-Wise Demography (India)
          </button>

          <button
            onClick={() => setViewTab('city')}
            style={{
              padding: '5px 12px',
              borderRadius: '6px',
              border: 'none',
              background: viewTab === 'city' ? '#06B6D4' : 'transparent',
              color: viewTab === 'city' ? '#FFFFFF' : '#64748B',
              fontSize: '0.75rem',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            City-Wise Breakdown
          </button>

          <button
            onClick={() => setViewTab('active')}
            style={{
              padding: '5px 12px',
              borderRadius: '6px',
              border: 'none',
              background: viewTab === 'active' ? '#10B981' : 'transparent',
              color: viewTab === 'active' ? '#FFFFFF' : '#64748B',
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
          <Search size={16} color="#64748B" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
          <input
            type="text"
            placeholder={viewTab === 'state' ? 'Search state or city...' : 'Search city or state...'}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              width: '100%',
              padding: '7px 12px 7px 36px',
              borderRadius: '8px',
              border: '1px solid var(--border-color)',
              backgroundColor: 'var(--bg-card)',
              color: 'var(--text-main)',
              fontSize: '0.8rem',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
        </div>
      </div>

      {/* DYNAMIC COLUMN TABLES BASED ON VIEW TAB */}

      {/* 1. STATE-WISE DEMOGRAPHY TABLE */}
      {viewTab === 'state' && (
        filteredStateRows.length === 0 ? (
          <EmptyState
            icon={Globe}
            title="No State Telemetry Found"
            message="No Indian states match your search query."
          />
        ) : (
          <div style={{ width: '100%', overflowY: 'auto', flex: 1, minHeight: 0 }}>
            <table className="custom-table" style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th>State / Province (India)</th>
                  <th>Cities Included</th>
                  <th>Total Registered Users</th>
                  <th>Currently Active Users</th>
                  <th>State Traffic Share %</th>
                </tr>
              </thead>
              <tbody>
                {filteredStateRows.map((row, idx) => (
                  <tr key={idx}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, color: 'var(--text-main)' }}>
                        <Building size={16} color="#8B5CF6" />
                        <span>{row.state}</span>
                      </div>
                    </td>
                    <td>
                      <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                        {row.citiesList}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-main)' }}>
                        <Users size={14} color="#2563EB" />
                        <span><strong style={{ color: 'var(--text-main)' }}>{row.userCount}</strong> Registered Users</span>
                      </div>
                    </td>
                    <td>
                      {row.activeSessions > 0 ? (
                        <span className="badge badge-active">
                          <span className="pulse-dot" style={{ width: '6px', height: '6px' }}></span> {row.activeSessions} Active Now
                        </span>
                      ) : (
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          0 Active
                        </span>
                      )}
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: '140px' }}>
                        <div style={{ flex: 1, height: '8px', background: '#E2E8F0', borderRadius: '4px', overflow: 'hidden' }}>
                          <div style={{ width: `${row.percentageShare}%`, height: '100%', background: 'linear-gradient(90deg, #8B5CF6 0%, #3B82F6 100%)', borderRadius: '4px' }} />
                        </div>
                        <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', minWidth: '36px', textAlign: 'right' }}>
                          {row.percentageShare.toFixed(1)}%
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}

      {/* 2. CITY-WISE BREAKDOWN TABLE */}
      {viewTab === 'city' && (
        filteredCityRows.length === 0 ? (
          <EmptyState
            icon={Globe}
            title="No City Telemetry Found"
            message="No cities match your search query."
          />
        ) : (
          <div style={{ width: '100%', overflowY: 'auto', flex: 1, minHeight: 0 }}>
            <table className="custom-table" style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th>City Location</th>
                  <th>State / Region (India)</th>
                  <th>Registered Users</th>
                  <th>Currently Active Users</th>
                  <th>City Traffic Share %</th>
                </tr>
              </thead>
              <tbody>
                {filteredCityRows.map((loc, idx) => (
                  <tr key={idx}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, color: 'var(--text-main)' }}>
                        <MapPin size={16} color="#EF4444" />
                        <span>{loc.city}</span>
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', color: 'var(--text-main)' }}>
                        <Building size={14} color="#8B5CF6" />
                        <span>{loc.state || 'Primary Region'}</span>
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-main)' }}>
                        <Users size={14} color="#2563EB" />
                        <span><strong style={{ color: 'var(--text-main)' }}>{loc.userCount}</strong> Registered Users</span>
                      </div>
                    </td>
                    <td>
                      {loc.activeSessions > 0 ? (
                        <span className="badge badge-active">
                          <span className="pulse-dot" style={{ width: '6px', height: '6px' }}></span> {loc.activeSessions} Active Now
                        </span>
                      ) : (
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          0 Active
                        </span>
                      )}
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: '140px' }}>
                        <div style={{ flex: 1, height: '8px', background: '#1F2937', borderRadius: '4px', overflow: 'hidden' }}>
                          <div style={{ width: `${loc.percentageShare}%`, height: '100%', background: 'linear-gradient(90deg, #06B6D4 0%, #3B82F6 100%)', borderRadius: '4px' }} />
                        </div>
                        <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', minWidth: '36px', textAlign: 'right' }}>
                          {loc.percentageShare.toFixed(1)}%
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}

      {/* 3. ALL LOCATIONS & ACTIVE USERS TABLES */}
      {(viewTab === 'all' || viewTab === 'active') && (
        filteredCityRows.length === 0 ? (
          <EmptyState
            icon={Globe}
            title="No Location Telemetry"
            message="No regional location records match your search or view filter."
          />
        ) : (
          <div style={{ width: '100%', overflowY: 'auto', flex: 1, minHeight: 0 }}>
            <table className="custom-table" style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th>City Location</th>
                  <th>State / Region (India)</th>
                  <th>Country</th>
                  <th>Registered Users</th>
                  <th>Currently Active Users</th>
                  <th>Traffic Share</th>
                </tr>
              </thead>
              <tbody>
                {filteredCityRows.map((loc, idx) => (
                  <tr key={idx}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, color: 'var(--text-main)' }}>
                        <MapPin size={16} color="#EF4444" />
                        <span>{loc.city}</span>
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', color: 'var(--text-main)' }}>
                        <Building size={14} color="#8B5CF6" />
                        <span>{loc.state || 'Primary Region'}</span>
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', color: 'var(--text-main)' }}>
                        <span>🇮🇳 {loc.country}</span>
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-main)' }}>
                        <Users size={14} color="#2563EB" />
                        <span><strong style={{ color: 'var(--text-main)' }}>{loc.userCount}</strong> Registered Users</span>
                      </div>
                    </td>
                    <td>
                      {loc.activeSessions > 0 ? (
                        <span className="badge badge-active">
                          <span className="pulse-dot" style={{ width: '6px', height: '6px' }}></span> {loc.activeSessions} Active Now
                        </span>
                      ) : (
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          0 Active
                        </span>
                      )}
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: '140px' }}>
                        <div style={{ flex: 1, height: '8px', background: '#E2E8F0', borderRadius: '4px', overflow: 'hidden' }}>
                          <div style={{ width: `${loc.percentageShare}%`, height: '100%', background: 'linear-gradient(90deg, #06B6D4 0%, #3B82F6 100%)', borderRadius: '4px' }} />
                        </div>
                        <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', minWidth: '36px', textAlign: 'right' }}>
                          {loc.percentageShare.toFixed(1)}%
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}
    </div>
  );
};
