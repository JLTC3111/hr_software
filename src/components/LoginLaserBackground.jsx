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
  glowRadius: 120,
  sparkle: false,
  waveAmplitude: 2,
  waveSpeed: 0.025,
  waveFrequency: 0.03,
};

const DOT_FIELD_AUTO = {
  waveAmplitude: 2.8,
  waveSpeed: 0.055,
  waveFrequency: 0.048,
};

export const LOGIN_LASER_THEME = {
  dark: {
    horizontalBeamOffset: 0.1,
    verticalBeamOffset: -0.2,
    color: '#FFFFFF',
    clearColor: '#000000',
    fogIntensity: 0.45,
    beamIntensity: 1,
    revealOpacity: 0.48,
    revealBlendMode: 'lighten',
    showSurfacePanel: true,
    surfaceBackground: '#000000',
    dotField: {
      ...DOT_FIELD_INTENSITY,
      gradientFrom: 'rgba(255, 255, 255, 0.58)',
      gradientTo: 'rgba(207, 158, 255, 0.45)',
      glowColor: '#000000',
      glowCenterOpacity: 0.35,
    },
  },
  light: {
    horizontalBeamOffset: 0.1,
    verticalBeamOffset: -0.2,
    color: '#2563EB',
    clearColor: '#F1F5F9',
    fogIntensity: 0,
    beamIntensity: 0,
    revealOpacity: 0,
    revealBlendMode: 'multiply',
    showSurfacePanel: true,
    surfaceBackground: '#F1F5F9',
    dotField: {
      ...DOT_FIELD_INTENSITY,
      gradientFrom: 'rgba(37, 99, 235, 0.55)',
      gradientTo: 'rgba(51, 65, 85, 0.38)',
      glowColor: 'rgb(241, 245, 249)',
      glowCenterOpacity: 0.45,
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
  interactionMode = 'hover',
}) => {
  const containerRef = useRef(null);
  const revealLayerRef = useRef(null);
  const dashboardSrc = useMemo(() => getDashboardAsset(language), [language]);

  useEffect(() => {
    const img = new Image();
    img.src = dashboardSrc;
  }, [dashboardSrc]);

  useEffect(() => {
    if (revealOpacity <= 0) return undefined;

    const el = revealLayerRef.current;
    const container = containerRef.current;
    if (!el || !container) return undefined;

    if (interactionMode === 'hover') {
      const onMove = (event) => {
        const rect = container.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;

        el.style.setProperty('--mx', `${x}px`);
        el.style.setProperty('--my', `${y + rect.height * 0.5}px`);
      };

      const onLeave = () => {
        el.style.setProperty('--mx', '-9999px');
        el.style.setProperty('--my', '-9999px');
      };

      window.addEventListener('mousemove', onMove, { passive: true });
      document.documentElement.addEventListener('mouseleave', onLeave);

      return () => {
        window.removeEventListener('mousemove', onMove);
        document.documentElement.removeEventListener('mouseleave', onLeave);
      };
    }

    if (interactionMode === 'auto') {
      let raf = 0;
      const start = performance.now();

      const animate = (now) => {
        const rect = container.getBoundingClientRect();
        const t = (now - start) * 0.00035;
        const x = rect.width * (0.5 + Math.cos(t) * 0.2);
        const y = rect.height * (0.38 + Math.sin(t * 0.75) * 0.1);

        el.style.setProperty('--mx', `${x}px`);
        el.style.setProperty('--my', `${y + rect.height * 0.5}px`);
        raf = requestAnimationFrame(animate);
      };

      raf = requestAnimationFrame(animate);

      return () => cancelAnimationFrame(raf);
    }

    return undefined;
  }, [revealOpacity, interactionMode]);

  const laserPointerEvents = interactionMode === 'hover' ? 'pointer-events-auto' : 'pointer-events-none';

  return (
    <div ref={containerRef} className="fixed inset-0 z-0">
      <Suspense fallback={null}>
        <LaserFlow
          className={`size-full ${laserPointerEvents}`}
          horizontalBeamOffset={horizontalBeamOffset}
          verticalBeamOffset={verticalBeamOffset}
          color={color}
          clearColor={clearColor}
          fogIntensity={fogIntensity}
          beamIntensity={beamIntensity}
          showSurfacePanel={showSurfacePanel}
          surfaceBackground={surfaceBackground}
          dotField={{
            ...dotField,
            interactionMode,
            ...(interactionMode === 'auto' ? DOT_FIELD_AUTO : {}),
          }}
          interactionMode={interactionMode}
          maxDpr={interactionMode === 'hover' ? undefined : 1}
        />
      </Suspense>

      {revealOpacity > 0 && (
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
      )}
    </div>
  );
};

export default LoginLaserBackground;
