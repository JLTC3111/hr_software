import React, { useState, useRef, useEffect, useCallback } from 'react'
import { Clock, Heart, AlertCircle, TreePalm, Car, Salad, Clapperboard, Laptop, Form, PhoneCall, CupSoda, Grape, BicepsFlexed, Flame, DatabaseZap, Loader, HouseWifi, Funnel, HeartPlus, Coffee, AlarmClock, Gauge, BriefcaseBusiness, WifiPen, TrendingUp, LineChart, BatteryCharging, PersonStanding, Volleyball, FileUser } from 'lucide-react'
import StatsCard from './statsCard.jsx'
import MetricDetailModal from './metricDetailModal.jsx'
import { useTheme } from '../contexts/ThemeContext'
import { useLanguage } from '../contexts/LanguageContext'
import { Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Line, ComposedChart } from 'recharts'
import * as timeTrackingService from '../services/timeTrackingService'
import * as flubber from 'flubber';
import { AnimatedClockIcon, AnimatedAlarmClockIcon } from './timeClockEntry.jsx'
import { AnimatedCoffeeIcon, MiniFlubberMorphingLeaveStatus } from './timeTracking.jsx';
import { MiniFlubberAutoMorphInProgress,MiniFlubberAutoMorphEmployees } from './taskReview.jsx'
import { useVisibilityRefresh } from '../hooks/useVisibilityRefresh';
import { getDemoEmployeeName } from '../utils/demoHelper';

