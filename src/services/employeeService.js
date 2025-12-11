import { supabase } from '../config/supabaseClient';
import { withTimeout } from '../utils/supabaseTimeout';
import { isDemoMode, MOCK_EMPLOYEES, getDemoEmployees, addDemoEmployee, updateDemoEmployee, deleteDemoEmployee, getDemoEmployeeById } from '../utils/demoHelper';
import { saveDemoPdf, getDemoPdf, deleteDemoPdf, saveDemoBlob, getDemoBlob, deleteDemoBlob } from '../utils/demoStorage';

/* Ensure employee ID is a string (supports both integers and UUIDs) */
const toEmployeeId = (id) => {
  return id ? String(id) : null;
};

export const linkUserToEmployee = async (userId, userEmail) => {
  try {
    console.log(`Linking user ${userId} (${userEmail}) to employee record...`);
    
    // Find employee with matching email
    const { data: employee, error: employeeError } = await supabase
      .from('employees')
      .select('id, name, email, department, position')
      .eq('email', userEmail)
      .maybeSingle();

    if (employeeError) {
      console.error('Error finding employee by email:', employeeError);
      return { success: false, error: employeeError.message };
    }

    if (!employee) {
      console.log(`No employee found with email ${userEmail}`);
      return { success: false, error: 'No employee record found with this email' };
    }

    // Update hr_users table with employee_id
    const { data: updatedUser, error: updateError } = await supabase
      .from('hr_users')
      .update({ employee_id: employee.id })
      .eq('id', userId)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating hr_users with employee_id:', updateError);
      return { success: false, error: updateError.message };
    }

    console.log(`✅ Successfully linked user ${userId} to employee ${employee.id}`);
    return { 
      success: true, 
      data: {
        employeeId: employee.id,
        employeeName: employee.name,
        department: employee.department,
        position: employee.position
      }
    };
  } catch (error) {
    console.error('Error linking user to employee:', error);
    return { success: false, error: error.message };
  }
};

export const getEmployeeByUserId = async (userId) => {
  if (isDemoMode()) {
    // In demo mode, the user ID is 'demo-user-id' and linked to 'demo-emp-1'
    if (userId === 'demo-user-id') {
      return { success: true, data: MOCK_EMPLOYEES[0] };
    }
    return { success: false, error: 'User not found in demo mode' };
  }

  try {
    // First get the employee_id from hr_users
    const { data: hrUser, error: hrUserError } = await supabase
      .from('hr_users')
      .select('employee_id, email')
      .eq('id', userId)
      .single();

    if (hrUserError) throw hrUserError;

    if (!hrUser.employee_id) {
      // Try to auto-link if employee_id is missing
      const linkResult = await linkUserToEmployee(userId, hrUser.email);
      if (!linkResult.success) {
        return { success: false, error: 'No employee record linked to this user' };
      }
      // Fetch the employee data after linking
      return await getEmployeeById(linkResult.data.employeeId);
    }

    // Fetch employee data
    return await getEmployeeById(hrUser.employee_id);
  } catch (error) {
    console.error('Error fetching employee by user ID:', error);
    return { success: false, error: error.message };
  }
};

// ============================================
// EMPLOYEE CRUD OPERATIONS
// ============================================

