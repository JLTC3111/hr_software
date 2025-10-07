import React, { useState } from 'react'
import { Clock, Calendar, TrendingUp, Users, X, Check, Download, FileText, Coffee, Zap } from 'lucide-react'
import { useTheme } from '../contexts/ThemeContext'
import { useLanguage } from '../contexts/LanguageContext'
import { useNavigate } from 'react-router-dom'

const TimeTracking = ({ employees }) => {
  const [selectedEmployee, setSelectedEmployee] = useState(employees[0]?.id || null);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const { isDarkMode, toggleTheme, button, bg, text, border, hover, input } = useTheme();
  const { t } = useLanguage();
  const navigate = useNavigate();
  
  // Modal states
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [showOvertimeModal, setShowOvertimeModal] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  
  // Leave request form
  const [leaveForm, setLeaveForm] = useState({
    type: 'vacation',
    startDate: '',
    endDate: '',
    reason: ''
  });
  
  // Overtime log form
  const [overtimeForm, setOvertimeForm] = useState({
    date: new Date().toISOString().split('T')[0],
    hours: '',
    reason: ''
  });

  const timeTrackingData = {
    [employees[0]?.id]: {
      daysWorked: 22,
      leaveDays: 3,
      overtime: 15.5,
      holidayOvertime: 8,
      regularHours: 176,
      totalHours: 185,
    },
    [employees[1]?.id]: {
      daysWorked: 20,
      leaveDays: 5,
      overtime: 12,
      holidayOvertime: 4,
      regularHours: 160,
      totalHours: 175,
    },
    [employees[2]?.id]: {
      daysWorked: 23,
      leaveDays: 2,
      overtime: 18,
      holidayOvertime: 6,
      regularHours: 184,
      totalHours: 200,
    }
  };

  const currentData = timeTrackingData[selectedEmployee] || {
    daysWorked: 0,
    leaveDays: 0,
    overtime: 0,
    holidayOvertime: 0,
    regularHours: 0,
    totalHours: 0
  };

  const months = [
    t('months.january'), t('months.february'), t('months.march'), t('months.april'), 
    t('months.may'), t('months.june'), t('months.july'), t('months.august'), 
    t('months.september'), t('months.october'), t('months.november'), t('months.december')
  ];

  const years = [2023, 2024, 2025];

  const TimeCard = ({ title, value, unit, icon: Icon, color, bgColor }) => (
    <div className={`${bg.secondary} rounded-lg p-6 border ${border.primary}`}>
      <div className="flex items-center justify-between">
        <div>
          <p className={`text-sm font-medium ${text.secondary}`}>{title}</p>
          <p className={`text-2xl font-bold ${color} mt-1`}>
            {value}
            <span className={`text-sm font-normal ${text.secondary} ml-1`}>{unit}</span>
          </p>
        </div>
        <div className={`p-3 rounded-full ${color.replace('text-', 'bg-').replace('-600', '-100')}`}>
          <Icon className={`h-6 w-6 ${color}`} />
        </div>
      </div>
    </div>
  );

  // Handler functions
  const handleLeaveSubmit = (e) => {
    e.preventDefault();
    console.log('Leave request submitted:', leaveForm);
    
    // In production, this would submit to the database
    setSuccessMessage(t('timeTracking.leaveSuccess', 'Leave request submitted successfully!'));
    setShowLeaveModal(false);
    
    // Reset form
    setLeaveForm({
      type: 'vacation',
      startDate: '',
      endDate: '',
      reason: ''
    });
    
    // Clear success message after 3 seconds
    setTimeout(() => setSuccessMessage(''), 3000);
  };

  const handleOvertimeSubmit = (e) => {
    e.preventDefault();
    console.log('Overtime logged:', overtimeForm);
    
    // In production, this would submit to the database
    setSuccessMessage(t('timeTracking.overtimeSuccess', 'Overtime logged successfully!'));
    setShowOvertimeModal(false);
    
    // Reset form
    setOvertimeForm({
      date: new Date().toISOString().split('T')[0],
      hours: '',
      reason: ''
    });
    
    // Clear success message after 3 seconds
    setTimeout(() => setSuccessMessage(''), 3000);
  };

  const handleExportReport = () => {
    // Generate CSV data
    const employee = employees.find(emp => emp.id === selectedEmployee);
    const csvData = [
      ['Time Tracking Report'],
      ['Employee', employee?.name || 'Unknown'],
      ['Period', `${months[selectedMonth]} ${selectedYear}`],
      [''],
      ['Metric', 'Value'],
      ['Days Worked', currentData.daysWorked],
      ['Leave Days', currentData.leaveDays],
      ['Overtime Hours', currentData.overtime],
      ['Holiday Overtime', currentData.holidayOvertime],
      ['Regular Hours', currentData.regularHours],
      ['Total Hours', currentData.totalHours],
      ['Attendance Rate', `${((currentData.daysWorked / 25) * 100).toFixed(1)}%`]
    ];

    // Convert to CSV string
    const csvContent = csvData.map(row => row.join(',')).join('\n');
    
    // Create download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', `timetracking_${employee?.name}_${months[selectedMonth]}_${selectedYear}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    setSuccessMessage(t('timeTracking.exportSuccess', 'Report exported successfully!'));
    setTimeout(() => setSuccessMessage(''), 3000);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h2 className={`text-2xl font-bold ${text.primary}`}>{t('timeTracking.title')}</h2>
        <div className="flex space-x-4">
          {/* Employee Selector */}
          <select
            value={selectedEmployee}
            onChange={(e) => setSelectedEmployee(e.target.value)}
            className={`${input.bg} ${input.text} px-4 py-2 border ${input.border} rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500`}
          >
            {employees.map(employee => (
              <option key={employee.id} value={employee.id}>
                {employee.name}
              </option>
            ))}
          </select>

          {/* Month Selector */}
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
            className={`${input.bg} ${input.text} px-4 py-2 border ${input.border} rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500`}
          >
            {months.map((month, index) => (
              <option key={index} value={index}>
                {month}
              </option>
            ))}
          </select>

          {/* Year Selector */}
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(parseInt(e.target.value))}
            className={`${input.bg} ${input.text} px-4 py-2 border ${input.border} rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500`}
          >
            {years.map(year => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Time Tracking Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <TimeCard
          title={t('timeTracking.workDays')}
          value={currentData.daysWorked}
          unit={t('timeTracking.days')}
          icon={Calendar}
          color="text-blue-600"
          bgColor="bg-white"
        />
        <TimeCard
          title={t('timeTracking.leaveDays')}
          value={currentData.leaveDays}
          unit={t('timeTracking.days')}
          icon={Coffee}
          color="text-orange-600"
          bgColor="bg-white"
        />
        <TimeCard
          title={t('timeTracking.overtime')}
          value={currentData.overtime}
          unit={t('timeTracking.hours')}
          icon={Clock}
          color="text-purple-600"
          bgColor="bg-white"
        />
        <TimeCard
          title={t('timeTracking.holidayOvertime')}
          value={currentData.holidayOvertime}
          unit={t('timeTracking.hours')}
          icon={Zap}
          color="text-green-600"
          bgColor="bg-white"
        />
      </div>

      {/* Detailed Summary */}
      <div className={`${bg.secondary} rounded-lg shadow-sm border ${border.primary} p-6`}>
        <h3 className={`text-lg font-semibold ${text.primary} mb-4`}>
          {t('timeTracking.summary', `Summary for ${employees.find(emp => emp.id == selectedEmployee)?.name} - ${months[selectedMonth]} ${selectedYear}`)}
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className={text.secondary}>{t('timeTracking.regularHours')}:</span>
              <span className={`font-medium ${text.primary}`}>{currentData.regularHours} {t('timeTracking.hrs')}</span>
            </div>
            <div className="flex justify-between">
              <span className={text.secondary}>{t('timeTracking.overtimeHours')}:</span>
              <span className={`font-medium ${text.primary}`}>{currentData.overtime} {t('timeTracking.hrs')}</span>
            </div>
            <div className="flex justify-between">
              <span className={text.secondary}>{t('timeTracking.totalHours')}:</span>
              <span className={`font-medium ${text.primary}`}>{currentData.totalHours} {t('timeTracking.hrs')}</span>
            </div>
          </div>
          
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className={text.secondary}>{t('timeTracking.workDays')}:</span>
              <span className={`font-medium ${text.primary}`}>{currentData.daysWorked} {t('timeTracking.days')}</span>
            </div>
            <div className="flex justify-between">
              <span className={text.secondary}>{t('timeTracking.leaveDays')}:</span>
              <span className={`font-medium ${text.primary}`}>{currentData.leaveDays} {t('timeTracking.days')}</span>
            </div>
            <div className="flex justify-between">
              <span className={text.secondary}>{t('timeTracking.holidayOvertime')}:</span>
              <span className={`font-medium ${text.primary}`}>{currentData.holidayOvertime} {t('timeTracking.hrs')}</span>
            </div>
            <div className={`flex justify-between border-t ${border.primary} pt-3`}>
              <span className={`${text.primary} font-semibold`}>{t('timeTracking.attendanceRate')}:</span>
              <span className={`font-bold ${text.primary}`}>
                {((currentData.daysWorked / 25) * 100).toFixed(1)}%
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Success Message */}
      {successMessage && (
        <div className="fixed top-4 right-4 z-50 bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg flex items-center space-x-2 animate-fade-in">
          <Check className="w-5 h-5" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Quick Actions */}
      <div className={`${bg.secondary} rounded-lg shadow-sm border ${border.primary} p-6`}>
        <h3 className={`text-lg font-semibold ${text.primary} mb-4`}>{t('timeTracking.quickActions')}</h3>
        <div className="flex flex-wrap gap-3">
          <button 
            onClick={() => navigate('/time-clock')}
            className={`px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-colors flex items-center space-x-2`}
          >
            <Clock className="w-4 h-4" />
            <span>{t('timeTrackingActions.recordTime')}</span>
          </button>
          <button 
            onClick={() => setShowLeaveModal(true)}
            className={`px-4 py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white transition-colors flex items-center space-x-2`}
          >
            <Calendar className="w-4 h-4" />
            <span>{t('timeTrackingActions.requestLeave')}</span>
          </button>
          <button 
            onClick={() => setShowOvertimeModal(true)}
            className={`px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-700 text-white transition-colors flex items-center space-x-2`}
          >
            <TrendingUp className="w-4 h-4" />
            <span>{t('timeTrackingActions.logOvertime')}</span>
          </button>
          <button 
            onClick={handleExportReport}
            className={`px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2`}
          style={{
            backgroundColor: isDarkMode ? '#374151' : '#ffffff', // gray-700 : white
            borderColor: isDarkMode ? '#4b5563' : '#d1d5db', // gray-600 : gray-300
            color: isDarkMode ? '#ffffff' : '#111827' // white : gray-900
          }}>
            <Download className="w-4 h-4" />
            <span>{t('timeTrackingActions.exportReport')}</span>
          </button>
        </div>
      </div>

      {/* Leave Request Modal */}
      {showLeaveModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className={`${bg.secondary} rounded-lg shadow-xl max-w-md w-full p-6`}>
            <div className="flex justify-between items-center mb-4">
              <h3 className={`text-xl font-semibold ${text.primary}`}>
                {t('timeTracking.requestLeave', 'Request Leave')}
              </h3>
              <button onClick={() => setShowLeaveModal(false)} className={`${text.secondary} hover:${text.primary}`}>
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleLeaveSubmit} className="space-y-4">
              <div>
                <label className={`block text-sm font-medium ${text.primary} mb-2`}>
                  {t('timeTracking.leaveType', 'Leave Type')}
                </label>
                <select
                  value={leaveForm.type}
                  onChange={(e) => setLeaveForm({ ...leaveForm, type: e.target.value })}
                  className={`w-full px-4 py-2 rounded-lg border ${input.className}`}
                >
                  <option value="vacation">{t('timeTracking.vacation', 'Vacation')}</option>
                  <option value="sick">{t('timeTracking.sickLeave', 'Sick Leave')}</option>
                  <option value="personal">{t('timeTracking.personal', 'Personal Leave')}</option>
                  <option value="unpaid">{t('timeTracking.unpaid', 'Unpaid Leave')}</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={`block text-sm font-medium ${text.primary} mb-2`}>
                    {t('timeTracking.startDate', 'Start Date')}
                  </label>
                  <input
                    type="date"
                    value={leaveForm.startDate}
                    onChange={(e) => setLeaveForm({ ...leaveForm, startDate: e.target.value })}
                    required
                    className={`w-full px-4 py-2 rounded-lg border ${input.className}`}
                  />
                </div>
                <div>
                  <label className={`block text-sm font-medium ${text.primary} mb-2`}>
                    {t('timeTracking.endDate', 'End Date')}
                  </label>
                  <input
                    type="date"
                    value={leaveForm.endDate}
                    onChange={(e) => setLeaveForm({ ...leaveForm, endDate: e.target.value })}
                    required
                    className={`w-full px-4 py-2 rounded-lg border ${input.className}`}
                  />
                </div>
              </div>

              <div>
                <label className={`block text-sm font-medium ${text.primary} mb-2`}>
                  {t('timeTracking.reason', 'Reason')}
                </label>
                <textarea
                  value={leaveForm.reason}
                  onChange={(e) => setLeaveForm({ ...leaveForm, reason: e.target.value })}
                  rows="3"
                  placeholder={t('timeTracking.reasonPlaceholder', 'Briefly explain your leave request...')}
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
                  className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
                >
                  {t('common.submit', 'Submit Request')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Overtime Log Modal */}
      {showOvertimeModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className={`${bg.secondary} rounded-lg shadow-xl max-w-md w-full p-6`}>
            <div className="flex justify-between items-center mb-4">
              <h3 className={`text-xl font-semibold ${text.primary}`}>
                {t('timeTracking.logOvertime', 'Log Overtime')}
              </h3>
              <button onClick={() => setShowOvertimeModal(false)} className={`${text.secondary} hover:${text.primary}`}>
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleOvertimeSubmit} className="space-y-4">
              <div>
                <label className={`block text-sm font-medium ${text.primary} mb-2`}>
                  {t('timeTracking.date', 'Date')}
                </label>
                <input
                  type="date"
                  value={overtimeForm.date}
                  onChange={(e) => setOvertimeForm({ ...overtimeForm, date: e.target.value })}
                  max={new Date().toISOString().split('T')[0]}
                  required
                  className={`w-full px-4 py-2 rounded-lg border ${input.className}`}
                />
              </div>

              <div>
                <label className={`block text-sm font-medium ${text.primary} mb-2`}>
                  {t('timeTracking.overtimeHours', 'Overtime Hours')}
                </label>
                <input
                  type="number"
                  step="0.5"
                  min="0.5"
                  max="12"
                  value={overtimeForm.hours}
                  onChange={(e) => setOvertimeForm({ ...overtimeForm, hours: e.target.value })}
                  required
                  placeholder="2.5"
                  className={`w-full px-4 py-2 rounded-lg border ${input.className}`}
                />
              </div>

              <div>
                <label className={`block text-sm font-medium ${text.primary} mb-2`}>
                  {t('timeTracking.reason', 'Reason')}
                </label>
                <textarea
                  value={overtimeForm.reason}
                  onChange={(e) => setOvertimeForm({ ...overtimeForm, reason: e.target.value })}
                  rows="3"
                  placeholder={t('timeTracking.overtimePlaceholder', 'Describe the work performed during overtime...')}
                  required
                  className={`w-full px-4 py-2 rounded-lg border ${input.className}`}
                />
              </div>

              <div className="flex space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowOvertimeModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  {t('common.cancel', 'Cancel')}
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
                >
                  {t('common.submit', 'Log Overtime')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default TimeTracking;
