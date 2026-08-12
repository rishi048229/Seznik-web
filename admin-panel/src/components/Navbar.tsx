import React from 'react';
import { 
  Activity, 
  Users, 
  Globe, 
  LayoutGrid, 
  ShieldAlert, 
  RefreshCw, 
  Clock, 
  UserCheck, 
  Sparkles 
} from 'lucide-react';

interface NavbarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  timeRange: string;
  setTimeRange: (range: string) => void;
  lastRefreshedAt: string;
  onRefresh: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  timeRange,
  setTimeRange,
  lastRefreshedAt,
  onRefresh,
}) => {
  const tabs = [
    { id: 'overview', label: 'Overview & Metrics', icon: Activity },
    { id: 'logins', label: 'User Logs & Activity', icon: ShieldAlert },
    { id: 'sections', label: 'Section Analytics', icon: LayoutGrid },
    { id: 'locations', label: 'Geolocation & IP', icon: Globe },
    { id: 'users', label: 'Registered Users', icon: Users },
  ];

  return (
    <header style={{ background: '#111827', borderBottom: '1px solid #1F2937' }} className="sticky top-0 z-50">
      {/* Top Bar */}
      <div style={{ padding: '16px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px', width: '100%', boxSizing: 'border-box' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ 
            width: '40px', 
            height: '40px', 
            borderRadius: '12px', 
            background: 'linear-gradient(135deg, #3B82F6 0%, #8B5CF6 100%)', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            boxShadow: '0 4px 15px rgba(59, 130, 246, 0.4)'
          }}>
            <Sparkles size={22} color="#FFFFFF" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h1 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: '#F9FAFB' }}>
                Seznik Admin Panel
              </h1>
              <span className="badge badge-active" style={{ fontSize: '0.7rem' }}>
                <span className="pulse-dot"></span> LIVE TELEMETRY
              </span>
            </div>
            <p style={{ margin: 0, fontSize: '0.75rem', color: '#9CA3AF' }}>
              User Login Tracking • Section Heatmap • Geolocation Analytics
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          {/* Time Range Selector */}
          <div style={{ display: 'flex', alignItems: 'center', background: '#1F2937', borderRadius: '8px', padding: '3px' }}>
            {['24h', '7d', '30d', 'All'].map((range) => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                style={{
                  padding: '6px 12px',
                  borderRadius: '6px',
                  border: 'none',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  background: timeRange === range ? '#3B82F6' : 'transparent',
                  color: timeRange === range ? '#FFFFFF' : '#9CA3AF',
                  transition: 'all 0.15s ease'
                }}
              >
                {range}
              </button>
            ))}
          </div>

          {/* Refresh Button */}
          <button
            onClick={onRefresh}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              borderRadius: '8px',
              border: '1px solid #374151',
              background: '#1F2937',
              color: '#E5E7EB',
              fontSize: '0.75rem',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            <RefreshCw size={14} />
            <span>Refresh</span>
          </button>

          {/* Last refreshed time */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', color: '#6B7280' }}>
            <Clock size={12} />
            <span>Updated: {lastRefreshedAt}</span>
          </div>

          {/* Admin Avatar */}
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '8px', 
            padding: '6px 12px', 
            background: 'rgba(59, 130, 246, 0.1)', 
            border: '1px solid rgba(59, 130, 246, 0.2)', 
            borderRadius: '9999px' 
          }}>
            <UserCheck size={16} color="#60A5FA" />
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#60A5FA' }}>Admin Root</span>
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div style={{ display: 'flex', padding: '0 32px', gap: '8px', overflowX: 'auto', borderTop: '1px solid rgba(255,255,255,0.05)', width: '100%', boxSizing: 'border-box' }}>
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isSelected = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '12px 16px',
                border: 'none',
                background: 'transparent',
                color: isSelected ? '#3B82F6' : '#9CA3AF',
                borderBottom: isSelected ? '2px solid #3B82F6' : '2px solid transparent',
                fontSize: '0.875rem',
                fontWeight: isSelected ? 600 : 500,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 0.15s ease'
              }}
            >
              <Icon size={16} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>
    </header>
  );
};
