/**
 * Settings — your own preferences, read as a spec sheet.
 *
 * Same grammar as Policy Controls (policyControls.jsx), because it is the same
 * kind of screen: every row shows its value, what it applies to and what
 * changing it costs, and nothing commits until you save. The tab bar is gone —
 * a 184px numbered section index sits beside a single panel, so a new
 * preference area arrives as another numbered panel rather than a sixth tab.
 *
 * Derived, never typed twice: the section definitions below are the only place
 * a setting's label, note and formatter exist. The ticker's UNSAVED figure, the
 * decision column and the label on the save button all read the same `pending`
 * array, which is a diff of the draft against what was last saved — so the
 * button cannot claim there is nothing to save while the column lists three
 * changes.
 *
 * Design system: "Industry" (src/theme/industry.js). Radius 0, cards are
 * outlines with four registration corners, toggles are squares and never pills,
 * and state reads through weight and rule rather than red/green.
 */
import _React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Download,
  Upload,
  RotateCcw,
  Save,
  Loader,
  Check,
  AlertCircle,
  ArrowRight,
} from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import {
  useNotifications,
  NOTIFICATION_PREFS_CHANGED_EVENT
} from '../contexts/NotificationContext';
import { useAuthenticatedPageRefresh } from '../hooks/useSessionGuard.js';
import { ensureValidSession } from '../hooks/useSessionGuard.js';
import * as settingsService from '../services/settingsService';
import { ShinyButton } from './ui/shiny-button';
import { TimePicker } from './ui/time-picker.jsx';
import { getIndustry, DISPLAY, BODY } from '../theme/industry.js';
import { Blueprint, Btn, Kicker, ColumnHeading, TickerCell, LiveClock, FlatSelect } from './ui/industry.jsx';
import { FetchElapsedPill } from './ui/fetch-elapsed-pill';

/* ------------------------------------------------------------------ *
 * Controls — the Industry forms of the three things this screen edits
 * ------------------------------------------------------------------ */

/** State word + a square box holding a square knob. Never a pill. */
function Toggle({ ind, on, onChange, label, t }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!on)}
      aria-pressed={!!on}
      aria-label={label}
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
        {on ? t('settings.on', 'On') : t('settings.off', 'Off')}
      </span>
      <span
        style={{
          width: 34, height: 18, padding: 1, borderRadius: 0,
          border: `1px solid ${on ? ind.accent : ind.inkFaint}`,
          display: 'flex', alignItems: 'center',
          justifyContent: on ? 'flex-end' : 'flex-start',
        }}
      >
        <span style={{ width: 14, height: 14, background: on ? ind.accent : ind.inkFaint }} />
      </span>
    </button>
  );
}

/** −  value  +  · three cells in one hairline box. */
function Stepper({ ind, value, onChange, step = 1, min, max, label }) {
  const sign = {
    width: 24, display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: 'transparent', border: 'none', borderRadius: 0, padding: 0,
    fontFamily: DISPLAY, fontWeight: 600, fontSize: 14, color: ind.inkMuted,
    cursor: 'pointer', lineHeight: 1,
  };
  const bump = (delta) => {
    const next = Number(value) + delta * step;
    if (!Number.isFinite(next)) return;
    if (min != null && next < min) return;
    if (max != null && next > max) return;
    onChange(next);
  };
  return (
    <div
      role="group"
      aria-label={label}
      style={{ display: 'flex', alignItems: 'stretch', border: `1px solid ${ind.hairline}`, flex: 'none' }}
    >
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
        {value}
      </div>
      <button type="button" style={sign} onClick={() => bump(1)} aria-label="+">+</button>
    </div>
  );
}

