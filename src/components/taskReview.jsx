import React, { useState, useRef, useEffect, useMemo } from 'react';
import * as flubber from 'flubber';
import { 
  Calendar, 
  GraduationCap, 
  Pickaxe,
  Award, 
  Star, 
  ListCheck,
  MailCheck,
  School,
  CheckCircle, 
  Clock, 
  AlertCircle,
  BarChart3,
  Users,
  User,
  List,
  Filter,
  ChevronDown,
  ChevronUp,
  Loader,
  UserCheck,
  CircleCheck,
  ShieldCheck,
  Hourglass,
  Edit2,
  MessageSquare,
  CircleQuestionMark,
  X,
  Goal,
  Building,
  PersonStanding,
  Speech,
  Save,
  Ellipsis,
  BellElectric,
  Eye
} from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import * as workloadService from '../services/workloadService';

export const MiniFlubberAutoMorphEmployees = ({
  size = 24,
  className = '',
  isDarkMode = false,
  autoMorphInterval = 2000, // Time between auto-morphs in ms
  morphDuration = 1500, // Duration of each morph animation
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

export const MiniFlubberAutoMorphCompletionRate = ({
  size = 24,
  className = '',
  isDarkMode = false,
  autoMorphInterval = 2000, // Time between auto-morphs in ms
  morphDuration = 1500, // Duration of each morph animation
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
    { name: 'Circle', Icon: CircleCheck, status: 'standard' },
    { name: 'List', Icon: ListCheck, status: 'standard' },
    { name: 'Email', Icon: MailCheck, status: 'standard' },
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

export const MiniFlubberAutoMorphInProgress = ({
  size = 24,
  className = '',
  isDarkMode = false,
  autoMorphInterval = 2000, // Time between auto-morphs in ms
  morphDuration = 1500, // Duration of each morph animation
}) => {
  const [currentIconIndex, setCurrentIconIndex] = useState(0);
  const [morphPaths, setMorphPaths] = useState([]);
  const [isAnimating, setIsAnimating] = useState(false);
  const [maxSegmentLength] = useState(2);
  const iconRefs = useRef({});
  const animationFrameRef = useRef(null);
  const autoMorphTimerRef = useRef(null);

  /** ---------------------------
   * Dynamic color selection
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
    return isDarkMode ? 'text-gray-300' : 'text-gray-400';
  };

  /** Icon definitions */
  const icons = [
    { name: 'CircleQuestionMark', Icon: CircleQuestionMark, status: 'standard' },
    { name: 'Hourglass', Icon: Hourglass, status: 'standard' },
    { name: 'Loading', Icon: Loader, status: 'standard' },
    { name: '3 Dots', Icon: Ellipsis, status: 'standard' },
    { name: 'Bell', Icon: BellElectric, status: 'standard' },
    { name: 'Goal', Icon: Goal, status: 'standard' },
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

const TaskReview = ({ employees }) => {
  const { user, checkPermission } = useAuth();
  const { isDarkMode, bg, text, border } = useTheme();
  const { t } = useLanguage();
  
  // State management
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('organization');
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [filterPriority, setFilterPriority] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [expandedEmployee, setExpandedEmployee] = useState(null);
  const [orgStats, setOrgStats] = useState(null);
  const [employeeStats, setEmployeeStats] = useState({});
  const [reviewingTask, setReviewingTask] = useState(null);
  const [reviewForm, setReviewForm] = useState({
    qualityRating: 0,
    managerComments: '',
    status: ''
  });
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  
  // Modal ref
  const reviewModalRef = React.useRef(null);
  
  // Permissions
  const canViewAllEmployees = checkPermission('canViewReports');
  const availableEmployees = canViewAllEmployees 
    ? employees 
    : employees.filter(emp => String(emp.id) === String(user?.employeeId));

  // Fetch tasks from Supabase
  const fetchTasks = async () => {
    setLoading(true);
    try {
      let result;
      if (viewMode === 'individual' && selectedEmployee) {
        result = await workloadService.getEmployeeTasks(selectedEmployee);
      } else {
        result = await workloadService.getAllTasks();
      }
      
      if (result.success) {
        setTasks(result.data);
      }
    } catch (error) {
      console.error('Error fetching tasks:', error);
    } finally {
      setLoading(false);
    }
  };

  // Fetch organization statistics
  const fetchOrgStats = async () => {
    try {
      const result = await workloadService.getOrganizationTaskStats();
      if (result.success) {
        setOrgStats(result.data);
      }
    } catch (error) {
      console.error('Error fetching org stats:', error);
    }
  };

  // Fetch employee statistics
  const fetchEmployeeStats = async (employeeId) => {
    try {
      const result = await workloadService.getEmployeeTaskStats(employeeId);
      if (result.success) {
        setEmployeeStats(prev => ({
          ...prev,
          [employeeId]: result.data
        }));
      }
    } catch (error) {
      console.error('Error fetching employee stats:', error);
    }
  };

  // Load data on mount
  useEffect(() => {
    fetchTasks();
    if (viewMode === 'organization') {
      fetchOrgStats();
    }
  }, [viewMode, selectedEmployee]);

  // Load employee stats
  useEffect(() => {
    if (viewMode === 'organization' && employees.length > 0) {
      employees.forEach(emp => {
        if (!employeeStats[emp.id]) {
          fetchEmployeeStats(emp.id);
        }
      });
    } else if (viewMode === 'individual' && selectedEmployee) {
      fetchEmployeeStats(selectedEmployee);
    }
  }, [viewMode, selectedEmployee, employees]);

  // Real-time subscription
  useEffect(() => {
    const channel = workloadService.subscribeToTaskChanges(
      viewMode === 'individual' ? selectedEmployee : null,
      (payload) => {
        console.log('Task change:', payload);
        fetchTasks();
        if (viewMode === 'organization') {
          fetchOrgStats();
        }
      }
    );

    return () => {
      channel.unsubscribe();
    };
  }, [viewMode, selectedEmployee]);

  // Filter tasks
  const filteredTasks = useMemo(() => {
    let filtered = [...tasks];
    if (filterStatus !== 'all') {
      filtered = filtered.filter(task => task.status === filterStatus);
    }
    if (filterPriority !== 'all') {
      filtered = filtered.filter(task => task.priority === filterPriority);
    }
    return filtered;
  }, [tasks, filterStatus, filterPriority]);

  // Group tasks by employee
  const tasksByEmployee = useMemo(() => {
    const grouped = {};
    employees.forEach(emp => {
      const empTasks = filteredTasks.filter(
        task => String(task.employee_id) === String(emp.id) || 
                (task.employee && String(task.employee.id) === String(emp.id))
      );
      grouped[emp.id] = {
        employee: emp,
        tasks: empTasks,
        stats: employeeStats[emp.id] || {}
      };
    });
    return grouped;
  }, [filteredTasks, employees, employeeStats]);

  const getPriorityColor = (priority) => {
    switch(priority) {
      case 'high': return isDarkMode ? 'bg-red-900/30 text-red-400' : 'bg-red-100 text-red-800';
      case 'medium': return isDarkMode ? 'bg-yellow-900/30 text-yellow-400' : 'bg-yellow-100 text-yellow-800';
      case 'low': return isDarkMode ? 'bg-green-900/30 text-green-400' : 'bg-green-100 text-green-800';
      default: return isDarkMode ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusColor = (status) => {
    switch(status) {
      case 'completed': return isDarkMode ? 'bg-green-900/30 text-green-400' : 'bg-green-100 text-green-800';
      case 'in-progress': return isDarkMode ? 'bg-blue-900/30 text-blue-400' : 'bg-blue-100 text-blue-800';
      case 'pending': return isDarkMode ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-800';
      default: return isDarkMode ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-800';
    }
  };

  const calculateProgress = (empTasks) => {
    if (empTasks.length === 0) return 0;
    const completed = empTasks.filter(t => t.status === 'completed').length;
    return Math.round((completed / empTasks.length) * 100);
  };

  const calculateAvgQuality = (empTasks) => {
    const rated = empTasks.filter(t => t.quality_rating > 0);
    if (rated.length === 0) return 0;
    const avg = rated.reduce((sum, t) => sum + t.quality_rating, 0) / rated.length;
    return avg.toFixed(1);
  };

  // Organization View
  const OrganizationView = () => (
    <div className="space-y-6">
      {orgStats && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <div className={`${bg.secondary} rounded-lg p-4 border ${border.primary}`}>
            <div className="flex items-center justify-between mb-2">
              <BarChart3 className={`w-5 h-5 ${text.secondary}`} />
              <span className={`text-2xl font-bold ${text.primary}`}>{orgStats.totalTasks}</span>
            </div>
            <p className={`text-sm text-left ${text.secondary}`}>{t('taskReview.totalTasks')}</p>
          </div>
          <div className={`${bg.secondary} rounded-lg p-4 border ${border.primary}`}>
            <div className="flex items-center justify-between mb-2">
              <MiniFlubberAutoMorphEmployees size={24} isDarkMode={isDarkMode} />
              <span className={`text-2xl font-bold ${text.primary}`}>{orgStats.totalEmployees}</span>
            </div>
            <p className={`text-sm text-left ${text.secondary}`}>{t('taskReview.employees')}</p>
          </div>
          <div className={`${bg.secondary} rounded-lg p-4 border ${border.primary}`}>
            <div className="flex items-center justify-between mb-2">
              <ShieldCheck className={`w-6 h-6 ${text.secondary}`} />
              <span className={`text-2xl font-bold ${text.primary}`}>{orgStats.completed}</span>
            </div>
            <p className={`text-sm text-right ${text.secondary}`}>{t('taskReview.completed')}</p>
          </div>
          <div className={`${bg.secondary} rounded-lg p-4 border ${border.primary}`}>
            <div className="flex items-center justify-between mb-2">
              <MiniFlubberAutoMorphInProgress size={24} isDarkMode={isDarkMode} />
              <span className={`text-2xl font-bold ${text.primary}`}>{orgStats.inProgress}</span>
            </div>
            <p className={`text-sm text-left ${text.secondary}`}>{t('taskReview.inProgress')}</p>
          </div>
          <div className={`${bg.secondary} rounded-lg p-4 border ${border.primary}`}>
            <div className="flex items-center justify-between mb-2">
              <MiniFlubberAutoMorphCompletionRate isDarkMode={isDarkMode} className={`w-5 h-5 mr-8 ${text.secondary}`} />
              <span className={`text-2xl font-bold ${text.primary}`}>{orgStats.completionRate}%</span>
            </div>
            <p className={`text-sm text-right ${text.secondary}`}>{t('taskReview.completion')}</p>
          </div>
          <div className={`${bg.secondary} rounded-lg p-4 border ${border.primary}`}>
            <div className="flex items-center justify-between mb-2">
              <Star className={`w-5 h-5 ${text.secondary}`} />
              <span className={`text-2xl font-bold ${text.primary}`}>{orgStats.avgQualityRating}</span>
            </div>
            <p className={`text-sm text-right ${text.secondary}`}>{t('taskReview.quality')}</p>
          </div>
        </div>
      )}
      <div className={`${bg.secondary} rounded-lg p-6 border ${border.primary}`}>
        <h3 className={`text-lg font-semibold ${text.primary} mb-4`}>
          {t('taskReview.employeeBreakdown')}
        </h3>
        <div className="space-y-3">
          {Object.values(tasksByEmployee).filter(({ tasks }) => tasks.length > 0).map(({ employee, tasks: empTasks }) => {
            const isExpanded = expandedEmployee === employee.id;
            const progress = calculateProgress(empTasks);
            const avgQuality = calculateAvgQuality(empTasks);
            return (
              <div key={employee.id} className={`border ${border.primary} rounded-lg overflow-hidden`}>
                <div className={`p-4 cursor-pointer ${isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-50'} transition-colors`} onClick={() => setExpandedEmployee(isExpanded ? null : employee.id)}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3 flex-1">
                      {employee.photo ? (
                        <img src={employee.photo} alt={employee.name} className={`w-10 h-10 rounded-full object-cover border-2 ${isDarkMode ? 'border-gray-600' : 'border-gray-200'}`} />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center font-bold text-white">
                          {employee.name?.charAt(0) || 'U'}
                        </div>
                      )}
                      <div className="flex-1">
                        <p className={`font-semibold ${text.primary}`}>{employee.name}</p>
                        <p className={`text-xs ${text.secondary}`}>
                          {t(`employeePosition.${employee.position}`) || employee.position} • {t(`employeeDepartment.${employee.department}`) || employee.department}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-6 text-sm">
                      <div className="text-center">
                        <p className={`font-semibold ${text.primary}`}>{empTasks.length}</p>
                        <p className={`text-xs ${text.secondary}`}>{t('taskReview.tasks')}</p>
                      </div>
                      <div className="text-center">
                        <p className={`font-semibold ${text.primary}`}>{progress}%</p>
                        <p className={`text-xs ${text.secondary}`}>{t('taskReview.progress')}</p>
                      </div>
                      <div className="text-center">
                        <p className={`font-semibold ${text.primary}`}>{avgQuality}/5</p>
                        <p className={`text-xs ${text.secondary}`}>{t('taskReview.quality')}</p>
                      </div>
                      {isExpanded ? <ChevronUp className={`w-5 h-5 ${text.secondary}`} /> : <ChevronDown className={`w-5 h-5 ${text.secondary}`} />}
                    </div>
                  </div>
                  <div className={`mt-3 w-full rounded-full h-2 ${isDarkMode ? 'bg-gray-700' : 'bg-gray-200'}`}>
                    <div className="bg-linear-to-r from-blue-500 to-blue-600 h-2 rounded-full" style={{ width: `${progress}%` }}></div>
                  </div>
                </div>
                {isExpanded && (
                  <div className={`border-t ${border.primary} p-4 ${isDarkMode ? 'bg-gray-800/50' : 'bg-gray-50'}`}>
                    <div className="space-y-3">
                      {empTasks.map(task => (
                        <div key={task.id} className={`p-4 rounded ${bg.secondary} border ${border.primary} hover:shadow-md transition-all`}>
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex-1">
                              <div className="flex items-center space-x-2 mb-2">
                                <h4 className={`font-semibold ${text.primary}`}>{task.title}</h4>
                                <span className={`px-2 py-0.5 rounded text-xs ${getStatusColor(task.status)}`}>
                                  {t(`status.${task.status}`) || task.status}
                                </span>
                                <span className={`px-2 py-0.5 rounded text-xs ${getPriorityColor(task.priority)}`}>
                                  {t(`taskListing.${task.priority}`) || task.priority}
                                </span>
                              </div>
                              {task.description && <p className={`text-sm ${text.secondary} mb-3`}>{task.description}</p>}
                              
                              {/* Task Details Grid */}
                              <div className="grid grid-cols-2 gap-3 mb-3">
                                {task.due_date && (
                                  <div className={`flex items-center space-x-2 ${text.secondary} text-xs`}>
                                    <Calendar className="w-4 h-4" />
                                    <div>
                                      <p className="font-medium">{t('taskReview.dueDate')}</p>
                                      <p className={text.primary}>{new Date(task.due_date).toLocaleDateString()}</p>
                                    </div>
                                  </div>
                                )}
                                <div className={`flex items-center space-x-2 ${text.secondary} text-xs`}>
                                  <User className="w-4 h-4" />
                                  <div>
                                    <p className="font-medium">{t('taskReview.assignedTo')}</p>
                                    <p className={text.primary}>{employees.find(e => e.id === task.employee_id)?.name || t('taskReview.unknown')}</p>
                                  </div>
                                </div>
                                {task.created_by && (
                                  <div className={`flex items-center space-x-2 ${text.secondary} text-xs`}>
                                    <UserCheck className="w-4 h-4" />
                                    <div>
                                      <p className="font-medium">{t('taskReview.assignedBy')}</p>
                                      <p className={text.primary}>{employees.find(e => e.id === task.created_by)?.name || t('taskReview.unknown')}</p>
                                    </div>
                                  </div>
                                )}
                                {task.quality_rating > 0 && (
                                  <div className={`flex items-center space-x-2 ${text.secondary} text-xs`}>
                                    <Star className="w-4 h-4 text-yellow-400" />
                                    <div>
                                      <p className="font-medium">{t('taskReview.qualityRating')}</p>
                                      <p className={text.primary}>{task.quality_rating}/5 ⭐</p>
                                    </div>
                                  </div>
                                )}
                              </div>

                              {task.self_assessment && (
                                <div className={`mt-2 p-3 rounded ${isDarkMode ? 'bg-blue-900/20' : 'bg-blue-50'} border-l-4 border-blue-500`}>
                                  <p className={`text-xs font-semibold ${text.primary} mb-1 flex items-center space-x-1`}>
                                    <MessageSquare className="w-3 h-3" />
                                    <span>{t('taskReview.employeeSelfAssessment')}:</span>
                                  </p>
                                  <p className={`text-sm ${text.secondary}`}>{task.self_assessment}</p>
                                </div>
                              )}
                              {task.comments && (
                                <div className={`mt-2 p-3 rounded ${isDarkMode ? 'bg-amber-600/20' : 'bg-amber-50'} border-l-4 border-amber-500`}>
                                  <p className={`text-xs font-semibold ${text.primary} mb-1 flex items-center space-x-1`}>
                                    <Award className="w-3 h-3" />
                                    <span>{t('taskReview.managerEvaluation')}:</span>
                                  </p>
                                  <p className={`text-sm ${text.secondary}`}>{task.comments}</p>
                                </div>
                              )}
                            </div>
                            
                            {/* Review Button */}
                            {checkPermission('canViewReports') && (
                              <button
                                onClick={() => {
                                  setReviewingTask(task);
                                  setReviewForm({
                                    qualityRating: task.quality_rating || 0,
                                    managerComments: task.comments || '',
                                    status: task.status || 'pending'
                                  });
                                }}
                                className={`ml-4 px-4 py-2 rounded-lg flex items-center space-x-2 ${isDarkMode ? 'bg-blue-600 hover:bg-blue-700' : 'bg-blue-500 hover:bg-blue-600'} text-white transition-colors cursor-pointer`}
                              >
                                <Edit2 className="w-4 h-4" />
                                <span>{t('taskReview.review')}</span>
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );

  const IndividualView = () => {
    const empData = selectedEmployee ? tasksByEmployee[selectedEmployee] : null;
    const stats = empData?.stats || {};
    const empTasks = empData?.tasks || [];
    if (!selectedEmployee || !empData) {
      return (
        <div className={`${bg.secondary} rounded-lg p-8 text-center border ${border.primary}`}>
          <p className={text.secondary}>{t('taskReview.selectEmployeeToView')}</p>
        </div>
      );
    }
    return (
      <div className="space-y-6">
        <div className={`${bg.secondary} rounded-lg p-6 border ${border.primary}`}>
          <div className="flex items-center space-x-4">
            {empData.employee.photo ? (
              <img src={empData.employee.photo} alt={empData.employee.name} className={`w-16 h-16 rounded-full object-cover border-2 ${isDarkMode ? 'border-gray-600' : 'border-gray-200'}`} />
            ) : (
              <div className="w-16 h-16 rounded-full bg-blue-500 flex items-center justify-center font-bold text-2xl text-white">
                {empData.employee.name?.charAt(0) || 'U'}
              </div>
            )}
            <div>
              <h3 className={`text-xl font-bold ${text.primary}`}>{empData.employee.name}</h3>
              <p className={`text-sm ${text.secondary}`}>
                {t(`employeePosition.${empData.employee.position}`) || empData.employee.position} • {t(`employeeDepartment.${empData.employee.department}`) || empData.employee.department}
              </p>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <div className={`${bg.secondary} rounded-lg p-4 border ${border.primary}`}>
            <div className="flex items-center justify-between mb-2">
              <List className={`w-5 h-5 ${text.secondary}`} />
              <span className={`text-2xl font-bold ${text.primary}`}>{stats.total || 0}</span>
            </div>
            <p className={`text-sm ${text.secondary}`}>{t('taskReview.total')}</p>
          </div>
          <div className={`${bg.secondary} rounded-lg p-4 border ${border.primary}`}>
            <div className="flex items-center justify-between mb-2">
              <CheckCircle className={`w-5 h-5 ${text.secondary}`} />
              <span className={`text-2xl font-bold ${text.primary}`}>{stats.completed || 0}</span>
            </div>
            <p className={`text-sm ${text.secondary}`}>{t('taskReview.completed')}</p>
          </div>
          <div className={`${bg.secondary} rounded-lg p-4 border ${border.primary}`}>
            <div className="flex items-center justify-between mb-2">
              <Clock className={`w-5 h-5 ${text.secondary}`} />
              <span className={`text-2xl font-bold ${text.primary}`}>{stats.inProgress || 0}</span>
            </div>
            <p className={`text-sm ${text.secondary}`}>{t('taskReview.inProgress')}</p>
          </div>
          <div className={`${bg.secondary} rounded-lg p-4 border ${border.primary}`}>
            <div className="flex items-center justify-between mb-2">
              <AlertCircle className={`w-5 h-5 ${text.secondary}`} />
              <span className={`text-2xl font-bold ${text.primary}`}>{stats.overdue || 0}</span>
            </div>
            <p className={`text-sm ${text.secondary}`}>{t('taskReview.overdue')}</p>
          </div>
          <div className={`${bg.secondary} rounded-lg p-4 border ${border.primary}`}>
            <div className="flex items-center justify-between mb-2">
              <Pickaxe className={`w-5 h-5 ${text.secondary}`} />
              <span className={`text-2xl font-bold ${text.primary}`}>{stats.completionRate || 0}%</span>
            </div>
            <p className={`text-sm ${text.secondary}`}>{t('taskReview.completion')}</p>
          </div>
          <div className={`${bg.secondary} rounded-lg p-4 border ${border.primary}`}>
            <div className="flex items-center justify-between mb-2">
              <Star className={`w-5 h-5 ${text.secondary}`} />
              <span className={`text-2xl font-bold ${text.primary}`}>{stats.avgQualityRating || '0.0'}</span>
            </div>
            <p className={`text-sm ${text.secondary}`}>{t('taskReview.quality')}</p>
          </div>
        </div>
        <div className={`${bg.secondary} rounded-lg p-6 border ${border.primary}`}>
          <h3 className={`text-lg font-semibold ${text.primary} mb-4`}>{t('taskReview.taskList')}</h3>
          <div className="space-y-4">
            {empTasks.map(task => (
              <div key={task.id} className={`p-4 rounded border ${border.primary} ${isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-50'} transition-all hover:shadow-md`}>
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-2">
                      <h4 className={`font-semibold ${text.primary}`}>{task.title}</h4>
                      <span className={`px-2 py-0.5 rounded text-xs ${getStatusColor(task.status)}`}>
                        {t(`status.${task.status}`) || task.status}
                      </span>
                      <span className={`px-2 py-0.5 rounded text-xs ${getPriorityColor(task.priority)}`}>
                        {t(`taskListing.${task.priority}`) || task.priority}
                      </span>
                    </div>
                    {task.description && <p className={`text-sm ${text.secondary} mb-3`}>{task.description}</p>}
                    
                    {/* Task Details Grid */}
                    <div className="grid grid-cols-2 gap-3 mb-3">
                      {task.due_date && (
                        <div className={`flex items-center space-x-2 ${text.secondary} text-xs`}>
                          <Calendar className="w-4 h-4" />
                          <div>
                            <p className="font-medium">{t('taskReview.dueDate')}</p>
                            <p className={text.primary}>{new Date(task.due_date).toLocaleDateString()}</p>
                          </div>
                        </div>
                      )}
                      <div className={`flex items-center space-x-2 ${text.secondary} text-xs`}>
                        <User className="w-4 h-4" />
                        <div>
                          <p className="font-medium">{t('taskReview.assignedTo')}</p>
                          <p className={text.primary}>{employees.find(e => e.id === task.employee_id)?.name || t('taskReview.unknown')}</p>
                        </div>
                      </div>
                      {task.created_by && (
                        <div className={`flex items-center space-x-2 ${text.secondary} text-xs`}>
                          <UserCheck className="w-4 h-4" />
                          <div>
                            <p className="font-medium">{t('taskReview.assignedBy')}</p>
                            <p className={text.primary}>{employees.find(e => e.id === task.created_by)?.name || t('taskReview.unknown')}</p>
                          </div>
                        </div>
                      )}
                      {task.quality_rating > 0 && (
                        <div className={`flex items-center space-x-2 ${text.secondary} text-xs`}>
                          <Star className="w-4 h-4 text-yellow-400" />
                          <div>
                            <p className="font-medium">{t('taskReview.qualityRating')}</p>
                            <p className={text.primary}>{task.quality_rating}/5 ⭐</p>
                          </div>
                        </div>
                      )}
                    </div>

                    {task.self_assessment && (
                      <div className={`mt-2 p-3 rounded ${isDarkMode ? 'bg-blue-900/20' : 'bg-blue-50'} border-l-4 border-blue-500`}>
                        <p className={`text-xs font-semibold ${text.primary} mb-1 flex items-center space-x-1`}>
                          <MessageSquare className="w-3 h-3" />
                          <span>{t('taskReview.employeeSelfAssessment')}:</span>
                        </p>
                        <p className={`text-sm ${text.secondary}`}>{task.self_assessment}</p>
                      </div>
                    )}
                    {task.comments && (
                      <div className={`mt-2 p-3 rounded ${isDarkMode ? 'bg-amber-600/20' : 'bg-amber-50'} border-l-4 border-amber-500`}>
                        <p className={`text-xs font-semibold ${text.primary} mb-1 flex items-center space-x-1`}>
                          <Award className="w-3 h-3" />
                          <span>{t('taskReview.managerEvaluation')}:</span>
                        </p>
                        <p className={`text-sm ${text.secondary}`}>{task.comments}</p>
                      </div>
                    )}
                  </div>
                  
                  {/* Review Button */}
                  {checkPermission('canViewReports') && (
                    <button
                      onClick={() => {
                        setReviewingTask(task);
                        setReviewForm({
                          qualityRating: task.quality_rating || 0,
                          managerComments: task.comments || '',
                          status: task.status || 'pending'
                        });
                      }}
                      className={`ml-4 px-4 py-2 rounded-lg flex items-center space-x-2 ${isDarkMode ? 'bg-blue-600 hover:bg-blue-700' : 'bg-blue-500 hover:bg-blue-600'} text-white transition-colors cursor-pointer`}
                    >
                      <Edit2 className="w-4 h-4" />
                      <span>{t('taskReview.review')}</span>
                    </button>
                  )}
                </div>
              </div>
            ))}
            {empTasks.length === 0 && (
              <div className="text-center py-8">
                <p className={text.secondary}>{t('taskReview.noTasksForEmployee')}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };
  
  // Handle review submission
  const handleReviewSubmit = async () => {
    if (!reviewingTask) return;

    try {
      const updateData = {
        quality_rating: reviewForm.qualityRating,
        comments: reviewForm.managerComments,
        status: reviewForm.status
      };

      const result = await workloadService.updateTask(reviewingTask.id, updateData);

      if (result.success) {
        setSuccessMessage(t('taskReview.reviewSubmitSuccess'));
        setReviewingTask(null);
        setReviewForm({ qualityRating: 0, managerComments: '', status: 'pending' });
        
        // Refetch tasks
        if (viewMode === 'organization') {
          fetchTasks();
          fetchOrgStats();
        } else if (selectedEmployee) {
          fetchEmployeeStats(selectedEmployee);
        }

        // Clear success message after 3 seconds
        setTimeout(() => setSuccessMessage(''), 3000);
      } else {
        setErrorMessage(result.error || t('taskReview.reviewSubmitFailed'));
        setTimeout(() => setErrorMessage(''), 3000);
      }
    } catch (error) {
      console.error('Error submitting review:', error);
      setErrorMessage(t('taskReview.reviewSubmitError'));
      setTimeout(() => setErrorMessage(''), 3000);
    }
  };

  // Handle ESC key to close modal
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && reviewingTask) {
        setReviewingTask(null);
        setReviewForm({ qualityRating: 0, managerComments: '', status: 'pending' });
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [reviewingTask]);

  // Handle outside click to close modal
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (reviewModalRef.current && !reviewModalRef.current.contains(e.target) && reviewingTask) {
        setReviewingTask(null);
        setReviewForm({ qualityRating: 0, managerComments: '', status: 'pending' });
      }
    };

    if (reviewingTask) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [reviewingTask]);

  return (
    <div className="space-y-6">
      {/* Success/Error Messages */}
      {successMessage && (
        <div className={`p-4 rounded-lg border-l-4 border-green-500 ${isDarkMode ? 'bg-green-900/20' : 'bg-green-50'} flex items-center justify-between`}>
          <div className="flex items-center space-x-2">
            <CheckCircle className="w-5 h-5 text-green-500" />
            <p className={`font-medium ${text.primary}`}>{successMessage}</p>
          </div>
          <button onClick={() => setSuccessMessage('')} className={text.secondary}>
            <X className="w-5 h-5" />
          </button>
        </div>
      )}
      {errorMessage && (
        <div className={`p-4 rounded-lg border-l-4 border-red-500 ${isDarkMode ? 'bg-red-900/20' : 'bg-red-50'} flex items-center justify-between`}>
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-5 h-5 text-red-500" />
            <p className={`font-medium ${text.primary}`}>{errorMessage}</p>
          </div>
          <button onClick={() => setErrorMessage('')} className={text.secondary}>
            <X className="w-5 h-5" />
          </button>
        </div>
      )}

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className={`text-2xl font-bold ${text.primary}`}>{t('taskReview.title')}</h2>
          <p className={`text-sm ${text.secondary} mt-1`}>{t('taskReview.subtitle')}</p>
        </div>
        {canViewAllEmployees && (
          <div className="flex space-x-2">
            <button
              onClick={() => { setViewMode('organization'); setSelectedEmployee(null); }}
              className={`px-4 py-2 rounded-lg cursor-pointer transition-colors ${viewMode === 'organization' ? 'bg-blue-600 text-white' : isDarkMode ? 'bg-gray-700 text-gray-200 hover:bg-gray-600' : 'bg-gray-100 text-gray-800 hover:bg-gray-200'}`}
            >
              <School className="w-4 h-4 inline-block mr-2 -translate-y-0.5" />{t('taskReview.organization')}
            </button>
            <button
              onClick={() => {
                setViewMode('individual');
                if (!selectedEmployee && user?.employeeId) {
                  setSelectedEmployee(String(user.employeeId));
                }
              }}
              className={`px-4 py-2 rounded-lg cursor-pointer transition-colors ${viewMode === 'individual' ? 'bg-amber-600 text-white' : isDarkMode ? 'bg-gray-700 text-gray-200 hover:bg-gray-600' : 'bg-gray-100 text-gray-800 hover:bg-gray-200'}`}
            >
              <GraduationCap className="w-4 h-4 inline-block mr-2 -translate-y-0.5" />{t('taskReview.individual')}
            </button>
          </div>
        )}
      </div>
      {viewMode === 'individual' && canViewAllEmployees && (
        <div className={`${bg.secondary} rounded-lg p-4 border ${border.primary}`}>
          <label className={`block text-sm font-medium ${text.primary} mb-2`}>{t('taskReview.selectEmployee')}</label>
          <select
            value={selectedEmployee || ''}
            onChange={(e) => setSelectedEmployee(e.target.value)}
            className={`w-full px-4 py-2 rounded-lg border ${border.primary} ${text.primary}`}
            style={{ backgroundColor: isDarkMode ? '#4b5563' : '#ffffff', color: isDarkMode ? '#ffffff' : '#111827' }}
          >
            <option value="">{t('taskReview.chooseEmployee')}</option>
            {availableEmployees.map(emp => (
              <option key={emp.id} value={emp.id}>
                {emp.name} - {t(`employeePosition.${emp.position}`) || emp.position}
              </option>
            ))}
          </select>
        </div>
      )}
      <div className={`${bg.secondary} rounded-lg p-4 border ${border.primary}`}>
        <div className="flex flex-wrap items-center gap-4">
          <Filter className={`w-5 h-5 ${text.secondary}`} />
          <div className="flex items-center space-x-2">
            <span className={`text-sm ${text.secondary}`}>{t('taskReview.status')}:</span>
            <button onClick={() => setFilterStatus('all')} className={`px-3 py-1 rounded text-sm cursor-pointer ${filterStatus === 'all' ? 'bg-blue-600 text-white' : isDarkMode ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-600'}`}>{t('taskReview.all')}</button>
            <button onClick={() => setFilterStatus('completed')} className={`px-3 py-1 rounded text-sm cursor-pointer ${filterStatus === 'completed' ? 'bg-green-600 text-white' : isDarkMode ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-600'}`}>{t('taskReview.completed')}</button>
            <button onClick={() => setFilterStatus('in-progress')} className={`px-3 py-1 rounded text-sm cursor-pointer ${filterStatus === 'in-progress' ? 'bg-amber-600 text-white' : isDarkMode ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-600'}`}>{t('taskReview.inProgress')}</button>
            <button onClick={() => setFilterStatus('pending')} className={`px-3 py-1 rounded text-sm cursor-pointer ${filterStatus === 'pending' ? 'bg-gray-600 text-white' : isDarkMode ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-600'}`}>{t('taskReview.pending')}</button>
          </div>
          <div className="flex items-center space-x-2">
            <span className={`text-sm ${text.secondary}`}>{t('taskReview.priority')}:</span>
            <button onClick={() => setFilterPriority('all')} className={`px-3 py-1 rounded text-sm cursor-pointer ${filterPriority === 'all' ? 'bg-blue-600 text-white' : isDarkMode ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-600'}`}>{t('taskReview.all')}</button>
            <button onClick={() => setFilterPriority('high')} className={`px-3 py-1 rounded text-sm cursor-pointer ${filterPriority === 'high' ? 'bg-red-600 text-white' : isDarkMode ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-600'}`}>{t('taskReview.high')}</button>
            <button onClick={() => setFilterPriority('medium')} className={`px-3 py-1 rounded text-sm cursor-pointer ${filterPriority === 'medium' ? 'bg-yellow-600 text-white' : isDarkMode ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-600'}`}>{t('taskReview.medium')}</button>
            <button onClick={() => setFilterPriority('low')} className={`px-3 py-1 rounded text-sm cursor-pointer ${filterPriority === 'low' ? 'bg-green-600 text-white' : isDarkMode ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-600'}`}>{t('taskReview.low')}</button>
          </div>
        </div>
      </div>
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      ) : viewMode === 'organization' ? <OrganizationView /> : <IndividualView />}

      {/* Review Modal */}
      {reviewingTask && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div ref={reviewModalRef} className={`${bg.secondary} rounded-lg shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto border ${border.primary}`}>
            <div className={`sticky top-0 ${bg.secondary} border-b ${border.primary} px-6 py-4 flex items-center justify-between`}>
              <div>
                <h3 className={`text-xl font-bold ${text.primary}`}>{t('taskReview.reviewTask')}</h3>
                <p className={`text-sm ${text.secondary} mt-1`}>{reviewingTask.title}</p>
              </div>
              <button
                onClick={() => {
                  setReviewingTask(null);
                  setReviewForm({ qualityRating: 0, managerComments: '', status: 'pending' });
                }}
                className={`${text.secondary} hover:${text.primary} transition-colors`}
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Task Information */}
              <div className={`p-4 rounded-lg ${isDarkMode ? 'bg-gray-700' : 'bg-gray-50'} border ${border.primary}`}>
                <h4 className={`font-semibold ${text.primary} mb-3 flex items-center space-x-2`}>
                  <Eye className="w-4 h-4" />
                  <span>{t('taskReview.taskDetails')}</span>
                </h4>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className={`${text.secondary} font-medium`}>{t('taskReview.assignedTo')}:</p>
                    <p className={text.primary}>{employees.find(e => e.id === reviewingTask.employee_id)?.name || t('taskReview.unknown')}</p>
                  </div>
                  <div>
                    <p className={`${text.secondary} font-medium`}>{t('taskReview.assignedBy')}:</p>
                    <p className={text.primary}>{employees.find(e => e.id === reviewingTask.created_by)?.name || t('taskReview.unknown')}</p>
                  </div>
                  {reviewingTask.due_date && (
                    <div>
                      <p className={`${text.secondary} font-medium`}>{t('taskReview.dueDate')}:</p>
                      <p className={text.primary}>{new Date(reviewingTask.due_date).toLocaleDateString()}</p>
                    </div>
                  )}
                  <div>
                    <p className={`${text.secondary} font-medium`}>{t('taskReview.priority')}:</p>
                    <span className={`px-2 py-0.5 rounded text-xs ${getPriorityColor(reviewingTask.priority)}`}>{reviewingTask.priority}</span>
                  </div>
                </div>
                {reviewingTask.description && (
                  <div className="mt-3">
                    <p className={`${text.secondary} font-medium`}>{t('taskReview.description')}:</p>
                    <p className={`${text.primary} text-sm mt-1`}>{reviewingTask.description}</p>
                  </div>
                )}
                {reviewingTask.self_assessment && (
                  <div className={`mt-3 p-3 rounded ${isDarkMode ? 'bg-blue-900/20' : 'bg-blue-50'} border-l-4 border-blue-500`}>
                    <p className={`${text.primary} font-semibold text-sm mb-1`}>{t('taskReview.employeeSelfAssessment')}:</p>
                    <p className={`${text.secondary} text-sm`}>{reviewingTask.self_assessment}</p>
                  </div>
                )}
              </div>

              {/* Quality Rating */}
              <div>
                <label className={`block text-sm font-semibold ${text.primary} mb-3`}>
                  {t('taskReview.qualityRatingStars')}
                </label>
                <div className="flex items-center space-x-2">
                  {[1, 2, 3, 4, 5].map(rating => (
                    <button
                      key={rating}
                      onClick={() => setReviewForm({ ...reviewForm, qualityRating: rating })}
                      className={`transition-all cursor-pointer ${reviewForm.qualityRating >= rating ? 'text-yellow-400 scale-110' : isDarkMode ? 'text-gray-600' : 'text-gray-300'} hover:scale-125`}
                    >
                      <Star className={`w-8 h-8 ${reviewForm.qualityRating >= rating ? 'fill-yellow-400' : ''}`} />
                    </button>
                  ))}
                  <span className={`ml-4 ${text.primary} font-semibold text-lg`}>
                    {reviewForm.qualityRating > 0 ? `${reviewForm.qualityRating}/5` : t('taskReview.notRated')}
                  </span>
                </div>
              </div>

              {/* Status Update */}
              <div>
                <label className={`block text-sm font-semibold ${text.primary} mb-2`}>
                  {t('taskReview.updateStatus')}
                </label>
                <select
                  value={reviewForm.status}
                  onChange={(e) => setReviewForm({ ...reviewForm, status: e.target.value })}
                  className={`w-full px-4 py-2 rounded-lg border ${border.primary} ${text.primary}`}
                  style={{ backgroundColor: isDarkMode ? '#4b5563' : '#ffffff', color: isDarkMode ? '#ffffff' : '#111827' }}
                >
                  <option value="pending">{t('taskReview.pending')}</option>
                  <option value="in-progress">{t('taskReview.inProgress')}</option>
                  <option value="completed">{t('taskReview.completed')}</option>
                </select>
              </div>

              {/* Manager Comments */}
              <div>
                <label className={`block text-sm font-semibold ${text.primary} mb-2`}>
                  {t('taskReview.managerEvaluationComments')}
                </label>
                <textarea
                  value={reviewForm.managerComments}
                  onChange={(e) => setReviewForm({ ...reviewForm, managerComments: e.target.value })}
                  placeholder={t('taskReview.feedbackPlaceholder')}
                  rows={6}
                  className={`w-full px-4 py-2 rounded-lg border ${border.primary} ${text.primary} resize-none`}
                  style={{ backgroundColor: isDarkMode ? '#4b5563' : '#ffffff', color: isDarkMode ? '#ffffff' : '#111827' }}
                />
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end space-x-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                <button
                  onClick={() => {
                    setReviewingTask(null);
                    setReviewForm({ qualityRating: 0, managerComments: '', status: 'pending' });
                  }}
                  className={`px-6 py-2 rounded-lg border ${border.primary} ${text.primary} hover:${isDarkMode ? 'bg-gray-700' : 'bg-gray-100'} transition-colors cursor-pointer flex items-center space-x-2`}
                >
                  <X className="w-4 h-4" />
                  <span>{t('taskReview.cancel')}</span>
                </button>
                <button
                  onClick={handleReviewSubmit}
                  className={`px-6 py-2 rounded-lg ${isDarkMode ? 'bg-blue-600 hover:bg-blue-700' : 'bg-blue-500 hover:bg-blue-600'} text-white transition-colors cursor-pointer flex items-center space-x-2`}
                >
                  <Save className="w-4 h-4" />
                  <span>{t('taskReview.submitReview')}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TaskReview;
