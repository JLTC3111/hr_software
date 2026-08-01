import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import * as flubber from 'flubber';

/**
 * Shared flubber icon morpher.
 *
 * Replaces fourteen near-identical copies that each carried two costs:
 *
 * 1. Every instance kept a hidden copy of its *entire* icon set mounted for the
 *    life of the page, purely so it could read static SVG path geometry. On a
 *    table that meant N rows x M icons of permanently mounted, invisible DOM.
 *    Geometry never changes, so it is extracted once per icon set into a
 *    module-level cache and the scratch DOM is dropped immediately after.
 * 2. The auto-cycle interval listed `currentIconIndex` in its dependencies, so
 *    it was torn down and rebuilt on every single morph. The index now lives in
 *    a ref and the timer is created once.
 */

// icon-set signature -> path data for each icon
const pathCache = new Map();

const convertShapeToPath = (element) => {
  const tag = element.tagName.toLowerCase();

  if (tag === 'circle') {
    const cx = parseFloat(element.getAttribute('cx'));
    const cy = parseFloat(element.getAttribute('cy'));
    const r = parseFloat(element.getAttribute('r'));
    return `M ${cx - r},${cy} a ${r},${r} 0 1,0 ${r * 2},0 a ${r},${r} 0 1,0 ${-r * 2},0`;
  }

  if (tag === 'line') {
    return `M ${element.getAttribute('x1')},${element.getAttribute('y1')} L ${element.getAttribute('x2')},${element.getAttribute('y2')}`;
  }

  if (tag === 'rect') {
    const x = parseFloat(element.getAttribute('x') || 0);
    const y = parseFloat(element.getAttribute('y') || 0);
    const w = parseFloat(element.getAttribute('width'));
    const h = parseFloat(element.getAttribute('height'));
    return `M ${x},${y} L ${x + w},${y} L ${x + w},${y + h} L ${x},${y + h} Z`;
  }

  if (tag === 'polyline' || tag === 'polygon') {
    const points = element.getAttribute('points').trim().split(/\s+/);
    const cmds = points.map((p, i) => {
      const [x, y] = p.split(',');
      return `${i === 0 ? 'M' : 'L'} ${x},${y}`;
    });
    if (tag === 'polygon') cmds.push('Z');
    return cmds.join(' ');
  }

  return null;
};

const extractPathsFromIcon = (iconElement) => {
  const svg = iconElement?.querySelector('svg');
  if (!svg) return [];

  return Array.from(svg.querySelectorAll('path, circle, line, rect, polyline, polygon'))
    .map((element) =>
      element.tagName.toLowerCase() === 'path'
        ? element.getAttribute('d')
        : convertShapeToPath(element)
    )
    .filter(Boolean);
};

/** Pad both path lists to equal length, then build one interpolator per path. */
const buildInterpolators = (fromPaths, toPaths, maxSegmentLength) => {
  try {
    const maxPaths = Math.max(fromPaths.length, toPaths.length);
    const from = [...fromPaths];
    const to = [...toPaths];
    while (from.length < maxPaths) from.push(from[from.length - 1]);
    while (to.length < maxPaths) to.push(to[to.length - 1]);
    return from.map((d, i) => flubber.interpolate(d, to[i], { maxSegmentLength }));
  } catch {
    return [
      flubber.interpolate(fromPaths.join(' '), toPaths.join(' '), { maxSegmentLength }),
    ];
  }
};

const easeInOutQuad = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

