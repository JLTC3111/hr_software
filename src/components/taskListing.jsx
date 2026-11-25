// Work queue and task detail use the same scoped task records.
import _React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle, ArrowRight, Check, ChevronDown, Download, Plus, Search, Trash2, X,
} from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext.jsx';
import { useLanguage } from '../contexts/LanguageContext.jsx';
import { useAuth } from '../contexts/AuthContext.jsx';
import * as workloadService from '../services/workloadService.js';
import { useSessionGuard, useAuthenticatedPageRefresh } from '../hooks/useSessionGuard.js';
import { validateAndRefreshSession } from '../utils/sessionHelper.js';
import { useWorkloadTaskRefresh } from '../hooks/useWorkloadTaskRefresh.js';
import { isDemoMode, getDemoEmployeeName, getDemoTaskTitle, getDemoTaskDescription } from '../utils/demoHelper.js';
import { filterActiveEmployees } from '../utils/employeeStatus.js';
import { getEmployeePositionI18nKey } from '../utils/employeePositionKey.js';
import { escapeCsvCell, getTaskDurationDays } from '../utils/reportExportHelpers.js';
import {
  applyLegacyTaskTab, DEFAULT_TASK_LIST_PREFERENCES, groupTaskListRows, isNewTaskAssignment,
  normalizeTaskListPreferences, readTaskListPreferences, selectTaskListView, TASK_LIST_DUE_FILTERS,
  TASK_LIST_PAGE_SIZE, TASK_LIST_SORTS, TASK_LIST_STATUSES, taskDueWindow, writeTaskListPreferences,
} from '../utils/taskListView.js';
import { calendarDayDistance, formatWorkloadDay, formatWorkloadTimestamp, taskCompletionIssue, vietnamCalendarDay } from '../utils/workloadDates.js';
import { DatePicker } from './ui/date-picker.jsx';
import { TranslatedText } from './ui/translated-text.jsx';
import { FetchElapsedPill } from './ui/fetch-elapsed-pill';
import { getIndustry, DISPLAY, BODY, figure } from '../theme/industry.js';
import { useScreenNavigation } from '../hooks/useScreenNavigation.js';
import {
  Blueprint, Bar, Tag, Btn, TickerCell, LiveClock, ColumnHeading, FlatListbox,
} from './ui/industry.jsx';

/* ------------------------------------------------------------------ *
 * Screen constants
 * ------------------------------------------------------------------ */

/** A due date this many days out or nearer is worth naming in days, not a date. */
const NEAR_DAYS = 6;

const CLOSED_STATUS = 'completed';
const CANCELLED_STATUS = 'cancelled';

/* ------------------------------------------------------------------ *
 * Navigation
 * ------------------------------------------------------------------ */

/** The tab the ledger lands on when the URL does not name one. */
const DEFAULT_SEGMENT = 'open';

/** Every tab the chips can select. Anything else in `?tab=` is not a place. */
const SEGMENT_VALUES = new Set([DEFAULT_SEGMENT, 'mine', 'overdue', 'closed']);

/**
 * Declared at module scope so its identity is stable — see useScreenNavigation.
 *
 *   /task-listing                      the ledger, default tab
 *   /task-listing?tab=overdue          the ledger, a named tab
 *   /task-listing?tab=overdue&task=42  that task's detail sheet, Back returns
 *                                      to the tab it was opened from
 */
const TASK_LISTING_NAV = {
  tab: { key: 'tab', fallback: null, isValid: (value) => SEGMENT_VALUES.has(value) },
  task: { key: 'task', fallback: null },
};

/* ------------------------------------------------------------------ *
 * Helpers
 * ------------------------------------------------------------------ */

const norm = (value) => String(value ?? '').toLowerCase().replace(/_/g, '-');

const isClosed = (task) => norm(task.status) === CLOSED_STATUS;
const isCancelled = (task) => norm(task.status) === CANCELLED_STATUS;

const completionIssueLabel = (issue, t) => issue === 'missing'
  ? t('taskListing.completionDateMissing', 'Completion date is missing')
  : t('taskListing.completionDateUnverified', 'Verify the completion date');

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
    done: { color: ind.dark ? '#9dd9b8' : '#216041' },
    cancelled: { color: ind.inkGhost },
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
/* ------------------------------------------------------------------ *
 * Task form — the one modal on the screen
 * ------------------------------------------------------------------ */

