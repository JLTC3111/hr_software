# Idle/Tab-Switch Data Fetch Failure Fix

## Problem Identified

Users reported that after being idle or staying on one component for a while, then switching to another component, **data fails to fetch from the backend**.

### Root Causes

1. **Silent Error Swallowing**: When data fetches failed (due to session expiry, network timeout, or other errors), errors were only logged to console but never shown to users. The UI appeared fine but showed stale/empty data.

2. **No Session Validation**: Components did not validate or refresh the Supabase session before making API calls. After idle periods, the session could become stale or expire, causing silent fetch failures.

3. **No Retry Mechanism**: If a fetch failed, there was no way for users to retry without manually refreshing the entire page.

4. **Silent Refresh Hides Issues**: The `silent: true` option in visibility refresh hooks prevented loading indicators, so users had no indication that anything was happening or failing.

## Solution Implemented

### 1. Created Session Helper Utility (`src/utils/sessionHelper.js`)

A reusable utility that:
- Validates the current Supabase session
- Checks if the session is about to expire (within 5 minutes)
- Automatically refreshes the session if needed
- Provides clear error messages when session is invalid

**Key Functions**:
- `validateAndRefreshSession()`: Validates and refreshes session
- `withSessionValidation(fetchFn)`: Wrapper for fetch functions (for future use)

### 2. Added Error State UI to Components

**Files Modified**:
- `src/components/dashboard.jsx`
- `src/components/reports.jsx`
- `src/components/timeClockEntry.jsx`

**Changes**:
- Added `fetchError` state to track fetch errors
- Added error banner UI that:
  - Displays user-friendly error messages
  - Includes a "Try Again" button for easy retry
  - Can be dismissed with an × button
  - Uses appropriate colors for dark/light themes
  - Slides in with animation for better UX

### 3. Enhanced Fetch Functions with Session Validation

**Before**:
```javascript
const fetchDashboardData = useCallback(async (options = {}) => {
  const { silent = false } = options;
  if (!silent) setLoading(true);
  try {
    // Direct API calls without session validation
    const result = await timeTrackingService.getTimeTrackingSummary(...);
    // ...
  } catch (error) {
    console.error('Error:', error); // Only logged to console
  } finally {
    if (!silent) setLoading(false);
  }
}, [dependencies]);
```

**After**:
```javascript
const fetchDashboardData = useCallback(async (options = {}) => {
  const { silent = false } = options;
  if (!silent) {
    setLoading(true);
    setFetchError(null); // Clear previous errors
  }
  try {
    // Validate session before fetching
    const sessionValidation = await validateAndRefreshSession();
    if (!sessionValidation.success) {
      throw new Error(sessionValidation.error);
    }
    
    // API calls proceed with valid session
    const result = await timeTrackingService.getTimeTrackingSummary(...);
    // ...
  } catch (error) {
    console.error('Error:', error);
    // Show error to user
    setFetchError(error.message || 'Failed to load data. Please try refreshing.');
  } finally {
    if (!silent) setLoading(false);
  }
}, [dependencies]);
```

## Error Banner UI

The error banner appears at the top of the component when a fetch fails:

```
┌──────────────────────────────────────────────────┐
│ ⚠  Error                                      × │
│    Failed to load dashboard data. Please try    │
│    refreshing the page.                         │
│    [Try Again]                                  │
└──────────────────────────────────────────────────┘
```

**Features**:
- Clear error icon and title
- User-friendly error message
- "Try Again" button that:
  - Clears the error state
  - Retries the fetch with session validation
- Dismiss button (×) to close the banner
- Responsive design for mobile and desktop
- Theme-aware colors (red tones for dark/light mode)

## Session Validation Details

The session helper performs these checks:

1. **Session Exists**: Verifies a valid session is present
2. **Expiry Check**: Calculates time until session expires
3. **Auto-Refresh**: If session expires in < 5 minutes, automatically refreshes it
4. **Graceful Degradation**: If refresh fails, allows the request to continue (API will fail with a proper error)

**Console Logging**:
- `✅ Session valid, expires in: X minutes`
- `🔄 Session expiring soon, refreshing...`
- `✅ Session refreshed successfully`
- `⚠️ Session refresh failed but will attempt request anyway`
- `❌ No active session` or `❌ Session error`

## Benefits

1. **User Visibility**: Users now see when data fetching fails instead of silently failing
2. **Easy Recovery**: "Try Again" button allows instant retry without page refresh
3. **Session Management**: Automatic session refresh prevents expired-session errors
4. **Better Debugging**: Console logs show session state for developers
5. **Consistent UX**: Same error handling pattern across dashboard, reports, and time clock components
6. **Graceful Degradation**: Even if session refresh fails, the error is surfaced to users

## Testing Recommendations

1. **Idle Scenario**: Leave the app idle for 10+ minutes, then switch components
2. **Session Expiry**: Wait for session to expire (check Supabase auth settings), then navigate
3. **Network Issues**: Disable network briefly, then re-enable and try fetching data
4. **Manual Refresh**: Test the "Try Again" button in error banners

## Future Enhancements

- Add retry logic with exponential backoff for transient failures
- Implement optimistic updates to show cached data while fetching
- Add network status indicator in the UI
- Consider implementing a global error boundary for uncaught errors
- Add telemetry/logging to track fetch failure rates in production

## Files Changed

1. `src/utils/sessionHelper.js` - **NEW**: Session validation utility
2. `src/components/dashboard.jsx` - Error state + session validation
3. `src/components/reports.jsx` - Error state + session validation
4. `src/components/timeClockEntry.jsx` - Error state + session validation

## Related Issues

- Fixes: "Data fails to fetch after idle or staying on one component"
- Improves: Silent error handling across the application
- Enhances: Session management and auto-refresh
