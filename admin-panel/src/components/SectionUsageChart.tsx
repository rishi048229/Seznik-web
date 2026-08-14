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
  ChevronUp 
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
}) => {
  const topModule = sections[0] || null;

  return (
    <div 
      className="glass-card" 
      style={{ 
        padding: '14px 22px', 
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
            {sections.length} Tracked Features
          </span>
          {topModule && (
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginLeft: '6px' }}>
              • #1 Leader: <strong style={{ color: 'var(--text-main)' }}>{topModule.sectionName}</strong> ({topModule.percentageShare}%)
            </span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
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
        style={{
          maxHeight: (!isCollapsible || isExpanded) ? '600px' : '0px',
          opacity: (!isCollapsible || isExpanded) ? 1 : 0,
          overflow: 'hidden',
          transition: 'max-height 0.35s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.25s ease, margin-top 0.35s ease',
          marginTop: (!isCollapsible || isExpanded) ? '12px' : '0px',
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
            <table className="custom-table" style={{ width: '100%', borderCollapse: 'separate', borderSpacing: '0 4px' }}>
              <thead>
                <tr>
                  <th style={{ padding: '6px 14px', textAlign: 'left', width: '38%', fontSize: '0.74rem' }}>Section Module</th>
                  <th style={{ padding: '6px 14px', textAlign: 'left', width: '36%', fontSize: '0.74rem' }}>Traffic Distribution Share</th>
                  <th style={{ padding: '6px 14px', textAlign: 'left', width: '14%', fontSize: '0.74rem' }}>Avg Session</th>
                  <th style={{ padding: '6px 14px', textAlign: 'left', width: '12%', fontSize: '0.74rem' }}>Trend Delta</th>
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
                      <td style={{ padding: '8px 14px', borderRadius: '6px 0 0 6px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div
                            style={{
                              width: '26px',
                              height: '26px',
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
                          <div>
                            <span style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '0.86rem' }}>
                              {sec.sectionName}
                            </span>
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
                          </div>
                        </div>
                      </td>

                      {/* Traffic Distribution Bar & Percentage */}
                      <td style={{ padding: '8px 14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <div
                            style={{
                              flex: 1,
                              height: '6px',
                              background: 'rgba(255, 255, 255, 0.06)',
                              borderRadius: '4px',
                              overflow: 'hidden',
                            }}
                          >
                            <div
                              style={{
                                width: `${Math.max(sec.percentageShare, 2)}%`,
                                height: '100%',
                                background: idx === 0 
                                  ? 'linear-gradient(90deg, #3B82F6 0%, #8B5CF6 100%)' 
                                  : (idx === 1 ? 'linear-gradient(90deg, #10B981 0%, #06B6D4 100%)' : 'rgba(139, 92, 246, 0.75)'),
                                borderRadius: '4px',
                              }}
                            />
                          </div>
                          <span
                            style={{
                              fontSize: '0.82rem',
                              fontWeight: 700,
                              color: 'var(--text-main)',
                              minWidth: '46px',
                              textAlign: 'right',
                            }}
                          >
                            {sec.percentageShare}%
                          </span>
                        </div>
                      </td>

                      {/* Avg Session Duration */}
                      <td style={{ padding: '8px 14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-main)', fontSize: '0.8rem' }}>
                          <Clock size={13} color="#F59E0B" />
                          <span style={{ fontWeight: 500 }}>{sec.avgDurationMinutes} mins</span>
                        </div>
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
    </div>
  );
};
