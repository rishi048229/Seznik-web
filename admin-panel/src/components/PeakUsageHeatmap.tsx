import React from 'react';
import { Activity, Clock } from 'lucide-react';
import type { HeatmapCell } from '../types/admin';
import { EmptyState } from './EmptyState';

interface PeakUsageHeatmapProps {
  data?: HeatmapCell[];
}

export const PeakUsageHeatmap: React.FC<PeakUsageHeatmapProps> = ({ data = [] }) => {
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const hours = Array.from({ length: 24 }, (_, i) => i);

  const getCellCount = (day: string, hour: number) => {
    const cell = data.find((c) => c.day === day && c.hour === hour);
    return cell ? cell.count : 0;
  };

  const maxCount = Math.max(...data.map((c) => c.count), 1);

  const getIntensityStyle = (count: number) => {
    if (count === 0) {
      return {
        background: 'var(--bg-card-hover)',
        border: '1px solid var(--border-color)',
      };
    }
    const ratio = count / maxCount;
    if (ratio < 0.25) {
      return {
        background: 'rgba(59, 130, 246, 0.6)',
        border: '1px solid rgba(59, 130, 246, 0.8)',
      };
    }
    if (ratio < 0.50) {
      return {
        background: 'rgba(139, 92, 246, 0.85)',
        border: '1px solid rgba(139, 92, 246, 0.95)',
      };
    }
    if (ratio < 0.75) {
      return {
        background: 'rgba(236, 72, 153, 0.9)',
        border: '1px solid rgba(236, 72, 153, 1)',
      };
    }
    return {
      background: 'linear-gradient(135deg, #EC4899 0%, #F59E0B 100%)',
      border: '1px solid #F43F5E',
      boxShadow: '0 0 8px rgba(244, 63, 94, 0.5)',
    };
  };

  return (
    <div className="glass-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Activity size={20} color="#06B6D4" />
            <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-main)' }}>
              24-Hour Peak Usage Heatmap
            </h2>
          </div>
          <p style={{ margin: '4px 0 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            24-hour timeline × 7 days session &amp; login density telemetry.
          </p>
        </div>

        {/* Legend */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          <span style={{ fontSize: '0.7rem' }}>Quiet</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <div style={{ width: '10px', height: '10px', borderRadius: '3px', background: 'var(--bg-card-hover)', border: '1px solid var(--border-color)' }} title="0 sessions" />
            <div style={{ width: '10px', height: '10px', borderRadius: '3px', background: 'rgba(59, 130, 246, 0.6)' }} title="Low Density" />
            <div style={{ width: '10px', height: '10px', borderRadius: '3px', background: 'rgba(139, 92, 246, 0.85)' }} title="Moderate Density" />
            <div style={{ width: '10px', height: '10px', borderRadius: '3px', background: 'rgba(236, 72, 153, 0.9)' }} title="High Density" />
            <div style={{ width: '10px', height: '10px', borderRadius: '3px', background: 'linear-gradient(135deg, #EC4899 0%, #F59E0B 100%)' }} title="Peak Surge" />
          </div>
          <span style={{ fontSize: '0.7rem', fontWeight: 600, color: '#F59E0B' }}>Peak Hotspot</span>
        </div>
      </div>

      {data.length === 0 ? (
        <EmptyState
          icon={Clock}
          title="No Heatmap Telemetry"
          message="No active session logs recorded for heatmap analysis in this window."
        />
      ) : (
        <div style={{ width: '100%', overflowX: 'auto' }}>
          {/* 24-Hour Timeline Header */}
          <div style={{ display: 'grid', gridTemplateColumns: '36px repeat(24, minmax(0, 1fr))', gap: '3px', marginBottom: '6px' }}>
            <div />
            {hours.map((h) => (
              <div key={h} style={{ fontSize: '0.6rem', color: 'var(--text-muted)', textAlign: 'center', fontWeight: 600 }}>
                {h < 10 ? `0${h}` : h}h
              </div>
            ))}
          </div>

          {/* Days Rows */}
          {days.map((day) => (
            <div key={day} style={{ display: 'grid', gridTemplateColumns: '36px repeat(24, minmax(0, 1fr))', gap: '3px', marginBottom: '4px', alignItems: 'center' }}>
              <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)' }}>{day}</span>
              {hours.map((h) => {
                const count = getCellCount(day, h);
                const styleObj = getIntensityStyle(count);
                return (
                  <div
                    key={h}
                    title={`${day} at ${h < 10 ? `0${h}` : h}:00 — ${count} active sessions`}
                    style={{
                      height: '22px',
                      borderRadius: '4px',
                      ...styleObj,
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
