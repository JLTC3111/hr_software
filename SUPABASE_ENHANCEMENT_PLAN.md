# HR Software - Supabase Enhancement Plan

## Executive Summary
This document outlines a comprehensive plan to migrate all HR software functions to use proper Supabase database tables, replacing localStorage and mock data implementations with a robust, scalable database architecture.

---

## Current State Analysis

### ✅ Functions Already Using Supabase
| Function | Component | Tables Used | Status |
|----------|-----------|-------------|--------|
| **Time Clock Entry** | `timeClockEntry.jsx` | `time_entries` | ✅ Fully Implemented |
| **Time Tracking** | `timeTracking.jsx` | `time_entries`, `leave_requests`, `overtime_logs`, `time_tracking_summary` | ✅ Fully Implemented |
| **Dashboard Analytics** | `dashboard.jsx` | `time_tracking_summary`, pending approvals | ✅ Fully Implemented |
| **Employee Authentication** | `AuthContext.jsx` | `employees` (via auth) | ✅ Partially Implemented |

### ❌ Functions NOT Using Supabase (Need Migration)
| Function | Component | Current Storage | Priority |
|----------|-----------|-----------------|----------|
| **Employee Management** | `employee.jsx`, `addEmployeeModal.jsx` | localStorage | 🔴 HIGH |
| **Recruitment/Applications** | `recruitment.jsx` | Hardcoded mock data | 🔴 HIGH |
| **Performance Appraisal** | `performanceAppraisal.jsx` | Hardcoded mock data | 🟡 MEDIUM |
| **Reports & Analytics** | `reports.jsx` | Mock data calculations | 🟡 MEDIUM |
| **Employee Profiles** | `employeeModal.jsx` | localStorage/props | 🟢 LOW |

---

## Required Database Tables

### 1. 🟢 Existing Tables (Already Created)
✅ **employees** - Stores employee information
✅ **time_entries** - Daily time clock entries
✅ **leave_requests** - Leave/vacation requests
✅ **overtime_logs** - Overtime tracking
✅ **time_tracking_summary** - Monthly aggregated data

### 2. 🔴 New Tables Needed

#### A. Recruitment Module Tables

##### `job_postings`
```sql
- id (BIGSERIAL PRIMARY KEY)
- title (VARCHAR)
- department (VARCHAR)
- position_type (VARCHAR) - full-time, part-time, contract
- description (TEXT)
- requirements (TEXT)
- salary_range (VARCHAR)
- location (VARCHAR)
- posted_by (FK: employees.id)
- status (VARCHAR) - active, paused, closed
- posted_date (DATE)
- closing_date (DATE)
- created_at, updated_at
```

##### `job_applications`
```sql
- id (BIGSERIAL PRIMARY KEY)
- job_posting_id (FK: job_postings.id)
- candidate_name (VARCHAR)
- email (VARCHAR)
- phone (VARCHAR)
- resume_url (TEXT)
- cover_letter (TEXT)
- experience_years (INTEGER)
- status (VARCHAR) - applied, screening, interview_scheduled, technical, offer, hired, rejected
- stage (VARCHAR) - screening, phone_screen, technical, hr_round, final
- applied_date (DATE)
- interview_date (TIMESTAMP)
- notes (TEXT)
- rating (DECIMAL)
- created_at, updated_at
```

##### `interview_schedules`
```sql
- id (BIGSERIAL PRIMARY KEY)
- application_id (FK: job_applications.id)
- interviewer_id (FK: employees.id)
- interview_type (VARCHAR) - phone, technical, hr, panel
- scheduled_time (TIMESTAMP)
- duration_minutes (INTEGER)
- location (VARCHAR)
- notes (TEXT)
- status (VARCHAR) - scheduled, completed, cancelled
- feedback (TEXT)
- rating (DECIMAL)
- created_at, updated_at
```

#### B. Performance Management Tables

##### `performance_reviews`
```sql
- id (BIGSERIAL PRIMARY KEY)
- employee_id (FK: employees.id)
- reviewer_id (FK: employees.id)
- review_period (VARCHAR) - Q1-2024, Q2-2024, etc
- review_type (VARCHAR) - quarterly, annual, mid-year, probation
- overall_rating (DECIMAL)
- technical_skills_rating (DECIMAL)
- communication_rating (DECIMAL)
- leadership_rating (DECIMAL)
- teamwork_rating (DECIMAL)
- strengths (TEXT)
- areas_for_improvement (TEXT)
- comments (TEXT)
- status (VARCHAR) - draft, submitted, approved
- review_date (DATE)
- created_at, updated_at
```

