# HR Software - System Architecture Overview

## Current System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     FRONTEND (React)                         │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ✅ Time Clock Entry  →  Supabase (time_entries)           │
│  ✅ Time Tracking     →  Supabase (multiple tables)        │
│  ✅ Dashboard         →  Supabase (aggregated data)        │
│                                                              │
│  ❌ Employee Mgmt     →  localStorage                       │
│  ❌ Recruitment       →  Mock Data (hardcoded)             │
│  ❌ Performance       →  Mock Data (hardcoded)             │
│  ❌ Reports           →  Mock Data (calculated)            │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## Function-to-Table Mapping

### ✅ IMPLEMENTED (Using Supabase)

| Component | Function | Tables Used | Service File |
|-----------|----------|-------------|--------------|
| `timeClockEntry.jsx` | Time entry recording | `time_entries` | `timeTrackingService.js` |
| `timeTracking.jsx` | View time logs, leave, overtime | `time_entries`, `leave_requests`, `overtime_logs`, `time_tracking_summary` | `timeTrackingService.js` |
| `dashboard.jsx` | Analytics dashboard | `time_tracking_summary`, all tables for counts | `timeTrackingService.js` |
| `AuthContext.jsx` | User authentication | `employees` (auth link) | Built-in auth |

### ❌ TO BE IMPLEMENTED

| Component | Function | Needs Tables | New Service File |
|-----------|----------|--------------|------------------|
| `employee.jsx` | List/search employees | `employees`, `departments`, `positions` | `employeeService.js` |
| `addEmployeeModal.jsx` | Add new employee | `employees` | `employeeService.js` |
| `employeeCard.jsx` | Employee card display | `employees`, `employee_documents` | `employeeService.js` |
| `recruitment.jsx` | Job postings & applications | `job_postings`, `job_applications`, `interview_schedules` | `recruitmentService.js` |
| `performanceAppraisal.jsx` | Reviews & goals | `performance_reviews`, `performance_goals`, `skills_assessments` | `performanceService.js` |
| `reports.jsx` | HR reports & analytics | All tables (aggregation) | `reportsService.js` |

---

## Database Schema Overview

### 📊 Tables by Module

```
┌──────────────────────────────────────────────────────────────┐
│                    HR DATABASE SCHEMA                         │
└──────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ CORE MODULE ✅ (Already Implemented)                        │
├─────────────────────────────────────────────────────────────┤
│ • employees                    [Employee master data]        │
│ • time_entries                 [Daily time records]          │
│ • leave_requests              [Leave applications]           │
│ • overtime_logs               [Overtime tracking]            │
│ • time_tracking_summary       [Monthly aggregates]           │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ RECRUITMENT MODULE ❌ (To Be Created)                       │
├─────────────────────────────────────────────────────────────┤
│ • job_postings                [Open positions]               │
│ • job_applications            [Candidate applications]       │
│ • interview_schedules         [Interview management]         │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ PERFORMANCE MODULE ❌ (To Be Created)                       │
├─────────────────────────────────────────────────────────────┤
│ • performance_reviews         [Employee reviews]             │
│ • performance_goals           [Goal setting & tracking]      │
│ • goal_milestones            [Goal sub-tasks]                │
│ • skills_assessments         [Skills evaluation]             │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ REFERENCE DATA ❌ (To Be Created)                           │
├─────────────────────────────────────────────────────────────┤
│ • departments                 [Department master]            │
│ • positions                   [Position/role master]         │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ SUPPORTING MODULES ❌ (Future Enhancement)                  │
├─────────────────────────────────────────────────────────────┤
│ • employee_documents          [Document management]          │
│ • audit_logs                  [System audit trail]           │
└─────────────────────────────────────────────────────────────┘
```

---

## Data Flow Diagrams

### Current Time Tracking Flow ✅
```
User Input (timeClockEntry.jsx)
    ↓
timeTrackingService.createTimeEntry()
    ↓
Supabase: INSERT into time_entries
    ↓
Trigger: update_time_tracking_summary
    ↓
Supabase: UPDATE time_tracking_summary
    ↓
Dashboard refreshes with real data
```

### Proposed Employee Management Flow ❌→✅
```
BEFORE (Current):
User Input (addEmployeeModal.jsx)
    ↓
localStorage.setItem('employees', JSON.stringify(data))
    ↓
employee.jsx reads from localStorage
    ↓
Data lost on browser clear ❌

AFTER (Proposed):
User Input (addEmployeeModal.jsx)
    ↓
employeeService.createEmployee()
    ↓
Supabase: INSERT into employees
    ↓
Supabase Storage: Upload photo
    ↓
Real-time update to all clients ✅
```

