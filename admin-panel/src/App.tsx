import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { KPICards } from './components/KPICards';
import { LoginAuditTable } from './components/LoginAuditTable';
import { SectionUsageChart } from './components/SectionUsageChart';
import { LocationDistribution } from './components/LocationDistribution';
import { UserManagementView } from './components/UserManagementView';
import { 
  fetchDashboardMetrics, 
  fetchUserRecords, 
  fetchLoginLogs, 
  fetchSectionUsage, 
  fetchLocationMetrics 
} from './services/api';
import type { 
  DashboardMetrics, 
  UserRecord, 
  UserLoginLog, 
  SectionUsage, 
  LocationMetric 
} from './types/admin';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<string>('overview');
  const [timeRange, setTimeRange] = useState<string>('24h');
  const [lastRefreshedAt, setLastRefreshedAt] = useState<string>(new Date().toLocaleTimeString());

  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [loginLogs, setLoginLogs] = useState<UserLoginLog[]>([]);
  const [sectionUsage, setSectionUsage] = useState<SectionUsage[]>([]);
  const [locationMetrics, setLocationMetrics] = useState<LocationMetric[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const loadAllData = async () => {
    setLoading(true);
    try {
      const [m, u, l, s, loc] = await Promise.all([
        fetchDashboardMetrics(),
        fetchUserRecords(),
        fetchLoginLogs(),
        fetchSectionUsage(),
        fetchLocationMetrics(),
      ]);

      setMetrics(m);
      setUsers(u);
      setLoginLogs(l);
      setSectionUsage(s);
      setLocationMetrics(loc);
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

  return (
    <div style={{ minHeight: '100vh', background: '#0B0F19' }}>
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        timeRange={timeRange}
        setTimeRange={setTimeRange}
        lastRefreshedAt={lastRefreshedAt}
        onRefresh={loadAllData}
      />

      <main style={{ padding: '24px', maxWidth: '1440px', margin: '0 auto' }}>
        {/* KPI Top Summary Row */}
        <KPICards metrics={metrics} />

        {loading && !metrics ? (
          <div style={{ padding: '60px', textAlign: 'center', color: '#9CA3AF' }}>
            <div className="pulse-dot" style={{ margin: '0 auto 16px auto', width: '16px', height: '16px' }} />
            <p>Loading real-time admin telemetry data...</p>
          </div>
        ) : (
          <>
            {activeTab === 'overview' && (
              <>
                <SectionUsageChart sections={sectionUsage} />
                <LocationDistribution locations={locationMetrics} />
              </>
            )}

            {activeTab === 'logins' && (
              <LoginAuditTable logs={loginLogs} />
            )}

            {activeTab === 'sections' && (
              <SectionUsageChart sections={sectionUsage} />
            )}

            {activeTab === 'locations' && (
              <LocationDistribution locations={locationMetrics} />
            )}

            {activeTab === 'users' && (
              <UserManagementView users={users} />
            )}
          </>
        )}
      </main>
    </div>
  );
};

export default App;
