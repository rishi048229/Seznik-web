import React, { useEffect, useState } from 'react';
import { SectionUsageChart } from './SectionUsageChart';
import { TimeRangeSelect } from './TimeRangeSelect';
import { fetchSectionUsage } from '../services/api';
import type { SectionUsage } from '../types/admin';

interface SectionUsageSectionProps {
  title: string;
  limit?: number;
  showInsights?: boolean;
  compact?: boolean;
  embedded?: boolean;
  onViewAllSessions?: () => void;
}

export const SectionUsageSection: React.FC<SectionUsageSectionProps> = ({
  title,
  limit,
  showInsights = false,
  compact = false,
  embedded = false,
  onViewAllSessions,
}) => {
  const [timeRange, setTimeRange] = useState('7d');
  const [sections, setSections] = useState<SectionUsage[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchSectionUsage(timeRange)
      .then((data) => {
        if (!cancelled) setSections(data);
      })
      .catch(() => {
        if (!cancelled) setSections([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [timeRange]);

  if (loading && sections.length === 0) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: embedded ? '100%' : '120px' }}>
        <div className="pulse-dot" style={{ width: '12px', height: '12px' }} />
      </div>
    );
  }

  return (
    <div className={embedded ? 'section-usage-embedded' : undefined}>
      {!embedded && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '8px' }}>
          <TimeRangeSelect value={timeRange} onChange={setTimeRange} compact />
        </div>
      )}
      <SectionUsageChart
        title={title}
        sections={limit != null ? sections.slice(0, limit) : sections}
        showInsights={showInsights}
        compact={compact}
        isCollapsible={false}
        headerExtra={embedded ? <TimeRangeSelect value={timeRange} onChange={setTimeRange} compact /> : undefined}
        onViewAllSessions={onViewAllSessions}
      />
    </div>
  );
};
