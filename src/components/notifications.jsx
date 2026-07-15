import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Bell, CheckCheck, Trash2, Filter, AlertCircle, Trash, Info, CheckCircle, AlertTriangle, Inbox, ExternalLink, RefreshCw } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useNotifications } from '../contexts/NotificationContext';
import { useNavigate } from 'react-router-dom';
import * as flubber from 'flubber';
import {
  getDemoNotificationTitle,
  getDemoNotificationMessage,
  getDemoNotificationActionLabel
} from '../utils/demoHelper';
import { resolveNotificationActionUrl } from '../utils/notificationNavigation';
import { ShinyButton } from './ui/shiny-button';
import { SlidingNumber, useNumberReplay } from './motion-primitives';
import { PageLiveClock } from './ui/page-live-clock';
import { cn } from '@/lib/utils';

function NotificationStatCard({ label, value, isDarkMode, border, text }) {
  const { replayToken, bump } = useNumberReplay();
  return (
    <div
      onMouseEnter={bump}
      className={cn(
        'group relative overflow-hidden p-3 rounded-lg bg-transparent border',
        border.primary
      )}
    >
      <p className={`relative z-10 text-xs ${text.secondary}`}>{label}</p>
      <p className={`relative z-10 text-2xl font-bold ${text.primary}`}>
        <SlidingNumber value={Number(value) || 0} replayToken={replayToken} />
      </p>
    </div>
  );
}

