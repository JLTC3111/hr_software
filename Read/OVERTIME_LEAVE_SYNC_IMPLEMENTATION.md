# Overtime & Leave Synchronization Implementation

## ✅ All Changes Complete

### Summary of Changes

This implementation ensures that:
1. **Leave days are calculated from leave_requests table** (pending + approved) in real-time
2. **Leave days display immediately** in both timeTracking.jsx and dashboard.jsx
3. **Overtime logs write to time_entries table** (same as timeClock.jsx)
4. **All overtime calculations include all sources** in both components
5. **Pending requests are counted** in all metrics across all components

---

## 📝 Detailed Changes

### 1. TimeTracking.jsx - Leave Days Calculation ✅

**File**: `src/components/timeTracking.jsx`

#### A) Real-time Leave Days Calculation (Lines 141-175)
```javascript
// Calculate leave days from leave_requests (including pending)
const calculateLeaveDays = () => {
  if (!leaveRequests || leaveRequests.length === 0) return 0;
  
  return leaveRequests.reduce((total, req) => {
    // Include pending and approved, exclude rejected
    if (req.status === 'rejected') return total;
    
    const startDate = new Date(req.start_date);
    const reqMonth = startDate.getMonth() + 1;
    const reqYear = startDate.getFullYear();
    
    // Only count if within selected month/year
    if (reqYear === selectedYear && reqMonth === selectedMonth) {
      return total + (req.days_count || 0);
    }
    return total;
  }, 0);
};

const calculatedLeaveDays = calculateLeaveDays();

// Override leave_days with calculated value (includes pending)
currentData.leave_days = calculatedLeaveDays;
```

**Impact**: Leave days now show **immediately** when a leave request is submitted (even if pending).

#### B) Leave Days in Metric Card (Line 471)
```javascript
<TimeCard
  title={t('timeTracking.leaveDays')}
  value={calculatedLeaveDays.toFixed(1)}  // ← Uses calculated value
  unit={t('timeTracking.days')}
  icon={Coffee}
  onClick={() => handleMetricClick('leaveDays')}
/>
```

#### C) Leave Days in Summary Tab (Lines 556-560)
```javascript
<div className="flex justify-between">
  <span className={`${text.secondary} ml-12`}>{t('timeTracking.leaveDays')}:</span>
  <span className={`font-medium ${text.primary}`}>
    {calculatedLeaveDays.toFixed(1)} {t('timeTracking.days')}
    <span className="text-xs text-gray-500 ml-1">
      ({t('timeTracking.includesPending', '*incl. pending')})
    </span>
  </span>
</div>
```

**Impact**: Summary tab now shows calculated leave days with indicator that pending are included.

#### D) Overtime in Summary Tab Includes Holiday Overtime (Lines 538-542)
```javascript
<div className="flex justify-between">
  <span className={`${text.secondary} mr-12`}>{t('timeTracking.overtimeHours')}:</span>
  <span className={`font-medium ${text.primary}`}>
    {((currentData.overtime_hours || 0) + (currentData.holiday_overtime_hours || 0)).toFixed(1)} {t('timeTracking.hrs')}
  </span>
</div>
```

#### E) Refresh Summary After Leave Request (Lines 271-287)
```javascript
// Refresh leave requests and summary data
const leaveResult = await timeTrackingService.getLeaveRequests(selectedEmployee, {
  year: selectedYear
});
if (leaveResult.success) {
  setLeaveRequests(leaveResult.data);
}

// Refresh summary to update leave days count
const summaryResult = await timeTrackingService.getTimeTrackingSummary(
  selectedEmployee,
  selectedMonth,
  selectedYear
);
if (summaryResult.success) {
  setSummaryData(summaryResult.data);
}
```

---

### 2. TimeTracking.jsx - Overtime to time_entries Table ✅

**File**: `src/components/timeTracking.jsx`

#### A) Changed State from overtime_logs to time_entries (Line 34)
```javascript
// Before
const [overtimeLogs, setOvertimeLogs] = useState([]);

// After
const [timeEntries, setTimeEntries] = useState([]);
```

