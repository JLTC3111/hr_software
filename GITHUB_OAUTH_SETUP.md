# GitHub OAuth Login Setup Guide

## Overview
This guide explains how to ensure GitHub OAuth login works correctly in your HR Management System.

## Recent Fix Applied ✅

### Issue
When users clicked "Continue with GitHub", the OAuth flow would initiate but the session wouldn't persist after GitHub redirected back to the application.

### Root Cause
The `loginWithGithub()` function wasn't setting the storage type before initiating the OAuth flow. When GitHub redirects back, Supabase needs to know where to store the session token (localStorage vs sessionStorage).

### Solution
Updated `AuthContext.jsx` to explicitly set `customStorage` to use `localStorage` before initiating OAuth:

```javascript
const loginWithGithub = async () => {
  try {
    // CRITICAL: Ensure we use localStorage for OAuth so session persists after redirect
    console.log('🔐 GitHub OAuth: Setting storage to localStorage for session persistence');
    customStorage.setStorage(localStorage);
    
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'github',
      options: {
        redirectTo: `${window.location.origin}/time-clock`,
        skipBrowserRedirect: false
      }
    });
    
    // ... rest of the code
  }
}
```

## Supabase Configuration Required

For GitHub OAuth to work, you must configure it in your Supabase project:

### Step 1: Enable GitHub Provider in Supabase
1. Go to your Supabase Dashboard: https://app.supabase.com
2. Select your project
3. Navigate to **Authentication** → **Providers**
4. Find **GitHub** in the list of providers
5. Toggle it to **Enabled**

### Step 2: Create GitHub OAuth App
1. Go to GitHub Settings: https://github.com/settings/developers
2. Click **OAuth Apps** → **New OAuth App**
3. Fill in the details:
   - **Application name**: HR Management System (or your app name)
   - **Homepage URL**: Your app URL (e.g., `https://yourdomain.com` or `http://localhost:5173` for local dev)
   - **Authorization callback URL**: Copy this from Supabase (see step 3)
4. Click **Register application**
5. Copy the **Client ID** and **Client Secret**

### Step 3: Configure Supabase with GitHub Credentials
1. Back in Supabase Dashboard → Authentication → Providers → GitHub
2. Paste your **Client ID** from GitHub
3. Paste your **Client Secret** from GitHub
4. Copy the **Callback URL** shown in Supabase (format: `https://[your-project-ref].supabase.co/auth/v1/callback`)
5. Go back to GitHub OAuth App settings and paste this as the **Authorization callback URL**
6. Click **Save** in Supabase

### Step 4: Configure Redirect URLs
In Supabase Dashboard → Authentication → URL Configuration:
- Add your site URL to **Site URL** (e.g., `https://yourdomain.com`)
- Add authorized redirect URLs:
  - Production: `https://yourdomain.com/**`
  - Local dev: `http://localhost:5173/**`

## How OAuth Flow Works

### 1. User Clicks "Continue with GitHub"
```
User clicks button → handleGithubLogin() → loginWithGithub()
```

### 2. Storage is Set
```javascript
customStorage.setStorage(localStorage); // Ensures session persists
```

### 3. OAuth Redirect Initiated
```javascript
supabase.auth.signInWithOAuth({
  provider: 'github',
  options: {
    redirectTo: `${window.location.origin}/time-clock`
  }
});
// Browser redirects to GitHub
```

### 4. User Authorizes on GitHub
```
User sees: "HR Management System wants to access your GitHub account"
User clicks "Authorize"
```

### 5. GitHub Redirects Back
```
GitHub → Supabase callback URL → Your app (/time-clock)
```

### 6. Session Detection
```javascript
// In AuthContext.jsx - useEffect with onAuthStateChange
supabase.auth.onAuthStateChange((event, session) => {
  if (event === 'SIGNED_IN' && session) {
    // Fetch user profile from hr_users table
    // Set isAuthenticated = true
    // User is now logged in
  }
});
```

### 7. Auto Profile Creation
If the GitHub user doesn't exist in `hr_users` table:
```javascript
createUserProfile(userId) {
  // Checks for matching employee by email
  // Creates hr_users record
  // Links to employee if found
  // Sets default role to 'employee'
}
```

## Testing GitHub OAuth

