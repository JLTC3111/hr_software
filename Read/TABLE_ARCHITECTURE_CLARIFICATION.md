# Database Table Architecture Clarification

## Overview
This document clarifies the separation of concerns between two similar-sounding but distinct database tables in the HR system.

## Table Definitions

### 1. `performance_goals` Table
**Purpose**: Track employee personal goals, objectives, and their progress toward completion.

**Key Fields**:
- `employee_id` - The employee working on the goal
- `title` - Goal title/name
- `description` - Goal description
- `category` - Goal category (e.g., 'professional-development', 'skill-improvement')
- `status` - Current status ('pending', 'in_progress', 'completed', 'not-started')
- `progress` - Progress percentage (0-100)
- `target_date` - Goal deadline
- `notes` - Additional notes
- `assigned_by` - Who assigned the goal
- `created_at`, `updated_at` - Timestamps

**Used By**:
- `reports.jsx` - Displays goal progress and completion rates
- `performanceService.js` - Service layer for CRUD operations
- Any goal management/tracking features

**Example Use Cases**:
- "Complete React certification by Q2 2025" - 75% progress
- "Improve code review participation" - 50% progress
- "Lead a project team" - 100% completed

---

### 2. `performance_reviews` Table
**Purpose**: Store quarterly performance appraisals, skill assessments, and overall performance ratings.

**Key Fields**:
- `employee_id` - The employee being reviewed
- `reviewer_id` - Who conducted the review
- `review_period` - Quarter/period (e.g., 'Q1-2025')
- `review_type` - Type of review ('quarterly', 'annual', 'probation')
- `overall_rating` - Overall performance rating (0-5, calculated as average of skill ratings)
- `technical_skills_rating` - Technical competency (0-5)
- `communication_rating` - Communication skills (0-5)
- `leadership_rating` - Leadership abilities (0-5)
- `teamwork_rating` - Teamwork and collaboration (0-5)
- `problem_solving_rating` - Problem-solving skills (0-5)
- `status` - Review status ('draft', 'submitted', 'approved')
- `review_date` - Date of review
- `approved_at` - Approval timestamp
- `strengths`, `areas_for_improvement`, `comments` - Text fields
- `created_at`, `updated_at` - Timestamps

**Used By**:
- `personalGoals.jsx` - Manages skill ratings and quarterly reviews (NOTE: Component name is misleading)
- Performance review features
- Skill assessment forms

**Example Use Cases**:
- Q4 2024 quarterly review with skill breakdown
- Annual performance appraisal
- Probation period evaluation

---

## Critical Distinctions

| Aspect | performance_goals | performance_reviews |
|--------|------------------|-------------------|
| **What** | Specific objectives/goals | Overall performance evaluation |
| **Granularity** | Individual goals | Holistic assessment |
| **Progress** | 0-100% completion | 0-5 star ratings per skill |
| **Frequency** | Ongoing, as needed | Quarterly/Annual cycles |
| **Focus** | Future achievements | Past performance |
| **Tracking** | Progress toward completion | Skill proficiency levels |

---

## Code Changes Made

### `personalGoals.jsx`
✅ **Correctly uses `performance_reviews` table**
- Added documentation clarifying it handles skill assessments, NOT goal progress
- Saves skill ratings and overall performance to `performance_reviews`
- Does NOT handle goal progress tracking
- Component name is misleading (should perhaps be `PerformanceReviewForm.jsx`)

### `reports.jsx`
✅ **Correctly uses `performance_goals` table**
- Added documentation clarifying it fetches from `performance_goals` table
- Displays goal progress percentages and completion status
- Uses `performanceService.getAllPerformanceGoals()` which queries `performance_goals`

### `performanceService.js`
✅ **Already correctly implemented**
- `getAllPerformanceGoals()` queries `performance_goals` table
- Proper joins with employees table
- Returns goal data with progress field

---

## Common Pitfalls (AVOID)

❌ **DON'T** save goal progress to `performance_reviews` table
❌ **DON'T** save skill ratings to `performance_goals` table  
❌ **DON'T** confuse the two tables when querying
❌ **DON'T** expect progress field to exist in `performance_reviews`
❌ **DON'T** expect skill rating fields to exist in `performance_goals`

---

## Database Schema Summary

```sql
-- performance_goals: Goal tracking
CREATE TABLE performance_goals (
  id BIGSERIAL PRIMARY KEY,
  employee_id INTEGER REFERENCES employees(id),
  title TEXT NOT NULL,
  description TEXT,
  category TEXT,
  status TEXT, -- 'pending', 'in_progress', 'completed', 'not-started'
  progress INTEGER DEFAULT 0, -- 0-100
  target_date DATE,
  notes TEXT,
  assigned_by INTEGER REFERENCES employees(id),
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);

-- performance_reviews: Quarterly/Annual reviews
CREATE TABLE performance_reviews (
  id BIGSERIAL PRIMARY KEY,
  employee_id INTEGER REFERENCES employees(id),
  reviewer_id INTEGER REFERENCES employees(id),
  review_period TEXT, -- e.g., 'Q1-2025'
  review_type TEXT, -- 'quarterly', 'annual', 'probation'
  overall_rating DECIMAL(3,2), -- 0.00-5.00 (average of skills)
  technical_skills_rating DECIMAL(3,2),
  communication_rating DECIMAL(3,2),
  leadership_rating DECIMAL(3,2),
  teamwork_rating DECIMAL(3,2),
  problem_solving_rating DECIMAL(3,2),
  status TEXT, -- 'draft', 'submitted', 'approved'
  review_date DATE,
  approved_at TIMESTAMP,
  strengths TEXT,
  areas_for_improvement TEXT,
  comments TEXT,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

---

## Future Recommendations

1. **Rename `personalGoals.jsx`** to `PerformanceReviewForm.jsx` to avoid confusion
2. **Create a dedicated Goals Management component** for performance_goals CRUD
3. **Add TypeScript types** to enforce table schema differences
4. **Consider adding foreign key constraints** between tables if relationship exists
5. **Document API endpoints** that interact with each table

---

## Summary

✅ **Both components now use the correct tables**  
✅ **Clear documentation added to distinguish purposes**  
✅ **No goal progress is saved to performance_reviews**  
✅ **No skill ratings are saved to performance_goals**  
✅ **Data architecture is properly separated**

The 0% progress issue in Reports was due to viewing data from the correct `performance_goals` table, which likely doesn't have the progress values saved yet. The 75% progress visible in "Personal Goals" page may have been calculated client-side but never persisted to the database.
