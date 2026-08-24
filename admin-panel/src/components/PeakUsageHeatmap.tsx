import React, { useState, useMemo, useEffect } from 'react';
import { Activity, Clock, Calendar, Palette, RefreshCw } from 'lucide-react';
import type { HeatmapCell, HeatmapResponse } from '../types/admin';
import { fetchHeatmapData } from '../services/api';
import { EmptyState } from './EmptyState';

interface PeakUsageHeatmapProps {
  data?: HeatmapCell[] | HeatmapResponse;
  globalTimeRange?: string;
  lastRefreshedAt?: string;
}

interface HoveredCellInfo {
  date: string;
  day: string;
  hour: number;
  count: number;
  uniqueUsers: number;
  x: number;
  y: number;
}

export type HeatmapPalette = 'traffic' | 'cyber' | 'ocean' | 'github' | 'inferno';

const IST_TIMEZONE = 'Asia/Kolkata';

function parseIstDateKey(dateKey: string): Date {
  return new Date(`${dateKey}T12:00:00+05:30`);
}

function formatIstDateParts(dateKey: string) {
  const d = parseIstDateKey(dateKey);
  return {
    dayAbbr: d.toLocaleDateString('en-IN', { weekday: 'short', timeZone: IST_TIMEZONE }),
    dayNum: d.toLocaleDateString('en-IN', { day: 'numeric', timeZone: IST_TIMEZONE }),
    fullDate: d.toLocaleDateString('en-IN', {
      weekday: 'long',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      timeZone: IST_TIMEZONE,
    }),
  };
}

function getIstClockParts() {
  const now = new Date();
  const date = now.toLocaleDateString('en-CA', { timeZone: IST_TIMEZONE });
  const time = now.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    timeZone: IST_TIMEZONE,
  });
  const hour = Number(
    now.toLocaleString('en-IN', { hour: 'numeric', hour12: false, timeZone: IST_TIMEZONE })
  );
  return { date, time, hour };
}

interface PaletteOption {
  id: HeatmapPalette;
  name: string;
  swatches: [string, string, string, string, string];
  getIntensity: (count: number, maxCount: number) => { background: string; border: string; boxShadow: string };
  getStatusBadge: (count: number, maxCount: number) => { label: string; color: string };
}

