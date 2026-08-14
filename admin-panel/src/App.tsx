import React, { useState, useEffect } from 'react';
import { LayoutGrid, ChevronDown } from 'lucide-react';
import { Navbar } from './components/Navbar';
import { KPICards } from './components/KPICards';
import { SectionUsageChart } from './components/SectionUsageChart';
import { UserManagementView } from './components/UserManagementView';
import { PeakUsageHeatmap } from './components/PeakUsageHeatmap';
import { DeviceSessionBreakdown } from './components/DeviceSessionBreakdown';
import { RegisteredUsersRoster } from './components/RegisteredUsersRoster';
import { RedirectsView } from './components/RedirectsView';
import { TrafficView } from './components/TrafficView';
import { 
  fetchDashboardMetrics, 
  fetchUserRecords, 
  fetchLoginLogs, 
  fetchSectionUsage, 
  fetchHeatmapData,
  fetchDeviceSessionBreakdown,
  fetchSecurityAnomalyData,
} from './services/api';
import type { 
  DashboardMetrics, 
  UserRecord, 
  UserLoginLog, 
  SectionUsage, 
  HeatmapCell,
  HeatmapResponse,
  DeviceSessionBreakdownData,
  SecurityAnomalyData,
} from './types/admin';

const VALID_TABS = ['overview', 'sections', 'users', 'traffic', 'redirects', 'logins'];

const getInitialTab = (): string => {
  if (typeof window !== 'undefined') {
    const hash = window.location.hash.replace('#', '').trim();
    if (hash && VALID_TABS.includes(hash)) {
      return hash;
    }
    const savedTab = localStorage.getItem('admin_active_tab');
    if (savedTab && VALID_TABS.includes(savedTab)) {
      return savedTab;
    }
  }
  return 'overview';
};

