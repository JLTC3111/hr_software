import React, { useState, useEffect } from 'react';
import { Clock, UserPlus, Save, X, Search, AlertCircle, Calendar, LogIn, LogOut, Check, Upload, FileText, ChevronsUpDown, Users } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import * as timeTrackingService from '../services/timeTrackingService';
import { supabase } from '../config/supabaseClient';

const AdminTimeEntry = () => {
  const { isDarkMode, bg, text, border } = useTheme();
  const { t } = useLanguage();
  const { user, checkPermission } = useAuth();

  const [employees, setEmployees] = useState([]);
  const [selectedEmployees, setSelectedEmployees] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [processedEmployeeIds, setProcessedEmployeeIds] = useState([]); // Track employees who've had entries created

  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    clockIn: '',
    clockOut: '',
    hourType: 'regular',
    notes: '',
    proofFile: null
  });

  // Check if user has permission
  const canManageTimeTracking = checkPermission('canManageTimeTracking');

  useEffect(() => {
    if (canManageTimeTracking) {
      fetchEmployees();
    }
  }, [canManageTimeTracking]);

  const fetchEmployees = async () => {
    try {
      const { data, error } = await supabase
        .from('employees')
        .select('id, name, email, position, department, status')
        // Don't filter by status - allow admins to manage time entries for all employees (including inactive/terminated)
        .order('name');

      if (error) throw error;
      setEmployees(data || []);
    } catch (error) {
      console.error('Error fetching employees:', error);
      setErrorMessage(t('adminTimeEntry.errorLoadEmployees', 'Failed to load employees'));
    }
  };

  // Handle file upload
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Check file size (max 50MB to match service configuration)
      if (file.size > 50 * 1024 * 1024) {
        setErrorMessage(t('timeClock.errors.fileTooLarge', 'File size must be less than 50MB'));
        return;
      }

      // Check file type
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/bmp', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain'];
      if (!allowedTypes.includes(file.type)) {
        setErrorMessage(t('timeClock.errors.invalidFileType', 'Only images, PDF, and document files are allowed'));
        return;
      }

      // Convert to base64 for storage
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData({ ...formData, proofFile: { name: file.name, type: file.type, data: reader.result } });
        setErrorMessage('');
      };
      reader.readAsDataURL(file);
    }
  };

  // Remove uploaded file
  const handleRemoveFile = () => {
    setFormData({ ...formData, proofFile: null });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    console.log('Submit - Selected employees:', selectedEmployees);
    
    if (selectedEmployees.length === 0) {
      setErrorMessage(t('adminTimeEntry.selectAtLeastOne', 'Please select at least one employee'));
      return;
    }

    if (!formData.clockIn || !formData.clockOut) {
      setErrorMessage('Please enter both clock in and clock out times');
      return;
    }

    setLoading(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      // Format times as HH:MM:SS for PostgreSQL time type
      const clockInTime = `${formData.clockIn}:00`;
      const clockOutTime = `${formData.clockOut}:00`;

      // Calculate hours using Date objects for validation
      const clockInDate = new Date(`${formData.date}T${formData.clockIn}`);
      const clockOutDate = new Date(`${formData.date}T${formData.clockOut}`);
      const diffMs = clockOutDate - clockInDate;
      const hours = diffMs / (1000 * 60 * 60);

      if (hours <= 0) {
        setErrorMessage('Clock out time must be after clock in time');
        setLoading(false);
        return;
      }

      // Upload proof file if exists (will be shared across all entries)
      let proofFileUrl = null;
      let proofFileName = null;
      let proofFileType = null;
      let proofFilePath = null;
      
      if (formData.proofFile) {
        // Convert base64 back to file for upload
        const base64Data = formData.proofFile.data;
        const byteCharacters = atob(base64Data.split(',')[1]);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        
        // Create File object - use first employee's ID for upload
        const file = new File([byteArray], formData.proofFile.name, { 
          type: formData.proofFile.type,
          lastModified: Date.now()
        });
        
        const uploadResult = await timeTrackingService.uploadProofFile(file, selectedEmployees[0].id);
        if (uploadResult.success) {
          proofFileUrl = uploadResult.url;
          proofFileName = uploadResult.fileName;
          proofFileType = uploadResult.fileType;
          proofFilePath = uploadResult.storagePath;
        } else {
          setErrorMessage(`Failed to upload proof file: ${uploadResult.error}`);
          setLoading(false);
          return;
        }
      }

      // Check for existing entries for the selected employees on this date with the same hour type
      const employeeIds = selectedEmployees.map(e => e.id);
      const { data: existingEntries, error: checkError } = await supabase
        .from('time_entries')
        .select('employee_id, date, hour_type')
        .in('employee_id', employeeIds)
        .eq('date', formData.date)
        .eq('hour_type', formData.hourType);
      
      if (checkError) {
        console.error('Error checking existing entries:', checkError);
        setErrorMessage(t('adminTimeEntry.errors.checkFailed', 'Failed to check for existing entries'));
        setLoading(false);
        return;
      }
      
      // Filter out employees who already have entries for this date with the same hour type
      const existingEmployeeIds = new Set(existingEntries.map(e => e.employee_id));
      const employeesWithoutEntries = selectedEmployees.filter(emp => !existingEmployeeIds.has(emp.id));
      const employeesWithEntries = selectedEmployees.filter(emp => existingEmployeeIds.has(emp.id));
      
      // If all employees already have entries for this hour type, show error
      if (employeesWithoutEntries.length === 0) {
        const names = employeesWithEntries.map(e => e.name).join(', ');
        const hourTypeLabel = t(`adminTimeEntry.hourTypes.${formData.hourType}`, formData.hourType);
        setErrorMessage(t('adminTimeEntry.errors.allDuplicates', 'All selected employees already have {hourType} time entries for {date}: {names}').replace('{hourType}', hourTypeLabel).replace('{date}', formData.date).replace('{names}', names));
        setLoading(false);
        return;
      }
      
      // Show warning if some employees already have entries for this hour type
      if (employeesWithEntries.length > 0) {
        const names = employeesWithEntries.map(e => e.name).join(', ');
        console.log(`Skipping employees with existing ${formData.hourType} entries: ${names}`);
      }
      
      // Create entries only for employees without existing entries
      const entries = employeesWithoutEntries.map(emp => ({
        employeeId: emp.id,
        date: formData.date,
        clockIn: clockInTime,
        clockOut: clockOutTime,
        hours: parseFloat(hours.toFixed(2)),
        hourType: formData.hourType,
        notes: formData.notes || `Entered by admin: ${user.full_name || user.email}`,
        status: 'approved', // Admin entries are auto-approved
        proofFileUrl,
        proofFileName,
        proofFileType,
        proofFilePath
      }));

      console.log('Submitting entries:', entries);
      const result = await timeTrackingService.createBulkTimeEntries(entries);
      console.log('Result from service:', result);

      if (result.success) {
        const processedNames = employeesWithoutEntries.map(e => e.name).join(', ');
        const processedIds = employeesWithoutEntries.map(e => e.id);
        const hourTypeLabel = t(`adminTimeEntry.hourTypes.${formData.hourType}`, formData.hourType);
        
        let message = employeesWithoutEntries.length === 1 
          ? `${hourTypeLabel} ${t('adminTimeEntry.entryAddedSuccess', 'time entry added successfully for')} ${processedNames}`
          : `${hourTypeLabel} ${t('adminTimeEntry.entriesAddedSuccess', 'time entries added successfully for')} ${employeesWithoutEntries.length} ${t('adminTimeEntry.employees', 'employees')}: ${processedNames}`;
        
        // Add warning about skipped employees if any
        if (employeesWithEntries.length > 0) {
          const skippedNames = employeesWithEntries.map(e => e.name).join(', ');
          message += ` (${t('adminTimeEntry.skippedEmployees', 'Skipped {count} employee(s) with existing {hourType} entries: {names}').replace('{count}', employeesWithEntries.length).replace('{hourType}', hourTypeLabel).replace('{names}', skippedNames)})`;
        }
        
        setSuccessMessage(message);
        
        // Track processed employees to prevent re-selection
        setProcessedEmployeeIds(prev => [...prev, ...processedIds]);
        
        // Reset form
        setFormData({
          date: new Date().toISOString().split('T')[0],
          clockIn: '',
          clockOut: '',
          hourType: 'regular',
          notes: '',
          proofFile: null
        });
        setSelectedEmployees([]);
        setSearchTerm('');
      } else {
        console.error('Service returned error:', result.error);
        setErrorMessage(result.error || 'Failed to create time entries');
      }
    } catch (error) {
      console.error('Error submitting time entries:', error);
      console.error('Error details:', error.message, error.stack);
      setErrorMessage(`Failed to submit time entries: ${error.message || error.toString()}`);
    } finally {
      setLoading(false);
    }
  };

  const toggleEmployeeSelection = (employee) => {
    setSelectedEmployees(prev => {
      const isSelected = prev.some(e => e.id === employee.id);
      return isSelected 
        ? prev.filter(e => e.id !== employee.id)
        : [...prev, employee];
    });
  };

  const removeEmployee = (employeeId) => {
    setSelectedEmployees(prev => prev.filter(e => e.id !== employeeId));
  };

  // Filter out employees who have already had entries created in this session
  const filteredEmployees = employees.filter(emp => {
    // Don't show employees that were already processed in this session
    if (processedEmployeeIds.includes(emp.id)) return false;
    
    // Don't show employees that are already selected
    if (selectedEmployees.some(e => e.id === emp.id)) return false;
    
    // Apply search filter
    return (
      emp.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emp.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emp.position?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  });

  if (!canManageTimeTracking) {
    return (
      <div className={`${bg.secondary} rounded-lg shadow-sm border ${border.primary} p-6`}>
        <div className={`flex items-center space-x-3 ${isDarkMode ? 'text-red-400' : 'text-red-600'}`}>
          <AlertCircle className="w-6 h-6" />
          <p className="font-medium">{t('adminTimeEntry.accessDenied', 'Access Denied: You don\'t have permission to manage time entries for other employees.')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`${bg.secondary} rounded-lg shadow-sm border ${border.primary} p-6`}>
      <div className="flex items-center space-x-3 mb-6">
        <UserPlus className={`w-6 h-6 ${isDarkMode ? 'text-white' : 'text-black'}`} />
        <h3 className={`text-xl font-bold ${text.primary}`}>
          {t('adminTimeEntry.title', 'Admin Time Entry')}
        </h3>
      </div>

      <p className={`${text.secondary} mb-6`}>
        {t('adminTimeEntry.description', 'Enter time entries for employees (Admin/Manager only)')}
      </p>

      {/* Success Message */}
      {successMessage && (
        <div className={`mb-4 p-4 border rounded-lg flex items-center space-x-2 ${isDarkMode ? 'bg-green-900 border-green-700' : 'bg-green-50 border-green-200'}`}>
          <Check className={`w-5 h-5 ${isDarkMode ? 'text-green-400' : 'text-green-600'}`} />
          <span className={isDarkMode ? 'text-green-200' : 'text-green-800'}>{successMessage}</span>
        </div>
      )}

      {/* Error Message */}
      {errorMessage && (
        <div className={`mb-4 p-4 border rounded-lg flex items-center space-x-2 ${isDarkMode ? 'bg-red-900 border-red-700' : 'bg-red-50 border-red-200'}`}>
          <AlertCircle className={`w-5 h-5 ${isDarkMode ? 'text-red-400' : 'text-red-600'}`} />
          <span className={isDarkMode ? 'text-red-200' : 'text-red-800'}>{errorMessage}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Employee Selection */}
        <div>
          <label className={`block text-sm font-medium ${text.primary} mb-2`}>
            <div className="flex items-center space-x-2">
              <Users className="w-4 h-4" />
              <span>{t('adminTimeEntry.selectEmployees', 'Select Employees')} *</span>
              {selectedEmployees.length > 0 && (
                <span className={`text-xs px-2 py-0.5 rounded-full ${isDarkMode ? 'bg-blue-800 text-blue-200' : 'bg-blue-100 text-blue-800'}`}>
                  {selectedEmployees.length} {t('adminTimeEntry.selected', 'selected')}
                </span>
              )}
            </div>
          </label>
          
          {/* Search Input */}
          <div className="relative mb-2">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder={t('adminTimeEntry.searchEmployees', 'Search employees...')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={`w-full pl-10 pr-4 py-2 border ${border.primary} rounded-lg ${bg.primary} ${text.primary} focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
            />
          </div>

          {/* Employee List */}
          {searchTerm && (
            <div className={`max-h-48 overflow-y-auto border ${border.primary} rounded-lg ${bg.primary}`}>
              {filteredEmployees.length > 0 ? (
                filteredEmployees.map((emp) => {
                  const isSelected = selectedEmployees.some(e => e.id === emp.id);
                  return (
                    <div
                      key={emp.id}
                      onClick={() => toggleEmployeeSelection(emp)}
                      className={`p-3 cursor-pointer ${isDarkMode ? 'hover:bg-blue-800' : 'hover:bg-blue-50'} transition-colors ${
                        isSelected ? (isDarkMode ? 'bg-blue-800' : 'bg-blue-100') : ''
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className={`font-medium ${text.primary}`}>{emp.name}</div>
                          <div className={`text-sm ${text.secondary}`}>
                            {t(`employeePosition.${emp.position}`, emp.position)} • {t(`departments.${emp.department}`, emp.department)}
                          </div>
                        </div>
                        {isSelected && (
                          <Check className={`w-5 h-5 ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`} />
                        )}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className={`p-4 text-center ${text.secondary}`}>{t('adminTimeEntry.noEmployees', 'No employees found')}</div>
              )}
            </div>
          )}

          {/* Selected Employees Display */}
          {selectedEmployees.length > 0 && (
            <div className={`mt-2 space-y-2`}>
              <div className={`text-sm font-medium ${text.primary} flex items-center space-x-2`}>
                <span>{t('adminTimeEntry.selectedEmployees', 'Selected Employees')}:</span>
                <span className={`text-xs px-2 py-0.5 rounded-full ${isDarkMode ? 'bg-green-800 text-green-200' : 'bg-green-100 text-green-800'}`}>
                  {selectedEmployees.length} {selectedEmployees.length === 1 ? 'employee' : 'employees'}
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {selectedEmployees.map((emp) => (
                  <div
                    key={emp.id}
                    className={`px-3 py-1.5 border ${border.primary} rounded-lg ${bg.primary} flex items-center space-x-2`}
                  >
                    <div>
                      <div className={`text-sm font-medium ${text.primary}`}>{emp.name}</div>
                      <div className={`text-xs ${text.secondary}`}>
                        {t(`employeePosition.${emp.position}`, emp.position)} • {t(`departments.${emp.department}`, emp.department)}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeEmployee(emp.id)}
                      className={`transition-colors ${isDarkMode ? 'text-red-400 hover:text-red-300' : 'text-red-600 hover:text-red-800'}`}
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Date */}
        <div>
          <label className={`block text-sm font-medium ${text.primary} mb-2`}>
            {t('adminTimeEntry.date', 'Date')} *
          </label>
          <div className="relative">
            <input
              id="admin-date-input"
              type="date"
              value={formData.date}
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              max={new Date().toISOString().split('T')[0]}
              className={`w-full px-4 py-2 pr-12 border ${border.primary} rounded-lg ${bg.primary} ${text.primary} focus:ring-2 focus:ring-blue-500 focus:border-transparent [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:right-3 [&::-webkit-calendar-picker-indicator]:w-5 [&::-webkit-calendar-picker-indicator]:h-5 [&::-webkit-calendar-picker-indicator]:cursor-pointer`}
              required
            />
            <Calendar className={`absolute right-3 top-1/2 transform -translate-y-1/2 w-5 h-5 ${text.secondary} pointer-events-none`} />
          </div>
        </div>

        {/* Clock In & Clock Out */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={`block text-sm font-medium ${text.primary} mb-2`}>
              {t('adminTimeEntry.clockIn', 'Clock In')} *
            </label>
            <div 
              className="relative cursor-pointer"
              onClick={() => document.getElementById('admin-clockin-input').showPicker?.()}
            >
              <input
                id="admin-clockin-input"
                type="time"
                value={formData.clockIn}
                onChange={(e) => setFormData({ ...formData, clockIn: e.target.value })}
                className={`w-full px-4 py-2 pr-12 border ${border.primary} rounded-lg ${bg.primary} ${text.primary} focus:ring-2 focus:ring-blue-500 focus:border-transparent cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:right-3 [&::-webkit-calendar-picker-indicator]:w-5 [&::-webkit-calendar-picker-indicator]:h-5 [&::-webkit-calendar-picker-indicator]:cursor-pointer`}
                required
              />
              <LogIn className={`absolute right-3 top-1/2 transform -translate-y-1/2 rotate-180 w-5 h-5 ${text.secondary} pointer-events-none`} />
            </div>
          </div>
          <div>
            <label className={`block text-sm font-medium ${text.primary} mb-2`}>
              {t('adminTimeEntry.clockOut', 'Clock Out')} *
            </label>
            <div 
              className="relative cursor-pointer"
              onClick={() => document.getElementById('admin-clockout-input').showPicker?.()}
            >
              <input
                id="admin-clockout-input"
                type="time"
                value={formData.clockOut}
                onChange={(e) => setFormData({ ...formData, clockOut: e.target.value })}
                className={`w-full px-4 py-2 pr-12 border ${border.primary} rounded-lg ${bg.primary} ${text.primary} focus:ring-2 focus:ring-blue-500 focus:border-transparent cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:right-3 [&::-webkit-calendar-picker-indicator]:w-5 [&::-webkit-calendar-picker-indicator]:h-5 [&::-webkit-calendar-picker-indicator]:cursor-pointer`}
                required
              />
              <LogOut className={`absolute right-3 top-1/2 transform -translate-y-1/2 w-5 h-5 ${text.secondary} pointer-events-none`} />
            </div>
          </div>
        </div>

        {/* Hour Type */}
        <div className="relative w-full">
          <label className={`block text-sm font-medium ${text.primary} mb-2`}>
            {t('adminTimeEntry.hourType', 'Hour Type')} *
          </label>
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
            <option value="regular">{t('adminTimeEntry.regularHours', 'Regular Hours')}</option>
            <option value="weekend">{t('adminTimeEntry.weekendOvertime', 'Weekend/Overtime')}</option>
            <option value="holiday">{t('adminTimeEntry.holiday', 'Holiday')}</option>
            <option value="bonus">{t('adminTimeEntry.bonusHours', 'Bonus Hours')}</option>
          </select>
          <ChevronsUpDown className={`absolute top-[70%] right-3 transform -translate-y-1/2 pointer-events-none h-6 w-6 ${isDarkMode ? 'text-white' : 'text-gray-800'}`} />
        </div>

        {/* Notes */}
        <div>
          <label className={`block text-sm font-medium ${text.primary} mb-2`}>
            {t('adminTimeEntry.notes', 'Notes')} ({t('timeClock.optional', 'Optional')})
          </label>
          <textarea
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            rows={3}
            placeholder={t('adminTimeEntry.notesPlaceholder', 'Add any notes about this time entry...')}
            className={`w-full px-4 py-2 border ${border.primary} rounded-lg ${bg.primary} ${text.primary} focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
          />
        </div>

        {/* Proof of Work File Upload */}
        <div>
          <label className={`block text-sm font-medium ${text.primary} mb-2`}>
            {t('timeClock.proof', 'Proof of Work')} ({t('timeClock.optional', 'Optional')})
          </label>
          
          {!formData.proofFile ? (
            <div className={`border-2 border-dashed ${border.primary} rounded-lg p-6 text-center hover:border-blue-500 transition-colors`}>
              <input
                type="file"
                id="admin-proof-file"
                accept="image/*,application/pdf,.doc,.docx,.txt"
                onChange={handleFileChange}
                className="hidden"
              />
              <label
                htmlFor="admin-proof-file"
                className="cursor-pointer flex flex-col items-center"
              >
                <Upload className={`w-8 h-8 ${text.secondary} mb-2`} />
                <span className={`text-sm ${text.primary} font-medium`}>
                  {t('timeClock.uploadFile', 'Click to upload proof of work')}
                </span>
                <span className={`text-xs ${text.secondary} mt-1`}>
                  {t('timeClock.fileTypes', 'Supports: Images, PDF, Documents (Max 50MB)')}
                </span>
              </label>
            </div>
          ) : (
            <div className={`border ${border.primary} rounded-lg p-4 flex items-center justify-between ${bg.primary}`}>
              <div className="flex items-center space-x-3">
                <FileText className={`w-5 h-5 ${isDarkMode ? 'text-green-400' : 'text-green-600'}`} />
                <div>
                  <div className={`text-sm font-medium ${text.primary}`}>{formData.proofFile.name}</div>
                  <div className={`text-xs ${text.secondary}`}>
                    {(formData.proofFile.data.length / 1024 / 1024).toFixed(2)} MB
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={handleRemoveFile}
                className={`transition-colors ${isDarkMode ? 'text-red-400 hover:text-red-300' : 'text-red-600 hover:text-red-800'}`}
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          )}
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={loading || selectedEmployees.length === 0}
          className={`w-full flex items-center justify-center space-x-2 px-6 py-3 text-white rounded-lg transition-colors shadow-lg hover:shadow-xl ${
            isDarkMode 
              ? 'bg-blue-700 hover:bg-blue-600 disabled:bg-gray-600' 
              : 'bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400'
          } disabled:cursor-not-allowed`}
        >
          {loading ? (
            <>
              <Clock className="w-5 h-5 animate-spin" />
              <span>{t('adminTimeEntry.submitting', 'Submitting...')}</span>
            </>
          ) : (
            <>
              <Save className="w-5 h-5" />
              <span>
                {selectedEmployees.length > 1 
                  ? `${t('adminTimeEntry.submitBulkEntries', 'Submit Entries for {0} Employees').replace('{0}', selectedEmployees.length)}`
                  : t('adminTimeEntry.submitButton', 'Submit Time Entry')
                }
              </span>
            </>
          )}
        </button>
      </form>
    </div>
  );
};

export default AdminTimeEntry;
