# HR Software System - User Manual

## Table of Contents
1. [Getting Started](#getting-started)
2. [User Roles & Permissions](#user-roles--permissions)
3. [Dashboard Overview](#dashboard-overview)
4. [Employee Management](#employee-management)
5. [Time Tracking](#time-tracking)
6. [Performance Appraisal](#performance-appraisal)
7. [Recruitment](#recruitment)
8. [Reports & Analytics](#reports--analytics)
9. [Notifications](#notifications)
10. [Settings](#settings)
11. [Troubleshooting](#troubleshooting)

---

## Getting Started

### System Requirements
- Modern web browser (Chrome, Firefox, Safari, Edge)
- Internet connection
- Recommended screen resolution: 1920x1080 or higher

### First Login
1. Navigate to the application URL
2. Enter your email and password
3. Click "Sign In"
4. Complete your profile if prompted

### Language Support
The system supports 9 languages:
- English
- Vietnamese (Tiếng Việt)
- German (Deutsch)
- Spanish (Español)
- French (Français)
- Japanese (日本語)
- Korean (한국어)
- Russian (Русский)
- Thai (ไทย)

To change language, click the language selector in the header.

---

## User Roles & Permissions

### Admin
**Full system access** with all administrative privileges including:
- User management
- System settings
- Complete data control
- All module access
- Approve all requests

### HR Admin
**Complete HR management** with:
- Employee administration
- Payroll access
- System configuration
- Recruitment management
- Performance reviews

### HR Manager
**Manage HR operations** including:
- Employee records
- Performance reviews
- Recruitment processes
- HR reporting

### Manager
**Team supervision** with ability to:
- Supervise team members
- Approve time tracking
- Manage performance reviews
- View team reports

### Employee
**Personal access** to:
- Personal information
- Submit time entries
- View own performance data
- Submit leave requests

### Viewer
**Read-only access** to:
- Reports and dashboards
- Limited system information
- No edit permissions

---

## Dashboard Overview

### Main Dashboard Components

#### Statistics Cards
- **Total Employees**: Current employee count
- **Active**: Currently active employees
- **On Leave**: Employees on leave
- **Departments**: Number of departments

#### Quick Actions
- Add New Employee
- Time Clock Entry
- View Reports
- Manage Recruitment

#### Recent Activities
View recent system activities and changes

#### Performance Overview
Visual representation of team performance metrics

---

## Employee Management

### Viewing Employees

#### Employee List
1. Navigate to **Employees** from sidebar
2. View all employees in card or list view
3. Use search bar to find specific employees
4. Filter by:
   - Department
   - Position
   - Status
   - Performance rating

#### Employee Details
Click on any employee card to view:
- **Basic Information**: Name, position, department, dates, salary
- **Contact**: Email, phone, address
- **Documents**: Uploaded PDF documents
- **Quick Stats**: Status, work duration, performance

### Adding New Employee

1. Click **Add Employee** button
2. Complete the 3-step process:

#### Step 1: Personal Information
- Full Name *
- Email *
- Phone *
- Date of Birth *
- Address *
- Profile Photo (optional)

#### Step 2: Employment Information
- Position *
- Department *
- Start Date *
- Salary *
- Employment Status
- Initial Performance Rating

#### Step 3: Review & Submit
- Review all entered information
- Click **Submit** to add employee
- Upload documents if needed

### Editing Employee Information

1. Open employee detail modal
2. Click **Edit** button (✏️)
3. Modify required fields
4. Click **Save Changes**

### Document Management

#### Uploading Documents
1. Open employee details
2. Go to **Documents** tab
3. Click **Upload Document** or drag & drop PDF
4. Maximum file size: 10MB

#### Viewing Documents
- Click **View Document** to preview
- Use PDF viewer to navigate pages
- Zoom in/out as needed

#### Deleting Documents
1. Click **Delete Document** (🗑️)
2. Confirm deletion
3. Document will be permanently removed

---

## Time Tracking

### Overview
Track employee work hours, leave, overtime, and holidays.

### Time Clock Entry

#### For Employees
1. Navigate to **Time Tracking** > **Time Clock**
2. Click **Add New Entry**
3. Fill in details:
   - **Date**: Select date
   - **Time In**: Start time
   - **Time Out**: End time
   - **Type**: Work Day, Leave Day, Overtime, Holiday Overtime
   - **Notes**: Optional description
   - **Proof**: Upload proof file (images, PDF)
4. Click **Submit**

#### Entry Types

**Work Day**
- Regular working hours
- Automatically calculated hours

**Leave Day**
- Paid/unpaid leave
- Requires approval
- Deducted from leave balance

**Overtime**
- Extra hours beyond regular schedule
- Calculated with overtime rate
- Requires manager approval

**Holiday Overtime**
- Work on public holidays
- Premium overtime rate
- Requires special approval

### For Managers/Admins

#### Viewing Time Entries
1. Navigate to **Time Tracking**
2. View options:
   - **My Entries**: Your personal entries
   - **All Employees**: All team entries
   - **Specific Employee**: Filter by employee

#### Approving Entries
1. Review pending entries (marked with ⚠️)
2. Check proof documents if uploaded
3. Click **Approve** (✓) button
4. Entry status changes to "Approved"

#### Managing Entries
- **View Proof**: Click file icon to view uploaded documents
- **Download**: Download proof files
- **Upload Later**: Add proof to existing entries
- **Delete**: Remove entries (with confirmation)

### Proof File Management

#### Uploading Proof
- **Supported formats**: JPG, PNG, PDF
- **Maximum size**: 50MB
- **Upload methods**:
  - During entry creation
  - After submission via "Upload" button
  - Drag and drop

#### Viewing Proof
- Click **View** icon (📄) for images
- Opens full-screen preview
- For PDFs: Click to download and view externally

#### Deleting Proof
1. Click **Delete** option
2. Choose:
   - **Delete Entry & Proof**: Removes everything
   - **Delete Proof Only**: Keeps entry, removes file
3. Confirm action

---

## Performance Appraisal

### Overview
Manage employee performance reviews, goals, and skill assessments.

### Performance Dashboard
- **Overall Performance**: Company-wide performance metrics
- **Goals Completed**: Progress on objectives
- **Reviews This Period**: Number of completed reviews
- **Average Skill Rating**: Team skill assessment average

### Managing Goals

#### Creating Goals
1. Navigate to **Performance** > **Goals**
2. Click **Add Goal**
3. Enter:
   - Goal title
   - Description
   - Target date
   - Priority
   - Assigned employee
4. Click **Save**

#### Tracking Progress
- Update progress percentage
- Add notes and milestones
- Mark as completed when done

### Conducting Reviews

#### Starting a Review
1. Go to **Performance** > **Reviews**
2. Click **New Review**
3. Select employee and review period
4. Choose review type (Quarterly, Annual, etc.)

#### Review Sections

**Skills Assessment**
- Rate technical skills
- Rate soft skills
- Add comments for each skill

**Goal Evaluation**
- Review assigned goals
- Mark completion status
- Assess quality of completion

**Overall Rating**
- Provide overall performance rating (1-5)
- Add detailed feedback
- Set improvement areas

#### Finalizing Reviews
1. Complete all sections
2. Review summary
3. Submit for approval
4. Employee receives notification

---

## Recruitment

### Job Postings

#### Creating Job Posts
1. Navigate to **Recruitment**
2. Click **Post New Job**
3. Fill in details:
   - Job title
   - Department
   - Description
   - Requirements
   - Salary range
   - Application deadline
4. Publish post

### Managing Applications

#### Application Pipeline
View candidates in different stages:
- **Screening**: Initial review
- **Interview Scheduled**: Interview planned
- **Technical Assessment**: Skills evaluation
- **Offer Extended**: Job offer sent
- **Hired**: Accepted and onboarded
- **Rejected**: Not selected

#### Processing Applications
1. Review application details
2. Update stage as candidate progresses
3. Add notes and feedback
4. Schedule interviews
5. Make hiring decisions

### Interview Management
- Schedule interview dates
- Assign interviewers
- Record interview feedback
- Track candidate status

---

## Reports & Analytics

### Available Reports

#### Employee Reports
- **Employee List**: Complete employee roster
- **Department Distribution**: Employee count by department
- **Performance Metrics**: Team performance analysis
- **Turnover Analysis**: Retention and attrition rates

#### Time Tracking Reports
- **Attendance Report**: Daily/monthly attendance
- **Overtime Analysis**: Overtime hours by employee
- **Leave Balance**: Remaining leave days
- **Work Hours Summary**: Total hours worked

#### Recruitment Reports
- **Application Metrics**: Applications received
- **Time to Hire**: Hiring process duration
- **Source Analysis**: Where candidates come from
- **Conversion Rates**: Success rates by stage

### Generating Reports

#### Custom Reports
1. Go to **Reports**
2. Click **Generate Custom Report**
3. Select:
   - Report type
   - Date range
   - Departments/employees
   - Filters
4. Click **Generate**

#### Export Options
- **PDF**: Formatted document
- **Excel**: Spreadsheet with data
- **CSV**: Raw data export

### Report Scheduling
- Set up automated reports
- Choose frequency (daily, weekly, monthly)
- Select recipients
- Reports delivered via email

---

## Notifications

### Notification Types

#### Success Notifications
- Actions completed successfully
- Approvals confirmed
- Records saved

#### Warning Notifications
- Pending approvals
- Upcoming deadlines
- System alerts

#### Error Notifications
- Failed operations
- Validation errors
- System issues

#### Info Notifications
- General updates
- Announcements
- Reminders

### Managing Notifications

#### Viewing Notifications
1. Click bell icon (🔔) in header
2. Badge shows unread count
3. Click to open notification center

#### Notification Actions
- **Mark as Read**: Click checkmark (✓)
- **Delete**: Click trash icon (🗑️)
- **Mark All Read**: Bulk action
- **Delete All**: Clear all notifications

#### Filtering Notifications
Filter by:
- **Status**: All, Unread, Read
- **Category**: Time tracking, recruitment, performance, etc.
- **Type**: Success, warning, error, info

#### Notification Settings
1. Go to **Settings** > **Notifications**
2. Configure:
   - Email notifications
   - Push notifications
   - Notification frequency
   - Category preferences

---

## Settings

### User Settings

#### Profile Settings
- Update personal information
- Change password
- Upload profile photo
- Set preferences

#### Display Settings
- **Theme**: Light/Dark mode
- **Language**: Choose from 9 languages
- **Date Format**: Regional formats
- **Time Zone**: Set local timezone

#### Privacy Settings
- Control data visibility
- Manage sharing preferences
- Set profile privacy level

### System Settings (Admin Only)

#### Company Settings
- Company name and logo
- Business hours
- Holiday calendar
- Leave policies

#### Email Configuration
- SMTP settings
- Email templates
- Notification rules

#### Security Settings
- Password policies
- Session timeout
- Two-factor authentication
- IP restrictions

#### Data Management
- Backup configuration
- Data retention policies
- Export settings

---

## Control Panel

### User Information Display

#### View Your Details
1. Navigate to **Control Panel** (⚙️) in sidebar
2. View:
   - Profile photo
   - Full name and email
   - Role and permissions
   - User UUID (unique identifier)
   - Employee ID (if linked)

#### Role Information
See your current role and detailed permission description

#### Actions Available
- **Change Password**: Update your credentials
- **Read Manual**: Access this documentation
- **Log Out**: Sign out of system

### Changing Password

1. Click **Change Password** in Control Panel
2. Enter:
   - Current password
   - New password (minimum 6 characters)
   - Confirm new password
3. Click **Save**
4. Password updated confirmation

---

## Troubleshooting

### Common Issues

#### Cannot Log In
**Solutions:**
- Verify email and password
- Check caps lock
- Reset password if forgotten
- Contact admin for account issues

#### Page Not Loading
**Solutions:**
- Refresh the page (Ctrl/Cmd + R)
- Clear browser cache
- Check internet connection
- Try different browser

#### File Upload Fails
**Solutions:**
- Check file size (max limits apply)
- Verify file format
- Ensure stable internet connection
- Try smaller file

#### Notifications Not Showing
**Solutions:**
- Check notification settings
- Verify notification permissions
- Refresh notification panel
- Clear browser cache

#### Data Not Saving
**Solutions:**
- Check required fields
- Verify permissions
- Check internet connection
- Contact support if persists

### Getting Help

#### In-App Support
- Click help icon (?) in any module
- View contextual help tooltips
- Access quick guides

#### Contact Support
- Email: support@icue.vn
- Phone: +84 xxx xxx xxx
- Help desk: [support portal URL]

#### Report Bugs
1. Document the issue
2. Take screenshots if possible
3. Note error messages
4. Contact IT support

---

## Best Practices

### For Employees
- ✅ Submit time entries daily
- ✅ Upload proof documents promptly
- ✅ Keep profile information updated
- ✅ Review notifications regularly
- ✅ Report issues immediately

### For Managers
- ✅ Review pending approvals daily
- ✅ Provide timely feedback on reviews
- ✅ Keep team information current
- ✅ Monitor team performance metrics
- ✅ Communicate deadlines clearly

### For Admins
- ✅ Regular system backups
- ✅ Monitor system health
- ✅ Update user permissions promptly
- ✅ Review audit logs
- ✅ Keep documentation current

---

## Keyboard Shortcuts

### Global Shortcuts
- `Ctrl/Cmd + K`: Global search
- `Ctrl/Cmd + /`: Show shortcuts
- `Esc`: Close modals/dialogs
- `Ctrl/Cmd + S`: Save (where applicable)

### Navigation
- `Ctrl/Cmd + H`: Home/Dashboard
- `Ctrl/Cmd + E`: Employees
- `Ctrl/Cmd + T`: Time Tracking
- `Ctrl/Cmd + P`: Performance
- `Ctrl/Cmd + R`: Reports

---

## Security Guidelines

### Password Requirements
- Minimum 6 characters
- Mix of letters and numbers recommended
- Change regularly (every 90 days)
- Don't share credentials
- Use unique passwords

### Data Protection
- Log out when leaving workstation
- Don't share sensitive information
- Report security concerns immediately
- Follow company data policies
- Use secure connections only

### Privacy
- Respect employee privacy
- Access only authorized data
- Follow data handling procedures
- Report data breaches immediately

---

## Glossary

**Employee ID**: Unique identifier for each employee in the system

**User UUID**: Universally unique identifier for user accounts

**Time Entry**: Record of work hours, leave, or overtime

**Proof File**: Supporting document for time entries (receipt, screenshot, etc.)

**Approval**: Manager/admin authorization of requests

**Performance Rating**: Numerical assessment of employee performance (1-5 scale)

**RLS (Row Level Security)**: Database security feature controlling data access

**Metadata**: Additional information associated with records

---

## Version History

### Version 1.0.0 (Current)
- Initial release
- Core HR management features
- Time tracking system
- Performance appraisal module
- Recruitment pipeline
- Multi-language support (9 languages)
- Real-time notifications
- Document management
- Reports and analytics

---

## Contact Information

**ICUE Company**
- Website: https://icue.vn
- Support Email: hr-support@icue.vn
- Phone: +84 xxx xxx xxx
- Address: [Company Address]

**Technical Support**
- Hours: Monday - Friday, 8:00 AM - 6:00 PM (GMT+7)
- Emergency: Available 24/7 for critical issues

---

## Legal & Compliance

### Data Privacy
This system complies with:
- GDPR (General Data Protection Regulation)
- Vietnam Personal Data Protection Decree
- International data protection standards

### Terms of Use
By using this system, you agree to:
- Follow company policies
- Protect confidential information
- Use system resources appropriately
- Report policy violations

---

*Last Updated: October 29, 2025*
*Manual Version: 1.0.0*
*For the latest version of this manual, visit the help center or contact support.*
