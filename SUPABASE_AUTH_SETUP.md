# Supabase Authentication Setup for Password Reset

## Critical Configuration Steps

### 1. Enable Implicit Flow in Supabase Dashboard

1. Go to: **Supabase Dashboard** → **Authentication** → **URL Configuration**
2. Find **"Flow Type"** setting
3. Change from `pkce` to **`implicit`**
4. Click **Save**

### 2. Configure Site URL

1. In **URL Configuration** section
2. Set **Site URL** to: `https://hr.icue.vn`
   - ⚠️ NO trailing slash
   - ⚠️ NO path like `/reset-password`

### 3. Configure Redirect URLs

1. In **Redirect URLs** section, add:
   ```
   https://hr.icue.vn/**
   ```
   - The `**` wildcard allows any path

### 4. Email Template Configuration

1. Go to: **Authentication** → **Email Templates** → **Reset Password**
2. Make sure the template uses: `{{ .ConfirmationURL }}`
3. Example template:
   ```html
   <h2>Reset Password</h2>
   <p>Click the link below to reset your password:</p>
   <p><a href="{{ .ConfirmationURL }}">Reset Password</a></p>
   <p>This link expires in 1 hour.</p>
   ```

### 5. Test the Flow

1. **Restart your dev server** after making changes
2. Request a **NEW password reset email** (old links won't work)
3. Check the new email link format - should look like:
   ```
   https://hr.icue.vn/reset-password#access_token=...&refresh_token=...&type=recovery
   ```
4. Click the link within 1 hour

### Troubleshooting

**If you see `?code=...` in the URL:**
- Supabase is still using PKCE flow
- Double-check dashboard settings and save again

**If you see `#error=access_denied&error_code=otp_expired`:**
- The link is expired (> 1 hour old)
- Request a fresh reset email

**If you see "Auth session missing":**
- Open browser console (F12) to see detailed logs
- Check if tokens are in the URL hash
- Verify `detectSessionInUrl: true` in supabaseClient.js

### Current Frontend Configuration

✅ Frontend is configured for implicit flow
✅ Supabase client set to `flowType: 'implicit'`
✅ ResetPassword component handles hash-based tokens
✅ detectSessionInUrl enabled to auto-process tokens

**Next Step:** Configure Supabase Dashboard to match frontend settings!
