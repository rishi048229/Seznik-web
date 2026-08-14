import React, { useState } from 'react';
import { Activity, Clock, Zap, Users, Calendar, Sparkles, Flame } from 'lucide-react';
import type { HeatmapCell, HeatmapResponse } from '../types/admin';
import { EmptyState } from './EmptyState';

interface PeakUsageHeatmapProps {
  data?: HeatmapCell[] | HeatmapResponse;
}

interface HoveredCellInfo {
  day: string;
  hour: number;
  count: number;
  uniqueUsers: number;
  x: number;
  y: number;
}

export const PeakUsageHeatmap: React.FC<PeakUsageHeatmapProps> = ({ data }) => {
  const [hoveredCell, setHoveredCell] = useState<HoveredCellInfo | null>(null);
  const [viewFilter, setViewFilter] = useState<'all' | 'business'>('all');

  // Normalize data whether passed as an array or HeatmapResponse object
  const cells: HeatmapCell[] = Array.isArray(data)
    ? data
    : data?.cells || [];

  const requestsToday = (!Array.isArray(data) && data?.requestsToday !== undefined)
    ? data.requestsToday
    : 0;

  const requestsThisHour = (!Array.isArray(data) && data?.requestsThisHour !== undefined)
    ? data.requestsThisHour
    : 0;

  const requestsThisWeek = (!Array.isArray(data) && data?.requestsThisWeek !== undefined)
    ? data.requestsThisWeek
    : cells.reduce((sum, c) => sum + c.count, 0);

  const currentWeekRange = (!Array.isArray(data) && data?.currentWeekRange)
    ? data.currentWeekRange
    : 'Current Active Week';

  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const fullHours = Array.from({ length: 24 }, (_, i) => i);
  const businessHours = Array.from({ length: 15 }, (_, i) => i + 8); // 08:00 to 22:00

  const activeHours = viewFilter === 'business' ? businessHours : fullHours;

  const getCellData = (day: string, hour: number) => {
    const cell = cells.find((c) => c.day === day && c.hour === hour);
    return {
      count: cell ? cell.count : 0,
      uniqueUsers: cell?.uniqueUsers ?? 0,
    };
  };

  const maxCount = Math.max(...cells.map((c) => c.count), 1);

  // Find the peak slot
  const peakSlot = [...cells].sort((a, b) => b.count - a.count)[0] || { day: 'Mon', hour: 12, count: 0 };

  const getIntensityStyle = (count: number) => {
    if (count === 0) {
      return {
        background: 'rgba(255, 255, 255, 0.02)',
        border: '1px solid var(--border-color)',
        boxShadow: 'none',
      };
    }
    const ratio = count / maxCount;
    if (ratio < 0.1) {
      return {
        background: 'rgba(59, 130, 246, 0.45)',
        border: '1px solid rgba(59, 130, 246, 0.7)',
        boxShadow: 'none',
      };
    }
    if (ratio < 0.35) {
      return {
        background: 'rgba(139, 92, 246, 0.75)',
        border: '1px solid rgba(139, 92, 246, 0.95)',
        boxShadow: '0 0 6px rgba(139, 92, 246, 0.3)',
      };
    }
    if (ratio < 0.7) {
      return {
        background: 'rgba(236, 72, 153, 0.88)',
        border: '1px solid rgba(236, 72, 153, 1)',
        boxShadow: '0 0 8px rgba(236, 72, 153, 0.4)',
      };
    }
    return {
      background: 'linear-gradient(135deg, #F43F5E 0%, #F59E0B 100%)',
      border: '1px solid #F43F5E',
      boxShadow: '0 0 12px rgba(244, 63, 94, 0.65)',
    };
  };

  const getStatusBadge = (count: number) => {
    if (count === 0) return { label: 'Quiet / No Traffic', color: 'var(--text-muted)' };
    const ratio = count / maxCount;
    if (ratio < 0.1) return { label: 'Low Traffic', color: '#60A5FA' };
    if (ratio < 0.35) return { label: 'Moderate Activity', color: '#A78BFA' };
    if (ratio < 0.7) return { label: 'High Traffic Volume', color: '#F472B6' };
    return { label: '🔥 Peak Traffic Surge', color: '#F59E0B' };
  };

  const formatHourLabel = (h: number) => {
    const period = h >= 12 ? 'PM' : 'AM';
    const displayH = h % 12 === 0 ? 12 : h % 12;
    return `${displayH} ${period}`;
  };

  const dayFullNames: Record<string, string> = {
    Mon: 'Monday',
    Tue: 'Tuesday',
    Wed: 'Wednesday',
    Thu: 'Thursday',
    Fri: 'Friday',
    Sat: 'Saturday',
    Sun: 'Sunday',
  };

  return (
    <div className="glass-card" style={{ padding: '22px', display: 'flex', flexDirection: 'column', gap: '18px', position: 'relative' }}>
      {/* 1. Top Section: Header & Live Metrics Badges */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div
              style={{
                width: '34px',
                height: '34px',
                borderRadius: '8px',
                background: 'linear-gradient(135deg, rgba(6, 182, 212, 0.2) 0%, rgba(59, 130, 246, 0.2) 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#06B6D4',
              }}
            >
              <Activity size={20} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-main)' }}>
                  24-Hour Peak Usage &amp; API Traffic Heatmap
                </h2>
                <span
                  style={{
                    fontSize: '0.72rem',
                    fontWeight: 600,
                    color: 'var(--accent-blue)',
                    background: 'rgba(59, 130, 246, 0.12)',
                    padding: '2px 8px',
                    borderRadius: '12px',
                    border: '1px solid rgba(59, 130, 246, 0.25)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  <Calendar size={11} />
                  {currentWeekRange}
                </span>
              </div>
            </div>
          </div>
          <p style={{ margin: '4px 0 0 0', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
            Live API requests made to backend across the current week (auto-refreshes each week).
          </p>
        </div>

        {/* 2 User-Requested Live Info Cards (Total API requests made today & API requests made this hour) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          {/* Card A: Total API Requests Made Today */}
          <div
            style={{
              background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.08) 0%, rgba(5, 150, 105, 0.03) 100%)',
              border: '1px solid rgba(16, 185, 129, 0.25)',
              borderRadius: '10px',
              padding: '8px 14px',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
            }}
          >
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                background: 'rgba(16, 185, 129, 0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#10B981',
              }}
            >
              <Zap size={17} />
            </div>
            <div>
              <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#10B981', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Total API Requests Today
              </div>
              <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-main)', lineHeight: '1.2' }}>
                {requestsToday.toLocaleString()} <span style={{ fontSize: '0.72rem', fontWeight: 500, color: 'var(--text-muted)' }}>calls</span>
              </div>
            </div>
          </div>

          {/* Card B: API Requests Made This Hour */}
          <div
            style={{
              background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.08) 0%, rgba(217, 119, 6, 0.03) 100%)',
              border: '1px solid rgba(245, 158, 11, 0.25)',
              borderRadius: '10px',
              padding: '8px 14px',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
            }}
          >
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                background: 'rgba(245, 158, 11, 0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#F59E0B',
              }}
            >
              <Flame size={17} />
            </div>
            <div>
              <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#F59E0B', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                API Requests This Hour
              </div>
              <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-main)', lineHeight: '1.2' }}>
                {requestsThisHour.toLocaleString()} <span style={{ fontSize: '0.72rem', fontWeight: 500, color: 'var(--text-muted)' }}>calls</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Controls Bar: Time Filter & Color Legend */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px', borderTop: '1px solid var(--border-color)', paddingTop: '10px' }}>
        {/* Time View Filter */}
        <div
          style={{
            display: 'inline-flex',
            background: 'var(--bg-main)',
            padding: '2px',
            borderRadius: '8px',
            border: '1px solid var(--border-color)',
          }}
        >
          <button
            onClick={() => setViewFilter('all')}
            style={{
              padding: '4px 10px',
              borderRadius: '6px',
              border: 'none',
              background: viewFilter === 'all' ? 'var(--accent-blue)' : 'transparent',
              color: viewFilter === 'all' ? '#FFFFFF' : 'var(--text-muted)',
              fontSize: '0.74rem',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            24 Hours (Full Day)
          </button>
          <button
            onClick={() => setViewFilter('business')}
            style={{
              padding: '4px 10px',
              borderRadius: '6px',
              border: 'none',
              background: viewFilter === 'business' ? 'var(--accent-blue)' : 'transparent',
              color: viewFilter === 'business' ? '#FFFFFF' : 'var(--text-muted)',
              fontSize: '0.74rem',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            Business Hours (08:00 - 22:00)
          </button>
        </div>

        {/* Color Code Legend */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.72rem', color: 'var(--text-muted)', background: 'var(--bg-main)', padding: '5px 10px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
          <span style={{ fontSize: '0.68rem', fontWeight: 600 }}>Quiet (0)</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
            <div style={{ width: '9px', height: '9px', borderRadius: '2px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-color)' }} title="0 requests" />
            <div style={{ width: '9px', height: '9px', borderRadius: '2px', background: 'rgba(59, 130, 246, 0.45)' }} title="Low Density" />
            <div style={{ width: '9px', height: '9px', borderRadius: '2px', background: 'rgba(139, 92, 246, 0.75)' }} title="Moderate Density" />
            <div style={{ width: '9px', height: '9px', borderRadius: '2px', background: 'rgba(236, 72, 153, 0.88)' }} title="High Density" />
            <div style={{ width: '9px', height: '9px', borderRadius: '2px', background: 'linear-gradient(135deg, #F43F5E 0%, #F59E0B 100%)' }} title="Peak Surge" />
          </div>
          <span style={{ fontSize: '0.68rem', fontWeight: 700, color: '#F59E0B' }}>Peak Hotspot</span>
        </div>
      </div>

      {cells.length === 0 ? (
        <EmptyState
          icon={Clock}
          title="No Heatmap Telemetry"
          message="No active API traffic recorded for heatmap analysis in this window."
        />
      ) : (
        <div style={{ width: '100%', overflowX: 'auto', paddingBottom: '4px' }}>
          {/* Hour Labels Header */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: `42px repeat(${activeHours.length}, minmax(0, 1fr))`,
              gap: '4px',
              marginBottom: '6px',
            }}
          >
            <div />
            {activeHours.map((h) => (
              <div
                key={h}
                style={{
                  fontSize: '0.62rem',
                  color: 'var(--text-muted)',
                  textAlign: 'center',
                  fontWeight: 600,
                  userSelect: 'none',
                }}
              >
                {h < 10 ? `0${h}` : h}h
              </div>
            ))}
          </div>

          {/* Days Grid Rows */}
          {days.map((day) => (
            <div
              key={day}
              style={{
                display: 'grid',
                gridTemplateColumns: `42px repeat(${activeHours.length}, minmax(0, 1fr))`,
                gap: '4px',
                marginBottom: '4px',
                alignItems: 'center',
              }}
            >
              <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', userSelect: 'none' }}>
                {day}
              </span>
              {activeHours.map((h) => {
                const { count, uniqueUsers } = getCellData(day, h);
                const styleObj = getIntensityStyle(count);
                const isHovered = hoveredCell?.day === day && hoveredCell?.hour === h;

                return (
                  <div
                    key={h}
                    onMouseEnter={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      setHoveredCell({
                        day,
                        hour: h,
                        count,
                        uniqueUsers,
                        x: rect.left + rect.width / 2,
                        y: rect.top,
                      });
                    }}
                    onMouseLeave={() => setHoveredCell(null)}
                    style={{
                      height: '24px',
                      borderRadius: '5px',
                      ...styleObj,
                      transform: isHovered ? 'scale(1.22)' : 'scale(1)',
                      zIndex: isHovered ? 20 : 1,
                      outline: isHovered ? '2px solid #FFFFFF' : 'none',
                      transition: 'all 0.15s cubic-bezier(0.4, 0, 0.2, 1)',
                      cursor: 'pointer',
                      width: '100%',
                      boxSizing: 'border-box',
                    }}
                  />
                );
              })}
            </div>
          ))}
        </div>
      )}

      {/* Floating Interactive Hover Tooltip */}
      {hoveredCell && (
        <div
          style={{
            position: 'fixed',
            left: `${hoveredCell.x}px`,
            top: `${hoveredCell.y - 12}px`,
            transform: 'translate(-50%, -100%)',
            background: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.35)',
            borderRadius: '10px',
            padding: '10px 14px',
            pointerEvents: 'none',
            zIndex: 9999,
            minWidth: '200px',
            backdropFilter: 'blur(12px)',
          }}
        >
          {/* Tooltip Header: Day & Hour */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', borderBottom: '1px solid var(--border-color)', paddingBottom: '6px', marginBottom: '6px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontWeight: 700, fontSize: '0.78rem', color: 'var(--text-main)' }}>
              <Calendar size={13} color="var(--accent-blue)" />
              <span>{dayFullNames[hoveredCell.day] || hoveredCell.day}</span>
            </div>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 }}>
              {formatHourLabel(hoveredCell.hour)} - {formatHourLabel((hoveredCell.hour + 1) % 24)}
            </span>
          </div>

          {/* Tooltip Body: API Requests Count */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
              <span style={{ fontSize: '1.25rem', fontWeight: 800, color: hoveredCell.count > 0 ? '#10B981' : 'var(--text-muted)' }}>
                {hoveredCell.count.toLocaleString()}
              </span>
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                API Requests to Backend
              </span>
            </div>

            {/* Unique Active Merchants */}
            {hoveredCell.uniqueUsers > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                <Users size={12} color="var(--accent-blue)" />
                <span>{hoveredCell.uniqueUsers} distinct merchant{hoveredCell.uniqueUsers > 1 ? 's' : ''} active</span>
              </div>
            )}

            {/* Activity Status Badge */}
            <div style={{ marginTop: '3px' }}>
              <span
                style={{
                  fontSize: '0.68rem',
                  fontWeight: 700,
                  color: getStatusBadge(hoveredCell.count).color,
                  background: 'rgba(255, 255, 255, 0.04)',
                  padding: '2px 6px',
                  borderRadius: '4px',
                  border: '1px solid var(--border-color)',
                  display: 'inline-block',
                }}
              >
                {getStatusBadge(hoveredCell.count).label}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Heatmap Telemetry Summary Bar */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '12px',
          paddingTop: '12px',
          borderTop: '1px solid var(--border-color)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(59, 130, 246, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3B82F6' }}>
            <Sparkles size={16} />
          </div>
          <div>
            <div style={{ fontSize: '0.68rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              This Week's API Requests
            </div>
            <div style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-main)' }}>
              {requestsThisWeek.toLocaleString()} <span style={{ fontSize: '0.72rem', fontWeight: 500, color: 'var(--text-muted)' }}>calls</span>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(245, 158, 11, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#F59E0B' }}>
            <Clock size={16} />
          </div>
          <div>
            <div style={{ fontSize: '0.68rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Peak Traffic Slot
            </div>
            <div style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-main)' }}>
              {dayFullNames[peakSlot.day] || peakSlot.day} @ {formatHourLabel(peakSlot.hour)} ({peakSlot.count.toLocaleString()} calls)
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(16, 185, 129, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#10B981' }}>
            <Activity size={16} />
          </div>
          <div>
            <div style={{ fontSize: '0.68rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Telemetry Status
            </div>
            <div style={{ fontSize: '1rem', fontWeight: 800, color: '#10B981', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span className="pulse-dot" style={{ width: '6px', height: '6px' }}></span> Live RDS Postgres
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
