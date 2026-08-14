/**
 * Control Panel — the account and system screen, in the industry system.
 *
 * Same three bands as every other screen: a 44px ticker, a left band carrying
 * the evidence (who you are, what your credentials are, who has been visiting)
 * and a 340px decision column on the chrome ground carrying the actions that
 * leave the screen — switch role, restore demo data, read the manual, sign out.
 *
 * Every card is a <Blueprint> with its four registration marks. Status reads
 * through weight and rule, never through red or green, so the old coloured
 * alert boxes became hairline notices with a condensed kicker.
 */
import _React, { useState, useEffect, useRef } from 'react';
import { User, LogOut, Key, BookOpen, Shield, RefreshCcw, UserPen, UserCheck, UserX, UserMinus, Camera, Loader, Users, Eye, EyeOff, AlertCircle, X } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext.jsx';
import { useLanguage } from '../contexts/LanguageContext.jsx';
import { useAuth } from '../contexts/AuthContext.jsx';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../config/supabaseClient.js';
import { isDemoMode, getDemoEmployeeName, resetAllDemoData, resetDemoTimeEntries, resetDemoGoals, resetDemoTasks, resetDemoReviews, resetDemoSkills, resetDemoLeaveRequests } from '../utils/demoHelper.js';
import { fetchVisitSummary } from '../services/visitService.js';
import * as flubber from 'flubber';
import { getIndustry, DISPLAY, BODY, figure } from '../theme/industry.js';
import { Blueprint, Tag, Btn, Kicker, TickerCell, LiveClock, ColumnHeading } from './ui/industry.jsx';
import { FetchElapsedPill } from './ui/fetch-elapsed-pill';
import { PunchClock as PunchClock3D } from './ui/punch-clock.jsx';

