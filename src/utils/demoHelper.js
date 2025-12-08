// Demo Mode Helper Utilities

const DEMO_STORAGE_KEY = 'hr_app_demo_mode';

export const isDemoMode = () => {
  return localStorage.getItem(DEMO_STORAGE_KEY) === 'true';
};

export const enableDemoMode = () => {
  localStorage.setItem(DEMO_STORAGE_KEY, 'true');
  // Also set a flag for the current session
  window.isDemoMode = true;
};

export const disableDemoMode = () => {
  localStorage.removeItem(DEMO_STORAGE_KEY);
  window.isDemoMode = false;
};

/**
 * Get translated name for a demo employee
 * @param {Object} employee - The employee object
 * @param {Function} t - Translation function from useLanguage hook
 * @returns {string} - Translated name or original name
 */
export const getDemoEmployeeName = (employee, t) => {
  if (!isDemoMode() || !employee || !t) return employee?.name || '';
  
  // Check if this is a demo employee with a nameKey
  if (employee.nameKey) {
    const translated = t(employee.nameKey, null);
    // If translation exists and is different from the key, use it
    if (translated && translated !== employee.nameKey) {
      return translated;
    }
  }
  
  return employee.name || '';
};

/**
 * Get translated location for a demo employee
 * @param {Object} employee - The employee object
 * @param {Function} t - Translation function from useLanguage hook
 * @returns {string} - Translated location or original location
 */
export const getDemoEmployeeLocation = (employee, t) => {
  if (!isDemoMode() || !employee || !t) return employee?.location || '';
  
  // Check if this is a demo employee with a locationKey
  if (employee.locationKey) {
    const translated = t(employee.locationKey, null);
    if (translated && translated !== employee.locationKey) {
      return translated;
    }
  }
  
  return employee.location || '';
};

/**
 * Apply translations to a demo employee object
 * @param {Object} employee - The employee object
 * @param {Function} t - Translation function from useLanguage hook
 * @returns {Object} - Employee object with translated name and location
 */
export const translateDemoEmployee = (employee, t) => {
  if (!isDemoMode() || !employee || !t) return employee;
  
  return {
    ...employee,
    name: getDemoEmployeeName(employee, t),
    location: getDemoEmployeeLocation(employee, t)
  };
};

/**
 * Apply translations to an array of demo employees
 * @param {Array} employees - Array of employee objects
 * @param {Function} t - Translation function from useLanguage hook
 * @returns {Array} - Array of employees with translated names and locations
 */
export const translateDemoEmployees = (employees, t) => {
  if (!isDemoMode() || !employees || !t) return employees;
  
  return employees.map(emp => translateDemoEmployee(emp, t));
};

/**
 * Get translated title for a demo task
 * @param {Object} task - The task object
 * @param {Function} t - Translation function from useLanguage hook
 * @returns {string} - Translated title or original title
 */
export const getDemoTaskTitle = (task, t) => {
  if (!isDemoMode() || !task || !t) return task?.title || '';
  
  if (task.titleKey) {
    const translated = t(task.titleKey, null);
    if (translated && translated !== task.titleKey) {
      return translated;
    }
  }
  
  return task.title || '';
};

/**
 * Get translated description for a demo task
 * @param {Object} task - The task object
 * @param {Function} t - Translation function from useLanguage hook
 * @returns {string} - Translated description or original description
 */
export const getDemoTaskDescription = (task, t) => {
  if (!isDemoMode() || !task || !t) return task?.description || '';
  
  if (task.descriptionKey) {
    const translated = t(task.descriptionKey, null);
    if (translated && translated !== task.descriptionKey) {
      return translated;
    }
  }
  
  return task.description || '';
};

/**
 * Get translated title for a demo goal
 * @param {Object} goal - The goal object
 * @param {Function} t - Translation function from useLanguage hook
 * @returns {string} - Translated title or original title
 */
