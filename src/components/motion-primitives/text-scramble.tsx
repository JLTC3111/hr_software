import { type ElementType, type JSX, useEffect, useRef, useState } from 'react';
import { motion, type MotionProps } from 'motion/react';

export type TextScrambleProps = {
  children: string;
  duration?: number;
  speed?: number;
  characterSet?: string;
  as?: ElementType;
  className?: string;
  trigger?: boolean;
  onScrambleComplete?: () => void;
} & MotionProps;

const defaultChars =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

export function TextScramble({
  children,
  duration = 0.8,
  speed = 0.04,
  characterSet = defaultChars,
  className,
  as: Component = 'p',
  trigger = true,
  onScrambleComplete,
  ...props
}: TextScrambleProps) {
  const MotionComponent = motion.create(
    Component as keyof JSX.IntrinsicElements
  );
  const [displayText, setDisplayText] = useState(children);
  const isAnimatingRef = useRef(false);
  const onCompleteRef = useRef(onScrambleComplete);
  onCompleteRef.current = onScrambleComplete;

  useEffect(() => {
    if (!trigger) {
      setDisplayText(children);
      return undefined;
    }

    if (isAnimatingRef.current) return undefined;
    isAnimatingRef.current = true;

    const text = children;
    const steps = Math.max(1, duration / speed);
    let step = 0;

    const interval = setInterval(() => {
      let scrambled = '';
      const progress = step / steps;

      for (let i = 0; i < text.length; i++) {
        if (text[i] === ' ') {
          scrambled += ' ';
          continue;
        }

        if (progress * text.length > i) {
          scrambled += text[i];
        } else {
          scrambled +=
            characterSet[Math.floor(Math.random() * characterSet.length)];
        }
      }

      setDisplayText(scrambled);
      step++;

      if (step > steps) {
        clearInterval(interval);
        setDisplayText(text);
        isAnimatingRef.current = false;
        onCompleteRef.current?.();
      }
    }, speed * 1000);

    return () => {
      clearInterval(interval);
      isAnimatingRef.current = false;
    };
  }, [trigger, children, duration, speed, characterSet]);

  return (
    <MotionComponent className={className} {...props}>
      {displayText}
    </MotionComponent>
  );
}