### Proposed Recruitment Flow ❌→✅
```
BEFORE (Current):
recruitment.jsx displays hardcoded Applications array ❌

AFTER (Proposed):
Job Posting Created
    ↓
Supabase: INSERT into job_postings
    ↓
Candidate Applies (external form or portal)
    ↓
Supabase: INSERT into job_applications
    ↓
HR reviews in recruitment.jsx
    ↓
recruitmentService.updateApplicationStatus()
    ↓
Interview scheduled
    ↓
Supabase: INSERT into interview_schedules
    ↓
Email notifications sent ✅
```

---

## Table Relationships

```
employees (1) ──────┬───── (∞) time_entries
                    │
                    ├───── (∞) leave_requests
                    │
                    ├───── (∞) overtime_logs
                    │
                    ├───── (∞) time_tracking_summary
                    │
                    ├───── (∞) performance_reviews (as employee)
                    │
                    ├───── (∞) performance_reviews (as reviewer)
                    │
                    ├───── (∞) performance_goals
                    │
                    ├───── (∞) skills_assessments
                    │
                    ├───── (∞) job_applications (as interviewer)
                    │
                    └───── (1) departments
                           └───── (1) positions


job_postings (1) ──── (∞) job_applications
                              └───── (∞) interview_schedules


performance_goals (1) ──── (∞) goal_milestones
```

---

## API Service Layer Structure

```
src/services/
│
├── timeTrackingService.js     ✅ COMPLETE
│   ├── Time Entries CRUD
│   ├── Leave Requests CRUD
│   ├── Overtime Logs CRUD
│   ├── Summary calculations
│   └── File upload (proof)
│
├── employeeService.js          ⏳ TO CREATE
│   ├── Employee CRUD
│   ├── Search & filter
│   ├── Photo upload
│   └── Document management
│
├── recruitmentService.js       ⏳ TO CREATE
│   ├── Job Posting CRUD
│   ├── Application management
│   ├── Interview scheduling
│   ├── Status workflows
│   └── Candidate search
│
├── performanceService.js       ⏳ TO CREATE
│   ├── Review CRUD
│   ├── Goal management
│   ├── Skills assessment
│   └── Performance analytics
│
├── departmentService.js        ⏳ TO CREATE
│   ├── Department CRUD
│   └── Position CRUD
│
└── reportsService.js          ⏳ TO CREATE
    ├── Aggregation queries
    ├── Export functionality
    └── Custom report builder
```

---

## Migration Priority Matrix

```
┌─────────────────────────────────────────────────────────────┐
│              URGENCY vs COMPLEXITY MATRIX                    │
└─────────────────────────────────────────────────────────────┘

High Urgency │
            │  [Employee Mgmt]  │  [Recruitment]
            │  🔴 Week 1        │  🔴 Week 1-2
            │                   │
Medium      │  [Performance]    │  [Reports]
Urgency     │  🟡 Week 2        │  🟡 Week 2-3
            │                   │
Low         │  [Ref Tables]     │  [Audit/Docs]
Urgency     │  🟢 Week 3        │  🟢 Week 3-4
            │                   │
            └───────────────────┴──────────────────
                Low               High
               Complexity       Complexity
```

---

## System Requirements

### Current Stack
- **Frontend:** React 18+ with Vite
- **Database:** Supabase (PostgreSQL)
- **Storage:** Supabase Storage
- **Auth:** Supabase Auth
- **UI:** TailwindCSS, Lucide Icons
- **Charts:** Recharts

### Environment Variables Needed
```env
VITE_SUPABASE_URL=your-project-url
VITE_SUPABASE_ANON_KEY=your-anon-key
```

### Supabase Configuration
- Database: PostgreSQL 15+
- Storage Bucket: `hr-documents` (public access for photos)
- RLS: Enabled on all tables
- Triggers: Auto-update summaries

---

## Performance Considerations

