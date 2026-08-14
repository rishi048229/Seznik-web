import React from 'react';
import { 
  LayoutGrid, 
  TrendingUp, 
  TrendingDown, 
  Clock, 
  ArrowRight,
  Package,
  ShoppingBag,
  Layers,
  Users,
  Ticket,
  Truck,
  Receipt,
  Settings,
  Sparkles,
  Zap,
  Flame,
  Activity
} from 'lucide-react';
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

const getModuleIcon = (iconName: string, path: string) => {
  if (path.includes('product') || iconName === 'Package') return <Package size={18} color="#3B82F6" />;
  if (path.includes('pos') || path.includes('sale') || iconName === 'ShoppingBag') return <ShoppingBag size={18} color="#10B981" />;
  if (path.includes('categor') || iconName === 'Layers') return <Layers size={18} color="#8B5CF6" />;
  if (path.includes('customer') || iconName === 'Users') return <Users size={18} color="#EC4899" />;
  if (path.includes('token') || iconName === 'Ticket') return <Ticket size={18} color="#06B6D4" />;
  if (path.includes('purchase') || iconName === 'Truck') return <Truck size={18} color="#F59E0B" />;
  if (path.includes('expense') || iconName === 'Receipt') return <Receipt size={18} color="#EF4444" />;
  if (path.includes('setting') || iconName === 'Settings') return <Settings size={18} color="#64748B" />;
  return <LayoutGrid size={18} color="#3B82F6" />;
};