export const MiniFlubberAutoMorphVacation = ({
  size = 24,
  className = '',
  isDarkMode = false,
  autoMorphInterval = 10000, 
  morphDuration = 4500, 
}) => {
  const [currentIconIndex, setCurrentIconIndex] = useState(0);
  const [morphPaths, setMorphPaths] = useState([]);
  const [isAnimating, setIsAnimating] = useState(false);
  const [maxSegmentLength] = useState(2);
  const iconRefs = useRef({});
  const animationFrameRef = useRef(null);
  const autoMorphTimerRef = useRef(null);

  /** ---------------------------
   * Dynamic Color Selection
   ----------------------------*/
  const getColor = (icon) => {
    if (icon.status === 'approved') {
      return isDarkMode ? 'text-green-400' : 'text-green-700';
    }
    if (icon.status === 'rejected') {
      return isDarkMode ? 'text-red-400' : 'text-red-700';
    }
    if (icon.status === 'standard') {
      return isDarkMode ? 'text-white' : 'text-black';
    }
    return isDarkMode ? 'text-white' : 'text-black';
  };

  /** Icon definitions */
  const icons = [
    { name: 'Coffee', Icon: Coffee, status: 'standard' },
    { name: 'Good Food', Icon: Salad, status: 'standard' },
    { name: 'Travel', Icon: Car, status: 'standard' },
    { name: 'Beach Ball', Icon: Volleyball, status: 'standard' },
    { name: 'Coconut Tree', Icon: TreePalm, status: 'standard' },
    { name: 'Movie', Icon: Clapperboard, status: 'standard' },
  ];

  /** Extract SVG paths for morphing */
  const extractPathsFromIcon = (iconElement) => {
    if (!iconElement) return [];
    const svg = iconElement.querySelector('svg');
    if (!svg) return [];

    const elements = svg.querySelectorAll(
      'path, circle, line, rect, polyline, polygon'
    );

    const paths = Array.from(elements)
      .map((element) => {
        if (element.tagName.toLowerCase() === 'path') {
          return element.getAttribute('d');
        }
        return convertShapeToPath(element);
      })
      .filter(Boolean);

    return paths;
  };

  /** Convert non-path shapes to path data */
  const convertShapeToPath = (element) => {
    const tag = element.tagName.toLowerCase();

    if (tag === 'circle') {
      const cx = parseFloat(element.getAttribute('cx'));
      const cy = parseFloat(element.getAttribute('cy'));
      const r = parseFloat(element.getAttribute('r'));
      return `M ${cx - r},${cy} a ${r},${r} 0 1,0 ${r * 2},0 a ${r},${r} 0 1,0 ${-r * 2},0`;
    }

    if (tag === 'line') {
      return `M ${element.getAttribute('x1')},${element.getAttribute(
        'y1'
      )} L ${element.getAttribute('x2')},${element.getAttribute('y2')}`;
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
      const cmds = points.map((p, i) => {
        const [x, y] = p.split(',');
        return `${i === 0 ? 'M' : 'L'} ${x},${y}`;
      });
      if (tag === 'polygon') cmds.push('Z');
      return cmds.join(' ');
    }

    return null;
  };

  /** Morph animation logic */
  const morphToIndex = (targetIndex) => {
    if (isAnimating || currentIconIndex === targetIndex) return;

    setIsAnimating(true);

    const currentPaths = extractPathsFromIcon(iconRefs.current[currentIconIndex]);
    const nextPaths = extractPathsFromIcon(iconRefs.current[targetIndex]);

    if (!currentPaths.length || !nextPaths.length) {
      setCurrentIconIndex(targetIndex);
      setIsAnimating(false);
      return;
    }

    let interpolators;

    try {
      const maxPaths = Math.max(currentPaths.length, nextPaths.length);
      const paddedCurrent = [...currentPaths];
      const paddedNext = [...nextPaths];

      while (paddedCurrent.length < maxPaths) {
        paddedCurrent.push(paddedCurrent[paddedCurrent.length - 1]);
      }
      while (paddedNext.length < maxPaths) {
        paddedNext.push(paddedNext[paddedNext.length - 1]);
      }

      interpolators = paddedCurrent.map((c, i) =>
        flubber.interpolate(c, paddedNext[i], { maxSegmentLength })
      );
    } catch {
      interpolators = [
        flubber.interpolate(currentPaths.join(' '), nextPaths.join(' '), {
          maxSegmentLength,
        }),
      ];
    }

    const start = Date.now();

    const animate = () => {
      const elapsed = Date.now() - start;
      let t = Math.min(elapsed / morphDuration, 1);

      // easeInOutQuad
      t = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

      const morphed = interpolators.map((fn) => fn(t));
      setMorphPaths(morphed);

      if (elapsed < morphDuration) {
        animationFrameRef.current = requestAnimationFrame(animate);
      } else {
        setCurrentIconIndex(targetIndex);
        setIsAnimating(false);
        setMorphPaths([]);
      }
    };

    animate();
  };

  /** Auto-morph to next icon */
  const morphToNext = () => {
    const nextIndex = (currentIconIndex + 1) % icons.length;
    morphToIndex(nextIndex);
  };

  /** Set up auto-morphing interval */
  useEffect(() => {
    autoMorphTimerRef.current = setInterval(() => {
      morphToNext();
    }, autoMorphInterval);

    return () => {
      if (autoMorphTimerRef.current) {
        clearInterval(autoMorphTimerRef.current);
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [currentIconIndex, autoMorphInterval]);

  const CurrentIcon = icons[currentIconIndex].Icon;
  const currentColor = getColor(icons[currentIconIndex]);

  return (
    <div className={`inline-block ${className}`}>
      <div className="relative">
        {isAnimating && morphPaths.length > 0 ? (
          <svg
            width={size}
            height={size}
            viewBox="0 0 24 24"
            className={currentColor}
            stroke="currentColor"
            color="currentColor"
          >
            {morphPaths.map((d, i) => (
              <path
                key={i}
                d={d}
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ))}
          </svg>
        ) : (
          <CurrentIcon
            size={size}
            className={currentColor}
            stroke="currentColor"
            strokeWidth={1.5}
          />
        )}
      </div>

      {/* Hidden icons for path extraction */}
      <div
        style={{
          position: 'absolute',
          visibility: 'hidden',
          pointerEvents: 'none',
          left: '-9999px',
        }}
      >
        {icons.map((icon, i) => (
          <div key={i} ref={(el) => (iconRefs.current[i] = el)}>
            <icon.Icon size={24} />
          </div>
        ))}
      </div>
    </div>
  );
};

export const MiniFlubberAutoMorphOfficeWork = ({
  size = 24,
  className = '',
  isDarkMode = false,
  autoMorphInterval = 10000, 
  morphDuration = 4500, 
}) => {
  const [currentIconIndex, setCurrentIconIndex] = useState(0);
  const [morphPaths, setMorphPaths] = useState([]);
  const [isAnimating, setIsAnimating] = useState(false);
  const [maxSegmentLength] = useState(2);
  const iconRefs = useRef({});
  const animationFrameRef = useRef(null);
  const autoMorphTimerRef = useRef(null);

  /** ---------------------------
   * Dynamic Color Selection
   ----------------------------*/
  const getColor = (icon) => {
    if (icon.status === 'approved') {
      return isDarkMode ? 'text-green-400' : 'text-green-700';
    }
    if (icon.status === 'rejected') {
      return isDarkMode ? 'text-red-400' : 'text-red-700';
    }
    if (icon.status === 'standard') {
      return isDarkMode ? 'text-white' : 'text-black';
    }
    return isDarkMode ? 'text-white' : 'text-black';
  };

  /** Icon definitions */
  const icons = [
    { name: 'Alarm Clock', Icon: AlarmClock, status: 'standard' },
    { name: 'Computer', Icon: Laptop, status: 'standard' },
    { name: 'Drink', Icon: CupSoda, status: 'standard' },
    { name: 'Document', Icon: Form, status: 'standard' },
    { name: 'Phone Calls', Icon: PhoneCall, status: 'standard' },
  ];

  /** Extract SVG paths for morphing */
  const extractPathsFromIcon = (iconElement) => {
    if (!iconElement) return [];
    const svg = iconElement.querySelector('svg');
    if (!svg) return [];

    const elements = svg.querySelectorAll(
      'path, circle, line, rect, polyline, polygon'
    );

    const paths = Array.from(elements)
      .map((element) => {
        if (element.tagName.toLowerCase() === 'path') {
          return element.getAttribute('d');
        }
        return convertShapeToPath(element);
      })
      .filter(Boolean);

    return paths;
  };

  /** Convert non-path shapes to path data */
  const convertShapeToPath = (element) => {
    const tag = element.tagName.toLowerCase();

    if (tag === 'circle') {
      const cx = parseFloat(element.getAttribute('cx'));
      const cy = parseFloat(element.getAttribute('cy'));
      const r = parseFloat(element.getAttribute('r'));
      return `M ${cx - r},${cy} a ${r},${r} 0 1,0 ${r * 2},0 a ${r},${r} 0 1,0 ${-r * 2},0`;
    }

    if (tag === 'line') {
      return `M ${element.getAttribute('x1')},${element.getAttribute(
        'y1'
      )} L ${element.getAttribute('x2')},${element.getAttribute('y2')}`;
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
      const cmds = points.map((p, i) => {
        const [x, y] = p.split(',');
        return `${i === 0 ? 'M' : 'L'} ${x},${y}`;
      });
      if (tag === 'polygon') cmds.push('Z');
      return cmds.join(' ');
    }

    return null;
  };

  /** Morph animation logic */
  const morphToIndex = (targetIndex) => {
    if (isAnimating || currentIconIndex === targetIndex) return;

    setIsAnimating(true);

    const currentPaths = extractPathsFromIcon(iconRefs.current[currentIconIndex]);
    const nextPaths = extractPathsFromIcon(iconRefs.current[targetIndex]);

    if (!currentPaths.length || !nextPaths.length) {
      setCurrentIconIndex(targetIndex);
      setIsAnimating(false);
      return;
    }

    let interpolators;

    try {
      const maxPaths = Math.max(currentPaths.length, nextPaths.length);
      const paddedCurrent = [...currentPaths];
      const paddedNext = [...nextPaths];

      while (paddedCurrent.length < maxPaths) {
        paddedCurrent.push(paddedCurrent[paddedCurrent.length - 1]);
      }
      while (paddedNext.length < maxPaths) {
        paddedNext.push(paddedNext[paddedNext.length - 1]);
      }

      interpolators = paddedCurrent.map((c, i) =>
        flubber.interpolate(c, paddedNext[i], { maxSegmentLength })
      );
    } catch {
      interpolators = [
        flubber.interpolate(currentPaths.join(' '), nextPaths.join(' '), {
          maxSegmentLength,
        }),
      ];
    }

    const start = Date.now();

    const animate = () => {
      const elapsed = Date.now() - start;
      let t = Math.min(elapsed / morphDuration, 1);

      // easeInOutQuad
      t = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

      const morphed = interpolators.map((fn) => fn(t));
      setMorphPaths(morphed);

      if (elapsed < morphDuration) {
        animationFrameRef.current = requestAnimationFrame(animate);
      } else {
        setCurrentIconIndex(targetIndex);
        setIsAnimating(false);
        setMorphPaths([]);
      }
    };

    animate();
  };

  /** Auto-morph to next icon */
  const morphToNext = () => {
    const nextIndex = (currentIconIndex + 1) % icons.length;
    morphToIndex(nextIndex);
  };

  /** Set up auto-morphing interval */
  useEffect(() => {
    autoMorphTimerRef.current = setInterval(() => {
      morphToNext();
    }, autoMorphInterval);

    return () => {
      if (autoMorphTimerRef.current) {
        clearInterval(autoMorphTimerRef.current);
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [currentIconIndex, autoMorphInterval]);

  const CurrentIcon = icons[currentIconIndex].Icon;
  const currentColor = getColor(icons[currentIconIndex]);

  return (
    <div className={`inline-block ${className}`}>
      <div className="relative">
        {isAnimating && morphPaths.length > 0 ? (
          <svg
            width={size}
            height={size}
            viewBox="0 0 24 24"
            className={currentColor}
            stroke="currentColor"
            color="currentColor"
          >
            {morphPaths.map((d, i) => (
              <path
                key={i}
                d={d}
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ))}
          </svg>
        ) : (
          <CurrentIcon
            size={size}
            className={currentColor}
            stroke="currentColor"
            strokeWidth={1.5}
          />
        )}
      </div>

      {/* Hidden icons for path extraction */}
      <div
        style={{
          position: 'absolute',
          visibility: 'hidden',
          pointerEvents: 'none',
          left: '-9999px',
        }}
      >
        {icons.map((icon, i) => (
          <div key={i} ref={(el) => (iconRefs.current[i] = el)}>
            <icon.Icon size={24} />
          </div>
        ))}
      </div>
    </div>
  );
};

export const MiniFlubberAutoMorphOverTime = ({
  size = 24,
  className = '',
  isDarkMode = false,
  autoMorphInterval = 10000, 
  morphDuration = 4500, 
}) => {
  const [currentIconIndex, setCurrentIconIndex] = useState(0);
  const [morphPaths, setMorphPaths] = useState([]);
  const [isAnimating, setIsAnimating] = useState(false);
  const [maxSegmentLength] = useState(2);
  const iconRefs = useRef({});
  const animationFrameRef = useRef(null);
  const autoMorphTimerRef = useRef(null);

  /** ---------------------------
   * Dynamic Color Selection
   ----------------------------*/
  const getColor = (icon) => {
    if (icon.status === 'approved') {
      return isDarkMode ? 'text-green-400' : 'text-green-700';
    }
    if (icon.status === 'rejected') {
      return isDarkMode ? 'text-red-400' : 'text-red-700';
    }
    if (icon.status === 'standard') {
      return isDarkMode ? 'text-white' : 'text-black';
    }
    return isDarkMode ? 'text-white' : 'text-black';
  };

  /** Icon definitions */
  const icons = [
    { name: 'heart', Icon: Heart, status: 'standard' },
    { name: 'heartPlus', Icon: HeartPlus, status: 'standard' },
    { name: 'person', Icon: PersonStanding, status: 'standard' },
    { name: 'house', Icon: HouseWifi, status: 'standard' },
    { name: 'fire', Icon: Flame, status: 'standard' },
  ];

  /** Extract SVG paths for morphing */
  const extractPathsFromIcon = (iconElement) => {
    if (!iconElement) return [];
    const svg = iconElement.querySelector('svg');
    if (!svg) return [];

    const elements = svg.querySelectorAll(
      'path, circle, line, rect, polyline, polygon'
    );

    const paths = Array.from(elements)
      .map((element) => {
        if (element.tagName.toLowerCase() === 'path') {
          return element.getAttribute('d');
        }
        return convertShapeToPath(element);
      })
      .filter(Boolean);

    return paths;
  };

  /** Convert non-path shapes to path data */
  const convertShapeToPath = (element) => {
    const tag = element.tagName.toLowerCase();

    if (tag === 'circle') {
      const cx = parseFloat(element.getAttribute('cx'));
      const cy = parseFloat(element.getAttribute('cy'));
      const r = parseFloat(element.getAttribute('r'));
      return `M ${cx - r},${cy} a ${r},${r} 0 1,0 ${r * 2},0 a ${r},${r} 0 1,0 ${-r * 2},0`;
    }

    if (tag === 'line') {
      return `M ${element.getAttribute('x1')},${element.getAttribute(
        'y1'
      )} L ${element.getAttribute('x2')},${element.getAttribute('y2')}`;
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
      const cmds = points.map((p, i) => {
        const [x, y] = p.split(',');
        return `${i === 0 ? 'M' : 'L'} ${x},${y}`;
      });
      if (tag === 'polygon') cmds.push('Z');
      return cmds.join(' ');
    }

    return null;
  };

  /** Morph animation logic */
  const morphToIndex = (targetIndex) => {
    if (isAnimating || currentIconIndex === targetIndex) return;

    setIsAnimating(true);

    const currentPaths = extractPathsFromIcon(iconRefs.current[currentIconIndex]);
    const nextPaths = extractPathsFromIcon(iconRefs.current[targetIndex]);

    if (!currentPaths.length || !nextPaths.length) {
      setCurrentIconIndex(targetIndex);
      setIsAnimating(false);
      return;
    }

    let interpolators;

    try {
      const maxPaths = Math.max(currentPaths.length, nextPaths.length);
      const paddedCurrent = [...currentPaths];
      const paddedNext = [...nextPaths];

      while (paddedCurrent.length < maxPaths) {
        paddedCurrent.push(paddedCurrent[paddedCurrent.length - 1]);
      }
      while (paddedNext.length < maxPaths) {
        paddedNext.push(paddedNext[paddedNext.length - 1]);
      }

      interpolators = paddedCurrent.map((c, i) =>
        flubber.interpolate(c, paddedNext[i], { maxSegmentLength })
      );
    } catch {
      interpolators = [
        flubber.interpolate(currentPaths.join(' '), nextPaths.join(' '), {
          maxSegmentLength,
        }),
      ];
    }

    const start = Date.now();

    const animate = () => {
      const elapsed = Date.now() - start;
      let t = Math.min(elapsed / morphDuration, 1);

      // easeInOutQuad
      t = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

      const morphed = interpolators.map((fn) => fn(t));
      setMorphPaths(morphed);

      if (elapsed < morphDuration) {
        animationFrameRef.current = requestAnimationFrame(animate);
      } else {
        setCurrentIconIndex(targetIndex);
        setIsAnimating(false);
        setMorphPaths([]);
      }
    };

    animate();
  };

  /** Auto-morph to next icon */
  const morphToNext = () => {
    const nextIndex = (currentIconIndex + 1) % icons.length;
    morphToIndex(nextIndex);
  };

  /** Set up auto-morphing interval */
  useEffect(() => {
    autoMorphTimerRef.current = setInterval(() => {
      morphToNext();
    }, autoMorphInterval);

    return () => {
      if (autoMorphTimerRef.current) {
        clearInterval(autoMorphTimerRef.current);
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [currentIconIndex, autoMorphInterval]);

  const CurrentIcon = icons[currentIconIndex].Icon;
  const currentColor = getColor(icons[currentIconIndex]);

  return (
    <div className={`inline-block ${className}`}>
      <div className="relative">
        {isAnimating && morphPaths.length > 0 ? (
          <svg
            width={size}
            height={size}
            viewBox="0 0 24 24"
            className={currentColor}
            stroke="currentColor"
            color="currentColor"
          >
            {morphPaths.map((d, i) => (
              <path
                key={i}
                d={d}
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ))}
          </svg>
        ) : (
          <CurrentIcon
            size={size}
            className={currentColor}
            stroke="currentColor"
            strokeWidth={1.5}
          />
        )}
      </div>

      {/* Hidden icons for path extraction */}
      <div
        style={{
          position: 'absolute',
          visibility: 'hidden',
          pointerEvents: 'none',
          left: '-9999px',
        }}
      >
        {icons.map((icon, i) => (
          <div key={i} ref={(el) => (iconRefs.current[i] = el)}>
            <icon.Icon size={24} />
          </div>
        ))}
      </div>
    </div>
  );
};

export const MiniFlubberAutoMorphPerformance = ({
  size = 24,
  className = '',
  isDarkMode = false,
  autoMorphInterval = 10000,
  morphDuration = 4500, 
}) => {
  const [currentIconIndex, setCurrentIconIndex] = useState(0);
  const [morphPaths, setMorphPaths] = useState([]);
  const [isAnimating, setIsAnimating] = useState(false);
  const [maxSegmentLength] = useState(2);
  const iconRefs = useRef({});
  const animationFrameRef = useRef(null);
  const autoMorphTimerRef = useRef(null);

  /** ---------------------------
   * Dynamic Color Selection
   ----------------------------*/
  const getColor = (icon) => {
    if (icon.status === 'approved') {
      return isDarkMode ? 'text-green-400' : 'text-green-700';
    }
    if (icon.status === 'rejected') {
      return isDarkMode ? 'text-red-400' : 'text-red-700';
    }
    if (icon.status === 'standard') {
      return isDarkMode ? 'text-white' : 'text-black';
    }
    return isDarkMode ? 'text-white' : 'text-black';
  };

  /** Icon definitions */
  const icons = [
    { name: 'LineChart', Icon: LineChart, status: 'standard' },
    { name: 'Briefcase', Icon: BriefcaseBusiness, status: 'standard' },
    { name: 'Speedometer', Icon: Gauge, status: 'standard' },
    { name: 'Database', Icon: DatabaseZap, status: 'standard' },
    { name: 'Battery', Icon: BatteryCharging, status: 'standard' },
    { name: 'WifiPen', Icon: WifiPen, status: 'standard' },
    { name: 'TrendingUp', Icon: TrendingUp, status: 'standard' },
  ];

  /** Extract SVG paths for morphing */
  const extractPathsFromIcon = (iconElement) => {
    if (!iconElement) return [];
    const svg = iconElement.querySelector('svg');
    if (!svg) return [];

    const elements = svg.querySelectorAll(
      'path, circle, line, rect, polyline, polygon'
    );

    const paths = Array.from(elements)
      .map((element) => {
        if (element.tagName.toLowerCase() === 'path') {
          return element.getAttribute('d');
        }
        return convertShapeToPath(element);
      })
      .filter(Boolean);

    return paths;
  };

  /** Convert non-path shapes to path data */
  const convertShapeToPath = (element) => {
    const tag = element.tagName.toLowerCase();

    if (tag === 'circle') {
      const cx = parseFloat(element.getAttribute('cx'));
      const cy = parseFloat(element.getAttribute('cy'));
      const r = parseFloat(element.getAttribute('r'));
      return `M ${cx - r},${cy} a ${r},${r} 0 1,0 ${r * 2},0 a ${r},${r} 0 1,0 ${-r * 2},0`;
    }

    if (tag === 'line') {
      return `M ${element.getAttribute('x1')},${element.getAttribute(
        'y1'
      )} L ${element.getAttribute('x2')},${element.getAttribute('y2')}`;
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
      const cmds = points.map((p, i) => {
        const [x, y] = p.split(',');
        return `${i === 0 ? 'M' : 'L'} ${x},${y}`;
      });
      if (tag === 'polygon') cmds.push('Z');
      return cmds.join(' ');
    }

    return null;
  };

  /** Morph animation logic */
  const morphToIndex = (targetIndex) => {
    if (isAnimating || currentIconIndex === targetIndex) return;

    setIsAnimating(true);

    const currentPaths = extractPathsFromIcon(iconRefs.current[currentIconIndex]);
    const nextPaths = extractPathsFromIcon(iconRefs.current[targetIndex]);

    if (!currentPaths.length || !nextPaths.length) {
      setCurrentIconIndex(targetIndex);
      setIsAnimating(false);
      return;
    }

    let interpolators;

    try {
      const maxPaths = Math.max(currentPaths.length, nextPaths.length);
      const paddedCurrent = [...currentPaths];
      const paddedNext = [...nextPaths];

      while (paddedCurrent.length < maxPaths) {
        paddedCurrent.push(paddedCurrent[paddedCurrent.length - 1]);
      }
      while (paddedNext.length < maxPaths) {
        paddedNext.push(paddedNext[paddedNext.length - 1]);
      }

      interpolators = paddedCurrent.map((c, i) =>
        flubber.interpolate(c, paddedNext[i], { maxSegmentLength })
      );
    } catch {
      interpolators = [
        flubber.interpolate(currentPaths.join(' '), nextPaths.join(' '), {
          maxSegmentLength,
        }),
      ];
    }

    const start = Date.now();

    const animate = () => {
      const elapsed = Date.now() - start;
      let t = Math.min(elapsed / morphDuration, 1);

      // easeInOutQuad
      t = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

      const morphed = interpolators.map((fn) => fn(t));
      setMorphPaths(morphed);

      if (elapsed < morphDuration) {
        animationFrameRef.current = requestAnimationFrame(animate);
      } else {
        setCurrentIconIndex(targetIndex);
        setIsAnimating(false);
        setMorphPaths([]);
      }
    };

    animate();
  };

  /** Auto-morph to next icon */
  const morphToNext = () => {
    const nextIndex = (currentIconIndex + 1) % icons.length;
    morphToIndex(nextIndex);
  };

  /** Set up auto-morphing interval */
  useEffect(() => {
    autoMorphTimerRef.current = setInterval(() => {
      morphToNext();
    }, autoMorphInterval);

    return () => {
      if (autoMorphTimerRef.current) {
        clearInterval(autoMorphTimerRef.current);
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [currentIconIndex, autoMorphInterval]);

  const CurrentIcon = icons[currentIconIndex].Icon;
  const currentColor = getColor(icons[currentIconIndex]);

  return (
    <div className={`inline-block ${className}`}>
      <div className="relative">
        {isAnimating && morphPaths.length > 0 ? (
          <svg
            width={size}
            height={size}
            viewBox="0 0 24 24"
            className={currentColor}
            stroke="currentColor"
            color="currentColor"
          >
            {morphPaths.map((d, i) => (
              <path
                key={i}
                d={d}
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ))}
          </svg>
        ) : (
          <CurrentIcon
            size={size}
            className={currentColor}
            stroke="currentColor"
            strokeWidth={1.5}
          />
        )}
      </div>

      {/* Hidden icons for path extraction */}
      <div
        style={{
          position: 'absolute',
          visibility: 'hidden',
          pointerEvents: 'none',
          left: '-9999px',
        }}
      >
        {icons.map((icon, i) => (
          <div key={i} ref={(el) => (iconRefs.current[i] = el)}>
            <icon.Icon size={24} />
          </div>
        ))}
      </div>
    </div>
  );
};

const Dashboard = ({ employees, applications }) => {
  const { isDarkMode, bg, text, border } = useTheme();
  const { t } = useLanguage();
  
  const [loading, setLoading] = useState(true);
  const [timeTrackingData, setTimeTrackingData] = useState({});
  const [allEmployeesData, setAllEmployeesData] = useState([]);
  const [leaveRequestsData, setLeaveRequestsData] = useState({});
  const [pendingApprovalsCount, setPendingApprovalsCount] = useState(0);
  const [pendingApprovals, setPendingApprovals] = useState([]);
  
  const [modalOpen, setModalOpen] = useState(false);
  const [modalConfig, setModalConfig] = useState({ type: '', data: [], title: '' });
  
  const currentDate = new Date();
  const [selectedMonth, setSelectedMonth] = useState(currentDate.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear());

  // Define fetch function that can be reused
  const fetchDashboardData = useCallback(async () => {
    if (employees.length === 0) return;
    
    setLoading(true);
    try {
      
      // Fetch time tracking summaries for all employees for SELECTED month
      const summariesPromises = employees.map(emp => 
        timeTrackingService.getTimeTrackingSummary(String(emp.id), selectedMonth, selectedYear)
      );
      
      const summariesResults = await Promise.all(summariesPromises);
      
      // Fetch leave requests for all employees
      const leavePromises = employees.map(emp => 
        timeTrackingService.getLeaveRequests(String(emp.id), {
          year: selectedYear
        })
        );
        const leaveResults = await Promise.all(leavePromises);
        
        // Calculate leave days from leave_requests (pending + approved)
        const leaveData = {};
        leaveResults.forEach((result, index) => {
          const emp = employees[index];
          const empId = String(emp.id);
          
          if (result.success && result.data) {
            // Calculate leave days for current month (pending + approved)
            const leaveDays = result.data.reduce((total, req) => {
              if (req.status === 'rejected') return total;
              
              const startDate = new Date(req.start_date);
              const reqMonth = startDate.getMonth() + 1;
              const reqYear = startDate.getFullYear();
              
              // Only count if within SELECTED month/year
              if (reqYear === selectedYear && reqMonth === selectedMonth) {
                return total + (req.days_count || 0);
              }
              return total;
            }, 0);
            
            leaveData[empId] = leaveDays;
          } else {
            leaveData[empId] = 0;
          }
        });
        
        setLeaveRequestsData(leaveData);
        
        // Build timeTrackingData object - use string IDs for consistency with TEXT type
        const trackingData = {};
        const employeesDataArray = [];
        summariesResults.forEach((result, index) => {
          const emp = employees[index];
          const empId = String(emp.id); // Ensure ID is string for TEXT type
          
          if (result.success && result.data) {
            trackingData[empId] = {
              workDays: result.data.days_worked || 0,
              leaveDays: leaveData[empId] || 0, // Use calculated leave days
              overtime: result.data.overtime_hours || 0,
              holidayOvertime: result.data.holiday_overtime_hours || 0,
              regularHours: result.data.regular_hours || 0,
              totalHours: result.data.total_hours || 0,
              performance: emp.performance || 4.0
            };
            employeesDataArray.push({
              employee: emp,
              data: result.data
            });
          } else {
            // Fallback to defaults if no data
            trackingData[empId] = {
              workDays: 0,
              leaveDays: leaveData[empId] || 0, // Use calculated leave days
              overtime: 0,
              holidayOvertime: 0,
              regularHours: 0,
              totalHours: 0,
              performance: emp.performance || 4.0
            };
            employeesDataArray.push({
              employee: emp,
              data: null
            });
          }
        });
        
        setAllEmployeesData(employeesDataArray);
        setTimeTrackingData(trackingData);
        
        // Fetch pending approvals count and details
        const approvalsResult = await timeTrackingService.getPendingApprovalsCount();
        if (approvalsResult.success) {
          setPendingApprovalsCount(approvalsResult.data.total || 0);
        } else {
          console.warn('Failed to fetch pending approvals count:', approvalsResult.error);
          setPendingApprovalsCount(0);
        }
        
        // Fetch pending approvals details
        const approvalsDetailResult = await timeTrackingService.getPendingApprovals();
        if (approvalsDetailResult.success) {
          setPendingApprovals(approvalsDetailResult.data || []);
        } else {
          console.warn('Failed to fetch pending approvals details:', approvalsDetailResult.error);
          setPendingApprovals([]);
        }
        
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      } finally {
        setLoading(false);
      }
  }, [employees, selectedMonth, selectedYear]);

  // Fetch data on mount and when dependencies change
  useEffect(() => {
    if (employees.length > 0) {
      fetchDashboardData();
    }
  }, [fetchDashboardData]);

  // Use visibility refresh hook to reload data when page becomes visible after idle
  useVisibilityRefresh(fetchDashboardData, {
    staleTime: 120000, // 2 minutes - refresh if data is older than this
    refreshOnFocus: true,
    refreshOnOnline: true
  });

  // Calculate aggregate stats
  const trackingDataValues = Object.values(timeTrackingData);
  const totalWorkDays = trackingDataValues.reduce((sum, emp) => sum + (emp?.workDays || 0), 0);
  const totalLeaveDays = trackingDataValues.reduce((sum, emp) => sum + (emp?.leaveDays || 0), 0);
  const totalOvertime = trackingDataValues.reduce((sum, emp) => sum + (emp?.overtime || 0) + (emp?.holidayOvertime || 0), 0).toFixed(1);
  const totalRegularHours = trackingDataValues.reduce((sum, emp) => sum + (emp?.regularHours || 0), 0).toFixed(0);
  const avgPerformance = trackingDataValues.length > 0 
    ? (trackingDataValues.reduce((sum, emp) => sum + (emp?.performance || 0), 0) / trackingDataValues.length).toFixed(1)
    : '0.0';
  
  // Check if we have any real data
  const hasRealData = trackingDataValues.some(emp => emp?.workDays > 0 || emp?.overtime > 0);

  // Helper function to generate display names for charts - always use last name
  const getUniqueDisplayName = (employee, allEmployees) => {
    const translatedName = getDemoEmployeeName(employee, t);
    const nameParts = translatedName.trim().split(/\s+/).filter(part => part.length > 0);
    if (nameParts.length === 0) return `Employee #${employee.id}`;
    
    // Always use last name for cleaner, more compact display
    const lastName = nameParts[nameParts.length - 1];
    return lastName;
  };

  // Performance data for bar chart
  const performanceData = employees.map(emp => ({
    name: getUniqueDisplayName(emp, employees),
    fullName: getDemoEmployeeName(emp, t), // Keep full name for tooltip
    id: emp.id,
    performance: timeTrackingData[String(emp.id)]?.performance || 4.0,
    overtime: timeTrackingData[String(emp.id)]?.overtime || 0
  }));

  // Department distribution for pie chart
  const departmentCounts = employees.reduce((acc, emp) => {
    acc[emp.department] = (acc[emp.department] || 0) + 1;
    return acc;
  }, {});

  const departmentData = Object.entries(departmentCounts).map(([dept, count]) => ({
    name: t(`employeeDepartment.${dept}`, dept),
    value: count
  }));

  // Leave requests summary - use ALL employees, not just top 5
  const leaveData = employees.map(emp => {
    const empId = String(emp.id);
    return {
      name: getUniqueDisplayName(emp, employees),
      fullName: getDemoEmployeeName(emp, t), // Keep full name for tooltip
      id: emp.id,
      leaveDays: leaveRequestsData[empId] || timeTrackingData[empId]?.leaveDays || 0,
      workDays: timeTrackingData[empId]?.workDays || 0
    };
  });

  // Chart colors
  const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4'];
  
  // Top performers
  const topPerformers = employees
    .map(emp => ({
      ...emp,
      performance: timeTrackingData[String(emp.id)]?.performance || 4.0,
      overtime: timeTrackingData[String(emp.id)]?.overtime || 0
    }))
    .sort((a, b) => b.performance - a.performance)
    .slice(0, 5);

  // Handle metric click - prepare data and open modal
  const handleMetricClick = (metricType) => {
    let data = [];
    let title = '';
    
    switch(metricType) {
      case 'employees':
        data = employees.map(emp => ({
          employeeName: getDemoEmployeeName(emp, t),
          department: emp.department,
          position: emp.position,
          status: emp.status
        }));
        title = t('dashboard.totalEmployees');
        break;
        
      case 'performance':
        data = employees.map(emp => ({
          employeeName: getDemoEmployeeName(emp, t),
          position: emp.position,
          department: emp.department,
          performance: timeTrackingData[String(emp.id)]?.performance || emp.performance || 0,
          overtime: timeTrackingData[String(emp.id)]?.overtime || 0
        }));
        title = t('dashboard.avgPerformance');
        break;
        
      case 'regularHours':
        data = employees.map(emp => ({
          employeeName: getDemoEmployeeName(emp, t),
          position: emp.position,
          department: emp.department,
          regularHours: timeTrackingData[String(emp.id)]?.regularHours || 0,
          totalHours: timeTrackingData[String(emp.id)]?.totalHours || 0
        }));
        title = t('dashboard.totalRegularHours', '');
        break;
        
      case 'overtime':
        data = employees.map(emp => ({
          employeeName: getDemoEmployeeName(emp, t),
          position: emp.position,
          department: emp.department,
          overtime: (timeTrackingData[String(emp.id)]?.overtime || 0) + (timeTrackingData[String(emp.id)]?.holidayOvertime || 0),
          workDays: timeTrackingData[String(emp.id)]?.workDays || 0
        }));
        title = t('dashboard.totalOvertime');
        break;
        
      case 'leave':
        data = employees.map(emp => {
          const empId = String(emp.id);
          return {
            employeeName: getDemoEmployeeName(emp, t),
            position: emp.position,
            department: emp.department,
            leaveDays: leaveRequestsData[empId] || timeTrackingData[empId]?.leaveDays || 0,
            workDays: timeTrackingData[empId]?.workDays || 0
          };
        });
        title = t('dashboard.totalLeave');
        break;
      
      case 'workDays':
        data = employees.map(emp => ({
          employeeName: getDemoEmployeeName(emp, t),
          position: emp.position,
          department: emp.department,
          workDays: timeTrackingData[String(emp.id)]?.workDays || 0,
          overtime: timeTrackingData[String(emp.id)]?.overtime || 0
        }));
        title = t('dashboard.totalWorkDays');
        break;
        
      case 'pendingRequests':
        data = pendingApprovals.map(approval => ({
          employeeName: approval.employee?.name || approval.employeeName || 'Unknown Employee',
          department: approval.employee?.department || approval.department || 'N/A',
          requestType: approval.hour_type || approval.requestType || 'Time Entry',
          date: approval.date || approval.created_at || new Date().toISOString(),
          status: approval.status || 'pending',
          hours: approval.hours || 0
        }));
        title = t('dashboard.pendingRequests', 'Pending Requests');
        break;
        
      case 'applications':
        data = applications;
        title = t('dashboard.activeApplications');
        break;
        
      default:
        return;
    }
    
    setModalConfig({ type: metricType, data, title });
    setModalOpen(true);
  };

  return (
    <div className="space-y-4 md:space-y-6 px-2 sm:px-0">
      {loading && (
        <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
          <div className={`${bg.secondary} rounded-lg p-6 flex items-center space-x-3 scale-in`}>
            <Loader className="w-6 h-6 animate-spin text-blue-600" />
            <span className={text.primary}>{t('common.loading', 'Loading dashboard...')}</span>
          </div>
        </div>
      )}
      <div className={`${bg.secondary} rounded-lg border ${border.primary} p-3 flex items-center justify-between slide-in-left flex-wrap gap-3`}>
        <div className="flex items-center space-x-2">
          <DatabaseZap className={`w-4 h-4 ${hasRealData ? 'text-green-600' : 'text-yellow-600'}`} />
          <span className={`text-sm ${text.secondary}`}>
            {hasRealData 
              ? t('dashboard.liveData', 'Live data from Supabase')
              : t('dashboard.noData', 'No time tracking data yet')
            }
          </span>
        </div>
        
        {/* Month/Year Selector */}
        <div className="flex items-center space-x-2">
          <Funnel className={`w-4 h-4 ${text.secondary}`} />
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(Number(e.target.value))}
            className={`${text.primary} px-3 py-1.5 rounded-lg border ${border.primary} text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent cursor-pointer transition-colors ${isDarkMode ? 'hover:border-gray-100' : 'hover:border-gray-900'}`}
          >
            <option value={1}>{t('months.january', 'January')}</option>
            <option value={2}>{t('months.february', 'February')}</option>
            <option value={3}>{t('months.march', 'March')}</option>
            <option value={4}>{t('months.april', 'April')}</option>
            <option value={5}>{t('months.may', 'May')}</option>
            <option value={6}>{t('months.june', 'June')}</option>
            <option value={7}>{t('months.july', 'July')}</option>
            <option value={8}>{t('months.august', 'August')}</option>
            <option value={9}>{t('months.september', 'September')}</option>
            <option value={10}>{t('months.october', 'October')}</option>
            <option value={11}>{t('months.november', 'November')}</option>
            <option value={12}>{t('months.december', 'December')}</option>
          </select>
          
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className={`${text.primary} px-3 py-1.5 rounded-lg border ${border.primary} text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent cursor-pointer transition-colors ${isDarkMode ? 'hover:border-gray-100' : 'hover:border-gray-900'}`}
          >
            <option value={2024}>2024</option>
            <option value={2025}>2025</option>
            <option value={2026}>2026</option>
          </select>
        </div>
        
        <button
          onClick={() => window.location.reload()}
          className="text-xs text-blue-600 hover:text-blue-700 font-medium transition-all duration-200 hover:scale-105"
        >
          {t('common.refresh', 'Refresh')}
        </button>
      </div>
      
      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
        <div className="stagger-item">
          <StatsCard 
            title={t('dashboard.totalEmployees')} 
            value={employees.length} 
            icon={MiniFlubberAutoMorphEmployees} 
            color={isDarkMode ? "#ffffff" : "#1f1f1f"}
            size={24}
            isDarkMode={isDarkMode}
            onClick={() => handleMetricClick('employees')}
          />
        </div>
        <div className="stagger-item">
          <StatsCard 
            title={t('dashboard.totalRegularHours', '')} 
            value={`${totalRegularHours}h`} 
            icon={MiniFlubberAutoMorphOfficeWork} 
            size={28}
            color={isDarkMode ? "#ffffff" : "#1f1f1f"}
            isDarkMode={isDarkMode}
            onClick={() => handleMetricClick('regularHours')}
          />
        </div>
        <div className="stagger-item">
          <StatsCard 
            title={t('dashboard.avgPerformance')} 
            value={avgPerformance} 
            icon={MiniFlubberAutoMorphPerformance} 
            size={28}
            isDarkMode={isDarkMode}
            color={isDarkMode ? "#ffffff" : "#1f1f1f"}
            onClick={() => handleMetricClick('performance')}
          />
        </div>
        <div className="stagger-item">
          <StatsCard 
            title={t('dashboard.totalOvertime')} 
            value={`${totalOvertime}h`} 
            icon={MiniFlubberAutoMorphOverTime} 
            size={28}
            isDarkMode={isDarkMode}
            color={isDarkMode ? "#ffffff" : "#1f1f1f"}
            onClick={() => handleMetricClick('overtime')}
          />
        </div>
        <div className="stagger-item">
          <StatsCard 
            title={t('dashboard.totalLeave')} 
            value={totalLeaveDays} 
            icon={MiniFlubberAutoMorphVacation} 
            size={28}
            isDarkMode={isDarkMode}
            color={isDarkMode ? "#ffffff" : "#1f1f1f"}
            onClick={() => handleMetricClick('leave')}
          />
        </div>
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Employee Performance Chart */}
        <div className={`${bg.secondary} rounded-lg shadow-sm border ${border.primary} p-3 md:p-4 slide-in-up transition-all duration-300 hover:shadow-lg`}>
          <h3 className={`font-semibold ${text.primary} mb-3`} style={{fontSize: 'clamp(1rem, 2.5vw, 1.125rem)'}}>
            {t('dashboard.employeePerformance')}
          </h3>
          <ResponsiveContainer width="100%" height={350}>
            <ComposedChart data={performanceData} margin={{ top: 5, right: 5, left: 0, bottom: 60 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={isDarkMode ? '#374151' : '#E5E7EB'} />
              <XAxis 
                dataKey="name" 
                stroke={isDarkMode ? '#FFFFFF' : '#6B7280'}
                angle={-45}
                textAnchor="end"
                height={80}
                interval={0}
                tick={{ fontSize: 13, fill: isDarkMode ? '#FFFFFF' : '#374151' }}
              />
              <YAxis stroke={isDarkMode ? '#FFFFFF' : '#6B7280'} domain={[0, 5]} tick={{ fill: isDarkMode ? '#FFFFFF' : '#374151' }} />
              <Tooltip
                  contentStyle={{
                    backgroundColor: isDarkMode ? '#1F2937' : '#FFFFFF',
                    border: `1px solid ${isDarkMode ? '#374151' : '#E5E7EB'}`,
                    borderRadius: '0.5rem',
                    color: isDarkMode ? '#F9FAFB' : '#111827',
                  }}
                  labelStyle={{
                    color: isDarkMode ? '#F9FAFB' : '#111827',
                  }}
                  itemStyle={{
                    color: isDarkMode ? '#F9FAFB' : '#111827',
                  }}
                  formatter={(value, name, props) => {
                    // Show full name in tooltip
                    if (props.payload.fullName) {
                      return [value, name];
                    }
                    return [value, name];
                  }}
                  labelFormatter={(label, payload) => {
                    // Show full employee name as tooltip label
                    if (payload && payload.length > 0 && payload[0].payload.fullName) {
                      return `${t('dashboard.employeeLabel', 'Employee')}: ${payload[0].payload.fullName}`;
                    }
                    return label;
                  }}
                  content={({ active, payload, label }) => {
                    if (!active || !payload || payload.length === 0) return null;

                    // Deduplicate series by canonical key (prefer dataKey, fallback to name)
                    const seen = new Set();
                    const unique = payload.filter(p => {
                      const labelText = String(p.dataKey || p.name || '').trim().toLowerCase();
                      if (!labelText) return false;
                      if (seen.has(labelText)) return false;
                      seen.add(labelText);
                      return true;
                    });

                    return (
                      <div style={{ background: isDarkMode ? '#1F2937' : '#FFFFFF', border: `1px solid ${isDarkMode ? '#374151' : '#E5E7EB'}`, borderRadius: '0.5rem', padding: 10, color: isDarkMode ? '#F9FAFB' : '#111827' }}>
                        <div style={{ fontWeight: 600, marginBottom: 8 }}>
                          {payload[0]?.payload?.fullName ? `${t('dashboard.employeeLabel', 'Employee')}: ${payload[0].payload.fullName}` : label}
                        </div>
                        {unique.map((p, idx) => {
                          const isPerformance = p.dataKey === 'performance' || String(p.name || '').toLowerCase().includes(String(t('dashboard.performanceRating', 'Performance Rating')).toLowerCase());
                          const isLine = p.payload && p.payload.hasOwnProperty('performance') && p.type === 'line';

                          const swatchStyle = isPerformance
                            ? {
                                width: 12,
                                height: 12,
                                borderRadius: 3,
                                backgroundImage: 'linear-gradient(180deg, #DC2626 0%, #7C2D12 50%, #000000 100%)',
                                border: isDarkMode ? '1px solid rgba(255,255,255,0.06)' : '1px solid rgba(0,0,0,0.08)'
                              }
                            : {
                                width: 12,
                                height: 12,
                                borderRadius: 3,
                                background: p.color || (isDarkMode ? '#F9FAFB' : '#111827'),
                                border: isDarkMode ? '1px solid rgba(255,255,255,0.06)' : '1px solid rgba(0,0,0,0.08)'
                              };

                          return (
                            <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 6 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <div style={swatchStyle} />
                                <div>{p.name || p.dataKey}</div>
                              </div>
                              <div style={{ fontWeight: 700 }}>{p.value}</div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  }}
                />
              <Legend wrapperStyle={{ color: isDarkMode ? '#FFFFFF' : '#111827' }} />
              <defs>
                <linearGradient id="performanceGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#DC2626" stopOpacity={0.95} />
                  <stop offset="50%" stopColor="#7C2D12" stopOpacity={0.9} />
                  <stop offset="100%" stopColor="#000000" stopOpacity={0.85} />
                </linearGradient>
              </defs>
              <Bar dataKey="performance" fill="url(#performanceGradient)" name={t('dashboard.performanceRating', 'Performance Rating')} radius={[8, 8, 0, 0]} />
              <Line 
                type="monotone" 
                dataKey="performance" 
                stroke="#10B981" 
                strokeWidth={3}
                dot={{ fill: '#10B981', r: 5 }}
                legendType="none"
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {/* Department Distribution */}
        <div className={`${bg.secondary} rounded-lg shadow-sm border ${border.primary} p-4 md:p-6 slide-in-up transition-all duration-300 hover:shadow-lg`} style={{ animationDelay: '0.1s' }}>
          <h3 className={`font-semibold ${text.primary} mb-4`} style={{fontSize: 'clamp(1rem, 2.5vw, 1.125rem)'}}>
            {t('dashboard.departmentDist')}
          </h3>
          <ResponsiveContainer width="100%" height={350}>
            <PieChart>
              <defs>
                <linearGradient id="pieGradient0" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#60A5FA" stopOpacity={1} />
                  <stop offset="50%" stopColor="#3B82F6" stopOpacity={0.95} />
                  <stop offset="100%" stopColor="#1E3A8A" stopOpacity={0.9} />
                </linearGradient>
                <linearGradient id="pieGradient1" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#34D399" stopOpacity={1} />
                  <stop offset="50%" stopColor="#10B981" stopOpacity={0.95} />
                  <stop offset="100%" stopColor="#047857" stopOpacity={0.9} />
                </linearGradient>
                <linearGradient id="pieGradient2" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#FBBF24" stopOpacity={1} />
                  <stop offset="50%" stopColor="#F59E0B" stopOpacity={0.95} />
                  <stop offset="100%" stopColor="#B45309" stopOpacity={0.9} />
                </linearGradient>
                <linearGradient id="pieGradient3" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#F87171" stopOpacity={1} />
                  <stop offset="50%" stopColor="#EF4444" stopOpacity={0.95} />
                  <stop offset="100%" stopColor="#991B1B" stopOpacity={0.9} />
                </linearGradient>
                <linearGradient id="pieGradient4" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#A78BFA" stopOpacity={1} />
                  <stop offset="50%" stopColor="#8B5CF6" stopOpacity={0.95} />
                  <stop offset="100%" stopColor="#5B21B6" stopOpacity={0.9} />
                </linearGradient>
                <linearGradient id="pieGradient5" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#F472B6" stopOpacity={1} />
                  <stop offset="50%" stopColor="#EC4899" stopOpacity={0.95} />
                  <stop offset="100%" stopColor="#9F1239" stopOpacity={0.9} />
                </linearGradient>
                <linearGradient id="pieGradient6" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#22D3EE" stopOpacity={1} />
                  <stop offset="50%" stopColor="#06B6D4" stopOpacity={0.95} />
                  <stop offset="100%" stopColor="#155E75" stopOpacity={0.9} />
                </linearGradient>
              </defs>
              <Pie
                data={departmentData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                labelStyle={{ fill: isDarkMode ? '#FFFFFF' : '#111827', fontSize: 14 }}
                outerRadius={100}
                fill="#8884d8"
                dataKey="value"
                style={{ fontSize: '13px' }}
              >
                {departmentData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={`url(#pieGradient${index % 7})`} />
                ))}
              </Pie>
              <Tooltip
                  contentStyle={{
                    backgroundColor: isDarkMode ? '#1F2937' : '#FFFFFF',
                    border: `1px solid ${isDarkMode ? '#374151' : '#E5E7EB'}`,
                    borderRadius: '0.5rem',
                    color: isDarkMode ? '#F9FAFB' : '#111827',
                  }}
                  itemStyle={{
                    color: isDarkMode ? '#FFFFFF' : '#111827',
                  }}
                  labelStyle={{
                    color: isDarkMode ? '#FFFFFF' : '#111827',
                  }}
                />
              <Legend 
                wrapperStyle={{ 
                  color: isDarkMode ? '#FFFFFF' : '#111827',
                  fontSize: '14px'
                }} 
                iconType="circle"
                align="center"
                verticalAlign="bottom"
                height={36}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Charts Row 2 - Regular + Overtime Hours (Merged) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className={`${bg.secondary} rounded-lg shadow-sm border ${border.primary} p-6 lg:col-span-2`}>
          <h3 className={`text-lg font-semibold ${text.primary} mb-4`}>
            {t('dashboard.regularAndOvertimeByEmployee', 'Regular & Overtime Hours by Employee')}
          </h3>
          <ResponsiveContainer width="100%" height={450}>
            <ComposedChart
              data={allEmployeesData
                .filter(item => item.data)
                .map(item => ({
                  name: getUniqueDisplayName(item.employee, employees),
                  fullName: item.employee.name,
                  regularHours: item.data?.regular_hours || 0,
                  overtimeHours: (item.data?.overtime_hours || 0) + (item.data?.holiday_overtime_hours || 0)
                }))
                // Sort by total hours (regular + overtime) and show top 10
                .sort((a, b) => (b.regularHours + b.overtimeHours) - (a.regularHours + a.overtimeHours))
                .slice(0, 10)
              }
              margin={{ top: 5, right: 20, left: 0, bottom: 80 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke={isDarkMode ? '#374151' : '#E5E7EB'} />
              <XAxis
                dataKey="name"
                stroke={isDarkMode ? '#FFFFFF' : '#6B7280'}
                angle={-45}
                textAnchor="end"
                height={80}
                interval={0}
                tick={{ fontSize: 13, fill: isDarkMode ? '#FFFFFF' : '#374151' }}
              />
              <YAxis stroke={isDarkMode ? '#FFFFFF' : '#6B7280'} tick={{ fill: isDarkMode ? '#FFFFFF' : '#374151' }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: isDarkMode ? '#1F2937' : '#FFFFFF',
                  border: `1px solid ${isDarkMode ? '#374151' : '#E5E7EB'}`,
                  borderRadius: '0.5rem',
                  color: isDarkMode ? '#F9FAFB' : '#111827',
                }}
                labelFormatter={(label, payload) => {
                  if (payload && payload.length > 0 && payload[0].payload.fullName) {
                    return `${t('dashboard.employeeLabel', 'Employee')}: ${payload[0].payload.fullName}`;
                  }
                  return label;
                }}
                content={({ active, payload, label }) => {
                  if (!active || !payload || payload.length === 0) return null;

                  const seen = new Set();
                  const unique = payload.filter(p => {
                    const labelText = String(p.dataKey || p.name || '').trim().toLowerCase();
                    if (!labelText) return false;
                    if (seen.has(labelText)) return false;
                    seen.add(labelText);
                    return true;
                  });

                  return (
                    <div style={{ background: isDarkMode ? '#1F2937' : '#FFFFFF', border: `1px solid ${isDarkMode ? '#374151' : '#E5E7EB'}`, borderRadius: '0.5rem', padding: 10, color: isDarkMode ? '#F9FAFB' : '#111827' }}>
                      <div style={{ fontWeight: 600, marginBottom: 8 }}>
                        {payload[0]?.payload?.fullName ? `${t('dashboard.employeeLabel', 'Employee')}: ${payload[0].payload.fullName}` : label}
                      </div>
                      {unique.map((p, idx) => {
                        // Render a visible swatch. For regularHours use the exact gradient used by the bar.
                        const isRegular = p.dataKey === 'regularHours' || String(p.name || '').toLowerCase().includes(String(t('dashboard.regularHoursLegend', 'Regular Hours')).toLowerCase());
                        const isOvertime = p.dataKey === 'overtimeHours' || String(p.name || '').toLowerCase().includes(String(t('dashboard.totalOvertimeLegend', 'Overtime Hours')).toLowerCase());

                        const swatchStyle = isRegular
                          ? {
                              width: 12,
                              height: 12,
                              borderRadius: 3,
                              backgroundImage: 'linear-gradient(180deg, #2563EB 0%, #1E3A8A 50%, #000000 100%)',
                              border: isDarkMode ? '1px solid rgba(255,255,255,0.06)' : '1px solid rgba(0,0,0,0.08)'
                            }
                          : isOvertime
                          ? {
                              width: 12,
                              height: 12,
                              borderRadius: 3,
                              backgroundColor: '#F59E0B',
                              border: isDarkMode ? '1px solid rgba(255,255,255,0.06)' : '1px solid rgba(0,0,0,0.08)'
                            }
                          : {
                              width: 12,
                              height: 12,
                              borderRadius: 3,
                              background: p.color || (isDarkMode ? '#F9FAFB' : '#111827'),
                              border: isDarkMode ? '1px solid rgba(255,255,255,0.06)' : '1px solid rgba(0,0,0,0.08)'
                            };

                        return (
                          <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 6 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <div style={swatchStyle} />
                              <div>{p.name || p.dataKey}</div>
                            </div>
                            <div style={{ fontWeight: 700 }}>{p.value}</div>
                          </div>
                        );
                      })}
                    </div>
                  );
                }}
              />
              <Legend wrapperStyle={{ color: isDarkMode ? '#FFFFFF' : '#111827' }} />

              <defs>
                <linearGradient id="regularHoursGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#2563EB" stopOpacity={0.95} />
                  <stop offset="50%" stopColor="#1E3A8A" stopOpacity={0.9} />
                  <stop offset="100%" stopColor="#000000" stopOpacity={0.85} />
                </linearGradient>
              </defs>

              <Bar dataKey="regularHours" fill="url(#regularHoursGradient)" name={t('dashboard.regularHoursLegend', 'Regular Hours')} radius={[8, 8, 0, 0]} />
              <Bar dataKey="overtimeHours" fill="#F59E0B" name={t('dashboard.totalOvertimeLegend', 'Overtime Hours')} radius={[8, 8, 0, 0]} />

            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Charts Row 3 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Work & Leave Days Comparison */}
        <div className={`${bg.secondary} rounded-lg shadow-sm border ${border.primary} p-6`}>
          <h3 className={`text-lg font-semibold ${text.primary} mb-4`}>
            {t('dashboard.workLeaveComp')}
          </h3>
          <ResponsiveContainer width="100%" height={350}>
            <ComposedChart data={leaveData} margin={{ top: 5, right: 5, left: 0, bottom: 60 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={isDarkMode ? '#374151' : '#E5E7EB'} />
              <XAxis 
                dataKey="name" 
                stroke={isDarkMode ? '#9CA3AF' : '#6B7280'}
                angle={-45}
                textAnchor="end"
                height={80}
                interval={0}
                tick={{ fontSize: 11 }}
              />
              <YAxis stroke={isDarkMode ? '#9CA3AF' : '#6B7280'} />
              <Tooltip
                  contentStyle={{
                    backgroundColor: isDarkMode ? '#1F2937' : '#FFFFFF',
                    border: `1px solid ${isDarkMode ? '#374151' : '#E5E7EB'}`,
                    borderRadius: '0.5rem',
                    color: isDarkMode ? '#F9FAFB' : '#111827',
                  }}
                  labelStyle={{
                    color: isDarkMode ? '#F9FAFB' : '#111827',
                  }}
                  itemStyle={{
                    color: isDarkMode ? '#F9FAFB' : '#111827',
                  }}
                  labelFormatter={(label, payload) => {
                    // Show full employee name as tooltip label
                    if (payload && payload.length > 0 && payload[0].payload.fullName) {
                      return `${t('dashboard.employeeLabel', 'Employee')}: ${payload[0].payload.fullName}`;
                    }
                    return label;
                  }}
                  content={({ active, payload, label }) => {
                    if (!active || !payload || payload.length === 0) return null;

                    // Deduplicate by normalized displayed label (case-insensitive)
                    const seen = new Set();
                    const unique = payload.filter(p => {
                      const labelText = String(p.dataKey || p.name || '').trim().toLowerCase();
                      if (!labelText) return false;
                      if (seen.has(labelText)) return false;
                      seen.add(labelText);
                      return true;
                    });

                    return (
                      <div style={{ background: isDarkMode ? '#1F2937' : '#FFFFFF', border: `1px solid ${isDarkMode ? '#374151' : '#E5E7EB'}`, borderRadius: '0.5rem', padding: 10, color: isDarkMode ? '#F9FAFB' : '#111827' }}>
                        <div style={{ fontWeight: 600, marginBottom: 8 }}>
                          {payload[0]?.payload?.fullName ? `${t('dashboard.employeeLabel', 'Employee')}: ${payload[0].payload.fullName}` : label}
                        </div>
                        {unique.map((p, idx) => (
                          <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 6 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <div style={{ width: 10, height: 10, background: p.color || (isDarkMode ? '#F9FAFB' : '#111827'), borderRadius: 3 }} />
                              <div>{p.name || p.dataKey}</div>
                            </div>
                            <div style={{ fontWeight: 700 }}>{p.value}</div>
                          </div>
                        ))}
                      </div>
                    );
                  }}
                />
              <Legend />
              <Bar dataKey="workDays" fill="#10B981" name={t('dashboard.totalWorkDays', 'Total Work Days')} radius={[8, 8, 0, 0]} />
              <Bar dataKey="leaveDays" fill="#EF4444" name={t('dashboard.totalLeave', 'Total Leave')} radius={[8, 8, 0, 0]} />
              <Line 
                type="monotone" 
                dataKey="workDays" 
                stroke="#059669" 
                strokeWidth={3}
                dot={{ fill: '#059669', r: 5 }}
                legendType="none"
              />
              <Line 
                type="monotone" 
                dataKey="leaveDays" 
                stroke="#DC2626" 
                strokeWidth={3}
                dot={{ fill: '#DC2626', r: 5 }}
                legendType="none"
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {/* Top Performers */}
        <div className={`${bg.secondary} rounded-lg shadow-sm border ${border.primary} p-6`}>
          <h3 className={`text-lg font-semibold ${text.primary} mb-4`}>
            {t('dashboard.topPerformers')}
          </h3>
          <div className="space-y-3">
            {topPerformers.map((emp, index) => (
              <div key={emp.id} className={`flex items-center justify-between p-3 rounded-lg ${isDarkMode ? 'bg-gray-700' : 'bg-gray-50'}`}>
                <div className="flex items-center space-x-3">
                  {emp.photo ? (
                    <img 
                      src={emp.photo} 
                      alt={getDemoEmployeeName(emp, t)}
                      className={`w-10 h-10 rounded-full object-cover border-2 ${isDarkMode ? 'border-gray-600' : 'border-gray-200'}`}
                    />
                  ) : (
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-white ${
                      index === 0 ? 'bg-yellow-500' :
                      index === 1 ? 'bg-gray-400' :
                      index === 2 ? 'bg-orange-600' :
                      'bg-blue-500'
                    }`}>
                      {getDemoEmployeeName(emp, t).charAt(0)}
                    </div>
                  )}
                  <div>
                    <p className={`font-medium ${text.primary}`}>{getDemoEmployeeName(emp, t)}</p>
                    <p className={`text-sm ${text.secondary}`}>
                      {t(`employeePosition.${emp.position}`)}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={`font-bold text-lg ${text.primary}`}>{emp.performance}</p>
                  <p className={`text-xs ${text.secondary}`}>{emp.overtime}h {t('dashboard.overtime')}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Additional Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div 
          onClick={() => handleMetricClick('workDays')}
          className={`${bg.secondary} rounded-lg shadow-sm border ${border.primary} p-6 cursor-pointer transition-all duration-300 hover:shadow-lg hover:-translate-y-1`}
        >
          <div className="flex items-center space-x-3 mb-2">
            <AnimatedClockIcon isDarkMode={isDarkMode} className={`w-5 h-5 ${text.primary}`} />
            <h4 className={`font-semibold ${text.primary}`}>
              {t('dashboard.totalWorkDays')}
            </h4>
          </div>
          <p className={`text-3xl font-bold ${text.primary}`}>{totalWorkDays}</p>
          <p className={`text-sm ${text.secondary} mt-1`}>
            {t('dashboard.acrossEmployees')}
          </p>
        </div>

        <div 
          onClick={() => handleMetricClick('applications')}
          className={`${bg.secondary} rounded-lg shadow-sm border ${border.primary} p-6 cursor-pointer transition-all duration-300 hover:shadow-lg hover:-translate-y-1`}
        >
          <div className="flex items-center space-x-3 mb-2">
            <FileUser className={`w-5 h-5 ${text.primary}`} />
            <h4 className={`font-semibold ${text.primary}`}>
              {t('dashboard.activeApplications')}
            </h4>
          </div>
          <p className={`text-3xl font-bold ${text.primary}`}>{applications.length}</p>
          <p className={`text-sm ${text.secondary} mt-1`}>
            {t('dashboard.pendingReview')}
          </p>
        </div>

        <div 
          onClick={() => handleMetricClick('pendingRequests')}
          className={`${bg.secondary} rounded-lg shadow-sm border ${border.primary} p-6 cursor-pointer transition-all duration-300 hover:shadow-lg hover:-translate-y-1`}
        >
          <div className="flex items-center space-x-3 mb-2">
            <MiniFlubberAutoMorphInProgress isDarkMode={isDarkMode} className={`w-5 h-5 ${text.primary}`} />
            <h4 className={`font-semibold ${text.primary}`}>
              {t('dashboard.pendingRequests')}
            </h4>
          </div>
          <p className={`text-3xl font-bold ${text.primary}`}>{pendingApprovalsCount}</p>
          <p className={`text-sm ${text.secondary} mt-1`}>
            {t('dashboard.pendingApprovals', '')}
          </p>
        </div>
      </div>

      {/* Metric Detail Modal */}
      <MetricDetailModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        metricType={modalConfig.type}
        data={modalConfig.data}
        title={modalConfig.title}
      />
    </div>
  );
};
export default Dashboard;