export const getDemoGoalTitle = (goal, t) => {
  if (!isDemoMode() || !goal || !t) return goal?.title || '';
  
  if (goal.titleKey) {
    const translated = t(goal.titleKey, null);
    if (translated && translated !== goal.titleKey) {
      return translated;
    }
  }
  
  return goal.title || '';
};

/**
 * Get translated description for a demo goal
 * @param {Object} goal - The goal object
 * @param {Function} t - Translation function from useLanguage hook
 * @returns {string} - Translated description or original description
 */
export const getDemoGoalDescription = (goal, t) => {
  if (!isDemoMode() || !goal || !t) return goal?.description || '';
  
  if (goal.descriptionKey) {
    const translated = t(goal.descriptionKey, null);
    if (translated && translated !== goal.descriptionKey) {
      return translated;
    }
  }
  
  return goal.description || '';
};

// Mock Data
export const MOCK_USER = {
  id: 'demo-user-id',
  email: 'tech@company.com',
  name: 'Demo Admin',
  firstName: 'Demo',
  lastName: 'Admin',
  role: 'admin',
  avatar_url: 'https://randomuser.me/api/portraits/men/32.jpg',
  department: 'human_resources',
  position: 'hr_specialist',
  employeeId: 'demo-emp-1',
  permissions: {
    canManageUsers: true,
    canManageEmployees: true,
    canViewReports: true,
    canManageRecruitment: true,
    canManagePerformance: true,
    canManageTimeTracking: true,
    canExportData: true,
    canViewSalaries: true,
    canManageDepartments: true,
    canManageRoles: true,
    canViewAuditLogs: true,
    canViewOwnProfile: true,
    canUpdateOwnProfile: true,
    canViewOwnTimeTracking: true,
    canSubmitTimeoff: true,
    canViewOwnPerformance: true
  }
};

export const MOCK_EMPLOYEES = [
  {
    id: 'demo-emp-1',
    name: 'Demo Admin',
    nameKey: 'demoEmployees.demo-emp-1.name',
    email: 'hr@company.com',
    department: 'human_resources',
    position: 'hr_specialist',
    location: 'Headquarters',
    locationKey: 'locations.headquarters',
    status: 'active',
    photo: 'https://randomuser.me/api/portraits/women/44.jpg',
    phone: '555-0101',
    hire_date: '2023-01-15',
    dob: '1985-06-15',
    salary: 85000,
    employment_status: 'active'
  },
  {
    id: 'demo-emp-2',
    name: 'Demo Engineer',
    nameKey: 'demoEmployees.demo-emp-2.name',
    email: 'engineer@company.com',
    department: 'engineering',
    position: 'senior_developer',
    location: 'Headquarters',
    locationKey: 'locations.headquarters',
    status: 'active',
    photo: 'https://randomuser.me/api/portraits/men/32.jpg',
    phone: '555-0102',
    hire_date: '2023-03-10',
    dob: '1990-03-22',
    salary: 95000,
    employment_status: 'active'
  },
  {
    id: 'demo-emp-3',
    name: 'Demo Designer',
    nameKey: 'demoEmployees.demo-emp-3.name',
    email: 'designer@company.com',
    department: 'technology',
    position: 'employee',
    location: 'Remote',
    locationKey: 'locations.remote',
    status: 'active',
    photo: 'https://randomuser.me/api/portraits/men/86.jpg',
    phone: '555-0103',
    hire_date: '2023-06-20',
    dob: '1992-11-05',
    salary: 78000,
    employment_status: 'active'
  },
  {
    id: 'demo-emp-4',
    name: 'Demo Marketing',
    nameKey: 'demoEmployees.demo-emp-4.name',
    email: 'marketing@company.com',
    department: 'office_unit',
    position: 'employee',
    location: 'Headquarters',
    locationKey: 'locations.headquarters',
    status: 'active',
    photo: 'https://randomuser.me/api/portraits/women/65.jpg',
    phone: '555-0104',
    hire_date: '2023-02-01',
    dob: '1995-08-30',
    salary: 65000,
    employment_status: 'active'
  },
  {
    id: 'demo-emp-5',
    name: 'Demo Sales',
    nameKey: 'demoEmployees.demo-emp-5.name',
    email: 'sales@company.com',
    department: 'finance',
    position: 'employee',
    location: 'Remote',
    locationKey: 'locations.remote',
    status: 'active',
    photo: 'https://randomuser.me/api/portraits/men/22.jpg',
    phone: '555-0105',
    hire_date: '2023-08-15',
    dob: '1988-12-12',
    salary: 60000,
    employment_status: 'active'
  }
];

