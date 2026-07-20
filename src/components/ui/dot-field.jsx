import { memo, useEffect, useRef } from 'react';

const TWO_PI = Math.PI * 2;

const DotField = memo(({
  className,
  dotRadius = 2,
  dotSpacing = 13,
  cursorRadius = 480,
  cursorForce = 0.1,
  bulgeOnly = true,
  bulgeStrength = 78,
  glowRadius = 120,
  sparkle = false,
  waveAmplitude = 2,
  waveSpeed = 0.025,
  waveFrequency = 0.03,
  gradientFrom = 'rgba(168, 85, 247, 0.35)',
  gradientTo = 'rgba(180, 151, 207, 0.25)',
  glowColor = '#120F17',
  glowCenterOpacity = 1,
  interactionMode = 'hover',
}) => {
  const canvasRef = useRef(null);
  const glowRef = useRef(null);
  const dotsRef = useRef([]);
  const mouseRef = useRef({ x: -9999, y: -9999, prevX: -9999, prevY: -9999, speed: 0 });
  const rafRef = useRef(null);
  const sizeRef = useRef({ w: 0, h: 0, offsetX: 0, offsetY: 0 });
  const glowOpacity = useRef(0);
  const engagement = useRef(0);
  const propsRef = useRef({});
  propsRef.current = {
    dotRadius,
    dotSpacing,
    cursorRadius,
    cursorForce,
    bulgeOnly,
    bulgeStrength,
    waveAmplitude,
    waveSpeed,
    waveFrequency,
    gradientFrom,
    gradientTo,
  };
  const rebuildRef = useRef(null);
  const glowIdRef = useRef(`dot-field-glow-${Math.random().toString(36).slice(2, 9)}`);
  const interactionModeRef = useRef(interactionMode);
  interactionModeRef.current = interactionMode;

  useEffect(() => {
    const canvas = canvasRef.current;
    const glowEl = glowRef.current;
    if (!canvas) return undefined;

    const ctx = canvas.getContext('2d', { alpha: true });
    const maxCanvasDpr = interactionMode === 'hover' ? 2 : 1;
    const dpr = Math.min(window.devicePixelRatio || 1, maxCanvasDpr);
    let resizeTimer;

    function resize() {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(doResize, 100);
    }

    function doResize() {
      const rect = canvas.parentElement.getBoundingClientRect();
      const w = rect.width;
      const h = rect.height;

      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      sizeRef.current = {
        w,
        h,
        offsetX: rect.left + window.scrollX,
        offsetY: rect.top + window.scrollY,
      };

      buildDots(w, h);
    }

    function buildDots(w, h) {
      const p = propsRef.current;
      const step = p.dotRadius + p.dotSpacing;
      const cols = Math.floor(w / step);
      const rows = Math.floor(h / step);
      const padX = (w % step) / 2;
      const padY = (h % step) / 2;
      const dots = new Array(rows * cols);
      let idx = 0;

      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          const ax = padX + col * step + step / 2;
          const ay = padY + row * step + step / 2;
          dots[idx++] = { ax, ay, sx: ax, sy: ay, vx: 0, vy: 0, x: ax, y: ay };
        }
      }
      dotsRef.current = dots;
    }

    function onMouseMove(e) {
      const s = sizeRef.current;
      mouseRef.current.x = e.pageX - s.offsetX;
      mouseRef.current.y = e.pageY - s.offsetY;
    }

    function updateMouseSpeed() {
      const m = mouseRef.current;
      const dx = m.prevX - m.x;
      const dy = m.prevY - m.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      m.speed += (dist - m.speed) * 0.5;
      if (m.speed < 0.001) m.speed = 0;
      m.prevX = m.x;
      m.prevY = m.y;
    }

    const speedInterval = interactionMode === 'hover'
      ? setInterval(updateMouseSpeed, 20)
      : null;

    let frameCount = 0;

    function tick() {
      frameCount += 1;
      const dots = dotsRef.current;
      const m = mouseRef.current;
      const { w, h } = sizeRef.current;
      const p = propsRef.current;
      const mode = interactionModeRef.current;
      const len = dots.length;
      const t = frameCount * (p.waveSpeed ?? 0.025);

      if (mode === 'auto' && w > 0 && h > 0) {
        m.x = w * 0.5 + Math.cos(t * 0.6) * w * 0.22;
        m.y = h * 0.5 + Math.sin(t * 0.45) * h * 0.18;
        m.speed = 1.8;
      } else if (mode === 'none') {
        m.x = -9999;
        m.y = -9999;
        m.speed = 0;
      }

      const interactive = mode !== 'none';
      const mouseInPanel = interactive && m.x >= 0 && m.y >= 0 && m.x <= w && m.y <= h;
      const speedEngagement = Math.min(m.speed / 5, 1);
      const targetEngagement = mouseInPanel
        ? Math.max(speedEngagement, mode === 'auto' ? 0.28 : 0.38)
        : speedEngagement;
      engagement.current += (targetEngagement - engagement.current) * 0.09;
      if (engagement.current < 0.001) engagement.current = 0;
      const eng = interactive ? engagement.current : 0;

      glowOpacity.current += ((interactive ? eng : 0) - glowOpacity.current) * 0.08;

      if (glowEl) {
        glowEl.setAttribute('cx', m.x);
        glowEl.setAttribute('cy', m.y);
        glowEl.style.opacity = glowOpacity.current;
      }

      ctx.clearRect(0, 0, w, h);

      const grad = ctx.createLinearGradient(0, 0, w, h);
      grad.addColorStop(0, p.gradientFrom);
      grad.addColorStop(1, p.gradientTo);
      ctx.fillStyle = grad;

      const cr = p.cursorRadius;
      const crSq = cr * cr;
      const rad = p.dotRadius / 2;
      const isBulge = p.bulgeOnly;

      ctx.beginPath();

      for (let i = 0; i < len; i++) {
        const d = dots[i];
        const dx = m.x - d.ax;
        const dy = m.y - d.ay;
        const distSq = dx * dx + dy * dy;

        if (distSq < crSq && interactive) {
          const dist = Math.sqrt(distSq);
          const proximity = 1 - dist / cr;
          const strength = Math.max(eng, proximity * 0.55);
          if (isBulge) {
            const bulgeT = 1 - dist / cr;
            const push = bulgeT * bulgeT * p.bulgeStrength * strength;
            const angle = Math.atan2(dy, dx);
            d.sx += (d.ax - Math.cos(angle) * push - d.sx) * 0.16;
            d.sy += (d.ay - Math.sin(angle) * push - d.sy) * 0.16;
          } else {
            const angle = Math.atan2(dy, dx);
            const move = (500 / dist) * (m.speed * p.cursorForce);
            d.vx += Math.cos(angle) * -move;
            d.vy += Math.sin(angle) * -move;
          }
        } else if (isBulge) {
          d.sx += (d.ax - d.sx) * 0.1;
          d.sy += (d.ay - d.sy) * 0.1;
        }

        if (!isBulge) {
          d.vx *= 0.9;
          d.vy *= 0.9;
          d.x = d.ax + d.vx;
          d.y = d.ay + d.vy;
          d.sx += (d.x - d.sx) * 0.1;
          d.sy += (d.y - d.sy) * 0.1;
        }

        let drawX = d.sx;
        let drawY = d.sy;
        if (p.waveAmplitude > 0) {
          const freq = p.waveFrequency ?? 0.03;
          drawY += Math.sin(d.ax * freq + t) * p.waveAmplitude;
          drawX += Math.cos(d.ay * freq + t * 0.7) * p.waveAmplitude * 0.5;
        }

        ctx.moveTo(drawX + rad, drawY);
        ctx.arc(drawX, drawY, rad, 0, TWO_PI);
      }

      ctx.fill();

      rafRef.current = requestAnimationFrame(tick);
    }

    doResize();
    window.addEventListener('resize', resize);
    if (interactionMode === 'hover') {
      window.addEventListener('mousemove', onMouseMove, { passive: true });
    }
    rafRef.current = requestAnimationFrame(tick);

    rebuildRef.current = () => {
      const { w, h } = sizeRef.current;
      if (w > 0 && h > 0) buildDots(w, h);
    };

    return () => {
      cancelAnimationFrame(rafRef.current);
      if (speedInterval) clearInterval(speedInterval);
      clearTimeout(resizeTimer);
      window.removeEventListener('resize', resize);
      if (interactionMode === 'hover') {
        window.removeEventListener('mousemove', onMouseMove);
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [interactionMode]);

  useEffect(() => {
    rebuildRef.current?.();
  }, [dotRadius, dotSpacing]);

  return (
    <div className={`relative size-full ${interactionMode === 'hover' ? 'cursor-pointer' : 'cursor-default'} ${className ?? ''}`}>
      <canvas
        ref={canvasRef}
        className="absolute inset-0 size-full"
      />
      <svg
        className="pointer-events-none absolute inset-0 size-full"
        aria-hidden
      >
        <defs>
          <radialGradient id={glowIdRef.current}>
            <stop offset="0%" stopColor={glowColor} stopOpacity={glowCenterOpacity} />
            <stop offset="100%" stopColor={glowColor} stopOpacity="0" />
          </radialGradient>
        </defs>
        <circle
          ref={glowRef}
          cx="-9999"
          cy="-9999"
          r={glowRadius}
          fill={`url(#${glowIdRef.current})`}
          style={{ opacity: 0, willChange: 'opacity' }}
        />
      </svg>
    </div>
  );
});

DotField.displayName = 'DotField';

export default DotField;
