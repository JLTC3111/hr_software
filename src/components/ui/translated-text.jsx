import React, { useEffect, useState } from 'react';
import { useLanguage } from '../../contexts/LanguageContext.jsx';
import { isDemoMode } from '../../utils/demoHelper.js';
import {
  peekCachedTranslation,
  translateText,
} from '../../services/translateService.js';

/**
 * Auto-translate a single UGC string into the active UI language using the
 * browser's on-device translator.
 *
 * The original text renders immediately and is replaced in place if and when a
 * translation arrives — UGC is never hidden behind a placeholder, so browsers
 * without on-device translation simply show the text as written.
 *
 * @returns {{ text: string, isTranslating: boolean, original: string }}
 */
export function useTranslatedText(text, { enabled = true } = {}) {
  const { currentLanguage } = useLanguage();
  const original = text == null ? '' : String(text);

  const skip = !enabled || !original.trim() || isDemoMode();

  const [translated, setTranslated] = useState(
    () => (skip ? original : peekCachedTranslation(original, currentLanguage) ?? original)
  );
  const [isTranslating, setIsTranslating] = useState(false);

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

    // Show the original while the on-device model works.
    setTranslated(original);
    setIsTranslating(true);

    translateText(original, currentLanguage).then((out) => {
      if (cancelled) return;
      setTranslated(typeof out === 'string' && out ? out : original);
      setIsTranslating(false);
    });

    return () => {
      cancelled = true;
    };
  }, [original, currentLanguage, enabled, skip]);

  return { text: translated || original, isTranslating, original };
}

/** Renders UGC text, auto-translated to the current UI language when possible. */
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

  return (
    <Component
      className={className}
      title={value !== original ? original : undefined}
      data-translating={isTranslating ? 'true' : undefined}
      {...rest}
    >
      {value}
    </Component>
  );
}

export default TranslatedText;
