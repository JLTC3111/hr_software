import { useEffect, useState } from 'react';

/**
 * A breakpoint as state rather than as a class.
 *
 * The Industry surfaces style themselves inline against the token object, and
 * an inline `display` always beats a Tailwind `lg:hidden` — so anything that
 * has to disappear at a breakpoint must be rendered conditionally instead of
 * hidden. This is that condition.
 *
 * @param {number} px  min-width in pixels
 */
export function useMinWidth(px) {
  const query = `(min-width: ${px}px)`;
  const [matches, setMatches] = useState(
    () => (typeof window === 'undefined' ? true : window.matchMedia(query).matches)
  );

  useEffect(() => {
    const mq = window.matchMedia(query);
    const onChange = (e) => setMatches(e.matches);
    setMatches(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [query]);

  return matches;
}

export default useMinWidth;
