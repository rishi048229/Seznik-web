import React, { useState } from 'react';
import { Users, Mail, Phone, Building2, CheckCircle2, XCircle, Search } from 'lucide-react';
import type { UserRecord } from '../types/admin';

interface UserManagementViewProps {
  users: UserRecord[];
}

export const UserManagementView: React.FC<UserManagementViewProps> = ({ users }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [planFilter, setPlanFilter] = useState('all');

  const filteredUsers = users.filter((u) => {
    const matchesSearch =
      (u.displayName?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
      (u.email?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
      (u.businessName?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
      (u.phone || '').includes(searchTerm);

    const matchesPlan = planFilter === 'all' || u.plan === planFilter;
    return matchesSearch && matchesPlan;
  });

  return (
    <div className="glass-card" style={{ padding: '24px', marginBottom: '24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px', marginBottom: '20px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Users size={20} color="#8B5CF6" />
            <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#F9FAFB' }}>
              Registered System Users ({users.length})
            </h2>
          </div>
          <p style={{ margin: '4px 0 0 0', fontSize: '0.8rem', color: '#9CA3AF' }}>
            Full database list of user accounts, subscription plans, and email verification states.
          </p>
        </div>

        {/* Filter Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', minWidth: '240px' }}>
            <Search size={16} color="#9CA3AF" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
            <input
              type="text"
              placeholder="Search user name, email, business..."
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

          <select
            value={planFilter}
            onChange={(e) => setPlanFilter(e.target.value)}
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
            <option value="all">All Plans</option>
            <option value="enterprise">Enterprise</option>
            <option value="pro">Pro Plan</option>
            <option value="free">Free Plan</option>
          </select>
        </div>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table className="custom-table">
          <thead>
            <tr>
              <th>User Name & Email</th>
              <th>Business Name</th>
              <th>Phone</th>
              <th>Role</th>
              <th>Plan</th>
              <th>Verified</th>
              <th>Registered At</th>
              <th>Last Active</th>
            </tr>
          </thead>
          <tbody>
            {filteredUsers.map((u) => (
              <tr key={u.id}>
                <td>
                  <div>
                    <div style={{ fontWeight: 600, color: '#F9FAFB' }}>{u.displayName || 'No Name'}</div>
                    <div style={{ fontSize: '0.75rem', color: '#9CA3AF', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Mail size={12} /> {u.email || 'No Email'}
                    </div>
                  </div>
                </td>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', color: '#E5E7EB' }}>
                    <Building2 size={14} color="#60A5FA" />
                    <span>{u.businessName || 'Independent'}</span>
                  </div>
                </td>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', color: '#9CA3AF' }}>
                    <Phone size={12} />
                    <span>{u.phone || 'N/A'}</span>
                  </div>
                </td>
                <td>
                  <span style={{ fontSize: '0.75rem', color: '#D1D5DB', background: '#1F2937', padding: '3px 8px', borderRadius: '4px' }}>
                    {u.role}
                  </span>
                </td>
                <td>
                  {u.plan === 'enterprise' && <span className="badge badge-enterprise">Enterprise</span>}
                  {u.plan === 'pro' && <span className="badge badge-pro">Pro</span>}
                  {u.plan === 'free' && <span className="badge badge-free">Free</span>}
                </td>
                <td>
                  {u.emailVerified ? (
                    <span style={{ color: '#34D399', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <CheckCircle2 size={14} /> Verified
                    </span>
                  ) : (
                    <span style={{ color: '#9CA3AF', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <XCircle size={14} /> Unverified
                    </span>
                  )}
                </td>
                <td>
                  <span style={{ fontSize: '0.75rem', color: '#9CA3AF' }}>
                    {new Date(u.createdAt).toLocaleDateString()}
                  </span>
                </td>
                <td>
                  <span style={{ fontSize: '0.75rem', color: '#60A5FA' }}>
                    {new Date(u.lastLoginAt).toLocaleString()}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