/** A short, fixed list reads as chips — the choice is the whole control. */
function Chips({ ind, options, value, onChange, label }) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap" style={{ gap: 6, flex: 'none' }}>
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(opt.value)}
            style={{
              fontFamily: DISPLAY, fontWeight: 600, fontSize: 11.5,
              letterSpacing: '.08em', textTransform: 'uppercase',
              padding: '5px 10px', borderRadius: 0, cursor: 'pointer', whiteSpace: 'nowrap',
              background: active ? ind.accent : 'transparent',
              color: active ? ind.accentInk : ind.inkGhost,
              border: `1px solid ${active ? ind.accent : ind.hairline}`,
              transition: 'background .15s ease, color .15s ease',
            }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Screen
 * ------------------------------------------------------------------ */

const Settings = () => {
  const { isDarkMode, toggleTheme } = useTheme();
  const ind = useMemo(() => getIndustry(isDarkMode), [isDarkMode]);
  const { t, changeLanguage, currentLanguage } = useLanguage();
  const { user, handleSessionAuthError } = useAuth();
  const { requestNotificationPermission, updateNotificationPrefs } = useNotifications();

  const [activeSection, setActiveSection] = useState('01');
  const [settings, setSettings] = useState(null);
  /** What the server last confirmed. The draft is diffed against this. */
  const [savedSettings, setSavedSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [importError, setImportError] = useState('');

  // Load settings on mount
  useEffect(() => {
    loadSettings();
  }, [user?.id]);

  const loadSettings = async () => {
    if (!user?.id) return;

    setLoading(true);
    try {
      await ensureValidSession();
      const result = await settingsService.getUserSettings(user.id);

      if (result.success) {
        setSettings(result.data);
        setSavedSettings(result.data);
      }
    } catch (error) {
      console.error('Error loading settings:', error);
      handleSessionAuthError(error, { silent: true });
    } finally {
      setLoading(false);
    }
  };

  useAuthenticatedPageRefresh(() => loadSettings());

  const handleSettingChange = (field, value) => {
    setSettings(prev => ({ ...prev, [field]: value }));
    setSaveSuccess(false);
  };

  const applySavedSettings = (data) => {
    updateNotificationPrefs(data);
    window.dispatchEvent(
      new CustomEvent(NOTIFICATION_PREFS_CHANGED_EVENT, { detail: data })
    );

    if (data.theme === 'dark' && !isDarkMode) {
      toggleTheme();
    } else if (data.theme === 'light' && isDarkMode) {
      toggleTheme();
    }

    if (data.language && data.language !== currentLanguage) {
      changeLanguage(data.language);
    }
  };

  const saveSettings = async () => {
    if (!user?.id || !settings) return;

    setSaving(true);
    try {
      await ensureValidSession();
      const result = await settingsService.updateUserSettings(user.id, settings);

      if (result.success) {
        setSettings(result.data);
        setSavedSettings(result.data);
        setSaveSuccess(true);

        applySavedSettings(result.data);
        setTimeout(() => setSaveSuccess(false), 3000);
      }
    } catch (error) {
      console.error('Error saving settings:', error);
      handleSessionAuthError(error);
    } finally {
      setSaving(false);
    }
  };

  const resetSettings = async () => {
    if (!window.confirm(t('settings.confirmReset', 'Are you sure you want to reset all settings to default?'))) {
      return;
    }

    setSaving(true);
    const result = await settingsService.resetToDefault(user.id);

    if (result.success) {
      setSettings(result.data);
      setSavedSettings(result.data);
      applySavedSettings(result.data);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    }

    setSaving(false);
  };

  const exportSettings = async () => {
    const result = await settingsService.exportSettings(user.id);
    if (result.success) {
      const blob = new Blob([result.data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `hr_settings_${user.id}.json`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  const importSettings = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const result = await settingsService.importSettings(user.id, e.target.result);
        if (result.success) {
          setSettings(result.data);
          setSavedSettings(result.data);
          applySavedSettings(result.data);
          setSaveSuccess(true);
          setTimeout(() => setSaveSuccess(false), 3000);
        }
      } catch {
        setImportError(t('settings.importError', 'Failed to import settings'));
      }
    };
    reader.readAsText(file);
  };

  /* ---------------- the spec sheet ---------------- */

  /** Postgres hands back HH:MM:SS; the picker speaks HH:MM. */
  const shortTime = (v) => (v ?? '').toString().slice(0, 5);

  /**
   * The single definition of every setting on this screen. The panel renders
   * from it and the decision column diffs against it, so a row's label can
   * never disagree with the label on its pending change.
   */
  const sections = useMemo(() => [
    {
      num: '01',
      key: 'notifications',
      label: t('settings.notifications', 'Notifications'),
      scope: t('settings.scope.notifications', 'Scope: this account · applies on your next sign-in'),
      rows: [
        {
          key: 'email_notifications',
          label: t('settings.emailNotifications', 'Email Notifications'),
          note: user?.email
            ? t('settings.note.email', 'Delivered to {email}').replace('{email}', user.email)
            : t('settings.emailNotificationsDesc', 'Receive notifications via email'),
          control: { type: 'toggle' },
        },
        {
          key: 'push_notifications',
          label: t('settings.pushNotifications', 'Push Notifications'),
          note: t('settings.pushNotificationsDesc', 'Receive push notifications in the app'),
          control: { type: 'toggle' },
        },
        {
          key: 'desktop_notifications',
          label: t('settings.desktopNotifications', 'Desktop Notifications'),
          note: t('settings.note.desktop', 'The browser asks for permission the first time this is turned on'),
          control: { type: 'toggle', permission: true },
        },
        {
          key: 'notification_sound',
          label: t('settings.notificationSound', 'Notification Sound'),
          note: t('settings.notificationSoundDesc', 'Play a sound when new notifications arrive'),
          control: { type: 'toggle' },
        },
        {
          key: 'notification_frequency',
          label: t('settings.notificationFrequency', 'Notification Frequency'),
          note: t('settings.note.frequency', 'Real-time delivers as events happen; a digest batches them into one message'),
          control: {
            type: 'chips',
            options: [
              { value: 'realtime', label: t('settings.realtime', 'Real-time') },
              { value: 'daily', label: t('settings.daily', 'Daily Digest') },
              { value: 'weekly', label: t('settings.weekly', 'Weekly Summary') },
            ],
          },
        },
      ],
    },
    {
      num: '02',
      key: 'topics',
      label: t('settings.notifyMeAbout', 'Notify me about'),
      scope: t('settings.scope.topics', 'Scope: every channel above · a topic that is off is never sent'),
      rows: [
        { key: 'notify_time_tracking', label: t('settings.timeTrackingNotifications', 'Time Tracking'), note: t('settings.note.timeTracking', 'Approvals, missing punches and proof requests'), control: { type: 'toggle' } },
        { key: 'notify_performance', label: t('settings.performanceNotifications', 'Performance Reviews'), note: t('settings.note.performance', 'Review cycles, goals and self-assessments'), control: { type: 'toggle' } },
        { key: 'notify_employee_updates', label: t('settings.employeeNotifications', 'Employee Updates'), note: t('settings.note.employee', 'Joiners, leavers and directory changes'), control: { type: 'toggle' } },
        { key: 'notify_recruitment', label: t('settings.recruitmentNotifications', 'Recruitment'), note: t('settings.note.recruitment', 'New applications and stage changes'), control: { type: 'toggle' } },
        { key: 'notify_system', label: t('settings.systemNotifications', 'System Updates'), note: t('settings.note.system', 'Maintenance windows and release notes'), control: { type: 'toggle' } },
      ],
    },
    {
      num: '03',
      key: 'appearance',
      label: t('settings.appearance', 'Appearance'),
      scope: t('settings.scope.appearance', 'Scope: this browser · saved to your account'),
      rows: [
        {
          key: 'theme',
          label: t('settings.theme', 'Theme'),
          note: t('settings.note.theme', 'System follows the operating system setting'),
          control: {
            type: 'chips',
            options: settingsService.getAvailableThemes().map((theme) => ({
              value: theme.value,
              label: t(`settings.themes.${theme.value}`, theme.label),
            })),
          },
        },
        {
          key: 'date_format',
          label: t('settings.dateFormat', 'Date Format'),
          note: t('settings.note.dateFormat', 'Used by every date on screen and in exports'),
          control: { type: 'select', options: settingsService.getDateFormats() },
        },
        {
          key: 'time_format',
          label: t('settings.timeFormat', 'Time Format'),
          note: t('settings.note.timeFormat', 'Applies to the clock, the ledgers and the punch history'),
          control: { type: 'select', options: settingsService.getTimeFormats() },
        },
        {
          key: 'items_per_page',
          label: t('settings.itemsPerPage', 'Items Per Page'),
          note: t('settings.note.itemsPerPage', 'Every table in the app pages at this size'),
          control: { type: 'stepper', step: 5, min: 5, max: 100 },
        },
      ],
    },
    {
      num: '04',
      key: 'language',
      label: t('settings.languageRegion', 'Language & Region'),
      scope: t('settings.scope.language', 'Scope: the whole interface · takes effect on save'),
      rows: [
        {
          key: 'language',
          label: t('settings.language', 'Language'),
          note: t('settings.note.language', 'Text without a translation falls back to English'),
          control: {
            type: 'select',
            options: settingsService.getAvailableLanguages().map((lang) => ({
              value: lang.code,
              label: `${lang.nativeName} (${lang.name})`,
            })),
          },
        },
        {
          key: 'timezone',
          label: t('settings.timezone', 'Timezone'),
          note: t('settings.note.timezone', 'Every timestamp on screen is rendered in this zone'),
          control: { type: 'select', options: settingsService.getTimezones() },
        },
      ],
    },
    {
      num: '05',
      key: 'privacy',
      label: t('settings.privacy', 'Privacy'),
      scope: t('settings.scope.privacy', 'Scope: what colleagues see on your directory card'),
      rows: [
        {
          key: 'profile_visibility',
          label: t('settings.profileVisibility', 'Profile Visibility'),
          note: t('settings.note.visibility', 'Managers and admins always keep access for HR purposes'),
          control: {
            type: 'chips',
            options: [
              { value: 'all', label: t('settings.visibilityAll', 'Everyone') },
              { value: 'team', label: t('settings.visibilityTeam', 'My Team') },
              { value: 'managers', label: t('settings.visibilityManagers', 'Managers Only') },
              { value: 'private', label: t('settings.visibilityPrivate', 'Private') },
            ],
          },
        },
        {
          key: 'show_email',
          label: t('settings.showEmail', 'Show Email Address'),
          note: t('settings.note.showEmail', 'Turning this off hides it from the directory, not from HR'),
          control: { type: 'toggle' },
        },
        {
          key: 'show_phone',
          label: t('settings.showPhone', 'Show Phone Number'),
          note: t('settings.note.showPhone', 'Turning this off hides it from the directory, not from HR'),
          control: { type: 'toggle' },
        },
      ],
    },
    {
      num: '06',
      key: 'work',
      label: t('settings.workPreferences', 'Work Preferences'),
      scope: t('settings.scope.work', 'Scope: your own time records and landing page'),
      rows: [
        {
          key: 'default_dashboard_view',
          label: t('settings.defaultDashboard', 'Default Dashboard View'),
          note: t('settings.note.dashboard', 'The view the Organisation Overview opens in'),
          control: {
            type: 'chips',
            options: [
              { value: 'overview', label: t('settings.overviewView', 'Overview') },
              { value: 'detailed', label: t('settings.detailedView', 'Detailed') },
              { value: 'compact', label: t('settings.compactView', 'Compact') },
            ],
          },
        },
        {
          key: 'auto_clock_out',
          label: t('settings.autoClockOut', 'Auto Clock Out'),
          note: t('settings.autoClockOutDesc', 'Automatically clock out at a specific time'),
          control: { type: 'toggle' },
        },
        {
          key: 'auto_clock_out_time',
          label: t('settings.autoClockOutTime', 'Auto Clock Out Time'),
          note: t('settings.note.autoClockOutTime', 'An open punch left running past this time is closed at it'),
          // Only meaningful while the switch above is on, but it stays in the
          // definition so a change to it still reaches the decision column.
          when: (s) => !!s?.auto_clock_out,
          normalize: shortTime,
          control: { type: 'time' },
        },
        {
          key: 'weekly_report',
          label: t('settings.weeklyReport', 'Weekly Report'),
          note: t('settings.weeklyReportDesc', 'Receive a weekly summary of your work activities'),
          control: { type: 'toggle' },
        },
      ],
    },
  ], [t, user?.email]);

  /** Flat index of every row, in section order. */
  const rowsByKey = useMemo(() => {
    const map = new Map();
    sections.forEach((section) => section.rows.forEach((row) => map.set(row.key, row)));
    return map;
  }, [sections]);

  /** How a value reads once it is out of its control. */
  const formatValue = useCallback((row, value) => {
    const norm = row.normalize ? row.normalize(value) : value;
    switch (row.control.type) {
      case 'toggle':
        return norm ? t('settings.on', 'On') : t('settings.off', 'Off');
      case 'chips':
      case 'select': {
        const opt = row.control.options.find((o) => o.value === norm);
        return opt ? opt.label : String(norm ?? '—');
      }
      default:
        return String(norm ?? '—');
    }
  }, [t]);

  /**
   * The draft against what was last saved. Everything on this screen that
   * counts changes counts this array.
   */
  const pending = useMemo(() => {
    if (!settings || !savedSettings) return [];
    const out = [];
    rowsByKey.forEach((row, key) => {
      const norm = row.normalize || ((v) => v);
      const before = norm(savedSettings[key]) ?? null;
      const after = norm(settings[key]) ?? null;
      if (before === after) return;
      out.push({
        key,
        label: row.label,
        from: formatValue(row, savedSettings[key]),
        to: formatValue(row, settings[key]),
      });
    });
    return out;
  }, [settings, savedSettings, rowsByKey, formatValue]);

  const hasChanges = pending.length > 0;

  const activeIndex = Math.max(0, sections.findIndex((s) => s.num === activeSection));
  const panel = sections[activeIndex];

  /* ---------------- shared styles ---------------- */

  const caption = { fontFamily: BODY, fontSize: 13, color: ind.inkMuted, lineHeight: 1.5, margin: 0 };
  const noteStyle = { fontFamily: BODY, fontSize: 11.5, color: ind.inkMuted, lineHeight: 1.45, margin: '3px 0 0' };
  const columnNote = { fontFamily: BODY, fontSize: 11.5, color: ind.inkMuted, lineHeight: 1.45, margin: '6px 0 0' };

  /** A <label> cannot be a <button>, so the import trigger borrows Btn's face. */
  const btnFace = {
    fontFamily: DISPLAY, fontWeight: 600, fontSize: 12.5, letterSpacing: '.04em',
    textTransform: 'uppercase', padding: '4px 12px', borderRadius: 0, cursor: 'pointer',
    background: 'transparent', color: ind.ink, border: `1px solid ${ind.hairline}`,
    display: 'inline-flex', alignItems: 'center', gap: 6,
  };

  const frameStyle = {
    border: `1px solid ${ind.hairline}`,
    background: ind.ground,
    color: ind.ink,
    fontFamily: BODY,
    fontSize: 14,
    borderRadius: 0,
  };

  const ticker = (
    <div
      style={{
        height: 44, background: ind.tickerBg, color: ind.tickerInk,
        borderBottom: `1px solid ${ind.hairline}`,
        display: 'flex', alignItems: 'stretch', overflowX: 'auto', overflowY: 'hidden',
      }}
    >
      <TickerCell ind={ind}>
        <LiveClock ind={ind} live={!!settings} />
      </TickerCell>
      <TickerCell ind={ind} label={t('settings.theme', 'Theme')} value={formatShort(settings?.theme)} />
      <TickerCell ind={ind} label={t('settings.language', 'Language')} value={(settings?.language || currentLanguage || '').toUpperCase()} />
      <TickerCell ind={ind} label={t('settings.timeFormat', 'Time Format')} value={formatShort(settings?.time_format)} />
      <TickerCell
        ind={ind}
        label={t('settings.unsaved', 'Unsaved')}
        value={pending.length}
        // The one figure on the strip that asks somebody to act.
        valueColor={pending.length > 0 ? ind.tickerUp : undefined}
      />
      <div
        style={{
          flex: 1, minWidth: 'max-content', display: 'flex', alignItems: 'center',
          justifyContent: 'flex-end', gap: 8, padding: '0 14px',
          borderLeft: `1px solid ${ind.tickerRule}`,
        }}
      >
        <FetchElapsedPill active={loading || saving} isDarkMode label={t('common.fetching', 'Fetching')} />
        <span style={{ fontFamily: DISPLAY, fontWeight: 600, fontSize: 12.5, letterSpacing: '.06em', textTransform: 'uppercase' }}>
          {user?.email || user?.name || '—'}
        </span>
      </div>
    </div>
  );

  if (loading || !settings) {
    return (
      <div data-screen-label="Settings" style={frameStyle}>
        {ticker}
        <div style={{ padding: '64px 24px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
          {loading ? (
            <>
              <Loader size={18} strokeWidth={1.5} className="animate-spin" style={{ color: ind.inkMuted }} />
              <span style={{ fontFamily: DISPLAY, fontWeight: 600, fontSize: 12.5, letterSpacing: '.12em', textTransform: 'uppercase', color: ind.inkMuted }}>
                {t('common.loading', 'Loading')}
              </span>
            </>
          ) : (
            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', maxWidth: 420 }}>
              <AlertCircle size={16} strokeWidth={1.5} style={{ flex: 'none', marginTop: 2, color: ind.ink }} />
              <div>
                <Kicker ind={ind} color={ind.ink}>{t('common.error', 'Error')}</Kicker>
                <p style={{ ...caption, marginTop: 4 }}>
                  {t('settings.loadFailed', 'Your settings could not be loaded.')}
                </p>
                <Btn ind={ind} onClick={loadSettings} style={{ marginTop: 12 }}>
                  {t('common.retry', 'Try Again')}
                </Btn>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  const renderControl = (row) => {
    const value = settings[row.key];
    switch (row.control.type) {
      case 'toggle':
        return (
          <Toggle
            ind={ind}
            t={t}
            label={row.label}
            on={!!value}
            onChange={async (next) => {
              // The browser only grants the permission inside the click.
              if (row.control.permission && next) {
                const granted = await requestNotificationPermission();
                if (!granted) return;
              }
              handleSettingChange(row.key, next);
            }}
          />
        );
      case 'chips':
        return (
          <Chips
            ind={ind}
            label={row.label}
            options={row.control.options}
            value={value}
            onChange={(next) => handleSettingChange(row.key, next)}
          />
        );
      case 'select':
        return (
          <FlatSelect
            ind={ind}
            aria-label={row.label}
            value={value ?? ''}
            onChange={(e) => handleSettingChange(row.key, e.target.value)}
            style={{ flex: 'none', maxWidth: 260, textTransform: 'none', letterSpacing: '.02em' }}
          >
            {row.control.options.map((opt) => (
              <option key={opt.value} value={opt.value} style={{ color: '#1d1f20' }}>
                {opt.label}
              </option>
            ))}
          </FlatSelect>
        );
      case 'stepper':
        return (
          <Stepper
            ind={ind}
            label={row.label}
            value={Number(value) || row.control.min}
            step={row.control.step}
            min={row.control.min}
            max={row.control.max}
            onChange={(next) => handleSettingChange(row.key, next)}
          />
        );
      case 'time':
        return (
          <div style={{ flex: 'none', width: 128 }}>
            <TimePicker
              flat
              id={`setting-${row.key}`}
              value={shortTime(value || '17:00')}
              onChange={(e) => handleSettingChange(row.key, e.target.value)}
              defaultOpenTime="17:00"
            />
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div data-screen-label="Settings" style={frameStyle}>
      {ticker}

      {/* ── BANDS ────────────────────────────────────────────────── */}
      <div className="flex flex-col lg:flex-row items-stretch">

        {/* ── LEFT — the spec sheet ─────────────────────────────── */}
        <div
          className="flex-1 min-w-0 flex flex-col"
          style={{ padding: '22px 24px 20px', gap: 16, borderRight: `1px solid ${ind.hairline}` }}
        >
          {saveSuccess && (
            <div
              className="flex items-center justify-between"
              style={{ border: `1px solid ${ind.hairline}`, background: ind.accentWash, padding: '9px 12px', gap: 10 }}
            >
              <span style={{ fontFamily: BODY, fontSize: 12.5, color: ind.ink }}>
                {t('settings.saved', 'Saved!')}
              </span>
              <Check size={14} strokeWidth={1.5} style={{ flex: 'none', color: ind.accentDeep }} />
            </div>
          )}

          {importError && (
            <div style={{ border: `1px solid ${ind.ink}`, padding: '12px 14px', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <AlertCircle size={16} strokeWidth={1.5} style={{ flex: 'none', marginTop: 2, color: ind.ink }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <Kicker ind={ind} color={ind.ink}>{t('common.error', 'Error')}</Kicker>
                <p style={{ ...caption, marginTop: 4 }}>{importError}</p>
              </div>
              <Btn ind={ind} onClick={() => setImportError('')}>{t('common.close', 'Close')}</Btn>
            </div>
          )}

          {/* Title row — the only commit on the board sits here. */}
          <div className="flex flex-wrap items-end justify-between" style={{ gap: 14 }}>
            <div style={{ minWidth: 0 }}>
              <h1 style={{ fontFamily: BODY, fontSize: 32, fontWeight: 400, margin: 0, color: ind.ink, lineHeight: 1.1 }}>
                {t('settings.title', 'Settings')}
              </h1>
              <p style={{ ...caption, marginTop: 6 }}>
                {[
                  t('settings.subtitle', 'Manage your preferences and account settings'),
                  user?.email,
                  hasChanges
                    ? t('settings.nUnsaved', '{n} unsaved').replace('{n}', String(pending.length))
                    : t('settings.allSaved', 'All changes saved'),
                ].filter(Boolean).join(' · ')}
              </p>
            </div>

            <div className="flex flex-wrap items-center" style={{ gap: 8, flex: 'none' }}>
              <Btn ind={ind} onClick={exportSettings} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <Download size={13} strokeWidth={1.5} />
                {t('settings.export', 'Export')}
              </Btn>

              <label style={btnFace}>
                <Upload size={13} strokeWidth={1.5} />
                {t('settings.import', 'Import')}
                <input type="file" accept=".json" onChange={importSettings} className="sr-only" />
              </label>

              <Btn ind={ind} onClick={resetSettings} disabled={saving} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <RotateCcw size={13} strokeWidth={1.5} />
                {t('settings.reset', 'Reset')}
              </Btn>

              {/* The single solid object on this screen. Kept as a ShinyButton
                  so the commit still catches the light — re-skinned to the
                  system rather than replaced. */}
              <ShinyButton
                type="button"
                onClick={saveSettings}
                disabled={saving || !hasChanges}
                shineOnHover
                className="rounded-none border px-3 py-1"
                style={{
                  borderRadius: 0,
                  background: hasChanges ? ind.accent : 'transparent',
                  color: hasChanges ? ind.accentInk : ind.inkMuted,
                  borderColor: hasChanges ? ind.accent : ind.hairline,
                  opacity: saving ? 0.5 : 1,
                  cursor: hasChanges && !saving ? 'pointer' : 'not-allowed',
                }}
              >
                {saving
                  ? <Loader size={13} strokeWidth={1.5} className="animate-spin" />
                  : <Save size={13} strokeWidth={1.5} />}
                <span style={{ fontFamily: DISPLAY, fontWeight: 600, fontSize: 12.5, letterSpacing: '.04em', textTransform: 'uppercase' }}>
                  {hasChanges
                    ? t('settings.saveN', 'Save {n} changes').replace('{n}', String(pending.length))
                    : t('settings.nothingToSave', 'Nothing to save')}
                </span>
              </ShinyButton>
            </div>
          </div>

          {/* Two-level navigation: the section index beside the panel. */}
          <div className="flex flex-col md:flex-row" style={{ gap: 16, flex: 1, minHeight: 0 }}>
            <nav
              aria-label={t('settings.sections', 'Settings sections')}
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
                const active = s.num === panel.num;
                // A section with an unsaved row says so on the index.
                const dirty = s.rows.some((row) => pending.some((p) => p.key === row.key));
                return (
                  <button
                    key={s.num}
                    type="button"
                    onClick={() => setActiveSection(s.num)}
                    aria-current={active ? 'true' : undefined}
                    style={{
                      display: 'flex', alignItems: 'baseline', gap: 10,
                      padding: '8px 10px', textAlign: 'left', border: 'none', borderRadius: 0,
                      cursor: 'pointer',
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
                        textTransform: 'uppercase', flex: 1, minWidth: 0,
                      }}
                    >
                      {s.label}
                    </span>
                    {dirty && (
                      <span
                        aria-hidden="true"
                        style={{ width: 6, height: 6, flex: 'none', background: active ? ind.accentInk : ind.accent }}
                      />
                    )}
                  </button>
                );
              })}
            </nav>

            {/* The panel. Bottom padding is 6px: the last row's border closes it. */}
            <div className="flex-1 min-w-0">
              <Blueprint ind={ind} style={{ padding: '16px 20px 6px' }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
                  <span style={{ fontFamily: DISPLAY, fontWeight: 600, fontSize: 10, letterSpacing: '.16em', color: ind.accent }}>
                    {panel.num}
                  </span>
                  <span style={{ fontFamily: DISPLAY, fontWeight: 600, fontSize: 16, letterSpacing: '.06em', textTransform: 'uppercase', color: ind.ink }}>
                    {panel.label}
                  </span>
                  {/* No panel is scopeless. */}
                  <span style={{ fontFamily: BODY, fontSize: 11.5, color: ind.inkMuted }}>{panel.scope}</span>
                </div>

                {panel.rows
                  .filter((row) => !row.when || row.when(settings))
                  .map((row) => (
                    <div
                      key={row.key}
                      className="flex flex-wrap items-center justify-between"
                      style={{ gap: 20, padding: '11px 0', borderTop: `1px solid ${ind.rule}` }}
                    >
                      <div style={{ minWidth: 0, flex: '1 1 240px' }}>
                        <div style={{ fontFamily: BODY, fontSize: 13.5, color: ind.ink }}>{row.label}</div>
                        <p style={noteStyle}>{row.note}</p>
                      </div>
                      {renderControl(row)}
                    </div>
                  ))}
              </Blueprint>
            </div>
          </div>
        </div>

        {/* ── RIGHT — what is not saved yet, 340px ───────────────── */}
        <aside
          className="w-full lg:w-[340px] lg:shrink-0 flex flex-col"
          style={{ background: ind.chrome, overflow: 'hidden' }}
        >
          <div style={{ padding: '20px 20px 12px', borderBottom: `1px solid ${ind.hairline}` }}>
            <div className="flex items-baseline justify-between" style={{ gap: 10 }}>
              <ColumnHeading ind={ind}>{t('settings.unsavedChanges', 'Unsaved changes')}</ColumnHeading>
              <span style={{ fontFamily: DISPLAY, fontWeight: 600, fontSize: 12, color: ind.accent, whiteSpace: 'nowrap' }}>
                {t('settings.nItems', '{n} items').replace('{n}', String(pending.length))}
              </span>
            </div>
            <p style={columnNote}>{t('settings.nothingUntilSaved', 'Nothing takes effect until saved')}</p>
          </div>

          {pending.length === 0 && (
            <div style={{ padding: '16px 20px', borderBottom: `1px solid ${ind.rule}` }}>
              <p style={{ fontFamily: BODY, fontSize: 12.5, color: ind.inkMuted, lineHeight: 1.5 }}>
                {t('settings.queueEmpty', 'The draft and your saved settings agree. Change a row to open one.')}
              </p>
            </div>
          )}

          {pending.map((item) => (
            <div key={item.key} style={{ padding: '14px 20px', borderBottom: `1px solid ${ind.rule}` }}>
              <span
                className="block"
                style={{
                  fontFamily: DISPLAY, fontWeight: 600, fontSize: 14, letterSpacing: '.04em',
                  textTransform: 'uppercase', color: ind.ink,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}
              >
                {item.label}
              </span>

              {/* Size and ink carry the direction of the change. No red, no green. */}
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 9, margin: '7px 0 8px', flexWrap: 'wrap' }}>
                <span style={{ fontFamily: DISPLAY, fontWeight: 600, fontSize: 15, color: ind.ink, opacity: 0.45, textDecoration: 'line-through' }}>
                  {item.from}
                </span>
                <ArrowRight size={14} strokeWidth={1.5} style={{ flex: 'none', color: ind.ink, opacity: 0.45 }} />
                <span style={{ fontFamily: DISPLAY, fontWeight: 600, fontSize: 18, color: ind.ink }}>
                  {item.to}
                </span>
              </div>

              <Btn ind={ind} onClick={() => handleSettingChange(item.key, savedSettings[item.key])}>
                {t('settings.revert', 'Revert')}
              </Btn>
            </div>
          ))}

          {/* Account — the scope every row above is written against. */}
          <div style={{ padding: '18px 20px 12px', marginTop: 6, borderBottom: `1px solid ${ind.hairline}` }}>
            <ColumnHeading ind={ind}>{t('settings.account', 'Account')}</ColumnHeading>
          </div>
          {[
            { label: t('controlPanel.role', 'Role'), value: t(`controlPanel.roles.${user?.role}`, user?.role || '—') },
            { label: t('common.email', 'Email'), value: user?.email || '—' },
            { label: t('settings.language', 'Language'), value: (settings.language || currentLanguage || '').toUpperCase() },
            { label: t('settings.timezone', 'Timezone'), value: settings.timezone || 'UTC' },
          ].map((entry) => (
            <div
              key={entry.label}
              className="flex items-baseline justify-between"
              style={{ gap: 12, padding: '10px 20px', borderBottom: `1px solid ${ind.rule}` }}
            >
              <span style={{ fontFamily: BODY, fontSize: 12, color: ind.inkMuted, flex: 'none' }}>{entry.label}</span>
              <span
                style={{
                  fontFamily: DISPLAY, fontWeight: 600, fontSize: 12.5, color: ind.ink,
                  minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}
              >
                {entry.value}
              </span>
            </div>
          ))}
        </aside>
      </div>
    </div>
  );
};

/** Ticker values are short and tracked; a raw token is fine, empty is not. */
function formatShort(value) {
  if (value == null || value === '') return '—';
  return String(value).toUpperCase();
}

export default Settings;
