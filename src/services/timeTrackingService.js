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

export const createTimeEntry = async (timeEntryData) => {
  try {
    const employeeId = toEmployeeId(timeEntryData.employeeId);
    
    // Validate employee exists first
    const { data: employee, error: employeeError } = await supabase
      .from('employees')
      .select('id')
      .eq('id', employeeId)
      .maybeSingle();

    if (employeeError) {
      console.error('Error checking employee:', employeeError);
      throw new Error('Failed to validate employee');
    }

    if (!employee) {
      throw new Error(`Employee with ID ${employeeId} does not exist. Please make sure the employee is registered in the system before creating time entries.`);
    }

    // Create time entry
    const { data, error } = await supabase
      .from('time_entries')
      .insert([{
        employee_id: employeeId,
        date: timeEntryData.date,
        clock_in: timeEntryData.clockIn,
        clock_out: timeEntryData.clockOut,
        hours: timeEntryData.hours,
        hour_type: timeEntryData.hourType,
        notes: timeEntryData.notes || null,
        proof_file_url: timeEntryData.proofFileUrl || null,
        proof_file_name: timeEntryData.proofFileName || null,
        proof_file_type: timeEntryData.proofFileType || null,
        proof_file_path: timeEntryData.proofFilePath || null,
        status: 'pending'
      }])
      .select()
      .single();

    if (error) {
      // Provide user-friendly error messages
      if (error.code === '23503') {
        throw new Error('Employee not found. Please ensure the employee exists before creating time entries.');
      }
      throw error;
    }
    
    return { success: true, data };
  } catch (error) {
    console.error('Error creating time entry:', error);
    return { 
      success: false, 
      error: error.message || 'Failed to create time entry'
    };
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
 * Update proof file for an existing time entry
 * @param {number} entryId - Time entry ID
 * @param {File} file - Proof file to upload
 * @param {string|number} employeeId - Employee ID
 * @param {Function} onProgress - Progress callback function
 * @returns {Promise<{success: boolean, data?: object, error?: string}>}
 */
export const updateTimeEntryProof = async (entryId, file, employeeId, onProgress = null) => {
  try {
    // Upload the proof file with progress tracking
    const uploadResult = await uploadProofFile(file, employeeId, onProgress);
    
    if (!uploadResult.success) {
      throw new Error(uploadResult.error || 'Failed to upload proof file');
    }

    // Update the time entry with proof file information
    const { data, error } = await supabase
      .from('time_entries')
      .update({
        proof_file_url: uploadResult.url,
        proof_file_name: uploadResult.fileName,
        proof_file_type: uploadResult.fileType,
        proof_file_path: uploadResult.storagePath
      })
      .eq('id', entryId)
      .select()
      .single();

    if (error) throw error;

    return { success: true, data };
  } catch (error) {
    console.error('Error updating time entry proof:', error);
    return { 
      success: false, 
      error: error.message || 'Failed to update proof file'
    };
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
/**
 * Upload proof file to Supabase Storage
 * @param {File} file - File to upload
 * @param {string|number} employeeId - Employee ID
 * @returns {Promise<{success: boolean, url?: string, fileName?: string, fileType?: string, storagePath?: string, error?: string}>}
 */
// Sanitize filename to remove special characters
const sanitizeFileName = (name) =>
  name.normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, '-')
    .replace(/[^a-zA-Z0-9.\-_]/g, '');

// Enhanced file validation
const validateProofFile = (file) => {
  const maxSize = 50 * 1024 * 1024; // 50MB limit
  const allowedTypes = [
    // Images
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'image/bmp',
    'image/webp',
    'image/svg+xml',
    // PDF
    'application/pdf',
    // Documents (optional - for proof of work documents)
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/msword',
    'text/plain'
  ];

  if (file.size > maxSize) {
    return { valid: false, error: `File size (${(file.size / 1024 / 1024).toFixed(2)}MB) exceeds maximum allowed size (50MB)` };
  }

  if (!allowedTypes.includes(file.type) && !file.name.match(/\.(jpg|jpeg|png|gif|bmp|webp|svg|pdf|docx?|txt)$/i)) {
    return { valid: false, error: 'File type not supported. Please upload an image, PDF, or document file.' };
  }

  return { valid: true };
};

export const uploadProofFile = async (file, employeeId, onProgress = null) => {
  try {
    if (!file) {
      throw new Error('No file provided');
    }

    // Validate file
    const validation = validateProofFile(file);
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    // Sanitize and generate unique filename
    const sanitizedFileName = sanitizeFileName(file.name);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `${employeeId}_${timestamp}_${sanitizedFileName}`;
    const filePath = `time-proofs/${fileName}`;

    // Get signed upload URL from Supabase
    const { data: signedUrlData, error: signedUrlError } = await supabase
      .storage
      .from('employee-documents')
      .createSignedUploadUrl(filePath);

    if (signedUrlError) {
      console.error('Error getting signed URL:', signedUrlError);
      throw new Error('Failed to get upload URL');
    }

    // Upload using XMLHttpRequest with progress tracking
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('PUT', signedUrlData.signedUrl, true);
      xhr.setRequestHeader('Content-Type', file.type);

      // Track upload progress
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable && onProgress) {
          const percent = Math.round((e.loaded / e.total) * 100);
          onProgress(percent);
        }
      };

      xhr.onload = async () => {
        if (xhr.status === 200) {
          // Get public URL
          const { data: publicUrlData } = supabase.storage
            .from('employee-documents')
            .getPublicUrl(filePath);

          resolve({
            success: true,
            url: publicUrlData.publicUrl,
            fileName: file.name,
            fileType: file.type,
            storagePath: filePath
          });
        } else {
          console.error(`Failed to upload file:`, xhr.responseText);
          reject(new Error('Failed to upload file to storage'));
        }
      };

      xhr.onerror = () => {
        reject(new Error('Network error during upload'));
      };

      // Send the file
      xhr.send(file);
    });
  } catch (error) {
    console.error('Error uploading proof file:', error);
    return { 
      success: false, 
      error: error.message || 'Failed to upload proof file'
    };
  }
};

