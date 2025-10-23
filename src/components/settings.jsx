import React, { useState, useEffect } from 'react';
import { 
  Settings as SettingsIcon, 
  Bell, 
  Palette, 
  Globe, 
  Shield, 
  Briefcase, 
  Save, 
  RotateCcw,
  Download,
  Upload,
  Check,
  X,
  Loader,
  User,
  Mail,
  Phone,
  Eye,
  EyeOff
} from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { useNotifications } from '../contexts/NotificationContext';
import * as settingsService from '../services/settingsService';

const Settings = () => {
  const { bg, text, border, hover, isDarkMode, toggleTheme } = useTheme();
  const { t, changeLanguage, currentLanguage } = useLanguage();
  const { user } = useAuth();
  const { requestNotificationPermission } = useNotifications();

  const [activeTab, setActiveTab] = useState('notifications');
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Load settings on mount
  useEffect(() => {
    loadSettings();
  }, [user?.id]);

  const loadSettings = async () => {
    if (!user?.id) return;

    setLoading(true);
    const result = await settingsService.getUserSettings(user.id);
    
    if (result.success) {
      setSettings(result.data);
    }
    
    setLoading(false);
  };

  const handleSettingChange = (field, value) => {
    setSettings(prev => ({ ...prev, [field]: value }));
    setHasChanges(true);
    setSaveSuccess(false);
  };

  const saveSettings = async () => {
    if (!user?.id || !settings) return;

    setSaving(true);
    const result = await settingsService.updateUserSettings(user.id, settings);
    
    if (result.success) {
      setSettings(result.data);
      setHasChanges(false);
      setSaveSuccess(true);
      
      // Apply theme if changed
      if (result.data.theme !== 'system') {
        const shouldBeDark = result.data.theme === 'dark';
        if (shouldBeDark !== isDarkMode) {
          toggleTheme();
        }
      }

      // Apply language if changed
      if (result.data.language !== currentLanguage) {
        changeLanguage(result.data.language);
      }

      setTimeout(() => setSaveSuccess(false), 3000);
    }
    
    setSaving(false);
  };

  const resetSettings = async () => {
    if (!window.confirm(t('settings.confirmReset', 'Are you sure you want to reset all settings to default?'))) {
      return;
    }

    setSaving(true);
    const result = await settingsService.resetToDefault(user.id);
    
    if (result.success) {
      setSettings(result.data);
      setHasChanges(false);
      window.location.reload(); // Reload to apply all changes
    }
    
    setSaving(false);
  };

  const exportSettings = async () => {
    const result = await settingsService.exportSettings(user.id);
    if (result.success) {
      const blob = new Blob([result.data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `hr_settings_${user.id}.json`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  const importSettings = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const result = await settingsService.importSettings(user.id, e.target.result);
        if (result.success) {
          setSettings(result.data);
          setHasChanges(false);
          alert(t('settings.importSuccess', 'Settings imported successfully!'));
          window.location.reload();
        }
      } catch (error) {
        alert(t('settings.importError', 'Failed to import settings'));
      }
    };
    reader.readAsText(file);
  };

  const tabs = [
    { id: 'notifications', label: t('settings.notifications', 'Notifications'), icon: Bell },
    { id: 'appearance', label: t('settings.appearance', 'Appearance'), icon: Palette },
    { id: 'language', label: t('settings.language', 'Language'), icon: Globe },
    { id: 'privacy', label: t('settings.privacy', 'Privacy'), icon: Shield },
    { id: 'work', label: t('settings.work', 'Work Preferences'), icon: Briefcase }
  ];

  if (loading) {
    return (
      <div className={`p-8 ${bg.primary} min-h-screen`}>
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-center py-12">
            <Loader className="w-12 h-12 animate-spin text-blue-600" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`p-4 md:p-8 ${bg.primary} min-h-screen`}>
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className={`${bg.secondary} rounded-lg shadow-sm border ${border.primary} p-6 mb-6`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <SettingsIcon className="h-8 w-8 text-blue-600" />
              <div>
                <h1 className={`text-2xl font-bold ${text.primary}`}>
                  {t('settings.title', 'Settings')}
                </h1>
                <p className={`text-sm ${text.secondary}`}>
                  {t('settings.subtitle', 'Manage your preferences and account settings')}
                </p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center space-x-2">
              {saveSuccess && (
                <div className="flex items-center space-x-2 px-4 py-2 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-lg">
                  <Check className="h-4 w-4" />
                  <span className="text-sm font-medium">{t('settings.saved', 'Saved!')}</span>
                </div>
              )}
              
              <button
                onClick={exportSettings}
                className={`px-4 py-2 rounded-lg ${hover.bg} ${text.secondary} flex items-center space-x-2 transition-colors`}
                title={t('settings.export', 'Export settings')}
              >
                <Download className="h-4 w-4" />
                <span className="hidden sm:inline">{t('settings.export', 'Export')}</span>
              </button>

              <label className={`px-4 py-2 rounded-lg ${hover.bg} ${text.secondary} flex items-center space-x-2 transition-colors cursor-pointer`}>
                <Upload className="h-4 w-4" />
                <span className="hidden sm:inline">{t('settings.import', 'Import')}</span>
                <input
                  type="file"
                  accept=".json"
                  onChange={importSettings}
                  className="hidden"
                />
              </label>

              <button
                onClick={resetSettings}
                className={`px-4 py-2 rounded-lg ${hover.bg} ${text.secondary} flex items-center space-x-2 transition-colors`}
                title={t('settings.reset', 'Reset to defaults')}
              >
                <RotateCcw className="h-4 w-4" />
                <span className="hidden sm:inline">{t('settings.reset', 'Reset')}</span>
              </button>

              {hasChanges && (
                <button
                  onClick={saveSettings}
                  disabled={saving}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center space-x-2 transition-colors disabled:opacity-50"
                >
                  {saving ? (
                    <Loader className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  <span>{t('settings.saveChanges', 'Save Changes')}</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Content Area - Full Width */}
        <div className={`${bg.secondary} rounded-lg shadow-sm border ${border.primary} p-4 md:p-6 mb-6`}>
            {/* Notifications Settings */}
            {activeTab === 'notifications' && (
              <div className="space-y-6">
                <div>
                  <h2 className={`text-xl font-bold ${text.primary} mb-4`}>
                    {t('settings.notificationPreferences', 'Notification Preferences')}
                  </h2>
                  
                  {/* Notification Channels */}
                  <div className="space-y-4">
                    <SettingToggle
                      label={t('settings.emailNotifications', 'Email Notifications')}
                      description={t('settings.emailNotificationsDesc', 'Receive notifications via email')}
                      checked={settings?.email_notifications}
                      onChange={(checked) => handleSettingChange('email_notifications', checked)}
                    />
                    
                    <SettingToggle
                      label={t('settings.pushNotifications', 'Push Notifications')}
                      description={t('settings.pushNotificationsDesc', 'Receive push notifications in the app')}
                      checked={settings?.push_notifications}
                      onChange={(checked) => handleSettingChange('push_notifications', checked)}
                    />
                    
                    <SettingToggle
                      label={t('settings.desktopNotifications', 'Desktop Notifications')}
                      description={t('settings.desktopNotificationsDesc', 'Show browser notifications on desktop')}
                      checked={settings?.desktop_notifications}
                      onChange={async (checked) => {
                        if (checked) {
                          const granted = await requestNotificationPermission();
                          if (granted) {
                            handleSettingChange('desktop_notifications', true);
                          }
                        } else {
                          handleSettingChange('desktop_notifications', false);
                        }
                      }}
                    />
                  </div>

                  {/* Notification Frequency */}
                  <div className="mt-6">
                    <label className={`block text-sm font-medium ${text.secondary} mb-2`}>
                      {t('settings.notificationFrequency', 'Notification Frequency')}
                    </label>
                    <select
                      value={settings?.notification_frequency || 'realtime'}
                      onChange={(e) => handleSettingChange('notification_frequency', e.target.value)}
                      className={`w-full px-4 py-2 ${bg.primary} ${text.primary} border ${border.primary} rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500`}
                    >
                      <option value="realtime">{t('settings.realtime', 'Real-time')}</option>
                      <option value="daily">{t('settings.daily', 'Daily Digest')}</option>
                      <option value="weekly">{t('settings.weekly', 'Weekly Summary')}</option>
                    </select>
                  </div>

                  {/* Category Notifications */}
                  <div className="mt-6">
                    <h3 className={`text-lg font-semibold ${text.primary} mb-4`}>
                      {t('settings.notifyMeAbout', 'Notify me about')}
                    </h3>
                    <div className="space-y-3">
                      <SettingToggle
                        label={t('settings.timeTrackingNotifications', 'Time Tracking')}
                        checked={settings?.notify_time_tracking}
                        onChange={(checked) => handleSettingChange('notify_time_tracking', checked)}
                      />
                      <SettingToggle
                        label={t('settings.performanceNotifications', 'Performance Reviews')}
                        checked={settings?.notify_performance}
                        onChange={(checked) => handleSettingChange('notify_performance', checked)}
                      />
                      <SettingToggle
                        label={t('settings.employeeNotifications', 'Employee Updates')}
                        checked={settings?.notify_employee_updates}
                        onChange={(checked) => handleSettingChange('notify_employee_updates', checked)}
                      />
                      <SettingToggle
                        label={t('settings.recruitmentNotifications', 'Recruitment')}
                        checked={settings?.notify_recruitment}
                        onChange={(checked) => handleSettingChange('notify_recruitment', checked)}
                      />
                      <SettingToggle
                        label={t('settings.systemNotifications', 'System Updates')}
                        checked={settings?.notify_system}
                        onChange={(checked) => handleSettingChange('notify_system', checked)}
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Appearance Settings */}
            {activeTab === 'appearance' && (
              <div className="space-y-6">
                <h2 className={`text-xl font-bold ${text.primary} mb-4`}>
                  {t('settings.appearanceSettings', 'Appearance Settings')}
                </h2>

                {/* Theme Selection */}
                <div>
                  <label className={`block text-sm font-medium ${text.secondary} mb-2`}>
                    {t('settings.theme', 'Theme')}
                  </label>
                  <div className="grid grid-cols-3 gap-4">
                    {settingsService.getAvailableThemes().map((theme) => (
                      <button
                        key={theme.value}
                        onClick={() => handleSettingChange('theme', theme.value)}
                        className={`
                          p-4 rounded-lg border-2 transition-all
                          ${settings?.theme === theme.value 
                            ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/30' 
                            : `border-gray-300 dark:border-gray-600 ${hover.bg}`
                          }
                        `}
                      >
                        <div className={`font-medium ${text.primary}`}>{theme.label}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Date Format */}
                <div>
                  <label className={`block text-sm font-medium ${text.secondary} mb-2`}>
                    {t('settings.dateFormat', 'Date Format')}
                  </label>
                  <select
                    value={settings?.date_format || 'MM/DD/YYYY'}
                    onChange={(e) => handleSettingChange('date_format', e.target.value)}
                    className={`w-full px-4 py-2 ${bg.primary} ${text.primary} border ${border.primary} rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500`}
                  >
                    {settingsService.getDateFormats().map((format) => (
                      <option key={format.value} value={format.value}>
                        {format.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Time Format */}
                <div>
                  <label className={`block text-sm font-medium ${text.secondary} mb-2`}>
                    {t('settings.timeFormat', 'Time Format')}
                  </label>
                  <select
                    value={settings?.time_format || '12h'}
                    onChange={(e) => handleSettingChange('time_format', e.target.value)}
                    className={`w-full px-4 py-2 ${bg.primary} ${text.primary} border ${border.primary} rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500`}
                  >
                    {settingsService.getTimeFormats().map((format) => (
                      <option key={format.value} value={format.value}>
                        {format.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Items Per Page */}
                <div>
                  <label className={`block text-sm font-medium ${text.secondary} mb-2`}>
                    {t('settings.itemsPerPage', 'Items Per Page')}
                  </label>
                  <input
                    type="number"
                    min="5"
                    max="100"
                    value={settings?.items_per_page || 10}
                    onChange={(e) => handleSettingChange('items_per_page', parseInt(e.target.value))}
                    className={`w-full px-4 py-2 ${bg.primary} ${text.primary} border ${border.primary} rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500`}
                  />
                </div>
              </div>
            )}

            {/* Language & Region Settings */}
            {activeTab === 'language' && (
              <div className="space-y-6">
                <h2 className={`text-xl font-bold ${text.primary} mb-4`}>
                  {t('settings.languageRegion', 'Language & Region')}
                </h2>

                {/* Language */}
                <div>
                  <label className={`block text-sm font-medium ${text.secondary} mb-2`}>
                    {t('settings.language', 'Language')}
                  </label>
                  <select
                    value={settings?.language || 'en'}
                    onChange={(e) => handleSettingChange('language', e.target.value)}
                    className={`w-full px-4 py-2 ${bg.primary} ${text.primary} border ${border.primary} rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500`}
                  >
                    {settingsService.getAvailableLanguages().map((lang) => (
                      <option key={lang.code} value={lang.code}>
                        {lang.nativeName} ({lang.name})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Timezone */}
                <div>
                  <label className={`block text-sm font-medium ${text.secondary} mb-2`}>
                    {t('settings.timezone', 'Timezone')}
                  </label>
                  <select
                    value={settings?.timezone || 'UTC'}
                    onChange={(e) => handleSettingChange('timezone', e.target.value)}
                    className={`w-full px-4 py-2 ${bg.primary} ${text.primary} border ${border.primary} rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500`}
                  >
                    {settingsService.getTimezones().slice(0, 50).map((tz) => (
                      <option key={tz} value={tz}>
                        {tz}
                      </option>
                    ))}
                  </select>
                  <p className={`text-xs ${text.secondary} mt-1`}>
                    {t('settings.timezoneNote', 'Currently showing first 50 timezones')}
                  </p>
                </div>
              </div>
            )}

            {/* Privacy Settings */}
            {activeTab === 'privacy' && (
              <div className="space-y-6">
                <h2 className={`text-xl font-bold ${text.primary} mb-4`}>
                  {t('settings.privacySettings', 'Privacy Settings')}
                </h2>

                {/* Profile Visibility */}
                <div>
                  <label className={`block text-sm font-medium ${text.secondary} mb-2`}>
                    {t('settings.profileVisibility', 'Profile Visibility')}
                  </label>
                  <select
                    value={settings?.profile_visibility || 'all'}
                    onChange={(e) => handleSettingChange('profile_visibility', e.target.value)}
                    className={`w-full px-4 py-2 ${bg.primary} ${text.primary} border ${border.primary} rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500`}
                  >
                    <option value="all">{t('settings.visibilityAll', 'Everyone')}</option>
                    <option value="team">{t('settings.visibilityTeam', 'My Team')}</option>
                    <option value="managers">{t('settings.visibilityManagers', 'Managers Only')}</option>
                    <option value="private">{t('settings.visibilityPrivate', 'Private')}</option>
                  </select>
                </div>

                {/* Contact Information Visibility */}
                <div className="space-y-3">
                  <h3 className={`text-lg font-semibold ${text.primary}`}>
                    {t('settings.contactVisibility', 'Contact Information Visibility')}
                  </h3>
                  <SettingToggle
                    label={t('settings.showEmail', 'Show Email Address')}
                    checked={settings?.show_email}
                    onChange={(checked) => handleSettingChange('show_email', checked)}
                    icon={<Mail className="h-5 w-5" />}
                  />
                  <SettingToggle
                    label={t('settings.showPhone', 'Show Phone Number')}
                    checked={settings?.show_phone}
                    onChange={(checked) => handleSettingChange('show_phone', checked)}
                    icon={<Phone className="h-5 w-5" />}
                  />
                </div>
              </div>
            )}

            {/* Work Preferences */}
            {activeTab === 'work' && (
              <div className="space-y-6">
                <h2 className={`text-xl font-bold ${text.primary} mb-4`}>
                  {t('settings.workPreferences', 'Work Preferences')}
                </h2>

                {/* Default Dashboard View */}
                <div>
                  <label className={`block text-sm font-medium ${text.secondary} mb-2`}>
                    {t('settings.defaultDashboard', 'Default Dashboard View')}
                  </label>
                  <select
                    value={settings?.default_dashboard_view || 'overview'}
                    onChange={(e) => handleSettingChange('default_dashboard_view', e.target.value)}
                    className={`w-full px-4 py-2 ${bg.primary} ${text.primary} border ${border.primary} rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500`}
                  >
                    <option value="overview">{t('settings.overviewView', 'Overview')}</option>
                    <option value="detailed">{t('settings.detailedView', 'Detailed')}</option>
                    <option value="compact">{t('settings.compactView', 'Compact')}</option>
                  </select>
                </div>

                {/* Auto Clock Out */}
                <div className="space-y-4">
                  <SettingToggle
                    label={t('settings.autoClockOut', 'Auto Clock Out')}
                    description={t('settings.autoClockOutDesc', 'Automatically clock out at a specific time')}
                    checked={settings?.auto_clock_out}
                    onChange={(checked) => handleSettingChange('auto_clock_out', checked)}
                  />

                  {settings?.auto_clock_out && (
                    <div className="ml-8">
                      <label className={`block text-sm font-medium ${text.secondary} mb-2`}>
                        {t('settings.autoClockOutTime', 'Auto Clock Out Time')}
                      </label>
                      <input
                        type="time"
                        value={settings?.auto_clock_out_time || '18:00:00'}
                        onChange={(e) => handleSettingChange('auto_clock_out_time', e.target.value)}
                        className={`px-4 py-2 ${bg.primary} ${text.primary} border ${border.primary} rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500`}
                      />
                    </div>
                  )}
                </div>

                {/* Weekly Report */}
                <SettingToggle
                  label={t('settings.weeklyReport', 'Weekly Report')}
                  description={t('settings.weeklyReportDesc', 'Receive a weekly summary of your work activities')}
                  checked={settings?.weekly_report}
                  onChange={(checked) => handleSettingChange('weekly_report', checked)}
                />
              </div>
            )}
        </div>

        {/* Navigation Tabs - Bottom Section for All Screen Sizes */}
        <div className={`${bg.secondary} rounded-lg shadow-sm border ${border.primary} p-4`}>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`
                    flex items-center space-x-3 px-4 py-3 rounded-lg transition-all duration-200
                    ${isActive
                      ? 'bg-blue-600 text-white shadow-md transform scale-105'
                      : `${text.secondary} ${hover.bg} hover:scale-102`
                    }
                  `}
                >
                  <Icon className="h-5 w-5 flex-shrink-0" />
                  <span className="font-medium text-sm">{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

// Reusable Toggle Component
const SettingToggle = ({ label, description, checked, onChange, icon }) => {
  const { text, isDarkMode } = useTheme();
  
  return (
    <div className="flex items-start justify-between py-3">
      <div className="flex items-start space-x-3 flex-1">
        {icon && <div className={text.secondary}>{icon}</div>}
        <div>
          <div className={`font-medium ${text.primary}`}>{label}</div>
          {description && (
            <div className={`text-sm ${text.secondary} mt-0.5`}>{description}</div>
          )}
        </div>
      </div>
      <button
        onClick={() => onChange(!checked)}
        className={`
          relative inline-flex h-6 w-11 items-center rounded-full transition-colors
          ${checked ? 'bg-blue-600' : isDarkMode ? 'bg-gray-700' : 'bg-gray-300'}
        `}
      >
        <span
          className={`
            inline-block h-4 w-4 transform rounded-full bg-white transition-transform
            ${checked ? 'translate-x-6' : 'translate-x-1'}
          `}
        />
      </button>
    </div>
  );
};

export default Settings;
