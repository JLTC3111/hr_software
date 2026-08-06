/**
 * 3d — Bấm giờ / Punch clock. The live time-clock screen.
 *
 * This is the on-site counterpart to 3a (timeClockEntry.jsx, "Chấm công"),
 * which enters hours after the fact. The two are deliberately not merged: 3a is
 * a form with proof upload and approval, 3d is a single dominant punch.
 *
 * Screen rules this file enforces (see the 3d spec):
 *   - One dominant punch. The 76px clock plus exactly one <Btn variant="primary">
 *     is the whole point; nothing else on the board is solid, and there is no
 *     second figure at that size.
 *   - No red, no green. Late, unrecognised and unclosed states read through
 *     outline tags, dark-steel markers and rule weight.
 *   - Every card is a <Blueprint> with its four corner marks; every bar is a
 *     hairline box with a fill inside.
 *
 * On the data: `time_entries.clock_out` is NOT NULL, so that table can only
 * describe a finished shift. A punch that is still open lives in `open_punches`
 * (one row per employee — see punchClockService.js) with a localStorage mirror
 * for instant restore, and is written as an ordinary time entry when you punch
 * out. The pair is what keeps a clock running across an idle logout, a browser
 * refresh, or a move to another machine. Everything else on the screen — who is
 * on the floor, who is late, the department split, the week — is derived from
 * filed entries.
 */
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { RefreshCw, ArrowRight, AlertCircle, X } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext.jsx';
import { useLanguage } from '../contexts/LanguageContext.jsx';
import { useAuth } from '../contexts/AuthContext.jsx';
import * as timeTrackingService from '../services/timeTrackingService.js';
import * as punchClockService from '../services/punchClockService.js';
import { validateAndRefreshSession } from '../utils/sessionHelper.js';
import { useSessionGuard, useAuthenticatedPageRefresh } from '../hooks/useSessionGuard.js';
import { isDemoMode, getDemoEmployeeName } from '../utils/demoHelper.js';
import { getIndustry, DISPLAY, BODY, figure, rampAt } from '../theme/industry.js';
import {
  Blueprint, Bar, Tag, Btn, Seg, Kicker, TickerCell, ColumnHeading, LiveClock, FlatSelect,
} from './ui/industry.jsx';
import { FetchElapsedPill } from './ui/fetch-elapsed-pill';

/* ------------------------------------------------------------------ *
 * Shift and axis constants
 * ------------------------------------------------------------------ */

const SHIFT_START_MIN = 8 * 60 + 30;   // 08:30
const SHIFT_END_MIN = 17 * 60 + 30;    // 17:30
const LATE_GRACE_MIN = 5;

/** The day strip runs 08:00–19:00. Every left/width on it is measured here. */
const AXIS_START_MIN = 8 * 60;
const AXIS_END_MIN = 19 * 60;
const AXIS_SPAN_MIN = AXIS_END_MIN - AXIS_START_MIN;

const CONTRACT_DAY_MIN = 8 * 60;
/** 8h sits at 80% of the plot, so the plot tops out at 10h. */
const CHART_MAX_MIN = CONTRACT_DAY_MIN / 0.8;
const CONTRACT_WEEK_MIN = 40 * 60;

const SESSION_KEY = (employeeId) => `punchclock.session.${employeeId}`;

/* ------------------------------------------------------------------ *
 * Time helpers — everything internal is "minutes since midnight"
 * ------------------------------------------------------------------ */

const pad2 = (n) => String(n).padStart(2, '0');