##### `performance_goals`
```sql
- id (BIGSERIAL PRIMARY KEY)
- employee_id (FK: employees.id)
- title (VARCHAR)
- description (TEXT)
- category (VARCHAR) - technical, leadership, project, learning
- target_date (DATE)
- status (VARCHAR) - pending, in-progress, completed, cancelled
- progress_percentage (INTEGER)
- priority (VARCHAR) - low, medium, high
- assigned_by (FK: employees.id)
- assigned_date (DATE)
- completed_date (DATE)
- notes (TEXT)
- created_at, updated_at
```

##### `goal_milestones`
```sql
- id (BIGSERIAL PRIMARY KEY)
- goal_id (FK: performance_goals.id)
- title (VARCHAR)
- description (TEXT)
- due_date (DATE)
- status (VARCHAR) - pending, completed
- completed_date (DATE)
- notes (TEXT)
- created_at, updated_at
```

##### `skills_assessments`
```sql
- id (BIGSERIAL PRIMARY KEY)
- employee_id (FK: employees.id)
- skill_name (VARCHAR)
- skill_category (VARCHAR) - technical, soft, leadership
- rating (DECIMAL) - 1-5 scale
- assessed_by (FK: employees.id)
- assessment_date (DATE)
- notes (TEXT)
- created_at, updated_at
```

#### C. Department & Position Reference Tables

##### `departments`
```sql
- id (BIGSERIAL PRIMARY KEY)
- name (VARCHAR)
- code (VARCHAR UNIQUE)
- description (TEXT)
- manager_id (FK: employees.id)
- budget (DECIMAL)
- created_at, updated_at
```

##### `positions`
```sql
- id (BIGSERIAL PRIMARY KEY)
- title (VARCHAR)
- code (VARCHAR UNIQUE)
- department_id (FK: departments.id)
- level (VARCHAR) - entry, junior, mid, senior, lead, manager, director
- description (TEXT)
- requirements (TEXT)
- salary_min (DECIMAL)
- salary_max (DECIMAL)
- created_at, updated_at
```

#### D. Additional Support Tables

##### `employee_documents`
```sql
- id (BIGSERIAL PRIMARY KEY)
- employee_id (FK: employees.id)
- document_type (VARCHAR) - contract, id, certificate, review
- title (VARCHAR)
- file_url (TEXT)
- file_name (VARCHAR)
- file_type (VARCHAR)
- uploaded_by (FK: employees.id)
- uploaded_at (TIMESTAMP)
- notes (TEXT)
- created_at, updated_at
```

##### `audit_logs`
```sql
- id (BIGSERIAL PRIMARY KEY)
- user_id (FK: employees.id)
- action (VARCHAR) - create, update, delete, view
- table_name (VARCHAR)
- record_id (BIGINT)
- changes (JSONB)
- ip_address (VARCHAR)
- timestamp (TIMESTAMP)
```

---

## Implementation Roadmap

### Phase 1: Foundation (Week 1) 🔴 HIGH PRIORITY

#### Step 1.1: Employee Management Migration
**Goal:** Replace localStorage with Supabase for employee CRUD operations

**Tasks:**
1. ✅ Update `employees` table schema (already exists)
2. Create `employeeService.js` with CRUD operations:
   - `createEmployee()`
   - `updateEmployee()`
   - `deleteEmployee()`
   - `getAllEmployees()`
   - `getEmployeeById()`
   - `searchEmployees()`
3. Update `addEmployeeModal.jsx` to use service
4. Update `employee.jsx` to fetch from Supabase
5. Update `employeeCard.jsx` for photo uploads to Supabase Storage
6. Remove all localStorage dependencies

**Estimated Time:** 2-3 days

#### Step 1.2: Recruitment Module Implementation
**Goal:** Replace mock data with full recruitment functionality

**Tasks:**
1. Create migration: `005_recruitment_tables.sql`
2. Create `recruitmentService.js` with:
   - Job posting CRUD
   - Application management
   - Interview scheduling
   - Status updates
3. Update `recruitment.jsx` component
4. Create application detail view
5. Add interview management UI

