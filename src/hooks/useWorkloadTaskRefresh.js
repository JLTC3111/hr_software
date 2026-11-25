import { useEffect, useRef } from 'react';
import { subscribeToTaskChanges } from '../services/workloadService.js';

// The foreground retry also covers missed notifications and users whose task
// visibility extends beyond the employees in their visible roster.
export function useWorkloadTaskRefresh(employeeIds, refresh, { enabled = true } = {}) {
  const latest = useRef(refresh);
  useEffect(() => { latest.current = refresh; }, [refresh]);
  const topicKey = JSON.stringify([...new Set(employeeIds.filter((id) => id != null && id !== '').map(String))].sort());
  useEffect(() => {
    if (!enabled) return undefined;
    let pending;
    const refreshSoon = () => {
      if (document.visibilityState === 'hidden' || navigator.onLine === false || pending) return;
      pending = setTimeout(() => {
        pending = null;
        latest.current();
      }, 150);
    };
    const unsubscribe = JSON.parse(topicKey).map((employeeId) => subscribeToTaskChanges(employeeId, refreshSoon));
    const timer = setInterval(refreshSoon, 60000);
    return () => {
      clearTimeout(pending);
      clearInterval(timer);
      unsubscribe.forEach((close) => close());
    };
  }, [enabled, topicKey]);
}
