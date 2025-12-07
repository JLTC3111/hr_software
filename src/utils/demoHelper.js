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

// Mock Data
export const MOCK_USER = {
  id: 'demo-user-id',
  email: 'demo@example.com',
  name: 'Demo Admin',
  firstName: 'Demo',
  lastName: 'Admin',
  role: 'admin',
  avatar_url: 'https://i.pravatar.cc/150?u=demo',
  department: 'Management',
  position: 'HR Manager',
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
    email: 'demo@example.com',
    department: 'Management',
    position: 'HR Manager',
    status: 'active',
    photo: 'https://i.pravatar.cc/150?u=demo',
    phone: '555-0101',
    hire_date: '2023-01-15',
    salary: 85000,
    employment_status: 'active'
  },
  {
    id: 'demo-emp-2',
    name: 'Sarah Johnson',
    email: 'sarah.j@example.com',
    department: 'Engineering',
    position: 'Senior Developer',
    status: 'active',
    photo: 'https://i.pravatar.cc/150?u=sarah',
    phone: '555-0102',
    hire_date: '2023-03-10',
    salary: 95000,
    employment_status: 'active'
  },
  {
    id: 'demo-emp-3',
    name: 'Michael Chen',
    email: 'michael.c@example.com',
    department: 'Design',
    position: 'UI/UX Designer',
    status: 'active',
    photo: 'https://i.pravatar.cc/150?u=michael',
    phone: '555-0103',
    hire_date: '2023-06-20',
    salary: 78000,
    employment_status: 'active'
  },
  {
    id: 'demo-emp-4',
    name: 'Emily Davis',
    email: 'emily.d@example.com',
    department: 'Marketing',
    position: 'Marketing Specialist',
    status: 'active',
    photo: 'https://i.pravatar.cc/150?u=emily',
    phone: '555-0104',
    hire_date: '2023-02-01',
    salary: 65000,
    employment_status: 'active'
  },
  {
    id: 'demo-emp-5',
    name: 'James Wilson',
    email: 'james.w@example.com',
    department: 'Sales',
    position: 'Sales Representative',
    status: 'active',
    photo: 'https://i.pravatar.cc/150?u=james',
    phone: '555-0105',
    hire_date: '2023-08-15',
    salary: 60000,
    employment_status: 'active'
  }
];

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
    description: 'Analyze Q4 performance metrics and prepare presentation',
    status: 'in-progress',
    priority: 'high',
    due_date: new Date(new Date().setDate(new Date().getDate() + 5)).toISOString().split('T')[0],
    employee_id: 'demo-emp-1',
    employee: MOCK_EMPLOYEES[0]
  },
  {
    id: 'task-2',
    title: 'Update Employee Handbook',
    description: 'Review and update the 2024 employee handbook',
    status: 'pending',
    priority: 'medium',
    due_date: new Date(new Date().setDate(new Date().getDate() + 10)).toISOString().split('T')[0],
    employee_id: 'demo-emp-1',
    employee: MOCK_EMPLOYEES[0]
  },
  {
    id: 'task-3',
    title: 'Fix Login Bug',
    description: 'Investigate reported login issues on mobile devices',
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
    description: 'Implement new project management workflow',
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
    description: 'Complete advanced React Native course',
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
    department: 'Engineering',
    position: 'Senior Developer',
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
    department: 'Design',
    position: 'Designer',
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
