import React, { useEffect, useState } from 'react';
import { KPICards } from './KPICards';
import { fetchDashboardMetrics } from '../services/api';
import type { DashboardMetrics } from '../types/admin';

interface KPICardsSectionProps {
  onSelectTab?: (tab: string) => void;
}

export const KPICardsSection: React.FC<KPICardsSectionProps> = ({ onSelectTab }) => {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchDashboardMetrics('all')
      .then((data) => {
        if (!cancelled) setMetrics(data);
      })
      .catch(() => {
        if (!cancelled) setMetrics(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div>
      {loading && !metrics ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '80px' }}>
          <div className="pulse-dot" style={{ width: '12px', height: '12px' }} />
        </div>
      ) : (
        <KPICards metrics={metrics} onSelectTab={onSelectTab} />
      )}
    </div>
  );
};
