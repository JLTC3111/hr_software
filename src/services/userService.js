import { supabase } from '../config/supabaseClient';
import { isDemoMode, MOCK_USER, MOCK_EMPLOYEES } from '../utils/demoHelper';

/**
 * User Service
 * Handles user account management including deletion with foreign key handling
 */

/**
 * Delete a user account and all related data
 * Handles foreign key constraints by removing/nullifying references first
 * 
 * @param {string} userId - UUID of the user to delete
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export const deleteUser = async (userId) => {
  if (isDemoMode()) {
    return { success: true };
  }

  try {
    console.log(`🗑️ Starting deletion process for user ${userId}`);

    // Step 1: Get user info before deletion
    const { data: userData, error: userError } = await supabase
      .from('hr_users')
      .select('email, employee_id')
      .eq('id', userId)
      .single();

    if (userError) {
      console.error('Error fetching user:', userError);
      throw new Error(`Failed to fetch user: ${userError.message}`);
    }

    console.log(`User to delete: ${userData.email}, Employee ID: ${userData.employee_id}`);

    // Step 2: Remove or nullify all foreign key references
    
    // 2a. Nullify employee_id in employees table (if this user is linked as an employee)
    if (userData.employee_id) {
      console.log(`Unlinking employee record ${userData.employee_id}...`);
      const { error: unlinkError } = await supabase
        .from('employees')
        .update({ employee_id: null })
        .eq('id', userData.employee_id);

      if (unlinkError) {
        console.warn('Error unlinking employee:', unlinkError);
        // Continue anyway, as this might not be critical
      }
    }

    // 2b. Delete or nullify records in other tables that reference this user
    
    // Note: time_entries table uses employee_id, not user_id
    // First try to delete by employee_id if we have it
    if (userData.employee_id) {
      const { error: timeEntriesError } = await supabase
        .from('time_entries')
        .delete()
        .eq('employee_id', userData.employee_id);
      
      if (timeEntriesError) {
        console.warn('Error deleting time entries:', timeEntriesError);
      }
    }

    // Delete leave requests
    const { error: leaveError } = await supabase
      .from('leave_requests')
      .delete()
      .eq('employee_id', userId);
    
    if (leaveError) {
      console.warn('Error deleting leave requests:', leaveError);
    }

    // Delete overtime logs
    const { error: overtimeError } = await supabase
      .from('overtime_logs')
      .delete()
      .eq('employee_id', userId);
    
    if (overtimeError) {
      console.warn('Error deleting overtime logs:', overtimeError);
    }

    // Delete performance reviews where user is reviewer or reviewee
    const { error: performanceError } = await supabase
      .from('employees_performance_summary')
      .delete()
      .eq('employee_id', userId);
    
    if (performanceError) {
      console.warn('Error deleting performance data:', performanceError);
    }

    // Nullify manager_id references (users who report to this user)
    const { error: managerError } = await supabase
      .from('hr_users')
      .update({ manager_id: null })
      .eq('manager_id', userId);
    
    if (managerError) {
      console.warn('Error removing manager references:', managerError);
    }

    // Step 3: Delete from hr_users table
    console.log('Deleting from hr_users table...');
    const { error: hrDeleteError } = await supabase
      .from('hr_users')
      .delete()
      .eq('id', userId);

    if (hrDeleteError) {
      console.error('Error deleting from hr_users:', hrDeleteError);
      throw new Error(`Failed to delete from hr_users: ${hrDeleteError.message}`);
    }

    // Step 4: Delete from auth.users (if admin/service role key is available)
    console.log('Deleting from auth.users...');
    try {
      const { error: authDeleteError } = await supabase.auth.admin.deleteUser(userId);
      
      if (authDeleteError) {
        console.warn('Could not delete from auth.users (might require admin privileges):', authDeleteError);
        // This might fail if using anon key, but hr_users deletion is more critical
      } else {
        console.log('✅ Successfully deleted from auth.users');
      }
    } catch (authError) {
      console.warn('Auth deletion not available (requires service role key):', authError);
      // Continue anyway - hr_users deletion is the critical part
    }

    console.log(`✅ Successfully deleted user ${userId}`);
    return { success: true };

  } catch (error) {
    console.error('Error deleting user:', error);
    return { 
      success: false, 
      error: error.message || 'Failed to delete user' 
    };
  }
};

/**
 * Soft delete a user (set inactive instead of deleting)
 * This is safer and preserves data integrity
 * 
 * @param {string} userId - UUID of the user to deactivate
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export const deactivateUser = async (userId) => {
  if (isDemoMode()) {
    return { success: true, data: { id: userId, is_active: false } };
  }

  try {
    console.log(`🔒 Deactivating user ${userId}`);

    const { data, error } = await supabase
      .from('hr_users')
      .update({ 
        is_active: false,
        employment_status: 'terminated'
      })
      .eq('id', userId)
      .select()
      .single();

    if (error) throw error;

    console.log(`✅ Successfully deactivated user ${userId}`);
    return { success: true, data };

  } catch (error) {
    console.error('Error deactivating user:', error);
    return { 
      success: false, 
      error: error.message || 'Failed to deactivate user' 
    };
  }
};

/**
 * Reactivate a previously deactivated user
 * 
 * @param {string} userId - UUID of the user to reactivate
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export const reactivateUser = async (userId) => {
  if (isDemoMode()) {
    return { success: true, data: { id: userId, is_active: true } };
  }

  try {
    console.log(`🔓 Reactivating user ${userId}`);

    const { data, error } = await supabase
      .from('hr_users')
      .update({ 
        is_active: true,
        employment_status: 'active'
      })
      .eq('id', userId)
      .select()
      .single();

    if (error) throw error;

    console.log(`✅ Successfully reactivated user ${userId}`);
    return { success: true, data };

  } catch (error) {
    console.error('Error reactivating user:', error);
    return { 
      success: false, 
      error: error.message || 'Failed to reactivate user' 
    };
  }
};

/**
 * Get all users with optional filters
 * 
 * @param {Object} filters - Filter options
 * @returns {Promise<{success: boolean, data?: Array, error?: string}>}
 */