const DEMO_EMPLOYEES_KEY = 'hr_app_demo_employees';

export const getDemoEmployees = () => {
  const stored = localStorage.getItem(DEMO_EMPLOYEES_KEY);
  const storedEmployees = stored ? JSON.parse(stored) : [];
  
  // Stored employees take precedence over mock employees (allows "updating" mock data)
  const storedIds = new Set(storedEmployees.map(e => e.id));
  const visibleMockEmployees = MOCK_EMPLOYEES.filter(e => !storedIds.has(e.id));
  
  return [...visibleMockEmployees, ...storedEmployees];
};

export const addDemoEmployee = (employee) => {
  const stored = localStorage.getItem(DEMO_EMPLOYEES_KEY);
  const storedEmployees = stored ? JSON.parse(stored) : [];
  storedEmployees.push(employee);
  localStorage.setItem(DEMO_EMPLOYEES_KEY, JSON.stringify(storedEmployees));
  return employee;
};

export const updateDemoEmployee = (employeeId, updates) => {
  const stored = localStorage.getItem(DEMO_EMPLOYEES_KEY);
  let storedEmployees = stored ? JSON.parse(stored) : [];
  
  // Check if it's already in storage
  const storedIndex = storedEmployees.findIndex(e => e.id === employeeId);
  if (storedIndex !== -1) {
    storedEmployees[storedIndex] = { ...storedEmployees[storedIndex], ...updates };
    localStorage.setItem(DEMO_EMPLOYEES_KEY, JSON.stringify(storedEmployees));
    return storedEmployees[storedIndex];
  }
  
  // If not in storage, check if it's a mock employee
  const mockEmployee = MOCK_EMPLOYEES.find(e => e.id === employeeId);
  if (mockEmployee) {
    // Clone to storage with updates
    const updatedEmployee = { ...mockEmployee, ...updates };
    storedEmployees.push(updatedEmployee);
    localStorage.setItem(DEMO_EMPLOYEES_KEY, JSON.stringify(storedEmployees));
    return updatedEmployee;
  }
  
  return null;
};

// Generate some random time entries for the current month
const generateMockTimeEntries = () => {
  const entries = [];
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  MOCK_EMPLOYEES.forEach(emp => {
    for (let day = 1; day <= Math.min(daysInMonth, today.getDate()); day++) {
      // Skip weekends roughly
      const date = new Date(year, month, day);
      if (date.getDay() === 0 || date.getDay() === 6) continue;

      const dateStr = date.toISOString().split('T')[0];
      
      // Randomly skip some days or have different hours
      if (Math.random() > 0.9) continue; // Absent

      entries.push({
        id: `te-${emp.id}-${day}`,
        employee_id: emp.id,
        employee_name: emp.name,
        employee_nameKey: emp.nameKey,
        employee_department: emp.department,
        employee_position: emp.position,
        date: dateStr,
        hours: 8,
        hour_type: 'regular',
        status: 'approved',
        clock_in: '09:00:00',
        clock_out: '17:00:00',
        employee: {
          id: emp.id,
          name: emp.name,
          nameKey: emp.nameKey,
          department: emp.department,
          position: emp.position
        }
      });

      // Add some overtime
      if (Math.random() > 0.8) {
        entries.push({
          id: `te-ot-${emp.id}-${day}`,
          employee_id: emp.id,
          employee_name: emp.name,
          employee_nameKey: emp.nameKey,
          employee_department: emp.department,
          employee_position: emp.position,
          date: dateStr,
          hours: 2,
          hour_type: 'overtime',
          status: 'pending',
          clock_in: '17:00:00',
          clock_out: '19:00:00',
          employee: {
            id: emp.id,
            name: emp.name,
            nameKey: emp.nameKey,
            department: emp.department,
            position: emp.position
          }
        });
      }
    }
  });
  return entries;
};