export const App: React.FC = () => {
  const [activeTab, setActiveTabState] = useState<string>(getInitialTab);
  const [timeRange, setTimeRange] = useState<string>('24h');
  const [lastRefreshedAt, setLastRefreshedAt] = useState<string>(new Date().toLocaleTimeString());
  const [selectedUserEmailForLogs, setSelectedUserEmailForLogs] = useState<string | null>(null);
  const [selectedUserForProfile, setSelectedUserForProfile] = useState<string | null>(null);
  const [autoRefreshInterval, setAutoRefreshInterval] = useState<number>(0); // 0 = Off (Manual), 10s, 30s, 60s, 300s

  const setActiveTab = (tab: string) => {
    const targetTab = VALID_TABS.includes(tab) ? tab : 'overview';
    setActiveTabState(targetTab);
    if (typeof window !== 'undefined' && window.location.hash.replace('#', '') !== targetTab) {
      window.location.hash = targetTab;
      localStorage.setItem('admin_active_tab', targetTab);
    }
    if (targetTab !== 'logins') setSelectedUserEmailForLogs(null);
    if (targetTab !== 'users') setSelectedUserForProfile(null);
  };

  // Global Cmd+K / Ctrl+K listener for Command Palette
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsCommandPaletteOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

  useEffect(() => {
    // Ensure URL hash and localStorage are set on initial load
    if (typeof window !== 'undefined') {
      window.location.hash = activeTab;
      localStorage.setItem('admin_active_tab', activeTab);
    }

    const onHashChange = () => {
      const hash = window.location.hash.replace('#', '').trim();
      if (hash && VALID_TABS.includes(hash)) {
        setActiveTabState((prev) => (prev !== hash ? hash : prev));
        localStorage.setItem('admin_active_tab', hash);
      }
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [loginLogs, setLoginLogs] = useState<UserLoginLog[]>([]);
  const [sectionUsage, setSectionUsage] = useState<SectionUsage[]>([]);
  const [heatmapData, setHeatmapData] = useState<HeatmapResponse | HeatmapCell[] | undefined>(undefined);
  const [deviceData, setDeviceData] = useState<DeviceSessionBreakdownData | undefined>(undefined);
  const [securityData, setSecurityData] = useState<SecurityAnomalyData | undefined>(undefined);
  const [loading, setLoading] = useState<boolean>(true);

  const loadAllData = async () => {
    setLoading(true);
    try {
      const [m, u, l, s, heat, dev, sec] = await Promise.all([
        fetchDashboardMetrics(),
        fetchUserRecords(),
        fetchLoginLogs(),
        fetchSectionUsage(),
        fetchHeatmapData(),
        fetchDeviceSessionBreakdown(),
        fetchSecurityAnomalyData(),
      ]);

      setMetrics(m);
      setUsers(u);
      setLoginLogs(l);
      setSectionUsage(s);
      setHeatmapData(heat);
      setDeviceData(dev);
      setSecurityData(sec);
      setLastRefreshedAt(new Date().toLocaleTimeString());
    } catch (err) {
      console.error('Failed to load admin analytics:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllData();
  }, [timeRange]);

  // Dynamic Auto-Refresh Effect
  useEffect(() => {
    if (autoRefreshInterval <= 0) return;

    const timer = setInterval(() => {
      loadAllData();
    }, autoRefreshInterval * 1000);

    return () => clearInterval(timer);
  }, [autoRefreshInterval, timeRange]);

  const handleGlobalRefresh = () => {
    loadAllData();
  };

  const handleSelectTabFromCard = (targetTab: string) => {
    setActiveTab(targetTab);
  };

  return (
    <div style={{ height: '100vh', maxHeight: '100vh', background: 'var(--bg-main)', color: 'var(--text-main)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Top Navigation */}
      <div style={{ flexShrink: 0 }}>
        <Navbar
          activeTab={activeTab}
          onSelectTab={setActiveTab}
          timeRange={timeRange}
          onSelectTimeRange={setTimeRange}
          onRefresh={handleGlobalRefresh}
          lastRefreshedAt={lastRefreshedAt}
          autoRefreshInterval={autoRefreshInterval}
          onSelectAutoRefreshInterval={setAutoRefreshInterval}
        />
      </div>

      {/* Main Container */}
      <main style={{ flex: 1, minHeight: 0, padding: '16px 24px', maxWidth: '1600px', margin: '0 auto', width: '100%', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
        {loading && !metrics ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '300px' }}>
            <div className="pulse-dot" style={{ width: '16px', height: '16px' }} />
            <span style={{ marginLeft: '12px', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
              Loading real-time DB analytics...
            </span>
          </div>
        ) : (
          <>
            {activeTab === 'overview' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', flex: 1, minHeight: 0 }}>
                {/* 1. Key Performance Indicators (Always at Top) */}
                <div style={{ flexShrink: 0 }}>
                  <KPICards metrics={metrics} onSelectTab={handleSelectTabFromCard} />
                </div>

                {/* 2. Heatmap + Device Breakdown Row */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'minmax(0, 1.45fr) minmax(360px, 1fr)',
                    gap: '14px',
                    alignItems: 'stretch',
                    flex: '0 0 auto',
                    minHeight: '270px',
                  }}
                >
                  <PeakUsageHeatmap data={heatmapData} />
                  <DeviceSessionBreakdown data={deviceData} />
                </div>

                {/* 3. Top 5 Most Used Features (Standard Card, No Toggle Button) */}
                <SectionUsageChart
                  title="Top 5 Most Used Features"
                  sections={sectionUsage.slice(0, 5)}
                  showInsights={false}
                  compact={true}
                  isCollapsible={false}
                  onViewAllSessions={() => {
                    setActiveTab('sections');
                  }}
                />
              </div>
            )}

            {activeTab === 'traffic' && (
              <TrafficView />
            )}

            {activeTab === 'redirects' && (
              <RedirectsView />
            )}

            {activeTab === 'sections' && (
              <SectionUsageChart
                title="Section & Feature Traffic Breakdown"
                sections={sectionUsage}
                showInsights={true}
                compact={false}
                isCollapsible={false}
                onViewAllSessions={() => {}}
              />
            )}

            {activeTab === 'users' && (
              <UserManagementView
                users={users}
                selectedUserEmail={selectedUserForProfile}
                onClearSelectedUser={() => setSelectedUserForProfile(null)}
              />
            )}

            {activeTab === 'logins' && (
              <RegisteredUsersRoster
                logs={loginLogs}
                selectedEmail={selectedUserEmailForLogs}
                onSelectUser={(email) => {
                  setSelectedUserForProfile(email);
                  setActiveTab('users');
                }}
              />
            )}
          </>
        )}
      </main>
    </div>
  );
};

export default App;

