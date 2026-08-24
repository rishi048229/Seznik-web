import React, { useState, useMemo, useEffect } from 'react';
import { Activity, Clock, Calendar, Palette, RefreshCw } from 'lucide-react';
import type { HeatmapCell, HeatmapResponse } from '../types/admin';
import { fetchHeatmapData } from '../services/api';
import { EmptyState } from './EmptyState';
import { TimeRangeSelect, timeRangeLabel } from './TimeRangeSelect';

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

export const PeakUsageHeatmap: React.FC<{ embedded?: boolean }> = ({ embedded = false }) => {
  const [timeRange, setTimeRange] = useState(embedded ? '3d' : '7d');
  const [rangeData, setRangeData] = useState<HeatmapCell[] | HeatmapResponse | undefined>(undefined);
  const [rangeLoading, setRangeLoading] = useState(true);
  const [rangeError, setRangeError] = useState<string | null>(null);
  const [hoveredCell, setHoveredCell] = useState<HoveredCellInfo | null>(null);
  const [viewFilter, setViewFilter] = useState<'all' | 'business'>(() => (embedded ? 'business' : 'all'));
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

  useEffect(() => {
    if (viewTodayOnly) return;

    let cancelled = false;
    setRangeLoading(true);
    setRangeError(null);

    fetchHeatmapData(timeRange, embedded ? 3 : undefined)
      .then((result) => {
        if (!cancelled) {
          setRangeData(result);
          setRangeError(null);
        }
      })
      .catch((err: Error) => {
        if (!cancelled) {
          setRangeError(err?.message || 'Failed to load heatmap');
          setRangeData(undefined);
        }
      })
      .finally(() => {
        if (!cancelled) setRangeLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [timeRange, viewTodayOnly]);

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
  }, [viewTodayOnly]);

  const activeData: HeatmapCell[] | HeatmapResponse | undefined = viewTodayOnly
    ? todayData ?? undefined
    : rangeData;

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

  const toggleBtn = (active: boolean, accent?: 'green') => ({
    padding: '5px 12px',
    borderRadius: '5px',
    border: 'none',
    background: active ? (accent === 'green' ? '#10B981' : 'var(--accent-blue)') : 'transparent',
    color: active ? '#FFFFFF' : 'var(--text-muted)',
    fontSize: '0.74rem',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.15s ease',
    whiteSpace: 'nowrap' as const,
  });

  const controlGroup: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    background: 'var(--bg-main)',
    padding: '3px',
    borderRadius: '8px',
    border: '1px solid var(--border-color)',
    gap: '2px',
  };

  const labelColWidth = embedded ? 44 : 58;
  const hourGridTemplate = `${labelColWidth}px repeat(${activeHours.length}, minmax(0, 1fr))`;
  const cellGap = embedded ? 2 : 4;

  return (
    <div
      className={`glass-card${embedded ? ' heatmap-panel--embedded' : ''}`}
      style={{
        padding: embedded ? '12px 14px' : '16px 18px',
        display: 'flex',
        flexDirection: 'column',
        gap: embedded ? '8px' : '12px',
        height: '100%',
        minHeight: embedded ? 0 : '320px',
        boxSizing: 'border-box',
        position: 'relative',
        width: '100%',
        minWidth: 0,
        flex: 1,
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: '12px',
          flexShrink: 0,
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '34px',
                height: '34px',
                borderRadius: '9px',
                background: 'linear-gradient(135deg, rgba(6, 182, 212, 0.2) 0%, rgba(59, 130, 246, 0.2) 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <Activity size={18} color="#06B6D4" />
            </div>
            <div style={{ minWidth: 0 }}>
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--text-main)', lineHeight: 1.3 }}>
                Peak Usage Heatmap
              </h3>
              <p style={{ margin: '2px 0 0', fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                {viewTodayOnly ? 'Today · IST' : `${timeRangeLabel(timeRange)} · IST`}
                {' · '}
                <span style={{ color: 'var(--accent-blue)', fontWeight: 600 }}>{weekDateRangeStr}</span>
              </p>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
          <div
            style={{
              background: 'var(--bg-main)',
              border: '1px solid var(--border-color)',
              borderRadius: '8px',
              padding: '6px 12px',
              textAlign: 'center',
              minWidth: '72px',
            }}
          >
            <div style={{ fontSize: '0.62rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Today
            </div>
            <div style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-main)', fontFamily: 'monospace', lineHeight: 1.2 }}>
              {requestsToday.toLocaleString()}
            </div>
          </div>
          <div
            style={{
              background: 'var(--bg-main)',
              border: '1px solid var(--border-color)',
              borderRadius: '8px',
              padding: '6px 12px',
              textAlign: 'center',
              minWidth: '72px',
            }}
          >
            <div style={{ fontSize: '0.62rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              This Hour
            </div>
            <div style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-main)', fontFamily: 'monospace', lineHeight: 1.2 }}>
              {requestsThisHour.toLocaleString()}
            </div>
          </div>
        </div>
      </div>

      {/* Toolbar row 1: scope + range + hours */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: embedded ? '6px' : '8px',
          padding: embedded ? '6px 10px' : '10px 12px',
          background: 'var(--bg-main)',
          borderRadius: '10px',
          border: '1px solid var(--border-color)',
          flexShrink: 0,
        }}
      >
        <div style={controlGroup}>
          <button type="button" onClick={() => setViewTodayOnly(false)} style={toggleBtn(!viewTodayOnly)}>
            Full Range
          </button>
          <button
            type="button"
            onClick={() => setViewTodayOnly(true)}
            style={{ ...toggleBtn(viewTodayOnly, 'green'), display: 'inline-flex', alignItems: 'center', gap: '4px' }}
          >
            <Calendar size={11} />
            Today
          </button>
        </div>

        {!viewTodayOnly && !embedded && <TimeRangeSelect value={timeRange} onChange={setTimeRange} compact />}
        {!viewTodayOnly && embedded && (
          <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)', padding: '4px 8px' }}>
            Last 3 Days
          </span>
        )}

        <div style={controlGroup}>
          <button type="button" onClick={() => setViewFilter('all')} style={toggleBtn(viewFilter === 'all')}>
            24 Hours
          </button>
          <button type="button" onClick={() => setViewFilter('business')} style={toggleBtn(viewFilter === 'business')}>
            Business (8–22)
          </button>
        </div>

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Palette size={13} color="var(--accent-blue)" />
          <select
            className="custom-select"
            value={paletteId}
            onChange={(e) => handlePaletteChange(e.target.value as HeatmapPalette)}
            style={{
              background: 'transparent',
              border: '1px solid var(--border-color)',
              borderRadius: '6px',
              color: 'var(--text-main)',
              fontSize: '0.72rem',
              fontWeight: 600,
              padding: '4px 8px',
              outline: 'none',
              cursor: 'pointer',
              maxWidth: '180px',
            }}
          >
            <option value="traffic">Traffic Light</option>
            <option value="cyber">Cyber Neon</option>
            <option value="ocean">Ocean Cobalt</option>
            <option value="github">GitHub Matrix</option>
            <option value="inferno">Solar Inferno</option>
          </select>
        </div>
      </div>

      {!embedded ? (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '10px',
          padding: '6px 12px',
          background: 'var(--bg-main)',
          borderRadius: '8px',
          border: '1px solid var(--border-color)',
          fontSize: '0.7rem',
          color: 'var(--text-muted)',
          flexShrink: 0,
        }}
      >
        <span style={{ fontWeight: 600 }}>Quiet</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          {activePalette.swatches.map((swatchColor, idx) => (
            <div
              key={idx}
              style={{
                width: '14px',
                height: '14px',
                borderRadius: '3px',
                background: swatchColor,
                border: idx === 0 ? '1px solid var(--border-color)' : 'none',
              }}
            />
          ))}
        </div>
        <span style={{ fontWeight: 700, color: activePalette.swatches[4] }}>Peak</span>
        <span style={{ opacity: 0.5 }}>|</span>
        <span>Now {istClock.time} IST</span>
      </div>
      ) : null}

      {(todayError && viewTodayOnly) || (rangeError && !viewTodayOnly) ? (
        <div style={{ fontSize: '0.75rem', color: '#EF4444' }}>
          {viewTodayOnly ? todayError : rangeError}
        </div>
      ) : null}

      {viewTodayOnly && todayLoading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', flex: 1, minHeight: '160px', color: 'var(--text-muted)' }}>
          <RefreshCw size={16} className="animate-spin-slow" />
          <span style={{ fontSize: '0.85rem' }}>Loading today&apos;s activity…</span>
        </div>
      ) : !viewTodayOnly && rangeLoading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', flex: 1, minHeight: '160px', color: 'var(--text-muted)' }}>
          <RefreshCw size={16} className="animate-spin-slow" />
          <span style={{ fontSize: '0.85rem' }}>Loading heatmap…</span>
        </div>
      ) : cells.length === 0 ? (
        <EmptyState
          icon={Clock}
          title="No Heatmap Telemetry"
          message="No active API traffic recorded for heatmap analysis in this window."
        />
      ) : (
        <div
          className={`heatmap-grid-scroll${embedded ? ' heatmap-grid-fit' : ''}`}
          style={{
            flex: 1,
            minHeight: 0,
            overflow: embedded ? 'hidden' : undefined,
            overflowX: embedded ? 'hidden' : 'auto',
            overflowY: 'hidden',
            padding: embedded ? '2px 2px 0' : '4px 2px 2px',
            background: 'var(--bg-main)',
            borderRadius: '10px',
            border: '1px solid var(--border-color)',
            display: embedded ? 'flex' : undefined,
            flexDirection: embedded ? 'column' : undefined,
          }}
        >
          {/* Hour labels */}
          <div
            className={embedded ? 'heatmap-hour-row' : undefined}
            style={{
              display: 'grid',
              gridTemplateColumns: hourGridTemplate,
              gap: cellGap,
              padding: embedded ? '4px 8px 2px' : '8px 10px 4px',
              minWidth: embedded ? undefined : (viewFilter === 'business' ? '420px' : '640px'),
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
                    fontSize: embedded ? '0.6rem' : '0.68rem',
                    color: isCurrentHour ? '#10B981' : 'var(--text-muted)',
                    textAlign: 'center',
                    fontWeight: isCurrentHour ? 800 : 500,
                    userSelect: 'none',
                    padding: '2px 0',
                    background: isCurrentHour ? 'rgba(16, 185, 129, 0.12)' : 'transparent',
                    borderRadius: '4px',
                  }}
                >
                  {h < 10 ? `0${h}` : h}
                </div>
              );
            })}
          </div>

          {/* Day rows */}
          <div
            className={embedded ? 'heatmap-day-rows' : undefined}
            style={embedded ? undefined : { padding: '0 10px 10px', minWidth: viewFilter === 'business' ? '420px' : '640px' }}
          >
            {rowDates.map((dateInfo) => (
              <div
                key={dateInfo.date}
                className={embedded ? 'heatmap-day-row' : undefined}
                style={{
                  display: 'grid',
                  gridTemplateColumns: hourGridTemplate,
                  gap: cellGap,
                  alignItems: 'stretch',
                  marginBottom: embedded ? 0 : 4,
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: embedded ? '2px 1px' : '4px 2px',
                    borderRadius: embedded ? '4px' : '6px',
                    background: dateInfo.isToday ? 'rgba(59, 130, 246, 0.14)' : 'transparent',
                    border: dateInfo.isToday ? '1px solid rgba(59, 130, 246, 0.35)' : '1px solid transparent',
                    userSelect: 'none',
                    minHeight: embedded ? 0 : 28,
                    height: embedded ? '100%' : undefined,
                  }}
                  title={dateInfo.fullDate}
                >
                  <span
                    style={{
                      fontSize: embedded ? '0.62rem' : '0.7rem',
                      fontWeight: 700,
                      color: dateInfo.isToday ? '#38BDF8' : 'var(--text-main)',
                      lineHeight: 1.1,
                    }}
                  >
                    {dateInfo.dayAbbr}
                  </span>
                  {dateInfo.dayNum && (
                    <span
                      style={{
                        fontSize: embedded ? '0.58rem' : '0.65rem',
                        color: dateInfo.isToday ? '#38BDF8' : 'var(--text-muted)',
                        fontFamily: 'monospace',
                      }}
                    >
                      {dateInfo.dayNum}
                    </span>
                  )}
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
                        minHeight: embedded ? 0 : 28,
                        height: embedded ? '100%' : undefined,
                        borderRadius: embedded ? 3 : 4,
                        ...styleObj,
                        transform: isHovered ? 'scale(1.15)' : 'scale(1)',
                        zIndex: isHovered ? 20 : 1,
                        outline: isHovered
                          ? '2px solid #FFFFFF'
                          : isCurrentHour
                            ? '2px solid rgba(16, 185, 129, 0.6)'
                            : 'none',
                        transition: 'transform 0.12s ease, outline 0.12s ease',
                        cursor: 'pointer',
                        boxSizing: 'border-box',
                      }}
                    />
                  );
                })}
              </div>
            ))}
          </div>
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
              <span style={{ color: 'var(--text-muted)' }}>Activity records:</span>
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