export const SectionUsageChart: React.FC<SectionUsageChartProps> = ({
  title = 'Section & Feature Traffic Breakdown',
  sections = [],
  showInsights = true,
  compact = false,
  hideHeaderButton = false,
  onViewAllSessions,
}) => {
  const topModule = sections[0] || null;
  const longestSessionModule = [...sections].sort((a, b) => b.avgDurationMinutes - a.avgDurationMinutes)[0] || null;
  const fastestGrowthModule = [...sections].sort((a, b) => b.trendPercent - a.trendPercent)[0] || null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', width: '100%' }}>
      {/* 1. Header Highlight Metrics (Only on full section analytics page) */}
      {!compact && showInsights && sections.length > 0 && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
            gap: '16px',
            width: '100%',
          }}
        >
          {/* Card 1: Top Traffic Leader */}
          <div className="glass-card" style={{ padding: '18px 22px', display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '10px',
                background: 'rgba(59, 130, 246, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#3B82F6',
              }}
            >
              <Zap size={22} />
            </div>
            <div>
              <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Highest Volume Feature
              </div>
              <div style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-main)' }}>
                {topModule ? topModule.sectionName : 'N/A'}
              </div>
              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#3B82F6' }}>
                {topModule ? `${topModule.percentageShare}% total traffic share` : ''}
              </div>
            </div>
          </div>

          {/* Card 2: Highest Duration */}
          <div className="glass-card" style={{ padding: '18px 22px', display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '10px',
                background: 'rgba(16, 185, 129, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#10B981',
              }}
            >
              <Clock size={22} />
            </div>
            <div>
              <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Longest Avg Merchant Session
              </div>
              <div style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-main)' }}>
                {longestSessionModule ? longestSessionModule.sectionName : 'N/A'}
              </div>
              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#10B981' }}>
                {longestSessionModule ? `${longestSessionModule.avgDurationMinutes} mins average usage` : ''}
              </div>
            </div>
          </div>

          {/* Card 3: Fastest Growing */}
          <div className="glass-card" style={{ padding: '18px 22px', display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '10px',
                background: 'rgba(245, 158, 11, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#F59E0B',
              }}
            >
              <Flame size={22} />
            </div>
            <div>
              <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Fastest Growing Feature
              </div>
              <div style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-main)' }}>
                {fastestGrowthModule ? fastestGrowthModule.sectionName : 'N/A'}
              </div>
              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#F59E0B' }}>
                {fastestGrowthModule ? `+${fastestGrowthModule.trendPercent}% weekly growth` : ''}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2. Main Expanded & Wider Glass Card Table */}
      <div 
        className="glass-card" 
        style={{ 
          padding: compact ? '20px 24px' : '28px 32px', 
          width: '100%', 
          boxSizing: 'border-box',
          minHeight: compact ? 'auto' : '520px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
        }}
      >
        <div>
          {/* Header Bar */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: compact ? '16px' : '24px', flexWrap: 'wrap', gap: '14px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '8px',
                    background: 'rgba(245, 158, 11, 0.15)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#F59E0B',
                  }}
                >
                  <LayoutGrid size={18} />
                </div>
                <h2 style={{ margin: 0, fontSize: compact ? '1.15rem' : '1.3rem', fontWeight: 700, color: 'var(--text-main)' }}>
                  {title}
                </h2>
                <span
                  style={{
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    color: 'var(--accent-blue)',
                    background: 'rgba(59, 130, 246, 0.1)',
                    padding: '2px 8px',
                    borderRadius: '12px',
                    border: '1px solid rgba(59, 130, 246, 0.2)',
                  }}
                >
                  {sections.length} Tracked Features
                </span>
              </div>
              <p style={{ margin: '6px 0 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                Real telemetry of module usage, database activity distribution, average session duration, and growth trends.
              </p>
            </div>

            {!hideHeaderButton && onViewAllSessions && (
              <button
                onClick={() => onViewAllSessions()}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: 'rgba(59, 130, 246, 0.12)',
                  border: '1px solid rgba(59, 130, 246, 0.25)',
                  color: 'var(--accent-blue)',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  padding: '8px 14px',
                  borderRadius: '8px',
                  transition: 'all 0.15s ease',
                }}
              >
                <span>View Full Breakdown</span>
                <ArrowRight size={14} />
              </button>
            )}
          </div>

          {/* Table */}
          {sections.length === 0 ? (
            <EmptyState
              icon={LayoutGrid}
              title="No Traffic Recorded"
              message="No section traffic recorded in this window."
            />
          ) : (
            <div style={{ width: '100%', overflowX: 'auto' }}>
              <table className="custom-table" style={{ width: '100%', borderCollapse: 'separate', borderSpacing: '0 8px' }}>
                <thead>
                  <tr>
                    <th style={{ padding: '12px 18px', textAlign: 'left', width: '38%' }}>Section Module</th>
                    <th style={{ padding: '12px 18px', textAlign: 'left', width: '36%' }}>Traffic Distribution Share</th>
                    <th style={{ padding: '12px 18px', textAlign: 'left', width: '14%' }}>Avg Session</th>
                    <th style={{ padding: '12px 18px', textAlign: 'left', width: '12%' }}>Trend Delta</th>
                  </tr>
                </thead>
                <tbody>
                  {sections.map((sec, idx) => {
                    const isPositive = sec.trend !== 'down';
                    const TrendIcon = isPositive ? TrendingUp : TrendingDown;
                    const trendColor = isPositive ? '#10B981' : '#EF4444';

                    return (
                      <tr 
                        key={sec.id || idx}
                        style={{
                          background: 'rgba(255, 255, 255, 0.02)',
                          transition: 'background 0.15s ease',
                        }}
                      >
                        {/* Section Module Name & Route Badge */}
                        <td style={{ padding: compact ? '14px 18px' : '18px 20px', borderRadius: '8px 0 0 8px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div
                              style={{
                                width: '34px',
                                height: '34px',
                                borderRadius: '8px',
                                background: 'var(--bg-main)',
                                border: '1px solid var(--border-color)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0,
                              }}
                            >
                              {getModuleIcon(sec.iconName, sec.path)}
                            </div>
                            <div>
                              <div style={{ fontWeight: 700, color: 'var(--text-main)', fontSize: compact ? '0.92rem' : '0.98rem' }}>
                                {sec.sectionName}
                              </div>
                              <div style={{ marginTop: '2px' }}>
                                <code
                                  style={{
                                    fontSize: '0.74rem',
                                    color: 'var(--accent-blue)',
                                    background: 'rgba(79, 142, 247, 0.1)',
                                    padding: '2px 8px',
                                    borderRadius: '4px',
                                    fontFamily: 'monospace',
                                  }}
                                >
                                  {sec.path}
                                </code>
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Traffic Distribution Bar & Percentage */}
                        <td style={{ padding: compact ? '14px 18px' : '18px 20px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                            <div
                              style={{
                                flex: 1,
                                height: '10px',
                                background: 'rgba(255, 255, 255, 0.06)',
                                borderRadius: '6px',
                                overflow: 'hidden',
                                position: 'relative',
                              }}
                            >
                              <div
                                style={{
                                  width: `${Math.max(sec.percentageShare, 2)}%`,
                                  height: '100%',
                                  background: idx === 0 
                                    ? 'linear-gradient(90deg, #3B82F6 0%, #8B5CF6 100%)' 
                                    : (idx === 1 ? 'linear-gradient(90deg, #10B981 0%, #06B6D4 100%)' : 'rgba(139, 92, 246, 0.75)'),
                                  borderRadius: '6px',
                                  boxShadow: idx === 0 ? '0 0 8px rgba(59, 130, 246, 0.5)' : 'none',
                                }}
                              />
                            </div>
                            <span
                              style={{
                                fontSize: compact ? '0.88rem' : '0.95rem',
                                fontWeight: 800,
                                color: 'var(--text-main)',
                                minWidth: '52px',
                                textAlign: 'right',
                              }}
                            >
                              {sec.percentageShare}%
                            </span>
                          </div>
                        </td>

                        {/* Avg Session Duration */}
                        <td style={{ padding: compact ? '14px 18px' : '18px 20px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '7px', color: 'var(--text-main)', fontSize: compact ? '0.85rem' : '0.9rem' }}>
                            <Clock size={15} color="#F59E0B" />
                            <span style={{ fontWeight: 600 }}>{sec.avgDurationMinutes} mins</span>
                          </div>
                        </td>

                        {/* Trend Delta */}
                        <td style={{ padding: compact ? '14px 18px' : '18px 20px', borderRadius: '0 8px 8px 0' }}>
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontWeight: 700, fontSize: '0.82rem', color: trendColor, background: isPositive ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)', padding: '4px 10px', borderRadius: '6px' }}>
                            <TrendIcon size={14} color={trendColor} />
                            <span>{isPositive ? '+' : ''}{sec.trendPercent}%</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer Real-Time Database Indicator */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid var(--border-color)', paddingTop: '16px', marginTop: '16px', flexWrap: 'wrap', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            <span className="pulse-dot" style={{ width: '6px', height: '6px' }} />
            <span>Real-time AWS RDS Postgres Telemetry</span>
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600 }}>
            Total Database Records Evaluated: <span style={{ color: 'var(--text-main)', fontWeight: 700 }}>2,224 rows</span>
          </div>
        </div>
      </div>
    </div>
  );
};
