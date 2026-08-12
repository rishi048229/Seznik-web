import React from 'react';
import { Activity, Clock } from 'lucide-react';
import type { HeatmapCell } from '../types/admin';
import { EmptyState } from './EmptyState';

interface PeakUsageHeatmapProps {
  data?: HeatmapCell[];
}

export const PeakUsageHeatmap: React.FC<PeakUsageHeatmapProps> = ({ data = [] }) => {
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const hours = [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22];

  // Helper to find count for day and hour slot
  const getCellCount = (day: string, hourSlot: number) => {
    return data
      .filter((c) => c.day === day && c.hour >= hourSlot && c.hour < hourSlot + 2)
      .reduce((sum, c) => sum + c.count, 0);
  };

  const maxCount = Math.max(...data.map((c) => c.count), 1);

  const getIntensityColor = (count: number) => {
    if (count === 0) return '#1F2937';
    const ratio = count / maxCount;
    if (ratio < 0.33) return 'rgba(59, 130, 246, 0.3)';
    if (ratio < 0.66) return 'rgba(59, 130, 246, 0.65)';
    return '#3B82F6';
  };

  return (
    <div className="glass-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Activity size={20} color="#3B82F6" />
            <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#F9FAFB' }}>
              Peak Usage Heatmap
            </h2>
          </div>
          <p style={{ margin: '4px 0 0 0', fontSize: '0.8rem', color: '#9CA3AF' }}>
            Hour of day × Day of week login & session activity density.
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: '#9CA3AF' }}>
          <span>Low</span>
          <div style={{ width: '10px', height: '10px', borderRadius: '3px', background: 'rgba(59, 130, 246, 0.3)' }} />
          <div style={{ width: '10px', height: '10px', borderRadius: '3px', background: 'rgba(59, 130, 246, 0.65)' }} />
          <div style={{ width: '10px', height: '10px', borderRadius: '3px', background: '#3B82F6' }} />
          <span>High Density</span>
        </div>
      </div>

      {data.length === 0 ? (
        <EmptyState
          icon={Clock}
          title="No Heatmap Telemetry"
          message="No active session logs recorded for heatmap analysis in this window."
        />
      ) : (
        <div style={{ width: '100%' }}>
          {/* Hours Header Row */}
          <div style={{ display: 'grid', gridTemplateColumns: '36px repeat(12, minmax(0, 1fr))', gap: '4px', marginBottom: '6px' }}>
            <div />
            {hours.map((h) => (
              <div key={h} style={{ fontSize: '0.65rem', color: '#9CA3AF', textAlign: 'center', fontWeight: 600 }}>
                {h < 10 ? `0${h}` : h}h
              </div>
            ))}
          </div>

          {/* Days Rows */}
          {days.map((day) => (
            <div key={day} style={{ display: 'grid', gridTemplateColumns: '36px repeat(12, minmax(0, 1fr))', gap: '4px', marginBottom: '4px', alignItems: 'center' }}>
              <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#9CA3AF' }}>{day}</span>
              {hours.map((h) => {
                const count = getCellCount(day, h);
                return (
                  <div
                    key={h}
                    title={`${day} ${h}:00 - ${h + 2}:00: ${count} sessions`}
                    style={{
                      height: '20px',
                      borderRadius: '4px',
                      background: getIntensityColor(count),
                      transition: 'all 0.15s ease',
                      cursor: 'pointer',
                      width: '100%',
                    }}
                  />
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
