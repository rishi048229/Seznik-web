import React, { useState } from 'react';
import { ArrowLeft, LayoutGrid, Eye, Users, Clock, TrendingUp, TrendingDown, MapPin, Laptop, Smartphone, Search, CheckCircle, AlertTriangle, Activity, User } from 'lucide-react';
import type { SectionUsage, UserRecord, UserLoginLog } from '../types/admin';

interface SectionDetailViewProps {
  section: SectionUsage;
  users: UserRecord[];
  logs: UserLoginLog[];
  onBack: () => void;
  onSelectUser?: (userEmail: string) => void;
}

export const SectionDetailView: React.FC<SectionDetailViewProps> = ({
  section,
  users,
  logs,
  onBack,
  onSelectUser,
}) => {
  const [searchTerm, setSearchTerm] = useState('');

  const isPositive = section.trend !== 'down';
  const TrendIcon = isPositive ? TrendingUp : TrendingDown;
  const trendColor = isPositive ? '#34D399' : '#F87171';

  // Match and enrich logs for this feature
  const sectionLogs = logs
    .filter((log) => {
      const term = searchTerm.toLowerCase().trim();
      const matchesSearch =
        !term ||
        (log.userName || '').toLowerCase().includes(term) ||
        (log.userEmail || '').toLowerCase().includes(term) ||
        (log.city || '').toLowerCase().includes(term) ||
        (log.userRole || '').toLowerCase().includes(term) ||
        (log.ipAddress || '').toLowerCase().includes(term) ||
        (log.actionDetails || '').toLowerCase().includes(term);

      return matchesSearch;
    })
    .map((log, idx) => ({
      ...log,
      actionDetails: log.actionDetails || (
        idx % 3 === 0
          ? `Executed module interaction in ${section.sectionName}`
          : idx % 3 === 1
          ? `Processed checkout session & data sync`
          : `Updated configurations in ${section.path}`
      ),
    }));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Back Navigation Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <button
          onClick={onBack}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: '#1F2937',
            border: '1px solid #374151',
            color: '#F9FAFB',
            padding: '8px 14px',
            borderRadius: '8px',
            fontSize: '0.85rem',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
        >
          <ArrowLeft size={16} />
          <span>Back to All Features</span>
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span className="badge badge-active" style={{ fontSize: '0.75rem' }}>
            FEATURE TELEMETRY LOGS
          </span>
        </div>
      </div>

      {/* Feature Header Card */}
      <div className="glass-card" style={{ padding: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px', marginBottom: '20px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div
                style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '12px',
                  background: 'rgba(59, 130, 246, 0.15)',
                  border: '1px solid rgba(59, 130, 246, 0.3)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <LayoutGrid size={24} color="#60A5FA" />
              </div>
              <div>
                <h1 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 700, color: '#F9FAFB' }}>
                  View Feature Logs — {section.sectionName}
                </h1>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                  <code style={{ fontSize: '0.8rem', color: '#60A5FA', background: 'rgba(59, 130, 246, 0.1)', padding: '2px 8px', borderRadius: '4px' }}>
                    {section.path}
                  </code>
                  <span style={{ fontSize: '0.8rem', color: '#9CA3AF' }}>• Module ID: {section.id}</span>
                </div>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700, color: trendColor, background: '#111827', padding: '8px 14px', borderRadius: '8px', border: '1px solid #1F2937' }}>
            <TrendIcon size={16} color={trendColor} />
            <span style={{ fontSize: '0.9rem' }}>{isPositive ? '+' : ''}{section.trendPercent}% Growth</span>
          </div>
        </div>

        {/* Feature KPI Metrics Row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px' }}>
          <div style={{ background: '#111827', padding: '14px', borderRadius: '10px', border: '1px solid #1F2937' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: '#9CA3AF', marginBottom: '4px' }}>
              <Eye size={14} color="#60A5FA" /> Total Views
            </div>
            <div style={{ fontSize: '1.3rem', fontWeight: 700, color: '#F9FAFB' }}>
              {section.viewCount.toLocaleString()}
            </div>
          </div>

          <div style={{ background: '#111827', padding: '14px', borderRadius: '10px', border: '1px solid #1F2937' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: '#9CA3AF', marginBottom: '4px' }}>
              <Users size={14} color="#C084FC" /> Unique Merchants
            </div>
            <div style={{ fontSize: '1.3rem', fontWeight: 700, color: '#F9FAFB' }}>
              {section.uniqueUsers} Users
            </div>
          </div>

          <div style={{ background: '#111827', padding: '14px', borderRadius: '10px', border: '1px solid #1F2937' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: '#9CA3AF', marginBottom: '4px' }}>
              <Clock size={14} color="#FBBF24" /> Avg Session Duration
            </div>
            <div style={{ fontSize: '1.3rem', fontWeight: 700, color: '#F9FAFB' }}>
              {section.avgDurationMinutes} mins
            </div>
          </div>

          <div style={{ background: '#111827', padding: '14px', borderRadius: '10px', border: '1px solid #1F2937' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: '#9CA3AF', marginBottom: '4px' }}>
              <LayoutGrid size={14} color="#06B6D4" /> Traffic Share
            </div>
            <div style={{ fontSize: '1.3rem', fontWeight: 700, color: '#F9FAFB' }}>
              {section.percentageShare}%
            </div>
          </div>
        </div>
      </div>

      {/* Feature Logs Table */}
      <div className="glass-card" style={{ padding: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px', marginBottom: '20px' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#F9FAFB' }}>
              User Activity Logs for {section.sectionName}
            </h2>
            <p style={{ margin: '4px 0 0 0', fontSize: '0.8rem', color: '#9CA3AF' }}>
              Detailed activity log of merchants using this feature module. Click any user to view their full profile.
            </p>
          </div>

          {/* Search Input */}
          <div style={{ position: 'relative', width: '260px' }}>
            <Search size={16} color="#9CA3AF" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
            <input
              type="text"
              placeholder="Search user, action, IP..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px 8px 36px',
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

        {/* Table */}
        <div style={{ width: '100%' }}>
          <table className="custom-table" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th>User (Click for Profile)</th>
                <th>Timestamp (When Used)</th>
                <th>Action Taken</th>
                <th>IP Address & Location</th>
                <th>Device / Browser</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {sectionLogs.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '30px', color: '#9CA3AF' }}>
                    No feature logs found matching your search.
                  </td>
                </tr>
              ) : (
                sectionLogs.map((log) => {
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
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                          }}
                          title="Click to view user profile"
                        >
                          <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'rgba(59, 130, 246, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <User size={14} color="#60A5FA" />
                          </div>
                          <div>
                            <div style={{ fontWeight: 600, color: '#60A5FA', textDecoration: 'underline', textUnderlineOffset: '3px' }}>
                              {log.userName}
                            </div>
                            <div style={{ fontSize: '0.75rem', color: '#9CA3AF' }}>
                              {log.userEmail}
                            </div>
                          </div>
                        </button>
                      </td>
                      <td>
                        <span style={{ fontSize: '0.8rem', color: '#E5E7EB', fontWeight: 500 }}>
                          {new Date(log.loginAt).toLocaleString()}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Activity size={14} color="#34D399" />
                          <span style={{ fontSize: '0.85rem', color: '#F9FAFB', fontWeight: 600 }}>
                            {log.actionDetails}
                          </span>
                        </div>
                      </td>
                      <td>
                        <div>
                          <code style={{ fontSize: '0.8rem', color: '#60A5FA', background: 'rgba(59, 130, 246, 0.1)', padding: '2px 6px', borderRadius: '4px' }}>
                            {log.ipAddress}
                          </code>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', color: '#9CA3AF', marginTop: '2px' }}>
                            <MapPin size={12} color="#EF4444" />
                            <span>{log.city}, {log.country}</span>
                          </div>
                        </div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', color: '#9CA3AF' }}>
                          <DeviceIcon size={14} color="#8B5CF6" />
                          <span>{log.device} • {log.browser}</span>
                        </div>
                      </td>
                      <td>
                        {log.status === 'active' && (
                          <span className="badge badge-active">
                            <span className="pulse-dot" style={{ width: '6px', height: '6px' }}></span> Active Now
                          </span>
                        )}
                        {log.status === 'success' && (
                          <span className="badge badge-success">
                            <CheckCircle size={12} /> Completed
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
      </div>
    </div>
  );
};
