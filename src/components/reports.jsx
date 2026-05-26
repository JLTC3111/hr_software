import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useLanguage, SUPPORTED_LANGUAGES } from "../contexts/LanguageContext";
import { useTheme } from "../contexts/ThemeContext";
import { useAuth } from '../contexts/AuthContext';
import { useVisibilityRefresh } from '../hooks/useVisibilityRefresh';
import { isDemoMode, getDemoEmployeeName, getDemoTaskTitle, getDemoTaskDescription, getDemoGoalTitle, getDemoGoalDescription, getDemoTimeEntries } from '../utils/demoHelper';
import { 
  Calendar, 
  Download, 
  Users, 
  Activity,
  Laptop,
  User,
  LayoutList,
  PlayCircle,
  Filter, 
  BarChart3, 
  Gauge,
  Goal,
  Clock, 
  SmilePlus,
  CheckCircle, 
  ListCheck,
  Combine, 
  Pickaxe,
  HeartPlus,
  ShieldCheck,
  ShieldQuestion,
  PenOff,
  Apple, 
  Hourglass,
  FileText,
  Database,
  Loader,
  CalendarArrowUp,
  CalendarArrowDown,
  ArrowDownAZ,
  Timer,
  Shield,
  AlertCircle
} from 'lucide-react';
import * as _XLSX from 'xlsx';
import ExcelJS from 'exceljs';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import _html2canvas from 'html2canvas';
import timeTrackingService from '../services/timeTrackingService';
import { withTimeout } from '../utils/supabaseTimeout';
import { DEFAULT_REQUEST_TIMEOUT, VISIBILITY_STALE_TIMEOUT } from '../config/requestTimeouts';
import { getAllTasks } from '../services/workloadService';
import performanceService from '../services/performanceService';
import { validateAndRefreshSession } from '../utils/sessionHelper';
import { retryWithBackoff, isRetryableError } from '../utils/retryHelper';
import { supabase } from '../config/supabaseClient';
import {
  aggregateCounts,
  aggregateHoursByType,
  buildCombinedCsvContent,
  computeEmployeePerformance,
  computeExportStats,
  drawPdfChartsSection,
  PDF_CHART_COLORS
} from '../utils/reportExportHelpers.js';
import {
  choosePdfFont,
  getPdfTableFont,
  loadPdfFonts
} from '../utils/pdfFontLoader.js';

