import React from 'react';
import { Users, Activity, LogIn, LayoutGrid, Globe2, CheckCircle2 } from 'lucide-react';
import type { DashboardMetrics } from '../types/admin';

interface KPICardsProps {
  metrics: DashboardMetrics | null;
}

export const KPICards: React.FC<KPICardsProps> = ({ metrics }) => {
  if (!metrics) return null;

  const cards = [
    {
      title: 'Total Registered Users',
      value: metrics.totalUsers,
      subtext: `${metrics.verifiedUserPercentage}% verified emails`,
      icon: Users,
      color: '#3B82F6',
      badgeText: '+14% this month',
      gradientClass: 'gradient-text-blue',
    },
    {
      title: 'Active Users Now',
      value: metrics.activeNowCount,
      subtext: 'Currently connected sessions',
      icon: Activity,
      color: '#10B981',
      badgeText: 'LIVE',
      isPulse: true,
      gradientClass: 'gradient-text-emerald',
    },
    {
      title: 'Logins Today',
      value: metrics.loginsTodayCount,
      subtext: 'Successful & active logins',
      icon: LogIn,
      color: '#8B5CF6',
      badgeText: '+8 today',
      gradientClass: 'gradient-text-purple',
    },
    {
      title: 'Most Used Section',
      value: metrics.topSection,
      subtext: 'Highest user traffic & time',
      icon: LayoutGrid,
      color: '#F59E0B',
      badgeText: '38.2% Share',
      gradientClass: 'gradient-text-amber',
      isStringValue: true,
    },
    {
      title: 'Primary Location',
      value: metrics.topLocation,
      subtext: 'Highest IP traffic region',
      icon: Globe2,
      color: '#EC4899',
      badgeText: '54.9% Traffic',
      gradientClass: 'gradient-text-blue',
      isStringValue: true,
    },
  ];

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px', marginBottom: '24px' }}>
      {cards.map((card, idx) => {
        const Icon = card.icon;
        return (
          <div key={idx} className="glass-card" style={{ padding: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#9CA3AF' }}>
                {card.title}
              </span>
              <div style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                background: `${card.color}15`,
                border: `1px solid ${card.color}30`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <Icon size={18} color={card.color} />
              </div>
            </div>

            <div style={{ marginBottom: '8px' }}>
              {card.isStringValue ? (
                <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#F9FAFB', wordBreak: 'break-word' }}>
                  {card.value}
                </div>
              ) : (
                <div style={{ fontSize: '1.875rem', fontWeight: 800 }} className={card.gradientClass}>
                  {card.value}
                </div>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '12px', paddingTop: '10px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
              <span style={{ fontSize: '0.75rem', color: '#6B7280', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <CheckCircle2 size={12} color="#10B981" />
                {card.subtext}
              </span>

              <span style={{
                fontSize: '0.7rem',
                fontWeight: 700,
                color: card.color,
                background: `${card.color}15`,
                padding: '2px 8px',
                borderRadius: '9999px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
              }}>
                {card.isPulse && <span className="pulse-dot" style={{ width: '6px', height: '6px' }}></span>}
                {card.badgeText}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
};
