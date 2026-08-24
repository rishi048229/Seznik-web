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
  CreditCard, 
  Building, 
  BookOpen, 
  BarChart3, 
  ShieldCheck, 
  Printer, 
  ChevronDown, 
  ChevronUp,
  X,
  Calculator,
  HelpCircle,
  Info,
} from 'lucide-react';
import type { SectionUsage } from '../types/admin';
import { EmptyState } from './EmptyState';

interface SectionUsageChartProps {
  title?: string;
  sections?: SectionUsage[];
  showInsights?: boolean;
  compact?: boolean;
  hideHeaderButton?: boolean;
  isCollapsible?: boolean;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
  onViewAllSessions?: (sectionId?: string) => void;
  headerExtra?: React.ReactNode;
}

const getModuleIcon = (iconName: string, path: string) => {
  if (path.includes('product') || iconName === 'Package') return <Package size={16} color="#3B82F6" />;
  if (path.includes('daybook') || iconName === 'BookOpen') return <BookOpen size={16} color="#10B981" />;
  if (path.includes('pos') || path.includes('sale') || iconName === 'ShoppingBag') return <ShoppingBag size={16} color="#06B6D4" />;
  if (path.includes('categor') || iconName === 'Layers') return <Layers size={16} color="#8B5CF6" />;
  if (path.includes('customer') || iconName === 'Users') return <Users size={15} color="#EC4899" />;
  if (path.includes('credit') || iconName === 'CreditCard') return <CreditCard size={16} color="#F59E0B" />;
  if (path.includes('onboarding') || path.includes('login') || path.includes('auth') || iconName === 'ShieldCheck') return <ShieldCheck size={16} color="#3B82F6" />;
  if (path.includes('token') || iconName === 'Ticket') return <Ticket size={16} color="#06B6D4" />;
  if (path.includes('setting') || iconName === 'Settings') return <Settings size={16} color="#64748B" />;
  if (path.includes('report') || iconName === 'BarChart3') return <BarChart3 size={16} color="#3B82F6" />;
  if (path.includes('purchase') || iconName === 'Truck') return <Truck size={16} color="#F59E0B" />;
  if (path.includes('supplier') || iconName === 'Building') return <Building size={16} color="#8B5CF6" />;
  if (path.includes('expense') || iconName === 'Receipt') return <Receipt size={16} color="#EF4444" />;
  if (path.includes('printer') || iconName === 'Printer') return <Printer size={16} color="#64748B" />;
  return <LayoutGrid size={16} color="#3B82F6" />;
};

