/**
 * Recruitment Pipeline — direction 2b, "the board is the content".
 *
 * Full-width main column (no decision rail) with a 44px steel ticker across the
 * top, because on this screen the board *is* the thing you came to read.
 *
 * The read, top to bottom:
 *   ticker      — the six figures that never change position, so you can scan them
 *   page head   — what the board contains, plus the three controls that reshape it
 *   stage strip — five equal cells whose 5px underbars taper with share of intake.
 *                 The taper IS the funnel; there is no separate funnel graphic.
 *   board       — five blueprint columns of hairline candidate rectangles. Exactly
 *                 one card in Interview and one in Offer is promoted to the accent
 *                 tint and given a live line + two inline buttons, so the eye lands
 *                 on today's work without reading a single name.
 *
 * Column heights stay equal because a flex spacer pushes the "N more →" foot to
 * the bottom of every column. Hired ends with a YTD plate instead, and its cards
 * end with "Create record →" so hiring and employee records are one flow.
 *
 * Design system: "Industry" (src/theme/industry.js). Radius is 0 everywhere,
 * cards are outlines with four registration corners, status reads through weight
 * and rule rather than colour.
 */
import _React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Save, Calendar, MapPin, Video, MessageSquare, AlertCircle, Star } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';
import {
  getAllApplications,
  getAllJobPostings,
  getUpcomingInterviews,
  updateApplicationStatus,
  updateApplicationRating,
  createInterviewSchedule,
  getRecruitmentStats,
  createJobPosting,
} from '../services/recruitmentService';
import { isDemoMode, getDemoApplicationStatus, getDemoJobTitle, getDemoJobDescription, getDemoApplicationNotes } from '../utils/demoHelper';
import { useSessionGuard, useAuthenticatedPageRefresh } from '../hooks/useSessionGuard.js';
import { validateAndRefreshSession } from '../utils/sessionHelper.js';
import { formatDate as formatLocaleDate, groupNumberInput } from '../utils/localeFormat.js';
import { DatePicker } from './ui/date-picker.jsx';
import { TimePicker } from './ui/time-picker.jsx';
import { TranslatedText } from './ui/translated-text.jsx';
import { FetchElapsedPill } from './ui/fetch-elapsed-pill';
import { getIndustry, DISPLAY, BODY, figure } from '../theme/industry.js';
import {
  Blueprint, Tag, Btn, Seg, Kicker, TickerCell, LiveClock, FlatSelect,
} from './ui/industry.jsx';

/* ------------------------------------------------------------------ *
 * Screen constants — the policy this board reads against
 * ------------------------------------------------------------------ */

/** The five cells of the funnel, in order. `status` is the value stored on a row. */
const STAGES = [
  { key: 'screening', status: 'under review' },
  { key: 'shortlisted', status: 'shortlisted' },
  { key: 'interview', status: 'interview scheduled' },
  { key: 'offer', status: 'offer extended' },
  { key: 'hired', status: 'hired' },
];

const STAGE_KEYS = STAGES.map(s => s.key);

/** Cards shown before a column collapses the rest behind "N more →". */
const CARDS_PER_COLUMN = 4;
/** A screening card older than this stops reading "CV parsed" and starts asking for a human. */
const STALE_SCREENING_DAYS = 5;
/** Hires the month is measured against, for the HIRED cell's "of N target". */
const MONTHLY_HIRE_TARGET = 3;
/** "Offers accepted this week" and the YTD plate both read against these windows. */
const WEEK_DAYS = 7;

const DAY_MS = 86400000;

/* ------------------------------------------------------------------ *
 * Helpers
 * ------------------------------------------------------------------ */

const parseDate = (value) => {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
};

const daysSince = (value) => {
  const d = parseDate(value);
  if (!d) return null;
  return Math.max(0, Math.floor((Date.now() - d.getTime()) / DAY_MS));
};

/** How long this candidate has sat in their current stage. */
const ageInStage = (app) => daysSince(app?.reviewed_date || app?.application_date) ?? 0;

const candidateName = (app) => (
  app?.applicant?.full_name
  || `${app?.applicant?.first_name || ''} ${app?.applicant?.last_name || ''}`.trim()
  || app?.candidateName
  || ''
);

const stageKeyOf = (app) => {
  const status = String(app?.status || '').toLowerCase();
  return STAGES.find(s => s.status === status)?.key || null;
};

const departmentOf = (app) => app?.job_posting?.department || app?.department || null;

const pct = (n, d) => (d > 0 ? Math.round((n / d) * 100) : 0);

/* ------------------------------------------------------------------ *
 * Recruitment
 * ------------------------------------------------------------------ */

