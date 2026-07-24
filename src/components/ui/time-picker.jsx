import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import useEmblaCarousel from 'embla-carousel-react';
import { Clock } from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext.jsx';
import { useTheme } from '../../contexts/ThemeContext.jsx';
import { cn } from '@/lib/utils';
import { DATE_LOCALES } from './date-picker.jsx';
import './time-picker.css';

const CIRCLE_DEGREES = 360;
const WHEEL_ITEM_SIZE = 32;
const WHEEL_ITEM_COUNT = 18;
const WHEEL_ITEMS_IN_VIEW = 4;

export const WHEEL_ITEM_RADIUS = CIRCLE_DEGREES / WHEEL_ITEM_COUNT;
export const IN_VIEW_DEGREES = WHEEL_ITEM_RADIUS * WHEEL_ITEMS_IN_VIEW;
export const WHEEL_RADIUS = Math.round(
  WHEEL_ITEM_SIZE / 2 / Math.tan(Math.PI / WHEEL_ITEM_COUNT)
);

const isInView = (wheelLocation, slidePosition) =>
  Math.abs(wheelLocation - slidePosition) < IN_VIEW_DEGREES;

const readVector = (vector) => {
  if (!vector) return 0;
  if (typeof vector.get === 'function') return vector.get();
  if (typeof vector.value === 'number') return vector.value;
  return 0;
};

const setSlideStyles = (emblaApi, index, loop, slideCount, totalRadius) => {
  const slideNode = emblaApi.slideNodes()[index];
  if (!slideNode) return;
  const snaps = emblaApi.scrollSnapList();
  if (snaps[index] == null) return;

  const wheelLocation = emblaApi.scrollProgress() * totalRadius;
  const positionDefault = snaps[index] * totalRadius;
  const positionLoopStart = positionDefault + totalRadius;
  const positionLoopEnd = positionDefault - totalRadius;

  let inView = false;
  let angle = index * -WHEEL_ITEM_RADIUS;

  if (isInView(wheelLocation, positionDefault)) {
    inView = true;
  }

  if (loop && isInView(wheelLocation, positionLoopEnd)) {
    inView = true;
    angle = -CIRCLE_DEGREES + (slideCount - index) * WHEEL_ITEM_RADIUS;
  }

  if (loop && isInView(wheelLocation, positionLoopStart)) {
    inView = true;
    angle = -(totalRadius % CIRCLE_DEGREES) - index * WHEEL_ITEM_RADIUS;
  }

  if (inView) {
    slideNode.style.opacity = '1';
    slideNode.style.transform = `translateY(-${index * 100}%) rotateX(${angle}deg) translateZ(${WHEEL_RADIUS}px)`;
  } else {
    slideNode.style.opacity = '0';
    slideNode.style.transform = 'none';
  }
};

export const setContainerStyles = (emblaApi, wheelRotation) => {
  emblaApi.containerNode().style.transform = `translateZ(${WHEEL_RADIUS}px) rotateX(${wheelRotation}deg)`;
};

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

/**
 * Embla iOS-style wheel for a single axis (hours or minutes).
 */
