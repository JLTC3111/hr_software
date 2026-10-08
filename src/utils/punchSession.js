const pad2 = value => String(value).padStart(2, '0');
export const punchSessionKey = employeeId => `punchclock.session.${employeeId}`;
export const localDate = date => `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
export const minutesNow = date => date.getHours() * 60 + date.getMinutes() + date.getSeconds() / 60;

// Round once so the minute carry is included in the hour (17:59:45 -> 18:00).
export const minutesToClock = minutes => {
  const total = Math.max(0, Math.round(Number(minutes) || 0));
  return `${pad2(Math.floor(total / 60) % 24)}:${pad2(total % 60)}`;
};

export function readPunchSession(employeeId, today) {
  if (!employeeId || typeof window === 'undefined') return null;
  try {
    const session = JSON.parse(window.localStorage.getItem(punchSessionKey(employeeId)));
    return session?.date === today && Number.isFinite(session.clockIn) && Array.isArray(session.breaks)
      ? session : null;
  } catch { return null; }
}

export function writePunchSession(employeeId, session) {
  if (!employeeId || typeof window === 'undefined') return;
  try {
    if (session) window.localStorage.setItem(punchSessionKey(employeeId), JSON.stringify(session));
    else window.localStorage.removeItem(punchSessionKey(employeeId));
  } catch { /* Keep the server and in-memory session when local storage is unavailable. */ }
}

export function setBreakState(session, minutes, onBreak) {
  if (!session) return null;
  const breaks = [...session.breaks];
  const open = breaks.findIndex(interval => interval.end == null);
  if ((open >= 0) === onBreak) return session;
  const at = Math.max(session.clockIn, Math.round(minutes), ...breaks.map(interval => interval.end ?? interval.start));
  if (onBreak) breaks.push({ start: at, end: null });
  else breaks[open] = { ...breaks[open], end: at };
  return { ...session, breaks };
}

export const LUNCH_START = 12 * 60;
export const LUNCH_END = 13 * 60;

export function dueBreakReminder(session, date) {
  if (!session || session.date !== localDate(date)) return null;
  const now = minutesNow(date);
  const open = session.breaks.find(interval => interval.end == null);
  if (open) return open.start <= LUNCH_END && now >= LUNCH_END ? 'resume' : null;
  const hadLunch = session.breaks.some(interval => interval.start < LUNCH_END && interval.end >= LUNCH_START);
  return now >= LUNCH_START && now < LUNCH_END && !hadLunch ? 'start' : null;
}
