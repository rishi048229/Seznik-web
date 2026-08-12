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
} from 'lucide-react';
import { AnimatedThemeToggler } from './AnimatedThemeToggler';

interface NavbarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  timeRange: string;
  setTimeRange: (range: string) => void;
  lastRefreshedAt: string;
  onRefresh: () => void;
  autoRefreshInterval: number;
  setAutoRefreshInterval: (interval: number) => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  timeRange,
  setTimeRange,
  lastRefreshedAt,
  onRefresh,
  autoRefreshInterval,
  setAutoRefreshInterval,
}) => {
  const tabs = [
    { id: 'overview', label: 'Overview & Metrics', icon: Activity },
    { id: 'logins', label: 'User Logs & Activity', icon: ShieldAlert },
    { id: 'sections', label: 'Section Analytics', icon: LayoutGrid },
    { id: 'locations', label: 'Geolocation & IP', icon: Globe },
    { id: 'users', label: 'Registered Users', icon: Users },
  ];

  return (
    <header style={{ background: 'var(--navbar-bg)', borderBottom: '1px solid var(--navbar-border)', transition: 'background 0.3s ease, border-color 0.3s ease' }} className="sticky top-0 z-50">
      {/* Top Bar */}
      <div style={{ padding: '12px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', width: '100%', boxSizing: 'border-box' }}>
        {/* Logo + Brand */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <img
            src="/seznik_logo.png"
            alt="Seznik Logo"
            className="navbar-logo"
            style={{ width: '42px', height: '42px', borderRadius: '10px', objectFit: 'contain', boxShadow: '0 2px 8px rgba(59,130,246,0.18)' }}
          />
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h1 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700, color: 'var(--navbar-text)', transition: 'color 0.3s ease' }}>
                Seznik Admin Panel
              </h1>
              <span className="badge badge-active" style={{ fontSize: '0.7rem' }}>
                <span className="pulse-dot" style={{ width: '6px', height: '6px' }}></span> LIVE TELEMETRY
              </span>
            </div>
            <p style={{ margin: '1px 0 0 0', fontSize: '0.72rem', color: 'var(--navbar-text-muted)', transition: 'color 0.3s ease' }}>
              User Login Tracking • Section Heatmap • Geolocation Analytics
            </p>
          </div>
        </div>

        {/* Right Action Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          {/* Time Range Selector */}
          <div style={{ display: 'flex', background: 'var(--tab-bg)', padding: '3px', borderRadius: '8px', border: '1px solid var(--tab-border)', transition: 'background 0.3s ease' }}>
            {['24h', '7d', '30d', 'All'].map((range) => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                style={{
                  padding: '4px 10px',
                  borderRadius: '6px',
                  border: 'none',
                  background: timeRange === range ? 'var(--accent-blue)' : 'transparent',
                  color: timeRange === range ? '#FFFFFF' : 'var(--navbar-text-muted)',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                {range}
              </button>
            ))}
          </div>

          {/* Auto Refresh Interval Dropdown */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--tab-bg)', padding: '4px 10px', borderRadius: '8px', border: '1px solid var(--tab-border)', transition: 'background 0.3s ease' }}>
            {autoRefreshInterval > 0 && (
              <span className="pulse-dot" style={{ width: '6px', height: '6px', background: '#10B981' }} />
            )}
            <span style={{ fontSize: '0.75rem', color: 'var(--navbar-text-muted)', fontWeight: 500 }}>Auto Refresh:</span>
            <select
              className="custom-select"
              value={autoRefreshInterval}
              onChange={(e) => setAutoRefreshInterval(Number(e.target.value))}
              style={{
                background: 'transparent',
                border: 'none',
                color: autoRefreshInterval > 0 ? '#10B981' : 'var(--navbar-text)',
                fontSize: '0.75rem',
                fontWeight: 600,
                outline: 'none',
              }}
            >
              <option value={0}>Off (Manual)</option>
              <option value={10}>Every 10s</option>
              <option value={30}>Every 30s</option>
              <option value={60}>Every 1 min</option>
              <option value={300}>Every 5 mins</option>
            </select>
          </div>

          {/* Refresh Button */}
          <button
            onClick={onRefresh}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '7px 12px',
              borderRadius: '8px',
              border: '1px solid var(--tab-border)',
              background: 'var(--tab-bg)',
              color: 'var(--navbar-text)',
              fontSize: '0.75rem',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
          >
            <RefreshCw size={13} className={autoRefreshInterval > 0 ? 'animate-spin-slow' : ''} />
            <span>Refresh</span>
          </button>

          {/* Last refreshed time */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
            fontSize: '0.72rem',
            color: 'var(--navbar-text-muted)',
            padding: '4px 12px',
            borderRadius: '9999px',
            border: '1px solid var(--tab-border)',
            background: 'var(--tab-bg)',
            whiteSpace: 'nowrap',
          }}>
            <Clock size={12} />
            <span>Updated: {lastRefreshedAt}</span>
          </div>

          {/* Admin Avatar */}
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '8px', 
            padding: '5px 10px', 
            background: 'rgba(59, 130, 246, 0.08)', 
            border: '1px solid rgba(59, 130, 246, 0.2)', 
            borderRadius: '9999px' 
          }}>
            <UserCheck size={14} color="var(--accent-blue)" />
            <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--accent-blue)' }}>Admin Root</span>
          </div>

          {/* Theme Toggler */}
          <AnimatedThemeToggler variant="circle" duration={500} />
        </div>
      </div>

      {/* Tabs Navigation */}
      <div style={{ display: 'flex', padding: '0 32px', gap: '4px', overflowX: 'auto', borderTop: '1px solid var(--navbar-border)', width: '100%', boxSizing: 'border-box', transition: 'border-color 0.3s ease' }}>
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
                gap: '7px',
                padding: '11px 14px',
                border: 'none',
                background: 'transparent',
                color: isSelected ? 'var(--accent-blue)' : 'var(--navbar-text-muted)',
                borderBottom: isSelected ? '2px solid var(--accent-blue)' : '2px solid transparent',
                fontSize: '0.84rem',
                fontWeight: isSelected ? 600 : 500,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 0.15s ease',
              }}
            >
              <Icon size={15} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>
    </header>
  );
};
