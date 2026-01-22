import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import * as flubber from 'flubber';
import { 
  // Basic Shapes
  Circle, Square, Triangle, Star, Hexagon, Octagon,
  
  // Arrows & Directions
  ArrowUp, ArrowDown, ArrowLeft, ArrowRight, ArrowUpRight, ArrowDownLeft,
  ChevronUp, ChevronDown, ChevronLeft, ChevronRight,
  ChevronsUp, ChevronsDown, ChevronsLeft, ChevronsRight,
  TrendingUp, TrendingDown, MoveUp, MoveDown, MoveLeft, MoveRight,
  
  // Weather & Nature
  Sun, Moon, Cloud, CloudRain, CloudSnow, CloudLightning, Zap, Sparkles,
  CloudDrizzle, CloudFog, Wind, Sunrise, Sunset, Cloudy,
  
  // Emotions & Faces
  Smile, Frown, Meh, Laugh, SmilePlus, Angry, Ghost, Skull,
  Heart, HeartCrack, HeartHandshake, HeartPulse,
  
  // Media Controls
  Play, Pause, Square as StopSquare, SkipForward, SkipBack, FastForward, Rewind,
  Volume, Volume1, Volume2, VolumeX, Mic, MicOff,
  Music, Music2, Radio, Disc,
  
  // Files & Documents
  File, FileText, FileEdit, FilePlus, FileMinus, FileCheck, FileX,
  Folder, FolderOpen, FolderPlus, FolderMinus,
  Copy, Clipboard, ClipboardList, ClipboardCheck, ClipboardCopy,
  
  // Communication
  Mail, MailOpen, MailPlus, MailMinus, MailCheck, MailX,
  Phone, PhoneCall, PhoneIncoming, PhoneOutgoing, PhoneMissed, PhoneOff,
  MessageCircle, MessageSquare, Send, Inbox, Archive,
  
  // User & People
  User, Users, UserPlus, UserMinus, UserCheck, UserX,
  Contact, UserCircle, UserSquare,
  
  // Actions & Status
  Check, CheckCircle, CheckSquare, X, XCircle, XSquare, XOctagon,
  Plus, PlusCircle, PlusSquare, Minus, MinusCircle, MinusSquare,
  Equal, Slash, Percent, Hash, AtSign, DollarSign,
  
  // Navigation & Location
  Home, Building, Building2, MapPin, Map, Navigation, Compass,
  Globe, Package, Box, Archive as ArchiveBox,
  
  // Upload/Download
  Upload, Download, UploadCloud, DownloadCloud, 
  Share, Share2, Forward, Reply, RefreshCw, RotateCw, RotateCcw,
  
  // Time & Calendar
  Clock, AlarmClock, Timer, Hourglass, Calendar, CalendarDays,
  Watch, History,
  
  // Charts & Analytics
  BarChart, BarChart2, BarChart3, PieChart, Activity, TrendingUp as TrendUp,
  LineChart, AreaChart,
  
  // Objects & Tools
  Camera, Video, Image, Film, Aperture,
  Scissors, Crop, Maximize, Minimize, ZoomIn, ZoomOut,
  Eye, EyeOff, Search, SearchX, Filter, SlidersHorizontal,
  Settings, Cog, Wrench, Hammer, Zap as Lightning,
  
  // Badges & Symbols
  Award, Trophy, Medal, Target, Flag, Bookmark, Tag,
  Bell, BellOff, BellPlus, BellMinus, BellRing,
  Info, AlertCircle, AlertTriangle, AlertOctagon, HelpCircle,
  Lock, Unlock, Key, Shield, ShieldCheck, ShieldAlert,
  
  // Shopping & Commerce
  ShoppingCart, ShoppingBag, Gift, CreditCard, Wallet,
  
  // Tech & Code
  Code, Terminal, Command, Database, Server, Wifi, WifiOff,
  Bluetooth, Cpu, HardDrive, Monitor, Laptop, Smartphone, Tablet,
  Battery, BatteryCharging, BatteryFull, BatteryLow,
  
  // Movement & Animation
  Move, Maximize2, Minimize2, Expand, Shrink,
  CornerUpLeft, CornerUpRight, CornerDownLeft, CornerDownRight
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
    // === BASIC SHAPES ===
    { name: 'Circle', Icon: Circle },
    { name: 'Square', Icon: Square },
    { name: 'Triangle', Icon: Triangle },
    { name: 'Hexagon', Icon: Hexagon },
    { name: 'Octagon', Icon: Octagon },
    { name: 'Star', Icon: Star },
    
    // === ARROWS & DIRECTIONS ===
    { name: 'ArrowUp', Icon: ArrowUp },
    { name: 'ArrowRight', Icon: ArrowRight },
    { name: 'ArrowDown', Icon: ArrowDown },
    { name: 'ArrowLeft', Icon: ArrowLeft },
    { name: 'ArrowUpRight', Icon: ArrowUpRight },
    { name: 'ArrowDownLeft', Icon: ArrowDownLeft },
    { name: 'ChevronUp', Icon: ChevronUp },
    { name: 'ChevronRight', Icon: ChevronRight },
    { name: 'ChevronDown', Icon: ChevronDown },
    { name: 'ChevronLeft', Icon: ChevronLeft },
    { name: 'ChevronsUp', Icon: ChevronsUp },
    { name: 'ChevronsDown', Icon: ChevronsDown },
    { name: 'TrendingUp', Icon: TrendingUp },
    { name: 'TrendingDown', Icon: TrendingDown },
    
    // === WEATHER & NATURE ===
    { name: 'Sun', Icon: Sun },
    { name: 'Moon', Icon: Moon },
    { name: 'Cloud', Icon: Cloud },
    { name: 'CloudRain', Icon: CloudRain },
    { name: 'CloudSnow', Icon: CloudSnow },
    { name: 'CloudLightning', Icon: CloudLightning },
    { name: 'CloudDrizzle', Icon: CloudDrizzle },
    { name: 'CloudFog', Icon: CloudFog },
    { name: 'Cloudy', Icon: Cloudy },
    { name: 'Wind', Icon: Wind },
    { name: 'Sunrise', Icon: Sunrise },
    { name: 'Sunset', Icon: Sunset },
    { name: 'Zap', Icon: Zap },
    { name: 'Sparkles', Icon: Sparkles },
    
    // === EMOTIONS & HEARTS ===
    { name: 'Heart', Icon: Heart },
    { name: 'HeartCrack', Icon: HeartCrack },
    { name: 'HeartHandshake', Icon: HeartHandshake },
    { name: 'HeartPulse', Icon: HeartPulse },
    { name: 'Smile', Icon: Smile },
    { name: 'Frown', Icon: Frown },
    { name: 'Meh', Icon: Meh },
    { name: 'Laugh', Icon: Laugh },
    { name: 'SmilePlus', Icon: SmilePlus },
    { name: 'Angry', Icon: Angry },
    
    // === MEDIA CONTROLS ===
    { name: 'Play', Icon: Play },
    { name: 'Pause', Icon: Pause },
    { name: 'SkipForward', Icon: SkipForward },
    { name: 'SkipBack', Icon: SkipBack },
    { name: 'FastForward', Icon: FastForward },
    { name: 'Rewind', Icon: Rewind },
    { name: 'Volume', Icon: Volume },
    { name: 'Volume1', Icon: Volume1 },
    { name: 'Volume2', Icon: Volume2 },
    { name: 'VolumeX', Icon: VolumeX },
    { name: 'Mic', Icon: Mic },
    { name: 'MicOff', Icon: MicOff },
    
    // === MUSIC & AUDIO ===
      // Music & Audio ===
    { name: 'Music', Icon: Music },
    { name: 'Music2', Icon: Music2 },
    { name: 'Radio', Icon: Radio },
    { name: 'Disc', Icon: Disc },
    
    // === FILES & FOLDERS ===
    { name: 'File', Icon: File },
    { name: 'FileText', Icon: FileText },
    { name: 'FileEdit', Icon: FileEdit },
    { name: 'FilePlus', Icon: FilePlus },
    { name: 'FileMinus', Icon: FileMinus },
    { name: 'FileCheck', Icon: FileCheck },
    { name: 'FileX', Icon: FileX },
    { name: 'Folder', Icon: Folder },
    { name: 'FolderOpen', Icon: FolderOpen },
    { name: 'FolderPlus', Icon: FolderPlus },
    
    // === CLIPBOARD ===
    { name: 'Clipboard', Icon: Clipboard },
    { name: 'ClipboardList', Icon: ClipboardList },
    { name: 'ClipboardCheck', Icon: ClipboardCheck },
    { name: 'ClipboardCopy', Icon: ClipboardCopy },
    { name: 'Copy', Icon: Copy },
    
    // === MAIL ===
    { name: 'Mail', Icon: Mail },
    { name: 'MailOpen', Icon: MailOpen },
    { name: 'MailPlus', Icon: MailPlus },
    { name: 'MailCheck', Icon: MailCheck },
    { name: 'MailX', Icon: MailX },
    { name: 'Inbox', Icon: Inbox },
    { name: 'Send', Icon: Send },
    
    // === PHONE ===
    { name: 'Phone', Icon: Phone },
    { name: 'PhoneCall', Icon: PhoneCall },
    { name: 'PhoneIncoming', Icon: PhoneIncoming },
    { name: 'PhoneOutgoing', Icon: PhoneOutgoing },
    { name: 'PhoneMissed', Icon: PhoneMissed },
    { name: 'PhoneOff', Icon: PhoneOff },
    
    // === MESSAGING ===
    { name: 'MessageCircle', Icon: MessageCircle },
    { name: 'MessageSquare', Icon: MessageSquare },
    
    // === USERS ===
    { name: 'User', Icon: User },
    { name: 'Users', Icon: Users },
    { name: 'UserPlus', Icon: UserPlus },
    { name: 'UserMinus', Icon: UserMinus },
    { name: 'UserCheck', Icon: UserCheck },
    { name: 'UserX', Icon: UserX },
    { name: 'UserCircle', Icon: UserCircle },
    { name: 'UserSquare', Icon: UserSquare },
    
    // === CHECKS & X's ===
    { name: 'Check', Icon: Check },
    { name: 'CheckCircle', Icon: CheckCircle },
    { name: 'CheckSquare', Icon: CheckSquare },
    { name: 'X', Icon: X },
    { name: 'XCircle', Icon: XCircle },
    { name: 'XSquare', Icon: XSquare },
    { name: 'XOctagon', Icon: XOctagon },
    
    // === PLUS & MINUS ===
    { name: 'Plus', Icon: Plus },
    { name: 'PlusCircle', Icon: PlusCircle },
    { name: 'PlusSquare', Icon: PlusSquare },
    { name: 'Minus', Icon: Minus },
    { name: 'MinusCircle', Icon: MinusCircle },
    { name: 'MinusSquare', Icon: MinusSquare },
    
    // === SYMBOLS ===
    { name: 'Equal', Icon: Equal },
    { name: 'Slash', Icon: Slash },
    { name: 'Percent', Icon: Percent },
    { name: 'Hash', Icon: Hash },
    { name: 'AtSign', Icon: AtSign },
    { name: 'DollarSign', Icon: DollarSign },
    
    // === NAVIGATION & LOCATION ===
    { name: 'Home', Icon: Home },
    { name: 'Building', Icon: Building },
    { name: 'Building2', Icon: Building2 },
    { name: 'MapPin', Icon: MapPin },
    { name: 'Map', Icon: Map },
    { name: 'Navigation', Icon: Navigation },
    { name: 'Compass', Icon: Compass },
    { name: 'Globe', Icon: Globe },
    
    // === UPLOAD/DOWNLOAD ===
    { name: 'Upload', Icon: Upload },
    { name: 'Download', Icon: Download },
    { name: 'UploadCloud', Icon: UploadCloud },
    { name: 'DownloadCloud', Icon: DownloadCloud },
    { name: 'Share', Icon: Share },
    { name: 'Share2', Icon: Share2 },
    { name: 'Forward', Icon: Forward },
    { name: 'Reply', Icon: Reply },
    
    // === ROTATION ===
    { name: 'RefreshCw', Icon: RefreshCw },
    { name: 'RotateCw', Icon: RotateCw },
    { name: 'RotateCcw', Icon: RotateCcw },
    
    // === TIME ===
    { name: 'Clock', Icon: Clock },
    { name: 'AlarmClock', Icon: AlarmClock },
    { name: 'Timer', Icon: Timer },
    { name: 'Hourglass', Icon: Hourglass },
    { name: 'Watch', Icon: Watch },
    { name: 'History', Icon: History },
    { name: 'Calendar', Icon: Calendar },
    { name: 'CalendarDays', Icon: CalendarDays },
    
    // === CHARTS ===
    { name: 'BarChart', Icon: BarChart },
    { name: 'BarChart2', Icon: BarChart2 },
    { name: 'BarChart3', Icon: BarChart3 },
    { name: 'PieChart', Icon: PieChart },
    { name: 'Activity', Icon: Activity },
    { name: 'LineChart', Icon: LineChart },
    { name: 'AreaChart', Icon: AreaChart },
    
    // === MEDIA OBJECTS ===
    { name: 'Camera', Icon: Camera },
    { name: 'Video', Icon: Video },
    { name: 'Image', Icon: Image },
    { name: 'Film', Icon: Film },
    { name: 'Aperture', Icon: Aperture },
    
    // === TOOLS ===
    { name: 'Scissors', Icon: Scissors },
    { name: 'Crop', Icon: Crop },
    { name: 'Maximize', Icon: Maximize },
    { name: 'Minimize', Icon: Minimize },
    { name: 'Maximize2', Icon: Maximize2 },
    { name: 'Minimize2', Icon: Minimize2 },
    { name: 'ZoomIn', Icon: ZoomIn },
    { name: 'ZoomOut', Icon: ZoomOut },
    { name: 'Expand', Icon: Expand },
    { name: 'Shrink', Icon: Shrink },
    
    // === VIEW ===
    { name: 'Eye', Icon: Eye },
    { name: 'EyeOff', Icon: EyeOff },
    { name: 'Search', Icon: Search },
    { name: 'SearchX', Icon: SearchX },
    { name: 'Filter', Icon: Filter },
    { name: 'SlidersHorizontal', Icon: SlidersHorizontal },
    
    // === SETTINGS ===
    { name: 'Settings', Icon: Settings },
    { name: 'Cog', Icon: Cog },
    { name: 'Wrench', Icon: Wrench },
    { name: 'Hammer', Icon: Hammer },
    
    // === BADGES & AWARDS ===
    { name: 'Award', Icon: Award },
    { name: 'Trophy', Icon: Trophy },
    { name: 'Medal', Icon: Medal },
    { name: 'Target', Icon: Target },
    { name: 'Flag', Icon: Flag },
    { name: 'Bookmark', Icon: Bookmark },
    { name: 'Tag', Icon: Tag },
    
    // === NOTIFICATIONS ===
    { name: 'Bell', Icon: Bell },
    { name: 'BellOff', Icon: BellOff },
    { name: 'BellPlus', Icon: BellPlus },
    { name: 'BellRing', Icon: BellRing },
    
    // === ALERTS ===
    { name: 'Info', Icon: Info },
    { name: 'AlertCircle', Icon: AlertCircle },
    { name: 'AlertTriangle', Icon: AlertTriangle },
    { name: 'AlertOctagon', Icon: AlertOctagon },
    { name: 'HelpCircle', Icon: HelpCircle },
    
    // === SECURITY ===
    { name: 'Lock', Icon: Lock },
    { name: 'Unlock', Icon: Unlock },
    { name: 'Key', Icon: Key },
    { name: 'Shield', Icon: Shield },
    { name: 'ShieldCheck', Icon: ShieldCheck },
    { name: 'ShieldAlert', Icon: ShieldAlert },
    
    // === SHOPPING ===
    { name: 'ShoppingCart', Icon: ShoppingCart },
    { name: 'ShoppingBag', Icon: ShoppingBag },
    { name: 'Gift', Icon: Gift },
    { name: 'CreditCard', Icon: CreditCard },
    { name: 'Wallet', Icon: Wallet },
    
    // === TECH ===
    { name: 'Code', Icon: Code },
    { name: 'Terminal', Icon: Terminal },
    { name: 'Command', Icon: Command },
    { name: 'Database', Icon: Database },
    { name: 'Server', Icon: Server },
    { name: 'Wifi', Icon: Wifi },
    { name: 'WifiOff', Icon: WifiOff },
    { name: 'Bluetooth', Icon: Bluetooth },
    { name: 'Cpu', Icon: Cpu },
    { name: 'HardDrive', Icon: HardDrive },
    { name: 'Monitor', Icon: Monitor },
    { name: 'Laptop', Icon: Laptop },
    { name: 'Smartphone', Icon: Smartphone },
    { name: 'Tablet', Icon: Tablet },
    
    // === BATTERY ===
    { name: 'Battery', Icon: Battery },
    { name: 'BatteryCharging', Icon: BatteryCharging },
    { name: 'BatteryFull', Icon: BatteryFull },
    { name: 'BatteryLow', Icon: BatteryLow },
    
    // === CORNERS ===
    { name: 'CornerUpLeft', Icon: CornerUpLeft },
    { name: 'CornerUpRight', Icon: CornerUpRight },
    { name: 'CornerDownLeft', Icon: CornerDownLeft },
    { name: 'CornerDownRight', Icon: CornerDownRight }
  ];

  // Extract SVG paths as an array for Multi-Path morphing
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

  // Compute slider fill percentages for inline gradient fallback
  const durationPct = Math.max(0, Math.min(100, Math.round(((duration - 500) / (3000 - 500)) * 100)));
  const smoothPct = Math.max(0, Math.min(100, Math.round(((maxSegmentLength - 1) / (10 - 1)) * 100)));

  return (
    <div className={`min-h-screen ${bg.primary} p-8`}>
      <style>{` 
        .custom-range {
          -webkit-appearance: none;
          appearance: none;
          width: 100%;
          height: 8px;
          background: transparent;
          border-radius: 9999px;
          outline: none;
          accent-color: #2563eb; /* Chromium accent fallback */
        }

        /* WebKit browsers (Chrome, Safari, Edge Chromium) */
        .custom-range::-webkit-slider-runnable-track {
          height: 8px;
          background: linear-gradient(90deg, #2563eb var(--pct, 0%), #bfdbfe var(--pct, 0%));
          border-radius: 9999px;
        }
        .custom-range::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          margin-top: -4px; /* center the thumb */
          width: 16px;
          height: 16px;
          background: #2563eb; /* blue-600 */
          border-radius: 9999px;
          box-shadow: 0 0 0 4px rgba(37,99,235,0.12);
          cursor: pointer;
        }
        .custom-range::-webkit-slider-thumb:active {
          transform: scale(0.98);
        }

        /* Firefox */
        .custom-range::-moz-range-track {
          height: 8px;
          background: #bfdbfe;
          border-radius: 9999px;
        }
        .custom-range::-moz-range-thumb {
          width: 16px;
          height: 16px;
          background: #2563eb;
          border-radius: 9999px;
          box-shadow: 0 0 0 4px rgba(37,99,235,0.12);
          cursor: pointer;
        }
        .custom-range::-moz-range-progress {
          background: #2563eb;
          height: 8px;
          border-radius: 9999px;
        }

        /* Edge / IE legacy (best-effort) */
        .custom-range::-ms-fill-lower {
          background: #2563eb;
          border-radius: 9999px;
        }
        .custom-range::-ms-fill-upper {
          background: #bfdbfe;
          border-radius: 9999px;
        }

        /* Provide a fallback visible track using background gradient; this will be overridden
           by the pseudo-element styles in most browsers, but works when those are ignored. */
        .custom-range.filled-blue {
          background: linear-gradient(90deg, #2563eb var(--pct, 0%), #bfdbfe var(--pct, 0%));
        }
      `}</style>
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
                    className="w-full custom-range filled-blue"
                    style={{ ['--pct']: `${durationPct}%` }}
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
                    className="w-full custom-range filled-blue"
                    style={{ ['--pct']: `${smoothPct}%` }}
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
