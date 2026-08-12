import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { KPICards } from './components/KPICards';
import { LoginAuditTable } from './components/LoginAuditTable';
import { SectionUsageChart } from './components/SectionUsageChart';
import { LocationDistribution } from './components/LocationDistribution';
import { UserManagementView } from './components/UserManagementView';
import { PeakUsageHeatmap } from './components/PeakUsageHeatmap';
import { DeviceSessionBreakdown } from './components/DeviceSessionBreakdown';
import { SecurityAnomalyPanel } from './components/SecurityAnomalyPanel';
import { SectionDetailView } from './components/SectionDetailView';
import { RegisteredUsersRoster } from './components/RegisteredUsersRoster';
import { 
  fetchDashboardMetrics, 
  fetchUserRecords, 
  fetchLoginLogs, 
  fetchSectionUsage, 
  fetchLocationMetrics,
  fetchHeatmapData,
  fetchDeviceSessionBreakdown,
  fetchSecurityAnomalyData,
} from './services/api';
import type { 
  DashboardMetrics, 
  UserRecord, 
  UserLoginLog, 
  SectionUsage, 
  LocationMetric,
  HeatmapCell,
  DeviceSessionBreakdownData,
  SecurityAnomalyData,
} from './types/admin';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<string>('overview');
  const [timeRange, setTimeRange] = useState<string>('24h');
  const [lastRefreshedAt, setLastRefreshedAt] = useState<string>(new Date().toLocaleTimeString());
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);
  const [selectedUserEmailForLogs, setSelectedUserEmailForLogs] = useState<string | null>(null);
  const [selectedUserForProfile, setSelectedUserForProfile] = useState<string | null>(null);

  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [loginLogs, setLoginLogs] = useState<UserLoginLog[]>([]);
  const [sectionUsage, setSectionUsage] = useState<SectionUsage[]>([]);
  const [locationMetrics, setLocationMetrics] = useState<LocationMetric[]>([]);
  const [heatmapData, setHeatmapData] = useState<HeatmapCell[]>([]);
  const [deviceData, setDeviceData] = useState<DeviceSessionBreakdownData | undefined>(undefined);
  const [securityData, setSecurityData] = useState<SecurityAnomalyData | undefined>(undefined);
  const [loading, setLoading] = useState<boolean>(true);

  const loadAllData = async () => {
    setLoading(true);
    try {
      const [m, u, l, s, loc, heat, dev, sec] = await Promise.all([
        fetchDashboardMetrics(),
        fetchUserRecords(),
        fetchLoginLogs(),
        fetchSectionUsage(),
        fetchLocationMetrics(),
        fetchHeatmapData(),
        fetchDeviceSessionBreakdown(),
        fetchSecurityAnomalyData(),
      ]);

      setMetrics(m);
      setUsers(u);
      setLoginLogs(l);
      setSectionUsage(s);
      setLocationMetrics(loc);
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
    const timer = setInterval(() => {
      loadAllData();
    }, 15000); // 15s auto-refresh
    return () => clearInterval(timer);
  }, [timeRange]);

  const activeSection = selectedSectionId
    ? sectionUsage.find((s) => s.id === selectedSectionId) || sectionUsage[0]
    : null;

  return (
    <div style={{ height: '100vh', maxHeight: '100vh', display: 'flex', flexDirection: 'column', background: '#0B0F19', overflow: 'hidden' }}>
      <Navbar
        activeTab={activeTab}
        setActiveTab={(tab) => {
          setActiveTab(tab);
          if (tab !== 'sections') setSelectedSectionId(null);
          if (tab !== 'logins') setSelectedUserEmailForLogs(null);
          if (tab !== 'users') setSelectedUserForProfile(null);
        }}
        timeRange={timeRange}
        setTimeRange={setTimeRange}
        lastRefreshedAt={lastRefreshedAt}
        onRefresh={loadAllData}
      />

      <main style={{ flex: 1, padding: '24px 32px', width: '100%', boxSizing: 'border-box', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
        {loading && !metrics ? (
          <div style={{ padding: '60px', textAlign: 'center', color: '#9CA3AF' }}>
            <div className="pulse-dot" style={{ margin: '0 auto 16px auto', width: '16px', height: '16px' }} />
            <p>Loading real-time admin telemetry data...</p>
          </div>
        ) : (
          <>
            {activeTab === 'overview' && (
              <div style={{ display: 'flex', flexDirection: 'column', flex: 1, gap: '20px', overflowY: 'auto' }}>
                {/* 1. Top 5 Metric Summary Cards */}
                <KPICards
                  metrics={metrics}
                  onSelectTab={(tab, secId) => {
                    setActiveTab(tab);
                    if (secId) {
                      setSelectedSectionId(secId);
                    }
                  }}
                />

                {/* 2. Top 5 Most Used Features (Dedicated Full Width Section) */}
                <SectionUsageChart
                  title="Top 5 Most Used Features & Section Traffic"
                  sections={sectionUsage.slice(0, 5)}
                  showInsights={false}
                  compact={true}
                  onViewAllSessions={() => {
                    setActiveTab('sections');
                    setSelectedSectionId(null);
                  }}
                />

                {/* 3. Side-by-Side Row: Peak Usage Heatmap (Left) vs Device Breakdown (Right) */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '20px', alignItems: 'start' }}>
                  <PeakUsageHeatmap data={heatmapData} />
                  <DeviceSessionBreakdown data={deviceData} />
                </div>
              </div>
            )}

            {activeTab === 'logins' && (
              <LoginAuditTable
                logs={loginLogs}
                filterUserEmail={selectedUserEmailForLogs}
                onClearFilterUser={() => setSelectedUserEmailForLogs(null)}
              />
            )}

            {activeTab === 'sections' && (
              activeSection ? (
                <SectionDetailView
                  section={activeSection}
                  users={users}
                  logs={loginLogs}
                  onBack={() => setSelectedSectionId(null)}
                  onSelectUser={(email) => {
                    setSelectedUserForProfile(email);
                    setActiveTab('users');
                  }}
                />
              ) : (
                <SectionUsageChart
                  sections={sectionUsage}
                  showInsights={true}
                  hideHeaderButton={true}
                  onViewAllSessions={(secId) => {
                    if (secId) {
                      setSelectedSectionId(secId);
                    }
                  }}
                />
              )
            )}

            {activeTab === 'locations' && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '24px' }}>
                <LocationDistribution locations={locationMetrics} />
                <SecurityAnomalyPanel data={securityData} summaryOnly={false} />
              </div>
            )}

            {activeTab === 'users' && (
              <UserManagementView
                users={users}
                initialSearchTerm={selectedUserForProfile}
                onViewUserLogs={(email) => {
                  if (email) setSelectedUserEmailForLogs(email);
                  setActiveTab('logins');
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

