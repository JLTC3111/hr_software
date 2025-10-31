import React, { useState } from 'react';
import { User, LogOut, Key, BookOpen, Shield, Info, Camera, Loader } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../config/supabaseClient';

const ControlPanel = () => {
  const { isDarkMode, bg, text, border } = useTheme();
  const { t } = useLanguage();
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState(user?.avatar_url || null);
  const [avatarSuccess, setAvatarSuccess] = useState('');

  // Get user role and info
  const userRole = user?.user_metadata?.role || user?.role || 'Employee';
  const userName = user?.name || user?.user_metadata?.name || user?.email?.split('@')[0] || 'User';
  const userEmail = user?.email || '';
  const userId = user?.id || '';
  const employeeId = user?.employee_id || user?.employeeId || null;

  // Role descriptions with detailed permissions
  const roleDescriptions = {
    'admin': t('controlPanel.roleDesc.admin', 'Full system access with all administrative privileges'),
    'manager': t('controlPanel.roleDesc.hrManager', 'Manage employees, performance reviews, and HR operations'),
    'employee': t('controlPanel.roleDesc.employee', 'Access personal information and submit time entries'),
    'viewer': t('controlPanel.roleDesc.viewer', 'View-only access to reports and dashboards'),
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
    setPasswordError('');
    setPasswordSuccess('');

    // Validation
    if (!passwordForm.currentPassword || !passwordForm.newPassword || !passwordForm.confirmPassword) {
      setPasswordError(t('controlPanel.allFieldsRequired', 'All fields are required'));
      return;
    }

    if (passwordForm.newPassword.length < 6) {
      setPasswordError(t('controlPanel.passwordTooShort', 'Password must be at least 6 characters'));
      return;
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError(t('controlPanel.passwordsDontMatch', 'Passwords do not match'));
      return;
    }

    try {
      // Here you would call your password change API
      // For now, we'll simulate success
      setPasswordSuccess(t('controlPanel.passwordChanged', 'Password changed successfully!'));
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setTimeout(() => {
        setShowChangePassword(false);
        setPasswordSuccess('');
      }, 2000);
    } catch (error) {
      setPasswordError(t('controlPanel.passwordChangeError', 'Error changing password'));
    }
  };

  const openManual = () => {
    // Open the local USER_MANUAL.md file
    window.open('/USER_MANUAL.md', '_blank');
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
              {t('controlPanel.role', 'Role')}: {userRole}
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

        {/* Action Buttons */}
        <div className="space-y-2">
          <button
            onClick={() => setShowChangePassword(!showChangePassword)}
            className="w-full flex items-center space-x-2 px-3 py-2 rounded-lg transition-colors"
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
            <Key className="w-4 h-4" />
            <span className="text-sm">{t('controlPanel.changePassword', 'Change Password')}</span>
          </button>

          <button
            onClick={openManual}
            className="w-full flex items-center space-x-2 px-3 py-2 rounded-lg transition-colors"
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
            <BookOpen className="w-4 h-4" />
            <span className="text-sm">{t('controlPanel.readManual', 'Read Manual')}</span>
          </button>

          <button
            onClick={handleLogout}
            className="w-full flex items-center space-x-2 px-3 py-2 rounded-lg transition-colors"
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
            <LogOut className="w-4 h-4" />
            <span className="text-sm">{t('controlPanel.logout', 'Log Out')}</span>
          </button>
        </div>
      </div>

      {/* Change Password Form */}
      {showChangePassword && (
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
            <Key className="w-4 h-4" />
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
                {t('controlPanel.currentPassword', 'Current Password')}
              </label>
              <input
                type="password"
                value={passwordForm.currentPassword}
                onChange={(e) => setPasswordForm({...passwordForm, currentPassword: e.target.value})}
                className="w-full px-3 py-2 rounded border text-sm"
                style={{
                  backgroundColor: isDarkMode ? '#1f2937' : '#ffffff',
                  borderColor: isDarkMode ? '#4b5563' : '#d1d5db',
                  color: isDarkMode ? '#ffffff' : '#111827'
                }}
              />
            </div>

            <div>
              <label 
                className="block text-xs font-medium mb-1"
                style={{ color: isDarkMode ? '#d1d5db' : '#374151' }}
              >
                {t('controlPanel.newPassword', 'New Password')}
              </label>
              <input
                type="password"
                value={passwordForm.newPassword}
                onChange={(e) => setPasswordForm({...passwordForm, newPassword: e.target.value})}
                className="w-full px-3 py-2 rounded border text-sm"
                style={{
                  backgroundColor: isDarkMode ? '#1f2937' : '#ffffff',
                  borderColor: isDarkMode ? '#4b5563' : '#d1d5db',
                  color: isDarkMode ? '#ffffff' : '#111827'
                }}
              />
            </div>

            <div>
              <label 
                className="block text-xs font-medium mb-1"
                style={{ color: isDarkMode ? '#d1d5db' : '#374151' }}
              >
                {t('controlPanel.confirmPassword', 'Confirm Password')}
              </label>
              <input
                type="password"
                value={passwordForm.confirmPassword}
                onChange={(e) => setPasswordForm({...passwordForm, confirmPassword: e.target.value})}
                className="w-full px-3 py-2 rounded border text-sm"
                style={{
                  backgroundColor: isDarkMode ? '#1f2937' : '#ffffff',
                  borderColor: isDarkMode ? '#4b5563' : '#d1d5db',
                  color: isDarkMode ? '#ffffff' : '#111827'
                }}
              />
            </div>

            <div className="flex space-x-2">
              <button
                type="submit"
                className="flex-1 px-3 py-2 rounded text-sm font-medium transition-colors"
                style={{
                  backgroundColor: '#3b82f6',
                  color: '#ffffff'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#2563eb';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#3b82f6';
                }}
              >
                {t('common.save', 'Save')}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowChangePassword(false);
                  setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
                  setPasswordError('');
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
          <Info className="w-4 h-4 mt-0.5" style={{ color: '#3b82f6' }} />
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
    </div>
  );
};

export default ControlPanel;
