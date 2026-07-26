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
    const { data, error } = await supabase.functions.invoke('admin-delete-user', {
      body: { userId }
    });

    if (error) throw error;
    if (!data?.success) throw new Error(data?.error || 'Failed to delete user');
    return { success: true, data };
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
