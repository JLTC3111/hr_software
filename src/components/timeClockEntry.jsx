import React, { useState, useEffect } from 'react';
import { Clock, Calendar, Upload, X, AlertCircle, CheckCircle, Download, FileText } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';

const TimeClockEntry = () => {
  const { isDarkMode, bg, text, border, button } = useTheme();
  const { t } = useLanguage();
  const { user } = useAuth();

  // Form state
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    clockIn: '',
    clockOut: '',
    workType: 'regular',
    notes: '',
    proofFile: null
  });

  // Time entries history
  const [timeEntries, setTimeEntries] = useState(() => {
    const saved = localStorage.getItem(`timeEntries_${user?.id}`);
    return saved ? JSON.parse(saved) : [];
  });

  const [errors, setErrors] = useState({});
  const [successMessage, setSuccessMessage] = useState('');
  const [showHistory, setShowHistory] = useState(false);

  // Work type multipliers for pay calculation
  const workTypeMultipliers = {
    regular: 1.0,
    holiday: 2.0,
    weekend: 1.5,
    bonus: 1.75
  };

  // Validate time entry
  const validateEntry = () => {
    const newErrors = {};

    if (!formData.date) {
      newErrors.date = t('timeClock.errors.dateRequired', 'Date is required');
    }

    if (!formData.clockIn) {
      newErrors.clockIn = t('timeClock.errors.clockInRequired', 'Clock-in time is required');
    }

    if (!formData.clockOut) {
      newErrors.clockOut = t('timeClock.errors.clockOutRequired', 'Clock-out time is required');
    }

    // Validate clock-out > clock-in
    if (formData.clockIn && formData.clockOut) {
      const clockInTime = new Date(`${formData.date}T${formData.clockIn}`);
      const clockOutTime = new Date(`${formData.date}T${formData.clockOut}`);
      
      if (clockOutTime <= clockInTime) {
        newErrors.clockOut = t('timeClock.errors.clockOutBeforeIn', 'Clock-out must be after clock-in');
      }

      // Cap total hours at 24
      const hoursDiff = (clockOutTime - clockInTime) / (1000 * 60 * 60);
      if (hoursDiff > 24) {
        newErrors.clockOut = t('timeClock.errors.exceedsMaxHours', 'Cannot exceed 24 hours in one day');
      }
    }

    // Check for overlapping shifts on the same day
    const overlapping = timeEntries.find(entry => {
      if (entry.date !== formData.date) return false;
      
      const existingIn = new Date(`${entry.date}T${entry.clockIn}`);
      const existingOut = new Date(`${entry.date}T${entry.clockOut}`);
      const newIn = new Date(`${formData.date}T${formData.clockIn}`);
      const newOut = new Date(`${formData.date}T${formData.clockOut}`);

      return (newIn < existingOut && newOut > existingIn);
    });

    if (overlapping) {
      newErrors.date = t('timeClock.errors.overlappingShift', 'Time overlaps with existing entry on this date');
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Calculate hours worked
  const calculateHours = (clockIn, clockOut, date) => {
    const inTime = new Date(`${date}T${clockIn}`);
    const outTime = new Date(`${date}T${clockOut}`);
    return ((outTime - inTime) / (1000 * 60 * 60)).toFixed(2);
  };

  // Handle file upload
  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Validate file type
      const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];
      if (!allowedTypes.includes(file.type)) {
        setErrors({ ...errors, file: t('timeClock.errors.invalidFileType', 'Only PDF and images allowed') });
        return;
      }

      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        setErrors({ ...errors, file: t('timeClock.errors.fileTooLarge', 'File size must be less than 5MB') });
        return;
      }

      // Convert to base64 for storage
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData({ ...formData, proofFile: { name: file.name, data: reader.result } });
        setErrors({ ...errors, file: null });
      };
      reader.readAsDataURL(file);
    }
  };

  // Handle form submission
  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (!validateEntry()) return;

    const hours = calculateHours(formData.clockIn, formData.clockOut, formData.date);
    const multiplier = workTypeMultipliers[formData.workType];
    
    const newEntry = {
      id: Date.now(),
      userId: user?.id,
      userName: user?.name,
      ...formData,
      hours: parseFloat(hours),
      multiplier,
      effectiveHours: (parseFloat(hours) * multiplier).toFixed(2),
      submittedAt: new Date().toISOString(),
      status: 'pending' // Can be: pending, approved, rejected
    };

    const updatedEntries = [...timeEntries, newEntry];
    setTimeEntries(updatedEntries);
    localStorage.setItem(`timeEntries_${user?.id}`, JSON.stringify(updatedEntries));

    setSuccessMessage(t('timeClock.success.entrySaved', 'Time entry saved successfully!'));
    setTimeout(() => setSuccessMessage(''), 3000);

    // Reset form
    setFormData({
      date: new Date().toISOString().split('T')[0],
      clockIn: '',
      clockOut: '',
      workType: 'regular',
      notes: '',
      proofFile: null
    });
  };

  // Delete entry
  const handleDelete = (id) => {
    const updated = timeEntries.filter(entry => entry.id !== id);
    setTimeEntries(updated);
    localStorage.setItem(`timeEntries_${user?.id}`, JSON.stringify(updated));
  };

  // Calculate totals
  const calculateTotals = () => {
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(now.getFullYear(), now.getMonth(), 1);

    const totals = {
      weekly: { regular: 0, holiday: 0, weekend: 0, bonus: 0, total: 0 },
      monthly: { regular: 0, holiday: 0, weekend: 0, bonus: 0, total: 0 },
      all: { regular: 0, holiday: 0, weekend: 0, bonus: 0, total: 0 }
    };

    timeEntries.forEach(entry => {
      const entryDate = new Date(entry.date);
      const hours = parseFloat(entry.hours);

      totals.all[entry.workType] += hours;
      totals.all.total += hours;

      if (entryDate >= weekAgo) {
        totals.weekly[entry.workType] += hours;
        totals.weekly.total += hours;
      }

      if (entryDate >= monthAgo) {
        totals.monthly[entry.workType] += hours;
        totals.monthly.total += hours;
      }
    });

    return totals;
  };

  // Export to CSV
  const exportToCSV = () => {
    const headers = ['Date', 'Clock In', 'Clock Out', 'Hours', 'Type', 'Multiplier', 'Effective Hours', 'Status', 'Notes'];
    const csvData = timeEntries.map(entry => [
      entry.date,
      entry.clockIn,
      entry.clockOut,
      entry.hours,
      entry.workType,
      entry.multiplier,
      entry.effectiveHours,
      entry.status,
      entry.notes || ''
    ]);

    const csv = [
      headers.join(','),
      ...csvData.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `timesheet_${user?.name}_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const totals = calculateTotals();

  return (
    <div className={`${bg.secondary} rounded-lg shadow-lg p-6`}>
      <div className="flex items-center justify-between mb-6">
        <h2 className={`text-2xl font-bold ${text.primary}`}>
          <Clock className="inline mr-2" />
          {t('timeClock.title', 'Time Clock Entry')}
        </h2>
        <button
          onClick={() => setShowHistory(!showHistory)}
          className={`px-4 py-2 rounded-lg ${button.primary} transition-colors`}
        >
          {showHistory ? t('timeClock.hideHistory', 'Hide History') : t('timeClock.showHistory', 'Show History')}
        </button>
      </div>

      {/* Success Message */}
      {successMessage && (
        <div className="mb-4 p-3 bg-green-100 dark:bg-green-900/30 border border-green-400 dark:border-green-700 rounded-lg flex items-center space-x-2 text-green-700 dark:text-green-400">
          <CheckCircle className="w-5 h-5" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Entry Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Date Picker */}
          <div>
            <label className={`block text-sm font-medium ${text.primary} mb-2`}>
              <Calendar className="inline w-4 h-4 mr-1" />
              {t('timeClock.date', 'Date')}
            </label>
            <input
              type="date"
              value={formData.date}
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              max={new Date().toISOString().split('T')[0]}
              className={`w-full px-4 py-2 border rounded-lg ${isDarkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'} ${errors.date ? 'border-red-500' : ''}`}
            />
            {errors.date && <p className="text-red-500 text-sm mt-1">{errors.date}</p>}
          </div>

          {/* Work Type */}
          <div>
            <label className={`block text-sm font-medium ${text.primary} mb-2`}>
              {t('timeClock.workType', 'Work Type')}
            </label>
            <select
              value={formData.workType}
              onChange={(e) => setFormData({ ...formData, workType: e.target.value })}
              className={`w-full px-4 py-2 border rounded-lg ${isDarkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'}`}
            >
              <option value="regular">{t('timeClock.types.regular', 'Regular Hours')} (1.0x)</option>
              <option value="weekend">{t('timeClock.types.weekend', 'Weekend')} (1.5x)</option>
              <option value="bonus">{t('timeClock.types.bonus', 'Bonus Hours')} (1.75x)</option>
              <option value="holiday">{t('timeClock.types.holiday', 'Holiday')} (2.0x)</option>
            </select>
          </div>

          {/* Clock In */}
          <div>
            <label className={`block text-sm font-medium ${text.primary} mb-2`}>
              {t('timeClock.clockIn', 'Clock In')}
            </label>
            <input
              type="time"
              value={formData.clockIn}
              onChange={(e) => setFormData({ ...formData, clockIn: e.target.value })}
              className={`w-full px-4 py-2 border rounded-lg ${isDarkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'} ${errors.clockIn ? 'border-red-500' : ''}`}
            />
            {errors.clockIn && <p className="text-red-500 text-sm mt-1">{errors.clockIn}</p>}
          </div>

          {/* Clock Out */}
          <div>
            <label className={`block text-sm font-medium ${text.primary} mb-2`}>
              {t('timeClock.clockOut', 'Clock Out')}
            </label>
            <input
              type="time"
              value={formData.clockOut}
              onChange={(e) => setFormData({ ...formData, clockOut: e.target.value })}
              className={`w-full px-4 py-2 border rounded-lg ${isDarkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'} ${errors.clockOut ? 'border-red-500' : ''}`}
            />
            {errors.clockOut && <p className="text-red-500 text-sm mt-1">{errors.clockOut}</p>}
          </div>
        </div>

        {/* File Upload */}
        <div>
          <label className={`block text-sm font-medium ${text.primary} mb-2`}>
            <Upload className="inline w-4 h-4 mr-1" />
            {t('timeClock.proof', 'Proof of Work (Optional)')}
          </label>
          <div className={`border-2 border-dashed ${border.primary} rounded-lg p-4`}>
            <input
              type="file"
              accept=".pdf,.jpg,.jpeg,.png"
              onChange={handleFileUpload}
              className="hidden"
              id="proof-upload"
            />
            <label htmlFor="proof-upload" className="cursor-pointer flex flex-col items-center">
              {formData.proofFile ? (
                <div className="flex items-center space-x-2">
                  <FileText className="w-5 h-5 text-blue-500" />
                  <span className={text.primary}>{formData.proofFile.name}</span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      setFormData({ ...formData, proofFile: null });
                    }}
                    className="text-red-500 hover:text-red-700"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <>
                  <Upload className={`w-8 h-8 ${text.secondary} mb-2`} />
                  <span className={`text-sm ${text.secondary}`}>
                    {t('timeClock.uploadPrompt', 'Click to upload PDF or image (max 5MB)')}
                  </span>
                </>
              )}
            </label>
          </div>
          {errors.file && <p className="text-red-500 text-sm mt-1">{errors.file}</p>}
        </div>

        {/* Notes */}
        <div>
          <label className={`block text-sm font-medium ${text.primary} mb-2`}>
            {t('timeClock.notes', 'Notes (Optional)')}
          </label>
          <textarea
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            rows={3}
            placeholder={t('timeClock.notesPlaceholder', 'Add any additional context...')}
            className={`w-full px-4 py-2 border rounded-lg ${isDarkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'}`}
          />
        </div>

        {/* Hours Preview */}
        {formData.clockIn && formData.clockOut && !errors.clockOut && (
          <div className={`p-4 ${isDarkMode ? 'bg-blue-900/30' : 'bg-blue-50'} rounded-lg`}>
            <p className={`text-sm ${text.primary}`}>
              <strong>{t('timeClock.hoursWorked', 'Hours Worked')}:</strong> {calculateHours(formData.clockIn, formData.clockOut, formData.date)} hrs
              {formData.workType !== 'regular' && (
                <span className="ml-2">
                  ({t('timeClock.effective', 'Effective')}: {(calculateHours(formData.clockIn, formData.clockOut, formData.date) * workTypeMultipliers[formData.workType]).toFixed(2)} hrs)
                </span>
              )}
            </p>
          </div>
        )}

        {/* Submit Button */}
        <button
          type="submit"
          className={`w-full py-3 px-6 rounded-lg font-medium ${button.primary} transition-colors`}
        >
          {t('timeClock.submit', 'Submit Time Entry')}
        </button>
      </form>

      {/* Summary Stats */}
      <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className={`p-4 ${isDarkMode ? 'bg-gray-700' : 'bg-gray-100'} rounded-lg`}>
          <h3 className={`text-sm font-medium ${text.secondary} mb-2`}>
            {t('timeClock.weeklyTotal', 'This Week')}
          </h3>
          <p className={`text-2xl font-bold ${text.primary}`}>{totals.weekly.total.toFixed(1)} hrs</p>
          <div className={`text-xs ${text.secondary} mt-2 space-y-1`}>
            <p>{t('timeClock.types.regular', 'Regular')}: {totals.weekly.regular.toFixed(1)} hrs</p>
            <p>{t('timeClock.types.weekend', 'Weekend')}: {totals.weekly.weekend.toFixed(1)} hrs</p>
            <p>{t('timeClock.types.holiday', 'Holiday')}: {totals.weekly.holiday.toFixed(1)} hrs</p>
          </div>
        </div>

        <div className={`p-4 ${isDarkMode ? 'bg-gray-700' : 'bg-gray-100'} rounded-lg`}>
          <h3 className={`text-sm font-medium ${text.secondary} mb-2`}>
            {t('timeClock.monthlyTotal', 'This Month')}
          </h3>
          <p className={`text-2xl font-bold ${text.primary}`}>{totals.monthly.total.toFixed(1)} hrs</p>
          <div className={`text-xs ${text.secondary} mt-2 space-y-1`}>
            <p>{t('timeClock.types.regular', 'Regular')}: {totals.monthly.regular.toFixed(1)} hrs</p>
            <p>{t('timeClock.types.weekend', 'Weekend')}: {totals.monthly.weekend.toFixed(1)} hrs</p>
            <p>{t('timeClock.types.holiday', 'Holiday')}: {totals.monthly.holiday.toFixed(1)} hrs</p>
          </div>
        </div>

        <div className={`p-4 ${isDarkMode ? 'bg-gray-700' : 'bg-gray-100'} rounded-lg`}>
          <h3 className={`text-sm font-medium ${text.secondary} mb-2`}>
            {t('timeClock.allTime', 'All Time')}
          </h3>
          <p className={`text-2xl font-bold ${text.primary}`}>{totals.all.total.toFixed(1)} hrs</p>
          <button
            onClick={exportToCSV}
            className="mt-2 text-sm text-blue-500 hover:text-blue-700 flex items-center"
          >
            <Download className="w-4 h-4 mr-1" />
            {t('timeClock.export', 'Export CSV')}
          </button>
        </div>
      </div>

      {/* History Table */}
      {showHistory && (
        <div className="mt-8">
          <h3 className={`text-xl font-bold ${text.primary} mb-4`}>
            {t('timeClock.history', 'Time Entry History')}
          </h3>
          <div className="overflow-x-auto">
            <table className={`w-full ${isDarkMode ? 'bg-gray-700' : 'bg-white'} rounded-lg overflow-hidden`}>
              <thead className={isDarkMode ? 'bg-gray-600' : 'bg-gray-100'}>
                <tr>
                  <th className={`px-4 py-3 text-left text-sm font-medium ${text.primary}`}>
                    {t('timeClock.table.date', 'Date')}
                  </th>
                  <th className={`px-4 py-3 text-left text-sm font-medium ${text.primary}`}>
                    {t('timeClock.table.clockIn', 'Clock In')}
                  </th>
                  <th className={`px-4 py-3 text-left text-sm font-medium ${text.primary}`}>
                    {t('timeClock.table.clockOut', 'Clock Out')}
                  </th>
                  <th className={`px-4 py-3 text-left text-sm font-medium ${text.primary}`}>
                    {t('timeClock.table.hours', 'Hours')}
                  </th>
                  <th className={`px-4 py-3 text-left text-sm font-medium ${text.primary}`}>
                    {t('timeClock.table.type', 'Type')}
                  </th>
                  <th className={`px-4 py-3 text-left text-sm font-medium ${text.primary}`}>
                    {t('timeClock.table.status', 'Status')}
                  </th>
                  <th className={`px-4 py-3 text-left text-sm font-medium ${text.primary}`}>
                    {t('timeClock.table.actions', 'Actions')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-600">
                {timeEntries.length === 0 ? (
                  <tr>
                    <td colSpan="7" className={`px-4 py-8 text-center ${text.secondary}`}>
                      {t('timeClock.noEntries', 'No time entries yet')}
                    </td>
                  </tr>
                ) : (
                  timeEntries.slice().reverse().map((entry) => (
                    <tr key={entry.id} className={`${isDarkMode ? 'hover:bg-gray-600' : 'hover:bg-gray-50'}`}>
                      <td className={`px-4 py-3 text-sm ${text.primary}`}>{entry.date}</td>
                      <td className={`px-4 py-3 text-sm ${text.primary}`}>{entry.clockIn}</td>
                      <td className={`px-4 py-3 text-sm ${text.primary}`}>{entry.clockOut}</td>
                      <td className={`px-4 py-3 text-sm ${text.primary}`}>
                        {entry.hours} hrs
                        {entry.workType !== 'regular' && (
                          <div className="text-xs text-blue-500">({entry.effectiveHours} eff.)</div>
                        )}
                      </td>
                      <td className={`px-4 py-3 text-sm ${text.primary}`}>
                        <span className={`px-2 py-1 rounded text-xs ${
                          entry.workType === 'holiday' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' :
                          entry.workType === 'weekend' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' :
                          entry.workType === 'bonus' ? 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200' :
                          'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
                        }`}>
                          {t(`timeClock.types.${entry.workType}`, entry.workType)}
                        </span>
                      </td>
                      <td className={`px-4 py-3 text-sm`}>
                        <span className={`px-2 py-1 rounded text-xs ${
                          entry.status === 'approved' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
                          entry.status === 'rejected' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' :
                          'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                        }`}>
                          {t(`timeClock.status.${entry.status}`, entry.status)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <button
                          onClick={() => handleDelete(entry.id)}
                          className="text-red-500 hover:text-red-700"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default TimeClockEntry;
