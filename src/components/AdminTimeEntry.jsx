import React, { useState, useEffect } from 'react';
import { Clock, UserPlus, Save, X, Search, AlertCircle } from 'lucide-react';
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
        .select('id, name, email, position, department, employment_status')
        .eq('employment_status', 'active')
        .order('name');

      if (error) throw error;
      setEmployees(data || []);
    } catch (error) {
      console.error('Error fetching employees:', error);
      setErrorMessage('Failed to load employees');
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
      const clockInTime = new Date(`${formData.date}T${formData.clockIn}`);
      const clockOutTime = new Date(`${formData.date}T${formData.clockOut}`);

      // Calculate hours
      const diffMs = clockOutTime - clockInTime;
      const hours = diffMs / (1000 * 60 * 60);

      if (hours <= 0) {
        setErrorMessage('Clock out time must be after clock in time');
        setLoading(false);
        return;
      }

      const entry = {
        employeeId: selectedEmployee.id,
        date: formData.date,
        clockIn: clockInTime.toISOString(),
        clockOut: clockOutTime.toISOString(),
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
        <div className="flex items-center space-x-3 text-red-600">
          <AlertCircle className="w-6 h-6" />
          <p className="font-medium">Access Denied: You don't have permission to manage time entries for other employees.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`${bg.secondary} rounded-lg shadow-sm border ${border.primary} p-6`}>
      <div className="flex items-center space-x-3 mb-6">
        <UserPlus className="w-6 h-6 text-blue-600" />
        <h3 className={`text-xl font-bold ${text.primary}`}>
          Admin Time Entry
        </h3>
      </div>

      <p className={`${text.secondary} mb-6`}>
        Enter time entries for employees (Admin/Manager only)
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
            Select Employee *
          </label>
          
          {/* Search Input */}
          <div className="relative mb-2">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search employees..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={`w-full pl-10 pr-4 py-2 border ${border.primary} rounded-lg ${bg.primary} ${text.primary}`}
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
                <div className="p-4 text-center text-gray-500">No employees found</div>
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
                className="text-red-600 hover:text-red-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          )}
        </div>

        {/* Date */}
        <div>
          <label className={`block text-sm font-medium ${text.primary} mb-2`}>
            Date *
          </label>
          <input
            type="date"
            value={formData.date}
            onChange={(e) => setFormData({ ...formData, date: e.target.value })}
            max={new Date().toISOString().split('T')[0]}
            className={`w-full px-4 py-2 border ${border.primary} rounded-lg ${bg.primary} ${text.primary}`}
            required
          />
        </div>

        {/* Clock In & Clock Out */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={`block text-sm font-medium ${text.primary} mb-2`}>
              Clock In *
            </label>
            <input
              type="time"
              value={formData.clockIn}
              onChange={(e) => setFormData({ ...formData, clockIn: e.target.value })}
              className={`w-full px-4 py-2 border ${border.primary} rounded-lg ${bg.primary} ${text.primary}`}
              required
            />
          </div>
          <div>
            <label className={`block text-sm font-medium ${text.primary} mb-2`}>
              Clock Out *
            </label>
            <input
              type="time"
              value={formData.clockOut}
              onChange={(e) => setFormData({ ...formData, clockOut: e.target.value })}
              className={`w-full px-4 py-2 border ${border.primary} rounded-lg ${bg.primary} ${text.primary}`}
              required
            />
          </div>
        </div>

        {/* Hour Type */}
        <div>
          <label className={`block text-sm font-medium ${text.primary} mb-2`}>
            Hour Type *
          </label>
          <select
            value={formData.hourType}
            onChange={(e) => setFormData({ ...formData, hourType: e.target.value })}
            className={`w-full px-4 py-2 border ${border.primary} rounded-lg ${bg.primary} ${text.primary}`}
            required
          >
            <option value="regular">Regular Hours</option>
            <option value="weekend">Weekend/Overtime</option>
            <option value="holiday">Holiday</option>
            <option value="bonus">Bonus Hours</option>
          </select>
        </div>

        {/* Notes */}
        <div>
          <label className={`block text-sm font-medium ${text.primary} mb-2`}>
            Notes (Optional)
          </label>
          <textarea
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            rows={3}
            placeholder="Add any notes about this time entry..."
            className={`w-full px-4 py-2 border ${border.primary} rounded-lg ${bg.primary} ${text.primary}`}
          />
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={loading || !selectedEmployee}
          className={`w-full flex items-center justify-center space-x-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed`}
        >
          {loading ? (
            <>
              <Clock className="w-5 h-5 animate-spin" />
              <span>Submitting...</span>
            </>
          ) : (
            <>
              <Save className="w-5 h-5" />
              <span>Submit Time Entry</span>
            </>
          )}
        </button>
      </form>
    </div>
  );
};

export default AdminTimeEntry;
