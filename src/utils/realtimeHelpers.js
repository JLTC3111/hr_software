/** Supabase realtime payloads use eventType; some clients expose event */
export const getRealtimeEventType = (payload) => payload?.eventType || payload?.event;

export const isRealtimeMutation = (payload) => {
  const eventType = getRealtimeEventType(payload);
  return eventType === 'INSERT' || eventType === 'UPDATE' || eventType === 'DELETE';
};
