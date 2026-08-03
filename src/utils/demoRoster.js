/**
 * Demo-only staff roster.
 *
 * The demo used to ship six placeholder people ("Demo Admin", "Demo Engineer"),
 * which is too small for any of the screens to look like themselves: department
 * bars had one row each, the decision queue was empty, and the dashboard's
 * headcount tab strip had nothing to rank. This builds a mid-size Vietnamese
 * organisation on top of those six so every component has something to show.
 *
 * Everything here is derived from a seeded PRNG keyed on the employee index, so
 * the roster is identical on every load and across reloads -- a demo that
 * reshuffles itself is impossible to talk anyone through.
 *
 * NOT used outside demo mode. Nothing in this file reaches Supabase.
 */

/** mulberry32 — small, fast, and stable across engines. */
const seeded = (seed) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const HO = ['Nguyễn', 'Trần', 'Lê', 'Phạm', 'Hoàng', 'Huỳnh', 'Phan', 'Vũ', 'Võ', 'Đặng',
  'Bùi', 'Đỗ', 'Hồ', 'Ngô', 'Dương', 'Lý', 'Đinh', 'Trịnh', 'Mai', 'Cao'];

const DEM_NAM = ['Văn', 'Minh', 'Hữu', 'Quang', 'Đức', 'Thành', 'Anh', 'Bá', 'Xuân', 'Tuấn'];
const DEM_NU = ['Thị', 'Thu', 'Ngọc', 'Thanh', 'Kim', 'Hồng', 'Mỹ', 'Phương', 'Diệu', 'Lan'];

const TEN_NAM = ['Đức', 'Khánh', 'Hùng', 'Sơn', 'Nam', 'Long', 'Dũng', 'Hải', 'Phong', 'Tùng',
  'Bảo', 'Trung', 'Kiên', 'Vinh', 'Thắng', 'Hiếu', 'Quân', 'Đạt', 'Duy', 'Lâm'];
const TEN_NU = ['Hương', 'Linh', 'Trang', 'Ngân', 'Nhung', 'Yến', 'Hà', 'Thảo', 'Vân', 'Chi',
  'My', 'Quỳnh', 'Ánh', 'Nga', 'Tâm', 'Hạnh', 'Loan', 'Xuân', 'Diễm', 'Uyên'];

/**
 * Headcount per department, ordered so the dashboard's three department tabs
 * come out as Engineering / Sales / Office Unit, matching the design.
 * Keys must exist in translations `departments.*`.
 */
const DEPARTMENT_PLAN = [
  { key: 'engineering', count: 20, positions: ['senior_developer', 'employee', 'employee', 'support_staff'] },
  { key: 'sales', count: 14, positions: ['employee', 'employee', 'support_staff'] },
  { key: 'office_unit', count: 11, positions: ['employee', 'support_staff'] },
  { key: 'technology', count: 7, positions: ['senior_developer', 'employee'] },
  { key: 'finance', count: 6, positions: ['accountant', 'employee'] },
  { key: 'human_resources', count: 4, positions: ['hr_specialist', 'employee'] },
  { key: 'marketing', count: 4, positions: ['employee'] },
  { key: 'design', count: 3, positions: ['employee'] },
  { key: 'legal_compliance', count: 2, positions: ['contract_manager', 'employee'] },
  { key: 'board_of_directors', count: 1, positions: ['managing_director'] },
];

const LOCATIONS = [
  { location: 'Headquarters', locationKey: 'locations.headquarters' },
  { location: 'Headquarters', locationKey: 'locations.headquarters' },
  { location: 'Remote', locationKey: 'locations.remote' },
];

/** Base salary band per department, in VND-thousands-style round numbers. */
const SALARY_BAND = {
  board_of_directors: [180000, 220000],
  engineering: [70000, 130000],
  technology: [68000, 120000],
  legal_compliance: [70000, 105000],
  finance: [60000, 100000],
  human_resources: [55000, 90000],
  design: [55000, 88000],
  marketing: [52000, 85000],
  sales: [50000, 95000],
  office_unit: [42000, 70000],
};