export const getAllEmployees = async (filters = {}) => {
  if (isDemoMode()) {
    console.log('🧪 Demo Mode: Returning mock employees');
    let data = getDemoEmployees();

    // Hydrate photos from IndexedDB
    const dataWithPhotos = await Promise.all(data.map(async (emp) => {
      if (emp.photoBlobKey && !emp.photo) {
        try {
          const blob = await getDemoBlob(emp.photoBlobKey);
          if (blob) {
            return { ...emp, photo: URL.createObjectURL(blob) };
          }
        } catch (e) {
          console.error('Error loading demo photo:', e);
        }
      }
      return emp;
    }));
    
    data = dataWithPhotos;
    
    // Apply simple filters
    if (filters.status) {
      data = data.filter(e => e.status === filters.status);
    }
    if (filters.department) {
      data = data.filter(e => e.department === filters.department);
    }
    
    return { success: true, data };
  }

  try {
    let query = supabase
      .from('employees')
      .select(`
        *,
        hr_user:hr_users!employee_id(
          avatar_url,
          id
        )
      `)
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

    const { data, error } = await withTimeout(query, 20000).catch((err) => {
      console.warn('getAllEmployees: initial query timed out, retrying with 30s', err);
      return withTimeout(query, 30000);
    });

    if (error) throw error;
    
    // Map avatar_url from hr_users to photo field if available
    const enrichedData = data.map(emp => ({
      ...emp,
      photo: emp.hr_user?.avatar_url || emp.photo || null
    }));
    
    return { success: true, data: enrichedData };
  } catch (error) {
    console.error('Error fetching employees:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Get employee by ID
 */
export const getEmployeeById = async (employeeId) => {
  if (isDemoMode()) {
    const employees = getDemoEmployees();
    const emp = employees.find(e => e.id === employeeId);
    if (emp) {
      // Hydrate photo if needed
      if (emp.photoBlobKey && !emp.photo) {
        try {
          const blob = await getDemoBlob(emp.photoBlobKey);
          if (blob) {
            return { success: true, data: { ...emp, photo: URL.createObjectURL(blob) } };
          }
        } catch (e) {
          console.error('Error loading demo photo:', e);
        }
      }
      return { success: true, data: emp };
    }
    return { success: false, error: 'Employee not found in demo data' };
  }

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
  if (isDemoMode()) {
    const newEmployee = {
      id: `demo-emp-${Date.now()}`,
      ...employeeData,
      status: employeeData.status || 'Active',
      start_date: employeeData.startDate || new Date().toISOString().split('T')[0]
    };

    // Handle photo storage in IndexedDB to avoid localStorage quota limits
    if (newEmployee.photo && typeof newEmployee.photo === 'string' && newEmployee.photo.startsWith('data:')) {
      try {
        // Convert base64 to blob
        const response = await fetch(newEmployee.photo);
        const blob = await response.blob();
        const photoKey = `${newEmployee.id}_photo`;
        await saveDemoBlob(photoKey, blob);
        
        // Store reference instead of huge string
        newEmployee.photo = null; 
        newEmployee.photoBlobKey = photoKey;
      } catch (err) {
        console.error('Failed to save demo photo to IndexedDB:', err);
        newEmployee.photo = null;
      }
    }

    addDemoEmployee(newEmployee);
    return { success: true, data: newEmployee };
  }

  try {
    // Check if email already exists
    if (employeeData.email) {
      const { data: existingEmployee, error: checkError } = await supabase
        .from('employees')
        .select('id, email')
        .eq('email', employeeData.email)
        .maybeSingle();
      
      if (checkError) {
        console.error('Error checking existing email:', checkError);
      }
      
      if (existingEmployee) {
        return {
          success: false,
          error: `Email ${employeeData.email} is already registered to another employee (ID: ${existingEmployee.id}). Please use a unique email.`
        };
      }
    }

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

    if (error) {
      // Handle duplicate key constraint errors with user-friendly messages
      if (error.code === '23505') {
        if (error.message.includes('email')) {
          return {
            success: false,
            error: `Email ${employeeData.email} is already registered. Please use a unique email.`
          };
        }
        return {
          success: false,
          error: 'A duplicate entry was detected. Please check your data and try again.'
        };
      }
      throw error;
    }
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
  if (isDemoMode()) {
    // Handle photo update
    if (updates.photo && typeof updates.photo === 'string' && updates.photo.startsWith('data:')) {
       try {
        const response = await fetch(updates.photo);
        const blob = await response.blob();
        const photoKey = `${employeeId}_photo`;
        await saveDemoBlob(photoKey, blob);
        
        updates.photo = null;
        updates.photoBlobKey = photoKey;
      } catch (err) {
        console.error('Failed to save demo photo update:', err);
        updates.photo = null;
      }
    }

    const updated = updateDemoEmployee(employeeId, updates);
    if (updated) {
      return { success: true, data: updated };
    }
    return { success: false, error: 'Employee not found in demo data' };
  }

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

    // If updating email, check if it's already in use by another employee
    if (updates.email !== undefined) {
      const { data: existingEmployee, error: checkError } = await supabase
        .from('employees')
        .select('id, email')
        .eq('email', updates.email)
        .maybeSingle();
      
      if (checkError) {
        console.error('Error checking existing email:', checkError);
      }
      
      if (existingEmployee && existingEmployee.id !== toEmployeeId(employeeId)) {
        return {
          success: false,
          error: `Email ${updates.email} is already registered to another employee (ID: ${existingEmployee.id}). Please use a unique email.`
        };
      }
    }

    const { data, error } = await supabase
      .from('employees')
      .update(updateData)
      .eq('id', toEmployeeId(employeeId))
      .select()
      .single();

    if (error) {
      // Handle duplicate key constraint errors with user-friendly messages
      if (error.code === '23505') {
        if (error.message.includes('email')) {
          return {
            success: false,
            error: `Email ${updates.email} is already registered. Please use a unique email.`
          };
        }
        return {
          success: false,
          error: 'A duplicate entry was detected. Please check your data and try again.'
        };
      }
      throw error;
    }
    return { success: true, data };
  } catch (error) {
    console.error('Error updating employee:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Delete an employee permanently from the database
 * This will also delete all related data (time entries, leave requests, overtime logs)
 * Due to CASCADE constraints in the database
 */
export const deleteEmployee = async (employeeId) => {
  if (isDemoMode()) {
    const emp = getDemoEmployeeById(employeeId);
    // Clean up stored blobs (photo/pdf) if present
    if (emp?.photoBlobKey) {
      try {
        await deleteDemoBlob(emp.photoBlobKey);
      } catch (err) {
        console.warn('Failed to delete demo photo blob', err);
      }
    }
    try {
      await deleteDemoPdf(employeeId);
    } catch (err) {
      console.warn('Failed to delete demo PDF blob', err);
    }

    const removed = deleteDemoEmployee(employeeId);
    return removed
      ? { success: true }
      : { success: false, error: 'Employee not found in demo data' };
  }

  try {
    const id = toEmployeeId(employeeId);
    
    console.log(`Permanently deleting employee ${id} and all related data...`);
    
    // Manually delete time_tracking_summary records (in case CASCADE not set up)
    const { error: summaryError } = await supabase
      .from('time_tracking_summary')
      .delete()
      .eq('employee_id', id);
    
    if (summaryError) {
      console.warn('Error deleting time tracking summary:', summaryError);
      // Don't fail - might not exist or CASCADE might handle it
    }
    
    // Delete employee (CASCADE will handle other related records)
    // time_entries, leave_requests, overtime_logs have CASCADE on employee_id
    const { error: deleteError } = await supabase
      .from('employees')
      .delete()
      .eq('id', id);

    if (deleteError) {
      console.error('Error deleting employee:', deleteError);
      throw deleteError;
    }
    
    // Also update hr_users to remove employee_id link (if exists)
    // This is SET NULL by foreign key constraint
    const { error: unlinkError } = await supabase
      .from('hr_users')
      .update({ employee_id: null })
      .eq('employee_id', id);
    
    if (unlinkError) {
      console.warn('Error unlinking hr_users:', unlinkError);
      // Don't fail if this doesn't work
    }
    
    console.log(`✅ Successfully deleted employee ${id}`);
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

export const uploadEmployeePhoto = async (fileData, employeeId) => {
  if (isDemoMode()) {
    // Return a mock URL or the base64 data if available
    if (typeof fileData === 'string' && fileData.startsWith('data:')) {
      return {
        success: true,
        url: fileData,
        fileName: 'demo-photo.jpg',
        fileType: 'image/jpeg',
        storage: 'base64'
      };
    }
    return {
      success: true,
      url: 'https://i.pravatar.cc/150?u=demo',
      fileName: 'demo-photo.jpg',
      fileType: 'image/jpeg',
      storage: 'mock'
    };
  }

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

    // Path within the bucket (no need to include bucket name)
    const filePath = `${fileName}`;

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
  if (isDemoMode()) {
    return { success: true };
  }

  try {
    // Extract file path from URL (just the filename)
    const urlParts = photoUrl.split('/');
    const fileName = urlParts[urlParts.length - 1];

    const { error } = await supabase.storage
      .from('employee-photos')
      .remove([fileName]);

    if (error) throw error;
    return { success: true };
  } catch (error) {
    console.error('Error deleting employee photo:', error);
    return { success: false, error: error.message };
  }
};

export const uploadEmployeePdf = async (file, employeeId, onProgress = null) => {
  try {
    console.log('📁 Starting PDF upload:', file.name, 'Type:', file.type, 'Size:', file.size);

    // Validate file type
    if (file.type !== 'application/pdf') {
      throw new Error('Invalid file type. Only PDF files are allowed.');
    }

    // Validate file size (50MB max)
    const maxSize = 50 * 1024 * 1024; // 50MB
    if (file.size > maxSize) {
      throw new Error('File size exceeds 50MB limit.');
    }

    // Demo mode: try localStorage first (fast) then fall back to IndexedDB
    if (isDemoMode()) {
      const readAsDataUrl = () => new Promise((resolve, reject) => {
        const fr = new FileReader();
        fr.onload = () => resolve(fr.result);
        fr.onerror = (err) => reject(err);
        fr.readAsDataURL(file);
      });

      try {
        const dataUrl = await readAsDataUrl();
        const demoKey = `demo_employee_pdf_${toEmployeeId(employeeId)}`;
        try {
          localStorage.setItem(demoKey, dataUrl);
          // Persist demo employee record with pdf path
          try { updateDemoEmployee(toEmployeeId(employeeId), { pdf_document_url: demoKey }); } catch (uerr) { console.warn('⚠️ updateDemoEmployee failed:', uerr); }
          console.log('📋 Demo PDF stored in localStorage under:', demoKey);
          return { success: true, path: demoKey, url: dataUrl };
        } catch (lsErr) {
          console.warn('⚠️ localStorage setItem failed, falling back to IndexedDB:', lsErr);
          // Fall through to IndexedDB save below
        }
      } catch (readErr) {
        console.warn('⚠️ Failed to read file as data URL, will try IndexedDB storage as blob:', readErr);
      }

      // Save file as Blob in IndexedDB
      try {
        await saveDemoPdf(toEmployeeId(employeeId), file);
        const demoKeyIdx = `demo_employee_pdf_${toEmployeeId(employeeId)}`;
        try { updateDemoEmployee(toEmployeeId(employeeId), { pdf_document_url: demoKeyIdx }); } catch (uerr) { console.warn('⚠️ updateDemoEmployee failed:', uerr); }
        // We can't return a persistent public URL for an IndexedDB blob; return the key and let getEmployeePdfUrl create an object URL when needed
        return { success: true, path: demoKeyIdx, url: null };
      } catch (idbErr) {
        console.error('❌ Failed to save demo PDF in IndexedDB:', idbErr);
        return { success: false, error: 'Failed to store demo PDF' };
      }
    }

    // Generate unique file path for production
    const timestamp = Date.now();
    const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const filePath = `${toEmployeeId(employeeId)}_${timestamp}.pdf`;

    console.log('📋 File path:', filePath);

    // Delete old PDF if exists
    const { data: employeeData } = await supabase
      .from('employees')
      .select('pdf_document_url')
      .eq('id', toEmployeeId(employeeId))
      .single();

    if (employeeData?.pdf_document_url) {
      console.log('🗑️ Deleting old PDF:', employeeData.pdf_document_url);
      await supabase.storage
        .from('employee-documents')
        .remove([employeeData.pdf_document_url]);
    }

    // ✅ Use signed upload URL to avoid multipart form-data wrapping
    console.log('🔐 Getting signed upload URL...');
    const { data: signedUrlData, error: signedUrlError } = await supabase.storage
      .from('employee-documents')
      .createSignedUploadUrl(filePath);

    if (signedUrlError) {
      console.error('❌ Signed URL error:', signedUrlError);
      throw signedUrlError;
    }

    console.log('✅ Got signed URL, uploading file directly...');

    // Upload file using XMLHttpRequest to PUT raw binary to signed URL
    await new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('PUT', signedUrlData.signedUrl, true);
      xhr.setRequestHeader('Content-Type', 'application/pdf');

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable && onProgress) {
          const percent = Math.round((e.loaded / e.total) * 100);
          onProgress(percent);
          console.log(`📈 Upload progress: ${percent}%`);
        }
      };

      xhr.onload = () => {
        if (xhr.status === 200) {
          console.log('✅ File uploaded successfully via signed URL');
          resolve();
        } else {
          console.error('❌ Upload failed:', xhr.status, xhr.responseText);
          reject(new Error(`Upload failed with status ${xhr.status}`));
        }
      };

      xhr.onerror = () => {
        console.error('❌ Network error during upload');
        reject(new Error('Network error during upload'));
      };

      // Send raw file - NO multipart wrapping!
      xhr.send(file);
    });

    console.log('✅ Upload complete, updating database...');

    // Update employee record with file path
    const { error: updateError } = await supabase
      .from('employees')
      .update({ pdf_document_url: filePath })
      .eq('id', toEmployeeId(employeeId));

    if (updateError) {
      console.error('❌ Database update error:', updateError);
      throw updateError;
    }

    console.log('✅ Database updated with path:', filePath);

    // Generate public URL
    const { data: publicUrlData } = supabase.storage
      .from('employee-documents')
      .getPublicUrl(filePath);

    console.log('✅ PDF upload complete! URL:', publicUrlData.publicUrl);

    return {
      success: true,
      path: filePath,
      url: publicUrlData.publicUrl
    };
  } catch (error) {
    console.error('❌ Error uploading PDF:', error);
    return { 
      success: false, 
      error: error.message || 'Failed to upload PDF document'
    };
  }
};

export const deleteEmployeePdf = async (employeeId, pdfPath) => {
  if (isDemoMode()) {
    try {
      const demoKey = pdfPath || `demo_employee_pdf_${toEmployeeId(employeeId)}`;
      try { localStorage.removeItem(demoKey); } catch (e) { /* ignore */ }
      try { await deleteDemoPdf(toEmployeeId(employeeId)); } catch (e) { /* ignore */ }
      try { updateDemoEmployee(toEmployeeId(employeeId), { pdf_document_url: null }); } catch (uerr) { /* ignore */ }
      return { success: true };
    } catch (err) {
      console.error('❌ Error removing demo PDF from storage:', err);
      return { success: false, error: 'Failed to remove demo PDF' };
    }
  }

  try {
    console.log('🗑️ Deleting PDF:', pdfPath, 'for employee:', employeeId);
    
    // Delete from storage
    const { error: storageError } = await supabase.storage
      .from('employee-documents')
      .remove([pdfPath]);

    if (storageError) {
      console.warn('⚠️ Storage deletion warning:', storageError.message);
      // Continue even if storage deletion fails (file might not exist)
    }

    // Clear database field
    const { error: dbError } = await supabase
      .from('employees')
      .update({ pdf_document_url: null })
      .eq('id', toEmployeeId(employeeId));

    if (dbError) throw dbError;

    console.log('✅ PDF deleted successfully');
    return { success: true };
  } catch (error) {
    console.error('❌ Error deleting employee PDF:', error);
    return { success: false, error: error.message };
  }
};

export const getEmployeePdfUrl = async (pdfPath) => {
  try {
    if (!pdfPath) {
      return { success: false, error: 'No PDF path provided' };
    }

    // Demo mode: return data URL from localStorage or blob from IndexedDB
    if (isDemoMode()) {
      try {
        const localKey = pdfPath;
        const stored = localStorage.getItem(localKey) || localStorage.getItem(`demo_employee_pdf_${pdfPath}`) || localStorage.getItem(`demo_employee_pdf_${toEmployeeId(pdfPath)}`);
        if (stored) {
          return { success: true, url: stored, type: 'demo' };
        }
      } catch (err) {
        console.warn('⚠️ Error reading demo PDF from localStorage:', err);
      }

      // Try IndexedDB
      try {
        let demoEmployeeId = null;
        if (typeof pdfPath === 'string' && pdfPath.startsWith('demo_employee_pdf_')) {
          demoEmployeeId = pdfPath.replace('demo_employee_pdf_', '');
        } else {
          demoEmployeeId = toEmployeeId(pdfPath);
        }

        const blob = await getDemoPdf(demoEmployeeId);
        if (blob) {
          const objectUrl = URL.createObjectURL(blob);
          return { success: true, url: objectUrl, type: 'demo' };
        }
        return { success: false, error: 'Demo PDF not found' };
      } catch (idbErr) {
        console.error('❌ Error reading demo PDF from IndexedDB:', idbErr);
        return { success: false, error: 'Failed to read demo PDF' };
      }
    }

    // Try public URL first
    const { data: publicData } = supabase.storage
      .from('employee-documents')
      .getPublicUrl(pdfPath);

    // Test if URL is accessible
    const testResponse = await fetch(publicData.publicUrl, { method: 'HEAD' });
    
    if (testResponse.ok) {
      return {
        success: true,
        url: publicData.publicUrl,
        type: 'public'
      };
    }

    // Fallback to signed URL
    const { data: signedData, error: signedError } = await supabase.storage
      .from('employee-documents')
      .createSignedUrl(pdfPath, 31536000);

    if (signedError) throw signedError;

    return {
      success: true,
      url: signedData.signedUrl,
      type: 'signed'
    };
  } catch (error) {
    console.error('Error getting PDF URL:', error);
    return { success: false, error: error.message };
  }
};

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

export const unsubscribeFromEmployees = (subscription) => {
  if (subscription) {
    supabase.removeChannel(subscription);
  }
};

// ============================================
// EXPORTS
// ============================================

export default {
  // User-Employee Linking
  linkUserToEmployee,
  getEmployeeByUserId,
  
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
  
  // PDF Document Management
  uploadEmployeePdf,
  deleteEmployeePdf,
  getEmployeePdfUrl,
  
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
