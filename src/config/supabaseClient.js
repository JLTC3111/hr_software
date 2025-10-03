import { createClient } from '@supabase/supabase-js';

// Supabase configuration
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// Create Supabase client
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  }
});

const { data, error } = await supabase.auth.signInWithPassword({
    email: "test@example.com",
    password: "password123"
  })

// HR-specific user roles for the HR management system
export const UserRoles = {
  HR_ADMIN: 'hr_admin',        // Full system administrator
  HR_MANAGER: 'hr_manager',    // HR department manager
  EMPLOYEE: 'employee',        // Regular employee
  CONTRACTOR: 'contractor'     // Contract worker
};

// Access level permissions for HR management system
export const Permissions = {
  // HR Admin - Full system access
  [UserRoles.HR_ADMIN]: {
    canManageUsers: true,
    canManageEmployees: true,
    canViewReports: true,
    canManageRecruitment: true,
    canManagePerformance: true,
    canManageTimeTracking: true,
    canExportData: true,
    canViewSalaries: true,
    canManageDepartments: true,
    canManageRoles: true,
    canViewAuditLogs: true
  },
  // HR Manager - HR department management capabilities
  [UserRoles.HR_MANAGER]: {
    canManageUsers: false,
    canManageEmployees: true,
    canViewReports: true,
    canManageRecruitment: true,
    canManagePerformance: true,
    canManageTimeTracking: true,
    canExportData: true,
    canViewSalaries: true,
    canManageDepartments: false,
    canManageRoles: false,
    canViewAuditLogs: false
  },
  // Employee - Self-service and basic access
  [UserRoles.EMPLOYEE]: {
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
    // Employee-specific permissions
    canViewOwnProfile: true,
    canUpdateOwnProfile: true,
    canViewOwnTimeTracking: true,
    canSubmitTimeoff: true,
    canViewOwnPerformance: true
  },
  // Contractor - Limited access
  [UserRoles.CONTRACTOR]: {
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
    // Contractor-specific permissions
    canViewOwnProfile: true,
    canUpdateOwnProfile: true,
    canViewOwnTimeTracking: true,
    canSubmitTimeoff: false,
    canViewOwnPerformance: false
  }
};

// Helper function to check user permissions
export const hasPermission = (userRole, permission) => {
  return Permissions[userRole]?.[permission] || false;
};
