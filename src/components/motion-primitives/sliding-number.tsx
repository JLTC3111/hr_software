'use client';

import React, { useCallback, useEffect, useId, useState } from 'react';
import {
  MotionValue,
  motion,
  useSpring,
  useTransform,
  motionValue,
} from 'motion/react';
import useMeasure from 'react-use-measure';

import { cn } from '@/lib/utils';

const TRANSITION = {
  type: 'spring' as const,
  stiffness: 110,
  damping: 28,
  mass: 0.85,
};

function Digit({ value, place }: { value: number; place: number }) {
  const valueRoundedToPlace = Math.floor(value / place) % 10;
  const initial = motionValue(valueRoundedToPlace);
  const animatedValue = useSpring(initial, TRANSITION);

  useEffect(() => {
    animatedValue.set(valueRoundedToPlace);
  }, [animatedValue, valueRoundedToPlace]);

  return (
    <div className="relative inline-block w-[1ch] overflow-clip leading-none tabular-nums">
      <div className="invisible">0</div>
      {Array.from({ length: 10 }, (_, i) => (
        <Number key={i} mv={animatedValue} number={i} />
      ))}
    </div>
  );
}

function Number({ mv, number }: { mv: MotionValue<number>; number: number }) {
  const uniqueId = useId();
  const [ref, bounds] = useMeasure();

  const y = useTransform(mv, (latest) => {
    if (!bounds.height) return 0;
    const placeValue = latest % 10;
    const offset = (10 + number - placeValue) % 10;
    let memo = offset * bounds.height;
    if (offset > 5) {
      memo -= 10 * bounds.height;
    }
    return memo;
  });

  if (!bounds.height) {
    return (
      <span ref={ref} className="invisible absolute">
        {number}
      </span>
    );
  }

  return (
    <motion.span
      style={{ y }}
      layoutId={`${uniqueId}-${number}`}
      className="absolute inset-0 flex items-center justify-center"
      transition={TRANSITION}
      ref={ref}
    >
      {number}
    </motion.span>
  );
}

export type SlidingNumberProps = {
  value: number;
  padStart?: boolean;
  decimalSeparator?: string;
  className?: string;
  /** Increment to replay the count-up animation (e.g. on card hover) */
  replayToken?: number;
  /** Re-animate from 0 when the number itself is hovered (default true) */
  replayOnHover?: boolean;
};

/** Bump `replayToken` on hover so SlidingNumber re-counts from 0 */
export function useNumberReplay() {
  const [replayToken, setReplayToken] = useState(0);
  const bump = useCallback(() => {
    setReplayToken((t) => t + 1);
  }, []);
  return { replayToken, bump };
}

/** Sliding Number basic — digit wheels that slide when the value changes */
export function SlidingNumber({
  value,
  padStart = false,
  decimalSeparator = '.',
  className,
  replayToken = 0,
  replayOnHover = true,
}: SlidingNumberProps) {
  const absTarget = Math.abs(value);
  const [animated, setAnimated] = useState(0);
  const [localReplay, setLocalReplay] = useState(0);
  const effectiveReplay = replayToken + localReplay;

  // Follow value changes (e.g. live clock) without resetting to zero
  useEffect(() => {
    setAnimated(absTarget);
  }, [absTarget]);

  // Count from 0 on mount and whenever replayToken bumps (card / self hover)
  useEffect(() => {
    setAnimated(0);
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    const id = window.requestAnimationFrame(() => {
      timeoutId = window.setTimeout(() => setAnimated(absTarget), 48);
    });
    return () => {
      window.cancelAnimationFrame(id);
      if (timeoutId !== undefined) window.clearTimeout(timeoutId);
    };
    // absTarget read intentionally at replay time
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveReplay]);

  const [integerPart, decimalPart] = absTarget.toString().split('.');
  const integerValue = parseInt(integerPart, 10) || 0;
  const paddedInteger =
    padStart && integerValue < 10 ? `0${integerPart}` : integerPart;
  const integerDigits = paddedInteger.split('');
  const integerPlaces = integerDigits.map((_, i) =>
    Math.pow(10, integerDigits.length - i - 1)
  );

  const animatedInteger = Math.floor(animated);
  const animatedDecimal = decimalPart
    ? Math.round((animated % 1) * Math.pow(10, decimalPart.length))
    : 0;

  return (
    <span
      className={cn(
        'inline-flex cursor-default items-center leading-none transition-transform duration-300 hover:scale-105',
        className
      )}
      onMouseEnter={() => {
        if (replayOnHover) setLocalReplay((n) => n + 1);
      }}
    >
      {value < 0 && <span>-</span>}
      {integerDigits.map((_, index) => (
        <Digit
          key={`int-${integerPlaces[index]}-${integerDigits.length}`}
          value={animatedInteger}
          place={integerPlaces[index]}
        />
      ))}
      {decimalPart && (
        <>
          <span>{decimalSeparator}</span>
          {decimalPart.split('').map((_, index) => (
            <Digit
              key={`dec-${index}-${decimalPart.length}`}
              value={animatedDecimal}
              place={Math.pow(10, decimalPart.length - index - 1)}
            />
          ))}
        </>
      )}
    </span>
  );
}

/** Sliding Number clock — live HH:MM:SS with padded sliding digits */
export function SlidingNumberClock({ className }: { className?: string }) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const hours = now.getHours();
  const minutes = now.getMinutes();
  const seconds = now.getSeconds();

  return (
    <span
      className={cn(
        'inline-flex items-center gap-0.5 font-mono tabular-nums tracking-tight',
        className
      )}
      aria-label={now.toLocaleTimeString()}
    >
      <SlidingNumber value={hours} padStart replayOnHover={false} />
      <span className="opacity-60">:</span>
      <SlidingNumber value={minutes} padStart replayOnHover={false} />
      <span className="opacity-60">:</span>
      <SlidingNumber value={seconds} padStart replayOnHover={false} />
    </span>
  );
}
