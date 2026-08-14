/**
 * Policy Controls — settings rendered as an engineering spec sheet.
 *
 * The rule the whole screen is built on: every setting shows its value, its
 * scope and its consequence, and nothing commits until you publish. There are
 * no per-row save buttons; the single primary button in the title row is the
 * only commit on the board.
 *
 * Two-level navigation is what makes this screen different from the others: a
 * 184px section index sits beside the panel stack, so a new policy area arrives
 * as another numbered panel plus an index row — never a tab bar, never a
 * collapsible accordion.
 *
 * Counts are derived, never typed twice. The ticker's PENDING CHANGES figure,
 * the label on the publish button and the number of items in the decision
 * column all read the same `queue` array, so they cannot drift apart. The
 * provenance line under the <h1> and the ticker's LAST EDIT both read the newest
 * audit entry for the same reason.
 */
import _React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, FileClock } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext.jsx';
import { useLanguage } from '../contexts/LanguageContext.jsx';
import { useAuth } from '../contexts/AuthContext.jsx';
import { getIndustry, DISPLAY, BODY } from '../theme/industry.js';
import { formatDate, localeTag } from '../utils/localeFormat.js';
import { Blueprint, Tag, Btn, TickerCell, LiveClock, ColumnHeading, FlatSelect } from './ui/industry.jsx';

/* ------------------------------------------------------------------ *
 * Constants — these agree with the Organization Overview figures.
 * ------------------------------------------------------------------ */

const ORG_ID = 'company-group';
const EMPLOYEE_COUNT = 248;
const ROLE_COUNT = 6;
const INITIAL_VERSION = '4.2';

/** Published policy at load. The draft starts as a copy of it. */
const PUBLISHED = {
  workingDayMinutes: 480,   // 8h 00m
  workingDaysMonth: 26,
  coreStart: '09:30',
  coreEnd: '16:00',
  lateGrace: 7,             // minutes
  autoClosePunches: true,
  weekendCountsAsWork: false,

  otCap: 20,                // hours per month
  otNeedsApproval: true,

  annualLeaveDays: 14,
  carryOverCap: 5,
  leaveNoticeDays: 3,
  sickNoteAfterDays: 2,

  sessionHours: 12,
  managersApproveLeave: true,
  teamLeadsApproveOvertime: false,
  adminTwoFactor: true,

  punchReminderMinutes: 15,
  escalateAfterDays: 2,
  weekendNotifications: false,

  timeEntryMonths: 36,
  leaveRecordMonths: 60,
  auditLogMonths: 24,
  anonymiseLeavers: true,
};

const message = (key, fallback, params) => ({ key, fallback, params });

const fmtUnit = (value, unit, language, minimumIntegerDigits = 1) => new Intl.NumberFormat(
  localeTag(language),
  { style: 'unit', unit, unitDisplay: 'narrow', maximumFractionDigits: 0, minimumIntegerDigits }
).format(value);
const fmtHm = (minutes, language) => (
  `${fmtUnit(Math.floor(minutes / 60), 'hour', language)} ${fmtUnit(minutes % 60, 'minute', language, 2)}`
);
const fmtHours = (h, language) => fmtUnit(h, 'hour', language);
const fmtMinutes = (m, language) => fmtUnit(m, 'minute', language);
const fmtDays = (d, language) => fmtUnit(d, 'day', language);
const fmtMonths = (m, language) => fmtUnit(m, 'month', language);
const fmtPlain = (v, language) => new Intl.NumberFormat(localeTag(language)).format(v);
const fmtOnOff = (on, _language, t) => (on ? t('policyControls.on', 'On') : t('policyControls.off', 'Off'));

/** Seeded audit trail, newest first. Text and dates are resolved at render time. */
const SEED_AUDIT = [
  {
    id: 'a1',
    occurredAt: '2026-07-28T14:02:00',
    change: message('policyControls.audit.overtimeCapChanged', 'Overtime cap {from} → {to}'),
    from: 16,
    to: 20,
    format: fmtHours,
    actor: 'Đặng Lê Minh',
  },
  {
    id: 'a2',
    occurredAt: '2026-07-21T09:41:00',
    change: message('policyControls.audit.lateGraceChanged', 'Late grace {from} → {to}'),
    from: 5,
    to: 7,
    format: fmtMinutes,
    actor: 'Đỗ Bảo Long',
  },
  {
    id: 'a3',
    occurredAt: '2026-07-14T16:20:00',
    change: message('policyControls.audit.teamLeadLeaveGranted', 'Role "Team lead" gained Approve leave'),
    actor: 'Đặng Lê Minh',
  },
  {
    id: 'a4',
    occurredAt: '2026-07-01T00:00:00',
    change: message('policyControls.audit.reviewCycleOpened', 'Review cycle {cycle} opened', { cycle: 'H1 2026' }),
    actorMessage: message('notifications.system', 'System'),
  },
];

