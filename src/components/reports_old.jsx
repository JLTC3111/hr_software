import React, { useState, useEffect, useMemo } from 'react';
import { BarChart3, Download, Calendar, Filter, Users, Clock, Target, AlertCircle, Loader, FileText, Database, CheckCircle, XCircle, PlayCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import * as timeTrackingService from '../services/timeTrackingService';
import * as workloadService from '../services/workloadService';
import * as performanceService from '../services/performanceService';
import { supabase } from '../config/supabaseClient';

const Reports = () => {
  const [activeTab, setActiveTab] = useState('time-entries');
  const [selectedEmployee, setSelectedEmployee] = useState('all');
  const [dateRange, setDateRange] = useState('this-month');
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [employees, setEmployees] = useState([]);
  const [reportData, setReportData] = useState({
    timeEntries: [],
    tasks: [],
    goals: []
  });
  const [filters, setFilters] = useState({
    startDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
    status: 'all',
    hourType: 'all',
    taskStatus: 'all',
    goalStatus: 'all'
  });

  const { t } = useLanguage();
  const { isDarkMode, text, bg, border } = useTheme();
  const { checkPermission, user } = useAuth();
  const navigate = useNavigate();
  
  // Check permission to view reports
  const canViewReports = checkPermission('canViewReports');
  
  // If user doesn't have permission, show access denied
  if (!canViewReports) {
    return (
      <div className={`min-h-screen ${bg.primary} flex items-center justify-center p-4`}>
        <div className={`${bg.secondary} rounded-lg shadow-lg border ${border.primary} p-8 max-w-md w-full text-center`}>
          <AlertCircle className={`w-16 h-16 ${isDarkMode ? 'text-red-400' : 'text-red-600'} mx-auto mb-4`} />
          <h2 className={`text-2xl font-bold ${text.primary} mb-2`}>
            {t('common.accessDenied', 'Access Denied')}
          </h2>
          <p className={`${text.secondary} mb-6`}>
            {t('common.noPermission', 'You do not have permission to access this page.')}
          </p>
          <button
            onClick={() => navigate('/')}
            className={`px-6 py-2 rounded-lg ${isDarkMode ? 'bg-blue-600 hover:bg-blue-700' : 'bg-blue-500 hover:bg-blue-600'} text-white transition-colors`}
          >
            {t('common.goBack', 'Go Back')}
          </button>
        </div>
      </div>
    );
  }

  // Fetch employees on component mount
  useEffect(() => {
    const fetchEmployees = async () => {
      try {
        const { data, error } = await supabase
          .from('employees')
          .select('id, name, department, position, email')
          .eq('status', 'Active')
          .order('name');

        if (error) throw error;
        setEmployees(data || []);
      } catch (error) {
        console.error('Error fetching employees:', error);
        setEmployees([]);
      }
    };

    fetchEmployees();
  }, []);

  // Update date range when preset changes
  useEffect(() => {
    const now = new Date();
    let startDate, endDate;

    switch (dateRange) {
      case 'today':
        startDate = endDate = now.toISOString().split('T')[0];
        break;
      case 'this-week':
        const weekStart = new Date(now.setDate(now.getDate() - now.getDay()));
        startDate = weekStart.toISOString().split('T')[0];
        endDate = new Date().toISOString().split('T')[0];
        break;
      case 'this-month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
        endDate = new Date().toISOString().split('T')[0];
        break;
      case 'last-month':
        const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        startDate = lastMonth.toISOString().split('T')[0];
        endDate = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split('T')[0];
        break;
      case 'this-quarter':
        const quarterStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
        startDate = quarterStart.toISOString().split('T')[0];
        endDate = new Date().toISOString().split('T')[0];
        break;
      case 'this-year':
        startDate = new Date(now.getFullYear(), 0, 1).toISOString().split('T')[0];
        endDate = new Date().toISOString().split('T')[0];
        break;
      default:
        return; // Custom range, don't update
    }

    setFilters(prev => ({ ...prev, startDate, endDate }));
  }, [dateRange]);

  // Fetch report data
  useEffect(() => {
    const fetchReportData = async () => {
      setLoading(true);
      try {
        const results = await Promise.allSettled([
          fetchTimeEntries(),
          fetchTasks(),
          fetchGoals()
        ]);

        const [timeEntriesResult, tasksResult, goalsResult] = results;

        setReportData({
          timeEntries: timeEntriesResult.status === 'fulfilled' ? timeEntriesResult.value : [],
          tasks: tasksResult.status === 'fulfilled' ? tasksResult.value : [],
          goals: goalsResult.status === 'fulfilled' ? goalsResult.value : []
        });
      } catch (error) {
        console.error('Error fetching report data:', error);
      } finally {
        setLoading(false);
      }
    };

    if (employees.length > 0) {
      fetchReportData();
    }
  }, [employees, filters, selectedEmployee]);

  // Fetch time entries
  const fetchTimeEntries = async () => {
    try {
      let query = supabase
        .from('time_entries')
        .select(`
          *,
          employee:employee_id(id, name, department, position, email)
        `)
        .gte('date', filters.startDate)
        .lte('date', filters.endDate)
        .order('date', { ascending: false });

      if (selectedEmployee !== 'all') {
        query = query.eq('employee_id', selectedEmployee);
      }

      if (filters.status !== 'all') {
        query = query.eq('status', filters.status);
      }

      if (filters.hourType !== 'all') {
        query = query.eq('hour_type', filters.hourType);
      }

      const { data, error } = await query;
      if (error) throw error;

      return data || [];
    } catch (error) {
      console.error('Error fetching time entries:', error);
      return [];
    }
  };

  // Fetch tasks
  const fetchTasks = async () => {
    try {
      let query = supabase
        .from('workload_tasks')
        .select(`
          *,
          employee:employee_id(id, name, department, position, email)
        `)
        .gte('created_at', filters.startDate)
        .lte('created_at', filters.endDate + 'T23:59:59')
        .order('created_at', { ascending: false });

      if (selectedEmployee !== 'all') {
        query = query.eq('employee_id', selectedEmployee);
      }

      if (filters.taskStatus !== 'all') {
        query = query.eq('status', filters.taskStatus);
      }

      const { data, error } = await query;
      if (error) throw error;

      return data || [];
    } catch (error) {
      console.error('Error fetching tasks:', error);
      return [];
    }
  };

  // Fetch goals
  const fetchGoals = async () => {
    try {
      let query = supabase
        .from('performance_goals')
        .select(`
          *,
          employee:employee_id(id, name, department, position, email)
        `)
        .gte('created_at', filters.startDate)
        .lte('created_at', filters.endDate + 'T23:59:59')
        .order('created_at', { ascending: false });

      if (selectedEmployee !== 'all') {
        query = query.eq('employee_id', selectedEmployee);
      }

      if (filters.goalStatus !== 'all') {
        query = query.eq('status', filters.goalStatus);
      }

      const { data, error } = await query;
      if (error) throw error;

      return data || [];
    } catch (error) {
      console.error('Error fetching goals:', error);
      return [];
    }
  };

  // Export functions
  const exportToCSV = (data, filename) => {
    try {
      if (!data || data.length === 0) {
        alert(t('reports.noDataToExport', 'No data to export'));
        return;
      }

      // Get headers from first object
      const headers = Object.keys(data[0]);
      
      // Create CSV content
      let csv = headers.join(',') + '\n';
      
      data.forEach((row) => {
        const values = headers.map(header => {
          const value = row[header];
          // Handle null/undefined values
          if (value === null || value === undefined) {
            return '';
          }
          // Handle values with commas or quotes
          if (typeof value === 'string' && (value.includes(',') || value.includes('"') || value.includes('\n'))) {
            return `"${value.replace(/"/g, '""')}"`;
          }
          return value;
        });
        csv += values.join(',') + '\n';
      });

      // Create download link
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      
      link.setAttribute('href', url);
      link.setAttribute('download', `${filename}_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Clean up the URL object
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error exporting CSV:', error);
      alert(t('reports.errorExporting', 'Error exporting data') + ': ' + error.message);
    }
  };

  // Export time entries
  const exportTimeEntries = () => {
    setExporting(true);
    try {
      const exportData = reportData.timeEntries.map(entry => ({
        [t('employees.name', 'Employee Name')]: entry.employee?.name || 'Unknown',
        [t('employees.department', 'Department')]: entry.employee?.department || '',
        [t('employees.position', 'Position')]: entry.employee?.position || '',
        [t('timeTracking.date', 'Date')]: entry.date,
        [t('timeTracking.clockIn', 'Clock In')]: entry.clock_in || '',
        [t('timeTracking.clockOut', 'Clock Out')]: entry.clock_out || '',
        [t('timeTracking.hours', 'Hours')]: entry.hours || 0,
        [t('timeTracking.hourType', 'Hour Type')]: entry.hour_type || '',
        [t('timeTracking.status', 'Status')]: entry.status || '',
        [t('timeTracking.notes', 'Notes')]: entry.notes || '',
        [t('general.createdAt', 'Created At')]: new Date(entry.created_at).toLocaleString()
      }));

      const employeeName = selectedEmployee !== 'all' ? 
        employees.find(emp => emp.id === parseInt(selectedEmployee))?.name.replace(/\s+/g, '_') || 'employee' : 
        'all_employees';
      
      exportToCSV(exportData, `time_entries_${employeeName}_${filters.startDate}_to_${filters.endDate}`);
    } catch (error) {
      console.error('Error exporting time entries:', error);
      alert(t('reports.errorExporting', 'Error exporting data'));
    } finally {
      setExporting(false);
    }
  };

  // Export tasks
  const exportTasks = () => {
    setExporting(true);
    try {
      const exportData = reportData.tasks.map(task => ({
        [t('employees.name', 'Employee Name')]: task.employee?.name || 'Unknown',
        [t('employees.department', 'Department')]: task.employee?.department || '',
        [t('workload.taskTitle', 'Task Title')]: task.title || '',
        [t('workload.description', 'Description')]: task.description || '',
        [t('workload.priority', 'Priority')]: task.priority || '',
        [t('workload.status', 'Status')]: task.status || '',
        [t('workload.dueDate', 'Due Date')]: task.due_date || '',
        [t('workload.estimatedHours', 'Estimated Hours')]: task.estimated_hours || 0,
        [t('workload.actualHours', 'Actual Hours')]: task.actual_hours || 0,
        [t('taskPerformance.qualityRating', 'Quality Rating')]: task.quality_rating || 0,
        [t('taskPerformance.comments', 'Comments')]: task.performance_comments || '',
        [t('general.createdAt', 'Created At')]: new Date(task.created_at).toLocaleString(),
        [t('general.updatedAt', 'Updated At')]: new Date(task.updated_at).toLocaleString()
      }));

      const employeeName = selectedEmployee !== 'all' ? 
        employees.find(emp => emp.id === parseInt(selectedEmployee))?.name.replace(/\s+/g, '_') || 'employee' : 
        'all_employees';
      
      exportToCSV(exportData, `tasks_${employeeName}_${filters.startDate}_to_${filters.endDate}`);
    } catch (error) {
      console.error('Error exporting tasks:', error);
      alert(t('reports.errorExporting', 'Error exporting data'));
    } finally {
      setExporting(false);
    }
  };

  // Export goals
  const exportGoals = () => {
    setExporting(true);
    try {
      const exportData = reportData.goals.map(goal => ({
        [t('employees.name', 'Employee Name')]: goal.employee?.name || 'Unknown',
        [t('employees.department', 'Department')]: goal.employee?.department || '',
        [t('goals.title', 'Goal Title')]: goal.title || '',
        [t('goals.description', 'Description')]: goal.description || '',
        [t('goals.category', 'Category')]: goal.category || '',
        [t('goals.status', 'Status')]: goal.status || '',
        [t('goals.targetDate', 'Target Date')]: goal.target_date || '',
        [t('goals.progress', 'Progress')]: goal.progress || 0,
        [t('goals.notes', 'Notes')]: goal.notes || '',
        [t('general.createdAt', 'Created At')]: new Date(goal.created_at).toLocaleString(),
        [t('general.updatedAt', 'Updated At')]: new Date(goal.updated_at).toLocaleString()
      }));

      const employeeName = selectedEmployee !== 'all' ? 
        employees.find(emp => emp.id === parseInt(selectedEmployee))?.name.replace(/\s+/g, '_') || 'employee' : 
        'all_employees';
      
      exportToCSV(exportData, `goals_${employeeName}_${filters.startDate}_to_${filters.endDate}`);
    } catch (error) {
      console.error('Error exporting goals:', error);
      alert(t('reports.errorExporting', 'Error exporting data'));
    } finally {
      setExporting(false);
    }
  };

  // Get current tab data and stats
  const getCurrentData = () => {
    switch (activeTab) {
      case 'time-entries':
        return reportData.timeEntries;
      case 'tasks':
        return reportData.tasks;
      case 'goals':
        return reportData.goals;
      default:
        return [];
    }
  };

  const currentData = getCurrentData();

  // Calculate stats for current data
  const stats = useMemo(() => {
    const data = getCurrentData();
    const totalRecords = data.length;
    
    if (activeTab === 'time-entries') {
      const totalHours = data.reduce((sum, entry) => sum + (entry.hours || 0), 0);
      const pendingEntries = data.filter(entry => entry.status === 'pending').length;
      const approvedEntries = data.filter(entry => entry.status === 'approved').length;
      
      return {
        totalRecords,
        totalHours: totalHours.toFixed(1),
        pending: pendingEntries,
        approved: approvedEntries,
        rejected: data.filter(entry => entry.status === 'rejected').length
      };
    } else if (activeTab === 'tasks') {
      const completedTasks = data.filter(task => task.status === 'completed').length;
      const inProgressTasks = data.filter(task => task.status === 'in-progress').length;
      const pendingTasks = data.filter(task => task.status === 'pending').length;
      
      return {
        totalRecords,
        completed: completedTasks,
        inProgress: inProgressTasks,
        pending: pendingTasks,
        completionRate: totalRecords > 0 ? ((completedTasks / totalRecords) * 100).toFixed(1) : 0
      };
    } else if (activeTab === 'goals') {
      const achievedGoals = data.filter(goal => goal.status === 'achieved').length;
      const inProgressGoals = data.filter(goal => goal.status === 'in-progress').length;
      const averageProgress = totalRecords > 0 ? 
        (data.reduce((sum, goal) => sum + (goal.progress || 0), 0) / totalRecords).toFixed(1) : 0;
      
      return {
        totalRecords,
        achieved: achievedGoals,
        inProgress: inProgressGoals,
        pending: data.filter(goal => goal.status === 'pending').length,
        averageProgress
      };
    }
    
    return { totalRecords };
  }, [activeTab, reportData]);
      </div>
    );
  }
  
  // Get current month and year
  const currentDate = new Date();
  const currentMonth = currentDate.getMonth() + 1;
  const currentYear = currentDate.getFullYear();
  
  // Fetch all report data from backend
  useEffect(() => {
    const fetchReportData = async () => {
      setLoading(true);
      try {
        // Fetch overview stats
        const overviewResult = await reportService.getOverviewStats();
        if (overviewResult.success) {
          setReportData(overviewResult.data);
        } else {
          console.error('Error fetching overview stats:', overviewResult.error);
        }
        
        // Fetch performance trend
        const trendResult = await reportService.getPerformanceTrend();
        if (trendResult.success) {
          setPerformanceTrend(trendResult.data);
        } else {
          console.error('Error fetching performance trend:', trendResult.error);
        }
      } catch (error) {
        console.error('Error fetching report data:', error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchReportData();
  }, []);

  const dateRanges = [
    { value: 'last-week', label: t('reports.lastWeek') },
    { value: 'last-month', label: t('reports.lastMonth') },
    { value: 'last-quarter', label: t('reports.lastQuarter') },
    { value: 'last-year', label: t('reports.lastYear') },
    { value: 'custom', label: t('reports.customRange') }
  ];

  const departments = [
    t('departments.all'), 
    t('departments.legal_compliance'),
    t('departments.technology'),
    t('departments.internal_affairs'),
    t('departments.human_resources'),
    t('departments.office_unit'),
    t('departments.board_of_directors'),
    t('departments.finance'),
    t('departments.engineering'), 
    t('departments.sales'), 
    t('departments.marketing'), 
    t('departments.design'),
    t('departments.part_time_employee')
  ];

  const handleMetricClick = async (metricType) => {
    let data = [];
    let title = '';
    
    try {
      const { supabase } = await import('../config/supabaseClient');
      
      switch(metricType) {
        case 'employees':
          const { data: allEmployees, error: empError } = await supabase
            .from('employees')
            .select('name, department, position, status');
          
          if (empError) throw empError;
          
          data = allEmployees.map(emp => ({
            employeeName: emp.name,
            department: emp.department,
            position: emp.position,
            status: emp.status
          }));
          title = t('reports.totalEmployees');
          break;
          
        case 'newHires':
          const threeMonthsAgo = new Date();
          threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
          
          const { data: newHireData, error: hireError } = await supabase
            .from('employees')
            .select('name, department, position, start_date')
            .gte('start_date', threeMonthsAgo.toISOString().split('T')[0]);
          
          if (hireError) throw hireError;
          
          data = newHireData.map(emp => ({
            employeeName: emp.name,
            department: emp.department,
            position: emp.position,
            startDate: emp.start_date
          }));
          title = t('reports.newHires');
          break;
          
        default:
          return;
      }
      
      setModalConfig({ type: metricType, data, title });
      setModalOpen(true);
    } catch (error) {
      console.error('Error fetching metric data:', error);
      alert(t('reports.errorFetchingData', 'Error fetching data'));
    }
  };

  // Get date range for filters
  const getDateRangeFilters = () => {
    const today = new Date();
    let dateFrom, dateTo = today.toISOString().split('T')[0];
    
    switch(dateRange) {
      case 'last-week':
        dateFrom = new Date(today.setDate(today.getDate() - 7)).toISOString().split('T')[0];
        break;
      case 'last-month':
        dateFrom = new Date(today.setMonth(today.getMonth() - 1)).toISOString().split('T')[0];
        break;
      case 'last-quarter':
        dateFrom = new Date(today.setMonth(today.getMonth() - 3)).toISOString().split('T')[0];
        break;
      case 'last-year':
        dateFrom = new Date(today.setFullYear(today.getFullYear() - 1)).toISOString().split('T')[0];
        break;
      default:
        dateFrom = null;
    }
    
    return { dateFrom, dateTo };
  };

  // Handle report generation
  const handleGenerateReport = async () => {
    setGenerating(true);
    const { dateFrom, dateTo } = getDateRangeFilters();
    const filters = {
      department,
      dateFrom,
      dateTo,
      month: currentMonth,
      year: currentYear
    };

    try {
      let result;
      
      switch(reportType) {
        case 'performance':
          result = await reportService.generatePerformanceReport(filters);
          break;
        case 'salary':
          result = await reportService.generateSalaryReport(filters);
          break;
        case 'attendance':
          result = await reportService.generateAttendanceReport(filters);
          break;
        case 'recruitment':
          result = await reportService.generateRecruitmentReport(filters);
          break;
        case 'department':
          result = await reportService.generateDepartmentReport(filters);
          break;
        default:
          result = await reportService.generatePerformanceReport(filters);
      }

      if (result.success) {
        setGeneratedReport(result.data);
        alert(t('reports.reportGenerated', 'Report generated successfully!'));
      } else {
        alert(t('reports.reportError', 'Error generating report: ') + result.error);
      }
    } catch (error) {
      console.error('Error generating report:', error);
      alert(t('reports.reportError', 'Error generating report'));
    } finally {
      setGenerating(false);
    }
  };

  // Handle pre-built report generation
  const handlePrebuiltReport = async (reportName) => {
    setGenerating(true);
    const { dateFrom, dateTo } = getDateRangeFilters();
    
    try {
      let result;
      
      switch(reportName) {
        case 'performance':
          result = await reportService.generatePerformanceReport({ dateFrom, dateTo });
          break;
        case 'salary':
          result = await reportService.generateSalaryReport({ dateFrom, dateTo });
          break;
        case 'attendance':
          result = await reportService.generateAttendanceReport({
            month: currentMonth,
            year: currentYear
          });
          break;
        case 'recruitment':
          result = await reportService.generateRecruitmentReport({ dateFrom, dateTo });
          break;
        case 'turnover':
          result = await reportService.generateTurnoverReport({ dateFrom, dateTo });
          break;
        case 'department':
          result = await reportService.generateDepartmentReport({ dateFrom, dateTo });
          break;
        default:
          return;
      }

      if (result.success) {
        setGeneratedReport(result.data);
        alert(t('reports.reportGenerated', 'Report generated successfully!'));
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setGenerating(false);
    }
  };

  // Handle export to CSV
  const handleExportCSV = (data, filename) => {
    try {
      if (!data || (Array.isArray(data) && data.length === 0)) {
        alert(t('reports.noDataToExport', 'No data to export'));
        return;
      }
      
      console.log('Attempting to export CSV with data:', data.length, 'records');
      console.log('Sample record:', data[0]);
      
      reportService.exportToCSV(data, filename);
      console.log('CSV export completed successfully');
    } catch (error) {
      console.error('Error in handleExportCSV:', error);
      alert(t('reports.errorExporting', 'Error exporting data') + ': ' + error.message);
    }
  };

  // Handle export all data
  const handleExportAll = async () => {
    try {
      const { supabase } = await import('../config/supabaseClient');
      
      // First, let's check what columns are available
      const { data: allEmployees, error } = await supabase
        .from('employees')
        .select('*');
      
      if (error) {
        console.error('Database error:', error);
        throw error;
      }
      
      if (!allEmployees || allEmployees.length === 0) {
        alert(t('reports.noDataToExport', 'No employee data found to export'));
        return;
      }
      
      // Map the data with available fields only and use translated headers
      const exportData = allEmployees.map(emp => {
        const mappedData = {};
        
        // Only include fields that exist and have values, using translated headers
        if (emp.name) mappedData[t('employees.name', 'Name')] = emp.name;
        if (emp.department) {
          mappedData[t('employees.department', 'Department')] = t(`departments.${emp.department}`, emp.department);
        }
        if (emp.position) {
          mappedData[t('employees.position', 'Position')] = t(`employeePosition.${emp.position}`, emp.position);
        }
        if (emp.email) mappedData[t('employees.email', 'Email')] = emp.email;
        if (emp.phone) mappedData[t('employees.phone', 'Phone')] = emp.phone;
        if (emp.status) {
          // Translate status values
          let statusKey = '';
          switch(emp.status.toLowerCase()) {
            case 'active':
              statusKey = 'employees.active';
              break;
            case 'inactive':
              statusKey = 'employees.inactive';
              break;
            case 'on leave':
            case 'onleave':
              statusKey = 'employees.onLeave';
              break;
            default:
              statusKey = '';
          }
          mappedData[t('employees.status', 'Status')] = statusKey ? t(statusKey, emp.status) : emp.status;
        }
        if (emp.salary !== null && emp.salary !== undefined) mappedData[t('employees.salary', 'Salary')] = emp.salary;
        if (emp.start_date) mappedData[t('employees.startDate', 'Start Date')] = emp.start_date;
        if (emp.created_at) mappedData[t('general.createdAt', 'Created At')] = emp.created_at;
        if (emp.id) mappedData[t('general.id', 'ID')] = emp.id;
        
        return mappedData;
      });
      
      console.log('Export data prepared:', exportData.length, 'records');
      handleExportCSV(exportData, 'all_employees');
    } catch (error) {
      console.error('Error exporting data:', error);
      console.error('Error details:', error.message, error.code, error.details);
      alert(t('reports.errorExporting', 'Error exporting data') + ': ' + error.message);
    }
  };

  const StatCard = ({
      title,
      value,
      subtitle,
      icon: Icon,
      color = isDarkMode ? 'text-white' : 'text-gray-800',
      bg = isDarkMode ? 'bg-gray-700' : 'bg-gray-100',
      trend,
      onClick
    }) => (
      <div 
        className={`rounded-lg shadow-sm border p-6 transition-all duration-300 hover:shadow-lg hover:-translate-y-1 cursor-pointer group scale-in 
                    ${isDarkMode ? 'bg-gray-800 border-gray-600' : 'bg-white border-gray-300'}`}
        onClick={onClick}
      >
        <div className="flex items-center justify-between">
          <div>
            <p 
              className={`text-sm font-medium transition-colors duration-200 
                          ${isDarkMode ? 'text-gray-300' : 'text-gray-500'}`}
            >
              {title}
            </p>

            <p 
              className={`text-2xl font-bold mt-1 transition-all duration-200 group-hover:scale-105 ${color}`}
            >
              {value}
            </p>

            {subtitle && (
              <p 
                className={`text-sm mt-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}
              >
                {subtitle}
              </p>
            )}
          </div>

          <div 
            className={`p-3 rounded-full transition-transform duration-300 group-hover:scale-110 group-hover:rotate-6 
                        ${bg} flex items-center justify-center`}
          >
            <Icon className={`h-6 w-6 ${color}`} />
          </div>
        </div>

        {trend && (
          <div className="mt-4 flex items-center">
            <TrendingUp className="h-4 w-4 text-green-500 mr-1" />
            <span className="text-sm text-green-600">
              {trend}% {t('reports.fromLastPeriod')}
            </span>
          </div>
        )}
      </div>
    );

  const ChartContainer = ({ title, children, actions }) => (
    <div 
      className="rounded-lg shadow-sm border p-6"
      style={{
        backgroundColor: isDarkMode ? '#374151' : '#ffffff',
        color: isDarkMode ? '#ffffff' : '#111827',
        borderColor: isDarkMode ? '#4b5563' : '#d1d5db'
      }}
    >
      <div className="flex items-center justify-between mb-6">
        <h3 
          className="text-lg font-semibold"
          style={{
            backgroundColor: 'transparent',
            color: isDarkMode ? '#ffffff' : '#111827',
            borderColor: 'transparent'
          }}
        >
          {title}
        </h3>
        {actions && (
          <div className="flex space-x-2">
            {actions}
          </div>
        )}
      </div>
      {children}
    </div>
  );

  const DepartmentChart = () => (
    <ChartContainer 
      title={t('reports.departmentOverview')}
      actions={
        <button 
          className="p-2 hover:text-gray-600"
          style={{
            backgroundColor: 'transparent',
            color: isDarkMode ? '#9ca3af' : '#9ca3af',
            borderColor: 'transparent'
          }}
        >
          <Download className="h-4 w-4" />
        </button>
      }
    >
      <div className="space-y-4">
        {reportData.departmentStats.map((dept, index) => (
          <div key={dept.name} className="flex items-center justify-between gap-15">
            <div className="flex items-center space-x-3">
              <div className={`w-4 h-4 rounded ${dept.color}`}></div>
              <span 
                className="font-medium"
                style={{
                  backgroundColor: 'transparent',
                  color: isDarkMode ? '#ffffff' : '#111827',
                  borderColor: 'transparent'
                }}
              >
                {t(`departments.${dept.name.toLowerCase().replace(/\s+/g, '_')}`, dept.name)}
              </span>
            </div>
            <div 
              className="flex items-center space-x-6 text-sm"
              style={{
                backgroundColor: 'transparent',
                color: isDarkMode ? '#d1d5db' : '#4b5563',
                borderColor: 'transparent'
              }}
            >
              <span>{dept.employees} {t('reports.employees')}</span>
              <span>${dept.avgSalary.toLocaleString()}</span>
              <span>{dept.performance}</span>
            </div>
          </div>
        ))}
      </div>
    </ChartContainer>
  );

  const AttendanceChart = () => (
    <ChartContainer title={t('reports.attendanceOverview')}>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <span 
            style={{
              backgroundColor: 'transparent',
              color: isDarkMode ? '#d1d5db' : '#4b5563',
              borderColor: 'transparent'
            }}
          >
            {t('reports.present')}
          </span>
          <div className="flex items-center space-x-2">
            <div 
              className="w-32 rounded-full h-2"
              style={{
                backgroundColor: isDarkMode ? '#4b5563' : '#e5e7eb'
              }}
            >
              <div className="bg-emerald-600 h-2 rounded-full" style={{ width: `${reportData.attendance.present}%` }}></div>
            </div>
            <span 
              className="text-sm font-medium"
              style={{
                backgroundColor: 'transparent',
                color: isDarkMode ? '#ffffff' : '#111827',
                borderColor: 'transparent'
              }}
            >
              {reportData.attendance.present}% ({reportData.attendance.presentCount})
            </span>
          </div>
        </div>
        <div className="flex items-center justify-between">
          <span 
            style={{
              backgroundColor: 'transparent',
              color: isDarkMode ? '#d1d5db' : '#4b5563',
              borderColor: 'transparent'
            }}
          >
            {t('reports.onLeave')}
          </span>
          <div className="flex items-center space-x-2">
            <div 
              className="w-32 rounded-full h-2"
              style={{
                backgroundColor: isDarkMode ? '#4b5563' : '#e5e7eb'
              }}
            >
              <div className="bg-amber-600 h-2 rounded-full" style={{ width: `${reportData.attendance.leave}%` }}></div>
            </div>
            <span 
              className="text-sm font-medium"
              style={{
                backgroundColor: 'transparent',
                color: isDarkMode ? '#ffffff' : '#111827',
                borderColor: 'transparent'
              }}
            >
              {reportData.attendance.leave}% ({reportData.attendance.leaveCount})
            </span>
          </div>
        </div>
        <div className="flex items-center justify-between">
          <span 
            style={{
              backgroundColor: 'transparent',
              color: isDarkMode ? '#d1d5db' : '#4b5563',
              borderColor: 'transparent'
            }}
          >
            {t('reports.absent')}
          </span>
          <div className="flex items-center space-x-2">
            <div 
              className="w-32 rounded-full h-2"
              style={{
                backgroundColor: isDarkMode ? '#4b5563' : '#e5e7eb'
              }}
            >
              <div className="bg-slate-600 h-2 rounded-full" style={{ width: `${reportData.attendance.absent}%` }}></div>
            </div>
            <span 
              className="text-sm font-medium"
              style={{
                backgroundColor: 'transparent',
                color: isDarkMode ? '#ffffff' : '#111827',
                borderColor: 'transparent'
              }}
            >
              {reportData.attendance.absent}% ({reportData.attendance.absentCount})
            </span>
          </div>
        </div>
      </div>
    </ChartContainer>
  );

  const RecruitmentChart = () => (
    <ChartContainer title={t('reports.recruitmentFunnel')}>
      <div className="space-y-4">
        {[
          { label: t('reports.totalApplications'), value: reportData.recruitment.totalApplications, color: 'bg-sky-700' },
          { label: t('reports.interviewed'), value: reportData.recruitment.interviewed, color: 'bg-amber-600' },
          { label: t('reports.hired'), value: reportData.recruitment.hired, color: 'bg-emerald-700' },
          { label: t('reports.rejected'), value: reportData.recruitment.rejected, color: 'bg-rose-700' }
        ].map((item, index) => (
          <div key={item.label} className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className={`w-4 h-4 rounded ${item.color}`}></div>
              <span 
                style={{
                  backgroundColor: 'transparent',
                  color: isDarkMode ? '#d1d5db' : '#374151',
                  borderColor: 'transparent'
                }}
              >
                {item.label}
              </span>
            </div>
            <span 
              className="font-semibold"
              style={{
                backgroundColor: 'transparent',
                color: isDarkMode ? '#ffffff' : '#111827',
                borderColor: 'transparent'
              }}
            >
              {item.value}
            </span>
          </div>
        ))}
      </div>
    </ChartContainer>
  );

  const PerformanceTrend = () => (
    <ChartContainer title={t('reports.performanceTrend')}>
      <div className="space-y-4">
        {performanceTrend.map((item, index) => (
          <div key={item.month} className="flex items-center justify-between">
            <span 
              style={{
                backgroundColor: 'transparent',
                color: isDarkMode ? '#d1d5db' : '#4b5563',
                borderColor: 'transparent'
              }}
            >
              {item.month}
            </span>
            <div className="flex items-center space-x-2">
              <div 
                className="w-24 rounded-full h-2"
                style={{
                  backgroundColor: isDarkMode ? '#4b5563' : '#e5e7eb'
                }}
              >
                <div 
                  className={`${text.primary} h-2 rounded-full`}
                  style={{ 
                    width: `${(item.rating / 5) * 100}%`,
                    backgroundColor: isDarkMode ? '#3b82f6' : '#2563eb'
                  }}
                ></div>
              </div>
              <span 
                className="text-sm font-medium"
                style={{
                  backgroundColor: 'transparent',
                  color: isDarkMode ? '#ffffff' : '#111827',
                  borderColor: 'transparent'
                }}
              >
                {item.rating}/5.0
              </span>
            </div>
          </div>
        ))}
      </div>
    </ChartContainer>
  );

  const OverviewTab = () => (
    <div className="space-y-6 fade-in">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title={t('reports.totalEmployees')}
          value={reportData.overview.totalEmployees}
          icon={SquareSigma}
          onClick={() => handleMetricClick('employees')}
        />
        <StatCard
          title={t('reports.newHires')}
          value={reportData.overview.newHires}
          subtitle={t('reports.thisQuarter')}
          icon={UserPlus}
          onClick={() => handleMetricClick('newHires')}
        />
        <StatCard
          title={t('reports.avgSalary')}
          value={`$${reportData.overview.avgSalary.toLocaleString()}`}
          icon={PiggyBank}
        />
        <StatCard
          title={t('reports.satisfaction')}
          value={`${reportData.overview.satisfaction}/5.0`}
          icon={HeartPulse}
        />
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <DepartmentChart />
        <AttendanceChart />
        <RecruitmentChart />
        <PerformanceTrend />
      </div>
    </div>
  );

  const DetailedReportsTab = () => (
    <div className="space-y-6">
      <div 
        className="rounded-lg shadow-sm border p-6"
        style={{
          backgroundColor: isDarkMode ? '#374151' : '#ffffff',
          color: isDarkMode ? '#ffffff' : '#111827',
          borderColor: isDarkMode ? '#4b5563' : '#d1d5db'
        }}
      >
        <h3 
          className="text-lg font-semibold mb-4"
          style={{
            backgroundColor: 'transparent',
            color: isDarkMode ? '#ffffff' : '#111827',
            borderColor: 'transparent'
          }}
        >
          {t('reports.generateCustomReport')}
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div>
            <label 
              className="block text-sm font-medium mb-2"
              style={{
                backgroundColor: 'transparent',
                color: isDarkMode ? '#d1d5db' : '#374151',
                borderColor: 'transparent'
              }}
            >
              {t('reports.reportType')}
            </label>
            <select 
              value={reportType}
              onChange={(e) => setReportType(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 cursor-pointer"
              style={{
                backgroundColor: isDarkMode ? '#4b5563' : '#ffffff',
                color: isDarkMode ? '#ffffff' : '#111827',
                borderColor: isDarkMode ? '#6b7280' : '#d1d5db'
              }}
            >
              <option value="performance">{t('reports.employeePerformance')}</option>
              <option value="salary">{t('reports.salaryAnalysis')}</option>
              <option value="attendance">{t('reports.attendanceReport')}</option>
              <option value="recruitment">{t('reports.recruitmentMetrics')}</option>
              <option value="department">{t('reports.departmentComparison')}</option>
            </select>
          </div>
          
          <div>
            <label 
              className="block text-sm font-medium mb-2"
              style={{
                backgroundColor: 'transparent',
                color: isDarkMode ? '#d1d5db' : '#374151',
                borderColor: 'transparent'
              }}
            >
              {t('reports.dateRange')}
            </label>
            <select 
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              style={{
                backgroundColor: isDarkMode ? '#4b5563' : '#ffffff',
                color: isDarkMode ? '#ffffff' : '#111827',
                borderColor: isDarkMode ? '#6b7280' : '#d1d5db'
              }}
            >
              {dateRanges.map(range => (
                <option key={range.value} value={range.value}>
                  {range.label}
                </option>
              ))}
            </select>
          </div>
          
          <div>
            <label 
              className="block text-sm font-medium mb-2"
              style={{
                backgroundColor: 'transparent',
                color: isDarkMode ? '#d1d5db' : '#374151',
                borderColor: 'transparent'
              }}
            >
              {t('reports.department')}
            </label>
            <select 
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              style={{
                backgroundColor: isDarkMode ? '#4b5563' : '#ffffff',
                color: isDarkMode ? '#ffffff' : '#111827',
                borderColor: isDarkMode ? '#6b7280' : '#d1d5db'
              }}
            >
              {departments.map(dept => (
                <option key={dept.toLowerCase()} value={dept.toLowerCase()}>
                  {dept}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex space-x-4">
          <button 
            onClick={handleGenerateReport}
            disabled={generating}
            className={`px-6 py-2 text-white rounded-lg flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-all ${text.primary}`}
            style={{
              backgroundColor: isDarkMode ? '#3b82f6' : '#2563eb',
              color: '#ffffff',
              borderColor: isDarkMode ? '#3b82f6' : '#2563eb'
            }}
          >
            {generating ? <Loader className="h-4 w-4 animate-spin" /> : <BarChart3 className="h-4 w-4" />}
            <span>{generating ? t('common.generating', 'Generating...') : t('reports.generateReport')}</span>
          </button>
          <button 
            onClick={() => generatedReport && handleExportCSV(
              Array.isArray(generatedReport) ? generatedReport : (generatedReport.employees || generatedReport.reviews || generatedReport.summaries || []),
              `${reportType}_report`
            )}
            disabled={!generatedReport}
            className="px-6 py-2 border rounded-lg hover:bg-gray-50 flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-all"
            style={{
              backgroundColor: isDarkMode ? '#4b5563' : '#ffffff',
              color: isDarkMode ? '#d1d5db' : '#374151',
              borderColor: isDarkMode ? '#6b7280' : '#d1d5db'
            }}
          >
            <Download className="h-4 w-4" />
            <span>{t('reports.exportToCSV', 'Export to CSV')}</span>
          </button>
          <button 
            onClick={handleExportAll}
            className="px-6 py-2 border rounded-lg hover:bg-gray-50 flex items-center space-x-2 cursor-pointer transition-all"
            style={{
              backgroundColor: isDarkMode ? '#4b5563' : '#ffffff',
              color: isDarkMode ? '#d1d5db' : '#374151',
              borderColor: isDarkMode ? '#6b7280' : '#d1d5db'
            }}
          >
            <Download className="h-4 w-4" />
            <span>{t('reports.exportAllData', 'Export All Data')}</span>
          </button>
        </div>
      </div>

      {/* Generated Report Display */}
      {generatedReport && (
        <div 
          className="rounded-lg shadow-sm border p-6"
          style={{
            backgroundColor: isDarkMode ? '#374151' : '#ffffff',
            color: isDarkMode ? '#ffffff' : '#111827',
            borderColor: isDarkMode ? '#4b5563' : '#d1d5db'
          }}
        >
          <div className="flex items-center justify-between mb-4">
            <h3 
              className="text-lg font-semibold"
              style={{
                backgroundColor: 'transparent',
                color: isDarkMode ? '#ffffff' : '#111827',
                borderColor: 'transparent'
              }}
            >
              {t('reports.reportResults', 'Report Results')}
            </h3>
            <button
              onClick={() => setGeneratedReport(null)}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              {t('common.close', 'Close')}
            </button>
          </div>

          {/* Performance Report */}
          {generatedReport.reviews && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="p-4 border rounded-lg" style={{ backgroundColor: isDarkMode ? '#4b5563' : '#f9fafb', borderColor: isDarkMode ? '#6b7280' : '#e5e7eb' }}>
                  <p className="text-sm text-gray-500">{t('reports.totalReviews', 'Total Reviews')}</p>
                  <p className="text-2xl font-bold">{generatedReport.metrics?.totalReviews || 0}</p>
                </div>
                <div className="p-4 border rounded-lg" style={{ backgroundColor: isDarkMode ? '#4b5563' : '#f9fafb', borderColor: isDarkMode ? '#6b7280' : '#e5e7eb' }}>
                  <p className="text-sm text-gray-500">{t('reports.averageRating', 'Average Rating')}</p>
                  <p className="text-2xl font-bold">{generatedReport.metrics?.averageRating?.toFixed(1) || 0}</p>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b" style={{ borderColor: isDarkMode ? '#4b5563' : '#e5e7eb' }}>
                      <th className="text-left p-3">{t('reports.employee', 'Employee')}</th>
                      <th className="text-left p-3">{t('reports.rating', 'Rating')}</th>
                      <th className="text-left p-3">{t('reports.reviewDate', 'Review Date')}</th>
                      <th className="text-left p-3">{t('reports.reviewer', 'Reviewer')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {generatedReport.reviews.map((review, idx) => (
                      <tr key={idx} className="border-b" style={{ borderColor: isDarkMode ? '#4b5563' : '#e5e7eb' }}>
                        <td className="p-3">{review.employee?.name || 'N/A'}</td>
                        <td className="p-3">{review.overall_rating || 'N/A'}</td>
                        <td className="p-3">{new Date(review.review_date).toLocaleDateString()}</td>
                        <td className="p-3">{review.reviewer?.name || 'N/A'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Salary Report */}
          {generatedReport.employees && generatedReport.metrics?.averageSalary && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="p-4 border rounded-lg" style={{ backgroundColor: isDarkMode ? '#4b5563' : '#f9fafb', borderColor: isDarkMode ? '#6b7280' : '#e5e7eb' }}>
                  <p className="text-sm text-gray-500">{t('reports.totalEmployees', 'Total Employees')}</p>
                  <p className="text-2xl font-bold">{generatedReport.metrics?.totalEmployees || 0}</p>
                </div>
                <div className="p-4 border rounded-lg" style={{ backgroundColor: isDarkMode ? '#4b5563' : '#f9fafb', borderColor: isDarkMode ? '#6b7280' : '#e5e7eb' }}>
                  <p className="text-sm text-gray-500">{t('reports.averageSalary', 'Average Salary')}</p>
                  <p className="text-2xl font-bold">${generatedReport.metrics?.averageSalary?.toLocaleString() || 0}</p>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b" style={{ borderColor: isDarkMode ? '#4b5563' : '#e5e7eb' }}>
                      <th className="text-left p-3">{t('reports.employee', 'Employee')}</th>
                      <th className="text-left p-3">{t('reports.position', 'Position')}</th>
                      <th className="text-left p-3">{t('reports.department', 'Department')}</th>
                      <th className="text-left p-3">{t('reports.salary', 'Salary')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {generatedReport.employees.map((emp, idx) => (
                      <tr key={idx} className="border-b" style={{ borderColor: isDarkMode ? '#4b5563' : '#e5e7eb' }}>
                        <td className="p-3">{emp.name || 'N/A'}</td>
                        <td className="p-3">{emp.position || 'N/A'}</td>
                        <td className="p-3">{emp.department || 'N/A'}</td>
                        <td className="p-3">${emp.salary?.toLocaleString() || 'N/A'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Department Report */}
          {generatedReport.summaries && (
            <div className="space-y-4">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b" style={{ borderColor: isDarkMode ? '#4b5563' : '#e5e7eb' }}>
                      <th className="text-left p-3">{t('reports.department', 'Department')}</th>
                      <th className="text-left p-3">{t('reports.totalEmployees', 'Total Employees')}</th>
                      <th className="text-left p-3">{t('reports.averageSalary', 'Average Salary')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {generatedReport.summaries.map((summary, idx) => (
                      <tr key={idx} className="border-b" style={{ borderColor: isDarkMode ? '#4b5563' : '#e5e7eb' }}>
                        <td className="p-3">{summary.department || 'N/A'}</td>
                        <td className="p-3">{summary.employee_count || 0}</td>
                        <td className="p-3">${summary.avg_salary?.toLocaleString() || 'N/A'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Pre-built Reports */}
      <div 
        className="rounded-lg shadow-sm border p-6"
        style={{
          backgroundColor: isDarkMode ? '#374151' : '#ffffff',
          color: isDarkMode ? '#ffffff' : '#111827',
          borderColor: isDarkMode ? '#4b5563' : '#d1d5db'
        }}
      >
        <h3 
          className="text-lg font-semibold mb-4"
          style={{
            backgroundColor: 'transparent',
            color: isDarkMode ? '#ffffff' : '#111827',
            borderColor: 'transparent'
          }}
        >
          {t('reports.prebuiltReports')}
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[
            { name: t('reports.monthlyPerformanceReview'), description: t('reports.comprehensivePerformanceAnalysis'), icon: Award, type: 'performance' },
            { name: t('reports.salaryBenchmarking'), description: t('reports.compareSalariesAcrossDepartments'), icon: DollarSign, type: 'salary' },
            { name: t('reports.attendanceAnalytics'), description: t('reports.trackAttendancePatterns'), icon: Calendar, type: 'attendance' },
            { name: t('reports.recruitmentPipeline'), description: t('reports.monitorHiringProcess'), icon: Users, type: 'recruitment' },
            { name: t('reports.employeeTurnover'), description: t('reports.analyzeRetentionRates'), icon: TrendingUp, type: 'turnover' },
            { name: t('reports.trainingEffectiveness'), description: t('reports.measureTrainingSuccess'), icon: Award, type: 'department' }
          ].map((report, index) => (
            <div 
              key={index} 
              className="border rounded-lg p-4 hover:shadow-md transition-shadow"
              style={{
                backgroundColor: isDarkMode ? '#4b5563' : '#ffffff',
                color: isDarkMode ? '#ffffff' : '#111827',
                borderColor: isDarkMode ? '#6b7280' : '#d1d5db'
              }}
            >
              <div className="flex items-center space-x-3 mb-2">
                <report.icon className={`h-5 w-5 ${text.primary}`} style={{ color: isDarkMode ? '#ffffff' : '#000000' }} />
                <h4 
                  className="font-medium"
                  style={{
                    backgroundColor: 'transparent',
                    color: isDarkMode ? '#ffffff' : '#111827',
                    borderColor: 'transparent'
                  }}
                >
                  {report.name}
                </h4>
              </div>
              <p 
                className="text-sm mb-3"
                style={{
                  backgroundColor: 'transparent',
                  color: isDarkMode ? '#d1d5db' : '#4b5563',
                  borderColor: 'transparent'
                }}
              >
                {report.description}
              </p>
              <button 
                onClick={() => handlePrebuiltReport(report.type)}
                disabled={generating}
                className="text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed rounded-lg cursor-pointer transition-all hover:bg-amber-600"
                style={{ color: isDarkMode ? '#fff' : '#000' }}
              >
                {generating ? t('common.generating', 'Generating...') : t('reports.generate')}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-4 md:space-y-6 px-2 sm:px-0">
      {/* Loading Overlay */}
      {loading && (
        <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
          <div 
            className="rounded-lg p-6 flex items-center space-x-3 scale-in"
            style={{
              backgroundColor: isDarkMode ? '#374151' : '#ffffff'
            }}
          >
            <Loader className={`w-6 h-6 animate-spin ${text.primary}`} style={{ color: isDarkMode ? '#3b82f6' : '#2563eb' }} />
            <span style={{ color: isDarkMode ? '#ffffff' : '#111827' }}>
              {t('common.loading', 'Loading reports...')}
            </span>
          </div>
        </div>
      )}
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-4 sm:space-y-0 slide-in-left">
        <h2 
          className="font-bold"
          style={{
            backgroundColor: 'transparent',
            color: isDarkMode ? '#ffffff' : '#111827',
            borderColor: 'transparent',
            fontSize: 'clamp(1.25rem, 3vw, 1.5rem)'
          }}
        >
          {t('reports.title')}
        </h2>
        <div className="flex space-x-4">
          <button 
            onClick={() => setShowFilters(!showFilters)}
            className="px-4 py-2 border rounded-lg hover:bg-gray-50 flex items-center space-x-2 transition-all duration-200 hover:scale-105 hover:shadow-md cursor-pointer"
            style={{
              backgroundColor: showFilters ? '#2563eb' : (isDarkMode ? '#4b5563' : '#ffffff'),
              color: showFilters ? '#ffffff' : (isDarkMode ? '#d1d5db' : '#374151'),
              borderColor: showFilters ? '#2563eb' : (isDarkMode ? '#6b7280' : '#d1d5db')
            }}
          >
            <Filter className="h-4 w-4" />
            <span>{t('reports.filters')}</span>
          </button>
          <button 
            onClick={handleExportAll}
            className="px-4 py-2 text-white rounded-lg flex items-center space-x-2 transition-all duration-200 hover:scale-105 hover:shadow-lg cursor-pointer"
            style={{
              backgroundColor: isDarkMode ? '#3b82f6' : '#2563eb',
              color: '#ffffff',
              borderColor: '#2563eb'
            }}
          >
            <Download className="h-4 w-4" />
            <span>{t('reports.exportAll')}</span>
          </button>
        </div>
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <div 
          className="rounded-lg shadow-sm border p-6"
          style={{
            backgroundColor: isDarkMode ? '#374151' : '#ffffff',
            borderColor: isDarkMode ? '#4b5563' : '#d1d5db'
          }}
        >
          <h3 
            className="text-lg font-semibold mb-4"
            style={{ color: isDarkMode ? '#ffffff' : '#111827' }}
          >
            {t('reports.filterBy', 'Filter By')}
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Date Range Filter */}
            <div>
              <label 
                className="block text-sm font-medium mb-2"
                style={{ color: isDarkMode ? '#d1d5db' : '#374151' }}
              >
                {t('reports.dateRange', 'Date Range')}
              </label>
              <select
                value={dateRange}
                onChange={(e) => setDateRange(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                style={{
                  backgroundColor: isDarkMode ? '#4b5563' : '#ffffff',
                  color: isDarkMode ? '#ffffff' : '#111827',
                  borderColor: isDarkMode ? '#6b7280' : '#d1d5db'
                }}
              >
                <option value="last-week">{t('reports.lastWeek', 'Last Week')}</option>
                <option value="last-month">{t('reports.lastMonth', 'Last Month')}</option>
                <option value="last-quarter">{t('reports.lastQuarter', 'Last Quarter')}</option>
                <option value="last-year">{t('reports.lastYear', 'Last Year')}</option>
              </select>
            </div>

            {/* Department Filter */}
            <div>
              <label 
                className="block text-sm font-medium mb-2"
                style={{ color: isDarkMode ? '#d1d5db' : '#374151' }}
              >
                {t('reports.department', 'Department')}
              </label>
              <select
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                style={{
                  backgroundColor: isDarkMode ? '#4b5563' : '#ffffff',
                  color: isDarkMode ? '#ffffff' : '#111827',
                  borderColor: isDarkMode ? '#6b7280' : '#d1d5db'
                }}
              >
                <option value="all">{t('reports.allDepartments', '')}</option>
                <option value="technology">{t('departments.technology', 'Technology')}</option>
                <option value="legal_compliance">{t('departments.legal_compliance', 'Legal & Compliance')}</option>
                <option value="internal_affairs">{t('departments.internal_affairs', 'Internal Affairs')}</option>
              </select>
            </div>

            {/* Report Type Filter */}
            <div>
              <label 
                className="block text-sm font-medium mb-2"
                style={{ color: isDarkMode ? '#d1d5db' : '#374151' }}
              >
                {t('reports.reportType', 'Report Type')}
              </label>
              <select
                value={reportType}
                onChange={(e) => setReportType(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                style={{
                  backgroundColor: isDarkMode ? '#4b5563' : '#ffffff',
                  color: isDarkMode ? '#ffffff' : '#111827',
                  borderColor: isDarkMode ? '#6b7280' : '#d1d5db'
                }}
              >
                <option value="performance">{t('reports.performance', '')}</option>
                <option value="salary">{t('reports.salary', '')}</option>
                <option value="attendance">{t('reports.attendance', '')}</option>
                <option value="recruitment">{t('reports.recruitment', '')}</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div 
        className="border-b"
        style={{
          borderColor: isDarkMode ? '#4b5563' : '#d1d5db'
        }}
      >
        <nav className="-mb-px flex space-x-8">
          {[
            { id: 'overview', name: t('reports.overview'), icon: BarChart3 },
            { id: 'detailed', name: t('reports.detailedReports'), icon: PieChart }
          ].map(tab => (
            <button
              key={tab.id}
              role="tab"
              aria-selected={selectedReport === tab.id}
              onClick={() => setSelectedReport(tab.id)}
              className={`py-2 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 transition-all duration-300 hover:scale-105`}
              style={{
                backgroundColor: 'transparent',
                color: selectedReport === tab.id 
                  ? (isDarkMode ? '#ffffff' : '#111827') 
                  : isDarkMode ? '#9ca3af' : '#6b7280',
                borderColor: selectedReport === tab.id ? '#2563eb' : 'transparent'
              }}
            >
              <tab.icon className="h-4 w-4" />
              <span>{tab.name}</span>
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader className={`w-8 h-8 animate-spin ${text.primary}`} style={{ color: isDarkMode ? '#3b82f6' : '#2563eb' }} />
        </div>
      ) : !reportData ? (
        <div className="text-center py-12">
          <p className={isDarkMode ? 'text-gray-400' : 'text-gray-600'}>
            {t('reports.noData', 'No data available')}
          </p>
        </div>
      ) : (
        <>
          {selectedReport === 'overview' && <OverviewTab />}
          {selectedReport === 'detailed' && <DetailedReportsTab />}
        </>
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

export default Reports;
