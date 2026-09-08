/**
 * Industry loading spinner — Lucide Loader + tracked DISPLAY label.
 * Radius 0, muted ink. Lives in its own module so a new named export is not
 * added to industry.jsx after that file is already linked in the browser.
 */
import { useEffect, useState } from 'react';
import { Loader } from 'lucide-react';
import { DISPLAY } from '../../theme/industry.js';
import { useLanguage } from '../../contexts/LanguageContext.jsx';

const SPINNER_SR_ONLY = {
  position: 'absolute',
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: 'hidden',
  clip: 'rect(0, 0, 0, 0)',
  whiteSpace: 'nowrap',
  border: 0,
};

const SPINNER_SIZES = {
  page: { icon: 18, minHeight: 280, padding: '48px 24px', delayMs: 200, showLabel: true },
  block: { icon: 18, minHeight: undefined, padding: '64px 24px', delayMs: 200, showLabel: true },
  inline: { icon: 13, minHeight: undefined, padding: 0, delayMs: 0, showLabel: false },
};

const prefersReducedMotion = () =>
  typeof globalThis.matchMedia === 'function'
  && globalThis.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * @param {object} ind
 * @param {'page'|'block'|'inline'} [size]
 * @param {string|false} [label]  defaults to t('common.loading'). false hides it.
 * @param {number} [delayMs]      defaults 200 for page/block, 0 for inline
 */
export function Spinner({ ind, size = 'block', label, delayMs, style }) {
  const { t } = useLanguage();
  const spec = SPINNER_SIZES[size] || SPINNER_SIZES.block;
  const wait = delayMs ?? spec.delayMs;
  const [visible, setVisible] = useState(wait <= 0);

  useEffect(() => {
    if (wait <= 0) {
      setVisible(true);
      return undefined;
    }
    const id = setTimeout(() => setVisible(true), wait);
    return () => clearTimeout(id);
  }, [wait]);

  const showLabel = label !== false && (spec.showLabel || typeof label === 'string');
  const text = typeof label === 'string' ? label : t('common.loading', 'Loading');
  const color = size === 'inline' ? 'currentColor' : ind.inkMuted;

  if (!visible) {
    return (
      <div role="status" aria-live="polite" aria-busy="true" style={SPINNER_SR_ONLY}>
        {text}
      </div>
    );
  }

  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      style={{
        display: size === 'inline' ? 'inline-flex' : 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: showLabel ? 12 : 0,
        minHeight: spec.minHeight,
        padding: spec.padding,
        ...style,
      }}
    >
      <Loader
        size={spec.icon}
        strokeWidth={1.5}
        className={prefersReducedMotion() ? undefined : 'animate-spin'}
        style={{ color, flex: 'none' }}
        aria-hidden="true"
      />
      {showLabel ? (
        <span
          style={{
            fontFamily: DISPLAY,
            fontWeight: 600,
            fontSize: 12.5,
            letterSpacing: '.12em',
            textTransform: 'uppercase',
            color: ind.inkMuted,
          }}
        >
          {text}
        </span>
      ) : (
        <span style={SPINNER_SR_ONLY}>{text}</span>
      )}
    </div>
  );
}
