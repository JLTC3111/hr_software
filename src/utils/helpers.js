/**
 * Helper Utilities
 * Common utility functions used throughout the application
 */

/**
 * Safe property access - prevents "cannot read property of undefined" errors
 * @param {Object} obj - The object to access
 * @param {string} path - Dot-notation path (e.g., 'user.profile.name')
 * @param {*} defaultValue - Default value if path doesn't exist
 */
export const safeProp = (obj, path, defaultValue = null) => {
  const keys = path.split('.');
  let result = obj;
  
  for (const key of keys) {
    if (result?.[key] === undefined || result?.[key] === null) {
      return defaultValue;
    }
    result = result[key];
  }
  
  return result ?? defaultValue;
};

/**
 * Debounce function - delays execution until after wait period
 */
export const debounce = (func, wait = 300) => {
  let timeout;
  
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
};

/**
 * Throttle function - limits execution to once per wait period
 */
export const throttle = (func, wait = 300) => {
  let inThrottle;
  
  return function(...args) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, wait);
    }
  };
};

/**
 * Format currency
 */
export const formatCurrency = (amount, currency = 'USD', locale = 'en-US') => {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency
  }).format(amount);
};

/**
 * Format date
 */
export const formatDate = (date, format = 'short', locale = 'en-US') => {
  const d = new Date(date);
  
  if (isNaN(d.getTime())) {
    return 'Invalid Date';
  }
  
  const options = {
    short: { year: 'numeric', month: '2-digit', day: '2-digit' },
    medium: { year: 'numeric', month: 'short', day: 'numeric' },
    long: { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' },
    time: { hour: '2-digit', minute: '2-digit' },
    datetime: { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }
  };
  
  return new Intl.DateTimeFormat(locale, options[format] || options.short).format(d);
};

/**
 * Calculate age from date of birth
 */
export const calculateAge = (dob) => {
  const birthDate = new Date(dob);
  const today = new Date();
  
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  
  return age;
};

/**
 * Generate random ID
 */
export const generateId = (prefix = '') => {
  return `${prefix}${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

/**
 * Deep clone object
 */
export const deepClone = (obj) => {
  if (obj === null || typeof obj !== 'object') return obj;
  
  if (obj instanceof Date) return new Date(obj);
  if (obj instanceof Array) return obj.map(item => deepClone(item));
  
  const clonedObj = {};
  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      clonedObj[key] = deepClone(obj[key]);
    }
  }
  
  return clonedObj;
};

/**
 * Check if object is empty
 */
export const isEmpty = (obj) => {
  if (obj === null || obj === undefined) return true;
  if (typeof obj === 'string') return obj.trim().length === 0;
  if (Array.isArray(obj)) return obj.length === 0;
  if (typeof obj === 'object') return Object.keys(obj).length === 0;
  return false;
};

/**
 * Capitalize first letter
 */
export const capitalize = (str) => {
  if (typeof str !== 'string') return '';
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
};

/**
 * Truncate string
 */
export const truncate = (str, length = 50, ending = '...') => {
  if (str.length <= length) return str;
  return str.substring(0, length - ending.length) + ending;
};

/**
 * Group array by key
 */
export const groupBy = (array, key) => {
  return array.reduce((result, item) => {
    const group = safeProp(item, key, 'Other');
    (result[group] = result[group] || []).push(item);
    return result;
  }, {});
};

/**
 * Sort array by key
 */
export const sortBy = (array, key, order = 'asc') => {
  return [...array].sort((a, b) => {
    const aVal = safeProp(a, key);
    const bVal = safeProp(b, key);
    
    if (aVal < bVal) return order === 'asc' ? -1 : 1;
    if (aVal > bVal) return order === 'asc' ? 1 : -1;
    return 0;
  });
};

/**
 * Calculate percentage
 */
export const calculatePercentage = (value, total) => {
  if (total === 0) return 0;
  return Math.round((value / total) * 100 * 100) / 100;
};

/**
 * Format file size
 */
export const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
};

/**
 * Sleep/delay function
 */
export const sleep = (ms) => {
  return new Promise(resolve => setTimeout(resolve, ms));
};

/**
 * Retry function with exponential backoff
 */
export const retry = async (fn, maxAttempts = 3, delay = 1000) => {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt === maxAttempts) throw error;
      await sleep(delay * Math.pow(2, attempt - 1));
    }
  }
};

/**
 * Copy to clipboard
 */
export const copyToClipboard = async (text) => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (error) {
    console.error('Failed to copy to clipboard:', error);
    return false;
  }
};

/**
 * Download file
 */
export const downloadFile = (data, filename, type = 'text/plain') => {
  const blob = new Blob([data], { type });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
};

export default {
  safeProp,
  debounce,
  throttle,
  formatCurrency,
  formatDate,
  calculateAge,
  generateId,
  deepClone,
  isEmpty,
  capitalize,
  truncate,
  groupBy,
  sortBy,
  calculatePercentage,
  formatFileSize,
  sleep,
  retry,
  copyToClipboard,
  downloadFile
};
