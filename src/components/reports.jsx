import React, { useState } from 'react';
import { BarChart3, PieChart, TrendingUp, Download, Calendar, Users, DollarSign, Award, Clock, Filter, RefreshCw } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';

const Reports = ({ employees, applications }) => {
  const [selectedReport, setSelectedReport] = useState('overview');
  const [dateRange, setDateRange] = useState('last-quarter');
  const [department, setDepartment] = useState('all');
  const { t } = useLanguage();
  const { isDarkMode } = useTheme();

  // Sample report data - in a real app, this would come from your API
  const reportData = {
    overview: {
      totalEmployees: employees.length,
      newHires: 5,
      turnoverRate: 8.5,
      avgSalary: 78000,
      satisfaction: 4.2,
      productivity: 92
    },
    departmentStats: [
      { name: 'Engineering', employees: 25, avgSalary: 95000, performance: 4.5, color: 'bg-blue-500' },
      { name: 'Sales', employees: 15, avgSalary: 70000, performance: 4.2, color: 'bg-green-500' },
      { name: 'Marketing', employees: 12, avgSalary: 65000, performance: 4.0, color: 'bg-purple-500' },
      { name: 'HR', employees: 8, avgSalary: 60000, performance: 4.3, color: 'bg-orange-500' },
      { name: 'Design', employees: 10, avgSalary: 72000, performance: 4.4, color: 'bg-pink-500' }
    ],
    attendance: {
      present: 85,
      absent: 8,
      leave: 7
    },
    recruitment: {
      totalApplications: 150,
      interviewed: 45,
      hired: 8,
      rejected: 97
    },
    performance: [
      { month: 'Jan', rating: 4.1 },
      { month: 'Feb', rating: 4.2 },
      { month: 'Mar', rating: 4.0 },
      { month: 'Apr', rating: 4.3 },
      { month: 'May', rating: 4.4 },
      { month: 'Jun', rating: 4.2 }
    ]
  };

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
    t('departments.design')
  ];

  const StatCard = ({ title, value, subtitle, icon: Icon, color, trend }) => (
    <div 
      className="rounded-lg shadow-sm border p-6 transition-all duration-300 hover:shadow-lg hover:-translate-y-1 cursor-pointer group scale-in"
      style={{
        backgroundColor: isDarkMode ? '#374151' : '#ffffff',
        color: isDarkMode ? '#ffffff' : '#111827',
        borderColor: isDarkMode ? '#4b5563' : '#d1d5db'
      }}
    >
      <div className="flex items-center justify-between">
        <div>
          <p 
            className="text-sm font-medium transition-colors duration-200"
            style={{
              backgroundColor: 'transparent',
              color: isDarkMode ? '#d1d5db' : '#4b5563',
              borderColor: 'transparent'
            }}
          >
            {title}
          </p>
          <p 
            className={`text-2xl font-bold ${color} mt-1 transition-all duration-200 group-hover:scale-105`}
            style={{
              backgroundColor: 'transparent',
              borderColor: 'transparent'
            }}
          >
            {value}
          </p>
          {subtitle && (
            <p 
              className="text-sm mt-1"
              style={{
                backgroundColor: 'transparent',
                color: isDarkMode ? '#9ca3af' : '#6b7280',
                borderColor: 'transparent'
              }}
            >
              {subtitle}
            </p>
          )}
        </div>
        <div className={`p-3 rounded-full ${color.replace('text-', 'bg-').replace('-600', '-100')} transition-transform duration-300 group-hover:scale-110 group-hover:rotate-6`}>
          <Icon className={`h-6 w-6 ${color}`} />
        </div>
      </div>
      {trend && (
        <div className="mt-4 flex items-center">
          <TrendingUp className="h-4 w-4 text-green-500 mr-1" />
          <span className="text-sm text-green-600">{trend}% {t('reports.fromLastPeriod')}</span>
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
          <div key={dept.name} className="flex items-center justify-between">
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
                {dept.name}
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
              <span>{dept.performance}/5.0 ⭐</span>
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
              <div className="bg-green-500 h-2 rounded-full" style={{ width: `${reportData.attendance.present}%` }}></div>
            </div>
            <span 
              className="text-sm font-medium"
              style={{
                backgroundColor: 'transparent',
                color: isDarkMode ? '#ffffff' : '#111827',
                borderColor: 'transparent'
              }}
            >
              {reportData.attendance.present}%
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
              <div className="bg-yellow-500 h-2 rounded-full" style={{ width: `${reportData.attendance.leave}%` }}></div>
            </div>
            <span 
              className="text-sm font-medium"
              style={{
                backgroundColor: 'transparent',
                color: isDarkMode ? '#ffffff' : '#111827',
                borderColor: 'transparent'
              }}
            >
              {reportData.attendance.leave}%
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
              <div className="bg-red-500 h-2 rounded-full" style={{ width: `${reportData.attendance.absent}%` }}></div>
            </div>
            <span 
              className="text-sm font-medium"
              style={{
                backgroundColor: 'transparent',
                color: isDarkMode ? '#ffffff' : '#111827',
                borderColor: 'transparent'
              }}
            >
              {reportData.attendance.absent}%
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
          { label: t('reports.totalApplications'), value: reportData.recruitment.totalApplications, color: 'bg-blue-500' },
          { label: t('reports.interviewed'), value: reportData.recruitment.interviewed, color: 'bg-yellow-500' },
          { label: t('reports.hired'), value: reportData.recruitment.hired, color: 'bg-green-500' },
          { label: t('reports.rejected'), value: reportData.recruitment.rejected, color: 'bg-red-500' }
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
        {reportData.performance.map((item, index) => (
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
      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <StatCard
          title={t('reports.totalEmployees')}
          value={reportData.overview.totalEmployees}
          icon={Users}
          color="text-blue-600"
          trend="+5.2"
        />
        <StatCard
          title={t('reports.newHires')}
          value={reportData.overview.newHires}
          subtitle={t('reports.thisQuarter')}
          icon={TrendingUp}
          color="text-green-600"
          trend="+12.5"
        />
        <StatCard
          title={t('reports.turnoverRate')}
          value={`${reportData.overview.turnoverRate}%`}
          subtitle={t('reports.annualRate')}
          icon={RefreshCw}
          color="text-orange-600"
          trend="-2.1"
        />
        <StatCard
          title={t('reports.avgSalary')}
          value={`$${reportData.overview.avgSalary.toLocaleString()}`}
          icon={DollarSign}
          color="text-purple-600"
          trend="+3.8"
        />
        <StatCard
          title={t('reports.satisfaction')}
          value={`${reportData.overview.satisfaction}/5.0`}
          icon={Award}
          color="text-pink-600"
          trend="+0.3"
        />
        <StatCard
          title={t('reports.productivity')}
          value={`${reportData.overview.productivity}%`}
          icon={Clock}
          color="text-indigo-600"
          trend="+1.5"
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
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              style={{
                backgroundColor: isDarkMode ? '#4b5563' : '#ffffff',
                color: isDarkMode ? '#ffffff' : '#111827',
                borderColor: isDarkMode ? '#6b7280' : '#d1d5db'
              }}
            >
              <option>{t('reports.employeePerformance')}</option>
              <option>{t('reports.salaryAnalysis')}</option>
              <option>{t('reports.attendanceReport')}</option>
              <option>{t('reports.recruitmentMetrics')}</option>
              <option>{t('reports.departmentComparison')}</option>
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
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center space-x-2"
            style={{
              backgroundColor: '#2563eb',
              color: '#ffffff',
              borderColor: '#2563eb'
            }}
          >
            <BarChart3 className="h-4 w-4" />
            <span>{t('reports.generateReport')}</span>
          </button>
          <button 
            className="px-6 py-2 border rounded-lg hover:bg-gray-50 flex items-center space-x-2"
            style={{
              backgroundColor: isDarkMode ? '#4b5563' : '#ffffff',
              color: isDarkMode ? '#d1d5db' : '#374151',
              borderColor: isDarkMode ? '#6b7280' : '#d1d5db'
            }}
          >
            <Download className="h-4 w-4" />
            <span>{t('reports.exportToPDF')}</span>
          </button>
          <button 
            className="px-6 py-2 border rounded-lg hover:bg-gray-50 flex items-center space-x-2"
            style={{
              backgroundColor: isDarkMode ? '#4b5563' : '#ffffff',
              color: isDarkMode ? '#d1d5db' : '#374151',
              borderColor: isDarkMode ? '#6b7280' : '#d1d5db'
            }}
          >
            <Download className="h-4 w-4" />
            <span>{t('reports.exportToExcel')}</span>
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
            { name: t('reports.monthlyPerformanceReview'), description: t('reports.comprehensivePerformanceAnalysis'), icon: Award },
            { name: t('reports.salaryBenchmarking'), description: t('reports.compareSalariesAcrossDepartments'), icon: DollarSign },
            { name: t('reports.attendanceAnalytics'), description: t('reports.trackAttendancePatterns'), icon: Calendar },
            { name: t('reports.recruitmentPipeline'), description: t('reports.monitorHiringProcess'), icon: Users },
            { name: t('reports.employeeTurnover'), description: t('reports.analyzeRetentionRates'), icon: TrendingUp },
            { name: t('reports.trainingEffectiveness'), description: t('reports.measureTrainingSuccess'), icon: Award }
          ].map((report, index) => (
            <div 
              key={index} 
              className="border rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer"
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
              <button className="text-blue-600 hover:text-blue-800 text-sm font-medium">
                {t('reports.generate')}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-4 md:space-y-6 px-2 sm:px-0">
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
            className="px-4 py-2 border rounded-lg hover:bg-gray-50 flex items-center space-x-2 transition-all duration-200 hover:scale-105 hover:shadow-md"
            style={{
              backgroundColor: isDarkMode ? '#4b5563' : '#ffffff',
              color: isDarkMode ? '#d1d5db' : '#374151',
              borderColor: isDarkMode ? '#6b7280' : '#d1d5db'
            }}
          >
            <Filter className="h-4 w-4" />
            <span>{t('reports.filters')}</span>
          </button>
          <button 
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center space-x-2 transition-all duration-200 hover:scale-105 hover:shadow-lg"
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
                  ? '#2563eb' 
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
      {selectedReport === 'overview' && <OverviewTab />}
      {selectedReport === 'detailed' && <DetailedReportsTab />}
    </div>
  );
};

export default Reports;
