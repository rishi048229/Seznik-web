import React from 'react';
import { Users, Receipt, UserCheck, LayoutGrid, TrendingUp, TrendingDown } from 'lucide-react';
import type { DashboardMetrics } from '../types/admin';

interface KPICardsProps {
  metrics: DashboardMetrics | null;
  onSelectTab?: (tab: string, sectionId?: string) => void;
}

export const KPICards: React.FC<KPICardsProps> = ({ metrics, onSelectTab }) => {
  if (!metrics) return null;

  const tr = (metrics.timeRange || '24h').toLowerCase();
  const timeSuffix = tr === 'all' ? 'All Time' : tr.toUpperCase();
  const windowLabel = metrics.timeWindowLabel || (tr === '24h' ? 'today' : `last ${tr}`);

  const cards = [
    {
      id: 'users',
      title: tr === 'all' ? 'Total Registered Users' : `Registered Users (${timeSuffix})`,
      value: metrics.totalUsers,
      subtext: `${metrics.verifiedUserPercentage}% verified accounts`,
      icon: Users,
      color: '#3B82F6', // Blue = volume
      trend: metrics.totalUsersTrend ?? 14.2,
      targetTab: 'users',
    },
    {
      id: 'invoices-today',
      title: tr === 'all' ? 'Total Invoices (All Time)' : `Total Invoices (${timeSuffix})`,
      value: metrics.invoicesTodayCount ?? 0,
      subtext: `Web: ${metrics.webInvoicesCount ?? metrics.invoicesTodayCount ?? 0} (${metrics.webInvoicesPercent ?? 100}%) • Mobile: ${metrics.mobileInvoicesCount ?? 0} (${metrics.mobileInvoicesPercent ?? 0}%)`,
      icon: Receipt,
      color: '#10B981', // Green = sales/revenue
      trend: metrics.invoicesTodayTrend ?? 15.0,
      targetTab: 'overview',
      platformSplit: {
        web: metrics.webInvoicesCount ?? metrics.invoicesTodayCount ?? 0,
        mobile: metrics.mobileInvoicesCount ?? 0,
      },
    },
    {
      id: 'active-invoicing-users',
      title: tr === 'all' ? 'Active Merchants (All Time)' : `Invoicing Merchants (${timeSuffix})`,
      value: metrics.activeInvoicingUsersToday ?? 0,
      subtext: tr === 'all' ? 'All distinct billing merchants' : `Distinct billing merchants (${windowLabel})`,
      icon: UserCheck,
      color: '#8B5CF6', // Purple = merchant activity
      trend: metrics.activeInvoicingUsersTrend ?? 10.0,
      targetTab: 'overview',
    },
    {
      id: 'most-used',
      title: `Most Used Section (${timeSuffix})`,
      value: metrics.topSection || 'Products & Inventory Catalog (89.8%)',
      subtext: `${metrics.topSectionShare ?? 89.8}% traffic share in ${windowLabel}`,
      icon: LayoutGrid,
      color: '#F59E0B', // Amber = feature attention
      trend: metrics.topSectionTrend ?? 22.1,
      isStringValue: true,
      targetTab: 'sections',
      sectionId: 'sec-products',
    },
  ];

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px', marginBottom: '0px' }}>
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
              padding: '16px 20px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              cursor: onSelectTab ? 'pointer' : 'default',
              transition: 'all 0.2s ease',
              background: 'var(--bg-card)',
              border: '1px solid var(--border-color)',
              borderRadius: '12px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
              <span style={{ fontSize: '0.74rem', fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                {card.title}
              </span>
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
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

            <div style={{ marginBottom: '8px' }}>
              {card.isStringValue ? (
                <div style={{ fontSize: '0.96rem', fontWeight: 700, color: 'var(--text-main)', lineHeight: '1.2' }}>
                  {card.value}
                </div>
              ) : (
                <div style={{ fontSize: '1.65rem', fontWeight: 800, color: 'var(--text-main)', lineHeight: '1', letterSpacing: '-0.02em' }}>
                  {card.value}
                </div>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '8px', borderTop: '1px solid var(--border-color)' }}>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                {card.subtext}
              </span>

              <span
                style={{
                  fontSize: '0.72rem',
                  fontWeight: 600,
                  color: trendColor,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '3px',
                  background: isTrendPositive ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                  padding: '3px 7px',
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
