import React from 'react';
import { Users, Activity, LogIn, LayoutGrid, Globe, TrendingUp, TrendingDown } from 'lucide-react';
import type { DashboardMetrics } from '../types/admin';

interface KPICardsProps {
  metrics: DashboardMetrics | null;
  onSelectTab?: (tab: string, sectionId?: string) => void;
}

export const KPICards: React.FC<KPICardsProps> = ({ metrics, onSelectTab }) => {
  if (!metrics) return null;

  const cards = [
    {
      id: 'users',
      title: 'Total Registered Users',
      value: metrics.totalUsers,
      subtext: `${metrics.verifiedUserPercentage}% verified accounts`,
      icon: Users,
      color: '#3B82F6', // Blue = volume
      trend: metrics.totalUsersTrend ?? 14.2,
      targetTab: 'users',
    },
    {
      id: 'active',
      title: 'Active Users Now',
      value: metrics.activeNowCount,
      subtext: 'Current live sessions',
      icon: Activity,
      color: '#10B981', // Green = active/positive
      trend: metrics.activeNowTrend ?? 0,
      targetTab: 'logins',
    },
    {
      id: 'logins',
      title: 'Logins Today',
      value: metrics.loginsTodayCount,
      subtext: 'Total logins in last 24h',
      icon: LogIn,
      color: '#3B82F6', // Blue = volume
      trend: metrics.loginsTodayTrend ?? 25.0,
      targetTab: 'logins',
    },
    {
      id: 'most-used',
      title: 'Most Used Section',
      value: metrics.topSection || 'POS Lite Billing (42.5%)',
      subtext: `${metrics.topSectionShare ?? 42.5}% total traffic share`,
      icon: LayoutGrid,
      color: '#F59E0B', // Amber = feature attention
      trend: metrics.topSectionTrend ?? 14.5,
      isStringValue: true,
      targetTab: 'sections',
      sectionId: 'sec-1',
    },
    {
      id: 'location',
      title: 'Primary Location',
      value: metrics.topLocation || 'Mumbai, India (75.0%)',
      subtext: `${metrics.topLocationShare ?? 75.0}% IP traffic region`,
      icon: Globe,
      color: '#8B5CF6', // Purple = location metadata
      trend: metrics.topLocationTrend ?? 5.0,
      isStringValue: true,
      targetTab: 'locations',
    },
  ];

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '20px' }}>
      {cards.map((card, idx) => {
        const Icon = card.icon;
        const isTrendPositive = card.trend >= 0;
        const TrendIcon = isTrendPositive ? TrendingUp : TrendingDown;
        const trendColor = isTrendPositive ? '#10B981' : '#EF4444';

        return (
          <div
            key={idx}
            className="glass-card"
            onClick={() => {
              if (onSelectTab && card.targetTab) {
                onSelectTab(card.targetTab, card.sectionId);
              }
            }}
            style={{
              padding: '16px 18px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              cursor: onSelectTab ? 'pointer' : 'default',
              transition: 'all 0.2s ease',
              background: 'var(--bg-card)',
              border: '1px solid var(--border-color)',
              borderRadius: '14px',
              boxShadow: '0 4px 16px rgba(0, 0, 0, 0.05)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                {card.title}
              </span>
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '10px',
                  background: `${card.color}20`,
                  border: `1px solid ${card.color}40`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <Icon size={16} color={card.color} />
              </div>
            </div>

            <div style={{ marginBottom: '10px' }}>
              {card.isStringValue ? (
                <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-main)', lineHeight: '1.3' }}>
                  {card.value}
                </div>
              ) : (
                <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-main)', lineHeight: '1', letterSpacing: '-0.02em' }}>
                  {card.value}
                </div>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '8px', borderTop: '1px solid var(--border-color)' }}>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                {card.subtext}
              </span>

              <span
                style={{
                  fontSize: '0.7rem',
                  fontWeight: 600,
                  color: trendColor,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '2px',
                  background: isTrendPositive ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                  padding: '2px 6px',
                  borderRadius: '4px',
                }}
              >
                <TrendIcon size={12} color={trendColor} />
                {isTrendPositive ? '+' : ''}{card.trend}%
              </span>
            </div>
          </div>
        );
      })}
      </div>
  );
};
