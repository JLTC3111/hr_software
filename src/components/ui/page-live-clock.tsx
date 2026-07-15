'use client'

import { cn } from '@/lib/utils'
import { SlidingNumberClock } from '../motion-primitives'

/**
 * Live Sliding Number Clock — same pattern as Organisation Overview status bar.
 * Pass `textClassName` for theme-aware color (e.g. text.primary).
 */
export function PageLiveClock({
  className,
  textClassName,
  separatorClassName,
  showSeparator = true,
}) {
  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      {showSeparator ? (
        <span
          className={cn(
            'hidden sm:inline text-sm font-mono opacity-70',
            separatorClassName
          )}
          aria-hidden
        >
          ·
        </span>
      ) : null}
      <SlidingNumberClock
        className={cn(
          'hidden sm:inline text-sm font-semibold tabular-nums',
          textClassName
        )}
      />
    </span>
  )
}

export default PageLiveClock
