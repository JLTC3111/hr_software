/**
 * Industry design-system primitives.
 *
 * Component rules these enforce (§4 of the build spec):
 *   - Any card or figure is a <Blueprint>, which always draws exactly four
 *     registration corners. Never a frame without the marks, never a filled card.
 *   - A <Bar> is a hairline box with a coloured fill inside — not a coloured box.
 *   - <Tag> carries status through weight and rule. No red, no green.
 *   - Radius is 0 everywhere.
 *
 * Everything is styled inline against the token object from src/theme/industry.js
 * because these are exact hex values that do not exist in the Tailwind config.
 */
import _React, {
  Children,
  isValidElement,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { ChevronDown, MoreVertical } from 'lucide-react';
import { DISPLAY, BODY, kicker as kickerStyle } from '../../theme/industry.js';
import { useLanguage } from '../../contexts/LanguageContext.jsx';


/* ------------------------------------------------------------------ *
 * Blueprint frame
 * ------------------------------------------------------------------ */

const CORNER = 7;

export function Corner({ pos, color }) {
  const v = { position: 'absolute', width: CORNER, height: CORNER, pointerEvents: 'none' };
  const edge = `1px solid ${color}`;
  const map = {
    tl: { top: -1, left: -1, borderTop: edge, borderLeft: edge },
    tr: { top: -1, right: -1, borderTop: edge, borderRight: edge },
    bl: { bottom: -1, left: -1, borderBottom: edge, borderLeft: edge },
    br: { bottom: -1, right: -1, borderBottom: edge, borderRight: edge },
  };
  return <i aria-hidden="true" style={{ ...v, ...map[pos] }} />;
}

/**
 * The only card shape on the board. Outline + four registration marks.
 *
 * @param {object} ind    token set from getIndustry()
 * @param {boolean} tint  render the accent-tinted variant (max two per screen)
 */
export function Blueprint({ ind, tint = false, style, children, ...rest }) {
  return (
    <div
      {...rest}
      style={{
        position: 'relative',
        border: `1px solid ${ind.hairline}`,
        background: tint ? ind.accentWash : 'transparent',
        borderRadius: 0,
        ...style,
      }}
    >
      <Corner pos="tl" color={ind.ink} />
      <Corner pos="tr" color={ind.ink} />
      <Corner pos="bl" color={ind.ink} />
      <Corner pos="br" color={ind.ink} />
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Bar — hairline box with a fill inside
 * ------------------------------------------------------------------ */

/**
 * @param {number} value    0..1 share of the track to fill
 * @param {string} fill     colour, normally from rampAt(ind, rank)
 * @param {number} marker   optional 0..1 threshold, drawn as a 1px line
 */
export function Bar({ ind, value, fill, height = 8, marker = null, title }) {
  const pct = Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0)) * 100;
  return (
    <div
      title={title}
      style={{
        position: 'relative',
        height,
        border: `1px solid ${ind.hairline}`,
        borderRadius: 0,
        flex: 'none',
      }}
    >
      <div
        style={{
          width: `${pct}%`,
          height: '100%',
          background: fill || ind.accent,
          transition: 'width .45s ease',
        }}
      />
      {marker != null && (
        <span
          aria-hidden="true"
          style={{
            position: 'absolute',
            top: -2,
            bottom: -2,
            left: `${Math.max(0, Math.min(1, marker)) * 100}%`,
            width: 1,
            background: ind.ink,
          }}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Tag
 * ------------------------------------------------------------------ */

/**
 * variant: 'accent' = awaiting/normal · 'outline' = overdue/needs attention
 *          'neutral' = passive state
 */
export function Tag({ ind, variant = 'accent', children }) {
  const base = {
    display: 'inline-block',
    fontFamily: DISPLAY,
    fontWeight: 600,
    fontSize: 10,
    letterSpacing: '.12em',
    textTransform: 'uppercase',
    padding: '2px 6px',
    borderRadius: 0,
    lineHeight: 1.4,
    whiteSpace: 'nowrap',
  };
  const variants = {
    accent: { background: ind.accent, color: ind.accentInk, border: '1px solid transparent' },
    outline: { background: 'transparent', color: ind.ink, border: `1px solid ${ind.ink}` },
    neutral: { background: 'transparent', color: ind.inkMuted, border: `1px solid ${ind.hairline}` },
  };
  return <span style={{ ...base, ...variants[variant] }}>{children}</span>;
}

/* ------------------------------------------------------------------ *
 * Buttons — .btn-primary is the only solid object on the board
 * ------------------------------------------------------------------ */

export function Btn({ ind, variant = 'secondary', style, disabled, ...rest }) {
  const solid = variant === 'primary';
  return (
    <button
      type="button"
      disabled={disabled}
      {...rest}
      style={{
        fontFamily: DISPLAY,
        fontWeight: 600,
        fontSize: 12.5,
        letterSpacing: '.04em',
        textTransform: 'uppercase',
        padding: '4px 12px',
        borderRadius: 0,
        boxSizing: 'border-box',
        maxWidth: '100%',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        transition: 'background .15s ease, color .15s ease',
        background: solid ? ind.accent : 'transparent',
        color: solid ? ind.accentInk : ind.ink,
        border: `1px solid ${solid ? ind.accent : ind.hairline}`,
        ...style,
      }}
    />
  );
}

/* ------------------------------------------------------------------ *
 * MoreMenu — kebab for actions that do not fit a narrow band
 * ------------------------------------------------------------------ */

export function MoreMenu({ ind, label, items }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onPointer = (event) => {
      if (ref.current && !ref.current.contains(event.target)) setOpen(false);
    };
    const onEsc = (event) => { if (event.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onEsc);
    };
  }, [open]);

  return (
    <div ref={ref} style={{ position: 'relative', flex: 'none' }}>
      <button
        type="button"
        aria-label={label}
        aria-expanded={open}
        aria-haspopup="true"
        onClick={() => setOpen((value) => !value)}
        style={{
          width: 32,
          height: 32,
          display: 'grid',
          placeItems: 'center',
          padding: 0,
          background: 'transparent',
          border: `1px solid ${ind.hairline}`,
          borderRadius: 0,
          color: ind.ink,
          cursor: 'pointer',
        }}
      >
        <MoreVertical size={16} strokeWidth={1.5} />
      </button>
      {open && (
        <div
          role="menu"
          style={{
            position: 'absolute',
            top: '100%',
            right: 0,
            zIndex: 40,
            marginTop: 4,
            minWidth: 220,
            maxWidth: 'min(280px, 90vw)',
            background: ind.chrome,
            border: `1px solid ${ind.ink}`,
            borderRadius: 0,
            padding: 3,
          }}
        >
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.key}
                type="button"
                role="menuitem"
                disabled={item.disabled}
                onClick={() => {
                  if (item.disabled) return;
                  setOpen(false);
                  item.onClick?.();
                }}
                onMouseEnter={(event) => {
                  if (!item.disabled) event.currentTarget.style.background = ind.hover;
                }}
                onMouseLeave={(event) => {
                  event.currentTarget.style.background = 'transparent';
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 9,
                  width: '100%',
                  padding: '8px 10px',
                  border: 'none',
                  borderRadius: 0,
                  cursor: item.disabled ? 'not-allowed' : 'pointer',
                  opacity: item.disabled ? 0.5 : 1,
                  background: 'transparent',
                  color: ind.ink,
                  fontFamily: BODY,
                  fontSize: 13,
                  textAlign: 'left',
                }}
              >
                {Icon ? <Icon size={15} strokeWidth={1.5} style={{ flex: 'none' }} /> : null}
                <span style={{ flex: 1, minWidth: 0 }}>{item.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Seg — segmented filter
 * ------------------------------------------------------------------ */

export function Seg({ ind, options, value, onChange, ariaLabel }) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        maxWidth: '100%',
        minWidth: 0,
        border: `1px solid ${ind.hairline}`,
        borderRadius: 0,
        flex: 'none',
        boxSizing: 'border-box',
        overflow: 'hidden',
      }}
    >
      {options.map((opt) => {
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
              fontSize: 11.5,
              letterSpacing: '.08em',
              textTransform: 'uppercase',
              padding: '5px 12px',
              borderRadius: 0,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              flex: '1 1 auto',
              minWidth: 0,
              border: 'none',
              borderRight: `1px solid ${ind.hairline}`,
              borderBottom: `1px solid ${ind.hairline}`,
              margin: '0 -1px -1px 0',
              background: active ? ind.accent : 'transparent',
              color: active ? ind.accentInk : ind.inkMuted,
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
 * Kicker / Figure / Delta
 * ------------------------------------------------------------------ */

export function Kicker({ ind, color, style, children }) {
  return <div style={{ ...kickerStyle(color || ind.accent), ...style }}>{children}</div>;
}

/** ▲/▼ + value. Accent-deep for good, muted for neutral. */
export function Delta({ ind, direction = 'up', children, size = 11 }) {
  const up = direction === 'up';
  return (
    <span
      style={{
        fontFamily: DISPLAY,
        fontWeight: 600,
        fontSize: size,
        letterSpacing: '.04em',
        color: up ? ind.accentDeep : ind.inkMuted,
        fontVariantNumeric: 'tabular-nums',
        whiteSpace: 'nowrap',
      }}
    >
      {up ? '▲' : '▼'} {children}
    </span>
  );
}

/* ------------------------------------------------------------------ *
 * Ticker
 * ------------------------------------------------------------------ */

/**
 * One cell of the 44px ticker strip. Clickable cells get a hover wash so the
 * strip still advertises that it is the way into the detail modals.
 */
export function TickerCell({ ind, label, value, valueColor, delta, deltaDirection = 'up', onClick, title, children }) {
  const interactive = typeof onClick === 'function';
  const Tag_ = interactive ? 'button' : 'div';
  return (
    <Tag_
      {...(interactive ? { type: 'button', onClick, title } : { title })}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '0 16px',
        height: '100%',
        flex: 'none',
        borderRight: `1px solid ${ind.tickerRule}`,
        background: 'transparent',
        border: 'none',
        borderRightWidth: 1,
        borderRightStyle: 'solid',
        borderRightColor: ind.tickerRule,
        borderRadius: 0,
        color: ind.tickerInk,
        cursor: interactive ? 'pointer' : 'default',
        textAlign: 'left',
        whiteSpace: 'nowrap',
        transition: 'background .15s ease',
      }}
      onMouseEnter={interactive ? (e) => { e.currentTarget.style.background = 'rgba(242,242,243,.08)'; } : undefined}
      onMouseLeave={interactive ? (e) => { e.currentTarget.style.background = 'transparent'; } : undefined}
    >
      {children ?? (
        <>
          <span
            style={{
              fontFamily: DISPLAY,
              fontWeight: 600,
              fontSize: 10,
              letterSpacing: '.14em',
              textTransform: 'uppercase',
              opacity: 0.65,
            }}
          >
            {label}
          </span>
          <span
            style={{
              fontFamily: DISPLAY,
              fontWeight: 600,
              fontSize: 17,
              lineHeight: 1,
              fontVariantNumeric: 'tabular-nums',
              // Light steel singles out the one figure on the strip that needs
              // action; every other value stays the same paper white.
              color: valueColor,
            }}
          >
            {value}
          </span>
          {delta != null && delta !== '' && (
            <span
              style={{
                fontFamily: DISPLAY,
                fontWeight: 600,
                fontSize: 11,
                fontVariantNumeric: 'tabular-nums',
                color: deltaDirection === 'up' ? ind.tickerUp : undefined,
                opacity: deltaDirection === 'up' ? 1 : 0.6,
              }}
            >
              {deltaDirection === 'up' ? '▲' : '▼'} {delta}
            </span>
          )}
        </>
      )}
    </Tag_>
  );
}

/**
 * LIVE hh:mm:ss — the ticker's first cell is always the live indicator.
 * `live` drives the pulse square: accent when the screen is showing real data,
 * dimmed paper when it is not.
 */
export function LiveClock({ ind, live }) {
  const { t } = useLanguage();
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  const pad = (n) => String(n).padStart(2, '0');
  return (
    <>
      <span
        aria-hidden="true"
        style={{ width: 6, height: 6, background: live ? ind.tickerUp : 'rgba(242,242,243,.45)', flex: 'none' }}
      />
      <span style={{ fontFamily: DISPLAY, fontWeight: 600, fontSize: 10, letterSpacing: '.14em', opacity: 0.65 }}>
        {t('common.live', 'Live')}
      </span>
      {/*
        Set to the size of the LIVE label next to it, not the 17px of a
        TickerCell value. The wall clock is not a measurement of the business;
        at figure size it competed with the metrics either side of it for the
        one thing on the strip that changes every second.
      */}
      <span style={{ fontFamily: DISPLAY, fontWeight: 600, fontSize: 10, letterSpacing: '.06em', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
        {pad(now.getHours())}:{pad(now.getMinutes())}:{pad(now.getSeconds())}
      </span>
    </>
  );
}

/** Flat select styled to the system. `onDark` puts it on the ticker. */
export function FlatSelect({ ind, onDark = false, style, ...rest }) {
  const inkColor = onDark ? ind.tickerInk : ind.ink;
  return (
    <select
      {...rest}
      style={{
        fontFamily: DISPLAY,
        fontWeight: 600,
        fontSize: 12.5,
        letterSpacing: '.06em',
        textTransform: 'uppercase',
        color: inkColor,
        background: 'transparent',
        border: `1px solid ${onDark ? ind.tickerRule : ind.hairline}`,
        borderRadius: 0,
        padding: '3px 6px',
        cursor: 'pointer',
        ...style,
      }}
    />
  );
}

function optionLabelText(node) {
  if (node == null || typeof node === 'boolean') return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(optionLabelText).join('');
  if (isValidElement(node)) return optionLabelText(node.props?.children);
  return '';
}

function optionsFromChildren(children) {
  return Children.toArray(children).flatMap((child) => {
    if (!isValidElement(child)) return [];
    if (child.type === 'option') {
      return [{
        value: child.props.value == null ? '' : String(child.props.value),
        label: child.props.children,
        disabled: Boolean(child.props.disabled),
      }];
    }
    if (child.props?.children) return optionsFromChildren(child.props.children);
    return [];
  });
}

/**
 * Closed control matches FlatSelect; the open list is drawn in-app so it can
 * follow Industry tokens. Accepts the same `<option>` children as a `<select>`.
 */
export function FlatListbox({
  ind,
  onDark = false,
  style,
  value,
  onChange,
  id,
  disabled = false,
  children,
  options: optionsProp,
  'aria-label': ariaLabel,
  ...rest
}) {
  const inkColor = onDark ? ind.tickerInk : ind.ink;
  const autoId = useId();
  const listId = `${id || autoId}-list`;
  const rootRef = useRef(null);
  const buttonRef = useRef(null);
  const listRef = useRef(null);
  const searchRef = useRef('');
  const searchTimerRef = useRef(0);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const options = useMemo(
    () => (Array.isArray(optionsProp) ? optionsProp : optionsFromChildren(children)),
    [optionsProp, children],
  );

  const selectedIndex = options.findIndex((opt) => String(opt.value) === String(value));
  const selected = selectedIndex >= 0 ? options[selectedIndex] : options[0];

  useEffect(() => {
    if (!open) return undefined;
    const onPointer = (event) => {
      if (rootRef.current && !rootRef.current.contains(event.target)) setOpen(false);
    };
    const onEsc = (event) => {
      if (event.key !== 'Escape') return;
      setOpen(false);
      buttonRef.current?.focus();
    };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onEsc);
    };
  }, [open]);

  useLayoutEffect(() => {
    if (!open) return;
    setActiveIndex(selectedIndex >= 0 ? selectedIndex : 0);
    listRef.current?.focus();
  }, [open, selectedIndex]);

  useLayoutEffect(() => {
    if (!open) return;
    const el = listRef.current?.querySelector('[data-active="true"]');
    el?.scrollIntoView({ block: 'nearest' });
  }, [open, activeIndex]);

  useEffect(() => () => window.clearTimeout(searchTimerRef.current), []);

  const emit = (nextValue) => {
    onChange?.({ target: { value: nextValue } });
  };

  const moveActive = (direction) => {
    if (!options.length) return;
    let index = activeIndex;
    for (let step = 0; step < options.length; step += 1) {
      index = (index + direction + options.length) % options.length;
      if (!options[index]?.disabled) {
        setActiveIndex(index);
        return;
      }
    }
  };

  const choose = (index) => {
    const opt = options[index];
    if (!opt || opt.disabled) return;
    emit(opt.value);
    setOpen(false);
    buttonRef.current?.focus();
  };

  const onTypeahead = (key) => {
    searchRef.current += key.toLowerCase();
    window.clearTimeout(searchTimerRef.current);
    searchTimerRef.current = window.setTimeout(() => {
      searchRef.current = '';
    }, 500);
    const query = searchRef.current;
    const match = options.findIndex((opt) => (
      !opt.disabled && optionLabelText(opt.label).toLowerCase().startsWith(query)
    ));
    if (match >= 0) setActiveIndex(match);
  };

  const onKeyDown = (event) => {
    if (disabled) return;
    if (!open) {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp' || event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        setOpen(true);
      }
      return;
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      moveActive(1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      moveActive(-1);
    } else if (event.key === 'Home') {
      event.preventDefault();
      const first = options.findIndex((opt) => !opt.disabled);
      if (first >= 0) setActiveIndex(first);
    } else if (event.key === 'End') {
      event.preventDefault();
      for (let i = options.length - 1; i >= 0; i -= 1) {
        if (!options[i].disabled) {
          setActiveIndex(i);
          break;
        }
      }
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      choose(activeIndex);
    } else if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
      onTypeahead(event.key);
    }
  };

  return (
    <div
      ref={rootRef}
      style={{
        position: 'relative',
        width: style?.width,
        zIndex: open ? 50 : undefined,
      }}
    >
      <button
        {...rest}
        ref={buttonRef}
        type="button"
        id={id}
        disabled={disabled}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => { if (!disabled) setOpen((current) => !current); }}
        onKeyDown={onKeyDown}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          width: '100%',
          boxSizing: 'border-box',
          fontFamily: DISPLAY,
          fontWeight: 600,
          fontSize: 12.5,
          letterSpacing: '.06em',
          textTransform: 'uppercase',
          textAlign: 'left',
          color: inkColor,
          background: 'transparent',
          border: `1px solid ${onDark ? ind.tickerRule : ind.hairline}`,
          borderRadius: 0,
          padding: '3px 6px',
          cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.5 : 1,
          ...style,
        }}
      >
        <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {selected?.label ?? ''}
        </span>
        <ChevronDown
          size={13}
          strokeWidth={1.5}
          aria-hidden="true"
          style={{ flex: 'none', opacity: 0.6 }}
        />
      </button>
      {open ? (
        <div
          ref={listRef}
          id={listId}
          role="listbox"
          tabIndex={-1}
          aria-activedescendant={options[activeIndex] ? `${listId}-opt-${activeIndex}` : undefined}
          aria-label={ariaLabel}
          onKeyDown={onKeyDown}
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            zIndex: 60,
            marginTop: 4,
            maxHeight: 280,
            overflowY: 'auto',
            background: ind.chrome,
            border: `1px solid ${ind.ink}`,
            borderRadius: 0,
            padding: 3,
            outline: 'none',
          }}
        >
          {options.map((opt, index) => {
            const isSelected = String(opt.value) === String(value);
            const isActive = index === activeIndex;
            return (
              <button
                key={`${opt.value}-${index}`}
                type="button"
                id={`${listId}-opt-${index}`}
                role="option"
                tabIndex={-1}
                data-active={isActive ? 'true' : undefined}
                aria-selected={isSelected}
                disabled={opt.disabled}
                onMouseEnter={() => { if (!opt.disabled) setActiveIndex(index); }}
                onClick={() => choose(index)}
                style={{
                  display: 'block',
                  width: '100%',
                  padding: '6px 9px',
                  border: 'none',
                  borderRadius: 0,
                  cursor: opt.disabled ? 'not-allowed' : 'pointer',
                  opacity: opt.disabled ? 0.5 : 1,
                  background: isSelected ? ind.accent : isActive ? ind.hover : 'transparent',
                  color: isSelected ? ind.accentInk : ind.ink,
                  fontFamily: isSelected ? DISPLAY : BODY,
                  fontWeight: isSelected ? 600 : 400,
                  fontSize: 13,
                  letterSpacing: isSelected ? '.04em' : 0,
                  textTransform: 'none',
                  textAlign: 'left',
                }}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Misc
 * ------------------------------------------------------------------ */

/** Section header for the decision column. */
export function ColumnHeading({ ind, children, style }) {
  return (
    <div
      style={{
        fontFamily: DISPLAY,
        fontWeight: 600,
        fontSize: 16,
        letterSpacing: '.07em',
        textTransform: 'uppercase',
        color: ind.ink,
        ...style,
      }}
    >
      {children}
    </div>
  );
}
