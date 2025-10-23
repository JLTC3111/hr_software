export default {
  // Navigation
  nav: {
    menu: 'Menu',
    timeClock: 'Time Clock',
    dashboard: 'Dashboard',
    employees: 'Employees',
    recruitment: "Recruitment",
    timeTracking: 'Time Tracking',
    performance: 'Performance',
    reports: 'Reports',
    notifications: 'Notifications',
    settings: 'Settings'
  },
  // Header
  header: {
    title: 'HR Manager',
    welcome: 'Welcome Back',
    user: 'HR Team',
    logout: 'Logout',
    notifications: 'Notifications'
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
    redirecting: 'Redirecting to GitHub...',
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
    pendingApplications: 'Pending Applications',
    avgPerformance: 'Average Performance',
    totalOvertime: 'Total Overtime',
    totalLeave: 'Total Leave Days',
    employeePerformance: 'Employee Performance',
    departmentDist: 'Department Distribution',
    workLeaveComp: 'Work vs Leave Days',
    topPerformers: 'Top Performers',
    overtime: 'OT',
    totalWorkDays: 'Total Work Days',
    acrossEmployees: 'Across all employees this month',
    activeApplications: 'Active Applications',
    pendingReview: 'Pending review',
    pendingRequests: 'Pending Requests',
    leaveRequests: 'Leave requests to review',
    recentActivity: 'Recent Activity',
    quickStats: 'Quick Stats',
    viewAll: 'View All',
    activities: {
      newEmployee: "New employee added: ",
      interviewScheduled: "Interview scheduled with: ",
      performanceReview: "Performance review completed for: "
    },
    timeAgo: {
      twoHours: '2 hours ago',
      fourHours: '4 hours ago',
      oneDay: '1 day ago'
    }
  },

  // Employees
  employees: {
    title: 'Employee Management',
    directory: 'Directory',
    addNew: 'Add New',
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

  // Filter Departments
  departments: {
    all: 'All',
    legal_compliance: 'Legal Compliance',
    internal_affairs: 'Internal Affairs',
    human_resources: 'Human Resources',
    humanresources: 'Human Resources',
    office_unit: 'Office Unit',
    board_of_directors: 'Board of Directors',
    finance: 'Finance',
    engineering: 'Engineering',
    sales: 'Sales',
    marketing: 'Marketing',
    design: 'Design',
  },

  // Employee Department (for display in cards)
  employeeDepartment: {
    legal_compliance: 'Legal Compliance',
    'internal_ affairs': 'Internal Affairs',
    internal_affairs: 'Internal Affairs',
    human_resources: 'Human Resources',
    office_unit: 'Office Unit',
    board_of_directors: 'Board of Directors',
    finance: 'Finance',
    engineering: 'Engineering',
    sales: 'Sales',
    marketing: 'Marketing',
    design: 'Design',
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
    overview: 'Overview',
    clockIn: 'Clock In/Out',
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
    attendanceRate: 'Attendance Rate',
    requestLeave: 'Request Leave',
    logOvertime: 'Log Overtime',
    leaveType: 'Leave Type',
    vacation: 'Vacation',
    sickLeave: 'Sick Leave',
    personal: 'Personal Leave',
    unpaid: 'Unpaid Leave',
    startDate: 'Start Date',
    endDate: 'End Date',
    reason: 'Reason',
    reasonPlaceholder: 'Briefly explain your leave request...',
    overtimePlaceholder: 'Describe the work performed during overtime...',
    date: 'Date',
    leaveSuccess: 'Leave request submitted successfully!',
    leaveError: 'Error submitting leave request',
    overtimeSuccess: 'Overtime logged successfully!',
    overtimeError: 'Error logging overtime',
    exportSuccess: 'Report exported successfully!'
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
    measureTrainingSuccess: 'Measure training program success',
    generate: 'Generate →',
    fromLastPeriod: 'from last period'
  },

  // Common
  common: {
    search: 'Search',
    filter: 'Filter',
    sort: 'Sort',
    save: 'Save',
    cancel: 'Cancel',
    delete: 'Delete',
    edit: 'Edit',
    view: 'View',
    add: 'Add',
    close: 'Close',
    loading: 'Loading...',
    noData: 'No data available',
    error: 'An error occurred',
    success: 'Operation successful',
    confirm: 'Are you sure?',
    yes: 'Yes',
    no: 'No'
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

  // Time Clock Entry
  timeClock: {
    title: 'Time Clock Entry',
    subtitle: 'Log your work hours and submit proof of attendance',
    newEntry: 'New Time Entry',
    date: 'Date',
    clockIn: 'Clock In',
    clockOut: 'Clock Out',
    hourType: 'Hour Type',
    proof: 'Proof of Attendance',
    notes: 'Notes',
    optional: 'Optional',
    submit: 'Submit Time Entry',
    submitting: 'Submitting...',
    success: 'Time entry submitted successfully!',
    confirmDelete: 'Are you sure you want to delete this entry?',
    delete: 'Delete',
    history: 'Time Entry History',
    noEntries: 'No time entries yet. Submit your first entry above!',
    time: 'Time',
    hours: 'Hours',
    type: 'Type',
    status: 'Status',
    actions: 'Actions',
    weeklySummary: 'This Week',
    monthlySummary: 'This Month',
    total: 'Total',
    notesPlaceholder: 'Add any additional context or notes...',
    fileHelp: 'Upload screenshot, photo, or PDF (max 5MB)',
    hourTypes: {
      regular: 'Regular Hours',
      holiday: 'Holiday',
      weekend: 'Weekend',
      bonus: 'Bonus Hours'
    },
    errors: {
      dateRequired: 'Date is required',
      clockInRequired: 'Clock-in time is required',
      clockOutRequired: 'Clock-out time is required',
      clockOutAfterClockIn: 'Clock-out must be after clock-in',
      tooManyHours: 'Cannot exceed 24 hours in a single entry',
      overlapping: 'This time overlaps with an existing entry for this date',
      fileTooLarge: 'File size must be less than 5MB',
      invalidFileType: 'Only JPG, PNG, and PDF files are allowed',
      submitFailed: 'Failed to submit time entry. Please try again.',
      deleteFailed: 'Failed to delete time entry. Please try again.'
    }
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
  },

  // Notifications
  notifications: {
    title: 'Notifications',
    unreadCount: '{0} unread',
    allCaughtUp: 'You\'re all caught up!',
    filters: 'Filters',
    markAllRead: 'Mark all as read',
    deleteAll: 'Delete all',
    confirmDeleteAll: 'Are you sure you want to delete all notifications?',
    total: 'Total',
    unread: 'Unread',
    errors: 'Errors',
    warnings: 'Warnings',
    filterBy: 'Filter By',
    status: 'Status',
    type: 'Type',
    category: 'Category',
    allNotifications: 'All Notifications',
    unreadOnly: 'Unread Only',
    readOnly: 'Read Only',
    allTypes: 'All Types',
    info: 'Info',
    success: 'Success',
    warning: 'Warning',
    error: 'Error',
    allCategories: 'All Categories',
    general: 'General',
    timeTracking: 'Time Tracking',
    performance: 'Performance',
    employee: 'Employee',
    recruitment: 'Recruitment',
    system: 'System',
    noNotifications: 'No notifications',
    noNotificationsFilter: 'No notifications match your filters',
    noNotificationsYet: 'You don\'t have any notifications yet',
    justNow: 'Just now',
    minutesAgo: '{0}m ago',
    hoursAgo: '{0}h ago',
    daysAgo: '{0}d ago',
    markAsRead: 'Mark as read',
    delete: 'Delete'
  },

  // Settings
  settings: {
    title: 'Settings',
    subtitle: 'Manage your preferences and account settings',
    saved: 'Saved!',
    export: 'Export',
    import: 'Import',
    reset: 'Reset',
    saveChanges: 'Save Changes',
    confirmReset: 'Are you sure you want to reset all settings to default?',
    importSuccess: 'Settings imported successfully!',
    importError: 'Failed to import settings',
    
    // Tabs
    notifications: 'Notifications',
    appearance: 'Appearance',
    language: 'Language & Region',
    privacy: 'Privacy',
    work: 'Work Preferences',
    
    // Notification Settings
    notificationPreferences: 'Notification Preferences',
    emailNotifications: 'Email Notifications',
    emailNotificationsDesc: 'Receive notifications via email',
    pushNotifications: 'Push Notifications',
    pushNotificationsDesc: 'Receive push notifications in the app',
    desktopNotifications: 'Desktop Notifications',
    desktopNotificationsDesc: 'Show browser notifications on desktop',
    notificationFrequency: 'Notification Frequency',
    realtime: 'Real-time',
    daily: 'Daily Digest',
    weekly: 'Weekly Summary',
    notifyMeAbout: 'Notify me about',
    timeTrackingNotifications: 'Time Tracking',
    performanceNotifications: 'Performance Reviews',
    employeeNotifications: 'Employee Updates',
    recruitmentNotifications: 'Recruitment',
    systemNotifications: 'System Updates',
    
    // Appearance Settings
    appearanceSettings: 'Appearance Settings',
    theme: 'Theme',
    dateFormat: 'Date Format',
    timeFormat: 'Time Format',
    itemsPerPage: 'Items Per Page',
    
    // Language & Region
    languageRegion: 'Language & Region',
    timezone: 'Timezone',
    timezoneNote: 'Currently showing first 50 timezones',
    
    // Privacy Settings
    privacySettings: 'Privacy Settings',
    profileVisibility: 'Profile Visibility',
    visibilityAll: 'Everyone',
    visibilityTeam: 'My Team',
    visibilityManagers: 'Managers Only',
    visibilityPrivate: 'Private',
    contactVisibility: 'Contact Information Visibility',
    showEmail: 'Show Email Address',
    showPhone: 'Show Phone Number',
    
    // Work Preferences
    workPreferences: 'Work Preferences',
    defaultDashboard: 'Default Dashboard View',
    overviewView: 'Overview',
    detailedView: 'Detailed',
    compactView: 'Compact',
    autoClockOut: 'Auto Clock Out',
    autoClockOutDesc: 'Automatically clock out at a specific time',
    autoClockOutTime: 'Auto Clock Out Time',
    weeklyReport: 'Weekly Report',
    weeklyReportDesc: 'Receive a weekly summary of your work activities'
  }
};