const EMPTY_FORM = {
  title: '', description: '', startDate: '', dueDate: '', completionDate: '',
  priority: 'medium', status: 'pending',
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
              <FlatListbox
                ind={ind}
                value={form.assignedTo || ''}
                onChange={(event) => setForm({ ...form, assignedTo: event.target.value })}
                aria-label={t('taskListing.assignTo', 'Assign To')}
                style={{ ...field, textTransform: 'none', letterSpacing: '.02em' }}
              >
                <option value="">{t('taskListing.selectEmployee', 'Select Employee')}</option>
                {assignable.map((employee) => (
                  <option key={employee.id} value={String(employee.id)}>
                    {employeeLabel(employee)}
                  </option>
                ))}
              </FlatListbox>
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
              <span style={label}>{t('taskListing.startDate', 'Start Date')}</span>
              <DatePicker
                flat
                value={form.startDate || ''}
                onChange={(event) => setForm({ ...form, startDate: event.target.value })}
                aria-label={t('taskListing.startDate', 'Start Date')}
              />
            </div>
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
              <span style={label}>{t('taskListing.completionDate', 'Completion Date')}</span>
              <DatePicker
                flat
                value={form.completionDate || ''}
                onChange={(event) => setForm({ ...form, completionDate: event.target.value })}
                min={form.startDate || undefined}
                max={vietnamCalendarDay()}
                disabled={form.status !== 'completed'}
                aria-label={t('taskListing.completionDate', 'Completion Date')}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2" style={{ gap: 14 }}>
            <div>
              <span style={label}>{t('taskListing.priority', 'Priority')}</span>
              <FlatListbox
                ind={ind}
                value={form.priority}
                onChange={(event) => setForm({ ...form, priority: event.target.value })}
                aria-label={t('taskListing.priority', 'Priority')}
                style={{ ...field, textTransform: 'none', letterSpacing: '.02em' }}
              >
                <option value="low">{t('taskListing.priorityLow', 'Low')}</option>
                <option value="medium">{t('taskListing.priorityMedium', 'Medium')}</option>
                <option value="high">{t('taskListing.priorityHigh', 'High')}</option>
              </FlatListbox>
            </div>
            <div>
              <span style={label}>{t('taskListing.status', 'Status')}</span>
              <FlatListbox
                ind={ind}
                value={form.status}
                onChange={(event) => setForm({ ...form, status: event.target.value })}
                aria-label={t('taskListing.status', 'Status')}
                style={{ ...field, textTransform: 'none', letterSpacing: '.02em' }}
              >
                <option value="pending">{t('taskListing.statusPending', 'Pending')}</option>
                <option value="in-progress">{t('taskListing.statusInProgress', 'In Progress')}</option>
                <option value="completed">{t('taskListing.statusCompleted', 'Completed')}</option>
                <option value="cancelled">{t('taskListing.stateCancelled', 'Cancelled')}</option>
              </FlatListbox>
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
  const today = vietnamCalendarDay();

  const [tasks, setTasks] = useState([]);
  const [loadedScope, setLoadedScope] = useState(null);
  const taskRequest = useRef(0);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState('');
  const [notice, setNotice] = useState(null);

  const [query, setQuery] = useState('');
  const preferenceId = user?.id || null;
  const storedPreferences = useMemo(() => readTaskListPreferences(preferenceId), [preferenceId]);
  const [savedPreferences, setSavedPreferences] = useState(null);
  const [historyExpanded, setHistoryExpanded] = useState(null);
  const [openLimit, setOpenLimit] = useState(TASK_LIST_PAGE_SIZE);
  const [historyLimit, setHistoryLimit] = useState(TASK_LIST_PAGE_SIZE);

  const [focusTaskId, setFocusTaskId] = useState(null);
  const [note, setNote] = useState('');

  const [modal, setModal] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);

  const canViewAll = checkPermission('canViewReports');
  const canAssign = user?.role === 'admin' || user?.role === 'manager';

  /* ---------------- navigation ----------------
     The tab and the opened task are addresses, not component state. Held in
     useState, Back walked out of the screen instead of closing the detail
     sheet, a reload dropped the viewer back on the landing view, and a task
     could not be linked to. Both now live in the query string. */
  const [nav, go] = useScreenNavigation(TASK_LISTING_NAV);

  const openTaskId = nav.task;
  const saved = savedPreferences?.id === preferenceId ? savedPreferences.value : storedPreferences;
  const preferences = applyLegacyTaskTab(saved, nav.tab);

  const openTask = useCallback((id) => {
    setFocusTaskId(id);
    /* Pushed, so Back returns to the ledger the row was opened from. */
    go({ task: id });
  }, [go]);

  const closeTask = useCallback(() => { go({ task: null }); }, [go]);

  const changePreferences = (patch, closeDetail = false) => {
    const value = normalizeTaskListPreferences({ ...preferences, ...patch });
    setSavedPreferences({ id: preferenceId, value });
    writeTaskListPreferences(preferenceId, value);
    if (closeDetail) go({ task: null, tab: null });
    else if (nav.tab) go({ tab: null }, { replace: true });
    setOpenLimit(TASK_LIST_PAGE_SIZE);
    setHistoryLimit(TASK_LIST_PAGE_SIZE);
    if (patch.status !== undefined) setHistoryExpanded(null);
  };

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
  const taskScope = JSON.stringify([user?.id ?? myEmployeeId, canViewAll, myEmployeeId]);
  const currentScope = useRef(taskScope);
  currentScope.current = taskScope;
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
    (value) => formatWorkloadDay(value, currentLanguage, { day: '2-digit', month: 'short' }),
    [currentLanguage],
  );

  const clockTime = useCallback((value) => formatWorkloadTimestamp(value, currentLanguage, {
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }), [currentLanguage]);

  /* ---------------- fetch ---------------- */

  const fetchTasks = useCallback(async ({ silent = false } = {}) => {
    const request = ++taskRequest.current;
    const isCurrent = () => request === taskRequest.current && currentScope.current === taskScope;
    if (!silent) setLoading(true);
    try {
      if (!isDemoMode()) {
        const validation = await validateAndRefreshSession();
        if (!validation.success) throw new Error(validation.error);
      }

      const result = canViewAll
        ? await workloadService.getAllTasks()
        : await workloadService.getEmployeeTasks(myEmployeeId);

      if (!isCurrent()) return;
      if (!result.success || !Array.isArray(result.data)) throw new Error(result.error || 'Unable to read tasks');
      setTasks(result.data);
      setLoadedScope(taskScope);
      setFetchError('');
    } catch (error) {
      if (!isCurrent()) return;
      console.error('Error fetching tasks:', error);
      setLoadedScope(null);
      if (handleSessionAuthError(error, { silent })) return;
      setFetchError(t('taskListing.loadFailed', 'Failed to load tasks'));
    } finally {
      if (isCurrent()) setLoading(false);
    }
  }, [canViewAll, myEmployeeId, taskScope, handleSessionAuthError, t]);

  useAuthenticatedPageRefresh(() => fetchTasks({ silent: true }));

  useEffect(() => {
    /* A viewer with no employee record and no reporting permission has nothing
       to fetch — stop the spinner rather than leaving it turning. */
    if (!canViewAll && !myEmployeeId) {
      setLoading(false);
      return;
    }
    fetchTasks();
    return () => { taskRequest.current += 1; };
  }, [fetchTasks, canViewAll, myEmployeeId]);

  useWorkloadTaskRefresh(canViewAll ? directory.map(({ id }) => id) : [myEmployeeId], () => fetchTasks({ silent: true }), {
    enabled: Boolean(user) && !isDemoMode(),
  });

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
    const done = isClosed(task) || isCancelled(task);
    const result = await workloadService.bulkUpdateTaskStatus([task.id], done ? 'pending' : 'completed');
    if (result.success) {
      flash('ok', done ? t('taskListing.reopened', 'Task reopened') : t('taskListing.markedComplete', 'Task marked complete'));
      fetchTasks({ silent: true });
    } else if (!handleSessionAuthError(new Error(result.error))) {
      flash('err', t('taskListing.taskUpdateError', 'Failed to update task'));
    }
  }, [canEditTask, fetchTasks, flash, handleSessionAuthError, t]);

  const openAdd = useCallback(() => {
    setForm({ ...EMPTY_FORM, assignedTo: canAssign ? '' : myEmployeeId });
    setModal({ mode: 'add', task: null });
  }, [canAssign, myEmployeeId]);

  const openEdit = useCallback((task) => {
    const original = {
      title: isDemoMode() ? getDemoTaskTitle(task, t) : (task.title || ''),
      description: isDemoMode() ? getDemoTaskDescription(task, t) : (task.description || ''),
      dueDate: task.due_date || '',
      startDate: task.start_date || '',
      completionDate: task.completion_date || '',
      priority: task.priority || 'medium',
      status: norm(task.status) || 'pending',
      selfAssessment: task.self_assessment || '',
      qualityRating: task.quality_rating || 0,
      assignedTo: String(task.employee_id || ''),
    };
    setForm(original);
    setModal({ mode: 'edit', task, original });
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

    const completionEdited = form.status === 'completed' && (
      modal?.task?.status !== 'completed' || form.completionDate !== (modal?.task?.completion_date || '')
    );
    if (completionEdited && !form.completionDate) {
      flash('err', completionIssueLabel('missing', t));
      return;
    }
    if (completionEdited && form.completionDate > vietnamCalendarDay()) {
      flash('err', completionIssueLabel('future', t));
      return;
    }
    if (form.status === 'completed' && form.startDate && form.completionDate && form.completionDate < form.startDate) {
      flash('err', t('taskListing.completionBeforeStart', 'Completion date cannot be before start date'));
      return;
    }

    if (modal?.mode === 'edit') {
      const updates = {};
      for (const key of ['title', 'description', 'startDate', 'dueDate', 'priority', 'selfAssessment', 'qualityRating']) {
        if (form[key] !== modal.original[key]) updates[key] = form[key];
      }
      if (form.status !== modal.original.status) updates.status = form.status;
      if (completionEdited) updates.completionDate = form.completionDate;
      if (canAssign && String(employeeId) !== String(modal.task.employee_id)) updates.assignedTo = employeeId;
      if (Object.keys(updates).length === 0) {
        setModal(null);
        return;
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
      startDate: form.startDate || null,
      completionDate: form.status === 'completed' ? form.completionDate : null,
      priority: form.priority,
      status: form.status,
      selfAssessment: form.selfAssessment || null,
      qualityRating: form.qualityRating || 0,
      createdBy: viewerRecord.linked ? myEmployeeId : null,
    });
    if (result.success) {
      flash('ok', t('taskListing.taskCreated', 'Task created'));
      setModal(null);
      fetchTasks({ silent: true });
    } else {
      console.error('Failed to create task:', result.error);
      flash('err', t('taskListing.taskCreateError', 'Failed to create task'));
    }
  }, [form, modal, myEmployeeId, canAssign, saveUpdate, flash, fetchTasks, t, viewerRecord.linked]);

  const removeTask = useCallback(async (task) => {
    if (!globalThis.confirm(t('taskListing.confirmDelete', 'Delete this task?'))) return;
    const result = await workloadService.deleteTask(task.id);
    if (result.success) {
      flash('ok', t('taskListing.taskDeleted', 'Task deleted'));
      setModal(null);
      if (String(openTaskId) === String(task.id)) closeTask();
      fetchTasks({ silent: true });
    } else {
      console.error('Failed to delete task:', result.error);
      flash('err', t('taskListing.taskDeleteError', 'Failed to delete task'));
    }
  }, [closeTask, flash, fetchTasks, openTaskId, t]);

  /* ---------------- derivation ---------------- */

  /**
   * Both views derive dates and ownership from the same scoped rows.
   */
  const rows = useMemo(() => (loadedScope === taskScope ? tasks : []).map((task) => {
    const closed = isClosed(task);
    const cancelled = isCancelled(task);
    const open = !closed && !cancelled;

    const due = task.due_date ? vietnamCalendarDay(task.due_date) : null;
    const dueDays = due ? calendarDayDistance(today, due) : null;
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
    const selfSet = creatorId === ownerId && Boolean(creatorId);
    const completionIssue = taskCompletionIssue(task, today);
    const closedAt = closed && !completionIssue ? task.completion_date : null;

    const openedBy = creatorName && !selfSet
      ? t('taskListing.byWho', 'by {who}').replace('{who}', creatorName)
      : selfSet ? t('taskListing.bySelf', 'by the owner') : '';
    const openedOn = task.created_at
      ? t('taskListing.openedOn', 'opened {date} {by}')
        .replace('{date}', shortDate(task.created_at))
        .replace('{by}', openedBy)
      : t('taskListing.openedUnknown', 'opening date not recorded');

    let dueLabel;
    if (!due) dueLabel = t('taskListing.noDue', 'No date');
    else if (closed || cancelled) dueLabel = shortDate(task.due_date);
    else if (late === 1) dueLabel = t('taskListing.oneDayLateShort', '1 day late');
    else if (late > 1) dueLabel = t('taskListing.nDaysLateShort', '{n} days late').replace('{n}', String(late));
    else if (dueDays === 0) dueLabel = t('taskListing.today', 'Today');
    else if (dueDays <= NEAR_DAYS) dueLabel = t('taskListing.inNDays', 'In {n} d').replace('{n}', String(dueDays));
    else dueLabel = shortDate(task.due_date);

    return {
      task,
      id: task.id,
      handle: handleOf(task.id),
      title: isDemoMode() ? getDemoTaskTitle(task, t) : (task.title || ''),
      description: isDemoMode() ? getDemoTaskDescription(task, t) : (task.description || ''),
      open, closed, cancelled, state, stateLabel, status: norm(task.status),
      due, dueDays, late, dueLabel,
      ownerId, ownerName, ownerDept,
      creatorName, selfSet, openedOn,
      closedAt, completionIssue,
      priority: norm(task.priority) || 'medium',
      rating: Number(task.quality_rating) || 0,
      mine: ownerId === myEmployeeId,
    };
  }), [tasks, loadedScope, taskScope, employeeById, nameOf, myEmployeeId, today, shortDate, t]);

  const byId = useMemo(() => new Map(rows.map((row) => [String(row.id), row])), [rows]);

  const ownerOptions = useMemo(() => {
    const names = new Map(directory.map((employee) => [String(employee.id), getDemoEmployeeName(employee, t)]));
    rows.forEach((row) => { if (!names.has(row.ownerId)) names.set(row.ownerId, row.ownerName); });
    return [...names].sort(([, a], [, b]) => a.localeCompare(b, currentLanguage === 'vn' ? 'vi' : undefined));
  }, [directory, rows, t, currentLanguage]);
  const owner = !canViewAll ? 'mine' : ['all', 'mine'].includes(preferences.owner) || ownerOptions.some(([id]) => id === preferences.owner)
    ? preferences.owner : 'all';
  const { open: openRows, history: historyRows } = useMemo(() => selectTaskListView(rows, { ...preferences, owner }, query),
    [rows, preferences, owner, query]);
  const historyOnly = ['closed', 'completed', 'cancelled'].includes(preferences.status);
  const showHistory = historyExpanded ?? historyOnly;
  const filtered = showHistory ? [...openRows, ...historyRows] : openRows;
  const taskDataReady = !loading && !fetchError && loadedScope === taskScope;
  const scopeHasOpen = rows.some((row) => row.open);

  /* ---------------- export ---------------- */

  const exportCsv = useCallback(() => {
    const header = [
      t('taskListing.taskTitle', 'Task Title'),
      t('taskListing.status', 'Status'),
      t('taskListing.startDate', 'Start Date'),
      t('taskListing.createdLabel', 'Created'),
      t('taskListing.updatedLabel', 'Last updated'),
      t('taskListing.dueDate', 'Due Date'),
      t('taskListing.completionDate', 'Completion Date'),
      t('taskListing.assignedTo', 'Assigned To'),
      t('taskListing.assignedBy', 'Assigned By'),
      t('taskListing.priority', 'Priority'),
      t('taskListing.qualityRating', 'Quality Rating'),
    ];
    const body = filtered.map((row) => [
      row.title, row.task.status, row.task.start_date || '', row.task.created_at || '', row.task.updated_at || '',
      row.task.due_date || '', row.closedAt || '', row.ownerName,
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

  /* A link to a task that has since been deleted, or that this viewer is not
     allowed to see, already falls through to the ledger. Drop the dead
     parameter too, so a reload does not keep re-asking for it and the address
     bar matches what is actually on screen. Replaced, never pushed: a
     correction is not somewhere Back should return to.

     Guarded on `loading` and `fetchError` because `byId` is empty during the
     first fetch and after a failed one — neither means the task is gone. */
  useEffect(() => {
    if (loading || fetchError || !openTaskId) return;
    if (!byId.has(String(openTaskId))) go({ task: null }, { replace: true });
  }, [loading, fetchError, openTaskId, byId, go]);

  useEffect(() => { setNote(''); }, [openTaskId]);

  const detail = useMemo(() => {
    if (!opened) return null;
    const { task } = opened;

    const started = Boolean(task.start_date) || norm(task.status) === 'in-progress' || opened.closed;
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
              .replace('{creator}', opened.creatorName || t('taskListing.assignmentUnknown', 'Assignment source unavailable'))),
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
          ? opened.closedAt ? t('taskListing.stepClosedDone', 'Closed {date}').replace('{date}', shortDate(opened.closedAt)) : completionIssueLabel(opened.completionIssue, t)
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

    /* `03` — start → close against the window start → due. created_at is
       when the row was typed in, which is often after the work finished. */
    const duration = getTaskDurationDays(task);
    const elapsed = duration.actual;
    const window = duration.estimated;
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
                    onClick={closeTask}
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
                  {opened.closed || opened.cancelled ? t('taskListing.reopen', 'Reopen') : t('taskListing.markComplete', 'Mark complete')}
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
                    subject={opened.selfSet ? opened.ownerName : (opened.creatorName || t('taskListing.assignmentUnknown', 'Assignment source unavailable'))}
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
                      changePreferences({ owner: opened.ownerId, status: 'open', due: 'all' }, true);
                      setQuery('');
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
                        : t('taskListing.noWindow', 'no start date — there is no window to measure against')}
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
                  changePreferences({ owner: opened.ownerId, status: 'open', due: 'all' }, true);
                  setQuery('');
                }}
              >
                {`${opened.ownerName}${opened.ownerDept ? ` · ${opened.ownerDept}` : ''}`}
              </InlineLink>
            </FieldRow>
            <FieldRow ind={ind} label={t('taskListing.assignedBy', 'Assigned By')}>
              {opened.selfSet
                ? t('taskListing.selfSetValue', 'The owner')
                : (opened.creatorName || t('taskListing.assignmentUnknown', 'Assignment source unavailable'))}
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
                  date: '',
                  text: t('taskListing.actRated', 'Quality rated {n}/5').replace('{n}', String(opened.rating)),
                  actor: opened.ownerName,
                  time: '',
                });
              }
              if (opened.closed) {
                entries.push({
                  key: 'closed',
                  date: shortDate(opened.closedAt),
                  text: opened.completionIssue ? completionIssueLabel(opened.completionIssue, t) : t('taskListing.actClosed', 'Marked complete'),
                  actor: opened.ownerName,
                  time: clockTime(opened.closedAt),
                });
              }
              if (task.updated_at && task.updated_at !== task.created_at) {
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
                  date: '',
                  text: t('taskListing.actAssessed', 'Self-assessment written'),
                  actor: opened.ownerName,
                  time: '',
                });
              }
              entries.push({
                key: 'opened',
                date: shortDate(task.created_at),
                text: t('taskListing.actOpened', 'Task opened on the {who} record').replace('{who}', opened.ownerName),
                actor: opened.selfSet ? opened.ownerName : (opened.creatorName || t('taskListing.assignmentUnknown', 'Assignment source unavailable')),
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
                  <TranslatedText text={task.comments} record={{ entityType: 'task', entityId: task.id, field: 'comments' }} />
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

  // Task queue
  const statusLabels = {
    open: t('taskListing.segAllOpen', 'All open'),
    pending: t('taskListing.statusPending', 'Pending'),
    'in-progress': t('taskListing.statusInProgress', 'In progress'),
    completed: t('taskListing.statusCompleted', 'Completed'),
    cancelled: t('taskListing.stateCancelled', 'Cancelled'),
    closed: t('taskListing.segClosed', 'Closed'),
  };
  const dueLabels = {
    all: t('taskListing.allDeadlines', 'All deadlines'),
    overdue: t('taskListing.overdue', 'Overdue'),
    today: t('taskListing.dueToday', 'Due today'),
    upcoming: t('taskListing.dueUpcoming', 'Upcoming'),
    undated: t('taskListing.unscheduled', 'No due date'),
  };
  const sortLabels = {
    urgency: t('taskListing.sortUrgency', 'Urgency'),
    created_at: t('taskListing.createdLabel', 'Created'),
    updated_at: t('taskListing.updatedLabel', 'Last updated'),
    due_date: t('taskListing.dueDate', 'Due date'),
    completion_date: t('taskListing.completionDate', 'Completion date'),
  };
  const tones = {
    overdue: ind.dark ? '#f2a69c' : '#8f3028',
    today: ind.dark ? '#f6d08d' : '#744713',
    upcoming: ind.accentDeep,
    completed: ind.dark ? '#9dd9b8' : '#216041',
  };
  const dateOptions = { day: '2-digit', month: 'short', year: 'numeric' };
  const formatDay = (value) => formatWorkloadDay(value, currentLanguage, dateOptions);
  const formatTimestamp = (value) => formatWorkloadTimestamp(value, currentLanguage, {
    ...dateOptions, hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  });
  const relevantFilters = query.trim() || owner !== (canViewAll ? 'all' : 'mine') || preferences.status !== 'open' || preferences.due !== 'all';
  const resetFilters = () => {
    setQuery('');
    const { owner: ownerDefault, status, due } = DEFAULT_TASK_LIST_PREFERENCES;
    changePreferences({ owner: ownerDefault, status, due });
  };

  const filterControl = (key, label, value, options, disabled = false) => (
    <div className="min-w-0">
      <label htmlFor={`task-${key}`} style={{ ...headCell, display: 'block', marginBottom: 4 }}>{label}</label>
      <FlatListbox id={`task-${key}`} ind={ind} aria-label={label} value={value} options={options} disabled={disabled}
        onChange={(event) => changePreferences({ [key]: event.target.value })} style={{ width: '100%' }} />
    </div>
  );
  const optionsFor = (values, labels) => values.map((value) => ({ value, label: labels[value] }));

  const renderTaskRows = (sectionRows, limit, setLimit) => (
    <>
      {groupTaskListRows(sectionRows.slice(0, limit), preferences.groupByEmployee).map((group) => (
        <div key={group.key} data-task-group={preferences.groupByEmployee ? group.key : undefined}>
          {preferences.groupByEmployee && (
            <h3 style={{ ...figure(16, ind.ink), margin: 0, padding: '8px 14px', background: ind.chrome, borderBottom: `1px solid ${ind.hairline}` }}>
              {group.ownerName}
            </h3>
          )}
          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {group.rows.map((row) => {
              const dueWindow = taskDueWindow(row);
              const assignment = row.open && isNewTaskAssignment(row.task);
              const statusColor = row.closed && !row.completionIssue ? tones.completed : ind.ink;
              const created = formatTimestamp(row.task.created_at);
              const updated = preferences.sort === 'updated_at' ? formatTimestamp(row.task.updated_at) : '';
              const dates = [
                [t('taskListing.createdLabel', 'Created'), created],
                ...(preferences.sort === 'updated_at' ? [[t('taskListing.updatedLabel', 'Last updated'), updated]] : []),
                [t('taskListing.dueDate', 'Due date'), formatDay(row.due), row.open ? tones[dueWindow] : undefined],
                ...(row.closed ? [[t('taskListing.completionDate', 'Completion date'), formatDay(row.task.completion_date), row.completionIssue ? tones.today : undefined]] : []),
              ];
              return (
                <li key={row.id} data-task-row={row.id} data-task-status={row.status} data-task-urgency={row.open ? dueWindow : undefined}
                  className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-2 px-3 py-3 sm:px-4 lg:grid-cols-[auto_minmax(0,1.45fr)_minmax(0,1.16fr)] lg:items-start"
                  style={{ borderBottom: `1px solid ${ind.rule}`, background: String(focusTaskId) === String(row.id) ? ind.accentWash : 'transparent' }}>
                  <div className="pt-1">
                    {row.cancelled ? <span className="block w-[18px]" /> : (
                      <SquareCheck ind={ind} done={row.closed} size={18} disabled={!canEditTask(row.task)}
                        label={row.closed ? t('taskListing.reopen', 'Reopen') : t('taskListing.markComplete', 'Mark complete')}
                        onClick={() => toggleDone(row.task)} />
                    )}
                  </div>
                  <div className="min-w-0">
                    <button type="button" onClick={() => openTask(row.id)} className="text-left focus-visible:outline-2 focus-visible:outline-offset-2"
                      style={{ color: ind.ink, fontFamily: BODY, fontSize: 15, fontWeight: 600, lineHeight: 1.35, overflowWrap: 'anywhere' }}>
                      {isDemoMode() ? row.title : <TranslatedText text={row.title} record={{ entityType: 'task', entityId: row.id, field: 'title' }} />}
                    </button>
                    <div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1" style={{ fontSize: 12 }}>
                      <span style={{ color: ind.inkGhost }}>{row.ownerName}</span>
                      <span style={{ color: statusColor, fontWeight: 600 }}>{statusLabels[row.status] || row.stateLabel}</span>
                      {row.open && <span style={{ color: tones[dueWindow] || ind.inkGhost, fontWeight: 600 }}>{dueLabels[dueWindow]}</span>}
                      {assignment && <span style={{ color: ind.accentDeep, fontWeight: 600 }}>{t('taskListing.newAssignment', 'New assignment')}</span>}
                      {row.completionIssue && <span style={{ color: tones.today, fontWeight: 600 }}>{completionIssueLabel(row.completionIssue, t)}</span>}
                    </div>
                  </div>
                  <dl className="col-start-2 m-0 grid grid-cols-2 gap-x-3 gap-y-1 lg:col-start-3 lg:grid-cols-3">
                    {dates.map(([label, value, color]) => (
                      <div key={label} className="min-w-0">
                        <dt style={headCell}>{label}</dt>
                        <dd style={{ margin: 0, fontSize: 12, lineHeight: 1.4, color: color || ind.ink, overflowWrap: 'anywhere' }}>{value || '—'}</dd>
                      </div>
                    ))}
                  </dl>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
      {sectionRows.length > limit && (
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2" style={caption}>
          <span>{t('taskListing.visibleCount', '{shown} of {total} shown').replace('{shown}', limit.toLocaleString()).replace('{total}', sectionRows.length.toLocaleString())}</span>
          <Btn ind={ind} onClick={() => setLimit(limit + TASK_LIST_PAGE_SIZE)}>{t('common.loadMore', 'Load more')}</Btn>
        </div>
      )}
    </>
  );

  return (
    <div data-screen-label="Task Listing" style={screenStyle}>
      {renderTicker(<>
        <TickerCell ind={ind} label={t('taskListing.open', 'Open')} value={taskDataReady ? openRows.length : '—'} />
        <TickerCell ind={ind} label={dueLabels.overdue} value={taskDataReady ? openRows.filter((row) => row.late > 0).length : '—'} />
        <TickerCell ind={ind} label={dueLabels.today} value={taskDataReady ? openRows.filter((row) => row.dueDays === 0).length : '—'} />
        <TickerCell ind={ind} label={dueLabels.upcoming} value={taskDataReady ? openRows.filter((row) => row.dueDays > 0).length : '—'} />
        <TickerCell ind={ind} label={dueLabels.undated} value={taskDataReady ? openRows.filter((row) => !row.due).length : '—'} />
      </>)}

      <div className="flex min-w-0 flex-col gap-4 px-3 py-4 sm:p-6">
        {banner}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 style={{ fontFamily: BODY, fontWeight: 400, fontSize: 'clamp(25px, 4vw, 34px)', lineHeight: 1.1, margin: 0 }}>{t('taskListing.title', 'Task Listing')}</h1>
          <div className="flex flex-wrap items-center gap-2">
            <Btn ind={ind} onClick={exportCsv} disabled={!taskDataReady || !filtered.length} className="inline-flex items-center gap-2">
              <Download size={14} aria-hidden="true" />{t('taskListing.export', 'Export')}
            </Btn>
            {canAssign && <Btn ind={ind} variant="primary" onClick={openAdd} className="inline-flex items-center gap-2">
              <Plus size={14} aria-hidden="true" />{t('taskListing.newTask', 'New task')}
            </Btn>}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-x-3 gap-y-2 border-y py-3 md:grid-cols-3 xl:grid-cols-6" style={{ borderColor: ind.hairline }}>
          {filterControl('owner', t('taskListing.colOwner', 'Owner'), owner, [
            ...(canViewAll ? [{ value: 'all', label: t('taskListing.ownersAll', 'All owners') }] : []),
            { value: 'mine', label: t('taskListing.segMine', 'Mine') },
            ...(canViewAll ? ownerOptions.map(([value, label]) => ({ value, label })) : []),
          ], !canViewAll)}
          {filterControl('status', t('taskListing.status', 'Status'), preferences.status, optionsFor(TASK_LIST_STATUSES, statusLabels))}
          {filterControl('due', t('taskListing.dueDate', 'Due date'), preferences.due, optionsFor(TASK_LIST_DUE_FILTERS, dueLabels), historyOnly)}
          {filterControl('sort', t('taskListing.sortBy', 'Sort by'), preferences.sort, optionsFor(TASK_LIST_SORTS, sortLabels))}
          {filterControl('direction', t('taskListing.sortDirection', 'Direction'), preferences.direction, [
            { value: 'asc', label: t('taskListing.sortAscending', 'Ascending') },
            { value: 'desc', label: t('taskListing.sortDescending', 'Descending') },
          ], preferences.sort === 'urgency')}
          <div className="min-w-0">
            <span style={{ ...headCell, display: 'block', marginBottom: 4 }}>{t('taskListing.grouping', 'Grouping')}</span>
            <Btn ind={ind} aria-label={t('taskListing.grouping', 'Grouping')} aria-pressed={preferences.groupByEmployee}
              onClick={() => changePreferences({ groupByEmployee: !preferences.groupByEmployee })}
              style={{ width: '100%', textAlign: 'left', minHeight: 33 }}>
              {preferences.groupByEmployee ? t('taskListing.groupEmployee', 'By employee') : t('taskListing.groupNone', 'None')}
            </Btn>
          </div>
          <div className="col-span-2 flex min-w-0 items-center gap-2 px-2 md:col-span-3 xl:col-span-4" style={{ border: `1px solid ${ind.hairline}` }}>
            <Search size={14} aria-hidden="true" style={{ flex: 'none', color: ind.inkGhost }} />
            <input className="min-w-0 flex-1 bg-transparent px-1 py-2 focus-visible:outline-2 focus-visible:outline-offset-1"
              aria-label={t('taskListing.search', 'Search tasks')}
              placeholder={t('taskListing.searchPlaceholder', 'Search tasks, owners or the record that opened them')}
              value={query} onChange={(event) => { setQuery(event.target.value); setOpenLimit(TASK_LIST_PAGE_SIZE); setHistoryLimit(TASK_LIST_PAGE_SIZE); }} />
          </div>
          {relevantFilters && <Btn ind={ind} onClick={resetFilters} className="justify-self-start">{t('taskListing.clearFilters', 'Clear filters')}</Btn>}
        </div>

        {!fetchError && !taskDataReady && (
          <p role="status" style={caption}>{unlinkedViewer ? t('taskListing.unlinkedViewer', 'This sign-in is not linked to an employee record.') : t('common.fetching', 'Fetching')}</p>
        )}
        {taskDataReady && unlinkedViewer && (
          <p role="status" style={caption}>{t('taskListing.unlinkedViewer', 'This sign-in is not linked to an employee record.')}</p>
        )}
        {taskDataReady && !unlinkedViewer && <>
          {!historyOnly && (
            <section aria-labelledby="tasks-open-heading" className="min-w-0">
              <h2 id="tasks-open-heading" style={{ ...figure(18, ind.ink), margin: '0 0 6px' }}>
                {t('taskListing.segAllOpen', 'All open')} · {openRows.length.toLocaleString()}
              </h2>
              <Blueprint ind={ind} style={{ padding: 0, minWidth: 0 }}>
                {openRows.length ? renderTaskRows(openRows, openLimit, setOpenLimit) : (
                  <p role="status" className="px-4 py-5" style={caption}>
                    {relevantFilters && scopeHasOpen ? t('taskListing.noFilteredOpen', 'No open tasks match these filters.')
                      : historyRows.length ? t('taskListing.caughtUp', 'No open tasks. View task history below.')
                        : t('taskListing.noOpenTasks', 'No open tasks.')}
                  </p>
                )}
              </Blueprint>
            </section>
          )}
          <section aria-label={t('taskListing.taskHistory', 'Task history')} className="min-w-0" style={{ border: `1px solid ${ind.hairline}` }}>
            <button type="button" aria-expanded={showHistory} aria-controls="task-list-history" onClick={() => setHistoryExpanded(!showHistory)}
              className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left focus-visible:outline-2 focus-visible:outline-offset-2" style={{ background: ind.chrome }}>
              <span style={figure(17, ind.ink)}>{t('taskListing.taskHistory', 'Task history')} · {historyRows.length.toLocaleString()}</span>
              <ChevronDown size={16} aria-hidden="true" style={{ transform: showHistory ? 'rotate(180deg)' : undefined }} />
            </button>
            <div id="task-list-history" hidden={!showHistory}>
              {showHistory && (historyRows.length ? renderTaskRows(historyRows, historyLimit, setHistoryLimit) : (
                <p className="px-4 py-4" style={caption}>{t('taskListing.emptyHistory', 'No tasks in history match this view.')}</p>
              ))}
            </div>
          </section>
        </>}
      </div>

      {modal && <TaskFormModal ind={ind} t={t} form={form} setForm={setForm} mode={modal.mode} canAssign={canAssign}
        assignable={assignable} employeeLabel={employeeLabel} onClose={() => setModal(null)} onSave={submitForm}
        onDelete={modal.task ? () => removeTask(modal.task) : null} />}
    </div>
  );
};

export default TaskListing;
