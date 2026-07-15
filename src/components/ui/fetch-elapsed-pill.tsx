'use client'

import { useEffect, useRef, useState } from 'react'
import { Loader } from 'lucide-react'
import { motion, AnimatePresence } from 'motion/react'

import { cn } from '@/lib/utils'
import { SlidingNumber } from '@/components/motion-primitives/sliding-number'
import { useElapsedMs } from '@/hooks/useElapsedMs'
import { useLanguage } from '../../contexts/LanguageContext.jsx'

type FetchElapsedPillProps = {
  active: boolean
  /** Short status label shown beside the timer */
  label?: string
  /** Keep the pill visible this long after fetch completes (ms) */
  lingerMs?: number
  className?: string
  isDarkMode?: boolean
}

/**
 * Compact status pill that counts elapsed ms with SlidingNumber while data loads.
 */
export function FetchElapsedPill({
  active,
  label,
  lingerMs = 1100,
  className,
  isDarkMode = false,
}: FetchElapsedPillProps) {
  const { t } = useLanguage()
  const fetchLabel = label ?? t('common.fetching', 'Fetching')
  const readyLabel = t('common.ready', 'Ready')
  const msLabel = t('common.ms', 'ms')

  const elapsedMs = useElapsedMs(active)
  const latestMsRef = useRef(0)
  const wasActiveRef = useRef(false)
  const [visible, setVisible] = useState(false)
  const [displayMs, setDisplayMs] = useState(0)

  useEffect(() => {
    if (active) {
      latestMsRef.current = elapsedMs
      setDisplayMs(elapsedMs)
    }
  }, [active, elapsedMs])

  useEffect(() => {
    if (active) {
      wasActiveRef.current = true
      setVisible(true)
      return undefined
    }

    if (!wasActiveRef.current) return undefined

    setDisplayMs(latestMsRef.current)
    const timer = setTimeout(() => {
      setVisible(false)
      wasActiveRef.current = false
    }, lingerMs)

    return () => clearTimeout(timer)
  }, [active, lingerMs])

  return (
    <AnimatePresence>
      {visible ? (
        <motion.span
          key="fetch-elapsed-pill"
          initial={{ opacity: 0, y: -4, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -2, scale: 0.98 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          role="status"
          aria-live="polite"
          aria-busy={active}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium tabular-nums',
            isDarkMode
              ? 'border-slate-600/80 bg-slate-800/80 text-slate-200'
              : 'border-slate-200 bg-slate-50 text-slate-700',
            className
          )}
        >
          {active ? (
            <Loader
              className={cn(
                'h-3 w-3 shrink-0 animate-spin',
                isDarkMode ? 'text-sky-400' : 'text-sky-600'
              )}
              aria-hidden
            />
          ) : (
            <span
              className={cn(
                'h-1.5 w-1.5 shrink-0 rounded-full',
                isDarkMode ? 'bg-emerald-400' : 'bg-emerald-500'
              )}
              aria-hidden
            />
          )}
          <span className="opacity-80">{active ? fetchLabel : readyLabel}</span>
          <span
            className={cn(
              'inline-flex min-w-[4.5ch] items-baseline justify-end gap-0.5 font-semibold',
              isDarkMode ? 'text-slate-100' : 'text-slate-900'
            )}
          >
            <SlidingNumber
              value={displayMs}
              replayOnHover={false}
              className="inline-flex"
            />
            <span className="opacity-60">{msLabel}</span>
          </span>
        </motion.span>
      ) : null}
    </AnimatePresence>
  )
}

export default FetchElapsedPill
