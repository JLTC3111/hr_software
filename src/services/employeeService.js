import { supabase } from '../config/supabaseClient';

/**
 * Employee Service
 * Handles all Supabase operations for employee management
 */

/**
 * Helper: Ensure employee ID is a string (supports both integers and UUIDs)
 */
const toEmployeeId = (id) => {
  return id ? String(id) : null;
};

// ============================================
// EMPLOYEE CRUD OPERATIONS
// ============================================

/**
 * Get all employees
 */
export const getAllEmployees = async (filters = {}) => {
  try {
    let query = supabase
      .from('employees')
      .select('*')
      .order('name');

    // Apply filters
    if (filters.status) {
      query = query.eq('status', filters.status);
    }
    if (filters.department) {
      query = query.eq('department', filters.department);
    }
    if (filters.position) {
      query = query.eq('position', filters.position);
    }

    const { data, error } = await query;

    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    console.error('Error fetching employees:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Get employee by ID
 */
export const getEmployeeById = async (employeeId) => {
  try {
    const { data, error } = await supabase
      .from('employees')
      .select('*')
      .eq('id', toEmployeeId(employeeId))
      .single();

    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    console.error('Error fetching employee:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Create a new employee
 */
export const createEmployee = async (employeeData) => {
  try {
    const { data, error } = await supabase
      .from('employees')
      .insert([{
        name: employeeData.name,
        position: employeeData.position,
        department: employeeData.department,
        email: employeeData.email,
        dob: employeeData.dob || null,
        address: employeeData.address || null,
        phone: employeeData.phone || null,
        start_date: employeeData.startDate || new Date().toISOString().split('T')[0],
        status: employeeData.status || 'Active',
        performance: employeeData.performance || 4.0,
        photo: employeeData.photo || null
      }])
      .select()
      .single();

    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    console.error('Error creating employee:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Update an existing employee
 */
export const updateEmployee = async (employeeId, updates) => {
  try {
    const updateData = {};
    
    if (updates.name !== undefined) updateData.name = updates.name;
    if (updates.position !== undefined) updateData.position = updates.position;
    if (updates.department !== undefined) updateData.department = updates.department;
    if (updates.email !== undefined) updateData.email = updates.email;
    if (updates.dob !== undefined) updateData.dob = updates.dob;
    if (updates.address !== undefined) updateData.address = updates.address;
    if (updates.phone !== undefined) updateData.phone = updates.phone;
    if (updates.startDate !== undefined) updateData.start_date = updates.startDate;
    if (updates.status !== undefined) updateData.status = updates.status;
    if (updates.performance !== undefined) updateData.performance = updates.performance;
    if (updates.photo !== undefined) updateData.photo = updates.photo;

    const { data, error } = await supabase
      .from('employees')
      .update(updateData)
      .eq('id', toEmployeeId(employeeId))
      .select()
      .single();

    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    console.error('Error updating employee:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Delete an employee
 */
export const deleteEmployee = async (employeeId) => {
  try {
    const { error } = await supabase
      .from('employees')
      .delete()
      .eq('id', toEmployeeId(employeeId));

    if (error) throw error;
    return { success: true };
  } catch (error) {
    console.error('Error deleting employee:', error);
    return { success: false, error: error.message };
  }
};

// ============================================
// SEARCH AND FILTER
// ============================================

/**
 * Search employees by name or email
 */
export const searchEmployees = async (searchTerm) => {
  try {
    const { data, error } = await supabase
      .from('employees')
      .select('*')
      .or(`name.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%`)
      .order('name');

    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    console.error('Error searching employees:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Get employees by department
 */
export const getEmployeesByDepartment = async (department) => {
  try {
    const { data, error } = await supabase
      .from('employees')
      .select('*')
      .eq('department', department)
      .order('name');

    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    console.error('Error fetching employees by department:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Get employees by status
 */
export const getEmployeesByStatus = async (status) => {
  try {
    const { data, error } = await supabase
      .from('employees')
      .select('*')
      .eq('status', status)
      .order('name');

    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    console.error('Error fetching employees by status:', error);
    return { success: false, error: error.message };
  }
};

// ============================================
// PHOTO/FILE MANAGEMENT
// ============================================

/**
 * Upload employee photo to Supabase Storage
 * Supports both File objects and base64 strings
 */
export const uploadEmployeePhoto = async (fileData, employeeId) => {
  try {
    let file = fileData;
    let fileName;
    let fileExt;
    
    // Handle base64 strings
    if (typeof fileData === 'string' && fileData.startsWith('data:')) {
      // Convert base64 to Blob
      const base64Data = fileData.split(',')[1];
      const mimeType = fileData.match(/data:(.*?);/)[1];
      fileExt = mimeType.split('/')[1];
      
      const byteCharacters = atob(base64Data);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      file = new Blob([byteArray], { type: mimeType });
      fileName = `${toEmployeeId(employeeId)}_${Date.now()}.${fileExt}`;
    } else {
      // Handle File objects
      fileExt = file.name.split('.').pop();
      fileName = `${toEmployeeId(employeeId)}_${Date.now()}.${fileExt}`;
    }

    const filePath = `employee-photos/${fileName}`;

    // Try to upload to storage (will fail gracefully if bucket doesn't exist)
    const { data, error } = await supabase.storage
      .from('employee-photos')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: true
      });

    if (error) {
      console.warn('Storage upload failed, using base64 fallback:', error.message);
      // Fallback to base64 if storage is not configured
      if (typeof fileData === 'string' && fileData.startsWith('data:')) {
        return {
          success: true,
          url: fileData,
          fileName: fileName,
          fileType: file.type || 'image/jpeg',
          storage: 'base64'
        };
      }
      throw error;
    }

    // Get public URL
    const { data: publicUrlData } = supabase.storage
      .from('employee-photos')
      .getPublicUrl(filePath);

    return {
      success: true,
      url: publicUrlData.publicUrl,
      fileName: fileName,
      fileType: file.type || 'image/jpeg',
      storage: 'supabase'
    };
  } catch (error) {
    console.error('Error uploading employee photo:', error);
    
    // Ultimate fallback - return base64 if it's a data URL
    if (typeof fileData === 'string' && fileData.startsWith('data:')) {
      return {
        success: true,
        url: fileData,
        fileName: 'photo.jpg',
        fileType: 'image/jpeg',
        storage: 'base64'
      };
    }
    
    return { success: false, error: error.message };
  }
};

/**
 * Delete employee photo from Supabase Storage
 */
export const deleteEmployeePhoto = async (photoUrl) => {
  try {
    // Extract file path from URL
    const urlParts = photoUrl.split('/');
    const filePath = `employee-photos/${urlParts[urlParts.length - 1]}`;

    const { error } = await supabase.storage
      .from('hr-documents')
      .remove([filePath]);

    if (error) throw error;
    return { success: true };
  } catch (error) {
    console.error('Error deleting employee photo:', error);
    return { success: false, error: error.message };
  }
};

// ============================================
// STATISTICS AND ANALYTICS
// ============================================

/**
 * Get employee statistics
 */
export const getEmployeeStats = async () => {
  try {
    const [totalResult, activeResult, onLeaveResult, inactiveResult] = await Promise.all([
      supabase.from('employees').select('id', { count: 'exact', head: true }),
      supabase.from('employees').select('id', { count: 'exact', head: true }).eq('status', 'Active'),
      supabase.from('employees').select('id', { count: 'exact', head: true }).eq('status', 'onLeave'),
      supabase.from('employees').select('id', { count: 'exact', head: true }).eq('status', 'Inactive')
    ]);

    return {
      success: true,
      data: {
        total: totalResult.count || 0,
        active: activeResult.count || 0,
        onLeave: onLeaveResult.count || 0,
        inactive: inactiveResult.count || 0
      }
    };
  } catch (error) {
    console.error('Error fetching employee stats:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Get department distribution
 */
export const getDepartmentDistribution = async () => {
  try {
    const { data, error } = await supabase
      .from('employees')
      .select('department')
      .eq('status', 'Active');

    if (error) throw error;

    // Count employees per department
    const distribution = data.reduce((acc, emp) => {
      acc[emp.department] = (acc[emp.department] || 0) + 1;
      return acc;
    }, {});

    return { success: true, data: distribution };
  } catch (error) {
    console.error('Error fetching department distribution:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Get top performers
 */
export const getTopPerformers = async (limit = 5) => {
  try {
    const { data, error } = await supabase
      .from('employees')
      .select('*')
      .eq('status', 'Active')
      .order('performance', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    console.error('Error fetching top performers:', error);
    return { success: false, error: error.message };
  }
};

// ============================================
// BULK OPERATIONS
// ============================================

/**
 * Bulk import employees
 */
export const bulkImportEmployees = async (employeesArray) => {
  try {
    const formattedData = employeesArray.map(emp => ({
      name: emp.name,
      position: emp.position,
      department: emp.department,
      email: emp.email,
      dob: emp.dob || null,
      address: emp.address || null,
      phone: emp.phone || null,
      start_date: emp.startDate || new Date().toISOString().split('T')[0],
      status: emp.status || 'Active',
      performance: emp.performance || 4.0,
      photo: emp.photo || null
    }));

    const { data, error } = await supabase
      .from('employees')
      .upsert(formattedData, { onConflict: 'email' })
      .select();

    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    console.error('Error bulk importing employees:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Bulk update employee status
 */
export const bulkUpdateStatus = async (employeeIds, newStatus) => {
  try {
    const { data, error } = await supabase
      .from('employees')
      .update({ status: newStatus })
      .in('id', employeeIds.map(id => toEmployeeId(id)))
      .select();

    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    console.error('Error bulk updating status:', error);
    return { success: false, error: error.message };
  }
};

// ============================================
// REAL-TIME SUBSCRIPTIONS
// ============================================

/**
 * Subscribe to employee changes
 */
export const subscribeToEmployees = (callback) => {
  const subscription = supabase
    .channel('employees-changes')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'employees'
      },
      (payload) => {
        callback(payload);
      }
    )
    .subscribe();

  return subscription;
};

/**
 * Unsubscribe from employee changes
 */
export const unsubscribeFromEmployees = (subscription) => {
  if (subscription) {
    supabase.removeChannel(subscription);
  }
};

// ============================================
// EXPORTS
// ============================================

export default {
  // CRUD
  getAllEmployees,
  getEmployeeById,
  createEmployee,
  updateEmployee,
  deleteEmployee,
  
  // Search & Filter
  searchEmployees,
  getEmployeesByDepartment,
  getEmployeesByStatus,
  
  // Photo Management
  uploadEmployeePhoto,
  deleteEmployeePhoto,
  
  // Statistics
  getEmployeeStats,
  getDepartmentDistribution,
  getTopPerformers,
  
  // Bulk Operations
  bulkImportEmployees,
  bulkUpdateStatus,
  
  // Real-time
  subscribeToEmployees,
  unsubscribeFromEmployees
};
