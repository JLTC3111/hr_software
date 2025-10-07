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

  const CustomCalendarIcon = ({ className }) => (
    <svg 
      width="23.5px" 
      height="23.5px" 
      viewBox="0 0 1024 1024" 
      className={className} 
      version="1.1" 
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M897.9 369.2H205c-33.8 0-61.4-27.6-61.4-61.4s27.6-61.4 61.4-61.4h692.9c33.8 0 61.4 27.6 61.4 61.4s-27.6 61.4-61.4 61.4z" fill="#FFB89A" />
      <path d="M807 171H703.3c-16.6 0-30 13.4-30 30s13.4 30 30 30H807c31.6 0 57.4 24 57.4 53.4v42.3H125.2v-42.3c0-29.5 25.7-53.4 57.4-53.4H293c16.6 0 30-13.4 30-30s-13.4-30-30-30H182.5c-64.7 0-117.4 50.9-117.4 113.4v527.7c0 62.5 52.7 113.4 117.4 113.4H807c64.7 0 117.4-50.9 117.4-113.4V284.5c0-62.6-52.7-113.5-117.4-113.5z m0 694.6H182.5c-31.6 0-57.4-24-57.4-53.4V386.8h739.2v425.4c0.1 29.5-25.7 53.4-57.3 53.4z" fill="#45484C" />
      <path d="M447.6 217.1c-12.4-6.1-27-2.8-35.7 7.1-2.2-6.7-4-16.2-4-28.1 0-13 2.2-23 4.6-29.8 9.5 8.1 23.5 9.6 34.9 2.8 14.2-8.5 18.8-27 10.3-41.2-15.5-25.9-35.9-29.7-46.6-29.7-36.6 0-63.1 41.2-63.1 97.8s26.4 98 63 98c20.6 0 39-13.4 50.4-36.7 7.3-14.9 1.1-32.9-13.8-40.2zM635.9 218.5c-12.4-6.1-27-2.8-35.7 7.1-2.2-6.7-4-16.2-4-28.1 0-13 2.2-23 4.6-29.8 9.5 8.1 23.5 9.6 34.9 2.8 14.2-8.5 18.8-27 10.3-41.2-15.5-25.9-35.9-29.7-46.6-29.7-36.6 0-63.1 41.2-63.1 97.8s26.5 97.8 63.1 97.8c20.6 0 39-13.4 50.4-36.7 7.1-14.7 0.9-32.7-13.9-40z" fill="#45484C" />
      <path d="M700.2 514.5H200.5c-16.6 0-30 13.4-30 30s13.4 30 30 30h499.7c16.6 0 30-13.4 30-30s-13.5-30-30-30zM668.4 689.8h-74c-16.6 0-30 13.4-30 30s13.4 30 30 30h74c16.6 0 30-13.4 30-30s-13.4-30-30-30zM479.3 689.8H200.5c-16.6 0-30 13.4-30 30s13.4 30 30 30h278.8c16.6 0 30-13.4 30-30s-13.4-30-30-30z" fill="#33CC99" />
    </svg>
  );

  const CustomClockIcon = ({ className }) => {
    return (
      <svg
        width="23.5px"
        height="23.5px"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
      >
        <g strokeWidth="0"></g>
        <g strokeLinecap="round" strokeLinejoin="round"></g>
        <g>
          <path
            d="M12 8V12L14.5 14.5"
            stroke="#6580d7"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          ></path>
          <path
            d="M22 12C22 16.714 22 19.0711 20.5355 20.5355C19.0711 22 16.714 22 12 22C7.28595 22 4.92893 22 3.46447 20.5355C2 19.0711 2 16.714 2 12C2 7.28595 2 4.92893 3.46447 3.46447C4.92893 2 7.28595 2 12 2C16.714 2 19.0711 2 20.5355 3.46447C21.5093 4.43821 21.8356 5.80655 21.9449 8"
            stroke="#6580d7"
            strokeWidth="1.5"
            strokeLinecap="round"
          ></path>
        </g>
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
              
              {/* IMPORTANT: Must be relative to position the icon inside */}
              <div className="relative">
                <input
                  id="clock-in-input"
                  type="time"
                  value={formData.clockIn}
                  onChange={(e) => setFormData({ ...formData, clockIn: e.target.value })}
                  // KEY: pr-10 for icon space, appearance-none for hiding native icon
                  className={`
                    w-full px-4 py-2 rounded-lg border 
                    ${input.className} 
                    ${isDarkMode ? 'text-white bg-gray-700 border-gray-600' : 'text-gray-900 bg-white border-gray-300'} 
                    ${errors.clockIn ? 'border-red-500' : ''}
                    pr-10 appearance-none
                  `}
                />
                <CustomClockIcon 
                  // KEY: Absolute positioning and pointer-events-none to let clicks pass through
                  className="absolute top-1/2 right-3 transform -translate-y-1/2 pointer-events-none" 
                />
              </div>
              {errors.clockIn && <p className="text-red-500 text-sm mt-1">{errors.clockIn}</p>}
            </div>

            {/* Clock Out */}
            <div>
              <label htmlFor="clock-out-input" className={`block text-sm font-medium ${isDarkMode ? 'text-white' : 'text-gray-700'} mb-2`}>
                {t('timeClock.clockOut')}
              </label>
              
              {/* IMPORTANT: Must be relative to position the icon inside */}
              <div className="relative">
                <input
                  id="clock-out-input"
                  type="time"
                  value={formData.clockOut}
                  onChange={(e) => setFormData({ ...formData, clockOut: e.target.value })}
                  // KEY: pr-10 for icon space, appearance-none for hiding native icon
                  className={`
                    w-full px-4 py-2 rounded-lg border 
                    ${input.className} 
                    ${isDarkMode ? 'text-white bg-gray-700 border-gray-600' : 'text-gray-900 bg-white border-gray-300'} 
                    ${errors.clockOut ? 'border-red-500' : ''}
                    pr-10 appearance-none
                  `}
                />
                <CustomClockIcon 
                  // KEY: Absolute positioning and pointer-events-none to let clicks pass through
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
                <select
                  value={formData.hourType}
                  onChange={(e) => setFormData({ ...formData, hourType: e.target.value })}
                  className={`w-full px-4 py-2 rounded-lg border ${input.className} ${isDarkMode ? 'text-white' : 'text-black'}`}
                >
                  {hourTypes.map(type => (
                    <option key={type.value} value={type.value}>{type.label}</option>
                  ))}
                </select>
              </div>

              {/* File Upload */}
              <div>
                <label className={`block text-sm font-medium ${isDarkMode ? 'text-white' : 'text-black'} mb-2`}>
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
                  className={`w-full px-4 py-2 rounded-lg border ${input.className} ${isDarkMode ? 'text-white' : 'text-black'}`}
                />
                {formData.proofFile && (
                  <p className="text-sm text-green-600 dark:text-green-400 mt-1 flex items-center">
                    <FileText className="w-4 h-4 mr-1" />
                    {formData.proofFile
                      ? formData.proofFile.name
                      : t('timeClock.chooseFile', '파일 선택')}
                  </p>
                )}
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
