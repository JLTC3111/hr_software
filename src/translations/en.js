export default {
  // Navigation
  nav: {
    dashboard: 'Summary',
    employees: 'Profiles',
    recruitment: 'Recruitment',
    timeTracking: 'Time Tracking',
    performance: 'Performance',
    reports: 'Reports'
  },

  // Header
  header: {
    title: 'HR Manager',
    welcome: 'Welcome back',
    user: 'HR Team',
    logout: 'Logout'
  },

  // Login
  login: {
    title: 'HR Manager',
    subtitle: 'Sign in to access your dashboard',
    email: 'Email Address',
    password: 'Password',
    emailPlaceholder: 'you@example.com',
    passwordPlaceholder: '••••••••',
    emailRequired: 'Email is required',
    emailInvalid: 'Email is invalid',
    passwordRequired: 'Password is required',
    passwordTooShort: 'Password must be at least 6 characters',
    invalidCredentials: 'Invalid email or password',
    rememberMe: 'Remember me',
    forgotPassword: 'Forgot password?',
    signIn: 'Sign In',
    signingIn: 'Signing in...',
    orContinueWith: 'Or continue with',
    continueWithGithub: 'Continue with GitHub',
    githubError: 'Failed to login with GitHub',
    noAccount: "Don't have an account?",
    signUp: 'Sign up',
    footer: '© 2024 HR Manager. All rights reserved.'
  },

  // Dashboard
  dashboard: {
    title: 'Dashboard Overview',
    totalEmployees: 'Total Employees',
    activeEmployees: 'Active Employees',
    newHires: 'New Hires This Month',
    pendingApplications: 'Pending Applications',
    avgPerformance: 'Avg Performance',
    recentActivity: 'Recent Activity',
    quickStats: 'Quick Stats',
    viewAll: 'View All',
    activities: {
      newEmployee: "New employee added: ",
      interviewScheduled: "Interview scheduled with ",
      performanceReview: "Performance review completed for "
    },
    timeAgo: {
      twoHours: "2 hours ago",
      fourHours: "4 hours ago",
      oneDay: "1 day ago"
    }
  },

  // Employees
  employees: {
    title: 'Employee Management',
    searchPlaceholder: 'Search employees...',
    addEmployee: 'Add Employee',
    name: 'Name',
    position: 'Position',
    department: 'Department',
    email: 'Email',
    phone: 'Phone',
    startDate: 'Start Date',
    salary: 'Salary',
    status: 'Status',
    location: 'Location',
    performance: 'Performance',
    actions: 'Actions',
    view: 'View',
    edit: 'Edit',
    delete: 'Delete',
    active: 'Active',
    inactive: 'Inactive',
    onLeave: 'On Leave',
    employeeDetails: 'Employee Details',
    contactInformation: 'Contact Information',
    employmentDetails: 'Employment Details',
    started: 'Started',
    editEmployee: 'Edit Employee'
  },

  // Add Employee Modal
  addEmployee: {
    title: 'Add New Employee',
    submit: 'Add Employee',
    nameRequired: 'Name is required',
    positionRequired: 'Position is required',
    departmentRequired: 'Department is required',
    emailRequired: 'Email is required',
    emailInvalid: 'Email is invalid',
    phoneRequired: 'Phone is required',
    dobRequired: 'Date of birth is required',
    addressRequired: 'Address is required',
    startDateRequired: 'Start date is required',
    performanceInvalid: 'Performance must be between 0 and 5',
    namePlaceholder: 'Enter employee name',
    positionPlaceholder: 'e.g., senior_developer',
    departmentPlaceholder: 'e.g., engineering, finance',
    emailPlaceholder: 'employee@example.com',
    phonePlaceholder: '+84 909 999 999',
    addressPlaceholder: 'City, Country',
    dob: 'Date of Birth',
    address: 'Address'
  },

  // Common
  common: {
    cancel: 'Cancel',
    close: 'Close',
    save: 'Save',
    delete: 'Delete',
    edit: 'Edit',
    view: 'View'
  },

  // Search
  search: {
    placeholder: 'Search employees...'
  },

  // Departments
  departments: {
    all: 'All',
    engineering: 'Engineering',
    sales: 'Sales',
    marketing: 'Marketing',
    humanresources: 'Human Resources',
    design: 'Design',
    finance: 'Finance'
  },

  // Months
  months: {
    january: 'January',
    february: 'February',
    march: 'March',
    april: 'April',
    may: 'May',
    june: 'June',
    july: 'July',
    august: 'August',
    september: 'September',
    october: 'October',
    november: 'November',
    december: 'December'
  },

  // Recruitment
  recruitment: {
    title: 'Recruitment Pipeline',
    postNewJob: 'Post New Job',
    applications: 'Applications',
    candidate: 'Candidate',
    position: 'Position',
    department: 'Department',
    appliedDate: 'Applied Date',
    experience: 'Experience',
    status: 'Status',
    actions: 'Actions',
    stage: 'Stage',
    interviewScheduled: 'Interview Scheduled',
    underReview: 'Under Review',
    offerExtended: 'Offer Extended',
    screening: 'Screening',
    technical: 'Technical',
    offer: 'Offer',
    years: 'years'
  },

  // Time Tracking
  timeTracking: {
    title: 'Time Tracking Dashboard',
    summary: 'Summary',
    quickActions: 'Quick Actions',
    workDays: 'Work Days',
    leaveDays: 'Leave Days',
    overtime: 'Overtime Hours',
    holidayOvertime: 'Holiday Overtime',
    hours: 'hours',
    days: 'days',
    thisMonth: 'This Month',
    totalHours: 'Total Hours',
    regularHours: 'Regular Hours',
    overtimeHours: 'Overtime Hours',
    hrs: 'hrs',
    attendanceRate: 'Attendance Rate'
  },

  // Performance Appraisal
  performance: {
    title: 'Performance Appraisal',
    overallRating: 'Overall Rating',
    reviewPeriod: 'Review Period',
    goals: 'Goals & Objectives',
    achievements: 'Key Achievements',
    areasForImprovement: 'Areas for Improvement',
    skillsAssessment: 'Skills Assessment',
    technical: 'Technical Skills',
    communication: 'Communication',
    leadership: 'Leadership',
    teamwork: 'Teamwork',
    problemSolving: 'Problem Solving',
    rating: 'Rating',
    excellent: 'Excellent',
    good: 'Good',
    average: 'Average',
    needsImprovement: 'Needs Improvement',
    comments: 'Comments',
    save: 'Save Appraisal',
    lastReview: 'Last Review',
    nextReview: 'Next Review Due',
    q1_2024: 'Q1 2024',
    q2_2024: 'Q2 2024',
    q3_2024: 'Q3 2024',
    q4_2024: 'Q4 2024',
    overallPerformance: 'Overall Performance',
    goalsCompleted: 'Goals Completed',
    reviewsThisPeriod: 'Reviews This Period',
    avgSkillRating: 'Avg Skill Rating',
    completed: 'Completed',
    inProgress: 'In Progress',
    pending: 'Pending',
    // Tabs
    overview: 'Overview',
    goalsTab: 'Goals',
    reviewsTab: 'Reviews',
    // Goals section
    currentGoals: 'Current Goals',
    addGoal: 'Add Goal',
    addNewGoal: 'Add New Goal',
    performanceGoals: 'Performance Goals',
    progress: 'Progress',
    deadline: 'Deadline',
    due: 'Due',
    complete: 'complete',
    viewDetails: 'View Details',
    // Reviews section
    performanceReviews: 'Performance Reviews',
    newReview: 'New Review',
    by: 'by',
    viewFullReview: 'View Full Review',
    // General
    status: 'Status',
    actions: 'Actions',
    edit: 'Edit',
    view: 'View'
  },

  // Reports
  reports: {
    title: 'Reports & Analytics',
    employeeGrowth: 'Employee Growth',
    departmentDistribution: 'Department Distribution',
    performanceMetrics: 'Performance Metrics',
    recruitmentMetrics: 'Recruitment Metrics',
    attendanceReport: 'Attendance Report',
    salaryReport: 'Salary Report',
    generateReport: 'Generate Report',
    exportPDF: 'Export PDF',
    exportExcel: 'Export Excel',
    filterBy: 'Filter By',
    dateRange: 'Date Range',
    department: 'Department',
    all: 'All',
    // Navigation
    overview: 'Overview',
    detailedReports: 'Detailed Reports',
    filters: 'Filters',
    exportAll: 'Export All',
    // Charts
    departmentOverview: 'Department Overview',
    attendanceOverview: 'Attendance Overview',
    recruitmentFunnel: 'Recruitment Funnel',
    performanceTrend: 'Performance Trend',
    // Stats
    totalEmployees: 'Total Employees',
    newHires: 'New Hires',
    thisQuarter: 'This quarter',
    turnoverRate: 'Turnover Rate',
    annualRate: 'Annual rate',
    avgSalary: 'Avg Salary',
    satisfaction: 'Satisfaction',
    productivity: 'Productivity',
    // Attendance
    present: 'Present',
    onLeave: 'On Leave',
    absent: 'Absent',
    // Recruitment labels
    totalApplications: 'Total Applications',
    interviewed: 'Interviewed',
    hired: 'Hired',
    rejected: 'Rejected',
    employees: 'employees',
    // Report generation
    generateCustomReport: 'Generate Custom Report',
    reportType: 'Report Type',
    employeePerformance: 'Employee Performance',
    salaryAnalysis: 'Salary Analysis',
    attendanceReport: 'Attendance Report',
    recruitmentMetrics: 'Recruitment Metrics',
    departmentComparison: 'Department Comparison',
    exportToPDF: 'Export to PDF',
    exportToExcel: 'Export to Excel',
    prebuiltReports: 'Pre-built Reports',
    // Pre-built report names
    monthlyPerformanceReview: 'Monthly Performance Review',
    comprehensivePerformanceAnalysis: 'Comprehensive performance analysis',
    salaryBenchmarking: 'Salary Benchmarking',
    compareSalariesAcrossDepartments: 'Compare salaries across departments',
    attendanceAnalytics: 'Attendance Analytics',
    trackAttendancePatterns: 'Track attendance patterns and trends',
    recruitmentPipeline: 'Recruitment Pipeline',
    monitorHiringProcess: 'Monitor hiring process efficiency',
    employeeTurnover: 'Employee Turnover',
    analyzeRetentionRates: 'Analyze retention and turnover rates',
    trainingEffectiveness: 'Training Effectiveness',
  },

  // Time Clock Entry
  timeClock: {
    title: 'Time Clock Entry',
    date: 'Date',
    clockIn: 'Clock In',
    clockOut: 'Clock Out',
    workType: 'Work Type',
    proof: 'Proof of Work (Optional)',
    notes: 'Notes (Optional)',
    notesPlaceholder: 'Add any additional context...',
    uploadPrompt: 'Click to upload PDF or image (max 5MB)',
    submit: 'Submit Time Entry',
    hoursWorked: 'Hours Worked',
    effective: 'Effective',
    weeklyTotal: 'This Week',
    monthlyTotal: 'This Month',
    allTime: 'All Time',
    export: 'Export CSV',
    history: 'Time Entry History',
    showHistory: 'Show History',
    hideHistory: 'Hide History',
    noEntries: 'No time entries yet',
    types: {
      regular: 'Regular Hours',
      weekend: 'Weekend',
      bonus: 'Bonus Hours',
      holiday: 'Holiday'
    },
    status: {
      pending: 'Pending',
      approved: 'Approved',
      rejected: 'Rejected'
    },
    table: {
      date: 'Date',
      clockIn: 'Clock In',
      clockOut: 'Clock Out',
      hours: 'Hours',
      type: 'Type',
      status: 'Status',
      actions: 'Actions'
    },
    errors: {
      dateRequired: 'Date is required',
      clockInRequired: 'Clock-in time is required',
      clockOutRequired: 'Clock-out time is required',
      clockOutBeforeIn: 'Clock-out must be after clock-in',
      exceedsMaxHours: 'Cannot exceed 24 hours in one day',
      overlappingShift: 'Time overlaps with existing entry on this date',
      invalidFileType: 'Only PDF and images allowed',
      fileTooLarge: 'File size must be less than 5MB'
    },
    success: {
      entrySaved: 'Time entry saved successfully!'
    }
  },

  // Common
  common: {
    save: 'Save',
    cancel: 'Cancel',
    delete: 'Delete',
    edit: 'Edit',
    view: 'View',
    search: 'Search',
    filter: 'Filter',
    export: 'Export',
    print: 'Print',
    close: 'Close',
    submit: 'Submit',
    loading: 'Loading...',
    noData: 'No data available',
    confirm: 'Confirm',
    back: 'Back',
    next: 'Next',
    previous: 'Previous',
    yes: 'Yes',
    no: 'No',
    all: 'All'
  },
  // Theme
  theme: {
    light: 'Light Mode',
    dark: 'Dark Mode',
    toggle: 'Toggle Theme'
  },
  // Language
  language: {
    select: 'Select Language',
    current: 'Current Language'
  },

  // Time Tracking Actions
  timeTrackingActions: {
    recordTime: 'Record Time',
    requestLeave: 'Request Leave',
    logOvertime: 'Log Overtime',
    exportReport: 'Export Report'
  },

  // Recruitment Actions
  recruitmentActions: {
    view: 'View',
    schedule: 'Schedule',
    reject: 'Reject'
  },

  // Employee Status
  employeeStatus: {
    active: 'Active',
    inactive: 'Inactive',
    onLeave: 'On Leave',
    pending: 'Pending'
  },

  //Employee Position 
  employeePosition: {
    general_manager: 'General Manager',
    senior_developer: 'Senior Developer',
    hr_specialist: 'HR Manager',
    accountant: 'Chief Accountant',
    contract_manager: 'Contract Manager',
    managing_director: 'Managing Director',
    support_staff: 'Support Staff',
  },

  // Recruitment Status
  recruitmentStatus: {
    active: 'Active',
    interviewScheduled: 'Interview Scheduled',
    underReview: 'Under Review',
    offerExtended: 'Offer Extended',
    rejected: 'Rejected',
    screening: 'Screening',
    technical: 'Technical',
    offer: 'Offer'
  },

  // Performance Goals
  goals: {
    completeReactProject: 'Complete React Project',
    improveCodeQuality: 'Improve Code Quality',
    mentoringJuniorDevelopers: 'Mentoring Junior Developers',
    apiDevelopment: 'API Development',
    databaseOptimization: 'Database Optimization',
    backendDevelopment: 'Backend Development',
    teamCollaboration: 'Team Collaboration'
  },

  // Review Types
  reviewTypes: {
    quarterlyReview: 'Quarterly Review',
    midYearReview: 'Mid-year Review',
    annualReview: 'Annual Review'
  },

  // Skill Categories
  skillCategories: {
    technical: 'Technical',
    soft: 'Soft Skills',
    leadership: 'Leadership',
    communication: 'Communication'
  },

  // Reports
  reports: {
    title: 'Reports & Analytics',
    lastWeek: 'Last Week',
    lastMonth: 'Last Month',
    lastQuarter: 'Last Quarter',
    lastYear: 'Last Year',
    customRange: 'Custom Range',
    overview: 'Overview',
    departmentStats: 'Department Statistics',
    attendance: 'Attendance',
    recruitment: 'Recruitment',
    performance: 'Performance'
  }
};
