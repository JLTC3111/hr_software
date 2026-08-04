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
import _React, { useState, useEffect } from 'react';
import { DISPLAY, BODY, kicker as kickerStyle } from '../../theme/industry.js';


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
 * Seg — segmented filter
 * ------------------------------------------------------------------ */

export function Seg({ ind, options, value, onChange, ariaLabel }) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      style={{ display: 'flex', border: `1px solid ${ind.hairline}`, borderRadius: 0, flex: 'none' }}
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
              fontSize: 11.5,
              letterSpacing: '.08em',
              textTransform: 'uppercase',
              padding: '5px 12px',
              borderRadius: 0,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              border: 'none',
              borderLeft: i === 0 ? 'none' : `1px solid ${ind.hairline}`,
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
        LIVE
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