/**
 * Get public URL for an existing proof file
 * @param {string} filePath - Path to file in storage (e.g., 'time-proofs/123_1234567890.jpg')
 * @returns {Promise<{success: boolean, url?: string, error?: string}>}
 * @note Bucket is public, so this returns a permanent public URL
 */
export const getProofFileSignedUrl = async (filePath) => {
  try {
    if (!filePath) {
      throw new Error('File path is required');
    }

    const { data } = supabase.storage
      .from('employee-documents')
      .getPublicUrl(filePath);

    return {
      success: true,
      url: data.publicUrl
    };
  } catch (error) {
    console.error('Error getting public URL:', error);
    return {
      success: false,
      error: error.message || 'Failed to generate public URL'
    };
  }
};

/**
 * Delete proof file from storage
 * @param {string} filePath - Path to file in storage
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export const deleteProofFile = async (filePath) => {
  try {
    if (!filePath) {
      throw new Error('File path is required');
    }

    const { error } = await supabase.storage
      .from('employee-documents')
      .remove([filePath]);

    if (error) throw error;

    return { success: true };
  } catch (error) {
    console.error('Error deleting proof file:', error);
    return {
      success: false,
      error: error.message || 'Failed to delete proof file'
    };
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
    const employeeId = toEmployeeId(leaveData.employeeId);
    
    // Validate employee exists first
    const { data: employee, error: employeeError } = await supabase
      .from('employees')
      .select('id')
      .eq('id', employeeId)
      .maybeSingle();

    if (employeeError) {
      console.error('Error checking employee:', employeeError);
      throw new Error('Failed to validate employee');
    }

    if (!employee) {
      throw new Error(`Employee with ID ${employeeId} does not exist. Please make sure the employee is registered in the system.`);
    }

    const { data, error } = await supabase
      .from('leave_requests')
      .insert([{
        employee_id: employeeId,
        leave_type: leaveData.type,
        start_date: leaveData.startDate,
        end_date: leaveData.endDate,
        reason: leaveData.reason || null,
        status: 'pending'
      }])
      .select()
      .single();

    if (error) {
      if (error.code === '23503') {
        throw new Error('Employee not found. Please ensure the employee exists.');
      }
      throw error;
    }
    
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
    const employeeId = toEmployeeId(overtimeData.employeeId);
    
    // Validate employee exists first
    const { data: employee, error: employeeError } = await supabase
      .from('employees')
      .select('id')
      .eq('id', employeeId)
      .maybeSingle();

    if (employeeError) {
      console.error('Error checking employee:', employeeError);
      throw new Error('Failed to validate employee');
    }

    if (!employee) {
      throw new Error(`Employee with ID ${employeeId} does not exist. Please make sure the employee is registered in the system.`);
    }

    const { data, error } = await supabase
      .from('overtime_logs')
      .insert([{
        employee_id: employeeId,
        date: overtimeData.date,
        hours: overtimeData.hours,
        reason: overtimeData.reason,
        overtime_type: overtimeData.overtimeType || 'regular',
        status: 'pending'
      }])
      .select()
      .single();

    if (error) {
      if (error.code === '23503') {
        throw new Error('Employee not found. Please ensure the employee exists.');
      }
      throw error;
    }
    
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
 * Calculate summary directly from time_entries, leave_requests, and overtime_logs
 * Matches database function logic exactly
 */