export const MOCK_TIME_ENTRIES = generateMockTimeEntries();

export const MOCK_TASKS = [
  {
    id: 'task-1',
    title: 'Q4 Report Analysis',
    titleKey: 'demoTasks.task-1.title',
    description: 'Analyze Q4 performance metrics and prepare presentation',
    descriptionKey: 'demoTasks.task-1.description',
    status: 'in-progress',
    priority: 'high',
    due_date: new Date(new Date().setDate(new Date().getDate() + 5)).toISOString().split('T')[0],
    employee_id: 'demo-emp-1',
    employee: MOCK_EMPLOYEES[0]
  },
  {
    id: 'task-2',
    title: 'Update Employee Handbook',
    titleKey: 'demoTasks.task-2.title',
    description: 'Review and update the 2024 employee handbook',
    descriptionKey: 'demoTasks.task-2.description',
    status: 'pending',
    priority: 'medium',
    due_date: new Date(new Date().setDate(new Date().getDate() + 10)).toISOString().split('T')[0],
    employee_id: 'demo-emp-1',
    employee: MOCK_EMPLOYEES[0]
  },
  {
    id: 'task-3',
    title: 'Fix Login Bug',
    titleKey: 'demoTasks.task-3.title',
    description: 'Investigate reported login issues on mobile devices',
    descriptionKey: 'demoTasks.task-3.description',
    status: 'completed',
    priority: 'high',
    due_date: new Date(new Date().setDate(new Date().getDate() - 2)).toISOString().split('T')[0],
    employee_id: 'demo-emp-2',
    employee: MOCK_EMPLOYEES[1]
  }
];

export const MOCK_GOALS = [
  {
    id: 'goal-1',
    title: 'Improve Team Efficiency',
    titleKey: 'demoGoals.goal-1.title',
    description: 'Implement new project management workflow',
    descriptionKey: 'demoGoals.goal-1.description',
    status: 'in_progress',
    progress: 65,
    category: 'Professional',
    employee_id: 'demo-emp-1',
    target_date: '2024-12-31',
    employee: MOCK_EMPLOYEES[0]
  },
  {
    id: 'goal-2',
    title: 'Learn React Native',
    titleKey: 'demoGoals.goal-2.title',
    description: 'Complete advanced React Native course',
    descriptionKey: 'demoGoals.goal-2.description',
    status: 'completed',
    progress: 100,
    category: 'Skills',
    employee_id: 'demo-emp-2',
    target_date: '2024-11-30',
    employee: MOCK_EMPLOYEES[1]
  }
];

export const MOCK_PERFORMANCE_REVIEWS = [
  {
    id: 'review-1',
    employee_id: 'demo-emp-1',
    reviewer_id: 'demo-emp-2',
    review_period: 'Q4 2024',
    review_type: 'quarterly',
    overall_rating: 4.5,
    technical_skills_rating: 5,
    communication_rating: 4,
    leadership_rating: 4,
    teamwork_rating: 5,
    problem_solving_rating: 4,
    strengths: 'Excellent technical skills, great team player',
    areas_for_improvement: 'Could improve on documentation',
    achievements: 'Led the migration to new architecture',
    comments: 'Outstanding performance this quarter',
    status: 'approved',
    review_date: '2024-10-15',
    employee: MOCK_EMPLOYEES[0],
    reviewer: MOCK_EMPLOYEES[1]
  },
  {
    id: 'review-2',
    employee_id: 'demo-emp-2',
    reviewer_id: 'demo-emp-1',
    review_period: 'Q4 2024',
    review_type: 'quarterly',
    overall_rating: 4.2,
    technical_skills_rating: 4,
    communication_rating: 5,
    leadership_rating: 4,
    teamwork_rating: 4,
    problem_solving_rating: 4,
    strengths: 'Excellent communication and problem-solving',
    areas_for_improvement: 'More proactive in meetings',
    achievements: 'Improved UI design system',
    comments: 'Great contribution to the team',
    status: 'submitted',
    review_date: '2024-10-20',
    employee: MOCK_EMPLOYEES[1],
    reviewer: MOCK_EMPLOYEES[0]
  }
];

