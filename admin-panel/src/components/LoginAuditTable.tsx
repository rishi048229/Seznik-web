import React, { useState } from 'react';
import { Search, ShieldAlert, Laptop, Smartphone, CheckCircle, AlertTriangle, MapPin } from 'lucide-react';
import type { UserLoginLog } from '../types/admin';

interface LoginAuditTableProps {
  logs: UserLoginLog[];
}

export const LoginAuditTable: React.FC<LoginAuditTableProps> = ({ logs }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const filteredLogs = logs.filter((log) => {
    const matchesSearch = 
      log.userName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.userEmail.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.ipAddress.includes(searchTerm) ||
      log.city.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.country.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || log.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="glass-card" style={{ padding: '24px', marginBottom: '24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px', marginBottom: '20px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ShieldAlert size={20} color="#3B82F6" />
            <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#F9FAFB' }}>
              User Login Audit & Active Sessions
            </h2>
          </div>
          <p style={{ margin: '4px 0 0 0', fontSize: '0.8rem', color: '#9CA3AF' }}>
            Real-time tracking of authenticated user logins, IP addresses, devices, and location.
          </p>
        </div>

        {/* Filter Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          {/* Search Box */}
          <div style={{ position: 'relative', minWidth: '240px' }}>
            <Search size={16} color="#9CA3AF" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
            <input
              type="text"
              placeholder="Search user, email, IP, city..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px 8px 36px',
                borderRadius: '8px',
                border: '1px solid #374151',
                background: '#111827',
                color: '#F9FAFB',
                fontSize: '0.8rem',
                outline: 'none',
              }}
            />
          </div>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{
              padding: '8px 12px',
              borderRadius: '8px',
              border: '1px solid #374151',
              background: '#111827',
              color: '#F9FAFB',
              fontSize: '0.8rem',
              outline: 'none',
              cursor: 'pointer',
            }}
          >
            <option value="all">All Statuses</option>
            <option value="active">Active Sessions</option>
            <option value="success">Success</option>
            <option value="failed">Failed Attempts</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div style={{ overflowX: 'auto' }}>
        <table className="custom-table">
          <thead>
            <tr>
              <th>User Details</th>
              <th>Role</th>
              <th>IP Address</th>
              <th>Location</th>
              <th>Device / Browser</th>
              <th>Timestamp</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {filteredLogs.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: '30px', color: '#9CA3AF' }}>
                  No login audit logs match your search.
                </td>
              </tr>
            ) : (
              filteredLogs.map((log) => {
                const isMobile = log.device.toLowerCase().includes('mobile') || log.device.toLowerCase().includes('tablet');
                const DeviceIcon = isMobile ? Smartphone : Laptop;

                return (
                  <tr key={log.id}>
                    <td>
                      <div>
                        <div style={{ fontWeight: 600, color: '#F9FAFB' }}>{log.userName}</div>
                        <div style={{ fontSize: '0.75rem', color: '#9CA3AF' }}>{log.userEmail}</div>
                      </div>
                    </td>
                    <td>
                      <span style={{ fontSize: '0.75rem', color: '#D1D5DB', background: '#1F2937', padding: '3px 8px', borderRadius: '4px' }}>
                        {log.userRole}
                      </span>
                    </td>
                    <td>
                      <code style={{ fontSize: '0.8rem', color: '#60A5FA', background: 'rgba(59, 130, 246, 0.1)', padding: '3px 6px', borderRadius: '4px' }}>
                        {log.ipAddress}
                      </code>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem' }}>
                        <MapPin size={14} color="#EF4444" />
                        <span>{log.city}, {log.country}</span>
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', color: '#9CA3AF' }}>
                        <DeviceIcon size={14} color="#8B5CF6" />
                        <span>{log.device} • {log.browser}</span>
                      </div>
                    </td>
                    <td>
                      <span style={{ fontSize: '0.75rem', color: '#9CA3AF' }}>
                        {new Date(log.loginAt).toLocaleString()}
                      </span>
                    </td>
                    <td>
                      {log.status === 'active' && (
                        <span className="badge badge-active">
                          <span className="pulse-dot" style={{ width: '6px', height: '6px' }}></span> Active Now
                        </span>
                      )}
                      {log.status === 'success' && (
                        <span className="badge badge-success">
                          <CheckCircle size={12} /> Logged In
                        </span>
                      )}
                      {log.status === 'failed' && (
                        <span className="badge badge-failed">
                          <AlertTriangle size={12} /> Failed
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