export const MiniFlubberAutoMorphChangeRole = ({
  size = 18,
  className = '',
  isDarkMode = false,
  autoMorphInterval = 1500, 
  morphDuration = 1000, 
}) => {
  const [currentIconIndex, setCurrentIconIndex] = useState(0);
  const [morphPaths, setMorphPaths] = useState([]);
  const [isAnimating, setIsAnimating] = useState(false);
  const [maxSegmentLength] = useState(2);
  const iconRefs = useRef({});
  const animationFrameRef = useRef(null);
  const autoMorphTimerRef = useRef(null);

  /** ---------------------------
   * Dynamic Color Selection
   ----------------------------*/
  const getColor = (icon) => {
    if (icon.status === 'approved') {
      return isDarkMode ? 'text-green-400' : 'text-green-700';
    }
    if (icon.status === 'rejected') {
      return isDarkMode ? 'text-red-400' : 'text-red-700';
    }
    if (icon.status === 'standard') {
      return isDarkMode ? 'text-white' : 'text-black';
    }
    return isDarkMode ? 'text-white' : 'text-black';
  };

  /** Icon definitions */
  const icons = [
    { name: 'UsersPen', Icon: UserPen, status: 'stanard' },
    { name: 'UserCheck', Icon: UserCheck, status: 'standard' },
    { name: 'UserMinus', Icon: UserMinus, status: 'standard' },
    { name: 'UserX', Icon: UserX, status: 'standard' },
  ];

  /** Extract SVG paths for morphing */
  const extractPathsFromIcon = (iconElement) => {
    if (!iconElement) return [];
    const svg = iconElement.querySelector('svg');
    if (!svg) return [];

    const elements = svg.querySelectorAll(
      'path, circle, line, rect, polyline, polygon'
    );

    const paths = Array.from(elements)
      .map((element) => {
        if (element.tagName.toLowerCase() === 'path') {
          return element.getAttribute('d');
        }
        return convertShapeToPath(element);
      })
      .filter(Boolean);

    return paths;
  };

  /** Convert non-path shapes to path data */
  const convertShapeToPath = (element) => {
    const tag = element.tagName.toLowerCase();

    if (tag === 'circle') {
      const cx = parseFloat(element.getAttribute('cx'));
      const cy = parseFloat(element.getAttribute('cy'));
      const r = parseFloat(element.getAttribute('r'));
      return `M ${cx - r},${cy} a ${r},${r} 0 1,0 ${r * 2},0 a ${r},${r} 0 1,0 ${-r * 2},0`;
    }

    if (tag === 'line') {
      return `M ${element.getAttribute('x1')},${element.getAttribute(
        'y1'
      )} L ${element.getAttribute('x2')},${element.getAttribute('y2')}`;
    }

    if (tag === 'rect') {
      const x = parseFloat(element.getAttribute('x') || 0);
      const y = parseFloat(element.getAttribute('y') || 0);
      const w = parseFloat(element.getAttribute('width'));
      const h = parseFloat(element.getAttribute('height'));
      return `M ${x},${y} L ${x + w},${y} L ${x + w},${y + h} L ${x},${y + h} Z`;
    }

    if (tag === 'polyline' || tag === 'polygon') {
      const points = element.getAttribute('points').trim().split(/\s+/);
      const cmds = points.map((p, i) => {
        const [x, y] = p.split(',');
        return `${i === 0 ? 'M' : 'L'} ${x},${y}`;
      });
      if (tag === 'polygon') cmds.push('Z');
      return cmds.join(' ');
    }

    return null;
  };

  /** Morph animation logic */
  const morphToIndex = (targetIndex) => {
    if (isAnimating || currentIconIndex === targetIndex) return;

    setIsAnimating(true);

    const currentPaths = extractPathsFromIcon(iconRefs.current[currentIconIndex]);
    const nextPaths = extractPathsFromIcon(iconRefs.current[targetIndex]);

    if (!currentPaths.length || !nextPaths.length) {
      setCurrentIconIndex(targetIndex);
      setIsAnimating(false);
      return;
    }

    let interpolators;

    try {
      const maxPaths = Math.max(currentPaths.length, nextPaths.length);
      const paddedCurrent = [...currentPaths];
      const paddedNext = [...nextPaths];

      while (paddedCurrent.length < maxPaths) {
        paddedCurrent.push(paddedCurrent[paddedCurrent.length - 1]);
      }
      while (paddedNext.length < maxPaths) {
        paddedNext.push(paddedNext[paddedNext.length - 1]);
      }

      interpolators = paddedCurrent.map((c, i) =>
        flubber.interpolate(c, paddedNext[i], { maxSegmentLength })
      );
    } catch {
      interpolators = [
        flubber.interpolate(currentPaths.join(' '), nextPaths.join(' '), {
          maxSegmentLength,
        }),
      ];
    }

    const start = Date.now();

    const animate = () => {
      const elapsed = Date.now() - start;
      let t = Math.min(elapsed / morphDuration, 1);

      // easeInOutQuad
      t = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

      const morphed = interpolators.map((fn) => fn(t));
      setMorphPaths(morphed);

      if (elapsed < morphDuration) {
        animationFrameRef.current = requestAnimationFrame(animate);
      } else {
        setCurrentIconIndex(targetIndex);
        setIsAnimating(false);
        setMorphPaths([]);
      }
    };

    animate();
  };

  /** Auto-morph to next icon */
  const morphToNext = () => {
    const nextIndex = (currentIconIndex + 1) % icons.length;
    morphToIndex(nextIndex);
  };

  /** Set up auto-morphing interval */
  useEffect(() => {
    autoMorphTimerRef.current = setInterval(() => {
      morphToNext();
    }, autoMorphInterval);

    return () => {
      if (autoMorphTimerRef.current) {
        clearInterval(autoMorphTimerRef.current);
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [currentIconIndex, autoMorphInterval]);

  const CurrentIcon = icons[currentIconIndex].Icon;
  const currentColor = getColor(icons[currentIconIndex]);

  return (
    <div className={`inline-block ${className}`}>
      <div className="relative">
        {isAnimating && morphPaths.length > 0 ? (
          <svg
            width={size}
            height={size}
            viewBox="0 0 24 24"
            className={currentColor}
            stroke="currentColor"
            color="currentColor"
          >
            {morphPaths.map((d, i) => (
              <path
                key={i}
                d={d}
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ))}
          </svg>
        ) : (
          <CurrentIcon
            size={size}
            className={currentColor}
            stroke="currentColor"
            strokeWidth={1.5}
          />
        )}
      </div>

      {/* Hidden icons for path extraction */}
      <div
        style={{
          position: 'absolute',
          visibility: 'hidden',
          pointerEvents: 'none',
          left: '-9999px',
        }}
      >
        {icons.map((icon, i) => (
          <div key={i} ref={(el) => (iconRefs.current[i] = el)}>
            <icon.Icon size={24} />
          </div>
        ))}
      </div>
    </div>
  );
};

const ControlPanel = () => {
  const { isDarkMode } = useTheme();
  const ind = getIndustry(isDarkMode);
  const { t } = useLanguage();
  const { user, signOut, switchDemoRole, checkPermission, handleSessionAuthError } = useAuth();
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

  // Demo Data Management state. The restore bench is always on the decision
  // column in demo mode, so there is no separate open/closed state any more.
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
  const canViewVisitAnalytics = checkPermission('canViewAuditLogs');

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

  // Load visit analytics for users with audit-log permission (admin + demo_admin)
  useEffect(() => {
    const loadVisits = async () => {
      if (!canViewVisitAnalytics) return;
      await handleRefreshVisits();
    };

    loadVisits();
  }, [canViewVisitAnalytics]);

  const handleRefreshVisits = async () => {
    if (!canViewVisitAnalytics) return;
    setLoadingVisits(true);
    setVisitError('');
    try {
      const result = await fetchVisitSummary();
      if (result && result.success) {
        setVisitSummary(result.data);
      } else {
        console.error('Failed to load visit summary:', result?.error);
        setVisitError(t('errors.loadFailed', 'Failed to load data'));
      }
    } catch (err) {
      console.error('handleRefreshVisits error', err);
      setVisitError(t('errors.loadFailed', 'Failed to load data'));
    } finally {
      setLoadingVisits(false);
    }
  };

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
      if (handleSessionAuthError(error)) return;
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
      if (handleSessionAuthError(error)) return;
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
    if (globalThis.confirm(t('controlPanel.confirmLogout', 'Are you sure you want to log out?'))) {
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
      if (handleSessionAuthError(error)) return;
      setPasswordError(t('controlPanel.passwordChangeError', 'Error changing password'));
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
    if (!globalThis.confirm(confirmMessage)) {
      return;
    }

    try {
      if (isDemoMode()) {
        console.log('🔄 Simulating admin password reset in demo mode...');
        await new Promise(resolve => setTimeout(resolve, 1000));
        console.log('✅ Password reset successfully in demo mode');
        
        setAdminResetSuccess(t('controlPanel.passwordResetSuccess', 'Password reset successfully'));
        setAdminResetPassword('');
        setAdminResetConfirm('');
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
      if (handleSessionAuthError(error)) return;
      setAdminResetError(t('controlPanel.passwordResetError', 'Error resetting password. You may need admin service role access.'));
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
    if (!globalThis.confirm(t('controlPanel.confirmResetEmployeePassword', `Are you sure you want to reset password for employee ${getDemoEmployeeName(selectedEmployee, t)}?`))) {
      return;
    }

    try {
      if (isDemoMode()) {
        console.log('🔄 Simulating employee password reset in demo mode...');
        await new Promise(resolve => setTimeout(resolve, 1000));
      } else {
        // Call Supabase admin API to update employee's user password
        const { _data, error } = await supabase.auth.admin.updateUserById(
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
      if (handleSessionAuthError(error)) return;
      setEmployeeResetError(t('controlPanel.passwordResetError', 'Error resetting password. You may need admin service role access.'));
    }
  };

  const openManual = () => {
    navigate(isDemoMode() ? '/help-center' : '/production-help');
  };

  const handleAvatarUpload = (e) => {
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
      // For now, convert to base64 data URL and store directly in profile
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
          if (handleSessionAuthError(error)) return;
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
      if (handleSessionAuthError(error)) return;
      setAvatarSuccess('');
      alert(t('controlPanel.avatarError', 'Error uploading avatar'));
      setUploadingAvatar(false);
    }
  };

  /* ---------------- render ---------------- */

  const caption = { fontFamily: BODY, fontSize: 12.5, color: ind.inkMuted, lineHeight: 1.5, margin: 0 };
  const consequence = { fontFamily: BODY, fontSize: 11.5, color: ind.inkMuted, lineHeight: 1.45, margin: '3px 0 0' };
  const fieldLabel = {
    fontFamily: DISPLAY, fontWeight: 600, fontSize: 10, letterSpacing: '.14em',
    textTransform: 'uppercase', color: ind.inkMuted, display: 'block', marginBottom: 5,
  };
  const fieldBox = {
    width: '100%', fontFamily: BODY, fontSize: 13, color: ind.ink, background: 'transparent',
    border: `1px solid ${ind.hairline}`, borderRadius: 0, padding: '7px 34px 7px 10px', outline: 'none',
  };
  const revealBtn = {
    position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
    background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: ind.inkFaint, lineHeight: 0,
  };
  /* A setting row: label + the consequence of changing it, control on the right. */
  const settingRow = {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 20,
    padding: '11px 0', borderTop: `1px solid ${ind.rule}`,
  };
  const demoLocked = isDemoMode();
  const modeLabel = demoLocked ? t('controlPanel.modeDemo', 'Demo') : t('controlPanel.modeLive', 'Live');

  /* A labelled plate — the read-only form for a value that cannot be edited here. */
  const Plate = ({ label, value, title, mono = false }) => (
    <div style={{ border: `1px solid ${ind.hairline}`, padding: '3px 12px', minWidth: 0 }} title={title}>
      <div style={{ fontFamily: DISPLAY, fontWeight: 600, fontSize: 9.5, letterSpacing: '.12em', textTransform: 'uppercase', color: ind.inkMuted }}>
        {label}
      </div>
      <div
        style={{
          fontFamily: mono ? 'ui-monospace, SFMono-Regular, Menlo, monospace' : DISPLAY,
          fontWeight: 600, fontSize: mono ? 12 : 14, color: ind.ink,
          fontVariantNumeric: 'tabular-nums', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}
      >
        {value}
      </div>
    </div>
  );

  /* One hairline notice. Kind only changes the rule weight — never the hue. */
  const Notice = ({ kind = 'ok', children, onDismiss }) => (
    <div
      style={{
        display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12,
        border: `1px solid ${kind === 'ok' ? ind.hairline : ind.ink}`, padding: '9px 14px',
      }}
    >
      <span style={{ fontFamily: BODY, fontSize: 12.5, color: ind.ink, lineHeight: 1.45 }}>{children}</span>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label={t('common.close', 'Close')}
          style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: ind.inkMuted, lineHeight: 0 }}
        >
          <X size={14} strokeWidth={1.5} />
        </button>
      )}
    </div>
  );

  const panelHeader = (title, note) => (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
      <span style={{ fontFamily: DISPLAY, fontWeight: 600, fontSize: 16, letterSpacing: '.06em', textTransform: 'uppercase', color: ind.ink }}>
        {title}
      </span>
      {note && <span style={{ fontFamily: BODY, fontSize: 11.5, color: ind.inkMuted }}>{note}</span>}
    </div>
  );

  const passwordFormOpen =
    showChangePassword && !isChangingPassword.current && localStorage.getItem('changingPassword') !== 'true';

  return (
    <div
      data-screen-label="Control Panel"
      style={{
        border: `1px solid ${ind.hairline}`,
        background: ind.ground,
        color: ind.ink,
        fontFamily: BODY,
        fontSize: 14,
        borderRadius: 0,
      }}
    >
      {/* ── TICKER — the figures that never move ─────────────────────── */}
      <div
        style={{
          height: 44,
          background: ind.tickerBg,
          color: ind.tickerInk,
          borderBottom: `1px solid ${ind.hairline}`,
          display: 'flex',
          alignItems: 'stretch',
          overflowX: 'auto',
          overflowY: 'hidden',
        }}
      >
        <TickerCell ind={ind} title={demoLocked ? t('controlPanel.demoSession', 'Demo session — actions are simulated') : t('controlPanel.liveSession', 'Live session')}>
          <LiveClock ind={ind} live={!demoLocked} />
        </TickerCell>

        <TickerCell ind={ind} label={t('controlPanel.role', 'Role')} value={getTranslatedRole(userRole).toUpperCase()} />
        <TickerCell ind={ind} label={t('controlPanel.mode', 'Mode')} value={modeLabel.toUpperCase()} />

        {canViewVisitAnalytics && (
          <>
            <TickerCell ind={ind} label={t('controlPanel.visit.total', 'Visits')} value={visitSummary.total} />
            <TickerCell
              ind={ind}
              label={t('controlPanel.visit.last24h', 'Last 24h')}
              value={visitSummary.last24h}
              // The one figure on the strip that is worth acting on.
              valueColor={visitSummary.last24h > 0 ? ind.tickerUp : undefined}
            />
            <TickerCell ind={ind} label={t('controlPanel.visit.distinctIps', 'Distinct IPs')} value={visitSummary.distinctIps} />
          </>
        )}

        <div
          style={{
            flex: 1,
            minWidth: 'max-content',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: 10,
            padding: '0 14px',
            borderLeft: `1px solid ${ind.tickerRule}`,
          }}
        >
          <FetchElapsedPill
            active={loadingUsers || loadingEmployees || loadingVisits}
            isDarkMode
            label={t('common.fetching', 'Fetching')}
          />
          <span style={{ fontFamily: DISPLAY, fontWeight: 600, fontSize: 12.5, letterSpacing: '.06em', color: ind.tickerInk, opacity: 0.8, whiteSpace: 'nowrap' }}>
            {userEmail}
          </span>
        </div>
      </div>

      {/* ── BANDS ────────────────────────────────────────────────────── */}
      <div className="flex flex-col lg:flex-row items-stretch">

        {/* ── LEFT — who you are and what you can change ───────────── */}
        <div
          className="flex-1 min-w-0 flex flex-col"
          style={{ padding: '22px 24px 20px', gap: 16, borderRight: `1px solid ${ind.hairline}` }}
        >
          {avatarSuccess && <Notice onDismiss={() => setAvatarSuccess('')}>{avatarSuccess}</Notice>}

          {/* Title row — provenance sits in the title, not a footnote. */}
          <div className="flex flex-wrap items-end justify-between" style={{ gap: 14 }}>
            <div className="flex items-center" style={{ gap: 10, minWidth: 0 }}>
              {/* The object, not a figure. The panel carries no hero number, so
                  the clock can sit beside the title without competing with one;
                  it reads the same wall time as the ticker's LIVE cell. */}
              <PunchClock3D
                isDarkMode={isDarkMode}
                style={{ width: 84, height: 84, flex: 'none', marginLeft: -8 }}
              />
              <div style={{ minWidth: 0 }}>
                <h1 style={{ fontFamily: BODY, fontSize: 32, fontWeight: 400, margin: 0, color: ind.ink, lineHeight: 1.1 }}>
                  {t('controlPanel.title', 'Control Panel')}
                </h1>
                <p style={{ ...caption, marginTop: 6 }}>
                  {[
                    `${t('controlPanel.signedInAs', 'Signed in as')} ${userName}`,
                    getTranslatedRole(userRole),
                    `${t('controlPanel.mode', 'Mode')} ${modeLabel.toLowerCase()}`,
                  ].join(' · ')}
                </p>
              </div>
            </div>
            <Btn ind={ind} onClick={openManual} style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
              <BookOpen size={13} strokeWidth={1.5} />
              {t('controlPanel.readManual', 'Read Manual')}
            </Btn>
          </div>

          {/* ── Identity ───────────────────────────────────────────── */}
          <Blueprint ind={ind} style={{ padding: '16px 20px 16px', flex: 'none' }}>
            {panelHeader(
              t('controlPanel.identity', 'Identity'),
              t('controlPanel.identityScope', 'Scope: this sign-in only')
            )}

            <div className="flex flex-col sm:flex-row" style={{ gap: 18 }}>
              {/* Square avatar — square controls everywhere, never a circle. */}
              <div className="relative group" style={{ flex: 'none' }}>
                <div
                  style={{
                    width: 72, height: 72, border: `1px solid ${ind.hairline}`, borderRadius: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
                    background: ind.chrome,
                  }}
                >
                  {uploadingAvatar ? (
                    <Loader className="animate-spin" size={20} strokeWidth={1.5} style={{ color: ind.accent }} />
                  ) : avatarUrl ? (
                    <img src={avatarUrl} alt={userName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <User size={28} strokeWidth={1.25} style={{ color: ind.inkFaint }} />
                  )}
                </div>
                {!uploadingAvatar && (
                  <label
                    className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                    title={t('controlPanel.uploadAvatar', 'Upload avatar')}
                    style={{ background: 'rgba(29,31,32,.55)' }}
                  >
                    <Camera size={18} strokeWidth={1.5} style={{ color: '#f2f2f3' }} />
                    <input
                      type="file"
                      accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
                      onChange={handleAvatarUpload}
                      className="hidden"
                    />
                  </label>
                )}
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
                  <span style={{ fontFamily: DISPLAY, fontWeight: 600, fontSize: 20, letterSpacing: '.04em', textTransform: 'uppercase', color: ind.ink }}>
                    {userName}
                  </span>
                  <Tag ind={ind} variant={isAdmin ? 'accent' : 'neutral'}>{getTranslatedRole(userRole)}</Tag>
                </div>
                <p style={{ ...caption, marginTop: 4 }}>{userEmail}</p>
                <p style={{ ...consequence, marginTop: 8, display: 'flex', alignItems: 'flex-start', gap: 7 }}>
                  <Shield size={13} strokeWidth={1.5} style={{ flex: 'none', marginTop: 1, color: ind.accent }} />
                  <span>{roleDescriptions[userRole] || t('controlPanel.standardAccess', 'Standard user access')}</span>
                </p>

                <div style={{ display: 'flex', gap: 10, marginTop: 12, flexWrap: 'wrap' }}>
                  <Plate label={t('controlPanel.userUuid', 'User UUID')} value={`${userId.substring(0, 8)}…`} title={userId} mono />
                  {employeeId && <Plate label={t('controlPanel.employeeId', 'Employee ID')} value={employeeId} mono />}
                </div>
              </div>
            </div>
          </Blueprint>

          {/* ── Credentials ────────────────────────────────────────── */}
          <Blueprint ind={ind} style={{ padding: '16px 20px 6px', flex: 'none' }}>
            {panelHeader(
              t('controlPanel.credentials', 'Credentials'),
              isAdmin
                ? t('controlPanel.credentialsScopeAdmin', 'Scope: your sign-in · plus any account you administer')
                : t('controlPanel.credentialsScope', 'Scope: your sign-in only')
            )}

            {/* Own password */}
            <div style={settingRow}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontFamily: BODY, fontSize: 13.5, color: ind.ink }}>
                  {t('controlPanel.changeOwnPassword', 'Change Own Password')}
                </div>
                <p style={consequence}>
                  {demoLocked
                    ? t('controlPanel.demoLockedNote', 'Locked in demo mode — nothing is written to the database')
                    : t('controlPanel.ownPasswordNote', 'Takes effect immediately; this device stays signed in')}
                </p>
              </div>
              <Btn
                ind={ind}
                disabled={demoLocked}
                onClick={() => {
                  if (demoLocked) return;
                  localStorage.removeItem('changingPassword');
                  isChangingPassword.current = false;
                  setShowChangePassword(!showChangePassword);
                }}
                title={demoLocked ? t('controlPanel.demoModeDisabled', 'Function is locked') : ''}
                style={{ flex: 'none', display: 'inline-flex', alignItems: 'center', gap: 7 }}
              >
                <Key size={13} strokeWidth={1.5} />
                {passwordFormOpen ? t('common.cancel', 'Cancel') : t('controlPanel.change', 'Change')}
              </Btn>
            </div>

            {passwordFormOpen && (
              <form onSubmit={handleChangePassword} style={{ padding: '4px 0 14px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                {passwordError && <Notice kind="alert">{passwordError}</Notice>}
                {passwordSuccess && <Notice>{passwordSuccess}</Notice>}

                <div className="flex flex-col sm:flex-row" style={{ gap: 12 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <label style={fieldLabel}>{t('controlPanel.newPassword', 'New Password')}</label>
                    <div style={{ position: 'relative' }}>
                      <input
                        type={showNewPassword ? 'text' : 'password'}
                        value={passwordForm.newPassword}
                        onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                        autoComplete="new-password"
                        style={fieldBox}
                      />
                      <button type="button" onClick={() => setShowNewPassword(!showNewPassword)} style={revealBtn} aria-label={t('controlPanel.togglePassword', 'Show or hide password')}>
                        {showNewPassword ? <EyeOff size={15} strokeWidth={1.5} /> : <Eye size={15} strokeWidth={1.5} />}
                      </button>
                    </div>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <label style={fieldLabel}>{t('controlPanel.confirmPassword', 'Confirm Password')}</label>
                    <div style={{ position: 'relative' }}>
                      <input
                        type={showConfirmPassword ? 'text' : 'password'}
                        value={passwordForm.confirmPassword}
                        onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                        autoComplete="new-password"
                        style={fieldBox}
                      />
                      <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} style={revealBtn} aria-label={t('controlPanel.togglePassword', 'Show or hide password')}>
                        {showConfirmPassword ? <EyeOff size={15} strokeWidth={1.5} /> : <Eye size={15} strokeWidth={1.5} />}
                      </button>
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 7 }}>
                  <Btn ind={ind} variant="primary" type="submit">{t('common.save', 'Save')}</Btn>
                  <Btn
                    ind={ind}
                    onClick={() => {
                      localStorage.removeItem('changingPassword');
                      isChangingPassword.current = false;
                      setShowChangePassword(false);
                      setPasswordForm({ newPassword: '', confirmPassword: '' });
                      setPasswordError('');
                    }}
                  >
                    {t('common.cancel', 'Cancel')}
                  </Btn>
                </div>
              </form>
            )}

            {/* Reset another user's password — admin only */}
            {isAdmin && (
              <>
                <div style={settingRow}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontFamily: BODY, fontSize: 13.5, color: ind.ink }}>
                      {t('controlPanel.resetUserPassword', 'Reset User Password')}
                    </div>
                    <p style={consequence}>
                      {allUsers.length > 0
                        ? t('controlPanel.userPasswordNote', '{n} accounts in scope — they sign in with the new password immediately').replace('{n}', String(allUsers.length))
                        : t('controlPanel.userPasswordNoteIdle', 'Signs the chosen account out of every device it is using')}
                    </p>
                  </div>
                  <Btn
                    ind={ind}
                    disabled={demoLocked}
                    onClick={() => { if (!demoLocked) setShowAdminReset(!showAdminReset); }}
                    title={demoLocked ? t('controlPanel.demoModeDisabled', 'Function is locked') : ''}
                    style={{ flex: 'none', display: 'inline-flex', alignItems: 'center', gap: 7 }}
                  >
                    <Users size={13} strokeWidth={1.5} />
                    {showAdminReset ? t('common.cancel', 'Cancel') : t('controlPanel.resetPassword', 'Reset Password')}
                  </Btn>
                </div>

                {showAdminReset && (
                  <form onSubmit={handleOthersPassword} style={{ padding: '4px 0 14px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {adminResetError && <Notice kind="alert">{adminResetError}</Notice>}
                    {adminResetSuccess && <Notice>{adminResetSuccess}</Notice>}

                    <div>
                      <label style={fieldLabel}>{t('controlPanel.selectUser', 'Select User')}</label>
                      {loadingUsers ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, ...caption }}>
                          <Loader className="animate-spin" size={14} strokeWidth={1.5} />
                          <span>{t('common.loading', 'Loading...')}</span>
                        </div>
                      ) : (
                        <select
                          value={selectedUserId}
                          onChange={(e) => setSelectedUserId(e.target.value)}
                          style={{ ...fieldBox, padding: '7px 10px' }}
                        >
                          <option value="">{t('controlPanel.chooseUser', '-- Choose a user --')}</option>
                          {allUsers.map((u) => (
                            <option key={u.id} value={u.id} style={{ color: '#1d1f20' }}>
                              {u.full_name || u.email} ({u.email}) — {getTranslatedRole(u.role)}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>

                    <div className="flex flex-col sm:flex-row" style={{ gap: 12 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <label style={fieldLabel}>{t('controlPanel.newPassword', 'New Password')}</label>
                        <div style={{ position: 'relative' }}>
                          <input
                            type={showAdminPassword ? 'text' : 'password'}
                            value={adminResetPassword}
                            onChange={(e) => setAdminResetPassword(e.target.value)}
                            placeholder={t('controlPanel.enterNewPassword', 'Enter new password')}
                            style={fieldBox}
                          />
                          <button type="button" onClick={() => setShowAdminPassword(!showAdminPassword)} style={revealBtn} aria-label={t('controlPanel.togglePassword', 'Show or hide password')}>
                            {showAdminPassword ? <EyeOff size={15} strokeWidth={1.5} /> : <Eye size={15} strokeWidth={1.5} />}
                          </button>
                        </div>
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <label style={fieldLabel}>{t('controlPanel.confirmPassword', 'Confirm Password')}</label>
                        <div style={{ position: 'relative' }}>
                          <input
                            type={showAdminConfirm ? 'text' : 'password'}
                            value={adminResetConfirm}
                            onChange={(e) => setAdminResetConfirm(e.target.value)}
                            placeholder={t('controlPanel.confirmNewPassword', 'Confirm new password')}
                            style={fieldBox}
                          />
                          <button type="button" onClick={() => setShowAdminConfirm(!showAdminConfirm)} style={revealBtn} aria-label={t('controlPanel.togglePassword', 'Show or hide password')}>
                            {showAdminConfirm ? <EyeOff size={15} strokeWidth={1.5} /> : <Eye size={15} strokeWidth={1.5} />}
                          </button>
                        </div>
                      </div>
                    </div>

                    <p style={{ ...consequence, borderTop: `1px solid ${ind.rule}`, paddingTop: 9 }}>
                      <strong style={{ fontFamily: DISPLAY, fontWeight: 600, letterSpacing: '.1em', textTransform: 'uppercase' }}>
                        {t('controlPanel.warning', 'Warning')}
                      </strong>
                      {' — '}
                      {t('controlPanel.adminResetWarning', 'This will change the password for the selected user. They will need to use the new password to log in.')}
                    </p>

                    <div style={{ display: 'flex', gap: 7 }}>
                      <Btn ind={ind} variant="primary" type="submit">{t('controlPanel.resetPassword', 'Reset Password')}</Btn>
                      <Btn
                        ind={ind}
                        onClick={() => {
                          setShowAdminReset(false);
                          setSelectedUserId('');
                          setAdminResetPassword('');
                          setAdminResetConfirm('');
                          setAdminResetError('');
                        }}
                      >
                        {t('common.cancel', 'Cancel')}
                      </Btn>
                    </div>
                  </form>
                )}

                {/* Reset an employee record's sign-in */}
                <div style={settingRow}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontFamily: BODY, fontSize: 13.5, color: ind.ink }}>
                      {t('controlPanel.resetEmployeePassword', 'Reset Employee Password')}
                    </div>
                    <p style={consequence}>
                      {allEmployees.length > 0
                        ? t('controlPanel.employeePasswordNote', '{n} employee records carry a sign-in of their own').replace('{n}', String(allEmployees.length))
                        : t('controlPanel.employeePasswordNoteIdle', 'Only employee records linked to a user account can be reset')}
                    </p>
                  </div>
                  <Btn
                    ind={ind}
                    disabled={demoLocked}
                    onClick={() => { if (!demoLocked) setShowEmployeeReset(!showEmployeeReset); }}
                    title={demoLocked ? t('controlPanel.demoModeDisabled', 'Function is locked') : ''}
                    style={{ flex: 'none', display: 'inline-flex', alignItems: 'center', gap: 7 }}
                  >
                    <Shield size={13} strokeWidth={1.5} />
                    {showEmployeeReset ? t('common.cancel', 'Cancel') : t('controlPanel.resetPassword', 'Reset Password')}
                  </Btn>
                </div>

                {showEmployeeReset && (
                  <form onSubmit={handleEmployeeResetPassword} style={{ padding: '4px 0 14px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {employeeResetError && <Notice kind="alert">{employeeResetError}</Notice>}
                    {employeeResetSuccess && <Notice>{employeeResetSuccess}</Notice>}

                    <div>
                      <label style={fieldLabel}>{t('controlPanel.selectEmployee', 'Select Employee')}</label>
                      {loadingEmployees ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, ...caption }}>
                          <Loader className="animate-spin" size={14} strokeWidth={1.5} />
                          <span>{t('common.loading', 'Loading...')}</span>
                        </div>
                      ) : (
                        <select
                          value={selectedEmployeeId}
                          onChange={(e) => setSelectedEmployeeId(e.target.value)}
                          style={{ ...fieldBox, padding: '7px 10px' }}
                        >
                          <option value="">{t('controlPanel.chooseEmployee', '-- Choose an employee --')}</option>
                          {allEmployees.map((emp) => (
                            <option key={emp.id} value={emp.id} style={{ color: '#1d1f20' }}>
                              {getDemoEmployeeName(emp, t)} ({emp.email})
                            </option>
                          ))}
                        </select>
                      )}
                    </div>

                    <div className="flex flex-col sm:flex-row" style={{ gap: 12 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <label style={fieldLabel}>{t('controlPanel.newPassword', 'New Password')}</label>
                        <div style={{ position: 'relative' }}>
                          <input
                            type={showEmployeePassword ? 'text' : 'password'}
                            value={employeeResetPassword}
                            onChange={(e) => setEmployeeResetPassword(e.target.value)}
                            placeholder={t('controlPanel.enterNewPassword', 'Enter new password')}
                            style={fieldBox}
                          />
                          <button type="button" onClick={() => setShowEmployeePassword(!showEmployeePassword)} style={revealBtn} aria-label={t('controlPanel.togglePassword', 'Show or hide password')}>
                            {showEmployeePassword ? <EyeOff size={15} strokeWidth={1.5} /> : <Eye size={15} strokeWidth={1.5} />}
                          </button>
                        </div>
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <label style={fieldLabel}>{t('controlPanel.confirmPassword', 'Confirm Password')}</label>
                        <div style={{ position: 'relative' }}>
                          <input
                            type={showEmployeeConfirm ? 'text' : 'password'}
                            value={employeeResetConfirm}
                            onChange={(e) => setEmployeeResetConfirm(e.target.value)}
                            placeholder={t('controlPanel.confirmNewPassword', 'Confirm new password')}
                            style={fieldBox}
                          />
                          <button type="button" onClick={() => setShowEmployeeConfirm(!showEmployeeConfirm)} style={revealBtn} aria-label={t('controlPanel.togglePassword', 'Show or hide password')}>
                            {showEmployeeConfirm ? <EyeOff size={15} strokeWidth={1.5} /> : <Eye size={15} strokeWidth={1.5} />}
                          </button>
                        </div>
                      </div>
                    </div>

                    <p style={{ ...consequence, borderTop: `1px solid ${ind.rule}`, paddingTop: 9 }}>
                      <strong style={{ fontFamily: DISPLAY, fontWeight: 600, letterSpacing: '.1em', textTransform: 'uppercase' }}>
                        {t('controlPanel.warning', 'Warning')}
                      </strong>
                      {' — '}
                      {t('controlPanel.adminResetWarning', 'This will change the password for the selected user. They will need to use the new password to log in.')}
                    </p>

                    <div style={{ display: 'flex', gap: 7 }}>
                      <Btn ind={ind} variant="primary" type="submit">{t('controlPanel.resetPassword', 'Reset Password')}</Btn>
                      <Btn
                        ind={ind}
                        onClick={() => {
                          setShowEmployeeReset(false);
                          setSelectedEmployeeId('');
                          setEmployeeResetPassword('');
                          setEmployeeResetConfirm('');
                          setEmployeeResetError('');
                        }}
                      >
                        {t('common.cancel', 'Cancel')}
                      </Btn>
                    </div>
                  </form>
                )}
              </>
            )}
          </Blueprint>

          {/* ── Visit analytics — admin and demo admin ─────────────── */}
          {canViewVisitAnalytics && (
            <Blueprint ind={ind} style={{ padding: '16px 20px 16px', flex: 'none' }}>
              <div className="flex items-baseline justify-between" style={{ gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
                  <span style={{ fontFamily: DISPLAY, fontWeight: 600, fontSize: 16, letterSpacing: '.06em', textTransform: 'uppercase', color: ind.ink }}>
                    {t('controlPanel.visitAnalytics', 'Visit analytics')}
                  </span>
                  <span style={{ fontFamily: BODY, fontSize: 11.5, color: ind.inkMuted }}>
                    {t('controlPanel.visitScope', 'Scope: every session that reached the app')}
                  </span>
                </div>
                <Btn
                  ind={ind}
                  onClick={handleRefreshVisits}
                  disabled={loadingVisits}
                  title={t('controlPanel.refreshVisitAnalytics', 'Refresh visit analytics')}
                  style={{ flex: 'none', display: 'inline-flex', alignItems: 'center', gap: 7 }}
                >
                  <RefreshCcw size={13} strokeWidth={1.5} className={loadingVisits ? 'animate-spin' : ''} />
                  {loadingVisits ? t('controlPanel.refreshing', 'Refreshing...') : t('controlPanel.refresh', 'Refresh')}
                </Btn>
              </div>

              {visitError ? (
                <Notice kind="alert">{visitError}</Notice>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(112px,1fr))', gap: 10 }}>
                  <Plate label={t('controlPanel.visit.total', 'Total')} value={visitSummary.total} />
                  <Plate label={t('controlPanel.visit.last24h', 'Last 24h')} value={visitSummary.last24h} />
                  <Plate label={t('controlPanel.visit.distinctIps', 'Distinct IPs')} value={visitSummary.distinctIps} />
                  <Plate label={t('controlPanel.visit.demoCount', 'Demo sessions')} value={visitSummary.demoCount ?? 0} />
                  <Plate label={t('controlPanel.visit.authorized', 'Authorised')} value={visitSummary.authorizedSessions ?? 0} />
                </div>
              )}

              <div style={{ marginTop: 14, maxHeight: 208, overflowY: 'auto' }}>
                {visitSummary.recent?.length === 0 && !visitError && (
                  <p style={caption}>{t('controlPanel.visit.noVisits', 'No visits logged yet.')}</p>
                )}
                {visitSummary.recent?.map((row) => (
                  <div
                    key={row.id}
                    style={{
                      display: 'flex', alignItems: 'flex-start', gap: 12,
                      padding: '9px 0', borderTop: `1px solid ${ind.rule}`,
                    }}
                  >
                    <span style={{ ...figure(11, ind.inkMuted), width: 96, flex: 'none', letterSpacing: '.1em' }}>
                      {new Date(row.created_at).toLocaleString()}
                    </span>
                    <span style={{ minWidth: 0, flex: 1 }}>
                      <span className="block" style={{ fontFamily: BODY, fontSize: 12.5, color: ind.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {row.path || '/'}
                      </span>
                      <span className="block" style={{ fontFamily: BODY, fontSize: 11.5, color: ind.inkMuted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {row.ip || t('controlPanel.visit.unknownIp', 'unknown IP')}
                        {row.referrer ? ` · ${t('controlPanel.visit.ref', 'Ref')}: ${row.referrer}` : ''}
                      </span>
                    </span>
                  </div>
                ))}
              </div>
            </Blueprint>
          )}
        </div>

        {/* ── RIGHT — the decision column, 340px ────────────────────── */}
        <aside
          className="w-full lg:w-[340px] lg:shrink-0 flex flex-col"
          style={{ background: ind.chrome, overflow: 'hidden' }}
        >
          <div style={{ padding: '20px 20px 12px', borderBottom: `1px solid ${ind.hairline}` }}>
            <div className="flex items-baseline justify-between" style={{ gap: 10 }}>
              <ColumnHeading ind={ind}>{t('controlPanel.session', 'Session')}</ColumnHeading>
              <span style={{ fontFamily: DISPLAY, fontWeight: 600, fontSize: 12, color: ind.accent, whiteSpace: 'nowrap' }}>
                {modeLabel.toUpperCase()}
              </span>
            </div>
            <p style={{ ...caption, marginTop: 6 }}>
              {demoLocked
                ? t('controlPanel.demoSessionNote', 'Demo data lives in this browser. Nothing here reaches the database.')
                : t('controlPanel.liveSessionNote', 'These actions leave the screen. Everything else above is yours alone.')}
            </p>
          </div>

          {/* Demo-only: role switch and the data restore bench */}
          {demoLocked && (
            <>
              <div style={{ padding: '14px 20px', borderBottom: `1px solid ${ind.rule}` }}>
                <div className="flex items-baseline justify-between" style={{ gap: 10 }}>
                  <span style={{ fontFamily: DISPLAY, fontWeight: 600, fontSize: 14, letterSpacing: '.04em', textTransform: 'uppercase', color: ind.ink }}>
                    {t('controlPanel.switchToPrefix', 'Switch to')}{' '}
                    {userRole === 'demo_admin'
                      ? t('controlPanel.demoEmployeeLabel', 'Demo Employee')
                      : t('controlPanel.demoAdminLabel', 'Demo Admin')}
                  </span>
                  <MiniFlubberAutoMorphChangeRole isDarkMode={isDarkMode} />
                </div>
                <p style={{ ...consequence, marginBottom: 10 }}>
                  {t('controlPanel.demoRoleOnly', 'This feature is only available in demo mode')}
                </p>
                <Btn
                  ind={ind}
                  onClick={() => switchDemoRole?.(userRole === 'demo_admin' ? 'demo_employee' : 'demo_admin')}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}
                >
                  <UserPen size={13} strokeWidth={1.5} />
                  {t('controlPanel.switchRole', 'Switch role')}
                </Btn>
              </div>

              <div style={{ padding: '14px 20px', borderBottom: `1px solid ${ind.rule}` }}>
                <div className="flex items-baseline justify-between" style={{ gap: 10 }}>
                  <span style={{ fontFamily: DISPLAY, fontWeight: 600, fontSize: 14, letterSpacing: '.04em', textTransform: 'uppercase', color: ind.ink }}>
                    {t('controlPanel.restoreDemoData', 'Restore Demo Data')}
                  </span>
                  <Tag ind={ind} variant="outline">{t('controlPanel.modeDemo', 'Demo')}</Tag>
                </div>
                <p style={{ ...consequence, marginBottom: 10 }}>
                  {t('controlPanel.restoreDemoDataDescription', 'Restore default demo data for specific data types. This will reset any changes you made.')}
                </p>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7 }}>
                  {[
                    { key: 'timeEntries', label: t('controlPanel.demoTimeEntries', 'Time Entries'), fn: resetDemoTimeEntries },
                    { key: 'goals', label: t('controlPanel.demoGoals', 'Goals'), fn: resetDemoGoals },
                    { key: 'tasks', label: t('controlPanel.demoTasks', 'Tasks'), fn: resetDemoTasks },
                    { key: 'reviews', label: t('controlPanel.demoReviews', 'Reviews'), fn: resetDemoReviews },
                    { key: 'skills', label: t('controlPanel.demoSkills', 'Skills'), fn: resetDemoSkills },
                    { key: 'leaveRequests', label: t('controlPanel.demoLeaveRequests', 'Leave Requests'), fn: resetDemoLeaveRequests },
                  ].map(({ key, label, fn }) => (
                    <Btn
                      ind={ind}
                      key={key}
                      disabled={restoringDemoData !== null}
                      onClick={() => {
                        setRestoringDemoData(key);
                        setTimeout(() => {
                          fn();
                          setRestoringDemoData(null);
                          setToast({ show: true, message: t('controlPanel.demoDataRestored', '{type} restored to defaults').replace('{type}', label), type: 'success' });
                          setTimeout(() => setToast({ show: false, message: '', type: '' }), 3000);
                        }, 500);
                      }}
                      style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: 11.5, padding: '4px 8px' }}
                    >
                      {restoringDemoData === key
                        ? <Loader className="animate-spin" size={12} strokeWidth={1.5} />
                        : <RefreshCcw size={12} strokeWidth={1.5} />}
                      {label}
                    </Btn>
                  ))}
                </div>

                <Btn
                  ind={ind}
                  disabled={restoringDemoData !== null}
                  onClick={() => {
                    setRestoringDemoData('all');
                    setTimeout(() => {
                      resetAllDemoData();
                      setRestoringDemoData(null);
                      setToast({ show: true, message: t('controlPanel.allDemoDataRestored', 'All demo data restored to defaults'), type: 'success' });
                      setTimeout(() => setToast({ show: false, message: '', type: '' }), 3000);
                    }, 500);
                  }}
                  style={{ width: '100%', marginTop: 7, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}
                >
                  {restoringDemoData === 'all'
                    ? <Loader className="animate-spin" size={13} strokeWidth={1.5} />
                    : <RefreshCcw size={13} strokeWidth={1.5} />}
                  {t('controlPanel.restoreAllDemoData', 'Restore All Demo Data')}
                </Btn>
              </div>
            </>
          )}

          {/* Help */}
          <div style={{ padding: '14px 20px', borderBottom: `1px solid ${ind.rule}` }}>
            <span style={{ fontFamily: DISPLAY, fontWeight: 600, fontSize: 14, letterSpacing: '.04em', textTransform: 'uppercase', color: ind.ink }}>
              {t('controlPanel.needHelp', 'Need Help?')}
            </span>
            <p style={{ ...consequence, marginBottom: 10 }}>
              {t('controlPanel.helpText', 'Check out the manual for detailed instructions on using the system.')}
            </p>
            <Btn ind={ind} onClick={openManual} style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
              <BookOpen size={13} strokeWidth={1.5} />
              {t('controlPanel.readManual', 'Read Manual')}
            </Btn>
          </div>

          {/* Sign out — the one commit on this screen */}
          <div style={{ padding: '14px 20px 20px', marginTop: 'auto' }}>
            <Kicker ind={ind} color={ind.inkMuted}>{t('controlPanel.endSession', 'End session')}</Kicker>
            <p style={{ ...consequence, marginBottom: 10 }}>
              {t('controlPanel.logoutNote', 'Signs this device out. Unsaved forms above are discarded.')}
            </p>
            <Btn
              ind={ind}
              variant="primary"
              onClick={handleLogout}
              style={{ width: '100%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}
            >
              <LogOut size={13} strokeWidth={1.5} />
              {t('controlPanel.logout', 'Log Out')}
            </Btn>
          </div>
        </aside>
      </div>

      {/* Toast — a hairline plate on the chrome ground, never a coloured banner */}
      {toast.show && (
        <div style={{ position: 'fixed', top: 16, right: 16, zIndex: 50 }} className="animate-fade-in">
          <div
            style={{
              display: 'flex', alignItems: 'center', gap: 10,
              background: ind.chrome, border: `1px solid ${ind.ink}`, borderRadius: 0, padding: '10px 14px',
            }}
          >
            {toast.type === 'success'
              ? <span aria-hidden="true" style={{ width: 6, height: 6, background: ind.accent, flex: 'none' }} />
              : <AlertCircle size={15} strokeWidth={1.5} style={{ flex: 'none', color: ind.ink }} />}
            <span style={{ fontFamily: BODY, fontSize: 12.5, color: ind.ink }}>{toast.message}</span>
          </div>
        </div>
      )}

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in { animation: fadeIn 0.3s ease-out; }
        /* Hide the browser's own password reveal icon — we draw our own. */
        input[type="password"]::-ms-reveal,
        input[type="password"]::-ms-clear { display: none; }
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