const PALETTES: Record<HeatmapPalette, PaletteOption> = {
  traffic: {
    id: 'traffic',
    name: 'Traffic Light (Green → Red)',
    swatches: [
      'rgba(255,255,255,0.05)',
      'rgba(16, 185, 129, 0.75)',
      'rgba(234, 179, 8, 0.85)',
      'rgba(249, 115, 22, 0.9)',
      '#EF4444',
    ],
    getIntensity: (count, maxCount) => {
      if (count === 0) return { background: 'rgba(255, 255, 255, 0.025)', border: '1px solid var(--border-color)', boxShadow: 'none' };
      const ratio = count / maxCount;
      if (ratio < 0.1) return { background: 'rgba(16, 185, 129, 0.55)', border: '1px solid rgba(16, 185, 129, 0.8)', boxShadow: 'none' };
      if (ratio < 0.35) return { background: 'rgba(234, 179, 8, 0.75)', border: '1px solid rgba(234, 179, 8, 0.95)', boxShadow: '0 0 6px rgba(234, 179, 8, 0.35)' };
      if (ratio < 0.7) return { background: 'rgba(249, 115, 22, 0.85)', border: '1px solid rgba(249, 115, 22, 1)', boxShadow: '0 0 8px rgba(249, 115, 22, 0.45)' };
      return { background: 'linear-gradient(135deg, #EF4444 0%, #DC2626 100%)', border: '1px solid #EF4444', boxShadow: '0 0 10px rgba(239, 68, 68, 0.65)' };
    },
    getStatusBadge: (count, maxCount) => {
      if (count === 0) return { label: 'Quiet / No Traffic', color: 'var(--text-muted)' };
      const ratio = count / maxCount;
      if (ratio < 0.1) return { label: 'Low Activity', color: '#10B981' };
      if (ratio < 0.35) return { label: 'Moderate Activity', color: '#EAB308' };
      if (ratio < 0.7) return { label: 'High Activity Volume', color: '#F97316' };
      return { label: 'Peak Hotspot Surge', color: '#EF4444' };
    },
  },
  cyber: {
    id: 'cyber',
    name: 'Cyber Neon (Cyan → Purple)',
    swatches: [
      'rgba(255,255,255,0.05)',
      'rgba(6, 182, 212, 0.75)',
      'rgba(139, 92, 246, 0.85)',
      'rgba(236, 72, 153, 0.9)',
      '#F59E0B',
    ],
    getIntensity: (count, maxCount) => {
      if (count === 0) return { background: 'rgba(255, 255, 255, 0.025)', border: '1px solid var(--border-color)', boxShadow: 'none' };
      const ratio = count / maxCount;
      if (ratio < 0.1) return { background: 'rgba(6, 182, 212, 0.55)', border: '1px solid rgba(6, 182, 212, 0.8)', boxShadow: 'none' };
      if (ratio < 0.35) return { background: 'rgba(139, 92, 246, 0.75)', border: '1px solid rgba(139, 92, 246, 0.95)', boxShadow: '0 0 6px rgba(139, 92, 246, 0.35)' };
      if (ratio < 0.7) return { background: 'rgba(236, 72, 153, 0.85)', border: '1px solid rgba(236, 72, 153, 1)', boxShadow: '0 0 8px rgba(236, 72, 153, 0.45)' };
      return { background: 'linear-gradient(135deg, #F43F5E 0%, #F59E0B 100%)', border: '1px solid #F43F5E', boxShadow: '0 0 10px rgba(244, 63, 94, 0.65)' };
    },
    getStatusBadge: (count, maxCount) => {
      if (count === 0) return { label: 'Quiet / No Traffic', color: 'var(--text-muted)' };
      const ratio = count / maxCount;
      if (ratio < 0.1) return { label: 'Low Activity', color: '#06B6D4' };
      if (ratio < 0.35) return { label: 'Moderate Activity', color: '#8B5CF6' };
      if (ratio < 0.7) return { label: 'High Activity Volume', color: '#EC4899' };
      return { label: 'Cyber Peak Surge', color: '#F59E0B' };
    },
  },
  ocean: {
    id: 'ocean',
    name: 'Ocean Cobalt (Blue → Indigo)',
    swatches: [
      'rgba(255,255,255,0.05)',
      'rgba(56, 189, 248, 0.75)',
      'rgba(59, 130, 246, 0.85)',
      'rgba(99, 102, 241, 0.9)',
      '#8B5CF6',
    ],
    getIntensity: (count, maxCount) => {
      if (count === 0) return { background: 'rgba(255, 255, 255, 0.025)', border: '1px solid var(--border-color)', boxShadow: 'none' };
      const ratio = count / maxCount;
      if (ratio < 0.1) return { background: 'rgba(56, 189, 248, 0.55)', border: '1px solid rgba(56, 189, 248, 0.8)', boxShadow: 'none' };
      if (ratio < 0.35) return { background: 'rgba(59, 130, 246, 0.75)', border: '1px solid rgba(59, 130, 246, 0.95)', boxShadow: '0 0 6px rgba(59, 130, 246, 0.35)' };
      if (ratio < 0.7) return { background: 'rgba(99, 102, 241, 0.85)', border: '1px solid rgba(99, 102, 241, 1)', boxShadow: '0 0 8px rgba(99, 102, 241, 0.45)' };
      return { background: 'linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%)', border: '1px solid #8B5CF6', boxShadow: '0 0 10px rgba(139, 92, 246, 0.65)' };
    },
    getStatusBadge: (count, maxCount) => {
      if (count === 0) return { label: 'Quiet / No Traffic', color: 'var(--text-muted)' };
      const ratio = count / maxCount;
      if (ratio < 0.1) return { label: 'Low Activity', color: '#38BDF8' };
      if (ratio < 0.35) return { label: 'Moderate Activity', color: '#3B82F6' };
      if (ratio < 0.7) return { label: 'High Activity Volume', color: '#6366F1' };
      return { label: 'Ocean Peak Wave', color: '#8B5CF6' };
    },
  },
  github: {
    id: 'github',
    name: 'GitHub Matrix (Monochrome Green)',
    swatches: [
      'rgba(255,255,255,0.05)',
      'rgba(34, 197, 94, 0.45)',
      'rgba(22, 163, 74, 0.75)',
      'rgba(21, 128, 61, 0.9)',
      '#4ADE80',
    ],
    getIntensity: (count, maxCount) => {
      if (count === 0) return { background: 'rgba(255, 255, 255, 0.025)', border: '1px solid var(--border-color)', boxShadow: 'none' };
      const ratio = count / maxCount;
      if (ratio < 0.1) return { background: 'rgba(34, 197, 94, 0.45)', border: '1px solid rgba(34, 197, 94, 0.7)', boxShadow: 'none' };
      if (ratio < 0.35) return { background: 'rgba(22, 163, 74, 0.75)', border: '1px solid rgba(22, 163, 74, 0.9)', boxShadow: '0 0 6px rgba(22, 163, 74, 0.35)' };
      if (ratio < 0.7) return { background: 'rgba(21, 128, 61, 0.9)', border: '1px solid rgba(34, 197, 94, 0.95)', boxShadow: '0 0 8px rgba(34, 197, 94, 0.45)' };
      return { background: 'linear-gradient(135deg, #15803D 0%, #4ADE80 100%)', border: '1px solid #4ADE80', boxShadow: '0 0 10px rgba(74, 222, 128, 0.65)' };
    },
    getStatusBadge: (count, maxCount) => {
      if (count === 0) return { label: 'Quiet / No Traffic', color: 'var(--text-muted)' };
      const ratio = count / maxCount;
      if (ratio < 0.1) return { label: 'Low Activity', color: '#86EFAC' };
      if (ratio < 0.35) return { label: 'Moderate Activity', color: '#22C55E' };
      if (ratio < 0.7) return { label: 'High Activity Volume', color: '#16A34A' };
      return { label: 'Matrix Peak Activity', color: '#4ADE80' };
    },
  },
  inferno: {
    id: 'inferno',
    name: 'Solar Inferno (Gold → Crimson)',
    swatches: [
      'rgba(255,255,255,0.05)',
      'rgba(251, 191, 36, 0.75)',
      'rgba(249, 115, 22, 0.85)',
      'rgba(244, 63, 94, 0.9)',
      '#DC2626',
    ],
    getIntensity: (count, maxCount) => {
      if (count === 0) return { background: 'rgba(255, 255, 255, 0.025)', border: '1px solid var(--border-color)', boxShadow: 'none' };
      const ratio = count / maxCount;
      if (ratio < 0.1) return { background: 'rgba(251, 191, 36, 0.55)', border: '1px solid rgba(251, 191, 36, 0.8)', boxShadow: 'none' };
      if (ratio < 0.35) return { background: 'rgba(249, 115, 22, 0.75)', border: '1px solid rgba(249, 115, 22, 0.95)', boxShadow: '0 0 6px rgba(249, 115, 22, 0.35)' };
      if (ratio < 0.7) return { background: 'rgba(244, 63, 94, 0.85)', border: '1px solid rgba(244, 63, 94, 1)', boxShadow: '0 0 8px rgba(244, 63, 94, 0.45)' };
      return { background: 'linear-gradient(135deg, #EF4444 0%, #991B1B 100%)', border: '1px solid #EF4444', boxShadow: '0 0 10px rgba(239, 68, 68, 0.65)' };
    },
    getStatusBadge: (count, maxCount) => {
      if (count === 0) return { label: 'Quiet / No Traffic', color: 'var(--text-muted)' };
      const ratio = count / maxCount;
      if (ratio < 0.1) return { label: 'Low Activity', color: '#FBBF24' };
      if (ratio < 0.35) return { label: 'Moderate Activity', color: '#F97316' };
      if (ratio < 0.7) return { label: 'High Activity Volume', color: '#F43F5E' };
      return { label: 'Inferno Hotspot Surge', color: '#EF4444' };
    },
  },
};

