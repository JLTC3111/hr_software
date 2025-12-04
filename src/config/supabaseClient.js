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

// Custom storage adapter that uses localStorage by default
// This can be switched to sessionStorage when rememberMe is false
class CustomStorage {
  constructor() {
    this.storage = typeof window !== 'undefined' ? window.localStorage : null;
  }

  setStorage(storage) {
    this.storage = storage;
  }

  getItem(key) {
    return this.storage?.getItem(key) || null;
  }

  setItem(key, value) {
    this.storage?.setItem(key, value);
  }

  removeItem(key) {
    this.storage?.removeItem(key);
  }
}

export const customStorage = new CustomStorage();
  
// Create Supabase client
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    storage: customStorage,
    storageKey: 'sb-auth-token',
    flowType: 'pkce' // Use PKCE flow for better security
  },
  global: {
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    },
    fetch: (url, options = {}) => {
      // Add timeout to all fetch requests to prevent hanging
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
      
      return fetch(url, {
        ...options,
        signal: controller.signal
      }).finally(() => {
        clearTimeout(timeoutId);
      });
    }
  },
  db: {
    schema: 'public'
  },
  // Ensure proper content negotiation
  realtime: {
    headers: {
      'Accept': 'application/json'
    }
  }
});

// HR-specific user roles for the HR management system
export const UserRoles = {
  HR_ADMIN: 'admin',        // Full system administrator
  HR_MANAGER: 'manager',    // HR department manager
  EMPLOYEE: 'employee',        // Regular employee
  CONTRACTOR: 'contractor'     // Contract worker
};

// Access level permissions for HR management system
export const Permissions = {
  // HR Admin - Full system access (also supports 'admin' alias)
  'admin': {
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
  // Manager - Department management capabilities
  'manager': {
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
  // Normalize role to 'admin'
  const normalizedRole = userRole;
  return Permissions[normalizedRole]?.[permission] || Permissions[userRole]?.[permission] || false;
};