/** Vietnamese → ASCII, for email local parts. */
const toAscii = (value) =>
  String(value)
    .normalize('NFD')
    .replace(/\p{Diacritic}+/gu, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');

const pick = (rng, list) => list[Math.floor(rng() * list.length)];
const between = (rng, min, max) => min + Math.floor(rng() * (max - min + 1));
/**
 * 'YYYY-MM-DD' in local time. toISOString() would convert to UTC first and
 * shift every date back a day for anyone east of Greenwich.
 */
const iso = (date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

/**
 * ~7% of the roster is marked inactive so the dashboard's Attrition cell has a
 * non-zero figure and the directory has former staff to filter out.
 */
const INACTIVE_EVERY = 13;

/**
 * @param {object} options
 * @param {(seed: string) => string} options.avatarFor  photo URL builder
 * @returns {Array<object>} employees shaped like MOCK_EMPLOYEES
 */
export const buildDemoRoster = ({ avatarFor }) => {
  const roster = [];
  const usedNames = new Set();
  const today = new Date();
  let index = 0;

  for (const dept of DEPARTMENT_PLAN) {
    for (let i = 0; i < dept.count; i += 1) {
      index += 1;
      const rng = seeded(index * 2654435761);

      const female = rng() < 0.48;
      const ho = pick(rng, HO);
      const dem = pick(rng, female ? DEM_NU : DEM_NAM);

      // Walk the given-name pool until the full name is unique, rather than
      // re-rolling: with 78 people and 20 names per pool, collisions are common
      // and a retry loop is not guaranteed to terminate.
      const tenPool = female ? TEN_NU : TEN_NAM;
      let ten = pick(rng, tenPool);
      for (let step = 0; step < tenPool.length && usedNames.has(`${ho} ${dem} ${ten}`); step += 1) {
        ten = tenPool[(tenPool.indexOf(ten) + 1) % tenPool.length];
      }
      const name = `${ho} ${dem} ${ten}`;
      usedNames.add(name);

      const id = `demo-emp-r${index}`;
      const [minSalary, maxSalary] = SALARY_BAND[dept.key] ?? [45000, 80000];
      const inactive = index % INACTIVE_EVERY === 0;

      const hire = new Date(today);
      hire.setDate(hire.getDate() - between(rng, 40, 2600));
      const born = new Date(today);
      born.setFullYear(born.getFullYear() - between(rng, 23, 55));
      born.setDate(born.getDate() - between(rng, 0, 364));

      const place = LOCATIONS[index % LOCATIONS.length];

      roster.push({
        id,
        name,
        email: `${toAscii(ten)}.${toAscii(ho)}${index}@icue.vn`,
        department: dept.key,
        position: dept.positions[i % dept.positions.length],
        location: place.location,
        locationKey: place.locationKey,
        status: inactive ? 'Inactive' : 'active',
        photo: avatarFor(id),
        phone: `555-${String(1000 + index).slice(-4)}`,
        hire_date: iso(hire),
        dob: iso(born),
        salary: Math.round(between(rng, minSalary, maxSalary) / 500) * 500,
        employment_status: inactive ? 'terminated' : 'active',
        ...(inactive ? { is_active: false } : {}),
        // Held to one decimal and to a believable band; the dashboard averages
        // these and a uniform 0-5 spread makes every department look identical.
        performance: Math.round((3.1 + rng() * 1.8) * 10) / 10,
      });
    }
  }

  return roster;
};

/* ------------------------------------------------------------------ *
 * Derived records
 * ------------------------------------------------------------------ */

/** `Q3-2026` — the format personalGoals.jsx parses. Note the hyphen. */
const formatPeriod = (quarter, year) => `Q${quarter}-${year}`;

/** The `n` quarters ending at the one containing `date`, oldest first. */
export const recentQuarters = (date, n) => {
  let quarter = Math.floor(date.getMonth() / 3) + 1;
  let year = date.getFullYear();
  const out = [];
  for (let i = 0; i < n; i += 1) {
    out.unshift({ quarter, year, key: formatPeriod(quarter, year) });
    quarter -= 1;
    if (quarter === 0) { quarter = 4; year -= 1; }
  }
  return out;
};

const STRENGTHS = [
  'Bàn giao đúng hạn, chất lượng ổn định.',
  'Chủ động hỗ trợ đồng nghiệp trong nhóm.',
  'Giao tiếp rõ ràng với khách hàng.',
  'Xử lý sự cố nhanh và bình tĩnh.',
];
const IMPROVEMENTS = [
  'Cần ghi chép tài liệu đầy đủ hơn.',
  'Nên chủ động cập nhật tiến độ sớm hơn.',
  'Cân đối khối lượng công việc tốt hơn.',
  'Tăng cường kỹ năng trình bày trước nhóm.',
];

/**
 * A review per employee per quarter, so the rating-history line on the personal
 * goals screen has points to plot for anyone the demo user opens.
 *
 * Ratings walk from a per-employee baseline rather than being drawn fresh each
 * quarter — an unrelated number every quarter reads as noise, not a career.
 */
export const buildRosterReviews = (roster, { quarters = 5, reviewerId = 'demo-emp-1' } = {}) => {
  const periods = recentQuarters(new Date(), quarters);
  const reviews = [];

  roster.forEach((emp, empIndex) => {
    const rng = seeded((empIndex + 1) * 97);
    let running = Number(emp.performance) || 3.8;

    periods.forEach((period, periodIndex) => {
      // Leave the newest quarter open for roughly a third of the roster so the
      // "review not filed yet" state is reachable in the demo.
      if (periodIndex === periods.length - 1 && empIndex % 3 === 0) return;

      running = Math.min(5, Math.max(2.4, running + (rng() - 0.45) * 0.5));
      const overall = Math.round(running * 10) / 10;
      const jitter = () => Math.min(5, Math.max(1, Math.round((overall + (rng() - 0.5)) * 2) / 2));

      reviews.push({
        id: `review-${emp.id}-${period.key}`,
        employee_id: emp.id,
        reviewer_id: reviewerId,
        review_period: period.key,
        review_type: 'quarterly',
        overall_rating: overall,
        technical_skills_rating: jitter(),
        communication_rating: jitter(),
        leadership_rating: jitter(),
        teamwork_rating: jitter(),
        problem_solving_rating: jitter(),
        strengths: STRENGTHS[(empIndex + periodIndex) % STRENGTHS.length],
        areas_for_improvement: IMPROVEMENTS[(empIndex + periodIndex) % IMPROVEMENTS.length],
        achievements: '',
        comments: '',
        status: periodIndex === periods.length - 1 ? 'submitted' : 'approved',
        review_date: `${period.year}-${String(period.quarter * 3).padStart(2, '0')}-15`,
        employee: emp,
      });
    });
  });

  return reviews;
};

const GOAL_TITLES = [
  'Hoàn thành khóa đào tạo nội bộ',
  'Giảm thời gian xử lý hồ sơ',
  'Chuẩn hóa quy trình bàn giao',
  'Đạt chỉ tiêu doanh số quý',
  'Cải thiện điểm hài lòng khách hàng',
  'Hoàn thiện tài liệu kỹ thuật',
];

/** Two goals each, one open and one settled, so both list states are populated. */
export const buildRosterGoals = (roster) => {
  const goals = [];
  const today = new Date();

  roster.forEach((emp, empIndex) => {
    const rng = seeded((empIndex + 1) * 7919);

    for (let g = 0; g < 2; g += 1) {
      const done = g === 1 && rng() < 0.55;
      const progress = done ? 100 : between(rng, 10, 90);
      const target = new Date(today);
      target.setDate(target.getDate() + between(rng, -40, 160));

      goals.push({
        id: `goal-${emp.id}-${g + 1}`,
        title: GOAL_TITLES[(empIndex + g) % GOAL_TITLES.length],
        description: '',
        status: done ? 'completed' : progress > 0 ? 'in_progress' : 'pending',
        progress,
        progress_percentage: progress,
        category: g === 0 ? 'Professional' : 'Skills',
        employee_id: emp.id,
        target_date: iso(target),
        employee: emp,
      });
    }
  });

  return goals;
};

/** The five skills the performance screens assess, per employee. */
const SKILL_SET = [
  ['Technical Skills', 'technical'],
  ['Communication', 'communication'],
  ['Leadership', 'leadership'],
  ['Teamwork', 'teamwork'],
  ['Problem Solving', 'problem_solving'],
];

export const buildRosterSkills = (roster, { assessedBy = 'demo-emp-1' } = {}) => {
  const skills = [];
  const assessedOn = iso(new Date());

  roster.forEach((emp, empIndex) => {
    const rng = seeded((empIndex + 1) * 104729);
    const base = Number(emp.performance) || 3.8;

    SKILL_SET.forEach(([skillName, category], skillIndex) => {
      const rating = Math.min(5, Math.max(1, Math.round((base + (rng() - 0.5) * 1.2) * 2) / 2));
      skills.push({
        id: `skill-${emp.id}-${skillIndex + 1}`,
        employee_id: emp.id,
        skill_name: skillName,
        skill_category: category,
        rating,
        proficiency_level: rating >= 4 ? 'Advanced' : rating >= 3 ? 'Intermediate' : 'Beginner',
        years_experience: between(rng, 1, 9),
        assessed_by: assessedBy,
        assessment_date: assessedOn,
        employee: emp,
      });
    });
  });

  return skills;
};

/* ------------------------------------------------------------------ *
 * Recruitment
 * ------------------------------------------------------------------ */

const OPENINGS = [
  ['Kỹ sư phần mềm', 'engineering', 'senior_developer', 'Headquarters', '30tr - 45tr'],
  ['Lập trình viên Backend', 'engineering', 'employee', 'Remote', '25tr - 38tr'],
  ['Nhân viên kinh doanh', 'sales', 'employee', 'Headquarters', '15tr - 28tr'],
  ['Trưởng nhóm kinh doanh', 'sales', 'support_staff', 'Headquarters', '28tr - 40tr'],
  ['Chuyên viên hành chính', 'office_unit', 'employee', 'Headquarters', '12tr - 18tr'],
  ['Kế toán tổng hợp', 'finance', 'accountant', 'Headquarters', '18tr - 26tr'],
  ['Chuyên viên nhân sự', 'human_resources', 'hr_specialist', 'Headquarters', '16tr - 24tr'],
  ['Nhân viên marketing', 'marketing', 'employee', 'Remote', '14tr - 22tr'],
];

/** Two real PDFs ship with the demo; generated applicants reuse them. */
const DEMO_CVS = ['/demoCVs/john_doe_resume.pdf', '/demoCVs/jane_smith_resume.pdf'];

const EDUCATION = ['Cử nhân Công nghệ thông tin', 'Cử nhân Kinh tế', 'Thạc sĩ Quản trị kinh doanh',
  'Cử nhân Kế toán', 'Cử nhân Marketing'];

export const buildRosterJobPostings = () => {
  const today = new Date();
  return OPENINGS.map(([title, department, position, location, salary], i) => {
    const posted = new Date(today);
    posted.setDate(posted.getDate() - (i * 9 + 4));
    return {
      id: `job-r${i + 1}`,
      title,
      department,
      position,
      // The last two read as filled so the board is not uniformly open.
      status: i < OPENINGS.length - 2 ? 'active' : 'closed',
      posted_date: iso(posted),
      description: '',
      requirements: [],
      location,
      locationKey: location === 'Remote' ? 'locations.remote' : 'locations.headquarters',
      salary_range: salary,
    };
  });
};

const APPLICATION_STATUSES = ['under review', 'screening', 'interview scheduled', 'offer extended', 'rejected', 'hired'];

/**
 * Applicants and their applications, built together so every application has a
 * real applicant behind it. Roughly four candidates per opening.
 */
export const buildRosterRecruitment = (jobPostings) => {
  const applicants = [];
  const applications = [];
  const interviews = [];
  const today = new Date();
  let n = 0;

  jobPostings.forEach((job, jobIndex) => {
    const perJob = 3 + (jobIndex % 3);

    for (let i = 0; i < perJob; i += 1) {
      n += 1;
      const rng = seeded(n * 22695477);
      const female = rng() < 0.5;
      const ho = pick(rng, HO);
      const dem = pick(rng, female ? DEM_NU : DEM_NAM);
      const ten = pick(rng, female ? TEN_NU : TEN_NAM);

      const applied = new Date(today);
      applied.setDate(applied.getDate() - between(rng, 2, 60));

      const applicantId = `app-r${n}`;
      applicants.push({
        id: applicantId,
        // Vietnamese name order is family-middle-given, and the UI renders
        // these as `first_name last_name`. Splitting after the middle name is
        // what makes "Đặng Lan Hương" come out in the right order; putting the
        // given name in first_name would render it as "Hương Đặng Lan".
        first_name: `${ho} ${dem}`,
        last_name: ten,
        email: `${toAscii(ten)}.${toAscii(ho)}${n}@gmail.com`,
        phone: `090${String(1000000 + n * 7919).slice(-7)}`,
        resume_url: DEMO_CVS[n % DEMO_CVS.length],
        linkedin_profile: '',
        education_level: EDUCATION[n % EDUCATION.length],
        current_position: job.title,
        years_experience: between(rng, 1, 12),
        created_at: iso(applied),
      });

      const status = job.status === 'closed' && i === 0
        ? 'hired'
        : APPLICATION_STATUSES[Math.floor(rng() * APPLICATION_STATUSES.length)];

      const applicationId = `appl-r${n}`;
      applications.push({
        id: applicationId,
        job_posting_id: job.id,
        applicant_id: applicantId,
        status,
        application_date: iso(applied),
        rating: between(rng, 2, 5),
        notes: '',
        job_posting: job,
        applicant: applicants[applicants.length - 1],
      });

      if (status === 'interview scheduled') {
        const when = new Date(today);
        when.setDate(when.getDate() + between(rng, 1, 12));
        interviews.push({
          id: `int-r${n}`,
          application_id: applicationId,
          scheduled_date: when.toISOString(),
          interviewer_id: 'demo-emp-1',
          status: 'scheduled',
          type: rng() < 0.5 ? 'Technical' : 'HR',
          notes: '',
          application: applications[applications.length - 1],
        });
      }
    }
  });

  return { applicants, applications, interviews };
};

const LEAVE_TYPES = ['annual', 'sick', 'personal', 'unpaid'];
const LEAVE_REASONS = [
  'Nghỉ phép năm.',
  'Khám sức khỏe định kỳ.',
  'Việc gia đình.',
  'Về quê.',
];

/**
 * Leave requests, roughly a third of them still pending.
 *
 * getDemoLeaveRequests() previously started from an empty array, so the leave
 * screen and the approvals it feeds were blank until the demo user filed
 * something by hand.
 */
export const buildRosterLeaveRequests = (roster) => {
  const requests = [];
  const today = new Date();
  let sequence = 0;

  roster.forEach((emp, empIndex) => {
    const rng = seeded((empIndex + 1) * 15485863);
    if (rng() > 0.42) return; // not everyone has leave on file

    sequence += 1;
    const days = between(rng, 1, 5);
    const start = new Date(today);
    start.setDate(start.getDate() + between(rng, -45, 45));
    const end = new Date(start);
    end.setDate(end.getDate() + days - 1);

    const roll = rng();
    const status = roll < 0.34 ? 'pending' : roll < 0.85 ? 'approved' : 'rejected';

    requests.push({
      id: `leave-${emp.id}`,
      employee_id: emp.id,
      employee_name: emp.name,
      leave_type: LEAVE_TYPES[sequence % LEAVE_TYPES.length],
      start_date: iso(start),
      end_date: iso(end),
      days_count: days,
      reason: LEAVE_REASONS[sequence % LEAVE_REASONS.length],
      status,
      submitted_at: new Date(start.getTime() - 86400000 * 7).toISOString(),
      approved_by: status === 'approved' ? 'demo-emp-1' : null,
      approved_at: status === 'approved' ? new Date(start.getTime() - 86400000 * 5).toISOString() : null,
      employee: emp,
    });
  });

  return requests;
};
