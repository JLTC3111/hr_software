import { useCallback, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';

/**
 * Read the values a spec describes out of a URLSearchParams.
 *
 * A hand-edited, stale or bookmarked URL must not be able to put a screen into
 * a state it has no rendering for, so anything unreadable reads as absent and
 * takes the fallback.
 *
 * @param {Record<string, {key: string, fallback?: string|null, isValid?: (v: string) => boolean}>} spec
 * @param {URLSearchParams} searchParams
 */
export const resolveScreenValues = (spec, searchParams) => {
  const out = {};
  for (const [name, field] of Object.entries(spec)) {
    const raw = searchParams.get(field.key);
    const usable = raw !== null && raw !== '' && (!field.isValid || field.isValid(raw));
    out[name] = usable ? raw : (field.fallback ?? null);
  }
  return out;
};

/**
 * Apply a patch to a URLSearchParams, returning a new one.
 *
 * Empty and nullish values delete their key rather than writing `?tab=`, so the
 * landing view has a clean address. Keys outside `spec` are carried through
 * untouched, so this composes with other query state on the same screen.
 */
export const applyScreenPatch = (spec, previous, patch) => {
  const next = new URLSearchParams(previous);
  for (const [name, value] of Object.entries(patch)) {
    const field = spec[name];
    if (!field) continue;
    if (value === null || value === undefined || value === '') next.delete(field.key);
    else next.set(field.key, String(value));
  }
  return next;
};

/**
 * Screen state that belongs in the URL rather than in `useState`.
 *
 * Which tab a ledger is showing, and which row is opened, are *places*. People
 * expect Back to leave a detail view rather than the whole screen, a reload to
 * keep them where they were, and a pasted link to open what the sender was
 * looking at. Held in component state none of that works: Back walks out of the
 * app, a refresh drops the viewer on the landing view, and the link is useless.
 *
 * The setter takes a patch covering every key that moves together, because
 * `setSearchParams` is explicitly documented as *not* queueing — two calls in
 * one tick both read the same pre-update params and the second silently wins.
 * Anything that changes the tab and the opened row at once has to say so in a
 * single call.
 *
 * @param {Record<string, {
 *   key: string,
 *   fallback?: string | null,
 *   isValid?: (value: string) => boolean,
 * }>} spec  Declare this at module scope. A fresh object each render still
 *           behaves correctly, it just re-derives the value map every time.
 * @returns {[Record<string, string | null>, (patch: Record<string, unknown>, options?: {replace?: boolean}) => void]}
 */
export function useScreenNavigation(spec) {
  const [searchParams, setSearchParams] = useSearchParams();

  // Read through a ref so `go` keeps one identity for the life of the screen
  // and stays safe inside other useCallback/useEffect dependency lists.
  const specRef = useRef(spec);
  specRef.current = spec;

  const values = useMemo(() => resolveScreenValues(spec, searchParams), [spec, searchParams]);

  const go = useCallback((patch, { replace = false } = {}) => {
    setSearchParams(
      (previous) => applyScreenPatch(specRef.current, previous, patch),
      { replace },
    );
  }, [setSearchParams]);

  return [values, go];
}

export default useScreenNavigation;
