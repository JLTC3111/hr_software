import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext.jsx';
import { useTheme } from '../../contexts/ThemeContext.jsx';
import { getIndustry, DISPLAY, BODY } from '../../theme/industry.js';
import { cn } from '@/lib/utils';

/** Map app language codes → BCP-47 locales for Intl. */
export const DATE_LOCALES = {
  en: 'en-US',
  de: 'de-DE',
  fr: 'fr-FR',
  es: 'es-ES',
  jp: 'ja-JP',
  kr: 'ko-KR',
  th: 'th-TH',
  vn: 'vi-VN',
  ru: 'ru-RU',
};

function parseISODate(value) {
  if (!value || typeof value !== 'string') return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  const d = Number(m[3]);
  const dt = new Date(y, mo, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== mo || dt.getDate() !== d) return null;
  return dt;
}

function toISODate(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function isSameDay(a, b) {
  return a && b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function buildMonthGrid(viewYear, viewMonth) {
  const first = new Date(viewYear, viewMonth, 1);
  const startWeekday = first.getDay(); // 0=Sun
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(viewYear, viewMonth, d));
  while (cells.length % 7 !== 0) cells.push(null);
  while (cells.length < 42) cells.push(null);
  return cells;
}

/**
 * Drop-in replacement for native <input type="date"> with a localized React calendar.
 * value / onChange use YYYY-MM-DD strings (same as native date inputs).
 *
 * `flat` switches trigger and calendar to the "Industry" grammar (src/theme/industry.js):
 * zero radius, hairline rules, transparent grounds, a 14px icon instead of 24px, and
 * squared day cells. Screens built on that system pass it so the field stops reading
 * like a rounded browser control dropped onto a drawing sheet.
 */
export function DatePicker({
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
  icon: Icon = CalendarIcon,
  flat = false,
}) {
  const { currentLanguage, t } = useLanguage();
  const { isDarkMode, bg, text, border } = useTheme();
  const ind = useMemo(() => getIndustry(isDarkMode), [isDarkMode]);
  const autoId = useId();
  const inputId = id || autoId;
  const rootRef = useRef(null);
  const panelRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [panelStyle, setPanelStyle] = useState({});

  const locale = DATE_LOCALES[currentLanguage] || 'en-US';
  const selected = useMemo(() => parseISODate(value), [value]);
  const minDate = useMemo(() => parseISODate(min), [min]);
  const maxDate = useMemo(() => parseISODate(max), [max]);

  const initialView = selected || startOfDay(new Date());
  const [viewYear, setViewYear] = useState(initialView.getFullYear());
  const [viewMonth, setViewMonth] = useState(initialView.getMonth());

  useEffect(() => {
    if (selected) {
      setViewYear(selected.getFullYear());
      setViewMonth(selected.getMonth());
    }
  }, [selected]);

  const monthLabel = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(
        new Date(viewYear, viewMonth, 1)
      ),
    [locale, viewYear, viewMonth]
  );

  const weekdayLabels = useMemo(() => {
    // Sunday-first to match grid
    const base = new Date(2024, 0, 7); // Sunday
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(base);
      d.setDate(base.getDate() + i);
      return new Intl.DateTimeFormat(locale, { weekday: 'short' }).format(d);
    });
  }, [locale]);

  const displayValue = useMemo(() => {
    if (!selected) return '';
    return new Intl.DateTimeFormat(locale, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }).format(selected);
  }, [selected, locale]);

  const emitChange = useCallback(
    (iso) => {
      if (!onChange) return;
      // Support both (value) and synthetic event handlers used across the app
      if (typeof onChange === 'function') {
        const eventLike = {
          target: { name: name || '', value: iso, type: 'date' },
          currentTarget: { name: name || '', value: iso, type: 'date' },
        };
        // Prefer event-style when handler arity suggests it; always pass event-like
        // so existing `e.target.value` / `e.target.name` keep working.
        onChange(eventLike);
      }
    },
    [onChange, name]
  );

  const isDisabledDay = useCallback(
    (day) => {
      if (!day) return true;
      const t0 = startOfDay(day).getTime();
      if (minDate && t0 < startOfDay(minDate).getTime()) return true;
      if (maxDate && t0 > startOfDay(maxDate).getTime()) return true;
      return false;
    },
    [minDate, maxDate]
  );

  const updatePosition = useCallback(() => {
    const el = rootRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const panelHeight = 320;
    const spaceBelow = window.innerHeight - rect.bottom;
    const openUp = spaceBelow < panelHeight && rect.top > spaceBelow;
    const width = Math.max(rect.width, 280);
    setPanelStyle({
      position: 'fixed',
      left: Math.min(rect.left, window.innerWidth - width - 8),
      top: openUp ? rect.top - panelHeight - 6 : rect.bottom + 6,
      width,
      zIndex: 9999,
    });
  }, []);

  useEffect(() => {
    if (!open) return;
    updatePosition();
    const onScroll = () => updatePosition();
    const onResize = () => updatePosition();
    const onPointer = (e) => {
      if (rootRef.current?.contains(e.target)) return;
      if (panelRef.current?.contains(e.target)) return;
      setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false);
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
  }, [open, updatePosition]);

  const cells = useMemo(() => buildMonthGrid(viewYear, viewMonth), [viewYear, viewMonth]);
  const today = startOfDay(new Date());

  const shiftMonth = (delta) => {
    const d = new Date(viewYear, viewMonth + delta, 1);
    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth());
  };

  const pickDay = (day) => {
    if (isDisabledDay(day)) return;
    emitChange(toISODate(day));
    setOpen(false);
  };

  const resolvedPlaceholder =
    placeholder || t('datePicker.placeholder', t('common.selectDate', 'Select date'));

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
        className={flat
          ? cn('w-full text-left appearance-none cursor-pointer focus:outline-none', disabled && 'cursor-not-allowed', inputClassName)
          : cn(
            'w-full px-3 py-2 pr-10 rounded-lg border text-left focus:ring-2 focus:ring-blue-500 focus:border-transparent focus:outline-none appearance-none cursor-pointer',
            bg?.primary || (isDarkMode ? 'bg-gray-800' : 'bg-white'),
            text?.primary || (isDarkMode ? 'text-white' : 'text-gray-900'),
            border?.primary || (isDarkMode ? 'border-gray-600' : 'border-gray-300'),
            disabled && 'opacity-50 cursor-not-allowed',
            inputClassName
          )}
        style={flat ? {
          fontFamily: BODY,
          fontSize: 13,
          color: displayValue ? ind.ink : ind.inkFaint,
          background: 'transparent',
          border: `1px solid ${ind.hairline}`,
          borderRadius: 0,
          padding: '6px 26px 6px 8px',
          opacity: disabled ? 0.5 : 1,
        } : undefined}
      >
        <span className={flat ? undefined : cn(!displayValue && (isDarkMode ? 'text-gray-400' : 'text-gray-500'))}>
          {displayValue || resolvedPlaceholder}
        </span>
      </button>
      {showIcon && (
        <Icon
          size={flat ? 14 : undefined}
          strokeWidth={flat ? 1.5 : undefined}
          className={flat
            ? 'absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none'
            : cn(
              'absolute right-3 top-1/2 -translate-y-1/2 w-6 h-6 pointer-events-none',
              text?.secondary || (isDarkMode ? 'text-gray-400' : 'text-gray-500')
            )}
          style={flat ? { color: ind.inkMuted } : undefined}
          aria-hidden="true"
        />
      )}
      {/* Keep value for forms without native required validation (avoids browser scroll-to-invalid) */}
      <input type="hidden" name={name} value={value || ''} readOnly tabIndex={-1} />

      {open &&
        createPortal(
          <div
            ref={panelRef}
            style={flat
              ? { ...panelStyle, background: ind.ground, border: `1px solid ${ind.ink}`, borderRadius: 0, padding: 12, color: ind.ink, fontFamily: BODY }
              : panelStyle}
            role="dialog"
            aria-modal="false"
            aria-label={t('datePicker.calendar', 'Calendar')}
            className={flat ? undefined : cn(
              'rounded-xl border shadow-xl p-3',
              isDarkMode ? 'bg-gray-900 border-gray-700 text-white' : 'bg-white border-gray-200 text-gray-900'
            )}
          >
            <div className="flex items-center justify-between mb-3 gap-2">
              <button
                type="button"
                className={cn(
                  'p-1.5 transition-colors',
                  flat ? 'rounded-none' : 'rounded-lg',
                  isDarkMode ? 'hover:bg-gray-800' : 'hover:bg-gray-100'
                )}
                onClick={() => shiftMonth(-1)}
                aria-label={t('datePicker.prevMonth', 'Previous month')}
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <div
                className={flat ? undefined : 'text-sm font-semibold capitalize'}
                style={flat
                  ? { fontFamily: DISPLAY, fontWeight: 600, fontSize: 13, letterSpacing: '.1em', textTransform: 'uppercase' }
                  : undefined}
              >
                {monthLabel}
              </div>
              <button
                type="button"
                className={cn(
                  'p-1.5 transition-colors',
                  flat ? 'rounded-none' : 'rounded-lg',
                  isDarkMode ? 'hover:bg-gray-800' : 'hover:bg-gray-100'
                )}
                onClick={() => shiftMonth(1)}
                aria-label={t('datePicker.nextMonth', 'Next month')}
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-7 gap-1 mb-1">
              {weekdayLabels.map((label, i) => (
                <div
                  key={`wd-${i}`}
                  className={cn(
                    'text-[11px] font-medium text-center py-1',
                    isDarkMode ? 'text-gray-400' : 'text-gray-500'
                  )}
                >
                  {label}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1">
              {cells.map((day, idx) => {
                if (!day) {
                  return <div key={`e-${idx}`} className="h-8" />;
                }
                const disabledDay = isDisabledDay(day);
                const selectedDay = isSameDay(day, selected);
                const isToday = isSameDay(day, today);
                return (
                  <button
                    key={toISODate(day)}
                    type="button"
                    disabled={disabledDay}
                    onClick={() => pickDay(day)}
                    className={cn(
                      'h-8 text-sm transition-colors',
                      flat ? 'rounded-none' : 'rounded-lg',
                      disabledDay && 'opacity-30 cursor-not-allowed',
                      !flat && selectedDay && 'bg-blue-600 text-white',
                      !selectedDay && !disabledDay && (isDarkMode ? 'hover:bg-gray-800' : 'hover:bg-gray-100'),
                      !flat && isToday && !selectedDay && (isDarkMode ? 'ring-1 ring-amber-500' : 'ring-1 ring-blue-400')
                    )}
                    style={flat ? {
                      fontFamily: DISPLAY,
                      fontWeight: 600,
                      fontVariantNumeric: 'tabular-nums',
                      background: selectedDay ? ind.accent : 'transparent',
                      color: selectedDay ? ind.accentInk : ind.ink,
                      border: isToday && !selectedDay ? `1px solid ${ind.hairline}` : '1px solid transparent',
                    } : undefined}
                  >
                    {day.getDate()}
                  </button>
                );
              })}
            </div>

            <div
              className={cn('flex items-center justify-between mt-3 pt-2 border-t', !flat && 'border-gray-200 dark:border-gray-700')}
              style={flat ? { borderTopColor: ind.hairline } : undefined}
            >
              <button
                type="button"
                className={cn(
                  'text-xs px-2 py-1',
                  flat ? 'rounded-none' : 'rounded-md',
                  isDarkMode ? 'hover:bg-gray-800 text-gray-300' : 'hover:bg-gray-100 text-gray-600'
                )}
                style={flat
                  ? { fontFamily: DISPLAY, fontWeight: 600, fontSize: 11, letterSpacing: '.1em', textTransform: 'uppercase', color: ind.accentDeep }
                  : undefined}
                onClick={() => {
                  const iso = toISODate(today);
                  if (minDate && startOfDay(today) < startOfDay(minDate)) return;
                  if (maxDate && startOfDay(today) > startOfDay(maxDate)) return;
                  emitChange(iso);
                  setOpen(false);
                }}
              >
                {t('datePicker.today', 'Today')}
              </button>
              <button
                type="button"
                className={cn(
                  'text-xs px-2 py-1',
                  flat ? 'rounded-none' : 'rounded-md',
                  isDarkMode ? 'hover:bg-gray-800 text-gray-300' : 'hover:bg-gray-100 text-gray-600'
                )}
                style={flat
                  ? { fontFamily: DISPLAY, fontWeight: 600, fontSize: 11, letterSpacing: '.1em', textTransform: 'uppercase', color: ind.accentDeep }
                  : undefined}
                onClick={() => {
                  emitChange('');
                  setOpen(false);
                }}
              >
                {t('datePicker.clear', 'Clear')}
              </button>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}

export default DatePicker;
