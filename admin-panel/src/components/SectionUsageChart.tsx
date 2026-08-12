import React from 'react';
import { LayoutGrid, TrendingUp, TrendingDown, Eye, Clock, Users } from 'lucide-react';
import type { SectionUsage } from '../types/admin';

interface SectionUsageChartProps {
  sections: SectionUsage[];
  showInsights?: boolean;
}

export const SectionUsageChart: React.FC<SectionUsageChartProps> = ({ sections, showInsights = true }) => {
  return (
    <div style={{ 
      display: 'grid', 
      gridTemplateColumns: showInsights ? 'repeat(auto-fit, minmax(320px, 1fr))' : '1fr', 
      gap: '20px', 
      marginBottom: '24px' 
    }}>
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

        <div style={{ overflowX: 'auto' }}>
          <table className="custom-table">
            <thead>
              <tr>
                <th>Section Name</th>
                <th>Unique Users</th>
                <th>Average Session</th>
                <th>Increase in Time</th>
              </tr>
            </thead>
            <tbody>
              {sections.map((sec) => (
                <tr key={sec.id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontWeight: 600, color: '#F9FAFB' }}>{sec.sectionName}</span>
                      <code style={{ fontSize: '0.75rem', color: '#60A5FA', background: 'rgba(59, 130, 246, 0.1)', padding: '2px 6px', borderRadius: '4px' }}>
                        {sec.path}
                      </code>
                    </div>
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600, color: '#E5E7EB' }}>
                      <Users size={14} color="#C084FC" />
                      <span>{sec.uniqueUsers} Users</span>
                    </div>
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#E5E7EB' }}>
                      <Clock size={14} color="#FBBF24" />
                      <span>{sec.avgDurationMinutes} mins</span>
                    </div>
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700, color: sec.trend === 'down' ? '#F43F5E' : '#34D399' }}>
                      {sec.trend === 'down' ? <TrendingDown size={14} color="#F43F5E" /> : <TrendingUp size={14} color="#34D399" />}
                      <span>+{sec.trendPercent}%</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Feature Engagement Insights */}
      {showInsights && (
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
      )}
    </div>
  );
};
