/**
 * The open punch — a shift that has started and not yet been closed.
 *
 * `time_entries.clock_out` is NOT NULL, so that table can only describe a
 * finished shift. Until `open_punches` existed the live punch was held in the
 * browser alone, which meant it was lost the moment someone came back on a
 * different machine or browser, or after site data was cleared. These calls are
 * the server side of it; the punch clock keeps its localStorage copy too and
 * treats this one as authoritative when both are present.
 *
 * The shape the screen works in — and what this module converts to and from:
 *
 *   { date: 'YYYY-MM-DD',
 *     clockIn: <minutes from midnight>,
 *     breaks: [{ start: <minutes>, end: <minutes|null> }] }
 *
 * A null `end` is the break currently running. The column is `time`, so minutes
 * are widened to 'HH:MM:SS' on the way out and narrowed on the way back.
 *
 * Demo mode never reaches the network: it returns "nothing stored", which leaves
 * the punch clock on its localStorage copy exactly as before.
 */
import { supabase } from '../config/supabaseClient';
import { isDemoMode } from '../utils/demoHelper';
import { withTimeout } from '../utils/supabaseTimeout.js';

const toEmployeeId = (id) => (id ? String(id) : null);

const pad2 = (n) => String(n).padStart(2, '0');

/** 611 → '10:11:00' */
const minutesToTime = (minutes) => {
  const total = Math.max(0, Math.round(Number(minutes) || 0));
  return `${pad2(Math.floor(total / 60) % 24)}:${pad2(total % 60)}:00`;
};

/** '10:11:00' → 611 */
const timeToMinutes = (value) => {
  const [h, m] = String(value || '').split(':');
  const minutes = Number(h) * 60 + Number(m);
  return Number.isFinite(minutes) ? minutes : null;
};

/** Only well-formed intervals survive; a row is not worth trusting blindly. */
const normaliseBreaks = (breaks) => {
  if (!Array.isArray(breaks)) return [];
  return breaks
    .map((b) => ({
      start: Number(b?.start),
      end: b?.end == null ? null : Number(b.end),
    }))
    .filter((b) => Number.isFinite(b.start) && (b.end == null || Number.isFinite(b.end)));
};

const rowToSession = (row) => {
  if (!row) return null;
  const clockIn = timeToMinutes(row.clock_in);
  if (clockIn == null) return null;
  return {
    date: String(row.date || '').slice(0, 10),
    clockIn,
    breaks: normaliseBreaks(row.breaks),
  };
};

/**
 * The punch this employee currently has open, or null.
 *
 * `today` is passed in rather than computed here so the caller's notion of the
 * working day is the only one in play: a punch from a previous day is a
 * forgotten punch-out, not something to silently resume.
 */
export const getOpenPunch = async (employeeId, today) => {
  const id = toEmployeeId(employeeId);
  if (!id) return { success: true, data: null };
  if (isDemoMode()) return { success: true, data: null };

  try {
    const { data, error } = await withTimeout(
      supabase
        .from('open_punches')
        .select('employee_id, date, clock_in, breaks')
        .eq('employee_id', id)
        .maybeSingle()
    );
    if (error) throw error;
    if (!data) return { success: true, data: null };

    const session = rowToSession(data);
    if (today && session && session.date !== today) {
      return { success: true, data: null, stale: true };
    }
    return { success: true, data: session };
  } catch (error) {
    console.error('Error reading the open punch:', error);
    return { success: false, error: error.message };
  }
};

/** Write the punch, replacing whatever this employee had open. */
export const saveOpenPunch = async (employeeId, session) => {
  const id = toEmployeeId(employeeId);
  if (!id || !session || session.clockIn == null) {
    return { success: false, error: 'An employee and an open punch are both required' };
  }
  if (isDemoMode()) return { success: true, data: session };

  try {
    const { error } = await withTimeout(
      supabase
        .from('open_punches')
        .upsert(
          {
            employee_id: id,
            date: session.date,
            clock_in: minutesToTime(session.clockIn),
            breaks: normaliseBreaks(session.breaks),
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'employee_id' }
        )
    );
    if (error) throw error;
    return { success: true, data: session };
  } catch (error) {
    console.error('Error saving the open punch:', error);
    return { success: false, error: error.message };
  }
};

/** Close the punch. Called once the shift has been filed as a time entry. */
export const clearOpenPunch = async (employeeId) => {
  const id = toEmployeeId(employeeId);
  if (!id) return { success: true };
  if (isDemoMode()) return { success: true };

  try {
    const { error } = await withTimeout(
      supabase.from('open_punches').delete().eq('employee_id', id)
    );
    if (error) throw error;
    return { success: true };
  } catch (error) {
    console.error('Error clearing the open punch:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Everyone on the clock today. Not used by the punch clock's own figures yet —
 * those are derived from filed entries — but this is what the floor view would
 * read to show a shift that is still running.
 */
export const getOpenPunches = async (today) => {
  if (isDemoMode()) return { success: true, data: [] };

  try {
    let query = supabase.from('open_punches').select('employee_id, date, clock_in, breaks');
    if (today) query = query.eq('date', today);
    const { data, error } = await withTimeout(query);
    if (error) throw error;
    return {
      success: true,
      data: (data || []).map((row) => ({ employeeId: row.employee_id, ...rowToSession(row) })),
    };
  } catch (error) {
    console.error('Error reading open punches:', error);
    return { success: false, error: error.message };
  }
};
