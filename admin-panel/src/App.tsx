import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { KPICardsSection } from './components/KPICardsSection';
import { SectionUsageSection } from './components/SectionUsageSection';
import { UsersSection } from './components/UsersSection';
import { PeakUsageHeatmap } from './components/PeakUsageHeatmap';
import { DeviceSessionBreakdown } from './components/DeviceSessionBreakdown';
import { RedirectsView } from './components/RedirectsView';
import { TrafficView } from './components/TrafficView';
import { HealthView } from './components/HealthView';

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

interface AppProps {
  userId: string;
  onLogout: () => void;
}

export const App: React.FC<AppProps> = ({ userId, onLogout }) => {
  const [activeTab, setActiveTabState] = useState<string>(getInitialTab);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<string>(new Date().toLocaleTimeString());
  const [selectedUserForProfile, setSelectedUserForProfile] = useState<string | null>(null);
  const [autoRefreshInterval, setAutoRefreshInterval] = useState<number>(0);
  const [overviewRefreshKey, setOverviewRefreshKey] = useState(0);

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

  useEffect(() => {
    if (autoRefreshInterval <= 0) return;

    const timer = setInterval(() => {
      if (activeTab === 'overview') {
        setOverviewRefreshKey((k) => k + 1);
        setLastRefreshedAt(new Date().toLocaleTimeString());
      }
    }, autoRefreshInterval * 1000);

    return () => clearInterval(timer);
  }, [autoRefreshInterval, activeTab]);

  const handleGlobalRefresh = () => {
    setLastRefreshedAt(new Date().toLocaleTimeString());
    if (activeTab === 'overview') {
      setOverviewRefreshKey((k) => k + 1);
    }
  };

  const handleSelectTabFromCard = (targetTab: string) => {
    setActiveTab(targetTab);
  };

  return (
    <div className="admin-app-shell">
      <div style={{ flexShrink: 0 }}>
        <Navbar
          activeTab={activeTab}
          onSelectTab={setActiveTab}
          onRefresh={handleGlobalRefresh}
          lastRefreshedAt={lastRefreshedAt}
          autoRefreshInterval={autoRefreshInterval}
          onSelectAutoRefreshInterval={setAutoRefreshInterval}
          userId={userId}
          onLogout={onLogout}
        />
      </div>

      <main
        className={`admin-main${activeTab === 'overview' ? ' admin-main--overview' : ''}${
          activeTab === 'redirects' ? ' admin-main--redirects' : ''
        }`}
      >
        {activeTab === 'health' ? (
          <HealthView />
        ) : activeTab === 'overview' ? (
          <div key={overviewRefreshKey} className="admin-overview-layout">
            <div className="overview-kpi-row">
              <KPICardsSection onSelectTab={handleSelectTabFromCard} />
            </div>

            <div className="overview-split-grid">
              <div className="overview-heatmap-slot">
                <PeakUsageHeatmap embedded />
              </div>
              <div className="overview-device-slot">
                <DeviceSessionBreakdown embedded />
              </div>
            </div>

            <div className="overview-features-row">
              <SectionUsageSection
                title="Top 5 Most Used Features"
                limit={5}
                compact={true}
                embedded
                onViewAllSessions={() => setActiveTab('sections')}
              />
            </div>
          </div>
        ) : activeTab === 'traffic' ? (
          <TrafficView />
        ) : activeTab === 'redirects' ? (
          <RedirectsView />
        ) : activeTab === 'sections' ? (
          <SectionUsageSection
            title="Section & Feature Traffic Breakdown"
            showInsights={true}
            compact={false}
            onViewAllSessions={() => {}}
          />
        ) : activeTab === 'users' ? (
          <UsersSection initialSearchTerm={selectedUserForProfile} />
        ) : null}
      </main>
    </div>
  );
};

export default App;
