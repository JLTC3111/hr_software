/**
 * Retry Helper - Provides retry logic with exponential backoff for failed API calls
 */

/**
 * Retry an async function with exponential backoff
 * @param {Function} fn - The async function to retry
 * @param {Object} options - Retry options
 * @param {number} options.maxRetries - Maximum number of retry attempts (default: 3)
 * @param {number} options.initialDelay - Initial delay in ms (default: 1000)
 * @param {number} options.maxDelay - Maximum delay in ms (default: 10000)
 * @param {Function} options.shouldRetry - Function to determine if error is retryable
 * @param {Function} options.onRetry - Callback called before each retry attempt
 * @returns {Promise<any>} The result of the function
 */
export const retryWithBackoff = async (fn, options = {}) => {
  const {
    maxRetries = 3,
    initialDelay = 1000,
    maxDelay = 10000,
    shouldRetry = () => true,
    onRetry = () => {}
  } = options;

  let lastError;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      // Don't retry if this is the last attempt
      if (attempt === maxRetries) {
        break;
      }
      
      // Check if we should retry this error
      if (!shouldRetry(error, attempt)) {
        break;
      }
      
      // Calculate delay with exponential backoff
      const delay = Math.min(initialDelay * Math.pow(2, attempt), maxDelay);
      
      // Notify about retry
      onRetry(error, attempt + 1, delay);
      
      console.log(`🔄 Retry attempt ${attempt + 1}/${maxRetries} after ${delay}ms:`, error.message);
      
      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  // All retries exhausted, throw the last error
  throw lastError;
};

/**
 * Check if an error is retryable (network/timeout errors)
 * @param {Error} error - The error to check
 * @returns {boolean} True if the error is retryable
 */
export const isRetryableError = (error) => {
  if (!error) return false;
  
  const message = error.message?.toLowerCase() || '';
  
  // Network errors
  if (message.includes('network') || 
      message.includes('timeout') || 
      message.includes('fetch failed') ||
      message.includes('aborted')) {
    return true;
  }
  
  // Session errors that might be temporary
  if (message.includes('session error') && 
      !message.includes('no active session')) {
    return true;
  }
  
  // HTTP 5xx server errors
  if (error.status >= 500 && error.status < 600) {
    return true;
  }
  
  // Rate limiting
  if (error.status === 429) {
    return true;
  }
  
  return false;
};

/**
 * Wrapper for component fetch functions with retry and session validation
 * @param {Function} fetchFn - The fetch function to wrap
 * @param {Function} validateSession - Session validation function
 * @param {Object} retryOptions - Options for retry logic
 * @returns {Function} Wrapped fetch function with retry logic
 */
export const withRetryAndSession = (fetchFn, validateSession, retryOptions = {}) => {
  return async (...args) => {
    // Validate session once before retrying
    const sessionValidation = await validateSession();
    if (!sessionValidation.success) {
      throw new Error(sessionValidation.error);
    }
    
    // Execute with retry logic
    return await retryWithBackoff(
      () => fetchFn(...args),
      {
        shouldRetry: isRetryableError,
        ...retryOptions
      }
    );
  };
};
