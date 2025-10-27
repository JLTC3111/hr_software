import React, { useState, useEffect } from 'react';
import { Clock, Upload, Calendar, AlertCircle, Check, X, FileText, Download, Loader } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import * as timeTrackingService from '../services/timeTrackingService';

const TimeClockEntry = ({ currentLanguage }) => {
  const { isDarkMode, bg, text, button, input, border } = useTheme();
  const { t } = useLanguage();
  const { user } = useAuth();

  // Form state
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    clockIn: '',
    clockOut: '',
    hourType: 'regular',
    notes: '',
    proofFile: null
  });

  // Time entries state
  const [timeEntries, setTimeEntries] = useState([]);
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showLeaveModal, setShowLeaveModal] = useState(false);

  const [errors, setErrors] = useState({});
  const [successMessage, setSuccessMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Leave request form
  const [leaveForm, setLeaveForm] = useState({
    type: 'vacation',
    startDate: '',
    endDate: '',
    reason: ''
  });

  // Fetch time entries and leave requests from Supabase
  useEffect(() => {
    const fetchTimeEntries = async () => {
      if (!user?.id) return;
      
      setLoading(true);
      try {
        // Use employeeId from user profile to link with employees table
        const employeeId = user.employeeId || user.id;
        const result = await timeTrackingService.getTimeEntries(employeeId);
        if (result.success) {
          setTimeEntries(result.data || []);
        }
        
        // Fetch leave requests (including pending)
        const leaveResult = await timeTrackingService.getLeaveRequests(employeeId, {
          year: new Date().getFullYear()
        });
        if (leaveResult.success) {
          setLeaveRequests(leaveResult.data || []);
        }
      } catch (error) {
        console.error('Error fetching time entries:', error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchTimeEntries();
  }, [user]);

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

  const CustomCalendarIcon = ({ className, isDarkMode }) => {
    const outlineFill = isDarkMode ? '#F5F5F5' : '#45484C'; 
    
    const innerDetailFill = isDarkMode ? '#1F2937' : '#FFFFFF';
    
    const secondaryFill = isDarkMode ? '#FF8C66' : '#FFB89A';
    const accentFill = isDarkMode ? '#4DCB95' : '#33CC99';

        return (
            <svg 
                width="23.5px" 
                height="23.5px" 
                viewBox="0 0 1024 1024" 
                className={className} 
                version="1.1" 
                xmlns="http://www.w3.org/2000/svg"
            >
                <path d="M897.9 369.2H205c-33.8 0-61.4-27.6-61.4-61.4s27.6-61.4 61.4-61.4h692.9c33.8 0 61.4 27.6 61.4 61.4s-27.6 61.4-61.4 61.4z" fill={secondaryFill} />
                
                <path d="M807 171H703.3c-16.6 0-30 13.4-30 30s13.4 30 30 30H807c31.6 0 57.4 24 57.4 53.4v42.3H125.2v-42.3c0-29.5 25.7-53.4 57.4-53.4H293c16.6 0 30-13.4 30-30s-13.4-30-30-30H182.5c-64.7 0-117.4 50.9-117.4 113.4v527.7c0 62.5 52.7 113.4 117.4 113.4H807c64.7 0 117.4-50.9 117.4-113.4V284.5c0-62.6-52.7-113.5-117.4-113.5z m0 694.6H182.5c-31.6 0-57.4-24-57.4-53.4V386.8h739.2v425.4c0.1 29.5-25.7 53.4-57.3 53.4z" fill={outlineFill} />
                
                <path d="M447.6 217.1c-12.4-6.1-27-2.8-35.7 7.1-2.2-6.7-4-16.2-4-28.1 0-13 2.2-23 4.6-29.8 9.5 8.1 23.5 9.6 34.9 2.8 14.2-8.5 18.8-27 10.3-41.2-15.5-25.9-35.9-29.7-46.6-29.7-36.6 0-63.1 41.2-63.1 97.8s26.4 98 63.1 98c20.6 0 39-13.4 50.4-36.7 7.3-14.9 1.1-32.9-13.8-40.2zM635.9 218.5c-12.4-6.1-27-2.8-35.7 7.1-2.2-6.7-4-16.2-4-28.1 0-13 2.2-23 4.6-29.8 9.5 8.1 23.5 9.6 34.9 2.8 14.2-8.5 18.8-27 10.3-41.2-15.5-25.9-35.9-29.7-46.6-29.7-36.6 0-63.1 41.2-63.1 97.8s26.5 97.8 63.1 97.8c20.6 0 39-13.4 50.4-36.7 7.1-14.7 0.9-32.7-13.9-40z" fill={outlineFill} />
                
                <path d="M700.2 514.5H200.5c-16.6 0-30 13.4-30 30s13.4 30 30 30h499.7c16.6 0 30-13.4 30-30s-13.5-30-30-30zM668.4 689.8h-74c-16.6 0-30 13.4-30 30s13.4 30 30 30h74c16.6 0 30-13.4 30-30s-13.4-30-30-30zM479.3 689.8H200.5c-16.6 0-30 13.4-30 30s13.4 30 30 30h278.8c16.6 0 30-13.4 30-30s-13.4-30-30-30z" fill={accentFill} />
            </svg>
        );
    };

  const CustomClockIcon = ({ className }) => {
    const outlineFill = isDarkMode ? '#F5F5F5' : '#45484C'; 

    return (
        <svg width="22.5px" height="22.5px"
        viewBox="0 0 450 450.001" 
        xmlns="http://www.w3.org/2000/svg" 
        fill="currentColor" 
        className={className}
        stroke="currentColor" >
        
            <path 
                d="M317.688,204.447c-67.547,0-122.501,54.953-122.501,122.498c0,67.548,54.954,122.501,122.501,122.501 s122.499-54.953,122.499-122.501C440.188,259.4,385.234,204.447,317.688,204.447z M317.688,417.542 c-49.954,0-90.595-40.641-90.595-90.597c0-49.954,40.641-90.596,90.595-90.596c49.955,0,90.597,40.642,90.597,90.596 C408.285,376.901,367.643,417.542,317.688,417.542z"
                fill={outlineFill}
            />
            <path 
                d="M317.603,249.295c-8.138,0-14.758,6.616-14.758,14.748v48.145h-29.36c-8.13,0-14.742,6.621-14.742,14.758 s6.612,14.755,14.742,14.755h44.118c8.139,0,14.759-6.618,14.759-14.755v-62.901C332.361,255.912,325.741,249.295,317.603,249.295 z"
                fill={outlineFill}
            />
            <path 
                d="M238.887,181.527c0-8.563-6.941-15.506-15.505-15.506c-20.161,0-30.705-11.269-44.055-25.535 c-9.412-10.058-19.145-20.46-32.983-27.099l-20.287-9.529l-7.896-6.725c-0.541-0.462-1.341-0.429-1.844,0.078l-12.509,12.568 c-0.507,0.523-0.368,1.275-0.368,1.275l12.14,81.42c0.076,0.545-0.079,1.095-0.427,1.521l-11.484,14.031 c-0.375,0.459-0.935,0.723-1.525,0.723s-1.15-0.264-1.524-0.723l-11.483-14.031c-0.349-0.426-0.503-0.976-0.428-1.521 l12.115-81.42c0,0,0.137-0.752-0.369-1.275L87.947,97.211c-0.504-0.507-1.304-0.54-1.845-0.078l-7.896,6.725l-21.267,10.111 c-31.131,15.814-36.663,59.643-43.036,110.325c-1.213,9.647-2.468,19.624-3.923,29.546c-1.242,8.475,4.619,16.35,13.092,17.592 c0.763,0.111,1.521,0.166,2.27,0.166c7.567,0,14.191-5.547,15.322-13.258c1.501-10.24,2.775-20.373,4.008-30.174 c2.334-18.558,4.71-37.406,8.397-52.899l0.016,65.858c0,8.436,2.963,15.949,7.741,22.227l0.011,167.972 c0,10.315,8.363,18.678,18.68,18.678s18.679-8.363,18.678-18.68l-0.008-148.078c1.327,0.11,2.648,0.176,3.957,0.176 c1.308,0,2.629-0.063,3.957-0.176l-0.002,148.078c-0.001,10.315,8.361,18.68,18.679,18.68c10.315,0,18.679-8.363,18.679-18.68 l0.002-167.97c4.778-6.276,7.742-13.791,7.742-22.227l0.022-85.218c1.812,1.868,3.624,3.804,5.461,5.768 c14.741,15.752,33.086,35.357,66.699,35.357C231.945,197.033,238.887,190.091,238.887,181.527z"
                fill={outlineFill}
            />
            <path 
                d="M102.143,95.888c22.682,0,39.611-21.136,39.995-56.577C142.382,14.717,130.671,0,102.143,0 C73.613,0,61.9,14.717,62.147,39.311C62.529,74.752,79.458,95.888,102.143,95.888z"
                fill={outlineFill}
            />
        </svg>
        );
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
      
      if (formData.proofFile) {
        // Convert base64 back to file for upload
        const base64Data = formData.proofFile.data;
        const byteCharacters = atob(base64Data.split(',')[1]);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const file = new File([byteArray], formData.proofFile.name, { type: formData.proofFile.type });
        
        const uploadResult = await timeTrackingService.uploadProofFile(file, user?.id);
        if (uploadResult.success) {
          proofFileUrl = uploadResult.url;
          proofFileName = uploadResult.fileName;
          proofFileType = uploadResult.fileType;
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
        proofFileType
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

  // Delete entry
  const handleDelete = async (id) => {
    if (window.confirm(t('timeClock.confirmDelete'))) {
      try {
        const result = await timeTrackingService.deleteTimeEntry(id);
        if (result.success) {
          setTimeEntries(timeEntries.filter(entry => entry.id !== id));
          setSuccessMessage(t('timeClock.deleteSuccess', 'Time entry deleted successfully'));
          setTimeout(() => setSuccessMessage(''), 3000);
        } else {
          setErrors({ general: t('timeClock.errors.deleteFailed') });
        }
      } catch (error) {
        console.error('Error deleting time entry:', error);
        setErrors({ general: t('timeClock.errors.deleteFailed') });
      }
    }
  };

  // Calculate totals (including pending and approved time entries)
  const calculateTotals = (filterType = 'all', period = 'week') => {
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
      case 'approved': return 'text-green-800 bg-green-200 dark:bg-green-900/30 dark:text-green-400 font-semibold';
      case 'rejected': return 'text-red-800 bg-red-200 dark:bg-red-900/30 dark:text-red-400 font-semibold';
      default: return 'text-yellow-800 bg-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400 font-semibold';
    }
  };

  return (
    <div key={currentLanguage} className="space-y-6 max-w-[1480px] w-full mx-auto">
      {/* Loading Overlay */}
      {loading && (
        <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
          <div className={`${bg.secondary} rounded-lg p-6 flex items-center space-x-3`}>
            <Loader className="w-6 h-6 animate-spin text-blue-600" />
            <span className={text.primary}>{t('common.loading', 'Loading...')}</span>
          </div>
        </div>
      )} 
        <style>{`
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

      {/* Success Message */}
      {successMessage && (
        <div className="p-4 bg-green-100 dark:bg-green-900/30 border border-green-400 dark:border-green-700 rounded-lg flex items-center space-x-2">
          <Check className="w-5 h-5 text-green-600 dark:text-green-400" />
          <span className="text-green-700 dark:text-green-400">{successMessage}</span>
        </div>
      )}

      {/* General Error */}
      {errors.general && (
        <div className="p-4 bg-red-100 dark:bg-red-900/30 border border-red-400 dark:border-red-700 rounded-lg flex items-center space-x-2">
          <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
          <span className="text-red-700 dark:text-red-400">{errors.general}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Entry Form */}
        <div className="lg:col-span-2">
          <div className={`${bg.secondary} rounded-lg shadow-lg p-6 ${border.primary}`}>
            <h2 className={`text-xl font-semibold ${text.primary} mb-6 flex items-center`}>
              <Clock className="w-5 h-5 mr-2" />
              {t('timeClock.newEntry')}
            </h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Date */}
              <label 
                htmlFor="date-input" 
                className={`block text-sm font-medium ${isDarkMode ? 'text-white' : 'text-gray-700'} mb-2`}
                >
                Select Date 
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
                    ${input.className} 
                    ${isDarkMode ? 'text-white bg-gray-700 border-gray-600' : 'text-gray-900 bg-white border-gray-300'} 
                    ${errors.date ? 'border-red-500' : ''}
                    pr-10 appearance-none 
                    `}
                />
                <CustomCalendarIcon 
                    className="absolute top-1/2 right-3 transform -translate-y-1/2 pointer-events-none" 
                    isDarkMode={isDarkMode}
                />
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
                    ${input.className} 
                    ${isDarkMode ? 'text-white bg-gray-700 border-gray-600' : 'text-gray-900 bg-white border-gray-300'} 
                    ${errors.clockIn ? 'border-red-500' : ''}
                    pr-10 appearance-none
                  `}
                />
                <CustomClockIcon 
                  isDarkMode={isDarkMode}
                  className="absolute top-1/2 right-3 transform -translate-y-1/2 pointer-events-none scale-x-[-1]" 
                />
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
                    ${input.className} 
                    ${isDarkMode ? 'text-white bg-gray-700 border-gray-600' : 'text-gray-900 bg-white border-gray-300'} 
                    ${errors.clockOut ? 'border-red-500' : ''}
                    pr-10 appearance-none
                  `}
                />
                <CustomClockIcon 
                  isDarkMode={isDarkMode}
                  className="absolute top-1/2 right-3 transform -translate-y-1/2 pointer-events-none" 
                />
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
                            ${input.className} 
                            ${isDarkMode ? 'text-white' : 'text-black'}
                            cursor-pointer
                            appearance-none 
                            pr-10 
                        `}
                    >
                        {hourTypes.map(type => (
                            <option key={type.value} value={type.value}>{type.label}</option>
                        ))}
                    </select>
                    
                    <div className={`
                        pointer-events-none 
                        absolute inset-y-0 right-0 
                        flex items-center 
                        mr-4
                    `}>
                        <svg 
                            className={`h-5 w-5 ${isDarkMode ? 'text-gray-100' : 'text-gray-900'}`} 
                            xmlns="http://www.w3.org/2000/svg" 
                            viewBox="0 0 20 20" 
                            fill="currentColor"
                        >
                            <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.25 4.25a.75.75 0 01-1.06 0L5.21 8.27a.75.75 0 01.02-1.06z" clipRule="evenodd" />
                        </svg>
                    </div>
                </div>
              </div>

              {/* File Upload */}
              <div>
                <label 
                    htmlFor="proof-file-upload"
                    className={`
                        block text-sm font-medium mb-2
                        ${isDarkMode ? 'bg-transparent text-white' : 'bg-transparent text-black'} 
                        cursor-pointer
                        
                        w-full px-4 py-2 
                        rounded-lg border 
                        text-left
                    `}
                >
                    <Upload className="w-4 h-4 inline mb-1 mr-2" />
                    {t('timeClock.proof')}
                    <span className="text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-500'} ml-2">
                        ({t('timeClock.optional')})
                    </span>
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
                  className={`w-full px-4 py-2 rounded-lg border ${input.className} ${isDarkMode ? 'text-white' : 'text-black'}`}
                />
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isSubmitting}
                className={`w-full py-3 px-6 rounded-lg font-medium text-white transition-colors ${
                  isSubmitting
                    ? 'bg-gray-400 cursor-not-allowed'
                    : 'bg-blue-600 hover:bg-blue-700 active:scale-[0.98]'
                }`}
              >
                {isSubmitting
                  ? t('timeClock.submitting')
                  : t('timeClock.submit')}
              </button>
            </form>
            
            {/* Request Leave Button */}
            <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
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
                    {calculateTotals(type.value, 'week').toFixed(1)} hrs
                  </span>
                </div>
              ))}
              <div className={`pt-3 border-t ${border.primary} flex justify-between items-center`}>
                <span className={`font-semibold ${text.primary}`}>
                  {t('timeClock.total')}
                </span>
                <span className={`font-bold text-lg ${text.primary}`}>
                  {calculateTotals('all', 'week').toFixed(1)} hrs
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
                    {calculateTotals(type.value, 'month').toFixed(1)} hrs
                  </span>
                </div>
              ))}
              <div className={`pt-3 border-t ${border.primary} flex justify-between items-center`}>
                <span className={`font-semibold ${text.primary}`}>
                  {t('timeClock.total')}
                </span>
                <span className={`font-bold text-lg ${text.primary}`}>
                  {calculateTotals('all', 'month').toFixed(1)} hrs
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
                  {calculateLeaveDays('week').toFixed(1)} days
                </span>
              </div>
              <div className={`pt-3 border-t ${border.primary} flex justify-between items-center`}>
                <span className={`font-semibold ${text.primary}`}>
                  {t('timeClock.thisMonth', 'This Month')}
                </span>
                <span className={`font-bold text-lg ${text.primary}`}>
                  {calculateLeaveDays('month').toFixed(1)} days
                </span>
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                {t('timeClock.includesPending', '* Includes pending & approved')}
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Leave Request Modal */}
      {showLeaveModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className={`${bg.secondary} rounded-lg shadow-xl max-w-md w-full p-6`}>
            <div className="flex justify-between items-center mb-4">
              <h3 className={`text-xl font-semibold ${text.primary}`}>
                {t('timeClock.requestLeave', 'Request Leave')}
              </h3>
              <button onClick={() => setShowLeaveModal(false)} className={`${text.secondary} hover:${text.primary}`}>
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={async (e) => {
              e.preventDefault();
              setIsSubmitting(true);
              
              try {
                const employeeId = user.employeeId || user.id;
                const result = await timeTrackingService.createLeaveRequest({
                  employeeId: employeeId,
                  type: leaveForm.type,
                  startDate: leaveForm.startDate,
                  endDate: leaveForm.endDate,
                  reason: leaveForm.reason
                });
                
                if (result.success) {
                  setSuccessMessage(t('timeClock.leaveSuccess', 'Leave request submitted successfully!'));
                  setShowLeaveModal(false);
                  
                  // Refresh leave requests
                  const leaveResult = await timeTrackingService.getLeaveRequests(employeeId, {
                    year: new Date().getFullYear()
                  });
                  if (leaveResult.success) {
                    setLeaveRequests(leaveResult.data || []);
                  }
                  
                  // Reset form
                  setLeaveForm({
                    type: 'vacation',
                    startDate: '',
                    endDate: '',
                    reason: ''
                  });
                  
                  setTimeout(() => setSuccessMessage(''), 3000);
                } else {
                  setErrors({ general: result.error || t('timeClock.leaveError', 'Error submitting leave request') });
                }
              } catch (error) {
                console.error('Error submitting leave:', error);
                setErrors({ general: t('timeClock.leaveError', 'Error submitting leave request') });
              } finally {
                setIsSubmitting(false);
              }
            }} className="space-y-4">
              <div>
                <label className={`block text-sm font-medium ${text.primary} mb-2`}>
                  {t('timeClock.leaveType', 'Leave Type')}
                </label>
                <select
                  value={leaveForm.type}
                  onChange={(e) => setLeaveForm({ ...leaveForm, type: e.target.value })}
                  required
                  className={`w-full px-4 py-2 rounded-lg border ${input.className}`}
                >
                  <option value="vacation">{t('timeClock.vacation', 'Vacation')}</option>
                  <option value="sick">{t('timeClock.sick', 'Sick Leave')}</option>
                  <option value="personal">{t('timeClock.personal', 'Personal')}</option>
                  <option value="unpaid">{t('timeClock.unpaid', 'Unpaid Leave')}</option>
                </select>
              </div>

              <div>
                <label className={`block text-sm font-medium ${text.primary} mb-2`}>
                  {t('timeClock.startDate', 'Start Date')}
                </label>
                <input
                  type="date"
                  value={leaveForm.startDate}
                  onChange={(e) => setLeaveForm({ ...leaveForm, startDate: e.target.value })}
                  min={new Date().toISOString().split('T')[0]}
                  required
                  className={`w-full px-4 py-2 rounded-lg border ${input.className}`}
                />
              </div>

              <div>
                <label className={`block text-sm font-medium ${text.primary} mb-2`}>
                  {t('timeClock.endDate', 'End Date')}
                </label>
                <input
                  type="date"
                  value={leaveForm.endDate}
                  onChange={(e) => setLeaveForm({ ...leaveForm, endDate: e.target.value })}
                  min={leaveForm.startDate || new Date().toISOString().split('T')[0]}
                  required
                  className={`w-full px-4 py-2 rounded-lg border ${input.className}`}
                />
              </div>

              <div>
                <label className={`block text-sm font-medium ${text.primary} mb-2`}>
                  {t('timeClock.reason', 'Reason')}
                </label>
                <textarea
                  value={leaveForm.reason}
                  onChange={(e) => setLeaveForm({ ...leaveForm, reason: e.target.value })}
                  rows="3"
                  placeholder={t('timeClock.leaveReason', 'Brief reason for leave...')}
                  className={`w-full px-4 py-2 rounded-lg border ${input.className}`}
                />
              </div>

              <div className="flex space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowLeaveModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  {t('common.cancel', 'Cancel')}
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className={`flex-1 px-4 py-2 rounded-lg transition-colors ${
                    isSubmitting
                      ? 'bg-gray-400 cursor-not-allowed text-white'
                      : 'bg-green-600 hover:bg-green-700 text-white'
                  }`}
                >
                  {isSubmitting ? t('common.submitting', 'Submitting...') : t('common.submit', 'Submit Request')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Time Entries History */}
      <div className={`${bg.secondary} rounded-lg shadow-lg p-6 ${border.primary}`}>
        <h2 className={`text-xl font-semibold ${text.primary} mb-6`}>
          {t('timeClock.history')}
        </h2>

        {timeEntries.length === 0 ? (
          <div className="text-center py-12">
            <Clock className={`w-16 h-16 mx-auto ${text.secondary} opacity-50 mb-4`} />
            <p className={`${text.secondary}`}>
              {t('timeClock.noEntries')}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className={`border-b ${border.primary}`}>
                  <th className={`text-left p-3 ${text.primary} font-semibold`}>
                    {t('timeClock.date', 'Date')}
                  </th>
                  <th className={`text-left p-3 ${text.primary} font-semibold`}>
                    {t('timeClock.time', 'Time')}
                  </th>
                  <th className={`text-left p-3 ${text.primary} font-semibold`}>
                    {t('timeClock.hours', 'Hours')}
                  </th>
                  <th className={`text-left p-3 ${text.primary} font-semibold`}>
                    {t('timeClock.type', 'Type')}
                  </th>
                  <th className={`text-left p-3 ${text.primary} font-semibold`}>
                    {t('timeClock.status', 'Status')}
                  </th>
                  <th className={`text-left p-3 ${text.primary} font-semibold`}>
                    {t('timeClock.proof', 'Proof')}
                  </th>
                  <th className={`text-right p-3 ${text.primary} font-semibold`}>
                    {t('timeClock.actions', 'Actions')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {timeEntries.map(entry => (
                  <tr key={entry.id} className={`border-b ${border.primary} hover:bg-blue-600 dark:hover:bg-gray-800 group transition-colors cursor-pointer`}>
                    <td className={`p-3 ${text.primary} group-hover:text-white`}>
                      {new Date(entry.date).toLocaleDateString()}
                    </td>
                    <td className={`p-3 ${text.secondary} group-hover:text-white`}>
                      {entry.clock_in || entry.clockIn} - {entry.clock_out || entry.clockOut}
                    </td>
                    <td className={`p-3 ${text.primary} font-semibold group-hover:text-white`}>
                      {entry.hours} hrs
                    </td>
                    <td className="p-3">
                      <span className={`px-2 py-1 rounded text-xs font-semibold ${
                        (entry.hour_type || entry.hourType) === 'regular' ? 'bg-blue-200 text-blue-900 dark:bg-blue-900/30 dark:text-blue-400' :
                        (entry.hour_type || entry.hourType) === 'holiday' ? 'bg-purple-200 text-purple-900 dark:bg-purple-900/30 dark:text-purple-400' :
                        (entry.hour_type || entry.hourType) === 'weekend' ? 'bg-green-200 text-green-900 dark:bg-green-900/30 dark:text-green-400' :
                        'bg-yellow-200 text-yellow-900 dark:bg-yellow-900/30 dark:text-yellow-400'
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
                      {(entry.proof_file_url || entry.proofFile) ? (
                        entry.proof_file_url ? (
                          <a href={entry.proof_file_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center">
                            <FileText className="w-5 h-5 text-green-600 dark:text-green-400 group-hover:text-white" />
                          </a>
                        ) : (
                          <FileText className="w-5 h-5 text-green-600 dark:text-green-400 group-hover:text-white" />
                        )
                      ) : (
                        <span className={`text-xs ${text.secondary} group-hover:text-white`}>-</span>
                      )}
                    </td>
                    <td className="p-3 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(entry.id);
                        }}
                        className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 group-hover:text-white"
                        title={t('timeClock.delete', 'Delete')}
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default TimeClockEntry;
