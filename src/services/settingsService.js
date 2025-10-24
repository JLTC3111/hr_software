import { supabase } from '../config/supabaseClient';

/**
 * Get user settings
 * @param {string} userId - User ID
 * @returns {Promise<object>} Result with settings data
 */
export const getUserSettings = async (userId) => {
  try {
    const { data, error } = await supabase
      .from('hr_user_settings')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error) {
      // If settings don't exist, create default settings
      if (error.code === 'PGRST116') {
        return await createDefaultSettings(userId);
      }
      throw error;
    }

    return { success: true, data };
  } catch (error) {
    console.error('Error fetching user settings:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Create default settings for a user
 * @param {string} userId - User ID
 * @returns {Promise<object>} Result with created settings
 */
export const createDefaultSettings = async (userId) => {
  try {
    const defaultSettings = {
      user_id: userId,
      email_notifications: true,
      push_notifications: true,
      desktop_notifications: false,
      notification_frequency: 'realtime',
      notify_time_tracking: true,
      notify_performance: true,
      notify_employee_updates: true,
      notify_recruitment: true,
      notify_system: true,
      theme: 'system',
      language: 'en',
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
      date_format: 'MM/DD/YYYY',
      time_format: '12h',
      profile_visibility: 'all',
      show_email: true,
      show_phone: true,
      default_dashboard_view: 'overview',
      items_per_page: 10,
      auto_clock_out: false,
      auto_clock_out_time: '18:00:00',
      weekly_report: true
    };

    const { data, error } = await supabase
      .from('hr_user_settings')
      .insert([defaultSettings])
      .select()
      .single();

    if (error) throw error;

    return { success: true, data };
  } catch (error) {
    console.error('Error creating default settings:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Update user settings
 * @param {string} userId - User ID
 * @param {object} updates - Settings to update
 * @returns {Promise<object>} Result with updated settings
 */
export const updateUserSettings = async (userId, updates) => {
  try {
    const { data, error } = await supabase
      .from('hr_user_settings')
      .update(updates)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) throw error;

    return { success: true, data };
  } catch (error) {
    console.error('Error updating user settings:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Update notification preferences
 * @param {string} userId - User ID
 * @param {object} preferences - Notification preferences
 * @returns {Promise<object>} Result
 */
export const updateNotificationPreferences = async (userId, preferences) => {
  const allowedFields = [
    'email_notifications',
    'push_notifications',
    'desktop_notifications',
    'notification_frequency',
    'notify_time_tracking',
    'notify_performance',
    'notify_employee_updates',
    'notify_recruitment',
    'notify_system'
  ];

  const filteredPreferences = Object.keys(preferences)
    .filter(key => allowedFields.includes(key))
    .reduce((obj, key) => {
      obj[key] = preferences[key];
      return obj;
    }, {});

  return await updateUserSettings(userId, filteredPreferences);
};

/**
 * Update display preferences
 * @param {string} userId - User ID
 * @param {object} preferences - Display preferences
 * @returns {Promise<object>} Result
 */
export const updateDisplayPreferences = async (userId, preferences) => {
  const allowedFields = [
    'theme',
    'language',
    'timezone',
    'date_format',
    'time_format',
    'items_per_page'
  ];

  const filteredPreferences = Object.keys(preferences)
    .filter(key => allowedFields.includes(key))
    .reduce((obj, key) => {
      obj[key] = preferences[key];
      return obj;
    }, {});

  return await updateUserSettings(userId, filteredPreferences);
};

/**
 * Update privacy settings
 * @param {string} userId - User ID
 * @param {object} settings - Privacy settings
 * @returns {Promise<object>} Result
 */
export const updatePrivacySettings = async (userId, settings) => {
  const allowedFields = [
    'profile_visibility',
    'show_email',
    'show_phone'
  ];

  const filteredSettings = Object.keys(settings)
    .filter(key => allowedFields.includes(key))
    .reduce((obj, key) => {
      obj[key] = settings[key];
      return obj;
    }, {});

  return await updateUserSettings(userId, filteredSettings);
};

/**
 * Update work preferences
 * @param {string} userId - User ID
 * @param {object} preferences - Work preferences
 * @returns {Promise<object>} Result
 */
export const updateWorkPreferences = async (userId, preferences) => {
  const allowedFields = [
    'auto_clock_out',
    'auto_clock_out_time',
    'weekly_report',
    'default_dashboard_view'
  ];

  const filteredPreferences = Object.keys(preferences)
    .filter(key => allowedFields.includes(key))
    .reduce((obj, key) => {
      obj[key] = preferences[key];
      return obj;
    }, {});

  return await updateUserSettings(userId, filteredPreferences);
};

/**
 * Reset settings to default
 * @param {string} userId - User ID
 * @returns {Promise<object>} Result
 */
export const resetToDefault = async (userId) => {
  try {
    // Delete existing settings
    await supabase
      .from('hr_user_settings')
      .delete()
      .eq('user_id', userId);

    // Create new default settings
    return await createDefaultSettings(userId);
  } catch (error) {
    console.error('Error resetting settings:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Export user settings
 * @param {string} userId - User ID
 * @returns {Promise<object>} Result with settings as JSON
 */
export const exportSettings = async (userId) => {
  const result = await getUserSettings(userId);
  if (result.success) {
    return {
      success: true,
      data: JSON.stringify(result.data, null, 2)
    };
  }
  return result;
};

/**
 * Import user settings
 * @param {string} userId - User ID
 * @param {string} settingsJson - Settings JSON string
 * @returns {Promise<object>} Result
 */
export const importSettings = async (userId, settingsJson) => {
  try {
    const settings = JSON.parse(settingsJson);
    
    // Remove system fields
    delete settings.id;
    delete settings.user_id;
    delete settings.created_at;
    delete settings.updated_at;

    return await updateUserSettings(userId, settings);
  } catch (error) {
    console.error('Error importing settings:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Get all available timezones organized by region
 * @returns {array} List of timezones grouped by region
 */
export const getTimezones = () => {
  const timezones = {
    'Americas': [
      'America/New_York',
      'America/Chicago',
      'America/Denver',
      'America/Los_Angeles',
      'America/Anchorage',
      'America/Phoenix',
      'America/Toronto',
      'America/Vancouver',
      'America/Mexico_City',
      'America/Bogota',
      'America/Lima',
      'America/Santiago',
      'America/Buenos_Aires',
      'America/Sao_Paulo',
      'America/Caracas',
      'America/Halifax',
      'America/Montevideo'
    ],
    'Europe': [
      'Europe/London',
      'Europe/Paris',
      'Europe/Berlin',
      'Europe/Madrid',
      'Europe/Rome',
      'Europe/Amsterdam',
      'Europe/Brussels',
      'Europe/Vienna',
      'Europe/Stockholm',
      'Europe/Oslo',
      'Europe/Copenhagen',
      'Europe/Helsinki',
      'Europe/Athens',
      'Europe/Istanbul',
      'Europe/Moscow',
      'Europe/Warsaw',
      'Europe/Prague',
      'Europe/Budapest',
      'Europe/Bucharest',
      'Europe/Zurich',
      'Europe/Dublin',
      'Europe/Lisbon'
    ],
    'Asia': [
      'Asia/Tokyo',
      'Asia/Shanghai',
      'Asia/Hong_Kong',
      'Asia/Singapore',
      'Asia/Seoul',
      'Asia/Bangkok',
      'Asia/Dubai',
      'Asia/Kolkata',
      'Asia/Manila',
      'Asia/Jakarta',
      'Asia/Ho_Chi_Minh',
      'Asia/Kuala_Lumpur',
      'Asia/Taipei',
      'Asia/Karachi',
      'Asia/Dhaka',
      'Asia/Tehran',
      'Asia/Baghdad',
      'Asia/Riyadh',
      'Asia/Jerusalem',
      'Asia/Yangon',
      'Asia/Kathmandu',
      'Asia/Colombo',
      'Asia/Tashkent'
    ],
    'Australia & Pacific': [
      'Australia/Sydney',
      'Australia/Melbourne',
      'Australia/Brisbane',
      'Australia/Perth',
      'Australia/Adelaide',
      'Australia/Darwin',
      'Pacific/Auckland',
      'Pacific/Fiji',
      'Pacific/Honolulu',
      'Pacific/Guam',
      'Pacific/Port_Moresby',
      'Pacific/Tahiti',
      'Pacific/Noumea'
    ],
    'Africa': [
      'Africa/Cairo',
      'Africa/Johannesburg',
      'Africa/Lagos',
      'Africa/Nairobi',
      'Africa/Casablanca',
      'Africa/Tunis',
      'Africa/Algiers',
      'Africa/Accra',
      'Africa/Addis_Ababa',
      'Africa/Dar_es_Salaam'
    ],
    'UTC': [
      'UTC'
    ]
  };

  // Flatten into a single array with region labels
  const flattenedTimezones = [];
  Object.entries(timezones).forEach(([region, zones]) => {
    zones.forEach(zone => {
      flattenedTimezones.push({
        value: zone,
        label: `${zone.replace(/_/g, ' ')} (${region})`,
        region: region
      });
    });
  });

  return flattenedTimezones;
};

/**
 * Get available languages
 * @returns {array} List of supported languages
 */
export const getAvailableLanguages = () => {
  return [
    { code: 'en', name: 'English', nativeName: 'English' },
    { code: 'vn', name: 'Vietnamese', nativeName: 'Tiếng Việt' },
    { code: 'es', name: 'Spanish', nativeName: 'Español' },
    { code: 'fr', name: 'French', nativeName: 'Français' },
    { code: 'de', name: 'German', nativeName: 'Deutsch' },
    { code: 'jp', name: 'Japanese', nativeName: '日本語' },
    { code: 'kr', name: 'Korean', nativeName: '한국어' },
    { code: 'th', name: 'Thai', nativeName: 'ไทย' },
    { code: 'ru', name: 'Russian', nativeName: 'Русский' }
  ];
};

/**
 * Get available themes
 * @returns {array} List of themes
 */
export const getAvailableThemes = () => {
  return [
    { value: 'light', label: 'Light' },
    { value: 'dark', label: 'Dark' },
    { value: 'system', label: 'System' }
  ];
};

/**
 * Get available date formats
 * @returns {array} List of date formats
 */
export const getDateFormats = () => {
  return [
    { value: 'MM/DD/YYYY', label: 'MM/DD/YYYY (12/31/2024)' },
    { value: 'DD/MM/YYYY', label: 'DD/MM/YYYY (31/12/2024)' },
    { value: 'YYYY-MM-DD', label: 'YYYY-MM-DD (2024-12-31)' },
    { value: 'DD MMM YYYY', label: 'DD MMM YYYY (31 Dec 2024)' }
  ];
};

/**
 * Get available time formats
 * @returns {array} List of time formats
 */
export const getTimeFormats = () => {
  return [
    { value: '12h', label: '12-hour (3:30 PM)' },
    { value: '24h', label: '24-hour (15:30)' }
  ];
};
