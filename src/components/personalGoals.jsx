/**
 * Personal Goals — the person's goals, and nothing else.
 *
 * The list is the screen: title, progress, on track / at risk, due date, and
 * how far the timeline says the goal should have reached. Skill ratings,
 * calibration, and the manager note live on the Performance Reviews sheet.
 *
 * Design system: "Industry" (src/theme/industry.js). Radius is 0 everywhere,
 * cards are outlines with four registration corners, status reads through
 * weight and rule rather than colour.
 */
import _React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  Plus, X, Save, ChevronRight, AlertCircle, Trash2, Edit,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import {
  isDemoMode, getDemoGoalTitle, getDemoGoalDescription, getDemoEmployeeName,
} from '../utils/demoHelper';
import { formatDate } from '../utils/localeFormat.js';
import * as performanceService from '../services/performanceService';
import { useSessionGuard, useAuthenticatedPageRefresh } from '../hooks/useSessionGuard.js';
import { validateAndRefreshSession } from '../utils/sessionHelper.js';
import { DatePicker } from './ui/date-picker.jsx';
import { TranslatedText } from './ui/translated-text.jsx';
import { filterActiveEmployees } from '../utils/employeeStatus.js';
import { FetchElapsedPill } from './ui/fetch-elapsed-pill';
import { useMinWidth } from '../hooks/useMinWidth.js';
import { getIndustry, DISPLAY, BODY, figure } from '../theme/industry.js';
import { useScreenNavigation } from '../hooks/useScreenNavigation.js';
import {
  Blueprint, Bar, Tag, Btn, Kicker, TickerCell, ColumnHeading, MoreMenu,
  LiveClock, FlatListbox,
} from './ui/industry.jsx';

/* ------------------------------------------------------------------ *
 * Screen constants
 * ------------------------------------------------------------------ */

/** How far behind its own timeline a goal falls before it reads AT RISK. */
const AT_RISK_SLIP_PP = 15;

const MONO = "'Barlow Condensed', 'Barlow', ui-monospace, monospace";

/* Which person is a place, not component state — Back, a reload, and a link
   from Performance Reviews all have to land on the same record. */
const PERSONAL_GOALS_NAV = {
  employee: { key: 'employee', fallback: null },
};

/** The live quarter, so "Open this review" lands on the cycle in progress. */
const liveQuarter = (date = new Date()) => {
  const year = date.getFullYear();
  const quarter = Math.floor(date.getMonth() / 3) + 1;
  return `Q${quarter}-${year}`;
};

const performanceReviewsHref = ({ cycle, employee } = {}) => {
  const params = new URLSearchParams();
  if (cycle) params.set('cycle', cycle);
  if (employee) params.set('review', String(employee));
  const query = params.toString();
  return query ? `/task-review?${query}` : '/task-review';
};

const daysBetween = (from, to) => Math.round((to - from) / 86400000);

