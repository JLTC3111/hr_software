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
    // Initialize session on mount
    const initializeAuth = async () => {

    Object.keys(localStorage).forEach((key) => {
      if (key.startsWith('sb-') && key.endsWith('-auth-token')) {
        console.log('🧨 Removing stale Supabase session:', key);
        localStorage.removeItem(key);
      }
    });

      try {
        // Get the session
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) {
          console.error('Session error:', sessionError);
          await clearAuthState();
          return;
        }

        if (!session) {
          console.log('✅ No session found on mount - setting loading = false');
          setLoading(false);
          return;
        }

        // Verify the session is valid by calling getUser()
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        
        if (userError || !user) {
          console.error('Invalid or expired session:', userError);
          // Session is invalid - sign out and clear everything
          await clearAuthState();
          return;
        }

        // Session is valid - fetch user profile
        console.log('✅ Valid session found, fetching profile...');
        setSession(session);
        await fetchUserProfile(user.id);
        
      } catch (error) {
        console.error('Auth initialization error:', error);
        await clearAuthState();
      }
    };

    initializeAuth();

    // Listen for auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('Auth state changed:', event, session ? 'with session' : 'no session');

      if (event === 'SIGNED_IN' && session) {
        console.log('🔐 SIGNED_IN event triggered, waiting for Supabase to hydrate...');
        
        setLoading(true);
        setSession(session);
      
        // Wait until Supabase confirms the session is accessible
        const confirmSession = async () => {
          for (let i = 0; i < 5; i++) {
            const { data } = await supabase.auth.getSession();
            if (data.session?.user) {
              console.log('✅ Supabase session hydrated.');
              return data.session.user;
            }
            console.log('⏳ Waiting for Supabase session to hydrate...');
            await new Promise((r) => setTimeout(r, 300)); // wait 300ms
          }
          throw new Error('Supabase session not hydrated in time');
        };
      
        try {
          const user = await confirmSession();
          await fetchUserProfile(user.id);
          setIsAuthenticated(true);
          console.log('✅ SIGNED_IN flow complete, setting loading = false');
        } catch (error) {
          console.error('❌ Error completing SIGNED_IN flow:', error);
          await clearAuthState();
        } finally {
          setLoading(false);
        }
      } else if (event === 'SIGNED_OUT') {
        console.log('🚪 SIGNED_OUT event triggered');
        await clearAuthState();
      } else if (event === 'TOKEN_REFRESHED') {
        console.log('🔄 TOKEN_REFRESHED event triggered');
        if (session) {
          setSession(session);
        }
      } else if (event === 'USER_UPDATED') {
        console.log('👤 USER_UPDATED event triggered');
        if (session?.user) {
          await fetchUserProfile(session.user.id);
        }
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
          permissions: hasPermission(data.role)
        });
        setIsAuthenticated(true);
        console.log('✅ Profile loaded successfully, setting loading = false');
        setLoading(false);
      } else if (shouldCreateProfile) {
        console.log('User not found, attempting to create profile...');
        await createUserProfile(userId);
      } else if (data && !data.is_active) {
        console.warn('User account is inactive');
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
          redirectTo: `${window.location.origin}/time-clock`,
          skipBrowserRedirect: false
        }
      });

      if (error) throw error;

      // OAuth will redirect the browser, so we don't need to do anything else
      // The success is about initiating the OAuth flow, not completing it
      return { success: true };
    } catch (error) {
      console.error('GitHub login error:', error);
      
      // Provide more helpful error messages
      let errorMessage = error.message;
      if (error.message?.includes('popup')) {
        errorMessage = 'Please allow popups for this site to login with GitHub';
      } else if (error.message?.includes('network')) {
        errorMessage = 'Network error. Please check your connection and try again';
      }
      
      return { success: false, error: errorMessage };
    }
  };

  const logout = async () => {

    Object.keys(localStorage, sessionStorage).forEach((key) => {
      if (key.startsWith('sb-') && key.endsWith('-auth-token')) {
        console.log('🧨 Clearing stale Supabase session:', key);
        localStorage.removeItem(key);
        sessionStorage.removeItem(key);
      }
    });

    try {
      console.log('Logging out...');
      await clearAuthState();
    } catch (error) {
      console.error('Logout error:', error);
      await clearAuthState();
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
    checkPermission
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