const Recruitment = () => {
  const { t, currentLanguage } = useLanguage();
  const { isDarkMode } = useTheme();
  const ind = useMemo(() => getIndustry(isDarkMode), [isDarkMode]);
  const navigate = useNavigate();
  const { handleSessionAuthError } = useSessionGuard();

  const [applications, setApplications] = useState([]);
  const [jobPostings, setJobPostings] = useState([]);
  const [interviews, setInterviews] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(null);

  const [viewMode, setViewMode] = useState('board');   // 'board' | 'table'
  const [searchQuery, setSearchQuery] = useState('');
  const [department, setDepartment] = useState('all');
  const [expandedColumns, setExpandedColumns] = useState([]);

  const [detailApplication, setDetailApplication] = useState(null);
  const [detailFocus, setDetailFocus] = useState(null);   // 'rating' | 'notes' | null
  const [interviewApplication, setInterviewApplication] = useState(null);
  const [showPostJobModal, setShowPostJobModal] = useState(false);

  const fetchData = useCallback(async (options = {}) => {
    const { silent = false } = options;
    if (!silent) setLoading(true);
    try {
      if (!isDemoMode()) {
        const sessionValidation = await validateAndRefreshSession();
        if (!sessionValidation.success) throw new Error(sessionValidation.error);
      }

      const [applicationsResult, statsResult, postingsResult, interviewsResult] = await Promise.all([
        getAllApplications(),
        getRecruitmentStats(),
        getAllJobPostings(),
        getUpcomingInterviews(),
      ]);

      if (applicationsResult.success) setApplications(applicationsResult.data || []);
      if (statsResult.success) setStats(statsResult.data);
      if (postingsResult.success) setJobPostings(postingsResult.data || []);
      if (interviewsResult.success) setInterviews(interviewsResult.data || []);
      setFetchError(null);
    } catch (error) {
      console.error('Error fetching recruitment data:', error);
      if (!handleSessionAuthError(error, { silent })) {
        setFetchError(t('errors.loadFailed', 'Failed to load data'));
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, [handleSessionAuthError, t]);

  useEffect(() => { fetchData(); }, [fetchData]);
  useAuthenticatedPageRefresh(() => fetchData({ silent: true }));

  const hasRealData = !loading && !fetchError && applications.length > 0;

  /* -- scoping ---------------------------------------------------- */

  const searchableText = useCallback((app) => ([
    candidateName(app),
    app.job_posting?.title || app.job_posting?.position || app.position || '',
    departmentOf(app) || '',
    app.applicant?.email || app.email || '',
  ].join(' ').toLowerCase()), []);

  const scopedApplications = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return applications.filter(app => {
      if (department !== 'all' && departmentOf(app) !== department) return false;
      if (q && !searchableText(app).includes(q)) return false;
      return true;
    });
  }, [applications, searchQuery, department, searchableText]);

  const departmentOptions = useMemo(() => {
    const seen = new Set();
    applications.forEach(app => { const d = departmentOf(app); if (d) seen.add(d); });
    jobPostings.forEach(job => { if (job.department) seen.add(job.department); });
    return Array.from(seen).sort();
  }, [applications, jobPostings]);

  /* -- the funnel ------------------------------------------------- */

  /** Every stage's candidates, longest-waiting first — the work surfaces itself. */
  const byStage = useMemo(() => {
    const out = Object.fromEntries(STAGE_KEYS.map(k => [k, []]));
    scopedApplications.forEach(app => {
      const key = stageKeyOf(app);
      if (key) out[key].push(app);
    });
    STAGE_KEYS.forEach(k => out[k].sort((a, b) => ageInStage(b) - ageInStage(a)));
    return out;
  }, [scopedApplications]);

  const counts = useMemo(
    () => Object.fromEntries(STAGE_KEYS.map(k => [k, byStage[k].length])),
    [byStage]
  );

  /**
   * Share of intake per stage — the number the underbars encode. Intake is the
   * screening count, so screening always reads 100% and the taper below it is
   * the funnel. Guarded so a stage can never overrun the bar.
   */
  const intake = useMemo(
    () => Math.max(counts.screening, ...STAGE_KEYS.map(k => counts[k]), 1),
    [counts]
  );

  /** Interview schedules keyed by application, soonest first. */
  const nextInterviewByApp = useMemo(() => {
    const map = new Map();
    [...interviews]
      .filter(i => parseDate(i.scheduled_date))
      .sort((a, b) => new Date(a.scheduled_date) - new Date(b.scheduled_date))
      .forEach(i => {
        const id = i.application_id || i.application?.id;
        if (id && !map.has(id)) map.set(id, i);
      });
    return map;
  }, [interviews]);

  /**
   * The one promoted card per column. Interview promotes whoever is scheduled
   * soonest; Offer promotes whoever has been waiting longest on a reply.
   */
  const promoted = useMemo(() => {
    const interviewPool = byStage.interview;
    const withSchedule = interviewPool
      .filter(app => nextInterviewByApp.has(app.id))
      .sort((a, b) => new Date(nextInterviewByApp.get(a.id).scheduled_date)
        - new Date(nextInterviewByApp.get(b.id).scheduled_date));
    return {
      interview: (withSchedule[0] || interviewPool[0])?.id ?? null,
      offer: byStage.offer[0]?.id ?? null,   // already sorted oldest-in-stage first
    };
  }, [byStage, nextInterviewByApp]);

  /* -- ticker figures --------------------------------------------- */

  const metrics = useMemo(() => {
    const total = applications.length;
    const active = applications.filter(a => {
      const key = stageKeyOf(a);
      return key && key !== 'hired';
    }).length;
    const hired = applications.filter(a => stageKeyOf(a) === 'hired');
    const conversion = pct(hired.length, total);

    // Time to hire is measured, not assumed: application → the day they were hired.
    const spans = hired
      .map(a => {
        const from = parseDate(a.application_date);
        const to = parseDate(a.reviewed_date);
        if (!from || !to || to < from) return null;
        return Math.round((to - from) / DAY_MS);
      })
      .filter(n => n != null);
    const timeToHire = spans.length
      ? Math.round(spans.reduce((s, n) => s + n, 0) / spans.length)
      : null;

    const offersOut = applications.filter(a => stageKeyOf(a) === 'offer').length;
    const openReqs = jobPostings.filter(j => ['open', 'active', 'published'].includes(String(j.status || '').toLowerCase())).length;
    const acceptedThisWeek = hired.filter(a => (daysSince(a.reviewed_date) ?? 999) < WEEK_DAYS).length;

    const now = new Date();
    const hiredThisMonth = hired.filter(a => {
      const d = parseDate(a.reviewed_date);
      return d && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    }).length;
    const hiredThisYear = hired.filter(a => {
      const d = parseDate(a.reviewed_date);
      return d && d.getFullYear() === now.getFullYear();
    }).length;

    return {
      total, active, conversion, timeToHire, offersOut, openReqs,
      acceptedThisWeek, hiredThisMonth, hiredThisYear,
    };
  }, [applications, jobPostings]);

  /* -- actions ---------------------------------------------------- */

  const handleStatusUpdate = useCallback(async (applicationId, newStatus) => {
    try {
      const result = await updateApplicationStatus(applicationId, newStatus);
      if (result.success) {
        await fetchData({ silent: true });
      } else {
        console.error('Failed to update application status:', result.error);
        setFetchError(t('errors.updateFailed', 'Failed to update status'));
      }
    } catch (error) {
      console.error('Error updating status:', error);
      if (handleSessionAuthError(error)) return;
      setFetchError(t('errors.updateFailed', 'Failed to update status'));
    }
  }, [fetchData, handleSessionAuthError, t]);

  const openDetail = useCallback((app, focus = null) => {
    setDetailApplication(app);
    setDetailFocus(focus);
  }, []);

  const advanceStage = useCallback((app) => {
    const idx = STAGE_KEYS.indexOf(stageKeyOf(app));
    if (idx < 0 || idx >= STAGES.length - 1) return;
    handleStatusUpdate(app.id, STAGES[idx + 1].status);
  }, [handleStatusUpdate]);

  const toggleColumn = useCallback((key) => {
    setExpandedColumns(prev => (prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]));
  }, []);

  /* -- labels ------------------------------------------------------ */

  const stageLabel = useCallback((key) => ({
    screening: t('recruitment.pipeline.screening', 'Screening'),
    shortlisted: t('recruitment.pipeline.shortlisted', 'Shortlisted'),
    interview: t('recruitment.pipeline.interview', 'Interview'),
    offer: t('recruitment.pipeline.offer', 'Offer'),
    hired: t('recruitment.pipeline.hired', 'Hired'),
  }[key] || key), [t]);

  /**
   * The line under each stage count. Screening states the raw intake; the middle
   * stages state what share of the stage above them got through; Offer states how
   * many replies are outstanding; Hired states progress against the month's target.
   */
  const stageQualifier = useCallback((key, index) => {
    if (key === 'screening') return `${counts.screening} ${t('recruitment.candidates', 'candidates')}`;
    if (key === 'offer') {
      return t('recruitment.board.awaitingReply', '{n} awaiting reply').replace('{n}', String(counts.offer));
    }
    if (key === 'hired') {
      return t('recruitment.board.ofTarget', 'of {n} target').replace('{n}', String(MONTHLY_HIRE_TARGET));
    }
    const prev = counts[STAGE_KEYS[index - 1]];
    return t('recruitment.board.passRate', '{n}% pass').replace('{n}', String(pct(counts[key], prev)));
  }, [counts, t]);

  const roleOf = useCallback((app) => {
    if (isDemoMode()) return getDemoJobTitle(app.job_posting, t);
    if (app.job_posting?.title) return <TranslatedText text={app.job_posting.title} />;
    if (app.job_posting?.position) return t(`employeePosition.${app.job_posting.position}`, app.job_posting.position);
    return t('common.notAvailable', 'N/A');
  }, [t]);

  const shortDate = useCallback(
    (value) => (value ? formatLocaleDate(value, currentLanguage, { day: 'numeric', month: 'short' }) : '—'),
    [currentLanguage]
  );

  /* -- render ------------------------------------------------------ */

  const headSub = [
    t('recruitment.board.openReqs', '{n} open requisitions').replace('{n}', String(metrics.openReqs)),
    t('recruitment.board.inPlay', '{n} candidates in play').replace('{n}', String(metrics.active)),
    t('recruitment.board.acceptedThisWeek', '{n} offers accepted this week').replace('{n}', String(metrics.acceptedThisWeek)),
  ].join(' · ');

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
      {/* ── TICKER — replaces metric cards. Never both. ─────────────── */}
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

        <TickerCell ind={ind} label={t('recruitment.metrics.totalCandidates', 'Candidates')} value={metrics.total} />
        <TickerCell ind={ind} label={t('recruitment.metrics.activeInPipeline', 'Active')} value={metrics.active} />
        <TickerCell ind={ind} label={t('recruitment.metrics.conversionRate', 'Conversion')} value={`${metrics.conversion}%`} />
        <TickerCell
          ind={ind}
          label={t('recruitment.metrics.avgTimeToHire', 'Time to hire')}
          value={metrics.timeToHire != null ? `${metrics.timeToHire}d` : '—'}
        />
        <TickerCell
          ind={ind}
          label={t('recruitment.metrics.offersOut', 'Offers out')}
          value={metrics.offersOut}
          // The one figure on the strip that decays: every day it sits, it costs you.
          valueColor={ind.tickerUp}
        />
        <TickerCell ind={ind} label={t('recruitment.metrics.openReqs', 'Open reqs')} value={metrics.openReqs} />

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
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
            aria-label={t('recruitment.department', 'Department')}
            style={{ maxWidth: 200 }}
          >
            <option value="all" style={{ color: '#1d1f20' }}>
              {t('recruitment.board.allDepartments', 'All departments')}
            </option>
            {departmentOptions.map(dept => (
              <option key={dept} value={dept} style={{ color: '#1d1f20' }}>
                {t(`employeeDepartment.${dept}`, dept)}
              </option>
            ))}
          </FlatSelect>
        </div>
      </div>

      <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 18 }}>
        {fetchError && (
          <div style={{ border: `1px solid ${ind.ink}`, padding: '12px 14px', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <AlertCircle size={16} strokeWidth={1.5} style={{ flex: 'none', marginTop: 2, color: ind.ink }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <Kicker ind={ind} color={ind.ink}>{t('common.error', 'Error')}</Kicker>
              <p style={{ fontFamily: BODY, fontSize: 13, color: ind.inkMuted, marginTop: 4 }}>{fetchError}</p>
              <button
                type="button"
                onClick={() => { setFetchError(null); fetchData(); }}
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

        {/* ── PAGE HEAD ────────────────────────────────────────────── */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div style={{ minWidth: 0 }}>
            <h1
              style={{
                fontFamily: DISPLAY, fontWeight: 600, fontSize: 30, lineHeight: 1.05,
                letterSpacing: '.02em', textTransform: 'uppercase', color: ind.ink, margin: 0,
              }}
            >
              {t('recruitment.title', 'Recruitment Pipeline')}
            </h1>
            <p style={{ fontFamily: BODY, fontSize: 13, color: ind.inkMuted, marginTop: 6 }}>
              {headSub}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <SearchField ind={ind} value={searchQuery} onChange={setSearchQuery} t={t} />
            <Seg
              ind={ind}
              ariaLabel={t('recruitment.viewMode', 'View')}
              value={viewMode}
              onChange={setViewMode}
              options={[
                { value: 'board', label: t('recruitment.boardView', 'Board') },
                { value: 'table', label: t('recruitment.tableView', 'Table') },
              ]}
            />
            <Btn ind={ind} variant="primary" onClick={() => setShowPostJobModal(true)}>
              + {t('recruitment.postNewJob', 'Post new job')}
            </Btn>
          </div>
        </div>

        {/* ── STAGE STRIP — the underbar taper is the funnel ────────── */}
        <div style={{ overflowX: 'auto' }}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: `repeat(${STAGES.length}, minmax(0, 1fr))`,
              border: `1px solid ${ind.hairline}`,
              minWidth: 720,
            }}
          >
            {STAGES.map((stage, index) => {
              const terminal = stage.key === 'hired';
              return (
                <div
                  key={stage.key}
                  style={{
                    padding: '12px 14px 0',
                    borderLeft: index === 0 ? 'none' : `1px solid ${ind.hairline}`,
                    background: terminal ? ind.accentWash : 'transparent',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 6,
                  }}
                >
                  <Kicker ind={ind} color={ind.inkMuted}>
                    {terminal
                      ? `${stageLabel(stage.key)}, ${formatLocaleDate(new Date().toISOString(), currentLanguage, { month: 'long' })}`
                      : stageLabel(stage.key)}
                  </Kicker>
                  <div style={figure(26, ind.ink)}>{counts[stage.key]}</div>
                  <div style={{ fontFamily: BODY, fontSize: 11.5, color: ind.inkMuted }}>
                    {stageQualifier(stage.key, index)}
                  </div>
                  {/* 5px accent underbar — width is this stage's share of intake. */}
                  <div style={{ marginTop: 'auto', paddingTop: 10 }}>
                    <div style={{ height: 5, background: ind.rule }}>
                      <div
                        style={{
                          height: '100%',
                          width: `${Math.min(100, pct(counts[stage.key], intake))}%`,
                          background: ind.accent,
                          transition: 'width .45s ease',
                        }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── BOARD / TABLE ────────────────────────────────────────── */}
        {viewMode === 'board' ? (
          <div style={{ overflowX: 'auto' }}>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: `repeat(${STAGES.length}, minmax(0, 1fr))`,
                gap: 14,
                alignItems: 'stretch',
                minWidth: 980,
              }}
            >
              {STAGES.map(stage => (
                <StageColumn
                  key={stage.key}
                  ind={ind}
                  t={t}
                  stageKey={stage.key}
                  label={stageLabel(stage.key)}
                  applications={byStage[stage.key]}
                  expanded={expandedColumns.includes(stage.key)}
                  onToggleExpand={() => toggleColumn(stage.key)}
                  promotedId={promoted[stage.key] ?? null}
                  nextInterviewByApp={nextInterviewByApp}
                  roleOf={roleOf}
                  shortDate={shortDate}
                  onOpen={openDetail}
                  onAdvance={advanceStage}
                  // Hand the hired candidate to 2d so the record starts prefilled
                  // and can stamp its own provenance instead of being retyped.
                  onCreateRecord={(app) => navigate('/employees/add', {
                    state: {
                      fromApplication: {
                        id: app.id,
                        name: candidateName(app),
                        email: app.applicant?.email || '',
                        phone: app.applicant?.phone || '',
                        department: departmentOf(app) || '',
                        position: app.job_posting?.position || '',
                        jobTitle: app.job_posting?.title || '',
                        offerDate: app.reviewed_date || app.application_date || null,
                      },
                    },
                  })}
                  ytd={{ hires: metrics.hiredThisYear, avgDays: metrics.timeToHire }}
                />
              ))}
            </div>
          </div>
        ) : (
          <CandidateTable
            ind={ind}
            t={t}
            applications={scopedApplications}
            stats={stats}
            roleOf={roleOf}
            shortDate={shortDate}
            stageLabel={stageLabel}
            onOpen={openDetail}
            onSchedule={setInterviewApplication}
          />
        )}
      </div>

      {/* ── MODALS ───────────────────────────────────────────────────── */}
      {detailApplication && (
        <ApplicationDetailModal
          ind={ind}
          application={detailApplication}
          focus={detailFocus}
          onClose={() => { setDetailApplication(null); setDetailFocus(null); }}
          onUpdate={() => fetchData({ silent: true })}
          onStatusUpdate={handleStatusUpdate}
          onScheduleInterview={(app) => {
            setDetailApplication(null);
            setDetailFocus(null);
            setInterviewApplication(app);
          }}
        />
      )}

      {interviewApplication && (
        <InterviewScheduleModal
          ind={ind}
          application={interviewApplication}
          onClose={() => setInterviewApplication(null)}
          onSuccess={() => { setInterviewApplication(null); fetchData({ silent: true }); }}
        />
      )}

      {showPostJobModal && (
        <PostJobModal
          ind={ind}
          onClose={() => setShowPostJobModal(false)}
          onSuccess={(droppedColumns) => {
            setShowPostJobModal(false);
            // The posting saved, but this deployment's table had no home for these.
            if (droppedColumns?.length) {
              setFetchError(
                t('recruitment.fieldsNotStored', 'Job posted, but these fields are not in your job_postings table and were not saved: {fields}')
                  .replace('{fields}', droppedColumns.join(', '))
              );
            }
            fetchData({ silent: true });
          }}
        />
      )}
    </div>
  );
};

/* ------------------------------------------------------------------ *
 * Search field — a hairline box, not a pill
 * ------------------------------------------------------------------ */

function SearchField({ ind, value, onChange, t }) {
  return (
    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
      <span
        aria-hidden="true"
        style={{ position: 'absolute', left: 8, fontSize: 12, color: ind.inkMuted, lineHeight: 1 }}
      >
        ⌕
      </span>
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={t('recruitment.searchPlaceholder', 'Search candidates')}
        aria-label={t('recruitment.searchPlaceholder', 'Search candidates')}
        style={{
          fontFamily: BODY,
          fontSize: 13,
          color: ind.ink,
          background: 'transparent',
          border: `1px solid ${ind.hairline}`,
          borderRadius: 0,
          padding: '5px 26px 5px 22px',
          width: 210,
          outline: 'none',
        }}
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          aria-label={t('common.clear', 'Clear')}
          style={{
            position: 'absolute', right: 6, background: 'none', border: 'none',
            padding: 0, cursor: 'pointer', color: ind.inkMuted, lineHeight: 0,
          }}
        >
          <X size={13} strokeWidth={1.5} />
        </button>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Board column
 * ------------------------------------------------------------------ */

/**
 * One blueprint column. The flex spacer before the foot is what keeps every
 * column the same height regardless of how many cards it holds.
 */
function StageColumn({
  ind, t, stageKey, label, applications, expanded, onToggleExpand, promotedId,
  nextInterviewByApp, roleOf, shortDate, onOpen, onAdvance, onCreateRecord, ytd,
}) {
  const visible = expanded ? applications : applications.slice(0, CARDS_PER_COLUMN);
  const hidden = applications.length - visible.length;
  const isHired = stageKey === 'hired';

  const moreLink = (hidden > 0 || expanded) ? (
    <button
      type="button"
      onClick={onToggleExpand}
      style={{
        background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left',
        fontFamily: DISPLAY, fontWeight: 600, fontSize: 11, letterSpacing: '.1em',
        textTransform: 'uppercase', color: ind.accentDeep,
      }}
    >
      {expanded
        ? t('recruitment.board.showLess', 'Show less ↑')
        : t('recruitment.board.more', '{n} more →').replace('{n}', String(hidden))}
    </button>
  ) : null;

  return (
    <Blueprint ind={ind} style={{ display: 'flex', flexDirection: 'column', minHeight: 340 }}>
      {/* Column header */}
      <div
        style={{
          display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
          gap: 8, padding: '9px 11px', borderBottom: `1px solid ${ind.hairline}`,
        }}
      >
        <Kicker ind={ind} color={ind.ink} style={{ letterSpacing: '.13em' }}>{label}</Kicker>
        <span style={figure(13, ind.inkMuted)}>{applications.length}</span>
      </div>

      {/* Cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 11 }}>
        {visible.length === 0 ? (
          <p style={{ fontFamily: BODY, fontSize: 12, color: ind.inkFaint }}>
            {t('recruitment.pipeline.noCandidates', 'No candidates in this stage')}
          </p>
        ) : (
          visible.map(app => (
            <CandidateCard
              key={app.id}
              ind={ind}
              t={t}
              app={app}
              stageKey={stageKey}
              promoted={app.id === promotedId}
              interview={nextInterviewByApp.get(app.id) || null}
              roleOf={roleOf}
              shortDate={shortDate}
              onOpen={onOpen}
              onAdvance={onAdvance}
              onCreateRecord={onCreateRecord}
            />
          ))
        )}
        {/* Hired keeps its overflow link with the cards; its foot belongs to the YTD plate. */}
        {isHired && moreLink}
      </div>

      {/* Spacer — this is what equalises column heights. */}
      <div style={{ flex: 1 }} />

      {/* Foot */}
      {isHired ? (
        <div style={{ borderTop: `1px solid ${ind.hairline}`, padding: '9px 11px' }}>
          <Kicker ind={ind} color={ind.inkMuted}>{t('recruitment.board.yearToDate', 'Year to date')}</Kicker>
          <div style={{ fontFamily: BODY, fontSize: 12, color: ind.ink, marginTop: 4 }}>
            {t('recruitment.board.ytdHires', '{n} hires').replace('{n}', String(ytd.hires))}
            {' · '}
            {ytd.avgDays != null
              ? t('recruitment.board.ytdAvg', '{n}d avg').replace('{n}', String(ytd.avgDays))
              : '—'}
          </div>
        </div>
      ) : moreLink ? (
        <div style={{ padding: '9px 11px' }}>{moreLink}</div>
      ) : null}
    </Blueprint>
  );
}

/* ------------------------------------------------------------------ *
 * Candidate card
 * ------------------------------------------------------------------ */

/**
 * Tag semantics, consistent across the deck:
 *   neutral — an automatic state nobody has to act on ("CV parsed")
 *   outline — waiting on a human ("Needs review", "Negotiating")
 *   accent  — scored or settled positive ("Score 4.2", "Signed")
 */
function tagFor(app, stageKey, t) {
  const rating = Number(app.rating) || 0;
  const scored = { variant: 'accent', text: t('recruitment.board.tagScore', 'Score {n}').replace('{n}', rating.toFixed(1)) };

  switch (stageKey) {
    case 'hired':
      return { variant: 'accent', text: t('recruitment.board.tagSigned', 'Signed') };
    case 'offer':
      return app.notes
        ? { variant: 'outline', text: t('recruitment.board.tagNegotiating', 'Negotiating') }
        : { variant: 'outline', text: t('recruitment.board.tagAwaiting', 'Awaiting') };
    case 'interview':
      return rating
        ? scored
        : { variant: 'outline', text: t('recruitment.board.tagAwaiting', 'Awaiting') };
    case 'shortlisted':
      return rating
        ? scored
        : { variant: 'outline', text: t('recruitment.board.tagNeedsReview', 'Needs review') };
    default:
      if (rating) return scored;
      return ageInStage(app) >= STALE_SCREENING_DAYS
        ? { variant: 'outline', text: t('recruitment.board.tagNeedsReview', 'Needs review') }
        : { variant: 'neutral', text: t('recruitment.board.tagCvParsed', 'CV parsed') };
  }
}

/**
 * A hairline rectangle — never a pastel avatar circle. Quiet by default; only the
 * one promoted card in Interview and Offer trades its tag row for a live line and
 * two inline buttons, so the eye finds today's work without reading names.
 */
function CandidateCard({ ind, t, app, stageKey, promoted, interview, roleOf, shortDate, onOpen, onAdvance, onCreateRecord }) {
  const canPromote = promoted && (stageKey === 'interview' || stageKey === 'offer');
  const age = ageInStage(app);
  const tag = tagFor(app, stageKey, t);

  const liveLine = (() => {
    if (stageKey === 'interview') {
      const when = interview ? new Date(interview.scheduled_date) : null;
      if (!when) return t('recruitment.board.panelUnscheduled', 'Panel not scheduled');
      const today = when.toDateString() === new Date().toDateString();
      const time = `${String(when.getHours()).padStart(2, '0')}:${String(when.getMinutes()).padStart(2, '0')}`;
      return today
        ? t('recruitment.board.panelToday', 'Panel today {time}').replace('{time}', time)
        : t('recruitment.board.panelOn', 'Panel {date} {time}').replace('{date}', shortDate(interview.scheduled_date)).replace('{time}', time);
    }
    return t('recruitment.board.awaitingSent', 'Awaiting reply · sent {n}d ago').replace('{n}', String(age));
  })();

  return (
    <div
      style={{
        border: `1px solid ${canPromote ? ind.accent : ind.hairline}`,
        background: canPromote ? ind.accentWash : 'transparent',
        borderRadius: 0,
        padding: '8px 10px',
        display: 'flex',
        flexDirection: 'column',
        gap: 5,
      }}
    >
      <button
        type="button"
        onClick={() => onOpen(app)}
        title={t('common.view', 'View')}
        style={{
          background: 'none', border: 'none', padding: 0, margin: 0, cursor: 'pointer',
          textAlign: 'left', display: 'block', width: '100%',
          fontFamily: DISPLAY, fontWeight: 600, fontSize: 13, lineHeight: 1.15,
          letterSpacing: '.05em', textTransform: 'uppercase', color: ind.ink,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}
      >
        {candidateName(app) || t('common.notAvailable', 'N/A')}
      </button>

      <div
        style={{
          fontFamily: BODY, fontSize: 11.5, color: ind.inkMuted,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}
      >
        {roleOf(app)}
      </div>

      {canPromote ? (
        <>
          <div style={{ fontFamily: BODY, fontSize: 11.5, color: ind.ink, marginTop: 1 }}>
            {liveLine}
          </div>
          <div style={{ display: 'flex', gap: 6, marginTop: 2 }}>
            {stageKey === 'interview' ? (
              <>
                <Btn ind={ind} variant="primary" onClick={() => onOpen(app, 'rating')} style={{ fontSize: 11, padding: '3px 8px' }}>
                  {t('recruitment.board.scorecard', 'Scorecard')}
                </Btn>
                <Btn ind={ind} onClick={() => onAdvance(app)} style={{ fontSize: 11, padding: '3px 8px' }}>
                  {t('recruitment.board.move', 'Move')}
                </Btn>
              </>
            ) : (
              <>
                <Btn ind={ind} variant="primary" onClick={() => onOpen(app, 'notes')} style={{ fontSize: 11, padding: '3px 8px' }}>
                  {t('recruitment.board.chase', 'Chase')}
                </Btn>
                <Btn ind={ind} onClick={() => onOpen(app)} style={{ fontSize: 11, padding: '3px 8px' }}>
                  {t('recruitment.board.revise', 'Revise')}
                </Btn>
              </>
            )}
          </div>
        </>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 1 }}>
          <Tag ind={ind} variant={tag.variant}>{tag.text}</Tag>
          <span style={figure(11, ind.inkMuted)}>{age}d</span>
        </div>
      )}

      {stageKey === 'hired' && (
        <button
          type="button"
          onClick={() => onCreateRecord(app)}
          style={{
            background: 'none', border: 'none', padding: 0, marginTop: 2, cursor: 'pointer',
            textAlign: 'left', fontFamily: DISPLAY, fontWeight: 600, fontSize: 10.5,
            letterSpacing: '.1em', textTransform: 'uppercase', color: ind.accentDeep,
          }}
        >
          {t('recruitment.board.createRecord', 'Create record →')}
        </button>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Table view
 * ------------------------------------------------------------------ */

function CandidateTable({ ind, t, applications, stats, roleOf, shortDate, stageLabel, onOpen, onSchedule }) {
  const th = {
    fontFamily: DISPLAY, fontWeight: 600, fontSize: 10, letterSpacing: '.14em',
    textTransform: 'uppercase', color: ind.inkMuted, textAlign: 'left',
    padding: '8px 12px', borderBottom: `1px solid ${ind.hairline}`, whiteSpace: 'nowrap',
  };
  const td = {
    fontFamily: BODY, fontSize: 13, color: ind.ink,
    padding: '9px 12px', borderBottom: `1px solid ${ind.rule}`, verticalAlign: 'top',
  };

  return (
    <div style={{ border: `1px solid ${ind.hairline}` }}>
      {stats && (
        <div
          style={{
            display: 'flex', flexWrap: 'wrap', gap: 18, padding: '10px 12px',
            borderBottom: `1px solid ${ind.hairline}`,
          }}
        >
          {[
            [t('recruitment.total', 'Total'), stats.total],
            [t('recruitment.underReview', 'Under review'), stats.underReview],
            [t('recruitment.shortListed', 'Shortlisted'), stats.shortlisted],
            [t('recruitment.interviews', 'Interviews'), stats.interviewScheduled],
            [t('recruitment.offers', 'Offers'), stats.offerExtended],
            [t('recruitment.hired', 'Hired'), stats.hired],
            [t('recruitment.rejected', 'Rejected'), stats.rejected],
          ].map(([label, value]) => (
            <div key={label} style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
              <Kicker ind={ind} color={ind.inkMuted}>{label}</Kicker>
              <span style={figure(15, ind.ink)}>{value ?? 0}</span>
            </div>
          ))}
        </div>
      )}

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 860 }}>
          <thead>
            <tr>
              <th style={th}>{t('recruitment.candidate', 'Candidate')}</th>
              <th style={th}>{t('recruitment.position', 'Position')}</th>
              <th style={th}>{t('recruitment.department', 'Department')}</th>
              <th style={th}>{t('recruitment.stage', 'Stage')}</th>
              <th style={th}>{t('recruitment.rating', 'Rating')}</th>
              <th style={th}>{t('recruitment.appliedDate', 'Applied')}</th>
              <th style={{ ...th, textAlign: 'right' }}>{t('recruitment.actions', 'Actions')}</th>
            </tr>
          </thead>
          <tbody>
            {applications.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ ...td, textAlign: 'center', color: ind.inkFaint, padding: '32px 12px' }}>
                  {t('recruitment.noApplications', 'No applications found')}
                </td>
              </tr>
            ) : (
              applications.map(app => {
                const key = stageKeyOf(app);
                return (
                  <tr key={app.id}>
                    <td style={td}>
                      <div style={{ fontFamily: DISPLAY, fontWeight: 600, fontSize: 13, letterSpacing: '.04em', textTransform: 'uppercase' }}>
                        {candidateName(app) || t('common.notAvailable', 'N/A')}
                      </div>
                      <div style={{ fontSize: 11.5, color: ind.inkMuted }}>
                        {app.applicant?.email || t('common.notAvailable', 'N/A')}
                      </div>
                    </td>
                    <td style={td}>{roleOf(app)}</td>
                    <td style={td}>
                      {departmentOf(app)
                        ? t(`employeeDepartment.${departmentOf(app)}`, departmentOf(app))
                        : t('common.notAvailable', 'N/A')}
                    </td>
                    <td style={td}>
                      {key
                        ? <Tag ind={ind} variant={key === 'hired' ? 'accent' : 'neutral'}>{stageLabel(key)}</Tag>
                        : <Tag ind={ind} variant="outline">
                            {isDemoMode()
                              ? getDemoApplicationStatus(app, t)
                              : t(`recruitment.statuses.${String(app.status || '').toLowerCase().replace(/\s+/g, '')}`, app.status)}
                          </Tag>}
                    </td>
                    <td style={{ ...td, fontVariantNumeric: 'tabular-nums' }}>
                      {app.rating ? `${app.rating}/5` : '—'}
                    </td>
                    <td style={td}>{shortDate(app.application_date)}</td>
                    <td style={{ ...td, textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'inline-flex', gap: 6 }}>
                        <Btn ind={ind} onClick={() => onOpen(app)} style={{ fontSize: 11, padding: '3px 8px' }}>
                          {t('common.view', 'View')}
                        </Btn>
                        {key === 'shortlisted' && (
                          <Btn ind={ind} onClick={() => onSchedule(app)} style={{ fontSize: 11, padding: '3px 8px' }}>
                            {t('recruitment.scheduleInterview', 'Schedule')}
                          </Btn>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Modal shell
 * ------------------------------------------------------------------ */

function ModalShell({ ind, title, subtitle, onClose, maxWidth = 620, children, footer }) {
  const { t } = useLanguage();
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(29,31,32,.55)' }}
      onClick={onClose}
    >
      <div
        style={{
          background: ind.ground, border: `1px solid ${ind.ink}`, borderRadius: 0,
          width: '100%', maxWidth, maxHeight: '90vh', display: 'flex', flexDirection: 'column',
          color: ind.ink, fontFamily: BODY,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
            gap: 12, padding: '14px 20px', borderBottom: `1px solid ${ind.hairline}`,
          }}
        >
          <div style={{ minWidth: 0 }}>
            <div
              style={{
                fontFamily: DISPLAY, fontWeight: 600, fontSize: 18, letterSpacing: '.05em',
                textTransform: 'uppercase', lineHeight: 1.1,
              }}
            >
              {title}
            </div>
            {subtitle && (
              <p style={{ fontFamily: BODY, fontSize: 12.5, color: ind.inkMuted, marginTop: 4 }}>{subtitle}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('common.close', 'Close')}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: ind.inkMuted, padding: 0, flex: 'none' }}
          >
            <X size={16} strokeWidth={1.5} />
          </button>
        </div>

        <div style={{ padding: 20, overflowY: 'auto', flex: 1 }}>{children}</div>

        {footer && (
          <div
            style={{
              display: 'flex', justifyContent: 'flex-end', gap: 10,
              padding: '14px 20px', borderTop: `1px solid ${ind.hairline}`, flexWrap: 'wrap',
            }}
          >
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

/** Shared field chrome for the modals — hairline box, zero radius. */
const fieldStyle = (ind) => ({
  width: '100%',
  fontFamily: BODY,
  fontSize: 13,
  color: ind.ink,
  background: 'transparent',
  border: `1px solid ${ind.hairline}`,
  borderRadius: 0,
  padding: '6px 8px',
  outline: 'none',
});

/**
 * Grouped numeric field. Salaries run to seven figures here, so the value is
 * displayed with thousands separators and the raw digits are handed back to the
 * form — `type="number"` would reject the commas outright.
 */
function NumberField({ ind, name, value, onChange }) {
  const { currentLanguage } = useLanguage();
  return (
    <input
      type="text"
      inputMode="numeric"
      name={name}
      value={groupNumberInput(value, currentLanguage)}
      onChange={(e) => {
        const raw = String(e.target.value).replace(/[^\d.-]/g, '');
        onChange({ target: { name, value: raw } });
      }}
      placeholder="0"
      style={{ ...fieldStyle(ind), fontVariantNumeric: 'tabular-nums' }}
    />
  );
}

function Field({ ind, label, children }) {
  return (
    <label style={{ display: 'block' }}>
      <Kicker ind={ind} color={ind.inkMuted} style={{ marginBottom: 5 }}>{label}</Kicker>
      {children}
    </label>
  );
}

/* ------------------------------------------------------------------ *
 * Post job
 * ------------------------------------------------------------------ */

const PostJobModal = ({ ind, onClose, onSuccess }) => {
  const { t } = useLanguage();
  const { handleSessionAuthError } = useSessionGuard();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [formData, setFormData] = useState({
    title: '', department: '', location: '', employment_type: 'full_time',
    experience_level: '', salary_min: '', salary_max: '', description: '',
    requirements: '', status: 'open',
  });

  const departments = [
    'engineering', 'marketing', 'sales', 'finance', 'human_resources',
    'operations', 'customer_support', 'product', 'design', 'it',
  ];

  const employmentTypes = [
    { value: 'full_time', label: t('recruitment.fullTime', 'Full Time') },
    { value: 'part_time', label: t('recruitment.partTime', 'Part Time') },
    { value: 'contract', label: t('recruitment.contract', 'Contract') },
    { value: 'internship', label: t('recruitment.internship', 'Internship') },
  ];

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.title.trim() || !formData.department) {
      setError(t('validation.required', 'Please fill in required fields'));
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await createJobPosting({
        ...formData,
        salary_min: formData.salary_min ? parseInt(formData.salary_min, 10) : null,
        salary_max: formData.salary_max ? parseInt(formData.salary_max, 10) : null,
      });
      if (result.success) onSuccess(result.droppedColumns);
      else {
        console.error('Failed to post job:', result.error);
        setError(t('errors.saveFailed', 'Failed to post job'));
      }
    } catch (err) {
      console.error('Error posting job:', err);
      if (handleSessionAuthError(err)) return;
      setError(t('errors.saveFailed', 'Failed to post job'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <ModalShell
      ind={ind}
      title={t('recruitment.postNewJob', 'Post new job')}
      onClose={onClose}
      maxWidth={680}
      footer={(
        <>
          <Btn ind={ind} onClick={onClose}>{t('common.cancel', 'Cancel')}</Btn>
          <Btn ind={ind} variant="primary" disabled={loading} onClick={handleSubmit}>
            {loading ? t('common.saving', 'Saving...') : t('recruitment.postJob', 'Post job')}
          </Btn>
        </>
      )}
    >
      <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2" style={{ gap: 14 }}>
        {error && (
          <p className="md:col-span-2" style={{ fontFamily: BODY, fontSize: 12.5, color: ind.ink, border: `1px solid ${ind.ink}`, padding: '8px 10px' }}>
            {error}
          </p>
        )}

        <div className="md:col-span-2">
          <Field ind={ind} label={`${t('recruitment.jobTitle', 'Job title')} *`}>
            <input
              type="text" name="title" value={formData.title} onChange={handleChange}
              placeholder={t('recruitment.enterJobTitle', 'Enter job title')}
              style={fieldStyle(ind)} required
            />
          </Field>
        </div>

        <Field ind={ind} label={`${t('recruitment.department', 'Department')} *`}>
          <select name="department" value={formData.department} onChange={handleChange} style={fieldStyle(ind)} required>
            <option value="">{t('common.select', 'Select')}</option>
            {departments.map(dept => (
              <option key={dept} value={dept}>{t(`employeeDepartment.${dept}`, dept)}</option>
            ))}
          </select>
        </Field>

        <Field ind={ind} label={t('recruitment.location', 'Location')}>
          <input
            type="text" name="location" value={formData.location} onChange={handleChange}
            placeholder={t('recruitment.enterLocation', 'Enter location')} style={fieldStyle(ind)}
          />
        </Field>

        <Field ind={ind} label={t('recruitment.employmentType', 'Employment type')}>
          <select name="employment_type" value={formData.employment_type} onChange={handleChange} style={fieldStyle(ind)}>
            {employmentTypes.map(type => (
              <option key={type.value} value={type.value}>{type.label}</option>
            ))}
          </select>
        </Field>

        <Field ind={ind} label={t('recruitment.experienceLevel', 'Experience level')}>
          <input
            type="text" name="experience_level" value={formData.experience_level} onChange={handleChange}
            placeholder={t('recruitment.enterExperience', 'e.g., 3-5 years')} style={fieldStyle(ind)}
          />
        </Field>

        <Field ind={ind} label={t('recruitment.salaryMin', 'Minimum salary')}>
          <NumberField ind={ind} name="salary_min" value={formData.salary_min} onChange={handleChange} />
        </Field>

        <Field ind={ind} label={t('recruitment.salaryMax', 'Maximum salary')}>
          <NumberField ind={ind} name="salary_max" value={formData.salary_max} onChange={handleChange} />
        </Field>

        <div className="md:col-span-2">
          <Field ind={ind} label={t('recruitment.description', 'Job description')}>
            <textarea
              name="description" value={formData.description} onChange={handleChange} rows={4}
              placeholder={t('recruitment.enterDescription', 'Enter job description')}
              style={{ ...fieldStyle(ind), resize: 'vertical' }}
            />
          </Field>
        </div>

        <div className="md:col-span-2">
          <Field ind={ind} label={t('recruitment.requirements', 'Requirements')}>
            <textarea
              name="requirements" value={formData.requirements} onChange={handleChange} rows={4}
              placeholder={t('recruitment.enterRequirements', 'Enter job requirements')}
              style={{ ...fieldStyle(ind), resize: 'vertical' }}
            />
          </Field>
        </div>
      </form>
    </ModalShell>
  );
};

/* ------------------------------------------------------------------ *
 * Application detail
 * ------------------------------------------------------------------ */

const STATUS_OPTIONS = [
  ['under review', 'recruitment.underReview', 'Under Review'],
  ['shortlisted', 'recruitment.shortListed', 'Shortlisted'],
  ['interview scheduled', 'recruitment.interviews', 'Interview Scheduled'],
  ['offer extended', 'recruitment.offerExtended', 'Offer Extended'],
  ['hired', 'recruitment.hired', 'Hired'],
  ['rejected', 'recruitment.rejected', 'Rejected'],
];

const ApplicationDetailModal = ({ ind, application, focus, onClose, onUpdate, onStatusUpdate, onScheduleInterview }) => {
  const { t, currentLanguage } = useLanguage();
  const { handleSessionAuthError } = useSessionGuard();

  const [rating, setRating] = useState(application.rating || 0);
  const [notes, setNotes] = useState(application.notes || '');
  const [status, setStatus] = useState(application.status || 'under review');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      await updateApplicationRating(application.id, rating, notes);
      if (status !== application.status && onStatusUpdate) {
        await onStatusUpdate(application.id, status);
      }
      if (onUpdate) await onUpdate();
      onClose();
    } catch (err) {
      console.error('Error saving application:', err);
      if (handleSessionAuthError(err)) return;
      setError(t('errors.saveFailed', 'Failed to save changes'));
    } finally {
      setSaving(false);
    }
  };

  const rows = [
    [t('recruitment.position', 'Position'), isDemoMode()
      ? getDemoJobTitle(application.job_posting, t)
      : (application.job_posting?.title ? <TranslatedText text={application.job_posting.title} /> : null)],
    [t('recruitment.department', 'Department'), application.job_posting?.department
      ? t(`employeeDepartment.${application.job_posting.department}`, application.job_posting.department) : null],
    [t('recruitment.appliedDate', 'Applied date'), application.application_date
      ? formatLocaleDate(application.application_date, currentLanguage) : null],
    [t('recruitment.statusLabel', 'Status'), application.status
      ? (isDemoMode()
        ? getDemoApplicationStatus(application, t)
        : t(`recruitment.statuses.${String(application.status).toLowerCase().replace(/\s+/g, '')}`, application.status))
      : null],
    [t('common.email', 'Email'), application.applicant?.email],
    [t('common.phone', 'Phone'), application.applicant?.phone],
    [t('recruitment.experience', 'Experience'),
      `${application.applicant?.years_of_experience || application.applicant?.years_experience || 0} ${t('recruitment.years', 'years')}`],
    [t('recruitment.currentCompany', 'Current company'), application.applicant?.current_company],
    [t('recruitment.currentPosition', 'Current position'), isDemoMode()
      ? t(application.applicant?.currentPositionKey, application.applicant?.current_position)
      : application.applicant?.current_position],
    [t('recruitment.education', 'Education'), isDemoMode()
      ? t(application.applicant?.educationLevelKey, application.applicant?.education_level)
      : application.applicant?.education_level],
  ];

  const jobDescription = application.job_posting?.description
    ? (isDemoMode() ? getDemoJobDescription(application.job_posting, t) : <TranslatedText text={application.job_posting.description} />)
    : null;
  const existingNotes = application.notes
    ? (isDemoMode() ? getDemoApplicationNotes(application, t) : <TranslatedText text={application.notes} />)
    : null;

  return (
    <ModalShell
      ind={ind}
      title={candidateName(application) || t('common.notAvailable', 'N/A')}
      subtitle={[
        application.job_posting?.title,
        application.job_posting?.department
          ? t(`employeeDepartment.${application.job_posting.department}`, application.job_posting.department)
          : null,
      ].filter(Boolean).join(' · ')}
      onClose={onClose}
      maxWidth={680}
      footer={(
        <>
          <Btn ind={ind} onClick={() => onScheduleInterview && onScheduleInterview(application)} style={{ marginRight: 'auto' }}>
            <Calendar size={13} strokeWidth={1.5} style={{ display: 'inline', marginRight: 5, verticalAlign: '-2px' }} />
            {t('recruitment.scheduleInterview', 'Schedule interview')}
          </Btn>
          <Btn ind={ind} onClick={onClose}>{t('common.close', 'Close')}</Btn>
          <Btn ind={ind} variant="primary" disabled={saving} onClick={handleSave}>
            <Save size={13} strokeWidth={1.5} style={{ display: 'inline', marginRight: 5, verticalAlign: '-2px' }} />
            {saving ? t('common.saving', 'Saving...') : t('common.save', 'Save')}
          </Btn>
        </>
      )}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        {error && (
          <p style={{ fontFamily: BODY, fontSize: 12.5, border: `1px solid ${ind.ink}`, padding: '8px 10px' }}>{error}</p>
        )}

        <div>
          {rows.map(([label, value]) => (
            <div
              key={label}
              style={{ display: 'flex', gap: 12, padding: '6px 0', borderBottom: `1px solid ${ind.rule}` }}
            >
              <div style={{ width: 168, flex: 'none' }}>
                <Kicker ind={ind} color={ind.inkMuted}>{label}</Kicker>
              </div>
              <div style={{ flex: 1, minWidth: 0, fontFamily: BODY, fontSize: 13 }}>
                {value || t('common.notAvailable', 'N/A')}
              </div>
            </div>
          ))}
        </div>

        {jobDescription && (
          <div>
            <Kicker ind={ind} color={ind.inkMuted}>{t('recruitment.description', 'Job description')}</Kicker>
            <p style={{ fontFamily: BODY, fontSize: 13, color: ind.inkGhost, marginTop: 6 }}>{jobDescription}</p>
          </div>
        )}

        {existingNotes && (
          <div>
            <Kicker ind={ind} color={ind.inkMuted}>{t('recruitment.notes', 'Notes on file')}</Kicker>
            <p style={{ fontFamily: BODY, fontSize: 13, color: ind.inkGhost, marginTop: 6 }}>{existingNotes}</p>
          </div>
        )}

        {(application.applicant?.resume_url || application.applicant?.linkedin_profile) && (
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
            {application.applicant?.resume_url && (
              <a
                href={application.applicant.resume_url} target="_blank" rel="noopener noreferrer"
                style={{
                  fontFamily: DISPLAY, fontWeight: 600, fontSize: 11.5, letterSpacing: '.08em',
                  textTransform: 'uppercase', color: ind.accentDeep, textDecoration: 'underline',
                }}
              >
                {t('recruitment.viewResume', 'View resume')} →
              </a>
            )}
            {application.applicant?.linkedin_profile && (
              <a
                href={application.applicant.linkedin_profile} target="_blank" rel="noopener noreferrer"
                style={{
                  fontFamily: DISPLAY, fontWeight: 600, fontSize: 11.5, letterSpacing: '.08em',
                  textTransform: 'uppercase', color: ind.accentDeep, textDecoration: 'underline',
                }}
              >
                {t('recruitment.linkedinProfile', 'LinkedIn profile')} →
              </a>
            )}
          </div>
        )}

        {/* Evaluation */}
        <div style={{ border: `1px solid ${ind.hairline}`, padding: 14, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Kicker ind={ind} color={ind.ink}>{t('recruitment.evaluation', 'Evaluation')}</Kicker>

          <div>
            <Kicker ind={ind} color={ind.inkMuted} style={{ marginBottom: 6 }}>{t('recruitment.rating', 'Rating')}</Kicker>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              {[1, 2, 3, 4, 5].map(value => (
                <button
                  key={value}
                  type="button"
                  autoFocus={focus === 'rating' && value === 1}
                  onClick={() => setRating(value === rating ? 0 : value)}
                  title={`${value}/5`}
                  style={{ background: 'none', border: 'none', padding: 2, cursor: 'pointer', lineHeight: 0 }}
                >
                  <Star
                    size={18}
                    strokeWidth={1.5}
                    style={{ color: value <= rating ? ind.accent : ind.inkFaint }}
                    fill={value <= rating ? ind.accent : 'none'}
                  />
                </button>
              ))}
              <span style={{ marginLeft: 8, fontFamily: BODY, fontSize: 12.5, color: ind.inkMuted }}>
                {rating > 0 ? `${rating}/5` : t('recruitment.notRated', 'Not rated')}
              </span>
            </div>
          </div>

          <Field ind={ind} label={t('recruitment.statusLabel', 'Status')}>
            <select value={status} onChange={(e) => setStatus(e.target.value)} style={fieldStyle(ind)}>
              {STATUS_OPTIONS.map(([value, key, fallback]) => (
                <option key={value} value={value}>{t(key, fallback)}</option>
              ))}
            </select>
          </Field>

          <Field ind={ind} label={t('recruitment.notes', 'Notes')}>
            <textarea
              value={notes}
              autoFocus={focus === 'notes'}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder={t('recruitment.notesPlaceholder', 'Add interview notes or feedback...')}
              style={{ ...fieldStyle(ind), resize: 'vertical' }}
            />
          </Field>
        </div>
      </div>
    </ModalShell>
  );
};

/* ------------------------------------------------------------------ *
 * Interview scheduling
 * ------------------------------------------------------------------ */

const InterviewScheduleModal = ({ ind, application, onClose, onSuccess }) => {
  const { t } = useLanguage();
  const { handleSessionAuthError } = useSessionGuard();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [form, setForm] = useState({
    date: '', time: '10:00', interview_type: 'video',
    duration_minutes: 60, location: '', notes: '',
  });

  const interviewTypes = [
    { value: 'phone', label: t('recruitment.interviewType.phone', 'Phone') },
    { value: 'video', label: t('recruitment.interviewType.video', 'Video') },
    { value: 'in-person', label: t('recruitment.interviewType.inPerson', 'In Person') },
    { value: 'technical', label: t('recruitment.interviewType.technical', 'Technical') },
    { value: 'hr', label: t('recruitment.interviewType.hr', 'HR') },
  ];

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.date) {
      setError(t('recruitment.selectDate', 'Please select an interview date'));
      return;
    }
    setLoading(true);
    setError(null);
    try {
      if (isDemoMode()) {
        // Persisting interviews is not available in demo mode — simulate success.
        onSuccess();
        return;
      }

      const result = await createInterviewSchedule({
        application_id: application.id,
        interview_type: form.interview_type,
        scheduled_date: new Date(`${form.date}T${form.time || '00:00'}`).toISOString(),
        duration_minutes: parseInt(form.duration_minutes, 10) || 60,
        location: form.location || null,
        feedback: form.notes || null,
        status: 'scheduled',
      });

      if (result.success) onSuccess();
      else {
        console.error('Failed to schedule interview:', result.error);
        setError(t('errors.saveFailed', 'Failed to schedule interview'));
      }
    } catch (err) {
      console.error('Error scheduling interview:', err);
      if (handleSessionAuthError(err)) return;
      setError(t('errors.saveFailed', 'Failed to schedule interview'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <ModalShell
      ind={ind}
      title={t('recruitment.scheduleInterview', 'Schedule interview')}
      subtitle={candidateName(application) || t('common.notAvailable', 'N/A')}
      onClose={onClose}
      maxWidth={560}
      footer={(
        <>
          <Btn ind={ind} onClick={onClose}>{t('common.cancel', 'Cancel')}</Btn>
          <Btn ind={ind} variant="primary" disabled={loading} onClick={handleSubmit}>
            {loading ? t('common.saving', 'Saving...') : t('recruitment.confirmSchedule', 'Confirm schedule')}
          </Btn>
        </>
      )}
    >
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {error && (
          <p style={{ fontFamily: BODY, fontSize: 12.5, border: `1px solid ${ind.ink}`, padding: '8px 10px' }}>{error}</p>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2" style={{ gap: 14 }}>
          <Field ind={ind} label={`${t('recruitment.interviewDate', 'Date')} *`}>
            <DatePicker flat name="date" value={form.date} onChange={handleChange} required />
          </Field>
          <Field ind={ind} label={t('recruitment.interviewTime', 'Time')}>
            <TimePicker flat name="time" value={form.time} onChange={handleChange} />
          </Field>
          <Field ind={ind} label={t('recruitment.interviewTypeLabel', 'Interview type')}>
            <select name="interview_type" value={form.interview_type} onChange={handleChange} style={fieldStyle(ind)}>
              {interviewTypes.map(type => (
                <option key={type.value} value={type.value}>{type.label}</option>
              ))}
            </select>
          </Field>
          <Field ind={ind} label={t('recruitment.duration', 'Duration (min)')}>
            <input type="number" name="duration_minutes" min="15" step="15" value={form.duration_minutes} onChange={handleChange} style={fieldStyle(ind)} />
          </Field>
        </div>

        <Field
          ind={ind}
          label={form.interview_type === 'video'
            ? t('recruitment.meetingLink', 'Meeting link')
            : t('recruitment.location', 'Location')}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {form.interview_type === 'video'
              ? <Video size={14} strokeWidth={1.5} style={{ flex: 'none', color: ind.inkMuted }} />
              : <MapPin size={14} strokeWidth={1.5} style={{ flex: 'none', color: ind.inkMuted }} />}
            <input
              type="text" name="location" value={form.location} onChange={handleChange}
              placeholder={form.interview_type === 'video' ? 'https://...' : t('recruitment.enterLocation', 'Enter location')}
              style={fieldStyle(ind)}
            />
          </div>
        </Field>

        <Field ind={ind} label={t('recruitment.notes', 'Notes')}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
            <MessageSquare size={14} strokeWidth={1.5} style={{ flex: 'none', color: ind.inkMuted, marginTop: 7 }} />
            <textarea
              name="notes" value={form.notes} onChange={handleChange} rows={3}
              placeholder={t('recruitment.interviewNotesPlaceholder', 'Agenda, interviewers, things to prepare...')}
              style={{ ...fieldStyle(ind), resize: 'vertical' }}
            />
          </div>
        </Field>
      </form>
    </ModalShell>
  );
};

export default Recruitment;
