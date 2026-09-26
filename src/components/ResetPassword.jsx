import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';
import { Lock, Eye, EyeOff, CheckCircle, AlertCircle } from 'lucide-react';
import { supabase } from '../config/supabaseClient';
import ThemeToggle from './themeToggle';
import LanguageSelector from './LanguageSelector';
import { Blueprint } from './ui/industry.jsx';
import { getIndustry, solidButtonFill, DISPLAY, BODY } from '../theme/industry.js';
import { ShimmerButton } from './ui/shimmer-button';
import { cn } from '@/lib/utils';

const ResetPassword = () => {
  const navigate = useNavigate();
  const { resetPassword } = useAuth();
  const { isDarkMode } = useTheme();
  const ind = useMemo(() => getIndustry(isDarkMode), [isDarkMode]);
  const buttonFill = solidButtonFill(ind);
  const loginFieldFill = isDarkMode ? '#374151' : '#ffffff';
  const loginFilledCss = `
                    transition: background-color 0s !important;
                    background-color: ${loginFieldFill} !important;
                    background-image: none !important;
                    -webkit-box-shadow: 0 0 0 1000px ${loginFieldFill} inset !important;
                    box-shadow: 0 0 0 1000px ${loginFieldFill} inset !important;
                    -webkit-text-fill-color: ${ind.ink} !important;
                    caret-color: ${ind.ink} !important;
  `;
  // The context publishes `currentLanguage`; destructuring `language` left it
  // undefined, so the picker never marked the active row and the flag never drew.
  const { t } = useLanguage();

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [hasValidSession, setHasValidSession] = useState(false);

  // Check if we have a valid session (user clicked the reset link)
  useEffect(() => {
    let mounted = true;
    
    const checkSession = async () => {
      try {
        console.log('🔍 Starting session check...');
        
        const devMode = new URLSearchParams(window.location.search).get('dev');

        // Allow dev mode on localhost for UI testing
        if (devMode === 'true' && window.location.hostname === 'localhost') {
          console.log('⚠️ DEV MODE: Skipping session validation (UI testing only)');
          setHasValidSession(true);
          setSessionLoading(false);
          return;
        }

        // getSession waits for the SDK to finish processing the recovery URL.
        const { data: { session }, error } = await supabase.auth.getSession();
        
        console.log('Session check result:', {
          hasSession: !!session,
          hasError: !!error,
          userEmail: session?.user?.email,
          error: error?.message
        });

        if (!mounted) return;

        if (error) {
          console.error('❌ Session error:', error);
          setError(t('resetPassword.invalidLink', 'Invalid or expired reset link. Please request a new password reset.'));
          setHasValidSession(false);
        } else if (session) {
          console.log('✅ Valid recovery session for user:', session.user?.email);
          setHasValidSession(true);
        } else {
          console.error('❌ No session found');
          setError(t('resetPassword.invalidLink', 'Invalid or expired reset link. Please request a new password reset.'));
          setHasValidSession(false);
        }
      } catch (err) {
        console.error('❌ Error checking session:', err);
        if (mounted) {
          setError(t('resetPassword.error', 'An error occurred. Please try again.'));
          setHasValidSession(false);
        }
      } finally {
        if (mounted) {
          setSessionLoading(false);
        }
      }
    };

    checkSession();

    return () => {
      mounted = false;
    };
  }, [t]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    
    // Validation
    if (!newPassword || !confirmPassword) {
      setError(t('resetPassword.allFieldsRequired', 'All fields are required'));
      return;
    }

    if (newPassword.length < 6) {
      setError(t('resetPassword.passwordTooShort', 'Password must be at least 6 characters'));
      return;
    }

    if (newPassword !== confirmPassword) {
      setError(t('resetPassword.passwordsDontMatch', 'Passwords do not match'));
      return;
    }

    setLoading(true);

    try {
      console.log('⚠️ Resetting password...');
      
      // Set flag to prevent profile reload on USER_UPDATED event
      localStorage.setItem('changingPassword', 'true');
      
      const result = await resetPassword(newPassword);
      
      // Clear the flag
      localStorage.removeItem('changingPassword');
      
      console.log('Reset result:', result);
      console.log('Result success value:', result?.success);
      
      if (result && result.success) {
        console.log('✅ Password reset successful! Setting success state...');
        setLoading(false);
        setSuccess(true);
        setError('');
        
        console.log('Success state set, waiting 2.5s before redirect...');
        
        // Wait to show success message, then sign out and redirect
        setTimeout(async () => {
          console.log('Signing out and redirecting to login...');
          await supabase.auth.signOut();
          navigate('/login', { replace: true });
        }, 2500);
      } else {
        console.error('❌ Password reset failed:', result?.error);
        setError(t('resetPassword.error', 'Failed to reset password. Please try again.'));
        setLoading(false);
      }
    } catch (err) {
      console.error('❌ Exception during password reset:', err);
      localStorage.removeItem('changingPassword');
      setError(t('resetPassword.error', 'Failed to reset password. Please try again.'));
      setLoading(false);
    }
  };

  const fieldClass = (filled) => cn(
    'industry-login-input w-full border py-3 pl-10 pr-12 outline-none transition-colors placeholder:opacity-60 focus:border-[var(--login-accent)]',
    filled && 'industry-login-input--filled',
  );

  const fieldStyle = {
    background: 'transparent',
    borderColor: ind.hairline,
    borderRadius: 0,
    caretColor: ind.ink,
    color: ind.ink,
    fontFamily: BODY,
  };

  return (
    <div
      className="relative flex min-h-screen items-center justify-center overflow-hidden transition-colors duration-200"
      style={{
        '--login-accent': ind.accent,
        background: ind.ground,
        color: ind.ink,
        fontFamily: BODY,
      }}
    >
      <div
        className="fixed inset-0 z-0 pointer-events-none"
        aria-hidden="true"
        style={{
          backgroundImage: `
            linear-gradient(${ind.rule} 1px, transparent 1px),
            linear-gradient(90deg, ${ind.rule} 1px, transparent 1px)
          `,
          backgroundSize: '36px 36px',
          maskImage: 'linear-gradient(to bottom, black, transparent 78%)',
          WebkitMaskImage: 'linear-gradient(to bottom, black, transparent 78%)',
        }}
      />

      <div className="absolute top-4 right-4 z-20">
        <div className="hidden xl:flex items-center gap-2">
          <ThemeToggle />
          <LanguageSelector />
        </div>
        <div
          className="flex xl:hidden items-stretch border overflow-hidden"
          style={{
            backgroundColor: ind.chrome,
            borderColor: ind.hairline,
            borderRadius: 0,
          }}
        >
          <ThemeToggle variant="integrated" />
          <div
            className="w-px self-stretch shrink-0"
            style={{ backgroundColor: ind.hairline }}
            aria-hidden
          />
          <LanguageSelector variant="integrated" />
        </div>
      </div>

      <div className="relative z-10 w-full max-w-md px-5 py-20 sm:px-6">
        <Blueprint
          ind={ind}
          className="relative overflow-hidden p-6 transition-colors duration-200 sm:p-8"
          style={{ background: ind.ground }}
        >
          {sessionLoading && (
            <div className="py-12 text-center">
              <svg className="mx-auto mb-4 h-8 w-8 animate-spin" viewBox="0 0 24 24" style={{ color: ind.inkMuted }}>
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <p className="text-sm" style={{ color: ind.inkMuted }}>
                {t('resetPassword.verifying', 'Verifying reset link...')}
              </p>
            </div>
          )}

          {!sessionLoading && (
            <>
              <div className="relative mb-8 text-center">
                <div
                  className="mb-4 inline-flex h-14 w-14 items-center justify-center"
                  style={{
                    background: ind.tickerBg,
                    border: `1px solid ${ind.tickerRule}`,
                    color: ind.tickerInk,
                  }}
                >
                  <Lock className="h-7 w-7" strokeWidth={1.5} />
                </div>
                <h1
                  className="mb-2 text-3xl"
                  style={{
                    color: ind.ink,
                    fontFamily: BODY,
                    fontWeight: 400,
                    letterSpacing: '-0.02em',
                  }}
                >
                  {t('resetPassword.title', 'Reset Password')}
                </h1>
                <p className="text-sm" style={{ color: ind.inkMuted }}>
                  {t('resetPassword.subtitle', 'Enter your new password below')}
                </p>
              </div>

              {success && (
                <div
                  className="mb-6 flex items-start space-x-3 border p-4"
                  style={{ background: ind.accentWash, borderColor: ind.hairline, color: ind.ink }}
                  role="status"
                >
                  <CheckCircle className="mt-0.5 h-5 w-5 shrink-0" style={{ color: ind.accentDeep }} strokeWidth={1.5} />
                  <div>
                    <p className="text-sm font-medium">
                      {t('resetPassword.success', 'Password reset successfully!')}
                    </p>
                    <p className="mt-1 text-sm" style={{ color: ind.inkMuted }}>
                      {t('resetPassword.redirecting', 'Redirecting to login...')}
                    </p>
                  </div>
                </div>
              )}

              {error && (
                <div
                  className="mb-6 flex items-start space-x-3 border p-4"
                  style={{ borderColor: ind.ink, color: ind.ink }}
                  role="alert"
                >
                  <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" strokeWidth={1.5} />
                  <span className="text-sm">{error}</span>
                </div>
              )}

              {!success && hasValidSession && (
                <form onSubmit={handleSubmit} className="relative space-y-5">
                  <style>{`
                    .industry-login-input {
                        -webkit-appearance: none;
                        -moz-appearance: none;
                        appearance: none;
                        background-image: none;
                        color-scheme: ${isDarkMode ? 'dark' : 'light'};
                    }
                    .industry-login-input::-ms-reveal,
                    .industry-login-input::-ms-clear {
                        display: none;
                    }
                    .industry-login-input::-webkit-credentials-auto-fill-button,
                    .industry-login-input::-webkit-contacts-auto-fill-button,
                    .industry-login-input::-webkit-caps-lock-indicator {
                        visibility: hidden;
                        display: none;
                        pointer-events: none;
                        width: 0;
                        height: 0;
                        margin: 0;
                    }
                    .industry-login-input--filled,
                    .industry-login-input:not(:placeholder-shown) {
                        ${loginFilledCss}
                    }
                    .industry-login-input:-webkit-autofill,
                    .industry-login-input:-webkit-autofill:hover,
                    .industry-login-input:-webkit-autofill:focus,
                    .industry-login-input:-webkit-autofill:active {
                        ${loginFilledCss}
                    }
                    .industry-login-input:autofill {
                        ${loginFilledCss}
                    }
                    .industry-login-input:-moz-autofill {
                        ${loginFilledCss}
                    }
                  `}</style>

                  <div>
                    <label
                      className="mb-2 block text-xs font-semibold uppercase"
                      style={{ color: ind.inkMuted, fontFamily: DISPLAY, letterSpacing: '.14em' }}
                    >
                      {t('resetPassword.newPassword', 'New Password')}
                    </label>
                    <div className="relative">
                      <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                        <Lock className="h-5 w-5" style={{ color: ind.inkFaint }} strokeWidth={1.5} />
                      </div>
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={newPassword}
                        onChange={(e) => {
                          setNewPassword(e.target.value);
                          setError('');
                        }}
                        className={fieldClass(Boolean(newPassword))}
                        style={{
                          ...fieldStyle,
                          WebkitTextSecurity: showPassword ? 'none' : 'disc',
                        }}
                        placeholder={t('resetPassword.newPasswordPlaceholder', 'Enter new password')}
                        disabled={loading}
                        autoComplete="new-password"
                        data-form-type="other"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute inset-y-0 right-0 flex items-center pr-3"
                        style={{ color: ind.inkMuted }}
                        disabled={loading}
                        aria-label={showPassword ? t('common.hidePassword', 'Hide password') : t('common.showPassword', 'Show password')}
                      >
                        {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label
                      className="mb-2 block text-xs font-semibold uppercase"
                      style={{ color: ind.inkMuted, fontFamily: DISPLAY, letterSpacing: '.14em' }}
                    >
                      {t('resetPassword.confirmPassword', 'Confirm Password')}
                    </label>
                    <div className="relative">
                      <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                        <Lock className="h-5 w-5" style={{ color: ind.inkFaint }} strokeWidth={1.5} />
                      </div>
                      <input
                        type={showConfirmPassword ? 'text' : 'password'}
                        value={confirmPassword}
                        onChange={(e) => {
                          setConfirmPassword(e.target.value);
                          setError('');
                        }}
                        className={fieldClass(Boolean(confirmPassword))}
                        style={{
                          ...fieldStyle,
                          WebkitTextSecurity: showConfirmPassword ? 'none' : 'disc',
                        }}
                        placeholder={t('resetPassword.confirmPasswordPlaceholder', 'Confirm new password')}
                        disabled={loading}
                        autoComplete="new-password"
                        data-form-type="other"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute inset-y-0 right-0 flex items-center pr-3"
                        style={{ color: ind.inkMuted }}
                        disabled={loading}
                        aria-label={showConfirmPassword ? t('common.hidePassword', 'Hide password') : t('common.showPassword', 'Show password')}
                      >
                        {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                      </button>
                    </div>
                  </div>

                  <ShimmerButton
                    type="submit"
                    disabled={loading}
                    borderRadius="0"
                    shimmerColor="#ffffff"
                    background={buttonFill}
                    className={cn(
                      'w-full rounded-none px-4 py-3 font-semibold uppercase disabled:cursor-not-allowed disabled:opacity-60',
                      loading && 'cursor-not-allowed'
                    )}
                    style={{ color: ind.accentInk, fontFamily: DISPLAY, letterSpacing: '.08em' }}
                  >
                    {loading ? (
                      <div className="relative z-10 flex items-center justify-center">
                        <svg className="mr-3 h-5 w-5 animate-spin" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        {t('resetPassword.resetting', 'Resetting...')}
                      </div>
                    ) : (
                      <span className="relative z-10">{t('resetPassword.resetButton', 'Reset Password')}</span>
                    )}
                  </ShimmerButton>
                </form>
              )}

              <div className="mt-6 text-center">
                <button
                  type="button"
                  onClick={() => navigate('/login')}
                  className="cursor-pointer text-sm font-semibold uppercase"
                  style={{ color: ind.accentDeep, fontFamily: DISPLAY, letterSpacing: '.06em' }}
                >
                  {t('resetPassword.backToLogin', 'Back to Login')}
                </button>
              </div>
            </>
          )}
        </Blueprint>
      </div>
    </div>
  );
};

export default ResetPassword;
