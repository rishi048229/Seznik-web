import React, { useState } from 'react';
import { Users, Mail, Phone, Building2, Search, ShieldAlert, ArrowRight, Ban, CheckCircle2, UserCheck, X } from 'lucide-react';
import type { UserRecord } from '../types/admin';

interface UserManagementViewProps {
  users: UserRecord[];
  initialSearchTerm?: string | null;
  onViewUserLogs?: (userEmail?: string) => void;
  onBanUser?: (userId: string | number, reason: string) => void;
}

export const UserManagementView: React.FC<UserManagementViewProps> = ({
  users,
  initialSearchTerm,
  onViewUserLogs,
  onBanUser,
}) => {
  const [searchTerm, setSearchTerm] = useState(initialSearchTerm || '');
  const [planFilter, setPlanFilter] = useState('all');

  React.useEffect(() => {
    if (initialSearchTerm) {
      setSearchTerm(initialSearchTerm);
    }
  }, [initialSearchTerm]);

  // Modal State for Ban User
  const [selectedUserForBan, setSelectedUserForBan] = useState<UserRecord | null>(null);
  const [selectedReason, setSelectedReason] = useState<string>('Suspicious activity or unauthorized access');
  const [customReason, setCustomReason] = useState<string>('');

  // Local state for banned status mapping
  const [bannedMap, setBannedMap] = useState<Record<string | number, { banned: boolean; reason: string }>>({
    4: { banned: true, reason: 'Excessive failed security authentications' }, // Mock seed sample
  });

  const handleConfirmBan = () => {
    if (!selectedUserForBan) return;
    const finalReason = selectedReason === 'Custom Reason' ? customReason : selectedReason;

    setBannedMap((prev) => ({
      ...prev,
      [selectedUserForBan.id]: {
        banned: true,
        reason: finalReason || 'Account suspended by system administrator',
      },
    }));

    if (onBanUser) {
      onBanUser(selectedUserForBan.id, finalReason);
    }

    setSelectedUserForBan(null);
    setCustomReason('');
  };

  const handleUnban = (userId: string | number) => {
    setBannedMap((prev) => ({
      ...prev,
      [userId]: { banned: false, reason: '' },
    }));
  };

  const filteredUsers = users.filter((u) => {
    const matchesSearch =
      String(u.id).toLowerCase().includes(searchTerm.toLowerCase()) ||
      (u.uid || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (u.displayName?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
      (u.email?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
      (u.businessName?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
      (u.phone || '').includes(searchTerm);

    const matchesPlan = planFilter === 'all' || u.plan === planFilter;
    return matchesSearch && matchesPlan;
  });

  const predefinedReasons = [
    'Suspicious activity or unauthorized access',
    'Violation of Terms of Service / System Abuse',
    'Fraudulent payment or billing dispute',
    'Excessive failed security authentications',
    'Custom Reason',
  ];

  return (
    <div className="glass-card" style={{ padding: '24px', height: 'calc(100vh - 170px)', minHeight: '620px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', position: 'relative', boxSizing: 'border-box' }}>
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px', marginBottom: '20px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Users size={20} color="#8B5CF6" />
              <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-main)' }}>
                Registered System Users ({users.length})
              </h2>
            </div>
            <p style={{ margin: '4px 0 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Full merchant user roster with User IDs, account privileges, suspension controls, and activity logs.
            </p>
          </div>

          {/* Filter Controls & Action Header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            {onViewUserLogs && (
              <button
                onClick={() => onViewUserLogs()}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: 'rgba(59, 130, 246, 0.1)',
                  border: '1px solid rgba(59, 130, 246, 0.3)',
                  color: '#60A5FA',
                  padding: '8px 14px',
                  borderRadius: '8px',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                <span>View All User Activity Logs</span>
                <ArrowRight size={14} />
              </button>
            )}

            {/* Search Input */}
            <div style={{ position: 'relative', width: '220px' }}>
              <Search size={16} color="#64748B" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
              <input
                type="text"
                placeholder="Search ID, name, email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px 8px 36px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-color)',
                  backgroundColor: 'var(--bg-card)',
                  color: 'var(--text-main)',
                  fontSize: '0.8rem',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            <select
              className="custom-select"
              value={planFilter}
              onChange={(e) => setPlanFilter(e.target.value)}
              style={{
                padding: '8px 12px',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-card)',
                color: 'var(--text-main)',
                fontSize: '0.8rem',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            >
              <option value="all">All Plans</option>
              <option value="enterprise">Enterprise</option>
              <option value="pro">Pro Plan</option>
              <option value="free">Free Plan</option>
            </select>
          </div>
        </div>

        {/* Users Table */}
        <div style={{ width: '100%', overflowY: 'auto', flex: 1, minHeight: 0 }}>
        <table className="custom-table" style={{ width: '100%' }}>
          <thead>
            <tr>
              <th>User ID</th>
              <th>User Name & Email</th>
              <th>Business Name</th>
              <th>Phone</th>
              <th>Role</th>
              <th>Plan</th>
              <th>Account Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredUsers.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>
                  No merchant users match your search criteria.
                </td>
              </tr>
            ) : (
              filteredUsers.map((u) => {
                const banInfo = bannedMap[u.id];
                const isUserBanned = banInfo?.banned || u.isBanned;
                const banReasonText = banInfo?.reason || u.banReason || 'Account suspended by admin';

                return (
                  <tr key={u.id}>
                    <td>
                      <code style={{ fontSize: '0.8rem', color: '#60A5FA', background: 'rgba(59, 130, 246, 0.1)', padding: '3px 8px', borderRadius: '4px', fontWeight: 700 }}>
                        #{u.id}
                      </code>
                    </td>
                    <td>
                      <div>
                        <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>{u.displayName || 'No Name'}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Mail size={12} /> {u.email || 'No Email'}
                        </div>
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', color: 'var(--text-main)' }}>
                        <Building2 size={14} color="#2563EB" />
                        <span>{u.businessName || 'Independent'}</span>
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        <Phone size={12} />
                        <span>{u.phone || 'N/A'}</span>
                      </div>
                    </td>
                    <td>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', background: 'var(--bg-card-hover)', padding: '3px 8px', borderRadius: '4px', border: '1px solid var(--border-color)' }}>
                        {u.role}
                      </span>
                    </td>
                    <td>
                      {u.plan === 'enterprise' && <span className="badge badge-enterprise">Enterprise</span>}
                      {u.plan === 'pro' && <span className="badge badge-pro">Pro</span>}
                      {u.plan === 'free' && <span className="badge badge-free">Free</span>}
                    </td>
                    <td>
                      {isUserBanned ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                          <span className="badge badge-failed">
                            <ShieldAlert size={12} /> Banned
                          </span>
                          <span style={{ fontSize: '0.7rem', color: '#F87171', maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={banReasonText}>
                            {banReasonText}
                          </span>
                        </div>
                      ) : u.emailVerified ? (
                        <span className="badge badge-active">
                          <UserCheck size={12} /> Verified
                        </span>
                      ) : (
                        <span className="badge badge-free">
                          Unverified
                        </span>
                      )}
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {/* View Logs Button */}
                        {onViewUserLogs && (
                          <button
                            onClick={() => onViewUserLogs(u.email || String(u.id))}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              background: 'var(--bg-card)',
                              border: '1px solid var(--border-color)',
                              color: '#2563EB',
                              fontSize: '0.75rem',
                              fontWeight: 600,
                              cursor: 'pointer',
                              padding: '5px 10px',
                              borderRadius: '6px',
                            }}
                          >
                            <span>View logs</span>
                            <ArrowRight size={12} />
                          </button>
                        )}

                        {/* Ban / Unban Button */}
                        {isUserBanned ? (
                          <button
                            onClick={() => handleUnban(u.id)}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              background: 'rgba(16, 185, 129, 0.15)',
                              border: '1px solid rgba(16, 185, 129, 0.3)',
                              color: '#34D399',
                              fontSize: '0.75rem',
                              fontWeight: 600,
                              cursor: 'pointer',
                              padding: '5px 10px',
                              borderRadius: '6px',
                            }}
                          >
                            <CheckCircle2 size={12} />
                            <span>Unban</span>
                          </button>
                        ) : (
                          <button
                            onClick={() => setSelectedUserForBan(u)}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              background: 'rgba(244, 63, 94, 0.15)',
                              border: '1px solid rgba(244, 63, 94, 0.3)',
                              color: '#FB7185',
                              fontSize: '0.75rem',
                              fontWeight: 600,
                              cursor: 'pointer',
                              padding: '5px 10px',
                              borderRadius: '6px',
                            }}
                          >
                            <Ban size={12} />
                            <span>Ban User</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>

      {/* BAN USER POPUP MODAL */}
      {selectedUserForBan && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 100,
            background: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
          }}
        >
          <div
            className="glass-card"
            style={{
              width: '100%',
              maxWidth: '480px',
              padding: '24px',
              background: 'var(--bg-card)',
              border: '1px solid rgba(244, 63, 94, 0.4)',
              borderRadius: '16px',
              boxShadow: '0 20px 40px rgba(0, 0, 0, 0.15)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(244, 63, 94, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Ban size={20} color="#F87171" />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-main)' }}>
                    Ban User Account
                  </h3>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    User ID: #{selectedUserForBan.id} • {selectedUserForBan.displayName}
                  </div>
                </div>
              </div>

              <button
                onClick={() => setSelectedUserForBan(null)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '16px', lineHeight: '1.4' }}>
              Are you sure you want to suspend <strong style={{ color: 'var(--text-main)' }}>{selectedUserForBan.email}</strong>? Please select a reason for auditing purposes:
            </p>

            {/* Select Reason */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
              {predefinedReasons.map((reason) => (
                <label
                  key={reason}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    background: selectedReason === reason ? 'rgba(59, 130, 246, 0.12)' : 'var(--bg-card-hover)',
                    border: `1px solid ${selectedReason === reason ? '#3B82F6' : 'var(--border-color)'}`,
                    cursor: 'pointer',
                    fontSize: '0.8rem',
                    color: 'var(--text-main)',
                  }}
                >
                  <input
                    type="radio"
                    name="banReason"
                    checked={selectedReason === reason}
                    onChange={() => setSelectedReason(reason)}
                    style={{ accentColor: '#3B82F6' }}
                  />
                  <span>{reason}</span>
                </label>
              ))}
            </div>

            {/* Custom Reason Textarea if selected */}
            {selectedReason === 'Custom Reason' && (
              <div style={{ marginBottom: '16px' }}>
                <textarea
                  placeholder="Enter custom ban reason or admin note..."
                  value={customReason}
                  onChange={(e) => setCustomReason(e.target.value)}
                  rows={3}
                  style={{
                    width: '100%',
                    padding: '10px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color)',
                    background: 'var(--bg-card)',
                    color: 'var(--text-main)',
                    fontSize: '0.8rem',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
            )}

            {/* Modal Actions */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
              <button
                onClick={() => setSelectedUserForBan(null)}
                style={{
                  padding: '8px 16px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-color)',
                  background: 'var(--bg-card)',
                  color: 'var(--text-muted)',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>

              <button
                onClick={handleConfirmBan}
                style={{
                  padding: '8px 16px',
                  borderRadius: '8px',
                  border: 'none',
                  background: 'linear-gradient(135deg, #EF4444 0%, #DC2626 100%)',
                  color: '#FFFFFF',
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(239, 68, 68, 0.4)',
                }}
              >
                Confirm & Ban Account
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
