import React, { useState, useEffect } from 'react'
import { Clock, Calendar, ArrowDownAZ, Users, X, Check, Pickaxe, Hourglass, CalendarArrowDown, CalendarArrowUp, FileText, Coffee, CircleFadingArrowUp, Loader, BarChart3, PieChart } from 'lucide-react'
import { useTheme } from '../contexts/ThemeContext'
import { useLanguage } from '../contexts/LanguageContext'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import * as timeTrackingService from '../services/timeTrackingService'
import WorkDaysModal from './workDaysModal';
import MetricDetailModal from './metricDetailModal';

const TimeTracking = ({ employees }) => {
  const { user, checkPermission } = useAuth();
  const { isDarkMode, toggleTheme, button, bg, text, border, hover, input } = useTheme();
  const { t } = useLanguage();
  const navigate = useNavigate();
  
  // Check if user can view overview tab (admin/manager only)
  const canViewOverview = checkPermission('canViewReports');
  
  // Auto-detect current logged-in user's employee_id
  const getCurrentEmployeeId = () => {
    if (user?.employeeId) {
      const userEmployee = employees.find(emp => emp.id === user.employeeId);
      if (userEmployee) return String(user.employeeId);
    }
    return employees[0]?.id ? String(employees[0].id) : null;
  };
  
  const [selectedEmployee, setSelectedEmployee] = useState(getCurrentEmployeeId());
      // Sorting state for overview table
      const [sortKey, setSortKey] = useState('employee');
      const [sortDirection, setSortDirection] = useState('asc'); // 'asc' or 'desc'

      // Sorting function for overview table
      const getSortedEmployees = () => {
        const sorted = [...allEmployeesData];
        sorted.sort((a, b) => {
          let aValue, bValue;
          switch (sortKey) {
            case 'employee':
              aValue = a.employee.name?.toLowerCase() || '';
              bValue = b.employee.name?.toLowerCase() || '';
              break;
            case 'days_worked':
              aValue = a.data?.days_worked || 0;
              bValue = b.data?.days_worked || 0;
              break;
            case 'regular_hours':
              aValue = a.data?.regular_hours || 0;
              bValue = b.data?.regular_hours || 0;
              break;
            case 'overtime':
              aValue = (a.data?.overtime_hours || 0) + (a.data?.holiday_overtime_hours || 0);
              bValue = (b.data?.overtime_hours || 0) + (b.data?.holiday_overtime_hours || 0);
              break;
            case 'total_hours':
              aValue = a.data?.total_hours || 0;
              bValue = b.data?.total_hours || 0;
              break;
            default:
              aValue = 0;
              bValue = 0;
          }
          if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
          if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
          return 0;
        });
        return sorted;
      };

      // Handle header click for sorting
      const handleSort = (key) => {
        if (sortKey === key) {
          setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
        } else {
          setSortKey(key);
          setSortDirection('asc');
        }
      };
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1); // 1-indexed for Supabase
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  // Add 'leaveRequests' tab for admin/manager
  const [activeTab, setActiveTab] = useState('overview'); // 'summary', 'overview', 'leaveRequests'
  
  // Loading and data states
  const [loading, setLoading] = useState(true);
  const [summaryData, setSummaryData] = useState(null);
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [allLeaveRequests, setAllLeaveRequests] = useState([]);
  const [processingRequests, setProcessingRequests] = useState({}); // { [requestId]: true }
  const [timeEntries, setTimeEntries] = useState([]);
  const [allEmployeesData, setAllEmployeesData] = useState([]);
  
  // Modal states
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [showOvertimeModal, setShowOvertimeModal] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [modalConfig, setModalConfig] = useState({ type: '', data: [], title: '' });
  const [showWorkDaysModal, setShowWorkDaysModal] = useState(false);
  
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

  // Auto-select current user on mount
  useEffect(() => {
    if (user?.employeeId && !selectedEmployee) {
      setSelectedEmployee(String(user.employeeId));
    }
  }, [user]);
  
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
        // Fetch leave requests for selected employee
        const leaveResult = await timeTrackingService.getLeaveRequests(selectedEmployee, {
          year: selectedYear
        });
        if (leaveResult.success) {
          setLeaveRequests(leaveResult.data);
        }
        // Fetch time entries (includes overtime)
        const startDate = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-01`;
        const endDate = new Date(selectedYear, selectedMonth, 0).toISOString().split('T')[0];
        const entriesResult = await timeTrackingService.getTimeEntries(selectedEmployee, {
          startDate: startDate,
          endDate: endDate
        });
        if (entriesResult.success) {
          setTimeEntries(entriesResult.data);
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

  // Fetch all leave requests for all employees (admin/manager only)
  useEffect(() => {
    const fetchAllLeaveRequests = async () => {

      // Use the same permission guard that shows the Overview tab
      // (some installs grant a 'canViewReports' capability rather than 'admin'/'manager')
      console.log('[DEBUG] fetchAllLeaveRequests canViewOverview:', canViewOverview, 'activeTab:', activeTab);

      if (!canViewOverview) {
        console.log('[DEBUG] fetchAllLeaveRequests: user lacks canViewReports permission — skipping');
        setAllLeaveRequests([]);
        return;
      }

      // Only fetch when the Leave Requests tab is active (avoid unnecessary queries)
      if (activeTab !== 'leaveRequests') return;

      try {
        const result = await timeTrackingService.getAllLeaveRequests({});
        console.log('[DEBUG] getAllLeaveRequests result:', result);
        if (result.success && Array.isArray(result.data)) {
          setAllLeaveRequests(result.data);
        } else {
          setAllLeaveRequests([]);
        }
      } catch (error) {
        console.error('Error fetching all leave requests:', error);
        setAllLeaveRequests([]);
      }
    };
    fetchAllLeaveRequests();
  }, [canViewOverview, activeTab, selectedMonth, selectedYear]);

  // Approve / Reject handlers for admin actions on leave requests
  const handleApproveRequest = async (requestId) => {
    if (!user?.employeeId) {
      setSuccessMessage(t('timeTracking.actionError', 'Unable to determine approver'));
      setTimeout(() => setSuccessMessage(''), 3000);
      return;
    }

    setProcessingRequests(prev => ({ ...prev, [requestId]: true }));
    try {
      const result = await timeTrackingService.updateLeaveRequestStatus(requestId, 'approved', user.employeeId);
      if (result.success) {
        // If service returned the updated row use it, otherwise update status locally
        const updated = result.data || { id: requestId, status: 'approved' };
        setAllLeaveRequests(prev => prev.map(r => r.id === requestId ? { ...r, ...updated, status: 'approved', approved_by_name: updated.approved_by_name || (user?.name || '-') } : r));
        setSuccessMessage(t('timeTracking.approveSuccess', 'Request approved'));
      } else {
        setSuccessMessage(result.error || t('timeTracking.actionError', 'Error updating request'));
      }
    } catch (error) {
      console.error('Error approving leave request:', error);
      setSuccessMessage(t('timeTracking.actionError', 'Error updating request'));
    } finally {
      setProcessingRequests(prev => { const copy = { ...prev }; delete copy[requestId]; return copy; });
      setTimeout(() => setSuccessMessage(''), 3000);
    }
  };

  const handleRejectRequest = async (requestId) => {
    if (!user?.employeeId) {
      setSuccessMessage(t('timeTracking.actionError', 'Unable to determine approver'));
      setTimeout(() => setSuccessMessage(''), 3000);
      return;
    }

    // Ask for a rejection reason (simple prompt for now)
    const reason = window.prompt(t('timeTracking.rejectReasonPrompt', 'Please enter a reason for rejection (optional):'));
    if (reason === null) return; // user cancelled

    setProcessingRequests(prev => ({ ...prev, [requestId]: true }));
    try {
      const result = await timeTrackingService.updateLeaveRequestStatus(requestId, 'rejected', user.employeeId, reason || null);
      if (result.success) {
        const updated = result.data || { id: requestId, status: 'rejected' };
        setAllLeaveRequests(prev => prev.map(r => r.id === requestId ? { ...r, ...updated, status: 'rejected' } : r));
        setSuccessMessage(t('timeTracking.rejectSuccess', 'Request rejected'));
      } else {
        setSuccessMessage(result.error || t('timeTracking.actionError', 'Error updating request'));
      }
    } catch (error) {
      console.error('Error rejecting leave request:', error);
      setSuccessMessage(t('timeTracking.actionError', 'Error updating request'));
    } finally {
      setProcessingRequests(prev => { const copy = { ...prev }; delete copy[requestId]; return copy; });
      setTimeout(() => setSuccessMessage(''), 3000);
    }
  };
  
  // Fetch all employees data for Overview
  useEffect(() => {
    const fetchAllEmployeesData = async () => {
      try {
        const results = await Promise.all(
          employees.map(async (emp) => {
            const result = await timeTrackingService.getTimeTrackingSummary(
              String(emp.id),
              selectedMonth,
              selectedYear
            );
            return {
              employee: emp,
              data: result.success ? result.data : null
            };
          })
        );
        setAllEmployeesData(results);
      } catch (error) {
        console.error('Error fetching all employees data:', error);
      }
    };
    
    if (activeTab === 'overview') {
      fetchAllEmployeesData();
    }
  }, [activeTab, selectedMonth, selectedYear, employees]);
  
  // Calculate leave days from leave_requests (including pending)
  const calculateLeaveDays = () => {
    if (!leaveRequests || leaveRequests.length === 0) return 0;
    
    return leaveRequests.reduce((total, req) => {
      // Include pending and approved, exclude rejected
      if (req.status === 'rejected') return total;
      
      const startDate = new Date(req.start_date);
      const endDate = new Date(req.end_date);
      const reqMonth = startDate.getMonth() + 1;
      const reqYear = startDate.getFullYear();
      
      // Only count if within selected month/year
      if (reqYear === selectedYear && reqMonth === selectedMonth) {
        return total + (req.days_count || 0);
      }
      return total;
    }, 0);
  };
  
  const calculatedLeaveDays = calculateLeaveDays();
  
  const currentData = summaryData || {
    days_worked: 0,
    leave_days: 0,
    overtime_hours: 0,
    holiday_overtime_hours: 0,
    regular_hours: 0,
    total_hours: 0,
    attendance_rate: 0
  };
  
  // Override leave_days with calculated value (includes pending)
  currentData.leave_days = calculatedLeaveDays;

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
        const overtimeEntries = timeEntries.filter(entry => 
          ['weekend', 'holiday', 'bonus'].includes(entry.hour_type)
        );
        data = overtimeEntries.map(entry => ({
          employeeName: selectedEmp.name,
          requestType: entry.hour_type,
          date: entry.date,
          status: entry.status,
          hours: entry.hours
        }));
        title = t('timeTracking.overtime');
        break;
      case 'regularHours':
        data = [{
          employeeName: selectedEmp.name,
          department: selectedEmp.department,
          regularHours: currentData.regular_hours,
          totalHours: currentData.total_hours
        }];
        title = t('timeTracking.regularHours');
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
        
        // Refresh leave requests and summary data
        const leaveResult = await timeTrackingService.getLeaveRequests(selectedEmployee, {
          year: selectedYear
        });
        if (leaveResult.success) {
          setLeaveRequests(leaveResult.data);
        }
        
        // Refresh summary to update leave days count
        const summaryResult = await timeTrackingService.getTimeTrackingSummary(
          selectedEmployee,
          selectedMonth,
          selectedYear
        );
        if (summaryResult.success) {
          setSummaryData(summaryResult.data);
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
      // Log overtime as a time_entry (same table as timeClock.jsx)
      // Calculate clock in/out times for the overtime hours
      const overtimeHours = parseFloat(overtimeForm.hours);
      const clockIn = '17:00'; // Default start time for overtime
      const clockOutTime = new Date(`${overtimeForm.date}T${clockIn}`);
      clockOutTime.setHours(clockOutTime.getHours() + Math.floor(overtimeHours));
      clockOutTime.setMinutes(clockOutTime.getMinutes() + Math.round((overtimeHours % 1) * 60));
      const clockOut = clockOutTime.toTimeString().slice(0, 5);
      
      const result = await timeTrackingService.createTimeEntry({
        employeeId: selectedEmployee,
        date: overtimeForm.date,
        clockIn: clockIn,
        clockOut: clockOut,
        hours: overtimeHours,
        hourType: 'weekend', // Log as weekend overtime (goes to overtime_hours in summary)
        notes: overtimeForm.reason || 'Overtime work'
      });
      
      if (result.success) {
        setSuccessMessage(t('timeTracking.overtimeSuccess', 'Overtime logged successfully!'));
        setShowOvertimeModal(false);
        
        // Refresh summary data to reflect new overtime
        const summaryResult = await timeTrackingService.getTimeTrackingSummary(
          selectedEmployee,
          selectedMonth,
          selectedYear
        );
        if (summaryResult.success) {
          setSummaryData(summaryResult.data);
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
      ['Total Hours', (currentData.total_hours || 0).toFixed(1)],
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
            className={`${input.bg} ${input.text} px-4 py-2 border ${input.border} rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${isDarkMode ? 'hover:bg-gray-500 hover:border-amber-50' : 'hover:bg-gray-100 hover:border-amber-800'}`}
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
            className={`${input.bg} ${input.text} px-4 py-2 border ${input.border} rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${isDarkMode ? 'hover:bg-gray-500 hover:border-amber-50' : 'hover:bg-gray-100 hover:border-amber-800'}`}
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
            className={`${input.bg} ${input.text} px-4 py-2 border ${input.border} rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${isDarkMode ? 'hover:bg-gray-500 hover:border-amber-50' : 'hover:bg-gray-100 hover:border-amber-800'}`}
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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <TimeCard
          title={t('timeTracking.workDays')}
          value={currentData.days_worked || 0}
          unit={t('timeTracking.days')}
          icon={Calendar}
          color={isDarkMode ? "text-white" : "text-black"}
          bgColor="bg-white"
          onClick={() => setShowWorkDaysModal(true)}
        />
        <TimeCard
          title={t('timeTracking.leaveDays')}
          value={calculatedLeaveDays.toFixed(0)}
          unit={t('timeTracking.days')}
          icon={Coffee}
          color={isDarkMode ? "text-white" : "text-black"}
          bgColor="bg-white"
          onClick={() => handleMetricClick('leaveDays')}
        />
        <TimeCard
          title={t('timeTracking.overtime')}
          value={(currentData.overtime_hours || 0) + (currentData.holiday_overtime_hours || 0)}
          unit={t('timeTracking.hours')}
          icon={Clock}
          color={isDarkMode ? "text-white" : "text-black"}
          bgColor="bg-white"
          onClick={() => handleMetricClick('overtime')}
        />
      </div>

      {/* Tab Navigation */}
      <div className={`${bg.secondary} rounded-lg shadow-sm border ${border.primary} p-2`}>
        <div className="flex space-x-2">
          <button
            onClick={() => setActiveTab('summary')}
            className={`flex-1 px-4 py-2 rounded-lg transition-colors flex items-center justify-center space-x-2 ${
              activeTab === 'summary'
                ? 'bg-blue-600 text-white'
                : `${text.secondary} hover:${bg.primary}`
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>{t('timeTracking.summary', 'Summary')}</span>
          </button>
          {/* Only show overview tab for admin/manager */}
          {canViewOverview && (
            <>
              <button
                onClick={() => setActiveTab('overview')}
                className={`flex-1 px-4 py-2 rounded-lg transition-colors flex items-center justify-center space-x-2 ${
                  activeTab === 'overview'
                    ? 'bg-blue-600 text-white'
                    : `${text.secondary} hover:${bg.primary}`
                }`}
              >
                <Users className="w-4 h-4" />
                <span>{t('timeTracking.overview', 'Overview')}</span>
              </button>
              <button
                onClick={() => setActiveTab('leaveRequests')}
                className={`flex-1 px-4 py-2 rounded-lg transition-colors flex items-center justify-center space-x-2 ${
                  activeTab === 'leaveRequests'
                    ? 'bg-blue-600 text-white'
                    : `${text.secondary} hover:${bg.primary}`
                }`}
              >
                <Coffee className="w-4 h-4" />
                <span>{t('timeTracking.leaveRequests', 'Leave Request Management')}</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Summary Tab */}
      {activeTab === 'summary' && (
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
              <span className={`font-medium ${text.primary}`}>
                {((currentData.overtime_hours || 0) + (currentData.holiday_overtime_hours || 0)).toFixed(1)} {t('timeTracking.hrs')}
              </span>
            </div>
            <div className="flex justify-between">
              <span className={`${text.secondary} mr-12`}>{t('timeTracking.totalHours')}:</span>
              <span className={`font-medium ${text.primary}`}>{parseFloat(currentData.total_hours || 0).toFixed(1)} {t('timeTracking.hrs')}</span>
            </div>
          </div>
          
          <div className="space-y-3 ">
            <div className="flex justify-between">
              <span className={`${text.secondary} ml-12`}>{t('timeTracking.workDays')}:</span>
              <span className={`font-medium ${text.primary}`}>{currentData.days_worked || 0} {t('timeTracking.days')}</span>
            </div>
            <div className="flex justify-between">
              <span className={`${text.secondary} ml-12`}>{t('timeTracking.leaveDays')}:</span>
              <span className={`font-medium ${text.primary}`}>
                {calculatedLeaveDays.toFixed(1)} {t('timeTracking.days')}
                <span className="text-xs text-gray-500 ml-1">({t('timeTracking.includesPending', '*incl. pending')})</span>
              </span>
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
      )}

      {/* Overview Tab */}
      {activeTab === 'overview' && (
      <div className={`${bg.secondary} rounded-lg shadow-sm border ${border.primary} p-6`}>
        <h3 className={`text-lg font-semibold ${text.primary} mb-4`}>
          {t('timeTracking.overviewTitle', 'Company Overview')} - {getMonthName(selectedMonth)} {selectedYear}
        </h3>
      
        {/* Regular Hours By Employee */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <div className={`${bg.primary} rounded-lg p-4 border ${border.primary}`}>
            <div className="flex items-center space-x-2 mb-4">
              <BarChart3 className={`w-5 h-5 ${text.primary}`} />
              <h4 className={`font-semibold ${text.primary}`}>
                {t('timeTracking.regularHoursChart', 'Regular Hours by Employee')}
              </h4>
            </div>
            <div className="space-y-3">
              {allEmployeesData
                .filter(item => item.data)
                .sort((a, b) => (b.data?.regular_hours || 0) - (a.data?.regular_hours || 0))
                .slice(0, 10)
                .map((item, index) => {
                  const maxHours = Math.max(...getSortedEmployees().map(i => i.data?.regular_hours || 0));
                  const percentage = maxHours > 0 ? ((item.data?.regular_hours || 0) / maxHours) * 100 : 0;
                  return (
                    <div key={index} className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className={text.secondary}>{item.employee.name}</span>
                        <span className={text.primary}>{item.data?.regular_hours || 0} hrs</span>
                      </div>
                      <div className={`w-full ${isDarkMode ? 'bg-gray-700' : 'bg-gray-200'} rounded-full h-2`}>
                        <div
                          className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
            </div>
            <div className="mt-4 flex items-center justify-center space-x-2">
              <div className="flex items-center space-x-2">
                <div className="w-4 h-4 bg-blue-600 rounded"></div>
                <span className={`text-sm ${text.secondary}`}>{t('timeTracking.regularHoursLegend', 'Regular Hours')}</span>
              </div>
            </div>
          </div>

          {/* Total Overtime Hours By Employee */}
          <div className={`${bg.primary} rounded-lg p-4 border ${border.primary}`}>
            <div className="flex items-center space-x-2 mb-4">
              <PieChart className={`w-5 h-5 ${text.primary}`} />
              <h4 className={`font-semibold ${text.primary}`}>
                {t('timeTracking.overtimeHoursChart', 'Overtime Hours by Employee')}
              </h4>
            </div>
            <div className="space-y-3">
              {allEmployeesData
                .filter(item => item.data)
                .sort((a, b) => {
                  const aTotal = (b.data?.overtime_hours || 0) + (b.data?.holiday_overtime_hours || 0);
                  const bTotal = (a.data?.overtime_hours || 0) + (a.data?.holiday_overtime_hours || 0);
                  return aTotal - bTotal;
                })
                .slice(0, 10)
                .map((item, index) => {
                  const overtimeTotal = (item.data?.overtime_hours || 0) + (item.data?.holiday_overtime_hours || 0);
                  const maxOT = Math.max(...getSortedEmployees().map(i => 
                    (i.data?.overtime_hours || 0) + (i.data?.holiday_overtime_hours || 0)
                  ));
                  const percentage = maxOT > 0 ? (overtimeTotal / maxOT) * 100 : 0;
                  return (
                    <div key={index} className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className={text.secondary}>{item.employee.name}</span>
                        <span className={text.primary}>{overtimeTotal.toFixed(1)} hrs</span>
                      </div>
                      <div className={`w-full ${isDarkMode ? 'bg-gray-700' : 'bg-gray-200'} rounded-full h-2`}>
                        <div
                          className="bg-orange-600 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
            </div>
            <div className="mt-4 flex items-center justify-center space-x-2">
              <div className="flex items-center space-x-2">
                <div className="w-4 h-4 bg-orange-600 rounded"></div>
                <span className={`text-sm ${text.secondary}`}>{t('timeTracking.totalOvertimeLegend', 'Total Overtime')}</span>
              </div>
            </div>
          </div>
        </div>

        {/* All Employees Table */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className={`border-b ${border.primary}`}>
                <th
                  className={`text-left py-3 px-4 ${text.primary} font-semibold cursor-pointer select-none`}
                  onClick={() => handleSort('employee')}
                >
                  <span className="inline-flex items-center gap-1">
                    {t('timeTracking.employee', 'Employee')}
                    <ArrowDownAZ
                      className={`inline w-4 h-4 ml-1 transition-all-0.5s ${sortKey === 'employee' ? isDarkMode ? 'text-white' : 'text-black' : 'text-gray-400 hover:animate-pulse'}`}
                      style={{transition: 'transform 0.5s', transform: sortKey === 'employee' && sortDirection === 'asc' ? 'rotate(180deg)' : 'none' }}
                    />
                  </span>
                </th>
                <th
                  className={`text-right py-3 px-4 ${text.primary} font-semibold cursor-pointer select-none`}
                  onClick={() => handleSort('days_worked')}
                >
                  <span className="inline-flex items-center gap-1">
                    {t('timeTracking.daysWorked', 'Days Worked')}
                    {sortKey === 'days_worked' ? (
                      sortDirection === 'asc' ? (
                        <CalendarArrowUp
                          className={`inline w-4 h-4 ml-1 transition-all-0.5s ${isDarkMode ? 'text-white' : 'text-black'}`}
                        />
                      ) : (
                        <CalendarArrowDown
                          className={`inline w-4 h-4 ml-1 transition-all-0.5s ${isDarkMode ? 'text-white' : 'text-black'}`}
                        />
                      )
                    ) : (
                      <CalendarArrowUp className="inline w-4 h-4 ml-1 transition-all-0.5s text-gray-400 hover:animate-pulse transition-all" />
                    )}
                  </span>
                </th>
                <th
                  className={`text-right py-3 px-4 ${text.primary} font-semibold cursor-pointer select-none`}
                  onClick={() => handleSort('regular_hours')}
                >
                  <span className="inline-flex items-center gap-1">
                    {t('timeTracking.regularHours', 'Regular Hours')}
                    <CircleFadingArrowUp
                      className={`inline w-4 h-4  ml-1 transition-all ${sortKey === 'regular_hours' ? isDarkMode ? 'text-white' : 'text-black' : 'text-gray-400 hover:animate-pulse'}`}
                      style={{transition: 'transform 0.5s', transform: sortKey === 'regular_hours' && sortDirection === 'asc' ? 'rotate(540deg)' : 'none' }}
                    />
                  </span>
                </th>
                <th
                  className={`text-right py-3 px-4 ${text.primary} font-semibold cursor-pointer select-none`}
                  onClick={() => handleSort('overtime')}
                >
                  <span className="inline-flex items-center gap-1">
                    {t('timeTracking.overtime', 'Overtime')}
                    <Pickaxe
                      className={`inline w-3 h-3 ml-1 transition-all ${sortKey === 'overtime' ? isDarkMode ? 'text-white' : 'text-black' : 'text-gray-400 hover:animate-pulse'}`}
                      style={{transition: 'transform 0.5s', transform: sortKey === 'overtime' && sortDirection === 'asc' ? 'rotate(90deg)' : 'none' }}
                    />
                  </span>
                </th>
                <th
                  className={`text-right py-3 px-4 ${text.primary} font-semibold cursor-pointer select-none`}
                  onClick={() => handleSort('total_hours')}
                >
                  <span className={`inline-flex items-center gap-1 `}>
                    {t('timeTracking.totalHoursLabel', 'Total Hours')}
                    <Hourglass
                      className={`inline w-3.5 h-3.5 ml-1 transition-all-0.5s ${sortKey === 'total_hours' ? isDarkMode ? 'text-white' : 'text-black' : 'text-gray-400 hover:animate-pulse'}`}
                      style={{transition: 'transform 0.5s', transform: sortKey === 'total_hours' && sortDirection === 'asc' ? 'rotate(180deg)' : 'none' }}
                    />
                  </span>
                </th>
              </tr>
            </thead>
            <tbody>
              {getSortedEmployees().map((item, idx) => (
                <tr key={item.employee.id || idx}>
                  <td className={`text-left py-3 px-4 ${text.secondary}`}>{item.employee.name}</td>
                  <td className={`text-right py-3 px-4 ${text.secondary}`}>{item.data?.days_worked || 0}</td>
                  <td className={`text-right py-3 px-4 ${text.secondary}`}>{item.data?.regular_hours?.toFixed(1) || '0.0'}</td>
                  <td className={`text-right py-3 px-4 ${text.secondary}`}>{((item.data?.overtime_hours || 0) + (item.data?.holiday_overtime_hours || 0)).toFixed(1)}</td>
                  <td className={`text-right py-3 px-4 font-semibold ${text.primary}`}>{parseFloat(item.data?.total_hours || 0).toFixed(1)}</td>
                </tr>
              ))}
              <tr className={`border-t-2 ${border.primary} font-bold`}>
                <td className={`py-3 px-4 ${text.primary}`}>Total</td>
                <td className={`text-right py-3 px-4 ${text.primary}`}>
                  {allEmployeesData.reduce((sum, item) => sum + (item.data?.days_worked || 0), 0)}
                </td>
                <td className={`text-right py-3 px-4 ${text.primary}`}>
                  {allEmployeesData.reduce((sum, item) => sum + (item.data?.regular_hours || 0), 0).toFixed(1)}
                </td>
                <td className={`text-right py-3 px-4 ${text.primary}`}>
                  {allEmployeesData.reduce((sum, item) => 
                    sum + (item.data?.overtime_hours || 0) + (item.data?.holiday_overtime_hours || 0), 0
                  ).toFixed(1)}
                </td>
                <td className={`text-right py-3 px-4 ${text.primary}`}>
                  {allEmployeesData.reduce((sum, item) => sum + (item.data?.total_hours || 0), 0).toFixed(1)}
                </td>
              </tr>
            </tbody>
          </table>

        </div>
      </div>
      )}

      {/* Leave Requests Tab (moved out of overview) */}
      {activeTab === 'leaveRequests' && canViewOverview && (
        <div className={`${bg.secondary} rounded-lg shadow-sm border ${border.primary} p-6 mt-6`}>
          <h3 className={`text-lg font-semibold ${text.primary} mb-4`}>{t('timeTracking.leaveRequestManagement', 'Leave Request Management')} - {getMonthName(selectedMonth)} {selectedYear}</h3>
          <div className="mt-2">
            {(() => { console.log('DEBUG allLeaveRequests (render):', allLeaveRequests?.length); return null; })()}
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className={`border-b ${border.primary}`}>
                    <th className="py-2 px-4 text-left">{t('timeTracking.leaveDays', 'Leave Days')}</th>
                    <th className="py-2 px-4 text-left">{t('timeTracking.leaveType', 'Leave Type')}</th>
                    <th className="py-2 px-4 text-left">{t('timeTracking.status', 'Status')}</th>
                    <th className="py-2 px-4 text-left">{t('timeTracking.requestedBy', 'Requested By')}</th>
                    <th className="py-2 px-4 text-left">{t('timeTracking.approvedBy', 'Approved By')}</th>
                  </tr>
                </thead>
                <tbody>
                  {allLeaveRequests.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-4 text-center text-gray-500">No leave requests found.</td>
                    </tr>
                  ) : (
                    allLeaveRequests.map((req, idx) => (
                      <tr key={req.id || idx}>
                        <td className="py-2 px-4">{req.days_count}</td>
                        <td className="py-2 px-4">{(function(){
                          switch(req.leave_type){
                            case 'sick': return t('timeTracking.sickLeave', 'Sick Leave');
                            case 'vacation': return t('timeTracking.vacation', 'Vacation');
                            case 'personal': return t('timeTracking.personal', 'Personal Leave');
                            case 'unpaid': return t('timeTracking.unpaid', 'Unpaid Leave');
                            default: return req.leave_type || '-';
                          }
                        })()}</td>
                        <td className="py-2 px-4">{t(`timeTracking.${req.status}`, req.status)}</td>
                        <td className="py-2 px-4">{req.employee?.name || '-'}</td>
                        <td className="py-2 px-4 flex items-center gap-2">
                          {req.status === 'pending' ? (
                            <>
                              <button
                                onClick={() => handleApproveRequest(req.id)}
                                disabled={!!processingRequests[req.id]}
                                title={t('timeTracking.approve', 'Approve')}
                                className={`text-green-600 hover:text-green-800 transition ${processingRequests[req.id] ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                              >
                                <Check className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleRejectRequest(req.id)}
                                disabled={!!processingRequests[req.id]}
                                title={t('timeTracking.reject', 'Reject')}
                                className={`text-red-600 hover:text-red-800 transition ${processingRequests[req.id] ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </>
                          ) : (
                            req.approved_by_name || '-'
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Success Message */}
      {successMessage && (
        <div className="fixed top-4 right-4 z-50 bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg flex items-center space-x-2 animate-fade-in">
          <Check className="w-5 h-5" />
          <span>{successMessage}</span>
        </div>
      )}

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
                  className={`flex-1 px-4 py-2 border ${isDarkMode ? 'border-gray-600 hover:bg-gray-700' : 'border-gray-300 hover:bg-gray-50'} rounded-lg transition-colors`}
                >
                  {t('common.cancel', 'Cancel')}
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
                >
                  {t('common.leaveRequest', 'Submit Request')}
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