**Estimated Time:** 3-4 days

### Phase 2: Performance Management (Week 2) 🟡 MEDIUM PRIORITY

#### Step 2.1: Performance Reviews Implementation
**Tasks:**
1. Create migration: `006_performance_tables.sql`
2. Create `performanceService.js`
3. Update `performanceAppraisal.jsx`
4. Add goal management UI
5. Add skills assessment UI

**Estimated Time:** 4-5 days

#### Step 2.2: Reports Enhancement
**Tasks:**
1. Update `reports.jsx` to pull real data
2. Add aggregation queries
3. Implement export functionality
4. Add custom report builder

**Estimated Time:** 2-3 days

### Phase 3: Polish & Optimization (Week 3) 🟢 LOW PRIORITY

#### Step 3.1: Reference Tables
**Tasks:**
1. Create migration: `007_reference_tables.sql`
2. Normalize departments and positions
3. Update all components to use references

**Estimated Time:** 2 days

#### Step 3.2: Additional Features
**Tasks:**
1. Document management system
2. Audit logging
3. Advanced search and filtering
4. Bulk operations

**Estimated Time:** 3-4 days

---

## Service Layer Architecture

### Proposed Service Files Structure

```
src/
├── services/
│   ├── timeTrackingService.js      ✅ EXISTS
│   ├── employeeService.js          ⚠️ TO CREATE
│   ├── recruitmentService.js       ⚠️ TO CREATE
│   ├── performanceService.js       ⚠️ TO CREATE
│   ├── departmentService.js        ⚠️ TO CREATE
│   ├── reportsService.js           ⚠️ TO CREATE
│   └── documentService.js          ⚠️ TO CREATE
```

### Service Layer Best Practices

Each service should follow this pattern:

```javascript
// Example: employeeService.js
import { supabase } from '../config/supabaseClient';

// CREATE
export const createEmployee = async (employeeData) => {
  try {
    const { data, error } = await supabase
      .from('employees')
      .insert([employeeData])
      .select()
      .single();
    
    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    console.error('Error creating employee:', error);
    return { success: false, error: error.message };
  }
};

// READ
export const getAllEmployees = async (filters = {}) => { ... };
export const getEmployeeById = async (id) => { ... };

// UPDATE
export const updateEmployee = async (id, updates) => { ... };

// DELETE
export const deleteEmployee = async (id) => { ... };

// SEARCH
export const searchEmployees = async (searchTerm) => { ... };
```

---

## Migration Strategy

### Data Migration Steps

1. **Backup Current Data**
   - Export localStorage data
   - Export any existing Supabase data
   - Create backup timestamps

2. **Run Migrations**
   - Execute SQL migrations in order
   - Verify table creation
   - Check indexes and constraints

3. **Seed Initial Data**
   - Import existing employee data
   - Create initial departments/positions
   - Seed sample data for testing

4. **Update Components**
   - Replace localStorage calls
   - Update state management
   - Add loading states
   - Add error handling

5. **Testing**
   - Test each CRUD operation
   - Verify data integrity
   - Check permissions (RLS)
   - Performance testing

---

## Database Views & Functions

### Useful Views to Create

```sql
-- Employee summary view
CREATE VIEW employee_summary AS
SELECT 
  e.*,
  d.name as department_name,
  p.title as position_title,
  COUNT(DISTINCT te.date) as days_worked_this_month,
  AVG(pr.overall_rating) as avg_performance_rating
FROM employees e
LEFT JOIN departments d ON e.department_id = d.id
LEFT JOIN positions p ON e.position_id = p.id
LEFT JOIN time_entries te ON e.id = te.employee_id 
  AND DATE_TRUNC('month', te.date) = DATE_TRUNC('month', CURRENT_DATE)
LEFT JOIN performance_reviews pr ON e.id = pr.employee_id
GROUP BY e.id, d.name, p.title;

-- Recruitment pipeline view
CREATE VIEW recruitment_pipeline AS
SELECT 
  jp.title as job_title,
  COUNT(*) as total_applications,
  COUNT(*) FILTER (WHERE ja.status = 'screening') as screening,
  COUNT(*) FILTER (WHERE ja.status = 'interview_scheduled') as interviews,
  COUNT(*) FILTER (WHERE ja.status = 'offer') as offers,
  COUNT(*) FILTER (WHERE ja.status = 'hired') as hired
FROM job_applications ja
JOIN job_postings jp ON ja.job_posting_id = jp.id
GROUP BY jp.id, jp.title;
```