const Reports = () => {
  const { logout } = useAuth();
  const { t, currentLanguage } = useLanguage();
  const { isDarkMode } = useTheme();
  
  // Helper function to translate department values
  const translateDepartment = (department) => {
    if (!department) return '';
    return t(`employeeDepartment.${department}`, department);
  };
  
  // Helper function to translate position values
  const translatePosition = (position) => {
    if (!position) return '';
    return t(`employeePosition.${position}`, position);
  };
  
  // Helper function to translate data type labels
  const translateDataType = (type) => {
    if (!type) return '';
    const typeMap = {
      'timeEntry': t('dataType.timeEntry', 'Time Entry'),
      'task': t('dataType.task', 'Task'),
      'goal': t('dataType.goal', 'Goal')
    };
    return typeMap[type] || type;
  };
  
  // Helper function to translate category labels
  const translateCategory = (category) => {
    if (!category) return '';
    const categoryMap = {
      'general': t('personalGoals.general', 'General'),
      'technical': t('personalGoals.technical', 'Technical'),
      'leadership': t('personalGoals.leadership', 'Leadership'),
      'project': t('personalGoals.project', 'Project'),
      'professional_development': t('personalGoals.professionalDevelopment', 'Professional Development')
    };
    return categoryMap[category] || category;
  };
  
  // Theme classes
  const bg = {
    primary: isDarkMode ? 'bg-gray-800' : 'bg-white',
    secondary: isDarkMode ? 'bg-gray-900' : 'bg-gray-50'
  };
  
  const text = {
    primary: isDarkMode ? 'text-white' : 'text-gray-900',
    secondary: isDarkMode ? 'text-gray-300' : 'text-gray-600'
  };
  
  const border = {
    primary: isDarkMode ? 'border-gray-700' : 'border-gray-200'
  };

  // State
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState(null);
  const [exporting, setExporting] = useState(false);
  const [activeTab, setActiveTab] = useState('all');
  const [selectedEmployee, setSelectedEmployee] = useState('all');
  const [dateRange, setDateRange] = useState('this-month');
  const [filters, setFilters] = useState({
    startDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0]
  });
  
  // Sorting state for Data Preview table
  const [sortKey, setSortKey] = useState('date');
  const [sortDirection, setSortDirection] = useState('desc');

  // Data state
  const [reportData, setReportData] = useState({
    timeEntries: [],
    tasks: [],
    goals: [],
    employees: []
  });

  // Get employees list
  useEffect(() => {
    const fetchEmployees = async () => {
      try {
        const employeesResponse = await timeTrackingService.getAllEmployees();
        const employees = employeesResponse.success ? employeesResponse.data : [];
        console.log('Loaded employees:', employees.map(e => ({ id: e.id, type: typeof e.id, name: e.name })));
        setReportData(prev => ({ ...prev, employees }));
      } catch (error) {
        console.error('Error fetching employees:', error);
      }
    };
    fetchEmployees();
  }, []);

  // Update date filters when range changes
  useEffect(() => {
    const today = new Date();
    let startDate, endDate = today.toISOString().split('T')[0];

    switch (dateRange) {
      case 'today':
        startDate = today.toISOString().split('T')[0];
        break;
      case 'this-week':
        const startOfWeek = new Date(today);
        startOfWeek.setDate(today.getDate() - today.getDay());
        startDate = startOfWeek.toISOString().split('T')[0];
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 6);
        endDate = endOfWeek.toISOString().split('T')[0];
        break;
      case 'this-month':
        startDate = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
        endDate = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().split('T')[0];
        break;
      case 'last-month':
        const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        startDate = lastMonth.toISOString().split('T')[0];
        endDate = new Date(today.getFullYear(), today.getMonth(), 0).toISOString().split('T')[0];
        break;
      case 'this-quarter':
        const quarter = Math.floor(today.getMonth() / 3);
        startDate = new Date(today.getFullYear(), quarter * 3, 1).toISOString().split('T')[0];
        endDate = new Date(today.getFullYear(), (quarter * 3) + 3, 0).toISOString().split('T')[0];
        break;
      case 'this-year':
        startDate = new Date(today.getFullYear(), 0, 1).toISOString().split('T')[0];
        endDate = new Date(today.getFullYear(), 11, 31).toISOString().split('T')[0];
        break;
      default:
    
        return;
    }

    if (dateRange !== 'custom') {
      setFilters({ startDate, endDate });
    }
  }, [dateRange]);

  // Fetch data when filters change
  const fetchReportData = useCallback(async (options = {}) => {
    const { silent = false } = options;
    if (!silent) {
      setLoading(true);
      setFetchError(null); // Clear any previous errors
    }
    try {
      // Skip session validation in demo mode - demo data doesn't require authentication
      if (!isDemoMode()) {
        // Validate session before fetching
        const sessionValidation = await validateAndRefreshSession();
        if (!sessionValidation.success) {
          throw new Error(sessionValidation.error);
        }
      }
      
      // Wrap fetch logic with retry mechanism
      await retryWithBackoff(async () => {
        const { startDate, endDate } = filters;
        // Don't parse as int - IDs might be UUIDs
        const employeeId = selectedEmployee === 'all' ? null : selectedEmployee;
      
      console.log('Fetching data for:', { selectedEmployee, employeeId, activeTab, startDate, endDate });

      // Fetch Time Entries (for 'all' or 'time-entries' tab)
      if (activeTab === 'all' || activeTab === 'time-entries') {
        let allTimeEntries = [];
        let error = null;

        if (isDemoMode()) {
          // Use persisted demo time entries (includes user-created entries)
          const demoEntries = getDemoTimeEntries();
          // Identify user-created entries (those starting with 'demo-entry-')
          const userCreatedEntries = demoEntries.filter(e => e.id?.startsWith('demo-entry-'));
          console.log('[DEBUG Reports] Demo entries before filter:', {
            total: demoEntries.length,
            userCreated: userCreatedEntries.length,
            dateRange: { startDate, endDate },
            sampleDates: demoEntries.slice(0, 5).map(e => ({ id: e.id, date: e.date })),
            userCreatedDates: userCreatedEntries.map(e => ({ id: e.id, date: e.date, employee_id: e.employee_id }))
          });
          // Filter by date range and sort by date descending (like production)
          allTimeEntries = demoEntries
            .filter(entry => {
              if (!entry.date) {
                console.log('[DEBUG Reports] Entry missing date:', entry.id);
                return false;
              }
              const inRange = entry.date >= startDate && entry.date <= endDate;
              if (!inRange && entry.id?.startsWith('demo-entry-')) {
                console.log('[DEBUG Reports] User entry outside range:', { id: entry.id, date: entry.date, startDate, endDate });
              }
              return inRange;
            })
            .sort((a, b) => new Date(b.date) - new Date(a.date));
          console.log('[DEBUG Reports] Demo entries after filter:', {
            count: allTimeEntries.length,
            uniqueEmployees: [...new Set(allTimeEntries.map(e => e.employee_id))].length,
            hasUserCreated: allTimeEntries.some(e => e.id?.startsWith('demo-entry-'))
          });
        } else {
          // Use direct Supabase query with proper join - fetch all entries first
          // Supabase defaults to 1000 rows, so we need to increase limit for reports
          const result = await withTimeout(
            supabase
              .from('time_entries')
              .select(`
                *,
                employee:employees!time_entries_employee_id_fkey(id, name, department, position)
              `)
              .gte('date', startDate)
              .lte('date', endDate)
              .order('date', { ascending: false })
              .limit(10000), 
            DEFAULT_REQUEST_TIMEOUT
          );
          allTimeEntries = result.data;
          error = result.error;
        }

        if (error) {
          console.error('Error fetching time entries:', error);
          setReportData(prev => ({ ...prev, timeEntries: [] }));
        } else {
          // Filter client-side using string comparison like timeClockEntry does
          let filteredEntries = allTimeEntries || [];
          
          if (employeeId) {
            // Compare as strings to handle both int and string IDs
            filteredEntries = filteredEntries.filter(entry => 
              String(entry.employee_id) === String(employeeId)
            );
          }
          
          console.log('Filtered time entries:', {
            employeeIdFilter: employeeId,
            totalFetched: allTimeEntries?.length,
            afterFilter: filteredEntries.length,
            sampleEntry: filteredEntries[0] ? {
              employee_id: filteredEntries[0].employee_id,
              employee_id_type: typeof filteredEntries[0].employee_id,
              employee: filteredEntries[0].employee,
              date: filteredEntries[0].date
            } : null
          });
          
          setReportData(prev => ({ ...prev, timeEntries: filteredEntries }));
        }
      }

      // Fetch Tasks (for 'all' or 'tasks' tab)
      if (activeTab === 'all' || activeTab === 'tasks') {
        // For tasks, don't filter by date range as tasks are ongoing
        // Only filter by employee if one is selected
        const tasksResponse = await getAllTasks(
          employeeId ? { employeeId: employeeId } : {}
        );
        const tasks = tasksResponse.success ? tasksResponse.data : [];
        
        // Filter client-side using string comparison like we do for time entries
        let filteredTasks = tasks;
        if (employeeId) {
          filteredTasks = tasks.filter(task => String(task.employee_id) === String(employeeId));
        }
        
        console.log('Tasks fetched:', {
          employeeId,
          employeeIdType: typeof employeeId,
          success: tasksResponse.success,
          totalFetched: tasks.length,
          afterFilter: filteredTasks.length,
          sampleTask: filteredTasks[0] ? {
            employee_id: filteredTasks[0].employee_id,
            employee_id_type: typeof filteredTasks[0].employee_id,
            title: filteredTasks[0].title
          } : null,
          error: tasksResponse.error
        });
        setReportData(prev => ({ ...prev, tasks: filteredTasks }));
      }

      // Fetch Goals (for 'all' or 'goals' tab)
      // NOTE: Goals are fetched from performance_goals table, NOT performance_reviews
      // - performance_goals = Goal tracking with progress percentages and milestones
      // - performance_reviews = Skill assessments and quarterly performance reviews
      if (activeTab === 'all' || activeTab === 'goals') {
        console.log('=== FETCHING GOALS FROM performance_goals TABLE ===', { activeTab, employeeId });
        const goalsResponse = await performanceService.getAllPerformanceGoals(
          employeeId ? { employeeId: employeeId } : {}
        );
        console.log('Goals Response:', goalsResponse);
        const goals = goalsResponse.success ? goalsResponse.data : [];
        
        // Filter client-side using string comparison
        let filteredGoals = goals;
        if (employeeId) {
          filteredGoals = goals.filter(goal => String(goal.employee_id) === String(employeeId));
        }
        
        console.log('Goals fetched:', {
          employeeId,
          employeeIdType: typeof employeeId,
          success: goalsResponse.success,
          totalFetched: goals.length,
          afterFilter: filteredGoals.length,
          sampleGoal: filteredGoals[0] ? {
            employee_id: filteredGoals[0].employee_id,
            employee_id_type: typeof filteredGoals[0].employee_id,
            title: filteredGoals[0].title,
            status: filteredGoals[0].status,
            progress: filteredGoals[0].progress,
            progress_type: typeof filteredGoals[0].progress,
            progress_is_null: filteredGoals[0].progress === null,
            progress_is_zero: filteredGoals[0].progress === 0
          } : null,
          allGoalsProgress: filteredGoals.map(g => ({
            title: g.title,
            status: g.status,
            progress: g.progress,
            progress_type: typeof g.progress
          })),
          rawGoals: goals,
          error: goalsResponse.error
        });
        console.log('Setting goals in reportData:', filteredGoals);
        setReportData(prev => {
          console.log('Previous reportData:', prev);
          const newData = { ...prev, goals: filteredGoals };
          console.log('New reportData with goals:', newData);
          return newData;
        });
      } else {
        console.log('=== SKIPPING GOALS FETCH ===', { activeTab });
      }
      }, {
        maxRetries: 2,
        shouldRetry: isRetryableError,
        onRetry: (error, attempt, delay) => {
          console.log(`🔄 Reports: Retrying fetch (${attempt}/2) after ${delay}ms...`);
        }
      });
    } catch (error) {
      console.error('Error fetching report data:', error);
      
      // Check if this is a session/auth error - force logout
      const errorMsg = error.message?.toLowerCase() || '';
      if (errorMsg.includes('session') || errorMsg.includes('authentication') || errorMsg.includes('no active session')) {
        if (isDemoMode()) {
          console.warn('🧪 Demo mode session not ready, skipping forced logout');
          setFetchError('Demo session is initializing. Please try again in a moment.');
          if (!silent) setLoading(false);
          return;
        }
        console.error('🚪 Session invalid after retries, forcing logout...');
        setFetchError('Your session has expired. Redirecting to login...');
        setTimeout(() => {
          logout();
        }, 2000);
        return;
      }
      
      // Set user-visible error message for other errors
      setFetchError(error.message || 'Failed to load report data. Please try refreshing the page.');
    } finally {
      if (!silent) setLoading(false);
    }
  }, [filters, selectedEmployee, activeTab, logout]);

  const loadAllReportDataForExport = useCallback(async () => {
    const { startDate, endDate } = filters;
    const employeeId = selectedEmployee === 'all' ? null : selectedEmployee;

    if (!isDemoMode()) {
      const sessionValidation = await validateAndRefreshSession();
      if (!sessionValidation.success) {
        throw new Error(sessionValidation.error);
      }
    }

    let allTimeEntries = [];
    if (isDemoMode()) {
      allTimeEntries = getDemoTimeEntries()
        .filter((entry) => entry.date && entry.date >= startDate && entry.date <= endDate)
        .sort((a, b) => new Date(b.date) - new Date(a.date));
    } else {
      const { data, error } = await withTimeout(
        supabase
          .from('time_entries')
          .select(`
            *,
            employee:employees!time_entries_employee_id_fkey(id, name, department, position)
          `)
          .gte('date', startDate)
          .lte('date', endDate)
          .order('date', { ascending: false })
          .limit(10000),
        DEFAULT_REQUEST_TIMEOUT
      );
      if (error) throw error;
      allTimeEntries = data || [];
    }

    if (employeeId) {
      allTimeEntries = allTimeEntries.filter((entry) => String(entry.employee_id) === String(employeeId));
    }

    const tasksResponse = await getAllTasks(employeeId ? { employeeId } : {});
    let tasks = tasksResponse.success ? tasksResponse.data || [] : [];
    if (employeeId) {
      tasks = tasks.filter((task) => String(task.employee_id) === String(employeeId));
    }

    const goalsResponse = await performanceService.getAllPerformanceGoals(employeeId ? { employeeId } : {});
    let goals = goalsResponse.success ? goalsResponse.data || [] : [];
    if (employeeId) {
      goals = goals.filter((goal) => String(goal.employee_id) === String(employeeId));
    }

    const exportData = {
      timeEntries: allTimeEntries,
      tasks,
      goals,
      employees: reportData.employees
    };

    setReportData((prev) => ({ ...prev, timeEntries: allTimeEntries, tasks, goals }));
    return exportData;
  }, [filters, selectedEmployee, reportData.employees]);

  // Effect to fetch data when filters/tab/employee changes
  useEffect(() => {
    if (reportData.employees.length > 0) {
      fetchReportData();
    }
  }, [fetchReportData, reportData.employees]);

  // Memoize fetchReportData for use in visibility hook
  const memoizedFetchReportData = useCallback(() => {
    if (reportData.employees.length > 0) {
      fetchReportData({ silent: true });
    }
  }, [fetchReportData, reportData.employees]);

  // Use visibility refresh hook to reload data when page becomes visible after idle
  useVisibilityRefresh(memoizedFetchReportData, {
    staleTime: VISIBILITY_STALE_TIMEOUT,
    refreshOnFocus: true,
    refreshOnOnline: true
  });

  // Handle sort column click
  const handleSort = (key) => {
    if (sortKey === key) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDirection('asc');
    }
  };

  // Get current data based on active tab (filtered by selectedEmployee if not 'all')
  const currentData = useMemo(() => {
    // Helper to filter data by selected employee
    const filterByEmployee = (data) => {
      if (selectedEmployee === 'all') return data;
      return data.filter(item => String(item.employee_id) === String(selectedEmployee));
    };

    switch (activeTab) {
      case 'all':
        return {
          timeEntries: filterByEmployee(reportData.timeEntries),
          tasks: filterByEmployee(reportData.tasks),
          goals: filterByEmployee(reportData.goals)
        };
      case 'time-entries':
        return filterByEmployee(reportData.timeEntries);
      case 'tasks':
        return filterByEmployee(reportData.tasks);
      case 'goals':
        return filterByEmployee(reportData.goals);
      default:
        return [];
    }
  }, [activeTab, reportData, selectedEmployee]);

  // Sorting function for table data
  const getSortedData = useMemo(() => {
    const sortArray = (arr) => {
      if (!arr || arr.length === 0) return arr;
      const sorted = [...arr];
      sorted.sort((a, b) => {
        let aValue, bValue;
        switch (sortKey) {
          case 'date':
            aValue = new Date(a.date || a.due_date || a.target_date || a.created_at).getTime();
            bValue = new Date(b.date || b.due_date || b.target_date || b.created_at).getTime();
            break;
          case 'employee':
            aValue = (a.employee?.name || '').toLowerCase();
            bValue = (b.employee?.name || '').toLowerCase();
            break;
          case 'hours':
            aValue = a.hours || 0;
            bValue = b.hours || 0;
            break;
          case 'status':
            aValue = (a.status || '').toLowerCase();
            bValue = (b.status || '').toLowerCase();
            break;
          case 'progress':
            aValue = a.progress || 0;
            bValue = b.progress || 0;
            break;
          case 'priority':
            const priorityOrder = { high: 3, medium: 2, low: 1 };
            aValue = priorityOrder[a.priority] || 0;
            bValue = priorityOrder[b.priority] || 0;
            break;
          case 'type':
            aValue = (a.hour_type || a.hourType || '').toLowerCase();
            bValue = (b.hour_type || b.hourType || '').toLowerCase();
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

    if (activeTab === 'all') {
      return {
        timeEntries: sortArray(currentData.timeEntries),
        tasks: sortArray(currentData.tasks),
        goals: sortArray(currentData.goals)
      };
    }
    return sortArray(currentData);
  }, [currentData, sortKey, sortDirection, activeTab]);

  // Calculate statistics
  const stats = useMemo(() => {
    const data = currentData;
    
    if (activeTab === 'all') {
      // Combined statistics for all data types
      const timeEntries = data.timeEntries || [];
      const tasks = data.tasks || [];
      const goals = data.goals || [];
      
      const totalRecords = timeEntries.length + tasks.length + goals.length;
      const totalHours = timeEntries.reduce((sum, entry) => sum + (entry.hours || 0), 0);
      const approvedTime = timeEntries.filter(entry => entry.status === 'approved').length;
      const completedTasks = tasks.filter(task => task.status === 'completed').length;
      const achievedGoals = goals.filter(goal => goal.status === 'completed').length;
      
      return {
        totalRecords,
        totalHours: totalHours.toFixed(1),
        timeEntriesCount: timeEntries.length,
        tasksCount: tasks.length,
        goalsCount: goals.length,
        approvedTime,
        completedTasks,
        achievedGoals
      };
    }
    
    const totalRecords = data.length;

    if (activeTab === 'time-entries') {
      const totalHours = data.reduce((sum, entry) => sum + (entry.hours || 0), 0);
      const approved = data.filter(entry => entry.status === 'approved').length;
      const pending = data.filter(entry => entry.status === 'pending').length;
      
      return {
        totalRecords,
        totalHours: totalHours.toFixed(1),
        approved,
        pending
      };
    } else if (activeTab === 'tasks') {
      const completed = data.filter(task => task.status === 'completed').length;
      const inProgress = data.filter(task => task.status === 'in-progress').length;
      const completionRate = totalRecords > 0 ? Math.round((completed / totalRecords) * 100) : 0;
      
      return {
        totalRecords,
        completed,
        inProgress,
        completionRate
      };
    } else if (activeTab === 'goals') {
      const achieved = data.filter(goal => goal.status === 'completed').length;
      const inProgress = data.filter(goal => goal.status === 'in_progress').length;
      const averageProgress = totalRecords > 0 ? 
        Math.round(data.reduce((sum, goal) => sum + (goal.progress || 0), 0) / totalRecords) : 0;
      
      return {
        totalRecords,
        achieved,
        inProgress,
        averageProgress
      };
    }

    return { totalRecords };
  }, [activeTab, currentData]);

  const buildTimeEntryCsvRows = (timeEntries) => {
    const headers = [
      t('reports.excel.headers.dataType', 'Data Type'),
      t('employees.name', 'Employee Name'),
      t('employees.department', 'Department'),
      t('employees.position', 'Position'),
      t('timeTracking.date', 'Date'),
      t('timeTracking.clockIn', 'Clock In'),
      t('timeTracking.clockOut', 'Clock Out'),
      t('timeTracking.amountHours', 'Hours'),
      t('timeTracking.hourType', 'Hour Type'),
      t('timeTracking.status', 'Status'),
      t('timeTracking.notes', 'Notes'),
      t('timeTracking.createdAt', 'Created At')
    ];

    const rows = timeEntries.map((entry) => [
      t('reports.timeEntries', 'Time Entries'),
      isDemoMode() ? getDemoEmployeeName(entry.employee, t) : (entry.employee?.name || 'Unknown'),
      translateDepartment(entry.employee?.department) || '',
      translatePosition(entry.employee?.position) || '',
      entry.date,
      entry.clock_in || '',
      entry.clock_out || '',
      entry.hours || 0,
      translateHourType(entry.hour_type) || '',
      translateStatus(entry.status) || '',
      translateNotes(entry.notes) || '',
      new Date(entry.created_at).toLocaleString()
    ]);

    return { headers, rows };
  };

  const buildTaskCsvRows = (tasks) => {
    const headers = [
      t('reports.excel.headers.dataType', 'Data Type'),
      t('employees.name', 'Employee Name'),
      t('employees.department', 'Department'),
      t('reports.excel.headers.taskTitle', 'Task Title'),
      t('reports.excel.headers.description', 'Description'),
      t('reports.excel.headers.priority', 'Priority'),
      t('reports.excel.headers.status', 'Status'),
      t('reports.excel.headers.dueDate', 'Due Date'),
      t('taskListing.completionDate', 'Completion Date'),
      t('reports.excel.headers.estimatedHours', 'Estimated Hours'),
      t('reports.excel.headers.actualHours', 'Actual Hours'),
      t('reports.excel.headers.variance', 'Variance'),
      t('reports.excel.headers.createdAt', 'Created At'),
      t('reports.excel.headers.updatedAt', 'Updated At')
    ];

    const rows = tasks.map((task) => [
      t('reports.tasks', 'Tasks'),
      isDemoMode() ? getDemoEmployeeName(task.employee, t) : (task.employee?.name || 'Unknown'),
      translateDepartment(task.employee?.department) || '',
      isDemoMode() ? getDemoTaskTitle(task, t) : (task.title || ''),
      isDemoMode() ? getDemoTaskDescription(task, t) : (task.description || ''),
      translatePriority(task.priority) || '',
      translateStatus(task.status) || '',
      task.due_date || '',
      task.completion_date || '',
      task.estimated_hours || 0,
      task.actual_hours || 0,
      (task.actual_hours || 0) - (task.estimated_hours || 0),
      new Date(task.created_at).toLocaleString(),
      new Date(task.updated_at).toLocaleString()
    ]);

    return { headers, rows };
  };

  const buildGoalCsvRows = (goals) => {
    const headers = [
      t('reports.excel.headers.dataType', 'Data Type'),
      t('employees.name', 'Employee Name'),
      t('employees.department', 'Department'),
      t('reports.excel.headers.goalTitle', 'Goal Title'),
      t('reports.excel.headers.description', 'Description'),
      t('reports.excel.headers.category', 'Category'),
      t('reports.excel.headers.status', 'Status'),
      t('reports.excel.headers.progress', 'Progress (%)'),
      t('reports.excel.headers.targetDate', 'Target Date'),
      t('reports.excel.headers.notes', 'Notes'),
      t('reports.excel.headers.createdAt', 'Created At'),
      t('reports.excel.headers.updatedAt', 'Updated At')
    ];

    const rows = goals.map((goal) => [
      t('reports.personalGoals', 'Personal Goals'),
      isDemoMode() ? getDemoEmployeeName(goal.employee, t) : (goal.employee?.name || 'Unknown'),
      translateDepartment(goal.employee?.department) || '',
      isDemoMode() ? getDemoGoalTitle(goal, t) : (goal.title || ''),
      isDemoMode() ? getDemoGoalDescription(goal, t) : (goal.description || ''),
      translateCategory(goal.category) || '',
      translateStatus(goal.status) || '',
      goal.progress || 0,
      goal.target_date || '',
      goal.notes || '',
      new Date(goal.created_at).toLocaleString(),
      new Date(goal.updated_at).toLocaleString()
    ]);

    return { headers, rows };
  };

  const exportAllToCSV = async () => {
    setExporting(true);
    try {
      const exportData = await loadAllReportDataForExport();
      const { timeEntries, tasks, goals, employees } = exportData;
      const exportStats = computeExportStats(timeEntries, tasks, goals);

      if (exportStats.totalRecords === 0) {
        alert(t('reports.noData', 'No data available for the selected period'));
        return;
      }

      const languageName = SUPPORTED_LANGUAGES[currentLanguage]?.name || 'English';
      const employeeName = selectedEmployee !== 'all'
        ? employees.find((emp) => String(emp.id) === String(selectedEmployee))?.name?.replace(/\s+/g, '_')
        : t('reports.allEmployees', 'All Employees');

      const metadataRows = [
        `"${t('reports.performanceReport', 'HR PERFORMANCE REPORT')}"`,
        `"${t('reports.language', 'Report Language')}: ${languageName}"`,
        `"${t('reports.generated', 'Generated')}: ${new Date().toLocaleString()}"`,
        `"${t('reports.period', 'Period')}: ${filters.startDate} ${t('reports.to', 'to')} ${filters.endDate}"`,
        `"${t('reports.employee', 'Employee')}: ${selectedEmployee === 'all' ? t('reports.allEmployees', 'All Employees') : (employees.find((emp) => String(emp.id) === String(selectedEmployee))?.name || '')}"`
      ];

      const sections = [{
        title: t('reports.summaryOverview', 'SUMMARY OVERVIEW'),
        headers: [t('reports.excel.performance.tableHeaders.metric', 'Metric'), t('reports.excel.performance.tableHeaders.value', 'Value')],
        rows: [
          [t('reports.totalRecords', 'Total Records'), exportStats.totalRecords],
          [t('reports.timeEntries', 'Time Entries'), exportStats.timeEntriesCount],
          [t('reports.tasks', 'Tasks'), exportStats.tasksCount],
          [t('reports.goals', 'Goals'), exportStats.goalsCount],
          [t('reports.totalHours', 'Total Hours'), `${exportStats.totalHours}h`],
          [t('reports.approved', 'Approved'), exportStats.approvedTime],
          [t('reports.completedTasks', 'Completed Tasks'), exportStats.completedTasks],
          [t('reports.achievedGoals', 'Achieved Goals'), exportStats.achievedGoals]
        ]
      }];

      if (timeEntries.length > 0) {
        const timeSection = buildTimeEntryCsvRows(timeEntries);
        sections.push({ title: t('reports.timeEntries', 'TIME ENTRIES').toUpperCase(), ...timeSection });
      }
      if (tasks.length > 0) {
        const taskSection = buildTaskCsvRows(tasks);
        sections.push({ title: t('reports.tasks', 'TASKS').toUpperCase(), ...taskSection });
      }
      if (goals.length > 0) {
        const goalSection = buildGoalCsvRows(goals);
        sections.push({ title: t('reports.personalGoals', 'PERSONAL GOALS').toUpperCase(), ...goalSection });
      }

      if (selectedEmployee !== 'all') {
        const employee = employees.find((emp) => String(emp.id) === String(selectedEmployee));
        if (employee) {
          const performance = computeEmployeePerformance(employee, timeEntries, tasks, goals);
          sections.push({
            title: t('reports.excel.performance.header', 'EMPLOYEE PERFORMANCE').toUpperCase(),
            headers: [
              t('reports.excel.performance.tableHeaders.metric', 'Metric'),
              t('reports.excel.performance.tableHeaders.value', 'Value')
            ],
            rows: [
              [t('reports.excel.performance.name', 'Name'), getDemoEmployeeName(employee, t)],
              [t('reports.excel.metrics.totalHours', 'Total Hours Logged'), performance.totalHours.toFixed(1)],
              [t('reports.excel.metrics.totalTasks', 'Total Tasks'), performance.tasksCount],
              [t('reports.excel.performance.taskCompletionRate', 'Task Completion Rate'), `${performance.taskCompletionRate}%`],
              [t('reports.excel.metrics.totalGoals', 'Total Goals'), performance.goalsCount],
              [t('reports.excel.performance.avgGoalProgress', 'Average Goal Progress'), `${performance.avgGoalProgress}%`],
              [t('reports.excel.performance.overallScore', 'Overall Performance Score:'), `${performance.overallScore}%`]
            ]
          });
        }
      } else if (employees.length > 0) {
        sections.push({
          title: t('reports.excel.sheets.allEmployeesOverview', 'ALL EMPLOYEES OVERVIEW').toUpperCase(),
          headers: [
            t('reports.excel.performance.name', 'Name'),
            t('reports.excel.performance.department', 'Department'),
            t('reports.excel.metrics.totalHours', 'Total Hours Logged'),
            t('reports.excel.metrics.totalTasks', 'Total Tasks'),
            t('reports.excel.metrics.completedTasks', 'Completed Tasks'),
            t('reports.excel.metrics.totalGoals', 'Total Goals'),
            t('reports.excel.performance.overallScore', 'Overall Score')
          ],
          rows: employees.map((employee) => {
            const performance = computeEmployeePerformance(employee, timeEntries, tasks, goals);
            return [
              getDemoEmployeeName(employee, t),
              translateDepartment(employee.department),
              performance.totalHours.toFixed(1),
              performance.tasksCount,
              performance.completedTasks,
              performance.goalsCount,
              `${performance.overallScore}%`
            ];
          })
        });
      }

      const csvContent = buildCombinedCsvContent({ metadataRows, sections });
      const filename = `${t('reports.filenamePrefix', 'HR_Report')}_${employeeName}_${filters.startDate}_${t('reports.to', 'to')}_${filters.endDate}_${currentLanguage.toUpperCase()}.csv`;
      const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      alert(t('reports.csvExportSuccess', 'CSV report exported successfully with all data types in one file!'));
    } catch (error) {
      console.error('Error exporting combined CSV:', error);
      alert(t('reports.errorExporting', 'Error exporting data') + ': ' + error.message);
    } finally {
      setExporting(false);
    }
  };

  // Enhanced Excel Export with Metrics, Embedded Charts, and Styled Tables
  const exportToExcel = async () => {
    setExporting(true);
    try {
      const exportSnapshot = await loadAllReportDataForExport();
      const timeEntries = exportSnapshot.timeEntries;
      const tasks = exportSnapshot.tasks;
      const goals = exportSnapshot.goals;
      const employees = exportSnapshot.employees;

      if (timeEntries.length === 0 && tasks.length === 0 && goals.length === 0) {
        alert(t('reports.noData', 'No data available for the selected period'));
        return;
      }

      // Helpers for safe values and typing
      const sanitize = (v) => {
        if (v == null) return '';
        const s = String(v);
        return (/^[=+\-@]/.test(s) ? "'" + s : s);
      };

      const toDate = (d) => {
        if (!d) return null;
        const dt = new Date(d);
        return isNaN(dt.getTime()) ? null : dt;
      };

      const toNumber = (n, fallback = 0) => {
        const num = Number(n);
        return Number.isFinite(num) ? num : fallback;
      };

      // Safe filename part: trim, replace spaces with underscores, sanitize Excel string
      const toFilePart = (value, fallback = '') => {
        const raw = value ?? fallback;
        const safe = String(raw).trim().replace(/\s+/g, '_');
        return sanitize(safe || fallback);
      };

      // Localized label helper
      const tr = (key, fallback) => t(key, fallback);

      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'HR Management System';
      workbook.created = new Date();

      const sheetNames = {
        summary: tr('reports.excel.sheets.summary', 'Summary'),
        performance: tr('reports.excel.sheets.performance', 'Employee Performance'),
        charts: tr('reports.excel.sheets.charts', 'Charts & Metrics'),
        timeEntries: tr('reports.excel.sheets.timeEntries', 'Time Entries'),
        tasks: tr('reports.excel.sheets.tasks', 'Tasks'),
        goals: tr('reports.excel.sheets.goals', 'Goals')
      };
      
      // Employee name for filename
      const employeeName = selectedEmployee !== 'all' ? 
        employees.find(emp => String(emp.id) === String(selectedEmployee))?.name?.replace(/\s+/g, '_') : 
        tr('reports.allEmployees', 'All Employees').replace(/\s+/g, '_');

      // ==================== SUMMARY/METRICS SHEET WITH STYLING ====================
      const summarySheet = workbook.addWorksheet(sheetNames.summary, {
        views: [{ state: 'frozen', xSplit: 0, ySplit: 1 }]
      });
      
      // Header styling
      summarySheet.getCell('A1').value = tr('reports.excel.summaryTitle', 'HR Report Summary');
      summarySheet.getCell('A1').font = { size: 16, bold: true, color: { argb: 'FFFFFFFF' } };
      summarySheet.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } };
      summarySheet.getCell('A1').alignment = { horizontal: 'center', vertical: 'middle' };
      summarySheet.mergeCells('A1:C1');
      summarySheet.getRow(1).height = 30;
      
      // Report Info
      let currentRow = 3;
      summarySheet.getCell(`A${currentRow}`).value = tr('reports.excel.generated', 'Generated');
      summarySheet.getCell(`B${currentRow}`).value = new Date().toLocaleString();
      summarySheet.getCell(`A${currentRow}`).font = { bold: true };
      currentRow++;
      
      summarySheet.getCell(`A${currentRow}`).value = tr('reports.excel.dateRange', 'Date Range');
      summarySheet.getCell(`B${currentRow}`).value = `${filters.startDate} ${tr('reports.to', 'to')} ${filters.endDate}`;
      summarySheet.getCell(`A${currentRow}`).font = { bold: true };
      currentRow++;
      
      summarySheet.getCell(`A${currentRow}`).value = tr('reports.excel.employee', 'Employee');
      summarySheet.getCell(`B${currentRow}`).value = selectedEmployee === 'all' ? tr('reports.allEmployees', 'All Employees') : employeeName;
      summarySheet.getCell(`A${currentRow}`).font = { bold: true };
      currentRow++;
      
      const languageName = SUPPORTED_LANGUAGES[currentLanguage]?.name || 'English';
      summarySheet.getCell(`A${currentRow}`).value = tr('reports.excel.reportLanguage', 'Report Language');
      summarySheet.getCell(`B${currentRow}`).value = languageName;
      summarySheet.getCell(`A${currentRow}`).font = { bold: true };
      currentRow += 2;

      summarySheet.getCell('C2').value = tr('reports.excel.visual', 'Visual');
      summarySheet.getCell('C2').font = { bold: true };
      summarySheet.getCell('C2').alignment = { horizontal: 'center' };
      
      // Time Entries Metrics with Styling
      if (timeEntries.length > 0) {
        const totalHours = timeEntries.reduce((sum, entry) => sum + (entry.hours || 0), 0);
        const regularHours = timeEntries.filter(e => e.hour_type === 'regular').reduce((sum, e) => sum + (e.hours || 0), 0);
        // Include both overtime and bonus as overtime hours
        const overtimeHours = timeEntries.filter(e => e.hour_type === 'overtime' || e.hour_type === 'bonus').reduce((sum, e) => sum + (e.hours || 0), 0);
        const wfhHours = timeEntries.filter(e => e.hour_type === 'wfh').reduce((sum, e) => sum + (e.hours || 0), 0);
        const pendingEntries = timeEntries.filter(e => e.status === 'pending').length;
        const approvedEntries = timeEntries.filter(e => e.status === 'approved').length;
        
        // Section Header
        summarySheet.getCell(`A${currentRow}`).value = tr('reports.excel.timeTracking', 'Time Tracking Summary');
        summarySheet.getCell(`A${currentRow}`).font = { size: 12, bold: true, color: { argb: 'FFFFFFFF' } };
        summarySheet.getCell(`A${currentRow}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF70AD47' } };
        summarySheet.mergeCells(`A${currentRow}:C${currentRow}`);
        currentRow++;
        
        const timeBarRows = [];
        const addMetric = (label, value, isNumeric = false, trackBar = false) => {
          summarySheet.getCell(`A${currentRow}`).value = label;
          const numericValue = isNumeric ? toNumber(value) : sanitize(value);
          summarySheet.getCell(`B${currentRow}`).value = numericValue;
          summarySheet.getCell(`A${currentRow}`).font = { bold: true };
          summarySheet.getCell(`B${currentRow}`).alignment = { horizontal: 'right' };
          const barCell = summarySheet.getCell(`C${currentRow}`);
          barCell.value = isNumeric ? numericValue : '';
          if (trackBar && isNumeric) {
            timeBarRows.push(currentRow);
          }
          currentRow++;
        };

        addMetric(tr('reports.excel.metrics.totalTimeEntries', 'Total Time Entries'), timeEntries.length, true, true);
        addMetric(tr('reports.excel.metrics.totalHours', 'Total Hours Logged'), totalHours, true, true);
        addMetric(tr('reports.excel.metrics.regularHours', 'Regular Hours'), regularHours, true, true);
        addMetric(tr('reports.excel.metrics.overtimeHours', 'Overtime Hours'), overtimeHours, true, true);
        addMetric(tr('reports.excel.metrics.wfhHours', 'WFH Hours'), wfhHours, true, true);
        addMetric(tr('reports.excel.metrics.pendingApprovals', 'Pending Approvals'), pendingEntries, true, true);
        addMetric(tr('reports.excel.metrics.approvedEntries', 'Approved Entries'), approvedEntries, true, true);
        if (timeBarRows.length) {
          const start = Math.min(...timeBarRows);
          const end = Math.max(...timeBarRows);
          summarySheet.addConditionalFormatting({
            ref: `C${start}:C${end}`,
            rules: [{ type: 'dataBar', cfvo: [{ type: 'min' }, { type: 'max' }], color: 'FF70AD47', showValue: false }]
          });
        }
        currentRow++;
      }
      
      // Tasks Metrics with Styling
      if (tasks.length > 0) {
        const completedTasks = tasks.filter(t => t.status === 'completed').length;
        const inProgressTasks = tasks.filter(t => t.status === 'in_progress').length;
        const highPriority = tasks.filter(t => t.priority === 'high').length;
        const totalEstimated = tasks.reduce((sum, t) => sum + (t.estimated_hours || 0), 0);
        const totalActual = tasks.reduce((sum, t) => sum + (t.actual_hours || 0), 0);
        
        // Section Header
        summarySheet.getCell(`A${currentRow}`).value = tr('reports.excel.workload', 'Workload Summary');
        summarySheet.getCell(`A${currentRow}`).font = { size: 12, bold: true, color: { argb: 'FFFFFFFF' } };
        summarySheet.getCell(`A${currentRow}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFC000' } };
        summarySheet.mergeCells(`A${currentRow}:C${currentRow}`);
        currentRow++;
        
        const taskBarRows = [];
        const addMetric = (label, value, isNumeric = false, trackBar = false) => {
          summarySheet.getCell(`A${currentRow}`).value = label;
          const numericValue = isNumeric ? toNumber(value) : sanitize(value);
          summarySheet.getCell(`B${currentRow}`).value = numericValue;
          summarySheet.getCell(`A${currentRow}`).font = { bold: true };
          summarySheet.getCell(`B${currentRow}`).alignment = { horizontal: 'right' };
          const barCell = summarySheet.getCell(`C${currentRow}`);
          barCell.value = isNumeric ? numericValue : '';
          if (trackBar && isNumeric) {
            taskBarRows.push(currentRow);
          }
          currentRow++;
        };

        addMetric(tr('reports.excel.metrics.totalTasks', 'Total Tasks'), tasks.length, true, true);
        addMetric(tr('reports.excel.metrics.completedTasks', 'Completed Tasks'), completedTasks, true, true);
        addMetric(tr('reports.excel.metrics.inProgress', 'In Progress'), inProgressTasks, true, true);
        addMetric(tr('reports.excel.metrics.highPriorityTasks', 'High Priority Tasks'), highPriority, true, true);
        addMetric(tr('reports.excel.metrics.estimatedHours', 'Estimated Hours'), totalEstimated, true, true);
        addMetric(tr('reports.excel.metrics.actualHours', 'Actual Hours'), totalActual, true, true);
        addMetric(tr('reports.excel.metrics.variance', 'Variance'), totalActual - totalEstimated, true, true);
        if (taskBarRows.length) {
          const start = Math.min(...taskBarRows);
          const end = Math.max(...taskBarRows);
          summarySheet.addConditionalFormatting({
            ref: `C${start}:C${end}`,
            rules: [{ type: 'dataBar', cfvo: [{ type: 'min' }, { type: 'max' }], color: 'FFFFC000', showValue: false }]
          });
        }
        currentRow++;
      }
      
      // Goals Metrics with Styling
      if (goals.length > 0) {
        const completedGoals = goals.filter(g => g.status === 'completed').length;
        const inProgressGoals = goals.filter(g => g.status === 'in_progress').length;
        const avgProgress = (goals.reduce((sum, g) => sum + (g.status === 'completed' ? 100 : (g.progress || 0)), 0) / goals.length).toFixed(1);
        
        // Section Header
        summarySheet.getCell(`A${currentRow}`).value = tr('reports.excel.goals', 'Goals Summary');
        summarySheet.getCell(`A${currentRow}`).font = { size: 12, bold: true, color: { argb: 'FFFFFFFF' } };
        summarySheet.getCell(`A${currentRow}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF5B9BD5' } };
        summarySheet.mergeCells(`A${currentRow}:C${currentRow}`);
        currentRow++;
        
        const goalBarRows = [];
        const addMetric = (label, value, isNumeric = false, trackBar = false) => {
          summarySheet.getCell(`A${currentRow}`).value = label;
          const numericValue = isNumeric ? toNumber(value) : sanitize(value);
          summarySheet.getCell(`B${currentRow}`).value = numericValue;
          summarySheet.getCell(`A${currentRow}`).font = { bold: true };
          summarySheet.getCell(`B${currentRow}`).alignment = { horizontal: 'right' };
          const barCell = summarySheet.getCell(`C${currentRow}`);
          barCell.value = isNumeric ? numericValue : '';
          if (trackBar && isNumeric) {
            goalBarRows.push(currentRow);
          }
          currentRow++;
        };

        addMetric(tr('reports.excel.metrics.totalGoals', 'Total Goals'), goals.length, true, true);
        addMetric(tr('reports.excel.metrics.completedGoals', 'Completed Goals'), completedGoals, true, true);
        addMetric(tr('reports.excel.metrics.inProgress', 'In Progress'), inProgressGoals, true, true);
        addMetric(tr('reports.excel.metrics.avgProgress', 'Average Progress'), parseFloat(avgProgress) || 0, true, true);
        if (goalBarRows.length) {
          const start = Math.min(...goalBarRows);
          const end = Math.max(...goalBarRows);
          summarySheet.addConditionalFormatting({
            ref: `C${start}:C${end}`,
            rules: [{ type: 'dataBar', cfvo: [{ type: 'min' }, { type: 'max' }], color: 'FF5B9BD5', showValue: false }]
          });
        }
      }

      // Set column widths for summary sheet
      summarySheet.getColumn(1).width = 30;
      summarySheet.getColumn(2).width = 20;
      summarySheet.getColumn(3).width = 18;
      // Format second column for numbers (metrics)
      summarySheet.getColumn(2).numFmt = '#,##0.00';

      // ==================== INDIVIDUAL EMPLOYEE PERFORMANCE SHEET ====================
      if (selectedEmployee !== 'all') {
        const employee = employees.find(emp => String(emp.id) === String(selectedEmployee));
        if (employee) {
          const perfSheet = workbook.addWorksheet(sheetNames.performance);
          
          // Header
          const perfHeader = tr('reports.excel.performance.header', 'Performance Report');
          const employeeDisplayName = getDemoEmployeeName(employee, t);
          perfSheet.getCell('A1').value = `${employeeDisplayName} - ${perfHeader}`;
          perfSheet.getCell('A1').font = { size: 16, bold: true, color: { argb: 'FFFFFFFF' } };
          perfSheet.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0070C0' } };
          perfSheet.getCell('A1').alignment = { horizontal: 'center', vertical: 'middle' };
          perfSheet.mergeCells('A1:D1');
          perfSheet.getRow(1).height = 35;
          
          let perfRow = 3;
          
          // Employee Info Section
          perfSheet.getCell(`A${perfRow}`).value = tr('reports.excel.performance.employeeInfo', 'Employee Information');
          perfSheet.getCell(`A${perfRow}`).font = { size: 12, bold: true };
          perfSheet.getCell(`A${perfRow}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE7E6E6' } };
          perfSheet.mergeCells(`A${perfRow}:D${perfRow}`);
          perfRow++;
          
          const addInfo = (label, value) => {
            perfSheet.getCell(`A${perfRow}`).value = label;
            perfSheet.getCell(`B${perfRow}`).value = value;
            perfSheet.getCell(`A${perfRow}`).font = { bold: true };
            perfSheet.mergeCells(`B${perfRow}:D${perfRow}`);
            perfRow++;
          };
          
          addInfo(tr('reports.excel.performance.name', 'Name'), getDemoEmployeeName(employee, t));
          addInfo(tr('reports.excel.performance.department', 'Department'), translateDepartment(employee.department));
          addInfo(tr('reports.excel.performance.position', 'Position'), translatePosition(employee.position));
          addInfo(tr('reports.excel.performance.email', 'Email'), employee.email || 'N/A');
          addInfo(tr('reports.excel.performance.reportPeriod', 'Report Period'), `${filters.startDate} ${tr('reports.to', 'to')} ${filters.endDate}`);
          perfRow++;
          
          // Performance Metrics Section
          const employeeTimeEntries = timeEntries.filter(e => e.employee_id === employee.id);
          const employeeTasks = tasks.filter(t => t.employee_id === employee.id);
          const employeeGoals = goals.filter(g => g.employee_id === employee.id);
          
          perfSheet.getCell(`A${perfRow}`).value = tr('reports.excel.performance.performanceMetrics', 'Performance Metrics');
          perfSheet.getCell(`A${perfRow}`).font = { size: 12, bold: true, color: { argb: 'FFFFFFFF' } };
          perfSheet.getCell(`A${perfRow}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF70AD47' } };
          perfSheet.mergeCells(`A${perfRow}:D${perfRow}`);
          perfRow++;
          
          // Metrics table header
          [
            tr('reports.excel.performance.tableHeaders.metric', 'Metric'),
            tr('reports.excel.performance.tableHeaders.value', 'Value'),
            tr('reports.excel.performance.tableHeaders.status', 'Status'),
            tr('reports.excel.performance.tableHeaders.notes', 'Notes')
          ].forEach((header, idx) => {
            const cell = perfSheet.getCell(perfRow, idx + 1);
            cell.value = header;
            cell.font = { bold: true };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9E1F2' } };
            cell.alignment = { horizontal: 'center' };
          });
          perfRow++;
          
          // Time Tracking Metrics
          const totalHours = employeeTimeEntries.reduce((sum, e) => sum + (e.hours || 0), 0);
          const regularHours = employeeTimeEntries.filter(e => e.hour_type === 'regular').reduce((sum, e) => sum + (e.hours || 0), 0);
          // Include both overtime and bonus as overtime hours
          const overtimeHours = employeeTimeEntries.filter(e => e.hour_type === 'overtime' || e.hour_type === 'bonus').reduce((sum, e) => sum + (e.hours || 0), 0);
          const wfhHours = employeeTimeEntries.filter(e => e.hour_type === 'wfh').reduce((sum, e) => sum + (e.hours || 0), 0);
          const approvedEntries = employeeTimeEntries.filter(e => e.status === 'approved').length;

          const perfLabels = {
            totalHours: tr('reports.excel.metrics.totalHours', 'Total Hours Logged'),
            regularHours: tr('reports.excel.metrics.regularHours', 'Regular Hours'),
            overtimeHours: tr('reports.excel.metrics.overtimeHours', 'Overtime Hours'),
            wfhHours: tr('reports.excel.metrics.wfhHours', 'WFH Hours'),
            approvalRate: tr('reports.excel.performance.approvalRate', 'Approval Rate'),
            totalTasks: tr('reports.excel.metrics.totalTasks', 'Total Tasks'),
            taskCompletionRate: tr('reports.excel.performance.taskCompletionRate', 'Task Completion Rate'),
            totalGoals: tr('reports.excel.metrics.totalGoals', 'Total Goals'),
            avgGoalProgress: tr('reports.excel.performance.avgGoalProgress', 'Average Goal Progress'),
            entries: tr('reports.excel.entries', 'entries'),
            ofTotal: tr('reports.excel.ofTotal', 'of total'),
            completed: tr('reports.excel.completedShort', 'completed')
          };

          const statusLabels = {
            high: tr('reports.excel.status.high', 'High'),
            normal: tr('reports.excel.status.normal', 'Normal'),
            tracked: tr('reports.excel.status.tracked', 'Tracked'),
            pending: tr('reports.excel.status.pending', 'Pending'),
            allApproved: tr('reports.excel.status.allApproved', 'All Approved'),
            active: tr('reports.excel.status.active', 'Active'),
            noTasks: tr('reports.excel.status.noTasks', 'No Tasks'),
            excellent: tr('reports.excel.status.excellent', 'Excellent'),
            good: tr('reports.excel.status.good', 'Good'),
            needsImprovement: tr('reports.excel.status.needsImprovement', 'Needs Improvement'),
            set: tr('reports.excel.status.set', 'Set'),
            onTrack: tr('reports.excel.status.onTrack', 'On Track'),
            progressing: tr('reports.excel.status.progressing', 'Progressing'),
            behind: tr('reports.excel.status.behind', 'Behind')
          };
          
          const addMetric = (metric, value, status, notes) => {
            perfSheet.getCell(`A${perfRow}`).value = metric;
            perfSheet.getCell(`B${perfRow}`).value = value;
            perfSheet.getCell(`C${perfRow}`).value = status;
            perfSheet.getCell(`D${perfRow}`).value = notes;
            perfSheet.getCell(`B${perfRow}`).alignment = { horizontal: 'right' };
            perfRow++;
          };
          const entriesCountLabel = `${employeeTimeEntries.length} ${perfLabels.entries}`;
          const totalHoursDenominator = totalHours > 0 ? totalHours : 1;
          const approvalPercent = employeeTimeEntries.length > 0 ? ((approvedEntries / employeeTimeEntries.length) * 100).toFixed(0) : '0';
          
          addMetric(
            perfLabels.totalHours,
            totalHours.toFixed(1),
            totalHours > 160 ? `⚠️ ${statusLabels.high}` : `✅ ${statusLabels.normal}`,
            entriesCountLabel
          );
          addMetric(
            perfLabels.regularHours,
            regularHours.toFixed(1),
            `✅ ${statusLabels.tracked}`,
            `${((regularHours / totalHoursDenominator) * 100).toFixed(0)}% ${perfLabels.ofTotal}`
          );
          addMetric(
            perfLabels.overtimeHours,
            overtimeHours.toFixed(1),
            overtimeHours > 20 ? `⚠️ ${statusLabels.high}` : `✅ ${statusLabels.normal}`,
            `${((overtimeHours / totalHoursDenominator) * 100).toFixed(0)}% ${perfLabels.ofTotal}`
          );
          addMetric(
            perfLabels.wfhHours,
            wfhHours.toFixed(1),
            `✅ ${statusLabels.tracked}`,
            `${totalHours > 0 ? (wfhHours / totalHours * 100).toFixed(0) : 0}% ${perfLabels.ofTotal}`
          );
          addMetric(
            perfLabels.approvalRate,
            `${approvedEntries}/${employeeTimeEntries.length}`,
            approvedEntries === employeeTimeEntries.length ? `✅ ${statusLabels.allApproved}` : `⏳ ${statusLabels.pending}`,
            `${approvalPercent}%`
          );
          perfRow++;
          
          // Task Performance
          const completedTasks = employeeTasks.filter(t => t.status === 'completed').length;
          const taskCompletionRate = employeeTasks.length > 0 ? ((completedTasks / employeeTasks.length) * 100).toFixed(1) : 0;
          
          addMetric(
            perfLabels.totalTasks,
            employeeTasks.length,
            employeeTasks.length > 0 ? `✅ ${statusLabels.active}` : `⚠️ ${statusLabels.noTasks}`,
            `${completedTasks} ${perfLabels.completed}`
          );
          addMetric(
            perfLabels.taskCompletionRate,
            `${taskCompletionRate}%`,
            taskCompletionRate >= 80 ? `✅ ${statusLabels.excellent}` : taskCompletionRate >= 60 ? `⚠️ ${statusLabels.good}` : `❌ ${statusLabels.needsImprovement}`,
            `${completedTasks}/${employeeTasks.length} ${perfLabels.completed}`
          );
          perfRow++;
          
          // Goals Performance
          const completedGoals = employeeGoals.filter(g => g.status === 'completed').length;
          const avgProgress = employeeGoals.length > 0 ? (employeeGoals.reduce((sum, g) => sum + (g.status === 'completed' ? 100 : (g.progress || 0)), 0) / employeeGoals.length).toFixed(1) : 0;
          
          addMetric(
            perfLabels.totalGoals,
            employeeGoals.length,
            employeeGoals.length > 0 ? `✅ ${statusLabels.set}` : `⚠️ ${statusLabels.noTasks}`,
            `${completedGoals} ${perfLabels.completed}`
          );
          addMetric(
            perfLabels.avgGoalProgress,
            `${avgProgress}%`,
            avgProgress >= 75 ? `✅ ${statusLabels.onTrack}` : avgProgress >= 50 ? `⚠️ ${statusLabels.progressing}` : `❌ ${statusLabels.behind}`,
            `${employeeGoals.length} ${tr('reports.goals', 'Goals')} ${statusLabels.tracked}`
          );
          perfRow += 2;
          
          // Performance Summary
          perfSheet.getCell(`A${perfRow}`).value = tr('reports.excel.performance.overallRating', 'Overall Performance Rating');
          perfSheet.getCell(`A${perfRow}`).font = { size: 12, bold: true, color: { argb: 'FFFFFFFF' } };
          perfSheet.getCell(`A${perfRow}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFC000' } };
          perfSheet.mergeCells(`A${perfRow}:D${perfRow}`);
          perfRow++;
          
          // Calculate overall score
          const timeScore = Math.min(100, (approvedEntries / Math.max(1, employeeTimeEntries.length)) * 100);
          const taskScore = parseFloat(taskCompletionRate);
          const goalScore = parseFloat(avgProgress);
          const overallScore = ((timeScore + taskScore + goalScore) / 3).toFixed(1);
          
          perfSheet.getCell(`A${perfRow}`).value = tr('reports.excel.performance.overallScore', 'Overall Performance Score:');
          perfSheet.getCell(`B${perfRow}`).value = `${overallScore}%`;
          perfSheet.getCell(`A${perfRow}`).font = { bold: true, size: 14 };
          perfSheet.getCell(`B${perfRow}`).font = { bold: true, size: 16, color: { argb: overallScore >= 80 ? 'FF00B050' : overallScore >= 60 ? 'FFFFC000' : 'FFFF0000' } };
          perfSheet.getCell(`B${perfRow}`).alignment = { horizontal: 'center' };
          perfSheet.mergeCells(`B${perfRow}:D${perfRow}`);
          perfRow++;
          
          perfSheet.getCell(`A${perfRow}`).value = tr('reports.excel.performance.ratingLabel', 'Rating:');
          const rating = overallScore >= 90
            ? `⭐⭐⭐⭐⭐ ${tr('reports.excel.rating.outstanding', 'Outstanding')}`
            : overallScore >= 80
            ? `⭐⭐⭐⭐ ${tr('reports.excel.rating.excellent', 'Excellent')}`
            : overallScore >= 70
            ? `⭐⭐⭐ ${tr('reports.excel.rating.good', 'Good')}`
            : overallScore >= 60
            ? `⭐⭐ ${tr('reports.excel.rating.satisfactory', 'Satisfactory')}`
            : `⭐ ${tr('reports.excel.rating.needsImprovement', 'Needs Improvement')}`;
          perfSheet.getCell(`B${perfRow}`).value = rating;
          perfSheet.getCell(`A${perfRow}`).font = { bold: true };
          perfSheet.getCell(`B${perfRow}`).font = { bold: true, size: 12 };
          perfSheet.mergeCells(`B${perfRow}:D${perfRow}`);
          
          // Set column widths
          perfSheet.columns = [
            { width: 25 }, { width: 20 }, { width: 20 }, { width: 30 }
          ];
        }
      }

      if (selectedEmployee === 'all' && employees.length > 0) {
        const overviewSheet = workbook.addWorksheet(tr('reports.excel.sheets.allEmployeesOverview', 'All Employees Overview'));
        const overviewHeaders = [
          tr('reports.excel.performance.name', 'Name'),
          tr('reports.excel.performance.department', 'Department'),
          tr('reports.excel.performance.position', 'Position'),
          tr('reports.excel.metrics.totalHours', 'Total Hours Logged'),
          tr('reports.excel.metrics.totalTasks', 'Total Tasks'),
          tr('reports.excel.metrics.completedTasks', 'Completed Tasks'),
          tr('reports.excel.metrics.totalGoals', 'Total Goals'),
          tr('reports.excel.performance.avgGoalProgress', 'Average Goal Progress'),
          tr('reports.excel.performance.overallScore', 'Overall Score')
        ];

        overviewHeaders.forEach((header, idx) => {
          const cell = overviewSheet.getCell(1, idx + 1);
          cell.value = header;
          cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF7030A0' } };
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
        });

        employees.forEach((employee, idx) => {
          const performance = computeEmployeePerformance(employee, timeEntries, tasks, goals);
          const rowNum = idx + 2;
          const rowData = [
            getDemoEmployeeName(employee, t),
            translateDepartment(employee.department),
            translatePosition(employee.position),
            Number(performance.totalHours.toFixed(1)),
            performance.tasksCount,
            performance.completedTasks,
            performance.goalsCount,
            Number(performance.avgGoalProgress),
            Number(performance.overallScore)
          ];

          rowData.forEach((value, colIdx) => {
            const cell = overviewSheet.getCell(rowNum, colIdx + 1);
            cell.value = value;
            if (colIdx >= 3) {
              cell.alignment = { horizontal: 'center', vertical: 'middle' };
            }
            if (idx % 2 === 0) {
              cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3E8FF' } };
            }
          });
        });

        overviewSheet.columns = [
          { width: 22 }, { width: 16 }, { width: 16 }, { width: 14 },
          { width: 12 }, { width: 14 }, { width: 12 }, { width: 16 }, { width: 14 }
        ];
        overviewSheet.views = [{ state: 'frozen', xSplit: 0, ySplit: 1 }];
      }

      // ==================== CHARTS SHEET WITH DATA ====================
      if (timeEntries.length > 0 || tasks.length > 0 || goals.length > 0) {
        const chartsSheet = workbook.addWorksheet(sheetNames.charts);
        
        let chartRow = 1;
        
        // Hours by Type Chart Data
        if (timeEntries.length > 0) {
          chartsSheet.getCell(`A${chartRow}`).value = tr('reports.excel.charts.hoursByType', 'Hours by Type').toUpperCase();
          chartsSheet.getCell(`A${chartRow}`).font = { size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
          chartsSheet.getCell(`A${chartRow}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } };
          chartsSheet.mergeCells(`A${chartRow}:B${chartRow}`);
          chartRow++;
          
          chartsSheet.getCell(`A${chartRow}`).value = tr('reports.excel.headers.type', 'Type');
          chartsSheet.getCell(`B${chartRow}`).value = tr('reports.excel.headers.hours', 'Hours');
          chartsSheet.getRow(chartRow).font = { bold: true };
          chartsSheet.getRow(chartRow).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9E1F2' } };
          chartRow++;
          
          const hoursByType = {};
          timeEntries.forEach(entry => {
            const type = entry.hour_type || 'unknown';
            hoursByType[type] = (hoursByType[type] || 0) + (entry.hours || 0);
          });
          
          Object.entries(hoursByType).forEach(([type, hours]) => {
            chartsSheet.getCell(`A${chartRow}`).value = translateHourType(type) || type;
            chartsSheet.getCell(`B${chartRow}`).value = parseFloat(hours.toFixed(2));
            chartRow++;
          });
          chartRow += 2;
          
          // Status Distribution
          chartsSheet.getCell(`A${chartRow}`).value = tr('reports.excel.charts.statusDistribution', 'Status Distribution').toUpperCase();
          chartsSheet.getCell(`A${chartRow}`).font = { size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
          chartsSheet.getCell(`A${chartRow}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF70AD47' } };
          chartsSheet.mergeCells(`A${chartRow}:B${chartRow}`);
          chartRow++;
          
          chartsSheet.getCell(`A${chartRow}`).value = tr('reports.excel.headers.status', 'Status');
          chartsSheet.getCell(`B${chartRow}`).value = tr('reports.excel.headers.count', 'Count');
          chartsSheet.getRow(chartRow).font = { bold: true };
          chartsSheet.getRow(chartRow).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9E1F2' } };
          chartRow++;
          
          const statusCounts = {};
          timeEntries.forEach(entry => {
            const status = entry.status || 'unknown';
            statusCounts[status] = (statusCounts[status] || 0) + 1;
          });
          
          Object.entries(statusCounts).forEach(([status, count]) => {
            chartsSheet.getCell(`A${chartRow}`).value = translateStatus(status) || status;
            chartsSheet.getCell(`B${chartRow}`).value = count;
            chartRow++;
          });
          chartRow += 2;
        }
        
        // Task Metrics
        if (tasks.length > 0) {
          chartsSheet.getCell(`A${chartRow}`).value = tr('reports.excel.charts.taskStatusDistribution', 'Task Status Distribution').toUpperCase();
          chartsSheet.getCell(`A${chartRow}`).font = { size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
          chartsSheet.getCell(`A${chartRow}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFC000' } };
          chartsSheet.mergeCells(`A${chartRow}:B${chartRow}`);
          chartRow++;
          
          chartsSheet.getCell(`A${chartRow}`).value = tr('reports.excel.headers.status', 'Status');
          chartsSheet.getCell(`B${chartRow}`).value = tr('reports.excel.headers.count', 'Count');
          chartsSheet.getRow(chartRow).font = { bold: true };
          chartsSheet.getRow(chartRow).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFE699' } };
          chartRow++;
          
          const taskStatus = {};
          tasks.forEach(task => {
            const status = task.status || 'unknown';
            taskStatus[status] = (taskStatus[status] || 0) + 1;
          });
          
          Object.entries(taskStatus).forEach(([status, count]) => {
            chartsSheet.getCell(`A${chartRow}`).value = translateStatus(status) || status;
            chartsSheet.getCell(`B${chartRow}`).value = count;
            chartRow++;
          });
          chartRow += 2;
          
          // Task Priority
          chartsSheet.getCell(`A${chartRow}`).value = tr('reports.excel.charts.taskPriorityDistribution', 'Task Priority Distribution').toUpperCase();
          chartsSheet.getCell(`A${chartRow}`).font = { size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
          chartsSheet.getCell(`A${chartRow}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFED7D31' } };
          chartsSheet.mergeCells(`A${chartRow}:B${chartRow}`);
          chartRow++;
          
          chartsSheet.getCell(`A${chartRow}`).value = tr('reports.excel.headers.priority', 'Priority');
          chartsSheet.getCell(`B${chartRow}`).value = tr('reports.excel.headers.count', 'Count');
          chartsSheet.getRow(chartRow).font = { bold: true };
          chartsSheet.getRow(chartRow).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF4B084' } };
          chartRow++;
          
          const taskPriority = {};
          tasks.forEach(task => {
            const priority = task.priority || 'unknown';
            taskPriority[priority] = (taskPriority[priority] || 0) + 1;
          });
          
          Object.entries(taskPriority).forEach(([priority, count]) => {
            chartsSheet.getCell(`A${chartRow}`).value = translatePriority(priority) || priority;
            chartsSheet.getCell(`B${chartRow}`).value = count;
            chartRow++;
          });
          chartRow += 2;
        }

        if (goals.length > 0) {
          chartsSheet.getCell(`A${chartRow}`).value = tr('reports.excel.charts.goalStatusDistribution', 'Goal Status Distribution').toUpperCase();
          chartsSheet.getCell(`A${chartRow}`).font = { size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
          chartsSheet.getCell(`A${chartRow}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF5B9BD5' } };
          chartsSheet.mergeCells(`A${chartRow}:B${chartRow}`);
          chartRow++;

          chartsSheet.getCell(`A${chartRow}`).value = tr('reports.excel.headers.status', 'Status');
          chartsSheet.getCell(`B${chartRow}`).value = tr('reports.excel.headers.count', 'Count');
          chartsSheet.getRow(chartRow).font = { bold: true };
          chartsSheet.getRow(chartRow).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDCE6F1' } };
          chartRow++;

          Object.entries(aggregateCounts(goals, 'status')).forEach(([status, count]) => {
            chartsSheet.getCell(`A${chartRow}`).value = translateStatus(status) || status;
            chartsSheet.getCell(`B${chartRow}`).value = count;
            chartRow++;
          });
          chartRow += 2;

          chartsSheet.getCell(`A${chartRow}`).value = tr('reports.excel.charts.goalCategoryDistribution', 'Goal Category Distribution').toUpperCase();
          chartsSheet.getCell(`A${chartRow}`).font = { size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
          chartsSheet.getCell(`A${chartRow}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF8064A2' } };
          chartsSheet.mergeCells(`A${chartRow}:B${chartRow}`);
          chartRow++;

          chartsSheet.getCell(`A${chartRow}`).value = tr('reports.excel.headers.category', 'Category');
          chartsSheet.getCell(`B${chartRow}`).value = tr('reports.excel.headers.count', 'Count');
          chartsSheet.getRow(chartRow).font = { bold: true };
          chartsSheet.getRow(chartRow).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE4DFEC' } };
          chartRow++;

          Object.entries(aggregateCounts(goals, 'category')).forEach(([category, count]) => {
            chartsSheet.getCell(`A${chartRow}`).value = translateCategory(category) || category;
            chartsSheet.getCell(`B${chartRow}`).value = count;
            chartRow++;
          });
        }
        
        // Set column widths
        chartsSheet.getColumn(1).width = 25;
        chartsSheet.getColumn(2).width = 15;
      }

      // ==================== TIME ENTRIES SHEET WITH STYLING ====================
      if (timeEntries.length > 0) {
        const timeEntriesSheet = workbook.addWorksheet(sheetNames.timeEntries);
        
        // Headers
        const headers = [
          tr('reports.excel.headers.employee', 'Employee'),
          tr('reports.excel.headers.department', 'Department'),
          tr('reports.excel.headers.position', 'Position'),
          tr('reports.excel.headers.date', 'Date'),
          tr('reports.excel.headers.clockIn', 'Clock In'),
          tr('reports.excel.headers.clockOut', 'Clock Out'),
          tr('reports.excel.headers.hours', 'Hours'),
          tr('reports.excel.headers.hourType', 'Hour Type'),
          tr('reports.excel.headers.status', 'Status'),
          tr('reports.excel.headers.notes', 'Notes'),
          tr('reports.excel.headers.createdAt', 'Created At')
        ];
        headers.forEach((header, idx) => {
          const cell = timeEntriesSheet.getCell(1, idx + 1);
          cell.value = header;
          cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } };
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
        });
        
        // Data rows with alternating colors
        timeEntries.forEach((entry, idx) => {
          const rowNum = idx + 2;
          const rowData = [
            isDemoMode() ? getDemoEmployeeName(entry.employee, t) : (entry.employee?.name || 'Unknown'),
            translateDepartment(entry.employee?.department) || '',
            translatePosition(entry.employee?.position) || '',
            entry.date,
            entry.clock_in || '',
            entry.clock_out || '',
            entry.hours || 0,
            translateHourType(entry.hour_type) || '',
            translateStatus(entry.status) || '',
            translateNotes(entry.notes) || '',
            new Date(entry.created_at).toLocaleString()
          ];
          
          rowData.forEach((value, colIdx) => {
            const cell = timeEntriesSheet.getCell(rowNum, colIdx + 1);
            cell.value = value;
            // Center align specific columns: Date(4), Clock In(5), Clock Out(6), Hours(7), Hour Type(8), Status(9)
            if ([3, 4, 5, 6, 7, 8].includes(colIdx)) {
              cell.alignment = { horizontal: 'center', vertical: 'middle' };
            }
            if (idx % 2 === 0) {
              cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F2F2' } };
            }
          });
        });
        
        // Set column widths
        timeEntriesSheet.columns = [
          { width: 20 }, { width: 15 }, { width: 15 }, { width: 12 },
          { width: 10 }, { width: 10 }, { width: 8 }, { width: 12 },
          { width: 12 }, { width: 30 }, { width: 20 }
        ];
        
        // Freeze header row
        timeEntriesSheet.views = [{ state: 'frozen', xSplit: 0, ySplit: 1 }];
      }

      // ==================== TASKS SHEET WITH STYLING ====================
      if (tasks.length > 0) {
        const tasksSheet = workbook.addWorksheet(sheetNames.tasks);
        
        // Headers
        const headers = [
          tr('reports.excel.headers.employee', 'Employee'),
          tr('reports.excel.headers.department', 'Department'),
          tr('reports.excel.headers.taskTitle', 'Task Title'),
          tr('reports.excel.headers.description', 'Description'),
          tr('reports.excel.headers.priority', 'Priority'),
          tr('reports.excel.headers.status', 'Status'),
          tr('reports.excel.headers.dueDate', 'Due Date'),
          tr('taskListing.completionDate', 'Completion Date'),
          tr('reports.excel.headers.estimatedHours', 'Estimated Hours'),
          tr('reports.excel.headers.actualHours', 'Actual Hours'),
          tr('reports.excel.headers.variance', 'Variance'),
          tr('reports.excel.headers.createdAt', 'Created At'),
          tr('reports.excel.headers.updatedAt', 'Updated At')
        ];
        headers.forEach((header, idx) => {
          const cell = tasksSheet.getCell(1, idx + 1);
          cell.value = header;
          cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFC000' } };
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
        });
        
        // Data rows with conditional formatting
        tasks.forEach((task, idx) => {
          const rowNum = idx + 2;
          const variance = (task.actual_hours || 0) - (task.estimated_hours || 0);
          const rowData = [
            isDemoMode() ? getDemoEmployeeName(task.employee, t) : (task.employee?.name || 'Unknown'),
            translateDepartment(task.employee?.department) || '',
            isDemoMode() ? getDemoTaskTitle(task, t) : (task.title || ''),
            isDemoMode() ? getDemoTaskDescription(task, t) : (task.description || ''),
            translatePriority(task.priority) || '',
            translateStatus(task.status) || '',
            task.due_date || '',
            task.completion_date || '',
            task.estimated_hours || 0,
            task.actual_hours || 0,
            variance,
            new Date(task.created_at).toLocaleString(),
            new Date(task.updated_at).toLocaleString()
          ];
          
          rowData.forEach((value, colIdx) => {
            const cell = tasksSheet.getCell(rowNum, colIdx + 1);
            cell.value = value;
            
            if ([4, 5, 6, 7, 8, 9, 10, 11].includes(colIdx)) {
              cell.alignment = { horizontal: 'center', vertical: 'middle' };
            }
            
            if (idx % 2 === 0) {
              cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFF0' } };
            }
            
            if (colIdx === 10) {
              if (variance > 0) {
                cell.font = { color: { argb: 'FFFF0000' } }; // Red for over
              } else if (variance < 0) {
                cell.font = { color: { argb: 'FF00B050' } }; // Green for under
              }
            }
          });
        });
        
        // Set column widths
        tasksSheet.columns = [
          { width: 20 }, { width: 15 }, { width: 25 }, { width: 35 },
          { width: 12 }, { width: 12 }, { width: 12 }, { width: 14 },
          { width: 12 }, { width: 12 }, { width: 12 }, { width: 20 }, { width: 20 }
        ];
        
        // Freeze header row
        tasksSheet.views = [{ state: 'frozen', xSplit: 0, ySplit: 1 }];
      }

      // ==================== GOALS SHEET WITH STYLING ====================
      if (goals.length > 0) {
        const goalsSheet = workbook.addWorksheet(sheetNames.goals);
        
        // Headers
        const headers = [
          tr('reports.excel.headers.employee', 'Employee'),
          tr('reports.excel.headers.department', 'Department'),
          tr('reports.excel.headers.goalTitle', 'Goal Title'),
          tr('reports.excel.headers.description', 'Description'),
          tr('reports.excel.headers.category', 'Category'),
          tr('reports.excel.headers.status', 'Status'),
          tr('reports.excel.headers.progress', 'Progress (%)'),
          tr('reports.excel.headers.targetDate', 'Target Date'),
          tr('reports.excel.headers.notes', 'Notes'),
          tr('reports.excel.headers.createdAt', 'Created At'),
          tr('reports.excel.headers.updatedAt', 'Updated At')
        ];
        headers.forEach((header, idx) => {
          const cell = goalsSheet.getCell(1, idx + 1);
          cell.value = header;
          cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF5B9BD5' } };
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
        });
        
        // Data rows with progress bar visualization
        goals.forEach((goal, idx) => {
          const rowNum = idx + 2;
          const rowData = [
            isDemoMode() ? getDemoEmployeeName(goal.employee, t) : (goal.employee?.name || 'Unknown'),
            translateDepartment(goal.employee?.department) || '',
            isDemoMode() ? getDemoGoalTitle(goal, t) : (goal.title || ''),
            isDemoMode() ? getDemoGoalDescription(goal, t) : (goal.description || ''),
            translateCategory(goal.category) || '',
            translateStatus(goal.status) || '',
            goal.progress || 0,
            goal.target_date || '',
            goal.notes || '',
            new Date(goal.created_at).toLocaleString(),
            new Date(goal.updated_at).toLocaleString()
          ];
          
          rowData.forEach((value, colIdx) => {
            const cell = goalsSheet.getCell(rowNum, colIdx + 1);
            cell.value = value;
            
            // Center align specific columns: Category(5), Status(6), Progress(7), Target Date(8)
            if ([4, 5, 6, 7].includes(colIdx)) {
              cell.alignment = { horizontal: 'center', vertical: 'middle' };
            }
            
            // Alternating row colors
            if (idx % 2 === 0) {
              cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE7F3FF' } };
            }
            
            // Color code progress column
            if (colIdx === 6) { // Progress column
              const progress = goal.progress || 0;
              if (progress === 100) {
                cell.font = { bold: true, color: { argb: 'FF00B050' } };
              } else if (progress >= 75) {
                cell.font = { bold: true, color: { argb: 'FF92D050' } };
              } else if (progress >= 50) {
                cell.font = { bold: true, color: { argb: 'FFFFC000' } };
              } else if (progress >= 25) {
                cell.font = { bold: true, color: { argb: 'FFFF6600' } };
              } else {
                cell.font = { bold: true, color: { argb: 'FFFF0000' } };
              }
            }
          });
        });
        
        // Set column widths
        goalsSheet.columns = [
          { width: 20 }, { width: 15 }, { width: 25 }, { width: 35 },
          { width: 15 }, { width: 12 }, { width: 12 }, { width: 12 },
          { width: 30 }, { width: 20 }, { width: 20 }
        ];
        
        // Freeze header row
        goalsSheet.views = [{ state: 'frozen', xSplit: 0, ySplit: 1 }];
      }

      // Write the file with ExcelJS
      // Safe filename and export
      const filenamePrefixRaw = tr('reports.filenamePrefix', 'HR_Report_');
      const prefixPart = toFilePart(filenamePrefixRaw || 'HR_Report_');
      const normalizedPrefix = prefixPart.endsWith('_') ? prefixPart : `${prefixPart}_`;
      const safeEmployee = toFilePart(employeeName || tr('reports.allEmployees', 'All Employees'));
      const rangeSeparator = toFilePart(tr('reports.to', 'to'), 'to');
      const rawFilename = `${normalizedPrefix}${safeEmployee}_${filters.startDate}_${rangeSeparator}_${filters.endDate}_${currentLanguage.toUpperCase()}.xlsx`;
      // Use raw filename so browsers keep readable Unicode names; safe parts already sanitized
      const filename = rawFilename;
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      alert(t('reports.exportSuccess', 'Excel report exported successfully with styled tables, metrics, and chart data!'));
    } catch (error) {
      console.error('Error exporting Excel:', error);
      alert(t('reports.errorExporting', 'Error exporting Excel file') + ': ' + error.message);
    } finally {
      setExporting(false);
    }
  };

  const cleanTextForPDF = (text, unicodeFont = false) => {
    if (!text) return '';
    
    if (unicodeFont) {
      let cleaned = String(text)
        .replace(/[\u200B-\u200D\uFEFF\u0000-\u001F\u007F-\u009F]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
      return cleaned || 'N/A';
    }

    const charMap = {
      // Vietnamese lowercase
      'à': 'a', 'á': 'a', 'ả': 'a', 'ã': 'a', 'ạ': 'a',
      'ă': 'a', 'ằ': 'a', 'ắ': 'a', 'ẳ': 'a', 'ẵ': 'a', 'ặ': 'a',
      'â': 'a', 'ầ': 'a', 'ấ': 'a', 'ẩ': 'a', 'ẫ': 'a', 'ậ': 'a',
      'đ': 'd',
      'è': 'e', 'é': 'e', 'ẻ': 'e', 'ẽ': 'e', 'ẹ': 'e',
      'ê': 'e', 'ề': 'e', 'ế': 'e', 'ể': 'e', 'ễ': 'e', 'ệ': 'e',
      'ì': 'i', 'í': 'i', 'ỉ': 'i', 'ĩ': 'i', 'ị': 'i',
      'ò': 'o', 'ó': 'o', 'ỏ': 'o', 'õ': 'o', 'ọ': 'o',
      'ô': 'o', 'ồ': 'o', 'ố': 'o', 'ổ': 'o', 'ỗ': 'o', 'ộ': 'o',
      'ơ': 'o', 'ờ': 'o', 'ớ': 'o', 'ở': 'o', 'ỡ': 'o', 'ợ': 'o',
      'ù': 'u', 'ú': 'u', 'ủ': 'u', 'ũ': 'u', 'ụ': 'u',
      'ư': 'u', 'ừ': 'u', 'ứ': 'u', 'ử': 'u', 'ữ': 'u', 'ự': 'u',
      'ỳ': 'y', 'ý': 'y', 'ỷ': 'y', 'ỹ': 'y', 'ỵ': 'y',
      // Vietnamese uppercase
      'À': 'A', 'Á': 'A', 'Ả': 'A', 'Ã': 'A', 'Ạ': 'A',
      'Ă': 'A', 'Ằ': 'A', 'Ắ': 'A', 'Ẳ': 'A', 'Ẵ': 'A', 'Ặ': 'A',
      'Â': 'A', 'Ầ': 'A', 'Ấ': 'A', 'Ẩ': 'A', 'Ẫ': 'A', 'Ậ': 'A',
      'Đ': 'D',
      'È': 'E', 'É': 'E', 'Ẻ': 'E', 'Ẽ': 'E', 'Ẹ': 'E',
      'Ê': 'E', 'Ề': 'E', 'Ế': 'E', 'Ể': 'E', 'Ễ': 'E', 'Ệ': 'E',
      'Ì': 'I', 'Í': 'I', 'Ỉ': 'I', 'Ĩ': 'I', 'Ị': 'I',
      'Ò': 'O', 'Ó': 'O', 'Ỏ': 'O', 'Õ': 'O', 'Ọ': 'O',
      'Ô': 'O', 'Ồ': 'O', 'Ố': 'O', 'Ổ': 'O', 'Ỗ': 'O', 'Ộ': 'O',
      'Ơ': 'O', 'Ờ': 'O', 'Ớ': 'O', 'Ở': 'O', 'Ỡ': 'O', 'Ợ': 'O',
      'Ù': 'U', 'Ú': 'U', 'Ủ': 'U', 'Ũ': 'U', 'Ụ': 'U',
      'Ư': 'U', 'Ừ': 'U', 'Ứ': 'U', 'Ử': 'U', 'Ữ': 'U', 'Ự': 'U',
      'Ỳ': 'Y', 'Ý': 'Y', 'Ỷ': 'Y', 'Ỹ': 'Y', 'Ỵ': 'Y',
      // German umlauts
      'ä': 'ae', 'ö': 'oe', 'ü': 'ue', 'ß': 'ss',
      'Ä': 'Ae', 'Ö': 'Oe', 'Ü': 'Ue',
      // Spanish
      'ñ': 'n', 'Ñ': 'N',
      // French
      'ç': 'c', 'Ç': 'C',
      'œ': 'oe', 'Œ': 'OE',
      'æ': 'ae', 'Æ': 'AE',
      // Additional accented characters
      'å': 'a', 'Å': 'A',
      'ë': 'e', 'Ë': 'E',
      'ï': 'i', 'Ï': 'I',
      'î': 'i', 'Î': 'I',
      'ø': 'o', 'Ø': 'O',
      'û': 'u', 'Û': 'U',
      'ÿ': 'y', 'Ÿ': 'Y'
    };
    
    let cleaned = String(text);
    
    cleaned = cleaned.split('').map(char => charMap[char] || char).join('');
    
    cleaned = cleaned.normalize('NFD');
    
    cleaned = cleaned.replace(/[\u0300-\u036f]/g, '');
    
    cleaned = cleaned.replace(/[^\x20-\x7E]/g, (match) => {
      if (charMap[match]) return charMap[match];
      const base = match.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      return base !== match ? base : '?';
    });
    
    cleaned = cleaned.replace(/[\u200B-\u200D\uFEFF\u0000-\u001F\u007F-\u009F]/g, '');
    
    cleaned = cleaned.replace(/\s+/g, ' ').trim();
    
    return cleaned || 'N/A';
  };

  const translateHourType = (hourType) => {
    if (!hourType) return '';
    const type = hourType.toLowerCase();
    switch (type) {
      case 'regular':
        return t('timeClock.hourTypes.regular', 'Regular Hours');
      case 'holiday':
        return t('timeClock.hourTypes.holiday', 'Holiday Hours');
      case 'weekend':
        return t('timeClock.hourTypes.weekend', 'Weekend Overtime');
      case 'overtime':
        return t('timeClock.hourTypes.overtime', 'Overtime');
      case 'bonus':
        return t('timeClock.hourTypes.bonus', 'Bonus Hours');
      case 'wfh':
        return t('timeClock.hourTypes.wfh', 'Working From Home');
      case 'on_leave':
        return t('timeClock.hourTypes.onLeave', 'On Leave');  
      default:
        return hourType;
    }
  };

  // Helper function to translate status
  const translateStatus = (status) => {
    if (!status) return '';
    const stat = status.toLowerCase();
    switch (stat) {
      case 'pending':
        return t('reports.statusPending', 'Pending');
      case 'approved':
        return t('reports.statusApproved', 'Approved');
      case 'rejected':
        return t('reports.statusRejected', 'Rejected');
      case 'completed':
        return t('reports.statusCompleted', 'Completed');
      case 'in progress':
      case 'in_progress':
      case 'in-progress':
        return t('reports.statusInProgress', 'In Progress');
      case 'not started':
      case 'not_started':
      case 'not-started':
        return t('reports.statusNotStarted', 'Not Started');
      default:
        return status;
    }
  };

  // Helper function to translate priority
  const translatePriority = (priority) => {
    if (!priority) return '';
    const prio = priority.toLowerCase();
    switch (prio) {
      case 'low':
        return t('reports.priorityLow', 'Low');
      case 'medium':
        return t('reports.priorityMedium', 'Medium');
      case 'high':
        return t('reports.priorityHigh', 'High');
      default:
        return priority;
    }
  };

  // Helper function to translate notes with "Entered by admin:" prefix
  const translateNotes = (notes) => {
    if (!notes) return '';
    // Check if notes starts with "Entered by admin:" (case insensitive, optional colon)
    const adminPrefixRegex = /^Entered by admin:?\s*/i;
    const match = notes.match(adminPrefixRegex);

    if (match) {
      const translatedPrefix = t('timeTracking.enteredByAdmin', 'Entered by admin:');
      // Replace the matched prefix with the translated one and ensure a space follows
      return notes.replace(match[0], translatedPrefix + ' '); 
    }
    return notes;
  };


  // PDF Export with Charts and Tables
  const exportToPDF = async function() {
    setExporting(true);
    try {
      const exportSnapshot = await loadAllReportDataForExport();
      const timeEntries = exportSnapshot.timeEntries;
      const tasks = exportSnapshot.tasks;
      const goals = exportSnapshot.goals;
      const employees = exportSnapshot.employees;
      const exportStats = computeExportStats(timeEntries, tasks, goals);

      if (exportStats.totalRecords === 0) {
        alert(t('reports.noData', 'No data available for the selected period'));
        return;
      }

      const doc = new jsPDF('p', 'mm', 'a4');
      const loadedFonts = await loadPdfFonts(doc, currentLanguage);
      const unicodeFontLoaded = loadedFonts.unicodeReady;

      const drawText = (text, x, y, opts) => {
        const cleaned = cleanTextForPDF(text, unicodeFontLoaded);
        const chosen = choosePdfFont(cleaned, loadedFonts);
        try { doc.setFont(chosen, 'normal'); } catch (e) {}
        if (opts) doc.text(cleaned, x, y, opts); else doc.text(cleaned, x, y);
      };

      if (!unicodeFontLoaded) {
        doc.setFont('helvetica', 'normal');
        console.log('⚠ Using Helvetica with character sanitization (Unicode font unavailable)');
      }

      const getTableFont = () => getPdfTableFont(loadedFonts, currentLanguage);
      
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      let yPosition = 20;

      // Employee name for filename - sanitize for safe filename
      const rawEmployeeName = selectedEmployee !== 'all' ? 
        employees.find(emp => String(emp.id) === String(selectedEmployee))?.name : 
        t('reports.allEmployees', 'All Employees');
      // Only sanitize filename if Unicode font failed to load, otherwise keep original
      const employeeName = unicodeFontLoaded ? 
        (rawEmployeeName || `${t('reports.allEmployees', '')}`).replace(/\s+/g, '_').replace(/[<>:"/\\|?*]/g, '_') :
        cleanTextForPDF(rawEmployeeName || `${t('reports.allEmployees', '')}`, false).replace(/\s+/g, '_');

      // Header
      doc.setFontSize(20);
      doc.setTextColor(40, 44, 52);
      drawText(t('reports.performanceReport', 'HR PERFORMANCE REPORT').toUpperCase(), pageWidth / 2, yPosition, { align: 'center' });
      
      yPosition += 10;
      doc.setFontSize(10);
      doc.setTextColor(100, 100, 100);
      drawText(`${t('reports.generated', 'Generated')}: ${new Date().toLocaleString()}`, pageWidth / 2, yPosition, { align: 'center' });
      
      yPosition += 5;
      drawText(`${t('reports.period', 'Period')}: ${filters.startDate} ${t('reports.to', 'to')} ${filters.endDate}`, pageWidth / 2, yPosition, { align: 'center' });
      
      yPosition += 5;
      const displayEmployeeName = selectedEmployee === 'all' ? 
        t('reports.allEmployees', 'All Employees') : 
        (unicodeFontLoaded ? rawEmployeeName : cleanTextForPDF(rawEmployeeName, false));
      drawText(`${t('reports.employee', 'Employee')}: ${displayEmployeeName}`, pageWidth / 2, yPosition, { align: 'center' });
      
      yPosition += 15;

      // Summary Box
      doc.setFillColor(240, 242, 245);
      doc.rect(15, yPosition, pageWidth - 30, selectedEmployee !== 'all' ? 48 : 40, 'F');
      
      doc.setFontSize(14);
      doc.setTextColor(40, 44, 52);
      drawText(t('reports.summaryOverview', 'SUMMARY OVERVIEW').toUpperCase(), pageWidth / 2, yPosition + 8, { align: 'center' });
      
      yPosition += 15;
      doc.setFontSize(10);
      doc.setTextColor(60, 60, 60);

      drawText(`${t('reports.totalRecords', 'Total Records')}: ${exportStats.totalRecords}`, 25, yPosition);
      drawText(`${t('reports.timeEntries', 'Time Entries')}: ${exportStats.timeEntriesCount}`, 25, yPosition + 6);
      drawText(`${t('reports.tasks', 'Tasks')}: ${exportStats.tasksCount}`, 25, yPosition + 12);
      drawText(`${t('reports.goals', 'Goals')}: ${exportStats.goalsCount}`, 25, yPosition + 18);

      drawText(`${t('reports.totalHours', 'Total Hours')}: ${exportStats.totalHours}h`, pageWidth - 85, yPosition);
      drawText(`${t('reports.approved', 'Approved')}: ${exportStats.approvedTime}`, pageWidth - 85, yPosition + 6);
      drawText(`${t('reports.completedTasks', 'Completed Tasks')}: ${exportStats.completedTasks}`, pageWidth - 85, yPosition + 12);
      drawText(`${t('reports.achievedGoals', 'Achieved Goals')}: ${exportStats.achievedGoals}`, pageWidth - 85, yPosition + 18);

      if (selectedEmployee !== 'all') {
        const employee = employees.find((emp) => String(emp.id) === String(selectedEmployee));
        if (employee) {
          const performance = computeEmployeePerformance(employee, timeEntries, tasks, goals);
          drawText(
            `${t('reports.excel.performance.overallScore', 'Overall Performance Score:')} ${performance.overallScore}%`,
            pageWidth / 2,
            yPosition + 26,
            { align: 'center' }
          );
        }
      }

      yPosition += selectedEmployee !== 'all' ? 43 : 35;

      const toChartItems = (countsMap, translateFn) =>
        Object.entries(countsMap).map(([key, value], index) => ({
          label: translateFn ? (translateFn(key) || key) : key,
          value,
          color: PDF_CHART_COLORS[index % PDF_CHART_COLORS.length]
        }));

      const pdfCharts = [];
      if (timeEntries.length > 0) {
        pdfCharts.push({
          title: t('reports.pdf.charts.hoursByType', 'Hours by Type'),
          items: toChartItems(aggregateHoursByType(timeEntries), translateHourType)
        });
        pdfCharts.push({
          title: t('reports.pdf.charts.statusDistribution', 'Time Entry Status Distribution'),
          items: toChartItems(aggregateCounts(timeEntries, 'status'), translateStatus)
        });
      }
      if (tasks.length > 0) {
        pdfCharts.push({
          title: t('reports.pdf.charts.taskStatusDistribution', 'Task Status Distribution'),
          items: toChartItems(aggregateCounts(tasks, 'status'), translateStatus)
        });
        pdfCharts.push({
          title: t('reports.pdf.charts.taskPriorityDistribution', 'Task Priority Distribution'),
          items: toChartItems(aggregateCounts(tasks, 'priority'), translatePriority)
        });
      }
      if (goals.length > 0) {
        pdfCharts.push({
          title: t('reports.pdf.charts.goalStatusDistribution', 'Goal Status Distribution'),
          items: toChartItems(aggregateCounts(goals, 'status'), translateStatus)
        });
        pdfCharts.push({
          title: t('reports.pdf.charts.goalCategoryDistribution', 'Goal Category Distribution'),
          items: toChartItems(aggregateCounts(goals, 'category'), translateCategory)
        });
      }

      if (pdfCharts.length > 0) {
        if (yPosition > pageHeight - 40) {
          doc.addPage();
          yPosition = 20;
        }
        yPosition = drawPdfChartsSection({
          doc,
          pageWidth,
          pageHeight,
          startY: yPosition,
          charts: pdfCharts,
          drawText,
          sectionTitle: t('reports.pdf.visualAnalytics', 'VISUAL ANALYTICS').toUpperCase()
        });
      }

      const addPdfTable = (title, head, body, headColor, fontSize = 7) => {
        if (body.length === 0) return;
        if (yPosition > pageHeight - 40) {
          doc.addPage();
          yPosition = 20;
        }
        doc.setFontSize(12);
        doc.setTextColor(40, 44, 52);
        drawText(title, 15, yPosition);
        yPosition += 5;

        autoTable(doc, {
          startY: yPosition,
          head: [head],
          body,
          theme: 'striped',
          headStyles: {
            fillColor: headColor,
            textColor: headColor[0] === 255 && headColor[1] === 192 ? 0 : 255,
            fontStyle: 'normal',
            font: getTableFont()
          },
          styles: {
            fontSize,
            cellPadding: 1.5,
            font: getTableFont(),
            fontStyle: 'normal'
          },
          didParseCell: function(data) {
            const cellText = Array.isArray(data.cell.text) ? data.cell.text.join(' ') : String(data.cell.text || '');
            data.cell.styles.font = choosePdfFont(cellText, loadedFonts);
          },
          margin: { left: 15, right: 15 }
        });

        yPosition = doc.lastAutoTable.finalY + 10;
      };

      const pdfHead = (key, fallback) => cleanTextForPDF(t(key, fallback), unicodeFontLoaded);

      if (timeEntries.length > 0) {
        addPdfTable(
          t('reports.timeEntries', 'TIME ENTRIES').toUpperCase(),
          [
            pdfHead('reports.pdf.headers.employee', 'Employee'),
            pdfHead('reports.pdf.headers.department', 'Department'),
            pdfHead('reports.pdf.headers.date', 'Date'),
            pdfHead('reports.pdf.headers.clockIn', 'Clock In'),
            pdfHead('reports.pdf.headers.clockOut', 'Clock Out'),
            pdfHead('reports.pdf.headers.hours', 'Hours'),
            pdfHead('reports.pdf.headers.hourType', 'Type'),
            pdfHead('reports.pdf.headers.status', 'Status')
          ],
          timeEntries.map((entry) => [
            cleanTextForPDF(isDemoMode() ? getDemoEmployeeName(entry.employee, t) : (entry.employee?.name || t('reports.unknown', 'Unknown')), unicodeFontLoaded),
            cleanTextForPDF(translateDepartment(entry.employee?.department) || '', unicodeFontLoaded),
            entry.date,
            entry.clock_in || '-',
            entry.clock_out || '-',
            `${entry.hours || 0}h`,
            cleanTextForPDF(translateHourType(entry.hour_type), unicodeFontLoaded),
            cleanTextForPDF(translateStatus(entry.status), unicodeFontLoaded)
          ]),
          [70, 173, 71]
        );
      }

      if (tasks.length > 0) {
        addPdfTable(
          t('reports.tasks', 'TASKS').toUpperCase(),
          [
            pdfHead('reports.pdf.headers.employee', 'Employee'),
            pdfHead('reports.pdf.headers.department', 'Department'),
            pdfHead('reports.pdf.headers.taskTitle', 'Task'),
            pdfHead('reports.pdf.headers.priority', 'Priority'),
            pdfHead('reports.pdf.headers.status', 'Status'),
            pdfHead('reports.pdf.headers.dueDate', 'Due Date'),
            pdfHead('reports.pdf.headers.estimatedHours', 'Est.'),
            pdfHead('reports.pdf.headers.actualHours', 'Actual')
          ],
          tasks.map((task) => [
            cleanTextForPDF(isDemoMode() ? getDemoEmployeeName(task.employee, t) : (task.employee?.name || t('reports.unknown', 'Unknown')), unicodeFontLoaded),
            cleanTextForPDF(translateDepartment(task.employee?.department) || '', unicodeFontLoaded),
            cleanTextForPDF((isDemoMode() ? getDemoTaskTitle(task, t) : task.title).substring(0, 40), unicodeFontLoaded),
            cleanTextForPDF(translatePriority(task.priority), unicodeFontLoaded),
            cleanTextForPDF(translateStatus(task.status), unicodeFontLoaded),
            task.due_date || '-',
            `${task.estimated_hours || 0}h`,
            `${task.actual_hours || 0}h`
          ]),
          [255, 192, 0]
        );
      }

      if (goals.length > 0) {
        addPdfTable(
          t('reports.personalGoals', 'PERSONAL GOALS').toUpperCase(),
          [
            pdfHead('reports.pdf.headers.employee', 'Employee'),
            pdfHead('reports.pdf.headers.department', 'Department'),
            pdfHead('reports.pdf.headers.goalTitle', 'Goal'),
            pdfHead('reports.pdf.headers.category', 'Category'),
            pdfHead('reports.pdf.headers.status', 'Status'),
            pdfHead('reports.pdf.headers.targetDate', 'Target Date'),
            pdfHead('reports.pdf.headers.progress', 'Progress')
          ],
          goals.map((goal) => [
            cleanTextForPDF(isDemoMode() ? getDemoEmployeeName(goal.employee, t) : (goal.employee?.name || t('reports.unknown', 'Unknown')), unicodeFontLoaded),
            cleanTextForPDF(translateDepartment(goal.employee?.department) || '', unicodeFontLoaded),
            cleanTextForPDF((isDemoMode() ? getDemoGoalTitle(goal, t) : goal.title).substring(0, 40), unicodeFontLoaded),
            cleanTextForPDF(translateCategory(goal.category), unicodeFontLoaded),
            cleanTextForPDF(translateStatus(goal.status), unicodeFontLoaded),
            goal.target_date || '-',
            `${goal.progress || 0}%`
          ]),
          [91, 155, 213]
        );
      }

      if (selectedEmployee === 'all' && employees.length > 0) {
        addPdfTable(
          t('reports.excel.sheets.allEmployeesOverview', 'ALL EMPLOYEES OVERVIEW').toUpperCase(),
          [
            pdfHead('reports.excel.performance.name', 'Name'),
            pdfHead('reports.excel.performance.department', 'Department'),
            pdfHead('reports.excel.metrics.totalHours', 'Hours'),
            pdfHead('reports.excel.metrics.totalTasks', 'Tasks'),
            pdfHead('reports.excel.metrics.completedTasks', 'Completed'),
            pdfHead('reports.excel.metrics.totalGoals', 'Goals'),
            pdfHead('reports.excel.performance.overallScore', 'Score')
          ],
          employees.map((employee) => {
            const performance = computeEmployeePerformance(employee, timeEntries, tasks, goals);
            return [
              cleanTextForPDF(getDemoEmployeeName(employee, t), unicodeFontLoaded),
              cleanTextForPDF(translateDepartment(employee.department), unicodeFontLoaded),
              performance.totalHours.toFixed(1),
              String(performance.tasksCount),
              String(performance.completedTasks),
              String(performance.goalsCount),
              `${performance.overallScore}%`
            ];
          }),
          [112, 48, 160],
          6
        );
      }

      // Footer on all pages
      const pageCount = doc.internal.getNumberOfPages();
      const languageName = SUPPORTED_LANGUAGES[currentLanguage]?.name || 'English';
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(150, 150, 150);
        drawText(`${t('reports.page', 'Page')} ${i} ${t('reports.of', 'of')} ${pageCount} | ${t('reports.generatedBy', 'Generated by HR Management System')}`, pageWidth / 2, pageHeight - 10, { align: 'center' });
        // Add language indicator on the right
        drawText(`${t('reports.language', 'Language')}: ${languageName}`, pageWidth - 15, pageHeight - 10, { align: 'right' });
      }

      // Save the PDF
      const filename = `${t('reports.filenamePrefix', 'HR_Report')}_${employeeName}_${filters.startDate}_to_${filters.endDate}_${currentLanguage.toUpperCase()}.pdf`;
      doc.save(filename);
      
      alert(t('reports.pdfExportSuccess', 'PDF report exported successfully!'));
    } catch (error) {
      console.error('Error exporting PDF:', error);
      alert(t('reports.errorExporting', 'Error exporting PDF file') + ': ' + error.message);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className={`${bg.secondary} rounded-lg border ${border.primary} p-6`}>
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h1 className={`text-2xl font-bold ${text.primary} mb-2`}>
              {t('nav.reports', 'Reports & Analytics')}
            </h1>
            <p className={`${text.secondary}`}>
              {t('reports.subtitle', 'Export comprehensive data for time entries, tasks, and personal goals')}
            </p>
          </div>
          
          <div className="flex items-center gap-2">
            <Database className={`w-5 h-5 text-green-600`} />
            <span className={`text-sm ${text.secondary}`}>
              {t('reports.liveData', 'Live data from Supabase')}
            </span>
          </div>
        </div>
      </div>

      {/* Error Banner */}
      {fetchError && (
        <div className={`${isDarkMode ? 'bg-red-900/20 border-red-800' : 'bg-red-50 border-red-300'} rounded-lg border p-4 flex items-start space-x-3 slide-in-top`}>
          <AlertCircle className={`w-5 h-5 ${isDarkMode ? 'text-red-400' : 'text-red-600'} shrink-0 mt-0.5`} />
          <div className="flex-1">
            <h3 className={`text-sm font-semibold ${isDarkMode ? 'text-red-400' : 'text-red-800'}`}>
              {t('common.error', 'Error')}
            </h3>
            <p className={`text-sm ${isDarkMode ? 'text-red-300' : 'text-red-700'} mt-1`}>
              {fetchError}
            </p>
            <button
              onClick={() => {
                setFetchError(null);
                fetchReportData();
              }}
              className={`mt-2 text-xs font-medium ${isDarkMode ? 'text-red-400 hover:text-red-300' : 'text-red-600 hover:text-red-700'} underline`}
            >
              {t('common.retry', 'Try Again')}
            </button>
          </div>
          <button
            onClick={() => setFetchError(null)}
            className={`${isDarkMode ? 'text-red-400 hover:text-red-300' : 'text-red-600 hover:text-red-700'} transition-colors text-xl font-bold leading-none`}
            aria-label="Close"
          >
            ×
          </button>
        </div>
      )}

      {/* Export Button - shows current tab data count */}
      <div className={`${bg.secondary} rounded-lg border ${border.primary} p-4`}>
        <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
          <div className="flex-1">
            <h2 className={`text-lg font-semibold ${text.primary} mb-1 flex items-center gap-2`}>
              {activeTab === 'time-entries' && t('reports.timeEntries', 'Time Entries')}
              {activeTab === 'tasks' && t('reports.tasks', 'Tasks')}
              {activeTab === 'goals' && t('reports.goals', 'Personal Goals')}
              {selectedEmployee !== 'all' && (
                <span className="px-3 py-1 text-xs bg-linear-to-r from-blue-600 to-gray-600 text-white rounded-full font-medium">
                  {t('reports.individualReport', 'Individual Report')}
                </span>
              )}
            </h2>
            <p className={`text-sm ${text.secondary}`}>
              {stats.totalRecords} {t('reports.recordsFound', 'records found')} 
              {selectedEmployee !== 'all' && ` ${t('reports.for', 'for')} ${reportData.employees.find(emp => String(emp.id) === String(selectedEmployee))?.name}`}
              {` ${t('reports.from', 'from')} ${filters.startDate} ${t('reports.to', 'to')} ${filters.endDate}`}
            </p>
            {selectedEmployee !== 'all' && (
              <p className={`text-xs ${isDarkMode ? 'text-amber-100' : 'text-blue-600'} mt-1 flex items-center gap-1 italic`}>
                <Users className="w-3 h-3" />
                {t('reports.exportingIncludes', 'Exporting will include this employee\'s detailed performance report')}
              </p>
            )}
          </div>
          
          <div className="flex flex-wrap gap-3">
            <button
              onClick={exportAllToCSV}
              disabled={exporting}
              className={`px-6 py-3 cursor-pointer bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-lg flex items-center gap-2 transition-colors font-medium`}
              title={t('reports.exportingIncludes', 'Exporting will include all filtered data, not just previewed records')}
            >
              {exporting ? (
                <Loader className="w-5 h-5 animate-spin" />
              ) : (
                <Download className="w-5 h-5" />
              )}
              {t('reports.exportToCSV', 'Export to CSV')}
            </button>
            
            <button
              onClick={exportToExcel}
              disabled={exporting}
              className={`px-6 py-3 cursor-pointer bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white rounded-lg flex items-center gap-2 transition-colors font-medium`}
              title={t('reports.excelExportHint', 'Export all data types with summary, charts, and detailed sheets')}
            >
              {exporting ? (
                <Loader className="w-5 h-5 animate-spin" />
              ) : (
                <FileText className="w-5 h-5" />
              )}
              {t('reports.exportToExcel', 'Export to Excel')}
            </button>

            <button
              onClick={exportToPDF}
              disabled={exporting}
              className={`px-6 py-3 cursor-pointer bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white rounded-lg flex items-center gap-2 transition-colors font-medium`}
              title={t('reports.pdfExportHint', 'Export PDF with visual charts, summary, and detailed tables for all data types')}
            >
              {exporting ? (
                <Loader className="w-5 h-5 animate-spin" />
              ) : (
                <FileText className="w-5 h-5" />
              )}
              {t('reports.exportToPDF', 'Export to PDF')}
            </button>
          </div>
        </div>
      </div>

      {/* Quick Filters */}
      <div className={`${bg.secondary} rounded-lg border ${border.primary} p-6`}>
        <h3 className={`text-lg font-semibold ${text.primary} mb-4`}>
          {t('reports.quickFilters', 'Quick Filters')}
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Employee Filter - Enhanced */}
          <div>
            <label className={`block text-sm font-medium ${text.primary} mb-2`}>
              <Users className="w-4 h-4 inline mr-1" />
              {t('reports.employee', 'Employee')} 
              {selectedEmployee !== 'all' && (
                <span className="ml-2 px-2 py-0.5 text-xs">
                 
                </span>
              )}
            </label>
            <select
              value={selectedEmployee}
              onChange={(e) => setSelectedEmployee(e.target.value)}
              className={`w-full px-3 py-2 rounded-lg border ${selectedEmployee !== 'all' ? 'border-blue-500 ring-2 ring-blue-500' : border.primary} ${bg.primary} ${text.primary} focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all`}
            >
              <option value="all">
                {t('reports.allEmployees', 'All Employees')} ({reportData.employees.length})
              </option>
              <optgroup label="──────────────────────">
                {reportData.employees
                  .sort((a, b) => getDemoEmployeeName(a, t).localeCompare(getDemoEmployeeName(b, t)))
                  .map(emp => (
                    <option key={emp.id} value={emp.id}>
                      {getDemoEmployeeName(emp, t)} • {translateDepartment(emp.department)} • {translatePosition(emp.position)}
                    </option>
                  ))}
              </optgroup>
            </select>
            {selectedEmployee !== 'all' && (
              <p className={`mt-1 text-xs ${isDarkMode ? 'text-amber-100' : 'text-blue-600'} flex items-center gap-1 italic`}>
                <BarChart3 className="w-3 h-3" />
                {t('reports.individualMetrics', 'Individual performance metrics shown below')}
              </p>
            )}
          </div>

          {/* Date Range Preset */}
          <div>
            <label className={`block text-sm font-medium ${text.primary} mb-2`}>
              <Calendar className="w-4 h-4 inline mr-1" />
              {t('reports.dateRange', 'Date Range')}
            </label>
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
              className={`w-full px-3 py-2 rounded-lg border ${border.primary} ${bg.primary} ${text.primary} focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
            >
              <option value="today">{t('reports.today', 'Today')}</option>
              <option value="this-week">{t('reports.thisWeek', 'This Week')}</option>
              <option value="this-month">{t('reports.thisMonth', 'This Month')}</option>
              <option value="last-month">{t('reports.lastMonth', 'Last Month')}</option>
              <option value="this-quarter">{t('reports.thisQuarter', 'This Quarter')}</option>
              <option value="this-year">{t('reports.thisYear', 'This Year')}</option>
              <option value="custom">{t('reports.customRange', 'Custom Range')}</option>
            </select>
          </div>

          {/* Tab selector */}
          <div>
            <label className={`block text-sm font-medium ${text.primary} mb-2`}>
              <Filter className="w-4 h-4 inline mr-1" />
              {t('reports.dataType', 'Data Type')}
            </label>
            <select
              value={activeTab}
              onChange={(e) => setActiveTab(e.target.value)}
              className={`w-full px-3 py-2 rounded-lg border ${border.primary} ${bg.primary} ${text.primary} focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
            >
              <option value="all">{t('reports.all', 'All Data Types')}</option>
              <option value="time-entries">{t('reports.timeEntries', 'Time Entries')}</option>
              <option value="tasks">{t('reports.tasks', 'Tasks')}</option>
              <option value="goals">{t('reports.goals', 'Personal Goals')}</option>
            </select>
          </div>
        </div>

        {/* Custom Date Range */}
        {dateRange === 'custom' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <div>
              <label className={`block text-sm font-medium ${text.primary} mb-2`}>
                {t('reports.startDate', 'Start Date')}
              </label>
              <input
                type="date"
                value={filters.startDate}
                onChange={(e) => setFilters(prev => ({ ...prev, startDate: e.target.value }))}
                className={`w-full px-3 py-2 rounded-lg border ${border.primary} ${bg.primary} ${text.primary} focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
              />
            </div>

            <div>
              <label className={`block text-sm font-medium ${text.primary} mb-2`}>
                {t('reports.endDate', 'End Date')}
              </label>
              <input
                type="date"
                value={filters.endDate}
                onChange={(e) => setFilters(prev => ({ ...prev, endDate: e.target.value }))}
                className={`w-full px-3 py-2 rounded-lg border ${border.primary} ${bg.primary} ${text.primary} focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
              />
            </div>
          </div>
        )}
      </div>

      {/* Individual Employee Statistics */}
      {selectedEmployee !== 'all' && (() => {
        const employee = reportData.employees.find(emp => String(emp.id) === String(selectedEmployee));
        if (!employee) return null;

        const employeeTimeEntries = reportData.timeEntries.filter(e => String(e.employee_id) === String(employee.id));
        const employeeTasks = reportData.tasks.filter(t => String(t.employee_id) === String(employee.id));
        const employeeGoals = reportData.goals.filter(g => String(g.employee_id) === String(employee.id));

        const totalHours = employeeTimeEntries.reduce((sum, e) => sum + (e.hours || 0), 0);
        const regularHours = employeeTimeEntries.filter(e => e.hour_type === 'regular').reduce((sum, e) => sum + (e.hours || 0), 0);
        // Include both overtime and bonus as overtime hours
        const overtimeHours = employeeTimeEntries.filter(e => e.hour_type === 'overtime' || e.hour_type === 'bonus').reduce((sum, e) => sum + (e.hours || 0), 0);
        const wfhHours = employeeTimeEntries.filter(e => e.hour_type === 'wfh').reduce((sum, e) => sum + (e.hours || 0), 0);
        // Leave days (on_leave entries count as days)
        const leaveDays = employeeTimeEntries.filter(e => e.hour_type === 'on_leave').length;
        // Days worked (count unique dates with time entries)
        const daysWorked = new Set(employeeTimeEntries.map(e => e.date)).size;
        const pendingEntries = employeeTimeEntries.filter(e => e.status === 'pending').length;
        const approvedEntries = employeeTimeEntries.filter(e => e.status === 'approved').length;

        const completedTasks = employeeTasks.filter(t => t.status === 'completed').length;
        const inProgressTasks = employeeTasks.filter(t => t.status === 'in_progress').length;
        const pendingTasks = employeeTasks.filter(t => t.status === 'pending').length;
        const taskCompletionRate = employeeTasks.length > 0 ? ((completedTasks / employeeTasks.length) * 100).toFixed(1) : 0;

        const completedGoals = employeeGoals.filter(g => g.status === 'completed').length;
        const inProgressGoals = employeeGoals.filter(g => g.status === 'in_progress').length;
        const goalCompletionRate = employeeGoals.length > 0 ? ((completedGoals / employeeGoals.length) * 100).toFixed(1) : 0;
        const avgProgress = employeeGoals.length > 0 ? (employeeGoals.reduce((sum, g) => sum + (g.status === 'completed' ? 100 : (g.progress || 0)), 0) / employeeGoals.length).toFixed(1) : 0;

        return (
          <div className={`${bg.secondary} rounded-lg border border-transparent transition-colors ${isDarkMode ? 'hover:border-amber-50' : 'hover:border-blue-400'} p-6`}>
            <div className="flex items-start justify-between mb-6">
              <div>
                <h3 className={`text-xl font-bold ${text.primary} mb-1`}>
                  {getDemoEmployeeName(employee, t)} - {t('reports.performanceSummary', "")}
                </h3>
                <p className={`${text.secondary} text-sm`}>
                  {translateDepartment(employee.department)} • {translatePosition(employee.position)}
                </p>
                <p className={`${text.secondary} text-xs mt-1`}>
                  {t('reports.reportPeriod', 'Report Period')}: {filters.startDate} {t('reports.to', 'to')} {filters.endDate}
                </p>
              </div>
            </div>

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {/* Time Tracking Stats - Show only for time-entries or all */}
              {(activeTab === 'time-entries' || activeTab === 'all') && (
                <>
                  <div className={`p-4 rounded-lg justify-center ${isDarkMode ? 'bg-gray-800' : 'bg-gray-50'}`}>
                    <Clock className={`w-6.5 h-6.5 ${text.primary} mb-2`} />
                    <p className={`text-xs ${text.secondary} mb-1`}>{t('reports.totalHours', 'Total Hours')}</p>
                    <p className={`text-2xl font-bold ${text.primary}`}>{totalHours.toFixed(1)}</p>
                  </div>

                  <div className={`p-4 rounded-lg justify-center ${isDarkMode ? 'bg-gray-800' : 'bg-gray-50'}`}>
                    <Hourglass className={`w-6.5 h-6.5 ${text.primary} mb-2`} />
                    <p className={`text-xs ${text.secondary} mb-1`}>{t('reports.regularHours', 'Regular Hours')}</p>
                    <p className={`text-2xl font-bold ${text.primary}`}>{regularHours.toFixed(1)}</p>
                  </div>

                  <div className={`p-4 rounded-lg justify-center ${isDarkMode ? 'bg-gray-800' : 'bg-gray-50'}`}>
                    <HeartPlus className={`w-6.5 h-6.5 ${text.primary} mb-2`} />
                    <p className={`text-xs ${text.secondary} mb-1`}>{t('reports.overtime', 'Overtime')}</p>
                    <p className={`text-2xl font-bold ${text.primary}`}>{overtimeHours.toFixed(1)}</p>
                  </div>
                  
                  <div className={`p-4 rounded-lg justify-center ${isDarkMode ? 'bg-gray-800' : 'bg-gray-50'}`}>
                    <Laptop className={`w-6.5 h-6.5 ${text.primary} mb-2`} />
                    <p className={`text-xs ${text.secondary} mb-1`}>{t('reports.wfh', 'Working From Home')}</p>
                    <p className={`text-2xl font-bold ${text.primary}`}>{wfhHours.toFixed(1)}</p>
                  </div>
                  
                  <div className={`p-4 rounded-lg justify-center ${isDarkMode ? 'bg-gray-800' : 'bg-gray-50'}`}>
                    <Apple className={`w-6.5 h-6.5 ${text.primary} mb-2`} />
                    <p className={`text-xs ${text.secondary} mb-1`}>{t('reports.leaveDays', 'Leave Days')}</p>
                    <p className={`text-2xl font-bold ${text.primary}`}>{leaveDays}</p>
                  </div>
                  
                  <div className={`p-4 rounded-lg justify-center ${isDarkMode ? 'bg-gray-800' : 'bg-gray-50'}`}>
                    <Calendar className={`w-6.5 h-6.5 ${text.primary} mb-2`} />
                    <p className={`text-xs ${text.secondary} mb-1`}>{t('reports.daysWorked', 'Days Worked')}</p>
                    <p className={`text-2xl font-bold ${text.primary}`}>{daysWorked}</p>
                  </div>
                </>
              )}

              {/* Task Stats - Show only for tasks or all */}
              {(activeTab === 'tasks' || activeTab === 'all') && (
                <div className={`p-4 rounded-lg justify-center ${isDarkMode ? 'bg-gray-800' : 'bg-gray-50'}`}>
                  <ShieldCheck className={`w-6.5 h-6.5 ${text.primary} mb-2`} />
                  <p className={`text-xs ${text.secondary} mb-1`}>{t('reports.tasksDone', 'Tasks Done')}</p>
                  <p className={`text-2xl font-bold ${text.primary}`}>{completedTasks}/{employeeTasks.length}</p>
                </div>
              )}

              {/* Goal Stats - Show only for goals or all */}
              {(activeTab === 'goals' || activeTab === 'all') && (
                <>
                  <div className={`p-4 rounded-lg justify-center ${isDarkMode ? 'bg-gray-800' : 'bg-gray-50'}`}>
                    <Goal className={`w-6.5 h-6.5 ${text.primary} mb-2`} />
                    <p className={`text-xs ${text.secondary} mb-1`}>{t('reports.completion', 'Completion')}</p>
                    <p className={`text-2xl font-bold ${text.primary}`}>
                      {activeTab === 'goals' ? goalCompletionRate : taskCompletionRate}%
                    </p>
                  </div>

                  <div className={`p-4 rounded-lg ${isDarkMode ? 'bg-gray-800' : 'bg-gray-50'}`}>
                    <Pickaxe className={`w-6.5 h-6.5 ${text.primary} mb-2`} />
                    <p className={`text-xs ${text.secondary} mb-1`}>{t('reports.goalProgress', 'Goal Progress')}</p>
                    <p className={`text-2xl font-bold ${text.primary}`}>{avgProgress}%</p>
                  </div>
                </>
              )}
            </div>

            {/* Detailed Breakdown */}
            <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Time Entries Breakdown - Show only for time-entries or all */}
              {(activeTab === 'time-entries' || activeTab === 'all') && (
                <div className={`p-4 rounded-lg border ${border.primary}`}>
                  <h4 className={`font-semibold ${text.primary} mb-3 flex items-center gap-2`}>
                    <Clock className="w-4 h-4" />
                    {t('reports.timeEntries', 'Time Entries')} ({employeeTimeEntries.length})
                  </h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className={text.secondary}>{t('reports.approved', 'Approved')}:</span>
                      <span className={`font-medium ${text.primary}`}>{approvedEntries}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className={text.secondary}>{t('reports.pending', 'Pending')}:</span>
                      <span className={`font-medium ${text.primary}`}>{pendingEntries}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className={text.secondary}>{t('reports.regularHours', 'Regular Hours')}:</span>
                      <span className={`font-medium ${text.primary}`}>{regularHours.toFixed(1)}h</span>
                    </div>
                    <div className="flex justify-between">
                      <span className={text.secondary}>{t('reports.overtime', 'Overtime')}:</span>
                      <span className={`font-medium ${text.primary}`}>{overtimeHours.toFixed(1)}h</span>
                    </div>
                    <div className="flex justify-between">
                      <span className={text.secondary}>{t('reports.wfh', 'WFH')}:</span>
                      <span className={`font-medium ${text.primary}`}>{wfhHours.toFixed(1)}h</span>
                    </div>
                    <div className="flex justify-between">
                      <span className={text.secondary}>{t('reports.leaveDays', 'Leave Days')}:</span>
                      <span className={`font-medium ${text.primary}`}>{leaveDays}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Tasks Breakdown - Show only for tasks or all */}
              {(activeTab === 'tasks' || activeTab === 'all') && (
                <div className={`p-4 rounded-lg border ${border.primary}`}>
                  <h4 className={`font-semibold ${text.primary} mb-3 flex items-center gap-2`}>
                    <CheckCircle className="w-4 h-4" />
                    {t('reports.tasks', 'Tasks')} ({employeeTasks.length})
                  </h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className={text.secondary}>{t('reports.completed', 'Completed')}:</span>
                      <span className={`font-medium ${text.primary}`}>{completedTasks}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className={text.secondary}>{t('reports.inProgress', 'In Progress')}:</span>
                      <span className={`font-medium ${text.primary}`}>{inProgressTasks}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className={text.secondary}>{t('reports.pending', 'Pending')}:</span>
                      <span className={`font-medium ${text.primary}`}>{pendingTasks}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className={text.secondary}>{t('reports.completionRate', 'Completion Rate')}:</span>
                      <span className={`font-medium ${text.primary}`}>{taskCompletionRate}%</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Goals Breakdown - Show only for goals or all */}
              {(activeTab === 'goals' || activeTab === 'all') && (
                <div className={`p-4 rounded-lg border ${border.primary}`}>
                  <h4 className={`font-semibold ${text.primary} mb-3 flex items-center gap-2`}>
                    <Goal className="w-4 h-4" />
                    {t('reports.goals', 'Goals')} ({employeeGoals.length})
                  </h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className={text.secondary}>{t('reports.completed', 'Completed')}:</span>
                      <span className={`font-medium ${text.primary}`}>{completedGoals}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className={text.secondary}>{t('reports.inProgress', 'In Progress')}:</span>
                      <span className={`font-medium ${text.primary}`}>{inProgressGoals}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className={text.secondary}>{t('reports.avgProgress', 'Avg Progress')}:</span>
                      <span className={`font-medium ${text.primary}`}>{avgProgress}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className={text.secondary}>{t('reports.totalGoals', 'Total Goals')}:</span>
                      <span className={`font-medium ${text.primary}`}>{employeeGoals.length}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className={`${bg.secondary} border ${border.primary} rounded-lg p-6`}>
          <div className="flex items-center justify-between">
            <div>
              <p className={`text-sm ${text.secondary}`}>{t('reports.totalRecords', 'Total Records')}:    </p>
              <p className={`text-3xl font-bold ${text.primary}`}>{stats.totalRecords}</p>
            </div>
            <BarChart3 className={`w-8 h-8 ${text.secondary}`} />
          </div>
        </div>

        {activeTab === 'all' && (
          <>
            <div className={`${bg.secondary} border ${border.primary} rounded-lg p-6`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className={`text-sm ${text.secondary}`}>{t('reports.totalEntries', 'Total Entries')}</p>
                  <p className={`text-3xl font-bold ${text.primary}`}>{stats.timeEntriesCount}</p>
                </div>
                <Clock className={`w-8 h-8 ${text.secondary}`} />
              </div>
            </div>
            <div className={`${bg.secondary} border ${border.primary} rounded-lg p-6`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className={`text-sm ${text.secondary}`}>{t('reports.tasks', 'Tasks')}</p>
                  <p className={`text-3xl font-bold ${text.primary}`}>{stats.tasksCount}</p>
                </div>
                <LayoutList className={`w-8 h-8 ${text.secondary}`} />
              </div>
            </div>
            <div className={`${bg.secondary} border ${border.primary} rounded-lg p-6`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className={`text-sm ${text.secondary}`}>{t('reports.goals', 'Goals')}</p>
                  <p className={`text-3xl font-bold ${text.primary}`}>{stats.goalsCount}</p>
                </div>
                <Goal className={`w-8 h-8 ${text.secondary}`} />
              </div>
            </div>
          </>
        )}

        {activeTab === 'time-entries' && (
          <>
            <div className={`${bg.secondary} border ${border.primary} rounded-lg p-6`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className={`text-sm ${text.secondary}`}>{t('reports.totalHours', 'Total Hours')}</p>
                  <p className={`text-3xl font-bold ${text.primary}`}>{stats.totalHours}h</p>
                </div>
                <Clock className={`w-8 h-8 ${text.secondary}`} />
              </div>
            </div>
            <div className={`${bg.secondary} border ${border.primary} rounded-lg p-6`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className={`text-sm ${text.secondary}`}>{t('reports.approved', 'Approved')}</p>
                  <p className={`text-3xl font-bold ${text.secondary}`}>{stats.approved}</p>
                </div>
                <CheckCircle className={`w-8 h-8 ${text.primary}`} />
              </div>
            </div>
            <div className={`${bg.secondary} border ${border.primary} rounded-lg p-6`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className={`text-sm ${text.secondary}`}>{t('reports.pending', 'Pending')}</p>
                  <p className={`text-3xl font-bold ${text.secondary}`}>{stats.pending}</p>
                </div>
                <PenOff className={`w-8 h-8 ${text.primary}`} />
              </div>
            </div>
          </>
        )}

        {activeTab === 'tasks' && (
          <>
            <div className={`${bg.secondary} border ${border.primary} rounded-lg p-6`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className={`text-sm ${text.secondary}`}>{t('reports.completed', 'Completed')}</p>
                  <p className={`text-3xl font-bold ${text.primary}`}>{stats.completed}</p>
                </div>
                <ListCheck className={`w-8 h-8 ${text.secondary}`} />
              </div>
            </div>
            <div className={`${bg.secondary} border ${border.primary} rounded-lg p-6`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className={`text-sm ${text.secondary}`}>{t('reports.inProgress', 'In Progress')}</p>
                  <p className={`text-3xl font-bold ${text.primary}`}>{stats.inProgress}</p>
                </div>
                <PlayCircle className={`w-8 h-8 ${text.secondary}`} />
              </div>
            </div>
            <div className={`${bg.secondary} border ${border.primary} rounded-lg p-6`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className={`text-sm ${text.secondary}`}>{t('reports.completionRate', 'Completion Rate')}</p>
                  <p className={`text-3xl font-bold ${text.primary}`}>{stats.completionRate}%</p>
                </div>
                <Gauge className={`w-8 h-8 ${text.secondary}`} />
              </div>
            </div>
          </>
        )}

        {activeTab === 'goals' && (
          <>
            <div className={`${bg.secondary} border ${border.primary} rounded-lg p-6`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className={`text-sm ${text.secondary}`}>{t('reports.achieved', 'Achieved')}</p>
                  <p className={`text-3xl font-bold ${text.primary}`}>{stats.achieved}</p>
                </div>
                <SmilePlus className={`w-8 h-8 ${text.secondary}`} />
              </div>
            </div>
            <div className={`${bg.secondary} border ${border.primary} rounded-lg p-6`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className={`text-sm ${text.secondary}`}>{t('reports.inProgress', 'In Progress')}</p>
                  <p className={`text-3xl font-bold ${text.primary}`}>{stats.inProgress}</p>
                </div>
                <Combine className={`w-8 h-8 ${text.secondary}`} />
              </div>
            </div>
            <div className={`${bg.secondary} border ${border.primary} rounded-lg p-6`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className={`text-sm ${text.secondary}`}>{t('reports.avgProgress', 'Avg Progress')}</p>
                  <p className={`text-3xl font-bold ${text.primary}`}>{stats.averageProgress}%</p>
                </div>
                <Activity className={`w-8 h-8 ${text.secondary}`} />
              </div>
            </div>
          </>
        )}
      </div>

      {/* Preview Table */}
      <div className={`${bg.secondary} rounded-lg border ${border.primary}`}>
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <h3 className={`text-lg font-semibold ${text.primary}`}>
            {t('reports.dataPreview', 'Data Preview')} 
          </h3>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className={`${bg.primary}`}>
              <tr>
                {activeTab === 'all' && (
                  <>
                    <th className={`px-6 py-3 text-left text-xs font-medium ${text.secondary} uppercase tracking-wider`}>{t('reports.type', 'Type')}</th>
                    <th className={`px-6 py-3 text-left text-xs font-medium ${text.secondary} uppercase tracking-wider`}>{t('reports.employees', 'Employee')}</th>
                    <th className={`px-6 py-3 text-left text-xs font-medium ${text.secondary} uppercase tracking-wider`}>{t('reports.details', 'Details')}</th>
                    <th className={`px-6 py-3 text-left text-xs font-medium ${text.secondary} uppercase tracking-wider`}>{t('reports.status', 'Status')}</th>
                    <th className={`px-6 py-3 text-left text-xs font-medium ${text.secondary} uppercase tracking-wider`}>{t('reports.date', 'Date')}</th>
                  </>
                )}
                
                {activeTab === 'time-entries' && (
                  <>
                    <th 
                      className={`px-6 py-3 text-left text-xs font-medium ${text.secondary} uppercase tracking-wider cursor-pointer select-none hover:text-blue-500`}
                      onClick={() => handleSort('employee')}
                    >
                      <span className="inline-flex items-center gap-1">
                        {t('reports.employees', 'Employee')}
                        <ArrowDownAZ
                          className={`inline w-4 h-4 ml-1 transition-all duration-500 ${sortKey === 'employee' ? (isDarkMode ? 'text-white' : 'text-black') : 'text-gray-400 hover:text-blue-400 hover:animate-pulse'}`}
                          style={{ transition: 'transform 0.5s', transform: sortKey === 'employee' && sortDirection === 'asc' ? 'rotate(180deg)' : 'none' }}
                        />
                      </span>
                    </th>
                    <th 
                      className={`px-6 py-3 text-left text-xs font-medium ${text.secondary} uppercase tracking-wider cursor-pointer select-none hover:text-blue-500`}
                      onClick={() => handleSort('date')}
                    >
                      <span className="inline-flex items-center gap-1">
                        {t('reports.date', 'Date')}
                        {sortKey === 'date' ? (
                          sortDirection === 'asc' ? (
                            <CalendarArrowUp className={`inline w-4 h-4 ml-1 transition-all duration-500 ${isDarkMode ? 'text-white' : 'text-black'}`} />
                          ) : (
                            <CalendarArrowDown className={`inline w-4 h-4 ml-1 transition-all duration-500 ${isDarkMode ? 'text-white' : 'text-black'}`} />
                          )
                        ) : (
                          <CalendarArrowUp className="inline w-4 h-4 ml-1 transition-all duration-500 text-gray-400 hover:text-blue-400 hover:animate-pulse" />
                        )}
                      </span>
                    </th>
                    <th 
                      className={`px-6 py-3 text-left text-xs font-medium ${text.secondary} uppercase tracking-wider cursor-pointer select-none hover:text-blue-500`}
                      onClick={() => handleSort('hours')}
                    >
                      <span className="inline-flex items-center gap-1">
                        {t('reports.hours', 'Hours')}
                        <Hourglass
                          className={`inline w-3.5 h-3.5 ml-1 transition-all duration-500 ${sortKey === 'hours' ? (isDarkMode ? 'text-white' : 'text-black') : 'text-gray-400 hover:text-blue-400 hover:animate-pulse'}`}
                          style={{ transition: 'transform 0.5s', transform: sortKey === 'hours' && sortDirection === 'asc' ? 'rotate(180deg)' : 'none' }}
                        />
                      </span>
                    </th>
                    <th 
                      className={`px-6 py-3 text-left text-xs font-medium ${text.secondary} uppercase tracking-wider cursor-pointer select-none hover:text-blue-500`}
                      onClick={() => handleSort('type')}
                    >
                      <span className="inline-flex items-center gap-1">
                        {t('reports.type', 'Type')}
                        <Timer
                          className={`inline w-4 h-4 ml-1 transition-all duration-500 ${sortKey === 'type' ? (isDarkMode ? 'text-white' : 'text-black') : 'text-gray-400 hover:text-blue-400 hover:animate-pulse'}`}
                          style={{ transition: 'transform 0.5s', transform: sortKey === 'type' && sortDirection === 'asc' ? 'rotate(180deg)' : 'none' }}
                        />
                      </span>
                    </th>
                    <th 
                      className={`px-6 py-3 text-left text-xs font-medium ${text.secondary} uppercase tracking-wider cursor-pointer select-none hover:text-blue-500`}
                      onClick={() => handleSort('status')}
                    >
                      <span className="inline-flex items-center justify-center gap-1">
                        {t('reports.status', 'Status')}
                        {sortKey === 'status' ? (
                          sortDirection === 'asc' ? (
                            <ShieldCheck
                              className={`inline w-4 h-4 ml-1 transition-all duration-500 ${isDarkMode ? 'text-white' : 'text-black'}`}
                            />
                          ) : (
                            <ShieldQuestion
                              className={`inline w-4 h-4 ml-1 transition-all duration-500 ${isDarkMode ? 'text-white' : 'text-black'}`}
                            />
                          )
                        ) : (
                          <ShieldCheck className="inline w-4 h-4 ml-1 transition-all duration-500 text-gray-400 hover:text-blue-400 hover:animate-pulse" />
                        )}
                      </span>
                    </th>
                  </>
                )}
                
                {activeTab === 'tasks' && (
                  <>
                    <th 
                      className={`px-6 py-3 text-left text-xs font-medium ${text.secondary} uppercase tracking-wider cursor-pointer select-none hover:text-blue-500`}
                      onClick={() => handleSort('employee')}
                    >
                      <span className="inline-flex items-center gap-1">
                        {t('reports.employees', 'Employee')}
                        <ArrowDownAZ
                          className={`inline w-4 h-4 ml-1 transition-all duration-500 ${sortKey === 'employee' ? (isDarkMode ? 'text-white' : 'text-black') : 'text-gray-400 hover:text-blue-400 hover:animate-pulse'}`}
                          style={{ transition: 'transform 0.5s', transform: sortKey === 'employee' && sortDirection === 'asc' ? 'rotate(180deg)' : 'none' }}
                        />
                      </span>
                    </th>
                    <th className={`px-6 py-3 text-left text-xs font-medium ${text.secondary} uppercase tracking-wider`}>{t('reports.task', 'Task')}</th>
                    <th 
                      className={`px-6 py-3 text-left text-xs font-medium ${text.secondary} uppercase tracking-wider cursor-pointer select-none hover:text-blue-500`}
                      onClick={() => handleSort('priority')}
                    >
                      <span className="inline-flex items-center gap-1">
                        {t('reports.priority', 'Priority')}
                        <Timer
                          className={`inline w-4 h-4 ml-1 transition-all duration-500 ${sortKey === 'priority' ? (isDarkMode ? 'text-white' : 'text-black') : 'text-gray-400 hover:text-blue-400 hover:animate-pulse'}`}
                          style={{ transition: 'transform 0.5s', transform: sortKey === 'priority' && sortDirection === 'asc' ? 'rotate(180deg)' : 'none' }}
                        />
                      </span>
                    </th>
                    <th 
                      className={`px-6 py-3 text-left text-xs font-medium ${text.secondary} uppercase tracking-wider cursor-pointer select-none hover:text-blue-500`}
                      onClick={() => handleSort('status')}
                    >
                      <span className="inline-flex items-center justify-center gap-1">
                        {t('reports.status', 'Status')}
                        {sortKey === 'status' ? (
                          sortDirection === 'asc' ? (
                            <ShieldCheck
                              className={`inline w-4 h-4 ml-1 transition-all duration-500 ${isDarkMode ? 'text-white' : 'text-black'}`}
                            />
                          ) : (
                            <ShieldQuestion
                              className={`inline w-4 h-4 ml-1 transition-all duration-500 ${isDarkMode ? 'text-white' : 'text-black'}`}
                            />
                          )
                        ) : (
                          <ShieldCheck className="inline w-4 h-4 ml-1 transition-all duration-500 text-gray-400 hover:text-blue-400 hover:animate-pulse" />
                        )}
                      </span>
                    </th>
                    <th 
                      className={`px-6 py-3 text-left text-xs font-medium ${text.secondary} uppercase tracking-wider cursor-pointer select-none hover:text-blue-500`}
                      onClick={() => handleSort('date')}
                    >
                      <span className="inline-flex items-center gap-1">
                        {t('reports.dueDate', 'Due Date')}
                        {sortKey === 'date' ? (
                          sortDirection === 'asc' ? (
                            <CalendarArrowUp className={`inline w-4 h-4 ml-1 transition-all duration-500 ${isDarkMode ? 'text-white' : 'text-black'}`} />
                          ) : (
                            <CalendarArrowDown className={`inline w-4 h-4 ml-1 transition-all duration-500 ${isDarkMode ? 'text-white' : 'text-black'}`} />
                          )
                        ) : (
                          <CalendarArrowUp className="inline w-4 h-4 ml-1 transition-all duration-500 text-gray-400 hover:text-blue-400 hover:animate-pulse" />
                        )}
                      </span>
                    </th>
                  </>
                )}
                
                {activeTab === 'goals' && (
                  <>
                    <th 
                      className={`px-6 py-3 text-left text-xs font-medium ${text.secondary} uppercase tracking-wider cursor-pointer select-none hover:text-blue-500`}
                      onClick={() => handleSort('employee')}
                    >
                      <span className="inline-flex items-center gap-1">
                        {t('reports.employees', 'Employee')}
                        <ArrowDownAZ
                          className={`inline w-4 h-4 ml-1 transition-all duration-500 ${sortKey === 'employee' ? (isDarkMode ? 'text-white' : 'text-black') : 'text-gray-400 hover:text-blue-400 hover:animate-pulse'}`}
                          style={{ transition: 'transform 0.5s', transform: sortKey === 'employee' && sortDirection === 'asc' ? 'rotate(180deg)' : 'none' }}
                        />
                      </span>
                    </th>
                    <th className={`px-6 py-3 text-left text-xs font-medium ${text.secondary} uppercase tracking-wider`}>{t('reports.goal', 'Goal')}</th>
                    <th className={`px-6 py-3 text-left text-xs font-medium ${text.secondary} uppercase tracking-wider`}>{t('reports.category', 'Category')}</th>
                    <th 
                      className={`px-6 py-3 text-left text-xs font-medium ${text.secondary} uppercase tracking-wider cursor-pointer select-none hover:text-blue-500`}
                      onClick={() => handleSort('status')}
                    >
                      <span className="inline-flex items-center justify-center gap-1">
                        {t('reports.status', 'Status')}
                        {sortKey === 'status' ? (
                          sortDirection === 'asc' ? (
                            <ShieldCheck
                              className={`inline w-4 h-4 ml-1 transition-all duration-500 ${isDarkMode ? 'text-white' : 'text-black'}`}
                            />
                          ) : (
                            <ShieldQuestion
                              className={`inline w-4 h-4 ml-1 transition-all duration-500 ${isDarkMode ? 'text-white' : 'text-black'}`}
                            />
                          )
                        ) : (
                          <ShieldCheck className="inline w-4 h-4 ml-1 transition-all duration-500 text-gray-400 hover:text-blue-400 hover:animate-pulse" />
                        )}
                      </span>
                    </th>
                    <th 
                      className={`px-6 py-3 text-left text-xs font-medium ${text.secondary} uppercase tracking-wider cursor-pointer select-none hover:text-blue-500`}
                      onClick={() => handleSort('progress')}
                    >
                      <span className="inline-flex items-center gap-1">
                        {t('reports.progress', 'Progress')}
                        <Gauge
                          className={`inline w-4 h-4 ml-1 transition-all duration-500 ${sortKey === 'progress' ? (isDarkMode ? 'text-white' : 'text-black') : 'text-gray-400 hover:text-blue-400 hover:animate-pulse'}`}
                          style={{ transition: 'transform 0.5s', transform: sortKey === 'progress' && sortDirection === 'asc' ? 'rotate(180deg)' : 'none' }}
                        />
                      </span>
                    </th>
                  </>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {(activeTab === 'all' ? (getSortedData.timeEntries?.length + getSortedData.tasks?.length + getSortedData.goals?.length === 0) : getSortedData.length === 0) ? (
                <tr>
                  <td colSpan={5} className={`px-6 py-12 text-center ${text.secondary}`}>
                    <div className="flex flex-col items-center">
                      <FileText className="w-12 h-12 mb-4 opacity-50" />
                      <p className="text-lg font-medium mb-2">{t('reports.noData', 'No data found')}</p>
                      <p className="text-sm">{t('reports.adjustFilters', 'Try adjusting your filters or date range')}</p>
                    </div>
                  </td>
                </tr>
              ) : activeTab === 'all' ? (
                <>
                  {/* Time Entries */}
                  {(getSortedData.timeEntries || []).map((item, index) => (
                    <tr key={`time-${index}`} className={`${bg.secondary} hover:${bg.primary} transition-colors`}>
                      <td className={`px-6 py-4 whitespace-nowrap`}>
                        <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                          {translateDataType('timeEntry')}
                        </span>
                      </td>
                      <td className={`px-6 py-4 whitespace-nowrap ${text.primary}`}>
                        <div>
                          <div className="text-sm font-medium">{isDemoMode() ? getDemoEmployeeName(item.employee, t) : (item.employee?.name || 'Unknown')}</div>
                          <div className={`text-sm ${text.secondary}`}>{translateDepartment(item.employee?.department)}</div>
                        </div>
                      </td>
                      <td className={`px-6 py-4 ${text.primary}`}>
                        <div className="text-sm">{item.hours || 0}h - {translateHourType(item.hour_type)}</div>
                      </td>
                      <td className={`px-6 py-4 whitespace-nowrap`}>
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          item.status === 'approved' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
                          item.status === 'pending' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' :
                          'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                        }`}>
                          {translateStatus(item.status)}
                        </span>
                      </td>
                      <td className={`px-6 py-4 whitespace-nowrap text-sm ${text.primary}`}>{item.date}</td>
                    </tr>
                  ))}
                  
                  {/* Tasks */}
                  {(getSortedData.tasks || []).map((item, index) => (
                    <tr key={`task-${index}`} className={`${bg.secondary} hover:${bg.primary} transition-colors`}>
                      <td className={`px-6 py-4 whitespace-nowrap`}>
                        <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200">
                          {translateDataType('task')}
                        </span>
                      </td>
                      <td className={`px-6 py-4 whitespace-nowrap ${text.primary}`}>
                        <div>
                          <div className="text-sm font-medium">{isDemoMode() ? getDemoEmployeeName(item.employee, t) : (item.employee?.name || 'Unknown')}</div>
                          <div className={`text-sm ${text.secondary}`}>{translateDepartment(item.employee?.department)}</div>
                        </div>
                      </td>
                      <td className={`px-6 py-4 ${text.primary}`}>
                        <div className="text-sm font-medium max-w-xs truncate">{isDemoMode() ? getDemoTaskTitle(item, t) : item.title}</div>
                        <div className={`text-sm ${text.secondary} max-w-xs truncate`}>{isDemoMode() ? getDemoTaskDescription(item, t) : item.description}</div>
                      </td>
                      <td className={`px-6 py-4 whitespace-nowrap`}>
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          item.status === 'completed' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
                          item.status === 'in-progress' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' :
                          'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
                        }`}>
                          {translateStatus(item.status)}
                        </span>
                      </td>
                      <td className={`px-6 py-4 whitespace-nowrap text-sm ${text.primary}`}>{item.due_date || '-'}</td>
                    </tr>
                  ))}
                  
                  {/* Goals */}
                  {(getSortedData.goals || []).map((item, index) => (
                    <tr key={`goal-${index}`} className={`${bg.secondary} hover:${bg.primary} transition-colors`}>
                      <td className={`px-6 py-4 whitespace-nowrap`}>
                        <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                          {translateDataType('goal')}
                        </span>
                      </td>
                      <td className={`px-6 py-4 whitespace-nowrap ${text.primary}`}>
                        <div>
                          <div className="text-sm font-medium">{isDemoMode() ? getDemoEmployeeName(item.employee, t) : (item.employee?.name || 'Unknown')}</div>
                          <div className={`text-sm ${text.secondary}`}>{translateDepartment(item.employee?.department)}</div>
                        </div>
                      </td>
                      <td className={`px-6 py-4 ${text.primary}`}>
                        <div className="text-sm font-medium max-w-xs truncate">{isDemoMode() ? getDemoGoalTitle(item, t) : item.title}</div>
                        <div className={`text-sm ${text.secondary} max-w-xs truncate`}>{translateCategory(item.category)} - {item.status === 'completed' ? 100 : (item.progress || 0)}%</div>
                      </td>
                      <td className={`px-6 py-4 whitespace-nowrap`}>
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          item.status === 'completed' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
                          item.status === 'in_progress' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' :
                          'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
                        }`}>
                          {translateStatus(item.status)}
                        </span>
                      </td>
                      <td className={`px-6 py-4 whitespace-nowrap text-sm ${text.primary}`}>{item.target_date || '-'}</td>
                    </tr>
                  ))}
                </>
              ) : (
                getSortedData.map((item, index) => (
                  <tr key={index} className={`${bg.secondary} hover:${bg.primary} transition-colors`}>
                    {activeTab === 'time-entries' && (
                      <>
                        <td className={`px-6 py-4 whitespace-nowrap ${text.primary}`}>
                          <div>
                            <div className="text-sm font-medium">{isDemoMode() ? getDemoEmployeeName(item.employee, t) : (item.employee?.name || 'Unknown')}</div>
                            <div className={`text-sm ${text.secondary}`}>{translateDepartment(item.employee?.department)}</div>
                          </div>
                        </td>
                        <td className={`px-6 py-4 whitespace-nowrap text-sm ${text.primary}`}>{item.date}</td>
                        <td className={`px-6 py-4 whitespace-nowrap text-sm ${text.primary}`}>
                          <span className="font-medium">{item.hours || 0}h</span>
                        </td>
                        <td className={`px-6 py-4 whitespace-nowrap`}>
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            item.hour_type === 'regular' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' :
                            item.hour_type === 'overtime' ? 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200' :
                            'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
                          }`}>
                            {translateHourType(item.hour_type)}
                          </span>
                        </td>
                        <td className={`px-6 py-4 whitespace-nowrap`}>
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            item.status === 'approved' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
                            item.status === 'pending' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' :
                            'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                          }`}>
                            {translateStatus(item.status)}
                          </span>
                        </td>
                      </>
                    )}
                    
                    {activeTab === 'tasks' && (
                      <>
                        <td className={`px-6 py-4 whitespace-nowrap ${text.primary}`}>
                          <div>
                            <div className="text-sm font-medium">{isDemoMode() ? getDemoEmployeeName(item.employee, t) : (item.employee?.name || 'Unknown')}</div>
                            <div className={`text-sm ${text.secondary}`}>{translateDepartment(item.employee?.department)}</div>
                          </div>
                        </td>
                        <td className={`px-6 py-4 ${text.primary}`}>
                          <div className="text-sm font-medium max-w-xs truncate">{isDemoMode() ? getDemoTaskTitle(item, t) : item.title}</div>
                          <div className={`text-sm ${text.secondary} max-w-xs truncate`}>{isDemoMode() ? getDemoTaskDescription(item, t) : item.description}</div>
                        </td>
                        <td className={`px-6 py-4 whitespace-nowrap`}>
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            item.priority === 'high' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' :
                            item.priority === 'medium' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' :
                            'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                          }`}>
                            {translatePriority(item.priority)}
                          </span>
                        </td>
                        <td className={`px-6 py-4 whitespace-nowrap`}>
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            item.status === 'completed' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
                            item.status === 'in-progress' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' :
                            'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
                          }`}>
                            {translateStatus(item.status)}
                          </span>
                        </td>
                        <td className={`px-6 py-4 whitespace-nowrap text-sm ${text.primary}`}>{item.due_date || '-'}</td>
                      </>
                    )}
                    
                    {activeTab === 'goals' && (
                      <>
                        <td className={`px-6 py-4 whitespace-nowrap ${text.primary}`}>
                          <div>
                            <div className="text-sm font-medium">{isDemoMode() ? getDemoEmployeeName(item.employee, t) : (item.employee?.name || 'Unknown')}</div>
                            <div className={`text-sm ${text.secondary}`}>{translateDepartment(item.employee?.department)}</div>
                          </div>
                        </td>
                        <td className={`px-6 py-4 ${text.primary}`}>
                          <div className="text-sm font-medium max-w-xs truncate">{isDemoMode() ? getDemoGoalTitle(item, t) : item.title}</div>
                          <div className={`text-sm ${text.secondary} max-w-xs truncate`}>{isDemoMode() ? getDemoGoalDescription(item, t) : item.description}</div>
                        </td>
                        <td className={`px-6 py-4 whitespace-nowrap text-sm ${text.primary}`}>{translateCategory(item.category)}</td>
                        <td className={`px-6 py-4 whitespace-nowrap`}>
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            item.status === 'completed' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
                            item.status === 'in_progress' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' :
                            'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
                          }`}>
                            {translateStatus(item.status)}
                          </span>
                        </td>
                        <td className={`px-6 py-4 whitespace-nowrap ${text.primary}`}>
                          <div className="flex items-center">
                            <div className={`w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mr-3`}>
                              <div 
                                className="bg-blue-600 h-2 rounded-full" 
                                style={{width: `${Math.min(item.status === 'completed' ? 100 : (item.progress || 0), 100)}%`}}
                              ></div>
                            </div>
                            <span className="text-sm font-medium">{item.status === 'completed' ? 100 : (item.progress || 0)}%</span>
                          </div>
                        </td>
                      </>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {currentData.length > 50 && (
          <div className={`px-6 py-4 border-t border-gray-200 dark:border-gray-700 ${bg.primary}`}>
            <p className={`text-sm ${text.secondary} text-center`}>
              {t('reports.showingFirst50of', 'Showing first 50 of')} {currentData.length} {t('reports.records', 'records')}. 
              <span className="font-medium ml-1">{t('reports.exportForAll', 'Export to CSV to get all records.')}</span>
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Reports;