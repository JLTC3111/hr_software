/**
 * Performance Reviews — one question, answered three ways: is this review cycle
 * going to land, and is the result trustworthy?
 *
 *   stage plate   — where the cycle is. Four stages, absolute counts, and a
 *                   projected close date, so "77%" is never the whole answer.
 *   histogram     — what the org average is actually made of. An average of 4.4
 *                   says nothing until you can see the shape underneath it.
 *   dept chart    — every team against the org line, so calibration starts from
 *                   evidence rather than from whoever argues hardest.
 *   right column  — the only place with buttons: the sign-offs this manager
 *                   personally owes, and the manager reviews that are late.
 *
 * No element repeats a number another element already carries, except the org
 * average, which appears in the ticker, in the histogram caption and as the
 * vertical rule on every department bar. It is the screen's anchor value.
 *
 * Where the numbers come from — everything is derived, nothing is stored twice:
 *   in scope        active employees, narrowed by the segment control
 *   self-assessment a skills assessment logged inside the cycle quarter, an
 *                   employee comment on the review, or a self-logged review row
 *   manager review  a review row with an overall rating that is not self-logged
 *   calibration     that review submitted (status submitted/approved/acknowledged)
 *   signed off      status approved or acknowledged
 *   overdue         no manager review filed and its deadline already passed
 *
 * A viewer without canViewReports is scoped to their own record, so the same
 * layout degrades to a one-person cycle rather than leaking the org's scores.
 *
 * Design system: "Industry" (src/theme/industry.js). Radius is 0 everywhere,
 * cards are outlines with four registration corners, status reads through
 * weight and rule rather than colour.
 */
import _React, { useState, useEffect, useMemo, useCallback } from 'react';
import { ArrowRight, AlertCircle, X } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext.jsx';
import { useLanguage } from '../contexts/LanguageContext.jsx';
import { useAuth } from '../contexts/AuthContext.jsx';
import * as performanceService from '../services/performanceService.js';
import { notifyUser } from '../services/notificationService.js';
import { getAllUsers } from '../services/userService.js';
import { useSessionGuard, useAuthenticatedPageRefresh } from '../hooks/useSessionGuard.js';
import { validateAndRefreshSession } from '../utils/sessionHelper.js';
import { isDemoMode, getDemoEmployeeName } from '../utils/demoHelper.js';
import { filterActiveEmployees } from '../utils/employeeStatus.js';
import { formatDate } from '../utils/localeFormat.js';
import { TranslatedText } from './ui/translated-text.jsx';
import { FetchElapsedPill } from './ui/fetch-elapsed-pill';
import { getIndustry, DISPLAY, BODY, figure, rampAt } from '../theme/industry.js';
import {
  Blueprint, Bar, Tag, Btn, Seg, Kicker, TickerCell, ColumnHeading,
  LiveClock, FlatSelect,
} from './ui/industry.jsx';

/* ------------------------------------------------------------------ *
 * Screen constants — the policy this cycle is read against
 * ------------------------------------------------------------------ */

/** Calibration sits on the 15th of the quarter's middle month, as on Personal Goals. */
const CALIBRATION_DAY = 15;
/** A manager review has to exist before it can be calibrated, so it is due earlier. */
const MANAGER_REVIEW_LEAD_DAYS = 7;
/** Window behind "▲ N this week" on the ticker and the plate. */
const RECENT_WINDOW_DAYS = 7;
/** Below this many sign-offs in that window there is no rate worth projecting from. */
const MIN_RATE_SAMPLE = 3;
/** Histogram axis. Eight buckets, half a point apart. */
const SCORE_MIN = 1.5;
const SCORE_MAX = 5;
const SCORE_STEP = 0.5;
/** Department bars measure from here, so the org average lands mid-track. */
const DEPT_SCALE_FLOOR = 3.5;
/** At or above this a review is worth flagging in the sign-off queue. */
const PROMOTION_SCORE = 4.5;
/** Sign-off queue: two rows carry buttons, three more are named, the rest is a count. */
const EXPANDED_ROWS = 2;
const COMPACT_ROWS = 3;
/** Departments listed in the overdue block before it stops naming them. */
const OVERDUE_ROWS = 3;

const DAY_MS = 86400000;

/** Review statuses, in pipeline order. */
const REACHED_CALIBRATION = new Set(['submitted', 'approved', 'acknowledged']);
const SIGNED_OFF = new Set(['approved', 'acknowledged']);
/** The status a review sits at while it waits for this manager's signature. */
const AWAITING_STATUS = 'submitted';

/** Positions that read as "runs a department" when naming who owes a review. */
const MANAGER_POSITION = /manager|director|head|lead|chief|supervisor/i;

/* ------------------------------------------------------------------ *
 * Helpers
 * ------------------------------------------------------------------ */

/** 'Q3-2026' → { quarter: 3, year: 2026 }. Non-quarterly periods are ignored. */
const parsePeriod = (period) => {
  const match = /^Q([1-4])-(\d{4})$/.exec(String(period || ''));
  if (!match) return null;
  return { quarter: Number(match[1]), year: Number(match[2]) };
};

const formatPeriodKey = (quarter, year) => `Q${quarter}-${year}`;

const periodOf = (date) => formatPeriodKey(Math.floor(date.getMonth() / 3) + 1, date.getFullYear());

const previousPeriodKey = (period) => {
  const parsed = parsePeriod(period);
  if (!parsed) return null;
  const { quarter, year } = parsed;
  return quarter === 1 ? formatPeriodKey(4, year - 1) : formatPeriodKey(quarter - 1, year);
};

/** Newest first — the cycle selector and the "which cycle is current" default. */
const comparePeriodsDesc = (a, b) => {
  const pa = parsePeriod(a);
  const pb = parsePeriod(b);
  if (!pa || !pb) return 0;
  return pb.year - pa.year || pb.quarter - pa.quarter;
};

/** The three months a cycle assesses, as [start, end). */
const periodWindow = (period) => {
  const parsed = parsePeriod(period);
  if (!parsed) return null;
  const start = new Date(parsed.year, (parsed.quarter - 1) * 3, 1);
  const end = new Date(parsed.year, parsed.quarter * 3, 1);
  return { start, end };
};

/** Calibration session date — 15th of the quarter's middle month. */
const calibrationDate = (period) => {
  const parsed = parsePeriod(period);
  if (!parsed) return null;
  return new Date(parsed.year, (parsed.quarter - 1) * 3 + 1, CALIBRATION_DAY);
};

const daysBetween = (from, to) => Math.round((to - from) / DAY_MS);

const parseDate = (value) => {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
};

const round1 = (n) => Math.round((Number(n) || 0) * 10) / 10;
const fmt1 = (n) => round1(n).toFixed(1);
const pct = (n, d) => (d > 0 ? Math.round((n / d) * 100) : 0);

const mean = (values) => (values.length ? values.reduce((sum, v) => sum + v, 0) / values.length : 0);