export function IosPickerItem({
  slideCount,
  perspective,
  label,
  loop = true,
  selectedIndex = 0,
  onSelect,
  formatLabel = (i) => pad2(i),
}) {
  const initialIndex = Math.min(Math.max(0, selectedIndex), Math.max(0, slideCount - 1));
  const [emblaRef, emblaApi] = useEmblaCarousel({
    loop,
    axis: 'y',
    dragFree: true,
    containScroll: false,
    watchSlides: false,
    align: 'center',
    startIndex: initialIndex,
  });
  const totalRadius = slideCount * WHEEL_ITEM_RADIUS;
  const rotationOffset = loop ? 0 : WHEEL_ITEM_RADIUS;
  const slides = useMemo(() => Array.from({ length: slideCount }, (_, i) => i), [slideCount]);
  const skipSync = useRef(false);
  const dragging = useRef(false);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  const inactivateEmblaTransform = useCallback((api) => {
    if (!api) return;
    const { translate, slideLooper } = api.internalEngine();
    translate.clear();
    translate.toggleActive(false);
    slideLooper.loopPoints.forEach(({ translate: slideTranslate }) => {
      slideTranslate.clear();
      slideTranslate.toggleActive(false);
    });
  }, []);

  const rotateWheel = useCallback(
    (api) => {
      if (!api) return;
      const rotation = slideCount * WHEEL_ITEM_RADIUS - rotationOffset;
      const wheelRotation = rotation * api.scrollProgress();
      setContainerStyles(api, wheelRotation);
      api.slideNodes().forEach((_, index) => {
        setSlideStyles(api, index, loop, slideCount, totalRadius);
      });
    },
    [slideCount, rotationOffset, totalRadius, loop]
  );

  useEffect(() => {
    if (!emblaApi) return;

    const onPointerDown = () => {
      dragging.current = true;
    };

    const onPointerUp = (api) => {
      const { scrollTo, target, location } = api.internalEngine();
      const diff = readVector(target) - readVector(location);
      const factor = Math.abs(diff) < WHEEL_ITEM_SIZE / 2.5 ? 10 : 0.1;
      scrollTo.distance(diff * factor, true);
      dragging.current = false;
    };

    const onSelectHandler = (api) => {
      if (skipSync.current) return;
      onSelectRef.current?.(api.selectedScrollSnap());
    };

    const onReInit = (api) => {
      inactivateEmblaTransform(api);
      rotateWheel(api);
    };

    const root = emblaApi.rootNode();
    const onWheel = (event) => {
      event.preventDefault();
      if (Math.abs(event.deltaY) < 1) return;
      if (event.deltaY > 0) emblaApi.scrollNext();
      else emblaApi.scrollPrev();
    };

    emblaApi.on('pointerDown', onPointerDown);
    emblaApi.on('pointerUp', onPointerUp);
    emblaApi.on('scroll', rotateWheel);
    emblaApi.on('select', onSelectHandler);
    emblaApi.on('reInit', onReInit);

    inactivateEmblaTransform(emblaApi);
    rotateWheel(emblaApi);

    // Ensure drag is bound after layout (portaled fixed panels can init early).
    const raf = requestAnimationFrame(() => {
      emblaApi.reInit();
      inactivateEmblaTransform(emblaApi);
      rotateWheel(emblaApi);
    });

    root?.addEventListener('wheel', onWheel, { passive: false });

    return () => {
      cancelAnimationFrame(raf);
      root?.removeEventListener('wheel', onWheel);
      emblaApi.off('pointerDown', onPointerDown);
      emblaApi.off('pointerUp', onPointerUp);
      emblaApi.off('scroll', rotateWheel);
      emblaApi.off('select', onSelectHandler);
      emblaApi.off('reInit', onReInit);
    };
  }, [emblaApi, inactivateEmblaTransform, rotateWheel]);

  // Sync external selected index → wheel (skip while user is dragging)
  useEffect(() => {
    if (!emblaApi || dragging.current) return;
    const current = emblaApi.selectedScrollSnap();
    if (current === selectedIndex) return;
    skipSync.current = true;
    emblaApi.scrollTo(selectedIndex, true);
    rotateWheel(emblaApi);
    requestAnimationFrame(() => {
      skipSync.current = false;
    });
  }, [emblaApi, selectedIndex, rotateWheel]);

  const handleSlideClick = (index) => {
    if (!emblaApi) return;
    emblaApi.scrollTo(index);
    onSelectRef.current?.(index);
  };

  return (
    <div className="hr-time-picker-ios">
      <div
        className={cn(
          'hr-time-picker-ios__scene',
          perspective === 'left' && 'hr-time-picker-ios__scene--left',
          perspective === 'right' && 'hr-time-picker-ios__scene--right'
        )}
        ref={emblaRef}
      >
        <div className="hr-time-picker-ios__container">
          {slides.map((index) => (
            <div
              className="hr-time-picker-ios__slide"
              key={index}
              onClick={() => handleSlideClick(index)}
              role="option"
              aria-selected={selectedIndex === index}
            >
              {formatLabel(index)}
            </div>
          ))}
        </div>
      </div>
      {label ? <div className="hr-time-picker-ios__label">{label}</div> : null}
    </div>
  );
}

/**
 * Drop-in replacement for native <input type="time">.
 * value / onChange use HH:mm (24h), same as native time inputs.
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

  const locale = DATE_LOCALES[currentLanguage] || 'en-US';
  const displayValue = useMemo(() => {
    if (!parsed) return '';
    const d = new Date();
    d.setHours(parsed.hours, parsed.minutes, 0, 0);
    return new Intl.DateTimeFormat(locale, {
      hour: 'numeric',
      minute: '2-digit',
      hour12: undefined,
    }).format(d);
  }, [parsed, locale]);

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
    const panelHeight = 320;
    const spaceBelow = window.innerHeight - rect.bottom;
    const openUp = spaceBelow < panelHeight && rect.top > spaceBelow;
    const width = Math.max(rect.width, 280);
    setPanelStyle({
      position: 'fixed',
      left: Math.min(rect.left, window.innerWidth - width - 8),
      top: openUp ? Math.max(8, rect.top - panelHeight - 6) : rect.bottom + 6,
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
      // Apply current wheel selection when dismissing by outside click
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

  return (
    <div ref={rootRef} className={cn('relative', className)}>
      <button
        type="button"
        id={inputId}
        disabled={disabled}
        aria-label={ariaLabel || resolvedPlaceholder}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => {
          if (disabled) return;
          if (open) commitDraft();
          else setOpen(true);
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
          aria-hidden="true"
        />
      )}
      <input type="hidden" name={name} value={value || ''} required={required} readOnly />

      {open &&
        createPortal(
          <div
            ref={panelRef}
            style={panelStyle}
            role="dialog"
            aria-modal="false"
            aria-label={t('timePicker.picker', 'Time picker')}
            className={cn(
              'hr-time-picker-panel rounded-xl border shadow-xl p-3',
              isDarkMode
                ? 'hr-time-picker-panel--dark bg-gray-900 border-gray-700'
                : 'bg-white border-gray-200'
            )}
          >
            <div className="hr-time-picker-embla">
              <IosPickerItem
                slideCount={24}
                perspective="left"
                loop
                label={t('timePicker.hours', 'hours')}
                selectedIndex={draftHours}
                onSelect={setDraftHours}
              />
              <IosPickerItem
                slideCount={60}
                perspective="right"
                loop
                label={t('timePicker.minutes', 'min')}
                selectedIndex={draftMinutes}
                onSelect={setDraftMinutes}
              />
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
                className={cn(
                  'text-xs px-3 py-1.5 rounded-md font-medium',
                  isDarkMode
                    ? 'bg-blue-600 hover:bg-blue-500 text-white'
                    : 'bg-blue-600 hover:bg-blue-700 text-white'
                )}
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