export const MOCK_SKILLS = [
  {
    id: 'skill-1',
    employee_id: 'demo-emp-1',
    skill_name: 'React',
    skill_category: 'technical',
    rating: 5,
    proficiency_level: 'Expert',
    years_experience: 5,
    assessed_by: 'demo-emp-2',
    assessment_date: '2024-10-01',
    employee: MOCK_EMPLOYEES[0]
  },
  {
    id: 'skill-2',
    employee_id: 'demo-emp-1',
    skill_name: 'TypeScript',
    skill_category: 'technical',
    rating: 4,
    proficiency_level: 'Advanced',
    years_experience: 3,
    assessed_by: 'demo-emp-2',
    assessment_date: '2024-10-01',
    employee: MOCK_EMPLOYEES[0]
  },
  {
    id: 'skill-3',
    employee_id: 'demo-emp-2',
    skill_name: 'UI/UX Design',
    skill_category: 'design',
    rating: 5,
    proficiency_level: 'Expert',
    years_experience: 6,
    assessed_by: 'demo-emp-1',
    assessment_date: '2024-10-05',
    employee: MOCK_EMPLOYEES[1]
  }
];

export const MOCK_FEEDBACK = [
  {
    id: 'feedback-1',
    employee_id: 'demo-emp-1',
    feedback_from: 'demo-emp-2',
    feedback_type: 'peer',
    rating: 5,
    feedback_text: 'Great collaboration on the project. Very helpful and knowledgeable.',
    is_anonymous: false,
    feedback_date: '2024-10-10',
    feedback_from_employee: MOCK_EMPLOYEES[1]
  },
  {
    id: 'feedback-2',
    employee_id: 'demo-emp-2',
    feedback_from: 'demo-emp-1',
    feedback_type: 'manager',
    rating: 4,
    feedback_text: 'Excellent work on the new design system. Keep it up!',
    is_anonymous: false,
    feedback_date: '2024-10-12',
    feedback_from_employee: MOCK_EMPLOYEES[0]
  }
];

export const MOCK_JOB_POSTINGS = [
  {
    id: 'job-1',
    title: 'Senior Frontend Developer',
    department: 'engineering',
    position: 'senior_developer',
    status: 'active',
    posted_date: '2023-10-01',
    description: 'We are looking for an experienced Frontend Developer...',
    requirements: ['React', 'TypeScript', 'Tailwind CSS'],
    location: 'Remote',
    salary_range: '90k - 120k'
  },
  {
    id: 'job-2',
    title: 'Product Designer',
    department: 'technology',
    position: 'employee',
    status: 'active',
    posted_date: '2023-10-05',
    description: 'Join our design team to create amazing user experiences...',
    requirements: ['Figma', 'UI/UX', 'Prototyping'],
    location: 'New York',
    salary_range: '80k - 100k'
  }
];

export const MOCK_APPLICANTS = [
  {
    id: 'app-1',
    first_name: 'John',
    last_name: 'Doe',
    email: 'john.doe@example.com',
    phone: '555-1111',
    resume_url: '#',
    created_at: '2023-10-10'
  },
  {
    id: 'app-2',
    first_name: 'Jane',
    last_name: 'Smith',
    email: 'jane.smith@example.com',
    phone: '555-2222',
    resume_url: '#',
    created_at: '2023-10-12'
  }
];

