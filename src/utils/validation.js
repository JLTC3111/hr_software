/**
 * Validation Utilities
 * Provides input sanitization and validation functions
 */

/**
 * Sanitize string input to prevent XSS
 */
export const sanitizeInput = (input) => {
  if (typeof input !== 'string') return input;
  
  return input
    .trim()
    .replace(/[<>]/g, '') // Remove potential HTML tags
    .substring(0, 1000); // Limit length to prevent abuse
};

/**
 * Validate email format
 */
export const validateEmail = (email) => {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email);
};

/**
 * Validate phone number format (international)
 */
export const validatePhone = (phone) => {
  const regex = /^[\d\s\-\+\(\)]+$/;
  return regex.test(phone);
};

/**
 * Validate required field
 */
export const validateRequired = (value, fieldName = 'Field') => {
  if (!value || (typeof value === 'string' && !value.trim())) {
    return `${fieldName} is required`;
  }
  return null;
};

/**
 * Validate string length
 */
export const validateLength = (value, min, max, fieldName = 'Field') => {
  const length = value?.length || 0;
  
  if (length < min) {
    return `${fieldName} must be at least ${min} characters`;
  }
  if (length > max) {
    return `${fieldName} must be less than ${max} characters`;
  }
  return null;
};

/**
 * Validate number range
 */
export const validateRange = (value, min, max, fieldName = 'Value') => {
  const num = Number(value);
  
  if (isNaN(num)) {
    return `${fieldName} must be a number`;
  }
  if (num < min || num > max) {
    return `${fieldName} must be between ${min} and ${max}`;
  }
  return null;
};

/**
 * Validate date format
 */
export const validateDate = (dateString, fieldName = 'Date') => {
  const date = new Date(dateString);
  
  if (isNaN(date.getTime())) {
    return `${fieldName} is not a valid date`;
  }
  return null;
};

/**
 * Validate URL format
 */
export const validateUrl = (url) => {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
};

/**
 * Comprehensive form validation
 */
export const validateForm = (fields, rules) => {
  const errors = {};
  
  for (const [fieldName, value] of Object.entries(fields)) {
    const fieldRules = rules[fieldName] || [];
    
    for (const rule of fieldRules) {
      const error = rule(value, fieldName);
      if (error) {
        errors[fieldName] = error;
        break; // Stop at first error for this field
      }
    }
  }
  
  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
};

/**
 * Sanitize object - sanitize all string values
 */
export const sanitizeObject = (obj) => {
  const sanitized = {};
  
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      sanitized[key] = sanitizeInput(value);
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeObject(value);
    } else {
      sanitized[key] = value;
    }
  }
  
  return sanitized;
};

/**
 * Password strength validator
 */
export const validatePasswordStrength = (password) => {
  const minLength = 8;
  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);
  const hasNumbers = /\d/.test(password);
  const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);
  
  const strength = {
    isValid: password.length >= minLength,
    score: 0,
    feedback: []
  };
  
  if (password.length < minLength) {
    strength.feedback.push(`Password must be at least ${minLength} characters`);
  } else {
    strength.score += 1;
  }
  
  if (hasUpperCase) strength.score += 1;
  else strength.feedback.push('Add uppercase letters');
  
  if (hasLowerCase) strength.score += 1;
  else strength.feedback.push('Add lowercase letters');
  
  if (hasNumbers) strength.score += 1;
  else strength.feedback.push('Add numbers');
  
  if (hasSpecialChar) strength.score += 1;
  else strength.feedback.push('Add special characters');
  
  // Determine strength level
  if (strength.score === 5) strength.level = 'Strong';
  else if (strength.score >= 3) strength.level = 'Medium';
  else strength.level = 'Weak';
  
  return strength;
};

export default {
  sanitizeInput,
  sanitizeObject,
  validateEmail,
  validatePhone,
  validateRequired,
  validateLength,
  validateRange,
  validateDate,
  validateUrl,
  validateForm,
  validatePasswordStrength
};
