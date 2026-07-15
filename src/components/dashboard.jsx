import _React, { useState, useRef, useEffect, useCallback } from 'react'
import { Heart, AlertCircle, TreePalm, Car, Salad, Clapperboard, Laptop, Form, PhoneCall, CupSoda, Flame, DatabaseZap, HouseWifi, Funnel, HeartPlus, Coffee, AlarmClock, Gauge, BriefcaseBusiness, WifiPen, TrendingUp, LineChart, BatteryCharging, PersonStanding, Volleyball, FileUser, RefreshCw, Users, User, Speech } from 'lucide-react'
import StatsCard from './statsCard.jsx'
import MetricDetailModal from './metricDetailModal.jsx'
import { useTheme } from '../contexts/ThemeContext.jsx'
import { useLanguage } from '../contexts/LanguageContext.jsx'
import { Bar, BarChart, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from 'recharts'
import * as timeTrackingService from '../services/timeTrackingService.js'
import { withTimeout } from '../utils/supabaseTimeout.js';
import { DEFAULT_REQUEST_TIMEOUT } from '../config/requestTimeouts.js';
import { validateAndRefreshSession } from '../utils/sessionHelper.js';
import { retryWithBackoff, isRetryableError } from '../utils/retryHelper.js';
import * as flubber from 'flubber';
import { AnimatedClockIcon, AnimatedAlarmClockIcon } from './timeClockEntry.jsx'
import { AnimatedCoffeeIcon, MiniFlubberMorphingLeaveStatus } from './timeTracking.jsx';
import { MiniFlubberAutoMorphInProgress, MiniFlubberAutoMorphEmployees } from './taskReview.jsx'
import { useSessionGuard, useAuthenticatedPageRefresh } from '../hooks/useSessionGuard.js';
import { getDemoEmployeeName, isDemoMode } from '../utils/demoHelper.js';
import { AnimatedGroup, InView, TextEffect, Spotlight, SlidingNumber, useNumberReplay } from './motion-primitives'
import { BorderBeam } from './ui/border-beam'
import { MagicBento } from './ui/magic-bento'
import { PageLiveClock } from './ui/page-live-clock'
import { cn } from '@/lib/utils'

const CHART_SERIES = {
  performance: { light: '#3B82F6', dark: '#60A5FA' },
  regular: { light: '#3B82F6', dark: '#60A5FA' },
  overtime: { light: '#D946EF', dark: '#E879F9' },
  workDays: { light: '#3B82F6', dark: '#60A5FA' },
  leaveDays: { light: '#CBD5E1', dark: '#64748B' },
  accent: { light: '#06B6D4', dark: '#22D3EE' },
};

const DEPT_PALETTE = {
  light: ['#1D4ED8', '#2563EB', '#3B82F6', '#60A5FA', '#93C5FD', '#BFDBFE', '#DBEAFE'],
  dark: ['#DBEAFE', '#BFDBFE', '#93C5FD', '#60A5FA', '#3B82F6', '#2563EB', '#1E40AF'],
};

function getChartTheme(isDarkMode) {
  return {
    grid: isDarkMode ? 'rgba(148,163,184,0.12)' : 'rgba(15,23,42,0.06)',
    tick: isDarkMode ? '#94A3B8' : '#6B7280',
    tooltipBg: isDarkMode ? '#0B1220' : '#FFFFFF',
    tooltipBorder: isDarkMode ? 'rgba(148,163,184,0.16)' : 'rgba(15,23,42,0.08)',
    tooltipText: isDarkMode ? '#F1F5F9' : '#111827',
    legend: isDarkMode ? '#94A3B8' : '#6B7280',
    cursor: isDarkMode ? 'rgba(59,130,246,0.08)' : 'rgba(59,130,246,0.06)',
    series: (key) => (isDarkMode ? CHART_SERIES[key].dark : CHART_SERIES[key].light),
    dept: isDarkMode ? DEPT_PALETTE.dark : DEPT_PALETTE.light,
  };
}

function ChartTooltipBox({ active, payload, label, isDarkMode, title, chartTheme }) {
  if (!active || !payload?.length) return null;

  const seen = new Set();
  const unique = payload.filter((p) => {
    const key = String(p.dataKey || p.name || '').trim().toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return (
    <div
      style={{
        background: chartTheme.tooltipBg,
        border: `1px solid ${chartTheme.tooltipBorder}`,
        borderRadius: 8,
        padding: '8px 10px',
        color: chartTheme.tooltipText,
        boxShadow: isDarkMode
          ? '0 10px 28px rgba(0,0,0,0.4)'
          : '0 10px 28px rgba(15,23,42,0.08)',
        minWidth: 148,
      }}
    >
      <div
        style={{
          fontWeight: 500,
          marginBottom: 6,
          fontSize: 12,
          color: isDarkMode ? '#94A3B8' : '#6B7280',
        }}
      >
        {title || label}
      </div>
      {unique.map((p, idx) => (
        <div
          key={idx}
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            gap: 20,
            marginBottom: idx === unique.length - 1 ? 0 : 4,
            fontSize: 12,
            lineHeight: 1.35,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <div
              style={{
                width: 10,
                height: 2,
                borderRadius: 999,
                background: p.color || chartTheme.tooltipText,
              }}
            />
            <span style={{ color: isDarkMode ? '#CBD5E1' : '#4B5563' }}>{p.name || p.dataKey}</span>
          </div>
          <span style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{p.value}</span>
        </div>
      ))}
    </div>
  );
}

function ChartSeriesLegend({ items, isDarkMode }) {
  return (
    <div className="flex flex-wrap items-center justify-end gap-x-4 gap-y-1">
      {items.map((item) => (
        <div key={item.label} className="flex items-center gap-2">
          <span
            className="h-0.5 w-3 rounded-full"
            style={{ background: item.color }}
          />
          <span className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-gray-500'}`}>
            {item.label}
          </span>
        </div>
      ))}
    </div>
  );
}

function ChartPanelHeader({ label, value, hint, legend, text }) {
  return (
    <div className="mb-5 flex items-start justify-between gap-4">
      <div className="min-w-0">
        <p className={`text-sm ${text.secondary}`}>{label}</p>
        {value != null && value !== '' && (
          <p className={`mt-1 text-2xl font-semibold tracking-tight tabular-nums ${text.primary}`}>
            {value}
          </p>
        )}
        {hint ? (
          <p className={`mt-0.5 text-xs ${text.secondary}`}>{hint}</p>
        ) : null}
      </div>
      {legend ? <div className="shrink-0 pt-1">{legend}</div> : null}
    </div>
  );
}

function ChartSummaryList({ items, isDarkMode, text, border }) {
  return (
    <ul className={`mt-5 divide-y ${border.primary}`}>
      {items.map((item) => (
        <li key={item.label} className="flex items-center justify-between py-2.5 first:pt-0 last:pb-0">
          <div className="flex items-center gap-2.5">
            <span
              className="h-0.5 w-3 rounded-full"
              style={{ background: item.color }}
            />
            <span className={`text-sm ${isDarkMode ? 'text-slate-300' : 'text-gray-600'}`}>
              {item.label}
            </span>
          </div>
          <span className={`text-sm font-semibold tabular-nums ${text.primary}`}>
            {item.value}
          </span>
        </li>
      ))}
    </ul>
  );
}

const chartCardClass = (bg, border) =>
  cn(
    bg.secondary,
    'group relative overflow-hidden rounded-xl border p-5 md:p-6 shadow-sm transition-shadow duration-300 hover:shadow-md',
    border.primary
  );

function HoverMetricCard({
  onClick,
  className,
  children,
  beam,
}) {
  const { replayToken, bump } = useNumberReplay();
  return (
    <div
      onClick={onClick}
      onMouseEnter={bump}
      className={cn(
        'group relative overflow-hidden',
        onClick && 'cursor-pointer',
        className
      )}
    >
      {beam}
      {typeof children === 'function' ? children(replayToken) : children}
    </div>
  );
};

export const MiniFlubberAutoMorphEmployeesDashboard = ({
  size = 24,
  className = '',
  isDarkMode = false,
  autoMorphInterval = 1000, 
  morphDuration = 500, 
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
    { name: 'Users', Icon: Users, status: 'stanard' },
    { name: 'User', Icon: User, status: 'standard' },
    { name: 'Gossip', Icon: Speech, status: 'standard' },
    { name: 'Human', Icon: PersonStanding, status: 'standard' },
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

export const MiniFlubberAutoMorphVacation = ({
  size = 24,
  className = '',
  isDarkMode = false,
  autoMorphInterval = 1000, 
  morphDuration = 500, 
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
  autoMorphInterval = 1000, 
  morphDuration = 500, 
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
  autoMorphInterval = 1000, 
  morphDuration = 500, 
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
  autoMorphInterval = 1000,
  morphDuration = 500, 
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
  const { handleSessionAuthError } = useSessionGuard();
  
  const [loading, setLoading] = useState(true);
  const [timeTrackingData, setTimeTrackingData] = useState({});
  const [allEmployeesData, setAllEmployeesData] = useState([]);
  const [leaveRequestsData, setLeaveRequestsData] = useState({});
  const [pendingApprovalsCount, setPendingApprovalsCount] = useState(0);
  const [pendingApprovals, setPendingApprovals] = useState([]);
  
  const [modalOpen, setModalOpen] = useState(false);
  const [modalConfig, setModalConfig] = useState({ type: '', data: [], title: '' });
  const [fetchError, setFetchError] = useState(null);
  
  const currentDate = new Date();
  const [selectedMonth, setSelectedMonth] = useState(currentDate.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear());

  // Define fetch function that can be reused
  const fetchDashboardData = useCallback(async (options = {}) => {
    const { silent = false } = options;
    console.log('📊 [Dashboard] fetchDashboardData called:', { employeeCount: employees.length, silent, isDemoMode: isDemoMode() });
    if (employees.length === 0) {
      console.warn('⚠️ [Dashboard] No employees to fetch data for');
      if (!silent) setLoading(false);
      return;
    }
    
    if (!silent) {
      setLoading(true);
      setFetchError(null); // Clear any previous errors
    }
    
    try {
      // Skip session validation in demo mode - demo data doesn't require authentication
      if (!isDemoMode()) {
        // Validate and refresh session if needed
        const sessionValidation = await validateAndRefreshSession();
        if (!sessionValidation.success) {
          throw new Error(sessionValidation.error);
        }
      }
      
      // Wrap the fetch logic with retry mechanism
      await retryWithBackoff(async () => {
        // Fetch time tracking summaries for all employees for SELECTED month
        const summariesPromises = employees.map(emp => 
          timeTrackingService.getTimeTrackingSummary(String(emp.id), selectedMonth, selectedYear)
        );

        const summariesResults = await withTimeout(Promise.all(summariesPromises), DEFAULT_REQUEST_TIMEOUT);

        // Fetch leave requests for all employees
        const leavePromises = employees.map(emp => 
          timeTrackingService.getLeaveRequests(String(emp.id), {
            year: selectedYear
          })
        );
        const leaveResults = await withTimeout(Promise.all(leavePromises), DEFAULT_REQUEST_TIMEOUT);
        
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
              leaveDays: Math.max(result.data.leave_days || 0, leaveData[empId] || 0), // Use max of service calculated (includes Time Entries) or requests
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
      }, {
        maxRetries: 2,
        shouldRetry: isRetryableError,
        onRetry: (_error, attempt, delay) => {
          console.log(`🔄 Dashboard: Retrying fetch (${attempt}/2) after ${delay}ms...`);
        }
      });
        
      } catch (error) {
        console.error('Error fetching dashboard data:', error);

        if (handleSessionAuthError(error, { setFetchError })) {
          return;
        }
        
        // Set user-visible error message for other errors
        setFetchError(error.message || 'Failed to load dashboard data. Please try refreshing the page.');
      } finally {
          if (!silent) setLoading(false);
        }
  }, [employees, selectedMonth, selectedYear, handleSessionAuthError]);

  // Memoize the silent refresh callback
  const silentRefresh = useCallback(() => {
    fetchDashboardData({ silent: true });
  }, [fetchDashboardData]);

  // Fetch data on mount and when dependencies change
  useEffect(() => {
    if (employees.length > 0) {
      fetchDashboardData();
    }
  }, [fetchDashboardData]);

  // Use visibility refresh hook to reload data when page becomes visible after idle
  useAuthenticatedPageRefresh(silentRefresh);

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
  const getUniqueDisplayName = (employee, _allEmployees) => {
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

  const chartTheme = getChartTheme(isDarkMode);
  const axisTick = { fontSize: 11, fill: chartTheme.tick };
  const departmentChartData = [...departmentData].sort((a, b) => (b.value || 0) - (a.value || 0));
  const departmentTotal = departmentChartData.reduce((sum, d) => sum + (d.value || 0), 0);
  const hoursChartData = allEmployeesData
    .filter((item) => item.data)
    .map((item) => ({
      name: getUniqueDisplayName(item.employee, employees),
      fullName: item.employee.name,
      regularHours: item.data?.regular_hours || 0,
      overtimeHours: (item.data?.overtime_hours || 0) + (item.data?.holiday_overtime_hours || 0),
    }))
    .sort((a, b) => (b.regularHours + b.overtimeHours) - (a.regularHours + a.overtimeHours))
    .slice(0, 10);
  const hoursChartRegularTotal = hoursChartData.reduce((sum, row) => sum + (row.regularHours || 0), 0);
  const hoursChartOvertimeTotal = hoursChartData.reduce((sum, row) => sum + (row.overtimeHours || 0), 0);
  const hoursChartMaxTotal = Math.max(
    1,
    ...hoursChartData.map((row) => (row.regularHours || 0) + (row.overtimeHours || 0))
  );
  const hoursEditorial = {
    ink: isDarkMode ? '#60A5FA' : '#3B82F6',
    mute: isDarkMode ? '#94A3B8' : '#94A3B8',
    track: isDarkMode ? 'rgba(148,163,184,0.14)' : 'rgba(59,130,246,0.08)',
  };
  const leaveChartWorkTotal = leaveData.reduce((sum, row) => sum + (row.workDays || 0), 0);
  const leaveChartLeaveTotal = leaveData.reduce((sum, row) => sum + (row.leaveDays || 0), 0);

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
    <div className="space-y-4 md:space-y-6 w-full">
      <div className={`${bg.secondary} rounded-lg border ${border.primary} p-3 flex items-center justify-between slide-in-left flex-wrap gap-3`}>
        <div className="flex items-center space-x-2">
          <DatabaseZap className={`w-4 h-4 ${hasRealData ? 'text-green-600' : 'text-yellow-600'}`} />
          <TextEffect
            as="span"
            per="word"
            preset="fade"
            className={`text-sm ${text.secondary}`}
            speedReveal={1.4}
          >
            {hasRealData 
              ? t('dashboard.liveData', 'Live data from Supabase')
              : t('dashboard.noData', 'No time tracking data yet')
            }
          </TextEffect>
          <span className={`hidden sm:inline text-sm font-mono ${text.secondary} opacity-70`}>·</span>
          <PageLiveClock
            showSeparator={false}
            textClassName={text.primary}
            loading={loading}
            isDarkMode={isDarkMode}
            fetchLabel={t('common.fetching', 'Fetching')}
          />
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
          type = "button"
          onClick={() => globalThis.location.reload()}
          className="flex items-center space-x-1 text-xs text-blue-600 hover:text-blue-700 font-medium transition-all duration-200 hover:scale-105"
        >
          <RefreshCw className="h-3 w-3" />
          <span>{t('common.refresh', 'Refresh')}</span>
        </button>
      </div>
      
      {/* Error Banner */}
      {fetchError && (
        <div className={`${isDarkMode ? 'bg-red-900/20 border-red-800' : 'bg-red-50 border-red-300'} rounded-lg border p-4 flex items-start space-x-3 slide-in-top`}>
          <AlertCircle className={`w-5 h-5 ${isDarkMode ? 'text-red-400' : 'text-red-600'} shrink-0 mt-0.5`} />
          <div className="flex-1">
            <h3 className={`text-sm font-semibold ${isDarkMode ? 'text-red-400' : 'text-red-800'}`}>
              {t('common.error', 'Error')}
            </h3>
            <p className={`text-sm ${isDarkMode ? 'text-red-300' : 'text-red-700'} mt-1`}>
              {fetchError}
            </p>
            <button
              type = "button"
              onClick={() => {
                setFetchError(null);
                fetchDashboardData();
              }}
              className={`mt-2 text-xs font-medium ${isDarkMode ? 'text-red-400 hover:text-red-300' : 'text-red-600 hover:text-red-700'} underline`}
            >
              {t('common.retry', 'Try Again')}
            </button>
          </div>
          <button
            type = "button"
            onClick={() => setFetchError(null)}
            className={`${isDarkMode ? 'text-red-400 hover:text-red-300' : 'text-red-600 hover:text-red-700'} transition-colors`}
            aria-label="Close"
          >
            ×
          </button>
        </div>
      )}
      
      {/* Key Metrics */}
      <AnimatedGroup
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6"
        preset="blur-slide"
      >
        <StatsCard 
          title={t('dashboard.totalEmployees')} 
          value={employees.length} 
          icon={MiniFlubberAutoMorphEmployeesDashboard} 
          staticIcon={Users}
          iconHoverOnly
          color={isDarkMode ? "#ffffff" : "#1f1f1f"}
          size={24}
          isDarkMode={isDarkMode}
          onClick={() => handleMetricClick('employees')}
        />
        <StatsCard 
          title={t('dashboard.totalRegularHours', '')} 
          value={`${totalRegularHours}h`} 
          icon={MiniFlubberAutoMorphOfficeWork} 
          staticIcon={AlarmClock}
          iconHoverOnly
          size={28}
          color={isDarkMode ? "#ffffff" : "#1f1f1f"}
          isDarkMode={isDarkMode}
          onClick={() => handleMetricClick('regularHours')}
        />
        <StatsCard 
          title={t('dashboard.avgPerformance')} 
          value={avgPerformance} 
          icon={MiniFlubberAutoMorphPerformance} 
          staticIcon={Gauge}
          iconHoverOnly
          size={28}
          isDarkMode={isDarkMode}
          color={isDarkMode ? "#ffffff" : "#1f1f1f"}
          onClick={() => handleMetricClick('performance')}
        />
        <StatsCard 
          title={t('dashboard.totalOvertime')} 
          value={`${totalOvertime}h`} 
          icon={MiniFlubberAutoMorphOverTime} 
          staticIcon={HeartPlus}
          iconHoverOnly
          size={28}
          isDarkMode={isDarkMode}
          color={isDarkMode ? "#ffffff" : "#1f1f1f"}
          onClick={() => handleMetricClick('overtime')}
        />
        <StatsCard 
          title={t('dashboard.totalLeave')} 
          value={totalLeaveDays} 
          icon={MiniFlubberAutoMorphVacation} 
          staticIcon={Coffee}
          iconHoverOnly
          size={28}
          isDarkMode={isDarkMode}
          color={isDarkMode ? "#ffffff" : "#1f1f1f"}
          onClick={() => handleMetricClick('leave')}
        />
      </AnimatedGroup>

      {/* Magic Bento overview */}
      <MagicBento
        isDarkMode={isDarkMode}
        enableStars
        enableSpotlight
        enableBorderGlow
        enableMagnetism
        clickEffect
        items={[
          {
            label: t('dashboard.workforce', 'Workforce'),
            title: String(employees.length),
            description: t('dashboard.totalEmployees'),
            value: employees.length,
            onClick: () => handleMetricClick('employees'),
          },
          {
            label: t('dashboard.hours', 'Hours'),
            title: `${totalRegularHours}h`,
            description: t('dashboard.totalRegularHours', 'Total Regular Hours'),
            value: Number(totalRegularHours) || 0,
            suffix: 'h',
            onClick: () => handleMetricClick('regularHours'),
          },
          {
            label: t('dashboard.performance', 'Performance'),
            title: String(avgPerformance),
            description: t('dashboard.avgPerformance'),
            value: Number(avgPerformance) || 0,
            onClick: () => handleMetricClick('performance'),
          },
          {
            label: t('dashboard.overtime', 'Overtime'),
            title: `${totalOvertime}h`,
            description: t('dashboard.totalOvertime'),
            value: Number(totalOvertime) || 0,
            suffix: 'h',
            onClick: () => handleMetricClick('overtime'),
          },
          {
            label: t('dashboard.leave', 'Leave'),
            title: String(totalLeaveDays),
            description: t('dashboard.totalLeave'),
            value: Number(totalLeaveDays) || 0,
            onClick: () => handleMetricClick('leave'),
          },
          {
            label: t('dashboard.approvals', 'Approvals'),
            title: String(pendingApprovalsCount),
            description: t('dashboard.pendingRequests', 'Pending Requests'),
            value: Number(pendingApprovalsCount) || 0,
            onClick: () => handleMetricClick('pendingRequests'),
          },
        ]}
      />

      {/* Charts Row 1 */}
      <InView
        once
        variants={{
          hidden: { opacity: 0, y: 28 },
          visible: { opacity: 1, y: 0 },
        }}
        transition={{ duration: 0.45, ease: 'easeOut' }}
        viewOptions={{ margin: '-40px' }}
      >
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Employee Performance Chart */}
        <div className={chartCardClass(bg, border)}>
          <BorderBeam showOnHover size={110} duration={10} borderWidth={1.5} colorFrom="#3b82f6" colorTo="#06b6d4" />
          <div className="relative z-10">
          <ChartPanelHeader
            label={t('dashboard.employeePerformance')}
            value={avgPerformance}
            hint={t('dashboard.avgPerformance')}
            text={text}
            legend={
              <ChartSeriesLegend
                isDarkMode={isDarkMode}
                items={[{
                  label: t('dashboard.performanceRating', 'Performance Rating'),
                  color: chartTheme.series('performance'),
                }]}
              />
            }
          />
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={performanceData} margin={{ top: 8, right: 8, left: -12, bottom: 28 }}>
              <defs>
                <linearGradient id="performanceAreaFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={chartTheme.series('performance')} stopOpacity={0.22} />
                  <stop offset="100%" stopColor={chartTheme.series('performance')} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke={chartTheme.grid} strokeDasharray="0" />
              <XAxis
                dataKey="name"
                axisLine={false}
                tickLine={false}
                angle={-28}
                textAnchor="end"
                height={48}
                interval={0}
                tick={axisTick}
              />
              <YAxis
                hide
                domain={[0, 5]}
              />
              <Tooltip
                cursor={{ stroke: chartTheme.grid, strokeWidth: 1 }}
                content={({ active, payload, label }) => (
                  <ChartTooltipBox
                    active={active}
                    payload={payload}
                    label={label}
                    isDarkMode={isDarkMode}
                    chartTheme={chartTheme}
                    title={
                      payload?.[0]?.payload?.fullName
                        ? `${t('dashboard.employeeLabel', 'Employee')}: ${payload[0].payload.fullName}`
                        : label
                    }
                  />
                )}
              />
              <Area
                type="monotone"
                dataKey="performance"
                name={t('dashboard.performanceRating', 'Performance Rating')}
                stroke={chartTheme.series('performance')}
                strokeWidth={2}
                fill="url(#performanceAreaFill)"
                dot={false}
                activeDot={{
                  r: 4,
                  fill: chartTheme.series('performance'),
                  stroke: isDarkMode ? '#0B1220' : '#FFFFFF',
                  strokeWidth: 2,
                }}
              />
            </AreaChart>
          </ResponsiveContainer>
          </div>
        </div>

        {/* Department Distribution */}
        <div className={chartCardClass(bg, border)} style={{ animationDelay: '0.1s' }}>
          <BorderBeam showOnHover size={110} duration={11} delay={1} borderWidth={1.5} colorFrom="#3b82f6" colorTo="#d946ef" />
          <div className="relative z-10">
          <ChartPanelHeader
            label={t('dashboard.departmentDist')}
            value={departmentTotal}
            hint={t('dashboard.totalEmployees')}
            text={text}
          />
          <ResponsiveContainer width="100%" height={280}>
            <BarChart
              layout="vertical"
              data={departmentChartData}
              margin={{ top: 0, right: 36, left: 4, bottom: 0 }}
              barCategoryGap="32%"
            >
              <CartesianGrid horizontal={false} stroke={chartTheme.grid} strokeDasharray="0" />
              <XAxis
                type="number"
                hide
                allowDecimals={false}
              />
              <YAxis
                type="category"
                dataKey="name"
                axisLine={false}
                tickLine={false}
                width={96}
                tick={axisTick}
              />
              <Tooltip
                cursor={{ fill: chartTheme.cursor }}
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const item = payload[0];
                  const pct = departmentTotal > 0 ? Math.round((item.value / departmentTotal) * 100) : 0;
                  return (
                    <ChartTooltipBox
                      active={active}
                      payload={[{
                        name: item.payload?.name || item.name,
                        value: `${item.value} · ${pct}%`,
                        color: item.color || chartTheme.series('regular'),
                      }]}
                      isDarkMode={isDarkMode}
                      chartTheme={chartTheme}
                      title={t('dashboard.departmentDist')}
                    />
                  );
                }}
              />
              <Bar
                dataKey="value"
                radius={[0, 4, 4, 0]}
                maxBarSize={16}
                name={t('dashboard.departmentDist')}
                label={{
                  position: 'right',
                  fill: chartTheme.tick,
                  fontSize: 11,
                }}
              >
                {departmentChartData.map((_entry, index) => (
                  <Cell
                    key={`dept-${index}`}
                    fill={chartTheme.dept[index % chartTheme.dept.length]}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          </div>
        </div>
      </div>
      </InView>

      {/* Charts Row 2 - Regular + Overtime Hours (editorial horizontal bars) */}
      <InView
        once
        variants={{
          hidden: { opacity: 0, y: 28 },
          visible: { opacity: 1, y: 0 },
        }}
        transition={{ duration: 0.45, ease: 'easeOut' }}
        viewOptions={{ margin: '-40px' }}
      >
      <div className="grid grid-cols-1 gap-6">
        <div className={cn(chartCardClass(bg, border), 'overflow-visible')}>
          <BorderBeam showOnHover size={120} duration={12} borderWidth={1.5} colorFrom="#3b82f6" colorTo="#94a3b8" />
          <div className="relative z-10">
                <ChartPanelHeader
                  label={t('dashboard.regularAndOvertimeByEmployee', 'Regular & Overtime Hours by Employee')}
                  value={`${Math.round(hoursChartRegularTotal + hoursChartOvertimeTotal)}h`}
                  hint={t('dashboard.acrossEmployees', 'Across employees')}
                  text={text}
                  legend={
                    <ChartSeriesLegend
                      isDarkMode={isDarkMode}
                      items={[
                        {
                          label: t('dashboard.regularHoursLegend', 'Regular Hours'),
                          color: hoursEditorial.ink,
                        },
                        {
                          label: t('dashboard.totalOvertimeLegend', 'Overtime Hours'),
                          color: hoursEditorial.mute,
                        },
                      ]}
                    />
                  }
                />

                {hoursChartData.length === 0 ? (
                  <p className={`py-10 text-center text-sm ${text.secondary}`}>
                    {t('dashboard.noData', 'No time tracking data yet')}
                  </p>
                ) : (
                  <div className={`divide-y ${isDarkMode ? 'divide-slate-700/60' : 'divide-slate-100'}`}>
                    {hoursChartData.map((row) => {
                      const regular = Number(row.regularHours) || 0;
                      const overtime = Number(row.overtimeHours) || 0;
                      const total = regular + overtime;
                      const totalWidth = `${(total / hoursChartMaxTotal) * 100}%`;
                      const regularShare = total > 0 ? (regular / total) * 100 : 0;
                      const overtimeShare = total > 0 ? (overtime / total) * 100 : 0;
                      const employeeLabel = row.fullName || row.name;
                      const regularLabel = t('dashboard.regularHoursLegend', 'Regular Hours');
                      const overtimeLabel = t('dashboard.totalOvertimeLegend', 'Overtime Hours');
                      const fmtH = (n) => n.toFixed(n % 1 ? 1 : 0);

                      return (
                        <div
                          key={`${row.name}-${row.fullName}`}
                          className="group/hours relative z-0 cursor-default py-3.5 first:pt-0 last:pb-0 hover:z-30"
                        >
                          <div className="mb-2 flex items-baseline justify-between gap-3">
                            <p className={`min-w-0 truncate text-sm font-medium ${text.primary}`}>
                              {employeeLabel}
                            </p>
                            <p className={`shrink-0 text-sm tabular-nums ${text.secondary}`}>
                              <span className={`font-semibold ${text.primary}`}>
                                {fmtH(total)}h
                              </span>
                              {overtime > 0 && (
                                <span className="ml-2 text-xs opacity-80">
                                  {fmtH(regular)} + {fmtH(overtime)} OT
                                </span>
                              )}
                            </p>
                          </div>
                          <div
                            className="relative h-2.5 w-full overflow-hidden rounded-full"
                            style={{ background: hoursEditorial.track }}
                          >
                            <div
                              className="flex h-full overflow-hidden rounded-full transition-[width] duration-500 ease-out"
                              style={{ width: totalWidth }}
                            >
                              <div
                                className="h-full"
                                style={{ width: `${regularShare}%`, background: hoursEditorial.ink }}
                              />
                              {overtimeShare > 0 && (
                                <div
                                  className="h-full"
                                  style={{ width: `${overtimeShare}%`, background: hoursEditorial.mute }}
                                />
                              )}
                            </div>
                          </div>

                          <div
                            className={cn(
                              'pointer-events-none absolute left-1/2 top-1/2 z-30 w-max min-w-[11.5rem] -translate-x-1/2 -translate-y-1/2 rounded-lg border px-3 py-2 opacity-0 shadow-lg transition-opacity duration-150 group-hover/hours:opacity-100',
                              isDarkMode
                                ? 'border-slate-700 bg-slate-950 text-slate-100'
                                : 'border-slate-200 bg-white text-slate-900'
                            )}
                            role="tooltip"
                          >
                            <p className={cn('mb-1.5 text-xs font-medium', isDarkMode ? 'text-slate-400' : 'text-slate-500')}>
                              {`${t('dashboard.employeeLabel', 'Employee')}: ${employeeLabel}`}
                            </p>
                            <div className="space-y-1 text-xs">
                              <div className="flex items-center justify-between gap-6">
                                <span className="inline-flex items-center gap-2">
                                  <span className="h-0.5 w-2.5 rounded-full" style={{ background: hoursEditorial.ink }} />
                                  <span className={isDarkMode ? 'text-slate-300' : 'text-slate-600'}>{regularLabel}</span>
                                </span>
                                <span className="font-semibold tabular-nums">{fmtH(regular)}h</span>
                              </div>
                              <div className="flex items-center justify-between gap-6">
                                <span className="inline-flex items-center gap-2">
                                  <span className="h-0.5 w-2.5 rounded-full" style={{ background: hoursEditorial.mute }} />
                                  <span className={isDarkMode ? 'text-slate-300' : 'text-slate-600'}>{overtimeLabel}</span>
                                </span>
                                <span className="font-semibold tabular-nums">{fmtH(overtime)}h</span>
                              </div>
                              <div className={cn('mt-1.5 flex items-center justify-between gap-6 border-t pt-1.5', isDarkMode ? 'border-slate-700' : 'border-slate-100')}>
                                <span className={isDarkMode ? 'text-slate-300' : 'text-slate-600'}>{t('dashboard.total', 'Total')}</span>
                                <span className="font-semibold tabular-nums">{fmtH(total)}h</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                <ChartSummaryList
                  isDarkMode={isDarkMode}
                  text={text}
                  border={border}
                  items={[
                    {
                      label: t('dashboard.regularHoursLegend', 'Regular Hours'),
                      value: `${Math.round(hoursChartRegularTotal)}h`,
                      color: hoursEditorial.ink,
                    },
                    {
                      label: t('dashboard.totalOvertimeLegend', 'Overtime Hours'),
                      value: `${hoursChartOvertimeTotal.toFixed(1)}h`,
                      color: hoursEditorial.mute,
                    },
                  ]}
                />
          </div>
        </div>
      </div>
      </InView>

      {/* Charts Row 3 */}
      <InView
        once
        variants={{
          hidden: { opacity: 0, y: 28 },
          visible: { opacity: 1, y: 0 },
        }}
        transition={{ duration: 0.45, ease: 'easeOut' }}
        viewOptions={{ margin: '-40px' }}
      >
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Work & Leave Days Comparison */}
        <div className={chartCardClass(bg, border)}>
          <BorderBeam showOnHover size={110} duration={10} borderWidth={1.5} colorFrom="#3b82f6" colorTo="#94a3b8" />
          <div className="relative z-10">
          <ChartPanelHeader
            label={t('dashboard.workLeaveComp')}
            value={leaveChartWorkTotal + leaveChartLeaveTotal}
            hint={t('dashboard.acrossEmployees', 'Across employees')}
            text={text}
            legend={
              <ChartSeriesLegend
                isDarkMode={isDarkMode}
                items={[
                  {
                    label: t('dashboard.totalWorkDays', 'Total Work Days'),
                    color: chartTheme.series('workDays'),
                  },
                  {
                    label: t('dashboard.totalLeave', 'Total Leave'),
                    color: chartTheme.series('leaveDays'),
                  },
                ]}
              />
            }
          />
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={leaveData} margin={{ top: 4, right: 8, left: -8, bottom: 32 }} barCategoryGap="30%" barGap={3}>
              <CartesianGrid vertical={false} stroke={chartTheme.grid} strokeDasharray="0" />
              <XAxis
                dataKey="name"
                axisLine={false}
                tickLine={false}
                angle={-28}
                textAnchor="end"
                height={48}
                interval={0}
                tick={axisTick}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={axisTick}
                width={28}
              />
              <Tooltip
                cursor={{ fill: chartTheme.cursor }}
                content={({ active, payload, label }) => (
                  <ChartTooltipBox
                    active={active}
                    payload={payload}
                    label={label}
                    isDarkMode={isDarkMode}
                    chartTheme={chartTheme}
                    title={
                      payload?.[0]?.payload?.fullName
                        ? `${t('dashboard.employeeLabel', 'Employee')}: ${payload[0].payload.fullName}`
                        : label
                    }
                  />
                )}
              />
              <Bar
                dataKey="workDays"
                fill={chartTheme.series('workDays')}
                name={t('dashboard.totalWorkDays', 'Total Work Days')}
                radius={[3, 3, 0, 0]}
                maxBarSize={18}
              />
              <Bar
                dataKey="leaveDays"
                fill={chartTheme.series('leaveDays')}
                name={t('dashboard.totalLeave', 'Total Leave')}
                radius={[3, 3, 0, 0]}
                maxBarSize={18}
              />
            </BarChart>
          </ResponsiveContainer>
          <ChartSummaryList
            isDarkMode={isDarkMode}
            text={text}
            border={border}
            items={[
              {
                label: t('dashboard.totalWorkDays', 'Total Work Days'),
                value: leaveChartWorkTotal,
                color: chartTheme.series('workDays'),
              },
              {
                label: t('dashboard.totalLeave', 'Total Leave'),
                value: leaveChartLeaveTotal,
                color: chartTheme.series('leaveDays'),
              },
            ]}
          />
          </div>
        </div>

        {/* Top Performers */}
        <div className={chartCardClass(bg, border)}>
          <BorderBeam showOnHover size={110} duration={10} delay={0.5} borderWidth={1.5} colorFrom="#3b82f6" colorTo="#06b6d4" />
          <div className="relative z-10">
          <ChartPanelHeader
            label={t('dashboard.topPerformers')}
            value={topPerformers[0]?.performance?.toFixed?.(1) ?? topPerformers[0]?.performance ?? '—'}
            hint={topPerformers[0] ? getDemoEmployeeName(topPerformers[0], t) : undefined}
            text={text}
          />
          <ul className={`divide-y ${border.primary}`}>
            {topPerformers.map((emp, index) => {
              const score = Number(emp.performance) || 0;
              const widthPct = Math.max(8, Math.min(100, (score / 5) * 100));
              return (
                <li key={emp.id} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className={`w-5 shrink-0 text-xs tabular-nums ${text.secondary}`}>
                      {index + 1}
                    </span>
                    {emp.photo ? (
                      <img
                        src={emp.photo}
                        alt={getDemoEmployeeName(emp, t)}
                        className={`h-8 w-8 rounded-full object-cover border ${border.primary}`}
                      />
                    ) : (
                      <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                        isDarkMode ? 'bg-slate-700 text-slate-200' : 'bg-slate-100 text-slate-700'
                      }`}>
                        {getDemoEmployeeName(emp, t).charAt(0)}
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className={`truncate text-sm font-medium ${text.primary}`}>
                        {getDemoEmployeeName(emp, t)}
                      </p>
                      <p className={`truncate text-xs ${text.secondary}`}>
                        {t(`employeePosition.${emp.position}`)}
                      </p>
                      <div className={`mt-1.5 h-1 w-28 overflow-hidden rounded-full ${isDarkMode ? 'bg-slate-700' : 'bg-slate-100'}`}>
                        <div
                          className="h-full rounded-full bg-blue-500"
                          style={{ width: `${widthPct}%` }}
                        />
                      </div>
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className={`text-sm font-semibold tabular-nums ${text.primary}`}>{emp.performance}</p>
                    <p className={`text-xs tabular-nums ${text.secondary}`}>
                      {emp.overtime}h {t('dashboard.overtime')}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
          </div>
        </div>
      </div>
      </InView>

      {/* Additional Stats */}
      <InView
        once
        variants={{
          hidden: { opacity: 0, y: 24 },
          visible: { opacity: 1, y: 0 },
        }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        viewOptions={{ margin: '-30px' }}
      >
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <HoverMetricCard
          onClick={() => handleMetricClick('workDays')}
          className={cn(
            bg.secondary,
            'rounded-xl shadow-sm border p-6 cursor-pointer transition-all duration-300 hover:shadow-lg hover:-translate-y-1',
            border.primary
          )}
          beam={
            <BorderBeam showOnHover size={80} duration={8} borderWidth={2} colorFrom="#10b981" colorTo="#06b6d4" />
          }
        >
          {(replayToken) => (
            <>
              <Spotlight className={isDarkMode ? 'bg-emerald-400/15' : 'bg-emerald-400/10'} size={160} />
              <div className="relative z-10">
                <div className="flex items-center space-x-3 mb-2">
                  <AnimatedClockIcon isDarkMode={isDarkMode} className={`w-5 h-5 ${text.primary}`} />
                  <h4 className={`font-semibold ${text.primary}`}>
                    {t('dashboard.totalWorkDays')}
                  </h4>
                </div>
                <div className={`text-3xl font-bold ${text.primary}`}>
                  <SlidingNumber
                    value={Number(totalWorkDays) || 0}
                    replayToken={replayToken}
                    className={text.primary}
                  />
                </div>
                <p className={`text-sm ${text.secondary} mt-1`}>
                  {t('dashboard.acrossEmployees')}
                </p>
              </div>
            </>
          )}
        </HoverMetricCard>

        <HoverMetricCard
          onClick={() => handleMetricClick('applications')}
          className={cn(
            bg.secondary,
            'rounded-xl shadow-sm border p-6 cursor-pointer transition-all duration-300 hover:shadow-lg hover:-translate-y-1',
            border.primary
          )}
          beam={
            <BorderBeam showOnHover size={80} duration={9} delay={0.8} borderWidth={2} colorFrom="#3b82f6" colorTo="#8b5cf6" />
          }
        >
          {(replayToken) => (
            <>
              <Spotlight className={isDarkMode ? 'bg-blue-400/15' : 'bg-blue-400/10'} size={160} />
              <div className="relative z-10">
                <div className="flex items-center space-x-3 mb-2">
                  <FileUser className={`w-5 h-5 ${text.primary}`} />
                  <h4 className={`font-semibold ${text.primary}`}>
                    {t('dashboard.activeApplications')}
                  </h4>
                </div>
                <div className={`text-3xl font-bold ${text.primary}`}>
                  <SlidingNumber
                    value={applications.length}
                    replayToken={replayToken}
                    className={text.primary}
                  />
                </div>
                <p className={`text-sm ${text.secondary} mt-1`}>
                  {t('dashboard.pendingReview')}
                </p>
              </div>
            </>
          )}
        </HoverMetricCard>

        <HoverMetricCard
          onClick={() => handleMetricClick('pendingRequests')}
          className={cn(
            bg.secondary,
            'rounded-xl shadow-sm border p-6 cursor-pointer transition-all duration-300 hover:shadow-lg hover:-translate-y-1',
            border.primary
          )}
          beam={
            <BorderBeam showOnHover size={80} duration={8.5} delay={1.2} borderWidth={2} colorFrom="#f59e0b" colorTo="#ef4444" />
          }
        >
          {(replayToken) => (
            <>
              <Spotlight className={isDarkMode ? 'bg-amber-400/15' : 'bg-amber-400/10'} size={160} />
              <div className="relative z-10">
                <div className="flex items-center space-x-3 mb-2">
                  <MiniFlubberAutoMorphInProgress isDarkMode={isDarkMode} className={`w-5 h-5 ${text.primary}`} />
                  <h4 className={`font-semibold ${text.primary}`}>
                    {t('dashboard.pendingRequests')}
                  </h4>
                </div>
                <div className={`text-3xl font-bold ${text.primary}`}>
                  <SlidingNumber
                    value={Number(pendingApprovalsCount) || 0}
                    replayToken={replayToken}
                    className={text.primary}
                  />
                </div>
                <p className={`text-sm ${text.secondary} mt-1`}>
                  {t('dashboard.pendingApprovals', '')}
                </p>
              </div>
            </>
          )}
        </HoverMetricCard>
      </div>
      </InView>

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