export const MOCK_APPLICATIONS = [
  {
    id: 'appl-1',
    job_posting_id: 'job-1',
    applicant_id: 'app-1',
    status: 'under review',
    application_date: '2023-10-10',
    rating: 4,
    notes: 'Strong candidate',
    job_posting: MOCK_JOB_POSTINGS[0],
    applicant: MOCK_APPLICANTS[0]
  },
  {
    id: 'appl-2',
    job_posting_id: 'job-2',
    applicant_id: 'app-2',
    status: 'interview scheduled',
    application_date: '2023-10-12',
    rating: 5,
    notes: 'Excellent portfolio',
    job_posting: MOCK_JOB_POSTINGS[1],
    applicant: MOCK_APPLICANTS[1]
  }
];

export const MOCK_INTERVIEWS = [
  {
    id: 'int-1',
    application_id: 'appl-2',
    scheduled_date: new Date(Date.now() + 86400000).toISOString(), // Tomorrow
    interviewer_id: 'demo-emp-1',
    status: 'scheduled',
    type: 'Technical',
    notes: 'Portfolio review',
    application: MOCK_APPLICATIONS[1]
  }
];

export const MOCK_NOTIFICATIONS = [
  {
    id: 'notif-1',
    user_id: 'demo-user-id',
    title: 'Welcome to HR System',
    message: 'Welcome to the demo mode of the HR System. Feel free to explore!',
    type: 'info',
    category: 'system',
    is_read: false,
    created_at: new Date().toISOString(),
    action_url: '/dashboard',
    action_label: 'Go to Dashboard'
  },
  {
    id: 'notif-2',
    user_id: 'demo-user-id',
    title: 'New Task Assigned',
    message: 'You have been assigned a new task: Review Q3 Performance',
    type: 'warning',
    category: 'task',
    is_read: false,
    created_at: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
    action_url: '/tasks',
    action_label: 'View Task'
  },
  {
    id: 'notif-3',
    user_id: 'demo-user-id',
    title: 'Meeting Reminder',
    message: 'Team meeting in 30 minutes',
    type: 'info',
    category: 'calendar',
    is_read: true,
    created_at: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
    action_url: '/calendar',
    action_label: 'View Calendar'
  }
];

export const MOCK_SETTINGS = {
  user_id: 'demo-user-id',
  email_notifications: true,
  push_notifications: true,
  desktop_notifications: false,
  notification_frequency: 'realtime',
  notify_time_tracking: true,
  notify_performance: true,
  notify_employee_updates: true,
  notify_recruitment: true,
  notify_system: true,
  theme: 'system',
  language: 'en',
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
  date_format: 'MM/DD/YYYY',
  time_format: '12h',
  profile_visibility: 'all',
  show_email: true,
  show_phone: true,
  default_dashboard_view: 'overview',
  items_per_page: 10,
  auto_clock_out: false,
  auto_clock_out_time: '18:00:00',
  weekly_report: true
};

// ============================================
// DEMO MODE PERSISTENT STORAGE
// ============================================

const DEMO_TASKS_KEY = 'hr_app_demo_tasks';
const DEMO_GOALS_KEY = 'hr_app_demo_goals';
const DEMO_LEAVE_REQUESTS_KEY = 'hr_app_demo_leave_requests';

/**
 * Get all demo tasks (combines stored updates with original mock data)
 * @returns {Array} - Array of task objects
 */
export const getDemoTasks = () => {
  const stored = localStorage.getItem(DEMO_TASKS_KEY);
  const storedTasks = stored ? JSON.parse(stored) : [];
  
  // Get deleted task IDs
  const deletedIds = new Set(storedTasks.filter(t => t._deleted).map(t => t.id));
  
  // Stored tasks take precedence over mock tasks
  const storedIds = new Set(storedTasks.filter(t => !t._deleted).map(t => t.id));
  const visibleMockTasks = MOCK_TASKS.filter(t => !storedIds.has(t.id) && !deletedIds.has(t.id));
  
  return [...visibleMockTasks, ...storedTasks.filter(t => !t._deleted)];
};

/**
 * Add a new demo task
 * @param {Object} task - Task object to add
 * @returns {Object} - The added task
 */
