'use client'

import { cn } from '@/lib/utils'
import { SlidingNumberClock } from '../motion-primitives'
import { FetchElapsedPill } from './fetch-elapsed-pill'
import { useLanguage } from '../../contexts/LanguageContext.jsx'

/**
 * Live Sliding Number Clock — same pattern as Organisation Overview status bar.
 * Pass `textClassName` for theme-aware color (e.g. text.primary).
 * Pass `loading` to show the Fetching · N ms pill beside the clock.
 */
export function PageLiveClock({
  className,
  textClassName,
  separatorClassName,
  showSeparator = true,
  loading = false,
  isDarkMode = false,
  fetchLabel,
}) {
  const { t } = useLanguage()
  const resolvedFetchLabel = fetchLabel ?? t('common.fetching', 'Fetching')

  return (
    <span className={cn('inline-flex items-center gap-2 flex-wrap', className)}>
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
      <FetchElapsedPill
        active={Boolean(loading)}
        label={resolvedFetchLabel}
        isDarkMode={isDarkMode}
      />
    </span>
  )
}

export default PageLiveClock
