# Forgot Password Feature Documentation

## Overview
The forgot password feature allows users to reset their password by receiving a password reset link via email. This feature is fully integrated with Supabase authentication and includes multi-language support.

## Features Implemented ✅

### 1. Backend Functionality (AuthContext.jsx)

**forgotPassword(email)**
- Sends password reset email via Supabase
- Returns success/error response with user-friendly messages
- Handles common errors:
  - User not found
  - Rate limiting
  - Network errors
- Configures redirect URL to `/reset-password` page

**resetPassword(newPassword)**
- Updates user password with new password
- Called on the reset-password page after user clicks email link
- Validates password strength
- Ensures new password is different from old password

### 2. Frontend UI (login.jsx)

**Forgot Password Button**
- Located below password field on login page
- Clickable link: "Forgot password?"
- Pre-fills email if user already entered it in login form

**Forgot Password Modal**
- Clean, responsive modal design
- Email input field with validation
- Real-time error clearing
- Success/error message display
- Loading state with spinner
- Auto-closes after 3 seconds on success
- Close button (X) in top-right corner

**User Experience Flow**
1. User clicks "Forgot password?" link
2. Modal opens with email input
3. User enters email and clicks "Send Reset Link"
4. Loading spinner shows during request
5. Success message appears: "Password reset email sent. Please check your inbox."
6. Modal auto-closes after 3 seconds
7. User checks email and clicks reset link
8. User is redirected to `/reset-password` page
9. User enters new password
10. Password is updated

### 3. Translations (All 9 Languages)

Added complete translations to:
- ✅ English (en.js)
- ✅ Vietnamese (vn.js)
- ✅ German (de.js)
- ✅ Spanish (es.js)
- ✅ French (fr.js)
- ✅ Japanese (jp.js)
- ✅ Korean (kr.js)
- ✅ Russian (ru.js)
- ✅ Thai (th.js)

**Translation Keys Added:**
```javascript
login: {
  forgotPassword: 'Forgot password?',
  forgotPassword: {
    title: 'Reset Password',
    description: 'Enter your email address...',
    emailLabel: 'Email Address',
    emailPlaceholder: 'you@example.com',
    emailRequired: 'Email is required',
    emailInvalid: 'Please enter a valid email',
    sendReset: 'Send Reset Link',
    cancel: 'Cancel',
    success: 'Password reset email sent...',
    error: 'Failed to send reset email...',
    noAccount: 'No account found with this email',
    rateLimitError: 'Too many requests...',
    networkError: 'Network error...'
  }
}
```

## How It Works

### Email Sending (Supabase)
```javascript
const { error } = await supabase.auth.resetPasswordForEmail(email, {
  redirectTo: `${window.location.origin}/reset-password`
});
```

### Password Reset (Supabase)
```javascript
const { error } = await supabase.auth.updateUser({
  password: newPassword
});
```

## Configuration Required

### 1. Supabase Email Settings

**SMTP Configuration** (in Supabase Dashboard):
1. Go to **Project Settings** → **Authentication** → **SMTP Settings**
2. Configure your SMTP provider or use Supabase's default
3. Verify sender email address

**Email Templates** (optional but recommended):
1. Go to **Authentication** → **Email Templates**
2. Customize "Reset Password" template
3. Available variables:
   - `{{ .ConfirmationURL }}` - Reset link
   - `{{ .Token }}` - Reset token
   - `{{ .Email }}` - User email
   - `{{ .SiteURL }}` - Your site URL

### 2. Create Reset Password Page

You'll need to create a `/reset-password` page that:
1. Detects the token from URL parameters
2. Shows a form for new password input
3. Calls `resetPassword(newPassword)` from AuthContext
4. Redirects to login on success

