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

### 2. Created Retry Helper Utility (`src/utils/retryHelper.js`)

A robust retry mechanism with exponential backoff that:
- Automatically retries failed API calls
- Uses exponential backoff (1s, 2s, 4s, etc.)
- Identifies retryable errors (network, timeout, 5xx, rate limiting)
- Limits maximum retry attempts (default: 2)
- Provides retry progress logging

**Key Functions**:
- `retryWithBackoff(fn, options)`: Wraps function with retry logic
- `isRetryableError(error)`: Determines if error should trigger retry
- `withRetryAndSession(fetchFn, validateSession)`: Combined wrapper

**Retryable Errors**:
- Network failures (timeout, fetch failed, aborted)
- Server errors (HTTP 5xx)
- Rate limiting (HTTP 429)
- Temporary session errors

### 3. Force Logout on Session Failure

When retries are exhausted and the error is session-related:
- Detects authentication/session errors (containing "session", "authentication", or "no active session")
- Displays "Your session has expired. Redirecting to login..." message
- Automatically logs out the user after 2 seconds
- Redirects to login page

This ensures users don't remain stuck with invalid sessions and provides a clear path to re-authenticate.

### 4. Added Error State UI to Components

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

### 4. Enhanced Fetch Functions with Session Validation and Retry Logic

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
    
    // Wrap with retry mechanism
    await retryWithBackoff(async () => {
      // API calls proceed with valid session
      const result = await timeTrackingService.getTimeTrackingSummary(...);
      // ...
    }, {
      maxRetries: 2,
      shouldRetry: isRetryableError,
      onRetry: (error, attempt, delay) => {
        console.log(`🔄 Dashboard: Retrying fetch (${attempt}/2) after ${delay}ms...`);
      }
    });
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
4. **Automatic Retry**: Network/timeout errors automatically retry with exponential backoff
5. **Smart Error Detection**: Only retries errors that are likely to succeed on retry
6. **Better Debugging**: Console logs show session state and retry attempts for developers
7. **Consistent UX**: Same error handling and retry pattern across dashboard, reports, and time clock components
8. **Graceful Degradation**: Even if session refresh or retry fails, the error is surfaced to users
9. **Reduced User Friction**: Transient failures resolve automatically without user intervention

## Retry Strategy

The retry mechanism uses exponential backoff:
- **Attempt 1**: Immediate (0ms delay)
- **Attempt 2**: 1 second delay
- **Attempt 3**: 2 seconds delay
- **Max retries**: 2 (total of 3 attempts)
- **Max delay**: 10 seconds

**Example Console Output**:
```
🔄 Retry attempt 1/2 after 1000ms: Network request failed
🔄 Dashboard: Retrying fetch (1/2) after 1000ms...
✅ Session valid, expires in: 45 minutes
```

## Testing Recommendations

1. **Idle Scenario**: Leave the app idle for 10+ minutes, then switch components
   - Expected: Session refreshes automatically, data loads successfully
   - If fails: Automatic retry with exponential backoff
   - Final fallback: Error banner with "Try Again" button

2. **Session Expiry**: Wait for session to expire (check Supabase auth settings), then navigate
   - Expected: Session validation catches expiry and refreshes
   - Fallback: Clear error message prompting re-login

3. **Network Issues**: 
   - Test 1: Disable network briefly, then re-enable
   - Expected: Automatic retry after 1s, 2s delays until success
   - Test 2: Keep network disabled
   - Expected: All retries exhausted, error banner shown

4. **Manual Retry**: Test the "Try Again" button in error banners
   - Expected: Clears error, validates session, retries fetch

5. **Server Errors**: Simulate 5xx server errors
   - Expected: Automatic retry with backoff

## Future Enhancements

- ~~Add retry logic with exponential backoff for transient failures~~ ✅ **COMPLETED**
- Implement optimistic updates to show cached data while fetching
- Add network status indicator in the UI
- Consider implementing a global error boundary for uncaught errors
- Add telemetry/logging to track fetch failure rates in production
- Fine-tune retry delays based on production data
- Add retry count to error messages ("Failed after 3 attempts")

## Files Changed

1. `src/utils/sessionHelper.js` - **UPDATED**: Better handling of refresh failures with background hook fallback
2. `src/utils/retryHelper.js` - **NEW**: Retry logic with exponential backoff
3. `src/hooks/useSessionKeepAlive.js` - **NEW**: Proactive session refresh (Google/YouTube style)
4. `src/App.jsx` - **UPDATED**: Integrated session keep-alive hook
5. `src/components/dashboard.jsx` - Error state + session validation + retry logic + force logout
6. `src/components/reports.jsx` - Error state + session validation + retry logic + force logout
7. `src/components/timeClockEntry.jsx` - Error state + session validation + retry logic + force logout
8. `src/components/timeTracking.jsx` - Error state + session validation + retry logic + force logout

## Session Keep-Alive Features

### Proactive Refresh (New ✨)
- Checks session expiry every 5 minutes
- Automatically refreshes tokens 10 minutes before expiry
- Runs in background - user never sees interruption
- **Like Google/YouTube**: Refresh happens *before* expiry, not reactively

### Activity-Based Refresh (New ✨)
- Monitors user activity (clicks, keypress, scroll, mouse)
- Refreshes session if user is active and token expires within 15 minutes
- Debounced to avoid excessive checks
- Ensures active users never get logged out

### How It Works Together
1. **Background Interval**: Checks every 5 minutes, refreshes if expiring within 10 minutes
2. **User Activity**: On activity, checks if expiring within 15 minutes, refreshes if needed
3. **Reactive Validation**: On API calls, validates session and refreshes if needed
4. **Retry Logic**: If request fails, retries with exponential backoff
5. **Force Logout**: If all retries fail with session error, logs out user

This triple-layer approach ensures maximum uptime while maintaining security.

## User Flow

**Successful Flow**:
1. User is idle or switches components
2. Session validation runs → Session valid or auto-refreshed
3. Data fetches successfully → User sees fresh data

**Network Error Flow**:
1. Network request fails
2. Automatic retry after 1s → Success
3. User sees fresh data (seamless)

**Session Expired Flow**:
1. Session validation detects expiry
2. Auto-refresh session → Success
3. Data fetches successfully → User sees fresh data

**Complete Session Failure Flow** (New):
1. Session validation fails
2. Retry attempt 1 → Still fails
3. Retry attempt 2 → Still fails
4. Error detected as session-related
5. Display: "Your session has expired. Redirecting to login..."
6. Wait 2 seconds (so user can read message)
7. Call `logout()` to clear auth state
8. Redirect to login page
9. User can re-authenticate

This ensures no user gets stuck with an invalid session and provides a clear recovery path.

## Related Issues

- Fixes: "Data fails to fetch after idle or staying on one component"
- Improves: Silent error handling across the application
- Enhances: Session management and auto-refresh
