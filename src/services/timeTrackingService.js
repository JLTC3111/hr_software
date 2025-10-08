import { supabase } from '../config/supabaseClient';

/**
 * Time Tracking Service
 * Handles all Supabase operations for time tracking, leave requests, and overtime
 */

/**
 * Helper: Ensure employee ID is a string (supports both integers and UUIDs)
 */
const toEmployeeId = (id) => {
  return id ? String(id) : null;
};

// ============================================
// TIME ENTRIES
// ============================================

/**
 * Create a new time entry
 */
export const createTimeEntry = async (timeEntryData) => {
  try {
    const { data, error } = await supabase
      .from('time_entries')
      .insert([{
        employee_id: toEmployeeId(timeEntryData.employeeId),
        date: timeEntryData.date,
        clock_in: timeEntryData.clockIn,
        clock_out: timeEntryData.clockOut,
        hours: timeEntryData.hours,
        hour_type: timeEntryData.hourType,
        notes: timeEntryData.notes || null,
        proof_file_url: timeEntryData.proofFileUrl || null,
        proof_file_name: timeEntryData.proofFileName || null,
        proof_file_type: timeEntryData.proofFileType || null,
        status: 'pending'
      }])
      .select()
      .single();

    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    console.error('Error creating time entry:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Get time entries for an employee
 */
export const getTimeEntries = async (employeeId, filters = {}) => {
  try {
    let query = supabase
      .from('time_entries')
      .select('*')
      .eq('employee_id', toEmployeeId(employeeId))
      .order('date', { ascending: false });

    // Apply filters
    if (filters.startDate) {
      query = query.gte('date', filters.startDate);
    }
    if (filters.endDate) {
      query = query.lte('date', filters.endDate);
    }
    if (filters.status) {
      query = query.eq('status', filters.status);
    }
    if (filters.hourType) {
      query = query.eq('hour_type', filters.hourType);
    }

    const { data, error } = await query;

    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    console.error('Error fetching time entries:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Get all time entries with employee details (for HR/managers)
 */
export const getAllTimeEntriesDetailed = async (filters = {}) => {
  try {
    let query = supabase
      .from('time_entries_detailed')
      .select('*')
      .order('date', { ascending: false });

    if (filters.status) {
      query = query.eq('status', filters.status);
    }
    if (filters.startDate) {
      query = query.gte('date', filters.startDate);
    }
    if (filters.endDate) {
      query = query.lte('date', filters.endDate);
    }

    const { data, error } = await query;

    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    console.error('Error fetching detailed time entries:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Update time entry status (approve/reject)
 */
export const updateTimeEntryStatus = async (entryId, status, approverId) => {
  try {
    const { data, error } = await supabase
      .from('time_entries')
      .update({
        status,
        approved_by: toEmployeeId(approverId),
        approved_at: new Date().toISOString()
      })
      .eq('id', entryId)
      .select()
      .single();

    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    console.error('Error updating time entry status:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Delete a time entry
 */
export const deleteTimeEntry = async (entryId) => {
  try {
    const { error } = await supabase
      .from('time_entries')
      .delete()
      .eq('id', entryId);

    if (error) throw error;
    return { success: true };
  } catch (error) {
    console.error('Error deleting time entry:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Upload proof file to Supabase Storage
 */
export const uploadProofFile = async (file, employeeId) => {
  try {
    const fileExt = file.name.split('.').pop();
    const fileName = `${toEmployeeId(employeeId)}_${Date.now()}.${fileExt}`;
    const filePath = `time-proofs/${fileName}`;

    const { data, error } = await supabase.storage
      .from('hr-documents')
      .upload(filePath, file);

    if (error) throw error;

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('hr-documents')
      .getPublicUrl(filePath);

    return {
      success: true,
      url: publicUrl,
      fileName: file.name,
      fileType: file.type
    };
  } catch (error) {
    console.error('Error uploading proof file:', error);
    return { success: false, error: error.message };
  }
};

// ============================================
// LEAVE REQUESTS
// ============================================

/**
 * Create a leave request
 */
export const createLeaveRequest = async (leaveData) => {
  try {
    const { data, error } = await supabase
      .from('leave_requests')
      .insert([{
        employee_id: toEmployeeId(leaveData.employeeId),
        leave_type: leaveData.type,
        start_date: leaveData.startDate,
        end_date: leaveData.endDate,
        reason: leaveData.reason || null,
        status: 'pending'
      }])
      .select()
      .single();

    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    console.error('Error creating leave request:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Get leave requests for an employee
 */
export const getLeaveRequests = async (employeeId, filters = {}) => {
  try {
    let query = supabase
      .from('leave_requests')
      .select('*')
      .eq('employee_id', toEmployeeId(employeeId))
      .order('start_date', { ascending: false });

    if (filters.status) {
      query = query.eq('status', filters.status);
    }
    if (filters.year) {
      query = query.gte('start_date', `${filters.year}-01-01`)
                   .lte('start_date', `${filters.year}-12-31`);
    }

    const { data, error } = await query;

    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    console.error('Error fetching leave requests:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Get all leave requests (for HR/managers)
 */
export const getAllLeaveRequests = async (filters = {}) => {
  try {
    let query = supabase
      .from('leave_requests')
      .select(`
        *,
        employee:employees(id, name, department, position)
      `)
      .order('submitted_at', { ascending: false });

    if (filters.status) {
      query = query.eq('status', filters.status);
    }

    const { data, error } = await query;

    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    console.error('Error fetching all leave requests:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Update leave request status
 */
export const updateLeaveRequestStatus = async (requestId, status, approverId, rejectionReason = null) => {
  try {
    const { data, error } = await supabase
      .from('leave_requests')
      .update({
        status,
        approved_by: toEmployeeId(approverId),
        approved_at: new Date().toISOString(),
        rejection_reason: rejectionReason
      })
      .eq('id', requestId)
      .select()
      .single();

    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    console.error('Error updating leave request status:', error);
    return { success: false, error: error.message };
  }
};

// ============================================
// OVERTIME LOGS
// ============================================

/**
 * Create an overtime log
 */
export const createOvertimeLog = async (overtimeData) => {
  try {
    const { data, error } = await supabase
      .from('overtime_logs')
      .insert([{
        employee_id: toEmployeeId(overtimeData.employeeId),
        date: overtimeData.date,
        hours: overtimeData.hours,
        reason: overtimeData.reason,
        overtime_type: overtimeData.overtimeType || 'regular',
        status: 'pending'
      }])
      .select()
      .single();

    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    console.error('Error creating overtime log:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Get overtime logs for an employee
 */
export const getOvertimeLogs = async (employeeId, filters = {}) => {
  try {
    let query = supabase
      .from('overtime_logs')
      .select('*')
      .eq('employee_id', toEmployeeId(employeeId))
      .order('date', { ascending: false });

    if (filters.status) {
      query = query.eq('status', filters.status);
    }
    if (filters.month && filters.year) {
      const startDate = `${filters.year}-${String(filters.month).padStart(2, '0')}-01`;
      const endDate = new Date(filters.year, filters.month, 0).toISOString().split('T')[0];
      query = query.gte('date', startDate).lte('date', endDate);
    }

    const { data, error } = await query;

    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    console.error('Error fetching overtime logs:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Update overtime log status
 */
export const updateOvertimeStatus = async (logId, status, approverId) => {
  try {
    const { data, error } = await supabase
      .from('overtime_logs')
      .update({
        status,
        approved_by: toEmployeeId(approverId),
        approved_at: new Date().toISOString()
      })
      .eq('id', logId)
      .select()
      .single();

    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    console.error('Error updating overtime status:', error);
    return { success: false, error: error.message };
  }
};

// ============================================
// TIME TRACKING SUMMARY
// ============================================

/**
 * Get time tracking summary for an employee
 */
export const getTimeTrackingSummary = async (employeeId, month, year) => {
  try {
    const { data, error } = await supabase
      .from('time_tracking_summary')
      .select('*')
      .eq('employee_id', toEmployeeId(employeeId))
      .eq('month', month)
      .eq('year', year)
      .single();

    if (error) {
      // If no data exists, return default structure
      if (error.code === 'PGRST116') {
        return {
          success: true,
          data: {
            employee_id: employeeId,
            month,
            year,
            days_worked: 0,
            leave_days: 0,
            regular_hours: 0,
            overtime_hours: 0,
            holiday_overtime_hours: 0,
            total_hours: 0,
            attendance_rate: 0
          }
        };
      }
      throw error;
    }

    return { success: true, data };
  } catch (error) {
    console.error('Error fetching time tracking summary:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Manually trigger summary update
 */
export const updateSummary = async (employeeId, month, year) => {
  try {
    const { data, error } = await supabase
      .rpc('update_time_tracking_summary', {
        p_employee_id: toEmployeeId(employeeId),
        p_month: month,
        p_year: year
      });

    if (error) throw error;
    return { success: true };
  } catch (error) {
    console.error('Error updating summary:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Get summaries for all employees in a period
 */
export const getAllEmployeesSummary = async (month, year) => {
  try {
    const { data, error } = await supabase
      .from('time_tracking_summary')
      .select(`
        *,
        employee:employees(id, name, department, position)
      `)
      .eq('month', month)
      .eq('year', year)
      .order('employee_id');

    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    console.error('Error fetching all employees summary:', error);
    return { success: false, error: error.message };
  }
};

// ============================================
// ANALYTICS & REPORTS
// ============================================

/**
 * Get monthly attendance summary view
 */
export const getMonthlyAttendanceSummary = async (filters = {}) => {
  try {
    let query = supabase
      .from('monthly_attendance_summary')
      .select('*')
      .order('year', { ascending: false })
      .order('month', { ascending: false });

    if (filters.year) {
      query = query.eq('year', filters.year);
    }
    if (filters.month) {
      query = query.eq('month', filters.month);
    }

    const { data, error } = await query;

    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    console.error('Error fetching monthly attendance summary:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Calculate totals for different hour types
 */
export const calculateHourTotals = async (employeeId, period = 'week') => {
  try {
    const now = new Date();
    let startDate;

    if (period === 'week') {
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - now.getDay());
      startDate = startOfWeek.toISOString().split('T')[0];
    } else if (period === 'month') {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    }

    const { data, error } = await supabase
      .from('time_entries')
      .select('hours, hour_type')
      .eq('employee_id', toEmployeeId(employeeId))
      .eq('status', 'approved')
      .gte('date', startDate);

    if (error) throw error;

    // Calculate totals by hour type
    const totals = {
      regular: 0,
      holiday: 0,
      weekend: 0,
      bonus: 0,
      total: 0
    };

    data.forEach(entry => {
      totals[entry.hour_type] = (totals[entry.hour_type] || 0) + parseFloat(entry.hours);
      totals.total += parseFloat(entry.hours);
    });

    return { success: true, data: totals };
  } catch (error) {
    console.error('Error calculating hour totals:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Get pending approvals count (for managers/HR)
 */
export const getPendingApprovalsCount = async () => {
  try {
    const [timeEntries, leaveRequests, overtimeLogs] = await Promise.all([
      supabase.from('time_entries').select('id', { count: 'exact' }).eq('status', 'pending'),
      supabase.from('leave_requests').select('id', { count: 'exact' }).eq('status', 'pending'),
      supabase.from('overtime_logs').select('id', { count: 'exact' }).eq('status', 'pending')
    ]);

    return {
      success: true,
      data: {
        timeEntries: timeEntries.count || 0,
        leaveRequests: leaveRequests.count || 0,
        overtimeLogs: overtimeLogs.count || 0,
        total: (timeEntries.count || 0) + (leaveRequests.count || 0) + (overtimeLogs.count || 0)
      }
    };
  } catch (error) {
    console.error('Error fetching pending approvals:', error);
    return { success: false, error: error.message };
  }
};

// ============================================
// EMPLOYEE MANAGEMENT
// ============================================

/**
 * Sync local employees to Supabase
 */
export const syncEmployeesToSupabase = async (employees) => {
  try {
    const employeesData = employees.map(emp => ({
      id: emp.id,
      name: emp.name,
      position: emp.position,
      department: emp.department,
      email: emp.email,
      dob: emp.dob,
      address: emp.address,
      phone: emp.phone,
      start_date: emp.startDate,
      status: emp.status,
      performance: emp.performance,
      photo: emp.photo
    }));

    const { data, error } = await supabase
      .from('employees')
      .upsert(employeesData, { onConflict: 'email' })
      .select();

    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    console.error('Error syncing employees:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Get all employees from Supabase
 */
export const getAllEmployees = async () => {
  try {
    const { data, error } = await supabase
      .from('employees')
      .select('*')
      .order('name');

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

export default {
  // Time Entries
  createTimeEntry,
  getTimeEntries,
  getAllTimeEntriesDetailed,
  updateTimeEntryStatus,
  deleteTimeEntry,
  uploadProofFile,
  
  // Leave Requests
  createLeaveRequest,
  getLeaveRequests,
  getAllLeaveRequests,
  updateLeaveRequestStatus,
  
  // Overtime Logs
  createOvertimeLog,
  getOvertimeLogs,
  updateOvertimeStatus,
  
  // Summary & Analytics
  getTimeTrackingSummary,
  updateSummary,
  getAllEmployeesSummary,
  getMonthlyAttendanceSummary,
  calculateHourTotals,
  getPendingApprovalsCount,
  
  // Employee Management
  syncEmployeesToSupabase,
  getAllEmployees,
  getEmployeeById
};
