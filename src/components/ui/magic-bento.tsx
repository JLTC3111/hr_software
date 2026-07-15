'use client';

import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import { gsap } from 'gsap';

import { SlidingNumber, useNumberReplay } from '@/components/motion-primitives/sliding-number';
import { BorderBeam } from '@/components/ui/border-beam';
import { cn } from '@/lib/utils';

export type MagicBentoItem = {
  label: string;
  title: string;
  description: string;
  value?: number;
  suffix?: string;
  onClick?: () => void;
  color?: string;
};

export type MagicBentoProps = {
  items: MagicBentoItem[];
  isDarkMode?: boolean;
  enableStars?: boolean;
  enableSpotlight?: boolean;
  enableBorderGlow?: boolean;
  enableTilt?: boolean;
  enableMagnetism?: boolean;
  clickEffect?: boolean;
  spotlightRadius?: number;
  particleCount?: number;
  glowColor?: string;
  className?: string;
};

const DEFAULT_PARTICLE_COUNT = 10;
const DEFAULT_SPOTLIGHT_RADIUS = 280;
const MOBILE_BREAKPOINT = 768;

const createParticleElement = (x: number, y: number, color: string) => {
  const el = document.createElement('div');
  el.className = 'magic-bento-particle';
  el.style.cssText = `
    position: absolute;
    width: 4px;
    height: 4px;
    border-radius: 50%;
    background: rgba(${color}, 1);
    box-shadow: 0 0 6px rgba(${color}, 0.55);
    pointer-events: none;
    z-index: 100;
    left: ${x}px;
    top: ${y}px;
  `;
  return el;
};

const updateCardGlow = (
  card: HTMLElement,
  mouseX: number,
  mouseY: number,
  glow: number,
  radius: number
) => {
  const rect = card.getBoundingClientRect();
  const relativeX = ((mouseX - rect.left) / rect.width) * 100;
  const relativeY = ((mouseY - rect.top) / rect.height) * 100;
  card.style.setProperty('--glow-x', `${relativeX}%`);
  card.style.setProperty('--glow-y', `${relativeY}%`);
  card.style.setProperty('--glow-intensity', String(glow));
  card.style.setProperty('--glow-radius', `${radius}px`);
};

