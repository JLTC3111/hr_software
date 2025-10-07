import React from 'react'
import { Users, Briefcase, FileText, TrendingUp, Clock, Calendar, Award, AlertCircle } from 'lucide-react'
import StatsCard from './statsCard.jsx'
import { useTheme } from '../contexts/ThemeContext'
import { useLanguage } from '../contexts/LanguageContext'
import { BarChart, Bar, PieChart, Pie, Cell, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

const Dashboard = ({ employees, applications }) => {
  const { isDarkMode, bg, text, border } = useTheme();
  const { t } = useLanguage();

  // Mock time tracking data for employees
  const timeTrackingData = {
    1: { workDays: 22, leaveDays: 3, overtime: 15.5, performance: 4.8 },
    2: { workDays: 20, leaveDays: 5, overtime: 12, performance: 4.5 },
    3: { workDays: 23, leaveDays: 2, overtime: 18, performance: 4.9 },
    4: { workDays: 21, leaveDays: 4, overtime: 10, performance: 4.3 },
    5: { workDays: 22, leaveDays: 3, overtime: 14, performance: 4.6 },
    6: { workDays: 24, leaveDays: 1, overtime: 20, performance: 4.9 },
    7: { workDays: 19, leaveDays: 6, overtime: 8, performance: 4.0 }
  };

  // Calculate aggregate stats
  const totalWorkDays = Object.values(timeTrackingData).reduce((sum, emp) => sum + emp.workDays, 0);
  const totalLeaveDays = Object.values(timeTrackingData).reduce((sum, emp) => sum + emp.leaveDays, 0);
  const totalOvertime = Object.values(timeTrackingData).reduce((sum, emp) => sum + emp.overtime, 0);
  const avgPerformance = (Object.values(timeTrackingData).reduce((sum, emp) => sum + emp.performance, 0) / Object.keys(timeTrackingData).length).toFixed(1);

  // Performance data for bar chart
  const performanceData = employees.map(emp => ({
    name: emp.name.split(' ').slice(-1)[0], // Last name only
    performance: timeTrackingData[emp.id]?.performance || 4.0,
    overtime: timeTrackingData[emp.id]?.overtime || 0
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
    leaveDays: timeTrackingData[emp.id]?.leaveDays || 0,
    workDays: timeTrackingData[emp.id]?.workDays || 0
  }));

  // Chart colors
  const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4'];
  
  // Top performers
  const topPerformers = employees
    .map(emp => ({
      ...emp,
      performance: timeTrackingData[emp.id]?.performance || 4.0,
      overtime: timeTrackingData[emp.id]?.overtime || 0
    }))
    .sort((a, b) => b.performance - a.performance)
    .slice(0, 5);

  return (
    <div className="space-y-6">
      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatsCard 
          title={t('dashboard.totalEmployees')} 
          value={employees.length} 
          icon={Users} 
          color="text-blue-600" 
        />
        <StatsCard 
          title={t('dashboard.avgPerformance', 'Avg Performance')} 
          value={avgPerformance} 
          icon={Award} 
          color="text-purple-600" 
        />
        <StatsCard 
          title={t('dashboard.totalOvertime', 'Total Overtime')} 
          value={`${totalOvertime}h`} 
          icon={Clock} 
          color="text-orange-600" 
        />
        <StatsCard 
          title={t('dashboard.totalLeave', 'Total Leave Days')} 
          value={totalLeaveDays} 
          icon={Calendar} 
          color="text-green-600" 
        />
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Employee Performance Chart */}
        <div className={`${bg.secondary} rounded-lg shadow-sm border ${border.primary} p-6`}>
          <h3 className={`text-lg font-semibold ${text.primary} mb-4`}>
            {t('dashboard.employeePerformance', 'Employee Performance')}
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
            {t('dashboard.departmentDist', 'Department Distribution')}
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
            {t('dashboard.workLeaveComp', 'Work vs Leave Days')}
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
            {t('dashboard.topPerformers', 'Top Performers')}
          </h3>
          <div className="space-y-3">
            {topPerformers.map((emp, index) => (
              <div key={emp.id} className={`flex items-center justify-between p-3 rounded-lg ${isDarkMode ? 'bg-gray-700' : 'bg-gray-50'}`}>
                <div className="flex items-center space-x-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${
                    index === 0 ? 'bg-yellow-500 text-white' :
                    index === 1 ? 'bg-gray-400 text-white' :
                    index === 2 ? 'bg-orange-600 text-white' :
                    'bg-blue-500 text-white'
                  }`}>
                    {index + 1}
                  </div>
                  <div>
                    <p className={`font-medium ${text.primary}`}>{emp.name}</p>
                    <p className={`text-sm ${text.secondary}`}>
                      {t(`positions.${emp.position}`, emp.position)}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={`font-bold text-lg ${text.primary}`}>{emp.performance}</p>
                  <p className={`text-xs ${text.secondary}`}>{emp.overtime}h OT</p>
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
              {t('dashboard.totalWorkDays', 'Total Work Days')}
            </h4>
          </div>
          <p className={`text-3xl font-bold ${text.primary}`}>{totalWorkDays}</p>
          <p className={`text-sm ${text.secondary} mt-1`}>
            {t('dashboard.acrossEmployees', 'Across all employees this month')}
          </p>
        </div>

        <div className={`${bg.secondary} rounded-lg shadow-sm border ${border.primary} p-6`}>
          <div className="flex items-center space-x-3 mb-2">
            <Briefcase className="w-5 h-5 text-green-600" />
            <h4 className={`font-semibold ${text.primary}`}>
              {t('dashboard.activeApplications', 'Active Applications')}
            </h4>
          </div>
          <p className={`text-3xl font-bold ${text.primary}`}>{applications.length}</p>
          <p className={`text-sm ${text.secondary} mt-1`}>
            {t('dashboard.pendingReview', 'Pending review')}
          </p>
        </div>

        <div className={`${bg.secondary} rounded-lg shadow-sm border ${border.primary} p-6`}>
          <div className="flex items-center space-x-3 mb-2">
            <AlertCircle className="w-5 h-5 text-orange-600" />
            <h4 className={`font-semibold ${text.primary}`}>
              {t('dashboard.pendingRequests', 'Pending Requests')}
            </h4>
          </div>
          <p className={`text-3xl font-bold ${text.primary}`}>{totalLeaveDays}</p>
          <p className={`text-sm ${text.secondary} mt-1`}>
            {t('dashboard.leaveRequests', 'Leave requests to review')}
          </p>
        </div>
      </div>
    </div>
  );
};
export default Dashboard;
