import React, { useState, useEffect, useMemo } from "react";
import { useLanguage } from "../contexts/LanguageContext";
import { useTheme } from "../contexts/ThemeContext";
import { useAuth } from '../contexts/AuthContext';
import { 
  Calendar, 
  Download, 
  Users, 
  Activity,
  User,
  PlayCircle,
  Filter, 
  BarChart3, 
  Clock, 
  CheckCircle, 
  Combine, 
  Target,
  Pickaxe,
  HeartPlus,
  ShieldCheck,
  Goal,
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
  const { t } = useLanguage();
  const { isDarkMode } = useTheme();
  
  // Helper function to translate department values
  const translateDepartment = (department) => {
    if (!department) return '';
    return t(`departments.${department}`, department);
  };
  
  // Helper function to translate position values
  const translatePosition = (position) => {
    if (!position) return '';
    return t(`employeePosition.${position}`, position);
  };
  
  // Helper function to translate status values
  const translateStatus = (status) => {
    if (!status) return '';
    const statusMap = {
      'approved': t('status.approved', 'Approved'),
      'pending': t('status.pending', 'Pending'),
      'rejected': t('status.rejected', 'Rejected'),
      'completed': t('status.completed', 'Completed'),
      'in-progress': t('status.in-progress', 'In Progress'),
      'in_progress': t('status.in-progress', 'In Progress'),
      'not-started': t('status.not-started', 'Not Started'),
      'achieved': t('status.achieved', 'Achieved'),
      'on-hold': t('status.on-hold', 'On Hold')
    };
    return statusMap[status] || status;
  };
  
  // Helper function to translate hour types
  const translateHourType = (type) => {
    if (!type) return '';
    const typeMap = {
      'regular': t('timeTracking.regular', 'Regular'),
      'overtime': t('timeTracking.overtime', 'Overtime'),
      'bonus': t('timeTracking.bonus', 'Bonus')
    };
    return typeMap[type] || type;
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
      'general': t('taskReview.general', 'General'),
      'technical': t('taskReview.technical', 'Technical'),
      'leadership': t('taskReview.leadership', 'Leadership'),
      'project': t('taskReview.project', 'Project'),
      'professional_development': t('taskReview.professionalDevelopment', 'Professional Development')
    };
    return categoryMap[category] || category;
  };
  
  // Helper function to translate priority labels
  const translatePriority = (priority) => {
    if (!priority) return '';
    const priorityMap = {
      'low': t('taskListing.low', 'Low'),
      'medium': t('taskListing.medium', 'Medium'),
      'high': t('taskListing.high', 'High')
    };
    return priorityMap[priority] || priority;
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
        // Custom range - don't change filters
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
        // Use direct Supabase query with proper join - fetch all entries first
        const { data: allTimeEntries, error } = await supabase
          .from('time_entries')
          .select(`
            *,
            employee:employees!time_entries_employee_id_fkey(id, name, department, position)
          `)
          .gte('date', startDate)
          .lte('date', endDate)
          .order('date', { ascending: false });

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
      const csvContent = [
        headers.join(','),
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
        [t('employees.name', 'Employee Name')]: entry.employee?.name || 'Unknown',
        [t('employees.department', 'Department')]: translateDepartment(entry.employee?.department) || '',
        [t('employees.position', 'Position')]: translatePosition(entry.employee?.position) || '',
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
        `_${reportData.employees.find(emp => String(emp.id) === String(selectedEmployee))?.name?.replace(/\s+/g, '_')}` : 
        '';
      
      const filename = `time_entries${employeeName}_${filters.startDate}_to_${filters.endDate}.csv`;
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
        [t('employees.name', 'Employee Name')]: task.employee?.name || 'Unknown',
        [t('employees.department', 'Department')]: translateDepartment(task.employee?.department) || '',
        [t('taskListing.taskTitle', 'Task Title')]: task.title || '',
        [t('taskListing.description', 'Description')]: task.description || '',
        [t('taskListing.priority', 'Priority')]: task.priority || '',
        [t('taskListing.status', 'Status')]: task.status || '',
        [t('taskListing.dueDate', 'Due Date')]: task.due_date || '',
        [t('taskListing.estimatedHours', 'Estimated Hours')]: task.estimated_hours || '',
        [t('taskListing.actualHours', 'Actual Hours')]: task.actual_hours || '',
        [t('general.createdAt', 'Created At')]: new Date(task.created_at).toLocaleString(),
        [t('general.updatedAt', 'Updated At')]: new Date(task.updated_at).toLocaleString()
      }));

      const employeeName = selectedEmployee !== 'all' ? 
        `_${reportData.employees.find(emp => String(emp.id) === String(selectedEmployee))?.name?.replace(/\s+/g, '_')}` : 
        '';
      
      const filename = `tasks${employeeName}_${filters.startDate}_to_${filters.endDate}.csv`;
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
        [t('employees.name', 'Employee Name')]: goal.employee?.name || 'Unknown',
        [t('employees.department', 'Department')]: translateDepartment(goal.employee?.department) || '',
        [t('taskReview.goalTitle', 'Goal Title')]: goal.title || '',
        [t('taskReview.description', 'Description')]: goal.description || '',
        [t('taskReview.category', 'Category')]: goal.category || '',
        [t('taskReview.targetDate', 'Target Date')]: goal.target_date || '',
        [t('taskReview.status', 'Status')]: goal.status || '',
        [t('taskReview.progress', 'Progress')]: goal.progress || 0,
        [t('taskReview.notes', 'Notes')]: goal.notes || '',
        [t('general.createdAt', 'Created At')]: new Date(goal.created_at).toLocaleString(),
        [t('general.updatedAt', 'Updated At')]: new Date(goal.updated_at).toLocaleString()
      }));

      const employeeName = selectedEmployee !== 'all' ? 
        `_${reportData.employees.find(emp => String(emp.id) === String(selectedEmployee))?.name?.replace(/\s+/g, '_')}` : 
        '';
      
      const filename = `personal_goals${employeeName}_${filters.startDate}_to_${filters.endDate}.csv`;
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
      currentRow += 2;
      
      // Time Entries Metrics with Styling
      if (reportData.timeEntries.length > 0) {
        const totalHours = reportData.timeEntries.reduce((sum, entry) => sum + (entry.hours || 0), 0);
        const regularHours = reportData.timeEntries.filter(e => e.hour_type === 'regular').reduce((sum, e) => sum + (e.hours || 0), 0);
        // Include both overtime and bonus as overtime hours
        const overtimeHours = reportData.timeEntries.filter(e => e.hour_type === 'overtime' || e.hour_type === 'bonus').reduce((sum, e) => sum + (e.hours || 0), 0);
        const pendingEntries = reportData.timeEntries.filter(e => e.status === 'pending').length;
        const approvedEntries = reportData.timeEntries.filter(e => e.status === 'approved').length;
        
        // Section Header
        summarySheet.getCell(`A${currentRow}`).value = 'TIME TRACKING SUMMARY';
        summarySheet.getCell(`A${currentRow}`).font = { size: 12, bold: true, color: { argb: 'FFFFFFFF' } };
        summarySheet.getCell(`A${currentRow}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF70AD47' } };
        summarySheet.mergeCells(`A${currentRow}:B${currentRow}`);
        currentRow++;
        
        // Metrics
        const addMetric = (label, value) => {
          summarySheet.getCell(`A${currentRow}`).value = label;
          summarySheet.getCell(`B${currentRow}`).value = value;
          summarySheet.getCell(`A${currentRow}`).font = { bold: true };
          summarySheet.getCell(`B${currentRow}`).alignment = { horizontal: 'right' };
          currentRow++;
        };
        
        addMetric('Total Time Entries:', reportData.timeEntries.length);
        addMetric('Total Hours Logged:', totalHours.toFixed(2));
        addMetric('Regular Hours:', regularHours.toFixed(2));
        addMetric('Overtime Hours:', overtimeHours.toFixed(2));
        addMetric('Pending Approvals:', pendingEntries);
        addMetric('Approved Entries:', approvedEntries);
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
        
        const addMetric = (label, value) => {
          summarySheet.getCell(`A${currentRow}`).value = label;
          summarySheet.getCell(`B${currentRow}`).value = value;
          summarySheet.getCell(`A${currentRow}`).font = { bold: true };
          summarySheet.getCell(`B${currentRow}`).alignment = { horizontal: 'right' };
          currentRow++;
        };
        
        addMetric('Total Tasks:', reportData.tasks.length);
        addMetric('Completed Tasks:', completedTasks);
        addMetric('In Progress:', inProgressTasks);
        addMetric('High Priority Tasks:', highPriority);
        addMetric('Estimated Hours:', totalEstimated.toFixed(2));
        addMetric('Actual Hours:', totalActual.toFixed(2));
        addMetric('Variance:', (totalActual - totalEstimated).toFixed(2));
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
        
        const addMetric = (label, value) => {
          summarySheet.getCell(`A${currentRow}`).value = label;
          summarySheet.getCell(`B${currentRow}`).value = value;
          summarySheet.getCell(`A${currentRow}`).font = { bold: true };
          summarySheet.getCell(`B${currentRow}`).alignment = { horizontal: 'right' };
          currentRow++;
        };
        
        addMetric('Total Goals:', reportData.goals.length);
        addMetric('Completed Goals:', completedGoals);
        addMetric('In Progress:', inProgressGoals);
        addMetric('Average Progress:', `${avgProgress}%`);
      }

      // Set column widths for summary sheet
      summarySheet.getColumn(1).width = 30;
      summarySheet.getColumn(2).width = 20;

      // ==================== INDIVIDUAL EMPLOYEE PERFORMANCE SHEET ====================
      if (selectedEmployee !== 'all') {
        const employee = reportData.employees.find(emp => String(emp.id) === String(selectedEmployee));
        if (employee) {
          const perfSheet = workbook.addWorksheet('Employee Performance');
          
          // Header
          perfSheet.getCell('A1').value = `${employee.name.toUpperCase()} - PERFORMANCE REPORT`;
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
          
          addInfo('Name:', employee.name);
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
            entry.employee?.name || 'Unknown',
            translateDepartment(entry.employee?.department) || '',
            translatePosition(entry.employee?.position) || '',
            entry.date,
            entry.clock_in || '',
            entry.clock_out || '',
            entry.hours || 0,
            entry.hour_type || '',
            entry.status || '',
            entry.notes || '',
            new Date(entry.created_at).toLocaleString()
          ];
          
          rowData.forEach((value, colIdx) => {
            const cell = timeEntriesSheet.getCell(rowNum, colIdx + 1);
            cell.value = value;
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
            task.employee?.name || 'Unknown',
            translateDepartment(task.employee?.department) || '',
            task.title || '',
            task.description || '',
            task.priority || '',
            task.status || '',
            task.due_date || '',
            task.estimated_hours || 0,
            task.actual_hours || 0,
            variance,
            new Date(task.created_at).toLocaleString()
          ];
          
          rowData.forEach((value, colIdx) => {
            const cell = tasksSheet.getCell(rowNum, colIdx + 1);
            cell.value = value;
            
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
            goal.employee?.name || 'Unknown',
            translateDepartment(goal.employee?.department) || '',
            goal.title || '',
            goal.description || '',
            goal.category || '',
            goal.status || '',
            goal.progress || 0,
            goal.target_date || '',
            goal.notes || '',
            new Date(goal.created_at).toLocaleString(),
            new Date(goal.updated_at).toLocaleString()
          ];
          
          rowData.forEach((value, colIdx) => {
            const cell = goalsSheet.getCell(rowNum, colIdx + 1);
            cell.value = value;
            
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
      const filename = `HR_Report_${employeeName}_${filters.startDate}_to_${filters.endDate}.xlsx`;
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

  // PDF Export with Charts and Tables
  const exportToPDF = async () => {
    setExporting(true);
    try {
      const doc = new jsPDF('p', 'mm', 'a4');
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      let yPosition = 20;

      // Employee name for filename
      const employeeName = selectedEmployee !== 'all' ? 
        reportData.employees.find(emp => String(emp.id) === String(selectedEmployee))?.name?.replace(/\s+/g, '_') : 
        'All_Employees';

      // Header
      doc.setFontSize(20);
      doc.setTextColor(40, 44, 52);
      doc.text('HR PERFORMANCE REPORT', pageWidth / 2, yPosition, { align: 'center' });
      
      yPosition += 10;
      doc.setFontSize(10);
      doc.setTextColor(100, 100, 100);
      doc.text(`Generated: ${new Date().toLocaleString()}`, pageWidth / 2, yPosition, { align: 'center' });
      
      yPosition += 5;
      doc.text(`Period: ${filters.startDate} to ${filters.endDate}`, pageWidth / 2, yPosition, { align: 'center' });
      
      yPosition += 5;
      doc.text(`Employee: ${selectedEmployee === 'all' ? 'All Employees' : employeeName}`, pageWidth / 2, yPosition, { align: 'center' });
      
      yPosition += 15;

      // Summary Box
      doc.setFillColor(240, 242, 245);
      doc.rect(15, yPosition, pageWidth - 30, 40, 'F');
      
      doc.setFontSize(14);
      doc.setTextColor(40, 44, 52);
      doc.text('SUMMARY OVERVIEW', pageWidth / 2, yPosition + 8, { align: 'center' });
      
      yPosition += 15;
      doc.setFontSize(10);
      doc.setTextColor(60, 60, 60);
      
      if (activeTab === 'all') {
        doc.text(`Total Records: ${stats.totalRecords}`, 25, yPosition);
        doc.text(`Time Entries: ${stats.timeEntriesCount}`, 25, yPosition + 6);
        doc.text(`Tasks: ${stats.tasksCount}`, 25, yPosition + 12);
        doc.text(`Goals: ${stats.goalsCount}`, 25, yPosition + 18);
        
        doc.text(`Total Hours: ${stats.totalHours}h`, pageWidth - 85, yPosition);
        doc.text(`Approved: ${stats.approvedTime}`, pageWidth - 85, yPosition + 6);
        doc.text(`Completed Tasks: ${stats.completedTasks}`, pageWidth - 85, yPosition + 12);
        doc.text(`Achieved Goals: ${stats.achievedGoals}`, pageWidth - 85, yPosition + 18);
      } else if (activeTab === 'time-entries') {
        doc.text(`Total Records: ${stats.totalRecords}`, 25, yPosition);
        doc.text(`Total Hours: ${stats.totalHours}h`, 25, yPosition + 6);
        doc.text(`Approved: ${stats.approved}`, pageWidth - 85, yPosition);
        doc.text(`Pending: ${stats.pending}`, pageWidth - 85, yPosition + 6);
      } else if (activeTab === 'tasks') {
        doc.text(`Total Records: ${stats.totalRecords}`, 25, yPosition);
        doc.text(`Completed: ${stats.completed}`, 25, yPosition + 6);
        doc.text(`In Progress: ${stats.inProgress}`, pageWidth - 85, yPosition);
        doc.text(`Completion Rate: ${stats.completionRate}%`, pageWidth - 85, yPosition + 6);
      } else if (activeTab === 'goals') {
        doc.text(`Total Records: ${stats.totalRecords}`, 25, yPosition);
        doc.text(`Achieved: ${stats.achieved}`, 25, yPosition + 6);
        doc.text(`In Progress: ${stats.inProgress}`, pageWidth - 85, yPosition);
        doc.text(`Avg Progress: ${stats.averageProgress}%`, pageWidth - 85, yPosition + 6);
      }
      
      yPosition += 35;

      // Data Tables
      if (activeTab === 'all') {
        // Time Entries Table
        if (reportData.timeEntries.length > 0) {
          doc.setFontSize(12);
          doc.setTextColor(40, 44, 52);
          doc.text('TIME ENTRIES', 15, yPosition);
          yPosition += 5;

          const timeEntriesData = reportData.timeEntries.slice(0, 20).map(entry => [
            entry.employee?.name || 'Unknown',
            entry.date,
            `${entry.hours || 0}h`,
            entry.hour_type || '',
            entry.status || ''
          ]);

          autoTable(doc, {
            startY: yPosition,
            head: [['Employee', 'Date', 'Hours', 'Type', 'Status']],
            body: timeEntriesData,
            theme: 'striped',
            headStyles: { fillColor: [70, 173, 71], textColor: 255, fontStyle: 'bold' },
            styles: { fontSize: 8, cellPadding: 2 },
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
          doc.text('TASKS', 15, yPosition);
          yPosition += 5;

          const tasksData = reportData.tasks.slice(0, 20).map(task => [
            task.employee?.name || 'Unknown',
            task.title.substring(0, 30),
            task.priority || '',
            task.status || '',
            task.due_date || '-'
          ]);

          autoTable(doc, {
            startY: yPosition,
            head: [['Employee', 'Task', 'Priority', 'Status', 'Due Date']],
            body: tasksData,
            theme: 'striped',
            headStyles: { fillColor: [255, 192, 0], textColor: 0, fontStyle: 'bold' },
            styles: { fontSize: 8, cellPadding: 2 },
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
          doc.text('PERSONAL GOALS', 15, yPosition);
          yPosition += 5;

          const goalsData = reportData.goals.slice(0, 20).map(goal => [
            goal.employee?.name || 'Unknown',
            goal.title.substring(0, 30),
            goal.category || '',
            goal.status || '',
            `${goal.progress || 0}%`
          ]);

          autoTable(doc, {
            startY: yPosition,
            head: [['Employee', 'Goal', 'Category', 'Status', 'Progress']],
            body: goalsData,
            theme: 'striped',
            headStyles: { fillColor: [91, 155, 213], textColor: 255, fontStyle: 'bold' },
            styles: { fontSize: 8, cellPadding: 2 },
            margin: { left: 15, right: 15 }
          });
        }
      } else if (activeTab === 'time-entries' && reportData.timeEntries.length > 0) {
        const timeEntriesData = reportData.timeEntries.slice(0, 50).map(entry => [
          entry.employee?.name || 'Unknown',
          translateDepartment(entry.employee?.department) || '',
          entry.date,
          entry.clock_in || '',
          entry.clock_out || '',
          `${entry.hours || 0}h`,
          entry.hour_type || '',
          entry.status || ''
        ]);

        autoTable(doc, {
          startY: yPosition,
          head: [['Employee', 'Department', 'Date', 'Clock In', 'Clock Out', 'Hours', 'Type', 'Status']],
          body: timeEntriesData,
          theme: 'striped',
          headStyles: { fillColor: [70, 173, 71], textColor: 255, fontStyle: 'bold' },
          styles: { fontSize: 7, cellPadding: 1.5 },
          margin: { left: 15, right: 15 }
        });
      } else if (activeTab === 'tasks' && reportData.tasks.length > 0) {
        const tasksData = reportData.tasks.slice(0, 50).map(task => [
          task.employee?.name || 'Unknown',
          translateDepartment(task.employee?.department) || '',
          task.title.substring(0, 40),
          task.priority || '',
          task.status || '',
          task.due_date || '-',
          `${task.estimated_hours || 0}h`,
          `${task.actual_hours || 0}h`
        ]);

        autoTable(doc, {
          startY: yPosition,
          head: [['Employee', 'Department', 'Task', 'Priority', 'Status', 'Due Date', 'Est.', 'Actual']],
          body: tasksData,
          theme: 'striped',
          headStyles: { fillColor: [255, 192, 0], textColor: 0, fontStyle: 'bold' },
          styles: { fontSize: 7, cellPadding: 1.5 },
          margin: { left: 15, right: 15 }
        });
      } else if (activeTab === 'goals' && reportData.goals.length > 0) {
        const goalsData = reportData.goals.slice(0, 50).map(goal => [
          goal.employee?.name || 'Unknown',
          translateDepartment(goal.employee?.department) || '',
          goal.title.substring(0, 40),
          goal.category || '',
          goal.status || '',
          goal.target_date || '-',
          `${goal.progress || 0}%`
        ]);

        autoTable(doc, {
          startY: yPosition,
          head: [['Employee', 'Department', 'Goal', 'Category', 'Status', 'Target Date', 'Progress']],
          body: goalsData,
          theme: 'striped',
          headStyles: { fillColor: [91, 155, 213], textColor: 255, fontStyle: 'bold' },
          styles: { fontSize: 7, cellPadding: 1.5 },
          margin: { left: 15, right: 15 }
        });
      }

      // Footer on all pages
      const pageCount = doc.internal.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(150, 150, 150);
        doc.text(
          `Page ${i} of ${pageCount} | Generated by HR Management System`,
          pageWidth / 2,
          pageHeight - 10,
          { align: 'center' }
        );
      }

      // Save the PDF
      const filename = `HR_Report_${employeeName}_${filters.startDate}_to_${filters.endDate}.pdf`;
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
                  .sort((a, b) => a.name.localeCompare(b.name))
                  .map(emp => (
                    <option key={emp.id} value={emp.id}>
                      <Users className="w-4 h-4 inline mr-1" />
                      {emp.name} • {translateDepartment(emp.department)} • {translatePosition(emp.position)}
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
                  {employee.name} - {t('reports.performanceSummary', "")}
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
                    <Target className="w-4 h-4" />
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
                <CheckCircle className={`w-8 h-8 ${text.secondary}`} />
              </div>
            </div>
            <div className={`${bg.secondary} border ${border.primary} rounded-lg p-6`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className={`text-sm ${text.secondary}`}>{t('reports.goals', 'Goals')}</p>
                  <p className={`text-3xl font-bold ${text.primary}`}>{stats.goalsCount}</p>
                </div>
                <Target className={`w-8 h-8 ${text.secondary}`} />
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
                <CheckCircle className={`w-8 h-8 ${text.secondary}`} />
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
                <BarChart3 className={`w-8 h-8 ${text.secondary}`} />
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
                <CheckCircle className={`w-8 h-8 ${text.secondary}`} />
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
                          <div className="text-sm font-medium">{item.employee?.name || 'Unknown'}</div>
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
                          <div className="text-sm font-medium">{item.employee?.name || 'Unknown'}</div>
                          <div className={`text-sm ${text.secondary}`}>{translateDepartment(item.employee?.department)}</div>
                        </div>
                      </td>
                      <td className={`px-6 py-4 ${text.primary}`}>
                        <div className="text-sm font-medium max-w-xs truncate">{item.title}</div>
                        <div className={`text-sm ${text.secondary} max-w-xs truncate`}>{item.description}</div>
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
                          <div className="text-sm font-medium">{item.employee?.name || 'Unknown'}</div>
                          <div className={`text-sm ${text.secondary}`}>{translateDepartment(item.employee?.department)}</div>
                        </div>
                      </td>
                      <td className={`px-6 py-4 ${text.primary}`}>
                        <div className="text-sm font-medium max-w-xs truncate">{item.title}</div>
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
                            <div className="text-sm font-medium">{item.employee?.name || 'Unknown'}</div>
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
                            <div className="text-sm font-medium">{item.employee?.name || 'Unknown'}</div>
                            <div className={`text-sm ${text.secondary}`}>{translateDepartment(item.employee?.department)}</div>
                          </div>
                        </td>
                        <td className={`px-6 py-4 ${text.primary}`}>
                          <div className="text-sm font-medium max-w-xs truncate">{item.title}</div>
                          <div className={`text-sm ${text.secondary} max-w-xs truncate`}>{item.description}</div>
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
                            <div className="text-sm font-medium">{item.employee?.name || 'Unknown'}</div>
                            <div className={`text-sm ${text.secondary}`}>{translateDepartment(item.employee?.department)}</div>
                          </div>
                        </td>
                        <td className={`px-6 py-4 ${text.primary}`}>
                          <div className="text-sm font-medium max-w-xs truncate">{item.title}</div>
                          <div className={`text-sm ${text.secondary} max-w-xs truncate`}>{item.description}</div>
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