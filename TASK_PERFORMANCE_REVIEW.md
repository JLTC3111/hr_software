# Task Performance Review Component

## Overview
The **Task Performance Review** component is a comprehensive monthly task tracking and quality evaluation system that works in conjunction with the Workload Management component.

## Features

### 1. Monthly Performance Tracking
- **Month Navigation**: Navigate between months to view historical performance
- **Automatic Filtering**: Tasks are automatically filtered by selected month
- **Real-time Updates**: Integrates with Supabase for live task updates

### 2. Performance Metrics (Individual View)

#### Key Statistics Cards:
- **Total Tasks**: Number of tasks in selected month
- **Completed Tasks**: Successfully finished tasks
- **In Progress**: Currently active tasks
- **Overdue Tasks**: Tasks past due date and not completed
- **Completion Rate**: Percentage of completed tasks
- **Average Quality**: Mean quality rating across all rated tasks

#### Additional Metrics:
- **On-Time Performance**:
  - Shows tasks completed before/on due date
  - Displays on-time completion rate as percentage
  - Visual progress bar

- **Priority Distribution**:
  - High, Medium, Low priority task breakdown
  - Helps identify workload balance

- **Quality Assessment**:
  - Number of rated vs unrated tasks
  - Average quality score with visual indicator
  - Color-coded quality levels (green: 4+, blue: 3-4, yellow: <3)

### 3. Team View (Admin/Manager Only)
- **Team Performance Dashboard**: Overview of all employees
- **Individual Employee Cards** showing:
  - Total tasks assigned
  - Tasks completed
  - Completion rate with progress bar
  - Average quality rating
- **Filterable by Month**: Track team performance over time

### 4. Task Evaluation System

#### For Employees:
- **Self Assessment**: Add personal reflection on task performance
  - What went well
  - Challenges faced
  - Lessons learned

#### For Admins/Managers:
- **Quality Rating**: 1-5 star rating system with visual stars
- **Manager Comments**: Detailed feedback on:
  - Task quality
  - Performance observations
  - Improvement suggestions
  - Recognition of excellent work

#### Evaluation Features:
- **Interactive Star Rating**: Click to rate 1-5 stars
- **Dual View**: Shows both self-assessment and manager evaluation
- **Color-Coded Quality**: Visual indicators for quality levels
- **Task Context**: Displays task details during evaluation (status, priority, due date)

### 5. Filtering & Organization
- **Status Filters**:
  - All tasks
  - Completed only
  - In Progress only
  - Pending only
- **Task Counters**: Shows count for each filter
- **Color-Coded Badges**:
  - Status badges (green: completed, blue: in-progress, gray: pending)
  - Priority badges (red: high, yellow: medium, green: low)
  - Quality badges (purple with star rating)

### 6. Task Display Details
Each task shows:
- Title and description
- Status and priority badges
- Quality rating (if evaluated)
- Due date and creation date
- Self assessment (if provided)
- Manager evaluation (if provided)
- Evaluate button for quick access

## User Permissions

### Regular Employees:
- ✅ View their own monthly performance
- ✅ Add/update self-assessments
- ✅ See manager evaluations
- ✅ Navigate between months
- ✅ Filter tasks by status
- ❌ Cannot view team performance
- ❌ Cannot rate task quality

### Admins/Managers:
- ✅ All employee features
- ✅ View team performance dashboard
- ✅ Rate task quality (1-5 stars)
- ✅ Add manager comments/feedback
- ✅ View all employees' tasks
- ✅ Switch between Individual and Team views

## Technical Details

### Data Integration
- **Service**: Uses `workloadService.js` for all task operations
- **Real-time**: Supports live updates via Supabase subscriptions (ready for integration)
- **Month Filtering**: Filters tasks by `created_at` timestamp
- **Quality Calculation**: Computes averages only from tasks with ratings > 0

### Performance Calculations
```javascript
// Completion Rate
completionRate = (completedTasks / totalTasks) * 100

// On-Time Rate
onTimeRate = (onTimeCompletions / completedTasks) * 100

// Average Quality
avgQuality = sum(quality_ratings) / count(rated_tasks)
```

### State Management
- `selectedMonth`: Current month being viewed
- `viewMode`: 'individual' or 'team'
- `filterStatus`: 'all', 'completed', 'in-progress', 'pending'
- `evaluatingTask`: Currently open evaluation modal
- `evaluationForm`: Quality rating, comments, self-assessment

## Usage

### Accessing the Component
1. Navigate to **Workload Management** in sidebar
2. Click **Performance Review** submenu item
3. URL: `/task-performance`

### Typical Workflow

#### Employee Workflow:
1. Select month to review
2. View performance statistics
3. Filter tasks by status
4. Click "Evaluate" on a task
5. Add/update self-assessment
6. Submit evaluation
7. Review manager feedback (if available)

#### Manager Workflow:
1. Select month to review
2. Switch to "Team" view to see all employees
3. Identify employees needing attention
4. Switch to "Individual" view
5. Review employee's tasks
6. Click "Evaluate" on tasks
7. Provide quality rating (1-5 stars)
8. Add constructive comments
9. Submit evaluation

## Benefits

### For Employees:
- 📊 Clear visibility of monthly performance
- 🎯 Track completion rates and quality trends
- 💬 Provide context through self-assessment
- 📈 Identify areas for improvement
- ⭐ Receive structured feedback

### For Managers:
- 👥 Monitor team performance at a glance
- 🎖️ Identify top performers
- 🚨 Spot struggling team members early
- 📝 Provide consistent, documented feedback
- 📊 Make data-driven decisions

### For Organization:
- 📈 Track productivity trends over time
- 🎯 Improve goal alignment
- 💼 Better performance management
- 📋 Documentation for reviews
- 🔄 Continuous improvement culture

## Future Enhancements
- Export monthly reports to PDF
- Trend analysis across multiple months
- Automated performance alerts
- Skill-based task recommendations
- Integration with Performance Appraisal system
- Goal setting based on performance metrics
- Peer evaluation features
- Department-level comparisons