### Query Optimization
```sql
-- Example: Efficient employee search with JOIN
SELECT 
  e.*,
  d.name as department_name,
  p.title as position_title,
  COUNT(te.id) as total_entries
FROM employees e
LEFT JOIN departments d ON e.department_id = d.id
LEFT JOIN positions p ON e.position_id = p.id
LEFT JOIN time_entries te ON e.id = te.employee_id
WHERE e.status = 'Active'
  AND (e.name ILIKE '%search%' OR e.email ILIKE '%search%')
GROUP BY e.id, d.name, p.title
ORDER BY e.name
LIMIT 50;
```

### Caching Strategy
- Use React Query for data caching
- Cache static data (departments, positions)
- Real-time subscriptions for critical data
- Optimistic updates for better UX

---

## Security Architecture

### Row Level Security (RLS) Policy Pattern

```sql
-- Pattern 1: View Own Data
CREATE POLICY "employees_view_own" ON table_name
  FOR SELECT USING (employee_id = auth.uid());

-- Pattern 2: HR Full Access
CREATE POLICY "hr_full_access" ON table_name
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM employees 
      WHERE id = auth.uid() 
      AND role IN ('hr_admin', 'hr_manager')
    )
  );

-- Pattern 3: Manager View Department
CREATE POLICY "manager_view_dept" ON table_name
  FOR SELECT USING (
    department_id IN (
      SELECT department_id FROM employees 
      WHERE id = auth.uid() 
      AND role = 'manager'
    )
  );
```

---

## Testing Strategy

### Test Coverage by Module

```
┌──────────────────────┬──────────┬──────────┬──────────┐
│ Module               │ Unit     │ Integration│ E2E     │
├──────────────────────┼──────────┼──────────┼──────────┤
│ Time Tracking ✅     │ ✅ 80%   │ ✅ 70%    │ ✅ 60%  │
│ Employee Mgmt ❌     │ ⏳ TBD   │ ⏳ TBD    │ ⏳ TBD  │
│ Recruitment ❌       │ ⏳ TBD   │ ⏳ TBD    │ ⏳ TBD  │
│ Performance ❌       │ ⏳ TBD   │ ⏳ TBD    │ ⏳ TBD  │
│ Reports ❌           │ ⏳ TBD   │ ⏳ TBD    │ ⏳ TBD  │
└──────────────────────┴──────────┴──────────┴──────────┘
```

---

## Rollout Plan

### Phase 1: Foundation (Week 1)
```
Day 1-2: Create migrations for recruitment tables
Day 3-4: Create employeeService.js and migrate employee management
Day 5-7: Create recruitmentService.js and update UI
```

### Phase 2: Enhancement (Week 2)
```
Day 1-3: Create performance tables and service
Day 4-5: Update performance components
Day 6-7: Create reference tables (departments, positions)
```

### Phase 3: Polish (Week 3)
```
Day 1-2: Enhance reports with real data
Day 3-4: Add advanced features (search, filters, exports)
Day 5-7: Testing and bug fixes
```

---

## Success Metrics

### Key Performance Indicators

| Metric | Current | Target | Status |
|--------|---------|--------|--------|
| **Data Persistence** | ❌ Browser-only | ✅ Server-side | 🔄 In Progress |
| **Real-time Updates** | ❌ Manual refresh | ✅ Auto-sync | 🔄 In Progress |
| **Multi-user Support** | ❌ Single user | ✅ Multi-user | 🔄 In Progress |
| **Data Integrity** | ⚠️ Can be lost | ✅ ACID compliant | 🔄 In Progress |
| **Search Performance** | ⚠️ Client-side | ✅ Indexed DB | 🔄 In Progress |
| **Scalability** | ❌ Limited | ✅ Unlimited | 🔄 In Progress |

---

## Quick Reference Commands

### Running Migrations
```bash
# Using Supabase CLI
supabase migration up

# Or directly in Supabase SQL Editor
# Copy and paste migration files one by one
```

### Seeding Data
```bash
# Run seed script (to be created)
npm run seed

# Or manually insert via SQL
INSERT INTO employees (name, email, department) 
VALUES ('Test User', 'test@example.com', 'Engineering');
```

### Development
```bash
# Start dev server
npm run dev

# Run tests
npm test

# Build for production
npm run build
```

---

## Summary

This architecture document provides a high-level overview of:
- ✅ **Current state** - What's working with Supabase
- ❌ **Missing pieces** - What needs to be migrated
- 📋 **Implementation plan** - How to get there
- 🎯 **Success criteria** - How to measure progress

**Next Step:** Begin Phase 1 implementation with recruitment and employee management tables.

---

*Document Version: 1.0*  
*Last Updated: October 20, 2025*
