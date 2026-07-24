import React, { useEffect, useState } from 'react';
import { useLanguage } from '../../contexts/LanguageContext.jsx';
import { isDemoMode } from '../../utils/demoHelper.js';
import {
  peekCachedTranslation,
  translateText,
} from '../../services/translateService.js';

/**
 * Auto-translate a single UGC string into the active UI language (1A).
 * Covers the original while a network translate is in flight; cache hits
 * resolve immediately with no flash.
 * Demo mode / empty text: returns original (callers use getDemo* for demo).
 *
 * @returns {{ text: string, isTranslating: boolean, original: string }}
 */
export function useTranslatedText(text, { enabled = true } = {}) {
  const { currentLanguage } = useLanguage();
  const original = text == null ? '' : String(text);

  const skip =
    !enabled || !original.trim() || isDemoMode();

  const cached = skip
    ? null
    : peekCachedTranslation(original, currentLanguage);

  const [translated, setTranslated] = useState(() =>
    skip ? original : cached ?? ''
  );
  const [isTranslating, setIsTranslating] = useState(
    () => !skip && cached == null
  );

  useEffect(() => {
    let cancelled = false;

    if (skip) {
      setTranslated(original);
      setIsTranslating(false);
      return undefined;
    }

    const hit = peekCachedTranslation(original, currentLanguage);
    if (hit != null) {
      setTranslated(hit);
      setIsTranslating(false);
      return undefined;
    }

    setTranslated('');
    setIsTranslating(true);

    translateText(original, currentLanguage).then((out) => {
      if (cancelled) return;
      setTranslated(typeof out === 'string' ? out : original);
      setIsTranslating(false);
    });

    return () => {
      cancelled = true;
    };
  }, [original, currentLanguage, enabled, skip]);

  return {
    text: isTranslating ? '' : translated || original,
    isTranslating,
    original,
  };
}

/**
 * Renders UGC text auto-translated to the current UI language.
 * While translating, shows a pulse skeleton sized to the original (original hidden).
 */
export function TranslatedText({
  text,
  as: Component = 'span',
  className,
  enabled = true,
  children,
  ...rest
}) {
  const { text: value, isTranslating, original } = useTranslatedText(
    text ?? children,
    { enabled }
  );

  if (isTranslating) {
    return (
      <Component
        className={className}
        aria-busy="true"
        aria-live="polite"
        {...rest}
      >
        <span
          className="inline rounded-sm bg-current/15 animate-pulse text-transparent select-none pointer-events-none whitespace-pre-wrap break-words"
          aria-hidden="true"
        >
          {original}
        </span>
      </Component>
    );
  }

  return (
    <Component className={className} {...rest}>
      {value}
    </Component>
  );
}

export default TranslatedText;
