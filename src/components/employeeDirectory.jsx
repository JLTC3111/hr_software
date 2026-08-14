/**
 * Employee Directory — the roster answered three ways.
 *
 *   ledger  the default. Grouped by unit, one row per person, and every column
 *           is comparable down the page: contact, tenure, hours this week,
 *           rating, state.
 *   plates  the card view, redrawn as blueprint objects — square portrait,
 *           three fields, one rating figure, one action. Always scoped to a
 *           single unit, because cards cannot be compared across a whole roster.
 *   record  one person as four numbered panels, with the unit index beside it,
 *           so you can step down a team without returning to the ledger.
 *
 * The one idea all three encode: the old card grid gave every person an
 * identical badge-covered island — a gradient band carrying no data, five stars
 * restating a printed figure, an "Active" pill on nearly everybody, the
 * department named three times, and six unlabelled icon buttons. So: repeated
 * facts collapse into their container (the unit band names the unit, once),
 * states are words and only the exceptional ones take ink, and each person
 * exposes exactly one action.
 *
 * Where the numbers come from — everything is derived, nothing is seeded:
 *   headcount, units   the employees prop, grouped by department
 *   rating             employees.performance — one figure, one bar, never stars
 *   this week          time_entries from Monday to Sunday, split by hour_type
 *   awaiting approval  those entries with status 'pending'
 *   on leave today     an approved leave_request whose range covers today
 *   starting           start_date in the future
 *   documents          pdf_document_url — on file or missing
 *   review             performance_reviews, newest period first
 *   open work          workload_tasks that are not completed or cancelled
 *
 * Substitutions, because the schema has no contract table and no reporting line:
 *   CONTRACT → TENURE. The ledger's third column and the plate's second field
 *     carry tenure since start_date with the start date beneath it — the nearest
 *     real fact with the same shape, a term and its date travelling together.
 *   OPEN ROLES → RECORDS MISSING DOCUMENTS. There is no requisition table, so
 *     the ticker's last cell counts records with nothing on file instead: the
 *     directory's own backlog rather than recruiting's.
 *   DIRECT REPORTS → UNIT SIZE. The record's sub-line states how many people
 *     share the unit, since no manager column exists.
 *   The overtime cap and the annual-leave allowance are the same figures Policy
 *     Controls publishes (20h per month, 14 days per year).
 *
 * Kept from the previous directory and re-skinned to the system: the border beam
 * on the one focused object per screen, the staggered decision queue, the unit
 * network (square nodes, token colours), and sliding digits on the ticker.
 *
 * Design system: "Industry" (src/theme/industry.js). Radius is 0 everywhere,
 * cards are outlines with four registration corners, and status reads through
 * weight and rule rather than through colour.
 */
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertCircle, ArrowRight, Camera, ChevronDown, ChevronLeft, ChevronRight,
  Download, Network, Plus, Search, X,
} from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext.jsx';
import { useTheme } from '../contexts/ThemeContext.jsx';
import { useAuth } from '../contexts/AuthContext.jsx';
import * as timeTrackingService from '../services/timeTrackingService.js';
import * as performanceService from '../services/performanceService.js';
import * as workloadService from '../services/workloadService.js';
import { useSessionGuard, useAuthenticatedPageRefresh } from '../hooks/useSessionGuard.js';
import { useMinWidth } from '../hooks/useMinWidth.js';
import { getDemoEmployeeName } from '../utils/demoHelper.js';
import { getEmployeePositionI18nKey } from '../utils/employeePositionKey.js';
import { isEmployeeInactive } from '../utils/employeeStatus.js';
import { DEPARTMENT_KEYS } from '../utils/departments.js';
import { formatDate } from '../utils/localeFormat.js';
import { getIndustry, DISPLAY, BODY, figure, rampAt } from '../theme/industry.js';
import { Blueprint, Bar, Tag, Btn, Kicker, TickerCell, LiveClock } from './ui/industry.jsx';
import { FetchElapsedPill } from './ui/fetch-elapsed-pill.tsx';
import { BorderBeam } from './ui/border-beam.tsx';
import { AnimatedBeam } from './ui/animated-beam.tsx';
import { AnimatedList } from './ui/animated-list.tsx';
import { SlidingNumber } from './motion-primitives';

/* ------------------------------------------------------------------ *
 * Screen constants — these agree with what Policy Controls publishes.
 * ------------------------------------------------------------------ */

/** Overtime a person may bank in a month before it needs a decision. */
const OVERTIME_CAP_HOURS = 20;
/** Annual leave entitlement, used for the balance row on the record. */
const ANNUAL_LEAVE_DAYS = 14;
/** Contracted week, so "this week" can say what it is measured against. */
const CONTRACT_WEEK_HOURS = 40;

/** Units opened by default in the ledger. The rest state their count and wait. */
const DEFAULT_OPEN_UNITS = 3;
/** The plate grid is two rows of three and never scrolls. */
const PLATES_PER_PAGE = 6;
/** Rows named in the decision column before it stops naming them. */
const QUEUE_ROWS = 4;
/** Places on the podium, then the runners-up named under it. */
const PODIUM_PLACES = 3;
const RUNNER_UP_ROWS = 2;
/** Nodes drawn around the hub in the unit network. */
const NETWORK_NODES = 4;
/** People named in the "just joined" block. */
const RECENT_JOINER_ROWS = 3;
/** A hire counts as recent for this long. */
const RECENT_JOINER_DAYS = 60;

const DAY_MS = 86400000;

/** Hour types that are overtime rather than contracted time. */
const OVERTIME_TYPES = new Set(['overtime', 'weekend', 'holiday']);
/** time_entries stores snake_case; the shared hour-type labels are camelCase. */
const HOUR_TYPE_KEYS = { on_leave: 'onLeave' };
/** Task statuses that mean the task is no longer open. */
const CLOSED_TASK = new Set(['completed', 'done', 'cancelled', 'canceled']);
/** A review in one of these has been signed off. */
const SIGNED_OFF_REVIEW = new Set(['approved', 'acknowledged']);

/* ------------------------------------------------------------------ *
 * Helpers
 * ------------------------------------------------------------------ */

const pad2 = (n) => String(n).padStart(2, '0');

const normalizeKey = (value) =>
  String(value || '').toLowerCase().trim().replace(/\s+/g, '');