/** Up to two initials, e.g. "Đỗ Bảo Long" → "ĐL". */
const initialsOf = (name) => {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '—';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

/* ------------------------------------------------------------------ *
 * Personal Goals
 * ------------------------------------------------------------------ */

const PersonalGoals = ({ employees }) => {
  const { t, currentLanguage } = useLanguage();
  const { isDarkMode } = useTheme();
  const { user, checkPermission } = useAuth();
  const navigate = useNavigate();
  const { handleSessionAuthError } = useSessionGuard();

  const ind = getIndustry(isDarkMode);
  const heavyInk = isDarkMode ? ind.accentDeeper : ind.tickerBg;
  const isDesktop = useMinWidth(1024);
  const pagePad = isDesktop ? 24 : 14;

  const canViewAllEmployees = checkPermission('canViewReports');

  const availableEmployees = useMemo(() => {
    const operational = filterActiveEmployees(employees);
    return canViewAllEmployees
      ? operational
      : operational.filter(emp => String(emp.id) === String(user?.employeeId || user?.id));
  }, [employees, canViewAllEmployees, user?.employeeId, user?.id]);

  const [nav, go] = useScreenNavigation(PERSONAL_GOALS_NAV);

  const defaultEmployeeId = user?.employeeId
    ? String(user.employeeId)
    : user?.id
    ? String(user.id)
    : (availableEmployees[0]?.id ? String(availableEmployees[0].id) : null);

  const selfId = String(user?.employeeId || user?.id || '');
  const selectedEmployee = useMemo(() => {
    const requested = nav.employee ? String(nav.employee) : null;
    if (!requested) return defaultEmployeeId;
    if (!canViewAllEmployees) {
      return selfId && requested === selfId ? requested : defaultEmployeeId;
    }
    if (availableEmployees.length === 0) return requested;
    return availableEmployees.some((emp) => String(emp.id) === requested)
      ? requested
      : defaultEmployeeId;
  }, [nav.employee, canViewAllEmployees, selfId, availableEmployees, defaultEmployeeId]);

  useEffect(() => {
    if (!nav.employee) return;
    if (availableEmployees.length === 0) return;
    const requested = String(nav.employee);
    const allowed = canViewAllEmployees
      ? availableEmployees.some((emp) => String(emp.id) === requested)
      : Boolean(selfId) && requested === selfId;
    if (!allowed) go({ employee: null }, { replace: true });
  }, [nav.employee, availableEmployees, canViewAllEmployees, selfId, go]);

  const [showAddGoalModal, setShowAddGoalModal] = useState(false);
  const [showEditGoalModal, setShowEditGoalModal] = useState(false);
  const [showViewGoalModal, setShowViewGoalModal] = useState(false);
  const [viewingGoal, setViewingGoal] = useState(null);
  const [editingGoal, setEditingGoal] = useState(null);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState(null);
  const [goals, setGoals] = useState([]);
  const fetchRequestIdRef = useRef(0);

  const [goalForm, setGoalForm] = useState({
    title: '',
    description: '',
    category: 'general',
    targetDate: '',
    priority: 'medium',
    status: 'pending',
    progressPercentage: 0
  });

  const translateDepartment = (department) => (department ? t(`departments.${department}`, department) : '');
  const translatePosition = (position) => (position ? t(`employeePosition.${position}`, position) : '');

  const fetchGoals = useCallback(async (options = {}) => {
    const { silent = false } = options;
    if (!selectedEmployee) return;
    const requestId = ++fetchRequestIdRef.current;
    if (!silent) { setLoading(true); setFetchError(null); }
    try {
      if (!isDemoMode()) {
        const sessionValidation = await validateAndRefreshSession();
        if (!sessionValidation.success) {
          throw new Error(sessionValidation.error);
        }
      }

      const goalsResult = await performanceService.getAllPerformanceGoals({ employeeId: selectedEmployee });
      if (requestId !== fetchRequestIdRef.current) return;
      if (goalsResult.success) setGoals(goalsResult.data || []);
      else throw new Error(goalsResult.error || 'Failed to load goals');
    } catch (error) {
      console.error('Error fetching goals:', error);
      if (handleSessionAuthError(error, { silent, setFetchError })) return;
      if (!silent) setFetchError(t('errors.loadFailed', 'Failed to load data'));
    } finally {
      if (!silent) setLoading(false);
    }
  }, [selectedEmployee, handleSessionAuthError, t]);

  useEffect(() => {
    fetchGoals();
  }, [fetchGoals]);

  useAuthenticatedPageRefresh(useCallback(
    () => fetchGoals({ silent: true }),
    [fetchGoals]
  ));

  useEffect(() => {
    const handleEscKey = (event) => {
      if (event.key !== 'Escape') return;
      if (showAddGoalModal) setShowAddGoalModal(false);
      else if (showEditGoalModal) { setShowEditGoalModal(false); setEditingGoal(null); }
      else if (showViewGoalModal) { setShowViewGoalModal(false); setViewingGoal(null); }
    };
    document.addEventListener('keydown', handleEscKey);
    return () => document.removeEventListener('keydown', handleEscKey);
  }, [showAddGoalModal, showEditGoalModal, showViewGoalModal]);

  const currentEmployee = availableEmployees.find(emp => String(emp.id) === selectedEmployee) || null;

  const employeeName = currentEmployee
    ? (getDemoEmployeeName(currentEmployee, t) || currentEmployee.name)
    : '—';

  const tenureLabel = useMemo(() => {
    const raw = currentEmployee?.start_date || currentEmployee?.startDate || currentEmployee?.hire_date;
    if (!raw) return null;
    const start = new Date(raw);
    if (Number.isNaN(start.getTime())) return null;
    const now = new Date();
    let months = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth());
    if (now.getDate() < start.getDate()) months -= 1;
    if (months < 0) return null;
    const years = Math.floor(months / 12);
    const rest = months % 12;
    return years > 0
      ? `${years}${t('personalGoals.yearsShort', 'y')} ${rest}${t('personalGoals.monthsShort', 'm')}`
      : `${rest}${t('personalGoals.monthsShort', 'm')}`;
  }, [currentEmployee, t]);

  /**
   * ON TRACK / AT RISK is a calculation, not a stored field: a goal is at risk
   * once it is overdue, or once its progress has slipped behind its timeline.
   */
  const goalRows = useMemo(() => {
    const today = new Date();
    return goals.map((goal) => {
      const progress = Number(goal.progress) || 0;
      const complete = goal.status === 'completed' || goal.status === 'achieved' || progress >= 100;
      const target = goal.target_date ? new Date(goal.target_date) : null;
      const started = goal.created_at ? new Date(goal.created_at) : null;

      let state = 'onTrack';
      let expected = null;
      if (complete) {
        state = 'complete';
      } else if (target && !Number.isNaN(target.getTime()) && today > target) {
        state = 'atRisk';
      } else if (target && started && !Number.isNaN(target.getTime()) && !Number.isNaN(started.getTime()) && target > started) {
        expected = Math.max(0, Math.min(1, (today - started) / (target - started))) * 100;
        if (progress + AT_RISK_SLIP_PP < expected) state = 'atRisk';
      }

      const daysLeft = target && !Number.isNaN(target.getTime()) ? daysBetween(today, target) : null;

      return {
        raw: goal,
        id: goal.id,
        title: isDemoMode() ? getDemoGoalTitle(goal, t) : goal.title,
        description: isDemoMode() ? getDemoGoalDescription(goal, t) : goal.description,
        status: goal.status,
        progress,
        complete,
        state,
        expected,
        targetDate: goal.target_date,
        daysLeft,
        priority: goal.priority,
        category: goal.category,
      };
    });
  }, [goals, t]);

  const openGoals = useMemo(() => goalRows.filter(g => !g.complete), [goalRows]);
  const completedGoals = useMemo(() => goalRows.filter(g => g.complete), [goalRows]);
  const inProgressCount = goalRows.filter(g => !g.complete && g.status !== 'pending').length;
  const atRiskGoals = useMemo(() => goalRows.filter(g => g.state === 'atRisk'), [goalRows]);

  const orderedGoals = useMemo(() => [
    ...openGoals.slice().sort((a, b) => String(a.targetDate || '').localeCompare(String(b.targetDate || ''))),
    ...completedGoals,
  ], [openGoals, completedGoals]);

  const upcomingGoals = useMemo(() => (
    openGoals
      .filter((goal) => goal.targetDate)
      .slice()
      .sort((a, b) => String(a.targetDate).localeCompare(String(b.targetDate)))
  ), [openGoals]);

  const nextDue = upcomingGoals[0]?.targetDate || null;

  const openThisReview = useCallback(() => {
    if (!selectedEmployee) return;
    navigate(performanceReviewsHref({
      cycle: liveQuarter(),
      employee: selectedEmployee,
    }));
  }, [navigate, selectedEmployee]);

  const handleViewGoal = (goal) => {
    setViewingGoal(goal);
    setShowViewGoalModal(true);
  };

  const handleAddGoal = () => {
    setGoalForm({
      title: '', description: '', category: 'general',
      targetDate: '', priority: 'medium', status: 'pending', progressPercentage: 0,
    });
    setShowAddGoalModal(true);
  };

  const handleSubmitGoal = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const result = await performanceService.createPerformanceGoal({
        employeeId: selectedEmployee,
        ...goalForm,
        assignedBy: selectedEmployee
      });

      if (result.success) {
        setShowAddGoalModal(false);
        fetchGoals();
        alert(t('personalGoals.goalCreatedSuccess', 'Goal created successfully!'));
      } else {
        console.error('Failed to create goal:', result.error);
        alert(t('personalGoals.goalCreatedError', 'Failed to create goal'));
      }
    } catch (error) {
      console.error('Error creating goal:', error);
      if (handleSessionAuthError(error)) return;
      alert(t('personalGoals.goalCreatedError', 'Failed to create goal'));
    }
    setLoading(false);
  };

  const handleEditGoal = (goalRow) => {
    const originalGoal = goals.find(g => g.id === goalRow.id);
    if (!originalGoal) return;
    setEditingGoal(originalGoal);
    setGoalForm({
      title: isDemoMode() ? getDemoGoalTitle(originalGoal, t) : originalGoal.title,
      description: isDemoMode() ? getDemoGoalDescription(originalGoal, t) : originalGoal.description,
      category: originalGoal.category,
      targetDate: originalGoal.target_date,
      priority: originalGoal.priority,
      status: originalGoal.status,
      progressPercentage: originalGoal.progress || 0
    });
    setShowEditGoalModal(true);
  };

  const handleUpdateGoal = async (e) => {
    e.preventDefault();
    if (!editingGoal) return;
    setLoading(true);
    try {
      const result = await performanceService.updatePerformanceGoal(editingGoal.id, {
        ...goalForm,
        progressPercentage: goalForm.progressPercentage
      });

      if (result.success) {
        setShowEditGoalModal(false);
        setEditingGoal(null);
        fetchGoals();
        alert(t('personalGoals.goalUpdatedSuccess', 'Goal updated successfully!'));
      } else {
        console.error('Failed to update goal:', result.error);
        alert(t('personalGoals.goalUpdatedError', 'Failed to update goal'));
      }
    } catch (error) {
      console.error('Error updating goal:', error);
      if (handleSessionAuthError(error)) return;
      alert(t('personalGoals.goalUpdatedError', 'Failed to update goal'));
    }
    setLoading(false);
  };

  const handleDeleteGoal = async (goalId) => {
    if (!window.confirm(t('personalGoals.confirmDeleteGoal', 'Are you sure you want to delete this goal?'))) return;

    setLoading(true);
    try {
      const result = await performanceService.deletePerformanceGoal(goalId);
      if (result.success) {
        setShowViewGoalModal(false);
        setViewingGoal(null);
        fetchGoals();
        alert(t('personalGoals.goalDeletedSuccess', 'Goal deleted successfully!'));
      } else {
        console.error('Failed to delete goal:', result.error);
        alert(t('personalGoals.goalDeletedError', 'Failed to delete goal'));
      }
    } catch (error) {
      console.error('Error deleting goal:', error);
      if (handleSessionAuthError(error)) return;
      alert(t('personalGoals.goalDeletedError', 'Failed to delete goal'));
    }
    setLoading(false);
  };

  const hasRealData = goals.length > 0;

  const fieldStyle = {
    width: '100%', padding: '7px 10px', borderRadius: 0,
    border: `1px solid ${ind.hairline}`, background: 'transparent', color: ind.ink,
    fontFamily: BODY, fontSize: 13, outline: 'none',
  };

  const stateLabel = {
    onTrack: t('personalGoals.onTrack', 'On track'),
    atRisk: t('personalGoals.atRisk', 'At risk'),
    complete: t('personalGoals.complete', 'Complete'),
  };

  const goalMeta = (goal) => [
    goal.targetDate
      ? `${goal.complete ? t('personalGoals.closed', 'Closed') : t('personalGoals.due', 'Due')} ${formatDate(goal.targetDate, currentLanguage)}`
      : null,
    !goal.complete && goal.daysLeft != null
      ? (goal.daysLeft < 0
          ? t('personalGoals.overdueDays', '{n} days overdue').replace('{n}', String(Math.abs(goal.daysLeft)))
          : t('personalGoals.daysLeft', '{n} days left').replace('{n}', String(goal.daysLeft)))
      : null,
    !goal.complete && goal.expected != null
      ? t('personalGoals.expectedBy', 'timeline says {n}%').replace('{n}', String(Math.round(goal.expected)))
      : null,
  ].filter(Boolean).join(' · ');

  const renderGoalRow = (goal, index) => {
    const atRisk = goal.state === 'atRisk';
    const fill = goal.complete ? ind.ramp[3] : atRisk ? heavyInk : ind.accent;
    const meta = goalMeta(goal);

    return (
      <button
        key={goal.id}
        type="button"
        onClick={() => handleViewGoal(goal)}
        className="w-full"
        style={{
          display: 'flex', alignItems: 'flex-start', gap: 14, textAlign: 'left',
          padding: '13px 20px', cursor: 'pointer', background: 'transparent',
          border: 'none', borderTop: index === 0 ? 'none' : `1px solid ${ind.rule}`,
          opacity: goal.complete ? 0.62 : 1,
        }}
      >
        <span
          aria-hidden="true"
          style={{
            fontFamily: MONO, fontWeight: 600, fontSize: 13, letterSpacing: '.06em',
            color: ind.accent, flex: 'none', width: 20, paddingTop: 1,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {String(index + 1).padStart(2, '0')}
        </span>

        <span style={{ flex: 1, minWidth: 0 }}>
          <span
            style={{
              display: 'block', fontFamily: BODY, fontSize: 13.5, color: ind.ink,
              textDecoration: goal.complete ? 'line-through' : 'none',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}
          >
            <TranslatedText text={goal.title} record={{ entityType: 'goal', entityId: goal.id, field: 'title' }} />
          </span>
          <span
            style={{
              display: 'block', fontFamily: BODY, fontSize: 11.5, color: ind.inkMuted,
              marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}
          >
            {meta}
            {meta && goal.description ? ' · ' : null}
            {goal.description && (
              <TranslatedText
                text={goal.description}
                record={{ entityType: 'goal', entityId: goal.id, field: 'description' }}
              />
            )}
          </span>
        </span>

        <span style={{ flex: 'none', width: isDesktop ? 150 : 96, minWidth: 0 }}>
          <span style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
            <span style={figure(14, ind.ink)}>
              {goal.complete ? '' : `${Math.round(goal.progress)}%`}
            </span>
            <span
              style={{
                fontFamily: DISPLAY, fontWeight: 600, fontSize: 10.5, letterSpacing: '.12em',
                textTransform: 'uppercase',
                color: atRisk ? ind.accentDeep : ind.inkMuted,
              }}
            >
              {stateLabel[goal.state]}
            </span>
          </span>
          <span style={{ display: 'block', marginTop: 6 }}>
            <Bar ind={ind} value={goal.complete ? 1 : goal.progress / 100} fill={fill} height={7} />
          </span>
        </span>

        <ChevronRight size={15} strokeWidth={1.5} style={{ flex: 'none', color: ind.inkMuted, marginTop: 3 }} />
      </button>
    );
  };

  const renderPlateGoal = (goal) => (
    <button
      key={goal.id}
      type="button"
      onClick={() => handleViewGoal(goal)}
      className="w-full"
      style={{
        display: 'block', textAlign: 'left', padding: '10px 0', cursor: 'pointer',
        background: 'transparent', border: 'none', borderTop: `1px solid ${ind.rule}`,
      }}
    >
      <span style={{ display: 'block', fontFamily: BODY, fontSize: 13, color: ind.ink }}>
        <TranslatedText text={goal.title} record={{ entityType: 'goal', entityId: goal.id, field: 'title' }} />
      </span>
      <span style={{ display: 'block', fontFamily: BODY, fontSize: 11.5, color: ind.inkMuted, marginTop: 3 }}>
        {goalMeta(goal)}
      </span>
    </button>
  );

  return (
    <div
      style={{
        border: `1px solid ${ind.hairline}`,
        background: ind.ground,
        color: ind.ink,
        fontFamily: BODY,
        fontSize: 14,
        borderRadius: 0,
      }}
    >
      <div
        style={{
          height: 44,
          background: ind.tickerBg,
          color: ind.tickerInk,
          borderBottom: `1px solid ${ind.hairline}`,
          display: 'flex',
          alignItems: 'stretch',
          overflowX: 'auto',
          overflowY: 'hidden',
        }}
      >
        <TickerCell ind={ind}>
          <LiveClock ind={ind} live={hasRealData} />
        </TickerCell>
        <TickerCell
          ind={ind}
          label={t('personalGoals.inProgress', 'In progress')}
          value={inProgressCount}
        />
        <TickerCell
          ind={ind}
          label={t('personalGoals.goalsCompleted', 'Completed')}
          value={`${completedGoals.length}/${goalRows.length}`}
        />
        <TickerCell
          ind={ind}
          label={t('personalGoals.atRisk', 'At risk')}
          value={atRiskGoals.length}
        />
        <TickerCell
          ind={ind}
          label={t('personalGoals.nextDue', 'Next due')}
          value={nextDue ? formatDate(nextDue, currentLanguage, { day: '2-digit', month: 'short' }) : '—'}
        />

        <div
          style={{
            flex: 1,
            minWidth: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: 8,
            padding: '0 14px',
            borderLeft: `1px solid ${ind.tickerRule}`,
          }}
        >
          <FetchElapsedPill active={loading} isDarkMode label={t('common.fetching', 'Fetching')} />
          {canViewAllEmployees && availableEmployees.length > 1 && (
            <FlatListbox
              ind={ind}
              onDark
              value={selectedEmployee || ''}
              onChange={(e) => go({ employee: String(e.target.value) })}
              aria-label={t('personalGoals.employee', 'Employee')}
              style={{ maxWidth: 190 }}
            >
              {availableEmployees.map(employee => (
                <option key={employee.id} value={String(employee.id)} style={{ color: '#1d1f20' }}>
                  {getDemoEmployeeName(employee, t) || employee.name}
                </option>
              ))}
            </FlatListbox>
          )}
        </div>
      </div>

      <div className="flex flex-col lg:flex-row items-stretch">
        <div
          className="flex-1 min-w-0 flex flex-col"
          style={{ padding: pagePad, gap: 18, borderRight: `1px solid ${ind.hairline}` }}
        >
          {fetchError && (
            <div style={{ border: `1px solid ${ind.ink}`, padding: '12px 14px', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <AlertCircle size={16} strokeWidth={1.5} style={{ flex: 'none', marginTop: 2, color: ind.ink }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <Kicker ind={ind} color={ind.ink}>{t('common.error', 'Error')}</Kicker>
                <p style={{ fontFamily: BODY, fontSize: 13, color: ind.inkMuted, marginTop: 4 }}>{fetchError}</p>
                <button
                  type="button"
                  onClick={() => { setFetchError(null); fetchGoals(); }}
                  style={{
                    marginTop: 8, background: 'none', border: 'none', padding: 0, cursor: 'pointer',
                    fontFamily: DISPLAY, fontWeight: 600, fontSize: 11.5, letterSpacing: '.08em',
                    textTransform: 'uppercase', color: ind.accentDeep, textDecoration: 'underline',
                  }}
                >
                  {t('common.retry', 'Try Again')}
                </button>
              </div>
              <button
                type="button"
                onClick={() => setFetchError(null)}
                aria-label={t('common.close', 'Close')}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: ind.inkMuted, padding: 0, flex: 'none' }}
              >
                <X size={15} strokeWidth={1.5} />
              </button>
            </div>
          )}

          <div className="flex flex-wrap items-start justify-between gap-4">
            <div style={{ display: 'flex', gap: 16, minWidth: 0 }}>
              <div
                aria-hidden="true"
                style={{
                  width: 52, height: 52, flex: 'none', borderRadius: 0,
                  border: `1px solid ${ind.hairline}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  overflow: 'hidden',
                }}
              >
                {currentEmployee?.photo ? (
                  <img src={currentEmployee.photo} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <span style={{ ...figure(20, ind.accent), letterSpacing: '.04em' }}>{initialsOf(employeeName)}</span>
                )}
              </div>
              <div style={{ minWidth: 0 }}>
                <h1
                  style={{
                    fontFamily: DISPLAY, fontWeight: 600, fontSize: 30, lineHeight: 1.05,
                    letterSpacing: '.02em', textTransform: 'uppercase', color: ind.ink, margin: 0,
                  }}
                >
                  {employeeName}
                </h1>
                <p style={{ fontFamily: BODY, fontSize: 13, color: ind.inkMuted, marginTop: 6 }}>
                  {[
                    translatePosition(currentEmployee?.position),
                    translateDepartment(currentEmployee?.department),
                    tenureLabel ? `${t('personalGoals.withCompany', 'with the company')} ${tenureLabel}` : null,
                  ].filter(Boolean).join(' · ')}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3" style={{ minWidth: 0, maxWidth: '100%' }}>
              <Btn ind={ind} onClick={handleAddGoal} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <Plus size={13} strokeWidth={1.5} />
                {t('personalGoals.addGoal', 'Add goal')}
              </Btn>
              {isDesktop ? (
                <Btn
                  ind={ind}
                  onClick={openThisReview}
                  disabled={!selectedEmployee}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                >
                  {t('personalGoals.openPerformanceReviews', 'Open Performance Reviews')}
                  <ChevronRight size={13} strokeWidth={1.5} />
                </Btn>
              ) : (
                <MoreMenu
                  ind={ind}
                  label={t('header.moreOptions', 'More options')}
                  items={[
                    {
                      key: 'review',
                      label: t('personalGoals.openPerformanceReviews', 'Open Performance Reviews'),
                      icon: ChevronRight,
                      onClick: openThisReview,
                    },
                  ]}
                />
              )}
            </div>
          </div>

          <Blueprint ind={ind}>
            <div style={{ padding: '14px 20px', borderBottom: `1px solid ${ind.hairline}` }}>
              <Kicker ind={ind}>{t('personalGoals.currentGoals', 'Current goals')}</Kicker>
              <p style={{ fontFamily: BODY, fontSize: 12.5, color: ind.inkMuted, marginTop: 6 }}>
                {`${inProgressCount} ${t('personalGoals.inProgressLower', 'in progress')} · ${completedGoals.length} ${t('personalGoals.completedThisYear', 'completed')}`}
              </p>
            </div>
            <div>
              {orderedGoals.length === 0 && (
                <p style={{ fontFamily: BODY, fontSize: 13, color: ind.inkMuted, padding: '18px 20px' }}>
                  {loading ? t('common.loading', 'Loading…') : t('personalGoals.noGoals', 'No goals for this employee yet.')}
                </p>
              )}
              {orderedGoals.map(renderGoalRow)}
            </div>
          </Blueprint>
        </div>

        <aside
          className="w-full lg:w-[372px] lg:shrink-0 flex flex-col"
          style={{ background: ind.chrome }}
        >
          <div style={{ padding: '20px 20px 22px', borderBottom: `1px solid ${ind.hairline}` }}>
            <ColumnHeading ind={ind}>{t('personalGoals.upcomingDeadlines', 'Upcoming deadlines')}</ColumnHeading>
            {upcomingGoals.length === 0 && (
              <p style={{ fontFamily: BODY, fontSize: 12.5, color: ind.inkMuted, marginTop: 12 }}>
                {t('personalGoals.noUpcomingDeadlines', 'No open goals with a due date.')}
              </p>
            )}
            <div style={{ marginTop: 8 }}>
              {upcomingGoals.map(renderPlateGoal)}
            </div>
          </div>

          <div style={{ padding: '20px 20px 24px' }}>
            <ColumnHeading ind={ind} style={{ fontSize: 13 }}>
              {t('personalGoals.atRiskGoals', 'At risk')}
            </ColumnHeading>
            {atRiskGoals.length === 0 && (
              <p style={{ fontFamily: BODY, fontSize: 12.5, color: ind.inkMuted, marginTop: 12 }}>
                {t('personalGoals.noAtRiskGoals', 'No goals are behind their timeline.')}
              </p>
            )}
            <div style={{ marginTop: 8 }}>
              {atRiskGoals.map(renderPlateGoal)}
            </div>
          </div>
        </aside>
      </div>

      {showAddGoalModal && (
        <GoalFormModal
          ind={ind}
          t={t}
          title={t('personalGoals.addNewGoal', 'Add new goal')}
          form={goalForm}
          setForm={setGoalForm}
          loading={loading}
          onSubmit={handleSubmitGoal}
          onClose={() => setShowAddGoalModal(false)}
          fieldStyle={fieldStyle}
          submitLabel={loading ? t('common.saving', 'Saving…') : t('common.save', 'Save')}
        />
      )}

      {showEditGoalModal && (
        <GoalFormModal
          ind={ind}
          t={t}
          title={t('personalGoals.editGoal', 'Edit goal')}
          form={goalForm}
          setForm={setGoalForm}
          loading={loading}
          onSubmit={handleUpdateGoal}
          onClose={() => { setShowEditGoalModal(false); setEditingGoal(null); }}
          fieldStyle={fieldStyle}
          submitLabel={loading ? t('common.updating', 'Updating…') : t('common.update', 'Update')}
          showProgress
        />
      )}

      {showViewGoalModal && viewingGoal && (
        <div
          className="fixed inset-0 flex items-center justify-center z-50 p-4 overflow-y-auto"
          style={{ background: 'rgba(29,31,32,.55)' }}
          onClick={(e) => {
            if (e.target === e.currentTarget) { setShowViewGoalModal(false); setViewingGoal(null); }
          }}
        >
          <div style={{ background: ind.ground, border: `1px solid ${ind.ink}`, borderRadius: 0, width: '100%', maxWidth: 560 }}>
            <div
              className="flex items-start justify-between"
              style={{ gap: 12, padding: '18px 20px', borderBottom: `1px solid ${ind.hairline}` }}
            >
              <ColumnHeading ind={ind}>{t('personalGoals.goalDetails', 'Goal details')}</ColumnHeading>
              <button
                type="button"
                onClick={() => { setShowViewGoalModal(false); setViewingGoal(null); }}
                aria-label={t('common.close', 'Close')}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: ind.inkMuted, padding: 0 }}
              >
                <X size={16} strokeWidth={1.5} />
              </button>
            </div>

            <div style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <h3 style={{
                  fontFamily: DISPLAY, fontWeight: 600, fontSize: 20, letterSpacing: '.02em',
                  textTransform: 'uppercase', color: ind.ink, margin: 0,
                  textDecoration: viewingGoal.complete ? 'line-through' : 'none',
                }}>
                  <TranslatedText
                    text={viewingGoal.title}
                    record={{ entityType: 'goal', entityId: viewingGoal.id, field: 'title' }}
                  />
                </h3>
                <div style={{ marginTop: 8 }}>
                  <Tag ind={ind} variant={viewingGoal.state === 'atRisk' ? 'outline' : viewingGoal.complete ? 'neutral' : 'accent'}>
                    {stateLabel[viewingGoal.state]}
                  </Tag>
                </div>
              </div>

              <div>
                <Kicker ind={ind} color={ind.inkMuted}>{t('personalGoals.goalDescription', 'Description')}</Kicker>
                <p style={{ fontFamily: BODY, fontSize: 13, color: ind.inkMuted, marginTop: 6, whiteSpace: 'pre-wrap', lineHeight: 1.55 }}>
                  {viewingGoal.description
                    ? <TranslatedText
                        text={viewingGoal.description}
                        record={{ entityType: 'goal', entityId: viewingGoal.id, field: 'description' }}
                      />
                    : t('common.noDescription', 'No description available')}
                </p>
              </div>

              <div className="grid grid-cols-2" style={{ gap: 16 }}>
                <div>
                  <Kicker ind={ind} color={ind.inkMuted}>{t('personalGoals.category', 'Category')}</Kicker>
                  <p style={{ fontFamily: BODY, fontSize: 13, color: ind.ink, marginTop: 5 }}>
                    {t(
                      `personalGoals.${viewingGoal.category === 'professional_development' ? 'professionalDevelopment' : viewingGoal.category}`,
                      viewingGoal.category || '—'
                    )}
                  </p>
                </div>
                <div>
                  <Kicker ind={ind} color={ind.inkMuted}>{t('personalGoals.priority', 'Priority')}</Kicker>
                  <p style={{ fontFamily: BODY, fontSize: 13, color: ind.ink, marginTop: 5 }}>
                    {t(`personalGoals.${viewingGoal.priority}`, viewingGoal.priority || '—')}
                  </p>
                </div>
                <div>
                  <Kicker ind={ind} color={ind.inkMuted}>{t('personalGoals.deadline', 'Deadline')}</Kicker>
                  <p style={{ fontFamily: BODY, fontSize: 13, color: ind.ink, marginTop: 5 }}>
                    {viewingGoal.targetDate ? formatDate(viewingGoal.targetDate, currentLanguage) : '—'}
                  </p>
                </div>
                <div>
                  <Kicker ind={ind} color={ind.inkMuted}>{t('personalGoals.progress', 'Progress')}</Kicker>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 7 }}>
                    <div style={{ flex: 1 }}>
                      <Bar
                        ind={ind}
                        value={viewingGoal.complete ? 1 : viewingGoal.progress / 100}
                        fill={viewingGoal.complete ? ind.ramp[3] : viewingGoal.state === 'atRisk' ? heavyInk : ind.accent}
                        height={7}
                      />
                    </div>
                    <span style={{ ...figure(13, ind.ink), width: 34, textAlign: 'right' }}>
                      {Math.round(viewingGoal.progress)}%
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div
              className="flex flex-wrap items-center justify-between"
              style={{ gap: 10, padding: '14px 20px', borderTop: `1px solid ${ind.hairline}` }}
            >
              <Btn
                ind={ind}
                onClick={() => handleDeleteGoal(viewingGoal.id)}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
              >
                <Trash2 size={13} strokeWidth={1.5} />
                {t('common.delete', 'Delete')}
              </Btn>
              <div style={{ display: 'flex', gap: 10 }}>
                <Btn
                  ind={ind}
                  onClick={() => {
                    setShowViewGoalModal(false);
                    handleEditGoal(viewingGoal);
                  }}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                >
                  <Edit size={13} strokeWidth={1.5} />
                  {t('common.edit', 'Edit')}
                </Btn>
                <Btn ind={ind} variant="primary" onClick={() => { setShowViewGoalModal(false); setViewingGoal(null); }}>
                  {t('common.close', 'Close')}
                </Btn>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

function GoalFormModal({ ind, t, title, form, setForm, loading, onSubmit, onClose, fieldStyle, submitLabel, showProgress = false }) {
  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-50 p-4 overflow-y-auto"
      style={{ background: 'rgba(29,31,32,.55)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ background: ind.ground, border: `1px solid ${ind.ink}`, borderRadius: 0, width: '100%', maxWidth: 620 }}>
        <div
          className="flex items-start justify-between"
          style={{ gap: 12, padding: '18px 20px', borderBottom: `1px solid ${ind.hairline}` }}
        >
          <ColumnHeading ind={ind}>{title}</ColumnHeading>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('common.close', 'Close')}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: ind.inkMuted, padding: 0 }}
          >
            <X size={16} strokeWidth={1.5} />
          </button>
        </div>

        <form onSubmit={onSubmit}>
          <div style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <Kicker ind={ind} color={ind.inkMuted}>{t('personalGoals.goalTitle', 'Goal title')}</Kicker>
              <input
                type="text"
                required
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder={t('personalGoals.goalTitlePlaceholder', 'Enter goal title')}
                style={{ ...fieldStyle, marginTop: 6 }}
              />
            </div>

            <div>
              <Kicker ind={ind} color={ind.inkMuted}>{t('personalGoals.goalDescription', 'Description')}</Kicker>
              <textarea
                rows="3"
                value={form.description || ''}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder={t('personalGoals.goalDescriptionPlaceholder', 'Describe the goal objectives')}
                style={{ ...fieldStyle, marginTop: 6, resize: 'vertical' }}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2" style={{ gap: 14 }}>
              <div>
                <Kicker ind={ind} color={ind.inkMuted}>{t('personalGoals.category', 'Category')}</Kicker>
                <FlatListbox
                  ind={ind}
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  aria-label={t('personalGoals.category', 'Category')}
                  style={{ ...fieldStyle, marginTop: 6, cursor: 'pointer', textTransform: 'none', letterSpacing: '.02em' }}
                >
                  <option value="general">{t('personalGoals.general', 'General')}</option>
                  <option value="technical">{t('personalGoals.technical', 'Technical')}</option>
                  <option value="leadership">{t('personalGoals.leadership', 'Leadership')}</option>
                  <option value="project">{t('personalGoals.project', 'Project')}</option>
                  <option value="professional_development">{t('personalGoals.professionalDevelopment', 'Professional Development')}</option>
                </FlatListbox>
              </div>

              <div>
                <Kicker ind={ind} color={ind.inkMuted}>{t('personalGoals.priority', 'Priority')}</Kicker>
                <FlatListbox
                  ind={ind}
                  value={form.priority}
                  onChange={(e) => setForm({ ...form, priority: e.target.value })}
                  aria-label={t('personalGoals.priority', 'Priority')}
                  style={{ ...fieldStyle, marginTop: 6, cursor: 'pointer', textTransform: 'none', letterSpacing: '.02em' }}
                >
                  <option value="low">{t('personalGoals.low', 'Low')}</option>
                  <option value="medium">{t('personalGoals.medium', 'Medium')}</option>
                  <option value="high">{t('personalGoals.high', 'High')}</option>
                  <option value="critical">{t('personalGoals.critical', 'Critical')}</option>
                </FlatListbox>
              </div>

              <div>
                <Kicker ind={ind} color={ind.inkMuted}>{t('personalGoals.targetDate', 'Target date')}</Kicker>
                <DatePicker
                  flat
                  value={form.targetDate || ''}
                  onChange={(e) => setForm({ ...form, targetDate: e.target.value })}
                />
              </div>

              <div>
                <Kicker ind={ind} color={ind.inkMuted}>{t('personalGoals.status', 'Status')}</Kicker>
                <FlatListbox
                  ind={ind}
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value })}
                  aria-label={t('personalGoals.status', 'Status')}
                  style={{ ...fieldStyle, marginTop: 6, cursor: 'pointer', textTransform: 'none', letterSpacing: '.02em' }}
                >
                  <option value="pending">{t('personalGoals.pending', 'Pending')}</option>
                  <option value="in_progress">{t('personalGoals.inProgress', 'In Progress')}</option>
                  <option value="completed">{t('personalGoals.completed', 'Completed')}</option>
                  <option value="cancelled">{t('personalGoals.cancelled', 'Cancelled')}</option>
                  <option value="on_hold">{t('personalGoals.onHold', 'On Hold')}</option>
                </FlatListbox>
              </div>
            </div>

            {showProgress && (
              <div>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
                  <Kicker ind={ind} color={ind.inkMuted}>{t('personalGoals.progress', 'Progress')}</Kicker>
                  <span style={figure(15, ind.ink)}>{Math.round(Number(form.progressPercentage) || 0)}%</span>
                </div>
                {(() => {
                  const pct = Math.max(0, Math.min(100, Number(form.progressPercentage) || 0));
                  const track = ind.dark ? 'rgba(233,235,237,.14)' : 'rgba(29,31,32,.12)';
                  return (
                    <input
                      className="industry-range"
                      type="range"
                      min="0"
                      max="100"
                      step="1"
                      value={pct}
                      onChange={(e) => setForm({ ...form, progressPercentage: Number(e.target.value) })}
                      aria-label={t('personalGoals.progress', 'Progress')}
                      style={{
                        width: '100%',
                        marginTop: 8,
                        cursor: 'pointer',
                        '--ind-accent': ind.accent,
                        background: `linear-gradient(to right, ${ind.accent} 0%, ${ind.accent} ${pct}%, ${track} ${pct}%, ${track} 100%)`,
                      }}
                    />
                  );
                })()}
              </div>
            )}
          </div>

          <div
            className="flex justify-end"
            style={{ gap: 10, padding: '14px 20px', borderTop: `1px solid ${ind.hairline}` }}
          >
            <Btn ind={ind} onClick={onClose}>{t('common.cancel', 'Cancel')}</Btn>
            <button
              type="submit"
              disabled={loading}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '4px 12px', borderRadius: 0,
                cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.5 : 1,
                background: ind.accent, color: ind.accentInk, border: `1px solid ${ind.accent}`,
                fontFamily: DISPLAY, fontWeight: 600, fontSize: 12.5, letterSpacing: '.04em',
                textTransform: 'uppercase',
              }}
            >
              <Save size={13} strokeWidth={1.5} />
              {submitLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default PersonalGoals;