/** 'HH:MM' or 'HH:MM:SS' → minutes. Returns null on anything unparseable. */
function toMin(value) {
  if (typeof value !== 'string') return null;
  const m = /^(\d{1,2}):(\d{2})/.exec(value.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (!Number.isFinite(h) || !Number.isFinite(min)) return null;
  return h * 60 + min;
}

const minToClock = (min) => `${pad2(Math.floor(min / 60) % 24)}:${pad2(Math.round(min) % 60)}`;
const nowMin = (d) => d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60;
const isoDate = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

/** 556 → "9h 16m". Minutes only below an hour. */
function durLabel(min) {
  const total = Math.max(0, Math.round(min));
  const h = Math.floor(total / 60);
  const m = total % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

/** Position on the 08–19 axis, clamped, as a 0–100 percentage. */
const axisPct = (min) =>
  Math.max(0, Math.min(100, ((min - AXIS_START_MIN) / AXIS_SPAN_MIN) * 100));

/* ------------------------------------------------------------------ *
 * Session — the one piece of state the schema cannot hold
 * ------------------------------------------------------------------ */

function readSession(employeeId, today) {
  if (!employeeId || typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(SESSION_KEY(employeeId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    // A session never survives midnight; a forgotten punch-out is the floor
    // supervisor's problem, not something to silently carry into a new day.
    if (!parsed || parsed.date !== today) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeSession(employeeId, session) {
  if (!employeeId || typeof window === 'undefined') return;
  try {
    if (session) window.localStorage.setItem(SESSION_KEY(employeeId), JSON.stringify(session));
    else window.localStorage.removeItem(SESSION_KEY(employeeId));
  } catch {
    /* storage full or blocked — the screen still works, it just forgets */
  }
}

/**
 * Splits a session into the worked and break intervals that both the day strip
 * and the elapsed figures are built from. `end` clamps the open tail to now.
 */
function sessionIntervals(session, end) {
  if (!session || session.clockIn == null) return [];
  const raw = (session.breaks || [])
    .map((b) => ({ start: b.start, end: b.end == null ? end : b.end }))
    .filter((b) => b.start != null && b.end > b.start)
    .sort((a, b) => a.start - b.start);

  // Overlapping breaks would be counted twice — inflating the break total,
  // shrinking worked time and drawing stacked bands on the strip. The UI can
  // only ever open one break at a time, but the session comes back out of
  // localStorage, so merge rather than trust it.
  const breaks = [];
  for (const brk of raw) {
    const last = breaks[breaks.length - 1];
    if (last && brk.start <= last.end) last.end = Math.max(last.end, brk.end);
    else breaks.push({ ...brk });
  }

  const out = [];
  let cursor = session.clockIn;
  for (const brk of breaks) {
    if (brk.start > cursor) out.push({ start: cursor, end: Math.min(brk.start, end), kind: 'work' });
    out.push({ start: brk.start, end: Math.min(brk.end, end), kind: 'break' });
    cursor = Math.max(cursor, brk.end);
  }
  if (end > cursor) out.push({ start: cursor, end, kind: 'work' });
  return out.filter((i) => i.end > i.start);
}

const sumKind = (intervals, kind) =>
  intervals.filter((i) => i.kind === kind).reduce((n, i) => n + (i.end - i.start), 0);

/**
 * Worked minutes past `after`. Overtime is time actually on the clock beyond
 * the shift end — a break that straddles 17:30 must not be paid as overtime.
 */
const workedAfter = (intervals, after) =>
  intervals
    .filter((i) => i.kind === 'work' && i.end > after)
    .reduce((n, i) => n + (i.end - Math.max(i.start, after)), 0);

/* ------------------------------------------------------------------ *
 * Day strip — hour rules baked into the background, segments on top
 * ------------------------------------------------------------------ */

function DayStrip({ ind, intervals, now, t }) {
  const hours = [];
  for (let h = AXIS_START_MIN / 60; h <= AXIS_END_MIN / 60; h += 1) hours.push(pad2(h));

  return (
    <div style={{ marginTop: 18 }}>
      <div
        role="img"
        aria-label={t('punchClock.dayStripLabel', 'Today from 08:00 to 19:00')}
        style={{
          height: 34,
          border: `1px solid ${ind.hairline}`,
          position: 'relative',
          background: `repeating-linear-gradient(90deg, ${ind.rule} 0 1px, transparent 1px calc(100% / ${AXIS_SPAN_MIN / 60}))`,
        }}
      >
        {intervals.map((seg, i) => {
          const left = axisPct(seg.start);
          const width = Math.max(0, axisPct(seg.end) - left);
          if (width <= 0) return null;
          const isBreak = seg.kind === 'break';
          return (
            <div
              key={`${seg.kind}-${seg.start}-${i}`}
              style={{
                position: 'absolute',
                top: 0,
                bottom: 0,
                left: `${left}%`,
                width: `${width}%`,
                // A break is the same hue, tinted and edged — never a second colour.
                background: isBreak ? ind.accentFill : ind.accent,
                borderLeft: isBreak ? `1px solid ${ind.accent}` : 'none',
                borderRight: isBreak ? `1px solid ${ind.accent}` : 'none',
              }}
            />
          );
        })}

        {/* Shift end and now. Dark steel, never red. */}
        <span
          aria-hidden="true"
          style={{
            position: 'absolute', top: -5, bottom: -5, left: `${axisPct(SHIFT_END_MIN)}%`,
            width: 1, background: ind.ink, opacity: 0.75,
          }}
        />
        {now >= AXIS_START_MIN && now <= AXIS_END_MIN && (
          <>
            <span
              aria-hidden="true"
              style={{
                position: 'absolute', top: -4, bottom: -4, left: `${axisPct(now)}%`,
                width: 2, background: ind.ink,
              }}
            />
            <span
              aria-hidden="true"
              style={{
                position: 'absolute', top: -4, left: `${axisPct(now)}%`,
                width: 6, height: 6, background: ind.ink, transform: 'translateX(-2px)',
              }}
            />
          </>
        )}
      </div>

      <div
        aria-hidden="true"
        style={{
          display: 'flex', justifyContent: 'space-between', marginTop: 5,
          fontFamily: DISPLAY, fontWeight: 600, fontSize: 10,
          letterSpacing: '.12em', color: ind.inkFaint,
        }}
      >
        {hours.map((h) => <span key={h}>{h}</span>)}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Week chart — 8h contract rule at 80% height
 * ------------------------------------------------------------------ */

function WeekChart({ ind, days, t }) {
  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'flex-end', gap: 10, position: 'relative' }}>
      <span
        aria-hidden="true"
        title={t('punchClock.contractDay', 'Contract day, 8h')}
        style={{
          position: 'absolute', left: 0, right: 0, bottom: '80%',
          height: 1, background: ind.accent, opacity: 0.55,
        }}
      />
      {days.map((day) => {
        const pct = Math.max(0, Math.min(1, day.minutes / CHART_MAX_MIN)) * 100;
        const weekend = day.kind === 'weekend';
        const future = day.kind === 'future';
        const today = day.kind === 'today';
        return (
          <div
            key={day.key}
            title={`${day.label} · ${durLabel(day.minutes)}`}
            style={{
              flex: 1, height: '100%', display: 'flex', flexDirection: 'column',
              justifyContent: 'flex-end', gap: 5, minWidth: 0,
            }}
          >
            <div
              style={{
                height: `${weekend ? 12 : Math.max(pct, future ? 12 : 2)}%`,
                border: future
                  ? `1px dashed ${ind.inkFaint}`
                  : `1px solid ${today ? ind.ink : weekend ? ind.rule : ind.hairline}`,
                background: weekend ? ind.hover : 'transparent',
              }}
            >
              {!future && !weekend && (
                // Today reads in full ink so the running day is unmistakable
                // against the finished ones.
                <div style={{ height: '100%', background: today ? ind.ink : ind.accent }} />
              )}
            </div>
            <span
              style={{
                fontFamily: DISPLAY, fontWeight: 600, fontSize: 10, letterSpacing: '.1em',
                textAlign: 'center', color: today ? ind.ink : ind.inkMuted,
                opacity: future || weekend ? 0.4 : 1,
              }}
            >
              {day.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Right column pieces
 * ------------------------------------------------------------------ */

function FloorItem({ ind, tint = false, name, tag, tagVariant, meta, actions }) {
  return (
    <div
      style={{
        padding: '14px 20px',
        background: tint ? ind.accentWash : 'transparent',
        borderBottom: `1px solid ${ind.rule}`,
      }}
    >
      <div className="flex items-center justify-between" style={{ gap: 10 }}>
        <span style={{ fontFamily: DISPLAY, fontWeight: 600, fontSize: 14, letterSpacing: '.04em', color: ind.ink, minWidth: 0 }}>
          {name}
        </span>
        {tag && <Tag ind={ind} variant={tagVariant}>{tag}</Tag>}
      </div>
      <p style={{ fontFamily: BODY, fontSize: 12.5, color: ind.inkMuted, margin: '4px 0 0', lineHeight: 1.45 }}>
        {meta}
      </p>
      {actions && <div className="flex" style={{ gap: 8, marginTop: 10 }}>{actions}</div>}
    </div>
  );
}

function QueuedRow({ ind, title, meta, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
        width: '100%', padding: '12px 20px', background: 'none', border: 'none',
        borderBottom: `1px solid ${ind.rule}`, cursor: onClick ? 'pointer' : 'default', textAlign: 'left',
      }}
    >
      <span style={{ minWidth: 0 }}>
        <span style={{ display: 'block', fontFamily: BODY, fontSize: 13, color: ind.ink }}>{title}</span>
        <span style={{ display: 'block', fontFamily: BODY, fontSize: 11.5, color: ind.inkMuted, marginTop: 2 }}>{meta}</span>
      </span>
      <ArrowRight size={15} strokeWidth={1.5} style={{ flex: 'none', color: ind.ink, opacity: 0.45 }} />
    </button>
  );
}

/* ------------------------------------------------------------------ *
 * Screen
 * ------------------------------------------------------------------ */

const PunchClock = ({ employees = [], allEmployees = [], showNotes = false }) => {
  const { user } = useAuth();
  const { isDarkMode } = useTheme();
  const { t, currentLanguage } = useLanguage();
  const { handleSessionAuthError } = useSessionGuard();
  const ind = getIndustry(isDarkMode);

  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [busy, setBusy] = useState(false);
  const [scope, setScope] = useState('mine');
  const [tick, setTick] = useState(() => new Date());

  const employeeId = String(user?.employeeId || user?.id || '');
  const today = useMemo(() => isoDate(tick), [tick]);
  const [session, setSession] = useState(() => readSession(employeeId, isoDate(new Date())));

  // One interval drives every live figure on the screen.
  useEffect(() => {
    const id = setInterval(() => setTick(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  /**
   * Restore the open punch whenever the identity or the day changes.
   *
   * Two sources, in this order:
   *
   *   localStorage  instant, so the clock is already running on the first paint
   *                 and there is no flash of "not punched in". The useState
   *                 initialiser above only runs once, with whatever `employeeId`
   *                 held at that instant, so reading again here is what removes
   *                 the assumption that auth had already rehydrated the user
   *                 before this screen mounted — after an idle logout it has
   *                 not, and the punch used to sit in storage with a stopped
   *                 clock on screen.
   *
   *   open_punches  authoritative, because it is the only copy that survives a
   *                 different browser or machine, or cleared site data. It wins
   *                 when both exist, and when only the local copy exists it gets
   *                 pushed up — that is the punch that was started while the
   *                 table was unreachable.
   *
   * Elapsed time is measured from `clockIn` against the wall clock, so putting
   * the session back is all it takes for time away to be counted.
   */
  useEffect(() => {
    if (!employeeId) return undefined;

    const local = readSession(employeeId, today);
    setSession((current) => {
      if (local) return local;
      // Nothing stored for this identity and day: drop anything held in memory
      // from a previous one, which is also what rolls a session over at midnight.
      return current && current.date === today ? current : null;
    });

    let cancelled = false;
    (async () => {
      const result = await punchClockService.getOpenPunch(employeeId, today);
      if (cancelled || !result.success) return;

      if (result.data) {
        setSession(result.data);
        writeSession(employeeId, result.data);
      } else if (local) {
        // Started on this device while the table was out of reach. Publish it
        // rather than letting the next machine find nothing.
        punchClockService.saveOpenPunch(employeeId, local);
      } else if (result.stale) {
        // A punch from an earlier day. The screen never resumes one, and leaving
        // the row behind would keep answering this query for ever.
        punchClockService.clearOpenPunch(employeeId);
      }
    })();

    return () => { cancelled = true; };
  }, [employeeId, today]);

  const now = nowMin(tick);

  const directory = useMemo(
    () => (allEmployees?.length ? allEmployees : employees) || [],
    [allEmployees, employees]
  );

  const nameOf = useCallback(
    (employee) => (employee ? getDemoEmployeeName(employee, t) || employee.name || '' : ''),
    [t]
  );

  const departmentLabel = useCallback(
    (key) => (key ? t(`employeeDepartment.${key}`, String(key).replace(/_/g, ' ')) : t('common.unassigned', 'Unassigned')),
    [t]
  );

  /* ---------------- data ---------------- */

  const weekBounds = useMemo(() => {
    const d = new Date(tick);
    // Monday-start week, matching the HAI…CN labels on the chart.
    const offset = (d.getDay() + 6) % 7;
    const start = new Date(d);
    start.setDate(d.getDate() - offset);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    return { start, end, startIso: isoDate(start), endIso: isoDate(end) };
    // Only the calendar day matters, so this recomputes at most once a day.
  }, [today]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchAll = useCallback(async (options = {}) => {
    const { silent = false } = options;
    if (!silent) setLoading(true);
    try {
      if (!isDemoMode()) {
        const auth = await validateAndRefreshSession();
        if (!auth.success) throw new Error(auth.error);
      }
      const result = await timeTrackingService.getAllTimeEntriesDetailed({
        startDate: weekBounds.startIso,
        endDate: weekBounds.endIso,
      });
      if (!result.success) throw new Error(result.error || 'Failed to load time entries');
      setEntries(result.data || []);
      setFetchError(null);
    } catch (error) {
      console.error('Error loading punch clock data:', error);
      if (handleSessionAuthError(error, { silent })) return;
      setFetchError(error.message);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [handleSessionAuthError, weekBounds.startIso, weekBounds.endIso]);

  useEffect(() => { fetchAll(); }, [fetchAll]);
  useAuthenticatedPageRefresh(() => fetchAll({ silent: true }));

  const hasRealData = !loading && !fetchError && entries.length > 0;

  /* ---------------- my day ---------------- */

  const myEntriesToday = useMemo(
    () => entries
      .filter((e) => String(e.employee_id) === employeeId && e.date === today)
      .sort((a, b) => (toMin(a.clock_in) ?? 0) - (toMin(b.clock_in) ?? 0)),
    [entries, employeeId, today]
  );

  /**
   * The strip shows the running session when there is one, and the entries
   * already filed for today when there is not — so a finished day still reads.
   */
  const dayIntervals = useMemo(() => {
    if (session?.clockIn != null) return sessionIntervals(session, Math.max(now, session.clockIn));
    return myEntriesToday
      .map((e) => ({ start: toMin(e.clock_in), end: toMin(e.clock_out), kind: 'work' }))
      .filter((i) => i.start != null && i.end != null && i.end > i.start);
  }, [session, now, myEntriesToday]);

  // Two different totals, and the difference matters. `elapsedMin` is time on
  // the clock, which is what the hero and the log report ("đã làm 9h 16m ·
  // nghỉ 45m" — 08:26 to 17:42 with 45m of it on break). `workedMin` is net of
  // breaks, and is what actually gets filed and paid.
  const workedMin = sumKind(dayIntervals, 'work');
  const breakMin = sumKind(dayIntervals, 'break');
  const elapsedMin = workedMin + breakMin;
  const onBreak = Boolean(session?.breaks?.some((b) => b.end == null));
  const punchedIn = Boolean(session?.clockIn != null);
  const overtimeMin = punchedIn ? workedAfter(dayIntervals, SHIFT_END_MIN) : 0;

  /* ---------------- the floor ---------------- */

  const floor = useMemo(() => {
    const todays = entries.filter((e) => e.date === today);
    const byEmployee = new Map();
    for (const entry of todays) {
      const key = String(entry.employee_id);
      if (!byEmployee.has(key)) byEmployee.set(key, []);
      byEmployee.get(key).push(entry);
    }

    const working = [];
    const breaking = [];
    const late = [];
    const finished = [];

    for (const [key, list] of byEmployee) {
      const spans = list
        .map((e) => ({ start: toMin(e.clock_in), end: toMin(e.clock_out), entry: e }))
        .filter((s) => s.start != null && s.end != null)
        .sort((a, b) => a.start - b.start);
      if (!spans.length) continue;

      if (spans[0].start > SHIFT_START_MIN + LATE_GRACE_MIN) {
        late.push({ key, minutes: spans[0].start - SHIFT_START_MIN, entry: spans[0].entry });
      }

      const inside = spans.find((s) => now >= s.start && now < s.end);
      if (inside) { working.push({ key, entry: inside.entry }); continue; }

      // Between two of the day's spans is a break — the only reading the
      // schema supports, and a real one.
      const gap = spans.some((s, i) => i > 0 && now >= spans[i - 1].end && now < s.start);
      if (gap) { breaking.push({ key }); continue; }
      if (now >= spans[spans.length - 1].end) finished.push({ key });
    }

    const hoursToday = todays.reduce((sum, e) => sum + (Number(e.hours) || 0), 0);
    const unclosed = todays.filter((e) => (e.status || 'pending') === 'pending');

    return { byEmployee, working, breaking, late, finished, hoursToday, unclosed, todays };
  }, [entries, today, now]);

  const headcount = directory.length;

  /** Entries whose length is implausible — the classic forgotten punch-out. */
  const anomalies = useMemo(() => {
    return entries
      .filter((e) => Number(e.hours) >= 12)
      .map((e) => ({
        entry: e,
        employee: directory.find((emp) => String(emp.id) === String(e.employee_id)),
        hours: Number(e.hours),
      }))
      .sort((a, b) => b.hours - a.hours)
      .slice(0, 2);
  }, [entries, directory]);

  const absent = useMemo(() => {
    const present = new Set(floor.byEmployee.keys());
    return directory.filter((emp) => !present.has(String(emp.id)));
  }, [directory, floor.byEmployee]);

  /* ---------------- week ---------------- */

  const weekDays = useMemo(() => {
    const labels = [
      t('punchClock.dayMon', 'HAI'), t('punchClock.dayTue', 'BA'), t('punchClock.dayWed', 'TƯ'),
      t('punchClock.dayThu', 'NĂM'), t('punchClock.dayFri', 'SÁU'), t('punchClock.daySat', 'BẢY'),
      t('punchClock.daySun', 'CN'),
    ];
    return labels.map((label, i) => {
      const date = new Date(weekBounds.start);
      date.setDate(weekBounds.start.getDate() + i);
      const key = isoDate(date);
      const isToday = key === today;
      const weekend = i >= 5;
      const onDay = entries.filter((e) => e.date === key);

      let minutes;
      if (scope === 'floor') {
        // Averaged per person who worked, so the 8h rule and the 40h contract
        // keep their meaning instead of being swamped by headcount.
        const worked = new Set(onDay.map((e) => String(e.employee_id)));
        const total = onDay.reduce((sum, e) => sum + (Number(e.hours) || 0) * 60, 0);
        minutes = worked.size ? total / worked.size : 0;
      } else {
        minutes = onDay
          .filter((e) => String(e.employee_id) === employeeId)
          .reduce((sum, e) => sum + (Number(e.hours) || 0) * 60, 0);
        if (isToday) minutes = Math.max(minutes, workedMin);
      }

      let kind = 'past';
      if (isToday) kind = 'today';
      else if (key > today) kind = 'future';
      else if (weekend && minutes <= 0) kind = 'weekend';

      return { key, label, minutes, kind };
    });
  }, [entries, employeeId, weekBounds.start, today, workedMin, scope, t]);

  const weekMinutes = weekDays.reduce((sum, d) => sum + d.minutes, 0);

  /* ---------------- the log ---------------- */

  const log = useMemo(() => {
    const rows = [];
    const filed = t('punchClock.sourceFiled', 'Entered by hand');
    const live = t('punchClock.sourceLive', 'Punched here');

    const source = scope === 'floor' ? floor.todays : myEntriesToday;
    for (const entry of source) {
      const start = toMin(entry.clock_in);
      const end = toMin(entry.clock_out);
      // On the floor view every row has to say who, or the times mean nothing.
      const who = scope === 'floor'
        ? `${nameOf(directory.find((e) => String(e.id) === String(entry.employee_id))) || entry.employee_name || '—'} · `
        : '';
      if (start != null) rows.push({ at: start, event: `${who}${t('punchClock.eventIn', 'Clock in')}`, source: filed, note: entry.notes || '' });
      if (end != null) rows.push({ at: end, event: `${who}${t('punchClock.eventOut', 'Clock out')}`, source: filed, note: durLabel(end - start) });
    }
    if (scope === 'mine' && session?.clockIn != null) {
      rows.push({ at: session.clockIn, event: t('punchClock.eventIn', 'Clock in'), source: live, note: t('punchClock.onTime', 'On time') });
      for (const brk of session.breaks || []) {
        rows.push({ at: brk.start, event: t('punchClock.eventBreakStart', 'Break start'), source: live, note: '' });
        if (brk.end != null) {
          rows.push({ at: brk.end, event: t('punchClock.eventBreakEnd', 'Break end'), source: live, note: durLabel(brk.end - brk.start) });
        }
      }
      rows.push({ at: now, event: t('punchClock.eventRunning', 'Running'), source: live, note: durLabel(elapsedMin), running: true });
    }
    return rows.sort((a, b) => a.at - b.at).slice(-7);
  }, [myEntriesToday, floor.todays, scope, directory, nameOf, session, now, elapsedMin, t]);

  /* ---------------- departments ---------------- */

  const departments = useMemo(() => {
    const totals = new Map();
    for (const emp of directory) {
      const key = emp.department || 'unassigned';
      if (!totals.has(key)) totals.set(key, { key, total: 0, present: 0 });
      totals.get(key).total += 1;
    }
    for (const { key } of floor.working) {
      const emp = directory.find((e) => String(e.id) === key);
      const dept = emp?.department || 'unassigned';
      if (totals.has(dept)) totals.get(dept).present += 1;
    }
    return [...totals.values()]
      .filter((row) => row.total > 0)
      .sort((a, b) => b.present - a.present || b.total - a.total);
  }, [directory, floor.working]);

  /* ---------------- actions ---------------- */

  /**
   * The one way the punch changes. Writes both copies: localStorage first
   * because it is synchronous and the screen reads it back on the next mount,
   * then the table, which is what another machine will find. A failed write to
   * the table is logged rather than surfaced — the punch is safe locally either
   * way, and interrupting someone clocking on to report a sync problem would
   * cost more than it explains.
   */
  const commit = useCallback((next) => {
    setSession(next);
    writeSession(employeeId, next);
    const remote = next
      ? punchClockService.saveOpenPunch(employeeId, next)
      : punchClockService.clearOpenPunch(employeeId);
    remote.then((result) => {
      if (!result?.success) console.warn('Open punch did not reach the server:', result?.error);
    });
  }, [employeeId]);

  const handlePunchIn = useCallback(() => {
    if (!employeeId) {
      setNotice(t('punchClock.noEmployee', 'This account is not linked to an employee record.'));
      return;
    }
    commit({ date: today, clockIn: Math.round(now), breaks: [] });
    setNotice(t('punchClock.punchedIn', 'Punched in at {time}').replace('{time}', minToClock(now)));
  }, [commit, employeeId, now, today, t]);

  const handleBreak = useCallback(() => {
    if (!session) return;
    const breaks = [...(session.breaks || [])];
    const open = breaks.findIndex((b) => b.end == null);
    if (open >= 0) breaks[open] = { ...breaks[open], end: Math.round(now) };
    else breaks.push({ start: Math.round(now), end: null });
    commit({ ...session, breaks });
  }, [commit, session, now]);

  const handlePunchOut = useCallback(async () => {
    if (!session || busy) return;
    setBusy(true);
    try {
      const closed = { ...session, breaks: (session.breaks || []).map((b) => (b.end == null ? { ...b, end: Math.round(now) } : b)) };
      const intervals = sessionIntervals(closed, Math.round(now));
      const worked = sumKind(intervals, 'work');

      const result = await timeTrackingService.createTimeEntry({
        employeeId,
        date: today,
        clockIn: minToClock(session.clockIn),
        clockOut: minToClock(now),
        // Breaks are excluded from the filed total; the schema stores one
        // span, so the break time simply is not paid.
        hours: Number((worked / 60).toFixed(1)),
        hourType: 'regular',
        notes: breakMin > 0
          ? t('punchClock.filedWithBreak', 'Live punch · {n} break').replace('{n}', durLabel(breakMin))
          : t('punchClock.filedLive', 'Live punch'),
        status: 'pending',
      });
      if (!result.success) throw new Error(result.error || 'Failed to file the entry');

      commit(null);
      setNotice(t('punchClock.punchedOut', 'Punched out. {n} filed for approval.').replace('{n}', durLabel(worked)));
      fetchAll({ silent: true });
    } catch (error) {
      console.error('Punch out failed:', error);
      setNotice(error.message);
    } finally {
      setBusy(false);
    }
  }, [session, busy, now, employeeId, today, breakMin, commit, fetchAll, t]);

  /* ---------------- presentation helpers ---------------- */

  const clockText = `${pad2(tick.getHours())}:${pad2(tick.getMinutes())}:${pad2(tick.getSeconds())}`;
  const dateLabel = tick.toLocaleDateString(currentLanguage === 'vn' ? 'vi-VN' : undefined, {
    weekday: 'long', day: '2-digit', month: 'short', year: 'numeric',
  });

  const captionStyle = { fontFamily: BODY, fontSize: 11.5, color: ind.inkMuted, margin: '4px 0 0', lineHeight: 1.5 };
  const figureTitle = {
    fontFamily: DISPLAY, fontWeight: 600, fontSize: 14, letterSpacing: '.06em',
    textTransform: 'uppercase', color: ind.ink,
  };
  const cellStyle = { padding: '7px 0', borderBottom: `1px solid ${ind.rule}`, fontFamily: BODY, fontSize: 12.5 };

  const me = directory.find((e) => String(e.id) === employeeId);
  const myDepartment = me?.department ? departmentLabel(me.department) : '';

  /* ---------------- render ---------------- */

  return (
    <div
      data-screen-label="Punch clock"
      style={{
        border: `1px solid ${ind.hairline}`,
        background: ind.ground,
        color: ind.ink,
        fontFamily: BODY,
        fontSize: 14,
        borderRadius: 0,
      }}
    >
      {/* ── TICKER — six figures, then the date ────────────────────── */}
      <div
        style={{
          height: 44, background: ind.tickerBg, color: ind.tickerInk,
          borderBottom: `1px solid ${ind.hairline}`,
          display: 'flex', alignItems: 'stretch', overflowX: 'auto', overflowY: 'hidden',
        }}
      >
        <TickerCell ind={ind}>
          <LiveClock ind={ind} live={hasRealData} />
        </TickerCell>
        <TickerCell
          ind={ind}
          label={t('punchClock.onTheFloor', 'On the floor')}
          value={floor.working.length}
          title={t('punchClock.ofHeadcount', '{n} of {total} employees').replace('{n}', String(floor.working.length)).replace('{total}', String(headcount))}
        />
        <TickerCell ind={ind} label={t('punchClock.onBreak', 'On break')} value={floor.breaking.length} />
        <TickerCell ind={ind} label={t('punchClock.hoursToday', 'Hours today')} value={`${floor.hoursToday.toFixed(1)}h`} />
        <TickerCell ind={ind} label={t('punchClock.lateToday', 'Late')} value={floor.late.length} />
        <TickerCell
          ind={ind}
          label={t('punchClock.unclosed', 'Unclosed')}
          value={floor.unclosed.length}
          // The one figure on the strip that asks for a decision.
          valueColor={floor.unclosed.length > 0 ? ind.tickerUp : undefined}
        />

        <div
          style={{
            flex: 1, minWidth: 'max-content', display: 'flex', alignItems: 'center',
            justifyContent: 'flex-end', gap: 8, padding: '0 14px',
            borderLeft: `1px solid ${ind.tickerRule}`,
          }}
        >
          <FetchElapsedPill active={loading} isDarkMode label={t('common.fetching', 'Fetching')} />
          <span style={{ fontFamily: DISPLAY, fontWeight: 600, fontSize: 12.5, letterSpacing: '.06em', textTransform: 'uppercase' }}>
            {dateLabel}
          </span>
        </div>
      </div>

      {/* ── BANDS ─────────────────────────────────────────────────── */}
      <div className="flex flex-col lg:flex-row items-stretch">

        {/* ── LEFT ───────────────────────────────────────────────── */}
        <div
          className="flex-1 min-w-0 flex flex-col"
          style={{ padding: '22px 24px 20px', gap: 16, borderRight: `1px solid ${ind.hairline}` }}
        >
          {fetchError && (
            <div style={{ border: `1px solid ${ind.ink}`, padding: '12px 14px', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <AlertCircle size={16} strokeWidth={1.5} style={{ flex: 'none', marginTop: 2, color: ind.ink }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <Kicker ind={ind} color={ind.ink}>{t('common.error', 'Error')}</Kicker>
                <p style={{ fontFamily: BODY, fontSize: 13, color: ind.inkMuted, marginTop: 4 }}>{fetchError}</p>
              </div>
            </div>
          )}

          {notice && (
            <div
              className="flex items-center justify-between"
              style={{ border: `1px solid ${ind.hairline}`, background: ind.accentWash, padding: '9px 12px', gap: 10 }}
            >
              <span style={{ fontFamily: BODY, fontSize: 12.5, color: ind.ink }}>{notice}</span>
              <button
                type="button"
                onClick={() => setNotice(null)}
                aria-label={t('common.close', 'Close')}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: ind.inkMuted, padding: 0 }}
              >
                <X size={14} strokeWidth={1.5} />
              </button>
            </div>
          )}

          {/* Title row */}
          <div className="flex flex-wrap items-end justify-between" style={{ gap: 20 }}>
            <div style={{ minWidth: 0 }}>
              <h1 style={{ fontFamily: BODY, fontSize: 32, fontWeight: 400, margin: 0, color: ind.ink, lineHeight: 1.1 }}>
                {t('punchClock.title', 'Punch clock')}
              </h1>
              <p style={{ fontFamily: BODY, fontSize: 13, color: ind.inkMuted, marginTop: 6 }}>
                {[nameOf(me), myDepartment, `${t('punchClock.shift', 'shift')} ${minToClock(SHIFT_START_MIN)} – ${minToClock(SHIFT_END_MIN)}`]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
            </div>
            <div className="flex items-center" style={{ gap: 10 }}>
              <Seg
                ind={ind}
                options={[
                  { value: 'mine', label: t('punchClock.scopeMine', 'Mine') },
                  { value: 'floor', label: t('punchClock.scopeFloor', 'Whole floor') },
                ]}
                value={scope}
                onChange={setScope}
                ariaLabel={t('punchClock.scope', 'Scope')}
              />
              <Btn ind={ind} onClick={() => fetchAll()} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <RefreshCw size={13} strokeWidth={1.5} />
                {t('punchClock.sync', 'Sync')}
              </Btn>
            </div>
          </div>

          {/* ── Hero — the punch ──────────────────────────────────── */}
          <Blueprint ind={ind} style={{ padding: '18px 20px 16px', flex: 'none' }}>
            <div className="flex flex-col md:flex-row items-start justify-between" style={{ gap: 28 }}>
              <div style={{ minWidth: 0 }}>
                <Kicker ind={ind}>
                  {punchedIn
                    ? t('punchClock.countingFrom', 'Counting from {time}').replace('{time}', minToClock(session.clockIn))
                    : t('punchClock.notPunchedIn', 'Not punched in')}
                </Kicker>
                {/* The largest thing on any screen in the console. Nothing else
                    on the board comes near it. */}
                <div
                  style={{
                    ...figure(76, ind.ink),
                    lineHeight: 0.94,
                    letterSpacing: '-.01em',
                    margin: '6px 0 4px',
                  }}
                >
                  {clockText}
                </div>
                <p style={{ fontFamily: BODY, fontSize: 12.5, color: ind.inkMuted, margin: 0, lineHeight: 1.5 }}>
                  {punchedIn || elapsedMin > 0
                    ? `${dateLabel} · ${t('punchClock.onClock', 'on the clock {n}').replace('{n}', durLabel(elapsedMin))} · ${t('punchClock.breakTotal', 'break {n}').replace('{n}', durLabel(breakMin))}`
                    : `${dateLabel} · ${t('punchClock.readyToPunch', 'nothing recorded yet today')}`}
                </p>
              </div>

              <div className="flex flex-col items-end" style={{ gap: 12, flex: 'none' }}>
                <div className="flex" style={{ gap: 6 }}>
                  <Tag ind={ind} variant="accent">{t('punchClock.regularHours', 'Regular hours')}</Tag>
                  <Tag ind={ind} variant="neutral">
                    {t('punchClock.overtimeAfter', 'Overtime after {time}').replace('{time}', minToClock(SHIFT_END_MIN))}
                  </Tag>
                </div>
                <div className="flex items-center" style={{ gap: 8 }}>
                  {punchedIn && (
                    <Btn ind={ind} onClick={handleBreak} style={{ padding: '10px 18px' }}>
                      {onBreak ? t('punchClock.endBreak', 'End break') : t('punchClock.startBreak', 'Start break')}
                    </Btn>
                  )}
                  {/* The single dominant action. There is no second primary. */}
                  <Btn
                    ind={ind}
                    variant="primary"
                    disabled={busy}
                    onClick={punchedIn ? handlePunchOut : handlePunchIn}
                    style={{ padding: '10px 30px', fontSize: 15 }}
                  >
                    {punchedIn ? t('punchClock.punchOut', 'Punch out') : t('punchClock.punchIn', 'Punch in')}
                  </Btn>
                </div>
                <p style={{ fontFamily: BODY, fontSize: 11.5, color: ind.inkFaint, margin: 0, textAlign: 'right' }}>
                  {punchedIn
                    ? (overtimeMin > 0
                      ? t('punchClock.consequenceOvertime', 'Punching out now records {n} overtime').replace('{n}', durLabel(overtimeMin))
                      : t('punchClock.consequencePlain', 'Punching out now files {n} for approval').replace('{n}', durLabel(workedMin)))
                    : t('punchClock.consequenceIn', 'Punching in starts the count against your {time} shift').replace('{time}', minToClock(SHIFT_START_MIN))}
                </p>
              </div>
            </div>

            <DayStrip ind={ind} intervals={dayIntervals} now={now} t={t} />
          </Blueprint>

          {/* ── Lower pair ────────────────────────────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-2" style={{ gap: 16, flex: 1, minHeight: 260 }}>

            {/* This week */}
            <Blueprint ind={ind} style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
              <div className="flex items-baseline justify-between" style={{ gap: 10 }}>
                <span style={figureTitle}>{t('punchClock.thisWeek', 'This week')}</span>
                <span style={{ ...figure(18, ind.ink) }}>
                  {(weekMinutes / 60).toFixed(1)}h
                  <span style={{ fontFamily: BODY, fontWeight: 400, fontSize: 11.5, color: ind.inkMuted }}>
                    {` ${t('punchClock.ofContract', 'of {n}h').replace('{n}', String(CONTRACT_WEEK_MIN / 60))}`}
                  </span>
                </span>
              </div>
              <p style={{ ...captionStyle, marginBottom: 12 }}>
                {`${scope === 'floor'
                  ? t('punchClock.weekFloor', 'Averaged per person who worked')
                  : t('punchClock.weekMine', 'Your hours')} · ${t('punchClock.weekCaption', 'the rule is the {n}h contract day').replace('{n}', String(CONTRACT_DAY_MIN / 60))}`}
              </p>
              <WeekChart ind={ind} days={weekDays} t={t} />
            </Blueprint>

            {/* Punch log */}
            <Blueprint ind={ind} style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
              <div className="flex items-baseline justify-between" style={{ gap: 10 }}>
                <span style={figureTitle}>{t('punchClock.log', 'Punch log')}</span>
              </div>
              <p style={{ ...captionStyle, marginBottom: 10 }}>
                {t('punchClock.logCaption', 'Every event keeps its source; corrections never overwrite the original')}
              </p>

              {log.length === 0 ? (
                <p style={{ fontFamily: BODY, fontSize: 12.5, color: ind.inkFaint, margin: 0 }}>
                  {t('punchClock.logEmpty', 'No punches recorded today.')}
                </p>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      {[
                        [t('punchClock.colTime', 'Time'), '22%', 'left'],
                        [t('punchClock.colEvent', 'Event'), 'auto', 'left'],
                        [t('punchClock.colSource', 'Source'), '30%', 'left'],
                        [t('punchClock.colNote', 'Note'), '22%', 'right'],
                      ].map(([label, width, align]) => (
                        <th
                          key={label}
                          style={{
                            width, textAlign: align, padding: '0 0 6px',
                            borderBottom: `1px solid ${ind.hairline}`,
                            fontFamily: DISPLAY, fontWeight: 600, fontSize: 10,
                            letterSpacing: '.14em', textTransform: 'uppercase', color: ind.inkMuted,
                          }}
                        >
                          {label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {log.map((row, i) => (
                      <tr key={`${row.at}-${row.event}-${i}`}>
                        <td style={{ ...cellStyle, fontFamily: DISPLAY, fontWeight: 600, fontSize: 13, color: row.running ? ind.accent : ind.ink }}>
                          {minToClock(row.at)}
                        </td>
                        <td style={{ ...cellStyle, color: row.running ? ind.accent : ind.ink }}>{row.event}</td>
                        <td style={{ ...cellStyle, color: ind.inkMuted }}>{row.source}</td>
                        <td style={{ ...cellStyle, textAlign: 'right', color: ind.inkMuted, fontFamily: row.running ? DISPLAY : BODY, fontWeight: row.running ? 600 : 400 }}>
                          {row.note}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              <div style={{ flex: 1, minHeight: 6 }} />
              <div
                className="flex items-center justify-between"
                style={{ borderTop: `1px solid ${ind.rule}`, paddingTop: 10, gap: 10 }}
              >
                <span style={{ fontFamily: BODY, fontSize: 11.5, color: ind.inkMuted }}>
                  {t('punchClock.pendingApproval', '{n} entr(ies) awaiting approval').replace('{n}', String(floor.unclosed.filter((e) => String(e.employee_id) === employeeId).length))}
                </span>
              </div>
            </Blueprint>
          </div>

          {showNotes && (
            <p className="dv-rn" style={{ fontFamily: BODY, fontSize: 11.5, color: ind.inkFaint, margin: 0 }}>
              {t('punchClock.rationale', 'The 76px clock and one solid button carry the screen: everything else is evidence for the single decision of when to punch.')}
            </p>
          )}
        </div>

        {/* ── RIGHT — the floor, 340px ───────────────────────────── */}
        <aside
          className="w-full lg:w-[340px] lg:shrink-0 flex flex-col"
          style={{ background: ind.chrome, overflow: 'hidden' }}
        >
          <div style={{ padding: '20px 20px 12px', borderBottom: `1px solid ${ind.hairline}` }}>
            <div className="flex items-baseline justify-between" style={{ gap: 10 }}>
              <ColumnHeading ind={ind}>{t('punchClock.floorStatus', 'Floor status')}</ColumnHeading>
              <span style={{ fontFamily: DISPLAY, fontWeight: 600, fontSize: 12, color: ind.accent, whiteSpace: 'nowrap' }}>
                {t('punchClock.nWorking', '{n} working').replace('{n}', String(floor.working.length))}
              </span>
            </div>
            <p style={captionStyle}>
              {anomalies.length > 0
                ? t('punchClock.needDecision', '{n} punch(es) need someone to decide').replace('{n}', String(anomalies.length))
                : t('punchClock.allClean', 'Nothing on the floor needs a decision.')}
            </p>
          </div>

          <div style={{ flex: 1, overflow: 'hidden' }}>
            {anomalies.map((item, index) => (
              <FloorItem
                key={item.entry.id ?? index}
                ind={ind}
                // At most one tinted card on the board.
                tint={index === 0}
                name={(nameOf(item.employee) || item.entry.employee_name || '—').toUpperCase()}
                tag={durLabel(item.hours * 60)}
                tagVariant="outline"
                meta={[
                  t('punchClock.impossibleSpan', 'Span too long to be a real shift'),
                  departmentLabel(item.employee?.department),
                  item.entry.date,
                ].filter(Boolean).join(' · ')}
                actions={(
                  <>
                    <Btn ind={ind} variant="primary" style={{ padding: '4px 12px', fontSize: 12.5 }}
                      onClick={() => setNotice(t('punchClock.wouldClose', 'Closing a punch needs the 3a review screen.'))}>
                      {t('punchClock.closeAt', 'Close at {time}').replace('{time}', minToClock(SHIFT_END_MIN))}
                    </Btn>
                    <Btn ind={ind} style={{ padding: '4px 12px', fontSize: 12.5 }}
                      onClick={() => setNotice(t('punchClock.wouldEdit', 'Manual correction lives on the 3a screen.'))}>
                      {t('punchClock.enterByHand', 'Enter by hand')}
                    </Btn>
                  </>
                )}
              />
            ))}

            <QueuedRow
              ind={ind}
              title={t('punchClock.lateToday', 'Late')}
              meta={floor.late.length > 0
                ? t('punchClock.lateMeta', '{n} people · longest {m}')
                  .replace('{n}', String(floor.late.length))
                  .replace('{m}', durLabel(Math.max(...floor.late.map((l) => l.minutes))))
                : t('punchClock.noneLate', 'Everyone was inside the grace period')}
            />
            <QueuedRow
              ind={ind}
              title={t('punchClock.noPunch', 'No punch today')}
              meta={absent.length > 0
                ? absent.slice(0, 2).map(nameOf).filter(Boolean).join(' · ') + (absent.length > 2 ? ` +${absent.length - 2}` : '')
                : t('punchClock.everyonePunched', 'Everyone on the roster has punched')}
            />

            {/* Working by department */}
            <div style={{ padding: '18px 20px 12px', marginTop: 6, borderBottom: `1px solid ${ind.hairline}` }}>
              <ColumnHeading ind={ind} style={{ fontSize: 14 }}>
                {t('punchClock.workingByDept', 'Working by department')}
              </ColumnHeading>
            </div>
            <div style={{ padding: '14px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              {departments.map((row, index) => (
                <div key={row.key}>
                  <div className="flex items-baseline justify-between" style={{ gap: 8, marginBottom: 4 }}>
                    <span style={{ fontFamily: BODY, fontSize: 12.5, color: ind.ink, minWidth: 0 }}>
                      {departmentLabel(row.key === 'unassigned' ? null : row.key)}
                    </span>
                    <span style={{ fontFamily: DISPLAY, fontWeight: 600, fontSize: 12.5, color: ind.ink, whiteSpace: 'nowrap' }}>
                      {row.present}
                      <span style={{ color: ind.inkFaint }}>{` / ${row.total}`}</span>
                    </span>
                  </div>
                  <Bar ind={ind} value={row.total ? row.present / row.total : 0} fill={rampAt(ind, index)} height={8} />
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
};

export default PunchClock;