export const getAllUsers = async (filters = {}) => {
  if (isDemoMode()) {
    // Create mock users from employees
    const mockUsers = MOCK_EMPLOYEES.map(emp => ({
      id: `user-${emp.id}`,
      email: emp.email,
      full_name: emp.name,
      role: emp.position.includes('Manager') ? 'admin' : 'employee',
      department: emp.department,
      is_active: emp.status === 'active',
      employee_id: emp.id,
      avatar_url: emp.photo
    }));
    
    // Add the current logged in demo user if not already there
    if (!mockUsers.find(u => u.email === MOCK_USER.email)) {
      mockUsers.unshift({
        id: MOCK_USER.id,
        email: MOCK_USER.email,
        full_name: MOCK_USER.name,
        role: MOCK_USER.role,
        department: MOCK_USER.department,
        is_active: true,
        employee_id: MOCK_USER.employeeId,
        avatar_url: MOCK_USER.avatar_url
      });
    }

    let data = [...mockUsers];
    if (filters.role) {
      data = data.filter(u => u.role === filters.role);
    }
    if (filters.department) {
      data = data.filter(u => u.department === filters.department);
    }
    if (filters.is_active !== undefined) {
      data = data.filter(u => u.is_active === filters.is_active);
    }

    return { success: true, data };
  }

  try {
    let query = supabase
      .from('hr_users')
      .select(`
        *,
        manager:hr_users!manager_id(
          id,
          full_name,
          email
        )
      `)
      .order('full_name');

    // Apply filters
    if (filters.role) {
      query = query.eq('role', filters.role);
    }
    if (filters.department) {
      query = query.eq('department', filters.department);
    }
    if (filters.is_active !== undefined) {
      query = query.eq('is_active', filters.is_active);
    }

    const { data, error } = await query;

    if (error) throw error;

    return { success: true, data };
  } catch (error) {
    console.error('Error fetching users:', error);
    return { 
      success: false, 
      error: error.message || 'Failed to fetch users' 
    };
  }
};

/**
 * Update user information
 * 
 * @param {string} userId - UUID of the user to update
 * @param {Object} updates - Fields to update
 * @returns {Promise<{success: boolean, data?: Object, error?: string}>}
 */
export const updateUser = async (userId, updates) => {
  if (isDemoMode()) {
    return { success: true, data: { id: userId, ...updates } };
  }

  try {
    const { data, error } = await supabase
      .from('hr_users')
      .update(updates)
      .eq('id', userId)
      .select()
      .single();

    if (error) throw error;

    return { success: true, data };
  } catch (error) {
    console.error('Error updating user:', error);
    return { 
      success: false, 
      error: error.message || 'Failed to update user' 
    };
  }
};

/**
 * Bulk delete users
 * 
 * @param {Array<string>} userIds - Array of user UUIDs to delete
 * @returns {Promise<{success: boolean, results: Array, error?: string}>}
 */
export const bulkDeleteUsers = async (userIds) => {
  if (isDemoMode()) {
    return {
      success: true,
      results: userIds.map(id => ({ userId: id, success: true })),
      summary: {
        total: userIds.length,
        successful: userIds.length,
        failed: 0
      }
    };
  }

  try {
    const results = [];
    
    for (const userId of userIds) {
      const result = await deleteUser(userId);
      results.push({ userId, ...result });
    }

    const successCount = results.filter(r => r.success).length;
    const failCount = results.length - successCount;

    return {
      success: failCount === 0,
      results,
      summary: {
        total: results.length,
        successful: successCount,
        failed: failCount
      }
    };
  } catch (error) {
    console.error('Error in bulk delete:', error);
    return {
      success: false,
      error: error.message || 'Bulk delete failed'
    };
  }
};

export default {
  deleteUser,
  deactivateUser,
  reactivateUser,
  getAllUsers,
  updateUser,
  bulkDeleteUsers
};
