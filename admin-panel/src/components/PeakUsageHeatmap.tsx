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
  const peakSlot = [...cells].sort((a, b) => b.count - a.count)[0] || { day: 'Mon', hour: 12, count: 0 };

  const getIntensityStyle = (count: number) => {
    if (count === 0) {
      return {
        background: 'rgba(255, 255, 255, 0.025)',
        border: '1px solid var(--border-color)',
        boxShadow: 'none',
      };
    }
    const ratio = count / maxCount;
    if (ratio < 0.1) {
      return {
        background: 'rgba(16, 185, 129, 0.55)',
        border: '1px solid rgba(16, 185, 129, 0.8)',
        boxShadow: 'none',
      };
    }
    if (ratio < 0.35) {
      return {
        background: 'rgba(234, 179, 8, 0.75)',
        border: '1px solid rgba(234, 179, 8, 0.95)',
        boxShadow: '0 0 6px rgba(234, 179, 8, 0.35)',
      };
    }
    if (ratio < 0.7) {
      return {
        background: 'rgba(249, 115, 22, 0.85)',
        border: '1px solid rgba(249, 115, 22, 1)',
        boxShadow: '0 0 8px rgba(249, 115, 22, 0.45)',
      };
    }
    return {
      background: 'linear-gradient(135deg, #EF4444 0%, #DC2626 100%)',
      border: '1px solid #EF4444',
      boxShadow: '0 0 10px rgba(239, 68, 68, 0.65)',
    };
  };

  const getStatusBadge = (count: number) => {
    if (count === 0) return { label: 'Quiet / No Traffic', color: 'var(--text-muted)' };
    const ratio = count / maxCount;
    if (ratio < 0.1) return { label: 'Low Activity', color: '#10B981' };
    if (ratio < 0.35) return { label: 'Moderate Activity', color: '#EAB308' };
    if (ratio < 0.7) return { label: 'High Activity Volume', color: '#F97316' };
    return { label: '🔥 Peak Hotspot Surge', color: '#EF4444' };
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
    <div 
      className="glass-card" 
      style={{ 
        padding: '18px 22px', 
        display: 'flex', 
        flexDirection: 'column', 
        justifyContent: 'space-between',
        height: '100%', 
        minHeight: 0,
        boxSizing: 'border-box',
        position: 'relative',
        flex: 1,
      }}
    >
      {/* 1. Header & Live Metrics Badges */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              background: 'linear-gradient(135deg, rgba(6, 182, 212, 0.2) 0%, rgba(59, 130, 246, 0.2) 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#06B6D4',
            }}
          >
            <Activity size={18} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h3 style={{ margin: 0, fontSize: '1.08rem', fontWeight: 700, color: 'var(--text-main)' }}>
                24-Hour Peak Usage &amp; API Heatmap
              </h3>
              <span
                style={{
                  fontSize: '0.72rem',
                  fontWeight: 600,
                  color: 'var(--accent-blue)',
                  background: 'rgba(59, 130, 246, 0.1)',
                  padding: '2px 8px',
                  borderRadius: '10px',
                  border: '1px solid rgba(59, 130, 246, 0.2)',
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

        {/* 2 User-Requested Live Info Cards (Today & This Hour) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {/* Card A: Today */}
          <div
            style={{
              background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.1) 0%, rgba(5, 150, 105, 0.04) 100%)',
              border: '1px solid rgba(16, 185, 129, 0.25)',
              borderRadius: '8px',
              padding: '6px 12px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <Zap size={15} color="#10B981" />
            <div>
              <span style={{ fontSize: '0.66rem', fontWeight: 700, color: '#10B981', textTransform: 'uppercase' }}>Today: </span>
              <span style={{ fontSize: '0.98rem', fontWeight: 800, color: 'var(--text-main)' }}>{requestsToday.toLocaleString()}</span>
            </div>
          </div>

          {/* Card B: This Hour */}
          <div
            style={{
              background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.1) 0%, rgba(217, 119, 6, 0.04) 100%)',
              border: '1px solid rgba(245, 158, 11, 0.25)',
              borderRadius: '8px',
              padding: '6px 12px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <Flame size={15} color="#F59E0B" />
            <div>
              <span style={{ fontSize: '0.66rem', fontWeight: 700, color: '#F59E0B', textTransform: 'uppercase' }}>This Hour: </span>
              <span style={{ fontSize: '0.98rem', fontWeight: 800, color: 'var(--text-main)' }}>{requestsThisHour.toLocaleString()}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Controls Bar: Time Filter & Color Legend */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px', borderTop: '1px solid var(--border-color)', paddingTop: '8px', flexShrink: 0 }}>
        {/* Time View Filter */}
        <div
          style={{
            display: 'inline-flex',
            background: 'var(--bg-main)',
            padding: '2px',
            borderRadius: '6px',
            border: '1px solid var(--border-color)',
          }}
        >
          <button
            onClick={() => setViewFilter('all')}
            style={{
              padding: '4px 10px',
              borderRadius: '4px',
              border: 'none',
              background: viewFilter === 'all' ? 'var(--accent-blue)' : 'transparent',
              color: viewFilter === 'all' ? '#FFFFFF' : 'var(--text-muted)',
              fontSize: '0.72rem',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            24 Hours
          </button>
          <button
            onClick={() => setViewFilter('business')}
            style={{
              padding: '4px 10px',
              borderRadius: '4px',
              border: 'none',
              background: viewFilter === 'business' ? 'var(--accent-blue)' : 'transparent',
              color: viewFilter === 'business' ? '#FFFFFF' : 'var(--text-muted)',
              fontSize: '0.72rem',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            Business Hours (08:00 - 22:00)
          </button>
        </div>

        {/* Color Code Legend */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.68rem', color: 'var(--text-muted)', background: 'var(--bg-main)', padding: '4px 10px', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
          <span style={{ fontSize: '0.65rem', fontWeight: 600 }}>Quiet (0)</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '2px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-color)' }} title="0 requests (Quiet)" />
            <div style={{ width: '8px', height: '8px', borderRadius: '2px', background: 'rgba(16, 185, 129, 0.6)' }} title="Low (1-10)" />
            <div style={{ width: '8px', height: '8px', borderRadius: '2px', background: 'rgba(234, 179, 8, 0.8)' }} title="Moderate (11-50)" />
            <div style={{ width: '8px', height: '8px', borderRadius: '2px', background: 'rgba(249, 115, 22, 0.9)' }} title="High (51-200)" />
            <div style={{ width: '8px', height: '8px', borderRadius: '2px', background: 'linear-gradient(135deg, #EF4444 0%, #DC2626 100%)' }} title="Peak Hotspot (>200)" />
          </div>
          <span style={{ fontSize: '0.65rem', fontWeight: 700, color: '#EF4444' }}>Peak Hotspot</span>
        </div>
      </div>

      {cells.length === 0 ? (
        <EmptyState
          icon={Clock}
          title="No Heatmap Telemetry"
          message="No active API traffic recorded for heatmap analysis in this window."
        />
      ) : (
        <div style={{ width: '100%', overflowX: 'auto', flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', justifyContent: 'space-around', margin: '6px 0' }}>
          {/* Hour Labels Header */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: `38px repeat(${activeHours.length}, minmax(0, 1fr))`,
              gap: '3px',
              marginBottom: '4px',
              flexShrink: 0,
            }}
          >
            <div />
            {activeHours.map((h) => (
              <div
                key={h}
                style={{
                  fontSize: '0.64rem',
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

          {/* Days Grid Rows (Distributing evenly across available height) */}
          {days.map((day) => (
            <div
              key={day}
              style={{
                display: 'grid',
                gridTemplateColumns: `38px repeat(${activeHours.length}, minmax(0, 1fr))`,
                gap: '3px',
                alignItems: 'stretch',
                flex: 1,
                minHeight: '25px',
                margin: '2px 0',
              }}
            >
              <span style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--text-muted)', userSelect: 'none', display: 'flex', alignItems: 'center' }}>
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
                      height: '100%',
                      minHeight: '25px',
                      borderRadius: '4px',
                      ...styleObj,
                      transform: isHovered ? 'scale(1.22)' : 'scale(1)',
                      zIndex: isHovered ? 20 : 1,
                      outline: isHovered ? '2px solid #FFFFFF' : 'none',
                      transition: 'all 0.12s ease',
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
            top: `${hoveredCell.y - 8}px`,
            transform: 'translate(-50%, -100%)',
            background: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)',
            borderRadius: '8px',
            padding: '8px 12px',
            pointerEvents: 'none',
            zIndex: 9999,
            minWidth: '180px',
            backdropFilter: 'blur(12px)',
          }}
        >
          {/* Tooltip Header: Day & Hour */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px', borderBottom: '1px solid var(--border-color)', paddingBottom: '4px', marginBottom: '4px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 700, fontSize: '0.75rem', color: 'var(--text-main)' }}>
              <Calendar size={12} color="var(--accent-blue)" />
              <span>{dayFullNames[hoveredCell.day] || hoveredCell.day}</span>
            </div>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600 }}>
              {formatHourLabel(hoveredCell.hour)} - {formatHourLabel((hoveredCell.hour + 1) % 24)}
            </span>
          </div>

          {/* Tooltip Body: API Requests Count */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '5px' }}>
              <span style={{ fontSize: '1.15rem', fontWeight: 800, color: hoveredCell.count > 0 ? '#10B981' : 'var(--text-muted)' }}>
                {hoveredCell.count.toLocaleString()}
              </span>
              <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                API Requests
              </span>
            </div>

            {/* Unique Active Merchants */}
            {hoveredCell.uniqueUsers > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                <Users size={11} color="var(--accent-blue)" />
                <span>{hoveredCell.uniqueUsers} distinct merchant{hoveredCell.uniqueUsers > 1 ? 's' : ''}</span>
              </div>
            )}

            {/* Activity Status Badge */}
            <div style={{ marginTop: '2px' }}>
              <span
                style={{
                  fontSize: '0.64rem',
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
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingTop: '6px',
          borderTop: '1px solid var(--border-color)',
          fontSize: '0.72rem',
          color: 'var(--text-muted)',
          flexWrap: 'wrap',
          gap: '8px',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <Sparkles size={13} color="#3B82F6" />
          <span>Week Total: <strong style={{ color: 'var(--text-main)' }}>{requestsThisWeek.toLocaleString()}</strong> calls</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <Clock size={13} color="#F59E0B" />
          <span>Peak: <strong style={{ color: 'var(--text-main)' }}>{dayFullNames[peakSlot.day] || peakSlot.day} @ {formatHourLabel(peakSlot.hour)}</strong></span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span className="pulse-dot" style={{ width: '5px', height: '5px' }}></span>
          <span style={{ color: '#10B981', fontWeight: 600 }}>Live Postgres</span>
        </div>
      </div>
    </div>
  );
};
