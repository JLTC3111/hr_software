import React, { useEffect, useState } from 'react';
import { useLanguage } from '../../contexts/LanguageContext.jsx';
import { isDemoMode } from '../../utils/demoHelper.js';
import {
  onTranslatorReady,
  peekCachedTranslation,
  translateWithStatus,
} from '../../services/translateService.js';

/**
 * A language pack can take a while to download, and the first attempts resolve
 * to the original text meanwhile. Retry on a backoff instead of waiting for the
 * element to remount — that is what made translations need "a few tries".
 */
const RETRY_DELAYS_MS = [600, 1500, 3000, 6000, 12000];

/**
 * Auto-translate a single UGC string into the active UI language using the
 * browser's on-device translator.
 *
 * The original text renders immediately and is replaced in place if and when a
 * translation arrives — UGC is never hidden behind a placeholder, so browsers
 * without on-device translation simply show the text as written.
 *
 * Passing `record` ({ entityType, entityId, field }) opts the string into the
 * hand-authored overrides in hr_ugc_translations: an editor's wording for that
 * exact field wins over both the shared text index and the on-device model.
 *
 * @returns {{ text: string, isTranslating: boolean, original: string }}
 */
export function useTranslatedText(text, { enabled = true, record = null } = {}) {
  const { currentLanguage } = useLanguage();
  const original = text == null ? '' : String(text);

  const skip = !enabled || !original.trim() || isDemoMode();

  // Identity, not the object: callers write record={{...}} inline, and a fresh
  // object every render would restart the effect on every render.
  const recordId = record
    ? `${record.entityType}:${record.entityId}:${record.field}`
    : '';
  const lookup = recordId ? record : null;

  const [translated, setTranslated] = useState(
    () => (skip ? original : peekCachedTranslation(original, currentLanguage, lookup) ?? original)
  );
  const [isTranslating, setIsTranslating] = useState(false);

  useEffect(() => {
    let cancelled = false;

    if (skip) {
      setTranslated(original);
      setIsTranslating(false);
      return undefined;
    }

    const hit = peekCachedTranslation(original, currentLanguage, lookup);
    if (hit != null) {
      setTranslated(hit);
      setIsTranslating(false);
      return undefined;
    }

    // Show the original while the on-device model works.
    setTranslated(original);
    setIsTranslating(true);

    let attempt = 0;
    let timer;

    const attemptTranslation = () => {
      translateWithStatus(original, currentLanguage, lookup).then(({ text: out, status }) => {
        if (cancelled) return;
        setTranslated(typeof out === 'string' && out ? out : original);

        if (status === 'pending' && attempt < RETRY_DELAYS_MS.length) {
          // Model isn't ready yet — keep the original on screen and try again.
          timer = setTimeout(attemptTranslation, RETRY_DELAYS_MS[attempt]);
          attempt += 1;
          return;
        }
        setIsTranslating(false);
      });
    };

    attemptTranslation();

    // A pack finishing its download is the real signal; retry immediately.
    const unsubscribe = onTranslatorReady(() => {
      if (cancelled) return;
      clearTimeout(timer);
      attempt = 0;
      attemptTranslation();
    });

    return () => {
      cancelled = true;
      clearTimeout(timer);
      unsubscribe();
    };
    // `lookup` is intentionally absent: it is a new object literal on every
    // render, and `recordId` is its stable value-equal stand-in.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [original, currentLanguage, enabled, skip, recordId]);

  return { text: translated || original, isTranslating, original };
}

/** Renders UGC text, auto-translated to the current UI language when possible. */
export function TranslatedText({
  text,
  as: Component = 'span',
  className,
  enabled = true,
  record = null,
  children,
  ...rest
}) {
  const { text: value, isTranslating, original } = useTranslatedText(
    text ?? children,
    { enabled, record }
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