### Local Development Testing
1. Start your dev server: `npm run dev`
2. Open browser: `http://localhost:5173`
3. Click **"Continue with GitHub"**
4. You should see loading spinner: "Redirecting to GitHub..."
5. GitHub authorization page should open
6. Click "Authorize"
7. Should redirect back to `/time-clock` logged in

### Troubleshooting

#### Issue: "Failed to login with GitHub"
**Check:**
- Is GitHub provider enabled in Supabase?
- Are Client ID and Client Secret correct?
- Is the callback URL properly configured?

#### Issue: Redirects to GitHub but comes back logged out
**Check:**
- Console logs for any errors
- Check if `detectSessionInUrl: true` is set in supabaseClient.js (✅ already configured)
- Verify redirect URLs are whitelisted in Supabase

#### Issue: "Please allow popups for this site"
**Solution:**
- This is browser blocking popups
- Ensure user clicks the button directly (not programmatic click)
- OAuth should use redirect, not popup (✅ our config uses redirect)

#### Issue: "GitHub login is not enabled"
**Solution:**
- Enable GitHub provider in Supabase Dashboard
- Save configuration

#### Issue: Network error
**Check:**
- Internet connection
- Supabase project is not paused
- API keys are valid

## Console Logs to Watch For

### Successful OAuth Flow
```
🔐 GitHub OAuth: Setting storage to localStorage for session persistence
✅ GitHub OAuth flow initiated successfully
[Browser redirects to GitHub]
[User authorizes]
[Browser redirects back]
🔔 Auth event: SIGNED_IN
🔐 User signed in
Fetching user profile for ID: [user-id]
✅ Profile loaded successfully, setting loading = false
✅ All conditions met - Redirecting to /time-clock
```

### Failed OAuth Flow
```
❌ GitHub login error: [error message]
```

## Security Notes

1. **PKCE Flow**: OAuth uses PKCE (Proof Key for Code Exchange) for enhanced security
   ```javascript
   flowType: 'pkce' // in supabaseClient.js
   ```

2. **Session Persistence**: OAuth always uses localStorage for persistent sessions
   - Regular email/password login respects "Remember Me" checkbox
   - OAuth login assumes user wants to stay logged in

3. **Auto-Linking**: GitHub users are automatically linked to existing employee records by email
   - If employee exists with same email → linked automatically
   - If no employee exists → standalone user created with 'employee' role

## User Experience

### First Time GitHub Login
1. User clicks "Continue with GitHub"
2. Redirected to GitHub authorization
3. Authorizes the app
4. Redirected back to app
5. Profile created automatically
6. Logged in and redirected to `/time-clock`

### Subsequent GitHub Logins
1. User clicks "Continue with GitHub"
2. Redirected to GitHub (may auto-authorize if previously authorized)
3. Redirected back immediately
4. Logged in and redirected to `/time-clock`

## Code Files Modified

- ✅ `/src/contexts/AuthContext.jsx` - Added `customStorage.setStorage(localStorage)` to `loginWithGithub()`
- ✅ `/src/config/supabaseClient.js` - Already configured with `detectSessionInUrl: true` and `flowType: 'pkce'`
- ✅ `/src/components/login.jsx` - Already has proper UI with loading states

## Next Steps

1. **Verify Supabase Configuration**:
   - [ ] GitHub provider enabled
   - [ ] Client ID and Secret configured
   - [ ] Callback URL matches
   - [ ] Redirect URLs whitelisted

2. **Test OAuth Flow**:
   - [ ] Click "Continue with GitHub" button
   - [ ] Verify redirect to GitHub
   - [ ] Authorize the app
   - [ ] Verify redirect back to app
   - [ ] Check if logged in successfully
   - [ ] Verify user profile created in hr_users table

3. **Production Deployment**:
   - [ ] Update GitHub OAuth App with production URLs
   - [ ] Update Supabase redirect URLs with production domain
   - [ ] Test OAuth flow in production environment

## Additional Resources

- [Supabase Auth with GitHub](https://supabase.com/docs/guides/auth/social-login/auth-github)
- [GitHub OAuth Apps Documentation](https://docs.github.com/en/developers/apps/building-oauth-apps)
- [PKCE Flow Explanation](https://oauth.net/2/pkce/)

---

**Status**: ✅ Code updated and ready for testing
**Last Updated**: October 29, 2025
