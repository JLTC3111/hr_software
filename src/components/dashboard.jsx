import React, { useState, useEffect } from 'react'
import { Users, Briefcase, Clock, Calendar, AlertCircle, DatabaseZap, Loader } from 'lucide-react'
import StatsCard from './statsCard.jsx'
import { useTheme } from '../contexts/ThemeContext'
import { useLanguage } from '../contexts/LanguageContext'
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import * as timeTrackingService from '../services/timeTrackingService'

const Dashboard = ({ employees, applications }) => {
  const { isDarkMode, bg, text, border } = useTheme();
  const { t } = useLanguage();
  
  // State for real-time data
  const [loading, setLoading] = useState(true);
  const [timeTrackingData, setTimeTrackingData] = useState({});
  const [pendingApprovalsCount, setPendingApprovalsCount] = useState(0);
  
  // Get current month and year
  const currentDate = new Date();
  const currentMonth = currentDate.getMonth() + 1;
  const currentYear = currentDate.getFullYear();
  
  // Fetch real data from Supabase
  useEffect(() => {
    const fetchDashboardData = async () => {
      setLoading(true);
      try {
        // Fetch time tracking summaries for all employees for current month
        const summariesPromises = employees.map(emp => 
          timeTrackingService.getTimeTrackingSummary(String(emp.id), currentMonth, currentYear)
        );
        
        const summariesResults = await Promise.all(summariesPromises);
        
        // Build timeTrackingData object - use string IDs for consistency with TEXT type
        const trackingData = {};
        summariesResults.forEach((result, index) => {
          if (result.success && result.data) {
            const emp = employees[index];
            const empId = String(emp.id); // Ensure ID is string for TEXT type
            trackingData[empId] = {
              workDays: result.data.days_worked || 0,
              leaveDays: result.data.leave_days || 0,
              overtime: result.data.overtime_hours || 0,
              performance: emp.performance || 4.0 // Use employee's base performance
            };
          } else {
            // Fallback to defaults if no data
            const emp = employees[index];
            const empId = String(emp.id); // Ensure ID is string for TEXT type
            trackingData[empId] = {
              workDays: 0,
              leaveDays: 0,
              overtime: 0,
              performance: emp.performance || 4.0
            };
          }
        });
        
        setTimeTrackingData(trackingData);
        
        // Fetch pending approvals count
        const approvalsResult = await timeTrackingService.getPendingApprovalsCount();
        if (approvalsResult.success) {
          setPendingApprovalsCount(approvalsResult.data.total || 0);
        }
        
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };
    
    if (employees.length > 0) {
      fetchDashboardData();
    }
  }, [employees, currentMonth, currentYear]);

  // Calculate aggregate stats
  const trackingDataValues = Object.values(timeTrackingData);
  const totalWorkDays = trackingDataValues.reduce((sum, emp) => sum + (emp?.workDays || 0), 0);
  const totalLeaveDays = trackingDataValues.reduce((sum, emp) => sum + (emp?.leaveDays || 0), 0);
  const totalOvertime = trackingDataValues.reduce((sum, emp) => sum + (emp?.overtime || 0), 0).toFixed(1);
  const avgPerformance = trackingDataValues.length > 0 
    ? (trackingDataValues.reduce((sum, emp) => sum + (emp?.performance || 0), 0) / trackingDataValues.length).toFixed(1)
    : '0.0';
  
  // Check if we have any real data
  const hasRealData = trackingDataValues.some(emp => emp?.workDays > 0 || emp?.overtime > 0);

  // Performance data for bar chart
  const performanceData = employees.map(emp => ({
    name: emp.name.split(' ').slice(-1)[0], // Last name only
    performance: timeTrackingData[String(emp.id)]?.performance || 4.0,
    overtime: timeTrackingData[String(emp.id)]?.overtime || 0
  }));

  // Department distribution for pie chart
  const departmentCounts = employees.reduce((acc, emp) => {
    acc[emp.department] = (acc[emp.department] || 0) + 1;
    return acc;
  }, {});

  const departmentData = Object.entries(departmentCounts).map(([dept, count]) => ({
    name: t(`departments.${dept}`, dept),
    value: count
  }));

  // Leave requests summary
  const leaveData = employees.slice(0, 5).map(emp => ({
    name: emp.name.split(' ').slice(-1)[0],
    leaveDays: timeTrackingData[String(emp.id)]?.leaveDays || 0,
    workDays: timeTrackingData[String(emp.id)]?.workDays || 0
  }));

  // Chart colors
  const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4'];
  
  // Top performers
  const topPerformers = employees
    .map(emp => ({
      ...emp,
      performance: timeTrackingData[String(emp.id)]?.performance || 4.0,
      overtime: timeTrackingData[String(emp.id)]?.overtime || 0
    }))
    .sort((a, b) => b.performance - a.performance)
    .slice(0, 5);

  return (
    <div className="space-y-6">
      {loading && (
        <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
          <div className={`${bg.secondary} rounded-lg p-6 flex items-center space-x-3`}>
            <Loader className="w-6 h-6 animate-spin text-blue-600" />
            <span className={text.primary}>{t('common.loading', 'Loading dashboard...')}</span>
          </div>
        </div>
      )}
      <div className={`${bg.secondary} rounded-lg border ${border.primary} p-3 flex items-center justify-between`}>
        <div className="flex items-center space-x-2">
          <DatabaseZap className={`w-4 h-4 ${hasRealData ? 'text-green-600' : 'text-yellow-600'}`} />
          <span className={`text-sm ${text.secondary}`}>
            {hasRealData 
              ? `${t('dashboard.liveData', 'Live data from Supabase')} • ${t('dashboard.currentMonth', 'Current month')}: ${currentMonth}/${currentYear}`
              : `${t('dashboard.noData', 'No time tracking data yet')} • ${t('dashboard.currentMonth', 'Current month')}: ${currentMonth}/${currentYear}`
            }
          </span>
        </div>
        <button
          onClick={() => window.location.reload()}
          className="text-xs text-blue-600 hover:text-blue-700 font-medium"
        >
          {t('common.refresh', 'Refresh')}
        </button>
      </div>
      
      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatsCard 
          title={t('dashboard.totalEmployees')} 
          value={employees.length} 
          icon={Users} 
          color={isDarkMode ? "#ffffff" : "#1f1f1f"}
          size={12}
        />
        <StatsCard 
          title={t('dashboard.avgPerformance')} 
          value={avgPerformance} 
          icon={DatabaseZap} 
          color={isDarkMode ? "#ffffff" : "#1f1f1f"}
        />
        <StatsCard 
          title={t('dashboard.totalOvertime')} 
          value={`${totalOvertime}h`} 
          icon={Clock} 
          color={isDarkMode ? "#ffffff" : "#1f1f1f"}
        />
        <StatsCard 
          title={t('dashboard.totalLeave')} 
          value={totalLeaveDays} 
          icon={Calendar} 
          color={isDarkMode ? "#ffffff" : "#1f1f1f"}
        />
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Employee Performance Chart */}
        <div className={`${bg.secondary} rounded-lg shadow-sm border ${border.primary} p-6`}>
          <h3 className={`text-lg font-semibold ${text.primary} mb-4`}>
            {t('dashboard.employeePerformance')}
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={performanceData}>
              <CartesianGrid strokeDasharray="3 3" stroke={isDarkMode ? '#374151' : '#E5E7EB'} />
              <XAxis dataKey="name" stroke={isDarkMode ? '#9CA3AF' : '#6B7280'} />
              <YAxis stroke={isDarkMode ? '#9CA3AF' : '#6B7280'} domain={[0, 5]} />
              <Tooltip
                  contentStyle={{
                    backgroundColor: isDarkMode ? '#1F2937' : '#FFFFFF',
                    border: `1px solid ${isDarkMode ? '#374151' : '#E5E7EB'}`,
                    borderRadius: '8px',
                  }}
                  itemStyle={{
                    color: isDarkMode ? '#FFFFFF' : '#111827',
                  }}
                  labelStyle={{
                    color: isDarkMode ? '#FFFFFF' : '#111827',
                  }}
                />
              <Legend />
              <Bar dataKey="performance" fill="#3B82F6" name="Performance Rating" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Department Distribution */}
        <div className={`${bg.secondary} rounded-lg shadow-sm border ${border.primary} p-6`}>
          <h3 className={`text-lg font-semibold ${text.primary} mb-4`}>
            {t('dashboard.departmentDist')}
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={departmentData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                outerRadius={100}
                fill="#8884d8"
                dataKey="value"
              >
                {departmentData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                  contentStyle={{
                    backgroundColor: isDarkMode ? '#1F2937' : '#FFFFFF',
                    border: `1px solid ${isDarkMode ? '#374151' : '#E5E7EB'}`,
                    borderRadius: '8px',
                  }}
                  itemStyle={{
                    color: isDarkMode ? '#FFFFFF' : '#111827',
                  }}
                  labelStyle={{
                    color: isDarkMode ? '#FFFFFF' : '#111827',
                  }}
                />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Work & Leave Days Comparison */}
        <div className={`${bg.secondary} rounded-lg shadow-sm border ${border.primary} p-6`}>
          <h3 className={`text-lg font-semibold ${text.primary} mb-4`}>
            {t('dashboard.workLeaveComp')}
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={leaveData}>
              <CartesianGrid strokeDasharray="3 3" stroke={isDarkMode ? '#374151' : '#E5E7EB'} />
              <XAxis dataKey="name" stroke={isDarkMode ? '#9CA3AF' : '#6B7280'} />
              <YAxis stroke={isDarkMode ? '#9CA3AF' : '#6B7280'} />
              <Tooltip
                  contentStyle={{
                    backgroundColor: isDarkMode ? '#1F2937' : '#FFFFFF',
                    border: `1px solid ${isDarkMode ? '#374151' : '#E5E7EB'}`,
                    borderRadius: '8px',
                  }}
                  itemStyle={{
                    color: isDarkMode ? '#FFFFFF' : '#111827',
                  }}
                  labelStyle={{
                    color: isDarkMode ? '#FFFFFF' : '#111827',
                  }}
                />
              <Legend />
              <Bar dataKey="workDays" fill="#10B981" name="Work Days" radius={[8, 8, 0, 0]} />
              <Bar dataKey="leaveDays" fill="#EF4444" name="Leave Days" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Top Performers */}
        <div className={`${bg.secondary} rounded-lg shadow-sm border ${border.primary} p-6`}>
          <h3 className={`text-lg font-semibold ${text.primary} mb-4`}>
            {t('dashboard.topPerformers')}
          </h3>
          <div className="space-y-3">
            {topPerformers.map((emp, index) => (
              <div key={emp.id} className={`flex items-center justify-between p-3 rounded-lg ${isDarkMode ? 'bg-gray-700' : 'bg-gray-50'}`}>
                <div className="flex items-center space-x-3">
                  {emp.photo ? (
                    <img 
                      src={emp.photo} 
                      alt={emp.name}
                      className="w-10 h-10 rounded-full object-cover border-2 border-gray-200 dark:border-gray-600"
                    />
                  ) : (
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-white ${
                      index === 0 ? 'bg-yellow-500' :
                      index === 1 ? 'bg-gray-400' :
                      index === 2 ? 'bg-orange-600' :
                      'bg-blue-500'
                    }`}>
                      {emp.name.charAt(0)}
                    </div>
                  )}
                  <div>
                    <p className={`font-medium ${text.primary}`}>{emp.name}</p>
                    <p className={`text-sm ${text.secondary}`}>
                      {t(`positions.${emp.position}`)}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={`font-bold text-lg ${text.primary}`}>{emp.performance}</p>
                  <p className={`text-xs ${text.secondary}`}>{emp.overtime}h {t('dashboard.overtime')}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Additional Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className={`${bg.secondary} rounded-lg shadow-sm border ${border.primary} p-6`}>
          <div className="flex items-center space-x-3 mb-2">
            <Clock className="w-5 h-5 text-blue-600" />
            <h4 className={`font-semibold ${text.primary}`}>
              {t('dashboard.totalWorkDays')}
            </h4>
          </div>
          <p className={`text-3xl font-bold ${text.primary}`}>{totalWorkDays}</p>
          <p className={`text-sm ${text.secondary} mt-1`}>
            {t('dashboard.acrossEmployees')}
          </p>
        </div>

        <div className={`${bg.secondary} rounded-lg shadow-sm border ${border.primary} p-6`}>
          <div className="flex items-center space-x-3 mb-2">
            <Briefcase className="w-5 h-5 text-green-600" />
            <h4 className={`font-semibold ${text.primary}`}>
              {t('dashboard.activeApplications')}
            </h4>
          </div>
          <p className={`text-3xl font-bold ${text.primary}`}>{applications.length}</p>
          <p className={`text-sm ${text.secondary} mt-1`}>
            {t('dashboard.pendingReview')}
          </p>
        </div>

        <div className={`${bg.secondary} rounded-lg shadow-sm border ${border.primary} p-6`}>
          <div className="flex items-center space-x-3 mb-2">
            <AlertCircle className="w-5 h-5 text-orange-600" />
            <h4 className={`font-semibold ${text.primary}`}>
              {t('dashboard.pendingRequests')}
            </h4>
          </div>
          <p className={`text-3xl font-bold ${text.primary}`}>{pendingApprovalsCount}</p>
          <p className={`text-sm ${text.secondary} mt-1`}>
            {t('dashboard.pendingApprovals', 'Pending approvals')}
          </p>
        </div>
      </div>
    </div>
  );
};
export default Dashboard;
