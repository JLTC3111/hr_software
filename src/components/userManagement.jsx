import React, { useState, useEffect, useMemo } from 'react';
import { 
  Users, 
  Trash2, 
  UserX, 
  UserCheck, 
  Search, 
  AlertTriangle,
  CheckCircle,
  Shield,
} from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import * as userService from '../services/userService';
import { SlidingNumber } from './motion-primitives';
import { PageLiveClock } from './ui/page-live-clock';
import { getIndustry, DISPLAY, BODY, figure } from '../theme/industry.js';
import { Blueprint, Tag, Kicker, ColumnHeading, FlatListbox } from './ui/industry.jsx';
import { Spinner } from './ui/Spinner.jsx';

const UserManagement = () => {
  const { isDarkMode } = useTheme();
  const ind = useMemo(() => getIndustry(isDarkMode), [isDarkMode]);
  const { t } = useLanguage();
  const { user: currentUser } = useAuth();
  
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [actionLoading, setActionLoading] = useState(null);
  const [message, setMessage] = useState(null);

  // Load users on mount
  useEffect(() => {
    loadUsers();
  }, [filterRole, filterStatus]);

  const loadUsers = async () => {
    setLoading(true);
    
    const filters = {};
    if (filterRole !== 'all') filters.role = filterRole;
    if (filterStatus === 'active') filters.is_active = true;
    if (filterStatus === 'inactive') filters.is_active = false;
    
    const result = await userService.getAllUsers(filters);
    
    if (result.success) {
      setUsers(result.data);
    } else {
      console.error('Failed to load users:', result.error);
      showMessage('error', t('userManagement.loadFailed', 'Failed to load users'));
    }
    
    setLoading(false);
  };

  const showMessage = (type, text) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 5000);
  };

  const handleDeactivateUser = async (userId, userName) => {
    const confirmation = t(
      'userManagement.confirmDeactivate',
      'Are you sure you want to deactivate {name}? They will not be able to log in.'
    ).replace('{name}', userName);
    if (!window.confirm(confirmation)) {
      return;
    }

    setActionLoading(userId);
    const result = await userService.deactivateUser(userId);
    
    if (result.success) {
      showMessage('success', t('userManagement.deactivateSuccess', 'User deactivated successfully'));
      loadUsers();
    } else {
      console.error('Failed to deactivate user:', result.error);
      showMessage('error', t('userManagement.deactivateFailed', 'Failed to deactivate user'));
    }
    
    setActionLoading(null);
  };

  const handleReactivateUser = async (userId, userName) => {
    const confirmation = t(
      'userManagement.confirmReactivate',
      'Are you sure you want to reactivate {name}?'
    ).replace('{name}', userName);
    if (!window.confirm(confirmation)) {
      return;
    }

    setActionLoading(userId);
    const result = await userService.reactivateUser(userId);
    
    if (result.success) {
      showMessage('success', t('userManagement.reactivateSuccess', 'User reactivated successfully'));
      loadUsers();
    } else {
      console.error('Failed to reactivate user:', result.error);
      showMessage('error', t('userManagement.reactivateFailed', 'Failed to reactivate user'));
    }
    
    setActionLoading(null);
  };

  const handleDeleteUser = async (userId, userName, userEmail) => {
    // Multi-step confirmation for deletion
    const step1 = window.confirm(
      t('userManagement.confirmDelete1', 
        'WARNING: You are about to permanently delete {name} ({email}).\n\n' +
        'This will:\n' +
        '• Delete their account from the system\n' +
        '• Remove all their time entries\n' +
        '• Delete leave requests and overtime logs\n' +
        '• Remove performance data\n\n' +
        'This action CANNOT be undone!\n\n' +
        'Are you absolutely sure?'
      ).replace('{name}', userName).replace('{email}', userEmail)
    );

    if (!step1) return;

    const step2 = window.prompt(
      t('userManagement.confirmDelete2', 
        'To confirm deletion, please type: DELETE {name}'
      ).replace('{name}', userName.toUpperCase())
    );

    if (step2 !== `DELETE ${userName.toUpperCase()}`) {
      alert(t('userManagement.deleteCancelled', 'Deletion cancelled. Text did not match.'));
      return;
    }

    setActionLoading(userId);
    const result = await userService.deleteUser(userId);
    
    if (result.success) {
      showMessage('success', t('userManagement.deleteSuccess', 'User deleted successfully'));
      loadUsers();
    } else {
      console.error('Failed to delete user:', result.error);
      showMessage('error', t('userManagement.deleteFailed', 'Failed to delete user'));
    }
    
    setActionLoading(null);
  };

  // Filter users by search term
  const filteredUsers = users.filter(user => {
    const searchLower = searchTerm.toLowerCase();
    return (
      user.full_name?.toLowerCase().includes(searchLower) ||
      user.email?.toLowerCase().includes(searchLower) ||
      user.position?.toLowerCase().includes(searchLower) ||
      user.department?.toLowerCase().includes(searchLower)
    );
  });

  // Check if current user is admin
  const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'Admin';

  if (!isAdmin) {
    return (
      <div style={{ padding: 24 }}>
        <Blueprint ind={ind} style={{ background: ind.ground, padding: 24, color: ind.ink }}>
          <div className="flex items-center" style={{ gap: 10 }}>
            <AlertTriangle size={16} strokeWidth={1.5} style={{ color: ind.ink, flex: 'none' }} />
            <span style={{ fontFamily: DISPLAY, fontWeight: 600, fontSize: 13, letterSpacing: '.06em', textTransform: 'uppercase' }}>
              {t('userManagement.accessDenied', 'Access Denied: Admin privileges required')}
            </span>
          </div>
        </Blueprint>
      </div>
    );
  }

  const thStyle = {
    textAlign: 'left',
    padding: '0 12px 8px',
    borderBottom: `1px solid ${ind.hairline}`,
    fontFamily: DISPLAY,
    fontWeight: 600,
    fontSize: 10,
    letterSpacing: '.12em',
    textTransform: 'uppercase',
    color: ind.inkMuted,
    whiteSpace: 'nowrap',
  };

  const iconBtn = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 32,
    height: 32,
    padding: 0,
    background: 'transparent',
    border: `1px solid ${ind.hairline}`,
    borderRadius: 0,
    color: ind.ink,
    cursor: 'pointer',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: 24, color: ind.ink, fontFamily: BODY }}>
      <div className="flex items-center justify-between" style={{ gap: 12, flexWrap: 'wrap' }}>
        <div>
          <ColumnHeading ind={ind}>{t('userManagement.title', 'User Management')}</ColumnHeading>
          <p style={{ fontFamily: BODY, fontSize: 12.5, color: ind.inkMuted, marginTop: 4 }}>
            {t('userManagement.subtitle', 'Manage user accounts and permissions')}
          </p>
        </div>
        <PageLiveClock
          showSeparator={false}
          loading={loading}
          isDarkMode={isDarkMode}
          fetchLabel={t('common.fetching', 'Fetching')}
        />
      </div>

      {message && (
        <div
          className="flex items-center"
          style={{
            gap: 10, padding: '10px 12px',
            border: `1px solid ${message.type === 'success' ? ind.hairline : ind.ink}`,
            background: message.type === 'success' ? ind.accentWash : 'transparent',
            color: ind.ink,
          }}
        >
          {message.type === 'success' ? <CheckCircle size={15} strokeWidth={1.5} /> : <AlertTriangle size={15} strokeWidth={1.5} />}
          <span style={{ fontFamily: BODY, fontSize: 13 }}>{message.text}</span>
        </div>
      )}

      <Blueprint ind={ind} style={{ background: ind.ground, padding: 16 }}>
        <div className="grid grid-cols-1 md:grid-cols-3" style={{ gap: 12 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, border: `1px solid ${ind.hairline}`, padding: '6px 10px' }}>
            <Search size={14} strokeWidth={1.5} style={{ color: ind.inkMuted, flex: 'none' }} />
            <input
              type="text"
              placeholder={t('userManagement.search', 'Search users...')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ border: 'none', outline: 'none', background: 'transparent', color: ind.ink, fontFamily: BODY, fontSize: 13, width: '100%', padding: 0 }}
            />
          </label>
          <FlatListbox
            ind={ind}
            value={filterRole}
            onChange={(e) => setFilterRole(e.target.value)}
            aria-label={t('userManagement.allRoles', 'All Roles')}
            style={{ width: '100%', padding: '8px 12px', textTransform: 'none', letterSpacing: '.02em' }}
          >
            <option value="all">{t('userManagement.allRoles', 'All Roles')}</option>
            <option value="admin">{t('userManagement.admin', 'Admin')}</option>
            <option value="manager">{t('userManagement.manager', 'Manager')}</option>
            <option value="employee">{t('userManagement.employee', 'Employee')}</option>
          </FlatListbox>
          <FlatListbox
            ind={ind}
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            aria-label={t('userManagement.allStatus', 'All Status')}
            style={{ width: '100%', padding: '8px 12px', textTransform: 'none', letterSpacing: '.02em' }}
          >
            <option value="all">{t('userManagement.allStatus', 'All Status')}</option>
            <option value="active">{t('userManagement.active', 'Active')}</option>
            <option value="inactive">{t('userManagement.inactive', 'Inactive')}</option>
          </FlatListbox>
        </div>
      </Blueprint>

      <Blueprint ind={ind} style={{ background: ind.ground, overflow: 'hidden' }}>
        {loading ? (
          <Spinner ind={ind} size="block" />
        ) : filteredUsers.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 48 }}>
            <Users size={22} strokeWidth={1.5} style={{ color: ind.inkMuted, margin: '0 auto 10px' }} />
            <p style={{ fontFamily: BODY, fontSize: 13, color: ind.inkMuted }}>{t('userManagement.noUsers', 'No users found')}</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto', padding: '16px 20px 18px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: BODY, fontSize: 13 }}>
              <thead>
                <tr>
                  <th style={thStyle}>{t('userManagement.user', 'User')}</th>
                  <th style={thStyle}>{t('userManagement.role', 'Role')}</th>
                  <th style={thStyle}>{t('userManagement.status', 'Status')}</th>
                  <th style={thStyle}>{t('userManagement.lastLogin', 'Last Login')}</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>{t('userManagement.actions', 'Actions')}</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((user) => (
                  <tr key={user.id} style={{ borderBottom: `1px solid ${ind.rule}` }}>
                    <td style={{ padding: '12px' }}>
                      <div className="flex items-center" style={{ gap: 10 }}>
                        <div
                          style={{
                            width: 36, height: 36, flex: 'none', overflow: 'hidden',
                            border: `1px solid ${ind.hairline}`,
                            background: user.avatar_url ? 'transparent' : ind.accentWash,
                            display: 'grid', placeItems: 'center',
                          }}
                        >
                          {user.avatar_url ? (
                            <img src={user.avatar_url} alt={user.full_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          ) : (
                            <Users size={14} strokeWidth={1.5} style={{ color: ind.inkMuted }} />
                          )}
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <p style={{ fontFamily: BODY, fontSize: 13, color: ind.ink, margin: 0 }}>
                            {user.full_name || user.first_name || 'N/A'}
                            {user.id === currentUser?.id && (
                              <span style={{ marginLeft: 8, fontFamily: DISPLAY, fontWeight: 600, fontSize: 10, letterSpacing: '.12em', textTransform: 'uppercase', color: ind.inkMuted }}>
                                {t('common.you', 'You')}
                              </span>
                            )}
                          </p>
                          <p style={{ fontFamily: BODY, fontSize: 12, color: ind.inkMuted, margin: 0 }}>{user.email}</p>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '12px' }}>
                      <div className="flex items-center" style={{ gap: 6 }}>
                        <Shield size={13} strokeWidth={1.5} style={{ color: ind.inkMuted }} />
                        <span style={{ textTransform: 'capitalize' }}>{user.role?.replace('_', ' ')}</span>
                      </div>
                    </td>
                    <td style={{ padding: '12px' }}>
                      <Tag ind={ind} variant={user.is_active ? 'accent' : 'outline'}>
                        {user.is_active ? t('userManagement.active', 'Active') : t('userManagement.inactive', 'Inactive')}
                      </Tag>
                    </td>
                    <td style={{ padding: '12px', color: ind.inkMuted }}>
                      {user.last_login
                        ? new Date(user.last_login).toLocaleDateString()
                        : t('userManagement.never', 'Never')}
                    </td>
                    <td style={{ padding: '12px', textAlign: 'right' }}>
                      {user.id !== currentUser?.id && (
                        <div className="inline-flex items-center" style={{ gap: 6 }}>
                          {user.is_active ? (
                            <button
                              type="button"
                              onClick={() => handleDeactivateUser(user.id, user.full_name)}
                              disabled={actionLoading === user.id}
                              style={{ ...iconBtn, opacity: actionLoading === user.id ? 0.5 : 1 }}
                              title={t('userManagement.deactivate', 'Deactivate')}
                            >
                              {actionLoading === user.id ? <Spinner ind={ind} size="inline" /> : <UserX size={14} strokeWidth={1.5} />}
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleReactivateUser(user.id, user.full_name)}
                              disabled={actionLoading === user.id}
                              style={{ ...iconBtn, opacity: actionLoading === user.id ? 0.5 : 1 }}
                              title={t('userManagement.reactivate', 'Reactivate')}
                            >
                              {actionLoading === user.id ? <Spinner ind={ind} size="inline" /> : <UserCheck size={14} strokeWidth={1.5} />}
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleDeleteUser(user.id, user.full_name, user.email)}
                            disabled={actionLoading === user.id}
                            style={{ ...iconBtn, opacity: actionLoading === user.id ? 0.5 : 1 }}
                            title={t('userManagement.delete', 'Delete')}
                          >
                            {actionLoading === user.id ? <Spinner ind={ind} size="inline" /> : <Trash2 size={14} strokeWidth={1.5} />}
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Blueprint>

      <div className="grid grid-cols-1 md:grid-cols-4" style={{ gap: 12 }}>
        {[
          [t('userManagement.totalUsers', 'Total Users'), users.length, Users],
          [t('userManagement.activeUsers', 'Active'), users.filter((u) => u.is_active).length, UserCheck],
          [t('userManagement.inactiveUsers', 'Inactive'), users.filter((u) => !u.is_active).length, UserX],
          [t('userManagement.admins', 'Admins'), users.filter((u) => u.role === 'admin').length, Shield],
        ].map(([label, value, icon]) => (
          <Blueprint key={label} ind={ind} style={{ background: ind.ground, padding: 14 }}>
            <div className="flex items-center justify-between">
              <Kicker ind={ind} color={ind.inkMuted}>{label}</Kicker>
              {React.createElement(icon, { size: 14, strokeWidth: 1.5, style: { color: ind.inkMuted } })}
            </div>
            <div style={{ ...figure(28, ind.ink), marginTop: 8 }}>
              <SlidingNumber value={value} />
            </div>
          </Blueprint>
        ))}
      </div>
    </div>
  );
};

export default UserManagement;