#### B) Fetch time_entries Instead of overtime_logs (Lines 93-103)
```javascript
// Fetch time entries (includes overtime)
const startDate = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-01`;
const endDate = new Date(selectedYear, selectedMonth, 0).toISOString().split('T')[0];
const entriesResult = await timeTrackingService.getTimeEntries(selectedEmployee, {
  startDate: startDate,
  endDate: endDate
});

if (entriesResult.success) {
  setTimeEntries(entriesResult.data);
}
```

#### C) Log Overtime as time_entry (Lines 308-344)
```javascript
const handleOvertimeSubmit = async (e) => {
  e.preventDefault();
  setLoading(true);
  
  try {
    // Log overtime as a time_entry (same table as timeClock.jsx)
    const overtimeHours = parseFloat(overtimeForm.hours);
    const clockIn = '17:00'; // Default start time for overtime
    const clockOutTime = new Date(`${overtimeForm.date}T${clockIn}`);
    clockOutTime.setHours(clockOutTime.getHours() + Math.floor(overtimeHours));
    clockOutTime.setMinutes(clockOutTime.getMinutes() + Math.round((overtimeHours % 1) * 60));
    const clockOut = clockOutTime.toTimeString().slice(0, 5);
    
    const result = await timeTrackingService.createTimeEntry({
      employeeId: selectedEmployee,
      date: overtimeForm.date,
      clockIn: clockIn,
      clockOut: clockOut,
      hours: overtimeHours,
      hourType: 'weekend', // Log as weekend overtime (goes to overtime_hours in summary)
      notes: overtimeForm.reason || 'Overtime work'
    });
    
    if (result.success) {
      // Refresh summary data to reflect new overtime
      const summaryResult = await timeTrackingService.getTimeTrackingSummary(
        selectedEmployee,
        selectedMonth,
        selectedYear
      );
      if (summaryResult.success) {
        setSummaryData(summaryResult.data);
      }
      // ... rest of success handling
    }
  }
}
```

**Impact**: 
- Overtime now writes to `time_entries` table with `hour_type = 'weekend'`
- **Same table as timeClock.jsx** for consistency
- Automatically calculated in `time_tracking_summary` by existing database function
- Included in overtime_hours calculation

#### D) Updated Modal Data to Show Overtime from time_entries (Lines 217-230)
```javascript
case 'overtime':
  // Filter time entries for overtime types (weekend, holiday, bonus)
  const overtimeEntries = timeEntries.filter(entry => 
    ['weekend', 'holiday', 'bonus'].includes(entry.hour_type)
  );
  data = overtimeEntries.map(entry => ({
    employeeName: selectedEmp.name,
    requestType: entry.hour_type,
    date: entry.date,
    status: entry.status,
    hours: entry.hours
  }));
  title = t('timeTracking.overtime');
  break;
```

---

### 3. Dashboard.jsx - Leave Days from leave_requests ✅

**File**: `src/components/dashboard.jsx`

#### A) Added leaveRequestsData State (Line 18)
```javascript
const [leaveRequestsData, setLeaveRequestsData] = useState({});
```

#### B) Fetch Leave Requests for All Employees (Lines 43-79)
```javascript
// Fetch leave requests for all employees
const leavePromises = employees.map(emp => 
  timeTrackingService.getLeaveRequests(String(emp.id), {
    year: currentYear
  })
);
const leaveResults = await Promise.all(leavePromises);

// Calculate leave days from leave_requests (pending + approved)
const leaveData = {};
leaveResults.forEach((result, index) => {
  const emp = employees[index];
  const empId = String(emp.id);
  
  if (result.success && result.data) {
    // Calculate leave days for current month (pending + approved)
    const leaveDays = result.data.reduce((total, req) => {
      if (req.status === 'rejected') return total;
      
      const startDate = new Date(req.start_date);
      const reqMonth = startDate.getMonth() + 1;
      const reqYear = startDate.getFullYear();
      
      // Only count if within current month/year
      if (reqYear === currentYear && reqMonth === currentMonth) {
        return total + (req.days_count || 0);
      }
      return total;
    }, 0);
    
    leaveData[empId] = leaveDays;
  } else {
    leaveData[empId] = 0;
  }
});

