// Only counts detected by Translation Studio are published here. Navigation
// never downloads the source tables just to draw a badge. Counts are per user
// and held in memory, so another signed-in account cannot inherit the badge.
const counts = new Map();
const listeners = new Set();

export const subscribeTranslationQueue = (listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
export const getTranslationQueueCount = (userId) => counts.get(userId) ?? 0;
export const publishTranslationQueueCount = (userId, count) => {
  if (!userId || counts.get(userId) === count) return;
  counts.set(userId, count);
  listeners.forEach((listener) => listener());
};
