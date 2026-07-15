import React, { useState } from 'react'
import { motion, type HTMLMotionProps } from 'motion/react'

import { cn } from '@/lib/utils'

export type ShinyButtonProps = HTMLMotionProps<'button'> & {
  children: React.ReactNode
  className?: string
  /** When true, the shine sweep only runs while hovered */
  shineOnHover?: boolean
}

export const ShinyButton = React.forwardRef<HTMLButtonElement, ShinyButtonProps>(
  ({ children, className, shineOnHover = false, onHoverStart, onHoverEnd, ...props }, ref) => {
    const [hovered, setHovered] = useState(false)
    const shineActive = !shineOnHover || hovered

    return (
      <motion.button
        ref={ref}
        className={cn(
          'relative inline-flex cursor-pointer items-center justify-center overflow-hidden rounded-lg border px-6 py-2 font-medium transition-shadow duration-300 ease-in-out hover:shadow',
          className
        )}
        initial={{ '--x': '100%', scale: 1 } as HTMLMotionProps<'button'>['initial']}
        animate={
          {
            '--x': shineActive ? '-100%' : '100%',
            scale: 1,
          } as HTMLMotionProps<'button'>['animate']
        }
        whileTap={{ scale: 0.95 }}
        transition={
          shineActive
            ? {
                '--x': {
                  repeat: Infinity,
                  repeatType: 'loop',
                  repeatDelay: 0.75,
                  type: 'spring',
                  stiffness: 20,
                  damping: 15,
                  mass: 2,
                  duration: 1.2,
                },
                scale: {
                  type: 'spring',
                  stiffness: 200,
                  damping: 5,
                  mass: 0.5,
                },
              }
            : {
                '--x': { duration: 0.35, ease: 'easeOut' },
                scale: { type: 'spring', stiffness: 200, damping: 5, mass: 0.5 },
              }
        }
        onHoverStart={(e, info) => {
          setHovered(true)
          onHoverStart?.(e, info)
        }}
        onHoverEnd={(e, info) => {
          setHovered(false)
          onHoverEnd?.(e, info)
        }}
        {...props}
      >
        <span className="relative z-20 inline-flex w-full items-center justify-center gap-2 text-sm tracking-wide text-inherit normal-case">
          {children}
        </span>

        <span
          aria-hidden
          className={cn(
            'pointer-events-none absolute inset-0 z-30 block rounded-[inherit] transition-opacity duration-200',
            shineOnHover && !hovered ? 'opacity-0' : 'opacity-100'
          )}
          style={{
            backgroundImage:
              'linear-gradient(-75deg, transparent calc(var(--x) + 15%), color-mix(in oklab, white 45%, transparent) calc(var(--x) + 25%), transparent calc(var(--x) + 35%))',
          }}
        />

        <span
          aria-hidden
          style={{
            mask: 'linear-gradient(rgb(0,0,0), rgb(0,0,0)) content-box exclude,linear-gradient(rgb(0,0,0), rgb(0,0,0))',
            WebkitMask:
              'linear-gradient(rgb(0,0,0), rgb(0,0,0)) content-box exclude,linear-gradient(rgb(0,0,0), rgb(0,0,0))',
            backgroundImage:
              'linear-gradient(-75deg,var(--primary)/10% calc(var(--x)+20%),var(--primary)/50% calc(var(--x)+25%),var(--primary)/10% calc(var(--x)+100%))',
          }}
          className={cn(
            'pointer-events-none absolute inset-0 z-10 block rounded-[inherit] p-px transition-opacity duration-200',
            shineOnHover && !hovered ? 'opacity-0' : 'opacity-100'
          )}
        />
      </motion.button>
    )
  }
)

ShinyButton.displayName = 'ShinyButton'