**Example Reset Password Component:**
```jsx
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';

const ResetPassword = () => {
  const { resetPassword } = useAuth();
  const navigate = useNavigate();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    
    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    
    setLoading(true);
    const result = await resetPassword(newPassword);
    setLoading(false);
    
    if (result.success) {
      alert('Password reset successfully!');
      navigate('/login');
    } else {
      setError(result.error);
    }
  };

  return (
    <div>
      <h1>Reset Your Password</h1>
      <form onSubmit={handleSubmit}>
        <input
          type="password"
          placeholder="New Password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
        />
        <input
          type="password"
          placeholder="Confirm Password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
        />
        {error && <p className="error">{error}</p>}
        <button type="submit" disabled={loading}>
          {loading ? 'Resetting...' : 'Reset Password'}
        </button>
      </form>
    </div>
  );
};
```

### 3. Add Route to App.jsx

```jsx
import ResetPassword from './components/ResetPassword';

// In your Routes
<Route path="/reset-password" element={<ResetPassword />} />
```

## Error Handling

### Common Errors and Solutions

**"No account found with this email address"**
- User entered wrong email
- User hasn't registered yet
- Suggest: Check spelling or sign up

**"Too many requests. Please try again later"**
- Rate limiting triggered (Supabase default: 4 requests per hour)
- User should wait before trying again

**"Network error. Please check your connection"**
- Internet connection issue
- Supabase service might be down
- User should check connection

**"Failed to send reset email"**
- SMTP not configured properly
- Email service is down
- Check Supabase logs for details

## Testing the Feature

### Local Testing
1. Start your dev server
2. Navigate to login page
3. Click "Forgot password?"
4. Enter a valid email from your `hr_users` table
5. Click "Send Reset Link"
6. Check email inbox for reset link
7. Click link (should redirect to `/reset-password`)
8. Enter new password
9. Login with new password

### Email Testing Tips
- Use a real email address for testing
- Check spam folder if email doesn't arrive
- Supabase default SMTP may have delays
- Consider using Mailgun, SendGrid, or AWS SES for production

## Security Features

1. **Rate Limiting**: Supabase limits reset requests (4 per hour by default)
2. **Token Expiration**: Reset tokens expire after 1 hour
3. **One-Time Use**: Each reset token can only be used once
4. **Password Validation**: Enforces minimum password requirements
5. **PKCE Flow**: Uses secure PKCE authentication flow

## UI/UX Features

1. **Pre-filled Email**: Modal pre-fills email if user entered it in login form
2. **Auto-close**: Success modal closes after 3 seconds
3. **Loading States**: Shows spinner during email sending
4. **Real-time Validation**: Email validation on input
5. **Error Clearing**: Errors clear when user types
6. **Responsive Design**: Works on mobile, tablet, desktop
7. **Dark Mode Support**: Fully supports light/dark themes
8. **Accessible**: Proper labels, focus states, keyboard navigation

## Console Logs

**Successful Flow:**
```
📧 Sending password reset email to: user@example.com
✅ Password reset email sent successfully
```

**Failed Flow:**
```
📧 Sending password reset email to: invalid@example.com
❌ Forgot password error: User not found
```

## Next Steps

1. **Create `/reset-password` page** - Currently redirects there but page doesn't exist yet
2. **Configure Supabase SMTP** - Set up production email provider
3. **Customize email template** - Brand the password reset email
4. **Add rate limiting UI** - Show countdown timer if rate limited
5. **Add password strength indicator** - Visual feedback for password strength

## Files Modified

- ✅ `src/contexts/AuthContext.jsx` - Added forgotPassword & resetPassword functions
- ✅ `src/components/login.jsx` - Added modal UI and handlers
- ✅ `src/translations/en.js` - Added English translations
- ✅ `src/translations/vn.js` - Added Vietnamese translations
- ✅ `src/translations/de.js` - Added German translations
- ✅ `src/translations/es.js` - Added Spanish translations
- ✅ `src/translations/fr.js` - Added French translations
- ✅ `src/translations/jp.js` - Added Japanese translations
- ✅ `src/translations/kr.js` - Added Korean translations
- ✅ `src/translations/ru.js` - Added Russian translations
- ✅ `src/translations/th.js` - Added Thai translations

---

**Status**: ✅ Feature Complete (except `/reset-password` page)
**Last Updated**: October 29, 2025
