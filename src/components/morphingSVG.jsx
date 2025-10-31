import React, { useState, useEffect, useRef } from 'react';
import { interpolate } from 'flubber';
import { useTheme } from '../contexts/ThemeContext';

/**
 * MorphingSVG Component
 * Demonstrates smooth SVG path morphing using Flubber
 * Can morph between multiple shapes with smooth transitions
 */
const MorphingSVG = ({ 
  shapes = [], 
  duration = 800, 
  autoPlay = true,
  autoPlayInterval = 3000,
  width = 200, 
  height = 200,
  className = '',
  fill = 'currentColor',
  strokeWidth = 0,
  stroke = 'none'
}) => {
  const { isDarkMode } = useTheme();
  const [currentShapeIndex, setCurrentShapeIndex] = useState(0);
  const [currentPath, setCurrentPath] = useState(shapes[0]?.path || '');
  const pathRef = useRef(null);
  const animationRef = useRef(null);
  const timeoutRef = useRef(null);

  // Morph to next shape
  const morphToShape = (targetIndex) => {
    if (!shapes[targetIndex] || targetIndex === currentShapeIndex) return;

    const fromPath = shapes[currentShapeIndex].path;
    const toPath = shapes[targetIndex].path;

    try {
      // Create interpolator using Flubber
      const interpolator = interpolate(fromPath, toPath, {
        maxSegmentLength: 10, // Smoother curves
      });

      const startTime = performance.now();
      
      const animate = (currentTime) => {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        // Easing function for smooth animation
        const easeInOutCubic = progress < 0.5
          ? 4 * progress * progress * progress
          : 1 - Math.pow(-2 * progress + 2, 3) / 2;

        const interpolatedPath = interpolator(easeInOutCubic);
        setCurrentPath(interpolatedPath);

        if (progress < 1) {
          animationRef.current = requestAnimationFrame(animate);
        } else {
          setCurrentShapeIndex(targetIndex);
        }
      };

      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      
      animationRef.current = requestAnimationFrame(animate);
    } catch (error) {
      console.error('Flubber morphing error:', error);
      setCurrentPath(toPath);
      setCurrentShapeIndex(targetIndex);
    }
  };

  // Auto-play functionality
  useEffect(() => {
    if (autoPlay && shapes.length > 1) {
      timeoutRef.current = setTimeout(() => {
        const nextIndex = (currentShapeIndex + 1) % shapes.length;
        morphToShape(nextIndex);
      }, autoPlayInterval);
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [autoPlay, currentShapeIndex, shapes.length, autoPlayInterval]);

  // Cleanup on unmount
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

  // Handle manual shape selection
  const handleShapeClick = (index) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    morphToShape(index);
  };

  if (!shapes.length) {
    return null;
  }

  const currentShape = shapes[currentShapeIndex];
  const viewBox = currentShape.viewBox || `0 0 ${width} ${height}`;

  return (
    <div className={`flex flex-col items-center space-y-4 ${className}`}>
      <svg 
        width={width} 
        height={height} 
        viewBox={viewBox}
        className="transition-all duration-300"
      >
        <path
          ref={pathRef}
          d={currentPath}
          fill={fill}
          stroke={stroke}
          strokeWidth={strokeWidth}
          className="transition-colors duration-300"
        />
      </svg>

      {/* Shape selector buttons */}
      {shapes.length > 1 && (
        <div className="flex space-x-2">
          {shapes.map((shape, index) => (
            <button
              key={index}
              onClick={() => handleShapeClick(index)}
              className={`px-3 py-1 rounded-lg text-sm font-medium transition-all duration-200 ${
                currentShapeIndex === index
                  ? 'bg-blue-600 text-white shadow-md'
                  : isDarkMode
                  ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
              title={shape.name}
            >
              {shape.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default MorphingSVG;
