import { supabase } from '../config/supabaseClient';

/**
 * Report Generation Service
 * Handles all report generation and data aggregation from Supabase
 */

// Generate comprehensive employee performance report
export const generatePerformanceReport = async (filters = {}) => {
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
  if (!data || data.length === 0) {
    console.warn('No data to export');
    return;
  }
  
  // Get headers from first object
  const headers = Object.keys(data[0]);
  
  // Create CSV content
  let csv = headers.join(',') + '\n';
  
  data.forEach(row => {
    const values = headers.map(header => {
      const value = row[header];
      // Handle values with commas or quotes
      if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return value;
    });
    csv += values.join(',') + '\n';
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

export default {
  generatePerformanceReport,
  generateSalaryReport,
  generateAttendanceReport,
  generateRecruitmentReport,
  generateDepartmentReport,
  generateTurnoverReport,
  getPerformanceSummaries,
  exportToCSV
};