export const FlubberMorphIcon = ({
  icons,
  cacheKey,
  size = 24,
  className = '',
  isDarkMode = false,
  /** 'cycle' loops forever, 'once' plays a single morph, 'index' is controlled. */
  mode = 'cycle',
  index,
  startDelay = 1000,
  morphInterval = 1000,
  morphDuration = 500,
  maxSegmentLength = 2,
  getColor,
}) => {
  const [cachedPaths, setCachedPaths] = useState(() => pathCache.get(cacheKey) ?? null);
  const [currentIconIndex, setCurrentIconIndex] = useState(0);
  const [morphPaths, setMorphPaths] = useState([]);

  const iconRefs = useRef({});
  const frameRef = useRef(null);
  const timerRef = useRef(null);
  const isAnimatingRef = useRef(false);
  const indexRef = useRef(0);
  const pathsRef = useRef(cachedPaths);
  pathsRef.current = cachedPaths;

  // One-time geometry extraction. Only ever runs for the first instance of a
  // given icon set; everyone after reads straight from the cache.
  useLayoutEffect(() => {
    if (pathCache.has(cacheKey)) {
      setCachedPaths(pathCache.get(cacheKey));
      return;
    }
    const extracted = icons.map((_, i) => extractPathsFromIcon(iconRefs.current[i]));
    if (extracted.some((paths) => paths.length === 0)) return;
    pathCache.set(cacheKey, extracted);
    setCachedPaths(extracted);
  }, [cacheKey, icons]);

  const morphTo = useRef(null);
  morphTo.current = (targetIndex) => {
    const paths = pathsRef.current;
    if (!paths || isAnimatingRef.current || indexRef.current === targetIndex) return;

    const fromPaths = paths[indexRef.current];
    const toPaths = paths[targetIndex];
    if (!fromPaths?.length || !toPaths?.length) {
      indexRef.current = targetIndex;
      setCurrentIconIndex(targetIndex);
      return;
    }

    isAnimatingRef.current = true;
    const interpolators = buildInterpolators(fromPaths, toPaths, maxSegmentLength);
    const start = Date.now();

    const step = () => {
      const elapsed = Date.now() - start;
      const t = easeInOutQuad(Math.min(elapsed / morphDuration, 1));
      setMorphPaths(interpolators.map((fn) => fn(t)));

      if (elapsed < morphDuration) {
        frameRef.current = requestAnimationFrame(step);
      } else {
        indexRef.current = targetIndex;
        setCurrentIconIndex(targetIndex);
        isAnimatingRef.current = false;
        setMorphPaths([]);
      }
    };

    step();
  };

  // Auto-cycle / one-shot driver. Created once — the current index lives in a
  // ref so advancing does not rebuild the timer.
  useEffect(() => {
    if (!cachedPaths || mode === 'index') return undefined;

    if (mode === 'once') {
      timerRef.current = setTimeout(
        () => morphTo.current(icons.length - 1),
        startDelay
      );
    } else {
      timerRef.current = setInterval(
        () => morphTo.current((indexRef.current + 1) % icons.length),
        morphInterval
      );
    }

    return () => {
      clearTimeout(timerRef.current);
      clearInterval(timerRef.current);
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
  }, [cachedPaths, mode, icons.length, startDelay, morphInterval]);

  // Controlled mode: follow the index the caller hands us.
  useEffect(() => {
    if (mode !== 'index' || !cachedPaths || index == null) return;
    morphTo.current(index);
  }, [mode, index, cachedPaths]);

  const CurrentIcon = icons[currentIconIndex];
  const color = getColor
    ? getColor(currentIconIndex)
    : (isDarkMode ? 'text-white' : 'text-black');

  return (
    <div className={`inline-block ${className}`}>
      <div className="relative">
        {morphPaths.length > 0 ? (
          <svg
            width={size}
            height={size}
            viewBox="0 0 24 24"
            className={color}
            stroke="currentColor"
            color="currentColor"
          >
            {morphPaths.map((d, i) => (
              <path
                key={i}
                d={d}
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ))}
          </svg>
        ) : (
          <CurrentIcon size={size} className={color} stroke="currentColor" strokeWidth={1.5} />
        )}
      </div>

      {/* Scratch icons for the one-time path extraction. Rendered only until
          this icon set is cached, then gone for every instance thereafter. */}
      {!cachedPaths && (
        <div
          style={{ position: 'absolute', visibility: 'hidden', pointerEvents: 'none', left: '-9999px' }}
          aria-hidden="true"
        >
          {icons.map((Icon, i) => (
            <div key={i} ref={(el) => (iconRefs.current[i] = el)}>
              <Icon size={24} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default FlubberMorphIcon;
