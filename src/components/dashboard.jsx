import React, { useState, useEffect } from 'react'
import { Users, Briefcase, Clock, Calendar, AlertCircle, DatabaseZap, Loader, Funnel } from 'lucide-react'
import StatsCard from './statsCard.jsx'
import MetricDetailModal from './metricDetailModal.jsx'
import { useTheme } from '../contexts/ThemeContext'
import { useLanguage } from '../contexts/LanguageContext'
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Line, ReferenceLine, ComposedChart } from 'recharts'
import * as timeTrackingService from '../services/timeTrackingService'

const Dashboard = ({ employees, applications }) => {
  const { isDarkMode, bg, text, border } = useTheme();
  const { t } = useLanguage();
  
  const [loading, setLoading] = useState(true);
  const [timeTrackingData, setTimeTrackingData] = useState({});
  const [allEmployeesData, setAllEmployeesData] = useState([]);
  const [leaveRequestsData, setLeaveRequestsData] = useState({});
  const [pendingApprovalsCount, setPendingApprovalsCount] = useState(0);
  const [pendingApprovals, setPendingApprovals] = useState([]);
  
  const [modalOpen, setModalOpen] = useState(false);
  const [modalConfig, setModalConfig] = useState({ type: '', data: [], title: '' });
  
  const currentDate = new Date();
  const [selectedMonth, setSelectedMonth] = useState(currentDate.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear());
  
  // Fetch real data from Supabase
  useEffect(() => {
    const fetchDashboardData = async () => {
      setLoading(true);
      try {
        
        // Fetch time tracking summaries for all employees for SELECTED month
        const summariesPromises = employees.map(emp => 
          timeTrackingService.getTimeTrackingSummary(String(emp.id), selectedMonth, selectedYear)
        );
        
        console.log('📊 [DASHBOARD] Fetching summaries for', summariesPromises.length, 'employees...');
        const summariesResults = await Promise.all(summariesPromises);
        console.log('📊 [DASHBOARD] Summaries results:', summariesResults.length, 'responses');
        
        // Fetch leave requests for all employees
        const leavePromises = employees.map(emp => 
          timeTrackingService.getLeaveRequests(String(emp.id), {
            year: selectedYear
          })
        );
        const leaveResults = await Promise.all(leavePromises);
        
        // Calculate leave days from leave_requests (pending + approved)
        const leaveData = {};
        leaveResults.forEach((result, index) => {
          const emp = employees[index];
          const empId = String(emp.id);
          
          if (result.success && result.data) {
            // Calculate leave days for current month (pending + approved)
            const leaveDays = result.data.reduce((total, req) => {
              if (req.status === 'rejected') return total;
              
              const startDate = new Date(req.start_date);
              const reqMonth = startDate.getMonth() + 1;
              const reqYear = startDate.getFullYear();
              
              // Only count if within SELECTED month/year
              if (reqYear === selectedYear && reqMonth === selectedMonth) {
                return total + (req.days_count || 0);
              }
              return total;
            }, 0);
            
            leaveData[empId] = leaveDays;
          } else {
            leaveData[empId] = 0;
          }
        });
        
        setLeaveRequestsData(leaveData);
        
        // Build timeTrackingData object - use string IDs for consistency with TEXT type
        const trackingData = {};
        const employeesDataArray = [];
        summariesResults.forEach((result, index) => {
          const emp = employees[index];
          const empId = String(emp.id); // Ensure ID is string for TEXT type
          
          if (result.success && result.data) {
            trackingData[empId] = {
              workDays: result.data.days_worked || 0,
              leaveDays: leaveData[empId] || 0, // Use calculated leave days
              overtime: result.data.overtime_hours || 0,
              holidayOvertime: result.data.holiday_overtime_hours || 0,
              regularHours: result.data.regular_hours || 0,
              totalHours: result.data.total_hours || 0,
              performance: emp.performance || 4.0
            };
            employeesDataArray.push({
              employee: emp,
              data: result.data
            });
          } else {
            // Fallback to defaults if no data
            trackingData[empId] = {
              workDays: 0,
              leaveDays: leaveData[empId] || 0, // Use calculated leave days
              overtime: 0,
              holidayOvertime: 0,
              regularHours: 0,
              totalHours: 0,
              performance: emp.performance || 4.0
            };
            employeesDataArray.push({
              employee: emp,
              data: null
            });
          }
        });
        
        setAllEmployeesData(employeesDataArray);
        setTimeTrackingData(trackingData);
        
        // Fetch pending approvals count and details
        const approvalsResult = await timeTrackingService.getPendingApprovalsCount();
        if (approvalsResult.success) {
          setPendingApprovalsCount(approvalsResult.data.total || 0);
        } else {
          console.warn('Failed to fetch pending approvals count:', approvalsResult.error);
          setPendingApprovalsCount(0);
        }
        
        // Fetch pending approvals details
        const approvalsDetailResult = await timeTrackingService.getPendingApprovals();
        if (approvalsDetailResult.success) {
          setPendingApprovals(approvalsDetailResult.data || []);
        } else {
          console.warn('Failed to fetch pending approvals details:', approvalsDetailResult.error);
          setPendingApprovals([]);
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
  }, [employees, selectedMonth, selectedYear]);

  // Calculate aggregate stats
  const trackingDataValues = Object.values(timeTrackingData);
  const totalWorkDays = trackingDataValues.reduce((sum, emp) => sum + (emp?.workDays || 0), 0);
  const totalLeaveDays = trackingDataValues.reduce((sum, emp) => sum + (emp?.leaveDays || 0), 0);
  const totalOvertime = trackingDataValues.reduce((sum, emp) => sum + (emp?.overtime || 0) + (emp?.holidayOvertime || 0), 0).toFixed(1);
  const totalRegularHours = trackingDataValues.reduce((sum, emp) => sum + (emp?.regularHours || 0), 0).toFixed(0);
  const avgPerformance = trackingDataValues.length > 0 
    ? (trackingDataValues.reduce((sum, emp) => sum + (emp?.performance || 0), 0) / trackingDataValues.length).toFixed(1)
    : '0.0';
  
  // Check if we have any real data
  const hasRealData = trackingDataValues.some(emp => emp?.workDays > 0 || emp?.overtime > 0);
  
  console.log('📊 [DASHBOARD] Calculated stats:', {
    totalWorkDays,
    totalLeaveDays,
    totalOvertime,
    totalRegularHours,
    avgPerformance,
    hasRealData
  });

  // Helper function to generate display names for charts - always use last name
  const getUniqueDisplayName = (employee, allEmployees) => {
    const nameParts = employee.name.trim().split(/\s+/).filter(part => part.length > 0);
    if (nameParts.length === 0) return `Employee #${employee.id}`;
    
    // Always use last name for cleaner, more compact display
    const lastName = nameParts[nameParts.length - 1];
    return lastName;
  };

  // Performance data for bar chart
  const performanceData = employees.map(emp => ({
    name: getUniqueDisplayName(emp, employees),
    fullName: emp.name, // Keep full name for tooltip
    id: emp.id,
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

  // Leave requests summary - use ALL employees, not just top 5
  const leaveData = employees.map(emp => {
    const empId = String(emp.id);
    return {
      name: getUniqueDisplayName(emp, employees),
      fullName: emp.name, // Keep full name for tooltip
      id: emp.id,
      leaveDays: leaveRequestsData[empId] || timeTrackingData[empId]?.leaveDays || 0,
      workDays: timeTrackingData[empId]?.workDays || 0
    };
  });

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

  // Handle metric click - prepare data and open modal
  const handleMetricClick = (metricType) => {
    let data = [];
    let title = '';
    
    switch(metricType) {
      case 'employees':
        data = employees.map(emp => ({
          employeeName: emp.name,
          department: emp.department,
          position: emp.position,
          status: emp.status
        }));
        title = t('dashboard.totalEmployees');
        break;
        
      case 'performance':
        data = employees.map(emp => ({
          employeeName: emp.name,
          department: emp.department,
          performance: timeTrackingData[String(emp.id)]?.performance || emp.performance || 0,
          overtime: timeTrackingData[String(emp.id)]?.overtime || 0
        }));
        title = t('dashboard.avgPerformance');
        break;
        
      case 'regularHours':
        data = employees.map(emp => ({
          employeeName: emp.name,
          department: emp.department,
          regularHours: timeTrackingData[String(emp.id)]?.regularHours || 0,
          totalHours: timeTrackingData[String(emp.id)]?.totalHours || 0
        }));
        title = t('dashboard.totalRegularHours', '');
        break;
        
      case 'overtime':
        data = employees.map(emp => ({
          employeeName: emp.name,
          department: emp.department,
          overtime: (timeTrackingData[String(emp.id)]?.overtime || 0) + (timeTrackingData[String(emp.id)]?.holidayOvertime || 0),
          workDays: timeTrackingData[String(emp.id)]?.workDays || 0
        }));
        title = t('dashboard.totalOvertime');
        break;
        
      case 'leave':
        data = employees.map(emp => {
          const empId = String(emp.id);
          return {
            employeeName: emp.name,
            department: emp.department,
            leaveDays: leaveRequestsData[empId] || timeTrackingData[empId]?.leaveDays || 0,
            workDays: timeTrackingData[empId]?.workDays || 0
          };
        });
        title = t('dashboard.totalLeave');
        break;
      
      case 'workDays':
        data = employees.map(emp => ({
          employeeName: emp.name,
          department: emp.department,
          workDays: timeTrackingData[String(emp.id)]?.workDays || 0,
          overtime: timeTrackingData[String(emp.id)]?.overtime || 0
        }));
        title = t('dashboard.totalWorkDays');
        break;
        
      case 'pendingRequests':
        data = pendingApprovals.map(approval => ({
          employeeName: approval.employee?.name || approval.employeeName || 'Unknown Employee',
          department: approval.employee?.department || approval.department || 'N/A',
          requestType: approval.hour_type || approval.requestType || 'Time Entry',
          date: approval.date || approval.created_at || new Date().toISOString(),
          status: approval.status || 'pending',
          hours: approval.hours || 0
        }));
        console.log('Pending Approvals Data:', { pendingApprovals, mappedData: data });
        title = t('dashboard.pendingRequests', 'Pending Requests');
        break;
        
      case 'applications':
        data = applications;
        title = t('dashboard.activeApplications');
        break;
        
      default:
        return;
    }
    
    setModalConfig({ type: metricType, data, title });
    setModalOpen(true);
  };

  return (
    <div className="space-y-4 md:space-y-6 px-2 sm:px-0">
      {loading && (
        <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
          <div className={`${bg.secondary} rounded-lg p-6 flex items-center space-x-3 scale-in`}>
            <Loader className="w-6 h-6 animate-spin text-blue-600" />
            <span className={text.primary}>{t('common.loading', 'Loading dashboard...')}</span>
          </div>
        </div>
      )}
      <div className={`${bg.secondary} rounded-lg border ${border.primary} p-3 flex items-center justify-between slide-in-left flex-wrap gap-3`}>
        <div className="flex items-center space-x-2">
          <DatabaseZap className={`w-4 h-4 ${hasRealData ? 'text-green-600' : 'text-yellow-600'}`} />
          <span className={`text-sm ${text.secondary}`}>
            {hasRealData 
              ? t('dashboard.liveData', 'Live data from Supabase')
              : t('dashboard.noData', 'No time tracking data yet')
            }
          </span>
        </div>
        
        {/* Month/Year Selector */}
        <div className="flex items-center space-x-2">
          <Funnel className={`w-4 h-4 ${text.secondary}`} />
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(Number(e.target.value))}
            className={`${text.primary} px-3 py-1.5 rounded-lg border ${border.primary} text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent cursor-pointer transition-colors ${isDarkMode ? 'hover:border-gray-100' : 'hover:border-gray-900'}`}
          >
            <option value={1}>{t('months.january', 'January')}</option>
            <option value={2}>{t('months.february', 'February')}</option>
            <option value={3}>{t('months.march', 'March')}</option>
            <option value={4}>{t('months.april', 'April')}</option>
            <option value={5}>{t('months.may', 'May')}</option>
            <option value={6}>{t('months.june', 'June')}</option>
            <option value={7}>{t('months.july', 'July')}</option>
            <option value={8}>{t('months.august', 'August')}</option>
            <option value={9}>{t('months.september', 'September')}</option>
            <option value={10}>{t('months.october', 'October')}</option>
            <option value={11}>{t('months.november', 'November')}</option>
            <option value={12}>{t('months.december', 'December')}</option>
          </select>
          
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className={`${text.primary} px-3 py-1.5 rounded-lg border ${border.primary} text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent cursor-pointer transition-colors ${isDarkMode ? 'hover:border-gray-100' : 'hover:border-gray-900'}`}
          >
            <option value={2024}>2024</option>
            <option value={2025}>2025</option>
            <option value={2026}>2026</option>
          </select>
        </div>
        
        <button
          onClick={() => window.location.reload()}
          className="text-xs text-blue-600 hover:text-blue-700 font-medium transition-all duration-200 hover:scale-105"
        >
          {t('common.refresh', 'Refresh')}
        </button>
      </div>
      
      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
        <div className="stagger-item">
          <StatsCard 
            title={t('dashboard.totalEmployees')} 
            value={employees.length} 
            icon={Users} 
            color={isDarkMode ? "#ffffff" : "#1f1f1f"}
            size={12}
            onClick={() => handleMetricClick('employees')}
          />
        </div>
        <div className="stagger-item">
          <StatsCard 
            title={t('dashboard.totalRegularHours', '')} 
            value={`${totalRegularHours}h`} 
            icon={Clock} 
            color={isDarkMode ? "#ffffff" : "#1f1f1f"}
            onClick={() => handleMetricClick('regularHours')}
          />
        </div>
        <div className="stagger-item">
          <StatsCard 
            title={t('dashboard.avgPerformance')} 
            value={avgPerformance} 
            icon={DatabaseZap} 
            color={isDarkMode ? "#ffffff" : "#1f1f1f"}
            onClick={() => handleMetricClick('performance')}
          />
        </div>
        <div className="stagger-item">
          <StatsCard 
            title={t('dashboard.totalOvertime')} 
            value={`${totalOvertime}h`} 
            icon={Clock} 
            color={isDarkMode ? "#ffffff" : "#1f1f1f"}
            onClick={() => handleMetricClick('overtime')}
          />
        </div>
        <div className="stagger-item">
          <StatsCard 
            title={t('dashboard.totalLeave')} 
            value={totalLeaveDays} 
            icon={Calendar} 
            color={isDarkMode ? "#ffffff" : "#1f1f1f"}
            onClick={() => handleMetricClick('leave')}
          />
        </div>
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Employee Performance Chart */}
        <div className={`${bg.secondary} rounded-lg shadow-sm border ${border.primary} p-3 md:p-4 slide-in-up transition-all duration-300 hover:shadow-lg`}>
          <h3 className={`font-semibold ${text.primary} mb-3`} style={{fontSize: 'clamp(1rem, 2.5vw, 1.125rem)'}}>
            {t('dashboard.employeePerformance')}
          </h3>
          <ResponsiveContainer width="100%" height={400}>
            <ComposedChart data={performanceData} margin={{ top: 5, right: 5, left: 0, bottom: 60 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={isDarkMode ? '#374151' : '#E5E7EB'} />
              <XAxis 
                dataKey="name" 
                stroke={isDarkMode ? '#FFFFFF' : '#6B7280'}
                angle={-45}
                textAnchor="end"
                height={80}
                interval={0}
                tick={{ fontSize: 13, fill: isDarkMode ? '#FFFFFF' : '#374151' }}
              />
              <YAxis stroke={isDarkMode ? '#FFFFFF' : '#6B7280'} domain={[0, 5]} tick={{ fill: isDarkMode ? '#FFFFFF' : '#374151' }} />
              <Tooltip
                  contentStyle={{
                    backgroundColor: isDarkMode ? '#1F2937' : '#FFFFFF',
                    border: `1px solid ${isDarkMode ? '#374151' : '#E5E7EB'}`,
                    borderRadius: '0.5rem',
                    color: isDarkMode ? '#F9FAFB' : '#111827',
                  }}
                  labelStyle={{
                    color: isDarkMode ? '#F9FAFB' : '#111827',
                  }}
                  itemStyle={{
                    color: isDarkMode ? '#F9FAFB' : '#111827',
                  }}
                  formatter={(value, name, props) => {
                    // Show full name in tooltip
                    if (props.payload.fullName) {
                      return [value, name];
                    }
                    return [value, name];
                  }}
                  labelFormatter={(label, payload) => {
                    // Show full employee name as tooltip label
                    if (payload && payload.length > 0 && payload[0].payload.fullName) {
                      return `Employee: ${payload[0].payload.fullName}`;
                    }
                    return label;
                  }}
                />
              <Legend wrapperStyle={{ color: isDarkMode ? '#FFFFFF' : '#111827' }} />
              <defs>
                <linearGradient id="performanceGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#DC2626" stopOpacity={0.95} />
                  <stop offset="50%" stopColor="#7C2D12" stopOpacity={0.9} />
                  <stop offset="100%" stopColor="#000000" stopOpacity={0.85} />
                </linearGradient>
              </defs>
              <Bar dataKey="performance" fill="url(#performanceGradient)" name={t('dashboard.performanceRating', 'Performance Rating')} radius={[8, 8, 0, 0]} />
              <Line 
                type="monotone" 
                dataKey="performance" 
                stroke="#10B981" 
                strokeWidth={3}
                dot={{ fill: '#10B981', r: 5 }}
                legendType="none"
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {/* Department Distribution */}
        <div className={`${bg.secondary} rounded-lg shadow-sm border ${border.primary} p-4 md:p-6 slide-in-up transition-all duration-300 hover:shadow-lg`} style={{ animationDelay: '0.1s' }}>
          <h3 className={`font-semibold ${text.primary} mb-4`} style={{fontSize: 'clamp(1rem, 2.5vw, 1.125rem)'}}>
            {t('dashboard.departmentDist')}
          </h3>
          <ResponsiveContainer width="100%" height={400}>
            <PieChart>
              <defs>
                <linearGradient id="pieGradient0" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#60A5FA" stopOpacity={1} />
                  <stop offset="50%" stopColor="#3B82F6" stopOpacity={0.95} />
                  <stop offset="100%" stopColor="#1E3A8A" stopOpacity={0.9} />
                </linearGradient>
                <linearGradient id="pieGradient1" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#34D399" stopOpacity={1} />
                  <stop offset="50%" stopColor="#10B981" stopOpacity={0.95} />
                  <stop offset="100%" stopColor="#047857" stopOpacity={0.9} />
                </linearGradient>
                <linearGradient id="pieGradient2" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#FBBF24" stopOpacity={1} />
                  <stop offset="50%" stopColor="#F59E0B" stopOpacity={0.95} />
                  <stop offset="100%" stopColor="#B45309" stopOpacity={0.9} />
                </linearGradient>
                <linearGradient id="pieGradient3" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#F87171" stopOpacity={1} />
                  <stop offset="50%" stopColor="#EF4444" stopOpacity={0.95} />
                  <stop offset="100%" stopColor="#991B1B" stopOpacity={0.9} />
                </linearGradient>
                <linearGradient id="pieGradient4" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#A78BFA" stopOpacity={1} />
                  <stop offset="50%" stopColor="#8B5CF6" stopOpacity={0.95} />
                  <stop offset="100%" stopColor="#5B21B6" stopOpacity={0.9} />
                </linearGradient>
                <linearGradient id="pieGradient5" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#F472B6" stopOpacity={1} />
                  <stop offset="50%" stopColor="#EC4899" stopOpacity={0.95} />
                  <stop offset="100%" stopColor="#9F1239" stopOpacity={0.9} />
                </linearGradient>
                <linearGradient id="pieGradient6" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#22D3EE" stopOpacity={1} />
                  <stop offset="50%" stopColor="#06B6D4" stopOpacity={0.95} />
                  <stop offset="100%" stopColor="#155E75" stopOpacity={0.9} />
                </linearGradient>
              </defs>
              <Pie
                data={departmentData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                labelStyle={{ fill: isDarkMode ? '#FFFFFF' : '#111827', fontSize: 14 }}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
                style={{ fontSize: '13px' }}
              >
                {departmentData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={`url(#pieGradient${index % 7})`} />
                ))}
              </Pie>
              <Tooltip
                  contentStyle={{
                    backgroundColor: isDarkMode ? '#1F2937' : '#FFFFFF',
                    border: `1px solid ${isDarkMode ? '#374151' : '#E5E7EB'}`,
                    borderRadius: '0.5rem',
                    color: isDarkMode ? '#F9FAFB' : '#111827',
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

      {/* Charts Row 2 - Regular Hours and Overtime Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Regular Hours by Employee */}
        <div className={`${bg.secondary} rounded-lg shadow-sm border ${border.primary} p-6`}>
          <h3 className={`text-lg font-semibold ${text.primary} mb-4`}>
            {t('dashboard.regularHoursByEmployee', 'Regular Hours by Employee')}
          </h3>
          <ResponsiveContainer width="100%" height={400}>
            <ComposedChart 
              data={allEmployeesData
                .filter(item => item.data)
                .sort((a, b) => (b.data?.regular_hours || 0) - (a.data?.regular_hours || 0))
                .slice(0, 10)
                .map(item => ({
                  name: getUniqueDisplayName(item.employee, employees),
                  fullName: item.employee.name,
                  regularHours: item.data?.regular_hours || 0
                }))}
              margin={{ top: 5, right: 5, left: 0, bottom: 60 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke={isDarkMode ? '#374151' : '#E5E7EB'} />
              <XAxis 
                dataKey="name" 
                stroke={isDarkMode ? '#FFFFFF' : '#6B7280'}
                angle={-45}
                textAnchor="end"
                height={80}
                interval={0}
                tick={{ fontSize: 13, fill: isDarkMode ? '#FFFFFF' : '#374151' }}
              />
              <YAxis stroke={isDarkMode ? '#FFFFFF' : '#6B7280'} tick={{ fill: isDarkMode ? '#FFFFFF' : '#374151' }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: isDarkMode ? '#1F2937' : '#FFFFFF',
                  border: `1px solid ${isDarkMode ? '#374151' : '#E5E7EB'}`,
                  borderRadius: '0.5rem',
                  color: isDarkMode ? '#F9FAFB' : '#111827',
                }}
                labelFormatter={(label, payload) => {
                  if (payload && payload.length > 0 && payload[0].payload.fullName) {
                    return `Employee: ${payload[0].payload.fullName}`;
                  }
                  return label;
                }}
              />
              <Legend wrapperStyle={{ color: isDarkMode ? '#FFFFFF' : '#111827' }} />
              <defs>
                <linearGradient id="regularHoursGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#2563EB" stopOpacity={0.95} />
                  <stop offset="50%" stopColor="#1E3A8A" stopOpacity={0.9} />
                  <stop offset="100%" stopColor="#000000" stopOpacity={0.85} />
                </linearGradient>
              </defs>
              <Bar dataKey="regularHours" fill="url(#regularHoursGradient)" name={t('dashboard.regularHoursLegend', 'Regular Hours')} radius={[8, 8, 0, 0]} />
              <Line 
                type="monotone" 
                dataKey="regularHours" 
                stroke="#10B981" 
                strokeWidth={3}
                dot={{ fill: '#10B981', r: 5 }}
                legendType="none"
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {/* Overtime Hours by Employee */}
        <div className={`${bg.secondary} rounded-lg shadow-sm border ${border.primary} p-6`}>
          <h3 className={`text-lg font-semibold ${text.primary} mb-4`}>
            {t('dashboard.overtimeHoursByEmployee', 'Overtime Hours by Employee')}
          </h3>
          <ResponsiveContainer width="100%" height={400}>
            <ComposedChart 
              data={allEmployeesData
                .filter(item => item.data)
                .sort((a, b) => {
                  const aTotal = (b.data?.overtime_hours || 0) + (b.data?.holiday_overtime_hours || 0);
                  const bTotal = (a.data?.overtime_hours || 0) + (a.data?.holiday_overtime_hours || 0);
                  return aTotal - bTotal;
                })
                .slice(0, 10)
                .map(item => ({
                  name: getUniqueDisplayName(item.employee, employees),
                  fullName: item.employee.name,
                  overtimeHours: ((item.data?.overtime_hours || 0) + (item.data?.holiday_overtime_hours || 0)).toFixed(1)
                }))}
              margin={{ top: 5, right: 5, left: 0, bottom: 60 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke={isDarkMode ? '#374151' : '#E5E7EB'} />
              <XAxis 
                dataKey="name" 
                stroke={isDarkMode ? '#FFFFFF' : '#6B7280'}
                angle={-45}
                textAnchor="end"
                height={80}
                interval={0}
                tick={{ fontSize: 13, fill: isDarkMode ? '#FFFFFF' : '#374151' }}
              />
              <YAxis stroke={isDarkMode ? '#FFFFFF' : '#6B7280'} tick={{ fill: isDarkMode ? '#FFFFFF' : '#374151' }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: isDarkMode ? '#1F2937' : '#FFFFFF',
                  border: `1px solid ${isDarkMode ? '#374151' : '#E5E7EB'}`,
                  borderRadius: '0.5rem',
                  color: isDarkMode ? '#F9FAFB' : '#111827',
                }}
                labelFormatter={(label, payload) => {
                  if (payload && payload.length > 0 && payload[0].payload.fullName) {
                    return `Employee: ${payload[0].payload.fullName}`;
                  }
                  return label;
                }}
              />
              <Legend />
              <Bar dataKey="overtimeHours" fill="#F59E0B" name={t('dashboard.totalOvertimeLegend', 'Total Overtime')} radius={[8, 8, 0, 0]} />
              <Line 
                type="monotone" 
                dataKey="overtimeHours" 
                stroke="#10B981" 
                strokeWidth={3}
                dot={{ fill: '#10B981', r: 5 }}
                legendType="none"
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Charts Row 3 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Work & Leave Days Comparison */}
        <div className={`${bg.secondary} rounded-lg shadow-sm border ${border.primary} p-6`}>
          <h3 className={`text-lg font-semibold ${text.primary} mb-4`}>
            {t('dashboard.workLeaveComp')}
          </h3>
          <ResponsiveContainer width="100%" height={350}>
            <ComposedChart data={leaveData} margin={{ top: 5, right: 5, left: 0, bottom: 60 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={isDarkMode ? '#374151' : '#E5E7EB'} />
              <XAxis 
                dataKey="name" 
                stroke={isDarkMode ? '#9CA3AF' : '#6B7280'}
                angle={-45}
                textAnchor="end"
                height={80}
                interval={0}
                tick={{ fontSize: 11 }}
              />
              <YAxis stroke={isDarkMode ? '#9CA3AF' : '#6B7280'} />
              <Tooltip
                  contentStyle={{
                    backgroundColor: isDarkMode ? '#1F2937' : '#FFFFFF',
                    border: `1px solid ${isDarkMode ? '#374151' : '#E5E7EB'}`,
                    borderRadius: '0.5rem',
                    color: isDarkMode ? '#F9FAFB' : '#111827',
                  }}
                  labelStyle={{
                    color: isDarkMode ? '#F9FAFB' : '#111827',
                  }}
                  itemStyle={{
                    color: isDarkMode ? '#F9FAFB' : '#111827',
                  }}
                  labelFormatter={(label, payload) => {
                    // Show full employee name as tooltip label
                    if (payload && payload.length > 0 && payload[0].payload.fullName) {
                      return `Employee: ${payload[0].payload.fullName}`;
                    }
                    return label;
                  }}
                />
              <Legend />
              <Bar dataKey="workDays" fill="#10B981" name={t('dashboard.totalWorkDays', 'Total Work Days')} radius={[8, 8, 0, 0]} />
              <Bar dataKey="leaveDays" fill="#EF4444" name={t('dashboard.totalLeave', 'Total Leave')} radius={[8, 8, 0, 0]} />
              <Line 
                type="monotone" 
                dataKey="workDays" 
                stroke="#059669" 
                strokeWidth={3}
                dot={{ fill: '#059669', r: 5 }}
                legendType="none"
              />
              <Line 
                type="monotone" 
                dataKey="leaveDays" 
                stroke="#DC2626" 
                strokeWidth={3}
                dot={{ fill: '#DC2626', r: 5 }}
                legendType="none"
              />
            </ComposedChart>
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
                      className={`w-10 h-10 rounded-full object-cover border-2 ${isDarkMode ? 'border-gray-600' : 'border-gray-200'}`}
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
                      {t(`employeePosition.${emp.position}`)}
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
        <div 
          onClick={() => handleMetricClick('workDays')}
          className={`${bg.secondary} rounded-lg shadow-sm border ${border.primary} p-6 cursor-pointer transition-all duration-300 hover:shadow-lg hover:-translate-y-1`}
        >
          <div className="flex items-center space-x-3 mb-2">
            <Clock className={`w-5 h-5 ${text.primary}`} />
            <h4 className={`font-semibold ${text.primary}`}>
              {t('dashboard.totalWorkDays')}
            </h4>
          </div>
          <p className={`text-3xl font-bold ${text.primary}`}>{totalWorkDays}</p>
          <p className={`text-sm ${text.secondary} mt-1`}>
            {t('dashboard.acrossEmployees')}
          </p>
        </div>

        <div 
          onClick={() => handleMetricClick('applications')}
          className={`${bg.secondary} rounded-lg shadow-sm border ${border.primary} p-6 cursor-pointer transition-all duration-300 hover:shadow-lg hover:-translate-y-1`}
        >
          <div className="flex items-center space-x-3 mb-2">
            <Briefcase className={`w-5 h-5 ${text.primary}`} />
            <h4 className={`font-semibold ${text.primary}`}>
              {t('dashboard.activeApplications')}
            </h4>
          </div>
          <p className={`text-3xl font-bold ${text.primary}`}>{applications.length}</p>
          <p className={`text-sm ${text.secondary} mt-1`}>
            {t('dashboard.pendingReview')}
          </p>
        </div>

        <div 
          onClick={() => handleMetricClick('pendingRequests')}
          className={`${bg.secondary} rounded-lg shadow-sm border ${border.primary} p-6 cursor-pointer transition-all duration-300 hover:shadow-lg hover:-translate-y-1`}
        >
          <div className="flex items-center space-x-3 mb-2">
            <AlertCircle className={`w-5 h-5 ${text.primary}`} />
            <h4 className={`font-semibold ${text.primary}`}>
              {t('dashboard.pendingRequests')}
            </h4>
          </div>
          <p className={`text-3xl font-bold ${text.primary}`}>{pendingApprovalsCount}</p>
          <p className={`text-sm ${text.secondary} mt-1`}>
            {t('dashboard.pendingApprovals', '')}
          </p>
        </div>
      </div>

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
export default Dashboard;
