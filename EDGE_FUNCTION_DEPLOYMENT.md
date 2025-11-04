# Admin Password Reset - Edge Function Deployment Guide

## What Changed

The admin password reset feature now directly updates passwords instead of sending reset emails. This requires a Supabase Edge Function with service role access.

## Files Created

1. `/supabase/functions/admin-reset-password/index.ts` - Edge Function that handles password resets with service role privileges

## Deployment Steps

### Option 1: Deploy via Supabase CLI (Recommended)

1. **Install Supabase CLI** (if not already installed):
   ```bash
   brew install supabase/tap/supabase
   ```

2. **Login to Supabase**:
   ```bash
   supabase login
   ```

3. **Link your project** (first time only):
   ```bash
   supabase link --project-ref YOUR_PROJECT_REF
   ```
   
   Find your project ref in your Supabase dashboard URL: `https://supabase.com/dashboard/project/YOUR_PROJECT_REF`

4. **Deploy the function**:
   ```bash
   supabase functions deploy admin-reset-password
   ```

### Option 2: Deploy via Supabase Dashboard

1. Go to your Supabase Dashboard
2. Navigate to **Edge Functions** in the left sidebar
3. Click **Create a new function**
4. Name it: `admin-reset-password`
5. Copy the entire content from `/supabase/functions/admin-reset-password/index.ts`
6. Paste it into the editor
7. Click **Deploy**

## How It Works

1. **Admin selects a user** and enters a new password
2. **Frontend calls the Edge Function** with the user ID and new password
3. **Edge Function verifies** the requesting user is an admin
4. **Service role updates** the password directly in Supabase auth
5. **Success message** is displayed and window closes after 3 seconds

## Security

- ✅ Only admins can call this function (verified server-side)
- ✅ Uses service role key (stored securely in Supabase)
- ✅ Password must be at least 6 characters
- ✅ No email sent (direct password change)

## Testing

After deployment:

1. Log in as an admin user
2. Go to **Control Panel** → **Systemsteuerung**
3. Click **Reset Other Employee Password**
4. Select a user and enter a new password
5. Click **Password zurücksetzen**
6. You should see: "Password successfully reset for [User Name]!"

## Troubleshooting

### "Function not found" error
- Make sure you deployed the function using one of the methods above
- Check that the function name matches exactly: `admin-reset-password`

### "Unauthorized: Admin access required"
- Make sure you're logged in as a user with `role = 'admin'` in the `hr_users` table

### "No authorization header"
- Make sure you're logged in and have an active session
- Try logging out and logging back in

## Environment Variables (Auto-configured)

The Edge Function uses these environment variables (automatically set by Supabase):
- `SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Service role key with admin privileges
- `SUPABASE_ANON_KEY` - Public anonymous key

No manual configuration needed!
