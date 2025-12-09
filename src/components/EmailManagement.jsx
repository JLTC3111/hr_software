import React, { useState, useEffect } from 'react';
import { Mail, Plus, X, Star, Check, AlertCircle, Users, Trash2, RefreshCw } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';
import * as userEmailService from '../services/userEmailService';

const EmailManagement = () => {
  const { user } = useAuth();
  const { isDarkMode } = useTheme();
  const { t } = useLanguage();
  
  // State for all users with their emails
  const [usersWithEmails, setUsersWithEmails] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // State for adding new email
  const [showAddEmailModal, setShowAddEmailModal] = useState(false);
  const [selectedUserForEmail, setSelectedUserForEmail] = useState(null);
  const [newEmail, setNewEmail] = useState('');
  const [newAuthUserId, setNewAuthUserId] = useState('');
  const [addingEmail, setAddingEmail] = useState(false);
  
  // Toast notification
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });

  // Theme colors
  const bg = {
    primary: isDarkMode ? 'bg-gray-800' : 'bg-white',
    secondary: isDarkMode ? 'bg-gray-700' : 'bg-gray-50',
    hover: isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-50',
  };
  const text = {
    primary: isDarkMode ? 'text-white' : 'text-gray-900',
    secondary: isDarkMode ? 'text-gray-300' : 'text-gray-600',
    muted: isDarkMode ? 'text-gray-400' : 'text-gray-500',
  };
  const border = isDarkMode ? 'border-gray-600' : 'border-gray-300';

  // Show toast notification
  const showToast = (message, type = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 3000);
  };

  // Load all users with their emails
  const loadUsersWithEmails = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await userEmailService.getAllUsersWithEmails();
      if (response.success) {
        setUsersWithEmails(response.data);
      } else {
        throw new Error(response.error || 'Failed to load users');
      }
    } catch (err) {
      console.error('Error loading users with emails:', err);
      setError(t('emailManagement.errorLoadingUsers') || 'Error loading users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsersWithEmails();
  }, []);

  // Set primary email
  const handleSetPrimaryEmail = async (authUserId, hrUserId) => {
    try {
      await userEmailService.setPrimaryEmail(authUserId);
      showToast(t('emailManagement.primaryEmailSet') || 'Primary email updated successfully');
      await loadUsersWithEmails();
    } catch (err) {
      console.error('Error setting primary email:', err);
      showToast(t('emailManagement.errorSettingPrimary') || 'Error setting primary email', 'error');
    }
  };

  // Unlink email
  const handleUnlinkEmail = async (authUserId, email, userEmailsCount) => {
    if (userEmailsCount <= 1) {
      showToast(t('emailManagement.cannotRemoveLastEmail') || 'Cannot remove the last email', 'error');
      return;
    }
    
    if (window.confirm(t('emailManagement.confirmUnlink', { email }) || `Are you sure you want to unlink ${email}?`)) {
      try {
        await userEmailService.unlinkEmailFromUser(authUserId);
        showToast(t('emailManagement.emailUnlinked') || 'Email unlinked successfully');
        await loadUsersWithEmails();
      } catch (err) {
        console.error('Error unlinking email:', err);
        showToast(err.message || t('emailManagement.errorUnlinking') || 'Error unlinking email', 'error');
      }
    }
  };

  // Link new email to user
  const handleLinkEmail = async () => {
    if (!newEmail || !newAuthUserId) {
      showToast(t('emailManagement.fillAllFields') || 'Please fill all fields', 'error');
      return;
    }

    setAddingEmail(true);
    try {
      await userEmailService.linkEmailToUser(
        selectedUserForEmail.hr_user_id,
        newAuthUserId,
        newEmail,
        false // Not primary by default
      );
      showToast(t('emailManagement.emailLinked') || 'Email linked successfully');
      setShowAddEmailModal(false);
      setNewEmail('');
      setNewAuthUserId('');
      setSelectedUserForEmail(null);
      await loadUsersWithEmails();
    } catch (err) {
      console.error('Error linking email:', err);
      showToast(err.message || t('emailManagement.errorLinking') || 'Error linking email', 'error');
    } finally {
      setAddingEmail(false);
    }
  };

  if (loading) {
    return (
      <div className={`p-6 rounded-lg ${bg.primary} ${text.primary}`}>
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-3">{t('common.loading') || 'Loading...'}</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`p-6 rounded-lg ${bg.primary}`}>
        <div className="flex items-center text-red-600">
          <AlertCircle className="h-5 w-5 mr-2" />
          <span>{error}</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`p-6 rounded-lg ${bg.primary} ${text.primary}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center">
          <Mail className="h-6 w-6 text-blue-600 mr-3" />
          <h2 className="text-2xl font-bold">{t('emailManagement.title') || 'User Email Management'}</h2>
        </div>
        <button
          onClick={loadUsersWithEmails}
          disabled={loading}
          className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          <span>{t('common.refresh') || 'Refresh'}</span>
        </button>
      </div>

      {/* Description */}
      <p className={`mb-6 ${text.secondary}`}>
        {t('emailManagement.description') || 'Manage multiple email addresses for each user. Each email can have its own password but authenticates as the same user.'}
      </p>

      {/* Toast Notification */}
      {toast.show && (
        <div className={`mb-4 p-4 rounded-lg flex items-center ${
          toast.type === 'success' 
            ? 'bg-green-100 text-green-800 border border-green-200' 
            : 'bg-red-100 text-red-800 border border-red-200'
        }`}>
          {toast.type === 'success' ? (
            <Check className="h-5 w-5 mr-2 shrink-0" />
          ) : (
            <AlertCircle className="h-5 w-5 mr-2 shrink-0" />
          )}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Users List */}
      <div className="space-y-4">
        {usersWithEmails.map((userGroup) => (
          <div key={userGroup.hr_user_id} className={`border ${border} rounded-lg p-4 ${bg.secondary}`}>
            {/* User Header */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center">
                <Users className="h-5 w-5 text-blue-600 mr-2" />
                <h3 className="font-semibold text-lg">
                  {userGroup.first_name} {userGroup.last_name}
                </h3>
                <span className={`ml-3 text-sm ${text.muted}`}>
                  ({userGroup.role})
                </span>
              </div>
              <button
                onClick={() => {
                  setSelectedUserForEmail(userGroup);
                  setShowAddEmailModal(true);
                }}
                className="flex items-center px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors text-sm"
              >
                <Plus className="h-4 w-4 mr-1" />
                {t('emailManagement.addEmail') || 'Add Email'}
              </button>
            </div>

            {/* Emails List */}
            <div className="space-y-2 ml-7">
              {userGroup.emails.map((emailData) => (
                <div key={emailData.auth_user_id} className="flex items-center justify-between p-2 rounded hover:bg-opacity-50 transition-colors">
                  <div className="flex items-center flex-1">
                    <Mail className={`h-4 w-4 mr-2 ${emailData.is_primary ? 'text-yellow-500' : text.muted}`} />
                    <span className={emailData.is_primary ? 'font-medium' : ''}>
                      {emailData.email}
                    </span>
                    {emailData.is_primary && (
                      <span className="ml-2 flex items-center text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded">
                        <Star className="h-3 w-3 mr-1" />
                        {t('emailManagement.primary') || 'Primary'}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center space-x-2">
                    {!emailData.is_primary && (
                      <button
                        onClick={() => handleSetPrimaryEmail(emailData.auth_user_id, userGroup.hr_user_id)}
                        className="px-2 py-1 text-xs bg-yellow-100 text-yellow-800 rounded hover:bg-yellow-200 transition-colors"
                        title={t('emailManagement.setPrimary') || 'Set as primary'}
                      >
                        <Star className="h-3 w-3" />
                      </button>
                    )}
                    <button
                      onClick={() => handleUnlinkEmail(emailData.auth_user_id, emailData.email, userGroup.emails.length)}
                      className="px-2 py-1 text-xs bg-red-100 text-red-800 rounded hover:bg-red-200 transition-colors"
                      title={t('emailManagement.unlink') || 'Unlink'}
                      disabled={userGroup.emails.length === 1}
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Add Email Modal */}
      {showAddEmailModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className={`${bg.primary} rounded-lg p-6 max-w-md w-full mx-4`}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold">{t('emailManagement.addEmailFor') || 'Add Email for'} {selectedUserForEmail?.first_name} {selectedUserForEmail?.last_name}</h3>
              <button
                onClick={() => {
                  setShowAddEmailModal(false);
                  setNewEmail('');
                  setNewAuthUserId('');
                  setSelectedUserForEmail(null);
                }}
                className={`${text.muted} hover:${text.primary}`}
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className={`block text-sm font-medium mb-1 ${text.secondary}`}>
                  {t('emailManagement.emailAddress') || 'Email Address'}
                </label>
                <input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className={`w-full px-3 py-2 border ${border} rounded-lg ${bg.secondary} ${text.primary}`}
                  placeholder="user@example.com"
                />
              </div>

              <div>
                <label className={`block text-sm font-medium mb-1 ${text.secondary}`}>
                  {t('emailManagement.authUserId') || 'Auth User ID'}
                </label>
                <input
                  type="text"
                  value={newAuthUserId}
                  onChange={(e) => setNewAuthUserId(e.target.value)}
                  className={`w-full px-3 py-2 border ${border} rounded-lg ${bg.secondary} ${text.primary}`}
                  placeholder="UUID from auth.users"
                />
                <p className={`text-xs mt-1 ${text.muted}`}>
                  {t('emailManagement.authUserIdHelp') || 'Get this from Supabase Auth dashboard after creating the account'}
                </p>
              </div>

              <div className="flex justify-end space-x-3 mt-6">
                <button
                  onClick={() => {
                    setShowAddEmailModal(false);
                    setNewEmail('');
                    setNewAuthUserId('');
                    setSelectedUserForEmail(null);
                  }}
                  className={`px-4 py-2 border ${border} rounded-lg ${text.primary} ${bg.hover}`}
                >
                  {t('common.cancel') || 'Cancel'}
                </button>
                <button
                  onClick={handleLinkEmail}
                  disabled={addingEmail}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {addingEmail ? t('common.adding') || 'Adding...' : t('emailManagement.linkEmail') || 'Link Email'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EmailManagement;
