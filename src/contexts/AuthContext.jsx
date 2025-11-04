import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase, hasPermission, customStorage } from '../config/supabaseClient';
import { linkUserToEmployee } from '../services/employeeService';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState(null);

  const clearAuthState = async () => {
    console.log('🧹 Clearing auth state and setting loading = false');
    setUser(null);
    setIsAuthenticated(false);
    setSession(null);
    setLoading(false);
    
    // Sign out from Supabase to clear any lingering session
    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.error('Error during sign out:', error);
    }
  };
  
  useEffect(() => {
    let mounted = true;
    
    // Initialize session on mount
    const initializeAuth = async () => {
      try {
        console.log('🔍 Initializing auth...');
        
        // Get the current session
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (!mounted) return;
        
        if (sessionError) {
          console.error('Session error:', sessionError);
          setLoading(false);
          return;
        }

        if (!session) {
          console.log('✅ No session found on mount');
          setLoading(false);
          return;
        }

        // Verify the session is valid
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        
        if (!mounted) return;
        
        if (userError || !user) {
          console.error('Invalid or expired session:', userError);
          await supabase.auth.signOut();
          setLoading(false);
          return;
        }

        // Session is valid - fetch user profile
        console.log('✅ Valid session found, loading profile...');
        setSession(session);
        await fetchUserProfile(user.id);
        
      } catch (error) {
        console.error('Auth initialization error:', error);
        if (mounted) setLoading(false);
      }
    };

    initializeAuth();

    // Listen for auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;
      
      console.log('🔔 Auth event:', event);

      if (event === 'SIGNED_IN' && session) {
        console.log('🔐 User signed in');
        setSession(session);
        setLoading(true);
        
        try {
          // Fetch profile immediately
          await fetchUserProfile(session.user.id);
          setIsAuthenticated(true);
        } catch (error) {
          console.error('Error loading profile after sign in:', error);
        } finally {
          if (mounted) setLoading(false);
        }
      } else if (event === 'SIGNED_OUT') {
        console.log('🚪 User signed out');
        setUser(null);
        setIsAuthenticated(false);
        setSession(null);
        setLoading(false);
      } else if (event === 'TOKEN_REFRESHED' && session) {
        console.log('🔄 Token refreshed');
        setSession(session);
        // Don't reload profile, just update session
      } else if (event === 'USER_UPDATED' && session) {
        console.log('👤 User updated');
        // Check if this is a password change - if so, skip profile reload
        // Password changes don't affect user metadata, so no need to reload
        const isPasswordChange = localStorage.getItem('changingPassword') === 'true';
        if (isPasswordChange) {
          console.log('⏭️ Skipping profile reload for password change');
        } else {
          console.log('🔄 Reloading profile for user update');
          await fetchUserProfile(session.user.id);
        }
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // Fetch user profile with role from database
  const fetchUserProfile = async (userId) => {
    let shouldCreateProfile = false;
    
    try {
      console.log('Fetching user profile for auth ID:', userId);
      
      // First, try to resolve the auth_user_id to hr_user_id using user_emails table
      const { data: emailData, error: emailError } = await supabase
        .from('user_emails')
        .select('hr_user_id')
        .eq('auth_user_id', userId)
        .maybeSingle();
      
      if (emailError) {
        console.error('Error checking user_emails:', emailError);
      }
      
      // Use the resolved hr_user_id if found, otherwise use the auth userId directly (backward compatibility)
      const hrUserId = emailData?.hr_user_id || userId;
      
      if (emailData?.hr_user_id) {
        console.log(`✅ Resolved auth ID ${userId} to hr_user ID ${hrUserId}`);
      } else {
        console.log('⚠️ No email mapping found, using auth ID directly (backward compatibility)');
      }
      
      // Fetch user from hr_users table using the resolved hr_user_id
      let { data, error } = await supabase
        .from('hr_users')
        .select('*')
        .eq('id', hrUserId)
        .single();
      
      // If successful, try to fetch employee name by matching email
      if (data && data.email && !error) {
        // Get all emails for this user from user_emails table
        const { data: userEmails } = await supabase
          .from('user_emails')
          .select('email')
          .eq('hr_user_id', hrUserId);
        
        // Build array of emails to search
        const emailsToSearch = [];
        
        // Split hr_users.email in case it has semicolon-separated emails
        if (data.email) {
          const hrUserEmails = data.email.split(';').map(e => e.trim()).filter(e => e);
          emailsToSearch.push(...hrUserEmails);
        }
        
        // Add all emails from user_emails table
        if (userEmails && userEmails.length > 0) {
          userEmails.forEach(ue => {
            if (!emailsToSearch.includes(ue.email)) {
              emailsToSearch.push(ue.email);
            }
          });
        }
        
        console.log(`🔍 Searching employees table with emails:`, emailsToSearch);
        
        // Try to find employee by any of these emails
        const { data: employeeData } = await supabase
          .from('employees')
          .select('name, id')
          .in('email', emailsToSearch)
          .limit(1)
          .maybeSingle();
        
        if (employeeData && employeeData.name) {
          console.log(`✅ Found employee name: ${employeeData.name}`);
          data.employee_name = employeeData.name;
          data.employee_id = employeeData.id;
        } else {
          console.log(`⚠️ No employee found for emails:`, emailsToSearch);
        }
      }
      
      // If successful and has manager_id, try to fetch manager separately
      if (data && data.manager_id && !error) {
        const { data: managerData } = await supabase
          .from('hr_users')
          .select('id, full_name, email, position')
          .eq('id', data.manager_id)
          .maybeSingle();
        
        if (managerData) {
          data.manager = managerData;
        }
      }

      if (error) {
        console.error('Database error:', error);
        
        // Mark that we should create profile if user not found
        if (error.code === 'PGRST116') {
          shouldCreateProfile = true;
        } else {
          throw error;
        }
      }

      if (data && data.is_active) {
        // Additional check: verify employment_status is not 'terminated'
        if (data.employment_status === 'terminated' || data.employment_status === 'inactive') {
          console.warn(`User account has employment_status: ${data.employment_status} - denying access`);
          await supabase.auth.signOut();
          setUser(null);
          setIsAuthenticated(false);
          setSession(null);
          setLoading(false);
          return;
        }
        
        console.log('User profile found:', data);
        
        // Employee data is already fetched above, just use it
        const employeeId = data.employee_id;
        const employeeName = data.employee_name;
        
        // Update last_login timestamp
        await supabase
          .from('hr_users')
          .update({ last_login: new Date().toISOString() })
          .eq('id', hrUserId);
        
        setUser({
          id: data.id,
          email: data.email,
          name: employeeName || data.full_name || data.first_name || data.email.split('@')[0],
          firstName: data.first_name,
          lastName: data.last_name,
          phone: data.phone,
          role: data.role,
          avatar_url: data.avatar_url,
          department: data.department,
          position: data.position,
          employeeId: employeeId,
          managerId: data.manager_id,
          manager: data.manager,
          hireDate: data.hire_date,
          employmentStatus: data.employment_status,
          salary: data.salary,
          permissions: hasPermission(data.role)
        });
        setIsAuthenticated(true);
        console.log('✅ Profile loaded successfully, setting loading = false');
        setLoading(false);
      } else if (shouldCreateProfile) {
        console.log('User not found, attempting to create profile...');
        await createUserProfile(userId);
      } else if (data && !data.is_active) {
        console.warn('User account is inactive (is_active = false)');
        await clearAuthState();
      } else {
        console.warn('No user data found and cannot create profile');
        setLoading(false);
      }
    } catch (error) {
      console.error('Error fetching user profile:', error);
      // On error, clear auth state to force re-login (includes setLoading(false))
      await clearAuthState();
    }
  };

  // Create user profile if it doesn't exist
  const createUserProfile = async (userId) => {
    try {
      const { data: authData } = await supabase.auth.getUser();
      
      // Extract name components from user metadata or email
      const userMetadata = authData.user.user_metadata || {};
      const fullName = userMetadata.full_name || userMetadata.name;
      let firstName = userMetadata.first_name || fullName?.split(' ')[0];
      let lastName = userMetadata.last_name || fullName?.split(' ').slice(1).join(' ');
      
      // CRITICAL: Check if there's an existing employee with this email
      const { data: existingEmployee } = await supabase
        .from('employees')
        .select('id, name, position, department, email')
        .eq('email', authData.user.email)
        .maybeSingle();
      
      let employeeId = null;
      let employeeName = null;
      let position = null;
      let department = null;
      
      if (existingEmployee) {
        console.log(`Found existing employee record for ${authData.user.email}:`, existingEmployee);
        employeeId = existingEmployee.id;
        employeeName = existingEmployee.name;
        position = existingEmployee.position;
        department = existingEmployee.department;
        
        // Extract first and last name from employee name if not provided
        if (!firstName && employeeName) {
          const nameParts = employeeName.split(' ');
          firstName = nameParts[0];
          lastName = nameParts.slice(1).join(' ');
        }
      } else {
        console.log(`No existing employee found for ${authData.user.email}, creating standalone user`);
      }
      
      const { error } = await supabase
        .from('hr_users')
        .insert([
          {
            id: userId,
            email: authData.user.email,
            first_name: firstName || authData.user.email.split('@')[0],
            last_name: lastName || null,
            avatar_url: userMetadata.avatar_url || null,
            role: position === 'general_manager' ? 'admin' : 
                  position === 'hr_specialist' ? 'manager' : 'employee',
            employment_status: 'active',
            employee_id: employeeId, // Link to existing employee if found
            position: position,
            department: department,
            created_at: new Date().toISOString()
          }
        ]);

      if (error) throw error;
      
      console.log(`User profile created successfully${employeeId ? ' and linked to employee ' + employeeId : ''}`);
      // Fetch the newly created profile
      await fetchUserProfile(userId);
    } catch (error) {
      console.error('Error creating user profile:', error);
      setLoading(false);
    }
  };

  // Email/Password login
  const login = async (email, password, rememberMe = true) => {
    try {
      console.log(`🔐 Logging in with email: ${email}, rememberMe: ${rememberMe}`);
      
      // Set storage type based on rememberMe checkbox
      if (typeof window !== 'undefined') {
        if (rememberMe) {
          customStorage.setStorage(window.localStorage);
          console.log('✅ Using localStorage (persistent session)');
        } else {
          customStorage.setStorage(window.sessionStorage);
          console.log('✅ Using sessionStorage (session-only)');
        }
      }
      
      // Check if this email has a mapping to a different HR user
      console.log('🔍 Checking email mapping in user_emails...');
      const { data: emailMapping, error: mappingError } = await supabase
        .from('user_emails')
        .select('email, hr_user_id, auth_user_id')
        .eq('email', email)
        .maybeSingle();
      
      // Always login with the provided email (authenticate the actual auth user)
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email,
        password
      });

      if (error) throw error;

      console.log('✅ Login successful');
      
      // If this email is mapped to a different HR user, we need to load that profile instead
      if (emailMapping && !mappingError && emailMapping.hr_user_id) {
        console.log(`🔗 Email mapping found: auth user ${data.user.id} → HR user ${emailMapping.hr_user_id}`);
        
        // Check if the logged-in auth user matches the expected auth_user_id
        if (data.user.id !== emailMapping.auth_user_id) {
          console.log(`⚠️ Auth user mismatch: logged in as ${data.user.id}, but user_emails expects ${emailMapping.auth_user_id}`);
          console.log(`📝 Will load HR profile for: ${emailMapping.hr_user_id}`);
        }
        
        // Manually fetch the HR user profile using the mapped hr_user_id
        // This allows multiple auth users to map to the same HR profile
        try {
          const { data: hrProfile, error: profileError } = await supabase
            .from('hr_users')
            .select('*')
            .eq('id', emailMapping.hr_user_id)
            .single();
          
          if (!profileError && hrProfile) {
            console.log('✅ Loaded mapped HR profile:', hrProfile);
            setUser(hrProfile);
            setIsAuthenticated(true);
            setSession(data.session);
            setLoading(false);
            return { success: true };
          }
        } catch (profileError) {
          console.error('Error loading mapped profile:', profileError);
          // Fall through to normal profile loading
        }
      }
      
      return { success: true };
    } catch (error) {
      console.error('Login error:', error);
      return { success: false, error: error.message };
    }
  };

  // GitHub OAuth login
  const loginWithGithub = async () => {
    try {
      // CRITICAL: Ensure we use localStorage for OAuth so session persists after redirect
      console.log('🔐 GitHub OAuth: Setting storage to localStorage for session persistence');
      customStorage.setStorage(localStorage);
      
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'github',
        options: {
          redirectTo: `${window.location.origin}/time-clock`,
          skipBrowserRedirect: false
        }
      });

      if (error) throw error;

      // OAuth will redirect the browser, so we don't need to do anything else
      // The success is about initiating the OAuth flow, not completing it
      console.log('✅ GitHub OAuth flow initiated successfully');
      return { success: true };
    } catch (error) {
      console.error('❌ GitHub login error:', error);
      
      // Provide more helpful error messages
      let errorMessage = error.message;
      if (error.message?.includes('popup')) {
        errorMessage = 'Please allow popups for this site to login with GitHub';
      } else if (error.message?.includes('network')) {
        errorMessage = 'Network error. Please check your connection and try again';
      } else if (error.message?.includes('not enabled')) {
        errorMessage = 'GitHub login is not enabled. Please contact your administrator.';
      }
      
      return { success: false, error: errorMessage };
    }
  };

  // Forgot password - send reset email
  const forgotPassword = async (email) => {
    try {
      console.log('📧 Sending password reset email to:', email);
      
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) throw error;

      console.log('✅ Password reset email sent successfully');
      return { success: true, message: 'Password reset email sent. Please check your inbox.' };
    } catch (error) {
      console.error('❌ Forgot password error:', error);
      
      let errorMessage = error.message;
      if (error.message?.includes('User not found')) {
        errorMessage = 'No account found with this email address';
      } else if (error.message?.includes('rate limit')) {
        errorMessage = 'Too many requests. Please try again later';
      } else if (error.message?.includes('network')) {
        errorMessage = 'Network error. Please check your connection';
      }
      
      return { success: false, error: errorMessage };
    }
  };

  // Reset password with token (called on reset-password page)
  const resetPassword = async (newPassword) => {
    try {
      console.log('🔐 Resetting password...');
      
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (error) throw error;

      console.log('✅ Password reset successfully');
      return { success: true, message: 'Password reset successfully. You can now login with your new password.' };
    } catch (error) {
      console.error('❌ Reset password error:', error);
      
      let errorMessage = error.message;
      if (error.message?.includes('same as the old password')) {
        errorMessage = 'New password must be different from the old password';
      } else if (error.message?.includes('weak')) {
        errorMessage = 'Password is too weak. Please use a stronger password';
      }
      
      return { success: false, error: errorMessage };
    }
  };

  const logout = async () => {
    try {
      console.log('🚪 Logging out...');
      
      // Sign out from Supabase (this will trigger SIGNED_OUT event)
      const { error } = await supabase.auth.signOut();
      
      if (error) {
        console.error('Logout error:', error);
      }
      
      // Clear state immediately
      setUser(null);
      setIsAuthenticated(false);
      setSession(null);
      setLoading(false);
      
      console.log('✅ Logged out successfully');
    } catch (error) {
      console.error('Logout error:', error);
      // Force clear state even on error
      setUser(null);
      setIsAuthenticated(false);
      setSession(null);
      setLoading(false);
    }
  };

  // Check if user has specific permission
  const checkPermission = (permission) => {
    if (!user || !user.role) return false;
    return hasPermission(user.role, permission);
  };

  const value = {
    isAuthenticated,
    user,
    session,
    loading,
    login,
    loginWithGithub,
    logout,
    signOut: logout, // Alias for backward compatibility
    forgotPassword,
    resetPassword,
    checkPermission
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
