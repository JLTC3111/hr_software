import React, { useState, useEffect } from 'react';
import { Eye, Car, EyeOff, Lock, Mail, Building2, AlertCircle, X, CheckCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';
import { disableDemoMode } from '../utils/demoHelper';
import ThemeToggle from './themeToggle';
import LanguageSelector from './LanguageSelector';
import { useNavigate } from 'react-router-dom';

const Login = () => {
  const { login, loginWithGithub, loginAsDemo, forgotPassword, isAuthenticated, user, loading } = useAuth();
  const { isDarkMode, bg, text, input } = useTheme();
  const { t } = useLanguage();
  const navigate = useNavigate();
  
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  
  const [errors, setErrors] = useState({});
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true); // Default to true for better UX
  const [isLoading, setIsLoading] = useState(false);
  const [isDemoLoading, setIsDemoLoading] = useState(false);
  const [isGithubLoading, setIsGithubLoading] = useState(false);
  const [loginError, setLoginError] = useState('');
  const isFormBusy = isLoading || isDemoLoading;
  
  // Forgot password states
  const [showForgotPasswordModal, setShowForgotPasswordModal] = useState(false);
  const [forgotPasswordEmail, setForgotPasswordEmail] = useState('');
  const [forgotPasswordError, setForgotPasswordError] = useState('');
  const [forgotPasswordSuccess, setForgotPasswordSuccess] = useState('');
  const [isSendingReset, setIsSendingReset] = useState(false);

  useEffect(() => {
    console.log('🔍 Redirect condition check:', {
      loading,
      isAuthenticated,
      userExists: !!user,
    });
  
    if (!loading && isAuthenticated && user) {
      console.log('✅ All conditions met - Redirecting to /time-clock');
      navigate('/time-clock', { replace: true });
    } else if (!loading && !isAuthenticated) {
      console.log('✅ Loading complete - User can login');
    }
  }, [isAuthenticated, user, loading, navigate]);

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
    
    const result = await login(formData.email, formData.password, rememberMe);
    
    if (!result.success) {
      setLoginError(result.error || t('login.invalidCredentials', 'Invalid email or password'));
      setIsLoading(false);
    }
  };

  const handleGithubLogin = async () => {
    setLoginError('');
    setIsGithubLoading(true);
    
    // Clear demo mode before attempting real login
    disableDemoMode();
    
    const result = await loginWithGithub();
    
    if (!result.success) {
      setLoginError(result.error || t('login.githubError', 'Failed to login with GitHub'));
      setIsGithubLoading(false);
    }
    // Note: If successful, the browser will redirect to GitHub OAuth page
    // The loading state will remain true until redirect happens
  };

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
      setForgotPasswordError(result.error || t('login.forgotPasswordModal.error', 'Failed to send reset email. Please try again.'));
    }
  };

  const closeForgotPasswordModal = () => {
    setShowForgotPasswordModal(false);
    setForgotPasswordEmail('');
    setForgotPasswordError('');
    setForgotPasswordSuccess('');
  };

  return (
    <div className={`min-h-screen flex items-center justify-center ${isDarkMode ? 'bg-transparent' : 'bg-transparent'} transition-colors duration-200`}>
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className={`absolute -top-40 -right-40 w-80 h-80 rounded-full opacity-10 ${isDarkMode ? 'bg-white' : 'bg-blue-300'} blur-3xl`}></div>
        <div className={`absolute -bottom-40 -left-40 w-80 h-80 rounded-full opacity-10 ${isDarkMode ? 'bg-white' : 'bg-purple-300'} blur-3xl`}></div>
      </div>

      <div className="absolute top-6 right-6 flex items-center space-x-4 z-10">
        <LanguageSelector />
        <ThemeToggle />
      </div>

      {/* Login Card */}
      <div className="relative w-full max-w-md px-6">
        <div className={`${isDarkMode ? 'bg-gray-800' : 'bg-white'} rounded-2xl shadow-2xl p-8 transition-colors duration-200`}>
          {/* Logo and Title */}
          <div className="text-center mb-8">
            <div className={`inline-flex items-center justify-center w-16 h-16 rounded-full mb-4 ${isDarkMode ? 'bg-transparent' : 'bg-blue-500'}`}>
              <Building2 className="w-8 h-8 text-white" />
            </div>
            <h1 className={`text-3xl font-bold ${text.primary} mb-2`}>
              {t('login.title', 'HR Manager')}
            </h1>
            <p className={`${text.secondary} text-sm`}>
              {t('login.subtitle', 'Sign in to access your dashboard')}
            </p>
          </div>

          {/* Login Error */}
          {loginError && (
            <div className={`mb-6 p-3 ${isDarkMode ? 'bg-red-900/30 border-red-700 text-red-400' : 'bg-red-100 border-red-400 text-red-700'} border rounded-lg flex items-center space-x-2`}>
              <AlertCircle className="w-5 h-5 shrink-0" />
              <span className="text-sm">{loginError}</span>
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Email Field */}
            <div>
              <label className={`block text-sm font-medium ${text.primary} mb-2`}>
                {t('login.email', 'Email Address')}
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className={`h-5 w-5 ${isDarkMode ? 'text-gray-400' : 'text-gray-400'}`} />
                </div>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  className={`w-full pl-10 pr-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none transition-colors ${
                    isDarkMode 
                      ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' 
                      : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
                  } ${errors.email ? 'border-red-500 focus:ring-red-500' : ''}`}
                  placeholder={t('login.emailPlaceholder', 'you@example.com')}
                  autoComplete="email"
                  disabled={isFormBusy}
                />
              </div>
              {errors.email && (
                <p className="mt-1 text-sm text-red-500 flex items-center">
                  <AlertCircle className="w-4 h-4 mr-1" />
                  {errors.email}
                </p>
              )}
            </div>

            {/* Password Field */}
            <div>
              <label className={`block text-sm font-medium ${text.primary} mb-2`}>
                {t('login.password', 'Password')}
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className={`h-5 w-5 ${isDarkMode ? 'text-gray-400' : 'text-gray-400'}`} />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  className={`w-full pl-10 pr-12 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none transition-colors ${
                    isDarkMode 
                      ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' 
                      : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
                  } ${errors.password ? 'border-red-500 focus:ring-red-500' : ''}`}
                  placeholder={t('login.passwordPlaceholder', '••••••••')}
                  autoComplete="current-password"
                  disabled={isFormBusy}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className={`absolute inset-y-0 right-0 pr-3 flex items-center ${isDarkMode ? 'text-gray-400 hover:text-gray-300' : 'text-gray-400 hover:text-gray-600'}`}
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
                <p className="mt-1 text-sm text-red-500 flex items-center">
                  <AlertCircle className="w-4 h-4 mr-1" />
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
                    border-color: ${isDarkMode ? '#525252' : '#9CA3AF'};
                    border-width: 2px;
                    border-radius: 0.25rem;
                }

                #custom-checkbox:checked {
                    border-color: ${isDarkMode ? '#FFF' : '#000'};
                    background-size: 100%;
                    background-color: ${isDarkMode ? '#transparent' : '#000'};
                    background-image: url("data:image/svg+xml;charset=UTF-8,%3csvg viewBox='0 0 16 16' fill='white' xmlns='http://www.w3.org/2000/svg'%3e%3cpath d='M12.207 4.793a1 1 0 0 1 0 1.414l-5 5a1 1 0 0 1-1.414 0l-2-2a1 1 0 0 1 1.414-1.414L6.5 9.086l4.293-4.293a1 1 0 0 1 1.414 0z'/%3e%3c/svg%3e");
                    background-repeat: no-repeat;
                    background-position: center;
                }
            `}</style>
              <label className="flex items-center">
              <input
                id="custom-checkbox"
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-4 h-4 accent-blue-600 border-gray-900 rounded focus:ring-blue-500 cursor-pointer"
                disabled={isFormBusy}
              />
                <span className={`ml-2 text-sm ${text.secondary} cursor-pointer`}>
                  {t('login.rememberMe')}
                </span>
              </label>
              <button
                type="button"
                onClick={handleForgotPasswordClick}
                className={`text-sm ${isDarkMode ? 'text-indigo-300 hover:text-indigo-200' : 'text-blue-600 hover:text-amber-900'}  font-medium cursor-pointer transition-color duration-500 focus:ring-blue-500`}
                disabled={isFormBusy}
              >
                {t('login.forgotPassword')}
              </button>
            </div>

            {/* Login Button */}
            <button
              type="submit"
              disabled={isLoading || isDemoLoading}
              className={`w-full py-3 px-4 ${isDarkMode ? 'border-blue-100' : 'border-black'} rounded-lg font-medium bg-blue-300 text-white transition-all duration-200 cursor-pointer ${
                isLoading 
                  ? 'bg-blue-400 cursor-not-allowed' 
                  : 'bg-blue-600 hover:bg-blue-700 active:scale-[0.98]'
              } focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2`}
            >
              {isLoading ? (
                <div className="flex items-center justify-center">
                  <svg className="animate-spin h-5 w-5 mr-3" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  {t('login.signingIn', 'Signing in...')}
                </div>
              ) : (
                t('login.signIn', 'Sign In')
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className={`w-full border-t ${isDarkMode ? 'border-gray-700' : 'border-gray-300'}`}></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className={`px-2 ${isDarkMode ? 'bg-gray-800 text-gray-400' : 'bg-white text-gray-500'}`}>
                {t('login.orContinueWith', 'Or continue with')}
              </span>
            </div>
          </div>

          {/* GitHub OAuth Button - Hidden for now */}
          {/* <button
            type="button"
            onClick={handleGithubLogin}
            className={`w-full py-3 px-4 rounded-lg font-medium transition-colors flex items-center justify-center space-x-2 cursor-pointer ${
              isDarkMode 
                ? 'bg-gray-900 hover:bg-gray-600 text-white border border-gray-600' 
                : 'bg-white hover:bg-gray-100 text-gray-900 border border-gray-900'
            } ${(isLoading || isGithubLoading) ? 'opacity-50 cursor-not-allowed' : ''}`}
            disabled={isLoading || isGithubLoading}
          >
            {isGithubLoading ? (
              <>
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <span>{t('login.redirecting', 'Redirecting to GitHub...')}</span>
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path fillRule="evenodd" clipRule="evenodd" d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
                </svg>
                <span>{t('login.continueWithGithub', 'Continue with GitHub')}</span>
              </>
            )}
          </button> */}

          {/* Demo Mode Button */}
          <button
            type="button"
            onClick={async () => {
              setLoginError('');
              setIsDemoLoading(true);
              try {
                // Brief delay to ensure the spinner is visible even on fast responses
                await new Promise((resolve) => setTimeout(resolve, 150));
                await loginAsDemo();
              } catch (err) {
                setLoginError(err?.message || t('login.invalidCredentials', 'Invalid email or password'));
                setIsDemoLoading(false);
              }
            }}
            className={`w-full mt-3 py-3 px-4 rounded-lg font-medium transition-all duration-200 flex items-center justify-center space-x-2 cursor-pointer shadow-sm hover:shadow-md ${
              isDarkMode 
                ? 'bg-linear-to-r from-gray-600 to-gray-900 hover:from-gray-900 hover:to-blue-900 text-white border border-white' 
                : 'bg-linear-to-r from-indigo-50 to-gray-50 hover:from-indigo-100 hover:to-yellow-100 text-gray-700 border border-indigo-200'
            } ${isDemoLoading ? 'opacity-80' : ''}`}
            disabled={isFormBusy}
          >
            {isDemoLoading ? (
              <>
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <span>{t('login.tryDemoLoading', 'Loading demo...')}</span>
              </>
            ) : (
              <>
                <Car
                  className={`w-5 h-5 ${isDarkMode ? 'text-white' : 'text-gray-600'}`}
                  style={{ transform: 'scaleX(-1)' }}
                />
                <span>{t('login.tryDemo', 'Try Demo Mode')}</span>
              </>
            )}
          </button>
        </div>

        {/* Footer */}
        <p className={`mt-8 text-center text-xs ${text.secondary}`}>
          {t('login.footer', '© 2024 HR Manager. All rights reserved.')}
        </p>
      </div>

      {/* Forgot Password Modal */}
      {showForgotPasswordModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className={`${isDarkMode ? 'bg-gray-800' : 'bg-white'} rounded-2xl shadow-2xl p-8 max-w-md w-full relative`}>
            {/* Close Button */}
            <button
              onClick={closeForgotPasswordModal}
              className={`absolute top-4 right-4 ${text.secondary} hover:${text.primary}`}
              disabled={isSendingReset}
            >
              <X className="w-6 h-6" />
            </button>

            {/* Title */}
            <div className="mb-6">
              <h2 className={`text-2xl cursor-pointer font-bold ${text.primary} mb-2`}>
                {t('login.forgotPasswordModal.title', 'Reset Password')}
              </h2>
              <p className={`text-sm cursor-pointer ${text.secondary}`}>
                {t('login.forgotPasswordModal.description', 'Enter your email address and we\'ll send you a link to reset your password.')}
              </p>
            </div>

            {/* Success Message */}
            {forgotPasswordSuccess && (
              <div className={`mb-4 p-4 ${isDarkMode ? 'bg-green-900/30 border-green-700' : 'bg-green-100 border-green-400'} border rounded-lg flex items-start space-x-2`}>
                <CheckCircle className={`w-5 h-5 ${isDarkMode ? 'text-green-400' : 'text-green-600'} shrink-0 mt-0.5`} />
                <span className={`text-sm ${isDarkMode ? 'text-green-400' : 'text-green-700'}`}>{forgotPasswordSuccess}</span>
              </div>
            )}

            {/* Error Message */}
            {forgotPasswordError && (
              <div className={`mb-4 p-4 ${isDarkMode ? 'bg-red-900/30 border-red-700' : 'bg-red-100 border-red-400'} border rounded-lg flex items-start space-x-2`}>
                <AlertCircle className={`w-5 h-5 ${isDarkMode ? 'text-red-400' : 'text-red-600'} shrink-0 mt-0.5`} />
                <span className={`text-sm ${isDarkMode ? 'text-red-400' : 'text-red-700'}`}>{forgotPasswordError}</span>
              </div>
            )}

            {/* Form */}
            {!forgotPasswordSuccess && (
              <form onSubmit={handleForgotPasswordSubmit} className="space-y-4">
                <div>
                  <label className={`block text-sm font-medium ${text.primary} mb-2`}>
                    {t('login.forgotPasswordModal.emailLabel', 'Email Address')}
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Mail className={`h-5 w-5 ${isDarkMode ? 'text-gray-400' : 'text-gray-400'}`} />
                    </div>
                    <input
                      type="email"
                      value={forgotPasswordEmail}
                      onChange={(e) => {
                        setForgotPasswordEmail(e.target.value);
                        setForgotPasswordError('');
                      }}
                      className={`w-full pl-10 pr-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none transition-colors ${
                        isDarkMode 
                          ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' 
                          : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
                      }`}
                      placeholder={t('login.forgotPasswordModal.emailPlaceholder', 'you@example.com')}
                      autoComplete="email"
                      disabled={isSendingReset}
                      autoFocus
                    />
                  </div>
                </div>

                {/* Buttons */}
                <div className="flex space-x-3">
                  <button
                    type="button"
                    onClick={closeForgotPasswordModal}
                    className={`flex-1 py-3 px-4 rounded-lg font-medium border transition-colors ${
                      isDarkMode
                        ? 'bg-gray-700 border-gray-600 text-white hover:bg-gray-600'
                        : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                    }`}
                    disabled={isSendingReset}
                  >
                    {t('login.forgotPasswordModal.cancel', 'Cancel')}
                  </button>
                  <button
                    type="submit"
                    className={`flex-1 py-3 px-4 rounded-lg font-medium transition-colors ${
                      isSendingReset
                        ? 'bg-blue-400 cursor-not-allowed'
                        : 'bg-blue-600 hover:bg-blue-700'
                    } text-white`}
                    disabled={isSendingReset}
                  >
                    {isSendingReset ? (
                      <div className="flex items-center justify-center">
                        <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                      </div>
                    ) : (
                      t('login.forgotPasswordModal.sendReset', 'Send Reset Link')
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Login;