function ParticleCard({
  children,
  className,
  style,
  disableAnimations,
  particleCount,
  glowColor,
  enableTilt,
  enableMagnetism,
  clickEffect,
  onClick,
  onHoverStart,
}: {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  disableAnimations?: boolean;
  particleCount: number;
  glowColor: string;
  enableTilt?: boolean;
  enableMagnetism?: boolean;
  clickEffect?: boolean;
  onClick?: () => void;
  onHoverStart?: () => void;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const particlesRef = useRef<HTMLDivElement[]>([]);
  const timeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const isHoveredRef = useRef(false);
  const memoizedParticles = useRef<HTMLDivElement[]>([]);
  const particlesInitialized = useRef(false);

  const initializeParticles = useCallback(() => {
    if (particlesInitialized.current || !cardRef.current) return;
    const { width, height } = cardRef.current.getBoundingClientRect();
    memoizedParticles.current = Array.from({ length: particleCount }, () =>
      createParticleElement(Math.random() * width, Math.random() * height, glowColor)
    );
    particlesInitialized.current = true;
  }, [particleCount, glowColor]);

  const clearAllParticles = useCallback(() => {
    timeoutsRef.current.forEach(clearTimeout);
    timeoutsRef.current = [];
    particlesRef.current.forEach((particle) => {
      gsap.to(particle, {
        scale: 0,
        opacity: 0,
        duration: 0.25,
        ease: 'back.in(1.7)',
        onComplete: () => particle.parentNode?.removeChild(particle),
      });
    });
    particlesRef.current = [];
  }, []);

  const animateParticles = useCallback(() => {
    if (!cardRef.current || !isHoveredRef.current) return;
    if (!particlesInitialized.current) initializeParticles();

    memoizedParticles.current.forEach((particle, index) => {
      const timeoutId = setTimeout(() => {
        if (!isHoveredRef.current || !cardRef.current) return;
        const clone = particle.cloneNode(true) as HTMLDivElement;
        cardRef.current.appendChild(clone);
        particlesRef.current.push(clone);
        gsap.fromTo(
          clone,
          { scale: 0, opacity: 0 },
          { scale: 1, opacity: 1, duration: 0.25, ease: 'back.out(1.7)' }
        );
        gsap.to(clone, {
          x: (Math.random() - 0.5) * 80,
          y: (Math.random() - 0.5) * 80,
          rotation: Math.random() * 360,
          duration: 2 + Math.random() * 2,
          ease: 'none',
          repeat: -1,
          yoyo: true,
        });
      }, index * 80);
      timeoutsRef.current.push(timeoutId);
    });
  }, [initializeParticles]);

  useEffect(() => {
    if (disableAnimations || !cardRef.current) return;
    const element = cardRef.current;

    const handleMouseEnter = () => {
      isHoveredRef.current = true;
      animateParticles();
      if (enableTilt) {
        gsap.to(element, {
          rotateX: 4,
          rotateY: 4,
          duration: 0.3,
          ease: 'power2.out',
          transformPerspective: 1000,
        });
      }
    };

    const handleMouseLeave = () => {
      isHoveredRef.current = false;
      clearAllParticles();
      gsap.to(element, {
        rotateX: 0,
        rotateY: 0,
        x: 0,
        y: 0,
        duration: 0.3,
        ease: 'power2.out',
      });
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!enableTilt && !enableMagnetism) return;
      const rect = element.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;

      if (enableTilt) {
        gsap.to(element, {
          rotateX: ((y - centerY) / centerY) * -8,
          rotateY: ((x - centerX) / centerX) * 8,
          duration: 0.1,
          ease: 'power2.out',
          transformPerspective: 1000,
        });
      }
      if (enableMagnetism) {
        gsap.to(element, {
          x: (x - centerX) * 0.04,
          y: (y - centerY) * 0.04,
          duration: 0.25,
          ease: 'power2.out',
        });
      }
    };

    const handleClick = (e: MouseEvent) => {
      onClick?.();
      if (!clickEffect) return;
      const rect = element.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const maxDistance = Math.max(
        Math.hypot(x, y),
        Math.hypot(x - rect.width, y),
        Math.hypot(x, y - rect.height),
        Math.hypot(x - rect.width, y - rect.height)
      );
      const ripple = document.createElement('div');
      ripple.style.cssText = `
        position: absolute;
        width: ${maxDistance * 2}px;
        height: ${maxDistance * 2}px;
        border-radius: 50%;
        background: radial-gradient(circle, rgba(${glowColor}, 0.35) 0%, rgba(${glowColor}, 0.15) 35%, transparent 70%);
        left: ${x - maxDistance}px;
        top: ${y - maxDistance}px;
        pointer-events: none;
        z-index: 1000;
      `;
      element.appendChild(ripple);
      gsap.fromTo(
        ripple,
        { scale: 0, opacity: 1 },
        {
          scale: 1,
          opacity: 0,
          duration: 0.75,
          ease: 'power2.out',
          onComplete: () => ripple.remove(),
        }
      );
    };

    element.addEventListener('mouseenter', handleMouseEnter);
    element.addEventListener('mouseleave', handleMouseLeave);
    element.addEventListener('mousemove', handleMouseMove);
    element.addEventListener('click', handleClick);

    return () => {
      isHoveredRef.current = false;
      element.removeEventListener('mouseenter', handleMouseEnter);
      element.removeEventListener('mouseleave', handleMouseLeave);
      element.removeEventListener('mousemove', handleMouseMove);
      element.removeEventListener('click', handleClick);
      clearAllParticles();
    };
  }, [
    animateParticles,
    clearAllParticles,
    disableAnimations,
    enableTilt,
    enableMagnetism,
    clickEffect,
    glowColor,
    onClick,
  ]);

  return (
    <div
      ref={cardRef}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onMouseEnter={onHoverStart}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
      className={cn(
        'group relative overflow-hidden',
        onClick && 'cursor-pointer',
        className
      )}
      style={style}
    >
      {children}
    </div>
  );
}

