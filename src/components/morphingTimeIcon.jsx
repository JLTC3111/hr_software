import React, { useState, useEffect, useRef } from 'react';
import { interpolate } from 'flubber';

/**
 * MorphingTimeIcon Component
 * Morphs between Clock and Calendar icons using Flubber
 * Specifically designed for the time clock entry interface
 */
const MorphingTimeIcon = ({ 
  mode = 'clock', // 'clock' or 'calendar'
  size = 24,
  className = '',
  isDarkMode = false,
  autoMorph = false,
  morphInterval = 5000
}) => {
  const [currentPath, setCurrentPath] = useState('');
  const [isAnimating, setIsAnimating] = useState(false);
  const pathRef = useRef(null);
  const animationRef = useRef(null);
  const timeoutRef = useRef(null);
  const currentModeRef = useRef(mode);

  // Simplified paths for better morphing
  const shapes = {
    clock: {
      // Clock face with hands
      path: 'M50 10 A40 40 0 1 1 50 90 A40 40 0 1 1 50 10 M50 30 L50 50 L65 55',
      fill: isDarkMode ? '#60A5FA' : '#3B82F6'
    },
    calendar: {
      // Calendar with date
      path: 'M20 20 L80 20 L80 80 L20 80 Z M25 30 L75 30 M35 20 L35 15 M65 20 L65 15 M30 45 L45 45 M30 55 L70 55 M30 65 L55 65',
      fill: isDarkMode ? '#34D399' : '#10B981'
    }
  };

  // Initialize with current mode
  useEffect(() => {
    if (!currentPath) {
      setCurrentPath(shapes[mode].path);
      currentModeRef.current = mode;
    }
  }, []);

  // Morph when mode changes
  useEffect(() => {
    if (currentPath && mode !== currentModeRef.current) {
      morphToMode(mode);
    }
  }, [mode]);

  // Auto-morph functionality
  useEffect(() => {
    if (autoMorph) {
      timeoutRef.current = setTimeout(() => {
        const nextMode = currentModeRef.current === 'clock' ? 'calendar' : 'clock';
        morphToMode(nextMode);
      }, morphInterval);
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [autoMorph, currentPath, morphInterval]);

  const morphToMode = (targetMode) => {
    if (isAnimating || !shapes[currentModeRef.current] || !shapes[targetMode]) return;

    setIsAnimating(true);
    const fromPath = shapes[currentModeRef.current].path;
    const toPath = shapes[targetMode].path;

    try {
      const interpolator = interpolate(fromPath, toPath, {
        maxSegmentLength: 5,
      });

      const duration = 600;
      const startTime = performance.now();

      const animate = (currentTime) => {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);

        // Smooth easing
        const easeInOutQuad = progress < 0.5
          ? 2 * progress * progress
          : 1 - Math.pow(-2 * progress + 2, 2) / 2;

        const interpolatedPath = interpolator(easeInOutQuad);
        setCurrentPath(interpolatedPath);

        if (progress < 1) {
          animationRef.current = requestAnimationFrame(animate);
        } else {
          setIsAnimating(false);
          currentModeRef.current = targetMode;
        }
      };

      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }

      animationRef.current = requestAnimationFrame(animate);
    } catch (error) {
      console.error('Morphing error:', error);
      setCurrentPath(toPath);
      setIsAnimating(false);
      currentModeRef.current = targetMode;
    }
  };

  // Cleanup
  useEffect(() => {
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      className={`${className} transition-opacity duration-300`}
      style={{ opacity: isAnimating ? 0.8 : 1 }}
    >
      <path
        ref={pathRef}
        d={currentPath}
        fill={shapes[currentModeRef.current]?.fill || shapes.clock.fill}
        strokeWidth="0"
        className="transition-colors duration-300"
      />
    </svg>
  );
};

export default MorphingTimeIcon;