const INITIAL_QUEUE = [
  {
    id: 'q-ot-cap',
    key: 'otCap',
    name: message('policyControls.item.otCap', 'Overtime cap'),
    from: 20,
    to: 24,
    format: fmtHours,
    value: 24,
    tag: { ...message('policyControls.affects', 'Affects {n}', { n: EMPLOYEE_COUNT }), variant: 'outline' },
    reason: message('policyControls.item.otCapReason', 'Requested by Trần Thị Lan Anh — the Sơn Trà line is running six-day weeks until the September order ships.'),
    tinted: true,
    state: 'open',
  },
  {
    id: 'q-late-grace',
    key: 'lateGrace',
    name: message('policyControls.item.lateGrace', 'Late grace period'),
    from: 7,
    to: 10,
    format: fmtMinutes,
    value: 10,
    tag: { ...message('policyControls.lowRisk', 'Low risk'), variant: 'accent' },
    reason: message('policyControls.item.lateGraceReason', 'Requested by Đỗ Bảo Long — the 07:30 shuttle arrives late on rainy mornings.'),
    tinted: false,
    state: 'open',
  },
  {
    id: 'q-team-lead',
    key: 'teamLeadsApproveOvertime',
    name: message('policyControls.item.teamLead', 'Role · Team lead'),
    queuedText: message('policyControls.item.teamLeadGain', 'Gains "Approve overtime" · 9 people'),
    value: true,
    reason: null,
    tinted: false,
    state: 'queued',
  },
];

/* ------------------------------------------------------------------ *
 * Controls — four forms, and only four.
 * ------------------------------------------------------------------ */

/** −  value  +  · three cells in one hairline box. Square, never a pill. */
function Stepper({ ind, value, onChange, step = 1, min, max, disabled }) {
  const sign = {
    width: 24, display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: 'transparent', border: 'none', borderRadius: 0, padding: 0,
    fontFamily: DISPLAY, fontWeight: 600, fontSize: 14, color: ind.inkMuted,
    cursor: disabled ? 'not-allowed' : 'pointer', lineHeight: 1,
  };
  const bump = (delta) => {
    if (disabled) return;
    const next = value.raw + delta * step;
    if (min != null && next < min) return;
    if (max != null && next > max) return;
    onChange(next);
  };
  return (
    <div style={{ display: 'flex', alignItems: 'stretch', border: `1px solid ${ind.hairline}`, flex: 'none', opacity: disabled ? 0.5 : 1 }}>
      <button type="button" style={sign} onClick={() => bump(-1)} aria-label="−">−</button>
      <div
        style={{
          padding: '4px 14px',
          borderLeft: `1px solid ${ind.hairline}`,
          borderRight: `1px solid ${ind.hairline}`,
          fontFamily: DISPLAY, fontWeight: 600, fontSize: 14, color: ind.ink,
          minWidth: 56, textAlign: 'center', fontVariantNumeric: 'tabular-nums',
        }}
      >
        {value.label}
      </div>
      <button type="button" style={sign} onClick={() => bump(1)} aria-label="+">+</button>
    </div>
  );
}

/** Two value boxes split by an en dash. */
function RangePair({ ind, from, to }) {
  const box = {
    border: `1px solid ${ind.hairline}`, padding: '4px 12px',
    fontFamily: DISPLAY, fontWeight: 600, fontSize: 14, color: ind.ink,
    fontVariantNumeric: 'tabular-nums',
  };
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 'none' }}>
      <span style={box}>{from}</span>
      <span style={{ fontFamily: DISPLAY, fontWeight: 600, fontSize: 14, color: ind.ink, opacity: 0.4 }}>–</span>
      <span style={box}>{to}</span>
    </div>
  );
}

/** State word + a square box holding a square knob. Never a pill, never a circle. */
function Toggle({ ind, on, onChange, t, language }) {
  return (
    <button
      type="button"
      onClick={onChange}
      aria-pressed={on}
      style={{
        display: 'flex', alignItems: 'center', gap: 9, flex: 'none',
        background: 'none', border: 'none', borderRadius: 0, padding: 0, cursor: 'pointer',
      }}
    >
      <span
        style={{
          fontFamily: DISPLAY, fontWeight: 600, fontSize: 11, letterSpacing: '.12em',
          textTransform: 'uppercase', color: on ? ind.accent : ind.ink, opacity: on ? 1 : 0.45,
        }}
      >
        {fmtOnOff(on, language, t)}
      </span>
      <span
        style={{
          width: 34, height: 18, padding: 1, borderRadius: 0,
          border: `1px solid ${on ? ind.accent : ind.inkFaint}`,
          display: 'flex', alignItems: 'center',
          justifyContent: on ? 'flex-end' : 'flex-start',
        }}
      >
        <span style={{ width: 14, height: 14, background: on ? ind.accent : 'rgba(29,31,32,.25)' }} />
      </span>
    </button>
  );
}

/** One hairline box for a value this screen does not edit. */
function ReadOnly({ ind, value }) {
  return (
    <span
      style={{
        border: `1px solid ${ind.hairline}`, padding: '4px 12px', flex: 'none',
        fontFamily: DISPLAY, fontWeight: 600, fontSize: 14, color: ind.ink,
        fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap',
      }}
    >
      {value}
    </span>
  );
}

