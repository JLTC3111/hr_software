import { supabase } from '../config/supabaseClient';
import { withTimeout } from '../utils/supabaseTimeout';
import { isDemoMode, MOCK_TIME_ENTRIES, getDemoLeaveRequests, addDemoLeaveRequest, calculateDaysBetween, getDemoTimeEntries, addDemoTimeEntry, getDemoEmployeeById } from '../utils/demoHelper';
import { saveDemoBlob } from '../utils/demoStorage';

const toEmployeeId = (id) => {
  return id ? String(id) : null;
};

export const createTimeEntry = async (timeEntryData) => {
  if (isDemoMode()) {
    return { 
      success: true, 
      data: { 
        id: `demo-entry-${Date.now()}`,
        ...timeEntryData,
        status: 'pending',
        created_at: new Date().toISOString()
      } 
    };
  }

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
 * Create multiple time entries at once (bulk insert)
 * @param {Array} timeEntriesData - Array of time entry objects
 * @returns {Promise<{success: boolean, data?: Array, error?: string}>}
 */
export const createBulkTimeEntries = async (timeEntriesData) => {
  if (isDemoMode()) {
    // Persist demo time entries so they show up across reloads
    const persisted = timeEntriesData.map((entry, i) => {
      // Look up employee info to attach to the entry for display
      const emp = getDemoEmployeeById(entry.employeeId);
      const demoEntry = {
        id: `demo-bulk-${Date.now()}-${i}`,
        ...entry,
        employee_id: entry.employeeId,
        employee_name: emp?.name || 'Unknown',
        employee_nameKey: emp?.nameKey || null,
        employee_department: emp?.department || null,
        employee_position: emp?.position || null,
        hour_type: entry.hourType,
        clock_in: entry.clockIn,
        clock_out: entry.clockOut,
        employee: emp ? {
          id: emp.id,
          name: emp.name,
          nameKey: emp.nameKey,
          department: emp.department,
          position: emp.position
        } : null,
        status: entry.status || 'pending',
        created_at: new Date().toISOString()
      };
      try { addDemoTimeEntry(demoEntry); } catch (e) { console.warn('Failed to persist demo time entry', e); }
      return demoEntry;
    });
    return { success: true, data: persisted };
  }

  try {
    if (!Array.isArray(timeEntriesData) || timeEntriesData.length === 0) {
      throw new Error('No time entries provided');
    }

    // Validate all employees exist first
    const employeeIds = timeEntriesData.map(entry => toEmployeeId(entry.employeeId));
    const { data: employees, error: employeeError } = await supabase
      .from('employees')
      .select('id')
      .in('id', employeeIds);

    if (employeeError) {
      console.error('Error checking employees:', employeeError);
      throw new Error('Failed to validate employees');
    }

    // Check if all employees exist
    const foundIds = new Set(employees.map(e => String(e.id)));
    const missingIds = employeeIds.filter(id => !foundIds.has(String(id)));
    
    if (missingIds.length > 0) {
      throw new Error(`Employees not found: ${missingIds.join(', ')}`);
    }

    // Format entries for bulk insert
    const formattedEntries = timeEntriesData.map(entry => ({
      employee_id: toEmployeeId(entry.employeeId),
      date: entry.date,
      clock_in: entry.clockIn,
      clock_out: entry.clockOut,
      hours: entry.hours,
      hour_type: entry.hourType,
      notes: entry.notes || null,
      proof_file_url: entry.proofFileUrl || null,
      proof_file_name: entry.proofFileName || null,
      proof_file_type: entry.proofFileType || null,
      proof_file_path: entry.proofFilePath || null,
      status: entry.status || 'pending'
    }));

    // Bulk insert all entries
    const { data, error } = await supabase
      .from('time_entries')
      .insert(formattedEntries)
      .select();

    if (error) {
      console.error('Error creating bulk time entries:', error);
      if (error.code === '23503') {
        throw new Error('One or more employees not found. Please ensure all employees exist.');
      }
      throw error;
    }
    
    return { 
      success: true, 
      data,
      count: data.length 
    };
  } catch (error) {
    console.error('Error creating bulk time entries:', error);
    return { 
      success: false, 
      error: error.message || 'Failed to create time entries'
    };
  }
};

/**
 * Get time entries for an employee
 */
export const getTimeEntries = async (employeeId, filters = {}) => {
  if (isDemoMode()) {
    let entries = getDemoTimeEntries().filter(e => String(e.employee_id) === String(employeeId));
    
    if (filters.startDate) {
      entries = entries.filter(e => e.date >= filters.startDate);
    }
    if (filters.endDate) {
      entries = entries.filter(e => e.date <= filters.endDate);
    }
    
    // Sort by date desc
    entries.sort((a, b) => new Date(b.date) - new Date(a.date));
    
    return { success: true, data: entries };
  }

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
  if (isDemoMode()) {
    let entries = getDemoTimeEntries();
    
    if (filters.startDate) {
      entries = entries.filter(e => e.date >= filters.startDate);
    }
    if (filters.endDate) {
      entries = entries.filter(e => e.date <= filters.endDate);
    }
    
    // Sort by date desc
    entries.sort((a, b) => new Date(b.date) - new Date(a.date));
    
    return { success: true, data: entries };
  }

  try {
    console.log('🔧 [Service] getAllTimeEntriesDetailed called with filters:', filters);
    
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

    console.log('🔧 [Service] Executing query on time_entries_detailed view...');
    const { data, error } = await query;

    if (error) {
      console.error('🔧 [Service] Query error:', {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint
      });
      throw error;
    }
    
    console.log('🔧 [Service] Query successful. Rows returned:', data?.length || 0);
    if (data && data.length > 0) {
      console.log('🔧 [Service] Sample row:', data[0]);
    }
    
    return { success: true, data };
  } catch (error) {
    console.error('🔧 [Service] Exception in getAllTimeEntriesDetailed:', error);
    
    // Provide helpful error message if view doesn't exist
    if (error.message && error.message.includes('does not exist')) {
      console.error('🔧 [Service] ⚠️ DATABASE VIEW MISSING! The time_entries_detailed view needs to be created.');
      console.error('🔧 [Service] Run the migration: database_migrations/create_time_entries_detailed_view.sql');
    }
    
    return { success: false, error: error.message };
  }
};

/**
 * Update time entry status (approve/reject)
 */
export const updateTimeEntryStatus = async (entryId, status, approverId) => {
  if (isDemoMode()) {
    return { success: true, data: { id: entryId, status, approved_by: approverId } };
  }

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
  if (isDemoMode()) {
    return { success: true, data: { id: entryId, proof_file_name: file.name } };
  }

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
 * Delete proof file from storage and update time entry
 * @param {number} entryId - Time entry ID
 * @param {string} filePath - Storage file path
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export const deleteProofFile = async (entryId, filePath) => {
  if (isDemoMode()) {
    return { success: true };
  }

  try {
    // Delete file from storage if path exists
    if (filePath) {
      const { error: storageError } = await supabase.storage
        .from('employee-documents')
        .remove([filePath]);

      if (storageError) {
        console.error('Error deleting file from storage:', storageError);
        // Continue to update database even if storage deletion fails
      }
    }

    // Update the time entry to remove proof file references
    const { data, error } = await supabase
      .from('time_entries')
      .update({
        proof_file_url: null,
        proof_file_name: null,
        proof_file_type: null,
        proof_file_path: null
      })
      .eq('id', entryId)
      .select()
      .single();

    if (error) throw error;

    return { success: true, data };
  } catch (error) {
    console.error('Error deleting proof file:', error);
    return { 
      success: false, 
      error: error.message || 'Failed to delete proof file'
    };
  }
};

/**
 * Delete a time entry
 */
export const deleteTimeEntry = async (entryId) => {
  if (isDemoMode()) {
    return { success: true };
  }

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

    // Demo mode handling: store in localStorage (small files) or IndexedDB fallback
    if (isDemoMode()) {
      const readAsDataUrl = () => new Promise((resolve, reject) => {
        const fr = new FileReader();
        fr.onload = () => resolve(fr.result);
        fr.onerror = (err) => reject(err);
        fr.readAsDataURL(file);
      });

      try {
        const dataUrl = await readAsDataUrl();
        const demoKey = `demo_time_proof_${toEmployeeId(employeeId)}_${Date.now()}`;
        try {
          localStorage.setItem(demoKey, dataUrl);
          return { success: true, url: dataUrl, fileName: file.name, fileType: file.type, storagePath: demoKey };
        } catch (lsErr) {
          console.warn('⚠️ localStorage setItem failed for proof file, falling back to IndexedDB:', lsErr);
        }
      } catch (readErr) {
        console.warn('⚠️ Failed to read proof file as data URL, will try IndexedDB storage as blob:', readErr);
      }

      // Save blob in IndexedDB
      try {
        const demoKeyIdx = `demo_time_proof_${toEmployeeId(employeeId)}_${Date.now()}`;
        await saveDemoBlob(demoKeyIdx, file);
        return { success: true, url: null, fileName: file.name, fileType: file.type, storagePath: demoKeyIdx };
      } catch (idbErr) {
        console.error('❌ Failed to save demo proof file in IndexedDB:', idbErr);
        return { success: false, error: 'Failed to store proof file in demo mode' };
      }
    }

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

// ============================================
// LEAVE REQUESTS
// ============================================

/**
 * Create a leave request
 */
export const createLeaveRequest = async (leaveData) => {
  if (isDemoMode()) {
    const daysCount = calculateDaysBetween(leaveData.startDate, leaveData.endDate);
    const newLeaveRequest = {
      id: `demo-leave-${Date.now()}`,
      employee_id: leaveData.employeeId,
      leave_type: leaveData.type,
      type: leaveData.type,
      start_date: leaveData.startDate,
      end_date: leaveData.endDate,
      reason: leaveData.reason || null,
      days_count: daysCount,
      status: 'pending',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    // Persist to localStorage
    addDemoLeaveRequest(newLeaveRequest);
    
    return { 
      success: true, 
      data: newLeaveRequest 
    };
  }

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
  if (isDemoMode()) {
    // Get leave requests from persistent storage
    let requests = getDemoLeaveRequests();
    
    // Filter by employee if specified
    if (employeeId) {
      requests = requests.filter(r => String(r.employee_id) === String(employeeId));
    }
    
    // Filter by status if specified
    if (filters.status) {
      requests = requests.filter(r => r.status === filters.status);
    }
    
    // Filter by year if specified
    if (filters.year) {
      requests = requests.filter(r => {
        const startYear = new Date(r.start_date).getFullYear();
        return startYear === filters.year;
      });
    }
    
    // Sort by start_date descending
    requests.sort((a, b) => new Date(b.start_date) - new Date(a.start_date));
    
    return { success: true, data: requests };
  }

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

/* Get all leave requests (for HR/managers) */
export const getAllLeaveRequests = async (filters = {}) => {
  if (isDemoMode()) {
    // Get all leave requests from persistent storage
    let requests = getDemoLeaveRequests();
    
    // Filter by status if specified
    if (filters.status) {
      requests = requests.filter(r => r.status === filters.status);
    }
    
    // Sort by created_at descending
    requests.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    
    return { success: true, data: requests };
  }

  try {
    // Fetch leave requests without relying on a foreign-key relationship in the schema cache
    let query = supabase
      .from('leave_requests')
      .select('*')
      .order('submitted_at', { ascending: false });

    if (filters.status) {
      query = query.eq('status', filters.status);
    }

    const { data, error } = await query;
    if (error) throw error;

    // If no leave requests, return early
    if (!Array.isArray(data) || data.length === 0) return { success: true, data: [] };

    // Batch-fetch employee info for requesters and approvers to attach readable names
    const requesterIds = [...new Set(data.map(r => r.employee_id).filter(Boolean))];
    const approverIds = [...new Set(data.map(r => r.approved_by).filter(Boolean))];
    const allIds = [...new Set([...requesterIds, ...approverIds])];

    let employees = [];
    if (allIds.length > 0) {
      const { data: empData, error: empError } = await supabase
        .from('employees')
        .select('id, name, department, position')
        .in('id', allIds);

      if (empError) {
        console.error('Error fetching employees for leave requests:', empError);
      } else {
        employees = empData || [];
      }
    }

    const empMap = employees.reduce((acc, e) => { acc[e.id] = e; return acc; }, {});

    const merged = data.map(r => ({
      ...r,
      employee: empMap[r.employee_id] || null,
      approved_by_name: empMap[r.approved_by]?.name || null
    }));

    return { success: true, data: merged };
  } catch (error) {
    console.error('Error fetching all leave requests:', error);
    return { success: false, error: error.message };
  }
};

/* Update leave request status */
export const updateLeaveRequestStatus = async (requestId, status, approverId, rejectionReason = null) => {
  if (isDemoMode()) {
    return { success: true, data: { id: requestId, status } };
  }

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

/* Create an overtime log */
export const createOvertimeLog = async (overtimeData) => {
  if (isDemoMode()) {
    return { 
      success: true, 
      data: { 
        id: `demo-ot-${Date.now()}`,
        ...overtimeData,
        status: 'pending'
      } 
    };
  }

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

/* Get overtime logs for an employee */
export const getOvertimeLogs = async (employeeId, filters = {}) => {
  if (isDemoMode()) {
    return { success: true, data: [] };
  }

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

/* Update overtime log status */
export const updateOvertimeStatus = async (logId, status, approverId) => {
  if (isDemoMode()) {
    return { success: true, data: { id: logId, status } };
  }

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

/* Calculate summary directly from time_entries, leave_requests, and overtime_logs, Matches database function logic exactly */
   
const calculateSummaryFromRawData = async (employeeId, month, year) => {
  try {
    console.log('🔧 [Service] Calculating summary for employee:', employeeId, 'month:', month, 'year:', year);
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDate = new Date(year, month, 0).toISOString().split('T')[0];
    console.log('🔧 [Service] Date range:', startDate, 'to', endDate);
    
    // Get time entries (INCLUDE PENDING AND APPROVED)
    const { data: timeEntries, error: timeError } = await supabase
      .from('time_entries')
      .select('*')
      .eq('employee_id', toEmployeeId(employeeId))
      .gte('date', startDate)
      .lte('date', endDate)
      .in('status', ['pending', 'approved']);  // CHANGED: include pending
    
    console.log('🔧 [Service] Time entries found:', timeEntries?.length || 0);
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
        const hours = Math.round(parseFloat(entry.hours || 0) * 100) / 100;
        
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
      const hours = Math.round(parseFloat(log.hours || 0) * 100) / 100;
      if (log.overtime_type === 'holiday') {
        overtimeHoliday += hours;
      } else {
        overtimeRegular += hours;
      }
    });
    
    // AGGREGATE INTO SUMMARY COLUMNS (matching database logic)
    // overtime_hours = weekend + bonus + overtime_logs.regular
    const overtimeHours = Math.round((weekendHours + bonusHours + overtimeRegular) * 100) / 100;
    
    // holiday_overtime_hours = holiday + overtime_logs.holiday
    const holidayOvertimeHours = Math.round((holidayHours + overtimeHoliday) * 100) / 100;
    
    // total_hours = ALL hours from all sources
    const totalHours = Math.round((regularHours + weekendHours + holidayHours + 
                       bonusHours + overtimeRegular + overtimeHoliday) * 100) / 100;
    
    const totalDays = daysWorked + leaveDays;
    const workingDaysInMonth = 22;
    const attendanceRate = totalDays > 0 ? (totalDays / workingDaysInMonth) * 100 : 0;
    
    return {
      employee_id: toEmployeeId(employeeId),
      month,
      year,
      days_worked: daysWorked,
      leave_days: leaveDays,
      regular_hours: Math.round(regularHours * 100) / 100,
      overtime_hours: overtimeHours,
      holiday_overtime_hours: holidayOvertimeHours,
      total_hours: totalHours,
      attendance_rate: Math.round(Math.min(attendanceRate, 100) * 100) / 100
    };
  } catch (error) {
    console.error('Error calculating summary from raw data:', error);
    throw error;
  }
};

/* Get time tracking summary for an employee */
export const getTimeTrackingSummary = async (employeeId, month, year) => {
  if (isDemoMode()) {
    const entries = MOCK_TIME_ENTRIES.filter(e => {
      const d = new Date(e.date);
      return String(e.employee_id) === String(employeeId) && 
             d.getMonth() + 1 === parseInt(month) && 
             d.getFullYear() === parseInt(year);
    });
    
    const regularHours = entries.filter(e => e.hour_type === 'regular').reduce((sum, e) => sum + e.hours, 0);
    const overtimeHours = entries.filter(e => e.hour_type === 'overtime').reduce((sum, e) => sum + e.hours, 0);
    const daysWorked = new Set(entries.map(e => e.date)).size;
    
    return {
      success: true,
      data: {
        regular_hours: regularHours,
        overtime_hours: overtimeHours,
        total_hours: regularHours + overtimeHours,
        days_worked: daysWorked,
        holiday_overtime_hours: 0
      }
    };
  }

  try {
    console.log('🔧 [Service] getTimeTrackingSummary called for employee:', employeeId);
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
      console.log('🔧 [Service] Found data in summary table:', data);
      return { success: true, data };
    }

    // Otherwise, calculate from raw data
    console.log('🔧 [Service] Summary table empty/no data, calculating from time_entries...');
    const calculatedData = await calculateSummaryFromRawData(employeeId, month, year);
    console.log('🔧 [Service] Calculated data:', calculatedData);
    return { success: true, data: calculatedData };
  } catch (error) {
    console.error('🔧 [Service] Error fetching time tracking summary:', error);
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

/* Manually trigger summary update */
export const updateSummary = async (employeeId, month, year) => {
  if (isDemoMode()) {
    return { success: true };
  }

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

/* Get summaries for all employees in a period */
export const getAllEmployeesSummary = async (month, year) => {
  if (isDemoMode()) {
    return { success: true, data: [] };
  }

  try {
    const { data, error } = await supabase
      .from('time_tracking_summary')
      .select(`
        *,
        employee:employees!time_tracking_summary_employee_id_fkey(id, name, department, position)
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
  if (isDemoMode()) {
    return { success: true, data: [] };
  }

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

/* Calculate totals for different hour types */
export const calculateHourTotals = async (employeeId, period = 'week') => {
  if (isDemoMode()) {
    return { success: true, data: { regular: 40, overtime: 5, holiday: 0, wfh: 8 } };
  }

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

/* Get pending approvals count (for managers/HR) */
export const getPendingApprovalsCount = async () => {
  if (isDemoMode()) {
    return { 
      success: true, 
      data: { timeEntries: 2, leaveRequests: 1, overtimeLogs: 0, total: 3 } 
    };
  }

  try {
    const [timeEntries, leaveRequests, overtimeLogs] = await Promise.all([
      supabase.from('time_entries').select('id', { count: 'exact' }).eq('status', 'pending'),
      supabase.from('leave_requests').select('id', { count: 'exact' }).eq('status', 'pending'),
      supabase.from('overtime_logs').select('id', { count: 'exact' }).eq('status', 'pending')
    ]);

    // Check for errors in any of the queries
    if (timeEntries.error) {
      console.error('Error fetching time_entries:', timeEntries.error);
    }
    if (leaveRequests.error) {
      console.error('Error fetching leave_requests:', leaveRequests.error);
    }
    if (overtimeLogs.error) {
      console.error('Error fetching overtime_logs:', overtimeLogs.error);
    }

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
    return { success: false, error: error.message, data: { timeEntries: 0, leaveRequests: 0, overtimeLogs: 0, total: 0 } };
  }
};

/* Get detailed pending approvals (for managers/HR) */
export const getPendingApprovals = async () => {
  if (isDemoMode()) {
    return { success: true, data: MOCK_TIME_ENTRIES.filter(e => e.status === 'pending') };
  }

  try {
    console.log('🔧 [Service] getPendingApprovals called');
    
    const { data, error } = await supabase
      .from('time_entries')
      .select(`
        *,
        employee:employees!time_entries_employee_id_fkey(id, name, department, position)
      `)
      .eq('status', 'pending')
      .order('date', { ascending: false });

    if (error) {
      console.error('🔧 [Service] Error in getPendingApprovals query:', error);
      throw error;
    }
    
    console.log('🔧 [Service] Pending approvals fetched:', data?.length || 0);
    return { success: true, data: data || [] };
  } catch (error) {
    console.error('🔧 [Service] Error fetching pending approvals:', error);
    return { success: false, error: error.message, data: [] };
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

/* Get or create employee from auth user */
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

/* Sync local employees to Supabase */
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

/* Get employee by ID */
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

export const getWorkDaysForMonth = async (month, employeeId = null) => {
  try {
    const year = month.getFullYear();
    const monthIndex = month.getMonth();

    const startDate = new Date(year, monthIndex, 1).toISOString().split('T')[0];
    const endDate = new Date(year, monthIndex + 1, 0).toISOString().split('T')[0];

    let query = supabase
      .from('time_entries')
      .select(`
        date,
        total_hours,
        hour_type,
        employee_id,
        employees (
          id,
          name,
          department
        )
      `)
      .gte('date', startDate)
      .lte('date', endDate)
      .eq('status', 'approved');

    if (employeeId) {
      query = query.eq('employee_id', toEmployeeId(employeeId));
    }

    const { data: entries, error } = await query;

    if (error) throw error;

    const workData = entries.reduce((acc, entry) => {
      if (!entry.employees) return acc;

      const empId = entry.employees.id;
      if (!acc[empId]) {
        acc[empId] = {
          id: empId,
          name: entry.employees.name,
          department: entry.employees.department,
          workDates: new Set(),
          totalOvertime: 0,
        };
      }

      acc[empId].workDates.add(entry.date);
      if (entry.hour_type === 'overtime' || entry.hour_type === 'holiday_overtime') {
        acc[empId].totalOvertime += entry.total_hours;
      }

      return acc;
    }, {});

    const result = Object.values(workData).map(item => ({
      ...item,
      totalDays: item.workDates.size,
    }));

    return result;

  } catch (error) {
    console.error('Error fetching work days for month:', error);
    return [];
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
  getEmployeeById,
  getWorkDaysForMonth
};
