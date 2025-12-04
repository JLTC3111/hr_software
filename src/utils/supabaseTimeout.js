/**
 * Helper to add timeout to Supabase queries
 * @param {Promise} promise - The Supabase query promise
 * @param {number} timeoutMs - Timeout in milliseconds (default 10000)
 * @returns {Promise} - The result of the query or throws an error on timeout
 */
export const withTimeout = (promise, timeoutMs = 10000) => {
  let timeoutId;
  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error('Request timed out'));
    }, timeoutMs);
  });

  return Promise.race([
    promise,
    timeoutPromise
  ]).then((result) => {
    clearTimeout(timeoutId);
    return result;
  }).catch((error) => {
    clearTimeout(timeoutId);
    throw error;
  });
};
