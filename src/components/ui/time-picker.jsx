import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Clock } from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext.jsx';
import { useTheme } from '../../contexts/ThemeContext.jsx';
import { cn } from '@/lib/utils';
import { DATE_LOCALES } from './date-picker.jsx';

function pad2(n) {
  return String(n).padStart(2, '0');
}

function parseHHMM(value) {
  if (!value || typeof value !== 'string') return null;
  const m = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  return { hours: h, minutes: min };
}

function toHHMM(hours, minutes) {
  return `${pad2(hours)}:${pad2(minutes)}`;
}

function minutesOfDay(h, m) {
  return h * 60 + m;
}

function clampToBounds(hours, minutes, min, max) {
  let total = minutesOfDay(hours, minutes);
  if (min) {
    const parsed = parseHHMM(min);
    if (parsed) total = Math.max(total, minutesOfDay(parsed.hours, parsed.minutes));
  }
  if (max) {
    const parsed = parseHHMM(max);
    if (parsed) total = Math.min(total, minutesOfDay(parsed.hours, parsed.minutes));
  }
  return {
    hours: Math.floor(total / 60) % 24,
    minutes: total % 60,
  };
}

function usesHour12(locale) {
  try {
    return Boolean(
      new Intl.DateTimeFormat(locale, { hour: 'numeric' }).resolvedOptions().hour12
    );
  } catch {
    return false;
  }
}

function to12Hour(hours24) {
  const period = hours24 >= 12 ? 'pm' : 'am';
  let hour12 = hours24 % 12;
  if (hour12 === 0) hour12 = 12;
  return { hour12, period };
}

function from12Hour(hour12, period) {
  let h = hour12 % 12;
  if (period === 'pm') h += 12;
  return h;
}