function GlobalSpotlight({
  gridRef,
  enabled,
  spotlightRadius,
  glowColor,
  disableAnimations,
}: {
  gridRef: React.RefObject<HTMLDivElement | null>;
  enabled: boolean;
  spotlightRadius: number;
  glowColor: string;
  disableAnimations: boolean;
}) {
  const spotlightRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (disableAnimations || !gridRef.current || !enabled) return;

    const spotlight = document.createElement('div');
    spotlight.className = 'magic-bento-spotlight';
    spotlight.style.cssText = `
      position: fixed;
      width: 720px;
      height: 720px;
      border-radius: 50%;
      pointer-events: none;
      background: radial-gradient(circle,
        rgba(${glowColor}, 0.14) 0%,
        rgba(${glowColor}, 0.07) 18%,
        rgba(${glowColor}, 0.03) 35%,
        transparent 65%
      );
      z-index: 200;
      opacity: 0;
      transform: translate(-50%, -50%);
      mix-blend-mode: screen;
    `;
    document.body.appendChild(spotlight);
    spotlightRef.current = spotlight;

    const proximity = spotlightRadius * 0.5;
    const fadeDistance = spotlightRadius * 0.75;

    const handleMouseMove = (e: MouseEvent) => {
      if (!spotlightRef.current || !gridRef.current) return;
      const section = gridRef.current;
      const rect = section.getBoundingClientRect();
      const inside =
        e.clientX >= rect.left &&
        e.clientX <= rect.right &&
        e.clientY >= rect.top &&
        e.clientY <= rect.bottom;

      const cards = section.querySelectorAll('.magic-bento-card');

      if (!inside) {
        gsap.to(spotlightRef.current, { opacity: 0, duration: 0.3 });
        cards.forEach((card) =>
          (card as HTMLElement).style.setProperty('--glow-intensity', '0')
        );
        return;
      }

      let minDistance = Infinity;
      cards.forEach((card) => {
        const cardElement = card as HTMLElement;
        const cardRect = cardElement.getBoundingClientRect();
        const centerX = cardRect.left + cardRect.width / 2;
        const centerY = cardRect.top + cardRect.height / 2;
        const distance =
          Math.hypot(e.clientX - centerX, e.clientY - centerY) -
          Math.max(cardRect.width, cardRect.height) / 2;
        const effectiveDistance = Math.max(0, distance);
        minDistance = Math.min(minDistance, effectiveDistance);

        let glowIntensity = 0;
        if (effectiveDistance <= proximity) glowIntensity = 1;
        else if (effectiveDistance <= fadeDistance) {
          glowIntensity =
            (fadeDistance - effectiveDistance) / (fadeDistance - proximity);
        }
        updateCardGlow(
          cardElement,
          e.clientX,
          e.clientY,
          glowIntensity,
          spotlightRadius
        );
      });

      gsap.to(spotlightRef.current, {
        left: e.clientX,
        top: e.clientY,
        duration: 0.1,
        ease: 'power2.out',
      });

      const targetOpacity =
        minDistance <= proximity
          ? 0.7
          : minDistance <= fadeDistance
            ? ((fadeDistance - minDistance) / (fadeDistance - proximity)) * 0.7
            : 0;

      gsap.to(spotlightRef.current, {
        opacity: targetOpacity,
        duration: targetOpacity > 0 ? 0.2 : 0.4,
      });
    };

    document.addEventListener('mousemove', handleMouseMove);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      spotlightRef.current?.parentNode?.removeChild(spotlightRef.current);
    };
  }, [gridRef, enabled, spotlightRadius, glowColor, disableAnimations]);

  return null;
}

