import React, { useState, useEffect, useMemo } from "react";
import { useLanguage } from "../contexts/LanguageContext";
import { useTheme } from "../contexts/ThemeContext";
import { useAuth } from '../contexts/AuthContext';
import { 
  Calendar, 
  Download, 
  Users, 
  Filter, 
  BarChart3, 
  Clock, 
  CheckCircle, 
  PlayCircle, 
  Target,
  FileText,
  Database,
  Loader
} from 'lucide-react';
import * as XLSX from 'xlsx';
import ExcelJS from 'exceljs';
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
    return t(`positions.${position}`, position);
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
  const [activeTab, setActiveTab] = useState('time-entries');
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
      const employeeId = selectedEmployee === 'all' ? null : parseInt(selectedEmployee);

      if (activeTab === 'time-entries') {
        // Use direct Supabase query with proper join instead of the view
        const { data: timeEntries, error } = await supabase
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
          // Filter by employee if selected
          const filteredTimeEntries = employeeId ? 
            timeEntries.filter(entry => entry.employee_id === employeeId.toString()) : 
            timeEntries;
          
          setReportData(prev => ({ ...prev, timeEntries: filteredTimeEntries }));
        }
      } else if (activeTab === 'tasks') {
        const tasksResponse = await getAllTasks({ 
          startDate, 
          endDate,
          employeeId: employeeId 
        });
        const tasks = tasksResponse.success ? tasksResponse.data : [];
        setReportData(prev => ({ ...prev, tasks }));
      } else if (activeTab === 'goals') {
        const goalsResponse = await performanceService.getAllPerformanceGoals({ 
          employeeId: employeeId 
        });
        const goals = goalsResponse.success ? goalsResponse.data : [];
        setReportData(prev => ({ ...prev, goals }));
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
      const achieved = data.filter(goal => goal.status === 'achieved').length;
      const inProgress = data.filter(goal => goal.status === 'in-progress').length;
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
        `_${reportData.employees.find(emp => emp.id === parseInt(selectedEmployee))?.name?.replace(/\s+/g, '_')}` : 
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
        [t('workload.taskTitle', 'Task Title')]: task.title || '',
        [t('workload.description', 'Description')]: task.description || '',
        [t('workload.priority', 'Priority')]: task.priority || '',
        [t('workload.status', 'Status')]: task.status || '',
        [t('workload.dueDate', 'Due Date')]: task.due_date || '',
        [t('workload.estimatedHours', 'Estimated Hours')]: task.estimated_hours || '',
        [t('workload.actualHours', 'Actual Hours')]: task.actual_hours || '',
        [t('general.createdAt', 'Created At')]: new Date(task.created_at).toLocaleString(),
        [t('general.updatedAt', 'Updated At')]: new Date(task.updated_at).toLocaleString()
      }));

      const employeeName = selectedEmployee !== 'all' ? 
        `_${reportData.employees.find(emp => emp.id === parseInt(selectedEmployee))?.name?.replace(/\s+/g, '_')}` : 
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
        [t('performance.goalTitle', 'Goal Title')]: goal.title || '',
        [t('performance.description', 'Description')]: goal.description || '',
        [t('performance.category', 'Category')]: goal.category || '',
        [t('performance.targetDate', 'Target Date')]: goal.target_date || '',
        [t('performance.status', 'Status')]: goal.status || '',
        [t('performance.progress', 'Progress')]: goal.progress || 0,
        [t('performance.notes', 'Notes')]: goal.notes || '',
        [t('general.createdAt', 'Created At')]: new Date(goal.created_at).toLocaleString(),
        [t('general.updatedAt', 'Updated At')]: new Date(goal.updated_at).toLocaleString()
      }));

      const employeeName = selectedEmployee !== 'all' ? 
        `_${reportData.employees.find(emp => emp.id === parseInt(selectedEmployee))?.name?.replace(/\s+/g, '_')}` : 
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
        reportData.employees.find(emp => emp.id === parseInt(selectedEmployee))?.name?.replace(/\s+/g, '_') : 
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
        const overtimeHours = reportData.timeEntries.filter(e => e.hour_type === 'overtime').reduce((sum, e) => sum + (e.hours || 0), 0);
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
        const avgProgress = (reportData.goals.reduce((sum, g) => sum + (g.progress || 0), 0) / reportData.goals.length).toFixed(1);
        
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
          <div>
            <h2 className={`text-lg font-semibold ${text.primary} mb-1`}>
              {activeTab === 'time-entries' && t('reports.timeEntries', 'Time Entries')}
              {activeTab === 'tasks' && t('reports.tasks', 'Tasks')}
              {activeTab === 'goals' && t('reports.goals', 'Personal Goals')}
            </h2>
            <p className={`text-sm ${text.secondary}`}>
              {stats.totalRecords} {t('reports.recordsFound', 'records found')} 
              {selectedEmployee !== 'all' && ` for ${reportData.employees.find(emp => emp.id === parseInt(selectedEmployee))?.name}`}
              {` from ${filters.startDate} to ${filters.endDate}`}
            </p>
          </div>
          
          <div className="flex gap-3">
            <button
              onClick={() => {
                if (activeTab === 'time-entries') exportTimeEntries();
                else if (activeTab === 'tasks') exportTasks();
                else if (activeTab === 'goals') exportGoals();
              }}
              disabled={exporting || currentData.length === 0}
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
          </div>
        </div>
      </div>

      {/* Quick Filters */}
      <div className={`${bg.secondary} rounded-lg border ${border.primary} p-6`}>
        <h3 className={`text-lg font-semibold ${text.primary} mb-4`}>
          {t('reports.quickFilters', 'Quick Filters')}
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Employee Filter */}
          <div>
            <label className={`block text-sm font-medium ${text.primary} mb-2`}>
              <Users className="w-4 h-4 inline mr-1" />
              {t('reports.employee', 'Employee')}
            </label>
            <select
              value={selectedEmployee}
              onChange={(e) => setSelectedEmployee(e.target.value)}
              className={`w-full px-3 py-2 rounded-lg border ${border.primary} ${bg.primary} ${text.primary} focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
            >
              <option value="all">{t('reports.allEmployees', 'All Employees')} ({reportData.employees.length})</option>
              {reportData.employees.map(emp => (
                <option key={emp.id} value={emp.id}>
                  {emp.name} - {translateDepartment(emp.department)}
                </option>
              ))}
            </select>
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

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className={`${bg.secondary} border ${border.primary} rounded-lg p-6`}>
          <div className="flex items-center justify-between">
            <div>
              <p className={`text-sm ${text.secondary}`}>Total Records</p>
              <p className={`text-3xl font-bold ${text.primary}`}>{stats.totalRecords}</p>
            </div>
            <BarChart3 className={`w-8 h-8 ${text.secondary}`} />
          </div>
        </div>

        {activeTab === 'time-entries' && (
          <>
            <div className={`${bg.secondary} border ${border.primary} rounded-lg p-6`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className={`text-sm ${text.secondary}`}>Total Hours</p>
                  <p className={`text-3xl font-bold ${text.primary}`}>{stats.totalHours}h</p>
                </div>
                <Clock className={`w-8 h-8 ${text.secondary}`} />
              </div>
            </div>
            <div className={`${bg.secondary} border ${border.primary} rounded-lg p-6`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className={`text-sm ${text.secondary}`}>Approved</p>
                  <p className={`text-3xl font-bold text-green-600`}>{stats.approved}</p>
                </div>
                <CheckCircle className={`w-8 h-8 text-green-600`} />
              </div>
            </div>
            <div className={`${bg.secondary} border ${border.primary} rounded-lg p-6`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className={`text-sm ${text.secondary}`}>Pending</p>
                  <p className={`text-3xl font-bold text-yellow-600`}>{stats.pending}</p>
                </div>
                <PlayCircle className={`w-8 h-8 text-yellow-600`} />
              </div>
            </div>
          </>
        )}

        {activeTab === 'tasks' && (
          <>
            <div className={`${bg.secondary} border ${border.primary} rounded-lg p-6`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className={`text-sm ${text.secondary}`}>Completed</p>
                  <p className={`text-3xl font-bold text-green-600`}>{stats.completed}</p>
                </div>
                <CheckCircle className={`w-8 h-8 text-green-600`} />
              </div>
            </div>
            <div className={`${bg.secondary} border ${border.primary} rounded-lg p-6`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className={`text-sm ${text.secondary}`}>In Progress</p>
                  <p className={`text-3xl font-bold text-blue-600`}>{stats.inProgress}</p>
                </div>
                <PlayCircle className={`w-8 h-8 text-blue-600`} />
              </div>
            </div>
            <div className={`${bg.secondary} border ${border.primary} rounded-lg p-6`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className={`text-sm ${text.secondary}`}>Completion Rate</p>
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
                  <p className={`text-sm ${text.secondary}`}>Achieved</p>
                  <p className={`text-3xl font-bold text-green-600`}>{stats.achieved}</p>
                </div>
                <CheckCircle className={`w-8 h-8 text-green-600`} />
              </div>
            </div>
            <div className={`${bg.secondary} border ${border.primary} rounded-lg p-6`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className={`text-sm ${text.secondary}`}>In Progress</p>
                  <p className={`text-3xl font-bold text-blue-600`}>{stats.inProgress}</p>
                </div>
                <PlayCircle className={`w-8 h-8 text-blue-600`} />
              </div>
            </div>
            <div className={`${bg.secondary} border ${border.primary} rounded-lg p-6`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className={`text-sm ${text.secondary}`}>Avg Progress</p>
                  <p className={`text-3xl font-bold ${text.primary}`}>{stats.averageProgress}%</p>
                </div>
                <Target className={`w-8 h-8 ${text.secondary}`} />
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
                {activeTab === 'time-entries' && (
                  <>
                    <th className={`px-6 py-3 text-left text-xs font-medium ${text.secondary} uppercase tracking-wider`}>{t('employees.employee', 'Employee')}</th>
                    <th className={`px-6 py-3 text-left text-xs font-medium ${text.secondary} uppercase tracking-wider`}>{t('timeTracking.date', 'Date')}</th>
                    <th className={`px-6 py-3 text-left text-xs font-medium ${text.secondary} uppercase tracking-wider`}>{t('timeTracking.hours', 'Hours')}</th>
                    <th className={`px-6 py-3 text-left text-xs font-medium ${text.secondary} uppercase tracking-wider`}>{t('timeTracking.type', 'Type')}</th>
                    <th className={`px-6 py-3 text-left text-xs font-medium ${text.secondary} uppercase tracking-wider`}>{t('timeTracking.status', 'Status')}</th>
                  </>
                )}
                
                {activeTab === 'tasks' && (
                  <>
                    <th className={`px-6 py-3 text-left text-xs font-medium ${text.secondary} uppercase tracking-wider`}>{t('employees.employee', 'Employee')}</th>
                    <th className={`px-6 py-3 text-left text-xs font-medium ${text.secondary} uppercase tracking-wider`}>{t('workload.task', 'Task')}</th>
                    <th className={`px-6 py-3 text-left text-xs font-medium ${text.secondary} uppercase tracking-wider`}>{t('workload.priority', 'Priority')}</th>
                    <th className={`px-6 py-3 text-left text-xs font-medium ${text.secondary} uppercase tracking-wider`}>{t('workload.status', 'Status')}</th>
                    <th className={`px-6 py-3 text-left text-xs font-medium ${text.secondary} uppercase tracking-wider`}>{t('workload.dueDate', 'Due Date')}</th>
                  </>
                )}
                
                {activeTab === 'goals' && (
                  <>
                    <th className={`px-6 py-3 text-left text-xs font-medium ${text.secondary} uppercase tracking-wider`}>{t('employees.employee', 'Employee')}</th>
                    <th className={`px-6 py-3 text-left text-xs font-medium ${text.secondary} uppercase tracking-wider`}>{t('performance.goal', 'Goal')}</th>
                    <th className={`px-6 py-3 text-left text-xs font-medium ${text.secondary} uppercase tracking-wider`}>{t('performance.category', 'Category')}</th>
                    <th className={`px-6 py-3 text-left text-xs font-medium ${text.secondary} uppercase tracking-wider`}>{t('performance.status', 'Status')}</th>
                    <th className={`px-6 py-3 text-left text-xs font-medium ${text.secondary} uppercase tracking-wider`}>{t('performance.progress', 'Progress')}</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {currentData.length === 0 ? (
                <tr>
                  <td colSpan={5} className={`px-6 py-12 text-center ${text.secondary}`}>
                    <div className="flex flex-col items-center">
                      <FileText className="w-12 h-12 mb-4 opacity-50" />
                      <p className="text-lg font-medium mb-2">{t('reports.noData', 'No data found')}</p>
                      <p className="text-sm">{t('reports.adjustFilters', 'Try adjusting your filters or date range')}</p>
                    </div>
                  </td>
                </tr>
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
                            {item.hour_type}
                          </span>
                        </td>
                        <td className={`px-6 py-4 whitespace-nowrap`}>
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            item.status === 'approved' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
                            item.status === 'pending' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' :
                            'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                          }`}>
                            {item.status}
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
                            {item.priority}
                          </span>
                        </td>
                        <td className={`px-6 py-4 whitespace-nowrap`}>
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            item.status === 'completed' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
                            item.status === 'in-progress' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' :
                            'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
                          }`}>
                            {item.status}
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
                        <td className={`px-6 py-4 whitespace-nowrap text-sm ${text.primary}`}>{item.category}</td>
                        <td className={`px-6 py-4 whitespace-nowrap`}>
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            item.status === 'achieved' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
                            item.status === 'in-progress' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' :
                            'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
                          }`}>
                            {item.status}
                          </span>
                        </td>
                        <td className={`px-6 py-4 whitespace-nowrap ${text.primary}`}>
                          <div className="flex items-center">
                            <div className={`w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mr-3`}>
                              <div 
                                className="bg-blue-600 h-2 rounded-full" 
                                style={{width: `${Math.min(item.progress || 0, 100)}%`}}
                              ></div>
                            </div>
                            <span className="text-sm font-medium">{item.progress || 0}%</span>
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