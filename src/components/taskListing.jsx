/**
 * Task Listing — a ledger of tasks (4a) and the spec sheet for one of them (4b).
 *
 * The one idea both screens encode: a task here is never a free-standing to-do,
 * it is emitted by a record. In this database that record is the employee row a
 * `workload_tasks` row hangs off, so every group band names the record, every
 * row carries the source that opened it, and every second line states a
 * consequence with a real number instead of restating the title.
 *
 * Where the numbers come from — everything is derived, nothing is stored twice:
 *   open           status is neither completed nor cancelled
 *   overdue        open and its due date is already past
 *   due today      open and its due date is today
 *   unscheduled    open and it has no due date at all — it cannot be chased,
 *                  which is this schema's version of "blocked on something else"
 *   closed on time closed, had a due date, and its close stamp lands on or
 *                  before the end of that day (close stamp = completed_at when
 *                  the row carries one, otherwise updated_at)
 *   record N/M     every task on that record, closed ones included, so the
 *                  fraction stays the record's true state while the rows below
 *                  it obey the segment filter
 *   elapsed        opened → closed (or → today), measured against the window
 *                  the due date allows, so the bar percentage is real
 *
 * Deliberate substitutions from the design spec, because the schema has no
 * column for them: there are no task lists, dependencies, sub-steps or booked
 * hours, so `01 Steps` is the task's own lifecycle in dependency order, `02
 * Chain` is the record chain (who opened it, what it belongs to, what sits
 * beside it) and `03 Elapsed` replaces booked hours. Nothing on either screen
 * is seeded — an empty field says what would fill it rather than inventing a
 * value.
 *
 * A viewer without canViewReports only ever fetches their own tasks, so the
 * same layout degrades to a one-person ledger rather than leaking the org's
 * workload.
 *
 * Design system: "Industry" (src/theme/industry.js). Radius is 0 everywhere,
 * cards are outlines with four registration corners, urgency reads through
 * words and ink weight rather than red and green.
 */
import _React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle, ArrowRight, Check, ChevronDown, Download, Plus, Search, Trash2, X,
} from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext.jsx';
import { useLanguage } from '../contexts/LanguageContext.jsx';
import { useAuth } from '../contexts/AuthContext.jsx';
import * as workloadService from '../services/workloadService.js';
import { useSessionGuard, useAuthenticatedPageRefresh } from '../hooks/useSessionGuard.js';
import { validateAndRefreshSession } from '../utils/sessionHelper.js';
import { isRealtimeMutation } from '../utils/realtimeHelpers.js';
import { isDemoMode, getDemoEmployeeName, getDemoTaskTitle, getDemoTaskDescription } from '../utils/demoHelper.js';
import { filterActiveEmployees } from '../utils/employeeStatus.js';
import { getEmployeePositionI18nKey } from '../utils/employeePositionKey.js';
import { escapeCsvCell } from '../utils/reportExportHelpers.js';
import { formatDate } from '../utils/localeFormat.js';
import { DatePicker } from './ui/date-picker.jsx';
import { TranslatedText } from './ui/translated-text.jsx';
import { FetchElapsedPill } from './ui/fetch-elapsed-pill';
import { getIndustry, DISPLAY, BODY, figure } from '../theme/industry.js';
import {
  Blueprint, Bar, Tag, Btn, Seg, TickerCell, LiveClock, ColumnHeading, FlatSelect,
} from './ui/industry.jsx';

/* ------------------------------------------------------------------ *
 * Screen constants
 * ------------------------------------------------------------------ */

const DAY_MS = 86400000;

/** The ledger opens truncated and says so; SHOW ALL lifts both caps. */
const MAX_GROUPS = 3;
const MAX_ROWS_PER_GROUP = 4;

/** Decision column: two items carry buttons, two more are named. */
const DECISION_CARDS = 2;
const DECISION_ROWS = 2;
/** "Your day" lists this many of the signed-in user's own tasks. */
const YOUR_DAY_ROWS = 5;

/** A due date this many days out or nearer is worth naming in days, not a date. */
const NEAR_DAYS = 6;

const CLOSED_STATUS = 'completed';
const CANCELLED_STATUS = 'cancelled';

/* ------------------------------------------------------------------ *
 * Helpers
 * ------------------------------------------------------------------ */

const norm = (value) => String(value ?? '').toLowerCase().replace(/_/g, '-');

const startOfDay = (date) => {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
};

/** Whole days from `from` to `to`, both snapped to midnight. */
const daysBetween = (from, to) => Math.round((startOfDay(to) - startOfDay(from)) / DAY_MS);

const isClosed = (task) => norm(task.status) === CLOSED_STATUS;
const isCancelled = (task) => norm(task.status) === CANCELLED_STATUS;

/** The stamp we treat as "when this closed". The table stores no completed_at
 *  on every deployment, so updated_at stands in where it is missing. */
const closeStampOf = (task) => task.completed_at || task.updated_at || null;

/** ĐẶNG LÊ MINH → "ĐM". Two letters, condensed, in a hairline square. */
const initialsOf = (name) => {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '—';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

/**
 * Real ids are uuids on Supabase and short strings in demo mode, and neither is
 * readable. The ledger shows a stable four-character handle instead: the tail of
 * a long id, or the padded number of a short one.
 */
const handleOf = (id) => {
  const raw = String(id ?? '').replace(/[^a-zA-Z0-9]/g, '');
  if (!raw) return 'T-0000';
  if (raw.length > 8) return `T-${raw.slice(-4).toUpperCase()}`;
  const digits = raw.replace(/[^0-9]/g, '');
  return `T-${(digits || raw).slice(-4).padStart(4, '0').toUpperCase()}`;
};

/* ------------------------------------------------------------------ *
 * Primitives particular to these two screens
 * ------------------------------------------------------------------ */

/** 15×15 square. Square only — never a circle, never a radio. */
function SquareCheck({ ind, done, size = 15, onClick, label, disabled }) {
  const common = {
    width: size,
    height: size,
    flex: 'none',
    borderRadius: 0,
    padding: 0,
    boxSizing: 'border-box',
    cursor: onClick && !disabled ? 'pointer' : 'default',
  };
  if (done) {
    return (
      <button
        type="button"
        aria-label={label}
        aria-pressed
        disabled={disabled || !onClick}
        onClick={onClick}
        style={{
          ...common,
          display: 'grid',
          placeItems: 'center',
          border: `1px solid ${ind.accent}`,
          background: ind.accent,
          color: ind.accentInk,
        }}
      >
        <Check size={Math.round(size * 0.72)} strokeWidth={2} />
      </button>
    );
  }
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={false}
      disabled={disabled || !onClick}
      onClick={onClick}
      style={{
        ...common,
        display: 'block',
        border: `1px solid ${ind.inkFaint}`,
        background: 'transparent',
      }}
    />
  );
}

/** Text only — no pill, no dot, no colour chip. */
function StateWord({ ind, state, label }) {
  const tone = {
    done: { color: ind.ink, opacity: 0.45 },
    cancelled: { color: ind.ink, opacity: 0.45 },
    open: { color: ind.inkGhost },
    progress: { color: ind.inkGhost },
    unscheduled: { color: ind.accent },
    overdue: { color: ind.accentDeep },
  }[state] || { color: ind.inkGhost };
  return (
    <span
      style={{
        fontFamily: DISPLAY, fontWeight: 600, fontSize: 11, letterSpacing: '.1em',
        textTransform: 'uppercase', whiteSpace: 'nowrap', ...tone,
      }}
    >
      {label}
    </span>
  );
}

/** 22×22 hairline initials square + name. */
function OwnerCell({ ind, name, muted, size = 22 }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
      <span
        aria-hidden="true"
        style={{
          width: size, height: size, flex: 'none',
          border: `1px solid ${ind.hairline}`,
          display: 'grid', placeItems: 'center',
          fontFamily: DISPLAY, fontWeight: 600, fontSize: 10,
          color: ind.ink, opacity: muted ? 0.6 : 1,
        }}
      >
        {initialsOf(name)}
      </span>
      <span
        style={{
          fontFamily: BODY, fontSize: 12.5, color: ind.ink, opacity: muted ? 0.6 : 1,
          minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}
      >
        {name}
      </span>
    </div>
  );
}

/** N / M DONE + a hairline bar at the matching share. Never rounded. */
function GroupProgress({ ind, done, total, label }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 'none' }}>
      <span
        style={{
          fontFamily: DISPLAY, fontWeight: 600, fontSize: 12, letterSpacing: '.06em',
          textTransform: 'uppercase', color: ind.inkGhost, whiteSpace: 'nowrap',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {`${done} / ${total} ${label}`}
      </span>
      <div style={{ width: 76, flex: 'none' }}>
        <Bar ind={ind} value={total > 0 ? done / total : 0} height={6} />
      </div>
    </div>
  );
}

/** A fixed relation word beside its subject — the grammar of `02 Chain`. */
function RelationRow({ ind, relation, strong, subject, detail, onClick }) {
  const body = (
    <>
      <span
        style={{
          width: 72, flex: 'none',
          fontFamily: DISPLAY, fontWeight: 600, fontSize: 10, letterSpacing: '.12em',
          textTransform: 'uppercase', color: strong ? ind.accent : ind.inkFaint,
        }}
      >
        {relation}
      </span>
      <span style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
        <span className="block" style={{ fontFamily: BODY, fontSize: 13, color: ind.ink, lineHeight: 1.35 }}>
          {subject}
        </span>
        <span className="block" style={{ fontFamily: BODY, fontSize: 11.5, color: ind.inkMuted, marginTop: 2 }}>
          {detail}
        </span>
      </span>
    </>
  );
  const style = {
    display: 'flex', alignItems: 'center', gap: 11, padding: '9px 0', width: '100%',
    borderTop: `1px solid ${ind.rule}`, background: 'none', border: 'none',
    borderTopWidth: 1, borderTopStyle: 'solid', borderTopColor: ind.rule,
    borderRadius: 0, textAlign: 'left',
  };
  if (!onClick) return <div style={style}>{body}</div>;
  return (
    <button type="button" onClick={onClick} style={{ ...style, cursor: 'pointer' }}>
      {body}
    </button>
  );
}

/** label left, value right — the RECORD column's field rows. */
function FieldRow({ ind, label, children }) {
  return (
    <div
      style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 14,
        padding: '11px 20px', borderBottom: `1px solid ${ind.rule}`, fontSize: 12.5,
      }}
    >
      <span style={{ fontFamily: BODY, fontSize: 12.5, color: ind.inkMuted, flex: 'none' }}>{label}</span>
      <span style={{ fontFamily: BODY, fontSize: 12.5, color: ind.ink, textAlign: 'right', minWidth: 0 }}>
        {children}
      </span>
    </div>
  );
}

/** Panel header: number · title · a state note that is never optional. */
function PanelHead({ ind, num, title, note }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
      <span style={{ fontFamily: DISPLAY, fontWeight: 600, fontSize: 10, letterSpacing: '.16em', color: ind.accent }}>
        {num}
      </span>
      <span
        style={{
          fontFamily: DISPLAY, fontWeight: 600, fontSize: 16, letterSpacing: '.06em',
          textTransform: 'uppercase', color: ind.ink,
        }}
      >
        {title}
      </span>
      {note && (
        <span style={{ fontFamily: BODY, fontSize: 11.5, color: ind.inkMuted, marginLeft: 'auto' }}>{note}</span>
      )}
    </div>
  );
}

/** An underlined inline link that stays inside the type system. */
function InlineLink({ ind, onClick, children, size = 11.5 }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        background: 'none', border: 'none', padding: 0, cursor: 'pointer',
        fontFamily: BODY, fontSize: size, color: ind.accentDeep, textDecoration: 'underline',
      }}
    >
      {children}
    </button>
  );
}

/** SHOW ALL → · CHANGE ⌄ — a tracked condensed link with a trailing glyph. */
function ActionLink({ ind, onClick, children, icon = ArrowRight }) {
  const Glyph = icon;
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        background: 'none', border: 'none', padding: 0, cursor: 'pointer',
        fontFamily: DISPLAY, fontWeight: 600, fontSize: 11, letterSpacing: '.12em',
        textTransform: 'uppercase', color: ind.accentDeep,
      }}
    >
      {children}
      <Glyph size={12} strokeWidth={1.5} />
    </button>
  );
}

