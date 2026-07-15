import { type ComponentPropsWithoutRef, type ReactNode } from 'react'
import { ArrowRight } from 'lucide-react'

import { cn } from '@/lib/utils'
import { useTheme } from '../../contexts/ThemeContext.jsx'

interface BentoGridProps extends ComponentPropsWithoutRef<'div'> {
  children: ReactNode
  className?: string
}

interface BentoCardProps extends ComponentPropsWithoutRef<'div'> {
  name: string
  className?: string
  /** Decorative layer only (gradients / beams) — not text content */
  background?: ReactNode
  /** Main body content rendered below the header (prevents overlap) */
  children?: ReactNode
  Icon: React.ElementType
  description: string
  href?: string
  cta?: string
  onCtaClick?: () => void
}

const BentoGrid = ({ children, className, ...props }: BentoGridProps) => {
  return (
    <div
      className={cn(
        'grid w-full auto-rows-[22rem] grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3',
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}

const BentoCard = ({
  name,
  className,
  background,
  children,
  Icon,
  description,
  href,
  cta,
  onCtaClick,
  ...props
}: BentoCardProps) => {
  const { isDarkMode } = useTheme()

  return (
    <div
      className={cn(
        'group relative col-span-1 flex h-full min-h-[22rem] flex-col overflow-hidden rounded-xl border shadow-sm',
        isDarkMode
          ? 'border-slate-600 bg-slate-900'
          : 'border-slate-200 bg-white',
        className
      )}
      {...props}
    >
      <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit]">
        <div
          className={cn(
            'absolute inset-0',
            isDarkMode
              ? 'bg-linear-to-b from-slate-900 via-slate-900 to-slate-950'
              : 'bg-linear-to-b from-white via-slate-50 to-slate-100/80'
          )}
        />
        <div
          className={cn(
            'absolute inset-0',
            isDarkMode
              ? 'bg-linear-to-br from-sky-400/10 via-transparent to-teal-400/8'
              : 'bg-linear-to-br from-sky-500/5 via-transparent to-teal-500/6'
          )}
        />
        {background}
      </div>

      <div
        className={cn(
          'relative z-10 flex shrink-0 items-start justify-between gap-3 border-b px-4 py-3',
          isDarkMode ? 'border-slate-700/80' : 'border-slate-200/80'
        )}
      >
        <div className="min-w-0">
          <div className="mb-1 flex items-center gap-2">
            <Icon
              className={cn(
                'h-5 w-5 shrink-0',
                isDarkMode ? 'text-slate-200' : 'text-slate-700'
              )}
            />
            <h3
              className={cn(
                'truncate text-base font-semibold',
                isDarkMode ? 'text-slate-50' : 'text-slate-900'
              )}
            >
              {name}
            </h3>
          </div>
          <p
            className={cn(
              'text-xs leading-relaxed',
              isDarkMode ? 'text-slate-300' : 'text-slate-600'
            )}
          >
            {description}
          </p>
        </div>

        {(cta || onCtaClick || href) && (
          <div className="shrink-0 pt-0.5">
            {href ? (
              <a
                href={href}
                className={cn(
                  'inline-flex cursor-pointer items-center text-xs font-medium hover:underline',
                  isDarkMode ? 'text-sky-400' : 'text-sky-700'
                )}
              >
                {cta}
                <ArrowRight className="ms-1 h-3.5 w-3.5" />
              </a>
            ) : onCtaClick ? (
              <button
                type="button"
                onClick={onCtaClick}
                className={cn(
                  'inline-flex cursor-pointer items-center text-xs font-medium hover:underline',
                  isDarkMode ? 'text-sky-400' : 'text-sky-700'
                )}
              >
                {cta}
                <ArrowRight className="ms-1 h-3.5 w-3.5" />
              </button>
            ) : null}
          </div>
        )}
      </div>

      {children ? (
        <div className="relative z-10 min-h-0 flex-1 overflow-hidden p-3">{children}</div>
      ) : null}
    </div>
  )
}

export { BentoCard, BentoGrid }