/** Snap a rating onto the histogram's half-point axis. */
const bucketFor = (score) => {
  const snapped = Math.round(Number(score) / SCORE_STEP) * SCORE_STEP;
  return Math.min(SCORE_MAX, Math.max(SCORE_MIN, snapped));
};

const SCORE_BUCKETS = (() => {
  const out = [];
  for (let s = SCORE_MIN; s <= SCORE_MAX + 0.001; s += SCORE_STEP) out.push(round1(s));
  return out;
})();

/** A self-logged review is a rating the employee gave themselves — never calibrated. */
const isSelfLogged = (review) => String(review?.review_type || '') === 'self';

const ratingOf = (review) => {
  const value = Number(review?.overall_rating);
  return Number.isFinite(value) && value > 0 ? value : null;
};

/**
 * When a manager review stopped being on time. The row's own due_date wins;
 * without one the cycle's calibration lead applies.
 */
const managerReviewDeadline = (review, calibration) => {
  const own = parseDate(review?.due_date);
  if (own) return own;
  if (!calibration) return null;
  return new Date(calibration.getTime() - MANAGER_REVIEW_LEAD_DAYS * DAY_MS);
};

/* ------------------------------------------------------------------ *
 * Figures
 * ------------------------------------------------------------------ */

/** One stage of the pipeline: tracked label, absolute count, hairline track. */
function StageBar({ ind, label, count, total, note, fill }) {
  return (
    <div>
      <div className="flex items-baseline justify-between" style={{ gap: 10, marginBottom: 4 }}>
        <span
          style={{
            fontFamily: DISPLAY, fontWeight: 600, fontSize: 12, letterSpacing: '.06em',
            textTransform: 'uppercase', color: ind.ink, whiteSpace: 'nowrap',
          }}
        >
          {label}
        </span>
        <span
          style={{
            fontFamily: BODY, fontSize: 11.5, color: ind.inkFaint,
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}
        >
          <span style={{ ...figure(13, ind.ink) }}>{count}</span>
          {` / ${total}`}
          {note ? ` · ${note}` : ''}
        </span>
      </div>
      <Bar ind={ind} value={total > 0 ? count / total : 0} fill={fill} height={12} />
    </div>
  );
}

/**
 * Vertical histogram of the cycle's scores. Column heights are a share of the
 * tallest bucket, so the plot fills whatever height the grid row hands it, and
 * fill weight climbs with score — the shape reads as ink as well as height.
 */
function ScoreHistogram({ ind, buckets, peak, emptyLabel }) {
  if (!buckets.some((b) => b.count > 0)) {
    return (
      <p style={{ fontFamily: BODY, fontSize: 12.5, color: ind.inkMuted, margin: 'auto 0' }}>{emptyLabel}</p>
    );
  }

  return (
    <div className="flex" style={{ flex: 1, minHeight: 0, alignItems: 'flex-end', gap: 7 }}>
      {buckets.map((bucket) => {
        const isPeak = bucket.score === peak;
        return (
          <div
            key={bucket.score}
            className="flex flex-col"
            style={{ flex: 1, height: '100%', justifyContent: 'flex-end', gap: 5, minWidth: 0 }}
            title={`${fmt1(bucket.score)} — ${bucket.count}`}
          >
            <span
              style={{
                fontFamily: DISPLAY, fontWeight: 600, fontSize: 10.5, textAlign: 'center',
                color: isPeak ? ind.ink : ind.inkFaint, fontVariantNumeric: 'tabular-nums',
              }}
            >
              {bucket.count}
            </span>
            {/* A bucket with people in it never draws as a hairline — floor the
                height so a count of 1 against a peak of 77 is still visible. */}
            <div style={{ height: `${Math.max(bucket.share, bucket.count > 0 ? 3 : 0)}%`, border: `1px solid ${ind.hairline}` }}>
              <div style={{ height: '100%', background: bucket.fill }} />
            </div>
            <span
              style={{
                fontFamily: DISPLAY, fontWeight: 600, fontSize: 10, letterSpacing: '.06em',
                textAlign: 'center', color: isPeak ? ind.ink : ind.inkFaint,
              }}
            >
              {fmt1(bucket.score)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/**
 * Departments against the org line. Every row carries the same rule, so the
 * comparison is between each team and the org, never between adjacent rows.
 */
function DepartmentChart({ ind, rows, orgAvg, floor, emptyLabel }) {
  if (rows.length === 0) {
    return (
      <p style={{ fontFamily: BODY, fontSize: 12.5, color: ind.inkMuted, margin: 'auto 0' }}>{emptyLabel}</p>
    );
  }

  const span = SCORE_MAX - floor;
  const position = (score) => Math.max(0, Math.min(1, (score - floor) / span));

  return (
    <div className="flex flex-col" style={{ flex: 1, minHeight: 0, justifyContent: 'space-between', gap: 9 }}>
      {rows.map((row, index) => (
        <div key={row.key}>
          <div className="flex items-baseline justify-between" style={{ gap: 10, marginBottom: 4 }}>
            <span
              style={{
                fontFamily: BODY, fontSize: 12.5, color: ind.ink,
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}
            >
              {row.label}
              <span style={{ color: ind.inkFaint, marginLeft: 8 }}>{row.n}</span>
            </span>
            <span style={{ ...figure(13, ind.ink), flex: 'none' }}>{fmt1(row.score)}</span>
          </div>
          {/* Paired ranks share a ramp step, so seven departments still read as
              four weights rather than seven near-identical blues. */}
          <Bar
            ind={ind}
            value={position(row.score)}
            fill={rampAt(ind, Math.floor(index / 2))}
            height={9}
            marker={position(orgAvg)}
          />
        </div>
      ))}
    </div>
  );
}

/** Five segments, one per whole point of the score. */
function ScoreMeter({ ind, score, fill }) {
  const filled = Math.max(0, Math.min(5, Math.floor(Number(score) || 0)));
  return (
    <div className="flex" style={{ gap: 4, marginBottom: 9 }} aria-hidden="true">
      {[0, 1, 2, 3, 4].map((i) => (
        <div
          key={i}
          style={{
            flex: 1,
            height: 6,
            background: i < filled ? fill : 'transparent',
            border: i < filled ? '1px solid transparent' : `1px solid ${ind.inkFaint}`,
          }}
        />
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Performance Reviews
 * ------------------------------------------------------------------ */

const TaskReview = ({ employees, allEmployees }) => {
  const { user, checkPermission } = useAuth();
  const { handleSessionAuthError } = useSessionGuard();
  const { isDarkMode } = useTheme();
  const { t, currentLanguage } = useLanguage();
  const ind = getIndustry(isDarkMode);

  const [reviews, setReviews] = useState([]);
  const [skills, setSkills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [selectedPeriod, setSelectedPeriod] = useState(() => periodOf(new Date()));
  const [periodTouched, setPeriodTouched] = useState(false);
  const [segment, setSegment] = useState('all');
  const [openReview, setOpenReview] = useState(null);

  const canViewAll = checkPermission('canViewReports');
  const canSignOff = checkPermission('canManagePerformance');
  const viewerEmployeeId = String(user?.employeeId || user?.id || '');

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

  const fetchAll = useCallback(async (options = {}) => {
    const { silent = false } = options;
    if (!silent) setLoading(true);
    try {
      if (!isDemoMode()) {
        const session = await validateAndRefreshSession();
        if (!session.success) throw new Error(session.error);
      }

      const [reviewResult, skillResult] = await Promise.all([
        performanceService.getAllPerformanceReviews(),
        performanceService.getAllSkillsAssessments(),
      ]);

      if (!reviewResult.success) throw new Error(reviewResult.error || 'Failed to load reviews');
      setReviews(reviewResult.data || []);
      setSkills(skillResult.success ? (skillResult.data || []) : []);
      setFetchError(null);
    } catch (error) {
      console.error('Error loading performance reviews:', error);
      if (handleSessionAuthError(error, { silent })) return;
      setFetchError(error.message);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [handleSessionAuthError]);

  useEffect(() => { fetchAll(); }, [fetchAll]);
  useAuthenticatedPageRefresh(() => fetchAll({ silent: true }));

  const hasRealData = !loading && !fetchError && reviews.length > 0;

  /* ---------------- cycle ---------------- */

  /** Every quarter the data knows about, newest first, plus the live one. */
  const periodOptions = useMemo(() => {
    const keys = new Set([periodOf(new Date())]);
    reviews.forEach((review) => {
      if (parsePeriod(review.review_period)) keys.add(review.review_period);
    });
    return [...keys].sort(comparePeriodsDesc);
  }, [reviews]);

  // Land on the newest cycle the data actually has, unless the user picked one.
  useEffect(() => {
    if (periodTouched || periodOptions.length === 0) return;
    const withReviews = periodOptions.find((key) => reviews.some((r) => r.review_period === key));
    setSelectedPeriod(withReviews || periodOptions[0]);
  }, [periodOptions, reviews, periodTouched]);

  const calibration = useMemo(() => calibrationDate(selectedPeriod), [selectedPeriod]);
  const daysToCalibration = calibration ? daysBetween(new Date(), calibration) : null;
  const calibrationLabel = calibration
    ? formatDate(calibration, currentLanguage, { day: '2-digit', month: 'short' })
    : '—';

  /* ---------------- scope ---------------- */

  const activeEmployees = useMemo(() => filterActiveEmployees(employees), [employees]);

  /** The two biggest departments join Company in the segment control. */
  const segmentOptions = useMemo(() => {
    const counts = new Map();
    activeEmployees.forEach((emp) => {
      const key = emp.department;
      if (key) counts.set(key, (counts.get(key) || 0) + 1);
    });
    const top = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 2);
    return [
      { value: 'all', label: t('taskReview.company', 'Company') },
      ...top.map(([key]) => ({ value: key, label: departmentLabel(key) })),
    ];
  }, [activeEmployees, t, departmentLabel]);

  useEffect(() => {
    if (segment !== 'all' && !segmentOptions.some((o) => o.value === segment)) setSegment('all');
  }, [segmentOptions, segment]);

  const scopeEmployees = useMemo(() => {
    if (!canViewAll) {
      return activeEmployees.filter((emp) => String(emp.id) === viewerEmployeeId);
    }
    if (segment === 'all') return activeEmployees;
    return activeEmployees.filter((emp) => emp.department === segment);
  }, [activeEmployees, canViewAll, viewerEmployeeId, segment]);

  /* ---------------- the cycle, per employee ---------------- */

  /**
   * One row per employee in scope, carrying their review for this cycle, the
   * one before it, and the four pipeline flags every figure on the screen is
   * counted from. Built once so no two panels can disagree.
   */
  const cycleRows = useMemo(() => {
    const previousKey = previousPeriodKey(selectedPeriod);
    const window = periodWindow(selectedPeriod);

    const byEmployee = new Map();
    const previousByEmployee = new Map();
    reviews.forEach((review) => {
      const id = String(review.employee_id);
      if (review.review_period === selectedPeriod) {
        // A manager's row is the cycle's row; a self-log only fills in where
        // no manager has written one yet.
        const held = byEmployee.get(id);
        if (!held || (isSelfLogged(held) && !isSelfLogged(review))) byEmployee.set(id, review);
      } else if (review.review_period === previousKey && !isSelfLogged(review)) {
        previousByEmployee.set(id, review);
      }
    });

    const selfAssessed = new Set();
    skills.forEach((skill) => {
      const on = parseDate(skill.assessment_date);
      if (!window || !on || (on >= window.start && on < window.end)) {
        selfAssessed.add(String(skill.employee_id));
      }
    });

    return scopeEmployees.map((employee) => {
      const id = String(employee.id);
      const review = byEmployee.get(id) || null;
      const previous = previousByEmployee.get(id) || null;
      const status = String(review?.status || '');
      const score = review && !isSelfLogged(review) ? ratingOf(review) : null;
      const previousScore = ratingOf(previous);
      const deadline = managerReviewDeadline(review, calibration);

      const managerDone = score != null;
      // The pipeline is cumulative, so a filed manager review is itself proof
      // the self-assessment stage was passed. Without this a closed cycle reads
      // 0/78 self-assessed and 78/78 signed off, which is not a pipeline.
      const selfDone = managerDone
        || selfAssessed.has(id)
        || Boolean(review?.employee_comments)
        || (review != null && isSelfLogged(review));
      const calibrated = managerDone && REACHED_CALIBRATION.has(status);
      const signedOff = managerDone && SIGNED_OFF.has(status);

      return {
        id,
        employee,
        review,
        score,
        previousScore,
        delta: score != null && previousScore != null ? round1(score - previousScore) : null,
        status,
        selfDone,
        managerDone,
        calibrated,
        signedOff,
        overdue: !managerDone && deadline != null && deadline < new Date(),
        awaiting: managerDone && !signedOff && status === AWAITING_STATUS,
        waitedDays: (() => {
          const since = parseDate(review?.submitted_at) || parseDate(review?.review_date) || parseDate(review?.updated_at);
          return since ? Math.max(0, daysBetween(since, new Date())) : null;
        })(),
        signedOffRecently: (() => {
          if (!SIGNED_OFF.has(status)) return false;
          const on = parseDate(review?.approved_at) || parseDate(review?.updated_at);
          return on != null && daysBetween(on, new Date()) <= RECENT_WINDOW_DAYS;
        })(),
      };
    });
  }, [reviews, skills, scopeEmployees, selectedPeriod, calibration]);

  const inScope = cycleRows.length;

  const stages = useMemo(() => {
    const count = (predicate) => cycleRows.filter(predicate).length;
    return {
      self: count((r) => r.selfDone),
      manager: count((r) => r.managerDone),
      calibrated: count((r) => r.calibrated),
      signedOff: count((r) => r.signedOff),
      overdue: count((r) => r.overdue),
      recent: count((r) => r.signedOffRecently),
    };
  }, [cycleRows]);

  /* ---------------- scores ---------------- */

  const scored = useMemo(() => cycleRows.filter((r) => r.score != null), [cycleRows]);
  const orgAvg = useMemo(() => round1(mean(scored.map((r) => r.score))), [scored]);

  const previousAvg = useMemo(() => {
    const values = cycleRows.map((r) => r.previousScore).filter((v) => v != null);
    return values.length ? round1(mean(values)) : null;
  }, [cycleRows]);

  const avgDelta = previousAvg != null && scored.length ? round1(orgAvg - previousAvg) : null;

  const histogram = useMemo(() => {
    const counts = new Map(SCORE_BUCKETS.map((score) => [score, 0]));
    scored.forEach((row) => {
      const bucket = round1(bucketFor(row.score));
      counts.set(bucket, (counts.get(bucket) || 0) + 1);
    });
    const max = Math.max(...counts.values(), 0);
    const buckets = SCORE_BUCKETS.map((score, index) => ({
      score,
      count: counts.get(score) || 0,
      share: max > 0 ? (counts.get(score) / max) * 100 : 0,
      // Weight climbs with score: the top of the scale carries the deepest ink.
      fill: rampAt(ind, Math.max(0, 3 - Math.floor(index / 2))),
    }));
    let peak = null;
    buckets.forEach((bucket) => {
      if (max > 0 && bucket.count === max && peak == null) peak = bucket.score;
    });
    const atOrAbovePeak = peak == null ? 0 : scored.filter((r) => bucketFor(r.score) >= peak).length;
    return { buckets, peak, peakShare: pct(atOrAbovePeak, scored.length) };
  }, [scored, ind]);

  const departmentRows = useMemo(() => {
    const groups = new Map();
    scored.forEach((row) => {
      const key = row.employee.department || '—';
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(row.score);
    });
    return [...groups.entries()]
      .map(([key, values]) => ({
        key,
        label: departmentLabel(key),
        n: values.length,
        score: round1(mean(values)),
      }))
      .sort((a, b) => b.score - a.score || b.n - a.n);
  }, [scored, departmentLabel]);

  /**
   * The nominal scale starts at 3.5, but it drops to keep half a point of
   * headroom under the weakest team — a department sitting exactly on the floor
   * would otherwise draw a zero-width bar and read as missing data.
   */
  const deptFloor = useMemo(() => {
    if (departmentRows.length === 0) return DEPT_SCALE_FLOOR;
    const lowest = departmentRows.reduce((low, row) => Math.min(low, row.score), SCORE_MAX);
    return Math.min(DEPT_SCALE_FLOOR, Math.floor((lowest - 0.5) * 2) / 2);
  }, [departmentRows]);

  const belowOrg = departmentRows.filter((row) => row.score < orgAvg).length;

  /* ---------------- the decision column ---------------- */

  /** Reviews this viewer personally owes a signature on, oldest wait first. */
  const awaitingRows = useMemo(() => {
    const mine = cycleRows.filter((row) => {
      if (!row.awaiting) return false;
      if (canSignOff) return true;
      return String(row.review?.reviewer_id || '') === viewerEmployeeId;
    });
    return mine.sort((a, b) => (b.waitedDays ?? 0) - (a.waitedDays ?? 0));
  }, [cycleRows, canSignOff, viewerEmployeeId]);

  const oldestWait = awaitingRows.length ? (awaitingRows[0].waitedDays ?? null) : null;

  /** Sign-off rights: the performance permission, or being the named reviewer. */
  const mayDecide = useCallback(
    (row) => canSignOff || String(row?.review?.reviewer_id || '') === viewerEmployeeId,
    [canSignOff, viewerEmployeeId]
  );

  /**
   * Departments with manager reviews past their deadline, and who owes them —
   * the department's manager where one can be named, otherwise the reviewer
   * already on the row.
   */
  const overdueRows = useMemo(() => {
    const groups = new Map();
    cycleRows.filter((row) => row.overdue).forEach((row) => {
      const key = row.employee.department || '—';
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(row);
    });

    return [...groups.entries()]
      .map(([key, rows]) => {
        const manager = directory.find(
          (emp) => emp.department === key && MANAGER_POSITION.test(String(emp.position || ''))
        ) || directory.find(
          (emp) => String(emp.id) === String(rows.find((r) => r.review?.reviewer_id)?.review?.reviewer_id)
        ) || null;
        return { key, label: departmentLabel(key), manager, late: rows.length };
      })
      .sort((a, b) => b.late - a.late);
  }, [cycleRows, directory, departmentLabel]);

  const namedOverdue = overdueRows.slice(0, OVERDUE_ROWS);
  const remindable = namedOverdue.filter((row) => row.manager);

  /* ---------------- projection ---------------- */

  /**
   * A close date is only honest if there is a rate behind it, and one sign-off
   * is not a rate — extrapolating from it puts the close date years out. Under
   * the sample floor the slot states the work left instead.
   */
  const projection = useMemo(() => {
    const remaining = inScope - stages.signedOff;
    if (remaining <= 0) {
      return { kind: 'done' };
    }
    if (stages.recent < MIN_RATE_SAMPLE) {
      return { kind: 'remaining', remaining };
    }
    const perDay = stages.recent / RECENT_WINDOW_DAYS;
    const closes = new Date(Date.now() + Math.ceil(remaining / perDay) * DAY_MS);
    return {
      kind: 'rate',
      remaining,
      closes,
      marginDays: calibration ? daysBetween(closes, calibration) : null,
    };
  }, [inScope, stages.signedOff, stages.recent, calibration]);

  /* ---------------- actions ---------------- */

  const applyReviewUpdate = useCallback(async (row, updates, message) => {
    if (!row?.review?.id) return;
    setBusyId(row.review.id);
    try {
      const result = await performanceService.updatePerformanceReview(row.review.id, updates);
      if (!result.success) throw new Error(result.error || 'Update failed');
      setReviews((prev) => prev.map((review) => (
        String(review.id) === String(row.review.id)
          ? { ...review, ...(result.data || {}), status: updates.status ?? review.status }
          : review
      )));
      setOpenReview(null);
      setNotice({ kind: 'ok', text: message });
    } catch (error) {
      console.error('Error updating review:', error);
      if (handleSessionAuthError(error)) return;
      setNotice({ kind: 'error', text: error.message });
    } finally {
      setBusyId(null);
    }
  }, [handleSessionAuthError]);

  const signOff = useCallback((row) => applyReviewUpdate(
    row,
    { status: 'approved' },
    t('taskReview.signedOffMessage', '{name} signed off.').replace('{name}', nameOf(row.employee))
  ), [applyReviewUpdate, t, nameOf]);

  const sendBack = useCallback((row) => applyReviewUpdate(
    row,
    { status: 'draft' },
    t('taskReview.sentBackMessage', '{name} sent back for revision.').replace('{name}', nameOf(row.employee))
  ), [applyReviewUpdate, t, nameOf]);

  const remindManagers = useCallback(async () => {
    if (remindable.length === 0) return;
    setBusyId('remind');
    try {
      // Notifications address hr_users, employees address employees, so the
      // reminder has to be routed through the account behind the manager.
      const userResult = await getAllUsers();
      const accountFor = new Map(
        (userResult.success ? userResult.data || [] : [])
          .filter((account) => account.employee_id != null)
          .map((account) => [String(account.employee_id), account.id])
      );

      const sent = remindable
        .map((row) => ({ row, userId: accountFor.get(String(row.manager.id)) }))
        .filter(({ userId }) => Boolean(userId));

      await Promise.all(sent.map(({ row, userId }) => notifyUser(
        userId,
        t('taskReview.reminderTitle', 'Manager reviews outstanding'),
        t('taskReview.reminderBody', '{n} review(s) for {dept} are past their deadline for {cycle}.')
          .replace('{n}', String(row.late))
          .replace('{dept}', row.label)
          .replace('{cycle}', selectedPeriod.replace('-', ' ')),
        { type: 'warning', category: 'performance', actionUrl: '/task-review', actionLabel: t('taskReview.review', 'Review') }
      )));

      setNotice(sent.length > 0
        ? {
          kind: 'ok',
          text: t('taskReview.remindedMessage', 'Reminded {n} manager(s).').replace('{n}', String(sent.length)),
        }
        : {
          kind: 'error',
          text: t('taskReview.remindNoAccounts', 'None of those managers has an account to notify.'),
        });
    } catch (error) {
      console.error('Error sending reminders:', error);
      if (handleSessionAuthError(error)) return;
      setNotice({ kind: 'error', text: error.message });
    } finally {
      setBusyId(null);
    }
  }, [remindable, t, selectedPeriod, handleSessionAuthError]);

  useEffect(() => {
    if (!notice) return undefined;
    const id = setTimeout(() => setNotice(null), 4000);
    return () => clearTimeout(id);
  }, [notice]);

  useEffect(() => {
    if (!openReview) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') setOpenReview(null); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [openReview]);

  /* ---------------- copy ---------------- */

  const cycleLabel = selectedPeriod.replace('-', ' ');

  const headline = [
    `${t('taskReview.cycle', 'Cycle')} ${cycleLabel}`,
    t('taskReview.inScopeCount', '{n} employees in scope').replace('{n}', String(inScope)),
    calibration
      ? `${t('taskReview.calibration', 'calibration')} ${calibrationLabel}${
        daysToCalibration != null
          ? `, ${daysToCalibration >= 0
            ? t('taskReview.daysOut', '{n} days out').replace('{n}', String(daysToCalibration))
            : t('taskReview.daysPast', '{n} days past').replace('{n}', String(Math.abs(daysToCalibration)))}`
          : ''}`
      : null,
  ].filter(Boolean).join(' · ');

  const metaStyle = { fontFamily: BODY, fontSize: 11.5, color: ind.inkFaint };
  const captionStyle = { fontFamily: BODY, fontSize: 11.5, color: ind.inkFaint, marginTop: 5, lineHeight: 1.45 };
  const figureTitle = {
    fontFamily: DISPLAY, fontWeight: 600, fontSize: 14, letterSpacing: '.06em',
    textTransform: 'uppercase', color: ind.ink,
  };

  /* ---------------- render ---------------- */

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
      {/* ── TICKER — the six figures that never move ─────────────────── */}
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

        <TickerCell ind={ind} label={t('taskReview.inScope', 'In scope')} value={inScope} />
        <TickerCell
          ind={ind}
          label={t('taskReview.signedOff', 'Signed off')}
          value={stages.signedOff}
          delta={stages.recent > 0 ? stages.recent : null}
          title={t('taskReview.signedOffThisWeek', 'Signed off in the last 7 days')}
        />
        <TickerCell
          ind={ind}
          label={t('taskReview.avgScore', 'Avg score')}
          value={scored.length ? fmt1(orgAvg) : '—'}
          delta={avgDelta ? Math.abs(avgDelta).toFixed(1) : null}
          deltaDirection={avgDelta > 0 ? 'up' : 'down'}
        />
        <TickerCell
          ind={ind}
          label={t('taskReview.overdue', 'Overdue')}
          value={stages.overdue}
          // The one figure on the strip that asks for action.
          valueColor={stages.overdue > 0 ? ind.tickerUp : undefined}
        />
        <TickerCell
          ind={ind}
          label={t('taskReview.calibrationLabel', 'Calibration')}
          value={calibrationLabel.toUpperCase()}
        />

        <div
          style={{
            flex: 1,
            minWidth: 'max-content',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: 8,
            padding: '0 14px',
            borderLeft: `1px solid ${ind.tickerRule}`,
          }}
        >
          <FetchElapsedPill active={loading} isDarkMode label={t('common.fetching', 'Fetching')} />
          <FlatSelect
            ind={ind}
            onDark
            value={selectedPeriod}
            onChange={(e) => { setPeriodTouched(true); setSelectedPeriod(e.target.value); }}
            aria-label={t('taskReview.cycle', 'Cycle')}
          >
            {periodOptions.map((key) => (
              <option key={key} value={key} style={{ color: '#1d1f20' }}>
                {`${t('taskReview.cycle', 'Cycle')} ${key.replace('-', ' ')}`}
              </option>
            ))}
          </FlatSelect>
        </div>
      </div>

      {/* ── BANDS ────────────────────────────────────────────────────── */}
      <div className="flex flex-col lg:flex-row items-stretch">

        {/* ── LEFT — the evidence ──────────────────────────────────── */}
        <div
          className="flex-1 min-w-0 flex flex-col"
          style={{ padding: '22px 24px 20px', gap: 18, borderRight: `1px solid ${ind.hairline}` }}
        >
          {fetchError && (
            <div style={{ border: `1px solid ${ind.ink}`, padding: '12px 14px', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <AlertCircle size={16} strokeWidth={1.5} style={{ flex: 'none', marginTop: 2, color: ind.ink }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <Kicker ind={ind} color={ind.ink}>{t('common.error', 'Error')}</Kicker>
                <p style={{ fontFamily: BODY, fontSize: 13, color: ind.inkMuted, marginTop: 4 }}>{fetchError}</p>
                <button
                  type="button"
                  onClick={() => fetchAll()}
                  style={{
                    marginTop: 8, background: 'none', border: 'none', padding: 0, cursor: 'pointer',
                    fontFamily: DISPLAY, fontWeight: 600, fontSize: 11.5, letterSpacing: '.08em',
                    textTransform: 'uppercase', color: ind.accentDeep, textDecoration: 'underline',
                  }}
                >
                  {t('common.retry', 'Try Again')}
                </button>
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

          {/* Header row */}
          <div className="flex flex-wrap items-end justify-between" style={{ gap: 14 }}>
            <div style={{ minWidth: 0 }}>
              <h1 style={{ fontFamily: BODY, fontSize: 32, fontWeight: 400, margin: 0, color: ind.ink, lineHeight: 1.1 }}>
                {t('taskReview.title', 'Performance Reviews')}
              </h1>
              <p style={{ fontFamily: BODY, fontSize: 13, color: ind.inkMuted, marginTop: 6 }}>{headline}</p>
            </div>
            {canViewAll && segmentOptions.length > 1 && (
              <Seg
                ind={ind}
                options={segmentOptions}
                value={segment}
                onChange={setSegment}
                ariaLabel={t('taskReview.scope', 'Scope')}
              />
            )}
          </div>

          {/* ── Cycle plate ────────────────────────────────────────── */}
          <Blueprint ind={ind} style={{ padding: '18px 20px 14px', flex: 'none' }}>
            <div className="flex flex-col md:flex-row items-stretch" style={{ gap: 34 }}>
              <div style={{ flex: 'none', width: 200 }}>
                <Kicker ind={ind}>{t('taskReview.cycleCompletion', 'Cycle completion')}</Kicker>
                <div style={{ ...figure(62, ind.ink), margin: '6px 0 2px' }}>
                  {`${pct(stages.signedOff, inScope)}%`}
                </div>
                <p style={{ fontFamily: BODY, fontSize: 12.5, color: ind.inkMuted, marginBottom: 12, lineHeight: 1.45 }}>
                  {t('taskReview.ofSignedOff', '{n} of {total} signed off')
                    .replace('{n}', String(stages.signedOff))
                    .replace('{total}', String(inScope))}
                  {stages.recent > 0 && (
                    <>
                      <br />
                      <span style={{ color: ind.accentDeep }}>
                        {`▲ ${stages.recent} `}
                        {t('taskReview.thisWeek', 'this week')}
                      </span>
                    </>
                  )}
                </p>
                <p style={{ ...captionStyle, borderTop: `1px solid ${ind.rule}`, paddingTop: 9, marginTop: 0 }}>
                  {projection.kind === 'done' && t('taskReview.projectionDone', 'Every review in scope is signed off.')}
                  {projection.kind === 'remaining' && t(
                    'taskReview.projectionRemaining',
                    '{n} still to sign off before calibration on {date}.'
                  ).replace('{n}', String(projection.remaining)).replace('{date}', calibrationLabel)}
                  {projection.kind === 'rate' && (
                    <>
                      {t('taskReview.projectionRate', 'At this rate the cycle closes')}
                      {' '}
                      <span style={{ color: ind.ink, fontWeight: 600 }}>
                        {formatDate(projection.closes, currentLanguage, { day: '2-digit', month: 'short' })}
                      </span>
                      {projection.marginDays != null && (
                        projection.marginDays >= 0
                          ? ` — ${t('taskReview.beforeCalibration', '{n} days before calibration.').replace('{n}', String(projection.marginDays))}`
                          : ` — ${t('taskReview.afterCalibration', '{n} days after calibration.').replace('{n}', String(Math.abs(projection.marginDays)))}`
                      )}
                    </>
                  )}
                </p>
              </div>

              {/* The pipeline. Ramp descends with depth: the deepest accent is
                  the stage that is finished, the palest the one still open. */}
              <div
                className="flex flex-col"
                style={{ flex: 1, minWidth: 0, justifyContent: 'center', gap: 13 }}
              >
                <StageBar
                  ind={ind}
                  label={t('taskReview.stageSelf', 'Self-assessment')}
                  count={stages.self}
                  total={inScope}
                  note={stages.self >= inScope
                    ? t('taskReview.complete', 'complete')
                    : t('taskReview.nOutstanding', '{n} outstanding').replace('{n}', String(inScope - stages.self))}
                  fill={rampAt(ind, 0)}
                />
                <StageBar
                  ind={ind}
                  label={t('taskReview.stageManager', 'Manager review')}
                  count={stages.manager}
                  total={inScope}
                  note={stages.overdue > 0
                    ? t('taskReview.nOverdue', '{n} overdue').replace('{n}', String(stages.overdue))
                    : t('taskReview.nToFile', '{n} to file').replace('{n}', String(inScope - stages.manager))}
                  fill={rampAt(ind, 1)}
                />
                <StageBar
                  ind={ind}
                  label={t('taskReview.stageCalibration', 'Calibration')}
                  count={stages.calibrated}
                  total={inScope}
                  note={`${t('taskReview.session', 'session')} ${calibrationLabel}`}
                  fill={rampAt(ind, 2)}
                />
                <StageBar
                  ind={ind}
                  label={t('taskReview.stageSignedOff', 'Signed off')}
                  count={stages.signedOff}
                  total={inScope}
                  note={awaitingRows.length > 0
                    ? t('taskReview.nWaitOnYou', '{n} wait on you').replace('{n}', String(awaitingRows.length))
                    : t('taskReview.noneWaitOnYou', 'none wait on you')}
                  fill={rampAt(ind, 3)}
                />
              </div>
            </div>
          </Blueprint>

          {/* ── Bottom pair ────────────────────────────────────────── */}
          <div
            className="grid grid-cols-1 lg:grid-cols-2"
            style={{ gap: 18, flex: 1, minHeight: 300 }}
          >
            {/* Score distribution */}
            <Blueprint ind={ind} style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
              <div className="flex items-baseline justify-between" style={{ gap: 10 }}>
                <span style={figureTitle}>{t('taskReview.scoreDistribution', 'Score distribution')}</span>
                <span style={metaStyle}>
                  {t('taskReview.nReviews', '{n} reviews').replace('{n}', String(scored.length))}
                </span>
              </div>
              <p style={{ ...captionStyle, marginBottom: 14 }}>
                {scored.length > 0 && histogram.peak != null
                  ? t('taskReview.distributionCaption', 'The {avg} average peaks at {peak} — {pct}% of reviews sit at or above it')
                    .replace('{avg}', fmt1(orgAvg))
                    .replace('{peak}', fmt1(histogram.peak))
                    .replace('{pct}', String(histogram.peakShare))
                  : t('taskReview.distributionEmptyCaption', 'No scored reviews in this cycle yet')}
              </p>
              <ScoreHistogram
                ind={ind}
                buckets={histogram.buckets}
                peak={histogram.peak}
                emptyLabel={t('taskReview.noScores', 'Nothing has been scored in this cycle yet.')}
              />
            </Blueprint>

            {/* Average by department */}
            <Blueprint ind={ind} style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
              <div className="flex items-baseline justify-between" style={{ gap: 10 }}>
                <span style={figureTitle}>{t('taskReview.averageByDepartment', 'Average by department')}</span>
                <span style={metaStyle}>
                  {t('taskReview.scaleRange', 'scale {from} – {to}')
                    .replace('{from}', fmt1(deptFloor))
                    .replace('{to}', fmt1(SCORE_MAX))}
                </span>
              </div>
              <p style={{ ...captionStyle, marginBottom: 14 }}>
                {departmentRows.length > 0
                  ? t('taskReview.departmentCaption', 'The vertical rule is the org average, {avg} — {n} department(s) sit under it')
                    .replace('{avg}', fmt1(orgAvg))
                    .replace('{n}', String(belowOrg))
                  : t('taskReview.departmentEmptyCaption', 'Department averages appear once reviews are scored')}
              </p>
              <DepartmentChart
                ind={ind}
                rows={departmentRows}
                orgAvg={orgAvg}
                floor={deptFloor}
                emptyLabel={t('taskReview.noDepartmentScores', 'No department has a scored review in this cycle.')}
              />
            </Blueprint>
          </div>
        </div>

        {/* ── RIGHT — the decision column, 372px ───────────────────── */}
        <aside
          className="w-full lg:w-[372px] lg:shrink-0 flex flex-col"
          style={{ background: ind.chrome, overflow: 'hidden' }}
        >
          {/* Awaiting your sign-off */}
          <div style={{ padding: '20px 20px 12px', borderBottom: `1px solid ${ind.hairline}` }}>
            <div className="flex items-baseline justify-between" style={{ gap: 10 }}>
              <ColumnHeading ind={ind}>{t('taskReview.awaitingSignOff', 'Awaiting your sign-off')}</ColumnHeading>
              <span style={{ fontFamily: DISPLAY, fontWeight: 600, fontSize: 12, color: ind.accent, whiteSpace: 'nowrap' }}>
                {t('taskReview.nReviews', '{n} reviews').replace('{n}', String(awaitingRows.length))}
              </span>
            </div>
            <p style={captionStyle}>
              {awaitingRows.length > 0 && oldestWait != null
                ? `${t('taskReview.oldestWaited', 'Oldest has waited {n} day(s)').replace('{n}', String(oldestWait))} · ${t('taskReview.calibrationCloses', 'calibration closes {date}').replace('{date}', calibrationLabel)}`
                : t('taskReview.calibrationCloses', 'calibration closes {date}').replace('{date}', calibrationLabel)}
            </p>
          </div>

          {awaitingRows.length === 0 && (
            <div style={{ padding: '16px 20px', borderBottom: `1px solid ${ind.rule}` }}>
              <p style={{ fontFamily: BODY, fontSize: 12.5, color: ind.inkMuted, lineHeight: 1.5 }}>
                {t('taskReview.nothingAwaiting', 'Nothing is waiting on your signature for this cycle.')}
              </p>
            </div>
          )}

          {/* Two expanded rows — the focused one carries the tint */}
          {awaitingRows.slice(0, EXPANDED_ROWS).map((row, index) => (
            <div
              key={row.id}
              style={{
                padding: '14px 20px',
                borderBottom: `1px solid ${ind.rule}`,
                background: index === 0 ? ind.accentWash : 'transparent',
              }}
            >
              <div className="flex items-baseline justify-between" style={{ gap: 10 }}>
                <button
                  type="button"
                  onClick={() => setOpenReview(row)}
                  style={{
                    fontFamily: DISPLAY, fontWeight: 600, fontSize: 14, letterSpacing: '.04em',
                    textTransform: 'uppercase', color: ind.ink, background: 'none', border: 'none',
                    padding: 0, cursor: 'pointer', textAlign: 'left', minWidth: 0,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}
                >
                  {nameOf(row.employee)}
                </button>
                <span style={{ ...figure(20, ind.ink), flex: 'none' }}>{fmt1(row.score)}</span>
              </div>

              <p style={{ fontFamily: BODY, fontSize: 12.5, color: ind.inkGhost, margin: '2px 0 6px', lineHeight: 1.45 }}>
                {[
                  departmentLabel(row.employee.department),
                  row.employee.position ? t(`employeePosition.${row.employee.position}`, String(row.employee.position).replace(/_/g, ' ')) : null,
                  row.delta != null && row.delta !== 0
                    ? `${row.delta > 0 ? '▲' : '▼'} ${Math.abs(row.delta).toFixed(1)} ${t('taskReview.sinceLastCycle', 'since')} ${(previousPeriodKey(selectedPeriod) || '').replace('-', ' ')}`
                    : (row.previousScore != null ? t('taskReview.scoreUnchanged', 'score unchanged') : null),
                  row.score >= PROMOTION_SCORE ? t('taskReview.flaggedForPromotion', 'flagged for promotion') : null,
                ].filter(Boolean).join(' · ')}
              </p>

              <ScoreMeter ind={ind} score={row.score} fill={rampAt(ind, index)} />

              <div className="flex" style={{ gap: 7 }}>
                <Btn
                  ind={ind}
                  variant="primary"
                  disabled={!mayDecide(row) || busyId === row.review?.id}
                  onClick={() => signOff(row)}
                >
                  {t('taskReview.signOff', 'Sign off')}
                </Btn>
                <Btn
                  ind={ind}
                  disabled={!mayDecide(row) || busyId === row.review?.id}
                  onClick={() => sendBack(row)}
                >
                  {t('taskReview.sendBack', 'Send back')}
                </Btn>
              </div>
            </div>
          ))}

          {/* Three compact rows */}
          {awaitingRows.slice(EXPANDED_ROWS, EXPANDED_ROWS + COMPACT_ROWS).map((row) => (
            <button
              key={row.id}
              type="button"
              onClick={() => setOpenReview(row)}
              className="flex items-center justify-between w-full"
              style={{
                padding: '12px 20px',
                borderBottom: `1px solid ${ind.rule}`,
                gap: 10,
                background: 'transparent',
                border: 'none',
                borderBottomWidth: 1,
                borderBottomStyle: 'solid',
                borderBottomColor: ind.rule,
                borderRadius: 0,
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              <span style={{ minWidth: 0 }}>
                <span
                  className="block"
                  style={{ fontFamily: BODY, fontSize: 13, color: ind.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                >
                  {nameOf(row.employee)}
                </span>
                <span className="block" style={{ ...metaStyle, marginTop: 2 }}>
                  {`${departmentLabel(row.employee.department)} · ${fmt1(row.score)}`}
                  {row.waitedDays != null
                    ? ` · ${t('taskReview.waitedDays', 'waited {n} day(s)').replace('{n}', String(row.waitedDays))}`
                    : ''}
                </span>
              </span>
              <ArrowRight size={15} strokeWidth={1.5} style={{ flex: 'none', color: ind.inkFaint }} />
            </button>
          ))}

          {/* Overdue manager reviews */}
          <div style={{ padding: '18px 20px 12px', borderBottom: `1px solid ${ind.hairline}`, marginTop: 6 }}>
            <div className="flex items-baseline justify-between" style={{ gap: 10 }}>
              <ColumnHeading ind={ind}>{t('taskReview.overdueManagerReviews', 'Overdue manager reviews')}</ColumnHeading>
              <Tag ind={ind} variant="outline">{stages.overdue}</Tag>
            </div>
          </div>

          <div style={{ padding: '14px 20px', display: 'flex', flexDirection: 'column', gap: 11 }}>
            {namedOverdue.length === 0 && (
              <p style={{ fontFamily: BODY, fontSize: 12.5, color: ind.inkMuted, lineHeight: 1.5 }}>
                {t('taskReview.noOverdueReviews', 'Every manager review is still inside its deadline.')}
              </p>
            )}

            {namedOverdue.map((row, index) => (
              <div key={row.key}>
                <div className="flex items-baseline justify-between" style={{ gap: 10, marginBottom: 4 }}>
                  <span
                    style={{
                      fontFamily: BODY, fontSize: 12.5, color: ind.ink, minWidth: 0,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}
                  >
                    {row.label}
                    {row.manager ? ` · ${nameOf(row.manager)}` : ''}
                  </span>
                  <span style={{ ...figure(12.5, ind.ink), flex: 'none' }}>
                    {t('taskReview.nLate', '{n} late').replace('{n}', String(row.late))}
                  </span>
                </div>
                <Bar
                  ind={ind}
                  value={stages.overdue > 0 ? row.late / stages.overdue : 0}
                  fill={rampAt(ind, index)}
                  height={8}
                />
              </div>
            ))}

            {remindable.length > 0 && canSignOff && (
              <Btn
                ind={ind}
                onClick={remindManagers}
                disabled={busyId === 'remind'}
                style={{ alignSelf: 'flex-start', marginTop: 2 }}
              >
                {t('taskReview.remindAll', 'Remind all {n}').replace('{n}', String(remindable.length))}
              </Btn>
            )}
          </div>
        </aside>
      </div>

      {/* ── Review detail ────────────────────────────────────────────── */}
      {openReview && (
        <ReviewModal
          ind={ind}
          t={t}
          currentLanguage={currentLanguage}
          row={openReview}
          name={nameOf(openReview.employee)}
          departmentLabel={departmentLabel}
          period={selectedPeriod}
          canSignOff={mayDecide(openReview)}
          busy={busyId === openReview.review?.id}
          onSignOff={() => signOff(openReview)}
          onSendBack={() => sendBack(openReview)}
          onClose={() => setOpenReview(null)}
        />
      )}
    </div>
  );
};

/* ------------------------------------------------------------------ *
 * Review detail — the written half of the review, and the two decisions
 * ------------------------------------------------------------------ */

const COMPETENCIES = [
  ['technical_skills_rating', 'Technical'],
  ['communication_rating', 'Communication'],
  ['leadership_rating', 'Leadership'],
  ['teamwork_rating', 'Teamwork'],
  ['problem_solving_rating', 'Problem solving'],
];

function ReviewModal({
  ind, t, currentLanguage, row, name, departmentLabel, period,
  canSignOff, busy, onSignOff, onSendBack, onClose,
}) {
  const review = row.review || {};
  const passages = [
    ['strengths', t('taskReview.strengths', 'Strengths'), review.strengths],
    ['areas', t('taskReview.areasForImprovement', 'Areas for improvement'), review.areas_for_improvement],
    ['achievements', t('taskReview.achievements', 'Achievements'), review.achievements],
    ['comments', t('taskReview.managerComments', 'Manager comments'), review.comments],
    ['employee', t('taskReview.employeeSelfAssessment', 'Employee self-assessment'), review.employee_comments],
  ].filter(([, , text]) => Boolean(text));

  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-50 p-4 overflow-y-auto"
      style={{ background: 'rgba(29,31,32,.55)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ background: ind.ground, border: `1px solid ${ind.ink}`, borderRadius: 0, width: '100%', maxWidth: 560 }}>
        <div
          className="flex items-start justify-between"
          style={{ gap: 12, padding: '18px 20px', borderBottom: `1px solid ${ind.hairline}` }}
        >
          <div style={{ minWidth: 0 }}>
            <ColumnHeading ind={ind}>{name}</ColumnHeading>
            <p style={{ fontFamily: BODY, fontSize: 12.5, color: ind.inkMuted, marginTop: 4 }}>
              {[
                departmentLabel(row.employee.department),
                `${t('taskReview.cycle', 'Cycle')} ${period.replace('-', ' ')}`,
                review.review_date ? formatDate(review.review_date, currentLanguage) : null,
              ].filter(Boolean).join(' · ')}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('common.close', 'Close')}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: ind.inkMuted, padding: 0 }}
          >
            <X size={16} strokeWidth={1.5} />
          </button>
        </div>

        <div style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="flex items-end justify-between" style={{ gap: 14 }}>
            <div>
              <Kicker ind={ind}>{t('taskReview.overallRating', 'Overall')}</Kicker>
              <div style={{ ...figure(38, ind.ink), marginTop: 4 }}>{fmt1(row.score)}</div>
            </div>
            {row.delta != null && (
              <span style={{ fontFamily: BODY, fontSize: 12.5, color: ind.inkMuted }}>
                {row.delta === 0
                  ? t('taskReview.scoreUnchanged', 'score unchanged')
                  : `${row.delta > 0 ? '▲' : '▼'} ${Math.abs(row.delta).toFixed(1)} ${t('taskReview.sinceLastCycle', 'since')} ${(previousPeriodKey(period) || '').replace('-', ' ')}`}
              </span>
            )}
          </div>

          {COMPETENCIES.some(([key]) => Number(review[key]) > 0) && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {COMPETENCIES.map(([key, label], index) => {
                const value = Number(review[key]);
                if (!Number.isFinite(value) || value <= 0) return null;
                return (
                  <div key={key}>
                    <div className="flex items-baseline justify-between" style={{ gap: 10, marginBottom: 3 }}>
                      <span style={{ fontFamily: BODY, fontSize: 12.5, color: ind.ink }}>
                        {t(`taskReview.competency.${key}`, label)}
                      </span>
                      <span style={figure(12.5, ind.ink)}>{fmt1(value)}</span>
                    </div>
                    <Bar ind={ind} value={value / SCORE_MAX} fill={rampAt(ind, Math.floor(index / 2))} height={7} />
                  </div>
                );
              })}
            </div>
          )}

          {passages.length === 0 && (
            <p style={{ fontFamily: BODY, fontSize: 12.5, color: ind.inkMuted }}>
              {t('taskReview.noWrittenReview', 'No written feedback was recorded on this review.')}
            </p>
          )}

          {passages.map(([key, label, text]) => (
            <div key={key}>
              <Kicker ind={ind} color={ind.inkMuted}>{label}</Kicker>
              <p style={{ fontFamily: BODY, fontSize: 13, color: ind.ink, marginTop: 5, lineHeight: 1.5 }}>
                {isDemoMode()
                  ? text
                  : <TranslatedText text={text} record={{ entityType: 'performance_review', entityId: review.id, field: key }} />}
              </p>
            </div>
          ))}
        </div>

        <div
          className="flex items-center justify-end"
          style={{ gap: 8, padding: '14px 20px', borderTop: `1px solid ${ind.hairline}` }}
        >
          <Btn ind={ind} onClick={onClose}>{t('taskReview.cancel', 'Cancel')}</Btn>
          <Btn ind={ind} disabled={!canSignOff || busy} onClick={onSendBack}>
            {t('taskReview.sendBack', 'Send back')}
          </Btn>
          <Btn ind={ind} variant="primary" disabled={!canSignOff || busy} onClick={onSignOff}>
            {t('taskReview.signOff', 'Sign off')}
          </Btn>
        </div>
      </div>
    </div>
  );
}

export default TaskReview;
