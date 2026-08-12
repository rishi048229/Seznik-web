import React from 'react';
import { LayoutGrid, TrendingUp, TrendingDown, Clock, Users, ArrowRight } from 'lucide-react';
import type { SectionUsage } from '../types/admin';
import { EmptyState } from './EmptyState';

interface SectionUsageChartProps {
  title?: string;
  sections?: SectionUsage[];
  showInsights?: boolean;
  compact?: boolean;
  hideHeaderButton?: boolean;
  onViewAllSessions?: (sectionId?: string) => void;
}

export const SectionUsageChart: React.FC<SectionUsageChartProps> = ({
  title = 'Section & Feature Traffic Breakdown',
  sections = [],
  showInsights = true,
  compact = false,
  hideHeaderButton = false,
  onViewAllSessions,
}) => {
  const maxShare = Math.max(...sections.map((s) => s.percentageShare), 1);

  return (
    <div className="glass-card" style={{ padding: compact ? '16px 20px' : '24px', marginBottom: compact ? '0px' : '24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: compact ? '12px' : '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <LayoutGrid size={20} color="#F59E0B" />
            <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#F9FAFB' }}>
              {title}
            </h2>
          </div>
          <p style={{ margin: '4px 0 0 0', fontSize: '0.8rem', color: '#9CA3AF' }}>
            Telemetry of module usage, unique active merchants, average session duration, and growth trends.
          </p>
        </div>

        {!hideHeaderButton && onViewAllSessions && (
          <button
            onClick={() => onViewAllSessions()}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              background: 'transparent',
              border: 'none',
              color: '#3B82F6',
              fontSize: '0.8rem',
              fontWeight: 600,
              cursor: 'pointer',
              padding: '6px 10px',
              borderRadius: '6px',
            }}
          >
            <span>View All Features</span>
            <ArrowRight size={14} />
          </button>
        )}
      </div>

      {sections.length === 0 ? (
        <EmptyState
          icon={LayoutGrid}
          title="No Traffic Recorded"
          message="No section traffic recorded in this window."
        />
      ) : (
        <div style={{ width: '100%' }}>
          <table className="custom-table" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th>Section Module</th>
                <th>Traffic Distribution</th>
                <th>Unique Users</th>
                <th>Avg Session Duration</th>
                <th>Trend Delta</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {sections.map((sec) => {
                const isPositive = sec.trend !== 'down';
                const TrendIcon = isPositive ? TrendingUp : TrendingDown;
                const trendColor = isPositive ? '#34D399' : '#F87171';
                const barWidth = Math.max(sec.percentageShare, 6); // Min width of 6% for readability

                return (
                  <tr key={sec.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontWeight: 600, color: '#F9FAFB' }}>{sec.sectionName}</span>
                        <code style={{ fontSize: '0.75rem', color: '#60A5FA', background: 'rgba(59, 130, 246, 0.1)', padding: '2px 6px', borderRadius: '4px' }}>
                          {sec.path}
                        </code>
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ flex: 1, height: '8px', background: '#1F2937', borderRadius: '4px', overflow: 'hidden' }}>
                          <div
                            style={{
                              width: `${Math.max(sec.percentageShare, 2)}%`,
                              height: '100%',
                              background: 'linear-gradient(90deg, #3B82F6 0%, #8B5CF6 100%)',
                              borderRadius: '4px',
                            }}
                          />
                        </div>
                        <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#D1D5DB', minWidth: '40px', textAlign: 'right' }}>
                          {sec.percentageShare}%
                        </span>
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#E5E7EB' }}>
                        <Users size={14} color="#C084FC" />
                        <span>{sec.uniqueUsers} Users</span>
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#E5E7EB' }}>
                        <Clock size={14} color="#FBBF24" />
                        <span>{sec.avgDurationMinutes} mins</span>
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 600, color: trendColor }}>
                        <TrendIcon size={14} color={trendColor} />
                        <span>{isPositive ? '+' : ''}{sec.trendPercent}%</span>
                      </div>
                    </td>
                    <td>
                      <button
                        onClick={() => {
                          if (onViewAllSessions) {
                            onViewAllSessions(sec.id);
                          }
                        }}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          background: 'rgba(59, 130, 246, 0.1)',
                          border: '1px solid rgba(59, 130, 246, 0.25)',
                          color: '#60A5FA',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                          padding: '6px 12px',
                          borderRadius: '6px',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        <span>View feature logs</span>
                        <ArrowRight size={13} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
