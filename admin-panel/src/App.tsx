import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { KPICards } from './components/KPICards';
import { SectionUsageChart } from './components/SectionUsageChart';
import { UserManagementView } from './components/UserManagementView';
import { PeakUsageHeatmap } from './components/PeakUsageHeatmap';
import { DeviceSessionBreakdown } from './components/DeviceSessionBreakdown';
import { RegisteredUsersRoster } from './components/RegisteredUsersRoster';
import { RedirectsView } from './components/RedirectsView';
import { TrafficView } from './components/TrafficView';
import { CommandPaletteModal } from './components/CommandPaletteModal';
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
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState<boolean>(false);

  const setActiveTab = (tab: string) => {
    const targetTab = VALID_TABS.includes(tab) ? tab : 'overview';
    setActiveTabState(targetTab);
    if (typeof window !== 'undefined') {
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
        setActiveTabState(hash);
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
    <div style={{ minHeight: '100vh', background: 'var(--bg-main)', color: 'var(--text-main)', display: 'flex', flexDirection: 'column' }}>
      {/* Top Navigation */}
      <Navbar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        timeRange={timeRange}
        onSelectTimeRange={setTimeRange}
        onRefresh={handleGlobalRefresh}
        lastRefreshedAt={lastRefreshedAt}
        autoRefreshInterval={autoRefreshInterval}
        onSelectAutoRefreshInterval={setAutoRefreshInterval}
        onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
      />

      {/* Main Container */}
      <main style={{ flex: 1, padding: '24px 32px', maxWidth: '1600px', margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
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
              <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                {/* 1. Key Performance Indicators */}
                <KPICards metrics={metrics} onSelectTab={handleSelectTabFromCard} />

                {/* 2. Top 5 Most Used Features */}
                <SectionUsageChart
                  title="Top 5 Most Used Features & Section Traffic"
                  sections={sectionUsage.slice(0, 5)}
                  showInsights={false}
                  compact={true}
                  onViewAllSessions={() => {
                    setActiveTab('sections');
                  }}
                />

                {/* 3. Side-by-Side Row: Peak Usage Heatmap (Left) vs Device Ratio Breakdown (Right) */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(460px, 1fr))',
                    gap: '20px',
                    alignItems: 'stretch',
                  }}
                >
                  <PeakUsageHeatmap data={heatmapData} />
                  <DeviceSessionBreakdown data={deviceData} />
                </div>
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
                hideHeaderButton={true}
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

      {/* Global Command Palette Modal (Cmd+K / Ctrl+K) */}
      <CommandPaletteModal
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        users={users}
        onRefresh={loadAllData}
        onSelectTab={(tab, userSearch) => {
          setActiveTab(tab);
          if (userSearch) {
            setSelectedUserForProfile(userSearch);
          }
        }}
      />
    </div>
  );
};

export default App;

