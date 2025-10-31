import { useAuth } from '../contexts/AuthContext';

/**
 * usePermissions Hook
 * Provides easy access to user permissions throughout the application
 * 
 * @returns {Object} Permission flags and user role information
 */
export const usePermissions = () => {
  const { user, checkPermission } = useAuth();
  
  if (!user) {
    return {
      // All permissions false if no user
      canManageUsers: false,
      canManageEmployees: false,
      canViewReports: false,
      canManageRecruitment: false,
      canManagePerformance: false,
      canManageTimeTracking: false,
      canExportData: false,
      canViewSalaries: false,
      canManageDepartments: false,
      canManageRoles: false,
      canViewAuditLogs: false,
      // Employee-specific
      canViewOwnProfile: false,
      canUpdateOwnProfile: false,
      canViewOwnTimeTracking: false,
      canSubmitTimeoff: false,
      canViewOwnPerformance: false,
      // Role flags
      isAdmin: false,
      isManager: false,
      isEmployee: false,
      isContractor: false,
      // User info
      user: null,
      role: null
    };
  }
  
  return {
    // Admin permissions
    canManageUsers: checkPermission('canManageUsers'),
    canManageEmployees: checkPermission('canManageEmployees'),
    canViewReports: checkPermission('canViewReports'),
    canManageRecruitment: checkPermission('canManageRecruitment'),
    canManagePerformance: checkPermission('canManagePerformance'),
    canManageTimeTracking: checkPermission('canManageTimeTracking'),
    canExportData: checkPermission('canExportData'),
    canViewSalaries: checkPermission('canViewSalaries'),
    canManageDepartments: checkPermission('canManageDepartments'),
    canManageRoles: checkPermission('canManageRoles'),
    canViewAuditLogs: checkPermission('canViewAuditLogs'),
    
    // Employee-specific permissions
    canViewOwnProfile: checkPermission('canViewOwnProfile'),
    canUpdateOwnProfile: checkPermission('canUpdateOwnProfile'),
    canViewOwnTimeTracking: checkPermission('canViewOwnTimeTracking'),
    canSubmitTimeoff: checkPermission('canSubmitTimeoff'),
    canViewOwnPerformance: checkPermission('canViewOwnPerformance'),
    
    // Role flags for easy checking
    isAdmin: user?.role === 'admin',
    isManager: user?.role === 'manager',
    isEmployee: user?.role === 'employee',
    isContractor: user?.role === 'contractor',
    
    // User information
    user,
    role: user?.role,
    
    // Helper function to check if user can perform action on resource
    canAccessResource: (resourceOwnerId) => {
      // Admin and Manager can access all resources
      if (user?.role === 'admin' || user?.role === 'manager') {
        return true;
      }
      // Regular users can only access their own resources
      return String(user?.id) === String(resourceOwnerId);
    }
  };
};

export default usePermissions;