setLeaveRequestsData(leaveData);
```

#### C) Use Calculated Leave Days in Tracking Data (Lines 89-96, 104-111)
```javascript
if (result.success && result.data) {
  trackingData[empId] = {
    workDays: result.data.days_worked || 0,
    leaveDays: leaveData[empId] || 0, // ← Use calculated leave days
    overtime: result.data.overtime_hours || 0,
    holidayOvertime: result.data.holiday_overtime_hours || 0,
    regularHours: result.data.regular_hours || 0,
    totalHours: result.data.total_hours || 0,
    performance: emp.performance || 4.0
  };
}
```

#### D) Updated Leave Chart Data (Lines 192-201)
```javascript
const leaveData = employees.map(emp => {
  const empId = String(emp.id);
  return {
    name: getUniqueDisplayName(emp, employees),
    fullName: emp.name,
    id: emp.id,
    leaveDays: leaveRequestsData[empId] || timeTrackingData[empId]?.leaveDays || 0,
    workDays: timeTrackingData[empId]?.workDays || 0
  };
});
```

#### E) Updated Leave Modal Data (Lines 259-270)
```javascript
case 'leave':
  data = employees.map(emp => {
    const empId = String(emp.id);
    return {
      employeeName: emp.name,
      department: emp.department,
      leaveDays: leaveRequestsData[empId] || timeTrackingData[empId]?.leaveDays || 0,
      workDays: timeTrackingData[empId]?.workDays || 0
    };
  });
  title = t('dashboard.totalLeave');
  break;
```

**Impact**: Dashboard now shows leave days from leave_requests table (pending + approved) immediately.

---

### 4. Overtime Calculations - Both Components ✅

#### TimeTracking.jsx
- **Metric Card** (Line 480): `(overtime_hours + holiday_overtime_hours)`
- **Summary Tab** (Line 541): `(overtime_hours + holiday_overtime_hours)`
- **Data Source**: `time_tracking_summary` table (calculated from all time_entries)

#### Dashboard.jsx
- **Total Overtime** (Line 113): `(overtime + holidayOvertime)`
- **Metric Modal** (Line 253): `(overtime + holidayOvertime)`
- **Charts**: Overtime chart shows combined overtime

#### TimeClockEntry.jsx
- **Already Correct**: Calculates from all time_entries (regular, weekend, holiday, bonus)
- **Includes Pending**: `if (entry.status === 'rejected') return acc;`

---

## 🔄 Data Flow

### Leave Days Flow:
```
User submits leave request
    ↓
Writes to leave_requests table (status = 'pending')
    ↓
timeTracking.jsx calculateLeaveDays() ← Fetches leave_requests
    ↓
Counts: pending + approved, excludes rejected
    ↓
Displays immediately in:
  - Leave Days metric card
  - Summary tab
    ↓
dashboard.jsx fetches leave_requests for all employees
    ↓
Displays in:
  - Total Leave metric
  - Work & Leave Days chart
  - Leave modal
```

### Overtime Flow:
```
User logs overtime
    ↓
timeTracking.jsx handleOvertimeSubmit()
    ↓
Writes to time_entries table
  - hour_type = 'weekend'
  - status = 'pending'
  - clock_in = '17:00'
  - clock_out = calculated from hours
    ↓
Database function update_time_tracking_summary() ← Triggered
    ↓
Aggregates to time_tracking_summary:
  - weekend hours → overtime_hours
  - holiday hours → holiday_overtime_hours
    ↓
timeTracking.jsx & dashboard.jsx fetch summary
    ↓
Display combined overtime:
  overtime_hours + holiday_overtime_hours
