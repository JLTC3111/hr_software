import { createClient } from '@supabase/supabase-js';

// Supabase configuration
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Validation - Critical for app functionality
if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Missing Supabase environment variables!');
  console.error('Required: VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY');
  console.error('Please check your .env file in the project root.');
  
  // Show user-friendly error in browser
  if (typeof window !== 'undefined') {
    const errorDiv = document.createElement('div');
    errorDiv.innerHTML = `
      <div style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.9); z-index: 999999; display: flex; align-items: center; justify-content: center; font-family: system-ui;">
        <div style="background: white; padding: 2rem; border-radius: 12px; max-width: 500px; box-shadow: 0 20px 60px rgba(0,0,0,0.3);">
          <h2 style="color: #dc2626; margin: 0 0 1rem 0; font-size: 1.5rem;">⚠️ Configuration Error</h2>
          <p style="color: #374151; margin: 0 0 1rem 0; line-height: 1.6;">
            Missing Supabase configuration. Please add the following to your <code style="background: #f3f4f6; padding: 2px 6px; border-radius: 4px;">.env</code> file:
          </p>
          <pre style="background: #1f2937; color: #10b981; padding: 1rem; border-radius: 6px; overflow-x: auto; font-size: 0.875rem;">VITE_SUPABASE_URL=your-project-url\nVITE_SUPABASE_ANON_KEY=your-anon-key</pre>
          <p style="color: #6b7280; margin: 1rem 0 0 0; font-size: 0.875rem;">
            See <code style="background: #f3f4f6; padding: 2px 6px; border-radius: 4px;">.env.example</code> for reference.
          </p>
        </div>
      </div>
    `;
    document.body.appendChild(errorDiv);
  }
  
  throw new Error('Missing required environment variables: VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY');
}

if (typeof window !== 'undefined') {
    for (const storage of [localStorage, sessionStorage]) {
      for (let i = storage.length - 1; i >= 0; i--) {
        const k = storage.key(i);
        if (k && k.startsWith('sb-') && k.includes('auth')) storage.removeItem(k);
      }
    }
  }
  
// Create Supabase client
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  },
  global: {
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    }
  },
  db: {
    schema: 'public'
  }
});

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
