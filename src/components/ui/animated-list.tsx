import React, {
  useEffect,
  useMemo,
  useState,
  type ComponentPropsWithoutRef,
} from 'react'
import { AnimatePresence, motion, type MotionProps } from 'motion/react'

import { cn } from '@/lib/utils'

export function AnimatedListItem({ children }: { children: React.ReactNode }) {
  const animations: MotionProps = {
    initial: { scale: 0.92, opacity: 0, y: 8 },
    animate: { scale: 1, opacity: 1, y: 0 },
    exit: { scale: 0.92, opacity: 0 },
    transition: { type: 'spring', stiffness: 350, damping: 40 },
  }

  return (
    <motion.div {...animations} layout className="mx-auto w-full">
      {children}
    </motion.div>
  )
}

export interface AnimatedListProps extends ComponentPropsWithoutRef<'div'> {
  children: React.ReactNode
  delay?: number
  /** When true (default Magic UI behavior), newest items stack on top */
  reverse?: boolean
}

export const AnimatedList = React.memo(
  ({
    children,
    className,
    delay = 1000,
    reverse = true,
    ...props
  }: AnimatedListProps) => {
    const [index, setIndex] = useState(0)
    const childrenArray = useMemo(
      () => React.Children.toArray(children),
      [children]
    )

    useEffect(() => {
      setIndex(0)
    }, [childrenArray.length])

    useEffect(() => {
      let timeout: ReturnType<typeof setTimeout> | null = null

      if (index < childrenArray.length - 1) {
        timeout = setTimeout(() => {
          setIndex((prevIndex) => prevIndex + 1)
        }, delay)
      }

      return () => {
        if (timeout !== null) {
          clearTimeout(timeout)
        }
      }
    }, [index, delay, childrenArray.length])

    const itemsToShow = useMemo(() => {
      const result = childrenArray.slice(0, index + 1)
      return reverse ? [...result].reverse() : result
    }, [index, childrenArray, reverse])

    return (
      <div
        className={cn('flex flex-col items-stretch gap-2', className)}
        {...props}
      >
        <AnimatePresence mode="popLayout">
          {itemsToShow.map((item, itemIndex) => (
            <AnimatedListItem
              key={(item as React.ReactElement).key ?? `animated-list-item-${itemIndex}`}
            >
              {item}
            </AnimatedListItem>
          ))}
        </AnimatePresence>
      </div>
    )
  }
)

AnimatedList.displayName = 'AnimatedList'
