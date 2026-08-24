import React, { useState, useEffect } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Navbar } from './components/Navbar';
import { KPICards } from './components/KPICards';
import { SectionUsageChart } from './components/SectionUsageChart';
import { UserManagementView } from './components/UserManagementView';
import { PeakUsageHeatmap } from './components/PeakUsageHeatmap';
import { DeviceSessionBreakdown } from './components/DeviceSessionBreakdown';
import { RedirectsView } from './components/RedirectsView';
import { TrafficView } from './components/TrafficView';
import { HealthView } from './components/HealthView';
import {
  fetchDashboardMetrics,
  fetchUserRecords,
  fetchSectionUsage,
  fetchHeatmapData,
  fetchDeviceSessionBreakdown,
} from './services/api';
import type {
  DashboardMetrics,
  UserRecord,
  SectionUsage,
  HeatmapCell,
  HeatmapResponse,
  DeviceSessionBreakdownData,
} from './types/admin';

const VALID_TABS = ['overview', 'sections', 'users', 'traffic', 'redirects', 'health'];

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
  const [timeRange, setTimeRange] = useState<string>('7d');
  const [lastRefreshedAt, setLastRefreshedAt] = useState<string>(new Date().toLocaleTimeString());
  const [selectedUserForProfile, setSelectedUserForProfile] = useState<string | null>(null);
  const [autoRefreshInterval, setAutoRefreshInterval] = useState<number>(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const setActiveTab = (tab: string) => {
    const targetTab = VALID_TABS.includes(tab) ? tab : 'overview';
    setActiveTabState(targetTab);
    if (typeof window !== 'undefined' && window.location.hash.replace('#', '') !== targetTab) {
      window.location.hash = targetTab;
      localStorage.setItem('admin_active_tab', targetTab);
    }
    if (targetTab !== 'users') setSelectedUserForProfile(null);
  };

  useEffect(() => {
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
  const [sectionUsage, setSectionUsage] = useState<SectionUsage[]>([]);
  const [heatmapData, setHeatmapData] = useState<HeatmapResponse | HeatmapCell[] | undefined>(undefined);
  const [deviceData, setDeviceData] = useState<DeviceSessionBreakdownData | undefined>(undefined);
  const [loading, setLoading] = useState<boolean>(true);

  const loadAllData = async (activeRange = timeRange) => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const [m, u, s, heat, dev] = await Promise.all([
        fetchDashboardMetrics(activeRange),
        fetchUserRecords(activeRange),
        fetchSectionUsage(activeRange),
        fetchHeatmapData(activeRange),
        fetchDeviceSessionBreakdown(activeRange),
      ]);

      setMetrics(m);
      setUsers(u);
      setSectionUsage(s);
      setHeatmapData(heat);
      setDeviceData(dev);
      setLastRefreshedAt(new Date().toLocaleTimeString());
      setErrorMessage(null);
    } catch (err: any) {
      console.error('Failed to load admin analytics:', err);
      setErrorMessage(err?.message || 'Database connection error or failed request');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllData(timeRange);
  }, [timeRange]);

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

      <main style={{ flex: 1, minHeight: 0, padding: '16px 24px', maxWidth: '1600px', margin: '0 auto', width: '100%', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
        {errorMessage && (
          <div
            style={{
              marginBottom: '14px',
              padding: '12px 18px',
              background: 'rgba(239, 68, 68, 0.12)',
              border: '1px solid rgba(239, 68, 68, 0.35)',
              borderRadius: '10px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
              flexShrink: 0,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <AlertTriangle size={20} color="#EF4444" />
              <div>
                <div style={{ fontSize: '0.86rem', fontWeight: 700, color: '#EF4444' }}>
                  Database Error
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  {errorMessage}
                </div>
              </div>
            </div>
            <button
              onClick={handleGlobalRefresh}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 14px',
                fontSize: '0.78rem',
                fontWeight: 600,
                color: '#fff',
                background: '#EF4444',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
              }}
            >
              <RefreshCw size={13} /> Retry
            </button>
          </div>
        )}

        {activeTab === 'health' ? (
          <HealthView />
        ) : loading && !metrics ? (
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
                <div style={{ flexShrink: 0 }}>
                  <KPICards metrics={metrics} onSelectTab={handleSelectTabFromCard} />
                </div>

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
                  <PeakUsageHeatmap
                    data={heatmapData}
                    globalTimeRange={timeRange}
                    lastRefreshedAt={lastRefreshedAt}
                  />
                  <DeviceSessionBreakdown data={deviceData} />
                </div>

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

            {activeTab === 'traffic' && <TrafficView />}

            {activeTab === 'redirects' && <RedirectsView />}

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
                initialSearchTerm={selectedUserForProfile}
                onRefreshUsers={loadAllData}
              />
            )}
          </>
        )}
      </main>
    </div>
  );
};

export default App;