function WheelColumn({
  items,
  value,
  onChange,
  label,
  isDarkMode,
  formatItem = (v) => String(v),
}) {
  const listRef = useRef(null);

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const idx = items.findIndex((item) => item === value);
    if (idx < 0) return;
    const child = el.children[idx];
    if (!child) return;
    // Scroll only inside the wheel list — never scrollIntoView (that jumps the page)
    const top =
      child.offsetTop - el.clientHeight / 2 + child.clientHeight / 2;
    el.scrollTop = Math.max(0, top);
  }, [value, items]);

  return (
    <div className="flex flex-col items-center min-w-[4.5rem] flex-1">
      {label ? (
        <div
          className={cn(
            'text-[11px] font-semibold uppercase tracking-wide mb-1',
            isDarkMode ? 'text-gray-400' : 'text-gray-500'
          )}
        >
          {label}
        </div>
      ) : null}
      <div
        ref={listRef}
        className={cn(
          'h-40 w-full overflow-y-auto rounded-lg border snap-y snap-mandatory',
          isDarkMode ? 'border-gray-700 bg-gray-950/40' : 'border-gray-200 bg-gray-50'
        )}
        role="listbox"
        aria-label={label}
      >
        {items.map((item) => {
          const selected = item === value;
          return (
            <button
              key={String(item)}
              type="button"
              role="option"
              aria-selected={selected}
              onClick={() => onChange(item)}
              className={cn(
                'w-full py-2 text-sm snap-center tabular-nums transition-colors',
                selected
                  ? 'bg-blue-600 text-white font-semibold'
                  : isDarkMode
                    ? 'text-gray-300 hover:bg-gray-800'
                    : 'text-gray-800 hover:bg-gray-100'
              )}
            >
              {formatItem(item)}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Locale-aware React time picker (HH:mm storage).
 * Uses 12h + AM/PM when the active locale prefers hour12; otherwise 24h.
 */
export function TimePicker({
  value = '',
  onChange,
  name,
  id,
  min,
  max,
  disabled = false,
  required = false,
  className = '',
  inputClassName = '',
  placeholder,
  'aria-label': ariaLabel,
  showIcon = true,
  icon: Icon = Clock,
  allowClear = true,
  defaultOpenTime = '09:00',
}) {
  const { currentLanguage, t } = useLanguage();
  const { isDarkMode, bg, text, border } = useTheme();
  const autoId = useId();
  const inputId = id || autoId;
  const rootRef = useRef(null);
  const panelRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [panelStyle, setPanelStyle] = useState({});

  const locale = DATE_LOCALES[currentLanguage] || 'en-US';
  const hour12 = useMemo(() => usesHour12(locale), [locale]);

  const parsed = useMemo(() => parseHHMM(value), [value]);
  const seed = useMemo(
    () => parsed || parseHHMM(defaultOpenTime) || { hours: 9, minutes: 0 },
    [parsed, defaultOpenTime]
  );

  const [draftHours, setDraftHours] = useState(seed.hours);
  const [draftMinutes, setDraftMinutes] = useState(seed.minutes);
  const draftRef = useRef({ hours: seed.hours, minutes: seed.minutes });
  draftRef.current = { hours: draftHours, minutes: draftMinutes };

  useEffect(() => {
    if (!open) return;
    const next = clampToBounds(seed.hours, seed.minutes, min, max);
    setDraftHours(next.hours);
    setDraftMinutes(next.minutes);
  }, [open, seed.hours, seed.minutes, min, max]);

  const displayValue = useMemo(() => {
    if (!parsed) return '';
    const d = new Date();
    d.setHours(parsed.hours, parsed.minutes, 0, 0);
    return new Intl.DateTimeFormat(locale, {
      hour: 'numeric',
      minute: '2-digit',
    }).format(d);
  }, [parsed, locale]);

  const periodLabels = useMemo(() => {
    const amDate = new Date(2000, 0, 1, 0, 0);
    const pmDate = new Date(2000, 0, 1, 12, 0);
    const fmt = new Intl.DateTimeFormat(locale, { hour: 'numeric', hour12: true });
    const pickPeriod = (date) => {
      const parts = fmt.formatToParts(date);
      return parts.find((p) => p.type === 'dayPeriod')?.value || null;
    };
    return {
      am: pickPeriod(amDate) || 'AM',
      pm: pickPeriod(pmDate) || 'PM',
    };
  }, [locale]);

  const emitChange = useCallback(
    (hhmm) => {
      if (!onChange) return;
      onChange({
        target: { name: name || '', value: hhmm, type: 'time' },
        currentTarget: { name: name || '', value: hhmm, type: 'time' },
      });
    },
    [onChange, name]
  );

  const commitDraft = useCallback(() => {
    const { hours, minutes } = draftRef.current;
    const clamped = clampToBounds(hours, minutes, min, max);
    emitChange(toHHMM(clamped.hours, clamped.minutes));
    setOpen(false);
  }, [min, max, emitChange]);

  const updatePosition = useCallback(() => {
    const el = rootRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const panelHeight = 280;
    const spaceBelow = window.innerHeight - rect.bottom;
    const openUp = spaceBelow < panelHeight && rect.top > spaceBelow;
    const width = Math.max(rect.width, hour12 ? 300 : 240);
    setPanelStyle({
      position: 'fixed',
      left: Math.min(rect.left, window.innerWidth - width - 8),
      top: openUp ? Math.max(8, rect.top - panelHeight - 6) : rect.bottom + 6,
      width,
      zIndex: 9999,
    });
  }, [hour12]);

  useEffect(() => {
    if (!open) return;
    updatePosition();
    const onScroll = () => updatePosition();
    const onResize = () => updatePosition();
    const onPointer = (e) => {
      if (rootRef.current?.contains(e.target)) return;
      if (panelRef.current?.contains(e.target)) return;
      commitDraft();
    };
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false);
      if (e.key === 'Enter') commitDraft();
    };
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onResize);
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onResize);
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, updatePosition, commitDraft]);

  const resolvedPlaceholder =
    placeholder || t('timePicker.placeholder', '--:--');

  const hours24 = useMemo(() => Array.from({ length: 24 }, (_, i) => i), []);
  const hours12List = useMemo(() => Array.from({ length: 12 }, (_, i) => i + 1), []);
  const minutesList = useMemo(() => Array.from({ length: 60 }, (_, i) => i), []);
  const draft12 = to12Hour(draftHours);

  const setFrom12 = (hour12Val, period) => {
    setDraftHours(from12Hour(hour12Val, period));
  };

  return (
    <div ref={rootRef} className={cn('relative', className)}>
      <button
        type="button"
        id={inputId}
        disabled={disabled}
        aria-label={ariaLabel || resolvedPlaceholder}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-required={required || undefined}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (disabled) return;
          setOpen((v) => !v);
        }}
        className={cn(
          'w-full px-3 py-2 pr-10 rounded-lg border text-left focus:ring-2 focus:ring-blue-500 focus:border-transparent focus:outline-none appearance-none cursor-pointer',
          bg?.primary || (isDarkMode ? 'bg-gray-800' : 'bg-white'),
          text?.primary || (isDarkMode ? 'text-white' : 'text-gray-900'),
          border?.primary || (isDarkMode ? 'border-gray-600' : 'border-gray-300'),
          disabled && 'opacity-50 cursor-not-allowed',
          inputClassName
        )}
      >
        <span className={cn(!displayValue && (isDarkMode ? 'text-gray-400' : 'text-gray-500'))}>
          {displayValue || resolvedPlaceholder}
        </span>
      </button>
      {showIcon && (
        <Icon
          className={cn(
            'absolute right-3 top-1/2 -translate-y-1/2 w-6 h-6 pointer-events-none',
            text?.secondary || (isDarkMode ? 'text-gray-400' : 'text-gray-500')
          )}
          isDarkMode={isDarkMode}
          aria-hidden="true"
        />
      )}
      {/* Keep value for forms without native required validation (avoids browser scroll-to-invalid) */}
      <input type="hidden" name={name} value={value || ''} readOnly tabIndex={-1} />

      {open &&
        createPortal(
          <div
            ref={panelRef}
            style={panelStyle}
            role="dialog"
            aria-modal="false"
            aria-label={t('timePicker.picker', 'Time picker')}
            className={cn(
              'rounded-xl border shadow-xl p-3',
              isDarkMode ? 'bg-gray-900 border-gray-700 text-white' : 'bg-white border-gray-200 text-gray-900'
            )}
          >
            <div className="flex gap-2 items-stretch">
              {hour12 ? (
                <>
                  <WheelColumn
                    items={hours12List}
                    value={draft12.hour12}
                    onChange={(h) => setFrom12(h, draft12.period)}
                    label={t('timePicker.hours', 'hours')}
                    isDarkMode={isDarkMode}
                    formatItem={(n) => pad2(n)}
                  />
                  <WheelColumn
                    items={minutesList}
                    value={draftMinutes}
                    onChange={setDraftMinutes}
                    label={t('timePicker.minutes', 'min')}
                    isDarkMode={isDarkMode}
                    formatItem={(n) => pad2(n)}
                  />
                  <WheelColumn
                    items={['am', 'pm']}
                    value={draft12.period}
                    onChange={(period) => setFrom12(draft12.hour12, period)}
                    label={t('timePicker.period', 'AM/PM')}
                    isDarkMode={isDarkMode}
                    formatItem={(p) => (p === 'am' ? periodLabels.am : periodLabels.pm)}
                  />
                </>
              ) : (
                <>
                  <WheelColumn
                    items={hours24}
                    value={draftHours}
                    onChange={setDraftHours}
                    label={t('timePicker.hours', 'hours')}
                    isDarkMode={isDarkMode}
                    formatItem={(n) => pad2(n)}
                  />
                  <WheelColumn
                    items={minutesList}
                    value={draftMinutes}
                    onChange={setDraftMinutes}
                    label={t('timePicker.minutes', 'min')}
                    isDarkMode={isDarkMode}
                    formatItem={(n) => pad2(n)}
                  />
                </>
              )}
            </div>

            <div
              className={cn(
                'flex items-center justify-between mt-3 pt-2 border-t',
                isDarkMode ? 'border-gray-700' : 'border-gray-200'
              )}
            >
              {allowClear ? (
                <button
                  type="button"
                  className={cn(
                    'text-xs px-2 py-1 rounded-md',
                    isDarkMode ? 'hover:bg-gray-800 text-gray-300' : 'hover:bg-gray-100 text-gray-600'
                  )}
                  onClick={() => {
                    emitChange('');
                    setOpen(false);
                  }}
                >
                  {t('timePicker.clear', 'Clear')}
                </button>
              ) : (
                <span />
              )}
              <button
                type="button"
                className="text-xs px-3 py-1.5 rounded-md font-medium bg-blue-600 hover:bg-blue-700 text-white"
                onClick={commitDraft}
              >
                {t('timePicker.done', 'Done')}
              </button>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}

export default TimePicker;
