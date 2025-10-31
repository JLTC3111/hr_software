import React, { useState, useEffect } from 'react';
import { Clock, Upload, Calendar, AlertCircle, Check, X, FileText, AlarmClockPlus, Loader, Loader2, ChevronsUpDown, CalendarClock } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import * as timeTrackingService from '../services/timeTrackingService';
import { supabase } from '../config/supabaseClient';
import AdminTimeEntry from './AdminTimeEntry';
import { motion } from 'framer-motion';

const TimeClockEntry = ({ currentLanguage }) => {
  const { isDarkMode, bg, text, button, input, border } = useTheme();
  const { t } = useLanguage();
  const { user } = useAuth();
  
  // Check if user can manage time tracking (admin or manager)
  const canManageTimeTracking = user && (user.role === 'admin' || user.role === 'manager');

  // Form state
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    clockIn: '',
    clockOut: '',
    hourType: 'regular',
    notes: '',
    proofFile: null
  });

  // Animation variants for upload icon
  const uploadVariants = {
    rest: {
      scale: 1,
    },
    hover: {
      scale: [1, 1.1, 1],
      transition: {
        repeat: Infinity,
        duration: 1.2,
        ease: "easeInOut",
      }
    }
  };
  
  // Time entries state
  const [timeEntries, setTimeEntries] = useState([]);
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showLeaveModal, setShowLeaveModal] = useState(false);

  const [errors, setErrors] = useState({});
  const [successMessage, setSuccessMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // State for uploading proof to existing entries
  const [uploadingProofId, setUploadingProofId] = useState(null);
  const [uploadToast, setUploadToast] = useState({ show: false, message: '', type: '' });
  const [uploadProgress, setUploadProgress] = useState({});
  
  // State for image preview modal
  const [imagePreview, setImagePreview] = useState({ show: false, url: '' });
  
  // State for employee filtering and approval
  const [selectedEmployeeFilter, setSelectedEmployeeFilter] = useState('self'); // 'self' or employee ID or 'all'
  const [allEmployees, setAllEmployees] = useState([]);
  const [filteredEntries, setFilteredEntries] = useState([]);
  const [approvingEntryId, setApprovingEntryId] = useState(null);
  
  // Leave request form
  const [leaveForm, setLeaveForm] = useState({
    type: 'vacation',
    startDate: '',
    endDate: '',
    reason: ''
  });

  // Fetch time entries and employees when component mounts
  useEffect(() => {
    const loadData = async () => {
      if (user) {
        setLoading(true);
        try {
          await fetchTimeEntries();
          // Fetch all employees if user is admin or manager
          if (canManageTimeTracking) {
            await fetchAllEmployees();
          }
        } catch (error) {
          console.error('Error loading data:', error);
        } finally {
          setLoading(false);
        }
      } else {
        setLoading(false);
      }
    };
    
    loadData();
  }, [user, canManageTimeTracking]);
  
  // Filter entries based on selected employee
  useEffect(() => {
    // Ensure timeEntries is an array before filtering
    const entries = Array.isArray(timeEntries) ? timeEntries : [];
    
    console.log('Filtering entries - selectedEmployeeFilter:', selectedEmployeeFilter);
    console.log('Total entries to filter:', entries.length);
    
    if (selectedEmployeeFilter === 'self') {
      // Show only current user's entries
      const employeeId = user?.employee_id || user?.id;
      const filtered = entries.filter(entry => 
        String(entry.employee_id) === String(employeeId)
      );
      console.log('Filtering for self (employee_id:', employeeId, ') - showing', filtered.length, 'entries');
      setFilteredEntries(filtered);
    } else if (selectedEmployeeFilter === 'all') {
      // Show all entries (already loaded)
      console.log('Showing all entries:', entries.length);
      setFilteredEntries(entries);
    } else {
      // Filter by specific employee - compare as strings to handle both int and UUID
      const filtered = entries.filter(entry => 
        String(entry.employee_id) === String(selectedEmployeeFilter)
      );
      console.log('Filtering for employee:', selectedEmployeeFilter, '- showing', filtered.length, 'entries');
      setFilteredEntries(filtered);
    }
  }, [selectedEmployeeFilter, timeEntries, user]);

  // Fetch time entries and leave requests from Supabase
  const fetchTimeEntries = async () => {
    try {
      let result;
      
      console.log('🔍 [TIME ENTRIES] Fetching entries...');
      console.log('📋 Selected filter:', selectedEmployeeFilter);
      console.log('👤 User info:', {
        employee_id: user?.employee_id,
        user_id: user?.id,
        role: user?.role,
        canManage: canManageTimeTracking
      });
      
      // For admins/managers, always use detailed view to get employee names
      if (canManageTimeTracking) {
        console.log('🔑 Admin/Manager mode - fetching all detailed entries');
        // Always fetch ALL entries and let the useEffect filter them
        result = await timeTrackingService.getAllTimeEntriesDetailed();
        
        console.log('📊 API Result:', {
          success: result?.success,
          dataLength: result?.data?.length,
          error: result?.error,
          sampleData: result?.data?.[0]
        });
        
        if (result?.success && Array.isArray(result.data)) {
          console.log(`✅ Successfully loaded ${result.data.length} entries`);
          setTimeEntries(result.data);
        } else {
          console.error('❌ Failed to load entries:', result?.error || 'No data returned');
          setTimeEntries([]);
        }
      } else {
        // Regular users - fetch only their own entries
        const employeeId = user?.employee_id || user?.id;
        console.log('👷 Regular user mode - fetching for employee ID:', employeeId);
        if (employeeId) {
          result = await timeTrackingService.getTimeEntries(employeeId);
          console.log('📊 API Result:', {
            success: result?.success,
            dataLength: result?.data?.length,
            error: result?.error
          });
          if (result?.success && Array.isArray(result.data)) {
            console.log(`✅ Successfully loaded ${result.data.length} entries for user`);
            setTimeEntries(result.data);
          } else {
            console.error('❌ Failed to load entries:', result?.error || 'No data returned');
            setTimeEntries([]);
          }
        } else {
          console.warn('⚠️ No employee ID found for user');
          setTimeEntries([]);
        }
      }
    } catch (error) {
      console.error('💥 Exception in fetchTimeEntries:', error);
      console.error('Stack:', error.stack);
      setTimeEntries([]); // Ensure it's an empty array on error
    }
  };

  // Fetch all employees for dropdown
  const fetchAllEmployees = async () => {
    try {
      const { data, error } = await supabase
        .from('employees')
        .select('id, name, position, department')
        .eq('status', 'Active')
        .order('name');
      
      if (error) throw error;
      setAllEmployees(data || []);
    } catch (error) {
      console.error('Error fetching employees:', error);
    }
  };

  // Validation
  const validateForm = () => {
    const newErrors = {};

    if (!formData.date) {
      newErrors.date = t('timeClock.errors.dateRequired');
    }

    if (!formData.clockIn) {
      newErrors.clockIn = t('timeClock.errors.clockInRequired');
    }

    if (!formData.clockOut) {
      newErrors.clockOut = t('timeClock.errors.clockOutRequired');
    }

    // Check if clock-out is after clock-in
    if (formData.clockIn && formData.clockOut) {
      const clockInTime = new Date(`${formData.date}T${formData.clockIn}`);
      const clockOutTime = new Date(`${formData.date}T${formData.clockOut}`);
      
      if (clockOutTime <= clockInTime) {
        newErrors.clockOut = t('timeClock.errors.clockOutAfterClockIn');
      }

      // Check for reasonable hours (max 24 hours in a day)
      const hoursDiff = (clockOutTime - clockInTime) / (1000 * 60 * 60);
      if (hoursDiff > 24) {
        newErrors.clockOut = t('timeClock.errors.tooManyHours');
      }
    }

    // Check for overlapping shifts on the same day
    const overlapping = timeEntries.some(entry => {
      if (entry.date !== formData.date) return false;
      
      const existingClockIn = new Date(`${entry.date}T${entry.clockIn}`);
      const existingClockOut = new Date(`${entry.date}T${entry.clockOut}`);
      const newClockIn = new Date(`${formData.date}T${formData.clockIn}`);
      const newClockOut = new Date(`${formData.date}T${formData.clockOut}`);

      return (
        (newClockIn >= existingClockIn && newClockIn < existingClockOut) ||
        (newClockOut > existingClockIn && newClockOut <= existingClockOut) ||
        (newClockIn <= existingClockIn && newClockOut >= existingClockOut)
      );
    });

    if (overlapping) {
      newErrors.general = t('timeClock.errors.overlapping');
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  
  // Calculate hours worked
  const calculateHours = (clockIn, clockOut, date) => {
    const start = new Date(`${date}T${clockIn}`);
    const end = new Date(`${date}T${clockOut}`);
    return ((end - start) / (1000 * 60 * 60)).toFixed(1);
  };

  // Handle file upload
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Check file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        setErrors({ ...errors, proofFile: t('timeClock.errors.fileTooLarge') });
        return;
      }

      // Check file type
      const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'];
      if (!allowedTypes.includes(file.type)) {
        setErrors({ ...errors, proofFile: t('timeClock.errors.invalidFileType') });
        return;
      }

      // Convert to base64 for storage
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData({ ...formData, proofFile: { name: file.name, type: file.type, data: reader.result } });
        setErrors({ ...errors, proofFile: null });
      };
      reader.readAsDataURL(file);
    }
  };

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    setIsSubmitting(true);

    try {
      const hours = calculateHours(formData.clockIn, formData.clockOut, formData.date);
      
      // Upload proof file if exists
      let proofFileUrl = null;
      let proofFileName = null;
      let proofFileType = null;
      let proofFilePath = null;
      
      if (formData.proofFile) {
        // Convert base64 back to file for upload (as a complete single file)
        const base64Data = formData.proofFile.data;
        const byteCharacters = atob(base64Data.split(',')[1]);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        
        // Create File object with complete byte array (ensures single-part upload)
        const file = new File([byteArray], formData.proofFile.name, { 
          type: formData.proofFile.type,
          lastModified: Date.now()
        });
        
        const uploadResult = await timeTrackingService.uploadProofFile(file, user?.id);
        if (uploadResult.success) {
          proofFileUrl = uploadResult.url;
          proofFileName = uploadResult.fileName;
          proofFileType = uploadResult.fileType;
          proofFilePath = uploadResult.storagePath;
        }
      }
      
      // Ensure employee exists in database before creating time entry
      const employeeCheck = await timeTrackingService.ensureEmployeeExists(user?.id, {
        name: user?.user_metadata?.name || user?.email?.split('@')[0] || 'User',
        email: user?.email,
        position: user?.user_metadata?.position,
        department: user?.user_metadata?.department
      });

      if (!employeeCheck.success) {
        setErrors({ general: employeeCheck.error || 'Employee record not found. Please contact HR.' });
        setIsSubmitting(false);
        return;
      }

      if (employeeCheck.created) {
        console.log('Employee record created automatically for user:', user?.id);
      }
      
      // Create time entry in Supabase
      // Use employeeId from user profile to link with employees table
      const employeeId = user?.employeeId || user?.id;
      const result = await timeTrackingService.createTimeEntry({
        employeeId: employeeId,
        date: formData.date,
        clockIn: formData.clockIn,
        clockOut: formData.clockOut,
        hours: parseFloat(hours),
        hourType: formData.hourType,
        notes: formData.notes,
        proofFileUrl,
        proofFileName,
        proofFileType,
        proofFilePath
      });
      
      if (result.success) {
        // Refresh time entries
        const employeeId = user.employeeId || user.id;
        const entriesResult = await timeTrackingService.getTimeEntries(employeeId);
        if (entriesResult.success) {
          setTimeEntries(entriesResult.data || []);
        }
        
        // Reset form
        setFormData({
          date: new Date().toISOString().split('T')[0],
          clockIn: '',
          clockOut: '',
          hourType: 'regular',
          notes: '',
          proofFile: null
        });

        setSuccessMessage(t('timeClock.success'));
        setTimeout(() => setSuccessMessage(''), 3000);
      } else {
        setErrors({ general: result.error || t('timeClock.errors.submitFailed') });
      }
    } catch (error) {
      console.error('Error submitting time entry:', error);
      setErrors({ general: t('timeClock.errors.submitFailed') });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Helper function to check if file is an image
  const isImageFile = (fileType, fileUrl) => {
    // First check MIME type
    if (fileType && fileType.startsWith('image/')) {
      return true;
    }
    
    // Fallback: check file extension from URL
    if (fileUrl) {
      const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg'];
      const urlLower = fileUrl.toLowerCase();
      return imageExtensions.some(ext => urlLower.includes(ext));
    }
    
    return false;
  };

  // Delete entry or proof file
  const handleDelete = async (id, entry) => {
    // Check if entry has a proof file
    const hasProof = entry?.proof_file_url;
    
    let deleteChoice;
    if (hasProof) {
      // Show custom confirmation with two options
      const message = `${t('timeClock.deleteOptions', 'Choose delete option')}:\n\n1 - ${t('timeClock.deleteEntry', 'Delete entire time entry')}\n2 - ${t('timeClock.deleteProofOnly', 'Delete proof file only')}\n\n${t('timeClock.enterChoice', 'Enter 1 or 2')}:`;
      deleteChoice = window.prompt(message);
      
      if (!deleteChoice) return; // User cancelled
      
      deleteChoice = deleteChoice.trim();
      
      if (deleteChoice !== '1' && deleteChoice !== '2') {
        alert(t('timeClock.invalidChoice', 'Invalid choice. Please enter 1 or 2.'));
        return;
      }
    } else {
      // No proof file, just confirm deletion of entry
      if (!window.confirm(t('timeClock.confirmDelete'))) {
        return;
      }
      deleteChoice = '1';
    }
    
    try {
      if (deleteChoice === '2') {
        // Delete only the proof file
        const result = await timeTrackingService.deleteProofFile(id, entry.proof_file_path);
        
        if (result.success) {
          // Update local state to remove proof file info
          setTimeEntries(prevEntries =>
            prevEntries.map(e =>
              e.id === id
                ? {
                    ...e,
                    proof_file_url: null,
                    proof_file_name: null,
                    proof_file_type: null,
                    proof_file_path: null
                  }
                : e
            )
          );
          
          setUploadToast({
            show: true,
            message: t('timeClock.proofDeleteSuccess', 'Proof file deleted successfully'),
            type: 'success'
          });
          setTimeout(() => setUploadToast({ show: false, message: '', type: '' }), 3000);
        } else {
          setUploadToast({
            show: true,
            message: result.error || t('timeClock.proofDeleteError', 'Failed to delete proof file'),
            type: 'error'
          });
          setTimeout(() => setUploadToast({ show: false, message: '', type: '' }), 5000);
        }
      } else {
        // Delete entire entry
        const result = await timeTrackingService.deleteTimeEntry(id);
        if (result.success) {
          setTimeEntries(timeEntries.filter(entry => entry.id !== id));
          setSuccessMessage(t('timeClock.deleteSuccess', 'Time entry deleted successfully'));
          setTimeout(() => setSuccessMessage(''), 3000);
        } else {
          setErrors({ general: t('timeClock.errors.deleteFailed') });
        }
      }
    } catch (error) {
      console.error('Error deleting:', error);
      setErrors({ general: t('timeClock.errors.deleteFailed') });
    }
  };

  // Handle uploading proof to existing time entry
  const handleUploadProof = async (entryId, file) => {
    if (!file) return;

    setUploadingProofId(entryId);
    setUploadProgress({ [file.name]: 0 });
    
    try {
      const result = await timeTrackingService.updateTimeEntryProof(
        entryId, 
        file, 
        user?.id,
        (percent) => {
          // Update progress
          setUploadProgress({ [file.name]: percent });
        }
      );
      
      if (result.success) {
        // Clear progress after completion
        setTimeout(() => {
          setUploadProgress({});
        }, 2000);
        
        // Update the time entry in local state
        setTimeEntries(prevEntries =>
          prevEntries.map(entry =>
            entry.id === entryId
              ? {
                  ...entry,
                  proof_file_url: result.data.proof_file_url,
                  proof_file_name: result.data.proof_file_name,
                  proof_file_type: result.data.proof_file_type,
                  proof_file_path: result.data.proof_file_path
                }
              : entry
          )
        );

        // Show success toast
        setUploadToast({
          show: true,
          message: t('timeClock.proofUploadSuccess', 'Proof file uploaded successfully'),
          type: 'success'
        });
        setTimeout(() => setUploadToast({ show: false, message: '', type: '' }), 3000);
      } else {
        // Clear progress on error
        setUploadProgress({});
        
        // Show error toast
        setUploadToast({
          show: true,
          message: result.error || t('timeClock.proofUploadError', 'Failed to upload proof file'),
          type: 'error'
        });
        setTimeout(() => setUploadToast({ show: false, message: '', type: '' }), 5000);
      }
    } catch (error) {
      console.error('Error uploading proof:', error);
      setUploadToast({
        show: true,
        message: t('timeClock.proofUploadError', 'Failed to upload proof file'),
        type: 'error'
      });
      setTimeout(() => setUploadToast({ show: false, message: '', type: '' }), 5000);
    } finally {
      setUploadingProofId(null);
    }
  };
  
  // Check if user can approve based on role and entry owner
  const canApprove = (entry) => {
    if (!user || !user.role) return false;
    
    // Get entry owner's role (assume from entry data or default to employee)
    const entryOwnerRole = entry.employee_role || 'employee';
    
    // Admin can approve anyone
    if (user.role === 'admin') return true;
    
    // Manager can approve employees only
    if (user.role === 'manager' && entryOwnerRole === 'employee') return true;
    
    // Employee cannot approve
    return false;
  };
  
  // Handle approval of time entry
  // Handle approval of time entry
  const handleApprove = async (entryId) => {
    setApprovingEntryId(entryId);
    
    try {
      const approverId = user?.employee_id || user?.id;
      const result = await timeTrackingService.updateTimeEntryStatus(entryId, 'approved', approverId);
      
      if (result.success) {
        // Update local state
        setTimeEntries(prevEntries =>
          prevEntries.map(entry =>
            entry.id === entryId
              ? { ...entry, status: 'approved' }
              : entry
          )
        );
        
        setUploadToast({
          show: true,
          message: t('timeClock.approvalSuccess', 'Time entry approved successfully'),
          type: 'success'
        });
        setTimeout(() => setUploadToast({ show: false, message: '', type: '' }), 3000);
      } else {
        setUploadToast({
          show: true,
          message: result.error || t('timeClock.approvalError', 'Failed to approve entry'),
          type: 'error'
        });
        setTimeout(() => setUploadToast({ show: false, message: '', type: '' }), 5000);
      }
    } catch (error) {
      console.error('Error approving entry:', error);
      setUploadToast({
        show: true,
        message: t('timeClock.approvalError', 'Failed to approve entry'),
        type: 'error'
      });
      setTimeout(() => setUploadToast({ show: false, message: '', type: '' }), 5000);
    } finally {
      setApprovingEntryId(null);
    }
  };

  // Calculate totals (including pending and approved time entries)
  const calculateTotals = (filterType = 'all', period = 'week') => {
    if (!Array.isArray(timeEntries)) return 0;
    
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);

    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // Count pending and approved entries
    return timeEntries.reduce((acc, entry) => {
      const entryDate = new Date(entry.date);
      
      // Filter by period
      if (period === 'week' && entryDate < startOfWeek) return acc;
      if (period === 'month' && entryDate < startOfMonth) return acc;

      // Include pending and approved entries (not rejected)
      if (entry.status === 'rejected') return acc;

      // Filter by type (using hour_type from Supabase)
      const entryType = entry.hour_type || entry.hourType;
      if (filterType === 'all' || entryType === filterType) {
        acc += parseFloat(entry.hours || 0);
      }

      return acc;
    }, 0);
  };
  
  // Calculate leave days (including pending and approved)
  const calculateLeaveDays = (period = 'week') => {
    if (!Array.isArray(leaveRequests)) return 0;
    
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);

    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    return leaveRequests.reduce((acc, req) => {
      const startDate = new Date(req.start_date);
      
      // Filter by period
      if (period === 'week' && startDate < startOfWeek) return acc;
      if (period === 'month' && startDate < startOfMonth) return acc;

      // Include pending and approved (not rejected)
      if (req.status === 'rejected') return acc;

      acc += parseFloat(req.days_count || 0);
      return acc;
    }, 0);
  };

  const hourTypes = [
    { value: 'regular', label: t('timeClock.hourTypes.regular'), color: 'blue' },
    { value: 'holiday', label: t('timeClock.hourTypes.holiday'), color: 'purple' },
    { value: 'weekend', label: t('timeClock.hourTypes.weekend'), color: 'green' },
    { value: 'bonus', label: t('timeClock.hourTypes.bonus'), color: 'yellow' }
  ];

  const getStatusColor = (status) => {
    switch (status) {
      case 'approved': return `text-green-800 bg-green-200 ${isDarkMode ? 'bg-green-900/30 text-green-400' : ''} font-semibold`;
      case 'rejected': return `text-red-800 bg-red-200 ${isDarkMode ? 'bg-red-900/30 text-red-400' : ''} font-semibold`;
      default: return `text-yellow-800 bg-yellow-200 ${isDarkMode ? 'bg-yellow-900/30 text-yellow-400' : ''} font-semibold`;
    }
  };

  return (
    <div key={currentLanguage} className="space-y-6 max-w-[1600px] w-full mx-auto">
      {/* Loading Overlay */}
      {loading && (
        <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
          <div className={`${bg.secondary} rounded-lg p-6 flex items-center space-x-3`}>
            <Loader className="w-6 h-6 animate-spin text-blue-600" />
            <span className={text.primary}>{t('common.loading', 'Loading...')}</span>
          </div>
        </div>
      )}

      {/* Toast Notification for Upload */}
      {uploadToast.show && (
        <div className="fixed top-4 right-4 z-50 animate-fade-in">
          <div className={`
            rounded-lg p-4 shadow-lg flex items-center space-x-3
            ${uploadToast.type === 'success' 
              ? `${isDarkMode ? 'bg-green-900/30' : 'bg-green-100'} border-l-4 border-green-600` 
              : `${isDarkMode ? 'bg-red-900/30' : 'bg-red-100'} border-l-4 border-red-600`}
          `}>
            {uploadToast.type === 'success' ? (
              <Check className={`w-5 h-5 ${isDarkMode ? 'text-green-400' : 'text-green-600'}`} />
            ) : (
              <AlertCircle className={`w-5 h-5 ${isDarkMode ? 'text-red-400' : 'text-red-600'}`} />
            )}
            <span className={`
              font-medium
              ${uploadToast.type === 'success' 
                ? `${isDarkMode ? 'text-green-200' : 'text-green-800'}` 
                : `${isDarkMode ? 'text-red-200' : 'text-red-800'}`}
            `}>
              {uploadToast.message}
            </span>
          </div>
        </div>
      )}
      
        <style>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .animate-fade-in {
          animation: fadeIn 0.3s ease-out;
        }

        #clock-in-input::-webkit-calendar-picker-indicator,
        #clock-out-input::-webkit-calendar-picker-indicator,
        #date-input::-webkit-calendar-picker-indicator {
            opacity: 0;
            position: absolute; 
            width: 100%;
            height: 100%;
            top: 0;
            left: 0;
            cursor: pointer;
            z-index: 2;
            background: transparent;
        }

        #date-input, #clock-in-input, #clock-out-input {
            -webkit-appearance: none;
            -moz-appearance: none;
            appearance: none;
        }

        #notes-textarea::placeholder,
        #notes-textarea::-webkit-input-placeholder {
            color: ${isDarkMode ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.45)'};
            font-style: italic;
            opacity: 1; 
        }
        
        /* Firefox requires the 'moz' prefix */
        #notes-textarea::-moz-placeholder {
            color: ${isDarkMode ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.45)'};
            font-style: italic;
            opacity: 1;
        }

        /* IE/Edge require the 'ms' prefix */
        #notes-textarea:-ms-input-placeholder {
            color: ${isDarkMode ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.45)'};
            font-style: italic;
            opacity: 1;
        }
      `}</style>
      {/* Header */}
      <div>
        <h1 className={`text-3xl font-bold ${text.primary}`}>
          {t('timeClock.title')}
        </h1>
        <p className={`${text.secondary} mt-2`}>
          {t('timeClock.subtitle')}
        </p>
      </div>

      {/* Admin Time Entry Section (Only for admin/manager roles) */}
      <AdminTimeEntry />

      {/* Success Message */}
      {successMessage && (
        <div className={`p-4 ${isDarkMode ? 'bg-green-900/30 border-green-700' : 'bg-green-100 border-green-400'} border rounded-lg flex items-center space-x-2`}>
          <Check className={`w-5 h-5 ${isDarkMode ? 'text-green-400' : 'text-green-600'}`} />
          <span className={isDarkMode ? 'text-green-400' : 'text-green-700'}>{successMessage}</span>
        </div>
      )}

      {/* General Error */}
      {errors.general && (
        <div className={`p-4 ${isDarkMode ? 'bg-red-900/30 border-red-700' : 'bg-red-100 border-red-400'} border rounded-lg flex items-center space-x-2`}>
          <AlertCircle className={`w-5 h-5 ${isDarkMode ? 'text-red-400' : 'text-red-600'}`} />
          <span className={isDarkMode ? 'text-red-400' : 'text-red-700'}>{errors.general}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* New Entry Form */}
        <div className="lg:col-span-2">
          <div className={`${bg.secondary} rounded-lg shadow-lg p-6 ${border.primary}`}>
            <h2 className={`text-xl font-semibold ${text.primary} mb-6 flex items-center`}>
              <AlarmClockPlus className="w-5 h-5 mr-2" />
              {t('timeClock.newEntry')}
            </h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Date */}
              <label 
                htmlFor="date-input" 
                className={`block text-sm font-medium ${isDarkMode ? 'text-white' : 'text-gray-700'} mb-2`}
                >
                {t('timeClock.selectDate', 'Select Date')}
                </label>
                
                <div className="relative">
                <input
                    id="date-input"
                    type="date"
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    max={new Date().toISOString().split('T')[0]}
                    
                    className={`
                    w-full px-4 py-2 
                    rounded-lg border 
                    ${bg.primary}
                    ${input.className} 
                    ${isDarkMode ? 'text-white bg-gray-700 border-gray-600' : 'text-gray-900 bg-white border-gray-300'} 
                    ${errors.date ? 'border-red-500' : ''}
                    pr-10 appearance-none 
                    `}
                />
                <CalendarClock className={`absolute top-1/2 right-3 transform -translate-y-1/2 pointer-events-none w-5 h-5 ${text.secondary}`} />
                </div>
                
                {errors.date && (
                <p className="mt-1 text-sm text-red-500">{errors.date}</p>
                )}

              {/* Clock In/Out Times */}
              <div>
              <label htmlFor="clock-in-input" className={`block text-sm font-medium ${isDarkMode ? 'text-white' : 'text-gray-700'} mb-2`}>
                {t('timeClock.clockIn')}
              </label>
              
              <div className="relative">
                <input
                  id="clock-in-input"
                  type="time"
                  value={formData.clockIn}
                  onChange={(e) => setFormData({ ...formData, clockIn: e.target.value })}
                  className={`
                    w-full px-4 py-2 rounded-lg border 
                    ${bg.primary}
                    ${input.className} 
                    ${isDarkMode ? 'text-white bg-gray-700 border-gray-600' : 'text-gray-900 bg-white border-gray-300'} 
                    ${errors.clockIn ? 'border-red-500' : ''}
                    pr-10 appearance-none
                  `}
                />
                <Clock className={`absolute top-1/2 right-3 transform rotate-270 -translate-y-1/2 pointer-events-none w-5 h-5 ${text.secondary}`} />
              </div>
              {errors.clockIn && <p className="text-red-500 text-sm mt-1">{errors.clockIn}</p>}
            </div>

            {/* Clock Out */}
            <div>
              <label htmlFor="clock-out-input" className={`block text-sm font-medium ${isDarkMode ? 'text-white' : 'text-gray-700'} mb-2`}>
                {t('timeClock.clockOut')}
              </label>
              
              <div className="relative">
                <input
                  id="clock-out-input"
                  type="time"
                  value={formData.clockOut}
                  onChange={(e) => setFormData({ ...formData, clockOut: e.target.value })}
                  className={`
                    w-full px-4 py-2 rounded-lg border 
                    ${bg.primary}
                    ${input.className} 
                    ${isDarkMode ? 'text-white bg-gray-700 border-gray-600' : 'text-gray-900 bg-white border-gray-300'} 
                    ${errors.clockOut ? 'border-red-500' : ''}
                    pr-10 appearance-none
                  `}
                />
                <Clock className={`absolute top-1/2 right-3 transform -translate-y-1/2 pointer-events-none w-5 h-5 ${text.secondary}`} />
              </div>
              {errors.clockOut && <p className="text-red-500 text-sm mt-1">{errors.clockOut}</p>}
            </div>

              {/* Hour Type */}
              <div>
                <label className={`block text-sm font-medium ${isDarkMode ? 'text-white' : 'text-black'} mb-2`}>
                  {t('timeClock.hourType')}
                </label>
                <div className="relative w-full">
                    <select
                        value={formData.hourType}
                        onChange={(e) => setFormData({ ...formData, hourType: e.target.value })}
                        className={`
                            w-full px-4 py-2 rounded-lg border
                            ${bg.primary}
                            ${text.primary}
                            ${border.primary}
                            focus:ring-2 focus:ring-blue-500 focus:border-transparent                        
                            pr-10
                        `}
                    >
                        {hourTypes.map(type => (
                            <option key={type.value} value={type.value}>{type.label}</option>
                        ))}
                    </select>
                    <ChevronsUpDown className={`absolute top-1/2 right-4 transform -translate-y-1/2 pointer-events-none h-6 w-6 ${isDarkMode ? 'text-white' : 'text-gray-800'}`} />
                </div>
              </div>

              {/* File Upload */}
              <div>
                <label 
                    htmlFor="proof-file-upload"
                    className={`
                        block text-sm font-medium mb-2
                        ${isDarkMode ? 'text-white' : 'text-black'} 
                        cursor-pointer
                        w-full px-4 py-2 
                        rounded-lg border 
                        text-left
                        z-1
                    `}
                >
                   <div className="flex items-center">
                    <motion.div
                        initial="rest" 
                        whileHover="hover" 
                        variants={uploadVariants}
                        className="flex items-center"
                    >
                      <Upload className="w-6 h-6 mr-6 p-0.5 border-2 border-dashed border-gray-500" />
                    </motion.div>
                    {t('timeClock.proof')}
                    <span className="text-sm text-gray-500 ml-3">
                        ({t('timeClock.optional')})
                    </span>
                </div>
                </label>

                <input
                    id="proof-file-upload"
                    type="file"
                    accept=".jpg,.jpeg,.png,.pdf"
                    onChange={handleFileChange}
                    className="sr-only"
                />
                {errors.proofFile && <p className="text-red-500 text-sm mt-1">{errors.proofFile}</p>}
            </div>

              {/* Notes */}
              <div>
                <label className={`block text-sm font-medium ${isDarkMode ? 'text-white' : 'text-black'} mb-2`}>
                  {t('timeClock.notes')}
                  <span className="text-sm text-gray-500 ml-2">
                    ({t('timeClock.optional')})
                  </span>
                </label>
                <textarea
                  id="notes-textarea"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows="3"
                  placeholder={t('timeClock.notesPlaceholder')}
                  className={`${bg.primary} w-full px-4 py-2 rounded-lg border ${input.className} ${isDarkMode ? 'text-white' : 'text-black'}`}
                />
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isSubmitting}
                // Add flex, items-center, justify-center, and space-x-2 for icon alignment
                className={`
                    w-full py-3 px-6 rounded-lg font-medium text-white transition-colors 
                    flex items-center justify-center space-x-2 
                    ${isSubmitting
                        ? 'bg-gray-400 cursor-not-allowed'
                        : 'bg-blue-600 hover:bg-blue-700 active:scale-[0.98]'
                    }
                `}
            >
                {isSubmitting ? (
                    // Option 1: Show a loading spinner/icon when submitting
                    <>
                        <Loader2 className="w-5 h-5 animate-spin" /> {/* Example loading icon */}
                        <span>{t('timeClock.submitting')}</span>
                    </>
                ) : (
                    // Option 2: Show the Clock icon when ready to submit
                    <>
                        <Clock className="w-5 h-5" />
                        <span>{t('timeClock.submit')}</span>
                    </>
                )}
            </button>
            </form>
            
            {/* Request Leave Button */}
            <div className={`mt-4 pt-4 border-t ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
              <button
                onClick={() => setShowLeaveModal(true)}
                className="w-full py-3 px-6 rounded-lg font-medium text-white bg-green-600 hover:bg-green-700 active:scale-[0.98] transition-all flex items-center justify-center space-x-2"
              >
                <Calendar className="w-5 h-5" />
                <span>{t('timeClock.requestLeave', 'Request Leave')}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Summary Stats */}
        <div className="space-y-6">
          {/* Weekly Summary */}
          <div className={`${bg.secondary} rounded-lg shadow-lg p-6 ${border.primary}`}>
            <h3 className={`text-lg font-semibold ${text.primary} mb-4`}>
              {t('timeClock.weeklySummary')}
            </h3>
            <div className="space-y-3">
              {hourTypes.map(type => (
                <div key={type.value} className="flex justify-between items-center">
                  <span className={`text-sm ${text.secondary}`}>{type.label}</span>
                  <span className={`font-semibold ${text.primary}`}>
                    {calculateTotals(type.value, 'week').toFixed(1)} {t('timeClock.hrs')}
                  </span>
                </div>
              ))}
              <div className={`pt-3 border-t ${border.primary} flex justify-between items-center`}>
                <span className={`font-semibold ${text.primary}`}>
                  {t('timeClock.total')}
                </span>
                <span className={`font-bold text-lg ${text.primary}`}>
                  {calculateTotals('all', 'week').toFixed(1)} {t('timeClock.hrs')}
                </span>
              </div>
            </div>
          </div>

          {/* Monthly Summary */}
          <div className={`${bg.secondary} rounded-lg shadow-lg p-6 ${border.primary}`}>
            <h3 className={`text-lg font-semibold ${text.primary} mb-4`}>
              {t('timeClock.monthlySummary')}
            </h3>
            <div className="space-y-3">
              {hourTypes.map(type => (
                <div key={type.value} className="flex justify-between items-center">
                  <span className={`text-sm ${text.secondary}`}>{type.label}</span>
                  <span className={`font-semibold ${text.primary}`}>
                    {calculateTotals(type.value, 'month').toFixed(1)} {t('timeClock.hrs')}
                  </span>
                </div>
              ))}
              <div className={`pt-3 border-t ${border.primary} flex justify-between items-center`}>
                <span className={`font-semibold ${text.primary}`}>
                  {t('timeClock.total')}
                </span>
                <span className={`font-bold text-lg ${text.primary}`}>
                  {calculateTotals('all', 'month').toFixed(1)} {t('timeClock.hrs')}
                </span>
              </div>
            </div>
          </div>
          
          {/* Leave Days Summary */}
          <div className={`${bg.secondary} rounded-lg shadow-lg p-6 ${border.primary}`}>
            <h3 className={`text-lg font-semibold ${text.primary} mb-4`}>
              {t('timeClock.leaveDays', 'Leave Days')}
            </h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className={`text-sm ${text.secondary}`}>{t('timeClock.thisWeek', 'This Week')}</span>
                <span className={`font-semibold ${text.primary}`}>
                  {calculateLeaveDays('week').toFixed(1)} {t('timeClock.days')}
                </span>
              </div>
              <div className={`pt-3 border-t ${border.primary} flex justify-between items-center`}>
                <span className={`font-semibold ${text.primary}`}>
                  {t('timeClock.thisMonth', 'This Month')}
                </span>
                <span className={`font-bold text-lg ${text.primary}`}>
                  {calculateLeaveDays('month').toFixed(1)} {t('timeClock.days')}
                </span>
              </div>
              <div className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'} mt-2`}>
                {t('timeClock.includesPending', '* Includes pending & approved')}
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Time Entries History */}
      <div className={`${bg.secondary} rounded-lg shadow-lg p-6 ${border.primary}`}>
        <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
          <h2 className={`text-xl text-center font-semibold ${text.primary} flex items-center`}>
            <Clock className="w-6 h-6 mr-2" />
            {t('timeClock.history', 'Time Entry History')}
          </h2>
          
          {/* Debug: Show user role */}
          {user && (
            <div className="text-xs text-gray-500">
              Role: {user.role || 'No role'} | Can Manage: {canManageTimeTracking ? 'Yes' : 'No'}
            </div>
          )}
          
          {/* Employee Filter Dropdown (only for admin/manager) */}
          {canManageTimeTracking && (
            <div className="flex items-center gap-3">
              <label className={`text-sm font-medium ${text.primary}`}>
                {t('timeClock.viewEntries', 'View Entries')}:
              </label>
              <div className="relative">
                <select
                  value={selectedEmployeeFilter}
                  onChange={(e) => {
                    setSelectedEmployeeFilter(e.target.value);
                    // Refetch entries when filter changes
                    setTimeout(() => fetchTimeEntries(), 100);
                  }}
                  className={`
                    px-4 py-2 pr-10 rounded-lg border
                    ${bg.primary}
                    ${text.primary}
                    ${border.primary}
                    focus:ring-2 focus:ring-blue-500 focus:border-transparent
                    min-w-[200px]
                  `}
                >
                  <option value="self">{t('timeClock.myEntries', 'My Entries')}</option>
                  <option value="all">{t('timeClock.allEmployees', 'All Employees')}</option>
                  {Array.isArray(allEmployees) && allEmployees.length > 0 && (
                    <optgroup label={t('timeClock.specificEmployee', 'Specific Employee')}>
                      {allEmployees.map(emp => (
                        <option key={emp.id} value={emp.id}>
                          {emp.name} - {emp.position}
                        </option>
                      ))}
                    </optgroup>
                  )}
                </select>
                <ChevronsUpDown className={`absolute top-1/2 right-3 transform -translate-y-1/2 pointer-events-none h-5 w-5 ${isDarkMode ? 'text-white' : 'text-gray-800'}`} />
              </div>
            </div>
          )}
        </div>

        {!Array.isArray(filteredEntries) || filteredEntries.length === 0 ? (
          <div className="text-center py-12">
            <Clock className={`w-16 h-16 mx-auto ${text.secondary} opacity-50 mb-4`} />
            <p className={`${text.secondary}`}>
              {t('timeClock.noEntries')}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
              <table className="w-full items-center table-auto border-collapse">
                <thead className="text-center">
                  <tr className={`border-b ${border.primary}`}>
                    <th className={`text-center p-3 ${text.primary} font-semibold`}>
                      {t('timeClock.date', 'Date')}
                    </th>
                    {/* Show Name column only when NOT viewing "My Entries" */}
                    {selectedEmployeeFilter !== 'self' && (
                      <th className={`text-center p-3 ${text.primary} font-semibold`}>
                        {t('timeClock.employee', 'Employee')}
                      </th>
                    )}
                    <th className={`text-center p-3 ${text.primary} font-semibold`}>
                      {t('timeClock.time', 'Time')}
                    </th>
                    <th className={`text-center p-3 ${text.primary} font-semibold`}>
                      {t('timeClock.hours', 'Hours')}
                    </th>
                  <th className={`text-center p-3 ${text.primary} font-semibold`}>
                    {t('timeClock.type', 'Type')}
                  </th>
                  <th className={`text-center p-3 ${text.primary} font-semibold`}>
                    {t('timeClock.status', 'Status')}
                  </th>
                  <th className={`text-center p-3 ${text.primary} font-semibold`}>
                    {t('timeClock.proof', 'Proof')}
                  </th>
                  <th className={`text-center p-3 ${text.primary} font-semibold`}>
                    {t('timeClock.actions', 'Actions')}
                  </th>
                </tr>
              </thead>
              <tbody className="text-center">
                {filteredEntries.map((entry, index) => (
                  <tr key={entry.id} className={`border-b ${border.primary} ${isDarkMode ? 'hover:bg-gray-800' : 'hover:bg-blue-600'} group transition-colors cursor-pointer`}>
                    <td className={`p-3 ${text.primary} text-center hover:text-white font-medium group-hover:text-white `}>
                      {entry.date || new Date(entry.created_at).toLocaleDateString()}
                    </td>
                    
                    {selectedEmployeeFilter !== 'self' && (
                      <td className={`p-3 ${text.primary} text-center hover:text-white font-medium group-hover:text-white`}>
                        {entry.employee_name || 'N/A'}
                      </td>
                    )}
                    <td className={`p-3 ${text.secondary} group-hover:text-white`}>
                      {entry.clock_in || entry.clockIn} - {entry.clock_out || entry.clockOut}
                    </td>
                    <td className={`p-3 ${text.primary} font-semibold group-hover:text-white`}>
                      {entry.hours} {t('timeClock.hrs')}
                    </td>
                    <td className="p-3">
                      <span className={`px-2 py-1 rounded text-xs font-semibold ${
                        (entry.hour_type || entry.hourType) === 'regular' ? (isDarkMode ? 'bg-blue-900/30 text-blue-400' : 'bg-blue-200 text-blue-900') :
                        (entry.hour_type || entry.hourType) === 'holiday' ? (isDarkMode ? 'bg-purple-900/30 text-purple-400' : 'bg-purple-200 text-purple-900') :
                        (entry.hour_type || entry.hourType) === 'weekend' ? (isDarkMode ? 'bg-green-900/30 text-green-400' : 'bg-green-200 text-green-900') :
                        (isDarkMode ? 'bg-yellow-900/30 text-yellow-400' : 'bg-yellow-200 text-yellow-900')
                      }`}>
                        {hourTypes.find(t => t.value === (entry.hour_type || entry.hourType))?.label}
                      </span>
                    </td>
                    <td className="p-3">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(entry.status)}`}>
                        {entry.status.charAt(0).toUpperCase() + entry.status.slice(1)}
                      </span>
                    </td>
                    <td className="p-3">
                      <div className="flex items-center justify-center gap-2">
                        {(entry.proof_file_url || entry.proofFile) ? (
                          entry.proof_file_url ? (
                            isImageFile(entry.proof_file_type, entry.proof_file_url) ? (
                              // Image preview button
                              <button
                                type="button"
                                className="inline-flex cursor-pointer hover:scale-110 transition-transform"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setImagePreview({ show: true, url: entry.proof_file_url });
                                }}
                                aria-label="View proof image"
                                title={t('timeClock.viewProof', 'View proof image')}
                                onMouseEnter={(e) => {
                                  const el = e.currentTarget.querySelector('svg');
                                  if (el) {
                                    el.style.animation = 'pingOnce .25s ease-in-out 1';
                                    el.onanimationend = () => (el.style.animation = '');
                                  }
                                }}
                              >
                                <FileText className={`w-5 h-5 ${isDarkMode ? 'text-green-200' : 'text-green-600'} group-hover:text-white transition-all duration-500`} />
                              </button>
                            ) : (
                              // Use regular link for PDFs and other files
                              <a 
                                href={entry.proof_file_url} 
                                target="_blank" 
                                rel="noopener noreferrer" 
                                className="inline-flex hover:scale-110 transition-transform"
                                onClick={(e) => e.stopPropagation()}
                                title={t('timeClock.downloadProof', 'Download proof file')}
                              >
                                <FileText className={`w-5 h-5 ${isDarkMode ? 'text-green-200' : 'text-green-600'} group-hover:text-white transition-all duration-500 hover:bg-gray-900`} />
                              </a>
                            )
                          ) : (
                            <FileText className={`w-5 h-5 ${isDarkMode ? 'text-green-200' : 'text-green-600'} group-hover:text-white transition-all duration-500 hover:bg-gray-900`} />
                          )
                        ) : (
                          <span className={`text-xs ${text.secondary} group-hover:text-white`}></span>
                        )}
                        
                        {/* Upload button for entries without proof */}
                        {!entry.proof_file_url && (
                          <div className="flex items-center gap-2">
                            <label 
                              htmlFor={`proof-upload-${entry.id}`}
                              className="cursor-pointer inline-flex items-center"
                              onClick={(e) => e.stopPropagation()}
                              title={t('timeClock.uploadProof', 'Upload proof file')}
                              onMouseEnter={(e) => {
                                  const el = e.currentTarget.querySelector('svg');
                                  if (el) {
                                    el.style.animation = 'bounceOnce 1.25s ease-in-out 1';
                                    el.onanimationend = () => (el.style.animation = '');
                                  }
                                }}
                            >
                              {uploadingProofId === entry.id ? (
                                <div className="flex items-center gap-2">
                                  <Loader className={`w-4 h-4 ${isDarkMode ? 'text-blue-400' : 'text-blue-600'} group-hover:text-white animate-spin`} />
                                  {Object.values(uploadProgress)[0] > 0 && Object.values(uploadProgress)[0] < 100 && (
                                    <span className={`text-xs ${isDarkMode ? 'text-blue-400' : 'text-blue-600'} font-medium`}>
                                      {Object.values(uploadProgress)[0]}%
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <Upload className={`w-5 h-5 mr-1.75 ${isDarkMode ? 'text-blue-100' : 'text-blue-600'} transform transition-all duration-500 group-hover:text-white`} />
                              )}
                              <input
                                id={`proof-upload-${entry.id}`}
                                type="file"
                                accept="image/*,application/pdf,.doc,.docx,.txt"
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) {
                                    handleUploadProof(entry.id, file);
                                    e.target.value = ''; // Reset input
                                  }
                                }}
                                className="hidden"
                                disabled={uploadingProofId === entry.id}
                              />
                            </label>
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="p-3 text-center">
                      <div className="flex items-center justify-center gap-2">
                        {/* Approve Button (only for pending entries and if user has permission) */}
                        {entry.status === 'pending' && canApprove(entry) && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleApprove(entry.id);
                            }}
                            disabled={approvingEntryId === entry.id}
                            className={`${isDarkMode ? 'text-green-200' : 'text-green-600'} hover:scale-110 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-500`}
                            title={t('timeClock.approve', 'Approve')}
                            onMouseEnter={(e) => {
                              const el = e.currentTarget.querySelector('svg');
                              if (el) {
                                el.style.animation = 'pulseOnce 1.5s ease-in-out 1';
                                el.onanimationend = () => (el.style.animation = '');
                              }
                            }}
                          >
                            {approvingEntryId === entry.id ? (
                              <Loader2 className="w-5 h-5 animate-spin" />
                            ) : (
                              <Check className={`w-5 h-5 ${isDarkMode ? 'text-green-200' : 'text-green-600'} group-hover:text-white transition-all duration-500 hover:bg-gray-900 rounded-2xl`} />
                            )}
                          </button>
                        )}
                        
                        {/* Delete Button */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(entry.id, entry);
                          }}
                          className={`${isDarkMode ? 'text-red-400' : 'text-red-600'} group-hover:text-white transition-all duration-500 hover:scale-110`}
                          title={entry.proof_file_url ? t('timeClock.deleteOptions', 'Delete options') : t('timeClock.delete', 'Delete')}
                          onMouseEnter={(e) => {
                            const el = e.currentTarget.querySelector('svg');
                            if (el) {
                              el.style.animation = 'spinOnce 1.5s ease-in-out 1';
                              el.onanimationend = () => (el.style.animation = '');
                            }
                          }}
                        >
                          <X className="w-5 h-5 hover:bg-gray-900 rounded-2xl" />
                        </button>

                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Image Preview Modal */}
      {imagePreview.show && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm"
          onClick={() => setImagePreview({ show: false, url: '' })}
        >
          <div 
            className={`relative max-w-7xl max-h-[90vh] ${isDarkMode ? 'bg-gray-800' : 'bg-white'} rounded-lg shadow-2xl overflow-hidden`}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setImagePreview({ show: false, url: '' })}
              className="absolute top-4 right-4 z-10 p-2 bg-black/50 hover:bg-black/70 text-white rounded-full transition-colors"
              aria-label="Close preview"
            >
              <X className="w-6 h-6" />
            </button>
            <div className="p-4">
              <img
                src={imagePreview.url}
                alt="Proof Preview"
                className="max-w-full max-h-[80vh] rounded-lg object-contain"
                style={{
                  boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                }}
                onError={(e) => {
                  console.error('Failed to load image:', imagePreview.url);
                  e.target.style.display = 'none';
                  const errorDiv = e.target.nextElementSibling;
                  if (errorDiv) errorDiv.style.display = 'block';
                }}
              />
              <div 
                style={{ 
                  display: 'none', 
                  textAlign: 'center',
                  padding: '2rem'
                }}
                className={isDarkMode ? 'text-gray-400' : 'text-gray-600'}
              >
                <p className="text-lg font-medium">Failed to load image</p>
                <p className="text-sm mt-2">The image may be corrupted or in an unsupported format.</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TimeClockEntry;
