import React, { useState, useEffect } from 'react';
import { 
  Activity, 
  Users, 
  LayoutGrid, 
  ShieldAlert, 
  RefreshCw, 
  Clock, 
  Calendar,
  UserCheck,
  ExternalLink,
  Smartphone,
  Search,
} from 'lucide-react';
import { AnimatedThemeToggler } from './AnimatedThemeToggler';

interface NavbarProps {
  activeTab: string;
  onSelectTab?: (tab: string) => void;
  setActiveTab?: (tab: string) => void;
  timeRange?: string;
  onSelectTimeRange?: (range: string) => void;
  setTimeRange?: (range: string) => void;
  lastRefreshedAt: string;
  onRefresh: () => void;
  autoRefreshInterval: number;
  onSelectAutoRefreshInterval?: (interval: number) => void;
  setAutoRefreshInterval?: (interval: number) => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  onSelectTab,
  setActiveTab,
  timeRange = '7d',
  onSelectTimeRange,
  setTimeRange,
  lastRefreshedAt,
  onRefresh,
  autoRefreshInterval,
  onSelectAutoRefreshInterval,
  setAutoRefreshInterval,
}) => {
  const [currentDateTime, setCurrentDateTime] = useState<Date>(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentDateTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formattedDate = currentDateTime.toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Kolkata',
  });

  const formattedTime = currentDateTime.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
    timeZone: 'Asia/Kolkata',
  });

  const handleTabClick = (tabId: string) => {
    if (onSelectTab) {
      onSelectTab(tabId);
    } else if (setActiveTab) {
      setActiveTab(tabId);
    }
  };

  const handleAutoRefreshChange = (interval: number) => {
    if (onSelectAutoRefreshInterval) {
      onSelectAutoRefreshInterval(interval);
    } else if (setAutoRefreshInterval) {
      setAutoRefreshInterval(interval);
    }
  };

  const handleTimeRangeChange = (range: string) => {
    if (onSelectTimeRange) {
      onSelectTimeRange(range);
    } else if (setTimeRange) {
      setTimeRange(range);
    }
  };

  const tabs = [
    { id: 'overview', label: 'Overview & Metrics', icon: Activity },
    { id: 'sections', label: 'Section Analytics', icon: LayoutGrid },
    { id: 'users', label: 'Registered Users', icon: Users },
    { id: 'traffic', label: 'Traffic', icon: Activity },
    { id: 'redirects', label: 'Redirects', icon: ExternalLink },
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
              Usage Heatmap • Section Analytics • Merchant Insights
            </p>
          </div>
        </div>

        {/* Right Action Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          {/* Live Date & Time Box */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '6px 12px',
              borderRadius: '8px',
              border: '1px solid var(--tab-border)',
              background: 'var(--tab-bg)',
              color: 'var(--navbar-text)',
              fontSize: '0.76rem',
              fontWeight: 600,
              boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
              userSelect: 'none',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', color: 'var(--accent-blue)' }}>
              <Calendar size={13} />
              <span>{formattedDate}</span>
            </div>
            <span style={{ color: 'var(--navbar-text-muted)', opacity: 0.5 }}>|</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', color: 'var(--navbar-text)' }}>
              <Clock size={13} color="#10B981" />
              <span style={{ fontFamily: 'monospace', letterSpacing: '0.3px', fontWeight: 700 }}>{formattedTime}</span>
              <span style={{ fontSize: '0.65rem', color: 'var(--navbar-text-muted)', fontWeight: 600 }}>IST</span>
            </div>
          </div>

          {/* Global Time Range */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--tab-bg)', padding: '4px 10px', borderRadius: '8px', border: '1px solid var(--tab-border)' }}>
            <Calendar size={13} color="var(--accent-blue)" />
            <span style={{ fontSize: '0.75rem', color: 'var(--navbar-text-muted)', fontWeight: 500 }}>Range:</span>
            <select
              className="custom-select"
              value={timeRange}
              onChange={(e) => handleTimeRangeChange(e.target.value)}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--navbar-text)',
                fontSize: '0.75rem',
                fontWeight: 600,
                outline: 'none',
                cursor: 'pointer',
              }}
            >
              <option value="24h">Last 24 Hours</option>
              <option value="7d">Last 7 Days</option>
              <option value="30d">Last 30 Days</option>
              <option value="all">All Time</option>
            </select>
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
              onChange={(e) => handleAutoRefreshChange(Number(e.target.value))}
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
              padding: '6px 12px',
              borderRadius: '8px',
              border: '1px solid var(--tab-border)',
              background: 'var(--tab-bg)',
              color: 'var(--navbar-text)',
              fontSize: '0.75rem',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            <RefreshCw size={13} color="var(--accent-blue)" />
            <span>Refresh</span>
          </button>

          {/* Last Updated Timestamp Pill */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '5px 10px',
            fontSize: '0.72rem',
            color: 'var(--navbar-text-muted)',
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
      <div 
        style={{ 
          display: 'flex', 
          padding: '0 24px', 
          gap: '6px', 
          overflowX: 'auto', 
          borderTop: '1px solid var(--navbar-border)', 
          width: '100%', 
          boxSizing: 'border-box', 
          transition: 'border-color 0.3s ease',
          scrollbarWidth: 'thin',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isSelected = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => handleTabClick(tab.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '7px',
                padding: '11px 16px',
                border: 'none',
                background: isSelected ? 'rgba(59, 130, 246, 0.08)' : 'transparent',
                color: isSelected ? 'var(--accent-blue)' : 'var(--navbar-text-muted)',
                borderBottom: isSelected ? '2px solid var(--accent-blue)' : '2px solid transparent',
                fontSize: '0.84rem',
                fontWeight: isSelected ? 600 : 500,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                flexShrink: 0,
                borderRadius: '6px 6px 0 0',
                transition: 'all 0.15s ease',
              }}
            >
              <Icon size={15} color={isSelected ? 'var(--accent-blue)' : undefined} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>
    </header>
  );
};