export const addDemoTask = (task) => {
  const stored = localStorage.getItem(DEMO_TASKS_KEY);
  const storedTasks = stored ? JSON.parse(stored) : [];
  storedTasks.push(task);
  localStorage.setItem(DEMO_TASKS_KEY, JSON.stringify(storedTasks));
  return task;
};

/**
 * Update a demo task
 * @param {string} taskId - Task ID to update
 * @param {Object} updates - Updates to apply
 * @returns {Object|null} - Updated task or null if not found
 */
export const updateDemoTask = (taskId, updates) => {
  const stored = localStorage.getItem(DEMO_TASKS_KEY);
  let storedTasks = stored ? JSON.parse(stored) : [];
  
  // Check if it's already in storage
  const storedIndex = storedTasks.findIndex(t => t.id === taskId);
  if (storedIndex !== -1) {
    storedTasks[storedIndex] = { ...storedTasks[storedIndex], ...updates, updated_at: new Date().toISOString() };
    localStorage.setItem(DEMO_TASKS_KEY, JSON.stringify(storedTasks));
    return storedTasks[storedIndex];
  }
  
  // If not in storage, check if it's a mock task
  const mockTask = MOCK_TASKS.find(t => t.id === taskId);
  if (mockTask) {
    const updatedTask = { ...mockTask, ...updates, updated_at: new Date().toISOString() };
    storedTasks.push(updatedTask);
    localStorage.setItem(DEMO_TASKS_KEY, JSON.stringify(storedTasks));
    return updatedTask;
  }
  
  return null;
};

/**
 * Delete a demo task
 * @param {string} taskId - Task ID to delete
 * @returns {boolean} - True if deleted
 */
export const deleteDemoTask = (taskId) => {
  const stored = localStorage.getItem(DEMO_TASKS_KEY);
  let storedTasks = stored ? JSON.parse(stored) : [];
  
  // Check if it exists in storage
  const storedIndex = storedTasks.findIndex(t => t.id === taskId);
  if (storedIndex !== -1) {
    // Mark as deleted instead of removing (to track deleted mock tasks)
    storedTasks[storedIndex]._deleted = true;
  } else {
    // Add a deletion marker for mock tasks
    storedTasks.push({ id: taskId, _deleted: true });
  }
  
  localStorage.setItem(DEMO_TASKS_KEY, JSON.stringify(storedTasks));
  return true;
};

/**
 * Get all demo goals (combines stored updates with original mock data)
 * @returns {Array} - Array of goal objects
 */
export const getDemoGoals = () => {
  const stored = localStorage.getItem(DEMO_GOALS_KEY);
  const storedGoals = stored ? JSON.parse(stored) : [];
  
  // Get deleted goal IDs
  const deletedIds = new Set(storedGoals.filter(g => g._deleted).map(g => g.id));
  
  // Stored goals take precedence over mock goals
  const storedIds = new Set(storedGoals.filter(g => !g._deleted).map(g => g.id));
  const visibleMockGoals = MOCK_GOALS.filter(g => !storedIds.has(g.id) && !deletedIds.has(g.id));
  
  return [...visibleMockGoals, ...storedGoals.filter(g => !g._deleted)];
};

/**
 * Add a new demo goal
 * @param {Object} goal - Goal object to add
 * @returns {Object} - The added goal
 */
export const addDemoGoal = (goal) => {
  const stored = localStorage.getItem(DEMO_GOALS_KEY);
  const storedGoals = stored ? JSON.parse(stored) : [];
  storedGoals.push(goal);
  localStorage.setItem(DEMO_GOALS_KEY, JSON.stringify(storedGoals));
  return goal;
};

/**
 * Update a demo goal
 * @param {string} goalId - Goal ID to update
 * @param {Object} updates - Updates to apply
 * @returns {Object|null} - Updated goal or null if not found
 */
