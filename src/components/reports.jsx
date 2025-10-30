import React, { useState, useEffect } from 'react';
import { BarChart3, PieChart, TrendingUp, Download, Calendar, Users, DollarSign, Award, Clock, Filter, RefreshCw, Loader } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';
import * as reportService from '../services/reportService';
import MetricDetailModal from './metricDetailModal.jsx';

const Reports = () => {
  const [selectedReport, setSelectedReport] = useState('overview');
  const [dateRange, setDateRange] = useState('last-quarter');
  const [department, setDepartment] = useState('all');
  const [loading, setLoading] = useState(true);
  const [timeTrackingData, setTimeTrackingData] = useState({});
  const [modalOpen, setModalOpen] = useState(false);
  const [modalConfig, setModalConfig] = useState({ type: '', data: [], title: '' });
  const [reportType, setReportType] = useState('performance');
  const [generatedReport, setGeneratedReport] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [reportData, setReportData] = useState(null);
  const [performanceTrend, setPerformanceTrend] = useState([]);
  const { t } = useLanguage();
  const { isDarkMode } = useTheme();
  
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
    t('departments.engineering'), 
    t('departments.sales'), 
    t('departments.marketing'), 
    t('departments.humanresources'), 
    t('departments.design'),
    t('departments.legal_compliance'),
    t('departments.internal_affairs'),
    t('departments.office_unit'),
    t('departments.board_of_directors')
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
    if (!data || (Array.isArray(data) && data.length === 0)) {
      alert(t('reports.noDataToExport', 'No data to export'));
      return;
    }
    
    reportService.exportToCSV(data, filename);
  };

  // Handle export all data
  const handleExportAll = async () => {
    try {
      const { supabase } = await import('../config/supabaseClient');
      
      const { data: allEmployees, error } = await supabase
        .from('employees')
        .select('name, department, position, email, phone, status, salary, start_date');
      
      if (error) throw error;
      
      const exportData = allEmployees.map(emp => ({
        Name: emp.name,
        Department: emp.department,
        Position: emp.position,
        Email: emp.email,
        Phone: emp.phone,
        Status: emp.status,
        Salary: emp.salary,
        StartDate: emp.start_date
      }));
      
      handleExportCSV(exportData, 'all_employees');
    } catch (error) {
      console.error('Error exporting data:', error);
      alert(t('reports.errorExporting', 'Error exporting data'));
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
                  className="bg-blue-500 h-2 rounded-full" 
                  style={{ width: `${(item.rating / 5) * 100}%` }}
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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <StatCard
          title={t('reports.totalEmployees')}
          value={reportData.overview.totalEmployees}
          icon={Users}
          onClick={() => handleMetricClick('employees')}
        />
        <StatCard
          title={t('reports.newHires')}
          value={reportData.overview.newHires}
          subtitle={t('reports.thisQuarter')}
          icon={TrendingUp}
          onClick={() => handleMetricClick('newHires')}
        />
        <StatCard
          title={t('reports.avgSalary')}
          value={`$${reportData.overview.avgSalary.toLocaleString()}`}
          icon={DollarSign}
        />
        <StatCard
          title={t('reports.satisfaction')}
          value={`${reportData.overview.satisfaction}/5.0`}
          icon={Award}
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
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-all"
            style={{
              backgroundColor: '#2563eb',
              color: '#ffffff',
              borderColor: '#2563eb'
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
                <report.icon className="h-5 w-5 text-blue-600" />
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
                className="text-blue-600 hover:text-blue-800 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-all"
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
            <Loader className="w-6 h-6 animate-spin text-blue-600" />
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
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center space-x-2 transition-all duration-200 hover:scale-105 hover:shadow-lg cursor-pointer"
            style={{
              backgroundColor: '#2563eb',
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
                <option value="all">{t('reports.allDepartments', 'All Departments')}</option>
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
                <option value="performance">{t('reports.performance', 'Performance')}</option>
                <option value="salary">{t('reports.salary', 'Salary')}</option>
                <option value="attendance">{t('reports.attendance', 'Attendance')}</option>
                <option value="recruitment">{t('reports.recruitment', 'Recruitment')}</option>
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
          <Loader className="w-8 h-8 animate-spin text-blue-600" />
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
