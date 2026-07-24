import React, { useEffect, useState } from 'react';
import { useLanguage } from '../../contexts/LanguageContext.jsx';
import { isDemoMode } from '../../utils/demoHelper.js';
import { translateText } from '../../services/translateService.js';

/**
 * Auto-translate a single UGC string into the active UI language (1A).
 * Shows original immediately; swaps when translation arrives.
 * Demo mode / empty text: returns original via t/demo callers — this component
 * only handles live UGC text fields (never names/emails/phones).
 */
export function useTranslatedText(text, { enabled = true } = {}) {
  const { currentLanguage } = useLanguage();
  const original = text == null ? '' : String(text);
  const [translated, setTranslated] = useState(original);

  useEffect(() => {
    let cancelled = false;
    setTranslated(original);

    if (!enabled || !original.trim() || isDemoMode()) {
      return undefined;
    }

    // Skip network when UI is English and text is mostly ASCII Latin —
    // edge still may translate; we always request except empty.
    translateText(original, currentLanguage).then((out) => {
      if (!cancelled && typeof out === 'string') setTranslated(out);
    });

    return () => {
      cancelled = true;
    };
  }, [original, currentLanguage, enabled]);

  return translated;
}

/**
 * Renders UGC text auto-translated to the current UI language.
 */
export function TranslatedText({
  text,
  as: Component = 'span',
  className,
  enabled = true,
  children,
  ...rest
}) {
  const value = useTranslatedText(text ?? children, { enabled });
  return (
    <Component className={className} {...rest}>
      {value}
    </Component>
  );
}

export default TranslatedText;