export const updateDemoGoal = (goalId, updates) => {
  const stored = localStorage.getItem(DEMO_GOALS_KEY);
  let storedGoals = stored ? JSON.parse(stored) : [];
  
  // Check if it's already in storage
  const storedIndex = storedGoals.findIndex(g => g.id === goalId);
  if (storedIndex !== -1) {
    storedGoals[storedIndex] = { ...storedGoals[storedIndex], ...updates, updated_at: new Date().toISOString() };
    localStorage.setItem(DEMO_GOALS_KEY, JSON.stringify(storedGoals));
    return storedGoals[storedIndex];
  }
  
  // If not in storage, check if it's a mock goal
  const mockGoal = MOCK_GOALS.find(g => g.id === goalId);
  if (mockGoal) {
    const updatedGoal = { ...mockGoal, ...updates, updated_at: new Date().toISOString() };
    storedGoals.push(updatedGoal);
    localStorage.setItem(DEMO_GOALS_KEY, JSON.stringify(storedGoals));
    return updatedGoal;
  }
  
  return null;
};

/**
 * Delete a demo goal
 * @param {string} goalId - Goal ID to delete
 * @returns {boolean} - True if deleted
 */
export const deleteDemoGoal = (goalId) => {
  const stored = localStorage.getItem(DEMO_GOALS_KEY);
  let storedGoals = stored ? JSON.parse(stored) : [];
  
  const storedIndex = storedGoals.findIndex(g => g.id === goalId);
  if (storedIndex !== -1) {
    storedGoals[storedIndex]._deleted = true;
  } else {
    storedGoals.push({ id: goalId, _deleted: true });
  }
  
  localStorage.setItem(DEMO_GOALS_KEY, JSON.stringify(storedGoals));
  return true;
};

/**
 * Get all demo leave requests
 * @returns {Array} - Array of leave request objects
 */
export const getDemoLeaveRequests = () => {
  const stored = localStorage.getItem(DEMO_LEAVE_REQUESTS_KEY);
  return stored ? JSON.parse(stored) : [];
};

/**
 * Add a new demo leave request
 * @param {Object} leaveRequest - Leave request object to add
 * @returns {Object} - The added leave request
 */
export const addDemoLeaveRequest = (leaveRequest) => {
  const stored = localStorage.getItem(DEMO_LEAVE_REQUESTS_KEY);
  const storedRequests = stored ? JSON.parse(stored) : [];
  storedRequests.push(leaveRequest);
  localStorage.setItem(DEMO_LEAVE_REQUESTS_KEY, JSON.stringify(storedRequests));
  return leaveRequest;
};

/**
 * Update a demo leave request
 * @param {string} requestId - Leave request ID to update
 * @param {Object} updates - Updates to apply
 * @returns {Object|null} - Updated leave request or null if not found
 */
export const updateDemoLeaveRequest = (requestId, updates) => {
  const stored = localStorage.getItem(DEMO_LEAVE_REQUESTS_KEY);
  let storedRequests = stored ? JSON.parse(stored) : [];
  
  const index = storedRequests.findIndex(r => r.id === requestId);
  if (index !== -1) {
    storedRequests[index] = { ...storedRequests[index], ...updates, updated_at: new Date().toISOString() };
    localStorage.setItem(DEMO_LEAVE_REQUESTS_KEY, JSON.stringify(storedRequests));
    return storedRequests[index];
  }
  
  return null;
};

/**
 * Delete a demo leave request
 * @param {string} requestId - Leave request ID to delete
 * @returns {boolean} - True if deleted
 */
export const deleteDemoLeaveRequest = (requestId) => {
  const stored = localStorage.getItem(DEMO_LEAVE_REQUESTS_KEY);
  let storedRequests = stored ? JSON.parse(stored) : [];
  
  storedRequests = storedRequests.filter(r => r.id !== requestId);
  localStorage.setItem(DEMO_LEAVE_REQUESTS_KEY, JSON.stringify(storedRequests));
  return true;
};

/**
 * Calculate days between two dates (inclusive)
 * @param {string} startDate - Start date string
 * @param {string} endDate - End date string
 * @returns {number} - Number of days
 */
export const calculateDaysBetween = (startDate, endDate) => {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const diffTime = Math.abs(end - start);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // +1 to include both start and end
  return diffDays;
};
