import React, { useState } from 'react'
import { motion, type HTMLMotionProps } from 'motion/react'

import { cn } from '@/lib/utils'

export type SpecularButtonProps = HTMLMotionProps<'button'> & {
  children: React.ReactNode
  className?: string
  /** Keep the specular sheen active (e.g. while a row is in edit mode). */
  active?: boolean
  /** Sheen only while hovered / group-hovered unless `active` is true. Default true. */
  shineOnHover?: boolean
}

/**
 * Specular Button — frosted edge + sweeping light sheen.
 * Sheen shows on hover, parent `group-hover`, or when `active`.
 */
export const SpecularButton = React.forwardRef<HTMLButtonElement, SpecularButtonProps>(
  (
    {
      children,
      className,
      active = false,
      shineOnHover = true,
      onHoverStart,
      onHoverEnd,
      disabled,
      ...props
    },
    ref
  ) => {
    const [hovered, setHovered] = useState(false)
    const shineActive = active || !shineOnHover || hovered

    return (
      <motion.button
        ref={ref}
        disabled={disabled}
        data-active={active ? 'true' : undefined}
        className={cn(
          'group/specular relative inline-flex cursor-pointer items-center justify-center overflow-hidden rounded-lg border font-medium transition-[border-radius,box-shadow,background-color,color] duration-300 ease-out',
          'shadow-[inset_0_1px_0_rgba(255,255,255,0.55),0_1px_2px_rgba(15,23,42,0.08)]',
          'hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.7),0_4px_14px_rgba(15,23,42,0.12)]',
          'group-hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.7),0_4px_14px_rgba(15,23,42,0.12)]',
          'data-[active=true]:shadow-[inset_0_1px_0_rgba(255,255,255,0.7),0_4px_14px_rgba(15,23,42,0.12)]',
          'disabled:cursor-not-allowed disabled:opacity-50',
          className
        )}
        initial={{ '--x': '100%', scale: 1 } as HTMLMotionProps<'button'>['initial']}
        animate={
          {
            '--x': shineActive ? '-100%' : '100%',
            scale: 1,
          } as HTMLMotionProps<'button'>['animate']
        }
        whileTap={disabled ? undefined : { scale: 0.96 }}
        transition={
          shineActive
            ? {
                '--x': {
                  repeat: Infinity,
                  repeatType: 'loop',
                  repeatDelay: 0.85,
                  type: 'spring',
                  stiffness: 20,
                  damping: 15,
                  mass: 2,
                  duration: 1.15,
                },
                scale: {
                  type: 'spring',
                  stiffness: 220,
                  damping: 16,
                  mass: 0.5,
                },
              }
            : {
                '--x': { duration: 0.35, ease: 'easeOut' },
                scale: { type: 'spring', stiffness: 220, damping: 16, mass: 0.5 },
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
        {/* Top specular rim */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 z-40 h-px rounded-[inherit] bg-linear-to-r from-transparent via-white/80 to-transparent opacity-80"
        />

        <span className="relative z-20 inline-flex w-full items-center justify-center gap-2 text-sm tracking-wide text-inherit normal-case">
          {children}
        </span>

        {/* Sweeping specular sheen */}
        <span
          aria-hidden
          className={cn(
            'pointer-events-none absolute inset-0 z-30 block rounded-[inherit] transition-opacity duration-200',
            shineOnHover && !active && !hovered
              ? 'opacity-0 group-hover:opacity-100'
              : 'opacity-100'
          )}
          style={{
            backgroundImage:
              'linear-gradient(-75deg, transparent calc(var(--x) + 12%), color-mix(in oklab, white 55%, transparent) calc(var(--x) + 24%), transparent calc(var(--x) + 36%))',
          }}
        />

        {/* Edge specular border wash */}
        <span
          aria-hidden
          className={cn(
            'pointer-events-none absolute inset-0 z-10 block rounded-[inherit] p-px transition-opacity duration-200',
            shineOnHover && !active && !hovered
              ? 'opacity-0 group-hover:opacity-100'
              : 'opacity-100'
          )}
          style={{
            mask: 'linear-gradient(rgb(0,0,0), rgb(0,0,0)) content-box exclude,linear-gradient(rgb(0,0,0), rgb(0,0,0))',
            WebkitMask:
              'linear-gradient(rgb(0,0,0), rgb(0,0,0)) content-box exclude,linear-gradient(rgb(0,0,0), rgb(0,0,0))',
            backgroundImage:
              'linear-gradient(-75deg, rgba(255,255,255,0.08) calc(var(--x) + 18%), rgba(255,255,255,0.55) calc(var(--x) + 28%), rgba(255,255,255,0.08) calc(var(--x) + 95%))',
          }}
        />
      </motion.button>
    )
  }
)

SpecularButton.displayName = 'SpecularButton'
