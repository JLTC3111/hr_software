/**
 * Personal Goals — direction 2c, "Calibrated assessment".
 *
 * Three vertical bands, the same grammar as the rest of the console: the app
 * rail (sidebar.jsx) → this main column → a 372px column of three stacked
 * plates, with a 44px steel ticker spanning both.
 *
 * The central idea of this screen: a self-rating on its own says nothing. Every
 * skill row therefore carries three marks on one track — the person's own
 * rating as a fill, the manager's as a tick that overshoots the track, and the
 * company median as a faint interior hairline — so the gap between how someone
 * sees themselves and how they are seen is the thing you actually read. The
 * footer states that read in words.
 *
 * Design system: "Industry" (src/theme/industry.js). Radius is 0 everywhere,
 * cards are outlines with four registration corners, status reads through
 * weight and rule rather than colour.
 */
import _React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  Plus, X, Save, ChevronRight, Download, AlertCircle, Trash2, Edit,
} from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import {
  isDemoMode, getDemoGoalTitle, getDemoGoalDescription, getDemoSkills,
  getDemoReviewStrengths, getDemoReviewAreasForImprovement, getDemoEmployeeName,
} from '../utils/demoHelper';
import { formatDate, localeTag } from '../utils/localeFormat.js';
import * as performanceService from '../services/performanceService';
import { useSessionGuard, useAuthenticatedPageRefresh } from '../hooks/useSessionGuard.js';
import { validateAndRefreshSession } from '../utils/sessionHelper.js';
import { DatePicker } from './ui/date-picker.jsx';
import { TranslatedText } from './ui/translated-text.jsx';
import { filterActiveEmployees } from '../utils/employeeStatus.js';
import { FetchElapsedPill } from './ui/fetch-elapsed-pill';
import { useMinWidth } from '../hooks/useMinWidth.js';
import {
  PERFORMANCE_SKILLS,
  buildPerformanceAssessment,
  mergeReviewRatingsIntoSkills,
  medianOf,
} from '../utils/performanceAssessment.js';
import { getIndustry, DISPLAY, BODY, figure } from '../theme/industry.js';
import {
  Blueprint, Bar, Tag, Btn, Seg, Kicker, TickerCell, ColumnHeading, MoreMenu,
  LiveClock, FlatSelect,
} from './ui/industry.jsx';

/* ------------------------------------------------------------------ *
 * Screen constants — the policy this screen reads against
 * ------------------------------------------------------------------ */

/**
 * A quarter's review closes on the 15th of the quarter's middle month, so the
 * cycle runs inside the quarter it assesses rather than trailing it.
 */
const REVIEW_CLOSE_DAY = 15;
/** Below this the fill drops to light steel — the score that needs a sentence. */
const STRONG_RATING = 4;
/** Self and manager have to differ by this much before it is worth discussing. */
const GAP_THRESHOLD = 0.4;
/** How far behind its own timeline a goal falls before it reads AT RISK. */
const AT_RISK_SLIP_PP = 15;
/** Quarters plotted in the rating history. */
const HISTORY_QUARTERS = 5;
/** Marks the employee's one-click acknowledgement inside employee_comments. */
const ACK_MARKER = '[acknowledged]';

const MONO = "'Barlow Condensed', 'Barlow', ui-monospace, monospace";

/* ------------------------------------------------------------------ *
 * Helpers
 * ------------------------------------------------------------------ */

/** 'Q3-2026' → { quarter: 3, year: 2026 }. */
const parsePeriod = (period) => {
  const match = /^Q([1-4])-(\d{4})$/.exec(String(period || ''));
  if (!match) return null;
  return { quarter: Number(match[1]), year: Number(match[2]) };
};

const formatPeriod = (quarter, year) => `Q${quarter}-${year}`;

/** The `n` quarters ending at `period`, oldest first. */
const quartersEndingAt = (period, n) => {
  const parsed = parsePeriod(period);
  if (!parsed) return [];
  const out = [];
  let { quarter, year } = parsed;
  for (let i = 0; i < n; i += 1) {
    out.unshift({ quarter, year, key: formatPeriod(quarter, year) });
    quarter -= 1;
    if (quarter === 0) { quarter = 4; year -= 1; }
  }
  return out;
};

/** Deadline for the period's review — 15th of its middle month. */
const reviewCloseDate = (period) => {
  const parsed = parsePeriod(period);
  if (!parsed) return null;
  const middleMonth = (parsed.quarter - 1) * 3 + 1; // 0-indexed: Feb, May, Aug, Nov
  return new Date(parsed.year, middleMonth, REVIEW_CLOSE_DAY);
};

const daysBetween = (from, to) => Math.round((to - from) / 86400000);

