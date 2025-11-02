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
  Activity,
  Upload,
  ClipboardList,
  Circle,
  Square,
  Triangle,
  Star,
  Heart,
  Smile,
  Frown,
  Sun,
  Moon,
  CloudRain,
  Zap,
  Home,
  MapPin,
  Mail,
  Phone,
  Camera,
  Video,
  Music,
  Play,
  Pause,
  Download,
  Share2
} from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';

const FlubberIconTest = () => {
  const { bg, text, isDarkMode } = useTheme();
  const [currentIconIndex, setCurrentIconIndex] = useState(0);
  const [morphPaths, setMorphPaths] = useState([]); // Array of paths for multi-path morphing
  const [isAnimating, setIsAnimating] = useState(false);
  const [duration, setDuration] = useState(1500);
  const [maxSegmentLength, setMaxSegmentLength] = useState(2);
  const canvasRef = useRef(null);
  const iconRefs = useRef({});

  // Debug: Check refs after render
  useEffect(() => {
    console.log('Component mounted/updated');
    console.log('Icon refs:', iconRefs.current);
    console.log('Number of refs:', Object.keys(iconRefs.current).length);
    
    // Test extraction on mount
    if (iconRefs.current[0]) {
      console.log('Testing extraction on first icon:');
      const testPaths = extractPathsFromIcon(iconRefs.current[0]);
      console.log('Test paths result:', testPaths);
    }
  }, []);

  // Array of icons to test - organized in morph-friendly pairs/sequences
  const icons = [
    // Good morphing pairs - basic shapes
    { name: 'Circle', Icon: Circle },
    { name: 'Square', Icon: Square },
    { name: 'Triangle', Icon: Triangle },
    { name: 'Star', Icon: Star },
    
    // Emotional morphs
    { name: 'Heart', Icon: Heart },
    { name: 'Smile', Icon: Smile },
    { name: 'Frown', Icon: Frown },
    
    // Weather sequence
    { name: 'Sun', Icon: Sun },
    { name: 'Moon', Icon: Moon },
    { name: 'CloudRain', Icon: CloudRain },
    { name: 'Zap', Icon: Zap },
    
    // Location/Communication
    { name: 'Home', Icon: Home },
    { name: 'MapPin', Icon: MapPin },
    { name: 'Mail', Icon: Mail },
    { name: 'Phone', Icon: Phone },
    
    // Media controls
    { name: 'Camera', Icon: Camera },
    { name: 'Video', Icon: Video },
    { name: 'Music', Icon: Music },
    { name: 'Play', Icon: Play },
    { name: 'Pause', Icon: Pause },
    
    // File operations
    { name: 'Upload', Icon: Upload },
    { name: 'Download', Icon: Download },
    { name: 'Share2', Icon: Share2 },
    { name: 'ClipboardList', Icon: ClipboardList },
    
    // Business/Analytics
    { name: 'TrendingUp', Icon: TrendingUp },
    { name: 'BarChart', Icon: BarChart },
    { name: 'PieChart', Icon: PieChart },
    { name: 'Activity', Icon: Activity },
    
    // Office
    { name: 'Users', Icon: Users },
    { name: 'Award', Icon: Award },
    { name: 'FileText', Icon: FileText },
    { name: 'Clock', Icon: Clock },
    { name: 'AlarmClock', Icon: AlarmClock },
    { name: 'Building2', Icon: Building2 },
    { name: 'Bell', Icon: Bell },
    { name: 'Cog', Icon: Cog },
    { name: 'CheckSquare', Icon: CheckSquare },
    { name: 'Calendar', Icon: Calendar }
  ];

  // Extract SVG paths as an array (for multi-path morphing)
  const extractPathsFromIcon = (iconElement) => {
    if (!iconElement) {
      console.log('No icon element');
      return [];
    }
    
    const svg = iconElement.querySelector('svg');
    if (!svg) {
      console.log('No SVG found in element');
      return [];
    }
    
    // Get all path elements
    const paths = svg.querySelectorAll('path, circle, line, rect, polyline, polygon');
    console.log('Found', paths.length, 'path/shape elements');
    
    const pathData = Array.from(paths).map(element => {
      if (element.tagName.toLowerCase() === 'path') {
        return element.getAttribute('d');
      }
      // Convert other shapes to paths
      return convertShapeToPath(element);
    }).filter(Boolean);
    
    console.log('Extracted', pathData.length, 'paths');
    return pathData;
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
    console.log('=== Starting morph ===');
    console.log('iconRefs.current:', iconRefs.current);
    console.log('Current index:', currentIconIndex);
    console.log('Icon refs keys:', Object.keys(iconRefs.current));
    
    setIsAnimating(true);
    const nextIndex = (currentIconIndex + 1) % icons.length;
    
    try {
      console.log('Extracting current icon (index', currentIconIndex, ')');
      const currentPaths = extractPathsFromIcon(iconRefs.current[currentIconIndex]);
      console.log('Extracting next icon (index', nextIndex, ')');
      const nextPaths = extractPathsFromIcon(iconRefs.current[nextIndex]);
      
      console.log('Current paths:', currentPaths);
      console.log('Next paths:', nextPaths);
      
      if (currentPaths.length > 0 && nextPaths.length > 0) {
        // Use flubber's combine or interpolateAll for multiple paths
        let interpolators;
        
        try {
          // If both icons have multiple paths, use separate interpolators for each
          if (currentPaths.length > 1 || nextPaths.length > 1) {
            console.log('Using separate interpolators for', Math.max(currentPaths.length, nextPaths.length), 'paths');
            
            // Match path counts by duplicating the last path if needed
            const maxPaths = Math.max(currentPaths.length, nextPaths.length);
            const paddedCurrentPaths = [...currentPaths];
            const paddedNextPaths = [...nextPaths];
            
            while (paddedCurrentPaths.length < maxPaths) {
              paddedCurrentPaths.push(paddedCurrentPaths[paddedCurrentPaths.length - 1]);
            }
            while (paddedNextPaths.length < maxPaths) {
              paddedNextPaths.push(paddedNextPaths[paddedNextPaths.length - 1]);
            }
            
            // Create an interpolator for each path pair
            interpolators = paddedCurrentPaths.map((currentPath, i) => {
              return flubber.interpolate(currentPath, paddedNextPaths[i], {
                maxSegmentLength: maxSegmentLength
              });
            });
          } else {
            // Single path on both sides
            interpolators = [flubber.interpolate(currentPaths[0], nextPaths[0], {
              maxSegmentLength: maxSegmentLength
            })];
          }
        } catch (e) {
          console.log('Falling back to single path interpolate', e);
          interpolators = [flubber.interpolate(
            currentPaths.join(' '), 
            nextPaths.join(' '),
            { maxSegmentLength: maxSegmentLength }
          )];
        }
        
        // Animate the morph with easing
        const startTime = Date.now();
        
        const animate = () => {
          const elapsed = Date.now() - startTime;
          let progress = Math.min(elapsed / duration, 1);
          
          // Apply easing for smoother animation (ease-in-out)
          progress = progress < 0.5 
            ? 2 * progress * progress 
            : 1 - Math.pow(-2 * progress + 2, 2) / 2;
          
          // Update all paths
          const morphedPaths = interpolators.map(interpolator => interpolator(progress));
          setMorphPaths(morphedPaths);
          
          if (elapsed < duration) {
            requestAnimationFrame(animate);
          } else {
            setCurrentIconIndex(nextIndex);
            setIsAnimating(false);
            setMorphPaths([]);
          }
        };
        
        animate();
      } else {
        console.error('Could not extract paths');
        setCurrentIconIndex(nextIndex);
        setIsAnimating(false);
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
                  {isAnimating ? 'Morphing...' : icons[currentIconIndex].name}
                </span>
              </div>
              
              {/* Morphing or Static Icon Display */}
              <div className={`${bg.primary} rounded-lg p-8 border ${isDarkMode ? 'border-gray-700' : 'border-gray-300'}`}>
                {isAnimating && morphPaths.length > 0 ? (
                  <svg 
                    width="100" 
                    height="100" 
                    viewBox="0 0 24 24"
                    className={text.primary}
                  >
                    {morphPaths.map((pathData, index) => (
                      <path 
                        key={index}
                        d={pathData} 
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    ))}
                  </svg>
                ) : (
                  <CurrentIcon 
                    size={100} 
                    className={text.primary}
                    strokeWidth={2}
                  />
                )}
              </div>
            </div>

            {/* Controls */}
            <div className="w-full space-y-4">
              <div className="flex gap-4 justify-center">
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
              
              {/* Morph Settings */}
              <div className={`${bg.primary} rounded-lg p-4 space-y-3`}>
                <h3 className={`text-sm font-semibold ${text.primary} mb-2`}>Morph Settings</h3>
                
                <div className="space-y-2">
                  <label className={`block text-sm ${text.secondary}`}>
                    Duration: {duration}ms
                  </label>
                  <input
                    type="range"
                    min="500"
                    max="3000"
                    step="100"
                    value={duration}
                    onChange={(e) => setDuration(Number(e.target.value))}
                    className="w-full"
                  />
                </div>
                
                <div className="space-y-2">
                  <label className={`block text-sm ${text.secondary}`}>
                    Smoothness (Max Segment Length): {maxSegmentLength}
                    <span className="text-xs ml-2">(lower = smoother but slower)</span>
                  </label>
                  <input
                    type="range"
                    min="1"
                    max="10"
                    step="0.5"
                    value={maxSegmentLength}
                    onChange={(e) => setMaxSegmentLength(Number(e.target.value))}
                    className="w-full"
                  />
                </div>
              </div>
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
      
      {/* Hidden icons for path extraction */}
      <div style={{ position: 'absolute', visibility: 'hidden', pointerEvents: 'none' }}>
        {icons.map((icon, index) => (
          <div key={index} ref={el => iconRefs.current[index] = el}>
            <icon.Icon size={24} />
          </div>
        ))}
      </div>
    </div>
  );
};

export default FlubberIconTest;
