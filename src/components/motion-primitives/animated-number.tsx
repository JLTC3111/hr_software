'use client'

import { cn } from '@/lib/utils'
import {
  motion,
  useInView,
  useSpring,
  useTransform,
  type SpringOptions,
} from 'motion/react'
import {
  useCallback,
  useEffect,
  useRef,
  type ElementType,
  type JSX,
  type MouseEvent,
} from 'react'

export type AnimatedNumberProps = {
  value: number
  className?: string
  springOptions?: SpringOptions
  as?: ElementType
  /** Animate when scrolled into view (Magic UI Number Ticker pattern) */
  useInViewTrigger?: boolean
  decimalPlaces?: number
  /** Re-animate from 0 on hover (default true) */
  replayOnHover?: boolean
}

const DEFAULT_SPRING: SpringOptions = {
  stiffness: 48,
  damping: 48,
  mass: 1.05,
}

/**
 * Counts to `value` with a soft spring. When `useInViewTrigger` is true (default),
 * animation starts once the element enters the viewport — Magic UI style.
 */
export function AnimatedNumber({
  value,
  className,
  springOptions,
  as = 'span',
  useInViewTrigger = true,
  decimalPlaces = 0,
  replayOnHover = true,
}: AnimatedNumberProps) {
  const ref = useRef<HTMLElement | null>(null)
  const isInView = useInView(ref, { once: true, margin: '0px' })
  const MotionComponent = motion.create(as as keyof JSX.IntrinsicElements)

  const spring = useSpring(0, {
    ...DEFAULT_SPRING,
    ...springOptions,
  })
  const display = useTransform(spring, (current) =>
    Intl.NumberFormat('en-US', {
      minimumFractionDigits: decimalPlaces,
      maximumFractionDigits: decimalPlaces,
    }).format(Number(current.toFixed(decimalPlaces)))
  )

  const replay = useCallback(() => {
    spring.set(0)
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => spring.set(value))
    })
  }, [spring, value])

  useEffect(() => {
    if (!useInViewTrigger || isInView) {
      spring.set(value)
    }
  }, [spring, value, isInView, useInViewTrigger])

  return (
    <MotionComponent
      ref={ref}
      className={cn(
        'tabular-nums transition-transform duration-300 hover:scale-105',
        replayOnHover ? 'cursor-pointer' : 'cursor-default',
        className
      )}
      onMouseEnter={
        replayOnHover
          ? (_e: MouseEvent) => {
              replay()
            }
          : undefined
      }
    >
      {display}
    </MotionComponent>
  )
}
