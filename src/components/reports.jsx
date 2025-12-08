import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useLanguage, SUPPORTED_LANGUAGES } from "../contexts/LanguageContext";
import { useTheme } from "../contexts/ThemeContext";
import { useAuth } from '../contexts/AuthContext';
import { useVisibilityRefresh } from '../hooks/useVisibilityRefresh';
import { isDemoMode, getDemoEmployeeName, getDemoTaskTitle, getDemoTaskDescription, getDemoGoalTitle, getDemoGoalDescription } from '../utils/demoHelper';
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
  PenOff,
  Apple, 
  Hourglass,
  FileText,
  Database,
  Loader
} from 'lucide-react';
import * as XLSX from 'xlsx';
import ExcelJS from 'exceljs';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import html2canvas from 'html2canvas';
import timeTrackingService from '../services/timeTrackingService';
import { getAllTasks } from '../services/workloadService';
import performanceService from '../services/performanceService';
import { supabase } from '../config/supabaseClient';

const Reports = () => {
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
  const [exporting, setExporting] = useState(false);
  const [activeTab, setActiveTab] = useState('all');
  const [selectedEmployee, setSelectedEmployee] = useState('all');
  const [dateRange, setDateRange] = useState('this-month');
  const [filters, setFilters] = useState({
    startDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0]
  });

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
        break;
      case 'this-month':
        startDate = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
        break;
      case 'last-month':
        const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        startDate = lastMonth.toISOString().split('T')[0];
        endDate = new Date(today.getFullYear(), today.getMonth(), 0).toISOString().split('T')[0];
        break;
      case 'this-quarter':
        const quarter = Math.floor(today.getMonth() / 3);
        startDate = new Date(today.getFullYear(), quarter * 3, 1).toISOString().split('T')[0];
        break;
      case 'this-year':
        startDate = new Date(today.getFullYear(), 0, 1).toISOString().split('T')[0];
        break;
      default:
    
        return;
    }

    if (dateRange !== 'custom') {
      setFilters({ startDate, endDate });
    }
  }, [dateRange]);

  // Fetch data when filters change
  useEffect(() => {
    // Only fetch if employees are loaded
    if (reportData.employees.length > 0) {
      fetchReportData();
    }
  }, [filters, selectedEmployee, activeTab, reportData.employees]);

  const fetchReportData = async () => {
    setLoading(true);
    try {
      const { startDate, endDate } = filters;
      // Don't parse as int - IDs might be UUIDs
      const employeeId = selectedEmployee === 'all' ? null : selectedEmployee;
      
      console.log('Fetching data for:', { selectedEmployee, employeeId, activeTab, startDate, endDate });

      // Fetch Time Entries (for 'all' or 'time-entries' tab)
      if (activeTab === 'all' || activeTab === 'time-entries') {
        let allTimeEntries = [];
        let error = null;

        if (isDemoMode()) {
          allTimeEntries = [
            {
              id: 'mock-entry-1',
              employee_id: 'demo-emp-1',
              date: startDate,
              clock_in: '09:00:00',
              clock_out: '17:00:00',
              total_hours: 8,
              status: 'approved',
              employee: { id: 'demo-emp-1', name: 'Demo Admin', nameKey: 'demoEmployees.demo-emp-1.name', department: 'technology', position: 'senior_developer' }
            },
            {
              id: 'mock-entry-2',
              employee_id: 'demo-emp-2',
              date: startDate,
              clock_in: '08:30:00',
              clock_out: '17:30:00',
              total_hours: 9,
              status: 'approved',
              employee: { id: 'demo-emp-2', name: 'Sarah Connor', nameKey: 'demoEmployees.demo-emp-2.name', department: 'human_resources', position: 'manager' }
            }
          ];
        } else {
          // Use direct Supabase query with proper join - fetch all entries first
          const result = await supabase
            .from('time_entries')
            .select(`
              *,
              employee:employees!time_entries_employee_id_fkey(id, name, department, position)
            `)
            .gte('date', startDate)
            .lte('date', endDate)
            .order('date', { ascending: false });
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
    } catch (error) {
      console.error('Error fetching report data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Memoize fetchReportData for use in visibility hook
  const memoizedFetchReportData = useCallback(() => {
    if (reportData.employees.length > 0) {
      fetchReportData();
    }
  }, [filters, selectedEmployee, activeTab, reportData.employees]);

  // Use visibility refresh hook to reload data when page becomes visible after idle
  useVisibilityRefresh(memoizedFetchReportData, {
    staleTime: 120000, // 2 minutes - refresh if data is older than this
    refreshOnFocus: true,
    refreshOnOnline: true
  });

  // Get current data based on active tab
  const currentData = useMemo(() => {
    switch (activeTab) {
      case 'all':
        return {
          timeEntries: reportData.timeEntries,
          tasks: reportData.tasks,
          goals: reportData.goals
        };
      case 'time-entries':
        return reportData.timeEntries;
      case 'tasks':
        return reportData.tasks;
      case 'goals':
        return reportData.goals;
      default:
        return [];
    }
  }, [activeTab, reportData]);

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

  // CSV Export function
  const exportToCSV = (data, filename, headers) => {
    try {
      const languageName = SUPPORTED_LANGUAGES[currentLanguage]?.name || 'English';
      const csvContent = [
        // Add metadata row
        `"${t('reports.language', 'Report Language')}: ${languageName}"`,
        `"${t('reports.generated', 'Generated')}: ${new Date().toLocaleString()}"`,
        '', // Empty row for separation
        // Add headers
        headers.map(header => {
          // Escape and quote header if needed
          return typeof header === 'string' && (header.includes(',') || header.includes('"')) 
            ? `"${header.replace(/"/g, '""')}"` 
            : header;
        }).join(','),
        // Add data rows
        ...data.map(row => 
          headers.map(header => {
            const value = row[header] || '';
            // Escape quotes and wrap in quotes if contains comma or quotes
            return typeof value === 'string' && (value.includes(',') || value.includes('"')) 
              ? `"${value.replace(/"/g, '""')}"` 
              : value;
          }).join(',')
        )
      ].join('\n');

      const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
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
        [t('employees.name', 'Employee Name')]: isDemoMode() ? getDemoEmployeeName(entry.employee, t) : (entry.employee?.name || 'Unknown'),
        [t('employees.department', 'Department')]: translateDepartment(entry.employee?.department) || '',
        [t('employees.position', 'Position')]: translatePosition(entry.employee?.position) || '',
        [t('timeTracking.date', 'Date')]: entry.date,
        [t('timeTracking.clockIn', 'Clock In')]: entry.clock_in || '',
        [t('timeTracking.clockOut', 'Clock Out')]: entry.clock_out || '',
        [t('timeTracking.amountHours', 'Hours')]: entry.hours || 0,
        [t('timeTracking.hourType', 'Hour Type')]: translateHourType(entry.hour_type) || '',
        [t('timeTracking.status', 'Status')]: translateStatus(entry.status) || '',
        [t('timeTracking.notes', 'Notes')]: translateNotes(entry.notes) || '',
        [t('timeTracking.createdAt', 'Created At')]: new Date(entry.created_at).toLocaleString()
      }));

      const employeeName = selectedEmployee !== 'all' ? 
        `_${reportData.employees.find(emp => String(emp.id) === String(selectedEmployee))?.name?.replace(/\s+/g, '_')}` : 
        '';
      
      const reportType = t('reports.timeEntries', 'Time Entries').replace(/\s+/g, '_');
      const filename = `${reportType}${employeeName}_${filters.startDate}_to_${filters.endDate}_${currentLanguage.toUpperCase()}.csv`;
      const headers = Object.keys(exportData[0] || {});
      
      exportToCSV(exportData, filename, headers);
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
        [t('employees.name', 'Employee Name')]: isDemoMode() ? getDemoEmployeeName(task.employee, t) : (task.employee?.name || 'Unknown'),
        [t('employees.department', 'Department')]: translateDepartment(task.employee?.department) || '',
        [t('taskListing.taskTitle', 'Task Title')]: isDemoMode() ? getDemoTaskTitle(task, t) : (task.title || ''),
        [t('taskListing.description', 'Description')]: isDemoMode() ? getDemoTaskDescription(task, t) : (task.description || ''),
        [t('taskListing.priority', 'Priority')]: translatePriority(task.priority) || '',
        [t('taskListing.status', 'Status')]: translateStatus(task.status) || '',
        [t('taskListing.dueDate', 'Due Date')]: task.due_date || '',
        [t('taskListing.completionDate', 'Completion Date')]: task.completion_date || '',
        [t('taskListing.createdAt', 'Created At')]: new Date(task.created_at).toLocaleString(),
        [t('taskListing.updatedAt', 'Updated At')]: new Date(task.updated_at).toLocaleString()
      }));

      const employeeName = selectedEmployee !== 'all' ? 
        `_${reportData.employees.find(emp => String(emp.id) === String(selectedEmployee))?.name?.replace(/\s+/g, '_')}` : 
        '';
      
      const reportType = t('reports.tasks', 'Tasks').replace(/\s+/g, '_');
      const filename = `${reportType}${employeeName}_${filters.startDate}_to_${filters.endDate}_${currentLanguage.toUpperCase()}.csv`;
      const headers = Object.keys(exportData[0] || {});
      
      exportToCSV(exportData, filename, headers);
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
        [t('employees.name', 'Employee Name')]: isDemoMode() ? getDemoEmployeeName(goal.employee, t) : (goal.employee?.name || 'Unknown'),
        [t('employees.department', 'Department')]: translateDepartment(goal.employee?.department) || '',
        [t('taskReview.goalTitle', 'Goal Title')]: isDemoMode() ? getDemoGoalTitle(goal, t) : (goal.title || ''),
        [t('taskReview.description', 'Description')]: isDemoMode() ? getDemoGoalDescription(goal, t) : (goal.description || ''),
        [t('taskReview.category', 'Category')]: translateCategory(goal.category) || '',
        [t('taskReview.targetDate', 'Target Date')]: goal.target_date || '',
        [t('taskReview.status', 'Status')]: translateStatus(goal.status) || '',
        [t('taskReview.progress', 'Progress')]: goal.progress || 0,
        [t('taskReview.notes', 'Notes')]: goal.notes || '',
        [t('taskReview.createdAt', 'Created At')]: new Date(goal.created_at).toLocaleString(),
        [t('taskReview.updatedAt', 'Updated At')]: new Date(goal.updated_at).toLocaleString()
      }));

      const employeeName = selectedEmployee !== 'all' ? 
        `_${reportData.employees.find(emp => String(emp.id) === String(selectedEmployee))?.name?.replace(/\s+/g, '_')}` : 
        '';
      
      const reportType = t('reports.personalGoals', 'Personal Goals').replace(/\s+/g, '_');
      const filename = `${reportType}${employeeName}_${filters.startDate}_to_${filters.endDate}_${currentLanguage.toUpperCase()}.csv`;
      const headers = Object.keys(exportData[0] || {});
      
      exportToCSV(exportData, filename, headers);
    } catch (error) {
      console.error('Error exporting goals:', error);
      alert(t('reports.errorExporting', 'Error exporting data'));
    } finally {
      setExporting(false);
    }
  };

  // Enhanced Excel Export with Metrics, Embedded Charts, and Styled Tables
  const exportToExcel = async () => {
    setExporting(true);
    try {
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

      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'HR Management System';
      workbook.created = new Date();
      
      // Employee name for filename
      const employeeName = selectedEmployee !== 'all' ? 
        reportData.employees.find(emp => String(emp.id) === String(selectedEmployee))?.name?.replace(/\s+/g, '_') : 
        'All_Employees';

      // ==================== SUMMARY/METRICS SHEET WITH STYLING ====================
      const summarySheet = workbook.addWorksheet('Summary', {
        views: [{ state: 'frozen', xSplit: 0, ySplit: 1 }]
      });
      
      // Header styling
      summarySheet.getCell('A1').value = 'HR REPORT SUMMARY';
      summarySheet.getCell('A1').font = { size: 16, bold: true, color: { argb: 'FFFFFFFF' } };
      summarySheet.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } };
      summarySheet.getCell('A1').alignment = { horizontal: 'center', vertical: 'middle' };
      summarySheet.mergeCells('A1:B1');
      summarySheet.getRow(1).height = 30;
      
      // Report Info
      let currentRow = 3;
      summarySheet.getCell(`A${currentRow}`).value = 'Generated:';
      summarySheet.getCell(`B${currentRow}`).value = new Date().toLocaleString();
      summarySheet.getCell(`A${currentRow}`).font = { bold: true };
      currentRow++;
      
      summarySheet.getCell(`A${currentRow}`).value = 'Date Range:';
      summarySheet.getCell(`B${currentRow}`).value = `${filters.startDate} to ${filters.endDate}`;
      summarySheet.getCell(`A${currentRow}`).font = { bold: true };
      currentRow++;
      
      summarySheet.getCell(`A${currentRow}`).value = 'Employee:';
      summarySheet.getCell(`B${currentRow}`).value = selectedEmployee === 'all' ? 'All Employees' : employeeName;
      summarySheet.getCell(`A${currentRow}`).font = { bold: true };
      currentRow++;
      
      const languageName = SUPPORTED_LANGUAGES[currentLanguage]?.name || 'English';
      summarySheet.getCell(`A${currentRow}`).value = 'Report Language:';
      summarySheet.getCell(`B${currentRow}`).value = languageName;
      summarySheet.getCell(`A${currentRow}`).font = { bold: true };
      currentRow += 2;
      
      // Time Entries Metrics with Styling
      if (reportData.timeEntries.length > 0) {
        const totalHours = reportData.timeEntries.reduce((sum, entry) => sum + (entry.hours || 0), 0);
        const regularHours = reportData.timeEntries.filter(e => e.hour_type === 'regular').reduce((sum, e) => sum + (e.hours || 0), 0);
        // Include both overtime and bonus as overtime hours
        const overtimeHours = reportData.timeEntries.filter(e => e.hour_type === 'overtime' || e.hour_type === 'bonus').reduce((sum, e) => sum + (e.hours || 0), 0);
        const wfhHours = reportData.timeEntries.filter(e => e.hour_type === 'wfh').reduce((sum, e) => sum + (e.hours || 0), 0);
        const pendingEntries = reportData.timeEntries.filter(e => e.status === 'pending').length;
        const approvedEntries = reportData.timeEntries.filter(e => e.status === 'approved').length;
        
        // Section Header
        summarySheet.getCell(`A${currentRow}`).value = 'TIME TRACKING SUMMARY';
        summarySheet.getCell(`A${currentRow}`).font = { size: 12, bold: true, color: { argb: 'FFFFFFFF' } };
        summarySheet.getCell(`A${currentRow}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF70AD47' } };
        summarySheet.mergeCells(`A${currentRow}:B${currentRow}`);
        currentRow++;
        
        // Metrics
        const addMetric = (label, value, isNumeric = false) => {
          summarySheet.getCell(`A${currentRow}`).value = label;
          summarySheet.getCell(`B${currentRow}`).value = isNumeric ? toNumber(value) : sanitize(value);
          summarySheet.getCell(`A${currentRow}`).font = { bold: true };
          summarySheet.getCell(`B${currentRow}`).alignment = { horizontal: 'right' };
          currentRow++;
        };

        addMetric('Total Time Entries:', reportData.timeEntries.length, true);
        addMetric('Total Hours Logged:', totalHours, true);
        addMetric('Regular Hours:', regularHours, true);
        addMetric('Overtime Hours:', overtimeHours, true);
        addMetric('WFH Hours:', wfhHours, true);
        addMetric('Pending Approvals:', pendingEntries, true);
        addMetric('Approved Entries:', approvedEntries, true);
        currentRow++;
      }
      
      // Tasks Metrics with Styling
      if (reportData.tasks.length > 0) {
        const completedTasks = reportData.tasks.filter(t => t.status === 'completed').length;
        const inProgressTasks = reportData.tasks.filter(t => t.status === 'in_progress').length;
        const highPriority = reportData.tasks.filter(t => t.priority === 'high').length;
        const totalEstimated = reportData.tasks.reduce((sum, t) => sum + (t.estimated_hours || 0), 0);
        const totalActual = reportData.tasks.reduce((sum, t) => sum + (t.actual_hours || 0), 0);
        
        // Section Header
        summarySheet.getCell(`A${currentRow}`).value = 'WORKLOAD SUMMARY';
        summarySheet.getCell(`A${currentRow}`).font = { size: 12, bold: true, color: { argb: 'FFFFFFFF' } };
        summarySheet.getCell(`A${currentRow}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFC000' } };
        summarySheet.mergeCells(`A${currentRow}:B${currentRow}`);
        currentRow++;
        
        const addMetric = (label, value, isNumeric = false) => {
          summarySheet.getCell(`A${currentRow}`).value = label;
          summarySheet.getCell(`B${currentRow}`).value = isNumeric ? toNumber(value) : sanitize(value);
          summarySheet.getCell(`A${currentRow}`).font = { bold: true };
          summarySheet.getCell(`B${currentRow}`).alignment = { horizontal: 'right' };
          currentRow++;
        };

        addMetric('Total Tasks:', reportData.tasks.length, true);
        addMetric('Completed Tasks:', completedTasks, true);
        addMetric('In Progress:', inProgressTasks, true);
        addMetric('High Priority Tasks:', highPriority, true);
        addMetric('Estimated Hours:', totalEstimated, true);
        addMetric('Actual Hours:', totalActual, true);
        addMetric('Variance:', totalActual - totalEstimated, true);
        currentRow++;
      }
      
      // Goals Metrics with Styling
      if (reportData.goals.length > 0) {
        const completedGoals = reportData.goals.filter(g => g.status === 'completed').length;
        const inProgressGoals = reportData.goals.filter(g => g.status === 'in_progress').length;
        const avgProgress = (reportData.goals.reduce((sum, g) => sum + (g.status === 'completed' ? 100 : (g.progress || 0)), 0) / reportData.goals.length).toFixed(1);
        
        // Section Header
        summarySheet.getCell(`A${currentRow}`).value = 'GOALS SUMMARY';
        summarySheet.getCell(`A${currentRow}`).font = { size: 12, bold: true, color: { argb: 'FFFFFFFF' } };
        summarySheet.getCell(`A${currentRow}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF5B9BD5' } };
        summarySheet.mergeCells(`A${currentRow}:B${currentRow}`);
        currentRow++;
        
        const addMetric = (label, value, isNumeric = false) => {
          summarySheet.getCell(`A${currentRow}`).value = label;
          summarySheet.getCell(`B${currentRow}`).value = isNumeric ? toNumber(value) : sanitize(value);
          summarySheet.getCell(`A${currentRow}`).font = { bold: true };
          summarySheet.getCell(`B${currentRow}`).alignment = { horizontal: 'right' };
          currentRow++;
        };

        addMetric('Total Goals:', reportData.goals.length, true);
        addMetric('Completed Goals:', completedGoals, true);
        addMetric('In Progress:', inProgressGoals, true);
        addMetric('Average Progress:', parseFloat(avgProgress) || 0, true);
      }

      // Set column widths for summary sheet
      summarySheet.getColumn(1).width = 30;
      summarySheet.getColumn(2).width = 20;
      // Format second column for numbers (metrics)
      summarySheet.getColumn(2).numFmt = '#,##0.00';

      // ==================== INDIVIDUAL EMPLOYEE PERFORMANCE SHEET ====================
      if (selectedEmployee !== 'all') {
        const employee = reportData.employees.find(emp => String(emp.id) === String(selectedEmployee));
        if (employee) {
          const perfSheet = workbook.addWorksheet('Employee Performance');
          
          // Header
          perfSheet.getCell('A1').value = `${getDemoEmployeeName(employee, t).toUpperCase()} - PERFORMANCE REPORT`;
          perfSheet.getCell('A1').font = { size: 16, bold: true, color: { argb: 'FFFFFFFF' } };
          perfSheet.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0070C0' } };
          perfSheet.getCell('A1').alignment = { horizontal: 'center', vertical: 'middle' };
          perfSheet.mergeCells('A1:D1');
          perfSheet.getRow(1).height = 35;
          
          let perfRow = 3;
          
          // Employee Info Section
          perfSheet.getCell(`A${perfRow}`).value = 'EMPLOYEE INFORMATION';
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
          
          addInfo('Name:', getDemoEmployeeName(employee, t));
          addInfo('Department:', translateDepartment(employee.department));
          addInfo('Position:', translatePosition(employee.position));
          addInfo('Email:', employee.email || 'N/A');
          addInfo('Report Period:', `${filters.startDate} to ${filters.endDate}`);
          perfRow++;
          
          // Performance Metrics Section
          const employeeTimeEntries = reportData.timeEntries.filter(e => e.employee_id === employee.id);
          const employeeTasks = reportData.tasks.filter(t => t.employee_id === employee.id);
          const employeeGoals = reportData.goals.filter(g => g.employee_id === employee.id);
          
          perfSheet.getCell(`A${perfRow}`).value = 'PERFORMANCE METRICS';
          perfSheet.getCell(`A${perfRow}`).font = { size: 12, bold: true, color: { argb: 'FFFFFFFF' } };
          perfSheet.getCell(`A${perfRow}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF70AD47' } };
          perfSheet.mergeCells(`A${perfRow}:D${perfRow}`);
          perfRow++;
          
          // Metrics table header
          ['Metric', 'Value', 'Status', 'Notes'].forEach((header, idx) => {
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
          
          const addMetric = (metric, value, status, notes) => {
            perfSheet.getCell(`A${perfRow}`).value = metric;
            perfSheet.getCell(`B${perfRow}`).value = value;
            perfSheet.getCell(`C${perfRow}`).value = status;
            perfSheet.getCell(`D${perfRow}`).value = notes;
            perfSheet.getCell(`B${perfRow}`).alignment = { horizontal: 'right' };
            perfRow++;
          };
          
          addMetric('Total Hours Logged', totalHours.toFixed(1), totalHours > 160 ? '⚠️ High' : '✅ Normal', `${employeeTimeEntries.length} entries`);
          addMetric('Regular Hours', regularHours.toFixed(1), '✅ Tracked', `${(regularHours/totalHours*100).toFixed(0)}% of total`);
          addMetric('Overtime Hours', overtimeHours.toFixed(1), overtimeHours > 20 ? '⚠️ High' : '✅ Normal', `${(overtimeHours/totalHours*100).toFixed(0)}% of total`);
          addMetric('WFH Hours', wfhHours.toFixed(1), '✅ Tracked', `${totalHours > 0 ? (wfhHours/totalHours*100).toFixed(0) : 0}% of total`);
          addMetric('Approval Rate', `${approvedEntries}/${employeeTimeEntries.length}`, approvedEntries === employeeTimeEntries.length ? '✅ All Approved' : '⏳ Pending', `${((approvedEntries/employeeTimeEntries.length)*100).toFixed(0)}%`);
          perfRow++;
          
          // Task Performance
          const completedTasks = employeeTasks.filter(t => t.status === 'completed').length;
          const taskCompletionRate = employeeTasks.length > 0 ? ((completedTasks / employeeTasks.length) * 100).toFixed(1) : 0;
          
          addMetric('Total Tasks', employeeTasks.length, employeeTasks.length > 0 ? '✅ Active' : '⚠️ No Tasks', `${completedTasks} completed`);
          addMetric('Task Completion Rate', `${taskCompletionRate}%`, taskCompletionRate >= 80 ? '✅ Excellent' : taskCompletionRate >= 60 ? '⚠️ Good' : '❌ Needs Improvement', `${completedTasks}/${employeeTasks.length} done`);
          perfRow++;
          
          // Goals Performance
          const completedGoals = employeeGoals.filter(g => g.status === 'completed').length;
          const avgProgress = employeeGoals.length > 0 ? (employeeGoals.reduce((sum, g) => sum + (g.status === 'completed' ? 100 : (g.progress || 0)), 0) / employeeGoals.length).toFixed(1) : 0;
          
          addMetric('Total Goals', employeeGoals.length, employeeGoals.length > 0 ? '✅ Set' : '⚠️ No Goals', `${completedGoals} completed`);
          addMetric('Average Goal Progress', `${avgProgress}%`, avgProgress >= 75 ? '✅ On Track' : avgProgress >= 50 ? '⚠️ Progressing' : '❌ Behind', `${employeeGoals.length} goals tracked`);
          perfRow += 2;
          
          // Performance Summary
          perfSheet.getCell(`A${perfRow}`).value = 'OVERALL PERFORMANCE RATING';
          perfSheet.getCell(`A${perfRow}`).font = { size: 12, bold: true, color: { argb: 'FFFFFFFF' } };
          perfSheet.getCell(`A${perfRow}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFC000' } };
          perfSheet.mergeCells(`A${perfRow}:D${perfRow}`);
          perfRow++;
          
          // Calculate overall score
          const timeScore = Math.min(100, (approvedEntries / Math.max(1, employeeTimeEntries.length)) * 100);
          const taskScore = parseFloat(taskCompletionRate);
          const goalScore = parseFloat(avgProgress);
          const overallScore = ((timeScore + taskScore + goalScore) / 3).toFixed(1);
          
          perfSheet.getCell(`A${perfRow}`).value = 'Overall Performance Score:';
          perfSheet.getCell(`B${perfRow}`).value = `${overallScore}%`;
          perfSheet.getCell(`A${perfRow}`).font = { bold: true, size: 14 };
          perfSheet.getCell(`B${perfRow}`).font = { bold: true, size: 16, color: { argb: overallScore >= 80 ? 'FF00B050' : overallScore >= 60 ? 'FFFFC000' : 'FFFF0000' } };
          perfSheet.getCell(`B${perfRow}`).alignment = { horizontal: 'center' };
          perfSheet.mergeCells(`B${perfRow}:D${perfRow}`);
          perfRow++;
          
          perfSheet.getCell(`A${perfRow}`).value = 'Rating:';
          const rating = overallScore >= 90 ? '⭐⭐⭐⭐⭐ Outstanding' : overallScore >= 80 ? '⭐⭐⭐⭐ Excellent' : overallScore >= 70 ? '⭐⭐⭐ Good' : overallScore >= 60 ? '⭐⭐ Satisfactory' : '⭐ Needs Improvement';
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

      // ==================== CHARTS SHEET WITH DATA ====================
      if (reportData.timeEntries.length > 0 || reportData.tasks.length > 0) {
        const chartsSheet = workbook.addWorksheet('Charts & Metrics');
        
        let chartRow = 1;
        
        // Hours by Type Chart Data
        if (reportData.timeEntries.length > 0) {
          chartsSheet.getCell(`A${chartRow}`).value = 'HOURS BY TYPE';
          chartsSheet.getCell(`A${chartRow}`).font = { size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
          chartsSheet.getCell(`A${chartRow}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } };
          chartsSheet.mergeCells(`A${chartRow}:B${chartRow}`);
          chartRow++;
          
          chartsSheet.getCell(`A${chartRow}`).value = 'Type';
          chartsSheet.getCell(`B${chartRow}`).value = 'Hours';
          chartsSheet.getRow(chartRow).font = { bold: true };
          chartsSheet.getRow(chartRow).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9E1F2' } };
          chartRow++;
          
          const hoursByType = {};
          reportData.timeEntries.forEach(entry => {
            const type = entry.hour_type || 'unknown';
            hoursByType[type] = (hoursByType[type] || 0) + (entry.hours || 0);
          });
          
          Object.entries(hoursByType).forEach(([type, hours]) => {
            chartsSheet.getCell(`A${chartRow}`).value = type;
            chartsSheet.getCell(`B${chartRow}`).value = parseFloat(hours.toFixed(2));
            chartRow++;
          });
          chartRow += 2;
          
          // Status Distribution
          chartsSheet.getCell(`A${chartRow}`).value = 'STATUS DISTRIBUTION';
          chartsSheet.getCell(`A${chartRow}`).font = { size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
          chartsSheet.getCell(`A${chartRow}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF70AD47' } };
          chartsSheet.mergeCells(`A${chartRow}:B${chartRow}`);
          chartRow++;
          
          chartsSheet.getCell(`A${chartRow}`).value = 'Status';
          chartsSheet.getCell(`B${chartRow}`).value = 'Count';
          chartsSheet.getRow(chartRow).font = { bold: true };
          chartsSheet.getRow(chartRow).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9E1F2' } };
          chartRow++;
          
          const statusCounts = {};
          reportData.timeEntries.forEach(entry => {
            const status = entry.status || 'unknown';
            statusCounts[status] = (statusCounts[status] || 0) + 1;
          });
          
          Object.entries(statusCounts).forEach(([status, count]) => {
            chartsSheet.getCell(`A${chartRow}`).value = status;
            chartsSheet.getCell(`B${chartRow}`).value = count;
            chartRow++;
          });
          chartRow += 2;
        }
        
        // Task Metrics
        if (reportData.tasks.length > 0) {
          chartsSheet.getCell(`A${chartRow}`).value = 'TASK STATUS DISTRIBUTION';
          chartsSheet.getCell(`A${chartRow}`).font = { size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
          chartsSheet.getCell(`A${chartRow}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFC000' } };
          chartsSheet.mergeCells(`A${chartRow}:B${chartRow}`);
          chartRow++;
          
          chartsSheet.getCell(`A${chartRow}`).value = 'Status';
          chartsSheet.getCell(`B${chartRow}`).value = 'Count';
          chartsSheet.getRow(chartRow).font = { bold: true };
          chartsSheet.getRow(chartRow).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFE699' } };
          chartRow++;
          
          const taskStatus = {};
          reportData.tasks.forEach(task => {
            const status = task.status || 'unknown';
            taskStatus[status] = (taskStatus[status] || 0) + 1;
          });
          
          Object.entries(taskStatus).forEach(([status, count]) => {
            chartsSheet.getCell(`A${chartRow}`).value = status;
            chartsSheet.getCell(`B${chartRow}`).value = count;
            chartRow++;
          });
          chartRow += 2;
          
          // Task Priority
          chartsSheet.getCell(`A${chartRow}`).value = 'TASK PRIORITY DISTRIBUTION';
          chartsSheet.getCell(`A${chartRow}`).font = { size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
          chartsSheet.getCell(`A${chartRow}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFED7D31' } };
          chartsSheet.mergeCells(`A${chartRow}:B${chartRow}`);
          chartRow++;
          
          chartsSheet.getCell(`A${chartRow}`).value = 'Priority';
          chartsSheet.getCell(`B${chartRow}`).value = 'Count';
          chartsSheet.getRow(chartRow).font = { bold: true };
          chartsSheet.getRow(chartRow).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF4B084' } };
          chartRow++;
          
          const taskPriority = {};
          reportData.tasks.forEach(task => {
            const priority = task.priority || 'unknown';
            taskPriority[priority] = (taskPriority[priority] || 0) + 1;
          });
          
          Object.entries(taskPriority).forEach(([priority, count]) => {
            chartsSheet.getCell(`A${chartRow}`).value = priority;
            chartsSheet.getCell(`B${chartRow}`).value = count;
            chartRow++;
          });
        }
        
        // Set column widths
        chartsSheet.getColumn(1).width = 25;
        chartsSheet.getColumn(2).width = 15;
      }

      // ==================== TIME ENTRIES SHEET WITH STYLING ====================
      if (reportData.timeEntries.length > 0) {
        const timeEntriesSheet = workbook.addWorksheet('Time Entries');
        
        // Headers
        const headers = ['Employee', 'Department', 'Position', 'Date', 'Clock In', 'Clock Out', 'Hours', 'Hour Type', 'Status', 'Notes', 'Created At'];
        headers.forEach((header, idx) => {
          const cell = timeEntriesSheet.getCell(1, idx + 1);
          cell.value = header;
          cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } };
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
        });
        
        // Data rows with alternating colors
        reportData.timeEntries.forEach((entry, idx) => {
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
      if (reportData.tasks.length > 0) {
        const tasksSheet = workbook.addWorksheet('Tasks');
        
        // Headers
        const headers = ['Employee', 'Department', 'Task Title', 'Description', 'Priority', 'Status', 'Due Date', 'Estimated Hours', 'Actual Hours', 'Variance', 'Created At'];
        headers.forEach((header, idx) => {
          const cell = tasksSheet.getCell(1, idx + 1);
          cell.value = header;
          cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFC000' } };
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
        });
        
        // Data rows with conditional formatting
        reportData.tasks.forEach((task, idx) => {
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
            task.estimated_hours || 0,
            task.actual_hours || 0,
            variance,
            new Date(task.created_at).toLocaleString()
          ];
          
          rowData.forEach((value, colIdx) => {
            const cell = tasksSheet.getCell(rowNum, colIdx + 1);
            cell.value = value;
            
            // Center align specific columns: Priority(5), Status(6), Due Date(7), Estimated(8), Actual(9), Variance(10)
            if ([4, 5, 6, 7, 8, 9].includes(colIdx)) {
              cell.alignment = { horizontal: 'center', vertical: 'middle' };
            }
            
            // Alternating row colors
            if (idx % 2 === 0) {
              cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFF0' } };
            }
            
            // Highlight variance column with colors
            if (colIdx === 9) { // Variance column
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
          { width: 12 }, { width: 12 }, { width: 12 }, { width: 12 },
          { width: 12 }, { width: 12 }, { width: 20 }
        ];
        
        // Freeze header row
        tasksSheet.views = [{ state: 'frozen', xSplit: 0, ySplit: 1 }];
      }

      // ==================== GOALS SHEET WITH STYLING ====================
      if (reportData.goals.length > 0) {
        const goalsSheet = workbook.addWorksheet('Goals');
        
        // Headers
        const headers = ['Employee', 'Department', 'Goal Title', 'Description', 'Category', 'Status', 'Progress (%)', 'Target Date', 'Notes', 'Created At', 'Updated At'];
        headers.forEach((header, idx) => {
          const cell = goalsSheet.getCell(1, idx + 1);
          cell.value = header;
          cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF5B9BD5' } };
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
        });
        
        // Data rows with progress bar visualization
        reportData.goals.forEach((goal, idx) => {
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
      const safeEmployee = sanitize(employeeName || 'All_Employees');
      const rawFilename = `${safeEmployee}_${filters.startDate}_to_${filters.endDate}_${currentLanguage.toUpperCase()}.xlsx`;
      const filename = encodeURIComponent(rawFilename);
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
    
    // If Unicode font is loaded, return text with minimal cleaning
    if (unicodeFont) {
      // Only remove control characters and zero-width characters
      let cleaned = String(text)
        .replace(/[\u200B-\u200D\uFEFF\u0000-\u001F\u007F-\u009F]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
      return cleaned || 'N/A';
    }
    
    // Fallback: Full sanitization for Helvetica font
    // Special character mapping for Vietnamese and other diacritics
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
    
    // Convert to string first
    let cleaned = String(text);
    
    // Step 1: Apply character map for known characters
    cleaned = cleaned.split('').map(char => charMap[char] || char).join('');
    
    // Step 2: Normalize to NFD (decomposed form) to separate base characters from diacritics
    cleaned = cleaned.normalize('NFD');
    
    // Step 3: Remove combining diacritical marks
    cleaned = cleaned.replace(/[\u0300-\u036f]/g, '');
    
    // Step 4: Handle any remaining non-ASCII characters that might cause issues
    // Keep only printable ASCII characters (32-126), digits, and common punctuation
    cleaned = cleaned.replace(/[^\x20-\x7E]/g, (match) => {
      // If character is in our map, use the mapped value
      if (charMap[match]) return charMap[match];
      // Otherwise, try to get the base character or remove it
      const base = match.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      return base !== match ? base : '';
    });
    
    // Step 5: Remove zero-width characters and control characters
    cleaned = cleaned.replace(/[\u200B-\u200D\uFEFF\u0000-\u001F\u007F-\u009F]/g, '');
    
    // Step 6: Clean up excessive spaces
    cleaned = cleaned.replace(/\s+/g, ' ').trim();
    
    // Step 7: Ensure no empty result - return a placeholder if needed
    return cleaned || 'N/A';
  };

  // Helper function to translate hour types
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
    // Check if notes starts with "Entered by admin:"
    const adminPrefix = 'Entered by admin:';
    if (notes.startsWith(adminPrefix)) {
      const translatedPrefix = t('timeTracking.enteredByAdmin', 'Entered by admin:');
      return notes.replace(adminPrefix, translatedPrefix);
    }
    return notes;
  };

  // PDF Export with Charts and Tables
  const exportToPDF = async () => {
    setExporting(true);
    try {
      const doc = new jsPDF('p', 'mm', 'a4');
      
      // ENHANCED: Language-specific font loading for proper Unicode support
      let unicodeFontLoaded = false;
      
      // Determine which font to load based on current language
      const getFontUrlForLanguage = (lang) => {
        switch (lang) {
          case 'jp':
            return {
              primary: 'https://cdn.jsdelivr.net/gh/googlefonts/noto-cjk/NotoSansJP-Regular.otf',
              fallback: 'https://fonts.gstatic.com/s/notosansjp/v52/-F6jfjtqLzI2JPCgQBnw7HFyzSD-AsregP8VFBEi75vY0rw-oME.woff2',
              name: 'Noto Sans JP'
            };
          case 'kr':
            return {
              primary: 'https://cdn.jsdelivr.net/gh/googlefonts/noto-cjk/NotoSansKR-Regular.otf',
              fallback: 'https://fonts.gstatic.com/s/notosanskr/v36/PbyxFmXiEBPT4ITbgNA5Cgms3VYcOA-vvnIzzuoyeLTq8H4hfeE.woff2',
              name: 'Noto Sans KR'
            };
          case 'th':
            return {
              primary: 'https://cdn.jsdelivr.net/gh/googlefonts/noto-fonts@main/hinted/ttf/NotoSansThai/NotoSansThai-Regular.ttf',
              fallback: 'https://fonts.gstatic.com/s/notosansthai/v20/iJWnBXeUZi_OHPqn4wq6hQ2_hbJ1xyN9wd43SofNWcd1MKVQt_So_9CdU5RtpzF-QRvzzXg.woff2',
              name: 'Noto Sans Thai'
            };
          case 'ru':
            return {
              primary: 'https://cdn.jsdelivr.net/gh/googlefonts/noto-fonts@main/hinted/ttf/NotoSans/NotoSans-Regular.ttf',
              fallback: 'https://fonts.gstatic.com/s/notosans/v30/o-0IIpQlx3QUlC5A4PNr5TRG.ttf',
              name: 'Noto Sans'
            };
          case 'vn':
          case 'en':
          case 'de':
          case 'fr':
          case 'es':
          default:
            return {
              primary: 'https://cdn.jsdelivr.net/gh/googlefonts/noto-fonts@main/hinted/ttf/NotoSans/NotoSans-Regular.ttf',
              fallback: 'https://fonts.gstatic.com/s/notosans/v30/o-0IIpQlx3QUlC5A4PNr5TRG.ttf',
              name: 'Noto Sans'
            };
        }
      };
      
      const fontConfig = getFontUrlForLanguage(currentLanguage);
      
      try {
        console.log(`Loading ${fontConfig.name} for language: ${currentLanguage}`);
        
        // Try loading primary font URL
        const fontResponse = await fetch(fontConfig.primary);
        if (!fontResponse.ok) throw new Error('Primary font fetch failed');
        
        const fontData = await fontResponse.arrayBuffer();
        const base64Font = btoa(
          new Uint8Array(fontData).reduce((data, byte) => data + String.fromCharCode(byte), '')
        );
        
        doc.addFileToVFS('NotoSans-Regular.ttf', base64Font);
        doc.addFont('NotoSans-Regular.ttf', 'NotoSans', 'normal');
        doc.setFont('NotoSans');
        unicodeFontLoaded = true;
        
        console.log(`✓ ${fontConfig.name} loaded successfully for PDF export`);
      } catch (fontError) {
        console.warn(`Failed to load ${fontConfig.name} from primary CDN, trying fallback...`, fontError);
        
        // Try fallback URL
        try {
          const fontResponse = await fetch(fontConfig.fallback);
          
          if (fontResponse.ok) {
            const fontData = await fontResponse.arrayBuffer();
            const base64Font = btoa(
              new Uint8Array(fontData).reduce((data, byte) => data + String.fromCharCode(byte), '')
            );
            
            doc.addFileToVFS('NotoSans.ttf', base64Font);
            doc.addFont('NotoSans.ttf', 'NotoSans', 'normal');
            doc.setFont('NotoSans');
            unicodeFontLoaded = true;
            
            console.log(`✓ ${fontConfig.name} loaded from fallback CDN`);
          }
        } catch (fallbackError) {
          console.warn('Fallback font also failed, using sanitization:', fallbackError);
        }
      }
      
      // If Unicode font fails to load, use helvetica with aggressive sanitization
      if (!unicodeFontLoaded) {
        doc.setFont('helvetica', 'normal');
        console.log('⚠ Using Helvetica with character sanitization (Unicode font unavailable)');
      }
      
      // Helper to get the correct font name for autoTable
      const getTableFont = () => unicodeFontLoaded ? 'NotoSans' : 'helvetica';
      
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      let yPosition = 20;

      // Employee name for filename - sanitize for safe filename
      const rawEmployeeName = selectedEmployee !== 'all' ? 
        reportData.employees.find(emp => String(emp.id) === String(selectedEmployee))?.name : 
        t('reports.allEmployees', 'All Employees');
      // Only sanitize filename if Unicode font failed to load, otherwise keep original
      const employeeName = unicodeFontLoaded ? 
        (rawEmployeeName || `${t('reports.allEmployees', '')}`).replace(/\s+/g, '_').replace(/[<>:"/\\|?*]/g, '_') :
        cleanTextForPDF(rawEmployeeName || `${t('reports.allEmployees', '')}`, false).replace(/\s+/g, '_');

      // Header
      doc.setFontSize(20);
      doc.setTextColor(40, 44, 52);
      doc.text(t('reports.performanceReport', 'HR PERFORMANCE REPORT').toUpperCase(), pageWidth / 2, yPosition, { align: 'center' });
      
      yPosition += 10;
      doc.setFontSize(10);
      doc.setTextColor(100, 100, 100);
      doc.text(`${t('reports.generated', 'Generated')}: ${new Date().toLocaleString()}`, pageWidth / 2, yPosition, { align: 'center' });
      
      yPosition += 5;
      doc.text(`${t('reports.period', 'Period')}: ${filters.startDate} ${t('reports.to', 'to')} ${filters.endDate}`, pageWidth / 2, yPosition, { align: 'center' });
      
      yPosition += 5;
      const displayEmployeeName = selectedEmployee === 'all' ? 
        t('reports.allEmployees', 'All Employees') : 
        (unicodeFontLoaded ? rawEmployeeName : cleanTextForPDF(rawEmployeeName, false));
      doc.text(`${t('reports.employee', 'Employee')}: ${displayEmployeeName}`, pageWidth / 2, yPosition, { align: 'center' });
      
      yPosition += 15;

      // Summary Box
      doc.setFillColor(240, 242, 245);
      doc.rect(15, yPosition, pageWidth - 30, 40, 'F');
      
      doc.setFontSize(14);
      doc.setTextColor(40, 44, 52);
      doc.text(t('reports.summaryOverview', 'SUMMARY OVERVIEW').toUpperCase(), pageWidth / 2, yPosition + 8, { align: 'center' });
      
      yPosition += 15;
      doc.setFontSize(10);
      doc.setTextColor(60, 60, 60);
      
      if (activeTab === 'all') {
        doc.text(`${t('reports.totalRecords', 'Total Records')}: ${stats.totalRecords}`, 25, yPosition);
        doc.text(`${t('reports.timeEntries', 'Time Entries')}: ${stats.timeEntriesCount}`, 25, yPosition + 6);
        doc.text(`${t('reports.tasks', 'Tasks')}: ${stats.tasksCount}`, 25, yPosition + 12);
        doc.text(`${t('reports.goals', 'Goals')}: ${stats.goalsCount}`, 25, yPosition + 18);
        
        doc.text(`${t('reports.totalHours', 'Total Hours')}: ${stats.totalHours}h`, pageWidth - 85, yPosition);
        doc.text(`${t('reports.approved', 'Approved')}: ${stats.approvedTime}`, pageWidth - 85, yPosition + 6);
        doc.text(`${t('reports.completedTasks', 'Completed Tasks')}: ${stats.completedTasks}`, pageWidth - 85, yPosition + 12);
        doc.text(`${t('reports.achievedGoals', 'Achieved Goals')}: ${stats.achievedGoals}`, pageWidth - 85, yPosition + 18);
      } else if (activeTab === 'time-entries') {
        doc.text(`${t('reports.totalRecords', 'Total Records')}: ${stats.totalRecords}`, 25, yPosition);
        doc.text(`${t('reports.totalHours', 'Total Hours')}: ${stats.totalHours}h`, 25, yPosition + 6);
        doc.text(`${t('reports.approved', 'Approved')}: ${stats.approved}`, pageWidth - 85, yPosition);
        doc.text(`${t('reports.pending', 'Pending')}: ${stats.pending}`, pageWidth - 85, yPosition + 6);
      } else if (activeTab === 'tasks') {
        doc.text(`${t('reports.totalRecords', 'Total Records')}: ${stats.totalRecords}`, 25, yPosition);
        doc.text(`${t('reports.completed', 'Completed')}: ${stats.completed}`, 25, yPosition + 6);
        doc.text(`${t('reports.inProgress', 'In Progress')}: ${stats.inProgress}`, pageWidth - 85, yPosition);
        doc.text(`${t('reports.completionRate', 'Completion Rate')}: ${stats.completionRate}%`, pageWidth - 85, yPosition + 6);
      } else if (activeTab === 'goals') {
        doc.text(`${t('reports.totalRecords', 'Total Records')}: ${stats.totalRecords}`, 25, yPosition);
        doc.text(`${t('reports.achieved', 'Achieved')}: ${stats.achieved}`, 25, yPosition + 6);
        doc.text(`${t('reports.inProgress', 'In Progress')}: ${stats.inProgress}`, pageWidth - 85, yPosition);
        doc.text(`${t('reports.avgProgress', 'Avg Progress')}: ${stats.averageProgress}%`, pageWidth - 85, yPosition + 6);
      }
      
      yPosition += 35;

      // Data Tables
      if (activeTab === 'all') {
        // Time Entries Table
        if (reportData.timeEntries.length > 0) {
          doc.setFontSize(12);
          doc.setTextColor(40, 44, 52);
          doc.text(t('reports.timeEntries', 'TIME ENTRIES').toUpperCase(), 15, yPosition);
          yPosition += 5;

          const timeEntriesData = reportData.timeEntries.slice(0, 20).map(entry => [
            cleanTextForPDF(isDemoMode() ? getDemoEmployeeName(entry.employee, t) : (entry.employee?.name || t('reports.unknown', 'Unknown')), unicodeFontLoaded),
            entry.date,
            `${entry.hours || 0}h`,
            cleanTextForPDF(translateHourType(entry.hour_type), unicodeFontLoaded),
            cleanTextForPDF(translateStatus(entry.status), unicodeFontLoaded)
          ]);

          autoTable(doc, {
            startY: yPosition,
            head: [[
              unicodeFontLoaded ? t('reports.employee', 'Employee') : cleanTextForPDF(t('reports.employee', 'Employee')),
              unicodeFontLoaded ? t('reports.date', 'Date') : cleanTextForPDF(t('reports.date', 'Date')),
              unicodeFontLoaded ? t('reports.hours', 'Hours') : cleanTextForPDF(t('reports.hours', 'Hours')),
              unicodeFontLoaded ? t('reports.type', 'Type') : cleanTextForPDF(t('reports.type', 'Type')),
              unicodeFontLoaded ? t('reports.status', 'Status') : cleanTextForPDF(t('reports.status', 'Status'))
            ]],
            body: timeEntriesData,
            theme: 'striped',
            headStyles: { 
              fillColor: [70, 173, 71], 
              textColor: 255, 
              fontStyle: 'normal',
              font: getTableFont()
            },
            styles: { 
              fontSize: 8, 
              cellPadding: 2,
              font: getTableFont(),
              fontStyle: 'normal'
            },
            didParseCell: function(data) {
              data.cell.styles.font = getTableFont();
            },
            margin: { left: 15, right: 15 }
          });

          yPosition = doc.lastAutoTable.finalY + 10;

          if (yPosition > pageHeight - 60) {
            doc.addPage();
            yPosition = 20;
          }
        }

        // Tasks Table
        if (reportData.tasks.length > 0) {
          doc.setFontSize(12);
          doc.setTextColor(40, 44, 52);
          doc.text(t('reports.tasks', 'TASKS').toUpperCase(), 15, yPosition);
          yPosition += 5;

          const tasksData = reportData.tasks.slice(0, 20).map(task => [
            cleanTextForPDF(isDemoMode() ? getDemoEmployeeName(task.employee, t) : (task.employee?.name || t('reports.unknown', 'Unknown')), unicodeFontLoaded),
            cleanTextForPDF((isDemoMode() ? getDemoTaskTitle(task, t) : task.title).substring(0, 30), unicodeFontLoaded),
            cleanTextForPDF(translatePriority(task.priority), unicodeFontLoaded),
            cleanTextForPDF(translateStatus(task.status), unicodeFontLoaded),
            task.due_date || '-'
          ]);

          autoTable(doc, {
            startY: yPosition,
            head: [[
              unicodeFontLoaded ? t('reports.employee', 'Employee') : cleanTextForPDF(t('reports.employee', 'Employee')),
              unicodeFontLoaded ? t('reports.task', 'Task') : cleanTextForPDF(t('reports.task', 'Task')),
              unicodeFontLoaded ? t('reports.priority', 'Priority') : cleanTextForPDF(t('reports.priority', 'Priority')),
              unicodeFontLoaded ? t('reports.status', 'Status') : cleanTextForPDF(t('reports.status', 'Status')),
              unicodeFontLoaded ? t('reports.dueDate', 'Due Date') : cleanTextForPDF(t('reports.dueDate', 'Due Date'))
            ]],
            body: tasksData,
            theme: 'striped',
            headStyles: { 
              fillColor: [255, 192, 0], 
              textColor: 0, 
              fontStyle: 'normal',
              font: getTableFont()
            },
            styles: { 
              fontSize: 8, 
              cellPadding: 2,
              font: getTableFont(),
              fontStyle: 'normal'
            },
            didParseCell: function(data) {
              data.cell.styles.font = getTableFont();
            },
            margin: { left: 15, right: 15 }
          });

          yPosition = doc.lastAutoTable.finalY + 10;

          if (yPosition > pageHeight - 60) {
            doc.addPage();
            yPosition = 20;
          }
        }

        // Goals Table
        if (reportData.goals.length > 0) {
          doc.setFontSize(12);
          doc.setTextColor(40, 44, 52);
          doc.text(t('reports.personalGoals', 'PERSONAL GOALS').toUpperCase(), 15, yPosition);
          yPosition += 5;

          const goalsData = reportData.goals.slice(0, 20).map(goal => [
            cleanTextForPDF(isDemoMode() ? getDemoEmployeeName(goal.employee, t) : (goal.employee?.name || t('reports.unknown', 'Unknown')), unicodeFontLoaded),
            cleanTextForPDF((isDemoMode() ? getDemoGoalTitle(goal, t) : goal.title).substring(0, 30), unicodeFontLoaded),
            cleanTextForPDF(translateCategory(goal.category), unicodeFontLoaded),
            cleanTextForPDF(translateStatus(goal.status), unicodeFontLoaded),
            `${goal.progress || 0}%`
          ]);

          autoTable(doc, {
            startY: yPosition,
            head: [[
              unicodeFontLoaded ? t('reports.employee', 'Employee') : cleanTextForPDF(t('reports.employee', 'Employee')),
              unicodeFontLoaded ? t('reports.goal', 'Goal') : cleanTextForPDF(t('reports.goal', 'Goal')),
              unicodeFontLoaded ? t('reports.category', 'Category') : cleanTextForPDF(t('reports.category', 'Category')),
              unicodeFontLoaded ? t('reports.status', 'Status') : cleanTextForPDF(t('reports.status', 'Status')),
              unicodeFontLoaded ? t('reports.progress', 'Progress') : cleanTextForPDF(t('reports.progress', 'Progress'))
            ]],
            body: goalsData,
            theme: 'striped',
            headStyles: { 
              fillColor: [91, 155, 213], 
              textColor: 255, 
              fontStyle: 'normal',
              font: getTableFont()
            },
            styles: { 
              fontSize: 8, 
              cellPadding: 2,
              font: getTableFont(),
              fontStyle: 'normal'
            },
            didParseCell: function(data) {
              data.cell.styles.font = getTableFont();
            },
            margin: { left: 15, right: 15 }
          });
        }
      } else if (activeTab === 'time-entries' && reportData.timeEntries.length > 0) {
        const timeEntriesData = reportData.timeEntries.slice(0, 50).map(entry => [
          cleanTextForPDF(isDemoMode() ? getDemoEmployeeName(entry.employee, t) : (entry.employee?.name || t('reports.unknown', 'Unknown')), unicodeFontLoaded),
          cleanTextForPDF(translateDepartment(entry.employee?.department) || '', unicodeFontLoaded),
          entry.date,
          entry.clock_in || '-',
          entry.clock_out || '-',
          `${entry.hours || 0}h`,
          cleanTextForPDF(translateHourType(entry.hour_type), unicodeFontLoaded),
          cleanTextForPDF(translateStatus(entry.status), unicodeFontLoaded)
        ]);

        autoTable(doc, {
          startY: yPosition,
          head: [[
            unicodeFontLoaded ? t('reports.employee', 'Employee') : cleanTextForPDF(t('reports.employee', 'Employee')),
            unicodeFontLoaded ? t('reports.department', 'Department') : cleanTextForPDF(t('reports.department', 'Department')),
            unicodeFontLoaded ? t('reports.date', 'Date') : cleanTextForPDF(t('reports.date', 'Date')),
            unicodeFontLoaded ? t('reports.clockIn', 'Clock In') : cleanTextForPDF(t('reports.clockIn', 'Clock In')),
            unicodeFontLoaded ? t('reports.clockOut', 'Clock Out') : cleanTextForPDF(t('reports.clockOut', 'Clock Out')),
            unicodeFontLoaded ? t('reports.hours', 'Hours') : cleanTextForPDF(t('reports.hours', 'Hours')),
            unicodeFontLoaded ? t('reports.type', 'Type') : cleanTextForPDF(t('reports.type', 'Type')),
            unicodeFontLoaded ? t('reports.status', 'Status') : cleanTextForPDF(t('reports.status', 'Status'))
          ]],
          body: timeEntriesData,
          theme: 'striped',
          headStyles: { 
            fillColor: [70, 173, 71], 
            textColor: 255, 
            fontStyle: 'normal',
            font: getTableFont()
          },
          styles: { 
            fontSize: 7, 
            cellPadding: 1.5,
            font: getTableFont(),
            fontStyle: 'normal'
          },
          didParseCell: function(data) {
            data.cell.styles.font = getTableFont();
          },
          margin: { left: 15, right: 15 }
        });
      } else if (activeTab === 'tasks' && reportData.tasks.length > 0) {
        const tasksData = reportData.tasks.slice(0, 50).map(task => [
          cleanTextForPDF(isDemoMode() ? getDemoEmployeeName(task.employee, t) : (task.employee?.name || t('reports.unknown', 'Unknown')), unicodeFontLoaded),
          cleanTextForPDF(translateDepartment(task.employee?.department) || '', unicodeFontLoaded),
          cleanTextForPDF((isDemoMode() ? getDemoTaskTitle(task, t) : task.title).substring(0, 40), unicodeFontLoaded),
          cleanTextForPDF(translatePriority(task.priority), unicodeFontLoaded),
          cleanTextForPDF(translateStatus(task.status), unicodeFontLoaded),
          task.due_date || '-',
          `${task.estimated_hours || 0}h`,
          `${task.actual_hours || 0}h`
        ]);

        autoTable(doc, {
          startY: yPosition,
          head: [[
            unicodeFontLoaded ? t('reports.employee', 'Employee') : cleanTextForPDF(t('reports.employee', 'Employee')),
            unicodeFontLoaded ? t('reports.department', 'Department') : cleanTextForPDF(t('reports.department', 'Department')),
            unicodeFontLoaded ? t('reports.task', 'Task') : cleanTextForPDF(t('reports.task', 'Task')),
            unicodeFontLoaded ? t('reports.priority', 'Priority') : cleanTextForPDF(t('reports.priority', 'Priority')),
            unicodeFontLoaded ? t('reports.status', 'Status') : cleanTextForPDF(t('reports.status', 'Status')),
            unicodeFontLoaded ? t('reports.dueDate', 'Due Date') : cleanTextForPDF(t('reports.dueDate', 'Due Date')),
            unicodeFontLoaded ? t('reports.est', 'Est.') : cleanTextForPDF(t('reports.est', 'Est.')),
            unicodeFontLoaded ? t('reports.actual', 'Actual') : cleanTextForPDF(t('reports.actual', 'Actual'))
          ]],
          body: tasksData,
          theme: 'striped',
          headStyles: { 
            fillColor: [255, 192, 0], 
            textColor: 0, 
            fontStyle: 'normal',
            font: getTableFont()
          },
          styles: { 
            fontSize: 7, 
            cellPadding: 1.5,
            font: getTableFont(),
            fontStyle: 'normal'
          },
          didParseCell: function(data) {
            data.cell.styles.font = getTableFont();
          },
          margin: { left: 15, right: 15 }
        });
      } else if (activeTab === 'goals' && reportData.goals.length > 0) {
        const goalsData = reportData.goals.slice(0, 50).map(goal => [
          cleanTextForPDF(isDemoMode() ? getDemoEmployeeName(goal.employee, t) : (goal.employee?.name || t('reports.unknown', 'Unknown')), unicodeFontLoaded),
          cleanTextForPDF(translateDepartment(goal.employee?.department) || '', unicodeFontLoaded),
          cleanTextForPDF((isDemoMode() ? getDemoGoalTitle(goal, t) : goal.title).substring(0, 40), unicodeFontLoaded),
          cleanTextForPDF(translateCategory(goal.category), unicodeFontLoaded),
          cleanTextForPDF(translateStatus(goal.status), unicodeFontLoaded),
          goal.target_date || '-',
          `${goal.progress || 0}%`
        ]);

        autoTable(doc, {
          startY: yPosition,
          head: [[
            unicodeFontLoaded ? t('reports.employee', 'Employee') : cleanTextForPDF(t('reports.employee', 'Employee')),
            unicodeFontLoaded ? t('reports.department', 'Department') : cleanTextForPDF(t('reports.department', 'Department')),
            unicodeFontLoaded ? t('reports.goal', 'Goal') : cleanTextForPDF(t('reports.goal', 'Goal')),
            unicodeFontLoaded ? t('reports.category', 'Category') : cleanTextForPDF(t('reports.category', 'Category')),
            unicodeFontLoaded ? t('reports.status', 'Status') : cleanTextForPDF(t('reports.status', 'Status')),
            unicodeFontLoaded ? t('reports.targetDate', 'Target Date') : cleanTextForPDF(t('reports.targetDate', 'Target Date')),
            unicodeFontLoaded ? t('reports.progress', 'Progress') : cleanTextForPDF(t('reports.progress', 'Progress'))
          ]],
          body: goalsData,
          theme: 'striped',
          headStyles: { 
            fillColor: [91, 155, 213], 
            textColor: 255, 
            fontStyle: 'normal',
            font: getTableFont()
          },
          styles: { 
            fontSize: 7, 
            cellPadding: 1.5,
            font: getTableFont(),
            fontStyle: 'normal'
          },
          didParseCell: function(data) {
            data.cell.styles.font = getTableFont();
          },
          margin: { left: 15, right: 15 }
        });
      }

      // Footer on all pages
      const pageCount = doc.internal.getNumberOfPages();
      const languageName = SUPPORTED_LANGUAGES[currentLanguage]?.name || 'English';
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(150, 150, 150);
        doc.text(
          `${t('reports.page', 'Page')} ${i} ${t('reports.of', 'of')} ${pageCount} | ${t('reports.generatedBy', 'Generated by HR Management System')}`,
          pageWidth / 2,
          pageHeight - 10,
          { align: 'center' }
        );
        // Add language indicator on the right
        doc.text(
          `${t('reports.language', 'Language')}: ${languageName}`,
          pageWidth - 15,
          pageHeight - 10,
          { align: 'right' }
        );
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
      {/* Loading overlay */}
      {loading && (
        <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
          <div className={`${bg.secondary} rounded-lg p-6 flex items-center space-x-3`}>
            <Loader className="w-6 h-6 animate-spin text-blue-600" />
            <span className={text.primary}>{t('common.loading', 'Loading reports...')}</span>
          </div>
        </div>
      )}

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
              onClick={() => {
                if (activeTab === 'all') {
                  // Export all data types when "all" is selected
                  exportTimeEntries();
                  setTimeout(() => exportTasks(), 500);
                  setTimeout(() => exportGoals(), 1000);
                } else if (activeTab === 'time-entries') exportTimeEntries();
                else if (activeTab === 'tasks') exportTasks();
                else if (activeTab === 'goals') exportGoals();
              }}
              disabled={exporting || (activeTab === 'all' ? stats.totalRecords === 0 : currentData.length === 0)}
              className={`px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-lg flex items-center gap-2 transition-colors font-medium`}
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
              disabled={exporting || (reportData.timeEntries.length === 0 && reportData.tasks.length === 0 && reportData.goals.length === 0)}
              className={`px-6 py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white rounded-lg flex items-center gap-2 transition-colors font-medium`}
              title="Export with metrics, charts data, and formatted tables"
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
              disabled={exporting || (reportData.timeEntries.length === 0 && reportData.tasks.length === 0 && reportData.goals.length === 0)}
              className={`px-6 py-3 bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white rounded-lg flex items-center gap-2 transition-colors font-medium`}
              title="Export as PDF with summary and tables"
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
            <span className={`text-sm font-normal ${text.secondary} ml-2`}>
              ({t('reports.showingFirst50', 'Showing first 50 records')})
            </span>
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
                    <th className={`px-6 py-3 text-left text-xs font-medium ${text.secondary} uppercase tracking-wider`}>{t('reports.employees', 'Employee')}</th>
                    <th className={`px-6 py-3 text-left text-xs font-medium ${text.secondary} uppercase tracking-wider`}>{t('reports.date', 'Date')}</th>
                    <th className={`px-6 py-3 text-left text-xs font-medium ${text.secondary} uppercase tracking-wider`}>{t('reports.hours', 'Hours')}</th>
                    <th className={`px-6 py-3 text-left text-xs font-medium ${text.secondary} uppercase tracking-wider`}>{t('reports.type', 'Type')}</th>
                    <th className={`px-6 py-3 text-left text-xs font-medium ${text.secondary} uppercase tracking-wider`}>{t('reports.status', 'Status')}</th>
                  </>
                )}
                
                {activeTab === 'tasks' && (
                  <>
                    <th className={`px-6 py-3 text-left text-xs font-medium ${text.secondary} uppercase tracking-wider`}>{t('reports.employees', 'Employee')}</th>
                    <th className={`px-6 py-3 text-left text-xs font-medium ${text.secondary} uppercase tracking-wider`}>{t('reports.task', 'Task')}</th>
                    <th className={`px-6 py-3 text-left text-xs font-medium ${text.secondary} uppercase tracking-wider`}>{t('reports.priority', 'Priority')}</th>
                    <th className={`px-6 py-3 text-left text-xs font-medium ${text.secondary} uppercase tracking-wider`}>{t('reports.status', 'Status')}</th>
                    <th className={`px-6 py-3 text-left text-xs font-medium ${text.secondary} uppercase tracking-wider`}>{t('reports.dueDate', 'Due Date')}</th>
                  </>
                )}
                
                {activeTab === 'goals' && (
                  <>
                    <th className={`px-6 py-3 text-left text-xs font-medium ${text.secondary} uppercase tracking-wider`}>{t('reports.employees', 'Employee')}</th>
                    <th className={`px-6 py-3 text-left text-xs font-medium ${text.secondary} uppercase tracking-wider`}>{t('reports.goal', 'Goal')}</th>
                    <th className={`px-6 py-3 text-left text-xs font-medium ${text.secondary} uppercase tracking-wider`}>{t('reports.category', 'Category')}</th>
                    <th className={`px-6 py-3 text-left text-xs font-medium ${text.secondary} uppercase tracking-wider`}>{t('reports.status', 'Status')}</th>
                    <th className={`px-6 py-3 text-left text-xs font-medium ${text.secondary} uppercase tracking-wider`}>{t('reports.progress', 'Progress')}</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {(activeTab === 'all' ? (currentData.timeEntries?.length + currentData.tasks?.length + currentData.goals?.length === 0) : currentData.length === 0) ? (
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
                  {(currentData.timeEntries || []).slice(0, 20).map((item, index) => (
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
                  {(currentData.tasks || []).slice(0, 20).map((item, index) => (
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
                  {(currentData.goals || []).slice(0, 20).map((item, index) => (
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
                currentData.slice(0, 50).map((item, index) => (
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