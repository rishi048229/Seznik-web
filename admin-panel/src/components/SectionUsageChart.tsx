import React from 'react';
import { LayoutGrid, TrendingUp, TrendingDown, Eye, Clock, Users } from 'lucide-react';
import type { SectionUsage } from '../types/admin';

interface SectionUsageChartProps {
  sections: SectionUsage[];
}

export const SectionUsageChart: React.FC<SectionUsageChartProps> = ({ sections }) => {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px', marginBottom: '24px' }}>
      {/* Section Heatmap Bars */}
      <div className="glass-card" style={{ padding: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <LayoutGrid size={20} color="#F59E0B" />
              <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#F9FAFB' }}>
                Section & Feature Traffic Breakdown
              </h2>
            </div>
            <p style={{ margin: '4px 0 0 0', fontSize: '0.8rem', color: '#9CA3AF' }}>
              Which sections users visit and use the most.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {sections.map((sec) => (
            <div key={sec.id} style={{ background: '#111827', padding: '14px 16px', borderRadius: '12px', border: '1px solid #1F2937' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <div>
                  <span style={{ fontWeight: 600, color: '#F9FAFB', fontSize: '0.9rem' }}>
                    {sec.sectionName}
                  </span>
                  <code style={{ marginLeft: '8px', fontSize: '0.75rem', color: '#3B82F6' }}>{sec.path}</code>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', fontWeight: 700, color: '#34D399' }}>
                  {sec.trend === 'up' && <TrendingUp size={14} color="#34D399" />}
                  {sec.trend === 'down' && <TrendingDown size={14} color="#F43F5E" />}
                  <span>{sec.percentageShare}% share</span>
                </div>
              </div>

              {/* Progress bar */}
              <div style={{ height: '8px', width: '100%', background: '#1F2937', borderRadius: '4px', overflow: 'hidden', marginBottom: '10px' }}>
                <div 
                  style={{ 
                    height: '100%', 
                    width: `${sec.percentageShare * 2}%`, 
                    maxWidth: '100%',
                    background: 'linear-gradient(90deg, #3B82F6 0%, #8B5CF6 100%)',
                    borderRadius: '4px'
                  }} 
                />
              </div>

              {/* Stats detail row */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.75rem', color: '#9CA3AF' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Eye size={12} color="#60A5FA" /> {sec.viewCount.toLocaleString()} Total Views
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Users size={12} color="#C084FC" /> {sec.uniqueUsers} Unique Users
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Clock size={12} color="#FBBF24" /> {sec.avgDurationMinutes}m Avg Session
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Feature Engagement Insights */}
      <div className="glass-card" style={{ padding: '24px' }}>
        <h2 style={{ margin: '0 0 16px 0', fontSize: '1.1rem', fontWeight: 700, color: '#F9FAFB' }}>
          Top Feature Engagement Insights
        </h2>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ padding: '14px', borderRadius: '12px', background: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.2)' }}>
            <h3 style={{ margin: '0 0 4px 0', fontSize: '0.9rem', color: '#60A5FA', fontWeight: 600 }}>
              🥇 POS Lite Billing (#1 Most Used)
            </h3>
            <p style={{ margin: 0, fontSize: '0.8rem', color: '#D1D5DB' }}>
              Drives 38.2% of all daily session traffic. Cashiers and store managers average 18.5 minutes per billing session.
            </p>
          </div>

          <div style={{ padding: '14px', borderRadius: '12px', background: 'rgba(139, 92, 246, 0.1)', border: '1px solid rgba(139, 92, 246, 0.2)' }}>
            <h3 style={{ margin: '0 0 4px 0', fontSize: '0.9rem', color: '#C084FC', fontWeight: 600 }}>
              🥈 Label Studio & Barcode Designer (+22.1% Surge)
            </h3>
            <p style={{ margin: 0, fontSize: '0.8rem', color: '#D1D5DB' }}>
              Highest growth rate section. Over 9,840 label templates generated and printed on thermal hardware printers.
            </p>
          </div>

          <div style={{ padding: '14px', borderRadius: '12px', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
            <h3 style={{ margin: '0 0 4px 0', fontSize: '0.9rem', color: '#34D399', fontWeight: 600 }}>
              🥉 Quick Token Generator (+18.0%)
            </h3>
            <p style={{ margin: 0, fontSize: '0.8rem', color: '#D1D5DB' }}>
              Used heavily during peak hours for issuing chai, coffee, and ticket slips rapidly without creating full tax invoices.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
