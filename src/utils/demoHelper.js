// Demo Mode Helper Utilities

const DEMO_STORAGE_KEY = 'hr_app_demo_mode';

export const isDemoMode = () => {
  return localStorage.getItem(DEMO_STORAGE_KEY) === 'true';
};

// Demo configuration - toggle behaviors used during demo mode
const DEMO_RANDOM_FACES_KEY = 'hr_app_demo_random_faces';
export const DEMO_CONFIG = {
  // When true, demo will fetch seeded RandomUser faces (experimental).
  // Default reads from localStorage; falls back to false.
  enableRandomFaces: localStorage.getItem(DEMO_RANDOM_FACES_KEY) === 'true'
};

export const setEnableDemoRandomFaces = (value) => {
  const v = !!value;
  DEMO_CONFIG.enableRandomFaces = v;
  try {
    localStorage.setItem(DEMO_RANDOM_FACES_KEY, v ? 'true' : 'false');
  } catch (_e) {
    // ignore
  }
};

export const enableDemoMode = () => {
  localStorage.setItem(DEMO_STORAGE_KEY, 'true');
  // Also set a flag for the current session
  globalThis.isDemoMode = true;
};

export const disableDemoMode = () => {
  localStorage.removeItem(DEMO_STORAGE_KEY);
  globalThis.isDemoMode = false;
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

// ============================================
// DETERMINISTIC NON-HUMAN AVATAR HELPERS
// Use identicons or initials-based avatars for demo mode
// These do not attempt to represent real people's ethnicity or appearance.
// ============================================

const hashToNumber = (str, max = 100) => {
  let h = 0;
  for (let i = 0; i < String(str).length; i++) {
    h = (h << 5) - h + String(str).charCodeAt(i);
    h |= 0; // convert to 32bit int
  }
  return Math.abs(h) % max;
};

/**
 * Return a deterministic avatar URL for demo employees.
 * style: 'identicon' | 'initials'
 */
export const getDemoAvatarUrl = (seed, { style = 'identicon', bg = 'ffffff', color = '0D8ABC' } = {}) => {
  const s = String(seed || 'demo');
  if (style === 'initials') {
    const name = encodeURIComponent(s.replace(/[-_]/g, ' '));
    return `https://ui-avatars.com/api/?name=${name}&background=${bg}&color=${color}&size=256`;
  }

  // Default to DiceBear Identicon (SVG)
  // Use hashed seed to keep variety but deterministic
  const seedStr = `${s}-${hashToNumber(s, 1000)}`;
  // New DiceBear API endpoint (the old `avatars.dicebear.com` endpoint can return 410)
  return `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(seedStr)}`;
};

const DEMO_PHOTO_CACHE_KEY = 'hr_app_demo_photo_cache_v1';

const readPhotoCache = () => {
  try {
    const raw = localStorage.getItem(DEMO_PHOTO_CACHE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (_e) {
    return {};
  }
};

const writePhotoCache = (cache) => {
  try {
    localStorage.setItem(DEMO_PHOTO_CACHE_KEY, JSON.stringify(cache));
  } catch (_e) {
    // ignore
  }
};

/**
 * Fetch a seeded RandomUser photo URL (large) and cache it in localStorage.
 * seed: string used to make the result deterministic (e.g., employee id)
 * options: { nat: 'us'|'gb'|..., gender: 'male'|'female' (optional) }
 * Returns: Promise<string> photoUrl or fallback identicon URL on error
 */
export const fetchSeededRandomUserPhoto = async (seed, { nat, _gender } = {}) => {
  if (!seed) return getDemoAvatarUrl(seed);

  const cache = readPhotoCache();
  if (cache[seed]) return cache[seed];

  try {
    const params = new URLSearchParams();
    params.set('seed', String(seed));
    if (nat) params.set('nat', String(nat));
    // include picture only for smaller payload
    params.set('inc', 'picture');

    const url = `https://randomuser.me/api/?${params.toString()}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('randomuser fetch failed');
    const json = await res.json();
    const picture = json?.results?.[0]?.picture;
    const photoUrl = picture?.large || picture?.medium || picture?.thumbnail;
    if (photoUrl) {
      cache[seed] = photoUrl;
      writePhotoCache(cache);
      return photoUrl;
    }
  } catch (_err) {
    // fallback to identicon
    return getDemoAvatarUrl(seed);
  }

  return getDemoAvatarUrl(seed);
};

/**
 * Attach seeded RandomUser photos to an array of employees.
 * This will fetch photos for each employee using their `id` as seed and
 * update the `photo` property in-place. Returns a Promise that resolves
 * to the updated employees array.
 */
export const attachSeededRandomUserPhotos = (employees, opts = {}) => {
  if (!Array.isArray(employees)) return employees;
  const promises = employees.map(async (emp) => {
    try {
      const url = await fetchSeededRandomUserPhoto(emp.id || emp.employee_id || emp.employeeId, opts);
      emp.photo = url;
    } catch (_e) {
      emp.photo = getDemoAvatarUrl(emp.id || emp.employee_id || emp.employeeId);
    }
    return emp;
  });

  return Promise.all(promises);
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

// ============================================
// PERFORMANCE REVIEW TRANSLATION HELPERS
// ============================================

/**
 * Get translated field for a demo performance review
 * @param {Object} review - The review object
 * @param {string} field - Field name (strengths, areasForImprovement, achievements, comments)
 * @param {string} keyField - Key field name
 * @param {Function} t - Translation function
 * @returns {string} - Translated value or original
 */
export const getDemoReviewField = (review, field, keyField, t) => {
  if (!isDemoMode() || !review || !t) return review?.[field] || '';
  
  if (review[keyField]) {
    const translated = t(review[keyField], null);
    if (translated && translated !== review[keyField]) {
      return translated;
    }
  }
  
  return review[field] || '';
};

export const getDemoReviewStrengths = (review, t) => getDemoReviewField(review, 'strengths', 'strengthsKey', t);
export const getDemoReviewAreasForImprovement = (review, t) => getDemoReviewField(review, 'areas_for_improvement', 'areasForImprovementKey', t);
export const getDemoReviewAchievements = (review, t) => getDemoReviewField(review, 'achievements', 'achievementsKey', t);
export const getDemoReviewComments = (review, t) => getDemoReviewField(review, 'comments', 'commentsKey', t);

// ============================================
// SKILL TRANSLATION HELPERS
// ============================================

export const getDemoSkillName = (skill, t) => {
  if (!isDemoMode() || !skill || !t) return skill?.skill_name || '';
  
  if (skill.skillNameKey) {
    const translated = t(skill.skillNameKey, null);
    if (translated && translated !== skill.skillNameKey) {
      return translated;
    }
  }
  
  return skill.skill_name || '';
};

export const getDemoSkillCategory = (skill, t) => {
  if (!isDemoMode() || !skill || !t) return skill?.skill_category || '';
  
  if (skill.skillCategoryKey) {
    const translated = t(skill.skillCategoryKey, null);
    if (translated && translated !== skill.skillCategoryKey) {
      return translated;
    }
  }
  
  return skill.skill_category || '';
};

export const getDemoSkillProficiency = (skill, t) => {
  if (!isDemoMode() || !skill || !t) return skill?.proficiency_level || '';
  
  if (skill.proficiencyLevelKey) {
    const translated = t(skill.proficiencyLevelKey, null);
    if (translated && translated !== skill.proficiencyLevelKey) {
      return translated;
    }
  }
  
  return skill.proficiency_level || '';
};

// ============================================
// FEEDBACK TRANSLATION HELPERS
// ============================================

export const getDemoFeedbackType = (feedback, t) => {
  if (!isDemoMode() || !feedback || !t) return feedback?.feedback_type || '';
  
  if (feedback.feedbackTypeKey) {
    const translated = t(feedback.feedbackTypeKey, null);
    if (translated && translated !== feedback.feedbackTypeKey) {
      return translated;
    }
  }
  
  return feedback.feedback_type || '';
};

export const getDemoFeedbackText = (feedback, t) => {
  if (!isDemoMode() || !feedback || !t) return feedback?.feedback_text || '';
  
  if (feedback.feedbackTextKey) {
    const translated = t(feedback.feedbackTextKey, null);
    if (translated && translated !== feedback.feedbackTextKey) {
      return translated;
    }
  }
  
  return feedback.feedback_text || '';
};

// ============================================
// JOB POSTING TRANSLATION HELPERS
// ============================================

export const getDemoJobTitle = (job, t) => {
  if (!isDemoMode() || !job || !t) return job?.title || '';
  
  if (job.titleKey) {
    const translated = t(job.titleKey, null);
    if (translated && translated !== job.titleKey) {
      return translated;
    }
  }
  
  return job.title || '';
};

export const getDemoJobDescription = (job, t) => {
  if (!isDemoMode() || !job || !t) return job?.description || '';
  
  if (job.descriptionKey) {
    const translated = t(job.descriptionKey, null);
    if (translated && translated !== job.descriptionKey) {
      return translated;
    }
  }
  
  return job.description || '';
};

export const getDemoJobLocation = (job, t) => {
  if (!isDemoMode() || !job || !t) return job?.location || '';
  
  if (job.locationKey) {
    const translated = t(job.locationKey, null);
    if (translated && translated !== job.locationKey) {
      return translated;
    }
  }
  
  return job.location || '';
};

export const getDemoJobSalaryRange = (job, t) => {
  if (!isDemoMode() || !job || !t) return job?.salary_range || '';
  
  if (job.salaryRangeKey) {
    const translated = t(job.salaryRangeKey, null);
    if (translated && translated !== job.salaryRangeKey) {
      return translated;
    }
  }
  
  return job.salary_range || '';
};

// ============================================
// APPLICANT TRANSLATION HELPERS
// ============================================

export const getDemoApplicantFirstName = (applicant, t) => {
  if (!isDemoMode() || !applicant || !t) return applicant?.first_name || '';
  
  if (applicant.firstNameKey) {
    const translated = t(applicant.firstNameKey, null);
    if (translated && translated !== applicant.firstNameKey) {
      return translated;
    }
  }
  
  return applicant.first_name || '';
};

export const getDemoApplicantLastName = (applicant, t) => {
  if (!isDemoMode() || !applicant || !t) return applicant?.last_name || '';
  
  if (applicant.lastNameKey) {
    const translated = t(applicant.lastNameKey, null);
    if (translated && translated !== applicant.lastNameKey) {
      return translated;
    }
  }
  
  return applicant.last_name || '';
};

export const getDemoApplicantFullName = (applicant, t) => {
  const firstName = getDemoApplicantFirstName(applicant, t);
  const lastName = getDemoApplicantLastName(applicant, t);
  return `${firstName} ${lastName}`.trim();
};

// ============================================
// APPLICATION TRANSLATION HELPERS
// ============================================

export const getDemoApplicationStatus = (application, t) => {
  if (!isDemoMode() || !application || !t) return application?.status || '';
  
  if (application.statusKey) {
    const translated = t(application.statusKey, null);
    if (translated && translated !== application.statusKey) {
      return translated;
    }
  }
  
  return application.status || '';
};

export const getDemoApplicationNotes = (application, t) => {
  if (!isDemoMode() || !application || !t) return application?.notes || '';
  
  if (application.notesKey) {
    const translated = t(application.notesKey, null);
    if (translated && translated !== application.notesKey) {
      return translated;
    }
  }
  
  return application.notes || '';
};

// ============================================
// INTERVIEW TRANSLATION HELPERS
// ============================================

export const getDemoInterviewStatus = (interview, t) => {
  if (!isDemoMode() || !interview || !t) return interview?.status || '';
  
  if (interview.statusKey) {
    const translated = t(interview.statusKey, null);
    if (translated && translated !== interview.statusKey) {
      return translated;
    }
  }
  
  return interview.status || '';
};

export const getDemoInterviewType = (interview, t) => {
  if (!isDemoMode() || !interview || !t) return interview?.type || '';
  
  if (interview.typeKey) {
    const translated = t(interview.typeKey, null);
    if (translated && translated !== interview.typeKey) {
      return translated;
    }
  }
  
  return interview.type || '';
};

export const getDemoInterviewNotes = (interview, t) => {
  if (!isDemoMode() || !interview || !t) return interview?.notes || '';
  
  if (interview.notesKey) {
    const translated = t(interview.notesKey, null);
    if (translated && translated !== interview.notesKey) {
      return translated;
    }
  }
  
  return interview.notes || '';
};

// ============================================
// NOTIFICATION TRANSLATION HELPERS
// ============================================

export const getDemoNotificationTitle = (notification, t) => {
  if (!isDemoMode() || !notification || !t) return notification?.title || '';
  
  if (notification.titleKey) {
    const translated = t(notification.titleKey, null);
    if (translated && translated !== notification.titleKey) {
      return translated;
    }
  }
  
  return notification.title || '';
};

export const getDemoNotificationMessage = (notification, t) => {
  if (!isDemoMode() || !notification || !t) return notification?.message || '';
  
  if (notification.messageKey) {
    const translated = t(notification.messageKey, null);
    if (translated && translated !== notification.messageKey) {
      return translated;
    }
  }
  
  return notification.message || '';
};

export const getDemoNotificationActionLabel = (notification, t) => {
  if (!isDemoMode() || !notification || !t) return notification?.action_label || '';
  
  if (notification.actionLabelKey) {
    const translated = t(notification.actionLabelKey, null);
    if (translated && translated !== notification.actionLabelKey) {
      return translated;
    }
  }
  
  return notification.action_label || '';
};

// Mock Data
export const MOCK_USER = {
  id: 'demo-user-id',
  email: 'tech@company.com',
  name: 'Demo Admin',
  firstName: 'Demo',
  lastName: 'Admin',
  role: 'demo_admin',
  avatar_url: 'https://randomuser.me/api/portraits/men/32.jpg',
  department: 'human_resources',
  position: 'hr_specialist',
  employeeId: 'demo-emp-1',
  employee_id: 'demo-emp-1', // Add snake_case version for compatibility with filtering
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
    photo: getDemoAvatarUrl('demo-emp-1'),
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
    photo: getDemoAvatarUrl('demo-emp-2'),
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
    photo: getDemoAvatarUrl('demo-emp-3'),
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
    photo: getDemoAvatarUrl('demo-emp-4'),
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
    photo: getDemoAvatarUrl('demo-emp-5'),
    phone: '555-0105',
    hire_date: '2023-08-15',
    dob: '1988-12-12',
    salary: 60000,
    employment_status: 'active'
  }
];

const DEMO_EMPLOYEES_KEY = 'hr_app_demo_employees';
const DELETED_DEMO_EMPLOYEE_IDS_KEY = 'hr_app_demo_deleted_employee_ids';

const getDeletedDemoEmployeeIds = () => {
  const stored = localStorage.getItem(DELETED_DEMO_EMPLOYEE_IDS_KEY);
  return stored ? JSON.parse(stored) : [];
};

const setDeletedDemoEmployeeIds = (ids) => {
  localStorage.setItem(DELETED_DEMO_EMPLOYEE_IDS_KEY, JSON.stringify(ids));
};

export const getDemoEmployees = () => {
  const stored = localStorage.getItem(DEMO_EMPLOYEES_KEY);
  const storedEmployees = stored ? JSON.parse(stored) : [];
  const deletedIds = new Set(getDeletedDemoEmployeeIds().map(id => String(id)));
  
  // Stored employees take precedence over mock employees (allows "updating" mock data)
  const storedIds = new Set(storedEmployees.map(e => e.id));
  const visibleMockEmployees = MOCK_EMPLOYEES.filter(e => !storedIds.has(e.id));
  
  // Hide any employees that have been deleted in demo mode
  const filteredMock = visibleMockEmployees.filter(e => !deletedIds.has(String(e.id)));
  const filteredStored = storedEmployees.filter(e => !deletedIds.has(String(e.id)));
  
  const merged = [...filteredMock, ...filteredStored];

  // If we have cached seeded photos, apply them to the returned employees
  try {
    const photoCache = readPhotoCache();
    return merged.map(emp => ({
      ...emp,
      photo: photoCache[emp.id] || emp.photo
    }));
  } catch (_e) {
    return merged;
  }
};

/**
 * Find a demo employee by ID
 * @param {string} employeeId - The employee ID to look up
 * @returns {Object|null} - The employee object or null if not found
 */
export const getDemoEmployeeById = (employeeId) => {
  if (!employeeId) return null;
  const employees = getDemoEmployees();
  return employees.find(e => String(e.id) === String(employeeId)) || null;
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
  const storedEmployees = stored ? JSON.parse(stored) : [];
  
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

export const deleteDemoEmployee = (employeeId) => {
  if (!employeeId) return false;
  const id = String(employeeId);

  // Remove from stored employees
  const stored = localStorage.getItem(DEMO_EMPLOYEES_KEY);
  const storedEmployees = stored ? JSON.parse(stored) : [];
  const updatedStored = storedEmployees.filter(e => String(e.id) !== id);
  localStorage.setItem(DEMO_EMPLOYEES_KEY, JSON.stringify(updatedStored));

  // Track deleted IDs so mock employees stay hidden
  const deletedIds = new Set(getDeletedDemoEmployeeIds().map(item => String(item)));
  deletedIds.add(id);
  setDeletedDemoEmployeeIds(Array.from(deletedIds));

  return true;
};

// Generate some random time entries for the current month
const generateMockTimeEntries = () => {
  const entries = [];
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // Generate entries by day first, then by employee for better interleaving
  for (let day = 1; day <= Math.min(daysInMonth, today.getDate()); day++) {
    const date = new Date(year, month, day);
    // Skip weekends
    if (date.getDay() === 0 || date.getDay() === 6) continue;
    
    const dateStr = date.toISOString().split('T')[0];
    
    MOCK_EMPLOYEES.forEach((emp, empIndex) => {
      // Use seeded random based on emp index and day for consistent results
      // This ensures all employees have entries, not just some
      const seed = (empIndex * 31 + day) % 100;
      if (seed > 95) return; // Only ~5% absent rate

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

      // Add some overtime (~20% of entries) - use seeded value
      const overtimeSeed = (empIndex * 37 + day * 3) % 100;
      if (overtimeSeed < 20) {
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

      // Add some WFH days (~15% of entries) - use seeded value
      const wfhSeed = (empIndex * 41 + day * 7) % 100;
      if (wfhSeed < 15) {
        entries.push({
          id: `te-wfh-${emp.id}-${day}`,
          employee_id: emp.id,
          employee_name: emp.name,
          employee_nameKey: emp.nameKey,
          employee_department: emp.department,
          employee_position: emp.position,
          date: dateStr,
          hours: 8,
          hour_type: 'wfh',
          status: 'approved',
          clock_in: '08:00:00',
          clock_out: '16:00:00',
          employee: {
            id: emp.id,
            name: emp.name,
            nameKey: emp.nameKey,
            department: emp.department,
            position: emp.position
          }
        });
      }

      // Add bonus hours (~5% of entries) - use seeded value
      const bonusSeed = (empIndex * 53 + day * 11) % 100;
      if (bonusSeed < 5) {
        entries.push({
          id: `te-bonus-${emp.id}-${day}`,
          employee_id: emp.id,
          employee_name: emp.name,
          employee_nameKey: emp.nameKey,
          employee_department: emp.department,
          employee_position: emp.position,
          date: dateStr,
          hours: 4,
          hour_type: 'bonus',
          status: 'approved',
          clock_in: '10:00:00',
          clock_out: '14:00:00',
          employee: {
            id: emp.id,
            name: emp.name,
            nameKey: emp.nameKey,
            department: emp.department,
            position: emp.position
          }
        });
      }
    });
  }

  // Add some holiday entries for specific dates - include all employees
  const holidays = [
    { date: `${year}-01-01`, name: 'New Year' },
    { date: `${year}-12-25`, name: 'Christmas' }
  ];
  
  holidays.forEach(holiday => {
    if (holiday.date >= `${year}-${String(month + 1).padStart(2, '0')}-01` && 
        holiday.date <= `${year}-${String(month + 1).padStart(2, '0')}-${daysInMonth}`) {
      MOCK_EMPLOYEES.forEach(emp => {
        entries.push({
          id: `te-hol-${emp.id}-${holiday.date}`,
          employee_id: emp.id,
          employee_name: emp.name,
          employee_nameKey: emp.nameKey,
          employee_department: emp.department,
          employee_position: emp.position,
          date: holiday.date,
          hours: 8,
          hour_type: 'holiday',
          status: 'approved',
          clock_in: '09:00:00',
          clock_out: '17:00:00',
          notes: holiday.name,
          employee: {
            id: emp.id,
            name: emp.name,
            nameKey: emp.nameKey,
            department: emp.department,
            position: emp.position
          }
        });
      });
    }
  });

  return entries;
};

export const MOCK_TIME_ENTRIES = generateMockTimeEntries();

const DEMO_TIME_ENTRIES_KEY = 'hr_app_demo_time_entries';

export const getDemoTimeEntries = () => {
  const stored = localStorage.getItem(DEMO_TIME_ENTRIES_KEY);
  const storedEntries = stored ? JSON.parse(stored) : [];
  // Get IDs of stored entries (including deleted ones)
  const storedIds = new Set(storedEntries.map(e => e.id));
  // Filter out mock entries that have been overridden in storage
  const visibleMock = MOCK_TIME_ENTRIES.filter(e => !storedIds.has(e.id));
  // Filter out deleted entries from stored entries
  const activeStoredEntries = storedEntries.filter(e => !e._deleted);
  
  console.log('[DEBUG getDemoTimeEntries]', {
    storedCount: storedEntries.length,
    activeStoredCount: activeStoredEntries.length,
    mockCount: MOCK_TIME_ENTRIES.length,
    visibleMockCount: visibleMock.length,
    totalReturned: visibleMock.length + activeStoredEntries.length,
    sampleStored: activeStoredEntries.slice(0, 2).map(e => ({ id: e.id, date: e.date, employee_id: e.employee_id }))
  });
  
  return [...visibleMock, ...activeStoredEntries];
};

export const addDemoTimeEntry = (entry) => {
  const stored = localStorage.getItem(DEMO_TIME_ENTRIES_KEY);
  const storedEntries = stored ? JSON.parse(stored) : [];
  storedEntries.unshift(entry); // add to front
  localStorage.setItem(DEMO_TIME_ENTRIES_KEY, JSON.stringify(storedEntries));
  return entry;
};

export const updateDemoTimeEntry = (entryId, updates) => {
  const stored = localStorage.getItem(DEMO_TIME_ENTRIES_KEY);
  const storedEntries = stored ? JSON.parse(stored) : [];
  
  // Check if entry exists in stored entries
  const existingIndex = storedEntries.findIndex(e => e.id === entryId);
  
  if (existingIndex >= 0) {
    // Update existing stored entry
    storedEntries[existingIndex] = { ...storedEntries[existingIndex], ...updates };
  } else {
    // Entry is from MOCK_TIME_ENTRIES, need to copy and modify
    const mockEntry = MOCK_TIME_ENTRIES.find(e => e.id === entryId);
    if (mockEntry) {
      storedEntries.push({ ...mockEntry, ...updates });
    }
  }
  
  localStorage.setItem(DEMO_TIME_ENTRIES_KEY, JSON.stringify(storedEntries));
  return { id: entryId, ...updates };
};

export const deleteDemoTimeEntry = (entryId) => {
  const stored = localStorage.getItem(DEMO_TIME_ENTRIES_KEY);
  const storedEntries = stored ? JSON.parse(stored) : [];
  
  // Check if entry exists in stored entries - remove it
  const existingIndex = storedEntries.findIndex(e => e.id === entryId);
  
  if (existingIndex >= 0) {
    // Remove from stored entries
    storedEntries.splice(existingIndex, 1);
  } else {
    // Entry is from MOCK_TIME_ENTRIES - mark as deleted by storing with _deleted flag
    const mockEntry = MOCK_TIME_ENTRIES.find(e => e.id === entryId);
    if (mockEntry) {
      storedEntries.push({ ...mockEntry, _deleted: true });
    }
  }
  
  localStorage.setItem(DEMO_TIME_ENTRIES_KEY, JSON.stringify(storedEntries));
  return { success: true };
};

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
  },
  {
    id: 'task-4',
    title: 'Design New Dashboard',
    titleKey: 'demoTasks.task-4.title',
    description: 'Create wireframes and mockups for the analytics dashboard',
    descriptionKey: 'demoTasks.task-4.description',
    status: 'in-progress',
    priority: 'high',
    due_date: new Date(new Date().setDate(new Date().getDate() + 7)).toISOString().split('T')[0],
    employee_id: 'demo-emp-3',
    employee: MOCK_EMPLOYEES[2]
  },
  {
    id: 'task-5',
    title: 'Campaign Performance Review',
    titleKey: 'demoTasks.task-5.title',
    description: 'Analyze Q3 marketing campaign results and ROI',
    descriptionKey: 'demoTasks.task-5.description',
    status: 'pending',
    priority: 'medium',
    due_date: new Date(new Date().setDate(new Date().getDate() + 14)).toISOString().split('T')[0],
    employee_id: 'demo-emp-4',
    employee: MOCK_EMPLOYEES[3]
  },
  {
    id: 'task-6',
    title: 'Client Onboarding',
    titleKey: 'demoTasks.task-6.title',
    description: 'Complete onboarding for new enterprise client',
    descriptionKey: 'demoTasks.task-6.description',
    status: 'in-progress',
    priority: 'high',
    due_date: new Date(new Date().setDate(new Date().getDate() + 3)).toISOString().split('T')[0],
    employee_id: 'demo-emp-5',
    employee: MOCK_EMPLOYEES[4]
  },
  {
    id: 'task-7',
    title: 'API Documentation',
    titleKey: 'demoTasks.task-7.title',
    description: 'Write comprehensive API documentation for v2.0',
    descriptionKey: 'demoTasks.task-7.description',
    status: 'completed',
    priority: 'medium',
    due_date: new Date(new Date().setDate(new Date().getDate() - 5)).toISOString().split('T')[0],
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
  },
  {
    id: 'goal-3',
    title: 'UX Certification',
    titleKey: 'demoGoals.goal-3.title',
    description: 'Obtain Google UX Design Professional Certificate',
    descriptionKey: 'demoGoals.goal-3.description',
    status: 'in_progress',
    progress: 45,
    category: 'Skills',
    employee_id: 'demo-emp-3',
    target_date: '2025-03-31',
    employee: MOCK_EMPLOYEES[2]
  },
  {
    id: 'goal-4',
    title: 'Increase Lead Generation',
    titleKey: 'demoGoals.goal-4.title',
    description: 'Achieve 30% increase in qualified leads through marketing campaigns',
    descriptionKey: 'demoGoals.goal-4.description',
    status: 'in_progress',
    progress: 70,
    category: 'Performance',
    employee_id: 'demo-emp-4',
    target_date: '2025-02-28',
    employee: MOCK_EMPLOYEES[3]
  },
  {
    id: 'goal-5',
    title: 'Close Enterprise Deals',
    titleKey: 'demoGoals.goal-5.title',
    description: 'Close 5 enterprise-level deals worth $500K+ each',
    descriptionKey: 'demoGoals.goal-5.description',
    status: 'in_progress',
    progress: 40,
    category: 'Performance',
    employee_id: 'demo-emp-5',
    target_date: '2025-06-30',
    employee: MOCK_EMPLOYEES[4]
  }
];

export const MOCK_PERFORMANCE_REVIEWS = [
  {
    id: 'review-1',
    employee_id: 'demo-emp-1',
    reviewer_id: 'demo-emp-2',
    review_period: 'Q4 2024',
    review_periodKey: 'demoReviews.review-1.reviewPeriod',
    review_type: 'quarterly',
    overall_rating: 4.5,
    technical_skills_rating: 5,
    communication_rating: 4,
    leadership_rating: 4,
    teamwork_rating: 5,
    problem_solving_rating: 4,
    strengths: 'Excellent technical skills, great team player',
    strengthsKey: 'demoReviews.review-1.strengths',
    areas_for_improvement: 'Could improve on documentation',
    areasForImprovementKey: 'demoReviews.review-1.areasForImprovement',
    achievements: 'Led the migration to new architecture',
    achievementsKey: 'demoReviews.review-1.achievements',
    comments: 'Outstanding performance this quarter',
    commentsKey: 'demoReviews.review-1.comments',
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
    review_periodKey: 'demoReviews.review-2.reviewPeriod',
    review_type: 'quarterly',
    overall_rating: 4.2,
    technical_skills_rating: 4,
    communication_rating: 5,
    leadership_rating: 4,
    teamwork_rating: 4,
    problem_solving_rating: 4,
    strengths: 'Excellent communication and problem-solving',
    strengthsKey: 'demoReviews.review-2.strengths',
    areas_for_improvement: 'More proactive in meetings',
    areasForImprovementKey: 'demoReviews.review-2.areasForImprovement',
    achievements: 'Improved UI design system',
    achievementsKey: 'demoReviews.review-2.achievements',
    comments: 'Great contribution to the team',
    commentsKey: 'demoReviews.review-2.comments',
    status: 'submitted',
    review_date: '2024-10-20',
    employee: MOCK_EMPLOYEES[1],
    reviewer: MOCK_EMPLOYEES[0]
  }
];

// ============================================
// PERSISTENT DEMO PERFORMANCE REVIEWS
// ============================================
const DEMO_REVIEWS_KEY = 'hr_app_demo_reviews';

export const getDemoReviews = () => {
  const stored = localStorage.getItem(DEMO_REVIEWS_KEY);
  const storedReviews = stored ? JSON.parse(stored) : [];
  const storedIds = new Set(storedReviews.map(r => r.id));
  const visibleMock = MOCK_PERFORMANCE_REVIEWS.filter(r => !storedIds.has(r.id));
  return [...visibleMock, ...storedReviews];
};

export const addDemoReview = (review) => {
  const stored = localStorage.getItem(DEMO_REVIEWS_KEY);
  const storedReviews = stored ? JSON.parse(stored) : [];
  storedReviews.unshift(review);
  localStorage.setItem(DEMO_REVIEWS_KEY, JSON.stringify(storedReviews));
  return review;
};

export const updateDemoReview = (reviewId, updates) => {
  const stored = localStorage.getItem(DEMO_REVIEWS_KEY);
  const storedReviews = stored ? JSON.parse(stored) : [];
  
  const storedIndex = storedReviews.findIndex(r => r.id === reviewId);
  if (storedIndex !== -1) {
    storedReviews[storedIndex] = { ...storedReviews[storedIndex], ...updates, updated_at: new Date().toISOString() };
    localStorage.setItem(DEMO_REVIEWS_KEY, JSON.stringify(storedReviews));
    return storedReviews[storedIndex];
  }
  
  // If updating a mock review, clone it to storage
  const mockReview = MOCK_PERFORMANCE_REVIEWS.find(r => r.id === reviewId);
  if (mockReview) {
    const updatedReview = { ...mockReview, ...updates, updated_at: new Date().toISOString() };
    storedReviews.push(updatedReview);
    localStorage.setItem(DEMO_REVIEWS_KEY, JSON.stringify(storedReviews));
    return updatedReview;
  }
  
  return null;
};

export const deleteDemoReview = (reviewId) => {
  const stored = localStorage.getItem(DEMO_REVIEWS_KEY);
  let storedReviews = stored ? JSON.parse(stored) : [];
  storedReviews = storedReviews.filter(r => r.id !== reviewId);
  // Add a tombstone for mock reviews
  const mockReview = MOCK_PERFORMANCE_REVIEWS.find(r => r.id === reviewId);
  if (mockReview) {
    storedReviews.push({ id: reviewId, _deleted: true });
  }
  localStorage.setItem(DEMO_REVIEWS_KEY, JSON.stringify(storedReviews));
};

export const MOCK_SKILLS = [
  {
    id: 'skill-1',
    employee_id: 'demo-emp-1',
    skill_name: 'React',
    skillNameKey: 'demoSkills.skill-1.name',
    skill_category: 'technical',
    skillCategoryKey: 'demoSkills.skill-1.category',
    rating: 5,
    proficiency_level: 'Expert',
    proficiencyLevelKey: 'demoSkills.skill-1.proficiencyLevel',
    years_experience: 5,
    assessed_by: 'demo-emp-2',
    assessment_date: '2024-10-01',
    employee: MOCK_EMPLOYEES[0]
  },
  {
    id: 'skill-2',
    employee_id: 'demo-emp-1',
    skill_name: 'TypeScript',
    skillNameKey: 'demoSkills.skill-2.name',
    skill_category: 'technical',
    skillCategoryKey: 'demoSkills.skill-2.category',
    rating: 4,
    proficiency_level: 'Advanced',
    proficiencyLevelKey: 'demoSkills.skill-2.proficiencyLevel',
    years_experience: 3,
    assessed_by: 'demo-emp-2',
    assessment_date: '2024-10-01',
    employee: MOCK_EMPLOYEES[0]
  },
  {
    id: 'skill-3',
    employee_id: 'demo-emp-2',
    skill_name: 'UI/UX Design',
    skillNameKey: 'demoSkills.skill-3.name',
    skill_category: 'design',
    skillCategoryKey: 'demoSkills.skill-3.category',
    rating: 5,
    proficiency_level: 'Expert',
    proficiencyLevelKey: 'demoSkills.skill-3.proficiencyLevel',
    years_experience: 6,
    assessed_by: 'demo-emp-1',
    assessment_date: '2024-10-05',
    employee: MOCK_EMPLOYEES[1]
  }
];

// ============================================
// PERSISTENT DEMO SKILLS ASSESSMENTS
// ============================================
const DEMO_SKILLS_KEY = 'hr_app_demo_skills';

export const getDemoSkills = () => {
  const stored = localStorage.getItem(DEMO_SKILLS_KEY);
  const storedSkills = stored ? JSON.parse(stored) : [];
  const storedIds = new Set(storedSkills.map(s => s.id));
  const deletedIds = new Set(storedSkills.filter(s => s._deleted).map(s => s.id));
  const visibleMock = MOCK_SKILLS.filter(s => !storedIds.has(s.id) && !deletedIds.has(s.id));
  return [...visibleMock, ...storedSkills.filter(s => !s._deleted)];
};

export const addDemoSkill = (skill) => {
  const stored = localStorage.getItem(DEMO_SKILLS_KEY);
  const storedSkills = stored ? JSON.parse(stored) : [];
  storedSkills.unshift(skill);
  localStorage.setItem(DEMO_SKILLS_KEY, JSON.stringify(storedSkills));
  return skill;
};

export const updateDemoSkill = (skillId, updates) => {
  const stored = localStorage.getItem(DEMO_SKILLS_KEY);
  const storedSkills = stored ? JSON.parse(stored) : [];
  
  const storedIndex = storedSkills.findIndex(s => s.id === skillId);
  if (storedIndex !== -1) {
    storedSkills[storedIndex] = { ...storedSkills[storedIndex], ...updates, updated_at: new Date().toISOString() };
    localStorage.setItem(DEMO_SKILLS_KEY, JSON.stringify(storedSkills));
    return storedSkills[storedIndex];
  }
  
  // If updating a mock skill, clone it to storage
  const mockSkill = MOCK_SKILLS.find(s => s.id === skillId);
  if (mockSkill) {
    const updatedSkill = { ...mockSkill, ...updates, updated_at: new Date().toISOString() };
    storedSkills.push(updatedSkill);
    localStorage.setItem(DEMO_SKILLS_KEY, JSON.stringify(storedSkills));
    return updatedSkill;
  }
  
  return null;
};

export const upsertDemoSkill = (skillData) => {
  // Check if skill exists for this employee with same skill_name
  const allSkills = getDemoSkills();
  const existing = allSkills.find(s => 
    String(s.employee_id) === String(skillData.employee_id) && 
    s.skill_name === skillData.skill_name
  );
  
  if (existing) {
    return updateDemoSkill(existing.id, skillData);
  } else {
    const newSkill = {
      id: `skill-demo-${Date.now()}`,
      ...skillData,
      created_at: new Date().toISOString()
    };
    return addDemoSkill(newSkill);
  }
};

export const deleteDemoSkill = (skillId) => {
  const stored = localStorage.getItem(DEMO_SKILLS_KEY);
  let storedSkills = stored ? JSON.parse(stored) : [];
  storedSkills = storedSkills.filter(s => s.id !== skillId);
  // Add tombstone for mock skills
  const mockSkill = MOCK_SKILLS.find(s => s.id === skillId);
  if (mockSkill) {
    storedSkills.push({ id: skillId, _deleted: true });
  }
  localStorage.setItem(DEMO_SKILLS_KEY, JSON.stringify(storedSkills));
};

export const MOCK_FEEDBACK = [
  {
    id: 'feedback-1',
    employee_id: 'demo-emp-1',
    feedback_from: 'demo-emp-2',
    feedback_type: 'peer',
    feedbackTypeKey: 'demoFeedback.feedback-1.type',
    rating: 5,
    feedback_text: 'Great collaboration on the project. Very helpful and knowledgeable.',
    feedbackTextKey: 'demoFeedback.feedback-1.text',
    is_anonymous: false,
    feedback_date: '2024-10-10',
    feedback_from_employee: MOCK_EMPLOYEES[1]
  },
  {
    id: 'feedback-2',
    employee_id: 'demo-emp-2',
    feedback_from: 'demo-emp-1',
    feedback_type: 'manager',
    feedbackTypeKey: 'demoFeedback.feedback-2.type',
    rating: 4,
    feedback_text: 'Excellent work on the new design system. Keep it up!',
    feedbackTextKey: 'demoFeedback.feedback-2.text',
    is_anonymous: false,
    feedback_date: '2024-10-12',
    feedback_from_employee: MOCK_EMPLOYEES[0]
  }
];

export const MOCK_JOB_POSTINGS = [
  {
    id: 'job-1',
    title: 'Senior Frontend Developer',
    titleKey: 'demoJobs.job-1.title',
    department: 'engineering',
    position: 'senior_developer',
    status: 'active',
    posted_date: '2023-10-01',
    description: 'We are looking for an experienced Frontend Developer...',
    descriptionKey: 'demoJobs.job-1.description',
    requirements: ['React', 'TypeScript', 'Tailwind CSS'],
    requirementsKeys: ['demoJobs.job-1.requirements.0', 'demoJobs.job-1.requirements.1', 'demoJobs.job-1.requirements.2'],
    location: 'Remote',
    locationKey: 'demoJobs.job-1.location',
    salary_range: '90k - 120k',
    salaryRangeKey: 'demoJobs.job-1.salaryRange'
  },
  {
    id: 'job-2',
    title: 'Product Designer',
    titleKey: 'demoJobs.job-2.title',
    department: 'technology',
    position: 'employee',
    status: 'active',
    posted_date: '2023-10-05',
    description: 'Join our design team to create amazing user experiences...',
    descriptionKey: 'demoJobs.job-2.description',
    requirements: ['Figma', 'UI/UX', 'Prototyping'],
    requirementsKeys: ['demoJobs.job-2.requirements.0', 'demoJobs.job-2.requirements.1', 'demoJobs.job-2.requirements.2'],
    location: 'New York',
    locationKey: 'demoJobs.job-2.location',
    salary_range: '80k - 100k',
    salaryRangeKey: 'demoJobs.job-2.salaryRange'
  }
];

export const MOCK_APPLICANTS = [
  {
    id: 'app-1',
    first_name: 'John',
    firstNameKey: 'demoApplicants.app-1.firstName',
    last_name: 'Doe',
    lastNameKey: 'demoApplicants.app-1.lastName',
    email: 'john.doe@example.com',
    phone: '555-1111',
    resume_url: '/demoCVs/john_doe_resume.pdf',
    linkedin_profile: 'https://linkedin.com/in/johndoe',
    education_level: 'Bachelor of Computer Science',
    educationLevelKey: 'demoApplicants.app-1.education',
    current_position: 'Senior Developer',
    currentPositionKey: 'demoApplicants.app-1.currentPosition',
    years_experience: 5,
    created_at: '2023-10-10'
  },
  {
    id: 'app-2',
    first_name: 'Jane',
    firstNameKey: 'demoApplicants.app-2.firstName',
    last_name: 'Smith',
    lastNameKey: 'demoApplicants.app-2.lastName',
    email: 'jane.smith@example.com',
    phone: '555-2222',
    resume_url: '/demoCVs/jane_smith_resume.pdf',
    linkedin_profile: 'https://linkedin.com/in/janesmith',
    education_level: 'Master of Design',
    educationLevelKey: 'demoApplicants.app-2.education',
    current_position: 'UX Lead',
    currentPositionKey: 'demoApplicants.app-2.currentPosition',
    years_experience: 7,
    created_at: '2023-10-12'
  }
];

export const MOCK_APPLICATIONS = [
  {
    id: 'appl-1',
    job_posting_id: 'job-1',
    applicant_id: 'app-1',
    status: 'under review',
    statusKey: 'demoApplications.appl-1.status',
    application_date: '2023-10-10',
    rating: 4,
    notes: 'Strong candidate',
    notesKey: 'demoApplications.appl-1.notes',
    job_posting: MOCK_JOB_POSTINGS[0],
    applicant: MOCK_APPLICANTS[0]
  },
  {
    id: 'appl-2',
    job_posting_id: 'job-2',
    applicant_id: 'app-2',
    status: 'interview scheduled',
    statusKey: 'demoApplications.appl-2.status',
    application_date: '2023-10-12',
    rating: 5,
    notes: 'Excellent portfolio',
    notesKey: 'demoApplications.appl-2.notes',
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
    statusKey: 'demoInterviews.int-1.status',
    type: 'Technical',
    typeKey: 'demoInterviews.int-1.type',
    notes: 'Portfolio review',
    notesKey: 'demoInterviews.int-1.notes',
    application: MOCK_APPLICATIONS[1]
  }
];

export const MOCK_NOTIFICATIONS = [
  {
    id: 'notif-1',
    user_id: 'demo-user-id',
    title: 'Welcome to HR System',
    titleKey: 'demoNotifications.notif-1.title',
    message: 'Welcome to the demo mode of the HR System. Feel free to explore!',
    messageKey: 'demoNotifications.notif-1.message',
    type: 'info',
    category: 'system',
    is_read: false,
    created_at: new Date().toISOString(),
    action_url: '/dashboard',
    action_label: 'Go to Dashboard',
    actionLabelKey: 'demoNotifications.notif-1.actionLabel'
  },
  {
    id: 'notif-2',
    user_id: 'demo-user-id',
    title: 'New Application',
    titleKey: 'demoNotifications.notif-2.title',
    message: 'New application received for Senior Frontend Developer position.',
    messageKey: 'demoNotifications.notif-2.message',
    type: 'warning',
    category: 'recruitment',
    is_read: false,
    created_at: new Date(Date.now() - 3600000).toISOString(), 
    action_url: '/recruitment',
    action_label: 'View Application',
    actionLabelKey: 'demoNotifications.notif-2.actionLabel'
  },
  {
    id: 'notif-3',
    user_id: 'demo-user-id',
    title: 'Performance Review Due',
    titleKey: 'demoNotifications.notif-3.title',
    message: 'Quarterly performance reviews are due next week.',
    messageKey: 'demoNotifications.notif-3.message',
    type: 'info',
    category: 'performance',
    is_read: true,
    created_at: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
    action_url: '/performance',
    action_label: 'View Reviews',
    actionLabelKey: 'demoNotifications.notif-3.actionLabel'
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

export const resetDemoTasks = () => {
  try {
    localStorage.removeItem(DEMO_TASKS_KEY);
    return true;
  } catch (err) {
    console.error('Failed to reset demo tasks:', err);
    return false;
  }
};

/**
 * Reset all demo persistent data (tasks, goals, leave requests, time entries, etc.)
 * This will cause the UI to fall back to the builtin MOCK_* arrays again
 */
export const resetAllDemoData = () => {
  try {
    localStorage.removeItem(DEMO_TASKS_KEY);
    localStorage.removeItem(DEMO_GOALS_KEY);
    localStorage.removeItem(DEMO_LEAVE_REQUESTS_KEY);
    localStorage.removeItem(DEMO_TIME_ENTRIES_KEY);
    localStorage.removeItem(DEMO_REVIEWS_KEY);
    localStorage.removeItem(DEMO_SKILLS_KEY);
    localStorage.removeItem(DEMO_EMPLOYEES_KEY);
    return true;
  } catch (err) {
    console.error('Failed to reset demo data:', err);
    return false;
  }
};

/**
 * Reset demo time entries stored in localStorage
 */
export const resetDemoTimeEntries = () => {
  try {
    localStorage.removeItem(DEMO_TIME_ENTRIES_KEY);
    return true;
  } catch (err) {
    console.error('Failed to reset demo time entries:', err);
    return false;
  }
};

/**
 * Reset demo goals stored in localStorage
 */
export const resetDemoGoals = () => {
  try {
    localStorage.removeItem(DEMO_GOALS_KEY);
    return true;
  } catch (err) {
    console.error('Failed to reset demo goals:', err);
    return false;
  }
};

/**
 * Reset demo reviews stored in localStorage
 */
export const resetDemoReviews = () => {
  try {
    localStorage.removeItem(DEMO_REVIEWS_KEY);
    return true;
  } catch (err) {
    console.error('Failed to reset demo reviews:', err);
    return false;
  }
};

/**
 * Reset demo skills stored in localStorage
 */
export const resetDemoSkills = () => {
  try {
    localStorage.removeItem(DEMO_SKILLS_KEY);
    return true;
  } catch (err) {
    console.error('Failed to reset demo skills:', err);
    return false;
  }
};

/**
 * Reset demo leave requests stored in localStorage
 */
export const resetDemoLeaveRequests = () => {
  try {
    localStorage.removeItem(DEMO_LEAVE_REQUESTS_KEY);
    return true;
  } catch (err) {
    console.error('Failed to reset demo leave requests:', err);
    return false;
  }
};

/**
 * Reset demo employees stored in localStorage
 */
export const resetDemoEmployees = () => {
  try {
    localStorage.removeItem(DEMO_EMPLOYEES_KEY);
    return true;
  } catch (err) {
    console.error('Failed to reset demo employees:', err);
    return false;
  }
};

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
  const storedTasks = stored ? JSON.parse(stored) : [];
  
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
  const storedTasks = stored ? JSON.parse(stored) : [];
  
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
  const storedGoals = stored ? JSON.parse(stored) : [];
  
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
  const storedGoals = stored ? JSON.parse(stored) : [];
  
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
  const storedRequests = stored ? JSON.parse(stored) : [];
  
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
