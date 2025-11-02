import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import * as flubber from 'flubber';
import { 
  TrendingUp, 
  Users, 
  Award, 
  FileText, 
  Clock, 
  AlarmClock, 
  Building2, 
  Bell, 
  Cog, 
  CheckSquare, 
  Calendar,
  BarChart,
  PieChart,
  Activity
} from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';

const FlubberIconTest = () => {
  const { bg, text, isDarkMode } = useTheme();
  const [currentIconIndex, setCurrentIconIndex] = useState(0);
  const [morphPath, setMorphPath] = useState('');
  const [isAnimating, setIsAnimating] = useState(false);
  const canvasRef = useRef(null);

  // Array of icons to test
  const icons = [
    { name: 'TrendingUp', Icon: TrendingUp },
    { name: 'Users', Icon: Users },
    { name: 'Award', Icon: Award },
    { name: 'FileText', Icon: FileText },
    { name: 'Clock', Icon: Clock },
    { name: 'AlarmClock', Icon: AlarmClock },
    { name: 'Building2', Icon: Building2 },
    { name: 'Bell', Icon: Bell },
    { name: 'Cog', Icon: Cog },
    { name: 'CheckSquare', Icon: CheckSquare },
    { name: 'Calendar', Icon: Calendar },
    { name: 'BarChart', Icon: BarChart },
    { name: 'PieChart', Icon: PieChart },
    { name: 'Activity', Icon: Activity }
  ];

  // Extract SVG path from Lucide icon
  const extractPathFromIcon = (IconComponent) => {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    const tempDiv = document.createElement('div');
    tempDiv.style.position = 'absolute';
    tempDiv.style.visibility = 'hidden';
    document.body.appendChild(tempDiv);
    
    // Render the icon
    const iconElement = IconComponent({ size: 100 });
    tempDiv.innerHTML = iconElement.props.children.map(child => {
      if (typeof child === 'string') return child;
      const el = document.createElement(child.type);
      Object.entries(child.props).forEach(([key, value]) => {
        if (key !== 'children') el.setAttribute(key, value);
      });
      return el.outerHTML;
    }).join('');
    
    // Get all path elements
    const paths = tempDiv.querySelectorAll('path, circle, line, rect, polyline, polygon');
    const pathData = Array.from(paths).map(path => {
      if (path.tagName === 'path') return path.getAttribute('d');
      // Convert other shapes to paths
      return convertShapeToPath(path);
    }).filter(Boolean);
    
    document.body.removeChild(tempDiv);
    return pathData.join(' ');
  };

  // Convert basic shapes to path data
  const convertShapeToPath = (element) => {
    const tag = element.tagName.toLowerCase();
    
    if (tag === 'circle') {
      const cx = parseFloat(element.getAttribute('cx'));
      const cy = parseFloat(element.getAttribute('cy'));
      const r = parseFloat(element.getAttribute('r'));
      return `M ${cx - r},${cy} a ${r},${r} 0 1,0 ${r * 2},0 a ${r},${r} 0 1,0 ${-r * 2},0`;
    }
    
    if (tag === 'line') {
      const x1 = element.getAttribute('x1');
      const y1 = element.getAttribute('y1');
      const x2 = element.getAttribute('x2');
      const y2 = element.getAttribute('y2');
      return `M ${x1},${y1} L ${x2},${y2}`;
    }
    
    if (tag === 'rect') {
      const x = parseFloat(element.getAttribute('x') || 0);
      const y = parseFloat(element.getAttribute('y') || 0);
      const w = parseFloat(element.getAttribute('width'));
      const h = parseFloat(element.getAttribute('height'));
      return `M ${x},${y} L ${x + w},${y} L ${x + w},${y + h} L ${x},${y + h} Z`;
    }
    
    if (tag === 'polyline' || tag === 'polygon') {
      const points = element.getAttribute('points').trim().split(/\s+/);
      const commands = points.map((point, i) => {
        const [x, y] = point.split(',');
        return `${i === 0 ? 'M' : 'L'} ${x},${y}`;
      });
      if (tag === 'polygon') commands.push('Z');
      return commands.join(' ');
    }
    
    return null;
  };

  // Morph to next icon
  const morphToNext = () => {
    setIsAnimating(true);
    const nextIndex = (currentIconIndex + 1) % icons.length;
    
    try {
      const currentPath = extractPathFromIcon(icons[currentIconIndex].Icon);
      const nextPath = extractPathFromIcon(icons[nextIndex].Icon);
      
      if (currentPath && nextPath) {
        const interpolator = flubber.interpolate(currentPath, nextPath, {
          maxSegmentLength: 5
        });
        
        // Animate the morph
        const duration = 1000;
        const startTime = Date.now();
        
        const animate = () => {
          const elapsed = Date.now() - startTime;
          const progress = Math.min(elapsed / duration, 1);
          
          setMorphPath(interpolator(progress));
          
          if (progress < 1) {
            requestAnimationFrame(animate);
          } else {
            setCurrentIconIndex(nextIndex);
            setIsAnimating(false);
          }
        };
        
        animate();
      }
    } catch (error) {
      console.error('Morph error:', error);
      setCurrentIconIndex(nextIndex);
      setIsAnimating(false);
    }
  };

  const CurrentIcon = icons[currentIconIndex].Icon;

  return (
    <div className={`min-h-screen ${bg.primary} p-8`}>
      <div className="max-w-4xl mx-auto">
        <h1 className={`text-3xl font-bold ${text.primary} mb-8`}>
          Flubber Icon Morphing Test
        </h1>
        
        <div className={`${bg.secondary} rounded-lg shadow-lg p-8`}>
          <div className="flex flex-col items-center space-y-8">
            {/* Display Area */}
            <div className="relative">
              <div className="text-center mb-4">
                <span className={`text-lg font-semibold ${text.primary}`}>
                  {icons[currentIconIndex].name}
                </span>
              </div>
              
              {/* Original Icon Display */}
              <div className={`${bg.primary} rounded-lg p-8 border ${isDarkMode ? 'border-gray-700' : 'border-gray-300'}`}>
                <CurrentIcon 
                  size={100} 
                  className={text.primary}
                  strokeWidth={2}
                />
              </div>
            </div>

            {/* Morphing SVG Display */}
            {morphPath && (
              <div className={`${bg.primary} rounded-lg p-8 border ${isDarkMode ? 'border-gray-700' : 'border-gray-300'}`}>
                <svg 
                  width="100" 
                  height="100" 
                  viewBox="0 0 24 24"
                  className={text.primary}
                >
                  <path 
                    d={morphPath} 
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
            )}

            {/* Controls */}
            <div className="flex gap-4">
              <button
                onClick={morphToNext}
                disabled={isAnimating}
                className={`
                  px-6 py-3 rounded-lg font-medium
                  ${isAnimating 
                    ? 'bg-gray-400 cursor-not-allowed' 
                    : 'bg-blue-600 hover:bg-blue-700'}
                  text-white transition-colors
                `}
              >
                {isAnimating ? 'Morphing...' : 'Morph to Next Icon'}
              </button>
              
              <button
                onClick={() => setCurrentIconIndex((currentIconIndex + 1) % icons.length)}
                className="px-6 py-3 rounded-lg font-medium bg-gray-600 hover:bg-gray-700 text-white transition-colors"
              >
                Skip to Next
              </button>
            </div>

            {/* Icon Grid */}
            <div className="w-full">
              <h2 className={`text-xl font-semibold ${text.primary} mb-4`}>
                Available Icons
              </h2>
              <div className="grid grid-cols-4 md:grid-cols-7 gap-4">
                {icons.map((icon, index) => (
                  <button
                    key={icon.name}
                    onClick={() => setCurrentIconIndex(index)}
                    className={`
                      p-4 rounded-lg transition-all
                      ${currentIconIndex === index 
                        ? 'bg-blue-600 text-white' 
                        : `${bg.primary} ${text.primary} hover:bg-blue-100 ${isDarkMode ? 'hover:bg-gray-700' : ''}`
                      }
                    `}
                    title={icon.name}
                  >
                    <icon.Icon size={24} />
                  </button>
                ))}
              </div>
            </div>

            {/* Info */}
            <div className={`w-full p-4 rounded-lg ${isDarkMode ? 'bg-yellow-900/20' : 'bg-yellow-100'} border ${isDarkMode ? 'border-yellow-700' : 'border-yellow-300'}`}>
              <p className={`text-sm ${isDarkMode ? 'text-yellow-200' : 'text-yellow-800'}`}>
                <strong>Note:</strong> Lucide icons use SVG primitives (paths, lines, circles) that need to be converted to path data for flubber morphing. 
                Complex icons with multiple elements may not morph smoothly.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FlubberIconTest;
