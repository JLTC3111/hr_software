import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from './AuthContext.jsx';
import { PunchSessionContext } from './PunchSessionContext.js';
import * as punchClockService from '../services/punchClockService.js';
import { isDemoMode } from '../utils/demoHelper.js';
import { localDate, minutesNow, punchSessionKey, readPunchSession, writePunchSession, setBreakState } from '../utils/punchSession.js';

// One session is shared by every page and the attendance reminder. Remote reads
// cannot overwrite a newer local action or a different signed-in identity.
export function PunchSessionProvider({ children }) {
  const { user, isAuthenticated } = useAuth();
  const employeeId = isAuthenticated ? String(user?.employeeId || '') : '';
  const [today, setToday] = useState(() => localDate(new Date()));
  const identity = `${user?.id || ''}:${employeeId}:${today}`;
  const identityRef = useRef(identity);
  identityRef.current = identity;
  const [snapshot, setSnapshot] = useState(() => ({ identity, session: readPunchSession(employeeId, today) }));
  const session = snapshot.identity === identity ? snapshot.session : null;
  const sessionRef = useRef(session);
  sessionRef.current = session;
  const revision = useRef(0);
  const pending = useRef(0);
  const queue = useRef(Promise.resolve());
  const unsynced = useRef(null);
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);

  const publish = useCallback(next => {
    sessionRef.current = next;
    setSnapshot({ identity, session: next });
    writePunchSession(employeeId, next);
  }, [employeeId, identity]);

  const commit = useCallback((next, { requireRemote = false } = {}) => {
    if (!employeeId) return Promise.resolve({ success: false, error: 'Employee record required' });
    revision.current += 1;
    pending.current += 1;
    setBusy(true);
    // Retain the punch screen's local offline mirror and retry unconfirmed
    // writes during sync. Reminder actions wait for server confirmation.
    const localWrite = { identity, next };
    if (!requireRemote) {
      unsynced.current = localWrite;
      publish(next);
    }
    const operation = queue.current.then(async () => {
      if (identityRef.current !== identity) return { success: false, error: 'Session changed' };
      const result = next
        ? await punchClockService.saveOpenPunch(employeeId, next)
        : await punchClockService.clearOpenPunch(employeeId);
      if (identityRef.current !== identity) return { success: false, error: 'Session changed' };
      if (result.success) {
        if (requireRemote) publish(next);
        if (unsynced.current === localWrite) unsynced.current = null;
        setReady(true);
      }
      return result;
    }).finally(() => {
      pending.current -= 1;
      if (!pending.current) setBusy(false);
    });
    queue.current = operation.catch(() => {});
    return operation;
  }, [employeeId, identity, publish]);

  const refresh = useCallback(async ({ restoreLocal = false } = {}) => {
    if (!employeeId || pending.current) return null;
    const version = revision.current;
    const result = isDemoMode()
      ? { success: true, data: readPunchSession(employeeId, today) }
      : await punchClockService.getOpenPunch(employeeId, today);
    if (identityRef.current !== identity || version !== revision.current || pending.current) return null;
    if (result.success) {
      const unconfirmed = unsynced.current?.identity === identity ? unsynced.current : null;
      const local = restoreLocal ? readPunchSession(employeeId, today) : null;
      if (unconfirmed || (!result.data && local)) {
        const next = unconfirmed ? unconfirmed.next : local;
        const saved = await commit(next);
        if (identityRef.current === identity) setReady(true);
        return { ...saved, data: next };
      }
      publish(result.data);
    }
    if (identityRef.current === identity) setReady(true);
    return result;
  }, [employeeId, today, identity, publish, commit]);

  useEffect(() => {
    setReady(false);
    revision.current += 1;
    if (unsynced.current?.identity !== identity) unsynced.current = null;
    publish(readPunchSession(employeeId, today));
    if (!employeeId) return undefined;
    refresh({ restoreLocal: true });
    const sync = () => {
      setToday(localDate(new Date()));
      if (document.visibilityState !== 'hidden') refresh();
    };
    const storage = event => { if (event.key === punchSessionKey(employeeId)) sync(); };
    const timer = window.setInterval(sync, 30000);
    window.addEventListener('focus', sync);
    window.addEventListener('storage', storage);
    document.addEventListener('visibilitychange', sync);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', sync);
      window.removeEventListener('storage', storage);
      document.removeEventListener('visibilitychange', sync);
    };
  }, [employeeId, today, identity, publish, refresh]);

  const changeBreak = useCallback(async onBreak => {
    await queue.current;
    if (identityRef.current !== identity) return { success: false, error: 'Session changed' };
    let current = sessionRef.current;
    if (!isDemoMode()) {
      const result = await refresh();
      if (!result?.success) return { success: false, error: result?.error || 'Could not sync the punch' };
      current = result.data;
    }
    if (!current || current.date !== localDate(new Date())) return { success: false, error: 'No open punch' };
    const next = setBreakState(current, minutesNow(new Date()), onBreak);
    if (next === current) return { success: true, data: current };
    return commit(next, { requireRemote: true });
  }, [identity, refresh, commit]);

  const value = useMemo(() => ({ employeeId, session, ready, busy, commit, changeBreak }),
    [employeeId, session, ready, busy, commit, changeBreak]);
  return <PunchSessionContext.Provider value={value}>{children}</PunchSessionContext.Provider>;
}