```

---

## 🎯 Key Benefits

### 1. **Real-time Updates**
- Leave days show **immediately** after submission (even if pending)
- No delay waiting for approval
- Accurate current state

### 2. **Data Consistency**
- Overtime uses same table (`time_entries`) in both components
- Single source of truth for all time tracking
- Easier to maintain

### 3. **Proper Calculations**
- Pending + approved counted (rejected excluded)
- All overtime types included
- Holiday overtime properly aggregated

### 4. **Better UX**
- Users see their leave requests reflected immediately
- No confusion about "missing" leave days
- Clear indicators that pending are included

---

## 📊 Database Tables & Relationships

### time_entries
- **Used by**: timeClock.jsx, timeTracking.jsx (overtime)
- **hour_type values**: 'regular', 'weekend', 'holiday', 'bonus'
- **Mapping to summary**:
  - regular → regular_hours
  - weekend + bonus → overtime_hours
  - holiday → holiday_overtime_hours

### leave_requests
- **Used by**: timeTracking.jsx, timeClock.jsx, dashboard.jsx
- **Counted when**: status IN ('pending', 'approved')
- **Excluded when**: status = 'rejected'
- **Contains**: days_count field

### time_tracking_summary
- **Source**: Calculated from time_entries + leave_requests
- **Updated by**: Database trigger on insert/update
- **Contains**: 
  - regular_hours
  - overtime_hours (weekend + bonus + overtime_logs.regular)
  - holiday_overtime_hours (holiday + overtime_logs.holiday)
  - total_hours
  - days_worked
  - leave_days (from leave_requests)

---

## ✅ Testing Checklist

### TimeTracking.jsx - Leave Days:
- [x] Leave days show 0 when no leave requests
- [x] Leave days increment immediately after submitting leave request
- [x] Pending leave requests counted
- [x] Approved leave requests counted
- [x] Rejected leave requests NOT counted
- [x] Leave days shown in metric card
- [x] Leave days shown in Summary tab with "(incl. pending)" indicator
- [x] Leave days filtered by selected month/year
- [x] Changing month updates leave days count

### TimeTracking.jsx - Overtime:
- [x] Log Overtime writes to time_entries table
- [x] Overtime entry has hour_type = 'weekend'
- [x] Clock in/out times calculated correctly
- [x] Summary data refreshes after logging overtime
- [x] Overtime metric card shows combined overtime
- [x] Summary tab shows combined overtime
- [x] Modal shows filtered overtime entries (weekend, holiday, bonus)

### Dashboard.jsx - Leave Days:
- [x] Leave days fetched from leave_requests
- [x] Pending + approved counted
- [x] Rejected excluded
- [x] Filtered by current month/year
- [x] Leave chart displays calculated leave days
- [x] Leave metric modal shows calculated leave days
- [x] Total Leave metric accurate

### Dashboard.jsx - Overtime:
- [x] Overtime includes holiday_overtime_hours
- [x] Overtime charts show combined values
- [x] Overtime modal shows combined values

### Both Components:
- [x] Status filter: pending + approved (not rejected)
- [x] Data consistency between components
- [x] Real-time updates after submitting requests
- [x] Summary data accuracy

---

## 🚀 Deployment Notes

**No database migration required** - Uses existing tables and functions.

**Files Modified**:
1. `src/components/timeTracking.jsx` - Major updates
2. `src/components/dashboard.jsx` - Leave calculation updates
3. `src/components/timeClockEntry.jsx` - No changes (already correct)

**No Breaking Changes** - All changes are additive or internal logic improvements.

---

## 📖 User-Facing Changes

### For Employees:

**TimeTracking Page**:
- Leave days now show **immediately** after submitting a leave request
- No need to wait for approval to see leave count
- Summary tab shows total leave days with indicator "(incl. pending)"
- Log Overtime button now writes to the same system as Time Clock

**Dashboard**:
- Leave days chart updates in real-time
- Shows pending leave requests immediately

### For Managers/HR:

**Dashboard**:
- All leave days metrics include pending requests
- Accurate view of upcoming leave
- Better planning capabilities

---

## 🔧 Technical Notes

### Why change overtime_logs to time_entries?

**Before**:
- timeTracking.jsx wrote to `overtime_logs` table
- timeClock.jsx wrote to `time_entries` table
- Two different tables for same concept
- Inconsistent data flow

**After**:
- Both components write to `time_entries` table
- Single source of truth
- Easier maintenance
- Consistent with database aggregation function

### Why calculate leave days client-side?

**Before**:
- Relied on `time_tracking_summary.leave_days`
- Summary table only updated on approved requests
- Pending requests not visible

**After**:
- Calculate from `leave_requests` table directly
- Include pending + approved
- Real-time updates
- More accurate current state

---

**Implementation Date**: October 27, 2025  
**Status**: ✅ Complete & Tested  
**Breaking Changes**: None  
**Database Changes**: None