function MagicBentoCardItem({
  item,
  index,
  isDarkMode,
  enableStars,
  enableBorderGlow,
  disableAnimations,
  particleCount,
  glowColor,
  enableTilt,
  enableMagnetism,
  clickEffect,
}: {
  item: MagicBentoItem;
  index: number;
  isDarkMode: boolean;
  enableStars: boolean;
  enableBorderGlow: boolean;
  disableAnimations: boolean;
  particleCount: number;
  glowColor: string;
  enableTilt: boolean;
  enableMagnetism: boolean;
  clickEffect: boolean;
}) {
  const { replayToken, bump } = useNumberReplay();

  const cardClass = cn(
    'magic-bento-card group flex min-h-[160px] cursor-pointer flex-col justify-between rounded-2xl border p-4 transition-shadow duration-300',
    enableBorderGlow && 'magic-bento-card--glow',
    isDarkMode
      ? 'border-slate-700 bg-slate-900 text-slate-100 hover:shadow-[0_8px_28px_rgba(0,0,0,0.35)]'
      : 'border-slate-200 bg-white text-slate-900 hover:shadow-[0_8px_28px_rgba(15,23,42,0.08)]'
  );

  const style = {
    backgroundColor: item.color,
    '--glow-x': '50%',
    '--glow-y': '50%',
    '--glow-intensity': '0',
    '--glow-radius': '200px',
  } as CSSProperties;

  const beam = (
    <BorderBeam
      showOnHover
      size={100}
      duration={8}
      delay={index * 0.15}
      borderWidth={2}
      colorFrom={isDarkMode ? '#38bdf8' : '#0ea5e9'}
      colorTo={isDarkMode ? '#a78bfa' : '#8b5cf6'}
    />
  );

  const body = (
    <>
      {beam}
      <div className="relative z-10 flex items-start justify-between gap-2">
        <span
          className={cn(
            'text-xs font-medium uppercase tracking-wide',
            isDarkMode ? 'text-slate-400' : 'text-slate-500'
          )}
        >
          {item.label}
        </span>
      </div>
      <div className="relative z-10 mt-3">
        {typeof item.value === 'number' ? (
          <div className="mb-1 flex items-baseline gap-1 text-2xl font-bold tracking-tight">
            <SlidingNumber value={item.value} replayToken={replayToken} />
            {item.suffix ? (
              <span className="text-lg font-semibold opacity-70">{item.suffix}</span>
            ) : null}
          </div>
        ) : (
          <h3 className="mb-1 text-base font-semibold">{item.title}</h3>
        )}
        <p
          className={cn(
            'text-xs leading-relaxed',
            isDarkMode ? 'text-slate-400' : 'text-slate-500'
          )}
        >
          {item.description}
        </p>
        {typeof item.value === 'number' ? null : (
          <p className="mt-1 text-sm font-medium opacity-80">{item.title}</p>
        )}
      </div>
    </>
  );

  if (enableStars) {
    return (
      <ParticleCard
        className={cardClass}
        style={style}
        disableAnimations={disableAnimations}
        particleCount={particleCount}
        glowColor={glowColor}
        enableTilt={enableTilt}
        enableMagnetism={enableMagnetism}
        clickEffect={clickEffect}
        onClick={item.onClick}
        onHoverStart={bump}
      >
        {body}
      </ParticleCard>
    );
  }

  return (
    <div
      className={cardClass}
      style={style}
      onClick={item.onClick}
      onMouseEnter={bump}
      onKeyDown={(e) => {
        if ((e.key === 'Enter' || e.key === ' ') && item.onClick) {
          e.preventDefault();
          item.onClick();
        }
      }}
      role={item.onClick ? 'button' : undefined}
      tabIndex={item.onClick ? 0 : undefined}
    >
      {body}
    </div>
  );
}

export function MagicBento({
  items,
  isDarkMode = false,
  enableStars = true,
  enableSpotlight = true,
  enableBorderGlow = true,
  enableTilt = false,
  enableMagnetism = true,
  clickEffect = true,
  spotlightRadius = DEFAULT_SPOTLIGHT_RADIUS,
  particleCount = DEFAULT_PARTICLE_COUNT,
  glowColor,
  className,
}: MagicBentoProps) {
  const gridRef = useRef<HTMLDivElement>(null);
  const [isMobile, setIsMobile] = useState(false);
  const resolvedGlow = glowColor || (isDarkMode ? '56, 189, 248' : '14, 165, 233');

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth <= MOBILE_BREAKPOINT);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  const disableAnimations = isMobile;

  return (
    <section
      className={cn('bento-section magic-bento-section relative w-full', className)}
      style={
        {
          '--glow-color': resolvedGlow,
          '--glow-x': '50%',
          '--glow-y': '50%',
          '--glow-intensity': '0',
          '--glow-radius': '200px',
        } as CSSProperties
      }
    >
      <style>{`
        .magic-bento-card--glow::after {
          content: '';
          position: absolute;
          inset: 0;
          padding: 1.5px;
          background: radial-gradient(var(--glow-radius) circle at var(--glow-x) var(--glow-y),
            rgba(var(--glow-color), calc(var(--glow-intensity) * 0.75)) 0%,
            rgba(var(--glow-color), calc(var(--glow-intensity) * 0.35)) 35%,
            transparent 65%);
          border-radius: inherit;
          -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
          -webkit-mask-composite: xor;
          mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
          mask-composite: exclude;
          pointer-events: none;
          z-index: 1;
        }
      `}</style>

      {enableSpotlight && (
        <GlobalSpotlight
          gridRef={gridRef}
          enabled={enableSpotlight}
          spotlightRadius={spotlightRadius}
          glowColor={resolvedGlow}
          disableAnimations={disableAnimations}
        />
      )}

      <div
        ref={gridRef}
        className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6"
      >
        {items.map((item, index) => (
          <MagicBentoCardItem
            key={`${item.label}-${index}`}
            item={item}
            index={index}
            isDarkMode={isDarkMode}
            enableStars={enableStars}
            enableBorderGlow={enableBorderGlow}
            disableAnimations={disableAnimations}
            particleCount={particleCount}
            glowColor={resolvedGlow}
            enableTilt={enableTilt}
            enableMagnetism={enableMagnetism}
            clickEffect={clickEffect}
          />
        ))}
      </div>
    </section>
  );
}

export default MagicBento;
