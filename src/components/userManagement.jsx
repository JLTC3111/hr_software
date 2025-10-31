import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Trash2, 
  UserX, 
  UserCheck, 
  Search, 
  Filter,
  AlertTriangle,
  CheckCircle,
  Loader,
  Shield,
  Mail,
  Phone,
  Briefcase,
  Calendar
} from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import * as userService from '../services/userService';

const UserManagement = () => {
  const { isDarkMode, bg, text, border } = useTheme();
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
      showMessage('error', result.error || 'Failed to load users');
    }
    
    setLoading(false);
  };

  const showMessage = (type, text) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 5000);
  };

  const handleDeactivateUser = async (userId, userName) => {
    if (!window.confirm(t('userManagement.confirmDeactivate', `Are you sure you want to deactivate ${userName}? They will not be able to log in.`))) {
      return;
    }

    setActionLoading(userId);
    const result = await userService.deactivateUser(userId);
    
    if (result.success) {
      showMessage('success', t('userManagement.deactivateSuccess', 'User deactivated successfully'));
      loadUsers();
    } else {
      showMessage('error', result.error || 'Failed to deactivate user');
    }
    
    setActionLoading(null);
  };

  const handleReactivateUser = async (userId, userName) => {
    if (!window.confirm(t('userManagement.confirmReactivate', `Are you sure you want to reactivate ${userName}?`))) {
      return;
    }

    setActionLoading(userId);
    const result = await userService.reactivateUser(userId);
    
    if (result.success) {
      showMessage('success', t('userManagement.reactivateSuccess', 'User reactivated successfully'));
      loadUsers();
    } else {
      showMessage('error', result.error || 'Failed to reactivate user');
    }
    
    setActionLoading(null);
  };

  const handleDeleteUser = async (userId, userName, userEmail) => {
    // Multi-step confirmation for deletion
    const step1 = window.confirm(
      t('userManagement.confirmDelete1', 
        `⚠️ WARNING: You are about to permanently delete ${userName} (${userEmail}).\n\n` +
        'This will:\n' +
        '• Delete their account from the system\n' +
        '• Remove all their time entries\n' +
        '• Delete leave requests and overtime logs\n' +
        '• Remove performance data\n\n' +
        'This action CANNOT be undone!\n\n' +
        'Are you absolutely sure?'
      )
    );

    if (!step1) return;

    const step2 = window.prompt(
      t('userManagement.confirmDelete2', 
        `To confirm deletion, please type: DELETE ${userName.toUpperCase()}`
      )
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
      showMessage('error', result.error || 'Failed to delete user');
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
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="w-5 h-5 text-red-600" />
            <span className="text-red-800 font-medium">
              {t('userManagement.accessDenied', 'Access Denied: Admin privileges required')}
            </span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Users className={`w-8 h-8 ${text.primary}`} />
          <div>
            <h1 className={`text-2xl font-bold ${text.primary}`}>
              {t('userManagement.title', 'User Management')}
            </h1>
            <p className={`text-sm ${text.secondary}`}>
              {t('userManagement.subtitle', 'Manage user accounts and permissions')}
            </p>
          </div>
        </div>
      </div>

      {/* Message Banner */}
      {message && (
        <div 
          className={`p-4 rounded-lg border flex items-center space-x-3 ${
            message.type === 'success' 
              ? 'bg-green-50 border-green-200 text-green-800' 
              : 'bg-red-50 border-red-200 text-red-800'
          }`}
        >
          {message.type === 'success' ? (
            <CheckCircle className="w-5 h-5" />
          ) : (
            <AlertTriangle className="w-5 h-5" />
          )}
          <span>{message.text}</span>
        </div>
      )}

      {/* Search and Filters */}
      <div 
        className={`${bg.secondary} rounded-lg border ${border.primary} p-4`}
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Search */}
          <div className="relative">
            <Search className={`absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 ${text.secondary}`} />
            <input
              type="text"
              placeholder={t('userManagement.search', 'Search users...')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={`w-full pl-10 pr-4 py-2 rounded-lg border ${border.primary} ${bg.primary} ${text.primary}`}
            />
          </div>

          {/* Role Filter */}
          <select
            value={filterRole}
            onChange={(e) => setFilterRole(e.target.value)}
            className={`px-4 py-2 rounded-lg border ${border.primary} ${bg.primary} ${text.primary}`}
          >
            <option value="all">{t('userManagement.allRoles', 'All Roles')}</option>
            <option value="admin">{t('userManagement.admin', 'Admin')}</option>
            <option value="manager">{t('userManagement.hrManager', 'Manager')}</option>
            <option value="manager">{t('userManagement.manager', 'Manager')}</option>
            <option value="employee">{t('userManagement.employee', 'Employee')}</option>
          </select>

          {/* Status Filter */}
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className={`px-4 py-2 rounded-lg border ${border.primary} ${bg.primary} ${text.primary}`}
          >
            <option value="all">{t('userManagement.allStatus', 'All Status')}</option>
            <option value="active">{t('userManagement.active', 'Active')}</option>
            <option value="inactive">{t('userManagement.inactive', 'Inactive')}</option>
          </select>
        </div>
      </div>

      {/* Users Table */}
      <div 
        className={`${bg.secondary} rounded-lg border ${border.primary} overflow-hidden`}
      >
        {loading ? (
          <div className="flex items-center justify-center p-12">
            <Loader className="w-8 h-8 animate-spin text-blue-600" />
            <span className={`ml-3 ${text.primary}`}>
              {t('common.loading', 'Loading...')}
            </span>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="text-center p-12">
            <Users className={`w-12 h-12 mx-auto mb-3 ${text.secondary}`} />
            <p className={`${text.secondary}`}>
              {t('userManagement.noUsers', 'No users found')}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className={`${isDarkMode ? 'bg-gray-700' : 'bg-gray-50'}`}>
                <tr>
                  <th className={`text-left px-6 py-3 text-xs font-medium ${text.secondary} uppercase tracking-wider`}>
                    {t('userManagement.user', 'User')}
                  </th>
                  <th className={`text-left px-6 py-3 text-xs font-medium ${text.secondary} uppercase tracking-wider`}>
                    {t('userManagement.role', 'Role')}
                  </th>
                  <th className={`text-left px-6 py-3 text-xs font-medium ${text.secondary} uppercase tracking-wider`}>
                    {t('userManagement.status', 'Status')}
                  </th>
                  <th className={`text-left px-6 py-3 text-xs font-medium ${text.secondary} uppercase tracking-wider`}>
                    {t('userManagement.lastLogin', 'Last Login')}
                  </th>
                  <th className={`text-right px-6 py-3 text-xs font-medium ${text.secondary} uppercase tracking-wider`}>
                    {t('userManagement.actions', 'Actions')}
                  </th>
                </tr>
              </thead>
              <tbody className={`divide-y ${isDarkMode ? 'divide-gray-700' : 'divide-gray-200'}`}>
                {filteredUsers.map((user) => (
                  <tr key={user.id} className={`${hover.bg}`}>
                    <td className="px-6 py-4">
                      <div className="flex items-center">
                        <div 
                          className="w-10 h-10 rounded-full flex items-center justify-center overflow-hidden"
                          style={{
                            backgroundColor: isDarkMode ? '#4b5563' : '#e5e7eb'
                          }}
                        >
                          {user.avatar_url ? (
                            <img src={user.avatar_url} alt={user.full_name} className="w-full h-full object-cover" />
                          ) : (
                            <Users className="w-5 h-5 text-gray-400" />
                          )}
                        </div>
                        <div className="ml-3">
                          <p className={`font-medium ${text.primary}`}>
                            {user.full_name || user.first_name || 'N/A'}
                            {user.id === currentUser?.id && (
                              <span className="ml-2 text-xs text-blue-600 font-normal">(You)</span>
                            )}
                          </p>
                          <p className={`text-sm ${text.secondary}`}>{user.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-2">
                        <Shield className="w-4 h-4 text-blue-600" />
                        <span className={`text-sm ${text.primary} capitalize`}>
                          {user.role?.replace('_', ' ')}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span 
                        className={`px-3 py-1 text-xs font-medium rounded-full ${
                          user.is_active 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {user.is_active 
                          ? t('userManagement.active', 'Active')
                          : t('userManagement.inactive', 'Inactive')
                        }
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`text-sm ${text.secondary}`}>
                        {user.last_login 
                          ? new Date(user.last_login).toLocaleDateString()
                          : t('userManagement.never', 'Never')
                        }
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end space-x-2">
                        {user.id !== currentUser?.id && (
                          <>
                            {user.is_active ? (
                              <button
                                onClick={() => handleDeactivateUser(user.id, user.full_name)}
                                disabled={actionLoading === user.id}
                                className="p-2 text-yellow-600 hover:bg-yellow-50 rounded-lg transition-colors disabled:opacity-50"
                                title={t('userManagement.deactivate', 'Deactivate')}
                              >
                                {actionLoading === user.id ? (
                                  <Loader className="w-4 h-4 animate-spin" />
                                ) : (
                                  <UserX className="w-4 h-4" />
                                )}
                              </button>
                            ) : (
                              <button
                                onClick={() => handleReactivateUser(user.id, user.full_name)}
                                disabled={actionLoading === user.id}
                                className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors disabled:opacity-50"
                                title={t('userManagement.reactivate', 'Reactivate')}
                              >
                                {actionLoading === user.id ? (
                                  <Loader className="w-4 h-4 animate-spin" />
                                ) : (
                                  <UserCheck className="w-4 h-4" />
                                )}
                              </button>
                            )}
                            <button
                              onClick={() => handleDeleteUser(user.id, user.full_name, user.email)}
                              disabled={actionLoading === user.id}
                              className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                              title={t('userManagement.delete', 'Delete')}
                            >
                              {actionLoading === user.id ? (
                                <Loader className="w-4 h-4 animate-spin" />
                              ) : (
                                <Trash2 className="w-4 h-4" />
                              )}
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Stats Footer */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className={`${bg.secondary} rounded-lg border ${border.primary} p-4`}>
          <div className="flex items-center justify-between">
            <span className={`text-sm ${text.secondary}`}>
              {t('userManagement.totalUsers', 'Total Users')}
            </span>
            <Users className="w-5 h-5 text-blue-600" />
          </div>
          <p className={`text-2xl font-bold ${text.primary} mt-2`}>
            {users.length}
          </p>
        </div>
        <div className={`${bg.secondary} rounded-lg border ${border.primary} p-4`}>
          <div className="flex items-center justify-between">
            <span className={`text-sm ${text.secondary}`}>
              {t('userManagement.activeUsers', 'Active')}
            </span>
            <UserCheck className="w-5 h-5 text-green-600" />
          </div>
          <p className={`text-2xl font-bold ${text.primary} mt-2`}>
            {users.filter(u => u.is_active).length}
          </p>
        </div>
        <div className={`${bg.secondary} rounded-lg border ${border.primary} p-4`}>
          <div className="flex items-center justify-between">
            <span className={`text-sm ${text.secondary}`}>
              {t('userManagement.inactiveUsers', 'Inactive')}
            </span>
            <UserX className="w-5 h-5 text-red-600" />
          </div>
          <p className={`text-2xl font-bold ${text.primary} mt-2`}>
            {users.filter(u => !u.is_active).length}
          </p>
        </div>
        <div className={`${bg.secondary} rounded-lg border ${border.primary} p-4`}>
          <div className="flex items-center justify-between">
            <span className={`text-sm ${text.secondary}`}>
              {t('userManagement.admins', 'Admins')}
            </span>
            <Shield className="w-5 h-5 text-purple-600" />
          </div>
          <p className={`text-2xl font-bold ${text.primary} mt-2`}>
            {users.filter(u => u.role === 'admin').length}
          </p>
        </div>
      </div>
    </div>
  );
};

export default UserManagement;