---

## Security & Permissions

### Row Level Security (RLS) Policies

Each table should have appropriate RLS policies:

1. **Employees can view their own data**
2. **HR/Managers can view all employees**
3. **Only HR can create/update employees**
4. **Employees can submit applications/reviews**
5. **Only managers can approve/reject**

Example policy structure already exists in existing migrations.

---

## Performance Optimization

### Indexing Strategy

```sql
-- Employee lookups
CREATE INDEX idx_employees_department ON employees(department_id);
CREATE INDEX idx_employees_status ON employees(status);

-- Application searches
CREATE INDEX idx_applications_status ON job_applications(status);
CREATE INDEX idx_applications_job ON job_applications(job_posting_id);

-- Performance reviews
CREATE INDEX idx_reviews_employee ON performance_reviews(employee_id);
CREATE INDEX idx_reviews_period ON performance_reviews(review_period);

-- Full text search
CREATE INDEX idx_employees_search ON employees USING GIN(to_tsvector('english', name || ' ' || email));
```

---

## Testing Plan

### Test Cases by Module

#### Employee Management
- [ ] Create new employee
- [ ] Update employee info
- [ ] Upload employee photo
- [ ] Search employees
- [ ] Filter by department/status
- [ ] Delete employee

#### Recruitment
- [ ] Post new job
- [ ] Submit application
- [ ] Schedule interview
- [ ] Update application status
- [ ] Bulk status updates
- [ ] Search candidates

#### Performance
- [ ] Create review
- [ ] Set goals
- [ ] Update goal progress
- [ ] Assess skills
- [ ] View performance history

---

## Success Metrics

### Key Performance Indicators (KPIs)

1. **Data Integrity**
   - 0% data loss during migration
   - All CRUD operations working
   - No orphaned records

2. **Performance**
   - Page load time < 2 seconds
   - API response time < 500ms
   - Smooth pagination (no lag)

3. **User Experience**
   - All features working as before
   - Improved data reliability
   - Real-time updates

---

## Next Steps

### Immediate Actions (This Week)

1. ✅ Review and approve this enhancement plan
2. ⏳ Create migration file for recruitment tables
3. ⏳ Create migration file for performance tables
4. ⏳ Implement employeeService.js
5. ⏳ Implement recruitmentService.js
6. ⏳ Update employee.jsx to use Supabase

### Future Enhancements (Post-Implementation)

1. Advanced reporting dashboard
2. Mobile app support
3. Email notifications
4. Calendar integration
5. Automated workflows
6. AI-powered resume screening
7. Performance prediction analytics

---

## Resources & Documentation

### Reference Links
- Supabase Docs: https://supabase.com/docs
- Current Migration Files: `/supabase/migrations/`
- Service Layer Example: `/src/services/timeTrackingService.js`

### Team Contacts
- Database Admin: [To be assigned]
- Frontend Developer: [To be assigned]
- Backend Developer: [To be assigned]

---

## Appendix

### A. SQL Migration Naming Convention
```
[number]_[descriptive_name].sql

Examples:
- 001_time_tracking_tables.sql       ✅ EXISTS
- 005_recruitment_tables.sql         ⏳ TO CREATE
- 006_performance_tables.sql         ⏳ TO CREATE
- 007_reference_tables.sql           ⏳ TO CREATE
```

### B. Component Update Checklist

For each component being migrated:
- [ ] Remove localStorage dependencies
- [ ] Add loading states
- [ ] Add error handling
- [ ] Update state management
- [ ] Add optimistic updates
- [ ] Implement real-time subscriptions (if needed)
- [ ] Update tests

---

## Summary

This enhancement plan provides a complete roadmap for migrating the HR software to a fully Supabase-backed application. By following this phased approach, we can ensure:

1. **Minimal disruption** to existing functionality
2. **Data integrity** throughout migration
3. **Scalable architecture** for future growth
4. **Improved performance** and reliability
5. **Better user experience** with real-time data

**Total Estimated Timeline:** 3-4 weeks
**Priority Level:** HIGH
**Risk Level:** MEDIUM (with proper testing)

---

*Document Version: 1.0*  
*Last Updated: October 20, 2025*  
*Status: READY FOR IMPLEMENTATION*
