import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Clock3, Coffee, X } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext.jsx';
import { useTheme } from '../contexts/ThemeContext.jsx';
import { usePunchSession } from '../contexts/PunchSessionContext.js';
import { dueBreakReminder, localDate, LUNCH_START, LUNCH_END, minutesToClock } from '../utils/punchSession.js';
import HrMascot from './HrMascot.jsx';
import './attendanceReminder.css';

const SNOOZE_MS = 10 * 60 * 1000;
const snoozeKey = (employeeId, session, phase, today) =>
  `hr.lunch-reminder.${employeeId}.${today}.${session?.clockIn}.${phase}`;
const readSnooze = key => { try { return Number(window.localStorage.getItem(key)) || 0; } catch { return 0; } };

export default function AttendanceReminder() {
  const { t, currentLanguage } = useLanguage();
  const { isDarkMode } = useTheme();
  const { employeeId, session, ready, busy, changeBreak } = usePunchSession();
  const navigate = useNavigate();
  const [now, setNow] = useState(() => new Date());
  const [manual, setManual] = useState(null);
  const [snoozed, setSnoozed] = useState({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);
  const dialog = useRef(null);
  const primary = useRef(null);
  const savingRef = useRef(false);
  const onBreak = session?.breaks.some(interval => interval.end == null);
  const phase = onBreak ? 'resume' : 'start';
  const today = localDate(now);
  const key = snoozeKey(employeeId, session, phase, today);
  const due = dueBreakReminder(session, now);
  const open = Boolean(employeeId && ready && session?.date === today
    && (manual === key || (due && now.getTime() >= (snoozed[key] ?? readSnooze(key)))));

  useEffect(() => {
    const update = () => setNow(new Date());
    const timer = window.setInterval(update, 15000);
    window.addEventListener('focus', update);
    document.addEventListener('visibilitychange', update);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', update);
      document.removeEventListener('visibilitychange', update);
    };
  }, []);

  const dismiss = useCallback(() => {
    if (savingRef.current) return;
    const until = Date.now() + SNOOZE_MS;
    try { window.localStorage.setItem(key, String(until)); } catch { /* memory fallback */ }
    setSnoozed(values => ({ ...values, [key]: until }));
    setManual(null);
    setError(false);
  }, [key]);

  useEffect(() => {
    if (!open) return undefined;
    const previousFocus = document.activeElement;
    const root = document.getElementById('root');
    const previousInert = root?.inert;
    const previousOverflow = document.body.style.overflow;
    if (root) root.inert = true;
    document.body.style.overflow = 'hidden';
    primary.current?.focus();
    const handleKey = event => {
      if (event.key === 'Escape') { event.preventDefault(); dismiss(); }
      if (event.key !== 'Tab') return;
      const focusable = [...dialog.current.querySelectorAll('button:not(:disabled), a[href]')];
      if (!focusable.length) { event.preventDefault(); dialog.current.focus(); return; }
      const first = focusable[0], last = focusable.at(-1);
      if (event.shiftKey && (document.activeElement === first || !dialog.current.contains(document.activeElement))) {
        event.preventDefault(); last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault(); first?.focus();
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('keydown', handleKey);
      if (root) root.inert = previousInert;
      document.body.style.overflow = previousOverflow;
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, [open, dismiss]);

  const act = async () => {
    if (savingRef.current || busy) return;
    savingRef.current = true;
    setSaving(true);
    setError(false);
    try {
      const result = await changeBreak(phase === 'start');
      if (!result.success) { setError(true); return; }
      setManual(null);
      setNow(new Date());
    } catch { setError(true); }
    finally { savingRef.current = false; setSaving(false); }
  };

  if (!employeeId) return null;
  const clock = new Intl.DateTimeFormat(currentLanguage === 'vn' ? 'vi' : currentLanguage === 'jp' ? 'ja' : currentLanguage === 'kr' ? 'ko' : currentLanguage,
    { hour: '2-digit', minute: '2-digit', hour12: false }).format(now);
  const title = onBreak ? t('attendanceReminder.resumeTitle', 'Ready to get back?') : t('attendanceReminder.lunchTitle', 'Time for a lunch break');
  return <>
    <button className={`hr-mascot-widget ${isDarkMode ? 'hr-reminder-dark' : ''}`} type="button"
      aria-label={t('attendanceReminder.open', 'Open attendance helper')} aria-haspopup="dialog"
      onClick={() => { setError(false); if (session) setManual(key); else navigate('/punch-clock'); }}>
      <HrMascot size={88} />
      <span><Clock3 size={13} aria-hidden="true" />{session
        ? onBreak ? t('attendanceReminder.onBreak', 'On break') : t('attendanceReminder.working', 'On the clock')
        : t('attendanceReminder.punchClock', 'Punch clock')}</span>
    </button>
    {open && createPortal(<div className={`hr-reminder-backdrop ${isDarkMode ? 'hr-reminder-dark' : ''}`}>
      <section className="hr-reminder-dialog" ref={dialog} role="dialog" aria-modal="true" tabIndex={-1}
        aria-labelledby="hr-reminder-title" aria-describedby="hr-reminder-description">
        <button className="hr-reminder-close" type="button" onClick={dismiss} disabled={saving}
          aria-label={t('attendanceReminder.close', 'Remind me later')}><X size={18} /></button>
        <div className="hr-reminder-art" aria-hidden="true">
          <div className="hr-reminder-orbit" />
          <HrMascot size={260} />
          <span className="hr-reminder-art-label">ICUE · HR</span>
        </div>
        <div className="hr-reminder-content">
          <span className="hr-reminder-kicker"><Coffee size={14} aria-hidden="true" />{t('attendanceReminder.kicker', 'A little time for you')}</span>
          <div className="hr-reminder-time">{clock}<span>{minutesToClock(LUNCH_START)} — {minutesToClock(LUNCH_END)}</span></div>
          <h2 id="hr-reminder-title">{title}</h2>
          <p id="hr-reminder-description">{onBreak
            ? t('attendanceReminder.resumeDescription', 'One tap ends your break and resumes your work timer.')
            : t('attendanceReminder.lunchDescription', 'Take a moment to recharge. One tap pauses your work timer and starts your break.')}</p>
          <div className="hr-reminder-status"><span />{onBreak
            ? t('attendanceReminder.paused', 'Work timer paused')
            : t('attendanceReminder.counting', 'Your work timer is running')}</div>
          {error && <p className="hr-reminder-error" role="alert">{t('attendanceReminder.error', 'Could not save the change. Check your connection and try again.')}</p>}
          <button className="hr-reminder-primary" type="button" ref={primary} disabled={saving || busy} onClick={act}>
            {saving ? t('attendanceReminder.saving', 'Saving…') : onBreak
              ? t('attendanceReminder.resume', 'Resume work') : t('attendanceReminder.start', 'Start lunch break')}
            <ArrowRight size={18} aria-hidden="true" />
          </button>
          <button className="hr-reminder-later" type="button" onClick={dismiss} disabled={saving}>
            {t('attendanceReminder.snooze', 'Remind me in 10 minutes')}
          </button>
          <span className="hr-reminder-footnote">{t('attendanceReminder.footnote', 'Break time is excluded from your worked hours.')}</span>
        </div>
      </section>
    </div>, document.body)}
  </>;
}