const calculateSummaryFromRawData = async (employeeId, month, year) => {
  try {
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDate = new Date(year, month, 0).toISOString().split('T')[0];
    
    // Get time entries (INCLUDE PENDING AND APPROVED)
    const { data: timeEntries, error: timeError } = await supabase
      .from('time_entries')
      .select('*')
      .eq('employee_id', toEmployeeId(employeeId))
      .gte('date', startDate)
      .lte('date', endDate)
      .in('status', ['pending', 'approved']);  // CHANGED: include pending
    
    if (timeError) throw timeError;
    
    // Get leave requests (only approved)
    const { data: leaveRequests, error: leaveError } = await supabase
      .from('leave_requests')
      .select('*')
      .eq('employee_id', toEmployeeId(employeeId))
      .gte('start_date', startDate)
      .lte('end_date', endDate)
      .eq('status', 'approved');
    
    if (leaveError) throw leaveError;
    
    // Get overtime logs (INCLUDE PENDING AND APPROVED)
    const { data: overtimeLogs, error: overtimeError } = await supabase
      .from('overtime_logs')
      .select('*')
      .eq('employee_id', toEmployeeId(employeeId))
      .gte('date', startDate)
      .lte('date', endDate)
      .in('status', ['pending', 'approved']);  // CHANGED: include pending
    
    if (overtimeError) throw overtimeError;
    
    // Calculate metrics by hour type
    const uniqueDays = new Set();
    let regularHours = 0;
    let holidayHours = 0;
    let weekendHours = 0;
    let bonusHours = 0;
    
    (timeEntries || []).forEach(entry => {
      // Only count pending or approved
      if (entry.status === 'pending' || entry.status === 'approved') {
        uniqueDays.add(entry.date);
        const hours = parseFloat(entry.hours || 0);
        
        switch (entry.hour_type) {
          case 'regular':
            regularHours += hours;
            break;
          case 'holiday':
            holidayHours += hours;
            break;
          case 'weekend':
            weekendHours += hours;
            break;
          case 'bonus':
            bonusHours += hours;
            break;
          default:
            regularHours += hours;
        }
      }
    });
    
    const daysWorked = uniqueDays.size;
    
    // Calculate leave days (only approved)
    let leaveDays = 0;
    (leaveRequests || []).forEach(req => {
      const start = new Date(req.start_date);
      const end = new Date(req.end_date);
      const diffTime = Math.abs(end - start);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
      leaveDays += diffDays;
    });
    
    // Calculate overtime from overtime_logs
    let overtimeRegular = 0;
    let overtimeHoliday = 0;
    (overtimeLogs || []).forEach(log => {
      const hours = parseFloat(log.hours || 0);
      if (log.overtime_type === 'holiday') {
        overtimeHoliday += hours;
      } else {
        overtimeRegular += hours;
      }
    });
    
    // AGGREGATE INTO SUMMARY COLUMNS (matching database logic)
    // overtime_hours = weekend + bonus + overtime_logs.regular
    const overtimeHours = weekendHours + bonusHours + overtimeRegular;
    
    // holiday_overtime_hours = holiday + overtime_logs.holiday
    const holidayOvertimeHours = holidayHours + overtimeHoliday;
    
    // total_hours = ALL hours from all sources
    const totalHours = regularHours + weekendHours + holidayHours + 
                       bonusHours + overtimeRegular + overtimeHoliday;
    
    const totalDays = daysWorked + leaveDays;
    const workingDaysInMonth = 22;
    const attendanceRate = totalDays > 0 ? (totalDays / workingDaysInMonth) * 100 : 0;
    
    return {
      employee_id: toEmployeeId(employeeId),
      month,
      year,
      days_worked: daysWorked,
      leave_days: leaveDays,
      regular_hours: regularHours,
      overtime_hours: overtimeHours,
      holiday_overtime_hours: holidayOvertimeHours,
      total_hours: totalHours,
      attendance_rate: Math.min(attendanceRate, 100)
    };
  } catch (error) {
    console.error('Error calculating summary from raw data:', error);
    throw error;
  }
};

/**
 * Get time tracking summary for an employee
 */
