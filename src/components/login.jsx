import React, { useState, useEffect } from 'react';
import { Eye, EyeOff, Lock, Mail, Building2, AlertCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';
import ThemeToggle from './themeToggle';
import LanguageSelector from './LanguageSelector';
import { useNavigate } from 'react-router-dom';

const Login = () => {
  const { login, loginWithGithub, isAuthenticated, user, loading } = useAuth();
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
  const [isGithubLoading, setIsGithubLoading] = useState(false);
  const [loginError, setLoginError] = useState('');

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
    
    const result = await login(formData.email, formData.password, rememberMe);
    
    if (!result.success) {
      setLoginError(result.error || t('login.invalidCredentials', 'Invalid email or password'));
      setIsLoading(false);
    }
  };

  const handleGithubLogin = async () => {
    setLoginError('');
    setIsGithubLoading(true);
    
    const result = await loginWithGithub();
    
    if (!result.success) {
      setLoginError(result.error || t('login.githubError', 'Failed to login with GitHub'));
      setIsGithubLoading(false);
    }
    // Note: If successful, the browser will redirect to GitHub OAuth page
    // The loading state will remain true until redirect happens
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
            <div className="mb-6 p-3 bg-red-100 dark:bg-red-900/30 border border-red-400 dark:border-red-700 rounded-lg flex items-center space-x-2 text-red-700 dark:text-red-400">
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
                  disabled={isLoading}
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
                  disabled={isLoading}
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
                disabled={isLoading}
              />
                <span className={`ml-2 text-sm ${text.secondary} cursor-pointer`}>
                  {t('login.rememberMe')}
                </span>
              </label>
              <button
                type="button"
                className="text-sm text-blue-600 hover:text-blue-500 font-medium cursor-pointer"
                disabled={isLoading}
              >
                {t('login.forgotPassword')}
              </button>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className={`w-full py-3 px-4 rounded-lg font-medium bg-blue-300 text-white transition-all duration-200 cursor-pointer ${
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

          {/* GitHub OAuth Button */}
          <button
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
          </button>

          {/* Sign Up Link */}
          <p className={`mt-6 text-center text-sm ${text.secondary}`}>
            {t('login.noAccount', "Don't have an account?")}{' '}
            <button
              type="button"
              className="text-blue-600 hover:text-blue-500 font-medium"
              disabled={isLoading}
            >
              {t('login.signUp', 'Sign up')}
            </button>
          </p>
        </div>

        {/* Footer */}
        <p className={`mt-8 text-center text-xs ${text.secondary}`}>
          {t('login.footer', '© 2024 HR Manager. All rights reserved.')}
        </p>
      </div>
    </div>
  );
};

export default Login;
