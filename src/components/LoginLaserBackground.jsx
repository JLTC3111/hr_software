import { useEffect, useMemo, useRef } from 'react';
import OptionalLazy from './OptionalLazy.jsx';
import { DOT_FIELD_AUTO } from './loginLaserTheme.js';

const loadLaserFlow = () => import('./ui/laser-flow');

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
      <OptionalLazy
        load={loadLaserFlow}
        label="Login laser"
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