/** Up to two initials, e.g. "Đỗ Bảo Long" → "ĐL". */
const initialsOf = (name) => {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '—';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

const round1 = (n) => Math.round((Number(n) || 0) * 10) / 10;
const fmt1 = (n) => round1(n).toFixed(1);

const csvCell = (value) => {
  const text = value == null ? '' : String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

/* ------------------------------------------------------------------ *
 * Small pieces
 * ------------------------------------------------------------------ */

/**
 * One calibrated skill row. The track carries three marks at once:
 *   - a solid fill for the self-rating (light steel when it is below 4)
 *   - a dark-steel tick, overshooting the track, for the manager's rating
 *   - a faint interior hairline for the company median
 * Manager left of the fill means the person over-rated themselves; right of it,
 * under-rated.
 */
function SkillMeter({ ind, heavyInk, self, manager, median }) {
  const pct = (value) => `${Math.max(0, Math.min(5, Number(value) || 0)) / 5 * 100}%`;
  const strong = self >= STRONG_RATING;
  return (
    <div style={{ position: 'relative', height: 10, border: `1px solid ${ind.hairline}`, borderRadius: 0 }}>
      <div
        style={{
          width: pct(self),
          height: '100%',
          background: strong ? ind.accent : ind.ramp[1],
          transition: 'width .35s ease',
        }}
      />
      {median != null && (
        <span
          aria-hidden="true"
          style={{
            position: 'absolute', top: 2, bottom: 2, left: pct(median),
            width: 1, background: ind.inkFaint,
          }}
        />
      )}
      {manager != null && (
        <span
          aria-hidden="true"
          style={{
            position: 'absolute', top: -4, bottom: -4, left: pct(manager),
            width: 2, marginLeft: -1, background: heavyInk,
          }}
        />
      )}
    </div>
  );
}

/** One node of the review-cycle timeline. */
function CycleStep({ ind, state, title, meta, last }) {
  const done = state === 'done';
  const current = state === 'current';
  return (
    <div style={{ display: 'flex', gap: 10 }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 'none', width: 9 }}>
        <span
          aria-hidden="true"
          style={{
            width: 9, height: 9, flex: 'none',
            background: done ? ind.accent : 'transparent',
            border: `1px solid ${done || current ? ind.accent : ind.inkFaint}`,
          }}
        />
        {!last && <span aria-hidden="true" style={{ width: 1, flex: 1, minHeight: 22, background: ind.rule }} />}
      </div>
      <div style={{ minWidth: 0, paddingBottom: last ? 0 : 12 }}>
        <div
          style={{
            fontFamily: BODY,
            fontSize: 13,
            fontWeight: current ? 600 : 400,
            color: current || done ? ind.ink : ind.inkMuted,
          }}
        >
          {title}
        </div>
        {meta && (
          <div style={{ fontFamily: BODY, fontSize: 11.5, color: ind.inkMuted, marginTop: 2 }}>{meta}</div>
        )}
      </div>
    </div>
  );
}

/**
 * Quarterly overall rating as a hand-drawn line: accent stroke, open square
 * markers. Recharts is overkill for five points and would not give the open
 * marker the rest of the system uses.
 */
function RatingSpark({ ind, points, emptyLabel, selfLabel = 'self-rated' }) {
  const W = 320;
  const H = 96;
  const PAD_X = 10;
  const PAD_Y = 12;

  const rated = points.filter((p) => p.value != null);
  if (rated.length === 0) {
    return (
      <p style={{ fontFamily: BODY, fontSize: 12.5, color: ind.inkMuted, padding: '12px 0' }}>{emptyLabel}</p>
    );
  }

  const values = rated.map((p) => p.value);
  const rawMin = Math.min(...values);
  const rawMax = Math.max(...values);
  // Pad the domain so a flat-ish run still reads as a line rather than a rule.
  const min = Math.max(0, rawMin - (rawMax - rawMin < 0.5 ? 0.5 : 0.3));
  const max = Math.min(5, rawMax + (rawMax - rawMin < 0.5 ? 0.5 : 0.3));
  const span = max - min || 1;

  const step = points.length > 1 ? (W - PAD_X * 2) / (points.length - 1) : 0;
  const xy = points.map((p, i) => ({
    ...p,
    x: PAD_X + step * i,
    y: p.value == null ? null : PAD_Y + (1 - (p.value - min) / span) * (H - PAD_Y * 2),
  }));

  const path = xy
    .filter((p) => p.y != null)
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`)
    .join(' ');

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} role="img" aria-label={emptyLabel}>
        <path d={path} fill="none" stroke={ind.accent} strokeWidth={1.5} />
        {xy.filter((p) => p.y != null).map((p) => (
          <rect
            key={p.key}
            x={p.x - 3.5}
            y={p.y - 3.5}
            width={7}
            height={7}
            // Open square for a calibrated review, filled for a quarter the
            // employee logged themselves.
            fill={p.selfOnly ? ind.accent : ind.chrome}
            stroke={ind.accent}
            strokeWidth={1.5}
          >
            <title>{`${p.label} · ${fmt1(p.value)}${p.selfOnly ? ` · ${selfLabel}` : ''}`}</title>
          </rect>
        ))}
      </svg>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
        {points.map((p) => (
          <span
            key={p.key}
            style={{
              fontFamily: DISPLAY, fontWeight: 600, fontSize: 10, letterSpacing: '.1em',
              textTransform: 'uppercase', color: ind.inkMuted,
            }}
          >
            {p.label}
          </span>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Personal Goals
 * ------------------------------------------------------------------ */

const PersonalGoals = ({ employees }) => {
  const { t, currentLanguage } = useLanguage();
  const { isDarkMode } = useTheme();
  const { user, checkPermission } = useAuth();
  const { handleSessionAuthError } = useSessionGuard();

  const ind = getIndustry(isDarkMode);
  /** The manager's tick has to be the heaviest mark on the track, either theme. */
  const heavyInk = isDarkMode ? ind.accentDeeper : ind.tickerBg;
  const isDesktop = useMinWidth(1024);
  const pagePad = isDesktop ? 24 : 14;

  // Match the review_period format already used by performance reviews, e.g. Q4-2025.
  const getCurrentQuarter = (date = new Date()) => {
    const year = date.getFullYear();
    const quarter = Math.floor(date.getMonth() / 3) + 1;
    return `Q${quarter}-${year}`;
  };

  // Check if user can view other employees' performance
  const canViewAllEmployees = checkPermission('canViewReports');

  // Memoized: availableEmployees feeds an effect dependency array below, and a
  // fresh identity every render makes that effect re-run on every render.
  const availableEmployees = useMemo(() => {
    const operational = filterActiveEmployees(employees);
    return canViewAllEmployees
      ? operational
      : operational.filter(emp => String(emp.id) === String(user?.employeeId || user?.id));
  }, [employees, canViewAllEmployees, user?.employeeId, user?.id]);

  // Default the selected employee to the logged-in user's employee id (or user id)
  const defaultEmployeeId = user?.employeeId
    ? String(user.employeeId)
    : user?.id
    ? String(user.id)
    : (availableEmployees[0]?.id ? String(availableEmployees[0].id) : null);

  const [selectedEmployee, setSelectedEmployee] = useState(defaultEmployeeId);

  // If `user` or `availableEmployees` arrive after mount, ensure we pick the logged-in user
  useEffect(() => {
    if (!selectedEmployee) {
      const fallback = user?.employeeId
        ? String(user.employeeId)
        : user?.id
        ? String(user.id)
        : (availableEmployees[0]?.id ? String(availableEmployees[0].id) : null);
      if (fallback) setSelectedEmployee(fallback);
    }
  }, [user, availableEmployees, selectedEmployee]);

  const [selectedPeriod, setSelectedPeriod] = useState(() => getCurrentQuarter());
  const [activeTab, setActiveTab] = useState('overview');
  const [showAddGoalModal, setShowAddGoalModal] = useState(false);
  const [showEditGoalModal, setShowEditGoalModal] = useState(false);
  const [showViewGoalModal, setShowViewGoalModal] = useState(false);
  const [viewingGoal, setViewingGoal] = useState(null);
  const [editingGoal, setEditingGoal] = useState(null);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState(null);
  const [goals, setGoals] = useState([]);
  /** Every review this employee has, all periods — feeds history and the plates. */
  const [allReviews, setAllReviews] = useState([]);
  const [skills, setSkills] = useState([]);
  /** Company medians per skill for the period. Optional: absent means no mark. */
  const [companyMedians, setCompanyMedians] = useState({});
  const [assessmentDirty, setAssessmentDirty] = useState(false);
  const [savingAssessment, setSavingAssessment] = useState(false);
  const [adjusting, setAdjusting] = useState(false);
  const [ackBusy, setAckBusy] = useState(false);
  const fetchRequestIdRef = useRef(0);

  // Form state for new goal
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

  // ---------------------------------------------------------------- fetch

  const fetchGoalsAndReviews = useCallback(async (options = {}) => {
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

      const [goalsResult, reviewsResult] = await Promise.all([
        performanceService.getAllPerformanceGoals({ employeeId: selectedEmployee }),
        // Every period in one read: the selected quarter's review is picked out
        // of this list, so history and the plates can never disagree.
        performanceService.getAllPerformanceReviews({ employeeId: selectedEmployee }),
      ]);

      let skillsData = [];
      let skillsError = null;
      if (isDemoMode()) {
        skillsData = getDemoSkills().filter(skill => String(skill.employee_id) === String(selectedEmployee));
      } else {
        const skillsResult = await performanceService.getSkillsByEmployee(selectedEmployee);
        skillsData = skillsResult.data || [];
        skillsError = skillsResult.success ? null : skillsResult.error;
      }

      if (requestId !== fetchRequestIdRef.current) return;

      if (goalsResult.success) setGoals(goalsResult.data || []);
      const reviews = reviewsResult.success ? reviewsResult.data || [] : [];
      setAllReviews(reviews);

      const periodReview = reviews.find(r => r.review_period === selectedPeriod) || null;
      setSkills(mergeReviewRatingsIntoSkills(skillsError ? [] : skillsData, periodReview, selectedEmployee));
    } catch (error) {
      console.error('Error fetching performance data:', error);
      if (handleSessionAuthError(error, { silent, setFetchError })) return;
      if (!silent) setFetchError(t('errors.loadFailed', 'Failed to load data'));
    } finally {
      if (!silent) setLoading(false);
    }
  }, [selectedEmployee, selectedPeriod, handleSessionAuthError]);

  useEffect(() => {
    setAssessmentDirty(false);
    setAdjusting(false);
    fetchGoalsAndReviews();
  }, [fetchGoalsAndReviews]);

  useAuthenticatedPageRefresh(useCallback(
    () => fetchGoalsAndReviews({ silent: true }),
    [fetchGoalsAndReviews]
  ));

  /**
   * Company medians for the period. Deliberately non-blocking and unguarded by
   * role: row-level security decides what comes back, and an empty result just
   * means the median hairline is not drawn.
   */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const result = await performanceService.getAllPerformanceReviews({ reviewPeriod: selectedPeriod });
        if (cancelled || !result?.success) return;
        const rows = result.data || [];
        const medians = {};
        PERFORMANCE_SKILLS.forEach((definition) => {
          medians[definition.skillName] = medianOf(rows.map((r) => Number(r[definition.reviewColumn])));
        });
        setCompanyMedians(medians);
      } catch {
        if (!cancelled) setCompanyMedians({}); // the median mark is optional
      }
    })();
    return () => { cancelled = true; };
  }, [selectedPeriod]);

  // ESC closes whichever modal is open
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

  // ---------------------------------------------------------------- derive

  const periodReview = useMemo(
    () => allReviews.find(r => r.review_period === selectedPeriod) || null,
    [allReviews, selectedPeriod]
  );

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

  /** The five calibrated rows the assessment figure draws. */
  const skillRows = useMemo(() => PERFORMANCE_SKILLS.map((definition) => {
    const skill = skills.find(s => s.skill_name === definition.skillName);
    return {
      key: definition.key,
      skillName: definition.skillName,
      category: definition.category,
      label: t(`personalGoals.${definition.key}`, definition.skillName),
      self: Number(skill?.rating || 0),
      manager: skill?.managerRating ?? null,
      median: companyMedians[definition.skillName] ?? null,
    };
  }), [skills, companyMedians, t]);

  /** Average of the rated skills — the same arithmetic the save path uses. */
  const skillAverage = useMemo(() => buildPerformanceAssessment(skills).overallRating, [skills]);

  /** Gaps worth a conversation, in the words the footer prints. */
  const calibrationGaps = useMemo(() => skillRows
    .filter(r => r.manager != null && r.self > 0 && Math.abs(r.manager - r.self) >= GAP_THRESHOLD)
    .map(r => ({ label: r.label, direction: r.manager > r.self ? 'above' : 'below' })),
  [skillRows]);

  const hasManagerRatings = skillRows.some(r => r.manager != null);

  const calibrationRead = useMemo(() => {
    if (!hasManagerRatings) {
      return t('personalGoals.noManagerRatings', 'No manager ratings for this period yet.');
    }
    if (calibrationGaps.length === 0) {
      return t('personalGoals.noGaps', 'Self and manager agree within half a point across every skill.');
    }
    const list = calibrationGaps
      .map(g => `${g.label.toLowerCase()} ${g.direction === 'above'
        ? t('personalGoals.ratedAboveSelf', 'rated above self')
        : t('personalGoals.ratedBelowSelf', 'below')}`)
      .join(', ');
    return `${t('personalGoals.gapsToDiscuss', '{count} gaps to discuss').replace('{count}', String(calibrationGaps.length))}: ${list}`;
  }, [calibrationGaps, hasManagerRatings, t]);

  /**
   * Goals in the shape the blueprint section renders. ON TRACK / AT RISK is a
   * real calculation, not a stored field: a goal is at risk once it is overdue,
   * or once its progress has slipped materially behind its own elapsed timeline.
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

  /** Open goals first, in deadline order, then the completed ones. */
  const orderedGoals = useMemo(() => [
    ...openGoals.slice().sort((a, b) => String(a.targetDate || '').localeCompare(String(b.targetDate || ''))),
    ...completedGoals,
  ], [openGoals, completedGoals]);

  const historyPoints = useMemo(() => {
    const byPeriod = new Map(allReviews.map(r => [r.review_period, r]));
    return quartersEndingAt(selectedPeriod, HISTORY_QUARTERS).map(q => {
      const review = byPeriod.get(q.key);
      const value = Number(review?.overall_rating);
      return {
        key: q.key,
        label: `Q${q.quarter}'${String(q.year).slice(2)}`,
        value: Number.isFinite(value) && value > 0 ? value : null,
        // A self-logged quarter is the employee's own average, not a calibrated
        // review. The marker says so rather than passing it off as a review.
        selfOnly: review?.review_type === 'self',
      };
    });
  }, [allReviews, selectedPeriod]);

  /** Overall for the period, and the move since the quarter before it. */
  const overall = useMemo(() => {
    const current = Number(periodReview?.overall_rating) || skillAverage || 0;
    const previous = historyPoints.length >= 2 ? historyPoints[historyPoints.length - 2].value : null;
    const delta = previous != null && current > 0 ? round1(current - previous) : null;
    return { value: current, delta };
  }, [periodReview, skillAverage, historyPoints]);

  const closeDate = useMemo(() => reviewCloseDate(selectedPeriod), [selectedPeriod]);
  const closeLabel = closeDate
    ? formatDate(closeDate, currentLanguage, { day: '2-digit', month: 'short' })
      .toLocaleUpperCase(localeTag(currentLanguage))
    : '—';
  const daysToClose = closeDate ? daysBetween(new Date(), closeDate) : null;

  /**
   * The cycle is derived, not stored: there is no workflow table, so each step
   * is inferred from the records that would exist if it had happened.
   */
  const cycleSteps = useMemo(() => {
    const selfDate = skills
      .map(s => s.assessment_date)
      .filter(Boolean)
      .sort()
      .pop() || null;
    const selfDone = skillRows.some(r => r.self > 0) && Boolean(selfDate);
    const managerDone = hasManagerRatings;
    const status = periodReview?.status || null;
    const signedOff = status === 'approved' || status === 'completed';
    const calibrated = signedOff || status === 'submitted';

    const steps = [
      {
        key: 'self',
        title: t('personalGoals.stepSelfAssessment', 'Self-assessment submitted'),
        meta: selfDate ? formatDate(selfDate, currentLanguage) : t('personalGoals.notYet', 'Not yet'),
        state: selfDone ? 'done' : 'todo',
      },
      {
        key: 'manager',
        title: t('personalGoals.stepManagerRating', 'Manager rating entered'),
        meta: [
          periodReview?.review_date ? formatDate(periodReview.review_date, currentLanguage) : null,
          periodReview?.reviewer?.name || null,
        ].filter(Boolean).join(' · ') || t('personalGoals.notYet', 'Not yet'),
        state: managerDone ? 'done' : 'todo',
      },
      {
        key: 'calibration',
        title: t('personalGoals.stepCalibration', 'Calibration meeting'),
        meta: periodReview?.reviewer?.name || t('personalGoals.awaitingSchedule', 'Not scheduled'),
        state: calibrated ? 'done' : 'todo',
      },
      {
        key: 'signoff',
        title: t('personalGoals.stepSignOff', 'Sign-off & next-quarter goals'),
        meta: closeDate
          ? `${t('personalGoals.byDate', 'by')} ${formatDate(closeDate.toISOString().split('T')[0], currentLanguage)}`
          : '',
        state: signedOff ? 'done' : 'todo',
      },
    ];

    // Exactly one open step is "now" — the first that has not happened.
    const nextIndex = steps.findIndex(s => s.state === 'todo');
    if (nextIndex >= 0) steps[nextIndex].state = 'current';
    return steps;
  }, [skills, skillRows, hasManagerRatings, periodReview, closeDate, currentLanguage, t]);

  const managerNote = useMemo(() => {
    if (!periodReview) return null;
    const strengths = isDemoMode()
      ? getDemoReviewStrengths(periodReview, t)
      : periodReview.strengths;
    const areas = isDemoMode()
      ? getDemoReviewAreasForImprovement(periodReview, t)
      : periodReview.areas_for_improvement;
    if (!strengths && !areas) return null;
    const employeeComment = periodReview.employee_comments || '';
    return {
      id: periodReview.id,
      strengths,
      areas,
      author: periodReview.reviewer?.name || t('personalGoals.reviewer', 'Reviewer'),
      date: periodReview.review_date,
      acknowledged: employeeComment.startsWith(ACK_MARKER),
      reply: employeeComment.startsWith(ACK_MARKER)
        ? employeeComment.slice(ACK_MARKER.length).trim()
        : employeeComment,
    };
  }, [periodReview, t]);

  const currentYear = new Date().getFullYear();
  const periodOptions = useMemo(() => {
    const out = [];
    for (const year of [currentYear - 1, currentYear]) {
      for (const q of [1, 2, 3, 4]) {
        out.push({ value: `Q${q}-${year}`, label: `Q${q} ${year}` });
      }
    }
    return out;
  }, [currentYear]);

  // ---------------------------------------------------------------- actions

  /** Slider movement stays local; the whole assessment saves as one action. */
  const handleUpdateSkillRating = (skillName, category, newRating) => {
    if (!selectedEmployee) return;
    const rounded = Math.round(newRating * 10) / 10;
    setSkills(prev => prev.map(skill =>
      skill.skill_name === skillName
        ? {
            ...skill,
            skill_category: category,
            rating: rounded,
            proficiency_level: rounded >= 4 ? 'advanced' : rounded >= 3 ? 'intermediate' : 'beginner',
          }
        : skill
    ));
    setAssessmentDirty(true);
  };

  /**
   * Saves the employee's own numbers to skills_assessments — the table that
   * holds self-ratings. The manager's ratings live on the review row and are
   * read-only here; they are entered on the Performance Review screen.
   */
  const handleSaveSkillAssessment = async () => {
    if (!selectedEmployee || !assessmentDirty || savingAssessment) return;

    setSavingAssessment(true);
    try {
      const failures = [];
      for (const definition of PERFORMANCE_SKILLS) {
        const skill = skills.find(s => s.skill_name === definition.skillName);
        const rating = Number(skill?.rating || 0);
        if (rating < 1) continue; // an unrated skill is not an assertion
        const result = await performanceService.upsertSkillAssessment({
          employeeId: selectedEmployee,
          skillName: definition.skillName,
          skillCategory: definition.category,
          rating,
          proficiencyLevel: rating >= 4 ? 'advanced' : rating >= 3 ? 'intermediate' : 'beginner',
          assessedBy: user?.employeeId || selectedEmployee,
          assessmentDate: new Date().toISOString().split('T')[0],
        });
        if (!result.success) failures.push(`${definition.skillName}: ${result.error}`);
      }

      if (failures.length > 0) throw new Error(failures.join('; '));

      /*
       * Log the period's overall so the rating history has a point.
       *
       * skills_assessments is upserted per (employee, skill) and holds only the
       * newest number, so saving there records the current standing but no
       * history. The history line reads performance_reviews.overall_rating by
       * quarter, which is why nothing ever appeared for an employee whose
       * manager had not filed a review.
       *
       * Only ever creates. If a review row already exists for this period it is
       * the manager's, and upsertPerformanceReviewByPeriod writes every rating
       * column -- calling it with just the overall would null out the manager's
       * per-skill ratings.
       */
      if (!periodReview && skillAverage > 0) {
        const logged = await performanceService.upsertPerformanceReviewByPeriod({
          employeeId: selectedEmployee,
          reviewerId: selectedEmployee,
          reviewPeriod: selectedPeriod,
          reviewType: 'self',
          overallRating: skillAverage,
          status: 'draft',
        });
        if (!logged.success) {
          console.error('Skill ratings saved, but the period overall was not logged:', logged.error);
        }
      }

      setAssessmentDirty(false);
      setAdjusting(false);
      await fetchGoalsAndReviews({ silent: true });
      alert(t('personalGoals.ratingUpdated', 'Assessment saved.'));
    } catch (error) {
      console.error('Error saving skill assessment:', error);
      if (handleSessionAuthError(error)) return;
      alert(t('personalGoals.ratingUpdateError', 'Failed to save assessment'));
    } finally {
      setSavingAssessment(false);
    }
  };

  /** Acknowledge and Reply both write the employee's side of the review record. */
  const writeEmployeeComment = async (text) => {
    if (!managerNote?.id || ackBusy) return;
    setAckBusy(true);
    try {
      const result = await performanceService.updatePerformanceReview(managerNote.id, {
        employeeComments: text,
      });
      if (!result.success) throw new Error(result.error || 'Failed to save');
      await fetchGoalsAndReviews({ silent: true });
    } catch (error) {
      console.error('Error saving employee comment:', error);
      if (handleSessionAuthError(error)) return;
      alert(t('personalGoals.replyError', 'Could not save your response'));
    } finally {
      setAckBusy(false);
    }
  };

  const handleAcknowledge = () => writeEmployeeComment(`${ACK_MARKER} ${managerNote?.reply || ''}`.trim());

  const handleReply = () => {
    const answer = window.prompt(
      t('personalGoals.replyPrompt', 'Your response to this review:'),
      managerNote?.reply || ''
    );
    if (answer === null) return;
    const prefix = managerNote?.acknowledged ? `${ACK_MARKER} ` : '';
    writeEmployeeComment(`${prefix}${answer}`.trim());
  };

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
        fetchGoalsAndReviews();
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
        fetchGoalsAndReviews();
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
        fetchGoalsAndReviews();
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

  const handleExportReview = useCallback(() => {
    const header = ['Section', 'Item', 'Self', 'Manager', 'Company median', 'Detail'];
    const body = [
      ...skillRows.map(r => [
        'Skill', r.label, fmt1(r.self),
        r.manager == null ? '' : fmt1(r.manager),
        r.median == null ? '' : fmt1(r.median),
        '',
      ]),
      ['Overall', t('personalGoals.overallPerformance', 'Overall'), fmt1(skillAverage), fmt1(overall.value), '', ''],
      ...orderedGoals.map(g => [
        'Goal', g.title, `${g.progress}%`, '', '',
        `${g.state} · ${g.targetDate || ''}`,
      ]),
    ];

    const csv = '﻿' + [header, ...body].map(row => row.map(csvCell).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `review-${String(employeeName).replace(/\s+/g, '-').toLowerCase()}-${selectedPeriod}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }, [skillRows, orderedGoals, skillAverage, overall.value, employeeName, selectedPeriod, t]);

  // ---------------------------------------------------------------- style

  const hasRealData = goals.length > 0 || allReviews.length > 0 || skillRows.some(r => r.self > 0);

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

  const tabOptions = [
    { value: 'overview', label: t('personalGoals.overview', 'Overview') },
    { value: 'goals', label: t('personalGoals.goalsTab', 'Goals') },
    { value: 'history', label: t('personalGoals.history', 'History') },
  ];

  /* -- goal row, shared by the Overview and Goals tabs ----------------- */
  const renderGoalRow = (goal, index) => {
    const atRisk = goal.state === 'atRisk';
    const fill = goal.complete ? ind.ramp[3] : atRisk ? heavyInk : ind.accent;
    const meta = [
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
        {/* Blueprint item marker — a drawing reference, not a bullet */}
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

        {/* Fixed status block so the column stays a straight edge */}
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

  const goalsSection = (
    <Blueprint ind={ind}>
      <div
        className="flex flex-wrap items-start justify-between"
        style={{ gap: 12, padding: '14px 20px', borderBottom: `1px solid ${ind.hairline}` }}
      >
        <div style={{ minWidth: 0 }}>
          <Kicker ind={ind}>{t('personalGoals.currentGoals', 'Current goals')}</Kicker>
          <p style={{ fontFamily: BODY, fontSize: 12.5, color: ind.inkMuted, marginTop: 6 }}>
            {`${inProgressCount} ${t('personalGoals.inProgressLower', 'in progress')} · ${completedGoals.length} ${t('personalGoals.completedThisYear', 'completed')}`}
          </p>
        </div>
        <Btn ind={ind} onClick={handleAddGoal} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <Plus size={13} strokeWidth={1.5} />
          {t('personalGoals.addGoal', 'Add goal')}
        </Btn>
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
      {/* ── TICKER — replaces metric cards. Never both. ───────────────── */}
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
          label={t('personalGoals.overallPerformance', 'Overall')}
          value={overall.value > 0 ? fmt1(overall.value) : '—'}
          delta={overall.delta ? Math.abs(overall.delta).toFixed(1) : null}
          deltaDirection={overall.delta > 0 ? 'up' : 'down'}
        />
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
          label={t('personalGoals.avgSkillRating', 'Skill avg')}
          value={skillAverage > 0 ? fmt1(skillAverage) : '—'}
        />
        <TickerCell
          ind={ind}
          label={t('personalGoals.reviewDue', 'Review due')}
          value={closeLabel}
          // The deadline is the one figure on the strip that runs out.
          valueColor={ind.tickerUp}
          title={daysToClose != null
            ? t('personalGoals.daysLeft', '{n} days left').replace('{n}', String(daysToClose))
            : undefined}
        />

        {/* Scope controls — pushed right with flex:1 and a left hairline. */}
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
            <FlatSelect
              ind={ind}
              onDark
              value={selectedEmployee || ''}
              onChange={(e) => setSelectedEmployee(String(e.target.value))}
              aria-label={t('personalGoals.employee', 'Employee')}
              style={{ maxWidth: 190 }}
            >
              {availableEmployees.map(employee => (
                <option key={employee.id} value={String(employee.id)} style={{ color: '#1d1f20' }}>
                  {getDemoEmployeeName(employee, t) || employee.name}
                </option>
              ))}
            </FlatSelect>
          )}
          <FlatSelect
            ind={ind}
            onDark
            value={selectedPeriod}
            onChange={(e) => setSelectedPeriod(e.target.value)}
            aria-label={t('personalGoals.period', 'Period')}
          >
            {periodOptions.map(period => (
              <option key={period.value} value={period.value} style={{ color: '#1d1f20' }}>
                {period.label}
              </option>
            ))}
          </FlatSelect>
        </div>
      </div>

      {/* ── BANDS ─────────────────────────────────────────────────────── */}
      <div className="flex flex-col lg:flex-row items-stretch">

        {/* ── MAIN ───────────────────────────────────────────────────── */}
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
                  onClick={() => { setFetchError(null); fetchGoalsAndReviews(); }}
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

          {/* Identity head */}
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
              <Seg
                ind={ind}
                options={tabOptions}
                value={activeTab}
                onChange={setActiveTab}
                ariaLabel={t('personalGoals.view', 'View')}
              />
              {isDesktop ? (
                <Btn ind={ind} onClick={handleExportReview} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <Download size={13} strokeWidth={1.5} />
                  {t('personalGoals.exportReview', 'Export review')}
                </Btn>
              ) : (
                <MoreMenu
                  ind={ind}
                  label={t('header.moreOptions', 'More options')}
                  items={[
                    {
                      key: 'export',
                      label: t('personalGoals.exportReview', 'Export review'),
                      icon: Download,
                      onClick: handleExportReview,
                    },
                  ]}
                />
              )}
            </div>
          </div>

          {/* Skills assessment — the core figure */}
          {activeTab === 'overview' && (
            <Blueprint ind={ind}>
              <div
                className="flex flex-wrap items-start justify-between"
                style={{ gap: 12, padding: '16px 20px 0' }}
              >
                <div style={{ minWidth: 0 }}>
                  <Kicker ind={ind}>
                    {`${t('personalGoals.skillsAssessment', 'Skills assessment')} · ${selectedPeriod.replace('-', ' ')}`}
                  </Kicker>
                  <p style={{ fontFamily: BODY, fontSize: 12.5, color: ind.inkMuted, marginTop: 6 }}>
                    {t('personalGoals.assessmentLead', 'Self-rating as fill, manager as marker, company median dashed.')}
                  </p>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, flex: 'none', paddingTop: 2, maxWidth: '100%' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <span aria-hidden="true" style={{ width: 9, height: 9, background: ind.accent, flex: 'none' }} />
                    <span style={{ fontFamily: BODY, fontSize: 12, color: ind.inkMuted }}>{t('personalGoals.self', 'Self')}</span>
                  </span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <span aria-hidden="true" style={{ width: 2, height: 11, background: heavyInk, flex: 'none' }} />
                    <span style={{ fontFamily: BODY, fontSize: 12, color: ind.inkMuted }}>{t('personalGoals.manager', 'Manager')}</span>
                  </span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <span aria-hidden="true" style={{ width: 1, height: 11, background: ind.inkFaint, flex: 'none' }} />
                    <span style={{ fontFamily: BODY, fontSize: 12, color: ind.inkMuted }}>{t('personalGoals.median', 'Median')}</span>
                  </span>
                </div>
              </div>

              <div style={{ padding: '16px 20px 0', display: 'flex', flexDirection: 'column', gap: 16 }}>
                {skillRows.map((row) => (
                  <div key={row.key}>
                    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, marginBottom: 6 }}>
                      <span style={{ fontFamily: BODY, fontSize: 13, color: ind.ink }}>{row.label}</span>
                      <span style={{ whiteSpace: 'nowrap' }}>
                        <span style={figure(15, ind.ink)}>{fmt1(row.self)}</span>
                        <span style={{ fontFamily: BODY, fontSize: 12, color: ind.inkMuted }}>
                          {row.manager == null
                            ? ` / ${t('personalGoals.noManagerShort', 'no mgr rating')}`
                            : ` / ${t('personalGoals.mgrShort', 'mgr')} `}
                        </span>
                        {row.manager != null && <span style={figure(15, ind.inkGhost)}>{fmt1(row.manager)}</span>}
                      </span>
                    </div>
                    <SkillMeter ind={ind} heavyInk={heavyInk} self={row.self} manager={row.manager} median={row.median} />
                    {adjusting && (
                      <input
                        type="range"
                        min="0"
                        max="5"
                        step="0.5"
                        value={row.self}
                        onChange={(e) => handleUpdateSkillRating(row.skillName, row.category, parseFloat(e.target.value))}
                        aria-label={row.label}
                        style={{ width: '100%', marginTop: 8, accentColor: ind.accent, cursor: 'pointer' }}
                      />
                    )}
                  </div>
                ))}
              </div>

              {/* The read, in words, beside the two actions */}
              <div
                className="flex flex-wrap items-center justify-between"
                style={{ gap: 12, margin: isDesktop ? '18px 20px 0' : '18px 14px 0', padding: '14px 0 16px', borderTop: `1px solid ${ind.hairline}` }}
              >
                <p style={{ fontFamily: BODY, fontSize: 12.5, color: ind.inkMuted, minWidth: 0, flex: isDesktop ? 1 : '1 1 100%' }}>
                  {calibrationRead}
                </p>
                {isDesktop ? (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, flex: 'none', maxWidth: '100%' }}>
                    <Btn ind={ind} onClick={() => setAdjusting(v => !v)}>
                      {adjusting ? t('common.done', 'Done') : t('personalGoals.adjustRatings', 'Adjust ratings')}
                    </Btn>
                    <Btn
                      ind={ind}
                      variant="primary"
                      disabled={!assessmentDirty || savingAssessment}
                      onClick={handleSaveSkillAssessment}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                    >
                      <Save size={13} strokeWidth={1.5} />
                      {savingAssessment ? t('common.saving', 'Saving…') : t('personalGoals.saveAssessment', 'Save assessment')}
                    </Btn>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%', minWidth: 0 }}>
                    <Btn
                      ind={ind}
                      onClick={() => setAdjusting((value) => !value)}
                      style={{ width: '100%' }}
                    >
                      {adjusting ? t('common.done', 'Done') : t('personalGoals.adjustRatings', 'Adjust ratings')}
                    </Btn>
                    <Btn
                      ind={ind}
                      variant="primary"
                      disabled={!assessmentDirty || savingAssessment}
                      onClick={handleSaveSkillAssessment}
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, width: '100%' }}
                    >
                      <Save size={13} strokeWidth={1.5} />
                      {savingAssessment ? t('common.saving', 'Saving…') : t('personalGoals.saveAssessment', 'Save assessment')}
                    </Btn>
                  </div>
                )}
              </div>
            </Blueprint>
          )}

          {(activeTab === 'overview' || activeTab === 'goals') && goalsSection}

          {/* History — every review this employee has */}
          {activeTab === 'history' && (
            <Blueprint ind={ind}>
              <div style={{ padding: '14px 20px', borderBottom: `1px solid ${ind.hairline}` }}>
                <Kicker ind={ind}>{t('personalGoals.performanceReviews', 'Performance reviews')}</Kicker>
              </div>
              <div>
                {allReviews.length === 0 && (
                  <p style={{ fontFamily: BODY, fontSize: 13, color: ind.inkMuted, padding: '18px 20px' }}>
                    {loading ? t('common.loading', 'Loading…') : t('personalGoals.noReviews', 'No reviews recorded yet.')}
                  </p>
                )}
                {allReviews.map((review, i) => (
                  <div
                    key={review.id}
                    style={{ padding: '14px 20px', borderTop: i === 0 ? 'none' : `1px solid ${ind.rule}` }}
                  >
                    <div className="flex flex-wrap items-baseline justify-between" style={{ gap: 10 }}>
                      <span style={{
                        fontFamily: DISPLAY, fontWeight: 600, fontSize: 14, letterSpacing: '.05em',
                        textTransform: 'uppercase', color: ind.ink,
                      }}>
                        {String(review.review_period || '').replace('-', ' ')}
                      </span>
                      <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 10 }}>
                        <span style={{ fontFamily: BODY, fontSize: 12, color: ind.inkMuted }}>
                          {review.reviewer?.name || t('personalGoals.reviewer', 'Reviewer')}
                          {review.review_date ? ` · ${formatDate(review.review_date, currentLanguage)}` : ''}
                        </span>
                        <span style={figure(16, ind.ink)}>{fmt1(review.overall_rating)}</span>
                      </span>
                    </div>
                    {review.strengths && (
                      <p style={{ fontFamily: BODY, fontSize: 12.5, color: ind.inkMuted, marginTop: 6 }}>
                        <span style={{ color: ind.ink }}>{t('personalGoals.strengths', 'Strengths')}: </span>
                        {isDemoMode()
                          ? getDemoReviewStrengths(review, t)
                          : <TranslatedText text={review.strengths} record={{ entityType: 'review', entityId: review.id, field: 'strengths' }} />}
                      </p>
                    )}
                    {review.areas_for_improvement && (
                      <p style={{ fontFamily: BODY, fontSize: 12.5, color: ind.inkMuted, marginTop: 3 }}>
                        <span style={{ color: ind.ink }}>{t('personalGoals.areasForImprovement', 'Areas for improvement')}: </span>
                        {isDemoMode()
                          ? getDemoReviewAreasForImprovement(review, t)
                          : <TranslatedText text={review.areas_for_improvement} record={{ entityType: 'review', entityId: review.id, field: 'areas_for_improvement' }} />}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </Blueprint>
          )}
        </div>

        {/* ── RIGHT COLUMN — 372px, three stacked plates ─────────────── */}
        <aside
          className="w-full lg:w-[372px] lg:shrink-0 flex flex-col"
          style={{ background: ind.chrome }}
        >
          {/* Review cycle */}
          <div style={{ padding: '20px 20px 22px', borderBottom: `1px solid ${ind.hairline}` }}>
            <div className="flex items-baseline justify-between" style={{ gap: 10 }}>
              <ColumnHeading ind={ind}>{t('personalGoals.reviewCycle', 'Review cycle')}</ColumnHeading>
              <span style={{ fontFamily: BODY, fontSize: 12.5, color: ind.inkMuted }}>
                {selectedPeriod.replace('-', ' ')}
              </span>
            </div>
            <p style={{ fontFamily: BODY, fontSize: 12.5, color: ind.inkMuted, marginTop: 6, marginBottom: 16 }}>
              {closeDate
                ? `${t('personalGoals.closes', 'Closes')} ${formatDate(closeDate.toISOString().split('T')[0], currentLanguage)}`
                : ''}
              {daysToClose != null && (
                daysToClose >= 0
                  ? ` · ${t('personalGoals.daysLeft', '{n} days left').replace('{n}', String(daysToClose))}`
                  : ` · ${t('personalGoals.overdueDays', '{n} days overdue').replace('{n}', String(Math.abs(daysToClose)))}`
              )}
            </p>
            {cycleSteps.map((step, i) => (
              <CycleStep
                key={step.key}
                ind={ind}
                state={step.state}
                title={step.title}
                meta={step.meta}
                last={i === cycleSteps.length - 1}
              />
            ))}
          </div>

          {/* Rating history */}
          <div style={{ padding: '20px 20px 22px', borderBottom: `1px solid ${ind.hairline}` }}>
            <ColumnHeading ind={ind} style={{ fontSize: 13 }}>
              {t('personalGoals.ratingHistory', 'Rating history')}
            </ColumnHeading>
            <div style={{ marginTop: 12 }}>
              <RatingSpark
                ind={ind}
                points={historyPoints}
                emptyLabel={t('personalGoals.noRatingHistory', 'No rated quarters yet.')}
                selfLabel={t('personalGoals.selfRated', 'self-rated')}
              />
            </div>
          </div>

          {/* Manager note — the one legitimate accent border, because it quotes */}
          <div style={{ padding: '20px 20px 24px' }}>
            <ColumnHeading ind={ind} style={{ fontSize: 13 }}>
              {t('personalGoals.managerNote', 'Manager note')}
            </ColumnHeading>

            {!managerNote && (
              <p style={{ fontFamily: BODY, fontSize: 12.5, color: ind.inkMuted, marginTop: 12 }}>
                {t('personalGoals.noManagerNote', 'No written feedback for this period yet.')}
              </p>
            )}

            {managerNote && (
              <>
                <blockquote
                  style={{
                    borderLeft: `2px solid ${ind.accent}`,
                    padding: '2px 0 2px 12px',
                    margin: '12px 0 0',
                  }}
                >
                  {managerNote.strengths && (
                    <p style={{ fontFamily: BODY, fontSize: 13, color: ind.ink, lineHeight: 1.5 }}>
                      <TranslatedText
                        text={managerNote.strengths}
                        record={{ entityType: 'review', entityId: managerNote.id, field: 'strengths' }}
                      />
                    </p>
                  )}
                  {managerNote.areas && (
                    <p style={{ fontFamily: BODY, fontSize: 13, color: ind.inkMuted, lineHeight: 1.5, marginTop: 8 }}>
                      <TranslatedText
                        text={managerNote.areas}
                        record={{ entityType: 'review', entityId: managerNote.id, field: 'areas_for_improvement' }}
                      />
                    </p>
                  )}
                </blockquote>

                <p style={{ fontFamily: BODY, fontSize: 12, color: ind.inkMuted, marginTop: 10 }}>
                  {managerNote.author}
                  {managerNote.date ? ` · ${formatDate(managerNote.date, currentLanguage)}` : ''}
                </p>

                {managerNote.reply && (
                  <p style={{ fontFamily: BODY, fontSize: 12.5, color: ind.ink, marginTop: 10 }}>
                    <span style={{ color: ind.inkMuted }}>{t('personalGoals.yourReply', 'Your reply')}: </span>
                    {managerNote.reply}
                  </p>
                )}

                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
                  {managerNote.acknowledged ? (
                    <Tag ind={ind} variant="neutral">{t('personalGoals.acknowledged', 'Acknowledged')}</Tag>
                  ) : (
                    <Btn ind={ind} variant="primary" disabled={ackBusy} onClick={handleAcknowledge}>
                      {t('personalGoals.acknowledge', 'Acknowledge')}
                    </Btn>
                  )}
                  <Btn ind={ind} disabled={ackBusy} onClick={handleReply}>
                    {t('personalGoals.reply', 'Reply')}
                  </Btn>
                </div>
              </>
            )}
          </div>
        </aside>
      </div>

      {/* ── Add goal ─────────────────────────────────────────────────── */}
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

      {/* ── Edit goal ────────────────────────────────────────────────── */}
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

      {/* ── View goal ────────────────────────────────────────────────── */}
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

/* ------------------------------------------------------------------ *
 * Goal form — add and edit are the same fields, so they are one component
 * ------------------------------------------------------------------ */

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
                <select
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  style={{ ...fieldStyle, marginTop: 6, cursor: 'pointer' }}
                >
                  <option value="general">{t('personalGoals.general', 'General')}</option>
                  <option value="technical">{t('personalGoals.technical', 'Technical')}</option>
                  <option value="leadership">{t('personalGoals.leadership', 'Leadership')}</option>
                  <option value="project">{t('personalGoals.project', 'Project')}</option>
                  <option value="professional_development">{t('personalGoals.professionalDevelopment', 'Professional Development')}</option>
                </select>
              </div>

              <div>
                <Kicker ind={ind} color={ind.inkMuted}>{t('personalGoals.priority', 'Priority')}</Kicker>
                <select
                  value={form.priority}
                  onChange={(e) => setForm({ ...form, priority: e.target.value })}
                  style={{ ...fieldStyle, marginTop: 6, cursor: 'pointer' }}
                >
                  <option value="low">{t('personalGoals.low', 'Low')}</option>
                  <option value="medium">{t('personalGoals.medium', 'Medium')}</option>
                  <option value="high">{t('personalGoals.high', 'High')}</option>
                  <option value="critical">{t('personalGoals.critical', 'Critical')}</option>
                </select>
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
                <select
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value })}
                  style={{ ...fieldStyle, marginTop: 6, cursor: 'pointer' }}
                >
                  <option value="pending">{t('personalGoals.pending', 'Pending')}</option>
                  <option value="in_progress">{t('personalGoals.inProgress', 'In Progress')}</option>
                  <option value="completed">{t('personalGoals.completed', 'Completed')}</option>
                  <option value="cancelled">{t('personalGoals.cancelled', 'Cancelled')}</option>
                  <option value="on_hold">{t('personalGoals.onHold', 'On Hold')}</option>
                </select>
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
