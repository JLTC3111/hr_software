import { supabase } from '../config/supabaseClient';
import { 
  isDemoMode, 
  MOCK_EMPLOYEES, 
  MOCK_APPLICATIONS 
} from '../utils/demoHelper';

/**
 * Report Generation Service
 * Handles all report generation and data aggregation from Supabase
 */

// Generate comprehensive employee performance report
export const generatePerformanceReport = async (filters = {}) => {
  if (isDemoMode()) {
    // Mock performance reviews
    const mockReviews = MOCK_EMPLOYEES.map(emp => ({
      id: `review-${emp.id}`,
      employee_id: emp.id,
      review_date: '2023-10-01',
      overall_rating: Math.floor(Math.random() * 2) + 3, // 3-5
      reviewer_id: 'demo-emp-1',
      status: 'completed',
      employees: emp
    }));

    let data = [...mockReviews];
    if (filters.department && filters.department !== 'all') {
      data = data.filter(r => r.employees.department === filters.department);
    }
    if (filters.employeeId) {
      data = data.filter(r => r.employee_id === filters.employeeId);
    }

    const metrics = calculatePerformanceMetrics(data);
    return {
      success: true,
      data: {
        reviews: data,
        metrics
      }
    };
  }

  try {
    const { department, dateFrom, dateTo, employeeId } = filters;
    
    // Build query
    let query = supabase
      .from('performance_reviews')
      .select(`
        *,
        employees:employee_id (
          id,
          name,
          department,
          position,
          email
        )
      `)
      .order('review_date', { ascending: false });
    
    if (department && department !== 'all') {
      query = query.eq('employees.department', department);
    }
    
    if (employeeId) {
      query = query.eq('employee_id', employeeId);
    }
    
    if (dateFrom) {
      query = query.gte('review_date', dateFrom);
    }
    
    if (dateTo) {
      query = query.lte('review_date', dateTo);
    }
    
    const { data, error } = await query;
    
    if (error) throw error;
    
    // Calculate aggregated metrics
    const metrics = calculatePerformanceMetrics(data);
    
    return {
      success: true,
      data: {
        reviews: data,
        metrics
      }
    };
  } catch (error) {
    console.error('Error generating performance report:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

// Generate salary analysis report
export const generateSalaryReport = async (filters = {}) => {
  if (isDemoMode()) {
    let data = [...MOCK_EMPLOYEES];
    if (filters.department && filters.department !== 'all') {
      data = data.filter(emp => emp.department === filters.department);
    }
    
    const stats = calculateSalaryStats(data);
    return {
      success: true,
      data: {
        employees: data,
        statistics: stats
      }
    };
  }

  try {
    const { department, dateFrom, dateTo } = filters;
    
    let query = supabase
      .from('employees')
      .select('id, name, department, position, salary, start_date')
      .order('salary', { ascending: false });
    
    if (department && department !== 'all') {
      query = query.eq('department', department);
    }
    
    if (dateFrom) {
      query = query.gte('start_date', dateFrom);
    }
    
    const { data, error } = await query;
    
    if (error) throw error;
    
    // Calculate salary statistics
    const stats = calculateSalaryStats(data);
    
    return {
      success: true,
      data: {
        employees: data,
        statistics: stats
      }
    };
  } catch (error) {
    console.error('Error generating salary report:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

// Generate attendance report
export const generateAttendanceReport = async (filters = {}) => {
  if (isDemoMode()) {
    // Mock attendance summaries
    const mockSummaries = MOCK_EMPLOYEES.map(emp => ({
      id: `summary-${emp.id}`,
      employee_id: emp.id,
      month: filters.month || new Date().getMonth() + 1,
      year: filters.year || new Date().getFullYear(),
      total_hours: 160,
      days_worked: 20,
      attendance_rate: 95 + Math.random() * 5,
      employees: emp
    }));

    let data = [...mockSummaries];
    if (filters.department && filters.department !== 'all') {
      data = data.filter(s => s.employees.department === filters.department);
    }
    if (filters.employeeId) {
      data = data.filter(s => s.employee_id === filters.employeeId);
    }

    const metrics = calculateAttendanceMetrics(data);
    return {
      success: true,
      data: {
        summaries: data,
        metrics
      }
    };
  }

  try {
    const { department, month, year, employeeId } = filters;
    
    let query = supabase
      .from('time_tracking_summary')
      .select(`
        *,
        employees:employee_id (
          id,
          name,
          department,
          position
        )
      `)
      .order('month', { ascending: false });
    
    if (department && department !== 'all') {
      query = query.eq('employees.department', department);
    }
    
    if (employeeId) {
      query = query.eq('employee_id', employeeId);
    }
    
    if (month) {
      query = query.eq('month', month);
    }
    
    if (year) {
      query = query.eq('year', year);
    }
    
    const { data, error } = await query;
    
    if (error) throw error;
    
    const metrics = calculateAttendanceMetrics(data);
    
    return {
      success: true,
      data: {
        summaries: data,
        metrics
      }
    };
  } catch (error) {
    console.error('Error generating attendance report:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

// Generate recruitment metrics report
export const generateRecruitmentReport = async (filters = {}) => {
  if (isDemoMode()) {
    let data = [...MOCK_APPLICATIONS];
    // Apply filters if needed (simplified for demo)
    
    const metrics = calculateRecruitmentMetrics(data);
    return {
      success: true,
      data: {
        applications: data,
        metrics
      }
    };
  }

  try {
    const { dateFrom, dateTo, position } = filters;
    
    let query = supabase
      .from('applications')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (position) {
      query = query.eq('position', position);
    }
    
    if (dateFrom) {
      query = query.gte('created_at', dateFrom);
    }
    
    if (dateTo) {
      query = query.lte('created_at', dateTo);
    }
    
    const { data, error } = await query;
    
    if (error) throw error;
    
    const metrics = calculateRecruitmentMetrics(data);
    
    return {
      success: true,
      data: {
        applications: data,
        metrics
      }
    };
  } catch (error) {
    console.error('Error generating recruitment report:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

// Generate department comparison report
export const generateDepartmentReport = async (filters = {}) => {
  if (isDemoMode()) {
    // Mock department stats
    const departments = ['Management', 'Engineering', 'Design', 'Marketing', 'Sales', 'HR'];
    const stats = departments.map(dept => ({
      department: dept,
      employeeCount: MOCK_EMPLOYEES.filter(e => e.department === dept).length,
      avgPerformance: 4.2,
      avgAttendance: 96.5,
      totalSalary: MOCK_EMPLOYEES.filter(e => e.department === dept).reduce((sum, e) => sum + e.salary, 0)
    })).filter(s => s.employeeCount > 0);

    return { success: true, data: stats };
  }

  try {
    const { dateFrom, dateTo } = filters;
    
    // Get all employees
    const { data: employees, error: empError } = await supabase
      .from('employees')
      .select('*');
    
    if (empError) throw empError;
    
    // Get performance reviews
    let reviewQuery = supabase
      .from('performance_reviews')
      .select('employee_id, overall_rating, review_date');
    
    if (dateFrom) {
      reviewQuery = reviewQuery.gte('review_date', dateFrom);
    }
    
    if (dateTo) {
      reviewQuery = reviewQuery.lte('review_date', dateTo);
    }
    
    const { data: reviews, error: revError } = await reviewQuery;
    
    if (revError) throw revError;
    
    // Get time tracking data for current period
    const currentDate = new Date();
    const { data: timeTracking, error: ttError } = await supabase
      .from('time_tracking_summary')
      .select('employee_id, attendance_rate, total_hours, days_worked')
      .eq('month', currentDate.getMonth() + 1)
      .eq('year', currentDate.getFullYear());
    
    if (ttError) throw ttError;
    
    // Aggregate by department
    const departmentStats = aggregateByDepartment(employees, reviews, timeTracking);
    
    return {
      success: true,
      data: departmentStats
    };
  } catch (error) {
    console.error('Error generating department report:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

// Generate employee turnover report
export const generateTurnoverReport = async (filters = {}) => {
  if (isDemoMode()) {
    let data = [...MOCK_EMPLOYEES];
    if (filters.department && filters.department !== 'all') {
      data = data.filter(emp => emp.department === filters.department);
    }
    
    const metrics = calculateTurnoverMetrics(data, filters.dateFrom, filters.dateTo);
    return {
      success: true,
      data: {
        employees: data,
        metrics
      }
    };
  }

  try {
    const { dateFrom, dateTo, department } = filters;
    
    let query = supabase
      .from('employees')
      .select('id, name, department, position, start_date, status');
    
    if (department && department !== 'all') {
      query = query.eq('department', department);
    }
    
    const { data, error } = await query;
    
    if (error) throw error;
    
    const metrics = calculateTurnoverMetrics(data, dateFrom, dateTo);
    
    return {
      success: true,
      data: {
        employees: data,
        metrics
      }
    };
  } catch (error) {
    console.error('Error generating turnover report:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

// Get employee performance summary from view
export const getPerformanceSummaries = async (filters = {}) => {
  if (isDemoMode()) {
    const summaries = MOCK_EMPLOYEES.map(emp => ({
      employee_id: emp.id,
      employee_name: emp.name,
      department: emp.department,
      position: emp.position,
      avg_rating: 4.0 + Math.random(),
      review_count: 2,
      last_review_date: '2023-10-01'
    }));
    
    let data = [...summaries];
    if (filters.department && filters.department !== 'all') {
      data = data.filter(s => s.department === filters.department);
    }
    if (filters.employeeId) {
      data = data.filter(s => s.employee_id === filters.employeeId);
    }
    
    return { success: true, data };
  }

  try {
    const { department, employeeId } = filters;
    
    let query = supabase
      .from('employee_performance_summary')
      .select('*')
      .order('avg_rating', { ascending: false });
    
    if (department && department !== 'all') {
      query = query.eq('department', department);
    }
    
    if (employeeId) {
      query = query.eq('employee_id', employeeId);
    }
    
    const { data, error } = await query;
    
    if (error) throw error;
    
    return {
      success: true,
      data
    };
  } catch (error) {
    console.error('Error fetching performance summaries:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

// Export report data to CSV format
export const exportToCSV = (data, filename) => {
  try {
    if (!data || data.length === 0) {
      console.warn('No data to export');
      throw new Error('No data provided for export');
    }
    
    console.log('Starting CSV export for', data.length, 'records');
    
    // Get headers from first object
    const headers = Object.keys(data[0]);
    console.log('CSV Headers:', headers);
    
    // Create CSV content
    let csv = headers.join(',') + '\n';
    
    data.forEach((row, index) => {
      try {
        const values = headers.map(header => {
          const value = row[header];
          // Handle null/undefined values
          if (value === null || value === undefined) {
            return '';
          }
          // Handle values with commas or quotes
          if (typeof value === 'string' && (value.includes(',') || value.includes('"') || value.includes('\n'))) {
            return `"${value.replace(/"/g, '""')}"`;
          }
          return value;
        });
        csv += values.join(',') + '\n';
      } catch (rowError) {
        console.warn(`Error processing row ${index}:`, rowError);
        // Skip this row and continue
      }
    });
    
    // Create download link
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', `${filename}_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // Clean up the URL object
    URL.revokeObjectURL(url);
    
    console.log('CSV export completed successfully');
  } catch (error) {
    console.error('Error in exportToCSV:', error);
    throw error;
  }
};

// Helper: Calculate performance metrics
const calculatePerformanceMetrics = (reviews) => {
  if (!reviews || reviews.length === 0) {
    return {
      averageRating: 0,
      totalReviews: 0,
      ratingDistribution: {},
      topPerformers: []
    };
  }
  
  const totalRating = reviews.reduce((sum, r) => sum + (r.overall_rating || 0), 0);
  const avgRating = totalRating / reviews.length;
  
  // Rating distribution
  const distribution = {};
  reviews.forEach(r => {
    const rating = Math.floor(r.overall_rating || 0);
    distribution[rating] = (distribution[rating] || 0) + 1;
  });
  
  // Top performers (rating >= 4.5)
  const topPerformers = reviews
    .filter(r => r.overall_rating >= 4.5)
    .map(r => ({
      employee: r.employees?.name,
      rating: r.overall_rating,
      department: r.employees?.department
    }))
    .slice(0, 10);
  
  return {
    averageRating: avgRating.toFixed(2),
    totalReviews: reviews.length,
    ratingDistribution: distribution,
    topPerformers
  };
};

// Helper: Calculate salary statistics
const calculateSalaryStats = (employees) => {
  if (!employees || employees.length === 0) {
    return {
      average: 0,
      median: 0,
      min: 0,
      max: 0,
      byDepartment: {}
    };
  }
  
  const salaries = employees.map(e => e.salary || 0).sort((a, b) => a - b);
  const sum = salaries.reduce((a, b) => a + b, 0);
  const avg = sum / salaries.length;
  const median = salaries[Math.floor(salaries.length / 2)];
  
  // By department
  const byDept = {};
  employees.forEach(emp => {
    if (!byDept[emp.department]) {
      byDept[emp.department] = [];
    }
    byDept[emp.department].push(emp.salary || 0);
  });
  
  const deptStats = {};
  Object.keys(byDept).forEach(dept => {
    const deptSalaries = byDept[dept];
    deptStats[dept] = {
      average: deptSalaries.reduce((a, b) => a + b, 0) / deptSalaries.length,
      count: deptSalaries.length
    };
  });
  
  return {
    average: Math.round(avg),
    median: Math.round(median),
    min: Math.min(...salaries),
    max: Math.max(...salaries),
    byDepartment: deptStats
  };
};

// Helper: Calculate attendance metrics
const calculateAttendanceMetrics = (summaries) => {
  if (!summaries || summaries.length === 0) {
    return {
      averageAttendanceRate: 0,
      totalWorkDays: 0,
      totalHours: 0,
      avgHoursPerDay: 0
    };
  }
  
  const totalAttendance = summaries.reduce((sum, s) => sum + (s.attendance_rate || 0), 0);
  const totalDays = summaries.reduce((sum, s) => sum + (s.days_worked || 0), 0);
  const totalHours = summaries.reduce((sum, s) => sum + (s.total_hours || 0), 0);
  
  return {
    averageAttendanceRate: (totalAttendance / summaries.length).toFixed(1),
    totalWorkDays: totalDays,
    totalHours: totalHours.toFixed(1),
    avgHoursPerDay: totalDays > 0 ? (totalHours / totalDays).toFixed(1) : 0
  };
};

// Helper: Calculate recruitment metrics
const calculateRecruitmentMetrics = (applications) => {
  if (!applications || applications.length === 0) {
    return {
      total: 0,
      byStatus: {},
      conversionRate: 0,
      avgTimeToHire: 0
    };
  }
  
  const byStatus = {};
  applications.forEach(app => {
    byStatus[app.status] = (byStatus[app.status] || 0) + 1;
  });
  
  const hired = byStatus['Offer Extended'] || 0;
  const conversionRate = (hired / applications.length) * 100;
  
  return {
    total: applications.length,
    byStatus,
    conversionRate: conversionRate.toFixed(1),
    avgTimeToHire: 14 // Would need timestamp calculations
  };
};

// Helper: Aggregate data by department
const aggregateByDepartment = (employees, reviews, timeTracking) => {
  const departments = {};
  
  employees.forEach(emp => {
    const dept = emp.department;
    if (!departments[dept]) {
      departments[dept] = {
        name: dept,
        employeeCount: 0,
        totalSalary: 0,
        avgPerformance: 0,
        performanceCount: 0,
        avgAttendance: 0,
        attendanceCount: 0
      };
    }
    
    departments[dept].employeeCount++;
    departments[dept].totalSalary += emp.salary || 0;
  });
  
  // Add performance data
  reviews.forEach(review => {
    const emp = employees.find(e => e.id === review.employee_id);
    if (emp && departments[emp.department]) {
      departments[emp.department].avgPerformance += review.overall_rating || 0;
      departments[emp.department].performanceCount++;
    }
  });
  
  // Add attendance data
  timeTracking?.forEach(tt => {
    const emp = employees.find(e => e.id === tt.employee_id);
    if (emp && departments[emp.department]) {
      departments[emp.department].avgAttendance += tt.attendance_rate || 0;
      departments[emp.department].attendanceCount++;
    }
  });
  
  // Calculate averages
  Object.keys(departments).forEach(dept => {
    const d = departments[dept];
    d.avgSalary = Math.round(d.totalSalary / d.employeeCount);
    d.avgPerformance = d.performanceCount > 0 
      ? (d.avgPerformance / d.performanceCount).toFixed(1) 
      : 0;
    d.avgAttendance = d.attendanceCount > 0 
      ? (d.avgAttendance / d.attendanceCount).toFixed(1) 
      : 0;
    delete d.totalSalary;
    delete d.performanceCount;
    delete d.attendanceCount;
  });
  
  return Object.values(departments);
};

// Helper: Calculate turnover metrics
const calculateTurnoverMetrics = (employees, dateFrom, dateTo) => {
  const startCount = employees.length;
  const inactive = employees.filter(e => e.status === 'Inactive' || e.status === 'inactive').length;
  const turnoverRate = (inactive / startCount) * 100;
  
  // New hires in period
  let newHires = 0;
  if (dateFrom && dateTo) {
    newHires = employees.filter(e => {
      const startDate = new Date(e.start_date);
      return startDate >= new Date(dateFrom) && startDate <= new Date(dateTo);
    }).length;
  }
  
  return {
    totalEmployees: startCount,
    inactiveCount: inactive,
    turnoverRate: turnoverRate.toFixed(1),
    newHires,
    retentionRate: (100 - turnoverRate).toFixed(1)
  };
};

// Get comprehensive overview statistics from database
export const getOverviewStats = async (filters = {}) => {
  try {
    const { dateFrom, dateTo } = filters;
    const currentDate = new Date();
    const currentMonth = currentDate.getMonth() + 1;
    const currentYear = currentDate.getFullYear();
    
    // Get all employees
    const { data: employees, error: empError } = await supabase
      .from('employees')
      .select('*');
    
    if (empError) throw empError;
    
    // Get time tracking summaries for current month
    const { data: timeTracking, error: ttError } = await supabase
      .from('time_tracking_summary')
      .select('*')
      .eq('month', currentMonth)
      .eq('year', currentYear);
    
    if (ttError) throw ttError;
    
    // Get performance reviews for recent period (last 6 months)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    const { data: reviews, error: revError } = await supabase
      .from('performance_reviews')
      .select('overall_rating, review_date')
      .gte('review_date', sixMonthsAgo.toISOString().split('T')[0]);
    
    if (revError) throw revError;
    
    // Get applications
    const { data: applications, error: appError } = await supabase
      .from('applications')
      .select('*');
    
    if (appError) throw appError;
    
    // Calculate new hires (last 3 months)
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
    const newHires = employees.filter(emp => {
      const startDate = new Date(emp.start_date);
      return startDate >= threeMonthsAgo;
    }).length;
    
    // Calculate turnover rate
    const inactiveCount = employees.filter(e => e.status === 'Inactive' || e.status === 'inactive').length;
    const turnoverRate = employees.length > 0 ? ((inactiveCount / employees.length) * 100).toFixed(1) : 0;
    
    // Calculate average salary
    const avgSalary = employees.length > 0
      ? Math.round(employees.reduce((sum, emp) => sum + (emp.salary || 0), 0) / employees.length)
      : 0;
    
    // Calculate satisfaction (from performance reviews)
    const avgRating = reviews.length > 0
      ? (reviews.reduce((sum, r) => sum + (r.overall_rating || 0), 0) / reviews.length).toFixed(1)
      : 0;
    
    // Calculate productivity (from time tracking attendance)
    const avgAttendance = timeTracking.length > 0
      ? Math.round(timeTracking.reduce((sum, t) => sum + (t.attendance_rate || 0), 0) / timeTracking.length)
      : 0;
    
    // Department statistics
    const deptCounts = {};
    const deptPerformance = {};
    const deptSalaries = {};
    
    employees.forEach(emp => {
      const dept = emp.department;
      deptCounts[dept] = (deptCounts[dept] || 0) + 1;
      deptPerformance[dept] = (deptPerformance[dept] || []).concat(emp.performance || 0);
      deptSalaries[dept] = (deptSalaries[dept] || []).concat(emp.salary || 0);
    });
    
    const departmentStats = Object.keys(deptCounts).map((dept, index) => {
      const colors = ['bg-slate-600', 'bg-teal-600', 'bg-cyan-700', 'bg-indigo-700', 'bg-violet-600', 'bg-sky-700'];
      const avgPerf = deptPerformance[dept].reduce((a, b) => a + b, 0) / deptPerformance[dept].length;
      const avgSal = deptSalaries[dept].reduce((a, b) => a + b, 0) / deptSalaries[dept].length;
      
      return {
        name: dept,
        employees: deptCounts[dept],
        avgSalary: Math.round(avgSal) || 0,
        performance: avgPerf.toFixed(1),
        color: colors[index % colors.length]
      };
    });
    
    // Attendance breakdown
    const activeCount = employees.filter(emp => emp.status === 'Active' || emp.status === 'active').length;
    const onLeaveCount = employees.filter(emp => emp.status === 'On Leave' || emp.status === 'onLeave').length;
    
    // Calculate percentages for attendance
    const totalEmployees = employees.length;
    const presentPercentage = totalEmployees > 0 ? Math.round((activeCount / totalEmployees) * 100) : 0;
    const leavePercentage = totalEmployees > 0 ? Math.round((onLeaveCount / totalEmployees) * 100) : 0;
    const absentPercentage = totalEmployees > 0 ? Math.round((inactiveCount / totalEmployees) * 100) : 0;
    
    // Recruitment stats
    const recruitmentStats = {
      totalApplications: applications.length,
      interviewed: applications.filter(app => app.status === 'Interview Scheduled').length,
      hired: applications.filter(app => app.status === 'Offer Extended').length,
      rejected: applications.filter(app => app.status === 'Rejected').length
    };
    
    return {
      success: true,
      data: {
        overview: {
          totalEmployees: employees.length,
          newHires,
          turnoverRate: parseFloat(turnoverRate),
          avgSalary,
          satisfaction: parseFloat(avgRating),
          productivity: avgAttendance
        },
        departmentStats,
        attendance: {
          present: presentPercentage,
          absent: absentPercentage,
          leave: leavePercentage,
          presentCount: activeCount,
          absentCount: inactiveCount,
          leaveCount: onLeaveCount
        },
        recruitment: recruitmentStats
      }
    };
  } catch (error) {
    console.error('Error fetching overview stats:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

// Get performance trend (last 6 months)
export const getPerformanceTrend = async () => {
  try {
    const { data, error } = await supabase
      .from('performance_reviews')
      .select('overall_rating, review_date')
      .order('review_date', { ascending: true });
    
    if (error) throw error;
    
    // Group by month
    const monthlyData = {};
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    data.forEach(review => {
      const date = new Date(review.review_date);
      const monthKey = `${months[date.getMonth()]} ${date.getFullYear()}`;
      
      if (!monthlyData[monthKey]) {
        monthlyData[monthKey] = { total: 0, count: 0 };
      }
      
      monthlyData[monthKey].total += review.overall_rating || 0;
      monthlyData[monthKey].count += 1;
    });
    
    // Get last 6 months
    const trend = [];
    const currentDate = new Date();
    
    for (let i = 5; i >= 0; i--) {
      const date = new Date(currentDate);
      date.setMonth(date.getMonth() - i);
      const monthKey = `${months[date.getMonth()]} ${date.getFullYear()}`;
      
      const monthData = monthlyData[monthKey];
      trend.push({
        month: months[date.getMonth()],
        rating: monthData ? (monthData.total / monthData.count).toFixed(1) : 0
      });
    }
    
    return {
      success: true,
      data: trend
    };
  } catch (error) {
    console.error('Error fetching performance trend:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

export default {
  generatePerformanceReport,
  generateSalaryReport,
  generateAttendanceReport,
  generateRecruitmentReport,
  generateDepartmentReport,
  generateTurnoverReport,
  getPerformanceSummaries,
  getOverviewStats,
  getPerformanceTrend,
  exportToCSV
};