/* ------------------------------------------------------------------ *
 * Task form — the one modal on the screen
 * ------------------------------------------------------------------ */

const EMPTY_FORM = {
  title: '', description: '', dueDate: '', priority: 'medium', status: 'pending',
  selfAssessment: '', qualityRating: 0, assignedTo: '',
};

function TaskFormModal({
  ind, t, form, setForm, mode, canAssign, assignable, onClose, onSave, onDelete, employeeLabel,
}) {
  useEffect(() => {
    const onKey = (event) => { if (event.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  const label = {
    fontFamily: DISPLAY, fontWeight: 600, fontSize: 10, letterSpacing: '.14em',
    textTransform: 'uppercase', color: ind.inkMuted, display: 'block', marginBottom: 5,
  };
  const field = {
    width: '100%', fontFamily: BODY, fontSize: 13, color: ind.ink,
    background: 'transparent', border: `1px solid ${ind.hairline}`, borderRadius: 0,
    padding: '7px 10px', outline: 'none',
  };

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(0,0,0,.5)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
      }}
      role="dialog"
      aria-modal="true"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className="w-full max-w-[560px] max-h-[88vh] overflow-y-auto"
        style={{ background: ind.ground, border: `1px solid ${ind.ink}`, borderRadius: 0, padding: '20px 22px 22px' }}
      >
        <div className="flex items-baseline justify-between" style={{ gap: 12, marginBottom: 16 }}>
          <ColumnHeading ind={ind}>
            {mode === 'edit' ? t('taskListing.editTask', 'Edit Task') : t('taskListing.addTask', 'Add Task')}
          </ColumnHeading>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('common.close', 'Close')}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: ind.inkMuted, padding: 0 }}
          >
            <X size={15} strokeWidth={1.5} />
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {canAssign && (
            <div>
              <span style={label}>{t('taskListing.assignTo', 'Assign To')}</span>
              <select
                value={form.assignedTo || ''}
                onChange={(event) => setForm({ ...form, assignedTo: event.target.value })}
                style={field}
              >
                <option value="">{t('taskListing.selectEmployee', 'Select Employee')}</option>
                {assignable.map((employee) => (
                  <option key={employee.id} value={String(employee.id)}>
                    {employeeLabel(employee)}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <span style={label}>{t('taskListing.taskTitle', 'Task Title')}</span>
            <input
              type="text"
              value={form.title}
              onChange={(event) => setForm({ ...form, title: event.target.value })}
              style={field}
            />
          </div>

          <div>
            <span style={label}>{t('taskListing.description', 'Description')}</span>
            <textarea
              rows={3}
              value={form.description || ''}
              onChange={(event) => setForm({ ...form, description: event.target.value })}
              style={{ ...field, resize: 'vertical' }}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3" style={{ gap: 14 }}>
            <div>
              <span style={label}>{t('taskListing.dueDate', 'Due Date')}</span>
              <DatePicker
                flat
                value={form.dueDate || ''}
                onChange={(event) => setForm({ ...form, dueDate: event.target.value })}
                aria-label={t('taskListing.dueDate', 'Due Date')}
              />
            </div>
            <div>
              <span style={label}>{t('taskListing.priority', 'Priority')}</span>
              <select
                value={form.priority}
                onChange={(event) => setForm({ ...form, priority: event.target.value })}
                style={field}
              >
                <option value="low">{t('taskListing.priorityLow', 'Low')}</option>
                <option value="medium">{t('taskListing.priorityMedium', 'Medium')}</option>
                <option value="high">{t('taskListing.priorityHigh', 'High')}</option>
              </select>
            </div>
            <div>
              <span style={label}>{t('taskListing.status', 'Status')}</span>
              <select
                value={form.status}
                onChange={(event) => setForm({ ...form, status: event.target.value })}
                style={field}
              >
                <option value="pending">{t('taskListing.statusPending', 'Pending')}</option>
                <option value="in-progress">{t('taskListing.statusInProgress', 'In Progress')}</option>
                <option value="completed">{t('taskListing.statusCompleted', 'Completed')}</option>
              </select>
            </div>
          </div>

          <div>
            <span style={label}>{t('taskListing.selfAssessment', 'Self Assessment')}</span>
            <textarea
              rows={2}
              value={form.selfAssessment || ''}
              onChange={(event) => setForm({ ...form, selfAssessment: event.target.value })}
              placeholder={t('taskListing.selfAssessmentPlaceholder', 'How did you perform on this task?')}
              style={{ ...field, resize: 'vertical' }}
            />
          </div>

          <div>
            <span style={label}>{`${t('taskListing.qualityRating', 'Quality Rating')} (0–5)`}</span>
            <input
              type="number"
              min="0"
              max="5"
              value={form.qualityRating ?? 0}
              onChange={(event) => setForm({ ...form, qualityRating: Number(event.target.value) || 0 })}
              style={field}
            />
          </div>

          <div className="flex items-center justify-between" style={{ gap: 10, paddingTop: 4 }}>
            {mode === 'edit' && onDelete ? (
              <button
                type="button"
                onClick={onDelete}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 7,
                  background: 'none', border: 'none', padding: 0, cursor: 'pointer',
                  fontFamily: DISPLAY, fontWeight: 600, fontSize: 11.5, letterSpacing: '.1em',
                  textTransform: 'uppercase', color: ind.inkMuted,
                }}
              >
                <Trash2 size={13} strokeWidth={1.5} />
                {t('common.delete', 'Delete')}
              </button>
            ) : <span />}
            <div style={{ display: 'flex', gap: 7 }}>
              <Btn ind={ind} onClick={onClose}>{t('common.cancel', 'Cancel')}</Btn>
              <Btn ind={ind} variant="primary" onClick={onSave}>
                {mode === 'edit' ? t('common.update', 'Update') : t('common.add', 'Add')}
              </Btn>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Screen
 * ------------------------------------------------------------------ */

const TaskListing = ({ employees, allEmployees }) => {
  const { user, checkPermission } = useAuth();
  const { handleSessionAuthError } = useSessionGuard();
  const { isDarkMode } = useTheme();
  const { t, currentLanguage } = useLanguage();

  const ind = useMemo(() => getIndustry(isDarkMode), [isDarkMode]);
  const today = useMemo(() => startOfDay(new Date()), []);

  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState('');
  const [notice, setNotice] = useState(null);

  const [segment, setSegment] = useState('open');
  /* Until the viewer picks a segment themselves, the screen is allowed to open
     on whichever one actually has rows — a ledger whose tasks are all closed
     must not open on a view that hides every one of them. */
  const [segmentTouched, setSegmentTouched] = useState(false);
  const [query, setQuery] = useState('');
  const [groupMode, setGroupMode] = useState('record');
  const [showAll, setShowAll] = useState(false);

  const [openTaskId, setOpenTaskId] = useState(null);
  const [focusTaskId, setFocusTaskId] = useState(null);
  const [note, setNote] = useState('');

  const [modal, setModal] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);

  const canViewAll = checkPermission('canViewReports');
  const canAssign = user?.role === 'admin' || user?.role === 'manager';

  const directory = useMemo(
    () => (allEmployees?.length ? allEmployees : employees) || [],
    [allEmployees, employees],
  );
  const employeeById = useMemo(
    () => new Map(directory.map((employee) => [String(employee.id), employee])),
    [directory],
  );

  /**
   * `workload_tasks.employee_id` points at the employees table, but an hr_users
   * profile is not always linked to one: `hr_users.employee_id` can be null and
   * so can `employees.user_id`. Try every link the schema offers before falling
   * back to the auth id, and remember whether any of them worked — a viewer
   * scoped to their own record with no record to scope to must be told that,
   * not shown an empty table that reads like a broken query.
   */
  const viewerRecord = useMemo(() => {
    const profileLink = String(user?.employeeId || '');
    if (profileLink) return { id: profileLink, linked: true };

    const authId = String(user?.id || '');
    const byUserId = authId
      ? directory.find((employee) => employee.user_id && String(employee.user_id) === authId)
      : null;
    if (byUserId) return { id: String(byUserId.id), linked: true };

    const email = String(user?.email || '').toLowerCase();
    const byEmail = email
      ? directory.find((employee) => String(employee.email || '').toLowerCase() === email)
      : null;
    if (byEmail) return { id: String(byEmail.id), linked: true };

    return { id: authId, linked: false };
  }, [user?.employeeId, user?.id, user?.email, directory]);

  const myEmployeeId = viewerRecord.id;
  /* Only worth reporting once the directory has actually arrived. */
  const unlinkedViewer = !canViewAll && !viewerRecord.linked && directory.length > 0;

  const assignable = useMemo(() => {
    const operational = filterActiveEmployees(employees || []);
    return canViewAll ? operational : operational.filter((e) => String(e.id) === myEmployeeId);
  }, [employees, canViewAll, myEmployeeId]);

  const employeeLabel = useCallback((employee) => {
    const department = t(
      `employeeDepartment.${String(employee.department || '').toLowerCase().replace(/\s+/g, '_')}`,
      employee.department,
    );
    const position = t(`employeePosition.${getEmployeePositionI18nKey(employee.position)}`, employee.position);
    return `${getDemoEmployeeName(employee, t)} — ${department} (${position})`;
  }, [t]);

  const nameOf = useCallback((id) => {
    const employee = employeeById.get(String(id));
    return employee ? getDemoEmployeeName(employee, t) : '';
  }, [employeeById, t]);

  const shortDate = useCallback(
    (value) => formatDate(value, currentLanguage, { day: '2-digit', month: 'short' }),
    [currentLanguage],
  );

  const clockTime = useCallback((value) => {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  }, []);

  /* ---------------- fetch ---------------- */

  const fetchTasks = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    try {
      if (!isDemoMode()) {
        const validation = await validateAndRefreshSession();
        if (!validation.success) throw new Error(validation.error);
      }

      const result = canViewAll
        ? await workloadService.getAllTasks()
        : await workloadService.getEmployeeTasks(myEmployeeId);

      if (result.success) {
        setTasks(result.data || []);
        setFetchError('');
      } else {
        console.error('Failed to load tasks:', result.error);
        setFetchError(t('taskListing.loadFailed', 'Failed to load tasks'));
      }
    } catch (error) {
      console.error('Error fetching tasks:', error);
      if (handleSessionAuthError(error, { silent })) return;
      if (!silent) setFetchError(t('taskListing.loadFailed', 'Failed to load tasks'));
    } finally {
      if (!silent) setLoading(false);
    }
  }, [canViewAll, myEmployeeId, handleSessionAuthError, t]);

  useAuthenticatedPageRefresh(() => fetchTasks({ silent: true }));

  useEffect(() => {
    /* A viewer with no employee record and no reporting permission has nothing
       to fetch — stop the spinner rather than leaving it turning. */
    if (!canViewAll && !myEmployeeId) {
      setLoading(false);
      return;
    }
    fetchTasks();
  }, [fetchTasks, canViewAll, myEmployeeId]);

  useEffect(() => {
    const channel = workloadService.subscribeToTaskChanges(
      canViewAll ? null : myEmployeeId,
      (payload) => { if (isRealtimeMutation(payload)) fetchTasks({ silent: true }); },
    );
    return () => { channel.unsubscribe(); };
  }, [canViewAll, myEmployeeId, fetchTasks]);

  const flash = useCallback((kind, text) => {
    setNotice({ kind, text });
    setTimeout(() => setNotice(null), 4000);
  }, []);

  /* ---------------- mutations ---------------- */

  const canEditTask = useCallback(
    (task) => canAssign || String(task.employee_id) === myEmployeeId,
    [canAssign, myEmployeeId],
  );

  const saveUpdate = useCallback(async (taskId, updates, okText) => {
    const result = await workloadService.updateTask(taskId, updates);
    if (result.success) {
      flash('ok', okText);
      fetchTasks({ silent: true });
      return true;
    }
    console.error('Failed to update task:', result.error);
    flash('err', t('taskListing.taskUpdateError', 'Failed to update task'));
    return false;
  }, [flash, fetchTasks, t]);

  const toggleDone = useCallback(async (task) => {
    if (!canEditTask(task)) {
      flash('err', t('taskListing.notYours', 'This task belongs to someone else'));
      return;
    }
    const done = isClosed(task);
    await saveUpdate(
      task.id,
      { status: done ? 'pending' : 'completed' },
      done
        ? t('taskListing.reopened', 'Task reopened')
        : t('taskListing.markedComplete', 'Task marked complete'),
    );
  }, [canEditTask, saveUpdate, flash, t]);

  const openAdd = useCallback(() => {
    setForm({ ...EMPTY_FORM, assignedTo: canAssign ? '' : myEmployeeId });
    setModal({ mode: 'add', task: null });
  }, [canAssign, myEmployeeId]);

  const openEdit = useCallback((task) => {
    setForm({
      title: isDemoMode() ? getDemoTaskTitle(task, t) : (task.title || ''),
      description: isDemoMode() ? getDemoTaskDescription(task, t) : (task.description || ''),
      dueDate: task.due_date || '',
      priority: task.priority || 'medium',
      status: norm(task.status) || 'pending',
      selfAssessment: task.self_assessment || '',
      qualityRating: task.quality_rating || 0,
      assignedTo: String(task.employee_id || ''),
    });
    setModal({ mode: 'edit', task });
  }, [t]);

  const submitForm = useCallback(async () => {
    if (!form.title.trim()) {
      flash('err', t('taskListing.titleRequired', 'Task title is required'));
      return;
    }
    const employeeId = form.assignedTo || myEmployeeId;
    if (!employeeId) {
      flash('err', t('taskListing.selectEmployee', 'Please select an employee'));
      return;
    }

    if (modal?.mode === 'edit') {
      const updates = {
        title: form.title,
        description: form.description,
        dueDate: form.dueDate || null,
        priority: form.priority,
        status: form.status,
        selfAssessment: form.selfAssessment,
        qualityRating: form.qualityRating,
      };
      if (canAssign && String(employeeId) !== String(modal.task.employee_id)) {
        updates.assignedTo = employeeId;
      }
      const ok = await saveUpdate(modal.task.id, updates, t('taskListing.taskUpdated', 'Task updated'));
      if (ok) setModal(null);
      return;
    }

    const result = await workloadService.createTask({
      employeeId,
      title: form.title,
      description: form.description || null,
      dueDate: form.dueDate || null,
      priority: form.priority,
      status: form.status,
      selfAssessment: form.selfAssessment || null,
      qualityRating: form.qualityRating || 0,
      createdBy: user?.employeeId || user?.id || null,
    });
    if (result.success) {
      flash('ok', t('taskListing.taskCreated', 'Task created'));
      setModal(null);
      fetchTasks({ silent: true });
    } else {
      console.error('Failed to create task:', result.error);
      flash('err', t('taskListing.taskCreateError', 'Failed to create task'));
    }
  }, [form, modal, myEmployeeId, canAssign, saveUpdate, flash, fetchTasks, t, user]);

  const removeTask = useCallback(async (task) => {
    if (!globalThis.confirm(t('taskListing.confirmDelete', 'Delete this task?'))) return;
    const result = await workloadService.deleteTask(task.id);
    if (result.success) {
      flash('ok', t('taskListing.taskDeleted', 'Task deleted'));
      setModal(null);
      if (String(openTaskId) === String(task.id)) setOpenTaskId(null);
      fetchTasks({ silent: true });
    } else {
      console.error('Failed to delete task:', result.error);
      flash('err', t('taskListing.taskDeleteError', 'Failed to delete task'));
    }
  }, [flash, fetchTasks, openTaskId, t]);

  /* ---------------- derivation ---------------- */

  /**
   * One pass over the rows the viewer may see. Everything the two screens read
   * — state, urgency, source, the consequence line — is computed here so the
   * ledger and the detail sheet can never disagree about a task.
   */
  const rows = useMemo(() => (tasks || []).map((task) => {
    const closed = isClosed(task);
    const cancelled = isCancelled(task);
    const open = !closed && !cancelled;

    const due = task.due_date ? startOfDay(new Date(task.due_date)) : null;
    const dueDays = due ? daysBetween(today, due) : null;
    const late = open && dueDays != null && dueDays < 0 ? -dueDays : 0;

    let state = 'open';
    if (closed) state = 'done';
    else if (cancelled) state = 'cancelled';
    else if (late > 0) state = 'overdue';
    else if (!due) state = 'unscheduled';
    else if (norm(task.status) === 'in-progress') state = 'progress';

    const stateLabel = {
      done: t('taskListing.stateDone', 'Done'),
      cancelled: t('taskListing.stateCancelled', 'Cancelled'),
      open: t('taskListing.stateOpen', 'Open'),
      progress: t('taskListing.stateInProgress', 'In progress'),
      unscheduled: t('taskListing.stateUnscheduled', 'No due date'),
      overdue: t('taskListing.stateOverdue', 'Overdue'),
    }[state];

    const ownerId = String(task.employee_id ?? '');
    const owner = employeeById.get(ownerId) || task.employee || null;
    const ownerName = owner ? getDemoEmployeeName(owner, t) : t('taskListing.unknownOwner', 'Unknown record');
    const ownerDept = owner?.department
      ? t(`employeeDepartment.${String(owner.department).toLowerCase().replace(/\s+/g, '_')}`, owner.department)
      : '';

    const creatorId = task.created_by ? String(task.created_by) : '';
    const creatorName = creatorId ? nameOf(creatorId) : '';
    const selfSet = !creatorId || creatorId === ownerId;
    const source = selfSet ? 'self' : (creatorName ? 'assigned' : 'system');
    const sourceLabel = {
      self: t('taskListing.sourceSelf', 'Self-set'),
      assigned: t('taskListing.sourceAssigned', 'Assigned'),
      system: t('taskListing.sourceSystem', 'System'),
    }[source];

    const closedAt = closed ? closeStampOf(task) : null;
    const onTime = closed && due && closedAt ? startOfDay(new Date(closedAt)) <= due : null;

    const openedBy = creatorName && !selfSet
      ? t('taskListing.byWho', 'by {who}').replace('{who}', creatorName)
      : t('taskListing.bySelf', 'by the owner');
    const openedOn = task.created_at
      ? t('taskListing.openedOn', 'opened {date} {by}')
        .replace('{date}', shortDate(task.created_at))
        .replace('{by}', openedBy)
      : t('taskListing.openedUnknown', 'opening date not recorded');

    /* The second line carries consequence or evidence with a real number.
       Restating the title here would be a defect. */
    let consequence;
    if (closed) {
      const when = closedAt ? shortDate(closedAt) : shortDate(task.created_at);
      const rated = task.quality_rating > 0
        ? t('taskListing.ratedN', 'rated {n}/5').replace('{n}', String(task.quality_rating))
        : t('taskListing.notRated', 'not rated — the record keeps no quality figure for it');
      const punctuality = onTime === null
        ? ''
        : ` · ${onTime
          ? t('taskListing.onTime', 'on time')
          : t('taskListing.lateClose', 'closed after the due date')}`;
      consequence = `${t('taskListing.closedOn', 'Closed {date}').replace('{date}', when)}${punctuality} · ${rated}`;
    } else if (cancelled) {
      consequence = `${t('taskListing.cancelledLine', 'Cancelled')} · ${openedOn}`;
    } else if (late > 0) {
      consequence = `${
        late === 1
          ? t('taskListing.oneDayLate', '1 day past due')
          : t('taskListing.nDaysLate', '{n} days past due').replace('{n}', String(late))
      } · ${openedOn}`;
    } else if (!due) {
      consequence = `${t(
        'taskListing.noDueLine',
        'No due date — it cannot be chased and it never reaches this ledger’s overdue count',
      )} · ${openedOn}`;
    } else if (dueDays === 0) {
      consequence = `${t('taskListing.dueTodayLine', 'Due today')} · ${openedOn}`;
    } else {
      consequence = `${t('taskListing.dueInDays', 'Due in {n} days').replace('{n}', String(dueDays))} · ${openedOn}`;
    }
    if (open && task.self_assessment) {
      consequence += ` · ${t('taskListing.assessmentLogged', 'self-assessment logged')}`;
    }

    /* Due cell: lateness is written in days, never as a red date. */
    let dueLabel;
    if (!due) dueLabel = t('taskListing.noDue', 'No date');
    else if (closed || cancelled) dueLabel = shortDate(task.due_date);
    else if (late === 1) dueLabel = t('taskListing.oneDayLateShort', '1 day late');
    else if (late > 1) dueLabel = t('taskListing.nDaysLateShort', '{n} days late').replace('{n}', String(late));
    else if (dueDays === 0) dueLabel = t('taskListing.today', 'Today');
    else if (dueDays <= NEAR_DAYS) dueLabel = t('taskListing.inNDays', 'In {n} d').replace('{n}', String(dueDays));
    else dueLabel = shortDate(task.due_date);

    let dueTone = ind.ink;
    if (closed || cancelled || !due) dueTone = ind.inkFaint;
    else if (late > 0) dueTone = ind.accentDeep;
    else if (dueDays === 0) dueTone = ind.accent;

    return {
      task,
      id: task.id,
      handle: handleOf(task.id),
      title: isDemoMode() ? getDemoTaskTitle(task, t) : (task.title || ''),
      description: isDemoMode() ? getDemoTaskDescription(task, t) : (task.description || ''),
      open, closed, cancelled, state, stateLabel,
      due, dueDays, late, dueLabel, dueTone,
      ownerId, ownerName, ownerDept,
      creatorName, selfSet, source, sourceLabel, openedOn,
      closedAt, onTime,
      priority: norm(task.priority) || 'medium',
      rating: Number(task.quality_rating) || 0,
      consequence,
      mine: ownerId === myEmployeeId,
    };
  }), [tasks, employeeById, nameOf, myEmployeeId, today, ind, shortDate, t]);

  const byId = useMemo(() => new Map(rows.map((row) => [String(row.id), row])), [rows]);

  /* Ticker figures read the whole scope, not the segment: the strip describes
     the board, the segments only decide what is listed under it. */
  const totals = useMemo(() => {
    const open = rows.filter((row) => row.open);
    const closedRows = rows.filter((row) => row.closed);
    const measurable = closedRows.filter((row) => row.onTime !== null);
    return {
      open: open.length,
      dueToday: open.filter((row) => row.dueDays === 0).length,
      overdue: open.filter((row) => row.late > 0).length,
      unscheduled: open.filter((row) => !row.due).length,
      /* Closed here means "not open", so a cancelled task is still accounted
         for rather than vanishing between the two segments. */
      closed: rows.filter((row) => !row.open).length,
      /* Every task on the viewer's own record, in any state — this is the
         figure the Mine segment and the subtitle both quote. */
      mine: rows.filter((row) => row.mine).length,
      total: rows.length,
      onTimePct: measurable.length
        ? Math.round((measurable.filter((row) => row.onTime).length / measurable.length) * 100)
        : null,
      records: new Set(rows.map((row) => row.ownerId)).size,
    };
  }, [rows]);

  /* ---------------- ledger shaping ---------------- */

  const segments = useMemo(() => {
    const list = [
      { value: 'open', label: t('taskListing.segAllOpen', 'All open') },
    ];
    if (canViewAll) {
      list.push({
        value: 'mine',
        label: `${t('taskListing.segMine', 'Mine')} · ${totals.mine}`,
      });
    }
    list.push({
      value: 'overdue',
      label: `${t('taskListing.segOverdue', 'Overdue')} · ${totals.overdue}`,
    });
    /* The closed count carries its own label too: without it a scope whose
       tasks are all finished reads as an empty screen. */
    list.push({
      value: 'closed',
      label: `${t('taskListing.segClosed', 'Closed')} · ${totals.closed}`,
    });
    return list;
  }, [canViewAll, totals.mine, totals.overdue, totals.closed, t]);

  useEffect(() => {
    if (segmentTouched || loading || totals.total === 0) return;
    if (totals.open === 0 && totals.closed > 0) setSegment('closed');
  }, [segmentTouched, loading, totals.open, totals.closed, totals.total]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return rows.filter((row) => {
      if (segment === 'open' && !row.open) return false;
      /* Mine is a scope, not a state: it shows the viewer's whole record so the
         count in the label and the count in the subtitle are the same number. */
      if (segment === 'mine' && !row.mine) return false;
      if (segment === 'overdue' && !(row.open && row.late > 0)) return false;
      if (segment === 'closed' && row.open) return false;
      if (!needle) return true;
      return `${row.title} ${row.description} ${row.ownerName} ${row.creatorName} ${row.handle}`
        .toLowerCase()
        .includes(needle);
    });
  }, [rows, segment, query]);

  /** Rows inside a band: what is on fire first, what is closed last. */
  const rowRank = useCallback((row) => {
    if (row.late > 0) return [0, -row.late];
    if (row.open && row.dueDays === 0) return [1, 0];
    if (row.open && row.due) return [2, row.dueDays];
    if (row.open) return [3, 0];
    return [4, 0];
  }, []);

  const sortRows = useCallback((list) => [...list].sort((a, b) => {
    const [ra, sa] = rowRank(a);
    const [rb, sb] = rowRank(b);
    return ra - rb || sa - sb || a.title.localeCompare(b.title);
  }), [rowRank]);

  const groupModeLabel = {
    record: t('taskListing.groupRecord', 'Grouped by record'),
    due: t('taskListing.groupDue', 'Grouped by due window'),
    priority: t('taskListing.groupPriority', 'Grouped by priority'),
  }[groupMode];

  /**
   * Bands. The fraction on a band counts every task on that record — closed
   * ones included — so it stays the record's true state while the rows under
   * it obey the segment filter. The footer says how many were left out.
   */
  const groups = useMemo(() => {
    /* Bucketed on the date alone, not on the state, so a closed task lands in
       the window it was due in and the band fraction stays truthful. */
    const dueBucket = (row) => {
      if (!row.due) return 'none';
      if (row.dueDays < 0) return 'late';
      if (row.dueDays === 0) return 'today';
      if (row.dueDays <= 7) return 'week';
      return 'later';
    };

    const keyOf = (row) => {
      if (groupMode === 'record') return row.ownerId;
      if (groupMode === 'priority') return row.priority;
      return dueBucket(row);
    };

    const buckets = new Map();
    filtered.forEach((row) => {
      const key = keyOf(row);
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key).push(row);
    });

    const totalsFor = (key) => {
      const all = rows.filter((row) => keyOf(row) === key);
      return { done: all.filter((row) => row.closed).length, total: all.length };
    };

    const dueMeta = {
      late: {
        name: t('taskListing.bandOverdue', 'Past due'),
        note: t('taskListing.bandOverdueNote', 'the due date has already gone by'),
      },
      today: {
        name: t('taskListing.bandToday', 'Due today'),
        note: t('taskListing.bandTodayNote', 'closes today or joins the overdue count tomorrow'),
      },
      week: {
        name: t('taskListing.bandWeek', 'Next seven days'),
        note: t('taskListing.bandWeekNote', 'inside the week — still schedulable'),
      },
      later: {
        name: t('taskListing.bandLater', 'Later'),
        note: t('taskListing.bandLaterNote', 'beyond the week'),
      },
      none: {
        name: t('taskListing.bandNoDate', 'No due date'),
        note: t('taskListing.bandNoDateNote', 'nothing can chase these until a date is set'),
      },
    };
    const dueOrder = ['late', 'today', 'week', 'later', 'none'];
    const priorityMeta = {
      high: {
        name: t('taskListing.priorityHigh', 'High'),
        note: t('taskListing.bandHighNote', 'chased first by the decision column'),
      },
      medium: {
        name: t('taskListing.priorityMedium', 'Medium'),
        note: t('taskListing.bandMediumNote', 'normal queue'),
      },
      low: {
        name: t('taskListing.priorityLow', 'Low'),
        note: t('taskListing.bandLowNote', 'picked up when there is room'),
      },
    };

    const built = [...buckets.entries()].map(([key, list]) => {
      const counts = totalsFor(key);
      const sample = list[0];
      let name;
      let note;
      if (groupMode === 'record') {
        name = sample.ownerName;
        note = [
          sample.ownerDept,
          t('taskListing.emittedBy', 'every task below was opened on this employee record'),
        ].filter(Boolean).join(' · ');
      } else if (groupMode === 'priority') {
        const meta = priorityMeta[key] || priorityMeta.medium;
        name = meta.name;
        note = meta.note;
      } else {
        const meta = dueMeta[key] || dueMeta.later;
        name = meta.name;
        note = meta.note;
      }
      return {
        key,
        name,
        note,
        rows: sortRows(list),
        done: counts.done,
        total: counts.total,
        overdue: list.filter((row) => row.late > 0).length,
        ownerId: groupMode === 'record' ? key : null,
      };
    });

    if (groupMode === 'due') {
      built.sort((a, b) => dueOrder.indexOf(a.key) - dueOrder.indexOf(b.key));
    } else if (groupMode === 'priority') {
      const order = ['high', 'medium', 'low'];
      built.sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key));
    } else {
      built.sort((a, b) => b.overdue - a.overdue || b.rows.length - a.rows.length || a.name.localeCompare(b.name));
    }
    return built;
  }, [filtered, rows, groupMode, sortRows, t]);

  const visibleGroups = showAll ? groups : groups.slice(0, MAX_GROUPS);
  const shownRows = visibleGroups.reduce(
    (sum, group) => sum + (showAll ? group.rows.length : Math.min(group.rows.length, MAX_ROWS_PER_GROUP)),
    0,
  );

  /* ---------------- the decision column ---------------- */

  /** Most overdue first, then today, then the unscheduled, then priority. */
  const decisions = useMemo(() => {
    const score = (row) => {
      if (row.late > 0) return 1000 + row.late;
      if (row.dueDays === 0) return 900;
      if (!row.due) return 700 + (row.priority === 'high' ? 50 : 0);
      if (row.priority === 'high') return 600 - Math.min(row.dueDays, 60);
      return 400 - Math.min(row.dueDays, 60);
    };
    return rows.filter((row) => row.open).sort((a, b) => score(b) - score(a));
  }, [rows]);

  useEffect(() => {
    if (focusTaskId && byId.has(String(focusTaskId))) return;
    setFocusTaskId(decisions[0]?.id ?? null);
  }, [decisions, focusTaskId, byId]);

  const myRows = useMemo(() => rows.filter((row) => row.mine), [rows]);
  const yourDay = useMemo(() => {
    const open = myRows.filter((row) => row.open).sort((a, b) => {
      const [ra, sa] = rowRank(a);
      const [rb, sb] = rowRank(b);
      return ra - rb || sa - sb;
    });
    const lastClosed = myRows
      .filter((row) => row.closed && row.closedAt)
      .sort((a, b) => new Date(b.closedAt) - new Date(a.closedAt))[0];
    const list = open.slice(0, lastClosed ? YOUR_DAY_ROWS - 1 : YOUR_DAY_ROWS);
    return { open, list, lastClosed, dueToday: open.filter((row) => row.dueDays === 0).length };
  }, [myRows, rowRank]);

  /* ---------------- export ---------------- */

  const exportCsv = useCallback(() => {
    const header = [
      t('taskListing.taskTitle', 'Task Title'),
      t('taskListing.status', 'Status'),
      t('taskListing.dueDate', 'Due Date'),
      t('taskListing.assignedTo', 'Assigned To'),
      t('taskListing.assignedBy', 'Assigned By'),
      t('taskListing.priority', 'Priority'),
      t('taskListing.qualityRating', 'Quality Rating'),
    ];
    const body = filtered.map((row) => [
      row.title, row.stateLabel, row.task.due_date || '', row.ownerName,
      row.selfSet ? row.ownerName : row.creatorName, row.priority,
      row.rating || '',
    ]);
    const csv = [header, ...body]
      .map((line) => line.map(escapeCsvCell).join(','))
      .join('\n');

    /* Leading BOM so Excel reads the Vietnamese diacritics as UTF-8. */
    const blob = new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `tasks-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    flash('ok', t('taskListing.exported', '{n} rows exported').replace('{n}', String(body.length)));
  }, [filtered, flash, t]);

  /* ---------------- the opened task (4b) ---------------- */

  const opened = openTaskId ? byId.get(String(openTaskId)) : null;

  useEffect(() => { setNote(''); }, [openTaskId]);

  const detail = useMemo(() => {
    if (!opened) return null;
    const { task } = opened;

    const started = norm(task.status) === 'in-progress' || opened.closed;
    const assessed = Boolean(task.self_assessment) || opened.rating > 0;

    /* `01` — the lifecycle in dependency order. Each step after the stalled one
       says that it follows it, so sequence never has to be inferred. */
    const steps = [
      {
        key: 'opened',
        title: t('taskListing.stepOpened', 'Task opened on the record'),
        /* The provenance, not the date — the date is already in the subtitle
           and in the activity trail. */
        detail: t('taskListing.stepOpenedDetail', 'Emitted by the {who} record · {src}')
          .replace('{who}', opened.ownerName)
          .replace('{src}', opened.selfSet
            ? t('taskListing.srcSelfSet', 'set by the owner')
            : t('taskListing.srcAssignedBy', 'assigned by {creator}')
              .replace('{creator}', opened.creatorName || t('taskListing.sourceSystem', 'System'))),
        brief: opened.description,
        done: true,
      },
      {
        key: 'scheduled',
        title: t('taskListing.stepScheduled', 'Due date set'),
        detail: opened.due
          ? t('taskListing.stepScheduledDone', 'Due {date} · everything below is measured against it')
            .replace('{date}', shortDate(task.due_date))
          : t('taskListing.stepScheduledOpen', 'Without a date this task cannot be chased, counted as overdue, or reported on'),
        done: Boolean(opened.due),
      },
      {
        key: 'started',
        title: t('taskListing.stepStarted', 'Work started'),
        detail: started
          ? t('taskListing.stepStartedDone', 'The owner moved it off Pending')
          : t('taskListing.stepStartedOpen', 'Follows the due date · the owner moves it to In progress'),
        done: started,
      },
      {
        key: 'closed',
        title: t('taskListing.stepClosed', 'Marked complete'),
        detail: opened.closed
          ? t('taskListing.stepClosedDone', 'Closed {date}').replace('{date}', shortDate(opened.closedAt || task.created_at))
          : t('taskListing.stepClosedOpen', 'Follows the work · closing it is what clears the record'),
        done: opened.closed,
      },
      {
        key: 'assessed',
        title: t('taskListing.stepAssessed', 'Assessed and rated'),
        detail: assessed
          ? t('taskListing.stepAssessedDone', 'Rated {n}/5 · feeds the quality average on this record')
            .replace('{n}', String(opened.rating || 0))
          : t('taskListing.stepAssessedOpen', 'Follows completion · until it exists the record carries no quality figure for this task'),
        done: assessed,
      },
    ];

    const doneCount = steps.filter((step) => step.done).length;
    const stalledIndex = steps.findIndex((step) => !step.done);

    /* Siblings — the analogue of "what this blocks": everything else still open
       on the same record. */
    const siblings = rows.filter((row) => row.ownerId === opened.ownerId && row.open && String(row.id) !== String(opened.id));
    const siblingsLate = siblings.filter((row) => row.late > 0).length;

    /* `03` — days open against the window the due date allows, so the bar is a
       real percentage rather than a decoration. */
    const openedAt = task.created_at ? new Date(task.created_at) : null;
    const endAt = opened.closed && opened.closedAt ? new Date(opened.closedAt) : new Date();
    const elapsed = openedAt ? Math.max(0, daysBetween(openedAt, endAt)) : null;
    const window = openedAt && opened.due ? Math.max(1, daysBetween(openedAt, opened.due)) : null;
    const withinWindow = window != null && elapsed != null ? Math.min(elapsed, window) : null;
    const overrun = window != null && elapsed != null ? Math.max(0, elapsed - window) : null;

    return {
      steps, doneCount, stalledIndex, siblings, siblingsLate,
      elapsed, window, withinWindow, overrun,
      pct: window && elapsed != null ? Math.min(100, Math.round((elapsed / window) * 100)) : null,
    };
  }, [opened, rows, shortDate, t]);

  const addNote = useCallback(async () => {
    if (!opened || !note.trim()) return;
    const stamp = shortDate(new Date());
    const existing = opened.task.comments ? `${opened.task.comments}\n` : '';
    const ok = await saveUpdate(
      opened.id,
      { comments: `${existing}${stamp} — ${note.trim()}` },
      t('taskListing.noteAdded', 'Note added'),
    );
    if (ok) setNote('');
  }, [opened, note, shortDate, saveUpdate, t]);

  /* ---------------- shared chrome ---------------- */

  const caption = { fontFamily: BODY, fontSize: 13, color: ind.inkMuted, lineHeight: 1.5, margin: 0 };
  const smallNote = { fontFamily: BODY, fontSize: 11.5, color: ind.inkMuted, lineHeight: 1.45, margin: '6px 0 0' };
  const headCell = {
    fontFamily: DISPLAY, fontWeight: 600, fontSize: 10, letterSpacing: '.16em',
    textTransform: 'uppercase', color: ind.inkMuted,
  };

  const priorityConsequence = (priority) => ({
    high: t('taskListing.priorityHighNote', 'Chased first'),
    medium: t('taskListing.priorityMediumNote', 'Normal queue'),
    low: t('taskListing.priorityLowNote', 'When there is room'),
  }[priority] || t('taskListing.priorityMediumNote', 'Normal queue'));

  const renderTicker = (cells) => (
    <div
      style={{
        height: 44, background: ind.tickerBg, color: ind.tickerInk,
        borderBottom: `1px solid ${ind.hairline}`,
        display: 'flex', alignItems: 'stretch', overflowX: 'auto', overflowY: 'hidden',
      }}
    >
      <TickerCell ind={ind}>
        <LiveClock ind={ind} live={!loading} />
      </TickerCell>
      {cells}
      <div
        style={{
          flex: 1, minWidth: 'max-content', display: 'flex', alignItems: 'center',
          justifyContent: 'flex-end', gap: 8, padding: '0 14px',
          borderLeft: `1px solid ${ind.tickerRule}`,
        }}
      >
        <FetchElapsedPill active={loading} isDarkMode label={t('common.fetching', 'Fetching')} />
        <FlatSelect
          ind={ind}
          onDark
          value={groupMode}
          onChange={(event) => { setGroupMode(event.target.value); setShowAll(false); }}
          aria-label={t('taskListing.grouping', 'Grouping')}
        >
          <option value="record" style={{ color: '#1d1f20' }}>{t('taskListing.byRecord', 'By record')}</option>
          <option value="due" style={{ color: '#1d1f20' }}>{t('taskListing.byDue', 'By due window')}</option>
          <option value="priority" style={{ color: '#1d1f20' }}>{t('taskListing.byPriority', 'By priority')}</option>
        </FlatSelect>
      </div>
    </div>
  );

  const banner = (
    <>
      {fetchError && (
        <div style={{ border: `1px solid ${ind.ink}`, padding: '12px 14px', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <AlertCircle size={16} strokeWidth={1.5} style={{ flex: 'none', marginTop: 2, color: ind.ink }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <span style={headCell}>{t('common.error', 'Error')}</span>
            <p style={{ fontFamily: BODY, fontSize: 13, color: ind.inkMuted, marginTop: 4 }}>{fetchError}</p>
            <div style={{ marginTop: 8 }}>
              <InlineLink ind={ind} onClick={() => fetchTasks()}>{t('common.retry', 'Try Again')}</InlineLink>
            </div>
          </div>
        </div>
      )}
      {notice && (
        <div
          className="flex items-center justify-between"
          style={{ gap: 12, border: `1px solid ${notice.kind === 'ok' ? ind.hairline : ind.ink}`, padding: '9px 14px' }}
        >
          <span style={{ fontFamily: BODY, fontSize: 12.5, color: ind.ink }}>{notice.text}</span>
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
    </>
  );

  const screenStyle = {
    border: `1px solid ${ind.hairline}`,
    background: ind.ground,
    color: ind.ink,
    fontFamily: BODY,
    fontSize: 14,
    borderRadius: 0,
  };

  /* ================================================================== *
   * 4b — Task detail
   * ================================================================== */

  if (opened && detail) {
    const { task } = opened;
    const stalled = detail.stalledIndex;
    const editable = canEditTask(task);

    /* The banner is the only non-blueprint framed block on the screen, and it
       only appears when something is actually stopping the task. */
    const blocker = opened.late > 0
      ? {
        headline: `${t('taskListing.stateOverdue', 'Overdue')} — ${
          opened.late === 1
            ? t('taskListing.oneDayLate', '1 day past due')
            : t('taskListing.nDaysLate', '{n} days past due').replace('{n}', String(opened.late))
        }`,
        body: t(
          'taskListing.blockerOverdue',
          'It was due {date}. Until it closes it stays in the overdue count on this record, alongside {n} other open task(s).',
        ).replace('{date}', shortDate(task.due_date)).replace('{n}', String(detail.siblings.length)),
        primary: t('taskListing.markComplete', 'Mark complete'),
        secondary: t('taskListing.moveDueDate', 'Move due date'),
      }
      : (!opened.due && opened.open
        ? {
          headline: t('taskListing.blockerNoDateHead', 'No due date — it cannot be chased'),
          body: t(
            'taskListing.blockerNoDate',
            'Nothing schedules, escalates or reports on a task without a date. Set one, or close it if it is already done.',
          ),
          primary: t('taskListing.setDueDate', 'Set a due date'),
          secondary: t('taskListing.markComplete', 'Mark complete'),
        }
        : null);

    return (
      <div data-screen-label="Task Detail" style={screenStyle}>
        {renderTicker(
          <>
            <TickerCell ind={ind} label={t('taskListing.task', 'Task')} value={opened.handle} />
            <TickerCell
              ind={ind}
              label={t('taskListing.state', 'State')}
              value={opened.stateLabel.toUpperCase()}
              valueColor={ind.tickerUp}
            />
            <TickerCell
              ind={ind}
              label={t('taskListing.dueDate', 'Due')}
              value={opened.dueLabel.toUpperCase()}
            />
            <TickerCell
              ind={ind}
              label={t('taskListing.priority', 'Priority')}
              value={(opened.priority || 'medium').toUpperCase()}
            />
            <TickerCell
              ind={ind}
              label={t('taskListing.recordOpen', 'Record open')}
              value={detail.siblings.length + (opened.open ? 1 : 0)}
            />
          </>,
        )}

        <div className="flex flex-col lg:flex-row items-stretch">
          {/* ── LEFT — the spec sheet ─────────────────────────────── */}
          <div
            className="flex-1 min-w-0 flex flex-col"
            style={{ padding: '22px 24px 20px', gap: 16, borderRight: `1px solid ${ind.hairline}` }}
          >
            {banner}

            <div className="flex flex-wrap items-end justify-between" style={{ gap: 14 }}>
              <div style={{ minWidth: 0 }}>
                <div
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
                    fontFamily: DISPLAY, fontWeight: 600, fontSize: 11, letterSpacing: '.14em',
                    textTransform: 'uppercase', color: ind.inkMuted, marginBottom: 2,
                  }}
                >
                  <button
                    type="button"
                    onClick={() => setOpenTaskId(null)}
                    style={{
                      background: 'none', border: 'none', padding: 0, cursor: 'pointer',
                      fontFamily: DISPLAY, fontWeight: 600, fontSize: 11, letterSpacing: '.14em',
                      textTransform: 'uppercase', color: ind.accentDeep,
                    }}
                  >
                    {t('taskListing.title', 'Task Listing')}
                  </button>
                  <span>/</span>
                  <span>{opened.ownerName}</span>
                  <span>/</span>
                  <span>{opened.handle}</span>
                </div>
                <h1 style={{ fontFamily: BODY, fontSize: 32, fontWeight: 400, margin: '2px 0 0', color: ind.ink, lineHeight: 1.1 }}>
                  {isDemoMode()
                    ? opened.title
                    : <TranslatedText text={opened.title} record={{ entityType: 'task', entityId: opened.id, field: 'title' }} />}
                </h1>
                <p style={{ ...caption, marginTop: 6 }}>
                  {[
                    opened.openedOn.charAt(0).toUpperCase() + opened.openedOn.slice(1),
                    `${t('taskListing.owner', 'owner')} ${opened.ownerName}${opened.ownerDept ? ` (${opened.ownerDept})` : ''}`,
                    `${t('taskListing.dueLower', 'due')} ${opened.dueLabel.toLowerCase()}`,
                  ].join(' · ')}
                </p>
              </div>

              <div style={{ display: 'flex', gap: 8, flex: 'none' }}>
                <Btn ind={ind} onClick={() => openEdit(task)} disabled={!editable}>
                  {t('common.edit', 'Edit')}
                </Btn>
                <Btn ind={ind} variant="primary" onClick={() => toggleDone(task)} disabled={!editable}>
                  {opened.closed ? t('taskListing.reopen', 'Reopen') : t('taskListing.markComplete', 'Mark complete')}
                </Btn>
              </div>
            </div>

            {blocker && (
              <div
                style={{
                  display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap',
                  border: `1px solid ${ind.hairline}`, background: ind.accentWash, padding: '12px 16px',
                }}
              >
                <AlertCircle size={20} strokeWidth={1.5} style={{ flex: 'none', color: ind.accentDeep }} />
                <div style={{ flex: 1, minWidth: 200 }}>
                  <div
                    style={{
                      fontFamily: DISPLAY, fontWeight: 600, fontSize: 14, letterSpacing: '.06em',
                      textTransform: 'uppercase', color: ind.ink,
                    }}
                  >
                    {blocker.headline}
                  </div>
                  <p style={{ fontFamily: BODY, fontSize: 12.5, color: ind.inkGhost, margin: '4px 0 0', lineHeight: 1.45 }}>
                    {blocker.body}
                  </p>
                </div>
                <div style={{ display: 'flex', gap: 7, flex: 'none' }}>
                  {opened.late > 0 ? (
                    <>
                      <Btn ind={ind} variant="primary" onClick={() => toggleDone(task)} disabled={!editable}>
                        {blocker.primary}
                      </Btn>
                      <Btn ind={ind} onClick={() => openEdit(task)} disabled={!editable}>{blocker.secondary}</Btn>
                    </>
                  ) : (
                    <>
                      <Btn ind={ind} variant="primary" onClick={() => openEdit(task)} disabled={!editable}>
                        {blocker.primary}
                      </Btn>
                      <Btn ind={ind} onClick={() => toggleDone(task)} disabled={!editable}>{blocker.secondary}</Btn>
                    </>
                  )}
                </div>
              </div>
            )}

            {/* Panels: what is stopping this · what it sits beside · what it has cost */}
            <div className="grid grid-cols-1 lg:grid-cols-[1.35fr_1fr]" style={{ gap: 16 }}>
              <Blueprint ind={ind} style={{ padding: '16px 20px 8px' }}>
                <PanelHead
                  ind={ind}
                  num="01"
                  title={t('taskListing.panelSteps', 'Steps')}
                  note={t('taskListing.stepsNote', '{done} of {total} done · {left} to go')
                    .replace('{done}', String(detail.doneCount))
                    .replace('{total}', String(detail.steps.length))
                    .replace('{left}', String(detail.steps.length - detail.doneCount))}
                />
                {detail.steps.map((step, index) => {
                  const isStalled = index === stalled;
                  return (
                    <div
                      key={step.key}
                      style={{
                        display: 'flex', alignItems: 'flex-start', gap: 12,
                        padding: '11px 0', borderTop: `1px solid ${ind.rule}`,
                        ...(isStalled
                          ? {
                            background: isDarkMode ? 'rgba(116,157,196,.10)' : 'rgba(89,128,166,.06)',
                            margin: '0 -20px', paddingLeft: 20, paddingRight: 20,
                          }
                          : {}),
                      }}
                    >
                      <SquareCheck ind={ind} done={step.done} label={step.title} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            fontFamily: BODY, fontSize: 13.5, color: ind.ink,
                            opacity: step.done ? 0.5 : 1,
                            textDecoration: step.done ? 'line-through' : 'none',
                          }}
                        >
                          {step.title}
                        </div>
                        <p
                          style={{
                            fontFamily: BODY, fontSize: 11.5, lineHeight: 1.45, margin: '3px 0 0',
                            color: isStalled && opened.late > 0 ? ind.accentDeep : ind.inkMuted,
                          }}
                        >
                          {step.detail}
                        </p>
                        {step.brief && (
                          <p style={{ fontFamily: BODY, fontSize: 12.5, color: ind.inkGhost, margin: '6px 0 0', lineHeight: 1.5 }}>
                            {isDemoMode()
                              ? step.brief
                              : <TranslatedText text={step.brief} record={{ entityType: 'task', entityId: opened.id, field: 'description' }} />}
                          </p>
                        )}
                      </div>
                      {isStalled && (
                        <span
                          style={{
                            flex: 'none', marginTop: 3,
                            fontFamily: DISPLAY, fontWeight: 600, fontSize: 11, letterSpacing: '.1em',
                            textTransform: 'uppercase', color: ind.accentDeep,
                          }}
                        >
                          {opened.late > 0 ? t('taskListing.stateOverdue', 'Overdue') : t('taskListing.waiting', 'Waiting')}
                        </span>
                      )}
                    </div>
                  );
                })}
              </Blueprint>

              <div className="flex flex-col min-w-0" style={{ gap: 16 }}>
                <Blueprint ind={ind} style={{ padding: '16px 20px 14px' }}>
                  <PanelHead ind={ind} num="02" title={t('taskListing.panelChain', 'Chain')} />
                  <RelationRow
                    ind={ind}
                    relation={t('taskListing.relOpenedBy', 'Opened by')}
                    subject={opened.selfSet ? opened.ownerName : (opened.creatorName || t('taskListing.sourceSystem', 'System'))}
                    detail={task.created_at
                      ? `${shortDate(task.created_at)} · ${clockTime(task.created_at)}`
                      : t('taskListing.openedUnknown', 'opening date not recorded')}
                  />
                  <RelationRow
                    ind={ind}
                    relation={t('taskListing.relBelongsTo', 'Belongs to')}
                    strong
                    subject={`${opened.ownerName}${opened.ownerDept ? ` · ${opened.ownerDept}` : ''}`}
                    detail={t('taskListing.recordHolds', 'This record holds {n} task(s) in total')
                      .replace('{n}', String(rows.filter((row) => row.ownerId === opened.ownerId).length))}
                  />
                  <RelationRow
                    ind={ind}
                    relation={t('taskListing.relSitsWith', 'Sits with')}
                    strong
                    subject={t('taskListing.nOpenTasks', '{n} open task(s) on the same record')
                      .replace('{n}', String(detail.siblings.length))}
                    detail={detail.siblingsLate > 0
                      ? t('taskListing.nOfThemOverdue', '{n} of them already overdue — open the record')
                        .replace('{n}', String(detail.siblingsLate))
                      : t('taskListing.noneOverdue', 'none of them overdue — open the record')}
                    onClick={() => {
                      setOpenTaskId(null);
                      setGroupMode('record');
                      setQuery(opened.ownerName);
                      setSegment('open');
                      setSegmentTouched(true);
                    }}
                  />
                </Blueprint>

                <Blueprint ind={ind} style={{ padding: '16px 20px 14px', flex: 1, minHeight: 0 }}>
                  <PanelHead ind={ind} num="03" title={t('taskListing.panelElapsed', 'Elapsed')} />
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, flexWrap: 'wrap' }}>
                    <span style={{ ...figure(40, ind.ink), lineHeight: 0.9 }}>
                      {detail.elapsed == null ? '—' : `${detail.elapsed} d`}
                    </span>
                    <span style={{ fontFamily: BODY, fontSize: 11.5, color: ind.inkMuted, paddingBottom: 4, lineHeight: 1.4 }}>
                      {detail.window
                        ? t('taskListing.againstWindow', 'against the {n} day window the due date allows')
                          .replace('{n}', String(detail.window))
                        : t('taskListing.noWindow', 'no due date — there is no window to measure against')}
                      <br />
                      {opened.closed
                        ? t('taskListing.measuredToClose', 'measured to the close stamp')
                        : t('taskListing.measuredToToday', 'measured to today')}
                    </span>
                  </div>

                  {detail.pct != null && (
                    <div style={{ margin: '12px 0 8px' }}>
                      <Bar ind={ind} value={Math.min(1, (detail.elapsed || 0) / detail.window)} height={8} />
                    </div>
                  )}

                  {detail.window != null ? (
                    <>
                      <div
                        style={{
                          display: 'flex', justifyContent: 'space-between', padding: '8px 0',
                          borderTop: `1px solid ${ind.rule}`, fontSize: 12.5,
                        }}
                      >
                        <span style={{ fontFamily: BODY, color: ind.inkGhost }}>
                          {t('taskListing.withinWindow', 'Inside the window')}
                        </span>
                        <span style={{ fontFamily: DISPLAY, fontWeight: 600, fontSize: 13, color: ind.ink }}>
                          {`${detail.withinWindow} d`}
                        </span>
                      </div>
                      <div
                        style={{
                          display: 'flex', justifyContent: 'space-between', padding: '8px 0',
                          borderTop: `1px solid ${ind.rule}`, fontSize: 12.5,
                        }}
                      >
                        <span style={{ fontFamily: BODY, color: ind.inkGhost }}>
                          {t('taskListing.pastDue', 'Past the due date')}
                        </span>
                        <span
                          style={{
                            fontFamily: DISPLAY, fontWeight: 600, fontSize: 13,
                            color: detail.overrun > 0 ? ind.accentDeep : ind.ink,
                          }}
                        >
                          {`${detail.overrun} d`}
                        </span>
                      </div>
                    </>
                  ) : (
                    <div style={{ padding: '8px 0', borderTop: `1px solid ${ind.rule}` }}>
                      <span style={{ fontFamily: BODY, fontSize: 12.5, color: ind.inkGhost }}>
                        {t('taskListing.openedOnDate', 'Opened {date}').replace('{date}', shortDate(task.created_at))}
                      </span>
                    </div>
                  )}
                </Blueprint>
              </div>
            </div>
          </div>

          {/* ── RIGHT — the record, 340px ─────────────────────────── */}
          <aside className="w-full lg:w-[340px] lg:shrink-0 flex flex-col" style={{ background: ind.chrome }}>
            <div style={{ padding: '20px 20px 12px', borderBottom: `1px solid ${ind.hairline}` }}>
              <ColumnHeading ind={ind}>{t('taskListing.record', 'Record')}</ColumnHeading>
              <p style={smallNote}>{t('taskListing.recordNote', 'Everything this task carries')}</p>
            </div>

            <FieldRow ind={ind} label={t('taskListing.recordField', 'Record')}>
              <InlineLink
                ind={ind}
                size={12.5}
                onClick={() => {
                  setOpenTaskId(null);
                  setGroupMode('record');
                  setQuery(opened.ownerName);
                }}
              >
                {`${opened.ownerName}${opened.ownerDept ? ` · ${opened.ownerDept}` : ''}`}
              </InlineLink>
            </FieldRow>
            <FieldRow ind={ind} label={t('taskListing.assignedBy', 'Assigned By')}>
              {opened.selfSet
                ? t('taskListing.selfSetValue', 'The owner')
                : (opened.creatorName || t('taskListing.sourceSystem', 'System'))}
            </FieldRow>
            <FieldRow ind={ind} label={t('taskListing.priority', 'Priority')}>
              <Tag ind={ind} variant={opened.priority === 'high' ? 'accent' : 'neutral'}>
                {priorityConsequence(opened.priority)}
              </Tag>
            </FieldRow>
            <FieldRow ind={ind} label={t('taskListing.status', 'Status')}>
              <StateWord ind={ind} state={opened.state} label={opened.stateLabel} />
            </FieldRow>
            <FieldRow ind={ind} label={t('taskListing.qualityRating', 'Quality Rating')}>
              {opened.rating > 0
                ? `${opened.rating} / 5`
                : t('taskListing.setOnClose', 'Set when the task closes')}
            </FieldRow>

            <div style={{ padding: '18px 20px 10px', marginTop: 6, borderBottom: `1px solid ${ind.hairline}` }}>
              <ColumnHeading ind={ind}>{t('taskListing.activity', 'Activity')}</ColumnHeading>
            </div>

            {(() => {
              /* Newest first. The oldest entry is always the emission — it is
                 the proof that the task came from a record. */
              const entries = [];
              if (opened.rating > 0) {
                entries.push({
                  key: 'rated',
                  date: shortDate(opened.closedAt || task.updated_at || task.created_at),
                  text: t('taskListing.actRated', 'Quality rated {n}/5').replace('{n}', String(opened.rating)),
                  actor: opened.ownerName,
                  time: clockTime(opened.closedAt || task.updated_at),
                });
              }
              if (opened.closed) {
                entries.push({
                  key: 'closed',
                  date: shortDate(opened.closedAt || task.created_at),
                  text: t('taskListing.actClosed', 'Marked complete'),
                  actor: opened.ownerName,
                  time: clockTime(opened.closedAt),
                });
              } else if (task.updated_at && task.updated_at !== task.created_at) {
                entries.push({
                  key: 'changed',
                  date: shortDate(task.updated_at),
                  text: t('taskListing.actChanged', 'Last changed · now {state}').replace('{state}', opened.stateLabel.toLowerCase()),
                  actor: opened.ownerName,
                  time: clockTime(task.updated_at),
                });
              }
              if (task.self_assessment) {
                entries.push({
                  key: 'assessed',
                  date: shortDate(task.updated_at || task.created_at),
                  text: t('taskListing.actAssessed', 'Self-assessment written'),
                  actor: opened.ownerName,
                  time: clockTime(task.updated_at),
                });
              }
              entries.push({
                key: 'opened',
                date: shortDate(task.created_at),
                text: t('taskListing.actOpened', 'Task opened on the {who} record').replace('{who}', opened.ownerName),
                actor: opened.selfSet ? opened.ownerName : (opened.creatorName || t('taskListing.sourceSystem', 'System')),
                time: clockTime(task.created_at),
              });
              return entries.map((entry) => (
                <div key={entry.key} style={{ display: 'flex', gap: 12, padding: '11px 20px', borderBottom: `1px solid ${ind.rule}` }}>
                  <span
                    style={{
                      width: 52, flex: 'none', fontFamily: DISPLAY, fontWeight: 600, fontSize: 11,
                      letterSpacing: '.1em', textTransform: 'uppercase', color: ind.ink, opacity: 0.45,
                    }}
                  >
                    {entry.date}
                  </span>
                  <span style={{ minWidth: 0 }}>
                    <span className="block" style={{ fontFamily: BODY, fontSize: 12.5, color: ind.ink, lineHeight: 1.4 }}>
                      {entry.text}
                    </span>
                    <span className="block" style={{ fontFamily: BODY, fontSize: 11.5, color: ind.inkMuted, marginTop: 2 }}>
                      {[entry.actor, entry.time].filter(Boolean).join(' · ')}
                    </span>
                  </span>
                </div>
              ));
            })()}

            {task.comments && (
              <div style={{ padding: '12px 20px', borderBottom: `1px solid ${ind.rule}` }}>
                <span style={{ ...headCell, display: 'block', marginBottom: 6 }}>
                  {t('taskListing.notes', 'Notes')}
                </span>
                <p style={{ fontFamily: BODY, fontSize: 12.5, color: ind.inkGhost, whiteSpace: 'pre-wrap', margin: 0, lineHeight: 1.5 }}>
                  {task.comments}
                </p>
              </div>
            )}

            {/* One line, hairline box, no toolbar. */}
            <div style={{ padding: '14px 20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 9, border: `1px solid ${ind.hairline}`, padding: '8px 11px' }}>
                <input
                  type="text"
                  value={note}
                  disabled={!editable}
                  onChange={(event) => setNote(event.target.value)}
                  onKeyDown={(event) => { if (event.key === 'Enter') addNote(); }}
                  placeholder={t('taskListing.addNote', 'Add a note or a decision…')}
                  style={{
                    flex: 1, minWidth: 0, background: 'transparent', border: 'none', outline: 'none',
                    fontFamily: BODY, fontSize: 12.5, color: ind.ink,
                  }}
                />
                <button
                  type="button"
                  onClick={addNote}
                  disabled={!editable || !note.trim()}
                  aria-label={t('taskListing.addNote', 'Add a note or a decision…')}
                  style={{
                    background: 'none', border: 'none', padding: 0,
                    cursor: note.trim() ? 'pointer' : 'default',
                    color: note.trim() ? ind.accentDeep : ind.inkFaint,
                  }}
                >
                  <ArrowRight size={15} strokeWidth={1.5} />
                </button>
              </div>
            </div>
          </aside>
        </div>

        {modal && (
          <TaskFormModal
            ind={ind}
            t={t}
            form={form}
            setForm={setForm}
            mode={modal.mode}
            canAssign={canAssign}
            assignable={assignable}
            employeeLabel={employeeLabel}
            onClose={() => setModal(null)}
            onSave={submitForm}
            onDelete={modal.task ? () => removeTask(modal.task) : null}
          />
        )}
      </div>
    );
  }

  /* ================================================================== *
   * 4a — Task ledger
   * ================================================================== */

  const decisionCards = decisions.slice(0, DECISION_CARDS);
  const decisionRows = decisions.slice(DECISION_CARDS, DECISION_CARDS + DECISION_ROWS);

  const decisionTag = (row) => {
    if (row.late > 0) {
      return {
        variant: 'outline',
        label: row.late === 1
          ? t('taskListing.oneDayLateShort', '1 day late')
          : t('taskListing.nDaysLateShort', '{n} days late').replace('{n}', String(row.late)),
      };
    }
    if (row.dueDays === 0) return { variant: 'accent', label: t('taskListing.today', 'Today') };
    if (!row.due) return { variant: 'neutral', label: t('taskListing.noDue', 'No date') };
    return { variant: 'neutral', label: t('taskListing.inNDays', 'In {n} d').replace('{n}', String(row.dueDays)) };
  };

  const decisionBody = (row) => {
    const siblings = rows.filter((r) => r.ownerId === row.ownerId && r.open && String(r.id) !== String(row.id)).length;
    const cost = row.late > 0
      ? t('taskListing.costOverdue', 'It has been past due for {n} day(s) and is the oldest open item on this record.')
        .replace('{n}', String(row.late))
      : (row.dueDays === 0
        ? t('taskListing.costToday', 'It is due today; tomorrow it joins the overdue count.')
        : (!row.due
          ? t('taskListing.costNoDate', 'It carries no due date, so nothing will chase it.')
          : t('taskListing.costSoon', 'Due in {n} day(s), and marked {p} priority.')
            .replace('{n}', String(row.dueDays))
            .replace('{p}', row.priority)));
    const context = t('taskListing.costContext', '{owner} has {n} other open task(s) on the same record.')
      .replace('{owner}', row.ownerName)
      .replace('{n}', String(siblings));
    return `${cost} ${context}`;
  };

  return (
    <div data-screen-label="Task Listing" style={screenStyle}>
      {renderTicker(
        <>
          <TickerCell ind={ind} label={t('taskListing.open', 'Open')} value={totals.open} />
          <TickerCell ind={ind} label={t('taskListing.dueToday', 'Due today')} value={totals.dueToday} />
          <TickerCell
            ind={ind}
            label={t('taskListing.overdue', 'Overdue')}
            value={totals.overdue}
            /* The one figure on the strip that asks for an action. */
            valueColor={totals.overdue > 0 ? ind.tickerUp : undefined}
          />
          <TickerCell ind={ind} label={t('taskListing.unscheduled', 'No due date')} value={totals.unscheduled} />
          <TickerCell
            ind={ind}
            label={t('taskListing.closedOnTime', 'Closed on time')}
            value={totals.onTimePct == null ? '—' : `${totals.onTimePct}%`}
            title={t('taskListing.closedOnTimeHint', 'Of the closed tasks that had a due date')}
          />
        </>,
      )}

      <div className="flex flex-col lg:flex-row items-stretch">
        {/* ── LEFT — the ledger ───────────────────────────────────── */}
        <div
          className="flex-1 min-w-0 flex flex-col"
          style={{ padding: '22px 24px 20px', gap: 14, borderRight: `1px solid ${ind.hairline}` }}
        >
          {banner}

          <div className="flex flex-wrap items-end justify-between" style={{ gap: 14 }}>
            <div style={{ minWidth: 0 }}>
              <h1 style={{ fontFamily: BODY, fontSize: 32, fontWeight: 400, margin: 0, color: ind.ink, lineHeight: 1.1 }}>
                {t('taskListing.title', 'Task Listing')}
              </h1>
              {/* The subtitle states the model, not just the count. */}
              <p style={{ ...caption, marginTop: 6 }}>
                {[
                  /* Open and total both, so a ledger whose work is finished
                     still says how much work there was. */
                  t('taskListing.headOpen', '{n} open of {total} task(s) across {r} employee record(s)')
                    .replace('{n}', String(totals.open))
                    .replace('{total}', String(totals.total))
                    .replace('{r}', String(totals.records)),
                  t('taskListing.headModel', 'every one was opened on a record, none are free-standing'),
                  t('taskListing.headMine', 'you own {n}').replace('{n}', String(totals.mine)),
                ].join(' · ')}
              </p>
            </div>

            <div style={{ display: 'flex', gap: 8, flex: 'none' }}>
              <Btn ind={ind} onClick={exportCsv} style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
                <Download size={13} strokeWidth={1.5} />
                {t('taskListing.export', 'Export')}
              </Btn>
              {/* One primary only. */}
              <Btn ind={ind} variant="primary" onClick={openAdd} style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
                <Plus size={13} strokeWidth={1.5} />
                {t('taskListing.newTask', 'New task')}
              </Btn>
            </div>
          </div>

          {/* Filter strip. Counts live in the labels, never as separate badges. */}
          <div
            className="flex flex-wrap items-center"
            style={{
              gap: 10, padding: '9px 0', minWidth: 0,
              borderTop: `1px solid ${ind.hairline}`, borderBottom: `1px solid ${ind.hairline}`,
            }}
          >
            <Seg
              ind={ind}
              ariaLabel={t('taskListing.title', 'Task Listing')}
              value={segment}
              onChange={(value) => { setSegment(value); setSegmentTouched(true); setShowAll(false); }}
              options={segments}
            />

            <div
              className="flex-1"
              style={{
                display: 'flex', alignItems: 'center', gap: 7, minWidth: 0,
                border: `1px solid ${ind.hairline}`, padding: '5px 11px',
              }}
            >
              <Search size={14} strokeWidth={1.5} style={{ flex: 'none', color: ind.inkFaint }} />
              <input
                type="text"
                value={query}
                onChange={(event) => { setQuery(event.target.value); setShowAll(false); }}
                placeholder={t('taskListing.searchPlaceholder', 'Search tasks, owners or the record that opened them')}
                style={{
                  flex: 1, minWidth: 0, background: 'transparent', border: 'none', outline: 'none',
                  fontFamily: BODY, fontSize: 12.5, color: ind.ink,
                }}
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  aria-label={t('common.clear', 'Clear')}
                  style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: ind.inkFaint }}
                >
                  <X size={13} strokeWidth={1.5} />
                </button>
              )}
            </div>

            {/* The grouping is stated in words; the control is a link, not a widget. */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 'none' }}>
              <span
                style={{
                  fontFamily: DISPLAY, fontWeight: 600, fontSize: 11, letterSpacing: '.14em',
                  textTransform: 'uppercase', color: ind.inkFaint, whiteSpace: 'nowrap',
                }}
              >
                {groupModeLabel}
              </span>
              <ActionLink
                ind={ind}
                icon={ChevronDown}
                onClick={() => {
                  const order = ['record', 'due', 'priority'];
                  setGroupMode(order[(order.indexOf(groupMode) + 1) % order.length]);
                  setShowAll(false);
                }}
              >
                {t('taskListing.change', 'Change')}
              </ActionLink>
            </div>
          </div>

          {/* The table — one blueprint frame, padding 0, edge to edge inside. */}
          <Blueprint ind={ind} style={{ padding: 0, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
            <div
              className="grid grid-cols-[22px_1fr_86px] md:grid-cols-[26px_1fr_132px_150px_96px_86px]"
              style={{ gap: 12, alignItems: 'center', padding: '9px 16px', borderBottom: `1px solid ${ind.hairline}` }}
            >
              <span />
              <span style={headCell}>{t('taskListing.colTask', 'Task')}</span>
              <span className="hidden md:block" style={headCell}>{t('taskListing.colSource', 'Source')}</span>
              <span className="hidden md:block" style={headCell}>{t('taskListing.colOwner', 'Owner')}</span>
              <span className="hidden md:block" style={headCell}>{t('taskListing.colDue', 'Due')}</span>
              <span style={{ ...headCell, textAlign: 'right' }}>{t('taskListing.colState', 'State')}</span>
            </div>

            {loading && rows.length === 0 && (
              <div style={{ padding: '28px 16px', textAlign: 'center' }}>
                <span style={{ fontFamily: BODY, fontSize: 13, color: ind.inkMuted }}>
                  {t('common.fetching', 'Fetching')}…
                </span>
              </div>
            )}

            {/*
              An empty table has three different causes and they must not read
              alike: the search excluded everything, the segment excluded
              everything, or the scope really is empty. Saying "no tasks yet"
              over a scope that holds closed ones is a defect — it reports a
              filter as an absence of data.
            */}
            {!loading && visibleGroups.length === 0 && (
              <div style={{ padding: '28px 16px', textAlign: 'center' }}>
                <span className="block" style={{ fontFamily: BODY, fontSize: 13, color: ind.inkMuted, lineHeight: 1.55 }}>
                  {query
                    ? t('taskListing.noMatches', 'Nothing matches that search')
                    : (totals.total > 0
                      ? t('taskListing.noneInSegment', 'No tasks in this view — the scope holds {n}, all in other states')
                        .replace('{n}', String(totals.total))
                      : (unlinkedViewer
                        ? t(
                          'taskListing.unlinkedViewer',
                          'This sign-in is not linked to an employee record, so there is no record to list tasks against. An administrator can link it from User Management.',
                        )
                        : t('taskListing.noTasks', 'No tasks yet. Add your first task!')))}
                </span>
                {!query && totals.total > 0 && segment !== 'closed' && totals.closed > 0 && (
                  <span className="block" style={{ marginTop: 10 }}>
                    <ActionLink
                      ind={ind}
                      onClick={() => { setSegment('closed'); setSegmentTouched(true); setShowAll(false); }}
                    >
                      {t('taskListing.showClosedN', 'Show the {n} closed').replace('{n}', String(totals.closed))}
                    </ActionLink>
                  </span>
                )}
                {query && (
                  <span className="block" style={{ marginTop: 10 }}>
                    <ActionLink ind={ind} icon={X} onClick={() => setQuery('')}>
                      {t('taskListing.clearSearch', 'Clear the search')}
                    </ActionLink>
                  </span>
                )}
              </div>
            )}

            {visibleGroups.map((group, groupIndex) => {
              const bandRows = showAll ? group.rows : group.rows.slice(0, MAX_ROWS_PER_GROUP);
              const hidden = group.rows.length - bandRows.length;
              return (
                <div key={group.key}>
                  <div
                    className="flex flex-wrap items-center justify-between"
                    style={{
                      gap: 16, padding: '9px 16px', background: ind.accentWash,
                      borderBottom: `1px solid ${ind.rule}`,
                      borderTop: groupIndex > 0 ? `1px solid ${ind.rule}` : 'none',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, minWidth: 0 }}>
                      <ChevronDown size={13} strokeWidth={1.5} style={{ flex: 'none', color: ind.inkFaint, alignSelf: 'center' }} />
                      <span
                        style={{
                          fontFamily: DISPLAY, fontWeight: 600, fontSize: 14, letterSpacing: '.07em',
                          textTransform: 'uppercase', color: ind.ink, whiteSpace: 'nowrap',
                        }}
                      >
                        {group.name}
                      </span>
                      <span style={{ fontFamily: BODY, fontSize: 11.5, color: ind.inkMuted, minWidth: 0 }}>
                        {group.note}
                      </span>
                    </div>
                    <GroupProgress
                      ind={ind}
                      done={group.done}
                      total={group.total}
                      label={t('taskListing.done', 'Done')}
                    />
                  </div>

                  {bandRows.map((row, rowIndex) => {
                    const selected = String(row.id) === String(focusTaskId);
                    const last = rowIndex === bandRows.length - 1 && hidden <= 0;
                    return (
                      <div
                        key={row.id}
                        className="grid grid-cols-[22px_1fr_86px] md:grid-cols-[26px_1fr_132px_150px_96px_86px]"
                        style={{
                          gap: 12, alignItems: 'center', padding: '10px 16px',
                          borderBottom: last && groupIndex === visibleGroups.length - 1 ? 'none' : `1px solid ${ind.rule}`,
                          background: selected ? ind.accentWash : 'transparent',
                          boxShadow: selected ? `inset 3px 0 0 ${ind.accent}` : 'none',
                          transition: 'background .15s ease',
                        }}
                        onMouseEnter={(event) => { if (!selected) event.currentTarget.style.background = ind.accentWash; }}
                        onMouseLeave={(event) => { if (!selected) event.currentTarget.style.background = 'transparent'; }}
                      >
                        <SquareCheck
                          ind={ind}
                          done={row.closed}
                          disabled={!canEditTask(row.task)}
                          onClick={() => toggleDone(row.task)}
                          label={row.closed
                            ? t('taskListing.reopen', 'Reopen')
                            : t('taskListing.markComplete', 'Mark complete')}
                        />

                        <div style={{ minWidth: 0 }}>
                          <button
                            type="button"
                            onClick={() => { setFocusTaskId(row.id); setOpenTaskId(row.id); }}
                            style={{
                              background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left',
                              fontFamily: BODY, fontSize: 13.5, color: ind.ink,
                              opacity: row.closed ? 0.5 : 1,
                              textDecoration: row.closed ? 'line-through' : 'none',
                            }}
                          >
                            {isDemoMode()
                              ? row.title
                              : <TranslatedText text={row.title} record={{ entityType: 'task', entityId: row.id, field: 'title' }} />}
                          </button>
                          {/* Consequence or evidence with a real number — never a restatement. */}
                          <p
                            style={{
                              fontFamily: BODY, fontSize: 11.5, lineHeight: 1.45, margin: '2px 0 0',
                              color: ind.inkMuted, opacity: row.closed ? 0.85 : 1,
                            }}
                          >
                            {row.consequence}
                          </p>
                          <p className="md:hidden" style={{ fontFamily: BODY, fontSize: 11.5, color: ind.inkFaint, margin: '2px 0 0' }}>
                            {`${row.sourceLabel} · ${row.ownerName} · ${row.dueLabel}`}
                          </p>
                        </div>

                        <span className="hidden md:block" style={{ justifySelf: 'start' }}>
                          <Tag
                            ind={ind}
                            variant={row.source === 'assigned' ? 'accent' : (row.source === 'self' ? 'outline' : 'neutral')}
                          >
                            {row.sourceLabel}
                          </Tag>
                        </span>

                        <span className="hidden md:block" style={{ minWidth: 0 }}>
                          <OwnerCell ind={ind} name={row.ownerName} muted={row.closed} />
                        </span>

                        <span
                          className="hidden md:block"
                          style={{
                            fontFamily: DISPLAY, fontWeight: 600, fontSize: 13, color: row.dueTone,
                            fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap',
                          }}
                        >
                          {row.dueLabel}
                        </span>

                        <span style={{ justifySelf: 'end' }}>
                          <StateWord ind={ind} state={row.state} label={row.stateLabel} />
                        </span>
                      </div>
                    );
                  })}

                  {hidden > 0 && (
                    <div style={{ padding: '8px 16px', borderBottom: `1px solid ${ind.rule}` }}>
                      <ActionLink ind={ind} onClick={() => setShowAll(true)}>
                        {t('taskListing.nMoreOnRecord', '{n} more on this record').replace('{n}', String(hidden))}
                      </ActionLink>
                    </div>
                  )}
                </div>
              );
            })}

            {/* Truncation is stated, never implied by a fade. */}
            {visibleGroups.length > 0 && (
              <div
                className="flex flex-wrap items-center justify-between"
                style={{
                  gap: 12, padding: '9px 16px', borderTop: `1px solid ${ind.hairline}`,
                  fontFamily: BODY, fontSize: 12, color: ind.inkMuted,
                }}
              >
                <span>
                  {t('taskListing.showingRows', 'Showing {shown} of {total} · {groups} of {allGroups} group(s)')
                    .replace('{shown}', String(shownRows))
                    .replace('{total}', String(filtered.length))
                    .replace('{groups}', String(visibleGroups.length))
                    .replace('{allGroups}', String(groups.length))}
                </span>
                {(groups.length > visibleGroups.length || shownRows < filtered.length) && (
                  <ActionLink ind={ind} onClick={() => setShowAll(true)}>
                    {t('taskListing.showAll', 'Show everything')}
                  </ActionLink>
                )}
                {showAll && groups.length > MAX_GROUPS && (
                  <ActionLink ind={ind} icon={ChevronDown} onClick={() => setShowAll(false)}>
                    {t('taskListing.collapse', 'Collapse')}
                  </ActionLink>
                )}
              </div>
            )}
          </Blueprint>
        </div>

        {/* ── RIGHT — needs a decision, 340px ─────────────────────── */}
        <aside className="w-full lg:w-[340px] lg:shrink-0 flex flex-col" style={{ background: ind.chrome }}>
          <div style={{ padding: '20px 20px 12px', borderBottom: `1px solid ${ind.hairline}` }}>
            <div className="flex items-baseline justify-between" style={{ gap: 10 }}>
              <ColumnHeading ind={ind}>{t('taskListing.needsDecision', 'Needs a decision')}</ColumnHeading>
              <span style={{ fontFamily: DISPLAY, fontWeight: 600, fontSize: 12, color: ind.accent, whiteSpace: 'nowrap' }}>
                {t('taskListing.nItems', '{n} items').replace('{n}', String(decisions.length))}
              </span>
            </div>
            {/* Reconciles with the ticker: same two figures, same scope. */}
            <p style={smallNote}>
              {t('taskListing.decisionSummary', '{o} overdue · {u} with no due date to chase them by')
                .replace('{o}', String(totals.overdue))
                .replace('{u}', String(totals.unscheduled))}
            </p>
          </div>

          {decisions.length === 0 && (
            <div style={{ padding: '16px 20px', borderBottom: `1px solid ${ind.rule}` }}>
              <p style={{ fontFamily: BODY, fontSize: 12.5, color: ind.inkMuted, lineHeight: 1.5 }}>
                {t('taskListing.nothingToDecide', 'Nothing is open. Every task on the visible records is closed.')}
              </p>
            </div>
          )}

          {/* Two actionable cards; the first tinted, the second plain. */}
          {decisionCards.map((row, index) => {
            const tag = decisionTag(row);
            return (
              <div
                key={row.id}
                style={{
                  padding: '14px 20px', borderBottom: `1px solid ${ind.rule}`,
                  background: index === 0 ? ind.accentWash : 'transparent',
                }}
              >
                <div className="flex items-baseline justify-between" style={{ gap: 10 }}>
                  <span
                    style={{
                      fontFamily: DISPLAY, fontWeight: 600, fontSize: 14, letterSpacing: '.04em',
                      textTransform: 'uppercase', color: ind.ink, minWidth: 0,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}
                  >
                    {row.title}
                  </span>
                  <Tag ind={ind} variant={tag.variant}>{tag.label}</Tag>
                </div>
                <p style={{ fontFamily: BODY, fontSize: 12.5, color: ind.inkGhost, margin: '5px 0 9px', lineHeight: 1.45 }}>
                  {decisionBody(row)}
                </p>
                {/* Every item offers two exits. */}
                <div style={{ display: 'flex', gap: 7 }}>
                  <Btn
                    ind={ind}
                    variant="primary"
                    onClick={() => toggleDone(row.task)}
                    disabled={!canEditTask(row.task)}
                  >
                    {t('taskListing.markComplete', 'Mark complete')}
                  </Btn>
                  <Btn ind={ind} onClick={() => { setFocusTaskId(row.id); setOpenTaskId(row.id); }}>
                    {t('taskListing.openTask', 'Open')}
                  </Btn>
                </div>
              </div>
            );
          })}

          {/* Two compact rows. */}
          {decisionRows.map((row) => (
            <div
              key={row.id}
              className="flex items-center justify-between"
              style={{ gap: 12, padding: '12px 20px', borderBottom: `1px solid ${ind.rule}` }}
            >
              <div style={{ minWidth: 0 }}>
                <div
                  style={{
                    fontFamily: BODY, fontSize: 13, color: ind.ink,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}
                >
                  {row.title}
                </div>
                <div style={{ fontFamily: BODY, fontSize: 11.5, color: ind.inkMuted, marginTop: 2 }}>
                  {`${row.ownerName} · ${row.dueLabel}`}
                </div>
              </div>
              <button
                type="button"
                onClick={() => { setFocusTaskId(row.id); setOpenTaskId(row.id); }}
                aria-label={t('taskListing.openTask', 'Open')}
                style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: ind.inkFaint, flex: 'none' }}
              >
                <ArrowRight size={15} strokeWidth={1.5} />
              </button>
            </div>
          ))}

          {/* Your day — every row names its record and its due state. */}
          <div style={{ padding: '18px 20px 10px', marginTop: 6, borderBottom: `1px solid ${ind.hairline}` }}>
            <div className="flex items-baseline justify-between" style={{ gap: 10 }}>
              <ColumnHeading ind={ind}>{t('taskListing.yourDay', 'Your day')}</ColumnHeading>
              <span style={{ fontFamily: DISPLAY, fontWeight: 600, fontSize: 12, color: ind.ink, opacity: 0.5, whiteSpace: 'nowrap' }}>
                {t('taskListing.yourDayCount', '{n} open · {d} due today')
                  .replace('{n}', String(yourDay.open.length))
                  .replace('{d}', String(yourDay.dueToday))}
              </span>
            </div>
          </div>

          {yourDay.list.length === 0 && !yourDay.lastClosed && (
            <div style={{ padding: '12px 20px', borderBottom: `1px solid ${ind.rule}` }}>
              <p style={{ fontFamily: BODY, fontSize: 12.5, color: ind.inkMuted, lineHeight: 1.5 }}>
                {t('taskListing.yourDayEmpty', 'Nothing is assigned to you right now.')}
              </p>
            </div>
          )}

          {yourDay.list.map((row) => (
            <div
              key={row.id}
              style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '10px 20px', borderBottom: `1px solid ${ind.rule}` }}
            >
              <SquareCheck
                ind={ind}
                size={14}
                done={false}
                onClick={() => toggleDone(row.task)}
                label={t('taskListing.markComplete', 'Mark complete')}
              />
              <button
                type="button"
                onClick={() => { setFocusTaskId(row.id); setOpenTaskId(row.id); }}
                style={{ flex: 1, minWidth: 0, background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left' }}
              >
                <span
                  className="block"
                  style={{
                    fontFamily: BODY, fontSize: 12.5, color: ind.ink,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}
                >
                  {row.title}
                </span>
                <span className="block" style={{ fontFamily: BODY, fontSize: 11, color: ind.inkMuted, marginTop: 2 }}>
                  {`${row.ownerName} · ${row.dueLabel}`}
                </span>
              </button>
            </div>
          ))}

          {yourDay.lastClosed && (
            <div
              style={{
                display: 'flex', alignItems: 'center', gap: 11, padding: '10px 20px',
                borderBottom: `1px solid ${ind.rule}`, opacity: 0.55,
              }}
            >
              <SquareCheck
                ind={ind}
                size={14}
                done
                onClick={() => toggleDone(yourDay.lastClosed.task)}
                label={t('taskListing.reopen', 'Reopen')}
              />
              <span style={{ flex: 1, minWidth: 0 }}>
                <span
                  className="block"
                  style={{
                    fontFamily: BODY, fontSize: 12.5, color: ind.ink, textDecoration: 'line-through',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}
                >
                  {yourDay.lastClosed.title}
                </span>
                <span className="block" style={{ fontFamily: BODY, fontSize: 11, color: ind.inkMuted, marginTop: 2 }}>
                  {t('taskListing.closedAt', 'Closed {date}').replace(
                    '{date}',
                    `${shortDate(yourDay.lastClosed.closedAt)} ${clockTime(yourDay.lastClosed.closedAt)}`.trim(),
                  )}
                </span>
              </span>
            </div>
          )}
        </aside>
      </div>

      {modal && (
        <TaskFormModal
          ind={ind}
          t={t}
          form={form}
          setForm={setForm}
          mode={modal.mode}
          canAssign={canAssign}
          assignable={assignable}
          employeeLabel={employeeLabel}
          onClose={() => setModal(null)}
          onSave={submitForm}
          onDelete={modal.task ? () => removeTask(modal.task) : null}
        />
      )}
    </div>
  );
};

export default TaskListing;