export const getTimeTrackingSummary = async (employeeId, month, year) => {
  try {
    // Try to get from summary table first
    const { data, error } = await supabase
      .from('time_tracking_summary')
      .select('*')
      .eq('employee_id', toEmployeeId(employeeId))
      .eq('month', month)
      .eq('year', year)
      .maybeSingle();

    // If summary table has data, return it
    if (!error && data && data.total_hours > 0) {
      return { success: true, data };
    }

    // Otherwise, calculate from raw data
    console.log('Summary table empty, calculating from time_entries...');
    const calculatedData = await calculateSummaryFromRawData(employeeId, month, year);
    return { success: true, data: calculatedData };
  } catch (error) {
    console.error('Error fetching time tracking summary:', error);
    // Return calculated data as fallback
    try {
      const calculatedData = await calculateSummaryFromRawData(employeeId, month, year);
      return { success: true, data: calculatedData };
    } catch (calcError) {
      // Ultimate fallback - return zeros
      return { 
        success: true,
        data: {
          employee_id: toEmployeeId(employeeId),
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

/**
 * Get detailed pending approvals (for managers/HR)
 */
export const getPendingApprovals = async () => {
  try {
    const { data, error } = await supabase
      .from('time_entries')
      .select(`
        *,
        employee:employees(id, name, department, position)
      `)
      .eq('status', 'pending')
      .order('date', { ascending: false });

    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    console.error('Error fetching pending approvals:', error);
    return { success: false, error: error.message };
  }
};

export const ensureEmployeeExists = async (employeeId, employeeData = {}) => {
  try {
    const id = toEmployeeId(employeeId);
    
    // Check if employee exists by ID first
    const { data: existingById, error: checkError } = await supabase
      .from('employees')
      .select('id, name, email')
      .eq('id', id)
      .maybeSingle();

    if (checkError) {
      console.error('Error checking employee by ID:', checkError);
      throw checkError;
    }

    // If employee exists by ID, return it
    if (existingById) {
      return { success: true, data: existingById, created: false };
    }

    // If employee doesn't exist and we have data, check email then create/upsert
    if (employeeData.email || employeeData.name) {
      let email = employeeData.email || `user${id}@company.com`;
      
      // Check if employee with this email already exists
      const { data: existingByEmail, error: emailCheckError } = await supabase
        .from('employees')
        .select('id, name, email')
        .eq('email', email)
        .maybeSingle();

      if (emailCheckError) {
        console.error('Error checking employee by email:', emailCheckError);
        throw emailCheckError;
      }

      // If email exists but different ID, generate a unique email instead of failing
      if (existingByEmail && existingByEmail.id !== id) {
        console.warn(`Email ${email} is already used by employee ${existingByEmail.id}. Generating unique email for employee ${id}.`);
        // Generate a unique email by appending the employee ID
        email = employeeData.email 
          ? `${employeeData.email.split('@')[0]}_${id}@${employeeData.email.split('@')[1]}`
          : `user${id}@company.com`;
      }

      // Use upsert to handle race conditions and duplicates
      const { data: newEmployee, error: createError } = await supabase
        .from('employees')
        .upsert([{
          id: id,
          name: employeeData.name || 'Unknown User',
          email: email,
          position: employeeData.position || 'Employee',
          department: employeeData.department || 'General',
          status: 'Active',
          start_date: new Date().toISOString().split('T')[0]
        }], {
          onConflict: 'id',
          ignoreDuplicates: false
        })
        .select()
        .single();

      if (createError) {
        // Handle specific error codes
        if (createError.code === '23505') {
          // Duplicate key error - fetch the existing employee
          const { data: existing } = await supabase
            .from('employees')
            .select('id, name, email')
            .eq('id', id)
            .maybeSingle();
          
          if (existing) {
            return { success: true, data: existing, created: false };
          }
        }
        console.error('Error creating employee:', createError);
        throw createError;
      }

      return { success: true, data: newEmployee, created: true };
    }

    // Employee doesn't exist and no data provided
    return { 
      success: false, 
      error: `Employee with ID ${id} not found. Please contact HR to register.` 
    };
  } catch (error) {
    console.error('Error in ensureEmployeeExists:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Get or create employee from auth user
 */
export const getOrCreateEmployeeFromAuth = async (authUser) => {
  try {
    if (!authUser || !authUser.id) {
      throw new Error('Invalid auth user');
    }

    const result = await ensureEmployeeExists(authUser.id, {
      name: authUser.user_metadata?.name || authUser.email?.split('@')[0] || 'User',
      email: authUser.email,
      position: authUser.user_metadata?.position || 'Employee',
      department: authUser.user_metadata?.department || 'General'
    });

    return result;
  } catch (error) {
    console.error('Error getting/creating employee from auth:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Sync local employees to Supabase
 */
export const syncEmployeesToSupabase = async (employees) => {
  try {
    const employeesData = employees.map(emp => ({
      id: toEmployeeId(emp.id),
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
  updateTimeEntryProof,
  deleteTimeEntry,
  uploadProofFile,
  getProofFileSignedUrl,
  deleteProofFile,
  
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
  getPendingApprovals,
  
  // Employee Management
  ensureEmployeeExists,
  getOrCreateEmployeeFromAuth,
  syncEmployeesToSupabase,
  getAllEmployees,
  getEmployeeById
};