export const PeakUsageHeatmap: React.FC<PeakUsageHeatmapProps> = ({
  data,
  globalTimeRange = '7d',
  lastRefreshedAt,
}) => {
  const [hoveredCell, setHoveredCell] = useState<HoveredCellInfo | null>(null);
  const [viewFilter, setViewFilter] = useState<'all' | 'business'>('all');
  const [viewTodayOnly, setViewTodayOnly] = useState(false);
  const [todayData, setTodayData] = useState<HeatmapResponse | null>(null);
  const [todayLoading, setTodayLoading] = useState(false);
  const [todayError, setTodayError] = useState<string | null>(null);
  const [paletteId, setPaletteId] = useState<HeatmapPalette>(() => {
    return (localStorage.getItem('seznik_heatmap_palette') as HeatmapPalette) || 'traffic';
  });
  const [istClock, setIstClock] = useState(() => getIstClockParts());

  const activePalette = PALETTES[paletteId] || PALETTES.traffic;

  useEffect(() => {
    const timer = setInterval(() => setIstClock(getIstClockParts()), 30_000);
    return () => clearInterval(timer);
  }, []);

  const handlePaletteChange = (newPalette: HeatmapPalette) => {
    setPaletteId(newPalette);
    localStorage.setItem('seznik_heatmap_palette', newPalette);
  };

  // Live fetch for "Today Only" — calendar today in IST from API
  useEffect(() => {
    if (!viewTodayOnly) {
      setTodayData(null);
      setTodayError(null);
      return;
    }

    let cancelled = false;
    setTodayLoading(true);
    setTodayError(null);

    fetchHeatmapData('today')
      .then((result) => {
        if (!cancelled) {
          setTodayData(result);
          setTodayError(null);
        }
      })
      .catch((err: Error) => {
        if (!cancelled) {
          setTodayError(err?.message || 'Failed to load today\'s heatmap');
          setTodayData(null);
        }
      })
      .finally(() => {
        if (!cancelled) setTodayLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [viewTodayOnly, lastRefreshedAt]);

  const activeData: HeatmapCell[] | HeatmapResponse | undefined = viewTodayOnly
    ? todayData ?? undefined
    : data;

  const cells: HeatmapCell[] = Array.isArray(activeData)
    ? activeData
    : activeData?.cells || [];

  const requestsToday = (!Array.isArray(activeData) && activeData?.requestsToday !== undefined)
    ? activeData.requestsToday
    : 0;

  const requestsThisHour = (!Array.isArray(activeData) && activeData?.requestsThisHour !== undefined)
    ? activeData.requestsThisHour
    : 0;

  const currentWeekRange = (!Array.isArray(activeData) && activeData?.currentWeekRange)
    ? activeData.currentWeekRange
    : viewTodayOnly
      ? 'Today (IST)'
      : 'Current Active Week';

  const fullHours = Array.from({ length: 24 }, (_, i) => i);
  const businessHours = Array.from({ length: 15 }, (_, i) => i + 8); // 08:00 to 22:00

  const activeHours = viewFilter === 'business' ? businessHours : fullHours;

  // Build one row per actual calendar date returned by the API (IST, rolling window)
  const rowDates = useMemo(() => {
    const todayIst = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
    const seen = new Set<string>();
    const ordered: string[] = [];
    cells.forEach((c) => {
      const key = c.date || c.day;
      if (key && !seen.has(key)) {
        seen.add(key);
        ordered.push(key);
      }
    });
    return ordered.map((dateKey) => {
      const isIsoDate = /^\d{4}-\d{2}-\d{2}$/.test(dateKey);
      if (!isIsoDate) {
        return {
          date: dateKey,
          dayAbbr: dateKey,
          dayNum: '',
          fullDate: dateKey,
          isToday: false,
        };
      }
      const { dayAbbr, dayNum, fullDate } = formatIstDateParts(dateKey);
      return {
        date: dateKey,
        dayAbbr,
        dayNum,
        fullDate: `${fullDate} IST`,
        isToday: dateKey === todayIst,
      };
    });
  }, [cells]);

  const weekDateRangeStr = useMemo(() => {
    if (currentWeekRange && currentWeekRange.includes('–')) {
      return currentWeekRange;
    }
    const first = rowDates[0]?.date;
    const last = rowDates[rowDates.length - 1]?.date;
    if (first && last) return `${first} – ${last}`;
    return currentWeekRange;
  }, [rowDates, currentWeekRange]);

  const getCellData = (date: string, hour: number) => {
    const cell = cells.find((c) => (c.date || c.day) === date && c.hour === hour);
    return {
      count: cell ? cell.count : 0,
      uniqueUsers: cell?.uniqueUsers ?? 0,
    };
  };

  const maxCount = Math.max(...cells.map((c) => c.count), 1);

  const formatHourLabel = (h: number) => {
    const period = h >= 12 ? 'PM' : 'AM';
    const displayH = h % 12 === 0 ? 12 : h % 12;
    return `${displayH} ${period} IST`;
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
              {!viewTodayOnly && (
                <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 500 }}>
                  ({globalTimeRange === '24h' ? 'Last 24h' : globalTimeRange === '7d' ? 'Last 7 days' : globalTimeRange === '30d' ? 'Last 30 days' : globalTimeRange === 'all' ? 'All time' : globalTimeRange} · IST)
                </span>
              )}
              {viewTodayOnly && (
                <span style={{ fontSize: '0.68rem', color: '#10B981', fontWeight: 600 }}>
                  (Today · IST)
                </span>
              )}
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
                {weekDateRangeStr}
              </span>
            </div>
          </div>
        </div>

        {/* 2 Live Info Cards (Today & This Hour) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {/* Card A: Today */}
          <div
            style={{
              background: 'var(--bg-main)',
              border: '1px solid var(--border-color)',
              borderRadius: '8px',
              padding: '5px 12px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <span style={{ fontSize: '0.68rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Today:</span>
            <span style={{ fontSize: '0.92rem', fontWeight: 800, color: 'var(--text-main)', fontFamily: 'monospace' }}>{requestsToday.toLocaleString()}</span>
          </div>

          {/* Card B: This Hour */}
          <div
            style={{
              background: 'var(--bg-main)',
              border: '1px solid var(--border-color)',
              borderRadius: '8px',
              padding: '5px 12px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <span style={{ fontSize: '0.68rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>This Hour:</span>
            <span style={{ fontSize: '0.92rem', fontWeight: 800, color: 'var(--text-main)', fontFamily: 'monospace' }}>{requestsThisHour.toLocaleString()}</span>
          </div>
        </div>
      </div>

      {/* Controls Bar: Time Filter, Palette Switcher & Dynamic Legend */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px', borderTop: '1px solid var(--border-color)', paddingTop: '8px', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          {/* Date scope: full navbar range vs today only (live API) */}
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
              onClick={() => setViewTodayOnly(false)}
              style={{
                padding: '4px 10px',
                borderRadius: '4px',
                border: 'none',
                background: !viewTodayOnly ? 'var(--accent-blue)' : 'transparent',
                color: !viewTodayOnly ? '#FFFFFF' : 'var(--text-muted)',
                fontSize: '0.72rem',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              Full Range
            </button>
            <button
              onClick={() => setViewTodayOnly(true)}
              style={{
                padding: '4px 10px',
                borderRadius: '4px',
                border: 'none',
                background: viewTodayOnly ? '#10B981' : 'transparent',
                color: viewTodayOnly ? '#FFFFFF' : 'var(--text-muted)',
                fontSize: '0.72rem',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <Calendar size={11} />
              Today Only
            </button>
          </div>

          {/* Hour column filter */}
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

          {/* Color Palette Switcher Dropdown */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              background: 'var(--bg-main)',
              padding: '3px 8px',
              borderRadius: '6px',
              border: '1px solid var(--border-color)',
            }}
          >
            <Palette size={13} color="var(--accent-blue)" />
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 500 }}>Theme:</span>
            <select
              value={paletteId}
              onChange={(e) => handlePaletteChange(e.target.value as HeatmapPalette)}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-main)',
                fontSize: '0.72rem',
                fontWeight: 700,
                outline: 'none',
                cursor: 'pointer',
              }}
            >
              <option value="traffic">Traffic Light (Green → Red)</option>
              <option value="cyber">Cyber Neon (Cyan → Purple)</option>
              <option value="ocean">Ocean Cobalt (Blue → Indigo)</option>
              <option value="github">GitHub Matrix (Monochrome Green)</option>
              <option value="inferno">Solar Inferno (Gold → Crimson)</option>
            </select>
          </div>
        </div>

        {/* Dynamic Color Code Legend matching selected Palette */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.68rem', color: 'var(--text-muted)', background: 'var(--bg-main)', padding: '4px 10px', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
          <span style={{ fontSize: '0.65rem', fontWeight: 600 }}>Quiet (0)</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
            {activePalette.swatches.map((swatchColor, idx) => (
              <div
                key={idx}
                style={{
                  width: '9px',
                  height: '9px',
                  borderRadius: '2px',
                  background: swatchColor,
                  border: idx === 0 ? '1px solid var(--border-color)' : 'none',
                }}
                title={`Level ${idx + 1}`}
              />
            ))}
          </div>
          <span style={{ fontSize: '0.65rem', fontWeight: 700, color: activePalette.swatches[4] }}>
            Peak Hotspot
          </span>
        </div>
      </div>

      {todayError && viewTodayOnly && (
        <div style={{ fontSize: '0.75rem', color: '#EF4444', padding: '6px 0' }}>
          {todayError}
        </div>
      )}

      {viewTodayOnly && todayLoading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', flex: 1, minHeight: '180px', color: 'var(--text-muted)' }}>
          <RefreshCw size={16} className="spin" style={{ animation: 'spin 1s linear infinite' }} />
          <span style={{ fontSize: '0.85rem' }}>Loading today&apos;s live activity…</span>
        </div>
      ) : cells.length === 0 ? (
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
              gridTemplateColumns: `54px repeat(${activeHours.length}, minmax(0, 1fr))`,
              gap: '3px',
              marginBottom: '4px',
              flexShrink: 0,
            }}
          >
            <div />
            <div
              style={{
                gridColumn: `2 / span ${activeHours.length}`,
                fontSize: '0.62rem',
                color: 'var(--text-muted)',
                textAlign: 'center',
                fontWeight: 600,
                marginBottom: '2px',
                userSelect: 'none',
              }}
            >
              Hours (IST · now {istClock.time})
            </div>
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: `54px repeat(${activeHours.length}, minmax(0, 1fr))`,
              gap: '3px',
              marginBottom: '4px',
              flexShrink: 0,
            }}
          >
            <div />
            {activeHours.map((h) => {
              const isCurrentHour = h === istClock.hour;
              return (
              <div
                key={h}
                title={formatHourLabel(h)}
                style={{
                  fontSize: '0.64rem',
                  color: isCurrentHour ? '#10B981' : 'var(--text-muted)',
                  textAlign: 'center',
                  fontWeight: isCurrentHour ? 800 : 600,
                  userSelect: 'none',
                  background: isCurrentHour ? 'rgba(16, 185, 129, 0.12)' : 'transparent',
                  borderRadius: '4px',
                  border: isCurrentHour ? '1px solid rgba(16, 185, 129, 0.35)' : '1px solid transparent',
                }}
              >
                {h < 10 ? `0${h}` : h}h
              </div>
            );})}
          </div>

          {/* Days Grid Rows — one row per actual calendar date */}
          {rowDates.map((dateInfo) => (
              <div
                key={dateInfo.date}
                style={{
                  display: 'grid',
                  gridTemplateColumns: `54px repeat(${activeHours.length}, minmax(0, 1fr))`,
                  gap: '3px',
                  alignItems: 'stretch',
                  flex: 1,
                  minHeight: '25px',
                  margin: '2px 0',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '2px 6px',
                    borderRadius: '5px',
                    background: dateInfo.isToday ? 'rgba(59, 130, 246, 0.16)' : 'transparent',
                    border: dateInfo.isToday ? '1px solid rgba(59, 130, 246, 0.35)' : '1px solid transparent',
                    userSelect: 'none',
                    boxSizing: 'border-box',
                  }}
                  title={dateInfo.fullDate}
                >
                  <span
                    style={{
                      fontSize: '0.73rem',
                      fontWeight: 700,
                      color: dateInfo.isToday ? '#38BDF8' : 'var(--text-main)',
                    }}
                  >
                    {dateInfo.dayAbbr}
                  </span>
                  <span
                    style={{
                      fontSize: '0.70rem',
                      color: dateInfo.isToday ? '#38BDF8' : 'var(--text-muted)',
                      fontWeight: dateInfo.isToday ? 700 : 500,
                      fontFamily: 'monospace',
                    }}
                  >
                    {dateInfo.dayNum}
                  </span>
                </div>
                {activeHours.map((h) => {
                  const { count, uniqueUsers } = getCellData(dateInfo.date, h);
                  const styleObj = activePalette.getIntensity(count, maxCount);
                  const isHovered = hoveredCell?.date === dateInfo.date && hoveredCell?.hour === h;
                  const isCurrentHour = dateInfo.isToday && h === istClock.hour;

                  return (
                    <div
                      key={h}
                      onMouseEnter={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        setHoveredCell({
                          date: dateInfo.date,
                          day: dateInfo.dayAbbr,
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
                        outline: isHovered
                          ? '2px solid #FFFFFF'
                          : isCurrentHour
                            ? '2px solid rgba(16, 185, 129, 0.75)'
                            : 'none',
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

      {/* Interactive Tooltip Card */}
      {hoveredCell && (
        <div
          style={{
            position: 'fixed',
            left: `${hoveredCell.x}px`,
            top: `${hoveredCell.y - 12}px`,
            transform: 'translate(-50%, -100%)',
            background: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            boxShadow: '0 8px 24px rgba(0,0,0,0.45)',
            borderRadius: '10px',
            padding: '10px 14px',
            zIndex: 9999,
            pointerEvents: 'none',
            minWidth: '180px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px', borderBottom: '1px solid var(--border-color)', paddingBottom: '4px' }}>
            <span style={{ fontSize: '0.76rem', fontWeight: 700, color: 'var(--text-main)' }}>
              {rowDates.find((r) => r.date === hoveredCell.date)?.fullDate || hoveredCell.date} • {formatHourLabel(hoveredCell.hour)}
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.74rem' }}>
              <span style={{ color: 'var(--text-muted)' }}>Requests:</span>
              <strong style={{ color: 'var(--text-main)' }}>{hoveredCell.count.toLocaleString()}</strong>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.74rem' }}>
              <span style={{ color: 'var(--text-muted)' }}>Unique Users:</span>
              <strong style={{ color: 'var(--accent-blue)' }}>{hoveredCell.uniqueUsers}</strong>
            </div>

            <div style={{ marginTop: '4px', paddingTop: '4px', borderTop: '1px solid var(--border-color)' }}>
              {(() => {
                const status = activePalette.getStatusBadge(hoveredCell.count, maxCount);
                return (
                  <span
                    style={{
                      fontSize: '0.68rem',
                      fontWeight: 700,
                      color: status.color,
                      display: 'block',
                      textAlign: 'center',
                    }}
                  >
                    {status.label}
                  </span>
                );
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
