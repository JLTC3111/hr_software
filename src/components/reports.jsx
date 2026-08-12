import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useLanguage, SUPPORTED_LANGUAGES } from "../contexts/LanguageContext";
import { useTheme } from "../contexts/ThemeContext";
import { useSessionGuard, useAuthenticatedPageRefresh } from '../hooks/useSessionGuard.js';
import { isDemoMode, getDemoEmployeeName, getDemoTaskTitle, getDemoTaskDescription, getDemoGoalTitle, getDemoGoalDescription, getDemoTimeEntries } from '../utils/demoHelper';
import {
  Download,
  Users,
  Goal,
  Clock,
  CheckCircle,
  FileText,
  Loader2,
  AlertCircle,
  X
} from 'lucide-react';
import timeTrackingService from '../services/timeTrackingService';
import { withTimeout } from '../utils/supabaseTimeout';
import { DEFAULT_REQUEST_TIMEOUT } from '../config/requestTimeouts';
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
  createPdfReportLayout,
  filterExportSnapshotByTab,
  formatHours,
  meterFilledBlocks,
  PDF_TOKENS,
  withBarPercents
} from '../utils/reportExportHelpers.js';
import { TranslatedText } from './ui/translated-text.jsx';
import { translateTexts } from '../services/translateService.js';
import { SpecularButton } from './ui/specular-button';
import { SlidingNumber } from './motion-primitives';
import { NumberTicker } from './ui/number-ticker';
import { DatePicker } from './ui/date-picker.jsx';
import { cn } from '@/lib/utils';
import { getIndustry, DISPLAY, BODY, figure, rampAt } from '../theme/industry.js';
import { Blueprint, Bar, Tag, Btn, Seg, Kicker, ColumnHeading, TickerCell, LiveClock, FlatSelect } from './ui/industry.jsx';
import { FetchElapsedPill } from './ui/fetch-elapsed-pill';
import {
  choosePdfFont,
  getPdfTableFont,
  loadPdfFonts,
  pdfFontSupportsBold,
  prefetchPdfFonts,
} from '../utils/pdfFontLoader.js';
import {
  filterActiveEmployees,
} from '../utils/employeeStatus.js';

// exceljs/jspdf are ~1.2 MB and are only needed once the user actually exports —
// loaded on demand so opening the Reports page stays cheap.
const loadExcelJs = () => import('exceljs').then((m) => m.default ?? m);
const loadPdfLibs = async () => {
  const [jsPdfModule, autoTableModule] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable')
  ]);
  return { jsPDF: jsPdfModule.jsPDF, autoTable: autoTableModule.default ?? autoTableModule };
};

