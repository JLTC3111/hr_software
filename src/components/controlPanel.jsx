import React, { useState, useEffect, useRef } from 'react';
import { User, LogOut, Key, BookOpen, Expand, Shield, Info, RefreshCcw, Activity, Camera, KeySquare, Loader, Users, Eye, EyeOff, Check, AlertCircle } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../config/supabaseClient';
import { isDemoMode, getDemoEmployeeName, resetAllDemoData, resetDemoTimeEntries, resetDemoGoals, resetDemoTasks, resetDemoReviews, resetDemoSkills, resetDemoLeaveRequests } from '../utils/demoHelper';
import { fetchVisitSummary } from '../services/visitService';

const ControlPanel = () => {
  const { isDarkMode, bg, text, border } = useTheme();
  const { t } = useLanguage();
  const { user, signOut, switchDemoRole } = useAuth();
  const navigate = useNavigate();
  const [showChangePassword, setShowChangePassword] = useState(false);
  const isChangingPassword = useRef(false);
  
  // Check localStorage on mount for password change in progress
  useEffect(() => {
    const changingPwd = localStorage.getItem('changingPassword');
    if (changingPwd === 'true') {
      isChangingPassword.current = true;
      setShowChangePassword(false);
      console.log('🔄 Restored isChangingPassword from localStorage');
    }
  }, []);
  const [passwordForm, setPasswordForm] = useState({
    newPassword: '',
    confirmPassword: ''
  });
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState(user?.avatar_url || null);
  const [avatarSuccess, setAvatarSuccess] = useState('');
  
  // Password visibility states
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  // Admin password reset states
  const [showAdminReset, setShowAdminReset] = useState(false);
  const [allUsers, setAllUsers] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [adminResetPassword, setAdminResetPassword] = useState('');
  const [adminResetConfirm, setAdminResetConfirm] = useState('');
  const [adminResetError, setAdminResetError] = useState('');
  const [adminResetSuccess, setAdminResetSuccess] = useState('');
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [showAdminPassword, setShowAdminPassword] = useState(false);
  const [showAdminConfirm, setShowAdminConfirm] = useState(false);

  // Admin employee password reset states
  const [showEmployeeReset, setShowEmployeeReset] = useState(false);
  const [allEmployees, setAllEmployees] = useState([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [employeeResetPassword, setEmployeeResetPassword] = useState('');
  const [employeeResetConfirm, setEmployeeResetConfirm] = useState('');
  const [employeeResetError, setEmployeeResetError] = useState('');
  const [employeeResetSuccess, setEmployeeResetSuccess] = useState('');
  const [loadingEmployees, setLoadingEmployees] = useState(false);
  const [showEmployeePassword, setShowEmployeePassword] = useState(false);
  const [showEmployeeConfirm, setShowEmployeeConfirm] = useState(false);

  // Demo Data Management state
  const [showDemoDataManagement, setShowDemoDataManagement] = useState(false);
  const [restoringDemoData, setRestoringDemoData] = useState(null);

  // Toast notification state
  const [toast, setToast] = useState({ show: false, message: '', type: '' });

  // Visit analytics (admin only)
  const [visitSummary, setVisitSummary] = useState({ total: 0, last24h: 0, distinctIps: 0, recent: [] });
  const [loadingVisits, setLoadingVisits] = useState(false);
  const [visitError, setVisitError] = useState('');

  // Get user role and info
  const userRole = user?.user_metadata?.role || user?.role || 'Employee';
  const userName = user?.name || user?.user_metadata?.name || user?.email?.split('@')[0] || 'User';
  const userEmail = user?.email || '';
  const userId = user?.id || '';
  const employeeId = user?.employee_id || user?.employeeId || null;
  const isAdmin = userRole === 'admin' || userRole === 'Admin';

  // Debug: Monitor showChangePassword state changes
  useEffect(() => {
    // Check both ref and localStorage
    const changingPwd = localStorage.getItem('changingPassword') === 'true';
    console.log('🔄 showChangePassword state changed to:', showChangePassword, '| isChangingPassword.current:', isChangingPassword.current, '| localStorage:', changingPwd);
    
    // Aggressively prevent form from reopening during password change process
    if ((isChangingPassword.current || changingPwd) && showChangePassword) {
      console.log('⚠️ FORCE CLOSING form during password change process');
      isChangingPassword.current = true; // Ensure ref is set
      setShowChangePassword(false);
    }
  }, [showChangePassword]);

  // Fetch all users for admin password reset
  useEffect(() => {
    if (isAdmin && showAdminReset) {
      fetchAllUsers();
    }
  }, [isAdmin, showAdminReset]);

  // Fetch all employees for admin employee password reset
  useEffect(() => {
    if (isAdmin && showEmployeeReset) {
      fetchAllEmployees();
    }
  }, [isAdmin, showEmployeeReset]);

  // Load visit analytics for admins
  useEffect(() => {
    const loadVisits = async () => {
      if (!isAdmin) return;
      setLoadingVisits(true);
      setVisitError('');
      const result = await fetchVisitSummary();
      if (result.success) {
        setVisitSummary(result.data);
      } else {
        setVisitError(result.error || 'Failed to load visit summary');
      }
      setLoadingVisits(false);
    };

    loadVisits();
  }, [isAdmin]);

  const fetchAllUsers = async () => {
    setLoadingUsers(true);
    try {
      if (isDemoMode()) {
        setAllUsers([
          { id: 'demo-user-id', full_name: 'Demo Admin', email: 'demo@example.com', role: 'admin' },
          { id: 'mock-user-2', full_name: 'Sarah Connor', email: 'sarah@example.com', role: 'employee' }
        ]);
        setLoadingUsers(false);
        return;
      }

      // Fetch users from hr_users
      const { data: usersData, error: usersError } = await supabase
        .from('hr_users')
        .select('id, full_name, email, role')
        .order('full_name');
      
      if (usersError) throw usersError;

      // For each user, try to get their primary email from user_emails table
      const usersWithPrimaryEmail = await Promise.all(
        (usersData || []).map(async (user) => {
          // Try to get primary email from user_emails
          const { data: emailData } = await supabase
            .from('user_emails')
            .select('email')
            .eq('user_id', user.id)
            .single();
          
          // Use primary email if found, otherwise use first email from hr_users.email
          const primaryEmail = emailData?.email || user.email.split(';')[0].trim();
          
          return {
            ...user,
            email: primaryEmail
          };
        })
      );
      
      setAllUsers(usersWithPrimaryEmail);
    } catch (error) {
      console.error('Error fetching users:', error);
      setAdminResetError(t('controlPanel.errorFetchingUsers', 'Error loading users'));
    } finally {
      setLoadingUsers(false);
    }
  };

  const fetchAllEmployees = async () => {
    setLoadingEmployees(true);
    try {
      if (isDemoMode()) {
        setAllEmployees([
          { id: 'demo-emp-1', name: 'Demo Admin', email: 'tech@company.com', user_id: 'demo-user-id' },
          { id: 'mock-emp-2', name: 'Demo Limited', email: 'limited_account@example.com', user_id: 'mock-user-2' }
        ]);
        setLoadingEmployees(false);
        return;
      }

      const { data, error } = await supabase
        .from('employees')
        .select('id, name, email, user_id')
        .order('name');
      
      if (error) throw error;
      setAllEmployees(data || []);
    } catch (error) {
      console.error('Error fetching employees:', error);
      setEmployeeResetError(t('controlPanel.errorFetchingEmployees', 'Error loading employees'));
    } finally {
      setLoadingEmployees(false);
    }
  };

  // Function to get translated role name
  const getTranslatedRole = (role) => {
    const roleMap = {
      'admin': t('controlPanel.roles.admin', 'Admin'),
      'demo_admin': t('controlPanel.roles.demoAdmin', 'Demo Admin'),
      'hr_manager': t('controlPanel.roles.hrManager', 'HR Manager'),
      'manager': t('controlPanel.roles.manager', 'Manager'),
      'employee': t('controlPanel.roles.employee', 'Employee'),
      'viewer': t('controlPanel.roles.viewer', 'Viewer'),
      'Demo Admin': t('controlPanel.roles.demoAdmin', 'Demo Admin'),
      'Admin': t('controlPanel.roles.admin', 'Admin'),
      'HR Manager': t('controlPanel.roles.hrManager', 'HR Manager'),
      'Manager': t('controlPanel.roles.manager', 'Manager'),
      'Employee': t('controlPanel.roles.employee', 'Employee'),
      'Viewer': t('controlPanel.roles.viewer', 'Viewer')
    };
    return roleMap[role] || role;
  };

  // Role descriptions with detailed permissions
  const roleDescriptions = {
    'admin': t('controlPanel.roleDesc.admin', 'Full system access with all administrative privileges'),
    'demo_admin': t('controlPanel.roleDesc.demoAdmin', 'Demo admin access: full UI visibility but actions are simulated and limited.'),
    'manager': t('controlPanel.roleDesc.hrManager', 'Manage employees, performance reviews, and HR operations'),
    'employee': t('controlPanel.roleDesc.employee', 'Access personal information and submit time entries'),
    'viewer': t('controlPanel.roleDesc.viewer', 'View-only access to reports and dashboards'),
    'Demo Admin': t('controlPanel.roleDesc.demoAdmin', 'Demo admin access: full UI visibility but actions are simulated and limited.'),
    'Admin': t('controlPanel.roleDesc.admin', 'Full system access with all administrative privileges'),
    'HR Manager': t('controlPanel.roleDesc.hrManager', 'Manage employees, performance reviews, and HR operations'),
    'Manager': t('controlPanel.roleDesc.manager', 'Supervise team members and approve time tracking'),
    'Employee': t('controlPanel.roleDesc.employee', 'Access personal information and submit time entries'),
    'Viewer': t('controlPanel.roleDesc.viewer', 'View-only access to reports and dashboards')
  };

  const handleLogout = async () => {
    if (window.confirm(t('controlPanel.confirmLogout', 'Are you sure you want to log out?'))) {
      await signOut();
      navigate('/login');
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    
    // Prevent multiple simultaneous submissions
    if (isChangingPassword.current) {
      console.log('⏸️ Password change already in progress, ignoring duplicate submission');
      return;
    }
    
    console.log('🔐 Starting password change process...');
    isChangingPassword.current = true;
    localStorage.setItem('changingPassword', 'true');
    console.log('💾 Saved changingPassword flag to localStorage');
    setPasswordError('');
    setPasswordSuccess('');

    // Validation
    if (!passwordForm.newPassword || !passwordForm.confirmPassword) {
      console.log('❌ Validation failed: Missing fields');
      setPasswordError(t('controlPanel.allFieldsRequired', 'All fields are required'));
      isChangingPassword.current = false;
      localStorage.removeItem('changingPassword');
      return;
    }

    if (passwordForm.newPassword.length < 6) {
      console.log('❌ Validation failed: Password too short');
      setPasswordError(t('controlPanel.passwordTooShort', 'Password must be at least 6 characters'));
      isChangingPassword.current = false;
      localStorage.removeItem('changingPassword');
      return;
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      console.log('❌ Validation failed: Passwords do not match');
      setPasswordError(t('controlPanel.passwordsDontMatch', 'Passwords do not match'));
      isChangingPassword.current = false;
      localStorage.removeItem('changingPassword');
      return;
    }

    console.log('✅ Validation passed');

    try {
      // Update to the new password directly (Supabase will verify the user is authenticated)
      if (isDemoMode()) {
        console.log('🔄 Simulating password change in demo mode...');
        await new Promise(resolve => setTimeout(resolve, 1000));
      } else {
        const { error } = await supabase.auth.updateUser({
          password: passwordForm.newPassword
        });

        if (error) {
          console.log('❌ Password update failed:', error.message);
          throw error;
        }
      }
      console.log('✅ Password updated successfully in Supabase');

      // Clear all states first
      console.log('🧹 Clearing form states...');
      setPasswordError('');
      setPasswordSuccess('');
      setPasswordForm({ newPassword: '', confirmPassword: '' });
      
      // Close the form immediately
      console.log('🚪 Closing password change form');
      setShowChangePassword(false);
      
      // Show success toast notification
      console.log('📢 Showing success toast...');
      setToast({
        show: true,
        message: t('controlPanel.passwordChanged', 'Password changed successfully!'),
        type: 'success'
      });
      
      // IMPORTANT: Clear the flag immediately after a brief delay to allow the USER_UPDATED event to complete
      // This prevents the form from reopening during the auth state update
      setTimeout(() => {
        console.log('� Clearing changingPassword flag (allowing form to be opened again)');
        isChangingPassword.current = false;
        localStorage.removeItem('changingPassword');
      }, 2000); // 2 seconds - enough time for USER_UPDATED to complete
      
      // Hide toast after 4 seconds
      setTimeout(() => {
        console.log('🔕 Hiding toast');
        setToast({ show: false, message: '', type: '' });
      }, 4000);
    } catch (error) {
      console.error('❌ Password change error:', error);
      setPasswordError(error.message || t('controlPanel.passwordChangeError', 'Error changing password'));
      isChangingPassword.current = false;
      localStorage.removeItem('changingPassword');
    }
  };

  const handleOthersPassword = async (e) => {
    e.preventDefault();
    setAdminResetError('');
    setAdminResetSuccess('');

    // Validation
    if (!selectedUserId) {
      setAdminResetError(t('controlPanel.selectUserFirst', 'Please select a user first'));
      return;
    }

    if (!adminResetPassword || !adminResetConfirm) {
      setAdminResetError(t('controlPanel.allFieldsRequired', 'All fields are required'));
      return;
    }

    if (adminResetPassword.length < 6) {
      setAdminResetError(t('controlPanel.passwordTooShort', 'Password must be at least 6 characters'));
      return;
    }

    if (adminResetPassword !== adminResetConfirm) {
      setAdminResetError(t('controlPanel.passwordsDontMatch', 'Passwords do not match'));
      return;
    }

    const selectedUser = allUsers.find(u => u.id === selectedUserId);
    if (!selectedUser) {
      setAdminResetError(t('controlPanel.userNotFound', 'User not found'));
      return;
    }

    // Confirm action
    const confirmMessage = `Are you sure you want to reset password for ${selectedUser.full_name || selectedUser.email}?\n\nUser: ${selectedUser.full_name}\nEmail: ${selectedUser.email}\nRole: ${getTranslatedRole(selectedUser.role)}`;
    if (!window.confirm(confirmMessage)) {
      return;
    }

    try {
      if (isDemoMode()) {
        console.log('🔄 Simulating admin password reset in demo mode...');
        await new Promise(resolve => setTimeout(resolve, 1000));
        console.log('✅ Password reset successfully in demo mode');
        
        setAdminResetSuccess(t('controlPanel.passwordResetSuccess', 'Password reset successfully'));
        setAdminResetForm({ newPassword: '', confirmPassword: '' });
        setSelectedUserId('');
        
        setTimeout(() => {
          setAdminResetSuccess('');
        }, 5000);
        return;
      }

      // Get the current user's session token
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw new Error('No active session');
      }

      // Call the Edge Function to reset password with service role
      const response = await fetch(
        `${supabase.supabaseUrl}/functions/v1/admin-reset-password`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            userId: selectedUserId,
            newPassword: adminResetPassword
          })
        }
      );

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to reset password');
      }

      setAdminResetSuccess(t('controlPanel.passwordResetSuccess', `Password successfully reset for ${selectedUser.full_name}!`));
      
      // Clear the form
      setAdminResetPassword('');
      setAdminResetConfirm('');
      setSelectedUserId('');
      
      // Show success toast
      setToast({
        show: true,
        message: t('controlPanel.passwordResetSuccess', `Password successfully reset for ${selectedUser.full_name}!`),
        type: 'success'
      });
      
      // Close the window after showing success message
      setTimeout(() => {
        setShowAdminReset(false);
        setAdminResetSuccess('');
      }, 3000);
      
      // Hide toast after 3 seconds
      setTimeout(() => {
        setToast({ show: false, message: '', type: '' });
      }, 3000);
    } catch (error) {
      console.error('Admin password reset error:', error);
      setAdminResetError(error.message || t('controlPanel.passwordResetError', 'Error resetting password. You may need admin service role access.'));
    }
  };

  const handleEmployeeResetPassword = async (e) => {
    e.preventDefault();
    setEmployeeResetError('');
    setEmployeeResetSuccess('');

    // Validation
    if (!selectedEmployeeId) {
      setEmployeeResetError(t('controlPanel.selectUserFirst', 'Please select a user first'));
      return;
    }

    if (!employeeResetPassword || !employeeResetConfirm) {
      setEmployeeResetError(t('controlPanel.allFieldsRequired', 'All fields are required'));
      return;
    }

    if (employeeResetPassword.length < 6) {
      setEmployeeResetError(t('controlPanel.passwordTooShort', 'Password must be at least 6 characters'));
      return;
    }

    if (employeeResetPassword !== employeeResetConfirm) {
      setEmployeeResetError(t('controlPanel.passwordsDontMatch', 'Passwords do not match'));
      return;
    }

    const selectedEmployee = allEmployees.find(e => e.id === selectedEmployeeId);
    if (!selectedEmployee) {
      setEmployeeResetError(t('controlPanel.employeeNotFound', 'Employee not found'));
      return;
    }

    if (!selectedEmployee.user_id) {
      setEmployeeResetError('Employee does not have a user account');
      return;
    }

    // Confirm action
    if (!window.confirm(t('controlPanel.confirmResetEmployeePassword', `Are you sure you want to reset password for employee ${getDemoEmployeeName(selectedEmployee, t)}?`))) {
      return;
    }

    try {
      if (isDemoMode()) {
        console.log('🔄 Simulating employee password reset in demo mode...');
        await new Promise(resolve => setTimeout(resolve, 1000));
      } else {
        // Call Supabase admin API to update employee's user password
        const { data, error } = await supabase.auth.admin.updateUserById(
          selectedEmployee.user_id,
          { password: employeeResetPassword }
        );

        if (error) {
          throw error;
        }
      }

      setEmployeeResetSuccess(t('controlPanel.passwordResetSuccessEmployee', `Password reset successfully for employee ${getDemoEmployeeName(selectedEmployee, t)}!`));
      setEmployeeResetPassword('');
      setEmployeeResetConfirm('');
      setSelectedEmployeeId('');
      
      // Show success toast
      setToast({
        show: true,
        message: t('controlPanel.passwordResetSuccessEmployee', `Password reset successfully for employee ${getDemoEmployeeName(selectedEmployee, t)}!`),
        type: 'success'
      });
      
      setTimeout(() => {
        setEmployeeResetSuccess('');
        setShowEmployeeReset(false);
        setToast({ show: false, message: '', type: '' });
      }, 3000);
    } catch (error) {
      console.error('Employee password reset error:', error);
      setEmployeeResetError(error.message || t('controlPanel.passwordResetError', 'Error resetting password. You may need admin service role access.'));
    }
  };

  const openManual = () => {
    // In demo, route to AdvancedHelpCenter; in production, route to ProductionHelpCenter
    navigate(isDemoMode() ? '/help-center' : '/production-help');
  };

  const handleAvatarUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validate file
    if (!file.type.startsWith('image/')) {
      alert(t('errors.invalidFileType', 'Please select an image file'));
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      alert(t('errors.fileTooLarge', 'File size must be less than 5MB'));
      return;
    }

    setUploadingAvatar(true);

    try {
      // For now, convert to base64 data URL instead of using storage
      // This avoids the storage bucket requirement
      const reader = new FileReader();
      
      reader.onloadend = async () => {
        const base64Data = reader.result;
        
        try {
          if (isDemoMode()) {
             setAvatarUrl(base64Data);
             setAvatarSuccess(t('controlPanel.avatarUpdated', 'Avatar updated successfully!'));
             setUploadingAvatar(false);
             return;
          }

          // Update user profile with avatar data URL
          const { error: updateError } = await supabase
            .from('hr_users')
            .update({ avatar_url: base64Data })
            .eq('id', user.id);

          if (updateError) throw updateError;

          // Also update employee photo if user has an employee_id
          if (user.employeeId) {
            const { error: empUpdateError } = await supabase
              .from('employees')
              .update({ photo: base64Data })
              .eq('id', user.employeeId);

            if (empUpdateError) {
              console.warn('Could not update employee photo:', empUpdateError);
            }
          }

          setAvatarUrl(base64Data);
          setAvatarSuccess(t('controlPanel.avatarUpdated', 'Avatar updated successfully!'));
          setUploadingAvatar(false);
          
          // Clear success message after 5 seconds
          setTimeout(() => {
            setAvatarSuccess('');
          }, 5000);
        } catch (error) {
          console.error('Error updating avatar:', error);
          alert(t('controlPanel.avatarError', 'Error uploading avatar'));
          setUploadingAvatar(false);
        }
      };
      
      reader.onerror = () => {
        setAvatarSuccess('');
        alert(t('errors.fileReadError', 'Error reading file'));
        setUploadingAvatar(false);
      };
      
      reader.readAsDataURL(file);
    } catch (error) {
      console.error('Error uploading avatar:', error);
      setAvatarSuccess('');
      alert(t('controlPanel.avatarError', 'Error uploading avatar'));
      setUploadingAvatar(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* User Info Card */}
      <div 
        className="rounded-lg shadow-sm p-4"
        style={{
          backgroundColor: isDarkMode ? '#374151' : '#ffffff',
          borderColor: isDarkMode ? '#4b5563' : '#e5e7eb',
          border: '1px solid'
        }}
      >
        <div className="flex items-center space-x-3 mb-4">
          <div className="relative group">
            <div 
              className="w-16 h-16 rounded-full flex items-center justify-center overflow-hidden border-2"
              style={{
                backgroundColor: isDarkMode ? '#1f2937' : '#f3f4f6',
                borderColor: isDarkMode ? '#4b5563' : '#d1d5db'
              }}
            >
              {uploadingAvatar ? (
                <Loader className="w-6 h-6 animate-spin" style={{ color: '#3b82f6' }} />
              ) : avatarUrl ? (
                <img 
                  src={avatarUrl} 
                  alt={userName}
                  className="w-full h-full object-cover"
                />
              ) : (
                <User className="w-8 h-8" style={{ color: isDarkMode ? '#9ca3af' : '#6b7280' }} />
              )}
            </div>
            {!uploadingAvatar && (
              <label 
                className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                title={t('controlPanel.uploadAvatar', 'Upload avatar')}
              >
                <Camera className="w-5 h-5 text-white" />
                <input 
                  type="file" 
                  accept="image/jpeg,image/jpg,image/png,image/gif,image/webp" 
                  onChange={handleAvatarUpload}
                  className="hidden"
                />
              </label>
            )}
          </div>
          <div className="flex-1">
            <h3 
              className="font-semibold"
              style={{ color: isDarkMode ? '#ffffff' : '#111827' }}
            >
              {userName}
            </h3>
            <p 
              className="text-sm"
              style={{ color: isDarkMode ? '#9ca3af' : '#6b7280' }}
            >
              {userEmail}
            </p>
          </div>
        </div>

        {/* Avatar Success Message */}
        {avatarSuccess && (
          <div 
            className="mb-3 p-3 rounded-lg text-sm animate-fade-in"
            style={{
              backgroundColor: isDarkMode ? '#14532d' : '#dcfce7',
              color: isDarkMode ? '#86efac' : '#166534',
              border: '1px solid',
              borderColor: isDarkMode ? '#166534' : '#86efac'
            }}
          >
            <div className="flex items-center space-x-2">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span className="font-medium">{avatarSuccess}</span>
            </div>
          </div>
        )}

        {/* Role Info */}
        <div 
          className="p-3 rounded-lg mb-3"
          style={{
            backgroundColor: isDarkMode ? '#1f2937' : '#f9fafb',
            border: '1px solid',
            borderColor: isDarkMode ? '#374151' : '#e5e7eb'
          }}
        >
          <div className="flex items-center space-x-2 mb-1">
            <Shield className="w-4 h-4" style={{ color: '#3b82f6' }} />
            <span 
              className="text-sm font-semibold"
              style={{ color: isDarkMode ? '#ffffff' : '#111827' }}
            >
              {t('controlPanel.role', 'Role')}: {getTranslatedRole(userRole)}
            </span>
          </div>
          <p 
            className="text-xs"
            style={{ color: isDarkMode ? '#9ca3af' : '#6b7280' }}
          >
            {roleDescriptions[userRole] || t('controlPanel.standardAccess', 'Standard user access')}
          </p>
        </div>

        {/* User IDs Section */}
        <div 
          className="p-3 rounded-lg mb-3 space-y-2"
          style={{
            backgroundColor: isDarkMode ? '#1f2937' : '#f9fafb',
            border: '1px solid',
            borderColor: isDarkMode ? '#374151' : '#e5e7eb'
          }}
        >
          <div className="flex items-center justify-between">
            <span 
              className="text-xs font-medium"
              style={{ color: isDarkMode ? '#9ca3af' : '#6b7280' }}
            >
              {t('controlPanel.userUuid', 'User UUID')}:
            </span>
            <code 
              className="text-xs px-2 py-1 rounded font-mono"
              style={{
                backgroundColor: isDarkMode ? '#111827' : '#f3f4f6',
                color: isDarkMode ? '#60a5fa' : '#2563eb',
                border: '1px solid',
                borderColor: isDarkMode ? '#374151' : '#e5e7eb'
              }}
              title={userId}
            >
              {userId.substring(0, 8)}...
            </code>
          </div>
          
          {employeeId && (
            <div className="flex items-center justify-between">
              <span 
                className="text-xs font-medium"
                style={{ color: isDarkMode ? '#9ca3af' : '#6b7280' }}
              >
                {t('controlPanel.employeeId', 'Employee ID')}:
              </span>
              <code 
                className="text-xs px-2 py-1 rounded font-mono"
                style={{
                  backgroundColor: isDarkMode ? '#111827' : '#f3f4f6',
                  color: isDarkMode ? '#34d399' : '#059669',
                  border: '1px solid',
                  borderColor: isDarkMode ? '#374151' : '#e5e7eb'
                }}
              >
                {employeeId}
              </code>
            </div>
          )}
        </div>

        {/* Reset Own Password */}
        <div className="space-y-2">
          <button
            onClick={() => {
              if (isDemoMode()) return;
              localStorage.removeItem('changingPassword');
              isChangingPassword.current = false;
              setShowChangePassword(!showChangePassword);
            }}
            disabled={isDemoMode()}
            title={isDemoMode() ? t('controlPanel.demoModeDisabled', 'Disabled in demo mode') : ''}
            className={`w-full group flex items-center space-x-2 px-3 py-2 rounded-lg transition-colors 
              focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
              ${isDemoMode() ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}
            `}
            style={{
              backgroundColor: isDarkMode ? '#2d3748' : '#f4f6f8',
              color: isDarkMode ? '#ffffff' : '#111827',
              border: isDarkMode ? '1px solid #4a5568' : '1px solid #d1d5db'
            }}
            onMouseEnter={(e) => {
              if (isDemoMode()) return;
              e.currentTarget.style.backgroundColor = isDarkMode ? '#3b4860' : '#e2e8f0';
            }}
            onMouseLeave={(e) => {
              if (isDemoMode()) return;
              e.currentTarget.style.backgroundColor = isDarkMode ? '#2d3748' : '#f4f6f8';
            }}
          >
            <Key className="w-4 h-4 group-hover:rotate-45 transition-transform duration-300" />
            <span className="text-sm">{t('controlPanel.changeOwnPassword', 'Change Own Password')}</span>
          </button>
          
          {/* Reset Other Employee Password */}
          {isAdmin && (
            <button
              onClick={() => {
                if (isDemoMode()) return;
                setShowAdminReset(!showAdminReset);
              }}
              disabled={isDemoMode()}
              title={isDemoMode() ? t('controlPanel.demoModeDisabled', 'Disabled in demo mode') : ''}
              className={`
                w-full group flex items-center space-x-2 px-3 py-2 rounded-lg transition-all duration-200
                hover:shadow-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus-visible:ring-2 focus-visible:ring-blue-500
                ${isDemoMode() ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}
              `}
              style={{
                backgroundColor: isDarkMode ? '#1f2f47' : '#eef3ff',
                color: isDarkMode ? '#bfdbfe' : '#1e3a8a',
              }}
              onMouseEnter={(e) => {
                if (isDemoMode()) return;
                e.currentTarget.style.backgroundColor = isDarkMode ? '#28415f' : '#dbe4ff';
              }}
              onMouseLeave={(e) => {
                if (isDemoMode()) return;
                e.currentTarget.style.backgroundColor = isDarkMode ? '#1f2f47' : '#eef3ff';
              }}
            >
              <Users className="w-4 h-4 group-hover:scale-110 transition-transform duration-300" />
              <span className="text-sm">{t('controlPanel.resetOtherUserPassword', 'Reset Other Employee Password')}</span>
            </button>
          )}

          {/* Visit analytics (admin only) */}
          {isAdmin && (
            <div
              className="w-full rounded-lg border p-3 space-y-2"
              style={{
                backgroundColor: isDarkMode ? '#0f172a' : '#f8fafc',
                borderColor: isDarkMode ? '#1e293b' : '#e2e8f0',
                color: isDarkMode ? '#e2e8f0' : '#0f172a'
              }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Activity className={`w-4 h-4 ${isDarkMode ? 'text-white' : 'text-gray-800'}`} />
                  <span className="text-sm font-semibold">Visit analytics</span>
                </div>
                {loadingVisits && <Loader className="w-4 h-4 animate-spin text-indigo-500" />}
              </div>

              {visitError ? (
                <div className="text-xs text-red-500 flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4" />
                  <span>{visitError}</span>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <p className="text-slate-500">Total</p>
                    <p className="text-sm font-bold">{visitSummary.total}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">Last 24h</p>
                    <p className="text-sm font-bold">{visitSummary.last24h}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">Distinct IPs</p>
                    <p className="text-sm font-bold">{visitSummary.distinctIps}</p>
                  </div>
                </div>
              )}

              <div className="space-y-1 max-h-48 overflow-auto text-xs">
                {visitSummary.recent?.length === 0 && !visitError && (
                  <p className="text-slate-500">No visits logged yet.</p>
                )}
                {visitSummary.recent?.map((row) => (
                  <div key={row.id} className="p-2 rounded border" style={{ borderColor: isDarkMode ? '#1f2937' : '#e2e8f0' }}>
                    <div className="flex justify-between">
                      <span className="font-semibold">{row.ip || 'unknown IP'}</span>
                      <span className="text-slate-500">{new Date(row.created_at).toLocaleString()}</span>
                    </div>
                    <p className="text-slate-500 truncate">{row.path || '/'}</p>
                    {row.referrer && <p className="text-slate-500 truncate">Ref: {row.referrer}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Demo Data Management - Only show in demo mode */}
          {isDemoMode() && (
            <>
              <button
                onClick={() => {
                  const nextRole = userRole === 'demo_admin' ? 'demo_employee' : 'demo_admin';
                  switchDemoRole?.(nextRole);
                }}
                className="w-full group flex items-center space-x-2 px-3 py-2 rounded-lg transition-colors cursor-pointer"
                style={{
                  backgroundColor: isDarkMode ? '#4d4d4d' : '#e0f2fe',
                  color: isDarkMode ? '#ffffff' : '#0f172a'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = isDarkMode ? '#ffffff' : '#dbeafe';
                  e.currentTarget.style.color = isDarkMode ? '#16006d' : '#1e40af';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = isDarkMode ? '#4d4d4d' : '#e0f2fe';
                  e.currentTarget.style.color = isDarkMode ? '#ffffff' : '#0f172a';
                }}
              >
                <Expand className="w-4.5 h-4.5 group-hover:animate-spin origin-center transform transition-all" />
                <div className="flex flex-col items-start text-left">
                  <span className="text-sm font-semibold">
                    {userRole === 'demo_admin' ? t('controlPanel.switchToDemoEmployee', 'Switch to Demo Employee') : t('controlPanel.switchToDemoAdmin', 'Switch to Demo Admin')}
                  </span>
                  <span className="text-xs" style={{ color: isDarkMode ? '#94a3b8' : '#475569' }}>
                    {t('controlPanel.demoRoleOnly', 'Demo mode only; toggles demo roles')}
                  </span>
                </div>
              </button>

              <button
                onClick={() => setShowDemoDataManagement(!showDemoDataManagement)}
                className="w-full group flex items-center space-x-2 px-3 py-2 rounded-lg transition-colors cursor-pointer"
                style={{
                  backgroundColor: isDarkMode ? '#955aee' : '#f3e8ff',
                  color: isDarkMode ? '#ffffff' : '#6b21a8'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = isDarkMode ? '#ffffff' : '#e9d5ff';
                  e.currentTarget.style.color = isDarkMode ? '#000000' : '#7e22ce';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = isDarkMode ? '#955aee' : '#f3e8ff';
                  e.currentTarget.style.color = isDarkMode ? '#ffffff' : '#6b21a8';
                }}
              >
                <RefreshCcw className="w-4.25 h-4.25 group-hover:animate-spin origin-center transform transition-all" />
                <span className="text-sm">{t('controlPanel.restoreDemoData', 'Restore Demo Data')}</span>
              </button>
            </>
          )}

          {/* Demo Data Restore */}
          {isDemoMode() && showDemoDataManagement && (
            <div 
              className="p-4 rounded-lg space-y-3"
              style={{
                backgroundColor: isDarkMode ? '#1f2937' : '#f9fafb',
                border: '1px solid',
                borderColor: isDarkMode ? '#374151' : '#e5e7eb'
              }}
            >
              <p 
                className="text-xs mb-3"
                style={{ color: isDarkMode ? '#9ca3af' : '#6b7280' }}
              >
                {t('controlPanel.restoreDemoDataDescription', 'Restore default demo data for specific data types. This will reset any changes you made.')}
              </p>
              
              <div className="grid grid-cols-2 gap-2">
                {[
                  { key: 'timeEntries', label: t('controlPanel.demoTimeEntries', 'Time Entries'), fn: resetDemoTimeEntries },
                  { key: 'goals', label: t('controlPanel.demoGoals', 'Goals'), fn: resetDemoGoals },
                  { key: 'tasks', label: t('controlPanel.demoTasks', 'Tasks'), fn: resetDemoTasks },
                  { key: 'reviews', label: t('controlPanel.demoReviews', 'Reviews'), fn: resetDemoReviews },
                  { key: 'skills', label: t('controlPanel.demoSkills', 'Skills'), fn: resetDemoSkills },
                  { key: 'leaveRequests', label: t('controlPanel.demoLeaveRequests', 'Leave Requests'), fn: resetDemoLeaveRequests },
                ].map(({ key, label, fn }) => (
                  <button
                    key={key}
                    onClick={() => {
                      setRestoringDemoData(key);
                      setTimeout(() => {
                        fn();
                        setRestoringDemoData(null);
                        setToast({ show: true, message: t('controlPanel.demoDataRestored', '{type} restored to defaults').replace('{type}', label), type: 'success' });
                        setTimeout(() => setToast({ show: false, message: '', type: '' }), 3000);
                      }, 500);
                    }}
                    disabled={restoringDemoData !== null}
                    className="flex cursor-pointer group items-center justify-center space-x-1 px-2 py-2 rounded text-xs transition-colors"
                    style={{
                      backgroundColor: isDarkMode ? '#374151' : '#e5e7eb',
                      color: isDarkMode ? '#ffffff' : '#111827',
                      opacity: restoringDemoData !== null ? 0.6 : 1
                    }}
                    onMouseEnter ={(e) => {
                      e.currentTarget.style.backgroundColor = isDarkMode ? '#4b5563' : '#d1d5db';
                      e.currentTarget.style.color = isDarkMode ? '#ffffff' : '#111827';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = isDarkMode ? '#374151' : '#e5e7eb';
                      e.currentTarget.style.color = isDarkMode ? '#ffffff' : '#111827';
                    }}
                  >
                    {restoringDemoData === key ? (
                      <Loader className="w-3 h-3 animate-spin" />
                    ) : (
                      <RefreshCcw className={`${text.primary} w-3 h-3 group-hover:animate-spin origin-center transform transition-all`} />
                    )}
                    <span>{label}</span>
                  </button>
                ))}
              </div>
              
              <button
                onClick={() => {
                  setRestoringDemoData('all');
                  setTimeout(() => {
                    resetAllDemoData();
                    setRestoringDemoData(null);
                    setToast({ show: true, message: t('controlPanel.allDemoDataRestored', 'All demo data restored to defaults'), type: 'success' });
                    setTimeout(() => setToast({ show: false, message: '', type: '' }), 3000);
                  }, 500);
                }}
                disabled={restoringDemoData !== null}
                className="w-full group cursor-pointer flex items-center justify-center space-x-2 px-3 py-2 rounded-lg text-sm transition-all restoreDemoData-button"
                style={{
                  color: isDarkMode ? '#000' : '#fff',
                  opacity: restoringDemoData !== null ? 0.6 : 1
                }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.fontWeight = isDarkMode ? '700' : '700';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.fontWeight = isDarkMode ? '500' : '500';
                  }}
              >
                {restoringDemoData === 'all' ? ( 
                  <Loader className="w-4 h-4 animate-spin" />
                ) : (
                  <RefreshCcw className={`w-4 h-4 ${isDarkMode ? 'text-gray-900' : 'text-white'} group-hover:animate-spin origin-center transform transition-all`} />
                )}
                <span>{t('controlPanel.restoreAllDemoData', 'Restore All Demo Data')}</span>
              </button>
            </div>
          )}

          <button
            onClick={openManual}
            className="w-full group flex items-center space-x-2 px-3 py-2 rounded-lg transition-colors cursor-pointer"
            style={{
              backgroundColor: isDarkMode ? '#1f2937' : '#f3f4f6',
              color: isDarkMode ? '#ffffff' : '#111827'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = isDarkMode ? '#374151' : '#e5e7eb';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = isDarkMode ? '#1f2937' : '#f3f4f6';
            }}
          >
            <BookOpen className="w-4 h-4 group-hover:animate-pulse transition-all" />
            <span className="text-sm">{t('controlPanel.readManual', 'Read Manual')}</span>
          </button>

          <button
            onClick={handleLogout}
            className="w-full group flex items-center space-x-2 px-3 py-2 rounded-lg transition-colors cursor-pointer"
            style={{
              backgroundColor: '#dc2626',
              color: '#ffffff'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#b91c1c';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#dc2626';
            }}
          >
            <LogOut className="w-4.25 h-4.25 group-hover:animate-ping transition-all" />
            <span className="text-sm">{t('controlPanel.logout', 'Log Out')}</span>
          </button>
        </div>
      </div>

      {/* Change Password Form */}
      {showChangePassword && !isChangingPassword.current && localStorage.getItem('changingPassword') !== 'true' && (
        <div 
          className="rounded-lg shadow-sm p-4"
          style={{
            backgroundColor: isDarkMode ? '#374151' : '#ffffff',
        
          }}
        >
          <h4 
            className="font-semibold mb-3 flex items-center space-x-2"
            style={{ color: isDarkMode ? '#ffffff' : '#111827' }}
          >
            <KeySquare className="w-4 h-4 -rotate-90 transition-all duration-75" />
            <span>{t('controlPanel.changePassword', 'Change Password')}</span>
          </h4>

          {passwordError && (
            <div 
              className="mb-3 p-2 rounded text-sm"
              style={{
                backgroundColor: isDarkMode ? '#7f1d1d' : '#fee2e2',
                color: isDarkMode ? '#fca5a5' : '#991b1b'
              }}
            >
              {passwordError}
            </div>
          )}

          {passwordSuccess && (
            <div 
              className="mb-3 p-2 rounded text-sm"
              style={{
                backgroundColor: isDarkMode ? '#14532d' : '#dcfce7',
                color: isDarkMode ? '#86efac' : '#166534'
              }}
            >
              {passwordSuccess}
            </div>
          )}

          <form onSubmit={handleChangePassword} className="space-y-3">
            <div>
              <label 
                className="block text-xs font-medium mb-1"
                style={{ color: isDarkMode ? '#d1d5db' : '#374151' }}
              >
                {t('controlPanel.newPassword', 'New Password')}
              </label>
              <div className="relative">
                <input
                  type={showNewPassword ? "text" : "password"}
                  value={passwordForm.newPassword}
                  onChange={(e) => setPasswordForm({...passwordForm, newPassword: e.target.value})}
                  autoComplete="new-password"
                  className="w-full px-3 py-2 pr-10 rounded border text-sm"
                  style={{
                    backgroundColor: isDarkMode ? '#1f2937' : '#ffffff',
                    borderColor: isDarkMode ? '#4b5563' : '#d1d5db',
                    color: isDarkMode ? '#ffffff' : '#111827'
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:opacity-70 transition-opacity"
                  style={{ color: isDarkMode ? '#9ca3af' : '#6b7280' }}
                >
                  {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label 
                className="block text-xs font-medium mb-1"
                style={{ color: isDarkMode ? '#d1d5db' : '#374151' }}
              >
                {t('controlPanel.confirmPassword', 'Confirm Password')}
              </label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  value={passwordForm.confirmPassword}
                  onChange={(e) => setPasswordForm({...passwordForm, confirmPassword: e.target.value})}
                  autoComplete="new-password"
                  className="w-full px-3 py-2 pr-10 rounded border text-sm"
                  style={{
                    backgroundColor: isDarkMode ? '#1f2937' : '#ffffff',
                    borderColor: isDarkMode ? '#4b5563' : '#d1d5db',
                    color: isDarkMode ? '#ffffff' : '#111827'
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:opacity-70 transition-opacity"
                  style={{ color: isDarkMode ? '#9ca3af' : '#6b7280' }}
                >
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="flex space-x-2">
              <button
                type="submit"
                className="flex-1 px-3 py-2 rounded text-sm font-medium transition-colors cursor-pointer"
                style={{
                  backgroundColor: isDarkMode ? '#2563eb' : '#3b82f6',
                  color: '#ffffff',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = isDarkMode ? '#fff' : '#000';
                  e.currentTarget.style.color = isDarkMode ? '#000000' : '#ffffff';
                  e.currentTarget.style.fontWeight = '700';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = isDarkMode ? '#2563eb' : '#3b82f6';  
                  e.currentTarget.style.color = isDarkMode ? '#fff' : '#fff';
                  e.currentTarget.style.fontWeight = '500';
                }}
              >
                {t('common.save', 'Save')}
              </button>
              <button
                type="button"
                onClick={() => {
                  // Clear the flag when cancelling
                  localStorage.removeItem('changingPassword');
                  isChangingPassword.current = false;
                  setShowChangePassword(false);
                  setPasswordForm({ newPassword: '', confirmPassword: '' });
                  setPasswordError('');
                }}
                className="flex-1 px-3 py-2 rounded text-sm font-medium transition-colors cursor-pointer"
                style={{
                  backgroundColor: isDarkMode ? '#1f2937' : '#f3f4f6',
                  color: isDarkMode ? '#ffffff' : '#111827'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = isDarkMode ? '#fde68a' : '#fef3c7';
                  e.currentTarget.style.color = isDarkMode ? '#000000' : '#000000';
                  e.currentTarget.style.fontWeight = '700';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = isDarkMode ? '#1f2937' : '#f3f4f6';
                  e.currentTarget.style.color = isDarkMode ? '#ffffff' : '#111827';
                  e.currentTarget.style.fontWeight = '500';
                }}
              >
                {t('common.cancel', 'Cancel')}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Admin Password Reset Form */}
      {isAdmin && showAdminReset && (
        <div 
          className="rounded-lg shadow-sm p-4"
          style={{
            backgroundColor: isDarkMode ? '#374151' : '#ffffff',
            borderColor: isDarkMode ? '#4b5563' : '#e5e7eb',
            border: '1px solid'
          }}
        >
          <h4 
            className="font-semibold mb-3 flex items-center space-x-2"
            style={{ color: isDarkMode ? '#ffffff' : '#111827' }}
          >
            <Users className="w-4 h-4" />
            <span>{t('controlPanel.resetUserPassword', 'Reset User Password')}</span>
          </h4>

          {adminResetError && (
            <div 
              className="mb-3 p-2 rounded text-sm"
              style={{
                backgroundColor: isDarkMode ? '#7f1d1d' : '#fee2e2',
                color: isDarkMode ? '#fca5a5' : '#991b1b'
              }}
            >
              {adminResetError}
            </div>
          )}

          {adminResetSuccess && (
            <div 
              className="mb-3 p-2 rounded text-sm"
              style={{
                backgroundColor: isDarkMode ? '#14532d' : '#dcfce7',
                color: isDarkMode ? '#86efac' : '#166534'
              }}
            >
              {adminResetSuccess}
            </div>
          )}

          <form onSubmit={handleOthersPassword} className="space-y-3">
            <div>
              <label 
                className="block text-xs font-medium mb-1"
                style={{ color: isDarkMode ? '#d1d5db' : '#374151' }}
              >
                {t('controlPanel.selectUser', 'Select User')}
              </label>
              {loadingUsers ? (
                <div className="flex items-center space-x-2 text-sm" style={{ color: isDarkMode ? '#9ca3af' : '#6b7280' }}>
                  <Loader className="w-4 h-4 animate-spin" />
                  <span>{t('common.loading', 'Loading...')}</span>
                </div>
              ) : (
                <select
                  value={selectedUserId}
                  onChange={(e) => setSelectedUserId(e.target.value)}
                  className="w-full px-3 py-2 rounded border text-sm"
                  style={{
                    backgroundColor: isDarkMode ? '#1f2937' : '#ffffff',
                    borderColor: isDarkMode ? '#4b5563' : '#d1d5db',
                    color: isDarkMode ? '#ffffff' : '#111827'
                  }}
                >
                  <option value="">{t('controlPanel.chooseUser', '-- Choose a user --')}</option>
                  {allUsers.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.full_name || u.email} ({u.email}) - {getTranslatedRole(u.role)}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div>
              <label 
                className="block text-xs font-medium mb-1"
                style={{ color: isDarkMode ? '#d1d5db' : '#374151' }}
              >
                {t('controlPanel.newPassword', 'New Password')}
              </label>
              <div className="relative">
                <input
                  type={showAdminPassword ? "text" : "password"}
                  value={adminResetPassword}
                  onChange={(e) => setAdminResetPassword(e.target.value)}
                  className="w-full px-3 py-2 pr-10 rounded border text-sm"
                  style={{
                    backgroundColor: isDarkMode ? '#1f2937' : '#ffffff',
                    borderColor: isDarkMode ? '#4b5563' : '#d1d5db',
                    color: isDarkMode ? '#ffffff' : '#111827'
                  }}
                  placeholder={t('controlPanel.enterNewPassword', 'Enter new password')}
                />
                <button
                  type="button"
                  onClick={() => setShowAdminPassword(!showAdminPassword)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:opacity-70 transition-opacity"
                  style={{ color: isDarkMode ? '#9ca3af' : '#6b7280' }}
                >
                  {showAdminPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label 
                className="block text-xs font-medium mb-1"
                style={{ color: isDarkMode ? '#d1d5db' : '#374151' }}
              >
                {t('controlPanel.confirmPassword', 'Confirm Password')}
              </label>
              <div className="relative">
                <input
                  type={showAdminConfirm ? "text" : "password"}
                  value={adminResetConfirm}
                  onChange={(e) => setAdminResetConfirm(e.target.value)}
                  className="w-full px-3 py-2 pr-10 rounded border text-sm"
                  style={{
                    backgroundColor: isDarkMode ? '#1f2937' : '#ffffff',
                    borderColor: isDarkMode ? '#4b5563' : '#d1d5db',
                    color: isDarkMode ? '#ffffff' : '#111827'
                  }}
                  placeholder={t('controlPanel.confirmNewPassword', 'Confirm new password')}
                />
                <button
                  type="button"
                  onClick={() => setShowAdminConfirm(!showAdminConfirm)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:opacity-70 transition-opacity"
                  style={{ color: isDarkMode ? '#9ca3af' : '#6b7280' }}
                >
                  {showAdminConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="flex space-x-2">
              <button
                type="submit"
                className="flex-1 px-3 py-2 cursor-pointer rounded text-sm font-medium transition-colors"
                style={{
                  backgroundColor: isDarkMode ? '#ffffff' : '#000000',
                  color: isDarkMode ? '#000000' : '#ffffff',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = isDarkMode ? '#1d4ed8' : '#2563eb';
                  e.currentTarget.style.color = isDarkMode ? '#ffffff' : '#ffffff';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = isDarkMode ? '#ffffff' : '#000000';
                  e.currentTarget.style.color = isDarkMode ? '#000000' : '#ffffff'; 
                }}
              >
                {t('controlPanel.resetPassword', 'Reset Password')}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowAdminReset(false);
                  setSelectedUserId('');
                  setAdminResetPassword('');
                  setAdminResetConfirm('');
                  setAdminResetError('');
                }}
                className="flex-1 px-3 py-2 cursor-pointer rounded text-sm font-medium transition-all duration-100"
                style={{
                  backgroundColor: isDarkMode ? '#1f2937' : '#f3f4f6',
                  color: isDarkMode ? '#ffffff' : '#111827'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = isDarkMode ? '#fde68a' : '#fef3c7';
                  e.currentTarget.style.color = isDarkMode ? '#000000' : '#000000';
                  e.currentTarget.style.fontWeight = '700';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = isDarkMode ? '#1f2937' : '#f3f4f6';
                  e.currentTarget.style.color = isDarkMode ? '#ffffff' : '#111827';
                  e.currentTarget.style.fontWeight = '500';
                }}
              >
                {t('common.cancel', 'Cancel')}
              </button>
            </div>
          </form>

          {/* Warning Notice */}
          <div 
            className="mt-3 p-2 rounded text-xs"
            style={{
              backgroundColor: isDarkMode ? '#7c2d12' : '#fed7aa',
              color: isDarkMode ? '#fbbf24' : '#92400e',
              border: '1px solid',
              borderColor: isDarkMode ? '#92400e' : '#fbbf24'
            }}
          >
            <strong>{t('controlPanel.warning', 'Warning')}:</strong> {t('controlPanel.adminResetWarning', 'This will change the password for the selected user. They will need to use the new password to log in.')}
          </div>
        </div>
      )}

      {/* Admin Other Employees Password Reset Form */}
      {isAdmin && showEmployeeReset && (
        <div 
          className="rounded-lg shadow-sm p-4"
          style={{
            backgroundColor: isDarkMode ? '#374151' : '#ffffff',
            borderColor: isDarkMode ? '#4b5563' : '#e5e7eb',
            border: '1px solid'
          }}
        >
          <h4 
            className="font-semibold mb-3 flex items-center space-x-2"
            style={{ color: isDarkMode ? '#ffffff' : '#111827' }}
          >
            <Shield className="w-4.25 h-4.25" />
            <span>{t('controlPanel.resetEmployeePassword', '')}</span>
          </h4>

          {employeeResetError && (
            <div 
              className="mb-3 p-2 rounded text-sm"
              style={{
                backgroundColor: isDarkMode ? '#7f1d1d' : '#fee2e2',
                color: isDarkMode ? '#fca5a5' : '#991b1b'
              }}
            >
              {employeeResetError}
            </div>
          )}

          {employeeResetSuccess && (
            <div 
              className="mb-3 p-2 rounded text-sm"
              style={{
                backgroundColor: isDarkMode ? '#14532d' : '#dcfce7',
                color: isDarkMode ? '#86efac' : '#166534'
              }}
            >
              {employeeResetSuccess}
            </div>
          )}

          <form onSubmit={handleEmployeeResetPassword} className="space-y-3">
            <div>
              <label 
                className="block text-xs font-medium mb-1"
                style={{ color: isDarkMode ? '#d1d5db' : '#374151' }}
              >
                {t('controlPanel.selectEmployee', 'Select Employee')}
              </label>
              {loadingEmployees ? (
                <div className="flex items-center space-x-2 text-sm" style={{ color: isDarkMode ? '#9ca3af' : '#6b7280' }}>
                  <Loader className="w-4 h-4 animate-spin" />
                  <span>{t('common.loading', 'Loading...')}</span>
                </div>
              ) : (
                <select
                  value={selectedEmployeeId}
                  onChange={(e) => setSelectedEmployeeId(e.target.value)}
                  className="w-full px-3 py-2 rounded border text-sm"
                  style={{
                    backgroundColor: isDarkMode ? '#1f2937' : '#ffffff',
                    borderColor: isDarkMode ? '#4b5563' : '#d1d5db',
                    color: isDarkMode ? '#ffffff' : '#111827'
                  }}
                >
                  <option value="">{t('controlPanel.chooseEmployee', '-- Choose an employee --')}</option>
                  {allEmployees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {getDemoEmployeeName(emp, t)} ({emp.email})
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div>
              <label 
                className="block text-xs font-medium mb-1"
                style={{ color: isDarkMode ? '#d1d5db' : '#374151' }}
              >
                {t('controlPanel.newPassword', 'New Password')}
              </label>
              <div className="relative">
                <input
                  type={showEmployeePassword ? "text" : "password"}
                  value={employeeResetPassword}
                  onChange={(e) => setEmployeeResetPassword(e.target.value)}
                  className="w-full px-3 py-2 pr-10 rounded border text-sm"
                  style={{
                    backgroundColor: isDarkMode ? '#1f2937' : '#ffffff',
                    borderColor: isDarkMode ? '#4b5563' : '#d1d5db',
                    color: isDarkMode ? '#ffffff' : '#111827'
                  }}
                  placeholder={t('controlPanel.enterNewPassword', 'Enter new password')}
                />
                <button
                  type="button"
                  onClick={() => setShowEmployeePassword(!showEmployeePassword)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:opacity-70 transition-opacity"
                  style={{ color: isDarkMode ? '#9ca3af' : '#6b7280' }}
                >
                  {showEmployeePassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label 
                className="block text-xs font-medium mb-1"
                style={{ color: isDarkMode ? '#d1d5db' : '#374151' }}
              >
                {t('controlPanel.confirmPassword', 'Confirm Password')}
              </label>
              <div className="relative">
                <input
                  type={showEmployeeConfirm ? "text" : "password"}
                  value={employeeResetConfirm}
                  onChange={(e) => setEmployeeResetConfirm(e.target.value)}
                  className="w-full px-3 py-2 pr-10 rounded border text-sm"
                  style={{
                    backgroundColor: isDarkMode ? '#1f2937' : '#ffffff',
                    borderColor: isDarkMode ? '#4b5563' : '#d1d5db',
                    color: isDarkMode ? '#ffffff' : '#111827'
                  }}
                  placeholder={t('controlPanel.confirmNewPassword', 'Confirm new password')}
                />
                <button
                  type="button"
                  onClick={() => setShowEmployeeConfirm(!showEmployeeConfirm)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:opacity-70 transition-opacity"
                  style={{ color: isDarkMode ? '#9ca3af' : '#6b7280' }}
                >
                  {showEmployeeConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="flex space-x-2">
              <button
                type="submit"
                className="flex-1 px-3 py-2 rounded text-sm font-medium transition-colors"
                style={{
                  backgroundColor: '#dc2626',
                  color: '#ffffff'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#b91c1c';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#dc2626';
                }}
              >
                {t('controlPanel.resetPassword', 'Reset Password')}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowEmployeeReset(false);
                  setSelectedEmployeeId('');
                  setEmployeeResetPassword('');
                  setEmployeeResetConfirm('');
                  setEmployeeResetError('');
                }}
                className="flex-1 px-3 py-2 rounded text-sm font-medium transition-colors"
                style={{
                  backgroundColor: isDarkMode ? '#1f2937' : '#f3f4f6',
                  color: isDarkMode ? '#ffffff' : '#111827'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = isDarkMode ? '#374151' : '#e5e7eb';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = isDarkMode ? '#1f2937' : '#f3f4f6';
                }}
              >
                {t('common.cancel', 'Cancel')}
              </button>
            </div>
          </form>

          {/* Warning Notice */}
          <div 
            className="mt-3 p-2 rounded text-xs"
            style={{
              backgroundColor: isDarkMode ? '#7c2d12' : '#fed7aa',
              color: isDarkMode ? '#fbbf24' : '#92400e',
              border: '1px solid',
              borderColor: isDarkMode ? '#92400e' : '#fbbf24'
            }}
          >
            <strong>{t('controlPanel.warning', 'Warning')}:</strong> {t('controlPanel.adminResetWarning', 'This will change the password for the selected user. They will need to use the new password to log in.')}
          </div>
        </div>
      )}

      {/* Info Card */}
      <div 
        className="rounded-lg shadow-sm p-3"
        style={{
          backgroundColor: isDarkMode ? '#1e3a5f' : '#eff6ff',
          borderColor: isDarkMode ? '#1e40af' : '#bfdbfe',
          border: '1px solid'
        }}
      >
        <div className="flex items-start space-x-2">
          <Info className="w-4 h-4 ml-0.5" style={{ color: '#3b82f6' }} />
          <div>
            <p 
              className="text-xs font-medium mb-1"
              style={{ color: isDarkMode ? '#93c5fd' : '#1e40af' }}
            >
              {t('controlPanel.needHelp', 'Need Help?')}
            </p>
            <p 
              className="text-xs"
              style={{ color: isDarkMode ? '#bfdbfe' : '#1e40af' }}
            >
              {t('controlPanel.helpText', 'Check out the manual for detailed instructions on using the system.')}
            </p>
          </div>
        </div>
      </div>

      {/* Toast Notification */}
      {toast.show && (
        <div className="fixed top-4 right-4 z-50 animate-fade-in">
          <div className={`
            rounded-lg p-4 shadow-lg flex items-center space-x-3
            ${toast.type === 'success' 
              ? `${isDarkMode ? 'bg-green-900/30' : 'bg-green-100'} border-l-4 border-green-600` 
              : `${isDarkMode ? 'bg-red-900/30' : 'bg-red-100'} border-l-4 border-red-600`}
          `}>
            {toast.type === 'success' ? (
              <Check className={`w-5 h-5 ${isDarkMode ? 'text-green-400' : 'text-green-600'}`} />
            ) : (
              <AlertCircle className={`w-5 h-5 ${isDarkMode ? 'text-red-400' : 'text-red-600'}`} />
            )}
            <span className={`
              font-medium
              ${toast.type === 'success' 
                ? `${isDarkMode ? 'text-green-200' : 'text-green-800'}` 
                : `${isDarkMode ? 'text-red-200' : 'text-red-800'}`}
            `}>
              {toast.message}
            </span>
          </div>
        </div>
      )}

      <style>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-fade-in {
          animation: fadeIn 0.3s ease-out;
        }
        /* Hide browser's default password reveal icon */
        input[type="password"]::-ms-reveal,
        input[type="password"]::-ms-clear {
          display: none;
        }
        input[type="password"]::-webkit-contacts-auto-fill-button,
        input[type="password"]::-webkit-credentials-auto-fill-button {
          visibility: hidden;
          pointer-events: none;
          position: absolute;
          right: 0;
        }
      `}</style>
    </div>
  );
};

export default ControlPanel;
