# Supabase Refresh Token Configuration Guide

## Setting Refresh Token Lifetime in Supabase

To keep users logged in longer (like Google/YouTube), you need to configure the refresh token lifetime in your Supabase project.

### Method 1: Via Supabase Dashboard (Recommended)

1. **Navigate to Authentication Settings**
   - Go to your Supabase project dashboard: https://app.supabase.com
   - Click on your project
   - Go to **Authentication** → **Settings** (or **Configuration**)

2. **Find JWT Settings**
   - Scroll down to **JWT Settings** or **Auth Settings**
   - Look for **"JWT expiry limit"** or **"Refresh token lifetime"**

3. **Configure Token Lifetimes**
   ```
   JWT Expiry:           3600 seconds (1 hour) - Keep short for security
   Refresh Token TTL:    2592000 seconds (30 days) - Increase this
   ```

4. **Recommended Settings**
   - **Access Token (JWT)**: 3600s (1 hour) - Short-lived for security
   - **Refresh Token**: 
     - 30 days: `2592000` seconds
     - 60 days: `5184000` seconds  
     - 90 days: `7776000` seconds
   
5. **Click Save** to apply changes

### Method 2: Via SQL (If Dashboard Doesn't Show Option)

If your Supabase version doesn't have a UI for this, run this SQL in the SQL Editor:

```sql
-- Check current settings
SELECT * FROM auth.config;

-- Update refresh token lifetime to 30 days
UPDATE auth.config 
SET refresh_token_lifetime = 2592000 
WHERE id = 1;

-- Or 90 days
UPDATE auth.config 
SET refresh_token_lifetime = 7776000 
WHERE id = 1;
```

### Method 3: Environment Variables (Self-Hosted Only)

If you're self-hosting Supabase, add to your `.env` file:

```bash
# Refresh token lifetime in seconds
GOTRUE_JWT_EXP=3600                    # Access token: 1 hour
GOTRUE_REFRESH_TOKEN_LIFETIME=2592000  # Refresh token: 30 days

# Or for 90 days
GOTRUE_REFRESH_TOKEN_LIFETIME=7776000
```

## Verify Configuration

After making changes, verify by logging in and checking the token:

```javascript
// In browser console or your app
const { data: { session } } = await supabase.auth.getSession();
console.log('Expires at:', new Date(session.expires_at * 1000));
console.log('Time until expiry:', Math.round((session.expires_at * 1000 - Date.now()) / 60000), 'minutes');
```

## Best Practices

### Security vs Convenience Trade-offs

**Access Token (JWT)**:
- **Keep Short**: 15-60 minutes
- Why: Compromised tokens expire quickly
- Refreshed automatically by the background hook

**Refresh Token**:
- **Can Be Long**: 30-90 days
- Why: Keeps users logged in across sessions
- Stored securely by Supabase in httpOnly cookies
- Our `useSessionKeepAlive` hook refreshes it proactively

### Recommended Configuration

```
Access Token:      3600 seconds (1 hour)
Refresh Token:     2592000 seconds (30 days)
Proactive Refresh: 10 minutes before expiry (handled by our hook)
```

This gives you:
- ✅ Users stay logged in for 30 days
- ✅ Tokens refresh automatically in the background
- ✅ Short-lived access tokens for security
- ✅ Smooth experience like Google/YouTube

## Testing Your Configuration

1. **Log in to your app**
2. **Open browser console**
3. **Check token expiry**:
   ```javascript
   const { data: { session } } = await supabase.auth.getSession();
   const expiresIn = (session.expires_at * 1000 - Date.now()) / 1000 / 60 / 60;
   console.log('Access token expires in:', expiresIn.toFixed(2), 'hours');
   ```

4. **Wait and watch console logs**:
   - You should see: `"🔄 Proactively refreshing session (expires in X minutes)..."`
   - Every 5 minutes the app checks and refreshes if needed

5. **Close browser and reopen**:
   - User should still be logged in (refresh token persists)
   - Session automatically restored

## Troubleshooting

### Users Still Getting Logged Out?

1. **Check if refresh token is being set**:
   ```javascript
   const { data } = await supabase.auth.getSession();
   console.log('Has refresh token:', !!data.session?.refresh_token);
   ```

2. **Check storage**:
   - Open DevTools → Application → Cookies
   - Look for `sb-<project-id>-auth-token`
   - Should persist across browser closes

3. **Check console for errors**:
   - Look for "Failed to refresh session" messages
   - Check network tab for auth API calls

### Refresh Not Working?

- Ensure `persistSession: true` in supabaseClient.js (already configured)
- Check if `autoRefreshToken: true` (already configured)
- Verify Supabase project has auth enabled
- Check browser isn't clearing cookies on close

## Migration Notes

If you change the refresh token lifetime:
- **Existing sessions**: Will keep their old expiry time
- **New logins**: Will use the new lifetime
- **Best practice**: Notify users to log out and back in for longer sessions

## Additional Security

Even with long refresh tokens, you can add:

1. **Detect suspicious activity**:
   ```javascript
   // Log unusual login patterns
   if (newLocationDifferentFromUsual) {
     await sendVerificationEmail();
   }
   ```

2. **Force re-authentication for sensitive actions**:
   ```javascript
   // Before critical operations
   if (lastAuthTimeMoreThan30Minutes) {
     await promptForPassword();
   }
   ```

3. **Revoke refresh tokens on password change**:
   - Supabase does this automatically
   - All other sessions are invalidated

## Summary

With the new `useSessionKeepAlive` hook + longer refresh tokens:
- ✅ Users stay logged in for weeks/months
- ✅ Tokens refresh every 5 minutes in background
- ✅ Activity-based refresh on user interaction
- ✅ Seamless experience like major platforms
- ✅ Still secure with short access tokens

Set refresh token to **30-90 days** in Supabase dashboard for best results.