export const MiniFlubberAutoMorphDelete = ({
  size = 16,
  className = '',
  isDarkMode = false,
  autoMorphInterval = 1250,
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
    { name: 'TrashFull', Icon: Trash2, status: 'standard' },
    { name: 'TrashEmpty', Icon: Trash, status: 'standard' },
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

const Notifications = () => {
  const { bg, text, border, hover, isDarkMode } = useTheme();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const {
    notifications,
    unreadCount,
    loading,
    stats,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    deleteAllNotifications,
    refreshNotificationData,
    loadMoreNotifications,
    hasMoreNotifications,
    loadingMore,
    markManyAsRead
  } = useNotifications();

  const [filter, setFilter] = useState('all'); // all, unread, read
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [showFilters, setShowFilters] = useState(true);
  const [updatingNotifications, setUpdatingNotifications] = useState(new Set());
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isHoveringDeleteAll, setIsHoveringDeleteAll] = useState(false);
  const [isBulkActionRunning, setIsBulkActionRunning] = useState(false);
  const refreshTimeoutRef = useRef(null);
  const filteredUnreadIdsRef = useRef([]);
  const markManyAsReadRef = useRef(markManyAsRead);
  markManyAsReadRef.current = markManyAsRead;

  useEffect(() => {
    return () => {
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
      }
    };
  }, []);

  const clearFilters = () => {
    setFilter('all');
    setCategoryFilter('all');
    setTypeFilter('all');
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refreshNotificationData();
    } finally {
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
      }
      refreshTimeoutRef.current = setTimeout(() => setIsRefreshing(false), 500);
    }
  };

  const hasActiveFilters =
    filter !== 'all' || categoryFilter !== 'all' || typeFilter !== 'all';

  const filteredNotifications = useMemo(
    () =>
      notifications.filter((notification) => {
        if (filter === 'unread' && notification.is_read) return false;
        if (filter === 'read' && !notification.is_read) return false;
        if (categoryFilter !== 'all' && notification.category !== categoryFilter) {
          return false;
        }
        if (typeFilter !== 'all' && notification.type !== typeFilter) return false;
        return true;
      }),
    [notifications, filter, categoryFilter, typeFilter]
  );

  useEffect(() => {
    filteredUnreadIdsRef.current = filteredNotifications
      .filter((n) => !n.is_read)
      .map((n) => n.id);
  });

  useEffect(() => {
    return () => {
      const ids = filteredUnreadIdsRef.current;
      if (ids.length > 0) {
        markManyAsReadRef.current(ids);
      }
    };
  }, []);

  // Get icon for notification type
  const getTypeIcon = (type) => {
    switch (type) {
      case 'success':
        return <CheckCircle className={`h-5 w-5 ${text.secondary}`} />;
      case 'error':
        return <AlertCircle className={`h-5 w-5 ${text.secondary}`} />;
      case 'warning':
        return <AlertTriangle className={`h-5 w-5 ${text.secondary}`} />;
      default:
        return <Info className={`h-5 w-5 ${text.secondary}`} />;
    }
  };

  // Get color classes for notification type
  const getTypeColor = (type) => {
    switch (type) {
      case 'success':
        return isDarkMode ? 'border-green-700 bg-green-900/20' : 'border-green-200 bg-green-50';
      case 'error':
        return isDarkMode ? 'border-red-700 bg-red-900/20' : 'border-red-200 bg-red-50';
      case 'warning':
        return isDarkMode ? 'border-yellow-700 bg-yellow-900/20' : 'border-yellow-200 bg-yellow-50';
      default:
        return isDarkMode ? 'border-blue-700 bg-blue-900/20' : 'border-blue-200 bg-blue-50';
    }
  };

  // Format timestamp
  const formatTime = (timestamp) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    if (Number.isNaN(date.getTime())) return '';
    const now = new Date();
    const diff = now - date;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return t('notifications.justNow', 'Just now');
    if (minutes < 60) return t('notifications.minutesAgo', `${minutes}m ago`).replace('{0}', minutes);
    if (hours < 24) return t('notifications.hoursAgo', `${hours}h ago`).replace('{0}', hours);
    if (days < 7) return t('notifications.daysAgo', `${days}d ago`).replace('{0}', days);
    return date.toLocaleDateString();
  };

  const clearUpdatingNotification = (notificationId) => {
    setUpdatingNotifications(prev => {
      const next = new Set(prev);
      next.delete(notificationId);
      return next;
    });
  };

  const handleNotificationClick = async (notification) => {
    if (!notification.is_read) {
      setUpdatingNotifications(prev => new Set(prev).add(notification.id));
      try {
        await markAsRead(notification.id);
      } finally {
        clearUpdatingNotification(notification.id);
      }
    }

    const actionUrl = resolveNotificationActionUrl(notification);
    if (actionUrl) {
      navigate(actionUrl);
    }
  };

  const handleDelete = async (e, notificationId) => {
    e.stopPropagation();
    setUpdatingNotifications(prev => new Set(prev).add(notificationId));
    try {
      await deleteNotification(notificationId);
    } finally {
      clearUpdatingNotification(notificationId);
    }
  };

  const handleMarkAsRead = async (e, notificationId) => {
    e.stopPropagation();
    setUpdatingNotifications(prev => new Set(prev).add(notificationId));
    try {
      await markAsRead(notificationId);
    } finally {
      clearUpdatingNotification(notificationId);
    }
  };

  const handleMarkAllAsRead = async () => {
    if (isBulkActionRunning) return;
    setIsBulkActionRunning(true);
    try {
      await markAllAsRead();
    } finally {
      setIsBulkActionRunning(false);
    }
  };

  const handleDeleteAll = async () => {
    if (isBulkActionRunning) return;
    if (!window.confirm(t('notifications.confirmDeleteAll', 'Are you sure you want to delete all notifications?'))) {
      return;
    }
    setIsBulkActionRunning(true);
    try {
      await deleteAllNotifications();
    } finally {
      setIsBulkActionRunning(false);
    }
  };

  // Helper function to translate notification titles
  const getTranslatedTitle = (title) => {
    const titleMap = {
      'Pending Approvals': t('notifications.pendingApprovals', 'Pending Approvals'),
      'Time Entry Approved': t('notifications.timeEntryApproved', 'Time Entry Approved'),
      'Time Entry Rejected': t('notifications.timeEntryRejected', 'Time Entry Rejected'),
      'New Employee Added': t('notifications.newEmployeeAdded', 'New Employee Added'),
      'Performance Review': t('notifications.performanceReview', 'Performance Review'),
      'System Update': t('notifications.systemUpdate', 'System Update'),
    };
    return titleMap[title] || title;
  };

  // Helper function to translate notification messages
  const getTranslatedMessage = (message) => {
    // Handle dynamic messages with patterns
    const timeEntriesMatch = message.match(
      /You have (\d+) time (?:entry|entries) awaiting approval/
    );
    if (timeEntriesMatch) {
      return t('notifications.timeEntriesAwaiting', '').replace('{0}', timeEntriesMatch[1]);
    }
    return message;
  };

  // Helper function to translate action labels
  const getTranslatedActionLabel = (label) => {
    const labelMap = {
      'Review Now': t('notifications.reviewNow', 'Review Now'),
      'View Details': t('notifications.viewDetails', 'View Details'),
    };
    return labelMap[label] || label;
  };

  // Helper function to translate category names
  const getTranslatedCategory = (category) => {
    const categoryMap = {
      'general': t('notifications.general', 'General'),
      'time_tracking': t('notifications.timeTracking', 'Time Tracking'),
      'performance': t('notifications.performance', 'Performance'),
      'employee': t('notifications.employee', 'Employee'),
      'recruitment': t('notifications.recruitment', 'Recruitment'),
      'system': t('notifications.system', 'System'),
    };
    return categoryMap[category] || category;
  };

  const getNotificationTitleText = (notification) => {
    const demoTitle = getDemoNotificationTitle(notification, t);
    if (demoTitle && demoTitle !== notification.title) {
      return demoTitle;
    }
    return getTranslatedTitle(notification.title || '');
  };

  const getNotificationMessageText = (notification) => {
    const demoMessage = getDemoNotificationMessage(notification, t);
    if (demoMessage && demoMessage !== notification.message) {
      return demoMessage;
    }
    return getTranslatedMessage(notification.message || '');
  };

  const getNotificationActionLabelText = (notification) => {
    const demoLabel = getDemoNotificationActionLabel(notification, t);
    if (demoLabel && demoLabel !== notification.action_label) {
      return demoLabel;
    }
    return getTranslatedActionLabel(notification.action_label || '');
  };

  if (loading && notifications.length === 0) {
    return (
      <div className={`p-8 ${bg.primary}`}>
        <div className="max-w-none w-full mx-auto">
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`p-4 md:p-8 ${bg.primary} min-h-screen`}>
      <div className="max-w-none w-full mx-auto gap-7">
        {/* Header */}
        <div className={`${bg.secondary} rounded-lg shadow-sm border ${border.primary} p-6 mb-6`}>
          <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
            <div className="flex items-center space-x-3">
              <Bell className={`h-8 w-8 ${isDarkMode ? 'text-white' : 'text-gray-900'}`} />
              <h1 className={`text-4xl font-bold ${text.primary}`}>
                {t('notifications.title', 'Notifications')}
              </h1>
            </div>
            <PageLiveClock textClassName={text.primary} separatorClassName={text.secondary} showSeparator={false} />
          </div>
          
          {/* Action Buttons - Separated from header */}
          <div className="flex items-center space-x-2 flex-wrap gap-2">
            <button
              onClick={handleRefresh}
              disabled={isRefreshing || isBulkActionRunning}
              className={`px-4 py-2 rounded-lg group ${hover.bg} ${text.secondary} flex items-center space-x-2 transition-colors cursor-pointer disabled:opacity-50`}
              title={t('notifications.refresh', 'Refresh')}
            >
              <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''} group-hover:animate-spin origin-center transform transition-all`} />
              <span className="hidden sm:inline">{t('notifications.refresh', 'Refresh')}</span>
            </button>
            
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`px-4 py-2 group rounded-lg ${hover.bg} ${text.secondary} flex items-center space-x-2 transition-colors cursor-pointer`}
              title={t('notifications.filters', 'Filters')}
            >
              <Filter className="h-4 w-4 group-hover:animate-pulse origin-center transform transition-all" />
              <span className="hidden sm:inline">{t('notifications.filters', 'Filters')}</span>
            </button>
            
            {unreadCount > 0 && (
              <ShinyButton
                type="button"
                onClick={handleMarkAllAsRead}
                disabled={isBulkActionRunning}
                className={cn('group px-4 py-2 disabled:opacity-50 disabled:cursor-not-allowed', hover.bg, text.secondary)}
                title={t('notifications.markAllRead', 'Mark all as read')}
              >
                <CheckCheck className="h-4 w-4 group-hover:animate-ping origin-center transform transition-all" />
                <span className="hidden sm:inline">{t('notifications.markAllRead', 'Mark all as read')}</span>
              </ShinyButton>
            )}
            
            {notifications.length > 0 && (
              <ShinyButton
                type="button"
                onMouseEnter={() => setIsHoveringDeleteAll(true)}
                onMouseLeave={() => setIsHoveringDeleteAll(false)}
                onClick={handleDeleteAll}
                disabled={isBulkActionRunning}
                className={cn('px-4 py-2 disabled:opacity-50 disabled:cursor-not-allowed', hover.bg, text.secondary)}
                title={t('notifications.deleteAll', 'Delete all')}
              >
                {isHoveringDeleteAll ? (
                  <MiniFlubberAutoMorphDelete size={16} className="h-4 w-4 transition-all" isDarkMode={isDarkMode} />
                ) : (
                  <Trash2 className="h-4 w-4 group-hover:scale-110 transition-all" />
                )}
                <span className="hidden sm:inline">{t('notifications.deleteAll', 'Delete all')}</span>
              </ShinyButton>
            )}
          </div>

          {/* Statistics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
            <NotificationStatCard
              label={t('notifications.total', 'Total')}
              value={stats.total_notifications}
              border={border}
              text={text}
            />
            <NotificationStatCard
              label={t('notifications.unread', 'Unread')}
              value={stats.unread_count}
              border={border}
              text={text}
            />
            <NotificationStatCard
              label={t('notifications.errors', 'Errors')}
              value={stats.error_count}
              border={border}
              text={text}
            />
            <NotificationStatCard
              label={t('notifications.warnings', 'Warnings')}
              value={stats.warning_count}
              border={border}
              text={text}
            />
          </div>
        </div>

        {/* Filters Panel */}
        {showFilters && (
          <div className={`${bg.secondary} rounded-lg shadow-sm border ${border.primary} p-6 mb-6`}>
            <h3 className={`text-lg font-semibold ${text.primary} mb-4`}>
              {t('notifications.filterBy', 'Filter By')}
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Status Filter */}
              <div>
                <label className={`block text-sm font-medium ${text.secondary} mb-2`}>
                  {t('notifications.status', 'Status')}
                </label>
                <select
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  className={`w-full px-3 py-2 ${bg.primary} ${text.primary} border ${border.primary} rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer`}
                >
                  <option value="all">{t('notifications.allNotifications', 'All Notifications')}</option>
                  <option value="unread">{t('notifications.unreadOnly', 'Unread Only')}</option>
                  <option value="read">{t('notifications.readOnly', 'Read Only')}</option>
                </select>
              </div>

              {/* Type Filter */}
              <div>
                <label className={`block text-sm font-medium ${text.secondary} mb-2`}>
                  {t('notifications.type', 'Type')}
                </label>
                <select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                  className={`w-full px-3 py-2 ${bg.primary} ${text.primary} border ${border.primary} rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer`}
                >
                  <option value="all">{t('notifications.allTypes', 'All Types')}</option>
                  <option value="info">{t('notifications.info', 'Info')}</option>
                  <option value="success">{t('notifications.success', 'Success')}</option>
                  <option value="warning">{t('notifications.warning', 'Warning')}</option>
                  <option value="error">{t('notifications.error', 'Error')}</option>
                </select>
              </div>

              {/* Category Filter */}
              <div>
                <label className={`block text-sm font-medium ${text.secondary} mb-2`}>
                  {t('notifications.category', 'Category')}
                </label>
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className={`w-full px-3 py-2 ${bg.primary} ${text.primary} border ${border.primary} rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer`}
                >
                  <option value="all">{t('notifications.allCategories', 'All Categories')}</option>
                  <option value="general">{t('notifications.general', 'General')}</option>
                  <option value="time_tracking">{t('notifications.timeTracking', 'Time Tracking')}</option>
                  <option value="performance">{t('notifications.performance', 'Performance')}</option>
                  <option value="employee">{t('notifications.employee', 'Employee')}</option>
                  <option value="recruitment">{t('notifications.recruitment', 'Recruitment')}</option>
                  <option value="system">{t('notifications.system', 'System')}</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Notifications List */}
        {filteredNotifications.length === 0 ? (
          <div className={`${bg.secondary} rounded-lg shadow-sm border ${border.primary} p-12`}>
            <div className="text-center">
              <Inbox className={`h-16 w-16 ${text.secondary} mx-auto mb-4 opacity-50`} />
              <h3 className={`text-xl font-semibold ${text.primary} mb-2`}>
                {t('notifications.noNotifications', 'No notifications')}
              </h3>
              <p className={`${text.secondary}`}>
                {hasActiveFilters || notifications.length > 0
                  ? t('notifications.noNotificationsFilter', 'No notifications match your filters')
                  : t('notifications.noNotificationsYet', 'You don\'t have any notifications yet')
                }
              </p>
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="mt-4 px-4 py-2 text-sm font-medium text-blue-600 hover:text-blue-700 cursor-pointer"
                >
                  {t('notifications.clearFilters', 'Clear filters')}
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredNotifications.map((notification) => (
              <div
                key={notification.id}
                role={notification.action_url ? 'button' : undefined}
                tabIndex={notification.action_url ? 0 : undefined}
                onClick={() => handleNotificationClick(notification)}
                onKeyDown={(e) => {
                  if (notification.action_url && (e.key === 'Enter' || e.key === ' ')) {
                    e.preventDefault();
                    handleNotificationClick(notification);
                  }
                }}
                className={`rounded-lg shadow-sm border
                  ${getTypeColor(notification.type)}
                  cursor-pointer hover:shadow-md
                  ${!notification.is_read ? 'border-l-4 border-l-blue-600' : border.primary}
                  ${updatingNotifications.has(notification.id) ? 'opacity-50 pointer-events-none' : ''}
                  p-4 transition-all duration-200
                `}
              >
                <div className="flex items-start space-x-4">
                  {/* Icon */}
                  <div className="shrink-0 mt-1">
                    {updatingNotifications.has(notification.id) ? (
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
                    ) : (
                      getTypeIcon(notification.type)
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2">
                          <h4 className={`font-semibold ${text.primary}`}>
                            {getNotificationTitleText(notification)}
                          </h4>
                          {!notification.is_read && (
                            <span className="w-2 h-2 bg-blue-600 rounded-full"></span>
                          )}
                        </div>
                        <p className={`text-sm ${text.secondary} mt-1`}>
                          {getNotificationMessageText(notification)}
                        </p>
                        
                        {/* Action Button */}
                        {notification.action_url && notification.action_label && (
                          <span className="mt-2 text-sm text-blue-600 font-medium inline-flex items-center space-x-1">
                            <span>{getNotificationActionLabelText(notification)}</span>
                            <ExternalLink className="h-3 w-3" />
                          </span>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex items-center space-x-2 ml-4">
                        {!notification.is_read && (
                          <button
                            onClick={(e) => handleMarkAsRead(e, notification.id)}
                            className={`p-2 rounded-lg ${hover.bg} ${text.secondary} transition-colors cursor-pointer`}
                            title={t('notifications.markAsRead', 'Mark as read')}
                          >
                            <CheckCheck className="h-4 w-4" />
                          </button>
                        )}
                        <button
                          onClick={(e) => handleDelete(e, notification.id)}
                          className={`p-2 rounded-lg ${hover.bg} ${text.primary} transition-colors cursor-pointer`}
                          title={t('notifications.delete', 'Delete')}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>

                    {/* Metadata */}
                    <div className="flex items-center space-x-4 mt-2">
                      <span className={`text-xs ${text.secondary}`}>
                        {formatTime(notification.created_at)}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${isDarkMode ? 'bg-gray-700' : 'bg-gray-200'} ${text.secondary}`}>
                        {getTranslatedCategory(notification.category)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}

            {hasMoreNotifications && (
              <div className="flex justify-center pt-2">
                <ShinyButton
                  type="button"
                  onClick={loadMoreNotifications}
                  disabled={loadingMore}
                  className={cn('px-6 py-2 border text-sm font-medium disabled:opacity-50', border.primary, hover.bg, text.secondary)}
                >
                  {loadingMore
                    ? t('notifications.loadingMore', 'Loading...')
                    : t('notifications.loadMore', 'Load more')}
                </ShinyButton>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Notifications;