/** Labelled plates — the read-only form for a setting carrying several values. */
function Plates({ ind, items }) {
  return (
    <div style={{ display: 'flex', gap: 8, flex: 'none', flexWrap: 'wrap' }}>
      {items.map((it) => (
        <span key={it.label} style={{ border: `1px solid ${ind.hairline}`, padding: '3px 12px' }}>
          <span className="block" style={{ fontFamily: DISPLAY, fontWeight: 600, fontSize: 9.5, letterSpacing: '.12em', textTransform: 'uppercase', color: ind.inkMuted }}>
            {it.label}
          </span>
          <span className="block" style={{ fontFamily: DISPLAY, fontWeight: 600, fontSize: 14, color: ind.ink, fontVariantNumeric: 'tabular-nums' }}>
            {it.value}
          </span>
        </span>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Screen
 * ------------------------------------------------------------------ */

const PolicyControls = () => {
  const { isDarkMode } = useTheme();
  const ind = getIndustry(isDarkMode);
  const { t, currentLanguage } = useLanguage();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [draft, setDraft] = useState(PUBLISHED);
  const [published, setPublished] = useState(PUBLISHED);
  const [version, setVersion] = useState(INITIAL_VERSION);
  const [audit, setAudit] = useState(SEED_AUDIT);
  const [activeSection, setActiveSection] = useState('01');

  /**
   * The queue. Requests raised by other people arrive here already; your own
   * edits join the same queue, so a policy edit is reviewed exactly like any
   * other request. `state` is 'open' (awaiting a decision) or 'accepted'
   * (applied to the draft, still unpublished).
   */
  const [queue, setQueue] = useState(() => INITIAL_QUEUE.map((item) => ({ ...item })));

  const translateMessage = (descriptor, params = {}) => {
    if (!descriptor) return '';
    const values = { ...(descriptor.params || {}), ...params };
    return Object.entries(values).reduce(
      (text, [key, value]) => text.split(`{${key}}`).join(String(value)),
      t(descriptor.key, descriptor.fallback)
    );
  };

  const formatValue = (format, value) => (
    format ? format(value, currentLanguage, t) : String(value ?? '')
  );

  const formatAuditDate = (entry) => formatDate(
    entry?.occurredAt,
    currentLanguage,
    { day: '2-digit', month: 'short' }
  ).toLocaleUpperCase(localeTag(currentLanguage));

  const formatAuditTime = (entry) => {
    const date = new Date(entry?.occurredAt);
    if (Number.isNaN(date.getTime())) return '';
    return new Intl.DateTimeFormat(localeTag(currentLanguage), {
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).format(date);
  };

  const formatAuditActor = (entry) => (
    entry?.actor
      || translateMessage(entry?.actorMessage)
      || t('policyControls.you', 'You')
  );

  const formatAuditChange = (entry) => {
    if (entry.change) {
      const params = entry.format
        ? {
          from: formatValue(entry.format, entry.from),
          to: formatValue(entry.format, entry.to),
        }
        : {};
      return translateMessage(entry.change, params);
    }

    const name = translateMessage(entry.name);
    if (entry.queuedText) return `${name} — ${translateMessage(entry.queuedText)}`;
    return `${name} ${formatValue(entry.format, entry.from)} → ${formatValue(entry.format, entry.to)}`;
  };

  const set = (key, value) => setDraft((d) => ({ ...d, [key]: value }));

  /**
   * Your own edits join the queue. One rule can only carry one pending change,
   * so editing a rule someone else has already asked about takes that item over
   * rather than opening a second one — otherwise the count would say two
   * changes where the spec sheet only has one.
   */
  const edit = (key, value, name, format) => {
    set(key, value);
    setQueue((q) => {
      // Back on the published value: there is nothing pending on this rule.
      if (value === published[key]) return q.filter((item) => item.key !== key);

      const existing = q.find((item) => item.key === key);
      if (existing) {
        return q.map((item) => (item.key === key
          ? {
            ...item,
            from: item.from ?? published[key],
            to: value,
            format: item.format || format,
            value,
            queuedText: null,
            state: 'accepted',
          }
          : item));
      }

      return [
        ...q,
        {
          id: `edit-${key}`,
          key,
          name,
          from: published[key],
          to: value,
          format,
          value,
          tag: { ...message('policyControls.yourEdit', 'Your edit'), variant: 'accent' },
          reason: message('policyControls.yourEditReason', 'Edited on this screen — it takes effect when you publish.'),
          tinted: false,
          state: 'accepted',
        },
      ];
    });
  };

  const toggle = (key, name) => edit(key, !draft[key], name, fmtOnOff);

  const approve = (item) => {
    set(item.key, item.value);
    setQueue((q) => q.map((i) => (i.id === item.id ? { ...i, state: 'accepted' } : i)));
  };

  const decline = (item) => {
    set(item.key, published[item.key]);
    setQueue((q) => q.filter((i) => i.id !== item.id));
  };

  /** The one commit on the screen. Everything queued lands at once. */
  const publish = () => {
    if (queue.length === 0) return;
    const now = new Date();
    const actor = user?.name || user?.user_metadata?.name || user?.email?.split('@')[0] || null;

    const next = { ...draft };
    queue.forEach((item) => { next[item.key] = item.value; });

    const entries = queue.map((item) => ({
      id: `${item.id}-${now.getTime()}`,
      occurredAt: now.toISOString(),
      name: item.name,
      from: item.from,
      to: item.to,
      format: item.format,
      queuedText: item.queuedText,
      actor,
    }));

    setDraft(next);
    setPublished(next);
    setAudit((a) => [...entries, ...a]);
    setVersion((v) => {
      const [major, minor] = v.split('.').map(Number);
      return `${major}.${minor + 1}`;
    });
    setQueue([]);
  };

  const newest = audit[0];

  /* ---------------- sections ---------------- */

  /**
   * Every row carries a label, a consequence with a real count or effect, and
   * exactly one control. A second line that only restates the label is a defect,
   * so each consequence says what the number does to somebody.
   */
  const sections = useMemo(() => [
    {
      num: '01',
      key: 'working-time',
      label: t('policyControls.sec.workingTime', 'Working time'),
      scope: t('policyControls.scope.allDepartments', 'Scope: all departments'),
      rows: [
        {
          label: t('policyControls.row.standardDay', 'Standard working day'),
          consequence: t('policyControls.row.standardDayNote', 'Anything past it is overtime — 41 people crossed it yesterday'),
          control: { type: 'stepper', key: 'workingDayMinutes', step: 15, min: 240, max: 720, format: fmtHm, name: message('policyControls.row.standardDay', 'Standard working day') },
        },
        {
          label: t('policyControls.row.workingDays', 'Working days per month'),
          consequence: t('policyControls.row.workingDaysNote', 'Divides every monthly figure on the dashboard — July 2026 resolves to 26'),
          control: { type: 'stepper', key: 'workingDaysMonth', step: 1, min: 18, max: 31, format: fmtPlain, name: message('policyControls.row.workingDays', 'Working days per month') },
        },
        {
          label: t('policyControls.row.coreHours', 'Core hours'),
          consequence: t('policyControls.row.coreHoursNote', 'Meetings outside it need an override — 3 were booked this week'),
          control: { type: 'range', from: draft.coreStart, to: draft.coreEnd },
        },
        {
          label: t('policyControls.row.lateGrace', 'Late grace'),
          consequence: t('policyControls.row.lateGraceNote', '7 people used it this week'),
          control: { type: 'stepper', key: 'lateGrace', step: 1, min: 0, max: 30, format: fmtMinutes, name: message('policyControls.item.lateGrace', 'Late grace period') },
        },
        {
          label: t('policyControls.row.autoClose', 'Auto-close punches'),
          consequence: t('policyControls.row.autoCloseNote', 'Closed 14 forgotten punches at midnight last month'),
          control: { type: 'toggle', key: 'autoClosePunches', name: message('policyControls.row.autoClose', 'Auto-close punches') },
        },
        {
          label: t('policyControls.row.weekendWork', 'Weekend counts as work'),
          consequence: t('policyControls.row.weekendWorkNote', 'Turning it on moves the month from 26 to 30 working days'),
          control: { type: 'toggle', key: 'weekendCountsAsWork', name: message('policyControls.row.weekendWork', 'Weekend counts as work') },
        },
      ],
    },
    {
      num: '02',
      key: 'overtime',
      label: t('policyControls.sec.overtime', 'Overtime & pay'),
      scope: t('policyControls.scope.overtime', 'Scope: all departments · 1 override on Engineering'),
      rows: [
        {
          label: t('policyControls.row.otCap', 'Monthly overtime cap'),
          consequence: t('policyControls.row.otCapNote', '3 people are over it this month'),
          linkLabel: t('policyControls.openCases', 'open the cases'),
          linkTo: '/time-tracking',
          control: { type: 'stepper', key: 'otCap', step: 1, min: 0, max: 60, format: fmtHours, name: message('policyControls.item.otCap', 'Overtime cap') },
        },
        {
          label: t('policyControls.row.otApproval', 'Overtime requires approval'),
          consequence: t('policyControls.row.otApprovalNote', '23 managers hold the decision · 41 requests cleared this month'),
          control: { type: 'toggle', key: 'otNeedsApproval', name: message('policyControls.row.otApproval', 'Overtime requires approval') },
        },
        {
          label: t('policyControls.row.multipliers', 'Overtime multipliers'),
          consequence: t('policyControls.row.multipliersNote', 'Set by contract — payroll reads these, this screen only reports them'),
          control: {
            type: 'plates',
            items: [
              { label: t('policyControls.weekday', 'Weekday'), value: '×1.5' },
              { label: t('policyControls.weekend', 'Weekend'), value: '×2.0' },
              { label: t('policyControls.holiday', 'Holiday'), value: '×3.0' },
            ],
          },
        },
        {
          label: t('policyControls.row.payPeriod', 'Pay period closes'),
          consequence: t('policyControls.row.payPeriodNote', 'Entries filed after it land in the following month — 6 did in July'),
          control: { type: 'readonly', value: t('policyControls.thirdWorkingDay', '3rd working day') },
        },
      ],
    },
    {
      num: '03',
      key: 'leave',
      label: t('policyControls.sec.leave', 'Leave policy'),
      scope: t('policyControls.scope.leave', 'Scope: all departments · statutory minimum applies'),
      rows: [
        {
          label: t('policyControls.row.annualLeave', 'Annual leave entitlement'),
          consequence: t('policyControls.row.annualLeaveNote', '9 people have already spent all of it this year'),
          control: { type: 'stepper', key: 'annualLeaveDays', step: 1, min: 12, max: 30, format: fmtDays, name: message('policyControls.row.annualLeave', 'Annual leave entitlement') },
        },
        {
          label: t('policyControls.row.carryOver', 'Carry-over cap'),
          consequence: t('policyControls.row.carryOverNote', '12 people will lose days on 31 December at this cap'),
          control: { type: 'stepper', key: 'carryOverCap', step: 1, min: 0, max: 15, format: fmtDays, name: message('policyControls.row.carryOver', 'Carry-over cap') },
        },
        {
          label: t('policyControls.row.leaveNotice', 'Notice required'),
          consequence: t('policyControls.row.leaveNoticeNote', '4 requests bypassed it this quarter'),
          linkLabel: t('policyControls.openCases', 'open the cases'),
          linkTo: '/leave-management',
          control: { type: 'stepper', key: 'leaveNoticeDays', step: 1, min: 0, max: 21, format: fmtDays, name: message('policyControls.row.leaveNotice', 'Notice required') },
        },
        {
          label: t('policyControls.row.sickNote', 'Sick note required after'),
          consequence: t('policyControls.row.sickNoteNote', '17 notes were filed against this rule this year'),
          control: { type: 'stepper', key: 'sickNoteAfterDays', step: 1, min: 1, max: 10, format: fmtDays, name: message('policyControls.row.sickNote', 'Sick note required after') },
        },
        {
          label: t('policyControls.row.holidays', 'Public holidays'),
          consequence: t('policyControls.row.holidaysNote', 'Vietnam statutory calendar — 11 days, none in August'),
          control: { type: 'readonly', value: t('policyControls.elevenDays', '11 days') },
        },
      ],
    },
    {
      num: '04',
      key: 'roles',
      label: t('policyControls.sec.roles', 'Roles & access'),
      scope: t('policyControls.scope.roles', 'Scope: 6 roles · 248 employees'),
      rows: [
        {
          label: t('policyControls.row.rolesInUse', 'Roles in use'),
          consequence: t('policyControls.row.rolesInUseNote', 'Admin · HR · Manager · Team lead · Employee · Viewer'),
          control: { type: 'readonly', value: String(ROLE_COUNT) },
        },
        {
          label: t('policyControls.row.managersLeave', 'Managers can approve leave'),
          consequence: t('policyControls.row.managersLeaveNote', '23 managers hold it · 41 approvals this month'),
          control: { type: 'toggle', key: 'managersApproveLeave', name: message('policyControls.row.managersLeave', 'Managers can approve leave') },
        },
        {
          label: t('policyControls.row.teamLeadOt', 'Team leads can approve overtime'),
          consequence: t('policyControls.row.teamLeadOtNote', '9 people would gain it — queued for publication'),
          control: { type: 'toggle', key: 'teamLeadsApproveOvertime', name: message('policyControls.item.teamLead', 'Role · Team lead') },
        },
        {
          label: t('policyControls.row.session', 'Session length'),
          consequence: t('policyControls.row.sessionNote', '148 sessions were cut short at this length last month'),
          control: { type: 'stepper', key: 'sessionHours', step: 1, min: 1, max: 24, format: fmtHours, name: message('policyControls.row.session', 'Session length') },
        },
        {
          label: t('policyControls.row.twoFactor', 'Two-factor for admins'),
          consequence: t('policyControls.row.twoFactorNote', '4 admin accounts are enrolled; turning it off unenrols them all'),
          control: { type: 'toggle', key: 'adminTwoFactor', name: message('policyControls.row.twoFactor', 'Two-factor for admins') },
        },
      ],
    },
    {
      num: '05',
      key: 'cycles',
      label: t('policyControls.sec.cycles', 'Review cycles'),
      scope: t('policyControls.scope.cycles', 'Scope: all departments · H1 2026 open'),
      href: '/task-review',
      rows: [],
    },
    {
      num: '06',
      key: 'notifications',
      label: t('policyControls.sec.notifications', 'Notifications'),
      scope: t('policyControls.scope.notifications', 'Scope: all employees · email and in-app'),
      rows: [
        {
          label: t('policyControls.row.digest', 'Daily digest'),
          consequence: t('policyControls.row.digestNote', '231 people receive it; 17 have opted out'),
          control: { type: 'readonly', value: '08:00' },
        },
        {
          label: t('policyControls.row.punchReminder', 'Punch reminder after'),
          consequence: t('policyControls.row.punchReminderNote', 'Sent 34 times this week'),
          control: { type: 'stepper', key: 'punchReminderMinutes', step: 5, min: 5, max: 60, format: fmtMinutes, name: message('policyControls.row.punchReminder', 'Punch reminder after') },
        },
        {
          label: t('policyControls.row.escalate', 'Escalate unanswered requests after'),
          consequence: t('policyControls.row.escalateNote', '6 requests escalated to a department head this month'),
          control: { type: 'stepper', key: 'escalateAfterDays', step: 1, min: 1, max: 14, format: fmtDays, name: message('policyControls.row.escalate', 'Escalate unanswered requests after') },
        },
        {
          label: t('policyControls.row.weekendNotify', 'Weekend notifications'),
          consequence: t('policyControls.row.weekendNotifyNote', 'Turning it on reaches 248 people on a rest day'),
          control: { type: 'toggle', key: 'weekendNotifications', name: message('policyControls.row.weekendNotify', 'Weekend notifications') },
        },
      ],
    },
    {
      num: '07',
      key: 'data',
      label: t('policyControls.sec.data', 'Data & retention'),
      scope: t('policyControls.scope.data', 'Scope: all records · Vietnam data residency'),
      rows: [
        {
          label: t('policyControls.row.timeEntries', 'Time entries kept for'),
          consequence: t('policyControls.row.timeEntriesNote', 'The oldest entry on file is from March 2023 — shortening this deletes it'),
          control: { type: 'stepper', key: 'timeEntryMonths', step: 6, min: 12, max: 120, format: fmtMonths, name: message('policyControls.row.timeEntries', 'Time entries kept for') },
        },
        {
          label: t('policyControls.row.leaveRecords', 'Leave records kept for'),
          consequence: t('policyControls.row.leaveRecordsNote', 'Labour code requires 60 months — below that the export stops being audit-safe'),
          control: { type: 'stepper', key: 'leaveRecordMonths', step: 6, min: 12, max: 120, format: fmtMonths, name: message('policyControls.row.leaveRecords', 'Leave records kept for') },
        },
        {
          label: t('policyControls.row.auditLog', 'Audit log kept for'),
          consequence: t('policyControls.row.auditLogNote', '4,812 entries are stored under this window'),
          control: { type: 'stepper', key: 'auditLogMonths', step: 6, min: 6, max: 120, format: fmtMonths, name: message('policyControls.row.auditLog', 'Audit log kept for') },
        },
        {
          label: t('policyControls.row.anonymise', 'Anonymise leavers'),
          consequence: t('policyControls.row.anonymiseNote', '3 leavers fall due next month once this runs'),
          control: { type: 'toggle', key: 'anonymiseLeavers', name: message('policyControls.row.anonymise', 'Anonymise leavers') },
        },
        {
          label: t('policyControls.row.exportFormat', 'Export format'),
          consequence: t('policyControls.row.exportFormatNote', 'Payroll reads this file every 3rd working day'),
          control: { type: 'plates', items: [{ label: t('policyControls.file', 'File'), value: 'CSV' }, { label: t('policyControls.encoding', 'Encoding'), value: 'UTF-8' }] },
        },
      ],
    },
  ], [t, draft.coreStart, draft.coreEnd]);

  /** The stack shows the active panel and the one after it. */
  const activeIndex = Math.max(0, sections.findIndex((s) => s.num === activeSection));
  const visible = sections
    .slice(activeIndex, activeIndex + 2)
    .filter((s) => s.rows.length > 0);

  /* ---------------- shared styles ---------------- */

  const caption = { fontFamily: BODY, fontSize: 13, color: ind.inkMuted, lineHeight: 1.5, margin: 0 };
  const consequenceStyle = { fontFamily: BODY, fontSize: 11.5, color: ind.inkMuted, lineHeight: 1.45, margin: '3px 0 0' };
  const columnNote = { fontFamily: BODY, fontSize: 11.5, color: ind.inkMuted, lineHeight: 1.45, margin: '6px 0 0' };

  const renderControl = (control) => {
    switch (control.type) {
      case 'stepper':
        return (
          <Stepper
            ind={ind}
            value={{ raw: draft[control.key], label: formatValue(control.format, draft[control.key]) }}
            step={control.step}
            min={control.min}
            max={control.max}
            onChange={(v) => edit(control.key, v, control.name, control.format)}
          />
        );
      case 'range':
        return <RangePair ind={ind} from={control.from} to={control.to} />;
      case 'toggle':
        return (
          <Toggle
            ind={ind}
            t={t}
            language={currentLanguage}
            on={draft[control.key]}
            onChange={() => toggle(control.key, control.name)}
          />
        );
      case 'plates':
        return <Plates ind={ind} items={control.items} />;
      default:
        return <ReadOnly ind={ind} value={control.value} />;
    }
  };

  /* ---------------- render ---------------- */

  return (
    <div
      data-screen-label="Policy Controls"
      style={{
        border: `1px solid ${ind.hairline}`,
        background: ind.ground,
        color: ind.ink,
        fontFamily: BODY,
        fontSize: 14,
        borderRadius: 0,
      }}
    >
      {/* ── TICKER ───────────────────────────────────────────────────── */}
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
          <LiveClock ind={ind} live />
        </TickerCell>

        <TickerCell ind={ind} label={t('policyControls.policy', 'Policy')} value={`v${version}`} />
        <TickerCell ind={ind} label={t('policyControls.users', 'Users')} value={EMPLOYEE_COUNT} />
        <TickerCell ind={ind} label={t('policyControls.roles', 'Roles')} value={ROLE_COUNT} />
        <TickerCell
          ind={ind}
          label={t('policyControls.pendingChanges', 'Pending changes')}
          value={queue.length}
          // The one figure on the strip that asks for an action.
          valueColor={queue.length > 0 ? ind.tickerUp : undefined}
        />
        <TickerCell ind={ind} label={t('policyControls.lastEdit', 'Last edit')} value={formatAuditDate(newest)} />

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
          <FlatSelect
            ind={ind}
            onDark
            value={ORG_ID}
            onChange={() => {}}
            aria-label={t('policyControls.organisation', 'Organisation')}
          >
            <option value={ORG_ID} style={{ color: '#1d1f20' }}>
              {t('policyControls.organisationName', 'Company Group')}
            </option>
          </FlatSelect>
        </div>
      </div>

      {/* ── BANDS ────────────────────────────────────────────────────── */}
      <div className="flex flex-col lg:flex-row items-stretch">

        {/* ── LEFT — the spec sheet ────────────────────────────────── */}
        <div
          className="flex-1 min-w-0 flex flex-col"
          style={{ padding: '22px 24px 20px', gap: 16, borderRight: `1px solid ${ind.hairline}` }}
        >
          {/* Title row — provenance belongs here, not in a footnote. */}
          <div className="flex flex-wrap items-end justify-between" style={{ gap: 14 }}>
            <div style={{ minWidth: 0 }}>
              <h1 style={{ fontFamily: BODY, fontSize: 32, fontWeight: 400, margin: 0, color: ind.ink, lineHeight: 1.1 }}>
                {t('policyControls.title', 'Policy Controls')}
              </h1>
              <p style={{ ...caption, marginTop: 6 }}>
                {[
                  `${t('policyControls.version', 'Policy version')} ${version}`,
                  `${t('policyControls.lastEditedBy', 'last edited by')} ${formatAuditActor(newest)}, ${formatAuditDate(newest)} ${formatAuditTime(newest)}`,
                  t('policyControls.appliesTo', 'applies to {n} employees').replace('{n}', String(EMPLOYEE_COUNT)),
                ].join(' · ')}
              </p>
            </div>

            <div style={{ display: 'flex', gap: 8, flex: 'none' }}>
              <Btn
                ind={ind}
                onClick={() => navigate('/reports')}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}
              >
                <FileClock size={13} strokeWidth={1.5} />
                {t('policyControls.versionHistory', 'Version history')}
              </Btn>
              {/* The only commit affordance on the screen. */}
              <Btn ind={ind} variant="primary" onClick={publish} disabled={queue.length === 0}>
                {queue.length === 0
                  ? t('policyControls.nothingToPublish', 'Nothing to publish')
                  : t('policyControls.publishN', 'Publish {n} changes').replace('{n}', String(queue.length))}
              </Btn>
            </div>
          </div>

          {/* Two-level navigation: the section index beside the panel stack. */}
          <div className="flex flex-col md:flex-row" style={{ gap: 16, flex: 1, minHeight: 0 }}>
            <nav
              aria-label={t('policyControls.sections', 'Policy sections')}
              className="md:w-[184px] md:shrink-0"
              style={{
                display: 'flex', flexDirection: 'column', gap: 1,
                borderTop: `1px solid ${ind.hairline}`,
                borderBottom: `1px solid ${ind.hairline}`,
                padding: '8px 0',
                alignSelf: 'flex-start',
              }}
            >
              {sections.map((s) => {
                const active = s.num === activeSection;
                return (
                  <a
                    key={s.num}
                    href={s.href || `#${s.key}`}
                    onClick={(e) => {
                      e.preventDefault();
                      if (s.href) navigate(s.href);
                      else setActiveSection(s.num);
                    }}
                    style={{
                      display: 'flex', alignItems: 'baseline', gap: 10,
                      padding: '8px 10px', textDecoration: 'none',
                      background: active ? ind.accent : 'transparent',
                      color: active ? ind.accentInk : ind.ink,
                      transition: 'background .15s ease',
                    }}
                    onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = ind.hover; }}
                    onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = 'transparent'; }}
                  >
                    <span
                      style={{
                        fontFamily: DISPLAY, fontWeight: 600, fontSize: 10, letterSpacing: '.12em',
                        color: active ? ind.accentInk : ind.inkFaint,
                        opacity: active ? 0.7 : 1,
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      {s.num}
                    </span>
                    <span
                      style={{
                        fontFamily: DISPLAY, fontWeight: 600, fontSize: 13, letterSpacing: '.05em',
                        textTransform: 'uppercase',
                      }}
                    >
                      {s.label}
                    </span>
                  </a>
                );
              })}
            </nav>

            {/* Panel stack. A new policy area arrives as another numbered panel. */}
            <div className="flex-1 min-w-0 flex flex-col" style={{ gap: 16, minHeight: 0 }}>
              {visible.map((section) => (
                /* Bottom padding is 6px: the last row's border-top closes the panel. */
                <Blueprint key={section.num} ind={ind} style={{ padding: '16px 20px 6px', margin: 0, flex: 'none' }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
                    <span style={{ fontFamily: DISPLAY, fontWeight: 600, fontSize: 10, letterSpacing: '.16em', color: ind.accent }}>
                      {section.num}
                    </span>
                    <span style={{ fontFamily: DISPLAY, fontWeight: 600, fontSize: 16, letterSpacing: '.06em', textTransform: 'uppercase', color: ind.ink }}>
                      {section.label}
                    </span>
                    {/* No panel is scopeless. */}
                    <span style={{ fontFamily: BODY, fontSize: 11.5, color: ind.inkMuted }}>{section.scope}</span>
                  </div>

                  {section.rows.map((row) => (
                    <div
                      key={row.label}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 20,
                        padding: '11px 0', borderTop: `1px solid ${ind.rule}`,
                      }}
                    >
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontFamily: BODY, fontSize: 13.5, color: ind.ink }}>{row.label}</div>
                        <p style={consequenceStyle}>
                          {row.consequence}
                          {row.linkLabel && (
                            <>
                              {' — '}
                              <button
                                type="button"
                                onClick={() => navigate(row.linkTo)}
                                style={{
                                  background: 'none', border: 'none', padding: 0, cursor: 'pointer',
                                  fontFamily: BODY, fontSize: 11.5, color: ind.accentDeep, textDecoration: 'underline',
                                }}
                              >
                                {row.linkLabel}
                              </button>
                            </>
                          )}
                        </p>
                      </div>
                      {renderControl(row.control)}
                    </div>
                  ))}
                </Blueprint>
              ))}
            </div>
          </div>
        </div>

        {/* ── RIGHT — pending changes and the audit trail, 340px ────── */}
        <aside
          className="w-full lg:w-[340px] lg:shrink-0 flex flex-col"
          style={{ background: ind.chrome, overflow: 'hidden' }}
        >
          <div style={{ padding: '20px 20px 12px', borderBottom: `1px solid ${ind.hairline}` }}>
            <div className="flex items-baseline justify-between" style={{ gap: 10 }}>
              <ColumnHeading ind={ind}>{t('policyControls.pendingChanges', 'Pending changes')}</ColumnHeading>
              <span style={{ fontFamily: DISPLAY, fontWeight: 600, fontSize: 12, color: ind.accent, whiteSpace: 'nowrap' }}>
                {t('policyControls.nItems', '{n} items').replace('{n}', String(queue.length))}
              </span>
            </div>
            <p style={columnNote}>{t('policyControls.nothingUntilPublished', 'Nothing takes effect until published')}</p>
          </div>

          {queue.length === 0 && (
            <div style={{ padding: '16px 20px', borderBottom: `1px solid ${ind.rule}` }}>
              <p style={{ fontFamily: BODY, fontSize: 12.5, color: ind.inkMuted, lineHeight: 1.5 }}>
                {t('policyControls.queueEmpty', 'The published policy and the draft agree. Edit a rule to open a change.')}
              </p>
            </div>
          )}

          {queue.map((item) => (
            <div
              key={item.id}
              style={{
                padding: '14px 20px',
                borderBottom: `1px solid ${ind.rule}`,
                background: item.tinted ? ind.accentWash : 'transparent',
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
                  {translateMessage(item.name)}
                </span>
                {item.tag && <Tag ind={ind} variant={item.tag.variant}>{translateMessage(item.tag)}</Tag>}
              </div>

              {/* Size and ink carry the direction of the change. No red, no green. */}
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 9, margin: '7px 0 6px', flexWrap: 'wrap' }}>
                {item.queuedText ? (
                  <>
                    <ArrowRight size={14} strokeWidth={1.5} style={{ flex: 'none', color: ind.ink, opacity: 0.45 }} />
                    <span style={{ fontFamily: BODY, fontSize: 12.5, color: ind.ink }}>{translateMessage(item.queuedText)}</span>
                  </>
                ) : (
                  <>
                    <span style={{ fontFamily: DISPLAY, fontWeight: 600, fontSize: 17, color: ind.ink, opacity: 0.45, textDecoration: 'line-through', fontVariantNumeric: 'tabular-nums' }}>
                      {formatValue(item.format, item.from)}
                    </span>
                    <ArrowRight size={14} strokeWidth={1.5} style={{ flex: 'none', color: ind.ink, opacity: 0.45 }} />
                    <span style={{ fontFamily: DISPLAY, fontWeight: 600, fontSize: 20, color: ind.ink, fontVariantNumeric: 'tabular-nums' }}>
                      {formatValue(item.format, item.to)}
                    </span>
                  </>
                )}
              </div>

              {item.reason && (
                <p style={{ fontFamily: BODY, fontSize: 12.5, color: ind.inkGhost, margin: '0 0 9px', lineHeight: 1.45 }}>
                  {translateMessage(item.reason)}
                </p>
              )}

              {item.state === 'open' && (
                <div style={{ display: 'flex', gap: 7 }}>
                  <Btn ind={ind} variant="primary" onClick={() => approve(item)}>{t('policyControls.approve', 'Approve')}</Btn>
                  <Btn ind={ind} onClick={() => decline(item)}>{t('policyControls.decline', 'Decline')}</Btn>
                </div>
              )}

              {item.state === 'accepted' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontFamily: DISPLAY, fontWeight: 600, fontSize: 11, letterSpacing: '.12em', textTransform: 'uppercase', color: ind.accent }}>
                    {t('policyControls.accepted', 'Accepted')}
                  </span>
                  <Btn ind={ind} onClick={() => decline(item)}>{t('policyControls.revert', 'Revert')}</Btn>
                </div>
              )}

              {item.state === 'queued' && (
                <span style={{ fontFamily: DISPLAY, fontWeight: 600, fontSize: 11, letterSpacing: '.12em', textTransform: 'uppercase', color: ind.inkMuted }}>
                  {t('policyControls.queued', 'Queued')}
                </span>
              )}
            </div>
          ))}

          {/* Audit trail — what the newest entry says is what the title says. */}
          <div style={{ padding: '18px 20px 12px', marginTop: 6, borderBottom: `1px solid ${ind.hairline}` }}>
            <ColumnHeading ind={ind}>{t('policyControls.auditTrail', 'Audit trail')}</ColumnHeading>
          </div>

          {audit.slice(0, 6).map((entry) => (
            <div
              key={entry.id}
              style={{ display: 'flex', gap: 12, padding: '11px 20px', borderBottom: `1px solid ${ind.rule}` }}
            >
              <span
                style={{
                  width: 52, flex: 'none',
                  fontFamily: DISPLAY, fontWeight: 600, fontSize: 11, letterSpacing: '.1em',
                  color: ind.ink, opacity: 0.45, fontVariantNumeric: 'tabular-nums',
                }}
              >
                {formatAuditDate(entry)}
              </span>
              <span style={{ minWidth: 0 }}>
                <span className="block" style={{ fontFamily: BODY, fontSize: 12.5, color: ind.ink, lineHeight: 1.4 }}>
                  {formatAuditChange(entry)}
                </span>
                <span className="block" style={{ fontFamily: BODY, fontSize: 11.5, color: ind.inkMuted, marginTop: 2 }}>
                  {formatAuditActor(entry)} · {formatAuditTime(entry)}
                </span>
              </span>
            </div>
          ))}
        </aside>
      </div>
    </div>
  );
};

export default PolicyControls;