const isoDay = (date) =>
  `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;

/** Monday 00:00 of the week containing `date`. */
const startOfWeek = (date) => {
  const x = new Date(date);
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  x.setHours(0, 0, 0, 0);
  return x;
};

const addDays = (date, days) => new Date(date.getTime() + days * DAY_MS);

const clampRating = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.max(0, Math.min(5, n));
};

const fmt1 = (n) => (Number.isFinite(n) ? n.toFixed(1) : '—');

/** 41.1667 → "41h 10m". The only hours format on the screen. */
const fmtHours = (hours) => {
  const minutes = Math.round((Number(hours) || 0) * 60);
  return `${Math.floor(minutes / 60)}h ${pad2(minutes % 60)}m`;
};

/** Whole months between a start date and now, floored. */
const tenureMonths = (startDate, now) => {
  if (!startDate) return null;
  const start = new Date(startDate);
  if (Number.isNaN(start.getTime())) return null;
  let months = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth());
  if (now.getDate() < start.getDate()) months -= 1;
  return Math.max(0, months);
};

/**
 * Whole days from `from` to `to`, both flattened to midnight. Positive means
 * `from` is already past — so a future start date comes back negative, which is
 * what "has not started yet" is read from.
 */
const dayDiff = (from, to) => Math.round((to.setHours(0, 0, 0, 0) - new Date(from).setHours(0, 0, 0, 0)) / DAY_MS);

/** "Đỗ Bảo Long" → "ĐL". First letter of the first word and of the last. */
const initialsOf = (name) => {
  const words = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!words.length) return '—';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return `${words[0][0]}${words[words.length - 1][0]}`.toUpperCase();
};

const startDateOf = (employee) => employee?.start_date || employee?.startDate || employee?.hire_date || null;

const hasDocuments = (employee) => Boolean(employee?.pdf_document_url);

/* ------------------------------------------------------------------ *
 * Primitives particular to this screen
 * ------------------------------------------------------------------ */

/**
 * The square portrait frame. Sized for a photograph; initials are the
 * placeholder. A person who has not started yet gets a dashed empty frame,
 * because a filled one would claim a record that is not in place.
 */
function Portrait({ ind, employee, name, size = 30, dashed = false, fontSize, onPickPhoto, uploadLabel }) {
  const [failed, setFailed] = useState(false);
  const photo = !failed ? employee?.photo : null;
  const editable = typeof onPickPhoto === 'function';

  return (
    <div
      className={editable ? 'group/portrait' : undefined}
      style={{
        position: 'relative',
        width: size,
        height: size,
        flex: 'none',
        border: dashed ? `1px dashed ${ind.inkFaint}` : `1px solid ${ind.hairline}`,
        background: dashed || photo ? 'transparent' : ind.accentWash,
        display: 'grid',
        placeItems: 'center',
        overflow: 'hidden',
      }}
    >
      {photo ? (
        <img
          src={photo}
          alt={name}
          onError={() => setFailed(true)}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      ) : (
        <span
          style={{
            fontFamily: DISPLAY,
            fontWeight: 600,
            fontSize: fontSize || Math.round(size * 0.36),
            letterSpacing: '.04em',
            color: dashed ? ind.inkFaint : ind.accentDeep,
          }}
        >
          {initialsOf(name)}
        </span>
      )}

      {editable && (
        <label
          title={uploadLabel}
          onClick={(e) => e.stopPropagation()}
          style={{
            position: 'absolute',
            inset: 0,
            display: 'grid',
            placeItems: 'center',
            background: 'rgba(29,31,32,.62)',
            color: '#f2f2f3',
            opacity: 0,
            cursor: 'pointer',
            transition: 'opacity .15s ease',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.opacity = 1; }}
          onMouseLeave={(e) => { e.currentTarget.style.opacity = 0; }}
        >
          <Camera size={Math.round(size * 0.28)} strokeWidth={1.5} />
          <input
            type="file"
            accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
            onChange={onPickPhoto}
            style={{ display: 'none' }}
          />
        </label>
      )}
    </div>
  );
}

/** A state is a word, never a pill. Only the exceptional ones carry ink. */
function StateWord({ state, size = 11, align }) {
  return (
    <span
      style={{
        fontFamily: DISPLAY,
        fontWeight: 600,
        fontSize: size,
        letterSpacing: '.1em',
        textTransform: 'uppercase',
        whiteSpace: 'nowrap',
        color: state.tone,
        justifySelf: align,
        textAlign: align === 'end' ? 'right' : undefined,
      }}
    >
      {state.label}
    </span>
  );
}

/** One figure and one bar. A rating appears exactly once per person. */
function RatingCell({ ind, rating, width = 56, dash }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 9, minWidth: 0 }}>
      <span style={{ ...figure(15, rating == null ? ind.inkFaint : ind.ink) }}>
        {rating == null ? (dash || '—') : fmt1(rating)}
      </span>
      <div style={{ width, flex: 'none' }}>
        <Bar ind={ind} value={rating == null ? 0 : rating / 5} fill={ind.accent} height={6} />
      </div>
    </div>
  );
}

/** Search input, shared by the filter strip and the record index. */
function SearchBox({ ind, value, onChange, placeholder, style }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 7,
        border: `1px solid ${ind.hairline}`,
        padding: '5px 11px',
        minWidth: 0,
        ...style,
      }}
    >
      <Search size={14} strokeWidth={1.5} style={{ flex: 'none', color: ind.inkFaint }} />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          flex: 1,
          minWidth: 0,
          border: 'none',
          outline: 'none',
          background: 'transparent',
          fontFamily: BODY,
          fontSize: 12.5,
          color: ind.ink,
        }}
      />
      {value ? (
        <button
          type="button"
          onClick={() => onChange('')}
          aria-label={t('common.clear', 'Clear')}
          style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: ind.inkFaint, display: 'flex' }}
        >
          <X size={13} strokeWidth={1.5} />
        </button>
      ) : null}
    </div>
  );
}

/** A hairline box of links, one of them filled. Tabs carry their own count. */
function TabRow({ ind, options, value, onChange, ariaLabel }) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      style={{ display: 'flex', border: `1px solid ${ind.hairline}`, flex: 'none', maxWidth: '100%', overflowX: 'auto' }}
    >
      {options.map((opt, i) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            aria-pressed={active}
            style={{
              fontFamily: DISPLAY,
              fontWeight: 600,
              fontSize: 12,
              letterSpacing: '.08em',
              textTransform: 'uppercase',
              padding: '5px 13px',
              whiteSpace: 'nowrap',
              cursor: 'pointer',
              border: 'none',
              borderLeft: i === 0 ? 'none' : `1px solid ${ind.hairline}`,
              background: active ? ind.accent : 'transparent',
              color: active ? ind.accentInk : ind.ink,
              transition: 'background .15s ease',
            }}
            onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = ind.accentWash; }}
            onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = 'transparent'; }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

/** The small tracked link that ends a block: "SEE ALL UNITS →". */
function TrailLink({ ind, onClick, children, arrow = true }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        background: 'none',
        border: 'none',
        padding: 0,
        cursor: 'pointer',
        fontFamily: DISPLAY,
        fontWeight: 600,
        fontSize: 11,
        letterSpacing: '.12em',
        textTransform: 'uppercase',
        color: ind.accentDeep,
      }}
    >
      {children}
      {arrow && <ArrowRight size={12} strokeWidth={1.5} />}
    </button>
  );
}

/* ------------------------------------------------------------------ *
 * Podium — the old directory's top-performer stand, rebuilt to the system.
 *
 * What it keeps: three places, the winner raised in the middle, runners-up
 * listed underneath. What it drops: the gold/silver/bronze gradients, the
 * rounded portraits and the five-star row, all of which said the same thing
 * three times over. The step heights carry the rank and the figure carries the
 * score, so nothing is stated twice.
 * ------------------------------------------------------------------ */

/** Pedestal heights, indexed by place. First is tallest, as a podium is. */
const PEDESTAL_HEIGHT = [66, 50, 38];
/** Reading order across the stand: second, first, third. */
const PODIUM_ORDER = [1, 0, 2];

function Podium({ ind, places, runnersUp, onOpen }) {
  return (
    <>
      {/* No bottom padding: the pedestals have to stand on the rule below. */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: 10, padding: '16px 20px 0' }}>
        {PODIUM_ORDER.map((place) => {
          const person = places[place];
          if (!person) return null;
          const first = place === 0;
          return (
            <button
              key={person.id}
              type="button"
              onClick={() => onOpen(person)}
              title={`${person.name} · ${person.unitLabel}`}
              style={{
                flex: first ? 1.15 : 1,
                minWidth: 0,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 6,
                background: 'none',
                border: 'none',
                padding: 0,
                cursor: 'pointer',
              }}
            >
              <Portrait ind={ind} employee={person.employee} name={person.name} size={first ? 34 : 28} />
              <span
                style={{
                  width: '100%',
                  fontFamily: BODY,
                  fontSize: 11,
                  color: ind.inkMuted,
                  textAlign: 'center',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {person.name}
              </span>
              <span
                style={{
                  width: '100%',
                  height: PEDESTAL_HEIGHT[place],
                  border: `1px solid ${ind.hairline}`,
                  borderBottom: 'none',
                  background: first ? ind.accentWash : 'transparent',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 3,
                }}
              >
                <span style={figure(first ? 20 : 17, ind.ink)}>{fmt1(person.rating)}</span>
                <span style={{ fontFamily: DISPLAY, fontWeight: 600, fontSize: 10, letterSpacing: '.16em', color: ind.accent }}>
                  {place + 1}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      {/* The rule the three pedestals stand on. */}
      <div style={{ height: 1, background: ind.ink, margin: '0 20px 2px' }} />

      {runnersUp.map((person, i) => (
        <button
          key={`runner-${person.id}`}
          type="button"
          onClick={() => onOpen(person)}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', gap: 10,
            padding: '10px 20px', border: 'none', borderBottom: `1px solid ${ind.rule}`,
            background: 'transparent', cursor: 'pointer', textAlign: 'left',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = ind.accentWash; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
        >
          <span style={{ fontFamily: DISPLAY, fontWeight: 600, fontSize: 11, letterSpacing: '.1em', color: ind.inkFaint, width: 14, flex: 'none' }}>
            {PODIUM_PLACES + i + 1}
          </span>
          <span style={{ flex: 1, minWidth: 0, fontFamily: BODY, fontSize: 12.5, color: ind.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {person.name}
          </span>
          <span style={{ width: 56, flex: 'none' }}>
            {/* The ranked ramp from the token set: rank 1 loudest, and down. */}
            <Bar ind={ind} value={person.rating / 5} fill={rampAt(ind, PODIUM_PLACES + i)} height={6} />
          </span>
          <span style={{ ...figure(12, ind.ink), width: 24, textAlign: 'right', flex: 'none' }}>{fmt1(person.rating)}</span>
        </button>
      ))}
    </>
  );
}

/* ------------------------------------------------------------------ *
 * The unit network — carried over from the previous directory, re-skinned:
 * square nodes, hairline frames, token colours. It sits in the plate view,
 * which is the recognition mode; the ledger compares with bars instead.
 * ------------------------------------------------------------------ */

const NetworkNode = React.forwardRef(function NetworkNode({ ind, children, title, accent }, ref) {
  return (
    <div
      ref={ref}
      title={title}
      style={{
        position: 'relative',
        zIndex: 10,
        width: accent ? 42 : 34,
        height: accent ? 42 : 34,
        flex: 'none',
        display: 'grid',
        placeItems: 'center',
        border: `1px solid ${accent ? ind.accent : ind.hairline}`,
        background: accent ? ind.accentWash : 'transparent',
        color: accent ? ind.accentDeep : ind.inkGhost,
        fontFamily: DISPLAY,
        fontWeight: 600,
        fontSize: 11,
        letterSpacing: '.04em',
      }}
    >
      {children}
    </div>
  );
});

function UnitNetwork({ ind, units }) {
  const containerRef = useRef(null);
  const hubRef = useRef(null);
  const nodes = units.slice(0, NETWORK_NODES);
  const nodeRefs = useRef([]);
  nodeRefs.current = nodes.map((_, i) => nodeRefs.current[i] || React.createRef());

  const half = Math.ceil(nodes.length / 2);
  const left = nodes.slice(0, half);
  const right = nodes.slice(half);

  const column = (list, offset) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {list.map((unit, i) => (
        <NetworkNode key={unit.key} ind={ind} ref={nodeRefs.current[offset + i]} title={`${unit.label} · ${unit.count}`}>
          {unit.count}
        </NetworkNode>
      ))}
    </div>
  );

  return (
    <div
      ref={containerRef}
      style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 18,
        padding: '14px 8px',
        minHeight: 132,
      }}
    >
      {column(left, 0)}
      <NetworkNode ind={ind} ref={hubRef} accent>
        <Network size={16} strokeWidth={1.5} />
      </NetworkNode>
      {column(right, left.length)}

      {nodes.map((unit, i) => (
        <AnimatedBeam
          key={`beam-${unit.key}`}
          containerRef={containerRef}
          fromRef={hubRef}
          toRef={nodeRefs.current[i]}
          curvature={i < left.length ? (i % 2 === 0 ? 34 : -34) : i % 2 === 0 ? -34 : 34}
          reverse={i >= left.length}
          delay={0.2 * i}
          duration={4}
          pathColor={ind.hairline}
          pathWidth={1}
          pathOpacity={1}
          gradientStartColor={ind.accent}
          gradientStopColor={ind.accentDeep}
        />
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Ledger pieces
 * ------------------------------------------------------------------ */

const LEDGER_COLUMNS = '1.5fr 1.15fr 128px 92px 124px 100px';

function LedgerRow({
  ind, wide, person, selected, last, onOpen, t,
}) {
  const rowStyle = wide
    ? {
      display: 'grid',
      gridTemplateColumns: LEDGER_COLUMNS,
      gap: 12,
      alignItems: 'center',
      padding: '10px 16px',
    }
    : {
      display: 'grid',
      gridTemplateColumns: 'minmax(0,1fr) auto',
      gap: '8px 12px',
      alignItems: 'center',
      padding: '12px 14px',
    };

  const secondary = { fontFamily: BODY, fontSize: 11.5, color: ind.inkMuted, lineHeight: 1.35 };
  const value = { fontFamily: BODY, fontSize: 12.5, color: ind.ink, lineHeight: 1.35 };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onOpen(person)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(person); }
      }}
      style={{
        ...rowStyle,
        cursor: 'pointer',
        borderBottom: last ? 'none' : `1px solid ${ind.rule}`,
        background: selected ? ind.accentWash : 'transparent',
        boxShadow: selected ? `inset 3px 0 0 ${ind.accent}` : 'none',
        transition: 'background .15s ease',
      }}
      onMouseEnter={(e) => { if (!selected) e.currentTarget.style.background = ind.accentWash; }}
      onMouseLeave={(e) => { if (!selected) e.currentTarget.style.background = 'transparent'; }}
    >
      {/* 1 — employee. The only place the person is named. */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 11, minWidth: 0 }}>
        <Portrait ind={ind} employee={person.employee} name={person.name} size={30} dashed={person.notStarted} />
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              fontFamily: BODY, fontSize: 13.5, color: ind.ink, lineHeight: 1.3,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}
          >
            {person.name}
          </div>
          <div style={{ ...secondary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {person.role}
            {person.startLabel ? ` · ${person.startLabel}` : ''}
          </div>
        </div>
      </div>

      {/* 6 — state. On a narrow row it rides beside the name. */}
      {!wide && <StateWord ind={ind} state={person.state} align="end" />}

      {/* 2 — contact */}
      <div style={{ minWidth: 0, gridColumn: wide ? undefined : '1 / -1' }}>
        <div style={{ ...value, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {person.email || t('employeeDirectory.noMailbox', 'No mailbox yet')}
        </div>
        <div style={{ ...secondary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {person.contactLine}
        </div>
      </div>

      {/* 3 — tenure, standing in for the contract the schema does not hold */}
      <div style={{ minWidth: 0, gridColumn: wide ? undefined : '1 / -1' }}>
        <div style={value}>{person.tenureLabel}</div>
        <div style={secondary}>{person.tenureNote}</div>
      </div>

      {/* 4 — this week; the note takes ink only when there is an exception */}
      <div style={{ minWidth: 0, gridColumn: wide ? undefined : 'auto' }}>
        <div style={{ ...figure(13, person.hours == null ? ind.inkFaint : ind.ink) }}>
          {person.hours == null ? '—' : fmtHours(person.hours)}
        </div>
        <div
          style={{
            fontFamily: BODY, fontSize: 11, lineHeight: 1.35,
            color: person.hoursException ? ind.accentDeep : ind.inkFaint,
          }}
        >
          {person.hoursNote}
        </div>
      </div>

      {/* 5 — performance */}
      <div style={{ gridColumn: wide ? undefined : 'auto' }}>
        <RatingCell ind={ind} rating={person.rating} />
      </div>

      {wide && <StateWord ind={ind} state={person.state} align="end" />}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Plate — the card view as a blueprint object
 * ------------------------------------------------------------------ */

function Plate({ ind, person, focused, onOpen, onPickPhoto, uploadLabel, t, navigate }) {
  const field = { display: 'flex', justifyContent: 'space-between', gap: 12, padding: '7px 0', borderTop: `1px solid ${ind.rule}`, fontFamily: BODY, fontSize: 12.5 };
  const label = { color: ind.inkMuted, flex: 'none' };
  const val = { color: ind.ink, textAlign: 'right', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' };

  return (
    <Blueprint
      ind={ind}
      tint={focused}
      style={{ padding: '16px 18px 14px', display: 'flex', flexDirection: 'column', minWidth: 0 }}
    >
      {focused && (
        <BorderBeam size={90} duration={7} borderWidth={1.5} colorFrom={ind.accent} colorTo={ind.accentDeep} />
      )}

      {/* Code line — an identifier and a state, where the gradient band used to be */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10 }}>
        <span style={{ fontFamily: DISPLAY, fontWeight: 600, fontSize: 10, letterSpacing: '.16em', textTransform: 'uppercase', color: ind.accent, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {t('employeeDirectory.code', 'ID')} {person.code}
        </span>
        <StateWord ind={ind} state={person.state} />
      </div>

      {/* Identity — the unit is named here, once */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, margin: '13px 0 0' }}>
        <Portrait
          ind={ind}
          employee={person.employee}
          name={person.name}
          size={64}
          fontSize={20}
          dashed={person.notStarted}
          onPickPhoto={onPickPhoto}
          uploadLabel={uploadLabel}
        />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontFamily: DISPLAY, fontWeight: 600, fontSize: 22, lineHeight: 1.1, letterSpacing: '.02em', color: ind.ink }}>
            {person.name}
          </div>
          <div style={{ fontFamily: BODY, fontSize: 12.5, color: ind.inkGhost, marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {person.role}
          </div>
          <div style={{ fontFamily: DISPLAY, fontWeight: 600, fontSize: 10, letterSpacing: '.14em', textTransform: 'uppercase', color: ind.inkFaint, marginTop: 6 }}>
            {person.unitLabel} · {person.plateFact}
          </div>
        </div>
      </div>

      {/* Field list — fixed labels, fixed order */}
      <div style={{ marginTop: 14 }}>
        <div style={field}>
          <span style={label}>{t('employeeDirectory.joined', 'Joined')}</span>
          <span style={{ ...val, color: person.notStarted ? ind.accentDeep : ind.ink }}>{person.plateJoined}</span>
        </div>
        <div style={field}>
          <span style={label}>{t('employeeDirectory.records', 'Records')}</span>
          <span style={val}>{person.documentsLabel}</span>
        </div>
        <div style={field}>
          <span style={label}>{t('employeeDirectory.thisWeek', 'This week')}</span>
          <span style={{ ...val, color: person.hoursException ? ind.accentDeep : ind.ink }}>{person.plateWeek}</span>
        </div>
      </div>

      {/* Rating — one figure, and a caption that compares rather than repeats */}
      {person.rating == null ? (
        <div
          style={{
            marginTop: 14,
            border: `1px solid ${ind.hairline}`,
            background: ind.accentWash,
            padding: '10px 12px',
          }}
        >
          <div style={{ fontFamily: DISPLAY, fontWeight: 600, fontSize: 12.5, letterSpacing: '.06em', textTransform: 'uppercase', color: ind.accentDeep }}>
            {person.noticeTitle}
          </div>
          <div style={{ fontFamily: BODY, fontSize: 11.5, color: ind.inkGhost, marginTop: 4, lineHeight: 1.45 }}>
            {person.noticeBody}
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 11, marginTop: 14 }}>
          <span style={{ ...figure(34, ind.ink), lineHeight: 0.9 }}>{fmt1(person.rating)}</span>
          <div style={{ flex: 1, paddingBottom: 3, minWidth: 0 }}>
            <div style={{ fontFamily: BODY, fontSize: 11.5, color: ind.inkMuted, marginBottom: 5, lineHeight: 1.35 }}>
              {person.ratingCaption}
            </div>
            <Bar ind={ind} value={person.rating / 5} fill={ind.accent} height={7} />
          </div>
        </div>
      )}

      {/* The spacer that keeps every footer on one baseline */}
      <div style={{ flex: 1 }} />

      <div
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
          marginTop: 14, paddingTop: 12, borderTop: `1px solid ${ind.hairline}`,
        }}
      >
        <div style={{ display: 'flex', gap: 14, minWidth: 0 }}>
          {person.email && (
            <a
              href={`mailto:${person.email}`}
              onClick={(e) => e.stopPropagation()}
              style={{ fontFamily: DISPLAY, fontWeight: 600, fontSize: 11, letterSpacing: '.1em', textTransform: 'uppercase', color: ind.accentDeep, textDecoration: 'none' }}
            >
              {t('employeeDirectory.sendMail', 'Mail')}
            </a>
          )}
          <TrailLink ind={ind} arrow={false} onClick={() => navigate('/time-tracking')}>
            {t('employeeDirectory.viewHours', 'Hours')}
          </TrailLink>
        </div>
        <Btn
          ind={ind}
          variant={focused ? 'primary' : 'secondary'}
          onClick={() => onOpen(person)}
          style={{ padding: '5px 13px', fontSize: 12.5, flex: 'none' }}
        >
          {t('employeeDirectory.openRecord', 'Open record')}
        </Btn>
      </div>
    </Blueprint>
  );
}

/* ------------------------------------------------------------------ *
 * Record panels
 * ------------------------------------------------------------------ */

function Panel({ ind, num, title, right, children, style }) {
  return (
    <Blueprint ind={ind} style={{ padding: '16px 20px 14px', display: 'flex', flexDirection: 'column', minWidth: 0, ...style }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: right ? 'space-between' : 'flex-start', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, minWidth: 0 }}>
          <span style={{ fontFamily: DISPLAY, fontWeight: 600, fontSize: 10, letterSpacing: '.16em', color: ind.accent }}>{num}</span>
          <span style={{ fontFamily: DISPLAY, fontWeight: 600, fontSize: 16, letterSpacing: '.06em', textTransform: 'uppercase', color: ind.ink }}>
            {title}
          </span>
        </div>
        {right}
      </div>
      {children}
    </Blueprint>
  );
}

function FactRow({ ind, label, value, first }) {
  return (
    <div
      style={{
        display: 'flex', justifyContent: 'space-between', gap: 14,
        padding: '9px 0', borderTop: `1px solid ${ind.rule}`,
        fontFamily: BODY, fontSize: 12.5, marginTop: first ? 10 : 0,
      }}
    >
      <span style={{ color: ind.inkMuted, flex: 'none' }}>{label}</span>
      <span style={{ color: ind.ink, textAlign: 'right', minWidth: 0 }}>{value}</span>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Screen
 * ------------------------------------------------------------------ */

const EmployeeDirectory = ({
  employees = [],
  loading = false,
  onOpenProfile,
  onEdit,
  onDelete,
  onPhotoUpdate,
}) => {
  const { t, currentLanguage } = useLanguage();
  const { isDarkMode } = useTheme();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { handleSessionAuthError } = useSessionGuard();
  const ind = useMemo(() => getIndustry(isDarkMode), [isDarkMode]);
  const wide = useMinWidth(1180);

  const canManage = user?.role === 'admin' || user?.role === 'hr';

  /* ---------------- view state ---------------- */

  const [view, setView] = useState('ledger');      // ledger | plates | record
  const [scope, setScope] = useState('all');       // all | leave | starting | left
  const [query, setQuery] = useState('');
  const [unitTab, setUnitTab] = useState(null);
  const [platePage, setPlatePage] = useState(0);
  const [openUnits, setOpenUnits] = useState(null); // null → the first DEFAULT_OPEN_UNITS
  const [recordId, setRecordId] = useState(null);
  const [indexQuery, setIndexQuery] = useState('');
  const [notice, setNotice] = useState(null);

  /* ---------------- fetched relations ---------------- */

  const [entries, setEntries] = useState([]);
  const [leave, setLeave] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [fetching, setFetching] = useState(true);
  const [fetchError, setFetchError] = useState(null);

  const [now] = useState(() => new Date());
  const weekStart = useMemo(() => startOfWeek(now), [now]);
  const weekEnd = useMemo(() => addDays(weekStart, 6), [weekStart]);
  const today = useMemo(() => isoDay(now), [now]);

  const fetchAll = useCallback(async () => {
    setFetching(true);
    setFetchError(null);
    try {
      const [entryResult, leaveResult, reviewResult, taskResult] = await Promise.all([
        timeTrackingService.getAllTimeEntriesDetailed({
          startDate: isoDay(weekStart),
          endDate: isoDay(weekEnd),
        }),
        timeTrackingService.getAllLeaveRequests({
          year: now.getFullYear(),
          includeEmployeeDetails: false,
        }),
        performanceService.getAllPerformanceReviews(),
        workloadService.getAllTasks(),
      ]);

      setEntries(entryResult?.success ? entryResult.data || [] : []);
      setLeave(leaveResult?.success ? leaveResult.data || [] : []);
      setReviews(reviewResult?.success ? reviewResult.data || [] : []);
      setTasks(taskResult?.success ? taskResult.data || [] : []);

      const failed = [entryResult, leaveResult, reviewResult, taskResult].find((r) => r && !r.success);
      if (failed) {
        console.error('Failed to load employee directory data:', failed.error);
        setFetchError(t('errors.loadFailed', 'Failed to load data'));
      }
    } catch (error) {
      if (!handleSessionAuthError(error, { silent: true })) {
        setFetchError(t('errors.loadFailed', 'Failed to load data'));
      }
    } finally {
      setFetching(false);
    }
  }, [weekStart, weekEnd, now, t, handleSessionAuthError]);

  useEffect(() => { fetchAll(); }, [fetchAll]);
  useAuthenticatedPageRefresh(fetchAll);

  /* ---------------- per-person derivation ---------------- */

  /** Approved leave that covers today, by employee id. */
  const leaveToday = useMemo(() => {
    const map = new Map();
    for (const request of leave) {
      const status = String(request?.status || '').toLowerCase();
      if (status !== 'approved') continue;
      const start = String(request.start_date || '').slice(0, 10);
      const end = String(request.end_date || request.start_date || '').slice(0, 10);
      if (start <= today && end >= today) map.set(String(request.employee_id), request);
    }
    return map;
  }, [leave, today]);

  /** Leave days already taken this year, by employee id. */
  const leaveTaken = useMemo(() => {
    const map = new Map();
    for (const request of leave) {
      const status = String(request?.status || '').toLowerCase();
      if (status !== 'approved') continue;
      const id = String(request.employee_id);
      map.set(id, (map.get(id) || 0) + (Number(request.days_count) || 0));
    }
    return map;
  }, [leave]);

  /** This week's hours, split into contracted and overtime, by employee id. */
  const week = useMemo(() => {
    const map = new Map();
    for (const entry of entries) {
      const id = String(entry.employee_id);
      let bucket = map.get(id);
      if (!bucket) {
        bucket = { total: 0, overtime: 0, pending: 0, pendingCount: 0, byType: new Map() };
        map.set(id, bucket);
      }
      const hours = Number(entry.hours) || 0;
      const type = String(entry.hour_type || 'regular').toLowerCase();
      bucket.total += hours;
      if (OVERTIME_TYPES.has(type)) bucket.overtime += hours;
      if (String(entry.status || '').toLowerCase() === 'pending') {
        bucket.pending += hours;
        bucket.pendingCount += 1;
      }
      bucket.byType.set(type, (bucket.byType.get(type) || 0) + hours);
    }
    return map;
  }, [entries]);

  /** Newest review per employee, plus the count still waiting for a signature. */
  const reviewByEmployee = useMemo(() => {
    const map = new Map();
    for (const review of reviews) {
      const id = String(review.employee_id);
      const current = map.get(id);
      const stamp = new Date(review.review_date || review.updated_at || review.created_at || 0).getTime();
      if (!current || stamp > current.stamp) map.set(id, { review, stamp });
    }
    return map;
  }, [reviews]);

  const unsignedReviews = useMemo(
    () => reviews.filter((r) => !SIGNED_OFF_REVIEW.has(String(r.status || '').toLowerCase())),
    [reviews]
  );

  /** Open work per employee id. */
  const tasksByEmployee = useMemo(() => {
    const map = new Map();
    for (const task of tasks) {
      const id = String(task.employee_id);
      if (!map.has(id)) map.set(id, []);
      map.get(id).push(task);
    }
    return map;
  }, [tasks]);

  const orgMean = useMemo(() => {
    const rated = employees.map((e) => clampRating(e?.performance)).filter((r) => r != null && r > 0);
    if (!rated.length) return null;
    return rated.reduce((sum, r) => sum + r, 0) / rated.length;
  }, [employees]);

  /**
   * One person, with every fact the three views need already resolved. Built
   * once so the ledger row, the plate and the record cannot disagree.
   */
  const buildPerson = useCallback((employee) => {
    const id = String(employee.id);
    const name = getDemoEmployeeName(employee, t) || employee.name || '';
    const start = startDateOf(employee);
    const daysSinceStart = start ? dayDiff(start, new Date(now)) : null;
    const notStarted = daysSinceStart != null && daysSinceStart < 0;
    const months = tenureMonths(start, now);
    const bucket = week.get(id);
    const onLeave = leaveToday.get(id);
    const inactive = isEmployeeInactive(employee);
    const rating = clampRating(employee?.performance);
    const unitKey = normalizeKey(employee?.department) || 'unknown';
    const positionKey = getEmployeePositionI18nKey(employee?.position || '');

    const yearLabel = t('employeeDirectory.yearsShort', 'yr');
    const monthLabel = t('employeeDirectory.monthsShort', 'mo');
    const years = months == null ? 0 : Math.floor(months / 12);
    const restMonths = months == null ? 0 : months % 12;

    let state;
    if (inactive) {
      state = { key: 'left', label: t('employeeDirectory.stateLeft', 'Left'), tone: ind.inkFaint };
    } else if (notStarted) {
      state = {
        key: 'starting',
        label: `${t('employeeDirectory.stateStarting', 'Starts')} ${formatDate(start, currentLanguage, { day: '2-digit', month: '2-digit' })}`,
        tone: ind.accentDeep,
      };
    } else if (onLeave) {
      state = { key: 'leave', label: t('employeeDirectory.stateOnLeave', 'On leave'), tone: ind.accent };
    } else if (bucket?.pendingCount) {
      state = { key: 'pending', label: t('employeeDirectory.statePending', 'Awaiting approval'), tone: ind.accent };
    } else {
      state = { key: 'working', label: t('employeeDirectory.stateWorking', 'Working'), tone: ind.inkGhost };
    }

    /* This week — the note carries the exception, and only then takes ink. */
    let hoursNote = t('employeeDirectory.noOvertime', 'No overtime');
    let hoursException = false;
    if (notStarted) {
      hoursNote = t('employeeDirectory.notStartedYet', 'Not started');
    } else if (!bucket || bucket.total === 0) {
      hoursNote = onLeave
        ? t('employeeDirectory.onLeaveNote', 'On approved leave')
        : t('employeeDirectory.noTimesheet', 'No timesheet');
    } else if (bucket.pendingCount > 0) {
      hoursNote = t('employeeDirectory.pendingHours', '{h} awaiting approval').replace('{h}', fmtHours(bucket.pending));
      hoursException = true;
    } else if (bucket.overtime > 0) {
      hoursNote = `${fmtHours(bucket.overtime)} ${t('employeeDirectory.overtimeShort', 'OT')}`;
      hoursException = true;
    }

    const documents = hasDocuments(employee);

    return {
      id,
      employee,
      name,
      code: employee?.id ?? '—',
      role: employee?.position
        ? t(`employeePosition.${positionKey}`, employee.position)
        : t('common.notAvailable', 'N/A'),
      unitKey,
      unitLabel: t(`departments.${unitKey}`, employee?.department || t('employeeDirectory.noUnit', 'Unassigned')),
      email: employee?.email || '',
      phone: employee?.phone || '',
      contactLine: [employee?.phone, employee?.location || employee?.address]
        .filter(Boolean).join(' · ') || t('employeeDirectory.noPhone', 'No phone on file'),
      start,
      daysSinceStart,
      notStarted,
      startLabel: start
        ? `${notStarted ? t('employeeDirectory.startsOn', 'starts') : t('employeeDirectory.joinedOn', 'joined')} ${formatDate(start, currentLanguage, { day: '2-digit', month: '2-digit', year: 'numeric' })}`
        : '',
      months,
      tenureLabel: notStarted
        ? t('employeeDirectory.notStartedYet', 'Not started')
        : months == null
          ? '—'
          : years === 0
            ? `${restMonths} ${monthLabel}`
            : restMonths === 0
              ? `${years} ${yearLabel}`
              : `${years} ${yearLabel} ${restMonths} ${monthLabel}`,
      tenureNote: start
        ? `${t('employeeDirectory.since', 'Since')} ${formatDate(start, currentLanguage, { day: '2-digit', month: '2-digit', year: 'numeric' })}`
        : t('employeeDirectory.noStartDate', 'No start date'),
      hours: notStarted || !bucket ? null : bucket.total,
      overtime: bucket?.overtime || 0,
      pendingHours: bucket?.pending || 0,
      pendingCount: bucket?.pendingCount || 0,
      byType: bucket?.byType || new Map(),
      hoursNote,
      hoursException,
      rating,
      state,
      inactive,
      onLeave,
      documents,
      documentsLabel: documents
        ? t('employeeDirectory.documentsComplete', 'Complete')
        : t('employeeDirectory.documentsMissing', 'Missing'),
      leaveTaken: leaveTaken.get(id) || 0,
      review: reviewByEmployee.get(id)?.review || null,
      tasks: tasksByEmployee.get(id) || [],
      plateJoined: notStarted
        ? `${formatDate(start, currentLanguage, { day: '2-digit', month: '2-digit', year: 'numeric' })} · ${t('employeeDirectory.inNDays', 'in {n} days').replace('{n}', String(Math.abs(daysSinceStart)))}`
        : start
          ? `${formatDate(start, currentLanguage, { day: '2-digit', month: '2-digit', year: 'numeric' })}`
          : '—',
      plateWeek: notStarted || !bucket
        ? hoursNote
        : `${fmtHours(bucket.total)} · ${hoursNote}`,
      plateFact: documents
        ? t('employeeDirectory.recordsOnFile', 'Records on file')
        : t('employeeDirectory.recordsMissing', 'No documents'),
      noticeTitle: notStarted
        ? t('employeeDirectory.noReviewYetTitle', 'No review cycle yet')
        : t('employeeDirectory.noRatingTitle', 'Not rated this cycle'),
      noticeBody: notStarted
        ? t('employeeDirectory.noReviewYetBody', 'Starts {date} — the first cycle opens after onboarding.')
          .replace('{date}', formatDate(start, currentLanguage, { day: '2-digit', month: '2-digit', year: 'numeric' }))
        : t('employeeDirectory.noRatingBody', 'No score has been filed, so the bar is left empty rather than guessed.'),
      ratingCaption: rating == null || orgMean == null
        ? t('employeeDirectory.outOfFive', 'out of 5.0')
        : rating >= orgMean
          ? t('employeeDirectory.aboveMean', 'out of 5.0 · {d} above the company mean {m}')
            .replace('{d}', fmt1(rating - orgMean)).replace('{m}', fmt1(orgMean))
          : t('employeeDirectory.belowMean', 'out of 5.0 · {d} below the company mean {m}')
            .replace('{d}', fmt1(orgMean - rating)).replace('{m}', fmt1(orgMean)),
    };
  }, [t, currentLanguage, now, week, leaveToday, leaveTaken, reviewByEmployee, tasksByEmployee, ind, orgMean]);

  const people = useMemo(() => employees.map(buildPerson), [employees, buildPerson]);
  const peopleById = useMemo(() => new Map(people.map((p) => [p.id, p])), [people]);

  /* ---------------- cohorts ---------------- */

  const activePeople = useMemo(() => people.filter((p) => !p.inactive), [people]);

  const counts = useMemo(() => ({
    all: activePeople.length,
    leave: activePeople.filter((p) => p.onLeave).length,
    starting: activePeople.filter((p) => p.notStarted).length,
    left: people.filter((p) => p.inactive).length,
    working: activePeople.filter((p) => p.state.key === 'working' || p.state.key === 'pending').length,
    joinedThisMonth: activePeople.filter((p) => {
      if (!p.start) return false;
      const d = new Date(p.start);
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    }).length,
    missingDocuments: activePeople.filter((p) => !p.documents).length,
  }), [activePeople, people, now]);

  const scoped = useMemo(() => {
    switch (scope) {
      case 'leave': return activePeople.filter((p) => p.onLeave);
      case 'starting': return activePeople.filter((p) => p.notStarted);
      case 'left': return people.filter((p) => p.inactive);
      default: return activePeople;
    }
  }, [scope, activePeople, people]);

  const searched = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return scoped;
    return scoped.filter((p) =>
      p.name.toLowerCase().includes(q)
      || p.email.toLowerCase().includes(q)
      || String(p.code).toLowerCase().includes(q)
      || p.unitLabel.toLowerCase().includes(q)
      || p.role.toLowerCase().includes(q));
  }, [scoped, query]);

  /** Units of the searched cohort, largest first. The band names the unit. */
  const units = useMemo(() => {
    const map = new Map();
    for (const person of searched) {
      if (!map.has(person.unitKey)) {
        map.set(person.unitKey, { key: person.unitKey, label: person.unitLabel, list: [] });
      }
      map.get(person.unitKey).list.push(person);
    }
    return Array.from(map.values())
      .map((unit) => {
        const rated = unit.list.map((p) => p.rating).filter((r) => r != null && r > 0);
        return {
          ...unit,
          list: [...unit.list].sort((a, b) => (b.rating ?? -1) - (a.rating ?? -1) || a.name.localeCompare(b.name)),
          count: unit.list.length,
          mean: rated.length ? rated.reduce((s, r) => s + r, 0) / rated.length : null,
          starting: unit.list.filter((p) => p.notStarted).length,
          pending: unit.list.filter((p) => p.pendingCount > 0).length,
          missingDocuments: unit.list.filter((p) => !p.documents).length,
        };
      })
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
  }, [searched]);

  const largestUnit = units[0]?.count || 1;

  /**
   * Departments the roster puts nobody in. A distribution built only from the
   * people present cannot say "nobody works here", and that silence read as the
   * department having gone missing from the screen.
   */
  const emptyUnits = useMemo(() => {
    const present = new Set(units.map((u) => u.key));
    return DEPARTMENT_KEYS
      .filter((key) => !present.has(key))
      .map((key) => ({ key, label: t(`departments.${key}`, key) }));
  }, [units, t]);

  /** Units open in the ledger. A search opens everything it matched. */
  const effectiveOpen = useMemo(() => {
    if (query.trim()) return new Set(units.map((u) => u.key));
    if (openUnits) return openUnits;
    return new Set(units.slice(0, DEFAULT_OPEN_UNITS).map((u) => u.key));
  }, [query, openUnits, units]);

  const rowsRendered = useMemo(
    () => units.filter((u) => effectiveOpen.has(u.key)).reduce((sum, u) => sum + u.count, 0),
    [units, effectiveOpen]
  );

  const toggleUnit = useCallback((key) => {
    setOpenUnits((prev) => {
      const base = prev || new Set(units.slice(0, DEFAULT_OPEN_UNITS).map((u) => u.key));
      const next = new Set(base);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }, [units]);

  /* ---------------- the plate view's unit ---------------- */

  const plateUnit = useMemo(() => {
    if (!units.length) return null;
    return units.find((u) => u.key === unitTab) || units[0];
  }, [units, unitTab]);


  const platePages = plateUnit ? Math.max(1, Math.ceil(plateUnit.count / PLATES_PER_PAGE)) : 1;
  const pageIndex = Math.min(platePage, platePages - 1);
  const plates = plateUnit
    ? plateUnit.list.slice(pageIndex * PLATES_PER_PAGE, pageIndex * PLATES_PER_PAGE + PLATES_PER_PAGE)
    : [];

  /* ---------------- the record ---------------- */

  const record = recordId ? peopleById.get(recordId) : null;

  const recordUnit = useMemo(() => {
    if (!record) return null;
    // Someone who has left still gets their own index row — otherwise the record
    // you are reading is missing from the list beside it.
    const list = people
      .filter((p) => p.unitKey === record.unitKey && (!p.inactive || p.id === record.id))
      .sort((a, b) => (b.rating ?? -1) - (a.rating ?? -1) || a.name.localeCompare(b.name));
    return { key: record.unitKey, label: record.unitLabel, list };
  }, [record, people]);

  const recordIndex = useMemo(() => {
    if (!recordUnit) return [];
    const q = indexQuery.trim().toLowerCase();
    if (!q) return recordUnit.list;
    return recordUnit.list.filter((p) => p.name.toLowerCase().includes(q) || p.role.toLowerCase().includes(q));
  }, [recordUnit, indexQuery]);

  const openRecord = useCallback((person) => {
    setRecordId(person.id);
    setIndexQuery('');
    setView('record');
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  /* ---------------- the decision queue ---------------- */

  const pendingEntries = useMemo(
    () => entries.filter((e) => String(e.status || '').toLowerCase() === 'pending'),
    [entries]
  );

  const pendingLeave = useMemo(
    () => leave.filter((r) => String(r.status || '').toLowerCase() === 'pending'),
    [leave]
  );

  /** The nearest person still to arrive, and the person banking the most unapproved time. */
  const nextStarter = useMemo(
    () => activePeople.filter((p) => p.notStarted).sort((a, b) => a.daysSinceStart - b.daysSinceStart).pop() || null,
    [activePeople]
  );

  const biggestPending = useMemo(
    () => activePeople.filter((p) => p.pendingCount > 0).sort((a, b) => b.pendingHours - a.pendingHours)[0] || null,
    [activePeople]
  );

  const missingDocumentPeople = useMemo(
    () => activePeople.filter((p) => !p.documents),
    [activePeople]
  );

  /** Every item the decision column will show, so its count is never typed twice. */
  const queue = useMemo(() => {
    const items = [];
    if (nextStarter) items.push({ kind: 'starter', person: nextStarter });
    if (biggestPending) items.push({ kind: 'overtime', person: biggestPending });
    if (pendingEntries.length) items.push({ kind: 'timesheets', count: pendingEntries.length });
    if (unsignedReviews.length) items.push({ kind: 'reviews', count: unsignedReviews.length });
    if (pendingLeave.length) items.push({ kind: 'leave', count: pendingLeave.length });
    if (missingDocumentPeople.length) items.push({ kind: 'documents', count: missingDocumentPeople.length });
    return items.slice(0, QUEUE_ROWS);
  }, [nextStarter, biggestPending, pendingEntries, unsignedReviews, pendingLeave, missingDocumentPeople]);

  /** The rated roster, best first — the podium's three places and its runners-up. */
  const ranked = useMemo(
    () => activePeople
      .filter((p) => p.rating != null && p.rating > 0)
      .sort((a, b) => b.rating - a.rating || a.name.localeCompare(b.name)),
    [activePeople]
  );

  const recentJoiners = useMemo(() => activePeople
    .filter((p) => p.start && p.daysSinceStart != null && p.daysSinceStart <= RECENT_JOINER_DAYS)
    .sort((a, b) => a.daysSinceStart - b.daysSinceStart)
    .slice(0, RECENT_JOINER_ROWS), [activePeople]);

  /* ---------------- actions ---------------- */

  const handlePhoto = useCallback((person) => (event) => {
    const file = event.target.files?.[0];
    if (!file || !onPhotoUpdate) return;
    if (!file.type.startsWith('image/')) {
      setNotice({ kind: 'error', text: t('errors.invalidFileType', 'Please select an image file') });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setNotice({ kind: 'error', text: t('errors.fileTooLarge', 'File size must be less than 5MB') });
      return;
    }
    const reader = new FileReader();
    reader.onloadend = async () => {
      const result = await onPhotoUpdate(person.id, reader.result, true);
      setNotice(result?.success
        ? { kind: 'ok', text: t('employeeDirectory.photoUpdated', 'Photo updated.') }
        : { kind: 'error', text: result?.error || t('common.error', 'Error') });
    };
    reader.onerror = () => setNotice({ kind: 'error', text: t('errors.fileReadError', 'Error reading file') });
    reader.readAsDataURL(file);
  }, [onPhotoUpdate, t]);

  /** Client-side export of exactly the rows on screen — never the whole table. */
  const exportList = useCallback(() => {
    const header = [
      t('employees.name', 'Name'),
      t('employees.department', 'Department'),
      t('employees.position', 'Position'),
      t('employees.email', 'Email'),
      t('employees.phone', 'Phone'),
      t('employees.startDate', 'Start Date'),
      t('employeeDirectory.thisWeek', 'This week'),
      t('employees.performance', 'Performance'),
      t('employees.statusLabel', 'Status'),
    ];
    const rows = searched.map((p) => [
      p.name, p.unitLabel, p.role, p.email, p.phone, p.start || '',
      p.hours == null ? '' : fmtHours(p.hours),
      p.rating == null ? '' : fmt1(p.rating),
      p.state.label,
    ]);
    const csv = [header, ...rows]
      .map((row) => row.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(','))
      .join('\r\n');
    // Byte-order mark, so Excel opens the Vietnamese names as UTF-8.
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `employees-${isoDay(now)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    setNotice({
      kind: 'ok',
      text: t('employeeDirectory.exported', 'Exported {n} people.').replace('{n}', String(searched.length)),
    });
  }, [searched, t, now]);

  /* ---------------- shared styles ---------------- */

  const caption = { fontFamily: BODY, fontSize: 13, color: ind.inkMuted, lineHeight: 1.45 };
  const meta = { fontFamily: BODY, fontSize: 11.5, color: ind.inkFaint, lineHeight: 1.4 };
  const columnHeading = {
    fontFamily: DISPLAY, fontWeight: 600, fontSize: 16, letterSpacing: '.07em',
    textTransform: 'uppercase', color: ind.ink,
  };
  const readout = {
    fontFamily: DISPLAY, fontWeight: 600, fontSize: 11, letterSpacing: '.14em',
    textTransform: 'uppercase', color: ind.inkFaint, flex: 'none',
  };
  const chromeColumn = {
    background: ind.chrome,
    display: 'flex',
    flexDirection: 'column',
    minHeight: 0,
  };

  /* ---------------- ticker ---------------- */

  const tickerCells = view === 'record' && record
    ? [
      { label: t('employeeDirectory.tickerCode', 'ID'), value: String(record.code) },
      { label: t('employeeDirectory.tickerUnit', 'Unit'), value: record.unitLabel.toUpperCase() },
      { label: t('employees.performance', 'Performance'), value: record.rating == null ? '—' : fmt1(record.rating), highlight: true },
      { label: t('employeeDirectory.thisWeek', 'This week'), value: record.hours == null ? '—' : fmtHours(record.hours) },
      {
        label: t('employeeDirectory.openWork', 'Open work'),
        value: record.tasks.filter((task) => !CLOSED_TASK.has(String(task.status || '').toLowerCase())).length,
        numeric: true,
      },
    ]
    : [
      { label: t('employeeDirectory.headcount', 'Headcount'), value: counts.all, numeric: true },
      { label: t('employeeDirectory.working', 'Working'), value: counts.working, numeric: true },
      { label: t('employeeDirectory.onLeaveToday', 'On leave today'), value: counts.leave, numeric: true, highlight: view === 'ledger' },
      { label: t('employeeDirectory.joinedThisMonth', 'Joined this month'), value: counts.joinedThisMonth, numeric: true, highlight: view === 'plates' },
      { label: t('employeeDirectory.missingRecords', 'Missing records'), value: counts.missingDocuments, numeric: true },
    ];

  /* ---------------- render ---------------- */

  return (
    <div
      data-screen-label={
        view === 'record'
          ? 'Employee Record'
          : view === 'plates' ? 'Employee Directory · cards' : 'Employee Directory · ledger'
      }
      style={{
        border: `1px solid ${ind.hairline}`,
        background: ind.ground,
        color: ind.ink,
        fontFamily: BODY,
        fontSize: 14,
        borderRadius: 0,
      }}
    >
      {/* ── TICKER — five facts, and exactly one of them highlighted ─── */}
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
          <LiveClock ind={ind} live={!fetching} />
        </TickerCell>

        {tickerCells.map((cell) => (
          <TickerCell
            ind={ind}
            key={cell.label}
            label={cell.label}
            valueColor={cell.highlight ? ind.tickerUp : undefined}
            value={cell.numeric
              ? <SlidingNumber value={Number(cell.value) || 0} groupSeparator="" />
              : cell.value}
          />
        ))}

        <div
          style={{
            flex: 1,
            minWidth: 'max-content',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: 10,
            padding: '0 14px',
            borderLeft: `1px solid ${ind.tickerRule}`,
          }}
        >
          <FetchElapsedPill active={fetching || loading} isDarkMode label={t('common.fetching', 'Fetching')} />
        </div>
      </div>

      {/* ── BANDS ────────────────────────────────────────────────────── */}
      <div className="flex flex-col lg:flex-row items-stretch">

        {view === 'record' && record ? (
          <>
            {/* ── INDEX — 296px, left. Step down the unit without leaving. ── */}
            <div
              className="w-full lg:w-[296px] lg:shrink-0"
              style={{ ...chromeColumn, borderRight: `1px solid ${ind.hairline}` }}
            >
              <div style={{ padding: '16px 18px 12px', borderBottom: `1px solid ${ind.rule}` }}>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 }}>
                  <span style={{ ...columnHeading, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {recordUnit?.label}
                  </span>
                  <TrailLink ind={ind} arrow={false} onClick={() => setView('ledger')}>
                    {t('employeeDirectory.allPeople', 'All')} {counts.all}
                  </TrailLink>
                </div>
                <SearchBox
                  ind={ind}
                  value={indexQuery}
                  onChange={setIndexQuery}
                  placeholder={t('employeeDirectory.searchInUnit', 'Search {n} people').replace('{n}', String(recordUnit?.list.length || 0))}
                  style={{ marginTop: 10 }}
                />
              </div>

              <div style={{ flex: 1, minHeight: 0, maxHeight: 620, overflowY: 'auto' }}>
                {recordIndex.map((person) => {
                  const current = person.id === record.id;
                  return (
                    <button
                      key={person.id}
                      type="button"
                      onClick={() => openRecord(person)}
                      style={{
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        padding: '11px 18px',
                        border: 'none',
                        borderBottom: `1px solid ${ind.rule}`,
                        background: current ? ind.accentWash : 'transparent',
                        boxShadow: current ? `inset 3px 0 0 ${ind.accent}` : 'none',
                        cursor: 'pointer',
                        textAlign: 'left',
                        transition: 'background .15s ease',
                      }}
                      onMouseEnter={(e) => { if (!current) e.currentTarget.style.background = ind.accentWash; }}
                      onMouseLeave={(e) => { if (!current) e.currentTarget.style.background = 'transparent'; }}
                    >
                      <Portrait ind={ind} employee={person.employee} name={person.name} size={28} dashed={person.notStarted} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontFamily: BODY, fontSize: 12.5, color: ind.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {person.name}
                        </div>
                        <div
                          style={{
                            fontFamily: BODY, fontSize: 11, lineHeight: 1.35,
                            color: person.state.key === 'working' ? ind.inkMuted : person.state.tone,
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          }}
                        >
                          {person.state.key === 'working' ? person.role : person.state.label}
                        </div>
                      </div>
                      <span style={{ ...figure(12, person.rating == null ? ind.inkFaint : ind.ink), flex: 'none' }}>
                        {person.rating == null ? '—' : fmt1(person.rating)}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div
                style={{
                  padding: '11px 18px', display: 'flex', alignItems: 'center',
                  justifyContent: 'space-between', gap: 10, fontFamily: BODY, fontSize: 12, color: ind.inkMuted,
                }}
              >
                <span>
                  {t('employeeDirectory.shownOf', '{shown} / {total} people')
                    .replace('{shown}', String(recordIndex.length))
                    .replace('{total}', String(recordUnit?.list.length || 0))}
                </span>
                <TrailLink ind={ind} arrow={false} onClick={() => { setUnitTab(record.unitKey); setView('plates'); }}>
                  {t('employeeDirectory.viewCards', 'Cards')}
                </TrailLink>
              </div>
            </div>

            {/* ── RECORD — four numbered panels ───────────────────────── */}
            <div
              className="flex-1 min-w-0 flex flex-col"
              style={{ padding: '22px 24px 20px', gap: 16 }}
            >
              <div className="flex flex-wrap items-end justify-between" style={{ gap: 14 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', ...readout, color: ind.inkMuted }}>
                    <button
                      type="button"
                      onClick={() => setView('ledger')}
                      style={{ ...readout, color: ind.accentDeep, background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
                    >
                      {t('employeeDirectory.title', 'Employee directory')}
                    </button>
                    <span>/</span>
                    <span>{record.unitLabel}</span>
                    <span>/</span>
                    <span>{record.code}</span>
                  </div>
                  <h1 style={{ fontFamily: BODY, fontSize: 32, fontWeight: 400, margin: '2px 0 0', color: ind.ink, lineHeight: 1.1 }}>
                    {record.name}
                  </h1>
                  <p style={{ ...caption, marginTop: 6 }}>
                    {[
                      record.role,
                      record.start
                        ? `${t('employeeDirectory.joinedOn', 'joined')} ${formatDate(record.start, currentLanguage, { day: '2-digit', month: '2-digit', year: 'numeric' })}`
                        : null,
                      record.months != null ? record.tenureLabel : null,
                      t('employeeDirectory.unitSize', '{n} in the same unit')
                        .replace('{n}', String(recordUnit?.list.length || 0)),
                    ].filter(Boolean).join(' · ')}
                  </p>
                </div>

                <div style={{ display: 'flex', gap: 8, flex: 'none', flexWrap: 'wrap' }}>
                  {onOpenProfile && (
                    <Btn ind={ind} onClick={() => onOpenProfile(record.employee)}>
                      {t('employeeDirectory.fullProfile', 'Full profile')}
                    </Btn>
                  )}
                  {canManage && onEdit && (
                    <Btn ind={ind} onClick={() => onEdit(record.employee)}>
                      {t('employeeDirectory.editRecord', 'Edit record')}
                    </Btn>
                  )}
                  <Btn ind={ind} variant="primary" onClick={() => navigate('/task-listing')}>
                    {t('employeeDirectory.assignWork', 'Assign work')}
                  </Btn>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2" style={{ gap: 16 }}>
                {/* 01 — what the employment is */}
                <Panel ind={ind} num="01" title={t('employeeDirectory.panelEmployment', 'Employment')}>
                  <FactRow
                    first
                    ind={ind}
                    label={t('employeeDirectory.joined', 'Joined')}
                    value={record.start
                      ? `${formatDate(record.start, currentLanguage, { day: '2-digit', month: '2-digit', year: 'numeric' })} · ${record.tenureLabel}`
                      : t('employeeDirectory.noStartDate', 'No start date')}
                  />
                  <FactRow
                    ind={ind}
                    label={t('employeeDirectory.contact', 'Contact')}
                    value={[record.email, record.phone].filter(Boolean).join(' · ') || '—'}
                  />
                  <FactRow
                    ind={ind}
                    label={t('employeeDirectory.workplace', 'Workplace')}
                    value={record.employee?.location || record.employee?.address || t('employeeDirectory.noWorkplace', 'Not recorded')}
                  />
                  <FactRow
                    ind={ind}
                    label={t('employeeDirectory.overtimeCap', 'Overtime cap')}
                    value={(
                      <>
                        <button
                          type="button"
                          onClick={() => navigate('/policy-controls')}
                          style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: ind.accentDeep, fontFamily: BODY, fontSize: 12.5, textDecoration: 'underline' }}
                        >
                          {`${OVERTIME_CAP_HOURS}h / ${t('employeeDirectory.perMonth', 'month')}`}
                        </button>
                        {` · ${t('employeeDirectory.used', 'used')} ${fmtHours(record.overtime)}`}
                      </>
                    )}
                  />
                  <FactRow
                    ind={ind}
                    label={t('employeeDirectory.leaveBalance', 'Leave balance')}
                    value={t('employeeDirectory.leaveBalanceValue', '{left} / {total} days · {used} taken this year')
                      .replace('{left}', fmt1(Math.max(0, ANNUAL_LEAVE_DAYS - record.leaveTaken)).replace(/\.0$/, ''))
                      .replace('{total}', String(ANNUAL_LEAVE_DAYS))
                      .replace('{used}', fmt1(record.leaveTaken).replace(/\.0$/, ''))}
                  />
                  <FactRow
                    ind={ind}
                    label={t('employeeDirectory.records', 'Records')}
                    value={record.documents
                      ? t('employeeDirectory.documentsCompleteLong', 'Complete · document on file')
                      : t('employeeDirectory.documentsMissingLong', 'Missing · nothing on file')}
                  />

                  {canManage && onDelete && (
                    <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${ind.hairline}`, display: 'flex', justifyContent: 'flex-end' }}>
                      <button
                        type="button"
                        onClick={() => onDelete(record.employee)}
                        style={{
                          background: 'none', border: 'none', padding: 0, cursor: 'pointer',
                          fontFamily: DISPLAY, fontWeight: 600, fontSize: 11, letterSpacing: '.12em',
                          textTransform: 'uppercase', color: ind.inkMuted,
                        }}
                      >
                        {t('employeeDirectory.deleteRecord', 'Delete record')}
                      </button>
                    </div>
                  )}
                </Panel>

                {/* 02 — what they worked */}
                <Panel
                  ind={ind}
                  num="02"
                  title={t('employeeDirectory.panelTimesheet', 'This week')}
                  right={(
                    <TrailLink ind={ind} onClick={() => navigate('/time-tracking')}>
                      {t('employeeDirectory.openTimesheet', 'Open timesheet')}
                    </TrailLink>
                  )}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, marginTop: 12, flexWrap: 'wrap' }}>
                    <span style={{ ...figure(40, ind.ink), lineHeight: 0.9 }}>
                      {record.hours == null ? '—' : fmtHours(record.hours)}
                    </span>
                    <span style={{ ...meta, paddingBottom: 4, color: ind.inkMuted }}>
                      {t('employeeDirectory.againstContract', 'against {h}h contracted · {ot} overtime')
                        .replace('{h}', String(CONTRACT_WEEK_HOURS))
                        .replace('{ot}', fmtHours(record.overtime))}
                    </span>
                  </div>

                  {/* The only two-tone bar on the board: contracted, then overtime. */}
                  {(() => {
                    const total = record.hours || 0;
                    // Nothing filed means an empty track. A full accent bar at
                    // zero hours would read as a completed week.
                    const otShare = total > 0 ? Math.min(100, Math.round((record.overtime / total) * 100)) : 0;
                    return (
                      <div style={{ display: 'flex', height: 8, border: `1px solid ${ind.hairline}`, margin: '12px 0 8px' }}>
                        <div style={{ width: total > 0 ? `${100 - otShare}%` : 0, background: ind.accent }} />
                        <div style={{ width: total > 0 ? `${otShare}%` : 0, background: ind.accentDeeper }} />
                      </div>
                    );
                  })()}

                  {Array.from(record.byType.entries())
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 3)
                    .map(([type, hours]) => (
                      <div
                        key={type}
                        style={{
                          display: 'flex', justifyContent: 'space-between', gap: 12,
                          padding: '8px 0', borderTop: `1px solid ${ind.rule}`, fontFamily: BODY, fontSize: 12.5,
                        }}
                      >
                        <span style={{ color: ind.inkGhost }}>
                          {t(`timeClock.hourTypes.${HOUR_TYPE_KEYS[type] || type}`, type)}
                        </span>
                        <span style={{ ...figure(13, ind.ink) }}>{fmtHours(hours)}</span>
                      </div>
                    ))}
                  {record.byType.size === 0 && (
                    <p style={{ ...meta, marginTop: 10 }}>
                      {t('employeeDirectory.noEntriesThisWeek', 'No time entries filed between {from} and {to}.')
                        .replace('{from}', formatDate(weekStart, currentLanguage, { day: '2-digit', month: '2-digit' }))
                        .replace('{to}', formatDate(weekEnd, currentLanguage, { day: '2-digit', month: '2-digit' }))}
                    </p>
                  )}

                  <div style={{ flex: 1 }} />
                  <p style={{ ...meta, marginTop: 9 }}>
                    {record.pendingCount > 0
                      ? t('employeeDirectory.ownPending', '{n} of these entries are still waiting for approval.')
                        .replace('{n}', String(record.pendingCount))
                      : t('employeeDirectory.noPendingHere', 'Nothing on this record is waiting for approval · {n} entries elsewhere are.')
                        .replace('{n}', String(pendingEntries.length))}
                  </p>
                </Panel>

                {/* 03 — how they are rated */}
                <Panel
                  ind={ind}
                  num="03"
                  title={t('employeeDirectory.panelReview', 'Review')}
                  style={{ minHeight: 0 }}
                  right={(
                    <span style={meta}>
                      {record.review?.review_period
                        ? `${t('employeeDirectory.cycle', 'Cycle')} ${String(record.review.review_period).replace('-', ' ')}`
                        : t('employeeDirectory.noCycle', 'No cycle filed')}
                    </span>
                  )}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, marginTop: 12, flexWrap: 'wrap' }}>
                    <span style={{ ...figure(40, record.rating == null ? ind.inkFaint : ind.ink), lineHeight: 0.9 }}>
                      {record.rating == null ? '—' : fmt1(record.rating)}
                    </span>
                    <span style={{ ...meta, paddingBottom: 4, color: ind.inkMuted }}>
                      {record.rating == null ? record.noticeBody : record.ratingCaption}
                    </span>
                  </div>

                  <div style={{ marginTop: 12 }}>
                    <FactRow
                      ind={ind}
                      label={t('employeeDirectory.selfAssessment', 'Self-assessment')}
                      value={record.review?.employee_comments
                        ? t('employeeDirectory.filed', 'Filed')
                        : t('employeeDirectory.notFiled', 'Not filed')}
                    />
                    <FactRow
                      ind={ind}
                      label={t('employeeDirectory.managerReview', 'Manager review')}
                      value={record.review?.reviewer?.name
                        || (record.review ? t('employeeDirectory.unassignedReviewer', 'No reviewer named') : t('employeeDirectory.notFiled', 'Not filed'))}
                    />
                    <FactRow
                      ind={ind}
                      label={t('employeeDirectory.signOff', 'Sign-off')}
                      value={(
                        <span style={{
                          color: record.review && SIGNED_OFF_REVIEW.has(String(record.review.status).toLowerCase())
                            ? ind.ink
                            : ind.accentDeep,
                          fontFamily: DISPLAY,
                          fontWeight: 600,
                          fontSize: 13,
                          letterSpacing: '.06em',
                          textTransform: 'uppercase',
                        }}
                        >
                          {record.review
                            ? t(`employeeDirectory.reviewStatus.${String(record.review.status).toLowerCase()}`, String(record.review.status))
                            : t('employeeDirectory.notFiled', 'Not filed')}
                        </span>
                      )}
                    />
                  </div>

                  {/* Goals — a fraction bar, not a rating bar */}
                  {record.review && Number(record.review.goals_total) > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '9px 0', borderTop: `1px solid ${ind.rule}` }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontFamily: BODY, fontSize: 12.5, color: ind.ink }}>
                          {t('employeeDirectory.goalsMet', 'Goals met this cycle')}
                        </div>
                        <div style={meta}>
                          {`${record.review.goals_met || 0} / ${record.review.goals_total}`}
                        </div>
                      </div>
                      <div style={{ width: 56, flex: 'none' }}>
                        <Bar
                          ind={ind}
                          value={(Number(record.review.goals_met) || 0) / Number(record.review.goals_total)}
                          fill={ind.accent}
                          height={6}
                        />
                      </div>
                    </div>
                  )}

                  <div style={{ flex: 1 }} />
                  <div style={{ display: 'flex', gap: 7, marginTop: 12, paddingTop: 12, borderTop: `1px solid ${ind.hairline}` }}>
                    <Btn ind={ind} variant="primary" onClick={() => navigate('/task-review')} style={{ padding: '4px 12px', fontSize: 12.5 }}>
                      {t('employeeDirectory.openReview', 'Open review')}
                    </Btn>
                    <Btn ind={ind} onClick={() => navigate('/personal-goals')} style={{ padding: '4px 12px', fontSize: 12.5 }}>
                      {t('employeeDirectory.openGoals', 'Goals')}
                    </Btn>
                  </div>
                </Panel>

                {/* 04 — what they owe */}
                <Panel
                  ind={ind}
                  num="04"
                  title={t('employeeDirectory.panelWork', 'Open work')}
                  style={{ minHeight: 0 }}
                  right={(
                    <TrailLink ind={ind} onClick={() => navigate('/task-listing')}>
                      {t('employeeDirectory.openTaskBook', 'Task book')}
                    </TrailLink>
                  )}
                >
                  {(() => {
                    const open = record.tasks.filter((task) => !CLOSED_TASK.has(String(task.status || '').toLowerCase()));
                    const closed = record.tasks.filter((task) => CLOSED_TASK.has(String(task.status || '').toLowerCase()));
                    const shown = [...open.slice(0, 3), ...closed.slice(0, Math.max(0, 4 - Math.min(open.length, 3)))];

                    if (!shown.length) {
                      return (
                        <p style={{ ...meta, marginTop: 12 }}>
                          {t('employeeDirectory.noOpenWork', 'Nothing is assigned to this record.')}
                        </p>
                      );
                    }

                    return (
                      <>
                        {shown.map((task, i) => {
                          const done = CLOSED_TASK.has(String(task.status || '').toLowerCase());
                          const due = task.due_date ? new Date(task.due_date) : null;
                          const daysLate = due ? dayDiff(due, new Date(now)) : null;
                          const stateWord = done
                            ? { label: t('employeeDirectory.taskDone', 'Done'), tone: ind.inkFaint }
                            : daysLate != null && daysLate > 0
                              ? { label: t('employeeDirectory.taskLate', 'Late'), tone: ind.accentDeep }
                              : daysLate === 0
                                ? { label: t('employeeDirectory.taskToday', 'Today'), tone: ind.accent }
                                : { label: t('employeeDirectory.taskOpen', 'In progress'), tone: ind.inkGhost };

                          return (
                            <div
                              key={task.id}
                              style={{
                                display: 'flex', alignItems: 'center', gap: 11,
                                padding: '11px 0', borderTop: `1px solid ${ind.rule}`,
                                marginTop: i === 0 ? 10 : 0, opacity: done ? 0.55 : 1,
                              }}
                            >
                              <span
                                aria-hidden="true"
                                style={{
                                  width: 15, height: 15, flex: 'none', display: 'grid', placeItems: 'center',
                                  border: `1px solid ${done ? ind.accent : ind.inkFaint}`,
                                  background: done ? ind.accent : 'transparent',
                                  color: ind.accentInk, fontSize: 9, lineHeight: 1,
                                }}
                              >
                                {done ? '✓' : ''}
                              </span>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div
                                  style={{
                                    fontFamily: BODY, fontSize: 13, color: ind.ink,
                                    textDecoration: done ? 'line-through' : 'none',
                                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                  }}
                                >
                                  {task.title}
                                </div>
                                <div style={meta}>
                                  {[
                                    due ? `${t('employeeDirectory.due', 'Due')} ${formatDate(due, currentLanguage, { day: '2-digit', month: '2-digit' })}` : null,
                                    task.priority
                                      ? t(`employeeDirectory.priority.${String(task.priority).toLowerCase()}`, task.priority)
                                      : null,
                                  ].filter(Boolean).join(' · ')}
                                </div>
                              </div>
                              <StateWord ind={ind} state={stateWord} />
                            </div>
                          );
                        })}

                        <div style={{ flex: 1 }} />
                        <p style={{ ...meta, marginTop: 12, paddingTop: 12, borderTop: `1px solid ${ind.hairline}` }}>
                          {t('employeeDirectory.openWorkNote', '{n} open — every one of them belongs to a record, so nothing here is free-floating.')
                            .replace('{n}', String(open.length))}
                        </p>
                      </>
                    );
                  })()}
                </Panel>
              </div>
            </div>
          </>
        ) : (
          <>
            {/* ── CONTENT — ledger or plates ──────────────────────────── */}
            <div
              className="flex-1 min-w-0 flex flex-col"
              style={{ padding: '22px 24px 20px', gap: 14, borderRight: `1px solid ${ind.hairline}` }}
            >
              {fetchError && (
                <div style={{ border: `1px solid ${ind.ink}`, padding: '12px 14px', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                  <AlertCircle size={16} strokeWidth={1.5} style={{ flex: 'none', marginTop: 2, color: ind.ink }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <Kicker ind={ind} color={ind.ink}>{t('common.error', 'Error')}</Kicker>
                    <p style={{ fontFamily: BODY, fontSize: 13, color: ind.inkMuted, marginTop: 4 }}>{fetchError}</p>
                    <TrailLink ind={ind} arrow={false} onClick={fetchAll}>{t('common.retry', 'Try Again')}</TrailLink>
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
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: ind.inkMuted, padding: 0, display: 'flex' }}
                  >
                    <X size={14} strokeWidth={1.5} />
                  </button>
                </div>
              )}

              {/* Title row — one primary button on the board */}
              <div className="flex flex-wrap items-end justify-between" style={{ gap: 14 }}>
                <div style={{ minWidth: 0 }}>
                  <h1 style={{ fontFamily: BODY, fontSize: 32, fontWeight: 400, margin: 0, color: ind.ink, lineHeight: 1.1 }}>
                    {t('employeeDirectory.title', 'Employee directory')}
                  </h1>
                  <p style={{ ...caption, marginTop: 6 }}>
                    {view === 'plates'
                      ? t('employeeDirectory.platesSubtitle', 'Card mode · for recognising people, not for comparing them')
                      : [
                        t('employeeDirectory.peopleInUnits', '{n} people in {u} units')
                          .replace('{n}', String(counts.all)).replace('{u}', String(units.length)),
                        t('employeeDirectory.joinedThisMonthLong', '{n} joined this month').replace('{n}', String(counts.joinedThisMonth)),
                        t('employeeDirectory.missingRecordsLong', '{n} records missing documents').replace('{n}', String(counts.missingDocuments)),
                      ].join(' · ')}
                  </p>
                </div>

                <div style={{ display: 'flex', gap: 8, flex: 'none', flexWrap: 'wrap' }}>
                  <Btn ind={ind} onClick={exportList} style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
                    <Download size={14} strokeWidth={1.5} />
                    {t('employeeDirectory.exportList', 'Export list')}
                  </Btn>
                  {user?.role !== 'employee' && (
                    <Btn
                      ind={ind}
                      variant="primary"
                      onClick={() => navigate('/employees/add')}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}
                    >
                      <Plus size={14} strokeWidth={1.5} />
                      {t('employees.addEmployee', 'Add Employee')}
                    </Btn>
                  )}
                </div>
              </div>

              {/* Filter strip — scope, search, grouping readout, view toggle */}
              <div
                className="flex flex-wrap items-center"
                style={{
                  gap: 10, padding: '9px 0',
                  borderTop: `1px solid ${ind.hairline}`,
                  borderBottom: `1px solid ${ind.hairline}`,
                }}
              >
                {view === 'plates' ? (
                  <TabRow
                    ind={ind}
                    ariaLabel={t('employees.department', 'Department')}
                    value={plateUnit?.key}
                    onChange={(key) => { setUnitTab(key); setPlatePage(0); }}
                    // Every unit gets a tab and the strip scrolls. Capping it at
                    // the largest few hid whole departments — Human Resources,
                    // Finance, the Experts Group — behind a control that gave no
                    // sign they were there.
                    options={units.map((unit) => ({
                      value: unit.key,
                      label: `${unit.label} · ${unit.count}`,
                    }))}
                  />
                ) : (
                  <TabRow
                    ind={ind}
                    ariaLabel={t('employeeDirectory.scope', 'Scope')}
                    value={scope}
                    onChange={setScope}
                    options={[
                      { value: 'all', label: `${t('employeeDirectory.scopeAll', 'All')} · ${counts.all}` },
                      { value: 'leave', label: `${t('employeeDirectory.onLeaveToday', 'On leave today')} · ${counts.leave}` },
                      { value: 'starting', label: `${t('employeeDirectory.scopeStarting', 'Starting')} · ${counts.starting}` },
                      { value: 'left', label: `${t('employeeDirectory.scopeLeft', 'Left')} · ${counts.left}` },
                    ]}
                  />
                )}

                <SearchBox
                  ind={ind}
                  value={query}
                  onChange={(value) => { setQuery(value); setPlatePage(0); }}
                  placeholder={t('employeeDirectory.searchPlaceholder', 'Search by name, ID or unit')}
                  style={{ flex: 1, minWidth: 180 }}
                />

                <span style={readout}>
                  {view === 'plates'
                    ? t('employeeDirectory.sortedByRating', 'Sorted by rating')
                    : t('employeeDirectory.groupedByUnit', 'Grouped by unit')}
                </span>

                <TabRow
                  ind={ind}
                  ariaLabel={t('employeeDirectory.viewMode', 'View')}
                  value={view}
                  // The card view has no scope control, so a scope carried into
                  // it would filter the plates from somewhere the eye cannot see.
                  onChange={(next) => { if (next === 'plates') setScope('all'); setView(next); }}
                  options={[
                    { value: 'ledger', label: t('employees.directory', 'Directory') },
                    { value: 'plates', label: t('employees.cards', 'Cards') },
                  ]}
                />
              </div>

              {/* ── LEDGER ─────────────────────────────────────────────── */}
              {view === 'ledger' && (
                <Blueprint ind={ind} style={{ padding: 0, display: 'flex', flexDirection: 'column' }}>
                  {wide && (
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: LEDGER_COLUMNS,
                        gap: 12,
                        alignItems: 'center',
                        padding: '9px 16px',
                        borderBottom: `1px solid ${ind.hairline}`,
                        fontFamily: DISPLAY,
                        fontWeight: 600,
                        fontSize: 10,
                        letterSpacing: '.16em',
                        textTransform: 'uppercase',
                        color: ind.inkFaint,
                      }}
                    >
                      <span>{t('employees.employee', 'Employee')}</span>
                      <span>{t('employeeDirectory.contact', 'Contact')}</span>
                      <span>{t('employeeDirectory.tenure', 'Tenure')}</span>
                      <span>{t('employeeDirectory.thisWeek', 'This week')}</span>
                      <span>{t('employees.performance', 'Performance')}</span>
                      <span style={{ justifySelf: 'end' }}>{t('employees.statusLabel', 'Status')}</span>
                    </div>
                  )}

                  {units.length === 0 && (
                    <div style={{ padding: '28px 16px', textAlign: 'center', ...caption }}>
                      {t('employeeDirectory.nothingMatches', 'No one matches this filter.')}
                    </div>
                  )}

                  {units.map((unit, unitIndex) => {
                    const open = effectiveOpen.has(unit.key);
                    return (
                      <React.Fragment key={unit.key}>
                        <button
                          type="button"
                          onClick={() => toggleUnit(unit.key)}
                          style={{
                            width: '100%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: 16,
                            padding: '9px 16px',
                            background: ind.accentWash,
                            border: 'none',
                            borderTop: unitIndex === 0 ? 'none' : `1px solid ${ind.rule}`,
                            borderBottom: `1px solid ${ind.rule}`,
                            cursor: 'pointer',
                            textAlign: 'left',
                          }}
                        >
                          <span style={{ display: 'flex', alignItems: 'baseline', gap: 11, minWidth: 0, flexWrap: 'wrap' }}>
                            <ChevronDown
                              size={13}
                              strokeWidth={1.5}
                              style={{
                                color: ind.inkMuted,
                                alignSelf: 'center',
                                flex: 'none',
                                transform: open ? 'none' : 'rotate(-90deg)',
                                transition: 'transform .15s ease',
                              }}
                            />
                            <span style={{ fontFamily: DISPLAY, fontWeight: 600, fontSize: 14, letterSpacing: '.07em', textTransform: 'uppercase', color: ind.ink }}>
                              {unit.label}
                            </span>
                            <span style={{ fontFamily: BODY, fontSize: 11.5, color: ind.inkMuted }}>
                              {[
                                t('employeeDirectory.nPeople', '{n} people').replace('{n}', String(unit.count)),
                                unit.starting
                                  ? t('employeeDirectory.nStarting', '{n} starting').replace('{n}', String(unit.starting))
                                  : null,
                                unit.pending
                                  ? t('employeeDirectory.nAwaiting', '{n} awaiting approval').replace('{n}', String(unit.pending))
                                  : unit.missingDocuments
                                    ? t('employeeDirectory.nMissingDocs', '{n} missing documents').replace('{n}', String(unit.missingDocuments))
                                    : null,
                              ].filter(Boolean).join(' · ')}
                            </span>
                          </span>

                          <span style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 'none' }}>
                            <span style={{ fontFamily: DISPLAY, fontWeight: 600, fontSize: 12, letterSpacing: '.06em', color: ind.inkGhost }}>
                              {t('employeeDirectory.mean', 'Mean')} {unit.mean == null ? '—' : fmt1(unit.mean)}
                            </span>
                            <span style={{ width: 76, flex: 'none' }}>
                              <Bar ind={ind} value={unit.mean == null ? 0 : unit.mean / 5} fill={ind.accent} height={6} />
                            </span>
                          </span>
                        </button>

                        {open && unit.list.map((person, i) => (
                          <LedgerRow
                            key={person.id}
                            ind={ind}
                            wide={wide}
                            t={t}
                            person={person}
                            selected={person.id === recordId}
                            last={i === unit.list.length - 1 && unitIndex === units.length - 1}
                            onOpen={openRecord}
                          />
                        ))}
                      </React.Fragment>
                    );
                  })}

                  <div
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      gap: 12, flexWrap: 'wrap', padding: '9px 16px',
                      borderTop: `1px solid ${ind.hairline}`,
                      fontFamily: BODY, fontSize: 12, color: ind.inkMuted,
                    }}
                  >
                    <span>
                      {t('employeeDirectory.ledgerFooter', 'Showing {rows} / {total} people · {open} / {units} units')
                        .replace('{rows}', String(rowsRendered))
                        .replace('{total}', String(searched.length))
                        .replace('{open}', String(units.filter((u) => effectiveOpen.has(u.key)).length))
                        .replace('{units}', String(units.length))}
                    </span>
                    <TrailLink
                      ind={ind}
                      onClick={() => setOpenUnits(
                        units.every((u) => effectiveOpen.has(u.key))
                          ? new Set()
                          : new Set(units.map((u) => u.key))
                      )}
                    >
                      {units.every((u) => effectiveOpen.has(u.key))
                        ? t('employeeDirectory.collapseUnits', 'Collapse all units')
                        : t('employeeDirectory.expandUnits', 'Show all units')}
                    </TrailLink>
                  </div>
                </Blueprint>
              )}

              {/* ── PLATES ─────────────────────────────────────────────── */}
              {view === 'plates' && (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3" style={{ gap: 16 }}>
                    {plates.map((person, i) => (
                      <Plate
                        key={person.id}
                        ind={ind}
                        t={t}
                        navigate={navigate}
                        person={person}
                        focused={pageIndex === 0 && i === 0}
                        onOpen={openRecord}
                        onPickPhoto={canManage && onPhotoUpdate ? handlePhoto(person) : undefined}
                        uploadLabel={t('employees.uploadPhoto', 'Upload photo')}
                      />
                    ))}
                  </div>

                  {plates.length === 0 && (
                    <div style={{ padding: '28px 16px', textAlign: 'center', ...caption }}>
                      {t('employeeDirectory.nothingMatches', 'No one matches this filter.')}
                    </div>
                  )}

                  <div
                    className="flex flex-wrap items-center justify-between"
                    style={{ gap: 12, fontFamily: BODY, fontSize: 12, color: ind.inkMuted }}
                  >
                    <span>
                      {t('employeeDirectory.plateFooter', 'Showing {shown} / {total} of {unit} · sorted by rating')
                        .replace('{shown}', String(plates.length))
                        .replace('{total}', String(plateUnit?.count || 0))
                        .replace('{unit}', plateUnit?.label || '—')}
                    </span>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                      {platePages > 1 && (
                        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <button
                            type="button"
                            onClick={() => setPlatePage((p) => Math.max(0, p - 1))}
                            disabled={pageIndex === 0}
                            aria-label={t('common.back', 'Back')}
                            style={{
                              display: 'flex', border: `1px solid ${ind.hairline}`, background: 'transparent',
                              padding: 3, cursor: pageIndex === 0 ? 'not-allowed' : 'pointer',
                              opacity: pageIndex === 0 ? 0.4 : 1, color: ind.ink,
                            }}
                          >
                            <ChevronLeft size={13} strokeWidth={1.5} />
                          </button>
                          <span style={{ fontFamily: DISPLAY, fontWeight: 600, fontSize: 11.5, letterSpacing: '.1em' }}>
                            {pageIndex + 1} / {platePages}
                          </span>
                          <button
                            type="button"
                            onClick={() => setPlatePage((p) => Math.min(platePages - 1, p + 1))}
                            disabled={pageIndex === platePages - 1}
                            aria-label={t('common.next', 'Next')}
                            style={{
                              display: 'flex', border: `1px solid ${ind.hairline}`, background: 'transparent',
                              padding: 3, cursor: pageIndex === platePages - 1 ? 'not-allowed' : 'pointer',
                              opacity: pageIndex === platePages - 1 ? 0.4 : 1, color: ind.ink,
                            }}
                          >
                            <ChevronRight size={13} strokeWidth={1.5} />
                          </button>
                        </span>
                      )}
                      <TrailLink ind={ind} onClick={() => setView('ledger')}>
                        {t('employeeDirectory.compareInLedger', 'Compare in the ledger')}
                      </TrailLink>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* ── DECISION COLUMN — 340px ─────────────────────────────── */}
            <div className="w-full lg:w-[340px] lg:shrink-0" style={chromeColumn}>

              {/* Plates lead with the people you would not recognise yet. */}
              {view === 'plates' && (
                <>
                  <div style={{ padding: '20px 20px 12px', borderBottom: `1px solid ${ind.hairline}` }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 }}>
                      <span style={columnHeading}>{t('employeeDirectory.justJoined', 'Just joined')}</span>
                      <span style={{ fontFamily: DISPLAY, fontWeight: 600, fontSize: 12, color: ind.accent }}>
                        {t('employeeDirectory.nPeople', '{n} people').replace('{n}', String(counts.joinedThisMonth))}
                      </span>
                    </div>
                    <p style={{ ...meta, marginTop: 5 }}>
                      {t('employeeDirectory.justJoinedNote', 'This month · {n} records still missing documents')
                        .replace('{n}', String(counts.missingDocuments))}
                    </p>
                  </div>

                  {recentJoiners.length === 0 ? (
                    <div style={{ padding: '14px 20px', ...meta, borderBottom: `1px solid ${ind.rule}` }}>
                      {t('employeeDirectory.noRecentJoiners', 'No one has joined in the last two months.')}
                    </div>
                  ) : (
                    <AnimatedList delay={200} reverse={false} className="gap-0">
                      {recentJoiners.map((person) => (
                        <button
                          key={`joiner-${person.id}`}
                          type="button"
                          onClick={() => openRecord(person)}
                          style={{
                            width: '100%', display: 'flex', alignItems: 'center', gap: 11,
                            padding: '12px 20px', border: 'none', borderBottom: `1px solid ${ind.rule}`,
                            background: 'transparent', cursor: 'pointer', textAlign: 'left',
                          }}
                          onMouseEnter={(e) => { e.currentTarget.style.background = ind.accentWash; }}
                          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                        >
                          <Portrait ind={ind} employee={person.employee} name={person.name} size={28} dashed={person.notStarted} />
                          <span style={{ flex: 1, minWidth: 0 }}>
                            <span style={{ display: 'block', fontFamily: BODY, fontSize: 12.5, color: ind.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {person.name}
                            </span>
                            <span style={{ display: 'block', ...meta, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {[person.unitLabel, person.startLabel, person.documentsLabel].filter(Boolean).join(' · ')}
                            </span>
                          </span>
                          <ArrowRight size={15} strokeWidth={1.5} style={{ flex: 'none', color: ind.inkFaint }} />
                        </button>
                      ))}
                    </AnimatedList>
                  )}
                </>
              )}

              <div
                style={{
                  padding: view === 'plates' ? '18px 20px 10px' : '20px 20px 12px',
                  marginTop: view === 'plates' ? 6 : 0,
                  borderBottom: `1px solid ${ind.hairline}`,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 }}>
                  <span style={columnHeading}>{t('employeeDirectory.needsAction', 'Needs action')}</span>
                  <span style={{ fontFamily: DISPLAY, fontWeight: 600, fontSize: 12, color: ind.accent }}>
                    {t('employeeDirectory.nItems', '{n} items').replace('{n}', String(queue.length))}
                  </span>
                </div>
                <p style={{ ...meta, marginTop: 5 }}>
                  {view === 'plates'
                    ? t('employeeDirectory.pointersOnly', 'Pointers only · the decisions live in the ledger')
                    : t('employeeDirectory.attachedToPeople', 'Attached to people, not to cards')}
                </p>
              </div>

              {queue.length === 0 && (
                <div style={{ padding: '14px 20px', ...meta, borderBottom: `1px solid ${ind.rule}` }}>
                  {t('employeeDirectory.queueEmpty', 'Nothing is waiting on this roster.')}
                </div>
              )}

              <AnimatedList delay={220} reverse={false} className="gap-0">
                {queue.map((item, index) => {
                  /* The ledger carries two cards with buttons; the card view is pointers only. */
                  const expanded = view === 'ledger' && index < 2 && item.person;

                  if (expanded) {
                    const tinted = index === 0;
                    const isStarter = item.kind === 'starter';
                    return (
                      <div
                        key={`${item.kind}-${item.person.id}`}
                        style={{
                          position: 'relative',
                          padding: '14px 20px',
                          borderBottom: `1px solid ${ind.rule}`,
                          background: tinted ? ind.accentWash : 'transparent',
                          overflow: 'hidden',
                        }}
                      >
                        {tinted && (
                          <BorderBeam size={80} duration={8} borderWidth={1.5} colorFrom={ind.accent} colorTo={ind.accentDeep} />
                        )}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10 }}>
                          <span style={{ fontFamily: DISPLAY, fontWeight: 600, fontSize: 14, letterSpacing: '.04em', textTransform: 'uppercase', color: ind.ink, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {item.person.name}
                          </span>
                          <Tag ind={ind} variant={isStarter ? 'outline' : 'accent'}>
                            {isStarter
                              ? `${t('employeeDirectory.stateStarting', 'Starts')} ${formatDate(item.person.start, currentLanguage, { day: '2-digit', month: '2-digit' })}`
                              : `${fmtHours(item.person.pendingHours)} ${t('employeeDirectory.pendingTag', 'pending')}`}
                          </Tag>
                        </div>

                        <p style={{ fontFamily: BODY, fontSize: 12.5, color: ind.inkGhost, margin: '5px 0 9px', lineHeight: 1.45 }}>
                          {isStarter
                            ? t(
                              'employeeDirectory.starterBody',
                              'Starts in {n} days in {unit}. Records are {docs} — a missing document blocks the first-week onboarding.'
                            )
                              .replace('{n}', String(Math.abs(item.person.daysSinceStart)))
                              .replace('{unit}', item.person.unitLabel)
                              .replace('{docs}', item.person.documentsLabel.toLowerCase())
                            : t(
                              'employeeDirectory.pendingBody',
                              '{h} filed this week are still unapproved, {ot} of it overtime against a {cap}h monthly cap. Approving writes it into the open payroll month.'
                            )
                              .replace('{h}', fmtHours(item.person.pendingHours))
                              .replace('{ot}', fmtHours(item.person.overtime))
                              .replace('{cap}', String(OVERTIME_CAP_HOURS))}
                        </p>

                        <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
                          <Btn
                            ind={ind}
                            variant="primary"
                            onClick={() => (isStarter ? openRecord(item.person) : navigate('/time-tracking'))}
                            style={{ padding: '4px 12px', fontSize: 12.5 }}
                          >
                            {isStarter
                              ? t('employeeDirectory.openRecord', 'Open record')
                              : t('employeeDirectory.openTimesheet', 'Open timesheet')}
                          </Btn>
                          <Btn
                            ind={ind}
                            onClick={() => (isStarter && canManage && onEdit
                              ? onEdit(item.person.employee)
                              : openRecord(item.person))}
                            style={{ padding: '4px 12px', fontSize: 12.5 }}
                          >
                            {isStarter && canManage && onEdit
                              ? t('employeeDirectory.editRecord', 'Edit record')
                              : t('employeeDirectory.openRecord', 'Open record')}
                          </Btn>
                        </div>
                      </div>
                    );
                  }

                  const compact = {
                    starter: {
                      label: item.person?.name,
                      detail: t('employeeDirectory.startsInDays', 'Starts in {n} days · {unit}')
                        .replace('{n}', String(Math.abs(item.person?.daysSinceStart || 0)))
                        .replace('{unit}', item.person?.unitLabel || ''),
                      go: () => item.person && openRecord(item.person),
                    },
                    overtime: {
                      label: t('employeeDirectory.overtimeOf', 'Overtime · {name}').replace('{name}', item.person?.name || ''),
                      detail: t('employeeDirectory.pendingAgainstCap', '{h} pending · {cap}h monthly cap')
                        .replace('{h}', fmtHours(item.person?.pendingHours || 0))
                        .replace('{cap}', String(OVERTIME_CAP_HOURS)),
                      go: () => navigate('/time-tracking'),
                    },
                    timesheets: {
                      label: t('employeeDirectory.timesheetExceptions', '{n} timesheets awaiting approval').replace('{n}', String(item.count)),
                      detail: t('employeeDirectory.acrossUnits', 'Across {n} units').replace('{n}', String(units.length)),
                      go: () => navigate('/time-tracking'),
                    },
                    reviews: {
                      label: t('employeeDirectory.reviewsUnsigned', '{n} reviews not signed off').replace('{n}', String(item.count)),
                      detail: t('employeeDirectory.reviewCycleNote', 'Current cycle'),
                      go: () => navigate('/task-review'),
                    },
                    leave: {
                      label: t('employeeDirectory.leavePending', '{n} leave requests pending').replace('{n}', String(item.count)),
                      detail: t('employeeDirectory.leavePendingNote', 'Waiting on an approver'),
                      go: () => navigate('/leave-management'),
                    },
                    documents: {
                      label: t('employeeDirectory.docsMissing', '{n} records missing documents').replace('{n}', String(item.count)),
                      detail: missingDocumentPeople.slice(0, 2).map((p) => p.name).join(' · '),
                      go: () => { setScope('all'); setQuery(''); setView('ledger'); },
                    },
                  }[item.kind];

                  return (
                    <button
                      key={`${item.kind}-${index}`}
                      type="button"
                      onClick={compact.go}
                      style={{
                        width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        gap: 12, padding: '12px 20px', border: 'none', borderBottom: `1px solid ${ind.rule}`,
                        background: 'transparent', cursor: 'pointer', textAlign: 'left',
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = ind.accentWash; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                    >
                      <span style={{ minWidth: 0 }}>
                        <span style={{ display: 'block', fontFamily: BODY, fontSize: 13, color: ind.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {compact.label}
                        </span>
                        <span style={{ display: 'block', ...meta, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {compact.detail}
                        </span>
                      </span>
                      <ArrowRight size={15} strokeWidth={1.5} style={{ flex: 'none', color: ind.inkFaint }} />
                    </button>
                  );
                })}
              </AnimatedList>

              {/* Top rated — the podium, in the ledger only. The card view is
                  for recognising faces; ranking belongs with the comparison. */}
              {view === 'ledger' && ranked.length > 0 && (
                <>
                  <div style={{ padding: '18px 20px 10px', marginTop: 6, borderBottom: `1px solid ${ind.hairline}` }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 }}>
                      <span style={columnHeading}>{t('employeeDirectory.topRated', 'Top rated')}</span>
                      <span style={{ fontFamily: DISPLAY, fontWeight: 600, fontSize: 12, color: ind.inkFaint }}>
                        {t('employeeDirectory.ofNRated', '{n} rated').replace('{n}', String(ranked.length))}
                      </span>
                    </div>
                    <p style={{ ...meta, marginTop: 5 }}>
                      {orgMean == null
                        ? t('employeeDirectory.noRatings', 'Nobody on this roster has been rated yet.')
                        : t('employeeDirectory.podiumNote', 'Against a company mean of {m}')
                          .replace('{m}', fmt1(orgMean))}
                    </p>
                  </div>
                  <Podium
                    ind={ind}
                    places={ranked.slice(0, PODIUM_PLACES)}
                    runnersUp={ranked.slice(PODIUM_PLACES, PODIUM_PLACES + RUNNER_UP_ROWS)}
                    onOpen={openRecord}
                  />
                </>
              )}

              {/* Unit distribution — the second arithmetic rule, drawn */}
              <div style={{ padding: '18px 20px 10px', marginTop: 6, borderBottom: `1px solid ${ind.hairline}` }}>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 }}>
                  <span style={columnHeading}>{t('employeeDirectory.unitSpread', 'Unit spread')}</span>
                  <span style={{ fontFamily: DISPLAY, fontWeight: 600, fontSize: 12, color: ind.inkFaint }}>
                    {t('employeeDirectory.unitsAndPeople', '{u} units · {n} people')
                      .replace('{u}', String(units.length))
                      .replace('{n}', String(searched.length))}
                  </span>
                </div>
              </div>

              {units.map((unit) => (
                <button
                  key={`spread-${unit.key}`}
                  type="button"
                  onClick={() => { setUnitTab(unit.key); setPlatePage(0); setView('plates'); }}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: 12,
                    padding: '11px 20px', border: 'none', borderBottom: `1px solid ${ind.rule}`,
                    background: 'transparent', cursor: 'pointer', textAlign: 'left',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = ind.accentWash; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                >
                  <span style={{ flex: 1, minWidth: 0, fontFamily: BODY, fontSize: 12.5, color: ind.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {unit.label}
                  </span>
                  <span style={{ width: 96, flex: 'none' }}>
                    <Bar ind={ind} value={unit.count / largestUnit} fill={ind.accent} height={6} />
                  </span>
                  <span style={{ ...figure(13, ind.ink), width: 26, textAlign: 'right', flex: 'none' }}>{unit.count}</span>
                </button>
              ))}

              {/* An empty department is a fact about the org, not an absence
                  from the screen, so it is named rather than left out. */}
              <div
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  gap: 10, padding: '11px 20px', fontFamily: BODY, fontSize: 12, color: ind.inkMuted,
                }}
              >
                <span style={{ minWidth: 0 }}>
                  {emptyUnits.length === 0
                    ? t('employeeDirectory.everyUnitStaffed', 'Every department has someone in it')
                    : t('employeeDirectory.emptyUnits', 'Nobody in {list}')
                      .replace('{list}', emptyUnits.map((u) => u.label).join(' · '))}
                </span>
                <TrailLink ind={ind} arrow={false} onClick={() => navigate('/reports')}>
                  {t('employeeDirectory.report', 'Report')}
                </TrailLink>
              </div>

              {/* The unit network, kept from the old directory and re-skinned. */}
              {view === 'plates' && units.length > 1 && (
                <>
                  <div style={{ padding: '18px 20px 4px', marginTop: 6, borderTop: `1px solid ${ind.hairline}` }}>
                    <span style={columnHeading}>{t('employeeDirectory.unitNetwork', 'Unit network')}</span>
                    <p style={{ ...meta, marginTop: 5 }}>
                      {t('employeeDirectory.unitNetworkNote', 'The {n} largest units and their headcount.')
                        .replace('{n}', String(Math.min(NETWORK_NODES, units.length)))}
                    </p>
                  </div>
                  <div style={{ padding: '0 12px 16px' }}>
                    <UnitNetwork ind={ind} units={units} />
                  </div>
                </>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default EmployeeDirectory;
