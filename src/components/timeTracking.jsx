import React, { useState, useEffect } from 'react'
import { Clock, Calendar, TrendingUp, Users, X, Check, Download, FileText, Coffee, Zap, Loader } from 'lucide-react'
import { useTheme } from '../contexts/ThemeContext'
import { useLanguage } from '../contexts/LanguageContext'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import * as timeTrackingService from '../services/timeTrackingService'
import MetricDetailModal from './metricDetailModal.jsx'

const TimeTracking = ({ employees }) => {
  const [selectedEmployee, setSelectedEmployee] = useState(employees[0]?.id ? String(employees[0].id) : null);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1); // 1-indexed for Supabase
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const { isDarkMode, toggleTheme, button, bg, text, border, hover, input } = useTheme();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  // Loading and data states
  const [loading, setLoading] = useState(true);
  const [summaryData, setSummaryData] = useState(null);
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [overtimeLogs, setOvertimeLogs] = useState([]);
  
  // Modal states
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [showOvertimeModal, setShowOvertimeModal] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [modalConfig, setModalConfig] = useState({ type: '', data: [], title: '' });
  
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

  // Fetch data from Supabase when employee or period changes
  useEffect(() => {
    const fetchTimeTrackingData = async () => {
      if (!selectedEmployee) return;
      
      setLoading(true);
      try {
        // Fetch summary data
        const summaryResult = await timeTrackingService.getTimeTrackingSummary(
          selectedEmployee,
          selectedMonth,
          selectedYear
        );
        
        if (summaryResult.success) {
          setSummaryData(summaryResult.data);
        }
        
        // Fetch leave requests
        const leaveResult = await timeTrackingService.getLeaveRequests(selectedEmployee, {
          year: selectedYear
        });
        
        if (leaveResult.success) {
          setLeaveRequests(leaveResult.data);
        }
        
        // Fetch overtime logs
        const overtimeResult = await timeTrackingService.getOvertimeLogs(selectedEmployee, {
          month: selectedMonth,
          year: selectedYear
        });
        
        if (overtimeResult.success) {
          setOvertimeLogs(overtimeResult.data);
        }
      } catch (error) {
        console.error('Error fetching time tracking data:', error);
        setSuccessMessage('');
      } finally {
        setLoading(false);
      }
    };
    
    fetchTimeTrackingData();
  }, [selectedEmployee, selectedMonth, selectedYear]);
  
  const currentData = summaryData || {
    days_worked: 0,
    leave_days: 0,
    overtime_hours: 0,
    holiday_overtime_hours: 0,
    regular_hours: 0,
    total_hours: 0,
    attendance_rate: 0
  };

  const months = [
    t('months.january'), t('months.february'), t('months.march'), t('months.april'), 
    t('months.may'), t('months.june'), t('months.july'), t('months.august'), 
    t('months.september'), t('months.october'), t('months.november'), t('months.december')
  ];
  
  const getMonthName = (monthIndex) => {
    return months[monthIndex - 1] || months[0];
  };

  const years = [2023, 2024, 2025];

  const handleMetricClick = (metricType) => {
    let data = [];
    let title = '';
    
    const selectedEmp = employees.find(emp => String(emp.id) === selectedEmployee);
    if (!selectedEmp) return;
    
    switch(metricType) {
      case 'workDays':
        data = [{
          employeeName: selectedEmp.name,
          department: selectedEmp.department,
          workDays: currentData.days_worked,
          overtime: currentData.overtime_hours
        }];
        title = t('timeTracking.workDays');
        break;
      case 'leaveDays':
        data = leaveRequests.map(req => ({
          employeeName: selectedEmp.name,
          requestType: req.leave_type,
          date: req.start_date,
          status: req.status
        }));
        title = t('timeTracking.leaveDays');
        break;
      case 'overtime':
        data = overtimeLogs.map(log => ({
          employeeName: selectedEmp.name,
          requestType: log.overtime_type,
          date: log.date,
          status: log.status,
          hours: log.hours
        }));
        title = t('timeTracking.overtime');
        break;
      default:
        return;
    }
    
    setModalConfig({ type: metricType === 'leaveDays' || metricType === 'overtime' ? 'pendingRequests' : metricType, data, title });
    setModalOpen(true);
  };
  
  const TimeCard = ({ title, value, unit, icon: Icon, color, bgColor, onClick }) => (
    <div 
      className={`rounded-lg p-6 border ${border.primary} ${onClick ? 'cursor-pointer transition-all duration-300 hover:shadow-lg hover:-translate-y-1' : ''}`}
      onClick={onClick}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className={`text-sm font-medium ${text.secondary}`}>{title}</p>
          <p className={`text-2xl font-bold ${color} mt-1`}>
            {value}
            <span className={`text-sm font-normal ${text.secondary} ml-1`}>{unit}</span>
          </p>
        </div>
        <div>
          <Icon className={`h-8 w-8 ${color}`} />
        </div>
      </div>
    </div>
  );

  // Handler functions
  const handleLeaveSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const result = await timeTrackingService.createLeaveRequest({
        employeeId: selectedEmployee,
        type: leaveForm.type,
        startDate: leaveForm.startDate,
        endDate: leaveForm.endDate,
        reason: leaveForm.reason
      });
      
      if (result.success) {
        setSuccessMessage(t('timeTracking.leaveSuccess', 'Leave request submitted successfully!'));
        setShowLeaveModal(false);
        
        // Refresh data
        const leaveResult = await timeTrackingService.getLeaveRequests(selectedEmployee, {
          year: selectedYear
        });
        if (leaveResult.success) {
          setLeaveRequests(leaveResult.data);
        }
        
        // Reset form
        setLeaveForm({
          type: 'vacation',
          startDate: '',
          endDate: '',
          reason: ''
        });
      } else {
        setSuccessMessage(t('timeTracking.leaveError', 'Error submitting leave request'));
      }
    } catch (error) {
      console.error('Error submitting leave:', error);
      setSuccessMessage(t('timeTracking.leaveError', 'Error submitting leave request'));
    } finally {
      setLoading(false);
      setTimeout(() => setSuccessMessage(''), 3000);
    }
  };

  const handleOvertimeSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const result = await timeTrackingService.createOvertimeLog({
        employeeId: selectedEmployee,
        date: overtimeForm.date,
        hours: parseFloat(overtimeForm.hours),
        reason: overtimeForm.reason,
        overtimeType: 'regular'
      });
      
      if (result.success) {
        setSuccessMessage(t('timeTracking.overtimeSuccess', 'Overtime logged successfully!'));
        setShowOvertimeModal(false);
        
        // Refresh data
        const overtimeResult = await timeTrackingService.getOvertimeLogs(selectedEmployee, {
          month: selectedMonth,
          year: selectedYear
        });
        if (overtimeResult.success) {
          setOvertimeLogs(overtimeResult.data);
        }
        
        // Reset form
        setOvertimeForm({
          date: new Date().toISOString().split('T')[0],
          hours: '',
          reason: ''
        });
      } else {
        setSuccessMessage(t('timeTracking.overtimeError', 'Error logging overtime'));
      }
    } catch (error) {
      console.error('Error submitting overtime:', error);
      setSuccessMessage(t('timeTracking.overtimeError', 'Error logging overtime'));
    } finally {
      setLoading(false);
      setTimeout(() => setSuccessMessage(''), 3000);
    }
  };

  const handleExportReport = () => {
    // Generate CSV data
    const employee = employees.find(emp => String(emp.id) === selectedEmployee);
    const csvData = [
      ['Time Tracking Report'],
      ['Employee', employee?.name || 'Unknown'],
      ['Period', `${getMonthName(selectedMonth)} ${selectedYear}`],
      [''],
      ['Metric', 'Value'],
      ['Days Worked', currentData.days_worked || 0],
      ['Leave Days', currentData.leave_days || 0],
      ['Overtime Hours', currentData.overtime_hours || 0],
      ['Holiday Overtime', currentData.holiday_overtime_hours || 0],
      ['Regular Hours', currentData.regular_hours || 0],
      ['Total Hours', currentData.total_hours || 0],
      ['Attendance Rate', `${(currentData.attendance_rate || 0).toFixed(1)}%`]
    ];

    // Convert to CSV string
    const csvContent = csvData.map(row => row.join(',')).join('\n');
    
    // Create download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', `timetracking_${employee?.name}_${getMonthName(selectedMonth)}_${selectedYear}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    setSuccessMessage(t('timeTracking.exportSuccess', 'Report exported successfully!'));
    setTimeout(() => setSuccessMessage(''), 3000);
  };

  return (
    <div className="space-y-4 md:space-y-6 px-2 sm:px-0">
      {/* Loading Overlay */}
      {loading && (
        <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
          <div className={`${bg.secondary} rounded-lg p-6 flex items-center space-x-3`}>
            <Loader className="w-6 h-6 animate-spin text-blue-600" />
            <span className={text.primary}>{t('common.loading', 'Loading...')}</span>
          </div>
        </div>
      )}
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className={`font-bold ${text.primary}`} style={{fontSize: 'clamp(1.25rem, 3vw, 1.5rem)'}}>{t('timeTracking.title')}</h2>
        <div className="flex space-x-4">
          {/* Employee Selector */}
          <select
            value={selectedEmployee}
            onChange={(e) => setSelectedEmployee(String(e.target.value))}
            className={`${input.bg} ${input.text} px-4 py-2 border ${input.border} rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500`}
          >
            {employees.map(employee => (
              <option key={employee.id} value={String(employee.id)}>
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
              <option key={index + 1} value={index + 1}>
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
          value={currentData.days_worked || 0}
          unit={t('timeTracking.days')}
          icon={Calendar}
          color="text-blue-600"
          bgColor="bg-white"
          onClick={() => handleMetricClick('workDays')}
        />
        <TimeCard
          title={t('timeTracking.leaveDays')}
          value={currentData.leave_days || 0}
          unit={t('timeTracking.days')}
          icon={Coffee}
          color="text-orange-600"
          bgColor="bg-white"
          onClick={() => handleMetricClick('leaveDays')}
        />
        <TimeCard
          title={t('timeTracking.overtime')}
          value={currentData.overtime_hours || 0}
          unit={t('timeTracking.hours')}
          icon={Clock}
          color="text-purple-600"
          bgColor="bg-white"
          onClick={() => handleMetricClick('overtime')}
        />
        <TimeCard
          title={t('timeTracking.holidayOvertime')}
          value={currentData.holiday_overtime_hours || 0}
          unit={t('timeTracking.hours')}
          icon={Zap}
          color="text-green-600"
          bgColor="bg-white"
        />
      </div>

      {/* Detailed Summary */}
      <div className={`${bg.secondary} rounded-lg shadow-sm border ${border.primary} p-6`}>
        <h3 className={`text-lg font-semibold ${text.primary} mb-4`}>
          {t('timeTracking.summary', `Summary for ${employees.find(emp => String(emp.id) === selectedEmployee)?.name} - ${getMonthName(selectedMonth)} ${selectedYear}`)}
        </h3>
        
        <div className="grid grid-cols-[repeat(auto-fit,minmax(380px,1fr))] gap-6">
          <div className="space-y-3 ">
            <div className="flex justify-between">
              <span className={`${text.secondary} mr-12`}>{t('timeTracking.regularHours')}:</span>
              <span className={`font-medium ${text.primary}`}>{currentData.regular_hours || 0} {t('timeTracking.hrs')}</span>
            </div>
            <div className="flex justify-between">
              <span className={`${text.secondary} mr-12`}>{t('timeTracking.overtimeHours')}:</span>
              <span className={`font-medium ${text.primary}`}>{currentData.overtime_hours || 0} {t('timeTracking.hrs')}</span>
            </div>
            <div className="flex justify-between">
              <span className={`${text.secondary} mr-12`}>{t('timeTracking.totalHours')}:</span>
              <span className={`font-medium ${text.primary}`}>{currentData.total_hours || 0} {t('timeTracking.hrs')}</span>
            </div>
          </div>
          
          <div className="space-y-3 ">
            <div className="flex justify-between">
              <span className={`${text.secondary} ml-12`}>{t('timeTracking.workDays')}:</span>
              <span className={`font-medium ${text.primary}`}>{currentData.days_worked || 0} {t('timeTracking.days')}</span>
            </div>
            <div className="flex justify-between">
              <span className={`${text.secondary} ml-12`}>{t('timeTracking.leaveDays')}:</span>
              <span className={`font-medium ${text.primary}`}>{currentData.leave_days || 0} {t('timeTracking.days')}</span>
            </div>
            <div className="flex justify-between">
              <span className={`${text.secondary} ml-12`}>{t('timeTracking.holidayOvertime')}:</span>
              <span className={`font-medium ${text.primary}`}>{currentData.holiday_overtime_hours || 0} {t('timeTracking.hrs')}</span>
            </div>
            <div className={`flex justify-between border-t ${border.primary} pt-3`}>
              <span className={`${text.primary} font-semibold ml-12`}>{t('timeTracking.attendanceRate')}:</span>
              <span className={`font-bold ${text.primary}`}>
                {(currentData.attendance_rate || 0).toFixed(1)}%
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
      
      {/* Metric Detail Modal */}
      <MetricDetailModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        metricType={modalConfig.type}
        data={modalConfig.data}
        title={modalConfig.title}
      />
    </div>
  );
};

export default TimeTracking;
