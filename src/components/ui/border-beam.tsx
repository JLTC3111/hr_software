import type { CSSProperties } from 'react'

import { cn } from '@/lib/utils'

interface BorderBeamProps {
  size?: number
  duration?: number
  delay?: number
  colorFrom?: string
  colorTo?: string
  className?: string
  style?: CSSProperties
  reverse?: boolean
  initialOffset?: number
  borderWidth?: number
  /** When true, beam is hidden until the parent `.group` is hovered */
  showOnHover?: boolean
}

/**
 * Light beam that travels along a parent's border via CSS offset-path.
 * Avoids Tailwind `--color-*` vars (reserved in v4) by using `--beam-from` / `--beam-to`.
 */
export const BorderBeam = ({
  className,
  size = 50,
  delay = 0,
  duration = 6,
  colorFrom = '#ffaa40',
  colorTo = '#9c40ff',
  style,
  reverse = false,
  initialOffset = 0,
  borderWidth = 1.5,
  showOnHover = false,
}: BorderBeamProps) => {
  return (
    <div
      className={cn(
        'pointer-events-none absolute inset-0 z-[2] overflow-hidden rounded-[inherit]',
        showOnHover &&
          'opacity-0 transition-opacity duration-300 group-hover:opacity-100',
        className
      )}
      style={
        {
          border: `${borderWidth}px solid transparent`,
          maskImage:
            'linear-gradient(#0000, #0000), linear-gradient(#000, #000)',
          maskClip: 'padding-box, border-box',
          maskComposite: 'intersect',
          WebkitMaskImage:
            'linear-gradient(#0000, #0000), linear-gradient(#000, #000)',
          WebkitMaskClip: 'padding-box, border-box',
          // Safari / Chrome
          WebkitMaskComposite: 'source-in' as CSSProperties['WebkitMaskComposite'],
        } as CSSProperties
      }
    >
      <div
        className="absolute aspect-square animate-border-beam"
        style={
          {
            width: size,
            height: size,
            background: `linear-gradient(to left, ${colorFrom}, ${colorTo}, transparent)`,
            offsetPath: `rect(0 auto auto 0 round ${size}px)`,
            offsetAnchor: '100% 50%',
            '--beam-duration': `${duration}s`,
            animationDuration: `${duration}s`,
            animationDelay: `-${delay + (initialOffset / 100) * duration}s`,
            animationDirection: reverse ? 'reverse' : 'normal',
            animationTimingFunction: 'linear',
            animationIterationCount: 'infinite',
            ...style,
          } as CSSProperties
        }
      />
    </div>
  )
}
