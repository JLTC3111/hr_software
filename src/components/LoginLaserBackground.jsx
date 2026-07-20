import { lazy, Suspense, useEffect, useMemo, useRef } from 'react';

const LaserFlow = lazy(() => import('./ui/laser-flow'));

const REVEAL_MASK =
  'radial-gradient(circle at var(--mx) var(--my), rgba(255,255,255,1) 0px, rgba(255,255,255,0.95) 60px, rgba(255,255,255,0.6) 120px, rgba(255,255,255,0.25) 180px, rgba(255,255,255,0) 240px)';

const LANGUAGE_ASSET_PREFIX = {
  en: 'en',
  de: 'de',
  fr: 'fr',
  jp: 'jp',
  kr: 'kr',
  th: 'th',
  vn: 'vi',
  ru: 'ru',
  es: 'es',
};

const DOT_FIELD_INTENSITY = {
  dotRadius: 2,
  dotSpacing: 13,
  cursorRadius: 480,
  bulgeStrength: 78,
  glowRadius: 150,
  sparkle: false,
  waveAmplitude: 1.5,
};

export const LOGIN_LASER_THEME = {
  dark: {
    horizontalBeamOffset: 0.1,
    verticalBeamOffset: -0.2,
    color: '#CF9EFF',
    clearColor: '#000000',
    fogIntensity: 0.45,
    beamIntensity: 1,
    revealOpacity: 0.48,
    revealBlendMode: 'lighten',
    showSurfacePanel: true,
    surfaceBackground: '#120F17',
    dotField: {
      ...DOT_FIELD_INTENSITY,
      gradientFrom: 'rgba(168, 85, 247, 0.3)',
      gradientTo: 'rgba(180, 151, 207, 0.2)',
      glowColor: '#120F17',
    },
  },
  light: {
    horizontalBeamOffset: 0.1,
    verticalBeamOffset: -0.2,
    color: '#2563EB',
    clearColor: '#F1F5F9',
    fogIntensity: 0,
    beamIntensity: 0,
    revealOpacity: 0.5,
    revealBlendMode: 'multiply',
    showSurfacePanel: true,
    surfaceBackground: '#FFFFFF',
    dotField: {
      ...DOT_FIELD_INTENSITY,
      gradientFrom: 'rgba(37, 99, 235, 0.28)',
      gradientTo: 'rgba(15, 23, 42, 0.18)',
      glowColor: '#2563EB',
    },
  },
};

const getDashboardAsset = (language) => {
  const prefix = LANGUAGE_ASSET_PREFIX[language] ?? 'en';
  return `/loginbg/${prefix}-dashboard.png`;
};

const LoginLaserBackground = ({
  horizontalBeamOffset,
  verticalBeamOffset,
  color,
  clearColor,
  fogIntensity,
  beamIntensity,
  language,
  revealOpacity,
  revealBlendMode,
  showSurfacePanel,
  surfaceBackground,
  dotField,
}) => {
  const containerRef = useRef(null);
  const revealLayerRef = useRef(null);
  const dashboardSrc = useMemo(() => getDashboardAsset(language), [language]);

  useEffect(() => {
    const img = new Image();
    img.src = dashboardSrc;
  }, [dashboardSrc]);

  useEffect(() => {
    const onMove = (event) => {
      const el = revealLayerRef.current;
      const container = containerRef.current;
      if (!el || !container) return;

      const rect = container.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;

      el.style.setProperty('--mx', `${x}px`);
      el.style.setProperty('--my', `${y + rect.height * 0.5}px`);
    };

    const onLeave = () => {
      const el = revealLayerRef.current;
      if (!el) return;
      el.style.setProperty('--mx', '-9999px');
      el.style.setProperty('--my', '-9999px');
    };

    window.addEventListener('mousemove', onMove, { passive: true });
    document.documentElement.addEventListener('mouseleave', onLeave);

    return () => {
      window.removeEventListener('mousemove', onMove);
      document.documentElement.removeEventListener('mouseleave', onLeave);
    };
  }, []);

  return (
    <div ref={containerRef} className="fixed inset-0 z-0">
      <Suspense fallback={null}>
        <LaserFlow
          className="size-full pointer-events-auto"
          horizontalBeamOffset={horizontalBeamOffset}
          verticalBeamOffset={verticalBeamOffset}
          color={color}
          clearColor={clearColor}
          fogIntensity={fogIntensity}
          beamIntensity={beamIntensity}
          showSurfacePanel={showSurfacePanel}
          surfaceBackground={surfaceBackground}
          dotField={dotField}
        />
      </Suspense>

      <div
        ref={revealLayerRef}
        className="pointer-events-none absolute z-[2] w-full"
        style={{
          top: '-50%',
          opacity: revealOpacity,
          mixBlendMode: revealBlendMode,
          WebkitMaskImage: REVEAL_MASK,
          maskImage: REVEAL_MASK,
          WebkitMaskRepeat: 'no-repeat',
          maskRepeat: 'no-repeat',
          '--mx': '-9999px',
          '--my': '-9999px',
        }}
      >
        <img
          key={dashboardSrc}
          src={dashboardSrc}
          alt=""
          aria-hidden
          decoding="async"
          draggable={false}
          className="block w-full"
        />
      </div>
    </div>
  );
};

export default LoginLaserBackground;
