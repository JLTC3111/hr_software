import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase, hasPermission } from '../config/supabaseClient';

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

  // Check for existing session on mount
  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) {
        fetchUserProfile(session.user.id);
      } else {
        setLoading(false);
      }
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session);
      if (session) {
        await fetchUserProfile(session.user.id);
      } else {
        setUser(null);
        setIsAuthenticated(false);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Fetch user profile with role from database
  const fetchUserProfile = async (userId) => {
    let shouldCreateProfile = false;
    
    try {
      console.log('Fetching user profile for ID:', userId);
      
      // Fetch user from hr_users table
      let { data, error } = await supabase
        .from('hr_users')
        .select(`
          *,
          manager:hr_users!manager_id(
            id,
            full_name,
            email,
            position
          )
        `)
        .eq('id', userId)
        .single();

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
        console.log('User profile found:', data);
        
        // Update last_login timestamp
        await supabase
          .from('hr_users')
          .update({ last_login: new Date().toISOString() })
          .eq('id', userId);
        
        setUser({
          id: data.id,
          email: data.email,
          name: data.full_name || data.first_name || data.email.split('@')[0],
          firstName: data.first_name,
          lastName: data.last_name,
          phone: data.phone,
          role: data.role,
          avatar_url: data.avatar_url,
          department: data.department,
          position: data.position,
          employeeId: data.employee_id,
          managerId: data.manager_id,
          manager: data.manager,
          hireDate: data.hire_date,
          employmentStatus: data.employment_status,
          salary: data.salary,
          mustChangePassword: data.must_change_password,
          temporaryPasswordSetAt: data.temporary_password_set_at,
          passwordChangedAt: data.password_changed_at,
          permissions: hasPermission(data.role)
        });
        setIsAuthenticated(true);
        setLoading(false);
      } else if (shouldCreateProfile) {
        console.log('User not found, attempting to create profile...');
        await createUserProfile(userId);
      } else if (data && !data.is_active) {
        console.warn('User account is inactive');
        setLoading(false);
      } else {
        console.warn('No user data found and cannot create profile');
        setLoading(false);
      }
    } catch (error) {
      console.error('Critical error fetching user profile:', error);
      setLoading(false);
    }
  };

  // Create user profile if it doesn't exist
  const createUserProfile = async (userId) => {
    try {
      const { data: authData } = await supabase.auth.getUser();
      
      // Extract name components from user metadata or email
      const userMetadata = authData.user.user_metadata || {};
      const fullName = userMetadata.full_name || userMetadata.name;
      const firstName = userMetadata.first_name || fullName?.split(' ')[0];
      const lastName = userMetadata.last_name || fullName?.split(' ').slice(1).join(' ');
      
      const { error } = await supabase
        .from('hr_users')
        .insert([
          {
            id: userId,
            email: authData.user.email,
            first_name: firstName || authData.user.email.split('@')[0],
            last_name: lastName || null,
            avatar_url: userMetadata.avatar_url || null,
            role: 'employee', // Default role for new users
            employment_status: 'active',
            created_at: new Date().toISOString()
          }
        ]);

      if (error) throw error;
      
      console.log('User profile created successfully');
      // Fetch the newly created profile
      await fetchUserProfile(userId);
    } catch (error) {
      console.error('Error creating user profile:', error);
      setLoading(false);
    }
  };

  // Email/Password login
  const login = async (email, password) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      return { success: true };
    } catch (error) {
      console.error('Login error:', error);
      return { success: false, error: error.message };
    }
  };

  // GitHub OAuth login
  const loginWithGithub = async () => {
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'github',
        options: {
          redirectTo: `${window.location.origin}/dashboard`
        }
      });

      if (error) throw error;

      return { success: true };
    } catch (error) {
      console.error('GitHub login error:', error);
      return { success: false, error: error.message };
    }
  };

  // Logout
  const logout = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;

      setUser(null);
      setIsAuthenticated(false);
      setSession(null);
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  // Change password function
  const changePassword = async (currentPassword, newPassword) => {
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (error) throw error;

      // Clear temporary password requirement
      if (user?.id) {
        const { error: clearError } = await supabase.rpc('clear_temp_password_requirement', {
          user_id: user.id
        });

        if (clearError) {
          console.warn('Failed to clear temp password requirement:', clearError);
        } else {
          // Update user state to reflect password change
          setUser(prev => ({
            ...prev,
            mustChangePassword: false,
            passwordChangedAt: new Date().toISOString()
          }));
        }
      }

      return { success: true };
    } catch (error) {
      console.error('Password change error:', error);
      return { success: false, error: error.message };
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
    changePassword,
    checkPermission
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
