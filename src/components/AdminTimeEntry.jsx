import React, { useState, useEffect } from 'react';
import { Clock, UserPlus, Save, X, Search, AlertCircle, Calendar, LogIn, LogOut, Check } from 'lucide-react';
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
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    clockIn: '',
    clockOut: '',
    hourType: 'regular',
    notes: ''
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
        .in('status', ['Active', 'active'])
        .order('name');

      if (error) throw error;
      setEmployees(data || []);
    } catch (error) {
      console.error('Error fetching employees:', error);
      setErrorMessage(t('adminTimeEntry.errorLoadEmployees', 'Failed to load employees'));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!selectedEmployee) {
      setErrorMessage('Please select an employee');
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

      const entry = {
        employeeId: selectedEmployee.id,
        date: formData.date,
        clockIn: clockInTime,
        clockOut: clockOutTime,
        hours: parseFloat(hours.toFixed(2)),
        hourType: formData.hourType,
        notes: formData.notes || `Entered by admin: ${user.full_name || user.email}`,
        status: 'approved' // Admin entries are auto-approved
      };

      const result = await timeTrackingService.createTimeEntry(entry);

      if (result.success) {
        setSuccessMessage(`Time entry added successfully for ${selectedEmployee.name}`);
        // Reset form
        setFormData({
          date: new Date().toISOString().split('T')[0],
          clockIn: '',
          clockOut: '',
          hourType: 'regular',
          notes: ''
        });
        setSelectedEmployee(null);
        setSearchTerm('');
      } else {
        setErrorMessage(result.error || 'Failed to create time entry');
      }
    } catch (error) {
      console.error('Error submitting time entry:', error);
      setErrorMessage('Failed to submit time entry');
    } finally {
      setLoading(false);
    }
  };

  const filteredEmployees = employees.filter(emp =>
    emp.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    emp.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    emp.position?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (!canManageTimeTracking) {
    return (
      <div className={`${bg.secondary} rounded-lg shadow-sm border ${border.primary} p-6`}>
        <div className="flex items-center space-x-3 text-red-600 dark:text-red-400">
          <AlertCircle className="w-6 h-6" />
          <p className="font-medium">{t('adminTimeEntry.accessDenied', 'Access Denied: You don\'t have permission to manage time entries for other employees.')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`${bg.secondary} rounded-lg shadow-sm border ${border.primary} p-6`}>
      <div className="flex items-center space-x-3 mb-6">
        <UserPlus className="w-6 h-6 text-blue-600 dark:text-blue-400" />
        <h3 className={`text-xl font-bold ${text.primary}`}>
          {t('adminTimeEntry.title', 'Admin Time Entry')}
        </h3>
      </div>

      <p className={`${text.secondary} mb-6`}>
        {t('adminTimeEntry.description', 'Enter time entries for employees (Admin/Manager only)')}
      </p>

      {/* Success Message */}
      {successMessage && (
        <div className="mb-4 p-4 bg-green-50 dark:bg-green-900 border border-green-200 dark:border-green-700 rounded-lg flex items-center space-x-2">
          <Check className="w-5 h-5 text-green-600 dark:text-green-400" />
          <span className="text-green-800 dark:text-green-200">{successMessage}</span>
        </div>
      )}

      {/* Error Message */}
      {errorMessage && (
        <div className="mb-4 p-4 bg-red-50 dark:bg-red-900 border border-red-200 dark:border-red-700 rounded-lg flex items-center space-x-2">
          <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
          <span className="text-red-800 dark:text-red-200">{errorMessage}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Employee Selection */}
        <div>
          <label className={`block text-sm font-medium ${text.primary} mb-2`}>
            {t('adminTimeEntry.selectEmployee', 'Select Employee')} *
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
                filteredEmployees.map((emp) => (
                  <div
                    key={emp.id}
                    onClick={() => {
                      setSelectedEmployee(emp);
                      setSearchTerm('');
                    }}
                    className={`p-3 cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-900 transition-colors ${
                      selectedEmployee?.id === emp.id ? 'bg-blue-100 dark:bg-blue-800' : ''
                    }`}
                  >
                    <div className={`font-medium ${text.primary}`}>{emp.name}</div>
                    <div className={`text-sm ${text.secondary}`}>
                      {emp.position} • {emp.department}
                    </div>
                  </div>
                ))
              ) : (
                <div className={`p-4 text-center ${text.secondary}`}>{t('adminTimeEntry.noEmployees', 'No employees found')}</div>
              )}
            </div>
          )}

          {/* Selected Employee Display */}
          {selectedEmployee && (
            <div className={`mt-2 p-3 border ${border.primary} rounded-lg ${bg.primary} flex justify-between items-center`}>
              <div>
                <div className={`font-medium ${text.primary}`}>{selectedEmployee.name}</div>
                <div className={`text-sm ${text.secondary}`}>
                  {selectedEmployee.position} • {selectedEmployee.department}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedEmployee(null)}
                className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
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
            <div className="relative">
              <input
                id="admin-clockin-input"
                type="time"
                value={formData.clockIn}
                onChange={(e) => setFormData({ ...formData, clockIn: e.target.value })}
                className={`w-full px-4 py-2 pr-12 border ${border.primary} rounded-lg ${bg.primary} ${text.primary} focus:ring-2 focus:ring-blue-500 focus:border-transparent [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:right-3 [&::-webkit-calendar-picker-indicator]:w-5 [&::-webkit-calendar-picker-indicator]:h-5 [&::-webkit-calendar-picker-indicator]:cursor-pointer`}
                required
              />
              <LogIn className={`absolute right-3 top-1/2 transform -translate-y-1/2 w-5 h-5 transform rotate-180 ${text.secondary} pointer-events-none`} />
            </div>
          </div>
          <div>
            <label className={`block text-sm font-medium ${text.primary} mb-2`}>
              {t('adminTimeEntry.clockOut', 'Clock Out')} *
            </label>
            <div className="relative">
              <input
                id="admin-clockout-input"
                type="time"
                value={formData.clockOut}
                onChange={(e) => setFormData({ ...formData, clockOut: e.target.value })}
                className={`w-full px-4 py-2 pr-12 border ${border.primary} rounded-lg ${bg.primary} ${text.primary} focus:ring-2 focus:ring-blue-500 focus:border-transparent [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:right-3 [&::-webkit-calendar-picker-indicator]:w-5 [&::-webkit-calendar-picker-indicator]:h-5 [&::-webkit-calendar-picker-indicator]:cursor-pointer`}
                required
              />
              <LogOut className={`absolute right-3 top-1/2 transform -translate-y-1/2 w-5 h-5 ${text.secondary} pointer-events-none`} />
            </div>
          </div>
        </div>

        {/* Hour Type */}
        <div>
          <label className={`block text-sm font-medium ${text.primary} mb-2`}>
            {t('adminTimeEntry.hourType', 'Hour Type')} *
          </label>
          <select
            value={formData.hourType}
            onChange={(e) => setFormData({ ...formData, hourType: e.target.value })}
            className={`w-full px-4 py-2 border ${border.primary} rounded-lg ${bg.primary} ${text.primary} focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
            required
          >
            <option value="regular">{t('adminTimeEntry.regularHours', 'Regular Hours')}</option>
            <option value="weekend">{t('adminTimeEntry.weekendOvertime', 'Weekend/Overtime')}</option>
            <option value="holiday">{t('adminTimeEntry.holiday', 'Holiday')}</option>
            <option value="bonus">{t('adminTimeEntry.bonusHours', 'Bonus Hours')}</option>
          </select>
        </div>

        {/* Notes */}
        <div>
          <label className={`block text-sm font-medium ${text.primary} mb-2`}>
            {t('adminTimeEntry.notes', 'Notes')} ({t('common.optional', 'Optional')})
          </label>
          <textarea
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            rows={3}
            placeholder={t('adminTimeEntry.notesPlaceholder', 'Add any notes about this time entry...')}
            className={`w-full px-4 py-2 border ${border.primary} rounded-lg ${bg.primary} ${text.primary} focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
          />
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={loading || !selectedEmployee}
          className={`w-full flex items-center justify-center space-x-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600 text-white rounded-lg transition-colors disabled:bg-gray-400 dark:disabled:bg-gray-600 disabled:cursor-not-allowed shadow-lg hover:shadow-xl`}
        >
          {loading ? (
            <>
              <Clock className="w-5 h-5 animate-spin" />
              <span>{t('adminTimeEntry.submitting', 'Submitting...')}</span>
            </>
          ) : (
            <>
              <Save className="w-5 h-5" />
              <span>{t('adminTimeEntry.submitButton', 'Submit Time Entry')}</span>
            </>
          )}
        </button>
      </form>
    </div>
  );
};

export default AdminTimeEntry;
