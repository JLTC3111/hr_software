import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Eye, Car, EyeOff, Lock, Mail, Building2, AlertCircle, X, CheckCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';
import { disableDemoMode } from '../utils/demoHelper';
import ThemeToggle from './themeToggle';
import LanguageSelector from './LanguageSelector';
import { useNavigate, useLocation } from 'react-router-dom';
import { resolvePostLoginRoute } from '../config/routes.js';
import { LOGOUT_REASON_KEY, DEFAULT_REQUEST_TIMEOUT } from '../config/requestTimeouts.js';
import { TextEffect } from './motion-primitives';
import { ShimmerButton } from './ui/shimmer-button';
import { ShinyButton } from './ui/shiny-button';
import { cn } from '@/lib/utils';
import { Blueprint } from './ui/industry.jsx';
import { getIndustry, DISPLAY, BODY } from '../theme/industry.js';

/**
 * Demo mode is closed until further notice. The button stays on the page as
 * "Request Demo", but instead of logging the visitor in it opens a mailto: to
 * DEMO_REQUEST_EMAIL. Flip this to false to hand the self-serve demo back.
 */
const DEMO_LOCKED = true;
const DEMO_REQUEST_EMAIL = 'support@icue.vn';

const Login = () => {
  const { login, loginAsDemo, forgotPassword, isAuthenticated, user, loading } = useAuth();
  const { isDarkMode } = useTheme();
  const ind = useMemo(() => getIndustry(isDarkMode), [isDarkMode]);
  const { t, currentLanguage } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();

  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  
  const [errors, setErrors] = useState({});
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true); // Default to true for better UX
  const [isLoading, setIsLoading] = useState(false);
  const [isDemoLoading, setIsDemoLoading] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [showIdleLogoutNotice, setShowIdleLogoutNotice] = useState(false);
  const [titleReady, setTitleReady] = useState(false);
  const isFormBusy = isLoading || isDemoLoading;

  // Wait until auth bootstrap finishes so the title animation isn't skipped on first paint
  useEffect(() => {
    if (loading) {
      setTitleReady(false);
      return undefined;
    }

    let raf2;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => setTitleReady(true));
    });

    return () => {
      cancelAnimationFrame(raf1);
      if (raf2) cancelAnimationFrame(raf2);
    };
  }, [loading]);

  useEffect(() => {
    const reason = sessionStorage.getItem(LOGOUT_REASON_KEY);
    if (reason === 'idle' || reason === 'session') {
      // Store the notice state, not a translated sentence. Resolving the copy
      // during render keeps it in sync when the login language is changed.
      setShowIdleLogoutNotice(true);
      sessionStorage.removeItem(LOGOUT_REASON_KEY);
    }
  }, []);

  // The notice reports something that happened before this page loaded, so it
  // is stale the moment the visitor starts interacting. Switching language is
  // exactly that signal — dismiss it rather than restate old news in the new
  // locale. Ref-guarded so the initial render never clears a fresh notice.
  const noticeLanguageRef = useRef(currentLanguage);
  useEffect(() => {
    if (noticeLanguageRef.current === currentLanguage) return;
    noticeLanguageRef.current = currentLanguage;
    setShowIdleLogoutNotice(false);
  }, [currentLanguage]);

  // Forgot password states
  const [showForgotPasswordModal, setShowForgotPasswordModal] = useState(false);
  const [forgotPasswordEmail, setForgotPasswordEmail] = useState('');
  const [forgotPasswordError, setForgotPasswordError] = useState('');
  const [forgotPasswordSuccess, setForgotPasswordSuccess] = useState('');
  const [isSendingReset, setIsSendingReset] = useState(false);

  useEffect(() => {
    if (import.meta.env.DEV) {
      console.log('🔍 Redirect condition check:', {
        loading,
        isAuthenticated,
        userExists: !!user,
      });
    }


    if (!loading && isAuthenticated && user) {
      // Return them to the screen they were on if arriving here was an
      // interrupted session restore rather than a deliberate sign-out.
      const target = resolvePostLoginRoute(location.state?.from);
      console.log(`✅ All conditions met - Redirecting to ${target}`);
      setIsLoading(false);
      navigate(target, { replace: true });
    } else if (!loading && !isAuthenticated) {
      console.log('✅ Loading complete - User can login');
    }
  }, [isAuthenticated, user, loading, navigate, location]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
    setLoginError('');
  };

  const validateForm = () => {
    const newErrors = {};
    
    if (!formData.email.trim()) {
      newErrors.email = t('login.emailRequired', 'Email is required');
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = t('login.emailInvalid', 'Email is invalid');
    }
    
    if (!formData.password) {
      newErrors.password = t('login.passwordRequired', 'Password is required');
    } else if (formData.password.length < 6) {
      newErrors.password = t('login.passwordTooShort', 'Password must be at least 6 characters');
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) return;
    
    setIsLoading(true);
    setLoginError('');
    
    // Clear demo mode before attempting real login
    disableDemoMode();
    
    try {
      const result = await login(formData.email, formData.password, rememberMe);
      
      if (!result.success) {
        console.error('Login failed:', result.error);
        setLoginError(t('login.invalidCredentials', 'Invalid email or password'));
        setIsLoading(false);
      }
      // On success, spinner stays until redirect (or safety timeout below)
    } catch {
      setLoginError(t('login.invalidCredentials', 'Invalid email or password'));
      setIsLoading(false);
    }
  };

  // If sign-in succeeds but profile/redirect stalls, unlock the form.
  // Must outlast the sign-in budget in AuthContext: unlocking earlier lets the
  // user submit again while the first attempt is still waiting on GoTrue's auth
  // lock, and the second attempt then queues behind the first.
  useEffect(() => {
    if (!isLoading) return undefined;
    const timer = setTimeout(() => setIsLoading(false), DEFAULT_REQUEST_TIMEOUT + 20000);
    return () => clearTimeout(timer);
  }, [isLoading]);

  const handleForgotPasswordClick = () => {
    setShowForgotPasswordModal(true);
    setForgotPasswordEmail(formData.email); // Pre-fill if email entered
    setForgotPasswordError('');
    setForgotPasswordSuccess('');
  };

  const handleForgotPasswordSubmit = async (e) => {
    e.preventDefault();
    
    if (!forgotPasswordEmail.trim()) {
      setForgotPasswordError(t('login.forgotPasswordModal.emailRequired', 'Email is required'));
      return;
    }
    
    if (!/\S+@\S+\.\S+/.test(forgotPasswordEmail)) {
      setForgotPasswordError(t('login.forgotPasswordModal.emailInvalid', 'Please enter a valid email'));
      return;
    }
    
    setIsSendingReset(true);
    setForgotPasswordError('');
    setForgotPasswordSuccess('');
    
    const result = await forgotPassword(forgotPasswordEmail);
    
    setIsSendingReset(false);
    
    if (result.success) {
      setForgotPasswordSuccess(
        result.t ? t(result.t, result.message) : (result.message || t('login.forgotPasswordModal.success', 'Password reset email sent. Please check your inbox.'))
      );
      // Clear form after 3 seconds and close modal
      setTimeout(() => {
        setShowForgotPasswordModal(false);
        setForgotPasswordEmail('');
        setForgotPasswordSuccess('');
      }, 3000);
    } else {
      console.error('Password reset request failed:', result.error);
      setForgotPasswordError(t('login.forgotPasswordModal.error', 'Failed to send reset email. Please try again.'));
    }
  };

  const closeForgotPasswordModal = () => {
    setShowForgotPasswordModal(false);
    setForgotPasswordEmail('');
    setForgotPasswordError('');
    setForgotPasswordSuccess('');
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
        {/* Desktop: theme toggle left of language bar */}
        <div className="hidden xl:flex items-center gap-2">
          <ThemeToggle />
          <LanguageSelector />
        </div>

        {/* Mobile / tablet: theme toggle inside language bar */}
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

      {/* Login Card */}
      <div className="relative z-10 w-full max-w-md px-5 py-20 sm:px-6">
        <Blueprint
          ind={ind}
          className="relative overflow-hidden p-6 transition-colors duration-200 sm:p-8"
          style={{ background: ind.ground }}
        >
          {/* Logo and Title */}
          <div className="relative text-center mb-8">
            <div
              className="inline-flex h-14 w-14 items-center justify-center mb-4"
              style={{
                background: ind.tickerBg,
                border: `1px solid ${ind.tickerRule}`,
                color: ind.tickerInk,
              }}
            >
              <Building2 className="w-7 h-7" strokeWidth={1.5} />
            </div>
            <TextEffect
              key={`login-title-${t('login.title', 'HR Manager')}`}
              as="h1"
              per="char"
              preset="fade-in-blur"
              className="mb-2 text-3xl"
              style={{
                color: ind.ink,
                fontFamily: BODY,
                fontWeight: 400,
                letterSpacing: '-0.02em',
              }}
              speedReveal={1.2}
              trigger={titleReady}
            >
              {t('login.title', 'HR Manager')}
            </TextEffect>
            <p
              className="text-sm"
              style={{ color: ind.inkMuted, fontFamily: BODY }}
            >
              {t('login.subtitle', 'Sign in to access your dashboard')}
            </p>
          </div>

          {showIdleLogoutNotice && (
            <div
              className="relative mb-6 flex items-center space-x-2 border p-3"
              style={{ background: ind.accentWash, borderColor: ind.hairline, color: ind.ink }}
              role="status"
            >
              <AlertCircle className="w-5 h-5 shrink-0" strokeWidth={1.5} />
              <span className="text-sm">
                {t(
                  'login.idleLogoutMessage',
                  'You were signed out after a period of inactivity. Please sign in again.'
                )}
              </span>
            </div>
          )}

          {/* Login Error */}
          {loginError && (
            <div
              className="relative mb-6 flex items-center space-x-2 border p-3"
              style={{ borderColor: ind.ink, color: ind.ink }}
              role="alert"
            >
              <AlertCircle className="w-5 h-5 shrink-0" strokeWidth={1.5} />
              <span className="text-sm">{loginError}</span>
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="relative space-y-5">
            {/* Email Field */}
            <div>
              <label
                className="mb-2 block text-xs font-semibold uppercase"
                style={{ color: ind.inkMuted, fontFamily: DISPLAY, letterSpacing: '.14em' }}
              >
                {t('login.email', 'Email Address')}
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5" style={{ color: ind.inkFaint }} strokeWidth={1.5} />
                </div>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  className="industry-login-input w-full border py-3 pl-10 pr-4 outline-none transition-colors placeholder:opacity-60 focus:border-[var(--login-accent)]"
                  style={{
                    background: 'transparent',
                    borderColor: errors.email ? ind.ink : ind.hairline,
                    borderRadius: 0,
                    caretColor: ind.ink,
                    color: ind.ink,
                    fontFamily: BODY,
                  }}
                  placeholder={t('login.emailPlaceholder', 'you@example.com')}
                  autoComplete="email"
                  disabled={isFormBusy}
                />
              </div>
              {errors.email && (
                <p className="mt-1 flex items-center text-sm" style={{ color: ind.ink }}>
                  <AlertCircle className="w-4 h-4 mr-1" strokeWidth={1.5} />
                  {errors.email}
                </p>
              )}
            </div>

            {/* Password Field */}
            <div>
              <label
                className="mb-2 block text-xs font-semibold uppercase"
                style={{ color: ind.inkMuted, fontFamily: DISPLAY, letterSpacing: '.14em' }}
              >
                {t('login.password', 'Password')}
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5" style={{ color: ind.inkFaint }} strokeWidth={1.5} />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  className="industry-login-input w-full border py-3 pl-10 pr-12 outline-none transition-colors placeholder:opacity-60 focus:border-[var(--login-accent)]"
                  style={{
                    background: 'transparent',
                    borderColor: errors.password ? ind.ink : ind.hairline,
                    borderRadius: 0,
                    caretColor: ind.ink,
                    color: ind.ink,
                    fontFamily: BODY,
                  }}
                  placeholder={t('login.passwordPlaceholder', '••••••••')}
                  autoComplete="current-password"
                  disabled={isFormBusy}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3"
                  style={{ color: ind.inkMuted }}
                  disabled={isLoading}
                >
                  {showPassword ? (
                    <EyeOff className="h-5 w-5" />
                  ) : (
                    <Eye className="h-5 w-5" />
                  )}
                </button>
              </div>
              {errors.password && (
                <p className="mt-1 flex items-center text-sm" style={{ color: ind.ink }}>
                  <AlertCircle className="w-4 h-4 mr-1" strokeWidth={1.5} />
                  {errors.password}
                </p>
              )}
            </div>

            {/* Remember Me & Forgot Password */}
            <div className="flex items-center justify-between">
            <style>{`
                #custom-checkbox {
                    -webkit-appearance: none;
                    -moz-appearance: none;
                    appearance: none;
                    border: 1px solid ${ind.hairline};
                    border-radius: 0;
                }

                #custom-checkbox:checked {
                    border-color: ${ind.accent};
                    background-size: 100%;
                    background-color: ${ind.accent};
                    background-image: url("data:image/svg+xml;charset=UTF-8,%3csvg viewBox='0 0 16 16' fill='white' xmlns='http://www.w3.org/2000/svg'%3e%3cpath d='M12.207 4.793a1 1 0 0 1 0 1.414l-5 5a1 1 0 0 1-1.414 0l-2-2a1 1 0 0 1 1.414-1.414L6.5 9.086l4.293-4.293a1 1 0 0 1 1.414 0z'/%3e%3c/svg%3e");
                    background-repeat: no-repeat;
                    background-position: center;
                }

                .industry-login-input:-webkit-autofill,
                .industry-login-input:-webkit-autofill:hover,
                .industry-login-input:-webkit-autofill:focus {
                    -webkit-box-shadow: 0 0 0 1000px ${ind.ground} inset !important;
                    box-shadow: 0 0 0 1000px ${ind.ground} inset !important;
                    -webkit-text-fill-color: ${ind.ink} !important;
                    caret-color: ${ind.ink} !important;
                }
            `}</style>
              <label className="flex items-center">
              <input
                id="custom-checkbox"
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-4 h-4 cursor-pointer"
                disabled={isFormBusy}
              />
                <span className="ml-2 cursor-pointer text-sm" style={{ color: ind.inkMuted }}>
                  {t('login.rememberMe')}
                </span>
              </label>
              <button
                type="button"
                onClick={handleForgotPasswordClick}
                className="cursor-pointer text-sm font-semibold uppercase"
                style={{ color: ind.accentDeep, fontFamily: DISPLAY, letterSpacing: '.06em' }}
                disabled={isFormBusy}
              >
                {t('login.forgotPassword')}
              </button>
            </div>

            {/* Login Button */}
            <ShimmerButton
              type="submit"
              disabled={isLoading || isDemoLoading}
              borderRadius="0"
              shimmerColor="#ffffff"
              background={ind.accent}
              className={cn(
                'w-full rounded-none py-3 px-4 font-semibold uppercase disabled:opacity-60 disabled:cursor-not-allowed',
                isLoading && 'cursor-not-allowed'
              )}
              style={{ color: ind.accentInk, fontFamily: DISPLAY, letterSpacing: '.08em' }}
            >
              {isLoading ? (
                <div className="relative z-10 flex items-center justify-center">
                  <svg className="animate-spin h-5 w-5 mr-3" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  {t('login.signingIn', 'Signing in...')}
                </div>
              ) : (
                <span className="relative z-10">{t('login.signIn', 'Sign In')}</span>
              )}
            </ShimmerButton>
          </form>

          {/* Divider */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t" style={{ borderColor: ind.rule }}></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2" style={{ background: ind.ground, color: ind.inkFaint }}>
                {t('login.orContinueWith', 'Or continue with')}
              </span>
            </div>
          </div>

          {/* Demo Mode Button — locked, see DEMO_LOCKED; opens a mailto: instead */}
          <ShinyButton
            type="button"
            shineOnHover={DEMO_LOCKED}
            onClick={async () => {
              if (DEMO_LOCKED) {
                window.location.href = `mailto:${DEMO_REQUEST_EMAIL}?subject=${encodeURIComponent('Demo Request')}`;
                return;
              }
              setLoginError('');
              setIsDemoLoading(true);
              try {
                // Brief delay to ensure the spinner is visible even on fast responses
                await new Promise((resolve) => setTimeout(resolve, 150));
                await loginAsDemo();
              } catch {
                setLoginError(t('login.invalidCredentials', 'Invalid email or password'));
                setIsDemoLoading(false);
              }
            }}
            className={cn(
              'mt-3 w-full rounded-none border bg-transparent py-3 px-4 font-semibold uppercase transition-colors duration-200 shadow-none',
              isDemoLoading && 'opacity-80',
              isFormBusy && 'disabled:opacity-50'
            )}
            style={{
              background: 'transparent',
              borderColor: ind.hairline,
              borderRadius: 0,
              color: ind.ink,
              fontFamily: DISPLAY,
              letterSpacing: '.08em',
            }}
            disabled={isFormBusy}
            title={DEMO_LOCKED ? t('login.requestDemoNote', `Email ${DEMO_REQUEST_EMAIL} to request a demo`) : undefined}
          >
            {isDemoLoading ? (
              <span className="flex items-center justify-center gap-2 normal-case tracking-normal">
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                {t('login.tryDemoLoading', 'Loading demo...')}
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                <Car
                  className="w-5 h-5"
                  style={{ color: ind.inkMuted, transform: 'scaleX(-1)' }}
                  strokeWidth={1.5}
                />
                {DEMO_LOCKED
                  ? t('login.requestDemo', 'Request Demo')
                  : t('login.tryDemo', 'Try Demo Mode')}
              </span>
            )}
          </ShinyButton>
        </Blueprint>

        {/* Footer */}
        <p className="mt-8 text-center text-xs" style={{ color: ind.inkFaint, fontFamily: BODY }}>
          {t('login.footer', '© 2024 HR Manager. All rights reserved.')}
        </p>
      </div>

      {/* Forgot Password Modal */}
      {showForgotPasswordModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(29,45,61,.72)' }}
        >
          <Blueprint
            ind={ind}
            className="relative w-full max-w-md p-8"
            style={{ background: ind.ground }}
          >
            {/* Close Button */}
            <button
              onClick={closeForgotPasswordModal}
              className="absolute top-4 right-4"
              style={{ color: ind.inkMuted }}
              disabled={isSendingReset}
              aria-label={t('common.close', 'Close')}
            >
              <X className="w-6 h-6" strokeWidth={1.5} />
            </button>

            {/* Title */}
            <div className="mb-6">
              <h2
                className="mb-2 text-2xl"
                style={{ color: ind.ink, fontFamily: BODY, fontWeight: 400 }}
              >
                {t('login.forgotPasswordModal.title', 'Reset Password')}
              </h2>
              <p className="text-sm" style={{ color: ind.inkMuted }}>
                {t('login.forgotPasswordModal.description', 'Enter your email address and we\'ll send you a link to reset your password.')}
              </p>
            </div>

            {/* Success Message */}
            {forgotPasswordSuccess && (
              <div
                className="mb-4 flex items-start space-x-2 border p-4"
                style={{ background: ind.accentWash, borderColor: ind.hairline, color: ind.ink }}
              >
                <CheckCircle className="mt-0.5 w-5 h-5 shrink-0" style={{ color: ind.accentDeep }} strokeWidth={1.5} />
                <span className="text-sm">{forgotPasswordSuccess}</span>
              </div>
            )}

            {/* Error Message */}
            {forgotPasswordError && (
              <div
                className="mb-4 flex items-start space-x-2 border p-4"
                style={{ borderColor: ind.ink, color: ind.ink }}
                role="alert"
              >
                <AlertCircle className="mt-0.5 w-5 h-5 shrink-0" strokeWidth={1.5} />
                <span className="text-sm">{forgotPasswordError}</span>
              </div>
            )}

            {/* Form */}
            {!forgotPasswordSuccess && (
              <form onSubmit={handleForgotPasswordSubmit} className="space-y-4">
                <div>
                  <label
                    className="mb-2 block text-xs font-semibold uppercase"
                    style={{ color: ind.inkMuted, fontFamily: DISPLAY, letterSpacing: '.14em' }}
                  >
                    {t('login.forgotPasswordModal.emailLabel', 'Email Address')}
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Mail className="h-5 w-5" style={{ color: ind.inkFaint }} strokeWidth={1.5} />
                    </div>
                    <input
                      type="email"
                      value={forgotPasswordEmail}
                      onChange={(e) => {
                        setForgotPasswordEmail(e.target.value);
                        setForgotPasswordError('');
                      }}
                      className="industry-login-input w-full border py-3 pl-10 pr-4 outline-none transition-colors placeholder:opacity-60 focus:border-[var(--login-accent)]"
                      style={{
                        background: 'transparent',
                        borderColor: forgotPasswordError ? ind.ink : ind.hairline,
                        borderRadius: 0,
                        caretColor: ind.ink,
                        color: ind.ink,
                        fontFamily: BODY,
                      }}
                      placeholder={t('login.forgotPasswordModal.emailPlaceholder', 'you@example.com')}
                      autoComplete="email"
                      disabled={isSendingReset}
                      autoFocus
                    />
                  </div>
                </div>

                {/* Buttons */}
                <div className="flex space-x-3">
                  <ShinyButton
                    type="button"
                    onClick={closeForgotPasswordModal}
                    className="flex-1 rounded-none border bg-transparent py-3 px-4 font-semibold uppercase"
                    style={{
                      background: 'transparent',
                      borderColor: ind.hairline,
                      borderRadius: 0,
                      color: ind.ink,
                      fontFamily: DISPLAY,
                      letterSpacing: '.08em',
                    }}
                    disabled={isSendingReset}
                  >
                    {t('login.forgotPasswordModal.cancel', 'Cancel')}
                  </ShinyButton>
                  <ShimmerButton
                    type="submit"
                    borderRadius="0"
                    background={ind.accent}
                    className={cn(
                      'flex-1 rounded-none py-3 px-4 font-semibold uppercase',
                      isSendingReset && 'cursor-not-allowed opacity-70'
                    )}
                    style={{ color: ind.accentInk, fontFamily: DISPLAY, letterSpacing: '.08em' }}
                    disabled={isSendingReset}
                  >
                    {isSendingReset ? (
                      <div className="relative z-10 flex items-center justify-center">
                        <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                      </div>
                    ) : (
                      <span className="relative z-10">
                        {t('login.forgotPasswordModal.sendReset', 'Send Reset Link')}
                      </span>
                    )}
                  </ShimmerButton>
                </div>
              </form>
            )}
          </Blueprint>
        </div>
      )}
    </div>
  );
};

export default Login;
