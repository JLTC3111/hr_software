import React, { useState, useEffect } from 'react';
import { Clock, Upload, Calendar, AlertCircle, Check, X, FileText, Download } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';

const TimeClockEntry = () => {
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
  const [timeEntries, setTimeEntries] = useState(() => {
    const saved = localStorage.getItem(`timeEntries_${user?.id}`);
    return saved ? JSON.parse(saved) : [];
  });

  const [errors, setErrors] = useState({});
  const [successMessage, setSuccessMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Save entries to localStorage whenever they change
  useEffect(() => {
    if (user?.id) {
      localStorage.setItem(`timeEntries_${user?.id}`, JSON.stringify(timeEntries));
    }
  }, [timeEntries, user]);

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
  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    setIsSubmitting(true);

    const newEntry = {
      id: Date.now(),
      ...formData,
      hours: calculateHours(formData.clockIn, formData.clockOut, formData.date),
      userId: user?.id,
      userName: user?.name,
      status: 'pending', // pending, approved, rejected
      submittedAt: new Date().toISOString()
    };

    setTimeEntries([newEntry, ...timeEntries]);
    
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
    setIsSubmitting(false);
  };

  // Delete entry
  const handleDelete = (id) => {
    if (window.confirm(t('timeClock.confirmDelete'))) {
      setTimeEntries(timeEntries.filter(entry => entry.id !== id));
    }
  };

  // Calculate totals
  const calculateTotals = (filterType = 'all', period = 'week') => {
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);

    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    return timeEntries.reduce((acc, entry) => {
      const entryDate = new Date(entry.date);
      
      // Filter by period
      if (period === 'week' && entryDate < startOfWeek) return acc;
      if (period === 'month' && entryDate < startOfMonth) return acc;

      // Filter by type
      if (filterType === 'all' || entry.hourType === filterType) {
        acc += parseFloat(entry.hours || 0);
      }

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
      case 'approved': return 'text-green-600 bg-green-100 dark:bg-green-900/30 dark:text-green-400';
      case 'rejected': return 'text-red-600 bg-red-100 dark:bg-red-900/30 dark:text-red-400';
      default: return 'text-yellow-600 bg-yellow-100 dark:bg-yellow-900/30 dark:text-yellow-400';
    }
  };

  return (
    <div className="space-y-6">
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
              <div>
                <label className={`block text-sm font-medium ${text.primary} mb-2`}>
                  <Calendar className="w-4 h-4 inline mr-1" />
                  {t('timeClock.date')}
                </label>
                <input
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  max={new Date().toISOString().split('T')[0]}
                  className={`w-full px-4 py-2 rounded-lg border ${input.className} ${isDarkMode ? 'text-white' : ''} ${errors.date ? 'border-red-500' : ''}`}
                />
                {errors.date && <p className="text-red-500 text-sm mt-1">{errors.date}</p>}
              </div>

              {/* Clock In/Out Times */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={`block text-sm font-medium ${text.primary} mb-2`}>
                    {t('timeClock.clockIn')}
                  </label>
                  <input
                    type="time"
                    value={formData.clockIn}
                    onChange={(e) => setFormData({ ...formData, clockIn: e.target.value })}
                    className={`w-full px-4 py-2 rounded-lg border ${input.className} ${isDarkMode ? 'text-white' : ''} ${errors.clockIn ? 'border-red-500' : ''}`}
                  />
                  {errors.clockIn && <p className="text-red-500 text-sm mt-1">{errors.clockIn}</p>}
                </div>

                <div>
                  <label className={`block text-sm font-medium ${text.primary} mb-2`}>
                    {t('timeClock.clockOut')}
                  </label>
                  <input
                    type="time"
                    value={formData.clockOut}
                    onChange={(e) => setFormData({ ...formData, clockOut: e.target.value })}
                    className={`w-full px-4 py-2 rounded-lg border ${input.className} ${isDarkMode ? 'text-white' : ''} ${errors.clockOut ? 'border-red-500' : ''}`}
                  />
                  {errors.clockOut && <p className="text-red-500 text-sm mt-1">{errors.clockOut}</p>}
                </div>
              </div>

              {/* Hour Type */}
              <div>
                <label className={`block text-sm font-medium ${text.primary} mb-2`}>
                  {t('timeClock.hourType')}
                </label>
                <select
                  value={formData.hourType}
                  onChange={(e) => setFormData({ ...formData, hourType: e.target.value })}
                  className={`w-full px-4 py-2 rounded-lg border ${input.className} ${isDarkMode ? 'text-white' : ''}`}
                >
                  {hourTypes.map(type => (
                    <option key={type.value} value={type.value}>{type.label}</option>
                  ))}
                </select>
              </div>

              {/* File Upload */}
              <div>
                <label className={`block text-sm font-medium ${text.primary} mb-2`}>
                  <Upload className="w-4 h-4 inline mr-1" />
                  {t('timeClock.proof')}
                  <span className="text-sm text-gray-500 ml-2">
                    ({t('timeClock.optional')})
                  </span>
                </label>
                <input
                  type="file"
                  accept=".jpg,.jpeg,.png,.pdf"
                  onChange={handleFileChange}
                  className={`w-full px-4 py-2 rounded-lg border ${input.className} ${isDarkMode ? 'text-white' : ''}`}
                />
                {formData.proofFile && (
                  <p className="text-sm text-green-600 dark:text-green-400 mt-1 flex items-center">
                    <FileText className="w-4 h-4 mr-1" />
                    {formData.proofFile.name}
                  </p>
                )}
                {errors.proofFile && <p className="text-red-500 text-sm mt-1">{errors.proofFile}</p>}
                <p className="text-xs text-gray-500 mt-1">
                  {t('timeClock.fileHelp')}
                </p>
              </div>

              {/* Notes */}
              <div>
                <label className={`block text-sm font-medium ${text.primary} mb-2`}>
                  {t('timeClock.notes')}
                  <span className="text-sm text-gray-500 ml-2">
                    ({t('timeClock.optional')})
                  </span>
                </label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows="3"
                  placeholder={t('timeClock.notesPlaceholder')}
                  className={`w-full px-4 py-2 rounded-lg border ${input.className} ${isDarkMode ? 'text-white' : ''}`}
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
        </div>
      </div>

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
                  <tr key={entry.id} className={`border-b ${border.primary} hover:bg-gray-50 dark:hover:bg-gray-800`}>
                    <td className={`p-3 ${text.primary}`}>
                      {new Date(entry.date).toLocaleDateString()}
                    </td>
                    <td className={`p-3 ${text.secondary}`}>
                      {entry.clockIn} - {entry.clockOut}
                    </td>
                    <td className={`p-3 ${text.primary} font-semibold`}>
                      {entry.hours} hrs
                    </td>
                    <td className="p-3">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        entry.hourType === 'regular' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400' :
                        entry.hourType === 'holiday' ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400' :
                        entry.hourType === 'weekend' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' :
                        'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
                      }`}>
                        {hourTypes.find(t => t.value === entry.hourType)?.label}
                      </span>
                    </td>
                    <td className="p-3">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(entry.status)}`}>
                        {entry.status.charAt(0).toUpperCase() + entry.status.slice(1)}
                      </span>
                    </td>
                    <td className="p-3">
                      {entry.proofFile ? (
                        <FileText className="w-5 h-5 text-green-600 dark:text-green-400" />
                      ) : (
                        <span className={`text-xs ${text.secondary}`}>-</span>
                      )}
                    </td>
                    <td className="p-3 text-right">
                      <button
                        onClick={() => handleDelete(entry.id)}
                        className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
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