const Reports = () => {
  const { handleSessionAuthError } = useSessionGuard();
  const { t, currentLanguage } = useLanguage();
  const { isDarkMode } = useTheme();
  const ind = useMemo(() => getIndustry(isDarkMode), [isDarkMode]);

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
    leave: [],
    employees: []
  });

  // Warm PDF font cache for CJK/Thai exports so the first PDF download is reliable.
  useEffect(() => {
    prefetchPdfFonts(currentLanguage);
  }, [currentLanguage]);

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
        handleSessionAuthError(error);
      }
    };
    fetchEmployees();
  }, []);

  // Default operational cohort excludes inactive (picker + "all" aggregates)
  const activeEmployees = useMemo(
    () => filterActiveEmployees(reportData.employees),
    [reportData.employees]
  );
  const activeEmployeeIds = useMemo(
    () => new Set(activeEmployees.map((e) => String(e.id))),
    [activeEmployees]
  );

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

      const fetchTimeEntries = async () => {
        let allTimeEntries = [];
        let error = null;

        if (isDemoMode()) {
          const demoEntries = getDemoTimeEntries();
          allTimeEntries = demoEntries
            .filter(entry => entry.date && entry.date >= startDate && entry.date <= endDate)
            .sort((a, b) => new Date(b.date) - new Date(a.date));
        } else {
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
          return [];
        }

        let filteredEntries = allTimeEntries || [];
        if (employeeId) {
          filteredEntries = filteredEntries.filter(entry =>
            String(entry.employee_id) === String(employeeId)
          );
        }
        return filteredEntries;
      };

      const fetchTasks = async () => {
        const tasksResponse = await getAllTasks(employeeId ? { employeeId } : {});
        const tasks = tasksResponse.success ? tasksResponse.data : [];
        if (employeeId) {
          return tasks.filter(task => String(task.employee_id) === String(employeeId));
        }
        return tasks;
      };

      const fetchGoals = async () => {
        const goalsResponse = await performanceService.getAllPerformanceGoals(
          employeeId ? { employeeId } : {}
        );
        const goals = goalsResponse.success ? goalsResponse.data : [];
        if (employeeId) {
          return goals.filter(goal => String(goal.employee_id) === String(employeeId));
        }
        return goals;
      };

      const fetchLeave = async () => {
        const leaveResponse = await timeTrackingService.getAllLeaveRequests({});
        let leaveData = leaveResponse.success ? leaveResponse.data : [];
        if (employeeId) {
          leaveData = leaveData.filter(req => String(req.employee_id) === String(employeeId));
        }
        leaveData = leaveData.filter(req => {
          const s = (req.start_date || '').slice(0, 10);
          const e = (req.end_date || req.start_date || '').slice(0, 10);
          return s <= endDate && e >= startDate;
        });
        return leaveData;
      };

      if (activeTab === 'all') {
        const [timeEntries, tasks, goals] = await Promise.all([
          fetchTimeEntries(),
          fetchTasks(),
          fetchGoals(),
        ]);
        setReportData(prev => ({ ...prev, timeEntries, tasks, goals }));
      } else if (activeTab === 'time-entries') {
        const timeEntries = await fetchTimeEntries();
        setReportData(prev => ({ ...prev, timeEntries }));
      } else if (activeTab === 'tasks') {
        const tasks = await fetchTasks();
        setReportData(prev => ({ ...prev, tasks }));
      } else if (activeTab === 'goals') {
        const goals = await fetchGoals();
        setReportData(prev => ({ ...prev, goals }));
      } else if (activeTab === 'leave') {
        const leaveData = await fetchLeave();
        setReportData(prev => ({
          ...prev,
          leave: leaveData.map(req => ({
            ...req,
            employee: req.employee || prev.employees.find(emp => String(emp.id) === String(req.employee_id)) || null
          }))
        }));
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

      if (handleSessionAuthError(error, { silent, setFetchError })) {
        if (!silent) setLoading(false);
        return;
      }
      
      // Set user-visible error message for other errors
      setFetchError(error.message || 'Failed to load report data. Please try refreshing the page.');
    } finally {
      if (!silent) setLoading(false);
    }
  }, [filters, selectedEmployee, activeTab, handleSessionAuthError]);

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

    const leaveResponse = await timeTrackingService.getAllLeaveRequests({});
    let leave = leaveResponse.success ? leaveResponse.data || [] : [];
    if (employeeId) {
      leave = leave.filter((req) => String(req.employee_id) === String(employeeId));
    }
    leave = leave
      .filter((req) => {
        const s = (req.start_date || '').slice(0, 10);
        const e = (req.end_date || req.start_date || '').slice(0, 10);
        return s <= endDate && e >= startDate;
      })
      .map((req) => ({
        ...req,
        employee: req.employee || reportData.employees.find((emp) => String(emp.id) === String(req.employee_id)) || null,
      }));

    const exportData = {
      timeEntries: allTimeEntries,
      tasks,
      goals,
      leave,
      employees: reportData.employees
    };

    setReportData((prev) => ({ ...prev, timeEntries: allTimeEntries, tasks, goals, leave }));
    return exportData;
  }, [filters, selectedEmployee, reportData.employees]);

  const getFilteredExportData = useCallback(async () => {
    const snapshot = await loadAllReportDataForExport();
    return filterExportSnapshotByTab(activeTab, snapshot);
  }, [loadAllReportDataForExport, activeTab]);

  // Effect to fetch data when filters/tab/employee changes (no need to wait for employees list)
  useEffect(() => {
    fetchReportData();
  }, [fetchReportData]);

  // Memoize fetchReportData for use in visibility hook
  const memoizedFetchReportData = useCallback(() => {
    fetchReportData({ silent: true });
  }, [fetchReportData]);

  // Use visibility refresh hook to reload data when page becomes visible after idle
  useAuthenticatedPageRefresh(memoizedFetchReportData);

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
    // Helper to filter data by selected employee; "all" = active cohort only
    const filterByEmployee = (data) => {
      if (selectedEmployee === 'all') {
        return (data || []).filter((item) => {
          const id = item?.employee_id ?? item?.employee?.id;
          if (id == null) return true;
          return activeEmployeeIds.has(String(id));
        });
      }
      return (data || []).filter(item => String(item.employee_id) === String(selectedEmployee));
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
      case 'leave':
        return filterByEmployee(reportData.leave);
      default:
        return [];
    }
  }, [activeTab, reportData, selectedEmployee, activeEmployeeIds]);

  // Sorting function for table data
  const getSortedData = useMemo(() => {
    const sortArray = (arr) => {
      if (!arr || arr.length === 0) return arr;
      const sorted = [...arr];
      sorted.sort((a, b) => {
        let aValue, bValue;
        switch (sortKey) {
          case 'date':
            aValue = new Date(a.date || a.due_date || a.target_date || a.start_date || a.created_at).getTime();
            bValue = new Date(b.date || b.due_date || b.target_date || b.start_date || b.created_at).getTime();
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
    } else if (activeTab === 'leave') {
      const approved = data.filter(req => req.status === 'approved').length;
      const pending = data.filter(req => req.status === 'pending').length;
      const totalLeaveDays = data
        .filter(req => req.status === 'approved')
        .reduce((sum, req) => sum + (Number(req.days_count) || 0), 0);

      return {
        totalRecords,
        approved,
        pending,
        totalLeaveDays
      };
    }

    return { totalRecords };
  }, [activeTab, currentData]);

  const overviewBentoItems = useMemo(() => {
    const recordsLabel = t('reports.totalRecords', 'Total Records');
    const base = [
      {
        label: t('reports.overview', 'Overview'),
        title: String(stats.totalRecords || 0),
        description: recordsLabel,
        value: Number(stats.totalRecords) || 0,
      },
    ];

    if (activeTab === 'all') {
      return [
        ...base,
        {
          label: t('reports.timeEntries', 'Time Entries'),
          title: String(stats.timeEntriesCount || 0),
          description: t('reports.totalEntries', 'Total Entries'),
          value: Number(stats.timeEntriesCount) || 0,
        },
        {
          label: t('reports.tasks', 'Tasks'),
          title: String(stats.tasksCount || 0),
          description: t('reports.tasks', 'Tasks'),
          value: Number(stats.tasksCount) || 0,
        },
        {
          label: t('reports.goals', 'Goals'),
          title: String(stats.goalsCount || 0),
          description: t('reports.goals', 'Goals'),
          value: Number(stats.goalsCount) || 0,
        },
      ];
    }

    if (activeTab === 'time-entries') {
      return [
        ...base,
        {
          label: t('reports.hours', 'Hours'),
          title: `${stats.totalHours || 0}h`,
          description: t('reports.totalHours', 'Total Hours'),
          value: Number(stats.totalHours) || 0,
          suffix: 'h',
        },
        {
          label: t('reports.approved', 'Approved'),
          title: String(stats.approved || 0),
          description: t('reports.approved', 'Approved'),
          value: Number(stats.approved) || 0,
        },
        {
          label: t('reports.pending', 'Pending'),
          title: String(stats.pending || 0),
          description: t('reports.pending', 'Pending'),
          value: Number(stats.pending) || 0,
        },
      ];
    }

    if (activeTab === 'tasks') {
      return [
        ...base,
        {
          label: t('reports.completed', 'Completed'),
          title: String(stats.completed || 0),
          description: t('reports.completed', 'Completed'),
          value: Number(stats.completed) || 0,
        },
        {
          label: t('reports.inProgress', 'In Progress'),
          title: String(stats.inProgress || 0),
          description: t('reports.inProgress', 'In Progress'),
          value: Number(stats.inProgress) || 0,
        },
        {
          label: t('reports.rate', 'Rate'),
          title: `${stats.completionRate || 0}%`,
          description: t('reports.completionRate', 'Completion Rate'),
          value: Number(stats.completionRate) || 0,
          suffix: '%',
        },
      ];
    }

    if (activeTab === 'goals') {
      return [
        ...base,
        {
          label: t('reports.achieved', 'Achieved'),
          title: String(stats.achieved || 0),
          description: t('reports.achieved', 'Achieved'),
          value: Number(stats.achieved) || 0,
        },
        {
          label: t('reports.inProgress', 'In Progress'),
          title: String(stats.inProgress || 0),
          description: t('reports.inProgress', 'In Progress'),
          value: Number(stats.inProgress) || 0,
        },
        {
          label: t('reports.progress', 'Progress'),
          title: `${stats.averageProgress || 0}%`,
          description: t('reports.avgProgress', 'Avg Progress'),
          value: Number(stats.averageProgress) || 0,
          suffix: '%',
        },
      ];
    }

    if (activeTab === 'leave') {
      return [
        ...base,
        {
          label: t('reports.approved', 'Approved'),
          title: String(stats.approved || 0),
          description: t('reports.approved', 'Approved'),
          value: Number(stats.approved) || 0,
        },
        {
          label: t('reports.pending', 'Pending'),
          title: String(stats.pending || 0),
          description: t('reports.pending', 'Pending'),
          value: Number(stats.pending) || 0,
        },
        {
          label: t('reports.leaveDays', 'Leave Days'),
          title: String(stats.totalLeaveDays || 0),
          description: t('reports.totalLeaveDays', 'Total Leave Days'),
          value: Number(stats.totalLeaveDays) || 0,
        },
      ];
    }

    return base;
  }, [activeTab, stats, t]);

  const buildTimeEntryCsvRows = (timeEntries, ugcMap = null) => {
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
      t('common.status', 'Status'),
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
      entry.hours ? formatHours(entry.hours) : '0.0',
      translateHourType(entry.hour_type) || '',
      translateStatus(entry.status) || '',
      translateNotes(entry.notes, ugcMap) || '',
      new Date(entry.created_at).toLocaleString()
    ]);

    return { headers, rows };
  };

  const buildTaskCsvRows = (tasks, ugcMap = null) => {
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
      isDemoMode() ? getDemoTaskTitle(task, t) : mapUgc(ugcMap, task.title || ''),
      isDemoMode() ? getDemoTaskDescription(task, t) : mapUgc(ugcMap, task.description || ''),
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

  const buildGoalCsvRows = (goals, ugcMap = null) => {
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
      isDemoMode() ? getDemoGoalTitle(goal, t) : mapUgc(ugcMap, goal.title || ''),
      isDemoMode() ? getDemoGoalDescription(goal, t) : mapUgc(ugcMap, goal.description || ''),
      translateCategory(goal.category) || '',
      translateStatus(goal.status) || '',
      goal.progress || 0,
      goal.target_date || '',
      mapUgc(ugcMap, goal.notes || ''),
      new Date(goal.created_at).toLocaleString(),
      new Date(goal.updated_at).toLocaleString()
    ]);

    return { headers, rows };
  };

  const buildLeaveCsvRows = (leaveRequests, ugcMap = null) => {
    const headers = [
      t('reports.excel.headers.dataType', 'Data Type'),
      t('employees.name', 'Employee Name'),
      t('employees.department', 'Department'),
      t('reports.leaveType', 'Leave Type'),
      t('reports.dateRange', 'Date Range'),
      t('reports.days', 'Days'),
      t('reports.status', 'Status'),
      t('timeTracking.notes', 'Notes'),
      t('timeTracking.createdAt', 'Created At')
    ];

    const rows = leaveRequests.map((req) => [
      t('reports.leave', 'Leave Requests'),
      isDemoMode() ? getDemoEmployeeName(req.employee, t) : (req.employee?.name || 'Unknown'),
      translateDepartment(req.employee?.department) || '',
      translateLeaveType(req.leave_type),
      `${(req.start_date || '').slice(0, 10)} → ${(req.end_date || req.start_date || '').slice(0, 10)}`,
      req.days_count ?? '',
      translateStatus(req.status) || '',
      mapUgc(ugcMap, req.reason || ''),
      new Date(req.created_at).toLocaleString()
    ]);

    return { headers, rows };
  };

  const exportAllToCSV = async () => {
    setExporting(true);
    try {
      const exportData = await getFilteredExportData();
      const { timeEntries, tasks, goals, leave, employees: allEmployees } = exportData;
      const employees = selectedEmployee === 'all'
        ? filterActiveEmployees(allEmployees)
        : allEmployees;
      const exportStats = computeExportStats(timeEntries, tasks, goals, leave);

      if (exportStats.totalRecords === 0) {
        alert(t('reports.noData', 'No data available for the selected period'));
        return;
      }

      const ugcMap = await buildUgcTranslateMap(
        collectExportUgcStrings(timeEntries, tasks, goals, leave)
      );

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
          ...(leave.length > 0 || activeTab === 'leave' || activeTab === 'all'
            ? [[t('reports.leave', 'Leave Requests'), exportStats.leaveCount]]
            : []),
          [t('reports.totalHours', 'Total Hours'), `${exportStats.totalHours}h`],
          [t('reports.approved', 'Approved'), exportStats.approvedTime],
          [t('reports.completedTasks', 'Completed Tasks'), exportStats.completedTasks],
          [t('reports.achievedGoals', 'Achieved Goals'), exportStats.achievedGoals]
        ]
      }];

      if (timeEntries.length > 0) {
        const timeSection = buildTimeEntryCsvRows(timeEntries, ugcMap);
        sections.push({ title: t('reports.timeEntries', 'TIME ENTRIES').toUpperCase(), ...timeSection });
      }
      if (tasks.length > 0) {
        const taskSection = buildTaskCsvRows(tasks, ugcMap);
        sections.push({ title: t('reports.tasks', 'TASKS').toUpperCase(), ...taskSection });
      }
      if (goals.length > 0) {
        const goalSection = buildGoalCsvRows(goals, ugcMap);
        sections.push({ title: t('reports.personalGoals', 'PERSONAL GOALS').toUpperCase(), ...goalSection });
      }
      if (leave.length > 0) {
        const leaveSection = buildLeaveCsvRows(leave, ugcMap);
        sections.push({ title: t('reports.leave', 'LEAVE REQUESTS').toUpperCase(), ...leaveSection });
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
      const blob = new Blob(['\uFEFF' + csvContent], { type: 'application/vnd.ms-excel;charset=utf-8;' });
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
      if (handleSessionAuthError(error)) return;
      alert(t('reports.errorExporting', 'Error exporting data') + ': ' + error.message);
    } finally {
      setExporting(false);
    }
  };

  // Enhanced Excel Export with Metrics, Embedded Charts, and Styled Tables
  const exportToExcel = async () => {
    setExporting(true);
    try {
      const exportSnapshot = await getFilteredExportData();
      const timeEntries = exportSnapshot.timeEntries;
      const tasks = exportSnapshot.tasks;
      const goals = exportSnapshot.goals;
      const leave = exportSnapshot.leave;
      const allEmployees = exportSnapshot.employees;
      const employees = selectedEmployee === 'all'
        ? filterActiveEmployees(allEmployees)
        : allEmployees;

      if (timeEntries.length === 0 && tasks.length === 0 && goals.length === 0 && leave.length === 0) {
        alert(t('reports.noData', 'No data available for the selected period'));
        return;
      }

      const ugcMap = await buildUgcTranslateMap(
        collectExportUgcStrings(timeEntries, tasks, goals, leave)
      );

      // Helpers for safe values and typing
      const sanitize = (v) => {
        if (v == null) return '';
        const s = String(v);
        return (/^[=+\-@]/.test(s) ? "'" + s : s);
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

      const ExcelJS = await loadExcelJs();
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
        addMetric(tr('reports.excel.metrics.totalHours', 'Total Hours Logged'), formatHours(totalHours), true, true);
        addMetric(tr('reports.excel.metrics.regularHours', 'Regular Hours'), formatHours(regularHours), true, true);
        addMetric(tr('reports.excel.metrics.overtimeHours', 'Overtime Hours'), formatHours(overtimeHours), true, true);
        addMetric(tr('reports.excel.metrics.wfhHours', 'WFH Hours'), formatHours(wfhHours), true, true);
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
            entry.hours ? Number(formatHours(entry.hours)) : 0,
            translateHourType(entry.hour_type) || '',
            translateStatus(entry.status) || '',
            translateNotes(entry.notes, ugcMap) || '',
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
            isDemoMode() ? getDemoTaskTitle(task, t) : mapUgc(ugcMap, task.title || ''),
            isDemoMode() ? getDemoTaskDescription(task, t) : mapUgc(ugcMap, task.description || ''),
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
            isDemoMode() ? getDemoGoalTitle(goal, t) : mapUgc(ugcMap, goal.title || ''),
            isDemoMode() ? getDemoGoalDescription(goal, t) : mapUgc(ugcMap, goal.description || ''),
            translateCategory(goal.category) || '',
            translateStatus(goal.status) || '',
            goal.progress || 0,
            goal.target_date || '',
            mapUgc(ugcMap, goal.notes || ''),
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
      if (handleSessionAuthError(error)) return;
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

  const translateLeaveType = (leaveType) => {
    if (!leaveType) return '';
    const type = leaveType.toLowerCase();
    switch (type) {
      case 'sick':
        return t('timeTracking.sickLeave', 'Sick Leave');
      case 'personal':
        return t('timeTracking.personal', 'Personal');
      case 'vacation':
        return t('timeTracking.vacation', 'Vacation');
      default:
        return leaveType;
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

  // Localizes the "Entered by admin:" prefix; the free-text body is looked up
  // from the pre-translated UGC map when one is supplied (export paths).
  const translateNotes = (notes, ugcMap = null) => {
    if (!notes) return '';
    // Check if notes starts with "Entered by admin:" (case insensitive, optional colon)
    const adminPrefixRegex = /^Entered by admin:?\s*/i;
    const match = notes.match(adminPrefixRegex);

    if (match) {
      const translatedPrefix = t('timeTracking.enteredByAdmin', 'Entered by admin:');
      const body = notes.slice(match[0].length);
      // Replace the matched prefix with the translated one and ensure a space follows
      return translatedPrefix + ' ' + (ugcMap ? (ugcMap.get(body) ?? body) : body);
    }
    return ugcMap ? (ugcMap.get(notes) ?? notes) : notes;
  };

  const mapUgc = (ugcMap, text) => {
    if (!text) return '';
    return ugcMap?.get(text) ?? text;
  };

  const collectExportUgcStrings = (timeEntries = [], tasks = [], goals = [], leave = []) => {
    const strings = [];
    const pushNotesBody = (notes) => {
      if (!notes) return;
      const match = String(notes).match(/^Entered by admin:?\s*/i);
      strings.push(match ? notes.slice(match[0].length) : notes);
    };
    timeEntries.forEach((entry) => pushNotesBody(entry.notes));
    if (!isDemoMode()) {
      tasks.forEach((task) => {
        if (task.title) strings.push(task.title);
        if (task.description) strings.push(task.description);
      });
      goals.forEach((goal) => {
        if (goal.title) strings.push(goal.title);
        if (goal.description) strings.push(goal.description);
        if (goal.notes) strings.push(goal.notes);
      });
    }
    leave.forEach((req) => {
      if (req.reason) strings.push(req.reason);
    });
    return strings;
  };

  /**
   * Pre-translates every unique UGC string in an export with the on-device
   * translator. Cache-first, so anything already seen on screen costs nothing;
   * the rest are translated one by one before the file is written.
   */
  const buildUgcTranslateMap = async (strings) => {
    const unique = [...new Set(strings.filter((s) => typeof s === 'string' && s.trim()))];
    if (unique.length === 0) return new Map();
    const translated = await translateTexts(unique, currentLanguage);
    return new Map(unique.map((s, i) => [s, translated[i] ?? s]));
  };

  // PDF Export with Charts and Tables
  const exportToPDF = async function() {
    setExporting(true);
    try {
      const exportSnapshot = await getFilteredExportData();
      const timeEntries = exportSnapshot.timeEntries;
      const tasks = exportSnapshot.tasks;
      const goals = exportSnapshot.goals;
      const leave = exportSnapshot.leave;
      const allEmployees = exportSnapshot.employees;
      const employees = selectedEmployee === 'all'
        ? filterActiveEmployees(allEmployees)
        : allEmployees;
      const exportStats = computeExportStats(timeEntries, tasks, goals, leave);

      if (exportStats.totalRecords === 0) {
        alert(t('reports.noData', 'No data available for the selected period'));
        return;
      }

      const ugcMap = await buildUgcTranslateMap(
        collectExportUgcStrings(timeEntries, tasks, goals, leave)
      );

      const { jsPDF, autoTable } = await loadPdfLibs();
      const doc = new jsPDF('p', 'mm', 'a4');
      const loadedFonts = await loadPdfFonts(doc, currentLanguage);
      const unicodeFontLoaded = loadedFonts.unicodeReady;

      if (!unicodeFontLoaded && ['jp', 'kr', 'th', 'vn'].includes(currentLanguage)) {
        console.warn('Unicode fonts unavailable — PDF labels may not render correctly.');
      }

      // opts.bold uses the family's real bold face (Archivo, Helvetica). Scripts
      // whose face has no bold sibling — CJK, Thai, Cyrillic Noto — are stroked
      // instead, so bolding never swaps in a font with different glyph coverage.
      const drawText = (text, x, y, opts) => {
        const { bold = false, ...textOpts } = opts || {};
        const cleaned = cleanTextForPDF(text, unicodeFontLoaded);
        const chosen = choosePdfFont(cleaned, loadedFonts);
        const hasBoldFace = bold && (
          chosen === 'helvetica' || pdfFontSupportsBold(chosen, loadedFonts)
        );
        try {
          doc.setFont(chosen, hasBoldFace ? 'bold' : 'normal');
        } catch {
          /* keep the active font rather than failing the export */
        }

        const strokeBold = bold && !hasBoldFace;
        const previousLineWidth = doc.getLineWidth();
        if (strokeBold) {
          textOpts.renderingMode = 'fillThenStroke';
          doc.setLineWidth(doc.getFontSize() * 0.3528 * 0.038);
          try {
            doc.setDrawColor(doc.getTextColor());
          } catch {
            /* stroke keeps the previous draw colour */
          }
        }

        if (Object.keys(textOpts).length > 0) {
          doc.text(cleaned, x, y, textOpts);
        } else {
          doc.text(cleaned, x, y);
        }

        if (strokeBold) doc.setLineWidth(previousLineWidth);
      };

      if (!unicodeFontLoaded) {
        doc.setFont('helvetica', 'normal');
        console.log('⚠ Using Helvetica with character sanitization (Unicode font unavailable)');
      }

      const getTableFont = () => getPdfTableFont(loadedFonts, currentLanguage);

      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();

      // Glyph-accurate measurement: the same font drawText would pick, so CJK/Thai
      // widths are real widths and never Helvetica estimates.
      const measureText = (text, size) => {
        const cleaned = cleanTextForPDF(text, unicodeFontLoaded);
        if (!cleaned) return 0;
        const previousSize = doc.getFontSize();
        try {
          doc.setFont(choosePdfFont(cleaned, loadedFonts), 'normal');
        } catch {
          /* fall through: measure with whatever font is active */
        }
        doc.setFontSize(size);
        const width = doc.getTextWidth(cleaned);
        doc.setFontSize(previousSize);
        return width;
      };

      // Truncate by code point (never mid-surrogate) — CJK has no spaces to wrap on,
      // so splitTextToSize would run text off the page instead of breaking it.
      const ellipsis = unicodeFontLoaded ? '…' : '...';
      const fitText = (text, maxWidth, size) => {
        const cleaned = cleanTextForPDF(text, unicodeFontLoaded);
        if (!cleaned || maxWidth <= 0) return cleaned;
        if (measureText(cleaned, size) <= maxWidth) return cleaned;

        const chars = Array.from(cleaned);
        let low = 0;
        let high = chars.length;
        while (low < high) {
          const mid = Math.ceil((low + high) / 2);
          if (measureText(chars.slice(0, mid).join('') + ellipsis, size) <= maxWidth) {
            low = mid;
          } else {
            high = mid - 1;
          }
        }
        return low > 0 ? chars.slice(0, low).join('') + ellipsis : ellipsis;
      };

      // Separators degrade to ASCII when the Unicode font is unavailable.
      const dotSeparator = unicodeFontLoaded ? '·' : '|';
      const arrowSeparator = unicodeFontLoaded ? '→' : '->';

      const reportTitle = t('reports.performanceReport', 'HR PERFORMANCE REPORT');

      // Employee name for filename - sanitize for safe filename
      const rawEmployeeName = selectedEmployee !== 'all' ?
        employees.find(emp => String(emp.id) === String(selectedEmployee))?.name :
        t('reports.allEmployees', 'All Employees');
      // Only sanitize filename if Unicode font failed to load, otherwise keep original
      const employeeName = unicodeFontLoaded ?
        (rawEmployeeName || `${t('reports.allEmployees', '')}`).replace(/\s+/g, '_').replace(/[<>:"/\\|?*]/g, '_') :
        cleanTextForPDF(rawEmployeeName || `${t('reports.allEmployees', '')}`, false).replace(/\s+/g, '_');

      const displayEmployeeName = selectedEmployee === 'all' ?
        t('reports.allEmployees', 'All Employees') :
        (unicodeFontLoaded ? rawEmployeeName : cleanTextForPDF(rawEmployeeName, false));

      // Running header on continuation pages: "Report — Employee · Page N", then a 2px rule.
      const emDash = unicodeFontLoaded ? '—' : '-';
      const headedPages = new Set([1]);
      const drawRunningHeader = () => {
        const pageNumber = doc.internal.getCurrentPageInfo().pageNumber;
        if (headedPages.has(pageNumber)) return PDF_TOKENS.contentTop;
        headedPages.add(pageNumber);

        const label = `${reportTitle} ${emDash} ${displayEmployeeName} ${dotSeparator} ${t('reports.page', 'Page')} ${pageNumber}`;
        doc.setFontSize(8);
        doc.setTextColor(...PDF_TOKENS.ink);
        drawText(
          fitText(label, pageWidth - PDF_TOKENS.margin * 2, 8),
          PDF_TOKENS.margin,
          PDF_TOKENS.headerBaseline,
          { bold: true }
        );
        doc.setDrawColor(...PDF_TOKENS.ink);
        doc.setLineWidth(PDF_TOKENS.ruleHeavy);
        doc.line(
          PDF_TOKENS.margin,
          PDF_TOKENS.headerRule,
          pageWidth - PDF_TOKENS.margin,
          PDF_TOKENS.headerRule
        );
        return PDF_TOKENS.contentTop;
      };

      const layout = createPdfReportLayout({
        doc,
        pageWidth,
        pageHeight,
        drawText,
        measureText,
        fitText,
        onNewPage: drawRunningHeader
      });

      // ── Masthead: bold title left-aligned over meta lines ─────────────────
      layout.titleBlock({
        title: reportTitle.toUpperCase(),
        metaLines: [
          `${t('reports.generated', 'Generated')}: ${new Date().toLocaleString()}`,
          `${t('reports.period', 'Period')}: ${filters.startDate} ${t('reports.to', 'to')} ${filters.endDate}`,
          `${t('reports.employee', 'Employee')}: ${displayEmployeeName}`
        ]
      });

      // ── Summary overview: 2-column label/value grid + performance meter ────
      layout.sectionRule();
      layout.sectionHeading(t('reports.summaryOverview', 'SUMMARY OVERVIEW').toUpperCase());

      const summaryCell = (label, value) => ({ label, value: String(value) });
      layout.summaryGrid([
        summaryCell(t('reports.totalRecords', 'Total Records'), exportStats.totalRecords),
        timeEntries.length > 0
          ? summaryCell(t('reports.totalHours', 'Total Hours'), `${exportStats.totalHours}h`)
          : null,
        ...(timeEntries.length > 0 ? [
          summaryCell(t('reports.timeEntries', 'Time Entries'), exportStats.timeEntriesCount),
          summaryCell(t('reports.approved', 'Approved'), exportStats.approvedTime)
        ] : []),
        ...(tasks.length > 0 ? [
          summaryCell(t('reports.tasks', 'Tasks'), exportStats.tasksCount),
          summaryCell(t('reports.completedTasks', 'Completed Tasks'), exportStats.completedTasks)
        ] : []),
        ...(goals.length > 0 ? [
          summaryCell(t('reports.goals', 'Goals'), exportStats.goalsCount),
          summaryCell(t('reports.achievedGoals', 'Achieved Goals'), exportStats.achievedGoals)
        ] : []),
        ...(leave.length > 0 ? [
          summaryCell(t('reports.leave', 'Leave Requests'), exportStats.leaveCount),
          null
        ] : [])
      ]);

      // One employee → that employee's score; "all" → mean over the employees that
      // actually have records in this period (employees with none would skew it to 0).
      const scoredEmployees = selectedEmployee === 'all'
        ? employees
        : employees.filter((emp) => String(emp.id) === String(selectedEmployee));
      const employeeScores = scoredEmployees
        .map((employee) => computeEmployeePerformance(employee, timeEntries, tasks, goals))
        .filter((performance) => (
          selectedEmployee !== 'all'
          || performance.timeEntriesCount > 0
          || performance.tasksCount > 0
          || performance.goalsCount > 0
        ))
        .map((performance) => Number(performance.overallScore))
        .filter((score) => Number.isFinite(score));

      if (employeeScores.length > 0 && (timeEntries.length > 0 || tasks.length > 0 || goals.length > 0)) {
        const overallScore = employeeScores.reduce((sum, score) => sum + score, 0) / employeeScores.length;
        layout.meterRow({
          label: t('reports.excel.performance.overallScore', 'Overall Performance Score:'),
          valueText: `${overallScore.toFixed(1)}%`,
          filled: meterFilledBlocks(overallScore)
        });
      }

      const toChartItems = (countsMap, translateFn) =>
        withBarPercents(
          Object.entries(countsMap).map(([key, value]) => ({
            label: translateFn ? (translateFn(key) || key) : key,
            value
          }))
        ).map((item) => ({
          ...item,
          valueText: Number.isInteger(item.value) ? String(item.value) : formatHours(item.value)
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

      // ── Visual analytics: bar groups (neutral track + accent fill) ─────────
      if (pdfCharts.length > 0) {
        layout.ensure(34); // keep the heading with at least the first rows
        layout.sectionRule();
        layout.sectionHeading(t('reports.pdf.visualAnalytics', 'VISUAL ANALYTICS').toUpperCase());
        pdfCharts.forEach((chart) => layout.barGroup(chart));
      }

      // ── Data tables: header row + data rows, thead repeats across pages ────
      const addPdfTable = (title, head, body, fontSize = 7) => {
        if (body.length === 0) return;
        // Don't leave a heading (or a two-row stub) stranded at the foot of a page.
        const estimatedHeight = 24 + body.length * 5.8;
        layout.ensure(Math.min(estimatedHeight, 54));
        layout.sectionRule();
        layout.sectionHeading(title);

        autoTable(doc, {
          startY: layout.y,
          head: [head],
          body,
          theme: 'plain',
          showHead: 'everyPage',
          headStyles: {
            textColor: PDF_TOKENS.ink,
            fillColor: false,
            lineColor: PDF_TOKENS.ink,
            lineWidth: { bottom: PDF_TOKENS.ruleHeavy },
            fontStyle: 'normal',
            font: getTableFont()
          },
          bodyStyles: {
            textColor: PDF_TOKENS.inkSoft,
            lineColor: PDF_TOKENS.track,
            lineWidth: { bottom: PDF_TOKENS.ruleThin }
          },
          styles: {
            fontSize,
            cellPadding: { top: 1.6, right: 1.6, bottom: 1.6, left: 1.6 },
            font: getTableFont(),
            fontStyle: 'normal',
            overflow: 'linebreak'
          },
          didParseCell: function(data) {
            const cellText = Array.isArray(data.cell.text) ? data.cell.text.join(' ') : String(data.cell.text || '');
            data.cell.styles.font = choosePdfFont(cellText, loadedFonts);
          },
          // Continuation pages created by autoTable still get the running header.
          didDrawPage: function() {
            drawRunningHeader();
          },
          margin: {
            top: PDF_TOKENS.contentTop,
            left: PDF_TOKENS.margin,
            right: PDF_TOKENS.margin,
            bottom: PDF_TOKENS.footerReserve
          }
        });

        layout.y = doc.lastAutoTable.finalY + 4;
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
            `${formatHours(entry.hours || 0)}h`,
            cleanTextForPDF(translateHourType(entry.hour_type), unicodeFontLoaded),
            cleanTextForPDF(translateStatus(entry.status), unicodeFontLoaded)
          ])
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
            cleanTextForPDF((isDemoMode() ? getDemoTaskTitle(task, t) : mapUgc(ugcMap, task.title || '')).substring(0, 40), unicodeFontLoaded),
            cleanTextForPDF(translatePriority(task.priority), unicodeFontLoaded),
            cleanTextForPDF(translateStatus(task.status), unicodeFontLoaded),
            task.due_date || '-',
            `${formatHours(task.estimated_hours || 0)}h`,
            `${formatHours(task.actual_hours || 0)}h`
          ])
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
            cleanTextForPDF((isDemoMode() ? getDemoGoalTitle(goal, t) : mapUgc(ugcMap, goal.title || '')).substring(0, 40), unicodeFontLoaded),
            cleanTextForPDF(translateCategory(goal.category), unicodeFontLoaded),
            cleanTextForPDF(translateStatus(goal.status), unicodeFontLoaded),
            goal.target_date || '-',
            `${goal.progress || 0}%`
          ])
        );
      }

      if (leave.length > 0) {
        addPdfTable(
          t('reports.leave', 'LEAVE REQUESTS').toUpperCase(),
          [
            pdfHead('reports.pdf.headers.employee', 'Employee'),
            pdfHead('reports.pdf.headers.department', 'Department'),
            pdfHead('reports.leaveType', 'Leave Type'),
            pdfHead('reports.dateRange', 'Date Range'),
            pdfHead('reports.days', 'Days'),
            pdfHead('reports.pdf.headers.status', 'Status')
          ],
          leave.map((req) => [
            cleanTextForPDF(isDemoMode() ? getDemoEmployeeName(req.employee, t) : (req.employee?.name || t('reports.unknown', 'Unknown')), unicodeFontLoaded),
            cleanTextForPDF(translateDepartment(req.employee?.department) || '', unicodeFontLoaded),
            cleanTextForPDF(translateLeaveType(req.leave_type), unicodeFontLoaded),
            `${(req.start_date || '').slice(0, 10)} ${arrowSeparator} ${(req.end_date || req.start_date || '').slice(0, 10)}`,
            String(req.days_count ?? '-'),
            cleanTextForPDF(translateStatus(req.status), unicodeFontLoaded)
          ])
        );
      }

      if (selectedEmployee === 'all' && employees.length > 0 && activeTab !== 'leave') {
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
              formatHours(performance.totalHours),
              String(performance.tasksCount),
              String(performance.completedTasks),
              String(performance.goalsCount),
              `${performance.overallScore}%`
            ];
          }),
          6
        );
      }

      // ── Footer rule + "Page N/M · Generated by …" and the locale code ──────
      const pageCount = doc.internal.getNumberOfPages();
      const localeCode = (SUPPORTED_LANGUAGES[currentLanguage]?.code || currentLanguage || 'en').toUpperCase();
      const footerRuleY = pageHeight - PDF_TOKENS.footerRule;
      const footerBaselineY = pageHeight - PDF_TOKENS.footerBaseline;
      const footerRight = pageWidth - PDF_TOKENS.margin;

      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setDrawColor(...PDF_TOKENS.ink);
        doc.setLineWidth(PDF_TOKENS.ruleHeavy);
        doc.line(PDF_TOKENS.margin, footerRuleY, footerRight, footerRuleY);

        doc.setFontSize(7.5);
        doc.setTextColor(...PDF_TOKENS.muted);
        const localeWidth = measureText(localeCode, 7.5);
        const footerLabel = `${t('reports.page', 'Page')} ${i}/${pageCount} ${dotSeparator} ${t('reports.generatedBy', 'Generated by HR Management System')}`;
        drawText(
          fitText(footerLabel, pageWidth - PDF_TOKENS.margin * 2 - localeWidth - 6, 7.5),
          PDF_TOKENS.margin,
          footerBaselineY
        );
        drawText(localeCode, footerRight, footerBaselineY, { align: 'right' });
      }

      // Save the PDF
      const filename = `${t('reports.filenamePrefix', 'HR_Report')}_${employeeName}_${filters.startDate}_to_${filters.endDate}_${currentLanguage.toUpperCase()}.pdf`;
      doc.save(filename);
      
      alert(t('reports.pdfExportSuccess', 'PDF report exported successfully!'));
    } catch (error) {
      console.error('Error exporting PDF:', error);
      if (handleSessionAuthError(error)) return;
      alert(t('reports.errorExporting', 'Error exporting PDF file') + ': ' + error.message);
    } finally {
      setExporting(false);
    }
  };

  /* ------------------------------------------------------------------ *
   * "Industry" chrome (src/theme/industry.js). Radius 0, cards are
   * outlines with four registration corners, and status reads through
   * weight and rule rather than a coloured pill per state.
   * ------------------------------------------------------------------ */

  const frameStyle = {
    border: `1px solid ${ind.hairline}`,
    background: ind.ground,
    color: ind.ink,
    fontFamily: BODY,
    fontSize: 14,
    borderRadius: 0,
  };
  const caption = { fontFamily: BODY, fontSize: 13, color: ind.inkMuted, lineHeight: 1.5, margin: 0 };
  const columnNote = { fontFamily: BODY, fontSize: 11.5, color: ind.inkMuted, lineHeight: 1.45, margin: '6px 0 0' };
  const fieldLabelStyle = {
    fontFamily: DISPLAY, fontWeight: 600, fontSize: 10, letterSpacing: '.14em',
    textTransform: 'uppercase', color: ind.inkMuted, display: 'block', marginBottom: 4,
  };
  const thStyle = {
    fontFamily: DISPLAY, fontWeight: 600, fontSize: 11, letterSpacing: '.12em',
    textTransform: 'uppercase', color: ind.inkMuted,
    padding: '0 10px 8px', textAlign: 'left', whiteSpace: 'nowrap', userSelect: 'none',
  };
  const tdStyle = {
    fontFamily: BODY, fontSize: 13, color: ind.ink,
    padding: '9px 10px', borderTop: `1px solid ${ind.rule}`, verticalAlign: 'middle',
  };
  const subCellStyle = { fontFamily: BODY, fontSize: 11.5, color: ind.inkFaint, marginTop: 2 };

  /**
   * approved / completed is settled work → filled accent.
   * pending / in progress is asking for something → outline.
   * everything else is passive → neutral.
   */
  const statusVariant = (status) => {
    const value = String(status || '').toLowerCase();
    if (value === 'approved' || value === 'completed') return 'accent';
    if (value === 'pending' || value === 'in_progress' || value === 'in-progress') return 'outline';
    return 'neutral';
  };

  const priorityVariant = (priority) => {
    const value = String(priority || '').toLowerCase();
    if (value === 'high') return 'outline';
    if (value === 'medium') return 'accent';
    return 'neutral';
  };

  const employeeNameOf = (item) =>
    (isDemoMode() ? getDemoEmployeeName(item.employee, t) : (item.employee?.name || t('taskReview.unknown', 'Unknown')));

  /**
   * A sortable column head. The direction reads as a caret in the label's own
   * type rather than an icon, so the header row stays one typographic object.
   */
  const SortableTh = ({ sortId, children }) => {
    const active = sortKey === sortId;
    return (
      <th style={thStyle}>
        <button
          type="button"
          onClick={() => handleSort(sortId)}
          style={{
            font: 'inherit', color: active ? ind.ink : 'inherit', letterSpacing: 'inherit',
            textTransform: 'inherit', background: 'none', border: 'none', padding: 0,
            cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4,
          }}
        >
          {children}
          <span aria-hidden="true" style={{ opacity: active ? 1 : 0.35 }}>
            {active && sortDirection === 'asc' ? '▲' : '▼'}
          </span>
        </button>
      </th>
    );
  };

  /** One figure block: the form every derived number on this screen takes. */
  const FigureBlock = ({ item, size = 26 }) => (
    <div style={{ border: `1px solid ${ind.hairline}`, padding: '9px 11px', minWidth: 0 }}>
      <Kicker ind={ind}>{item.label}</Kicker>
      <div className="flex items-baseline" style={{ gap: 3, margin: '5px 0 0' }}>
        {typeof item.value === 'number' ? (
          <>
            <span style={{ ...figure(size, ind.ink), lineHeight: 1 }}>
              <SlidingNumber value={item.value} />
            </span>
            {item.suffix && (
              <span style={{ fontFamily: BODY, fontSize: 11.5, color: ind.inkMuted }}>{item.suffix}</span>
            )}
          </>
        ) : (
          <span style={{ ...figure(size, ind.ink), lineHeight: 1 }}>{item.title}</span>
        )}
      </div>
      <p
        style={{
          fontFamily: BODY, fontSize: 11, color: ind.inkFaint, margin: '4px 0 0',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}
      >
        {item.description}
      </p>
    </div>
  );

  /** A label / figure line in the rail or a breakdown box. */
  const StatLine = ({ label, value, suffix, decimals }) => (
    <div className="flex items-baseline justify-between" style={{ gap: 10 }}>
      <span style={{ fontFamily: BODY, fontSize: 12, color: ind.inkMuted, minWidth: 0 }}>{label}</span>
      <span
        style={{
          fontFamily: DISPLAY, fontWeight: 600, fontSize: 13, color: ind.ink,
          fontVariantNumeric: 'tabular-nums', flex: 'none',
        }}
      >
        {decimals != null
          ? <NumberTicker value={value} decimalPlaces={decimals} />
          : <SlidingNumber value={value} />}
        {suffix}
      </span>
    </div>
  );

  const selectedEmployeeRecord = reportData.employees.find(emp => String(emp.id) === String(selectedEmployee));
  const rangeLabel = `${filters.startDate} → ${filters.endDate}`;

  const activeTabLabel = {
    'all': t('reports.all', 'All Data Types'),
    'time-entries': t('reports.timeEntries', 'Time Entries'),
    'tasks': t('reports.tasks', 'Tasks'),
    'goals': t('reports.goals', 'Personal Goals'),
    'leave': t('reports.leave', 'Leave Requests'),
  }[activeTab] || activeTab;

  return (
    <div data-screen-label="Reports" style={frameStyle}>

      {/* ── TICKER — the overview figures, derived per data type ────── */}
      <div
        style={{
          height: 44, background: ind.tickerBg, color: ind.tickerInk,
          borderBottom: `1px solid ${ind.hairline}`,
          display: 'flex', alignItems: 'stretch', overflowX: 'auto', overflowY: 'hidden',
        }}
      >
        <TickerCell ind={ind}>
          <LiveClock ind={ind} live={!loading && stats.totalRecords > 0} />
        </TickerCell>

        {/* Same array the decision column renders, so the strip and the rail
            can never report different numbers. */}
        {overviewBentoItems.map((item, index) => (
          <TickerCell
            key={`${item.label}-${index}`}
            ind={ind}
            label={item.label}
            // `title` already carries its own unit, so the suffix is not repeated.
            value={item.title}
            // The record count is the figure the whole screen is about.
            valueColor={index === 0 && stats.totalRecords > 0 ? ind.tickerUp : undefined}
          />
        ))}

        <TickerCell ind={ind} label={t('reports.dateRange', 'Date Range')} value={rangeLabel} />

        <div
          style={{
            flex: 1, minWidth: 'max-content', display: 'flex', alignItems: 'center',
            justifyContent: 'flex-end', gap: 8, padding: '0 14px',
            borderLeft: `1px solid ${ind.tickerRule}`,
          }}
        >
          <FetchElapsedPill active={loading || exporting} isDarkMode label={t('common.fetching', 'Fetching')} />
          <FlatSelect
            ind={ind}
            onDark
            value={selectedEmployee}
            onChange={(e) => setSelectedEmployee(e.target.value)}
            aria-label={t('reports.employee', 'Employee')}
            style={{ maxWidth: 240 }}
          >
            <option value="all" style={{ color: '#1d1f20' }}>
              {`${t('reports.allEmployees', 'All Employees')} (${activeEmployees.length})`}
            </option>
            {[...activeEmployees]
              .sort((a, b) => getDemoEmployeeName(a, t).localeCompare(getDemoEmployeeName(b, t)))
              .map(emp => (
                <option key={emp.id} value={emp.id} style={{ color: '#1d1f20' }}>
                  {getDemoEmployeeName(emp, t)}
                </option>
              ))}
          </FlatSelect>
        </div>
      </div>

      {/* ── BANDS ──────────────────────────────────────────────────── */}
      <div className="flex flex-col lg:flex-row items-stretch">

        {/* ── LEFT — min-w-0 or the preview table wins ──────────────── */}
        <div
          className="flex-1 min-w-0 flex flex-col"
          style={{ padding: '22px 24px 20px', gap: 16, borderRight: `1px solid ${ind.hairline}` }}
        >
          {fetchError && (
            <div style={{ border: `1px solid ${ind.ink}`, padding: '12px 14px', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <AlertCircle size={16} strokeWidth={1.5} style={{ flex: 'none', marginTop: 2, color: ind.ink }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <Kicker ind={ind} color={ind.ink}>{t('common.error', 'Error')}</Kicker>
                <p style={{ ...caption, marginTop: 4 }}>{fetchError}</p>
                <Btn
                  ind={ind}
                  onClick={() => { setFetchError(null); fetchReportData(); }}
                  style={{ marginTop: 10 }}
                >
                  {t('common.retry', 'Try Again')}
                </Btn>
              </div>
              <button
                type="button"
                onClick={() => setFetchError(null)}
                aria-label={t('common.close', 'Close')}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: ind.inkMuted, padding: 0, flex: 'none' }}
              >
                <X size={15} strokeWidth={1.5} />
              </button>
            </div>
          )}

          {/* ── PAGE HEAD ───────────────────────────────────────────── */}
          <div className="flex flex-wrap items-end justify-between" style={{ gap: 16 }}>
            <div style={{ minWidth: 0 }}>
              <h1 style={{ fontFamily: BODY, fontSize: 32, fontWeight: 400, margin: 0, color: ind.ink, lineHeight: 1.1 }}>
                {t('nav.reports', 'Reports & Analytics')}
              </h1>
              <p style={{ ...caption, marginTop: 6 }}>
                {[
                  t('reports.subtitle', 'Export comprehensive data for time entries, tasks, and personal goals'),
                  `${stats.totalRecords} ${t('reports.recordsFound', 'records found')}`,
                  selectedEmployeeRecord ? getDemoEmployeeName(selectedEmployeeRecord, t) : null,
                  rangeLabel,
                ].filter(Boolean).join(' · ')}
              </p>
            </div>

            <div className="flex flex-wrap items-center" style={{ gap: 8 }}>
              <Seg
                ind={ind}
                ariaLabel={t('reports.dataType', 'Data Type')}
                value={activeTab}
                onChange={setActiveTab}
                options={[
                  { value: 'all', label: t('reports.all', 'All') },
                  { value: 'time-entries', label: t('reports.timeEntries', 'Time') },
                  { value: 'tasks', label: t('reports.tasks', 'Tasks') },
                  { value: 'goals', label: t('reports.goals', 'Goals') },
                  { value: 'leave', label: t('reports.leave', 'Leave') },
                ]}
              />
              {selectedEmployee !== 'all' && (
                <Tag ind={ind} variant="outline">{t('reports.individualReport', 'Individual Report')}</Tag>
              )}
            </div>
          </div>

          {/* ── FILTER STRIP ────────────────────────────────────────── */}
          <div
            className="flex flex-wrap items-end"
            style={{ gap: 14, padding: '12px 14px', border: `1px solid ${ind.hairline}` }}
          >
            <div style={{ minWidth: 200, flex: '1 1 200px' }}>
              <label htmlFor="report-employee" style={fieldLabelStyle}>
                {t('reports.employee', 'Employee')}
              </label>
              <FlatSelect
                ind={ind}
                id="report-employee"
                value={selectedEmployee}
                onChange={(e) => setSelectedEmployee(e.target.value)}
                style={{ width: '100%', textTransform: 'none', letterSpacing: '.02em' }}
              >
                <option value="all">
                  {`${t('reports.allEmployees', 'All Employees')} (${activeEmployees.length})`}
                </option>
                {[...activeEmployees]
                  .sort((a, b) => getDemoEmployeeName(a, t).localeCompare(getDemoEmployeeName(b, t)))
                  .map(emp => (
                    <option key={emp.id} value={emp.id}>
                      {`${getDemoEmployeeName(emp, t)} · ${translateDepartment(emp.department)} · ${translatePosition(emp.position)}`}
                    </option>
                  ))}
              </FlatSelect>
            </div>

            <div style={{ minWidth: 160 }}>
              <label htmlFor="report-range" style={fieldLabelStyle}>
                {t('reports.dateRange', 'Date Range')}
              </label>
              <FlatSelect
                ind={ind}
                id="report-range"
                value={dateRange}
                onChange={(e) => setDateRange(e.target.value)}
                style={{ width: '100%' }}
              >
                <option value="today">{t('reports.today', 'Today')}</option>
                <option value="this-week">{t('reports.thisWeek', 'This Week')}</option>
                <option value="this-month">{t('reports.thisMonth', 'This Month')}</option>
                <option value="last-month">{t('reports.lastMonth', 'Last Month')}</option>
                <option value="this-quarter">{t('reports.thisQuarter', 'This Quarter')}</option>
                <option value="this-year">{t('reports.thisYear', 'This Year')}</option>
                <option value="custom">{t('reports.customRange', 'Custom Range')}</option>
              </FlatSelect>
            </div>

            {dateRange === 'custom' && (
              <>
                <div style={{ minWidth: 0, width: 148 }}>
                  <label htmlFor="report-start" style={fieldLabelStyle}>
                    {t('reports.startDate', 'Start Date')}
                  </label>
                  <DatePicker
                    flat
                    id="report-start"
                    value={filters.startDate}
                    onChange={(e) => setFilters(prev => ({ ...prev, startDate: e.target.value }))}
                  />
                </div>
                <div style={{ minWidth: 0, width: 148 }}>
                  <label htmlFor="report-end" style={fieldLabelStyle}>
                    {t('reports.endDate', 'End Date')}
                  </label>
                  <DatePicker
                    flat
                    id="report-end"
                    value={filters.endDate}
                    onChange={(e) => setFilters(prev => ({ ...prev, endDate: e.target.value }))}
                  />
                </div>
              </>
            )}

            {selectedEmployee !== 'all' && (
              <p className="inline-flex items-center" style={{ ...caption, fontSize: 11.5, gap: 6, flex: '1 1 100%' }}>
                <Users size={12} strokeWidth={1.5} style={{ flex: 'none', color: ind.inkFaint }} />
                {t('reports.exportingIncludes', 'Exporting will include this employee\'s detailed performance report')}
              </p>
            )}
          </div>

          {/* ── INDIVIDUAL PERFORMANCE ──────────────────────────────── */}
          {selectedEmployee !== 'all' && (() => {
            const employee = selectedEmployeeRecord;
            if (!employee) return null;

            const employeeTimeEntries = reportData.timeEntries.filter(e => String(e.employee_id) === String(employee.id));
            const employeeTasks = reportData.tasks.filter(task => String(task.employee_id) === String(employee.id));
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

            const completedTasks = employeeTasks.filter(task => task.status === 'completed').length;
            const inProgressTasks = employeeTasks.filter(task => task.status === 'in_progress').length;
            const pendingTasks = employeeTasks.filter(task => task.status === 'pending').length;
            const taskCompletionRate = employeeTasks.length > 0 ? ((completedTasks / employeeTasks.length) * 100).toFixed(1) : 0;

            const completedGoals = employeeGoals.filter(g => g.status === 'completed').length;
            const inProgressGoals = employeeGoals.filter(g => g.status === 'in_progress').length;
            const goalCompletionRate = employeeGoals.length > 0 ? ((completedGoals / employeeGoals.length) * 100).toFixed(1) : 0;
            const avgProgress = employeeGoals.length > 0 ? (employeeGoals.reduce((sum, g) => sum + (g.status === 'completed' ? 100 : (g.progress || 0)), 0) / employeeGoals.length).toFixed(1) : 0;

            const employeeBentoItems = [];
            if (activeTab === 'time-entries' || activeTab === 'all') {
              employeeBentoItems.push(
                {
                  label: t('reports.hours', 'Hours'),
                  title: `${totalHours.toFixed(1)}h`,
                  description: t('reports.totalHours', 'Total Hours'),
                  value: Number(totalHours.toFixed(1)),
                  suffix: 'h',
                },
                {
                  label: t('reports.regular', 'Regular'),
                  title: `${regularHours.toFixed(1)}h`,
                  description: t('reports.regularHours', 'Regular Hours'),
                  value: Number(regularHours.toFixed(1)),
                  suffix: 'h',
                },
                {
                  label: t('reports.overtime', 'Overtime'),
                  title: `${overtimeHours.toFixed(1)}h`,
                  description: t('reports.overtime', 'Overtime'),
                  value: Number(overtimeHours.toFixed(1)),
                  suffix: 'h',
                },
                {
                  label: t('reports.wfh', 'WFH'),
                  title: `${wfhHours.toFixed(1)}h`,
                  description: t('reports.wfh', 'Working From Home'),
                  value: Number(wfhHours.toFixed(1)),
                  suffix: 'h',
                },
                {
                  label: t('reports.leave', 'Leave'),
                  title: String(leaveDays),
                  description: t('reports.leaveDays', 'Leave Days'),
                  value: Number(leaveDays) || 0,
                },
                {
                  label: t('reports.days', 'Days'),
                  title: String(daysWorked),
                  description: t('reports.daysWorked', 'Days Worked'),
                  value: Number(daysWorked) || 0,
                }
              );
            }
            if (activeTab === 'tasks' || activeTab === 'all') {
              employeeBentoItems.push({
                label: t('reports.tasks', 'Tasks'),
                title: `${completedTasks}/${employeeTasks.length}`,
                description: t('reports.tasksDone', 'Tasks Done'),
                value: completedTasks,
              });
            }
            if (activeTab === 'goals' || activeTab === 'all') {
              employeeBentoItems.push(
                {
                  label: t('reports.completion', 'Completion'),
                  title: `${activeTab === 'goals' ? goalCompletionRate : taskCompletionRate}%`,
                  description: t('reports.completion', 'Completion'),
                  value: Number(activeTab === 'goals' ? goalCompletionRate : taskCompletionRate) || 0,
                  suffix: '%',
                },
                {
                  label: t('reports.progress', 'Progress'),
                  title: `${avgProgress}%`,
                  description: t('reports.goalProgress', 'Goal Progress'),
                  value: Number(avgProgress) || 0,
                  suffix: '%',
                }
              );
            }

            return (
              <Blueprint ind={ind} style={{ padding: '18px 20px 16px' }}>
                <div className="flex flex-wrap items-end justify-between" style={{ gap: 12 }}>
                  <div style={{ minWidth: 0 }}>
                    <ColumnHeading ind={ind}>
                      {`${getDemoEmployeeName(employee, t)} — ${t('reports.performanceSummary', 'Performance')}`}
                    </ColumnHeading>
                    <p style={{ ...caption, fontSize: 12, marginTop: 4 }}>
                      {`${translateDepartment(employee.department)} · ${translatePosition(employee.position)}`}
                    </p>
                  </div>
                  <p style={{ ...caption, fontSize: 11.5, flex: 'none' }}>
                    {`${t('reports.reportPeriod', 'Report Period')}: ${rangeLabel}`}
                  </p>
                </div>

                {employeeBentoItems.length > 0 && (
                  <div
                    className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6"
                    style={{ gap: 8, marginTop: 14 }}
                  >
                    {employeeBentoItems.map((item, index) => (
                      <FigureBlock key={`${item.label}-${index}`} item={item} size={22} />
                    ))}
                  </div>
                )}

                {/* Breakdown — three hairline boxes, one per data type. */}
                <div className="grid grid-cols-1 md:grid-cols-3" style={{ gap: 12, marginTop: 14 }}>
                  {(activeTab === 'time-entries' || activeTab === 'all') && (
                    <div style={{ border: `1px solid ${ind.hairline}`, padding: '12px 14px' }}>
                      <div className="flex items-center" style={{ gap: 7, marginBottom: 9 }}>
                        <Clock size={13} strokeWidth={1.5} style={{ flex: 'none', color: ind.inkMuted }} />
                        <ColumnHeading ind={ind} style={{ fontSize: 12 }}>
                          {`${t('reports.timeEntries', 'Time Entries')} (${employeeTimeEntries.length})`}
                        </ColumnHeading>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                        <StatLine label={t('reports.approved', 'Approved')} value={approvedEntries} />
                        <StatLine label={t('reports.pending', 'Pending')} value={pendingEntries} />
                        <StatLine label={t('reports.regularHours', 'Regular Hours')} value={Number(regularHours.toFixed(1))} suffix="h" />
                        <StatLine label={t('reports.overtime', 'Overtime')} value={Number(overtimeHours.toFixed(1))} suffix="h" />
                        <StatLine label={t('reports.wfh', 'WFH')} value={Number(wfhHours.toFixed(1))} suffix="h" />
                        <StatLine label={t('reports.leaveDays', 'Leave Days')} value={Number(leaveDays) || 0} />
                      </div>
                    </div>
                  )}

                  {(activeTab === 'tasks' || activeTab === 'all') && (
                    <div style={{ border: `1px solid ${ind.hairline}`, padding: '12px 14px' }}>
                      <div className="flex items-center" style={{ gap: 7, marginBottom: 9 }}>
                        <CheckCircle size={13} strokeWidth={1.5} style={{ flex: 'none', color: ind.inkMuted }} />
                        <ColumnHeading ind={ind} style={{ fontSize: 12 }}>
                          {`${t('reports.tasks', 'Tasks')} (${employeeTasks.length})`}
                        </ColumnHeading>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                        <StatLine label={t('reports.completed', 'Completed')} value={completedTasks} />
                        <StatLine label={t('reports.inProgress', 'In Progress')} value={inProgressTasks} />
                        <StatLine label={t('reports.pending', 'Pending')} value={pendingTasks} />
                        <StatLine label={t('reports.completionRate', 'Completion Rate')} value={Number(taskCompletionRate) || 0} decimals={1} suffix="%" />
                      </div>
                      <div style={{ marginTop: 9 }}>
                        <Bar ind={ind} value={(Number(taskCompletionRate) || 0) / 100} height={6} />
                      </div>
                    </div>
                  )}

                  {(activeTab === 'goals' || activeTab === 'all') && (
                    <div style={{ border: `1px solid ${ind.hairline}`, padding: '12px 14px' }}>
                      <div className="flex items-center" style={{ gap: 7, marginBottom: 9 }}>
                        <Goal size={13} strokeWidth={1.5} style={{ flex: 'none', color: ind.inkMuted }} />
                        <ColumnHeading ind={ind} style={{ fontSize: 12 }}>
                          {`${t('reports.goals', 'Goals')} (${employeeGoals.length})`}
                        </ColumnHeading>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                        <StatLine label={t('reports.completed', 'Completed')} value={completedGoals} />
                        <StatLine label={t('reports.inProgress', 'In Progress')} value={inProgressGoals} />
                        <StatLine label={t('reports.avgProgress', 'Avg Progress')} value={Number(avgProgress) || 0} decimals={1} suffix="%" />
                        <StatLine label={t('reports.totalGoals', 'Total Goals')} value={employeeGoals.length} />
                      </div>
                      <div style={{ marginTop: 9 }}>
                        <Bar ind={ind} value={(Number(avgProgress) || 0) / 100} height={6} />
                      </div>
                    </div>
                  )}
                </div>
              </Blueprint>
            );
          })()}

          {/* ── PREVIEW LEDGER ──────────────────────────────────────── */}
          <Blueprint ind={ind} style={{ padding: '16px 16px 0' }}>
            <div className="flex flex-wrap items-baseline justify-between" style={{ gap: 10, marginBottom: 12 }}>
              <ColumnHeading ind={ind}>{t('reports.dataPreview', 'Data Preview')}</ColumnHeading>
              <span style={{ fontFamily: DISPLAY, fontWeight: 600, fontSize: 12, color: ind.inkMuted }}>
                {activeTabLabel}
              </span>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 640 }}>
                <thead>
                  <tr>
                    {activeTab === 'all' && (
                      <>
                        <th style={thStyle}>{t('reports.type', 'Type')}</th>
                        <th style={thStyle}>{t('reports.employees', 'Employee')}</th>
                        <th style={thStyle}>{t('reports.details', 'Details')}</th>
                        <th style={thStyle}>{t('reports.status', 'Status')}</th>
                        <th style={thStyle}>{t('reports.date', 'Date')}</th>
                      </>
                    )}

                    {activeTab === 'time-entries' && (
                      <>
                        <SortableTh sortId="employee">{t('reports.employees', 'Employee')}</SortableTh>
                        <SortableTh sortId="date">{t('reports.date', 'Date')}</SortableTh>
                        <SortableTh sortId="hours">{t('reports.hours', 'Hours')}</SortableTh>
                        <SortableTh sortId="type">{t('reports.type', 'Type')}</SortableTh>
                        <SortableTh sortId="status">{t('reports.status', 'Status')}</SortableTh>
                      </>
                    )}

                    {activeTab === 'tasks' && (
                      <>
                        <SortableTh sortId="employee">{t('reports.employees', 'Employee')}</SortableTh>
                        <th style={thStyle}>{t('reports.task', 'Task')}</th>
                        <SortableTh sortId="priority">{t('reports.priority', 'Priority')}</SortableTh>
                        <SortableTh sortId="status">{t('reports.status', 'Status')}</SortableTh>
                        <SortableTh sortId="date">{t('reports.dueDate', 'Due Date')}</SortableTh>
                      </>
                    )}

                    {activeTab === 'goals' && (
                      <>
                        <SortableTh sortId="employee">{t('reports.employees', 'Employee')}</SortableTh>
                        <th style={thStyle}>{t('reports.goal', 'Goal')}</th>
                        <th style={thStyle}>{t('reports.category', 'Category')}</th>
                        <SortableTh sortId="status">{t('reports.status', 'Status')}</SortableTh>
                        <SortableTh sortId="progress">{t('reports.progress', 'Progress')}</SortableTh>
                      </>
                    )}

                    {activeTab === 'leave' && (
                      <>
                        <SortableTh sortId="employee">{t('reports.employees', 'Employee')}</SortableTh>
                        <th style={thStyle}>{t('reports.leaveType', 'Type')}</th>
                        <SortableTh sortId="date">{t('reports.dateRange', 'Date Range')}</SortableTh>
                        <th style={thStyle}>{t('reports.days', 'Days')}</th>
                        <SortableTh sortId="status">{t('reports.status', 'Status')}</SortableTh>
                      </>
                    )}
                  </tr>
                </thead>

                <tbody>
                  {(activeTab === 'all'
                    ? (getSortedData.timeEntries?.length + getSortedData.tasks?.length + getSortedData.goals?.length === 0)
                    : getSortedData.length === 0) ? (
                    <tr>
                      <td colSpan={5} style={{ ...tdStyle, padding: '44px 10px', textAlign: 'center' }}>
                        <FileText size={26} strokeWidth={1.25} style={{ color: ind.inkFaint, margin: '0 auto' }} />
                        <div style={{ marginTop: 10 }}>
                          <ColumnHeading ind={ind}>{t('reports.noData', 'No data found')}</ColumnHeading>
                        </div>
                        <p style={{ ...caption, marginTop: 5 }}>
                          {t('reports.adjustFilters', 'Try adjusting your filters or date range')}
                        </p>
                      </td>
                    </tr>
                  ) : activeTab === 'all' ? (
                    <>
                      {(getSortedData.timeEntries || []).map((item, index) => (
                        <tr key={`time-${index}`}>
                          <td style={tdStyle}>
                            <Tag ind={ind} variant="neutral">{translateDataType('timeEntry')}</Tag>
                          </td>
                          <td style={tdStyle}>
                            <div>{employeeNameOf(item)}</div>
                            <div style={subCellStyle}>{translateDepartment(item.employee?.department)}</div>
                          </td>
                          <td style={tdStyle}>
                            {`${item.hours || 0}h · ${translateHourType(item.hour_type)}`}
                          </td>
                          <td style={tdStyle}>
                            <Tag ind={ind} variant={statusVariant(item.status)}>{translateStatus(item.status)}</Tag>
                          </td>
                          <td style={{ ...tdStyle, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>{item.date}</td>
                        </tr>
                      ))}

                      {(getSortedData.tasks || []).map((item, index) => (
                        <tr key={`task-${index}`}>
                          <td style={tdStyle}>
                            <Tag ind={ind} variant="neutral">{translateDataType('task')}</Tag>
                          </td>
                          <td style={tdStyle}>
                            <div>{employeeNameOf(item)}</div>
                            <div style={subCellStyle}>{translateDepartment(item.employee?.department)}</div>
                          </td>
                          <td style={{ ...tdStyle, maxWidth: 280 }}>
                            <div className="truncate">
                              {isDemoMode() ? getDemoTaskTitle(item, t) : <TranslatedText text={item.title} />}
                            </div>
                            <div className="truncate" style={subCellStyle}>
                              {isDemoMode() ? getDemoTaskDescription(item, t) : <TranslatedText text={item.description} />}
                            </div>
                          </td>
                          <td style={tdStyle}>
                            <Tag ind={ind} variant={statusVariant(item.status)}>{translateStatus(item.status)}</Tag>
                          </td>
                          <td style={{ ...tdStyle, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>{item.due_date || '—'}</td>
                        </tr>
                      ))}

                      {(getSortedData.goals || []).map((item, index) => (
                        <tr key={`goal-${index}`}>
                          <td style={tdStyle}>
                            <Tag ind={ind} variant="neutral">{translateDataType('goal')}</Tag>
                          </td>
                          <td style={tdStyle}>
                            <div>{employeeNameOf(item)}</div>
                            <div style={subCellStyle}>{translateDepartment(item.employee?.department)}</div>
                          </td>
                          <td style={{ ...tdStyle, maxWidth: 280 }}>
                            <div className="truncate">
                              {isDemoMode() ? getDemoGoalTitle(item, t) : <TranslatedText text={item.title} />}
                            </div>
                            <div className="truncate" style={subCellStyle}>
                              {`${translateCategory(item.category)} · ${item.status === 'completed' ? 100 : (item.progress || 0)}%`}
                            </div>
                          </td>
                          <td style={tdStyle}>
                            <Tag ind={ind} variant={statusVariant(item.status)}>{translateStatus(item.status)}</Tag>
                          </td>
                          <td style={{ ...tdStyle, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>{item.target_date || '—'}</td>
                        </tr>
                      ))}
                    </>
                  ) : (
                    getSortedData.map((item, index) => (
                      <tr key={index}>
                        {activeTab === 'time-entries' && (
                          <>
                            <td style={tdStyle}>
                              <div>{employeeNameOf(item)}</div>
                              <div style={subCellStyle}>{translateDepartment(item.employee?.department)}</div>
                            </td>
                            <td style={{ ...tdStyle, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>{item.date}</td>
                            <td style={{ ...tdStyle, fontFamily: DISPLAY, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                              {`${item.hours || 0}h`}
                            </td>
                            <td style={tdStyle}>
                              <Tag ind={ind} variant="neutral">{translateHourType(item.hour_type)}</Tag>
                            </td>
                            <td style={tdStyle}>
                              <Tag ind={ind} variant={statusVariant(item.status)}>{translateStatus(item.status)}</Tag>
                            </td>
                          </>
                        )}

                        {activeTab === 'tasks' && (
                          <>
                            <td style={tdStyle}>
                              <div>{employeeNameOf(item)}</div>
                              <div style={subCellStyle}>{translateDepartment(item.employee?.department)}</div>
                            </td>
                            <td style={{ ...tdStyle, maxWidth: 320 }}>
                              <div className="truncate">
                                {isDemoMode() ? getDemoTaskTitle(item, t) : <TranslatedText text={item.title} />}
                              </div>
                              <div className="truncate" style={subCellStyle}>
                                {isDemoMode() ? getDemoTaskDescription(item, t) : <TranslatedText text={item.description} />}
                              </div>
                            </td>
                            <td style={tdStyle}>
                              <Tag ind={ind} variant={priorityVariant(item.priority)}>{translatePriority(item.priority)}</Tag>
                            </td>
                            <td style={tdStyle}>
                              <Tag ind={ind} variant={statusVariant(item.status)}>{translateStatus(item.status)}</Tag>
                            </td>
                            <td style={{ ...tdStyle, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>{item.due_date || '—'}</td>
                          </>
                        )}

                        {activeTab === 'goals' && (
                          <>
                            <td style={tdStyle}>
                              <div>{employeeNameOf(item)}</div>
                              <div style={subCellStyle}>{translateDepartment(item.employee?.department)}</div>
                            </td>
                            <td style={{ ...tdStyle, maxWidth: 320 }}>
                              <div className="truncate">
                                {isDemoMode() ? getDemoGoalTitle(item, t) : <TranslatedText text={item.title} />}
                              </div>
                              <div className="truncate" style={subCellStyle}>
                                {isDemoMode() ? getDemoGoalDescription(item, t) : <TranslatedText text={item.description} />}
                              </div>
                            </td>
                            <td style={tdStyle}>{translateCategory(item.category)}</td>
                            <td style={tdStyle}>
                              <Tag ind={ind} variant={statusVariant(item.status)}>{translateStatus(item.status)}</Tag>
                            </td>
                            <td style={{ ...tdStyle, minWidth: 150 }}>
                              <div className="flex items-center" style={{ gap: 8 }}>
                                <div style={{ flex: 1, minWidth: 60 }}>
                                  <Bar
                                    ind={ind}
                                    value={Math.min(item.status === 'completed' ? 100 : (item.progress || 0), 100) / 100}
                                    fill={rampAt(ind, item.status === 'completed' ? 0 : 2)}
                                    height={6}
                                  />
                                </div>
                                <span style={{ fontFamily: DISPLAY, fontWeight: 600, fontSize: 12.5, fontVariantNumeric: 'tabular-nums', flex: 'none' }}>
                                  <NumberTicker value={item.status === 'completed' ? 100 : (item.progress || 0)} />%
                                </span>
                              </div>
                            </td>
                          </>
                        )}

                        {activeTab === 'leave' && (
                          <>
                            <td style={tdStyle}>
                              <div>{employeeNameOf(item)}</div>
                              <div style={subCellStyle}>{translateDepartment(item.employee?.department)}</div>
                            </td>
                            <td style={tdStyle}>
                              <Tag ind={ind} variant="neutral">
                                {t(`timeTracking.${item.leave_type === 'sick' ? 'sickLeave' : item.leave_type === 'personal' ? 'personal' : 'vacation'}`, item.leave_type)}
                              </Tag>
                            </td>
                            <td style={{ ...tdStyle, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
                              {`${(item.start_date || '').slice(0, 10)} → ${(item.end_date || item.start_date || '').slice(0, 10)}`}
                            </td>
                            <td style={{ ...tdStyle, fontFamily: DISPLAY, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                              {item.days_count ?? '—'}
                            </td>
                            <td style={tdStyle}>
                              <Tag ind={ind} variant={statusVariant(item.status)}>{translateStatus(item.status)}</Tag>
                            </td>
                          </>
                        )}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Ledger foot — the preview is capped; the export is not. */}
            <div
              className="flex flex-wrap items-center justify-between"
              style={{ gap: 10, padding: '10px 0', marginTop: 4, borderTop: `1px solid ${ind.hairline}` }}
            >
              <span style={{ fontFamily: BODY, fontSize: 11.5, color: ind.inkFaint }}>
                {currentData.length > 50
                  ? `${t('reports.showingFirst50of', 'Showing first 50 of')} ${currentData.length} ${t('reports.records', 'records')}`
                  : `${stats.totalRecords} ${t('reports.recordsFound', 'records found')}`}
              </span>
              {currentData.length > 50 && (
                <span style={{ fontFamily: BODY, fontSize: 11.5, color: ind.inkFaint }}>
                  {t('reports.exportForAll', 'Export to CSV to get all records.')}
                </span>
              )}
            </div>
          </Blueprint>
        </div>

        {/* ── RIGHT — the figures and the export, 340px ─────────────── */}
        <aside
          className="w-full lg:w-[340px] lg:shrink-0 flex flex-col"
          style={{ background: ind.chrome, overflow: 'hidden' }}
        >
          <div style={{ padding: '20px 20px 16px', borderBottom: `1px solid ${ind.hairline}` }}>
            <Kicker ind={ind}>{overviewBentoItems[0]?.description || t('reports.totalRecords', 'Total Records')}</Kicker>
            <div className="flex items-baseline" style={{ gap: 8, margin: '4px 0 0' }}>
              <span style={{ ...figure(52, ind.ink), lineHeight: 0.92 }}>
                <SlidingNumber value={Number(stats.totalRecords) || 0} />
              </span>
              <span style={{ fontFamily: BODY, fontSize: 12, color: ind.inkMuted }}>{activeTabLabel}</span>
            </div>
            <p style={columnNote}>{rangeLabel}</p>
          </div>

          {/* The rest of the same array the ticker renders. */}
          {overviewBentoItems.slice(1).map((item, index) => (
            <div
              key={`${item.label}-${index}`}
              className="flex items-baseline justify-between"
              style={{ gap: 12, padding: '11px 20px', borderBottom: `1px solid ${ind.rule}` }}
            >
              <span style={{ fontFamily: BODY, fontSize: 12.5, color: ind.inkMuted, minWidth: 0 }}>
                {item.description}
              </span>
              <span
                style={{
                  fontFamily: DISPLAY, fontWeight: 600, fontSize: 14, color: ind.ink,
                  fontVariantNumeric: 'tabular-nums', flex: 'none',
                }}
              >
                {typeof item.value === 'number' ? <SlidingNumber value={item.value} /> : item.title}
                {item.suffix}
              </span>
            </div>
          ))}

          {/* Export — the only place on the screen that writes a file. */}
          <div style={{ padding: '18px 20px 12px', marginTop: 6, borderBottom: `1px solid ${ind.hairline}` }}>
            <ColumnHeading ind={ind}>{t('reports.export', 'Export')}</ColumnHeading>
            <p style={columnNote}>
              {t('reports.exportScopeNote', 'Exports carry every filtered record, not just the 50 previewed.')}
            </p>
          </div>

          <div style={{ padding: '14px 20px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[
              {
                key: 'csv',
                onClick: exportAllToCSV,
                label: t('reports.exportToCSV', 'Export to CSV'),
                title: t('reports.exportingIncludes', 'Exporting will include all filtered data, not just previewed records'),
                Icon: Download,
                primary: true,
              },
              {
                key: 'excel',
                onClick: exportToExcel,
                label: t('reports.exportToExcel', 'Export to Excel'),
                title: t('reports.excelExportHint', 'Export all data types with summary, charts, and detailed sheets'),
                Icon: FileText,
                primary: false,
              },
              {
                key: 'pdf',
                onClick: exportToPDF,
                label: t('reports.exportToPDF', 'Export to PDF'),
                title: t('reports.pdfExportHint', 'Export PDF with visual charts, summary, and detailed tables for all data types'),
                Icon: FileText,
                primary: false,
              },
            ].map((action) => {
              const ActionIcon = action.Icon;
              return (
                /* Kept as SpecularButtons — the sheen is what marks the three
                   actions that leave the app. Re-skinned, not stripped. */
                <SpecularButton
                  key={action.key}
                  type="button"
                  onClick={action.onClick}
                  disabled={exporting}
                  shineOnHover
                  title={action.title}
                  className={cn('w-full rounded-none border px-3 py-1.5')}
                  style={{
                    borderRadius: 0,
                    background: action.primary ? ind.accent : 'transparent',
                    color: action.primary ? ind.accentInk : ind.ink,
                    borderColor: action.primary ? ind.accent : ind.hairline,
                    opacity: exporting ? 0.5 : 1,
                    cursor: exporting ? 'not-allowed' : 'pointer',
                  }}
                >
                  {exporting
                    ? <Loader2 size={13} strokeWidth={1.5} className="animate-spin" />
                    : <ActionIcon size={13} strokeWidth={1.5} style={{ opacity: 0.8 }} />}
                  <span style={{ fontFamily: DISPLAY, fontWeight: 600, fontSize: 12.5, letterSpacing: '.04em', textTransform: 'uppercase' }}>
                    {action.label}
                  </span>
                </SpecularButton>
              );
            })}
          </div>

          {selectedEmployee !== 'all' && (
            <div style={{ padding: '0 20px 18px' }}>
              <p style={{ ...columnNote, margin: 0 }}>
                {t('reports.exportingIncludes', 'Exporting will include this employee\'s detailed performance report')}
              </p>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
};

export default Reports;
