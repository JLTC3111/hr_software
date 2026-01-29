# Fix: "On Leave" Time Entries in Dashboard and Calculations

## Issue
The dashboard and other components were not correctly recognizing `hourType: 'on_leave'` in time entries. 
1. `on_leave` time entries were counting as **Regular Hours** instead of **Leave Days**.
2. The Dashboard was ignoring the `leave_days` calculated by the service, relying solely on `leave_requests`.

## Fixes

### 1. `src/services/timeTrackingService.js`
Updated `calculateSummaryFromRawData` function:
- **Added handling for `on_leave`, `vacation`, `sick_leave` hour types.**
- These entries now populate `leaveDays` instead of falling into the default `regularHours` bucket.
- Deduplicated leave days using a `Set` to prevent double-counting if there are multiple entries for the same day.
- Merged `leave_requests` days into the same `leaveDates` tracking to ensure comprehensive coverage.

```javascript
// New Logic
if (entry.hour_type === 'on_leave' || entry.hour_type === 'vacation' || entry.hour_type === 'sick_leave') {
    leaveDates.add(entry.date);
} else {
    // ... calculate regular hours ...
}
```

### 2. `src/components/dashboard.jsx`
Updated `fetchDashboardData` function:
- Modified the `leaveDays` assignment in `trackingData`.
- Now uses `Math.max(result.data.leave_days || 0, leaveData[empId] || 0)`.
- This ensures that if `leave_days` are present in the time tracking summary (which now includes `on_leave` entries), they are used, while still retaining the count from pending/approved leave requests.

## Result
- **Accuracy:** `on_leave` entries now correctly increase the "Total Leave" count.
- **Correction:** `on_leave` entries no longer inflate "Regular Hours".
- **Consistency:** The dashboard now reflects both planned leave (from Requests) and executed leave (from Time Entries).
