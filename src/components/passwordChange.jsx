import React, { useState } from 'react';
import { Eye, EyeOff, Lock, AlertCircle, CheckCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useNavigate } from 'react-router-dom';

const PasswordChange = () => {
  const { user, changePassword } = useAuth();
  const { isDarkMode, text } = useTheme();
  const { t } = useLanguage();
  const navigate = useNavigate();
  
  const [formData, setFormData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false
  });
  
  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const toggleShowPassword = (field) => {
    setShowPasswords(prev => ({
      ...prev,
      [field]: !prev[field]
    }));
  };

  const validatePassword = (password) => {
    const errors = [];
    if (password.length < 8) {
      errors.push(t('passwordChange.validation.minLength', 'At least 8 characters'));
    }
    if (!/[A-Z]/.test(password)) {
      errors.push(t('passwordChange.validation.uppercase', 'One uppercase letter'));
    }
    if (!/[a-z]/.test(password)) {
      errors.push(t('passwordChange.validation.lowercase', 'One lowercase letter'));
    }
    if (!/\d/.test(password)) {
      errors.push(t('passwordChange.validation.number', 'One number'));
    }
    if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      errors.push(t('passwordChange.validation.special', 'One special character'));
    }
    return errors;
  };

  const validateForm = () => {
    const newErrors = {};
    
    if (!formData.currentPassword) {
      newErrors.currentPassword = t('passwordChange.currentPasswordRequired', 'Current password is required');
    }
    
    if (!formData.newPassword) {
      newErrors.newPassword = t('passwordChange.newPasswordRequired', 'New password is required');
    } else {
      const passwordValidation = validatePassword(formData.newPassword);
      if (passwordValidation.length > 0) {
        newErrors.newPassword = passwordValidation.join(', ');
      }
    }
    
    if (!formData.confirmPassword) {
      newErrors.confirmPassword = t('passwordChange.confirmPasswordRequired', 'Please confirm your password');
    } else if (formData.newPassword !== formData.confirmPassword) {
      newErrors.confirmPassword = t('passwordChange.passwordMismatch', 'Passwords do not match');
    }
    
    if (formData.currentPassword === formData.newPassword) {
      newErrors.newPassword = t('passwordChange.samePassword', 'New password must be different from current password');
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) return;
    
    setIsLoading(true);
    
    const result = await changePassword(formData.currentPassword, formData.newPassword);
    
    if (result.success) {
      setSuccess(true);
      setTimeout(() => {
        navigate('/dashboard');
      }, 2000);
    } else {
      setErrors({ submit: result.error });
      setIsLoading(false);
    }
  };

  const isTemporaryPassword = user?.mustChangePassword;

  return (
    <div className={`min-h-screen flex items-center justify-center ${isDarkMode ? 'bg-gray-900' : 'bg-gray-50'} transition-colors duration-200`}>
      <div className="relative w-full max-w-md px-6">
        <div className={`${isDarkMode ? 'bg-gray-800' : 'bg-white'} rounded-2xl shadow-2xl p-8 transition-colors duration-200`}>
          {/* Header */}
          <div className="text-center mb-8">
            <div className={`inline-flex items-center justify-center w-16 h-16 rounded-full mb-4 ${isDarkMode ? 'bg-blue-600' : 'bg-blue-500'}`}>
              <Lock className="w-8 h-8 text-white" />
            </div>
            <h1 className={`text-3xl font-bold ${text.primary} mb-2`}>
              {isTemporaryPassword 
                ? t('passwordChange.titleRequired', 'Password Change Required')
                : t('passwordChange.title', 'Change Password')
              }
            </h1>
            <p className={`${text.secondary} text-sm`}>
              {isTemporaryPassword 
                ? t('passwordChange.subtitleRequired', 'You must change your temporary password to continue')
                : t('passwordChange.subtitle', 'Update your account password')
              }
            </p>
          </div>

          {/* Success Message */}
          {success && (
            <div className="mb-6 p-4 bg-green-100 dark:bg-green-900/30 border border-green-400 dark:border-green-700 rounded-lg flex items-center space-x-2 text-green-700 dark:text-green-400">
              <CheckCircle className="w-5 h-5 flex-shrink-0" />
              <span className="text-sm">{t('passwordChange.success', 'Password changed successfully! Redirecting...')}</span>
            </div>
          )}

          {/* Form Error */}
          {errors.submit && (
            <div className="mb-6 p-3 bg-red-100 dark:bg-red-900/30 border border-red-400 dark:border-red-700 rounded-lg flex items-center space-x-2 text-red-700 dark:text-red-400">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <span className="text-sm">{errors.submit}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Current Password */}
            <div>
              <label className={`block text-sm font-medium ${text.primary} mb-2`}>
                {t('passwordChange.currentPassword', 'Current Password')}
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className={`h-5 w-5 ${isDarkMode ? 'text-gray-400' : 'text-gray-400'}`} />
                </div>
                <input
                  type={showPasswords.current ? 'text' : 'password'}
                  name="currentPassword"
                  value={formData.currentPassword}
                  onChange={handleChange}
                  className={`w-full pl-10 pr-12 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none transition-colors ${
                    isDarkMode 
                      ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' 
                      : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
                  } ${errors.currentPassword ? 'border-red-500 focus:ring-red-500' : ''}`}
                  placeholder={t('passwordChange.currentPasswordPlaceholder', 'Enter current password')}
                  disabled={isLoading}
                />
                <button
                  type="button"
                  onClick={() => toggleShowPassword('current')}
                  className={`absolute inset-y-0 right-0 pr-3 flex items-center ${isDarkMode ? 'text-gray-400 hover:text-gray-300' : 'text-gray-400 hover:text-gray-600'}`}
                  disabled={isLoading}
                >
                  {showPasswords.current ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
              {errors.currentPassword && (
                <p className="mt-1 text-sm text-red-500 flex items-center">
                  <AlertCircle className="w-4 h-4 mr-1" />
                  {errors.currentPassword}
                </p>
              )}
            </div>

            {/* New Password */}
            <div>
              <label className={`block text-sm font-medium ${text.primary} mb-2`}>
                {t('passwordChange.newPassword', 'New Password')}
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className={`h-5 w-5 ${isDarkMode ? 'text-gray-400' : 'text-gray-400'}`} />
                </div>
                <input
                  type={showPasswords.new ? 'text' : 'password'}
                  name="newPassword"
                  value={formData.newPassword}
                  onChange={handleChange}
                  className={`w-full pl-10 pr-12 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none transition-colors ${
                    isDarkMode 
                      ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' 
                      : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
                  } ${errors.newPassword ? 'border-red-500 focus:ring-red-500' : ''}`}
                  placeholder={t('passwordChange.newPasswordPlaceholder', 'Enter new password')}
                  disabled={isLoading}
                />
                <button
                  type="button"
                  onClick={() => toggleShowPassword('new')}
                  className={`absolute inset-y-0 right-0 pr-3 flex items-center ${isDarkMode ? 'text-gray-400 hover:text-gray-300' : 'text-gray-400 hover:text-gray-600'}`}
                  disabled={isLoading}
                >
                  {showPasswords.new ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
              {errors.newPassword && (
                <p className="mt-1 text-sm text-red-500 flex items-center">
                  <AlertCircle className="w-4 h-4 mr-1" />
                  {errors.newPassword}
                </p>
              )}
              
              {/* Password Requirements */}
              <div className="mt-2 text-xs text-gray-500 space-y-1">
                <p>{t('passwordChange.requirements', 'Password must contain:')}</p>
                <ul className="list-disc list-inside space-y-0.5 ml-2">
                  <li>{t('passwordChange.req1', 'At least 8 characters')}</li>
                  <li>{t('passwordChange.req2', 'One uppercase and lowercase letter')}</li>
                  <li>{t('passwordChange.req3', 'One number and special character')}</li>
                </ul>
              </div>
            </div>

            {/* Confirm Password */}
            <div>
              <label className={`block text-sm font-medium ${text.primary} mb-2`}>
                {t('passwordChange.confirmPassword', 'Confirm New Password')}
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className={`h-5 w-5 ${isDarkMode ? 'text-gray-400' : 'text-gray-400'}`} />
                </div>
                <input
                  type={showPasswords.confirm ? 'text' : 'password'}
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  className={`w-full pl-10 pr-12 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none transition-colors ${
                    isDarkMode 
                      ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' 
                      : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
                  } ${errors.confirmPassword ? 'border-red-500 focus:ring-red-500' : ''}`}
                  placeholder={t('passwordChange.confirmPasswordPlaceholder', 'Confirm new password')}
                  disabled={isLoading}
                />
                <button
                  type="button"
                  onClick={() => toggleShowPassword('confirm')}
                  className={`absolute inset-y-0 right-0 pr-3 flex items-center ${isDarkMode ? 'text-gray-400 hover:text-gray-300' : 'text-gray-400 hover:text-gray-600'}`}
                  disabled={isLoading}
                >
                  {showPasswords.confirm ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
              {errors.confirmPassword && (
                <p className="mt-1 text-sm text-red-500 flex items-center">
                  <AlertCircle className="w-4 h-4 mr-1" />
                  {errors.confirmPassword}
                </p>
              )}
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading || success}
              className={`w-full py-3 px-4 rounded-lg font-medium transition-all duration-200 ${
                isLoading || success
                  ? 'bg-blue-400 cursor-not-allowed' 
                  : 'bg-blue-600 hover:bg-blue-700 active:scale-[0.98]'
              } text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2`}
            >
              {isLoading ? (
                <div className="flex items-center justify-center">
                  <svg className="animate-spin h-5 w-5 mr-3" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  {t('passwordChange.changing', 'Changing Password...')}
                </div>
              ) : success ? (
                t('passwordChange.changed', 'Password Changed!')
              ) : (
                t('passwordChange.changePassword', 'Change Password')
              )}
            </button>
          </form>

          {/* Skip Option (only for non-required changes) */}
          {!isTemporaryPassword && (
            <div className="mt-6 text-center">
              <button
                type="button"
                onClick={() => navigate('/dashboard')}
                className="text-sm text-blue-600 hover:text-blue-500 font-medium"
                disabled={isLoading}
              >
                {t('passwordChange.cancel', 'Cancel')}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PasswordChange;