export const SectionUsageChart: React.FC<SectionUsageChartProps> = ({
  title = 'Top 5 Most Used Features',
  sections = [],
  showInsights = false,
  compact = false,
  hideHeaderButton = false,
  isCollapsible = false,
  isExpanded = false,
  onToggleExpand,
  onViewAllSessions,
  headerExtra,
}) => {
  const [showTrendTooltip, setShowTrendTooltip] = React.useState(false);
  const topModule = sections[0] || null;
  const totalOperations = sections.reduce((acc, s) => acc + (s.viewCount || 0), 0);

  return (
    <div 
      className={`glass-card${compact ? ' section-chart--compact' : ''}`}
      style={{ 
        padding: compact ? '10px 16px' : '14px 22px', 
        width: '100%', 
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        borderRadius: '12px',
        border: '1px solid var(--border-color)',
        background: 'var(--bg-card)',
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        flexShrink: 0,
      }}
    >
      {/* Header Bar - Always rendered consistently */}
      <div 
        onClick={isCollapsible && !isExpanded ? onToggleExpand : undefined}
        style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between', 
          flexWrap: 'wrap', 
          gap: '10px',
          cursor: isCollapsible && !isExpanded ? 'pointer' : 'default',
          userSelect: 'none',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <div
            style={{
              width: '30px',
              height: '30px',
              borderRadius: '7px',
              background: 'rgba(245, 158, 11, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#F59E0B',
              flexShrink: 0,
            }}
          >
            <LayoutGrid size={17} />
          </div>
          <span style={{ fontWeight: 700, fontSize: '0.98rem', color: 'var(--text-main)' }}>
            {title}
          </span>
          <span
            style={{
              fontSize: '0.72rem',
              fontWeight: 700,
              color: 'var(--accent-blue)',
              background: 'rgba(59, 130, 246, 0.1)',
              padding: '2px 8px',
              borderRadius: '10px',
              border: '1px solid rgba(59, 130, 246, 0.2)',
            }}
          >
            {sections.length} Tracked Modules • {totalOperations.toLocaleString()} Total Records
          </span>
          {topModule && !compact && (
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginLeft: '6px' }}>
              • #1 Leader: <strong style={{ color: 'var(--text-main)' }}>{topModule.sectionName}</strong> ({topModule.viewCount.toLocaleString()} records • {topModule.percentageShare}%)
            </span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {headerExtra}
          {/* Toggle Button (Only when collapsed) */}
          {isCollapsible && onToggleExpand && !isExpanded && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onToggleExpand();
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                background: 'rgba(59, 130, 246, 0.1)',
                border: '1px solid rgba(59, 130, 246, 0.25)',
                color: 'var(--accent-blue)',
                fontSize: '0.8rem',
                fontWeight: 600,
                padding: '6px 14px',
                borderRadius: '6px',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <span>Show Top 5 Features</span>
              <ChevronDown size={14} />
            </button>
          )}

          {!hideHeaderButton && onViewAllSessions && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onViewAllSessions();
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid var(--border-color)',
                color: 'var(--text-muted)',
                fontSize: '0.74rem',
                fontWeight: 600,
                cursor: 'pointer',
                padding: '5px 10px',
                borderRadius: '6px',
                transition: 'all 0.15s ease',
              }}
            >
              <span>View All Sections</span>
              <ArrowRight size={13} />
            </button>
          )}
        </div>
      </div>

      {/* Smooth Collapsible Body Container */}
      <div
        className="section-chart-body"
        style={{
          maxHeight: (!isCollapsible || isExpanded) ? (compact ? 'none' : '600px') : '0px',
          opacity: (!isCollapsible || isExpanded) ? 1 : 0,
          overflow: 'hidden',
          transition: 'max-height 0.35s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.25s ease, margin-top 0.35s ease',
          marginTop: (!isCollapsible || isExpanded) ? (compact ? '8px' : '12px') : '0px',
          flex: compact ? 1 : undefined,
          minHeight: compact ? 0 : undefined,
        }}
      >
        {sections.length === 0 ? (
          <EmptyState
            icon={LayoutGrid}
            title="No Traffic Recorded"
            message="No section traffic recorded in this window."
          />
        ) : (
          <div style={{ width: '100%', overflowX: 'auto', borderTop: '1px solid var(--border-color)', paddingTop: '10px' }}>
            <table className="custom-table" style={{ width: '100%', tableLayout: 'fixed', borderCollapse: 'separate', borderSpacing: '0 4px' }}>
              <thead>
                <tr>
                  <th style={{ padding: '6px 14px', textAlign: 'left', width: '42%', fontSize: '0.74rem' }}>Section Module</th>
                  <th style={{ padding: '6px 14px', textAlign: 'left', width: '19%', fontSize: '0.74rem' }}>Record Volume</th>
                  <th style={{ padding: '6px 14px', textAlign: 'left', width: '19%', fontSize: '0.74rem' }}>Traffic Share</th>
                  <th style={{ padding: '6px 14px', textAlign: 'left', width: '20%', fontSize: '0.74rem' }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                      <span>Trend</span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowTrendTooltip(true);
                        }}
                        onMouseEnter={() => setShowTrendTooltip(true)}
                        style={{
                          width: '18px',
                          height: '18px',
                          borderRadius: '50%',
                          border: '1.5px solid var(--accent-blue)',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '0.68rem',
                          fontWeight: 800,
                          fontFamily: 'serif',
                          fontStyle: 'italic',
                          color: 'var(--accent-blue)',
                          background: 'rgba(59, 130, 246, 0.15)',
                          cursor: 'pointer',
                          padding: 0,
                          transition: 'all 0.15s ease',
                          boxShadow: '0 0 6px rgba(59, 130, 246, 0.3)',
                        }}
                        title="Click or hover to view how Trend % is calculated"
                      >
                        i
                      </button>
                    </div>
                  </th>
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
                      }}
                    >
                      {/* Section Module Name & Route Badge */}
                      <td style={{ padding: compact ? '4px 10px' : '8px 14px', borderRadius: '6px 0 0 6px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: compact ? '8px' : '10px' }}>
                          <div
                            style={{
                              width: compact ? '22px' : '26px',
                              height: compact ? '22px' : '26px',
                              borderRadius: '6px',
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
                          <div style={{ minWidth: 0 }}>
                            <span style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: compact ? '0.8rem' : '0.86rem' }}>
                              {sec.sectionName}
                            </span>
                            {!compact && (
                            <code
                              style={{
                                fontSize: '0.7rem',
                                color: 'var(--accent-blue)',
                                background: 'rgba(79, 142, 247, 0.1)',
                                padding: '1px 6px',
                                borderRadius: '3px',
                                fontFamily: 'monospace',
                                marginLeft: '8px',
                              }}
                            >
                              {sec.path}
                            </code>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Number of records in window */}
                      <td style={{ padding: '8px 14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-main)' }}>
                            {sec.viewCount.toLocaleString()}
                          </span>
                          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                            records
                          </span>
                        </div>
                      </td>

                      {/* Traffic Share — percentage only */}
                      <td style={{ padding: '8px 14px' }}>
                        <span style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-main)' }}>
                          {sec.percentageShare}%
                        </span>
                      </td>

                      {/* Trend Delta */}
                      <td style={{ padding: '8px 14px', borderRadius: '0 6px 6px 0' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', fontWeight: 600, fontSize: '0.76rem', color: trendColor, background: isPositive ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)', padding: '2px 7px', borderRadius: '4px' }}>
                          <TrendIcon size={12} color={trendColor} />
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

      {/* TREND CALCULATION EXPLANATION BOX OVERLAY */}
      {showTrendTooltip && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            background: 'rgba(0, 0, 0, 0.65)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
          }}
          onClick={() => setShowTrendTooltip(false)}
        >
          <div
            className="glass-card"
            style={{
              maxWidth: '480px',
              width: '100%',
              padding: '24px',
              background: 'var(--bg-card)',
              border: '1px solid var(--border-color)',
              borderRadius: '16px',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
              position: 'relative',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Overlay Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '10px',
                    background: 'rgba(59, 130, 246, 0.15)',
                    border: '1px solid rgba(59, 130, 246, 0.3)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--accent-blue)',
                  }}
                >
                  <Calculator size={20} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-main)' }}>
                    How Trend % is Calculated
                  </h3>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Period-over-Period (PoP) Growth Formula
                  </div>
                </div>
              </div>

              <button
                onClick={() => setShowTrendTooltip(false)}
                style={{
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid var(--border-color)',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  padding: '6px',
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                title="Close"
              >
                <X size={16} />
              </button>
            </div>

            {/* Formula Block */}
            <div
              style={{
                background: 'var(--bg-main)',
                border: '1px solid var(--border-color)',
                borderRadius: '10px',
                padding: '12px 16px',
                marginBottom: '16px',
              }}
            >
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '4px' }}>
                Mathematical Formula:
              </div>
              <div style={{ fontFamily: 'monospace', fontSize: '0.88rem', fontWeight: 700, color: '#10B981' }}>
                Trend % = ((C − P) / P) × 100
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                <strong>C</strong> = Current Period Count • <strong>P</strong> = Previous Period Count
              </div>
            </div>

            {/* Timeframe Comparison Grid */}
            <div style={{ marginBottom: '16px' }}>
              <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '8px' }}>
                Comparison Windows:
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 10px', background: 'rgba(255, 255, 255, 0.02)', borderRadius: '6px' }}>
                  <span><strong>24h Filter:</strong></span>
                  <span>Last 24 Hours vs. Preceding 24 Hours</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 10px', background: 'rgba(255, 255, 255, 0.02)', borderRadius: '6px' }}>
                  <span><strong>7d Filter:</strong></span>
                  <span>Last 7 Days vs. Preceding 7 Days</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 10px', background: 'rgba(255, 255, 255, 0.02)', borderRadius: '6px' }}>
                  <span><strong>30d Filter:</strong></span>
                  <span>Last 30 Days vs. Preceding 30 Days</span>
                </div>
              </div>
            </div>

            {/* Example Walkthrough */}
            <div style={{ padding: '10px 12px', background: 'rgba(59, 130, 246, 0.08)', border: '1px solid rgba(59, 130, 246, 0.2)', borderRadius: '8px', marginBottom: '18px', fontSize: '0.75rem', color: 'var(--text-main)' }}>
              <strong style={{ color: 'var(--accent-blue)' }}>Example:</strong> If a module had <strong>115 records</strong> in the current window and <strong>100 records</strong> in the previous window:
              <div style={{ fontFamily: 'monospace', marginTop: '4px', fontWeight: 600, color: '#10B981' }}>
                ((115 − 100) / 100) × 100 = +15.0% Growth
              </div>
            </div>

            {/* Close Button */}
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowTrendTooltip(false)}
                style={{
                  padding: '8px 18px',
                  borderRadius: '8px',
                  border: 'none',
                  background: 'var(--accent-blue)',
                  color: '#FFFFFF',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)',
                }}
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
