'use client'

import {
  useCallback,
  useEffect,
  useRef,
  type ComponentPropsWithoutRef,
} from 'react'
import { useInView, useMotionValue, useSpring } from 'motion/react'

import { cn } from '@/lib/utils'

interface NumberTickerProps extends ComponentPropsWithoutRef<'span'> {
  value: number
  startValue?: number
  direction?: 'up' | 'down'
  delay?: number
  decimalPlaces?: number
  /** Re-animate from start on hover (default true) */
  replayOnHover?: boolean
}

const SMOOTH_SPRING = {
  damping: 48,
  stiffness: 48,
  mass: 1.05,
}

/** Magic UI Number Ticker — counts up/down when scrolled into view (useInView) */
export function NumberTicker({
  value,
  startValue = 0,
  direction = 'up',
  delay = 0,
  className,
  decimalPlaces = 0,
  replayOnHover = true,
  onMouseEnter,
  ...props
}: NumberTickerProps) {
  const ref = useRef<HTMLSpanElement>(null)
  const motionValue = useMotionValue(direction === 'down' ? value : startValue)
  const springValue = useSpring(motionValue, SMOOTH_SPRING)
  const isInView = useInView(ref, { once: true, margin: '0px' })

  const runToTarget = useCallback(() => {
    motionValue.set(direction === 'down' ? startValue : value)
  }, [motionValue, direction, startValue, value])

  const replay = useCallback(() => {
    motionValue.set(direction === 'down' ? value : startValue)
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(runToTarget)
    })
  }, [motionValue, direction, startValue, value, runToTarget])

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null

    if (isInView) {
      timer = setTimeout(runToTarget, delay * 1000)
    }

    return () => {
      if (timer !== null) {
        clearTimeout(timer)
      }
    }
  }, [isInView, delay, runToTarget])

  useEffect(
    () =>
      springValue.on('change', (latest) => {
        if (ref.current) {
          ref.current.textContent = Intl.NumberFormat('en-US', {
            minimumFractionDigits: decimalPlaces,
            maximumFractionDigits: decimalPlaces,
          }).format(Number(latest.toFixed(decimalPlaces)))
        }
      }),
    [springValue, decimalPlaces]
  )

  return (
    <span
      ref={ref}
      className={cn(
        'inline-block tracking-wider tabular-nums transition-transform duration-300 hover:scale-105',
        replayOnHover ? 'cursor-pointer' : 'cursor-default',
        className
      )}
      onMouseEnter={(e) => {
        if (replayOnHover) replay()
        onMouseEnter?.(e)
      }}
      {...props}
    >
      {Intl.NumberFormat('en-US', {
        minimumFractionDigits: decimalPlaces,
        maximumFractionDigits: decimalPlaces,
      }).format(startValue)}
    </span>
  )
}
