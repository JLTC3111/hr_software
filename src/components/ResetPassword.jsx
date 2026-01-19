import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';
import { Lock, Eye, EyeOff, CheckCircle, AlertCircle, Loader, Sun, Moon, Languages } from 'lucide-react';
import { supabase } from '../config/supabaseClient';

const ResetPassword = () => {
  const navigate = useNavigate();
  const { resetPassword } = useAuth();
  const { isDarkMode, bg, text, toggleTheme } = useTheme();
  const { language, changeLanguage, t } = useLanguage();

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showLanguageMenu, setShowLanguageMenu] = useState(false);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [hasValidSession, setHasValidSession] = useState(false);

  // Check if we have a valid session (user clicked the reset link)
  useEffect(() => {
    let mounted = true;
    
    const checkSession = async () => {
      try {
        console.log('🔍 Starting session check...');
        console.log('Current URL:', window.location.href);
        
        const devMode = new URLSearchParams(window.location.search).get('dev');

        // Allow dev mode on localhost for UI testing
        if (devMode === 'true' && window.location.hostname === 'localhost') {
          console.log('⚠️ DEV MODE: Skipping session validation (UI testing only)');
          setHasValidSession(true);
          setSessionLoading(false);
          return;
        }

        // Wait a moment for Supabase detectSessionInUrl to process the URL
        console.log('⏳ Waiting for Supabase to detect and process session from URL...');
        await new Promise(resolve => setTimeout(resolve, 1500));

        // Check if session was established
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
      const result = await resetPassword(newPassword);
      
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
        setError(result?.error || t('resetPassword.error', 'Failed to reset password. Please try again.'));
        setLoading(false);
      }
    } catch (err) {
      console.error('❌ Exception during password reset:', err);
      setError(err.message || t('resetPassword.error', 'Failed to reset password. Please try again.'));
      setLoading(false);
    }
  };

  const languages = [
    { code: 'en', name: 'English', flagPath: '/flags/gb.svg' },
    { code: 'vn', name: 'Tiếng Việt', flagPath: '/flags/vn.svg' },
    { code: 'de', name: 'Deutsch', flagPath: '/flags/de.svg' },
    { code: 'es', name: 'Español', flagPath: '/flags/es.svg' },
    { code: 'fr', name: 'Français', flagPath: '/flags/fr.svg' },
    { code: 'jp', name: '日本語', flagPath: '/flags/jp.svg' },
    { code: 'kr', name: '한국어', flagPath: '/flags/kr.svg' },
    { code: 'ru', name: 'Русский', flagPath: '/flags/ru.svg' },
    { code: 'th', name: 'ไทย', flagPath: '/flags/th.svg' },
  ];

  return (
    <div className={`min-h-screen flex items-center justify-center ${isDarkMode ? 'bg-gray-900' : 'bg-gray-50'} transition-colors duration-200 p-4`}>
      {/* Theme and Language Switchers - Top Right */}
      <div className="fixed top-4 right-4 flex items-center gap-2 z-50">
        {/* Theme Toggle */}
        <button
          onClick={toggleTheme}
          className={`p-2.5 rounded-lg transition-all duration-200 ${
            isDarkMode
              ? 'bg-gray-800 text-yellow-400 hover:bg-gray-700'
              : 'bg-white text-gray-700 hover:bg-gray-100 shadow-md'
          }`}
          aria-label="Toggle theme"
        >
          {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
        </button>

        {/* Language Selector */}
        <div className="relative">
          <button
            onClick={() => setShowLanguageMenu(!showLanguageMenu)}
            className={`p-2.5 rounded-lg transition-all duration-200 flex items-center gap-2 ${
              isDarkMode
                ? 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                : 'bg-white text-gray-700 hover:bg-gray-100 shadow-md'
            }`}
            aria-label="Change language"
          >
            <Languages className="w-5 h-5" />
            <img 
              src={languages.find(l => l.code === language)?.flagPath} 
              alt="" 
              className="w-5 h-5 rounded-sm"
            />
          </button>

          {/* Language Dropdown */}
          {showLanguageMenu && (
            <div
              className={`absolute right-0 mt-2 w-48 rounded-lg shadow-xl overflow-hidden ${
                isDarkMode ? 'bg-gray-800 border border-gray-700' : 'bg-white border border-gray-200'
              }`}
            >
              {languages.map((lang) => (
                <button
                  key={lang.code}
                  onClick={() => {
                    changeLanguage(lang.code);
                    setShowLanguageMenu(false);
                  }}
                  className={`w-full px-4 py-2.5 flex items-center gap-3 transition-colors ${
                    language === lang.code
                      ? isDarkMode
                        ? 'bg-blue-900/50 text-blue-300'
                        : 'bg-blue-50 text-blue-600'
                      : isDarkMode
                      ? 'text-gray-300 hover:bg-gray-700'
                      : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <img 
                    src={lang.flagPath} 
                    alt="" 
                    className="w-5 h-5 rounded-sm"
                  />
                  <span className="text-sm font-medium">{lang.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className={`max-w-md w-full ${isDarkMode ? 'bg-gray-800' : 'bg-white'} rounded-2xl shadow-xl p-8`}>
        {/* Loading State */}
        {sessionLoading && (
          <div className="text-center py-12">
            <Loader className={`w-12 h-12 ${isDarkMode ? 'text-blue-400' : 'text-blue-600'} animate-spin mx-auto mb-4`} />
            <p className={`${text.secondary}`}>Verifying reset link...</p>
          </div>
        )}

        {/* Content - Show only when session is verified */}
        {!sessionLoading && (
          <>
            {/* Header */}
            <div className="text-center mb-8">
              <div className={`inline-flex items-center justify-center w-16 h-16 rounded-full mb-4 ${isDarkMode ? 'bg-blue-900' : 'bg-blue-100'}`}>
                <Lock className={`w-8 h-8 ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`} />
              </div>
              <h1 className={`text-3xl font-bold ${text.primary} mb-2`}>
                {t('resetPassword.title', 'Reset Password')}
              </h1>
              <p className={`text-sm ${text.secondary}`}>
                {t('resetPassword.subtitle', 'Enter your new password below')}
              </p>
            </div>

        {/* Success Message */}
        {success && (
          <div className={`mb-6 p-4 rounded-lg flex items-start space-x-3 ${
            isDarkMode ? 'bg-green-900/20 border border-green-700' : 'bg-green-50 border border-green-200'
          }`}>
            <CheckCircle className={`w-5 h-5 ${isDarkMode ? 'text-green-400' : 'text-green-600'} shrink-0 mt-0.5`} />
            <div>
              <p className={`text-sm font-medium ${isDarkMode ? 'text-green-400' : 'text-green-800'}`}>
                {t('resetPassword.success', 'Password reset successfully!')}
              </p>
              <p className={`text-sm ${isDarkMode ? 'text-green-300' : 'text-green-700'} mt-1`}>
                {t('resetPassword.redirecting', 'Redirecting to login...')}
              </p>
            </div>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className={`mb-6 p-4 rounded-lg flex items-start space-x-3 ${
            isDarkMode ? 'bg-red-900/20 border border-red-700' : 'bg-red-50 border border-red-200'
          }`}>
            <AlertCircle className={`w-5 h-5 ${isDarkMode ? 'text-red-400' : 'text-red-600'} shrink-0 mt-0.5`} />
            <span className={`text-sm ${isDarkMode ? 'text-red-400' : 'text-red-700'}`}>{error}</span>
          </div>
        )}

        {/* Form - Only show if we have a valid session */}
        {!success && hasValidSession && (
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* New Password */}
            <div>
              <label className={`block text-sm font-medium ${text.primary} mb-2`}>
                {t('resetPassword.newPassword', 'New Password')}
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className={`h-5 w-5 ${isDarkMode ? 'text-gray-400' : 'text-gray-400'}`} />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => {
                    setNewPassword(e.target.value);
                    setError('');
                  }}
                  className={`w-full pl-10 pr-12 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none transition-colors ${
                    isDarkMode 
                      ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' 
                      : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
                  }`}
                  placeholder={t('resetPassword.newPasswordPlaceholder', 'Enter new password')}
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  disabled={loading}
                >
                  {showPassword ? (
                    <EyeOff className={`h-5 w-5 ${isDarkMode ? 'text-gray-400' : 'text-gray-400'}`} />
                  ) : (
                    <Eye className={`h-5 w-5 ${isDarkMode ? 'text-gray-400' : 'text-gray-400'}`} />
                  )}
                </button>
              </div>
            </div>

            {/* Confirm Password */}
            <div>
              <label className={`block text-sm font-medium ${text.primary} mb-2`}>
                {t('resetPassword.confirmPassword', 'Confirm Password')}
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className={`h-5 w-5 ${isDarkMode ? 'text-gray-400' : 'text-gray-400'}`} />
                </div>
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    setError('');
                  }}
                  className={`w-full pl-10 pr-12 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none transition-colors ${
                    isDarkMode 
                      ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' 
                      : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
                  }`}
                  placeholder={t('resetPassword.confirmPasswordPlaceholder', 'Confirm new password')}
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  disabled={loading}
                >
                  {showConfirmPassword ? (
                    <EyeOff className={`h-5 w-5 ${isDarkMode ? 'text-gray-400' : 'text-gray-400'}`} />
                  ) : (
                    <Eye className={`h-5 w-5 ${isDarkMode ? 'text-gray-400' : 'text-gray-400'}`} />
                  )}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              className={`w-full py-3 px-4 rounded-lg font-medium transition-colors ${
                loading
                  ? 'bg-blue-400 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700'
              } text-white`}
              disabled={loading}
            >
              {loading ? (
                <div className="flex items-center justify-center">
                  <Loader className="animate-spin h-5 w-5 mr-2" />
                  {t('resetPassword.resetting', 'Resetting...')}
                </div>
              ) : (
                t('resetPassword.resetButton', 'Reset Password')
              )}
            </button>
          </form>
        )}

        {/* Back to Login */}
        {!sessionLoading && (
          <div className="mt-6 text-center">
            <button
              onClick={() => navigate('/login')}
              className={`text-sm ${isDarkMode ? 'text-blue-400 hover:text-blue-300' : 'text-blue-600 hover:text-blue-700'} transition-colors`}
            >
              {t('resetPassword.backToLogin', 'Back to Login')}
            </button>
          </div>
        )}
          </>
        )}
      </div>
    </div>
  );
};

export default ResetPassword;
